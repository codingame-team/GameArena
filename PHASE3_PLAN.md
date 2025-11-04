# 🎨 Phase 3 - Refactoring PlaygroundPage.jsx

**Date**: 4 novembre 2025  
**Objectif**: Réduire PlaygroundPage.jsx de 1199 lignes à ~400 lignes en extrayant la logique dans des hooks et composants réutilisables.

---

## 📊 Analyse État Actuel

### Statistiques
- **Lignes totales**: 1199
- **États locaux**: ~30+ useState/useRef
- **useEffect**: ~10+
- **Fonctions**: ~20+
- **Responsabilités**: Multiples (violation SRP)

### Problèmes Identifiés

**1. Violation SRP** 
Le composant gère :
- ✅ Authentification
- ✅ Gestion thème (light/dark)
- ✅ État du bot (code, sauvegarde)
- ✅ Logique jeu (collecte, animation)
- ✅ Layout (splitters, panels)
- ✅ Sélection bots adversaires
- ✅ Soumission arène
- ✅ Logs et debug
- ✅ Status backend/docker

**2. État Dispersé**
~30 variables d'état non groupées logiquement

**3. Logique Métier dans UI**
Beaucoup de logique devrait être dans des hooks

**4. Composants Non Extraits**
Tout le JSX est dans un seul return massif

---

## 🎯 Plan de Refactoring

### Étape 1: Créer Hooks Personnalisés

#### A. `useAuth.js` ✅ (Déjà créé Phase 1)
Gère l'authentification
- État: `user`, `isAuthenticated`, `loading`
- Méthodes: `login()`, `logout()`, `checkAuth()`

#### B. `useBot.js` ✅ (Déjà créé Phase 1)
Gère le bot courant
- État: `bot`, `code`, `versions`, `saveStatus`
- Méthodes: `loadBot()`, `saveBot()`, `submitToArena()`

#### C. `useTheme.js` 🆕
Gère le thème de l'application
```javascript
export function useTheme() {
  const [theme, setTheme] = useState(() => {
    const stored = localStorage.getItem('gamearena_theme')
    return stored || 'dark'
  })

  useEffect(() => {
    document.documentElement.classList.toggle('theme-dark', theme === 'dark')
    localStorage.setItem('gamearena_theme', theme)
  }, [theme])

  const toggleTheme = useCallback(() => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark')
  }, [])

  return { theme, toggleTheme }
}
```

#### D. `usePanelLayout.js` 🆕
Gère le layout avec splitters
```javascript
export function usePanelLayout() {
  const [leftPanelRatio, setLeftPanelRatio] = useState(0.25)
  const [rowRatio, setRowRatio] = useState(2/3)
  const [bottomPanelVisible, setBottomPanelVisible] = useState(true)
  const [isDragging, setIsDragging] = useState(false)

  const handleHorizontalDrag = useCallback((e) => { ... })
  const handleVerticalDrag = useCallback((e) => { ... })

  return {
    leftPanelRatio,
    rowRatio,
    bottomPanelVisible,
    isDragging,
    setLeftPanelRatio,
    setRowRatio,
    setBottomPanelVisible,
    handleHorizontalDrag,
    handleVerticalDrag
  }
}
```

#### E. `useGameRunner.js` ✅ (Déjà existe mais à améliorer)
Gère la collecte et animation du jeu
- État: `history`, `isCollecting`, `isAnimating`, `isPaused`
- Méthodes: `startCollection()`, `pause()`, `resume()`, `stop()`

#### F. `useStatus.js` 🆕
Gère les status backend/docker
```javascript
export function useStatus() {
  const [backendStatus, setBackendStatus] = useState({ status: 'unknown', info: '' })
  const [dockerStatus, setDockerStatus] = useState({ status: 'unknown', info: '' })

  const checkBackend = useCallback(async () => { ... })
  const checkDocker = useCallback(async () => { ... })

  return { backendStatus, dockerStatus, checkBackend, checkDocker }
}
```

### Étape 2: Extraire Composants UI

#### A. `ControlBar.jsx` 🆕
Barre de contrôle play/pause/stop
```jsx
export default function ControlBar({ 
  isCollecting, 
  isPaused, 
  isAnimating,
  onCollect,
  onPause,
  onStop,
  animationDelay,
  onAnimationDelayChange
}) {
  return (
    <div className="control-bar">
      {/* Boutons + slider vitesse */}
    </div>
  )
}
```

#### B. `StatusBar.jsx` 🆕
Affiche status backend/docker/bot
```jsx
export default function StatusBar({ 
  backendStatus, 
  dockerStatus, 
  saveStatus,
  botVersionInfo 
}) {
  return (
    <div className="status-bar">
      {/* Indicateurs status */}
    </div>
  )
}
```

#### C. `ThemeToggle.jsx` 🆕
Bouton toggle theme
```jsx
export default function ThemeToggle({ theme, onToggle }) {
  return (
    <button onClick={onToggle} className="theme-toggle">
      {theme === 'dark' ? '☀️' : '🌙'}
    </button>
  )
}
```

#### D. `SubmitArenaModal.jsx` ✅ (Déjà existe)
Modal de soumission à l'arène

#### E. `BotSelectionPanel.jsx` ✅ (Déjà existe)
Panel de sélection des adversaires

#### F. `MonacoEditor.jsx` ✅ (Déjà existe)
Éditeur de code

#### G. `Visualizer.jsx` ✅ (Déjà existe)
Visualisation du jeu

