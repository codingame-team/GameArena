import React, {useEffect, useRef, useState} from 'react'

// BotStderrPanel: simplified dropdown (button + popup with checkboxes)
export default function BotStderrPanel({botLogs, globalStdout, globalStderr}){
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

  return (
    <div className="bot-logs">
      <div className="bot-logs-right">
          <div className="dropdown" ref={dropdownRef}>
            <button className="dropdown-toggle" onClick={() => setIsOpen(!isOpen)}>
              Filtre: {enabledFilters.length === allFilters.length ? 'Tous' : enabledFilters.join(', ')} ▾
            </button>
            {isOpen && (
              <div className="dropdown-content dropdown-content-left">
                {allFilters.map(f => (
                  <label key={f} className="dropdown-item">
                    <input type="checkbox" checked={enabledFilters.includes(f)} onChange={() => handleToggle(f)} />
                    <span style={{marginLeft:8}}>{f}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        <div className="panel">
        {enabledFilters.includes("Sortie standard") && (
          <div>
            <h4 style={{color: 'green'}}>Sortie standard:</h4>
            <pre style={{color: 'green', margin: 0}}>[Player] {playerOut}</pre>
            <pre style={{color: 'pink', margin: 0}}>[Opponent] {opponentOut}</pre>
          </div>
        )}

        {enabledFilters.includes("Sortie d'erreur") && (
          <div>
            <h4>Sortie d'erreur</h4>
            <pre>{playerErr}</pre>
          </div>
        )}

        {enabledFilters.includes("Informations de jeu") && (
          <section className="panel-section">
            <h4>Résumé du jeu</h4>
            <div className="game-info" style={{whiteSpace: 'pre-wrap', fontSize:12}}>{globalStdout || '—'}</div>
          </section>
        )}

        {enabledFilters.length === 0 && (
          <div className="empty" style={{textAlign: 'center', color: '#999', padding: '16px'}}>
            Aucune option sélectionnée
          </div>
        )}
      </div>
    </div>
  </div>
  )
}
