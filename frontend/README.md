# GameArena Frontend

This folder contains the React + Vite frontend used by the GameArena prototype.

Quick start (development)

1. Install dependencies

```bash
cd frontend
npm install
```

2. Start dev server

```bash
npm run dev
```

By default Vite serves on http://localhost:5173. The frontend expects the backend API at
`http://127.0.0.1:3000` by default; you can override this by creating an `.env` file with:

```
VITE_API_BASE=http://127.0.0.1:3000
```

How the editor integration works

- On first load the web UI will try to use a `bot_id` saved in `localStorage` (`gamearena_bot_id`).
- If no saved code exists for that `bot_id`, the frontend fetches the template from `/api/player/template` and fills the editor.
- The editor autosaves (debounced 1s) to `/api/player/code/<bot_id>`; the backend persists the code under `persistent_bots/<bot_id>/bot.py`.
- When you press "Start Game" the frontend ensures the code is saved and then creates a game referencing the saved `player_bot_id`. The backend will mount the persisted folder into Docker when available so the container executes the exact file you edited.

Notes and troubleshooting

- The backend must be running (default `python3 app.py` in the repo root) and reachable from the browser. The backend includes CORS for local development.
- If you intend to use Docker runner, ensure the `PERSISTENT_BOTS_DIR` path is shared with Docker Desktop (macOS) or accessible to the Docker daemon. You can change the path by setting the env var before starting the backend, e.g.: `export PERSISTENT_BOTS_DIR=/path/you/shared && python3 app.py`.
- If the runner cannot see the host directory, the server will fallback to a reliable docker-cp fallback (when per-run checks are enabled) or to subprocess execution in `auto` mode.

Commands

- Dev server: `npm run dev`
- Build and copy to backend static: `npm run build:copy` (this will copy the built frontend into `static/` for the Flask static server)

If you want, I can also add a small end-to-end integration test (pytest or Cypress) that exercises the editor -> save -> create game -> step flow.

