import React from 'react'
import { Keyword } from './GameRules'

/**
 * Composant pour afficher les messages de promotion de ligue
 * Équivalent des fichiers welcome.html dans CodinGame
 */

export const LeagueWelcomeMessage = ({ league, imageSrc }) => {
  const messages = {
    bronze: {
      title: "Vous venez d'atteindre la ligue supérieure.",
      features: [
        <>Vous pouvez maintenant contrôler <Keyword>plusieurs pacs</Keyword> !</>
      ],
      image: imageSrc || '/assets/league/level2.jpg'
    },
    silver: {
      title: "Vous venez d'atteindre la ligue supérieure.",
      features: [
        <>Vous pouvez maintenant donner un <Keyword>boost de vitesse</Keyword> à vos pacs.</>,
        <>Vous pouvez désormais modifier le <Keyword>type de vos pacs</Keyword> !</>,
        <>Seuls les pacs et pastilles qui sont dans votre <Keyword>ligne de mire</Keyword> sont visibles.</>
      ],
      image: imageSrc || '/assets/league/level3.jpg'
    },
    gold: {
      title: "Vous venez d'atteindre la ligue supérieure.",
      features: [
        <>Vous pouvez maintenant voir les pacs qui sont morts.</>
      ],
      image: null
    }
  }

  const config = messages[league]
  if (!config) return null

  return (
    <div style={{
      textAlign: 'center',
      padding: '30px',
      background: 'var(--frame-bg)',
      border: '2px solid rgba(124, 197, 118, 0.3)',
      borderRadius: '8px',
      margin: '20px 0'
    }}>
      <h2 style={{
        color: '#7cc576',
        marginBottom: '20px',
        fontSize: '24px',
        fontWeight: 'bold'
      }}>
        {config.title}
      </h2>
      
      <div style={{
        fontSize: '16px',
        lineHeight: '1.8',
        marginBottom: config.image ? '20px' : '0'
      }}>
        {config.features.map((feature, idx) => (
          <div key={idx} style={{ marginBottom: '10px' }}>
            {feature}
          </div>
        ))}
      </div>

      {config.image && (
        <div style={{ marginTop: '20px', marginBottom: '15px' }}>
          <img 
            src={config.image} 
            alt={`${league} league`}
            style={{
              width: '500px',
              maxWidth: '100%',
              borderRadius: '4px',
              border: '1px solid rgba(255, 255, 255, 0.1)'
            }}
          />
        </div>
      )}

      <div style={{
        fontSize: '13px',
        color: '#999',
        marginTop: '15px'
      }}>
        Consultez l'énoncé mis à jour pour plus de détails.
      </div>
    </div>
  )
}

export default LeagueWelcomeMessage
