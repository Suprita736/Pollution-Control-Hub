import { useCallback, useEffect, useRef, useState } from 'react';
import { cacheStore } from '../utils/cacheStore';

export function useSWR(key, fetcher, { ttl = 5 * 60 * 1000 } = {}) {
  // Note: cacheStore.get is async, so this will initially be undefined/Promise.
  // The useEffect below will correctly load the data from the cache on mount.
  const getInitialData = () => undefined; 
  
  const [data, setData] = useState(getInitialData);
  const [error, setError] = useState(null);
  const [isValidating, setIsValidating] = useState(() => !!key);
  const [currentKey, setCurrentKey] = useState(key);

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  
  // Handle key changes synchronously to avoid flash of old data
  const isKeyChanged = key !== currentKey;
  // Derive the display values immediately so we don't show old data
  // while React is processing the state update
  const displayData = isKeyChanged ? getInitialData() : data;
  const displayError = isKeyChanged ? null : error;
  const displayIsValidating = isKeyChanged ? (!!key) : isValidating;

  if (isKeyChanged) {
    setCurrentKey(key);
    setData(getInitialData());
    setError(null);
    setIsValidating(!!key);
  }

  // We use a ref to track whether the component is currently mounted
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false; // Set to false when tab switches (unmounts)
    };
  }, []);

  const revalidate = useCallback(async (force = false) => {
    if (!key) return;

    // FIX 1: Added 'await' so it checks the actual boolean result instead of a Promise object
    const isStale = await cacheStore.isStale(key, ttl);
    
    if (!force && !isStale) {
      const cached = await cacheStore.get(key);
      if (cached && isMountedRef.current) {
        setData(cached.data);
        setIsValidating(false);
      }
      return;
    }

    if (isMountedRef.current) setIsValidating(true);
    
    try {
      const newData = await cacheStore.deduplicate(key, () => fetcherRef.current());
      
      // FIX 2: Only update state if the user hasn't already switched tabs away
      if (isMountedRef.current) {
        setData(newData);
        setError(null);
      }
    } catch (err) {
      if (err.name !== 'AbortError' && isMountedRef.current) {
        setError(err);
      }
    } finally {
      if (isMountedRef.current) {
        setIsValidating(false);
      }
    }
  }, [key, ttl]);

  // Revalidate on mount or key change
  useEffect(() => {
    revalidate();
  }, [revalidate]);

  // Force revalidation
  const mutate = useCallback(async () => {
    if (!key) return;
    await cacheStore.invalidate(key);
    await revalidate(true);
  }, [key, revalidate]);

  return { data: displayData, error: displayError, isValidating: displayIsValidating, mutate };
}