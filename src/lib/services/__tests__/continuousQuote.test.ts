import { describe, it, expect } from 'vitest';
import { computeQuoteContinuous, derivarPosicion, numericPosition } from '../../../data/services/continuousQuote';
import { computeQuote } from '../../../data/services/formula';
import { derivarTier, SERVICE_VARIABLES } from '../../../data/services/serviceVariables';

const base = { polyCount: 20000, numPiezas: 8, tipoSuperficie: 2, fuente: 'Desde fotos (requiere modelado)', numTexturas: 2 };

describe('continuousQuote — posición', () => {
  it('numericPosition es continua y monótona en superficie 1→5', () => {
    const tm = SERVICE_VARIABLES['RTA-01'].variables.find((v) => v.id === 'tipoSuperficie')!;
    const cfg = { min: tm.min, max: tm.max, tierMap: tm.tierMap as any };
    let prev = -1;
    for (let s = 1; s <= 5; s += 0.1) {
      const p = numericPosition(s, cfg);
      expect(p).toBeGreaterThanOrEqual(prev);
      prev = p;
    }
    expect(numericPosition(1, cfg)).toBeLessThan(numericPosition(5, cfg));
  });

  it('sin variables → 0 (igual que derivarTier → XS)', () => {
    expect(derivarPosicion('RTA-01', {})).toBe(0);
    expect(derivarTier('RTA-01', {})).toBe('XS');
  });
});

describe('continuousQuote — cada slider mueve el precio (DESPACHO-11 LAB-C1/C2)', () => {
  const price = (v: Record<string, any>) => computeQuoteContinuous('RTA-01', v, 'COP')!.totalPoint;

  it.each([
    ['tipoSuperficie', 1, 5],
    ['polyCount', 2000, 300000],
    ['numPiezas', 2, 150],
    ['numTexturas', 1, 8],
  ])('%s: subir el valor sube el precio', (id, lo, hi) => {
    const v = SERVICE_VARIABLES['RTA-01'].variables.find((x) => x.id === id);
    if (!v?.tierMap?.length) return; // variables sin tierMap no afectan (documentado)
    expect(price({ ...base, [id]: hi })).toBeGreaterThan(price({ ...base, [id]: lo }));
  });

  it('superficie 1, 3 y 5 dan tres precios distintos y crecientes', () => {
    const [a, b, c] = [1, 3, 5].map((s) => price({ ...base, tipoSuperficie: s }));
    expect(a).toBeLessThan(b);
    expect(b).toBeLessThan(c);
  });
});

describe('continuousQuote — banda y coherencia', () => {
  it('banda ≤ 1.3× (antes ~2.1×) salvo cuando manda el mínimo de proyecto', () => {
    const q = computeQuoteContinuous('RTA-01', { ...base, tipoSuperficie: 4 }, 'COP')!;
    expect(q.totalMax / q.totalMin).toBeLessThanOrEqual(1.3);
  });

  it('el punto central cae dentro del rango discreto de la talla dominante', () => {
    const vals = { ...base, tipoSuperficie: 3 };
    const cq = computeQuoteContinuous('RTA-01', vals, 'COP')!;
    const dq = computeQuote('RTA-01', derivarTier('RTA-01', vals), 'COP')!;
    expect(cq.totalPoint).toBeGreaterThanOrEqual(dq.totalMin * 0.6);
    expect(cq.totalPoint).toBeLessThanOrEqual(dq.totalMax);
  });

  it('respeta el mínimo de proyecto y los descuentos', () => {
    const q = computeQuoteContinuous('RTA-01', { tipoSuperficie: 1 }, 'COP', { firstClientLaunch: true })!;
    expect(q.totalMin).toBeGreaterThanOrEqual(400000);
    expect(q.discountPct).toBeLessThan(0);
  });

  it('todos los servicios con variables devuelven cotización válida', () => {
    for (const id of Object.keys(SERVICE_VARIABLES)) {
      const q = computeQuoteContinuous(id, {}, 'USD');
      expect(q, id).not.toBeNull();
      expect(q!.totalMax).toBeGreaterThanOrEqual(q!.totalMin);
      expect(Number.isFinite(q!.totalPoint)).toBe(true);
    }
  });
});

// ─── Integración wizard → precio (DESPACHO-11 LAB-C2) ───
import { WEB3D_BRANCHES } from '../../../data/services/decisionTree';
import { planFromTreeAnswers } from '../../../data/services/treeToQuote';

