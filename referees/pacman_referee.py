"""A minimal Pacman-like referee implementing a toy version of the rules from pacman.md.
This is intentionally simplified for a prototype.
"""
from game_sdk import Referee
from typing import Dict, Any, Tuple
import random

class PacmanReferee(Referee):
    def __init__(self):
        super().__init__()
        self.width = 7
        self.height = 5
        self.grid = []
        self.pellets = set()
        self.pacs = {}  # bot_id -> (x,y)
        self.scores = {"player":0, "opponent":0}
        self.max_turns = 200
        self.owner_map = {}  # pac id to owner

    def init_game(self, init_params: Dict[str,Any]):
        # init_params may contain width/height or custom map
        self.width = init_params.get('width', self.width)
        self.height = init_params.get('height', self.height)
        # simple empty grid (no walls) for prototype
        self.grid = [[" " for _ in range(self.width)] for _ in range(self.height)]
        # fill pellets in all floor cells
        self.pellets = set((x,y) for x in range(self.width) for y in range(self.height))
        # place pacs
        self.pacs = {
            'player': (0,0),
            'opponent': (self.width-1, self.height-1)
        }
        self.turn = 0
        self.history = []
        self.logs = []

    def get_protocol(self):
        return {
            'init_inputs': 'width height and the map',
            'turn_inputs': 'for each pac: id x y; for each pellet: x y value',
            'turn_output': 'MOVE dx dy or STAY',
            'constraints': {
                'max_turns': self.max_turns,
                'time_ms': 50
            }
        }

    def get_state(self):
        return {
            'turn': self.turn,
            'pacs': self.pacs.copy(),
            'pellets': list(self.pellets),
            'scores': self.scores.copy()
        }

    def is_finished(self):
        return self.turn >= self.max_turns or len(self.pellets)==0

    def make_bot_input(self, bot_id: str) -> str:
        # Simple line-based input: turn, my x y, visible pellets list
        x,y = self.pacs[bot_id]
        pellets = " ".join(f"{px},{py}" for px,py in self.pellets)
        return f"{self.turn}\n{x} {y}\n{pellets}\n"

    def parse_bot_output(self, bot_id: str, output_str: str) -> str:
        # Expect 'MOVE dx dy' or 'STAY'
        s = output_str.strip()
        if not s:
            return 'STAY'
        return s.splitlines()[0]

    def step(self, actions_by_bot: Dict[str,str]) -> Tuple[Dict[str,str], str, str]:
        stdout = ''
        stderr = ''
        # Apply actions: each action is MOVE dx dy or STAY
        new_positions = {}
        for bot_id, action in actions_by_bot.items():
            x,y = self.pacs[bot_id]
            if not action:
                action = 'STAY'
            parts = action.strip().split()
            if parts[0]=='MOVE' and len(parts)>=3:
                try:
                    dx = int(parts[1])
                    dy = int(parts[2])
                    nx = max(0, min(self.width-1, x+dx))
                    ny = max(0, min(self.height-1, y+dy))
                    new_positions[bot_id] = (nx,ny)
                    stdout += f"{bot_id} moves {x,y} -> {nx,ny}\n"
                except Exception as e:
                    stderr += f"{bot_id} invalid MOVE: {e}\n"
                    new_positions[bot_id] = (x,y)
            else:
                stdout += f"{bot_id} stays at {x,y}\n"
                new_positions[bot_id] = (x,y)
        # resolve collisions (if same tile, both stay in this simple prototype)
        # commit positions
        for bot_id,pos in new_positions.items():
            self.pacs[bot_id] = pos
            # eat pellet if present
            if pos in self.pellets:
                self.pellets.remove(pos)
                if bot_id=='player':
                    self.scores['player'] += 1
                else:
                    self.scores['opponent'] +=1
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

# provide helper to create instance

def make_referee():
    return PacmanReferee()
