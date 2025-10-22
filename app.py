"""Flask backend for bot arena prototype (simplified).

This cleaned version removes support for persistent local bot processes and the
parsed/in-memory execution paths. Bots are executed per-turn via a BotRunner
(using a persisted file path if present, or inline code attached to the game
entry).
"""
from flask import Flask, jsonify, request, send_from_directory
from referees.pacman_referee import PacmanReferee
import os
import pathlib
from game_sdk import Referee, make_bot_runner, BotRunner
from runner.docker_runner import get_last_run_debug, set_console_tracing, is_console_tracing_enabled
from flask_cors import CORS
import uuid
import subprocess
import logging
import errno
import json
import re
import traceback

# Configure basic logging so INFO logs appear in the Flask console by default
logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(name)s: %(message)s')
# Ensure Flask and werkzeug loggers propagate at INFO level
logging.getLogger('werkzeug').setLevel(logging.INFO)

app = Flask(__name__, static_folder='static', static_url_path='/static')
# Ensure app logger level
app.logger.setLevel(logging.INFO)
CORS(app)

# Directory where edited player bots are persisted so they can be mounted into Docker
PERSISTENT_BOTS_DIR = os.environ.get('PERSISTENT_BOTS_DIR', 'persistent_bots')
try:
    pathlib.Path(PERSISTENT_BOTS_DIR).mkdir(parents=True, exist_ok=True)
except OSError as e:
    if e.errno != errno.EEXIST:
        raise

# Simple games index persisted to disk to allow short-lived server restarts without losing game ids
GAMES_INDEX_PATH = os.path.join(PERSISTENT_BOTS_DIR, 'games_index.json')

# In-memory games store
GAMES = {}
REFEREES = {
    'pacman': PacmanReferee
}

# -------------------- helpers --------------------

def load_games_index():
    try:
        if os.path.exists(GAMES_INDEX_PATH):
            with open(GAMES_INDEX_PATH, 'r', encoding='utf-8') as f:
                return json.load(f)
    except Exception:
        logging.getLogger(__name__).exception('failed to load games index')
    return {}


def save_games_index_entry(game_id: str, meta: dict):
    idx = load_games_index()
    idx[game_id] = meta
    try:
        with open(GAMES_INDEX_PATH, 'w', encoding='utf-8') as f:
            json.dump(idx, f)
    except Exception:
        logging.getLogger(__name__).exception('failed to write games index')


def restore_game_from_index(game_id: str):
    idx = load_games_index()
    meta = idx.get(game_id)
    if not meta:
        return None
    maker = REFEREES.get(meta.get('referee', 'pacman'))
    if not maker:
        return None
    ref = maker()
    ref.init_game({})
    game_entry = {
        'id': game_id,
        'ref': ref,
        'player_code': None,
        'player_bot_path': meta.get('player_bot_path'),
        'opponent': meta.get('opponent', 'default_opponent_cli'),
        'bot_runner': meta.get('bot_runner'),
        'history': ref.history
    }
    GAMES[game_id] = game_entry
    # Log restore so operator sees which opponent is associated
    try:
        logging.getLogger(__name__).info('restored game %s from index, opponent=%s, player_bot_path=%s', game_id, game_entry.get('opponent'), bool(game_entry.get('player_bot_path')))
    except Exception:
        pass
    return game_entry


