// ─────────────────────────────────────────────────────
// NEUROPLANR — checkin.js
// Check-in tiles, track tab, week strip, mood grid.
// Reads: AppState (for display)
// Writes: Storage + AppState.todayCI / energy / mood / cyclePhase / meds
// ─────────────────────────────────────────────────────

// ── TILE DEFINITIONS ──
// Master list of all possible tiles.
// popId maps to the popup element id in index.html.
// appStateKey maps the tile value into AppState when logged.
const CI_TILE_DEFS = [
  { name: 'Energy level',  popId: 'p-energy',      label: 'energy',       appStateKey: 'energy'      },
  { name: 'Mood',          popId: 'p-mood',         label: 'mood',         appStateKey: 'mood'        },
  { name: 'Cycle phase',   popId: 'p-cycle',        label: 'cycle phase',  appStateKey: 'cyclePhase'  },
  { name: 'Medication',    popId: 'p-meds',         label: 'meds',         appStateKey: 'meds'        },
  { name: 'Sleep quality', popId: 'p-sleep',        label: 'sleep',        appStateKey: null          },
  { name: 'Stress level',  popId: 'p-stress',       label: 'stress',       appStateKey: null          },
  { name: 'Period only',   popId: 'p-period',       label: 'period',       appStateKey: null          },
  { name: 'Supplements',   popId: 'p-supplements',  label: 'supplements',  appStateKey: null          },
  { name: 'Therapy / CBT', popId: 'p-therapy',      label: 'therapy',      appStateKey: null          },
  { name: 'Exercise',      popId: 'p-exercise',     label: 'exercise',     appStateKey: null          },
];

// Active tiles for this session — populated by renderCITiles()
let _activeTiles = [];

// ── RENDER TILES from saved onboarding selection ──
function renderCITiles() {
  const saved = Storage.getCheckInTiles();
  // always include energy and mood — they power app logic
  const mustHave = ['Energy level', 'Mood'];
  const tileNames = saved.length
    ? [...new Set([...mustHave, ...saved])]
    : [...mustHave, 'Cycle phase', 'Medication']; // sensible defaults for new users

  // build active tile list in definition order
  _activeTiles = CI_TILE_DEFS.filter(d => tileNames.includes(d.name));
  console.log('[neuroplanr] renderCITiles — saved:', saved, '→ active:', _activeTiles.map(t => t.name));

  // ── render home screen compact dots ──
  const checkin = document.querySelector('.checkin');
  console.log('[neuroplanr] .checkin element found:', !!checkin);
  if (checkin) {
    checkin.innerHTML = '';
    _activeTiles.forEach((tile, idx) => {
      const div = document.createElement('div');
      div.className = 'ci';
      div.onclick = () => showCIpop(idx);
      div.innerHTML = `<div class="ci-v" id="civ${idx}">—</div><div class="ci-l" id="cil${idx}">${tile.label}</div>`;
      checkin.appendChild(div);
    });
  }

  // ── render track tab full tile grid ──
  const grid = document.getElementById('tciGrid');
  if (grid) {
    grid.innerHTML = '';
    _activeTiles.forEach((tile, idx) => {
      const div = document.createElement('div');
      div.className = 'tci-tile';
      div.id = 'ttile-' + idx;
      div.onclick = () => showCIpop(idx);
      div.innerHTML = `<div class="tci-label">${tile.label}</div><div class="tci-val" id="ttv-${idx}">tap to log</div>`;
      grid.appendChild(div);
    });
  }

  // update hint
  const hint = document.getElementById('ciHint');
  if (hint) hint.textContent = `log all ${_activeTiles.length} to complete today's check-in`;
}

