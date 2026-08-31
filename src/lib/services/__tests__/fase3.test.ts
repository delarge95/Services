import { describe, expect, it } from 'vitest';
import {
  inventoryLine,
  summarizeFiles,
  verdictFile,
} from '../fileChecklist';
import {
  matchIntent,
  normalize,
  quickRepliesFor,
} from '../chat/chatIntents';
import type { ChatContext } from '../chat/chatIntents';
import { buildSummary } from '../share';

const MB = 1024 * 1024;

describe('S9: checklist de archivos', () => {
  it('STEP liviano: ok con nota positiva; >100MB avisa pesado', () => {
    const v = verdictFile('ensamblaje.step', 80 * MB);
    expect(v.ok).toBe(true);
    expect(v.notes.some((n) => n.includes('fuente'))).toBe(true);
    expect(v.notes.some((n) => n.includes('Pesado'))).toBe(false);

    const heavy = verdictFile('grande.step', 120 * MB);
    expect(heavy.notes.some((n) => n.includes('Pesado'))).toBe(true);
  });

  it('GLB pequeño: ok sin avisos de peso', () => {
    const v = verdictFile('pieza.glb', 4 * MB);
    expect(v.ok).toBe(true);
    expect(v.notes.some((n) => n.includes('Pesado'))).toBe(false);
  });

  it('formato desconocido: no ok pero mensaje amable', () => {
    const v = verdictFile('cosa.xyz123', 1 * MB);
    expect(v.ok).toBe(false);
    expect(v.notes[0]).toContain('no lo reconocemos');
  });

  it('referencia png diminuta sugiere versión mayor', () => {
    const v = verdictFile('ref.png', 30 * 1024);
    expect(v.notes.some((n) => n.includes('muy baja'))).toBe(true);
  });

  it('summarizeFiles cuenta listos/desconocidos y resume', () => {
    const s = summarizeFiles([
      verdictFile('a.step', 10 * MB),
      verdictFile('b.exe', 10 * MB),
    ]);
    expect(s.ready).toBe(1);
    expect(s.unknown).toBe(1);
    expect(s.message).toContain('1/2');
  });

  it('inventoryLine trunca a 5 y solo aparece con archivos', () => {
    expect(inventoryLine([])).toBeUndefined();
    const line = inventoryLine(['a.step', 'b.step', 'c.step', 'd.step', 'e.step', 'f.step']);
    expect(line).toContain('+1 más');
    expect(line).toContain('Drive/WeTransfer');
  });
});

const baseCtx: ChatContext = {
  section: 'inicio',
  contactEmail: 'contacto@ag-serv.com',
};

describe('S12: intenciones del chat', () => {
  it('normaliza acentos y mayúsculas (conserva puntuación)', () => {
    expect(normalize('¿Cuánto CUESTA?')).toBe('¿cuanto cuesta?');
  });

  it('reconoce precio, urgencia, pago y contacto (sin acentos)', () => {
    expect(matchIntent('por que es tan caro', baseCtx)).toMatch(/rango|precio/i);
    expect(matchIntent('es urgente, para el viernes', baseCtx)).toMatch(/\+25%|\+50%/);
    expect(matchIntent('como es lo del pago y anticipo', baseCtx)).toContain('50%');
    expect(matchIntent('quiero hablar con una persona', baseCtx)).toContain('contacto@ag-serv.com');
  });

  it('términos técnicos van al glosario compartido', () => {
    const a = matchIntent('que son los tris', baseCtx)!;
    expect(a.toLowerCase()).toContain('triángulos');
    expect(matchIntent('que significa PBR', baseCtx)).toContain('PBR');
  });

  it('respuesta dinámica usa el rango actual en sección resultado', () => {
    const ctx: ChatContext = { ...baseCtx, section: 'resultado', totalRange: '$300 – $900', tier: 'M' };
    expect(matchIntent('por qué este precio', ctx)).toContain('$300 – $900');
    expect(matchIntent('que significa la letra M', ctx)).toContain('M');
  });

  it('input irreconocible devuelve null para usar fallback', () => {
    expect(matchIntent('xyzzy qwerty foo', baseCtx)).toBeNull();
  });

  it('quick replies dependen de la sección', () => {
    expect(quickRepliesFor({ ...baseCtx, section: 'inicio' })).toHaveLength(3);
    expect(quickRepliesFor({ ...baseCtx, section: 'variables' })[0]).toContain('tris');
    expect(quickRepliesFor({ ...baseCtx, section: 'resultado' })[0]).toContain('precio');
  });
});

describe('resumen incluye adjuntos declarados', () => {
  it('línea de inventario cuando hay archivos', () => {
    const s = buildSummary({
      id: 'ZZZ0001', serviceName: 'X', serviceCode: 'RND-01', tier: 'M',
      currency: 'USD', totalRange: '$1', hoursRange: '1–2 h',
      entregables: [], noIncluye: [], url: 'https://x.io',
      adjuntos: inventoryLine(['modelo.step'])!,
    });
    expect(s).toContain('modelo.step');
  });
});
