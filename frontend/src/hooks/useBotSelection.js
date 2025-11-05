import { useState, useEffect, useCallback } from 'react'
import axios from 'axios'
import { API_BASE_URL } from '../config'

/**
 * Hook pour gérer la sélection des joueurs (bots).
 * 
 * Responsabilité (SRP): Sélection et affichage des joueurs uniquement
 * - Liste des bots disponibles
 * - Sélection Player1/Player2
 * - Noms et avatars des joueurs
 * - Chargement avatars custom
 * 
 * @returns {Object} État et actions pour la sélection des joueurs
 */
export function useBotSelection() {
  const [selectedLanguage, setSelectedLanguage] = useState('python')
  const [availableBots, setAvailableBots] = useState([])
  const [selectedPlayer1, setSelectedPlayer1] = useState(null)
  const [selectedPlayer2, setSelectedPlayer2] = useState('Boss')
  const [capturedPlayer1Name, setCapturedPlayer1Name] = useState('Joueur 1')
  const [capturedPlayer2Name, setCapturedPlayer2Name] = useState('Joueur 2')
  const [userAvatar, setUserAvatar] = useState('my_bot')
  const [customAvatarBlobUrl, setCustomAvatarBlobUrl] = useState(null)
  const [currentUser, setCurrentUser] = useState(null)
  const [botOwnerAvatars, setBotOwnerAvatars] = useState({})

  /**
   * Charge les avatars custom des propriétaires de bots
   */
  const loadBotOwnerAvatars = useCallback(async (bots) => {
    const token = localStorage.getItem('token')
    if (!token) return

    const avatarMap = {}
    console.log('🖼️ Loading avatars for', bots.length, 'bots...')
    
    for (const bot of bots) {
      console.log(`Bot ${bot.id} (${bot.owner_username}): avatar=${bot.owner_avatar}, user_id=${bot.user_id}`)
      // Charger seulement si ce n'est pas un avatar par défaut
      if (bot.owner_avatar && bot.owner_avatar !== 'default' && bot.owner_avatar !== 'my_bot') {
        try {
          const res = await axios.get(
            `${API_BASE_URL}/api/user/${bot.user_id}/avatar/image`,
            {
              headers: { Authorization: `Bearer ${token}` },
              responseType: 'blob'
            }
          )
          const blobUrl = URL.createObjectURL(res.data)
          avatarMap[bot.id] = blobUrl
          console.log(`✅ Loaded custom avatar for bot ${bot.id}`)
        } catch (e) {
          console.warn(`❌ Failed to load avatar for bot ${bot.id}:`, e.response?.status)
        }
      }
    }
    
    console.log('🎨 Custom avatars loaded:', Object.keys(avatarMap).length)
    setBotOwnerAvatars(avatarMap)
  }, [])

  /**
   * Charge la liste des bots actifs depuis l'API
   * Filtre par ligue : uniquement les bots de la même ligue + le Boss de la ligue
   */
  const loadAvailableBots = useCallback(async () => {
    try {
      const token = localStorage.getItem('token')
      if (!token) return

      // Charger les bots filtrés par ligue courante
      const res = await axios.get(`${API_BASE_URL}/api/bots/by-league`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      
      console.log('📋 Loaded bots by league:', res.data)
      
      // L'API retourne { bots: [...], boss: {...}, user_league: "Bronze", user_elo: 1274 }
      const botsList = res.data.bots || []
      const boss = res.data.boss
      
      // Ajouter le Boss à la liste si présent
      if (boss) {
        console.log('👑 Boss data:', boss)
        botsList.push(boss)
      } else {
        console.warn('⚠️ No Boss found in API response')
      }
      
      console.log(`📋 Loaded ${botsList.length} bots from ${res.data.user_league} league`)
      console.log('📋 First 3 bots:', botsList.slice(0, 3).map(b => ({id: b.id, name: b.name, is_boss: b.is_boss})))
      setAvailableBots(botsList)
      
      // Charger les avatars custom des propriétaires
      await loadBotOwnerAvatars(botsList)
      
      // Auto-sélectionner le premier bot de l'utilisateur comme Player 1
      const userBotsRes = await axios.get(`${API_BASE_URL}/api/bots/my`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      
      if (userBotsRes.data && userBotsRes.data.length > 0) {
        const userBot = userBotsRes.data[0]
        setSelectedPlayer1(`bot:${userBot.id}`)
        console.log('✅ Auto-selected user bot as Player 1:', userBot.id)
      }
      
      // Auto-sélectionner le Boss comme Player 2 si disponible
      if (boss) {
        setSelectedPlayer2(`bot:${boss.id}`)
        console.log('✅ Auto-selected Boss as Player 2:', boss.name)
      }
    } catch (e) {
      console.error('Failed to load available bots:', e)
    }
  }, [loadBotOwnerAvatars])

  /**
   * Charge l'avatar de l'utilisateur courant
   */
  const loadCurrentUserAvatar = useCallback(async () => {
    try {
      const token = localStorage.getItem('token')
      if (!token) return

      // Charger infos utilisateur
      const userRes = await axios.get(`${API_BASE_URL}/api/user/profile`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      
      if (userRes.data) {
        console.log('👤 Current user:', userRes.data.username, 'avatar:', userRes.data.avatar)
        setCurrentUser(userRes.data)
        setUserAvatar(userRes.data.avatar || 'my_bot')
        
        // Charger avatar custom si existe (custom_ prefix ou si avatar est défini)
        if (userRes.data.avatar && userRes.data.avatar !== 'default' && userRes.data.avatar !== 'my_bot') {
          try {
            console.log('📥 Loading custom avatar from API...')
            const avatarRes = await axios.get(
              `${API_BASE_URL}/api/user/avatar/image`,
              {
                headers: { Authorization: `Bearer ${token}` },
                responseType: 'blob'
              }
            )
            const blobUrl = URL.createObjectURL(avatarRes.data)
            console.log('✅ Custom avatar loaded:', blobUrl)
            setCustomAvatarBlobUrl(blobUrl)
          } catch (e) {
            console.warn('❌ Failed to load custom avatar:', e.response?.status, e.response?.data)
          }
        }
      }
    } catch (e) {
      console.error('Failed to load user info:', e)
    }
  }, [])

  /**
   * Récupère le nom d'affichage d'un joueur
   */
  const getPlayerName = useCallback((playerSelection) => {
    if (!playerSelection) return 'Aucun joueur'
    if (playerSelection === 'Boss') return 'Boss'
    if (typeof playerSelection === 'string' && playerSelection.startsWith('bot:')) {
      const selectedBotId = parseInt(playerSelection.substring(4))
      const bot = availableBots.find(b => b.id === selectedBotId)
      
      // Pour les Boss, utiliser le nom du bot directement (ex: "Bronze Boss")
      if (bot?.is_boss) {
        return bot.name
      }
      
      // Pour les bots normaux, utiliser le nom du propriétaire
      return bot?.owner_username || bot?.name || `Bot #${selectedBotId}`
    }
    return playerSelection || 'Aucun joueur'
  }, [availableBots])

  /**
   * Récupère l'URL de l'avatar d'un joueur
   */
  const getAvatarUrl = useCallback((playerSelection) => {
    console.log('🔍 getAvatarUrl called for:', playerSelection)
    console.log('   - currentUser:', currentUser?.id)
    console.log('   - customAvatarBlobUrl:', customAvatarBlobUrl ? 'SET' : 'NULL')
    console.log('   - botOwnerAvatars keys:', Object.keys(botOwnerAvatars))
    
    if (!playerSelection) return '/avatars/no_avatar.svg'
    
    if (playerSelection === 'Boss') return '/avatars/boss.svg'
    
    if (typeof playerSelection === 'string' && playerSelection.startsWith('bot:')) {
      const selectedBotId = parseInt(playerSelection.substring(4))
      
      const bot = availableBots.find(b => b.id === selectedBotId)
      console.log('   - bot found:', bot?.id, 'user_id:', bot?.user_id, 'is_boss:', bot?.is_boss)
      
      // Si c'est un Boss, utiliser son avatar spécifique
      if (bot && bot.is_boss) {
        const bossAvatar = bot.avatar || 'boss'
        console.log('✅ Using Boss avatar:', bossAvatar)
        return `/avatars/${bossAvatar}.svg`
      }
      
      // Si c'est le bot de l'utilisateur courant et qu'on a un avatar custom
      if (bot && currentUser && bot.user_id === currentUser.id && customAvatarBlobUrl) {
        console.log('✅ Using current user custom avatar for bot', selectedBotId, ':', customAvatarBlobUrl.substring(0, 50))
        return customAvatarBlobUrl
      }
      
      // Check if we have a custom avatar blob URL for this bot's owner
      if (botOwnerAvatars[selectedBotId]) {
        console.log('✅ Using blob avatar for bot', selectedBotId)
        return botOwnerAvatars[selectedBotId]
      }
      
      console.log('📁 Bot', selectedBotId, 'owner_avatar:', bot?.owner_avatar)
      if (bot && bot.owner_avatar && bot.owner_avatar !== 'default') {
        return `/avatars/${bot.owner_avatar}.svg`
      }
      return '/avatars/my_bot.svg'
    }
    
    return '/avatars/my_bot.svg'
  }, [availableBots, botOwnerAvatars, currentUser, customAvatarBlobUrl])

  /**
   * Capture les noms des joueurs au moment du démarrage du jeu
   */
  const capturePlayerNames = useCallback(() => {
    setCapturedPlayer1Name(getPlayerName(selectedPlayer1))
    setCapturedPlayer2Name(getPlayerName(selectedPlayer2))
  }, [selectedPlayer1, selectedPlayer2, getPlayerName])

  // Charger les bots et l'avatar utilisateur au mount
  useEffect(() => {
    loadAvailableBots()
    loadCurrentUserAvatar()
  }, [loadAvailableBots, loadCurrentUserAvatar])

  // Debug: log quand customAvatarBlobUrl change
  useEffect(() => {
    console.log('🔄 customAvatarBlobUrl changed:', customAvatarBlobUrl ? 'SET' : 'NULL')
  }, [customAvatarBlobUrl])

  return {
    // État sélection
    selectedLanguage,
    availableBots,
    selectedPlayer1,
    selectedPlayer2,
    capturedPlayer1Name,
    capturedPlayer2Name,
    
    // État avatars
    userAvatar,
    customAvatarBlobUrl,
    currentUser,
    botOwnerAvatars,
    
    // Setters
    setSelectedLanguage,
    setSelectedPlayer1,
    setSelectedPlayer2,
    setCapturedPlayer1Name,
    setCapturedPlayer2Name,
    
    // Actions
    loadAvailableBots,
    loadCurrentUserAvatar,
    getPlayerName,
    getAvatarUrl,
    capturePlayerNames
  }
}
