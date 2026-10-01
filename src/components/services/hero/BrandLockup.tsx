/**
 * BrandLockup.tsx — Marca de la barra superior (ciclo 35, provisional hasta decidir la marca).
 * Variante elegida en el generador (tools/marca/generador-aw.html): Michroma, familia B, LIGADURA
 * (la pierna derecha de la A es el primer trazo de la W), una sola tinta.
 *
 * Dos estados de la MISMA marca, nunca a la vez: acrónimo AW ↔ «Alex Woodcock».
 * Transformación continua (misma lógica que el generador):
 *  · la A no se mueve (anclada a la izquierda); la W viaja de la ligadura a su sitio (ease-in-out);
 *  · ENMASCARADO: «lex» se descubre en el hueco que abre la W (nunca la cruza) y «oodcock» sale de
 *    detrás de la W; cada letra se aclara cuando el frente de la máscara la cruza (desfase natural);
 *  · plegar = desplegar al revés (las salidas aceleran).
 * La geometría de la ligadura se MIDE sobre el glifo real (canvas), no se aproxima.
 */
import { useEffect, useId, useRef } from 'react';

const S = 200;               // unidades de dibujo
const FONT = 'Michroma';
const NAME = 'Alex Woodcock';
const clamp = (x: number) => Math.max(0, Math.min(1, x));
const inOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const expo = (x: number) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x));

type Geo = { xs: number[]; ws: number[]; width: number; wx: number; aRight: number; wLeft: number; wRight: number; top: number; bot: number };
let geoCache: Geo | null = null;

function measure(): Geo {
  if (geoCache) return geoCache;
  const cv = document.createElement('canvas'); cv.width = 1400; cv.height = 440;
  const cx = cv.getContext('2d', { willReadFrequently: true })!;
  cx.font = `400 ${S}px "${FONT}", sans-serif`;
  const xs: number[] = [], ws: number[] = []; let x = 0;
  for (const c of NAME) { const w = cx.measureText(c).width; xs.push(x); ws.push(w); x += w; }
  const glyph = (ch: string) => {
    cx.clearRect(0, 0, cv.width, cv.height); cx.fillStyle = '#000'; const ox = 120, base = 330; cx.fillText(ch, ox, base);
    const img = cx.getImageData(0, 0, cv.width, cv.height).data; const ink = (px: number, py: number) => img[(py * cv.width + px) * 4 + 3] > 110;
    let top = cv.height, bot = 0, left = cv.width, right = 0;
    for (let py = 0; py < cv.height; py++) for (let px = 0; px < cv.width; px++) if (ink(px, py)) { top = Math.min(top, py); bot = Math.max(bot, py); left = Math.min(left, px); right = Math.max(right, px); }
    const runsAt = (yy: number) => { const py = Math.round(yy + base); const r: [number, number][] = []; let s = -1; for (let px = 0; px < cv.width; px++) { const k = ink(px, py); if (k && s < 0) s = px; if (!k && s >= 0) { r.push([s - ox, px - ox]); s = -1; } } return r; };
    return { top: top - base, bot: bot - base, left: left - ox, right: right - ox, runsAt };
  };
  const A = glyph('A'), W = glyph('W');
  const ym = A.top + (A.bot - A.top) * 0.55, ar = A.runsAt(ym), wr = W.runsAt(ym);
  const wx = ar.length >= 2 && wr.length ? ar[ar.length - 1][1] - wr[0][1] : xs[5];
  geoCache = { xs, ws, width: x, wx, aRight: A.right, wLeft: W.left, wRight: W.right, top: Math.min(A.top, W.top), bot: Math.max(A.bot, W.bot) };
  return geoCache;
}

