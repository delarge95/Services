/**
 * smoothScroll.ts — Desplazamiento AMORTIGUADO con la rueda + AJUSTE a secciones (ciclo 41).
 *
 *  · Amortiguación: la rueda mueve un objetivo; la página lo sigue con un muelle exponencial (sin saltos de 100 px).
 *  · Ciclo 42: más amortiguación y ajuste más fuerte (≤ 55 % adelante, ≤ 6 % atrás) con deslizamiento ease-in-out.
 *  · data-snap-offset resta píxeles al inicio de la sección (un valor grande = lo alto de la página).
 *  · Ajuste: al soltar la rueda (≈160 ms), si el inicio de una sección marcada con [data-snap] queda cerca
 *    (AHEAD de la ventana en la dirección del gesto, BEHIND hacia atrás), la página se asienta en él.
 *    Dentro de secciones más altas que la ventana se lee libre.
 *  · No interfiere: táctil (scroll nativo), Ctrl+rueda (zoom), elementos con scroll propio, visores 3D que usan la
 *    rueda (llaman preventDefault antes), la intro (data-cx-intro) y prefers-reduced-motion.
 */
export function installSmoothScroll(): () => void {
  if (typeof window === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return () => {};
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)');
  const html = document.documentElement;
  let target = window.scrollY, current = window.scrollY, raf = 0, last = 0, wheelAt = 0, active = false, snapped = false, ours = -1, dir = 1;
  // ciclo 42: más peso — la rueda se amortigua más (constante ≈ 200 ms) y el ajuste es un DESLIZAMIENTO con
  // aceleración y frenado (no un muelle brusco), más largo cuanto más lejos esté la sección
  const DAMP = 5, AHEAD = 0.55, BEHIND = 0.06;
  let snapFrom = 0, snapTo = 0, snapT0 = -1, snapDur = 0;
  const inOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  const maxY = () => Math.max(0, html.scrollHeight - window.innerHeight);
  const clamp = (v: number) => Math.max(0, Math.min(maxY(), v));
  const scrollsItself = (el: Element | null, dy: number) => {
    for (let n = el; n && n !== document.body && n !== html; n = n.parentElement) {
      if ((n as HTMLElement).closest?.('[data-wheel-native]')) return true;
      const cs = getComputedStyle(n); const oy = cs.overflowY;
      if ((oy === 'auto' || oy === 'scroll') && n.scrollHeight > n.clientHeight + 1) {
        if (dy > 0 ? n.scrollTop + n.clientHeight < n.scrollHeight - 1 : n.scrollTop > 0) return true;
      }
    }
    return false;
  };
  // direccional: atrae con fuerza la sección que viene (AHEAD) y apenas la que quedó atrás (BEHIND, menos que un paso de rueda: nunca atrapa),
  // así un gesto corto dentro del hero (animación por scroll) no devuelve la página arriba
  const snapPoint = (y: number) => {
    const vh = window.innerHeight; let best: number | null = null, bd = Infinity;
    document.querySelectorAll<HTMLElement>('[data-snap]').forEach((el) => {
      if (!el.offsetParent && el !== document.body) return;
      const top = clamp(Math.round(el.getBoundingClientRect().top + window.scrollY - Number(el.dataset.snapOffset || 0)));   // se acota ANTES de medir (offset 9999 = lo alto)
      const ahead = (top - y) * dir >= 0, d = Math.abs(top - y);
      if (d <= vh * (ahead ? AHEAD : BEHIND) && d < bd) { bd = d; best = top; }
    });
    return best;
  };
  const step = (now: number) => {
    raf = 0;
    const dt = Math.min(0.05, (now - last) / 1000 || 1 / 60); last = now;
    if (!snapped && now - wheelAt > 160) {
      snapped = true; const s = snapPoint(target);
      if (s !== null && Math.abs(s - current) > 1) { snapFrom = current; snapTo = target = s; snapT0 = now; snapDur = Math.min(950, 420 + Math.abs(s - current) * 0.55); }
    }
    if (snapT0 >= 0) { const k = Math.min(1, (now - snapT0) / snapDur); current = snapFrom + (snapTo - snapFrom) * inOut(k); if (k >= 1) { snapT0 = -1; current = target; } }
    else current += (target - current) * (1 - Math.exp(-dt * DAMP));
    if (Math.abs(target - current) < 0.5) current = target;
    ours = Math.round(current); window.scrollTo(0, current);
    if (current !== target || !snapped) raf = requestAnimationFrame(step); else active = false;
  };
  const onWheel = (e: WheelEvent) => {
    if (!fine.matches || e.ctrlKey || e.defaultPrevented || html.dataset.cxIntro !== undefined) return;
    const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * window.innerHeight : e.deltaY;
    if (Math.abs(e.deltaX) > Math.abs(dy) || scrollsItself(e.target as Element, dy)) return;
    e.preventDefault();
    if (!active) { target = current = window.scrollY; active = true; last = performance.now(); }
    if (dy) dir = Math.sign(dy);
    if (snapT0 >= 0) { snapT0 = -1; target = current; }   // un gesto nuevo interrumpe el deslizamiento
    target = clamp(target + dy); wheelAt = performance.now(); snapped = false;
    if (!raf) raf = requestAnimationFrame(step);
  };
  // barra de desplazamiento, teclado o anclas: la página manda y el objetivo se sincroniza
  const onScroll = () => { if (!active && Math.abs(window.scrollY - ours) > 2) { target = current = window.scrollY; } };
  window.addEventListener('wheel', onWheel, { passive: false });
  window.addEventListener('scroll', onScroll, { passive: true });
  return () => { cancelAnimationFrame(raf); window.removeEventListener('wheel', onWheel); window.removeEventListener('scroll', onScroll); };
}
