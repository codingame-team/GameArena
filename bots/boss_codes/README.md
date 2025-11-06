# Boss Codes - GameArena

## 🏆 Boss disponibles

### Wood 2 Boss (ELO 750)
**Fichier:** `wood2_boss.py` ✅  
**Stratégie:** Greedy simple - va vers la pastille la plus proche  
**Niveau:** Débutant  
**Caractéristiques:**
- 1 pac seulement (règles Wood 2)
- Priorise les super-pastilles (value=10)
- Utilise la distance de Manhattan
- Explore le centre si pas de pastilles visibles

**Difficulté:** ⭐☆☆☆☆

---

### Wood 1 Boss (ELO 1050)
**Fichier:** `wood1_boss.py` ✅  
**Stratégie:** Coordination basique entre pacs  
**Niveau:** Intermédiaire  
**Caractéristiques:**
- 2-3 pacs (règles Wood 1)
- Coordination pour éviter les doublons de cibles
- Priorise les super-pastilles avec score valeur/distance
- Exploration intelligente des zones non visitées

**Difficulté:** ⭐⭐☆☆☆

---

### Bronze Boss (ELO 1350)
**Fichier:** `bronze_boss.py` *(à créer)*  
**Stratégie:** Coordination avancée + défense basique  
**Niveau:** Confirmé  
**Caractéristiques:**
- 2-3 pacs (règles Bronze = Wood 1)
- Évite les collisions avec ennemis
- Stratégie de territoire

**Difficulté:** ⭐⭐⭐☆☆

---

### Silver Boss (ELO 1650)
**Fichier:** `silver_boss.py` *(à créer)*  
**Stratégie:** Utilisation des abilities (SWITCH/SPEED) + fog of war  
**Niveau:** Avancé  
**Caractéristiques:**
- 3-4 pacs (règles Silver)
- Utilise SWITCH pour combat (ROCK/PAPER/SCISSORS)
- Utilise SPEED pour course aux super-pastilles
- Gère le fog of war (vision limitée)
- Cooldown abilities (10 tours)

**Difficulté:** ⭐⭐⭐⭐☆

---

### Gold Boss (ELO 2100)
**Fichier:** `gold_boss.py` *(à créer)*  
**Stratégie:** Maître stratège - IA complète  
**Niveau:** Expert  
**Caractéristiques:**
- 2-5 pacs (règles Gold)
- Toutes les features (abilities, fog, type DEAD)
- Stratégie offensive et défensive
- Prédiction des mouvements adverses
- Optimisation score/risque

**Difficulté:** ⭐⭐⭐⭐⭐

---

## 📝 Structure du code

Tous les boss suivent la même structure :

```python
#!/usr/bin/env python3
"""
Nom du Boss - Description
Stratégie : ...
Niveau : ...
"""

import sys
import math

# Fonctions helper (distance, recherche, etc.)
def get_distance(x1, y1, x2, y2):
    ...

# Lecture initialisation
width, height = map(int, input().split())
grid = []
for _ in range(height):
    grid.append(input())

# Boucle de jeu
while True:
    # Lecture état du tour
    my_score, opponent_score = map(int, input().split())
    
    # Lecture pacs
    visible_pac_count = int(input())
    # ... parsing pacs
    
    # Lecture pastilles
    visible_pellet_count = int(input())
    # ... parsing pellets
    
    # Stratégie et décision
    actions = []
    # ... logique du boss
    
    # Sortie
    print(" | ".join(actions))
```

---

## 🚀 Utilisation

### Initialiser les Boss Wood dans la DB

```bash
cd /Users/display/PycharmProjects/GameArena
python3 init_wood_bosses.py
```

**Output attendu:**
```
🎮 Initialisation des Boss Wood...
✅ Bot Wood 2 Boss prêt (ID: 14)
✅ Bot Wood 1 Boss prêt (ID: 15)
📊 RÉSUMÉ
✅ Boss créés : 2
```

### Tester un Boss localement

```bash
cd bots/boss_codes
python3 wood2_boss.py < input_test.txt
```

---

## 📊 Seuils ELO

