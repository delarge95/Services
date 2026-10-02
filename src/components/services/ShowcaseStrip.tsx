/**
 * ShowcaseStrip.tsx — "Trabajo real" en la portada del cotizador (ciclo 31, auditoría de marketing).
 * La portada era solo un embudo de cotización: el visitante no veía qué tipo de trabajo puede
 * obtener hasta entrar en una rama. Esta franja muestra 3 piezas REALES (fotogramas capturados de
 * nuestras propias escenas y una grabación del visor TwinSight) y cada una abre directamente su
 * rama del cotizador con el evento `cx-open-quote`. Nada de imágenes de stock.
 */
import { useRef } from 'react';

type Lang = 'es' | 'en';
type Val = string | number | boolean;
const BASE = import.meta.env.BASE_URL;
const open = (rootChoice: string, subChoice: string, answers: Record<string, Val> = {}) =>
  window.dispatchEvent(new CustomEvent('cx-open-quote', { detail: { kind: 'wizard', rootChoice, subChoice, answers } }));

interface Card { id: string; img: string; video?: string; tag: [string, string]; title: [string, string]; desc: [string, string]; go: () => void }
const CARDS: Card[] = [
  { id: 'deck', img: `${BASE}cotizador/showcase/presentacion.webp`, tag: ['Presentación interactiva', 'Interactive presentation'],
    title: ['Una sustentación convertida en experiencia 3D', 'A thesis defense turned into a 3D experience'],
    desc: ['Intro cinematográfica, taxonomía por pasos, un tornillo que se arma solo y simulación térmica.', 'Cinematic intro, step-by-step taxonomy, a self-assembling screw and a thermal simulation.'],
    go: () => open('otros', 'WEB-08') },
  { id: 'viewer', img: `${BASE}cotizador/cases/twinsight/despiece.webp`, video: `${BASE}cotizador/cases/twinsight/despiece.webm`, tag: ['CAD a la web', 'CAD to the web'],
    title: ['Tu ensamblaje, inspeccionable en el móvil', 'Your assembly, inspectable on a phone'],
    desc: ['Despiece, corte y modos de inspección en el navegador, sin instalar nada.', 'Exploded view, section cuts and inspection modes in the browser, with no installs.'],
    go: () => open('otros', 'CAD-01') },
  { id: 'config', img: `${BASE}cotizador/showcase/configurador.webp`, tag: ['Configurador 3D', '3D configurator'],
    title: ['Tu cliente elige acabados y ve el resultado', 'Your customer picks finishes and sees the result'],
    desc: ['Paletas, materiales y vistas técnicas sobre el modelo real. Pruébalo aquí mismo.', 'Palettes, materials and technical views on the real model. Try it right here.'],
    go: () => open('web-3d', 'web-app', { 'tipo-app': 'configurador' }) },
];

function CardView({ c, lang, i }: { c: Card; lang: Lang; i: number }) {
  const L = (p: [string, string]) => (lang === 'en' ? p[1] : p[0]);
  const vid = useRef<HTMLVideoElement>(null);
  const play = () => { const v = vid.current; if (v && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) v.play().catch(() => {}); };
  const stop = () => { const v = vid.current; if (v) { v.pause(); } };
  return (
    <button type="button" className={`cx-show-card ds-anim ds-anim-${(i % 3) + 1}`} onClick={c.go} onMouseEnter={play} onMouseLeave={stop} onFocus={play} onBlur={stop}>
      <span className="cx-show-media">
        <img src={c.img} alt="" loading="lazy" decoding="async" />
        {c.video && <video ref={vid} src={c.video} muted loop playsInline preload="none" aria-hidden="true" />}
      </span>
      <span className="cx-show-body">
        <span className="cx-show-tag">{L(c.tag)}</span>
        <span className="cx-show-title">{L(c.title)}</span>
        <span className="cx-show-desc">{L(c.desc)}</span>
        <span className="cx-show-cta">{lang === 'en' ? 'See it and quote →' : 'Verlo y cotizar →'}</span>
      </span>
    </button>
  );
}

