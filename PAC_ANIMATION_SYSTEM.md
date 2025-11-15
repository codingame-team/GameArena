# Système d'Animation des Pacs

Ce document décrit le système d'animation automatique pour les Pacs dans GameArena.

## Vue d'ensemble

Le système d'animation utilise les spritesheets `blue.json` et `red.json` pour créer des animations fluides pour différents types de Pacs et états de jeu.

## Types de Pacs

- **Type 1**: Ligues Wood et Bronze (SWITCH accessible à partir de Silver)
- **Type 2**: SCISSOR
- **Type 3**: PAPER
- **Type 4**: ROCK

## Types d'Animation

### 1. Animation Normale (vivant)
- **Frames**: 8 frames (4 frames aller + 4 frames retour)
- **Pattern**: `paku_[color]_[type]_walk000[1-4]` + inverse
- **Loop**: Infini
- **Utilisation**: Déplacement normal du Pac

### 2. Animation de Mort
- **Frames**: 7 frames
- **Pattern**: `mort_[color]_[type]_mort000[1-7]`
- **Loop**: Non (une seule fois)
- **Utilisation**: Quand un Pac se fait manger

### 3. Animation de Collision
- **Frames**: 4 frames (avancer + reculer)
- **Pattern**: `paku_[color]_[type]_walk000[1-2]` + inverse
- **Loop**: Non
- **Utilisation**: Collision entre Pacs de même type

## Architecture

### Fichiers générés automatiquement

- `pac_animations.js`: Constantes d'animation générées par `pac_animation_builder.py`
- `PacAnimationManager.js`: Classes de gestion des animations

### Structure des données

```javascript
PAC_ANIMATIONS = {
  "blue_1": {
    "normal": {
      frames: ["frame1", "frame2", ...],
      duration: 8,
      loop: true
    },
    "collision": { ... },
    "mort": { ... }
  },
  // ... autres types
}
```

## Utilisation

### Initialisation

```javascript
import { PacAnimationManager, PAC_TYPES, PAC_COLORS, ANIMATION_TYPES } from './PacAnimationManager.js';

// Créer le gestionnaire
const animationManager = new PacAnimationManager();

// Créer un animateur pour un Pac
const pacId = 'pac_1';
animationManager.createAnimator(pacId, PAC_TYPES.SCISSOR, PAC_COLORS.BLUE);
```

### Jouer des animations

```javascript
// Animation normale (boucle infinie)
animationManager.playAnimation(pacId, ANIMATION_TYPES.NORMAL);

// Animation de collision (avec callback)
animationManager.playAnimation(pacId, ANIMATION_TYPES.COLLISION, () => {
    console.log('Collision terminée');
});

// Animation de mort (avec callback)
animationManager.playAnimation(pacId, ANIMATION_TYPES.MORT, () => {
    console.log('Pac éliminé');
});
```

### Mise à jour dans la boucle de jeu

```javascript
function gameLoop(deltaTime) {
    // Mettre à jour toutes les animations
    const currentFrames = animationManager.updateAll(deltaTime);

    // Rendre chaque Pac avec sa frame actuelle
    for (const [pacId, frameName] of currentFrames) {
        renderPac(pacId, frameName);
    }
}
```

## Génération automatique

Le système est généré automatiquement par `pac_animation_builder.py` :

```bash
python3 pac_animation_builder.py
```

Ce script :
1. Analyse les fichiers `blue.json` et `red.json`
2. Identifie les patterns de frames
3. Génère les séquences d'animation
4. Crée le fichier `pac_animations.js`

## Intégration dans le Visualizer

Pour intégrer dans `Visualizer.jsx` :

1. Importer les classes :
```javascript
import { PacAnimationManager, PAC_TYPES, PAC_COLORS, ANIMATION_TYPES } from '../PacAnimationManager.js';
```

2. Initialiser dans le constructeur :
```javascript
this.animationManager = new PacAnimationManager();
```

3. Créer les animateurs pour chaque Pac lors de l'initialisation du jeu

4. Mettre à jour les animations dans la boucle de rendu

5. Utiliser les noms de frames pour afficher les sprites corrects

## Patterns Regex

- **Mort**: `[blue|red]_[2-4]_mort000[1-7]`
- **Marche**: `[blue|red]_[1-4]_walk000[1-4]`

Note: Le type 1 (Wood/Bronze) n'a pas d'animation de mort.

## Performances

- Les animations sont mises à jour uniquement quand nécessaire
- Utilisation de Map pour un accès O(1) aux animateurs
- Frames pré-calculées pour éviter les calculs à runtime