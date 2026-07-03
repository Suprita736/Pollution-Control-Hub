# Backend Aggregation Layer

This backend service eliminates third-party API rate limiting by serving as a caching and aggregation layer for the Pollution Control Hub frontend.

## Architecture

- **Node.js/Express**: Provides REST API endpoints for the React frontend.
- **SQLite**: Zero-config local database acting as an in-memory/disk cache.
- **Node-Cron**: Runs scheduled jobs (every 15 minutes) to pre-fetch raw heavy data from the `open-meteo` API. It calculates weekly/monthly averages in the background and stores the finalized clean payload into SQLite. 

By having the frontend query this backend instead of `open-meteo` directly, we resolve rate limit bans and improve performance dramatically because the backend serves the data instantly from SQLite.

## How to Run

1. `npm install`
2. `npm start` (or `npm run dev` for nodemon).
3. The server runs on `http://localhost:5000`

Endpoints:
- `/api/air-quality?lat=...&lon=...`
- `/api/air-quality/cities`
