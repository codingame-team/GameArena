"""Flask backend for bot arena prototype (refactored).

Architecture:
- API Layer (app.py): Routes HTTP, validation inputs
- Service Layer (services/): Logique métier
- Repository Layer (repositories/): Accès données
- Domain Layer (game_sdk, models): Entités et règles métier

SOLID compliant avec séparation des responsabilités.
"""
from flask import Flask, jsonify, request, send_from_directory, send_file
from werkzeug.utils import secure_filename
from referees.pacman_referee import PacmanReferee
import os
import pathlib
from game_sdk import Referee, make_bot_runner, BotRunner
from runner.docker_runner import get_last_run_debug, set_console_tracing, is_console_tracing_enabled
from flask_cors import CORS
from flask_jwt_extended import JWTManager, jwt_required, get_jwt_identity
from models import db, User, Bot, Match
from auth import register_user, login_user, get_current_user
from arena import ArenaManager
import uuid
import subprocess
import logging
import errno
import json
import re
import traceback
import datetime as dt

# Import des services et repositories (DIP)
from services.bot_service import BotService
from services.game_service import GameService
from repositories.bot_repository import BotRepository
from repositories.game_repository import GameRepository
from repositories.user_repository import UserRepository

# Configure basic logging so INFO logs appear in the Flask console by default
logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(name)s: %(message)s')
# Ensure Flask and werkzeug loggers propagate at INFO level
logging.getLogger('werkzeug').setLevel(logging.INFO)

app = Flask(__name__, static_folder='static', static_url_path='/static')
# Ensure app logger level
app.logger.setLevel(logging.INFO)

# Configuration
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev-secret-key-change-in-production')
app.config['JWT_SECRET_KEY'] = os.environ.get('JWT_SECRET_KEY', 'jwt-secret-key-change-in-production')
app.config['JWT_TOKEN_LOCATION'] = ['headers']
app.config['JWT_HEADER_NAME'] = 'Authorization'
app.config['JWT_HEADER_TYPE'] = 'Bearer'
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL', 'sqlite:///gamearena.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Initialize extensions
CORS(app, supports_credentials=True, origins='*')
db.init_app(app)
jwt = JWTManager(app)

# JWT error handlers
@jwt.invalid_token_loader
def invalid_token_callback(error):
    return jsonify({'error': 'Invalid token', 'message': str(error)}), 422

@jwt.unauthorized_loader
def missing_token_callback(error):
    return jsonify({'error': 'Authorization required', 'message': str(error)}), 401

@jwt.expired_token_loader
def expired_token_callback(jwt_header, jwt_payload):
    return jsonify({'error': 'Token has expired'}), 401

# Initialize arena manager
arena_manager = ArenaManager(referee_type='pacman')

# Create tables
with app.app_context():
    db.create_all()

# Directory where edited player bots are persisted so they can be mounted into Docker
PERSISTENT_BOTS_DIR = os.environ.get('PERSISTENT_BOTS_DIR', 'persistent_bots')
try:
    pathlib.Path(PERSISTENT_BOTS_DIR).mkdir(parents=True, exist_ok=True)
except OSError as e:
    if e.errno != errno.EEXIST:
        raise

# Simple games index persisted to disk to allow short-lived server restarts without losing game ids
GAMES_INDEX_PATH = os.path.join(PERSISTENT_BOTS_DIR, 'games_index.json')

# In-memory games store (legacy, sera progressivement remplacé par GameService)
GAMES = {}
REFEREES = {
    'pacman': PacmanReferee
}

# -------------------- Service Layer Initialization (DIP) --------------------
# Les services sont injectés avec leurs dépendances (repositories)
# Pattern: Dependency Injection pour faciliter les tests et respecter SOLID

game_repository = GameRepository(PERSISTENT_BOTS_DIR, 'games_index.json')
bot_repository = BotRepository()
user_repository = UserRepository()

bot_service = BotService(bot_repository, game_repository)
game_service = GameService(REFEREES, game_repository, bot_repository)

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
        'player_bot_id': meta.get('player_bot_id'),
        'opponent': meta.get('opponent', 'Boss'),
        'bot_runner': meta.get('bot_runner'),
        'history': ref.history
    }
    GAMES[game_id] = game_entry
    # Log restore so operator sees which opponent is associated
    try:
        logging.getLogger(__name__).info('restored game %s from index, opponent=%s, player_bot_id=%s', game_id, game_entry.get('opponent'), game_entry.get('player_bot_id'))
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
ACTION_RE = re.compile(r'^(MOVE\s+-?\d+\s+-?\d+(?:\s+-?\d+)?)$', re.IGNORECASE)

def validate_action_format(raw_output: str, normalized_action: str):
    # Check if bot produced no output
    if not raw_output or not raw_output.strip():
        return normalized_action, 'no output from bot'
    first_line = ''
    for ln in raw_output.splitlines():
        if ln and ln.strip():
            first_line = ln.strip()
            break
    if not first_line:
        return normalized_action, 'no valid output from bot'
    if ACTION_RE.match(first_line):
        return normalized_action, ''
    return normalized_action, f'invalid action format: "{first_line}"'


