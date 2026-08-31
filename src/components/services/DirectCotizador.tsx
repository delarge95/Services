import './cotizador.css';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { SERVICES } from '../../data/services/catalogCore';
import type { ServiceDef } from '../../data/services/catalogCore';
import { computeQuote } from '../../data/services/formula';
import { LAUNCH_DISCOUNT } from '../../data/services/rateCard';
import type { Currency, LevelId, Subtask } from '../../data/services/types';
import {
  SERVICE_VARIABLES,
  derivarTier,
  recommendedValue,
} from '../../data/services/serviceVariables';
import type { ServiceVariable } from '../../data/services/serviceVariables';
import { groupSubtasksByPhase, PHASES } from '../../data/services/rateLabels';
import { unitToTerm } from '../../data/services/glossary';
import { GOALS, servicesForGoal, minPriceOf } from '../../data/services/goals';
import { Term } from './Term';
import { QuoteCta } from './QuoteCta';
import { ProcesoFaq } from './ProcesoFaq';
import { TierGallery } from './TierGallery';
import { PriceWhy } from './PriceWhy';
import { RefDropzone } from './RefDropzone';
import { CotizadorChat } from './chat/CotizadorChat';
import { Cotizador3DDemo } from './Cotizador3DDemo';
import { BRAND, HOW_IT_WORKS } from '../../data/services/branding';
import { computePriceDrivers } from '../../lib/services/priceWhy';
import { inventoryLine } from '../../lib/services/fileChecklist';
import {
  buildSummary,
  decodeShare,
  encodeShare,
  loadLocal,
  quoteId,
  saveLocal,
} from '../../lib/services/share';
import type { ShareState } from '../../lib/services/share';

// ─── Tipos locales ───
type Urgency = 'none' | '72h' | '24h';
type Val = number | string | boolean;

// ─── Estilos ───
// Sistema Apple-like: usar .cx-card en vez de box inline
const box: React.CSSProperties = { background: '#fff', border: '1px solid #dde0e8', borderRadius: 12, padding: 20, marginBottom: 16 };
const lbl: React.CSSProperties = { display: 'block', fontSize: 15, fontWeight: 600, marginBottom: 8, color: '#1a1d29' };
const help: React.CSSProperties = { fontSize: 12.5, color: '#5a5e6e', marginTop: 4 };

const CX_CSS = `
@media (max-width: 480px) { .cx-step-label { display: none; } }
@media print {
  [data-noprint] { display: none !important; }
  body { background: #fff !important; }
  #cotizador-resultado { border: none !important; padding: 0 !important; }
  /* Encabezado formal del PDF: marca + contacto + validez (visible SOLO al imprimir) */
  #print-header { display: flex !important; justify-content: space-between; align-items: flex-start;
    border-bottom: 2px solid #0a84ff; padding-bottom: 8px; margin-bottom: 14px; }
  .cx-page { max-width: 100% !important; padding: 0 !important; }
}
#print-header { display: none; }
.cx-term { position: relative; display: inline-flex; align-items: center; margin-left:  6px; cursor: help; color: #0a84ff; font-style: normal; font-weight: 400; }
.cx-term:focus-visible { outline: 2px solid #0a84ff; border-radius: 4px; }
.cx-term-pop {
  position: absolute; bottom: 135%; left: 50%; transform: translateX(-50%);
  width: min(270px, 74vw); background: #1a1d29; color: #fff; font-size: 12px; line-height: 1.45;
  padding: 10px 12px; border-radius: 8px; opacity: 0; pointer-events: none; transition: opacity .12s;
  z-index: 40; text-align: left; font-weight: 400;
}
.cx-term:hover .cx-term-pop, .cx-term:focus .cx-term-pop { opacity: 1; }
`;

