# Guide pas-à-pas — Écrire un nouveau Referee

Ce document explique, étape par étape, comment implémenter un nouveau `Referee` dans le projet GameArena. Il est destiné aux développeurs qui veulent ajouter une nouvelle règle de jeu (nouveau jeu) tout en respectant l'architecture et les conventions du dépôt.

Objectifs du guide
- Expliquer le contrat attendu d'un `Referee` (API publique).
- Donner un squelette minimal et des conseils d'implémentation (pathfinding, collision avoidance, fin de partie basée sur pellets restants).
- Montrer comment intégrer le `Referee` dans l'application (factory, routes) et comment le tester.

Conventions importantes (rappels)
- Respecter SOLID (SRP, OCP, LSP, ISP, DIP).
- Un `Referee` contient uniquement la logique métier du jeu. Il ne doit pas exécuter les bots ni faire d'accès DB.
- Utiliser `game_sdk.BotRunner` (injection) pour exécuter des bots.
- Ne pas modifier le contrat de `Referee` sans mise à jour coordonnée.

Contrat attendu d'un Referee (méthodes clés)
- `init_game(self, players, config)` : initialiser l'état, la carte, pellets, positions de départ.
- `get_protocol(self)` : retourner le protocole (description des inputs/outputs attendus par les bots).
- `get_state(self)` : état sérialisable courant du jeu (pour UI / replay).
- `is_finished(self)` : bool — indique si la partie est finie.
- `step(self, bot_outputs)` : appliquer un tour en utilisant les sorties des bots, mise à jour d'état, détection de collisions.
- `make_bot_input(self, player_id)` : construire l'entrée texte/json envoyée au bot pour son tour.
- `parse_bot_output(self, raw_output)` : parser la sortie du bot en action(s) valides.
- `on_bot_timeout(self, player_id)` : gère le cas d'un bot qui a timeout.

Note : `game_sdk.Referee` contient la `run_game()` (template method). N'écrasez pas `run_game` sauf si vous connaissez toutes les implications.

## Étape 1 — Planifier le jeu et le protocole

1. Définir clairement : état initial, entités (pacs, pellets), actions valides (MOVE, SPEED, SWITCH, etc.), valeurs des pellets.
2. Décrire le protocole d'entrée/sortie pour les bots (ex: lignes textuelles ou JSON). Adapter à `get_protocol()`.
3. Décider des règles spéciales : autoriser MOVE vers cellule non-adjacente en suivant le plus court chemin (voir Section Pathfinding), règles de collision, fin de partie.

## Étape 2 — Créer le fichier du Referee

- Emplacement recommandé : `referees/<votre_jeu>_referee.py`.
- Importer l'abstraction : `from game_sdk import Referee`.
- Implémenter les méthodes du contrat.

Squelette minimal (exemple)

```text
# referees/mygame_referee.py
from game_sdk import Referee

class MyGameReferee(Referee):
    def init_game(self, players, config):
        # ...initialisation carte, pellets, positions
        pass

    def get_protocol(self):
        return {
            'input_format': 'text',
            'description': 'Chaque tour, le bot reçoit ...'
        }

    def get_state(self):
        return {
            'turn': self.turn,
            'players': self._serialize_players(),
            'map': self.map_for_ui(),
        }

    def is_finished(self):
        # logique de fin (cf. section Fin de partie)
        return self._finished

    def make_bot_input(self, player_id):
        # préparer l'entrée envoyée au bot
        return "..."

    def parse_bot_output(self, raw_output):
        # transformer la sortie en action(s)
        return parsed_action

    def on_bot_timeout(self, player_id):
        # gérer le timeout (ex: penalité)
        pass

    def step(self, bot_outputs):
        # appliquer les actions, mettre à jour l'état
        pass
```

## Étape 3 — Pathfinding : autoriser MOVE vers cellule non-adjacente

- Choix d'algorithme : A* (avec heuristique Manhattan pour grille) ou BFS si toutes les arêtes coûtent 1.
- Spécification : si un bot envoie `MOVE x y` vers une cellule non-adjacente, le `Referee` doit :
  1. Calculer le plus court chemin entre la position actuelle et la cible (en tenant compte des obstacles statiques).
  2. Valider que la cible est atteignable dans le graphe de la carte.
  3. Convertir l'action en une série de mouvements atomiques pour ce tour selon les règles (ex: se déplacer d'une cellule par tour ou autoriser plusieurs étapes si SPEED activé).

Conseils pratiques :
- Implémentez une fonction `shortest_path(start, goal)` qui retourne la liste des positions.
- Cachez les résultats de pathfinding si performance nécessaire (simple LRU par paire start/goal pendant un tour).

