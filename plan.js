// ─────────────────────────────────────────────────────
// NEUROPLANR — plan.js
// Plan tab: day view (time blocks), week grid,
// view switcher, focus timer.
// Reads: AppState (day blocks will eventually adapt to energy)
// Writes: Storage (day_YYYY-MM-DD keys)
// ─────────────────────────────────────────────────────

// ── VIEW SWITCHER ──
function sv(v) {
  ['day','week','flow'].forEach(x => {
    document.getElementById('vw-' + x).classList.toggle('show', x === v);
    document.getElementById('vb-' + x).classList.toggle('on', x === v);
  });
  if (v === 'week') { renderWeekDeadlines(); buildWeekGrid(); }
  if (v === 'day')  { loadDayView(); }
}

// ── DAY VIEW ──
let dayOff = 0;
const DAY_N    = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const MON_N    = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MON_LONG = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const DAY_BLOCKS = [
  { id:'b-morning',   time:'7 am',  name:'morning',        cls:'pk',   badge:'peak energy', badgeCls:'eb-p', hint:'your sharpest window — protect it' },
  { id:'b-midmorn',   time:'10 am', name:'mid-morning',    cls:'st',   badge:'steady',      badgeCls:'eb-s', hint:'good for focused work' },
  { id:'b-afternoon', time:'1 pm',  name:'afternoon',      cls:'st',   badge:'steady',      badgeCls:'eb-s', hint:'low-friction tasks welcome' },
  { id:'b-lateaft',   time:'4 pm',  name:'late afternoon', cls:'lw',   badge:'gentle',      badgeCls:'eb-l', hint:'admin · reading · easy wins' },
  { id:'b-evening',   time:'7 pm',  name:'evening',        cls:'',     badge:'restore',     badgeCls:'eb-r', hint:'dopamine menu · wind down' },
  { id:'b-flex',      time:'flex',  name:'flex zone',      cls:'flex', badge:'overflow',    badgeCls:'',     hint:'nothing planned here on purpose' },
];

const BUFFERS = [
  { after:'b-morning',   text:'— transition buffer 15 min —' },
  { after:'b-midmorn',   text:'— rest + lunch 30 min —' },
  { after:'b-afternoon', text:'— transition buffer 15 min —' },
  { after:'b-lateaft',   text:'— wind-down buffer —' },
];

