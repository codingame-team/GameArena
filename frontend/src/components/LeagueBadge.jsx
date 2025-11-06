/**
 * LeagueBadge Component - Affichage du badge de ligue
 * 
 * Responsabilité (SRP): Affichage visuel du badge de ligue uniquement
 * Pattern: Presentation Component
 * SOLID: Composant réutilisable, indépendant de la logique métier
 * 
 * @param {Object} props
 * @param {string} props.leagueName - Nom de la ligue (Wood, Bronze, Silver, Gold)
 * @param {number} props.leagueIndex - Index de la ligue (1-4) - optionnel si leagueName fourni
 * @param {string} props.size - Taille du badge ('small', 'medium', 'large')
 * @param {boolean} props.showName - Afficher le nom de la ligue (défaut: true)
 * @param {string} props.className - Classes CSS additionnelles
 */

import React from 'react';
import { LEAGUE_CONFIG } from '../services/leagueApi';

export default function LeagueBadge({ 
  leagueName, 
  leagueIndex, 
  size = 'medium',
  showName = true,
  className = ''
}) {
  // Récupérer la config de la ligue
  let leagueConfig;
  if (leagueName) {
    leagueConfig = LEAGUE_CONFIG.getByName(leagueName);
  } else if (leagueIndex) {
    leagueConfig = LEAGUE_CONFIG.getByIndex(leagueIndex);
  }

  // Fallback si pas de ligue trouvée
  if (!leagueConfig) {
    leagueConfig = LEAGUE_CONFIG.getByName('Wood');
  }

  const sizeClasses = {
    small: 'league-badge-small',
    medium: 'league-badge-medium',
    large: 'league-badge-large'
  };

  return (
    <div 
      className={`league-badge ${sizeClasses[size]} ${className}`}
      title={`${leagueConfig.displayName || leagueConfig.name} League`}
      style={{ '--league-color': leagueConfig.color }}
    >
      <span className="league-badge-emoji">{leagueConfig.emoji}</span>
      {showName && <span className="league-badge-name">{leagueConfig.displayName || leagueConfig.name}</span>}
    </div>
  );
}
