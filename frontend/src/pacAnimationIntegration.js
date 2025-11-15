/**
 * Exemple d'intégration du système d'animation des pacs dans le Visualizer
 *
 * Ce fichier montre comment modifier le composant Visualizer.jsx pour utiliser
 * le nouveau système d'animation fluide des pacs.
 */

import { pacAnimationSystem, getPacAnimation, startPacAnimation } from '../pacAnimations.js';

// Exemple de modification du hook useEffect qui charge les sprites
// Dans Visualizer.jsx, remplacer la section de chargement des sprites :

const loadSprites = async () => {
  try {
    // Charger les spritesheets avec PIXI.Loader (méthode actuelle)
    const loader = new PIXI.Loader();

    loader.add('blueSprites', '/assets/sprites/blue.json')
          .add('redSprites', '/assets/sprites/red.json');

    loader.load((loader, resources) => {
      spriteSheetsRef.current = {
        blue: resources.blueSprites.spritesheet,
        red: resources.redSprites.spritesheet
      };

      setSpritesLoaded(true);
      console.log('Spritesheets chargées avec le système d\'animation');
    });

    loader.onError.add((error) => {
      console.error('Erreur de chargement des sprites:', error);
    });

  } catch (error) {
    console.error('Erreur lors du chargement des sprites:', error);
  }
};

// ========================================
// FONCTIONS UTILITAIRES POUR LES ANIMATIONS
// ========================================

/**
 * Crée un sprite de pac avec la bonne animation initiale
 */
function createPacSprite(pac, spriteSheets) {
  const color = pac.team.toLowerCase();
  const spriteSheet = spriteSheets[color];

  if (!spriteSheet) {
    console.warn(`Spritesheet ${color} non trouvée`);
    return null;
  }

  // Créer le sprite avec la première frame de marche
  const animation = getPacAnimation(pac, 'walk');
  const firstFrame = animation.frames[0];
  const texture = spriteSheet.textures[firstFrame];

  if (!texture) {
    console.warn(`Texture ${firstFrame} non trouvée`);
    return null;
  }

  const sprite = new PIXI.Sprite(texture);

  // Configurer le sprite
  sprite.anchor.set(0.5);
  sprite.scale.set(0.8); // Ajuster la taille si nécessaire

  // Stocker les informations d'animation
  sprite.pacData = {
    ...pac,
    currentAnimation: null,
    animationController: null
  };

  return sprite;
}

/**
 * Anime le déplacement d'un pac d'une position à une autre
 */
function animatePacMovement(pacSprite, fromPos, toPos, spriteSheets, onComplete = null) {
  const pac = pacSprite.pacData;

  // Obtenir l'animation de marche
  const walkAnimation = getPacAnimation(pac, 'walk');

  // Démarrer l'animation de marche
  const controller = startPacAnimation(pacSprite, walkAnimation, spriteSheets[pac.team.toLowerCase()]);

  // Calculer la trajectoire
  const startX = fromPos.x * CELL_SIZE + GRID_PADDING + CELL_SIZE / 2;
  const startY = fromPos.y * CELL_SIZE + GRID_PADDING + CELL_SIZE / 2;
  const endX = toPos.x * CELL_SIZE + GRID_PADDING + CELL_SIZE / 2;
  const endY = toPos.y * CELL_SIZE + GRID_PADDING + CELL_SIZE / 2;

  // Animation de déplacement spatial
  const moveAnimation = {
    duration: walkAnimation.frames.length * walkAnimation.duration, // Durée totale de l'animation
    startTime: Date.now(),
    startX,
    startY,
    endX,
    endY
  };

  const animateMove = () => {
    const elapsed = Date.now() - moveAnimation.startTime;
    const progress = Math.min(elapsed / moveAnimation.duration, 1);

    // Interpolation linéaire
    pacSprite.x = moveAnimation.startX + (moveAnimation.endX - moveAnimation.startX) * progress;
    pacSprite.y = moveAnimation.startY + (moveAnimation.endY - moveAnimation.startY) * progress;

    if (progress < 1) {
      requestAnimationFrame(animateMove);
    } else {
      // Animation terminée
      pacSprite.x = moveAnimation.endX;
      pacSprite.y = moveAnimation.endY;

      // Arrêter l'animation de marche
      if (controller) {
        controller.stop();
      }

      // Callback de fin
      if (onComplete) {
        onComplete();
      }
    }
  };

  animateMove();
  return controller;
}

