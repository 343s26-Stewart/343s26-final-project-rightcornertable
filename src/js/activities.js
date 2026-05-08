const ACTIVITY_KEY = 'tripcast-activity-settings';
const UNIT_KEY = 'tripcast-units';
const PLACES_API_KEY = 'REDACTED_API_KEY';

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
  const unit = localStorage.getItem(UNIT_KEY) || 'fahrenheit';
  const defaults = {
    minTemp: unit === 'celsius' ? 0 : 32,
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

  const typeToCategory = buildTypeToCategory(categories);
  const includedTypes = [...typeToCategory.keys()];
  if (!includedTypes.length) return [];

  const res = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': PLACES_API_KEY,
      'X-Goog-FieldMask': 'places.displayName,places.rating,places.userRatingCount,places.types,places.location',
    },
    body: JSON.stringify({
      includedTypes,
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

  if (!res.ok) throw new Error(`Places API ${res.status}`);
  const data = await res.json();
  const raw = data.places || [];

  const elements = raw
    .filter(p => (p.rating ?? 0) >= 4.0 && (p.userRatingCount ?? 0) >= 100)
    .flatMap(p => {
      const placeTypes = p.types || [];
      const category = placeTypes.map(t => typeToCategory.get(t)).find(Boolean);
      if (!category) return [];
      return [{
        name: p.displayName?.text ?? 'Unknown',
        type: placeTypes.find(t => typeToCategory.has(t)) ?? placeTypes[0] ?? '',
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
    .catch(() => {
      container.innerHTML = '<p class="activities-error">Could not load nearby activities.</p>';
    });
}

function activityCredit() {
  return '<p class="api-credit">Activity data from <a href="https://maps.google.com/" target="_blank" rel="noopener">Google Places</a>.</p>';
}

function getCategoryPriority(category, raining) {
  const order = raining ? CATEGORY_ORDER.rainy : CATEGORY_ORDER.dry;
  const index = order.indexOf(category);
  return index === -1 ? order.length : index;
}