// ── SHOW POPUP for tile at index ──
function showCIpop(idx) {
  const tile = _activeTiles[idx];
  if (!tile) return;
  // patch setCIval index into popup buttons for this tile
  const pop = document.getElementById(tile.popId);
  if (!pop) return;
  pop.querySelectorAll('.popt').forEach(btn => {
    const onclickAttr = btn.getAttribute('onclick');
    if (onclickAttr) {
      // replace the placeholder index (-1) with the real idx
      btn.setAttribute('onclick', onclickAttr.replace(/setCIval\([^,]+,/, `setCIval(${idx},`));
    }
  });
  showPop(tile.popId);
}

function setCIval(idx, val, color, btn) {
  updateCIDisplay(idx, val, color);

  // Write to Storage
  const ci = Storage.getTodayCI();
  ci[idx] = { val, color };
  Storage.saveTodayCI(ci);
  Storage.saveCIDay(new Date().toDateString());

  // Write to AppState using the tile's appStateKey
  AppState.todayCI = ci;
  const tile = _activeTiles[idx];
  if (tile?.appStateKey) AppState[tile.appStateKey] = val;
  updateDerivedState();

  updateCIStatus();
  saveCIToHistory(idx, val, color);

  if (btn) {
    const parent = btn.closest('.pop-opts,.ph-grid');
    if (parent) parent.querySelectorAll('.popt,.ph-btn').forEach(b => b.classList.remove('on'));
    btn.classList.add('on');
  }
}

function saveCIToHistory(idx, val, color) {
  const today = new Date().toDateString();
  const hist = Storage.getCIHistory();
  if (!hist[today]) hist[today] = {};
  hist[today][idx] = { val, color };
  Storage.saveCIHistory(hist);
}

function updateCIDisplay(idx, val, color) {
  const hv = document.getElementById('civ' + idx);
  if (hv) { hv.textContent = val; hv.style.color = color; }
  const tv = document.getElementById('ttv-' + idx);
  const tile = document.getElementById('ttile-' + idx);
  if (tv) { tv.textContent = val; tv.style.color = color; }
  if (tile) tile.classList.add('set');
}

function updateCIStatus() {
  const ci = Storage.getTodayCI();
  const done  = Object.keys(ci).length;
  const total = _activeTiles.length || 4;
  const el    = document.getElementById('ciStatus');
  const hint  = document.getElementById('ciHint');
  if (done >= total) {
    if (el) { el.textContent = 'complete ✓'; el.style.color = 'var(--ga)'; }
    if (hint) hint.textContent = 'all logged for today — great work.';
    const lastDay = Storage.getLastCIDay();
    const today = new Date().toDateString();
    if (lastDay !== today) {
      const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
      const streak = lastDay === yesterday.toDateString() ? Storage.getCIStreak() + 1 : 1;
      Storage.saveCIStreak(streak);
      Storage.saveLastCIDay(today);
      AppState.ciStreak = streak;
      setEl('streakCI', streak);
      setEl('statStreak', streak);
    }
  } else {
    if (el) { el.textContent = done + '/' + total + ' logged'; el.style.color = 'var(--t3)'; }
    if (hint) hint.textContent = (total - done) + ' more to complete today\'s check-in';
  }
}

// ── TRACK TAB ──
function refreshTrackTab() {
  const today = new Date().toDateString();
  if (Storage.getCIDay() === today) {
    const ci = Storage.getTodayCI();
    Object.keys(ci).forEach(idx => updateCIDisplay(parseInt(idx), ci[idx].val, ci[idx].color));
  }
  updateCIStatus();
  setEl('streakCI',    AppState.ciStreak);
  setEl('streakTasks', AppState.tasksDoneCount);
  setEl('streakBrain', AppState.brainTasksCount);
  rebuildWeekStrip();
  rebuildMoodGrid();

  const dumps = Storage.getDumps();
  const inbox = document.getElementById('dumpInbox');
  if (inbox) {
    inbox.innerHTML = '';
    if (dumps.length) dumps.forEach(d => renderDumpItem(d, inbox));
    else inbox.innerHTML = '<div style="text-align:center;padding:24px;font-size:13px;color:var(--t3);font-style:italic">your brain dump inbox is empty</div>';
  }
}

// ── WEEK STRIP (7-day energy + mood dots) ──
function rebuildWeekStrip() {
  const strip = document.getElementById('weekStrip');
  if (!strip) return;
  strip.innerHTML = '';
  const hist = Storage.getCIHistory();
  const today = new Date();
  const energyColor = { high: 'var(--ga)', med: 'var(--ru)', low: 'var(--tl)' };
  const moodColor   = { '+': 'var(--ga)', '~': 'var(--ru)', '–': 'var(--te)' };
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(today.getDate() - i);
    const key = d.toDateString();
    const isToday = i === 0;
    const dayCI = hist[key] || {};
    const ec = energyColor[dayCI[0]?.val] || 'var(--bg3)';
    const mc = moodColor[dayCI[2]?.val]   || 'var(--bg3)';
    const div = document.createElement('div');
    div.className = 'wday-s' + (isToday ? ' active' : '');
    div.innerHTML = `<span class="wday-l">${['M','T','W','T','F','S','S'][d.getDay()]}</span><span class="wday-d">${d.getDate()}</span><div class="wday-dots-s"><div class="wdot-s" style="background:${ec}"></div><div class="wdot-s" style="background:${mc}"></div></div>`;
    strip.appendChild(div);
  }
}

