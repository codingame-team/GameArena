import React from 'react'

/**
 * Composant pour le sélecteur de thème.
 * 
 * Responsabilité (SRP): Affichage du sélecteur de thème uniquement
 * - Présentation visuelle
 * - Propagation événement onChange
 * 
 * @param {Object} props
 * @param {string} props.theme - Thème actuel ('light' | 'dark')
 * @param {Function} props.onChange - Callback appelé au changement (theme) => void
 * @returns {JSX.Element}
 */
export default function ThemeToggle({ theme, onChange }) {
  return (
    <label style={{ 
      display: 'flex', 
      alignItems: 'center', 
      gap: '5px', 
      fontSize: '10px', 
      marginTop: '3px' 
    }}>
      <span style={{ fontWeight: '500', minWidth: '45px' }}>Thème:</span>
      <select 
        value={theme} 
        onChange={(e) => onChange(e.target.value)}
        style={{ fontSize: '10px', padding: '2px 4px', flex: 1 }}
      >
        <option value="light">Clair</option>
        <option value="dark">Foncé</option>
      </select>
    </label>
  )
}
