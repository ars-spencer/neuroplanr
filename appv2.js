// ─────────────────────────────────────────────────────
// NEUROPLANR — app.js  v3
// Core only: init, onboarding, tabs, popup, helpers.
// All feature logic lives in its own module.
// Load order in index.html:
//   storage.js → state.js → checkin.js → insights.js
//   → tasks.js → plan.js → mindmap.js → app.js
// ─────────────────────────────────────────────────────

// ── INIT ──
document.addEventListener('DOMContentLoaded', () => {
  if (Storage.getDarkMode()) document.body.classList.add('dark');
  tickClock();
  setInterval(tickClock, 15000);
  buildWeekGrid();
  buildWeekStrip();
  buildMoodGrid();
  initMindMap();
  if (Storage.getOnboardingDone()) {
    hydrateAppState();   // populate AppState from storage
    loadAllData();
    showMainNav(true);
    goTab('home');
  } else {
    showScreen('s-ob1');
    showMainNav(false);
  }
});

// ── CLOCK ──
function tickClock() {
  const n = new Date(), h = n.getHours();
  const days   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const short  = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const greets = h < 12 ? 'good morning' : h < 17 ? 'good afternoon' : 'good evening';
  const dateLong  = days[n.getDay()] + ', ' + months[n.getMonth()] + ' ' + n.getDate();
  const dateShort = days[n.getDay()].slice(0, 3) + ', ' + short[n.getMonth()] + ' ' + n.getDate();
  setEl('home-greet', greets);
  setEl('plan-sub',   dateLong);
  setEl('track-sub',  dateLong);
  setEl('tciDate',    dateShort);
  const banner = document.getElementById('smartBanner');
  if (banner) {
    if (h < 10)      banner.innerHTML = 'Morning + fresh start — <strong>day view</strong> suggested.';
    else if (h < 17) banner.innerHTML = 'Mid-day focus time — <strong>day view</strong> to keep on track.';
    else             banner.innerHTML = 'Evening — good time to plan <strong>tomorrow</strong>. Try week view.';
  }
}

function setEl(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

// ── SCREENS ──
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('show'));
  const el = document.getElementById(id);
  if (el) el.classList.add('show');
  window.scrollTo(0, 0);
}

function showMainNav(show) {
  const nav = document.getElementById('mainNav');
  if (nav) nav.style.display = show ? 'flex' : 'none';
}

function toggleMode() {
  document.body.classList.toggle('dark');
  Storage.saveDarkMode(document.body.classList.contains('dark'));
}

// ── ONBOARDING ──
function goOb(n) { showScreen('s-ob' + n); }

function togMax(el, gid, max) {
  const grp = document.getElementById(gid);
  if (!grp) return;
  const on = [...grp.querySelectorAll('.chip.on')];
  if (!el.classList.contains('on') && on.length >= max) { shake(el); return; }
  el.classList.toggle('on');
}

function togCI(el) {
  const all = document.querySelectorAll('.cirow');
  const on  = [...all].filter(r => r.classList.contains('on'));
  if (!el.classList.contains('on') && on.length >= 4) { shake(el); return; }
  el.classList.toggle('on');
  const newOn = [...all].filter(r => r.classList.contains('on'));
  setEl('cicnt', newOn.length);
}

function pickOne(el, gid) {
  const grp = document.getElementById(gid);
  if (grp) grp.querySelectorAll('.chip').forEach(c => c.classList.remove('on'));
  el.classList.add('on');
}

function pickAnchor(el, val) {
  document.getElementById('cg-anchor').querySelectorAll('.chip').forEach(c => c.classList.remove('on'));
  el.classList.add('on');
  const inp = document.getElementById('anchor');
  if (inp) inp.value = val;
  const hint = document.getElementById('ahint');
  if (hint) hint.innerHTML = `<strong>put neuroplanr next to ${val}.</strong> the cue is already there — your brain will follow.`;
}

function addSug(el) {
  if (el.classList.contains('used')) return;
  for (const id of ['d1','d2','d3']) {
    const inp = document.getElementById(id);
    if (inp && !inp.value) { inp.value = el.textContent; el.classList.add('used'); return; }
  }
}

