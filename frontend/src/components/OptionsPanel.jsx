import React from 'react'
import StatusBar from './StatusBar'
import ThemeToggle from './ThemeToggle'

/**
 * Composant panel options (Status, Theme, Speed).
 * 
 * Responsabilité (SRP): Regroupement des options uniquement
 * - Status Backend/Docker
 * - Sélecteur de thème
 * - Sélecteur de vitesse
 * 
 * @param {Object} props
 * @param {Object} props.backendStatus - { status, info }
 * @param {Object} props.dockerStatus - { status, info }
 * @param {string} props.theme - Thème actuel
 * @param {Function} props.onThemeChange - Callback changement thème
 * @param {number} props.animationDelay - Délai animation (ms)
 * @param {Function} props.onSpeedChange - Callback changement vitesse (speed: 'slow'|'medium'|'fast')
 * @returns {JSX.Element}
 */
export default function OptionsPanel({
  backendStatus,
  dockerStatus,
  theme,
  onThemeChange,
  animationDelay,
  onSpeedChange
}) {
  /**
   * Handler pour le changement de vitesse
   */
  const handleSpeedChange = (e) => {
    const speed = e.target.value
    const map = { slow: 800, medium: 500, fast: 200 }
    onSpeedChange(map[speed])
    
    try {
      localStorage.setItem('gamearena_speed', speed)
    } catch (err) {
      console.error('Failed to save speed:', err)
    }
  }

  /**
   * Détermine la valeur actuelle du sélecteur
   */
  const getCurrentSpeed = () => {
    if (animationDelay <= 200) return 'fast'
    if (animationDelay <= 500) return 'medium'
    return 'slow'
  }

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      gap: '5px', 
      minWidth: '150px' 
    }}>
      <h4 style={{ margin: 0, fontSize: '12px', fontWeight: 'bold' }}>
        OPTIONS
      </h4>
      
      {/* Status indicators */}
      <StatusBar 
        backendStatus={backendStatus} 
        dockerStatus={dockerStatus} 
      />

      {/* Theme toggle */}
      <ThemeToggle 
        theme={theme} 
        onChange={onThemeChange} 
      />

      {/* Speed selector */}
      <label style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '5px', 
        fontSize: '10px' 
      }}>
        <span style={{ fontWeight: '500', minWidth: '45px' }}>Vitesse:</span>
        <select 
          value={getCurrentSpeed()} 
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
