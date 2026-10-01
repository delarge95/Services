/**
 * MiniDeck.tsx — Presentación interactiva de ejemplo (ciclo 30): versión SIMPLIFICADA de la
 * presentación de sustentación de TwinSight X500 (E:\WebGL_tesis\Informe_final\presentation\
 * index_final_3d.html, 36 diapositivas → 7). Cifras copiadas literalmente de esa presentación.
 * Navegación: botones, puntos, flechas del teclado y deslizar en móvil. Visuales: 3D real
 * (ShowcaseScene) o gráficos animados en SVG. Bilingüe.
 */
import { useEffect, useRef, useState } from 'react';
import { ShowcaseScene } from './ShowcaseScene';

type Lang = 'es' | 'en';
type Visual = { kind: '3d'; sel: string } | { kind: 'pipeline' } | { kind: 'taxonomy' } | { kind: 'fps' } | { kind: 'sus' };
interface Slide { kicker: [string, string]; title: [string, string]; body: [string, string]; points?: [string, string][]; visual: Visual }

const SLIDES: Slide[] = [
  { kicker: ['Defensa de grado · Ingeniería Multimedia', 'Degree defense · Multimedia Engineering'], title: ['TwinSight X500', 'TwinSight X500'],
    body: ['Convierte un ensamblaje complejo en una experiencia WebGL inspeccionable, directamente en el navegador.', 'Turns a complex assembly into an inspectable WebGL experience, right in the browser.'],
    visual: { kind: '3d', sel: 'rotar' } },
  { kicker: ['Problema', 'Problem'], title: ['Entender cómo se relacionan las piezas', 'Understanding how the parts relate'],
    body: ['Planos y manuales dispersan la información; el usuario reconstruye mentalmente profundidad y ensamblaje.', 'Drawings and manuals scatter the information; users rebuild depth and assembly in their heads.'],
    points: [['Documentación separada', 'Scattered documentation'], ['Fricción al leer vistas planas', 'Friction reading flat views'], ['Respuesta: ubicar, seleccionar y aislar en 3D', 'Answer: locate, select and isolate in 3D']],
    visual: { kind: '3d', sel: 'hotspots' } },
  { kicker: ['Pipeline', 'Pipeline'], title: ['De 6,5 millones a 95 617 triángulos', 'From 6.5 million to 95,617 triangles'],
    body: ['El CAD teselado (STEPper) produjo 6 525 748 triángulos; el activo final para WebGL usa 95 617, conservando nombre y jerarquía de cada pieza.', 'The tessellated CAD (STEPper) produced 6,525,748 triangles; the final WebGL asset uses 95,617, keeping every part’s name and hierarchy.'],
    visual: { kind: 'pipeline' } },
  { kicker: ['Taxonomía', 'Taxonomy'], title: ['La app sabe qué tocó el usuario', 'The app knows what the user touched'],
    body: ['28 piezas canónicas, 30 anclas de escena y 257 renderers/colliders. La tornillería era el 79 % del archivo importado (425 208 triángulos).', '28 canonical parts, 30 scene anchors and 257 renderers/colliders. Fasteners were 79% of the imported file (425,208 triangles).'],
    visual: { kind: 'taxonomy' } },
  { kicker: ['Rendimiento', 'Performance'], title: ['Viable, pero no universal en todo móvil', 'Viable, but not universal on every phone'],
    body: ['FPS promedio por dispositivo frente a la meta de 30 FPS.', 'Average FPS per device against the 30 FPS target.'],
    visual: { kind: 'fps' } },
  { kicker: ['Usabilidad', 'Usability'], title: ['SUS 91,88: recepción favorable', 'SUS 91.88: favorable reception'],
    body: ['Escala SUS aplicada al visor 3D (n = 12): mediana 95, rango 60–100. La media histórica de referencia es 68.', 'SUS scale applied to the 3D viewer (n = 12): median 95, range 60–100. The historical reference mean is 68.'],
    visual: { kind: 'sus' } },
  { kicker: ['Cierre', 'Closing'], title: ['De la complejidad física a la legibilidad interactiva', 'From physical complexity to interactive legibility'],
    body: ['Una arquitectura WebGL trazable para la inspección técnica de ensamblajes complejos.', 'A traceable WebGL architecture for the technical inspection of complex assemblies.'],
    visual: { kind: '3d', sel: 'desarmar' } },
];

