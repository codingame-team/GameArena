/**
 * API configuration for GameArena frontend.
 * 
 * In development, the frontend runs on Vite dev server (port 5173)
 * but the API is on Flask server (port 3000).
 */

// Use environment variable if available, otherwise default to Flask dev server
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:3000'

export default API_BASE_URL
