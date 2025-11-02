import React, { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import Leaderboard from './Leaderboard'
import MyBots from './MyBots'
import AvatarSettings from './AvatarSettings'

export default function ArenaPage() {
  const [activeTab, setActiveTab] = useState('leaderboard')
  const { user, logout } = useAuth()

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
          <span className="user-info">
            👤 {user?.username} <small>(ELO: {user?.elo_rating || 1200})</small>
          </span>
          <button onClick={logout} className="btn-logout">
            Déconnexion
          </button>
        </div>
      </nav>

      <div className="arena-content">
        {activeTab === 'leaderboard' && <Leaderboard />}
        {activeTab === 'my-bots' && <MyBots />}
        {activeTab === 'settings' && <AvatarSettings />}
      </div>
    </div>
  )
}
