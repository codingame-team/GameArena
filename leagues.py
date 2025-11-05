"""Système de ligues pour GameArena.

Implémente un système progressif de difficultés inspiré du CG Spring Challenge 2020.
Chaque ligue active progressivement de nouvelles fonctionnalités.
"""
from enum import IntEnum
from typing import Dict, Any

class League(IntEnum):
    """Ligues disponibles (ordre croissant de difficulté)."""
    WOOD = 1      # Débutant : règles simplifiées
    BRONZE = 2    # Intermédiaire : multiple pacs
    SILVER = 3    # Avancé : abilities + fog
    GOLD = 4      # Expert : toutes les features
    
    @classmethod
    def from_name(cls, name: str) -> 'League':
        """Convertit un nom de ligue en enum."""
        name = name.upper()
        if name == 'WOOD':
            return cls.WOOD
        if name == 'BRONZE':
            return cls.BRONZE
        if name == 'SILVER':
            return cls.SILVER
        if name == 'GOLD':
            return cls.GOLD
        return cls.WOOD  # Default
    
    @classmethod
    def from_index(cls, index: int) -> 'League':
        """Convertit un index (1-4) en enum."""
        return cls(max(1, min(4, index)))
    
    def to_name(self) -> str:
        """Retourne le nom de la ligue."""
        return self.name.capitalize()

class LeagueRules:
    """Configuration des règles selon la ligue.
    
    Chaque ligue active progressivement de nouvelles fonctionnalités :
    - Wood (1) : Jeu simple, 1 pac, pas de fog, pas d'abilities
    - Bronze (2) : Multiple pacs, toujours pas de fog ni abilities
    - Silver (3) : + Fog of War + Abilities (SPEED, SWITCH)
    - Gold (4) : Toutes les features + dead pacs info
    """
    
    def __init__(self, league: League = League.GOLD):
        """Initialise les règles pour une ligue donnée.
        
        Args:
            league: La ligue pour laquelle configurer les règles
        """
        self.league = league
        
        # Configuration par défaut (Gold = toutes features)
        self.num_cherries = 6
        self.fog_enabled = True
        self.map_wraps = True  # Tunnels aux bords (non implémenté encore)
        self.body_block = True  # Pacs peuvent se bloquer
        self.friendly_body_block = True  # Même entre alliés
        self.speed_ability_available = True
        self.switch_ability_available = True
        self.min_pacs_per_player = 2
        self.max_pacs_per_player = 5
        self.provide_dead_pacs = True  # Info sur les pacs morts
        
        # Ajustements selon la ligue
        self._apply_league_restrictions()
    
    def _apply_league_restrictions(self):
        """Applique les restrictions selon la ligue."""
        
        # Wood League (1) : Très simplifié
        if self.league == League.WOOD:
            self.min_pacs_per_player = 1
            self.max_pacs_per_player = 1
            self.fog_enabled = False
            self.speed_ability_available = False
            self.switch_ability_available = False
            self.provide_dead_pacs = False
            self.num_cherries = 2  # Moins de cherries
        
        # Bronze League (2) : Multiple pacs mais pas d'abilities
        elif self.league == League.BRONZE:
            self.min_pacs_per_player = 2
            self.max_pacs_per_player = 3
            self.fog_enabled = False
            self.speed_ability_available = False
            self.switch_ability_available = False
            self.provide_dead_pacs = False
            self.num_cherries = 4
        
        # Silver League (3) : + Abilities + Fog mais pas dead pacs info
        elif self.league == League.SILVER:
            self.min_pacs_per_player = 3
            self.max_pacs_per_player = 4
            self.provide_dead_pacs = False
            self.num_cherries = 6
        
        # Gold League (4) : Toutes les features (config par défaut)
        elif self.league == League.GOLD:
            self.min_pacs_per_player = 3
            self.max_pacs_per_player = 5
            self.num_cherries = 8
    
    def to_dict(self) -> Dict[str, Any]:
        """Convertit les règles en dictionnaire pour sérialisation."""
        return {
            'league': self.league.to_name(),
            'league_index': int(self.league),
            'num_cherries': self.num_cherries,
            'fog_enabled': self.fog_enabled,
            'map_wraps': self.map_wraps,
            'body_block': self.body_block,
            'friendly_body_block': self.friendly_body_block,
            'speed_ability_available': self.speed_ability_available,
            'switch_ability_available': self.switch_ability_available,
            'min_pacs_per_player': self.min_pacs_per_player,
            'max_pacs_per_player': self.max_pacs_per_player,
            'provide_dead_pacs': self.provide_dead_pacs
        }
    
    def get_init_params(self, **overrides) -> Dict[str, Any]:
        """Retourne les paramètres d'initialisation pour le referee.
        
        Args:
            **overrides: Paramètres à surcharger
            
        Returns:
            Dictionnaire de configuration pour referee.init_game()
        """
        import random
        # Choisir un nombre de pacs aléatoire entre min et max pour varier les parties
        pacs_per_player = random.randint(self.min_pacs_per_player, self.max_pacs_per_player)
        
        params = {
            'num_cherries': self.num_cherries,
            'fog_enabled': self.fog_enabled,
            'pacs_per_player': pacs_per_player,
            'speed_ability_available': self.speed_ability_available,
            'switch_ability_available': self.switch_ability_available,
            'provide_dead_pacs': self.provide_dead_pacs
        }
        params.update(overrides)
        return params
    
    def __repr__(self) -> str:
        """Représentation string."""
        return f"LeagueRules({self.league.to_name()})"

