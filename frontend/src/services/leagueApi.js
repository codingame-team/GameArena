/**
 * League API Service - Abstraction des appels API liés aux ligues
 * 
 * Responsabilité (SRP): Communication avec le backend pour les ligues uniquement
 * Pattern: Service Layer (frontend)
 * SOLID: Séparation entre composants UI et logique réseau
 */

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3000';

/**
 * Récupère le token JWT depuis localStorage
 */
const getAuthHeader = () => {
  const token = localStorage.getItem('token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
};

/**
 * Gestion centralisée des erreurs API
 */
const handleApiError = async (response) => {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Network error' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }
  return response.json();
};

export const leagueApi = {
  /**
   * Récupère toutes les ligues disponibles avec leurs règles
   * @returns {Promise<{leagues: Array}>}
   */
  async getAllLeagues() {
    const response = await fetch(`${API_BASE}/api/leagues`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    return handleApiError(response);
  },

  /**
   * Récupère les informations de ligue de l'utilisateur connecté
   * Nécessite authentification JWT
   * @returns {Promise<{current_league: string, elo: number, progress_percent: number, ...}>}
   */
  async getUserLeague() {
    const response = await fetch(`${API_BASE}/api/user/league`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader()
      }
    });
    return handleApiError(response);
  },

  /**
   * Récupère le leaderboard avec filtrage optionnel par ligue
   * @param {Object} options - Options de filtrage
   * @param {string} options.league - Nom de la ligue (wood, bronze, silver, gold) - optionnel
   * @param {number} options.limit - Nombre de résultats (défaut 100)
   * @returns {Promise<{leaderboard: Array}>}
   */
  async getLeaderboard({ league = null, limit = 100 } = {}) {
    const params = new URLSearchParams();
    if (league) {
      params.append('league', league);
    }
    params.append('limit', limit.toString());

    const response = await fetch(`${API_BASE}/api/leaderboard?${params.toString()}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader()
      }
    });
    return handleApiError(response);
  }
};

/**
 * Constantes utiles pour les ligues
 * Mise à jour: 5 ligues (Wood2, Wood1, Bronze, Silver, Gold)
 */
export const LEAGUE_CONFIG = {
  leagues: [
    { name: 'Wood2', displayName: 'Wood 2', emoji: '🌱', index: 1, color: '#6B4423' },
    { name: 'Wood1', displayName: 'Wood 1', emoji: '🪵', index: 2, color: '#8B4513' },
    { name: 'Bronze', displayName: 'Bronze', emoji: '🥉', index: 3, color: '#CD7F32' },
    { name: 'Silver', displayName: 'Silver', emoji: '🥈', index: 4, color: '#C0C0C0' },
    { name: 'Gold', displayName: 'Gold', emoji: '🥇', index: 5, color: '#FFD700' }
  ],

  /**
   * Récupère la config d'une ligue par son nom
   * @param {string} leagueName - Nom de la ligue (supporte Wood/Wood2/Wood1)
   * @returns {Object|null}
   */
  getByName(leagueName) {
    const normalized = leagueName.toLowerCase().replace(/\s+/g, '');
    
    // Rétrocompatibilité: "Wood" -> "Wood2"
    if (normalized === 'wood') {
      return this.leagues.find(l => l.name === 'Wood2');
    }
    
    return this.leagues.find(l => 
      l.name.toLowerCase() === normalized || 
      l.displayName.toLowerCase().replace(/\s+/g, '') === normalized
    );
  },

  /**
   * Récupère la config d'une ligue par son index
   * @param {number} index - Index de la ligue (1-5)
   * @returns {Object|null}
   */
  getByIndex(index) {
    return this.leagues.find(l => l.index === index);
  }
};
