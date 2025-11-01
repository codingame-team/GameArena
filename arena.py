"""Arena system for bot matchmaking and ranking."""
from models import Bot, Match, User, db, calculate_elo_change
from datetime import datetime
import random
import logging

logger = logging.getLogger(__name__)


class ArenaManager:
    """Manages bot arena, matchmaking, and rankings."""
    
    def __init__(self, referee_type='pacman'):
        self.referee_type = referee_type
    
    def save_bot_code(self, user_id, bot_id, code):
        """Save bot code in Playground (does NOT create version).
        
        This is for work-in-progress code being edited in Monaco.
        No BotVersion is created - just updates the working draft.
        
        Args:
            user_id: ID of the user
            bot_id: ID of the bot to update
            code: New code
        
        Returns:
            tuple: (bot_dict, error_message)
        """
        if not code or len(code.strip()) < 10:
            return None, "Bot code is too short"
        
        bot = Bot.query.get(bot_id)
        if not bot:
            return None, "Bot not found"
        
        if bot.user_id != user_id:
            return None, "Unauthorized"
        
        bot.code = code
        bot.updated_at = datetime.utcnow()
        
        try:
            db.session.commit()
            return bot.to_dict(include_code=True), None
        except Exception as e:
            db.session.rollback()
            logger.exception("Error saving bot code")
            return None, f"Error saving bot code: {str(e)}"
    
    def submit_bot_to_arena(self, user_id, bot_id, version_name=None, description=''):
        """Submit bot to Arena (creates a new BotVersion).
        
        This is the explicit action of submitting code for competition.
        Creates a version record and makes bot eligible for matchmaking.
        
        Args:
            user_id: ID of the user
            bot_id: ID of the bot to submit
            version_name: Optional name for this version
            description: Optional description of changes
        
        Returns:
            tuple: (version_dict, error_message)
        """
        bot = Bot.query.get(bot_id)
        if not bot:
            return None, "Bot not found"
        
        if bot.user_id != user_id:
            return None, "Unauthorized"
        
        if not bot.code or len(bot.code.strip()) < 10:
            return None, "Bot code is too short to submit"
        
        # Create new version
        version = bot.submit_to_arena(
            code=bot.code,
            version_name=version_name,
            description=description
        )
        
        try:
            db.session.commit()
            logger.info(f"Submitted bot '{bot.name}' (id={bot.id}) to Arena as version {version.version_number}: {version.version_name}")
            
            # Launch automatic placement matches
            self._schedule_placement_matches(bot.id)
            
            return version.to_dict(include_code=True), None
        except Exception as e:
            db.session.rollback()
            logger.exception("Error submitting bot to arena")
            return None, f"Error submitting bot to arena: {str(e)}"
    
    def _schedule_placement_matches(self, new_bot_id):
        """Schedule placement matches for a newly submitted bot.
        
        This function is called automatically after arena submission.
        It creates match requests against all other active arena bots.
        The actual execution is handled asynchronously by the matchmaking system.
        
        Args:
            new_bot_id: ID of the newly submitted bot
        """
        from models import Bot
        
        new_bot = Bot.query.get(new_bot_id)
        if not new_bot:
            logger.warning(f"Cannot schedule placement matches: bot {new_bot_id} not found")
            return
        
        # Get all other active arena bots (including Boss)
        opponents = Bot.query.filter(
            Bot.id != new_bot_id,
            Bot.is_active == True,
            Bot.latest_version_number > 0
        ).all()
        
        if not opponents:
            logger.info(f"No opponents available for placement matches for bot {new_bot_id}")
            return
        
        logger.info(f"Scheduling {len(opponents)} placement matches for bot '{new_bot.name}' (ID: {new_bot_id})")
        
        # Store match requests in pending_matches table or trigger immediate execution
        # For now, we'll just log them - actual match execution will be implemented separately
        for opponent in opponents:
            logger.info(f"  → Placement match: {new_bot.name} vs {opponent.name}")
        
        # TODO: Actually trigger match execution via background worker or immediate sync execution
        # For MVP, we'll execute matches synchronously in the endpoint
    
    def create_bot(self, user_id, name, code=''):
        """Create a new bot (initial creation in Playground).
        
        Args:
            user_id: ID of the user
            name: Name of the bot
            code: Initial code (optional, can be empty template)
        
        Returns:
            tuple: (bot_dict, error_message)
        """
        if not name or len(name) < 3:
            return None, "Bot name must be at least 3 characters"
        
        # Check if user already has a bot with this name
        existing = Bot.query.filter_by(user_id=user_id, name=name).first()
        if existing:
            return None, f"You already have a bot named '{name}'"
        
        # Default template code if empty
        if not code:
            code = '''import sys

# Read initial map
width, height = map(int, input().split())
for _ in range(height):
    _ = input()

# Game loop
while True:
    # Read turn input
    my_score, opp_score = map(int, input().split())
    pac_count = int(input())
    my_pac = None
    for _ in range(pac_count):
        parts = input().split()
        pac_id, mine, x, y = int(parts[0]), parts[1] != '0', int(parts[2]), int(parts[3])
        if mine:
            my_pac = (pac_id, x, y)
    
    pellet_count = int(input())
    for _ in range(pellet_count):
        _ = input()
    
    # TODO: Implement your strategy
    if my_pac:
        pac_id, px, py = my_pac
        print(f"MOVE {pac_id} {px} {py}", flush=True)
    else:
        print("MOVE 0 3 2", flush=True)
'''
        
        bot = Bot(
            user_id=user_id,
            name=name,
            code=code,
            referee_type=self.referee_type,
            is_active=False  # Not active until first Arena submission
        )
        db.session.add(bot)
        
        try:
            db.session.commit()
            logger.info(f"Created new bot '{name}' (id={bot.id}) for user {user_id}")
            return bot.to_dict(include_code=True), None
        except Exception as e:
            db.session.rollback()
            logger.exception("Error creating bot")
            return None, f"Error creating bot: {str(e)}"
    
    def get_user_bots(self, user_id):
        """Get all bots for a user."""
        bots = Bot.query.filter_by(user_id=user_id).order_by(Bot.created_at.desc()).all()
        return [bot.to_dict() for bot in bots]
    
    def get_all_active_bots(self):
        """Get all active bots from all users (for opponent selection).
        
        Only returns bots that have been submitted to the arena
        (latest_version_number > 0).
        """
        bots = Bot.query.filter_by(is_active=True).filter(
            Bot.latest_version_number > 0
        ).order_by(Bot.elo_rating.desc()).all()
        return [bot.to_dict() for bot in bots]
    
    def get_bot(self, bot_id, include_code=False):
        """Get a specific bot."""
        bot = Bot.query.get(bot_id)
        if bot:
            return bot.to_dict(include_code=include_code)
        return None
    
    def deactivate_bot(self, bot_id, user_id):
        """Deactivate a bot (only owner can do this)."""
        bot = Bot.query.get(bot_id)
        if not bot:
            return None, "Bot not found"
        if bot.user_id != user_id:
            return None, "You don't own this bot"
        
        bot.is_active = False
        try:
            db.session.commit()
            return bot.to_dict(), None
        except Exception as e:
            db.session.rollback()
            return None, f"Error deactivating bot: {str(e)}"
    
    def find_opponent(self, bot_id):
        """Find a suitable opponent for a bot using ELO-based matchmaking.
        
        Returns:
            Bot object or None
        """
        bot = Bot.query.get(bot_id)
        if not bot:
            return None
        
        # Find active bots from different users with similar ELO (±200)
        candidates = Bot.query.filter(
            Bot.id != bot_id,
            Bot.user_id != bot.user_id,
            Bot.is_active == True,
            Bot.referee_type == bot.referee_type,
            Bot.elo_rating.between(bot.elo_rating - 200, bot.elo_rating + 200)
        ).all()
        
        if not candidates:
            # Fallback: any active bot from different user
            candidates = Bot.query.filter(
                Bot.id != bot_id,
                Bot.user_id != bot.user_id,
                Bot.is_active == True,
                Bot.referee_type == bot.referee_type
            ).all()
        
        if candidates:
            return random.choice(candidates)
        return None
    
    def create_match(self, player_bot_id, opponent_bot_id, game_id):
        """Create a match record.
        
        Returns:
            Match object
        """
        player_bot = Bot.query.get(player_bot_id)
        opponent_bot = Bot.query.get(opponent_bot_id)
        
        if not player_bot or not opponent_bot:
            return None
        
        match = Match(
            game_id=game_id,
            referee_type=self.referee_type,
            player_id=player_bot.user_id,
            opponent_id=opponent_bot.user_id,
            player_bot_id=player_bot_id,
            opponent_bot_id=opponent_bot_id,
            player_elo_before=player_bot.elo_rating,
            opponent_elo_before=opponent_bot.elo_rating
        )
        
        try:
            db.session.add(match)
            db.session.commit()
            return match
        except Exception as e:
            db.session.rollback()
            logger.exception("Error creating match")
            return None
    
    def complete_match(self, match_id, winner, player_score, opponent_score, turns):
        """Complete a match and update ELO ratings.
        
        Args:
            match_id: Match ID
            winner: 'player', 'opponent', or 'draw'
            player_score: Final score for player
            opponent_score: Final score for opponent
            turns: Number of turns played
        """
        match = Match.query.get(match_id)
        if not match:
            logger.error(f"Match {match_id} not found")
            return False
        
        # Update match results
        match.winner = winner
        match.player_score = player_score
        match.opponent_score = opponent_score
        match.turns = turns
        match.completed_at = datetime.utcnow()
        
        # Calculate ELO changes
        if winner == 'player':
            player_result = 1.0
        elif winner == 'opponent':
            player_result = 0.0
        else:  # draw
            player_result = 0.5
        
        player_elo_change = calculate_elo_change(
            match.player_elo_before,
            match.opponent_elo_before,
            player_result
        )
        opponent_elo_change = -player_elo_change if player_result != 0.5 else calculate_elo_change(
            match.opponent_elo_before,
            match.player_elo_before,
            1.0 - player_result
        )
        
        match.player_elo_after = match.player_elo_before + player_elo_change
        match.opponent_elo_after = match.opponent_elo_before + opponent_elo_change
        
        # Update bot stats
        player_bot = Bot.query.get(match.player_bot_id)
        opponent_bot = Bot.query.get(match.opponent_bot_id)
        
        if player_bot and opponent_bot:
            player_bot.elo_rating = match.player_elo_after
            player_bot.match_count += 1
            if winner == 'player':
                player_bot.win_count += 1
            
            opponent_bot.elo_rating = match.opponent_elo_after
            opponent_bot.match_count += 1
            if winner == 'opponent':
                opponent_bot.win_count += 1
        
        try:
            db.session.commit()
            logger.info(f"Match {match_id} completed: {winner} wins ({player_score}-{opponent_score})")
            return True
        except Exception as e:
            db.session.rollback()
            logger.exception("Error completing match")
            return False
    
    def get_leaderboard(self, limit=50):
        """Get top bots by ELO rating.
        
        Returns:
            List of bot dictionaries with ranking
        """
        # Get bots with minimum games (1+)
        qualified_bots = Bot.query.filter_by(
            is_active=True,
            referee_type=self.referee_type
        ).filter(
            Bot.match_count >= 1  # Minimum games to appear on leaderboard
        ).order_by(
            Bot.elo_rating.desc()
        ).limit(limit).all()
        
        # Always include Boss bot even if it has < 5 games
        boss_bot = Bot.query.filter_by(name='Boss', is_active=True).first()
        boss_included = False
        if boss_bot:
            # Check if Boss is already in qualified_bots
            boss_included = any(bot.id == boss_bot.id for bot in qualified_bots)
            if not boss_included:
                # Insert Boss at the appropriate position based on ELO
                qualified_bots = list(qualified_bots)
                qualified_bots.append(boss_bot)
                # Re-sort by ELO
                qualified_bots.sort(key=lambda b: b.elo_rating, reverse=True)
        
        leaderboard = []
        for rank, bot in enumerate(qualified_bots[:limit], 1):
            bot_dict = bot.to_dict()
            bot_dict['rank'] = rank
            # Add a flag to indicate if this is the Boss
            if bot.name == 'Boss':
                bot_dict['is_boss'] = True
            leaderboard.append(bot_dict)
        
        return leaderboard
    
    def get_match_history(self, user_id=None, bot_id=None, limit=20):
        """Get match history for a user or bot.
        
        Returns:
            List of match dictionaries
        """
        query = Match.query.filter_by(referee_type=self.referee_type)
        
        if user_id:
            query = query.filter(
                (Match.player_id == user_id) | (Match.opponent_id == user_id)
            )
        elif bot_id:
            query = query.filter(
                (Match.player_bot_id == bot_id) | (Match.opponent_bot_id == bot_id)
            )
        
        matches = query.order_by(Match.completed_at.desc()).limit(limit).all()
        return [match.to_dict() for match in matches]