## Étape 4 — Éviter les collisions avec l'adversaire (amélioration du bot et gestion côté Referee)

- Définitions : collision = deux pacs occupent la même cellule au même tour (ou swap en même temps).
- Approche côté `Referee` :
  - Collecter toutes les intentions (chemins ou moves) avant de les exécuter.
  - Simuler l'exécution tour par tour et détecter conflits.
  - Règles possibles en cas de conflit :
    - Priorité par ordre de joueur (défini par l'index), ou
    - Refuser le mouvement (le pac reste sur place), ou
    - Résoudre par combat (selon règles du jeu).
- Approche côté bot (recommandé) : améliorer la logique pour éviter d'envoyer des cibles occupées ou des chemins qui croisent l'adversaire :
  - Si le bot peut lire l'état, il doit prédire la position de l'adversaire pour N pas et choisir un chemin alternatif.
  - Utiliser heuristiques : éviter cellules adjacentes si adversaire a SPEED, etc.

## Étape 5 — Fin de partie basée sur pellets restants

- Objectif : terminer la partie tôt si un pac ne peut plus rattraper le leader en points même en prenant tous les pellets restants.
- Implémentation :
  1. Calculer `leader_score` et `other_score`.
  2. Compter les pellets restants `remaining_pellets_value` (en tenant compte des valeurs si variantes).
  3. Si `other_score + remaining_pellets_value <= leader_score` alors la partie est terminée; le leader a mathématiquement gagné.

Notes : prendre en compte les règles spéciales (pellets de différentes valeurs, pellets inaccessibles, pénalités de mouvement).

## Étape 6 — Intégration avec `app.py` / Factory

- Ne modifiez pas `app.py` en ajoutant logique métier. Ajoutez simplement la création du referee dans la factory de referees.
- Exemple :

```text
# app.py (ou RefereeFactory)
from referees.mygame_referee import MyGameReferee

def get_referee(game_type):
    if game_type == 'mygame':
        return MyGameReferee()
    # ...autres referees
```

- Si vous préférez, créez `referees/__init__.py` et un `RefereeFactory` propre sous `services/referee_factory.py`.

## Étape 7 — Tests unitaires

- Créez des tests minimalistes dans `tests/referees/test_mygame_referee.py`.
- Cas à couvrir :
  - Initialisation (carte et positions correctes).
  - Pathfinding : reachable vs unreachable.
  - Collision detection : deux intentions conflictuelles.
  - Fin de partie : condition mathématique de victoire.
  - Bot timeout handling.

Exemple de test (pytest) :

```text
def test_shortest_path_simple():
    r = MyGameReferee()
    r.init_game(players=[...], config={...})
    path = r.shortest_path((0, 0), (2, 0))
    assert path == [(0,0), (1,0), (2,0)]
```

## Étape 8 — Quality gates et validation

- Lint / type check : exécuter `flake8` / `mypy` si présents.
- Tests : `pytest tests/referees/test_mygame_referee.py`.
- Vérifier que vous n'instanciez pas directement `DockerRunner` dans le `Referee`; injectez un `BotRunner` si nécessaire.

## Étape 9 — Documentation et README

- Ajouter une courte description dans `referees/README.md` (si existant) et mettre à jour `GET /api/referees` si nécessaire (description du protocole).
- Documenter les limites et les décisions d'implémentation (ex: heuristique A*, règles de collision).

## Bonnes pratiques & pièges à éviter

- Ne pas exécuter de code externe (bot) depuis le `Referee` — utilisez `BotRunner`.
- Eviter les effets de bord globaux (parsed-bots gardent un `parsed['globals']` — ne mélangez pas ça avec l'état du `Referee`).
- Valider toute entrée de bot (format, actions légales) avant de l'appliquer.
- Toujours logger les exceptions et retourner des messages clairs côté API.

## Checklist rapide avant merge

- [ ] Tests unitaires ajoutés et verts
- [ ] Respect du contrat `Referee`
- [ ] Pas d'accès DB ni d'exécution de processus dans le `Referee`
- [ ] Documentation (README / Markdown) mise à jour
- [ ] Respect des règles de sécurité Docker si runner modifié

## Annexe — Ressources utiles

- `game_sdk.Referee` (lire le fichier `game_sdk.py` pour le contrat exact)
- `runner/docker_runner.py` (Comment exécuter les bots en Docker)
- Exemples existants : `referees/pacman_referee.py`

---

Si vous voulez, je peux :
- Générer un squelette `referees/<jeu>_referee.py` prêt à l'emploi,
- Ajouter des tests unitaires de démarrage,
- Ou encore implémenter l'algorithme A* de pathfinding utilisé par le `Referee`.
Indiquez ce que vous voulez que je crée ensuite.
