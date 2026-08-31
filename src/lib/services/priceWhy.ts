import { computeQuote } from '../../data/services/formula';
import { derivarTier } from '../../data/services/serviceVariables';
import type { ServiceVariable } from '../../data/services/serviceVariables';
import type { Currency, LevelId } from '../../data/services/types';

type Val = number | string | boolean;

export interface QuoteOpts {
  firstClientLaunch?: boolean;
  batchUnits?: number;
  urgencyPct?: number;
}

export interface DriverInfo {
  varId: string;
  label: string;
  valueLabel: string;
  pctUp: number;
  minValue: number;
}

/**
 * Drivers de precio: cuánto aporta cada variable numérica por encima de su mínimo.
 * Solo devuelve variables que mueven el total ≥3%, ordenadas por impacto descendente.
 */
export function computePriceDrivers(
  serviceId: string,
  currency: Currency,
  opts: QuoteOpts,
  variables: ServiceVariable[],
  vals: Record<string, Val>,
): DriverInfo[] {
  let currentTotal = 0;
  try {
    const q = computeQuote(serviceId, derivarTier(serviceId, vals) as LevelId, currency, opts);
    if (!q) return [];
    currentTotal = q.totalMax;
  } catch {
    return [];
  }

  const drivers: DriverInfo[] = [];
  for (const v of variables) {
    if (v.type !== 'number' || v.min === undefined || v.max === undefined || v.min >= v.max) continue;
    const cur = vals[v.id];
    if (typeof cur !== 'number' || cur <= v.min) continue;
    try {
      const qMin = computeQuote(serviceId, derivarTier(serviceId, { ...vals, [v.id]: v.min }) as LevelId, currency, opts);
      if (!qMin || qMin.totalMax <= 0) continue;
      const pctUp = (currentTotal - qMin.totalMax) / qMin.totalMax;
      if (pctUp < 0.03) continue;
      drivers.push({
        varId: v.id,
        label: v.preguntaEs,
        valueLabel: `${cur} ${v.unidadEs ?? ''}`.trim(),
        pctUp,
        minValue: v.min,
      });
    } catch {
      continue;
    }
  }
  return drivers.sort((a, b) => b.pctUp - a.pctUp).slice(0, 5);
}
