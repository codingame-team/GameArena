/**
 * Système d'animation pour les pacs du jeu GameArena
 *
 * Définit les animations fluides basées sur les spritesheets blue.json et red.json
 *
 * Types de pacs:
 * - Type 1: Wood/Bronze (SWITCH accessible à partir de Silver)
 * - Type 2: SCISSOR
 * - Type 3: PAPER
 * - Type 4: ROCK
 */

export class PacAnimationSystem {
    constructor() {
        // Configuration des animations
        this.ANIMATION_TYPES = {
            WALK: 'walk',           // 8 frames - déplacement normal
            DEATH: 'death',         // 7 frames - mort (mangé par autre pac)
            COLLISION: 'collision'  // Animation spéciale collision même type
        };

        // Durée par frame en millisecondes
        this.FRAME_DURATION = {
            WALK: 120,      // Plus fluide pour le déplacement
            DEATH: 150,     // Plus lent pour l'effet dramatique
            COLLISION: 100  // Rapide pour l'effet de rebond
        };

        // Définition des séquences de frames pour chaque type et couleur
        this.frameSequences = this.buildFrameSequences();
    }

    /**
     * Construit les séquences de frames pour tous les types et couleurs
     */
    buildFrameSequences() {
        const sequences = {
            blue: {},
            red: {}
        };

        // Pour chaque couleur
        ['blue', 'red'].forEach(color => {
            // Pour chaque type de pac (1-4)
            for (let type = 1; type <= 4; type++) {
                sequences[color][type] = {
                    walk: this.buildWalkSequence(color, type),
                    death: this.buildDeathSequence(color, type),
                    collision: this.buildCollisionSequence(color, type)
                };
            }
        });

        return sequences;
    }

    /**
     * Construit la séquence d'animation de marche (8 frames)
     * Pattern: walk0001 -> walk0002 -> walk0003 -> walk0004 -> walk0004_2 -> walk0003_2 -> walk0002_2 -> walk0001_2
     */
    buildWalkSequence(color, type) {
        return [
            `paku_${color}_${type}_walk0001`,     // Frame 1: départ
            `paku_${color}_${type}_walk0002`,     // Frame 2: mouvement
            `paku_${color}_${type}_walk0003`,     // Frame 3: mouvement
            `paku_${color}_${type}_walk0004`,     // Frame 4: mouvement max
            `paku_${color}_${type}_walk0004_2`,   // Frame 5: retour mouvement
            `paku_${color}_${type}_walk0003_2`,   // Frame 6: retour mouvement
            `paku_${color}_${type}_walk0002_2`,   // Frame 7: retour mouvement
            `paku_${color}_${type}_walk0001_2`    // Frame 8: retour au départ
        ];
    }

    /**
     * Construit la séquence d'animation de mort (7 frames)
     * Pattern: mort0001 -> mort0002 -> ... -> mort0007
     */
    buildDeathSequence(color, type) {
        const frames = [];
        for (let i = 1; i <= 7; i++) {
            frames.push(`mort_${color}_${type}_mort${i.toString().padStart(3, '0')}`);
        }
        return frames;
    }

    /**
     * Construit la séquence d'animation de collision (avancée puis retour)
     * Utilise les frames de marche pour simuler un rebond
     */
    buildCollisionSequence(color, type) {
        return [
            `paku_${color}_${type}_walk0001`,     // Position initiale
            `paku_${color}_${type}_walk0002`,     // Avancée légère
            `paku_${color}_${type}_walk0003`,     // Avancée moyenne
            `paku_${color}_${type}_walk0004`,     // Avancée maximale (contact)
            `paku_${color}_${type}_walk0004`,     // Pause au contact
            `paku_${color}_${type}_walk0003`,     // Recul
            `paku_${color}_${type}_walk0002`,     // Recul
            `paku_${color}_${type}_walk0001`      // Retour position initiale
        ];
    }

