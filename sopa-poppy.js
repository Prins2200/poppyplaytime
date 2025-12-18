// Palabras (se muestra formato original, se coloca normalizado sin espacios y en mayúsculas)
const RAW_WORDS = [
  'poppy', 'yarnaby', 'kissy missy', 'huggy wuggy', 'dogday',
  'long legs', 'craftycorn', 'catnap'
];
const WORDS = RAW_WORDS.map(w=>({ display: w, key: w.toUpperCase().replace(/\s+/g,'') }));

const GRID_SIZE = 14; // Mantener sincronizado con :root --grid-size
const ABC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

const DIRS = [
  {dr:0, dc:1}, {dr:0, dc:-1},
  {dr:1, dc:0}, {dr:-1, dc:0},
  {dr:1, dc:1}, {dr:1, dc:-1}, {dr:-1, dc:1}, {dr:-1, dc:-1},
];

// Estado
let grid = [];
let state = {}; // {KEY: boolean}

// DOM
const gridEl = document.getElementById('grid');
const wordListEl = document.getElementById('wordList');
const progressEl = document.getElementById('progress');
const totalEl = document.getElementById('total');
const doneBadgeEl = document.getElementById('doneBadge');

const btnClear = document.getElementById('btn-clear');
const btnRestart = document.getElementById('btn-restart');
const btnReveal = document.getElementById('btn-reveal');

function init(){
  document.documentElement.style.setProperty('--grid-size', GRID_SIZE);
  buildEmptyGrid();
  placeAllWords();
  fillHoles();
  renderGrid();
  renderWordList();
  state = Object.fromEntries(WORDS.map(w=>[w.key,false]));
  updateProgress();
  attachInteractions();
}

function buildEmptyGrid(){
  grid = Array.from({length: GRID_SIZE}, ()=> Array.from({length: GRID_SIZE}, ()=>''));
}

function canPlace(word, r, c, dr, dc){
  for(let i=0;i<word.length;i++){
    const rr=r+dr*i, cc=c+dc*i;
    if(rr<0||rr>=GRID_SIZE||cc<0||cc>=GRID_SIZE) return false;
    if(grid[rr][cc] && grid[rr][cc]!==word[i]) return false;
  }
  return true;
}

function placeWord(word){
  const maxTries = 1000;
  for(let t=0;t<maxTries;t++){
    const {dr,dc} = DIRS[Math.floor(Math.random()*DIRS.length)];
    const r = Math.floor(Math.random()*GRID_SIZE);
    const c = Math.floor(Math.random()*GRID_SIZE);
    if(canPlace(word, r, c, dr, dc)){
      for(let i=0;i<word.length;i++){
        const rr=r+dr*i, cc=c+dc*i;
        grid[rr][cc] = word[i];
      }
      return true;
    }
  }
  return false;
}

function placeAllWords(){
  for(const {key} of [...WORDS].sort((a,b)=>b.key.length-a.key.length)){
    if(!placeWord(key)) console.warn('No se pudo ubicar', key);
  }
}

function fillHoles(){
  for(let r=0;r<GRID_SIZE;r++){
    for(let c=0;c<GRID_SIZE;c++){
      if(!grid[r][c]) grid[r][c] = ABC[Math.floor(Math.random()*ABC.length)];
    }
  }
}

function renderGrid(){
  gridEl.innerHTML = '';
  for(let r=0;r<GRID_SIZE;r++){
    for(let c=0;c<GRID_SIZE;c++){
      const d = document.createElement('div');
      d.className = 'cell';
      d.dataset.r = r; d.dataset.c = c;
      d.textContent = grid[r][c];
      gridEl.appendChild(d);
    }
  }
}

function renderWordList(){
  wordListEl.innerHTML = '';
  for(const w of WORDS){
    const li = document.createElement('li');
    li.dataset.word = w.key;
    li.innerHTML = `<span>${w.display}</span><span class="pill">${w.key.length} letras</span>`;
    wordListEl.appendChild(li);
  }
  totalEl.textContent = WORDS.length;
}

function updateProgress(){
  const count = Object.values(state).filter(Boolean).length;
  progressEl.textContent = count;
  Array.from(wordListEl.children).forEach(li=>{
    const wn = li.dataset.word; li.classList.toggle('found', !!state[wn]);
  });
  doneBadgeEl.style.display = (count === WORDS.length) ? 'inline-block' : 'none';
}

