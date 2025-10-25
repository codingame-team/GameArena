import React, {useState, useEffect, useRef} from 'react'
import MonacoEditor from './components/MonacoEditor'
import Visualizer from './components/Visualizer'
import axios from 'axios'
import BotStderrPanel from './components/BotStderrPanel'
import useGameRunner from './hooks/useGameRunner'

const API_BASE = ''

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
  const [combinedLogs, setCombinedLogs] = useState('')

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
  // ref so a running animateCollected() loop can read the latest animation delay
  const animationDelayRef = useRef(animationDelay)
  useEffect(() => { animationDelayRef.current = animationDelay }, [animationDelay])

  // Theme (light | dark)
  const [theme, setTheme] = useState('light')
  useEffect(() => {
    try{
      const stored = localStorage.getItem('gamearena_theme')
      if(stored) setTheme(stored)
    }catch(e){}
  }, [])
  useEffect(() => {
    if(typeof document !== 'undefined'){
      if(theme === 'dark') document.documentElement.classList.add('theme-dark')
      else document.documentElement.classList.remove('theme-dark')
    }
    try{ localStorage.setItem('gamearena_theme', theme) }catch(e){}
  }, [theme])

  // state to mirror animatingRef so UI rerenders correctly when animation starts/stops
  const [isAnimating, setIsAnimating] = useState(false)

  // Log filter
  const [logFilter, setLogFilter] = useState('Tout')

  const [bottomPanelVisible, setBottomPanelVisible] = useState(true)
  const [leftPanelRatio, setLeftPanelRatio] = useState(0.4)
  const leftContainerRef = useRef(null)
  const [isDragging, setIsDragging] = useState(false)

  // Added state for horizontal splitter ratio
  // initialize to 2/3 so top area is ~66% and bottom is ~33%
  const [rowRatio, setRowRatio] = useState(2/3)

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
      setCombinedLogs(agg)
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
    setIsAnimating(false)
  }

  // helper to append a line to the logs state
  function appendLog(s){
    try{ setCombinedLogs(l => l + s + '\n') }catch(e){ console.error('appendLog error', e) }
  }

  useEffect(()=>{
    // fetch protocol (background)
    axios.get(`${API_BASE}/api/referees`).then(()=>{}).catch(()=>{})
    // restore theme and speed prefs if present
    try{
      const storedSpeed = localStorage.getItem('gamearena_speed')
      if(storedSpeed){
        const s = storedSpeed.toLowerCase()
        const map = { slow: 800, medium: 500, fast: 200 }
        if(map[s]) setAnimationDelay(map[s])
      }
      const storedTheme = localStorage.getItem('gamearena_theme')
      if(storedTheme) setTheme(storedTheme)
    }catch(e){}

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

  // Use the extracted game runner hook for collection/animation logic
  const { collectFullHistory, animateCollected } = useGameRunner({
    API_BASE,
    appendLog,
    collectingRef,
    animatingRef,
    pausedRef,
    stoppedRef,
    animationDelayRef,
    setIsCollecting,
    setIsAnimating,
    setIsPaused,
    setHistory,
    setFullHistory,
    setCombinedLogs,
    setCurrentIndex
  })

  // create game, collect history, then animate. Play/Pause will control animateCollected via pausedRef
  async function startGame(){
    try{
      setCombinedLogs('')
      // If backend is already collecting a run, refuse to start another
      if(isCollecting || collectingRef.current){ appendLog('Backend is already building a run; please wait until it finishes.'); return }

      // Save current bot and request a new run on the backend.
      stoppedRef.current = false
      if(botId){ await saveBotNow(botId, code) }
      const payload = botId ? { referee: 'pacman', player_bot_id: botId, opponent: 'default_opponent_cli' } : { referee: 'pacman', player_code: code }
      const res = await axios.post(`${API_BASE}/api/games`, payload)
      const gid = res.data.game_id
      setGameId(gid)
      setCombinedLogs(l=>l+`Started backend run ${gid}. Collecting history...\n`)
      // mark collecting immediately to avoid double-start if user clicks again very fast
      collectingRef.current = true
      setIsCollecting(true)

      // Collect history from backend. This will set collectingRef while running.
      // We intentionally allow any currently playing animation to continue while collection happens.
      const collected = await collectFullHistory(gid)
      setFullHistory(collected)

      // Once collection finished, stop any previous animation and play new collected history.
      if(!stoppedRef.current){
        if(isAnimating){
          appendLog('Stopping previous animation and switching to newly collected run...')
          // stopAnimation will NOT cancel backend collection (collectingRef remains untouched by stopAnimation)
          stopAnimation()
          await new Promise(r => setTimeout(r, 30))
        }
        await animateCollected(collected, 0)
      }
    }catch(e){ setCombinedLogs(l=>l+`Error creating game: ${e}\n`) }
  }

  // Play/Pause toggle handler
  function togglePlayPause(){
    // If not currently animating but we have a collected history:
    if(!isAnimating && fullHistory && fullHistory.length>0){
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
    if(isAnimating){ pausedRef.current = !pausedRef.current; setIsPaused(pausedRef.current) }
  }

  // Skip to end: immediately display fullHistory and logs
  function skipToEnd(){
    if(!fullHistory || fullHistory.length===0) return
    // stop any running animation and mark stopped so UI shows Play
    stoppedRef.current = true
    animatingRef.current = false
    pausedRef.current = false
    setIsPaused(false)
    setIsAnimating(false)
    let aggLogs = ''
    for(const item of fullHistory){
      if(item && item.__global_stdout) aggLogs += item.__global_stdout
      else if(item && item.__global_stderr) aggLogs += item.__global_stderr
      else { if(item.stdout) aggLogs += item.stdout; if(item.stderr) aggLogs += item.stderr }
    }
    setHistory(fullHistory.slice())
    setCurrentIndex(fullHistory.length-1)
    setCombinedLogs(aggLogs)
  }

  // Jump to start: display the initial state (first turn) and logs
  function skipToStart(){
    if(!fullHistory || fullHistory.length===0) return
    // stop any running animation and mark stopped so UI shows Play
    stoppedRef.current = true
    animatingRef.current = false
    pausedRef.current = false
    setIsPaused(false)
    setIsAnimating(false)
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
    setCombinedLogs(aggLogs)
  }

  // Stop: interrupt and reset displayed state
  function stopAnimation(){
    // signal animation to stop and clear displayed state
    stoppedRef.current = true
    pausedRef.current = false
    setIsPaused(false)
    animatingRef.current = false
    setIsAnimating(false)
    // IMPORTANT: do NOT touch collectingRef here. Stopping the animation must not cancel a backend collection.
    setHistory([])
    setCombinedLogs('')
    setCurrentIndex(-1)
  }

  // allow manual stepping via the backend if needed (kept for compatibility)
  async function stepGame(){
    if(!gameId){ alert('Start a game first'); return }
    try{
      const res = await axios.post(`${API_BASE}/api/games/${gameId}/step`)
      setCombinedLogs(l=>l + (res.data.stdout||'') + (res.data.stderr||''))
      const entry = res.data.history_entry
      if(entry){ setHistory(h=>{ const nh = [...h, entry]; setCurrentIndex(nh.length-1); return nh }) }
    }catch(e){ setCombinedLogs(l=>l+`Step error: ${formatAxiosError(e)}\n`) }
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
    }catch(e){ setCombinedLogs(l=>l+`Fetch history error: ${e}\n`) }
  }

  // navigation
  function onSliderChange(val){ const i = Number(val); setCurrentIndex(i) }

  // step backward / forward by one turn (uses seekToIndex to reuse existing history/log aggregation)
  function stepBackward(){
    stopPlaybackPreserveState()
    const total = getTotalTurns()
    if(total === 0) return
    const cur = (currentIndex >= 0) ? currentIndex : -1
    // if nothing shown yet (cur === -1), move to first element (index 0)
    const target = cur <= 0 ? 0 : cur - 1
    seekToIndex(target)
  }

  function stepForward(){
    stopPlaybackPreserveState()
    const total = getTotalTurns()
    if(total === 0) return
    const cur = (currentIndex >= 0) ? currentIndex : -1
    const target = Math.min(total - 1, cur + 1)
    seekToIndex(target)
  }

  function handleSplitterMouseDown(e) {
    setIsDragging(true)
    const startY = e.clientY
    const startRatio = leftPanelRatio
    const container = leftContainerRef.current
    if (!container) return
    const containerHeight = container.offsetHeight
    const handleMouseMove = (e) => {
      const deltaY = e.clientY - startY
      const deltaRatio = deltaY / containerHeight
      setLeftPanelRatio(Math.max(0.1, Math.min(0.9, startRatio + deltaRatio)))
    }
    const handleMouseUp = () => {
      setIsDragging(false)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  function handleVerticalSplitterMouseDown(e) {
    setIsDragging(true)
    const startX = e.clientX
    const startRatio = leftPanelRatio
    const container = e.currentTarget.parentElement
    const containerWidth = container.offsetWidth
    const handleMouseMove = (e) => {
      const deltaX = e.clientX - startX
      const deltaRatio = deltaX / containerWidth
      setLeftPanelRatio(Math.max(0.1, Math.min(0.9, startRatio + deltaRatio)))
    }
    const handleMouseUp = () => {
      setIsDragging(false)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  function handleHorizontalSplitterMouseDown(e) {
    setIsDragging(true)
    const startY = e.clientY
    const startRatio = rowRatio
    const container = e.currentTarget.parentElement
    const containerHeight = container.offsetHeight
    const handleMouseMove = (e) => {
      const deltaY = e.clientY - startY
      const deltaRatio = deltaY / containerHeight
      setRowRatio(Math.max(0.1, Math.min(0.9, startRatio + deltaRatio)))
    }
    const handleMouseUp = () => {
      setIsDragging(false)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

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
        setIsAnimating(false)
      }
    }catch(e){ /* ignore */ }
  }, [currentIndex, fullHistory])

  // UI helpers
  function formatDelayLabel(ms){ if(ms <= 200) return 'Fast'; if(ms <= 500) return 'Normal'; return 'Slow' }

  // Compute a clamped progress ratio [0,1] for the visual progress bar and thumb.
  const progressRatio = (() => {
    try{
      const total = getTotalTurns()
      const pos = (currentIndex >= 0 ? currentIndex + 1 : 0)
      if(!total || total <= 0) return 0
      // clamp to [0,1]
      return Math.max(0, Math.min(1, pos / Math.max(1, total)))
    }catch(e){ return 0 }
  })()

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
        <small className="status-text">{label}: {s.status === 'ok' ? 'OK' : s.status === 'unknown' ? 'Unknown' : 'Unavailable'}</small>
      </div>
    )
  }

  const [selectedLanguage, setSelectedLanguage] = useState('python')

  return (
    <div className="app">
      <header>GameArena - React Prototype</header>
  <div className="app-grid" style={{gridTemplateColumns: `${leftPanelRatio * 100}% ${(1 - leftPanelRatio) * 100}%`, gridTemplateRows: `${rowRatio * 100}% ${(1 - rowRatio) * 100}%`, position: 'relative'}}>
        <div className="frame visualizer-frame">
          <Visualizer
            history={history}
            index={currentIndex}
            onPlayPause={togglePlayPause}
            onStepBackward={stepBackward}
            onStepForward={stepForward}
            onSkipToStart={skipToStart}
            onSkipToEnd={skipToEnd}
            onSeek={(i) => seekToIndex(i)}
            progressRatio={progressRatio}
            currentIndex={currentIndex}
            totalTurns={getTotalTurns()}
            animationDelay={animationDelay}
            setAnimationDelay={setAnimationDelay}
            isAnimating={isAnimating}
            isPaused={isPaused}
          />
        </div>

        <div className="frame editor-frame">
          <div style={{marginBottom: '8px'}}>
            <select value={selectedLanguage} onChange={(e) => setSelectedLanguage(e.target.value)} style={{fontSize: '14px'}}>
              <option value="python">Python 3</option>
            </select>
          </div>
          <MonacoEditor value={code} onChange={(v)=>{ setCode(v); scheduleSave(v) }} language={selectedLanguage} theme={theme} />
          <div style={{marginTop:6, marginBottom:6}}>
            <small>Bot id: {botId || '—' } • Save status: {saveStatus}</small>
          </div>
        </div>

        <div className="frame logs-frame">
          <BotStderrPanel botLogs={history[currentIndex]?.bot_logs} globalStdout={history[currentIndex]?.__global_stdout} globalStderr={history[currentIndex]?.__global_stderr} />
          {/* <div className="logs" style={{marginTop:12}}>
            <pre style={{whiteSpace:'pre-wrap', margin:0}}>{combinedLogs}</pre>
          </div> */}
        </div>

        <div className="frame controls-frame">
          <button onClick={startGame} disabled={isCollecting} aria-busy={isCollecting} aria-live="polite" style={{ fontSize: '16px', padding: '8px 12px' }}>
            { isCollecting ? 'Collecting...' : '▶ Run my code' }
          </button>
          <div className="controls-info">
            <div className="status-row">
              {renderStatusBadge('Backend', backendStatus)}
              {renderStatusBadge('Docker', dockerStatus)}
            </div>
            <div className="prefs-row">
              <label className="pref">
                Thème
                <select value={theme} onChange={(e)=> setTheme(e.target.value)}>
                  <option value="light">Clair</option>
                  <option value="dark">Foncé</option>
                </select>
              </label>

              <label className="pref">
                Vitesse
                <select value={animationDelay <= 200 ? 'fast' : animationDelay <= 500 ? 'medium' : 'slow'} onChange={(e)=>{
                  const val = e.target.value
                  const map = { slow: 800, medium: 500, fast: 200 }
                  setAnimationDelay(map[val])
                  try{ localStorage.setItem('gamearena_speed', val) }catch(err){}
                }}>
                  <option value="slow">Slow</option>
                  <option value="medium">Medium</option>
                  <option value="fast">Fast</option>
                </select>
              </label>
            </div>
          </div>
        </div>
        {/* Splitters placed relative to app-grid for manual resizing */}
        <div className="app-splitter-vertical" style={{left: `${leftPanelRatio * 100}%`}} onMouseDown={handleVerticalSplitterMouseDown} />
        <div className="app-splitter-horizontal" style={{top: `${rowRatio * 100}%`}} onMouseDown={handleHorizontalSplitterMouseDown} />
      </div>
    </div>
  )
}
