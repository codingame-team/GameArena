"""A minimal Pacman-like referee implementing a toy version of the rules from pacman.md.
This is intentionally simplified for a prototype.

RÈGLES DE DÉPLACEMENT DES PACS
==============================

1. FORMAT DES COMMANDES
----------------------
"MOVE <pac_id> <x> <y>" : Déplacer le pac vers les coordonnées absolues (x,y)
- Les commandes peuvent être séparées par ";" (seule la première commande valide est exécutée)
- Note: "STAY" n'est PLUS autorisé. Utilisez "MOVE <x> <y>" vers votre position actuelle pour rester sur place.

2. RESTRICTIONS DE DÉPLACEMENT
----------------------------
a) PAS DE DIAGONALES
   ✓ Autorisé : déplacements horizontaux ou verticaux uniquement
     - (x,y) → (x±1,y)   : un pas à gauche/droite
     - (x,y) → (x,y±1)   : un pas haut/bas
   ✗ Interdit : (x,y) → (x±1,y±1)

b) UN SEUL PAS À LA FOIS EST EFFECTUÉ
   ✓ Autorisé : déplacement d'une case par tour
   ✓ NOUVEAU : cibler une case éloignée (calcul automatique du plus court chemin)
   ✗ Interdit : pas de diagonales

c) DÉPLACEMENT VERS LA POSITION COURANTE
   ✓ Autorisé : "MOVE <x> <y>" vers votre position actuelle (le pac reste sur place)

3. COLLISIONS
------------
- Si plusieurs pacs visent la même case au même tour :
  → AUCUN des pacs impliqués ne se déplace
  → Ils restent tous sur leur position actuelle
  → Un message d'erreur est ajouté dans stderr

4. CASES OCCUPÉES
---------------
- Un pac ne peut pas se déplacer sur une case occupée par un autre pac
- EXCEPTION : Si l'occupant doit aussi se déplacer ce tour-ci

5. ORDRE D'EXÉCUTION DU TOUR
--------------------------
1. Analyse des commandes et calcul des cibles voulues
2. Pour les cibles non-adjacentes, calcul du prochain pas via BFS
3. Détection et annulation des collisions (plusieurs pacs → même case)
4. Blocage des mouvements vers les cases occupées
5. Exécution des mouvements valides et consommation des pellets

6. COMMANDES INVALIDES
--------------------
- Format invalide → le pac reste sur place
- Tentative de contrôler le pac adverse → commande ignorée
- Violation des règles → le pac reste sur place, message d'erreur
- Aucun chemin vers la cible → le pac reste sur place, message d'erreur

7. CONDITIONS DE FIN DE JEU
---------------------------
Le jeu se termine si :
- Tous les pellets ont été consommés
- Le nombre maximum de tours est atteint
- Un joueur a une avance insurmontable
  → Si score_A > score_B + pellets_restants
  → Le joueur B ne peut plus rattraper même en prenant tous les pellets restants
  → Le jeu se termine immédiatement avec A comme vainqueur

8. CONDITIONS DE DÉFAITE
-----------------------
Votre programme perd immédiatement si :
- Il n'a pas répondu dans le temps imparti (timeout)
- Une commande est invalide ou malformée
→ La partie se termine immédiatement avec une défaite pour le joueur fautif
→ L'adversaire remporte automatiquement la victoire
"""
from game_sdk import Referee
from typing import Dict, Any, Tuple

