// ─────────────────────────────────────────────────────
// NEUROPLANR — tasks.js
// Now/Next/Later tasks, chaos mode, deadline tasks,
// time-blocked scheduling, task edit/delete, brain dump.
// Reads: AppState (for future mood-reactive display)
// Writes: Storage
// ─────────────────────────────────────────────────────

// ── CHAOS MODE ──
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
  Storage.saveChaosUsed(Storage.getChaosUsed() + (chaosOn ? 1 : 0));
}

function pickMood(el) {
  document.querySelectorAll('.mb').forEach(b => b.classList.remove('on'));
  el.classList.add('on');
}

// ── TASK POPUP ──
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

// ── ADD TASK ──
function addTask() {
  const txt = document.getElementById('taskInput')?.value.trim();
  if (!txt) { shake(document.getElementById('taskInput')); return; }

  const deadlineDate = document.getElementById('taskDeadlineDate')?.value || '';
  const deadlineTime = document.getElementById('taskDeadlineTime')?.value || '';
  const duration     = parseInt(document.getElementById('taskDuration')?.value || '0') || 0;

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

  const tasks = Storage.getTasks();
  tasks.push(task);
  Storage.saveTasks(tasks);

  if (taskForBlock) {
    addTaskToBlock(task, taskForBlock);
  } else if (selCol === 'block') {
    const t = document.createElement('div'); t.className = 'bitem'; t.onclick = function() { toggleBT(this); };
    t.innerHTML = `<div class="bcb"></div><div class="bpip" style="background:${selDom}"></div><span class="btt">${txt}</span>`;
    document.getElementById('ablock')?.appendChild(t);
  } else {
    const col = document.getElementById('col-' + selCol);
    if (col) {
      const t = document.createElement('div'); t.className = 'task'; t.dataset.id = task.id;
      t.onclick = function(e) { if (!e.target.classList.contains('task-edit-btn')) toggleTask(this); };
      const dlFlag = deadlineDate ? `<span class="task-dl-flag">📅 ${formatDeadline(deadlineDate, deadlineTime)}</span>` : '';
      t.innerHTML = `<div class="tcb"></div><div class="pip" style="background:${selDom}"></div><span class="tt">${txt}</span>${dlFlag}<button class="task-edit-btn" onclick="openTaskEdit(this.closest('.task'),event)" title="edit">···</button>`;
      col.appendChild(t);
    }
    const chip = document.createElement('div'); chip.className = 'tray-chip';
    chip.innerHTML = `<div class="cpip" style="background:${selDom}"></div>${txt}`;
    document.getElementById('trayChips')?.appendChild(chip);
    const qi = document.createElement('div'); qi.className = 'fqi';
    qi.innerHTML = `<div class="fqn">${document.querySelectorAll('.fqi').length + 1}</div><div class="fqp" style="background:${selDom}"></div><div class="fqt">${txt}</div>`;
    document.getElementById('flowQueue')?.appendChild(qi);
  }

  if (deadlineDate) { renderWeekDeadlines(); buildWeekGrid(); }

  ['taskInput','taskDeadlineDate','taskDeadlineTime','taskDuration'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  taskForBlock = null;
  closePop();
  updateDomainRings();
}

function formatDeadline(date, time) {
  if (!date) return '';
  const d = new Date(date + (time ? 'T' + time : 'T00:00'));
  if (isNaN(d)) return date;
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + (time ? ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '');
}

// ── DEADLINE TASKS IN WEEK VIEW ──
function renderWeekDeadlines() {
  const container = document.getElementById('weekDeadlines');
  if (!container) return;
  const tasks = Storage.getTasks().filter(t => t.deadlineDate);
  const today = new Date();
  const dow = today.getDay();
  const weekStart = new Date(today); weekStart.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1));
  const weekEnd   = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 6);
  weekStart.setHours(0, 0, 0, 0); weekEnd.setHours(23, 59, 59, 999);

  const thisWeek = tasks.filter(t => {
    const d = new Date(t.deadlineDate + 'T00:00');
    return d >= weekStart && d <= weekEnd;
  }).sort((a, b) => new Date(a.deadlineDate) - new Date(b.deadlineDate));

  const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const domMeta  = { 'var(--gm)': 'personal', 'var(--te)': 'work', 'var(--pl)': 'brain', 'var(--ru)': 'body' };

  if (!thisWeek.length) {
    container.innerHTML = '<div class="wdi-empty">no deadlines this week · tap + add to add one</div>';
  } else {
    container.innerHTML = thisWeek.map(t => {
      const d = new Date(t.deadlineDate + 'T00:00');
      const timeStr   = t.deadlineTime ? ' · ' + t.deadlineTime : '';
      const doneStyle = t.done ? 'opacity:.5;text-decoration:line-through;' : '';
      return `<div class="wdi" data-id="${t.id}" style="${doneStyle}"><div class="wdd">${dayNames[d.getDay()]}</div><div class="wdp" style="background:${t.dom}"></div><div style="flex:1"><div class="wdt">${t.text}</div><div class="wdm">${domMeta[t.dom] || ''}${timeStr}</div></div><button class="wdi-del" onclick="deleteDeadlineTask(${t.id})">×</button></div>`;
    }).join('');
  }
}

