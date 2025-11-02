import React, { useState } from 'react'
import '../styles.css'

/**
 * Modal pour soumettre un bot à l'arène
 * Propose:
 * - version_name: optionnel, auto-généré "username_vN" si vide
 * - description: optionnel, commentaire sur cette version
 */
function SubmitArenaModal({ isOpen, onClose, onSubmit, botId }) {
  const [versionName, setVersionName] = useState('')
  const [description, setDescription] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    setError('')
    setIsSubmitting(true)

    try {
      await onSubmit({
        version_name: versionName.trim() || undefined,
        description: description.trim() || undefined
      })
      // Réinitialiser le formulaire
      setVersionName('')
      setDescription('')
      onClose()
    } catch (err) {
      setError(err.message || 'Erreur lors de la soumission')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2 style={{ marginTop: 0, marginBottom: '16px', fontSize: '20px' }}>
          Soumettre à l'Arène
        </h2>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold', fontSize: '14px' }}>
            Nom de version (optionnel)
          </label>
          <input
            type="text"
            value={versionName}
            onChange={(e) => setVersionName(e.target.value)}
            placeholder="Ex: aggressive_v1 (auto: username_vN)"
            style={{ width: '100%', padding: '8px', fontSize: '14px', boxSizing: 'border-box' }}
            disabled={isSubmitting}
          />
          <small style={{ display: 'block', marginTop: '4px', color: '#666', fontSize: '12px' }}>
            Si vide, sera auto-généré (ex: alice_v2)
          </small>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold', fontSize: '14px' }}>
            Description (optionnel)
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Notes sur cette version..."
            rows={3}
            style={{ width: '100%', padding: '8px', fontSize: '14px', boxSizing: 'border-box', fontFamily: 'inherit' }}
            disabled={isSubmitting}
          />
        </div>

        {error && (
          <div style={{ marginBottom: '16px', padding: '8px', background: '#ffe6e6', color: '#c00', borderRadius: '4px', fontSize: '13px' }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            style={{ padding: '8px 16px', fontSize: '14px', background: '#ddd', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            Annuler
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            style={{ padding: '8px 16px', fontSize: '14px', background: '#4CAF50', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            {isSubmitting ? 'Soumission...' : 'Soumettre'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default SubmitArenaModal
