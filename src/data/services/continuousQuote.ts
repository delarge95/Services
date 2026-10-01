/**
 * continuousQuote.ts — Cotización CONTINUA (ciclo 21, Misión Control 2026-09-30).
 *
 * Problema que resuelve (auditoría DESPACHO-11 L-A1):
 * - `derivarTier` convierte las variables en una talla DISCRETA tomando el MÁXIMO:
 *   la variable dominante tapa a las demás y, dentro de una talla, mover un slider
 *   no cambia nada.
 * - `computeQuote` multiplica horas-min × tarifa-min y horas-max × tarifa-max:
 *   dos incertidumbres compuestas → rangos de ~2.1× (p.ej. 400k–855k COP).
 *
 * Modelo continuo (misma fuente de datos: catalogCore + rateCard + SERVICE_VARIABLES,
 * es decir, las mismas cifras del Excel `verificacion-cotizacion/cotizador-padre-final.xlsx`):
 * 1. Cada variable → posición continua p ∈ [0,4] (0=XS … 4=XL) interpolando dentro
 *    de su `tierMap` (escala log si el rango es amplio: polígonos, piezas).
 * 2. Posición del proyecto P = BLEND_MAX·max(p) + (1−BLEND_MAX)·media(p).
 *    Monótona y continua en cada variable: TODO slider mueve el precio.
 * 3. Horas por subtarea = punto medio del rango de la talla, interpolado entre
 *    tallas vecinas en P.
 * 4. Precio central = Σ horas × tarifa media de su rol. Banda = ± SPREAD según la
 *    confianza del servicio (explicit/inferred/qualitative).
 *
 * `computeQuote` y `derivarTier` NO se tocan (Regla de Oro): TierGallery y los
 * tests existentes siguen usando el modelo discreto.
 */
import type { Currency, LevelId, QuoteResult, RateClass } from './types';
import { getRateCard, LAUNCH_DISCOUNT, quotedRate } from './rateCard';
import { SERVICES } from './catalogCore';
import type { ServiceDef } from './catalogCore';
import { SERVICE_VARIABLES } from './serviceVariables';

export const LEVELS: LevelId[] = ['XS', 'S', 'M', 'L', 'XL'];

/** Peso del máximo en la mezcla (1 = comportamiento discreto actual; 0 = media pura).
 *  Solo se usa si `CALIBRATION.mix === 'blend'` (modelo original de 5acbd97). */
export let BLEND_MAX = 0.3; // ciclo 23: 0.7→0.3 (tabla en scripts/calibrate-cotizador.mts)
export const __setBlendForCalibration = (b: number) => { BLEND_MAX = b; };

/**
 * Calibración (ciclo 22, 2026-09-30) contra `cotizador-padre-final.xlsx`:
 * en el Excel las horas por talla crecen ~×2,2 por nivel (RTA-01: S 6–13 h,
 * M 14–30, L 30–66, XL 66–163). Interpolar LINEALMENTE entre tallas hacía que el
 * mismo paso de slider valiera +3 % en una talla y +40 % en la siguiente.
 * `geometric` interpola en log-horas: cada paso de posición vale el mismo % dentro
 * de un tramo, y en las posiciones enteras reproduce EXACTAMENTE el punto medio
 * del Excel. `linear` se conserva para comparar (modelo de 5acbd97).
 */
export const HOURS_INTERP: 'linear' | 'geometric' = 'geometric';

/** Semiancho de la banda por confianza del servicio (±%). */
export const SPREAD_BY_CONFIDENCE: Record<ServiceDef['confidence'], number> = {
  explicit: 0.1,
  inferred: 0.15,
  qualitative: 0.2,
};

type Vals = Record<string, number | string | boolean | undefined | null>;

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

