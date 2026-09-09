// previewConstants.ts — constantes y tipos del preview SIN dependencia de three.
// Vive fuera de ModelPreview.tsx para que GuidedWizard las importe sin arrastrar
// el chunk pesado de three (ciclo 15: code-split del cotizador).

export type PreviewMode = 'detail' | 'pieces' | 'story' | 'variants' | 'surface' | 'finish' | 'assembly' | 'hotspots' | 'shader-dial';

// ═══════════════════════════════════════════════════════════════
// Variantes (ciclo 6): 14 SLOTS sobre el DRONE HolyBro (solo el FRAME al
// inicio; batería/electrónica/plataforma se añaden como piezas desbloqueables).
// Se desbloquean con el slider, se activan/apagan en vivo. Ciclo 9: se retiran
// 'filtros-piezas' y 'color-cuaternario' (feedback Alexander); el estado
// inicial es BLANCO plano hasta encender el color base.
// ═══════════════════════════════════════════════════════════════
export type VariantSlotKind = 'color' | 'toggle' | 'luz';
export type ColorTarget = 'all' | 'motors' | 'propellers' | 'frames';
export type SlotFx = 'explode' | 'clip' | 'xray' | 'lineart' | 'flight' | 'battery' | 'electronics' | 'platform';

export interface VariantSlot {
  id: string;
  es: string;
  en: string;
  kind: VariantSlotKind;
  /** Para kind='color': qué set de meshes tiñe. */
  colorTarget?: ColorTarget;
  /** Comportamiento especial del slot. */
  fx?: SlotFx;
}

export const VARIANT_SLOTS: VariantSlot[] = [
  { id: 'color-base', es: 'Color base', en: 'Base color', kind: 'color', colorTarget: 'all' },
  { id: 'vista-explosionada', es: 'Vista explosionada', en: 'Exploded view', kind: 'toggle', fx: 'explode' },
  { id: 'color-secundario', es: 'Color secundario', en: 'Secondary color', kind: 'color', colorTarget: 'motors' },
  { id: 'color-terciario', es: 'Color terciario', en: 'Tertiary color', kind: 'color', colorTarget: 'propellers' },
  { id: 'cortes-transversales', es: 'Corte transversal', en: 'Cross-section', kind: 'toggle', fx: 'clip' },
  { id: 'pieza-adicional-1', es: 'Batería', en: 'Battery', kind: 'toggle', fx: 'battery' },
  { id: 'pieza-adicional-2', es: 'Electrónica', en: 'Electronics', kind: 'toggle', fx: 'electronics' },
  { id: 'pieza-adicional-3', es: 'Plataforma superior', en: 'Top platform', kind: 'toggle', fx: 'platform' },
  { id: 'shader-xray', es: 'Shader rayos X', en: 'Shader X-ray', kind: 'toggle', fx: 'xray' },
  { id: 'shader-lineart', es: 'Shader line-art', en: 'Shader line-art', kind: 'toggle', fx: 'lineart' },
  { id: 'animacion-vuelo', es: 'Animación de vuelo', en: 'Flight animation', kind: 'toggle', fx: 'flight' },
  { id: 'luz-estudio', es: 'Luz de estudio', en: 'Studio lighting', kind: 'luz' },
  { id: 'luz-natural', es: 'Luz natural', en: 'Natural lighting', kind: 'luz' },
  { id: 'luz-dramatica', es: 'Luz dramática', en: 'Dramatic lighting', kind: 'luz' },
];

/** Índices de slots por id (ciclo 9: accesos por id, validados en runtime).
 *  Exportados: ModelPreview los consume en sus modos de variantes. */
export const SLOT_IDX = (id: string) => {
  const i = VARIANT_SLOTS.findIndex(s => s.id === id);
  if (i < 0) throw new Error(`VariantSlot '${id}' no existe`);
  return i;
};
export const IDX_BASE = SLOT_IDX('color-base');
export const IDX_EXPLODE = SLOT_IDX('vista-explosionada');
export const IDX_SEC = SLOT_IDX('color-secundario');
export const IDX_TER = SLOT_IDX('color-terciario');
export const IDX_CLIP = SLOT_IDX('cortes-transversales');
export const IDX_BAT = SLOT_IDX('pieza-adicional-1');
export const IDX_ELE = SLOT_IDX('pieza-adicional-2');
export const IDX_PLA = SLOT_IDX('pieza-adicional-3');
export const IDX_XRAY = SLOT_IDX('shader-xray');
export const IDX_LINEART = SLOT_IDX('shader-lineart');
export const IDX_FLIGHT = SLOT_IDX('animacion-vuelo');
export const IDX_LUZ0 = VARIANT_SLOTS.findIndex(s => s.kind === 'luz');

/** Blanco PLANO del estado inicial (color-base OFF, ciclo 9). */
export const BLANK_HEX = '#eef0f2';

/** Segundos por animación del modo story. */
export const STORY_DURATION = 2.4;

export interface VariantSlotsState {
  /** ON/OFF por slot (índice = posición en VARIANT_SLOTS). */
  on: boolean[];
  /** Color hex por slot de color (clave = slot.id). */
  colors: Record<string, string>;
}

/** Hex por defecto de cada slot de color. */
export const SLOT_DEFAULT_COLORS: Record<string, string> = {
  'color-base': '#22262c',
  'color-secundario': '#0071e3',
  'color-terciario': '#c9b99a',
};

/** Catálogo de animaciones del modo story (1.3 replante). */
export const STORY_ANIMS = [
  { es: 'Giro', en: 'Spin', glyph: '↻' },
  { es: 'Explosión', en: 'Explode', glyph: '✦' },
  { es: 'Primer plano', en: 'Close-up', glyph: '⌕' },
  { es: 'Salto', en: 'Hop', glyph: '↑' },
  { es: 'Despliegue', en: 'Deploy', glyph: '✳' },
  { es: 'Tumble', en: 'Tumble', glyph: '⟳' },
  { es: 'Pulso', en: 'Pulse', glyph: '◉' },
  { es: 'Despegue', en: 'Takeoff', glyph: '▲' },
] as const;

/** Interpolación del contador de tris entre etapas (trazable a POLY_POR_NIVEL). */
export const POLY = [4000, 9000, 40000, 120000, 300000];

/** Ciclo 13: exportada — la consume la caption del detail en GuidedWizard
 *  (antes flotaba como overlay arriba a la derecha y confundía). */
export const polyLabel = (d: number) => {
  const f = Math.max(1, Math.min(5, d));
  const i = Math.min(3, Math.floor(f - 1));
  const frac = f - 1 - i;
  const v = POLY[i] + (POLY[i + 1] - POLY[i]) * frac;
  return `≈ ${v >= 1000 ? `${Math.round(v / 1000)}k` : Math.round(v)} tris`;
};
