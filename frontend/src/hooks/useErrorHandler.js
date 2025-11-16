import { useState, useCallback } from 'react'

export function useErrorHandler() {
  const [error, setError] = useState(null)

  const handleError = useCallback((err, customMessage = null) => {
    console.error('Error:', err)
    const message = customMessage || err.response?.data?.error || err.message || 'Une erreur est survenue'
    setError({ message, timestamp: Date.now() })
  }, [])

  const clearError = useCallback(() => setError(null), [])

  return { error, handleError, clearError }
}
