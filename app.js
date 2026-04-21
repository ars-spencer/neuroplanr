// ─────────────────────────────────────────────────────
// NEUROPLANR — app.js
// localStorage persistence + all app logic
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
  // smart banner
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
  if (!el.classList.contains('on') && on.length >= max) {
    shake(el); return;
  }
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

  // build summary screen
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
  // name
  const name = LS.get('userName') || 'you';
  const nameEl = document.getElementById('home-name');
  if (nameEl) nameEl.innerHTML = `hey, <em>${name}</em>`;

  // tasks
  const tasks = LS.get('tasks') || [];
  tasks.forEach(t => renderSavedTask(t));

  // today's check-ins
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
    // new day — reset
    LS.set('todayCI', {});
    LS.set('ciDay', today);
  }

  // brain dumps
  const dumps = LS.get('dumps') || [];
  const inbox = document.getElementById('dumpInbox');
  if (inbox && dumps.length) {
    inbox.innerHTML = '';
    dumps.forEach(d => renderDumpItem(d, inbox));
  }

  // streaks
  const streak = LS.get('ciStreak') || 0;
  const tasksDone = LS.get('tasksDoneCount') || 0;
  const brainDone = LS.get('brainTasksCount') || 0;
  setEl('streakCI', streak);
  setEl('streakTasks', tasksDone);
  setEl('streakBrain', brainDone);
  setEl('statTasks', tasksDone);
  setEl('statStreak', streak);
  setEl('statDumps', dumps.length);

  // insight headline
  updateInsightHeadline(name, streak, tasksDone);
}

function updateInsightHeadline(name, streak, tasks) {
  const headlines = [
    'keep showing up — that\'s the whole game.',
    `${streak > 0 ? streak+' days in a row. that\'s real.' : 'every day you open this is a win.'}`,
    `${tasks > 5 ? tasks+' tasks done. your brain is working.' : 'start small. start anywhere.'}`
  ];
  const el = document.getElementById('insightHeadline');
  if (el) el.textContent = headlines[Math.min(streak, headlines.length-1)];
  const body = document.getElementById('insightBody');
  if (body && streak > 0) body.textContent = `you've checked in ${streak} day${streak>1?'s':''} in a row and completed ${tasks} task${tasks!==1?'s':''} this week. your patterns are starting to emerge.`;
}

// ── TABS ──
function goTab(tab) {
  ['home','plan','track','insights'].forEach(t => {
    const s = document.getElementById('s-'+t);
    const n = document.getElementById('nav-'+t);
    if (s) s.classList.toggle('show', t === tab);
    if (n) {
      n.classList.toggle('on', t === tab);
      const icon = n.querySelector('svg');
      if (icon) icon.setAttribute('stroke', t === tab ? 'var(--gm)' : 'var(--t3)');
    }
  });
  window.scrollTo(0, 0);
}

// ── CHAOS MODE ──
let chaosOn = false;
function toggleChaos() {
  chaosOn = !chaosOn;
  document.getElementById('chaosToggle').classList.toggle('on', chaosOn);
  document.getElementById('chaosBanner').classList.toggle('on', chaosOn);
  const nv = document.getElementById('normalView');
  const cv = document.getElementById('chaosView');
  if (nv) nv.classList.toggle('hidden', chaosOn);
  if (cv) cv.classList.toggle('show', chaosOn);
  setEl('chaosSub', chaosOn ? 'tap again to return to full view' : 'strip back to what matters');
  if (chaosOn) {
    const first = document.querySelector('#col-now .tt:not(.done)');
    if (first) setEl('chaosTask', first.textContent);
  }
  LS.set('chaosUsed', (LS.get('chaosUsed') || 0) + (chaosOn ? 1 : 0));
}

function pickMood(el) {
  document.querySelectorAll('.mb').forEach(b => b.classList.remove('on'));
  el.classList.add('on');
}

// ── CHECK-INS ──
const CI_POPS = ['energy','cycle','mood','meds'];

function showCIpop(idx) { showPop('p-'+CI_POPS[idx]); }

function setCIval(idx, val, color, btn) {
  updateCIDisplay(idx, val, color);
  // save
  const ci = LS.get('todayCI') || {};
  ci[idx] = { val, color };
  LS.set('todayCI', ci);
  LS.set('ciDay', new Date().toDateString());
  updateCIStatus();
  // deselect siblings
  if (btn) {
    const parent = btn.closest('.pop-opts,.ph-grid');
    if (parent) parent.querySelectorAll('.popt,.ph-btn').forEach(b => b.classList.remove('on'));
    btn.classList.add('on');
  }
}

