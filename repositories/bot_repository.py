"""Bot Repository - Gestion de la persistence des bots.

Responsabilité (SRP) : Accès aux données des bots uniquement.
- CRUD operations sur Bot et BotVersion
- Queries de recherche
- Pas de logique métier, pas de validation
"""
from typing import Optional, List
from models import db, Bot, BotVersion, User
from datetime import datetime


class BotRepository:
    """Repository pour la gestion de la persistence des bots.
    
    Pattern: Repository Pattern
    SOLID: SRP (une seule responsabilité - accès données)
    """
    
    @staticmethod
    def find_by_id(bot_id: int) -> Optional[Bot]:
        """Trouve un bot par son ID."""
        return Bot.query.get(bot_id)
    
    @staticmethod
    def find_by_user(user_id: int) -> List[Bot]:
        """Trouve tous les bots d'un utilisateur."""
        return Bot.query.filter_by(user_id=user_id, deleted=False).all()
    
    @staticmethod
    def find_all_active() -> List[Bot]:
        """Trouve tous les bots actifs (non supprimés)."""
        return Bot.query.filter_by(deleted=False).all()
    
    @staticmethod
    def save(bot: Bot) -> Bot:
        """Sauvegarde ou met à jour un bot."""
        db.session.add(bot)
        db.session.commit()
        return bot
    
    @staticmethod
    def delete(bot: Bot) -> None:
        """Suppression logique d'un bot."""
        bot.deleted = True
        bot.deleted_at = datetime.utcnow()
        db.session.commit()
    
    @staticmethod
    def create(user_id: int, name: str, description: str = None, 
               game_type: str = 'pacman') -> Bot:
        """Crée un nouveau bot."""
        bot = Bot(
            user_id=user_id,
            name=name,
            description=description,
            game_type=game_type
        )
        db.session.add(bot)
        db.session.commit()
        return bot
    
    @staticmethod
    def create_version(bot_id: int, code: str, version_number: int = None) -> BotVersion:
        """Crée une nouvelle version d'un bot."""
        bot = Bot.query.get(bot_id)
        if not bot:
            raise ValueError(f"Bot {bot_id} not found")
        
        if version_number is None:
            # Auto-increment version
            last_version = BotVersion.query.filter_by(bot_id=bot_id)\
                .order_by(BotVersion.version_number.desc()).first()
            version_number = (last_version.version_number + 1) if last_version else 1
        
        version = BotVersion(
            bot_id=bot_id,
            code=code,
            version_number=version_number
        )
        db.session.add(version)
        db.session.commit()
        return version
    
    @staticmethod
    def get_latest_version(bot_id: int) -> Optional[BotVersion]:
        """Récupère la dernière version d'un bot."""
        return BotVersion.query.filter_by(bot_id=bot_id)\
            .order_by(BotVersion.version_number.desc()).first()
    
    @staticmethod
    def get_version(bot_id: int, version_number: int) -> Optional[BotVersion]:
        """Récupère une version spécifique d'un bot."""
        return BotVersion.query.filter_by(
            bot_id=bot_id, 
            version_number=version_number
        ).first()
    
    @staticmethod
    def get_all_versions(bot_id: int) -> List[BotVersion]:
        """Récupère toutes les versions d'un bot."""
        return BotVersion.query.filter_by(bot_id=bot_id)\
            .order_by(BotVersion.version_number.desc()).all()
