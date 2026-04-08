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
  // Format sunrise/sunset ISO strings (e.g. "2025-07-04T06:12") to "6:12 AM"
  const fmtTime = (isoStr) => new Date(isoStr).toLocaleTimeString(undefined, {
    hour: 'numeric', minute: '2-digit',
  });

  const cloudRow = forecast.cloudcover !== null
    ? `<tr><th scope="row">Cloud Cover</th><td>${forecast.cloudcover}%</td></tr>`
    : '';

  resultSection.innerHTML = `
    <h2>Forecast for ${location.displayName}</h2>
    <p><strong>Date:</strong> ${formatDate(forecast.date)}</p>
    <table class="forecast-table">
      <tbody>
        <tr><th scope="row">Conditions</th><td>${forecast.description}</td></tr>
        <tr><th scope="row">High / Low</th><td>${forecast.tempMax}°F / ${forecast.tempMin}°F</td></tr>
        <tr><th scope="row">Precipitation</th><td>${forecast.precip} in</td></tr>
        <tr><th scope="row">Rain</th><td>${forecast.rain} in</td></tr>
        <tr><th scope="row">Snowfall</th><td>${forecast.snowfall} in</td></tr>
        <tr><th scope="row">Wind Speed (max)</th><td>${forecast.windspeed} mph</td></tr>
        <tr><th scope="row">UV Index (max)</th><td>${forecast.uvIndex}</td></tr>
        ${cloudRow}
        <tr><th scope="row">Sunrise</th><td>${fmtTime(forecast.sunrise)}</td></tr>
        <tr><th scope="row">Sunset</th><td>${fmtTime(forecast.sunset)}</td></tr>
      </tbody>
    </table>
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
