# Authentication Required for Playground

## Changements effectués

### Problème résolu
Le Playground permettait l'accès invité, mais utilisait désormais le système de base de données qui nécessite une authentification JWT. Cela causait des erreurs 404 lors des tentatives de soumission à l'arène.

### Solution implémentée

#### 1. **PlaygroundPage.jsx** - Protection par authentification

**Ajouts :**
- Import de `useNavigate` pour la redirection
- États `isAuthenticated` et `isCheckingAuth`
- useEffect de vérification d'authentification au montage :
  ```javascript
  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      console.log('No authentication token - redirecting to login')
      navigate('/login?redirect=/playground')
      return
    }
    setIsAuthenticated(true)
    setIsCheckingAuth(false)
  }, [navigate])
  ```

**Écran de chargement :**
- Affiche "⏳ Vérification de l'authentification..." pendant la vérification
- Redirige vers `/login?redirect=/playground` si pas de token
- Ne rend le contenu que si `isAuthenticated === true`

**Modification `initializePlaygroundBot()` :**
```javascript
// Avant
if (!token) {
  console.log('No token - user not logged in, loading template')
  loadTemplate()
  return
}

// Après  
if (!token) {
  console.log('No token - authentication required')
  return
}
```

#### 2. **LoginForm.jsx** - Gestion de la redirection

**Ajouts :**
- Import de `useSearchParams` pour lire le paramètre `redirect`
- Redirection après login :
  ```javascript
  const redirectTo = searchParams.get('redirect') || '/arena'
  navigate(redirectTo)
  ```

**Message informatif :**
- Si redirigé depuis le Playground (`?redirect=/playground`)
- Affiche un bandeau jaune : 🔒 "Le Playground nécessite une authentification"

## Workflow utilisateur

### Cas 1 : Utilisateur non connecté accède au Playground

```
1. Utilisateur visite /playground
2. PlaygroundPage détecte pas de token
3. Redirection vers /login?redirect=/playground
4. LoginForm affiche message: "Le Playground nécessite une authentification"
5. Utilisateur se connecte
6. Redirection automatique vers /playground
7. Bot créé automatiquement en DB
```

### Cas 2 : Utilisateur déjà connecté

```
1. Utilisateur visite /playground
2. Token détecté → isAuthenticated = true
3. initializePlaygroundBot() charge ou crée bot en DB
4. Accès immédiat à l'éditeur et toutes les fonctionnalités
```

### Cas 3 : Token expiré/invalide

```
1. Token présent mais invalide
2. Tentative de chargement du bot → erreur 401
3. Bot non chargé, mais page accessible
4. Première sauvegarde → erreur "No token found"
5. Utilisateur doit se reconnecter manuellement
```

## Avantages

✅ **Sécurité** : Seuls les utilisateurs authentifiés peuvent créer/modifier des bots
✅ **Cohérence** : Playground et Arena utilisent le même système d'authentification
✅ **UX** : Message clair expliquant pourquoi l'authentification est requise
✅ **Redirection** : Retour automatique au Playground après connexion
✅ **Persistance** : Bot IDs stockés en DB, pas de fichiers temporaires

## Limitations actuelles

⚠️ **Pas de détection d'expiration token** : Si le token expire pendant l'utilisation, l'utilisateur doit manuellement rafraîchir la page ou se reconnecter.

**Solution future** : Ajouter un intercepteur Axios pour détecter les 401 et rediriger automatiquement.

## Tests recommandés

### Test 1 : Accès non authentifié
```
1. Supprimer token: localStorage.removeItem('token')
2. Aller sur /playground
3. ✓ Redirection vers /login?redirect=/playground
4. ✓ Message "Le Playground nécessite une authentification"
```

### Test 2 : Login et redirection
```
1. Se connecter depuis la page /login?redirect=/playground
2. ✓ Redirection automatique vers /playground
3. ✓ Bot créé automatiquement (voir "My Playground Bot" en DB)
4. ✓ Auto-save fonctionne
```

### Test 3 : Submit to Arena
```
1. Connecté, éditer code dans Playground
2. Cliquer "🏆 Submit to Arena"
3. ✓ Modal s'ouvre
4. ✓ Soumission réussie (POST /api/bots/{id}/submit-to-arena avec JWT)
5. ✓ Status mis à jour "v1 in Arena"
```

### Test 4 : Utilisateur déjà connecté
```
1. Token valide en localStorage
2. Aller sur /playground
3. ✓ Pas de redirection
4. ✓ Chargement du bot existant si gamearena_bot_id présent
5. ✓ Création d'un nouveau bot sinon
```

## Fichiers modifiés

```
frontend/src/components/
├── PlaygroundPage.jsx       (MODIFIÉ - auth guard)
├── LoginForm.jsx            (MODIFIÉ - redirect handling)

Documentation:
├── PLAYGROUND_AUTH_REQUIRED.md   (NOUVEAU)
```

## Endpoints utilisés

- `GET /api/bots` - Liste des bots (requires auth)
- `POST /api/bots` - Créer bot (requires auth)
- `GET /api/bots/{id}` - Charger bot (requires auth)
- `PUT /api/bots/{id}/save` - Sauvegarder brouillon (requires auth)
- `POST /api/bots/{id}/submit-to-arena` - Soumettre version (requires auth)

Tous nécessitent le header : `Authorization: Bearer <JWT_TOKEN>`
