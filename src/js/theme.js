/*
* Used to manage theme settings and the "secret background"easter egg. Saves
* user preferences in localStorage and applies them on page load. Also handles
* responsive adjustments for the secret background based on orientation changes.
*/

const THEME_KEY = 'tripcast-theme';
const UNIT_KEY = 'tripcast-units';
const SECRET_BG_KEY = 'tripcast-secret-bg';

function getSavedTheme() {
    return localStorage.getItem(THEME_KEY) || 'light';
}

function getSavedUnits() {
    return localStorage.getItem(UNIT_KEY) || 'imperial';
}

function getSavedSecretState() {
    return localStorage.getItem(SECRET_BG_KEY) === 'true';
}

function applyTheme(theme) {
    document.body.classList.toggle('dark-mode', theme === 'dark');
}

function saveTheme(theme) {
    localStorage.setItem(THEME_KEY, theme);
    applyTheme(theme);
}

function saveUnits(units) {
    localStorage.setItem(UNIT_KEY, units);
}

function isPortrait() {
    return window.innerHeight >= window.innerWidth;
}

function updateSecretBackgroundClasses(enabled) {
    document.body.classList.toggle('secret-bg', enabled);
    document.body.classList.toggle('secret-portrait', enabled && isPortrait());
    document.body.classList.toggle('secret-landscape', enabled && !isPortrait());
}

function saveSecretState(enabled) {
    localStorage.setItem(SECRET_BG_KEY, enabled ? 'true' : 'false');
    updateSecretBackgroundClasses(enabled);
}

function initTheme() {
    const theme = getSavedTheme();
    applyTheme(theme);

    const themeSelect = document.getElementById('theme-select');
    if (themeSelect) {
        themeSelect.value = theme;
        themeSelect.addEventListener('change', (event) => {
            saveTheme(event.target.value);
        });
    }

    const unitsSelect = document.getElementById('units-select');
    if (unitsSelect) {
        unitsSelect.value = getSavedUnits();
        unitsSelect.addEventListener('change', (event) => {
            saveUnits(event.target.value);
        });
    }

    const settingsForm = document.querySelector('.settings-form');
    if (settingsForm) {
        settingsForm.addEventListener('submit', (event) => {
            event.preventDefault();
        });
    }

    const secretButton = document.getElementById('secret-buttonid');
    const secretEnabled = getSavedSecretState();
    updateSecretBackgroundClasses(secretEnabled);

    if (secretButton) {
        secretButton.addEventListener('click', () => {
            saveSecretState(!getSavedSecretState());
        });
    }

    window.addEventListener('resize', () => {
        updateSecretBackgroundClasses(getSavedSecretState());
    });
    window.addEventListener('orientationchange', () => {
        updateSecretBackgroundClasses(getSavedSecretState());
    });
}

document.addEventListener('DOMContentLoaded', initTheme);
