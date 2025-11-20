# GameArena — plateforme prototype d'arène de bots

GameArena est un prototype d'une plateforme de programmation compétitive qui permet d'exécuter des "bots" (scripts utilisateur) contre un arbitre (Referee) et de rejouer l'historique des parties.

Résumé rapide
- But : démontrer une architecture modulaire et sécurisée pour organiser des matchs entre programmes intelligents (bots) et expérimenter des règles de jeux.
- Stack : Python (Flask) pour le backend, React + Vite pour le frontend, Docker pour l'isolation des bots.

Fonctionnalités clés
- Referee extensible : chaque jeu est implémenté comme une sous-classe de `game_sdk.Referee` (contrat : init_game, step, get_state, parse_bot_output, on_bot_timeout, ...).
- BotRunner abstrait : exécute le code des bots via plusieurs stratégies (docker, subprocess, mode parsed optimisé) sans coupler la logique du jeu à l'exécution.
- Sandbox Docker : exécution isolée des bots avec nettoyage et limites ressources — fallback en `subprocess` si utile en dev.
- Frontend interactif : éditeur de code (Monaco), visualizer et panneau de logs pour rejouer l'historique d'une partie.
- Persistance minimale : bots persistants sous `persistent_bots/` et index JSON pour métadonnées.

Structure et rôles des composants

Backend (API)
- Fichier principal : `app.py` — gère les routes HTTP et la validation des entrées. Le fichier contient actuellement une logique qui peut être extraite en services.
- Recommandation structurelle : séparer l'API (routes) des services métier et des repositories (p.ex. `services/game_service.py`, `repositories/game_repository.py`). Cela améliore la testabilité et le respect du principe SRP.
- Endpoints clés :
  - GET  `/api/referees` — liste des referees et description du protocole attendu par le frontend.
  - POST `/api/games` — création d'une nouvelle partie (payload JSON avec `referee`, `player_code`, options).
  - POST `/api/games/<id>/step` — avancer une seule étape (tour) de la partie.
  - GET  `/api/games/<id>/history` — récupérer l'historique complet (format `history_entry` décrit ci‑dessous).

Domain (game_sdk)
- `game_sdk.py` contient les abstractions centrales :
  - `Referee` : contrat template-method pour exécuter une partie (init_game, step, is_finished, make_bot_input, parse_bot_output, on_bot_timeout, get_state).
  - `BotRunner` : interface/stratégie pour l'exécution de bots. Implémente `run(code, input_data, timeout_ms)` et gère la sélection de la stratégie (`auto|docker|subprocess`).
- Pattern utilisés : Template Method (Referee) et Strategy (BotRunner).

