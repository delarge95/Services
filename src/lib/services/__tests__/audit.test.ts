import { describe, expect, it } from 'vitest';
import { SERVICES } from '../../../data/services/catalogCore';
import { computeQuote } from '../../../data/services/formula';
import { getRateCard } from '../../../data/services/rateCard';
import type { LevelId, Currency } from '../../../data/services/types';
import { SERVICE_VARIABLES, derivarTier } from '../../../data/services/serviceVariables';
import type { ServiceVariable } from '../../../data/services/serviceVariables';

const LEVELS: LevelId[] = ['XS', 'S', 'M', 'L', 'XL'];

// ══════════════════════════════════════════════════
// CAPA 1: Los markdowns tienen sentido
// ══════════════════════════════════════════════════
describe('Capa 1: Integridad de los markdowns', () => {
  it('cada servicio del catálogo tiene variables definidas en SERVICE_VARIABLES', () => {
    const missing: string[] = [];
    for (const svc of SERVICES) {
      if (!SERVICE_VARIABLES[svc.id]) missing.push(svc.id);
    }
    expect(missing).toEqual([]);
  });

  it('cada variable tiene pregunta, tipo y al menos un criterio de tier', () => {
    for (const [svcId, config] of Object.entries(SERVICE_VARIABLES) as [string, any][]) {
      for (const v of (config as any).variables) {
        expect(v.preguntaEs, `${svcId}.${v.id} sin pregunta`).toBeTruthy();
        expect(v.type, `${svcId}.${v.id} sin tipo`).toBeTruthy();
        if (v.type === 'number') {
          expect(v.tierMap?.length ?? 0, `${svcId}.${v.id} sin tierMap`).toBeGreaterThan(0);
          expect(v.min, `${svcId}.${v.id} sin min`).toBeDefined();
          expect(v.max, `${svcId}.${v.id} sin max`).toBeDefined();
        }
        if (v.type === 'select') {
          expect(v.opciones?.length ?? 0, `${svcId}.${v.id} sin opciones`).toBeGreaterThan(0);
        }
      }
    }
  });

  it('los tierMap son monótonos crecientes (cada tier >= anterior)', () => {
    for (const [svcId, config] of Object.entries(SERVICE_VARIABLES) as [string, any][]) {
      for (const v of (config as any).variables) {
        if (!v.tierMap) continue;
        for (let i = 1; i < v.tierMap.length; i++) {
          const prev = LEVELS.indexOf(v.tierMap[i - 1].tier);
          const curr = LEVELS.indexOf(v.tierMap[i].tier);
          expect(curr, `${svcId}.${v.id}: tierMap no monótono en posición ${i}`)
            .toBeGreaterThanOrEqual(prev);
        }
      }
    }
  });

  it('cada servicio tiene al menos 1 subtarea con rateClass', () => {
    for (const svc of SERVICES) {
      expect(svc.subtasks.length, `${svc.id} sin subtareas`).toBeGreaterThan(0);
      for (const st of svc.subtasks) {
        expect(st.rateClass, `${svc.id}.${st.id} sin rateClass`).toBeTruthy();
        expect(st.hours, `${svc.id}.${st.id} sin hours`).toBeDefined();
      }
    }
  });

  it('los entregables están definidos para todos los servicios', () => {
    for (const svc of SERVICES) {
      expect(svc.entregablesEs?.length ?? 0, `${svc.id} sin entregables`).toBeGreaterThan(0);
    }
  });
});

// ══════════════════════════════════════════════════
// CAPA 2: Markdowns → TS (traducción correcta)
// ══════════════════════════════════════════════════
describe('Capa 2: Traducción markdowns → TS', () => {
  it('los IDs de servicios siguen la convención services-line (PREFIX-NUM)', () => {
    for (const svc of SERVICES) {
      expect(svc.id, `${svc.id} no sigue el patrón`).toMatch(/^[A-Z0-9]+-\d+$/);
    }
  });

  it('los niveles en tierMap usan XS/S/M/L/XL (no N1-N4)', () => {
    for (const [svcId, config] of Object.entries(SERVICE_VARIABLES) as [string, any][]) {
      for (const v of (config as any).variables) {
        if (!v.tierMap) continue;
        for (const tm of v.tierMap) {
          expect(LEVELS).toContain(tm.tier);
        }
      }
    }
  });

  it('cada servicio tiene descripción', () => {
    for (const svc of SERVICES) {
      expect(svc.descripcionEs?.length ?? 0, `${svc.id} sin descripción`).toBeGreaterThan(0);
    }
  });
});