function deleteDeadlineTask(id) {
  let tasks = Storage.getTasks();
  tasks = tasks.filter(t => t.id !== id);
  Storage.saveTasks(tasks);
  renderWeekDeadlines();
  buildWeekGrid();
  const el = document.querySelector(`.task[data-id="${id}"]`);
  if (el) el.remove();
}

// ── TIME-BLOCKED SCHEDULING ──
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
  if (t.done) return; // completed tasks don't re-render — data persists, view stays clean
  if (t.blockSlot) { addTaskToBlock(t, t.blockSlot); return; }
  const col = document.getElementById('col-' + t.col);
  if (!col) return;
  const el = document.createElement('div'); el.className = 'task'; el.dataset.id = t.id;
  el.onclick = function(e) { if (!e.target.classList.contains('task-edit-btn')) toggleTask(this); };
  const dlFlag = t.deadlineDate ? `<span class="task-dl-flag">📅 ${formatDeadline(t.deadlineDate, t.deadlineTime)}</span>` : '';
  el.innerHTML = `<div class="tcb${t.done ? ' done' : ''}"></div><div class="pip" style="background:${t.dom}"></div><span class="tt${t.done ? ' done' : ''}">${t.text}</span>${dlFlag}<button class="task-edit-btn" onclick="openTaskEdit(this.closest('.task'),event)" title="edit">···</button>`;
  col.appendChild(el);
}

function toggleTask(el) {
  const cb  = el.querySelector('.tcb');
  const wasDone = cb.classList.contains('done');
  if (wasDone) return; // already done — no toggle back from the checkbox

  flash();

  const id    = parseInt(el.dataset.id);
  const tasks = Storage.getTasks();
  const found = tasks.find(t => t.id === id);
  if (!found) return;

  // mark done in storage immediately
  found.done = true;
  Storage.saveTasks(tasks);

  const count = Math.max(0, Storage.getTasksDoneCount() + 1);
  Storage.saveTasksDoneCount(count);
  AppState.tasksDoneCount = count;
  setEl('streakTasks', count);
  setEl('statTasks',   count);

  if (found.dom === 'var(--pl)') {
    const bc = Math.max(0, Storage.getBrainTasksCount() + 1);
    Storage.saveBrainTasksCount(bc);
    AppState.brainTasksCount = bc;
    setEl('streakBrain', bc);
  }
  updateDomainRings();

  // animate out after undo window
  el.style.transition = 'opacity .3s, transform .3s';
  el.style.opacity    = '0';
  el.style.transform  = 'translateX(16px)';
  const removeTimer = setTimeout(() => el.remove(), 300);

  // undo toast
  showUndoToast(found.text, () => {
    // undo — restore task
    clearTimeout(removeTimer);
    el.style.opacity   = '1';
    el.style.transform = '';
    found.done = false;
    Storage.saveTasks(tasks);

    const uc = Math.max(0, Storage.getTasksDoneCount() - 1);
    Storage.saveTasksDoneCount(uc);
    AppState.tasksDoneCount = uc;
    setEl('streakTasks', uc);
    setEl('statTasks',   uc);

    if (found.dom === 'var(--pl)') {
      const ubc = Math.max(0, Storage.getBrainTasksCount() - 1);
      Storage.saveBrainTasksCount(ubc);
      AppState.brainTasksCount = ubc;
      setEl('streakBrain', ubc);
    }
    updateDomainRings();
  });
}

// ── UNDO TOAST ──
let _undoToastTimer = null;

