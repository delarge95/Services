// ciclo 21: mismo motor continuo que el precio mostrado (continuousQuote)
import { computeQuoteContinuous } from '../../data/services/continuousQuote';
import type { ServiceVariable } from '../../data/services/serviceVariables';
import type { Currency } from '../../data/services/types';

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
    const q = computeQuoteContinuous(serviceId, vals, currency, opts);
    if (!q) return [];
    currentTotal = q.totalPoint;
  } catch {
    return [];
  }

  const drivers: DriverInfo[] = [];
  for (const v of variables) {
    if (v.type !== 'number' || v.min === undefined || v.max === undefined || v.min >= v.max) continue;
    const cur = vals[v.id];
    if (typeof cur !== 'number' || cur <= v.min) continue;
    try {
      const qMin = computeQuoteContinuous(serviceId, { ...vals, [v.id]: v.min }, currency, opts);
      if (!qMin || qMin.totalPoint <= 0) continue;
      const pctUp = (currentTotal - qMin.totalPoint) / qMin.totalPoint;
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
