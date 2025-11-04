# GameArena - Architecture Frontend (Post-Refactoring)

**Version** : 2.0 (après Phase 3)  
**Date** : 4 novembre 2025  
**Framework** : React 18.2.0 + Vite

---

## 📐 Vue d'ensemble

L'architecture frontend suit les principes **SOLID** avec une séparation claire entre :
- **Hooks métier** : Business logic, state management, API calls
- **Composants UI** : Presentation, affichage uniquement
- **Services** : Configuration centralisée

```
┌─────────────────────────────────────────────────────────────┐
│                     PlaygroundPage.jsx                       │
│                  (471 lignes - Orchestration)                │
└────────┬────────────────────────────────────────────────────┘
         │
    ┌────┴────┐
    │         │
┌───▼───┐ ┌──▼──────────────────────────────────────────┐
│ Hooks │ │              Composants UI                   │
└───┬───┘ └──┬──────────────────────────────────────────┘
    │        │
    │   ┌────┴─────┬──────────────┬─────────────┐
    │   │          │              │             │
    │   ▼          ▼              ▼             ▼
    │ Editor  GameControls  Visualizer  BotStderr
    │  Panel     Panel
    │            │
    │       ┌────┴─────┬────────────┐
    │       │          │            │
    │       ▼          ▼            ▼
    │    BotSel   Options      Actions
    │    Panel     Panel
    │
    └─► API Calls (axios)
```

---

## 🎣 Hooks Métier (Business Logic Layer)

### 1. `useBotManagement.js` (235 lignes)

**Responsabilité** : Gestion complète des bots utilisateur

**État géré** :
```javascript
{
  code: string,              // Code du bot
  botId: number | null,      // ID du bot courant
  saveStatus: 'idle'|'saving'|'saved'|'error',
  botVersionInfo: {
    latest_version_number: number
  }
}
```

**Actions exposées** :
```javascript
{
  handleCodeChange,          // Change code + auto-save (debounce 1.5s)
  resetCode,                 // Reset au template
  initializePlaygroundBot,   // Load ou create bot au mount
  submitToArena,             // Soumission version à l'arène
  saveBotNow,                // Save immédiat (sans debounce)
  loadTemplate               // Charge template par défaut
}
```

**Flux d'exécution** :
```
1. Mount → initializePlaygroundBot()
   ├─→ GET /api/bots/my
   ├─→ Si bot existe → setCode(bot.code)
   └─→ Sinon → POST /api/bots + setCode(template)

2. User tape code → handleCodeChange(newCode)
   ├─→ setCode(newCode)
   └─→ setTimeout(() => saveBotNow(), 1500ms)  // Debounce

3. User reset → resetCode()
   ├─→ GET /api/template
   └─→ saveBotNow(template)

4. User submit → submitToArena(versionName, desc)
   └─→ POST /api/bots/{id}/submit-to-arena
```

**Dépendances** :
- `axios` : API calls
- `API_BASE_URL` : Configuration centralisée
- localStorage : Token JWT

---

### 2. `useBotSelection.js` (248 lignes)

**Responsabilité** : Sélection des joueurs et gestion des avatars

**État géré** :
```javascript
{
  selectedLanguage: 'python',
  availableBots: Bot[],       // Liste tous les bots arène
  selectedPlayer1: 'bot:X' | null,
  selectedPlayer2: 'Boss' | 'bot:Y',
  capturedPlayer1Name: string,
  capturedPlayer2Name: string,
  userAvatar: string,         // Nom avatar (ex: 'my_bot')
  customAvatarBlobUrl: string | null,  // Blob URL avatar custom
  currentUser: User | null,
  botOwnerAvatars: { [botId]: blobUrl }
}
```

**Actions exposées** :
```javascript
{
  setSelectedPlayer1,
  setSelectedPlayer2,
  getPlayerName,              // Récupère nom d'affichage
  getAvatarUrl,               // Récupère URL avatar (SVG ou Blob)
  capturePlayerNames,         // Freeze les noms au start
  loadAvailableBots,          // Charge liste + auto-select P1
  loadCurrentUserAvatar       // Charge avatar custom user
}
```

