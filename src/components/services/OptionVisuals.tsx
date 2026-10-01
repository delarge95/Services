/**
 * OptionVisuals.tsx — Visuales de opciones SIN modelo propio (ciclo 26, plan
 * docs/servicios/VISUALES_COTIZADOR.md · parte de código, sin assets nuevos).
 *
 * 1. ChoicePreview: vista 3D en vivo para preguntas de tarjetas (interactividad,
 *    tipo de app) reutilizando los modos reales de ModelPreview. Muestra la opción
 *    con el puntero encima o, si no, la última elegida.
 * 2. Diagram: diagramas SVG animados (línea de tiempo, canales, integraciones,
 *    flujo de datos, formatos), que reaccionan al valor de la pregunta.
 * 3. MediaVisual: soporte para los assets que produce Alexander (video en bucle,
 *    imagen, comparador antes/después) con etiqueta obligatoria si hay IA.
 */
import { useEffect, useRef, useState } from 'react';
import LazyModelPreview from './LazyModelPreview';
import type { LazyModelPreviewProps } from './LazyModelPreview';

type Lang = 'es' | 'en';

// ─── 1. Vista previa de tarjetas ───
export type ChoicePreviewKind = 'interaction' | 'app-type';

/** opción → props del preview 3D real (sin assets nuevos). */
const CHOICE_MODES: Record<ChoicePreviewKind, Record<string, Omit<LazyModelPreviewProps, 'lang' | 'height'> & { caption: string }>> = {
  interaction: {
    rotar: { mode: 'finish', finish: 'detallado', caption: 'Vista 360°: el visitante gira y hace zoom' },
    hotspots: { mode: 'hotspots', hotspots: 6, caption: 'Puntos de información sobre las piezas' },
    configurar: { mode: 'finish', finish: 'variado', caption: 'Cambia colores y materiales en vivo' },
    desarmar: { mode: 'assembly', pieces: 24, caption: 'Despiece: se desarma y vuelve a armarse' },
  },
  'app-type': {
    configurador: { mode: 'finish', finish: 'variado', caption: 'Configurador: el cliente elige y ve el resultado' },
    catalogo: { mode: 'surface', surface: 5, caption: 'Catálogo: cada producto en 3D' },
    herramienta: { mode: 'detail', detail: 4, caption: 'Herramienta técnica: visor de precisión' },
    juego: { mode: 'story', story: 3, caption: 'Experiencia lúdica con el producto' },
  },
};

export function ChoicePreview({ kind, current, hovered, lang = 'es' }: { kind: ChoicePreviewKind; current?: string; hovered?: string | null; lang?: Lang }) {
  const picked = String(current ?? '').split(',').filter(Boolean);
  const id = hovered ?? picked[picked.length - 1] ?? Object.keys(CHOICE_MODES[kind])[0];
  const cfg = CHOICE_MODES[kind][id] ?? Object.values(CHOICE_MODES[kind])[0];
  const { caption, ...props } = cfg;
  // ciclo 26: en "configurar" el acabado rota para que se vea el cambio en vivo
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!(id === 'configurar' || id === 'configurador')) return;
    const t = setInterval(() => setTick((n) => n + 1), 1600);
    return () => clearInterval(t);
  }, [id]);
  const finishes = ['variado', 'detallado', 'simple'] as const;
  const live = (id === 'configurar' || id === 'configurador') ? { ...props, finish: finishes[tick % 3] } : props;
  return (
    <div style={{ marginBottom: 14 }}>
      <LazyModelPreview {...live} lang={lang} height={260} />
      <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--cx-muted)', marginTop: 2 }} aria-live="polite">{caption}</div>
    </div>
  );
}

// ─── 2. Diagramas SVG ───
export type DiagramKind = 'timeline' | 'channels' | 'integrations' | 'dataflow' | 'aspect';

const C = { line: 'var(--cx-border-strong)', text: 'var(--cx-muted)', acc: 'var(--cx-accent)', sig: 'var(--cx-signal, var(--cx-accent))', tile: 'var(--cx-tile)' };

