import React from 'react'
import BotSelectionPanel from './BotSelectionPanel'
import OptionsPanel from './OptionsPanel'

/**
 * Composant panel contrôles du jeu.
 * 
 * Responsabilité (SRP): Regroupement des contrôles de jeu uniquement
 * - Sélection des joueurs (bots)
 * - Options (status, theme, speed)
 * - Actions (run, submit to arena)
 * 
 * @param {Object} props
 * @returns {JSX.Element}
 */
export default function GameControlsPanel({
  // Bot selection props
  selectedPlayer1,
  selectedPlayer2,
  onSelectPlayer1,
  onSelectPlayer2,
  onClearPlayer1,
  onClearPlayer2,
  getPlayerName,
  getAvatarUrl,
  availableBots,
  
  // Options props
  backendStatus,
  dockerStatus,
  theme,
  onThemeChange,
  animationDelay,
  onSpeedChange,
  
  // Actions props
  isCollecting,
  botId,
  botVersionInfo,
  onRunCode,
  onSubmitToArena
}) {
  return (
    <div className="frame controls-frame" style={{ 
      display: 'flex', 
      flexDirection: 'row', 
      justifyContent: 'space-between', 
      alignItems: 'flex-start', 
      gap: '15px', 
      padding: '10px' 
    }}>
      {/* SECTION 1: Bot Selection (LEFT) */}
      <BotSelectionPanel
        selectedPlayer1={selectedPlayer1}
        selectedPlayer2={selectedPlayer2}
        onSelectPlayer1={onSelectPlayer1}
        onSelectPlayer2={onSelectPlayer2}
        onClearPlayer1={onClearPlayer1}
        onClearPlayer2={onClearPlayer2}
        getPlayerName={getPlayerName}
        getAvatarUrl={getAvatarUrl}
        availableBots={availableBots}
      />

      {/* SECTION 2: Options (CENTER) */}
      <OptionsPanel
        backendStatus={backendStatus}
        dockerStatus={dockerStatus}
        theme={theme}
        onThemeChange={onThemeChange}
        animationDelay={animationDelay}
        onSpeedChange={onSpeedChange}
      />

      {/* SECTION 3: Action Buttons (RIGHT) */}
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '8px', 
        justifyContent: 'flex-start', 
        minWidth: '200px' 
      }}>
        <h4 style={{ 
          margin: 0, 
          fontSize: '12px', 
          fontWeight: 'bold', 
          marginBottom: '4px' 
        }}>
          ACTIONS
        </h4>
        
        {/* Run code button */}
        <button 
          onClick={onRunCode} 
          disabled={isCollecting} 
          aria-busy={isCollecting} 
          aria-live="polite" 
          style={{ 
            fontSize: '14px', 
            padding: '8px 12px', 
            width: '100%' 
          }}
        >
          {isCollecting ? 'Collecting...' : '▶ Run my code'}
        </button>
        
        {/* Submit to arena button */}
        <button 
          onClick={onSubmitToArena} 
          disabled={!botId || isCollecting}
          style={{ 
            fontSize: '13px', 
            padding: '8px 12px', 
            width: '100%', 
            background: botId ? '#4CAF50' : '#ccc', 
            color: 'white', 
            border: 'none', 
            borderRadius: '4px', 
            cursor: botId ? 'pointer' : 'not-allowed', 
            opacity: (!botId || isCollecting) ? 0.5 : 1 
          }}
          title={!botId ? 'Sauvegardez d\'abord votre bot' : 'Soumettre cette version à l\'arène'}
        >
          🏆 Submit to Arena
        </button>
        
        {/* Bot status info */}
        <div style={{ 
          fontSize: '10px', 
          color: '#666', 
          display: 'flex', 
          alignItems: 'center', 
          gap: '3px', 
          justifyContent: 'center', 
          flexWrap: 'wrap' 
        }}>
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
            <span style={{ color: '#f00' }}>
              ⚠️ Bot not loaded - button disabled
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
