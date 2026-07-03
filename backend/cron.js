const cron = require('node-cron');
const { fetchAndCacheCityComparisons } = require('./airQualityService');

// Run every 15 minutes
cron.schedule('*/15 * * * *', async () => {
  console.log('Running background job to fetch and cache city air quality data...');
  try {
    await fetchAndCacheCityComparisons();
    console.log('Successfully cached city comparisons and associated grids.');
  } catch (error) {
    console.error('Error in background cron job:', error.message);
  }
});

// Run once on startup to populate cache immediately
console.log('Initializing cron job and running initial cache population...');
fetchAndCacheCityComparisons().catch(err => console.error('Initial fetch failed:', err.message));
