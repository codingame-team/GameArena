import React, {useState, useEffect, useRef} from 'react'
import MonacoEditor from './components/MonacoEditor'
import Visualizer from './components/Visualizer'
import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:3000'

function makeBotId(){
  if(window && window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID()
  return 'bot-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,8)
}

export default function App(){
  const [code, setCode] = useState('')
  const [botId, setBotId] = useState(null)
  const [saveStatus, setSaveStatus] = useState('idle') // idle|saving|saved|error
  const saveTimer = useRef(null)
  const [gameId, setGameId] = useState(null)
  const [history, setHistory] = useState([]) // displayed history
  const [fullHistory, setFullHistory] = useState([]) // collected full history
  const [currentIndex, setCurrentIndex] = useState(-1)
  const [logs, setLogs] = useState('')

  // status indicators for backend & docker
  const [backendStatus, setBackendStatus] = useState({status: 'unknown', info: ''}) // status: unknown|ok|error
  const [dockerStatus, setDockerStatus] = useState({status: 'unknown', info: ''})

  // control refs/state
  const collectingRef = useRef(false)
  const animatingRef = useRef(false)
  const pausedRef = useRef(false)
  const stoppedRef = useRef(false)
  const draggingRef = useRef(false)
  // state mirror for collectingRef so UI rerenders when collection starts/stops
  const [isCollecting, setIsCollecting] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [animationDelay, setAnimationDelay] = useState(500) // ms

  // Helpers to seek through fullHistory/history
  function getTotalTurns(){
    return (fullHistory && fullHistory.length) || (history && history.length) || 0
  }

  function seekToIndex(idx){
    const total = getTotalTurns()
    if(total === 0) return
    const clamped = Math.max(0, Math.min(total - 1, Number(idx)))
    // If we have fullHistory, use it as authoritative source for seeking
    if(fullHistory && fullHistory.length > 0){
      const newHistory = fullHistory.slice(0, clamped + 1)
      setHistory(newHistory)
      setCurrentIndex(clamped)
      // aggregate logs up to this index
      let agg = ''
      for(const item of newHistory){
        if(item && item.__global_stdout) agg += item.__global_stdout
        else if(item && item.__global_stderr) agg += item.__global_stderr
        else { if(item && item.stdout) agg += item.stdout; if(item && item.stderr) agg += item.stderr }
      }
      setLogs(agg)
      return
    }
    // Fallback to history if fullHistory isn't present
    const newIdx = Math.max(0, Math.min((history? history.length : 1) - 1, clamped))
    setCurrentIndex(newIdx)
  }

  function handleSeek(e){
    // stop any ongoing playback so user can manually seek
    stopPlaybackPreserveState()
    const el = e.currentTarget
    const rect = el.getBoundingClientRect()
    const x = e.clientX - rect.left
    const ratio = Math.max(0, Math.min(1, x / rect.width))
    const total = getTotalTurns()
    if(total === 0) return
    const idx = Math.floor(ratio * total)
    // floor may equal total -> clamp
    seekToIndex(Math.min(idx, total - 1))
  }

  function handleMouseDown(e){ draggingRef.current = true; handleSeek(e); }
  function handleMouseMove(e){ if(draggingRef.current) handleSeek(e) }
  function handleMouseUp(){ draggingRef.current = false }

  // stop playback but keep current history/logs visible
  function stopPlaybackPreserveState(){
    // signal to any running animation/collector to stop
    stoppedRef.current = true
    // clear paused/animating flags so UI updates correctly
    pausedRef.current = false
    animatingRef.current = false
    collectingRef.current = false
    setIsPaused(false)
  }

  // helper to append a line to the logs state
  function appendLog(s){
    try{ setLogs(l => l + s + '\n') }catch(e){ console.error('appendLog error', e) }
  }

  useEffect(()=>{
    // fetch protocol (background)
    axios.get(`${API_BASE}/api/referees`).then(()=>{}).catch(()=>{})

    try{
      let existing = localStorage.getItem('gamearena_bot_id')
      if(!existing){ existing = makeBotId(); localStorage.setItem('gamearena_bot_id', existing) }
      setBotId(existing)
      axios.get(`${API_BASE}/api/player/code/${existing}`).then(r=>{
        if(r.data && r.data.exists && r.data.code){ setCode(r.data.code) }
        else { axios.get(`${API_BASE}/api/player/template`).then(tp=>{ if(tp.data && tp.data.template) setCode(tp.data.template) }).catch(()=>{}) }
      }).catch(()=>{ axios.get(`${API_BASE}/api/player/template`).then(tp=>{ if(tp.data && tp.data.template) setCode(tp.data.template) }).catch(()=>{}) })
    }catch(e){ axios.get(`${API_BASE}/api/player/template`).then(tp=>{ if(tp.data && tp.data.template) setCode(tp.data.template) }).catch(()=>{}) }

    // check backend and docker status at mount
    checkBackend()
    checkRunner()
  },[])

  async function saveBotNow(id, txt){
    if(!id) return
    setSaveStatus('saving')
    try{ await axios.post(`${API_BASE}/api/player/code/${id}`, { code: txt }); setSaveStatus('saved'); setTimeout(()=> setSaveStatus('idle'), 1000) }
    catch(e){ setSaveStatus('error') }
  }

  function scheduleSave(newCode){
    if(saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(()=>{ if(!botId){ const nid = makeBotId(); setBotId(nid); localStorage.setItem('gamearena_bot_id', nid); saveBotNow(nid, newCode) } else { saveBotNow(botId, newCode) } }, 1000)
  }

  // collect full history quickly by calling /step repeatedly
  async function collectFullHistory(gid){
    const collected = []
    let finished = false
    collectingRef.current = true
    setIsCollecting(true)
    stoppedRef.current = false
    try{
      while(!finished && !stoppedRef.current){
        const sres = await axios.post(`${API_BASE}/api/games/${gid}/step`)
        const data = sres.data || {}
        if(data.finished){
          finished = true
          if(Array.isArray(data.history) && data.history.length>0){ collected.splice(0, collected.length, ...data.history) }
          if(data.stdout) collected.push({__global_stdout: data.stdout})
          if(data.stderr) collected.push({__global_stderr: data.stderr})
          break
        }
        const entry = data.history_entry
        if(entry){ collected.push(entry) }
        else { appendLog('Unexpected response from step: missing history_entry'); break }
      }
    }catch(e){ appendLog('Error while running game: ' + (e && e.message ? e.message : String(e))) }
    collectingRef.current = false
    setIsCollecting(false)
    // If finished but collected empty, try GET /history
    if(collected.length === 0 && !stoppedRef.current){
      try{ const hres = await axios.get(`${API_BASE}/api/games/${gid}/history`); if(hres && hres.data && Array.isArray(hres.data.history)) collected.splice(0, collected.length, ...hres.data.history) }
      catch(e){ appendLog('Failed to fetch history: ' + (e && e.message ? e.message : String(e))) }
    }
    return collected
  }

  // animate display of a collected history array with pause/resume/stop support
  async function animateCollected(collected, startIndex=0){
    if(!Array.isArray(collected) || collected.length===0) return
    animatingRef.current = true
    pausedRef.current = false
    stoppedRef.current = false
    setIsPaused(false)
    try{
      // If startIndex points to the current position of the progress indicator,
      // preserve history/logs up to that index (inclusive) and animate from startIndex+1.
      let playFrom = 0
      if(typeof startIndex === 'number' && startIndex >= 0){
        const prefix = collected.slice(0, startIndex + 1)
        setHistory(prefix)
        // aggregate logs for the prefix
        let agg = ''
        for(const item of prefix){
          if(item && item.__global_stdout) agg += item.__global_stdout
          else if(item && item.__global_stderr) agg += item.__global_stderr
          else { if(item && item.stdout) agg += item.stdout; if(item && item.stderr) agg += item.stderr }
        }
        setLogs(agg)
        setCurrentIndex(prefix.length - 1)
        playFrom = startIndex + 1
      } else {
        setHistory([])
        setLogs('')
        playFrom = 0
      }
      for(let i = playFrom; i < collected.length; i++){
        if(stoppedRef.current) break
        while(pausedRef.current){ if(stoppedRef.current) break; await new Promise(r=>setTimeout(r, 150)) }
        if(stoppedRef.current) break
        const item = collected[i]
        if(item && item.__global_stdout){ setLogs(l=> l + item.__global_stdout); continue }
        if(item && item.__global_stderr){ setLogs(l=> l + item.__global_stderr); continue }
        setHistory(h => { const nh = [...h, item]; setCurrentIndex(nh.length - 1); return nh })
        if(item.stdout) setLogs(l=> l + item.stdout)
        if(item.stderr) setLogs(l=> l + item.stderr)
        // display delay, but check stopped/paused periodically
        const stepDelay = animationDelay
        const chunk = 100
        let elapsed = 0
        while(elapsed < stepDelay){
          if(stoppedRef.current) break
          if(pausedRef.current){ await new Promise(r=>setTimeout(r, 150)); continue }
          const wait = Math.min(chunk, stepDelay - elapsed)
          await new Promise(r=>setTimeout(r, wait))
          elapsed += wait
        }
      }
    }finally{
      animatingRef.current = false
      pausedRef.current = false
      stoppedRef.current = false
      setIsPaused(false)
    }
  }

  // create game, collect history, then animate. Play/Pause will control animateCollected via pausedRef
  async function startGame(){
    try{
      // If backend is already collecting a run, refuse to start another
      if(isCollecting || collectingRef.current){ appendLog('Backend is already building a run; please wait until it finishes.'); return }

      // Save current bot and request a new run on the backend.
      stoppedRef.current = false
      if(botId){ await saveBotNow(botId, code) }
      const payload = botId ? { referee: 'pacman', player_bot_id: botId, opponent: 'default_opponent_cli' } : { referee: 'pacman', player_code: code }
      const res = await axios.post(`${API_BASE}/api/games`, payload)
      const gid = res.data.game_id
      setGameId(gid)
      setLogs(l=>l+`Started backend run ${gid}. Collecting history...\n`)
      // mark collecting immediately to avoid double-start if user clicks again very fast
      collectingRef.current = true
      setIsCollecting(true)

      // Collect history from backend. This will set collectingRef while running.
      // We intentionally allow any currently playing animation to continue while collection happens.
      const collected = await collectFullHistory(gid)
      setFullHistory(collected)

      // Once collection finished, stop any previous animation and play new collected history.
      if(!stoppedRef.current){
        if(animatingRef.current){
          appendLog('Stopping previous animation and switching to newly collected run...')
          // stopAnimation will NOT cancel backend collection (collectingRef remains untouched by stopAnimation)
          stopAnimation()
          await new Promise(r => setTimeout(r, 30))
        }
        await animateCollected(collected, 0)
      }
    }catch(e){ setLogs(l=>l+`Error creating game: ${e}\n`) }
  }

  // Play/Pause toggle handler
  function togglePlayPause(){
    // If not currently animating but we have a collected history:
    if(!animatingRef.current && fullHistory && fullHistory.length>0){
      const total = fullHistory.length
      // if cursor is at the end, start animation from the beginning
      if(currentIndex >= total - 1){
        // pass -1 to indicate a fresh start (animateCollected will reset history/logs and play from 0)
        animateCollected(fullHistory, -1)
        return
      }
      // otherwise start from the current progress position (inclusive)
      const startIndex = (currentIndex >= 0) ? currentIndex : 0
      if(startIndex < total){
        animateCollected(fullHistory, startIndex)
      }
      return
    }
    if(animatingRef.current){ pausedRef.current = !pausedRef.current; setIsPaused(pausedRef.current) }
  }

  // Skip to end: immediately display fullHistory and logs
  function skipToEnd(){
    if(!fullHistory || fullHistory.length===0) return
    stoppedRef.current = true
    pausedRef.current = false
    setIsPaused(false)
    let aggLogs = ''
    for(const item of fullHistory){
      if(item && item.__global_stdout) aggLogs += item.__global_stdout
      else if(item && item.__global_stderr) aggLogs += item.__global_stderr
      else { if(item.stdout) aggLogs += item.stdout; if(item.stderr) aggLogs += item.stderr }
    }
    setHistory(fullHistory.slice())
    setCurrentIndex(fullHistory.length-1)
    setLogs(aggLogs)
  }

  // Jump to start: display the initial state (first turn) and logs
  function skipToStart(){
    if(!fullHistory || fullHistory.length===0) return
    stoppedRef.current = true
    pausedRef.current = false
    setIsPaused(false)
    const first = fullHistory[0]
    const prefix = fullHistory.slice(0,1)
    let aggLogs = ''
    for(const item of prefix){
      if(item && item.__global_stdout) aggLogs += item.__global_stdout
      else if(item && item.__global_stderr) aggLogs += item.__global_stderr
      else { if(item && item.stdout) aggLogs += item.stdout; if(item && item.stderr) aggLogs += item.stderr }
    }
    setHistory(prefix)
    setCurrentIndex(prefix.length - 1)
    setLogs(aggLogs)
  }

  // Stop: interrupt and reset displayed state
  function stopAnimation(){
    // signal animation to stop and clear displayed state
    stoppedRef.current = true
    pausedRef.current = false
    setIsPaused(false)
    animatingRef.current = false
    // IMPORTANT: do NOT touch collectingRef here. Stopping the animation must not cancel a backend collection.
    setHistory([])
    setLogs('')
    setCurrentIndex(-1)
  }

  // allow manual stepping via the backend if needed (kept for compatibility)
  async function stepGame(){
    if(!gameId){ alert('Start a game first'); return }
    try{
      const res = await axios.post(`${API_BASE}/api/games/${gameId}/step`)
      setLogs(l=>l + (res.data.stdout||'') + (res.data.stderr||''))
      const entry = res.data.history_entry
      if(entry){ setHistory(h=>{ const nh = [...h, entry]; setCurrentIndex(nh.length-1); return nh }) }
    }catch(e){ setLogs(l=>l+`Step error: ${formatAxiosError(e)}\n`) }
  }

  function formatAxiosError(e){
    try{ if(!e) return 'Unknown error'; if(e.response) return `HTTP ${e.response.status} ${e.response.statusText} - ${JSON.stringify(e.response.data)}`; if(e.request) return `No response received (possible network error or CORS). Request: ${e.request && e.request._url ? e.request._url : String(e.request)}`; return e.message || String(e) }
    catch(err){ return String(e) }
  }

  // fetch full history (kept for compatibility)
  async function fetchHistory(gid=null){
    const id = gid || gameId
    if(!id) return
    try{
      const res = await axios.get(`${API_BASE}/api/games/${id}/history`)
      setHistory(res.data.history || [])
      setFullHistory(res.data.history || [])
      if(res.data.history && res.data.history.length>0){ setCurrentIndex(res.data.history.length-1) }
    }catch(e){ setLogs(l=>l+`Fetch history error: ${e}\n`) }
  }

  // navigation
  function onSliderChange(val){ const i = Number(val); setCurrentIndex(i) }

  // clamp currentIndex when history changes
  useEffect(()=>{
    if(!history || history.length === 0){ setCurrentIndex(-1); return }
    setCurrentIndex(i => { if(i < 0) return history.length - 1; if(i > history.length - 1) return history.length - 1; return i })
  }, [history])

  // If cursor arrives to the end, ensure Play/Pause button shows "Play" (not Pause)
  useEffect(()=>{
    try{
      const total = (fullHistory && fullHistory.length) || 0
      if(total > 0 && currentIndex >= total - 1){
        // arrived at end -> stop any animating/paused state and show Play
        stoppedRef.current = true
        pausedRef.current = false
        animatingRef.current = false
        setIsPaused(false)
      }
    }catch(e){ /* ignore */ }
  }, [currentIndex, fullHistory])

  // UI helpers
  function formatDelayLabel(ms){ if(ms <= 200) return 'Fast'; if(ms <= 500) return 'Normal'; return 'Slow' }

  async function checkBackend(){
    try{ appendLog('Checking backend /api/referees...'); const res = await axios.get(`${API_BASE}/api/referees`, { timeout: 3000 }); setBackendStatus({status: 'ok', info: Object.keys(res.data).join(',')}); appendLog('Backend reachable. Available referees: ' + Object.keys(res.data).join(',')) }catch(e){ const msg = (e && e.message) ? e.message : String(e); setBackendStatus({status: 'error', info: msg}); appendLog(`Backend check failed: ${msg}`) }
  }

  async function checkRunner(){
    try{ appendLog('Checking runner (Docker) via /api/runner/check...'); const res = await axios.get(`${API_BASE}/api/runner/check`, { timeout: 3000 }); if(res.data && res.data.available){ setDockerStatus({status: 'ok', info: res.data.version || 'unknown'}); appendLog('Docker available: ' + (res.data.version || 'unknown')) } else { setDockerStatus({status: 'error', info: res.data && res.data.error ? res.data.error : 'not available'}); appendLog('Docker not available: ' + (res.data && res.data.error ? res.data.error : 'unknown')) } }catch(e){ const msg = (e && e.message) ? e.message : String(e); setDockerStatus({status: 'error', info: msg}); appendLog(`Runner check failed: ${msg}`) }
  }

  // small badge renderer
  function renderStatusBadge(label, s){
    const color = s.status === 'ok' ? '#0a0' : s.status === 'unknown' ? '#aaa' : '#c00'
    return (
      <div style={{display:'inline-flex', alignItems:'center', gap:8}}>
        <span style={{width:10, height:10, borderRadius:10, background:color, display:'inline-block', boxShadow:'0 0 4px rgba(0,0,0,0.2)'}} />
        <small style={{color:'#333'}}>{label}: {s.status === 'ok' ? 'OK' : s.status === 'unknown' ? 'Unknown' : 'Unavailable'}</small>
      </div>
    )
  }

  return (
    <div className="app">
      <header><h1>GameArena - React Prototype</h1></header>
      <div className="layout">
        <div className="left">
          <h2>Editor</h2>
          <MonacoEditor value={code} onChange={(v)=>{ setCode(v); scheduleSave(v) }} language="python" />
          <div style={{marginTop:6, marginBottom:6}}>
            <small>Bot id: {botId || '—' } • Save status: {saveStatus}</small>
          </div>
          <div className="controls">
            <button onClick={startGame} disabled={isCollecting} aria-busy={isCollecting} aria-live="polite">
              { isCollecting ? 'Collecting...' : 'Run Code' }
            </button>
            <button onClick={skipToStart} disabled={!(fullHistory && fullHistory.length>0)}>Jump to start</button>
            <button
              onClick={togglePlayPause}
              // enabled when animating OR when we have a collected history (including when cursor is at end)
              disabled={ !animatingRef.current && !(fullHistory && fullHistory.length>0) }
            >
              { animatingRef.current ? (isPaused ? 'Play' : 'Pause') : 'Play' }
            </button>
            <button onClick={skipToEnd} disabled={!(fullHistory && fullHistory.length>0)}>Jump to end</button>
            <div style={{display:'inline-flex', alignItems:'center', gap:8, marginLeft:8}}>
              <label style={{fontSize:12, color:'#666'}}>Speed:</label>
              <input type="range" min={100} max={1000} step={50} value={animationDelay} onChange={(e)=> setAnimationDelay(Number(e.target.value))} />
              <small style={{minWidth:70}}>{formatDelayLabel(animationDelay)} ({animationDelay}ms)</small>
            </div>

            {/* Remplacement des boutons "Check" par des indicateurs de statut */}
            <div style={{display:'inline-flex', gap:12, alignItems:'center', marginLeft:12}}>
              {renderStatusBadge('Backend', backendStatus)}
              {renderStatusBadge('Docker', dockerStatus)}
            </div>

          </div>
        </div>
        <div className="center">
          <h2>Visualizer</h2>
          <Visualizer history={history} index={currentIndex} />
          {/* Interactive progress bar to navigate history (click / drag / keyboard) */}
          <div className="viz-controls">
            <div
              role="slider"
              tabIndex={0}
              onKeyDown={(e)=>{
                // stop any automatic playback before manual keyboard seek
                stopPlaybackPreserveState()
                if(e.key === 'ArrowLeft') seekToIndex(Math.max(0, (currentIndex >= 0 ? currentIndex - 1 : 0)))
                else if(e.key === 'ArrowRight') seekToIndex(Math.min(getTotalTurns() - 1, (currentIndex >= 0 ? currentIndex + 1 : 0)))
              }}
               onMouseDown={handleMouseDown}
               onMouseMove={handleMouseMove}
               onMouseUp={handleMouseUp}
               onMouseLeave={handleMouseUp}
               onClick={handleSeek}
               style={{position:'relative', width:'100%', height:18, background:'#eee', borderRadius:8, cursor:'pointer', marginTop:6}}
               aria-valuenow={currentIndex >= 0 ? currentIndex + 1 : 0}
               aria-valuemin={0}
               aria-valuemax={getTotalTurns()}
            >
              <div style={{position:'absolute', left:0, top:0, bottom:0, width: `${( (currentIndex >= 0 ? currentIndex + 1 : 0) / Math.max(1, getTotalTurns()) ) * 100}%`, background:'#3b82f6', borderRadius:8}} />
              {/* circular thumb showing current position */}
              <div style={{
                position:'absolute',
                left: `calc(${( (currentIndex >= 0 ? currentIndex + 1 : 0) / Math.max(1, getTotalTurns()) ) * 100}% - 8px)`,
                top: '50%',
                transform: 'translateY(-50%)',
                width:16,
                height:16,
                borderRadius:'50%',
                background:'#fff',
                border:'2px solid #3b82f6',
                boxShadow:'0 2px 6px rgba(0,0,0,0.2)',
                pointerEvents: 'none'
              }} />
            </div>
            <div style={{textAlign:'right', fontSize:12, color:'#444', marginTop:6}}>{Math.max(0, (currentIndex >= 0 ? currentIndex + 1 : 0))} / { getTotalTurns() } turns</div>
          </div>
        </div>
        <div className="right">
          <h2>Logs</h2>
          <pre className="logs">{logs}</pre>
        </div>
      </div>
    </div>
  )
}