/** s: 0 = acrónimo AW · 1 = «Alex Woodcock». `height` en px de la caja de mayúsculas aprox. */
export function BrandLockup({ state, height = 15, duration = 1100 }: { state: 'mark' | 'name'; height?: number; duration?: number }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const cur = useRef(state === 'name' ? 1 : 0);
  const paintRef = useRef<(s: number) => void>(() => {});
  const ready = useRef(false);
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');   // ids únicos: puede haber dos marcas a la vez

  useEffect(() => {
    let off = false;
    const svg = svgRef.current!;
    const build = () => {
      if (off) return;
      const g = measure();
      const word = (from: number, to: number, anchor: number) => NAME.slice(from, to).split('').map((c, k) => c === ' ' ? '' : `<text x="${(g.xs[from + k] - g.xs[anchor]).toFixed(2)}" data-w="${g.ws[from + k].toFixed(2)}">${c}</text>`).join('');
      svg.innerHTML = `<defs><clipPath id="awLex${uid}" clipPathUnits="userSpaceOnUse"><rect data-k="RL" y="${-S}" height="${S * 1.4}"/></clipPath><clipPath id="awWood${uid}" clipPathUnits="userSpaceOnUse"><rect data-k="RW" y="${-S}" height="${S * 1.4}"/></clipPath></defs>
        <g font-family="${FONT}" font-size="${S}" fill="currentColor"><g data-k="LexG" clip-path="url(#awLex${uid})">${word(1, 5, 0)}</g><g data-k="WoodG" clip-path="url(#awWood${uid})">${word(6, NAME.length, 5)}</g><text data-k="W">W</text><text data-k="A">A</text></g>`;
      const q = (k: string) => svg.querySelector(`[data-k="${k}"]`) as SVGGraphicsElement;
      const tW = q('W'), gWood = q('WoodG'), rL = q('RL'), rW = q('RW');
      const lexL = [...q('LexG').children] as SVGTextElement[], woodL = [...gWood.children] as SVGTextElement[];
      const pad = S * 0.04, h = g.bot - g.top + pad * 2;
      paintRef.current = (s: number) => {
        const tr = inOut(clamp(s / 0.6));
        const wX = g.wx + (g.xs[5] - g.wx) * tr;
        tW.setAttribute('transform', `translate(${wX.toFixed(2)} 0)`); gWood.setAttribute('transform', `translate(${wX.toFixed(2)} 0)`);
        const revLex = expo(clamp((s - 0.1) / 0.62)), revWood = expo(clamp((s - 0.16) / 0.62));
        const lexFront = Math.min(g.aRight + (g.xs[5] - g.aRight) * revLex, wX + g.wLeft - S * 0.02);
        const woodFrom = g.wRight - S * 0.02, woodFront = woodFrom + (g.width - g.xs[5] + S * 0.05 - woodFrom) * revWood;
        rL.setAttribute('x', g.aRight.toFixed(2)); rL.setAttribute('width', Math.max(0, lexFront - g.aRight).toFixed(2));
        rW.setAttribute('x', woodFrom.toFixed(2)); rW.setAttribute('width', Math.max(0, woodFront - woodFrom).toFixed(2));
        lexL.forEach((t) => { const x = Number(t.getAttribute('x')), w = Number(t.dataset.w); t.setAttribute('opacity', clamp((lexFront - x) / (w * 0.9)).toFixed(3)); });
        woodL.forEach((t) => { const x = Number(t.getAttribute('x')), w = Number(t.dataset.w); t.setAttribute('opacity', clamp((woodFront - x) / (w * 0.9)).toFixed(3)); });   // espacio local de la W
        // la caja crece con lo visible: la barra superior no reserva el hueco del nombre en estado acrónimo
        const right = wX + Math.max(g.wRight, woodFront) + pad;
        const vw = right + pad;
        svg.setAttribute('viewBox', `${(-pad).toFixed(1)} ${(g.top - pad).toFixed(1)} ${vw.toFixed(1)} ${h.toFixed(1)}`);
        svg.setAttribute('width', ((vw / h) * height * (h / (g.bot - g.top))).toFixed(1));
        svg.setAttribute('height', (height * (h / (g.bot - g.top))).toFixed(1));
      };
      ready.current = true;
      paintRef.current(cur.current);
    };
    document.fonts.load(`400 ${S}px "${FONT}"`, 'AWlexoodck').then(() => document.fonts.ready).then(build).catch(build);
    return () => { off = true; };
  }, [height, uid]);

  useEffect(() => {
    const to = state === 'name' ? 1 : 0;
    if (!ready.current) { cur.current = to; return; }
    const from = cur.current; if (from === to) { paintRef.current(to); return; }
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const dur = reduce ? 0 : duration * Math.abs(to - from); const t0 = performance.now(); let raf = 0;
    const step = (now: number) => { const p = dur ? Math.min(1, (now - t0) / dur) : 1; cur.current = from + (to - from) * p; paintRef.current(cur.current); if (p < 1) raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [state, duration]);

  return <svg ref={svgRef} className="aw-lockup" role="img" aria-label="Alex Woodcock" height={height} style={{ display: 'block', overflow: 'visible' }} />;
}
