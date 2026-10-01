import { describe, it, expect } from 'vitest';
import { basicReply } from '../chat/basicAssistant';
import { quoteTool, validateVals, explainTool } from '../chat/tools';
import { targetFor } from '../chat/deepLink';
import { computeQuoteContinuous } from '../../../data/services/continuousQuote';
import { serviceValsFromAnswers } from '../../../data/services/serviceBranches';

const ctx = { currency: 'COP' as const };
/** Cifras con formato monetario presentes en un texto. */
const money = (t: string) => t.match(/(?:US)?\$\s?[\d.,]+/g) ?? [];

describe('ciclo 26 — herramientas deterministas', () => {
  it('cotizar = motor real (misma cifra)', () => {
    const r = quoteTool('RND-02', { duracion: 30 }, 'COP');
    const q = computeQuoteContinuous('RND-02', { ...serviceValsFromAnswers('RND-02', {}), duracion: 30 }, 'COP')!;
    expect(r.rango).toEqual({ min: q.totalMin, max: q.totalMax });
    expect(r.accion?.target).toMatchObject({ kind: 'wizard', rootChoice: 'video-anim', subChoice: 'RND-02', answers: { duracion: 30 } });
  });
  it('valida: acota números, rechaza opciones inventadas y variables inexistentes', () => {
    const v = validateVals('RND-02', { duracion: 999, motorRender: 'Unity HDRP', inventada: 1 });
    expect(v.vals.duracion).toBe(90);
    expect(v.errors.join(' ')).toMatch(/ajustó a 90/);
    expect(v.errors.join(' ')).toMatch(/no es una opción/);
    expect(v.errors.join(' ')).toMatch(/no existe/);
  });
  it('explicar: tareas suman el punto central y lista qué lo encarece', () => {
    const e = explainTool('AI-01', { canales: 4 }, 'USD');
    expect('tareas' in e ? e.tareas!.length : 0).toBeGreaterThan(0);
    expect('queLoEncarece' in e ? e.queLoEncarece!.length : 0).toBeGreaterThan(0);
  });
  it('enlaces: cada servicio tiene destino (rama o configuración)', () => {
    for (const id of ['WEB-01', 'WEB-04', 'WEB-05', 'RTA-01', 'AI-03', 'RTA-02', 'WEB-02']) expect(targetFor(id), id).not.toBeNull();
    expect(targetFor('WEB-05', { numSecciones: 8 })).toMatchObject({ rootChoice: 'web-3d', subChoice: 'scrollytelling', answers: { escenas: 8 } });
    expect(targetFor('RTA-02')).toMatchObject({ kind: 'config' });
  });
});

describe('ciclo 26 — modo básico reforzado', () => {
  it('R1: toda cifra del texto aparece en la cotización del motor', () => {
    const r = basicReply('¿cuánto cuesta un video de producto de 30 segundos?', ctx);
    const q = quoteTool('RND-02', { duracion: 30 }, 'COP');
    for (const m of money(r.text)) expect(q.rangoTexto).toContain(m.replace(/\s/g, ' ').trim().split(' ')[0].replace(/\s/g, ''));
    expect(r.actions[0]?.target).toMatchObject({ subChoice: 'RND-02' });
  });
  it('R2: precio sin servicio → pregunta con opciones (no adivina)', () => {
    const r = basicReply('¿cuánto me costaría?', ctx);
    expect(r.text).toMatch(/Qué te gustaría cotizar/);
    expect(r.chips.length).toBeGreaterThan(2);
    expect(money(r.text)).toHaveLength(0);
  });
  it('R3: pide el dato que más mueve el precio si falta', () => {
    expect(basicReply('cuánto cuesta un chatbot', ctx).text).toMatch(/Para afinarlo dime/);
  });
  it('R5: fuera de alcance se redirige sin inventar', () => {
    const r = basicReply('cuéntame un chiste', ctx);
    expect(r.text).toMatch(/Solo puedo ayudarte/);
  });
  it('R6: memoria del último servicio', () => {
    const r = basicReply('¿y con 10 imágenes?', { ...ctx, lastServiceId: 'RND-01' });
    expect(r.serviceId).toBe('RND-01');
    expect(r.text).toMatch(/10 imágenes/);
  });
  it('más barato / por qué / incluye / comparar / líneas', () => {
    expect(basicReply('¿cómo lo hago más barato?', { ...ctx, lastServiceId: 'AI-01' }).text).toMatch(/ahorra/);
    expect(basicReply('¿por qué este precio?', { ...ctx, serviceId: 'RTA-01', vals: serviceValsFromAnswers('RTA-01', {}) }).text).toMatch(/h ×/);
    expect(basicReply('¿qué incluye el render?', ctx).text).toMatch(/incluye/);
    const c = basicReply('diferencia entre render y animación', ctx);
    expect(c.actions).toHaveLength(2);
    expect(basicReply('Inteligencia artificial', ctx).actions.length).toBe(4);
    expect(basicReply('Una web con 3D', ctx).actions.length).toBe(4);
  });
  it('reglas comerciales fijas (pago) sin cifras de precio', () => {
    expect(basicReply('¿cómo es el pago?', ctx).text).toMatch(/50%/);
  });
});