function updateCIDisplay(idx, val, color) {
  // home tiles
  const hv = document.getElementById('civ'+idx);
  if (hv) { hv.textContent = val; hv.style.color = color; }
  // track tiles
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
    // increment streak
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

// ── TASKS ──
let selCol = 'now', selDom = 'var(--gm)';

function showTaskPop() {
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
  if (!txt) return;

  const task = { text: txt, col: selCol, dom: selDom, done: false, id: Date.now() };
  const tasks = LS.get('tasks') || [];
  tasks.push(task);
  LS.set('tasks', tasks);

  if (selCol === 'block') {
    const t = document.createElement('div'); t.className = 'bitem'; t.onclick = function() { toggleBT(this); };
    t.innerHTML = `<div class="bcb"></div><div class="bpip" style="background:${selDom}"></div><span class="btt">${txt}</span>`;
    document.getElementById('ablock')?.appendChild(t);
  } else {
    const col = document.getElementById('col-'+selCol);
    if (col) {
      const t = document.createElement('div'); t.className = 'task'; t.dataset.id = task.id; t.onclick = function() { toggleTask(this); };
      t.innerHTML = `<div class="tcb"></div><div class="pip" style="background:${selDom}"></div><span class="tt">${txt}</span>`;
      col.appendChild(t);
    }
    // tray chip
    const chip = document.createElement('div'); chip.className = 'tray-chip';
    chip.innerHTML = `<div class="cpip" style="background:${selDom}"></div>${txt}`;
    document.getElementById('trayChips')?.appendChild(chip);
    // flow queue
    const qi = document.createElement('div'); qi.className = 'fqi';
    qi.innerHTML = `<div class="fqn">${document.querySelectorAll('.fqi').length+1}</div><div class="fqp" style="background:${selDom}"></div><div class="fqt">${txt}</div>`;
    document.getElementById('flowQueue')?.appendChild(qi);
  }

  document.getElementById('taskInput').value = '';
  closePop();
}

function renderSavedTask(t) {
  const col = document.getElementById('col-'+t.col);
  if (!col) return;
  const el = document.createElement('div'); el.className = 'task'; el.dataset.id = t.id; el.onclick = function() { toggleTask(this); };
  el.innerHTML = `<div class="tcb${t.done?' done':''}"></div><div class="pip" style="background:${t.dom}"></div><span class="tt${t.done?' done':''}">${t.text}</span>`;
  col.appendChild(el);
}

function toggleTask(el) {
  const cb = el.querySelector('.tcb');
  const txt = el.querySelector('.tt');
  const wasDone = cb.classList.contains('done');
  cb.classList.toggle('done');
  txt.classList.toggle('done');
  flash();

  // update count
  const delta = wasDone ? -1 : 1;
  const count = Math.max(0, (LS.get('tasksDoneCount')||0) + delta);
  LS.set('tasksDoneCount', count);
  setEl('streakTasks', count);
  setEl('statTasks', count);

  // save state
  const tasks = LS.get('tasks') || [];
  const id = parseInt(el.dataset.id);
  const found = tasks.find(t => t.id === id);
  if (found) { found.done = !wasDone; LS.set('tasks', tasks); }
}

function toggleBT(el) {
  el.querySelector('.bcb').classList.toggle('done');
  el.querySelector('.btt').classList.toggle('done');
  flash();
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
    if (inbox.querySelector('.di-item') === null && inbox.querySelector('div[style]')) inbox.innerHTML = '';
    renderDumpItem(item, inbox, true);
  }

  document.getElementById('dumpTxt').value = '';
  setEl('statDumps', dumps.length);
  closePop();
}

function renderDumpItem(d, container, prepend = false) {
  const el = document.createElement('div'); el.className = 'di-item'; el.dataset.id = d.id;
  if (prepend) el.style.animation = 'fi .3s ease';
  el.innerHTML = `<div class="di-text">${d.text}</div><div class="di-meta"><span class="di-time">${d.time}</span><div class="di-actions"><button class="di-btn promote" onclick="promoteItem(this)">→ task</button><button class="di-btn" onclick="archiveItem(this)">archive</button></div></div>`;
  if (prepend) container.insertBefore(el, container.firstChild);
  else container.appendChild(el);
}

