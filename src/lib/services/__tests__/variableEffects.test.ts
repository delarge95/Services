import { describe, expect, it } from 'vitest';
import { computeQuoteContinuous } from '../../../data/services/continuousQuote';
import { serviceValsFromAnswers } from '../../../data/services/serviceBranches';
import { EFFECTS, deliveryDays } from '../../../data/services/variableEffects';
import { SERVICE_VARIABLES } from '../../../data/services/serviceVariables';
import { SERVICES } from '../../../data/services/catalogCore';

const q = (id: string, over: Record<string, number | string | boolean> = {}) =>
  computeQuoteContinuous(id, { ...serviceValsFromAnswers(id, {}), ...over }, 'COP')!;

describe('ciclo 44c — efectos de variables', () => {
  it('cada efecto apunta a un servicio y una variable que existen', () => {
    for (const [sid, list] of Object.entries(EFFECTS)) {
      expect(SERVICES.some((s) => s.id === sid), sid).toBe(true);
      for (const e of list) expect(SERVICE_VARIABLES[sid]?.variables.some((v) => v.id === e.var), `${sid}.${e.var}`).toBe(true);
    }
  });
  it('por unidad: 20 imágenes cuestan bastante más que 1 (escala casi lineal)', () => {
    const a = q('RND-01', { numImagenes: 1 }), b = q('RND-01', { numImagenes: 20 });
    expect(b.hoursPoint - a.hoursPoint).toBeGreaterThan(15);
  });
  it('sin modelo del cliente se suma el modelado; con modelo no', () => {
    expect(q('RND-01', { modeloAportado: false }).hoursPoint).toBeGreaterThan(q('RND-01', { modeloAportado: true }).hoursPoint);
  });
  it('solo procedural (NoAI) cuesta más', () => {
    expect(q('TEX-01', { noai: true }).hoursPoint).toBeGreaterThan(q('TEX-01', { noai: false }).hoursPoint);
  });
  it('retainer: las horas son las del plan elegido', () => {
    expect(q('RET-01', { plan: 'Lite (4 h/mes)' }).hoursPoint).toBe(4);
    expect(q('RET-01', { plan: 'Enterprise (80 h/mes)' }).hoursPoint).toBe(80);
  });
  it('un extra suma horas propias sin cambiar la talla', () => {
    const off = q('WEB-04', { auth: false }), on = q('WEB-04', { auth: true });
    expect(on.position).toBe(off.position);
    expect(on.hoursPoint).toBeGreaterThan(off.hoursPoint);
  });
  it('plazo: sale de las horas y la urgencia lo acorta', () => {
    const n = deliveryDays(80, 80, 0), p = deliveryDays(80, 80, 30), c = deliveryDays(80, 80, 50);
    expect(n).toEqual([12, 12]);   // 80 h ÷ 8 + 2 días de revisión
    expect(p[0]).toBeLessThan(n[0]); expect(c[0]).toBeLessThan(p[0]);
    const small = q('RND-01', { numImagenes: 1 }).entregaDias!, big = q('RND-01', { numImagenes: 20 }).entregaDias!;
    expect(big[1]).toBeGreaterThan(small[1]);
  });
});
