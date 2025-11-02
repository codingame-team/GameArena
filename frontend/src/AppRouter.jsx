import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import LoginForm from './components/LoginForm'
import RegisterForm from './components/RegisterForm'
import ArenaPage from './components/ArenaPage'
import ProtectedRoute from './components/ProtectedRoute'
import PlaygroundPage from './components/PlaygroundPage'

export default function AppRouter() {
  const { isAuthenticated, loading } = useAuth()

  if (loading) {
    return <div className="loading">Chargement...</div>
  }

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={
        isAuthenticated ? <Navigate to="/arena" replace /> : <LoginForm />
      } />
      <Route path="/register" element={
        isAuthenticated ? <Navigate to="/arena" replace /> : <RegisterForm />
      } />
      
      {/* Playground - accessible to all but can integrate with auth */}
      <Route path="/" element={<PlaygroundPage />} />
      
      {/* Protected routes */}
      <Route path="/arena" element={
        <ProtectedRoute>
          <ArenaPage />
        </ProtectedRoute>
      } />
      
      {/* Default redirect */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
