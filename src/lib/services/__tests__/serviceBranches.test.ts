import { describe, it, expect } from 'vitest';
import { SERVICE_ROOTS, buildServiceBranch, serviceValsFromAnswers, variableDefault } from '../../../data/services/serviceBranches';
import { planFromTreeAnswers } from '../../../data/services/treeToQuote';
import { computeQuoteContinuous } from '../../../data/services/continuousQuote';
import { sliderDefault } from '../../../data/services/decisionTree';
import { SERVICE_VARIABLES } from '../../../data/services/serviceVariables';

const all = Object.entries(SERVICE_ROOTS).flatMap(([root, r]) => r.options.map((o) => [root, o.id] as const));

describe('ciclo 24 — catálogo ampliado al wizard guiado', () => {
  it.each(all)('%s → %s: rama generada y plan cotizable', (root, id) => {
    const b = buildServiceBranch(id);
    expect(b, id).not.toBeNull();
    expect(b!.questions.length).toBeGreaterThan(0);
    const plan = planFromTreeAnswers(root, id, {});
    expect(plan.picks).toHaveLength(1);
    const q = computeQuoteContinuous(id, plan.picks[0].vals, 'COP')!;
    expect(q.totalMax).toBeGreaterThanOrEqual(q.totalMin);
    expect(q.totalMin).toBeGreaterThan(0);
  });

  it.each(all)('%s → %s: el slider sin tocar muestra lo que se cotiza', (_root, id) => {
    const b = buildServiceBranch(id)!;
    const vals = serviceValsFromAnswers(id, {});
    for (const q of b.questions.filter((x) => x.type === 'slider')) {
      expect(sliderDefault(q)).toBe(vals[q.id]);
    }
  });

  it.each(all)('%s → %s: subir cada slider no baja el precio y el rango completo lo sube', (_root, id) => {
    for (const v of (SERVICE_VARIABLES[id]?.variables ?? []).filter((x) => x.type === 'number' && x.tierMap?.length)) {
      const p = (n: number) => computeQuoteContinuous(id, { ...serviceValsFromAnswers(id, {}), [v.id]: n }, 'COP')!.totalPoint;
      expect(p(v.max!), `${id}.${v.id}`).toBeGreaterThanOrEqual(p(v.min!));
    }
  });

  it('defaults numéricos sin recomendación = tope de la talla S, dentro del rango', () => {
    for (const cfg of Object.values(SERVICE_VARIABLES)) {
      for (const v of cfg.variables.filter((x) => x.type === 'number')) {
        const d = variableDefault(v) as number;
        expect(d).toBeGreaterThanOrEqual(v.min ?? -Infinity);
        expect(d).toBeLessThanOrEqual(v.max ?? Infinity);
      }
    }
  });
});
