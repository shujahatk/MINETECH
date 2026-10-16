import { useEffect, useState } from 'react';

export function useAnimatedCounter(targetValue, duration = 650) {
  const [displayValue, setDisplayValue] = useState(Number(targetValue) || 0);

  useEffect(() => {
    const end = Number(targetValue);
    if (isNaN(end)) return;

    let startTimestamp = null;
    const startValue = displayValue;

    const step = (timestamp) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(startValue + (end - startValue) * eased);
      setDisplayValue(current);

      if (progress < 1) {
        requestAnimationFrame(step);
      }
    };

    requestAnimationFrame(step);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetValue, duration]);

  return displayValue;
}

export default useAnimatedCounter;
