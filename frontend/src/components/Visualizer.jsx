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
  progressRatio,
  currentIndex,
  totalTurns,
  animationDelay,
  setAnimationDelay,
  isAnimating,
  isPaused
}){
  const entry = history && history[index]
  const state = entry && entry.state
  return (
    <div className="visualizer" data-component="Visualizer">
      <div className="visualizer-canvas" data-component="Visualizer.Canvas">
        <Grid state={state} />

        {/* Slider full-width under the Grid (inside the canvas) */}
        <div className="visualizer-slider" data-component="Visualizer.Slider">
          <input className="visualizer-range" type="range" min={0} max={Math.max(0, totalTurns - 1)} value={currentIndex >= 0 ? currentIndex : 0} onChange={(e)=> onSeek && onSeek(Number(e.target.value))} />
          <div className="progress-label">{Math.max(0, (currentIndex >= 0 ? currentIndex + 1 : 0))} / { totalTurns }</div>
        </div>

        {/* Controls inside the canvas so slider and controls stay grouped with the visual area */}
        <div className="visualizer-controls" data-component="Visualizer.Controls" style={{justifyContent:'flex-start'}}>
          <div className="nav-buttons">
            <button onClick={onSkipToStart} aria-label="skip-to-start">⏮</button>
            <button onClick={onStepBackward} aria-label="step-back">◀</button>
            <button onClick={onPlayPause} aria-label="play-pause">{ isAnimating ? (isPaused ? '▶' : '⏸') : '▶' }</button>
            <button onClick={onStepForward} aria-label="step-forward">▶</button>
            <button onClick={onSkipToEnd} aria-label="skip-to-end">⏭</button>
          </div>

          <div className="speed-control">
            <label>Speed</label>
            <input type="range" min={100} max={1000} step={50} value={animationDelay} onChange={(e)=> setAnimationDelay(Number(e.target.value))} />
            <small>{animationDelay}ms</small>
          </div>
        </div>
      </div>
    </div>
  )
}
