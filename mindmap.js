// ─────────────────────────────────────────────────────
// NEUROPLANR — mindmap.js
// Infinite canvas mind map: drag, pan, pinch-zoom,
// double-tap (mobile), connect nodes, seed from brain dump.
// Reads: Storage (mmNodes, mmEdges)
// Writes: Storage
// ─────────────────────────────────────────────────────

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
  canvas.addEventListener('touchstart', e => {
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    const target = e.target;
    const isBackground = target === canvas || target.id === 'mmSvg' || target.tagName === 'path';
    if (!isBackground) return;

    const now = Date.now();
    const dx  = t.clientX - mm._lastTapX;
    const dy  = t.clientY - mm._lastTapY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (now - mm._lastTap < 350 && dist < 30) {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const cx = (t.clientX - rect.left) / mm.scale - mm.panX;
      const cy = (t.clientY - rect.top)  / mm.scale - mm.panY;
      mmAddNode('', Math.round(cx - 70), Math.round(cy - 22));
      mm._lastTap = 0;
    } else {
      mm._lastTap  = now;
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
        const ratio    = newDist / mm._pinchDist;
        const newScale = Math.min(3, Math.max(0.25, mm.scale * ratio));
        if (mm._pinchMid) {
          mm.panX -= mm._pinchMid.x * (1 / newScale - 1 / mm.scale);
          mm.panY -= mm._pinchMid.y * (1 / newScale - 1 / mm.scale);
        }
        mm.scale      = newScale;
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

  // ── MOUSE WHEEL ZOOM (desktop) ──
  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    const rect  = canvas.getBoundingClientRect();
    const mx    = (e.clientX - rect.left) / mm.scale;
    const my    = (e.clientY - rect.top)  / mm.scale;
    const delta    = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.min(3, Math.max(0.25, mm.scale * delta));
    mm.panX -= mx * (1 / newScale - 1 / mm.scale);
    mm.panY -= my * (1 / newScale - 1 / mm.scale);
    mm.scale = newScale;
    mmRerender();
  }, { passive: false });
}

// ── PINCH HELPERS ──
function mmPinchDist(touches) {
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

function mmPinchMid(touches, canvas) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((touches[0].clientX + touches[1].clientX) / 2 - rect.left) / mm.scale,
    y: ((touches[0].clientY + touches[1].clientY) / 2 - rect.top)  / mm.scale,
  };
}

// ── OPEN / CLOSE / LOAD ──
function openMindMap(seedText) {
  goTab('map');
  if (seedText) {
    const canvas = document.getElementById('mmCanvas');
    const rect   = canvas ? canvas.getBoundingClientRect() : { width: 390, height: 500 };
    setTimeout(() => {
      mmAddNode(seedText, Math.round(rect.width / 2 - mm.panX - 70), Math.round(rect.height / 2 - mm.panY - 40));
    }, 100);
  }
}

function closeMindMap() { goTab('track'); }

function mmLoadData() {
  mm.nodes  = Storage.getMMNodes();
  mm.edges  = Storage.getMMEdges();
  mm.nextId = mm.nodes.length ? Math.max(...mm.nodes.map(n => n.id)) + 1 : 1;
  mmRerender();
}

function saveMM() {
  Storage.saveMMNodes(mm.nodes);
  Storage.saveMMEdges(mm.edges);
}

// ── NODE OPERATIONS ──
function mmAddNode(text, x, y) {
  const id = mm.nextId++;
  mm.nodes.push({ id, text: text || '', x: x || 100, y: y || 100 });
  saveMM();
  mmRerender();
  setTimeout(() => {
    const el = document.querySelector(`.mm-node[data-id="${id}"] .mm-node-text`);
    if (el) {
      el.focus();
      if (text) { const r = document.createRange(); r.selectNodeContents(el); const s = window.getSelection(); s.removeAllRanges(); s.addRange(r); }
    }
  }, 80);
}

function mmDeleteNode(id) {
  mm.nodes = mm.nodes.filter(n => n.id !== id);
  mm.edges = mm.edges.filter(e => e.from !== id && e.to !== id);
  if (mm.connecting === id) { mm.connecting = null; setEl('mmConnectHint', 'tap two nodes to connect them'); }
  saveMM();
  mmRerender();
}

// ── EDGE DRAWING ──
function mmUpdateEdges() {
  const svg = document.getElementById('mmSvg');
  if (!svg) return;
  svg.innerHTML = mmEdgePaths();
}

