// ─────────────────────────────────────────────────────
// NEUROPLANR — checkin.js
// Check-in tiles, track tab, week strip, mood grid.
// Reads: AppState (for display)
// Writes: Storage + AppState.todayCI / energy / mood / cyclePhase / meds
// ─────────────────────────────────────────────────────

// ── CHECK-IN TILES ──
const CI_POPS = ['energy', 'cycle', 'mood', 'meds'];

function showCIpop(idx) { showPop('p-' + CI_POPS[idx]); }

function setCIval(idx, val, color, btn) {
  updateCIDisplay(idx, val, color);

  // Write to Storage
  const ci = Storage.getTodayCI();
  ci[idx] = { val, color };
  Storage.saveTodayCI(ci);
  Storage.saveCIDay(new Date().toDateString());

  // Write to AppState
  AppState.todayCI = ci;
  if (idx === 0) AppState.energy     = val;
  if (idx === 1) AppState.cyclePhase = val;
  if (idx === 2) AppState.mood       = val;
  if (idx === 3) AppState.meds       = val;
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