/** Posición continua de UNA variable numérica con tierMap. */
export function numericPosition(
  value: number,
  cfg: { min?: number; max?: number; tierMap: { maxVal: number; tier: LevelId }[] },
): number {
  const tm = cfg.tierMap;
  const lo0 = cfg.min ?? 0;
  const useLog = lo0 > 0 && (cfg.max ?? tm[tm.length - 1].maxVal) / lo0 > 20;
  const f = (x: number) => (useLog ? Math.log(Math.max(x, 1e-9)) : x);
  let bandStart = lo0;
  for (let i = 0; i < tm.length; i++) {
    const { maxVal, tier } = tm[i];
    const idx = LEVELS.indexOf(tier);
    if (value <= maxVal || i === tm.length - 1) {
      const end = i === tm.length - 1 ? Math.max(maxVal, cfg.max ?? maxVal) : maxVal;
      const span = f(end) - f(bandStart);
      const frac = span > 0 ? clamp((f(clamp(value, bandStart, end)) - f(bandStart)) / span, 0, 1) : 0.5;
      // Extremos: XS ocupa [0, 0.5] y XL [3.5, 4] para que no haya zona muerta
      // (antes superficie 4,5→5 no movía el precio por el clamp a 4).
      const lo = idx === 0 ? 0 : idx - 0.5;
      const hi = idx === 4 ? 4 : idx + 0.5;
      return lo + (hi - lo) * frac;
    }
    bandStart = maxVal;
  }
  return 2;
}

/** Posición continua del proyecto P ∈ [0,4] a partir de las variables asignadas. */
export function derivarPosicion(serviceId: string, vals: Vals): number {
  const config = SERVICE_VARIABLES[serviceId];
  if (!config) return 2;
  const ps: number[] = [];
  for (const v of config.variables) {
    const val = vals[v.id];
    if (val === undefined || val === null) continue;
    if (v.type === 'number' && v.tierMap?.length) {
      ps.push(numericPosition(Number(val), { min: v.min, max: v.max, tierMap: v.tierMap as { maxVal: number; tier: LevelId }[] }));
    } else if (v.type === 'select' && typeof val === 'string') {
      const hint = v.opciones?.find((o) => o.valorEs === val)?.tierHint;
      if (hint) ps.push(LEVELS.indexOf(hint as LevelId));
    } else if (v.type === 'toggle' && v.tierSiActivo && val === true) {
      ps.push(LEVELS.indexOf(v.tierSiActivo as LevelId));
    }
  }
  if (ps.length === 0) return 0; // coherente con derivarTier (sin datos → XS)
  const max = Math.max(...ps);
  const mean = ps.reduce((a, b) => a + b, 0) / ps.length;
  return clamp(BLEND_MAX * max + (1 - BLEND_MAX) * mean, 0, 4);
}

/** Horas centrales de una subtarea en posición P (tallas sin horas → talla soportada más cercana). */
function midHoursAt(hours: ServiceDef['subtasks'][number]['hours'], p: number): number {
  const mid = (lv: LevelId) => { const r = hours[lv]; return r ? (r.min + r.max) / 2 : 0; };
  const i0 = Math.floor(p), i1 = Math.min(4, i0 + 1), t = p - i0;
  const a = mid(LEVELS[i0]), b = mid(LEVELS[i1]);
  if (HOURS_INTERP === 'geometric' && a > 0 && b > 0) return a * Math.pow(b / a, t);
  return a * (1 - t) + b * t;
}

/** El servicio no ofrece tallas con 0 h (p.ej. `noXs`): se sube P hasta la mínima soportada. */
function minSupportedPosition(svc: ServiceDef): number {
  for (let i = 0; i < LEVELS.length; i++) {
    const h = svc.subtasks.reduce((a, st) => a + (st.optional ? 0 : st.hours[LEVELS[i]]?.min ?? 0), 0);
    if (h > 0) return i;
  }
  return 0;
}

export interface ContinuousQuote extends QuoteResult {
  /** Posición continua usada (0=XS … 4=XL). */
  position: number;
  /** Horas y precio centrales (antes de redondeo de banda). */
  hoursPoint: number;
  totalPoint: number;
  spreadPct: number;
}

