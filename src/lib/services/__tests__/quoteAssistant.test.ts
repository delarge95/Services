import { describe, it, expect } from 'vitest';
import { answerWithQuote, detectService, extractQuantities } from '../../services/chat/quoteAssistant';
import { computeQuoteContinuous } from '../../../data/services/continuousQuote';
import { serviceValsFromAnswers } from '../../../data/services/serviceBranches';

const fmtCOP = (v: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v);

describe('ciclo 24 — asistente con cotización real', () => {
  it.each([
    ['¿Cuánto cuesta un render de 5 imágenes?', 'RND-01'],
    ['quiero un chatbot para mi web', 'AI-01'],
    ['tengo un archivo STEP de solidworks', 'CAD-01'],
    ['necesito motion graphics para redes', 'VFX-03'],
    ['un configurador de producto', 'WEB-04'],
  ])('detecta el servicio: %s → %s', (q, id) => {
    expect(detectService(q)?.id).toBe(id);
  });

  it('extrae cantidades a las variables del servicio', () => {
    expect(extractQuantities('RND-01', 'un render de 5 imágenes')).toMatchObject({ numImagenes: 5 });
    expect(extractQuantities('RND-02', 'un video de 30 segundos')).toMatchObject({ duracion: 30 });
  });

  it('la cifra del chat es EXACTAMENTE la del motor (sin inventar)', () => {
    const a = answerWithQuote('¿Cuánto cuesta un render de 5 imágenes?', { currency: 'COP' })!;
    const q = computeQuoteContinuous('RND-01', { ...serviceValsFromAnswers('RND-01', {}), numImagenes: 5 }, 'COP')!;
    expect(a).toContain(fmtCOP(q.totalMin));
    expect(a).toContain(fmtCOP(q.totalMax));
    expect(a).toContain('(tu dato)');
  });

  it('"¿por qué este precio?" usa el servicio en pantalla y da el desglose', () => {
    const a = answerWithQuote('¿por qué este precio?', { currency: 'USD', serviceId: 'RTA-01', vals: serviceValsFromAnswers('RTA-01', {}) })!;
    expect(a).toMatch(/h ×/);
    expect(a).toContain('contrato internacional');
  });

  it('qué incluye / plazos / catálogo', () => {
    expect(answerWithQuote('¿qué incluye el render?', { currency: 'COP' })).toMatch(/incluye/);
    expect(answerWithQuote('¿cuánto tarda una animación?', { currency: 'COP' })).toMatch(/días hábiles|plazo/);
    expect(answerWithQuote('¿qué servicios hay?', { currency: 'COP' })).toMatch(/Inteligencia artificial/);
  });

  it('sin servicio ni contexto → null (lo atienden las intenciones generales)', () => {
    expect(answerWithQuote('¿cómo es el pago?', { currency: 'COP' })).toBeNull();
  });
});