# Run a bot for a role using BotRunner (file or inline code)
def _run_bot_for_role(game: dict, ref: Referee, role: str, bot_cli_input: str, initial_map_block: str, timeout_ms: int, memory_mb: int, cpus: float):
    bot_code = None
    bot_path = None
    is_arena_match = game.get('is_arena_match', False)
    mode = game.get('mode', 'player-vs-bot')
    
    # Bot-vs-bot mode: map player/opponent roles to bot1/bot2
    if mode == 'bot-vs-bot':
        bot_setting = game.get('bot1') if role == 'player' else game.get('bot2')
        try:
            bot_id = int(bot_setting)
            from models import Bot
            bot = Bot.query.get(bot_id)
            if bot:
                if is_arena_match and bot.latest_version_number > 0:
                    active_version = bot.get_active_version()
                    if active_version:
                        bot_code = active_version.code
                        bot_path = f'db:bot:{bot_id}:v{active_version.version_number}'
                        logging.getLogger(__name__).info(f'Using bot from Arena ({role}): id=%s, name=%s, version=%s', 
                                                        bot_id, bot.name, active_version.version_name)
                    else:
                        bot_code = bot.code
                        bot_path = f'db:bot:{bot_id}'
                else:
                    bot_code = bot.code
                    bot_path = f'db:bot:{bot_id}:draft'
                    logging.getLogger(__name__).info(f'Using bot draft ({role}): id=%s, name=%s', bot_id, bot.name)
        except (ValueError, TypeError):
            # Fallback to Boss or other default
            if bot_setting == 'Boss' or not bot_setting:
                bot_path = 'bots/Boss.py'
                if os.path.exists(bot_path):
                    try:
                        with open(bot_path, 'r', encoding='utf-8') as f:
                            bot_code = f.read()
                    except Exception:
                        pass
        
        if not bot_code:
            bot_code = 'print("STAY")'
        
    elif role == 'player':
        # Check if player is specified by bot ID (Arena match)
        player_bot_id = game.get('player_bot_id')
        if player_bot_id:
            from models import Bot
            bot = Bot.query.get(player_bot_id)
            if bot:
                if is_arena_match and bot.latest_version_number > 0:
                    # Use Arena version for player
                    active_version = bot.get_active_version()
                    if active_version:
                        bot_code = active_version.code
                        bot_path = f'db:bot:{player_bot_id}:v{active_version.version_number}'
                        logging.getLogger(__name__).info('Using player bot from Arena: id=%s, name=%s, version=%s', 
                                                        player_bot_id, bot.name, active_version.version_name)
                    else:
                        bot_code = bot.code
                        bot_path = f'db:bot:{player_bot_id}'
                        logging.getLogger(__name__).warning('Player bot %s has no Arena version, using draft code', player_bot_id)
                else:
                    # Use current working draft (Playground)
                    bot_code = bot.code
                    bot_path = f'db:bot:{player_bot_id}:draft'
                    logging.getLogger(__name__).info('Using player bot draft from Playground: id=%s, name=%s', player_bot_id, bot.name)
        
        # Fallback to legacy player_bot_path or player_code
        if not bot_code:
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
        # Check if opponent is a bot ID (integer or string digit)
        try:
            bot_id = int(opp_setting)
            from models import Bot
            bot = Bot.query.get(bot_id)
            if bot:
                # For Arena matches, use the latest submitted version
                # For Playground testing, use current working code
                if is_arena_match and bot.latest_version_number > 0:
                    # Use Arena version
                    active_version = bot.get_active_version()
                    if active_version:
                        bot_code = active_version.code
                        bot_path = f'db:bot:{bot_id}:v{active_version.version_number}'
                        logging.getLogger(__name__).info('Using bot from Arena: id=%s, name=%s, version=%s', 
                                                        bot_id, bot.name, active_version.version_name)
                    else:
                        bot_code = bot.code
                        bot_path = f'db:bot:{bot_id}'
                        logging.getLogger(__name__).warning('Bot %s has no Arena version, using draft code', bot_id)
                else:
                    # Use current working draft (Playground)
                    bot_code = bot.code
                    bot_path = f'db:bot:{bot_id}:draft'
                    logging.getLogger(__name__).info('Using bot draft from Playground: id=%s, name=%s', bot_id, bot.name)
        except (ValueError, TypeError):
            # Not a bot ID, check if it's a file path
            if opp_setting and os.path.exists(opp_setting):
                bot_path = opp_setting
                try:
                    with open(bot_path, 'r', encoding='utf-8') as f:
                        bot_code = f.read()
                except Exception:
                    bot_code = None
            else:
                # Default opponent (Boss)
                default_opp = os.path.join('bots', 'Boss.py')
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
                logging.getLogger(__name__).debug('game %s role=%s: running parsed init with map block length=%d', game.get('id'), role, len(initial_map_block or ''))
                out_init, err_init, rc_init = run_parsed_init(parsed, initial_map_block or '', timeout_ms=max(2000, timeout_ms))
                # Check if init succeeded
                if rc_init != 0:
                    logging.getLogger(__name__).warning('game %s role=%s: parsed init failed (rc=%d, stderr=%s)', game.get('id'), role, rc_init, err_init)
                    parsed_entry = None
                else:
                    # store parsed object and its init outputs for subsequent turns
                    parsed_store[role] = {'parsed': parsed, 'init_stdout': out_init or '', 'init_stderr': err_init or ''}
                    parsed_entry = parsed_store[role]
                    logging.getLogger(__name__).debug('game %s role=%s: parsed init succeeded', game.get('id'), role)
            except Exception as e:
                logging.getLogger(__name__).exception('game %s role=%s: exception during parsed init', game.get('id'), role)
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
                # Treat invalid actions as fatal errors
                if fmt_err:
                    try:
                        ref.on_bot_timeout(role, ref.turn, fmt_err)
                    except Exception:
                        pass
                    logging.getLogger(__name__).warning('game %s role=%s: invalid action detected (path=%s) error=%s', game.get('id'), role, bot_path, fmt_err)
                    return 'STAY', {'stdout': out or '', 'stderr': fmt_err, 'rc': -1, 'runner': runner_used, 'parsed': True, 'path': bot_path}
                stderr_field = (err or '') + (('; ' + fmt_err) if fmt_err else '')
                # include init stderr if present (helps debug init failures)
                if isinstance(parsed_entry, dict):
                    if parsed_entry.get('init_stderr'):
                        stderr_field = (parsed_entry.get('init_stderr') or '') + (('; ' + stderr_field) if stderr_field else '')
                # logging.getLogger(__name__).info('game %s role=%s: executed parsed bot (path=%s) runner=%s', game.get('id'), role, bot_path, runner_used)
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
        # Treat invalid actions as fatal errors
        if fmt_err:
            try:
                ref.on_bot_timeout(role, ref.turn, fmt_err)
            except Exception:
                pass
            logging.getLogger(__name__).warning('game %s role=%s: invalid action detected (path=%s) error=%s', game.get('id'), role, bot_path, fmt_err)
            return 'STAY', {'stdout': out or '', 'stderr': fmt_err, 'rc': -1, 'runner': runner_used, 'path': bot_path}
        stderr_field = (err or '') + (('; ' + fmt_err) if fmt_err else '')
        logging.getLogger(__name__).info('game %s role=%s: executed runner bot (path=%s) runner=%s', game.get('id'), role, bot_path, runner_used)
        return action, {'stdout': out, 'stderr': stderr_field, 'rc': rc, 'runner': runner_used, 'path': bot_path}
    except Exception as e:
        logging.getLogger(__name__).exception('game %s role=%s: unexpected error executing bot at path=%s', game.get('id'), role, bot_path)
        return 'STAY', {'stdout': '', 'stderr': str(e), 'rc': -1, 'runner': 'runner', 'path': bot_path}


