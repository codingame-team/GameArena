import React, { useState, useEffect } from 'react'
import axios from 'axios'
import API_BASE_URL from '../config'

export default function Leaderboard() {
  const [leaderboard, setLeaderboard] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchLeaderboard()
  }, [])

  const fetchLeaderboard = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/arena/leaderboard`)
      setLeaderboard(response.data.leaderboard)
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
      <h2>🏆 Classement des Bots</h2>
      <table className="leaderboard-table">
        <thead>
          <tr>
            <th>Rang</th>
            <th>Bot</th>
            <th>Créateur</th>
            <th>ELO</th>
            <th>Parties</th>
            <th>Victoires</th>
            <th>Taux</th>
          </tr>
        </thead>
        <tbody>
          {leaderboard.map((bot) => (
            <tr key={bot.id} className={bot.is_boss ? 'boss-row' : ''}>
              <td className="rank">
                {bot.rank <= 3 ? ['🥇', '🥈', '🥉'][bot.rank - 1] : bot.rank}
              </td>
              <td className="bot-name">
                {bot.is_boss && '👑 '}
                {bot.name}
                {bot.is_boss && ' (Boss)'}
              </td>
              <td className="owner-name">{bot.owner_username}</td>
              <td className="elo">{bot.elo_rating}</td>
              <td>{bot.match_count}</td>
              <td>{bot.win_count}</td>
              <td>{bot.win_rate}%</td>
            </tr>
          ))}
        </tbody>
      </table>
      {leaderboard.length === 0 && (
        <p style={{ textAlign: 'center', padding: '20px', color: 'var(--text)' }}>
          Aucun bot dans le classement pour le moment. Soumettez votre premier bot !
        </p>
      )}
      {leaderboard.length > 0 && leaderboard.some(bot => bot.is_boss && bot.match_count === 0) && (
        <div style={{ 
          marginTop: '16px', 
          padding: '12px', 
          background: 'rgba(255, 215, 0, 0.1)', 
          border: '1px solid #ffd700',
          borderRadius: '6px',
          color: 'var(--text)',
          fontSize: '14px'
        }}>
          👑 <strong>Boss</strong> : Le bot Boss est disponible comme adversaire d'entraînement. 
          Son classement sera mis à jour après avoir joué au moins 5 parties contre d'autres bots.
        </div>
      )}
    </div>
  )
}
