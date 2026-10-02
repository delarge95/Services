/**
 * GoalPlates.tsx — "¿Qué quieres lograr?" como LÁMINAS TÉCNICAS (ciclo 37).
 *
 * Sustituye las cajas redondeadas con icono (lenguaje genérico) por el mismo idioma del hero:
 *  · ESENCIAL: cada servicio es un dibujo de líneas sin relleno (como el dron en silueta), que se
 *    TRAZA con el scroll justo cuando el dron se desvanece → la página continúa la misma línea.
 *  · COMPLEJO: al pasar el cursor (o al centrar la lámina en móvil) el dibujo se rellena y se anima
 *    mostrando lo que se compra: girar un modelo en la web, una animación en su línea de tiempo,
 *    una foto de producto en estudio, un agente que responde, una pieza CAD que se ensambla.
 * Todo es SVG + CSS (sin assets ni WebGL): ligero y nítido a cualquier tamaño.
 */
import { useEffect, useRef } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import './goal-plates.css';

type Lang = 'es' | 'en';
export type PlateOption = { id: string; label: string; desc?: string };

const FIG: Record<string, { es: string; en: string }> = {
  'web-3d': { es: 'Modelo navegable', en: 'Navigable model' },
  'video-anim': { es: 'Línea de tiempo', en: 'Timeline' },
  imagenes: { es: 'Estudio de producto', en: 'Product studio' },
  ia: { es: 'Agente que responde', en: 'Answering agent' },
  otros: { es: 'Pieza y ensamble', en: 'Part & assembly' },
};

/** Trazo que se dibuja con el scroll (pathLength=1 → la animación no depende de la longitud real). */
const D = ({ d, o = 0, c = '', dash }: { d: string; o?: number; c?: string; dash?: boolean }) => (
  <path d={d} pathLength={dash ? undefined : 1} className={`dr${c ? ' ' + c : ''}${dash ? ' dash' : ''}`} style={{ '--o': o } as CSSProperties} />
);

function gearPath(cx: number, cy: number, r: number, teeth: number, depth: number) {
  let d = '';
  for (let i = 0; i < teeth; i++) {
    const a0 = (i / teeth) * Math.PI * 2, s = (Math.PI * 2) / teeth;
    const pts: [number, number][] = [[a0, r - depth], [a0 + s * 0.18, r], [a0 + s * 0.5, r], [a0 + s * 0.68, r - depth]];
    pts.forEach(([a, rr], k) => { const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr; d += `${i === 0 && k === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)} `; });
  }
  return d + 'Z';
}

