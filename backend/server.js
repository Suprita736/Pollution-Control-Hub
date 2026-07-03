const express = require('express');
const cors = require('cors');
const { fetchAirQualityByCoords, fetchAndCacheCityComparisons } = require('./airQualityService');
const { getCityComparisons } = require('./db');
require('./cron'); // Initialize cron jobs

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;

app.get('/api/air-quality', async (req, res) => {
  try {
    const lat = parseFloat(req.query.lat);
    const lon = parseFloat(req.query.lon);

    if (isNaN(lat) || isNaN(lon)) {
      return res.status(400).json({ error: 'Valid lat and lon query parameters are required.' });
    }

    const data = await fetchAirQualityByCoords(lat, lon);
    res.json(data);
  } catch (error) {
    console.error('Error in /api/air-quality:', error.message);
    res.status(500).json({ error: 'Failed to fetch air quality data.' });
  }
});

app.get('/api/air-quality/cities', async (req, res) => {
  try {
    const cached = await getCityComparisons();
    if (cached) {
      return res.json(JSON.parse(cached.data));
    }
    
    // If not cached yet, fetch on the fly
    const data = await fetchAndCacheCityComparisons();
    res.json(data);
  } catch (error) {
    console.error('Error in /api/air-quality/cities:', error.message);
    res.status(500).json({ error: 'Failed to fetch city comparisons.' });
  }
});

app.listen(PORT, () => {
  console.log(`Backend server is running on http://localhost:${PORT}`);
});
