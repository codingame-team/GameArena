import React from 'react'

/**
 * Composant pour les contrôles de lecture (Play/Pause/Stop/Speed).
 * 
 * Responsabilité (SRP): Affichage des contrôles uniquement
 * - Boutons de contrôle (Play, Pause, Stop)
 * - Sélecteur de vitesse
 * - Propagation des événements
 * 
 * @param {Object} props
 * @param {boolean} props.isPlaying - Indique si une partie est en cours
 * @param {boolean} props.isPaused - Indique si la lecture est en pause
 * @param {boolean} props.isCollecting - Indique si la collecte des tours est en cours
 * @param {number} props.animationDelay - Délai d'animation actuel (ms)
 * @param {Function} props.onPlay - Callback pour démarrer la partie
 * @param {Function} props.onPause - Callback pour pause/resume
 * @param {Function} props.onStop - Callback pour arrêter
 * @param {Function} props.onSpeedChange - Callback pour changer la vitesse (speed: 'slow'|'medium'|'fast')
 * @returns {JSX.Element}
 */
export default function ControlBar({ 
  isPlaying, 
  isPaused, 
  isCollecting,
  animationDelay, 
  onPlay, 
  onPause, 
  onStop, 
  onSpeedChange 
}) {
  /**
   * Détermine la valeur du sélecteur de vitesse selon animationDelay
   */
  const getSpeedValue = () => {
    if (animationDelay <= 200) return 'fast'
    if (animationDelay <= 500) return 'medium'
    return 'slow'
  }

  /**
   * Handler pour le changement de vitesse
   */
  const handleSpeedChange = (e) => {
    const speed = e.target.value
    onSpeedChange(speed)
    
    // Sauvegarder dans localStorage
    try {
      localStorage.setItem('gamearena_speed', speed)
    } catch (err) {
      console.error('Failed to save speed to localStorage:', err)
    }
  }

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      gap: '8px', 
      minWidth: '150px' 
    }}>
      {/* Contrôles de lecture */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <button 
          onClick={onPlay} 
          disabled={isCollecting || isPlaying}
          style={{ 
            fontSize: '14px', 
            padding: '8px 12px', 
            flex: 1,
            minWidth: '80px',
            cursor: (isCollecting || isPlaying) ? 'not-allowed' : 'pointer',
            opacity: (isCollecting || isPlaying) ? 0.5 : 1
          }}
          title="Démarrer une nouvelle partie"
        >
          {isCollecting ? '⏳ Collecte...' : '▶ Play'}
        </button>

        <button 
          onClick={onPause} 
          disabled={!isPlaying || isCollecting}
          style={{ 
            fontSize: '14px', 
            padding: '8px 12px', 
            flex: 1,
            minWidth: '80px',
            cursor: (!isPlaying || isCollecting) ? 'not-allowed' : 'pointer',
            opacity: (!isPlaying || isCollecting) ? 0.5 : 1
          }}
          title={isPaused ? "Reprendre la lecture" : "Mettre en pause"}
        >
          {isPaused ? '▶ Resume' : '⏸ Pause'}
        </button>

        <button 
          onClick={onStop} 
          disabled={!isPlaying && !isCollecting}
          style={{ 
            fontSize: '14px', 
            padding: '8px 12px', 
            flex: 1,
            minWidth: '80px',
            background: '#ff6b6b',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: (!isPlaying && !isCollecting) ? 'not-allowed' : 'pointer',
            opacity: (!isPlaying && !isCollecting) ? 0.5 : 1
          }}
          title="Arrêter la partie en cours"
        >
          ⏹ Stop
        </button>
      </div>

      {/* Sélecteur de vitesse */}
      <label style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '5px', 
        fontSize: '10px' 
      }}>
        <span style={{ fontWeight: '500', minWidth: '45px' }}>Vitesse:</span>
        <select 
          value={getSpeedValue()} 
          onChange={handleSpeedChange}
          style={{ fontSize: '10px', padding: '2px 4px', flex: 1 }}
        >
          <option value="slow">Lente</option>
          <option value="medium">Moyenne</option>
          <option value="fast">Rapide</option>
        </select>
      </label>
    </div>
  )
}
