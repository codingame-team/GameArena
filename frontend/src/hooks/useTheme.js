import { useState, useEffect, useCallback } from 'react'

/**
 * Hook pour gérer le thème de l'application (light/dark).
 * 
 * Responsabilité (SRP): Gestion du thème uniquement
 * - Sauvegarde dans localStorage
 * - Application des classes CSS
 * - Toggle entre light et dark
 * 
 * @returns {Object} { theme, toggleTheme, setTheme }
 */
export function useTheme() {
  // Initialize from localStorage synchronously to avoid flicker
  const [theme, setTheme] = useState(() => {
    try {
      const stored = localStorage.getItem('gamearena_theme')
      return stored || 'dark'
    } catch (e) {
      console.error('Failed to load theme from localStorage:', e)
      return 'dark'
    }
  })

  // Apply theme to document and save to localStorage
  useEffect(() => {
    if (typeof document !== 'undefined') {
      if (theme === 'dark') {
        document.documentElement.classList.add('theme-dark')
      } else {
        document.documentElement.classList.remove('theme-dark')
      }
    }
    
    try {
      localStorage.setItem('gamearena_theme', theme)
    } catch (e) {
      console.error('Failed to save theme to localStorage:', e)
    }
  }, [theme])

  // Toggle between light and dark
  const toggleTheme = useCallback(() => {
    setTheme(prevTheme => prevTheme === 'dark' ? 'light' : 'dark')
  }, [])

  return {
    theme,
    setTheme,
    toggleTheme
  }
}
