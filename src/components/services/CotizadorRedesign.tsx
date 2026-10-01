/**
 * CotizadorRedesign.tsx — Rediseño completo Awwwards-level.
 * Solo servicios Web 3D. Full-width desktop. WebGL background.
 * Dos modos: guiado + catálogo. Mínimo texto, máximo impacto visual.
 */

import { NAME_ES_DISPLAY, SERVICE_ROOTS_EN } from '../../data/services/i18nMore';
import './cotizador-brand.css';
import { useState, useMemo, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { SERVICES } from '../../data/services/catalogCore';
import { getRateCard } from '../../data/services/formula';
import { computeQuoteContinuous, minContinuousPrice } from '../../data/services/continuousQuote';
import { CotizadorChat } from './chat/CotizadorChat';
import { LAUNCH_DISCOUNT } from '../../data/services/rateCard';
import { SERVICE_VARIABLES, derivarTier, recommendedValue } from '../../data/services/serviceVariables';
import type { ServiceVariable } from '../../data/services/serviceVariables';
import { BRAND } from '../../data/services/branding';
import { EN, CATALOG_EN, VARS_EN, EXTRA_LABELS_EN, EXTRA_NOTAS_EN } from '../../data/services/i18n';
import type { Lang } from '../../data/services/i18n';
import type { Currency } from '../../data/services/types';
import type { WizardPick, WizardQuotePlan } from '../../data/services/treeToQuote';
import { bundlePct, esquemaPago, RONDAS_NOTA } from '../../lib/services/quoteSummary';
import { encodeShare, decodeShare, quoteId } from '../../lib/services/share';
import type { ShareState } from '../../lib/services/share';
import { QuoteCta } from './QuoteCta';
import { GuidedWizard, WizardEditInline } from './GuidedWizard';
import { PriceBar } from './PriceDisplay';
import { planFromTreeAnswers } from '../../data/services/treeToQuote';
import { RefDropzone } from './RefDropzone';
import { SunIcon, MoonIcon, HomeIcon, GearIcon, ExternalIcon } from './icons';

/** Etiqueta/nota de un pick en el idioma activo (fallback: español). */
const pickLabel = (p: WizardPick, lang: Lang) => (lang === 'en' ? EXTRA_LABELS_EN[p.labelEs] ?? p.labelEs : p.labelEs);
const pickNota = (p: WizardPick, lang: Lang) => (lang === 'en' ? p.notaEs ? EXTRA_NOTAS_EN[p.notaEs] ?? p.notaEs : undefined : p.notaEs);

/** Icono del toggle de tema (sol en oscuro, luna en claro). */
function ThemeIcon({ dark }: { dark: boolean }) {
  return dark ? <SunIcon size={16} /> : <MoonIcon size={16} />;
}

/** Variables que el wizard YA pregunta (ocultas en el panel de configuración;
 *  se editan con el botón 'Editar detalles' → menú anterior con respuestas). */
const WIZARD_INFORMED: Record<string, string[]> = {
  'WEB-01': ['numHotspots'],
  'WEB-05': ['numSecciones'],
  'WEB-04': ['numVariantes', 'auth', 'fuenteDatos'],
};

type Val = number | string | boolean;
/** Ciclo 30: etiqueta EN de un servicio de las ramas generadas. */
const SERVICE_ROOTS_EN_LABEL = (id: string): string | undefined => Object.values(SERVICE_ROOTS_EN).map((r) => r.options[id]?.label).find(Boolean);
type Urgency = 'none' | '72h' | '24h';

/** Solo Web 3D — el enfoque del negocio. */
const WEB3D_IDS = [
  'RTA-04', 'RTA-05', 'WEB-01', 'WEB-02', 'WEB-03', 'WEB-04', 'WEB-05', 'WEB-06',
].filter(id => SERVICES.some(s => s.id === id));

const WEB3D = SERVICES.filter(s => WEB3D_IDS.includes(s.id));

/** Familias del catálogo con etiqueta humana (para los filtros). */
const FAMILY_LABELS: Record<string, string> = {
  'web-3d': 'Web 3D',
  'asset-rt': 'Assets Realtime',
  'render': 'Render 3D',
  'ia': 'IA',
  'vfx': 'VFX',
  'datos': 'CAD → Web',
  'texturas': 'Texturas',
  'pipeline': 'Pipeline',
  'soporte': 'Soporte',
};
const CATALOG_FAMILIES = Array.from(new Set(SERVICES.map(s => s.family)));

const fmt = (cur: Currency, v: number) =>
  new Intl.NumberFormat(cur === 'COP' ? 'es-CO' : 'en-US', { style: 'currency', currency: cur, maximumFractionDigits: 0 }).format(v);

// ═══════════════════════════════════════════════════════════════
// FONDO WEBGL — campo geométrico sutil que responde al mouse
// ═══════════════════════════════════════════════════════════════
function WebGLBackground({ dark = false }: { dark?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const mount = ref.current;
    if (!mount) return;
    const scene = new THREE.Scene();
    const cam = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
    cam.position.z = 8;
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setSize(window.innerWidth, window.innerHeight);
    mount.appendChild(renderer.domElement);

    // Grid de cubos flotantes — minimal, elegante
    const group = new THREE.Group();
    const geo = new THREE.BoxGeometry(0.18, 0.18, 0.18);
    const mat = new THREE.MeshBasicMaterial({ color: dark ? 0x2997ff : 0x0071e3, transparent: true, opacity: dark ? 0.10 : 0.06 });
    const nodes: THREE.Mesh[] = [];
    const N = 14;
    for (let x = 0; x < N; x++) for (let y = 0; y < N; y++) {
      if (Math.random() > 0.12) continue;
      const m = new THREE.Mesh(geo, mat);
      m.position.set((x - N / 2) * 0.8 + (Math.random() - 0.5) * 0.4, (y - N / 2) * 0.8 + (Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 2);
      group.add(m);
      nodes.push(m);
    }
    scene.add(group);

    let mx = 0, my = 0;
    const onMouse = (e: MouseEvent) => { mx = (e.clientX / window.innerWidth - 0.5) * 2; my = (e.clientY / window.innerHeight - 0.5) * 2; };
    window.addEventListener('mousemove', onMouse);

    let raf = 0;
    const loop = (t: number) => {
      group.rotation.y = mx * 0.08;
      group.rotation.x = my * 0.06;
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        n.rotation.x = t * 0.0002 + i;
        n.rotation.y = t * 0.00015 + i * 0.5;
        n.scale.setScalar(1 + Math.sin(t * 0.001 + i * 0.3) * 0.3);
      }
      renderer.render(scene, cam);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('mousemove', onMouse); renderer.dispose(); mount.replaceChildren(); };
  }, [dark]);
  return <div ref={ref} className="cx-webgl-bg" style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }} aria-hidden="true" />;
}

