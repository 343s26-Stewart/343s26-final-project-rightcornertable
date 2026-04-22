/**
 * weather-ui.js
 * Handles the Plan a Trip form submission and renders forecast results.
 */

import { getWeatherForTrip } from './weather.js';
import { savePlan } from './storage.js';
import { openDirections } from './directions.js';

const form = document.getElementById('trip-form');
const resultSection = document.getElementById('forecast-result');
const calendarContainer = document.getElementById('trip-calendar');
const selectedDateDisplay = document.getElementById('selected-date-display');
const hiddenDateInput = document.getElementById('trip-date');

const INIT_TRIP_KEY = 'tripcast-init-trip';
const UNIT_KEY = 'tripcast-units';
const today = normalizeDate(new Date());
const maxAdvanceDays = 15;
const maxDate = addDays(today, maxAdvanceDays);
let selectedDate = today;
let currentPlan = null;
const isPlanPage = window.location.pathname.endsWith('plan.html');

function getSavedUnits() {
  return localStorage.getItem(UNIT_KEY) || 'fahrenheit';
}

function saveInitTrip(destination, date) {
  sessionStorage.setItem(INIT_TRIP_KEY, JSON.stringify({ destination, date }));
}

function loadInitTrip() {
  const stored = sessionStorage.getItem(INIT_TRIP_KEY);
  if (!stored) return null;
  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

function clearInitTrip() {
  sessionStorage.removeItem(INIT_TRIP_KEY);
}

if (calendarContainer && selectedDateDisplay && hiddenDateInput) {
  initCalendar();
}

if (form) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const destination = document.getElementById('destination').value.trim();
    const date = document.getElementById('trip-date').value; // YYYY-MM-DD

    if (!isPlanPage) {
      saveInitTrip(destination, date);
      window.location.href = 'plan.html';
      return;
    }

    if (resultSection) {
      resultSection.innerHTML = '<p>Fetching forecast…</p>';
    }

    const unit = getSavedUnits();
    try {
      const { location, forecast } = await getWeatherForTrip(destination, date, unit);
      currentPlan = {
        id: `plan-${Date.now()}`,
        destination,
        date,
        location,
        forecast,
        savedAt: null,
      };
      renderForecast(location, forecast);
    } catch (err) {
      if (resultSection) {
        resultSection.innerHTML = `<p class="error">${err.message}</p>`;
      }
    }
  });
}

async function initFromRedirect() {
  if (!isPlanPage) return;
  const initTrip = loadInitTrip();
  if (!initTrip) return;

  clearInitTrip();

  if (resultSection) {
    resultSection.innerHTML = '<p>Fetching forecast…</p>';
  }

  const unit = getSavedUnits();
  try {
    const { location, forecast } = await getWeatherForTrip(initTrip.destination, initTrip.date, unit);
    currentPlan = {
      id: `plan-${Date.now()}`,
      destination: initTrip.destination,
      date: initTrip.date,
      location,
      forecast,
      savedAt: null,
    };
    renderForecast(location, forecast);
  } catch (err) {
    if (resultSection) {
      resultSection.innerHTML = `<p class="error">${err.message}</p>`;
    }
  }
}

