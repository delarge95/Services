/**
 * quoteAssistant.ts — Asistente del cotizador basado en datos REALES (ciclo 24, 2026-09-30).
 *
 * Determinista (sin LLM ni claves en el cliente: el sitio es estático). Responde:
 *  - "¿cuánto cuesta un render de 5 imágenes?" → detecta servicio + cantidades,
 *    cotiza con computeQuoteContinuous y lista los supuestos usados;
 *  - "¿qué incluye…?", "¿cuánto tarda…?" → entregables / plazo del catálogo;
 *  - "¿por qué este precio?" (con un servicio en pantalla) → desglose horas × tarifa;
 *  - "¿qué servicios hay?" → catálogo real agrupado por línea.
 * Todo número sale de catalogCore / serviceVariables / rateCard: nada inventado.
 */
import { SERVICES } from '../../../data/services/catalogCore';
import type { ServiceDef } from '../../../data/services/catalogCore';
import { SERVICE_VARIABLES } from '../../../data/services/serviceVariables';
import { SERVICE_ROOTS, serviceValsFromAnswers } from '../../../data/services/serviceBranches';
import { computeQuoteContinuous, breakdownContinuous } from '../../../data/services/continuousQuote';
import { RATE_CLASSES, RATE_POSITION } from '../../../data/services/rateCard';
import type { Currency, RateClass } from '../../../data/services/types';
import { normalize } from './chatIntents';

type Val = number | string | boolean;

export interface AssistantContext {
  currency: Currency;
  /** Servicio que el cliente tiene en pantalla (wizard o configuración). */
  serviceId?: string;
  vals?: Record<string, Val>;
}

/** Sinónimos de lenguaje cliente → servicio (el nombre del catálogo también cuenta). */
const SYNONYMS: Record<string, string[]> = {
  'RND-01': ['render', 'renders', 'imagen', 'imagenes', 'foto de producto', 'fotos de producto', 'fotorrealista'],
  'RND-02': ['video', 'animacion', 'video 3d', 'video de producto', 'animacion de producto', 'segundos'],
  'RTA-01': ['modelo 3d', 'modelar', 'modelado', 'crear el modelo', 'asset'],
  'RTA-02': ['hotspots en el modelo', 'asset interactivo'],
  'RTA-03': ['modelo animado', 'loop'],
  'RTA-05': ['shader', 'shaders'],
  'CAD-01': ['cad', 'step', 'solidworks', 'inventor', 'fusion'],
  'WEB-01': ['visor', 'visor 3d', 'web 3d', 'pagina con 3d', 'web con 3d'],
  'WEB-04': ['configurador', 'web app'],
  'WEB-05': ['scrollytelling', 'scroll', 'historia'],
  'WEB-06': ['juego', 'minijuego', 'game'],
  'WEB-07': ['catalogo 3d', 'catalogo interactivo', 'tienda 3d'],
  'WEB-08': ['presentacion', 'slides', 'pitch'],
  'AI-01': ['chatbot', 'asistente', 'chat', 'bot', 'rag'],
  'AI-02': ['ia en mi producto', 'resumenes', 'clasificacion'],
  'AI-03': ['automatizar', 'automatizacion', 'flujo', 'procesos'],
  'AI-04': ['consultoria de ia', 'auditoria de ia', 'estrategia de ia'],
  'VFX-01': ['integrar en video', 'video real', 'compositing'],
  'VFX-02': ['vfx', 'efectos', 'simulacion', 'explosion', 'humo'],
  'VFX-03': ['motion graphics', 'motion', 'intro', 'redes sociales'],
  'TEX-01': ['textura', 'texturas', 'materiales pbr'],
  'PIPE-01': ['script', 'scripts', 'pipeline', 'herramienta', 'blender addon'],
  'CON-01': ['consultoria', 'asesoria', 'sesion'],
  'RET-01': ['retainer', 'soporte mensual', 'mantenimiento', 'mensual'],
};

/** Nombre para el cliente (etiqueta del wizard si existe; si no, el del catálogo). */
export const displayName = (svc: ServiceDef): string =>
  Object.values(SERVICE_ROOTS).flatMap((r) => r.options).find((o) => o.id === svc.id)?.label ?? svc.nameEs;