export function ShowcaseStrip({ lang = 'es' }: { lang?: Lang }) {
  const en = lang === 'en';
  return (
    <section data-snap data-snap-offset="70" className="cx-show cx-wide" aria-labelledby="cx-show-h">
      <style>{`
        .cx-show { margin: 56px 0 0; text-align: left; }
        .cx-show-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 14px; }
        .cx-show-head h2 { margin: 0; font: 700 clamp(1.3rem, 2.6vw, 1.6rem)/1.2 var(--cx-display, system-ui); letter-spacing: -.02em; color: var(--cx-text); }
        .cx-show-head p { margin: 0; font-size: 13.5px; color: var(--cx-muted); }
        .cx-show-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
        .cx-show-card { display: flex; flex-direction: column; padding: 0; overflow: hidden; text-align: left; font: inherit; cursor: pointer; border-radius: 16px; border: 1px solid var(--cx-border); background: var(--cx-card); transition: transform .25s cubic-bezier(.25,.8,.4,1), border-color .25s, box-shadow .25s; }
        .cx-show-card:hover, .cx-show-card:focus-visible { transform: translateY(-3px); border-color: var(--cx-accent-border); box-shadow: 0 18px 40px -24px var(--cx-accent); }
        .cx-show-card:focus-visible { outline: 2px solid var(--cx-accent); outline-offset: 2px; }
        .cx-show-media { position: relative; display: block; aspect-ratio: 16 / 10; background: #08090b; overflow: hidden; }
        .cx-show-media img, .cx-show-media video { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; transition: transform .6s cubic-bezier(.2,.8,.2,1), opacity .4s; }
        .cx-show-media video { opacity: 0; }
        .cx-show-card:hover .cx-show-media video, .cx-show-card:focus-visible .cx-show-media video { opacity: 1; }
        .cx-show-card:hover .cx-show-media img { transform: scale(1.04); }
        .cx-show-body { display: flex; flex-direction: column; gap: 5px; padding: 12px 14px 14px; flex: 1; }
        .cx-show-tag { font: 600 10px var(--cx-mono, monospace); letter-spacing: .14em; text-transform: uppercase; color: var(--cx-accent); }
        .cx-show-title { font: 600 15px/1.3 var(--cx-display, system-ui); color: var(--cx-text); letter-spacing: -.01em; }
        .cx-show-desc { font-size: 12.5px; line-height: 1.45; color: var(--cx-muted); flex: 1; }
        .cx-show-cta { margin-top: 4px; font-size: 12.5px; font-weight: 600; color: var(--cx-accent); }
        .cx-show-game { margin-top: 12px; width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 16px; border-radius: 14px; border: 1px dashed var(--cx-accent-border); background: var(--cx-accent-soft); color: var(--cx-text); font: inherit; text-align: left; cursor: pointer; transition: border-color .2s; }
        .cx-show-game:hover { border-style: solid; }
        .cx-show-game b { font: 600 14px var(--cx-display, system-ui); } .cx-show-game small { display: block; font-size: 12.5px; color: var(--cx-muted); margin-top: 2px; }
        .cx-show-game span:last-child { color: var(--cx-accent); font-weight: 600; font-size: 13px; white-space: nowrap; }
        @media (max-width: 720px) { .cx-show-grid { grid-template-columns: 1fr; } .cx-show-media { aspect-ratio: 16 / 9; } }
        @media (prefers-reduced-motion: reduce) { .cx-show-card, .cx-show-media img { transition: none; } }
      `}</style>
      <div className="cx-show-head">
        <h2 id="cx-show-h">{en ? 'Real work you can get' : 'Trabajo real que puedes obtener'}</h2>
        <p>{en ? 'Each one opens its quote, already configured.' : 'Cada uno abre su cotización ya configurada.'}</p>
      </div>
      <div className="cx-show-grid">{CARDS.map((c, i) => <CardView key={c.id} c={c} lang={lang} i={i} />)}</div>
      <button type="button" className="cx-show-game" onClick={() => open('web-3d', 'web-app', { 'tipo-app': 'juego' })}>
        <span><b>{en ? 'Minigame with a leaderboard' : 'Minijuego con ranking'}</b><small>{en ? 'Fly the drone between rings and rocks. Can you make the top 3?' : 'Pilota el dron entre anillos y rocas. ¿Llegas al top 3?'}</small></span>
        <span>{en ? 'Play →' : 'Jugar →'}</span>
      </button>
    </section>
  );
}
