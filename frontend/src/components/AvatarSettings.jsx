import React, { useState, useEffect } from 'react'
import axios from 'axios'
import { useAuth } from '../contexts/AuthContext'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:5000'

// Liste des avatars disponibles
const AVAILABLE_AVATARS = [
  { id: 'my_bot', name: 'Robot', file: 'my_bot.svg' },
  { id: 'boss', name: 'Boss', file: 'boss.svg' },
  { id: 'ninja', name: 'Ninja', file: 'ninja.svg' },
  { id: 'warrior', name: 'Guerrier', file: 'warrior.svg' },
  { id: 'wizard', name: 'Magicien', file: 'wizard.svg' },
  { id: 'knight', name: 'Chevalier', file: 'knight.svg' },
  { id: 'archer', name: 'Archer', file: 'archer.svg' },
  { id: 'alien', name: 'Alien', file: 'alien.svg' },
]

export default function AvatarSettings() {
  const { user } = useAuth()
  const [selectedAvatar, setSelectedAvatar] = useState('my_bot')
  const [customAvatarUrl, setCustomAvatarUrl] = useState(null)
  const [uploadedFile, setUploadedFile] = useState(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [message, setMessage] = useState(null)

  // Charger l'avatar actuel de l'utilisateur
  useEffect(() => {
    async function loadCurrentAvatar() {
      try {
        const res = await axios.get(`${API_BASE_URL}/api/user/avatar`)
        if (res.data && res.data.avatar) {
          setSelectedAvatar(res.data.avatar)
          // Si c'est un avatar custom, charger l'image via blob
          if (res.data.avatar.startsWith('custom_')) {
            try {
              const imageRes = await axios.get(`${API_BASE_URL}/api/user/avatar/image`, {
                responseType: 'blob'
              })
              const blobUrl = URL.createObjectURL(imageRes.data)
              setCustomAvatarUrl(blobUrl)
            } catch (imgError) {
              console.error('Erreur lors du chargement de l\'image custom:', imgError)
            }
          }
        }
      } catch (error) {
        console.error('Erreur lors du chargement de l\'avatar:', error)
        // Si l'endpoint n'existe pas encore, utiliser l'avatar par défaut
        if (error.response?.status !== 404) {
          setMessage({ type: 'error', text: 'Impossible de charger votre avatar actuel' })
        }
      }
    }
    loadCurrentAvatar()
    
    // Cleanup blob URL on unmount
    return () => {
      if (customAvatarUrl && customAvatarUrl.startsWith('blob:')) {
        URL.revokeObjectURL(customAvatarUrl)
      }
    }
  }, [])

  const handleFileSelect = (event) => {
    const file = event.target.files[0]
    if (!file) return

    // Vérifier le type de fichier
    if (!file.type.startsWith('image/')) {
      setMessage({ type: 'error', text: '❌ Veuillez sélectionner une image (PNG, JPG, GIF, etc.)' })
      return
    }

    // Vérifier la taille (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      setMessage({ type: 'error', text: '❌ L\'image est trop grande (max 2MB)' })
      return
    }

    setUploadedFile(file)
    
    // Créer une prévisualisation
    const reader = new FileReader()
    reader.onload = (e) => {
      setCustomAvatarUrl(e.target.result)
      setSelectedAvatar('custom_upload')
    }
    reader.readAsDataURL(file)
  }

  const handleUploadAvatar = async () => {
    if (!uploadedFile) return

    setIsUploading(true)
    setMessage(null)

    try {
      const formData = new FormData()
      formData.append('avatar', uploadedFile)

      await axios.post(`${API_BASE_URL}/api/user/avatar/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      })

      setMessage({ type: 'success', text: '✅ Avatar personnalisé uploadé avec succès !' })
      setUploadedFile(null)
      
      // Recharger l'avatar avec l'image blob
      const res = await axios.get(`${API_BASE_URL}/api/user/avatar`)
      if (res.data && res.data.avatar) {
        setSelectedAvatar(res.data.avatar)
        
        // Si c'est un avatar custom, charger l'image via blob
        if (res.data.avatar.startsWith('custom_')) {
          const imageRes = await axios.get(`${API_BASE_URL}/api/user/avatar/image`, {
            responseType: 'blob'
          })
          // Révoquer l'ancien blob URL s'il existe
          if (customAvatarUrl && customAvatarUrl.startsWith('blob:')) {
            URL.revokeObjectURL(customAvatarUrl)
          }
          const blobUrl = URL.createObjectURL(imageRes.data)
          setCustomAvatarUrl(blobUrl)
        }
      }
    } catch (error) {
      console.error('Erreur lors de l\'upload de l\'avatar:', error)
      setMessage({ type: 'error', text: '❌ Erreur lors de l\'upload de l\'avatar' })
    } finally {
      setIsUploading(false)
      setTimeout(() => setMessage(null), 3000)
    }
  }

  const handleSaveAvatar = async () => {
    // Si un fichier est en attente d'upload, l'uploader d'abord
    if (uploadedFile) {
      await handleUploadAvatar()
      return
    }

    setIsSaving(true)
    setMessage(null)
    
    try {
      await axios.post(`${API_BASE_URL}/api/user/avatar`, {
        avatar: selectedAvatar
      })
      setMessage({ type: 'success', text: '✅ Avatar sauvegardé avec succès !' })
    } catch (error) {
      console.error('Erreur lors de la sauvegarde de l\'avatar:', error)
      setMessage({ type: 'error', text: '❌ Erreur lors de la sauvegarde de l\'avatar' })
    } finally {
      setIsSaving(false)
      // Effacer le message après 3 secondes
      setTimeout(() => setMessage(null), 3000)
    }
  }

  const getAvatarUrl = () => {
    if (selectedAvatar === 'custom_upload' && customAvatarUrl) {
      return customAvatarUrl
    }
    if (selectedAvatar.startsWith('custom_')) {
      return `${API_BASE_URL}/api/user/avatar/image`
    }
    const avatarInfo = AVAILABLE_AVATARS.find(a => a.id === selectedAvatar)
    return `/avatars/${avatarInfo?.file || 'my_bot.svg'}`
  }

  return (
    <div className="avatar-settings">
      <div className="settings-container">
        <h2 style={{ marginBottom: '24px', fontSize: '24px', fontWeight: 'bold' }}>
          ⚙️ Paramètres de profil
        </h2>

        <div className="settings-section">
          <h3 style={{ marginBottom: '16px', fontSize: '18px', fontWeight: '600' }}>
            Choisir votre avatar
          </h3>
          <p style={{ marginBottom: '20px', color: '#666', fontSize: '14px' }}>
            Votre avatar sera affiché dans le classement et lors des parties.
          </p>

          {/* Prévisualisation de l'avatar sélectionné */}
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '16px', 
            marginBottom: '24px',
            padding: '16px',
            background: '#f5f5f5',
            borderRadius: '8px'
          }}>
            <div style={{
              width: '80px',
              height: '80px',
              border: '3px solid #4a90e2',
              borderRadius: '12px',
              overflow: 'hidden',
              background: 'white'
            }}>
              <img 
                src={getAvatarUrl()}
                alt="Avatar sélectionné"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                onError={(e) => { e.target.src = '/avatars/no_avatar.svg' }}
              />
            </div>
            <div>
              <div style={{ fontSize: '16px', fontWeight: '600', marginBottom: '4px' }}>
                Avatar actuel
              </div>
              <div style={{ fontSize: '14px', color: '#666' }}>
                {selectedAvatar.startsWith('custom_') 
                  ? 'Avatar personnalisé' 
                  : AVAILABLE_AVATARS.find(a => a.id === selectedAvatar)?.name || 'Robot'}
              </div>
            </div>
          </div>

          {/* Section upload d'avatar personnalisé */}
          <div style={{ 
            marginBottom: '24px',
            padding: '20px',
            background: '#f9f9f9',
            borderRadius: '8px',
            border: '2px dashed #ccc'
          }}>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: '600' }}>
              📤 Avatar personnalisé
            </h4>
            <p style={{ marginBottom: '12px', fontSize: '13px', color: '#666' }}>
              Uploadez votre propre image (PNG, JPG, GIF - max 2MB)
            </p>
            
            <input
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
              id="avatar-upload"
            />
            
            <label
              htmlFor="avatar-upload"
              style={{
                display: 'inline-block',
                padding: '10px 16px',
                background: '#4a90e2',
                color: 'white',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '600',
                transition: 'background 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#357abd'}
              onMouseLeave={(e) => e.currentTarget.style.background = '#4a90e2'}
            >
              📁 Choisir une image
            </label>
            
            {uploadedFile && (
              <div style={{ marginTop: '12px', fontSize: '13px', color: '#666' }}>
                ✓ Fichier sélectionné : {uploadedFile.name} ({Math.round(uploadedFile.size / 1024)} KB)
              </div>
            )}
          </div>

          {/* Grille d'avatars disponibles */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', 
            gap: '16px',
            marginBottom: '24px'
          }}>
            {AVAILABLE_AVATARS.map(avatar => (
              <div
                key={avatar.id}
                onClick={() => setSelectedAvatar(avatar.id)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '12px',
                  border: selectedAvatar === avatar.id ? '3px solid #4a90e2' : '2px solid #ddd',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  background: selectedAvatar === avatar.id ? '#e3f2fd' : 'white'
                }}
                onMouseEnter={(e) => {
                  if (selectedAvatar !== avatar.id) {
                    e.currentTarget.style.transform = 'scale(1.05)'
                    e.currentTarget.style.borderColor = '#4a90e2'
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedAvatar !== avatar.id) {
                    e.currentTarget.style.transform = 'scale(1)'
                    e.currentTarget.style.borderColor = '#ddd'
                  }
                }}
              >
                <div style={{
                  width: '80px',
                  height: '80px',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  background: '#f9f9f9'
                }}>
                  <img 
                    src={`/avatars/${avatar.file}`}
                    alt={avatar.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={(e) => { e.target.src = '/avatars/no_avatar.svg' }}
                  />
                </div>
                <div style={{ 
                  fontSize: '13px', 
                  fontWeight: selectedAvatar === avatar.id ? '600' : '500',
                  textAlign: 'center',
                  color: selectedAvatar === avatar.id ? '#4a90e2' : '#333'
                }}>
                  {avatar.name}
                </div>
              </div>
            ))}
          </div>

          {/* Message de statut */}
          {message && (
            <div style={{
              padding: '12px 16px',
              borderRadius: '6px',
              marginBottom: '16px',
              background: message.type === 'success' ? '#e8f5e9' : '#ffebee',
              color: message.type === 'success' ? '#2e7d32' : '#c62828',
              fontSize: '14px',
              fontWeight: '500'
            }}>
              {message.text}
            </div>
          )}

          {/* Bouton de sauvegarde */}
          <button
            onClick={handleSaveAvatar}
            disabled={isSaving}
            style={{
              padding: '12px 24px',
              fontSize: '16px',
              fontWeight: '600',
              background: isSaving ? '#ccc' : '#4a90e2',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: isSaving ? 'not-allowed' : 'pointer',
              transition: 'background 0.2s'
            }}
            onMouseEnter={(e) => {
              if (!isSaving) e.currentTarget.style.background = '#357abd'
            }}
            onMouseLeave={(e) => {
              if (!isSaving) e.currentTarget.style.background = '#4a90e2'
            }}
          >
            {isSaving ? '💾 Sauvegarde...' : '💾 Sauvegarder l\'avatar'}
          </button>
        </div>
      </div>
    </div>
  )
}
