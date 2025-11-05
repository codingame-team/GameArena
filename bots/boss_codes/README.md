# Codes des Boss - Documentation

## Vue d'ensemble

Les codes des Boss sont stockés dans des fichiers Python séparés dans le répertoire `bots/boss_codes/` avant d'être sauvegardés en base de données. Cela facilite la maintenance, le versioning et les tests des différentes stratégies de Boss.

## Structure des fichiers

```
bots/boss_codes/
├── wood_boss.py          # Wood Boss - Stratégie greedy basique
├── bronze_boss.py        # Bronze Boss - Coordination multi-pacs
├── silver_boss.py        # Silver Boss - Utilisation des abilities
└── gold_boss.py          # Gold Boss - IA avancée adaptative
```

## Fonctionnement

### 1. Chargement du code

Le système charge les codes depuis les fichiers lors de l'initialisation des Boss :

```python
# Dans boss_system.py
@classmethod
def _get_boss_code(cls, strategy: str) -> str:
    """Charge le code depuis bots/boss_codes/<strategy>.py"""
    strategy_files = {
        'basic_greedy': 'wood_boss.py',
        'multi_pac_coordinator': 'bronze_boss.py',
        'advanced_abilities': 'silver_boss.py',
        'master_ai': 'gold_boss.py'
    }
    # Lecture du fichier...
```

### 2. Sauvegarde en base de données

Lors de l'initialisation des Boss (`init_bosses.py`), le code est :
1. Chargé depuis le fichier `.py`
2. Stocké dans le champ `Bot.code` en base de données
3. Utilisé pour les matchs via le runner standard

## Avantages de cette approche

### ✅ Maintenance facilitée
- Code Boss éditable directement dans des fichiers `.py`
- Syntax highlighting et autocomplétion dans l'IDE
- Tests unitaires possibles sur chaque stratégie

### ✅ Versioning Git
- Historique clair des modifications des stratégies
- Diffs lisibles entre versions
- Revenir facilement à une version antérieure

### ✅ Tests et débogage
- Exécuter directement les fichiers pour tester
- Debugger avec des outils Python standards
- Valider la syntaxe avant sauvegarde

### ✅ Séparation des responsabilités (SRP)
- `boss_system.py` : Logique de gestion des Boss
- `bots/boss_codes/` : Code métier des stratégies
- `models.py` : Persistence en base de données

## Modification d'un Boss

### Étape 1 : Éditer le fichier

```bash
# Éditer la stratégie du Bronze Boss
vim bots/boss_codes/bronze_boss.py
```

### Étape 2 : Tester localement (optionnel)

```bash
# Simuler une entrée de jeu et tester
echo "0 0
2
0 1 5 5 ROCK 0 0
1 0 10 10 PAPER 0 0
3
5 5 10
10 10 10
15 15 1" | python3 bots/boss_codes/bronze_boss.py
```

### Étape 3 : Re-initialiser le Boss

```bash
# Re-créer le Boss avec le nouveau code
python3 init_bosses.py --force
```

Les logs confirmeront le chargement :
```
INFO boss_system: Loaded boss code from .../bots/boss_codes/bronze_boss.py
INFO boss_system: Created Bronze Boss with ELO 1450
```

## Détails des stratégies

### Wood Boss (`wood_boss.py`)
**Stratégie** : Greedy basique
- Prioritise les super pellets (value = 10)
- Choix simple du pellet le plus proche
- Pas de coordination entre pacs

**Complexité** : O(n log n) pour le tri
**Difficulté** : Facile

### Bronze Boss (`bronze_boss.py`)
**Stratégie** : Coordination multi-pacs
- Tracking des positions visitées
- Assignation de cibles différentes (anti-collision)
- Score = value × 10 - distance_manhattan

**Complexité** : O(n × m) avec n = pacs, m = pellets
**Difficulté** : Moyen

### Silver Boss (`silver_boss.py`)
**Stratégie** : Utilisation des abilities
- SPEED activé tous les 10 tours
- Ciblage avec score = value × 10 - distance
- Gestion du cooldown des abilities

**Complexité** : O(n × m) avec max pour trouver la meilleure cible
**Difficulté** : Difficile

### Gold Boss (`gold_boss.py`)
**Stratégie** : IA adaptative
- Stratégies par pac (aggressive/collector)
- SWITCH pour contrer les types ennemis (ROCK→PAPER, etc.)
- SPEED sur longues distances
- Score = value × 15 - distance

**Complexité** : O(n × m) avec gestion des ennemis
**Difficulté** : Très difficile

## Gestion des erreurs

### Fichier manquant
```python
try:
    with open(code_path, 'r', encoding='utf-8') as f:
        code = f.read()
except FileNotFoundError:
    logger.error(f"Boss code file not found: {code_path}")
    return "# Error: Code file not found\nprint('MOVE 0 1 1')"
```

→ Fallback sur un code minimal qui évite le crash

