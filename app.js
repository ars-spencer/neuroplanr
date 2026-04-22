// ─────────────────────────────────────────────────────
// NEUROPLANR — app.js  v2
// Bug fixes: chaos mode, data flow, domain rings, task persistence,
//            week view deadlines, track real data, insights real data
// New features: mind map, deadline tasks, time-block scheduling
// ─────────────────────────────────────────────────────

// ── STORAGE HELPERS ──
const LS = {
  get: k => { try { return JSON.parse(localStorage.getItem('np_'+k)); } catch(e) { return null; } },
  set: (k,v) => { try { localStorage.setItem('np_'+k, JSON.stringify(v)); } catch(e) {} }
};

// ── INIT ──
document.addEventListener('DOMContentLoaded', () => {
  if (LS.get('darkMode')) document.body.classList.add('dark');
  tickClock();
  setInterval(tickClock, 15000);
  buildWeekGrid();
  buildWeekStrip();
  buildMoodGrid();
  initMindMap();
  if (LS.get('onboardingDone')) {
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
  const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const short = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const greets = h < 12 ? 'good morning' : h < 17 ? 'good afternoon' : 'good evening';
  const dateLong = days[n.getDay()]+', '+months[n.getMonth()]+' '+n.getDate();
  const dateShort = days[n.getDay()].slice(0,3)+', '+short[n.getMonth()]+' '+n.getDate();
  setEl('home-greet', greets);
  setEl('plan-sub', dateLong);
  setEl('track-sub', dateLong);
  setEl('tciDate', dateShort);
  const banner = document.getElementById('smartBanner');
  if (banner) {
    if (h < 10) banner.innerHTML = 'Morning + fresh start — <strong>day view</strong> suggested.';
    else if (h < 17) banner.innerHTML = 'Mid-day focus time — <strong>day view</strong> to keep on track.';
    else banner.innerHTML = 'Evening — good time to plan <strong>tomorrow</strong>. Try week view.';
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
  LS.set('darkMode', document.body.classList.contains('dark'));
}

// ── ONBOARDING ──
function goOb(n) { showScreen('s-ob'+n); }

function togMax(el, gid, max) {
  const grp = document.getElementById(gid);
  if (!grp) return;
  const on = [...grp.querySelectorAll('.chip.on')];
  if (!el.classList.contains('on') && on.length >= max) { shake(el); return; }
  el.classList.toggle('on');
}

function togCI(el) {
  const all = document.querySelectorAll('.cirow');
  const on = [...all].filter(r => r.classList.contains('on'));
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
  const name = document.getElementById('uname')?.value.trim() || '';
  const peak = [...document.querySelectorAll('#cg-peak .chip.on')].map(c => c.textContent);
  const ci = [...document.querySelectorAll('.cirow.on')].map(r => r.querySelector('.ciname').textContent);
  const anchor = document.getElementById('anchor')?.value.trim() || '';
  const dop = ['d1','d2','d3'].map(id => document.getElementById(id)?.value.trim()).filter(Boolean);

  LS.set('userName', name || 'you');
  LS.set('peakTimes', peak);
  LS.set('checkInTiles', ci);
  LS.set('anchor', anchor);
  LS.set('dopamineMenu', dop);
  LS.set('onboardingDone', true);

  const rname = document.getElementById('rname');
  if (rname) rname.innerHTML = name ? `you're all set, <em>${name}.</em>` : "you're all set.";
  setEl('spk', peak.length ? peak.join(', ') : 'not set');
  setEl('sci', ci.length ? ci.map(s => s.toLowerCase()).join(', ') : 'defaults');
  setEl('san', anchor || 'not set');
  setEl('sdop', dop.length ? dop.length + ' thing' + (dop.length > 1 ? 's' : '') + ' saved' : 'not set yet');

  goOb(6);
}

function goToApp() {
  loadAllData();
  showMainNav(true);
  showScreen('s-home');
  goTab('home');
}

// ── LOAD ALL PERSISTED DATA ──
function loadAllData() {
  const name = LS.get('userName') || 'you';
  const nameEl = document.getElementById('home-name');
  if (nameEl) nameEl.innerHTML = `hey, <em>${name}</em>`;

  const tasks = LS.get('tasks') || [];
  tasks.forEach(t => renderSavedTask(t));

  const today = new Date().toDateString();
  const ciDay = LS.get('ciDay');
  if (ciDay === today) {
    const ci = LS.get('todayCI') || {};
    Object.keys(ci).forEach(idx => {
      const d = ci[idx];
      updateCIDisplay(parseInt(idx), d.val, d.color);
    });
    updateCIStatus();
  } else {
    LS.set('todayCI', {});
    LS.set('ciDay', today);
  }

  const dumps = LS.get('dumps') || [];
  const inbox = document.getElementById('dumpInbox');
  if (inbox && dumps.length) {
    inbox.innerHTML = '';
    dumps.forEach(d => renderDumpItem(d, inbox));
  }

  const streak = LS.get('ciStreak') || 0;
  const tasksDone = LS.get('tasksDoneCount') || 0;
  const brainDone = LS.get('brainTasksCount') || 0;
  setEl('streakCI', streak);
  setEl('streakTasks', tasksDone);
  setEl('streakBrain', brainDone);
  setEl('statTasks', tasksDone);
  setEl('statStreak', streak);
  setEl('statDumps', dumps.length);

  updateDomainRings();
  rebuildWeekStrip();
  rebuildMoodGrid();
  updateInsightHeadline(name, streak, tasksDone);
  renderWeekDeadlines();
  updateDomainBalance();
}

function updateInsightHeadline(name, streak, tasks) {
  const el = document.getElementById('insightHeadline');
  let msg = 'keep showing up — that\'s the whole game.';
  if (streak > 0) msg = streak + ' day' + (streak>1?'s':'')+' in a row. that\'s real.';
  else if (tasks > 5) msg = tasks+' tasks done. your brain is working.';
  if (el) el.textContent = msg;
  const body = document.getElementById('insightBody');
  if (body && streak > 0) body.textContent = `you've checked in ${streak} day${streak>1?'s':''} in a row and completed ${tasks} task${tasks!==1?'s':''} this week. your patterns are starting to emerge.`;
}

// ── TABS ──
function goTab(tab) {
  ['home','plan','track','insights','map'].forEach(t => {
    const s = document.getElementById('s-'+t);
    const n = document.getElementById('nav-'+t);
    if (s) s.classList.toggle('show', t === tab);
    if (n) {
      n.classList.toggle('on', t === tab);
      const icon = n.querySelector('svg');
      if (icon) icon.setAttribute('stroke', t === tab ? 'var(--gm)' : 'var(--t3)');
    }
  });
  if (tab === 'track') refreshTrackTab();
  if (tab === 'insights') refreshInsightsTab();
  if (tab === 'map') { mmLoadData(); }
  if (tab === 'plan') { loadDayView(); }
  window.scrollTo(0, 0);
}

// ── FIX 1: CHAOS MODE — replaces normal view, doesn't stack ──
let chaosOn = false;
function toggleChaos() {
  chaosOn = !chaosOn;
  document.getElementById('chaosToggle').classList.toggle('on', chaosOn);
  document.getElementById('chaosBanner').classList.toggle('on', chaosOn);
  const nv = document.getElementById('normalView');
  const cv = document.getElementById('chaosView');
  if (nv) nv.style.display = chaosOn ? 'none' : '';
  if (cv) cv.style.display = chaosOn ? 'block' : 'none';
  setEl('chaosSub', chaosOn ? 'tap again to return to full view' : 'strip back to what matters');
  if (chaosOn) {
    const first = document.querySelector('#col-now .tt:not(.done)');
    setEl('chaosTask', first ? first.textContent : 'one small thing. your choice.');
  }
  LS.set('chaosUsed', (LS.get('chaosUsed') || 0) + (chaosOn ? 1 : 0));
}

function pickMood(el) {
  document.querySelectorAll('.mb').forEach(b => b.classList.remove('on'));
  el.classList.add('on');
}

// ── FIX 2 & 6: CHECK-INS ──
const CI_POPS = ['energy','cycle','mood','meds'];

function showCIpop(idx) { showPop('p-'+CI_POPS[idx]); }

function setCIval(idx, val, color, btn) {
  updateCIDisplay(idx, val, color);
  const ci = LS.get('todayCI') || {};
  ci[idx] = { val, color };
  LS.set('todayCI', ci);
  LS.set('ciDay', new Date().toDateString());
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
  const hist = LS.get('ciHistory') || {};
  if (!hist[today]) hist[today] = {};
  hist[today][idx] = { val, color };
  LS.set('ciHistory', hist);
}

function updateCIDisplay(idx, val, color) {
  const hv = document.getElementById('civ'+idx);
  if (hv) { hv.textContent = val; hv.style.color = color; }
  const tv = document.getElementById('ttv-'+idx);
  const tile = document.getElementById('ttile-'+idx);
  if (tv) { tv.textContent = val; tv.style.color = color; }
  if (tile) tile.classList.add('set');
}

function updateCIStatus() {
  const ci = LS.get('todayCI') || {};
  const done = Object.keys(ci).length;
  const el = document.getElementById('ciStatus');
  const hint = document.getElementById('ciHint');
  if (done >= 4) {
    if (el) { el.textContent = 'complete ✓'; el.style.color = 'var(--ga)'; }
    if (hint) hint.textContent = 'all logged for today — great work.';
    const lastDay = LS.get('lastCIDay');
    const today = new Date().toDateString();
    if (lastDay !== today) {
      const yesterday = new Date(); yesterday.setDate(yesterday.getDate()-1);
      const streak = lastDay === yesterday.toDateString() ? (LS.get('ciStreak')||0)+1 : 1;
      LS.set('ciStreak', streak);
      LS.set('lastCIDay', today);
      setEl('streakCI', streak);
      setEl('statStreak', streak);
    }
  } else {
    if (el) { el.textContent = done+'/4 logged'; el.style.color = 'var(--t3)'; }
    if (hint) hint.textContent = (4-done)+' more to complete today\'s check-in';
  }
}

// ── FIX 6: TRACK TAB — real data ──
function refreshTrackTab() {
  const today = new Date().toDateString();
  if (LS.get('ciDay') === today) {
    const ci = LS.get('todayCI') || {};
    Object.keys(ci).forEach(idx => updateCIDisplay(parseInt(idx), ci[idx].val, ci[idx].color));
  }
  updateCIStatus();
  const streak = LS.get('ciStreak') || 0;
  const tasksDone = LS.get('tasksDoneCount') || 0;
  const brainDone = LS.get('brainTasksCount') || 0;
  setEl('streakCI', streak);
  setEl('streakTasks', tasksDone);
  setEl('streakBrain', brainDone);
  rebuildWeekStrip();
  rebuildMoodGrid();
  const dumps = LS.get('dumps') || [];
  const inbox = document.getElementById('dumpInbox');
  if (inbox) {
    inbox.innerHTML = '';
    if (dumps.length) dumps.forEach(d => renderDumpItem(d, inbox));
    else inbox.innerHTML = '<div style="text-align:center;padding:24px;font-size:13px;color:var(--t3);font-style:italic">your brain dump inbox is empty</div>';
  }
}

// week strip from real CI history
function rebuildWeekStrip() {
  const strip = document.getElementById('weekStrip');
  if (!strip) return;
  strip.innerHTML = '';
  const hist = LS.get('ciHistory') || {};
  const today = new Date();
  const energyColor = { high:'var(--ga)', med:'var(--ru)', low:'var(--tl)' };
  const moodColor = { '+':'var(--ga)', '~':'var(--ru)', '–':'var(--te)' };
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(today.getDate() - i);
    const key = d.toDateString();
    const isToday = i === 0;
    const dayCI = hist[key] || {};
    const ec = energyColor[dayCI[0]?.val] || 'var(--bg3)';
    const mc = moodColor[dayCI[2]?.val] || 'var(--bg3)';
    const div = document.createElement('div');
    div.className = 'wday-s' + (isToday ? ' active' : '');
    div.innerHTML = `<span class="wday-l">${['M','T','W','T','F','S','S'][d.getDay()]}</span><span class="wday-d">${d.getDate()}</span><div class="wday-dots-s"><div class="wdot-s" style="background:${ec}"></div><div class="wdot-s" style="background:${mc}"></div></div>`;
    strip.appendChild(div);
  }
}

// mood grid from real CI history
function rebuildMoodGrid() {
  const grid = document.getElementById('moodGrid');
  if (!grid) return;
  grid.innerHTML = '';
  const hist = LS.get('ciHistory') || {};
  const moodColor = { '+':'var(--ga)', '~':'var(--ru)', '–':'var(--te)' };
  const today = new Date();
  for (let i = 13; i >= 0; i--) {
    const d = new Date(); d.setDate(today.getDate() - i);
    const key = d.toDateString();
    const mVal = (hist[key] || {})[2]?.val;
    const cell = document.createElement('div');
    cell.className = 'mc-cell';
    cell.style.background = moodColor[mVal] || 'var(--bg3)';
    cell.title = d.toLocaleDateString([], {month:'short', day:'numeric'}) + (mVal ? ' · '+mVal : ' · not logged');
    grid.appendChild(cell);
  }
}

// ── FIX 7: INSIGHTS TAB — real data ──
function refreshInsightsTab() {
  const streak = LS.get('ciStreak') || 0;
  const tasksDone = LS.get('tasksDoneCount') || 0;
  const dumps = LS.get('dumps') || [];
  const name = LS.get('userName') || 'you';
  setEl('statTasks', tasksDone);
  setEl('statStreak', streak);
  setEl('statDumps', dumps.length);
  updateInsightHeadline(name, streak, tasksDone);
  updateDomainBalance();
  const chaosUsed = LS.get('chaosUsed') || 0;
  const chaosCard = document.getElementById('chaosInsightText');
  if (chaosCard && chaosUsed > 0) chaosCard.textContent = `"you've used chaos mode ${chaosUsed} time${chaosUsed!==1?'s':''} — and came back each time. that's real resilience."`;
}

// ── FIX 3: DOMAIN RINGS from real task completion ──
function updateDomainRings() {
  const tasks = LS.get('tasks') || [];
  if (!tasks.length) return;
  const C = 169.6; // 2π * r=27
  const doms = [
    { key:'var(--gm)', ringId:'ring-personal', pctId:'ring-pct-personal' },
    { key:'var(--te)', ringId:'ring-work',     pctId:'ring-pct-work' },
    { key:'var(--pl)', ringId:'ring-brain',    pctId:'ring-pct-brain' },
    { key:'var(--ru)', ringId:'ring-body',     pctId:'ring-pct-body' },
  ];
  doms.forEach(({ key, ringId, pctId }) => {
    const dt = tasks.filter(t => t.dom === key);
    const done = dt.filter(t => t.done).length;
    const pct = dt.length ? Math.round((done / dt.length) * 100) : 0;
    const fill = (pct / 100) * C;
    const ring = document.getElementById(ringId);
    const pctEl = document.getElementById(pctId);
    if (ring) ring.setAttribute('stroke-dasharray', `${fill.toFixed(1)} ${(C-fill).toFixed(1)}`);
    if (pctEl) pctEl.textContent = pct + '%';
  });
}

function updateDomainBalance() {
  const tasks = LS.get('tasks') || [];
  if (!tasks.length) return;
  const counts = { 'var(--gm)':0, 'var(--te)':0, 'var(--pl)':0, 'var(--ru)':0 };
  tasks.forEach(t => { if(counts[t.dom]!==undefined) counts[t.dom]++; });
  const max = Math.max(...Object.values(counts), 1);
  const map = {
    'var(--gm)': { fill:'db-fill-personal', val:'db-val-personal' },
    'var(--te)': { fill:'db-fill-work',     val:'db-val-work' },
    'var(--pl)': { fill:'db-fill-brain',    val:'db-val-brain' },
    'var(--ru)': { fill:'db-fill-body',     val:'db-val-body' },
  };
  Object.entries(map).forEach(([dom, ids]) => {
    const pct = Math.round((counts[dom] / max) * 100);
    const fillEl = document.getElementById(ids.fill);
    const valEl = document.getElementById(ids.val);
    if (fillEl) fillEl.style.width = pct + '%';
    if (valEl) valEl.textContent = pct + '%';
  });
}

// ── FIX 4 + NEW FEATURE 3: TASKS ──
let selCol = 'now', selDom = 'var(--gm)';
let taskForBlock = null;

function showTaskPop(blockSlot) {
  taskForBlock = blockSlot || null;
  showPop('p-task');
  setTimeout(() => document.getElementById('taskInput')?.focus(), 300);
}

function pickCol(c, btn) {
  selCol = c;
  document.querySelectorAll('.col-chip').forEach(b => b.classList.remove('on'));
  btn.classList.add('on');
}

function pickDom(btn, color) {
  selDom = color;
  btn.closest('.dom-row').querySelectorAll('.dom-chip').forEach(b => b.classList.remove('on'));
  btn.classList.add('on');
}

function addTask() {
  const txt = document.getElementById('taskInput')?.value.trim();
  if (!txt) { shake(document.getElementById('taskInput')); return; }

  const deadlineDate = document.getElementById('taskDeadlineDate')?.value || '';
  const deadlineTime = document.getElementById('taskDeadlineTime')?.value || '';
  const duration = parseInt(document.getElementById('taskDuration')?.value || '0') || 0;

  const task = {
    text: txt,
    col: taskForBlock ? 'block' : selCol,
    dom: selDom,
    done: false,
    id: Date.now(),
    deadlineDate,
    deadlineTime,
    duration,
    blockSlot: taskForBlock || null,
  };

  const tasks = LS.get('tasks') || [];
  tasks.push(task);
  LS.set('tasks', tasks);

  if (taskForBlock) {
    addTaskToBlock(task, taskForBlock);
  } else if (selCol === 'block') {
    const t = document.createElement('div'); t.className = 'bitem'; t.onclick = function() { toggleBT(this); };
    t.innerHTML = `<div class="bcb"></div><div class="bpip" style="background:${selDom}"></div><span class="btt">${txt}</span>`;
    document.getElementById('ablock')?.appendChild(t);
  } else {
    const col = document.getElementById('col-'+selCol);
    if (col) {
      const t = document.createElement('div'); t.className = 'task'; t.dataset.id = task.id;
      t.onclick = function(e) { if(!e.target.classList.contains('task-edit-btn')) toggleTask(this); };
      const dlFlag = deadlineDate ? `<span class="task-dl-flag">📅 ${formatDeadline(deadlineDate, deadlineTime)}</span>` : '';
      t.innerHTML = `<div class="tcb"></div><div class="pip" style="background:${selDom}"></div><span class="tt">${txt}</span>${dlFlag}<button class="task-edit-btn" onclick="openTaskEdit(this.closest('.task'),event)" title="edit">···</button>`;
      col.appendChild(t);
    }
    const chip = document.createElement('div'); chip.className = 'tray-chip';
    chip.innerHTML = `<div class="cpip" style="background:${selDom}"></div>${txt}`;
    document.getElementById('trayChips')?.appendChild(chip);
    const qi = document.createElement('div'); qi.className = 'fqi';
    qi.innerHTML = `<div class="fqn">${document.querySelectorAll('.fqi').length+1}</div><div class="fqp" style="background:${selDom}"></div><div class="fqt">${txt}</div>`;
    document.getElementById('flowQueue')?.appendChild(qi);
  }

  if (deadlineDate) { renderWeekDeadlines(); buildWeekGrid(); }

  // reset form
  ['taskInput','taskDeadlineDate','taskDeadlineTime','taskDuration'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  taskForBlock = null;
  closePop();
  updateDomainRings();
}

function formatDeadline(date, time) {
  if (!date) return '';
  const d = new Date(date + (time ? 'T'+time : 'T00:00'));
  if (isNaN(d)) return date;
  const opts = { month:'short', day:'numeric' };
  return d.toLocaleDateString([], opts) + (time ? ' ' + d.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}) : '');
}

// ── NEW FEATURE 2: DEADLINE TASKS IN WEEK VIEW ──
function renderWeekDeadlines() {
  const container = document.getElementById('weekDeadlines');
  if (!container) return;
  const tasks = (LS.get('tasks') || []).filter(t => t.deadlineDate);
  const today = new Date();
  const dow = today.getDay();
  const weekStart = new Date(today); weekStart.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1));
  const weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 6);
  weekStart.setHours(0,0,0,0); weekEnd.setHours(23,59,59,999);

  const thisWeek = tasks.filter(t => {
    const d = new Date(t.deadlineDate + 'T00:00');
    return d >= weekStart && d <= weekEnd;
  }).sort((a,b) => new Date(a.deadlineDate) - new Date(b.deadlineDate));

  const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const domMeta = {
    'var(--gm)': 'personal',
    'var(--te)': 'work',
    'var(--pl)': 'brain',
    'var(--ru)': 'body',
  };

  if (!thisWeek.length) {
    container.innerHTML = '<div class="wdi-empty">no deadlines this week · tap + add to add one</div>';
  } else {
    container.innerHTML = thisWeek.map(t => {
      const d = new Date(t.deadlineDate + 'T00:00');
      const timeStr = t.deadlineTime ? ' · ' + t.deadlineTime : '';
      const doneStyle = t.done ? 'opacity:.5;text-decoration:line-through;' : '';
      return `<div class="wdi" data-id="${t.id}" style="${doneStyle}"><div class="wdd">${dayNames[d.getDay()]}</div><div class="wdp" style="background:${t.dom}"></div><div style="flex:1"><div class="wdt">${t.text}</div><div class="wdm">${domMeta[t.dom]||''}${timeStr}</div></div><button class="wdi-del" onclick="deleteDeadlineTask(${t.id})">×</button></div>`;
    }).join('');
  }
}

