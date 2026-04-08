/**
 * saved.js
 * Renders saved Tripcast plans from localStorage.
 */
import { getSavedPlans, deletePlan } from './storage.js';

const main = document.querySelector('main');

function renderSavedPlans() {
  const plans = getSavedPlans();
  const listContainer = document.createElement('div');
  listContainer.className = 'saved-plans-container';

  if (plans.length === 0) {
    listContainer.innerHTML = '<p class="empty-message">No saved plans yet. Save a forecast from the Plan a Trip page.</p>';
    main.appendChild(listContainer);
    return;
  }

  plans.forEach((plan) => {
    const card = document.createElement('article');
    card.className = 'plan-card';

    card.innerHTML = `
      <div class="plan-header">
        <div>
          <h2>${plan.location.displayName}</h2>
          <p class="plan-meta">
            <strong>Trip Date:</strong> ${formatDate(plan.forecast.date)}<br />
            <strong>Saved:</strong> ${formatDateTime(plan.savedAt)}
          </p>
        </div>
        <button class="delete-plan-button" type="button" data-id="${plan.id}">Delete</button>
      </div>
      <div class="plan-details">
        <table class="forecast-table">
          <tbody>
            <tr><th scope="row">Conditions</th><td>${plan.forecast.description}</td></tr>
            <tr><th scope="row">High / Low</th><td>${plan.forecast.tempMax}°F / ${plan.forecast.tempMin}°F</td></tr>
            <tr><th scope="row">Precipitation</th><td>${plan.forecast.precip} in</td></tr>
            <tr><th scope="row">Rain</th><td>${plan.forecast.rain} in</td></tr>
            <tr><th scope="row">Snowfall</th><td>${plan.forecast.snowfall} in</td></tr>
            <tr><th scope="row">Wind Speed</th><td>${plan.forecast.windspeed} mph</td></tr>
            <tr><th scope="row">UV Index</th><td>${plan.forecast.uvIndex}</td></tr>
            <tr><th scope="row">Sunrise</th><td>${formatTime(plan.forecast.sunrise)}</td></tr>
            <tr><th scope="row">Sunset</th><td>${formatTime(plan.forecast.sunset)}</td></tr>
          </tbody>
        </table>
      </div>
    `;

    listContainer.appendChild(card);
  });

  main.appendChild(listContainer);
}

function formatDate(dateStr) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString(undefined, {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
}

function formatDateTime(isoString) {
  return new Date(isoString).toLocaleString(undefined, {
    year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

function formatTime(isoString) {
  return new Date(isoString).toLocaleTimeString(undefined, {
    hour: 'numeric', minute: '2-digit',
  });
}

main.addEventListener('click', (event) => {
  const button = event.target.closest('.delete-plan-button');
  if (!button) return;

  const planId = button.dataset.id;
  deletePlan(planId);
  main.innerHTML = '<h1>Saved Plans</h1><p>Your saved trip forecasts will appear here.</p>';
  renderSavedPlans();
});

renderSavedPlans();
