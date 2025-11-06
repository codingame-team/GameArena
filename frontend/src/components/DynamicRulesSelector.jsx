import React, { useState } from 'react'
import GameRules from './GameRules'
import TicTacToeRules from './TicTacToeRules'
import PacmanAdvancedRules from './PacmanAdvancedRules'

/**
 * Composant exemple montrant comment basculer dynamiquement entre
 * différents jeux et différentes ligues
 * 
 * USAGE dans PlaygroundPage.jsx :
 * 
 * import DynamicRulesSelector from './components/DynamicRulesSelector'
 * 
 * <DynamicRulesSelector 
 *   gameType="pacman" 
 *   league="gold" 
 * />
 */

export default function DynamicRulesSelector({ 
  gameType = 'pacman', 
  league = 'wood',
  showSelector = true 
}) {
  const [selectedGame, setSelectedGame] = useState(gameType)
  const [selectedLeague, setSelectedLeague] = useState(league)

  // Mapping des jeux disponibles
  const games = {
    pacman: {
      name: 'Pacman',
      icon: '👾',
      hasLeagues: true,
      leagues: ['wood', 'bronze', 'silver', 'gold']
    },
    tictactoe: {
      name: 'TicTacToe',
      icon: '❌⭕',
      hasLeagues: false
    }
  }

  // Rendu du composant de règles approprié
  const renderRules = () => {
    switch (selectedGame) {
      case 'pacman':
        if (selectedLeague === 'wood') {
          return <GameRules league="wood" />
        }
        return <PacmanAdvancedRules league={selectedLeague} />
      
      case 'tictactoe':
        return <TicTacToeRules />
      
      default:
        return <GameRules league="wood" />
    }
  }

  return (
    <div style={{ 
      background: 'var(--frame-bg)', 
      borderTop: '1px solid rgba(0,0,0,0.1)',
      marginTop: '12px'
    }}>
      {/* Sélecteur optionnel */}
      {showSelector && (
        <div style={{ 
          padding: '12px', 
          borderBottom: '1px solid rgba(0,0,0,0.1)',
          display: 'flex',
          gap: '20px',
          alignItems: 'center',
          flexWrap: 'wrap'
        }}>
          {/* Sélecteur de jeu */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <label style={{ fontWeight: 'bold', fontSize: '14px' }}>
              Jeu :
            </label>
            <select
              value={selectedGame}
              onChange={(e) => setSelectedGame(e.target.value)}
              style={{
                padding: '6px 12px',
                borderRadius: '4px',
                border: '1px solid rgba(255,255,255,0.2)',
                background: 'rgba(0,0,0,0.2)',
                color: 'var(--text)',
                cursor: 'pointer'
              }}
            >
              {Object.entries(games).map(([key, game]) => (
                <option key={key} value={key}>
                  {game.icon} {game.name}
                </option>
              ))}
            </select>
          </div>

          {/* Sélecteur de ligue (si applicable) */}
          {games[selectedGame]?.hasLeagues && (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <label style={{ fontWeight: 'bold', fontSize: '14px' }}>
                Ligue :
              </label>
              <select
                value={selectedLeague}
                onChange={(e) => setSelectedLeague(e.target.value)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '4px',
                  border: '1px solid rgba(255,255,255,0.2)',
                  background: 'rgba(0,0,0,0.2)',
                  color: 'var(--text)',
                  cursor: 'pointer'
                }}
              >
                {games[selectedGame].leagues.map((leagueName) => (
                  <option key={leagueName} value={leagueName}>
                    {leagueName.charAt(0).toUpperCase() + leagueName.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Info badge */}
          <div style={{
            marginLeft: 'auto',
            padding: '4px 12px',
            background: 'rgba(76, 175, 80, 0.1)',
            border: '1px solid rgba(76, 175, 80, 0.3)',
            borderRadius: '12px',
            fontSize: '12px',
            color: '#7cc576'
          }}>
            ℹ️ Règles actuelles : {games[selectedGame].name}
            {games[selectedGame]?.hasLeagues && ` - ${selectedLeague}`}
          </div>
        </div>
      )}

      {/* Affichage des règles */}
      {renderRules()}
    </div>
  )
}

/**
 * EXEMPLES D'INTÉGRATION
 * 
 * 1. Avec sélecteur visible :
 * 
 * <DynamicRulesSelector 
 *   gameType="pacman" 
 *   league="bronze"
 *   showSelector={true}
 * />
 * 
 * 2. Sans sélecteur (règles fixes) :
 * 
 * <DynamicRulesSelector 
 *   gameType="tictactoe"
 *   showSelector={false}
 * />
 * 
 * 3. Basé sur l'état du jeu :
 * 
 * const [currentGame, setCurrentGame] = useState('pacman')
 * const [userLeague, setUserLeague] = useState('wood')
 * 
 * <DynamicRulesSelector 
 *   gameType={currentGame}
 *   league={userLeague}
 *   showSelector={true}
 * />
 * 
 * 4. Intégration dans Visualizer.jsx :
 * 
 * // Remplacer :
 * <GameRules league="wood" />
 * 
 * // Par :
 * <DynamicRulesSelector 
 *   gameType={refereeType} // 'pacman', 'tictactoe', etc.
 *   league={currentLeague} // Basé sur l'ELO ou progression
 *   showSelector={false}   // Pas de sélecteur en mode jeu
 * />
 */
