/**
 * deepLink.ts — "Abrir en el cotizador" (ciclo 26, 2026-09-30).
 *
 * Traduce (servicio + valores) a la ubicación EXACTA del cotizador: rama del wizard
 * con respuestas precargadas o, si el servicio no tiene rama guiada, la vista de
 * configuración con sus valores. Lo usan el asistente con IA y el modo básico.
 * El destino se abre con el evento `cx-open-quote` (lo escuchan GuidedWizard y
 * CotizadorRedesign) — sin recargar la página.
 */
import { SERVICE_ROOTS } from '../../../data/services/serviceBranches';
import { SERVICES } from '../../../data/services/catalogCore';

type Val = string | number | boolean;

export type QuoteTarget =
  | { kind: 'wizard'; rootChoice: string; subChoice: string; answers: Record<string, Val> }
  | { kind: 'config'; serviceId: string; vals: Record<string, Val> };

export interface OpenQuoteAction { label: string; target: QuoteTarget }

/** Servicios de la rama "Web con 3D": rama + respuesta fija que los selecciona. */
const WEB3D_MAP: Record<string, { sub: string; answers?: Record<string, Val> }> = {
  'WEB-01': { sub: 'ver-modelo' },
  'WEB-05': { sub: 'scrollytelling' },
  'WEB-04': { sub: 'web-app', answers: { 'tipo-app': 'configurador' } },
  'WEB-06': { sub: 'web-app', answers: { 'tipo-app': 'juego' } },
  'RTA-06': { sub: 'interactivo', answers: { 'tipo-interactividad': 'desarmar' } },
};

/** Variables del catálogo → id de pregunta del wizard web-3d (las que coinciden en significado). */
const WEB3D_VAR_TO_Q: Record<string, Record<string, (v: Val) => [string, Val] | null>> = {
  'WEB-05': { numSecciones: (v) => ['escenas', Number(v)] },
  'WEB-04': { numVariantes: (v) => ['num-variantes', Number(v)] },
  'WEB-01': { numHotspots: (v) => (Number(v) > 0 ? ['num-hotspots', Number(v)] : null) },
};

export function rootOf(serviceId: string): string | null {
  for (const [root, r] of Object.entries(SERVICE_ROOTS)) if (r.options.some((o) => o.id === serviceId)) return root;
  return null;
}

/** Destino del cotizador para un servicio con ciertos valores de sus variables. */
export function targetFor(serviceId: string, vals: Record<string, Val> = {}): QuoteTarget | null {
  if (!SERVICES.some((s) => s.id === serviceId)) return null;
  const root = rootOf(serviceId);
  if (root) return { kind: 'wizard', rootChoice: root, subChoice: serviceId, answers: { ...vals } };
  const w = WEB3D_MAP[serviceId];
  if (w) {
    const answers: Record<string, Val> = { ...(w.answers ?? {}) };
    if (serviceId === 'WEB-01' && Number(vals.numHotspots) > 0) answers['tipo-interactividad'] = 'hotspots';
    for (const [k, v] of Object.entries(vals)) {
      const m = WEB3D_VAR_TO_Q[serviceId]?.[k]?.(v);
      if (m) answers[m[0]] = m[1];
    }
    const sub = serviceId === 'WEB-01' && answers['tipo-interactividad'] ? 'interactivo' : w.sub;
    return { kind: 'wizard', rootChoice: 'web-3d', subChoice: sub, answers };
  }
  return { kind: 'config', serviceId, vals: { ...vals } };
}

export function openQuoteAction(serviceId: string, vals: Record<string, Val> = {}, label?: string): OpenQuoteAction | null {
  const target = targetFor(serviceId, vals);
  if (!target) return null;
  return { label: label ?? 'Abrir en el cotizador', target };
}

/** Dispara la navegación (solo en navegador). */
export function openInCotizador(target: QuoteTarget): void {
  // globalThis: este módulo también se empaqueta en el worker (sin DOM)
  const w = (globalThis as unknown as { window?: { dispatchEvent: (e: Event) => boolean } }).window;
  if (!w) return;
  w.dispatchEvent(new CustomEvent('cx-open-quote', { detail: target }));
}
