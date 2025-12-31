

const DATA = window.ITINERARY_DATA;
if(!DATA || !DATA.days){
  const msg = 'Itinerary data missing. Make sure index.html loads window.ITINERARY_DATA before app.js, and save files as UTF-8.';
  document.body.innerHTML = `<div style="padding:18px;font-family:system-ui;color:#111;background:#fff">
    <h2 style="margin:0 0 8px 0;">⚠️ App failed to load</h2>
    <div>${msg}</div>
  </div>`;
  throw new Error(msg);
}

const { days, dayEmoji, startDate } = DATA;

const book = document.getElementById('book');
const jumpSelect = document.getElementById('jumpSelect');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const pageLabel = document.getElementById('pageLabel');
const printBtn = document.getElementById('printBtn');
const searchInput = document.getElementById('searchInput');
const clearSearch = document.getElementById('clearSearch');
const prevMatchBtn = document.getElementById('prevMatch');
const nextMatchBtn = document.getElementById('nextMatch');
const searchLabel = document.getElementById('searchLabel');
const themeBtn = document.getElementById('themeBtn');
const todayPill = document.getElementById('todayPill');
const mockDateInput = document.getElementById('mockDate');
const useRealTodayBtn = document.getElementById('useRealToday');

let current = 0;
let query = '';
let matchDays = [];
let matchCursor = -1;

function yenFmt(v){
  if(!v) return '';
  const s = String(v).trim();
  if(!s) return '';
  if(s.includes('¥')) return s;
  const n = Number(s.replace(/,/g,''));
  if(Number.isFinite(n)) return '¥' + n.toLocaleString('en-US');
  return s;
}
function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function highlight(text, q){
  if(!q) return escapeHtml(text);
  const safe = escapeHtml(text);
  const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'ig');
  return safe.replace(re, (m) => `<mark class="hl">${m}</mark>`);
}
function dayDateISO(dayNumber){
  // IMPORTANT: avoid toISOString() because it converts to UTC and can shift the date on non-UTC timezones.
  const base = new Date(startDate + 'T00:00:00'); // local midnight
  const d = new Date(base);
  d.setDate(base.getDate() + (dayNumber - 1));
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2,'0');
  const da = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${da}`;
}
function dayLabelWithDate(d){
  const iso = dayDateISO(d.day);
  const dt = new Date(iso + 'T00:00:00');
  const fmt = dt.toLocaleDateString(undefined, { weekday:'short', month:'short', day:'numeric' });
  return `${d.title} · ${fmt}`;
}
function getEffectiveToday(){
  const stored = localStorage.getItem('mockDate') || '';
  if(stored){
    const dt = new Date(stored + 'T00:00:00');
    if(!Number.isNaN(dt.getTime())) return dt;
  }
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}
function getTodayIndex(){
  const today = getEffectiveToday();
  const base = new Date(startDate + 'T00:00:00');
  const baseDay = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  const diffMs = today - baseDay;
  const diffDays = Math.round(diffMs / (1000*60*60*24));
  if(diffDays < 0 || diffDays >= days.length) return -1;
  return diffDays;
}

function renderDay(d, idx){
  const wrap = document.createElement('div');
  wrap.className = 'sheet';

  const head = document.createElement('div');
  head.className = 'cardHeader';

  const left = document.createElement('div');
  const title = document.createElement('div');
  title.className = 'dayTitle';
  title.textContent = `${dayEmoji[d.day] || '📍'} ${d.title}`;

  const sub = document.createElement('div');
  sub.className = 'daySub';
  sub.textContent = `${dayLabelWithDate(d)}`;
  left.appendChild(title);
  left.appendChild(sub);

  const right = document.createElement('div');
  right.className = 'pill';
  right.textContent = `${idx+1} / ${days.length}`;

  head.appendChild(left);
  head.appendChild(right);

  const tableWrap = document.createElement('div');
  tableWrap.className = 'tableWrap';

  const table = document.createElement('table');
  table.innerHTML = `
    <thead><tr>
      <th class="colTime">🕒 Time</th>
      <th>📍 Destination</th>
      <th>🚆 Notes</th>
      <th class="colYen">💴 Budget</th>
    </tr></thead>
    <tbody></tbody>
  `;

  const tbody = table.querySelector('tbody');
  d.rows.forEach(r => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="colTime timeCell">${highlight(r.time || '', query)}</td>
      <td class="destCell">${highlight(r.dest || '', query)}</td>
      <td class="notesCell">${highlight(r.notes || '', query)}</td>
      <td class="colYen yenCell">${highlight(yenFmt(r.yen), query)}</td>
    `;
    tbody.appendChild(tr);
  });

  tableWrap.appendChild(table);
  wrap.appendChild(head);
  wrap.appendChild(tableWrap);
  return wrap;
}

