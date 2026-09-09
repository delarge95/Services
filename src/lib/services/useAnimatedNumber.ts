import { useEffect, useRef, useState } from 'react';

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const fn = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, []);
  return reduced;
}

/** Anima hacia `target` con easeOutCubic; re-objetiva sin saltos si target
 *  cambia a mitad de animación (arrastre continuo de sliders). Ciclo 17. */
export function useAnimatedNumber(target: number, duration = 450): number {
  const reduced = usePrefersReducedMotion();
  const [display, setDisplay] = useState(target);
  const current = useRef(target);
  const raf = useRef(0);

  useEffect(() => {
    if (reduced || Math.abs(target - current.current) < 1) {
      current.current = target; setDisplay(target); return;
    }
    const from = current.current, delta = target - from, t0 = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / duration);
      const v = from + delta * (1 - Math.pow(1 - t, 3));
      current.current = v; setDisplay(v);
      if (t < 1) raf.current = requestAnimationFrame(tick);
    };
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [target, duration, reduced]);

  return Math.round(display);
}
