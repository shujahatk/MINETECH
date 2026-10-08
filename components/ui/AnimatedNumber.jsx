'use client';
import React, { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from '@/lib/hooks/useMediaQuery';

const easeOut = (t) => 1 - Math.pow(1 - t, 3);

/**
 * Counts from the previous value to the new one in ~450ms (one requestAnimationFrame loop, no library).
 * Renders the final value immediately for reduced-motion users and for non-numeric input.
 */
export default function AnimatedNumber({ value, duration = 450, format, className }) {
  const reduced = useReducedMotion();
  const target = Number(value);
  const isNumeric = Number.isFinite(target);
  const [display, setDisplay] = useState(isNumeric ? 0 : target);
  const shownRef = useRef(0); // what is currently on screen, so an interrupted count continues smoothly
  const rafRef = useRef(0);

  useEffect(() => {
    if (!isNumeric) return undefined;
    if (reduced) {
      shownRef.current = target;
      setDisplay(target);
      return undefined;
    }
    const from = shownRef.current;
    if (from === target) {
      setDisplay(target);
      return undefined;
    }
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const next = from + (target - from) * easeOut(t);
      shownRef.current = next;
      setDisplay(next);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, isNumeric, reduced, duration]);

  if (!isNumeric) return <span className={className}>{String(value ?? '')}</span>;
  const shown = Math.round(display);
  return <span className={className}>{format ? format(shown) : shown.toLocaleString()}</span>;
}
