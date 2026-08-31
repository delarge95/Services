import { describe, expect, it } from 'vitest';
import { SERVICES } from '../../../data/services/catalogCore';
import { GOALS, SERVICE_GOALS, minPriceOf, servicesForGoal } from '../../../data/services/goals';
import { SERVICE_VARIABLES, recommendedValue } from '../../../data/services/serviceVariables';
import { computePriceDrivers } from '../priceWhy';

describe('S6: objetivos → servicios', () => {
  it('cada objetivo tiene al menos 3 servicios (excepto no-se que devuelve todo)', () => {
    for (const g of GOALS) {
      const list = servicesForGoal(g.id);
      if (g.id === 'no-se') {
        expect(list.length).toBe(SERVICES.length);
      } else {
        expect(list.length, `objetivo ${g.id} con solo ${list.length} servicios`).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it('todo id mapeado en SERVICE_GOALS existe en el catálogo', () => {
    for (const [svcId] of Object.entries(SERVICE_GOALS)) {
      expect(SERVICES.some((s) => s.id === svcId), `${svcId} no existe`).toBe(true);
    }
  });

  it('minPriceOf devuelve precio positivo para servicios comerciales', () => {
    for (const id of ['RND-01', 'RTA-01', 'AI-01']) {
      const p = minPriceOf(id, 'USD');
      expect(p, `${id} sin precio desde`).toBeGreaterThan(0);
    }
  });
});

describe('S8: valores recomendados (modo no-sé)', () => {
  it('number: cae en punto medio alineado a step', () => {
    const v = SERVICE_VARIABLES['RND-01']!.variables.find((x) => x.id === 'numImagenes')!;
    expect(recommendedValue(v, '')).toBe(11); // midpoint de 1..20 con step 1
  });

  it('respeta override recommendedFor por goal y default', () => {
    const v = SERVICE_VARIABLES['RND-01']!.variables.find((x) => x.id === 'numImagenes')!;
    const withRec = { ...v, recommendedFor: { 'imagenes-producto': 4, default: 2 } };
    expect(recommendedValue(withRec, 'imagenes-producto')).toBe(4);
    expect(recommendedValue(withRec, 'video-redes')).toBe(2);
  });

  it('toggle: recomendado es false; select: primera opción', () => {
    const tgl = SERVICE_VARIABLES['RND-01']!.variables.find((x) => x.type === 'toggle');
    if (tgl) expect(recommendedValue(tgl, '')).toBe(false);
    const sel = Object.values(SERVICE_VARIABLES)
      .flatMap((c) => c.variables)
      .find((x) => x.type === 'select' && (x.opciones?.length ?? 0) > 0);
    if (sel) expect(recommendedValue(sel, '')).toBe(sel.opciones![0].valorEs);
  });
});

describe('S10: drivers de precio', () => {
  it('subir numImagenes genera driver positivo; orden descendente; ≥3% umbral', () => {
    const cfg = SERVICE_VARIABLES['RND-01']!;
    const vals = { numImagenes: 12 } as Record<string, number | string | boolean>;
    const drivers = computePriceDrivers('RND-01', 'USD', {}, cfg.variables, vals);
    expect(Array.isArray(drivers)).toBe(true);
    for (let i = 1; i < drivers.length; i++) {
      expect(drivers[i - 1].pctUp).toBeGreaterThanOrEqual(drivers[i].pctUp);
    }
    for (const d of drivers) expect(d.pctUp).toBeGreaterThanOrEqual(0.03);
    const imgDriver = drivers.find((d) => d.varId === 'numImagenes');
    expect(imgDriver).toBeDefined();
    expect(imgDriver!.valueLabel).toContain('12');
  });

  it('con variables al mínimo no hay drivers', () => {
    const cfg = SERVICE_VARIABLES['RND-01']!;
    const mins: Record<string, number | string | boolean> = {};
    for (const v of cfg.variables) {
      if (v.type === 'number' && v.min !== undefined) mins[v.id] = v.min;
      if (v.type === 'toggle') mins[v.id] = false;
      if (v.type === 'select' && v.opciones?.length) mins[v.id] = v.opciones[0].valorEs;
    }
    expect(computePriceDrivers('RND-01', 'USD', {}, cfg.variables, mins)).toEqual([]);
  });
});
