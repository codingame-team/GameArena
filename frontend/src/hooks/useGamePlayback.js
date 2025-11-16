import { useState, useRef, useEffect, useCallback } from 'react'
import axios from 'axios'
import { API_BASE_URL } from '../config'
import useGameRunner from './useGameRunner'

/**
 * Hook pour gérer le playback du jeu (historique, animation, contrôles).
 * 
 * Responsabilité (SRP): Playback et contrôles de jeu uniquement
 * - Gestion historique (history, fullHistory)
 * - Animation et navigation (play/pause/stop/seek)
 * - Collecte des tours de jeu
 * - Logs combinés
 * 
 * @returns {Object} État et actions pour le playback
 */
export function useGamePlayback() {
  const [gameId, setGameId] = useState(null)
  const [history, setHistory] = useState([])
  const [fullHistory, setFullHistory] = useState([])
  const [currentIndex, setCurrentIndex] = useState(-1)
  const [combinedLogs, setCombinedLogs] = useState('')
  const [animationDelay, setAnimationDelay] = useState(500)
  
  // Control refs/state
  const collectingRef = useRef(false)
  const animatingRef = useRef(false)
  const pausedRef = useRef(false)
  const stoppedRef = useRef(false)
  const animationDelayRef = useRef(animationDelay)
  const currentRunIdRef = useRef(0)
  
  const [isCollecting, setIsCollecting] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)
  
  // Sync animationDelayRef
  useEffect(() => {
    animationDelayRef.current = animationDelay
  }, [animationDelay])

  // Game runner (encapsule la logique de collecte et animation)
  const { collectFullHistory, animateCollected } = useGameRunner({
    API_BASE_URL,
    appendLog: (msg) => console.log(msg),
    collectingRef,
    animatingRef,
    pausedRef,
    stoppedRef,
    animationDelayRef,
    currentRunIdRef,
    setIsCollecting,
    setIsAnimating,
    setIsPaused,
    setHistory,
    setFullHistory,
    setCombinedLogs,
    setCurrentIndex
  })

  /**
   * Ajoute une ligne au log
   */
  const appendLog = useCallback((msg) => {
    setCombinedLogs(prev => prev + msg + '\n')
  }, [])

  /**
   * Récupère le nombre total de tours
   */
  const getTotalTurns = useCallback(() => {
    return (fullHistory && fullHistory.length) || (history && history.length) || 0
  }, [fullHistory, history])

  /**
   * Navigue vers un index spécifique dans l'historique
   */
  const seekToIndex = useCallback((idx) => {
    const total = getTotalTurns()
    if (total === 0) return
    const clamped = Math.max(0, Math.min(total - 1, Number(idx)))
    
    if (fullHistory && fullHistory.length > 0) {
      const newHistory = fullHistory.slice(0, clamped + 1)
      setHistory(newHistory)
      setCurrentIndex(clamped)
      
      // Agrégation des logs jusqu'à cet index
      let agg = ''
      for (const item of newHistory) {
        if (item && item.__global_stdout) agg += item.__global_stdout
        else if (item && item.__global_stderr) agg += item.__global_stderr
        else {
          if (item && item.stdout) agg += item.stdout
          if (item && item.stderr) agg += item.stderr
        }
      }
      setCombinedLogs(agg)
      return
    }
    
    // Fallback to history if fullHistory isn't present
    const newIdx = Math.max(0, Math.min((history ? history.length : 1) - 1, clamped))
    setCurrentIndex(newIdx)
  }, [fullHistory, history, getTotalTurns])

  /**
   * Arrête l'animation en cours
   */
  const stopAnimation = useCallback(() => {
    stoppedRef.current = true
    pausedRef.current = false
    animatingRef.current = false
    setIsPaused(false)
    setIsAnimating(false)
  }, [])

  /**
   * Arrête le playback en préservant l'état
   */
  const stopPlaybackPreserveState = useCallback(() => {
    stopAnimation()
  }, [stopAnimation])

  /**
   * Handler pour le seek sur la barre de progression
   */
  const handleSeek = useCallback((e) => {
    stopPlaybackPreserveState()
    const el = e.currentTarget
    const rect = el.getBoundingClientRect()
    const x = e.clientX - rect.left
    const ratio = Math.max(0, Math.min(1, x / rect.width))
    const total = getTotalTurns()
    if (total === 0) return
    const idx = Math.floor(ratio * total)
    seekToIndex(Math.min(idx, total - 1))
  }, [stopPlaybackPreserveState, getTotalTurns, seekToIndex])

  /**
   * Démarre une nouvelle partie
   */
  const startGame = useCallback(async (payload, onBeforeStart) => {
    try {
      // Incrémenter le runId pour invalider les anciens runs
      currentRunIdRef.current += 1
      const thisRunId = currentRunIdRef.current
      
      // Arrêter toute animation/collecte en cours
      stopAnimation()
      collectingRef.current = false
      setIsCollecting(false)
      
      // Réinitialiser complètement l'historique
      setHistory([])
      setFullHistory([])
      setCurrentIndex(-1)
      setCombinedLogs('')
      
      // Vérification si déjà en cours (après arrêt)
      if (isCollecting || collectingRef.current) {
        appendLog('Backend is already building a run; please wait until it finishes.')
        return
      }

      // Callback optionnel avant démarrage (pour sauvegarder, valider, etc.)
      if (onBeforeStart) {
        const canStart = await onBeforeStart()
        if (!canStart) return
      }

      // Réinitialisation
      stoppedRef.current = false
      
      // Créer la partie
      const res = await axios.post(`${API_BASE_URL}/api/games`, payload)
      const gid = res.data.game_id
      setGameId(gid)
      appendLog(`Started backend run ${gid}. Collecting history...`)
      
      collectingRef.current = true
      setIsCollecting(true)

      // Collecter l'historique
      const collected = await collectFullHistory(gid)
      
      // Vérifier si ce run est toujours valide
      if (thisRunId !== currentRunIdRef.current) {
        appendLog('Run cancelled (newer run started)')
        return
      }
      
      setFullHistory(collected)

      // Lancer l'animation
      if (!stoppedRef.current && thisRunId === currentRunIdRef.current) {
        if (isAnimating) {
          appendLog('Stopping previous animation and switching to newly collected run...')
          stopAnimation()
          await new Promise(r => setTimeout(r, 30))
        }
        await animateCollected(collected, 0, thisRunId)
      }
    } catch (e) {
      appendLog(`Error creating game: ${e}`)
    }
  }, [isCollecting, isAnimating, collectFullHistory, animateCollected, stopAnimation, appendLog])

  /**
   * Toggle Play/Pause
   */
  const togglePlayPause = useCallback(() => {
    // Si pas en cours d'animation mais historique disponible
    if (!isAnimating && fullHistory && fullHistory.length > 0) {
      const total = fullHistory.length
      const runId = currentRunIdRef.current
      
      // Si à la fin, recommencer depuis le début
      if (currentIndex >= total - 1) {
        animateCollected(fullHistory, -1, runId)
        return
      }
      
      // Sinon continuer depuis la position actuelle
      const startIndex = (currentIndex >= 0) ? currentIndex : 0
      if (startIndex < total) {
        animateCollected(fullHistory, startIndex, runId)
      }
      return
    }

    // Si en cours d'animation, toggle pause
    if (isAnimating) {
      pausedRef.current = !pausedRef.current
      setIsPaused(pausedRef.current)
    }
  }, [isAnimating, fullHistory, currentIndex, animateCollected])

  /**
   * Arrêt complet
   */
  const stopPlayback = useCallback(() => {
    stopAnimation()
    collectingRef.current = false
    stoppedRef.current = true
    setIsCollecting(false)
  }, [stopAnimation])

  /**
   * Calcule le ratio de progression [0,1]
   */
  const progressRatio = useCallback(() => {
    try {
      const total = getTotalTurns()
      const pos = (currentIndex >= 0 ? currentIndex + 1 : 0)
      if (!total || total <= 0) return 0
      return Math.max(0, Math.min(1, pos / Math.max(1, total)))
    } catch (e) {
      return 0
    }
  }, [currentIndex, getTotalTurns])

  // Clamper currentIndex quand history change
  useEffect(() => {
    if (!history || history.length === 0) {
      setCurrentIndex(-1)
      return
    }
    setCurrentIndex(i => {
      if (i < 0) return history.length - 1
      if (i > history.length - 1) return history.length - 1
      return i
    })
  }, [history])

  // Arrêter l'animation si on arrive à la fin
  useEffect(() => {
    try {
      const total = (fullHistory && fullHistory.length) || 0
      if (total > 0 && currentIndex >= total - 1) {
        stoppedRef.current = true
        pausedRef.current = false
        animatingRef.current = false
        setIsPaused(false)
        setIsAnimating(false)
      }
    } catch (e) {
      // ignore
    }
  }, [currentIndex, fullHistory])

  return {
    // État
    gameId,
    history,
    fullHistory,
    currentIndex,
    combinedLogs,
    animationDelay,
    isCollecting,
    isPaused,
    isAnimating,
    
    // Refs
    collectingRef,
    animatingRef,
    pausedRef,
    stoppedRef,
    animationDelayRef,
    
    // Setters
    setGameId,
    setHistory,
    setFullHistory,
    setCurrentIndex,
    setCombinedLogs,
    setAnimationDelay,
    setIsCollecting,
    setIsPaused,
    setIsAnimating,
    
    // Actions
    appendLog,
    getTotalTurns,
    seekToIndex,
    handleSeek,
    startGame,
    togglePlayPause,
    stopPlayback,
    stopAnimation,
    progressRatio
  }
}
