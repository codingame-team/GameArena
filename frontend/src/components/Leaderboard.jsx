import React, { useState, useEffect } from 'react'
import axios from 'axios'
import API_BASE_URL from '../config'
import LeagueBadge from './LeagueBadge'
import { leagueApi } from '../services/leagueApi'

export default function Leaderboard() {
  const [leaderboard, setLeaderboard] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedLeague, setSelectedLeague] = useState(null) // null = toutes les ligues

  useEffect(() => {
    fetchLeaderboard()
  }, [selectedLeague])

  const fetchLeaderboard = async () => {
    setLoading(true)
    try {
      // Utiliser la nouvelle API avec support des ligues
      const data = await leagueApi.getLeaderboard({ 
        league: selectedLeague, 
        limit: 100 
      })
      setLeaderboard(data.leaderboard || [])
      setError('')
    } catch (err) {
      setError('Erreur lors du chargement du classement')
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div className="loading">Chargement...</div>
  if (error) return <div className="error-message">{error}</div>

  return (
    <div className="leaderboard-container">
      <div className="leaderboard-header">
        <h2>🏆 Classement des Joueurs</h2>
        
        {/* Filtres par ligue */}
        <div className="league-filters">
          <button 
            className={selectedLeague === null ? 'league-filter-btn active' : 'league-filter-btn'}
            onClick={() => setSelectedLeague(null)}
          >
            Toutes les ligues
          </button>
          <button 
            className={selectedLeague === 'wood2' ? 'league-filter-btn active' : 'league-filter-btn'}
            onClick={() => setSelectedLeague('wood2')}
          >
            🌱 Wood 2
          </button>
          <button 
            className={selectedLeague === 'wood1' ? 'league-filter-btn active' : 'league-filter-btn'}
            onClick={() => setSelectedLeague('wood1')}
          >
            🪵 Wood 1
          </button>
          <button 
            className={selectedLeague === 'bronze' ? 'league-filter-btn active' : 'league-filter-btn'}
            onClick={() => setSelectedLeague('bronze')}
          >
            🥉 Bronze
          </button>
          <button 
            className={selectedLeague === 'silver' ? 'league-filter-btn active' : 'league-filter-btn'}
            onClick={() => setSelectedLeague('silver')}
          >
            🥈 Silver
          </button>
          <button 
            className={selectedLeague === 'gold' ? 'league-filter-btn active' : 'league-filter-btn'}
            onClick={() => setSelectedLeague('gold')}
          >
            🥇 Gold
          </button>
        </div>
      </div>
      
      <table className="leaderboard-table">
        <thead>
          <tr>
            <th>Rang</th>
            <th>Joueur</th>
            <th>Ligue</th>
            <th>ELO</th>
            <th>Avatar</th>
          </tr>
        </thead>
        <tbody>
          {leaderboard.map((player) => (
            <tr key={player.username || player.name || player.id} className={player.is_boss ? 'boss-row' : ''}>
              <td className="rank">
                {player.rank <= 3 ? ['🥇', '🥈', '🥉'][player.rank - 1] : player.rank}
              </td>
              <td className="player-name">
                {player.is_boss ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <img 
                      src={`/avatars/${player.avatar}.svg`} 
                      alt={player.name}
                      style={{ width: '24px', height: '24px', borderRadius: '50%' }}
                      onError={(e) => { e.target.src = '/avatars/boss.svg' }}
                    />
                    <strong>{player.name}</strong>
                    <span style={{ fontSize: '0.8em', color: '#ffd700' }}>👑 BOSS</span>
                  </span>
                ) : (
                  player.username
                )}
              </td>
              <td className="league-cell">
                <LeagueBadge 
                  leagueName={player.league}
                  leagueIndex={player.league_index}
                  size="small"
                  showName={true}
                />
              </td>
              <td className="elo">{player.elo}</td>
              <td className="avatar">
                {!player.is_boss && (player.avatar || '👤')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {leaderboard.length === 0 && (
        <p style={{ textAlign: 'center', padding: '20px', color: 'var(--text)' }}>
          {selectedLeague 
            ? `Aucun joueur dans la ligue ${selectedLeague.toUpperCase()} pour le moment.`
            : 'Aucun joueur dans le classement pour le moment.'
          }
        </p>
      )}
    </div>
  )
}
