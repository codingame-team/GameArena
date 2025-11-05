import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import Leaderboard from './Leaderboard'
import MyBots from './MyBots'
import AvatarSettings from './AvatarSettings'
import LeagueBadge from './LeagueBadge'
import LeagueProgress from './LeagueProgress'
import useLeague from '../hooks/useLeague'

export default function ArenaPage() {
  const [activeTab, setActiveTab] = useState('leaderboard')
  const { user, logout } = useAuth()
  const { userLeague, fetchUserLeague, loading: leagueLoading } = useLeague()

  // Charger les données de ligue au mount
  useEffect(() => {
    if (user) {
      fetchUserLeague()
    }
  }, [user, fetchUserLeague])

  return (
    <div className="arena-page">
      <nav className="arena-nav">
        <div className="arena-nav-brand">
          <h1>🎮 GameArena</h1>
        </div>
        <div className="arena-nav-tabs">
          <button
            className={activeTab === 'leaderboard' ? 'active' : ''}
            onClick={() => setActiveTab('leaderboard')}
          >
            🏆 Classement
          </button>
          <button
            className={activeTab === 'my-bots' ? 'active' : ''}
            onClick={() => setActiveTab('my-bots')}
          >
            🤖 Mes Bots
          </button>
          <button
            className={activeTab === 'settings' ? 'active' : ''}
            onClick={() => setActiveTab('settings')}
          >
            ⚙️ Paramètres
          </button>
          <button
            className={activeTab === 'playground' ? 'active' : ''}
            onClick={() => window.location.href = '/'}
          >
            🎯 Terrain de jeu
          </button>
        </div>
        <div className="arena-nav-user">
          <div className="user-info-container">
            <div className="user-info-main">
              <span className="user-info">
                👤 {user?.username} <small>(ELO: {user?.elo_rating || 1200})</small>
              </span>
              {userLeague && !leagueLoading && (
                <LeagueBadge 
                  leagueName={userLeague.current_league}
                  size="small"
                  showName={false}
                />
              )}
            </div>
          </div>
          <button onClick={logout} className="btn-logout">
            Déconnexion
          </button>
        </div>
      </nav>

      <div className="arena-content">
        {/* Afficher la progression de ligue en haut */}
        {userLeague && !leagueLoading && (
          <div className="arena-league-section">
            <LeagueProgress
              currentLeague={userLeague.current_league}
              currentLeagueIndex={userLeague.current_league_index}
              nextLeague={userLeague.next_league}
              elo={userLeague.elo}
              currentThreshold={userLeague.current_threshold}
              nextThreshold={userLeague.next_threshold}
              progressPercent={userLeague.progress_percent}
              showDetails={true}
            />
          </div>
        )}
        
        {activeTab === 'leaderboard' && <Leaderboard />}
        {activeTab === 'my-bots' && <MyBots />}
        {activeTab === 'settings' && <AvatarSettings />}
      </div>
    </div>
  )
}