function deleteDeadlineTask(id) {
  let tasks = LS.get('tasks') || [];
  tasks = tasks.filter(t => t.id !== id);
  LS.set('tasks', tasks);
  renderWeekDeadlines();
  buildWeekGrid();
  const el = document.querySelector(`.task[data-id="${id}"]`);
  if (el) el.remove();
}

// ── NEW FEATURE 3: TIME-BLOCKED SCHEDULING ──
function addTaskToBlock(task, slotId) {
  const block = document.getElementById(slotId);
  if (!block) return;
  const empty = block.querySelector('.bempty');
  if (empty) empty.style.display = 'none';
  const t = document.createElement('div'); t.className = 'bitem'; t.dataset.id = task.id; t.onclick = function() { toggleBT(this); };
  const dur = task.duration ? `<span class="bitem-dur">${task.duration}m</span>` : '';
  t.innerHTML = `<div class="bcb"></div><div class="bpip" style="background:${task.dom}"></div><span class="btt">${task.text}</span>${dur}`;
  const addBtn = block.querySelector('.badd');
  if (addBtn) block.insertBefore(t, addBtn); else block.appendChild(t);
}

function renderSavedTask(t) {
  if (t.blockSlot) { addTaskToBlock(t, t.blockSlot); return; }
  const col = document.getElementById('col-'+t.col);
  if (!col) return;
  const el = document.createElement('div'); el.className = 'task'; el.dataset.id = t.id;
  el.onclick = function(e) { if(!e.target.classList.contains('task-edit-btn')) toggleTask(this); };
  const dlFlag = t.deadlineDate ? `<span class="task-dl-flag">📅 ${formatDeadline(t.deadlineDate, t.deadlineTime)}</span>` : '';
  el.innerHTML = `<div class="tcb${t.done?' done':''}"></div><div class="pip" style="background:${t.dom}"></div><span class="tt${t.done?' done':''}">${t.text}</span>${dlFlag}<button class="task-edit-btn" onclick="openTaskEdit(this.closest('.task'),event)" title="edit">···</button>`;
  col.appendChild(el);
}

