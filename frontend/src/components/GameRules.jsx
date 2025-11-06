import React from 'react'

/**
 * Composant pour afficher les règles du jeu dans le style CodinGame
 * Inspiré du format des fichiers .tpl de CG-SpringChallenge2020
 */

// Composants de base pour structurer les règles

export const RulesContainer = ({ children }) => (
  <div className="statement-body" style={{
    padding: '20px',
    color: 'var(--text)',
    fontSize: '14px',
    lineHeight: '1.4',
    maxWidth: '100%'
  }}>
    {children}
  </div>
)

export const LeagueAlert = ({ level, children, icon = '🏆' }) => (
  <div style={{
    color: '#7cc576',
    backgroundColor: 'rgba(124, 197, 118, 0.1)',
    padding: '20px',
    marginRight: '15px',
    marginLeft: '15px',
    marginBottom: '10px',
    borderRadius: '4px',
    border: '1px solid rgba(124, 197, 118, 0.3)',
    textAlign: 'left'
  }}>
    <div style={{ textAlign: 'center', marginBottom: '10px' }}>
      <span style={{ fontSize: '48px' }}>{icon}</span>
    </div>
    <p style={{ textAlign: 'center', fontWeight: 700, marginBottom: '10px', fontSize: '16px' }}>
      {level}
    </p>
    <div className="statement-league-alert-content" style={{ fontSize: '14px', lineHeight: '1.6' }}>
      {children}
    </div>
  </div>
)

export const Section = ({ title, icon, children, isNew = false }) => (
  <div className={`statement-section ${isNew ? 'statement-new-league-rule' : ''}`} style={{
    marginBottom: '30px',
    ...(isNew && {
      backgroundColor: 'rgba(124, 197, 118, 0.05)',
      padding: '15px',
      borderLeft: '3px solid #7cc576',
      borderRadius: '4px'
    })
  }}>
    <h2 style={{
      fontSize: '18px',
      fontWeight: 'bold',
      marginBottom: '15px',
      display: 'flex',
      alignItems: 'center',
      gap: '10px'
    }}>
      <span className="icon" style={{ fontSize: '24px' }}>{icon}</span>
      <span>{title}</span>
    </h2>
    <div className="statement-section-content">
      {children}
    </div>
  </div>
)

export const SubSection = ({ title, emoji, children }) => (
  <div style={{ marginTop: '20px', marginBottom: '20px' }}>
    <h3 style={{
      fontSize: '16px',
      fontWeight: 700,
      paddingTop: '10px',
      paddingBottom: '15px',
      borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
      marginBottom: '15px'
    }}>
      {emoji && <span style={{ marginRight: '8px' }}>{emoji}</span>}
      {title}
    </h3>
    {children}
  </div>
)

export const Paragraph = ({ children, center = false }) => (
  <p style={{
    margin: '8px 0',
    lineHeight: '1.4',
    ...(center && { textAlign: 'center' })
  }}>
    {children}
  </p>
)

export const BulletList = ({ items }) => (
  <ul style={{
    marginLeft: '20px',
    marginTop: '6px',
    marginBottom: '6px',
    lineHeight: '1.4'
  }}>
    {items.map((item, idx) => (
      <li key={idx} style={{ marginBottom: '5px' }}>
        {item}
      </li>
    ))}
  </ul>
)

export const NumberedList = ({ items }) => (
  <ol style={{
    marginLeft: '20px',
    marginTop: '6px',
    marginBottom: '6px',
    lineHeight: '1.4'
  }}>
    {items.map((item, idx) => (
      <li key={idx} style={{ marginBottom: '5px' }}>
        {item}
      </li>
    ))}
  </ol>
)

export const Code = ({ children, inline = true }) => (
  inline ? (
    <code style={{
      background: 'rgba(255, 255, 255, 0.1)',
      padding: '2px 6px',
      borderRadius: '3px',
      fontFamily: 'monospace',
      fontSize: '13px'
    }}>
      {children}
    </code>
  ) : (
    <pre style={{
      background: 'rgba(255, 255, 255, 0.05)',
      padding: '15px',
      borderRadius: '4px',
      overflow: 'auto',
      marginTop: '10px',
      marginBottom: '10px'
    }}>
      <code style={{
        fontFamily: 'monospace',
        fontSize: '13px'
      }}>
        {children}
      </code>
    </pre>
  )
)

export const Action = ({ children }) => (
  <span style={{
    color: '#4CAF50',
    fontWeight: 600,
    fontFamily: 'monospace'
  }}>
    {children}
  </span>
)