// ── MOOD GRID (14-day) ──
function rebuildMoodGrid() {
  const grid = document.getElementById('moodGrid');
  if (!grid) return;
  grid.innerHTML = '';
  const hist = Storage.getCIHistory();
  const moodColor = { '+': 'var(--ga)', '~': 'var(--ru)', '–': 'var(--te)' };
  const today = new Date();
  for (let i = 13; i >= 0; i--) {
    const d = new Date(); d.setDate(today.getDate() - i);
    const key = d.toDateString();
    const mVal = (hist[key] || {})[2]?.val;
    const cell = document.createElement('div');
    cell.className = 'mc-cell';
    cell.style.background = moodColor[mVal] || 'var(--bg3)';
    cell.title = d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + (mVal ? ' · ' + mVal : ' · not logged');
    grid.appendChild(cell);
  }
}    ? [...new Set([...mustHave, ...saved])]
    : mustHave;

  // build active tile list in definition order
  _activeTiles = CI_TILE_DEFS.filter(d => tileNames.includes(d.name));

  grid.innerHTML = '';
  _activeTiles.forEach((tile, idx) => {
    const div = document.createElement('div');
    div.className = 'tci-tile';
    div.id = 'ttile-' + idx;
    div.onclick = () => showCIpop(idx);
    div.innerHTML = `<div class="tci-label">${tile.label}</div><div class="tci-val" id="ttv-${idx}">tap to log</div>`;
    grid.appendChild(div);
  });

  // update hint to reflect tile count
  const hint = document.getElementById('ciHint');
  if (hint) hint.textContent = `log all ${_activeTiles.length} to complete today's check-in`;
}

