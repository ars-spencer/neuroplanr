// ─────────────────────────────────────────────────────
// NEUROPLANR — state.js
// Single source of truth for the running app.
// All modules READ from AppState. Only app.js WRITES to it
// (on init and when the user logs a check-in).
//
// On launch today: populated from localStorage via Storage.
// On launch post-Supabase: populated from the cloud after login.
// Modules never need to change — they always just read AppState.
// ─────────────────────────────────────────────────────

const AppState = {

  // ── Profile layer (stable — set at onboarding) ──
  userName: 'you',
  peakTimes: [],           // e.g. ['morning', 'mid-morning']
  checkInTiles: [],        // which CI tiles the user enabled
  anchor: '',              // habit anchor location
  dopamineMenu: [],        // user's dopamine menu items
  onboardingDone: false,

  // ── Session layer (updates as the user logs today) ──
  energy: null,            // 'low' | 'med' | 'high'
  mood: null,              // '+' | '~' | '–'
  cyclePhase: null,        // 'menstrual' | 'follicular' | 'ovulation' | 'luteal'
  meds: null,              // raw value from CI tile
  todayCI: {},             // full CI object for today { 0: {val, color}, ... }

  // ── Derived (computed on load, used by features) ──
  // mood-reactive features read these booleans so they
  // don't need to know the raw values
  isLowEnergy: false,
  isLuteal: false,
  isMenstrual: false,

  // ── Stats ──
  ciStreak: 0,
  tasksDoneCount: 0,
  brainTasksCount: 0,
};

// ── HYDRATE from storage ──
// Called once on app init (and later: once after Supabase login).
// Reads all persisted data and populates AppState.
function hydrateAppState() {
  AppState.userName        = Storage.getUserName();
  AppState.peakTimes       = Storage.getPeakTimes();
  AppState.checkInTiles    = Storage.getCheckInTiles();
  AppState.anchor          = Storage.getAnchor();
  AppState.dopamineMenu    = Storage.getDopamineMenu();
  AppState.onboardingDone  = Storage.getOnboardingDone();
  AppState.ciStreak        = Storage.getCIStreak();
  AppState.tasksDoneCount  = Storage.getTasksDoneCount();
  AppState.brainTasksCount = Storage.getBrainTasksCount();

  // Restore today's CI if it was logged today
  const today = new Date().toDateString();
  if (Storage.getCIDay() === today) {
    const ci = Storage.getTodayCI();
    AppState.todayCI   = ci;
    AppState.energy    = ci[0]?.val || null;
    AppState.cyclePhase = ci[1]?.val || null;
    AppState.mood      = ci[2]?.val || null;
    AppState.meds      = ci[3]?.val || null;
  }

  // Compute derived booleans
  updateDerivedState();
}

// ── UPDATE derived booleans after any CI change ──
// Call this whenever energy, mood, or cyclePhase changes.
function updateDerivedState() {
  AppState.isLowEnergy  = AppState.energy === 'low';
  AppState.isLuteal     = AppState.cyclePhase === 'luteal';
  AppState.isMenstrual  = AppState.cyclePhase === 'menstrual';
}

// ── WRITE from onboarding ──
// Called at the end of finishOnboarding() so the app
// immediately reflects the user's setup without a reload.
function applyOnboardingToState(data) {
  AppState.userName       = data.name       || 'you';
  AppState.peakTimes      = data.peakTimes  || [];
  AppState.checkInTiles   = data.ci         || [];
  AppState.anchor         = data.anchor     || '';
  AppState.dopamineMenu   = data.dopamine   || [];
  AppState.onboardingDone = true;
}