export const Const = ({ children }) => (
  <span style={{
    color: '#ff9800',
    fontWeight: 600
  }}>
    {children}
  </span>
)

export const Variable = ({ children }) => (
  <span style={{
    color: '#2196F3',
    fontStyle: 'italic',
    fontFamily: 'monospace'
  }}>
    {children}
  </span>
)

export const Keyword = ({ children }) => (
  <span style={{
    fontWeight: 'bold',
    color: '#7cc576'
  }}>
    {children}
  </span>
)

export const ImageBlock = ({ src, alt, caption, width = '400px' }) => (
  <div style={{
    textAlign: 'center',
    margin: '20px auto',
    maxWidth: '100%'
  }}>
    <img 
      src={src} 
      alt={alt}
      style={{
        width: width,
        maxWidth: '100%',
        borderRadius: '4px',
        border: '1px solid rgba(255, 255, 255, 0.1)'
      }}
    />
    {caption && (
      <div style={{
        margin: '10px auto',
        width: width,
        maxWidth: '100%',
        fontSize: '13px',
        color: '#999',
        fontStyle: 'italic'
      }}>
        {caption}
      </div>
    )}
  </div>
)

export const VictoryConditions = ({ children }) => (
  <div className="statement-victory-conditions" style={{
    display: 'flex',
    alignItems: 'flex-start',
    gap: '15px',
    padding: '15px',
    background: 'rgba(76, 175, 80, 0.1)',
    borderLeft: '4px solid #4CAF50',
    borderRadius: '4px',
    marginTop: '20px',
    marginBottom: '20px'
  }}>
    <div className="icon victory" style={{ fontSize: '24px' }}>✅</div>
    <div className="blk">
      <div className="title" style={{ fontWeight: 'bold', marginBottom: '8px' }}>
        Conditions de victoire
      </div>
      <div className="text">
        {children}
      </div>
    </div>
  </div>
)

export const LoseConditions = ({ children }) => (
  <div className="statement-lose-conditions" style={{
    display: 'flex',
    alignItems: 'flex-start',
    gap: '15px',
    padding: '15px',
    background: 'rgba(244, 67, 54, 0.1)',
    borderLeft: '4px solid #f44336',
    borderRadius: '4px',
    marginTop: '20px',
    marginBottom: '20px'
  }}>
    <div className="icon lose" style={{ fontSize: '24px' }}>❌</div>
    <div className="blk">
      <div className="title" style={{ fontWeight: 'bold', marginBottom: '8px' }}>
        Conditions de défaite
      </div>
      <div className="text">
        {children}
      </div>
    </div>
  </div>
)

export const DebugTips = ({ tips }) => (
  <SubSection title="Conseils de débogage" emoji="🐞">
    <BulletList items={tips} />
  </SubSection>
)

export const Spacer = ({ height = '12px' }) => (
  <div style={{ height }} />
)

