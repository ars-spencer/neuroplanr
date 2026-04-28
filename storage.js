// ─────────────────────────────────────────────────────
// NEUROPLANR — storage.js
// Central data layer. All reads/writes go through here.
// To migrate to Supabase: rewrite the method bodies only.
// The method names (the interface) never change.
// ─────────────────────────────────────────────────────

// ── RAW ADAPTER (localStorage today, Supabase later) ──
const LS = {
  get: k => { try { return JSON.parse(localStorage.getItem('np_' + k)); } catch(e) { return null; } },
  set: (k, v) => { try { localStorage.setItem('np_' + k, JSON.stringify(v)); } catch(e) {} },
};

// ── NAMED STORAGE METHODS ──
// These are what every module calls. Never call LS directly from feature code.
const Storage = {

  // ── Profile (set at onboarding, stable) ──
  getProfile: () => LS.get('profile') || {},
  saveProfile: (v) => LS.set('profile', v),

  getUserName: () => LS.get('userName') || 'you',
  saveUserName: (v) => LS.set('userName', v),

  getPeakTimes: () => LS.get('peakTimes') || [],
  savePeakTimes: (v) => LS.set('peakTimes', v),

  getCheckInTiles: () => LS.get('checkInTiles') || [],
  saveCheckInTiles: (v) => LS.set('checkInTiles', v),

  getAnchor: () => LS.get('anchor') || '',
  saveAnchor: (v) => LS.set('anchor', v),

  getDopamineMenu: () => LS.get('dopamineMenu') || [],
  saveDopamineMenu: (v) => LS.set('dopamineMenu', v),

  getOnboardingDone: () => LS.get('onboardingDone') || false,
  saveOnboardingDone: (v) => LS.set('onboardingDone', v),

  // ── Session (updates throughout the day) ──
  getTodayCI: () => LS.get('todayCI') || {},
  saveTodayCI: (v) => LS.set('todayCI', v),

  getCIDay: () => LS.get('ciDay') || null,
  saveCIDay: (v) => LS.set('ciDay', v),

  getCIHistory: () => LS.get('ciHistory') || {},
  saveCIHistory: (v) => LS.set('ciHistory', v),

  getCIStreak: () => LS.get('ciStreak') || 0,
  saveCIStreak: (v) => LS.set('ciStreak', v),

  getLastCIDay: () => LS.get('lastCIDay') || null,
  saveLastCIDay: (v) => LS.set('lastCIDay', v),

  // ── Tasks ──
  getTasks: () => LS.get('tasks') || [],
  saveTasks: (v) => LS.set('tasks', v),

  getTasksDoneCount: () => LS.get('tasksDoneCount') || 0,
  saveTasksDoneCount: (v) => LS.set('tasksDoneCount', v),

  getBrainTasksCount: () => LS.get('brainTasksCount') || 0,
  saveBrainTasksCount: (v) => LS.set('brainTasksCount', v),

  // ── Day blocks (keyed by YYYY-MM-DD) ──
  getDayData: (dateKey) => LS.get('day_' + dateKey) || { tasks: {} },
  saveDayData: (dateKey, v) => LS.set('day_' + dateKey, v),

  // ── Brain dump ──
  getDumps: () => LS.get('dumps') || [],
  saveDumps: (v) => LS.set('dumps', v),

  // ── Mind map ──
  getMMNodes: () => LS.get('mmNodes') || [],
  saveMMNodes: (v) => LS.set('mmNodes', v),

  getMMEdges: () => LS.get('mmEdges') || [],
  saveMMEdges: (v) => LS.set('mmEdges', v),

  // ── UI state ──
  getDarkMode: () => LS.get('darkMode') || false,
  saveDarkMode: (v) => LS.set('darkMode', v),

  getChaosUsed: () => LS.get('chaosUsed') || 0,
  saveChaosUsed: (v) => LS.set('chaosUsed', v),
};