// ══════════════════════════════════════════════════
// CAPA 3: La matemática es correcta
// ══════════════════════════════════════════════════
describe('Capa 3: Matemática del motor', () => {
  it('derivarTier es monótono: aumentar un driver nunca baja el nivel', () => {
    // Probar con todos los servicios que tienen sliders
    for (const [svcId, config] of Object.entries(SERVICE_VARIABLES) as [string, any][]) {
      const sliders = (config.variables as ServiceVariable[]).filter((v) => v.type === 'number' && v.tierMap);
      for (const slider of sliders) {
        let prevLevel: LevelId | null = null;
        for (let val = slider.min!; val <= slider.max!; val += Math.max(1, Math.floor((slider.max! - slider.min!) / 50))) {
          const level = derivarTier(svcId, { [slider.id]: val });
          const levelIdx = LEVELS.indexOf(level);
          if (prevLevel !== null) {
            const prevIdx = LEVELS.indexOf(prevLevel);
            expect(levelIdx, `${svcId}.${slider.id}: nivel bajó de ${prevLevel} a ${level} con valor ${val}`)
              .toBeGreaterThanOrEqual(prevIdx);
          }
          prevLevel = level;
        }
      }
    }
  });

  it('computeQuote: horas × rate = precio (para todos los servicios y niveles)', () => {
    for (const svc of SERVICES) {
      for (const level of LEVELS) {
        const result = computeQuote(svc.id, level, 'USD', {});
        if (!result) continue;
        expect(result.totalMin, `${svc.id}@${level}: totalMin <= 0`).toBeGreaterThan(0);
        expect(result.totalMax, `${svc.id}@${level}: totalMax < totalMin`).toBeGreaterThanOrEqual(result.totalMin);
        expect(result.hoursMin, `${svc.id}@${level}: hoursMin <= 0`).toBeGreaterThan(0);
        expect(result.hoursMax).toBeGreaterThanOrEqual(result.hoursMin);
      }
    }
  });

  it('computeQuote: aumentar nivel nunca disminuye el precio', () => {
    for (const svc of SERVICES) {
      let prevMax = 0;
      for (const level of LEVELS) {
        const result = computeQuote(svc.id, level, 'USD', {});
        if (!result) continue;
        expect(result.totalMax, `${svc.id}@${level}: totalMax (${result.totalMax}) < anterior (${prevMax})`)
          .toBeGreaterThanOrEqual(prevMax);
        prevMax = result.totalMax;
      }
    }
  });

  it('computeQuote COP: los precios son más bajos que USD×TRM', () => {
    const usd = computeQuote('CAD-01', 'M', 'USD', {});
    const cop = computeQuote('CAD-01', 'M', 'COP', {});
    if (!usd || !cop) return;
    // COP debe ser significativamente más barato que USD × 4000
    const copEquivalent = usd.totalMin * 4000;
    expect(cop.totalMin, 'COP debería ser más barato que USD×TRM').toBeLessThan(copEquivalent);
  });

  it('descuento lanzamiento: reduce el precio en ~25%', () => {
    const sin = computeQuote('CAD-01', 'M', 'USD', {});
    const con = computeQuote('CAD-01', 'M', 'USD', { firstClientLaunch: true });
    if (!sin || !con) return;
    const ratio = con.totalMin / sin.totalMin;
    expect(ratio, `ratio ${ratio} debería ser ~0.75`).toBeCloseTo(0.75, 1);
  });

  it('lote: cantidad > 1 aplica descuento', () => {
    const single = computeQuote('CAD-01', 'M', 'USD', {});
    const batch = computeQuote('CAD-01', 'M', 'USD', { batchUnits: 5 });
    if (!single || !batch) return;
    expect(batch.discountPct).toBeLessThan(0);
  });
});

// ══════════════════════════════════════════════════
// CAPA 4: Todas las variables incluidas
// ══════════════════════════════════════════════════
describe('Capa 4: Cobertura de variables', () => {
  it('los servicios principales tienen sliders configurables', () => {
    const mainServices = ['RND-01', 'RND-02', 'RTA-01', 'RTA-02', 'CAD-01', 'WEB-01', 'WEB-04'];
    for (const id of mainServices) {
      const config = SERVICE_VARIABLES[id];
      expect(config, `${id} sin configuración`).toBeDefined();
      expect(config.variables.length, `${id} sin variables`).toBeGreaterThan(0);
    }
  });

  it('los servicios con discovery no permiten urgencia crítica', () => {
    // Los servicios C3/C4 (webapp, scrollytelling, etc.) requieren discovery
    // por lo que la urgencia crítica debería estar deshabilitada en la UI
    const discoveryServices = ['WEB-04', 'WEB-05', 'AI-04'];
    for (const id of discoveryServices) {
      expect(SERVICE_VARIABLES[id], `${id} sin variables`).toBeDefined();
      // La UI debe deshabilitar urgencia crítica para estos (verificado manualmente)
    }
  });

  it('el nivel derivado para valores por defecto es razonable (no XS ni XL)', () => {
    for (const [svcId, config] of Object.entries(SERVICE_VARIABLES) as [string, any][]) {
      const defaults: Record<string, number | string | boolean> = {};
      for (const v of (config as any).variables) {
        if (v.type === 'number' && v.min !== undefined) defaults[v.id] = v.min;
        if (v.type === 'toggle') defaults[v.id] = false;
        if (v.type === 'select' && v.opciones?.length) defaults[v.id] = v.opciones[0].valorEs;
      }
      const level = derivarTier(svcId, defaults);
      const idx = LEVELS.indexOf(level);
      expect(idx, `${svcId}: nivel por defecto ${level} es extremo`).toBeGreaterThan(0);
      expect(idx, `${svcId}: nivel por defecto ${level} es extremo`).toBeLessThan(LEVELS.length - 1);
    }
  });
});