    /**
     * Obtient l'animation pour un pac spécifique
     * @param {string} color - 'blue' ou 'red'
     * @param {number} type - Type du pac (1-4)
     * @param {string} animationType - Type d'animation ('walk', 'death', 'collision')
     * @returns {Object} Configuration de l'animation
     */
    getAnimation(color, type, animationType) {
        if (!this.frameSequences[color] || !this.frameSequences[color][type]) {
            console.warn(`Animation non trouvée pour ${color} type ${type}`);
            return null;
        }

        const sequence = this.frameSequences[color][type][animationType];
        if (!sequence) {
            console.warn(`Type d'animation '${animationType}' non trouvé pour ${color} type ${type}`);
            return null;
        }

        return {
            frames: sequence,
            duration: this.FRAME_DURATION[animationType.toUpperCase()] || 120,
            loop: animationType === 'walk', // L'animation de marche boucle
            type: animationType
        };
    }

    /**
     * Obtient le type de pac basé sur la ligue
     * @param {string} league - Nom de la ligue ('wood', 'bronze', 'silver', 'gold')
     * @returns {number} Type du pac (1-4)
     */
    getPacTypeFromLeague(league) {
        const leagueTypes = {
            'wood': 1,
            'bronze': 1,   // Type 1 pour Wood/Bronze
            'silver': 2,   // Type 2 pour Silver
            'gold': 4      // Type 4 pour Gold
        };

        return leagueTypes[league.toLowerCase()] || 1;
    }

    /**
     * Obtient la couleur du pac basée sur l'équipe
     * @param {string} team - Équipe ('blue', 'red')
     * @returns {string} Couleur du pac
     */
    getPacColor(team) {
        return team.toLowerCase();
    }

    /**
     * Crée une animation complète pour un pac
     * @param {Object} pac - Objet pac avec team et league
     * @param {string} animationType - Type d'animation
     * @returns {Object} Configuration complète de l'animation
     */
    createPacAnimation(pac, animationType = 'walk') {
        const color = this.getPacColor(pac.team);
        const type = this.getPacTypeFromLeague(pac.league);

        return this.getAnimation(color, type, animationType);
    }

    /**
     * Démarre une animation sur un sprite PixiJS
     * @param {PIXI.Sprite} sprite - Le sprite à animer
     * @param {Object} animation - Configuration de l'animation
     * @param {Object} spriteSheet - La spritesheet chargée
     * @returns {Object} Contrôleur d'animation
     */
    startAnimation(sprite, animation, spriteSheet) {
        if (!animation || !spriteSheet) {
            console.warn('Animation ou spritesheet manquante');
            return null;
        }

        let currentFrame = 0;
        let lastFrameTime = Date.now();
        let isPlaying = true;

        const animate = () => {
            if (!isPlaying) return;

            const now = Date.now();
            if (now - lastFrameTime >= animation.duration) {
                // Changer de frame
                const frameName = animation.frames[currentFrame];
                const texture = spriteSheet.textures[frameName];

                if (texture) {
                    sprite.texture = texture;
                } else {
                    console.warn(`Frame '${frameName}' non trouvée dans la spritesheet`);
                }

                // Passer à la frame suivante
                currentFrame++;
                if (currentFrame >= animation.frames.length) {
                    if (animation.loop) {
                        currentFrame = 0; // Reboucler
                    } else {
                        isPlaying = false; // Arrêter l'animation
                        return;
                    }
                }

                lastFrameTime = now;
            }

            requestAnimationFrame(animate);
        };

        // Démarrer l'animation
        animate();

        // Retourner le contrôleur
        return {
            stop: () => { isPlaying = false; },
            isPlaying: () => isPlaying,
            getCurrentFrame: () => currentFrame,
            setFrame: (frameIndex) => {
                if (frameIndex >= 0 && frameIndex < animation.frames.length) {
                    currentFrame = frameIndex;
                    const frameName = animation.frames[currentFrame];
                    const texture = spriteSheet.textures[frameName];
                    if (texture) {
                        sprite.texture = texture;
                    }
                }
            }
        };
    }
}

// Instance globale du système d'animation
export const pacAnimationSystem = new PacAnimationSystem();

// Fonctions utilitaires pour une utilisation simplifiée
export const getPacAnimation = (pac, animationType = 'walk') =>
    pacAnimationSystem.createPacAnimation(pac, animationType);

export const startPacAnimation = (sprite, animation, spriteSheet) =>
    pacAnimationSystem.startAnimation(sprite, animation, spriteSheet);