function mmEdgePaths() {
  return mm.edges.map(e => {
    const a = mm.nodes.find(n => n.id === e.from), b = mm.nodes.find(n => n.id === e.to);
    if (!a || !b) return '';
    const ax = (a.x + mm.panX + 70) * mm.scale, ay = (a.y + mm.panY + 22) * mm.scale;
    const bx = (b.x + mm.panX + 70) * mm.scale, by = (b.y + mm.panY + 22) * mm.scale;
    const mx = (ax + bx) / 2, my = (ay + by) / 2 - 30 * mm.scale;
    return `<path d="M${ax},${ay} Q${mx},${my} ${bx},${by}" stroke="var(--ga)" stroke-width="1.5" fill="none" opacity="0.55" stroke-linecap="round"/>`;
  }).join('');
}

// ── FULL RERENDER ──
function mmRerender() {
  const canvas = document.getElementById('mmCanvas');
  if (!canvas) return;

  const hint = document.getElementById('mmEmptyHint');
  if (hint) hint.style.display = mm.nodes.length === 0 ? '' : 'none';

  let svg = document.getElementById('mmSvg');
  if (!svg) {
    svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
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
      const node = mm.nodes.find(x => x.id === n.id);
      if (node) { node.text = textEl.textContent; saveMM(); }
    });
    textEl.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); textEl.blur(); } });

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
      mm.dragOffset = { x: (e.clientX - rect.left), y: (e.clientY - rect.top) };
      e.preventDefault();
    });

    canvas.appendChild(el);
  });
}

function escHtml(s) {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ── CONNECT MODE ──
function mmHandleConnect(id) {
  if (mm.connecting === null) {
    mm.connecting = id;
    setEl('mmConnectHint', 'now tap another node — tap same to cancel');
    document.querySelectorAll('.mm-node').forEach(el => el.classList.toggle('mm-node-connecting', parseInt(el.dataset.id) === id));
  } else if (mm.connecting === id) {
    mm.connecting = null;
    setEl('mmConnectHint', 'tap two nodes to connect them');
    document.querySelectorAll('.mm-node').forEach(el => el.classList.remove('mm-node-connecting'));
  } else {
    const exists = mm.edges.some(e => (e.from === mm.connecting && e.to === id) || (e.from === id && e.to === mm.connecting));
    if (exists) mm.edges = mm.edges.filter(e => !((e.from === mm.connecting && e.to === id) || (e.from === id && e.to === mm.connecting)));
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
  if (hint) hint.style.display = mode === 'connect' ? 'block' : 'none';
  document.querySelectorAll('.mm-node').forEach(el => el.classList.remove('mm-node-connecting'));
}

// ── TOOLBAR BUTTONS ──
function mmAddNodeBtn() {
  const canvas = document.getElementById('mmCanvas');
  const rect   = canvas ? canvas.getBoundingClientRect() : { width: 390, height: 600 };
  const x = Math.round(rect.width  / 2 - mm.panX - 70 + (Math.random() - 0.5) * 120);
  const y = Math.round(rect.height / 2 - mm.panY - 22 + (Math.random() - 0.5) * 80);
  mmAddNode('', x, y);
}

function mmClearAll() {
  if (mm.nodes.length === 0) return;
  if (!confirm('clear all nodes? this cannot be undone.')) return;
  mm.nodes = []; mm.edges = []; mm.nextId = 1; mm.connecting = null;
  saveMM();
  mmRerender();
}

// ── SEED FROM BRAIN DUMP ──
function sendToMindMap(btn) {
  const item = btn.closest('.di-item');
  const txt  = item.querySelector('.di-text').textContent.slice(0, 100);
  removeItem(item);
  openMindMap(txt);
}

function mmSeedFromDumps() {
  const dumps = Storage.getDumps();
  if (!dumps.length) { alert('no brain dumps yet — add some first!'); return; }
  const canvas = document.getElementById('mmCanvas');
  const rect   = canvas ? canvas.getBoundingClientRect() : { width: 390, height: 500 };
  const cx = rect.width  / 2 - mm.panX;
  const cy = rect.height / 2 - mm.panY;
  const existing = mm.nodes.map(n => n.text.trim());
  let added = 0;
  dumps.forEach((d, i) => {
    if (existing.includes(d.text.trim())) return;
    const angle  = (i / dumps.length) * Math.PI * 2;
    const radius = 110 + Math.random() * 40;
    const x = Math.round(cx + Math.cos(angle) * radius - 70);
    const y = Math.round(cy + Math.sin(angle) * radius - 22);
    mm.nodes.push({ id: mm.nextId++, text: d.text.slice(0, 80), x, y, dumpId: d.id });
    added++;
  });
  saveMM();
  mmRerender();
  const hint = document.getElementById('mmEmptyHint');
  if (hint) hint.style.display = 'none';
}
