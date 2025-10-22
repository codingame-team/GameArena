# GameArena prototype

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

## Commandes API utiles (exemples)

Voici quelques commandes utiles pour tester l'API du prototype depuis un terminal (bash).

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

+ + +

## Sauvegarder un bot et politique de sécurité (persistant)

Emplacement des fichiers et index
- Les bots sauvegardés sont stockés sous `persistent_bots/<bot_id>/bot.py`.
- Un index minimal des parties est conservé dans `persistent_bots/games_index.json` pour restaurer les jeux après un redémarrage du serveur.

Comportement par défaut et recommandations de sécurité
- Par défaut, les bots persistants (fichiers sous `persistent_bots/`) sont exécutés via Docker quand le système décide d'utiliser des "persisted bots" — cela limite la surface d'attaque et isole l'exécution.
- Ne **pas** activer l'exécution persistante locale sauf si vous faites confiance au code : la variable d'environnement `ALLOW_PERSISTENT_LOCAL=1` permet (historique/legacy) de démarrer un processus Python local persistant pour un bot sauvegardé. Par défaut cette option est désactivée.
- Image Docker utilisée : contrôlée par `BOT_DOCKER_IMAGE` (par défaut `python:3.11-slim`). Pour des environnements de production, utilisez une image verrouillée et minimisée.
- Il existe aussi des flags utiles pour le débogage : `DOCKER_RUNNER_PER_RUN_CHECKS` permet d'activer des contrôles par exécution (utilisé par l'endpoint de vérification).

Flux d'utilisation recommandé
1. Sauvegarder le code du bot (crée `persistent_bots/<bot_id>/bot.py`) :

```bash
curl -s -X POST http://127.0.0.1:5000/api/player/code/my-bot-01 \
  -H 'Content-Type: application/json' \
  -d '{"code":"print(\"MOVE 1 0\")"}' | jq
```

2. Vérifier le contenu enregistré (GET) :

```bash
curl -s http://127.0.0.1:5000/api/player/code/my-bot-01 | jq
```

3. Créer une partie en référençant le bot sauvegardé (option `player_bot_id`) :

```bash
curl -s -X POST http://127.0.0.1:5000/api/games \
  -H 'Content-Type: application/json' \
  -d '{"referee":"pacman","player_bot_id":"my-bot-01"}' | jq
```

La réponse contient `game_id`. Ensuite avancez la partie :

```bash
curl -s -X POST http://127.0.0.1:5000/api/games/<game_id>/step | jq
```

Endpoint utiles pour la politique d'exécution
- Vérifier si Docker est disponible :

```bash
curl -s http://127.0.0.1:5000/api/runner/check | jq
```

- Lancer une vérification d'exécution (exécute un bot test dans le runner choisi et renvoie quel runner a été utilisé) :

```bash
curl -s http://127.0.0.1:5000/api/runner/verify | jq
```

Conseils pratiques
- Par défaut, préférez l'utilisation de Docker comme runner pour isoler les bots. Ne mettez `ALLOW_PERSISTENT_LOCAL=1` que pour du développement local sur une machine de confiance.
- Pour reproduire localement le comportement "persistant" sans Docker : activez `ALLOW_PERSISTENT_LOCAL=1` avant de lancer `app.py` (attention aux risques de sécurité).
- Pour le déploiement, verrouillez `BOT_DOCKER_IMAGE`, limitez les ressources (CPU/MEM) et désactivez le réseau dans les conteneurs si possible.

+ + +

## Propositions d’améliorations (prioritaires)

Liste priorisée d'améliorations réalistes et à faible risque à implémenter ensuite :

1. Sandbox d'exécution des bots (priorité haute)
   - Remplacer l'exécution directe via `subprocess` par un runner isolé (Docker ou équivalent).
   - Limiter CPU et mémoire, désactiver le réseau, exécuter sous un utilisateur non privilégié.
   - Mettre en place une queue de jobs et des workers (ex: Celery + workers containerisés).

2. Éditeur de code riche (priorité moyenne)
   - Intégrer Monaco Editor ou CodeMirror pour l'éditeur côté client.
   - Ajouter syntax highlighting, indentation automatique et sauvegarde du code.

3. Visualiseur / Replay amélioré (priorité moyenne)
   - Remplacer le rendu HTML simple par un rendu Canvas/SVG pour animations et transitions.
   - Ajouter une barre de scrubbing, contrôle de vitesse, et affichage des logs par tour.

4. Persistance & ligues (priorité moyenne)
   - Ajouter une base de données (SQLite/Postgres) pour stocker bots, matches, ligues et classements.
   - Endpoints REST pour gérer les bots des joueurs, les ligues et les promotions/rétrogradations.

5. Tests unitaires et CI (priorité basse)
   - Écrire des tests pour les referees (ex: `test_pacman_referee.py`) et des tests d'intégration pour l'API.
   - Configurer CI (GitHub Actions) pour linting et tests.

---

Ces ajouts peuvent être implémentés progressivement ; si vous le souhaitez, je peux commencer par l'option 1 (sandbox Docker) ou l'option 2 (Monaco Editor). Indiquez votre préférence et je lance l'implémentation.