# -------------------- HTTP endpoints --------------------

@app.route('/')
def index():
    ip = request.headers.get('X-Forwarded-For', request.remote_addr)
    ua_string = request.headers.get('User-Agent', '')
    os = 'Unknown'
    browser = 'Unknown'
    if 'Windows' in ua_string:
        os = 'Windows'
    elif 'Mac' in ua_string or 'Darwin' in ua_string:
        os = 'macOS'
    elif 'Linux' in ua_string:
        os = 'Linux'
    if 'Chrome' in ua_string:
        browser = 'Chrome'
    elif 'Firefox' in ua_string:
        browser = 'Firefox'
    elif 'Safari' in ua_string:
        browser = 'Safari'
    date = dt.datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    logging.getLogger(__name__).info('Client connected: IP=%s, OS=%s, Browser=%s, Date=%s', ip, os, browser, date)
    return send_from_directory('static', 'index.html')


@app.route('/api/referees')
def list_referees():
    ip = request.headers.get('X-Forwarded-For', request.remote_addr)
    ua_string = request.headers.get('User-Agent', '')
    os = 'Unknown'
    browser = 'Unknown'
    if 'Windows' in ua_string:
        os = 'Windows'
    elif 'Mac' in ua_string or 'Darwin' in ua_string:
        os = 'macOS'
    elif 'Linux' in ua_string:
        os = 'Linux'
    if 'Chrome' in ua_string:
        browser = 'Chrome'
    elif 'Firefox' in ua_string:
        browser = 'Firefox'
    elif 'Safari' in ua_string:
        browser = 'Safari'
    date = dt.datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    logging.getLogger(__name__).info('Client connected: IP=%s, OS=%s, Browser=%s, Date=%s', ip, os, browser, date)
    data = {}
    for name, maker in REFEREES.items():
        ref = maker()
        data[name] = ref.get_protocol()
    return jsonify(data)


@app.route('/api/template')
@app.route('/api/player/template')
def get_player_template():
    try:
        tpl_path = os.path.join('bots', 'player_template.py')
        with open(tpl_path, 'r', encoding='utf-8') as f:
            src = f.read()
        return jsonify({'template': src})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# Old /api/player/code endpoint removed - bot code now stored in database only


