export interface GlossaryEntry {
  term: string;
  def: string;
}

// Glosario cliente-friendly: definiciones de una línea, sin jerga interna.
export const GLOSSARY: Record<string, GlossaryEntry> = {
  tris: {
    term: 'Tris (triángulos)',
    def: 'Medida del peso de un modelo 3D. Menos tris = carga más rápido en web y móviles.',
  },
  lods: {
    term: 'LODs',
    def: 'Versiones ligera/media/densa del mismo objeto; el navegador usa la que toca según distancia.',
  },
  pbr: {
    term: 'Texturas PBR',
    def: 'Materiales físicos estándar (metal, rugosidad…) que se ven realistas bajo cualquier luz.',
  },
  draco: {
    term: 'Draco / KTX2',
    def: 'Compresión para modelos y texturas web: archivos mucho más livianos sin pérdida visible.',
  },
  glb: {
    term: 'GLB / GLTF',
    def: 'Formato estándar de modelo 3D para web; lo leen three.js, Unity y visores embebidos.',
  },
  hdri: {
    term: 'HDRI',
    def: 'Imagen panorámica 360° que ilumina la escena como un estudio real.',
  },
  rag: {
    term: 'RAG',
    def: 'Técnica para que un asistente IA responda solo con tu contenido, citando sus fuentes.',
  },
  moneda: {
    term: '¿Por qué dos precios?',
    def: 'USD es la tarifa internacional completa. COP aplica para mercado local colombiano con costos locales. Misma calidad de trabajo; economías distintas.',
  },
};

/** Normaliza unidades tipo "tris", "TRIS/pieza", "lods" a entrada de glosario. */
export function unitToTerm(unit: string | undefined): string | null {
  if (!unit) return null;
  const u = unit.toLowerCase();
  if (u.includes('tri')) return 'tris';
  if (u.includes('lod')) return 'lods';
  if (u.includes('pbr') || u.includes('textur')) return 'pbr';
  return null;
}