class PacmanReferee(Referee):
    def __init__(self):
        super().__init__()
        self.width = 7
        self.height = 5
        self.grid = []
        self.pellets = set()
        # self.pacs used to store owner -> (x,y)
        self.pacs = {}
        self.scores = {"player":0, "opponent":0}
        self.max_turns = 200
        # owner_map: pac_id -> owner ('player'|'opponent')
        self.owner_map = {}
        # Track if a bot has failed (timeout or invalid command causing disqualification)
        self.bot_failed = None  # Will be set to 'player' or 'opponent' if they fail

    def init_game(self, init_params: Dict[str,Any]):
        # init_params may contain width/height or custom map
        self.width = init_params.get('width', self.width)
        self.height = init_params.get('height', self.height)
        # simple empty grid (no walls) for prototype
        self.grid = [[" " for _ in range(self.width)] for _ in range(self.height)]
        # fill pellets in all floor cells
        self.pellets = set((x,y) for x in range(self.width) for y in range(self.height))
        # place pacs (for now single pac per side)
        self.pacs = {
            'player': (0,0),
            'opponent': (self.width-1, self.height-1)
        }
        # Ensure we don't place a pellet on the player's or opponent's initial cell
        try:
            self.pellets.discard(self.pacs.get('player'))
            self.pellets.discard(self.pacs.get('opponent'))
        except Exception:
            pass
        # map pac ids to owners: pac id 0 = player, 1 = opponent (keeps compatibility with make_bot_input)
        self.owner_map = {0: 'player', 1: 'opponent'}
        self.turn = 0
        self.history = []
        self.logs = []

        # Create initial history entry for turn 0 (starting state before any actions)
        initial_state = self.get_state()
        self.history.append({
            'turn': 0,
            'state': initial_state,
            'actions': {},
            'stdout': '',
            'stderr': ''
        })

    def get_protocol(self):
        return {
            'init_inputs': 'width height and the map',
            'turn_inputs': 'for each pac: id x y; for each pellet: x y value',
            'turn_output': 'MOVE <pac_id> <x> <y> (absolute coordinates). STAY is NOT allowed - use MOVE to current position to stay in place. Target can be non-adjacent; shortest path will be computed. Multiple commands may be separated by ";".',
            'constraints': {
                'max_turns': self.max_turns,
                # Increase per-bot time budget to 200ms by default to account for
                # container startup/overhead on typical developer machines.
                'time_ms': 1000
            }
        }

    def get_state(self):
        state = {
            'turn': self.turn,
            'pacs': self.pacs.copy(),
            'pellets': list(self.pellets),
            'scores': self.scores.copy()
        }
        # If the game is finished, include the winner information
        if self.is_finished():
            state['winner'] = self.get_winner()
            # Add formatted message if a bot failed (timeout or invalid command)
            if self.bot_failed:
                winner = self.get_winner()
                winner_score = self.scores.get(winner, 0)
                loser = 'opponent' if winner == 'player' else 'player'
                state['final_message'] = f"1st {winner} {winner_score}\n2nd {loser} 0 (time out)"
        else:
            state['winner'] = None
        return state

    def get_winner(self) -> str:
        """Return the winner identifier: 'player', 'opponent', or 'draw'.

        The winner is the side that has consumed the most pellets (higher score).
        """
        p = self.scores.get('player', 0)
        o = self.scores.get('opponent', 0)
        if p > o:
            return 'player'
        if o > p:
            return 'opponent'
        return 'draw'

    def is_finished(self):
        """Vérifie si le jeu est terminé.

        Le jeu se termine si :
        1. Le nombre maximum de tours est atteint
        2. Tous les pellets ont été consommés
        3. Un joueur a une avance insurmontable (nouveau)
           - Si score_joueur > score_adversaire + pellets_restants
           - L'adversaire ne peut plus rattraper même en prenant tous les pellets restants
        4. Un joueur a échoué (timeout ou commande invalide répétée)
           - Défaite immédiate pour le joueur fautif

        Returns:
            bool: True si le jeu est terminé, False sinon
        """
        # Condition de défaite : Un bot a échoué (timeout ou commande invalide)
        if self.bot_failed is not None:
            return True
        
        # Conditions classiques de fin
        if self.turn >= self.max_turns:
            return True
        if len(self.pellets) == 0:
            return True

        # Vérification de victoire anticipée par avance insurmontable
        player_score = self.scores.get('player', 0)
        opponent_score = self.scores.get('opponent', 0)
        remaining_pellets = len(self.pellets)

        # Si le joueur a une avance insurmontable
        # score_player > score_opponent + tous_les_pellets_restants
        if player_score > opponent_score + remaining_pellets:
            return True

        # Si l'adversaire a une avance insurmontable
        if opponent_score > player_score + remaining_pellets:
            return True

        return False

    def make_bot_input(self, bot_id: str) -> str:
        # CodinGame-like per-turn input:
        # Line1: my_score opponent_score
        # Line2: visible_pac_count
        # Next lines: for each visible pac: pac_id mine x y type_id speed_turns_left ability_cooldown
        # Next line: visible_pellet_count
        # Next lines: x y value
        my_score = self.scores.get('player', 0)
        opp_score = self.scores.get('opponent', 0)
        # Build pacs block (we expose both player and opponent pac)
        # Determine ownership per pac id so the 'mine' field is correct for the receiving bot
        px, py = self.pacs['player']
        ox, oy = self.pacs['opponent']
        pacs = []
        # pac id 0 = player, 1 = opponent
        # For each pac id, set mine to '1' if the owner matches bot_id, else '0'
        owner0 = self.owner_map.get(0)
        owner1 = self.owner_map.get(1)
        mine0 = '1' if owner0 == bot_id else '0'
        mine1 = '1' if owner1 == bot_id else '0'
        pacs.append(f"0 {mine0} {px} {py} 0 0 0")
        pacs.append(f"1 {mine1} {ox} {oy} 0 0 0")
        visible_pac_count = len(pacs)
        pacs_block = f"{visible_pac_count}\n" + '\n'.join(pacs) + '\n'
        # Pellets
        pellets = list(self.pellets)
        visible_pellet_count = len(pellets)
        pellet_lines = [f"{x} {y} 1" for x, y in pellets]
        pellets_block = f"{visible_pellet_count}\n" + ('\n'.join(pellet_lines) + '\n' if pellet_lines else '')
        return f"{my_score} {opp_score}\n" + pacs_block + pellets_block

    def validate_move(self, current_pos: Tuple[int, int], target_pos: Tuple[int, int]) -> Tuple[bool, Tuple[int, int]]:
        """Vérifie si un mouvement est valide et calcule le prochain pas sur le plus court chemin.

        Supporte les déplacements vers des cases non-adjacentes en utilisant BFS.
        Le Pac ne se déplace que d'une case par tour, mais peut cibler n'importe quelle case.

        Règles appliquées :
        1. Pas de déplacement en diagonale (horizontal OU vertical uniquement)
        2. Un seul pas à la fois est effectué (mais la cible peut être éloignée)
        3. Position cible doit être différente de la position actuelle
        4. Position cible doit être dans les limites de la grille
        5. Un chemin valide doit exister entre la position actuelle et la cible

        Args:
            current_pos: Position actuelle (x, y)
            target_pos: Position cible (x, y)

        Returns:
            Tuple (valide, prochaine_position):
            - valide: True si un chemin existe vers la cible
            - prochaine_position: Position de la prochaine case sur le plus court chemin,
                                 ou None si pas de chemin valide
        """
        if not current_pos or not target_pos:
            return False, None

        cx, cy = current_pos
        tx, ty = target_pos

        # Vérification des limites de la grille
        if not (0 <= tx < self.width and 0 <= ty < self.height):
            return False, None

        # Pas de déplacement vers la même case
        if (tx, ty) == (cx, cy):
            return False, None

        # Si c'est une case adjacente, vérifie que ce n'est pas en diagonale
        dx = abs(tx - cx)
        dy = abs(ty - cy)

        if dx + dy == 1:
            # Case adjacente directement accessible
            return True, target_pos

        # Pour les cases non-adjacentes, utiliser BFS pour trouver le plus court chemin
        queue = [(current_pos, [current_pos])]
        visited = {current_pos}

        while queue:
            (x, y), path = queue.pop(0)

            # Explorer les 4 directions (haut, droite, bas, gauche)
            for dir_dx, dir_dy in [(0, -1), (1, 0), (0, 1), (-1, 0)]:
                next_x, next_y = x + dir_dx, y + dir_dy
                next_pos = (next_x, next_y)

                # Vérifie si la position est valide et non visitée
                if (0 <= next_x < self.width and
                    0 <= next_y < self.height and
                    next_pos not in visited):

                    if next_pos == target_pos:
                        # Chemin trouvé! Retourner le premier pas après la position actuelle
                        return True, path[1] if len(path) > 1 else next_pos

                    visited.add(next_pos)
                    queue.append((next_pos, path + [next_pos]))

        # Aucun chemin trouvé
        return False, None

    def parse_bot_output(self, bot_id: str, output_str: str) -> str:
        # Accept either:
        #  - legacy: "MOVE x y"
        #  - new: "MOVE pac_id x y"
        # multiple commands may be separated by ';'
        # Note: STAY is NOT allowed - bot must output a MOVE command
        s = (output_str or '').strip()
        if not s:
            return ''  # No output = invalid
        # take first non-empty line
        first_line = ''
        for ln in s.splitlines():
            if ln and ln.strip():
                first_line = ln.strip()
                break
        if not first_line:
            return ''  # No valid line = invalid
        parts_line = [c.strip() for c in first_line.split(';') if c.strip()]
        normalized_cmds = []
        for cmd in parts_line:
            parts = cmd.split()
            if len(parts) == 0:
                continue
            cmd0 = parts[0].upper()
            # STAY is not allowed anymore
            if cmd0 == 'STAY':
                continue  # Skip STAY commands
            if cmd0 == 'MOVE':
                # New form: MOVE pac_id x y  (len >=4)
                if len(parts) >= 4:
                    try:
                        pid = int(parts[1])
                        tx = int(parts[2]); ty = int(parts[3])
                        normalized_cmds.append(f"MOVE {pid} {tx} {ty}")
                        continue
                    except Exception:
                        # invalid -> skip this subcommand
                        continue
                # Legacy form: MOVE x y (len==3) -> convert to using this bot's first pac id
                if len(parts) == 3:
                    try:
                        tx = int(parts[1]); ty = int(parts[2])
                        # find a pac id that belongs to this bot
                        pid = None
                        for k,v in self.owner_map.items():
                            if v == bot_id:
                                pid = k
                                break
                        if pid is None:
                            # no mapping known; fallback to 0
                            pid = 0
                        normalized_cmds.append(f"MOVE {pid} {tx} {ty}")
                        continue
                    except Exception:
                        continue
            # unknown/invalid subcommand -> ignore
            continue
        if not normalized_cmds:
            return ''  # No valid commands = invalid (will trigger error)
        return ' ; '.join(normalized_cmds)

    def step(self, actions_by_bot: Dict[str,str]) -> Tuple[Dict[str,str], str, str]:
        """Exécute un tour de jeu en traitant les actions des bots et mettant à jour l'état.

        Application des règles de déplacement (voir docstring du module) :
        1. Pas de déplacements en diagonale (horizontal OU vertical uniquement)
        2. Un seul pas à la fois est effectué (calcul automatique pour cibles éloignées)
        3. MOVE vers la position courante est autorisé (le pac reste sur place)
        4. Collisions : si plusieurs pacs visent la même case, aucun ne bouge
        5. Cases occupées : bloquées sauf si l'occupant s'en va

        Args:
            actions_by_bot: Dictionnaire {bot_id: action_string}
                bot_id: 'player' ou 'opponent'
                action_string: commande au format 'MOVE <pac_id> <x> <y>'
                Note: STAY n'est plus accepté, utilisez MOVE vers position courante

        Returns:
            Tuple (dict_état, stdout, stderr) où :
            - dict_état: État du jeu après exécution du tour
            - stdout: Messages de déplacement et consommation de pellets
            - stderr: Messages d'erreur (mouvements invalides, collisions)
        """
        stdout = ''
        stderr = ''
        # Apply actions: accept commands like 'MOVE <pac_id> <x> <y>' (possibly multiple separated by ';')
        # We'll first compute intended targets for each bot, then resolve collisions/conflicts before committing.
        new_positions = {}
        # Start from current positions
        for bot_id, pos in self.pacs.items():
            new_positions[bot_id] = pos
        # current positions copy
        curr_positions = self.pacs.copy()
        # intended target per bot (None means no move / invalid)
        intended = {bot_id: None for bot_id in self.pacs.keys()}

        # First pass: parse commands and build intended targets (do not resolve collisions yet)
        for bot_id, action in actions_by_bot.items():
            if not action:
                continue
            # split by ';' to allow multiple moves
            subcmds = [c.strip() for c in action.split(';') if c.strip()]
            for sub in subcmds:
                parts = sub.split()
                if len(parts) == 0:
                    continue
                if parts[0].upper() == 'MOVE':
                    # Expect either MOVE pac_id x y
                    if len(parts) >= 4:
                        try:
                            pid = int(parts[1])
                            tx = int(parts[2]); ty = int(parts[3])
                        except Exception as e:
                            stderr += f"{bot_id} invalid MOVE params: {sub} ({e})\n"
                            continue
                        owner = self.owner_map.get(pid)
                        if owner != bot_id:
                            # command targets a pac id that doesn't belong to this bot -> ignore
                            stderr += f"{bot_id} attempted to control pac {pid} which is owned by {owner}\n"
                            continue
                        current_pos = curr_positions.get(bot_id)

                        # Valider le mouvement et calculer le prochain pas
                        is_valid, next_step = self.validate_move(current_pos, (tx, ty))
                        if not is_valid:
                            stderr += f"{bot_id} attempted invalid move from {current_pos} to ({tx}, {ty}) - no path exists\n"
                            intended[bot_id] = None
                            break

                        # next_step contient maintenant la prochaine position sur le chemin
                        intended[bot_id] = next_step
                        break
                    else:
                        stderr += f"{bot_id} bad MOVE format: {sub}\n"
                else:
                    # STAY and all other commands are not allowed
                    stderr += f"{bot_id} invalid command: {sub} (only MOVE is allowed)\n"

        # Second pass: detect collisions where multiple bots intend the same target
        # Build mapping target -> list of bots intending it
        target_map = {}
        for b, tgt in intended.items():
            if tgt is None:
                continue
            target_map.setdefault(tgt, []).append(b)
        # For any target with multiple bots, cancel moves for all involved and record errors
        for tgt, bots in target_map.items():
            if len(bots) > 1:
                # collision: none of these bots move
                # Build human-readable participant names (capitalize)
                parts = [b.capitalize() for b in bots]
                if len(parts) == 2:
                    participants = f"{parts[0]} and {parts[1]}"
                else:
                    # Oxford-style list: A, B and C
                    participants = ', '.join(parts[:-1]) + ' and ' + parts[-1]
                # Match the user's requested phrasing (note: 'occured' spelled as requested)
                stderr += f"Collision occured between {participants} on cell {tgt}\n"
                for b in bots:
                    intended[b] = None

        # Third pass: prevent moving into a cell currently occupied by a stationary pac
        # (allowed if the occupant is moving away this turn)
        for b, tgt in list(intended.items()):
            if tgt is None:
                continue
            # if target is occupied by someone else's current pos
            occupant = None
            for other, pos in curr_positions.items():
                if other == b:
                    continue
                if pos == tgt:
                    occupant = other
                    break
            if occupant is not None:
                # check if occupant is moving away (has an intended different target)
                occ_intended = intended.get(occupant)
                # if occupant isn't moving, or occupant intends to remain in the same cell -> block
                if occ_intended is None:
                    stderr += f"{b} attempted to move pac into occupied cell {tgt} by {occupant}; did not move\n"
                    intended[b] = None

        # Commit valid moves
        for bot_id, tgt in intended.items():
            if tgt is not None:
                # find the pid belonging to this bot so we can log pac id if needed
                pid = None
                for k,v in self.owner_map.items():
                    if v == bot_id:
                        pid = k
                        break
                new_positions[bot_id] = tgt
                stdout += f"{bot_id} moves pac{pid} -> {tgt}\n"
            else:
                # if no intended move and nothing was reported yet, keep position (no-op) - some STAY logs were previously produced
                pass

        # commit positions and handle pellet consumption
        for bot_id, pos in new_positions.items():
            self.pacs[bot_id] = pos
            if pos in self.pellets:
                self.pellets.remove(pos)
                if bot_id == 'player':
                    self.scores['player'] += 1
                else:
                    self.scores['opponent'] += 1
                stdout += f"{bot_id} ate pellet at {pos}\n"
        self.turn += 1
        state = self.get_state()
        # append to history
        self.history.append({
            'turn': self.turn,
            'state': state,
            'actions': actions_by_bot.copy(),
            'stdout': stdout,
            'stderr': stderr
        })
        self.logs.append(stdout+stderr)
        return state, stdout, stderr

    def on_bot_timeout(self, bot_id: str, turn: int, reason: str = ''):
        """Handle a bot timeout/error by ending the game and awarding the win to the other side.

        We intentionally do not raise here: the server should report the finished
        game state and indicate which bot timed out. This avoids crashing the
        HTTP handler while ensuring a bot error causes an immediate loss.
        """
        # Mark the bot as failed for immediate game end
        self.bot_failed = bot_id
        
        # Set the failed bot's score to 0
        try:
            self.scores[bot_id] = 0
        except Exception:
            self.scores = {bot_id: 0}
        # Fast-forward to finished state
        self.turn = self.max_turns
        # Record in history for transparency
        try:
            self.history.append({
                'turn': self.turn,
                'state': self.get_state(),
                'actions': {},
                'stdout': '',
                'stderr': f"bot '{bot_id}' failed on turn {turn}: {reason}"
            })
        except Exception:
            pass
        # Do not raise: leaving the referee responsible for marking the game finished

