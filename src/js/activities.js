const ACTIVITY_KEY = 'tripcast-activity-settings';
const UNIT_KEY = 'tripcast-units';

const CATEGORY_TAGS = {
  food:          [['amenity', 'restaurant|cafe|bar|pub|fast_food|ice_cream|bakery']],
  nature:        [['leisure', 'park|garden|nature_reserve'], ['tourism', 'viewpoint|zoo|aquarium']],
  culture:       [['amenity', 'museum|library|arts_centre'], ['tourism', 'attraction|museum|gallery']],
  entertainment: [['amenity', 'cinema|theatre|nightclub|bowling_alley']],
  fitness:       [['leisure', 'sports_centre|fitness_centre|swimming_pool']],
};

const OUTDOOR_TYPES = new Set([
  'park', 'garden', 'nature_reserve', 'viewpoint', 'zoo', 'aquarium', 'theme_park',
]);

const fetchCache = new Map();

export function getActivitySettings() {
  const unit = localStorage.getItem(UNIT_KEY) || 'fahrenheit';
  const defaults = {
    minTemp: unit === 'celsius' ? 0 : 32,
    maxPrecip: 0.1,
    maxWind: 30,
    radius: 2000,
    categories: ['food', 'nature', 'culture', 'entertainment', 'fitness'],
  };
  try {
    const raw = localStorage.getItem(ACTIVITY_KEY);
    if (!raw) return defaults;
    return { ...defaults, ...JSON.parse(raw) };
  } catch {
    return defaults;
  }
}

export function saveActivitySetting(key, value) {
  const s = getActivitySettings();
  s[key] = value;
  localStorage.setItem(ACTIVITY_KEY, JSON.stringify(s));
}

function weatherIsBad(forecast, settings) {
  return (
    forecast.tempMin < settings.minTemp
    || forecast.precip > settings.maxPrecip
    || forecast.windspeed > settings.maxWind
  );
}

async function queryOverpass(lat, lon, radius, categories) {
  const cacheKey = `${lat},${lon},${radius},${[...categories].sort().join(',')}`;
  if (fetchCache.has(cacheKey)) return fetchCache.get(cacheKey);

  const parts = [];
  for (const cat of categories) {
    for (const [key, values] of (CATEGORY_TAGS[cat] || [])) {
      parts.push(`node["name"]["${key}"~"${values}"](around:${radius},${lat},${lon});`);
    }
  }
  if (!parts.length) return [];

  const query = `[out:json][timeout:10];\n(\n  ${parts.join('\n  ')}\n);\nout body;`;
  const res = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`);
  if (!res.ok) throw new Error(`Overpass ${res.status}`);
  const data = await res.json();
  const elements = (data.elements || []).filter((el) => el.tags?.name);
  fetchCache.set(cacheKey, elements);
  return elements;
}

export async function fetchNearbyActivities(lat, lon, forecast) {
  const settings = getActivitySettings();
  const bad = weatherIsBad(forecast, settings);
  const elements = await queryOverpass(lat, lon, settings.radius, settings.categories);

  const seen = new Set();
  const places = [];
  for (const el of elements) {
    const name = el.tags.name;
    if (seen.has(name)) continue;
    seen.add(name);
    const type = el.tags.amenity || el.tags.leisure || el.tags.tourism || '';
    if (bad && OUTDOOR_TYPES.has(type)) continue;
    places.push({ name, type, lat: el.lat, lon: el.lon });
    if (places.length >= 8) break;
  }

  return { places, weatherBad: bad };
}

export function renderActivitiesPanel(container, lat, lon, forecast) {
  container.innerHTML = '<p class="activities-loading">Finding nearby activities…</p>';

  fetchNearbyActivities(lat, lon, forecast)
    .then(({ places, weatherBad }) => {
      if (!places.length) {
        container.innerHTML = `<p class="activities-none">${
          weatherBad
            ? 'Outdoor activities filtered — no indoor options found nearby.'
            : 'No nearby activities found.'
        }</p>${activityCredit()}`;
        return;
      }

      const noteHtml = weatherBad
        ? '<p class="activities-weather-note">Showing indoor options only — weather exceeds thresholds.</p>'
        : '';

      const listHtml = places.map(({ name, type, lat: pLat, lon: pLon }) => {
        const url = `https://www.google.com/maps/search/${encodeURIComponent(name)}/@${pLat},${pLon},16z`;
        const label = type.replace(/_/g, ' ');
        return `<li class="activity-item">
          <a href="${url}" target="_blank" rel="noopener" class="activity-link">
            <span class="activity-name">${name}</span>${label ? `<span class="activity-type">${label}</span>` : ''}
          </a>
        </li>`;
      }).join('');

      container.innerHTML = `${noteHtml}<ul class="activities-list">${listHtml}</ul>${activityCredit()}`;
    })
    .catch(() => {
      container.innerHTML = '<p class="activities-error">Could not load nearby activities.</p>';
    });
}

function activityCredit() {
  return '<p class="api-credit">Activity data from <a href="https://www.openstreetmap.org/" target="_blank" rel="noopener">OpenStreetMap</a> via <a href="https://overpass-api.de/" target="_blank" rel="noopener">Overpass API</a> (free, no API key required).</p>';
}
