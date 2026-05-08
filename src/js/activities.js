const ACTIVITY_KEY = 'tripcast-activity-settings';
const UNIT_KEY = 'tripcast-units';
const PLACES_API_KEY_STORAGE = 'tripcast-places-api-key';

const CATEGORY_TYPES = {
  food:          ['cafe', 'bakery', 'restaurant'],
  nature:        ['park', 'national_park', 'hiking_area', 'botanical_garden', 'zoo', 'aquarium', 'beach'],
  culture:       ['museum', 'art_gallery', 'historical_landmark', 'tourist_attraction', 'library'],
  entertainment: ['movie_theater', 'amusement_park', 'night_club', 'bowling_alley', 'shopping_mall'],
  fitness:       ['gym', 'spa', 'stadium'],
};

const CATEGORY_ORDER = {
  rainy: ['culture', 'entertainment', 'fitness', 'food', 'nature'],
  dry:   ['nature', 'entertainment', 'culture', 'fitness', 'food'],
};

const fetchCache = new Map();

export function getActivitySettings() {
  // Stored activity thresholds use imperial-style units by default so
  // the rest of the app (weather + activity filtering) doesn't need
  // to change. Temperature stored in °F, precipitation in inches,
  // wind in mph, radius in meters.
  const defaults = {
    minTemp: 32,
    maxPrecip: 0.1,
    maxWind: 30,
    radius: 5000,
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

function buildTypeToCategory(categories) {
  const map = new Map();
  for (const cat of categories) {
    for (const type of (CATEGORY_TYPES[cat] || [])) {
      if (!map.has(type)) map.set(type, cat);
    }
  }
  return map;
}

async function queryGooglePlaces(lat, lon, radius, categories) {
  const cacheKey = `${lat},${lon},${radius},${[...categories].sort().join(',')}`;
  if (fetchCache.has(cacheKey)) return fetchCache.get(cacheKey);

  const apiKey = localStorage.getItem(PLACES_API_KEY_STORAGE) || '';
  if (!apiKey) throw new Error('No API key set. Add your Google Places API key in Settings.');

  const typeToCategory = buildTypeToCategory(categories);
  const includedTypes = [...typeToCategory.keys()];
  if (!includedTypes.length) return [];

  const res = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'places.displayName,places.rating,places.userRatingCount,places.primaryType,places.location',
    },
    body: JSON.stringify({
      includedPrimaryTypes: includedTypes,
      maxResultCount: 20,
      rankPreference: 'POPULARITY',
      locationRestriction: {
        circle: {
          center: { latitude: lat, longitude: lon },
          radius,
        },
      },
    }),
  });

  if (!res.ok) {
    let message = `Places API error ${res.status}`;
    try {
      const errData = await res.json();
      if (errData?.error?.message) message = errData.error.message;
    } catch {}
    throw new Error(message);
  }
  const data = await res.json();
  const raw = data.places || [];

  const elements = raw
    .filter(p => (p.rating ?? 0) >= 4.0 && (p.userRatingCount ?? 0) >= 100)
    .flatMap(p => {
      const primaryType = p.primaryType ?? '';
      const category = typeToCategory.get(primaryType);
      if (!category) return [];
      return [{
        name: p.displayName?.text ?? 'Unknown',
        type: primaryType,
        category,
        lat: p.location?.latitude,
        lon: p.location?.longitude,
      }];
    });

  fetchCache.set(cacheKey, elements);
  return elements;
}

export async function fetchNearbyActivities(lat, lon, forecast) {
  const settings = getActivitySettings();
  const raining = Number(forecast.rain) > 0;
  const elements = await queryGooglePlaces(lat, lon, settings.radius, settings.categories);

  const seen = new Set();
  const categoryCounts = new Map();
  const places = [];

  const prioritizedCategories = [...settings.categories].sort(
    (a, b) => getCategoryPriority(a, raining) - getCategoryPriority(b, raining)
  );

  for (const category of prioritizedCategories) {
    for (const el of elements.filter(e => e.category === category)) {
      if (seen.has(el.name)) continue;
      const count = categoryCounts.get(category) || 0;
      if (count >= 3) continue;

      seen.add(el.name);
      categoryCounts.set(category, count + 1);
      places.push(el);

      if (places.length >= 8) break;
    }
    if (places.length >= 8) break;
  }

  if (places.length < 8) {
    for (const el of elements) {
      if (seen.has(el.name)) continue;
      const count = categoryCounts.get(el.category) || 0;
      if (count >= 3) continue;

      seen.add(el.name);
      categoryCounts.set(el.category, count + 1);
      places.push(el);

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
        const label = type.replace(/_/g, ' ');
        return `<li class="activity-item">
          <a href="${url}" target="_blank" rel="noopener" class="activity-link">
            <span class="activity-name">${name}</span>${label ? `<span class="activity-type">${label}</span>` : ''}
          </a>
        </li>`;
      }).join('');

      container.innerHTML = `${noteHtml}<ul class="activities-list">${listHtml}</ul>${activityCredit()}`;
    })
    .catch((err) => {
      const msg = err?.message || 'Could not load nearby activities.';
      container.innerHTML = `<p class="activities-error">${escapeHtml(msg)}</p>`;
    });
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function activityCredit() {
  return '<p class="api-credit">Activity data from <a href="https://maps.google.com/" target="_blank" rel="noopener">Google Places</a>.</p>';
}

function getCategoryPriority(category, raining) {
  const order = raining ? CATEGORY_ORDER.rainy : CATEGORY_ORDER.dry;
  const index = order.indexOf(category);
  return index === -1 ? order.length : index;
}