@app.route('/api/games', methods=['POST'])
def create_game():
    """Crée une nouvelle partie.
    
    API Layer: Validation des inputs et délégation au GameService.
    Responsabilité: HTTP handling uniquement (SRP).
    """
    body = request.json or {}
    
    # Extraction et validation des paramètres
    referee_name = body.get('referee', 'pacman')
    mode = body.get('mode', 'player-vs-bot')
    bot_runner = body.get('bot_runner')
    
    try:
        # Délégation à la couche service (SRP + DIP)
        if mode == 'bot-vs-bot':
            result = game_service.create_game(
                referee_name=referee_name,
                mode='bot-vs-bot',
                bot1=body.get('bot1', 'Boss'),
                bot2=body.get('bot2', 'Boss'),
                bot_runner=bot_runner
            )
        else:
            result = game_service.create_game(
                referee_name=referee_name,
                mode='player-vs-bot',
                player_code=body.get('player_code'),
                opponent=body.get('opponent', 'Boss'),
                player_bot_id=body.get('player_bot_id'),
                bot_runner=bot_runner
            )
        
        # Sync avec le store legacy (transition progressive)
        game_id = result['game_id']
        game_entry = game_service.get_game(game_id)
        if game_entry:
            GAMES[game_id] = game_entry
        
        return jsonify(result), 200
        
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        logging.getLogger(__name__).exception('Failed to create game')
        return jsonify({'error': 'Internal server error'}), 500


@app.route('/api/games/<game_id>', methods=['GET'])
def get_game_info(game_id):
    """Récupère les informations d'une partie.
    
    API Layer: Validation et délégation au GameService.
    """
    try:
        # Essai avec le store legacy d'abord (transition)
        g = GAMES.get(game_id)
        if not g:
            g = game_service.get_game(game_id)
        if not g:
            g = restore_game_from_index(game_id)
        
        if not g:
            return jsonify({'error': 'Game not found'}), 404
        
        info = {
            'id': g.get('id'),
            'player_bot_id': g.get('player_bot_id'),
            'opponent': g.get('opponent')
        }
        return jsonify({'game': info}), 200
        
    except Exception as e:
        logging.getLogger(__name__).exception('Failed to get game info')
        return jsonify({'error': 'Internal server error'}), 500


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
        # try:
        #     # Use info level so the opponent name is visible in normal Flask logs
        #     logging.getLogger(__name__).info('game %s: opponent=%s', game_id, game.get('opponent'))
        # except Exception:
        #     pass

        try:
            action_opp, opponent_log = _run_bot_for_role(game, ref, 'opponent', opponent_input, initial_map_block, timeout_ms, memory_mb, cpus)
        except Exception as e:
            logging.getLogger(__name__).exception('error running opponent bot for game %s', game.get('id'))
            action_opp, opponent_log = 'STAY', {'stdout': '', 'stderr': str(e), 'rc': -1, 'runner': 'exception'}
        actions['opponent'] = action_opp or 'STAY'

        state, stdout, stderr = ref.step(actions)
        entry = ref.history[-1]
        entry['bot_logs'] = {'player': player_log, 'opponent': opponent_log}
        entry['__global_stdout'] = stdout
        entry['__global_stderr'] = stderr

        return jsonify({'state': state, 'history_entry': entry})

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


# ==================== AUTHENTICATION ENDPOINTS ====================

@app.route('/api/auth/register', methods=['POST'])
def api_register():
    """Register a new user."""
    data = request.get_json()
    username = data.get('username')
    email = data.get('email')
    password = data.get('password')
    
    user_dict, error = register_user(username, email, password)
    if error:
        return jsonify({'error': error}), 400
    
    return jsonify({'user': user_dict, 'message': 'User registered successfully'}), 201


@app.route('/api/auth/login', methods=['POST'])
def api_login():
    """Login and get JWT tokens."""
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    
    result, error = login_user(username, password)
    if error:
        return jsonify({'error': error}), 401
    
    return jsonify(result), 200


@app.route('/api/auth/debug', methods=['GET'])
def api_debug_auth():
    """Debug endpoint to check authentication headers."""
    headers = dict(request.headers)
    auth_header = request.headers.get('Authorization', 'NOT_FOUND')
    return jsonify({
        'authorization_header': auth_header,
        'all_headers': headers
    }), 200


@app.route('/api/auth/me', methods=['GET'])
@jwt_required()
def api_get_current_user():
    """Get current user info from JWT token."""
    user = get_current_user()
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    return jsonify({'user': user.to_dict()}), 200


@app.route('/api/user/profile', methods=['GET'])
@jwt_required()
def api_get_user_profile():
    """Get current user's profile information."""
    user = get_current_user()
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    return jsonify({'user': user.to_dict()}), 200


@app.route('/api/user/avatar', methods=['GET'])
@jwt_required()
def api_get_user_avatar():
    """Get current user's avatar."""
    user = get_current_user()
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    return jsonify({'avatar': user.avatar or 'my_bot'}), 200


@app.route('/api/user/avatar', methods=['POST'])
@jwt_required()
def api_set_user_avatar():
    """Set current user's avatar."""
    user = get_current_user()
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    data = request.get_json()
    avatar = data.get('avatar')
    
    if not avatar:
        return jsonify({'error': 'Avatar is required'}), 400
    
    # Validate avatar (optional - list of allowed avatars)
    allowed_avatars = ['my_bot', 'boss', 'ninja', 'warrior', 'wizard', 'knight', 'archer', 'alien']
    if not avatar.startswith('custom_') and avatar not in allowed_avatars:
        return jsonify({'error': 'Invalid avatar'}), 400
    
    user.avatar = avatar
    db.session.commit()
    
    return jsonify({'success': True, 'avatar': user.avatar}), 200


