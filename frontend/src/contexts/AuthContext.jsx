import React, { createContext, useState, useContext, useEffect } from 'react'
import axios from 'axios'
import API_BASE_URL from '../config'

const AuthContext = createContext(null)

// Add request interceptor for debugging
axios.interceptors.request.use(
  (config) => {
    console.log('🔵 Request:', config.method?.toUpperCase(), config.url)
    console.log('🔑 Auth Header:', config.headers.Authorization)
    return config
  },
  (error) => {
    console.error('❌ Request Error:', error)
    return Promise.reject(error)
  }
)

// Add response interceptor for debugging
axios.interceptors.response.use(
  (response) => {
    console.log('✅ Response:', response.status, response.config.url)
    return response
  },
  (error) => {
    console.error('❌ Response Error:', error.response?.status, error.config?.url)
    console.error('Error details:', error.response?.data)
    return Promise.reject(error)
  }
)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [token, setToken] = useState(() => localStorage.getItem('token'))

  // Configure axios to include auth token
  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`
      localStorage.setItem('token', token)
      // Fetch user data after token is set
      fetchCurrentUser()
    } else {
      delete axios.defaults.headers.common['Authorization']
      localStorage.removeItem('token')
      setLoading(false)
    }
  }, [token])

  const fetchCurrentUser = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/auth/me`)
      setUser(response.data.user)
    } catch (error) {
      console.error('Failed to fetch current user:', error)
      setToken(null)
      setUser(null)
    } finally {
      setLoading(false)
    }
  }

  const register = async (username, email, password) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/api/auth/register`, {
        username,
        email,
        password
      })
      return { success: true, data: response.data }
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Registration failed'
      }
    }
  }

  const login = async (username, password) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/api/auth/login`, {
        username,
        password
      })
      const { access_token, user: userData } = response.data
      setToken(access_token)
      setUser(userData)
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Login failed'
      }
    }
  }

  const logout = () => {
    setToken(null)
    setUser(null)
  }

  const value = {
    user,
    loading,
    isAuthenticated: !!user,
    register,
    login,
    logout
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