### Stratégie inconnue
```python
if not filename:
    logger.error(f"Unknown boss strategy: {strategy}")
    return "# Error: Unknown strategy\nprint('MOVE 0 1 1')"
```

→ Code par défaut pour ne pas bloquer l'initialisation

## Commandes utiles

### Lister les codes Boss
```bash
ls -lh bots/boss_codes/
```

### Compter les lignes de code
```bash
wc -l bots/boss_codes/*.py
```

### Vérifier la syntaxe Python
```bash
python3 -m py_compile bots/boss_codes/*.py
```

### Rechercher dans les codes
```bash
grep -n "SPEED" bots/boss_codes/*.py
```

### Créer un nouveau Boss

1. Créer le fichier :
```bash
touch bots/boss_codes/platinum_boss.py
```

2. Ajouter la stratégie dans `BOSS_CONFIG` :
```python
League.PLATINUM: {
    'name': 'Platinum Boss',
    'strategy': 'ultimate_ai',
    'elo': 3000,
    'avatar': 'platinum_boss'
}
```

3. Mapper dans `_get_boss_code()` :
```python
strategy_files = {
    ...
    'ultimate_ai': 'platinum_boss.py'
}
```

## Tests

### Test de chargement
```python
from boss_system import BossSystem

code = BossSystem._get_boss_code('basic_greedy')
print(f"Code loaded: {len(code)} characters")
assert 'while True:' in code
```

### Test d'initialisation complète
```bash
python3 init_bosses.py --force
```

**Sortie attendue :**
```
INFO boss_system: Loaded boss code from .../wood_boss.py
INFO boss_system: Created Wood Boss with ELO 950
...
✅ Boss créés: 4
```

### Validation en base de données
```python
from app import app, db
from models import Bot

with app.app_context():
    bosses = Bot.query.filter(Bot.name.like('%Boss%')).all()
    for boss in bosses:
        assert len(boss.code) > 100, f"{boss.name} has empty code"
        assert 'while True:' in boss.code, f"{boss.name} missing game loop"
        print(f"✅ {boss.name}: {len(boss.code)} chars")
```

## Backup et restauration

### Sauvegarder les codes actuels
```bash
tar -czf boss_codes_backup_$(date +%Y%m%d).tar.gz bots/boss_codes/
```

### Restaurer depuis un backup
```bash
tar -xzf boss_codes_backup_20250105.tar.gz
python3 init_bosses.py --force
```

## Sécurité

### ✅ Isolation du code
- Les codes Boss sont exécutés via le même runner que les bots joueurs
- Isolation Docker disponible (si configuré)
- Timeouts et limites de ressources appliqués

### ✅ Validation
- Syntaxe Python vérifiée au chargement
- Logs détaillés en cas d'erreur
- Fallback sur code minimal si problème

### ⚠️ Accès aux fichiers
- Les fichiers sont en lecture seule pour le système de jeu
- Seul `init_bosses.py` lit ces fichiers
- Pas d'accès direct depuis l'API web

## Migration depuis l'ancien système

L'ancien système stockait le code inline dans `boss_system.py`. Le code de backup est toujours disponible dans `_get_boss_code_inline_backup()` en cas de besoin.

### Comparaison

| Aspect | Avant | Après |
|--------|-------|-------|
| Stockage | Strings Python inline | Fichiers `.py` séparés |
| Édition | Éditer `boss_system.py` | Éditer fichiers dédiés |
| Tests | Difficile | Facile (exécution directe) |
| Git diffs | Difficile à lire | Clair et structuré |
| Maintenance | Tous dans 1 fichier | 1 fichier par stratégie |

## Performance

### Chargement des codes
- **Timing** : ~1-2 ms par fichier
- **Impact** : Négligeable (chargement uniquement à l'init)
- **Cache** : Code stocké en DB après chargement

### Exécution des matchs
- **Impact** : Aucun (code déjà en DB)
- **Performance** : Identique à l'ancien système

## Évolutions futures

### 1. Validation automatique
```python
def validate_boss_code(code: str) -> bool:
    """Valide la syntaxe et la structure du code Boss."""
    try:
        compile(code, '<string>', 'exec')
        required = ['while True:', 'input()', 'print(']
        return all(req in code for req in required)
    except SyntaxError:
        return False
```

### 2. Tests automatisés
```bash
# pytest bots/boss_codes/test_boss_codes.py
def test_all_boss_codes_valid():
    for strategy in ['basic_greedy', 'multi_pac_coordinator', ...]:
        code = BossSystem._get_boss_code(strategy)
        assert len(code) > 0
        compile(code, '<string>', 'exec')
```

### 3. Hot-reload
```python
# Recharger sans redémarrer le serveur
@app.route('/api/admin/boss/<int:boss_id>/reload', methods=['POST'])
def reload_boss_code(boss_id):
    """Recharge le code d'un Boss depuis son fichier."""
    # Implementation...
```

---

**Version** : 1.0  
**Date** : 5 novembre 2025  
**Auteur** : GameArena Team