class LeagueManager:
    """Gestionnaire de ligues pour les joueurs.
    
    Gère la progression des joueurs à travers les ligues basée sur leur ELO.
    """
    
    # Seuils ELO pour monter de ligue
    ELO_THRESHOLDS = {
        League.WOOD: 0,      # 0-999
        League.BRONZE: 1000,  # 1000-1499
        League.SILVER: 1500,  # 1500-1999
        League.GOLD: 2000     # 2000+
    }
    
    @classmethod
    def get_league_from_elo(cls, elo: int) -> League:
        """Détermine la ligue d'un joueur selon son ELO.
        
        Args:
            elo: Le score ELO du joueur
            
        Returns:
            La ligue correspondante
        """
        if elo >= cls.ELO_THRESHOLDS[League.GOLD]:
            return League.GOLD
        elif elo >= cls.ELO_THRESHOLDS[League.SILVER]:
            return League.SILVER
        elif elo >= cls.ELO_THRESHOLDS[League.BRONZE]:
            return League.BRONZE
        else:
            return League.WOOD
    
    @classmethod
    def get_league_name(cls, elo: int) -> str:
        """Retourne le nom de la ligue pour un ELO donné."""
        return cls.get_league_from_elo(elo).to_name()
    
    @classmethod
    def get_next_league_threshold(cls, elo: int) -> tuple[League, int]:
        """Retourne la prochaine ligue et l'ELO nécessaire.
        
        Args:
            elo: L'ELO actuel du joueur
            
        Returns:
            Tuple (prochaine_ligue, elo_requis) ou (None, None) si déjà Gold
        """
        current_league = cls.get_league_from_elo(elo)
        
        if current_league == League.GOLD:
            return None, None
        
        next_league = League(current_league + 1)
        return next_league, cls.ELO_THRESHOLDS[next_league]
    
    @classmethod
    def get_league_info(cls, elo: int) -> Dict[str, Any]:
        """Retourne des informations complètes sur la ligue actuelle.
        
        Args:
            elo: L'ELO du joueur
            
        Returns:
            Dict avec informations sur la ligue, progression, etc.
        """
        current_league = cls.get_league_from_elo(elo)
        next_league, next_threshold = cls.get_next_league_threshold(elo)
        
        # Calculer la progression dans la ligue actuelle
        current_threshold = cls.ELO_THRESHOLDS[current_league]
        
        if next_threshold:
            progress = (elo - current_threshold) / (next_threshold - current_threshold)
            progress = max(0, min(1, progress))  # Clamp entre 0 et 1
        else:
            # Gold league : pas de limite supérieure
            progress = 1.0
        
        return {
            'current_league': current_league.to_name(),
            'current_league_index': int(current_league),
            'elo': elo,
            'current_threshold': current_threshold,
            'next_league': next_league.to_name() if next_league else None,
            'next_threshold': next_threshold,
            'progress': progress,
            'progress_percent': int(progress * 100)
        }

# Configuration globale par défaut
DEFAULT_LEAGUE = League.GOLD

def get_league_rules(league: League | str | int) -> LeagueRules:
    """Factory function pour créer des règles de ligue.
    
    Args:
        league: Peut être un League enum, un nom ('wood', 'bronze', etc.) ou un index (1-4)
        
    Returns:
        LeagueRules configuré pour la ligue
        
    Examples:
        >>> rules = get_league_rules(League.WOOD)
        >>> rules = get_league_rules('bronze')
        >>> rules = get_league_rules(3)  # Silver
    """
    if isinstance(league, int):
        league = League.from_index(league)
    elif isinstance(league, str):
        league = League.from_name(league)
    
    return LeagueRules(league)


