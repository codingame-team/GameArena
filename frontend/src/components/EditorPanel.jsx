import React from 'react'
import MonacoEditor from './MonacoEditor'

const SAVE_STATUS_CONFIG = {
  saved: { color: '#0a0', icon: '✓', text: 'Saved' },
  saving: { color: '#fa0', icon: '⏳', text: 'Saving...' },
  error: { color: '#c00', icon: '✗', text: 'Save error' }
}

function SaveStatusFooter({ saveStatus, botId }) {
  const statusConfig = SAVE_STATUS_CONFIG[saveStatus]
  
  return (
    <div style={{ 
      fontSize: '10px', 
      color: '#666', 
      display: 'flex', 
      gap: '10px',
      alignItems: 'center' 
    }}>
      {botId && <span>Bot ID: {botId}</span>}
      {statusConfig && (
        <span style={{ color: statusConfig.color }}>
          {statusConfig.icon} {statusConfig.text}
        </span>
      )}
    </div>
  )
}

/**
 * Composant panel éditeur de code.
 * 
 * Responsabilité (SRP): Affichage de l'éditeur uniquement
 * - En-tête avec titre et bouton reset
 * - Éditeur Monaco
 * - Status de sauvegarde (optionnel)
 * 
 * @param {Object} props
 * @param {string} props.code - Code actuel
 * @param {Function} props.onChange - Callback changement code (code) => void
 * @param {string} props.language - Langage ('python', 'javascript', etc.)
 * @param {string} props.theme - Thème ('light' | 'dark')
 * @param {boolean} props.canReset - Si le bouton reset est actif
 * @param {Function} props.onReset - Callback reset code
 * @param {string} props.saveStatus - Status de sauvegarde ('idle'|'saving'|'saved'|'error')
 * @param {string} props.botId - ID du bot (optionnel, pour affichage)
 * @returns {JSX.Element}
 */
export default function EditorPanel({ 
  code, 
  onChange, 
  language, 
  theme,
  canReset,
  onReset,
  saveStatus,
  botId
}) {
  const getResetButtonStyle = () => ({
    fontSize: '12px',
    padding: '4px 10px',
    background: '#ff6b6b',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: canReset ? 'pointer' : 'not-allowed',
    opacity: canReset ? 1 : 0.5
  })

  return (
    <div className="frame" style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      padding: '8px', 
      gap: '8px',
      flex: 1,
      minHeight: 0,
      overflow: 'visible'
    }}>
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center' 
      }}>
        <h3 style={{ 
          margin: 0, 
          fontSize: '14px', 
          fontWeight: 'bold', 
          color: 'var(--text)' 
        }}>
          Code Editor
        </h3>
        <button
          onClick={onReset}
          disabled={!canReset}
          style={getResetButtonStyle()}
          title="Reset code to template"
        >
          🔄 Reset my code
        </button>
      </div>
      
      {/* Editor */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <MonacoEditor 
          value={code || '# Loading...'} 
          onChange={onChange} 
          language={language} 
          theme={theme} 
        />
      </div>
      
      {/* Optional save status footer */}
      {(saveStatus !== 'idle' || botId) && (
        <SaveStatusFooter saveStatus={saveStatus} botId={botId} />
      )}
    </div>
  )
}
