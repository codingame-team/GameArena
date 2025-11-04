import { useState, useEffect, useCallback } from 'react'
import axios from 'axios'
import { API_BASE_URL } from '../config'

/**
 * Hook pour gérer les status backend et Docker.
 * 
 * Responsabilité (SRP): Vérification de l'état des services uniquement
 * - Status backend (API Flask)
 * - Status Docker (runner pour bots)
 * - Vérification périodique
 * 
 * @param {boolean} autoCheck - Si true, vérifie automatiquement au mount
 * @returns {Object} { backendStatus, dockerStatus, checkBackend, checkDocker, checkAll }
 */
export function useStatus(autoCheck = true) {
  const [backendStatus, setBackendStatus] = useState({ 
    status: 'unknown', 
    info: '' 
  })
  
  const [dockerStatus, setDockerStatus] = useState({ 
    status: 'unknown', 
    info: '' 
  })

  /**
   * Vérifie le status du backend Flask
   */
  const checkBackend = useCallback(async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/referees`, {
        timeout: 5000
      })
      
      if (response.status === 200) {
        setBackendStatus({ 
          status: 'ok', 
          info: 'Backend connecté' 
        })
        return true
      } else {
        setBackendStatus({ 
          status: 'error', 
          info: `Backend error: ${response.status}` 
        })
        return false
      }
    } catch (error) {
      console.error('Backend check failed:', error)
      setBackendStatus({ 
        status: 'error', 
        info: error.message || 'Backend inaccessible' 
      })
      return false
    }
  }, [])

  /**
   * Vérifie le status de Docker (via endpoint check)
   */
  const checkDocker = useCallback(async () => {
    try {
      // Utilise l'endpoint qui retourne des infos sur le runner
      const response = await axios.get(`${API_BASE_URL}/api/runner/check`, {
        timeout: 5000
      })
      
      if (response.status === 200 && response.data) {
        const available = response.data.available
        
        if (available) {
          setDockerStatus({ 
            status: 'ok', 
            info: response.data.version || 'Docker disponible' 
          })
        } else {
          setDockerStatus({ 
            status: 'warning', 
            info: response.data.error || 'Fallback subprocess' 
          })
        }
        return true
      } else {
        setDockerStatus({ 
          status: 'error', 
          info: 'Impossible de vérifier Docker' 
        })
        return false
      }
    } catch (error) {
      console.error('Docker check failed:', error)
      // Docker non disponible n'est pas critique (fallback subprocess)
      setDockerStatus({ 
        status: 'warning', 
        info: 'Docker non disponible (subprocess utilisé)' 
      })
      return false
    }
  }, [])

  /**
   * Vérifie tous les status
   */
  const checkAll = useCallback(async () => {
    await Promise.all([
      checkBackend(),
      checkDocker()
    ])
  }, [checkBackend, checkDocker])

  // Vérification automatique au mount si activée
  useEffect(() => {
    if (autoCheck) {
      checkAll()
    }
  }, [autoCheck, checkAll])

  return {
    backendStatus,
    dockerStatus,
    checkBackend,
    checkDocker,
    checkAll
  }
}
