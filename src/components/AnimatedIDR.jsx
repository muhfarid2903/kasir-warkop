import { useState, useEffect, useRef } from 'react'
import { IDR } from '../format.js'

// Hook: animasi angka smooth (easeOutCubic ~500ms)
export function useAnimatedNumber(target, duration = 600) {
  const [value, setValue] = useState(target);
  const fromRef = useRef(target);
  const rafRef = useRef(null);
  useEffect(() => {
    const from = fromRef.current;
    if (from === target) return;
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(from + (target - from) * eased);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
      else { fromRef.current = target; setValue(target); }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration]);
  return value;
}

export const AnimatedIDR = ({ value, className = '' }) => {
  const v = useAnimatedNumber(Number(value) || 0);
  return <span className={"num-anim "+className}>{IDR(v)}</span>;
};