**Gestion des avatars** :
```
Types d'avatars :
1. SVG par défaut : /avatars/{name}.svg
   - my_bot, boss, archer, ninja, wizard, etc.

2. Custom uploadés : instance/avatars/{user_id}.{ext}
   - Via API: /api/user/{user_id}/avatar/image
   - Retour: Blob → createObjectURL()
   - Stockage: botOwnerAvatars[botId] = blobUrl

Priorité :
1. Si bot de l'user courant → customAvatarBlobUrl
2. Si autre bot → botOwnerAvatars[botId]
3. Si owner_avatar défini → /avatars/{owner_avatar}.svg
4. Fallback → /avatars/my_bot.svg
```

**Flux d'exécution** :
```
1. Mount → loadAvailableBots()
   ├─→ GET /api/bots?all=true  // TOUS les bots arène
   ├─→ loadBotOwnerAvatars(bots)
   │   └─→ Pour chaque bot avec custom avatar
   │       └─→ GET /api/user/{user_id}/avatar/image
   ├─→ GET /api/bots/my
   └─→ setSelectedPlayer1(`bot:${userBot.id}`)  // Auto-select

2. Mount → loadCurrentUserAvatar()
   ├─→ GET /api/user/profile
   └─→ Si avatar custom
       └─→ GET /api/user/avatar/image
           └─→ setCustomAvatarBlobUrl(blobUrl)

3. User clique avatar → Modal ouvre
4. User sélectionne bot → setSelectedPlayer1/2('bot:X')
5. Before game start → capturePlayerNames()  // Freeze noms
```

---

### 3. `useGamePlayback.js` (311 lignes)

**Responsabilité** : Gestion du jeu (collection, animation, playback)

**État géré** :
```javascript
{
  gameId: string | null,
  history: HistoryEntry[],    // Historique affiché
  fullHistory: any[],         // Historique complet collecté
  currentIndex: number,       // Index du tour affiché
  combinedLogs: string,
  animationDelay: number,     // ms entre tours
  
  // États booléens
  isCollecting: boolean,
  isPaused: boolean,
  isAnimating: boolean,
  
  // Refs (pas de re-render)
  collectingRef: MutableRefObject,
  animatingRef: MutableRefObject,
  pausedRef: MutableRefObject,
  stoppedRef: MutableRefObject,
  animationDelayRef: MutableRefObject
}
```

**Actions exposées** :
```javascript
{
  startGame,                  // Lance une nouvelle partie
  togglePlayPause,            // Play/Pause animation
  stopPlayback,               // Stop et reset
  seekToIndex,                // Cherche un tour spécifique
  handleSeek,                 // Handler slider
  getTotalTurns,              // Nombre de tours total
  progressRatio,              // Ratio progression (0-1)
  setAnimationDelay           // Change vitesse
}
```

**Intégration useGameRunner** :
```javascript
// useGamePlayback encapsule useGameRunner (DIP)
const { collectFullHistory, animateCollected } = useGameRunner({
  API_BASE_URL,
  appendLog: (msg) => console.log(msg),
  collectingRef,
  animatingRef,
  pausedRef,
  stoppedRef,
  animationDelayRef,
  setIsCollecting,
  setIsAnimating,
  setIsPaused,
  setHistory,
  setFullHistory,
  setCombinedLogs,
  setCurrentIndex
})
```

**Flux d'exécution** :
```
1. User clique "Run" → startGame(payload)
   ├─→ POST /api/games { referee, bot1, bot2, mode }
   ├─→ Reçoit game_id
   ├─→ collectFullHistory(game_id)
   │   └─→ Boucle POST /api/games/{id}/step
   │       └─→ Jusqu'à finished=true
   └─→ animateCollected(collected, 0)
       └─→ Boucle affichage avec delay
           └─→ setCurrentIndex(i++)

2. User clique Play/Pause → togglePlayPause()
   ├─→ Si paused → Resume animation
   └─→ Si playing → pausedRef.current = true

3. User déplace slider → handleSeek(value)
   ├─→ stopPlaybackPreserveState()  // Stop animation
   └─→ seekToIndex(value)            // Jump to index

4. User change speed → setAnimationDelay(ms)
   └─→ animationDelayRef.current = ms  // Pas de re-render
```

---

### 4. Hooks UI (`useTheme`, `usePanelLayout`, `useStatus`)

**useTheme** : Gestion thème clair/sombre
```javascript
{
  theme: 'light' | 'dark',
  setTheme: (theme) => void
}
```

**usePanelLayout** : Gestion splitters
```javascript
{
  leftPanelRatio: number,     // 0-1
  rowRatio: number,           // 0-1
  leftContainerRef: Ref,
  startDrag: () => void,
  endDrag: () => void
}
```

