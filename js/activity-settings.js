import { getActivitySettings, saveActivitySetting } from './activities.js';

function initActivitySettings() {
  const settings = getActivitySettings();
  const unit = localStorage.getItem('tripcast-units') || 'fahrenheit';

  const apiKeyInput = document.getElementById('places-api-key');
  if (apiKeyInput) {
    apiKeyInput.value = localStorage.getItem('tripcast-places-api-key') || '';
    apiKeyInput.addEventListener('change', () =>
      localStorage.setItem('tripcast-places-api-key', apiKeyInput.value.trim()));
  }

  const minTempInput = document.getElementById('activity-min-temp');
  const tempUnitLabel = document.getElementById('activity-temp-unit');
  const maxPrecipInput = document.getElementById('activity-max-precip');
  const maxWindInput = document.getElementById('activity-max-wind');
  const radiusSelect = document.getElementById('activity-radius');
  const catCheckboxes = document.querySelectorAll('input[name="activity-cat"]');

  if (minTempInput) {
    minTempInput.value = settings.minTemp;
    if (tempUnitLabel) tempUnitLabel.textContent = unit === 'celsius' ? '°C' : '°F';
    minTempInput.addEventListener('change', () =>
      saveActivitySetting('minTemp', parseFloat(minTempInput.value)));
  }

  if (maxPrecipInput) {
    maxPrecipInput.value = settings.maxPrecip;
    maxPrecipInput.addEventListener('change', () =>
      saveActivitySetting('maxPrecip', parseFloat(maxPrecipInput.value)));
  }

  if (maxWindInput) {
    maxWindInput.value = settings.maxWind;
    maxWindInput.addEventListener('change', () =>
      saveActivitySetting('maxWind', parseFloat(maxWindInput.value)));
  }

  if (radiusSelect) {
    radiusSelect.value = String(settings.radius);
    radiusSelect.addEventListener('change', () =>
      saveActivitySetting('radius', parseInt(radiusSelect.value, 10)));
  }

  catCheckboxes.forEach((cb) => {
    cb.checked = settings.categories.includes(cb.value);
    cb.addEventListener('change', () => {
      const selected = [...document.querySelectorAll('input[name="activity-cat"]:checked')]
        .map((el) => el.value);
      saveActivitySetting('categories', selected);
    });
  });
}

document.addEventListener('DOMContentLoaded', initActivitySettings);