#### H. `BotStderrPanel.jsx` ✅ (Déjà existe)
Panel des logs

### Étape 3: Restructurer PlaygroundPage.jsx

**Architecture cible**:
```jsx
export default function PlaygroundPage() {
  // Hooks métier
  const { user, isAuthenticated } = useAuth()
  const { bot, code, saveStatus, saveBot, submitToArena } = useBot(botId)
  const { theme, toggleTheme } = useTheme()
  const { 
    leftPanelRatio, 
    rowRatio, 
    bottomPanelVisible,
    handleHorizontalDrag,
    handleVerticalDrag 
  } = usePanelLayout()
  const { 
    history, 
    isCollecting, 
    isAnimating, 
    isPaused,
    startCollection, 
    pause, 
    stop 
  } = useGameRunner(gameId, code, opponent)
  const { backendStatus, dockerStatus } = useStatus()

  // État local minimal (seulement ce qui est vraiment local)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedOpponent, setSelectedOpponent] = useState(null)

  // Render
  return (
    <div className="playground-page">
      <Header>
        <ThemeToggle theme={theme} onToggle={toggleTheme} />
        <StatusBar 
          backendStatus={backendStatus}
          dockerStatus={dockerStatus}
          saveStatus={saveStatus}
        />
      </Header>
      
      <MainLayout
        leftPanelRatio={leftPanelRatio}
        rowRatio={rowRatio}
        onHorizontalDrag={handleHorizontalDrag}
        onVerticalDrag={handleVerticalDrag}
      >
        <LeftPanel>
          <MonacoEditor 
            code={code} 
            onChange={saveBot} 
          />
        </LeftPanel>
        
        <RightPanel>
          <TopSection>
            <BotSelectionPanel 
              onSelectOpponent={setSelectedOpponent} 
            />
            <ControlBar 
              isCollecting={isCollecting}
              onCollect={startCollection}
              onPause={pause}
              onStop={stop}
            />
            <Visualizer history={history} />
          </TopSection>
          
          {bottomPanelVisible && (
            <BottomSection>
              <BotStderrPanel logs={logs} />
            </BottomSection>
          )}
        </RightPanel>
      </MainLayout>
      
      <SubmitArenaModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={submitToArena}
      />
    </div>
  )
}
```

---

## 📏 Objectifs de Taille

| Fichier | Avant | Après | Réduction |
|---------|-------|-------|-----------|
| `PlaygroundPage.jsx` | 1199 | ~400 | -67% |
| **Nouveaux hooks** |
| `useTheme.js` | 0 | ~30 | +30 |
| `usePanelLayout.js` | 0 | ~80 | +80 |
| `useStatus.js` | 0 | ~60 | +60 |
| **Nouveaux composants** |
| `ControlBar.jsx` | 0 | ~100 | +100 |
| `StatusBar.jsx` | 0 | ~80 | +80 |
| `ThemeToggle.jsx` | 0 | ~20 | +20 |
| **Total** | 1199 | ~870 | -329 lignes |

**Note**: Les hooks `useAuth`, `useBot`, `useGameRunner` et composants `BotSelectionPanel`, `MonacoEditor`, `Visualizer`, `BotStderrPanel` existent déjà.

---

## ✅ Checklist Phase 3

### Hooks
- [ ] Créer `frontend/src/hooks/useTheme.js`
- [ ] Créer `frontend/src/hooks/usePanelLayout.js`
- [ ] Créer `frontend/src/hooks/useStatus.js`
- [ ] Améliorer `frontend/src/hooks/useGameRunner.js` (si nécessaire)

### Composants
- [ ] Créer `frontend/src/components/ControlBar.jsx`
- [ ] Créer `frontend/src/components/StatusBar.jsx`
- [ ] Créer `frontend/src/components/ThemeToggle.jsx`

### Refactoring
- [ ] Refactoriser `PlaygroundPage.jsx` pour utiliser tous les hooks
- [ ] Réorganiser le JSX en composants clairs
- [ ] Supprimer code dupliqué
- [ ] Tester toutes les fonctionnalités

### Tests
- [ ] Vérifier sauvegarde automatique
- [ ] Vérifier collecte/animation jeu
- [ ] Vérifier toggle thème
- [ ] Vérifier splitters (redimensionnement)
- [ ] Vérifier sélection adversaires
- [ ] Vérifier soumission arène

---

## 🎯 Bénéfices Attendus

### Maintenabilité ✅
- Code plus lisible et organisé
- Responsabilités clairement séparées
- Plus facile à déboguer

### Réutilisabilité ✅
- Hooks réutilisables dans d'autres pages
- Composants UI indépendants

### Testabilité ✅
- Hooks testables unitairement
- Composants testables isolément
- Moins de dépendances

### SOLID ✅
- **SRP**: Chaque hook/composant a une seule responsabilité
- **OCP**: Extensible sans modifier l'existant
- **DIP**: Dépend d'abstractions (hooks) pas d'implémentations

---

## 🚀 Ordre d'Exécution

1. **Créer hooks simples** (useTheme, useStatus)
2. **Créer hook complexe** (usePanelLayout)
3. **Créer composants UI** (ThemeToggle, StatusBar, ControlBar)
4. **Refactoriser PlaygroundPage** progressivement
5. **Tester chaque étape** avant de continuer

**Temps estimé**: 2-3 heures

---

**Prêt à commencer ? Je peux démarrer par créer les hooks puis les composants !** 🎨
