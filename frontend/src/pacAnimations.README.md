# Système d'Animation des Pacs

Ce système définit des animations fluides pour les pacs du jeu GameArena en utilisant les spritesheets `blue.json` et `red.json`.

## Types de Pacs

- **Type 1**: Ligues Wood et Bronze (SWITCH accessible à partir de Silver)
- **Type 2**: SCISSOR (ligue Silver)
- **Type 3**: PAPER (non défini dans les sprites actuels)
- **Type 4**: ROCK (ligue Gold)

## Types d'Animation

### 1. Animation WALK (8 frames)
Déplacement normal du pac vivant. Animation qui boucle indéfiniment.

**Séquence**: `walk0001` → `walk0002` → `walk0003` → `walk0004` → `walk0004_2` → `walk0003_2` → `walk0002_2` → `walk0001_2`

### 2. Animation DEATH (7 frames)
Animation de mort quand un pac se fait manger. Animation qui se joue une fois.

**Séquence**: `mort0001` → `mort0002` → ... → `mort0007`

### 3. Animation COLLISION (8 frames)
Animation spéciale en cas de collision entre pacs de même type. Simule un rebond (avancée puis retour).

**Séquence**: Avancée vers la cible puis retour à la position initiale.

## Utilisation

### Import du système

```javascript
import { pacAnimationSystem, getPacAnimation, startPacAnimation } from './pacAnimations.js';
```

### Création d'une animation

```javascript
// Pour un pac spécifique
const pac = {
    team: 'blue',      // ou 'red'
    league: 'wood'     // 'wood', 'bronze', 'silver', 'gold'
};

// Obtenir l'animation de marche
const walkAnimation = getPacAnimation(pac, 'walk');

// Obtenir l'animation de mort
const deathAnimation = getPacAnimation(pac, 'death');

// Obtenir l'animation de collision
const collisionAnimation = getPacAnimation(pac, 'collision');
```

### Démarrage d'une animation avec PixiJS

```javascript
// Supposons que spriteSheet est déjà chargé avec PIXI.Loader
const sprite = new PIXI.Sprite();

// Démarrer l'animation
const animationController = startPacAnimation(sprite, walkAnimation, spriteSheet);

// Contrôler l'animation
animationController.stop();           // Arrêter
animationController.isPlaying();      // Vérifier si en cours
animationController.setFrame(3);      // Aller à une frame spécifique
```

## Configuration des Timings

- **WALK**: 120ms par frame (fluide pour le déplacement)
- **DEATH**: 150ms par frame (plus lent pour l'effet dramatique)
- **COLLISION**: 100ms par frame (rapide pour l'effet de rebond)

## Intégration dans le Visualizer

Pour intégrer ce système dans le visualizer existant :

1. **Charger les spritesheets** dans le loader PixiJS
2. **Créer les sprites** des pacs avec les bonnes textures
3. **Utiliser le système d'animation** pour les transitions entre tours
4. **Gérer les événements** (mort, collision) pour déclencher les bonnes animations

### Exemple d'intégration

```javascript
// Dans le visualizer, lors de l'initialisation
const loader = new PIXI.Loader();
loader.add('blueSprites', 'sprites/blue.json')
      .add('redSprites', 'sprites/red.json')
      .load((loader, resources) => {
          // Spritesheets chargées
          this.blueSprites = resources.blueSprites.spritesheet;
          this.redSprites = resources.redSprites.spritesheet;

          // Créer les pacs...
      });

// Lors d'un mouvement de pac
movePac(pac, fromPos, toPos) {
    const animation = getPacAnimation(pac, 'walk');
    const controller = startPacAnimation(pac.sprite, animation, this.blueSprites);

    // Animer le déplacement spatialement
    // ...
}
```

## Structure des Frames

### Nomenclature des Frames

- **Marche**: `paku_[color]_[type]_walk00[1-4]` et `paku_[color]_[type]_walk00[1-4]_2`
- **Mort**: `mort_[color]_[type]_mort00[1-7]`

### Mapping Type/Ligue

```javascript
const PAC_TYPES = {
    1: ['wood', 'bronze'],    // Type 1: Wood/Bronze
    2: ['silver'],            // Type 2: Silver (SCISSOR)
    3: ['paper'],             // Type 3: PAPER (réservé)
    4: ['gold']               // Type 4: Gold (ROCK)
};
```

## Extension

Pour ajouter de nouveaux types d'animation :

1. Ajouter le type dans `ANIMATION_TYPES`
2. Définir la durée dans `FRAME_DURATION`
3. Créer la méthode `buildXXXSequence()`
4. Intégrer dans `buildFrameSequences()`

Pour ajouter de nouvelles couleurs ou types de pacs, étendre les boucles dans `buildFrameSequences()`.