function toggleTask(el) {
  const cb = el.querySelector('.tcb');
  const txt = el.querySelector('.tt');
  const wasDone = cb.classList.contains('done');
  cb.classList.toggle('done');
  txt.classList.toggle('done');
  flash();

  const delta = wasDone ? -1 : 1;
  const count = Math.max(0, (LS.get('tasksDoneCount')||0) + delta);
  LS.set('tasksDoneCount', count);
  setEl('streakTasks', count);
  setEl('statTasks', count);

  const id = parseInt(el.dataset.id);
  const tasks = LS.get('tasks') || [];
  const found = tasks.find(t => t.id === id);
  if (found) {
    found.done = !wasDone;
    LS.set('tasks', tasks);
    if (found.dom === 'var(--pl)') {
      const bc = Math.max(0, (LS.get('brainTasksCount')||0) + delta);
      LS.set('brainTasksCount', bc);
      setEl('streakBrain', bc);
    }
  }
  updateDomainRings();
}

function toggleBT(el) {
  el.querySelector('.bcb').classList.toggle('done');
  el.querySelector('.btt').classList.toggle('done');
  flash();
}

// ── TASK EDIT / DELETE ──
let editingTaskId = null;
let editingTaskEl = null;
let editingTaskDom = 'var(--gm)';