export function Diagram({ kind, value, max = 10, answers, lang = 'es' }: { kind: DiagramKind; value?: number | string | boolean; max?: number; answers?: Record<string, unknown>; lang?: Lang }) {
  const en = lang === 'en';
  const n = typeof value === 'number' ? value : Number(value) || 0;
  const box = { width: '100%', height: 150, display: 'block' } as const;
  if (kind === 'timeline') {
    // duración (s) o nº de shots: bloques sobre una línea de tiempo
    const shots = Number(answers?.numShots ?? 0) || Math.max(1, Math.min(8, Math.round(n / 10)));
    const w = Math.max(8, Math.min(100, (n / max) * 100));
    return (
      <svg viewBox="0 0 400 120" style={box} role="img" aria-label={`${en ? 'Timeline' : 'Línea de tiempo'}: ${n} ${max > 20 ? (en ? 'seconds' : 'segundos') : ''}`}>
        <line x1="20" y1="70" x2="380" y2="70" stroke={C.line} strokeWidth="2" />
        {Array.from({ length: 9 }, (_, i) => <line key={i} x1={20 + i * 45} y1="64" x2={20 + i * 45} y2="76" stroke={C.line} />)}
        <rect x="20" y="52" width={(360 * w) / 100} height="36" rx="6" fill={C.acc} opacity="0.18" style={{ transition: 'width .4s cubic-bezier(.22,1,.36,1)' }} />
        {Array.from({ length: shots }, (_, i) => (
          <rect key={i} x={22 + (i * (360 * w) / 100) / shots} y="56" width={Math.max(4, (360 * w) / 100 / shots - 4)} height="28" rx="4" fill={C.acc} opacity={0.55 + 0.45 * ((i + 1) / shots)} style={{ transition: 'all .4s' }} />
        ))}
        <text x="20" y="30" fill={C.text} fontSize="13" fontFamily="var(--cx-mono, monospace)">{n} {max > 20 ? 's' : ''} · {shots} {shots === 1 ? 'shot' : 'shots'}</text>
      </svg>
    );
  }
  if (kind === 'channels' || kind === 'integrations') {
    const labels = kind === 'channels' ? ['Web', 'WhatsApp', 'Slack', 'Teams', 'Email', 'App']
      : en ? ['CRM', 'Calendar', 'Inventory', 'ERP', 'Docs', 'Payments', 'Support', 'Analytics'] : ['CRM', 'Agenda', 'Inventario', 'ERP', 'Docs', 'Pagos', 'Soporte', 'Analítica'];
    const k = Math.max(kind === 'channels' ? 1 : 0, Math.min(labels.length, n));
    return (
      <svg viewBox="0 0 400 150" style={box} role="img" aria-label={`${k} ${kind === 'channels' ? (en ? 'channels' : 'canales') : (en ? 'connected systems' : 'sistemas conectados')}`}>
        <circle cx="200" cy="75" r="26" fill={C.acc} opacity="0.9" />
        <text x="200" y="80" textAnchor="middle" fill="var(--cx-on-accent)" fontSize="12" fontWeight="700">IA</text>
        {labels.map((l, i) => {
          const a = (i / labels.length) * Math.PI * 2 - Math.PI / 2;
          const x = 200 + Math.cos(a) * 130, y = 75 + Math.sin(a) * 52;
          const on = i < k;
          return (
            <g key={l} style={{ transition: 'opacity .35s' }} opacity={on ? 1 : 0.22}>
              <line x1="200" y1="75" x2={x} y2={y} stroke={on ? C.sig : C.line} strokeWidth={on ? 1.6 : 1} strokeDasharray={on ? '0' : '3 4'}>
                {on && <animate attributeName="stroke-dashoffset" from="20" to="0" dur="1.2s" repeatCount="indefinite" />}
              </line>
              <rect x={x - 34} y={y - 11} width="68" height="22" rx="6" fill={C.tile} stroke={on ? C.sig : C.line} />
              <text x={x} y={y + 4} textAnchor="middle" fill={C.text} fontSize="10.5">{l}</text>
            </g>
          );
        })}
      </svg>
    );
  }
  if (kind === 'dataflow') {
    const src = String(value ?? 'estaticos');
    const nodes = en
      ? (src === 'api' ? ['External API', 'Sync', '3D viewer'] : src === 'cms' ? ['CMS', 'Content', '3D viewer'] : ['JSON file', '3D viewer'])
      : (src === 'api' ? ['API externa', 'Sincronización', 'Visor 3D'] : src === 'cms' ? ['CMS', 'Contenido', 'Visor 3D'] : ['Archivo JSON', 'Visor 3D']);
    const step = 360 / nodes.length;
    return (
      <svg viewBox="0 0 400 110" style={box} role="img" aria-label={`${en ? 'Data flow' : 'Flujo de datos'}: ${nodes.join(' → ')}`}>
        {nodes.map((t, i) => (
          <g key={t}>
            <rect x={20 + i * step} y="38" width={step - 30} height="34" rx="8" fill={C.tile} stroke={i === nodes.length - 1 ? C.acc : C.line} />
            <text x={20 + i * step + (step - 30) / 2} y="59" textAnchor="middle" fill={C.text} fontSize="11">{t}</text>
            {i < nodes.length - 1 && (
              <g>
                <line x1={20 + i * step + step - 30} y1="55" x2={20 + (i + 1) * step} y2="55" stroke={C.sig} strokeWidth="1.6" strokeDasharray="4 4">
                  <animate attributeName="stroke-dashoffset" from="16" to="0" dur="0.9s" repeatCount="indefinite" />
                </line>
              </g>
            )}
          </g>
        ))}
      </svg>
    );
  }
  // aspect: formatos 16:9, 9:16, 1:1, 4:5, 21:9
  const fmts: [string, number, number][] = [['16:9', 64, 36], ['9:16', 27, 48], ['1:1', 42, 42], ['4:5', 36, 45], ['21:9', 70, 30]];
  const k = Math.max(1, Math.min(fmts.length, n || 1));
  let x = 20;
  return (
    <svg viewBox="0 0 400 110" style={box} role="img" aria-label={`${k} ${en ? 'formats' : 'formatos'}`}>
      {fmts.map(([t, w, h], i) => {
        const g = (
          <g key={t} opacity={i < k ? 1 : 0.2} style={{ transition: 'opacity .35s' }}>
            <rect x={x} y={60 - h / 2} width={w} height={h} rx="4" fill={i < k ? C.acc : 'none'} fillOpacity="0.2" stroke={i < k ? C.acc : C.line} />
            <text x={x + w / 2} y="100" textAnchor="middle" fill={C.text} fontSize="10.5" fontFamily="var(--cx-mono, monospace)">{t}</text>
          </g>
        );
        x += w + 16;
        return g;
      })}
    </svg>
  );
}