const fmt = (c: Currency, v: number) =>
  new Intl.NumberFormat(c === 'COP' ? 'es-CO' : 'en-US', { style: 'currency', currency: c, maximumFractionDigits: 0 }).format(v);

/** Servicio más probable mencionado en la frase (null si ninguno). */
export function detectService(input: string): ServiceDef | null {
  const q = ` ${normalize(input)} `;
  let best: { id: string; score: number } | null = null;
  for (const svc of SERVICES) {
    const terms = [...(SYNONYMS[svc.id] ?? []), normalize(svc.nameEs)];
    let score = 0;
    for (const t of terms) if (q.includes(normalize(t))) score += t.length; // frase más larga = más específica
    if (score > 0 && (!best || score > best.score)) best = { id: svc.id, score };
  }
  return best ? SERVICES.find((s) => s.id === best!.id) ?? null : null;
}

/** "5 imágenes", "30 segundos", "12 piezas" → valores de las variables numéricas del servicio. */
export function extractQuantities(serviceId: string, input: string): Record<string, number> {
  const q = normalize(input);
  const out: Record<string, number> = {};
  const vars = (SERVICE_VARIABLES[serviceId]?.variables ?? []).filter((v) => v.type === 'number');
  const re = /(\d+(?:[.,]\d+)?)\s*([a-z]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(q))) {
    const n = Number(m[1].replace(',', '.'));
    const word = m[2];
    const stem = word.replace(/(es|s)$/, '').slice(0, 5);
    const v = vars.find((x) => {
      const hay = normalize(`${x.unidadEs ?? ''} ${x.preguntaEs} ${x.id}`);
      return stem.length >= 3 && hay.includes(stem);
    });
    if (v) out[v.id] = Math.max(v.min ?? n, Math.min(v.max ?? n, n));
  }
  // Un número suelto con un servicio de UNA sola variable numérica → esa variable.
  if (Object.keys(out).length === 0 && vars.length === 1) {
    const lone = q.match(/\b(\d+)\b/);
    if (lone) out[vars[0].id] = Math.max(vars[0].min ?? 0, Math.min(vars[0].max ?? Infinity, Number(lone[1])));
  }
  return out;
}

const asks = (q: string, kw: string[]) => kw.some((k) => q.includes(k));
const PRICE_KW = ['cuanto', 'precio', 'cuesta', 'vale', 'cotiza', 'presupuesto', 'costo', 'cobras', 'tarifa'];
const INCLUDE_KW = ['incluye', 'entregable', 'recibo', 'me entregas', 'que obtengo'];
const TIME_KW = ['tarda', 'demora', 'plazo', 'tiempo', 'dias', 'cuando estaria', 'entrega'];
const WHY_KW = ['por que', 'desglose', 'de donde sale', 'como se calcula', 'explica'];
const LIST_KW = ['que servicios', 'que ofreces', 'que haces', 'catalogo', 'servicios hay', 'que puedo cotizar'];

function quoteAnswer(svc: ServiceDef, vals: Record<string, Val>, ctx: AssistantContext, given: Record<string, number>): string {
  const q = computeQuoteContinuous(svc.id, vals, ctx.currency);
  if (!q) return `No pude cotizar ${displayName(svc)}; escríbeme y lo reviso a mano.`;
  const assumed = (SERVICE_VARIABLES[svc.id]?.variables ?? [])
    .filter((v) => v.type !== 'toggle' || vals[v.id] === true)
    .map((v) => `${v.preguntaEs.replace(/^¿|\?$/g, '')}: ${vals[v.id] === true ? 'sí' : vals[v.id]}${v.unidadEs && typeof vals[v.id] === 'number' ? ` ${v.unidadEs}` : ''}${given[v.id] !== undefined ? ' (tu dato)' : ''}`);
  const dias = svc.entregaDiasEs ? `\nEntrega estimada: ${svc.entregaDiasEs[0]}–${svc.entregaDiasEs[1]} días hábiles.` : '';
  return `${displayName(svc)}: ${fmt(ctx.currency, q.totalMin)} – ${fmt(ctx.currency, q.totalMax)} ${ctx.currency} (≈ ${q.hoursPoint} h de trabajo).${dias}\n`
    + `Supuestos:\n• ${assumed.join('\n• ')}\n`
    + `Dime otra cantidad (p. ej. “con 10 …”) y recalculo, o ábrelo en el cotizador para ajustar todo.`;
}

