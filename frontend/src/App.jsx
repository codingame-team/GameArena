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
  const [history, setHistory] = useState([])
  const [currentIndex, setCurrentIndex] = useState(-1)
  const [logs, setLogs] = useState('')

  // helper to append a line to the logs state
  function appendLog(s){
    try{
      setLogs(l => l + s + '\n')
    }catch(e){
      // defensive: ignore errors updating logs
      console.error('appendLog error', e)
    }
  }

  useEffect(()=>{
    // fetch protocol (background)
    axios.get(`${API_BASE}/api/referees`).then(()=>{}).catch(()=>{})

    // Load or create a bot id and either fetch saved code or the template
    try{
      let existing = localStorage.getItem('gamearena_bot_id')
      if(!existing){
        // create but don't persist until first save
        existing = makeBotId()
        localStorage.setItem('gamearena_bot_id', existing)
      }
      setBotId(existing)
      // try to fetch saved code
      axios.get(`${API_BASE}/api/player/code/${existing}`).then(r=>{
        if(r.data && r.data.exists && r.data.code){
          setCode(r.data.code)
        } else {
          // no saved code -> load template
          axios.get(`${API_BASE}/api/player/template`).then(tp=>{
            if(tp.data && tp.data.template){
              setCode(tp.data.template)
            }
          }).catch(()=>{})
        }
      }).catch(()=>{
        // if GET failed (404) load template
        axios.get(`${API_BASE}/api/player/template`).then(tp=>{
          if(tp.data && tp.data.template){
            setCode(tp.data.template)
          }
        }).catch(()=>{})
      })
    }catch(e){
      // fallback: load template
      axios.get(`${API_BASE}/api/player/template`).then(tp=>{
        if(tp.data && tp.data.template){
          setCode(tp.data.template)
        }
      }).catch(()=>{})
    }
  },[])

  async function saveBotNow(id, txt){
    if(!id) return
    setSaveStatus('saving')
    try{
      await axios.post(`${API_BASE}/api/player/code/${id}`, { code: txt })
      setSaveStatus('saved')
      // clear status to idle after short delay
      setTimeout(()=> setSaveStatus('idle'), 1000)
    }catch(e){
      setSaveStatus('error')
    }
  }

  function scheduleSave(newCode){
    if(saveTimer.current) clearTimeout(saveTimer.current)
    // debounce 1s
    saveTimer.current = setTimeout(()=>{
      if(!botId){
        const nid = makeBotId()
        setBotId(nid)
        localStorage.setItem('gamearena_bot_id', nid)
        saveBotNow(nid, newCode)
      } else {
        saveBotNow(botId, newCode)
      }
    }, 1000)
  }

  async function startGame(){
    try{
      // ensure latest code saved before starting
      if(botId){
        await saveBotNow(botId, code)
      }
      // prefer referencing saved bot id so the server mounts the persisted file
      const payload = botId ? { referee: 'pacman', player_bot_id: botId, opponent: 'default_opponent_cli' } : { referee: 'pacman', player_code: code }
      const res = await axios.post(`${API_BASE}/api/games`, payload)
      setGameId(res.data.game_id)
      setLogs(l=>l+`Started game ${res.data.game_id}\n`)
      await fetchHistory(res.data.game_id)
    }catch(e){
      setLogs(l=>l+`Error creating game: ${e}\n`)
    }
  }

  async function stepGame(){
    if(!gameId){ alert('Start a game first'); return }
    try{
      const res = await axios.post(`${API_BASE}/api/games/${gameId}/step`)
      setLogs(l=>l + (res.data.stdout||'') + (res.data.stderr||''))
      await fetchHistory(gameId)
    }catch(e){ setLogs(l=>l+`Step error: ${formatAxiosError(e)}\n`) }
  }

  function formatAxiosError(e){
    try{
      if(!e) return 'Unknown error'
      if(e.response){
        return `HTTP ${e.response.status} ${e.response.statusText} - ${JSON.stringify(e.response.data)}`
      }
      if(e.request){
        // The request was made but no response received
        return `No response received (possible network error or CORS). Request: ${e.request && e.request._url ? e.request._url : String(e.request)}`
      }
      return e.message || String(e)
    }catch(err){
      return String(e)
    }
  }

  async function fetchHistory(gid=null){
    const id = gid || gameId
    if(!id) return
    try{
      const res = await axios.get(`${API_BASE}/api/games/${id}/history`)
      setHistory(res.data.history || [])
      if(res.data.history && res.data.history.length>0){
        setCurrentIndex(res.data.history.length-1)
      }
    }catch(e){ setLogs(l=>l+`Fetch history error: ${e}\n`) }
  }

  function prev(){ if(currentIndex>0) setCurrentIndex(i=>i-1) }
  function next(){ if(currentIndex<history.length-1) setCurrentIndex(i=>i+1) }

  async function checkBackend(){
    try{
      appendLog('Checking backend /api/referees...')
      const res = await axios.get(`${API_BASE}/api/referees`, { timeout: 3000 })
      appendLog('Backend reachable. Available referees: ' + Object.keys(res.data).join(','))
    }catch(e){
      const msg = (e && e.message) ? e.message : String(e)
      appendLog(`Backend check failed: ${msg}`)
      appendLog('Conseil: démarrez le backend Flask:')
      appendLog('  cd /Users/display/PycharmProjects/GameArena')
      appendLog('  source .venv/bin/activate')
      appendLog('  python3 app.py')
    }
  }

  async function checkRunner(){
    try{
      appendLog('Checking runner (Docker) via /api/runner/check...')
      const res = await axios.get(`${API_BASE}/api/runner/check`, { timeout: 3000 })
      if(res.data && res.data.available){
        appendLog('Docker available: ' + (res.data.version || 'unknown'))
      }else{
        appendLog('Docker not available: ' + (res.data && res.data.error ? res.data.error : 'unknown'))
      }
    }catch(e){
      const msg = (e && e.message) ? e.message : String(e)
      appendLog(`Runner check failed: ${msg}`)
      appendLog('Si Docker n\'est pas installé, installez Docker Desktop et relancez-le.')
    }
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
            <button onClick={startGame}>Start Game</button>
            <button onClick={stepGame}>Step</button>
            <button onClick={() => fetchHistory()}>Fetch History</button>
            <button onClick={checkBackend}>Check Backend</button>
            <button onClick={checkRunner}>Check Runner</button>
          </div>
        </div>
        <div className="center">
          <h2>Visualizer</h2>
          <Visualizer history={history} index={currentIndex} />
          <div className="viz-controls">
            <button onClick={prev}>Prev</button>
            <button onClick={next}>Next</button>
            <span>Turn: { (history[currentIndex] && history[currentIndex].state && history[currentIndex].state.turn) || 0 }</span>
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
