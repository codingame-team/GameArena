import React, { useState } from 'react'

/**
 * Component for displaying and selecting player bots with avatars
 * @param {Object} props
 * @param {string|null} props.selectedPlayer1 - Selected player 1 ID
 * @param {string|null} props.selectedPlayer2 - Selected player 2 ID
 * @param {Function} props.onSelectPlayer1 - Callback when player 1 is selected (receives playerId)
 * @param {Function} props.onSelectPlayer2 - Callback when player 2 is selected (receives playerId)
 * @param {Function} props.onClearPlayer1 - Callback to clear player 1 selection
 * @param {Function} props.onClearPlayer2 - Callback to clear player 2 selection
 * @param {Function} props.getPlayerName - Function to get player display name
 * @param {Function} props.getAvatarUrl - Function to get player avatar URL
 * @param {Array} props.availableBots - List of available bots to select from
 */
export default function BotSelectionPanel({
  selectedPlayer1,
  selectedPlayer2,
  onSelectPlayer1,
  onSelectPlayer2,
  onClearPlayer1,
  onClearPlayer2,
  getPlayerName,
  getAvatarUrl,
  availableBots = []
}) {
  const [showPlayerModal, setShowPlayerModal] = useState(null) // null, 'player1', or 'player2'

  const handleSelectBot = (botSelection) => {
    if (showPlayerModal === 'player1') {
      onSelectPlayer1(botSelection)
    } else if (showPlayerModal === 'player2') {
      onSelectPlayer2(botSelection)
    }
    setShowPlayerModal(null)
  }

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '180px' }}>
        <h4 style={{ margin: 0, fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>JOUEURS</h4>
        
        {/* Avatars in row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          {/* Player 1 Avatar */}
          <PlayerAvatar
            playerId={selectedPlayer1}
            playerNumber={1}
            playerName={selectedPlayer1 ? getPlayerName(selectedPlayer1) : 'Joueur 1'}
            avatarUrl={getAvatarUrl(selectedPlayer1)}
            onSelect={() => setShowPlayerModal('player1')}
            onClear={onClearPlayer1}
            color="#ff4444"
          />
          
          {/* Player 2 Avatar */}
          <PlayerAvatar
            playerId={selectedPlayer2}
            playerNumber={2}
            playerName={selectedPlayer2 ? getPlayerName(selectedPlayer2) : 'Joueur 2'}
            avatarUrl={getAvatarUrl(selectedPlayer2)}
            onSelect={() => setShowPlayerModal('player2')}
            onClear={onClearPlayer2}
            color="#4444ff"
          />
        </div>
      </div>

      {/* Player Selection Modal */}
      {showPlayerModal && (
        <PlayerSelectionModal
          title={`Sélectionner ${showPlayerModal === 'player1' ? 'Joueur 1' : 'Joueur 2'}`}
          selectedPlayer={showPlayerModal === 'player1' ? selectedPlayer1 : selectedPlayer2}
          availableBots={availableBots}
          getAvatarUrl={getAvatarUrl}
          onSelectBot={handleSelectBot}
          onClose={() => setShowPlayerModal(null)}
        />
      )}
    </>
  )
}

/**
 * Individual player avatar component
 */
function PlayerAvatar({ 
  playerId, 
  playerNumber, 
  playerName, 
  avatarUrl, 
  onSelect, 
  onClear,
  color 
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
      <div 
        onClick={onSelect}
        title={`Cliquer pour sélectionner Joueur ${playerNumber}`}
        style={{ 
          width: '56px', 
          height: '56px', 
          cursor: 'pointer',
          border: '2px solid #ddd',
          borderRadius: '8px',
          overflow: 'hidden',
          transition: 'transform 0.2s, border-color 0.2s'
        }}
        onMouseEnter={(e) => { 
          e.currentTarget.style.transform = 'scale(1.05)'
          e.currentTarget.style.borderColor = '#4a90e2'
        }}
        onMouseLeave={(e) => { 
          e.currentTarget.style.transform = 'scale(1)'
          e.currentTarget.style.borderColor = '#ddd'
        }}
      >
        <img 
          src={avatarUrl}
          alt={playerName}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          onError={(e) => { e.target.src = '/avatars/no_avatar.svg' }}
        />
      </div>
      
      <div style={{ 
        fontSize: '9px', 
        fontWeight: '600', 
        textAlign: 'center', 
        width: '75px', 
        overflow: 'hidden', 
        textOverflow: 'ellipsis', 
        whiteSpace: 'nowrap', 
        color: playerId ? color : '#999'
      }}>
        {playerName}
      </div>
      
      {playerId && (
        <button 
          onClick={(e) => { 
            e.stopPropagation()
            onClear()
          }}
          style={{ 
            fontSize: '8px', 
            padding: '2px 5px', 
            background: '#ff6b6b', 
            color: 'white', 
            border: 'none', 
            borderRadius: '3px', 
            cursor: 'pointer',
            whiteSpace: 'nowrap'
          }}
        >
          ✕
        </button>
      )}
    </div>
  )
}

