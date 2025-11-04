import { useState, useRef, useCallback, useEffect } from 'react'
import axios from 'axios'
import { API_BASE_URL } from '../config'

/**
 * Hook pour gérer la logique métier des bots utilisateur.
 * 
 * Responsabilité (SRP): Gestion complète des bots uniquement
 * - CRUD bot (create, read, update)
 * - Auto-save avec debounce
 * - Chargement template
 * - Reset code
 * - Soumission à l'arène
 * 
 * @returns {Object} État et actions pour la gestion des bots
 */
export function useBotManagement() {
  const [code, setCode] = useState('')
  const [botId, setBotId] = useState(null)
  const [saveStatus, setSaveStatus] = useState('idle') // idle|saving|saved|error
  const [botVersionInfo, setBotVersionInfo] = useState({ latest_version_number: 0 })
  const saveTimer = useRef(null)

  /**
   * Sauvegarde immédiate d'un bot
   */
  const saveBotNow = useCallback(async (id, txt) => {
    if (!id) return
    setSaveStatus('saving')
    try {
      const token = localStorage.getItem('token')
      if (!token) {
        setSaveStatus('error')
        console.error('No token found - user must be logged in')
        return
      }
      
      await axios.put(`${API_BASE_URL}/api/bots/${id}/save`, 
        { code: txt },
        { headers: { Authorization: `Bearer ${token}` }}
      )
      
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 1000)
    } catch (e) { 
      console.error('Save error:', e)
      setSaveStatus('error') 
    }
  }, [])

  /**
   * Planifie une sauvegarde avec debounce (1.5s)
   */
  const scheduleSave = useCallback((newCode) => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    // Only save if we have a bot ID (user must be logged in and have created a bot)
    saveTimer.current = setTimeout(() => { 
      if (botId) { 
        saveBotNow(botId, newCode) 
      } else {
        console.log('No bot ID - user must create a bot first')
      }
    }, 1500)
  }, [botId, saveBotNow])

  /**
   * Charge le template de code par défaut
   */
  const loadTemplate = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/template`)
      if (res.data && res.data.template) {
        setCode(res.data.template)
        return res.data.template
      }
    } catch (e) {
      console.error('Failed to load template:', e)
    }
    return ''
  }, [])

  /**
   * Reset le code au template
   */
  const resetCode = useCallback(async () => {
    if (!window.confirm('⚠️ Reset code to template? This will erase your current code.')) {
      return
    }
    try {
      const res = await axios.get(`${API_BASE_URL}/api/template`)
      if (res.data && res.data.template) {
        const templateCode = res.data.template
        setCode(templateCode)
        // Save immediately
        if (botId) {
          await saveBotNow(botId, templateCode)
        }
      }
    } catch (e) {
      console.error('Failed to load template:', e)
      alert('Failed to load template')
    }
  }, [botId, saveBotNow])

  /**
   * Initialise le bot playground au mount (auto-create si nécessaire)
   */
  const initializePlaygroundBot = useCallback(async () => {
    console.log('🔧 initializePlaygroundBot called')
    try {
      const token = localStorage.getItem('token')
      if (!token) {
        console.log('❌ No token - authentication required')
        return
      }

      // Always fetch user's bots from database (no localStorage dependency)
      console.log('🔍 Searching for existing user bots in database...')
      const userBotsRes = await axios.get(`${API_BASE_URL}/api/bots/my`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      
      if (userBotsRes.data && userBotsRes.data.length > 0) {
        // Use first bot found
        const userBot = userBotsRes.data[0]
        console.log('✅ Found existing user bot:', userBot.id, userBot.name)
        console.log('📝 Bot code length:', (userBot.code || '').length, 'chars')
        setBotId(userBot.id)
        setCode(userBot.code || '')
        
        // Extract version info from bot data (latest_version_number is already in the bot object)
        if (userBot.latest_version_number !== undefined) {
          setBotVersionInfo({ latest_version_number: userBot.latest_version_number })
        }
        return
      }

      // No bot exists, create one with template code
      console.log('➕ No bot found, creating new playground bot...')
      
      // Load template first
      const templateCode = await loadTemplate()
      
      const res = await axios.post(`${API_BASE_URL}/api/bots`, {
        name: 'My Playground Bot',
        code: templateCode
      }, {
        headers: { Authorization: `Bearer ${token}` }
      })
      
      const newBot = res.data.bot || res.data
      console.log('✅ New bot created with ID:', newBot.id)
      setBotId(newBot.id)
      setCode(newBot.code || templateCode)
    } catch (e) {
      console.error('❌ Failed to initialize bot:', e)
      // Fallback: load template anyway
      await loadTemplate()
    }
  }, [loadTemplate])

  /**
   * Soumet le bot à l'arène
   */
  const submitToArena = useCallback(async (versionName, description) => {
    if (!botId) {
      throw new Error('No bot ID - cannot submit to arena')
    }
    
    try {
      const token = localStorage.getItem('token')
      if (!token) {
        throw new Error('No authentication token')
      }

      const res = await axios.post(
        `${API_BASE_URL}/api/bots/${botId}/submit-to-arena`,
        { version_name: versionName, description },
        { headers: { Authorization: `Bearer ${token}` }}
      )
      
      // Update version info from response
      if (res.data && res.data.bot) {
        setBotVersionInfo({ 
          latest_version_number: res.data.bot.latest_version_number || res.data.version_number || 0
        })
      }
      
      return res.data
    } catch (e) {
      console.error('Failed to submit to arena:', e)
      throw e
    }
  }, [botId])

  /**
   * Handler pour changement de code (avec auto-save)
   */
  const handleCodeChange = useCallback((newCode) => {
    setCode(newCode)
    scheduleSave(newCode)
  }, [scheduleSave])

  return {
    // État
    code,
    botId,
    saveStatus,
    botVersionInfo,
    
    // Setters
    setCode,
    setBotId,
    setBotVersionInfo,
    
    // Actions
    saveBotNow,
    scheduleSave,
    loadTemplate,
    resetCode,
    initializePlaygroundBot,
    submitToArena,
    handleCodeChange
  }
}
