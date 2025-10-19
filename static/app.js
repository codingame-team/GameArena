// Minimal frontend to interact with the Flask backend prototype

let currentGameId = null;
let history = [];
let currentIndex = -1;
let playInterval = null;

async function fetchProtocol(){
  const res = await fetch('/api/referees');
  const data = await res.json();
  document.getElementById('protocol').textContent = JSON.stringify(data, null, 2);
}

async function startGame(){
  const code = document.getElementById('editor').value;
  const res = await fetch('/api/games', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({referee:'pacman', player_code: code})
  });
  const data = await res.json();
  currentGameId = data.game_id;
  document.getElementById('logs').textContent = `Started game ${currentGameId}`;
  // fetch initial history
  await fetchHistory();
}

async function stepGame(){
  if(!currentGameId){ alert('start a game first'); return; }
  const res = await fetch(`/api/games/${currentGameId}/step`, {method:'POST'});
  const data = await res.json();
  document.getElementById('logs').textContent = (document.getElementById('logs').textContent || '') + '\n' + (data.stdout||'') + (data.stderr||'');
  await fetchHistory();
}

async function fetchHistory(){
  if(!currentGameId) return;
  const res = await fetch(`/api/games/${currentGameId}/history`);
  const data = await res.json();
  history = data.history || [];
  if(history.length>0){ currentIndex = history.length-1; }
  renderCurrent();
}

function renderCurrent(){
  const viz = document.getElementById('visualizer');
  viz.innerHTML = '';
  if(currentIndex<0 || currentIndex>=history.length){ viz.textContent = 'No state yet'; return; }
  const entry = history[currentIndex];
  const state = entry.state;
  document.getElementById('turnInfo').textContent = 'Turn: '+state.turn;
  // render grid as table
  const w = state.pellets.reduce((max, p)=> Math.max(max, p[0]), 0) + 1 || 7;
  const h = state.pellets.reduce((max, p)=> Math.max(max, p[1]), 0) + 1 || 5;
  const table = document.createElement('div');
  table.className = 'grid';
  // compute dimensions from referee initial size if available
  const width = 7; const height = 5;
  for(let y=0;y<height;y++){
    const row = document.createElement('div'); row.className='row';
    for(let x=0;x<width;x++){
      const cell = document.createElement('div');
      cell.className='cell';
      const pelletPresent = state.pellets.some(p=>p[0]===x && p[1]===y);
      if(pelletPresent) cell.textContent='·';
      // pacs
      for(const id in state.pacs){
        const pos = state.pacs[id];
        if(pos[0]===x && pos[1]===y){
          cell.textContent = id==='player' ? 'P' : 'O';
          cell.classList.add(id);
        }
      }
      row.appendChild(cell);
    }
    table.appendChild(row);
  }
  viz.appendChild(table);
  // logs
  document.getElementById('botio').textContent = JSON.stringify(entry.bot_logs, null, 2);
}

function prev(){ if(currentIndex>0){ currentIndex--; renderCurrent(); }}
function next(){ if(currentIndex<history.length-1){ currentIndex++; renderCurrent(); }}

function togglePlay(){
  if(playInterval){ clearInterval(playInterval); playInterval = null; document.getElementById('playBtn').textContent='Play'; return; }
  document.getElementById('playBtn').textContent='Pause';
  playInterval = setInterval(async ()=>{ await stepGame(); }, 600);
}

window.addEventListener('load', ()=>{
  fetchProtocol();
  document.getElementById('startBtn').addEventListener('click', startGame);
  document.getElementById('stepBtn').addEventListener('click', stepGame);
  document.getElementById('historyBtn').addEventListener('click', fetchHistory);
  document.getElementById('prevBtn').addEventListener('click', ()=>{ prev(); });
  document.getElementById('nextBtn').addEventListener('click', ()=>{ next(); });
  document.getElementById('playBtn').addEventListener('click', togglePlay);
});

