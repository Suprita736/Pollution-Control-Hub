/**
 * MultiLevelCache
 *
 * L1: In-Memory Map (fastest, cleared on page refresh)
 * L2: LocalStorage (persists across reloads, limited capacity)
 */
export class MultiLevelCache {
  constructor(
    namespace = 'pc-hub-cache',
    defaultTTL = 5 * 60 * 1000,
    maxEntries = Infinity
  ) {
    this.namespace = namespace;
    this.defaultTTL = defaultTTL;
    this.maxEntries = maxEntries;
    this.memoryCache = new Map();
  }

  _getKey(key) {
    return `${this.namespace}:${key}`;
  }

  _getFallbackKey(key) {
    return `${this.namespace}:fallback:${key}`;
  }

  _evictIfNeeded() {
    if (
      this.maxEntries === Infinity ||
      this.memoryCache.size < this.maxEntries
    ) {
      return;
    }

    // FIFO: remove the oldest inserted entry
    const oldestKey = this.memoryCache.keys().next().value;

    if (!oldestKey) {
      return;
    }

    this.memoryCache.delete(oldestKey);

    try {
      localStorage.removeItem(oldestKey);
    } catch (e) {
      console.warn('Failed to evict localStorage cache entry:', e);
    }
  }

  get(key) {
    const fullKey = this._getKey(key);
    const now = Date.now();

    // 1. Check L1 Cache
    const l1Entry = this.memoryCache.get(fullKey);

    if (l1Entry) {
      if (now < l1Entry.expiresAt) {
        return l1Entry.data;
      }

      this.memoryCache.delete(fullKey);
    }

    // 2. Check L2 Cache
    try {
      const l2Raw = localStorage.getItem(fullKey);

      if (l2Raw) {
        const l2Entry = JSON.parse(l2Raw);

        if (now < l2Entry.expiresAt) {
          // Backfill L1 Cache
          this.memoryCache.set(fullKey, l2Entry);
          return l2Entry.data;
        }

        localStorage.removeItem(fullKey);
      }
    } catch (e) {
      console.warn('Failed to read from localStorage cache:', e);
    }

    return null;
  }

  getFallback(key) {
    const fallbackKey = this._getFallbackKey(key);

    try {
      const raw = localStorage.getItem(fallbackKey);

      if (raw) {
        return JSON.parse(raw);
      }
    } catch (e) {
      console.warn('Failed to read fallback from localStorage cache:', e);
    }

    return null;
  }

  set(key, data, ttlMs = this.defaultTTL) {
    const fullKey = this._getKey(key);
    const expiresAt = Date.now() + ttlMs;

    const entry = {
      data,
      expiresAt,
    };

    // Evict oldest entry if cache limit is reached
    this._evictIfNeeded();

    // Store in L1 cache
    this.memoryCache.set(fullKey, entry);

    // Store in L2 cache
    try {
      localStorage.setItem(fullKey, JSON.stringify(entry));
      localStorage.setItem(
        this._getFallbackKey(key),
        JSON.stringify(data)
      );
    } catch (e) {
      console.warn(
        'Failed to write to localStorage cache. Storage might be full:',
        e
      );
    }
  }

  clear() {
    this.memoryCache.clear();

    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);

        if (key && key.startsWith(this.namespace)) {
          localStorage.removeItem(key);
        }
      }
    } catch (e) {
      console.warn('Failed to clear localStorage cache:', e);
    }
  }
}

export const aqiCache = new MultiLevelCache(
  'aqi-cache',
  5 * 60 * 1000
);