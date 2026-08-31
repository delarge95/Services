import { describe, expect, it } from 'vitest';
import { bundlePct, esquemaPago, RONDAS_NOTA } from '../quoteSummary';

describe('bundlePct (D2, ciclo 2.1)', () => {
  it('un solo servicio no tiene descuento', () => {
    expect(bundlePct(1, 0)).toBe(0);
  });

  it('2 servicios −5% · 3 o más −10%', () => {
    expect(bundlePct(2, 0)).toBe(5);
    expect(bundlePct(3, 0)).toBe(10);
    expect(bundlePct(7, 0)).toBe(10);
  });

  it('no acumula con urgencia', () => {
    expect(bundlePct(3, 30)).toBe(0);
    expect(bundlePct(2, 50)).toBe(0);
  });
});

describe('esquemaPago (D5, metodología §7)', () => {
  it('umbrales USD: ≤500 anticipado · (500,2k] 50/50 · (2k,8k] 40/30/30 · >8k hitos', () => {
    expect(esquemaPago(450, 'USD')).toBe('100% anticipado');
    expect(esquemaPago(500, 'USD')).toBe('100% anticipado');
    expect(esquemaPago(501, 'USD')).toBe('50/50');
    expect(esquemaPago(2000, 'USD')).toBe('50/50');
    expect(esquemaPago(2100, 'USD')).toBe('40/30/30');
    expect(esquemaPago(8000, 'USD')).toBe('40/30/30');
    expect(esquemaPago(8500, 'USD')).toBe('Hitos quincenales');
  });

  it('COP convierte con la TRM de referencia (4000)', () => {
    expect(esquemaPago(400_000, 'COP')).toBe('100% anticipado');
    expect(esquemaPago(2_080_000, 'COP')).toBe('50/50');
    expect(esquemaPago(36_000_000, 'COP')).toBe('Hitos quincenales');
  });
});

describe('rondas', () => {
  it('la nota muestra las 2 incluidas y el coste de la extra', () => {
    expect(RONDAS_NOTA).toContain('2 rondas');
    expect(RONDAS_NOTA).toContain('+10%');
  });
});