function renderBack(d){
  const wrap = document.createElement('div');
  wrap.className = 'sheet';

  const head = document.createElement('div');
  head.className = 'cardHeader';

  const left = document.createElement('div');
  const title = document.createElement('div');
  title.className = 'dayTitle';
  title.textContent = `📝 Notes for ${d.title}`;
  const sub = document.createElement('div');
  sub.className = 'daySub';
  sub.textContent = 'Checklist + free notes (saved in this browser)';
  left.appendChild(title);
  left.appendChild(sub);

  const right = document.createElement('div');
  right.className = 'pill';
  right.textContent = dayLabelWithDate(d);

  head.appendChild(left);
  head.appendChild(right);

  const box = document.createElement('div');
  box.className = 'tableWrap';
  box.style.padding = '14px';

  const key = `notes_day_${d.day}`;
  const saved = localStorage.getItem(key) || '';

  box.innerHTML = `
    <div style="font-weight:900;margin-bottom:8px;">Quick checklist</div>
    <div style="display:grid;gap:8px;color:#0f172a;">
      <label><input type="checkbox"> Tickets / reservations</label>
      <label><input type="checkbox"> IC card top-up</label>
      <label><input type="checkbox"> Powerbank / cables</label>
      <label><input type="checkbox"> Cash (¥) & coins</label>
      <label><input type="checkbox"> Best photo spot of the day</label>
    </div>
    <div style="height:12px"></div>
    <div style="font-weight:900;margin-bottom:8px;">Free notes</div>
    <textarea id="notesArea" style="width:100%;min-height:180px;border:1px dashed rgba(15,23,42,.25);border-radius:12px;padding:10px;background:rgba(255,255,255,.65);font:inherit;resize:vertical;">${escapeHtml(saved)}</textarea>
    <div style="height:10px"></div>
    <div style="font-size:12px;color:#475569;">Notes auto-save on this device.</div>
  `;

  wrap.appendChild(head);
  wrap.appendChild(box);

  setTimeout(()=>{
    const ta = wrap.querySelector('#notesArea');
    if(ta){
      ta.addEventListener('input', ()=> localStorage.setItem(key, ta.value));
    }
  },0);

  return wrap;
}

function buildPages(){
  book.innerHTML = '';
  days.forEach((d, i) => {
    const page = document.createElement('section');
    page.className = 'page';
    page.dataset.index = String(i);
    page.style.zIndex = String(days.length - i);

    const front = document.createElement('div');
    front.className = 'front';
    front.appendChild(renderDay(d, i));

    const back = document.createElement('div');
    back.className = 'back';
    back.appendChild(renderBack(d));

    page.appendChild(front);
    page.appendChild(back);
    book.appendChild(page);
  });
}

function refreshTodayUI(){
  const idx = getTodayIndex();
  const pages = [...document.querySelectorAll('.page')];
  pages.forEach((p, i) => p.classList.toggle('todayGlow', i === idx));

  if(idx !== -1){
    todayPill.hidden = false;
    todayPill.textContent = `Today: ${dayLabelWithDate(days[idx])}`;
  } else {
    todayPill.hidden = true;
  }

  jumpSelect.innerHTML = days.map((d,i) => {
    const emoji = dayEmoji[d.day] || '📍';
    const isToday = (i === idx);
    return `<option value="${i}">${isToday ? '⭐ ' : ''}${emoji} ${dayLabelWithDate(d)}</option>`;
  }).join('');
  jumpSelect.value = String(current);
}

function setState(newIndex){
  current = Math.max(0, Math.min(days.length - 1, newIndex));

  const pages = [...document.querySelectorAll('.page')];
  pages.forEach((p, i) => {
    p.classList.toggle('flipped', i < current);
    p.classList.toggle('active', i === current);
    p.style.zIndex = String(days.length - i + (i === current ? 100 : 0));
  });

  pageLabel.textContent = `Viewing: ${dayLabelWithDate(days[current])} (${current+1}/${days.length})`;

  // v8: on mobile single-page mode, jump to top when changing day
  if (window.matchMedia && window.matchMedia('(max-width: 520px)').matches){ window.scrollTo(0,0); }

  prevBtn.disabled = current === 0;
  nextBtn.disabled = current === days.length - 1;
  prevBtn.style.opacity = prevBtn.disabled ? .5 : 1;
  nextBtn.style.opacity = nextBtn.disabled ? .5 : 1;

  refreshTodayUI();
}

function flipNext(){ setState(current + 1); }
function flipPrev(){ setState(current - 1); }

function countAndLocateMatches(){
  if(!query) return { total: 0, days: [] };
  const q = query.toLowerCase();
  let total = 0;
  const daysWith = [];
  const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'), 'g');
  days.forEach((d, idx) => {
    const hay = d.rows.map(r => `${r.time} ${r.dest} ${r.notes} ${r.yen}`.toLowerCase()).join('\n');
    const hits = (hay.match(re) || []).length;
    if(hits > 0){
      total += hits;
      daysWith.push(idx);
    }
  });
  return { total, days: daysWith };
}

function updateMatchNav(){
  const has = query && matchDays.length > 0;
  prevMatchBtn.disabled = !has;
  nextMatchBtn.disabled = !has;
  if(!has) matchCursor = -1;
}

