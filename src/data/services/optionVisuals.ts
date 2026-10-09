/**
 * optionVisuals.ts — Visuales por opción de una variable (ciclo 45, VISUALES_COTIZADOR.md «ganchos técnicos»).
 * Clave «SERVICIO.variable» → opción → archivo en public/cotizador/visuals/. Renders del X500 hechos con
 * Mixar/Cycles (tools/visuales/). Una opción sin visual muestra el de la opción más cercana que lo tenga.
 * Regla de honestidad: si un visual se hizo con IA, `ia: true` y la UI lo etiqueta.
 */
const V = `${import.meta.env.BASE_URL}cotizador/visuals/`;

export type OptionVisual = { kind: 'img' | 'video'; src: string; fallback?: string; label: [string, string]; ia?: boolean };

export const OPTION_VISUALS: Record<string, Record<string, OptionVisual>> = {
  'RND-01.ambientacion': {
    'Fondo neutro de estudio': { kind: 'img', src: `${V}RND-01/estudio.avif`, fallback: `${V}RND-01/estudio.webp`, label: ['Estudio: fondo infinito y luz suave', 'Studio: seamless backdrop, soft light'] },
  },
  'RND-01.pipelineImagen': {
    'Render 3D fotorrealista completo': { kind: 'img', src: `${V}RND-01/3d.avif`, fallback: `${V}RND-01/3d.webp`, label: ['Render 3D completo (Cycles): medidas y materiales exactos', 'Full 3D render (Cycles): exact dimensions and materials'] },
  },
  'RND-02.motorRender': {
    'Tiempo real (Eevee / Unreal)': { kind: 'video', src: `${V}RND-02/eevee.webm`, label: ['Tiempo real (Eevee): rápido y económico', 'Real-time (Eevee): fast and affordable'] },
    'Prerender fotorrealista (Cycles / Redshift)': { kind: 'video', src: `${V}RND-02/cycles.webm`, label: ['Prerender (Cycles): luz y reflejos físicos', 'Prerender (Cycles): physical light and reflections'] },
  },
};

/** Visual de la opción elegida o, si no tiene, el de la opción disponible más cercana en la lista. */
export function optionVisual(key: string, options: string[], value: unknown): { v: OptionVisual; exact: boolean } | null {
  const map = OPTION_VISUALS[key]; if (!map) return null;
  if (typeof value === 'string' && map[value]) return { v: map[value], exact: true };
  const i = Math.max(0, options.indexOf(String(value)));
  const near = options.map((o, k) => ({ o, d: Math.abs(k - i) })).filter((x) => map[x.o]).sort((a, b) => a.d - b.d)[0];
  return near ? { v: map[near.o], exact: false } : null;
}

/** Fotos por familia del catálogo (miniaturas B9). Las familias sin foto siguen con la ilustración SVG. */
export const FAMILY_PHOTO: Record<string, string> = {
  render: `${V}catalogo/render`, 'asset-rt': `${V}catalogo/asset-rt`, datos: `${V}catalogo/cad`, 'web-3d': `${V}catalogo/web`,
  ia: `${V}catalogo/ia`, vfx: `${V}catalogo/vfx`, texturas: `${V}catalogo/texturas`, pipeline: `${V}catalogo/pipeline`,
};
