import React from 'react'
import MonacoEditor from './MonacoEditor'

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
          style={{ 
            fontSize: '12px', 
            padding: '4px 10px', 
            background: '#ff6b6b', 
            color: 'white', 
            border: 'none', 
            borderRadius: '4px', 
            cursor: canReset ? 'pointer' : 'not-allowed',
            opacity: canReset ? 1 : 0.5
          }}
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
        <div style={{ 
          fontSize: '10px', 
          color: '#666', 
          display: 'flex', 
          gap: '10px',
          alignItems: 'center' 
        }}>
          {botId && <span>Bot ID: {botId}</span>}
          {saveStatus !== 'idle' && (
            <span style={{
              color: saveStatus === 'saved' ? '#0a0' : 
                     saveStatus === 'saving' ? '#fa0' : 
                     saveStatus === 'error' ? '#c00' : '#666'
            }}>
              {saveStatus === 'saved' ? '✓ Saved' :
               saveStatus === 'saving' ? '⏳ Saving...' :
               saveStatus === 'error' ? '✗ Save error' : ''}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
