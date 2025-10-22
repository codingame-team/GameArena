import React from 'react'
import BotStderrPanel from './BotStderrPanel'

function Grid({state}){
  if(!state) return <div>No state</div>
  const width = 7
  const height = 5
  const pellets = state.pellets || []
  const pacs = state.pacs || {}
  const pelletSet = new Set(pellets.map(p=>p[0]+','+p[1]))
  return (
    <div className="grid">
      {Array.from({length:height}).map((_,y)=> (
        <div className="row" key={y}>
          {Array.from({length:width}).map((_,x)=>{
            const key = x+','+y
            let content = ''
            if(pelletSet.has(key)) content = '·'
            for(const id in pacs){
              const pos = pacs[id]
              if(pos && pos[0]===x && pos[1]===y){ content = id==='player' ? 'P' : 'O' }
            }
            return <div className={`cell ${content==='P'?'P':''} ${content==='O'?'O':''}`} key={x}>{content}</div>
          })}
        </div>
      ))}
    </div>
  )
}

export default function Visualizer({history, index}){
  const entry = history && history[index]
  const state = entry && entry.state
  const bot_logs = entry && entry.bot_logs
  return (
    <div>
      <Grid state={state} />
      <BotStderrPanel botLogs={bot_logs} />
    </div>
  )
}
