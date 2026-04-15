const THEME_KEY = 'tripcast-theme';
const SECRET_BG_KEY = 'tripcast-secret-bg';

function getSavedTheme() {
    return localStorage.getItem(THEME_KEY) || 'light';
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
