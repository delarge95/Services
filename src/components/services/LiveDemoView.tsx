/**
 * LiveDemoView.tsx — Demos EN VIVO para servicios sin caso de estudio que encaje (ciclo 32).
 * - RTA-03 (Modelo animado): el caso anterior eran grabaciones de la app de inspección, que
 *   corresponden a CAD a la web, no a un modelo animado. Ahora se ve un modelo animado de verdad:
 *   el X500 en bucle (encendido → despegue → vuelo estacionario → aterrizaje), en tiempo real.
 * - WEB-07 (Catálogo 3D): el catálogo interactivo (arrastrar, tocar, variantes por producto).
 */
import { lazy, Suspense } from 'react';
import { ShowcaseScene } from './ShowcaseScene';
import { ProceduralFxDemo } from './ProceduralFxDemo';

const Preshow = lazy(() => import('./twinsight/Preshow').then((m) => ({ default: m.Preshow })));

type Lang = 'es' | 'en';
type Demo = { title: [string, string]; sub: [string, string]; kind: 'loop' | 'catalog' | 'procedural' };

export const LIVE_DEMOS: Record<string, Demo> = {
  'RTA-03': {
    title: ['El X500 animado, en bucle, en tu web', 'The X500 animated, looping, on your website'],
    sub: ['Encendido, arranque de motores, despegue, vuelo estacionario y aterrizaje: un solo modelo 3D animado en tiempo real, sin video. Así puede vivir tu producto en una web o una app.',
      'Power-on, motor spin-up, take-off, hover and landing: a single 3D model animated in real time, no video. This is how your product can live on a website or an app.'],
    kind: 'loop',
  },
  'WEB-07': {
    title: ['Catálogo 3D interactivo', 'Interactive 3D catalog'],
    sub: ['Arrastra para girar el producto, toca uno de los laterales para traerlo al frente y cambia sus variantes: acabados, nivel de detalle o despiece.',
      'Drag to rotate the product, tap one on the sides to bring it forward and switch its variants: finishes, detail level or exploded view.'],
    kind: 'catalog',
  },
  'VFX-04': { // ciclo 42
    title: ['Efectos generados en vivo, en tu web', 'Effects generated live, on your website'],
    sub: ['Humo, partículas y energía hechos con un shader en el navegador: sin video ni render por shot. Mueve el cursor encima, cambia el efecto, la intensidad y el color — así se ajusta el que se entrega.',
      'Smoke, particles and energy made with a shader in the browser: no video, no per-shot render. Move the cursor over it, switch the effect, intensity and color — that is how the delivered one is tuned.'],
    kind: 'procedural',
  },
};

export function LiveDemoView({ id, lang = 'es' }: { id: string; lang?: Lang }) {
  const d = LIVE_DEMOS[id];
  if (!d) return null;
  const L = (p: [string, string]) => (lang === 'en' ? p[1] : p[0]);
  return (
    <section data-snap data-snap-offset="70" className="cs-card cx-wide" aria-label={L(d.title)}>
      <style>{`
        .cs-card { border: 1px solid var(--cx-accent-border); border-radius: 18px; background: var(--cx-card); padding: 18px; margin: 0 0 18px; }
        .ld-kicker { display: inline-flex; align-items: center; gap: 6px; font: 600 10.5px var(--cx-mono, monospace); letter-spacing: .16em; text-transform: uppercase; color: var(--cx-accent); }
        .ld-kicker i { width: 7px; height: 7px; border-radius: 50%; background: var(--cx-accent); box-shadow: 0 0 10px var(--cx-accent); animation: ld-pulse 2.2s ease-in-out infinite; }
        @keyframes ld-pulse { 50% { opacity: .3; } }
        .ld-h { margin: 6px 0 4px; font-size: 19px; color: var(--cx-text); }
        .ld-sub { margin: 0 0 12px; font-size: 13px; color: var(--cx-muted); line-height: 1.5; max-width: 70ch; }
        .ld-stage { border-radius: 14px; overflow: hidden; }
        .ld-loop .ps-title, .ld-loop .ps-lore { display: none; }
        @media (prefers-reduced-motion: reduce) { .ld-kicker i { animation: none; } }
      `}</style>
      <span className="ld-kicker"><i aria-hidden="true" />{lang === 'en' ? 'Live demo' : 'Demo en vivo'}</span>
      <h3 className="ld-h">{L(d.title)}</h3>
      <p className="ld-sub">{L(d.sub)}</p>
      <div className={`ld-stage${d.kind === 'loop' ? ' ld-loop' : ''}`}>
        {d.kind === 'loop'
          ? <Suspense fallback={<div style={{ height: 420, background: '#07080a' }} />}><Preshow lang={lang} height={420} onStart={() => {}} /></Suspense>
          : d.kind === 'procedural' ? <ProceduralFxDemo lang={lang} height={400} />
          : <ShowcaseScene kind="app-type" selected="catalogo" lang={lang} height={400} />}
      </div>
    </section>
  );
}
