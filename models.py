"""Database models for GameArena authentication and arena system."""
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
import bcrypt

db = SQLAlchemy()

class User(db.Model):
    """User model for authentication."""
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False, index=True)
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    elo_rating = db.Column(db.Integer, default=1200)  # Starting ELO
    avatar = db.Column(db.String(50), default='my_bot')  # Avatar identifier
    
    # Relationships
    bots = db.relationship('Bot', backref='owner', lazy=True, cascade='all, delete-orphan')
    matches_as_player = db.relationship('Match', foreign_keys='Match.player_id', backref='player', lazy=True)
    matches_as_opponent = db.relationship('Match', foreign_keys='Match.opponent_id', backref='opponent', lazy=True)
    
    def set_password(self, password):
        """Hash and set password."""
        self.password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    
    def check_password(self, password):
        """Verify password against hash."""
        return bcrypt.checkpw(password.encode('utf-8'), self.password_hash.encode('utf-8'))
    
    def to_dict(self):
        """Convert user to dictionary (without sensitive data)."""
        return {
            'id': self.id,
            'username': self.username,
            'email': self.email,
            'created_at': self.created_at.isoformat(),
            'elo_rating': self.elo_rating,
            'avatar': self.avatar or 'my_bot'
        }


class Bot(db.Model):
    """Bot model for storing user bots.
    
    IMPORTANT DISTINCTION:
    - 'code': Working draft code (edited in Playground Monaco editor)
    - BotVersion records: Submitted versions for Arena competition
    
    The 'code' field contains the user's current work-in-progress.
    Only when explicitly submitted to Arena does it create a BotVersion record.
    """
    __tablename__ = 'bots'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    name = db.Column(db.String(100), nullable=False)
    code = db.Column(db.Text, nullable=False)  # Current working draft (Playground)
    referee_type = db.Column(db.String(50), default='pacman')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    elo_rating = db.Column(db.Integer, default=1200)
    match_count = db.Column(db.Integer, default=0)
    win_count = db.Column(db.Integer, default=0)
    is_active = db.Column(db.Boolean, default=True)  # Active in Arena matchmaking
    latest_version_number = db.Column(db.Integer, default=0)  # Last submitted version number
    
    # Relationships
    matches_as_player = db.relationship('Match', foreign_keys='Match.player_bot_id', backref='player_bot', lazy=True)
    matches_as_opponent = db.relationship('Match', foreign_keys='Match.opponent_bot_id', backref='opponent_bot', lazy=True)
    versions = db.relationship('BotVersion', backref='bot', lazy=True, cascade='all, delete-orphan', order_by='BotVersion.version_number.desc()')
    
    def to_dict(self, include_code=False):
        """Convert bot to dictionary."""
        result = {
            'id': self.id,
            'user_id': self.user_id,
            'owner_username': self.owner.username if self.owner else None,
            'owner_avatar': self.owner.avatar if self.owner else 'my_bot',
            'name': self.name,
            'referee_type': self.referee_type,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat(),
            'elo_rating': self.elo_rating,
            'match_count': self.match_count,
            'win_count': self.win_count,
            'win_rate': round((self.win_count / self.match_count * 100), 1) if self.match_count > 0 else 0.0,
            'is_active': self.is_active,
            'latest_version_number': self.latest_version_number,
            'has_submitted_version': self.latest_version_number > 0
        }
        if include_code:
            result['code'] = self.code
        return result
    
    def submit_to_arena(self, code=None, version_name=None, description=''):
        """Submit bot code to Arena (creates a new BotVersion).
        
        This is different from just saving code in Playground.
        Only Arena submissions create version records.
        
        Args:
            code: Code to submit (defaults to current self.code)
            version_name: Name for this version (auto-generated if None)
            description: Optional description of changes
        
        Returns:
            The created BotVersion object
        """
        code = code or self.code
        self.latest_version_number += 1
        
        # Auto-generate version name if not provided
        if not version_name:
            version_name = f"{self.owner.username}_v{self.latest_version_number}"
        
        version = BotVersion(
            bot_id=self.id,
            version_number=self.latest_version_number,
            version_name=version_name,
            code=code,
            description=description
        )
        db.session.add(version)
        
        # Mark bot as active in arena on any submission
        if not self.is_active:
            self.is_active = True
        
        self.updated_at = datetime.utcnow()
        return version
    
    def get_active_version(self):
        """Get the currently active version for Arena matches.
        
        Returns the latest submitted version.
        """
        if self.latest_version_number == 0:
            return None
        return BotVersion.query.filter_by(
            bot_id=self.id,
            version_number=self.latest_version_number
        ).first()