export function computeQuoteContinuous(
  serviceId: string,
  vals: Vals,
  currency: Currency,
  opts: { firstClientLaunch?: boolean; recurringClient?: boolean; batchUnits?: number; launchPct?: number; urgencyPct?: number } = {},
): ContinuousQuote | null {
  const svc = SERVICES.find((s) => s.id === serviceId);
  if (!svc) return null;
  return quoteAtPosition(svc, Math.max(derivarPosicion(serviceId, vals), minSupportedPosition(svc)), currency, opts);
}

type QuoteOpts = Parameters<typeof computeQuoteContinuous>[3];

/**
 * Cotización continua en una talla FIJA (posición entera). Para las vistas que
 * muestran precios por talla (TierGallery) o "desde" (goals.minPriceOf), de modo que
 * usen el MISMO motor y la misma banda que el precio principal. En posiciones enteras
 * con interpolación geométrica el punto central = punto medio del Excel.
 * Devuelve null si el servicio no ofrece esa talla (0 h).
 */
export function computeQuoteAtLevel(serviceId: string, level: LevelId, currency: Currency, opts: QuoteOpts = {}): ContinuousQuote | null {
  const svc = SERVICES.find((s) => s.id === serviceId);
  if (!svc) return null;
  const idx = LEVELS.indexOf(level);
  if (idx < minSupportedPosition(svc)) return null;
  return quoteAtPosition(svc, idx, currency, opts);
}

/** Precio "desde": talla mínima soportada, sin descuentos. */
export function minContinuousPrice(serviceId: string, currency: Currency): number | null {
  const svc = SERVICES.find((s) => s.id === serviceId);
  if (!svc) return null;
  const q = quoteAtPosition(svc, minSupportedPosition(svc), currency, {});
  return q.totalMin > 0 ? q.totalMin : null;
}

function quoteAtPosition(svc: ServiceDef, p: number, currency: Currency, opts: NonNullable<QuoteOpts>): ContinuousQuote {
  const card = getRateCard(currency);

  let hours = 0, raw = 0;
  for (const st of svc.subtasks) {
    if (st.optional) continue;
    const rate = card.rates[st.rateClass as RateClass];
    if (!rate) continue;
    const h = midHoursAt(st.hours, p);
    hours += h;
    raw += h * quotedRate(st.rateClass as RateClass, currency); // piso→techo según RATE_POSITION
  }

  let pct = 0;
  if (opts.firstClientLaunch && LAUNCH_DISCOUNT.activo) pct -= opts.launchPct ?? LAUNCH_DISCOUNT.defaultPct;
  if (opts.recurringClient) pct -= 5;
  if (opts.batchUnits && opts.batchUnits > 1) pct -= 15;
  if (opts.urgencyPct && opts.urgencyPct > 0) pct += opts.urgencyPct;
  const factor = 1 + pct / 100;

  const s = SPREAD_BY_CONFIDENCE[svc.confidence] ?? 0.15;
  const step = card.roundStep(raw);
  const point = raw * factor;
  const totalMin = Math.max(Math.floor((point * (1 - s)) / step) * step, card.minProject);
  const totalMax = Math.max(Math.ceil((point * (1 + s)) / step) * step, totalMin);

  return {
    serviceId: svc.id, serviceName: svc.nameEs,
    level: LEVELS[Math.round(p)], currency,
    hoursMin: Math.round(hours * (1 - s) * 10) / 10,
    hoursMax: Math.round(hours * (1 + s) * 10) / 10,
    subtotalMin: Math.floor((raw * (1 - s)) / step) * step,
    subtotalMax: Math.ceil((raw * (1 + s)) / step) * step,
    discountPct: pct, totalMin, totalMax,
    entregaDias: svc.entregaDiasEs,
    entregables: svc.entregablesEs ?? [],
    noIncluye: svc.noIncluyeEs ?? [],
    notesEs: [`Estimación central ±${Math.round(s * 100)} % (confianza ${svc.confidence}). Rango orientativo, no cotización.`],
    position: Math.round(p * 100) / 100,
    hoursPoint: Math.round(hours * 10) / 10,
    totalPoint: Math.round(point),
    spreadPct: Math.round(s * 100),
  };
}
