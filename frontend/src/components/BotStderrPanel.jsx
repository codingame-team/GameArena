import React, {useEffect, useRef} from 'react'

export default function BotStderrPanel({botLogs}){
  const player = (botLogs && botLogs.player) || {}
  const opponent = (botLogs && botLogs.opponent) || {}
  const playerErr = player.stderr || ''
  const opponentErr = opponent.stderr || ''
  const playerOut = player.stdout || ''
  const opponentOut = opponent.stdout || ''
  const playerMeta = `${player.runner || ''}${player.path ? ' • ' + player.path : ''}${player.parsed ? ' • parsed' : ''}`
  const opponentMeta = `${opponent.runner || ''}${opponent.path ? ' • ' + opponent.path : ''}${opponent.parsed ? ' • parsed' : ''}`

  const playerErrRef = useRef(null)
  const playerOutRef = useRef(null)
  const opponentErrRef = useRef(null)
  const opponentOutRef = useRef(null)

  useEffect(()=>{
    if(playerErrRef.current) playerErrRef.current.scrollTop = playerErrRef.current.scrollHeight
  }, [playerErr])
  useEffect(()=>{
    if(playerOutRef.current) playerOutRef.current.scrollTop = playerOutRef.current.scrollHeight
  }, [playerOut])
  useEffect(()=>{
    if(opponentErrRef.current) opponentErrRef.current.scrollTop = opponentErrRef.current.scrollHeight
  }, [opponentErr])
  useEffect(()=>{
    if(opponentOutRef.current) opponentOutRef.current.scrollTop = opponentOutRef.current.scrollHeight
  }, [opponentOut])

  return (
    <div className="bot-logs">
      <div className="panel">
        <h4>Player</h4>
        <div style={{fontSize:12, color:'#ddd', marginBottom:6}}>{playerMeta}</div>
        <div>
          <strong>stderr</strong>
          <pre ref={playerErrRef} className="logs player">{playerErr}</pre>
        </div>
        <div>
          <strong>stdout</strong>
          <pre ref={playerOutRef} className="logs">{playerOut}</pre>
        </div>
      </div>
      <div className="panel">
        <h4>Opponent</h4>
        <div style={{fontSize:12, color:'#ddd', marginBottom:6}}>{opponentMeta}</div>
        <div>
          <strong>stderr</strong>
          <pre ref={opponentErrRef} className="logs opponent">{opponentErr}</pre>
        </div>
        <div>
          <strong>stdout</strong>
          <pre ref={opponentOutRef} className="logs">{opponentOut}</pre>
        </div>
      </div>
    </div>
  )
}