// ── SHOW POPUP for tile at index ──
function showCIpop(idx) {
  const tile = _activeTiles[idx];
  if (!tile) return;
  // patch setCIval index into popup buttons for this tile
  const pop = document.getElementById(tile.popId);
  if (!pop) return;
  pop.querySelectorAll('.popt').forEach(btn => {
    const onclickAttr = btn.getAttribute('onclick');
    if (onclickAttr) {
      // replace the placeholder index (-1) with the real idx
      btn.setAttribute('onclick', onclickAttr.replace(/setCIval\([^,]+,/, `setCIval(${idx},`));
    }
  });
  showPop(tile.popId);
}

function setCIval(idx, val, color, btn) {
  updateCIDisplay(idx, val, color);

  // Write to Storage
  const ci = Storage.getTodayCI();
  ci[idx] = { val, color };
  Storage.saveTodayCI(ci);
  Storage.saveCIDay(new Date().toDateString());

  // Write to AppState using the tile's appStateKey
  AppState.todayCI = ci;
  const tile = _activeTiles[idx];
  if (tile?.appStateKey) AppState[tile.appStateKey] = val;
  updateDerivedState();

  updateCIStatus();
  saveCIToHistory(idx, val, color);

  if (btn) {
    const parent = btn.closest('.pop-opts,.ph-grid');
    if (parent) parent.querySelectorAll('.popt,.ph-btn').forEach(b => b.classList.remove('on'));
    btn.classList.add('on');
  }
}

function saveCIToHistory(idx, val, color) {
  const today = new Date().toDateString();
  const hist = Storage.getCIHistory();
  if (!hist[today]) hist[today] = {};
  hist[today][idx] = { val, color };
  Storage.saveCIHistory(hist);
}

function updateCIDisplay(idx, val, color) {
  const hv = document.getElementById('civ' + idx);
  if (hv) { hv.textContent = val; hv.style.color = color; }
  const tv = document.getElementById('ttv-' + idx);
  const tile = document.getElementById('ttile-' + idx);
  if (tv) { tv.textContent = val; tv.style.color = color; }
  if (tile) tile.classList.add('set');
}

function updateCIStatus() {
  const ci = Storage.getTodayCI();
  const done = Object.keys(ci).length;
  const el = document.getElementById('ciStatus');
  const hint = document.getElementById('ciHint');
  if (done >= 4) {
    if (el) { el.textContent = 'complete ✓'; el.style.color = 'var(--ga)'; }
    if (hint) hint.textContent = 'all logged for today — great work.';
    const lastDay = Storage.getLastCIDay();
    const today = new Date().toDateString();
    if (lastDay !== today) {
      const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
      const streak = lastDay === yesterday.toDateString() ? Storage.getCIStreak() + 1 : 1;
      Storage.saveCIStreak(streak);
      Storage.saveLastCIDay(today);
      AppState.ciStreak = streak;
      setEl('streakCI', streak);
      setEl('statStreak', streak);
    }
  } else {
    if (el) { el.textContent = done + '/4 logged'; el.style.color = 'var(--t3)'; }
    if (hint) hint.textContent = (4 - done) + ' more to complete today\'s check-in';
  }
}

// ── TRACK TAB ──
function refreshTrackTab() {
  const today = new Date().toDateString();
  if (Storage.getCIDay() === today) {
    const ci = Storage.getTodayCI();
    Object.keys(ci).forEach(idx => updateCIDisplay(parseInt(idx), ci[idx].val, ci[idx].color));
  }
  updateCIStatus();
  setEl('streakCI',    AppState.ciStreak);
  setEl('streakTasks', AppState.tasksDoneCount);
  setEl('streakBrain', AppState.brainTasksCount);
  rebuildWeekStrip();
  rebuildMoodGrid();

  const dumps = Storage.getDumps();
  const inbox = document.getElementById('dumpInbox');
  if (inbox) {
    inbox.innerHTML = '';
    if (dumps.length) dumps.forEach(d => renderDumpItem(d, inbox));
    else inbox.innerHTML = '<div style="text-align:center;padding:24px;font-size:13px;color:var(--t3);font-style:italic">your brain dump inbox is empty</div>';
  }
}

// ── WEEK STRIP (7-day energy + mood dots) ──
function rebuildWeekStrip() {
  const strip = document.getElementById('weekStrip');
  if (!strip) return;
  strip.innerHTML = '';
  const hist = Storage.getCIHistory();
  const today = new Date();
  const energyColor = { high: 'var(--ga)', med: 'var(--ru)', low: 'var(--tl)' };
  const moodColor   = { '+': 'var(--ga)', '~': 'var(--ru)', '–': 'var(--te)' };
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(today.getDate() - i);
    const key = d.toDateString();
    const isToday = i === 0;
    const dayCI = hist[key] || {};
    const ec = energyColor[dayCI[0]?.val] || 'var(--bg3)';
    const mc = moodColor[dayCI[2]?.val]   || 'var(--bg3)';
    const div = document.createElement('div');
    div.className = 'wday-s' + (isToday ? ' active' : '');
    div.innerHTML = `<span class="wday-l">${['M','T','W','T','F','S','S'][d.getDay()]}</span><span class="wday-d">${d.getDate()}</span><div class="wday-dots-s"><div class="wdot-s" style="background:${ec}"></div><div class="wdot-s" style="background:${mc}"></div></div>`;
    strip.appendChild(div);
  }
}

// ── MOOD GRID (14-day) ──
function rebuildMoodGrid() {
  const grid = document.getElementById('moodGrid');
  if (!grid) return;
  grid.innerHTML = '';
  const hist = Storage.getCIHistory();
  const moodColor = { '+': 'var(--ga)', '~': 'var(--ru)', '–': 'var(--te)' };
  const today = new Date();
  for (let i = 13; i >= 0; i--) {
    const d = new Date(); d.setDate(today.getDate() - i);
    const key = d.toDateString();
    const mVal = (hist[key] || {})[2]?.val;
    const cell = document.createElement('div');
    cell.className = 'mc-cell';
    cell.style.background = moodColor[mVal] || 'var(--bg3)';
    cell.title = d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + (mVal ? ' · ' + mVal : ' · not logged');
    grid.appendChild(cell);
  }
}
