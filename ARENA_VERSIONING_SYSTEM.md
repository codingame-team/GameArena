# Système de Gestion des Versions de Bots - Architecture

## 📋 Vue d'ensemble

Le système distingue clairement deux types de code de bot :
1. **Code en développement** (Playground) - brouillon de travail édité dans Monaco
2. **Versions soumises** (Arena) - versions officielles pour la compétition

## 🎯 Fonctionnalités

### Playground (Développement)
- ✏️ **Édition libre** dans Monaco Editor
- 💾 **Sauvegarde automatique** du code de travail
- ▶️ **Tests locaux** contre l'adversaire par défaut
- ❌ **Pas de versioning** - c'est un brouillon

### Arena (Compétition)
- 🚀 **Soumission explicite** crée une nouvelle version
- 🏷️ **Nom de version** personnalisable ou auto-généré
- 📊 **Suivi des performances** par version
- 🔒 **Historique complet** de toutes les soumissions

## 🗄️ Schéma de Base de Données

### Table `bots`
```sql
CREATE TABLE bots (
    id INTEGER PRIMARY KEY,
    user_id INTEGER,
    name VARCHAR(100),
    code TEXT,                    -- CODE BROUILLON (Playground)
    latest_version_number INTEGER DEFAULT 0,  -- Dernière version soumise
    is_active BOOLEAN DEFAULT FALSE,  -- Actif dans l'Arena après 1ère soumission
    elo_rating INTEGER DEFAULT 1200,
    match_count INTEGER DEFAULT 0,
    win_count INTEGER DEFAULT 0,
    ...
)
```

### Table `bot_versions`
```sql
CREATE TABLE bot_versions (
    id INTEGER PRIMARY KEY,
    bot_id INTEGER,
    version_number INTEGER,       -- 1, 2, 3, ...
    version_name VARCHAR(100),    -- "alice_v1", "SuperBot v2", etc.
    code TEXT,                    -- CODE SOUMIS (Arena)
    description VARCHAR(500),
    match_count INTEGER DEFAULT 0,
    win_count INTEGER DEFAULT 0,
    created_at DATETIME,
    UNIQUE(bot_id, version_number)
)
```

## 🔄 Flux de Travail

### 1. Création d'un Bot
```
POST /api/bots
{
  "name": "MonBot",
  "code": "# Code initial optionnel"
}
```
→ Crée un bot avec `latest_version_number = 0` (pas encore soumis)

### 2. Sauvegarde en Playground (Fréquent)
```
PUT /api/bots/{bot_id}/save
{
  "code": "# Nouveau code en développement"
}
```
→ Met à jour `bots.code` uniquement
→ **Aucune version créée**

### 3. Soumission à l'Arena (Rare)
```
POST /api/bots/{bot_id}/submit-to-arena
{
  "version_name": "SuperBot v2",  // Optionnel
  "description": "Amélioration pathfinding"  // Optionnel
}
```
→ Crée un enregistrement `BotVersion`
→ Incrémente `bots.latest_version_number`
→ Active le bot dans l'Arena (`is_active = true`)

### 4. Test en Playground vs Compétition Arena

#### Playground (Test)
```javascript
// Dans le frontend Playground
createGame({
  player_code: currentCode,  // Code Monaco
  opponent: botId,
  is_arena_match: false  // ← Important !
})
```
→ Backend utilise `Bot.code` (brouillon) pour l'adversaire

#### Arena (Compétition)
```javascript
// Challenge officiel
challengeBot({
  my_bot_id: myBotId,
  opponent_bot_id: opponentBotId,
  is_arena_match: true  // ← Important !
})
```
→ Backend utilise `BotVersion.code` (version soumise)

## 🎨 Interface Utilisateur (Proposée)

### Playground
```
┌─────────────────────────────────────────┐
│  MonBot                          [Save] │
│  Working Draft - Not submitted yet      │
├─────────────────────────────────────────┤
│                                         │
│  [Monaco Editor]                        │
│                                         │
│                                         │
├─────────────────────────────────────────┤
│  [Test vs AI]  [Submit to Arena] ────┐ │
│                                        │ │
│  ┌─────────────────────────────────┐  │ │
│  │ Submit to Arena                 │  │ │
│  │                                 │  │ │
│  │ Version name (optional):        │  │ │
│  │ [alice_v2____________]          │  │ │
│  │                                 │  │ │
│  │ Description (optional):         │  │ │
│  │ [Improved collision avoidance_] │  │ │
│  │                                 │  │ │
│  │ [Cancel]  [Submit]              │  │ │
│  └─────────────────────────────────┘  │ │
└────────────────────────────────────────┘ │
```

