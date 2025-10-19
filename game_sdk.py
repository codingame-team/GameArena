"""Minimal game SDK/referee patterns.
Defines a Referee base class and helpers for JSON state exchange between backend and frontend.
"""
from typing import Any, Dict, List, Tuple

class Referee:
    """Base referee class. Subclass this to implement a new game/referee.

    Methods to implement:
    - init_game(init_params) -> None : initialize game state
    - get_protocol() -> dict : return protocol description (init inputs, per-turn inputs, outputs, constraints)
    - get_state() -> dict : return current state serializable to JSON
    - is_finished() -> bool
    - step(actions_by_bot: Dict[str,str]) -> Tuple[dict,str,str] : apply actions and advance one turn.
        returns: (state, stdout_log, stderr_log)
    - make_bot_input(bot_id) -> str : produce the string given to each bot on a turn
    - parse_bot_output(bot_id, output_str) -> str : parse bot output into an action string
    """
    def __init__(self):
        self.history: List[Dict[str, Any]] = []
        self.turn = 0
        self.logs: List[str] = []

    def init_game(self, init_params: Dict[str,Any]):
        raise NotImplementedError()

    def get_protocol(self) -> Dict[str,Any]:
        return {}

    def get_state(self) -> Dict[str,Any]:
        raise NotImplementedError()

    def is_finished(self) -> bool:
        raise NotImplementedError()

    def step(self, actions_by_bot: Dict[str,str]) -> Tuple[Dict[str,str], str, str]:
        raise NotImplementedError()

    def make_bot_input(self, bot_id: str) -> str:
        """Return the string sent to the bot for this turn."""
        return ""

    def parse_bot_output(self, bot_id: str, output_str: str) -> str:
        """Return an action identifier parsed from bot output."""
        return output_str.strip()
