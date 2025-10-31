import React, { useEffect, useRef } from 'react';
import * as PIXI from 'pixi.js';

// Configuration des sprites
const SPRITE_CONFIG = {
  animationSpeed: 0.15,
  spriteSize: 90, // Taille originale des sprites dans les PNG
  cellPadding: 0.85 // Le sprite occupe 85% de la cellule pour laisser un peu d'espace
};

// Noms des frames pour chaque couleur
const FRAME_NAMES = {
  player: ['paku_red_1_walk0001', 'paku_red_1_walk0002', 'paku_red_1_walk0003'], // Red/player
  opponent: ['paku_blue_1_walk0001', 'paku_blue_1_walk0002', 'paku_blue_1_walk0003'] // Blue/opponent
};

export default function PacmanSprite({ position, direction = 'right', isPlayer = true }) {
  const containerRef = useRef(null);
  const appRef = useRef(null);
  const spriteRef = useRef(null);

  useEffect(() => {
    let mounted = true;
    
    // Création de l'application PixiJS
    const initPixi = async () => {
      if (!containerRef.current || appRef.current) return;
      
      // Calculer la taille en fonction du conteneur
      const containerSize = Math.min(
        containerRef.current.offsetWidth,
        containerRef.current.offsetHeight
      );
      const displaySize = containerSize || 50; // Fallback si le conteneur n'a pas de taille
      
      // Calculer l'échelle pour que le sprite s'adapte à la cellule
      const scale = (displaySize * SPRITE_CONFIG.cellPadding) / SPRITE_CONFIG.spriteSize;
      
      try {
        // Créer l'application PixiJS (compatible v7 et v8)
        const app = new PIXI.Application();
        
        // Initialiser avec await (nécessaire pour PixiJS v8)
        await app.init({
          width: displaySize,
          height: displaySize,
          backgroundColor: 0x000000,
          backgroundAlpha: 0,
          antialias: true
        });
        
        if (!mounted) {
          app.destroy(true);
          return;
        }
        
        appRef.current = app;
        
        // Utiliser canvas au lieu de view (PixiJS v8)
        const canvas = app.canvas || app.view;
        if (canvas) {
          containerRef.current.appendChild(canvas);
        }

        // Chargement de la sprite sheet appropriée
        const spriteFile = isPlayer ? 'red' : 'blue';
        const frameNames = isPlayer ? FRAME_NAMES.player : FRAME_NAMES.opponent;
        
        await Promise.all([
          PIXI.Assets.load(`/sprites/${spriteFile}.json`),
          PIXI.Assets.load(`/sprites/${spriteFile}.png`)
        ]);
        
        if (!mounted) return;
        
        // Récupération des textures depuis le cache
        const spriteTextures = frameNames.map(frameName => 
          PIXI.Texture.from(frameName)
        );

        if (spriteTextures.length === 0) {
          console.error(`No textures found for ${spriteFile}`);
          return;
        }

        // Création du sprite animé
        const animatedSprite = new PIXI.AnimatedSprite(spriteTextures);
        animatedSprite.animationSpeed = SPRITE_CONFIG.animationSpeed;
        animatedSprite.anchor.set(0.5);
        animatedSprite.scale.set(scale); // Utiliser l'échelle calculée dynamiquement
        animatedSprite.position.set(displaySize / 2, displaySize / 2);
        
        // Rotation selon la direction
        updateRotation(animatedSprite, direction);

        animatedSprite.play();
        app.stage.addChild(animatedSprite);
        spriteRef.current = animatedSprite;
      } catch (err) {
        console.error('Error initializing PixiJS:', err);
      }
    };

    initPixi();

    // Nettoyage
    return () => {
      mounted = false;
      if (appRef.current) {
        try {
          appRef.current.destroy(true);
        } catch (e) {
          console.error('Error destroying PixiJS app:', e);
        }
        appRef.current = null;
      }
      spriteRef.current = null;
    };
  }, [isPlayer]);

  // Fonction helper pour mettre à jour la rotation et l'échelle
  // Les sprites sont orientés vers la GAUCHE par défaut
  function updateRotation(sprite, dir) {
    // Réinitialiser l'échelle et la rotation
    sprite.scale.x = Math.abs(sprite.scale.x); // Garder l'échelle positive par défaut
    sprite.rotation = 0;
    
    switch (dir) {
      case 'left':
        // Pas de changement, orientation par défaut (gauche)
        break;
      case 'right':
        // Effet miroir horizontal pour regarder à droite
        sprite.scale.x = -Math.abs(sprite.scale.x);
        break;
      case 'up':
        sprite.rotation = Math.PI / 2; // +90° pour regarder en haut
        break;
      case 'down':
        sprite.rotation = -Math.PI / 2; // -90° pour regarder en bas
        break;
      default:
        // Par défaut: gauche
        break;
    }
  }

  // Mise à jour de la rotation lors du changement de direction
  useEffect(() => {
    if (spriteRef.current) {
      updateRotation(spriteRef.current, direction);
    }
  }, [direction]);

  return (
    <div 
      ref={containerRef} 
      style={{ 
        pointerEvents: 'none',
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    />
  );
}