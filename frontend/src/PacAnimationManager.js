import { PAC_ANIMATIONS, PAC_TYPES, PAC_COLORS, ANIMATION_TYPES } from './pac_animations.js';

/**
 * Classe pour gérer l'animation d'un Pac individuel
 */
export class PacAnimator {
    constructor(pacType, pacColor) {
        this.pacType = pacType;
        this.pacColor = pacColor;
        this.currentAnimation = null;
        this.currentFrameIndex = 0;
        this.frameTimer = 0;
        this.isPlaying = false;
        this.onAnimationComplete = null;
    }

    /**
     * Démarre une animation spécifique
     * @param {string} animationType - Type d'animation (normal, mort, collision)
     * @param {function} onComplete - Callback appelé quand l'animation se termine
     */
    playAnimation(animationType, onComplete = null) {
        const animationKey = `${this.pacColor}_${this.pacType}`;
        const animation = PAC_ANIMATIONS[animationKey]?.[animationType];

        if (!animation) {
            console.warn(`Animation ${animationType} non trouvée pour ${animationKey}`);
            return false;
        }

        this.currentAnimation = animation;
        this.currentFrameIndex = 0;
        this.frameTimer = 0;
        this.isPlaying = true;
        this.onAnimationComplete = onComplete;

        return true;
    }

    /**
     * Met à jour l'animation (à appeler chaque frame)
     * @param {number} deltaTime - Temps écoulé depuis la dernière frame
     * @returns {string|null} - Nom de la frame actuelle ou null si pas d'animation
     */
    update(deltaTime) {
        if (!this.currentAnimation || !this.isPlaying) {
            return null;
        }

        // Avancer le timer
        this.frameTimer += deltaTime;

        // Calculer la durée par frame (en millisecondes)
        const frameDuration = (this.currentAnimation.duration / this.currentAnimation.frames.length) * 1000;

        // Changer de frame si nécessaire
        while (this.frameTimer >= frameDuration) {
            this.frameTimer -= frameDuration;
            this.currentFrameIndex++;

            // Vérifier si l'animation est terminée
            if (this.currentFrameIndex >= this.currentAnimation.frames.length) {
                if (this.currentAnimation.loop) {
                    // Recommencer l'animation en boucle
                    this.currentFrameIndex = 0;
                } else {
                    // Arrêter l'animation
                    this.isPlaying = false;
                    this.currentFrameIndex = this.currentAnimation.frames.length - 1;

                    // Appeler le callback de fin
                    if (this.onAnimationComplete) {
                        this.onAnimationComplete();
                        this.onAnimationComplete = null;
                    }
                    break;
                }
            }
        }

        return this.currentAnimation.frames[this.currentFrameIndex];
    }

    /**
     * Arrête l'animation en cours
     */
    stopAnimation() {
        this.isPlaying = false;
        this.currentAnimation = null;
        this.currentFrameIndex = 0;
        this.frameTimer = 0;
    }

    /**
     * Retourne la frame actuelle sans avancer l'animation
     */
    getCurrentFrame() {
        if (!this.currentAnimation) {
            return null;
        }
        return this.currentAnimation.frames[this.currentFrameIndex];
    }

    /**
     * Vérifie si une animation est en cours
     */
    isAnimating() {
        return this.isPlaying;
    }
}

/**
 * Gestionnaire central des animations de Pacs
 */
export class PacAnimationManager {
    constructor() {
        this.animators = new Map(); // Map<pacId, PacAnimator>
    }

    /**
     * Crée un animateur pour un Pac
     * @param {string} pacId - Identifiant unique du Pac
     * @param {number} pacType - Type du Pac (1-4)
     * @param {string} pacColor - Couleur du Pac ('blue' ou 'red')
     */
    createAnimator(pacId, pacType, pacColor) {
        const animator = new PacAnimator(pacType, pacColor);
        this.animators.set(pacId, animator);
        return animator;
    }

    /**
     * Met à jour toutes les animations
     * @param {number} deltaTime - Temps écoulé
     * @returns {Map} - Map des frames actuelles par pacId
     */
    updateAll(deltaTime) {
        const currentFrames = new Map();

        for (const [pacId, animator] of this.animators) {
            const frame = animator.update(deltaTime);
            if (frame) {
                currentFrames.set(pacId, frame);
            }
        }

        return currentFrames;
    }

    /**
     * Fait jouer une animation à un Pac
     * @param {string} pacId - ID du Pac
     * @param {string} animationType - Type d'animation
     * @param {function} onComplete - Callback de fin
     */
    playAnimation(pacId, animationType, onComplete = null) {
        const animator = this.animators.get(pacId);
        if (animator) {
            return animator.playAnimation(animationType, onComplete);
        }
        return false;
    }

    /**
     * Arrête l'animation d'un Pac
     * @param {string} pacId - ID du Pac
     */
    stopAnimation(pacId) {
        const animator = this.animators.get(pacId);
        if (animator) {
            animator.stopAnimation();
        }
    }

    /**
     * Supprime un animateur
     * @param {string} pacId - ID du Pac
     */
    removeAnimator(pacId) {
        this.animators.delete(pacId);
    }
}

// Exporter les constantes pour utilisation externe
export { PAC_TYPES, PAC_COLORS, ANIMATION_TYPES };

// Exemple d'utilisation:
//
// // Créer le gestionnaire
// const animationManager = new PacAnimationManager();
//
// // Créer un animateur pour un Pac bleu de type 2 (SCISSOR)
// const animator = animationManager.createAnimator('pac_1', PAC_TYPES.SCISSOR, PAC_COLORS.BLUE);
//
// // Jouer l'animation normale
// animationManager.playAnimation('pac_1', ANIMATION_TYPES.NORMAL);
//
// // Dans la boucle de jeu
// function gameLoop(deltaTime) {
//     const currentFrames = animationManager.updateAll(deltaTime);
//
//     // Utiliser les frames pour le rendu
//     for (const [pacId, frameName] of currentFrames) {
//         // Afficher le sprite correspondant à frameName
//         renderPac(pacId, frameName);
//     }
// }
//
// // Pour une collision
// animationManager.playAnimation('pac_1', ANIMATION_TYPES.COLLISION, () => {
//     console.log('Animation de collision terminée');
// });
//
// // Pour la mort
// animationManager.playAnimation('pac_1', ANIMATION_TYPES.MORT, () => {
//     console.log('Pac mort - animation terminée');
// });