initFromRedirect();

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
    <div class="hourly-chart-card">
      <h3>24 Hour Temperature</h3>
      <div class="chart-tooltip" id="hourly-chart-tooltip" aria-hidden="true"></div>
      <canvas id="hourly-chart" width="760" height="320"></canvas>
    </div>
    <div class="forecast-details">
      <table class="forecast-table">
        <tbody>
          <tr><th scope="row">Conditions</th><td>${forecast.description}</td></tr>
          <tr><th scope="row">High / Low</th><td>${forecast.tempMax}${forecast.tempUnit} / ${forecast.tempMin}${forecast.tempUnit}</td></tr>
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
      <div class="plan-page-actions">
        <button id="save-plan-button" type="button">Save this plan</button>
        <button id="directions-button" type="button">Get Directions</button>
      </div>
      <p id="save-notice" class="save-notice" aria-live="polite"></p>
      <p class="api-credit">Weather data provided by <a href="https://open-meteo.com/" target="_blank" rel="noopener">Open-Meteo</a> (free, no API key required).</p>
    </div>
  `;

  drawHourlyChart(forecast.hourly, forecast.tempUnit, forecast.date);

  document.getElementById('save-plan-button').addEventListener('click', handleSaveClick);

  const directionsBtn = document.getElementById('directions-button');
  directionsBtn.addEventListener('click', () => {
    openDirections(location.lat, location.lon, directionsBtn);
  });
}

function drawHourlyChart(hourly, tempUnit, date) {
  const chart = document.getElementById('hourly-chart');
  const tooltip = document.getElementById('hourly-chart-tooltip');
  if (!chart || !tooltip || !hourly || !hourly.times) return;

  const isDark = document.body.classList.contains('dark-mode');
  const bgColor = isDark ? '#3a3a3a' : '#f8fafc';
  const gridColor = isDark ? '#555' : '#d1d5db';
  const labelColor = isDark ? '#cccccc' : '#4b5563';
  const textColor = isDark ? '#ffffff' : '#111827';

  const ctx = chart.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const rect = chart.getBoundingClientRect();
  chart.width = rect.width * dpr;
  chart.height = rect.height * dpr;
  ctx.scale(dpr, dpr);
  const width = rect.width;
  const height = rect.height;

  ctx.clearRect(0, 0, width, height);

  const filteredTimes = hourly.times.map((time, index) => ({ time, temp: hourly.temperatures[index] }))
    .filter((entry) => entry.time.startsWith(date));
  if (filteredTimes.length === 0) return;

  const points = filteredTimes.map((entry) => ({
    label: entry.time.slice(11, 16),
    value: entry.temp,
  }));
  const labels = points.map((entry) => entry.label);
  const values = points.map((entry) => entry.value);
  const maxTemp = Math.max(...values);
  const minTemp = Math.min(...values);
  const yPadding = 40;
  const xPadding = 50;
  const chartWidth = width - xPadding * 2;
  const chartHeight = height - yPadding * 2;

  const pointPositions = values.map((temperature, index) => ({
    x: xPadding + (chartWidth * index) / (values.length - 1),
    y: yPadding + chartHeight * (1 - (temperature - minTemp) / (maxTemp - minTemp || 1)),
    temp: temperature,
    label: labels[index],
  }));

  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i <= 4; i += 1) {
    const y = yPadding + (chartHeight * i) / 4;
    ctx.moveTo(xPadding, y);
    ctx.lineTo(width - xPadding, y);
  }
  ctx.stroke();

  ctx.fillStyle = labelColor;
  ctx.font = '11px Garamond, serif';
  ctx.textAlign = 'right';
  for (let i = 0; i <= 4; i += 1) {
    const tempValue = Math.round(maxTemp - ((maxTemp - minTemp) / 4) * i);
    const y = yPadding + (chartHeight * i) / 4 + 4;
    ctx.fillText(`${tempValue}°`, xPadding - 10, y);
  }

  ctx.strokeStyle = '#c15f3c';
  ctx.lineWidth = 3;
  ctx.beginPath();
  pointPositions.forEach((point, index) => {
    if (index === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  });
  ctx.stroke();

  ctx.fillStyle = textColor;
  ctx.font = '11px Garamond, serif';
  ctx.textAlign = 'center';
  pointPositions.forEach((point, index) => {
    if (index % Math.ceil(pointPositions.length / 8) !== 0 && index !== pointPositions.length - 1) return;
    ctx.fillText(point.label, point.x, height - 12);
  });

  ctx.fillStyle = '#c15f3c';
  pointPositions.forEach((point) => {
    ctx.beginPath();
    ctx.arc(point.x, point.y, 4, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.fillStyle = '#111827';
  ctx.textAlign = 'left';
  // ctx.fillText(`Temp (${tempUnit})`, xPadding, yPadding - 10);

  chart.onmousemove = (event) => {
    const rect = chart.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    const hitDistance = 8;
    const hit = pointPositions.find((point) => {
      const dx = point.x - mouseX;
      const dy = point.y - mouseY;
      return Math.sqrt(dx * dx + dy * dy) <= hitDistance;
    });

    if (hit) {
      tooltip.textContent = `${hit.label}: ${hit.temp}°`;
      tooltip.style.opacity = '1';
      tooltip.style.left = `${Math.min(rect.width - 100, hit.x + 10)}px`;
      tooltip.style.top = `${Math.max(10, hit.y - 30)}px`;
      tooltip.setAttribute('aria-hidden', 'false');
    } else {
      tooltip.style.opacity = '0';
      tooltip.setAttribute('aria-hidden', 'true');
    }
  };

  chart.onmouseleave = () => {
    tooltip.style.opacity = '0';
    tooltip.setAttribute('aria-hidden', 'true');
  };
}

function handleSaveClick() {
  if (!currentPlan) return;
  if (currentPlan.savedAt) {
    showSaveMessage('This trip is already saved.');
    return;
  }

  currentPlan.savedAt = new Date().toISOString();
  savePlan(currentPlan);
  showSaveMessage('Saved to Saved Plans.');
}

function showSaveMessage(message) {
  const notice = document.getElementById('save-notice');
  if (notice) notice.textContent = message;
}

// Format YYYY-MM-DD as a readable date string
function formatDate(dateStr) {
  // Adding T00:00:00 prevents UTC-offset date-shift issues
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString(undefined, {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
}

function initCalendar() {
  selectedDate = today;
  hiddenDateInput.value = formatDateValue(selectedDate);
  updateSelectedDateMessage(selectedDate);
  renderCalendar();
  calendarContainer.addEventListener('click', handleCalendarClick);
}

function renderCalendar() {
  const months = getMonthRange(today, maxDate);
  calendarContainer.innerHTML = months.map((month) => renderMonth(month)).join('');
}

function getMonthRange(startDate, endDate) {
  const months = [];
  let current = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  while (current <= endDate) {
    months.push({ year: current.getFullYear(), month: current.getMonth() });
    current.setMonth(current.getMonth() + 1);
  }
  return months;
}

function renderMonth({ year, month }) {
  const monthStart = new Date(year, month, 1);
  const monthName = monthStart.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const firstWeekday = monthStart.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const weekdaysHtml = weekdayLabels.map((day) => `<div>${day}</div>`).join('');

  const cells = [];
  for (let i = 0; i < firstWeekday; i += 1) {
    cells.push('<div class="calendar-cell empty"></div>');
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = normalizeDate(new Date(year, month, day));
    const dayValue = formatDateValue(date);
    const isDisabled = date < today || date > maxDate;
    const isSelected = selectedDate && dayValue === formatDateValue(selectedDate);
    const classes = ['calendar-cell', 'date-button'];
    if (isSelected) classes.push('selected');

    cells.push(`
      <button
        type="button"
        class="${classes.join(' ')}"
        data-date="${dayValue}"
        ${isDisabled ? 'disabled aria-disabled="true"' : ''}
      >
        ${day}
      </button>
    `);
  }

  return `
    <section class="calendar-month">
      <header>
        <h2>${monthName}</h2>
      </header>
      <div class="calendar-weekdays">${weekdaysHtml}</div>
      <div class="calendar-grid">${cells.join('')}</div>
    </section>
  `;
}

function handleCalendarClick(event) {
  const button = event.target.closest('.date-button');
  if (!button || button.disabled) return;
  const value = button.dataset.date;
  selectedDate = parseDateValue(value);
  hiddenDateInput.value = value;
  updateSelectedDateMessage(selectedDate);
  renderCalendar();
}

function updateSelectedDateMessage(date) {
  selectedDateDisplay.textContent = `Selected trip date: ${formatDate(formatDateValue(date))}`;
}

function formatDateValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseDateValue(dateValue) {
  const [year, month, day] = dateValue.split('-').map(Number);
  return normalizeDate(new Date(year, month - 1, day));
}

function normalizeDate(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return normalizeDate(result);
}

function valueToDateString(date) {
  return formatDate(date);
}