function openTaskEdit(el, e) {
  e.stopPropagation();
  editingTaskId = parseInt(el.dataset.id);
  editingTaskEl = el;
  const tasks = LS.get('tasks') || [];
  const task = tasks.find(t => t.id === editingTaskId);
  if (!task) return;
  editingTaskDom = task.dom || 'var(--gm)';
  document.getElementById('editTaskInput').value = task.text;
  // highlight current domain chip
  const domMap = { 'var(--gm)':'edc-personal','var(--te)':'edc-work','var(--pl)':'edc-brain','var(--ru)':'edc-body' };
  document.querySelectorAll('#p-task-edit .dom-chip').forEach(b => b.classList.remove('on'));
  const activeChip = document.getElementById(domMap[task.dom]);
  if (activeChip) activeChip.classList.add('on');
  showPop('p-task-edit');
  setTimeout(() => document.getElementById('editTaskInput')?.focus(), 300);
}

function pickEditDom(btn, color) {
  editingTaskDom = color;
  document.querySelectorAll('#p-task-edit .dom-chip').forEach(b => b.classList.remove('on'));
  btn.classList.add('on');
}

function saveTaskEdit() {
  const txt = document.getElementById('editTaskInput')?.value.trim();
  if (!txt || !editingTaskId) return;
  const tasks = LS.get('tasks') || [];
  const task = tasks.find(t => t.id === editingTaskId);
  if (task) {
    task.text = txt;
    task.dom = editingTaskDom;
    LS.set('tasks', tasks);
  }
  // update DOM element
  if (editingTaskEl) {
    const tt = editingTaskEl.querySelector('.tt');
    const pip = editingTaskEl.querySelector('.pip');
    if (tt) tt.textContent = txt;
    if (pip) pip.style.background = editingTaskDom;
  }
  editingTaskId = null; editingTaskEl = null;
  closePop();
  updateDomainRings();
}

function deleteTask() {
  if (!editingTaskId) return;
  let tasks = LS.get('tasks') || [];
  const task = tasks.find(t => t.id === editingTaskId);
  // adjust counts if it was done
  if (task && task.done) {
    const count = Math.max(0, (LS.get('tasksDoneCount')||0) - 1);
    LS.set('tasksDoneCount', count);
    setEl('streakTasks', count);
    setEl('statTasks', count);
    if (task.dom === 'var(--pl)') {
      const bc = Math.max(0, (LS.get('brainTasksCount')||0) - 1);
      LS.set('brainTasksCount', bc);
      setEl('streakBrain', bc);
    }
  }
  tasks = tasks.filter(t => t.id !== editingTaskId);
  LS.set('tasks', tasks);
  if (editingTaskEl) {
    editingTaskEl.style.opacity = '0';
    editingTaskEl.style.transform = 'translateX(20px)';
    editingTaskEl.style.transition = 'all .25s';
    setTimeout(() => editingTaskEl.remove(), 250);
  }
  editingTaskId = null; editingTaskEl = null;
  closePop();
  updateDomainRings();
}

// ── BRAIN DUMP ──
function showDumpPop() {
  showPop('p-dump');
  setTimeout(() => document.getElementById('dumpTxt')?.focus(), 300);
}

function saveDump() {
  const txt = document.getElementById('dumpTxt')?.value.trim();
  if (!txt) return;
  const n = new Date();
  const time = n.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) + ' · ' + n.toLocaleDateString([], {month:'short',day:'numeric'});
  const item = { text: txt, time, id: Date.now() };
  const dumps = LS.get('dumps') || [];
  dumps.unshift(item);
  LS.set('dumps', dumps);

  const inbox = document.getElementById('dumpInbox');
  if (inbox) {
    if (!inbox.querySelector('.di-item')) inbox.innerHTML = '';
    renderDumpItem(item, inbox, true);
  }

  document.getElementById('dumpTxt').value = '';
  setEl('statDumps', dumps.length);
  closePop();
}

function renderDumpItem(d, container, prepend = false) {
  const el = document.createElement('div'); el.className = 'di-item'; el.dataset.id = d.id;
  if (prepend) el.style.animation = 'fi .3s ease';
  el.innerHTML = `<div class="di-text">${d.text}</div><div class="di-meta"><span class="di-time">${d.time}</span><div class="di-actions"><button class="di-btn promote" onclick="promoteItem(this)">→ task</button><button class="di-btn mindmap-btn" onclick="sendToMindMap(this)">→ mind map</button><button class="di-btn" onclick="archiveItem(this)">archive</button></div></div>`;
  if (prepend) container.insertBefore(el, container.firstChild);
  else container.appendChild(el);
}

function promoteItem(btn) {
  const item = btn.closest('.di-item');
  const txt = item.querySelector('.di-text').textContent.slice(0, 50);
  const col = document.getElementById('col-later');
  if (col) {
    const task = { text: txt, col: 'later', dom: 'var(--pl)', done: false, id: Date.now() };
    const tasks = LS.get('tasks') || []; tasks.push(task); LS.set('tasks', tasks);
    const t = document.createElement('div'); t.className = 'task'; t.dataset.id = task.id; t.onclick = function() { toggleTask(this); };
    t.innerHTML = `<div class="tcb"></div><div class="pip" style="background:var(--pl)"></div><span class="tt">${txt}</span>`;
    col.appendChild(t);
    updateDomainRings();
  }
  removeItem(item);
}

function archiveItem(btn) { removeItem(btn.closest('.di-item')); }

