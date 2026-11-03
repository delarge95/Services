import { describe, expect, it } from 'vitest';
import { URGENCY_PCT, PAGO_UMBRALES_USD, urgenciaTexto, pagoTexto, esquemaPago } from '../quoteSummary';
import { BUSINESS_FACTS } from '../chat/tools';
import { matchIntent } from '../chat/chatIntents';
import { TRM_REFERENCIA } from '../../../data/services/rateCard';

// Ciclo 46: una sola verdad para urgencia y pago; el chat nunca debe contradecir al cotizador.
describe('coherencia comercial (cotizador ↔ chat)', () => {
  it('urgencia: +30 % / +50 % en las constantes y en los textos del chat', () => {
    expect(URGENCY_PCT).toEqual({ pronto: 30, critico: 50 });
    expect(urgenciaTexto(false)).toContain('+30%');
    expect(BUSINESS_FACTS.join(' ')).toContain('+30%');
    expect(BUSINESS_FACTS.join(' ')).not.toContain('+25');
  });
  it('pago: los umbrales del texto son los de esquemaPago', () => {
    const t = pagoTexto(false);
    expect(t).toContain(`USD ${PAGO_UMBRALES_USD[0]}`);
    expect(esquemaPago(PAGO_UMBRALES_USD[0], 'USD')).toBe('100% anticipado');
    expect(esquemaPago(PAGO_UMBRALES_USD[0] + 1, 'USD')).toBe('50/50');
    expect(BUSINESS_FACTS.join(' ')).not.toContain('50 % de anticipo para agendar');
  });
  it('el chat no dice «50 % de anticipo» fijo para todos', () => {
    const r = matchIntent('como es lo del pago y anticipo', { entrega: undefined } as never) ?? '';
    expect(r).toContain('100% anticipado');
  });
  it('los hechos que van al prompt de la IA no llevan importes (el verificador del worker los rechazaría)', () => {
    // core.ts → MONEY_RE solo admite importes que salgan de las herramientas; los hechos fijos viajan en el prompt.
    expect(BUSINESS_FACTS.join(' ')).not.toMatch(/(?:US\$|\$|COP\s?|USD\s?)\s?\d|\d[\d.,]*\s?(?:COP|USD|pesos|d[oó]lares)/i);
    expect(BUSINESS_FACTS.join(' ')).toContain('100% anticipado');
    expect(pagoTexto(false, true)).toContain(`USD ${PAGO_UMBRALES_USD[0]}`);   // el chat básico sí puede dar los montos
  });
  it('TRM de referencia vigente y fechada', () => {
    expect(TRM_REFERENCIA.usdCop).toBeGreaterThan(2500);
    expect(TRM_REFERENCIA.fecha).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
