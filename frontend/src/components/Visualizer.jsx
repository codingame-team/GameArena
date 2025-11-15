import React, { useEffect, useRef, useState } from 'react'
import * as PIXI from 'pixi.js'

import PacmanSprite from './PacmanSprite'
import GameRules from './GameRules'
import PacmanAdvancedRules from './PacmanAdvancedRules'

function PixiGrid({
  state, 
  prevState, 
  winnerMessage, 
  player1Name, 
  player2Name,
  onPlayPause,
  onStepBackward,
  onStepForward,
  onSkipToStart,
  onSkipToEnd,
  onSeek,
  currentIndex,
  totalTurns,
  isAnimating,
  isPaused,
  history
}){
  const canvasRef = useRef(null)
  const containerRef = useRef(null)
  const appRef = useRef(null)
  const gridContainerRef = useRef(null)
  const controlsContainerRef = useRef(null)
  const progressBarRef = useRef(null)
  const pacsSpritesRef = useRef({})
  const spriteSheetsRef = useRef({ red: null, blue: null, tiles: null, extra: null })
  const animationFrameRef = useRef(0)
  const cellSizeRef = useRef(0)
  const [containerSize, setContainerSize] = useState({ width: 800, height: 600 })
  const [spritesLoaded, setSpritesLoaded] = useState(false)
  const [currentAnimFrame, setCurrentAnimFrame] = useState(0)
  const particlePoolRef = useRef([])
  const activeParticlesRef = useRef([])
  
  // Séquence des 8 frames pour un tour complet
  const animationSequence = [1, 2, 3, 4, 4, 3, 2, 1]
  
  const GRID_PADDING = 20
  const CONTROLS_HEIGHT = 100
  const MIN_CELL_SIZE = 40
  const MAX_CELL_SIZE = 100  // Augmenté de 60 à 100 pour un plateau plus grand

  /**
   * Assigne des directions de pacs basées sur les mouvements précédents
   */
  const assignPacDirections = (pacs, prevPacsArray) => {
    const pacDirections = new Map()
    pacs.forEach(pac => {
      const direction = getDirection(pac, prevPacsArray)
      pacDirections.set(pac.id || pac.owner, direction)
    })
    return pacDirections
  }

  // Load sprite sheets
  useEffect(() => {
    console.log('🚀 useEffect loadSprites DÉMARRÉ')
    const loadSprites = async () => {
      try {
        console.log('🔄 Début chargement spritesheets...')

        // Load red pac sprites
        console.log('📥 Chargement red.png...')
        const redTexture = await PIXI.Assets.load('/assets/sprites/red.png')
        console.log('✓ red.png chargé')
        
        console.log('📥 Chargement red.json...')
        const redDataResponse = await fetch('/assets/sprites/red.json')
        const redData = await redDataResponse.json()
        console.log('✓ red.json chargé')

        // Load blue pac sprites
        console.log('📥 Chargement blue.png...')
        const blueTexture = await PIXI.Assets.load('/assets/sprites/blue.png')
        console.log('✓ blue.png chargé')
        
        console.log('📥 Chargement blue.json...')
        const blueDataResponse = await fetch('/assets/sprites/blue.json')
        const blueData = await blueDataResponse.json()
        console.log('✓ blue.json chargé')

        // Load maze tiles
        const tilesTexture = await PIXI.Assets.load('/assets/sprites/tiles_no_padding.png')
        const tilesDataResponse = await fetch('/assets/sprites/tiles_no_padding.json')
        const tilesData = await tilesDataResponse.json()
        
        // Load pellets/cherries
        const extraTexture = await PIXI.Assets.load('/assets/sprites/extra.png')
        const extraDataResponse = await fetch('/assets/sprites/extra.json')
        const extraData = await extraDataResponse.json()

        spriteSheetsRef.current = {
          red: { texture: redTexture, data: redData },
          blue: { texture: blueTexture, data: blueData },
          tiles: { texture: tilesTexture, data: tilesData },
          extra: { texture: extraTexture, data: extraData }
        }

        console.log('✅ Spritesheets chargées avec succès!')
        setSpritesLoaded(true)
        console.log('✅ setSpritesLoaded(true) appelé')
      } catch (error) {
        console.error('❌ Erreur chargement sprites:', error)
        console.error('Stack:', error.stack)
        // Continue without sprites - will use fallback circles
        console.log('⚠️ Fallback: setSpritesLoaded(true) après erreur')
        setSpritesLoaded(true)
      }
      console.log('🏁 Fin de loadSprites()')
    }

    console.log('📞 Appel loadSprites()')
    loadSprites()
  }, [])
  
  // Handle window resize
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        setContainerSize({ 
          width: rect.width || 800, // S'adapte à la largeur réelle du container
          height: rect.height || 600 // S'adapte à la hauteur réelle du container
        })
      }
    }
    
    // Initial size
    updateSize()
    
    // Écouter les redimensionnements de fenêtre
    window.addEventListener('resize', updateSize)
    
    // Utiliser ResizeObserver pour détecter les changements de taille du container
    let resizeObserver
    if (containerRef.current) {
      resizeObserver = new ResizeObserver(updateSize)
      resizeObserver.observe(containerRef.current)
    }
    
    return () => {
      window.removeEventListener('resize', updateSize)
      if (resizeObserver && containerRef.current) {
        resizeObserver.unobserve(containerRef.current)
        resizeObserver.disconnect()
      }
    }
  }, [])
  
  // Initialize PixiJS app when canvas is ready
  useEffect(() => {
    if (!canvasRef.current) {
      console.log('Canvas not ready yet')
      return
    }

    const width = 7 // Default grid size
    const height = 5
    const CELL_SIZE = 60 // Default cell size

    const initApp = async () => {
      if (!appRef.current) {
        try {
          console.log('Initializing PixiJS app...')
          const app = new PIXI.Application()
          await app.init({
            width: width * CELL_SIZE + GRID_PADDING * 2,
            height: height * CELL_SIZE + GRID_PADDING * 2 + CONTROLS_HEIGHT,
            backgroundColor: 0x1a1a2e,
            antialias: true,
            resizeTo: canvasRef.current
          })

          if (canvasRef.current && !appRef.current) {
            console.log('Adding canvas to DOM...')
            canvasRef.current.appendChild(app.canvas)
            appRef.current = app

            console.log('Canvas added to DOM, app initialized:', !!appRef.current)

            // Make canvas responsive
            app.canvas.style.width = '100%'
            app.canvas.style.height = '100%'
            app.canvas.style.objectFit = 'contain'

            // Create grid container
            const gridContainer = new PIXI.Container()
            gridContainer.x = GRID_PADDING
            gridContainer.y = GRID_PADDING
            app.stage.addChild(gridContainer)
            gridContainerRef.current = gridContainer

            // Create controls container
            const controlsContainer = new PIXI.Container()
            controlsContainer.x = GRID_PADDING
            controlsContainer.y = height * CELL_SIZE + GRID_PADDING + 10
            app.stage.addChild(controlsContainer)
            controlsContainerRef.current = controlsContainer

            console.log('PixiJS app initialized successfully with containers')
          }
        } catch (error) {
          console.error('Failed to initialize PixiJS app:', error)
        }
      }
    }

    initApp()

    return () => {
      // Cleanup on unmount
      if (appRef.current && canvasRef.current?.children.length === 0) {
        appRef.current.destroy(true, { children: true, texture: true })
        appRef.current = null
      }
    }
  }, []) // Only depend on canvas availability

  // Render grid when app is ready and state changes
  useEffect(() => {
    console.log('Render effect triggered:', { app: !!appRef.current, state: !!state, spritesLoaded })

    if (!appRef.current || !state) {
      console.log('Skipping render - app or state not ready')
      return
    }

    const width = state?.grid?.[0]?.length || 7
    const height = state?.grid?.length || 5
    const pellets = state.pellets || []
    const cherries = state.cherries || []

    console.log('Rendering grid:', { width, height, pellets: pellets.length, cherries: cherries.length })

    // Calculate optimal cell size based on container size
    const availableWidth = containerSize.width - GRID_PADDING * 2
    const availableHeight = containerSize.height - GRID_PADDING * 2 - CONTROLS_HEIGHT
    const cellSizeByWidth = Math.floor(availableWidth / width)
    const cellSizeByHeight = Math.floor(availableHeight / height)
    const CELL_SIZE = Math.max(MIN_CELL_SIZE, Math.min(MAX_CELL_SIZE, Math.min(cellSizeByWidth, cellSizeByHeight)))

    // Gérer les deux formats de pacs
    let pacsArray = []
    if (state?.pacs) {
      if (Array.isArray(state.pacs)) {
        pacsArray = state.pacs
      } else {
        pacsArray = Object.entries(state.pacs).map(([owner, pos]) => ({
          id: owner,
          owner: owner,
          position: pos
        }))
      }
    }

    console.log('Pacs array:', pacsArray.length, 'pacs')

    const app = appRef.current
    const gridContainer = gridContainerRef.current
    const controlsContainer = controlsContainerRef.current

    if (app && gridContainer && controlsContainer) {
      // Resize canvas if needed
      app.renderer.resize(width * CELL_SIZE + GRID_PADDING * 2, height * CELL_SIZE + GRID_PADDING * 2 + CONTROLS_HEIGHT)

      // Ajuster la taille des sprites si CELL_SIZE a changé
      if (cellSizeRef.current !== CELL_SIZE) {
        Object.values(pacsSpritesRef.current).forEach(sprite => {
          if (sprite && sprite.baseFrameWidth) {
            const newScale = (CELL_SIZE / sprite.baseFrameWidth) * 1.5
            const scaleX = Math.sign(sprite.scale.x) * newScale
            const scaleY = Math.sign(sprite.scale.y) * newScale
            sprite.scale.set(scaleX, scaleY)
          }
        })
        cellSizeRef.current = CELL_SIZE
      }

      // Clear and re-render grid
      gridContainer.removeChildren()
      renderGrid(app, gridContainer, width, height, pellets, cherries, pacsArray, CELL_SIZE, prevState, player1Name, player2Name)
      
      // Détecter les pellets/cherries mangés et créer animations
      if (prevState) {
        const prevPellets = new Set((prevState.pellets || []).map(p => `${p[0]},${p[1]}`))
        const currPellets = new Set(pellets.map(p => `${p[0]},${p[1]}`))
        const prevCherries = new Set((prevState.cherries || []).map(c => `${c[0]},${c[1]}`))
        const currCherries = new Set(cherries.map(c => `${c[0]},${c[1]}`))
        
        prevPellets.forEach(key => {
          if (!currPellets.has(key)) {
            const [x, y] = key.split(',').map(Number)
            createSplashAnimation(gridContainer, x * CELL_SIZE + CELL_SIZE / 2, y * CELL_SIZE + CELL_SIZE / 2, 1, CELL_SIZE)
          }
        })
        
        prevCherries.forEach(key => {
          if (!currCherries.has(key)) {
            const [x, y] = key.split(',').map(Number)
            createSplashAnimation(gridContainer, x * CELL_SIZE + CELL_SIZE / 2, y * CELL_SIZE + CELL_SIZE / 2, 2, CELL_SIZE)
          }
        })
      }

      // Update controls position and re-render
      controlsContainer.y = height * CELL_SIZE + GRID_PADDING + 10
      controlsContainer.removeChildren()
      renderControls(app, controlsContainer, width * CELL_SIZE, CELL_SIZE)

      // Mettre à jour les textures des sprites après le rendu
      updatePacSpriteTextures(pacsArray)

      console.log('Grid rendered successfully')
    } else {
      console.log('Missing containers:', { app: !!app, gridContainer: !!gridContainer, controlsContainer: !!controlsContainer })
    }
  }, [state, prevState, containerSize, spritesLoaded, currentAnimFrame])

  // Trigger initial render when app becomes available
  useEffect(() => {
    if (appRef.current && state && gridContainerRef.current) {
      console.log('App and containers ready, triggering render')
      // Force re-render by updating containerSize
      setContainerSize(prev => ({ ...prev }))
    }
  }, [appRef.current, state])

  // Animation automatique des 8 frames pendant les transitions
  useEffect(() => {
    if (!isAnimating || isPaused) return
    
    const interval = setInterval(() => {
      setCurrentAnimFrame(prev => {
        const next = (prev + 1) % 8
        console.log(`Animation frame: ${prev} -> ${next}`)
        return next
      })
    }, 150)
    
    return () => clearInterval(interval)
  }, [isAnimating, isPaused])
  
  // Réinitialiser l'animation au changement de tour
  useEffect(() => {
    console.log(`Tour changé: ${currentIndex}, reset animation frame`)
    setCurrentAnimFrame(0)
  }, [currentIndex])
  
  // Mettre à jour les textures quand la frame d'animation change
  useEffect(() => {
    console.log(`currentAnimFrame changé: ${currentAnimFrame}, spritesLoaded: ${spritesLoaded}`)
    if (state?.pacs) {
      const pacsArray = Array.isArray(state.pacs) ? state.pacs : Object.entries(state.pacs).map(([owner, pos]) => ({
        id: owner,
        owner: owner,
        position: pos
      }))
      updatePacSpriteTextures(pacsArray)
    }
  }, [currentAnimFrame, spritesLoaded, state])

  const animationFrameIndexRef = useRef(0)
  
  const createSplashAnimation = (container, x, y, size, CELL_SIZE) => {
    const extraSheet = spriteSheetsRef.current.extra
    if (!extraSheet || !extraSheet.texture || !extraSheet.data) return
    
    const frameData = extraSheet.data.frames['particle']
    if (!frameData) return
    
    const frame = frameData.frame
    const particleCount = 8
    const particles = []
    
    for (let i = 0; i < particleCount; i++) {
      const texture = new PIXI.Texture({
        source: extraSheet.texture.source,
        frame: new PIXI.Rectangle(frame.x, frame.y, frame.w, frame.h)
      })
      
      const particle = new PIXI.Sprite(texture)
      particle.anchor.set(0.5)
      particle.x = x
      particle.y = y
      particle.scale.set(size * (CELL_SIZE / 200))
      
      const angle = (Math.PI * 2 * i) / particleCount
      const speed = (Math.random() * 100 + 50 + (size > 1 ? 50 : 0)) * (CELL_SIZE / 100)
      
      particle.userData = {
        startTime: Date.now(),
        duration: 600,
        angle,
        speed,
        baseSize: size * (CELL_SIZE / 200),
        startX: x,
        startY: y
      }
      
      container.addChild(particle)
      particles.push(particle)
      activeParticlesRef.current.push(particle)
    }
  }
  
  // Animation loop pour les particules
  useEffect(() => {
    if (!appRef.current) return
    
    const animate = () => {
      const now = Date.now()
      const toRemove = []
      
      activeParticlesRef.current.forEach((particle, idx) => {
        const elapsed = now - particle.userData.startTime
        const progress = Math.min(elapsed / particle.userData.duration, 1)
        
        if (progress >= 1) {
          toRemove.push(idx)
          if (particle.parent) {
            particle.parent.removeChild(particle)
          }
          particle.destroy()
        } else {
          particle.x = particle.userData.startX + Math.cos(particle.userData.angle) * particle.userData.speed * progress
          particle.y = particle.userData.startY + Math.sin(particle.userData.angle) * particle.userData.speed * progress
          particle.scale.set(particle.userData.baseSize * (1 - progress))
          particle.alpha = 1 - progress
        }
      })
      
      toRemove.reverse().forEach(idx => {
        activeParticlesRef.current.splice(idx, 1)
      })
      
      if (activeParticlesRef.current.length > 0) {
        requestAnimationFrame(animate)
      }
    }
    
    if (activeParticlesRef.current.length > 0) {
      requestAnimationFrame(animate)
    }
  }, [state])

  // Fonction pour mettre à jour les textures des sprites de pacs
  const updatePacSpriteTextures = (pacsArray) => {
    if (!appRef.current) {
      console.log('updatePacSpriteTextures: app non initialisée')
      return
    }
    
    const spriteCount = Object.keys(pacsSpritesRef.current).length
    console.log(`Mise à jour textures - Frame ${currentAnimFrame}/${animationSequence.length}, ${spriteCount} sprites, spritesLoaded: ${spritesLoaded}`)
    
    if (spriteCount === 0) {
      console.log('Aucun sprite à mettre à jour')
      return
    }
    
    if (!spritesLoaded) {
      console.log('Sprites pas encore chargés, skip update')
      return
    }
    
    Object.entries(pacsSpritesRef.current).forEach(([pacId, sprite]) => {
      if (!sprite) return
      
      // Déterminer la couleur du pac depuis l'owner stocké dans le sprite
      const isPlayer = sprite.pacOwner === 'player'
      const pacColor = isPlayer ? 'red' : 'blue'
      const spriteSheet = spriteSheetsRef.current[pacColor]
      
      if (!spriteSheet || !spriteSheet.data) {
        console.warn(`SpriteSheet ${pacColor} non disponible`)
        return
      }
      
      // Récupérer le vrai type du pac depuis le state
      const pacData = pacsArray.find(p => (p.id || p.owner) === pacId)
      if (!pacData) return
      
      // Convertir le type string en nombre
      let refereeType = 0
      if (typeof pacData.type === 'string') {
        if (pacData.type === 'ROCK') refereeType = 0
        else if (pacData.type === 'PAPER') refereeType = 1
        else if (pacData.type === 'SCISSORS') refereeType = 2
        else if (pacData.type === 'NEUTRAL') refereeType = -1
      } else {
        refereeType = pacData.type ?? 0
      }
      
      // Mapping: referee (-1=NEUTRAL,0=ROCK,1=PAPER,2=SCISSORS) -> sprites (1=NEUTRAL,4=ROCK,3=PAPER,2=SCISSORS)
      const spriteType = refereeType === -1 ? 1 : refereeType === 0 ? 4 : refereeType === 1 ? 3 : 2
      const frameNum = animationSequence[currentAnimFrame]
      const frameName = `paku_${pacColor}_${spriteType}_walk000${frameNum}`
      
      const frameData = spriteSheet.data.frames[frameName]
      if (frameData) {
        const frame = frameData.frame
        const texture = new PIXI.Texture({
          source: spriteSheet.texture.source,
          frame: new PIXI.Rectangle(frame.x, frame.y, frame.w, frame.h)
        })
        sprite.texture = texture
        console.log(`✓ Pac ${pacId}: frame ${frameName}`)
      } else {
        console.warn(`✗ Frame non trouvée: ${frameName}`)
      }
    })
    
    // Forcer le rendu PixiJS
    appRef.current.renderer.render(appRef.current.stage)
    console.log('Rendu PixiJS forcé')
  }



  const getDirection = (pac, prevPacsArray) => {
    if (!prevPacsArray || !pac.position) return 1 // Default: right
    
    const prevPac = prevPacsArray.find(p => p.id === pac.id)
    if (!prevPac || !prevPac.position) return 1
    
    const [x, y] = pac.position
    const [px, py] = prevPac.position
    
    if (x > px) return 2 // Right
    if (x < px) return 4 // Left
    if (y > py) return 3 // Down
    if (y < py) return 1 // Up
    
    return 2 // Default: right
  }
  
  const createPacSprite = (pac, direction, CELL_SIZE, prevPacsArray) => {
    const isPlayer = pac.owner === 'player'
    const spriteSheet = isPlayer ? spriteSheetsRef.current.red : spriteSheetsRef.current.blue
    
    if (!spriteSheet || !spriteSheet.texture || !spriteSheet.data) {
      return null
    }
    
    // Convertir le type string en nombre
    let refereeType = 0
    if (typeof pac.type === 'string') {
      if (pac.type === 'ROCK') refereeType = 0
      else if (pac.type === 'PAPER') refereeType = 1
      else if (pac.type === 'SCISSORS') refereeType = 2
      else if (pac.type === 'NEUTRAL') refereeType = -1
    } else {
      refereeType = pac.type ?? 0
    }
    
    // Mapping: referee (-1=NEUTRAL,0=ROCK,1=PAPER,2=SCISSORS) -> sprites (1=NEUTRAL,4=ROCK,3=PAPER,2=SCISSORS)
    const spriteType = refereeType === -1 ? 1 : refereeType === 0 ? 4 : refereeType === 1 ? 3 : 2
    const frameNum = 1 // Premier frame pour l'initialisation
    const frameName = `paku_${isPlayer ? 'red' : 'blue'}_${spriteType}_walk000${frameNum}`
    
    const frameData = spriteSheet.data.frames[frameName]
    if (!frameData) {
      console.warn(`Frame not found: ${frameName}`)
      return null
    }
    
    const frame = frameData.frame
    const texture = new PIXI.Texture({
      source: spriteSheet.texture.source,
      frame: new PIXI.Rectangle(frame.x, frame.y, frame.w, frame.h)
    })
    
    const sprite = new PIXI.Sprite(texture)
    const scale = (CELL_SIZE / frame.w) * 1.5 // 150% de la cellule
    sprite.scale.set(scale)
    sprite.anchor.set(0.5)
    sprite.baseFrameWidth = frame.w // Stocker la largeur de base pour le redimensionnement
    
    return sprite
  }
  
  const renderGrid = (app, container, width, height, pellets, cherries, pacsArray, CELL_SIZE, prevState, player1Name, player2Name) => {
    // Tooltip container
    const tooltipRef = { current: null }
    
    // Draw grid background
    const bg = new PIXI.Graphics()
    bg.rect(0, 0, width * CELL_SIZE, height * CELL_SIZE)
    bg.fill(0x0f0f1e)
    container.addChild(bg)
    
    // Draw floor tiles first
    const tilesSheet = spriteSheetsRef.current.tiles
    if (tilesSheet && tilesSheet.texture && tilesSheet.data) {
      const floorFrame = tilesSheet.data.frames['floor']
      if (floorFrame) {
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            if (!state.grid || !state.grid[y] || state.grid[y][x] !== '#') {
              const frame = floorFrame.frame
              const texture = new PIXI.Texture({
                source: tilesSheet.texture.source,
                frame: new PIXI.Rectangle(frame.x, frame.y, frame.w, frame.h)
              })
              const floorSprite = new PIXI.Sprite(texture)
              floorSprite.x = x * CELL_SIZE
              floorSprite.y = y * CELL_SIZE
              floorSprite.width = CELL_SIZE
              floorSprite.height = CELL_SIZE
              container.addChild(floorSprite)
            }
          }
        }
      }
      
      // Draw walls
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          if (state.grid && state.grid[y] && state.grid[y][x] === '#') {
            let mask = 0
            const isWall = (cy, cx) => {
              // Wrapping horizontal
              if (cx < 0) cx = width - 1
              if (cx >= width) cx = 0
              // Pas de wrapping vertical (bordures = murs)
              if (cy < 0 || cy >= height) return true
              return state.grid[cy] && state.grid[cy][cx] === '#'
            }
            
            if (isWall(y - 1, x)) mask += 2
            if (isWall(y, x + 1)) mask += 16
            if (isWall(y + 1, x)) mask += 64
            if (isWall(y, x - 1)) mask += 8
            if ((mask & 10) === 10 && isWall(y - 1, x - 1)) mask += 1
            if ((mask & 18) === 18 && isWall(y - 1, x + 1)) mask += 4
            if ((mask & 72) === 72 && isWall(y + 1, x - 1)) mask += 32
            if ((mask & 80) === 80 && isWall(y + 1, x + 1)) mask += 128
            
            const frameData = tilesSheet.data.frames[String(mask)]
            if (frameData) {
              const frame = frameData.frame
              const texture = new PIXI.Texture({
                source: tilesSheet.texture.source,
                frame: new PIXI.Rectangle(frame.x, frame.y, frame.w, frame.h)
              })
              const tileSprite = new PIXI.Sprite(texture)
              tileSprite.x = x * CELL_SIZE
              tileSprite.y = y * CELL_SIZE
              tileSprite.width = CELL_SIZE
              tileSprite.height = CELL_SIZE
              container.addChild(tileSprite)
            }
          }
        }
      }
    } else {
      // Fallback si tuiles non chargées
      const walls = new PIXI.Graphics()
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          if (state.grid && state.grid[y] && state.grid[y][x] === '#') {
            walls.rect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE)
            walls.fill(0x1a4d7a)
          }
        }
      }
      container.addChild(walls)
    }
    
    // Ajouter zones interactives pour chaque cellule (tooltip coordonnées)
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const cellHitArea = new PIXI.Graphics()
        cellHitArea.rect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE)
        cellHitArea.fill(0x000000, 0.0) // Invisible
        cellHitArea.eventMode = 'static'
        cellHitArea.cursor = 'crosshair'
        
        cellHitArea.on('pointerover', () => {
          if (tooltipRef.current) container.removeChild(tooltipRef.current)
          
          const tooltip = new PIXI.Container()
          const tooltipBg = new PIXI.Graphics()
          tooltipBg.rect(0, 0, 60, 25)
          tooltipBg.fill(0x000000, 0.8)
          tooltipBg.stroke({ width: 1, color: 0xffffff })
          
          const tooltipText = new PIXI.Text({
            text: `(${x}, ${y})`,
            style: { fontFamily: 'Arial', fontSize: 12, fill: 0xffffff }
          })
          tooltipText.x = 5
          tooltipText.y = 5
          
          tooltip.addChild(tooltipBg)
          tooltip.addChild(tooltipText)
          tooltip.x = x * CELL_SIZE + CELL_SIZE / 2 - 30
          tooltip.y = y * CELL_SIZE - 30
          
          container.addChild(tooltip)
          tooltipRef.current = tooltip
        })
        
        cellHitArea.on('pointerout', () => {
          if (tooltipRef.current) {
            container.removeChild(tooltipRef.current)
            tooltipRef.current = null
          }
        })
        
        container.addChild(cellHitArea)
      }
    }
    
    // Compter les pacs vivants par équipe
    const bluePacsAlive = pacsArray.filter(p => p.owner === 'player' && !p.dead).length
    const redPacsAlive = pacsArray.filter(p => p.owner === 'opponent' && !p.dead).length
    
    // Afficher le compteur en haut à gauche
    const counterText = new PIXI.Text({
      text: `🔵 ${bluePacsAlive}  🔴 ${redPacsAlive}`,
      style: {
        fontFamily: 'Arial',
        fontSize: 20,
        fontWeight: 'bold',
        fill: 0xffffff,
        stroke: { color: 0x000000, width: 3 }
      }
    })
    counterText.x = 10
    counterText.y = 10
    container.addChild(counterText)
    
    // Draw grid lines
    const grid = new PIXI.Graphics()
    grid.setStrokeStyle({ width: 1, color: 0x2a2a3e, alpha: 0.3 })
    for (let x = 0; x <= width; x++) {
      grid.moveTo(x * CELL_SIZE, 0)
      grid.lineTo(x * CELL_SIZE, height * CELL_SIZE)
    }
    for (let y = 0; y <= height; y++) {
      grid.moveTo(0, y * CELL_SIZE)
      grid.lineTo(width * CELL_SIZE, y * CELL_SIZE)
    }
    container.addChild(grid)
    
    // Draw pellets using CodinGame sprites
    const extraSheet = spriteSheetsRef.current.extra
    if (extraSheet && extraSheet.texture && extraSheet.data) {
      const pelletSet = new Set(pellets.map(p => `${p[0]},${p[1]}`))
      pelletSet.forEach(key => {
        const [x, y] = key.split(',').map(Number)
        const frameData = extraSheet.data.frames['Bonusx1']
        if (frameData) {
          const frame = frameData.frame
          const texture = new PIXI.Texture({
            source: extraSheet.texture.source,
            frame: new PIXI.Rectangle(frame.x, frame.y, frame.w, frame.h)
          })
          const pelletSprite = new PIXI.Sprite(texture)
          pelletSprite.anchor.set(0.5)
          pelletSprite.x = x * CELL_SIZE + CELL_SIZE / 2
          pelletSprite.y = y * CELL_SIZE + CELL_SIZE / 2
          pelletSprite.width = CELL_SIZE * 0.3
          pelletSprite.height = CELL_SIZE * 0.3
          container.addChild(pelletSprite)
        }
      })
      
      // Draw cherries
      const cherrySet = new Set(cherries.map(c => `${c[0]},${c[1]}`))
      cherrySet.forEach(key => {
        const [x, y] = key.split(',').map(Number)
        const frameData = extraSheet.data.frames['Bonusx5']
        if (frameData) {
          const frame = frameData.frame
          const texture = new PIXI.Texture({
            source: extraSheet.texture.source,
            frame: new PIXI.Rectangle(frame.x, frame.y, frame.w, frame.h)
          })
          const cherrySprite = new PIXI.Sprite(texture)
          cherrySprite.anchor.set(0.5)
          cherrySprite.x = x * CELL_SIZE + CELL_SIZE / 2
          cherrySprite.y = y * CELL_SIZE + CELL_SIZE / 2
          cherrySprite.width = CELL_SIZE * 0.6
          cherrySprite.height = CELL_SIZE * 0.6
          container.addChild(cherrySprite)
        }
      })
    }
    
    // Gérer les deux formats de pacs pour prevState
    let prevPacsArray = []
    if (prevState?.pacs) {
      if (Array.isArray(prevState.pacs)) {
        prevPacsArray = prevState.pacs
      } else {
        prevPacsArray = Object.entries(prevState.pacs).map(([owner, pos]) => ({
          id: owner,
          owner: owner,
          position: pos
        }))
      }
    }

    // Assigner les directions des pacs
    const pacDirections = assignPacDirections(pacsArray, prevPacsArray)

    // Détecter les pacs morts via le flag 'dead' dans l'état
    const deadPacs = pacsArray.filter(p => p.dead === true)
    const alivePacs = pacsArray.filter(p => !p.dead)

    // Combiner pacs vivants et morts pour le rendu
    const allPacsToRender = pacsArray

    // Nettoyer les sprites des pacs qui ne sont plus présents (ni vivants ni morts ce tour)
    const activePacIds = new Set(allPacsToRender.map(pac => pac.id || pac.owner))
    Object.keys(pacsSpritesRef.current).forEach(pacId => {
      if (!activePacIds.has(pacId)) {
        const sprite = pacsSpritesRef.current[pacId]
        if (sprite && container.children.includes(sprite)) {
          container.removeChild(sprite)
        }
        delete pacsSpritesRef.current[pacId]
        console.log(`Sprite nettoyé pour pac ${pacId}`)
      }
    })

    // Draw pacs with animated sprites
    allPacsToRender.forEach(pac => {
      if (!pac.position) return
      const [x, y] = pac.position

      // Déterminer la couleur du pac (player = red, opponent = blue)
      console.log(`Pac ${pac.id}: owner="${pac.owner}"`)
      const isPlayer = pac.owner === 'player'
      const pacColor = isPlayer ? 'red' : 'blue'
      console.log(`Pac ${pac.id}: isPlayer=${isPlayer}, pacColor=${pacColor}`)
      const direction = pacDirections.get(pac.id || pac.owner) || 1

      // Créer ou récupérer le sprite du pac
      let pacSprite = pacsSpritesRef.current[pac.id || pac.owner]

      if (!pacSprite) {
        // Créer un nouveau sprite animé avec les spritesheets blue.png/red.png
        pacSprite = createPacSprite(pac, 1, CELL_SIZE, prevPacsArray)
        if (pacSprite) {
          // Stocker l'owner avec le sprite pour updatePacSpriteTextures
          pacSprite.pacOwner = pac.owner
          pacsSpritesRef.current[pac.id || pac.owner] = pacSprite
          console.log(`Pac ${pac.id || pac.owner} créé avec sprite animé`)
        }
      }

      if (pacSprite) {
        // Déterminer si le pac est mort via le flag 'dead'
        const isDead = pac.dead === true
        
        if (isDead) {
          console.log(`☠️ Pac ${pac.id} is DEAD! Playing death animation`)
        }
        
        let animationType = 'walk'
        let animationFrameCount = 4
        
        if (isDead) {
          animationType = 'death'
          animationFrameCount = 7
          console.log(`  → Animation type: ${animationType}, frames: ${animationFrameCount}`)
        } else if (prevPacsArray && pac.position) {
          const prevPac = prevPacsArray.find(p => (p.id || p.owner) === (pac.id || pac.owner))
          if (prevPac && prevPac.position) {
            const returnedToStart = prevPac.position[0] === pac.position[0] && prevPac.position[1] === pac.position[1]
            
            if (returnedToStart) {
              // Collision = blocage
              animationType = 'blocked'
              animationFrameCount = 4
            }
          }
        }

        const spriteSheet = spriteSheetsRef.current[pacColor]
        if (spriteSheet && spriteSheet.texture && spriteSheet.data) {
          // Convertir le type string en nombre
          let refereeType = 0
          if (typeof pac.type === 'string') {
            if (pac.type === 'ROCK') refereeType = 0
            else if (pac.type === 'PAPER') refereeType = 1
            else if (pac.type === 'SCISSORS') refereeType = 2
            else if (pac.type === 'NEUTRAL') refereeType = -1
          } else {
            refereeType = pac.type ?? 0
          }
          const spriteType = refereeType === -1 ? 1 : refereeType === 0 ? 4 : refereeType === 1 ? 3 : 2
          const frameNum = (currentAnimFrame % animationFrameCount) + 1
          
          let frameName
          if (animationType === 'death') {
            frameName = `paku_${pacColor}_${spriteType}_mort000${frameNum}`
          } else if (animationType === 'blocked') {
            frameName = `paku_${pacColor}_${spriteType}_blocked000${frameNum}`
          } else {
            frameName = `paku_${pacColor}_${spriteType}_walk000${frameNum}`
          }

          const frameData = spriteSheet.data.frames[frameName]
          if (frameData) {
            const frame = frameData.frame
            const texture = new PIXI.Texture({
              source: spriteSheet.texture.source,
              frame: new PIXI.Rectangle(frame.x, frame.y, frame.w, frame.h)
            })
            pacSprite.texture = texture
          }
        }

        // Positionner le sprite
        pacSprite.x = x * CELL_SIZE + CELL_SIZE/2
        pacSprite.y = y * CELL_SIZE + CELL_SIZE/2

        // Orienter le sprite selon la direction (les sprites regardent vers la gauche par défaut)
        const baseScale = Math.abs(pacSprite.scale.x) // Préserver le scale de base
        pacSprite.rotation = 0 // Reset rotation
        
        if (direction === 2) {
          // Direction droite : retournement horizontal
          pacSprite.scale.set(-baseScale, baseScale)
        } else if (direction === 1) {
          // Direction haut : rotation 90° sens des aiguilles d'une montre
          pacSprite.scale.set(baseScale, baseScale)
          pacSprite.rotation = Math.PI / 2
        } else if (direction === 3) {
          // Direction bas : rotation 90° sens trigonométrique
          pacSprite.scale.set(baseScale, baseScale)
          pacSprite.rotation = -Math.PI / 2
        } else {
          // Direction 4 (gauche) : pas de transformation (orientation par défaut)
          pacSprite.scale.set(baseScale, baseScale)
        }
        
        // Rendre le sprite interactif pour tooltip
        pacSprite.eventMode = 'static'
        pacSprite.cursor = 'pointer'
        
        // Tooltip pour le pac
        pacSprite.on('pointerover', () => {
          const tooltip = new PIXI.Container()
          const ownerName = pac.owner === 'player' ? player1Name : player2Name
          const lines = [
            `Pac ${pac.id}`,
            `Owner: ${ownerName}`,
            `Type: ${pac.type || 'N/A'}`,
            `Pos: (${x}, ${y})`,
            pac.speed > 1 ? `SPEED: ${pac.ability_duration}` : '',
            pac.ability_cooldown > 0 ? `Cooldown: ${pac.ability_cooldown}` : ''
          ].filter(l => l)
          
          const tooltipBg = new PIXI.Graphics()
          tooltipBg.rect(0, 0, 120, lines.length * 18 + 10)
          tooltipBg.fill(0x000000, 0.9)
          tooltipBg.stroke({ width: 2, color: isPlayer ? 0x4444ff : 0xff4444 })
          
          tooltip.addChild(tooltipBg)
          
          lines.forEach((line, i) => {
            const text = new PIXI.Text({
              text: line,
              style: { fontFamily: 'Arial', fontSize: 12, fill: 0xffffff }
            })
            text.x = 5
            text.y = 5 + i * 18
            tooltip.addChild(text)
          })
          
          tooltip.x = x * CELL_SIZE + CELL_SIZE
          tooltip.y = y * CELL_SIZE
          tooltip.zIndex = 1000
          
          pacSprite.pacTooltip = tooltip
          container.addChild(tooltip)
        })
        
        pacSprite.on('pointerout', () => {
          if (pacSprite.pacTooltip) {
            container.removeChild(pacSprite.pacTooltip)
            pacSprite.pacTooltip = null
          }
        })

        // S'assurer que le sprite est dans le container
        if (!container.children.includes(pacSprite)) {
          container.addChild(pacSprite)
        }
      } else {
        // Fallback to simple circle if sprite fails
        const fallbackSprite = new PIXI.Graphics()
        const color = isPlayer ? 0xffff00 : 0x00ffff

        fallbackSprite.circle(x * CELL_SIZE + CELL_SIZE/2, y * CELL_SIZE + CELL_SIZE/2, CELL_SIZE/2 - 5)
        fallbackSprite.fill(color)

        container.addChild(fallbackSprite)
      }
    })
    
    // Winner overlay
    if (winnerMessage) {
      const overlay = new PIXI.Graphics()
      overlay.rect(0, 0, width * CELL_SIZE, height * CELL_SIZE)
      overlay.fill(0x000000, 0.85)
      container.addChild(overlay)
      
      const winnerText = new PIXI.Text({
        text: winnerMessage.text,
        style: {
          fontFamily: 'Arial',
          fontSize: 32,
          fontWeight: 'bold',
          fill: winnerMessage.color,
          align: 'center'
        }
      })
      winnerText.anchor.set(0.5)
      winnerText.x = width * CELL_SIZE / 2
      winnerText.y = height * CELL_SIZE / 2
      container.addChild(winnerText)
    }
  }
  
  const renderControls = (app, container, containerWidth, CELL_SIZE) => {
    const buttonWidth = 50
    const buttonHeight = 40
    const buttonSpacing = 10
    const totalButtonsWidth = (buttonWidth * 5) + (buttonSpacing * 4)
    const startX = (containerWidth - totalButtonsWidth) / 2
    
    // Progress bar
    const progressBarWidth = containerWidth - 40
    const progressBarHeight = 20
    const progressBarY = 10
    
    // Progress bar background
    const progressBg = new PIXI.Graphics()
    progressBg.rect(20, progressBarY, progressBarWidth, progressBarHeight)
    progressBg.fill(0x2a2a3e)
    progressBg.stroke({ width: 1, color: 0x4a4a5e })
    container.addChild(progressBg)
    
    // Progress bar fill - basé sur les tours de jeu
    const progress = (totalTurns > 0 ? currentIndex / (totalTurns - 1) : 0)
    const progressFill = new PIXI.Graphics()
    progressFill.rect(20, progressBarY, progressBarWidth * progress, progressBarHeight)
    progressFill.fill(0x4CAF50)
    container.addChild(progressFill)
    
    // Progress text - afficher le tour de jeu
    const progressText = new PIXI.Text({
      text: `Tour ${currentIndex} / ${totalTurns - 1}`,
      style: {
        fontFamily: 'Arial',
        fontSize: 14,
        fill: 0xffffff
      }
    })
    progressText.anchor.set(0.5)
    progressText.x = containerWidth / 2
    progressText.y = progressBarY + progressBarHeight / 2
    container.addChild(progressText)
    
    // Make progress bar interactive - navigation tour par tour
    progressBg.eventMode = 'static'
    progressBg.cursor = 'pointer'
    progressBg.on('pointerdown', (event) => {
      const localX = event.data.getLocalPosition(container).x - 20
      const clickProgress = Math.max(0, Math.min(1, localX / progressBarWidth))
      
      // Naviguer dans les tours de jeu
      const newIndex = Math.floor(clickProgress * (totalTurns - 1))
      if (onSeek) onSeek(newIndex)
    })
    
    // Buttons
    const buttons = [
      { label: '⏮', action: onSkipToStart },
      { label: '◀', action: onStepBackward },
      { label: isAnimating && !isPaused ? '⏸' : '▶', action: onPlayPause },
      { label: '▶', action: onStepForward },
      { label: '⏭', action: onSkipToEnd }
    ]
    
    buttons.forEach((btn, i) => {
      const x = startX + i * (buttonWidth + buttonSpacing)
      const y = progressBarY + progressBarHeight + 20
      
      // Button background
      const button = new PIXI.Graphics()
      button.rect(x, y, buttonWidth, buttonHeight)
      button.fill(0x3a3a4e)
      button.stroke({ width: 2, color: 0x5a5a7e })
      button.eventMode = 'static'
      button.cursor = 'pointer'
      
      // Button text
      const buttonText = new PIXI.Text({
        text: btn.label,
        style: {
          fontFamily: 'Arial',
          fontSize: 20,
          fill: 0xffffff
        }
      })
      buttonText.anchor.set(0.5)
      buttonText.x = x + buttonWidth / 2
      buttonText.y = y + buttonHeight / 2
      
      // Button hover effect
      button.on('pointerover', () => {
        button.clear()
        button.rect(x, y, buttonWidth, buttonHeight)
        button.fill(0x4a4a6e)
        button.stroke({ width: 2, color: 0x6a6a8e })
      })
      
      button.on('pointerout', () => {
        button.clear()
        button.rect(x, y, buttonWidth, buttonHeight)
        button.fill(0x3a3a4e)
        button.stroke({ width: 2, color: 0x5a5a7e })
      })
      
      button.on('pointerdown', () => {
        if (btn.action) btn.action()
      })
      
      container.addChild(button)
      container.addChild(buttonText)
    })
  }
  
  return (
    <div 
      ref={containerRef} 
      style={{ 
        width: '100%',
        height: '100%',
        display: 'flex', 
        justifyContent: 'center',
        alignItems: 'center',
        padding: '10px',
        boxSizing: 'border-box'
      }}
    >
      <div 
        ref={canvasRef} 
        style={{ 
          display: 'inline-block',
          width: '100%',
          height: '100%',
          border: '1px solid red' // Debug border
        }} 
      />
      {/* Debug info */}
      <div style={{ position: 'absolute', top: '10px', right: '10px', background: 'rgba(0,0,0,0.8)', color: 'white', padding: '5px', fontSize: '12px' }}>
        Canvas: {canvasRef.current ? 'OK' : 'NULL'} | 
        App: {appRef.current ? 'OK' : 'NULL'} | 
        Sprites: {spritesLoaded ? 'OK' : 'LOADING'}
      </div>
    </div>
  )
}

