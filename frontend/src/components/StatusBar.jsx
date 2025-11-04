import React from 'react'

/**
 * Composant pour afficher les status Backend et Docker.
 * 
 * Responsabilité (SRP): Affichage des indicateurs de status uniquement
 * - Présentation visuelle des status
 * - Couleurs selon l'état (ok/error/warning/unknown)
 * 
 * @param {Object} props
 * @param {Object} props.backendStatus - { status: 'ok'|'error'|'warning'|'unknown', info: string }
 * @param {Object} props.dockerStatus - { status: 'ok'|'error'|'warning'|'unknown', info: string }
 * @returns {JSX.Element}
 */
export default function StatusBar({ backendStatus, dockerStatus }) {
  /**
   * Retourne la couleur selon le status
   */
  const getStatusColor = (status) => {
    switch (status) {
      case 'ok': return '#0a0'
      case 'error': return '#c00'
      case 'warning': return '#fa0'
      case 'unknown':
      default: return '#aaa'
    }
  }

  /**
   * Retourne le label selon le status
   */
  const getStatusLabel = (status) => {
    switch (status) {
      case 'ok': return 'OK'
      case 'error': return 'Error'
      case 'warning': return 'Warning'
      case 'unknown':
      default: return '?'
    }
  }

  return (
    <>
      {/* Backend status indicator */}
      <div 
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '5px', 
          fontSize: '10px' 
        }}
        title={backendStatus.info || 'Backend status'}
      >
        <span 
          style={{ 
            width: 7, 
            height: 7, 
            borderRadius: '50%', 
            background: getStatusColor(backendStatus.status),
            boxShadow: '0 0 3px rgba(0,0,0,0.2)'
          }} 
        />
        <span style={{ color: 'var(--text)', fontWeight: '500' }}>
          Backend: {getStatusLabel(backendStatus.status)}
        </span>
      </div>

      {/* Docker status indicator */}
      <div 
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '5px', 
          fontSize: '10px' 
        }}
        title={dockerStatus.info || 'Docker status'}
      >
        <span 
          style={{ 
            width: 7, 
            height: 7, 
            borderRadius: '50%', 
            background: getStatusColor(dockerStatus.status),
            boxShadow: '0 0 3px rgba(0,0,0,0.2)'
          }} 
        />
        <span style={{ color: 'var(--text)', fontWeight: '500' }}>
          Docker: {getStatusLabel(dockerStatus.status)}
        </span>
      </div>
    </>
  )
}
