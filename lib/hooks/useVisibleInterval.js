'use client';
import { useEffect, useRef } from 'react';

/**
 * setInterval that only runs while the browser tab is visible.
 * - Pauses completely when the tab is hidden (no background requests).
 * - Refreshes once immediately when the tab becomes visible again.
 * - Always calls the latest callback without resetting the timer.
 */
export function useVisibleInterval(callback, delayMs, enabled = true) {
  const saved = useRef(callback);

  useEffect(() => {
    saved.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!enabled || !delayMs) return undefined;

    let timer = null;
    const tick = () => saved.current?.();
    const start = () => {
      if (!timer) timer = setInterval(tick, delayMs);
    };
    const stop = () => {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        tick();
        start();
      } else {
        stop();
      }
    };

    if (document.visibilityState === 'visible') start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [delayMs, enabled]);
}

export default useVisibleInterval;
