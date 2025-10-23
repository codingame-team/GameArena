# GameArena prototype

This repository contains a minimal prototype of a bot arena (Flask backend + simple JS frontend).

How it works
- A Referee class defines the game logic and a protocol. Subclass it to add new games.
- The Flask app (`app.py`) exposes endpoints to list referees, create games and step through turns.
- The frontend (React + Vite in `frontend/`) provides a code editor (Monaco), visualizer and logs panel.

Frontend vs legacy static
- The repository historically included a very small `static/` frontend. The active UI is now in the `frontend/` folder and uses Vite + React (see `frontend/src`).

Quick overview
- Backend (Flask): responsible for referees, creating games and stepping through turns. It exposes a small JSON API under `/api/...`.
- Frontend (React/Vite): provides an editor for bot code, controls to create runs, a visualizer that replays game history and a logs panel. Communication with the backend is via the JSON API.

Run Code behaviour (important)
- The frontend allows the user to click "Run Code" even while a visual animation of a previously collected game is still playing.
- However, the button is disabled while the backend is busy building (collecting) the new game's history in memory. The frontend uses a short-lived collecting state to prevent starting multiple backend runs concurrently.
- When "Run Code" is clicked while an animation is playing:
  - The frontend sends a request to create a new game run on the backend and immediately marks the client as "collecting" (button disabled).
  - The backend executes the entire game and the frontend pulls the game history (via repeated `/step` calls or a final `/history`).
  - During this collection the current animation may continue; once the new history is fully available the frontend stops the previous animation and starts the newly collected replay.
- Stopping the animation in the UI does NOT cancel the backend collection; the collection continues to completion and will be played as soon as it's ready.

Notes and limitations
- This is a prototype. Running arbitrary user code is dangerous — in production you must sandbox bot execution (containers, restricted runtimes).
- The Pacman referee here is a simplified toy version intended to demonstrate modularity.

To run locally (backend)

1. Create a Python venv and install requirements:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python app.py
```

The backend serves the API (default: http://127.0.0.1:5000). You can use the API commands below to create games and step them.

To run the frontend (development)

1. Install Node.js (recommended: LTS). From the repository root:

```bash
cd frontend
npm install
npm run dev
```

2. Open the URL printed by Vite (typically http://localhost:5173) to access the UI. The frontend expects the API at the address defined by VITE_API_BASE (defaulting to http://127.0.0.1:3000 in dev); set VITE_API_BASE appropriately (or use a proxy in `vite.config.js`) so the frontend talks to your Flask backend.

Useful API commands

Voici quelques commandes utiles pour tester l'API depuis un terminal (bash).

- Lister les referees et leur protocole :

```bash
curl -s http://127.0.0.1:5000/api/referees | jq
```

- Créer une partie en envoyant le code du bot joueur (exemple minimal) :

```bash
curl -s -X POST http://127.0.0.1:5000/api/games \
  -H 'Content-Type: application/json' \
  -d '{"referee":"pacman","player_code":"print(\"MOVE 1 0\")"}' | jq
```

La réponse contient l'identifiant de la partie :

```json
{ "game_id": "<uuid>" }
```

- Avancer la partie d'un tour (remplacez `<game_id>` par l'ID renvoyé) :

```bash
curl -s -X POST http://127.0.0.1:5000/api/games/<game_id>/step | jq
```

La réponse contient l'état du tour, stdout/stderr du referee et une entrée d'historique (`history_entry`).

- Récupérer l'historique complet (replay) :

```bash
curl -s http://127.0.0.1:5000/api/games/<game_id>/history | jq
```

Chaque élément de l'historique contient : `turn`, `state`, `actions`, `stdout`, `stderr`, `bot_logs`.

Persistence des bots et sécurité
- Les bots sauvegardés sont stockés sous `persistent_bots/<bot_id>/bot.py`.
- Il y a un index minimal `persistent_bots/games_index.json` pour restaurer les jeux.
- Par défaut la plateforme favorise l'exécution isolée (Docker) pour les bots persistants. N'activez pas l'exécution locale persistante sauf sur une machine de confiance. Voir `ALLOW_PERSISTENT_LOCAL` et `BOT_DOCKER_IMAGE`.

Sandbox (Docker) — déjà configurée
- La sandbox (runner Docker) est déjà fournie et configurée dans le projet : elle exécute les bots dans un conteneur isolé.
- Comportement pratique : le runner crée un répertoire temporaire, copie (`docker cp`) le fichier `bot.py` dans un conteneur éphémère, puis démarre ce conteneur attaché. Ce flux évite les problèmes de bind-mount sur Docker Desktop (macOS) et fonctionne de façon fiable en dev/CI.

Variables d'environnement utiles
- `BOT_DOCKER_IMAGE` : image Docker utilisée pour exécuter les bots (par défaut `python:3.11-slim`). Pour utiliser l'image buildée localement, définissez par exemple `BOT_DOCKER_IMAGE=gamearena-bot:latest`.
- `BOT_TMP_DIR` : dossier de base utilisé pour créer des répertoires temporaires pour les bots (par défaut `/tmp`). Si vous avez des problèmes de montage sous Docker Desktop, utilisez un dossier sous `$HOME` ou ajoutez le chemin aux File Sharing de Docker Desktop.
- `BOT_RUNNER` : mode de runner `auto`|`docker`|`subprocess` (par défaut `auto`). En `auto`, le SDK peut choisir l'exécution en subprocess pour des budgets de temps très courts afin d'éviter la latence de démarrage d'un conteneur.
- `ALLOW_DOCKER_CP_FALLBACK` : (legacy) permettait d'autoriser un ancien comportement de fallback; le runner actuel force déjà le workflow `create -> docker cp -> start -a -i`.

Vérifier que la sandbox fonctionne (rapide)
1) Test du runner via l'endpoint de vérification (exécute un bot minimal) :

```bash
# lancer le serveur Flask (par défaut http://127.0.0.1:5000)
python3 app.py
# dans un autre terminal
curl -sS http://127.0.0.1:3000/api/runner/verify | jq .
```

- Si l'appel retourne `rc: 0` et `stdout: "PING\n"` (ou un équivalent), le runner fonctionne.
- Consultez les logs de l'application pour les traces DEBUG du runner (`run_bot_in_docker tmpdir=...`, `docker cp ...`, `docker start -a -i ...`).

2) Test de montage local pour macOS (recommandé si vous montez des dossiers) :

```bash
# utilisez un dossier sous votre $HOME pour éviter les problèmes de partage macOS
./runner/run_local_mount_test.sh "$HOME/gamearena-bot-test"
```

- Le script crée un bot, tente le workflow de mount et affiche `MOVE 1 0` si tout est ok.
- Si vous préférez bind-mounter directement, ouvrez Docker Desktop -> Preferences -> Resources -> File Sharing et ajoutez le chemin d'hôte utilisé.

Conseils de sécurité et production
- Pour la production, buildnez et verrouillez une image minimale et contrôlée (`BOT_DOCKER_IMAGE` fixé à un tag immuable).
- Limitez les ressources des conteneurs (CPU/mémoire), désactivez le réseau si possible, et n'exécutez pas les containers en tant que root.
- Évitez le `docker cp` à chaud en production : préférez des images contenant le runtime et des artefacts contrôlés.

Prochaine étape
- Si vous souhaitez, j'ajoute une section courte montrant comment forcer l'utilisation d'une image locale (commande Makefile / `build_bot_image.sh`) et un exemple de `docker run` avec limites CPU/mémoire.
