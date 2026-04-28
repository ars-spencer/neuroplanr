// ─────────────────────────────────────────────────────
// NEUROPLANR — insights.js
// Insights tab, domain rings, domain balance bar.
// Reads: AppState, Storage
// Future: replace hardcoded logic with real pattern analysis
// ─────────────────────────────────────────────────────

// ── INSIGHTS TAB ──
function refreshInsightsTab() {
  setEl('statTasks',  AppState.tasksDoneCount);
  setEl('statStreak', AppState.ciStreak);
  setEl('statDumps',  Storage.getDumps().length);
  updateInsightHeadline(AppState.userName, AppState.ciStreak, AppState.tasksDoneCount);
  updateDomainBalance();
  const chaosUsed = Storage.getChaosUsed();
  const chaosCard = document.getElementById('chaosInsightText');
  if (chaosCard && chaosUsed > 0) {
    chaosCard.textContent = `"you've used chaos mode ${chaosUsed} time${chaosUsed !== 1 ? 's' : ''} — and came back each time. that's real resilience."`;
  }
}

function updateInsightHeadline(name, streak, tasks) {
  const el = document.getElementById('insightHeadline');
  let msg = 'keep showing up — that\'s the whole game.';
  if (streak > 0) msg = streak + ' day' + (streak > 1 ? 's' : '') + ' in a row. that\'s real.';
  else if (tasks > 5) msg = tasks + ' tasks done. your brain is working.';
  if (el) el.textContent = msg;
  const body = document.getElementById('insightBody');
  if (body && streak > 0) body.textContent = `you've checked in ${streak} day${streak > 1 ? 's' : ''} in a row and completed ${tasks} task${tasks !== 1 ? 's' : ''} this week. your patterns are starting to emerge.`;
}

// ── DOMAIN RINGS ──
function updateDomainRings() {
  const tasks = Storage.getTasks();
  if (!tasks.length) return;
  const C = 169.6; // 2π × r=27
  const doms = [
    { key: 'var(--gm)', ringId: 'ring-personal', pctId: 'ring-pct-personal' },
    { key: 'var(--te)', ringId: 'ring-work',      pctId: 'ring-pct-work'     },
    { key: 'var(--pl)', ringId: 'ring-brain',     pctId: 'ring-pct-brain'    },
    { key: 'var(--ru)', ringId: 'ring-body',      pctId: 'ring-pct-body'     },
  ];
  doms.forEach(({ key, ringId, pctId }) => {
    const dt   = tasks.filter(t => t.dom === key);
    const done = dt.filter(t => t.done).length;
    const pct  = dt.length ? Math.round((done / dt.length) * 100) : 0;
    const fill = (pct / 100) * C;
    const ring  = document.getElementById(ringId);
    const pctEl = document.getElementById(pctId);
    if (ring)  ring.setAttribute('stroke-dasharray', `${fill.toFixed(1)} ${(C - fill).toFixed(1)}`);
    if (pctEl) pctEl.textContent = pct + '%';
  });
}

// ── DOMAIN BALANCE BAR ──
function updateDomainBalance() {
  const tasks = Storage.getTasks();
  if (!tasks.length) return;
  const counts = { 'var(--gm)': 0, 'var(--te)': 0, 'var(--pl)': 0, 'var(--ru)': 0 };
  tasks.forEach(t => { if (counts[t.dom] !== undefined) counts[t.dom]++; });
  const max = Math.max(...Object.values(counts), 1);
  const map = {
    'var(--gm)': { fill: 'db-fill-personal', val: 'db-val-personal' },
    'var(--te)': { fill: 'db-fill-work',     val: 'db-val-work'     },
    'var(--pl)': { fill: 'db-fill-brain',    val: 'db-val-brain'    },
    'var(--ru)': { fill: 'db-fill-body',     val: 'db-val-body'     },
  };
  Object.entries(map).forEach(([dom, ids]) => {
    const pct    = Math.round((counts[dom] / max) * 100);
    const fillEl = document.getElementById(ids.fill);
    const valEl  = document.getElementById(ids.val);
    if (fillEl) fillEl.style.width = pct + '%';
    if (valEl)  valEl.textContent  = pct + '%';
  });
}
