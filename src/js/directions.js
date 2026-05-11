/* Used to open Google Maps directions in a new tab */

export function openDirections(destLat, destLon, btn) {
  if (!navigator.geolocation) {
    alert('Geolocation is not supported by your browser.');
    return;
  }

  const originalText = btn.textContent;
  btn.textContent = 'Locating\u2026';
  btn.disabled = true;

  navigator.geolocation.getCurrentPosition(
    ({ coords }) => {
      btn.textContent = originalText;
      btn.disabled = false;
      const origin = `${coords.latitude},${coords.longitude}`;
      const dest = `${destLat},${destLon}`;
      const url = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(dest)}&travelmode=driving`;
      window.open(url, '_blank', 'noopener,noreferrer');
    },
    (err) => {
      btn.textContent = originalText;
      btn.disabled = false;
      const msgs = {
        [err.PERMISSION_DENIED]: 'Location access was denied. Please allow location access in your browser settings and try again.',
        [err.POSITION_UNAVAILABLE]: 'Your current location is unavailable.',
        [err.TIMEOUT]: 'Location request timed out. Please try again.',
      };
      alert(msgs[err.code] ?? 'Unable to get your location.');
    },
    { timeout: 10000 },
  );
}
