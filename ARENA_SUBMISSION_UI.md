# Arena Submission System - Frontend Documentation

## Vue d'ensemble

Le système de soumission à l'arène sépare clairement le **Playground** (espace de développement avec brouillons) de l'**Arena** (versions compétitives soumises).

## Architecture Frontend

### Composants ajoutés

#### 1. `SubmitArenaModal.jsx`
Modal pour soumettre un bot à l'arène avec :
- **version_name** (optionnel) : nom personnalisé de la version (auto-généré si vide)
- **description** (optionnel) : notes sur cette version
- Gestion d'erreurs et état de soumission
- Boutons Annuler/Soumettre

#### 2. Modifications `PlaygroundPage.jsx`

**Nouveaux états :**
```javascript
const [isModalOpen, setIsModalOpen] = useState(false)
const [botVersionInfo, setBotVersionInfo] = useState({ latest_version_number: 0 })
```

**Nouvelles fonctions :**
- `loadBotVersionInfo(id)` : charge les infos de version du bot
- `handleSubmitToArena(formData)` : appelle l'API de soumission

**Nouveau bouton :**
- "🏆 Submit to Arena" à côté du bouton "▶ Run my code"
- Désactivé si pas de bot sauvegardé
- Ouvre le modal de soumission

**Status indicator :**
- Affiche "v{N} in Arena" si le bot a été soumis
- Affiche "Draft - not submitted" si version 0

### Styles CSS ajoutés

```css
/* Modal overlay et contenu */
.modal-overlay { /* fond semi-transparent */ }
.modal-content { /* carte modale centrée */ }

/* Badges de status */
.version-status.submitted { /* vert pour versions soumises */ }
.version-status.draft { /* jaune pour brouillons */ }
```

## Workflow utilisateur

### 1. Développement dans le Playground

```
1. L'utilisateur édite son code dans Monaco Editor
2. Auto-save sauvegarde le brouillon dans Bot.code
3. Le status affiche "Draft - not submitted"
4. Bouton "Run my code" teste contre des adversaires (is_arena_match=false)
```

### 2. Soumission à l'Arène

```
1. Clic sur "🏆 Submit to Arena"
2. Modal s'ouvre avec formulaire :
   - Version name (optionnel, placeholder: "username_vN")
   - Description (optionnel)
3. Clic sur "Soumettre"
4. API POST /api/bots/{botId}/submit-to-arena
5. Backend crée BotVersion avec Bot.latest_version_number++
6. Modal se ferme, status mis à jour : "v1 in Arena"
7. Message de succès dans les logs
```

### 3. Workflow après soumission

```
- Modifications ultérieures du code = nouveau brouillon
- Auto-save continue de sauvegarder dans Bot.code (brouillon)
- Arena utilise toujours BotVersion.code (dernière version soumise)
- Nouvelle soumission = nouvelle version (v2, v3, etc.)
```

## Endpoints API utilisés

### GET `/api/bots`
Récupère la liste des bots avec `latest_version_number`

```javascript
const res = await axios.get(`${API_BASE_URL}/api/bots`, {
  headers: { Authorization: `Bearer ${token}` }
})
```

### POST `/api/bots/{botId}/submit-to-arena`
Crée une nouvelle version pour l'arène

```javascript
const payload = {
  version_name: "my_aggressive_v1",  // optionnel
  description: "Improved pathfinding"  // optionnel
}

const res = await axios.post(
  `${API_BASE_URL}/api/bots/${botId}/submit-to-arena`, 
  payload,
  { headers: { Authorization: `Bearer ${token}` }}
)
```

**Réponse :**
```json
{
  "message": "Bot submitted to arena successfully",
  "version_name": "alice_v2",
  "version_number": 2,
  "bot_id": 1
}
```

## Gestion d'erreurs

### Erreurs affichées dans le modal

```javascript
try {
  await onSubmit(formData)
} catch (err) {
  setError(err.message || 'Erreur lors de la soumission')
}
```

**Cas d'erreurs :**
- Non authentifié (pas de token)
- Aucun bot sélectionné
- Erreur réseau
- Erreur serveur (500)

### Feedback utilisateur

**Succès :**
```
✅ Bot soumis à l'arène: alice_v2
```

**Erreur :**
```
Erreur lors de la soumission: [message d'erreur]
```

## État désactivé du bouton

Le bouton "Submit to Arena" est désactivé si :
- `!botId` : aucun bot sauvegardé
- `isCollecting` : une partie est en cours de collecte

```javascript
disabled={!botId || isCollecting}
title={!botId ? 'Sauvegardez d\'abord votre bot' : 'Soumettre cette version à l\'arène'}
```

## Intégration avec le backend

### Chargement initial

```javascript
useEffect(() => {
  if (botId) {
    loadBotVersionInfo(botId)
  }
}, [botId])
```

### Rechargement après soumission

```javascript
async function handleSubmitToArena(formData) {
  const res = await axios.post(...)
  await loadBotVersionInfo(botId)  // Recharge les infos
  setCombinedLogs(l => l + `✅ Bot soumis à l'arène: ${res.data.version_name}\n`)
}
```

## Tests recommandés

### Test 1 : Création et première soumission
```
1. Créer nouveau bot dans Playground
2. Vérifier status "Draft - not submitted"
3. Cliquer "Submit to Arena"
4. Laisser version_name vide (auto-généré)
5. Vérifier status "v1 in Arena"
6. Vérifier DB : BotVersion créé avec version_number=1
```

### Test 2 : Modifications et resoumission
```
1. Modifier le code du bot
2. Status reste "v1 in Arena" (pas encore soumis)
3. Soumettre nouvelle version avec description
4. Vérifier status "v2 in Arena"
5. Vérifier DB : 2 BotVersions, latest_version_number=2
```

### Test 3 : Gestion des erreurs
```
1. Déconnecter (supprimer token)
2. Essayer de soumettre
3. Vérifier erreur "Non authentifié"
4. Se reconnecter et réessayer
```

### Test 4 : Bouton désactivé
```
1. Aller sur Playground sans bot sauvegardé
2. Vérifier que "Submit to Arena" est grisé
3. Tooltip affiche "Sauvegardez d'abord votre bot"
4. Sauvegarder un bot
5. Bouton devient actif
```

## Prochaines étapes possibles

1. **Page Versions** : afficher l'historique des versions d'un bot
2. **Rollback** : permettre de revenir à une version précédente
3. **Diff viewer** : comparer deux versions de code
4. **Arena leaderboard** : classement basé sur les versions soumises
5. **Stats par version** : win rate, ELO evolution par version

## Fichiers modifiés

```
frontend/src/components/
├── SubmitArenaModal.jsx       (NOUVEAU)
├── PlaygroundPage.jsx          (MODIFIÉ)

frontend/src/styles.css         (MODIFIÉ - ajout styles modal)

Documentation:
├── ARENA_SUBMISSION_UI.md      (NOUVEAU)
```
