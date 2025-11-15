import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import Leaderboard from './Leaderboard'
import MyBots from './MyBots'
import AvatarSettings from './AvatarSettings'
import LeagueBadge from './LeagueBadge'
import LeagueProgress from './LeagueProgress'
import useLeague from '../hooks/useLeague'

const NAV_TABS = [
  { id: 'leaderboard', icon: '🏆', label: 'Classement' },
  { id: 'my-bots', icon: '🤖', label: 'Mes Bots' },
  { id: 'settings', icon: '⚙️', label: 'Paramètres' },
  { id: 'playground', icon: '🎯', label: 'Terrain de jeu', action: () => window.location.href = '/' }
]

export default function ArenaPage() {
  const [activeTab, setActiveTab] = useState('leaderboard')
  const { user, logout } = useAuth()
  const { userLeague, fetchUserLeague, loading: leagueLoading } = useLeague()

  useEffect(() => {
    if (user) {
      fetchUserLeague()
    }
  }, [user, fetchUserLeague])

  const handleTabClick = (tab) => {
    if (tab.action) {
      tab.action()
    } else {
      setActiveTab(tab.id)
    }
  }

  return (
    <div className="arena-page">
      <nav className="arena-nav">
        <div className="arena-nav-brand">
          <h1>🎮 GameArena</h1>
        </div>
        <div className="arena-nav-tabs">
          {NAV_TABS.map(tab => (
            <button
              key={tab.id}
              className={activeTab === tab.id ? 'active' : ''}
              onClick={() => handleTabClick(tab)}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
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
