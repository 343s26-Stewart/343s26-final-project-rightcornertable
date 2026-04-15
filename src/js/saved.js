/**
 * saved.js
 * Renders saved Tripcast plans from localStorage.
 */
import { getSavedPlans, deletePlan, savePlan } from './storage.js';

const main = document.querySelector('main');

// --- Export / Import ---

function downloadJSON(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function exportPlan(planId) {
  const plan = getSavedPlans().find((p) => p.id === planId);
  if (!plan) return;
  const slug = plan.location.displayName.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  downloadJSON([plan], `tripcast-${slug}-${plan.forecast.date}.json`);
}

function exportAll() {
  const plans = getSavedPlans();
  if (plans.length === 0) return;
  downloadJSON(plans, `tripcast-all-plans-${new Date().toISOString().slice(0, 10)}.json`);
}

function importPlans(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    let parsed;
    try {
      parsed = JSON.parse(e.target.result);
    } catch {
      showImportStatus('Invalid JSON file.', true);
      return;
    }

    if (!Array.isArray(parsed)) {
      showImportStatus('Expected a JSON array of plans.', true);
      return;
    }

    const existing = getSavedPlans();
    const existingIds = new Set(existing.map((p) => p.id));
    const toAdd = parsed.filter((p) => p && typeof p === 'object' && p.id && p.forecast && p.location);
    const newPlans = toAdd.filter((p) => !existingIds.has(p.id));
    const skipped = toAdd.length - newPlans.length;
    const invalid = parsed.length - toAdd.length;

    // savePlan prepends one at a time; insert in reverse so order is preserved
    for (let i = newPlans.length - 1; i >= 0; i--) {
      savePlan(newPlans[i]);
    }

    let msg = `Imported ${newPlans.length} plan${newPlans.length !== 1 ? 's' : ''}.`;
    if (skipped > 0) msg += ` ${skipped} duplicate${skipped !== 1 ? 's' : ''} skipped.`;
    if (invalid > 0) msg += ` ${invalid} invalid entr${invalid !== 1 ? 'ies' : 'y'} ignored.`;
    showImportStatus(msg, false);
    renderCards();
  };
  reader.readAsText(file);
}

function showImportStatus(msg, isError) {
  const el = document.getElementById('import-status');
  if (!el) return;
  el.textContent = msg;
  el.className = isError ? 'import-status import-status--error' : 'import-status import-status--ok';
  el.hidden = false;
  setTimeout(() => { el.hidden = true; }, 5000);
}

// --- Toolbar (export all + import) ---

function createToolbar() {
  const toolbar = document.createElement('div');
  toolbar.className = 'plans-toolbar';
  toolbar.innerHTML = `
    <button class="toolbar-button export-all-button" type="button">Export all</button>
    <label class="toolbar-button import-label" tabindex="0">
      Import JSON
      <input type="file" id="import-file-input" accept=".json,application/json" hidden />
    </label>
    <span id="import-status" class="import-status" hidden></span>
  `;
  return toolbar;
}

// --- Filter controls ---

function createFilterBar() {
  const bar = document.createElement('div');
  bar.className = 'filter-bar';
  bar.innerHTML = `
    <div class="filter-group">
      <label for="filter-date">Filter by date</label>
      <input type="date" id="filter-date" />
    </div>
    <div class="filter-group">
      <label for="filter-location">Filter by location</label>
      <input type="text" id="filter-location" placeholder="e.g. Seattle" autocomplete="off" />
    </div>
    <button class="clear-filters-button" type="button">Clear filters</button>
  `;
  return bar;
}

// --- Rendering ---

function getFilteredPlans() {
  const dateVal = document.getElementById('filter-date')?.value ?? '';
  const locVal = (document.getElementById('filter-location')?.value ?? '').trim().toLowerCase();

  return getSavedPlans().filter((plan) => {
    const dateMatch = !dateVal || plan.forecast.date === dateVal;
    const locMatch = !locVal || plan.location.displayName.toLowerCase().includes(locVal);
    return dateMatch && locMatch;
  });
}

