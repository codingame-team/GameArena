"""Flask backend for bot arena prototype.
Provides endpoints to list referees, start a game, step through turns and fetch game history.
"""
from flask import Flask, jsonify, request, send_from_directory
from referees.pacman_referee import make_referee
from game_sdk import Referee
import uuid
import subprocess
import shlex
import threading
import time
import json

app = Flask(__name__, static_folder='static', static_url_path='/static')

# in-memory games store
GAMES = {}
REFEREES = {
    'pacman': make_referee
}

# Simple helper to run a bot (python) with timeout. Bot receives input on stdin and must write a single-line action to stdout.
def run_bot_python(bot_code: str, input_str: str, timeout_ms: int = 50):
    # We run python in a subprocess with -c to execute the bot code. The bot code should read stdin and print action.
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

@app.route('/')
def index():
    return send_from_directory('static', 'index.html')

@app.route('/api/referees')
def list_referees():
    # list available referees and their protocol
    data = {}
    for name, maker in REFEREES.items():
        ref = maker()
        data[name] = ref.get_protocol()
    return jsonify(data)

@app.route('/api/games', methods=['POST'])
def create_game():
    body = request.json or {}
    referee_name = body.get('referee', 'pacman')
    player_code = body.get('player_code', None)
    opponent = body.get('opponent', 'league_bot')
    maker = REFEREES.get(referee_name)
    if not maker:
        return jsonify({'error':'unknown referee'}), 400
    ref = maker()
    ref.init_game({})
    game_id = str(uuid.uuid4())
    GAMES[game_id] = {
        'id': game_id,
        'ref': ref,
        'player_code': player_code,
        'opponent': opponent,
        'history': ref.history
    }
    return jsonify({'game_id': game_id})

@app.route('/api/games/<game_id>/step', methods=['POST'])
def step_game(game_id):
    game = GAMES.get(game_id)
    if not game:
        return jsonify({'error':'not found'}), 404
    ref: Referee = game['ref']
    if ref.is_finished():
        return jsonify({'finished': True, 'state': ref.get_state(), 'history': ref.history})
    # prepare actions for both bots
    actions = {}
    # player
    player_input = ref.make_bot_input('player')
    player_code = game.get('player_code')
    if player_code:
        out, err, rc = run_bot_python(player_code, player_input, timeout_ms=ref.get_protocol().get('constraints',{}).get('time_ms',50))
        action = ref.parse_bot_output('player', out)
        actions['player'] = action
        # capture logs
        player_log = {'stdout': out, 'stderr': err, 'rc': rc}
    else:
        # default simple bot: greedy towards nearest pellet
        # naive: move +1 x or -1 x toward nearest
        px,py = ref.pacs['player']
        if ref.pellets:
            nearest = min(ref.pellets, key=lambda p: abs(p[0]-px)+abs(p[1]-py))
            dx = 0 if nearest[0]==px else (1 if nearest[0]>px else -1)
            dy = 0 if nearest[1]==py else (1 if nearest[1]>py else -1)
            actions['player'] = f"MOVE {dx} {dy}"
        else:
            actions['player'] = 'STAY'
        player_log = {'stdout':'[engine] default player bot', 'stderr':''}
    # opponent
    # simple random bot
    ox,oy = ref.pacs['opponent']
    if ref.pellets:
        nearest = min(ref.pellets, key=lambda p: abs(p[0]-ox)+abs(p[1]-oy))
        dx = 0 if nearest[0]==ox else (1 if nearest[0]>ox else -1)
        dy = 0 if nearest[1]==oy else (1 if nearest[1]>oy else -1)
        actions['opponent'] = f"MOVE {dx} {dy}"
    else:
        actions['opponent'] = 'STAY'
    opponent_log = {'stdout':'[engine] default opponent bot', 'stderr':''}

    state, stdout, stderr = ref.step(actions)
    # attach per-bot logs into the state entry
    entry = ref.history[-1]
    entry['bot_logs'] = {
        'player': player_log,
        'opponent': opponent_log
    }
    return jsonify({'state': state, 'stdout': stdout, 'stderr': stderr, 'history_entry': entry})

@app.route('/api/games/<game_id>/history')
def get_history(game_id):
    game = GAMES.get(game_id)
    if not game:
        return jsonify({'error':'not found'}), 404
    ref: Referee = game['ref']
    return jsonify({'history': ref.history})

@app.route('/static/<path:path>')
def send_static(path):
    return send_from_directory('static', path)

if __name__ == '__main__':
    app.run(debug=True, port=5000)

