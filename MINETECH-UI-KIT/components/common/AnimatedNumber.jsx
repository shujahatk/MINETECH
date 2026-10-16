'use client';
import React from 'react';
import { useAnimatedCounter } from '../../hooks/useAnimatedCounter';

export function AnimatedNumber({ value = 0, format = (v) => v.toLocaleString(), duration = 650, className = '' }) {
  const animated = useAnimatedCounter(value, duration);

  return (
    <span className={`tabular-nums ${className}`}>
      {format(animated)}
    </span>
  );
}

export default AnimatedNumber;
