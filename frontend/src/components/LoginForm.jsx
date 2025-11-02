import React, { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate, useSearchParams } from 'react-router-dom'

export default function LoginForm() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const result = await login(username, password)
    
    if (result.success) {
      // Redirect to the specified page or default to arena
      const redirectTo = searchParams.get('redirect') || '/arena'
      navigate(redirectTo)
    } else {
      setError(result.error)
    }
    
    setLoading(false)
  }

  const redirectFrom = searchParams.get('redirect')
  const isPlaygroundRedirect = redirectFrom === '/playground'

  return (
    <div className="auth-form-container">
      <div className="auth-form">
        <h2>Connexion</h2>
        {isPlaygroundRedirect && (
          <div style={{ 
            padding: '12px', 
            marginBottom: '16px', 
            background: '#fff3cd', 
            border: '1px solid #ffc107', 
            borderRadius: '4px',
            color: '#856404',
            fontSize: '14px'
          }}>
            🔒 Le Playground nécessite une authentification. Veuillez vous connecter pour continuer.
          </div>
        )}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Nom d'utilisateur</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              disabled={loading}
            />
          </div>
          <div className="form-group">
            <label>Mot de passe</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
            />
          </div>
          {error && <div className="error-message">{error}</div>}
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'Connexion...' : 'Se connecter'}
          </button>
        </form>
        <p className="auth-switch">
          Pas encore de compte ? <a href="/register">S'inscrire</a>
        </p>
      </div>
    </div>
  )
}