# Helper: run bot code in a subprocess (unused normally, kept for debugging)
def run_bot_python(bot_code: str, input_str: str, timeout_ms: int = 50):
    cmd = ['python3', '-c', bot_code]
    try:
        proc = subprocess.Popen(cmd, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        try:
            out, err = proc.communicate(input=input_str, timeout=timeout_ms/1000.0)
            return out, err, proc.returncode
        except subprocess.TimeoutExpired:
            proc.kill()
            return '', 'timeout', -1
    except Exception as e:
        return '', str(e), -1


# Validate action text
ACTION_RE = re.compile(r'^(STAY|MOVE\s+-?\d+\s+-?\d+(?:\s+-?\d+)?)$', re.IGNORECASE)

def validate_action_format(raw_output: str, normalized_action: str):
    if not raw_output:
        return normalized_action, ''
    first_line = ''
    for ln in raw_output.splitlines():
        if ln and ln.strip():
            first_line = ln.strip()
            break
    if not first_line:
        return normalized_action, ''
    if ACTION_RE.match(first_line):
        return normalized_action, ''
    return normalized_action, f'invalid action format: "{first_line}"'


# Run a bot for a role using BotRunner (file or inline code)
def _run_bot_for_role(game: dict, ref: Referee, role: str, bot_cli_input: str, initial_map_block: str, timeout_ms: int, memory_mb: int, cpus: float):
    bot_code = None
    bot_path = None
    if role == 'player':
        bot_path = game.get('player_bot_path')
        if bot_path and os.path.exists(bot_path):
            try:
                with open(bot_path, 'r', encoding='utf-8') as f:
                    bot_code = f.read()
            except Exception:
                bot_code = None
        if not bot_code:
            bot_code = game.get('player_code')
    else:
        opp_setting = game.get('opponent')
        if opp_setting and os.path.exists(opp_setting):
            bot_path = opp_setting
            try:
                with open(bot_path, 'r', encoding='utf-8') as f:
                    bot_code = f.read()
            except Exception:
                bot_code = None
        else:
            default_opp = os.path.join('bots', 'default_opponent_cli.py')
            if os.path.exists(default_opp):
                bot_path = default_opp
                try:
                    with open(bot_path, 'r', encoding='utf-8') as f:
                        bot_code = f.read()
                except Exception:
                    bot_code = None

    if not bot_code:
        try:
            ref.on_bot_timeout(role, ref.turn, 'no bot implementation')
        except Exception:
            pass
        logging.getLogger(__name__).info('game %s role=%s: no bot implementation (path=%s)', game.get('id'), role, bot_path)
        return 'STAY', {'stdout': '', 'stderr': 'no bot implementation', 'rc': -1, 'runner': 'engine', 'path': bot_path}

    # If the bot source contains a top-level while loop we can run it in parsed-mode
    # so that initialization runs once and the per-turn body is invoked repeatedly.
    # This avoids running the whole script in a subprocess where stdin is closed after
    # sending a single combined input (which causes EOFError on the next input()).
    try:
        # prepare storage for parsed bots per game
        parsed_store = game.setdefault('parsed_bots', {})
        parsed_entry = parsed_store.get(role)
        if not parsed_entry:
             # Try to parse bot code and detect a per-turn loop
            try:
                from game_sdk import parse_bot_code, run_parsed_init, run_parsed_turn
                parsed = parse_bot_code(bot_code)
                # Run init once using the initial_map_block
                out_init, err_init, rc_init = run_parsed_init(parsed, initial_map_block or '', timeout_ms=max(2000, timeout_ms))
                # store parsed object and its init outputs for subsequent turns
                parsed_store[role] = {'parsed': parsed, 'init_stdout': out_init or '', 'init_stderr': err_init or ''}
                parsed_entry = parsed_store[role]
                # If init raised exception (rc_init != 0), record stderr but continue to attempt turns
                init_stdout = parsed_entry.get('init_stdout', '')
                init_stderr = parsed_entry.get('init_stderr', '')
            except Exception:
                parsed_entry = None
        # If we have a parsed entry with turn code, run it for this turn
        if parsed_entry:
            try:
                from game_sdk import run_parsed_turn
                parsed_obj = parsed_entry.get('parsed') if isinstance(parsed_entry, dict) else parsed_entry
                out, err, rc = run_parsed_turn(parsed_obj, bot_cli_input or '', timeout_ms=max(2000, timeout_ms))
                runner_used = 'parsed'
                if rc == -1:
                    try:
                        ref.on_bot_timeout(role, ref.turn, err or 'timeout')
                    except Exception:
                        pass
                    logging.getLogger(__name__).info('game %s role=%s: parsed execution failed/timeout (path=%s) runner=%s', game.get('id'), role, bot_path, runner_used)
                    return 'STAY', {'stdout': out or '', 'stderr': err or 'timeout', 'rc': rc, 'runner': runner_used, 'parsed': True, 'path': bot_path}
                action = ref.parse_bot_output(role, out)
                action, fmt_err = validate_action_format(out, action)
                stderr_field = (err or '') + (('; ' + fmt_err) if fmt_err else '')
                # include init stderr if present (helps debug init failures)
                if isinstance(parsed_entry, dict):
                    if parsed_entry.get('init_stderr'):
                        stderr_field = (parsed_entry.get('init_stderr') or '') + (('; ' + stderr_field) if stderr_field else '')
                logging.getLogger(__name__).info('game %s role=%s: executed parsed bot (path=%s) runner=%s', game.get('id'), role, bot_path, runner_used)
                return action, {'stdout': out, 'stderr': stderr_field, 'rc': rc, 'runner': runner_used, 'parsed': True, 'path': bot_path}
            except Exception as e:
                # parsing-based execution failed; fall back to normal runner below
                logging.getLogger(__name__).exception('parsed execution failed for role %s in game %s', role, game.get('id'))
                # remove parsed entry to avoid repeated failures
                try:
                    parsed_store.pop(role, None)
                except Exception:
                    pass
        # Fallback: run via BotRunner (docker/subprocess)
        game_runner_mode = game.get('bot_runner')
        runner = BotRunner(mode=game_runner_mode) if game_runner_mode else make_bot_runner()
        full_input = (initial_map_block or '') + (bot_cli_input or '')
        out, err, rc, runner_used = runner.run(bot_code, full_input, timeout_ms=timeout_ms, memory_mb=memory_mb, cpus=cpus, host_bot_dir=(os.path.dirname(bot_path) if bot_path else None))
        if rc == -1:
            try:
                ref.on_bot_timeout(role, ref.turn, err or 'timeout')
            except Exception:
                pass
            logging.getLogger(__name__).info('game %s role=%s: runner execution failed (path=%s) runner=%s err=%s', game.get('id'), role, bot_path, runner_used, err)
            return 'STAY', {'stdout': out or '', 'stderr': err or 'timeout', 'rc': rc, 'runner': runner_used, 'path': bot_path}
        action = ref.parse_bot_output(role, out)
        action, fmt_err = validate_action_format(out, action)
        stderr_field = (err or '') + (('; ' + fmt_err) if fmt_err else '')
        logging.getLogger(__name__).info('game %s role=%s: executed runner bot (path=%s) runner=%s', game.get('id'), role, bot_path, runner_used)
        return action, {'stdout': out, 'stderr': stderr_field, 'rc': rc, 'runner': runner_used, 'path': bot_path}
    except Exception as e:
        logging.getLogger(__name__).exception('game %s role=%s: unexpected error executing bot at path=%s', game.get('id'), role, bot_path)
        return 'STAY', {'stdout': '', 'stderr': str(e), 'rc': -1, 'runner': 'runner', 'path': bot_path}


# -------------------- HTTP endpoints --------------------

@app.route('/')
def index():
    return send_from_directory('static', 'index.html')


@app.route('/api/referees')
def list_referees():
    data = {}
    for name, maker in REFEREES.items():
        ref = maker()
        data[name] = ref.get_protocol()
    return jsonify(data)


@app.route('/api/player/template')
def get_player_template():
    try:
        tpl_path = os.path.join('bots', 'player_template.py')
        with open(tpl_path, 'r', encoding='utf-8') as f:
            src = f.read()
        return jsonify({'template': src})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/player/code/<bot_id>', methods=['GET', 'POST'])
def player_code(bot_id):
    bot_dir = os.path.join(PERSISTENT_BOTS_DIR, bot_id)
    bot_path = os.path.join(bot_dir, 'bot.py')
    if request.method == 'GET':
        if not os.path.exists(bot_path):
            return jsonify({'exists': False}), 404
        try:
            with open(bot_path, 'r', encoding='utf-8') as f:
                return jsonify({'exists': True, 'code': f.read()})
        except Exception as e:
            return jsonify({'error': str(e)}), 500
    else:
        body = request.json or {}
        code = body.get('code')
        if code is None:
            return jsonify({'error': 'missing code'}), 400
        try:
            pathlib.Path(bot_dir).mkdir(parents=True, exist_ok=True)
            with open(bot_path, 'w', encoding='utf-8') as f:
                f.write(code)
            affected = []
            for gid, g in list(GAMES.items()):
                try:
                    if g.get('player_bot_path') == bot_path:
                        affected.append({'game_id': gid, 'action': 'updated_path'})
                except Exception:
                    logging.getLogger(__name__).exception('error while checking games for saved bot %s', bot_id)
            return jsonify({'saved': True, 'path': bot_path, 'affected_games': affected})
        except Exception as e:
            return jsonify({'error': str(e)}), 500


@app.route('/api/games', methods=['POST'])
def create_game():
    body = request.json or {}
    referee_name = body.get('referee', 'pacman')
    player_code = body.get('player_code', None)
    opponent = body.get('opponent', 'default_opponent_cli')
    bot_runner = body.get('bot_runner')
    maker = REFEREES.get(referee_name)
    if not maker:
        return jsonify({'error':'unknown referee'}), 400
    ref = maker()
    ref.init_game({})
    game_id = str(uuid.uuid4())
    game_entry = {
        'id': game_id,
        'ref': ref,
        'player_code': None,
        'player_bot_path': None,
        'opponent': opponent,
        'bot_runner': bot_runner,
        'history': []
    }
    player_bot_id = body.get('player_bot_id')
    if player_bot_id:
        candidate = os.path.join(PERSISTENT_BOTS_DIR, player_bot_id, 'bot.py')
        if os.path.exists(candidate):
            game_entry['player_bot_path'] = candidate

    if player_code:
        bot_dir = os.path.join(PERSISTENT_BOTS_DIR, game_id)
        pathlib.Path(bot_dir).mkdir(parents=True, exist_ok=True)
        bot_path = os.path.join(bot_dir, 'bot.py')
        try:
            with open(bot_path, 'w', encoding='utf-8') as f:
                f.write(player_code)
            game_entry['player_bot_path'] = bot_path
        except Exception:
            game_entry['player_code'] = player_code

    game_entry['history'] = ref.history

    save_games_index_entry(game_id, {
        'player_bot_path': game_entry.get('player_bot_path'),
        'opponent': game_entry.get('opponent'),
        'bot_runner': game_entry.get('bot_runner'),
        'referee': referee_name
    })
    GAMES[game_id] = game_entry
    # Log created game with opponent name so it's visible in Flask console
    logging.getLogger(__name__).info('created game %s, opponent=%s, player_bot_path=%s', game_id, game_entry.get('opponent'), bool(game_entry.get('player_bot_path')))
    return jsonify({'game_id': game_id})


@app.route('/api/games/<game_id>', methods=['GET'])
def get_game_info(game_id):
    g = GAMES.get(game_id)
    if not g:
        g = restore_game_from_index(game_id)
    if not g:
        return jsonify({'error': 'not found'}), 404
    info = {
        'id': g.get('id'),
        'player_bot_path': g.get('player_bot_path') is not None,
        'opponent': g.get('opponent')
    }
    return jsonify({'game': info})


@app.route('/api/games/<game_id>/step', methods=['POST'])
def step_game(game_id):
    try:
        game = GAMES.get(game_id)
        if not game:
            game = restore_game_from_index(game_id)
        if not game:
            return jsonify({'error': 'not found'}), 404

        logging.getLogger(__name__).debug('step_game called for game_id=%s', game_id)
        ref: Referee = game['ref']

        timeout_ms = ref.get_protocol().get('constraints', {}).get('time_ms', 50)
        memory_mb = ref.get_protocol().get('constraints', {}).get('memory_mb', 64)
        cpus = ref.get_protocol().get('constraints', {}).get('cpus', 0.5)

        if ref.is_finished():
            return jsonify({'finished': True, 'state': ref.get_state(), 'history': ref.history})

        actions = {}
        player_log = {'stdout': '', 'stderr': '', 'rc': 0, 'runner': ''}
        opponent_log = {'stdout': '', 'stderr': '', 'rc': 0, 'runner': ''}

        player_input = ref.make_bot_input('player')
        opponent_input = ref.make_bot_input('opponent')

        try:
            width = getattr(ref, 'width')
            height = getattr(ref, 'height')
            rows = [''.join(ref.grid[y]) for y in range(height)]
            initial_map_block = f"{width} {height}\n" + '\n'.join(rows) + '\n'
        except Exception:
            initial_map_block = ''

        try:
            action_player, player_log = _run_bot_for_role(game, ref, 'player', player_input, initial_map_block, timeout_ms, memory_mb, cpus)
        except Exception as e:
            logging.getLogger(__name__).exception('error running player bot for game %s', game.get('id'))
            action_player, player_log = 'STAY', {'stdout': '', 'stderr': str(e), 'rc': -1, 'runner': 'exception'}
        actions['player'] = action_player or 'STAY'

        # Log which opponent will be used for this step so it's visible in console
        try:
            # Use info level so the opponent name is visible in normal Flask logs
            logging.getLogger(__name__).info('game %s: opponent=%s', game_id, game.get('opponent'))
        except Exception:
            pass

        try:
            action_opp, opponent_log = _run_bot_for_role(game, ref, 'opponent', opponent_input, initial_map_block, timeout_ms, memory_mb, cpus)
        except Exception as e:
            logging.getLogger(__name__).exception('error running opponent bot for game %s', game.get('id'))
            action_opp, opponent_log = 'STAY', {'stdout': '', 'stderr': str(e), 'rc': -1, 'runner': 'exception'}
        actions['opponent'] = action_opp or 'STAY'

        state, stdout, stderr = ref.step(actions)
        entry = ref.history[-1]
        entry['bot_logs'] = {'player': player_log, 'opponent': opponent_log}

        return jsonify({'state': state, 'stdout': stdout, 'stderr': stderr, 'history_entry': entry})

    except Exception as e:
        logging.getLogger(__name__).exception('Error in step_game for game_id=%s', game_id)
        return jsonify({'error': 'internal error', 'detail': str(e)}), 500


@app.route('/api/games/<game_id>/history')
def get_history(game_id):
    game = GAMES.get(game_id)
    if not game:
        game = restore_game_from_index(game_id)
    if not game:
        return jsonify({'error': 'not found'}), 404
    ref: Referee = game['ref']
    return jsonify({'history': ref.history})


@app.route('/api/runner/check')
def check_runner():
    try:
        proc = subprocess.run(['docker', '--version'], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=5)
        if proc.returncode == 0:
            return jsonify({'available': True, 'version': proc.stdout.strip()})
        else:
            return jsonify({'available': False, 'error': proc.stderr.strip() or proc.stdout.strip()}), 500
    except FileNotFoundError:
        return jsonify({'available': False, 'error': 'docker not found'}), 500
    except subprocess.TimeoutExpired:
        return jsonify({'available': False, 'error': 'docker timeout'}), 500


@app.route('/api/runner/verify', methods=['GET'])
def verify_runner_execution():
    test_code = """import sys
_ = sys.stdin.read()
print('PING')
"""
    timeout_ms = 2000
    old_flag = os.environ.get('DOCKER_RUNNER_PER_RUN_CHECKS')
    os.environ['DOCKER_RUNNER_PER_RUN_CHECKS'] = '1'
    try:
        runner = make_bot_runner()
        out, err, rc, runner_used = runner.run(test_code, "", timeout_ms=timeout_ms, memory_mb=64, cpus=0.5)
        debug = get_last_run_debug()
        return jsonify({'ok': True, 'runner_used': runner_used, 'stdout': out, 'stderr': err, 'rc': rc, 'debug': debug})
    except Exception as e:
        debug = get_last_run_debug()
        return jsonify({'ok': False, 'error': str(e), 'debug': debug}), 500
    finally:
        if old_flag is None:
            os.environ.pop('DOCKER_RUNNER_PER_RUN_CHECKS', None)
        else:
            os.environ['DOCKER_RUNNER_PER_RUN_CHECKS'] = old_flag


@app.route('/api/runner/logging', methods=['GET'])
def get_runner_logging():
    try:
        enabled = is_console_tracing_enabled()
        return jsonify({'enabled': bool(enabled)})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/runner/logging', methods=['POST'])
def set_runner_logging():
    body = request.json or {}
    if 'enabled' not in body:
        return jsonify({'error': 'missing "enabled" boolean in request body'}), 400
    try:
        enabled = bool(body.get('enabled'))
        set_console_tracing(enabled)
        return jsonify({'enabled': is_console_tracing_enabled()})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/runner/env', methods=['GET'])
def get_runner_env():
    import pkgutil
    import subprocess as _subp
    import sys as _sys
    import json as _json
    try:
        limit = int(request.args.get('limit', '200'))
        if limit < 0:
            limit = 0
    except Exception:
        limit = 200

    try:
        py_exec = _sys.executable
        py_version = _sys.version
        all_mods = sorted([m.name for m in pkgutil.iter_modules()])
        subprocess_info = {'executable': py_exec, 'version': py_version, 'modules_count': len(all_mods), 'modules_sample': all_mods[:limit]}
    except Exception as e:
        subprocess_info = {'error': str(e)}

    docker_image = os.environ.get('BOT_DOCKER_IMAGE', 'python:3.11-slim')
    docker_info = {'image': docker_image, 'available': False}

    try:
        check = _subp.run(['docker', '--version'], stdout=_subp.PIPE, stderr=_subp.PIPE, text=True, timeout=3)
        docker_info['available'] = (check.returncode == 0)
        docker_info['docker_version'] = (check.stdout or check.stderr or '').strip()
    except Exception as e:
        docker_info['available'] = False
        docker_info['error'] = str(e)

    if docker_info.get('available'):
        try:
            snippet = """import sys,pkgutil,json
mods = sorted([m.name for m in pkgutil.iter_modules()])
print(json.dumps({'version': sys.version, 'modules': mods}))
"""
            cmd = ['docker', 'run', '--rm', '--network', 'none', docker_image, 'python3', '-c', snippet]
            proc = _subp.run(cmd, stdout=_subp.PIPE, stderr=_subp.PIPE, text=True, timeout=30)
            if proc.returncode == 0:
                try:
                    payload = _json.loads(proc.stdout)
                    mods = payload.get('modules', []) or []
                    docker_info['python_version'] = payload.get('version')
                    docker_info['modules_count'] = len(mods)
                    docker_info['modules_sample'] = mods[:limit]
                except Exception as e:
                    docker_info['error'] = f'failed to parse docker output: {e}'; docker_info['raw_stdout'] = proc.stdout[:2000]
            else:
                docker_info['error'] = (proc.stderr or proc.stdout).strip()
        except Exception as e:
            docker_info['available'] = False
            docker_info['error'] = str(e)

    return jsonify({'subprocess': subprocess_info, 'docker': docker_info})


@app.route('/static/<path:path>')
def send_static(path):
    return send_from_directory('static', path)


@app.errorhandler(Exception)
def _handle_unexpected_error(e):
    logging.getLogger(__name__).exception('Unhandled exception in request')
    try:
        pathlib.Path(PERSISTENT_BOTS_DIR).mkdir(parents=True, exist_ok=True)
        err_path = os.path.join(PERSISTENT_BOTS_DIR, 'error.log')
        with open(err_path, 'a', encoding='utf-8') as ef:
            ef.write('\n==== Exception on request ====' + '\n')
            ef.write(traceback.format_exc())
            ef.write('\n')
    except Exception:
        logging.getLogger(__name__).exception('failed to write persistent error log')
    try:
        from werkzeug.exceptions import HTTPException
        if isinstance(e, HTTPException):
            return jsonify({'error': str(e)}), e.code
    except Exception:
        pass
    return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    logging.basicConfig(level=logging.DEBUG)
    app.run(host='0.0.0.0', port=3000, debug=True)