// Composant complet pour les règles du Pacman
export default function GameRules({ league = 'wood2' }) {
  // Normaliser la casse (backend retourne "Wood2", "Wood1", "Bronze", etc.)
  const normalizedLeague = league.toLowerCase()
  const isWood2 = normalizedLeague === 'wood2' || normalizedLeague === 'wood 2'
  const isWood1 = normalizedLeague === 'wood1' || normalizedLeague === 'wood 1'
  
  return (
    <RulesContainer>
      {/* Alerte de ligue */}
      {isWood2 && (
        <LeagueAlert level="Ligue Wood 2">
          <p>
            Pour ce challenge, plusieurs versions du même jeu seront disponibles.
            Quand vous aurez prouvé votre valeur dans la première version, vous
            accéderez à la ligue supérieure et débloquerez de nouvelles règles.
          </p>
        </LeagueAlert>
      )}

      {isWood1 && (
        <LeagueAlert level="Ligue Wood 1 - Nouvelles règles">
          <p>
            Vous pouvez maintenant contrôler plusieurs Pacs !
            <br /><br />
            Consultez l'énoncé mis à jour pour plus de détails.
          </p>
        </LeagueAlert>
      )}

      {/* Objectif */}
      <Section title="Objectif" icon="🎯">
        <Paragraph>
          Manger plus de pastilles que votre adversaire !
        </Paragraph>
      </Section>

      {/* Règles principales */}
      <Section title="Règles" icon="📖">
        <Paragraph>
          Le jeu se joue sur une grille qui vous est donnée au début de chaque partie.
          La grille est composée de murs et de sol. 
          {isWood2 && ' Dans cette première ligue, chaque joueur contrôle un seul pac qui peut bouger dans la grille.'}
          {isWood1 && ' Chaque joueur contrôle une équipe de pacs qui peuvent bouger dans la grille.'}
        </Paragraph>

        <SubSection title="La grille" emoji="🗺️">
          <Paragraph>
            La grille est générée aléatoirement, et possède une taille{' '}
            <Variable>width</Variable>, <Variable>height</Variable>.
          </Paragraph>
          <Spacer />
          <Paragraph>Chaque cellule de la grille est soit :</Paragraph>
          <BulletList items={[
            <>Un mur (représenté par le caractère <Action>#</Action>)</>,
            <>Du sol (représenté par un espace)</>,
          ]} />
          <Spacer />
          <Paragraph>
            Les grilles sont toujours symétriques par rapport à l'axe vertical central.
            La plupart des grilles ont des cases de type sol sur les extrémités gauche et droite ;
            les pacs peuvent <strong>faire le tour de la grille</strong> et apparaître de l'autre
            côté en passant par ces cases.
          </Paragraph>
          <Spacer />
          <Paragraph>
            Quand le jeu démarre, la grille est remplie de <strong>pastilles</strong> et
            d'occasionnelles <strong>super-pastilles</strong>. Manger une pastille avec
            l'un de vos pacs vous rapporte <Const>1 point</Const>. Les super-pastilles
            valent <Const>10 points</Const>. Une fois mangée, une pastille disparaît.
          </Paragraph>
        </SubSection>

        <SubSection title="Les Pacs" emoji="🔵🔴">
          {isWood2 && (
            <>
              <Paragraph>
                Chaque joueur contrôle un pac. Mais dans les ligues suivantes, vous contrôlerez jusqu'à <Const>5</Const> pacs chacun.
              </Paragraph>
              <Spacer />
            </>
          )}
          {isWood1 && (
            <>
              <Paragraph>
                Chaque joueur commence avec le même nombre de pacs, jusqu'à <Const>5</Const> chacun.
              </Paragraph>
              <Spacer />
            </>
          )}
          <Paragraph>
            Chaque joueur contrôle un ou plusieurs pacs. À chaque tour, vous recevez
            les informations relatives aux pacs et pastilles qui sont visibles.
          </Paragraph>
          <Spacer />
          <Paragraph>
            {isWood2 && 'Votre pac peut recevoir la commande suivante :'}
            {isWood1 && 'Les pacs peuvent recevoir les commandes suivantes (un pac ne peut recevoir qu\'une commande par tour) :'}
          </Paragraph>
          <BulletList items={[
            <>
              <Action>MOVE x y</Action> : Donne au pac une case cible. Le pac va choisir
              le plus court chemin vers cette position et va effectuer{' '}
              <strong>le premier déplacement de ce chemin</strong>. Le pac ne prend pas
              en compte la présence de pastilles ou d'autres pacs lorsqu'il choisit un chemin.
            </>,
          ]} />
          <Spacer />
          <Paragraph>
            Format de sortie : <Code>{isWood2 ? 'MOVE x y' : 'MOVE pacId x y'}</Code>
          </Paragraph>
          <Paragraph>
            Exemple : <Code>{isWood2 ? 'MOVE 3 2' : 'MOVE 0 3 2 | MOVE 1 5 7'}</Code> {isWood2 ? 'pour aller vers la position (3, 2)' : 'pour déplacer deux pacs'}
          </Paragraph>
          <Spacer />
          <Paragraph>
            La cible peut être <strong>n'importe où</strong> sur la grille (adjacente ou éloignée).
            Le referee calcule automatiquement le plus court chemin (BFS).
            Votre pac se déplace d'<strong>une case par tour</strong> vers la cible.
            Déplacements uniquement horizontaux ou verticaux (pas de diagonale).
          </Paragraph>
        </SubSection>

        <SubSection title="Fin du jeu" emoji="⛔">
          <Paragraph>
            La partie se termine lorsqu'il n'y a plus assez de pastilles en jeu
            pour changer l'issue de la partie.
          </Paragraph>
          <Spacer />
          <Paragraph>
            Le jeu s'arrête automatiquement après <Const>200 tours</Const>.
          </Paragraph>
        </SubSection>

        {/* Conditions de victoire/défaite */}
        <VictoryConditions>
          Vous avez mangé plus de pastilles que l'adversaire à la fin de la partie.
        </VictoryConditions>

        <LoseConditions>
          Votre programme n'a pas répondu dans le temps imparti ou l'une des commandes est invalide.
        </LoseConditions>

        {/* Conseils de débogage */}
        <DebugTips tips={[
          'Survolez une case de la grille pour voir ses coordonnées',
          'Survolez un pac pour avoir des informations sur lui',
          'Rajoutez du texte à la fin d\'une commande pour l\'afficher au-dessus du pac',
          'Utilisez le clavier pour contrôler : espace pour lire/pause, flèches pour naviguer'
        ]} />
      </Section>

      {/* Protocole de jeu */}
      <Section title="Protocole de jeu" icon="📡">
        <SubSection title="Entrées d'initialisation">
          <Paragraph>
            <strong>Ligne 1 :</strong> deux entiers <Variable>width</Variable> et <Variable>height</Variable> pour la taille de la grille.
          </Paragraph>
          <Paragraph>
            <strong>Les <Variable>height</Variable> lignes suivantes :</strong> une chaîne de <Variable>width</Variable>{' '}
            caractères représentant les cases de cette ligne : <Const>' '</Const> pour du sol et <Const>'#'</Const> pour un mur.
          </Paragraph>
        </SubSection>

        <SubSection title="Entrées pour un tour de jeu">
          <Paragraph><strong>Ligne 1 :</strong> Deux entiers séparés par un espace :</Paragraph>
          <BulletList items={[
            <><Variable>myScore</Variable> : votre score actuel</>,
            <><Variable>opponentScore</Variable> : le score de votre adversaire</>
          ]} />
          
          <Spacer />
          <Paragraph><strong>Ligne 2 :</strong> Un entier :</Paragraph>
          <BulletList items={[
            <><Variable>visiblePacCount</Variable> : le nombre de pacs visibles pour vous</>
          ]} />

          <Spacer />
          <Paragraph><strong>Les <Variable>visiblePacCount</Variable> lignes suivantes :</strong></Paragraph>
          <BulletList items={[
            <><Variable>pacId</Variable> : l'ID du pac (vaut toujours <Const>0</Const> dans la ligue Wood)</>,
            <><Variable>mine</Variable> : le propriétaire du pac (1 si ce pac est à vous, 0 sinon)</>,
            <><Variable>x</Variable> & <Variable>y</Variable> : la position du pac</>,
            <><Variable>typeId</Variable> : inutilisé dans cette ligue</>,
            <><Variable>speedTurnsLeft</Variable> : inutilisé dans cette ligue</>,
            <><Variable>abilityCooldown</Variable> : inutilisé dans cette ligue</>
          ]} />

          <Spacer />
          <Paragraph>
            <strong>Ligne suivante :</strong> un entier <Variable>visiblePelletCount</Variable> : le nombre de pastilles visibles pour vous
          </Paragraph>
          <Paragraph>
            <strong>Les <Variable>visiblePelletCount</Variable> lignes suivantes :</strong> trois entiers :
          </Paragraph>
          <BulletList items={[
            <><Variable>x</Variable> & <Variable>y</Variable> : la position de la pastille</>,
            <><Variable>value</Variable> : le score de la pastille</>
          ]} />
        </SubSection>

        <SubSection title="Sortie pour un tour de jeu">
          <Paragraph>
            {isWood2 && 'Une seule ligne avec votre action :'}
            {isWood1 && 'Une seule ligne avec une ou plusieurs commandes séparées par | (pipe). Par exemple : MOVE 0 5 7 | MOVE 1 16 10.'}
          </Paragraph>
          <BulletList items={[
            <>
              <Action>{isWood2 ? 'MOVE x y' : 'MOVE pacId x y'}</Action> : {isWood2 ? 'votre pac se déplace vers la case ciblée.' : 'le pac avec l\'identifiant pacId se déplace vers la case ciblée.'}
            </>
          ]} />
          <Spacer />
          <Paragraph>
            Exemple : <Code>{isWood2 ? 'MOVE 5 7' : 'MOVE 0 5 7 | MOVE 1 3 2'}</Code>
          </Paragraph>
        </SubSection>

        <SubSection title="Contraintes">
          <Paragraph>
            Temps de réponse par tour ≤ <Const>50</Const>ms
          </Paragraph>
          <Paragraph>
            Temps de réponse au premier tour ≤ <Const>1000</Const>ms
          </Paragraph>
        </SubSection>
      </Section>
    </RulesContainer>
  )
}
