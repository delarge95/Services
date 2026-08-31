import { describe, expect, it } from 'vitest';
import { SERVICES } from '../../../data/services/catalogCore';
import { RATE_LABELS, groupSubtasksByPhase, phaseOf } from '../../../data/services/rateLabels';
import type { Subtask } from '../../../data/services/types';
import {
  buildSummary,
  decodeShare,
  encodeShare,
  quoteId,
} from '../share';

// ── S5: compartir/guardar cotización ──
describe('share: encode/decode', () => {
  const state = {
    serviceId: 'RTA-01',
    vals: { polyCount: 45000, numPiezas: 12, fuenteModelo: 'Configuración propia' },
    currency: 'COP' as const,
    firstClient: false,
    urgency: '72h' as const,
    quantity: 3,
  };

  it('roundtrip preserva todos los campos incl. unicode en valores', () => {
    const back = decodeShare('?' + encodeShare(state));
    expect(back).toEqual(state);
  });

  it('sin params devuelve null; basura devuelve null', () => {
    expect(decodeShare('')).toBeNull();
    expect(decodeShare('?svc=')).toBeNull();
    expect(decodeShare('?v=%%%bad')).toBeNull();
  });

  it('valores fuera de rango se saneán (qty>=1, urgencia inválida→none)', () => {
    const p = new URLSearchParams({ svc: 'RND-01', qty: '-5', urg: 'ya' });
    const back = decodeShare('?' + p.toString());
    expect(back?.quantity).toBe(1);
    expect(back?.urgency).toBe('none');
  });

  it('quoteId es estable, alfanumérico y de longitud fija', () => {
    const a = quoteId(state);
    const b = quoteId({ ...state });
    expect(a).toBe(b);
    expect(a).toMatch(/^[A-Z0-9]{7}$/);
  });
});

// ── S1: resumen para WhatsApp/email ──
describe('buildSummary', () => {
  it('incluye id, servicio, nivel, total y link', () => {
    const s = buildSummary({
      id: 'ABC1234',
      serviceName: 'Render 3D estatico',
      serviceCode: 'RND-01',
      tier: 'M',
      currency: 'USD',
      totalRange: '$300 – $900',
      hoursRange: '10–24 h',
      entrega: '1–14 días hábiles',
      entregables: ['Imagen alta resolucion'],
      noIncluye: [],
      url: 'https://x.io/cotizador?svc=RND-01',
    });
    expect(s).toContain('ABC1234');
    expect(s).toContain('RND-01');
    expect(s).toContain('M');
    expect(s).toContain('$300 – $900');
    expect(s).toContain('https://x.io/cotizador?svc=RND-01');
  });
});

// ── S2: desglose por fases ──
describe('rateLabels: fases legibles', () => {
  const st = (id: string, nameEs: string): Subtask =>
    ({ id, nameEs, rateClass: 'RC-WEB', hours: { XS: { min: 0, max: 0 }, S: { min: 1, max: 2 }, M: { min: 2, max: 3 }, L: { min: 3, max: 4 }, XL: { min: 4, max: 5 } } });

  it('clasifica descubrimiento / producción / calidad', () => {
    expect(phaseOf(st('a', 'Brief + moodboard'))).toBe('descubrimiento');
    expect(phaseOf(st('b', 'Auditoria express'))).toBe('descubrimiento');
    expect(phaseOf(st('c', 'Modelado hi-low'))).toBe('produccion');
    expect(phaseOf(st('d', 'QA motor target'))).toBe('calidad');
    expect(phaseOf(st('e', 'Deploy + documentacion'))).toBe('calidad');
  });

  it('agrupa sin perder horas (RTA-01@S: suma por fases == suma directa)', () => {
    const svc = SERVICES.find((s) => s.id === 'RTA-01')!;
    const groups = groupSubtasksByPhase(svc.subtasks as Subtask[], 'S');
    let gMin = 0, gMax = 0;
    for (const g of groups) for (const h of [g.hoursLabel]) {
      const m = h.match(/(\d+(?:\.\d+)?)–(\d+(?:\.\d+)?)/);
      if (m) { gMin += Number(m[1]); gMax += Number(m[2]); }
    }
    const direct = svc.subtasks.reduce((acc, x) => acc + (x.hours.S?.min ?? 0), 0);
    expect(gMin).toBeCloseTo(direct, 5);
  });

  it('RATE_LABELS cubre todas las clases usadas en el catálogo', () => {
    for (const svc of SERVICES) {
      for (const st of svc.subtasks) {
        expect(RATE_LABELS[st.rateClass], `${svc.id}.${st.id}: ${st.rateClass} sin etiqueta`).toBeTruthy();
      }
    }
  });
});
