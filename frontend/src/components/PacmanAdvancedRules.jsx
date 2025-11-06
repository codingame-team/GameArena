import React from 'react'
import {
  RulesContainer,
  LeagueAlert,
  Section,
  SubSection,
  Paragraph,
  BulletList,
  NumberedList,
  Code,
  Action,
  Const,
  Variable,
  ImageBlock,
  VictoryConditions,
  LoseConditions,
  DebugTips,
  Spacer
} from './GameRules'

/**
 * Règles avancées du Pacman pour les ligues supérieures
 * Inclut : multi-pacs, compétences, brouillard de guerre, combats
 */
export default function PacmanAdvancedRules({ league = 'gold' }) {
  // Normaliser la casse (backend retourne "Silver", "Bronze", etc.)
  const normalizedLeague = league.toLowerCase()
  
  // Helper pour les conditions cumulatives (progressive disclosure)
  const isBronzeOrAbove = ['bronze', 'silver', 'gold'].includes(normalizedLeague)
  const isSilverOrAbove = ['silver', 'gold'].includes(normalizedLeague)
  const isGold = normalizedLeague === 'gold'

  return (
    <RulesContainer>
      {/* LEAGUE ALERT - Uniquement la ligue actuelle */}
      {normalizedLeague === 'bronze' && (
        <LeagueAlert level="Résumé des nouvelles règles" icon="🥉">
          <p>
            Vous pouvez maintenant contrôler plusieurs Pacs !
            <br /><br />
            Consultez l'énoncé mis à jour pour plus de détails.
          </p>
        </LeagueAlert>
      )}

      {normalizedLeague === 'silver' && (
        <LeagueAlert level="Résumé des nouvelles règles" icon="🥈">
          <p><strong>Toutes les règles sont maintenant débloquées !</strong></p>
          <BulletList items={[
            'Vous pouvez maintenant donner un boost de vitesse à vos pacs',
            'Vous pouvez désormais modifier le type de vos pacs',
            'Seuls les pacs et pastilles qui sont dans votre ligne de mire sont visibles'
          ]} />
          <Spacer />
          <Paragraph>Consultez l'énoncé mis à jour pour plus de détails.</Paragraph>
        </LeagueAlert>
      )}

      {isGold && (
        <LeagueAlert level="Résumé des nouvelles règles" icon="🥇">
          <p>
            Vous pouvez maintenant voir les pacs qui sont morts.
            <br /><br />
            Consultez l'énoncé mis à jour pour plus de détails.
          </p>
        </LeagueAlert>
      )}

      {/* Objectif */}
      <Section title="Objectif" icon="🎯">
        <Paragraph>
          Manger plus de pastilles que votre adversaire !
          {isSilverOrAbove && (
            <> Et éviter de vous faire tuer !</>
          )}
        </Paragraph>
      </Section>

      {/* Règles principales */}
      <Section title="Règles" icon="📖">
        <SubSection title="La grille" emoji="🗺️">
          <Paragraph>
            La grille est générée aléatoirement avec dimensions{' '}
            <Variable>width</Variable> × <Variable>height</Variable>.
            Composée de murs (<Action>#</Action>) et de sol (cases vides).
          </Paragraph>
          <Spacer />
          <Paragraph>
            Les grilles sont <strong>symétriques</strong> par rapport à l'axe vertical.
            La plupart ont des bords traversables : les pacs peuvent{' '}
            <strong>faire le tour de la grille</strong> (wrap-around).
          </Paragraph>
          <Spacer />
          <Paragraph>
            Au départ, la grille contient des <strong>pastilles</strong> (<Const>1 point</Const>)
            {isSilverOrAbove && (
              <> et des <strong>super-pastilles</strong> / cherries (<Const>10 points</Const>)</>
            )}.
          </Paragraph>
        </SubSection>

        <SubSection title="Les Pacs" emoji="🔵🔴">
          <Paragraph>
            {league === 'wood' ? (
              <>Chaque joueur contrôle <Const>1 pac</Const>.</>
            ) : (
              <>Chaque joueur contrôle jusqu'à <Const>5 pacs</Const> simultanément.</>
            )}
          </Paragraph>

          {isSilverOrAbove && (
            <>
              <Spacer />
              <Paragraph>
                <strong>Vision limitée</strong> : Vos pacs ne voient pas à travers les murs.
                Vous voyez uniquement les pastilles et pacs ennemis reliés par une ligne droite
                continue depuis vos pacs. Les super-pastilles sont toujours visibles !
              </Paragraph>
            </>
          )}

          <Spacer />

          {/* Informations sur les types de pacs - Silver et au-dessus */}
          {isSilverOrAbove && (
            <>
              <Paragraph>
                À chaque tour, vous recevez les informations relatives aux pacs et pastilles qui sont visibles. 
                Pour chaque pac vous avez son identifiant, s'il vous appartient ou non, ainsi que ses coordonnées. 
                Pour chaque pastille vous avez leurs coordonnées et leur valeur.
              </Paragraph>
              <Spacer />
              <Paragraph>
                {isGold ? (
                  <>
                    Chaque pac possède un <Variable>type</Variable> donné (<Action>ROCK</Action>, <Action>PAPER</Action> ou <Action>SCISSORS</Action>). 
                    Le type d'un pac mort est <Action>DEAD</Action>.
                  </>
                ) : (
                  <>
                    Chaque pac possède un <Variable>type</Variable> donné (<Action>ROCK</Action>, <Action>PAPER</Action> ou <Action>SCISSORS</Action>). 
                    Dès la prochaine ligue, le type d'un pac mort sera <Action>DEAD</Action>.
                  </>
                )}
              </Paragraph>
              <Spacer />
              <Paragraph>
                Chaque pac a accès à deux <strong>compétences</strong> (<Action>SWITCH</Action> et <Action>SPEED</Action>) 
                qui partagent le même <strong>temps de rechargement</strong> de <Const>10</Const> tours.
                Les compétences d'un pac sont déjà disponibles au début de la partie.
              </Paragraph>
              <Spacer />
            </>
          )}

          <Paragraph><strong>Commandes disponibles{isBronzeOrAbove ? ' :' : ' :'}</strong></Paragraph>

          <BulletList items={[
            <>
              <Action>MOVE pacId x y</Action> : Déplace le pac vers la position cible.
              Le pac choisit le plus court chemin (BFS) et avance d'<Const>1 case/tour</Const>
              {isSilverOrAbove && <> (ou <Const>2 cases</Const> si SPEED actif)</>}.
            </>,
            ...(isSilverOrAbove ? [
              <>
                <Action>SWITCH pacId type</Action> : Si les compétences du pac sont disponibles, celui-ci va se transformer en un nouveau type de pac. 
                Les types disponibles sont : <Action>ROCK</Action>, <Action>PAPER</Action> ou <Action>SCISSORS</Action>.
              </>,
              <>
                <Action>SPEED pacId</Action> : Si les compétences du pac sont disponibles, celui-ci va accélérer pendant les{' '}
                <Const>5</Const> prochains tours, lui permettant d'avancer de <strong>2 pas</strong> lors de ses mouvements.
              </>
            ] : [])
          ]} />

          <Spacer />

          <Paragraph>
            Format : Une ligne avec toutes les commandes séparées par <Code>|</Code>
          </Paragraph>
          <Code inline={false}>
{`MOVE 0 5 3 | MOVE 1 8 7`}
          </Code>
          
          {isSilverOrAbove && (
            <>
              <Code inline={false}>
{`MOVE 0 5 3 | SPEED 1 | SWITCH 2 ROCK`}
              </Code>
            </>
          )}

          <Spacer />
          <Paragraph>
            Référez-vous à la section <strong>Protocole de jeu</strong> pour plus d'informations sur les commandes à envoyer à vos pacs.
          </Paragraph>
        </SubSection>

        {/* Collisions - Bronze : simples, Silver+ : avancées */}
        <SubSection title="Collisions" emoji="💥">
          {!isSilverOrAbove ? (
            <>
              <Paragraph>
                Croiser un pac ou atterrir sur la même case va créer une <strong>collision</strong>. 
                Dans ce cas, les déplacements des pacs qui sont entrés en collision sont annulés.
                {isBronzeOrAbove && (
                  <> L'annulation d'un déplacement peut provoquer une autre collision qui sera résolue de la même manière, 
                  et ainsi de suite jusqu'à ce qu'il n'y ait plus de collisions.</>
                )}
              </Paragraph>
            </>
          ) : (
            <>
              <Paragraph>
                Croiser un pac ou atterrir sur la même case peut créer une <strong>collision</strong>. 
                Voici comment ces collisions sont résolues :
              </Paragraph>
              <NumberedList items={[
                <>Tous les pacs en mouvement se déplacent de <Const>1</Const> case, peu importe leur vitesse.</>,
                <>Si les pacs sont de même type ou appartiennent au même joueur, alors les pacs reviennent à leur position d'où ils sont partis. 
                Si les pacs sont de types différents, ils peuvent atterrir sur une même case mais un pac ne peut pas croiser le chemin d'un pac plus fort que lui : il sera alors bloqué.</>,
                <>Le fait d'annuler un déplacement peut provoquer de nouvelles collisions. Pour cette raison, l'étape précédente est répétée jusqu'à ce que plus aucune nouvelle collision ne se fasse.</>,
                <>Les pacs qui partagent la même case qu'un pac plus fort qu'eux sont tués. <Action>ROCK</Action> bat <Action>SCISSORS</Action>, <Action>SCISSORS</Action> bat <Action>PAPER</Action> et <Action>PAPER</Action> bat <Action>ROCK</Action>.</>,
                <>Répéter pour chaque pac ayant une compétence SPEED activée.</>
              ]} />
            </>
          )}
        </SubSection>

        {isGold && (
          <Section title="Combat et types" icon="⚔️" isNew>
            <Paragraph>
              Chaque pac possède un type : <Action>ROCK</Action>, <Action>PAPER</Action>{' '}
              ou <Action>SCISSORS</Action>.
            </Paragraph>
            <Spacer />
            <BulletList items={[
              <><Action>ROCK</Action> bat <Action>SCISSORS</Action></>,
              <><Action>SCISSORS</Action> bat <Action>PAPER</Action></>,
              <><Action>PAPER</Action> bat <Action>ROCK</Action></>
            ]} />
            <Spacer />
            <Paragraph>
              Quand deux pacs de types différents se retrouvent sur la même case,
              le pac battu est <strong>tué</strong> et son type devient <Action>DEAD</Action>.
            </Paragraph>
            <Spacer />
            <Paragraph>
              <strong>Résolution des collisions :</strong>
            </Paragraph>
            <NumberedList items={[
              'Tous les pacs se déplacent de 1 case',
              'Les pacs de même type ou même joueur se bloquent mutuellement',
              'Résolution itérative jusqu\'à stabilisation',
              'Les pacs sur la même case qu\'un pac plus fort sont tués',
              'Répéter pour chaque pas de vitesse (SPEED active)'
            ]} />
          </Section>
        )}

        {/* Ordre des actions - Silver et au-dessus */}
        {isSilverOrAbove && (
          <SubSection title="Ordre des actions par tour" emoji="🎬">
            <NumberedList items={[
              'Décrémenter les compteurs de temps de rechargement',
              'Décrémenter les compteurs de durée de SPEED',
              'Exécuter les compétences (SWITCH, SPEED)',
              'Résoudre les mouvements, en incluant les collisions',
              'Tuer les pacs qui ont perdu lors de collisions',
              'Ingestions de pastilles'
            ]} />
          </SubSection>
        )}

        <SubSection title="Fin du jeu" emoji="⛔">
          <Paragraph>
            La partie se termine lorsqu'il n'y a plus assez de pastilles en jeu pour changer l'issue de la partie.
            <br /><br />
            Le jeu s'arrête automatiquement après <Const>200 tours</Const>.
          </Paragraph>
          {isSilverOrAbove && (
            <>
              <Spacer />
              <Paragraph>
                Si tous les pacs d'un joueur sont morts, toutes les pastilles restantes sont automatiquement accordées aux pacs survivants et la partie se termine.
                <br /><br />
                Le gagnant est le joueur avec le meilleur score, peu importe le nombre de pacs en vie restants.
              </Paragraph>
            </>
          )}
        </SubSection>
      </Section>

      {/* Conditions */}
      <VictoryConditions>
        Vous avez mangé plus de pastilles que l'adversaire à la fin de la partie.
      </VictoryConditions>

      <LoseConditions>
        <BulletList items={[
          'Votre programme n\'a pas répondu dans le temps imparti ou l\'une des commandes est invalide'
        ]} />
      </LoseConditions>

      {/* Conseils */}
      <DebugTips tips={[
        'Survolez une case de la grille pour voir ses coordonnées',
        'Survolez un pac pour avoir des informations sur lui',
        'Rajoutez du texte à la fin d\'une commande d\'un pac pour afficher ce texte au-dessus de lui',
        'Cliquez sur la roue dentée pour afficher des options supplémentaires',
        'Utilisez le clavier pour contrôler les actions : espace pour lire/mettre en pause, les flèches pour avancer pas à pas',
        ...(isSilverOrAbove ? [
          'Gardez des cooldowns de compétences pour les urgences',
          'Utilisez SWITCH défensivement contre les types adverses',
          'SPEED est puissant pour fuir ou poursuivre'
        ] : [])
      ]} />

      {/* Détails techniques - Silver et au-dessus */}
      {isSilverOrAbove && (
        <Section title="Détails techniques" icon="⚙️">
          <Paragraph>
            Vous pouvez voir le code source de ce jeu sur{' '}
            <a href="https://github.com/CodinGame/SpringChallenge2020" target="_blank" rel="noopener noreferrer" style={{ color: '#7cc576' }}>
              ce repo GitHub
            </a>.
          </Paragraph>
        </Section>
      )}

      {/* PROTOCOLE DE JEU */}
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
            <><Variable>pacId</Variable> : l'ID du pac (unique par joueur)</>,
            <><Variable>mine</Variable> : le propriétaire du pac (1 si ce pac est à vous, 0 sinon. Converti en un type booléen pour la majorité des langages.)</>,
            <><Variable>x</Variable> & <Variable>y</Variable> : la position du pac</>,
            ...(!isSilverOrAbove ? [
              <><Variable>typeId</Variable> : inutilisé dans cette ligue</>,
              <><Variable>speedTurnsLeft</Variable> : inutilisé dans cette ligue</>,
              <><Variable>abilityCooldown</Variable> : inutilisé dans cette ligue</>
            ] : [
              <>
                <Variable>typeId</Variable> : le type de pac (<Action>ROCK</Action> ou <Action>PAPER</Action> ou <Action>SCISSORS</Action>).
                {isGold ? ' Si le pac est mort, son type est maintenant' : ' Dès la prochaine ligue, si un pac est mort, son type sera'} <Action>DEAD</Action>.
              </>,
              <><Variable>speedTurnsLeft</Variable> : le nombre de tours restants avant que l'effet du speed ne s'estompe</>,
              <><Variable>abilityCooldown</Variable> : le nombre de tours restants avant de pouvoir utiliser une compétence avec ce pac (<Action>SWITCH</Action> et <Action>SPEED</Action>)</>
            ])
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
            {isBronzeOrAbove ? (
              <>
                Une seule ligne avec une ou plusieurs commandes séparées par <Const>|</Const>. 
                Par exemple : <Action>MOVE 0 5 7 | MOVE 1 16 10</Action>.
              </>
            ) : (
              'Une seule ligne avec votre action :'
            )}
          </Paragraph>
          <BulletList items={[
            <>
              <Action>MOVE pacId x y</Action> : le pac avec l'identifiant <Const>pacId</Const> se déplace vers la case ciblée.
              {!isBronzeOrAbove && <> (<Action>pacId</Action> vaut toujours <Const>0</Const> dans cette ligue).</>}
            </>,
            ...(isSilverOrAbove ? [
              <><Action>SPEED pacId</Action> : le pac pourra se déplacer de 2 cases pendant les 5 tours suivants.</>,
              <><Action>SWITCH pacId pacType</Action> : le pac se transforme en <Variable>pacType</Variable>.</>
            ] : [])
          ]} />
        </SubSection>

        <SubSection title="Contraintes">
          {isBronzeOrAbove && (
            <>
              <Paragraph>
                <Const>2</Const> ≤ Nombre de pacs par joueur ≤ <Const>5</Const>
              </Paragraph>
              <Paragraph>
                <Const>29</Const> ≤ <Variable>width</Variable> ≤ <Const>35</Const>
              </Paragraph>
              <Paragraph>
                <Const>10</Const> ≤ <Variable>height</Variable> ≤ <Const>17</Const>
              </Paragraph>
            </>
          )}
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