// Selección por clics, en línea recta; doble clic para confirmar
let selPath = [];
let selecting = false;

function cellFromEvent(e){
  const t = e.target.closest('.cell');
  if(!t) return null; return {r:+t.dataset.r, c:+t.dataset.c, el:t};
}
function sameLine(a,b){
  return a.r===b.r || a.c===b.c || Math.abs(a.r-b.r)===Math.abs(a.c-b.c);
}
function step(a,b){ return [Math.sign(b.r-a.r), Math.sign(b.c-a.c)]; }
function buildPath(a,b){
  const [dr,dc]=step(a,b);
  const len=Math.max(Math.abs(a.r-b.r), Math.abs(a.c-b.c))+1;
  const path=[]; for(let i=0;i<len;i++) path.push({r:a.r+dr*i,c:a.c+dc*i});
  return path;
}
function queryCell(r,c){ return gridEl.children[r*GRID_SIZE + c]; }

function clearTemp(){
  Array.from(gridEl.children).forEach(x=>x.classList.remove('path-preview','active'));
  selPath=[]; selecting=false;
}

function paintPreview(path){
  Array.from(gridEl.children).forEach(x=>x.classList.remove('path-preview','active'));
  if(!path.length) return;
  queryCell(path[0].r, path[0].c).classList.add('active');
  for(const p of path){ queryCell(p.r,p.c).classList.add('path-preview'); }
}

gridEl.addEventListener('click', e=>{
  const cell = cellFromEvent(e); if(!cell) return;
  if(!selecting){
    clearTemp(); selecting=true; selPath=[{r:cell.r,c:cell.c}];
    cell.el.classList.add('active');
    return;
  }
  const head = selPath[0];
  if(!sameLine(head, cell)) return;
  const cand = buildPath(head, cell);
  selPath = cand; paintPreview(cand);
});

gridEl.addEventListener('dblclick', e=>{
  if(!selPath.length) return;
  const text = selPath.map(p=>grid[p.r][p.c]).join('');
  const rev = [...text].reverse().join('');
  const hit = WORDS.find(w=>w.key===text||w.key===rev);
  if(hit){ confirm(hit, selPath); }
  clearTemp(); checkWin();
});

function confirm(word, path){
  for(const p of path){ queryCell(p.r,p.c).classList.add('found'); }
  state[word.key]=true;
  updateProgress();
}

function findInGrid(word){
  for(let r=0;r<GRID_SIZE;r++){
    for(let c=0;c<GRID_SIZE;c++){
      for(const {dr,dc} of DIRS){
        let ok=true; const path=[];
        for(let i=0;i<word.length;i++){
          const rr=r+dr*i, cc=c+dc*i;
          if(rr<0||rr>=GRID_SIZE||cc<0||cc>=GRID_SIZE||grid[rr][cc]!==word[i]){ ok=false; break; }
          path.push({r:rr,c:cc});
        }
        if(ok) return path;
        // inverso
        ok=true; path.length=0;
        for(let i=0;i<word.length;i++){
          const rr=r+dr*i, cc=c+dc*i;
          const ch = word[word.length-1-i];
          if(rr<0||rr>=GRID_SIZE||cc<0||cc>=GRID_SIZE||grid[rr][cc]!==ch){ ok=false; break; }
          path.push({r:rr,c:cc});
        }
        if(ok) return path;
      }
    }
  }
  return null;
}

function attachInteractions(){
  btnClear.addEventListener('click', ()=> clearTemp());
  btnRestart.addEventListener('click', ()=>{ buildEmptyGrid(); placeAllWords(); fillHoles(); renderGrid(); state = Object.fromEntries(WORDS.map(w=>[w.key,false])); updateProgress(); });
  btnReveal.addEventListener('click', ()=>{
    for(const w of WORDS){ if(state[w.key]) continue; const found = findInGrid(w.key); if(found){ confirm(w, found); } }
    checkWin(true);
  });
}

function checkWin(force=false){
  const all = Object.values(state).every(Boolean);
  if(all || force){ doneBadgeEl.style.display = 'inline-block'; }
}

// Go!
init();
