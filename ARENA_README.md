# GameArena - Système d'authentification et d'arène

## 🎯 Vue d'ensemble

Le système d'authentification et d'arène a été ajouté à GameArena pour permettre aux joueurs de :
- S'inscrire et se connecter avec un compte utilisateur
- Soumettre des bots et les faire s'affronter
- Participer à un système de classement basé sur l'ELO
- Consulter l'historique des matches

## 🔧 Installation

### Backend

1. Installer les nouvelles dépendances :
```bash
pip install -r requirements.txt
```

2. Lancer le serveur (crée automatiquement la base de données SQLite) :
```bash
python app.py
```

### Frontend

1. Installer les dépendances :
```bash
cd frontend
npm install
```

2. Lancer le serveur de développement :
```bash
npm run dev
```

## 📁 Structure des fichiers

### Backend

- `models.py` - Modèles SQLAlchemy (User, Bot, Match)
- `auth.py` - Utilitaires d'authentification JWT
- `arena.py` - Gestionnaire d'arène et matchmaking
- `gamearena.db` - Base de données SQLite (créée automatiquement)

### Frontend

- `src/contexts/AuthContext.jsx` - Context React pour l'authentification
- `src/components/LoginForm.jsx` - Formulaire de connexion
- `src/components/RegisterForm.jsx` - Formulaire d'inscription
- `src/components/ArenaPage.jsx` - Page principale de l'arène
- `src/components/Leaderboard.jsx` - Classement des bots
- `src/components/MyBots.jsx` - Gestion des bots de l'utilisateur
- `src/components/PlaygroundPage.jsx` - Interface de jeu (ancienne App.jsx)
- `src/components/ProtectedRoute.jsx` - Route protégée par authentification
- `src/AppRouter.jsx` - Configuration du routage

## 🚀 Utilisation

### 1. Créer un compte

- Accédez à `/register`
- Remplissez le formulaire (nom d'utilisateur, email, mot de passe)
- Cliquez sur "S'inscrire"

### 2. Se connecter

- Accédez à `/login`
- Entrez vos identifiants
- Vous serez redirigé vers l'arène

### 3. Soumettre un bot

- Dans l'arène, allez dans l'onglet "Mes Bots"
- Cliquez sur "+ Nouveau Bot"
- Donnez un nom à votre bot
- Entrez le code Python de votre bot
- Cliquez sur "Soumettre"

### 4. Lancer un match

- Dans "Mes Bots", cliquez sur "⚔️ Lancer un match"
- Le système trouve automatiquement un adversaire avec un ELO similaire
- Le match est créé et vous êtes redirigé vers le terrain de jeu
- Les résultats sont automatiquement enregistrés et l'ELO mis à jour

### 5. Consulter le classement

- Allez dans l'onglet "🏆 Classement"
- Voyez les meilleurs bots classés par ELO
- Minimum 5 parties jouées pour apparaître dans le classement

## 📊 Système ELO

- **ELO initial** : 1200 pour tous les nouveaux bots
- **K-factor** : 32 (maximum de points gagnés/perdus par match)
- **Matchmaking** : Les bots sont appariés avec des adversaires ayant un ELO similaire (±200)

### Calcul ELO

```
Expected_A = 1 / (1 + 10^((ELO_B - ELO_A) / 400))
New_ELO_A = ELO_A + K * (Score_A - Expected_A)
```

Où :
- Score_A = 1.0 (victoire), 0.5 (match nul), 0.0 (défaite)

## 🔐 API Endpoints

### Authentification

- `POST /api/auth/register` - Inscription
- `POST /api/auth/login` - Connexion (retourne JWT token)
- `GET /api/auth/me` - Obtenir l'utilisateur courant (requiert JWT)

### Bots

- `GET /api/bots` - Obtenir mes bots (requiert JWT)
- `POST /api/bots` - Soumettre un bot (requiert JWT)
- `GET /api/bots/<id>` - Obtenir un bot spécifique (requiert JWT)
- `POST /api/bots/<id>/deactivate` - Désactiver un bot (requiert JWT)

### Arène

- `POST /api/arena/challenge` - Lancer un match (requiert JWT)
- `GET /api/arena/leaderboard` - Obtenir le classement (public)
- `GET /api/arena/matches` - Historique des matches (requiert JWT)
- `GET /api/arena/matches/<id>` - Détails d'un match (public)

## 🔒 Sécurité

- Les mots de passe sont hashés avec bcrypt
- L'authentification utilise JWT (JSON Web Tokens)
- Les tokens expirent après 24 heures (access) / 30 jours (refresh)
- Les routes sensibles nécessitent une authentification

## 🎮 Modes de jeu

### Mode Playground (/)
- Accessible sans connexion
- Testez votre code contre un adversaire par défaut
- Pas d'enregistrement des résultats

### Mode Arena (/arena)
- Nécessite une connexion
- Soumettez des bots persistants
- Matches classés avec ELO
- Historique et statistiques

## 🛠️ Configuration

### Variables d'environnement

```bash
# app.py
SECRET_KEY=votre-clé-secrète-production
JWT_SECRET_KEY=votre-clé-jwt-production
DATABASE_URL=sqlite:///gamearena.db  # ou PostgreSQL pour production
```

## 📝 TODO / Améliorations futures

- [ ] Système de refresh token automatique
- [ ] Page de profil utilisateur
- [ ] Statistiques détaillées par bot
- [ ] Replay des matches avec visualisation
- [ ] Tournois automatiques
- [ ] Chat et commentaires
- [ ] Support de plusieurs types de jeux (Tic-Tac-Toe, etc.)
- [ ] Rate limiting pour prévenir les abus
- [ ] Email de vérification
- [ ] Réinitialisation de mot de passe
- [ ] Classement par saison

## 🐛 Debug

Pour activer les logs détaillés :

```bash
# Backend
export FLASK_ENV=development
python app.py

# Frontend
npm run dev
```

La base de données SQLite est dans `gamearena.db`. Vous pouvez l'explorer avec :

```bash
sqlite3 gamearena.db
.tables
SELECT * FROM users;
SELECT * FROM bots;
SELECT * FROM matches;
```