const FIGURES: Record<string, ReactNode> = {
  // 01 — web con 3D: navegador, cubo isométrico que el visitante gira, punto de información
  'web-3d': (
    <>
      <D d="M41 14h238a7 7 0 0 1 7 7v138a7 7 0 0 1-7 7H41a7 7 0 0 1-7-7V21a7 7 0 0 1 7-7z" />
      <D d="M34 34H286" o={0.1} />
      <D d="M91 19h110a5 5 0 0 1 0 10H91a5 5 0 0 1 0-10z" o={0.15} />
      <circle cx="46" cy="24" r="2.5" className="dot" /><circle cx="55" cy="24" r="2.5" className="dot" /><circle cx="64" cy="24" r="2.5" className="dot" />
      <g className="f-cube">
        <path d="M160 62L189 79L160 96L131 79Z" className="fill f1" />
        <path d="M131 79L160 96L160 134L131 117Z" className="fill f2" />
        <path d="M189 79L160 96L160 134L189 117Z" className="fill f3" />
        <D d="M160 62L189 79L189 117L160 134L131 117L131 79Z" o={0.25} />
        <D d="M131 79L160 96L189 79M160 96V134" o={0.35} />
      </g>
      <g className="f-orbit"><D d="M86 100a74 20 0 1 0 148 0a74 20 0 1 0-148 0" o={0.3} dash /></g>
      <D d="M229 94l5 6l6-5" o={0.5} c="acc" />
      <circle cx="189" cy="79" r="3.2" className="hot" />
      <D d="M192 77L220 56H252" o={0.55} c="sig" />
      <text x="222" y="52" className="lbl">HOTSPOT · 02</text>
      <g className="f-cursor"><D d="M212 128v16l4-4l3 7l3-1.5l-3-7h6z" o={0.6} /></g>
    </>
  ),
  // 02 — video o animación: trayectoria con papel cebolla y línea de tiempo con fotogramas clave
  'video-anim': (
    <>
      <D d="M44 14h232a4 4 0 0 1 4 4v96a4 4 0 0 1-4 4H44a4 4 0 0 1-4-4V18a4 4 0 0 1 4-4z" />
      <D d="M70 96C110 20 190 20 250 70" o={0.15} dash />
      <circle cx="70" cy="96" r="9" className="ghost g0" /><circle cx="120.5" cy="44.7" r="9" className="ghost g1" /><circle cx="184.2" cy="37.4" r="9" className="ghost g2" />
      <D d="M261 70a11 11 0 1 1-22 0a11 11 0 1 1 22 0" o={0.3} />
      <circle cx="70" cy="96" r="11" className="fill f-ball" />
      <D d="M40 146H280" o={0.35} />
      <D d="M40 142v8M60 143v6M80 143v6M100 142v8M120 143v6M140 143v6M160 142v8M180 143v6M200 143v6M220 142v8M240 143v6M260 143v6M280 142v8" o={0.4} />
      <D d="M70 140l6 6l-6 6l-6-6zM120 140l6 6l-6 6l-6-6zM184 140l6 6l-6 6l-6-6zM250 140l6 6l-6 6l-6-6z" o={0.5} c="acc" />
      <g className="f-head"><D d="M70 128V162M65 124h10l-5 6z" o={0.6} c="sig" /></g>
      <text x="40" y="174" className="lbl">00:00</text><text x="280" y="174" className="lbl" textAnchor="end">00:04</text>
    </>
  ),
  // 03 — imágenes de producto: frasco en estudio, caja de luz y encuadre de cámara
  imagenes: (
    <>
      <path d="M140 72h40a10 10 0 0 1 10 10v62a8 8 0 0 1-8 8h-44a8 8 0 0 1-8-8V82a10 10 0 0 1 10-10z" className="fill f-glass" />
      <D d="M140 72h40a10 10 0 0 1 10 10v62a8 8 0 0 1-8 8h-44a8 8 0 0 1-8-8V82a10 10 0 0 1 10-10z" />
      <D d="M151 72V60h18v12M146 60V45h28v15z" o={0.15} />
      <D d="M134 102h52v24h-52z" o={0.25} />
      <rect x="146" y="80" width="6" height="64" rx="3" className="f-shine" />
      <D d="M106 154a54 6 0 1 0 108 0a54 6 0 1 0-108 0" o={0.3} dash />
      <D d="M44 32L96 20L104 52L52 64Z" o={0.35} />
      <D d="M104 46L134 80M100 58L132 100M92 62L130 124" o={0.45} dash c="ray" />
      <D d="M116 48v-10h10M204 48v-10h-10M116 150v10h10M204 150v10h-10" o={0.55} c="sig" />
      <text x="214" y="34" className="lbl">f/8 · 1/125 · ISO 100</text>
      <rect x="116" y="38" width="88" height="122" className="f-flash" />
    </>
  ),
  // 04 — inteligencia artificial: red que procesa y burbujas de chat
  ia: (
    <>
      {[[50, 132, 36], [50, 132, 72], [50, 132, 108], [50, 132, 144], [90, 132, 36], [90, 132, 72], [90, 132, 108], [90, 132, 144], [130, 132, 36], [130, 132, 72], [130, 132, 108], [130, 132, 144]].map(([y0, x1, y1], i) => (
        <g key={i}><D d={`M58 ${y0}L${x1 - 6} ${y1}`} o={0.05 + i * 0.012} /><path d={`M58 ${y0}L${x1 - 6} ${y1}`} pathLength={1} className="pulse" style={{ animationDelay: `${(i % 4) * 0.22}s` } as CSSProperties} /></g>
      ))}
      {[[36, 70], [36, 110], [72, 70], [72, 110], [108, 70], [108, 110], [144, 70], [144, 110]].map(([y0, y1], i) => (
        <g key={'b' + i}><D d={`M138 ${y0}L202 ${y1}`} o={0.25 + i * 0.015} /><path d={`M138 ${y0}L202 ${y1}`} pathLength={1} className="pulse" style={{ animationDelay: `${0.5 + (i % 4) * 0.2}s` } as CSSProperties} /></g>
      ))}
      {[[52, 50], [52, 90], [52, 130], [132, 36], [132, 72], [132, 108], [132, 144], [208, 70], [208, 110]].map(([x, y], i) => (
        <circle key={'n' + i} cx={x} cy={y} r="6" className={`node${i >= 7 ? ' out' : ''}`} style={{ '--o': 0.1 + i * 0.03 } as CSSProperties} />
      ))}
      <D d="M236 32h52a10 10 0 0 1 10 10v14a10 10 0 0 1-10 10h-40l-10 8v-8h-2a10 10 0 0 1-10-10V42a10 10 0 0 1 10-10z" o={0.5} />
      <circle cx="250" cy="49" r="2.6" className="type t1" /><circle cx="262" cy="49" r="2.6" className="type t2" /><circle cx="274" cy="49" r="2.6" className="type t3" />
      <D d="M240 100h48a8 8 0 0 1 8 8v12a8 8 0 0 1-8 8h-48a8 8 0 0 1-8-8v-12a8 8 0 0 1 8-8zM244 110h36M244 118h22" o={0.6} c="sig" />
    </>
  ),
  // 05 — servicios técnicos: engranaje con cotas y una placa que se ensambla con sus tornillos
  otros: (
    <>
      <g className="f-gear">
        <path d={gearPath(110, 100, 42, 12, 7)} className="fill f-gearfill" />
        <D d={gearPath(110, 100, 42, 12, 7)} />
        <D d="M122 100a12 12 0 1 1-24 0a12 12 0 1 1 24 0" o={0.2} />
      </g>
      <D d="M60 100H160M110 50V150" o={0.25} dash c="axis" />
      <D d="M68 152v10M152 152v10M68 158H152M68 158l6-3v6zM152 158l-6-3v6z" o={0.35} c="sig" />
      <text x="110" y="176" className="lbl" textAnchor="middle">Ø 84.0</text>
      <D d="M190 96h96v34h-96z" o={0.4} />
      <D d="M216 113a5 5 0 1 1-10 0a5 5 0 1 1 10 0M270 113a5 5 0 1 1-10 0a5 5 0 1 1 10 0" o={0.5} />
      <D d="M211 70V108M265 70V108" o={0.55} dash c="axis" />
      <g className="f-screw">
        <D d="M204 34h14v6h-14zM208 40v26h6V40M208 46h6M208 52h6M208 58h6" o={0.6} c="acc" />
        <D d="M258 34h14v6h-14zM262 40v26h6V40M262 46h6M262 52h6M262 58h6" o={0.65} c="acc" />
      </g>
    </>
  ),
};