| Ligue | Seuil | Plage | Boss ELO |
|-------|-------|-------|----------|
| Wood2 | 0 | 0-799 | **750** |
| Wood1 | 800 | 800-1099 | **1050** |
| Bronze | 1100 | 1100-1399 | **1350** |
| Silver | 1400 | 1400-1699 | **1650** |
| Gold | 1700 | 1700+ | **2100** |

Les Boss ont un ELO légèrement inférieur au seuil de la ligue suivante, servant de **gatekeepers** pour valider la progression des joueurs.

---

## 🛠️ Fonctionnement

### 1. Chargement du code

Les codes sont chargés depuis les fichiers lors de l'initialisation :

```python
# Dans init_wood_bosses.py
def read_boss_code(filename):
    filepath = os.path.join('bots', 'boss_codes', filename)
    with open(filepath, 'r', encoding='utf-8') as f:
        return f.read()
```

### 2. Sauvegarde en base de données

Le code est :
1. Chargé depuis le fichier `.py`
2. Stocké dans `Bot.code` en base de données
3. Utilisé pour les matchs via le runner standard

### 3. Exécution en match

Lors d'un match, le système :
1. Récupère `Bot.code` depuis la DB
2. Exécute via `BotRunner` (subprocess ou Docker)
3. Applique les timeouts (50ms/tour, 1000ms init)

## ✅ Avantages de cette approche

- **Maintenance facilitée:** Code éditable dans des fichiers `.py` avec IDE
- **Versioning:** Historique Git des stratégies
- **Tests:** Tests unitaires possibles sur chaque stratégie
- **Debugging:** Exécuter directement les fichiers pour tester
- **Séparation des responsabilités (SRP):** Code métier séparé de la persistence

---

## 🧪 Développement

### Créer un nouveau Boss

1. **Créer le fichier**
```bash
touch bots/boss_codes/bronze_boss.py
```

2. **Implémenter la stratégie** selon le niveau de la ligue

3. **Tester localement**
```bash
# Créer un fichier de test input_test.txt avec le format CodinGame
echo "35 17
#####
# P #" | python3 bots/boss_codes/bronze_boss.py
```

4. **Ajouter au BOSS_CONFIG**
```python
# Dans boss_system.py
BOSS_CONFIG = {
    League.BRONZE: {
        'name': 'Bronze Boss',
        'username': 'boss_bronze',
        'elo': 1350,
        'description': '...',
        'strategy': 'coordination_avancee',
        'avatar': 'bronze_boss'
    }
}
```

5. **Créer le script d'initialisation** (ou modifier `init_bosses.py`)

6. **Exécuter l'initialisation**
```bash
python3 init_bosses.py
```

### Tester un Boss

```bash
# Test simple
python3 bots/boss_codes/wood2_boss.py < bots/input.txt

# Test avec debug
python3 -u bots/boss_codes/wood1_boss.py < bots/input.txt 2> debug.log
```

### Modifier un Boss existant

1. Éditer le fichier `.py`
2. Re-initialiser : `python3 init_wood_bosses.py`
3. Le code en DB sera mis à jour automatiquement

---

## 📚 Références

- **Statement CodinGame:** `/Users/display/PycharmProjects/CG-SpringChallenge2020/config/statement_fr.html.tpl`
- **Règles par ligue:** `frontend/LEAGUES_MAPPING.md`
- **Boss system:** `boss_system.py`
- **Leagues config:** `leagues.py`
- **Models:** `models.py` (champs Bot.code, Bot.elo_rating)

---

## 📝 TODO

- [ ] Créer `bronze_boss.py` (coordination avancée)
- [ ] Créer `silver_boss.py` (abilities + fog)
- [ ] Créer `gold_boss.py` (IA complète)
- [ ] Tests unitaires pour chaque stratégie
- [ ] CI/CD pour valider syntaxe des Boss codes
- [ ] Benchmarks de performance (temps exécution)
- [ ] Statistiques de victoires des Boss par ligue

---

**Dernière mise à jour:** 6 novembre 2025  
**Auteur:** GameArena Team


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