### Arena (Bot List)
```
┌───────────────────────────────────────────────┐
│  My Bots                                      │
├───────────────────────────────────────────────┤
│                                               │
│  MonBot (v3) ★ 1425 ELO                      │
│    ├─ v3: alice_v3 (active) - 12W 5L         │
│    ├─ v2: alice_v2 - 8W 8L                   │
│    └─ v1: alice_v1 - 2W 10L                  │
│                                               │
│  AnotherBot (v1) ★ 1200 ELO                  │
│    └─ v1: alice_AnotherBot_v1 (active)       │
│                                               │
└───────────────────────────────────────────────┘
```

## 📡 Endpoints API

### Bot Management
```
POST   /api/bots                      - Créer un nouveau bot
GET    /api/bots                      - Lister mes bots
GET    /api/bots/{id}                 - Détails d'un bot
PUT    /api/bots/{id}/save            - Sauvegarder code (Playground)
POST   /api/bots/{id}/deactivate      - Désactiver de l'Arena
```

### Version Management
```
POST   /api/bots/{id}/submit-to-arena  - Soumettre à l'Arena (crée version)
GET    /api/bots/{id}/versions         - Lister toutes les versions
GET    /api/bots/{id}/versions/{num}   - Détails d'une version
POST   /api/bots/{id}/rollback/{num}   - Rollback (crée nouvelle version)
```

### Matchmaking
```
POST   /api/arena/challenge            - Défier un bot (Arena)
GET    /api/arena/leaderboard          - Classement ELO
GET    /api/arena/matches              - Historique des matches
```

## 🔐 Règles de Sécurité

1. **Code brouillon privé** : Seul le propriétaire voit `Bot.code`
2. **Versions soumises visibles** : Tout le monde peut voir les `BotVersion` (fair-play)
3. **Tests Playground privés** : Pas de record dans `matches` table
4. **Matches Arena publics** : Enregistrés dans `matches` avec résultats

## 🚀 Migration depuis l'ancien système

```bash
# Si base existante avec ancien schéma
python3 migrate_arena_system.py
```

Effectue automatiquement :
- Renomme `Bot.version_number` → `Bot.latest_version_number`
- Ajoute `BotVersion.version_name`
- Génère noms pour versions existantes
- Calcule `latest_version_number` pour chaque bot

## 💡 Cas d'Usage

### Développement itératif
1. Créer bot : `POST /api/bots`
2. Coder + sauvegarder 20 fois : `PUT /api/bots/{id}/save`
3. Tester localement vs AI
4. Soumettre à l'Arena : `POST /api/bots/{id}/submit-to-arena`
5. Répéter 2-4

### Nom de version automatique
Si `version_name` non fourni lors de la soumission :
```
alice_v1, alice_v2, alice_v3, ...
```

### Nom de version personnalisé
```json
{
  "version_name": "SuperBot Final",
  "description": "Version pour la finale du tournoi"
}
```

## 📊 Avantages du Système

✅ **Séparation claire** : Playground ≠ Arena  
✅ **Flexibilité** : Sauvegardez sans polluer l'historique  
✅ **Traçabilité** : Historique complet des soumissions  
✅ **Performance** : Pas de JOIN pour code courant  
✅ **Clarté** : Le joueur sait quand il soumet "pour de vrai"  
✅ **Nommage** : Versions identifiables ("v2.1 Final")  
✅ **Fair-play** : Code Arena visible par tous (après soumission)  

## 🔧 Maintenance

### Nettoyer anciennes versions (si besoin)
```python
# Garder seulement les 10 dernières versions par bot
from app import app
from models import db, BotVersion

with app.app_context():
    bots = Bot.query.all()
    for bot in bots:
        versions = BotVersion.query.filter_by(bot_id=bot.id)\
            .order_by(BotVersion.version_number.desc())\
            .offset(10).all()
        for v in versions:
            db.session.delete(v)
    db.session.commit()
```

### Statistiques
```sql
-- Nombre de versions par utilisateur
SELECT u.username, COUNT(bv.id) as version_count
FROM users u
JOIN bots b ON u.id = b.user_id
JOIN bot_versions bv ON b.id = bv.bot_id
GROUP BY u.username
ORDER BY version_count DESC;

-- Performance par version
SELECT bv.version_name, bv.match_count, bv.win_count,
       ROUND(100.0 * bv.win_count / bv.match_count, 1) as win_rate
FROM bot_versions bv
WHERE bv.match_count > 0
ORDER BY win_rate DESC;
```
