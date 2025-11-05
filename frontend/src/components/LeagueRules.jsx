/**
 * LeagueRules Component - Affichage des règles de la ligue courante
 * 
 * Responsabilité (SRP): Affichage des règles de jeu selon la ligue
 * Pattern: Presentation Component
 * SOLID: Composant réutilisable, indépendant de la logique métier
 */

import React from 'react';

export default function LeagueRules({ leagueInfo, compact = false, collapsible = true }) {
  const [isExpanded, setIsExpanded] = React.useState(false);
  
  if (!leagueInfo) return null;

  const leagueName = leagueInfo.current_league;
  
  // Règles par ligue (synchronisé avec leagues.py)
  const getRules = () => {
    switch (leagueName) {
      case 'Wood':
        return {
          pacs: '1 pac par joueur',
          fog: '❌ Désactivé (vision complète)',
          abilities: '❌ Aucune ability',
          deadPacs: '❌ Non fourni',
          cherries: '2 cherries'
        };
      case 'Bronze':
        return {
          pacs: '2-3 pacs par joueur',
          fog: '❌ Désactivé (vision complète)',
          abilities: '❌ Aucune ability',
          deadPacs: '❌ Non fourni',
          cherries: '4 cherries'
        };
      case 'Silver':
        return {
          pacs: '3-4 pacs par joueur',
          fog: '✅ Activé (vision limitée)',
          abilities: '✅ SPEED & SWITCH disponibles',
          deadPacs: '❌ Non fourni',
          cherries: '6 cherries'
        };
      case 'Gold':
        return {
          pacs: '3-5 pacs par joueur',
          fog: '✅ Activé (vision limitée)',
          abilities: '✅ SPEED & SWITCH disponibles',
          deadPacs: '✅ Informations sur pacs morts',
          cherries: '8+ cherries'
        };
      default:
        return null;
    }
  };

  const rules = getRules();
  if (!rules) return null;

  if (compact && !isExpanded) {
    return (
      <div 
        className="league-rules-compact" 
        style={{
          padding: '8px 12px',
          background: 'var(--bg-tertiary, #2a2a2a)',
          borderRadius: '6px',
          fontSize: '13px',
          color: '#aaa',
          cursor: collapsible ? 'pointer' : 'default',
          transition: 'all 0.2s ease'
        }}
        onClick={() => collapsible && setIsExpanded(true)}
        onMouseEnter={(e) => collapsible && (e.currentTarget.style.background = '#333')}
        onMouseLeave={(e) => collapsible && (e.currentTarget.style.background = '#2a2a2a')}
      >
        <div style={{ 
          marginBottom: '4px', 
          fontWeight: 'bold', 
          color: '#fff',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span>📜 Règles {leagueName}</span>
          {collapsible && (
            <span style={{ fontSize: '10px', color: '#666' }}>▼ Cliquer pour détails</span>
          )}
        </div>
        <div>{rules.pacs} • {rules.fog.includes('✅') ? 'Fog' : 'No Fog'} • {rules.abilities.includes('✅') ? 'Abilities' : 'No Abilities'}</div>
      </div>
    );
  }

  return (
    <div className="league-rules" style={{
      padding: '16px',
      background: 'var(--bg-tertiary, #2a2a2a)',
      borderRadius: '8px',
      marginBottom: compact ? '0' : '16px'
    }}>
      <h3 style={{ 
        margin: '0 0 12px 0', 
        fontSize: '16px',
        color: 'var(--text-primary, #fff)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          📜 Règles de la ligue {leagueName}
        </span>
        {compact && collapsible && (
          <button
            onClick={() => setIsExpanded(false)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#888',
              cursor: 'pointer',
              fontSize: '12px',
              padding: '4px 8px'
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = '#fff'}
            onMouseLeave={(e) => e.currentTarget.style.color = '#888'}
          >
            ▲ Réduire
          </button>
        )}
      </h3>
      
      <div style={{ 
        display: 'grid', 
        gap: '8px',
        fontSize: '14px',
        color: 'var(--text-secondary, #ccc)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>👥 Pacs:</span>
          <strong>{rules.pacs}</strong>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>🌫️ Fog of War:</span>
          <strong>{rules.fog}</strong>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>⚡ Abilities:</span>
          <strong>{rules.abilities}</strong>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>💀 Dead Pacs:</span>
          <strong>{rules.deadPacs}</strong>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>🍒 Cherries:</span>
          <strong>{rules.cherries}</strong>
        </div>
      </div>

      <div style={{
        marginTop: '12px',
        padding: '8px',
        background: 'rgba(255, 193, 7, 0.1)',
        borderLeft: '3px solid #ffc107',
        borderRadius: '4px',
        fontSize: '12px',
        color: '#ffc107'
      }}>
        💡 Les matchs dans le Playground utilisent ces règles
      </div>
    </div>
  );
}
