/**
 * variableEffects.ts — Efectos de las variables sobre las HORAS (ciclo 44c, 2026-10-08).
 * Datos en variableEffects.json (fuente de verdad, editable desde el Excel → importar-excel.py).
 *  · porUnidad: cada unidad por encima de «incluidas» suma sus horas (imágenes, segundos, productos…).
 *  · extra: al cumplirse «cuando» (interruptor u opción) suma horas propias (login, audio, carrito…).
 *  · reemplaza: las horas del proyecto son las de la opción elegida (planes del retainer).
 * Las variables con efecto NO mueven la talla del proyecto (evita contarlas dos veces).
 */
import data from './variableEffects.json';
import type { RateClass } from './types';

export type Effect =
  | { var: string; kind: 'porUnidad'; incluidas: number; horas: [number, number]; rateClass: RateClass; origen?: string }
  | { var: string; kind: 'extra'; cuando: boolean | string; horas: [number, number]; rateClass: RateClass; origen?: string }
  | { var: string; kind: 'reemplaza'; opciones: Record<string, { horas: number; rateClass: RateClass }>; origen?: string };

export const EFFECTS = (data as unknown as { servicios: Record<string, Effect[]> }).servicios;
export const JORNADA = (data as unknown as { jornada: { horasDia: number; horasDiaMin: number; horasDiaMax: number; diasRevision: number } }).jornada;

export const effectsOf = (serviceId: string): Effect[] => EFFECTS[serviceId] ?? [];
export const hasEffect = (serviceId: string, varId: string) => effectsOf(serviceId).some((e) => e.var === varId);

export type EffectLine = { id: string; nameEs: string; rateClass: RateClass; hours: number };
type Vals = Record<string, number | string | boolean | undefined | null>;

/** Horas que suman los efectos (punto medio de cada rango). `replace` = horas que sustituyen a las subtareas. */
export function effectHours(serviceId: string, vals: Vals): { lines: EffectLine[]; replace: EffectLine | null } {
  const lines: EffectLine[] = []; let replace: EffectLine | null = null;
  for (const e of effectsOf(serviceId)) {
    const v = vals[e.var];
    if (e.kind === 'porUnidad') {
      const n = Math.max(0, Number(v ?? e.incluidas) - e.incluidas);
      if (n > 0) lines.push({ id: `fx-${e.var}`, nameEs: `${e.var}: ${n} unidad(es) adicionales`, rateClass: e.rateClass, hours: n * (e.horas[0] + e.horas[1]) / 2 });
    } else if (e.kind === 'extra') {
      const on = typeof e.cuando === 'boolean' ? (v ?? false) === e.cuando : v === e.cuando;
      if (on) lines.push({ id: `fx-${e.var}`, nameEs: `${e.var}`, rateClass: e.rateClass, hours: (e.horas[0] + e.horas[1]) / 2 });
    } else {
      const opts = Object.entries(e.opciones);
      const o = (typeof v === 'string' && e.opciones[v]) || opts.sort((a, b) => a[1].horas - b[1].horas)[0][1];
      replace = { id: `fx-${e.var}`, nameEs: `${e.var}: ${typeof v === 'string' ? v : opts[0][0]}`, rateClass: o.rateClass, hours: o.horas };
    }
  }
  return { lines, replace };
}

/**
 * Plazo en días hábiles a partir de las horas (ciclo 44c): horas ÷ horas productivas por día + días de revisión.
 * Normal 8 h/día; urgencia «pronto» y «crítico» a 12 h/día; «crítico» sin espera de revisión.
 */
export function deliveryDays(hoursMin: number, hoursMax: number, urgencyPct = 0): [number, number] {
  const perDay = urgencyPct > 0 ? JORNADA.horasDiaMax : JORNADA.horasDia;
  const rev = urgencyPct >= 50 ? 0 : JORNADA.diasRevision;
  return [Math.max(1, Math.ceil(hoursMin / perDay) + rev), Math.max(1, Math.ceil(hoursMax / perDay) + rev)];
}