// ─── Componente principal ───
export function DirectCotizador() {
  const [currency, setCurrency] = useState<Currency>('USD');
  const [goal, setGoalRaw] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [familyFilter, setFamilyFilter] = useState('');
  const [vals, setVals] = useState<Record<string, Val>>({});
  const [unsure, setUnsure] = useState<Record<string, boolean>>({});
  const [firstClient, setFirstClient] = useState(true);
  const [urgency, setUrgency] = useState<Urgency>('none');
  const [quantity, setQuantity] = useState(1);
  const [adjuntos, setAdjuntos] = useState<string[]>([]);
  const [showAll, setShowAll] = useState(false);
  const hydratedRef = useRef(false);

  useEffect(() => {
    const shared = decodeShare(window.location.search);
    const local = shared ?? loadLocal();
    if (local) {
      setServiceId(local.serviceId);
      setVals(local.vals ?? {});
      setCurrency(local.currency === 'COP' ? 'COP' : 'USD');
      setFirstClient(local.firstClient !== false);
      if (['none', '72h', '24h'].includes(String(local.urgency))) setUrgency(local.urgency as Urgency);
      setQuantity(Math.max(1, Number(local.quantity) || 1));
    }
    hydratedRef.current = true;
  }, []);

  useEffect(() => {
    if (!hydratedRef.current) return;
    saveLocal({ serviceId, vals, currency, firstClient, urgency, quantity });
  }, [serviceId, vals, currency, firstClient, urgency, quantity]);

  
  const setGoal = (g: string) => { setGoalRaw(g); setUnsure({}); };

  const svc: ServiceDef | undefined = serviceId ? SERVICES.find((s) => s.id === serviceId) : undefined;
  const variables: ServiceVariable[] = serviceId ? (SERVICE_VARIABLES[serviceId]?.variables ?? []) : [];
  const goalLabel = GOALS.find((g) => g.id === goal)?.labelEs ?? '';

  const tier = useMemo(() => {
    if (!serviceId) return null;
    return derivarTier(serviceId, vals);
  }, [serviceId, vals]);

  const urgencyPct = urgency === '72h' ? 25 : urgency === '24h' ? 50 : 0;

  const quoteOpts = useMemo(() => ({
    firstClientLaunch: firstClient,
    batchUnits: quantity > 1 ? quantity : undefined,
    urgencyPct,
  }), [firstClient, quantity, urgencyPct]);

  const quote = useMemo(() => {
    if (!svc || !tier) return null;
    try {
      return computeQuote(svc.id, tier, currency, quoteOpts);
    } catch { return null; }
  }, [svc, tier, currency, quoteOpts]);

  // Progressive disclosure: un paso visible a la vez (Apple-style)
  const step = !goal ? 1 : !serviceId ? 2 : !quote ? 3 : 4;

  const phaseGroups = useMemo(() => {
    if (!svc || !tier) return [];
    return groupSubtasksByPhase(svc.subtasks as Subtask[], tier);
  }, [svc, tier]);

  // S6: lista por objetivo; chips de familia siguen funcionando dentro.
  const priceMap = useMemo(() => {
    const base = goal ? servicesForGoal(goal) : SERVICES;
    const list = familyFilter ? base.filter((s) => s.family === familyFilter) : base;
    const m = new Map<string, number | null>();
    for (const s of list) m.set(s.id, minPriceOf(s.id, currency));
    return { list, m };
  }, [goal, familyFilter, currency]);
  const filtered = priceMap.list;

  // S10: drivers de precio
  const drivers = useMemo(() => {
    if (!svc || variables.length === 0) return [];
    try { return computePriceDrivers(svc.id, currency, quoteOpts, variables, vals); }
    catch { return []; }
  }, [svc, variables, currency, quoteOpts, vals]);

  const conditions = useMemo(() => {
    const c: string[] = [];
    if (firstClient && LAUNCH_DISCOUNT.activo) c.push(`Lanzamiento −${LAUNCH_DISCOUNT.defaultPct}%`);
    if (urgencyPct > 0) c.push(`Urgencia +${urgencyPct}%`);
    if (quantity > 1) c.push(`Lote ×${quantity} −15%`);
    return c;
  }, [firstClient, urgencyPct, quantity]);

  const shareState: ShareState | null = svc && tier
    ? { serviceId: svc.id, vals, currency, firstClient, urgency, quantity }
    : null;
  const shareUrl = shareState && typeof window !== 'undefined'
    ? `${window.location.origin}${window.location.pathname}?${encodeShare(shareState)}`
    : '';
  const qid = shareState ? quoteId(shareState) : '';

  const summary = shareState && quote && tier
    ? buildSummary({
        id: qid,
        serviceName: svc!.nameEs,
        serviceCode: svc!.id,
        tier,
        currency,
        totalRange: `${fmt(currency, quote.totalMin)} – ${fmt(currency, quote.totalMax)}`,
        hoursRange: `${quote.hoursMin}–${quote.hoursMax} h`,
        entrega: svc!.entregaDiasEs ? `${svc!.entregaDiasEs[0]}–${svc!.entregaDiasEs[1]} días hábiles` : undefined,
        entregables: quote.entregables,
        noIncluye: quote.noIncluye,
        url: shareUrl,
        adjuntos: inventoryLine(adjuntos),
      })
    : '';

  const chatSection = !serviceId ? 'inicio' : !quote ? 'variables' : 'resultado';

  const toggleUnsure = (v: ServiceVariable) => {
    setUnsure((p) => {
      const next = { ...p };
      if (next[v.id]) { delete next[v.id]; return next; }
      const rec = recommendedValue(v, goal);
      if (rec !== null) setVals((pv) => ({ ...pv, [v.id]: rec }));
      next[v.id] = true;
      return next;
    });
  };

  return (
    <div className="cx-root" style={{ maxWidth: 720, margin: '0 auto', padding: '24px 16px 60px' }}>
      <style dangerouslySetInnerHTML={{ __html: CX_CSS }} />

      {/* Encabezado formal visible solo al imprimir/PDF (cotización) */}
      <div id="print-header">
        <div>
          <strong style={{ fontSize: 15, color: '#1a1d29' }}>{BRAND.name}</strong>
          <span style={{ display: 'block', fontSize: 11, color: '#5a5e6e' }}>{BRAND.role}</span>
        </div>
        <div style={{ textAlign: 'right', fontSize: 11, color: '#5a5e6e' }}>
          <span style={{ display: 'block' }}>{BRAND.contactEmail}</span>
          <span style={{ display: 'block' }}>{BRAND.links.portfolio}</span>
          <span style={{ display: 'block', marginTop: 4 }}>Cotización orientativa · válida 15 días</span>
        </div>
      </div>

      <header data-noprint style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 20, paddingBottom: 12 }}>
        <strong style={{ fontSize: 15, fontWeight: 600, color: 'var(--cx-text)', letterSpacing: '-0.01em' }}>{BRAND.name}</strong>
        <span><CurrencyToggle currency={currency} onChange={setCurrency} /></span>
      </header>

      {/* Step indicator — siempre visible, muestra dónde estás */}
      <div data-noprint style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 36, padding: '0 4px' }}>
        {['Objetivo', 'Servicio', 'Configura', 'Resultado'].map((label, i) => (
          <React.Fragment key={label}>
            {i > 0 && <span className="cx-step-sep" style={{ opacity: step > i ? 1 : 0.3 }} />}
            <span className="cx-step" data-active={step === i + 1 || step > i + 1}>
              <span className="cx-step-dot" style={step > i + 1 ? { background: 'var(--cx-accent)', borderColor: 'var(--cx-accent)', color: '#fff' } : undefined}>
                {step > i + 1 ? '✓' : i + 1}
              </span>
              <span className="cx-step-label">{label}</span>
            </span>
          </React.Fragment>
        ))}
      </div>
      {!serviceId && (
        <>
          <h1 className="cx-hero-title" style={{ marginTop: 8, textAlign: 'center' }}>Cotiza tu proyecto 3D<br />en minutos</h1>
          <p className="cx-hero-sub" style={{ textAlign: 'center', margin: '0 auto 32px' }}>{BRAND.valueProp}</p>
        </>
      )}
      

      {/* Cómo funciona (no-engineer) + garantías — colapsable tras primera interacción */}
      {!serviceId && (
        <details data-noprint className="cx-card cx-anim" style={{ marginBottom: 14, padding: '20px 24px' }}>
        <summary style={{ cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600, color: 'var(--cx-text-2)', listStyle: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16 }}>ⓘ</span> Cómo funciona y garantías
        </summary>
        <div style={{ marginTop: 16 }}>
          <span className="cx-section-label">Cómo funciona</span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 10, marginBottom: 12 }}>
            {HOW_IT_WORKS.map((s) => (
              <div key={s.n} style={{ display: 'flex', gap: 8 }}>
                <span style={{ flexShrink: 0, width: 22, height: 22, borderRadius: 11, background: '#0a84ff', color: '#fff', font: '700 11.5px/22px inherit', textAlign: 'center' }}>{s.n}</span>
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: '#1a1d29' }}>{s.title}</div>
                  <div style={{ fontSize: 11, color: '#5a5e6e', lineHeight: 1.45 }}>{s.desc}</div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, paddingTop: 10, borderTop: '1px solid #eef0f5' }}>
            {BRAND.trustPoints.map((t) => (
              <span key={t.text} style={{ fontSize: 11, color: '#3c4152', background: '#f2f4f9', borderRadius: 999, padding: '4px 10px' }}>
                {t.icon} {t.text}
              </span>
            ))}
          </div>
          <div style={{ marginTop: 10, fontSize: 11, color: '#8a8fa3' }}>
            Ver trabajo real:{' '}
            <a href={BRAND.links.portfolio} target="_blank" rel="noopener noreferrer" style={{ color: '#0a84ff' }}>portafolio</a>
            {' · '}
            <a href={BRAND.links.artstation} target="_blank" rel="noopener noreferrer" style={{ color: '#0a84ff' }}>ArtStation</a>
          </div>
        </div>
        </details>
      )}
      <Cotizador3DDemo />

      <p style={{ margin: '0 0 18px', fontSize: 12, color: '#5a5e6e' }}>
        Precios en {currency === 'USD' ? 'dólares (tarifa internacional)' : 'pesos colombianos (mercado local)'}
        <Term id="moneda" />
      </p>

      {/* 0+1: Objetivo y servicio */}
      <div className="cx-card cx-anim" data-noprint>
        <span className="cx-section-label">¿Qué quieres lograr?</span>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(190px,1fr))', gap: 8, marginBottom: 14 }}>
          {GOALS.map((g) => (
            <button key={g.id} onClick={() => setGoal(goal === g.id ? '' : g.id)}
              title={g.descEs}
              className="cx-service-card"
              data-selected={goal === g.id}>
              <span style={{ fontSize: 22, lineHeight: 1 }}>{g.icon}</span>
              <span style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: '#1a1d29', marginTop: 2 }}>{g.labelEs}</span>
              <span style={{ display: 'block', fontSize: 10.5, color: '#5a5e6e' }}>{g.descEs}</span>
            </button>
          ))}
        </div>

        <span className="cx-section-label">{step === 2 ? 'Elige tu servicio' : 'Cambia servicio'}</span>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
          <FilterChip active={familyFilter === ''} onClick={() => setFamilyFilter('')} label="Todos" />
          {[
            { id: 'render', label: 'Render 3D' },
            { id: 'asset-rt', label: 'Assets RT' },
            { id: 'web-3d', label: 'Web 3D' },
            { id: 'vfx', label: 'VFX' },
            { id: 'ia', label: 'IA' },
            { id: 'datos', label: 'CAD/Datos' },
            { id: 'soporte', label: 'Soporte' },
          ].map((f) => (
            <FilterChip key={f.id} active={familyFilter === f.id} onClick={() => setFamilyFilter(f.id)} label={f.label} />
          ))}
        </div>
        <div style={{ display: 'grid', gap: 6, maxHeight: 300, overflowY: 'auto' }}>
          {filtered.length === 0 && (
            <p style={{ ...help, margin: 0 }}>Ningún servicio de este objetivo en esta familia. Prueba con “Todos”.</p>
          )}
          {filtered.slice(0, showAll ? filtered.length : 8).map((s) => {
            const desde = priceMap.m.get(s.id);
            return (
              <button key={s.id} onClick={() => { setServiceId(s.id); setVals({}); setUnsure({}); }}
                style={{
                  padding: 12, borderRadius: 10, cursor: 'pointer', font: 'inherit', textAlign: 'left',
                  border: serviceId === s.id ? '2px solid #0a84ff' : '1px solid #dde0e8',
                  background: serviceId === s.id ? '#e8f0fe' : '#fff', color: '#1a1d29',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8,
                }}>
                <span>
                  <span style={{ display: 'block', fontWeight: 600, fontSize: 14 }}>{s.nameEs}</span>
                  <span style={{ display: 'block', fontSize: 12, opacity: 0.6 }}>{s.unitEs}</span>
                </span>
                {desde != null && (
                  <span style={{ flexShrink: 0, fontSize: 11.5, fontWeight: 700, color: '#166534', whiteSpace: 'nowrap' }}>
                    desde {fmt(currency, desde)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
          {filtered.length > 8 && (
            <button onClick={() => setShowAll(!showAll)}
              style={{
                marginTop: 10, width: '100%', padding: '10px', borderRadius: 10,
                border: '1px dashed #d5dbe8', background: 'transparent',
                cursor: 'pointer', font: 'inherit', fontSize: 13, color: '#0071e3',
              }}>
              {showAll ? 'Ver menos ↑' : `Ver ${filtered.length - 8} servicios más ↓`}
            </button>
          )}
      </div>

      {/* 2: Variables */}
      {svc && variables.length > 0 && (
        <div className="cx-card cx-anim" data-noprint>
          <span className="cx-section-label">2 · Configura lo que sabes</span>
          <p style={{ ...help, marginTop: 0, marginBottom: 12 }}>
            ¿No sabes qué poner? Usa <strong>“No sé”</strong> en cada pregunta y ponemos un valor típico por ti.
          </p>
          {variables.map((v) => (
            <VariableControl key={v.id}
              v={v}
              value={vals[v.id]}
              unsure={!!unsure[v.id]}
              recReason={goalLabel ? `recomendado para “${goalLabel}”` : 'valor típico'}
              onChange={(nv) => {
                setVals((p) => ({ ...p, [v.id]: nv }));
                setUnsure((p) => { const n = { ...p }; delete n[v.id]; return n; });
              }}
              onToggleUnsure={() => toggleUnsure(v)}
            />
          ))}
        </div>
      )}

      {/* 3: Nivel derivado */}
      {tier && (
        <div className="cx-card cx-anim" data-noprint>
          <span className="cx-section-label">3 · Nivel calculado automáticamente</span>
          <div style={{ display: 'flex', gap: 6 }}>
            {(['XS', 'S', 'M', 'L', 'XL'] as LevelId[]).map((l) => (
              <div key={l} style={{
                flex: 1, padding: '10px 4px', borderRadius: 10, textAlign: 'center',
                border: tier === l ? '2px solid #0a84ff' : '1px solid #dde0e8',
                background: tier === l ? '#e8f0fe' : '#fff',
              }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: tier === l ? '#0a84ff' : '#5a5e6e' }}>{l}</div>
              </div>
            ))}
          </div>
          <p className="cx-caption">Tú nunca eliges el nivel: se deriva de tus respuestas de arriba.</p>
        </div>
      )}

      {/* 4: Condiciones */}
      {svc && (
        <div className="cx-card cx-anim" data-noprint>
          <span className="cx-section-label">4 · Condiciones</span>
          <div style={{ marginBottom: 14 }}>
            <span style={{ ...lbl, fontSize: 14 }}>Urgencia</span>
            <div style={{ display: 'flex', gap: 8 }}>
              {([
                { id: 'none' as Urgency, label: 'Sin apuro', desc: 'Cola normal' },
                { id: '72h' as Urgency, label: 'Pronto', desc: '+25%' },
                { id: '24h' as Urgency, label: 'Crítico', desc: '+50% · según disponibilidad' },
              ]).map((o) => (
                <button key={o.id} onClick={() => setUrgency(o.id)}
                  style={{
                    flex: 1, padding: '10px 12px', borderRadius: 10,
                    cursor: 'pointer', font: 'inherit', textAlign: 'left',
                    border: urgency === o.id ? '2px solid #0a84ff' : '1px solid #dde0e8',
                    background: urgency === o.id ? '#e8f0fe' : '#fff',
                    color: '#1a1d29',
                  }}>
                  <strong style={{ fontSize: 13.5 }}>{o.label}</strong>
                  <div style={{ fontSize: 11, opacity: 0.65 }}>{o.desc}</div>
                </button>
              ))}
            </div>
            <p style={{ ...help, marginTop: 6 }}>Los plazos urgentes se confirman por chat antes de iniciar.</p>
          </div>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer' }}>
            <input type="checkbox" checked={firstClient} onChange={(e) => setFirstClient(e.target.checked)} />
            <span style={{ fontSize: 14, color: '#1a1d29' }}>
              Descuento Lanzamiento (<strong>−{LAUNCH_DISCOUNT.defaultPct}%</strong>)
            </span>
          </label>
        </div>
      )}

      {/* 5: Resultado */}
      {svc && tier && quote && (
        <div id="cotizador-resultado" className="cx-card" data-noprint={false}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <strong style={{ fontSize: 16, color: '#1a1d29' }}>{svc.nameEs}</strong>
            <span style={{
              background: '#0071e3', color: '#fff', padding: '4px 14px',
              borderRadius: 999, fontSize: 14, fontWeight: 700, letterSpacing: '0.02em',
            }}>
              {tier}
            </span>
          </div>

          {svc.entregablesEs.length > 0 && (
            <div style={{ background: '#f0faf4', border: '1px solid #c3e6cb', borderRadius: 10, padding: 14, marginBottom: 12 }}>
              <strong style={{ fontSize: 13, color: '#1b8a5a' }}>📦 Recibes:</strong>
              <ul style={{ fontSize: 13, paddingLeft: 16, marginTop: 6, color: '#1a1d29' }}>
                {quote.entregables.map((e: string) => <li key={e}>✓ {e}</li>)}
              </ul>
            </div>
          )}

          {quote.noIncluye.length > 0 && (
            <div style={{ background: '#fff8f0', border: '1px solid #f0d0a0', borderRadius: 10, padding: 14, marginBottom: 12 }}>
              <strong style={{ fontSize: 13, color: '#8a6d00' }}>⚠️ NO incluido:</strong>
              <ul style={{ fontSize: 13, paddingLeft: 16, marginTop: 6, color: '#1a1d29' }}>
                {quote.noIncluye.map((e: string) => <li key={e}>✗ {e}</li>)}
              </ul>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBlock: 14 }}>
            <StatBox label="Horas" value={`${quote.hoursMin}–${quote.hoursMax} h`} />
            <StatBox label="Nivel" value={tier} />
            <StatBox label="Total" value={`${fmt(currency, quote.totalMin)}–${fmt(currency, quote.totalMax)}`} highlight />
          </div>

          {svc.entregaDiasEs && svc.entregaDiasEs[1] > 0 && (
            <p style={{ fontSize: 13, color: '#5a5e6e', marginBottom: 8 }}>
              ⏱ Entrega: {svc.entregaDiasEs[0]}–{svc.entregaDiasEs[1]} días hábiles
            </p>
          )}

          {/* S7: comparador de niveles */}
          <TierGallery svc={svc} tier={tier} currency={currency} quoteOpts={quoteOpts} />

          {/* S10: transparencia del precio */}
          <PriceWhy drivers={drivers} conditions={conditions}
            onLower={(varId, minValue) => setVals((p) => ({ ...p, [varId]: minValue }))} />

          {/* S2: desglose por fases */}
          <details style={{ marginTop: 8 }} open>
            <summary style={{ cursor: 'pointer', fontSize: 13, color: '#0a84ff' }}>¿Cómo se calcula? ({variables.length} variables)</summary>
            <div style={{ fontSize: 12.5, marginTop: 8, color: '#1a1d29' }}>
              {PHASES.map(({ id, label, icon }) => {
                const g = phaseGroups.find((gr) => gr.phase === id);
                if (!g) return null;
                return (
                  <div key={id} style={{ marginBottom: 10 }}>
                    <strong style={{ fontSize: 13 }}>{icon} {label}</strong>
                    <span style={{ opacity: 0.65, marginLeft: 6, fontSize: 12 }}>{g.hoursLabel}</span>
                    <ul style={{ paddingLeft: 18, margin: '4px 0 0' }}>
                      {g.items.map((it) => (
                        <li key={it.id} style={{ marginBottom: 2 }}>
                          {it.nameEs} · <span style={{ opacity: 0.7 }}>{it.hoursLabel}</span>
                          {' '}
                          <span style={{ opacity: 0.55, fontSize: 11.5 }}>({it.classLabel})</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
              <p style={{ marginTop: 6, opacity: 0.65 }}>{quote.notesEs?.join(' ')}</p>
            </div>
          </details>

          {/* S9: referencias/archivos con checklist local */}
          <RefDropzone onInventory={setAdjuntos} />

          <QuoteCta summary={summary} url={shareUrl} />

          <p style={{ fontWeight: 600, fontSize: 13, marginTop: 12, color: '#1a1d29' }}>
            ⚠️ Rango orientativo, no cotización.
          </p>
        </div>
      )}

      <ProcesoFaq />

      {/* S12: asistente contextual */}
      <span data-noprint>
        <CotizadorChat
          section={chatSection}
          serviceName={svc?.nameEs}
          tier={tier ?? undefined}
          totalRange={quote && svc ? `${fmt(currency, quote.totalMin)} – ${fmt(currency, quote.totalMax)}` : undefined}
          entrega={svc?.entregaDiasEs ? `${svc.entregaDiasEs[0]}–${svc.entregaDiasEs[1]} días hábiles` : undefined}
          contactEmail={BRAND.contactEmail}
        />
      </span>
    </div>
  );
}

// ─── Sub-componentes ───

function VariableControl({ v, value, unsure, recReason, onChange, onToggleUnsure }: {
  v: ServiceVariable;
  value: Val | undefined;
  unsure: boolean;
  recReason: string;
  onChange: (nv: Val) => void;
  onToggleUnsure: () => void;
}) {
  const head = (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
      <span>{v.preguntaEs}{v.type === 'number' && unitToTerm(v.unidadEs) && <Term id={unitToTerm(v.unidadEs)!} />}</span>
      <button onClick={onToggleUnsure} aria-pressed={unsure}
        style={{
          flexShrink: 0, font: 'inherit', fontSize: 11.5, cursor: 'pointer',
          border: unsure ? '1px solid #0a84ff' : '1px solid #dde0e8', borderRadius: 999,
          padding: '2px 10px', background: unsure ? '#e8f0fe' : '#fff', color: unsure ? '#0a84ff' : '#5a5e6e',
        }}>
        {unsure ? '✓ Usando recomendado' : 'No sé'}
      </button>
    </div>
  );

  if (v.type === 'number') {
    const current = typeof value === 'number' ? value : v.min ?? 0;
    return (
      <div style={{ marginBottom: 18, opacity: unsure ? 0.72 : 1 }}>
        <label style={{ ...lbl, fontSize: 15 }}>{head}</label>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
          <strong style={{ fontSize: 22, color: '#0a84ff' }}>{current} {v.unidadEs}</strong>
        </div>
        <input type="range" min={v.min} max={v.max} step={v.step ?? 1} value={current}
          onChange={(e) => onChange(Number(e.target.value))}
          className="cx-slider" style={{ width: '100%' }} />
        {unsure && <p className="cx-caption">✔ {recReason}. Mueve el control para ajustarlo tú.</p>}
        {!unsure && v.tierMap && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, opacity: 0.55, marginTop: 2, color: '#5a5e6e' }}>
            {v.tierMap.map((tm: { maxVal: number; tier: LevelId }) => <span key={tm.tier}>≤{tm.maxVal}={tm.tier}</span>)}
          </div>
        )}
      </div>
    );
  }

  if (v.type === 'toggle') {
    const active = value === true;
    return (
      <div style={{ marginBottom: 16, opacity: unsure ? 0.72 : 1 }}>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer' }}>
          <input type="checkbox" checked={active} onChange={(e) => onChange(e.target.checked)} />
          <span style={{ fontSize: 14.5, color: '#1a1d29', flex: 1 }}>{head}</span>
          {v.tierSiActivo && active && <span className="cx-chip" style={{ fontSize: 11 }}>→ {v.tierSiActivo}</span>}
        </label>
        {unsure && <p className="cx-caption">✔ {recReason}.</p>}
      </div>
    );
  }

  if (v.type === 'select' && v.opciones) {
    return (
      <div style={{ marginBottom: 16, opacity: unsure ? 0.72 : 1 }}>
        <span className="cx-section-label">{head}</span>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {v.opciones.map((o: { valorEs: string; tierHint?: LevelId }) => {
            const active = value === o.valorEs;
            return (
              <button key={o.valorEs}
                onClick={() => onChange(o.valorEs)}
                style={{
                  padding: '10px 16px', borderRadius: 10, cursor: 'pointer', font: 'inherit', fontSize: 13.5,
                  border: active ? '2px solid #0a84ff' : '1px solid #dde0e8',
                  background: active ? '#e8f0fe' : '#fff', color: '#1a1d29',
                  fontWeight: active ? 600 : 400,
                }}>
                {o.valorEs}
              </button>
            );
          })}
        </div>
        {unsure && <p className="cx-caption">✔ {recReason}.</p>}
      </div>
    );
  }

  return null;
}

function FilterChip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button onClick={onClick} className="cx-chip" data-active={active}>{label}</button>
  );
}

function StatBox({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div style={{
      background: highlight ? '#f0f7ff' : '#fafafa',
      border: highlight ? '1px solid rgba(0,113,227,0.2)' : '1px solid var(--cx-border, rgba(0,0,0,0.06))',
      borderRadius: 14, padding: '14px 12px', textAlign: 'center',
    }}>
      <div style={{ fontSize: 11, fontWeight: 500, color: '#86868b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
      <div style={{ fontSize: highlight ? 18 : 15, fontWeight: 700, color: highlight ? '#0071e3' : '#1d1d1f', marginTop: 4, letterSpacing: '-0.01em' }}>{value}</div>
    </div>
  );
}

function fmt(currency: Currency, v: number): string {
  return new Intl.NumberFormat(currency === 'COP' ? 'es-CO' : 'en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(v);
}

function CurrencyToggle({ currency, onChange }: { currency: Currency; onChange: (c: Currency) => void }) {
  return (
    <div role="group" aria-label="Moneda" style={{ display: 'inline-flex', border: '1px solid var(--cx-border, rgba(0,0,0,0.08))', borderRadius: 999, overflow: 'hidden', background: '#fff' }}>
      {(['USD', 'COP'] as Currency[]).map((c) => (
        <button key={c}
          style={{
            padding: '6px 14px', border: 'none', cursor: 'pointer', font: 'inherit',
            fontWeight: currency === c ? 700 : 400,
            background: currency === c ? '#0071e3' : 'transparent',
            color: currency === c ? '#fff' : 'inherit',
          }}
          onClick={() => onChange(c)}>
          {c === 'USD' ? '$ USD' : '$ COP'}
        </button>
      ))}
    </div>
  );
}

function DronePieces({ pieces }: { pieces: number }) {
  const groups: Array<{ min: number; nodes: React.ReactNode[] }> = [
    { min: 1, nodes: [<rect key="f" x="70" y="60" width="100" height="40" rx="10" />, <circle key="m1" cx="50" cy="55" r="12" />, <circle key="m2" cx="190" cy="55" r="12" />] },
    { min: 8, nodes: [<rect key="p1" x="28" y="52" width="44" height="6" rx="3" />, <rect key="p2" x="168" y="52" width="44" height="6" rx="3" />] },
    { min: 20, nodes: [<circle key="g" cx="120" cy="118" r="9" />] },
    { min: 40, nodes: [<line key="an" x1="180" y1="60" x2="196" y2="34" />, <circle key="s" cx="154" cy="92" r="3" />] },
    { min: 90, nodes: [<path key="w" d="M78 70 q42 30 84 0" fill="none" />] },
  ];
  const vis = groups.filter((g) => pieces >= g.min);
  return (
    <figure style={{ margin: '12px 0' }}>
      <svg viewBox="0 0 240 160" width="240" height="160">
        {vis.flatMap((g) => g.nodes.map((n, i) => <g key={g.min + i} fill="#5b5bd6" stroke="#5b5bd6" strokeWidth={2}>{n}</g>))}
      </svg>
      <figcaption style={{ fontSize: 13, opacity: 0.7, color: '#5a5e6e' }}>{pieces} piezas</figcaption>
    </figure>
  );
}
