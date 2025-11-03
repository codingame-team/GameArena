import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import MonacoEditor from '../components/MonacoEditor'
import Visualizer from '../components/Visualizer'
import axios from 'axios'
import BotStderrPanel from '../components/BotStderrPanel'
import BotSelectionPanel from '../components/BotSelectionPanel'
import useGameRunner from '../hooks/useGameRunner'
import { API_BASE_URL } from '../config'
import SubmitArenaModal from '../components/SubmitArenaModal'

function makeBotId() {
  if (window && window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID()
  return 'bot-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8)
}

export default function PlaygroundPage() {
  const navigate = useNavigate()
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)
  
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
  const [backendStatus, setBackendStatus] = useState({ status: 'unknown', info: '' }) // status: unknown|ok|error
  const [dockerStatus, setDockerStatus] = useState({ status: 'unknown', info: '' })

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

  // Check authentication on mount - redirect to login if not authenticated
  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      console.log('No authentication token - redirecting to login')
      navigate('/login?redirect=/playground')
      return
    }
    setIsAuthenticated(true)
    setIsCheckingAuth(false)
  }, [navigate])

  // Theme (light | dark) - initialize from localStorage synchronously to avoid
  // a reload flicker or accidental overwrite when the app mounts.
  const [theme, setTheme] = useState(() => {
    try {
      const stored = localStorage.getItem('gamearena_theme')
      return stored || 'dark'
    } catch (e) { return 'dark' }
  })
  useEffect(() => {
    if (typeof document !== 'undefined') {
      if (theme === 'dark') document.documentElement.classList.add('theme-dark')
      else document.documentElement.classList.remove('theme-dark')
    }
    try { localStorage.setItem('gamearena_theme', theme) } catch (e) { }
  }, [theme])

  // state to mirror animatingRef so UI rerenders correctly when animation starts/stops
  const [isAnimating, setIsAnimating] = useState(false)

  // Log filter
  const [logFilter, setLogFilter] = useState('Tout')

  const [bottomPanelVisible, setBottomPanelVisible] = useState(true)
  const [leftPanelRatio, setLeftPanelRatio] = useState(0.25)
  const leftContainerRef = useRef(null)
  const [isDragging, setIsDragging] = useState(false)

  // Added state for horizontal splitter ratio
  // initialize to 2/3 so top area is ~66% and bottom is ~33%
  const [rowRatio, setRowRatio] = useState(2 / 3)

  // Arena submission modal
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [botVersionInfo, setBotVersionInfo] = useState({ latest_version_number: 0 }) // version info for current bot

  // Bot selection states (declared early to avoid initialization errors)
  const [selectedLanguage, setSelectedLanguage] = useState('python')
  const [availableBots, setAvailableBots] = useState([])
  const [selectedPlayer1, setSelectedPlayer1] = useState(null) // null initially, set to 'bot:X' when user bot loads
  const [selectedPlayer2, setSelectedPlayer2] = useState('Boss') // 'Boss' or 'bot:X'
  
  // Captured player names at game start (to avoid reference issues when selection changes)
  const [capturedPlayer1Name, setCapturedPlayer1Name] = useState('Joueur 1')
  const [capturedPlayer2Name, setCapturedPlayer2Name] = useState('Joueur 2')
  
  // User avatar (for custom avatars)
  const [userAvatar, setUserAvatar] = useState('my_bot')
  const [customAvatarBlobUrl, setCustomAvatarBlobUrl] = useState(null)
  const [currentUser, setCurrentUser] = useState(null) // Informations de l'utilisateur connecté
  const [botOwnerAvatars, setBotOwnerAvatars] = useState({}) // Map bot.id -> blob URL for custom avatars

  // Helpers to seek through fullHistory/history
  function getTotalTurns() {
    return (fullHistory && fullHistory.length) || (history && history.length) || 0
  }

  function seekToIndex(idx) {
    const total = getTotalTurns()
    if (total === 0) return
    const clamped = Math.max(0, Math.min(total - 1, Number(idx)))
    // If we have fullHistory, use it as authoritative source for seeking
    if (fullHistory && fullHistory.length > 0) {
      const newHistory = fullHistory.slice(0, clamped + 1)
      setHistory(newHistory)
      setCurrentIndex(clamped)
      // aggregate logs up to this index
      let agg = ''
      for (const item of newHistory) {
        if (item && item.__global_stdout) agg += item.__global_stdout
        else if (item && item.__global_stderr) agg += item.__global_stderr
        else { if (item && item.stdout) agg += item.stdout; if (item && item.stderr) agg += item.stderr }
      }
      setCombinedLogs(agg)
      return
    }
    // Fallback to history if fullHistory isn't present
    const newIdx = Math.max(0, Math.min((history ? history.length : 1) - 1, clamped))
    setCurrentIndex(newIdx)
  }

  function handleSeek(e) {
    // stop any ongoing playback so user can manually seek
    stopPlaybackPreserveState()
    const el = e.currentTarget
    const rect = el.getBoundingClientRect()
    const x = e.clientX - rect.left
    const ratio = Math.max(0, Math.min(1, x / rect.width))
    const total = getTotalTurns()
    if (total === 0) return
    const idx = Math.floor(ratio * total)
    // floor may equal total -> clamp
    seekToIndex(Math.min(idx, total - 1))
  }

  function handleMouseDown(e) { draggingRef.current = true; handleSeek(e); }
  function handleMouseMove(e) { if (draggingRef.current) handleSeek(e) }
  function handleMouseUp() { draggingRef.current = false }

  // stop playback but keep current history/logs visible
  function stopPlaybackPreserveState() {
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
  function appendLog(s) {
    try { setCombinedLogs(l => l + s + '\n') } catch (e) { console.error('appendLog error', e) }
  }

  useEffect(() => {
    // fetch protocol (background)
    axios.get(`${API_BASE_URL}/api/referees`).then(() => { }).catch(() => { })
    // restore theme and speed prefs if present
    try {
      const storedSpeed = localStorage.getItem('gamearena_speed')
      if (storedSpeed) {
        const s = storedSpeed.toLowerCase()
        const map = { slow: 800, medium: 500, fast: 200 }
        if (map[s]) setAnimationDelay(map[s])
      }
    } catch (e) { }
    
    // Restore game state if exists
    try {
      const savedState = sessionStorage.getItem('playground_game_state')
      if (savedState) {
        const state = JSON.parse(savedState)
        if (state.fullHistory && state.fullHistory.length > 0) {
          setFullHistory(state.fullHistory)
          setHistory(state.history || state.fullHistory)
          setCurrentIndex(state.currentIndex || state.fullHistory.length - 1)
          setGameId(state.gameId)
          setCapturedPlayer1Name(state.capturedPlayer1Name || 'Joueur 1')
          setCapturedPlayer2Name(state.capturedPlayer2Name || 'Joueur 2')
          console.log('✅ Restored game state from session')
        }
      }
    } catch (e) {
      console.warn('Could not restore game state:', e)
    }

    // check backend and docker status at mount
    checkBackend()
    checkRunner()
  }, [])

  async function saveBotNow(id, txt) {
    if (!id) return
    setSaveStatus('saving')
    try {
      const token = localStorage.getItem('token')
      if (!token) {
        setSaveStatus('error')
        console.error('No token found - user must be logged in')
        return
      }
      
      await axios.put(`${API_BASE_URL}/api/bots/${id}/save`, 
        { code: txt },
        { headers: { Authorization: `Bearer ${token}` }}
      )
      
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 1000)
    } catch (e) { 
      console.error('Save error:', e)
      setSaveStatus('error') 
    }
  }

  function scheduleSave(newCode) {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    // Only save if we have a bot ID (user must be logged in and have created a bot)
    saveTimer.current = setTimeout(() => { 
      if (botId) { 
        saveBotNow(botId, newCode) 
      } else {
        console.log('No bot ID - user must create a bot first')
      }
    }, 1500)
  }

  // Reset code to template
  async function resetCode() {
    if (!window.confirm('⚠️ Reset code to template? This will erase your current code.')) {
      return
    }
    try {
      const res = await axios.get(`${API_BASE_URL}/api/template`)
      if (res.data && res.data.template) {
        const templateCode = res.data.template
        setCode(templateCode)
        // Save immediately
        if (botId) {
          await saveBotNow(botId, templateCode)
        }
      }
    } catch (e) {
      console.error('Failed to load template:', e)
      alert('Failed to load template')
    }
  }

  // Use the extracted game runner hook for collection/animation logic
  const { collectFullHistory, animateCollected } = useGameRunner({
    API_BASE_URL,
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

  // Load template helper
  const loadTemplate = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/player/template`)
      if (res.data && res.data.template) {
        setCode(res.data.template)
      }
    } catch (e) {
      console.error('Failed to load template:', e)
    }
  }, [])

  // Initialize playground bot on mount (auto-create if needed)
  const initializePlaygroundBot = useCallback(async () => {
    console.log('🔧 initializePlaygroundBot called')
    try {
      const token = localStorage.getItem('token')
      if (!token) {
        console.log('❌ No token - authentication required')
        return
      }

      // Always fetch user's bots from database (no localStorage dependency)
      console.log('🔍 Searching for existing user bots in database...')
      const userBotsRes = await axios.get(`${API_BASE_URL}/api/bots/my`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      
      if (userBotsRes.data && userBotsRes.data.length > 0) {
        // Use first bot found
        const userBot = userBotsRes.data[0]
        console.log('✅ Found existing user bot:', userBot.id, userBot.name)
        setBotId(userBot.id)
        setCode(userBot.code || '')
        return
      }

      // No bot exists, create one with template code
      console.log('➕ No bot found, creating new playground bot...')
      
      // Load template first
      let templateCode = ''
      try {
        const tplRes = await axios.get(`${API_BASE_URL}/api/template`)
        if (tplRes.data && tplRes.data.template) {
          templateCode = tplRes.data.template
        }
      } catch (e) {
        console.log('⚠️ Failed to load template, using empty code')
      }
      
      const res = await axios.post(`${API_BASE_URL}/api/bots`, {
        name: 'My Playground Bot',
        code: templateCode
      }, {
        headers: { Authorization: `Bearer ${token}` }
      })
      
      const newBot = res.data.bot || res.data
      console.log('✅ New bot created with ID:', newBot.id)
      setBotId(newBot.id)
      setCode(newBot.code || templateCode)
    } catch (e) {
      console.error('❌ Failed to initialize bot:', e)
      // Fallback: load template anyway
      await loadTemplate()
    }
  }, [loadTemplate])

  // Initialize bot when authenticated
  useEffect(() => {
    if (isAuthenticated && !botId) {
      initializePlaygroundBot()
    }
  }, [isAuthenticated, botId, initializePlaygroundBot])

  // Load bot version info when botId changes
  useEffect(() => {
    if (botId) {
      loadBotVersionInfo(botId)
    }
  }, [botId])

  // Set the user's bot as player 1 by default when botId is loaded
  useEffect(() => {
    if (botId && !selectedPlayer1) {
      setSelectedPlayer1(`bot:${botId}`)
      console.log(`✅ Set user bot ${botId} as Player 1`)
    }
  }, [botId]) // Only depend on botId, not selectedPlayer1 to avoid loop

  async function loadBotVersionInfo(id) {
    try {
      const token = localStorage.getItem('token')
      const res = await axios.get(`${API_BASE_URL}/api/bots/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.data && res.data.bot) {
        setBotVersionInfo({ latest_version_number: res.data.bot.latest_version_number || 0 })
      }
    } catch (e) {
      console.error('Error loading bot version info:', e)
    }
  }

  async function handleSubmitToArena(formData) {
    const token = localStorage.getItem('token')
    if (!token) throw new Error('Non authentifié')
    if (!botId) throw new Error('Aucun bot sélectionné')

    const payload = {}
    if (formData.version_name) payload.version_name = formData.version_name
    if (formData.description) payload.description = formData.description

    const res = await axios.post(`${API_BASE_URL}/api/bots/${botId}/submit-to-arena`, payload, {
      headers: { 
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })

    // Recharger les infos de version
    await loadBotVersionInfo(botId)
    
    // Afficher un message de succès
    setCombinedLogs(l => l + `✅ Bot soumis à l'arène: ${res.data.version_name}\n`)
  }

  // create game, collect history, then animate. Play/Pause will control animateCollected via pausedRef
  async function startGame() {
    try {
      setCombinedLogs('')
      // If backend is already collecting a run, refuse to start another
      if (isCollecting || collectingRef.current) { appendLog('Backend is already building a run; please wait until it finishes.'); return }

      // Validate player selections
      if (!selectedPlayer1 || !selectedPlayer2) {
        appendLog('Erreur: Veuillez sélectionner les deux joueurs avant de démarrer.\n')
        return
      }

      // Capture player names at game start to avoid reference issues
      setCapturedPlayer1Name(getPlayerName(selectedPlayer1))
      setCapturedPlayer2Name(getPlayerName(selectedPlayer2))

      // Save current bot code before starting the game
      if (botId) { 
        await saveBotNow(botId, code)
      }

      // Save current bot and request a new run on the backend.
      stoppedRef.current = false
      
      let payload
      
      // Determine if player 1 is the user's bot (botId matches)
      const isPlayer1UserBot = selectedPlayer1 === `bot:${botId}`
      const isPlayer2UserBot = selectedPlayer2 === `bot:${botId}`
      
      // Extract bot IDs from selections
      let bot1Value = selectedPlayer1
      if (selectedPlayer1.startsWith('bot:')) {
        bot1Value = selectedPlayer1.substring(4)
      }
      
      let bot2Value = selectedPlayer2
      if (selectedPlayer2.startsWith('bot:')) {
        bot2Value = selectedPlayer2.substring(4)
      }
      
      // Always use bot-vs-bot mode since we removed "my-bot" option
      payload = {
        referee: 'pacman',
        bot1: bot1Value,
        bot2: bot2Value,
        mode: 'bot-vs-bot'
      }
      
      const res = await axios.post(`${API_BASE_URL}/api/games`, payload)
      const gid = res.data.game_id
      setGameId(gid)
      setCombinedLogs(l => l + `Started backend run ${gid}. Collecting history...\n`)
      // mark collecting immediately to avoid double-start if user clicks again very fast
      collectingRef.current = true
      setIsCollecting(true)

      // Collect history from backend. This will set collectingRef while running.
      // We intentionally allow any currently playing animation to continue while collection happens.
      const collected = await collectFullHistory(gid)
      setFullHistory(collected)

      // Once collection finished, stop any previous animation and play new collected history.
      if (!stoppedRef.current) {
        if (isAnimating) {
          appendLog('Stopping previous animation and switching to newly collected run...')
          // stopAnimation will NOT cancel backend collection (collectingRef remains untouched by stopAnimation)
          stopAnimation()
          await new Promise(r => setTimeout(r, 30))
        }
        await animateCollected(collected, 0)
      }
    } catch (e) { setCombinedLogs(l => l + `Error creating game: ${e}\n`) }
  }

  // Play/Pause toggle handler
  function togglePlayPause() {
    // If not currently animating but we have a collected history:
    if (!isAnimating && fullHistory && fullHistory.length > 0) {
      const total = fullHistory.length
      // if cursor is at the end, start animation from the beginning
      if (currentIndex >= total - 1) {
        // pass -1 to indicate a fresh start (animateCollected will reset history/logs and play from 0)
        animateCollected(fullHistory, -1)
        return
      }
      // otherwise start from the current progress position (inclusive)
      const startIndex = (currentIndex >= 0) ? currentIndex : 0
      if (startIndex < total) {
        animateCollected(fullHistory, startIndex)
      }
      return
    }
    if (isAnimating) { pausedRef.current = !pausedRef.current; setIsPaused(pausedRef.current) }
  }

  // Skip to end: immediately display fullHistory and logs
  function skipToEnd() {
    if (!fullHistory || fullHistory.length === 0) return
    // stop any running animation and mark stopped so UI shows Play
    stoppedRef.current = true
    animatingRef.current = false
    pausedRef.current = false
    setIsPaused(false)
    setIsAnimating(false)
    let aggLogs = ''
    for (const item of fullHistory) {
      if (item && item.__global_stdout) aggLogs += item.__global_stdout
      else if (item && item.__global_stderr) aggLogs += item.__global_stderr
      else { if (item.stdout) aggLogs += item.stdout; if (item.stderr) aggLogs += item.stderr }
    }
    setHistory(fullHistory.slice())
    setCurrentIndex(fullHistory.length - 1)
    setCombinedLogs(aggLogs)
  }

  // Jump to start: display the initial state (first turn) and logs
  function skipToStart() {
    if (!fullHistory || fullHistory.length === 0) return
    // stop any running animation and mark stopped so UI shows Play
    stoppedRef.current = true
    animatingRef.current = false
    pausedRef.current = false
    setIsPaused(false)
    setIsAnimating(false)
    const first = fullHistory[0]
    const prefix = fullHistory.slice(0, 1)
    let aggLogs = ''
    for (const item of prefix) {
      if (item && item.__global_stdout) aggLogs += item.__global_stdout
      else if (item && item.__global_stderr) aggLogs += item.__global_stderr
      else { if (item && item.stdout) aggLogs += item.stdout; if (item && item.stderr) aggLogs += item.stderr }
    }
    setHistory(prefix)
    setCurrentIndex(prefix.length - 1)
    setCombinedLogs(aggLogs)
  }

  // Stop: interrupt and reset displayed state
  function stopAnimation() {
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
  async function stepGame() {
    if (!gameId) { alert('Start a game first'); return }
    try {
      const res = await axios.post(`${API_BASE_URL}/api/games/${gameId}/step`)
      setCombinedLogs(l => l + (res.data.stdout || '') + (res.data.stderr || ''))
      const entry = res.data.history_entry
      if (entry) { setHistory(h => { const nh = [...h, entry]; setCurrentIndex(nh.length - 1); return nh }) }
    } catch (e) { setCombinedLogs(l => l + `Step error: ${formatAxiosError(e)}\n`) }
  }

  function formatAxiosError(e) {
    try { if (!e) return 'Unknown error'; if (e.response) return `HTTP ${e.response.status} ${e.response.statusText} - ${JSON.stringify(e.response.data)}`; if (e.request) return `No response received (possible network error or CORS). Request: ${e.request && e.request._url ? e.request._url : String(e.request)}`; return e.message || String(e) }
    catch (err) { return String(e) }
  }

  // fetch full history (kept for compatibility)
  async function fetchHistory(gid = null) {
    const id = gid || gameId
    if (!id) return
    try {
      const res = await axios.get(`${API_BASE_URL}/api/games/${id}/history`)
      setHistory(res.data.history || [])
      setFullHistory(res.data.history || [])
      if (res.data.history && res.data.history.length > 0) { setCurrentIndex(res.data.history.length - 1) }
    } catch (e) { setCombinedLogs(l => l + `Fetch history error: ${e}\n`) }
  }

  // navigation
  function onSliderChange(val) { const i = Number(val); setCurrentIndex(i) }

  // Handle click on a turn in the panel-right: sync history with fullHistory if needed
  function handleTurnClick(idx) {
    // Ensure history contains all entries up to the clicked index
    if (fullHistory.length > 0 && (history.length === 0 || history.length < fullHistory.length)) {
      setHistory(fullHistory.slice())
    }
    setCurrentIndex(idx)
  }

  // step backward / forward by one turn (uses seekToIndex to reuse existing history/log aggregation)
  function stepBackward() {
    stopPlaybackPreserveState()
    const total = getTotalTurns()
    if (total === 0) return
    const cur = (currentIndex >= 0) ? currentIndex : -1
    // if nothing shown yet (cur === -1), move to first element (index 0)
    const target = cur <= 0 ? 0 : cur - 1
    seekToIndex(target)
  }

  function stepForward() {
    stopPlaybackPreserveState()
    const total = getTotalTurns()
    if (total === 0) return
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
      // enforce minimum left panel width = 25% of container
      setLeftPanelRatio(Math.max(0.25, Math.min(0.9, startRatio + deltaRatio)))
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
    // DEBUG: vertical splitter (left/right column boundary)
    console.debug('[Splitter] Vertical drag start', { leftPanelRatio })
    setIsDragging(true)
    const startX = e.clientX
    const startRatio = leftPanelRatio
    const container = e.currentTarget.parentElement
    if (!container) return console.error('[Splitter] No parent container')
    const containerWidth = container.offsetWidth
    const handleMouseMove = (moveE) => {
      const deltaX = moveE.clientX - startX
      const deltaRatio = deltaX / containerWidth
      const newRatio = Math.max(0.25, Math.min(0.9, startRatio + deltaRatio))
      setLeftPanelRatio(newRatio)
    }
    const handleMouseUp = () => {
      console.debug('[Splitter] Vertical drag end', { leftPanelRatio })
      setIsDragging(false)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  function handleHorizontalSplitterMouseDown(e) {
    // DEBUG: horizontal splitter (visualizer/logs boundary in left-column ONLY)
    console.debug('[Splitter] Horizontal drag start', { rowRatio })
    setIsDragging(true)
    const startY = e.clientY
    const startRatio = rowRatio
    const container = e.currentTarget.parentElement
    if (!container) return console.error('[Splitter] No parent container (left-column)')
    const containerHeight = container.offsetHeight
    const handleMouseMove = (moveE) => {
      const deltaY = moveE.clientY - startY
      const deltaRatio = deltaY / containerHeight
      const newRatio = Math.max(0.1, Math.min(0.9, startRatio + deltaRatio))
      setRowRatio(newRatio)
    }
    const handleMouseUp = () => {
      console.debug('[Splitter] Horizontal drag end', { rowRatio })
      setIsDragging(false)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  // clamp currentIndex when history changes
  useEffect(() => {
    if (!history || history.length === 0) { setCurrentIndex(-1); return }
    setCurrentIndex(i => { if (i < 0) return history.length - 1; if (i > history.length - 1) return history.length - 1; return i })
  }, [history])

  // If cursor arrives to the end, ensure Play/Pause button shows "Play" (not Pause)
  useEffect(() => {
    try {
      const total = (fullHistory && fullHistory.length) || 0
      if (total > 0 && currentIndex >= total - 1) {
        // arrived at end -> stop any animating/paused state and show Play
        stoppedRef.current = true
        pausedRef.current = false
        animatingRef.current = false
        setIsPaused(false)
        setIsAnimating(false)
      }
    } catch (e) { /* ignore */ }
  }, [currentIndex, fullHistory])

  // UI helpers
  function formatDelayLabel(ms) { if (ms <= 200) return 'Fast'; if (ms <= 500) return 'Normal'; return 'Slow' }

  // Compute a clamped progress ratio [0,1] for the visual progress bar and thumb.
  const progressRatio = (() => {
    try {
      const total = getTotalTurns()
      const pos = (currentIndex >= 0 ? currentIndex + 1 : 0)
      if (!total || total <= 0) return 0
      // clamp to [0,1]
      return Math.max(0, Math.min(1, pos / Math.max(1, total)))
    } catch (e) { return 0 }
  })()

  async function checkBackend() {
    try { appendLog('Checking backend /api/referees...'); const res = await axios.get(`${API_BASE_URL}/api/referees`, { timeout: 3000 }); setBackendStatus({ status: 'ok', info: Object.keys(res.data).join(',') }); appendLog('Backend reachable. Available referees: ' + Object.keys(res.data).join(',')) } catch (e) { const msg = (e && e.message) ? e.message : String(e); setBackendStatus({ status: 'error', info: msg }); appendLog(`Backend check failed: ${msg}`) }
  }

  async function checkRunner() {
    try { appendLog('Checking runner (Docker) via /api/runner/check...'); const res = await axios.get(`${API_BASE_URL}/api/runner/check`, { timeout: 3000 }); if (res.data && res.data.available) { setDockerStatus({ status: 'ok', info: res.data.version || 'unknown' }); appendLog('Docker available: ' + (res.data.version || 'unknown')) } else { setDockerStatus({ status: 'error', info: res.data && res.data.error ? res.data.error : 'not available' }); appendLog('Docker not available: ' + (res.data && res.data.error ? res.data.error : 'unknown')) } } catch (e) { const msg = (e && e.message) ? e.message : String(e); setDockerStatus({ status: 'error', info: msg }); appendLog(`Runner check failed: ${msg}`) }
  }

  // small badge renderer
  function renderStatusBadge(label, s) {
    const color = s.status === 'ok' ? '#0a0' : s.status === 'unknown' ? '#aaa' : '#c00'
    return (
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 10, height: 10, borderRadius: 10, background: color, display: 'inline-block', boxShadow: '0 0 4px rgba(0,0,0,0.2)' }} />
        <small className="status-text">{label}: {s.status === 'ok' ? 'OK' : s.status === 'unknown' ? 'Unknown' : 'Unavailable'}</small>
      </div>
    )
  }

  // Helper function to get player display name
  const getPlayerName = (playerSelection) => {
    if (!playerSelection) return 'Aucun joueur'
    if (playerSelection === 'Boss') return 'Boss'
    if (typeof playerSelection === 'string' && playerSelection.startsWith('bot:')) {
      const selectedBotId = parseInt(playerSelection.substring(4))
      const bot = availableBots.find(b => b.id === selectedBotId)
      // Afficher le nom de l'utilisateur propriétaire du bot
      return bot?.owner_username || bot?.name || `Bot #${selectedBotId}`
    }
    return playerSelection || 'Aucun joueur'
  }
  
  // Helper function to get avatar URL for img src
  const getAvatarUrl = (playerSelection) => {
    if (!playerSelection) return '/avatars/no_avatar.svg'
    
    if (playerSelection === 'Boss') return '/avatars/boss.svg'
    
    if (typeof playerSelection === 'string' && playerSelection.startsWith('bot:')) {
      const selectedBotId = parseInt(playerSelection.substring(4))
      const bot = availableBots.find(b => b.id === selectedBotId)
      
      if (!bot) return '/avatars/no_avatar.svg'
      
      // Check if we have a custom avatar blob URL for this bot's owner
      if (bot.owner_avatar && bot.owner_avatar.startsWith('custom_')) {
        const blobUrl = botOwnerAvatars[bot.id]
        if (blobUrl) return blobUrl
        // Fallback while loading
        return '/avatars/my_bot.svg'
      }
      
      // Use the owner's predefined avatar
      if (bot.owner_avatar) {
        return `/avatars/${bot.owner_avatar}.svg`
      }
      
      // Fallback to default
      return '/avatars/boss.svg'
    }
    
    return '/avatars/no_avatar.svg'
  }

  // Fetch available bots on mount
  useEffect(() => {
    async function fetchBots() {
      const token = localStorage.getItem('token')
      
      try {
        // Fetch all active bots (not just user's bots) for opponent selection
        const res = await axios.get(`${API_BASE_URL}/api/bots?all=true`)
        console.log('📥 Bots response:', res.data)
        if (res.data && Array.isArray(res.data.bots)) {
          // Filter out Boss since it's already available as default option
          const botsWithoutBoss = res.data.bots.filter(bot => bot.name !== 'Boss')
          console.log(`✅ Found ${botsWithoutBoss.length} bots (Boss excluded):`, botsWithoutBoss)
          setAvailableBots(botsWithoutBoss)
          
          // Load custom avatars for bot owners
          const customAvatarBots = botsWithoutBoss.filter(bot => 
            bot.owner_avatar && bot.owner_avatar.startsWith('custom_')
          )
          
          if (customAvatarBots.length > 0 && token) {
            console.log(`🎨 Loading ${customAvatarBots.length} custom avatars...`)
            const avatarMap = {}
            
            // Load each custom avatar
            for (const bot of customAvatarBots) {
              try {
                const avatarRes = await axios.get(
                  `${API_BASE_URL}/api/user/${bot.user_id}/avatar/image`,
                  { 
                    headers: { Authorization: `Bearer ${token}` },
                    responseType: 'blob'
                  }
                )
                const blobUrl = URL.createObjectURL(avatarRes.data)
                avatarMap[bot.id] = blobUrl
                console.log(`✅ Loaded custom avatar for bot ${bot.id} (${bot.owner_username})`)
              } catch (avatarError) {
                console.log(`⚠️ Could not load avatar for bot ${bot.id}:`, avatarError.message)
              }
            }
            
            setBotOwnerAvatars(avatarMap)
          }
        } else {
          console.warn('⚠️ Response format unexpected:', res.data)
        }
      } catch (e) {
        // If not authenticated, just use default opponent
        console.log('❌ Could not fetch bots:', e.response?.status, e.response?.data || e.message)
      }
    }
    fetchBots()
    
    // Cleanup blob URLs on unmount
    return () => {
      Object.values(botOwnerAvatars).forEach(blobUrl => {
        if (blobUrl && blobUrl.startsWith('blob:')) {
          URL.revokeObjectURL(blobUrl)
        }
      })
    }
  }, [])

  // Fetch current user info and avatar on mount (if authenticated)
  useEffect(() => {
    async function fetchUserInfo() {
      const token = localStorage.getItem('token')
      if (!token) return
      
      try {
        // Fetch user profile
        const userRes = await axios.get(`${API_BASE_URL}/api/user/profile`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        if (userRes.data && userRes.data.user) {
          setCurrentUser(userRes.data.user)
          console.log('✅ User profile loaded:', userRes.data.user.username)
        }
        
        // Fetch user avatar
        const avatarRes = await axios.get(`${API_BASE_URL}/api/user/avatar`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        if (avatarRes.data && avatarRes.data.avatar) {
          setUserAvatar(avatarRes.data.avatar)
          console.log('✅ User avatar loaded:', avatarRes.data.avatar)
          
          // If it's a custom avatar, fetch the image and create a blob URL
          if (avatarRes.data.avatar.startsWith('custom_')) {
            try {
              const imageRes = await axios.get(`${API_BASE_URL}/api/user/avatar/image`, {
                headers: { Authorization: `Bearer ${token}` },
                responseType: 'blob'
              })
              const blobUrl = URL.createObjectURL(imageRes.data)
              setCustomAvatarBlobUrl(blobUrl)
              console.log('✅ Custom avatar blob URL created:', blobUrl)
            } catch (imgError) {
              console.log('⚠️ Could not fetch custom avatar image:', imgError.response?.data || imgError.message)
            }
          }
        }
      } catch (e) {
        console.log('⚠️ Could not fetch user info:', e.response?.data || e.message)
      }
    }
    fetchUserInfo()
    
    // Cleanup blob URL on unmount
    return () => {
      if (customAvatarBlobUrl) {
        URL.revokeObjectURL(customAvatarBlobUrl)
      }
    }
  }, [])

  // Save game state to sessionStorage when it changes
  useEffect(() => {
    if (fullHistory && fullHistory.length > 0 && gameId) {
      try {
        const state = {
          fullHistory,
          history,
          currentIndex,
          gameId,
          capturedPlayer1Name,
          capturedPlayer2Name
        }
        sessionStorage.setItem('playground_game_state', JSON.stringify(state))
      } catch (e) {
        console.warn('Could not save game state:', e)
      }
    }
  }, [fullHistory, history, currentIndex, gameId, capturedPlayer1Name, capturedPlayer2Name])

  // Show loading screen while checking authentication
  if (isCheckingAuth) {
    return (
      <div className="app">
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 20px', paddingTop: '10px' }}>
          <span>GameArena - React Prototype</span>
        </header>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 'calc(100vh - 64px)', color: 'var(--text)' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '24px', marginBottom: '16px' }}>⏳</div>
            <div>Vérification de l'authentification...</div>
          </div>
        </div>
      </div>
    )
  }

  // If not authenticated, this will never render because useEffect redirects
  if (!isAuthenticated) {
    return null
  }

  return (
    <div className="app">
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 20px', paddingTop: '10px' }}>
        <span>GameArena - React Prototype</span>
        <Link 
          to="/arena" 
          style={{ 
            color: '#fff',
            backgroundColor: '#4CAF50',
            textDecoration: 'none', 
            fontSize: '15px', 
            fontWeight: 'bold',
            padding: '8px 16px',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
            transition: 'all 0.2s ease',
            marginTop: '4px',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#45a049'
            e.currentTarget.style.transform = 'translateY(-1px)'
            e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.3)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#4CAF50'
            e.currentTarget.style.transform = 'translateY(0)'
            e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)'
          }}
        >
          <span style={{ fontSize: '18px' }}>🏆</span>
          <span>Accéder à l'Arène</span>
        </Link>
      </header>
      <div className="app-grid" style={{ gridTemplateColumns: `${leftPanelRatio * 100}% ${(1 - leftPanelRatio) * 100}%`, gridTemplateRows: '1fr 1fr', gridTemplateAreas: `'left-col right-col' 'left-col right-col'`, position: 'relative' }}>
        
        {/* LEFT COLUMN: Visualizer (top) + Logs (bottom) with independent horizontal splitter */}
        <div className="left-column" ref={leftContainerRef} style={{ gridArea: 'left-col', display: 'grid', gridTemplateRows: `${rowRatio * 100}% ${(1 - rowRatio) * 100}%`, position: 'relative', minHeight: 0 }}>
          <div className="frame visualizer-frame" style={{ display: 'flex', flexDirection: 'column' }}>
            <Visualizer
              history={history}
              index={currentIndex}
              onPlayPause={togglePlayPause}
              onStepBackward={stepBackward}
              onStepForward={stepForward}
              onSkipToStart={skipToStart}
              onSkipToEnd={skipToEnd}
              onSeek={(i) => seekToIndex(i)}
              onUserSeekStart={(e) => stopPlaybackPreserveState()}
              progressRatio={progressRatio}
              currentIndex={currentIndex}
              totalTurns={getTotalTurns()}
              animationDelay={animationDelay}
              setAnimationDelay={setAnimationDelay}
              isAnimating={isAnimating}
              isPaused={isPaused}
              player1Name={capturedPlayer1Name}
              player2Name={capturedPlayer2Name}
            />
          </div>

          {/* Horizontal splitter: ONLY affects left-column rows */}
          <div className="app-splitter-horizontal" style={{ position: 'absolute', top: `${rowRatio * 100}%`, left: 0, right: 0, height: 6, cursor: 'row-resize', zIndex: 40, background: 'rgba(0,0,0,0.06)', transform: 'translateY(-50%)' }} onMouseDown={handleHorizontalSplitterMouseDown} />

          <div className="frame logs-frame">
            <BotStderrPanel
              botLogs={history[currentIndex]?.bot_logs}
              globalStdout={history[currentIndex]?.__global_stdout}
              globalStderr={history[currentIndex]?.__global_stderr}
              gameState={history[currentIndex]?.state}
              fullHistory={fullHistory}
              isCollecting={isCollecting}
              currentIndex={currentIndex}
              onTurnClick={handleTurnClick}
              player1Name={capturedPlayer1Name}
              player2Name={capturedPlayer2Name}
            />
          </div>
        </div>

  {/* RIGHT COLUMN: Editor (top) + Controls (bottom) with FIXED bottom height (25vh) */}
  <div className="right-column" style={{ gridArea: 'right-col', display: 'grid', gridTemplateRows: '1fr 15vh', position: 'relative', minHeight: 0 }}>
          <div className="frame editor-frame">
            <div style={{ marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <select value={selectedLanguage} onChange={(e) => setSelectedLanguage(e.target.value)} style={{ fontSize: '14px' }}>
                <option value="python">Python 3</option>
              </select>
              <button 
                onClick={resetCode}
                disabled={!botId}
                style={{ 
                  fontSize: '12px', 
                  padding: '4px 10px', 
                  background: '#ff6b6b', 
                  color: 'white', 
                  border: 'none', 
                  borderRadius: '4px', 
                  cursor: botId ? 'pointer' : 'not-allowed',
                  opacity: botId ? 1 : 0.5
                }}
                title="Reset code to template"
              >
                🔄 Reset my code
              </button>
            </div>
            <MonacoEditor value={code} onChange={(v) => { setCode(v); scheduleSave(v) }} language={selectedLanguage} theme={theme} />
            {/* <div style={{ marginTop: 6, marginBottom: 6 }}>
              <small>Bot id: {botId || '—'} • Save status: {saveStatus}</small>
            </div> */}
          </div>

          <div className="frame controls-frame" style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: '15px', padding: '10px' }}>
            {/* SECTION 1: Bot Selection with Avatars (LEFT) */}
            <BotSelectionPanel
              selectedPlayer1={selectedPlayer1}
              selectedPlayer2={selectedPlayer2}
              onSelectPlayer1={setSelectedPlayer1}
              onSelectPlayer2={setSelectedPlayer2}
              onClearPlayer1={() => setSelectedPlayer1(null)}
              onClearPlayer2={() => setSelectedPlayer2(null)}
              getPlayerName={getPlayerName}
              getAvatarUrl={getAvatarUrl}
              availableBots={availableBots}
            />

            {/* SECTION 2: Options (Backend, Docker, Theme, Speed) - CENTER */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', minWidth: '150px' }}>
              <h4 style={{ margin: 0, fontSize: '12px', fontWeight: 'bold' }}>OPTIONS</h4>
              
              {/* Backend status */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '10px' }}>
                <span style={{ 
                  width: 7, 
                  height: 7, 
                  borderRadius: '50%', 
                  background: backendStatus.status === 'ok' ? '#0a0' : backendStatus.status === 'unknown' ? '#aaa' : '#c00',
                  boxShadow: '0 0 3px rgba(0,0,0,0.2)'
                }} />
                <span style={{ color: 'var(--text)', fontWeight: '500' }}>Backend: {backendStatus.status === 'ok' ? 'OK' : backendStatus.status === 'unknown' ? '?' : 'Error'}</span>
              </div>

              {/* Docker status */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '10px' }}>
                <span style={{ 
                  width: 7, 
                  height: 7, 
                  borderRadius: '50%', 
                  background: dockerStatus.status === 'ok' ? '#0a0' : dockerStatus.status === 'unknown' ? '#aaa' : '#c00',
                  boxShadow: '0 0 3px rgba(0,0,0,0.2)'
                }} />
                <span style={{ color: 'var(--text)', fontWeight: '500' }}>Docker: {dockerStatus.status === 'ok' ? 'OK' : dockerStatus.status === 'unknown' ? '?' : 'Error'}</span>
              </div>

              {/* Theme selector */}
              <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '10px', marginTop: '3px' }}>
                <span style={{ fontWeight: '500', minWidth: '45px' }}>Thème:</span>
                <select 
                  value={theme} 
                  onChange={(e) => setTheme(e.target.value)}
                  style={{ fontSize: '10px', padding: '2px 4px', flex: 1 }}
                >
                  <option value="light">Clair</option>
                  <option value="dark">Foncé</option>
                </select>
              </label>

              {/* Speed selector */}
              <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '10px' }}>
                <span style={{ fontWeight: '500', minWidth: '45px' }}>Vitesse:</span>
                <select 
                  value={animationDelay <= 200 ? 'fast' : animationDelay <= 500 ? 'medium' : 'slow'} 
                  onChange={(e) => {
                    const val = e.target.value
                    const map = { slow: 800, medium: 500, fast: 200 }
                    setAnimationDelay(map[val])
                    try { localStorage.setItem('gamearena_speed', val) } catch (err) { }
                  }}
                  style={{ fontSize: '10px', padding: '2px 4px', flex: 1 }}
                >
                  <option value="slow">Lente</option>
                  <option value="medium">Moyenne</option>
                  <option value="fast">Rapide</option>
                </select>
              </label>
            </div>

            {/* SECTION 3: Action Buttons (RIGHT) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', justifyContent: 'flex-start', minWidth: '200px' }}>
              <h4 style={{ margin: 0, fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>ACTIONS</h4>
              <button onClick={startGame} disabled={isCollecting} aria-busy={isCollecting} aria-live="polite" style={{ fontSize: '14px', padding: '8px 12px', width: '100%' }}>
                {isCollecting ? 'Collecting...' : '▶ Run my code'}
              </button>
              <button 
                onClick={() => {
                  console.log('Submit to Arena clicked, botId:', botId)
                  setIsModalOpen(true)
                }} 
                disabled={!botId || isCollecting}
                style={{ fontSize: '13px', padding: '8px 12px', width: '100%', background: botId ? '#4CAF50' : '#ccc', color: 'white', border: 'none', borderRadius: '4px', cursor: botId ? 'pointer' : 'not-allowed', opacity: (!botId || isCollecting) ? 0.5 : 1 }}
                title={!botId ? 'Sauvegardez d\'abord votre bot' : 'Soumettre cette version à l\'arène'}
              >
                🏆 Submit to Arena
              </button>
              <div style={{ fontSize: '10px', color: '#666', display: 'flex', alignItems: 'center', gap: '3px', justifyContent: 'center', flexWrap: 'wrap' }}>
                {botId ? (
                  <>
                    Bot ID: {botId}
                    {botVersionInfo.latest_version_number > 0 ? (
                      <span className="version-status submitted">
                        v{botVersionInfo.latest_version_number} in Arena
                      </span>
                    ) : (
                      <span className="version-status draft">
                        Draft - not submitted
                      </span>
                    )}
                  </>
                ) : (
                  <span style={{ color: '#f00' }}>⚠️ Bot not loaded - button disabled</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Vertical splitter: ONLY affects left/right column width (NOT rows) */}
        <div className="app-splitter-vertical" style={{ position: 'absolute', left: `${leftPanelRatio * 100}%`, top: 0, bottom: 0, width: 6, cursor: 'col-resize', zIndex: 40, background: 'rgba(0,0,0,0.06)', transform: 'translateX(-50%)' }} onMouseDown={handleVerticalSplitterMouseDown} />
      </div>

      {/* Submit to Arena Modal */}
      <SubmitArenaModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleSubmitToArena}
        botId={botId}
      />
    </div>
  )
}
