import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import Visualizer from './Visualizer'
import BotStderrPanel from './BotStderrPanel'
import EditorPanel from './EditorPanel'
import GameControlsPanel from './GameControlsPanel'
import SubmitArenaModal from './SubmitArenaModal'
import LeagueBadge from './LeagueBadge'
import LeagueRules from './LeagueRules'

// Hooks
import { useTheme } from '../hooks/useTheme'
import { usePanelLayout } from '../hooks/usePanelLayout'
import { useStatus } from '../hooks/useStatus'
import { useBotManagement } from '../hooks/useBotManagement'
import { useBotSelection } from '../hooks/useBotSelection'
import { useGamePlayback } from '../hooks/useGamePlayback'
import useLeague from '../hooks/useLeague'

/**
 * Page Playground - Interface principale de développement et test de bots.
 * 
 * Responsabilité (SRP): Orchestration uniquement
 * - Coordonne les hooks métier
 * - Assemble les composants UI
 * - Gère le layout général
 * 
 * Architecture SOLID respectée:
 * - Logique métier extraite dans hooks
 * - Composants UI réutilisables
 * - Dépendances inversées (DIP)
 */
export default function PlaygroundPage() {
  // Authentication check
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      window.location.href = '/login?redirect=/playground'
      return
    }
    setIsAuthenticated(true)
  }, [])

  // Custom hooks pour la logique métier
  const { theme, setTheme } = useTheme()
  const { 
    leftPanelRatio, 
    rowRatio, 
    leftContainerRef,
    setLeftPanelRatio,
    setRowRatio,
    startDrag, 
    endDrag
  } = usePanelLayout()
  const { backendStatus, dockerStatus, checkAll: checkStatus } = useStatus(false)
  const { userLeague: leagueInfo, loading: leagueLoading, fetchUserLeague } = useLeague()
  
  // Charger les infos de ligue au mount
  useEffect(() => {
    if (isAuthenticated) {
      fetchUserLeague()
    }
  }, [isAuthenticated, fetchUserLeague])
  
  const {
    code,
    botId,
    saveStatus,
    botVersionInfo,
    handleCodeChange,
    resetCode,
    initializePlaygroundBot,
    submitToArena
  } = useBotManagement()
  
  const {
    selectedLanguage,
    availableBots,
    selectedPlayer1,
    selectedPlayer2,
    capturedPlayer1Name,
    capturedPlayer2Name,
    setSelectedLanguage,
    setSelectedPlayer1,
    setSelectedPlayer2,
    getPlayerName,
    getAvatarUrl,
    capturePlayerNames
  } = useBotSelection()

  // Game playback hook (gère le runner + l'animation)
  const {
    history,
    fullHistory,
    currentIndex,
    combinedLogs,
    animationDelay,
    isCollecting,
    isPaused,
    isAnimating,
    collectingRef,
    animatingRef,
    pausedRef,
    stoppedRef,
    animationDelayRef,
    setHistory,
    setFullHistory,
    setCombinedLogs,
    setCurrentIndex,
    setAnimationDelay,
    setIsCollecting,
    setIsPaused,
    setIsAnimating,
    getTotalTurns,
    seekToIndex,
    handleSeek,
    startGame: startGamePlayback,
    togglePlayPause,
    stopPlayback,
    progressRatio
  } = useGamePlayback()

  // Modal arena
  const [isModalOpen, setIsModalOpen] = useState(false)

  // Initialize bot and status on mount
  useEffect(() => {
    if (isAuthenticated) {
      initializePlaygroundBot()
      checkStatus()
    }
  }, [isAuthenticated, initializePlaygroundBot, checkStatus])

  /**
   * Handler pour démarrer une partie
   */
  const handleRunCode = async () => {
    if (!selectedPlayer1 || !selectedPlayer2) {
      alert('Veuillez sélectionner les deux joueurs avant de démarrer.')
      return
    }

    // Capturer les noms des joueurs
    capturePlayerNames()

    // Préparer le payload
    let bot1Value = selectedPlayer1
    if (selectedPlayer1.startsWith('bot:')) {
      bot1Value = selectedPlayer1.substring(4)
    }
    
    let bot2Value = selectedPlayer2
    if (selectedPlayer2.startsWith('bot:')) {
      bot2Value = selectedPlayer2.substring(4)
    }
    
    const payload = {
      referee: 'pacman_v2',  // Utiliser v2 qui supporte les ligues
      bot1: bot1Value,
      bot2: bot2Value,
      mode: 'bot-vs-bot'
    }

    // Démarrer le jeu via le hook
    await startGamePlayback(payload, async () => {
      // Sauvegarder le bot avant de démarrer
      if (botId && code) {
        // Note: la sauvegarde auto se fait déjà via handleCodeChange
        return true
      }
      return true
    })
  }

  /**
   * Handler pour soumettre à l'arène
   */
  const handleSubmitToArena = async (versionName, description) => {
    try {
      await submitToArena(versionName, description)
      setIsModalOpen(false)
      // Rafraîchir les infos de ligue après soumission
      fetchUserLeague()
    } catch (e) {
      alert(`❌ Erreur lors de la soumission: ${e.message}`)
    }
  }

  /**
   * Navigation dans l'historique
   */
  const stepBackward = () => {
    if (currentIndex > 0) seekToIndex(currentIndex - 1)
  }

  const stepForward = () => {
    const total = getTotalTurns()
    if (currentIndex < total - 1) seekToIndex(currentIndex + 1)
  }

  const skipToStart = () => {
    seekToIndex(0)
  }

  const skipToEnd = () => {
    const total = getTotalTurns()
    if (total > 0) seekToIndex(total - 1)
  }

  /**
   * Handler pour clic sur un tour dans les logs
   */
  const handleTurnClick = (index) => {
    seekToIndex(index)
  }

  /**
   * Arrête le playback avant un seek manuel
   */
  const stopPlaybackPreserveState = () => {
    stoppedRef.current = true
    pausedRef.current = false
    animatingRef.current = false
    setIsPaused(false)
    setIsAnimating(false)
  }

  /**
   * Handlers pour les splitters
   */
  const handleVerticalSplitterMouseDown = (e) => {
    startDrag()
    const startX = e.clientX
    const startRatio = leftPanelRatio
    const container = e.currentTarget.parentElement
    if (!container) return
    const containerWidth = container.offsetWidth
    const handleMouseMove = (moveE) => {
      const deltaX = moveE.clientX - startX
      const deltaRatio = deltaX / containerWidth
      const newRatio = Math.max(0.25, Math.min(0.9, startRatio + deltaRatio))
      setLeftPanelRatio(newRatio)
    }
    const handleMouseUp = () => {
      endDrag()
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  const handleHorizontalSplitterMouseDown = (e) => {
    startDrag()
    const startY = e.clientY
    const startRatio = rowRatio
    const container = e.currentTarget.parentElement
    if (!container) return
    const containerHeight = container.offsetHeight
    const handleMouseMove = (moveE) => {
      const deltaY = moveE.clientY - startY
      const deltaRatio = deltaY / containerHeight
      const newRatio = Math.max(0.1, Math.min(0.9, startRatio + deltaRatio))
      setRowRatio(newRatio)
    }
    const handleMouseUp = () => {
      endDrag()
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  // Early return si pas authentifié
  if (!isAuthenticated) {
    return null
  }

  return (
    <div className="app">
      {/* Header */}
      <header style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        padding: '0 20px', 
        paddingTop: '10px' 
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <span>GameArena - React Prototype</span>
          {!leagueLoading && leagueInfo && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <LeagueBadge 
                leagueName={leagueInfo.current_league}
                size="small"
                showName={true}
              />
              {leagueInfo.rank > 0 && leagueInfo.total_bots > 0 && (
                <span style={{ fontSize: '14px', color: '#888' }}>
                  Rang {leagueInfo.rank} / {leagueInfo.total_bots}
                </span>
              )}
            </div>
          )}
        </div>
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

      {/* Main Grid */}
      <div 
        className="app-grid" 
        style={{ 
          gridTemplateColumns: `${leftPanelRatio * 100}% ${(1 - leftPanelRatio) * 100}%`, 
          gridTemplateRows: '1fr 1fr', 
          gridTemplateAreas: `'left-col right-col' 'left-col right-col'`, 
          position: 'relative' 
        }}
      >
        
        {/* LEFT COLUMN: Visualizer + Logs */}
        <div 
          className="left-column" 
          ref={leftContainerRef} 
          style={{ 
            gridArea: 'left-col', 
            display: 'grid', 
            gridTemplateRows: `${rowRatio * 100}% ${(1 - rowRatio) * 100}%`, 
            position: 'relative', 
            minHeight: 0 
          }}
        >
          {/* Visualizer */}
          <div className="frame visualizer-frame" style={{ display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
            <Visualizer
              history={history}
              index={currentIndex}
              onPlayPause={togglePlayPause}
              onStepBackward={stepBackward}
              onStepForward={stepForward}
              onSkipToStart={skipToStart}
              onSkipToEnd={skipToEnd}
              onSeek={seekToIndex}
              onUserSeekStart={stopPlaybackPreserveState}
              progressRatio={progressRatio()}
              currentIndex={currentIndex}
              totalTurns={getTotalTurns()}
              animationDelay={animationDelay}
              setAnimationDelay={setAnimationDelay}
              isAnimating={isAnimating}
              isPaused={isPaused}
              player1Name={capturedPlayer1Name}
              player2Name={capturedPlayer2Name}
              currentLeague={leagueInfo?.current_league || 'wood'}
            />
          </div>

          {/* Horizontal splitter */}
          <div 
            className="app-splitter-horizontal" 
            style={{ 
              position: 'absolute', 
              top: `${rowRatio * 100}%`, 
              left: 0, 
              right: 0, 
              height: 6, 
              cursor: 'row-resize', 
              zIndex: 40, 
              background: 'rgba(0,0,0,0.06)', 
              transform: 'translateY(-50%)' 
            }} 
            onMouseDown={handleHorizontalSplitterMouseDown} 
          />

          {/* Logs */}
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

        {/* RIGHT COLUMN: Editor + Controls */}
        <div 
          className="right-column" 
          style={{ 
            gridArea: 'right-col', 
            display: 'flex',
            flexDirection: 'column',
            position: 'relative', 
            minHeight: 0,
            height: '100%',
            gap: '12px'
          }}
        >
          {/* League Rules - Affichage des règles de la ligue */}
          {!leagueLoading && leagueInfo && (
            <LeagueRules leagueInfo={leagueInfo} compact={true} />
          )}

          {/* Editor Panel - flex 1 pour prendre tout l'espace */}
          <EditorPanel
            code={code}
            onChange={handleCodeChange}
            language={selectedLanguage}
            theme={theme}
            canReset={!!botId}
            onReset={resetCode}
            saveStatus={saveStatus}
            botId={botId}
          />

          {/* Game Controls Panel - hauteur fixe */}
          <div style={{ flexShrink: 0, minHeight: 'auto' }}>
            <GameControlsPanel
            selectedPlayer1={selectedPlayer1}
            selectedPlayer2={selectedPlayer2}
            onSelectPlayer1={setSelectedPlayer1}
            onSelectPlayer2={setSelectedPlayer2}
            onClearPlayer1={() => setSelectedPlayer1(null)}
            onClearPlayer2={() => setSelectedPlayer2(null)}
            getPlayerName={getPlayerName}
            getAvatarUrl={getAvatarUrl}
            availableBots={availableBots}
            backendStatus={backendStatus}
            dockerStatus={dockerStatus}
            theme={theme}
            onThemeChange={setTheme}
            animationDelay={animationDelay}
            onSpeedChange={setAnimationDelay}
            isCollecting={isCollecting}
            botId={botId}
            botVersionInfo={botVersionInfo}
            onRunCode={handleRunCode}
            onSubmitToArena={() => setIsModalOpen(true)}
            />
          </div>
        </div>

        {/* Vertical splitter */}
        <div 
          className="app-splitter-vertical" 
          style={{ 
            position: 'absolute', 
            left: `${leftPanelRatio * 100}%`, 
            top: 0, 
            bottom: 0, 
            width: 6, 
            cursor: 'col-resize', 
            zIndex: 40, 
            background: 'rgba(0,0,0,0.06)', 
            transform: 'translateX(-50%)' 
          }} 
          onMouseDown={handleVerticalSplitterMouseDown} 
        />
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
