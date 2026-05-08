import { getActivitySettings, saveActivitySetting } from './activities.js';

// Conversions (stored units are: temperature = °F, precip = inches, wind = mph, radius = meters)
const F_TO_C = (f) => (f - 32) * 5 / 9;
const C_TO_F = (c) => (c * 9 / 5) + 32;
const IN_TO_MM = (inch) => inch * 25.4;
const MM_TO_IN = (mm) => mm / 25.4;
const MPH_TO_KPH = (mph) => mph * 1.60934;
const KPH_TO_MPH = (kph) => kph / 1.60934;
const M_TO_MILES = (m) => m / 1609.344;
const MILES_TO_M = (miles) => miles * 1609.344;
const M_TO_KM = (m) => m / 1000;
const KM_TO_M = (km) => km * 1000;

function initActivitySettings() {
  const settings = getActivitySettings();

  const apiKeyInput = document.getElementById('places-api-key');
  if (apiKeyInput) {
    apiKeyInput.value = localStorage.getItem('tripcast-places-api-key') || '';
    apiKeyInput.addEventListener('change', () =>
      localStorage.setItem('tripcast-places-api-key', apiKeyInput.value.trim()));
  }

  const minTempInput = document.getElementById('activity-min-temp');
  const tempUnitLabel = document.getElementById('activity-temp-unit');
  const maxPrecipInput = document.getElementById('activity-max-precip');
  const precipUnitLabel = document.getElementById('activity-precip-unit');
  const maxWindInput = document.getElementById('activity-max-wind');
  const windUnitLabel = document.getElementById('activity-wind-unit');
  const radiusInput = document.getElementById('activity-radius');
  const radiusUnitLabel = document.getElementById('activity-radius-unit');
  const catCheckboxes = document.querySelectorAll('input[name="activity-cat"]');
  const unitsSelect = document.getElementById('units-select');

  function isMetric() {
    return (localStorage.getItem('tripcast-units') || 'imperial') === 'metric';
  }

  function refreshDisplayFromStored() {
    const metric = isMetric();
    // Temperature
    if (minTempInput) {
      const displayTemp = metric ? Math.round(F_TO_C(settings.minTemp)) : Math.round(settings.minTemp);
      minTempInput.value = displayTemp;
      if (tempUnitLabel) tempUnitLabel.textContent = metric ? '°C' : '°F';
    }
    // Precipitation
    if (maxPrecipInput) {
      const displayPrecip = metric ? Number(IN_TO_MM(settings.maxPrecip).toFixed(2)) : Number(settings.maxPrecip);
      maxPrecipInput.value = displayPrecip;
      if (precipUnitLabel) precipUnitLabel.textContent = metric ? 'mm' : 'in';
    }
    // Wind
    if (maxWindInput) {
      const displayWind = metric ? Math.round(MPH_TO_KPH(settings.maxWind)) : Math.round(settings.maxWind);
      maxWindInput.value = displayWind;
      if (windUnitLabel) windUnitLabel.textContent = metric ? 'kph' : 'mph';
    }
    // Radius
    if (radiusInput) {
      radiusInput.value = metric
        ? Number(M_TO_KM(settings.radius).toFixed(1))
        : Number(M_TO_MILES(settings.radius).toFixed(2));
      if (radiusUnitLabel) radiusUnitLabel.textContent = metric ? 'km' : 'mi';
    }
  }

  // Input -> stored conversions
  if (minTempInput) {
    minTempInput.addEventListener('change', () => {
      const metric = isMetric();
      const v = parseFloat(minTempInput.value);
      if (Number.isFinite(v)) {
        const storeVal = metric ? Math.round(C_TO_F(v)) : Math.round(v);
        saveActivitySetting('minTemp', storeVal);
      }
      // Refresh display from stored settings to keep consistency
      Object.assign(settings, getActivitySettings());
      refreshDisplayFromStored();
    });
  }

  if (maxPrecipInput) {
    maxPrecipInput.addEventListener('change', () => {
      const metric = isMetric();
      const v = parseFloat(maxPrecipInput.value);
      if (Number.isFinite(v)) {
        const storeVal = metric ? Number(MM_TO_IN(v).toFixed(3)) : v;
        saveActivitySetting('maxPrecip', storeVal);
      }
      Object.assign(settings, getActivitySettings());
      refreshDisplayFromStored();
    });
  }

  if (maxWindInput) {
    maxWindInput.addEventListener('change', () => {
      const metric = isMetric();
      const v = parseFloat(maxWindInput.value);
      if (Number.isFinite(v)) {
        const storeVal = metric ? Math.round(KPH_TO_MPH(v)) : Math.round(v);
        saveActivitySetting('maxWind', storeVal);
      }
      Object.assign(settings, getActivitySettings());
      refreshDisplayFromStored();
    });
  }

  if (radiusInput) {
    radiusInput.addEventListener('change', () => {
      const metric = isMetric();
      const v = parseFloat(radiusInput.value);
      if (Number.isFinite(v) && v > 0) {
        const meters = Math.round(metric ? KM_TO_M(v) : MILES_TO_M(v));
        saveActivitySetting('radius', meters);
      }
      Object.assign(settings, getActivitySettings());
      refreshDisplayFromStored();
    });
  }

  catCheckboxes.forEach((cb) => {
    cb.checked = settings.categories.includes(cb.value);
    cb.addEventListener('change', () => {
      const selected = [...document.querySelectorAll('input[name="activity-cat"]:checked')]
        .map((el) => el.value);
      saveActivitySetting('categories', selected);
    });
  });

  // When the global units select changes (temperature/metric toggle), refresh UI
  if (unitsSelect) {
    unitsSelect.addEventListener('change', () => {
      // unit value already saved by theme.js; just refresh display
      Object.assign(settings, getActivitySettings());
      refreshDisplayFromStored();
    });
  }

  // Initial render
  refreshDisplayFromStored();
}

document.addEventListener('DOMContentLoaded', initActivitySettings);