/**
 * Anime la mort d'un pac
 */
function animatePacDeath(pacSprite, spriteSheets, onComplete = null) {
  const pac = pacSprite.pacData;

  // Obtenir l'animation de mort
  const deathAnimation = getPacAnimation(pac, 'death');

  // Démarrer l'animation de mort
  const controller = startPacAnimation(pacSprite, deathAnimation, spriteSheets[pac.team.toLowerCase()]);

  // Attendre la fin de l'animation
  setTimeout(() => {
    if (controller) {
      controller.stop();
    }

    // Masquer ou supprimer le sprite
    pacSprite.visible = false;

    if (onComplete) {
      onComplete();
    }
  }, deathAnimation.frames.length * deathAnimation.duration);
}

/**
 * Anime une collision entre pacs de même type
 */
function animatePacCollision(pacSprite, spriteSheets, onComplete = null) {
  const pac = pacSprite.pacData;

  // Obtenir l'animation de collision
  const collisionAnimation = getPacAnimation(pac, 'collision');

  // Démarrer l'animation de collision
  const controller = startPacAnimation(pacSprite, collisionAnimation, spriteSheets[pac.team.toLowerCase()]);

  // Attendre la fin de l'animation
  setTimeout(() => {
    if (controller) {
      controller.stop();
    }

    if (onComplete) {
      onComplete();
    }
  }, collisionAnimation.frames.length * collisionAnimation.duration);
}

// ========================================
// EXEMPLE D'INTÉGRATION DANS LE VISUALIZER
// ========================================

/**
 * Exemple de fonction qui gère les mouvements de pacs avec animation
 * À intégrer dans la logique de replay du visualizer
 */
function handlePacMovements(oldState, newState, spriteSheets) {
  const animations = [];

  // Pour chaque pac dans le nouvel état
  newState.pacs.forEach(newPac => {
    const sprite = pacsSpritesRef.current[newPac.id];

    if (!sprite) return;

    // Trouver la position précédente
    const oldPac = oldState.pacs.find(p => p.id === newPac.id);
    if (!oldPac) return;

    // Si la position a changé, animer le mouvement
    if (oldPac.x !== newPac.x || oldPac.y !== newPac.y) {
      const animation = animatePacMovement(
        sprite,
        { x: oldPac.x, y: oldPac.y },
        { x: newPac.x, y: newPac.y },
        spriteSheets
      );
      animations.push(animation);
    }

    // Gérer les autres changements d'état (mort, collision, etc.)
    // ...
  });

  return animations;
}

/**
 * Fonction utilitaire pour déterminer le type d'événement d'un pac
 */
function getPacEventType(oldPac, newPac) {
  if (!oldPac) return 'spawn';
  if (!newPac) return 'death';

  if (oldPac.x === newPac.x && oldPac.y === newPac.y) {
    // Même position - vérifier les autres changements
    if (oldPac.type !== newPac.type) {
      return 'type_change';
    }
    // Collision avec un pac du même type
    return 'collision';
  }

  return 'move';
}

// ========================================
// EXEMPLE DE MODIFICATION DU COMPOSANT VISUALIZER
// ========================================

/*
// Dans la fonction renderState ou équivalent, remplacer :

// Ancienne logique simple
pacs.forEach(pac => {
  const sprite = pacsSpritesRef.current[pac.id];
  if (sprite) {
    sprite.x = pac.x * CELL_SIZE + GRID_PADDING + CELL_SIZE / 2;
    sprite.y = pac.y * CELL_SIZE + GRID_PADDING + CELL_SIZE / 2;
  }
});

// Nouvelle logique avec animations
const animations = handlePacMovements(prevState, currentState, spriteSheetsRef.current);

// Attendre que toutes les animations soient terminées avant de passer au tour suivant
Promise.all(animations).then(() => {
  // Continuer vers le tour suivant
  if (onStepForward) {
    setTimeout(onStepForward, 200); // Petit délai pour l'effet visuel
  }
});
*/

export {
  createPacSprite,
  animatePacMovement,
  animatePacDeath,
  animatePacCollision,
  handlePacMovements,
  getPacEventType
};