class EloCalculator:
    """Calculateur ELO pour les matchs d'arène.
    
    Utilise le système ELO standard avec K-factor adaptatif selon le nombre de parties.
    """
    
    # K-factors selon le niveau de jeu
    K_FACTOR_NOVICE = 40      # < 30 parties
    K_FACTOR_INTERMEDIATE = 30  # 30-100 parties
    K_FACTOR_EXPERT = 20      # > 100 parties
    
    # ELO de départ
    DEFAULT_ELO = 800
    
    @classmethod
    def calculate_expected_score(cls, rating_a: int, rating_b: int) -> float:
        """Calcule le score attendu pour le joueur A contre B.
        
        Args:
            rating_a: ELO du joueur A
            rating_b: ELO du joueur B
            
        Returns:
            Probabilité de victoire (0.0 à 1.0)
        """
        return 1.0 / (1.0 + 10 ** ((rating_b - rating_a) / 400.0))
    
    @classmethod
    def get_k_factor(cls, games_played: int) -> int:
        """Détermine le K-factor selon le nombre de parties jouées.
        
        Args:
            games_played: Nombre total de parties jouées
            
        Returns:
            K-factor approprié
        """
        if games_played < 30:
            return cls.K_FACTOR_NOVICE
        elif games_played < 100:
            return cls.K_FACTOR_INTERMEDIATE
        else:
            return cls.K_FACTOR_EXPERT
    
    @classmethod
    def calculate_new_ratings(cls, 
                            rating_winner: int, 
                            rating_loser: int,
                            games_winner: int = 0,
                            games_loser: int = 0,
                            is_draw: bool = False) -> tuple[int, int]:
        """Calcule les nouveaux ELO après un match.
        
        Args:
            rating_winner: ELO du gagnant (ou joueur 1 si draw)
            rating_loser: ELO du perdant (ou joueur 2 si draw)
            games_winner: Nombre de parties jouées par le gagnant
            games_loser: Nombre de parties jouées par le perdant
            is_draw: True si match nul
            
        Returns:
            Tuple (nouveau_elo_winner, nouveau_elo_loser)
        """
        # Scores réels (1 = victoire, 0.5 = nul, 0 = défaite)
        if is_draw:
            actual_score_winner = 0.5
            actual_score_loser = 0.5
        else:
            actual_score_winner = 1.0
            actual_score_loser = 0.0
        
        # Scores attendus
        expected_winner = cls.calculate_expected_score(rating_winner, rating_loser)
        expected_loser = cls.calculate_expected_score(rating_loser, rating_winner)
        
        # K-factors
        k_winner = cls.get_k_factor(games_winner)
        k_loser = cls.get_k_factor(games_loser)
        
        # Nouveaux ratings
        new_rating_winner = rating_winner + k_winner * (actual_score_winner - expected_winner)
        new_rating_loser = rating_loser + k_loser * (actual_score_loser - expected_loser)
        
        # Arrondir et s'assurer qu'on ne descend pas en dessous de 100
        new_rating_winner = max(100, round(new_rating_winner))
        new_rating_loser = max(100, round(new_rating_loser))
        
        return int(new_rating_winner), int(new_rating_loser)
    
    @classmethod
    def calculate_rating_change(cls,
                               player_rating: int,
                               opponent_rating: int,
                               player_games: int,
                               result: str) -> int:
        """Calcule le changement d'ELO pour un joueur.
        
        Args:
            player_rating: ELO actuel du joueur
            opponent_rating: ELO de l'adversaire
            player_games: Nombre de parties jouées par le joueur
            result: 'win', 'loss' ou 'draw'
            
        Returns:
            Changement d'ELO (peut être négatif)
        """
        if result == 'win':
            new_rating, _ = cls.calculate_new_ratings(
                player_rating, opponent_rating, 
                player_games, 0, 
                is_draw=False
            )
            return new_rating - player_rating
        elif result == 'loss':
            _, new_rating = cls.calculate_new_ratings(
                opponent_rating, player_rating,
                0, player_games,
                is_draw=False
            )
            return new_rating - player_rating
        elif result == 'draw':
            new_rating, _ = cls.calculate_new_ratings(
                player_rating, opponent_rating,
                player_games, 0,
                is_draw=True
            )
            return new_rating - player_rating
        else:
            return 0