function showUndoToast(taskText, onUndo) {
  // clear any existing toast
  const existing = document.getElementById('undoToast');
  if (existing) existing.remove();
  if (_undoToastTimer) clearTimeout(_undoToastTimer);

  const toast = document.createElement('div');
  toast.id = 'undoToast';
  toast.innerHTML = `<span class="undo-label">task complete</span><button class="undo-btn" id="undoBtn">undo</button>`;
  document.body.appendChild(toast);

  // trigger entrance animation
  requestAnimationFrame(() => toast.classList.add('show'));

  const dismiss = () => {
    toast.classList.remove('show');
    setTimeout(() => { if (toast.parentNode) toast.remove(); }, 300);
  };

  document.getElementById('undoBtn').addEventListener('click', () => {
    onUndo();
    dismiss();
    clearTimeout(_undoToastTimer);
  });

  _undoToastTimer = setTimeout(dismiss, 4500);
}

function toggleBT(el) {
  el.querySelector('.bcb').classList.toggle('done');
  el.querySelector('.btt').classList.toggle('done');
  flash();
}

// ── TASK EDIT / DELETE ──
let editingTaskId  = null;
let editingTaskEl  = null;
let editingTaskDom = 'var(--gm)';

function openTaskEdit(el, e) {
  e.stopPropagation();
  editingTaskId = parseInt(el.dataset.id);
  editingTaskEl = el;
  const tasks = Storage.getTasks();
  const task  = tasks.find(t => t.id === editingTaskId);
  if (!task) return;
  editingTaskDom = task.dom || 'var(--gm)';
  document.getElementById('editTaskInput').value = task.text;
  const domMap = { 'var(--gm)': 'edc-personal', 'var(--te)': 'edc-work', 'var(--pl)': 'edc-brain', 'var(--ru)': 'edc-body' };
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
  const tasks = Storage.getTasks();
  const task  = tasks.find(t => t.id === editingTaskId);
  if (task) { task.text = txt; task.dom = editingTaskDom; Storage.saveTasks(tasks); }
  if (editingTaskEl) {
    const tt  = editingTaskEl.querySelector('.tt');
    const pip = editingTaskEl.querySelector('.pip');
    if (tt)  tt.textContent           = txt;
    if (pip) pip.style.background     = editingTaskDom;
  }
  editingTaskId = null; editingTaskEl = null;
  closePop();
  updateDomainRings();
}

function deleteTask() {
  if (!editingTaskId) return;
  let tasks = Storage.getTasks();
  const task = tasks.find(t => t.id === editingTaskId);
  if (task && task.done) {
    const count = Math.max(0, Storage.getTasksDoneCount() - 1);
    Storage.saveTasksDoneCount(count);
    AppState.tasksDoneCount = count;
    setEl('streakTasks', count);
    setEl('statTasks',   count);
    if (task.dom === 'var(--pl)') {
      const bc = Math.max(0, Storage.getBrainTasksCount() - 1);
      Storage.saveBrainTasksCount(bc);
      AppState.brainTasksCount = bc;
      setEl('streakBrain', bc);
    }
  }
  tasks = tasks.filter(t => t.id !== editingTaskId);
  Storage.saveTasks(tasks);
  if (editingTaskEl) {
    editingTaskEl.style.opacity   = '0';
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
  const n    = new Date();
  const time = n.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' · ' + n.toLocaleDateString([], { month: 'short', day: 'numeric' });
  const item = { text: txt, time, id: Date.now() };
  const dumps = Storage.getDumps();
  dumps.unshift(item);
  Storage.saveDumps(dumps);

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
  const txt  = item.querySelector('.di-text').textContent.slice(0, 50);
  const col  = document.getElementById('col-later');
  if (col) {
    const task = { text: txt, col: 'later', dom: 'var(--pl)', done: false, id: Date.now() };
    const tasks = Storage.getTasks(); tasks.push(task); Storage.saveTasks(tasks);
    const t = document.createElement('div'); t.className = 'task'; t.dataset.id = task.id; t.onclick = function() { toggleTask(this); };
    t.innerHTML = `<div class="tcb"></div><div class="pip" style="background:var(--pl)"></div><span class="tt">${txt}</span>`;
    col.appendChild(t);
    updateDomainRings();
  }
  removeItem(item);
}

function archiveItem(btn) { removeItem(btn.closest('.di-item')); }

function removeItem(item) {
  item.style.opacity   = '0';
  item.style.transform = 'translateX(20px)';
  item.style.transition = 'all .3s';
  setTimeout(() => {
    const id    = parseInt(item.dataset.id);
    item.remove();
    const dumps = Storage.getDumps().filter(d => d.id !== id);
    Storage.saveDumps(dumps);
    const inbox = document.getElementById('dumpInbox');
    if (inbox && !inbox.querySelector('.di-item')) inbox.innerHTML = '<div style="text-align:center;padding:24px;font-size:13px;color:var(--t3);font-style:italic">your brain dump inbox is empty</div>';
  }, 300);
}