function renderCards() {
  const existing = main.querySelector('.saved-plans-container');
  if (existing) existing.remove();

  const plans = getFilteredPlans();
  const allPlans = getSavedPlans();
  const listContainer = document.createElement('div');
  listContainer.className = 'saved-plans-container';

  if (allPlans.length === 0) {
    listContainer.innerHTML = '<p class="empty-message">No saved plans yet. Save a forecast from the Plan a Trip page.</p>';
    main.appendChild(listContainer);
    return;
  }

  if (plans.length === 0) {
    listContainer.innerHTML = '<p class="empty-message">No plans match your filters.</p>';
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
        <div class="plan-actions">
          <button class="export-plan-button" type="button" data-id="${plan.id}">Export</button>
          <button class="delete-plan-button" type="button" data-id="${plan.id}">Delete</button>
        </div>
      </div>
      <div class="plan-details">
        <div class="hourly-chart-card saved-chart-card">
          <h3>24 Hour Temperature</h3>
          <canvas class="saved-hourly-chart" width="760" height="260"></canvas>
        </div>
        <table class="forecast-table">
          <tbody>
            <tr><th scope="row">Conditions</th><td>${plan.forecast.description}</td></tr>
            <tr><th scope="row">High / Low</th><td>${plan.forecast.tempMax}${plan.forecast.tempUnit} / ${plan.forecast.tempMin}${plan.forecast.tempUnit}</td></tr>
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

    const chartCanvas = card.querySelector('.saved-hourly-chart');
    if (chartCanvas && plan.forecast.hourly?.times?.length && plan.forecast.hourly?.temperatures?.length) {
      drawSavedChart(chartCanvas, plan.forecast.hourly, plan.forecast.tempUnit, plan.forecast.date);
    }
  });

  main.appendChild(listContainer);
}

function renderSavedPlans() {
  const subtitle = main.querySelector('p');

  // Toolbar (export all + import) — injected once
  if (!main.querySelector('.plans-toolbar')) {
    const toolbar = createToolbar();
    subtitle ? subtitle.after(toolbar) : main.appendChild(toolbar);

    toolbar.querySelector('.export-all-button').addEventListener('click', exportAll);

    const fileInput = toolbar.querySelector('#import-file-input');
    fileInput.addEventListener('change', () => {
      if (fileInput.files.length) {
        importPlans(fileInput.files[0]);
        fileInput.value = '';
      }
    });

    // Allow keyboard activation of the import label
    toolbar.querySelector('.import-label').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') fileInput.click();
    });
  }

  // Filter bar — injected once, after toolbar
  if (!main.querySelector('.filter-bar')) {
    const bar = createFilterBar();
    const toolbar = main.querySelector('.plans-toolbar');
    toolbar ? toolbar.after(bar) : main.appendChild(bar);

    bar.addEventListener('input', renderCards);
    bar.addEventListener('click', (e) => {
      if (!e.target.closest('.clear-filters-button')) return;
      document.getElementById('filter-date').value = '';
      document.getElementById('filter-location').value = '';
      renderCards();
    });
  }

  renderCards();
}

// --- Helpers ---

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

function drawSavedChart(canvas, hourly, tempUnit, date) {
  const ctx = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;
  ctx.clearRect(0, 0, width, height);

  const filtered = hourly.times.map((time, index) => ({ time, temp: hourly.temperatures[index] }))
    .filter((entry) => entry.time.startsWith(date));
  if (filtered.length === 0) return;

  const labels = filtered.map((entry) => entry.time.slice(11, 16));
  const values = filtered.map((entry) => entry.temp);
  const maxTemp = Math.max(...values);
  const minTemp = Math.min(...values);
  const padding = 42;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  const positions = values.map((temp, index) => ({
    x: padding + (chartWidth * index) / (values.length - 1),
    y: padding + chartHeight * (1 - (temp - minTemp) / (maxTemp - minTemp || 1)),
    temp,
    label: labels[index],
  }));

  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = '#d1d5db';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i <= 4; i += 1) {
    const y = padding + (chartHeight * i) / 4;
    ctx.moveTo(padding, y);
    ctx.lineTo(width - padding, y);
  }
  ctx.stroke();

  ctx.fillStyle = '#4b5563';
  ctx.font = '10px Garamond, serif';
  ctx.textAlign = 'right';
  for (let i = 0; i <= 4; i += 1) {
    const tempValue = Math.round(maxTemp - ((maxTemp - minTemp) / 4) * i);
    const y = padding + (chartHeight * i) / 4 + 4;
    ctx.fillText(`${tempValue}°`, padding - 8, y);
  }

  ctx.strokeStyle = '#c15f3c';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  positions.forEach((point, index) => {
    if (index === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  });
  ctx.stroke();

  ctx.fillStyle = '#c15f3c';
  positions.forEach((point) => {
    ctx.beginPath();
    ctx.arc(point.x, point.y, 4, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.fillStyle = '#111827';
  ctx.font = '10px Garamond, serif';
  ctx.textAlign = 'center';
  positions.forEach((point, index) => {
    if (index % Math.ceil(positions.length / 6) !== 0 && index !== positions.length - 1) return;
    ctx.fillText(point.label, point.x, height - 10);
  });

  ctx.textAlign = 'left';
  ctx.fillText(`Temp (${tempUnit})`, padding, padding - 12);
}

// --- Events ---

main.addEventListener('click', (event) => {
  const deleteBtn = event.target.closest('.delete-plan-button');
  if (deleteBtn) {
    deletePlan(deleteBtn.dataset.id);
    renderCards();
    return;
  }

  const exportBtn = event.target.closest('.export-plan-button');
  if (exportBtn) {
    exportPlan(exportBtn.dataset.id);
  }
});

renderSavedPlans();
