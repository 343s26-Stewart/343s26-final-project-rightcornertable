/**
 * weather.js
 * Fetches weather forecast data from the Open-Meteo API.
 * Geocoding: https://geocoding-api.open-meteo.com/v1/search
 * Forecast:  https://api.open-meteo.com/v1/forecast
 * Both APIs are free, require no API key, and are CORS-friendly.
 */

const GEO_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';

// WMO weather interpretation codes → human-readable label
const WMO_LABELS = {
  0: 'Clear sky',
  1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
  45: 'Foggy', 48: 'Icy fog',
  51: 'Light drizzle', 53: 'Moderate drizzle', 55: 'Dense drizzle',
  61: 'Slight rain', 63: 'Moderate rain', 65: 'Heavy rain',
  71: 'Slight snow', 73: 'Moderate snow', 75: 'Heavy snow',
  80: 'Rain showers', 81: 'Moderate showers', 82: 'Violent showers',
  95: 'Thunderstorm', 96: 'Thunderstorm with hail', 99: 'Heavy thunderstorm',
};

/**
 * Resolves a place name to {lat, lon, displayName}.
 * Throws a user-friendly Error if no results are found.
 */
async function geocode(placeName) {
  // The geocoding API only accepts a city name, not "City, State" or "City, Country".
  // Strip any ", state/country" suffix so both "Richmond" and "Richmond, VA" work.
  const cityOnly = placeName.split(',')[0].trim();
  const url = `${GEO_URL}?name=${encodeURIComponent(cityOnly)}&count=1&language=en&format=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Geocoding request failed (${res.status})`);
  const data = await res.json();
  if (!data.results || data.results.length === 0) {
    throw new Error(`Could not find a location named "${placeName}". Try a city and country (e.g. "Paris, France").`);
  }
  const { latitude, longitude, name, admin1, country } = data.results[0];
  const displayName = [name, admin1, country].filter(Boolean).join(', ');
  return { lat: latitude, lon: longitude, displayName };
}

/**
 * Fetches the daily forecast for a single date.
 * Returns an object with temperature, precipitation, and weather description.
 */
async function fetchForecast(lat, lon, date) {
  const params = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    daily: 'weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum',
    temperature_unit: 'fahrenheit',
    precipitation_unit: 'inch',
    timezone: 'auto',
    start_date: date,
    end_date: date,
  });
  const res = await fetch(`${FORECAST_URL}?${params}`);
  if (!res.ok) throw new Error(`Forecast request failed (${res.status})`);
  const data = await res.json();

  // Open-Meteo returns arrays even for a single day; take index 0
  const { daily } = data;
  const code = daily.weathercode[0];
  return {
    date,
    tempMax: daily.temperature_2m_max[0],
    tempMin: daily.temperature_2m_min[0],
    precip: daily.precipitation_sum[0],
    weatherCode: code,
    description: WMO_LABELS[code] ?? 'Unknown conditions',
  };
}

/**
 * Main entry point called by the form submit handler.
 * Returns { location, forecast } or throws on error.
 */
export async function getWeatherForTrip(placeName, date) {
  const location = await geocode(placeName);
  const forecast = await fetchForecast(location.lat, location.lon, date);
  return { location, forecast };
}