function useCount(target: number, active: boolean, ms = 1200) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!active) { setV(0); return; }
    let raf = 0; const t0 = performance.now();
    const step = () => { const k = Math.min(1, (performance.now() - t0) / ms); setV(target * (1 - Math.pow(1 - k, 3))); if (k < 1) raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, active, ms]);
  return v;
}

function DataVisual({ v, lang }: { v: Visual; lang: Lang }) {
  const en = lang === 'en';
  const nf = new Intl.NumberFormat(en ? 'en-US' : 'es-CO');
  const big = useCount(6525748, v.kind === 'pipeline');
  const small = useCount(95617, v.kind === 'pipeline', 1600);
  const pct = useCount(79, v.kind === 'taxonomy');
  const sus = useCount(91.88, v.kind === 'sus');
  if (v.kind === 'pipeline') {
    const steps = ['CAD STEP', 'STEPper', 'Blender', en ? 'Retopo + bake' : 'Retopo + bake', 'Unity', 'WebGL'];
    return (
      <div className="md-viz">
        <div className="md-count"><span>{nf.format(Math.round(big))}</span><small>{en ? 'triangles · tessellated CAD' : 'triángulos · CAD teselado'}</small></div>
        <div className="md-arrow">↓ {en ? '−98.5%' : '−98,5 %'}</div>
        <div className="md-count accent"><span>{nf.format(Math.round(small))}</span><small>{en ? 'triangles · WebGL asset' : 'triángulos · activo WebGL'}</small></div>
        <div className="md-flow">{steps.map((s, i) => <span key={s} style={{ animationDelay: `${i * 0.12}s` }}>{s}</span>)}</div>
      </div>
    );
  }
  if (v.kind === 'taxonomy') {
    const r = 46, c = 2 * Math.PI * r;
    return (
      <div className="md-viz md-tax">
        <svg viewBox="0 0 120 120" width="150" height="150" role="img" aria-label={en ? 'Fasteners: 79% of the file' : 'Tornillería: 79 % del archivo'}>
          <circle cx="60" cy="60" r={r} fill="none" stroke="var(--cx-soft)" strokeWidth="14" />
          <circle cx="60" cy="60" r={r} fill="none" stroke="var(--cx-accent)" strokeWidth="14" strokeDasharray={`${(c * pct) / 100} ${c}`} transform="rotate(-90 60 60)" strokeLinecap="round" />
          <text x="60" y="58" textAnchor="middle" fontSize="22" fontWeight="700" fill="var(--cx-text)">{Math.round(pct)}%</text>
          <text x="60" y="76" textAnchor="middle" fontSize="8.5" fill="var(--cx-muted)">{en ? 'fasteners' : 'tornillería'}</text>
        </svg>
        <div className="md-stats">
          {[['28', en ? 'canonical parts' : 'piezas canónicas'], ['30', en ? 'scene anchors' : 'anclas de escena'], ['257', en ? 'renderers/colliders' : 'renderers/colliders']].map(([n, l]) => <div key={l}><b>{n}</b><span>{l}</span></div>)}
        </div>
      </div>
    );
  }
  if (v.kind === 'fps') {
    const rows: [string, number][] = [[en ? 'Desktop' : 'Escritorio', 59.8], ['iOS Premium', 58.7], ['Redmi Note 10S', 26.5], [en ? 'Low-end Android' : 'Android gama baja', 17.6]];
    return (
      <div className="md-viz md-fps">
        {rows.map(([l, f], i) => (
          <div key={l} className="md-bar">
            <span>{l}</span>
            <div><i style={{ width: `${(f / 60) * 100}%`, animationDelay: `${i * 0.12}s`, background: f >= 30 ? 'var(--cx-accent)' : 'var(--cx-muted)' }} /></div>
            <b>{String(f).replace('.', en ? '.' : ',')}</b>
          </div>
        ))}
        <small className="md-cap">┆ {en ? '30 FPS target' : 'meta 30 FPS'}</small>
      </div>
    );
  }
  if (v.kind === 'sus') {
    const a = (sus / 100) * Math.PI;
    const x = 70 - 55 * Math.cos(a), y = 75 - 55 * Math.sin(a);
    const ra = (68 / 100) * Math.PI;
    return (
      <div className="md-viz">
        <svg viewBox="0 0 140 90" width="240" role="img" aria-label="SUS 91.88">
          <path d="M15 75 A55 55 0 0 1 125 75" fill="none" stroke="var(--cx-soft)" strokeWidth="12" strokeLinecap="round" />
          <path d={`M15 75 A55 55 0 0 1 ${x} ${y}`} fill="none" stroke="var(--cx-accent)" strokeWidth="12" strokeLinecap="round" />
          <line x1={70 - 48 * Math.cos(ra)} y1={75 - 48 * Math.sin(ra)} x2={70 - 64 * Math.cos(ra)} y2={75 - 64 * Math.sin(ra)} stroke="var(--cx-text)" strokeWidth="1.5" />
          <text x={70 - 70 * Math.cos(ra)} y={75 - 70 * Math.sin(ra)} fontSize="7" fill="var(--cx-muted)" textAnchor="middle">68</text>
          <text x="70" y="70" textAnchor="middle" fontSize="20" fontWeight="700" fill="var(--cx-text)">{sus.toFixed(2).replace('.', en ? '.' : ',')}</text>
        </svg>
        <small className="md-cap">{en ? 'SUS · 3D prototype · n = 12' : 'SUS · prototipo 3D · n = 12'}</small>
      </div>
    );
  }
  return null;
}

