import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { setupCsrfInterceptor } from './utils/csrf.js'
import { useAuth } from './contexts/AuthContext'
import PlaygroundPage from './components/PlaygroundPage'
import ArenaPage from './components/ArenaPage'
import LoginForm from './components/LoginForm'

function App() {
  const { user, loading } = useAuth()

  useEffect(() => {
    setupCsrfInterceptor()
  }, [])

  if (loading) {
    return <div className="loading">Chargement...</div>
  }

  return (
    <Routes>
      <Route path="/login" element={!user ? <LoginForm /> : <Navigate to="/" />} />
      <Route path="/" element={user ? <PlaygroundPage /> : <Navigate to="/login" />} />
      <Route path="/arena" element={user ? <ArenaPage /> : <Navigate to="/login" />} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  )
}

export default App