function removeItem(item) {
  item.style.opacity = '0'; item.style.transform = 'translateX(20px)'; item.style.transition = 'all .3s';
  setTimeout(() => {
    const id = parseInt(item.dataset.id);
    item.remove();
    const dumps = (LS.get('dumps') || []).filter(d => d.id !== id);
    LS.set('dumps', dumps);
    const inbox = document.getElementById('dumpInbox');
    if (inbox && !inbox.querySelector('.di-item')) inbox.innerHTML = '<div style="text-align:center;padding:24px;font-size:13px;color:var(--t3);font-style:italic">your brain dump inbox is empty</div>';
  }, 300);
}

// ── PLAN — VIEW SWITCHER ──
function sv(v) {
  ['day','week','flow'].forEach(x => {
    document.getElementById('vw-'+x).classList.toggle('show', x === v);
    document.getElementById('vb-'+x).classList.toggle('on', x === v);
  });
  if (v === 'week') { renderWeekDeadlines(); buildWeekGrid(); }
  if (v === 'day') { loadDayView(); }
}

// ── DAY VIEW — date-aware ──
let dayOff = 0;
const DAY_N = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const MON_N = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MON_LONG = ['January','February','March','April','May','June','July','August','September','October','November','December'];

// Block definitions — label, time label, CSS classes, hint text
const DAY_BLOCKS = [
  { id:'b-morning',   time:'7 am',  name:'morning',       cls:'pk',  badge:'peak energy',        badgeCls:'eb-p', hint:'your sharpest window — protect it' },
  { id:'b-midmorn',   time:'10 am', name:'mid-morning',   cls:'st',  badge:'steady',             badgeCls:'eb-s', hint:'good for focused work' },
  { id:'b-afternoon', time:'1 pm',  name:'afternoon',     cls:'st',  badge:'steady',             badgeCls:'eb-s', hint:'low-friction tasks welcome' },
  { id:'b-lateaft',   time:'4 pm',  name:'late afternoon',cls:'lw',  badge:'gentle',             badgeCls:'eb-l', hint:'admin · reading · easy wins' },
  { id:'b-evening',   time:'7 pm',  name:'evening',       cls:'',    badge:'restore',            badgeCls:'eb-r', hint:'dopamine menu · wind down' },
  { id:'b-flex',      time:'flex',  name:'flex zone',     cls:'flex', badge:'overflow',          badgeCls:'',     hint:'nothing planned here on purpose' },
];

const BUFFERS = [
  { after:'b-morning',   text:'— transition buffer 15 min —' },
  { after:'b-midmorn',   text:'— rest + lunch 30 min —' },
  { after:'b-afternoon', text:'— transition buffer 15 min —' },
  { after:'b-lateaft',   text:'— wind-down buffer —' },
];

function getDayKey(offset) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

function getDayLabel(offset) {
  if (offset === 0) return 'today';
  if (offset === 1) return 'tomorrow';
  if (offset === -1) return 'yesterday';
  const d = new Date(); d.setDate(d.getDate() + offset);
  return DAY_N[d.getDay()];
}

function getDaySub(offset) {
  const d = new Date(); d.setDate(d.getDate() + offset);
  return DAY_N[d.getDay()].toLowerCase() + ' · ' + MON_N[d.getMonth()] + ' ' + d.getDate();
}

function shiftDay(delta) {
  dayOff += delta;
  loadDayView();
}

function goDay(name, sub) {
  sv('day');
  setEl('dlbl', name);
  setEl('dsub', sub);
}

function loadDayView() {
  setEl('dlbl', getDayLabel(dayOff));
  setEl('dsub', getDaySub(dayOff));

  const key = getDayKey(dayOff);
  const dayData = LS.get('day_' + key) || { tasks: {} };

  // check for carried-forward tasks from previous day
  checkCarryForward(key, dayData);

  renderDayBlocks(key, dayData);
}

function checkCarryForward(key, dayData) {
  const banner = document.getElementById('carriedBanner');
  if (!banner) return;

  // only show carry-forward on today
  if (dayOff !== 0) { banner.style.display = 'none'; return; }

  // look at yesterday
  const yd = new Date(); yd.setDate(yd.getDate() - 1);
  const ydKey = yd.toISOString().slice(0, 10);
  const ydData = LS.get('day_' + ydKey);
  if (!ydData) { banner.style.display = 'none'; return; }

  // find unfinished tasks from yesterday not already in today
  let carried = 0;
  Object.entries(ydData.tasks || {}).forEach(([blockId, tasks]) => {
    (tasks || []).forEach(t => {
      if (!t.done) {
        // carry into today's same block if not already there
        if (!dayData.tasks[blockId]) dayData.tasks[blockId] = [];
        const alreadyThere = dayData.tasks[blockId].some(x => x.text === t.text);
        if (!alreadyThere) {
          dayData.tasks[blockId].push({ ...t, carried: true, id: Date.now() + Math.random() });
          carried++;
        }
      }
    });
  });

  if (carried > 0) {
    LS.set('day_' + key, dayData);
    banner.style.display = 'flex';
    setEl('carriedMsg', carried + ' unfinished task' + (carried > 1 ? 's' : '') + ' carried forward');
  } else {
    banner.style.display = 'none';
  }
}

function renderDayBlocks(key, dayData) {
  const container = document.getElementById('dayBlocks');
  if (!container) return;
  container.innerHTML = '';

  DAY_BLOCKS.forEach(block => {
    const tasks = (dayData.tasks || {})[block.id] || [];

    // block row
    const br = document.createElement('div'); br.className = 'br';
    const bt = document.createElement('div'); bt.className = 'bt'; bt.textContent = block.time;

    const bb = document.createElement('div');
    bb.className = 'bb' + (block.cls ? ' ' + block.cls : '');
    if (block.id === 'b-evening') bb.style.borderLeft = '3px solid var(--gl)';
    if (block.id === 'b-flex') bb.style.borderStyle = 'dashed';
    bb.id = block.id;

    // header
    const badgeStyle = block.id === 'b-evening'
      ? 'background:rgba(92,143,58,.1);color:var(--ga)'
      : block.id === 'b-flex' ? 'color:var(--t3)' : '';
    bb.innerHTML = `<div class="btop"><span class="bname">${block.name}</span><span class="eb ${block.badgeCls}" style="${badgeStyle}">${block.badge}</span></div>`;

    // tasks
    const taskArea = document.createElement('div'); taskArea.className = 'block-tasks';
    if (tasks.length === 0) {
      taskArea.innerHTML = `<div class="bempty">${block.hint}</div>`;
    } else {
      tasks.forEach(t => {
        taskArea.appendChild(makeDayTaskEl(t, block.id, key));
      });
    }
    bb.appendChild(taskArea);

    // add button
    const addBtn = document.createElement('span');
    addBtn.className = 'badd'; addBtn.textContent = '+ add';
    addBtn.style.opacity = '1'; // always visible on mobile
    addBtn.onclick = () => openBlockAdd(block.id, block.name, key);
    bb.appendChild(addBtn);

    br.appendChild(bt); br.appendChild(bb);
    container.appendChild(br);

    // buffer after block if defined
    const buf = BUFFERS.find(b => b.after === block.id);
    if (buf) {
      const bufRow = document.createElement('div'); bufRow.className = 'br';
      bufRow.innerHTML = `<div class="bt"></div><div class="bb buf"><span class="eb-b">${buf.text}</span></div>`;
      container.appendChild(bufRow);
    }
  });
}

function makeDayTaskEl(t, blockId, dateKey) {
  const el = document.createElement('div');
  el.className = 'bitem' + (t.carried ? ' carried' : '');
  el.dataset.id = t.id;
  const carriedBadge = t.carried ? '<span class="carried-badge">↩</span>' : '';
  el.innerHTML = `<div class="bcb${t.done?' done':''}"></div><div class="bpip" style="background:${t.dom||'var(--gm)'}"></div><span class="btt${t.done?' done':''}">${t.text}</span>${carriedBadge}<button class="bitem-del" title="remove">×</button>`;

  // toggle done
  el.querySelector('.bcb').addEventListener('click', e => {
    e.stopPropagation();
    toggleDayTask(el, blockId, dateKey);
  });
  el.querySelector('.btt').addEventListener('click', e => {
    e.stopPropagation();
    toggleDayTask(el, blockId, dateKey);
  });

  // delete
  el.querySelector('.bitem-del').addEventListener('click', e => {
    e.stopPropagation();
    deleteDayTask(t.id, blockId, dateKey, el);
  });

  return el;
}