export function MiniDeck({ lang = 'es', liveUrl }: { lang?: Lang; liveUrl?: string }) {
  const [i, setI] = useState(0);
  const n = SLIDES.length;
  const s = SLIDES[i];
  const L = (p: [string, string]) => (lang === 'en' ? p[1] : p[0]);
  const go = (d: number) => setI((x) => Math.max(0, Math.min(n - 1, x + d)));
  const touch = useRef<number | null>(null);
  return (
    <div className="md-deck" tabIndex={0} role="region" aria-roledescription={lang === 'en' ? 'slideshow' : 'presentación'}
      aria-label={lang === 'en' ? 'Interactive presentation example' : 'Ejemplo de presentación interactiva'}
      onKeyDown={(e) => { if (e.key === 'ArrowRight') { e.preventDefault(); go(1); } if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); } }}
      onTouchStart={(e) => { touch.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => { if (touch.current === null) return; const d = e.changedTouches[0].clientX - touch.current; if (Math.abs(d) > 50) go(d < 0 ? 1 : -1); touch.current = null; }}>
      <style>{`
        .md-deck { position: relative; border-radius: 14px; overflow: hidden; background: var(--cx-card-solid); border: 1px solid var(--cx-border-strong); outline: none; }
        .md-deck:focus-visible { box-shadow: 0 0 0 2px var(--cx-accent); }
        .md-progress { height: 3px; background: var(--cx-soft); } .md-progress i { display: block; height: 100%; background: var(--cx-accent); transition: width .5s cubic-bezier(.22,1,.36,1); }
        .md-slide { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr); gap: 16px; padding: 18px; min-height: 340px; align-items: center; animation: md-in .45s cubic-bezier(.22,1,.36,1) both; }
        @keyframes md-in { from { opacity: 0; transform: translateX(14px); } to { opacity: 1; transform: none; } }
        .md-kicker { font: 600 10.5px var(--cx-mono, monospace); letter-spacing: .16em; text-transform: uppercase; color: var(--cx-accent); }
        .md-slide h4 { margin: 8px 0; font: 700 22px/1.15 var(--cx-display, system-ui); color: var(--cx-text); letter-spacing: -.02em; }
        .md-slide p { margin: 0; font-size: 13.5px; line-height: 1.55; color: var(--cx-muted); }
        .md-points { margin: 10px 0 0; padding: 0; list-style: none; display: grid; gap: 6px; }
        .md-points li { font-size: 13px; color: var(--cx-text); padding-left: 16px; position: relative; animation: md-in .4s both; }
        .md-points li::before { content: ''; position: absolute; left: 0; top: 6px; width: 7px; height: 7px; background: var(--cx-accent); transform: rotate(45deg); }
        .md-viz { display: flex; flex-direction: column; align-items: center; gap: 8px; position: relative; }
        .md-count { text-align: center; } .md-count span { display: block; font: 700 30px var(--cx-display, system-ui); color: var(--cx-text); font-variant-numeric: tabular-nums; }
        .md-count.accent span { color: var(--cx-accent); font-size: 38px; } .md-count small, .md-cap { font-size: 11.5px; color: var(--cx-muted); }
        .md-arrow { font: 600 12px var(--cx-mono, monospace); color: var(--cx-accent); }
        .md-flow { display: flex; flex-wrap: wrap; justify-content: center; gap: 4px; margin-top: 6px; }
        .md-flow span { font: 500 10.5px var(--cx-mono, monospace); padding: 3px 7px; border-radius: 6px; background: var(--cx-tile); color: var(--cx-text); animation: md-in .4s both; }
        .md-tax { flex-direction: row; justify-content: center; gap: 18px; flex-wrap: wrap; }
        .md-stats { display: grid; gap: 8px; } .md-stats div { display: flex; align-items: baseline; gap: 8px; } .md-stats b { font: 700 24px var(--cx-display, system-ui); color: var(--cx-accent); min-width: 48px; } .md-stats span { font-size: 12px; color: var(--cx-muted); }
        .md-fps { width: 100%; align-items: stretch; }
        .md-bar { display: grid; grid-template-columns: 34% 1fr 40px; align-items: center; gap: 8px; font-size: 12px; color: var(--cx-text); }
        .md-bar div { position: relative; height: 14px; border-radius: 7px; background: var(--cx-soft); overflow: hidden; }
        .md-bar div::after { content: ''; position: absolute; left: 50%; top: 0; bottom: 0; border-left: 1.5px dashed var(--cx-text); opacity: .55; }
        .md-bar i { display: block; height: 100%; border-radius: 7px; animation: md-grow .9s cubic-bezier(.22,1,.36,1) both; transform-origin: left; }
        @keyframes md-grow { from { transform: scaleX(0); } to { transform: scaleX(1); } }
        .md-bar b { font: 700 13px var(--cx-mono, monospace); text-align: right; }
        .md-nav { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 10px 14px; border-top: 1px solid var(--cx-border); }
        .md-nav button { font: 600 13px var(--cx-sans, system-ui); padding: 7px 12px; border-radius: 999px; cursor: pointer; border: 1px solid var(--cx-border-strong); background: transparent; color: var(--cx-text); }
        .md-nav button.next { background: var(--cx-accent); border-color: var(--cx-accent); color: var(--cx-on-accent); }
        .md-nav button:disabled { opacity: .35; cursor: default; }
        .md-dots { display: flex; gap: 5px; align-items: center; } .md-dots button { width: 7px; height: 7px; padding: 0; border-radius: 50%; border: none; background: var(--cx-border-strong); }
        .md-dots button[aria-current='true'] { width: 18px; border-radius: 4px; background: var(--cx-accent); }
        .md-num { font: 600 11px var(--cx-mono, monospace); color: var(--cx-faint); }
        @media (max-width: 640px) { .md-slide { grid-template-columns: 1fr; } }
        @media (prefers-reduced-motion: reduce) { .md-slide, .md-points li, .md-bar i, .md-flow span { animation: none; } }
      `}</style>
      <div className="md-progress"><i style={{ width: `${((i + 1) / n) * 100}%` }} /></div>
      <div key={i} className="md-slide" aria-live="polite">
        <div>
          <span className="md-kicker">{String(i + 1).padStart(2, '0')} · {L(s.kicker)}</span>
          <h4>{L(s.title)}</h4>
          <p>{L(s.body)}</p>
          {s.points && <ul className="md-points">{s.points.map((p, k) => <li key={k} style={{ animationDelay: `${0.1 + k * 0.1}s` }}>{L(p)}</li>)}</ul>}
          {i === n - 1 && liveUrl && <p style={{ marginTop: 12 }}><a href={liveUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--cx-accent)', fontWeight: 600, textDecoration: 'none' }}>{lang === 'en' ? 'Try the live viewer ↗' : 'Probar el visor en vivo ↗'}</a></p>}
        </div>
        <div>{s.visual.kind === '3d' ? <ShowcaseScene kind="interaction" selected={s.visual.sel} lang={lang} height={240} /> : <DataVisual v={s.visual} lang={lang} />}</div>
      </div>
      <div className="md-nav">
        <button type="button" onClick={() => go(-1)} disabled={i === 0}>← {lang === 'en' ? 'Previous' : 'Anterior'}</button>
        <div className="md-dots">
          {SLIDES.map((_, k) => <button key={k} type="button" aria-label={`${k + 1}`} aria-current={k === i} onClick={() => setI(k)} />)}
          <span className="md-num">{i + 1}/{n}</span>
        </div>
        <button type="button" className="next" onClick={() => go(1)} disabled={i === n - 1}>{lang === 'en' ? 'Next' : 'Siguiente'} →</button>
      </div>
    </div>
  );
}
