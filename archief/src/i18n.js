import { S } from './state.js';

const translations = {
  nl: {
    welcome_coach: 'Welkom bij Cluppie',
    email: 'E-mailadres',
    password: 'Wachtwoord',
    login: 'Inloggen',
    no_account: 'Nog geen account?',
    register: 'Registreren',
    select_club: 'Selecteer uw club',
    user_email: 'Gebruiker',
    role: 'Rol',
    select: 'Selecteer',
    logout: 'Uitloggen',
    teams: 'Teams',
    players: 'Spelers',
    coaching_layers: 'Trainingsniveaus',
    admin: 'Beheer',
    back_to_clubs: 'Terug naar clubs',
    select_team_for_players: 'Selecteer een team om spelers te zien',
    club_settings_here: 'Clubinstellingen',
    language: 'Taal'
  },
  en: {
    welcome_coach: 'Welcome to Cluppie',
    email: 'Email Address',
    password: 'Password',
    login: 'Login',
    no_account: 'Don\'t have an account?',
    register: 'Register',
    select_club: 'Select Your Club',
    user_email: 'User',
    role: 'Role',
    select: 'Select',
    logout: 'Logout',
    teams: 'Teams',
    players: 'Players',
    coaching_layers: 'Coaching Layers',
    admin: 'Admin',
    back_to_clubs: 'Back to Clubs',
    select_team_for_players: 'Select a team to view players',
    club_settings_here: 'Club Settings',
    language: 'Language'
  }
};

/**
 * Get translation for key in current language
 */
export function t(key) {
  const lang = S.lang || 'nl';
  return translations[lang]?.[key] || translations.en[key] || key;
}

/**
 * Change language
 */
export function setLanguage(lang) {
  if (translations[lang]) {
    S.lang = lang;
  }
}

/**
 * Get available languages
 */
export function getLanguages() {
  return Object.keys(translations);
}
