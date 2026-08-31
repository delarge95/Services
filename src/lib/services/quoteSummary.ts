/**
 * quoteSummary.ts — Reglas comerciales transversales del cotizador.
 * Fuentes: docs/servicios/00_METODOLOGIA.md §5 (bundle), §7 (pagos), §6 (rondas)
 * y decisiones del ciclo 2.1 (docs/cotizador/05 §9.3).
 */

import type { Currency } from '../../data/services/types';
import { TRM_REFERENCIA } from '../../data/services/rateCard';

/** Descuento por agrupar servicios: 2 ⇒ −5 %, 3+ ⇒ −10 %. No acumula con urgencia. */
export function bundlePct(numServicios: number, urgencyPct: number): number {
  if (numServicios < 2 || urgencyPct > 0) return 0;
  return numServicios === 2 ? 5 : 10;
}

export type EsquemaPago = '100% anticipado' | '50/50' | '40/30/30' | 'Hitos quincenales';

/**
 * Esquema de pago por tamaño del proyecto (metodología §7). Umbrales en USD;
 * para COP se convierte con la TRM de referencia (misma calidad, otra economía).
 */
export function esquemaPago(total: number, currency: Currency): EsquemaPago {
  const usd = currency === 'COP' ? total / TRM_REFERENCIA.usdCop : total;
  if (usd <= 500) return '100% anticipado';
  if (usd <= 2000) return '50/50';
  if (usd <= 8000) return '40/30/30';
  return 'Hitos quincenales';
}

/** Rondas de ajuste: 2 incluidas por entregable; la extra se negocia por chat (~+10 %). */
export const RONDAS_NOTA = '2 rondas de ajuste incluidas · ronda adicional ≈ +10%';
