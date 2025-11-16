import { useState, useCallback, useRef } from 'react'

/**
 * Hook pour gérer le layout avec splitters (horizontal et vertical).
 * 
 * Responsabilité (SRP): Gestion du layout des panels uniquement
 * - Ratio du panel gauche (éditeur)
 * - Ratio vertical (top/bottom)
 * - Visibilité du panel bottom
 * - Handlers pour le drag des splitters
 * 
 * @returns {Object} État et handlers du layout
 */
export function usePanelLayout() {
  // Panel ratios
  const [leftPanelRatio, setLeftPanelRatio] = useState(0.5) // 50% pour la colonne gauche
  const [rowRatio, setRowRatio] = useState(0.95) // 95% pour le visualizer, 5% pour les logs (repliés)
  const [bottomPanelVisible, setBottomPanelVisible] = useState(true)
  const [isDragging, setIsDragging] = useState(false)
  
  // Refs pour tracking du drag
  const leftContainerRef = useRef(null)
  const draggingRef = useRef(false)

  /**
   * Handler pour le drag horizontal (redimensionnement éditeur/visualizer)
   */
  const handleHorizontalDrag = useCallback((e) => {
    if (!leftContainerRef.current) return
    
    const containerRect = leftContainerRef.current.getBoundingClientRect()
    const newRatio = (e.clientX - containerRect.left) / containerRect.width
    
    // Limiter le ratio entre 0.15 et 0.85 pour éviter des panels trop petits
    const clampedRatio = Math.max(0.15, Math.min(0.85, newRatio))
    setLeftPanelRatio(clampedRatio)
  }, [])

  /**
   * Handler pour le drag vertical (redimensionnement top/bottom sections)
   */
  const handleVerticalDrag = useCallback((e, containerRef) => {
    if (!containerRef?.current) return
    
    const containerRect = containerRef.current.getBoundingClientRect()
    const newRatio = (e.clientY - containerRect.top) / containerRect.height
    
    // Limiter le ratio entre 0.2 et 0.9
    const clampedRatio = Math.max(0.2, Math.min(0.9, newRatio))
    setRowRatio(clampedRatio)
  }, [])

  /**
   * Démarre le drag
   */
  const startDrag = useCallback(() => {
    draggingRef.current = true
    setIsDragging(true)
  }, [])

  /**
   * Termine le drag
   */
  const endDrag = useCallback(() => {
    draggingRef.current = false
    setIsDragging(false)
  }, [])

  /**
   * Toggle la visibilité du panel bottom
   */
  const toggleBottomPanel = useCallback(() => {
    setBottomPanelVisible(prev => !prev)
  }, [])

  return {
    // État
    leftPanelRatio,
    rowRatio,
    bottomPanelVisible,
    isDragging,
    leftContainerRef,
    draggingRef,
    
    // Setters
    setLeftPanelRatio,
    setRowRatio,
    setBottomPanelVisible,
    
    // Handlers
    handleHorizontalDrag,
    handleVerticalDrag,
    startDrag,
    endDrag,
    toggleBottomPanel
  }
}
