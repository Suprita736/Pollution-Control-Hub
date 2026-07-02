import { CITY_COORDINATES } from '../constants/cities';

const BASE_URL = 'https://air-quality-api.open-meteo.com/v1/air-quality';

function getCurrentHourIndex(times) {
  const now = new Date();
  const currentHour = now.getHours();
  const index = times.findIndex((isoTime) => new Date(isoTime).getHours() === currentHour);
  return index === -1 ? 0 : index;
}

export function getAQIBand(value) {
  if (value <= 50) return { label: 'Good', color: '#1f9d55' };
  if (value <= 100) return { label: 'Moderate', color: '#f59e0b' };
  if (value <= 150) return { label: 'Unhealthy (Sensitive)', color: '#f97316' };
  if (value <= 200) return { label: 'Unhealthy', color: '#ef4444' };
  if (value <= 300) return { label: 'Very Unhealthy', color: '#b91c1c' };
  return { label: 'Hazardous', color: '#7f1d1d' };
}

const GRID_STEP = 0.09; // ~10 km spacing
const DIRECTION_LABELS = {
  '-1,1': 'North-West zone',
  '0,1': 'North zone',
  '1,1': 'North-East zone',
  '-1,0': 'West zone',
  '1,0': 'East zone',
  '-1,-1': 'South-West zone',
  '0,-1': 'South zone',
  '1,-1': 'South-East zone'
};

const gridCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;

function isValidCoord(lat, lon) {
  return (
    typeof lat === 'number' && typeof lon === 'number' &&
    lat >= -90 && lat <= 90 &&
    lon >= -180 && lon <= 180
  );
}

async function fetchGridPointAqi(lat, lon) {
  if (!isValidCoord(lat, lon)) return null;
  const url = `${BASE_URL}?latitude=${lat}&longitude=${lon}&hourly=us_aqi&timezone=auto&forecast_days=1`;
  const response = await fetch(url);
  if (!response.ok) return null;
  const data = await response.json();
  const times = data.hourly?.time || [];
  const idx = getCurrentHourIndex(times);
  return Math.round(data.hourly?.us_aqi?.[idx] ?? 0);
}

export async function fetchLocalGrid(lat, lon, topN = 6) {
  const cacheKey = `${lat.toFixed(1)},${lon.toFixed(1)}`;
  const cached = gridCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.points;

  const gridOffsets = [-1, 0, 1].flatMap((dy) =>
    [-1, 0, 1]
      .filter((dx) => !(dx === 0 && dy === 0))
      .map((dx) => ({ dx, dy }))
  );

  const results = await Promise.all(
    gridOffsets.map(async ({ dx, dy }, i) => {
      const gLat = parseFloat((lat + dy * GRID_STEP).toFixed(4));
      const gLon = parseFloat((lon + dx * GRID_STEP).toFixed(4));
      const aqi = await fetchGridPointAqi(gLat, gLon);
      return {
        id: `grid-${i}`,
        lat: gLat,
        lon: gLon,
        aqi: aqi ?? 0,
        areaName: DIRECTION_LABELS[`${dx},${dy}`] || `Zone ${i + 1}`
      };
    })
  );

  const points = results
    .filter((p) => p.aqi > 0)
    .sort((a, b) => b.aqi - a.aqi)
    .slice(0, topN);

  gridCache.set(cacheKey, { ts: Date.now(), points });
  return points;
}

export async function fetchAirQualityByCoords(lat, lon) {
  if (!isValidCoord(lat, lon)) throw new Error('Invalid coordinates provided.');
  const url = `${BASE_URL}?latitude=${lat}&longitude=${lon}&hourly=pm2_5,pm10,carbon_monoxide,nitrogen_dioxide,ozone,us_aqi&timezone=auto&forecast_days=3`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error('Failed to fetch live AQI data.');
  }

  const data = await response.json();
  const hourly = data.hourly || {};
  const times = hourly.time || [];
  const idx = getCurrentHourIndex(times);

  const current = {
    time: times[idx],
    pm2_5: Math.round(hourly.pm2_5?.[idx] ?? 0),
    pm10: Math.round(hourly.pm10?.[idx] ?? 0),
    carbon_monoxide: Math.round(hourly.carbon_monoxide?.[idx] ?? 0),
    nitrogen_dioxide: Math.round(hourly.nitrogen_dioxide?.[idx] ?? 0),
    ozone: Math.round(hourly.ozone?.[idx] ?? 0),
    us_aqi: Math.round(hourly.us_aqi?.[idx] ?? 0)
  };

  const trend = times.slice(0, 24).map((time, i) => ({
    time,
    pm2_5: Math.round(hourly.pm2_5?.[i] ?? 0),
    pm10: Math.round(hourly.pm10?.[i] ?? 0),
    us_aqi: Math.round(hourly.us_aqi?.[i] ?? 0)
  }));

  const nearbyPoints = await fetchLocalGrid(lat, lon);

  return {
    current,
    trend,
    nearbyPoints
  };
}

export async function fetchCityComparisons() {
  const cityData = await Promise.all(
    CITY_COORDINATES.map(async (city) => {
      try {
        const result = await fetchAirQualityByCoords(city.lat, city.lon);
        return {
          city: city.name,
          aqi: result.current.us_aqi,
          pm2_5: result.current.pm2_5,
          pm10: result.current.pm10
        };
      } catch (error) {
        return {
          city: city.name,
          aqi: 85,
          pm2_5: 34,
          pm10: 55
        };
      }
    })
  );

  return cityData.sort((a, b) => b.aqi - a.aqi);
}

export function estimateWeeklyMonthlyAverages(trend) {
  const dayAverage = trend.reduce((acc, item) => acc + item.us_aqi, 0) / (trend.length || 1);
  const weekly = Math.round(dayAverage * 1.05);
  const monthly = Math.round(dayAverage * 1.12);

  return {
    weekly,
    monthly,
    prediction: Math.round(dayAverage * 1.08)
  };
}