function finishOnboarding() {
  const name   = document.getElementById('uname')?.value.trim() || '';
  const peak   = [...document.querySelectorAll('#cg-peak .chip.on')].map(c => c.textContent);
  const ci     = [...document.querySelectorAll('.cirow.on')].map(r => r.querySelector('.ciname').textContent);
  const anchor = document.getElementById('anchor')?.value.trim() || '';
  const dop    = ['d1','d2','d3'].map(id => document.getElementById(id)?.value.trim()).filter(Boolean);

  // Save to Storage
  Storage.saveUserName(name || 'you');
  Storage.savePeakTimes(peak);
  Storage.saveCheckInTiles(ci);
  Storage.saveAnchor(anchor);
  Storage.saveDopamineMenu(dop);
  Storage.saveOnboardingDone(true);

  // Immediately update AppState so the rest of the app reflects setup
  applyOnboardingToState({ name, peakTimes: peak, ci, anchor, dopamine: dop });

  const rname = document.getElementById('rname');
  if (rname) rname.innerHTML = name ? `you're all set, <em>${name}.</em>` : "you're all set.";
  setEl('spk',  peak.length ? peak.join(', ')                            : 'not set');
  setEl('sci',  ci.length   ? ci.map(s => s.toLowerCase()).join(', ')    : 'defaults');
  setEl('san',  anchor || 'not set');
  setEl('sdop', dop.length  ? dop.length + ' thing' + (dop.length > 1 ? 's' : '') + ' saved' : 'not set yet');

  goOb(6);
}

function goToApp() {
  hydrateAppState();
  loadAllData();
  showMainNav(true);
  showScreen('s-home');
  goTab('home');
}

// ── LOAD ALL PERSISTED DATA ──
// Populates the UI on every app open.
// Future: after Supabase login, this will receive cloud data
// instead of reading from Storage directly.
function loadAllData() {
  const nameEl = document.getElementById('home-name');
  if (nameEl) nameEl.innerHTML = `hey, <em>${AppState.userName}</em>`;

  Storage.getTasks().forEach(t => renderSavedTask(t));

  const today = new Date().toDateString();
  if (Storage.getCIDay() === today) {
    const ci = Storage.getTodayCI();
    Object.keys(ci).forEach(idx => updateCIDisplay(parseInt(idx), ci[idx].val, ci[idx].color));
    updateCIStatus();
  } else {
    Storage.saveTodayCI({});
    Storage.saveCIDay(today);
  }

  const dumps = Storage.getDumps();
  const inbox = document.getElementById('dumpInbox');
  if (inbox && dumps.length) {
    inbox.innerHTML = '';
    dumps.forEach(d => renderDumpItem(d, inbox));
  }

  setEl('streakCI',    AppState.ciStreak);
  setEl('streakTasks', AppState.tasksDoneCount);
  setEl('streakBrain', AppState.brainTasksCount);
  setEl('statTasks',   AppState.tasksDoneCount);
  setEl('statStreak',  AppState.ciStreak);
  setEl('statDumps',   dumps.length);

  updateDomainRings();
  rebuildWeekStrip();
  rebuildMoodGrid();
  updateInsightHeadline(AppState.userName, AppState.ciStreak, AppState.tasksDoneCount);
  renderWeekDeadlines();
  updateDomainBalance();
}

// ── TABS ──
function goTab(tab) {
  ['home','plan','track','insights','map'].forEach(t => {
    const s = document.getElementById('s-' + t);
    const n = document.getElementById('nav-' + t);
    if (s) s.classList.toggle('show', t === tab);
    if (n) {
      n.classList.toggle('on', t === tab);
      const icon = n.querySelector('svg');
      if (icon) icon.setAttribute('stroke', t === tab ? 'var(--gm)' : 'var(--t3)');
    }
  });
  if (tab === 'track')    refreshTrackTab();
  if (tab === 'insights') refreshInsightsTab();
  if (tab === 'map')      mmLoadData();
  if (tab === 'plan')     loadDayView();
  window.scrollTo(0, 0);
}

// ── INITIAL BUILDS ──
function buildWeekStrip() { rebuildWeekStrip(); }
function buildMoodGrid()  { rebuildMoodGrid(); }

// ── POPUP SYSTEM ──
function showPop(id) {
  document.querySelectorAll('.pop > div').forEach(d => d.style.display = 'none');
  const p = document.getElementById(id);
  if (p) p.style.display = 'block';
  document.getElementById('ov').classList.add('show');
}

function closePop(e) {
  if (e && e.target !== document.getElementById('ov')) return;
  document.getElementById('ov').classList.remove('show');
}

// ── HELPERS ──
function flash() {
  const f = document.getElementById('dfl');
  f.classList.add('show');
  setTimeout(() => f.classList.remove('show'), 700);
}

function shake(el) {
  if (!el) return;
  el.style.transform = 'translateX(-3px)';
  setTimeout(() => { if (el) el.style.transform = 'translateX(3px)'; }, 70);
  setTimeout(() => { if (el) el.style.transform = ''; }, 140);
}
