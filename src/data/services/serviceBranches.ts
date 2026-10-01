/**
 * serviceBranches.ts — Ramas guiadas GENERADAS desde el catálogo (ciclo 24, 2026-09-30).
 *
 * Antes, el wizard solo cotizaba "Una web con 3D"; video, imágenes, IA y el resto del
 * catálogo terminaban en "te cotizo personalmente". Aquí cada servicio del catálogo
 * se convierte en una rama del wizard a partir de SUS variables reales
 * (SERVICE_VARIABLES): número → slider, select → tarjetas, toggle → interruptor.
 * Así el precio sale del MISMO motor (continuousQuote) que el resto, sin preguntas
 * inventadas: cada pregunta mueve el precio porque es una variable del servicio.
 *
 * Etiquetas humanas: redactadas aquí (no técnicas); el resto del texto (pregunta,
 * ayuda, unidades, opciones) viene literal de serviceVariables.ts.
 */
import type { TreeBranch, TreeOption, TreeQuestion } from './decisionTree';
import { SERVICE_VARIABLES, recommendedValue } from './serviceVariables';
import type { ServiceVariable } from './serviceVariables';
import { SERVICES } from './catalogCore';

type Answers = Record<string, string | number | boolean | undefined>;

/** Raíces del wizard (además de web-3d) → servicios que ofrecen, con texto para el cliente. */
export const SERVICE_ROOTS: Record<string, { title: string; subtitle: string; options: TreeOption[] }> = {
  'video-anim': {
    title: '¿Qué tipo de video necesitas?',
    subtitle: 'Elige lo más parecido; ajustas los detalles en el siguiente paso.',
    options: [
      { id: 'RND-02', label: 'Animación 3D de producto', desc: 'Video renderizado: el producto gira, se arma o se muestra en acción', icon: 'film', serviceIds: ['RND-02'] },
      { id: 'VFX-01', label: 'Mi producto en un video real', desc: 'Integrar un modelo 3D en tus fotos o grabaciones', icon: 'camera', serviceIds: ['VFX-01'] },
      { id: 'VFX-02', label: 'Efectos visuales (VFX)', desc: 'Simulaciones, partículas, humo o destrucción sobre video', icon: 'sparkles', serviceIds: ['VFX-02'] },
      { id: 'VFX-03', label: 'Motion graphics 3D', desc: 'Piezas animadas para redes, intro o publicidad', icon: 'layers', serviceIds: ['VFX-03'] },
    ],
  },
  imagenes: {
    title: '¿Qué imágenes necesitas?',
    subtitle: 'Renders fotorrealistas o materiales listos para usar.',
    options: [
      { id: 'RND-01', label: 'Renders de producto', desc: 'Imágenes fotorrealistas para e-commerce, catálogo o impresión', icon: 'camera', serviceIds: ['RND-01'] },
      { id: 'RTA-01', label: 'Modelo 3D de tu producto', desc: 'Crear el modelo 3D optimizado (para web, AR o futuros renders)', icon: 'cube', serviceIds: ['RTA-01'] },
      { id: 'TEX-01', label: 'Texturas y materiales', desc: 'Sets de texturas PBR para tus modelos o tu motor', icon: 'layers', serviceIds: ['TEX-01'] },
    ],
  },
  ia: {
    title: '¿Qué quieres hacer con IA?',
    subtitle: 'Integraciones prácticas con modelos de lenguaje, medibles y con alcance cerrado.',
    options: [
      { id: 'AI-01', label: 'Un asistente en mi web', desc: 'Chat que responde con la información de tu negocio', icon: 'chat', serviceIds: ['AI-01'] },
      { id: 'AI-02', label: 'IA dentro de mi producto', desc: 'Funciones de IA en tu web o app (resúmenes, búsqueda, clasificación)', icon: 'chip', serviceIds: ['AI-02'] },
      { id: 'AI-03', label: 'Automatizar procesos internos', desc: 'Flujos con IA que ahorran horas de trabajo repetitivo', icon: 'gear', serviceIds: ['AI-03'] },
      { id: 'AI-04', label: 'Consultoría de IA', desc: 'Auditoría y hoja de ruta para adoptar IA en tu organización', icon: 'info', serviceIds: ['AI-04'] },
    ],
  },
  otros: {
    title: '¿Qué necesitas?',
    subtitle: 'Servicios técnicos 3D, web y de soporte.',
    options: [
      { id: 'CAD-01', label: 'Mi CAD en la web', desc: 'Convertir modelos CAD/STEP en 3D ligero para navegador', icon: 'cube', serviceIds: ['CAD-01'] },
      { id: 'RTA-03', label: 'Modelo animado', desc: 'Un modelo 3D con animaciones en bucle para web o app', icon: 'film', serviceIds: ['RTA-03'] },
      { id: 'WEB-07', label: 'Catálogo 3D', desc: 'Varios productos 3D navegables con filtros', icon: 'layers', serviceIds: ['WEB-07'] },
      { id: 'WEB-08', label: 'Presentación interactiva', desc: 'Una presentación web con slides y 3D', icon: 'globe', serviceIds: ['WEB-08'] },
      { id: 'PIPE-01', label: 'Herramientas y scripts', desc: 'Automatizar tu pipeline 3D (Blender, exportes, validaciones)', icon: 'gear', serviceIds: ['PIPE-01'] },
      { id: 'CON-01', label: 'Consultoría técnica', desc: 'Sesiones para resolver dudas de 3D o web', icon: 'chat', serviceIds: ['CON-01'] },
      { id: 'RET-01', label: 'Soporte mensual', desc: 'Horas fijas al mes para mantenimiento y mejoras', icon: 'info', serviceIds: ['RET-01'] },
    ],
  },
};

