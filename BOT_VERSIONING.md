# Bot Version Management System

## Overview

GameArena now includes a comprehensive bot version management system that automatically tracks all changes to bot code. This allows players to:

- View history of all bot versions
- Compare performance across versions  
- Rollback to previous versions
- Track when changes were made

## Architecture

### Database Schema

#### `bots` table (main bot record)
- `id`: Primary key
- `user_id`: Owner of the bot
- `name`: Bot name (unique per user)
- `code`: **Current active code** (denormalized for performance)
- `version_number`: Current version number
- `elo_rating`, `match_count`, `win_count`: Current stats
- `is_active`: Whether bot is active in matchmaking
- `created_at`, `updated_at`: Timestamps

#### `bot_versions` table (version history)
- `id`: Primary key
- `bot_id`: Foreign key to `bots`
- `version_number`: Sequential version (1, 2, 3, ...)
- `code`: Code for this specific version
- `description`: Optional change description
- `match_count`, `win_count`: Stats for this version (if tracked separately)
- `created_at`: When this version was created
- **Unique constraint**: (`bot_id`, `version_number`)

### Design Decisions

1. **Denormalized Current Code**: The `bots.code` field stores the current version's code directly. This avoids JOIN queries during gameplay, which is critical for performance.

2. **Automatic Versioning**: Every time a bot's code is updated, a new `BotVersion` record is automatically created. The user doesn't need to manage versions manually.

3. **Sequential Version Numbers**: Versions use simple integers (1, 2, 3, ...) rather than UUIDs or timestamps for better UX.

4. **Rollback Creates New Version**: Rolling back to version N doesn't delete newer versions. Instead, it creates a new version (N+1) with the code from version N. This maintains a complete audit trail.

## API Endpoints

### Get All Versions
```http
GET /api/bots/<bot_id>/versions
Authorization: Bearer <token>
```

Returns all versions of a bot in descending order (newest first).

### Get Specific Version
```http
GET /api/bots/<bot_id>/versions/<version_number>
Authorization: Bearer <token>
```

Returns details of a specific version including code.

### Rollback to Version
```http
POST /api/bots/<bot_id>/rollback/<version_number>
Authorization: Bearer <token>
```

Rolls back bot to specified version by creating a new version with the old code.

### Submit/Update Bot
```http
POST /api/bots
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "MyBot",
  "code": "print('MOVE 0 3 2')",
  "description": "Fixed bug in pathfinding"  // optional
}
```

Creates a new bot or updates existing. For updates, automatically creates a new version.

## Usage Examples

### View Bot History (Python)
```python
import requests

headers = {"Authorization": f"Bearer {token}"}
response = requests.get(
    "http://localhost:3000/api/bots/1/versions",
    headers=headers
)
versions = response.json()['versions']

for v in versions:
    print(f"v{v['version_number']}: {v['description']} ({v['created_at']})")
```

### Rollback to Previous Version
```python
response = requests.post(
    "http://localhost:3000/api/bots/1/rollback/5",
    headers=headers
)
print(response.json()['message'])
# Output: "Rolled back to version 5"
```

### Update Bot with Description
```python
response = requests.post(
    "http://localhost:3000/api/bots",
    headers=headers,
    json={
        "name": "GreedyBot",
        "code": new_code,
        "description": "Improved collision avoidance"
    }
)
bot = response.json()['bot']
print(f"Updated to version {bot['version_number']}")
```

## Migration Guide

### For Existing Databases

If you have an existing database with bots:

1. Run the migration script to add the `bot_versions` table:
   ```bash
   python3 migrate_bot_versions.py
   ```

2. This will:
   - Create the `bot_versions` table
   - Create initial versions for all existing bots
   - Set `version_number = 1` for existing bots

### For New Installations

Just run:
```bash
python3 reset_database.py
```

This will create all tables with the proper schema.

## Bot Code Requirements

All bots must follow the new format rules:

### ❌ NO LONGER ALLOWED
- `STAY` command is **forbidden**
- Empty output
- Invalid command formats

### ✅ REQUIRED
- Must output `MOVE <pac_id> <x> <y>` or `MOVE <x> <y>`
- To stay in place: `MOVE <pac_id> <current_x> <current_y>`
- Must output valid coordinates

### Example Valid Bot
```python
import sys

# Read init
width, height = map(int, input().split())
for _ in range(height):
    _ = input()

# Game loop
while True:
    # Read turn input
    my_score, opp_score = map(int, input().split())
    pac_count = int(input())
    my_pac = None
    for _ in range(pac_count):
        parts = input().split()
        pac_id, mine, x, y = int(parts[0]), parts[1] != '0', int(parts[2]), int(parts[3])
        if mine:
            my_pac = (pac_id, x, y)
    
    pellet_count = int(input())
    pellets = []
    for _ in range(pellet_count):
        px, py, val = map(int, input().split())
        pellets.append((px, py))
    
    # Make move
    if my_pac and pellets:
        pac_id, px, py = my_pac
        # Go to first pellet
        print(f"MOVE {pac_id} {pellets[0][0]} {pellets[0][1]}", flush=True)
    elif my_pac:
        # No pellets, stay in place
        pac_id, px, py = my_pac
        print(f"MOVE {pac_id} {px} {py}", flush=True)
```

## Performance Considerations

- **Hot Path Optimization**: Current bot code is stored directly in `bots.code` to avoid JOINs during gameplay
- **Indexed Queries**: (`bot_id`, `version_number`) is indexed for fast lookups
- **Version Queries Rare**: Most queries (99%) only need current code, not version history

## Future Enhancements

Potential improvements:

1. **Version Comparison UI**: Show diffs between versions
2. **A/B Testing**: Run matches with different versions simultaneously
3. **Performance Analytics**: Track win rate per version
4. **Automated Testing**: Run test suite on new versions before activation
5. **Git-like Branching**: Allow experimental versions without affecting main bot

## Troubleshooting

### Bot Fails After Update
```python
# Check recent versions
versions = get_bot_versions(bot_id)
print("Recent versions:", [v['version_number'] for v in versions[:5]])

# Rollback to last working version
rollback_bot(bot_id, working_version_number)
```

### Database Migration Errors
```bash
# If migration fails, you can manually add columns:
sqlite3 gamearena.db

ALTER TABLE bots ADD COLUMN version_number INTEGER DEFAULT 1;

# Then run migration
python3 migrate_bot_versions.py
```

### Version Numbers Out of Sync
This shouldn't happen, but if it does:
```python
# Fix version numbers programmatically
from app import app
from models import db, Bot, BotVersion

with app.app_context():
    for bot in Bot.query.all():
        max_version = db.session.query(db.func.max(BotVersion.version_number)).\
            filter_by(bot_id=bot.id).scalar() or 0
        bot.version_number = max_version
    db.session.commit()
```
