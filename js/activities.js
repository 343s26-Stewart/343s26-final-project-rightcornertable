const ACTIVITY_KEY = 'tripcast-activity-settings';
const UNIT_KEY = 'tripcast-units';

const CATEGORY_TAGS = {
  food:          [['amenity', 'cafe|ice_cream|bakery']],
  nature:        [['leisure', 'park|garden|nature_reserve'], ['tourism', 'viewpoint|zoo|aquarium']],
  culture:       [['amenity', 'museum|library|arts_centre'], ['tourism', 'attraction|museum|gallery']],
  entertainment: [['amenity', 'cinema|theatre|nightclub|bowling_alley']],
  fitness:       [['leisure', 'sports_centre|swimming_pool']],
};

const CATEGORY_ORDER = {
  rainy: ['culture', 'entertainment', 'nature', 'fitness', 'food'],
  dry: ['nature', 'entertainment', 'culture', 'fitness', 'food'],
};

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
  const elements = (data.elements || []).flatMap((el) => {
    if (!el.tags?.name) return [];

    const category = categories.find((cat) => {
      const rules = CATEGORY_TAGS[cat] || [];
      return rules.some(([key, values]) => {
        const value = el.tags?.[key];
        return value && new RegExp(`^(?:${values})$`, 'i').test(value);
      });
    });

    return category ? [{ ...el, activityCategory: category }] : [];
  });
  fetchCache.set(cacheKey, elements);
  return elements;
}

export async function fetchNearbyActivities(lat, lon, forecast) {
  const settings = getActivitySettings();
  const raining = Number(forecast.rain) > 0;
  const elements = await queryOverpass(lat, lon, settings.radius, settings.categories);

  const seen = new Set();
  const categoryCounts = new Map();
  const places = [];

  const prioritizedCategories = [...settings.categories].sort((left, right) => {
    return getCategoryPriority(left, raining) - getCategoryPriority(right, raining);
  });

  for (const category of prioritizedCategories) {
    for (const el of elements.filter((entry) => entry.activityCategory === category)) {
      const name = el.tags.name;
      if (seen.has(name)) continue;

      const count = categoryCounts.get(category) || 0;
      if (count >= 3) continue;

      seen.add(name);
      categoryCounts.set(category, count + 1);

      const type = el.tags.amenity || el.tags.leisure || el.tags.tourism || '';
      places.push({ name, type, category, lat: el.lat, lon: el.lon });

      if (places.length >= 8) break;
    }

    if (places.length >= 8) break;
  }

  if (places.length < 8) {
    for (const el of elements) {
      const name = el.tags.name;
      if (seen.has(name)) continue;

      const category = el.activityCategory;
      const count = categoryCounts.get(category) || 0;
      if (count >= 3) continue;

      seen.add(name);
      categoryCounts.set(category, count + 1);

      const type = el.tags.amenity || el.tags.leisure || el.tags.tourism || '';
      places.push({ name, type, category, lat: el.lat, lon: el.lon });

      if (places.length >= 8) break;
    }
  }

  return { places, raining };
}

export function renderActivitiesPanel(container, lat, lon, forecast) {
  container.innerHTML = '<p class="activities-loading">Finding nearby activities…</p>';

  fetchNearbyActivities(lat, lon, forecast)
    .then(({ places, raining }) => {
      const noteHtml = raining
        ? '<p class="activities-weather-note">Rain is expected, so indoor activities are shown first.</p>'
        : '<p class="activities-weather-note">No rain is expected, so outdoor activities are shown first.</p>';

      if (!places.length) {
        container.innerHTML = `${noteHtml}<p class="activities-none">No nearby activities found.</p>${activityCredit()}`;
        return;
      }

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

function getCategoryPriority(category, raining) {
  const order = raining ? CATEGORY_ORDER.rainy : CATEGORY_ORDER.dry;
  const index = order.indexOf(category);
  return index === -1 ? order.length : index;
}