@app.route('/api/user/avatar/upload', methods=['POST'])
@jwt_required()
def api_upload_avatar():
    """Upload a custom avatar image."""
    user = get_current_user()
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    # Check if file is present
    if 'avatar' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    
    file = request.files['avatar']
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    
    # Validate file type
    if not file.content_type or not file.content_type.startswith('image/'):
        return jsonify({'error': 'File must be an image'}), 400
    
    # Get file extension
    filename = secure_filename(file.filename)
    ext = os.path.splitext(filename)[1].lower()
    if ext not in ['.png', '.jpg', '.jpeg', '.gif', '.svg']:
        return jsonify({'error': 'Invalid image format'}), 400
    
    # Create avatars directory if it doesn't exist
    avatars_dir = os.path.join(app.instance_path, 'avatars')
    os.makedirs(avatars_dir, exist_ok=True)
    
    # Save file with user ID as name
    avatar_filename = f'{user.id}{ext}'
    filepath = os.path.join(avatars_dir, avatar_filename)
    
    # Delete old custom avatar if exists
    for old_ext in ['.png', '.jpg', '.jpeg', '.gif', '.svg']:
        old_path = os.path.join(avatars_dir, f'{user.id}{old_ext}')
        if os.path.exists(old_path):
            try:
                os.remove(old_path)
            except Exception as e:
                app.logger.warning(f"Failed to delete old avatar: {e}")
    
    # Save new file
    try:
        file.save(filepath)
    except Exception as e:
        app.logger.error(f"Failed to save avatar: {e}")
        return jsonify({'error': 'Failed to save file'}), 500
    
    # Update user avatar reference
    avatar_id = f'custom_{user.id}'
    user.avatar = avatar_id
    db.session.commit()
    
    return jsonify({'success': True, 'avatar': avatar_id}), 200


@app.route('/api/user/avatar/image', methods=['GET'])
@jwt_required()
def api_get_avatar_image():
    """Serve custom avatar image for current user."""
    user = get_current_user()
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    # Check if user has custom avatar
    if not user.avatar or not user.avatar.startswith('custom_'):
        return jsonify({'error': 'No custom avatar'}), 404
    
    # Find the avatar file
    avatars_dir = os.path.join(app.instance_path, 'avatars')
    
    for ext in ['.png', '.jpg', '.jpeg', '.gif', '.svg']:
        filepath = os.path.join(avatars_dir, f'{user.id}{ext}')
        if os.path.exists(filepath):
            # Determine mimetype
            mimetype = 'image/svg+xml' if ext == '.svg' else f'image/{ext[1:]}'
            return send_file(filepath, mimetype=mimetype)
    
    return jsonify({'error': 'Avatar file not found'}), 404


@app.route('/api/user/<int:user_id>/avatar/image', methods=['GET'])
@jwt_required()
def api_get_user_avatar_image(user_id):
    """Serve custom avatar image for a specific user (for displaying bot owner avatars)."""
    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    # Check if user has custom avatar
    if not user.avatar or not user.avatar.startswith('custom_'):
        return jsonify({'error': 'No custom avatar'}), 404
    
    # Find the avatar file
    avatars_dir = os.path.join(app.instance_path, 'avatars')
    
    for ext in ['.png', '.jpg', '.jpeg', '.gif', '.svg']:
        filepath = os.path.join(avatars_dir, f'{user.id}{ext}')
        if os.path.exists(filepath):
            # Determine mimetype
            mimetype = 'image/svg+xml' if ext == '.svg' else f'image/{ext[1:]}'
            return send_file(filepath, mimetype=mimetype)
    
    return jsonify({'error': 'Avatar file not found'}), 404


# ==================== BOT/ARENA ENDPOINTS ====================

@app.route('/api/bots', methods=['GET'])
@jwt_required(optional=True)
def api_get_bots():
    """Get bots - if authenticated, return user's bots; if 'all' param, return all active bots."""
    # Check if requesting all bots (for opponent selection)
    get_all = request.args.get('all', 'false').lower() == 'true'
    
    if get_all:
        # Return all active bots from all users for opponent selection
        bots = arena_manager.get_all_active_bots()
        return jsonify({'bots': bots}), 200
    
    # Return user's own bots (requires authentication)
    user = get_current_user()
    if not user:
        return jsonify({'error': 'Authentication required'}), 401
    
    bots = arena_manager.get_user_bots(user.id)
    return jsonify({'bots': bots}), 200


@app.route('/api/bots/my', methods=['GET'])
@jwt_required()
def api_get_my_bots():
    """Get all bots owned by current user (including drafts and inactive)."""
    user = get_current_user()
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    # Return ALL user bots (including inactive ones for Playground)
    bots = Bot.query.filter_by(user_id=user.id).all()
    return jsonify([{
        'id': b.id,
        'name': b.name,
        'code': b.code,
        'latest_version_number': b.latest_version_number,
        'elo': b.elo_rating,
        'created_at': b.created_at.isoformat() if b.created_at else None
    } for b in bots]), 200


@app.route('/api/bots', methods=['POST'])
@jwt_required()
def api_create_bot():
    """Create a new bot (Playground)."""
    user = get_current_user()
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    data = request.get_json()
    name = data.get('name')
    code = data.get('code', '')
    
    bot_dict, error = arena_manager.create_bot(user.id, name, code)
    if error:
        return jsonify({'error': error}), 400
    
    return jsonify({'bot': bot_dict, 'message': 'Bot created successfully'}), 201