import { extractOptions } from '../chat/basicAssistant';
describe('ciclo 26 — opciones en lenguaje natural', () => {
  it('reconoce 4K, Houdini, tiempo real y solo IA', () => {
    expect(extractOptions('RND-02', 'video de 30 s en 4K hecho en houdini')).toMatchObject({ resolucionVideo: '4K', motorRender: 'Prerender + simulación (Houdini)' });
    expect(extractOptions('RND-02', 'algo rápido en tiempo real')).toMatchObject({ motorRender: 'Tiempo real (Eevee / Unreal)' });
    expect(extractOptions('RND-01', 'renders solo IA')).toMatchObject({ pipelineImagen: 'Solo IA (generativa, sin modelo 3D)' });
  });
  it('la cotización usa las opciones detectadas', () => {
    expect(basicReply('video de producto de 30 segundos en 4K', { currency: 'COP' }).text).toMatch(/30 segundos, 4K/);
  });
});

describe('ciclo 26 — memoria de valores', () => {
  it('"más barato" conserva los datos dados antes y redondea el ahorro', () => {
    const first = basicReply('quiero un chatbot para mi web en 3 canales', { currency: 'COP' });
    expect(first.vals).toMatchObject({ canales: 3 });
    const r = basicReply('¿cómo lo hago más barato?', { currency: 'COP', lastServiceId: first.serviceId, lastVals: first.vals });
    expect(r.text).toMatch(/canales/i);
    for (const m of r.text.match(/\$\s?[\d.]+/g) ?? []) expect(Number(m.replace(/[^\d]/g, '')) % 1000).toBe(0);
  });
});

describe('ciclo 30 — modo básico en inglés (sin mezclar idiomas)', () => {
  const en = { currency: 'USD' as const, lang: 'en' as const };
  const SPANISH = /[áéíóúñ¿¡]|\b(con|tus|datos|sale en|días hábiles|incluye|cotizar|qué)\b/i;
  it.each([
    'How much is a 30 second product video in 4K?',
    'how much for a chatbot on my website with 3 channels',
    'what services do you offer?',
    'Artificial intelligence',
    'A 3D website',
    'how does payment work?',
    'tell me a joke',
  ])('%s → respuesta en inglés', (q) => {
    const r = basicReply(q, en);
    expect(r.text, r.text).not.toMatch(SPANISH);
    for (const a of r.actions) expect(a.label, a.label).not.toMatch(SPANISH);
  });
  it('entiende cantidades y opciones en inglés', () => {
    const r = basicReply('How much is a 30 second product video in 4K?', en);
    expect(r.text).toMatch(/30 seconds, 4K/);
    expect(r.text).toMatch(/US\$|\$/);
  });
  it('why / cheaper / include en inglés', () => {
    const ctx = { ...en, lastServiceId: 'AI-01', lastVals: { canales: 3 } };
    for (const q of ['why this price?', 'how can I make it cheaper?', "what's included?"]) {
      const r = basicReply(q, ctx);
      expect(r.text, r.text).not.toMatch(SPANISH);
    }
  });
});