**useStatus** : Health check backend
```javascript
{
  backendStatus: 'ok' | 'error',
  dockerStatus: 'ok' | 'error',
  checkAll: () => Promise<void>
}
```

---

## 🧩 Composants UI (Presentation Layer)

### Architecture hiérarchique

```
PlaygroundPage.jsx (471 lignes)
│
├── Left Column
│   ├── Visualizer.jsx (existant, inchangé)
│   └── BotStderrPanel.jsx (existant, inchangé)
│
└── Right Column
    ├── EditorPanel.jsx (111 lignes)
    │   └── MonacoEditor.jsx
    │
    └── GameControlsPanel.jsx (160 lignes)
        ├── BotSelectionPanel.jsx (317 lignes)
        │   ├── PlayerAvatar × 2
        │   └── PlayerSelectionModal
        │
        ├── OptionsPanel.jsx (88 lignes)
        │   ├── StatusBar.jsx
        │   ├── ThemeToggle.jsx
        │   └── SpeedSelector
        │
        └── Actions
            ├── Run button
            └── Submit to Arena button
```

---

### 1. `EditorPanel.jsx` (111 lignes)

**Responsabilité** : Panel éditeur de code

**Props** :
```javascript
{
  code: string,
  onChange: (code: string) => void,
  language: string,           // 'python'
  theme: 'light' | 'dark',
  canReset: boolean,          // !!botId
  onReset: () => void,
  saveStatus: 'idle'|'saving'|'saved'|'error',
  botId: number | null
}
```

**Structure** :
```jsx
<div className="frame" style={{ flex: 1, minHeight: 0 }}>
  {/* Header */}
  <div>
    <h3>Code Editor</h3>
    <button onClick={onReset}>🔄 Reset my code</button>
  </div>
  
  {/* Editor */}
  <div style={{ flex: 1, minHeight: 0 }}>
    <MonacoEditor value={code} onChange={onChange} />
  </div>
  
  {/* Footer (optionnel) */}
  {(saveStatus !== 'idle' || botId) && (
    <div>
      <span>Bot ID: {botId}</span>
      <span>{saveStatus}</span>
    </div>
  )}
</div>
```

**CSS critique** :
```css
/* Parent must have height defined */
.right-column {
  display: flex;
  flex-direction: column;
  height: 100%;
}

/* EditorPanel takes remaining space */
div.frame {
  flex: 1;
  minHeight: 0;         /* Allow shrinking */
  overflow: visible;    /* Override .frame { overflow: hidden } */
}

/* Monaco wrapper */
.monaco-wrapper {
  flex: 1;
  height: 100%;         /* Required for Monaco */
  position: relative;   /* Fix positioning bugs */
}
```

---

### 2. `GameControlsPanel.jsx` (160 lignes)

**Responsabilité** : Orchestration des contrôles de jeu

**Props** :
```javascript
{
  // Bot selection
  selectedPlayer1, selectedPlayer2,
  onSelectPlayer1, onSelectPlayer2,
  onClearPlayer1, onClearPlayer2,
  getPlayerName, getAvatarUrl, availableBots,
  
  // Options
  backendStatus, dockerStatus,
  theme, onThemeChange,
  animationDelay, onSpeedChange,
  
  // Actions
  isCollecting, botId, botVersionInfo,
  onRunCode, onSubmitToArena
}
```

**Layout** :
```jsx
<div className="frame controls-frame" style={{ 
  display: 'flex', 
  flexDirection: 'row',
  justifyContent: 'space-between'
}}>
  {/* SECTION 1: Bot Selection (LEFT) */}
  <BotSelectionPanel ... />
  
  {/* SECTION 2: Options (CENTER) */}
  <OptionsPanel ... />
  
  {/* SECTION 3: Actions (RIGHT) */}
  <div>
    <button onClick={onRunCode}>▶ Run my code</button>
    <button onClick={onSubmitToArena}>🏆 Submit to Arena</button>
    <div>Bot ID: {botId} | Version: {botVersionInfo.latest_version_number}</div>
  </div>
</div>
```

---

### 3. `BotSelectionPanel.jsx` (317 lignes)

**Responsabilité** : Sélection des joueurs avec avatars

**Props** :
```javascript
{
  selectedPlayer1, selectedPlayer2,
  onSelectPlayer1, onSelectPlayer2,
  onClearPlayer1, onClearPlayer2,
  getPlayerName, getAvatarUrl,
  availableBots: Bot[]
}
```

