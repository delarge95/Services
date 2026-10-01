/**
 * tools.ts — Herramientas DETERMINISTAS del asistente (ciclo 26, 2026-09-30).
 *
 * Única fuente de cifras del chat, con IA o sin ella. La IA (worker-cotizador) las
 * invoca por function calling; el modo básico (quoteAssistant) las llama directo.
 * Todo sale de catalogCore / serviceVariables / rateCard / continuousQuote.
 * Entradas validadas: números acotados a [min,max], opciones fuera de catálogo
 * se rechazan con un error explícito (la IA debe preguntar en vez de adivinar).
 * Salidas JSON-serializables (viajan del worker al modelo).
 */
import { NAME_ES_DISPLAY } from '../../../data/services/i18nMore';
import { SERVICES } from '../../../data/services/catalogCore';
import { SERVICE_VARIABLES } from '../../../data/services/serviceVariables';
import { serviceValsFromAnswers, SERVICE_ROOTS } from '../../../data/services/serviceBranches';
import { computeQuoteContinuous, breakdownContinuous } from '../../../data/services/continuousQuote';
import { RATE_CLASSES, RATE_POSITION, TRM_REFERENCIA } from '../../../data/services/rateCard';
import type { Currency, RateClass } from '../../../data/services/types';
import { openQuoteAction, rootOf } from './deepLink';
import type { OpenQuoteAction } from './deepLink';

type Val = string | number | boolean;

export const LINE_LABELS: Record<string, string> = {
  'web-3d': 'Webs con 3D', 'video-anim': 'Video y animación', imagenes: 'Imágenes y modelos 3D',
  ia: 'Inteligencia artificial', otros: 'Técnicos y soporte',
};
const WEB3D_IDS = ['WEB-01', 'WEB-02', 'WEB-03', 'WEB-04', 'WEB-05', 'WEB-06', 'RTA-02', 'RTA-04', 'RTA-05', 'RTA-06'];

export const fmtMoney = (c: Currency, v: number) =>
  new Intl.NumberFormat(c === 'COP' ? 'es-CO' : 'en-US', { style: 'currency', currency: c, maximumFractionDigits: 0 }).format(v);

export const displayName = (id: string): string =>
  Object.values(SERVICE_ROOTS).flatMap((r) => r.options).find((o) => o.id === id)?.label
  ?? NAME_ES_DISPLAY[id] ?? SERVICES.find((s) => s.id === id)?.nameEs ?? id;

export function lineOf(id: string): string {
  return rootOf(id) ?? (WEB3D_IDS.includes(id) ? 'web-3d' : 'otros');
}

// ─── listar_servicios ───
export function listServices() {
  return SERVICES.map((s) => ({ id: s.id, nombre: displayName(s.id), linea: LINE_LABELS[lineOf(s.id)], descripcion: s.descripcionEs }));
}

// ─── detalles_servicio ───
export function serviceDetails(id: string) {
  const s = SERVICES.find((x) => x.id === id);
  if (!s) return { error: `Servicio desconocido: ${id}. Usa listar_servicios.` };
  return {
    id: s.id, nombre: displayName(s.id), linea: LINE_LABELS[lineOf(s.id)], descripcion: s.descripcionEs,
    entregables: s.entregablesEs, noIncluye: s.noIncluyeEs ?? [],
    entregaDiasHabiles: s.entregaDiasEs ?? null, confianzaEstimacion: s.confidence,
    variables: (SERVICE_VARIABLES[id]?.variables ?? []).map((v) => ({
      id: v.id, pregunta: v.preguntaEs, tipo: v.type, ayuda: v.ayudaEs ?? null,
      min: v.min ?? null, max: v.max ?? null, unidad: v.unidadEs ?? null,
      opciones: v.opciones?.map((o) => o.valorEs) ?? null,
    })),
    valoresPorDefecto: serviceValsFromAnswers(id, {}),
  };
}

/** Valida y normaliza valores para un servicio. Devuelve errores legibles. */
export function validateVals(id: string, vals: Record<string, unknown>): { vals: Record<string, Val>; errors: string[]; given: string[] } {
  const vars = SERVICE_VARIABLES[id]?.variables ?? [];
  const out = serviceValsFromAnswers(id, {});
  const errors: string[] = [];
  const given: string[] = [];
  for (const [k, raw] of Object.entries(vals ?? {})) {
    const v = vars.find((x) => x.id === k);
    if (!v) { errors.push(`La variable "${k}" no existe en ${id}.`); continue; }
    if (v.type === 'number') {
      const n = Number(raw);
      if (!Number.isFinite(n)) { errors.push(`"${k}" debe ser un número.`); continue; }
      const c = Math.max(v.min ?? n, Math.min(v.max ?? n, n));
      if (c !== n) errors.push(`"${k}" se ajustó a ${c} (rango ${v.min}–${v.max}).`);
      out[k] = c; given.push(k);
    } else if (v.type === 'toggle') {
      out[k] = raw === true || raw === 'true' || raw === 'sí' || raw === 'si'; given.push(k);
    } else {
      const opt = v.opciones?.find((o) => o.valorEs === raw)
        ?? v.opciones?.find((o) => o.valorEs.toLowerCase().includes(String(raw).toLowerCase()));
      if (!opt) { errors.push(`"${raw}" no es una opción de "${k}". Opciones: ${(v.opciones ?? []).map((o) => o.valorEs).join(' | ')}`); continue; }
      out[k] = opt.valorEs; given.push(k);
    }
  }
  return { vals: out, errors, given };
}