describe('wizard: todo slider VISIBLE mueve el precio del plan', () => {
  const planTotal = (sub: string, a: Record<string, any>) =>
    planFromTreeAnswers('web-3d', sub, a).picks
      .map((p) => computeQuoteContinuous(p.serviceId, p.vals, 'COP')?.totalPoint ?? 0)
      .reduce((x, y) => x + y, 0);

  for (const branch of Object.values(WEB3D_BRANCHES)) {
    for (const q of branch.questions) {
      if (q.type !== 'slider' || !q.slider) continue;
      it(`${branch.id} · ${q.id}`, () => {
        // escenario donde la pregunta se muestra (si tiene showWhen, forzamos "hay que crear")
        const a: Record<string, any> = { 'modelo-existente': 'no-crear', 'modelo-para-scroll': 'no' };
        if (q.showWhen) expect(q.showWhen(a)).toBe(true);
        const lo = planTotal(branch.id, { ...a, [q.id]: q.slider!.min });
        const hi = planTotal(branch.id, { ...a, [q.id]: q.slider!.max });
        expect(hi, `${q.id} min→max`).toBeGreaterThan(lo);
      });
    }
  }

  it('con "Sí lo tengo" (glTF) los sliders de modelado se ocultan', () => {
    const q = WEB3D_BRANCHES["ver-modelo"].questions.find((x) => x.id === 'superficie')!;
    expect(q.showWhen!({ 'modelo-existente': 'si-tengo', 'formato-archivo': 'gltf' })).toBe(false);
    expect(q.showWhen!({ 'modelo-existente': 'si-tengo', 'calidad-fuente': 'scan' })).toBe(true);
  });
});

// ─── Ciclo 22 (2026-09-30): default mostrado = default cotizado; un solo motor; anclas Excel ───
import { SLIDER_DEFAULTS, sliderDefault } from '../../../data/services/decisionTree';
import { computeQuoteAtLevel, minContinuousPrice } from '../../../data/services/continuousQuote';
import { minPriceOf } from '../../../data/services/goals';
import { SERVICES } from '../../../data/services/catalogCore';

describe('ciclo 22 — slider sin tocar muestra lo que se cotiza', () => {
  const ans = { 'modelo-existente': 'no-crear' };
  const rta = (a: Record<string, any>) => planFromTreeAnswers('web-3d', 'ver-modelo', a).picks.find((p) => p.serviceId === 'RTA-01')!;

  it.each(['superficie', 'nivel-detalle', 'cantidad-piezas'])('%s: sin respuesta = respuesta con sliderDefault', (id) => {
    const q = WEB3D_BRANCHES['ver-modelo'].questions.find((x) => x.id === id)!;
    expect(sliderDefault(q)).toBe(SLIDER_DEFAULTS[id]);
    expect(rta(ans).vals).toEqual(rta({ ...ans, [id]: sliderDefault(q) }).vals);
  });

  it('superficie continua: 1,0 y 1,4 cotizan distinto', () => {
    const p = (s: number) => computeQuoteContinuous('RTA-01', rta({ ...ans, superficie: s }).vals, 'COP')!.totalPoint;
    expect(p(1.4)).toBeGreaterThan(p(1));
  });
});

describe('ciclo 22 — galería y "desde" usan el motor continuo', () => {
  it('en posición entera el punto central = punto medio del Excel (horas)', () => {
    const q = computeQuoteAtLevel('RTA-01', 'M', 'COP')!;
    const svc = SERVICES.find((s) => s.id === 'RTA-01')!;
    const mid = svc.subtasks.filter((s) => !s.optional).reduce((a, s) => a + (s.hours.M!.min + s.hours.M!.max) / 2, 0);
    expect(q.hoursPoint).toBeCloseTo(mid, 1);
  });

  it('tallas sin horas no se ofrecen; "desde" = mínimo continuo', () => {
    expect(computeQuoteAtLevel('RTA-01', 'XS', 'COP')).toBeNull();
    expect(minPriceOf('RTA-01', 'COP')).toBe(minContinuousPrice('RTA-01', 'COP'));
    expect(minPriceOf('RTA-01', 'COP')).toBe(computeQuoteAtLevel('RTA-01', 'S', 'COP')!.totalMin);
  });
});
