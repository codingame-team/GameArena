import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useErrorHandler } from '../hooks/useErrorHandler'
import avatarService, { AVAILABLE_AVATARS } from '../services/avatarService'

export default function AvatarSettings() {
  const { user } = useAuth()
  const { error, handleError, clearError } = useErrorHandler()
  const [selectedAvatar, setSelectedAvatar] = useState('my_bot')
  const [customAvatarUrl, setCustomAvatarUrl] = useState(null)
  const [uploadedFile, setUploadedFile] = useState(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [message, setMessage] = useState(null)

  useEffect(() => {
    async function loadCurrentAvatar() {
      try {
        const data = await avatarService.getCurrentAvatar()
        if (data?.avatar) {
          setSelectedAvatar(data.avatar)
          if (data.avatar.startsWith('custom_')) {
            const blob = await avatarService.getAvatarImage()
            const url = avatarService.createBlobUrl(blob)
            setCustomAvatarUrl(url)
          }
        }
      } catch (err) {
        if (err.response?.status !== 404) {
          handleError(err, 'Impossible de charger votre avatar actuel')
        }
      }
    }
    loadCurrentAvatar()
    
    return () => avatarService.revokeAllBlobUrls()
  }, [])

  const handleFileSelect = (event) => {
    const file = event.target.files[0]
    if (!file) return

    try {
      avatarService.validateFile(file)
      setUploadedFile(file)
      
      const reader = new FileReader()
      reader.onload = (e) => {
        setCustomAvatarUrl(e.target.result)
        setSelectedAvatar('custom_upload')
      }
      reader.readAsDataURL(file)
    } catch (err) {
      setMessage({ type: 'error', text: `❌ ${err.message}` })
    }
  }

  const handleUploadAvatar = async () => {
    if (!uploadedFile) return

    setIsUploading(true)
    setMessage(null)

    try {
      await avatarService.uploadAvatar(uploadedFile)
      setMessage({ type: 'success', text: '✅ Avatar personnalisé uploadé avec succès !' })
      setUploadedFile(null)
      
      const data = await avatarService.getCurrentAvatar()
      if (data?.avatar) {
        setSelectedAvatar(data.avatar)
        if (data.avatar.startsWith('custom_')) {
          avatarService.revokeBlobUrl(customAvatarUrl)
          const blob = await avatarService.getAvatarImage()
          setCustomAvatarUrl(avatarService.createBlobUrl(blob))
        }
      }
    } catch (err) {
      handleError(err, 'Erreur lors de l\'upload de l\'avatar')
      setMessage({ type: 'error', text: '❌ Erreur lors de l\'upload de l\'avatar' })
    } finally {
      setIsUploading(false)
      setTimeout(() => setMessage(null), 3000)
    }
  }

  const handleSaveAvatar = async () => {
    if (uploadedFile) {
      await handleUploadAvatar()
      return
    }

    setIsSaving(true)
    setMessage(null)
    
    try {
      await avatarService.saveAvatar(selectedAvatar)
      setMessage({ type: 'success', text: '✅ Avatar sauvegardé avec succès !' })
    } catch (err) {
      handleError(err, 'Erreur lors de la sauvegarde de l\'avatar')
      setMessage({ type: 'error', text: '❌ Erreur lors de la sauvegarde de l\'avatar' })
    } finally {
      setIsSaving(false)
      setTimeout(() => setMessage(null), 3000)
    }
  }

  const getAvatarUrl = () => avatarService.getAvatarUrl(selectedAvatar, customAvatarUrl)

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
