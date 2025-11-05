/**
 * LeagueProgress Component - Barre de progression vers la ligue suivante
 * 
 * Responsabilité (SRP): Affichage de la progression dans une ligue uniquement
 * Pattern: Presentation Component
 * SOLID: Composant réutilisable, données passées via props
 * 
 * @param {Object} props
 * @param {string} props.currentLeague - Nom de la ligue actuelle
 * @param {number} props.currentLeagueIndex - Index de la ligue actuelle
 * @param {string} props.nextLeague - Nom de la ligue suivante (null si Gold)
 * @param {number} props.elo - ELO actuel
 * @param {number} props.currentThreshold - Seuil ELO de la ligue actuelle
 * @param {number} props.nextThreshold - Seuil ELO de la ligue suivante (null si Gold)
 * @param {number} props.progressPercent - Pourcentage de progression (0-100)
 * @param {boolean} props.showDetails - Afficher les détails ELO (défaut: true)
 * @param {string} props.className - Classes CSS additionnelles
 */

import React from 'react';
import { LEAGUE_CONFIG } from '../services/leagueApi';

export default function LeagueProgress({
  currentLeague,
  currentLeagueIndex,
  nextLeague,
  elo,
  currentThreshold,
  nextThreshold,
  progressPercent,
  showDetails = true,
  className = ''
}) {
  const leagueConfig = LEAGUE_CONFIG.getByName(currentLeague) || LEAGUE_CONFIG.getByIndex(currentLeagueIndex);
  
  // Si Gold League (pas de ligue suivante)
  const isMaxLeague = !nextLeague || currentLeague === 'Gold';

  return (
    <div className={`league-progress ${className}`}>
      {/* Header avec ligue actuelle et infos */}
      <div className="league-progress-header">
        <div className="league-progress-current">
          <span className="league-progress-emoji">{leagueConfig?.emoji || '🪵'}</span>
          <span className="league-progress-league-name">{currentLeague} League</span>
        </div>
        {showDetails && (
          <div className="league-progress-elo">
            <span className="league-progress-elo-value">{elo}</span>
            {!isMaxLeague && (
              <span className="league-progress-elo-target"> / {nextThreshold}</span>
            )}
          </div>
        )}
      </div>

      {/* Barre de progression */}
      {!isMaxLeague && (
        <>
          <div className="league-progress-bar">
            <div 
              className="league-progress-bar-fill"
              style={{ 
                width: `${Math.min(progressPercent, 100)}%`,
                backgroundColor: leagueConfig?.color || '#8B4513'
              }}
            />
          </div>
          
          {/* Footer avec détails */}
          {showDetails && (
            <div className="league-progress-footer">
              <span className="league-progress-percent">{Math.round(progressPercent)}%</span>
              <span className="league-progress-next">
                {nextThreshold - elo} points to {nextLeague} League
              </span>
            </div>
          )}
        </>
      )}

      {/* Message pour Gold League */}
      {isMaxLeague && (
        <div className="league-progress-max">
          <span className="league-progress-max-text">🏆 Maximum League Reached!</span>
        </div>
      )}
    </div>
  );
}
