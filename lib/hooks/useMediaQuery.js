'use client';
import { useEffect, useState } from 'react';

/**
 * Subscribes to a CSS media query. Returns `defaultValue` on the server and on the first client render
 * (so hydration matches), then the real value after mount.
 */
export function useMediaQuery(query, defaultValue = false) {
  const [matches, setMatches] = useState(defaultValue);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
    const mql = window.matchMedia(query);
    const update = () => setMatches(mql.matches);
    update();
    mql.addEventListener('change', update);
    return () => mql.removeEventListener('change', update);
  }, [query]);

  return matches;
}

/** True when the user asked the OS for reduced motion. JS-driven animation must honour this. */
export function useReducedMotion() {
  return useMediaQuery('(prefers-reduced-motion: reduce)', false);
}