Referees (règles de jeu)
- Emplacement : `referees/`.
- Chaque referee implémente la logique métier du jeu : validation des mouvements, collisions, scoring, conditions de fin.
- Exemples de comportements que les referees peuvent implémenter :
  - MOVE vers une cellule non adjacente : accepter une action MOVE vers une cible distante et la convertir en une série de déplacements le long du plus court chemin (algorithme BFS/A* selon la topologie).
  - Evitement de collision : règles pour rejeter ou ajuster un MOVE si deux pacs tentent la même case (priorité, file d'attente, ou redirection automatique).
  - Fin anticipée : terminer la partie si un joueur a suffisamment de pellets pour être mathématiquement assuré de la victoire (score actuel > adversaire + pellets_restants).

BotRunner et runners concrets
- Implémentations :
  - `runner/docker_runner.py` : exécution isolée via Docker, gestion des limites (CPU, mémoire, pids), nettoyage et collecte de logs.
  - Subprocess runner : exécution locale plus rapide pour le dev, sans isolation forte.
  - Mode parsed : optimisation où le code du bot est analysé et exécuté en mode interactif (init + tours) pour éviter le coût de startup à chaque tour.
- Politique de sélection : par défaut `auto` (heuristique basée sur timeout et configuration), sinon respecter la variable `BOT_RUNNER`.

Persistance et stockage
- Bots persistants : `persistent_bots/<bot_id>/bot.py` et métadonnées dans `persistent_bots/games_index.json`.
- Base locale : SQLite (`gamearena.db`) utilisée pour stocker objets applicatifs (utilisateurs, parties, leagues) selon `models.py`.
- Recommandation : séparer entités domain et modèles SQLAlchemy si une refactorisation est entreprise.

Frontend
- Emplacement : `frontend/` (React + Vite). Contient l'éditeur (Monaco), la visualisation (PixiJS) et les composants UI.
- Fichiers notables :
  - `frontend/src/components/MonacoEditor.jsx` — éditeur de code.
  - `frontend/src/components/Visualizer.jsx` — rendu et animation.
  - `frontend/src/pages/PlaygroundPage.jsx` — orchestration (peut être découpée en hooks et services).
- Communication : le frontend consomme l'API JSON exposée par le backend. Pour le dev, configurez `VITE_API_BASE` si nécessaire.

Format `history_entry` (aperçu)
- Un `history_entry` représente l'état et les actions d'un tour. Exemple schématique :
  - { "turn": 3, "actions": [{"player_id":"p1","action":"MOVE 3 2"}, ...], "state": { ... }, "timestamp": "..." }
- Le frontend utilise la liste des `history_entry` pour reproduire la partie image par image.

Configuration et variables d'environnement importantes
- `BOT_DOCKER_IMAGE` : image Docker utilisée pour exécuter les bots.
- `BOT_RUNNER` : force le runner (`auto|docker|subprocess`).
- `BOT_TMP_DIR` : dossier de base pour les montages Docker (utile sur macOS).
- `BOT_DOCKER_AUTO_THRESHOLD_MS`, `BOT_DOCKER_STARTUP_MS` : heuristiques de sélection du runner.
- `DOCKER_RUNNER_TRACE`, `DOCKER_RUNNER_PER_RUN_CHECKS` : logs et vérifications du runner Docker.

Exécution locale rapide
1) Backend :

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python app.py
```

2) Frontend (dev) :

```bash
cd frontend
npm install
npm run dev
```

API exemples
- Lister les referees :

```bash
curl -s http://127.0.0.1:5000/api/referees | jq
```

- Créer une partie :

```bash
curl -s -X POST http://127.0.0.1:5000/api/games \
  -H 'Content-Type: application/json' \
  -d '{"referee":"pacman","player_code":"print(\"MOVE 1 0\")"}' | jq
```

Tests et outils
- Makefile expose des commandes utiles : `make install`, `make test-runner`, `make build-bot-image`.
- Scripts d'intégration et tests unitaires pour le runner se trouvent dans `runner/` et `tests/`.

Sécurité et robustesse (rappel)
- Toujours exécuter le code utilisateur en isolation sur un environnement contrôlé. En production : forcer Docker, appliquer des limites ressources, désactiver le réseau, ne pas exécuter en root.
- Valider et sanitizer toutes les entrées API côté serveur.
- Logger et conserver les sorties des bots pour audit et debug.

Extension du projet
- Ajouter un nouveau jeu : créer une sous-classe de `game_sdk.Referee`, définir le protocole d'input/output et enregistrer le referee dans la fabrique (`app.py` ou `RefereeFactory`).
- Ajouter un runner : implémenter l'interface `BotRunner` et l'ajouter à la logique de sélection.
- Découper `app.py` : extraire `services/` et `repositories/` pour clarifier les responsabilités.

Licence
- Ce dépôt est un prototype éducatif. Voir les en-têtes de fichiers et les fichiers de configuration pour les détails de licence.

---

Si vous souhaitez que j'ajoute une section détaillée sur le format exact de `history_entry`, un diagramme d'architecture SVG simple, ou un guide pour écrire un nouveau `Referee` étape par étape, dites-moi lequel et je l'ajoute.
