/**
 * API configuration for GameArena frontend.
 * 
 * In development, the frontend runs on Vite dev server (port 5173)
 * with proxy to Flask backend (port 3000) - no CORS issues!
 * 
 * In production, use environment variable or empty string (same origin).
 * 
 * Last updated: 2025-11-07 - Fixed CORS with proxy
 */

// En développement avec Vite: utiliser le proxy (chemin relatif)
// En production: utiliser l'URL complète ou même origine
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''

console.log('🔧 API_BASE_URL:', API_BASE_URL || '(using proxy)')

export default API_BASE_URL