@app.route('/api/bots/<int:bot_id>/save', methods=['PUT'])
@jwt_required()
def api_save_bot_code(bot_id):
    """Save bot code (Playground only - does NOT create version)."""
    user = get_current_user()
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    data = request.get_json()
    code = data.get('code')
    
    if not code:
        return jsonify({'error': 'Code is required'}), 400
    
    bot_dict, error = arena_manager.save_bot_code(user.id, bot_id, code)
    if error:
        return jsonify({'error': error}), 400
    
    return jsonify({'bot': bot_dict, 'message': 'Bot code saved'}), 200


def _execute_arena_match(game_id, player_bot_id, opponent_bot_id):
    """Execute a complete arena match and update ELO ratings.
    
    Args:
        game_id: Unique game ID
        player_bot_id: ID of the first bot
        opponent_bot_id: ID of the second bot
    
    Returns:
        dict: Match result with winner, scores, and turns
    """
    try:
        # Create game entry
        maker = REFEREES.get('pacman')
        if not maker:
            return {'error': 'Referee not found'}
        
        ref = maker()
        ref.init_game({})
        
        # Get initial map from referee (use referee attributes directly)
        width = getattr(ref, 'width', 0)
        height = getattr(ref, 'height', 0)
        # Generate simple map rows (grid is initialized by init_game)
        grid = getattr(ref, 'grid', [])
        if grid and width > 0 and height > 0:
            rows = [''.join(row) for row in grid]
            initial_map_block = f"{width} {height}\n" + '\n'.join(rows) + '\n'
        else:
            initial_map_block = ''
        
        game_entry = {
            'id': game_id,
            'ref': ref,
            'player_bot_id': player_bot_id,
            'opponent': str(opponent_bot_id),
            'is_arena_match': True,  # Use Arena versions
            'bot_runner': 'auto',
            'initial_map_block': initial_map_block,
            'history': ref.history
        }
        
        GAMES[game_id] = game_entry
        
        # Run game until completion
        max_turns = 200
        turn_count = 0
        
        while not ref.is_finished() and turn_count < max_turns:
            try:
                # Execute one turn
                _execute_game_turn(game_entry, ref)
                turn_count += 1
            except Exception as e:
                logging.getLogger(__name__).exception(f"Error in arena match turn {turn_count}")
                break
        
        # Determine winner
        state = ref.get_state()
        scores = state.get('scores', {})
        player_score = scores.get('player', 0)
        opponent_score = scores.get('opponent', 0)
        
        if player_score > opponent_score:
            winner = 'player'
        elif opponent_score > player_score:
            winner = 'opponent'
        else:
            winner = 'draw'
        
        # Update match in database
        match = Match.query.filter_by(game_id=game_id).first()
        if match:
            arena_manager.complete_match(
                match.id,
                winner=winner,
                player_score=player_score,
                opponent_score=opponent_score,
                turns=turn_count
            )
        
        return {
            'winner': winner,
            'player_score': player_score,
            'opponent_score': opponent_score,
            'turns': turn_count
        }
    except Exception as e:
        logging.getLogger(__name__).exception(f"Error executing arena match {game_id}")
        return {'error': str(e)}


def _execute_game_turn(game_entry, ref):
    """Execute a single turn of the game (extracted from step_game endpoint)."""
    timeout_ms = ref.get_protocol().get('constraints', {}).get('time_ms', 50)
    memory_mb = ref.get_protocol().get('constraints', {}).get('memory_mb', 64)
    cpus = ref.get_protocol().get('constraints', {}).get('cpus', 0.5)
    
    initial_map_block = game_entry.get('initial_map_block') or ''
    
    # Log turn number and state before actions
    state_before = ref.get_state()
    turn_num = state_before.get('turn', 0)
    scores_before = state_before.get('scores', {})
    pellets_before = state_before.get('pellets', [])
    # logging.getLogger(__name__).info(f"Turn {turn_num}: scores={scores_before}, pellets_count={len(pellets_before)}")
    
    # Run player bot
    player_input = ref.make_bot_input('player')
    player_action, player_meta = _run_bot_for_role(
        game_entry, ref, 'player', player_input, initial_map_block,
        timeout_ms, memory_mb, cpus
    )
    
    # Run opponent bot  
    opp_input = ref.make_bot_input('opponent')
    opp_action, opp_meta = _run_bot_for_role(
        game_entry, ref, 'opponent', opp_input, initial_map_block,
        timeout_ms, memory_mb, cpus
    )
    
    # Log actions received
    #logging.getLogger(__name__).info(f"Turn {turn_num}: player_action='{player_action}', opponent_action='{opp_action}'")
    
    # Apply actions (step expects a dict)
    actions_by_bot = {
        'player': player_action,
        'opponent': opp_action
    }
    ref.step(actions_by_bot)
    
    # Log state after step
    state_after = ref.get_state()
    scores_after = state_after.get('scores', {})
    pellets_after = state_after.get('pellets', [])
    # logging.getLogger(__name__).info(f"Turn {turn_num}: after step: scores={scores_after}, pellets_count={len(pellets_after)}")