function toggleDayTask(el, blockId, dateKey) {
  const cb = el.querySelector('.bcb');
  const tt = el.querySelector('.btt');
  const wasDone = cb.classList.contains('done');
  cb.classList.toggle('done');
  tt.classList.toggle('done');
  flash();

  // save state
  const dayData = LS.get('day_' + dateKey) || { tasks: {} };
  const id = parseFloat(el.dataset.id);
  const tasks = dayData.tasks[blockId] || [];
  const found = tasks.find(t => t.id === id);
  if (found) { found.done = !wasDone; LS.set('day_' + dateKey, dayData); }

  // update global task done count
  const delta = wasDone ? -1 : 1;
  const count = Math.max(0, (LS.get('tasksDoneCount') || 0) + delta);
  LS.set('tasksDoneCount', count);
  setEl('streakTasks', count);
  setEl('statTasks', count);
}

function deleteDayTask(id, blockId, dateKey, el) {
  el.style.opacity = '0'; el.style.transition = 'opacity .2s';
  setTimeout(() => {
    el.remove();
    const dayData = LS.get('day_' + dateKey) || { tasks: {} };
    dayData.tasks[blockId] = (dayData.tasks[blockId] || []).filter(t => t.id !== id);
    LS.set('day_' + dateKey, dayData);
    // if block is now empty show hint
    const blockEl = document.getElementById(blockId);
    if (blockEl) {
      const taskArea = blockEl.querySelector('.block-tasks');
      if (taskArea && taskArea.querySelectorAll('.bitem').length === 0) {
        const block = DAY_BLOCKS.find(b => b.id === blockId);
        taskArea.innerHTML = `<div class="bempty">${block ? block.hint : ''}</div>`;
      }
    }
  }, 200);
}

// block-specific add popup
let activeBlockId = null;
let activeBlockDateKey = null;
let activeBlockDom = 'var(--gm)';

function openBlockAdd(blockId, blockName, dateKey) {
  activeBlockId = blockId;
  activeBlockDateKey = dateKey;
  activeBlockDom = 'var(--gm)';
  setEl('blockPopTitle', 'add to ' + blockName);
  document.getElementById('blockTaskInput').value = '';
  document.querySelectorAll('#p-block-add .dom-chip').forEach(b => b.classList.remove('on'));
  document.getElementById('bdc-personal')?.classList.add('on');
  showPop('p-block-add');
  setTimeout(() => document.getElementById('blockTaskInput')?.focus(), 300);
}

function pickBlockDom(btn, color) {
  activeBlockDom = color;
  document.querySelectorAll('#p-block-add .dom-chip').forEach(b => b.classList.remove('on'));
  btn.classList.add('on');
}

function addBlockTask() {
  const txt = document.getElementById('blockTaskInput')?.value.trim();
  if (!txt) { shake(document.getElementById('blockTaskInput')); return; }

  const task = { id: Date.now(), text: txt, dom: activeBlockDom, done: false, carried: false };

  // save to day storage
  const dayData = LS.get('day_' + activeBlockDateKey) || { tasks: {} };
  if (!dayData.tasks[activeBlockId]) dayData.tasks[activeBlockId] = [];
  dayData.tasks[activeBlockId].push(task);
  LS.set('day_' + activeBlockDateKey, dayData);

  // add to DOM
  const blockEl = document.getElementById(activeBlockId);
  if (blockEl) {
    let taskArea = blockEl.querySelector('.block-tasks');
    if (!taskArea) { taskArea = document.createElement('div'); taskArea.className = 'block-tasks'; blockEl.insertBefore(taskArea, blockEl.querySelector('.badd')); }
    // remove empty hint
    const empty = taskArea.querySelector('.bempty');
    if (empty) empty.remove();
    taskArea.appendChild(makeDayTaskEl(task, activeBlockId, activeBlockDateKey));
  }

  closePop();
  updateDomainRings();
}

// ── FIX 5: WEEK GRID — real tasks + real deadlines ──
function buildWeekGrid() {
  const grid = document.getElementById('weekGrid');
  if (!grid) return;
  grid.innerHTML = '';
  const today = new Date();
  const tasks = LS.get('tasks') || [];
  const dayLabels = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  for (let i = 0; i < 7; i++) {
    const dt = new Date(today); dt.setDate(today.getDate() - (today.getDay()===0?6:today.getDay()-1) + i);
    const isToday = dt.toDateString() === today.toDateString();
    const dateStr = dt.toISOString().slice(0, 10);
    const dayTasks = tasks.filter(t => t.deadlineDate === dateStr);
    const dots = dayTasks.map(t => `<div class="wdot" style="background:${t.dom}"></div>`).join('');
    const hasDeadline = dayTasks.some(t => !t.done);
    const div = document.createElement('div');
    div.className = 'wday' + (isToday ? ' today' : '');
    div.onclick = () => goDay(dayLabels[i], dayLabels[i].toLowerCase()+' · '+MON_N[dt.getMonth()]+' '+dt.getDate());
    div.innerHTML = `<div class="wdl">${dayLabels[i]}</div><div class="wdn">${dt.getDate()}</div><div class="wdots">${dots}</div><div class="wcnt">${dayTasks.length||''}</div>${hasDeadline?'<div class="wflag">deadline</div>':''}`;
    grid.appendChild(div);
  }
}

// ── TIMER ──
let tI = null, tS = 1500, tR = false;

function updTimer() {
  const m = Math.floor(tS/60), s = tS%60;
  setEl('tdisp', String(m).padStart(2,'0')+':'+String(s).padStart(2,'0'));
  const ring = document.getElementById('tring');
  if (ring) ring.style.strokeDashoffset = 427-(1-(tS/1500))*427*0.75;
}

function toggleTimer() {
  const b = document.getElementById('startBtn');
  if (tR) { clearInterval(tI); tR=false; if(b) b.textContent='resume focus'; }
  else {
    tR=true; if(b) b.textContent='pause';
    tI=setInterval(()=>{
      if(tS>0){tS--;updTimer();}
      else{clearInterval(tI);tR=false;tS=1500;updTimer();if(b)b.textContent='start focus';setEl('tlbl','done!');flash();setTimeout(()=>setEl('tlbl','focus'),1500);}
    },1000);
  }
}

function doBreak() {
  clearInterval(tI);tR=false;tS=300;
  setEl('tlbl','break');
  const ring=document.getElementById('tring');if(ring)ring.style.stroke='var(--ru)';
  const b=document.getElementById('startBtn');if(b)b.textContent='start break';
  updTimer();toggleTimer();
}

function completeFlowTask() {
  flash();
  const q=document.querySelectorAll('.fqi');
  if(q.length>0){setEl('ftask',q[0].querySelector('.fqt').textContent);q[0].remove();document.querySelectorAll('.fqn').forEach((n,i)=>n.textContent=i+1);}
  clearInterval(tI);tR=false;tS=1500;updTimer();
  const ring=document.getElementById('tring');if(ring)ring.style.stroke='var(--ga)';
  setEl('tlbl','focus');const b=document.getElementById('startBtn');if(b)b.textContent='start focus';
}

// ── INITIAL BUILDS ──
function buildWeekStrip() { rebuildWeekStrip(); }
function buildMoodGrid() { rebuildMoodGrid(); }

