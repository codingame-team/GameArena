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
  Keyword,
  ImageBlock,
  VictoryConditions,
  LoseConditions,
  DebugTips,
  Spacer
} from './GameRules'

/**
 * Exemple complet utilisant TOUTE la syntaxe analysée de CodinGame
 * Démontre l'utilisation de tous les composants avec la syntaxe exacte des .tpl
 */

export default function CompleteGameRulesExample({ league = 'silver' }) {
  const isWood = league === 'wood'
  const isBronze = league === 'bronze'
  const isSilver = league === 'silver'
  const isGold = league === 'gold'
  
  const showForBronzeUp = ['bronze', 'silver', 'gold'].includes(league)
  const showForSilverUp = ['silver', 'gold'].includes(league)

  // Icônes de ligue selon le niveau
  const leagueIcons = {
    wood: '🪵',
    bronze: '🥉',
    silver: '🥈',
    gold: '🥇'
  }

  return (
    <RulesContainer>
      {/* LEAGUE ALERT - BEGIN level1 level2 level3 level4 */}
      {isWood && (
        <LeagueAlert 
          level="Ce challenge se déroule en ligues." 
          icon={leagueIcons.wood}
        >
          <p>
            Pour ce challenge, plusieurs versions du même jeu seront disponibles. 
            Quand vous aurez prouvé votre valeur dans la première version, vous 
            accéderez à la ligue supérieure et débloquerez de nouvelles règles.
          </p>
        </LeagueAlert>
      )}

      {isBronze && (
        <LeagueAlert 
          level="Résumé des nouvelles règles." 
          icon={leagueIcons.bronze}
        >
          <p>
            Vous pouvez maintenant contrôler <Keyword>plusieurs Pacs</Keyword> !
          </p>
          <Spacer height="10px" />
          <p>Consultez l'énoncé mis à jour pour plus de détails.</p>
        </LeagueAlert>
      )}

      {isSilver && (
        <LeagueAlert 
          level="Résumé des nouvelles règles." 
          icon={leagueIcons.silver}
        >
          <p>Toutes les règles sont maintenant débloquées !</p>
          <ul style={{ marginLeft: '20px', marginTop: '10px' }}>
            <li>Vous pouvez maintenant donner un boost de vitesse à vos pacs</li>
            <li>Vous pouvez désormais modifier le type de vos pacs</li>
            <li>Seuls les pacs et pastilles qui sont dans votre ligne de mire sont visibles</li>
          </ul>
          <Spacer height="10px" />
          <p>Consultez l'énoncé mis à jour pour plus de détails.</p>
        </LeagueAlert>
      )}

      {isGold && (
        <LeagueAlert 
          level="Résumé des nouvelles règles." 
          icon={leagueIcons.gold}
        >
          <p>
            Vous pouvez maintenant voir les pacs qui sont morts.
          </p>
          <Spacer height="10px" />
          <p>Consultez l'énoncé mis à jour pour plus de détails.</p>
        </LeagueAlert>
      )}

      {/* GOAL */}
      <Section title="Objectif" icon="🎯">
        <Paragraph>
          Manger plus de pastilles que votre adversaire !
          {showForSilverUp && <> Et éviter de se faire tuer !</>}
        </Paragraph>

        {/* Images conditionnelles par ligue (comme dans le .tpl) */}
        <ImageBlock
          src={
            isWood ? "https://example.com/wood.png" :
            isBronze ? "https://example.com/bronze.png" :
            "https://example.com/silver-gold.png"
          }
          alt="Objectif du jeu"
          caption={
            isWood ? "Un pac mange des pastilles" :
            isBronze ? "Plusieurs pacs en action" :
            "Combat entre pacs avec compétences"
          }
          width="60%"
        />
      </Section>

      {/* RULES */}
      <Section title="Règles" icon="📖">
        <Paragraph>
          Le jeu se joue sur une grille qui vous est donnée au début de chaque partie. 
          La grille est composée de murs et de sol.
          {isWood && (
            <> Dans cette première ligue, chaque joueur contrôle un seul pac qui peut 
            bouger dans la grille.</>
          )}
          {showForBronzeUp && (
            <> Chaque joueur contrôle une équipe de pacs qui peuvent bouger dans la grille.</>
          )}
        </Paragraph>

        <SubSection title="La grille" emoji="🗺️">
          <Paragraph>
            La grille est générée aléatoirement, et possède une taille{' '}
            <Variable>width</Variable>, <Variable>height</Variable>.
          </Paragraph>
          <Spacer />
          
          <Paragraph>Chaque cellule de la grille est soit :</Paragraph>
          <BulletList items={[
            <>Un mur (représenté par le caractère croisillon <Action>#</Action>)</>,
            <>Du sol (représenté par un espace <Action>&nbsp;</Action>)</>
          ]} />

          <Spacer />
          
          <Paragraph>
            Les grilles sont toujours <strong>symétriques</strong> par rapport à l'axe 
            vertical central. La plupart des grilles ont des cases de type sol sur les 
            extrémités gauche et droite ; les pacs peuvent{' '}
            <strong>faire le tour de la grille</strong> et apparaître de l'autre côté 
            en passant par ces cases.
          </Paragraph>

          <Spacer />

          <Paragraph>
            Quand le jeu démarre, la grille est remplie de <strong>pastilles</strong> et 
            d'occasionnelles <strong>super-pastilles</strong>.
            {isWood && (
              <> Manger une pastille avec votre <strong>pac</strong> vous rapporte{' '}
              <Const>1 point</Const>.</>
            )}
            {showForBronzeUp && (
              <> Manger une pastille avec l'un de vos <strong>pacs</strong> vous rapporte{' '}
              <Const>1 point</Const>.</>
            )}
            {' '}Les super-pastilles valent <Const>10 points</Const>. Une fois mangée, 
            une pastille disparaît.
          </Paragraph>

          <ImageBlock
            src="https://example.com/pellets.png"
            alt="Pastilles et super-pastilles"
            caption={
              <>
                Une pastille rapporte <Const>1 point</Const> et une super-pastille 
                rapporte <Const>10 points</Const>.
              </>
            }
            width="400px"
          />
        </SubSection>

        <SubSection title="Les Pacs" emoji="🔵🔴">
          {/* BEGIN level1 */}
          {isWood && (
            <>
              <Paragraph>
                Chaque joueur contrôle un pac. Mais dans les ligues suivantes, vous 
                contrôlerez jusqu'à <Const>5</Const> pacs chacun.
              </Paragraph>
              <Spacer />
            </>
          )}

          {/* BEGIN level2 - statement-new-league-rule */}
          {showForBronzeUp && (
            <Section title="" icon="" isNew={isBronze}>
              <Paragraph>
                Chaque joueur commence avec le même nombre de pacs, jusqu'à{' '}
                <Const>5</Const> chacun.
              </Paragraph>
            </Section>
          )}

          <Spacer />

          {/* BEGIN level1 level2 */}
          {(isWood || isBronze) && (
            <>
              <Paragraph>
                Vous avez la vision sur l'ensemble des pastilles et des pacs sur la 
                grille (ceci changera dans une ligue prochaine).
              </Paragraph>
              <Spacer />
            </>
          )}

          {/* BEGIN level3 - statement-new-league-rule */}
          {showForSilverUp && (
            <Section title="" icon="" isNew={isSilver}>
              <Paragraph>
                Vos pacs <strong>ne voient pas à travers les murs</strong>. À chaque tour, 
                vous voyez toutes les pastilles et les pacs ennemis qui peuvent être reliés 
                à vos pacs par une ligne droite continue. Les super-pastilles sont en 
                revanche si brillantes qu'elles sont visibles depuis n'importe où !
              </Paragraph>

              <ImageBlock
                src="https://example.com/vision.png"
                alt="Vision limitée"
                caption="La ligne de vision des pacs est bloquée par les murs."
                width="400px"
              />
            </Section>
          )}

          <Paragraph>
            À chaque tour, vous recevez les informations relatives aux pacs et pastilles 
            qui sont visibles. Pour chaque pac vous avez son identifiant, s'il vous 
            appartient ou non, ainsi que ses coordonnées. Pour chaque pastille vous avez 
            leurs coordonnées et leur valeur.
          </Paragraph>

          <Spacer />

          {/* Types de pacs - BEGIN level3 */}
          {showForSilverUp && (
            <Section title="" icon="" isNew={isSilver}>
              {isSilver && (
                <Paragraph>
                  Chaque pac possède un <Variable>type</Variable> donné (
                  <Action>ROCK</Action>, <Action>PAPER</Action> ou{' '}
                  <Action>SCISSORS</Action>). Dès la prochaine ligue, le type d'un pac 
                  mort sera <Action>DEAD</Action>.
                </Paragraph>
              )}
              
              {isGold && (
                <Paragraph>
                  Chaque pac possède un <Variable>type</Variable> donné (
                  <Action>ROCK</Action>, <Action>PAPER</Action> ou{' '}
                  <Action>SCISSORS</Action>). Le type d'un pac mort est{' '}
                  <Action>DEAD</Action>.
                </Paragraph>
              )}

              <Paragraph>
                Chaque pac a accès à deux <strong>compétences</strong> (
                <Action>SWITCH</Action> et <Action>SPEED</Action>) qui partagent le même{' '}
                <strong>temps de rechargement</strong> de <Const>10</Const> tours. Les 
                compétences d'un pac sont déjà disponibles au début de la partie.
              </Paragraph>
            </Section>
          )}

          <Spacer />

          {/* Commandes */}
          {isWood && (
            <Paragraph>Les pacs peuvent recevoir la commande suivante :</Paragraph>
          )}
          {showForBronzeUp && (
            <Paragraph>
              Les pacs peuvent recevoir les commandes suivantes (un pac ne peut recevoir 
              qu'une commande par tour) :
            </Paragraph>
          )}

          <BulletList items={[
            <>
              <Action>MOVE</Action> : Donne au pac une case cible, le pac va choisir le 
              plus court chemin vers cette position et va effectuer{' '}
              <strong>le premier déplacement de ce chemin</strong>. Le pac ne prend pas 
              en compte la présence de pastilles ou d'autres pacs lorsqu'il choisit un 
              chemin.
              
              <ImageBlock
                src="https://example.com/move.png"
                alt="Commande MOVE"
                caption={
                  <>
                    Chaque pac ayant reçu une action <Action>MOVE</Action> avancera vers 
                    la destination en faisant un pas vers le haut, le bas, la droite ou 
                    la gauche.
                  </>
                }
                width="400px"
              />
            </>
          ]} />

          {showForSilverUp && (
            <>
              <BulletList items={[
                <>
                  <Action>SWITCH</Action> : Si les compétences du pac sont disponibles, 
                  celui-ci va se transformer en un nouveau type de pac. Les types de pacs 
                  disponibles sont :
                  <ul style={{ marginLeft: '20px', marginTop: '5px' }}>
                    <li><Action>ROCK</Action></li>
                    <li><Action>PAPER</Action></li>
                    <li><Action>SCISSORS</Action></li>
                  </ul>
                  
                  <ImageBlock
                    src="https://example.com/switch.png"
                    alt="Commande SWITCH"
                    caption={
                      <>
                        L'action <Action>SWITCH</Action> permet à un pac de changer de type.
                      </>
                    }
                    width="400px"
                  />
                </>,
                <>
                  <Action>SPEED</Action> : Si les compétences du pac sont disponibles, 
                  celui-ci va accélérer pendant les <Const>5</Const> prochains tours, lui 
                  permettant d'avancer de <strong>2 pas</strong> lors de ses mouvements. 
                  Cela veut dire que le pac peut se déplacer deux fois plus vite que 
                  d'habitude à chaque tour.
                  
                  <ImageBlock
                    src="https://example.com/speed.png"
                    alt="Commande SPEED"
                    caption={
                      <>
                        L'action <Action>SPEED</Action> permet à un pac de se déplacer de 
                        2 coups au lieu d'un seul pendant les 5 prochains tours.
                      </>
                    }
                    width="400px"
                  />
                </>
              ]} />
            </>
          )}

          <Paragraph>
            Référez-vous à la section <strong>Protocole de jeu</strong> pour plus 
            d'informations sur les commandes à envoyer à vos pacs.
          </Paragraph>

          <Spacer />

          {/* Collisions - BEGIN level1 level2 */}
          {(isWood || isBronze) && (
            <>
              <Paragraph>
                Croiser un pac ou atterrir sur la même case va créer une{' '}
                <strong>collision</strong>. Dans ce cas, les déplacements des pacs qui 
                sont entrés en collision sont annulés.
                {isBronze && (
                  <Section title="" icon="" isNew={true}>
                    <Paragraph>
                      L'annulation d'un déplacement peut provoquer une autre collision qui 
                      sera résolue de la même manière, et ainsi de suite jusqu'à ce qu'il 
                      n'y ait plus de collisions.
                    </Paragraph>
                  </Section>
                )}
              </Paragraph>
              <Spacer />
            </>
          )}

          {/* Collisions avancées - BEGIN level3 */}
          {showForSilverUp && (
            <Section title="" icon="" isNew={isSilver}>
              <Paragraph>
                Croiser un pac ou atterrir sur la même case peut créer une{' '}
                <strong>collision</strong>. Voici comment ces collisions sont résolues :
              </Paragraph>
              
              <NumberedList items={[
                <>Tous les pacs en mouvement se déplacent de <Const>1</Const> case, peu 
                importe leur vitesse.</>,
                <>Si les pacs sont de même type ou appartiennent au même joueur, alors les 
                pacs reviennent à leur position d'où ils sont partis. Si les pacs sont de 
                types différents, ils peuvent atterrir sur une même case mais un pac ne 
                peut pas croiser le chemin d'un pac plus fort que lui : il sera alors 
                bloqué.</>,
                <>Le fait d'annuler un déplacement peut provoquer de nouvelles collisions. 
                Pour cette raison, l'étape précédente est répétée jusqu'à ce que plus 
                aucune nouvelle collision ne se fasse.</>,
                <>Les pacs qui partagent la même case qu'un pac plus fort qu'eux sont tués. 
                <Action>ROCK</Action> bat <Action>SCISSORS</Action>,{' '}
                <Action>SCISSORS</Action> bat <Action>PAPER</Action> et{' '}
                <Action>PAPER</Action> bat <Action>ROCK</Action>.</>,
                <>Répéter pour chaque pac ayant une compétence SPEED activée.</>
              ]} />
            </Section>
          )}
        </SubSection>

        {/* Ordre des actions - BEGIN level3 level4 level5 */}
        {showForSilverUp && (
          <SubSection title="Ordre des actions pour un tour de jeu" emoji="🎬">
            <NumberedList items={[
              'Décrémenter les compteurs de temps de rechargement',
              <>Décrémenter les compteurs de durée de <Action>SPEED</Action></>,
              'Exécuter les compétences',
              'Résoudre les mouvements, en incluant les collisions',
              'Tuer les pacs qui ont perdu lors de collisions',
              'Ingestions de pastilles'
            ]} />
          </SubSection>
        )}

        <SubSection title="Fin du jeu" emoji="⛔">
          <Paragraph>
            La partie se termine lorsqu'il n'y a plus assez de pastilles en jeu pour 
            changer l'issue de la partie.
          </Paragraph>
          <Spacer />
          <Paragraph>
            Le jeu s'arrête automatiquement après <Const>200 tours</Const>.
          </Paragraph>

          {showForSilverUp && (
            <Section title="" icon="" isNew={isSilver}>
              <Paragraph>
                Si tous les pacs d'un joueur sont morts, toutes les pastilles restantes 
                sont automatiquement accordées aux pacs survivants et la partie se termine.
              </Paragraph>
              <Spacer />
              <Paragraph>
                Le gagnant est le joueur avec le meilleur score, peu importe le nombre de 
                pacs en vie restants.
              </Paragraph>
            </Section>
          )}
        </SubSection>

        {/* Victory / Lose conditions */}
        <VictoryConditions>
          Vous avez mangé plus de pastilles que l'adversaire à la fin de la partie.
        </VictoryConditions>

        <LoseConditions>
          Votre programme n'a pas répondu dans le temps imparti ou l'une des commandes 
          est invalide.
        </LoseConditions>

        {/* Debug tips */}
        <DebugTips tips={[
          'Survolez une case de la grille pour voir ses coordonnées',
          'Survolez un pac pour avoir des informations sur lui',
          'Rajoutez du texte à la fin d\'une commande d\'un pac pour afficher ce texte au-dessus de lui',
          'Cliquez sur la roue dentée pour afficher des options supplémentaires',
          'Utilisez le clavier pour contrôler les actions : espace pour lire/mettre en pause, les flèches pour avancer pas à pas'
        ]} />
      </Section>
    </RulesContainer>
  )
}