export interface QuoteToolResult {
  ok: boolean; error?: string;
  servicio?: string; nombre?: string; moneda?: Currency;
  rango?: { min: number; max: number }; rangoTexto?: string;
  horasEstimadas?: number; entregaDiasHabiles?: [number, number] | null;
  valoresUsados?: Record<string, Val>; tusDatos?: string[]; avisos?: string[];
  contrato?: string; accion?: OpenQuoteAction | null;
}

// ─── cotizar ───
export function quoteTool(id: string, vals: Record<string, unknown>, currency: Currency): QuoteToolResult {
  const s = SERVICES.find((x) => x.id === id);
  if (!s) return { ok: false, error: `Servicio desconocido: ${id}. Usa listar_servicios.` };
  const { vals: v, errors, given } = validateVals(id, vals);
  const q = computeQuoteContinuous(id, v, currency);
  if (!q) return { ok: false, error: 'No se pudo cotizar.' };
  return {
    ok: true, servicio: id, nombre: displayName(id), moneda: currency,
    rango: { min: q.totalMin, max: q.totalMax },
    rangoTexto: q.totalMax > q.totalMin ? `${fmtMoney(currency, q.totalMin)} – ${fmtMoney(currency, q.totalMax)} ${currency}` : `${fmtMoney(currency, q.totalMin)} ${currency} (proyecto mínimo)`,
    horasEstimadas: q.hoursPoint, entregaDiasHabiles: s.entregaDiasEs ?? null,
    valoresUsados: v, tusDatos: given, avisos: errors,
    contrato: currency === 'COP' ? 'Contrato nacional (Colombia), tarifas del mercado colombiano' : 'Contrato internacional, tarifas del mercado internacional',
    accion: openQuoteAction(id, Object.fromEntries(given.map((k) => [k, v[k]]))),
  };
}

// ─── explicar_precio ───
export function explainTool(id: string, vals: Record<string, unknown>, currency: Currency) {
  const s = SERVICES.find((x) => x.id === id);
  if (!s) return { error: `Servicio desconocido: ${id}.` };
  const { vals: v } = validateVals(id, vals);
  const q = computeQuoteContinuous(id, v, currency)!;
  const lines = breakdownContinuous(id, v, currency).sort((a, b) => b.cost - a.cost);
  // qué variables lo encarecen: cuánto bajaría el centro llevando cada una a su mínimo/primera opción
  const drivers = (SERVICE_VARIABLES[id]?.variables ?? []).map((x) => {
    const alt = { ...v, [x.id]: x.type === 'number' ? x.min ?? v[x.id] : x.type === 'toggle' ? false : x.opciones?.[0]?.valorEs ?? v[x.id] };
    const a = computeQuoteContinuous(id, alt, currency)!;
    const step = currency === 'COP' ? 1000 : 10; // cifras redondas, como el resto del cotizador
    return { variable: x.preguntaEs, valorActual: v[x.id], ahorroSiSeReduce: Math.round(Math.max(0, q.totalPoint - a.totalPoint) / step) * step };
  }).filter((d) => d.ahorroSiSeReduce > 0).sort((a, b) => b.ahorroSiSeReduce - a.ahorroSiSeReduce).slice(0, 3);
  return {
    nombre: displayName(id), moneda: currency, puntoCentral: q.totalPoint, bandaPct: q.spreadPct,
    tareas: lines.map((l) => ({ tarea: l.nameEs, horas: l.hours, tarifaHora: l.rate, rol: RATE_CLASSES[l.rateClass as RateClass].labelEs, costo: l.cost })),
    tarifas: `${currency === 'COP' ? 'Contrato nacional (COP)' : 'Contrato internacional (USD)'}, ${RATE_POSITION[currency] === 0 ? 'en el piso del rango de mercado' : 'dentro del rango de mercado'}`,
    queLoEncarece: drivers.map((d) => ({ ...d, ahorroTexto: `≈ ${fmtMoney(currency, d.ahorroSiSeReduce)}` })),
  };
}

export const CURRENCY_NOTE = `COP = contrato nacional (cliente en Colombia, tarifas del mercado colombiano). USD = contrato internacional (tarifas del mercado internacional). No son conversión una de otra; la TRM (${TRM_REFERENCIA.usdCop}, ${TRM_REFERENCIA.fecha}) es solo referencia.`;

/** Reglas comerciales FIJAS que el asistente puede citar (fuente: chatIntents/ProcesoFaq). */
export const BUSINESS_FACTS = [
  'Pago: 50 % de anticipo para agendar y 50 % contra entrega.',
  'Incluye 2 rondas de revisión; cambios fuera de alcance se estiman y aprueban antes.',
  'Urgencia: +25 % (pronto) o +50 % (crítico), según disponibilidad.',
  'Costos de API/servidores de IA los paga el cliente (BYOK).',
  'Respuesta a contacto en menos de 24 h.',
  'Toda cifra del cotizador es un rango orientativo, no una cotización formal.',
];