// ── POPUP SYSTEM ──
function showPop(id) {
  document.querySelectorAll('.pop > div').forEach(d=>d.style.display='none');
  const p=document.getElementById(id);
  if(p)p.style.display='block';
  document.getElementById('ov').classList.add('show');
}

function closePop(e) {
  if(e&&e.target!==document.getElementById('ov'))return;
  document.getElementById('ov').classList.remove('show');
}

// ── HELPERS ──
function flash() {
  const f=document.getElementById('dfl');
  f.classList.add('show');
  setTimeout(()=>f.classList.remove('show'),700);
}

function shake(el) {
  if (!el) return;
  el.style.transform='translateX(-3px)';
  setTimeout(()=>{if(el)el.style.transform='translateX(3px)';},70);
  setTimeout(()=>{if(el)el.style.transform='';},140);
}

// ══════════════════════════════════════════════════════
// NEW FEATURE 1: MIND MAP — infinite canvas
// ══════════════════════════════════════════════════════

let mm = {
  nodes: [],
  edges: [],
  nextId: 1,
  dragging: null,
  dragOffset: { x: 0, y: 0 },
  panX: 0,
  panY: 0,
  panning: false,
  panStart: { x: 0, y: 0 },
  mode: 'drag',      // 'drag' | 'connect'
  connecting: null,  // node id being connected from
  scale: 1,          // zoom level
  // pinch tracking
  _pinchDist: null,
  _pinchMid: null,
  // double-tap tracking (mobile)
  _lastTap: 0,
  _lastTapX: 0,
  _lastTapY: 0,
};

function initMindMap() {
  const canvas = document.getElementById('mmCanvas');
  if (!canvas) return;

  // ── POINTER: drag nodes & pan canvas ──
  canvas.addEventListener('pointermove', e => {
    if (mm.dragging !== null) {
      const rect = canvas.getBoundingClientRect();
      const node = mm.nodes.find(n => n.id === mm.dragging);
      if (node) {
        node.x = (e.clientX - rect.left - mm.dragOffset.x) / mm.scale - mm.panX;
        node.y = (e.clientY - rect.top  - mm.dragOffset.y) / mm.scale - mm.panY;
        const el = canvas.querySelector(`.mm-node[data-id="${mm.dragging}"]`);
        if (el) {
          el.style.left = ((node.x + mm.panX) * mm.scale) + 'px';
          el.style.top  = ((node.y + mm.panY) * mm.scale) + 'px';
        }
        mmUpdateEdges();
      }
    } else if (mm.panning) {
      mm.panX += (e.clientX - mm.panStart.x) / mm.scale;
      mm.panY += (e.clientY - mm.panStart.y) / mm.scale;
      mm.panStart = { x: e.clientX, y: e.clientY };
      mmRerender();
    }
  });

  canvas.addEventListener('pointerup', () => {
    if (mm.dragging !== null) { saveMM(); mm.dragging = null; }
    mm.panning = false;
  });

  canvas.addEventListener('pointerdown', e => {
    if (e.target === canvas || e.target.id === 'mmSvg' || e.target.tagName === 'path') {
      if (mm.mode === 'drag') {
        mm.panning = true;
        mm.panStart = { x: e.clientX, y: e.clientY };
      }
    }
  });

  // ── DOUBLE-CLICK: desktop add node ──
  canvas.addEventListener('dblclick', e => {
    if (e.target === canvas || e.target.id === 'mmSvg' || e.target.tagName === 'path') {
      const rect = canvas.getBoundingClientRect();
      const cx = (e.clientX - rect.left) / mm.scale - mm.panX;
      const cy = (e.clientY - rect.top)  / mm.scale - mm.panY;
      mmAddNode('', Math.round(cx - 70), Math.round(cy - 22));
    }
  });

  // ── DOUBLE-TAP: mobile add node ──
  // touchstart fires before pointerdown so we can detect taps independently
  canvas.addEventListener('touchstart', e => {
    // Only act on single-finger taps on the canvas background
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    const target = e.target;
    const isBackground = target === canvas || target.id === 'mmSvg' || target.tagName === 'path';
    if (!isBackground) return;

    const now = Date.now();
    const dx = t.clientX - mm._lastTapX;
    const dy = t.clientY - mm._lastTapY;
    const dist = Math.sqrt(dx*dx + dy*dy);

    if (now - mm._lastTap < 350 && dist < 30) {
      // Double-tap detected
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const cx = (t.clientX - rect.left) / mm.scale - mm.panX;
      const cy = (t.clientY - rect.top)  / mm.scale - mm.panY;
      mmAddNode('', Math.round(cx - 70), Math.round(cy - 22));
      mm._lastTap = 0; // reset so triple-tap doesn't also fire
    } else {
      mm._lastTap = now;
      mm._lastTapX = t.clientX;
      mm._lastTapY = t.clientY;
    }
  }, { passive: false });

  // ── PINCH TO ZOOM ──
  canvas.addEventListener('touchstart', e => {
    if (e.touches.length === 2) {
      e.preventDefault();
      mm._pinchDist = mmPinchDist(e.touches);
      mm._pinchMid  = mmPinchMid(e.touches, canvas);
    }
  }, { passive: false });

  canvas.addEventListener('touchmove', e => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const newDist = mmPinchDist(e.touches);
      if (mm._pinchDist) {
        const ratio = newDist / mm._pinchDist;
        const newScale = Math.min(3, Math.max(0.25, mm.scale * ratio));
        // Zoom toward the pinch midpoint
        if (mm._pinchMid) {
          mm.panX -= mm._pinchMid.x * (1/newScale - 1/mm.scale);
          mm.panY -= mm._pinchMid.y * (1/newScale - 1/mm.scale);
        }
        mm.scale = newScale;
        mm._pinchDist = newDist;
        mmRerender();
      }
    }
  }, { passive: false });

  canvas.addEventListener('touchend', e => {
    if (e.touches.length < 2) {
      mm._pinchDist = null;
      mm._pinchMid  = null;
    }
  });

  // ── MOUSE WHEEL ZOOM (desktop bonus) ──
  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) / mm.scale;
    const my = (e.clientY - rect.top)  / mm.scale;
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.min(3, Math.max(0.25, mm.scale * delta));
    mm.panX -= mx * (1/newScale - 1/mm.scale);
    mm.panY -= my * (1/newScale - 1/mm.scale);
    mm.scale = newScale;
    mmRerender();
  }, { passive: false });
}

// ── PINCH HELPERS ──
function mmPinchDist(touches) {
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.sqrt(dx*dx + dy*dy);
}
function mmPinchMid(touches, canvas) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((touches[0].clientX + touches[1].clientX) / 2 - rect.left) / mm.scale,
    y: ((touches[0].clientY + touches[1].clientY) / 2 - rect.top)  / mm.scale,
  };
}

function openMindMap(seedText) {
  goTab('map');
  if (seedText) {
    const canvas = document.getElementById('mmCanvas');
    const rect = canvas ? canvas.getBoundingClientRect() : { width: 390, height: 500 };
    setTimeout(() => {
      mmAddNode(seedText, Math.round(rect.width/2 - mm.panX - 70), Math.round(rect.height/2 - mm.panY - 40));
    }, 100);
  }
}

function closeMindMap() {
  goTab('track');
}

function mmLoadData() {
  mm.nodes = LS.get('mmNodes') || [];
  mm.edges = LS.get('mmEdges') || [];
  mm.nextId = mm.nodes.length ? Math.max(...mm.nodes.map(n=>n.id)) + 1 : 1;
  mmRerender();
}

function saveMM() {
  LS.set('mmNodes', mm.nodes);
  LS.set('mmEdges', mm.edges);
}

