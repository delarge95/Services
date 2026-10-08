import type { Currency, RateCardDef, RateClass } from './types';

/**
 * Tarjeta de tarifas — contraste de mercado 2026-09-30 (Misión Control, ciclo 23).
 *
 * Dos mercados distintos, NO una conversión por TRM:
 * - COP = contrato NACIONAL (cliente en Colombia, factura en pesos). Referencia: tarifas
 *   freelance Colombia 2026 — junior 30–50 k, intermedio 50–80 k, front-end 50–100 k,
 *   back-end 60–120 k, senior 80–150 k COP/h (danielzarate.com/blog/cuanto-cuesta-
 *   desarrollador-web-freelance, 2026); modelador 3D local 40–60 k (benchmark previo del
 *   Excel, hoja Tarifas).
 * - USD = contrato INTERNACIONAL (cliente fuera, factura en dólares). Referencia Upwork
 *   (consultado 2026-09-30): WebGL 20–44, three.js mid-senior 75–150; modelador 3D 17–30,
 *   artista 3D 25–40, asset game-ready 30–45; consultor/ingeniero de automatización IA
 *   35–60, experimentado 100+ USD/h (upwork.com/hire/{webgl-developers,3d-modelers,
 *   3d-artists,ai-automation-engineers,ai-consultants}).
 *
 * `min`/`max` = rango de MERCADO. Lo que se cotiza lo decide `RATE_POSITION`
 * (0 = piso del rango, 1 = techo): hoy en el piso, hasta tener portafolio y
 * recomendaciones; subirlo es la palanca para ir al techo sin tocar el rango.
 */
export const RATE_CLASSES: Record<RateClass, { labelEs: string; usd: { min: number; max: number }; cop: { min: number; max: number } }> = {
  'RC-ART': { labelEs: 'Arte 3D', usd: { min: 25, max: 40 }, cop: { min: 40000, max: 60000 } },
  'RC-RTA': { labelEs: 'Asset RT', usd: { min: 30, max: 45 }, cop: { min: 45000, max: 70000 } },
  'RC-WEB': { labelEs: 'Dev Web 3D', usd: { min: 30, max: 60 }, cop: { min: 50000, max: 100000 } },
  'RC-AI': { labelEs: 'IA aplicada', usd: { min: 35, max: 60 }, cop: { min: 60000, max: 120000 } },
  'RC-CON': { labelEs: 'Consultoría', usd: { min: 50, max: 100 }, cop: { min: 80000, max: 150000 } },
};

/** Posición dentro del rango de mercado (0 = piso, 1 = techo). Ver nota arriba. */
export const RATE_POSITION: Record<Currency, number> = { COP: 0, USD: 0 };

/** Tarifas anteriores (2026-08-25), conservadas para trazabilidad y comparación. */
export const RATE_CARD_2026_08: Record<RateClass, { usd: { min: number; max: number }; cop: { min: number; max: number } }> = {
  'RC-ART': { usd: { min: 20, max: 28 }, cop: { min: 30000, max: 42000 } },
  'RC-RTA': { usd: { min: 25, max: 35 }, cop: { min: 38000, max: 52000 } },
  'RC-WEB': { usd: { min: 27, max: 38 }, cop: { min: 40000, max: 57000 } },
  'RC-AI': { usd: { min: 28, max: 40 }, cop: { min: 42000, max: 60000 } },
  'RC-CON': { usd: { min: 40, max: 55 }, cop: { min: 60000, max: 82000 } },
};

/** Tarifa que se cotiza: interpolada en el rango de mercado según RATE_POSITION. */
export function quotedRate(rc: RateClass, currency: Currency): number {
  const r = RATE_CLASSES[rc][currency === 'COP' ? 'cop' : 'usd'];
  return r.min + (r.max - r.min) * RATE_POSITION[currency];
}

export function getRateCard(currency: Currency): RateCardDef {
  const key = currency === 'COP' ? 'cop' : 'usd';
  const rates = Object.fromEntries(
    (Object.keys(RATE_CLASSES) as RateClass[]).map((rc) => [rc, { ...RATE_CLASSES[rc][key] }]),
  ) as RateCardDef['rates'];
  if (currency === 'COP') {
    return { currency: 'COP', rates, roundStep: () => 1000, minProject: 50000 };   // ciclo 44c: trabajos desde COP 50.000 (XS)
  }
  return {
    currency: 'USD',
    rates,
    roundStep: (v) => (v < 500 ? 10 : v <= 2000 ? 50 : 100),
    // Mínimo internacional: ~1 día de trabajo al piso del mercado (no 400 k COP / TRM).
    minProject: 15,   // ciclo 44c: ≈ COP 50.000 a la TRM de referencia
  };
}

export const LAUNCH_DISCOUNT = { pctMin: 20, pctMax: 40, defaultPct: 25, activo: true, alcanceEs: 'Primeros 5 proyectos o hasta 2026-12-31.' };

/** TRM oficial (Banco de la República vía dolar.wilkinsonpc.com.co/2026-09-30). Solo para
 *  equivalencias informativas: los precios USD NO se derivan de la TRM (mercado propio). */
export const TRM_REFERENCIA = { usdCop: 3341.23, fecha: '2026-09-30' };

export const LAUNCH_PROGRAM = { id: 'primeros-clientes', activo: true, alcanceEs: 'Primeros 5 proyectos o 2026-12-31.' };