function IdleAnimation() {
  const canvasRef = useRef(null)
  const [animFrame, setAnimFrame] = useState(0)
  
  useEffect(() => {
    const interval = setInterval(() => {
      setAnimFrame(prev => (prev + 1) % 4)
    }, 200)
    return () => clearInterval(interval)
  }, [])
  
  useEffect(() => {
    if (!canvasRef.current) return
    
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const width = canvas.width
    const height = canvas.height
    
    // Clear
    ctx.fillStyle = '#0f0f1e'
    ctx.fillRect(0, 0, width, height)
    
    // Draw Pac-Man chasing pellets
    const pacSize = 40
    const pacY = height / 2
    const pelletSpacing = 80
    const offset = (animFrame * 20) % pelletSpacing
    
    // Draw pellets
    ctx.fillStyle = '#ffffff'
    for (let i = 0; i < 8; i++) {
      const x = i * pelletSpacing + offset
      if (x > 0 && x < width) {
        ctx.beginPath()
        ctx.arc(x, pacY, 4, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    
    // Draw Pac-Man
    const pacX = width / 3
    const mouthAngle = 0.2 + Math.sin(animFrame * Math.PI / 2) * 0.15
    
    ctx.fillStyle = '#ffff00'
    ctx.beginPath()
    ctx.arc(pacX, pacY, pacSize / 2, mouthAngle * Math.PI, (2 - mouthAngle) * Math.PI)
    ctx.lineTo(pacX, pacY)
    ctx.closePath()
    ctx.fill()
    
    // Eye
    ctx.fillStyle = '#000000'
    ctx.beginPath()
    ctx.arc(pacX, pacY - 10, 4, 0, Math.PI * 2)
    ctx.fill()
    
  }, [animFrame])
  
  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center', 
      height: '100%',
      gap: '20px'
    }}>
      <canvas 
        ref={canvasRef} 
        width={600} 
        height={200}
        style={{
          border: '2px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '8px',
          background: '#0f0f1e'
        }}
      />
      <div style={{
        fontSize: '18px',
        color: '#888',
        textAlign: 'center'
      }}>
        👾 Sélectionnez les joueurs et cliquez sur "▶ Run Code" pour démarrer
      </div>
    </div>
  )
}