// ─── 3. Assets producidos (video/imagen/comparador) ───
export interface MediaVisualDef {
  kind: 'video' | 'image' | 'compare';
  src: string;
  /** Segunda imagen (comparador). */
  srcB?: string;
  poster?: string;
  alt: string;
  /** Etiqueta OBLIGATORIA si el visual se hizo con IA (regla de honestidad). */
  ai?: 'ia' | '3d+ia';
  labels?: [string, string];
}

export function MediaVisual({ v }: { v: MediaVisualDef }) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  const [split, setSplit] = useState(50);
  useEffect(() => {
    if (!ref.current || inView) return;
    const io = new IntersectionObserver((e) => { if (e.some((x) => x.isIntersecting)) { setInView(true); io.disconnect(); } }, { rootMargin: '300px' });
    io.observe(ref.current);
    return () => io.disconnect();
  }, [inView]);
  const tag = v.ai ? <span className="cx-ai-tag">{v.ai === 'ia' ? 'Generada con IA' : '3D + IA'}</span> : null;
  return (
    <div ref={ref} style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', background: 'var(--cx-tile)', aspectRatio: '16 / 9', marginBottom: 14 }}>
      <style>{`.cx-ai-tag{position:absolute;top:8px;left:8px;z-index:2;font:600 10.5px var(--cx-mono,monospace);letter-spacing:.08em;padding:3px 8px;border-radius:6px;background:rgba(0,0,0,.6);color:#fff}`}</style>
      {tag}
      {inView && v.kind === 'video' && <video src={v.src} poster={v.poster} autoPlay muted loop playsInline aria-label={v.alt} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
      {inView && v.kind === 'image' && <img src={v.src} alt={v.alt} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
      {inView && v.kind === 'compare' && v.srcB && (
        <>
          <img src={v.src} alt={v.labels?.[0] ?? v.alt} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
          <img src={v.srcB} alt={v.labels?.[1] ?? v.alt} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', clipPath: `inset(0 0 0 ${split}%)` }} />
          <input type="range" min={0} max={100} value={split} onChange={(e) => setSplit(Number(e.target.value))} aria-label="Comparar"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: 'ew-resize' }} />
          <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${split}%`, width: 2, background: 'var(--cx-accent)', pointerEvents: 'none' }} />
        </>
      )}
    </div>
  );
}
