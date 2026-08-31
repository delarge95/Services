import type { Currency, RateCardDef, RateClass } from './types';

export const RATE_CLASSES: Record<RateClass, { labelEs: string; usd: { min: number; max: number }; cop: { min: number; max: number } }> = {
  'RC-ART': { labelEs: 'Arte 3D', usd: { min: 20, max: 28 }, cop: { min: 30000, max: 42000 } },
  'RC-RTA': { labelEs: 'Asset RT', usd: { min: 25, max: 35 }, cop: { min: 38000, max: 52000 } },
  'RC-WEB': { labelEs: 'Dev Web 3D', usd: { min: 27, max: 38 }, cop: { min: 40000, max: 57000 } },
  'RC-AI': { labelEs: 'IA aplicada', usd: { min: 28, max: 40 }, cop: { min: 42000, max: 60000 } },
  'RC-CON': { labelEs: 'Consultoría', usd: { min: 40, max: 55 }, cop: { min: 60000, max: 82000 } },
};

export function getRateCard(currency: Currency): RateCardDef {
  if (currency === 'COP') {
    return {
      currency: 'COP',
      rates: {
        'RC-ART': { min: 30000, max: 42000 },
        'RC-RTA': { min: 38000, max: 52000 },
        'RC-WEB': { min: 40000, max: 57000 },
        'RC-AI': { min: 42000, max: 60000 },
        'RC-CON': { min: 60000, max: 82000 },
      },
      roundStep: () => 1000,
      minProject: 400000,
    };
  }
  return {
    currency: 'USD',
    rates: {
      'RC-ART': { min: 20, max: 28 },
      'RC-RTA': { min: 25, max: 35 },
      'RC-WEB': { min: 27, max: 38 },
      'RC-AI': { min: 28, max: 40 },
      'RC-CON': { min: 40, max: 55 },
    },
    roundStep: (v) => (v < 500 ? 10 : v <= 2000 ? 50 : 100),
    minProject: 100,
  };
}

export const LAUNCH_DISCOUNT = { pctMin: 20, pctMax: 40, defaultPct: 25, activo: true, alcanceEs: 'Primeros 5 proyectos o hasta 2026-12-31.' };

export const TRM_REFERENCIA = { usdCop: 4000, fecha: '2026-08-25' };

export const LAUNCH_PROGRAM = { id: 'primeros-clientes', activo: true, alcanceEs: 'Primeros 5 proyectos o 2026-12-31.' };