@app.route('/api/bots/<int:bot_id>/submit-to-arena', methods=['POST'])
@jwt_required()
def api_submit_bot_to_arena(bot_id):
    """Submit bot to Arena (creates BotVersion) and run placement matches."""
    user = get_current_user()
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    data = request.get_json() or {}
    version_name = data.get('version_name')
    description = data.get('description', '')
    
    version_dict, error = arena_manager.submit_bot_to_arena(
        user.id, bot_id, version_name, description
    )
    if error:
        return jsonify({'error': error}), 400
    
    # Run placement matches synchronously
    # Get all other active arena bots
    opponents = Bot.query.filter(
        Bot.id != bot_id,
        Bot.is_active == True,
        Bot.latest_version_number > 0
    ).all()
    
    placement_results = []
    for opponent in opponents:
        try:
            # Create and run a match
            game_id = str(uuid.uuid4())
            match = arena_manager.create_match(bot_id, opponent.id, game_id)
            if not match:
                continue
            
            # Execute the game
            result = _execute_arena_match(game_id, bot_id, opponent.id)
            placement_results.append({
                'opponent': opponent.name,
                'result': result.get('winner') if result else 'error'
            })
        except Exception as e:
            logging.getLogger(__name__).exception(f"Error in placement match vs {opponent.name}")
    
    return jsonify({
        'version': version_dict,
        'message': f"Bot submitted to Arena as version {version_dict['version_name']}",
        'placement_matches': len(placement_results),
        'results': placement_results
    }), 201


@app.route('/api/bots/<int:bot_id>', methods=['GET'])
@jwt_required()
def api_get_bot(bot_id):
    """Get a specific bot."""
    user = get_current_user()
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    bot = arena_manager.get_bot(bot_id)
    if not bot:
        return jsonify({'error': 'Bot not found'}), 404
    
    # Include code only if user owns the bot
    include_code = (bot['user_id'] == user.id)
    if include_code:
        bot = arena_manager.get_bot(bot_id, include_code=True)
    
    return jsonify({'bot': bot}), 200


@app.route('/api/bots/<int:bot_id>/deactivate', methods=['POST'])
@jwt_required()
def api_deactivate_bot(bot_id):
    """Deactivate a bot."""
    user = get_current_user()
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    bot_dict, error = arena_manager.deactivate_bot(bot_id, user.id)
    if error:
        return jsonify({'error': error}), 403
    
    return jsonify({'bot': bot_dict, 'message': 'Bot deactivated'}), 200


@app.route('/api/bots/<int:bot_id>/versions', methods=['GET'])
@jwt_required()
def api_get_bot_versions(bot_id):
    """Get all versions of a bot."""
    from models import Bot, BotVersion
    user = get_current_user()
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    bot = Bot.query.get(bot_id)
    if not bot:
        return jsonify({'error': 'Bot not found'}), 404
    
    # Only bot owner can see versions
    if bot.user_id != user.id:
        return jsonify({'error': 'Unauthorized'}), 403
    
    versions = BotVersion.query.filter_by(bot_id=bot_id).order_by(BotVersion.version_number.desc()).all()
    return jsonify({'versions': [v.to_dict(include_code=True) for v in versions]}), 200


@app.route('/api/bots/<int:bot_id>/versions/<int:version_number>', methods=['GET'])
@jwt_required()
def api_get_bot_version(bot_id, version_number):
    """Get a specific version of a bot."""
    from models import Bot, BotVersion
    user = get_current_user()
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    bot = Bot.query.get(bot_id)
    if not bot:
        return jsonify({'error': 'Bot not found'}), 404
    
    # Only bot owner can see versions
    if bot.user_id != user.id:
        return jsonify({'error': 'Unauthorized'}), 403
    
    version = BotVersion.query.filter_by(bot_id=bot_id, version_number=version_number).first()
    if not version:
        return jsonify({'error': 'Version not found'}), 404
    
    return jsonify({'version': version.to_dict(include_code=True)}), 200


@app.route('/api/bots/<int:bot_id>/rollback/<int:version_number>', methods=['POST'])
@jwt_required()
def api_rollback_bot_version(bot_id, version_number):
    """Rollback bot to a specific version."""
    from models import Bot, BotVersion
    user = get_current_user()
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    bot = Bot.query.get(bot_id)
    if not bot:
        return jsonify({'error': 'Bot not found'}), 404
    
    # Only bot owner can rollback
    if bot.user_id != user.id:
        return jsonify({'error': 'Unauthorized'}), 403
    
    # Get the target version
    target_version = BotVersion.query.filter_by(bot_id=bot_id, version_number=version_number).first()
    if not target_version:
        return jsonify({'error': 'Version not found'}), 404
    
    # Create a new version with the old code
    new_version = bot.create_version(target_version.code, f'Rollback to version {version_number}')
    db.session.commit()
    
    return jsonify({
        'bot': bot.to_dict(include_code=True),
        'version': new_version.to_dict(include_code=True),
        'message': f'Rolled back to version {version_number}'
    }), 200


@app.route('/api/bots/<int:bot_id>/load-version/<int:version_number>', methods=['POST'])
@jwt_required()
def api_load_bot_version_to_playground(bot_id, version_number):
    """Load a specific version into Playground (updates bot.code without creating new version)."""
    from models import Bot, BotVersion
    user = get_current_user()
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    bot = Bot.query.get(bot_id)
    if not bot:
        return jsonify({'error': 'Bot not found'}), 404
    
    # Only bot owner can load versions
    if bot.user_id != user.id:
        return jsonify({'error': 'Unauthorized'}), 403
    
    # Get the target version
    target_version = BotVersion.query.filter_by(bot_id=bot_id, version_number=version_number).first()
    if not target_version:
        return jsonify({'error': 'Version not found'}), 404
    
    # Update bot's current code (Playground draft)
    bot.code = target_version.code
    bot.updated_at = dt.datetime.utcnow()
    db.session.commit()
    
    return jsonify({
        'bot': bot.to_dict(include_code=True),
        'message': f'Version {version_number} loaded into Playground',
        'version_loaded': target_version.to_dict(include_code=False)
    }), 200


