const BACKEND_URL = 'http://localhost:5000/api/air-quality';

export async function fetchAirQualityByCoords(lat, lon) {
  if (typeof lat !== 'number' || typeof lon !== 'number') {
    throw new Error('Invalid coordinates provided.');
  }

  const response = await fetch(`${BACKEND_URL}?lat=${lat}&lon=${lon}`);
  if (!response.ok) {
    throw new Error('Failed to fetch live AQI data from backend.');
  }
  return await response.json();
}

export async function fetchCityComparisons() {
  const response = await fetch(`${BACKEND_URL}/cities`);
  if (!response.ok) {
    throw new Error('Failed to fetch city comparisons from backend.');
  }
  return await response.json();
}
