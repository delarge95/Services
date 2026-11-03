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

/** Recargo por urgencia (metodología: «Rush +30 %»). ÚNICA fuente: cotizador, vista directa, chat y PDF leen de aquí. */
export const URGENCY_PCT = { pronto: 30, critico: 50 } as const;

/** Umbrales (USD) del esquema de pago: ≤1.º anticipado · ≤2.º 50/50 · ≤3.º 40/30/30 · más, hitos. */
export const PAGO_UMBRALES_USD = [500, 2000, 8000] as const;

export type EsquemaPago = '100% anticipado' | '50/50' | '40/30/30' | 'Hitos quincenales';

/**
 * Esquema de pago por tamaño del proyecto (metodología §7). Umbrales en USD;
 * para COP se convierte con la TRM de referencia (misma calidad, otra economía).
 */
export function esquemaPago(total: number, currency: Currency): EsquemaPago {
  const usd = currency === 'COP' ? total / TRM_REFERENCIA.usdCop : total;
  if (usd <= PAGO_UMBRALES_USD[0]) return '100% anticipado';
  if (usd <= PAGO_UMBRALES_USD[1]) return '50/50';
  if (usd <= PAGO_UMBRALES_USD[2]) return '40/30/30';
  return 'Hitos quincenales';
}

/** Rondas de ajuste: 2 incluidas por entregable; la extra se negocia por chat (~+10 %). */
export const RONDAS_NOTA = '2 rondas de ajuste incluidas · ronda adicional ≈ +10%';

/** Textos de apoyo para el chat (mismos números que usa el cotizador). */
export const urgenciaTexto = (en: boolean) => en
  ? `"Soon" +${URGENCY_PCT.pronto}% and "Critical" +${URGENCY_PCT.critico}%`
  : `“Pronto” +${URGENCY_PCT.pronto}% y “Crítico” +${URGENCY_PCT.critico}%`;

const cop = (usd: number) => `${(Math.round((usd * TRM_REFERENCIA.usdCop) / 100_000) / 10).toLocaleString('es-CO')} M`;
/** `montos = false` para el prompt de la IA: el verificador del worker descarta respuestas con importes que no vengan de sus herramientas, así que esa versión no lleva cifras de dinero. */
export const pagoTexto = (en: boolean, montos = true) => !montos
  ? (en
    ? 'Payment depends on the project size: small projects 100% upfront; medium ones 50% deposit and 50% on delivery; large ones 40/30/30; very large ones biweekly milestones.'
    : 'El pago depende del tamaño del proyecto: los pequeños, 100% anticipado; los medianos, 50% de anticipo y 50% contra entrega; los grandes, 40/30/30; los muy grandes, hitos quincenales.')
  : en ? `Payment depends on the amount: up to USD ${PAGO_UMBRALES_USD[0]} 100% upfront; up to USD ${PAGO_UMBRALES_USD[1].toLocaleString('en-US')}, 50% deposit and 50% on delivery; up to USD ${PAGO_UMBRALES_USD[2].toLocaleString('en-US')}, 40/30/30; above that, biweekly milestones (COP is converted with the reference TRM).`
  : `El pago depende del monto: hasta USD ${PAGO_UMBRALES_USD[0]} (≈ COP ${cop(PAGO_UMBRALES_USD[0])}) 100% anticipado; hasta USD ${PAGO_UMBRALES_USD[1].toLocaleString('es-CO')} (≈ COP ${cop(PAGO_UMBRALES_USD[1])}), 50% de anticipo y 50% contra entrega; hasta USD ${PAGO_UMBRALES_USD[2].toLocaleString('es-CO')}, 40/30/30; más, hitos quincenales (en COP se convierte con la TRM de referencia).`;