// ═══════════════════════════════════════════════════════════════
// CARD 3D INTERACTIVA — tilt al hover con WebGL lighting
// ═══════════════════════════════════════════════════════════════
function ServiceCard({ svc, currency, onPick, index, lang }: {
  svc: typeof SERVICES[0]; currency: Currency; onPick: () => void; index: number; lang: Lang;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const desde = useMemo(() => {
    // Mismo motor que el precio mostrado (continuousQuote), no el discreto.
    try { return minContinuousPrice(svc.id, currency); } catch { return null; }
  }, [svc, currency]);

  const onMove = (e: React.MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `perspective(600px) rotateY(${x * 6}deg) rotateX(${-y * 6}deg) translateY(-4px)`;
    el.style.setProperty('--glare-x', `${(x + 0.5) * 100}%`);
    el.style.setProperty('--glare-y', `${(y + 0.5) * 100}%`);
  };
  const onLeave = () => { const el = ref.current; if (el) el.style.transform = ''; };

  return (
    <button
      ref={ref}
      onClick={onPick}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className={`ds-anim ds-anim-${(index % 3) + 1}`}
      style={{
        position: 'relative', display: 'flex', flexDirection: 'column', gap: 6,
        padding: '22px 20px 18px', textAlign: 'left', font: 'inherit',
        background: 'var(--cx-card)', backdropFilter: 'blur(12px)',
        border: '1px solid var(--cx-border)', borderRadius: 20,
        cursor: 'pointer', overflow: 'hidden',
        transition: 'transform 0.3s cubic-bezier(0.25,0.8,0.4,1), box-shadow 0.3s',
        boxShadow: '0 2px 16px var(--cx-border)',
      }}
    >
      {/* Glare effect */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(circle at var(--glare-x,50%) var(--glare-y,50%), rgba(255,122,61,0.08) 0%, transparent 60%)',
        opacity: 0, transition: 'opacity 0.3s',
      }} className="card-glare" />
      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--cx-accent)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {lang === 'en' ? EN.families[svc.family] ?? svc.family : svc.family === 'web-3d' ? 'Web 3D' : svc.family}
      </span>
      <strong style={{ fontSize: 17, fontWeight: 700, color: 'var(--cx-text)', letterSpacing: '-0.01em', lineHeight: 1.3 }}>{lang === 'en' ? (CATALOG_EN[svc.id]?.name ?? svc.nameEs) : NAME_ES_DISPLAY[svc.id] ?? svc.nameEs}</strong>
      <span style={{ fontSize: 13, color: 'var(--cx-muted)', lineHeight: 1.4 }}>{lang === 'en' ? (CATALOG_EN[svc.id]?.unit ?? svc.unitEs) : svc.unitEs}</span>
      {desde != null && (
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--cx-text)', marginTop: 6 }}>
          {lang === 'es' ? 'desde' : EN.from} <strong style={{ fontSize: 18, color: 'var(--cx-accent)', letterSpacing: '-0.02em' }}>{fmt(currency, desde)}</strong>
        </span>
      )}
      <style>{`
        button:hover .card-glare { opacity: 1; }
      `}</style>
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════
// SLIDER LUXE — segmentos con relleno animado
// ═══════════════════════════════════════════════════════════════
function LuxeSlider({ v, value, onChange, lang, serviceId }: { v: ServiceVariable; value: number; onChange: (n: number) => void; lang: Lang; serviceId: string }) {
  const enVar = lang === 'en' ? VARS_EN[serviceId]?.[v.id] : undefined;
  const pct = v.max != null && v.min != null && v.max !== v.min ? ((value - v.min) / (v.max - v.min)) * 100 : 50;
  const applyFromClientX = (clientX: number, el: HTMLDivElement) => {
    const r = el.getBoundingClientRect();
    const p = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    const min = v.min ?? 0, max = v.max ?? 1;
    const step = v.step && v.step > 0 ? v.step : 1;
    onChange(Math.round((min + p * (max - min)) / step) * step);
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--cx-text)' }}>{enVar?.question ?? v.preguntaEs}</span>
        <strong style={{ fontSize: 22, fontWeight: 700, color: 'var(--cx-accent)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>
          {value}<span style={{ fontSize: 13, color: 'var(--cx-muted)', fontWeight: 400, marginLeft: 4 }}>{enVar?.unit ?? v.unidadEs}</span>
        </strong>
      </div>
      {(enVar?.help ?? v.ayudaEs) && (
        <div style={{ fontSize: 12.5, color: 'var(--cx-muted)', lineHeight: 1.45, marginTop: -2 }}>{enVar?.help ?? v.ayudaEs}</div>
      )}
      <div style={{ position: 'relative', height: 6, borderRadius: 3, background: 'var(--cx-soft)', cursor: 'pointer', touchAction: 'none' }}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          applyFromClientX(e.clientX, e.currentTarget);
        }}
        onPointerMove={(e) => {
          if (e.buttons !== 1) return;
          applyFromClientX(e.clientX, e.currentTarget);
        }}>
        <div style={{
          position: 'absolute', left: 0, top: 0, height: '100%', borderRadius: 3,
          width: `${pct}%`, background: 'linear-gradient(90deg, var(--cx-accent) 0%, #5ac8fa 100%)',
          transition: 'width 0.25s cubic-bezier(0.25,0.8,0.4,1)',
        }} />
        <div style={{
          position: 'absolute', top: -8, left: `calc(${pct}% - 11px)`, width: 22, height: 22,
          borderRadius: '50%', background: 'var(--cx-card-solid)', border: '0.5px solid var(--cx-border)',
          boxShadow: 'var(--cx-shadow-knob)', transition: 'left 0.25s cubic-bezier(0.25,0.8,0.4,1)',
        }} />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Control de UNA variable del panel de configuración (ciclo 6: extraído para
// poder agruparlas en un acordeón colapsable).
// ═══════════════════════════════════════════════════════════════
function VariableControl({ v, value, onValue, lang, serviceId }: {
  v: ServiceVariable; value: Val | undefined; onValue: (n: Val) => void; lang: Lang; serviceId: string;
}) {
  const val = value ?? (v.type === 'number' ? (v.min ?? 0) : undefined);
  return (
    <div>
      {v.type === 'number' && (
        <LuxeSlider v={v} value={typeof val === 'number' ? val : v.min ?? 0} lang={lang} serviceId={serviceId} onChange={onValue} />
      )}
      {v.type === 'select' && v.opciones && (
        <div>
          <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--cx-text)', display: 'block', marginBottom: 10 }}>{lang === 'en' ? VARS_EN[serviceId]?.[v.id]?.question ?? v.preguntaEs : v.preguntaEs}</span>
          {(lang === 'en' ? VARS_EN[serviceId]?.[v.id]?.help : undefined) ?? v.ayudaEs ? (
            <div style={{ fontSize: 12.5, color: 'var(--cx-muted)', lineHeight: 1.45, marginTop: -6, marginBottom: 8 }}>
              {(lang === 'en' ? VARS_EN[serviceId]?.[v.id]?.help : undefined) ?? v.ayudaEs}
            </div>
          ) : null}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {v.opciones.map((o: { valorEs: string }) => (
              <button key={o.valorEs} onClick={() => onValue(o.valorEs)}
                style={{
                  padding: '10px 18px', borderRadius: 999, font: `500 14px inherit`, cursor: 'pointer',
                  border: val === o.valorEs ? '2px solid var(--cx-accent)' : '1px solid var(--cx-border-strong)',
                  background: val === o.valorEs ? 'var(--cx-accent-soft)' : 'var(--cx-card-solid)', color: 'var(--cx-text)',
                }}>{(lang === 'en' ? VARS_EN[serviceId]?.[v.id]?.opciones?.[o.valorEs] : undefined) ?? o.valorEs}</button>
            ))}
          </div>
        </div>
      )}
      {v.type === 'toggle' && (
        <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
          <button
            type="button"
            role="switch"
            aria-checked={Boolean(val)}
            onClick={() => onValue(!val)}
            style={{ width: 44, height: 26, borderRadius: 13, background: val ? '#30d158' : 'var(--cx-border-strong)', position: 'relative', transition: 'background 0.25s', flexShrink: 0, border: 'none', padding: 0, cursor: 'pointer' }}>
            <span style={{ position: 'absolute', top: 2, left: val ? 20 : 2, width: 22, height: 22, borderRadius: '50%', background: 'var(--cx-card-solid)', boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transition: 'left 0.25s cubic-bezier(0.3,0.9,0.4,1)', display: 'block' }} />
          </button>
          <span style={{ fontSize: 15, color: 'var(--cx-text)' }}>{lang === 'en' ? VARS_EN[serviceId]?.[v.id]?.question ?? v.preguntaEs : v.preguntaEs}</span>
        </label>
      )}
      {v.type === 'toggle' && ((lang === 'en' ? VARS_EN[serviceId]?.[v.id]?.help : undefined) ?? v.ayudaEs) && (
        <div style={{ fontSize: 12.5, color: 'var(--cx-muted)', lineHeight: 1.45, marginTop: 4, marginLeft: 56 }}>
          {(lang === 'en' ? VARS_EN[serviceId]?.[v.id]?.help : undefined) ?? v.ayudaEs}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN — Rediseño completo
// ═══════════════════════════════════════════════════════════════
export function CotizadorRedesign() {
  const [lang, setLang] = useState<Lang>('es');
  /** Ciclo 15: idioma persistido (cx-lang) con deteccion inicial de navigator.
   *  El estado nace en 'es' (SSR-safe); el ajuste ocurre post-hidratacion. */
  useEffect(() => {
    try {
      const guardado = localStorage.getItem('cx-lang');
      const inicial = guardado === 'en' || guardado === 'es'
        ? guardado
        : (navigator.language && navigator.language.toLowerCase().startsWith('en') ? 'en' : 'es');
      if (inicial !== 'es') setLang(inicial);
    } catch { /* sin almacenamiento */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    try { localStorage.setItem('cx-lang', lang); } catch { /* sin almacenamiento */ }
  }, [lang]);
  /** Moneda independiente del idioma (ciclo 8): por defecto ES + COP. */
  const [currency, setCurrency] = useState<Currency>('COP');
  const [serviceId, setServiceId] = useState('');
  const [vals, setVals] = useState<Record<string, Val>>({});
  const [unsure, setUnsure] = useState<Record<string, boolean>>({});
  const [firstClient, setFirstClient] = useState(true);
  const [urgency, setUrgency] = useState<Urgency>('none');
  const [quantity, setQuantity] = useState(1);
  const [adjuntos, setAdjuntos] = useState<string[]>([]);
  const [mode, setMode] = useState<'guided' | 'catalog'>('guided');
  // ciclo 26: refs para leer el estado actual dentro de listeners registrados una sola vez
  const serviceIdRef = useRef(serviceId); serviceIdRef.current = serviceId;
  const modeRef = useRef(mode); modeRef.current = mode;
  /** Complementos del plan del wizard (ej: el modelo 3D cuando hay que crearlo). */
  const [extras, setExtras] = useState<WizardPick[]>([]);
  /** Filtro activo del catálogo ('todas' = sin filtrar). */
  const [familyFilter, setFamilyFilter] = useState<string>('todas');
  /** Tema claro/oscuro (persistido; respeta prefers-color-scheme la primera vez).
   *  Ciclo 12: el estado arranca SIEMPRE en 'light' — exactamente lo que SSR
   *  renderizó (data-theme + icono luna) — para que la hidratación coincida en
   *  modo dark (antes: el lazy init leía el attr del <html> ANTES del primer
   *  render, el árbol cliente difería del server y React regeneraba todo con
   *  un pageerror "Hydration failed"). El tema real pre-pintado por el script
   *  inline de cotizador.astro se ADOPTA en el efecto de sync de abajo;
   *  visualmente no hay flash porque el CSS blindado del ciclo 10b
   *  (html[data-cx-theme] vars a nivel documento) pinta dark desde el primer
   *  frame, antes de que la isla hidrate. */
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const themeAdopted = useRef(false);
  /** true si se llegó por el wizard (historial con draft) → muestra 'Editar detalles'. */
  const [canEditDetails, setCanEditDetails] = useState(false);
  useEffect(() => {
    const st = window.history.state;
    setCanEditDetails(!!(st && st.cx === 'cotizador' && st.draft));
  }, [serviceId]);

  useEffect(() => {
    // Primera corrida: ADOPTA el atributo pre-pintado por cotizador.astro para
    // que el estado JS alcance al <html> (icono sol/luna, fondo WebGL). Si ya
    // coincide, cae al sync de abajo sin escribir nada.
    if (!themeAdopted.current) {
      themeAdopted.current = true;
      try {
        const attr = document.documentElement.dataset.cxTheme;
        if ((attr === 'dark' || attr === 'light') && attr !== theme) {
          setTheme(attr); // re-render; la siguiente corrida sincroniza todo
          return;
        }
      } catch { /* sin DOM */ }
    }
    // Sincroniza el atributo del <html> con el estado del toggle: sin esto,
    // html[data-cx-theme] queda desfasado y el CSS blindado del ciclo 10b
    // (html[data-cx-theme='dark'] .cx-root) pisa el tema elegido por el usuario.
    try {
      document.documentElement.dataset.cxTheme = theme;
      localStorage.setItem('cx-theme', theme);
    } catch { /* almacenamiento no disponible */ }
    document.body.style.background = theme === 'dark' ? '#0b0b0f' : '#fbfbfd';
  }, [theme]);

  // ── Historial (ciclo 6): restaura config ↔ wizard al navegar atrás/adelante ──
  useEffect(() => {
    const onPop = () => {
      const st = window.history.state;
      if (!st || st.cx !== 'cotizador') return; // página base / navegación externa
      if (st.config !== undefined) {
        const plan = st.plan as WizardQuotePlan | undefined;
        if (plan && plan.picks?.[0]) {
          setServiceId(plan.picks[0].serviceId);
          setVals(plan.picks[0].vals);
          setExtras(plan.picks.slice(1));
        } else {
          setServiceId(st.config as string); setVals({}); setExtras([]);
        }
      } else {
        setServiceId(''); setExtras([]);
      }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // ── Ciclo 11: ENLACE COMPARTIDO CON ESTADO. Al abrir la página con params
  // (?svc=&cur=&fc=&urg=&qty=&v=), decodeShare restaura la cotización EXACTA:
  // mismo servicio, valores, moneda, urgencia, descuento y cantidad. Los extras
  // del wizard no viajan en la URL (encodeShare no los codifica) — se documenta. ──
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const st = decodeShare(window.location.search);
    if (!st) return;
    setCurrency(st.currency);
    setFirstClient(st.firstClient);
    setUrgency(st.urgency);
    setQuantity(st.quantity);
    setServiceId(st.serviceId);
    setVals(st.vals);
    setExtras([]);
  }, []);

  // ciclo 26: "Abrir en el cotizador" (asistente). Si el wizard NO está montado (vista de
  // configuración o catálogo), se deja el destino en history.state y se vuelve al modo
  // guiado: el wizard se hidrata desde ahí al montarse. Si ya está montado, él lo maneja.
  useEffect(() => {
    const onOpen = (e: Event) => {
      const t = (e as CustomEvent).detail as { kind: string; rootChoice?: string; subChoice?: string; answers?: Record<string, Val>; serviceId?: string; vals?: Record<string, Val> };
      if (!t) return;
      if (t.kind === 'config' && t.serviceId) {
        setMode('guided'); setServiceId(t.serviceId); setVals(t.vals ?? {}); setExtras([]);
        window.history.pushState({ cx: 'cotizador', config: t.serviceId }, '');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      if (t.kind === 'wizard' && (serviceIdRef.current || modeRef.current !== 'guided')) {
        window.history.pushState({ cx: 'cotizador', level: t.subChoice ? 3 : 2, rootChoice: t.rootChoice, subChoice: t.subChoice, answers: t.answers ?? {} }, '');
        setServiceId(''); setExtras([]); setMode('guided');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    };
    window.addEventListener('cx-open-quote', onOpen);
    return () => window.removeEventListener('cx-open-quote', onOpen);
  }, []);

  // ciclo 27: nivel del wizard (lo emite GuidedWizard) para el botón Atrás global
  const [wizardLevel, setWizardLevel] = useState(1);
  useEffect(() => {
    const on = (e: Event) => setWizardLevel(Number((e as CustomEvent).detail?.level ?? 1));
    window.addEventListener('cx-wizard-level', on);
    return () => window.removeEventListener('cx-wizard-level', on);
  }, []);
  const canGoBack = !!serviceId || mode === 'catalog' || wizardLevel > 1;
  const navBack = () => {
    if (serviceId) {
      const st = window.history.state;
      if (st && st.cx === 'cotizador' && st.config !== undefined && window.history.length > 1) window.history.back();
      else { setServiceId(''); setExtras([]); }
      return;
    }
    if (mode === 'catalog') { setMode('guided'); return; }
    window.dispatchEvent(new CustomEvent('cx-wizard-back'));
  };

  /** #15: home real — resetea también al wizard montado (vía homeKey). */
  const [homeKey, setHomeKey] = useState(0);
  const [wizardDraft, setWizardDraft] = useState<{ rootChoice: string; subChoice: string; answers: Record<string, string | number | boolean> } | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const goHome = () => {
    setMode('guided'); setServiceId(''); setVals({}); setExtras([]);
    setUnsure({}); setFirstClient(true); setUrgency('none');
    setWizardDraft(null); setEditOpen(false);
    setHomeKey(k => k + 1);
    if (typeof window !== 'undefined') window.history.pushState({ cx: 'cotizador', level: 1 }, '');
  };

  // ciclo 25: cualquier servicio del catálogo (antes solo los 8 de WEB3D → las ramas nuevas no abrían su cotización)
  const svc = SERVICES.find(s => s.id === serviceId);
  // ocultarEnConfig (ciclo 8/WEB-04): la variable existe y su valor viene del
  // wizard vía planWebApp, pero no se muestra en el panel por redundante.
  const variables: ServiceVariable[] = serviceId
    ? (SERVICE_VARIABLES[serviceId]?.variables ?? [])
      .filter(v => !v.ocultarEnConfig)
      .filter(v => !(WIZARD_INFORMED[serviceId] ?? []).includes(v.id)) // ya se preguntó en el wizard (#6)
    : [];
  const tier = useMemo(() => serviceId ? derivarTier(serviceId, vals) : null, [serviceId, vals]);
  // D1 ciclo 2.1: urgencia alineada a docs (+30/+50); descuento lanzamiento −25% se conserva.
  const urgencyPct = urgency === '72h' ? 30 : urgency === '24h' ? 50 : 0;
  const quoteOpts = useMemo(() => ({
    firstClientLaunch: firstClient, batchUnits: quantity > 1 ? quantity : undefined, urgencyPct,
  }), [firstClient, quantity, urgencyPct]);
  const quote = useMemo(() => {
    if (!svc || !tier) return null;
    // ciclo 21: motor continuo — cada variable mueve el precio (DESPACHO-11 LAB-C1)
    try { return computeQuoteContinuous(svc.id, vals, currency, quoteOpts); } catch { return null; }
  }, [svc, tier, vals, currency, quoteOpts]);

  /** Aplica el plan del wizard: principal en configuración, resto como líneas extra. */
  /** Ciclo 17 — visor del precio: plan EN VIVO del wizard (antes de aplicar)
   *  derivado con el mismo motor y mismo math de bundle que totalProyecto. */
  const [livePlan, setLivePlan] = useState<WizardQuotePlan | null>(null);
  const liveQuote = useMemo(() => {
    if (!livePlan) return null;
    const principal = livePlan.picks[0];
    if (!principal) return null;
    try {
      const q = computeQuoteContinuous(principal.serviceId, principal.vals, currency, quoteOpts);
      if (!q) return null;
      const extrasQ = livePlan.picks.slice(1).map(p2 => {
        return computeQuoteContinuous(p2.serviceId, p2.vals, currency, quoteOpts);
      }).filter((x): x is NonNullable<typeof x> => x !== null);
      const rawMin = q.totalMin + extrasQ.reduce((a, e) => a + e.totalMin, 0);
      const rawMax = q.totalMax + extrasQ.reduce((a, e) => a + e.totalMax, 0);
      const n = 1 + extrasQ.length;
      const bundleLive = bundlePct(n, 0); // urgencia aùn sin preguntar en el wizard
      if (bundleLive === 0) return { min: rawMin, max: rawMax };
      const card = getRateCard(currency);
      const step = card.roundStep(rawMin);
      const factor = 1 - bundleLive / 100;
      return { min: Math.max(Math.floor((rawMin * factor) / step) * step, card.minProject), max: Math.ceil((rawMax * factor) / step) * step };
    } catch { return null; }
  }, [livePlan, currency, quoteOpts]);

  const applyPlan = (plan: WizardQuotePlan, answers?: Record<string, string | number | boolean>) => {
    const principal = plan.picks[0];
    if (!principal) return;
    setServiceId(principal.serviceId);
    setVals(principal.vals);
    setExtras(plan.picks.slice(1));
    setWizardDraft({ rootChoice: plan.rootChoice, subChoice: plan.subChoice, answers: answers ?? {} });
    setCanEditDetails(true);
  };

  /** Cotización de cada complemento del wizard. */
  const extraQuotes = useMemo(() => extras.map(p => {
    try {
      const t = derivarTier(p.serviceId, p.vals);
      const q = computeQuoteContinuous(p.serviceId, p.vals, currency, quoteOpts);
      return q ? { pick: p, tier: t, quote: q } : null;
    } catch { return null; }
  }).filter((x): x is NonNullable<typeof x> => x !== null), [extras, currency, quoteOpts]);

  // D2 ciclo 2.1: bundle por agrupar servicios (no acumula con urgencia).
  const numServicios = 1 + extraQuotes.length;
  const bundle = bundlePct(numServicios, urgencyPct);

  const totalProyecto = extraQuotes.length > 0 && quote
    ? (() => {
      const rawMin = quote.totalMin + extraQuotes.reduce((a, e) => a + e.quote.totalMin, 0);
      const rawMax = quote.totalMax + extraQuotes.reduce((a, e) => a + e.quote.totalMax, 0);
      if (bundle === 0) return { min: rawMin, max: rawMax };
      const card = getRateCard(currency);
      const step = card.roundStep(rawMin);
      const factor = 1 - bundle / 100;
      return { min: Math.max(Math.floor((rawMin * factor) / step) * step, card.minProject), max: Math.ceil((rawMax * factor) / step) * step };
    })()
    : null;

  // D5 ciclo 2.1: esquema de pago sugerido según el total (piso del rango).
  const pagoSugerido = quote ? esquemaPago(totalProyecto ? totalProyecto.min : quote.totalMin, currency) : null;

  // ── Ciclo 11: estado compartible + ID corto + URL pública con estado.
  // La URL de compartición SIEMPRE apunta a BRAND.quoteUrl (nunca a
  // window.location, para no filtrar el dominio del dev). ──
  const shareState: ShareState = useMemo(
    () => ({ serviceId, vals, currency, firstClient, urgency, quantity }),
    [serviceId, vals, currency, firstClient, urgency, quantity],
  );
  const qId = useMemo(() => (svc ? quoteId(shareState) : ''), [svc, shareState]);
  const shareUrl = useMemo(
    () => (svc ? `${BRAND.quoteUrl}?${encodeShare(shareState)}` : BRAND.quoteUrl),
    [svc, shareState],
  );

  // Ciclo 10 — regla de entrega con extras (extraída del aside para
  // reusarla en el desglose): lo MÁS CONSERVADOR de cada extremo —
  // min = el mayor de los mínimos, max = el mayor de los máximos.
  const entregaDias = useMemo<[number, number] | null>(() => {
    const rangos = [
      svc?.entregaDiasEs,
      ...extraQuotes.map(e => SERVICES.find(s => s.id === e.pick.serviceId)?.entregaDiasEs),
    ].filter((r): r is [number, number] => Array.isArray(r));
    if (!rangos.length) return null;
    return extraQuotes.length === 0
      ? rangos[0]
      : [Math.max(...rangos.map(r => r[0])), Math.max(...rangos.map(r => r[1]))];
  }, [svc, extraQuotes]);

  // Ciclo 11: respuestas clave del wizard (nivel de detalle, piezas, acabados)
  // para la línea "Config: ..." del desglose — solo si existen.
  const cfgBits = useMemo(() => {
    const a = wizardDraft?.answers;
    if (!a) return [] as string[];
    const es = lang === 'es';
    const b: string[] = [];
    if (a['nivel-detalle'] !== undefined) b.push(`${es ? 'nivel de detalle' : 'detail level'}: ${a['nivel-detalle']}`);
    if (a['cantidad-piezas'] !== undefined) b.push(`${es ? 'piezas' : 'parts'}: ${a['cantidad-piezas']}`);
    if (a['materiales-acabado'] !== undefined) b.push(`${es ? 'acabado' : 'finish'}: ${a['materiales-acabado']}`);
    return b;
  }, [wizardDraft, lang]);

  const svcName = svc ? (lang === 'en' ? CATALOG_EN[svc.id]?.name ?? svc.nameEs : NAME_ES_DISPLAY[svc.id] ?? svc.nameEs) : '';
  // ── Ciclo 11: DESGLOSE EXACTO para el deep link de WhatsApp (y email) —
  // encabezado con id, una línea por servicio (nombre, código, nivel, rango
  // COP/USD), total proyecto con bundle, pago sugerido, entrega conservadora,
  // config del wizard, enlace con estado y disclaimer. Máx ~15 líneas. ──
  const summary = useMemo(() => {
    if (!svc || !quote) return '';
    const es = lang === 'es';
    const lines: string[] = [`Cotización ${qId} — ${BRAND.name}`];
    lines.push(`${svcName} (${svc.id}) · nivel ${tier} · ${fmt(currency, quote.totalMin)}–${fmt(currency, quote.totalMax)} ${currency}`);
    for (const e of extraQuotes) {
      lines.push(`${pickLabel(e.pick, lang)} — ${e.quote.serviceName} (${e.pick.serviceId}) · nivel ${e.tier} · ${fmt(currency, e.quote.totalMin)}–${fmt(currency, e.quote.totalMax)} ${currency}`);
    }
    if (totalProyecto) {
      lines.push(`${es ? 'Total proyecto' : EN.totalProject}${bundle ? ` (−${bundle}% bundle)` : ''}: ${fmt(currency, totalProyecto.min)}–${fmt(currency, totalProyecto.max)} ${currency}`);
    } else {
      // servicio único: el total del proyecto ES el rango del principal —
      // la línea va siempre para que el deep link tenga cierre de total
      lines.push(`${es ? 'Total proyecto' : EN.totalProject}: ${fmt(currency, quote.totalMin)}–${fmt(currency, quote.totalMax)} ${currency}`);
    }
    if (pagoSugerido) lines.push(`${es ? 'Pago sugerido' : 'Suggested payment'}: ${es ? pagoSugerido : EN.pago[pagoSugerido] ?? pagoSugerido}`);
    if (entregaDias) lines.push(`${es ? 'Entrega' : EN.delivery}: ${entregaDias[0]}–${entregaDias[1]} ${es ? 'días hábiles' : 'business days'}`);
    if (cfgBits.length) lines.push(`Config: ${cfgBits.join(' · ')}`);
    lines.push(shareUrl);
    lines.push(es ? '(Rango orientativo, no cotización formal.)' : '(Indicative range, not a formal quote.)');
    return lines.join('\n');
  }, [svc, quote, lang, qId, svcName, tier, currency, extraQuotes, totalProyecto, bundle, pagoSugerido, entregaDias, cfgBits, shareUrl]);

  return (
    <div className="cx-root" data-theme={theme} style={{ minHeight: '100vh', background: 'var(--cx-bg)', position: 'relative' }}>
      {/* ciclo 24: fondo WebGL de cubos retirado del montaje (canvas a pantalla completa
          renderizando oculto); el fondo es la retícula CSS de cotizador-brand.css. */}
      {/* ciclo 27: en móvil la barra no es fija → Atrás flotante (simétrico al botón del chat) */}
      {canGoBack && <button type="button" onClick={navBack} className="cx-navback-float" data-noprint aria-label={lang === 'es' ? 'Atrás' : 'Back'}>←</button>}
      {/* ciclo 24: asistente con cotización real, montado en toda la página (antes solo en DirectCotizador, que no se usa) */}
      <CotizadorChat
        section={svc ? 'variables' : livePlan?.picks[0] ? 'variables' : 'inicio'}
        serviceName={svc ? (lang === 'en' ? CATALOG_EN[svc.id]?.name ?? svc.nameEs : NAME_ES_DISPLAY[svc.id] ?? svc.nameEs) : livePlan?.picks[0] ? (lang === 'en' ? EXTRA_LABELS_EN[livePlan.picks[0].labelEs] ?? SERVICE_ROOTS_EN_LABEL(livePlan.picks[0].serviceId) ?? livePlan.picks[0].labelEs : livePlan.picks[0].labelEs) : undefined}
        serviceId={svc ? svc.id : livePlan?.picks[0]?.serviceId}
        vals={svc ? vals : livePlan?.picks[0]?.vals}
        currency={currency}
        lang={lang}
        totalRange={quote ? `${quote.totalMin}–${quote.totalMax} ${currency}` : undefined}
        contactEmail={BRAND.contactEmail}
      />
      <style>{`
        .cx-root {
          --cx-bg: #f4f6f9;
          --cx-card: rgba(255,255,255,0.86);
          --cx-card-solid: #ffffff;
          --cx-tile: #eaeef3;
          --cx-text: #0e1726;
          --cx-muted: #556070;
          --cx-faint: #8792a2;
          --cx-border: rgba(14,23,38,0.09);
          --cx-border-strong: rgba(14,23,38,0.17);
          --cx-soft: rgba(14,23,38,0.06);
          --cx-accent: #c4400d;
          --cx-accent-hover: #a3350a;
          --cx-accent-soft: rgba(196,64,13,0.09);
          --cx-accent-border: rgba(196,64,13,0.30);
          --cx-shadow-card: 0 1px 2px rgba(14,23,38,0.05), 0 10px 28px -14px rgba(14,23,38,0.14);
          --cx-shadow-hover: 0 2px 4px rgba(14,23,38,0.05), 0 20px 44px -20px rgba(196,64,13,0.38);
          --cx-shadow-knob: 0 2px 8px rgba(14,23,38,0.18);
          --cx-obj-shadow: rgba(14,23,38,0.16);
          --cx-on-accent: #ffffff;
          --cx-accent-2: #f59e0b;
          --cx-glow: rgba(196,64,13,0.09);
          --cx-glow-2: rgba(3,105,161,0.07);
          --cx-grid: rgba(14,23,38,0.045); --cx-signal: #0369a1; --cx-signal-soft: rgba(3,105,161,0.08);
        
        }
        /* Blindaje ciclo 10b: las variables oscuras aplican si html ya sabe el
           tema (script inline) aunque el data-theme del div llegue tarde. */
        html[data-cx-theme='dark'] .cx-root, .cx-root[data-theme='dark'] {
          --cx-bg: #0a0b0d;
          --cx-card: rgba(20,22,26,0.78);
          --cx-card-solid: #14161a;
          --cx-tile: #1c1f24;
          --cx-text: #f2f3f5;
          --cx-muted: #9aa1ab;
          --cx-faint: #6c737e;
          --cx-border: rgba(242,243,245,0.08);
          --cx-border-strong: rgba(242,243,245,0.16);
          --cx-soft: rgba(242,243,245,0.08);
          --cx-accent: #ff7a3d;
          --cx-accent-hover: #ff9566;
          --cx-accent-soft: rgba(255,122,61,0.12);
          --cx-accent-border: rgba(255,122,61,0.38);
          --cx-shadow-card: 0 1px 0 rgba(242,243,245,0.03) inset, 0 12px 32px -16px rgba(0,0,0,0.8);
          --cx-shadow-hover: 0 1px 0 rgba(242,243,245,0.05) inset, 0 24px 48px -22px rgba(255,122,61,0.30);
          --cx-shadow-knob: 0 2px 8px rgba(0,0,0,0.6);
          --cx-obj-shadow: rgba(0,0,0,0.7);
          --cx-on-accent: #1a0a02;
          --cx-accent-2: #ffb547;
          --cx-glow: rgba(255,122,61,0.11);
          --cx-glow-2: rgba(103,212,255,0.06);
          --cx-grid: rgba(242,243,245,0.04); --cx-signal: #67d4ff; --cx-signal-soft: rgba(103,212,255,0.10);
        
        }
        * { box-sizing: border-box; }
        body { margin: 0; font-family: 'Inter', -apple-system, 'Segoe UI', system-ui, sans-serif; }
        @media (max-width: 768px) { .cx-desktop-only { display: none !important; } }
        /* ciclo 10 — el aside sticky scrollea DENTRO del viewport: sin max-height
           el final del panel (CTA imprimir/PDF) quedaba fuera de pantalla. */
        .cx-config-aside {
          max-height: calc(100vh - 48px);
          overflow-y: auto;
          scrollbar-width: thin;
          scrollbar-color: var(--cx-border-strong) transparent;
          overscroll-behavior: contain;
        }
        .cx-config-aside::-webkit-scrollbar { width: 6px; }
        .cx-config-aside::-webkit-scrollbar-track { background: transparent; }
        .cx-config-aside::-webkit-scrollbar-thumb { background: var(--cx-border-strong); border-radius: 3px; }
        @media (max-width: 768px) {
          .cx-config { display: flex !important; flex-direction: column; }
          .cx-config-aside { position: static !important; width: 100% !important; max-height: none !important; overflow: visible !important; }
          /* ciclo 12 — NAV móvil: los switches envuelven en vez de desbordar
             (scrollWidth <= innerWidth) y todo botón del nav alcanza 40px de
             alto táctil (antes: 17-32px). El !important solo vence al inline. */
          .cx-nav { flex-wrap: wrap; row-gap: 8px !important; padding: 14px 16px !important; }
          .cx-nav-right { flex-wrap: wrap; justify-content: flex-end; row-gap: 6px !important; }
          .cx-nav button { min-height: 40px; min-width: 40px; }
          .cx-nav-right button { min-height: 40px; }
          /* back-links ("← Atrás", "← Cambiar servicio") con área táctil 40px */
          .cx-back { min-height: 40px; }
          /* chips de filtro del catálogo: 35px -> 40px de alto táctil */
          .cx-chip { min-height: 40px; }
          /* enlaces secundarios y botón fantasma: >=40px de alto táctil */
          .cx-protolink { min-height: 40px; }
          .cx-softbtn { min-height: 40px; }
        }
        /* ciclo 12 — pantallas táctiles en layout desktop (teléfono landscape,
           tablet): el nav mantiene el mínimo táctil de 40px; el mouse de
           escritorio no se ve afectado (pointer: fine). */
        @media (pointer: coarse) {
          .cx-nav button { min-height: 40px; min-width: 40px; }
        }
        /* ciclo 12 — más aire lateral en móviles estrechos (360px): menos
           padding del contenedor de contenido, sin tocar desktop. */
        @media (max-width: 640px) {
          .cx-content { padding: 0 16px; }
        }
        @media (min-width: 769px) { .cx-grid { grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)) !important; max-width: 1200px !important; } }
        /* ciclo 11 — PRINT/PDF limpio: documento 1-2 páginas con fondo blanco,
           tipografía negra, panel de cotización a ancho completo y cabecera
           propia (id + fecha + enlace con estado). Se oculta nav, fondo WebGL,
           wizard, CTA y todo [data-noprint]. */
        @media print {
          [data-noprint] { display: none !important; }
          body { background: #fff !important; }
          .cx-webgl-bg { display: none !important; }
          .cx-root { background: #fff !important; --cx-text: #000; --cx-muted: #555; --cx-faint: #777; --cx-card: #fff; --cx-card-solid: #fff; --cx-tile: #f5f5f7; --cx-accent: #0071e3; }
          .cx-root * { text-shadow: none !important; box-shadow: none !important; }
          .cx-content { max-width: 100% !important; padding: 0 !important; }
          .cx-config { display: block !important; }
          .cx-config-aside {
            position: static !important; width: 100% !important;
            max-height: none !important; overflow: visible !important;
            border: none !important; padding: 0 !important;
          }
          .cx-print-header { display: flex !important; flex-direction: column; gap: 2px; margin: 0 0 14px; font-size: 13px; color: #000; }
          .cx-print-header strong { font-size: 16px; }
          .cx-prototype-link { color: #000 !important; }
        }
        .cx-content { position: relative; z-index: 1; max-width: 1280px; margin: 0 auto; padding: 0 24px; }
        @media (min-width: 1440px) { .cx-content { max-width: 1400px; } }
      `}</style>

      {/* NAV minimal — ciclo 12: clases cx-nav/cx-nav-right para que en móvil
          los switches envuelvan a una segunda línea en vez de desbordar el
          viewport (425px de grupo no caben en 360-430px). */}
      <nav data-noprint className="cx-nav" style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '20px 32px', position: 'relative', zIndex: 2,
        borderBottom: '1px solid var(--cx-border)',
      }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {/* ciclo 27: Atrás SIEMPRE visible en la barra superior (deshabilitado en el inicio) */}
          <button onClick={navBack} disabled={!canGoBack} className="cx-navback" aria-label={lang === 'es' ? 'Atrás' : 'Back'} title={lang === 'es' ? 'Atrás' : 'Back'}>←</button>
          <button onClick={goHome} aria-label={lang === 'es' ? 'Inicio' : 'Home'} title={lang === 'es' ? 'Inicio' : 'Home'}
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: '50%', background: 'var(--cx-tile)', border: 'none', cursor: 'pointer', color: 'var(--cx-text)' }}>
            <HomeIcon size={16} />
          </button>
          <button onClick={goHome}
            style={{ fontSize: 16, fontWeight: 700, color: 'var(--cx-text)', letterSpacing: '-0.02em', background: 'none', border: 'none', cursor: 'pointer', padding: 0, font: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <span className="cx-brand-mark" aria-hidden="true" />{BRAND.name}
          </button>
        </div>
        <div className="cx-nav-right" style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <button onClick={() => { setMode('guided'); setServiceId(''); }}
            style={{ font: '600 14px inherit', color: mode === 'guided' ? 'var(--cx-accent)' : 'var(--cx-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>
            {lang === 'es' ? 'Cotizar' : EN.navQuote}
          </button>
          <button onClick={() => setMode('catalog')}
            style={{ font: '600 14px inherit', color: mode === 'catalog' ? 'var(--cx-accent)' : 'var(--cx-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>
            {lang === 'es' ? 'Catálogo' : EN.navCatalog}
          </button>
          {/* Tema claro/oscuro */}
          <button onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')} aria-label={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: '50%', background: 'var(--cx-tile)', border: 'none', cursor: 'pointer', color: 'var(--cx-text)' }}>
            <ThemeIcon dark={theme === 'dark'} />
          </button>
          {/* Idioma */}
          <div style={{ display: 'inline-flex', borderRadius: 999, overflow: 'hidden', border: '1px solid var(--cx-border-strong)' }}>
            {(['es', 'en'] as Lang[]).map(l => (
              <button key={l} onClick={() => setLang(l)}
                style={{
                  padding: '6px 14px', font: `600 13px inherit`, border: 'none', cursor: 'pointer',
                  background: lang === l ? 'var(--cx-accent)' : 'transparent',
                  color: lang === l ? 'var(--cx-on-accent)' : 'var(--cx-muted)',
                }}>{l.toUpperCase()}</button>
            ))}
          </div>
          {/* Moneda */}
          <div style={{ display: 'inline-flex', borderRadius: 999, overflow: 'hidden', border: '1px solid var(--cx-border-strong)' }}>
            {(['COP', 'USD'] as Currency[]).map(c => (
              <button key={c} onClick={() => setCurrency(c)}
                aria-pressed={currency === c}
                // ciclo 23: COP y USD son MERCADOS distintos (contrato nacional vs internacional), no una conversión
                title={c === 'COP'
                  ? (lang === 'en' ? 'Domestic contract (Colombia) — Colombian market rates' : 'Contrato nacional (Colombia) — tarifas del mercado colombiano')
                  : (lang === 'en' ? 'International contract — international market rates' : 'Contrato internacional — tarifas del mercado internacional')}
                style={{
                  padding: '6px 14px', font: `600 13px inherit`, border: 'none', cursor: 'pointer',
                  background: currency === c ? 'var(--cx-accent)' : 'transparent',
                  color: currency === c ? 'var(--cx-on-accent)' : 'var(--cx-muted)',
                }}>{c}<span className="cx-desktop-only" style={{ fontWeight: 500, opacity: 0.75 }}>{c === 'COP' ? (lang === 'en' ? ' · Colombia' : ' · Nacional') : (lang === 'en' ? ' · Intl' : ' · Internacional')}</span></button>
            ))}
          </div>
        </div>
      </nav>

      <div className="cx-content">
        {/* ═══ MODO GUIADO ═══ */}
        {mode === 'guided' && !svc && <GuidedWizard onComplete={applyPlan} onProgress={setLivePlan} lang={lang} homeSignal={homeKey} />}

        {/* ═══ CICLO 17 — VISOR DEL PRECIO (sticky, solo modo guiado) ═══ */}
        {mode === 'guided' && !svc && liveQuote && (
          <PriceBar min={liveQuote.min} max={liveQuote.max} currency={currency} lang={lang} />
        )}

        {/* ═══ CONFIGURACIÓN (modo guiado, con servicio) ═══ */}
        {mode === 'guided' && svc && (
          <section style={{ paddingTop: 40, paddingBottom: 60, display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(280px,380px)', gap: 32, alignItems: 'start' }} className="cx-config">
            {/* Panel izquierdo: configuración */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <button onClick={() => { if (typeof window !== 'undefined') window.history.back(); }} data-noprint className="cx-back"
                style={{ alignSelf: 'flex-start', font: '600 14px inherit', color: 'var(--cx-accent)', background: 'none', border: 'none', cursor: 'pointer', marginBottom: 8 }}>
                {lang === 'es' ? '← Cambiar servicio' : EN.changeService}
              </button>
              <h2 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--cx-text)', margin: 0 }}>{lang === 'en' ? (CATALOG_EN[svc.id]?.name ?? svc.nameEs) : NAME_ES_DISPLAY[svc.id] ?? svc.nameEs}</h2>

              {/* #6: 'Editar detalles' despliega el menú anterior (wizard) con
                  todas las configuraciones hechas y las respuestas conservadas */}
              {canEditDetails && wizardDraft && (
                editOpen ? (
                  <WizardEditInline
                    rootChoice={wizardDraft.rootChoice}
                    subChoice={wizardDraft.subChoice}
                    initialAnswers={wizardDraft.answers}
                    lang={lang}
                    onApply={(answers) => {
                      const plan = planFromTreeAnswers(wizardDraft.rootChoice, wizardDraft.subChoice, answers);
                      applyPlan(plan, answers);
                    }}
                    onClose={() => setEditOpen(false)}
                  />
                ) : (
                <button
                  onClick={() => setEditOpen(true)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8, alignSelf: 'flex-start',
                    padding: '10px 22px', borderRadius: 999,
                    font: '600 14px inherit', color: 'var(--cx-accent)',
                    background: 'none', border: '1px solid var(--cx-accent-border)', cursor: 'pointer',
                  }}>
                  <GearIcon size={16} /> {lang === 'es' ? 'Editar detalles' : 'Edit details'}
                </button>
                )
              )}

              {/* Ajustes restantes (solo los que el wizard no pregunta) */}
              {variables.length > 0 && (
                <div style={{
                  background: 'var(--cx-card)', backdropFilter: 'blur(12px)',
                  border: '1px solid var(--cx-border)', borderRadius: 20, padding: 20,
                  display: 'flex', flexDirection: 'column', gap: 22,
                }}>
                  {variables.map(v => (
                    <VariableControl key={v.id} v={v} value={vals[v.id]} lang={lang} serviceId={serviceId}
                      onValue={(n) => { setVals(p => ({ ...p, [v.id]: n })); setUnsure(p => { const q = { ...p }; delete q[v.id]; return q; }); }} />
                  ))}
                </div>
              )}

              {/* Urgencia + descuento */}
              <div style={{
                background: 'var(--cx-card)', backdropFilter: 'blur(12px)',
                border: '1px solid var(--cx-border)', borderRadius: 20, padding: 24,
              }}>
                <div style={{ display: 'flex', gap: 10 }}>
                  {([['none', lang === 'es' ? 'Normal' : EN.urgency.normal], ['72h', lang === 'es' ? 'Pronto +30%' : EN.urgency.soon], ['24h', lang === 'es' ? 'Crítico +50%' : EN.urgency.critical]] as const).map(([id, label]) => (
                    <button key={id} onClick={() => setUrgency(id as Urgency)}
                      style={{
                        flex: 1, padding: '12px 16px', borderRadius: 14, font: `600 13px inherit`, cursor: 'pointer',
                        border: urgency === id ? '2px solid var(--cx-accent)' : '1px solid var(--cx-border-strong)',
                        background: urgency === id ? 'var(--cx-accent-soft)' : 'var(--cx-card-solid)', color: 'var(--cx-text)',
                      }}>{label}</button>
                  ))}
                </div>
                <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 16, cursor: 'pointer' }}>
                  <button type="button" onClick={() => setFirstClient(!firstClient)}
                    style={{ width: 44, height: 26, borderRadius: 13, background: firstClient ? '#30d158' : 'var(--cx-border-strong)', position: 'relative', flexShrink: 0 }}>
                    <div style={{ position: 'absolute', top: 2, left: firstClient ? 20 : 2, width: 22, height: 22, borderRadius: '50%', background: 'var(--cx-card-solid)', boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transition: 'left 0.25s' }} />
                  </button>
                  <span style={{ fontSize: 14, color: 'var(--cx-muted)' }}>{lang === 'es' ? 'Descuento lanzamiento' : 'Launch discount'} −{LAUNCH_DISCOUNT.defaultPct}%</span>
                </label>
              </div>
            </div>

            {/* Panel derecho: resultado STICKY */}
            <aside className="cx-config-aside" style={{
              position: 'sticky', top: 24,
              background: 'var(--cx-card)', backdropFilter: 'blur(16px)',
              border: '1px solid var(--cx-border)', borderRadius: 24, padding: 32,
              boxShadow: '0 8px 32px var(--cx-soft)',
            }}>
              {quote && tier ? (
                <>
                  {/* ciclo 11: cabecera SOLO visible en el PDF impreso —
                      id de la cotización + fecha + enlace con estado */}
                  <div className="cx-print-header" style={{ display: 'none' }}>
                    <strong>{lang === 'es' ? 'Cotización' : 'Quote'} {qId} — {BRAND.name}</strong>
                    <span>{typeof window !== 'undefined' ? new Date().toLocaleDateString(lang === 'es' ? 'es-CO' : 'en-US') : ''}</span>
                    <span>{shareUrl}</span>
                  </div>
                  {/* ciclo 10 — precio grande: con extras es EL RANGO DEL PROYECTO
                      (principal + extras, ya con bundle); el tier solo se muestra
                      para un servicio sin extras. */}
                  {extraQuotes.length > 0 && totalProyecto ? (
                    <>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--cx-accent)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                        {lang === 'en' ? EN.yourProject(numServicios) : `Tu proyecto · ${numServicios} servicios`}
                      </div>
                      <div aria-live="polite" aria-atomic="true" style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--cx-text)', lineHeight: 1 }}>
                        {fmt(currency, totalProyecto.min)}
                      </div>
                      <div style={{ fontSize: 'clamp(1.2rem, 2vw, 1.6rem)', fontWeight: 500, color: 'var(--cx-muted)', marginTop: 4 }}>
                        a {fmt(currency, totalProyecto.max)}
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--cx-accent)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                        {lang === 'en'
                          ? `${tier} · ${EN.tierNames[tier] ?? ''} ${EN.tierWord}`
                          : `${tier} · Nivel ${tier === 'XS' ? 'esencial' : tier === 'S' ? 'estándar' : tier === 'M' ? 'profesional' : tier === 'L' ? 'premium' : 'máximo'}`}
                      </div>
                      <div style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--cx-text)', lineHeight: 1 }}>
                        {fmt(currency, quote.totalMin)}
                      </div>
                      <div style={{ fontSize: 'clamp(1.2rem, 2vw, 1.6rem)', fontWeight: 500, color: 'var(--cx-muted)', marginTop: 4 }}>
                        a {fmt(currency, quote.totalMax)}
                      </div>
                    </>
                  )}
                  {/* ciclo 10 — card HORAS retirada; ENTREGA sola a lo ancho.
                      Regla de entrega con extras: lo MÁS CONSERVADOR de cada
                      extremo — min = el mayor de los mínimos, max = el mayor de
                      los máximos (entregaDiasEs[1]) entre principal y extras. */}
                  {(() => {
                    const dias = entregaDias;
                    return (
                      <div style={{ marginTop: 24, padding: 14, borderRadius: 14, background: 'var(--cx-tile)' }}>
                        <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--cx-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{lang === 'es' ? 'Entrega' : EN.delivery}</div>
                        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--cx-text)', marginTop: 2 }}>
                          {dias ? `${dias[0]}–${dias[1]}d` : '—'}
                        </div>
                      </div>
                    );
                  })()}
                  {extraQuotes.length > 0 && (
                    <div style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid var(--cx-soft)' }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--cx-muted)', marginBottom: 10 }}>{lang === 'es' ? 'Tu proyecto también incluye' : EN.alsoIncludes}</div>
                      {extraQuotes.map(e => (
                        <div key={e.pick.serviceId} style={{ padding: '10px 0', borderBottom: '1px solid var(--cx-border)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                            <span style={{ fontSize: 13.5, color: 'var(--cx-text)' }}>{pickLabel(e.pick, lang)}</span>
                            <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--cx-text)', whiteSpace: 'nowrap' }}>
                              {fmt(currency, e.quote.totalMin)}–{fmt(currency, e.quote.totalMax)}
                            </span>
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--cx-faint)', marginTop: 2 }}>{e.quote.serviceName} · nivel {e.tier}</div>
                          {pickNota(e.pick, lang) && <div style={{ fontSize: 11, color: 'var(--cx-muted)', marginTop: 3, lineHeight: 1.4 }}>{pickNota(e.pick, lang)}</div>}
                        </div>
                      ))}
                      {/* ciclo 10: la fila "Total proyecto" se retira — el rango
                          del proyecto ya es el precio grande del panel */}
                      {bundle > 0 && (
                        <div style={{ fontSize: 11.5, color: '#30d158', marginTop: 8 }}>
                          {lang === 'es' ? `Incluye −${bundle}% por agrupar ${numServicios} servicios` : EN.bundleLine(bundle, numServicios)}
                        </div>
                      )}
                    </div>
                  )}
                  {quote.entregables.length > 0 && (
                    <div style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid var(--cx-soft)' }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--cx-muted)', marginBottom: 8 }}>{lang === 'es' ? 'Incluye' : EN.includes}</div>
                      {(lang === 'en' ? (CATALOG_EN[svc.id]?.entregables ?? quote.entregables) : quote.entregables).slice(0, 4).map((e: string) => (
                        <div key={e} style={{ fontSize: 14, color: 'var(--cx-text)', padding: '4px 0', display: 'flex', gap: 6 }}>
                          <span style={{ color: '#30d158' }}>✓</span> {e}
                        </div>
                      ))}
                    </div>
                  )}
                  {/* D3+D5 ciclo 2.1: rondas incluidas y esquema de pago sugerido */}
                  <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px dashed var(--cx-soft)' }}>
                    {pagoSugerido && (
                      <div style={{ fontSize: 13, color: 'var(--cx-text)', padding: '3px 0', display: 'flex', gap: 6 }}>
                        <span style={{ color: 'var(--cx-accent)', fontWeight: 600 }}>{lang === 'es' ? 'Pago sugerido:' : EN.paymentSuggested}</span> {lang === 'en' ? EN.pago[pagoSugerido] ?? pagoSugerido : pagoSugerido}
                      </div>
                    )}
                    <div style={{ fontSize: 13, color: 'var(--cx-text)', padding: '3px 0' }}>{lang === 'es' ? RONDAS_NOTA : EN.rondas}</div>
                  </div>
                  <div data-noprint style={{ marginTop: 24 }}>
                    <QuoteCta summary={summary} url={shareUrl} lang={lang} />
                  </div>
                  <p style={{ fontSize: 11, color: 'var(--cx-faint)', marginTop: 16, textAlign: 'center' }}>{lang === 'es' ? 'Rango orientativo · válida 15 días' : EN.rangeValidity}</p>
                  {/* ciclo 11: prototipo en vivo junto al CTA — la demo real del trabajo */}
                  <p data-noprint style={{ fontSize: 12, textAlign: 'center', margin: '8px 0 0' }}>
                    <a href={BRAND.prototypeUrl} target="_blank" rel="noopener noreferrer" className="cx-prototype-link cx-protolink"
                      style={{ color: 'var(--cx-accent)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, justifyContent: 'center' }}>
                      {lang === 'es' ? '¿Dudas del trabajo? Ve el prototipo: Twinsight X500' : EN.prototypeAside}
                      <ExternalIcon size={12} />
                    </a>
                  </p>
                </>
              ) : (
                <p style={{ color: 'var(--cx-muted)', fontSize: 15, textAlign: 'center', padding: 20 }}>{lang === 'es' ? 'Configura las variables para ver el precio' : EN.configurePrice}</p>
              )}
            </aside>
          </section>
        )}

        {/* ═══ MODO CATÁLOGO ═══ */}
        {mode === 'catalog' && (
          <section style={{ paddingTop: 60, paddingBottom: 60 }}>
            <h2 style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--cx-text)', margin: '0 0 8px' }}>
              {lang === 'es' ? 'Todos los servicios' : EN.catalogTitle}
            </h2>
            <p style={{ fontSize: 16, color: 'var(--cx-muted)', margin: '0 0 28px' }}>{lang === 'es' ? 'Web 3D, visores, configuradores, herramientas.' : EN.catalogSubtitle}</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 32 }}>
              {['todas', ...CATALOG_FAMILIES].map(f => (
                <button key={f} onClick={() => setFamilyFilter(f)} className="cx-chip"
                  style={{
                    padding: '8px 18px', borderRadius: 999, font: `500 13.5px inherit`, cursor: 'pointer',
                    border: familyFilter === f ? '2px solid var(--cx-accent)' : '1px solid var(--cx-border-strong)',
                    background: familyFilter === f ? 'var(--cx-accent-soft)' : 'var(--cx-card)',
                    color: familyFilter === f ? 'var(--cx-accent)' : 'var(--cx-text)',
                  }}>
                  {f === 'todas' ? (lang === 'es' ? 'Todos' : EN.all) : (lang === 'en' ? EN.families[f] ?? f : FAMILY_LABELS[f] ?? f)}
                </button>
              ))}
            </div>
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
              gap: 16,
            }} className="cx-grid">
              {SERVICES.filter(s => familyFilter === 'todas' || s.family === familyFilter).map((s, i) => (
                <ServiceCard key={s.id} svc={s} currency={currency} index={i} lang={lang}
                  onPick={() => { setMode('guided'); setServiceId(s.id); setVals({}); setExtras([]); }} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
