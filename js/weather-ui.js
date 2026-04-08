/**
 * weather-ui.js
 * Handles the Plan a Trip form submission and renders forecast results.
 */

import { getWeatherForTrip } from './weather.js';

const form = document.getElementById('trip-form');
const resultSection = document.getElementById('forecast-result');

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const destination = document.getElementById('destination').value.trim();
  const date = document.getElementById('trip-date').value; // YYYY-MM-DD

  // Show loading state
  resultSection.innerHTML = '<p>Fetching forecast…</p>';

  try {
    const { location, forecast } = await getWeatherForTrip(destination, date);
    renderForecast(location, forecast);
  } catch (err) {
    resultSection.innerHTML = `<p class="error">${err.message}</p>`;
  }
});

function renderForecast(location, forecast) {
  resultSection.innerHTML = `
    <h2>Forecast for ${location.displayName}</h2>
    <p><strong>Date:</strong> ${formatDate(forecast.date)}</p>
    <p><strong>Conditions:</strong> ${forecast.description}</p>
    <p><strong>High / Low:</strong> ${forecast.tempMax}°F / ${forecast.tempMin}°F</p>
    <p><strong>Precipitation:</strong> ${forecast.precip} in</p>
    <p class="api-credit">Weather data provided by <a href="https://open-meteo.com/" target="_blank" rel="noopener">Open-Meteo</a> (free, no API key required).</p>
  `;
}

// Format YYYY-MM-DD as a readable date string
function formatDate(dateStr) {
  // Adding T00:00:00 prevents UTC-offset date-shift issues
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString(undefined, {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
}
