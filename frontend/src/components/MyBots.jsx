import React, { useState, useEffect } from 'react'
import axios from 'axios'
import { useAuth } from '../contexts/AuthContext'
import MonacoEditor from './MonacoEditor'
import API_BASE_URL from '../config'

export default function MyBots() {
  const [bots, setBots] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [botVersions, setBotVersions] = useState({})
  const [expandedBot, setExpandedBot] = useState(null)
  const [viewingCode, setViewingCode] = useState(null)
  const { user } = useAuth()

  const getAuthHeaders = () => ({
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
  })

  useEffect(() => {
    fetchBots()
  }, [])

  const fetchBots = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/bots/my`, getAuthHeaders())
      setBots(response.data || [])
      setError('')
    } catch (err) {
      setError('Erreur lors du chargement des bots')
    } finally {
      setLoading(false)
    }
  }

  const fetchBotVersions = async (botId) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/bots/${botId}/versions`, getAuthHeaders())
      setBotVersions(prev => ({ ...prev, [botId]: response.data.versions || [] }))
    } catch (err) {
      console.error('Erreur lors du chargement des versions:', err)
    }
  }

  const handleToggleVersions = async (botId) => {
    if (expandedBot === botId) {
      setExpandedBot(null)
    } else {
      setExpandedBot(botId)
      if (!botVersions[botId]) {
        await fetchBotVersions(botId)
      }
    }
  }

  const handleViewCode = async (botId, versionNumber, versionName) => {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/api/bots/${botId}/versions/${versionNumber}`,
        getAuthHeaders()
      )
      setViewingCode({
        botId,
        versionNumber,
        versionName,
        code: response.data.version.code
      })
    } catch (err) {
      alert(err.response?.data?.error || 'Erreur lors du chargement du code')
    }
  }

  const handleLoadVersion = async (botId, versionNumber) => {
    try {
      await axios.post(
        `${API_BASE_URL}/api/bots/${botId}/load-version/${versionNumber}`,
        {},
        getAuthHeaders()
      )
      alert(`Version ${versionNumber} chargée dans le Playground !`)
      window.location.href = '/'
    } catch (err) {
      alert(err.response?.data?.error || 'Erreur lors du chargement de la version')
    }
  }

  const handleChallenge = async (botId) => {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/arena/challenge`,
        { my_bot_id: botId },
        getAuthHeaders()
      )
      window.location.href = `/?game=${response.data.game_id}`
    } catch (err) {
      alert(err.response?.data?.error || 'Erreur lors du lancement du match')
    }
  }

  if (loading) return <div className="loading">Chargement...</div>

  return (
    <div className="my-bots-container">
      <div className="bots-header">
        <h2>Mes Bots</h2>
        <p style={{ fontSize: '14px', color: '#666', margin: '8px 0' }}>
          Utilisez le Terrain de jeu pour créer et soumettre vos bots à l'arène
        </p>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="bots-list">
        {bots.map((bot) => (
          <div key={bot.id} className="bot-card">
            <div className="bot-card-header">
              <h3>{bot.name}</h3>
              <span className={`bot-status ${bot.is_active ? 'active' : 'inactive'}`}>
                {bot.is_active ? 'Actif' : 'Inactif'}
              </span>
            </div>
            <div className="bot-card-stats">
              <div className="stat">
                <span className="stat-label">ELO</span>
                <span className="stat-value">{bot.elo_rating}</span>
              </div>
              <div className="stat">
                <span className="stat-label">Parties</span>
                <span className="stat-value">{bot.match_count}</span>
              </div>
              <div className="stat">
                <span className="stat-label">Victoires</span>
                <span className="stat-value">{bot.win_count}</span>
              </div>
              <div className="stat">
                <span className="stat-label">Taux</span>
                <span className="stat-value">{bot.win_rate}%</span>
              </div>
              <div className="stat">
                <span className="stat-label">Versions</span>
                <span className="stat-value">{bot.latest_version_number || 0}</span>
              </div>
            </div>
            <div className="bot-card-actions">
              <button 
                className="btn-secondary"
                onClick={() => handleChallenge(bot.id)}
                disabled={!bot.is_active}
                style={{ marginBottom: '8px' }}
              >
                ⚔️ Lancer un match
              </button>
              {bot.latest_version_number > 0 && (
                <button 
                  className="btn-secondary"
                  onClick={() => handleToggleVersions(bot.id)}
                  style={{ width: '100%' }}
                >
                  {expandedBot === bot.id ? '▼' : '▶'} Historique des versions ({bot.latest_version_number})
                </button>
              )}
            </div>
            
            {/* Versions list */}
            {expandedBot === bot.id && (
              <div className="bot-versions" style={{ 
                marginTop: '12px', 
                padding: '12px', 
                background: 'rgba(0,0,0,0.02)', 
                borderRadius: '4px',
                maxHeight: '300px',
                overflowY: 'auto'
              }}>
                <h4 style={{ margin: '0 0 8px 0', fontSize: '13px', fontWeight: 'bold' }}>
                  Versions soumises à l'arène
                </h4>
                {botVersions[bot.id] ? (
                  botVersions[bot.id].length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {botVersions[bot.id].map((version) => (
                        <div 
                          key={version.version_number} 
                          style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            alignItems: 'center',
                            padding: '8px',
                            background: 'white',
                            borderRadius: '4px',
                            border: '1px solid rgba(0,0,0,0.1)'
                          }}
                        >
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 'bold', fontSize: '12px' }}>
                              v{version.version_number} - {version.version_name}
                            </div>
                            {version.description && (
                              <div style={{ fontSize: '11px', color: '#666', marginTop: '2px' }}>
                                {version.description}
                              </div>
                            )}
                            <div style={{ fontSize: '10px', color: '#999', marginTop: '2px' }}>
                              {new Date(version.created_at).toLocaleString()}
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '4px', marginLeft: '8px' }}>
                            <button 
                              className="btn-secondary"
                              onClick={() => handleViewCode(bot.id, version.version_number, version.version_name)}
                              style={{ 
                                fontSize: '11px', 
                                padding: '4px 8px'
                              }}
                              title="Voir le code de cette version"
                            >
                              👁️ Voir
                            </button>
                            <button 
                              className="btn-primary"
                              onClick={() => handleLoadVersion(bot.id, version.version_number)}
                              style={{ 
                                fontSize: '11px', 
                                padding: '4px 8px'
                              }}
                              title="Charger cette version dans le Playground"
                            >
                              📝 Charger
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p style={{ fontSize: '12px', color: '#666', textAlign: 'center' }}>
                      Aucune version disponible
                    </p>
                  )
                ) : (
                  <p style={{ fontSize: '12px', color: '#666', textAlign: 'center' }}>
                    Chargement...
                  </p>
                )}
              </div>
            )}
            
            <div className="bot-card-footer">
              <small>Créé le {new Date(bot.created_at).toLocaleDateString()}</small>
            </div>
          </div>
        ))}
        {bots.length === 0 && (
          <p style={{ textAlign: 'center', padding: '40px' }}>
            Vous n'avez pas encore de bots. Créez-en un pour commencer !
          </p>
        )}
      </div>

      {/* Code Viewer Modal */}
      {viewingCode && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
          }}
          onClick={() => setViewingCode(null)}
        >
          <div 
            style={{
              background: 'white',
              borderRadius: '8px',
              width: '90%',
              maxWidth: '1200px',
              height: '80vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
              overflow: 'hidden'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid #e0e0e0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexShrink: 0
            }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>
                Code - Version {viewingCode.versionNumber}: {viewingCode.versionName}
              </h3>
              <button 
                onClick={() => setViewingCode(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  padding: '0 8px',
                  color: '#666'
                }}
                title="Fermer"
              >
                ×
              </button>
            </div>

            {/* Modal Body - Code Editor */}
            <div style={{
              flex: 1,
              overflow: 'hidden',
              padding: '12px',
              display: 'flex',
              flexDirection: 'column',
              minHeight: 0
            }}>
              <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
                <MonacoEditor
                  value={viewingCode.code}
                  onChange={() => {}} // Read-only
                  language="python"
                  theme="vs-dark"
                  options={{
                    readOnly: true,
                    minimap: { enabled: true },
                    scrollBeyondLastLine: false,
                    fontSize: 13
                  }}
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '12px 20px',
              borderTop: '1px solid #e0e0e0',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '8px',
              flexShrink: 0
            }}>
              <button 
                className="btn-secondary"
                onClick={() => setViewingCode(null)}
                style={{ padding: '8px 16px' }}
              >
                Fermer
              </button>
              <button 
                className="btn-primary"
                onClick={() => {
                  handleLoadVersion(viewingCode.botId, viewingCode.versionNumber)
                  setViewingCode(null)
                }}
                style={{ padding: '8px 16px' }}
              >
                📝 Charger dans le Playground
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
