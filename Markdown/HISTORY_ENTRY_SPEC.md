# Spécification : format `history_entry`

Ce fichier extrait et formalise la spécification du format `history_entry` utilisé par GameArena.
Il est destiné aux auteurs de `Referee`, au frontend et aux tests automatisés.

Fichiers associés
- JSON Schema (validation automatique) : `schemas/history_entry.schema.json`
- Utilitaire de validation Python : `tools/validate_history_entry.py`

But
- Décrire précisément la structure JSON d'une entrée d'historique (tour) — `history_entry` — stockée dans `Referee.history` et renvoyée par l'API (`POST /api/games/<game_id>/step` et `GET /api/games/<game_id>/history`).

Résumé rapide
- `history_entry` est un objet JSON.
- Champs obligatoires : `turn` (int), `state` (object).
- Champs recommandés : `actions` (array), `bot_logs` (object), `timestamp` (ISO8601).
- Champs supplémentaires : `stdout`, `stderr`, `meta`, `__global_stdout`, `__global_stderr`.

Usage
- Le frontend se base sur `turn` + `state` pour rejouer l'arène.
- Les tests et outils d'audit valident les `history_entry` via le JSON Schema fourni.

---

## Contrat détaillé

Type racine : objet JSON

Champs principaux

- `turn` (integer) — Obligatoire
  - Numéro du tour. Par convention la plupart des `Referee` utilisent une numérotation 0-based pour la première étape après l'initialisation.
  - Doit être >= 0.

- `state` (object) — Obligatoire
  - Snapshot sérialisable de l'état du jeu après l'application des actions de ce tour.
  - Contient au minimum les éléments nécessaires au visualizer : positions d'entités, scores, carte ou delta d'affichage.

- `actions` (array) — Optionnel mais recommandé
  - Liste d'objets décrivant les actions demandées/parses/appliquées ce tour.
  - Chaque élément peut contenir :
    - `player_id` (string) — identifiant/role du joueur (ex: "player", "opponent", "bot:123").
    - `raw` (string) — sortie brute du bot ou commande fournie.
    - `parsed` (object|string) — représentation parsée (ex: {"type":"MOVE","x":5,"y":3}).
    - `resolved` (string) — action effectivement appliquée après validation (p.ex. MOVE ajusté ou rejeté).
    - `notes` (string) — explication sur invalidation, collision, etc.

- `bot_logs` (object) — Optionnel mais très utile
  - Map role -> log object. Exemple de rôle : `player`, `opponent`, `bot:123`.
  - Log object keys :
    - `stdout` (string)
    - `stderr` (string)
    - `rc` (integer)
    - `runner` (string) — ex: "docker", "subprocess", "parsed", "exception".
  - Note : `app.py` injecte ces logs dans la route `step` si l'exécution des bots est faite au niveau de l'API.

- `stdout` / `stderr` (string) — Facultatif
  - Sorties textuelles produites par le `Referee`.

- `__global_stdout` / `__global_stderr` (string) — Facultatif
  - Champs spéciaux utilisés par l'API pour transmettre des messages globaux (par ex lors d'une réponse `finished`). Le frontend les traite parfois comme des éléments global history distincts.

- `timestamp` (string, format ISO8601) — Optionnel mais recommandé
  - Horodatage du moment où l'entrée a été produite.

- `meta` (object) — Optionnel
  - Champ libre pour des métadonnées : `events`, `end_reason`, `pathfinding_debug`, etc.

---

## Exemples

1) Exemple minimal :

```json
{
  "turn": 12,
  "state": { "players": {}, "map": {} }
}
```

2) Exemple typique avec actions et logs :

```json
{
  "turn": 5,
  "state": {
    "players": {
      "player": {"score": 12, "pacs": [{"id":"p1","x":4,"y":2,"alive":true}]},
      "opponent": {"score": 8, "pacs": [{"id":"o1","x":7,"y":1,"alive":true}]}
    },
    "map": {"width":10, "height":8}
  },
  "actions": [
    {"player_id":"player","raw":"MOVE 4 2","parsed":{"type":"MOVE","x":4,"y":2},"resolved":"MOVE 4 2"},
    {"player_id":"opponent","raw":"SPEED","resolved":"SPEED"}
  ],
  "bot_logs": {
    "player": {"stdout":"init\nMOVE 4 2\n","stderr":"","rc":0,"runner":"docker"},
    "opponent": {"stdout":"SPEED\n","stderr":"","rc":0,"runner":"subprocess"}
  },
  "timestamp": "2025-11-20T12:34:56.789Z"
}
```

3) Exemple de réponse `finished` (API) :

```json
[
  { /* history_entry tour 0 - exemple non affiché ici */ },
  { /* history_entry tour N - exemple non affiché ici */ },
  { "__global_stdout": "Match finished: player wins, final score 20-10" }
]
```

---

## Validation automatique

Utilisez le JSON Schema fourni `schemas/history_entry.schema.json` pour valider automatiquement des `history_entry`.
Un petit utilitaire est fourni : `tools/validate_history_entry.py`.

Exemple (bash) :

```bash
python3 tools/validate_history_entry.py path/to/sample_history_entry.json schemas/history_entry.schema.json
```

Le script installe `jsonschema` en local s'il n'est pas présent (`pip install --user jsonschema`).

---

## Bonnes pratiques et recommandations

- Rendre `state` compact mais suffisant pour la visualisation.
- Préférer ISO8601 pour `timestamp`.
- Documenter, dans `Referee.get_protocol()`, les clés du `state` que le frontend attend.
- Inclure `bot_logs` lors de l'exécution des bots pour améliorer le debug.

---

Pour toute mise à jour du contrat, mettez à jour `schemas/history_entry.schema.json` et adaptez le frontend si nécessaire.
