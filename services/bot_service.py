"""Bot Service - Logique métier des bots.

Responsabilité (SRP) : Gestion métier des bots uniquement.
- Validation du code bot
- Gestion des versions
- Orchestration création/mise à jour
- PAS d'accès direct DB (utilise BotRepository)
"""
import re
import logging
from typing import Optional, Dict, Any, List, Tuple
from repositories.bot_repository import BotRepository
from repositories.game_repository import GameRepository


class BotService:
    """Service pour la gestion métier des bots.
    
    Pattern: Service Layer
    SOLID: 
        - SRP (logique métier bots uniquement)
        - DIP (dépend de BotRepository abstrait, pas de SQLAlchemy)
        - OCP (extensible via héritage)
    """
    
    # Validation regex for bot actions
    ACTION_RE = re.compile(r'^(MOVE\s+-?\d+\s+-?\d+(?:\s+-?\d+)?)$', re.IGNORECASE)
    
    def __init__(self, bot_repository: BotRepository = None, 
                 game_repository: GameRepository = None):
        """Initialise le service avec dependency injection.
        
        Args:
            bot_repository: Repository pour accès données bots (DIP)
            game_repository: Repository pour persistence fichiers bots
        """
        self.bot_repo = bot_repository or BotRepository()
        self.game_repo = game_repository or GameRepository()
        self.logger = logging.getLogger(__name__)
    
    def validate_action_format(self, raw_output: str, 
                               normalized_action: str) -> Tuple[str, str]:
        """Valide le format d'une action de bot.
        
        Args:
            raw_output: Sortie brute du bot
            normalized_action: Action normalisée
            
        Returns:
            Tuple (action, error_message)
        """
        # Check if bot produced no output
        if not raw_output or not raw_output.strip():
            return normalized_action, 'no output from bot'
        
        first_line = ''
        for ln in raw_output.splitlines():
            if ln and ln.strip():
                first_line = ln.strip()
                break
        
        if not first_line:
            return normalized_action, 'no valid output from bot'
        
        if self.ACTION_RE.match(first_line):
            return normalized_action, ''
        
        return normalized_action, f'invalid action format: "{first_line}"'
    
    def validate_bot_code(self, code: str) -> Tuple[bool, str]:
        """Valide le code Python d'un bot.
        
        Args:
            code: Code Python à valider
            
        Returns:
            Tuple (is_valid, error_message)
        """
        if not code or not code.strip():
            return False, "Bot code cannot be empty"
        
        # Vérification syntaxe Python basique
        try:
            compile(code, '<string>', 'exec')
        except SyntaxError as e:
            return False, f"Syntax error: {e}"
        
        # Validations de sécurité supplémentaires pourraient être ajoutées ici
        # Ex: interdire imports dangereux, etc.
        
        return True, ""
    
    def create_bot(self, user_id: int, name: str, code: str, 
                   description: str = None, game_type: str = 'pacman') -> Dict[str, Any]:
        """Crée un nouveau bot avec validation.
        
        Args:
            user_id: ID de l'utilisateur propriétaire
            name: Nom du bot
            code: Code Python du bot
            description: Description optionnelle
            game_type: Type de jeu (défaut: pacman)
            
        Returns:
            Dictionnaire avec les informations du bot créé
            
        Raises:
            ValueError: Si la validation échoue
        """
        # Validation
        if not name or not name.strip():
            raise ValueError("Bot name is required")
        
        is_valid, error = self.validate_bot_code(code)
        if not is_valid:
            raise ValueError(f"Invalid bot code: {error}")
        
        # Création via repository
        bot = self.bot_repo.create(
            user_id=user_id,
            name=name.strip(),
            description=description,
            game_type=game_type
        )
        
        # Création première version
        version = self.bot_repo.create_version(bot.id, code, version_number=1)
        
        self.logger.info(f"Created bot {bot.id} for user {user_id}")
        
        return {
            'id': bot.id,
            'name': bot.name,
            'description': bot.description,
            'game_type': bot.game_type,
            'version': version.version_number,
            'created_at': bot.created_at.isoformat()
        }
    
    def update_bot_code(self, bot_id: int, code: str, user_id: int = None) -> Dict[str, Any]:
        """Met à jour le code d'un bot (crée une nouvelle version).
        
        Args:
            bot_id: ID du bot
            code: Nouveau code
            user_id: ID utilisateur (pour vérification propriété)
            
        Returns:
            Informations de la nouvelle version
            
        Raises:
            ValueError: Si validation échoue
            PermissionError: Si l'utilisateur n'est pas propriétaire
        """
        bot = self.bot_repo.find_by_id(bot_id)
        if not bot:
            raise ValueError(f"Bot {bot_id} not found")
        
        # Vérification propriété
        if user_id and bot.user_id != user_id:
            raise PermissionError(f"User {user_id} does not own bot {bot_id}")
        
        # Validation
        is_valid, error = self.validate_bot_code(code)
        if not is_valid:
            raise ValueError(f"Invalid bot code: {error}")
        
        # Création nouvelle version
        version = self.bot_repo.create_version(bot_id, code)
        
        self.logger.info(f"Updated bot {bot_id} to version {version.version_number}")
        
        return {
            'bot_id': bot_id,
            'version_number': version.version_number,
            'created_at': version.created_at.isoformat()
        }
    
    def get_bot_code(self, bot_id: int, version: int = None) -> Optional[str]:
        """Récupère le code d'un bot (dernière version ou version spécifique).
        
        Args:
            bot_id: ID du bot
            version: Numéro de version (None = dernière version)
            
        Returns:
            Code du bot ou None si introuvable
        """
        if version:
            bot_version = self.bot_repo.get_version(bot_id, version)
        else:
            bot_version = self.bot_repo.get_latest_version(bot_id)
        
        return bot_version.code if bot_version else None
    
    def get_user_bots(self, user_id: int) -> List[Dict[str, Any]]:
        """Récupère tous les bots d'un utilisateur.
        
        Args:
            user_id: ID de l'utilisateur
            
        Returns:
            Liste de dictionnaires avec infos bots
        """
        bots = self.bot_repo.find_by_user(user_id)
        return [{
            'id': bot.id,
            'name': bot.name,
            'description': bot.description,
            'game_type': bot.game_type,
            'latest_version': bot.latest_version_number,
            'created_at': bot.created_at.isoformat(),
            'updated_at': bot.updated_at.isoformat()
        } for bot in bots]
    
    def delete_bot(self, bot_id: int, user_id: int = None) -> None:
        """Supprime un bot (soft delete).
        
        Args:
            bot_id: ID du bot
            user_id: ID utilisateur (pour vérification propriété)
            
        Raises:
            ValueError: Si bot introuvable
            PermissionError: Si l'utilisateur n'est pas propriétaire
        """
        bot = self.bot_repo.find_by_id(bot_id)
        if not bot:
            raise ValueError(f"Bot {bot_id} not found")
        
        if user_id and bot.user_id != user_id:
            raise PermissionError(f"User {user_id} does not own bot {bot_id}")
        
        self.bot_repo.delete(bot)
        self.logger.info(f"Deleted bot {bot_id}")
