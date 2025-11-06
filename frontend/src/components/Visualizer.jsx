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
  const spriteSheetsRef = useRef({ red: null, blue: null })
  const animationFrameRef = useRef(0)
  const [containerSize, setContainerSize] = useState({ width: 800, height: 600 })
  const [spritesLoaded, setSpritesLoaded] = useState(false)
  
  const GRID_PADDING = 20
  const CONTROLS_HEIGHT = 100
  const MIN_CELL_SIZE = 40
  const MAX_CELL_SIZE = 100  // Augmenté de 60 à 100 pour un plateau plus grand
  
  // Load sprite sheets
  useEffect(() => {
    const loadSprites = async () => {
      try {
        // Load red pac sprites
        const redTexture = await PIXI.Assets.load('/assets/sprites/red.png')
        const redData = await fetch('/assets/sprites/red.json').then(r => r.json())
        
        // Load blue pac sprites
        const blueTexture = await PIXI.Assets.load('/assets/sprites/blue.png')
        const blueData = await fetch('/assets/sprites/blue.json').then(r => r.json())
        
        spriteSheetsRef.current = {
          red: { texture: redTexture, data: redData },
          blue: { texture: blueTexture, data: blueData }
        }
        
        setSpritesLoaded(true)
      } catch (error) {
        console.error('Failed to load sprites:', error)
      }
    }
    
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
  
  useEffect(() => {
    if (!canvasRef.current || !state || !spritesLoaded) return
    
    const width = state?.grid?.[0]?.length || 7
    const height = state?.grid?.length || 5
    const pellets = state.pellets || []
    const cherries = state.cherries || []
    
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
    
    // Initialize PixiJS app only once
    if (!appRef.current) {
      const app = new PIXI.Application()
      app.init({
        width: width * CELL_SIZE + GRID_PADDING * 2,
        height: height * CELL_SIZE + GRID_PADDING * 2 + CONTROLS_HEIGHT,
        backgroundColor: 0x1a1a2e,
        antialias: true,
        resizeTo: canvasRef.current
      }).then(() => {
        if (canvasRef.current && !appRef.current) {
          canvasRef.current.appendChild(app.canvas)
          appRef.current = app
          
          // Make canvas responsive
          app.canvas.style.width = '100%'
          app.canvas.style.height = 'auto'
          app.canvas.style.maxWidth = `${width * CELL_SIZE + GRID_PADDING * 2}px`
          
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
          
          renderGrid(app, gridContainer, width, height, pellets, cherries, pacsArray, CELL_SIZE, prevState)
          renderControls(app, controlsContainer, width * CELL_SIZE, CELL_SIZE)
        }
      })
    } else {
      // Update existing grid and resize canvas
      const app = appRef.current
      if (app) {
        app.renderer.resize(width * CELL_SIZE + GRID_PADDING * 2, height * CELL_SIZE + GRID_PADDING * 2 + CONTROLS_HEIGHT)
      }
      
      const gridContainer = gridContainerRef.current
      const controlsContainer = controlsContainerRef.current
      if (gridContainer) {
        gridContainer.removeChildren()
        renderGrid(appRef.current, gridContainer, width, height, pellets, cherries, pacsArray, CELL_SIZE, prevState)
      }
      if (controlsContainer) {
        controlsContainer.y = height * CELL_SIZE + GRID_PADDING + 10
        controlsContainer.removeChildren()
        renderControls(appRef.current, controlsContainer, width * CELL_SIZE, CELL_SIZE)
      }
    }
    
    return () => {
      // Cleanup on unmount
      if (appRef.current && canvasRef.current?.children.length === 0) {
        appRef.current.destroy(true, { children: true, texture: true })
        appRef.current = null
      }
    }
  }, [state, prevState, containerSize, spritesLoaded])
  
  // Animation frame counter
  useEffect(() => {
    const interval = setInterval(() => {
      animationFrameRef.current = (animationFrameRef.current + 1) % 4
    }, 150) // Change frame every 150ms
    
    return () => clearInterval(interval)
  }, [])
  
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
    
    // Get direction from previous state
    const dir = getDirection(pac, prevPacsArray)
    
    // Get animation frame (cycle through walk001-walk004)
    const frameNum = (animationFrameRef.current % 4) + 1
    const frameName = `paku_${isPlayer ? 'red' : 'blue'}_${dir}_walk000${frameNum}`
    
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
    const scale = (CELL_SIZE / frame.w) * 0.9 // Scale to fit cell with some padding
    sprite.scale.set(scale)
    sprite.anchor.set(0.5)
    
    return sprite
  }
  
  const renderGrid = (app, container, width, height, pellets, cherries, pacsArray, CELL_SIZE, prevState) => {
    // Draw grid background
    const bg = new PIXI.Graphics()
    bg.rect(0, 0, width * CELL_SIZE, height * CELL_SIZE)
    bg.fill(0x0f0f1e)
    container.addChild(bg)
    
    // Draw grid lines
    const grid = new PIXI.Graphics()
    grid.lineStyle(1, 0x2a2a3e, 0.3)
    for (let x = 0; x <= width; x++) {
      grid.moveTo(x * CELL_SIZE, 0)
      grid.lineTo(x * CELL_SIZE, height * CELL_SIZE)
    }
    for (let y = 0; y <= height; y++) {
      grid.moveTo(0, y * CELL_SIZE)
      grid.lineTo(width * CELL_SIZE, y * CELL_SIZE)
    }
    container.addChild(grid)
    
    // Draw pellets
    const pelletSet = new Set(pellets.map(p => `${p[0]},${p[1]}`))
    pelletSet.forEach(key => {
      const [x, y] = key.split(',').map(Number)
      const pellet = new PIXI.Graphics()
      pellet.circle(x * CELL_SIZE + CELL_SIZE/2, y * CELL_SIZE + CELL_SIZE/2, 3)
      pellet.fill(0xffffff)
      container.addChild(pellet)
    })
    
    // Draw cherries (larger, red)
    const cherrySet = new Set(cherries.map(c => `${c[0]},${c[1]}`))
    cherrySet.forEach(key => {
      const [x, y] = key.split(',').map(Number)
      const cherry = new PIXI.Graphics()
      // Draw cherry as two circles (cherry shape)
      cherry.circle(x * CELL_SIZE + CELL_SIZE/2 - 4, y * CELL_SIZE + CELL_SIZE/2, 6)
      cherry.fill(0xff0000)
      cherry.circle(x * CELL_SIZE + CELL_SIZE/2 + 4, y * CELL_SIZE + CELL_SIZE/2, 6)
      cherry.fill(0xff0000)
      // Stem
      cherry.lineStyle(2, 0x00ff00)
      cherry.moveTo(x * CELL_SIZE + CELL_SIZE/2, y * CELL_SIZE + CELL_SIZE/2 - 6)
      cherry.lineTo(x * CELL_SIZE + CELL_SIZE/2, y * CELL_SIZE + CELL_SIZE/2 - 10)
      container.addChild(cherry)
    })
    
    // Draw pacs with animated sprites
    pacsArray.forEach(pac => {
      if (!pac.position) return
      const [x, y] = pac.position
      
      // Get previous pacs for direction calculation
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
      
      const pacSprite = createPacSprite(pac, null, CELL_SIZE, prevPacsArray)
      
      if (pacSprite) {
        pacSprite.x = x * CELL_SIZE + CELL_SIZE/2
        pacSprite.y = y * CELL_SIZE + CELL_SIZE/2
        container.addChild(pacSprite)
      } else {
        // Fallback to simple circle if sprite fails
        const fallbackSprite = new PIXI.Graphics()
        const isPlayer = pac.owner === 'player'
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
    
    // Progress bar fill
    const progress = totalTurns > 0 ? currentIndex / (totalTurns - 1) : 0
    const progressFill = new PIXI.Graphics()
    progressFill.rect(20, progressBarY, progressBarWidth * progress, progressBarHeight)
    progressFill.fill(0x4CAF50)
    container.addChild(progressFill)
    
    // Progress text
    const progressText = new PIXI.Text({
      text: `${currentIndex} / ${totalTurns - 1}`,
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
    
    // Make progress bar interactive
    progressBg.eventMode = 'static'
    progressBg.cursor = 'pointer'
    progressBg.on('pointerdown', (event) => {
      const localX = event.data.getLocalPosition(container).x - 20
      const clickProgress = Math.max(0, Math.min(1, localX / progressBarWidth))
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
          maxWidth: '100%',
          maxHeight: '100%',
          width: 'auto',
          height: 'auto'
        }} 
      />
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
      {currentLeague.toLowerCase() === 'wood' ? (
        <GameRules league={currentLeague} />
      ) : (
        <PacmanAdvancedRules league={currentLeague} />
      )}
    </div>
  )
}
