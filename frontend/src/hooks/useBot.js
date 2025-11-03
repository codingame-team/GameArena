/**
 * useBot Hook - Gestion de l'état et des opérations sur les bots
 * 
 * Responsabilité (SRP): Logique métier bots côté client uniquement
 * Pattern: Custom Hook (React)
 * SOLID: Séparation entre UI et logique, réutilisable
 */

import { useState, useEffect, useCallback } from 'react';
import { botApi } from '../services/botApi';

/**
 * Hook personnalisé pour gérer les bots
 * 
 * @param {number|null} botId - ID du bot à charger (optionnel)
 * @param {boolean} autoLoad - Charge automatiquement le bot au montage
 * @returns {Object} État et méthodes pour gérer les bots
 */
export function useBot(botId = null, autoLoad = true) {
  // État
  const [bot, setBot] = useState(null);
  const [code, setCode] = useState('');
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [saveStatus, setSaveStatus] = useState('idle'); // 'idle' | 'saving' | 'saved' | 'error'

  /**
   * Charge un bot par son ID
   */
  const loadBot = useCallback(async (id) => {
    setLoading(true);
    setError(null);
    try {
      const data = await botApi.getBot(id);
      setBot(data);
      setCode(data.code || '');
      return data;
    } catch (err) {
      setError(err.message);
      console.error('Failed to load bot:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Sauvegarde le code du bot (debounced via caller)
   */
  const saveBot = useCallback(async (id, newCode) => {
    setSaveStatus('saving');
    setError(null);
    try {
      const data = await botApi.saveBot(id, newCode);
      setBot(data.bot);
      setSaveStatus('saved');
      
      // Reset status après 2 secondes
      setTimeout(() => setSaveStatus('idle'), 2000);
      
      return data;
    } catch (err) {
      setError(err.message);
      setSaveStatus('error');
      console.error('Failed to save bot:', err);
      return null;
    }
  }, []);

  /**
   * Crée un nouveau bot
   */
  const createBot = useCallback(async (name, initialCode = '') => {
    setLoading(true);
    setError(null);
    try {
      const data = await botApi.createBot(name, initialCode);
      setBot(data.bot);
      setCode(initialCode);
      return data.bot;
    } catch (err) {
      setError(err.message);
      console.error('Failed to create bot:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Soumet le bot à l'arène (crée une version)
   */
  const submitToArena = useCallback(async (id) => {
    setLoading(true);
    setError(null);
    try {
      const data = await botApi.submitToArena(id);
      // Recharger le bot pour mettre à jour la version
      await loadBot(id);
      return data;
    } catch (err) {
      setError(err.message);
      console.error('Failed to submit bot:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, [loadBot]);

  /**
   * Charge les versions du bot
   */
  const loadVersions = useCallback(async (id) => {
    setLoading(true);
    setError(null);
    try {
      const data = await botApi.getBotVersions(id);
      setVersions(data.versions || []);
      return data.versions;
    } catch (err) {
      setError(err.message);
      console.error('Failed to load versions:', err);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Charge une version spécifique dans l'éditeur
   */
  const loadVersion = useCallback(async (id, versionNumber) => {
    setLoading(true);
    setError(null);
    try {
      const data = await botApi.loadBotVersion(id, versionNumber);
      setCode(data.code || '');
      return data;
    } catch (err) {
      setError(err.message);
      console.error('Failed to load version:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Rollback vers une version antérieure
   */
  const rollback = useCallback(async (id, versionNumber) => {
    setLoading(true);
    setError(null);
    try {
      const data = await botApi.rollbackBot(id, versionNumber);
      // Recharger le bot
      await loadBot(id);
      return data;
    } catch (err) {
      setError(err.message);
      console.error('Failed to rollback:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, [loadBot]);

  /**
   * Désactive le bot de l'arène
   */
  const deactivate = useCallback(async (id) => {
    setLoading(true);
    setError(null);
    try {
      const data = await botApi.deactivateBot(id);
      await loadBot(id);
      return data;
    } catch (err) {
      setError(err.message);
      console.error('Failed to deactivate bot:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, [loadBot]);

  // Auto-load au montage si botId fourni
  useEffect(() => {
    if (autoLoad && botId) {
      loadBot(botId);
    }
  }, [botId, autoLoad, loadBot]);

  return {
    // État
    bot,
    code,
    setCode,
    versions,
    loading,
    error,
    saveStatus,
    
    // Méthodes
    loadBot,
    saveBot,
    createBot,
    submitToArena,
    loadVersions,
    loadVersion,
    rollback,
    deactivate
  };
}

export default useBot;