function whyAnswer(svcId: string, vals: Record<string, Val>, ctx: AssistantContext): string {
  const lines = breakdownContinuous(svcId, vals, ctx.currency).sort((a, b) => b.cost - a.cost);
  const svc = SERVICES.find((s) => s.id === svcId)!;
  const total = lines.reduce((a, l) => a + l.cost, 0);
  const pos = RATE_POSITION[ctx.currency] === 0 ? 'en el piso del rango de mercado' : 'dentro del rango de mercado';
  const body = lines.slice(0, 6).map((l) => `• ${l.nameEs}: ${l.hours} h × ${fmt(ctx.currency, l.rate)}/h (${RATE_CLASSES[l.rateClass as RateClass].labelEs})`).join('\n');
  return `Así sale el precio de ${displayName(svc)} (punto central ≈ ${fmt(ctx.currency, ctx.currency === 'COP' ? Math.round(total / 1000) * 1000 : Math.round(total))}):\n${body}\n`
    + `Tarifas ${ctx.currency === 'COP' ? 'de contrato nacional (COP)' : 'de contrato internacional (USD)'}, ${pos}. `
    + `El rango suma ±${Math.round((computeQuoteContinuous(svcId, vals, ctx.currency)?.spreadPct ?? 15))} % por incertidumbre de alcance.`;
}

function listAnswer(): string {
  const lines = [['web-3d', 'Webs con 3D', ['WEB-01', 'WEB-04', 'WEB-05', 'WEB-06']] as const]
    .map(([, label, ids]) => `• ${label}: ${ids.map((i) => SERVICES.find((s) => s.id === i)?.nameEs).filter(Boolean).join(', ')}`);
  for (const [root, r] of Object.entries(SERVICE_ROOTS)) {
    const label = { 'video-anim': 'Video y animación', imagenes: 'Imágenes y modelos', ia: 'Inteligencia artificial', otros: 'Técnicos y soporte' }[root] ?? root;
    lines.push(`• ${label}: ${r.options.map((o) => o.label).join(', ')}`);
  }
  return `Esto es lo que puedes cotizar aquí mismo:\n${lines.join('\n')}\nPregúntame por uno con cantidades, p. ej. “¿cuánto cuesta un render de 5 imágenes?”.`;
}

/** Respuesta basada en datos reales, o null para que el widget use las intenciones generales. */
export function answerWithQuote(input: string, ctx: AssistantContext): string | null {
  const q = normalize(input);
  if (asks(q, LIST_KW)) return listAnswer();
  const svc = detectService(input) ?? (ctx.serviceId ? SERVICES.find((s) => s.id === ctx.serviceId) ?? null : null);
  if (!svc) return null;
  const mentioned = !!detectService(input);
  const given = extractQuantities(svc.id, input);
  const base = !mentioned && ctx.serviceId === svc.id && ctx.vals ? ctx.vals : serviceValsFromAnswers(svc.id, {});
  const vals = { ...base, ...given };

  if (asks(q, WHY_KW) && !asks(q, INCLUDE_KW)) return whyAnswer(svc.id, vals, ctx);
  if (asks(q, INCLUDE_KW)) {
    const inc = svc.entregablesEs.slice(0, 5).map((e) => `• ${e}`).join('\n');
    const no = svc.noIncluyeEs?.length ? `\nNo incluye: ${svc.noIncluyeEs.slice(0, 3).join('; ')}.` : '';
    return `${displayName(svc)} incluye:\n${inc}${no}`;
  }
  if (asks(q, TIME_KW) && !asks(q, PRICE_KW)) {
    return svc.entregaDiasEs
      ? `${displayName(svc)}: ${svc.entregaDiasEs[0]}–${svc.entregaDiasEs[1]} días hábiles desde el anticipo y el material completo. Con urgencia (+25 % / +50 %) se acorta según disponibilidad.`
      : `El plazo de ${svc.nameEs} se acuerda en el brief según alcance.`;
  }
  if (asks(q, PRICE_KW) || Object.keys(given).length > 0 || mentioned) return quoteAnswer(svc, vals, ctx, given);
  return null;
}
