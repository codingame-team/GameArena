import React from 'react'

function Grid({state}){
  const width = 7
  const height = 5
  const pellets = state ? state.pellets || [] : []
  const pacs = state ? state.pacs || {} : {}
  const pelletSet = new Set((pellets || []).map(p=>p[0]+','+p[1]))
  return (
    <div className="grid" data-component="Grid">
      {Array.from({length:height}).map((_,y)=> (
        <div className="row" key={y}>
          {Array.from({length:width}).map((_,x)=>{
            const key = x+','+y
            let content = ''
            if(pelletSet.has(key)) content = '·'
            for(const id in pacs){
              const pos = pacs[id]
              if(pos && pos[0]===x && pos[1]===y){ content = id==='player' ? 'P' : 'O' }
            }
            return <div className={`cell ${content==='P'?'P':''} ${content==='O'?'O':''}`} key={x}>{content}</div>
          })}
        </div>
      ))}
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
  isPaused
}){
  // If no valid index is provided (e.g. -1), show the initial state (turn 0) when available.
  const safeIndex = (typeof index === 'number' && index >= 0) ? index : (Array.isArray(history) && history.length > 0 ? 0 : -1)
  const entry = (Array.isArray(history) && history.length > 0 && safeIndex >= 0) ? history[safeIndex] : null
  const state = entry && entry.state ? entry.state : (Array.isArray(history) && history.length > 0 ? history[0].state : null)
  return (
    <div className="visualizer" data-component="Visualizer">
      <div className="visualizer-canvas" data-component="Visualizer.Canvas">
        <Grid state={state} />

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
          <p style={{ margin: 0 }}>
            Déplacez votre Pac-Man (P) pour collecter les pastilles (·) tout en évitant l'adversaire (O). 
            Le joueur avec le plus de points à la fin gagne.
          </p>
        </div>
      </div>
    </div>
  )
}