export default function Visualizer({
  history,
  index,
  onPlayPause,
  onStepBackward,
  onStepForward,
  onSkipToStart,
  onSkipToEnd,
  onSeek,
  onUserSeekStart,
  progressRatio,
  currentIndex,
  totalTurns,
  animationDelay,
  setAnimationDelay,
  isAnimating,
  isPaused,
  player1Name = 'Joueur 1',
  player2Name = 'Joueur 2',
  currentLeague = 'wood'
}){
  // If no valid index is provided (e.g. -1), show the initial state (turn 0) when available.
  const safeIndex = (typeof index === 'number' && index >= 0) ? index : (Array.isArray(history) && history.length > 0 ? 0 : -1)
  const entry = (Array.isArray(history) && history.length > 0 && safeIndex >= 0) ? history[safeIndex] : null
  const state = entry && entry.state ? entry.state : (Array.isArray(history) && history.length > 0 ? history[0].state : null)
  
  // Get previous state for direction calculation
  const prevIndex = safeIndex > 0 ? safeIndex - 1 : -1
  const prevEntry = (Array.isArray(history) && history.length > 0 && prevIndex >= 0) ? history[prevIndex] : null
  const prevState = prevEntry && prevEntry.state ? prevEntry.state : null
  
  // Déterminer le message du gagnant
  const winner = state?.winner
  let winnerMessage = null
  if (winner === 'player') {
    winnerMessage = { text: `${player1Name} gagne ! 🎉`, color: '#ff4444' }
  } else if (winner === 'opponent') {
    winnerMessage = { text: `${player2Name} gagne !`, color: '#4444ff' }
  } else if (winner === 'draw') {
    winnerMessage = { text: 'Match nul !', color: '#ffaa00' }
  }

  console.log('Visualizer render:', {
    hasHistory: !!(history && history.length > 0),
    safeIndex,
    hasState: !!state,
    winnerMessage
  })

  return (
    <div className="visualizer" data-component="Visualizer">
      {/* Show idle animation if no history, otherwise show PixiGrid */}
      <div className="visualizer-canvas" data-component="Visualizer.Canvas">
        {(!history || history.length === 0) ? (
          <IdleAnimation />
        ) : (
          <PixiGrid 
            state={state} 
            prevState={prevState} 
            winnerMessage={winnerMessage}
            player1Name={player1Name}
            player2Name={player2Name}
            onPlayPause={onPlayPause}
            onStepBackward={onStepBackward}
            onStepForward={onStepForward}
            onSkipToStart={onSkipToStart}
            onSkipToEnd={onSkipToEnd}
            onSeek={onSeek}
            currentIndex={currentIndex}
            totalTurns={totalTurns}
            isAnimating={isAnimating}
            isPaused={isPaused}
            history={history}
          />
        )}
      </div>

      {/* Game Rules Block - Always visible - CodinGame Style */}
      {['wood2', 'wood1'].includes(currentLeague.toLowerCase()) ? (
        <GameRules league={currentLeague} />
      ) : (
        <PacmanAdvancedRules league={currentLeague} />
      )}
    </div>
  )
}
