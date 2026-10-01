/**
 * CaseStudyView.tsx — Caso real interactivo dentro del cotizador (ciclo 27).
 * Pestañas: Proceso (pasos con imagen, avance automático, teclado) · En acción (videos
 * en bucle que solo se reproducen visibles) · Datos (cifras defendibles). Enlace al visor
 * en vivo. Datos en src/data/services/caseStudies.ts.
 */
import { useEffect, useRef, useState } from 'react';
import type { CaseStudy } from '../../data/services/caseStudies';
import { TwinsightDeck } from './twinsight/TwinsightDeck';

type Tab = 'steps' | 'videos' | 'facts';

function LoopVideo({ src, poster, label }: { src: string; poster: string; label: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const io = new IntersectionObserver((e) => {
      if (e.some((x) => x.isIntersecting)) { el.play().catch(() => {}); } else el.pause();
    }, { threshold: 0.25 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <figure className="cs-video">
      <video ref={ref} src={src} poster={poster} muted loop playsInline preload="none" aria-label={label} />
      <figcaption>{label}</figcaption>
    </figure>
  );
}

export function CaseStudyView({ cs: csEs, lang = 'es' }: { cs: CaseStudy; lang?: 'es' | 'en' }) {
  // ciclo 30: textos en el idioma del visitante (las imágenes/videos/cifras son las mismas)
  const e = lang === 'en' ? csEs.en : undefined;
  const cs: CaseStudy = e ? {
    ...csEs, title: e.title, subtitle: e.subtitle, source: e.source,
    steps: csEs.steps?.map((st, i) => ({ ...st, title: e.steps?.[i]?.[0] ?? st.title, text: e.steps?.[i]?.[1] ?? st.text })),
    videos: csEs.videos?.map((vd, i) => ({ ...vd, label: e.videos?.[i] ?? vd.label })),
    facts: csEs.facts?.map((f, i) => ({ ...f, label: e.facts?.[i] ?? f.label })),
  } : csEs;
  const tabs: Tab[] = [cs.steps?.length ? 'steps' : null, cs.videos?.length ? 'videos' : null, cs.facts?.length ? 'facts' : null].filter(Boolean) as Tab[];
  const [tab, setTab] = useState<Tab | undefined>(tabs[0]);
  const [step, setStep] = useState(0);
  const [hold, setHold] = useState(0);
  const n = cs.steps?.length ?? 0;
  useEffect(() => {
    if (tab !== 'steps' || n < 2) return;
    const t = setInterval(() => { if (Date.now() > hold) setStep((s) => (s + 1) % n); }, 4200);
    return () => clearInterval(t);
  }, [tab, n, hold]);
  const pick = (i: number) => { setStep(i); setHold(Date.now() + 9000); };
  const L = lang === 'en'
    ? { kicker: 'Real case', steps: 'Process', videos: 'In action', facts: 'Data', live: 'Open the live viewer', of: 'of' }
    : { kicker: 'Caso real', steps: 'Proceso', videos: 'En acción', facts: 'Datos', live: 'Abrir el visor en vivo', of: 'de' };
  const cur = cs.steps?.[step];
  return (
    <section className="cs-card" aria-label={`${L.kicker}: ${cs.title}`}>
      <style>{`
        .cs-card { border: 1px solid var(--cx-accent-border); border-radius: 18px; background: var(--cx-card); padding: 18px; margin: 0 0 18px; }
        .cs-kicker { display: inline-flex; align-items: center; gap: 6px; font: 600 10.5px var(--cx-mono, monospace); letter-spacing: .16em; text-transform: uppercase; color: var(--cx-accent); }
        .cs-kicker::before { content: ''; width: 6px; height: 6px; background: var(--cx-accent); transform: rotate(45deg); }
        .cs-card h3 { margin: 6px 0 4px; font-size: 19px; color: var(--cx-text); }
        .cs-sub { margin: 0 0 12px; font-size: 13px; color: var(--cx-muted); line-height: 1.5; }
        .cs-tabs { display: flex; gap: 6px; margin-bottom: 12px; }
        .cs-tab { font: 600 12.5px var(--cx-sans, system-ui); padding: 6px 12px; border-radius: 999px; cursor: pointer; border: 1px solid var(--cx-border-strong); background: transparent; color: var(--cx-muted); transition: all .2s; }
        .cs-tab[aria-selected='true'] { background: var(--cx-accent); border-color: var(--cx-accent); color: var(--cx-on-accent); }
        .cs-stage { position: relative; border-radius: 12px; overflow: hidden; background: var(--cx-tile); aspect-ratio: 1200 / 462; }
        .cs-stage img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; animation: cs-in .45s var(--cx-ease, ease) both; }
        @keyframes cs-in { from { opacity: 0; transform: scale(1.015); } to { opacity: 1; transform: none; } }
        .cs-steps { display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap: 6px; margin-top: 10px; }
        .cs-step { text-align: left; font: inherit; cursor: pointer; padding: 8px 10px; border-radius: 10px; border: 1px solid var(--cx-border); background: var(--cx-card-solid); color: var(--cx-muted); position: relative; overflow: hidden; }
        .cs-step b { display: block; font: 600 10px var(--cx-mono, monospace); color: var(--cx-faint); letter-spacing: .1em; }
        .cs-step span { font-size: 12px; font-weight: 600; }
        .cs-step[aria-current='true'] { border-color: var(--cx-accent); color: var(--cx-text); }
        .cs-step[aria-current='true']::after { content: ''; position: absolute; left: 0; bottom: 0; height: 2px; background: var(--cx-accent); animation: cs-bar 4.2s linear both; }
        @keyframes cs-bar { from { width: 0; } to { width: 100%; } }
        .cs-caption { margin: 10px 0 0; font-size: 13px; color: var(--cx-text); line-height: 1.5; }
        .cs-videos { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; }
        .cs-video { margin: 0; }
        .cs-video video { width: 100%; aspect-ratio: 9 / 16; object-fit: cover; border-radius: 12px; background: #0a0b0d; display: block; }
        .cs-video figcaption { margin-top: 6px; font-size: 12px; color: var(--cx-muted); text-align: center; }
        .cs-facts { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; }
        .cs-fact { padding: 14px; border-radius: 12px; background: var(--cx-card-solid); border: 1px solid var(--cx-border); }
        .cs-fact strong { display: block; font: 700 28px/1 var(--cx-display, system-ui); color: var(--cx-accent); }
        .cs-fact span { display: block; margin-top: 6px; font-size: 12px; color: var(--cx-muted); line-height: 1.4; }
        .cs-foot { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 8px; align-items: center; margin-top: 12px; }
        .cs-foot a { font: 600 13px var(--cx-sans, system-ui); color: var(--cx-accent); text-decoration: none; }
        .cs-foot small { font-size: 11px; color: var(--cx-faint); }
        @media (prefers-reduced-motion: reduce) { .cs-stage img, .cs-step::after { animation: none; } }
      `}</style>
      <span className="cs-kicker">{L.kicker}</span>
      <h3>{cs.title}</h3>
      <p className="cs-sub">{cs.subtitle}</p>
      {tabs.length > 1 && (
        <div className="cs-tabs" role="tablist">
          {tabs.map((t) => <button key={t} type="button" role="tab" aria-selected={tab === t} className="cs-tab" onClick={() => setTab(t)}>{L[t]}</button>)}
        </div>
      )}
      {cs.deck && <TwinsightDeck lang={lang} liveUrl={cs.liveUrl} />}
      {tab === 'steps' && cur && (
        <div role="tabpanel">
          <div className="cs-stage"><img key={cur.img} src={cur.img} alt={cur.title} loading="lazy" /></div>
          <p className="cs-caption"><strong>{step + 1} {L.of} {n} · {cur.title}.</strong> {cur.text}</p>
          <div className="cs-steps" onKeyDown={(e) => { if (e.key === 'ArrowRight') pick((step + 1) % n); if (e.key === 'ArrowLeft') pick((step - 1 + n) % n); }}>
            {cs.steps!.map((s, i) => (
              <button key={s.img} type="button" className="cs-step" aria-current={i === step} onClick={() => pick(i)}>
                <b>{String(i + 1).padStart(2, '0')}</b><span>{s.title}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      {tab === 'videos' && <div role="tabpanel" className="cs-videos">{cs.videos!.map((vd) => <LoopVideo key={vd.src} {...vd} />)}</div>}
      {tab === 'facts' && <div role="tabpanel" className="cs-facts">{cs.facts!.map((f) => <div key={f.label} className="cs-fact"><strong>{f.value}</strong><span>{f.label}</span></div>)}</div>}
      <div className="cs-foot">
        {cs.liveUrl ? <a href={cs.liveUrl} target="_blank" rel="noopener noreferrer">{L.live} ↗</a> : <span />}
        <small>{cs.source}</small>
      </div>
    </section>
  );
}
