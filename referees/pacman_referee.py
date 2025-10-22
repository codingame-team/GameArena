"""A minimal Pacman-like referee implementing a toy version of the rules from pacman.md.
This is intentionally simplified for a prototype.
"""
from game_sdk import Referee
from typing import Dict, Any, Tuple

class PacmanReferee(Referee):
    def __init__(self):
        super().__init__()
        self.width = 7
        self.height = 5
        self.grid = []
        self.pellets = set()
        # self.pacs used to store owner -> (x,y)
        self.pacs = {}
        self.scores = {"player":0, "opponent":0}
        self.max_turns = 200
        # owner_map: pac_id -> owner ('player'|'opponent')
        self.owner_map = {}

    def init_game(self, init_params: Dict[str,Any]):
        # init_params may contain width/height or custom map
        self.width = init_params.get('width', self.width)
        self.height = init_params.get('height', self.height)
        # simple empty grid (no walls) for prototype
        self.grid = [[" " for _ in range(self.width)] for _ in range(self.height)]
        # fill pellets in all floor cells
        self.pellets = set((x,y) for x in range(self.width) for y in range(self.height))
        # place pacs (for now single pac per side)
        self.pacs = {
            'player': (0,0),
            'opponent': (self.width-1, self.height-1)
        }
        # map pac ids to owners: pac id 0 = player, 1 = opponent (keeps compatibility with make_bot_input)
        self.owner_map = {0: 'player', 1: 'opponent'}
        self.turn = 0
        self.history = []
        self.logs = []

    def get_protocol(self):
        return {
            'init_inputs': 'width height and the map',
            'turn_inputs': 'for each pac: id x y; for each pellet: x y value',
            'turn_output': 'MOVE <pac_id> <x> <y> or STAY (absolute coordinates). Multiple commands may be separated by ";".',
            'constraints': {
                'max_turns': self.max_turns,
                # Increase per-bot time budget to 200ms by default to account for
                # container startup/overhead on typical developer machines.
                'time_ms': 1000
            }
        }

    def get_state(self):
        state = {
            'turn': self.turn,
            'pacs': self.pacs.copy(),
            'pellets': list(self.pellets),
            'scores': self.scores.copy()
        }
        # If the game is finished, include the winner information
        if self.is_finished():
            state['winner'] = self.get_winner()
        else:
            state['winner'] = None
        return state

    def get_winner(self) -> str:
        """Return the winner identifier: 'player', 'opponent', or 'draw'.

        The winner is the side that has consumed the most pellets (higher score).
        """
        p = self.scores.get('player', 0)
        o = self.scores.get('opponent', 0)
        if p > o:
            return 'player'
        if o > p:
            return 'opponent'
        return 'draw'

    def is_finished(self):
        return self.turn >= self.max_turns or len(self.pellets)==0

    def make_bot_input(self, bot_id: str) -> str:
        # CodinGame-like per-turn input:
        # Line1: my_score opponent_score
        # Line2: visible_pac_count
        # Next lines: for each visible pac: pac_id mine x y type_id speed_turns_left ability_cooldown
        # Next line: visible_pellet_count
        # Next lines: x y value
        my_score = self.scores.get('player', 0)
        opp_score = self.scores.get('opponent', 0)
        # Build pacs block (we expose both player and opponent pac)
        # Determine ownership per pac id so the 'mine' field is correct for the receiving bot
        px, py = self.pacs['player']
        ox, oy = self.pacs['opponent']
        pacs = []
        # pac id 0 = player, 1 = opponent
        # For each pac id, set mine to '1' if the owner matches bot_id, else '0'
        owner0 = self.owner_map.get(0)
        owner1 = self.owner_map.get(1)
        mine0 = '1' if owner0 == bot_id else '0'
        mine1 = '1' if owner1 == bot_id else '0'
        pacs.append(f"0 {mine0} {px} {py} 0 0 0")
        pacs.append(f"1 {mine1} {ox} {oy} 0 0 0")
        visible_pac_count = len(pacs)
        pacs_block = f"{visible_pac_count}\n" + '\n'.join(pacs) + '\n'
        # Pellets
        pellets = list(self.pellets)
        visible_pellet_count = len(pellets)
        pellet_lines = [f"{x} {y} 1" for x, y in pellets]
        pellets_block = f"{visible_pellet_count}\n" + ('\n'.join(pellet_lines) + '\n' if pellet_lines else '')
        return f"{my_score} {opp_score}\n" + pacs_block + pellets_block

    def parse_bot_output(self, bot_id: str, output_str: str) -> str:
        # Accept either:
        #  - "STAY"
        #  - legacy: "MOVE x y"
        #  - new: "MOVE pac_id x y"
        # multiple commands may be separated by ';'
        s = (output_str or '').strip()
        if not s:
            return 'STAY'
        # take first non-empty line
        first_line = ''
        for ln in s.splitlines():
            if ln and ln.strip():
                first_line = ln.strip()
                break
        if not first_line:
            return 'STAY'
        parts_line = [c.strip() for c in first_line.split(';') if c.strip()]
        normalized_cmds = []
        for cmd in parts_line:
            parts = cmd.split()
            if len(parts) == 0:
                continue
            cmd0 = parts[0].upper()
            if cmd0 == 'STAY' and len(parts) == 1:
                normalized_cmds.append('STAY')
                continue
            if cmd0 == 'MOVE':
                # New form: MOVE pac_id x y  (len >=4)
                if len(parts) >= 4:
                    try:
                        pid = int(parts[1])
                        tx = int(parts[2]); ty = int(parts[3])
                        normalized_cmds.append(f"MOVE {pid} {tx} {ty}")
                        continue
                    except Exception:
                        # invalid -> skip this subcommand
                        continue
                # Legacy form: MOVE x y (len==3) -> convert to using this bot's first pac id
                if len(parts) == 3:
                    try:
                        tx = int(parts[1]); ty = int(parts[2])
                        # find a pac id that belongs to this bot
                        pid = None
                        for k,v in self.owner_map.items():
                            if v == bot_id:
                                pid = k
                                break
                        if pid is None:
                            # no mapping known; fallback to 0
                            pid = 0
                        normalized_cmds.append(f"MOVE {pid} {tx} {ty}")
                        continue
                    except Exception:
                        continue
            # unknown/invalid subcommand -> ignore
            continue
        if not normalized_cmds:
            return 'STAY'
        return ' ; '.join(normalized_cmds)

    def step(self, actions_by_bot: Dict[str,str]) -> Tuple[Dict[str,str], str, str]:
        stdout = ''
        stderr = ''
        # Apply actions: accept commands like 'MOVE <pac_id> <x> <y>' (possibly multiple separated by ';') or 'STAY'
        new_positions = {}
        # Start from current positions
        for bot_id, pos in self.pacs.items():
            new_positions[bot_id] = pos
        for bot_id, action in actions_by_bot.items():
            if not action:
                continue
            # split by ';' to allow multiple moves
            subcmds = [c.strip() for c in action.split(';') if c.strip()]
            for sub in subcmds:
                parts = sub.split()
                if len(parts) == 0:
                    continue
                if parts[0].upper() == 'MOVE':
                    # Expect either MOVE pac_id x y
                    if len(parts) >= 4:
                        try:
                            pid = int(parts[1])
                            tx = int(parts[2]); ty = int(parts[3])
                        except Exception as e:
                            stderr += f"{bot_id} invalid MOVE params: {sub} ({e})\n"
                            continue
                        owner = self.owner_map.get(pid)
                        if owner != bot_id:
                            # command targets a pac id that doesn't belong to this bot -> ignore
                            stderr += f"{bot_id} attempted to control pac {pid} which is owned by {owner}\n"
                            continue
                        # compute clamped target
                        nx = max(0, min(self.width-1, tx))
                        ny = max(0, min(self.height-1, ty))
                        # set new position for this owner
                        new_positions[bot_id] = (nx, ny)
                        stdout += f"{bot_id} moves pac{pid} -> {nx,ny}\n"
                    else:
                        stderr += f"{bot_id} bad MOVE format: {sub}\n"
                elif parts[0].upper() == 'STAY':
                    # no-op for this subcommand
                    stdout += f"{bot_id} stays at {self.pacs.get(bot_id)}\n"
                else:
                    stderr += f"{bot_id} unknown command: {sub}\n"
        # commit positions and handle pellet consumption
        for bot_id, pos in new_positions.items():
            self.pacs[bot_id] = pos
            if pos in self.pellets:
                self.pellets.remove(pos)
                if bot_id == 'player':
                    self.scores['player'] += 1
                else:
                    self.scores['opponent'] += 1
                stdout += f"{bot_id} ate pellet at {pos}\n"
        self.turn += 1
        state = self.get_state()
        # append to history
        self.history.append({
            'turn': self.turn,
            'state': state,
            'actions': actions_by_bot.copy(),
            'stdout': stdout,
            'stderr': stderr
        })
        self.logs.append(stdout+stderr)
        return state, stdout, stderr

    def on_bot_timeout(self, bot_id: str, turn: int, reason: str = ''):
        """Handle a bot timeout/error by ending the game and awarding the win to the other side.

        We intentionally do not raise here: the server should report the finished
        game state and indicate which bot timed out. This avoids crashing the
        HTTP handler while ensuring a bot error causes an immediate loss.
        """
        # Determine the other side
        other = 'opponent' if bot_id == 'player' else 'player'
        # Award a decisive point to the other side so get_winner favors them
        try:
            self.scores[other] = self.scores.get(other, 0) + 1
        except Exception:
            self.scores = {other: 1}
        # Fast-forward to finished state
        self.turn = self.max_turns
        # Record in history for transparency
        try:
            self.history.append({
                'turn': self.turn,
                'state': self.get_state(),
                'actions': {},
                'stdout': '',
                'stderr': f"bot '{bot_id}' failed on turn {turn}: {reason}"
            })
        except Exception:
            pass
        # Do not raise: leaving the referee responsible for marking the game finished

