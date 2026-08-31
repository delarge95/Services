import { SERVICES } from './catalogCore';
import type { ServiceDef } from './catalogCore';
import { computeQuote } from './formula';
import type { Currency } from './types';

export interface GoalDef {
  id: string;
  icon: string;
  labelEs: string;
  descEs: string;
}

export const GOALS: GoalDef[] = [
  { id: 'mostrar-web', icon: '🌐', labelEs: 'Mostrar mi producto en 3D en la web', descEs: 'Visores, catálogos, presentaciones' },
  { id: 'video-redes', icon: '🎬', labelEs: 'Video o animación para redes y campañas', descEs: 'Renders animados, VFX, motion' },
  { id: 'imagenes-producto', icon: '📸', labelEs: 'Imágenes de producto', descEs: 'E-commerce, print, marketing' },
  { id: 'interactivo-ventas', icon: '🕹️', labelEs: 'Interactivo para vendedores o ferias', descEs: 'Hotspots, configuradores, minijuegos' },
  { id: 'ia-negocio', icon: '🤖', labelEs: 'IA en mi web o negocio', descEs: 'Chat RAG, automatización, consultoría' },
  { id: 'no-se', icon: '❓', labelEs: 'No sé exactamente', descEs: 'Ver todo el catálogo con guía' },
];

// Objetivo → servicios que lo resuelven (los transversales CON/RET/PIPE viven solo en "Todos").
export const SERVICE_GOALS: Record<string, string[]> = {
  'RND-01': ['imagenes-producto'],
  'RND-02': ['video-redes'],
  'RTA-01': ['mostrar-web', 'interactivo-ventas'],
  'RTA-02': ['interactivo-ventas', 'mostrar-web'],
  'RTA-03': ['mostrar-web'],
  'RTA-04': ['interactivo-ventas'],
  'RTA-05': ['mostrar-web', 'interactivo-ventas'],
  'RTA-06': ['interactivo-ventas'],
  'CAD-01': ['mostrar-web', 'imagenes-producto'],
  'TEX-01': ['imagenes-producto', 'mostrar-web'],
  'WEB-01': ['mostrar-web', 'interactivo-ventas'],
  'WEB-02': ['mostrar-web'],
  'WEB-03': ['mostrar-web', 'interactivo-ventas'],
  'WEB-04': ['interactivo-ventas'],
  'WEB-05': ['mostrar-web', 'video-redes'],
  'WEB-06': ['interactivo-ventas'],
  'WEB-07': ['mostrar-web'],
  'WEB-08': ['mostrar-web'],
  'AI-01': ['ia-negocio'],
  'AI-02': ['ia-negocio'],
  'AI-03': ['ia-negocio'],
  'AI-04': ['ia-negocio'],
  'VFX-01': ['video-redes'],
  'VFX-02': ['video-redes'],
  'VFX-03': ['video-redes'],
};

export function servicesForGoal(goalId: string): ServiceDef[] {
  if (goalId === 'no-se') return SERVICES;
  return SERVICES.filter((s) => (SERVICE_GOALS[s.id] ?? []).includes(goalId));
}

/** Precio "desde" para tarjetas de servicio (nivel mínimo soportado, sin descuentos). */
export function minPriceOf(serviceId: string, currency: Currency): number | null {
  try {
    const q = computeQuote(serviceId, 'XS', currency, {});
    return q && q.totalMin > 0 ? q.totalMin : null;
  } catch {
    return null;
  }
}
