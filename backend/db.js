const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'pollution-hub.db');
const db = new sqlite3.Database(dbPath);

// Initialize tables
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS grid_cache (
      lat REAL,
      lon REAL,
      data TEXT,
      timestamp INTEGER,
      PRIMARY KEY (lat, lon)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS city_cache (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      data TEXT,
      timestamp INTEGER
    )
  `);
});

const getGridCache = (lat, lon) => {
  return new Promise((resolve, reject) => {
    db.get('SELECT data, timestamp FROM grid_cache WHERE lat = ? AND lon = ?', [lat, lon], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const setGridCache = (lat, lon, data) => {
  return new Promise((resolve, reject) => {
    const timestamp = Date.now();
    db.run(
      'INSERT OR REPLACE INTO grid_cache (lat, lon, data, timestamp) VALUES (?, ?, ?, ?)',
      [lat, lon, JSON.stringify(data), timestamp],
      function (err) {
        if (err) reject(err);
        else resolve();
      }
    );
  });
};

const getCityComparisons = () => {
  return new Promise((resolve, reject) => {
    db.get('SELECT data, timestamp FROM city_cache WHERE id = 1', [], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const setCityComparisons = (data) => {
  return new Promise((resolve, reject) => {
    const timestamp = Date.now();
    db.run(
      'INSERT OR REPLACE INTO city_cache (id, data, timestamp) VALUES (1, ?, ?)',
      [JSON.stringify(data), timestamp],
      function (err) {
        if (err) reject(err);
        else resolve();
      }
    );
  });
};

module.exports = {
  getGridCache,
  setGridCache,
  getCityComparisons,
  setCityComparisons,
};
