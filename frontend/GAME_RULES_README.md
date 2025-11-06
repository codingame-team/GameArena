# 📖 Système de Règles de Jeu - Guide Rapide

## 🎯 Vue d'ensemble

Système modulaire de composants React pour afficher les règles de jeu dans le style CodinGame, inspiré des fichiers `.tpl` du Spring Challenge 2020.

## 📦 Fichiers créés

```
frontend/src/components/
├── GameRules.jsx                 # ⭐ Composants de base + exemple Pacman simple
├── TicTacToeRules.jsx           # 📝 Exemple TicTacToe
├── PacmanAdvancedRules.jsx      # 🎮 Exemple Pacman avancé (ligues)
└── Visualizer.jsx               # ✅ Intégration (déjà fait)
```

## 🚀 Utilisation rapide

### Option 1 : Utiliser les règles par défaut

```jsx
import GameRules from './components/GameRules'

// Pacman simple (wood league)
<GameRules league="wood" />
```

### Option 2 : Règles avancées avec ligues

```jsx
import PacmanAdvancedRules from './components/PacmanAdvancedRules'

// Choisir la ligue
<PacmanAdvancedRules league="wood" />   // Débutant
<PacmanAdvancedRules league="bronze" /> // Multi-pacs
<PacmanAdvancedRules league="silver" /> // Brouillard + cherries
<PacmanAdvancedRules league="gold" />   // Toutes les règles
```

### Option 3 : Créer des règles custom

```jsx
import {
  RulesContainer,
  Section,
  SubSection,
  Paragraph,
  BulletList,
  Code,
  Action,
  Const,
  Variable
} from './components/GameRules'

function MyGameRules() {
  return (
    <RulesContainer>
      <Section title="Objectif" icon="🎯">
        <Paragraph>
          Collecter <Const>100 points</Const> en utilisant
          la commande <Action>COLLECT x y</Action>.
        </Paragraph>
      </Section>
      
      <Section title="Commandes" icon="⌨️">
        <BulletList items={[
          <>Format : <Code>COLLECT x y</Code></>,
          <>Variables : <Variable>x</Variable>, <Variable>y</Variable></>,
          'Uniquement sur cases valides'
        ]} />
      </Section>
    </RulesContainer>
  )
}
```

## 🎨 Composants disponibles

### Conteneurs
- `RulesContainer` - Wrapper principal
- `Section` - Section avec titre + icône
- `SubSection` - Sous-section avec emoji
- `LeagueAlert` - Alerte de ligue (vert)

### Contenu
- `Paragraph` - Paragraphe
- `BulletList` - Liste à puces
- `NumberedList` - Liste numérotée
- `Spacer` - Espacement vertical

### Formatage de texte
- `Code` - Code inline/bloc
- `Action` - Commande (vert, `MOVE`)
- `Const` - Constante (orange, `10 points`)
- `Variable` - Variable (bleu, `width`)

### Spéciaux
- `ImageBlock` - Image + légende
- `VictoryConditions` - ✅ Victoire
- `LoseConditions` - ❌ Défaite
- `DebugTips` - 🐞 Conseils

## 📝 Exemples de code

### Texte coloré

```jsx
<Action>MOVE</Action>      // Vert : commandes
<Const>10 points</Const>   // Orange : constantes
<Variable>width</Variable> // Bleu : variables
```

### Listes

```jsx
// Puces
<BulletList items={[
  'Item 1',
  <>Item avec <Code>code</Code></>,
  'Item 3'
]} />

// Numérotée
<NumberedList items={[
  'Étape 1',
  'Étape 2'
]} />
```

### Code

```jsx
// Inline
<Code>MOVE 5 3</Code>

// Bloc
<Code inline={false}>
{`def move():
    print("MOVE 5 3")`}
</Code>
```

### Conditions

```jsx
<VictoryConditions>
  Vous gagnez en ayant le plus de points.
</VictoryConditions>

<LoseConditions>
  <BulletList items={[
    'Timeout',
    'Commande invalide'
  ]} />
</LoseConditions>
```

## 🔄 Intégration dans Visualizer

Déjà fait ! Le composant est utilisé dans `Visualizer.jsx` :

```jsx
<div className="visualizer">
  <div className="visualizer-canvas">
    {/* Grille PixiJS */}
  </div>
  
  {/* Règles toujours visibles */}
  <GameRules league="wood" />
</div>
```

## 🎯 Cas d'usage

### 1. Jeu simple (TicTacToe)
```jsx
import TicTacToeRules from './components/TicTacToeRules'
<TicTacToeRules />
```

### 2. Jeu avec ligues (Pacman)
```jsx
import PacmanAdvancedRules from './components/PacmanAdvancedRules'

// État de l'application
const [currentLeague, setCurrentLeague] = useState('wood')

// Render
<PacmanAdvancedRules league={currentLeague} />
```

### 3. Règles dynamiques
```jsx
function DynamicRules({ gameConfig }) {
  return (
    <RulesContainer>
      <Section title="Configuration" icon="⚙️">
        <Paragraph>
          Max tours : <Const>{gameConfig.maxTurns}</Const>
        </Paragraph>
        <Paragraph>
          Points victoire : <Const>{gameConfig.pointsToWin}</Const>
        </Paragraph>
      </Section>
    </RulesContainer>
  )
}
```

## ✅ Avantages

- ✅ **Modulaire** : Composants réutilisables
- ✅ **Cohérent** : Style uniforme CodinGame
- ✅ **Type-safe** : Props claires
- ✅ **Maintenable** : Facile à modifier
- ✅ **Responsive** : S'adapte aux écrans
- ✅ **Accessible** : Sémantique correcte

## 📚 Documentation complète

Voir `GAME_RULES_COMPONENT.md` pour la documentation détaillée avec tous les exemples et patterns avancés.

## 🔧 Prochaines évolutions

- [ ] PropTypes/TypeScript
- [ ] Thèmes (dark/light)
- [ ] i18n (FR/EN)
- [ ] Animations
- [ ] Support Markdown
- [ ] Export PDF

---

**Créé le** : 6 novembre 2025  
**Inspiré de** : CG-SpringChallenge2020 `.tpl` files  
**Status** : ✅ Production ready
