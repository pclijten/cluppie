// Global state - clubId is CORE
export const S = {
  // Auth
  user: null,
  userId: null,
  
  // Clubs & navigation
  clubId: null,      // ← Which club is coach viewing
  clubs: [],         // Clubs where coach is member
  
  // Current club config
  clubConfig: null,
  clubMembers: [],
  
  // UI state
  view: 'login',     // login | club-picker | home | ...
  lang: 'nl',        // nl | en
  
  // Data
  bouwen: [],
  teams: [],
  matches: [],
  players: [],
  
  // UI
  loading: false,
  error: null,
  
  // Internal
  _render: null
};

export function updateState(updates) {
  Object.assign(S, updates);
  if (S._render) S._render();
}

export function resetState() {
  S.user = null;
  S.userId = null;
  S.clubId = null;
  S.clubs = [];
  S.clubConfig = null;
  S.clubMembers = [];
  S.view = 'login';
  S.bouwen = [];
  S.teams = [];
  S.matches = [];
  S.players = [];
  S.loading = false;
  S.error = null;
  if (S._render) S._render();
}