class BotVersion(db.Model):
    """Version history for bots submitted to Arena.
    
    IMPORTANT: BotVersion records are ONLY created when explicitly submitting to Arena.
    They represent competition-ready versions, not Playground drafts.
    
    Features:
    - Named versions (e.g., "alice_v1", "SuperBot v2.0")
    - Performance tracking per version
    - Complete audit trail of Arena submissions
    """
    __tablename__ = 'bot_versions'
    
    id = db.Column(db.Integer, primary_key=True)
    bot_id = db.Column(db.Integer, db.ForeignKey('bots.id'), nullable=False, index=True)
    version_number = db.Column(db.Integer, nullable=False)  # 1, 2, 3, etc.
    version_name = db.Column(db.String(100), nullable=False)  # User-friendly name
    code = db.Column(db.Text, nullable=False)  # Submitted code snapshot
    description = db.Column(db.String(500), default='')  # Optional change description
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Performance metrics for this specific version (if tracked separately)
    match_count = db.Column(db.Integer, default=0)
    win_count = db.Column(db.Integer, default=0)
    
    # Unique constraint: one bot cannot have duplicate version numbers
    __table_args__ = (
        db.UniqueConstraint('bot_id', 'version_number', name='unique_bot_version'),
        db.Index('idx_bot_version', 'bot_id', 'version_number'),
    )
    
    def to_dict(self, include_code=False):
        """Convert bot version to dictionary."""
        result = {
            'id': self.id,
            'bot_id': self.bot_id,
            'version_number': self.version_number,
            'version_name': self.version_name,
            'description': self.description,
            'created_at': self.created_at.isoformat(),
            'match_count': self.match_count,
            'win_count': self.win_count,
            'win_rate': round((self.win_count / self.match_count * 100), 1) if self.match_count > 0 else 0.0,
        }
        if include_code:
            result['code'] = self.code
        return result


class Match(db.Model):
    """Match model for storing game results."""
    __tablename__ = 'matches'
    
    id = db.Column(db.Integer, primary_key=True)
    game_id = db.Column(db.String(100), unique=True, nullable=False, index=True)
    referee_type = db.Column(db.String(50), default='pacman')
    
    # Players (can be null for testing matches)
    player_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True, index=True)
    opponent_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True, index=True)
    
    # Bots used in this match
    player_bot_id = db.Column(db.Integer, db.ForeignKey('bots.id'), nullable=True, index=True)
    opponent_bot_id = db.Column(db.Integer, db.ForeignKey('bots.id'), nullable=True, index=True)
    
    # Results
    winner = db.Column(db.String(20))  # 'player', 'opponent', 'draw'
    player_score = db.Column(db.Integer, default=0)
    opponent_score = db.Column(db.Integer, default=0)
    turns = db.Column(db.Integer, default=0)
    
    # ELO changes
    player_elo_before = db.Column(db.Integer)
    player_elo_after = db.Column(db.Integer)
    opponent_elo_before = db.Column(db.Integer)
    opponent_elo_after = db.Column(db.Integer)
    
    # Metadata
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    completed_at = db.Column(db.DateTime)
    is_ranked = db.Column(db.Boolean, default=True)  # Whether this match affects rankings
    
    def to_dict(self):
        """Convert match to dictionary."""
        return {
            'id': self.id,
            'game_id': self.game_id,
            'referee_type': self.referee_type,
            'player': {
                'id': self.player_id,
                'username': self.player.username if self.player else None,
                'bot_id': self.player_bot_id,
                'bot_name': self.player_bot.name if self.player_bot else None,
                'score': self.player_score,
                'elo_before': self.player_elo_before,
                'elo_after': self.player_elo_after,
            },
            'opponent': {
                'id': self.opponent_id,
                'username': self.opponent.username if self.opponent else None,
                'bot_id': self.opponent_bot_id,
                'bot_name': self.opponent_bot.name if self.opponent_bot else None,
                'score': self.opponent_score,
                'elo_before': self.opponent_elo_before,
                'elo_after': self.opponent_elo_after,
            },
            'winner': self.winner,
            'turns': self.turns,
            'created_at': self.created_at.isoformat(),
            'completed_at': self.completed_at.isoformat() if self.completed_at else None,
            'is_ranked': self.is_ranked
        }


def calculate_elo_change(rating_a, rating_b, score_a, k=32):
    """Calculate ELO rating change.
    
    Args:
        rating_a: Current ELO rating of player A
        rating_b: Current ELO rating of player B
        score_a: Actual score of player A (1.0 for win, 0.5 for draw, 0.0 for loss)
        k: K-factor (maximum rating change per game)
    
    Returns:
        Change in rating for player A (can be negative)
    """
    expected_a = 1 / (1 + 10 ** ((rating_b - rating_a) / 400))
    return round(k * (score_a - expected_a))
