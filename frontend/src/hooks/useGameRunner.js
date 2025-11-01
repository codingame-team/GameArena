import axios from 'axios'

// Hook that encapsulates history collection and animation logic so it can be
// tested independently. The hook does not keep its own UI state; instead it
// calls the setters and updates refs passed by the caller (App.jsx).
export default function useGameRunner({
  API_BASE_URL,
  appendLog,
  // refs controlling concurrent operations
  collectingRef,
  animatingRef,
  pausedRef,
  stoppedRef,
  animationDelayRef,
  // state setters from the caller
  setIsCollecting,
  setIsAnimating,
  setIsPaused,
  setHistory,
  setFullHistory,
  setCombinedLogs,
  setCurrentIndex
}){

  async function collectFullHistory(gid){
    const collected = []
    let finished = false
    if(collectingRef) collectingRef.current = true
    if(setIsCollecting) setIsCollecting(true)
    if(stoppedRef) stoppedRef.current = false
    try{
      while(!finished && !(stoppedRef && stoppedRef.current)){
        const sres = await axios.post(`${API_BASE_URL}/api/games/${gid}/step`)
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
        else { appendLog && appendLog('Unexpected response from step: missing history_entry'); break }
      }
    }catch(e){ appendLog && appendLog('Error while running game: ' + (e && e.message ? e.message : String(e))) }
    if(collectingRef) collectingRef.current = false
    if(setIsCollecting) setIsCollecting(false)

    // If finished but collected empty, try GET /history
    if(collected.length === 0 && !(stoppedRef && stoppedRef.current)){
      try{ const hres = await axios.get(`${API_BASE_URL}/api/games/${gid}/history`); if(hres && hres.data && Array.isArray(hres.data.history)) collected.splice(0, collected.length, ...hres.data.history) }
      catch(e){ appendLog && appendLog('Failed to fetch history: ' + (e && e.message ? e.message : String(e))) }
    }
    return collected
  }

  async function animateCollected(collected, startIndex=0){
    if(!Array.isArray(collected) || collected.length===0) return
    if(animatingRef) animatingRef.current = true
    if(setIsAnimating) setIsAnimating(true)
    if(pausedRef) pausedRef.current = false
    if(stoppedRef) stoppedRef.current = false
    if(setIsPaused) setIsPaused(false)
    try{
      let playFrom = 0
      if(typeof startIndex === 'number' && startIndex >= 0){
        const prefix = collected.slice(0, startIndex + 1)
        setHistory && setHistory(prefix)
        // aggregate logs for the prefix
        let agg = ''
        for(const item of prefix){
          if(item && item.__global_stdout) agg += item.__global_stdout
          else if(item && item.__global_stderr) agg += item.__global_stderr
          else { if(item && item.stdout) agg += item.stdout; if(item && item.stderr) agg += item.stderr }
        }
        setCombinedLogs && setCombinedLogs(agg)
        setCurrentIndex && setCurrentIndex(prefix.length - 1)
        playFrom = startIndex + 1
      } else {
        setHistory && setHistory([])
        setCombinedLogs && setCombinedLogs('')
        playFrom = 0
      }
      // maintain a simple index counter so tests that mock setters observe calls
      let idxCounter = (startIndex >= 0) ? (startIndex) : -1
      for(let i = playFrom; i < collected.length; i++){
        if(stoppedRef && stoppedRef.current) break
        while(pausedRef && pausedRef.current){ if(stoppedRef && stoppedRef.current) break; await new Promise(r=>setTimeout(r, 150)) }
        if(stoppedRef && stoppedRef.current) break
        const item = collected[i]
        if(item && item.__global_stdout){ setCombinedLogs && setCombinedLogs(l=> l + item.__global_stdout); }
        if(item && item.__global_stderr){ setCombinedLogs && setCombinedLogs(l=> l + item.__global_stderr); }
        // append item to history
        setHistory && setHistory(h => { const nh = Array.isArray(h) ? [...h, item] : [item]; return nh })
        // increment index counter and notify caller
        idxCounter += 1
        setCurrentIndex && setCurrentIndex(idxCounter)
        if(item.stdout) setCombinedLogs && setCombinedLogs(l=> l + item.stdout)
        if(item.stderr) setCombinedLogs && setCombinedLogs(l=> l + item.stderr)
        if(i === collected.length - 1){
          animatingRef && (animatingRef.current = false)
          pausedRef && (pausedRef.current = false)
          stoppedRef && (stoppedRef.current = true)
          setIsPaused && setIsPaused(false)
          setIsAnimating && setIsAnimating(false)
          break
        }
        const stepDelay = (animationDelayRef && typeof animationDelayRef.current === 'number') ? animationDelayRef.current : 500
        const chunk = 100
        let elapsed = 0
        while(elapsed < stepDelay){
          if(stoppedRef && stoppedRef.current) break
          if(pausedRef && pausedRef.current){ await new Promise(r=>setTimeout(r, 150)); continue }
          const wait = Math.min(chunk, stepDelay - elapsed)
          await new Promise(r=>setTimeout(r, wait))
          elapsed += wait
        }
      }
    }finally{
      animatingRef && (animatingRef.current = false)
      pausedRef && (pausedRef.current = false)
      setIsPaused && setIsPaused(false)
      setIsAnimating && setIsAnimating(false)
    }
  }

  return { collectFullHistory, animateCollected }
}
