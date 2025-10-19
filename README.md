GameArena prototype

This repository contains a minimal prototype of a bot arena (Flask backend + simple JS frontend).

How it works
- A Referee class defines the game logic and a protocol. Subclass it to add new games.
- The Flask app (`app.py`) exposes endpoints to list referees, create games and step through turns.
- The frontend (`static/index.html`, `static/app.js`) provides a textarea code editor, visualizer and logs panel.

Notes and limitations
- This is a prototype. Running arbitrary user code is dangerous — in production you must sandbox bot execution (containers, restricted runtimes).
- The Pacman referee here is a simplified toy version intended to demonstrate modularity.

To run locally:

1. Create a Python venv and install requirements:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python app.py
```

2. Open http://127.0.0.1:5000/ in your browser.

Next steps / improvements
- Add robust sandboxing for bot execution (containerized runners, seccomp, user namespaces, resource limits).
- Replace the textarea editor with Monaco or CodeMirror.
- Implement replay controls client-side (scrubbing, speed control), richer visualizer (canvas/SVG) and support multiple bots per player.
- Add persistent storage for games, leaderboards and league promotion rules.