**Sous-composants** :
1. **PlayerAvatar** : Affiche un avatar cliquable
2. **PlayerSelectionModal** : Modal de sélection avec liste bots

**Structure** :
```jsx
<>
  <div>
    <h4>JOUEURS</h4>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
      <PlayerAvatar
        playerId={selectedPlayer1}
        playerName={getPlayerName(selectedPlayer1)}
        avatarUrl={getAvatarUrl(selectedPlayer1)}
        onSelect={() => setShowPlayerModal('player1')}
        onClear={onClearPlayer1}
      />
      
      <PlayerAvatar
        playerId={selectedPlayer2}
        playerName={getPlayerName(selectedPlayer2)}
        avatarUrl={getAvatarUrl(selectedPlayer2)}
        onSelect={() => setShowPlayerModal('player2')}
        onClear={onClearPlayer2}
      />
    </div>
  </div>
  
  {showPlayerModal && (
    <PlayerSelectionModal
      availableBots={availableBots}
      onSelectBot={handleSelectBot}
      onClose={() => setShowPlayerModal(null)}
    />
  )}
</>
```

---

### 4. `OptionsPanel.jsx` (88 lignes)

**Responsabilité** : Regroupement options (status, theme, speed)

**Props** :
```javascript
{
  backendStatus: 'ok' | 'error',
  dockerStatus: 'ok' | 'error',
  theme: 'light' | 'dark',
  onThemeChange: (theme) => void,
  animationDelay: number,
  onSpeedChange: (delay) => void
}
```

**Structure** :
```jsx
<div>
  <h4>OPTIONS</h4>
  
  {/* Status */}
  <StatusBar
    backendStatus={backendStatus}
    dockerStatus={dockerStatus}
  />
  
  {/* Theme */}
  <ThemeToggle theme={theme} onChange={onThemeChange} />
  
  {/* Speed */}
  <div>
    <label>Speed:</label>
    <select value={animationDelay} onChange={onSpeedChange}>
      <option value={100}>Very Fast</option>
      <option value={500}>Normal</option>
      <option value={1000}>Slow</option>
    </select>
  </div>
</div>
```

---

## 🔌 Services & Configuration

### `config.js`

```javascript
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:3000'
```

**Variables d'environnement** :
- `VITE_API_BASE_URL` : URL du backend Flask (défaut: localhost:3000)

### Authentification (JWT)

**Storage** :
```javascript
localStorage.getItem('token')    // Récupération
localStorage.setItem('token', jwt)  // Stockage
```

**Headers axios** :
```javascript
{
  headers: { 
    Authorization: `Bearer ${token}` 
  }
}
```

**Redirect si non authentifié** :
```javascript
useEffect(() => {
  const token = localStorage.getItem('token')
  if (!token) {
    window.location.href = '/login?redirect=/playground'
  }
  setIsAuthenticated(true)
}, [])
```

---

## 📊 Flux de données (Data Flow)

### Chargement initial (Mount)

```
1. PlaygroundPage mount
   │
   ├─→ useBotManagement.initializePlaygroundBot()
   │   └─→ GET /api/bots/my → setCode(bot.code)
   │
   ├─→ useBotSelection.loadAvailableBots()
   │   ├─→ GET /api/bots?all=true → setAvailableBots(bots)
   │   ├─→ loadBotOwnerAvatars(bots)
   │   └─→ GET /api/bots/my → setSelectedPlayer1(`bot:${id}`)
   │
   └─→ useBotSelection.loadCurrentUserAvatar()
       └─→ GET /api/user/profile
           └─→ GET /api/user/avatar/image → setCustomAvatarBlobUrl(blob)
```

### Édition de code

```
User tape dans Monaco
   │
   ├─→ MonacoEditor.onChange(newCode)
   │
   ├─→ EditorPanel.onChange(newCode)
   │
   └─→ useBotManagement.handleCodeChange(newCode)
       ├─→ setCode(newCode)          // Update UI immédiat
       └─→ setTimeout(() => {
             saveBotNow(newCode)      // Debounce 1.5s
           }, 1500)
           └─→ PUT /api/bots/{id}/save
```

### Lancement d'une partie

