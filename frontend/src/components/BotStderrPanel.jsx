import React, { useEffect, useRef, useState } from 'react'

// BotStderrPanel: simplified dropdown (button + popup with checkboxes)
export default function BotStderrPanel({ botLogs, globalStdout, globalStderr, gameState, fullHistory, isCollecting, currentIndex, onTurnClick, player1Name = 'Joueur 1', player2Name = 'Joueur 2' }) {
  const player = (botLogs && botLogs.player) || {}
  const opponent = (botLogs && botLogs.opponent) || {}
  const playerErr = player.stderr || ''
  const opponentErr = opponent.stderr || ''
  const playerOut = player.stdout || ''
  const opponentOut = opponent.stdout || ''

  // filters
  const allFilters = ['Informations de jeu', 'Sortie standard', "Sortie d'erreur"]
  const [enabledFilters, setEnabledFilters] = useState(allFilters)
  const [isOpen, setIsOpen] = useState(false)

  const dropdownRef = useRef(null)
  const turnRefs = useRef([]) // refs for each turn block to enable auto-scroll
  const turnsListRef = useRef(null) // ref to the scrollable container
  const scrollTimeoutRef = useRef(null) // debounce scroll events
  const isScrollingProgrammaticallyRef = useRef(false) // flag to prevent scroll loop

  // Auto-scroll to current turn when currentIndex changes (from Visualizer)
  useEffect(() => {
    if (currentIndex >= 0 && turnRefs.current[currentIndex]) {
      isScrollingProgrammaticallyRef.current = true
      turnRefs.current[currentIndex].scrollIntoView({ behavior: 'smooth', block: 'start' })
      // Reset flag after scroll animation completes
      setTimeout(() => {
        isScrollingProgrammaticallyRef.current = false
      }, 600) // smooth scroll takes ~500ms
    }
  }, [currentIndex])

  // Detect which turn is visible during manual scroll and sync Visualizer
  useEffect(() => {
    const container = turnsListRef.current
    if (!container || !onTurnClick) return

    const handleScroll = () => {
      // Ignore programmatic scrolls (from Visualizer updates)
      if (isScrollingProgrammaticallyRef.current) return

      // Debounce: wait until user stops scrolling
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current)
      }

      scrollTimeoutRef.current = setTimeout(() => {
        // Find which turn is closest to the center of the viewport
        const containerRect = container.getBoundingClientRect()
        const centerY = containerRect.top + containerRect.height / 2

        let closestIdx = -1
        let closestDistance = Infinity

        turnRefs.current.forEach((turnEl, idx) => {
          if (!turnEl) return
          const rect = turnEl.getBoundingClientRect()
          const turnCenterY = rect.top + rect.height / 2
          const distance = Math.abs(turnCenterY - centerY)

          if (distance < closestDistance) {
            closestDistance = distance
            closestIdx = idx
          }
        })

        // Update Visualizer if a different turn is now centered
        if (closestIdx >= 0 && closestIdx !== currentIndex) {
          onTurnClick(closestIdx)
        }
      }, 150) // debounce delay
    }

    container.addEventListener('scroll', handleScroll, { passive: true })
    return () => {
      container.removeEventListener('scroll', handleScroll)
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current)
    }
  }, [currentIndex, onTurnClick])

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleToggle = (f) => {
    setEnabledFilters(prev => prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f])
  }

  // helper: build ranking list from final collected state (not from animation state)
  const renderRanking = () => {
    // Only show ranking when the backend collection finished (isCollecting=false)
    // and we have a final state in fullHistory. This ensures the ranking appears
    // once execution+collection are done, not when the UI animation reaches the last frame.
    if (isCollecting) return null
    if (!Array.isArray(fullHistory) || fullHistory.length === 0) return null
    // find the last history entry that contains a state object
    let finalEntry = null
    for (let i = fullHistory.length - 1; i >= 0; i--) {
      const e = fullHistory[i]
      if (e && typeof e === 'object' && e.state) { finalEntry = e; break }
    }
    if (!finalEntry || !finalEntry.state || !finalEntry.state.scores || !finalEntry.state.winner) return null
    const scores = finalEntry.state.scores
    const winner = finalEntry.state.winner
    // convert to array of {id, score}
    const items = Object.keys(scores).map(id => ({ id, score: scores[id] }))
    items.sort((a, b) => b.score - a.score)
  // const winner = gameState.winner

    // Map player/opponent IDs to display names
    const getDisplayName = (id) => {
      if (id === 'player') return player1Name
      if (id === 'opponent') return player2Name
      return id
    }
    
    // Get color for player name
    const getPlayerColor = (id) => {
      if (id === 'player') return '#ff4444'  // Rouge pour Joueur 1
      if (id === 'opponent') return '#4444ff'  // Bleu pour Joueur 2
      return '#333'
    }

    // Calculate ranks considering ties (ex-aequo)
    let currentRank = 1
    const itemsWithRank = items.map((item, idx) => {
      // If same score as previous item, keep same rank
      if (idx > 0 && items[idx - 1].score === item.score) {
        // Don't increment currentRank
      } else {
        currentRank = idx + 1
      }
      return { ...item, rank: currentRank }
    })

    return (
      <div className="ranking">
        <h4>Classement final</h4>
        <ol>
          {itemsWithRank.map((it) => (
            <li key={it.id} className={"ranking-item " + (winner === it.id ? 'winner' : '')}>
              <span className="pos">{it.rank}.</span>
              <span className="name" style={{ color: getPlayerColor(it.id) }}>{getDisplayName(it.id)}</span>
              <span className="score">{it.score}</span>
            </li>
          ))}
        </ol>
        {winner === 'draw' && <div className="draw">Match nul</div>}
      </div>
    )
  }

  return (
    <div className="panel panel-split">
      <div className="panel-left">
        { /* Left column: ranking when available */}
        {renderRanking()}
      </div>

      <div className="panel-right">
        <div className="dropdown" ref={dropdownRef}>
          <button className="dropdown-toggle" onClick={() => setIsOpen(!isOpen)}>
            Filtre: {enabledFilters.length === allFilters.length ? 'Tous' : enabledFilters.join(', ')} ▾
          </button>
          {isOpen && (
            <div className="dropdown-content dropdown-content-left">
              {allFilters.map(f => (
                <label key={f} className="dropdown-item">
                  <input type="checkbox" checked={enabledFilters.includes(f)} onChange={() => handleToggle(f)} />
                  <span style={{ marginLeft: 8 }}>{f}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Display all turns from fullHistory instead of just the current turn */}
        {Array.isArray(fullHistory) && fullHistory.length > 0 && (
          <div className="turns-list" ref={turnsListRef}>
            {fullHistory.map((entry, idx) => {
              // Skip turn 0
              if (idx === 0) return null
              const isActive = idx === currentIndex
              const botLogs = entry?.bot_logs || {}
              const playerLog = botLogs.player || {}
              const opponentLog = botLogs.opponent || {}
              const playerStdout = playerLog.stdout || ''
              const opponentStdout = opponentLog.stdout || ''
              const playerStderr = playerLog.stderr || ''
              const opponentStderr = opponentLog.stderr || ''
              // Combine global stdout and global stderr so referee messages (e.g. collisions)
              // appear in the game summary panel. Preserve ordering: stdout first, then stderr.
              let summary = ''
              if (entry) {
                const gOut = entry.__global_stdout || ''
                const gErr = entry.__global_stderr || ''
                if (gOut && gErr) summary = gOut + '\n' + gErr
                else summary = gOut || gErr || ''
              }

              return (
                <div
                  key={idx+1}
                  ref={el => turnRefs.current[idx] = el}
                  className={`turn-block ${isActive ? 'turn-active' : ''}`}
                  onClick={() => onTurnClick && onTurnClick(idx)}
                  style={{ cursor: onTurnClick ? 'pointer' : 'default' }}
                >
                  <div className="turn-header">
                    <div className="turn-content">
                      {enabledFilters.includes("Sortie standard") && (
                        <div className="turn-section">
                          <div className="turn-section-title">Sortie standard :</div>
                          <pre className="turn-pre">
                            {playerStdout && `[${player1Name}] ${playerStdout}`}
                            {opponentStdout && `[${player2Name}] ${opponentStdout}`}
                            {!playerStdout && !opponentStdout && '—'}
                          </pre>
                        </div>
                      )}

                      {enabledFilters.includes("Sortie d'erreur") && (playerStderr || opponentStderr) && (
                        <div className="turn-section">
                          <div className="turn-section-title">Sortie d'erreur :</div>
                          <pre className="turn-pre">
                            {playerStderr && `[${player1Name}] ${playerStderr}`}
                            {opponentStderr && `[${player2Name}] ${opponentStderr}`}
                          </pre>
                        </div>
                      )}

                      {enabledFilters.includes("Informations de jeu") && (
                        <div className="turn-section">
                          <div className="turn-section-title">Résumé du jeu :</div>
                          <pre className="turn-pre">{summary || '—'}</pre>
                        </div>
                      )}
                    </div>

                    <div className="turn-index">{idx}/{fullHistory.length - 1}</div>
                  </div>

                  {idx < fullHistory.length - 1 && <hr className="turn-separator" />}
                </div>
              )
            })}
          </div>
        )}

        {enabledFilters.length === 0 && (
          <div className="empty" style={{ textAlign: 'center', color: '#999', padding: '16px' }}>
            Aucune option sélectionnée
          </div>
        )}
      </div>
    </div>
  )
}