/** Valor por defecto de una variable (mostrado = cotizado). */
export function variableDefault(v: ServiceVariable): string | number | boolean {
  // Recomendación explícita del catálogo, si existe.
  const rec = v.recommendedFor?.default;
  if (rec !== undefined) return rec;
  // Número sin recomendación: tope de la talla S (proyecto típico pequeño). El punto
  // medio del rango (recommendedValue) inflaba el arranque (p.ej. 90 s de video).
  if (v.type === 'number' && v.tierMap?.length) {
    const s = v.tierMap[0].maxVal;
    return Math.max(v.min ?? s, Math.min(v.max ?? s, s));
  }
  const r = recommendedValue(v, 'default');
  if (r !== null) return r;
  if (v.type === 'number') return v.min ?? 1;
  if (v.type === 'toggle') return false;
  return v.opciones?.[0]?.valorEs ?? '';
}

const toQuestion = (v: ServiceVariable): TreeQuestion | null => {
  if (v.ocultarEnConfig) return null;
  if (v.type === 'number') {
    const def = variableDefault(v) as number;
    return {
      id: v.id, question: v.preguntaEs, help: v.ayudaEs, type: 'slider',
      slider: {
        min: v.min ?? 1, max: v.max ?? 10, step: v.step ?? 1, unit: v.unidadEs ?? '',
        defaultValue: def,
        tierMap: v.tierMap?.map((t) => ({ max: t.maxVal, tier: t.tier })),
      },
    };
  }
  if (v.type === 'select') {
    return {
      id: v.id, question: v.preguntaEs, help: v.ayudaEs, type: 'cards',
      options: (v.opciones ?? []).map((o) => ({ id: o.valorEs, label: o.valorEs })),
    };
  }
  if (v.type === 'toggle') return { id: v.id, question: v.preguntaEs, help: v.ayudaEs, type: 'toggle' };
  return null;
};

/** Rama del wizard para un servicio del catálogo (null si no tiene variables). */
export function buildServiceBranch(serviceId: string): TreeBranch | null {
  const cfg = SERVICE_VARIABLES[serviceId];
  const svc = SERVICES.find((s) => s.id === serviceId);
  if (!cfg || !svc) return null;
  const opt = Object.values(SERVICE_ROOTS).flatMap((r) => r.options).find((o) => o.id === serviceId);
  return {
    id: `svc:${serviceId}`,
    title: opt?.label ?? svc.nameEs,
    subtitle: svc.descripcionEs,
    questions: cfg.variables.map(toQuestion).filter((q): q is TreeQuestion => q !== null),
  };
}

/** Valores de las variables del servicio: respuesta del cliente o default visible. */
export function serviceValsFromAnswers(serviceId: string, answers: Answers): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  for (const v of SERVICE_VARIABLES[serviceId]?.variables ?? []) {
    const a = answers[v.id];
    out[v.id] = a === undefined ? variableDefault(v) : a;
  }
  return out;
}

export const isServiceRoot = (root: string): boolean => root in SERVICE_ROOTS;
