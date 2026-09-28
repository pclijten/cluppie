import { S, updateState } from './state.js';
import { setupAuthListener, loginUser, registerUser, selectClub, logoutUser } from './auth.js';
import { loadBouwen, loadTeams, loadPlayers } from './firestore.js';
import { t } from './i18n.js';

/**
 * Main app initialization
 */
export function initApp(rootElement) {
  // Register render function in global state
  updateState({ _render: () => render(rootElement) });
  
  // Setup auth listener
  setupAuthListener(() => {
    render(rootElement);
  });
}

/**
 * Main render function
 */
function render(rootElement) {
  const html = getViewHtml();
  rootElement.innerHTML = html;
  attachEventListeners(rootElement);
}

/**
 * Get HTML for current view
 */
function getViewHtml() {
  switch (S.view) {
    case 'login':
      return renderLoginView();
    case 'club-picker':
      return renderClubPickerView();
    case 'home':
      return renderHomeView();
    default:
      return '<p>Unknown view</p>';
  }
}

/**
 * Login view
 */
function renderLoginView() {
  return `
    <div class="view login-view">
      <div class="container">
        <h1>Cluppie</h1>
        <p>${t('welcome_coach')}</p>
        
        <form id="loginForm">
          <div class="form-group">
            <label>${t('email')}:</label>
            <input type="email" id="email" required />
          </div>
          
          <div class="form-group">
            <label>${t('password')}:</label>
            <input type="password" id="password" required />
          </div>
          
          <button type="submit" class="btn btn-primary">${t('login')}</button>
        </form>
        
        <p class="text-center">
          ${t('no_account')} <a href="#" id="switchToRegister">${t('register')}</a>
        </p>
        
        ${S.error ? `<div class="alert alert-danger">${S.error}</div>` : ''}
      </div>
    </div>
  `;
}

/**
 * Club picker view
 */
function renderClubPickerView() {
  return `
    <div class="view club-picker-view">
      <div class="container">
        <h1>${t('select_club')}</h1>
        <p>${t('user_email')}: ${S.user?.email}</p>
        
        <div class="club-list">
          ${S.clubs.map(club => `
            <div class="club-card" data-club-id="${club.id}">
              <h3>${club.name}</h3>
              <p>${t('role')}: ${club.role}</p>
              <button class="btn btn-primary select-club">${t('select')}</button>
            </div>
          `).join('')}
        </div>
        
        <button id="logoutBtn" class="btn btn-secondary">${t('logout')}</button>
        
        ${S.error ? `<div class="alert alert-danger">${S.error}</div>` : ''}
      </div>
    </div>
  `;
}

/**
 * Home view
 */
function renderHomeView() {
  return `
    <div class="view home-view">
      <div class="container">
        <h1>${S.clubConfig?.name || 'Cluppie'}</h1>
        
        <nav class="nav-tabs">
          <button class="nav-tab active" data-tab="teams">${t('teams')}</button>
          <button class="nav-tab" data-tab="players">${t('players')}</button>
          <button class="nav-tab" data-tab="bouwen">${t('coaching_layers')}</button>
          <button class="nav-tab" data-tab="admin">${t('admin')}</button>
        </nav>
        
        <div id="teamsTab" class="tab-content active">
          <h2>${t('teams')}</h2>
          <div class="team-list">
            ${S.teams.map(team => `
              <div class="team-card">
                <h3>${team.name}</h3>
                <p>${team.age_group || ''}</p>
              </div>
            `).join('')}
          </div>
        </div>
        
        <div id="playersTab" class="tab-content">
          <h2>${t('players')}</h2>
          <p>${t('select_team_for_players')}</p>
        </div>
        
        <div id="bouweTab" class="tab-content">
          <h2>${t('coaching_layers')}</h2>
          <div class="bouwen-list">
            ${S.bouwen.map(bouw => `
              <div class="bouw-card">
                <h3>${bouw.name}</h3>
                <p>${bouw.description || ''}</p>
              </div>
            `).join('')}
          </div>
        </div>
        
        <div id="adminTab" class="tab-content">
          <h2>${t('admin')}</h2>
          <p>${t('club_settings_here')}</p>
        </div>
        
        <button id="backBtn" class="btn btn-secondary">${t('back_to_clubs')}</button>
      </div>
    </div>
  `;
}

/**
 * Attach event listeners
 */
function attachEventListeners(rootElement) {
  switch (S.view) {
    case 'login':
      attachLoginListeners(rootElement);
      break;
    case 'club-picker':
      attachClubPickerListeners(rootElement);
      break;
    case 'home':
      attachHomeListeners(rootElement);
      break;
  }
}

function attachLoginListeners(root) {
  const form = root.querySelector('#loginForm');
  const switchLink = root.querySelector('#switchToRegister');
  
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = form.email.value;
      const password = form.password.value;
      const result = await loginUser(email, password);
      if (!result.success) {
        // Error already in state
      }
    });
  }
  
  if (switchLink) {
    switchLink.addEventListener('click', (e) => {
      e.preventDefault();
      // TODO: Switch to register view
    });
  }
}

function attachClubPickerListeners(root) {
  root.querySelectorAll('.select-club').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const clubId = e.target.closest('.club-card').dataset.clubId;
      await selectClub(clubId);
      await loadBouwen();
      await loadTeams();
    });
  });
  
  const logoutBtn = root.querySelector('#logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      await logoutUser();
    });
  }
}

function attachHomeListeners(root) {
  root.querySelectorAll('.nav-tab').forEach(btn => {
    btn.addEventListener('click', (e) => {
      root.querySelectorAll('.nav-tab').forEach(b => b.classList.remove('active'));
      root.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      e.target.classList.add('active');
      const tabId = e.target.dataset.tab + 'Tab';
      const tabEl = root.querySelector('#' + tabId);
      if (tabEl) tabEl.classList.add('active');
    });
  });
  
  const backBtn = root.querySelector('#backBtn');
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      updateState({ view: 'club-picker', clubId: null });
    });
  }
}

export { S, updateState };