function goToMatch(delta){
  if(!query || matchDays.length === 0) return;

  if(matchCursor === -1){
    const pos = matchDays.findIndex(d => d >= current);
    matchCursor = (pos !== -1) ? pos : 0;
  } else {
    matchCursor = (matchCursor + delta + matchDays.length) % matchDays.length;
  }
  setState(matchDays[matchCursor]);
}

function applySearch(newQuery){
  query = newQuery.trim();
  const { total, days: dlist } = countAndLocateMatches();
  matchDays = dlist;
  updateMatchNav();

  buildPages();
  setState(current);

  if(query && total > 0){
    searchLabel.hidden = false;
    searchLabel.textContent = `Matches: ${total} · Days: ${matchDays.map(i=>i+1).join(', ')}`;
  } else if(query && total === 0){
    searchLabel.hidden = false;
    searchLabel.textContent = `No matches`;
  } else {
    searchLabel.hidden = true;
  }
  return { total };
}

function initSearch(){
  clearSearch.addEventListener('click', ()=>{
    searchInput.value = '';
    applySearch('');
    searchInput.focus();
  });

  prevMatchBtn.addEventListener('click', ()=> goToMatch(-1));
  nextMatchBtn.addEventListener('click', ()=> goToMatch(+1));

  let t = null;
  searchInput.addEventListener('input', (e)=>{
    const v = e.target.value;
    if(t) clearTimeout(t);
    t = setTimeout(()=> applySearch(v), 120);
  });

  searchInput.addEventListener('keydown', (e)=>{
    if(e.key === 'Enter'){
      const { total } = applySearch(searchInput.value);
      if(total > 0) goToMatch(+1);
    }
    if(e.key === 'Escape'){
      searchInput.value = '';
      applySearch('');
    }
  });
}

function initTheme(){
  const saved = localStorage.getItem('theme') || 'dark';
  if(saved === 'light') document.body.classList.add('light');
  themeBtn.textContent = document.body.classList.contains('light') ? '☀️' : '🌙';

  themeBtn.addEventListener('click', ()=>{
    document.body.classList.toggle('light');
    const isLight = document.body.classList.contains('light');
    localStorage.setItem('theme', isLight ? 'light' : 'dark');
    themeBtn.textContent = isLight ? '☀️' : '🌙';
  });
}

function initMockDate(){
  const stored = localStorage.getItem('mockDate') || '';
  mockDateInput.value = stored;

  mockDateInput.addEventListener('change', ()=>{
    const v = mockDateInput.value;
    if(v){
      localStorage.setItem('mockDate', v);
    } else {
      localStorage.removeItem('mockDate');
    }
    refreshTodayUI();
  });

  useRealTodayBtn.addEventListener('click', ()=>{
    mockDateInput.value = '';
    localStorage.removeItem('mockDate');
    refreshTodayUI();
  });
}

function initJump(){
  refreshTodayUI();
  jumpSelect.addEventListener('change', (e) => setState(Number(e.target.value)));
}

function initControls(){
  prevBtn.addEventListener('click', flipPrev);
  nextBtn.addEventListener('click', flipNext);
  printBtn.addEventListener('click', () => window.print());

  window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') flipNext();
    if (e.key === 'ArrowLeft') flipPrev();
    if (e.key === 'Home') setState(0);
    if (e.key === 'End') setState(days.length - 1);

    if ((e.key === 'Enter' || e.key === 'F3') && query) { e.preventDefault(); goToMatch(+1); }
    if (e.key === 'F3' && e.shiftKey && query) { e.preventDefault(); goToMatch(-1); }
  });
}

// Mobile swipe (pointer + touch) and ignore controls
function initSwipe(){
  const threshold = 34;
  let startX = null;
  let startY = null;

  function shouldIgnoreTarget(t){
    if(!t) return false;
    return !!t.closest('button, input, select, textarea, a, label');
  }

  function onStart(x, y, target){
    if(shouldIgnoreTarget(target)) return;
    startX = x;
    startY = y;
  }
  function onEnd(x, y){
    if(startX === null || startY === null) return;
    const dx = x - startX;
    const dy = y - startY;
    if(Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > threshold){
      if(dx < 0) flipNext();
      else flipPrev();
    }
    startX = null;
    startY = null;
  }

  // Pointer events (Android/modern)
  book.addEventListener('pointerdown', (e) => onStart(e.clientX, e.clientY, e.target), {passive:true});
  book.addEventListener('pointerup', (e) => onEnd(e.clientX, e.clientY), {passive:true});

  // Touch events (iOS Safari)
  book.addEventListener('touchstart', (e) => {
    const t = e.changedTouches[0];
    onStart(t.clientX, t.clientY, e.target);
  }, {passive:true});
  book.addEventListener('touchend', (e) => {
    const t = e.changedTouches[0];
    onEnd(t.clientX, t.clientY);
  }, {passive:true});
}

buildPages();
initTheme();
initMockDate();
initJump();
initSearch();
initControls();
initSwipe();
applySearch('');
setState(0);