function mmAddNode(text, x, y) {
  const id = mm.nextId++;
  mm.nodes.push({ id, text: text || '', x: x||100, y: y||100 });
  saveMM();
  mmRerender();
  setTimeout(() => {
    const el = document.querySelector(`.mm-node[data-id="${id}"] .mm-node-text`);
    if (el) { el.focus(); if (!text) { /* ready to type */ } else { const r=document.createRange();r.selectNodeContents(el);const s=window.getSelection();s.removeAllRanges();s.addRange(r); } }
  }, 80);
}

function mmDeleteNode(id) {
  mm.nodes = mm.nodes.filter(n => n.id !== id);
  mm.edges = mm.edges.filter(e => e.from !== id && e.to !== id);
  if (mm.connecting === id) { mm.connecting = null; setEl('mmConnectHint','tap two nodes to connect them'); }
  saveMM();
  mmRerender();
}

function mmUpdateEdges() {
  const svg = document.getElementById('mmSvg');
  if (!svg) return;
  svg.innerHTML = mmEdgePaths();
}

function mmEdgePaths() {
  return mm.edges.map(e => {
    const a = mm.nodes.find(n=>n.id===e.from), b = mm.nodes.find(n=>n.id===e.to);
    if (!a||!b) return '';
    const ax = (a.x+mm.panX+70)*mm.scale, ay = (a.y+mm.panY+22)*mm.scale;
    const bx = (b.x+mm.panX+70)*mm.scale, by = (b.y+mm.panY+22)*mm.scale;
    const mx = (ax+bx)/2, my = (ay+by)/2 - 30*mm.scale;
    return `<path d="M${ax},${ay} Q${mx},${my} ${bx},${by}" stroke="var(--ga)" stroke-width="1.5" fill="none" opacity="0.55" stroke-linecap="round"/>`;
  }).join('');
}

function mmRerender() {
  const canvas = document.getElementById('mmCanvas');
  if (!canvas) return;

  // ── Show/hide empty hint ──
  const hint = document.getElementById('mmEmptyHint');
  if (hint) hint.style.display = mm.nodes.length === 0 ? '' : 'none';

  let svg = document.getElementById('mmSvg');
  if (!svg) {
    svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
    svg.id = 'mmSvg';
    svg.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:0;overflow:visible;';
    canvas.insertBefore(svg, canvas.firstChild);
  }
  svg.innerHTML = mmEdgePaths();

  canvas.querySelectorAll('.mm-node').forEach(el => el.remove());

  mm.nodes.forEach(n => {
    const el = document.createElement('div');
    el.className = 'mm-node' + (mm.connecting === n.id ? ' mm-node-connecting' : '');
    el.dataset.id = n.id;
    const sx = (n.x + mm.panX) * mm.scale;
    const sy = (n.y + mm.panY) * mm.scale;
    el.style.cssText = `left:${sx}px;top:${sy}px;transform:scale(${mm.scale});transform-origin:top left;`;
    el.innerHTML = `<div class="mm-node-text" contenteditable="true" spellcheck="false">${escHtml(n.text)}</div><button class="mm-node-del" title="remove">×</button>`;

    const textEl = el.querySelector('.mm-node-text');
    textEl.addEventListener('input', () => {
      const node = mm.nodes.find(x=>x.id===n.id);
      if (node) { node.text = textEl.textContent; saveMM(); }
    });
    textEl.addEventListener('keydown', e => { if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();textEl.blur();} });

    el.querySelector('.mm-node-del').addEventListener('click', e => {
      e.stopPropagation();
      mmDeleteNode(n.id);
    });

    el.addEventListener('pointerdown', e => {
      if (e.target.classList.contains('mm-node-del')) return;
      if (e.target === textEl && document.activeElement === textEl) return;
      if (mm.mode === 'connect') { mmHandleConnect(n.id); return; }
      mm.dragging = n.id;
      const rect = el.getBoundingClientRect();
      // Drag offset in screen pixels (not scaled) — we divide by scale during move
      mm.dragOffset = { x: (e.clientX - rect.left), y: (e.clientY - rect.top) };
      e.preventDefault();
    });

    canvas.appendChild(el);
  });
}

function escHtml(s) {
  return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function mmHandleConnect(id) {
  if (mm.connecting === null) {
    mm.connecting = id;
    setEl('mmConnectHint', 'now tap another node — tap same to cancel');
    document.querySelectorAll('.mm-node').forEach(el => el.classList.toggle('mm-node-connecting', parseInt(el.dataset.id)===id));
  } else if (mm.connecting === id) {
    mm.connecting = null;
    setEl('mmConnectHint', 'tap two nodes to connect them');
    document.querySelectorAll('.mm-node').forEach(el => el.classList.remove('mm-node-connecting'));
  } else {
    const exists = mm.edges.some(e=>(e.from===mm.connecting&&e.to===id)||(e.from===id&&e.to===mm.connecting));
    if (exists) mm.edges = mm.edges.filter(e=>!((e.from===mm.connecting&&e.to===id)||(e.from===id&&e.to===mm.connecting)));
    else mm.edges.push({ from: mm.connecting, to: id });
    mm.connecting = null;
    setEl('mmConnectHint', 'tap two nodes to connect them');
    document.querySelectorAll('.mm-node').forEach(el => el.classList.remove('mm-node-connecting'));
    saveMM();
    mmRerender();
  }
}

function mmSetMode(mode, btn) {
  mm.mode = mode;
  mm.connecting = null;
  document.querySelectorAll('.mm-mode-btn').forEach(b => b.classList.remove('on'));
  if (btn) btn.classList.add('on');
  const hint = document.getElementById('mmConnectHint');
  if (hint) hint.style.display = mode==='connect' ? 'block' : 'none';
  document.querySelectorAll('.mm-node').forEach(el => el.classList.remove('mm-node-connecting'));
}

function mmAddNodeBtn() {
  const canvas = document.getElementById('mmCanvas');
  const rect = canvas ? canvas.getBoundingClientRect() : { width:390, height:600 };
  const x = Math.round(rect.width/2 - mm.panX - 70 + (Math.random()-0.5)*120);
  const y = Math.round(rect.height/2 - mm.panY - 22 + (Math.random()-0.5)*80);
  mmAddNode('', x, y);
}

function mmClearAll() {
  if (mm.nodes.length === 0) return;
  if (!confirm('clear all nodes? this cannot be undone.')) return;
  mm.nodes = []; mm.edges = []; mm.nextId = 1; mm.connecting = null;
  saveMM();
  mmRerender();
}

function sendToMindMap(btn) {
  const item = btn.closest('.di-item');
  const txt = item.querySelector('.di-text').textContent.slice(0, 100);
  removeItem(item);
  openMindMap(txt);
}

function mmSeedFromDumps() {
  const dumps = LS.get('dumps') || [];
  if (!dumps.length) {
    alert('no brain dumps yet — add some first!');
    return;
  }
  const canvas = document.getElementById('mmCanvas');
  const rect = canvas ? canvas.getBoundingClientRect() : { width:390, height:500 };
  const cx = rect.width / 2 - mm.panX;
  const cy = rect.height / 2 - mm.panY;
  // only seed dumps not already on the map (match by text)
  const existing = mm.nodes.map(n => n.text.trim());
  let added = 0;
  dumps.forEach((d, i) => {
    if (existing.includes(d.text.trim())) return;
    const angle = (i / dumps.length) * Math.PI * 2;
    const radius = 110 + Math.random() * 40;
    const x = Math.round(cx + Math.cos(angle) * radius - 70);
    const y = Math.round(cy + Math.sin(angle) * radius - 22);
    mm.nodes.push({ id: mm.nextId++, text: d.text.slice(0,80), x, y, dumpId: d.id });
    added++;
  });
  if (added === 0) {
    // all already seeded — just rerender
  }
  saveMM();
  mmRerender();
  const hint = document.getElementById('mmEmptyHint');
  if (hint) hint.style.display = 'none';
}