/**
 * Modal for selecting a player/bot
 */
function PlayerSelectionModal({ 
  title, 
  selectedPlayer, 
  availableBots, 
  getAvatarUrl, 
  onSelectBot, 
  onClose 
}) {
  return (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000
      }}
      onClick={onClose}
    >
      <div 
        style={{
          background: 'white',
          borderRadius: '8px',
          padding: '20px',
          maxWidth: '500px',
          maxHeight: '80vh',
          overflow: 'auto',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ margin: '0 0 16px 0' }}>{title}</h3>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
          {/* Boss option */}
          <BotOption
            botId="Boss"
            name="Boss"
            avatarUrl="/avatars/boss.svg"
            isSelected={selectedPlayer === 'Boss'}
            backgroundColor="#fff9e6"
            borderColorHover="#ffd700"
            onSelect={() => onSelectBot('Boss')}
          />
          
          {/* Other bots */}
          {availableBots.map(bot => (
            <BotOption
              key={bot.id}
              botId={`bot:${bot.id}`}
              name={bot.name}
              avatarUrl={getAvatarUrl(`bot:${bot.id}`)}
              eloRating={bot.elo_rating}
              isSelected={selectedPlayer === `bot:${bot.id}`}
              backgroundColor="#e8f5e9"
              borderColorHover="#4a90e2"
              onSelect={() => onSelectBot(`bot:${bot.id}`)}
            />
          ))}
        </div>
        
        <button
          onClick={onClose}
          style={{
            marginTop: '16px',
            width: '100%',
            padding: '8px',
            background: '#e0e0e0',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: '600'
          }}
        >
          Annuler
        </button>
      </div>
    </div>
  )
}

/**
 * Individual bot option in the selection modal
 */
function BotOption({ 
  botId, 
  name, 
  avatarUrl, 
  eloRating, 
  isSelected, 
  backgroundColor, 
  borderColorHover,
  onSelect 
}) {
  return (
    <div
      onClick={onSelect}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '8px',
        padding: '12px',
        border: '2px solid #ddd',
        borderRadius: '8px',
        cursor: 'pointer',
        transition: 'all 0.2s',
        background: isSelected ? backgroundColor : 'white'
      }}
      onMouseEnter={(e) => { 
        e.currentTarget.style.transform = 'scale(1.05)'
        e.currentTarget.style.borderColor = borderColorHover
      }}
      onMouseLeave={(e) => { 
        e.currentTarget.style.transform = 'scale(1)'
        e.currentTarget.style.borderColor = '#ddd'
      }}
    >
      <img 
        src={avatarUrl}
        alt={name}
        style={{ width: '64px', height: '64px', objectFit: 'cover', borderRadius: '4px' }}
        onError={(e) => { e.target.src = '/avatars/no_avatar.svg' }}
      />
      <div style={{ 
        fontSize: botId === 'Boss' ? '12px' : '11px', 
        fontWeight: '600', 
        textAlign: 'center', 
        maxWidth: '100px', 
        overflow: 'hidden', 
        textOverflow: 'ellipsis', 
        whiteSpace: 'nowrap' 
      }}>
        {name}
      </div>
      {eloRating !== undefined && (
        <div style={{ fontSize: '9px', color: '#666' }}>ELO: {eloRating}</div>
      )}
    </div>
  )
}
