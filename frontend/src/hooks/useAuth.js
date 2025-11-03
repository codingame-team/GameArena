/**
 * useAuth Hook - Gestion de l'authentification
 * 
 * Responsabilité (SRP): Logique d'authentification uniquement
 * Pattern: Custom Hook (React)
 * SOLID: Séparation entre UI et logique auth, réutilisable
 */

import { useState, useEffect, useCallback } from 'react';
import { userApi } from '../services/userApi';

/**
 * Hook personnalisé pour gérer l'authentification
 * 
 * @returns {Object} État et méthodes pour gérer l'authentification
 */
export function useAuth() {
  // État
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  /**
   * Vérifie si un token existe et charge le profil
   */
  const checkAuth = useCallback(async () => {
    const token = localStorage.getItem('authToken');
    if (!token) {
      setIsAuthenticated(false);
      setLoading(false);
      return false;
    }

    try {
      const profile = await userApi.getProfile();
      setUser(profile);
      setIsAuthenticated(true);
      return true;
    } catch (err) {
      console.error('Auth check failed:', err);
      // Token invalide, le supprimer
      localStorage.removeItem('authToken');
      setIsAuthenticated(false);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Connexion utilisateur
   */
  const login = useCallback(async (username, password) => {
    setLoading(true);
    setError(null);
    try {
      const data = await userApi.login(username, password);
      
      // Sauvegarder le token
      localStorage.setItem('authToken', data.access_token);
      
      // Charger le profil
      await checkAuth();
      
      return { success: true };
    } catch (err) {
      setError(err.message);
      console.error('Login failed:', err);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, [checkAuth]);

  /**
   * Inscription utilisateur
   */
  const register = useCallback(async (username, email, password) => {
    setLoading(true);
    setError(null);
    try {
      const data = await userApi.register(username, email, password);
      
      // Sauvegarder le token
      localStorage.setItem('authToken', data.access_token);
      
      // Charger le profil
      await checkAuth();
      
      return { success: true };
    } catch (err) {
      setError(err.message);
      console.error('Registration failed:', err);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, [checkAuth]);

  /**
   * Déconnexion
   */
  const logout = useCallback(() => {
    localStorage.removeItem('authToken');
    setUser(null);
    setIsAuthenticated(false);
    setError(null);
  }, []);

  /**
   * Met à jour l'avatar
   */
  const updateAvatar = useCallback(async (avatarId) => {
    setError(null);
    try {
      await userApi.updateAvatar(avatarId);
      // Recharger le profil
      await checkAuth();
      return { success: true };
    } catch (err) {
      setError(err.message);
      console.error('Failed to update avatar:', err);
      return { success: false, error: err.message };
    }
  }, [checkAuth]);

  /**
   * Upload un avatar personnalisé
   */
  const uploadAvatar = useCallback(async (file) => {
    setError(null);
    try {
      await userApi.uploadAvatar(file);
      // Recharger le profil
      await checkAuth();
      return { success: true };
    } catch (err) {
      setError(err.message);
      console.error('Failed to upload avatar:', err);
      return { success: false, error: err.message };
    }
  }, [checkAuth]);

  /**
   * Récupère l'URL de l'avatar
   */
  const getAvatarUrl = useCallback((userId = null) => {
    if (userId) {
      return userApi.getUserAvatarImageUrl(userId);
    }
    return userApi.getAvatarImageUrl();
  }, []);

  // Vérifier l'auth au montage
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  return {
    // État
    user,
    isAuthenticated,
    loading,
    error,
    
    // Méthodes
    login,
    register,
    logout,
    checkAuth,
    updateAvatar,
    uploadAvatar,
    getAvatarUrl
  };
}

export default useAuth;