export function GoalPlates({ options, onPick, lang = 'es' }: { options: PlateOption[]; onPick: (id: string) => void; lang?: Lang }) {
  const ref = useRef<HTMLDivElement>(null);
  const en = lang === 'en';
  useEffect(() => {
    const root = ref.current; if (!root) return;
    const plates = [...root.querySelectorAll<HTMLElement>('.cx-plate')];
    const thread = document.querySelector<HTMLElement>('.cx-thread');
    const title = document.querySelector<HTMLElement>('.cx-goals-title');
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const coarse = window.matchMedia('(hover: none)').matches;
    // ciclo 38: todo lo de la sección SALE DEL DRON — cada elemento viaja desde el centro del dron (fijo en pantalla)
    // hasta su sitio, creciendo, ligado al scroll; el título llega en lineart y se rellena al asentarse
    const fly = [...document.querySelectorAll<HTMLElement>('[data-fly]')].filter((e) => !plates.includes(e)).concat(plates);
    const base = new Map<HTMLElement, { x: number; y: number; w: number; h: number }>();
    const measure = () => {
      for (const e of [...fly, ...(thread && !fly.includes(thread) ? [thread] : [])]) {
        const tf = e.style.transform; e.style.transform = 'none';
        const r = e.getBoundingClientRect(); base.set(e, { x: r.left + window.scrollX, y: r.top + window.scrollY, w: r.width, h: r.height });
        e.style.transform = tf;
      }
    };
    const outE = (x: number) => 1 - Math.pow(1 - Math.max(0, Math.min(1, x)), 3);
    let raf = 0, hovered = false, fill = reduce ? 1 : 0, fillRaf = 0, arrivedAt = -1;
    // ciclo 39: el texto y las láminas llegan en BLANCO; al asentarse toman su color; solo DESPUÉS se rellena el título
    const firstRow = plates.slice(0, 3), header = fly.filter((e) => !plates.includes(e));
    const paintFill = () => {
      if (!title) return;
      const tr = title.getBoundingClientRect(), X = tr.left + fill * tr.width;
      title.querySelectorAll<HTMLElement>('.lt').forEach((el) => { const r = el.getBoundingClientRect(); el.style.setProperty('--lt-w', `${Math.max(0, X - r.left).toFixed(1)}px`); });
      title.classList.toggle('lt-on', fill < 0.999);
    };
    const fillLoop = () => {
      fillRaf = 0;
      const ready = arrivedAt > 0 && performance.now() - arrivedAt > 450;
      const target = hovered || ready ? 1 : 0;
      fill += (target - fill) * 0.075 + Math.sign(target - fill) * 0.004; fill = Math.max(0, Math.min(1, fill));
      paintFill();
      if (Math.abs(target - fill) > 0.001 || (arrivedAt > 0 && !ready)) fillRaf = requestAnimationFrame(fillLoop); else { fill = target; paintFill(); }
    };
    const kickFill = () => { if (!fillRaf) fillRaf = requestAnimationFrame(fillLoop); };
    // 2D → 3D al pasar el cursor (módulo three.js perezoso, un solo lienzo compartido)
    let p3: { enter: (p: HTMLElement, id: string) => void; leave: (p: HTMLElement) => void; dispose: () => void } | null = null;
    let loading: Promise<void> | null = null, disposed = false;
    const ensure = () => loading ?? (loading = import('./plate3d').then((m) => { if (!disposed) p3 = m.createPlate3D(); }).catch(() => { /* sin WebGL: queda el 2D */ }));
    const enter = (p: HTMLElement) => { if (reduce) return; ensure().then(() => { if (p.matches(':hover, :focus-visible, .live')) p3?.enter(p, p.dataset.id ?? ''); }); };
    const leave = (p: HTMLElement) => { p3?.leave(p); };
    const upd = () => {
      raf = 0;
      const vh = window.innerHeight, vw = window.innerWidth, sy = window.scrollY, sx = window.scrollX;
      const mobile = vw < 760 || vw / vh < 0.95;
      const dc = mobile ? { x: vw * 0.5, y: vh * 0.28 } : { x: vw * 0.73, y: vh * 0.5 };
      const wide = vw >= 900, tb = title ? base.get(title) : null, kAll = tb ? (vh * 0.98 - (tb.y - sy)) / (vh * 0.55) : 0;
      fly.forEach((e, i) => {
        const b = base.get(e); if (!b) return;
        // escritorio (ciclo 40): TODO llega a la vez, guiado por el título (con un leve desfase por orden) → cuando el
        // título está arriba, la sección completa está en su sitio sin seguir bajando. Móvil (una columna): cada uno el suyo.
        const top = b.y - sy, k = reduce ? 1 : wide ? outE(kAll - i * 0.03) : outE((vh * 0.98 - top) / (vh * 0.62) - (plates.includes(e) ? (plates.indexOf(e) % 3) * 0.05 : 0));
        e.classList.toggle('cx-mono', k < 1);
        if (k >= 1) { e.style.transform = ''; e.style.opacity = ''; return; }
        const cx = b.x - sx + b.w / 2, cy = top + b.h / 2, dx = (dc.x - cx) * (1 - k), dy = (dc.y - cy) * (1 - k);
        e.style.transform = `translate3d(${dx.toFixed(1)}px, ${dy.toFixed(1)}px, 0) scale(${(0.28 + 0.72 * k).toFixed(3)}) rotate(${((1 - k) * (i % 2 ? 9 : -9)).toFixed(2)}deg)`;
        e.style.opacity = Math.min(1, k * 1.5).toFixed(3);
      });
      const arrived = [...header, ...firstRow].every((e) => !e.classList.contains('cx-mono'));
      if (arrived && arrivedAt < 0) { arrivedAt = performance.now(); kickFill(); }
      if (!arrived && arrivedAt > 0) { arrivedAt = -1; kickFill(); }
      plates.forEach((p, i) => {
        const b = base.get(p); const top = b ? b.y - sy : p.getBoundingClientRect().top, hgt = b ? b.h : p.offsetHeight;
        // se traza mientras entra (del 98 % al 45 % del alto de la ventana), con un leve desfase por columna
        const d = reduce ? 1 : wide ? Math.max(0, Math.min(1, (kAll - (fly.indexOf(p)) * 0.03) * 1.15)) : Math.max(0, Math.min(1, (vh * 0.98 - top) / (vh * 0.5) - (i % 3) * 0.06));
        p.style.setProperty('--d', d.toFixed(3));
        p.classList.toggle('drawn', d >= 1);
        if (coarse) { const c = top + hgt / 2, on = d >= 1 && c > vh * 0.25 && c < vh * 0.75; if (on !== p.classList.contains('live')) { p.classList.toggle('live', on); if (on) enter(p); else leave(p); } }
      });
      if (thread) { const b = base.get(thread); const top = b ? b.y - sy : thread.getBoundingClientRect().top; thread.style.setProperty('--d', reduce ? '1' : Math.max(0, Math.min(1, (vh * 1.0 - top) / (vh * 0.35))).toFixed(3)); }
    };
    const offs: (() => void)[] = [];
    plates.forEach((p) => {
      const en2 = () => enter(p), lv = () => leave(p);
      p.addEventListener('pointerenter', en2); p.addEventListener('pointerleave', lv); p.addEventListener('focus', en2); p.addEventListener('blur', lv);
      offs.push(() => { p.removeEventListener('pointerenter', en2); p.removeEventListener('pointerleave', lv); p.removeEventListener('focus', en2); p.removeEventListener('blur', lv); });
    });
    const tIn = () => { hovered = true; kickFill(); }, tOut = () => { hovered = false; kickFill(); };
    title?.addEventListener('pointerenter', tIn); title?.addEventListener('pointerleave', tOut);
    const on = () => { if (!raf) raf = requestAnimationFrame(upd); };
    const remeasure = () => { measure(); on(); };
    measure(); upd(); paintFill();
    const t1 = setTimeout(remeasure, 400), t2 = setTimeout(remeasure, 1500);
    document.fonts?.ready.then(remeasure).catch(() => {});
    window.addEventListener('scroll', on, { passive: true }); window.addEventListener('resize', remeasure);
    return () => {
      disposed = true; cancelAnimationFrame(raf); cancelAnimationFrame(fillRaf); clearTimeout(t1); clearTimeout(t2);
      window.removeEventListener('scroll', on); window.removeEventListener('resize', remeasure);
      title?.removeEventListener('pointerenter', tIn); title?.removeEventListener('pointerleave', tOut);
      offs.forEach((f) => f()); p3?.dispose();
      fly.forEach((e) => { e.style.transform = ''; e.style.opacity = ''; });
    };
  }, [options.length]);

  return (
    <div ref={ref} className="cx-plates cx-wide">
      {options.map((o, i) => (
        <button key={o.id} type="button" data-id={o.id} className={`cx-plate cx-plate-${i < 3 ? 'a' : 'b'}`} onClick={() => onPick(o.id)} aria-label={`${o.label}. ${o.desc ?? ''}`}>
          <span className="cx-plate-fig">
            <span className="cx-plate-tag" aria-hidden="true">FIG. {String(i + 1).padStart(2, '0')} — {(FIG[o.id] ?? FIG['web-3d'])[en ? 'en' : 'es']}</span>
            <svg viewBox="0 0 320 180" aria-hidden="true" preserveAspectRatio="xMidYMid meet">{FIGURES[o.id] ?? FIGURES['web-3d']}</svg>
          </span>
          <span className="cx-plate-txt">
            <span className="cx-plate-idx" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
            <strong>{o.label}</strong>
            {o.desc && <span className="cx-plate-desc">{o.desc}</span>}
            <span className="cx-plate-go" aria-hidden="true">{en ? 'Quote' : 'Cotizar'} <i>→</i></span>
          </span>
        </button>
      ))}
    </div>
  );
}