@app.route('/api/arena/challenge', methods=['POST'])
@jwt_required()
def api_challenge_bot():
    """Challenge another bot to a match."""
    user = get_current_user()
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    data = request.get_json()
    my_bot_id = data.get('my_bot_id')
    opponent_bot_id = data.get('opponent_bot_id')
    
    if not my_bot_id:
        return jsonify({'error': 'my_bot_id is required'}), 400
    
    # Get bots
    my_bot = Bot.query.get(my_bot_id)
    if not my_bot or my_bot.user_id != user.id:
        return jsonify({'error': 'Bot not found or you don\'t own it'}), 403
    
    # Find opponent if not specified
    if not opponent_bot_id:
        opponent_bot = arena_manager.find_opponent(my_bot_id)
        if not opponent_bot:
            return jsonify({'error': 'No suitable opponent found'}), 404
        opponent_bot_id = opponent_bot.id
    else:
        opponent_bot = Bot.query.get(opponent_bot_id)
        if not opponent_bot:
            return jsonify({'error': 'Opponent bot not found'}), 404
    
    # Create game using existing game creation logic
    game_id = str(uuid.uuid4())
    referee = PacmanReferee()
    referee.init_game({})
    
    game_entry = {
        'game_id': game_id,
        'referee': 'pacman',
        'referee_obj': referee,
        'player_code': my_bot.code,
        'opponent_code': opponent_bot.code,
        'player_bot_id': my_bot_id,
        'opponent_bot_id': opponent_bot_id,
        'is_arena_match': True
    }
    GAMES[game_id] = game_entry
    
    # Create match record
    match = arena_manager.create_match(my_bot_id, opponent_bot_id, game_id)
    if not match:
        return jsonify({'error': 'Failed to create match'}), 500
    
    save_games_index_entry(game_id, {
        'referee': 'pacman',
        'player_bot_id': my_bot_id,
        'opponent_bot_id': opponent_bot_id,
        'match_id': match.id
    })
    
    return jsonify({
        'game_id': game_id,
        'match_id': match.id,
        'message': 'Match created successfully'
    }), 201


@app.route('/api/arena/leaderboard', methods=['GET'])
def api_get_leaderboard():
    """Get the leaderboard (public endpoint)."""
    limit = request.args.get('limit', 50, type=int)
    leaderboard = arena_manager.get_leaderboard(limit=min(limit, 100))
    return jsonify({'leaderboard': leaderboard}), 200


@app.route('/api/arena/matches', methods=['GET'])
@jwt_required()
def api_get_match_history():
    """Get match history for the current user."""
    user = get_current_user()
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    limit = request.args.get('limit', 20, type=int)
    matches = arena_manager.get_match_history(user_id=user.id, limit=min(limit, 100))
    return jsonify({'matches': matches}), 200


@app.route('/api/arena/matches/<int:match_id>', methods=['GET'])
def api_get_match(match_id):
    """Get details of a specific match (public endpoint)."""
    match = Match.query.get(match_id)
    if not match:
        return jsonify({'error': 'Match not found'}), 404
    
    return jsonify({'match': match.to_dict()}), 200


# Modify the existing step endpoint to complete arena matches
_original_step = None

def _wrap_step_for_arena():
    """Wrap the step endpoint to detect and complete arena matches."""
    global _original_step
    
    # Find the step function
    for rule in app.url_map.iter_rules():
        if rule.endpoint == 'step_game':
            _original_step = app.view_functions[rule.endpoint]
            break
    
    if not _original_step:
        return
    
    def wrapped_step_game(game_id):
        # Call original step
        response = _original_step(game_id)
        
        # Check if this is an arena match and if it's finished
        game_entry = GAMES.get(game_id)
        if game_entry and game_entry.get('is_arena_match'):
            referee = game_entry.get('referee_obj')
            if referee and referee.is_finished():
                # Get match record
                idx = load_games_index()
                meta = idx.get(game_id, {})
                match_id = meta.get('match_id')
                
                if match_id:
                    state = referee.get_state()
                    winner = state.get('winner')
                    player_score = state.get('scores', {}).get('player', 0)
                    opponent_score = state.get('scores', {}).get('opponent', 0)
                    turns = state.get('turn', 0)
                    
                    arena_manager.complete_match(
                        match_id,
                        winner,
                        player_score,
                        opponent_score,
                        turns
                    )
        
        return response
    
    # Replace the endpoint
    for rule in app.url_map.iter_rules():
        if rule.endpoint == 'step_game':
            app.view_functions[rule.endpoint] = wrapped_step_game
            break

# Apply the wrapper after app initialization
_wrap_step_for_arena()


if __name__ == '__main__':
    logging.basicConfig(level=logging.DEBUG)
    app.run(host='127.0.0.1', port=3000, debug=True)