```
User clique "Run my code"
   │
   ├─→ PlaygroundPage.handleRunCode()
   │   ├─→ Validation (P1 && P2 sélectionnés)
   │   ├─→ useBotSelection.capturePlayerNames()  // Freeze noms
   │   └─→ payload = { referee: 'pacman', bot1, bot2, mode }
   │
   └─→ useGamePlayback.startGame(payload)
       ├─→ POST /api/games → { game_id }
       │
       ├─→ collectFullHistory(game_id)
       │   └─→ Loop POST /api/games/{id}/step
       │       └─→ Until finished=true
       │
       └─→ animateCollected(collected, 0)
           └─→ Loop setCurrentIndex(i++)
               └─→ Visualizer re-render à chaque index
```

### Sélection d'un bot

```
User clique sur avatar Player 1
   │
   ├─→ BotSelectionPanel.setShowPlayerModal('player1')
   │   └─→ PlayerSelectionModal s'ouvre
   │
User clique sur un bot dans la modal
   │
   ├─→ PlayerSelectionModal.handleSelectBot('bot:5')
   │
   ├─→ BotSelectionPanel.onSelectPlayer1('bot:5')
   │
   └─→ PlaygroundPage.setSelectedPlayer1('bot:5')
       └─→ useBotSelection.setSelectedPlayer1('bot:5')
           └─→ Re-render avec nouvel avatar
```

---

## 🎨 CSS & Styling

### Layout principal

```css
/* Root app grid */
.app-grid {
  display: grid;
  grid-template-columns: 50% 50%;  /* Dynamic via inline styles */
  grid-template-rows: 1fr;
  height: calc(100vh - 64px);      /* Full height - header */
  gap: 12px;
  padding: 12px;
}

/* Columns */
.left-column {
  display: grid;
  grid-template-rows: 60% 40%;     /* Dynamic via inline styles */
  gap: 12px;
}

.right-column {
  display: flex;                   /* Override .frame grid */
  flex-direction: column;
  gap: 12px;
  height: 100%;
}
```

### Frame styling

```css
.frame {
  background: var(--frame-bg);
  border-radius: 6px;
  padding: 12px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.05);
  overflow: hidden;                /* ⚠️ Override avec inline si besoin */
  min-height: 0;
  display: flex;
  flex-direction: column;
}
```

### Variables CSS (theme)

```css
:root {
  --frame-bg: #fff;
  --text: #333;
}

[data-theme="dark"] {
  --frame-bg: #2d2d2d;
  --text: #eee;
}
```

---

## 🧪 Testing Strategy

### Tests unitaires (À implémenter)

**Hooks** :
```javascript
// useBotManagement.test.js
import { renderHook, act } from '@testing-library/react'
import { useBotManagement } from './useBotManagement'

test('handleCodeChange should debounce save', async () => {
  const { result } = renderHook(() => useBotManagement())
  
  act(() => {
    result.current.handleCodeChange('new code')
  })
  
  expect(result.current.code).toBe('new code')
  // Wait for debounce...
  // Assert API call made
})
```

**Composants** :
```javascript
// EditorPanel.test.jsx
import { render, fireEvent } from '@testing-library/react'
import EditorPanel from './EditorPanel'

test('reset button calls onReset', () => {
  const onReset = jest.fn()
  const { getByText } = render(
    <EditorPanel onReset={onReset} canReset={true} />
  )
  
  fireEvent.click(getByText(/reset/i))
  expect(onReset).toHaveBeenCalled()
})
```

### Tests d'intégration

**Flow complet** :
1. Mount → Bots chargés
2. Édition code → Auto-save
3. Sélection joueurs → Avatars
4. Run game → Animation
5. Submit arena → Confirmation

---

## 🚀 Performance

### Optimisations actuelles

1. **useCallback** : Toutes les fonctions stables
2. **Refs** : États qui ne nécessitent pas re-render (animation)
3. **Debounce** : Auto-save code (1.5s)
4. **Lazy loading** : Avatars chargés uniquement si custom

### Optimisations futures

1. **React.memo** : Composants purs (Visualizer, PlayerAvatar)
2. **useMemo** : Calculs coûteux (getPlayerName, getAvatarUrl)
3. **Code splitting** : Lazy import Monaco
4. **Virtual scrolling** : Liste des bots si > 100

---

## 📚 Références

- [React 18 Documentation](https://react.dev/)
- [Vite Guide](https://vitejs.dev/)
- [Monaco Editor](https://microsoft.github.io/monaco-editor/)
- [SOLID Principles](https://en.wikipedia.org/wiki/SOLID)

---

**Dernière mise à jour** : 4 novembre 2025  
**Mainteneur** : Équipe GameArena  
**Statut** : ✅ Production Ready