function promoteItem(btn) {
  const item = btn.closest('.di-item');
  const txt = item.querySelector('.di-text').textContent.slice(0, 50);
  const col = document.getElementById('col-later');
  if (col) {
    const t = document.createElement('div'); t.className = 'task'; t.onclick = function() { toggleTask(this); };
    t.innerHTML = `<div class="tcb"></div><div class="pip" style="background:var(--pl)"></div><span class="tt">${txt}</span>`;
    col.appendChild(t);
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
}

// ── PLAN — DAY NAV ──
let dayOff = 0;
const DAY_N = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const MON_N = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function shiftDay(d) {
  dayOff += d;
  const dt = new Date(); dt.setDate(dt.getDate() + dayOff);
  setEl('dlbl', dayOff===0?'today':dayOff===1?'tomorrow':dayOff===-1?'yesterday':DAY_N[dt.getDay()]);
  setEl('dsub', DAY_N[dt.getDay()].toLowerCase()+' · '+MON_N[dt.getMonth()]+' '+dt.getDate());
}

function goDay(name, sub) { sv('day'); setEl('dlbl', name); setEl('dsub', sub); }

// ── WEEK GRID (plan) ──
function buildWeekGrid() {
  const grid = document.getElementById('weekGrid');
  if (!grid) return;
  const today = new Date();
  const dotsByDay = [
    ['var(--gm)','var(--pl)','var(--te)'],
    ['var(--te)','var(--te)'],
    ['var(--gm)','var(--pl)','var(--ru)','var(--gm)'],
    ['var(--ru)'],
    ['var(--te)','var(--te)','var(--gm)'],
    ['var(--pl)'],
    []
  ];
  const flags = [null,'deadline',null,null,'Q2 review',null,null];
  const dayLabels = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  for (let i = 0; i < 7; i++) {
    const dt = new Date(today); dt.setDate(today.getDate() - today.getDay() + 1 + i);
    const isToday = dt.toDateString() === today.toDateString();
    const div = document.createElement('div');
    div.className = 'wday' + (isToday ? ' today' : '');
    div.onclick = () => goDay(dayLabels[i], dayLabels[i].toLowerCase()+' · '+MON_N[dt.getMonth()]+' '+dt.getDate());
    const dots = dotsByDay[i].map(c => `<div class="wdot" style="background:${c}"></div>`).join('');
    div.innerHTML = `<div class="wdl">${dayLabels[i]}</div><div class="wdn">${dt.getDate()}</div><div class="wdots">${dots}</div><div class="wcnt">${dotsByDay[i].length||'rest'}</div>${flags[i]?`<div class="wflag">${flags[i]}</div>`:''}`;
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

// ── TRACK — WEEK STRIP ──
function buildWeekStrip() {
  const strip = document.getElementById('weekStrip');
  if (!strip) return;
  const eColors=['var(--gp)','var(--ga)','var(--ga)','var(--rl)','var(--ru)','var(--tl)',''];
  const mColors=['var(--ga)','var(--ga)','var(--ru)','var(--ru)','var(--ga)','var(--ru)',''];
  const today=new Date();
  for(let i=6;i>=0;i--){
    const d=new Date();d.setDate(today.getDate()-i);
    const isToday=i===0;
    const div=document.createElement('div');
    div.className='wday-s'+(isToday?' active':'');
    div.innerHTML=`<span class="wday-l">${['M','T','W','T','F','S','S'][d.getDay()]}</span><span class="wday-d">${d.getDate()}</span><div class="wday-dots-s"><div class="wdot-s" style="background:${eColors[6-i]||'var(--bg3)'}"></div><div class="wdot-s" style="background:${mColors[6-i]||'var(--bg3)'}"></div></div>`;
    strip.appendChild(div);
  }
}

// ── TRACK — MOOD GRID ──
function buildMoodGrid() {
  const grid=document.getElementById('moodGrid');
  if(!grid)return;
  const data=['var(--ga)','var(--ga)','var(--ru)','var(--ga)','var(--ga)','var(--bg3)','var(--ru)','var(--ru)','var(--te)','var(--ru)','var(--ru)','var(--ga)','var(--ru)','var(--ru)'];
  data.forEach(c=>{const cell=document.createElement('div');cell.className='mc-cell';cell.style.background=c;grid.appendChild(cell);});
}

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
  el.style.transform='translateX(-3px)';
  setTimeout(()=>{el.style.transform='translateX(3px)';},70);
  setTimeout(()=>{el.style.transform='';},140);
}
