/**
 * esDisplay.test.ts — Capa de presentación ES (ciclo 31, auditoría de contenido).
 * Garantiza que lo que ve el cliente no tiene jerga en inglés ni tildes faltantes,
 * y que los valores base del motor NO cambian.
 */
import { describe, it, expect } from 'vitest';
import { esDisplay, UNIT_ES_DISPLAY } from '../../../data/services/i18nMore';
import { SERVICES } from '../../../data/services/catalogCore';
import { SERVICE_VARIABLES } from '../../../data/services/serviceVariables';

const ENGLISH_JARGON = /\b(responsive|mobile-first|analytics|deploy|export\/share|widget|guardrails|highlight|fallback|template|loading|handoff|quick-win|README|SOW|hardcode|tuning|performance)\b/i;
const MISSING_ACCENT = /\b(Imagenes|resolucion|revision|Animacion|seleccion|compresion|tecnicos?|Aplicacion|Presentacion|estimacion|Configuracion|Integracion|Modulo|movil(es)?|Pagina|seccion|tactiles|analitica|Catalogo|Gestion|navegacion|Evolucion|Capacitacion|Simulacion|Sesion|Guia|Mecanicas?|numero|camara)\b/;

describe('esDisplay', () => {
  it('traduce frases con jerga a español claro', () => {
    expect(esDisplay('Responsive mobile-first')).toBe('Diseño adaptable, primero para móvil');
    expect(esDisplay('Fijos (hardcode)')).toBe('Fijos (no cambian)');
    expect(esDisplay('Desktop')).toBe('Escritorio');
  });
  it('corrige tildes palabra por palabra sin tocar el resto', () => {
    expect(esDisplay('Imagenes en alta resolucion (PNG/JPG/EXR)')).toBe('Imágenes en alta resolución (PNG/JPG/EXR)');
    expect(esDisplay('Visor web interactivo')).toBe('Visor web interactivo');
  });
  it('ningún entregable visible conserva jerga ni tildes faltantes', () => {
    for (const s of SERVICES) {
      for (const e of s.entregablesEs) {
        const out = esDisplay(e);
        expect(out, `${s.id}: ${e}`).not.toMatch(ENGLISH_JARGON);
        expect(out, `${s.id}: ${e}`).not.toMatch(MISSING_ACCENT);
      }
    }
  });
  it('las opciones visibles no muestran "Desktop" ni "hardcode"', () => {
    for (const cfg of Object.values(SERVICE_VARIABLES)) {
      for (const v of cfg.variables) for (const o of v.opciones ?? []) expect(esDisplay(o.valorEs)).not.toMatch(/\b(Desktop|hardcode)\b/);
    }
  });
  it('las unidades del catálogo se muestran con tildes', () => {
    for (const s of SERVICES) expect(UNIT_ES_DISPLAY[s.unitEs] ?? s.unitEs, s.id).not.toMatch(MISSING_ACCENT);
  });
  it('no altera los valores base del motor', () => {
    expect(SERVICE_VARIABLES['WEB-01'].variables.some((v) => v.opciones?.some((o) => o.valorEs === 'Fijos (hardcode)'))).toBe(true);
  });
});