function getDayKey(offset) {
  const d = new Date(); d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

function getDayLabel(offset) {
  if (offset === 0)  return 'today';
  if (offset === 1)  return 'tomorrow';
  if (offset === -1) return 'yesterday';
  const d = new Date(); d.setDate(d.getDate() + offset);
  return DAY_N[d.getDay()];
}

function getDaySub(offset) {
  const d = new Date(); d.setDate(d.getDate() + offset);
  return DAY_N[d.getDay()].toLowerCase() + ' · ' + MON_N[d.getMonth()] + ' ' + d.getDate();
}

function shiftDay(delta) { dayOff += delta; loadDayView(); }

function goDay(name, sub) {
  sv('day');
  setEl('dlbl', name);
  setEl('dsub', sub);
}

function loadDayView() {
  setEl('dlbl', getDayLabel(dayOff));
  setEl('dsub', getDaySub(dayOff));
  const key     = getDayKey(dayOff);
  const dayData = Storage.getDayData(key);
  checkCarryForward(key, dayData);
  renderDayBlocks(key, dayData);
}

function checkCarryForward(key, dayData) {
  const banner = document.getElementById('carriedBanner');
  if (!banner) return;
  if (dayOff !== 0) { banner.style.display = 'none'; return; }

  const yd = new Date(); yd.setDate(yd.getDate() - 1);
  const ydKey  = yd.toISOString().slice(0, 10);
  const ydData = Storage.getDayData(ydKey);
  if (!ydData || !Object.keys(ydData.tasks || {}).length) { banner.style.display = 'none'; return; }

  let carried = 0;
  Object.entries(ydData.tasks || {}).forEach(([blockId, tasks]) => {
    (tasks || []).forEach(t => {
      if (!t.done) {
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
    Storage.saveDayData(key, dayData);
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
    const br = document.createElement('div'); br.className = 'br';
    const bt = document.createElement('div'); bt.className = 'bt'; bt.textContent = block.time;
    const bb = document.createElement('div');
    bb.className = 'bb' + (block.cls ? ' ' + block.cls : '');
    if (block.id === 'b-evening') bb.style.borderLeft = '3px solid var(--gl)';
    if (block.id === 'b-flex')    bb.style.borderStyle = 'dashed';
    bb.id = block.id;

    const badgeStyle = block.id === 'b-evening'
      ? 'background:rgba(92,143,58,.1);color:var(--ga)'
      : block.id === 'b-flex' ? 'color:var(--t3)' : '';
    bb.innerHTML = `<div class="btop"><span class="bname">${block.name}</span><span class="eb ${block.badgeCls}" style="${badgeStyle}">${block.badge}</span></div>`;

    const taskArea = document.createElement('div'); taskArea.className = 'block-tasks';
    if (tasks.length === 0) {
      taskArea.innerHTML = `<div class="bempty">${block.hint}</div>`;
    } else {
      tasks.forEach(t => taskArea.appendChild(makeDayTaskEl(t, block.id, key)));
    }
    bb.appendChild(taskArea);

    const addBtn = document.createElement('span');
    addBtn.className = 'badd'; addBtn.textContent = '+ add';
    addBtn.style.opacity = '1';
    addBtn.onclick = () => openBlockAdd(block.id, block.name, key);
    bb.appendChild(addBtn);

    br.appendChild(bt); br.appendChild(bb);
    container.appendChild(br);

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
  el.innerHTML = `<div class="bcb${t.done ? ' done' : ''}"></div><div class="bpip" style="background:${t.dom || 'var(--gm)'}"></div><span class="btt${t.done ? ' done' : ''}">${t.text}</span>${carriedBadge}<button class="bitem-del" title="remove">×</button>`;

  el.querySelector('.bcb').addEventListener('click', e => { e.stopPropagation(); toggleDayTask(el, blockId, dateKey); });
  el.querySelector('.btt').addEventListener('click', e => { e.stopPropagation(); toggleDayTask(el, blockId, dateKey); });
  el.querySelector('.bitem-del').addEventListener('click', e => { e.stopPropagation(); deleteDayTask(t.id, blockId, dateKey, el); });
  return el;
}

function toggleDayTask(el, blockId, dateKey) {
  const cb  = el.querySelector('.bcb');
  const tt  = el.querySelector('.btt');
  const wasDone = cb.classList.contains('done');
  cb.classList.toggle('done');
  tt.classList.toggle('done');
  flash();

  const dayData = Storage.getDayData(dateKey);
  const id      = parseFloat(el.dataset.id);
  const tasks   = dayData.tasks[blockId] || [];
  const found   = tasks.find(t => t.id === id);
  if (found) { found.done = !wasDone; Storage.saveDayData(dateKey, dayData); }

  const delta = wasDone ? -1 : 1;
  const count = Math.max(0, Storage.getTasksDoneCount() + delta);
  Storage.saveTasksDoneCount(count);
  AppState.tasksDoneCount = count;
  setEl('streakTasks', count);
  setEl('statTasks',   count);
}

function deleteDayTask(id, blockId, dateKey, el) {
  el.style.opacity = '0'; el.style.transition = 'opacity .2s';
  setTimeout(() => {
    el.remove();
    const dayData = Storage.getDayData(dateKey);
    dayData.tasks[blockId] = (dayData.tasks[blockId] || []).filter(t => t.id !== id);
    Storage.saveDayData(dateKey, dayData);
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

// ── BLOCK-SPECIFIC ADD POPUP ──
let activeBlockId      = null;
let activeBlockDateKey = null;
let activeBlockDom     = 'var(--gm)';

function openBlockAdd(blockId, blockName, dateKey) {
  activeBlockId      = blockId;
  activeBlockDateKey = dateKey;
  activeBlockDom     = 'var(--gm)';
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

  const dayData = Storage.getDayData(activeBlockDateKey);
  if (!dayData.tasks[activeBlockId]) dayData.tasks[activeBlockId] = [];
  dayData.tasks[activeBlockId].push(task);
  Storage.saveDayData(activeBlockDateKey, dayData);

  const blockEl = document.getElementById(activeBlockId);
  if (blockEl) {
    let taskArea = blockEl.querySelector('.block-tasks');
    if (!taskArea) { taskArea = document.createElement('div'); taskArea.className = 'block-tasks'; blockEl.insertBefore(taskArea, blockEl.querySelector('.badd')); }
    const empty = taskArea.querySelector('.bempty');
    if (empty) empty.remove();
    taskArea.appendChild(makeDayTaskEl(task, activeBlockId, activeBlockDateKey));
  }

  closePop();
  updateDomainRings();
}

// ── WEEK GRID ──
function buildWeekGrid() {
  const grid = document.getElementById('weekGrid');
  if (!grid) return;
  grid.innerHTML = '';
  const today = new Date();
  const tasks = Storage.getTasks();
  const dayLabels = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  for (let i = 0; i < 7; i++) {
    const dt = new Date(today); dt.setDate(today.getDate() - (today.getDay() === 0 ? 6 : today.getDay() - 1) + i);
    const isToday  = dt.toDateString() === today.toDateString();
    const dateStr  = dt.toISOString().slice(0, 10);
    const dayTasks = tasks.filter(t => t.deadlineDate === dateStr);
    const dots     = dayTasks.map(t => `<div class="wdot" style="background:${t.dom}"></div>`).join('');
    const hasDeadline = dayTasks.some(t => !t.done);
    const div = document.createElement('div');
    div.className = 'wday' + (isToday ? ' today' : '');
    div.onclick = () => goDay(dayLabels[i], dayLabels[i].toLowerCase() + ' · ' + MON_N[dt.getMonth()] + ' ' + dt.getDate());
    div.innerHTML = `<div class="wdl">${dayLabels[i]}</div><div class="wdn">${dt.getDate()}</div><div class="wdots">${dots}</div><div class="wcnt">${dayTasks.length || ''}</div>${hasDeadline ? '<div class="wflag">deadline</div>' : ''}`;
    grid.appendChild(div);
  }
}

// ── FOCUS TIMER ──
let tI = null, tS = 1500, tR = false;

function updTimer() {
  const m = Math.floor(tS / 60), s = tS % 60;
  setEl('tdisp', String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0'));
  const ring = document.getElementById('tring');
  if (ring) ring.style.strokeDashoffset = 427 - (1 - (tS / 1500)) * 427 * 0.75;
}

function toggleTimer() {
  const b = document.getElementById('startBtn');
  if (tR) { clearInterval(tI); tR = false; if (b) b.textContent = 'resume focus'; }
  else {
    tR = true; if (b) b.textContent = 'pause';
    tI = setInterval(() => {
      if (tS > 0) { tS--; updTimer(); }
      else { clearInterval(tI); tR = false; tS = 1500; updTimer(); if (b) b.textContent = 'start focus'; setEl('tlbl', 'done!'); flash(); setTimeout(() => setEl('tlbl', 'focus'), 1500); }
    }, 1000);
  }
}

function doBreak() {
  clearInterval(tI); tR = false; tS = 300;
  setEl('tlbl', 'break');
  const ring = document.getElementById('tring'); if (ring) ring.style.stroke = 'var(--ru)';
  const b = document.getElementById('startBtn'); if (b) b.textContent = 'start break';
  updTimer(); toggleTimer();
}

function completeFlowTask() {
  flash();
  const q = document.querySelectorAll('.fqi');
  if (q.length > 0) {
    setEl('ftask', q[0].querySelector('.fqt').textContent);
    q[0].remove();
    document.querySelectorAll('.fqn').forEach((n, i) => n.textContent = i + 1);
  }
  clearInterval(tI); tR = false; tS = 1500; updTimer();
  const ring = document.getElementById('tring'); if (ring) ring.style.stroke = 'var(--ga)';
  setEl('tlbl', 'focus'); const b = document.getElementById('startBtn'); if (b) b.textContent = 'start focus';
}
