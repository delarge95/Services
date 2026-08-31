import type { Currency, LevelId, QuoteResult, RateClass } from './types';
import { getRateCard, LAUNCH_DISCOUNT } from './rateCard';
import { SERVICES } from './catalogCore';
import type { ServiceDef } from './catalogCore';

function floorTo(v: number, step: number) { return Math.floor(v / step) * step; }
function ceilTo(v: number, step: number) { return Math.ceil(v / step) * step; }

export function getServiceById(id: string): ServiceDef | undefined {
  return SERVICES.find((s) => s.id === id);
}

export function computeQuote(
  serviceId: string,
  level: LevelId,
  currency: Currency,
  opts: { firstClientLaunch?: boolean; recurringClient?: boolean; batchUnits?: number; launchPct?: number; urgencyPct?: number } = {},
): QuoteResult | null {
  const svc = SERVICES.find((s) => s.id === serviceId);
  if (!svc) return null;

  const card = getRateCard(currency);
  let hMin = 0, hMax = 0, rawMin = 0, rawMax = 0;

  // Si el servicio no soporta el nivel pedido (ej: noXs => XS con 0h),
  // escalar al nivel minimo soportado para que el precio nunca sea 0.
  const LEVEL_ORDER: LevelId[] = ['XS', 'S', 'M', 'L', 'XL'];
  let effLevel: LevelId = level;
  const totalHoursAt = (lv: LevelId): number =>
    svc.subtasks.reduce((acc, st) => {
      if (st.optional) return acc;
      const r = st.hours[lv];
      return acc + (r ? r.min : 0);
    }, 0);
  if (totalHoursAt(effLevel) === 0) {
    let i = LEVEL_ORDER.indexOf(effLevel);
    while (i < LEVEL_ORDER.length - 1 && totalHoursAt(LEVEL_ORDER[i]) === 0) i++;
    if (totalHoursAt(LEVEL_ORDER[i]) === 0) {
      let j = LEVEL_ORDER.indexOf(effLevel);
      while (j > 0 && totalHoursAt(LEVEL_ORDER[j]) === 0) j--;
      effLevel = LEVEL_ORDER[j];
    } else {
      effLevel = LEVEL_ORDER[i];
    }
  }

  for (const st of svc.subtasks) {
    if (st.optional) continue;
    const range = st.hours[effLevel];
    if (!range) continue;
    const rate = card.rates[st.rateClass as RateClass];
    if (!rate) continue;
    hMin += range.min;
    hMax += range.max;
    rawMin += range.min * rate.min;
    rawMax += range.max * rate.max;
  }

  const notes: string[] = ['Rango orientativo, no cotizacion.'];
  const step = card.roundStep(rawMin);
  const subtotalMin = floorTo(rawMin, step);
  const subtotalMax = ceilTo(rawMax, step);

  let pct = 0;
  if (opts.firstClientLaunch && LAUNCH_DISCOUNT.activo) {
    pct -= opts.launchPct ?? LAUNCH_DISCOUNT.defaultPct;
  }
  if (opts.recurringClient) pct -= 5;
  if (opts.batchUnits && opts.batchUnits > 1) pct -= 15;
  if (opts.urgencyPct && opts.urgencyPct > 0) pct += opts.urgencyPct;

  const factor = 1 + pct / 100;
  const totalMin = Math.max(floorTo(subtotalMin * factor, step), card.minProject);
  const totalMax = Math.max(ceilTo(subtotalMax * factor, step), totalMin);

  return {
    serviceId: svc.id, serviceName: svc.nameEs, level, currency,
    hoursMin: hMin, hoursMax: hMax,
    subtotalMin, subtotalMax, discountPct: pct,
    totalMin, totalMax,
    entregaDias: svc.entregaDiasEs,
    entregables: svc.entregablesEs ?? [],
    notesEs: notes,
    noIncluye: svc.noIncluyeEs ?? [],
  };
}

export { LAUNCH_DISCOUNT, SERVICES, getRateCard };
