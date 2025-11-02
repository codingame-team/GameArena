import React from 'react'

import PacmanSprite from './PacmanSprite'

function Grid({state, prevState, winnerMessage}){
  const width = 7
  const height = 5
  const pellets = state ? state.pellets || [] : []
  const pacs = state ? state.pacs || {} : {}
  const prevPacs = prevState ? prevState.pacs || {} : {}
  const pelletSet = new Set((pellets || []).map(p=>p[0]+','+p[1]))

  // Calculer les directions en fonction des positions précédentes
  const getDirection = (id) => {
    const currentPos = pacs[id]
    const prevPos = prevPacs[id]
    
    if (!prevPos || !currentPos) return 'left' // Direction initiale: gauche (orientation par défaut des sprites)
    if (currentPos[0] > prevPos[0]) return 'right'
    if (currentPos[0] < prevPos[0]) return 'left'
    if (currentPos[1] > prevPos[1]) return 'down'
    if (currentPos[1] < prevPos[1]) return 'up'
    return 'left' // Par défaut: gauche
  }

  return (
    <div className="grid" data-component="Grid" style={{ position: 'relative' }}>
      {/* Grille de base avec les pastilles */}
      {Array.from({length:height}).map((_,y)=> (
        <div className="row" key={y}>
          {Array.from({length:width}).map((_,x)=>{
            const key = x+','+y
            let content = ''
            if(pelletSet.has(key)) content = '·'
            
            // Vérifier s'il y a un pac sur cette cellule
            let hasPac = false
            for(const id in pacs){
              const pos = pacs[id]
              if(pos && pos[0]===x && pos[1]===y){
                hasPac = true
                break
              }
            }
            
            return (
              <div className="cell" key={x} style={{ position: 'relative' }}>
                {content}
                {/* Afficher le sprite si un pac est sur cette cellule */}
                {Object.entries(pacs).map(([id, pos]) => {
                  if (pos && pos[0] === x && pos[1] === y) {
                    return (
                      <div key={id} style={{ 
                        position: 'absolute', 
                        top: '50%', 
                        left: '50%', 
                        transform: 'translate(-50%, -50%)',
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <PacmanSprite
                          isPlayer={id === 'player'}
                          direction={getDirection(id)}
                        />
                      </div>
                    )
                  }
                  return null
                })}
              </div>
            )
          })}
        </div>
      ))}
      
      {/* Winner Announcement Overlay - centré sur la grille */}
      {winnerMessage && (
        <div className="winner-overlay" style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(0, 0, 0, 0.85)',
          zIndex: 1000,
          pointerEvents: 'none'
        }}>
          <div className="winner-message" style={{
            background: 'var(--frame-bg)',
            border: `3px solid ${winnerMessage.color}`,
            borderRadius: '12px',
            padding: '24px 48px',
            fontSize: '28px',
            fontWeight: 'bold',
            color: winnerMessage.color,
            textAlign: 'center',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)'
          }}>
            {winnerMessage.text}
          </div>
        </div>
      )}
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
  player2Name = 'Joueur 2'
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
      <div className="visualizer-canvas" data-component="Visualizer.Canvas">
        <Grid state={state} prevState={prevState} winnerMessage={winnerMessage} />

        {/* Slider full-width under the Grid (inside the canvas) */}
        <div className="visualizer-slider" data-component="Visualizer.Slider">
          <input
            className="visualizer-range"
            type="range"
            min={0}
            max={Math.max(0, totalTurns - 1)}
            value={currentIndex >= 0 ? currentIndex : 0}
            onChange={(e)=> onSeek && onSeek(Number(e.target.value))}
            onMouseDown={(e) => onUserSeekStart && onUserSeekStart(e)}
            onTouchStart={(e) => onUserSeekStart && onUserSeekStart(e)}
            disabled={!history || history.length === 0}
          />
        </div>

        {/* Controls inside the canvas so slider and controls stay grouped with the visual area */}
        <div className="visualizer-controls" data-component="Visualizer.Controls" style={{justifyContent:'flex-start'}}>
          <div className="nav-buttons">
            <button onClick={onSkipToStart} disabled={!history || history.length === 0} aria-label="skip-to-start">⏮</button>
            <button onClick={onStepBackward} disabled={!history || history.length === 0} aria-label="step-back">{'<'}</button>
            <button onClick={onPlayPause} disabled={!history || history.length === 0} aria-label="play-pause">{ isAnimating ? (isPaused ? '▶' : '⏸') : '▶' }</button>
            <button onClick={onStepForward} disabled={!history || history.length === 0} aria-label="step-forward">{'>'}</button>
            <button onClick={onSkipToEnd} disabled={!history || history.length === 0} aria-label="skip-to-end">⏭</button>
          </div>
          {/* Display the progress label only if we have history */}
          {history && history.length > 0 && (
            <div className="progress-label">
              {(entry && entry.state && typeof entry.state.turn === 'number') ? entry.state.turn : Math.max(0, (currentIndex >= 0 ? currentIndex : 0))} / { totalTurns - 1 }
            </div>
          )}


          {/* <div className="speed-control">
            <label>Speed</label>
            <input type="range" min={100} max={1000} step={50} value={animationDelay} onChange={(e)=> setAnimationDelay(Number(e.target.value))} />
            <small>{animationDelay}ms</small>
          </div> */}
        </div>

        {/* Game Rules Block */}
        <div className="game-rules-block" style={{ padding: '12px', background: 'var(--frame-bg)', borderTop: '1px solid rgba(0,0,0,0.1)', fontSize: '13px', color: 'var(--text)', marginTop: '12px' }}>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: 'bold' }}>Règles du jeu</h3>
          <p style={{ margin: '0 0 8px 0' }}>
            Déplacez votre Pac-Man (rouge) pour collecter les pastilles (·) tout en évitant l'adversaire (bleu). 
            Le joueur avec le plus de points à la fin gagne.
          </p>
          <h4 style={{ margin: '0 0 4px 0', fontSize: '13px', fontWeight: 'bold' }}>Déplacements</h4>
          <p style={{ margin: 0, fontSize: '12px' }}>
            • Chaque tour, indiquez la position cible (x, y) où vous voulez aller<br/>
            • Format de sortie : <code style={{ background: 'rgba(0,0,0,0.1)', padding: '2px 4px', borderRadius: '3px' }}>MOVE x y</code><br/>
            • Exemple : <code style={{ background: 'rgba(0,0,0,0.1)', padding: '2px 4px', borderRadius: '3px' }}>MOVE 3 2</code> pour aller vers la position (3, 2)<br/>
            • La cible peut être <strong>n'importe où</strong> sur la grille (adjacente ou éloignée)<br/>
            • Le referee calcule automatiquement le plus court chemin (BFS)<br/>
            • Votre pac se déplace d'<strong>une case par tour</strong> vers la cible<br/>
            • Déplacements uniquement horizontaux ou verticaux (pas de diagonale)
          </p>
        </div>
      </div>
    </div>
  )
}
