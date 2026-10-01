/**
 * basicAssistant.ts — Modo BÁSICO reforzado del asistente (ciclo 26, 2026-09-30).
 *
 * Se usa cuando la IA no está disponible (sin endpoint, cuota agotada, error, timeout)
 * y como red de seguridad. Reglas duras:
 *  R1. Toda cifra sale de tools.ts (motor real). Nunca se escribe un número a mano.
 *  R2. Si falta el servicio, se PREGUNTA (con opciones), no se adivina.
 *  R3. Si hay servicio, se cotiza con los datos dados + defaults, y se dicen los supuestos
 *      y qué dato cambiaría más el precio.
 *  R4. Toda respuesta sobre un servicio trae la acción "Abrir en el cotizador".
 *  R5. Fuera de alcance → se dice con honestidad y se redirige (sin inventar).
 *  R6. La conversación recuerda el último servicio ("¿y con 10?").
 */
import { SERVICES } from '../../../data/services/catalogCore';
import { SERVICE_VARIABLES } from '../../../data/services/serviceVariables';
import type { Currency } from '../../../data/services/types';
import { normalize, matchIntent, matchIntentId } from './chatIntents';
import type { ChatContext } from './chatIntents';
import { detectService, extractQuantities } from './quoteAssistant';
import { quoteTool, explainTool, serviceDetails, listServices, fmtMoney, displayName, LINE_LABELS, CURRENCY_NOTE } from './tools';
import type { OpenQuoteAction } from './deepLink';
import { openQuoteAction } from './deepLink';
import { SERVICE_ROOTS } from '../../../data/services/serviceBranches';

type Val = string | number | boolean;

export interface AssistantReply {
  text: string;
  actions: OpenQuoteAction[];
  chips: string[];
  /** Servicio sobre el que versa la respuesta (memoria de conversación). */
  serviceId?: string;
  /** Valores usados (memoria: "¿y más barato?" conserva los datos ya dados). */
  vals?: Record<string, Val>;
  source: 'rules' | 'ai';
}

export interface BasicContext {
  currency: Currency;
  serviceId?: string;
  vals?: Record<string, Val>;
  lastServiceId?: string;
  /** Valores dados antes para lastServiceId. */
  lastVals?: Record<string, Val>;
}

const has = (q: string, kws: string[]) => kws.some((k) => q.includes(k));
const K = {
  price: ['cuanto', 'precio', 'cuesta', 'vale', 'cotiza', 'presupuesto', 'costo', 'cobras', 'tarifa', 'valor'],
  include: ['incluye', 'entregable', 'que recibo', 'me entregas', 'que obtengo', 'que trae'],
  time: ['tarda', 'demora', 'plazo', 'cuanto tiempo', 'dias', 'cuando estaria', 'semanas'],
  why: ['por que', 'desglose', 'de donde sale', 'como se calcula', 'explica', 'justifica'],
  cheaper: ['mas barato', 'economico', 'reducir', 'bajar el precio', 'abaratar', 'ahorrar', 'menos plata', 'presupuesto limitado'],
  compare: ['diferencia', 'comparar', ' vs ', 'versus', 'mejor opcion', 'cual me conviene'],
  list: ['que servicios', 'que ofreces', 'que haces', 'catalogo', 'servicios hay', 'que puedo cotizar', 'opciones tienes'],
  hello: ['hola', 'buenas', 'buenos dias', 'buenas tardes', 'hey'],
  needs: ['que necesito', 'que debo enviar', 'que te mando', 'para empezar', 'requisitos'],
  offTopic: ['clima', 'futbol', 'receta', 'chiste', 'politica', 'tarea de', 'poema', 'programame', 'escribe un codigo'],
};

const lineChips = () => ['Una web con 3D', 'Un video o animación', 'Imágenes de producto', 'Inteligencia artificial'];

/** Detecta hasta 2 servicios distintos (para comparaciones). */
function detectTwo(input: string): string[] {
  const first = detectService(input)?.id;
  if (!first) return [];
  const parts = normalize(input).split(/\s+(?:vs|versus|o|contra|y)\s+/);
  const ids = new Set<string>([first]);
  for (const p of parts) { const d = detectService(p)?.id; if (d) ids.add(d); }
  return [...ids].slice(0, 2);
}

/** Ciclo 26: opciones de variables select mencionadas en el texto ("4K", "Houdini", "solo IA"…).
 *  Se comparan la etiqueta y los términos entre paréntesis/barras de cada opción; gana el más largo. */
/** ¿`term` aparece como palabra/frase completa dentro de `text` (ambos normalizados)? */
const wordIn = (text: string, term: string): boolean => {
  const isAlnum = (c: string | undefined) => !!c && /[a-z0-9]/.test(c);
  let from = 0;
  for (;;) {
    const i = text.indexOf(term, from);
    if (i < 0) return false;
    if (!isAlnum(text[i - 1]) && !isAlnum(text[i + term.length])) return true;
    from = i + 1;
  }
};

export function extractOptions(id: string, input: string): Record<string, string> {
  const q = ` ${normalize(input)} `;
  const out: Record<string, string> = {};
  for (const v of (SERVICE_VARIABLES[id]?.variables ?? []).filter((x) => x.type === 'select')) {
    let best: { val: string; len: number } | null = null;
    for (const o of v.opciones ?? []) {
      const n = normalize(o.valorEs);
      const main = n.replace(/\(.*?\)/g, '').trim();
      const extra = (n.match(/\((.*?)\)/)?.[1] ?? '').split(/[\/,]| y | o /).map((t) => t.trim());
      for (const t of [main, ...extra]) {
        if (t.length >= 2 && wordIn(q, t) && (!best || t.length > best.len)) best = { val: o.valorEs, len: t.length };
      }
    }
    if (best) out[v.id] = best.val;
  }
  return out;
}

/** La variable que más mueve el precio y no dio el cliente (para pedirla). */
function keyMissingVariable(id: string, given: string[]): string | null {
  const v = (SERVICE_VARIABLES[id]?.variables ?? []).find((x) => x.type === 'number' && x.tierMap?.length && !given.includes(x.id));
  return v ? v.preguntaEs : null;
}

export function basicReply(input: string, ctx: BasicContext): AssistantReply {
  const q = normalize(input.trim()).slice(0, 500);
  const cur = ctx.currency;
  const mentioned = detectService(input)?.id;
  const svcId = mentioned ?? ctx.lastServiceId ?? ctx.serviceId;
  const general = matchIntentId(input);

  // Chips de línea → opciones de esa línea con acceso directo a cada una
  const LINE_BY_CHIP: Record<string, string> = { 'una web con 3d': 'web-3d', 'un video o animacion': 'video-anim', 'imagenes de producto': 'imagenes', 'inteligencia artificial': 'ia', 'servicios tecnicos y soporte': 'otros' };
  const line = LINE_BY_CHIP[q.replace(/[¿?.!]/g, '').trim()];
  if (line) {
    if (line === 'web-3d') {
      const subs: [string, string][] = [['ver-modelo', 'Solo mostrar el producto en 3D'], ['interactivo', 'Que el visitante interactúe (info, configurar, desarmar)'], ['scrollytelling', 'Contar una historia con scroll'], ['web-app', 'Aplicación web 3D completa']];
      return { text: 'Webs con 3D: elige el tipo de experiencia y te llevo a sus preguntas.', actions: subs.map(([sub, label]) => ({ label, target: { kind: 'wizard' as const, rootChoice: 'web-3d', subChoice: sub, answers: {} } })), chips: [], source: 'rules' };
    }
    const r = SERVICE_ROOTS[line];
    return { text: [r.title, ...r.options.map((o) => `• ${o.label}: ${o.desc}`)].join('\n'), actions: r.options.map((o) => openQuoteAction(o.id, {}, o.label)!).filter(Boolean), chips: [], source: 'rules' };
  }

  // R5 — fuera de alcance
  if (has(q, K.offTopic) && !mentioned) {
    return { text: 'Solo puedo ayudarte con los servicios de este cotizador (3D, web, video, imágenes e IA aplicada): precios, plazos, alcance y proceso. ¿Qué te gustaría cotizar?', actions: [], chips: lineChips(), source: 'rules' };
  }
  // catálogo
  if (has(q, K.list)) {
    const by: Record<string, string[]> = {};
    for (const s of listServices()) (by[s.linea] ??= []).push(s.nombre);
    const text = Object.entries(by).map(([l, ns]) => `• ${l}: ${ns.join(', ')}`).join('\n');
    return { text: `Puedes cotizar aquí mismo:\n${text}\n\nDime qué quieres lograr o pregúntame un precio con cantidades, p. ej. “video de producto de 30 segundos”.`, actions: [], chips: lineChips(), source: 'rules' };
  }
  // moneda
  if (has(q, ['cop', 'usd', 'dolar', 'pesos', 'moneda', 'trm', 'internacional', 'nacional'])) {
    return { text: CURRENCY_NOTE + ' Cambias de moneda arriba a la derecha.', actions: [], chips: [], source: 'rules' };
  }
  // qué necesito para empezar
  if (has(q, K.needs)) {
    const d = svcId ? serviceDetails(svcId) : null;
    const extra = d && !('error' in d) ? `\nPara ${d.nombre} ayuda tener: referencias visuales, archivos fuente si existen (CAD/3D), y estos datos: ${d.variables.slice(0, 3).map((v) => v.pregunta.replace(/[¿?]/g, '')).join('; ')}.` : '';
    return { text: `Para empezar: una descripción breve del objetivo, referencias y la fecha límite. Con eso respondo en menos de 24 h y, si avanzamos, se agenda con 50 % de anticipo.${extra}`, actions: svcId ? [openQuoteAction(svcId, {})!].filter(Boolean) : [], chips: [], serviceId: svcId, source: 'rules' };
  }
  // reglas comerciales generales (pago, proceso, revisiones, contacto…) si no se pide precio
  if (general && ['pago', 'proceso', 'revisiones', 'whitelabel', 'contacto', 'archivos', 'urgencia'].includes(general) && !has(q, K.price)) {
    return { text: matchIntent(input, { section: 'inicio', contactEmail: '' } as ChatContext) ?? '', actions: [], chips: [], serviceId: svcId, source: 'rules' };
  }
  // comparación
  if (has(q, K.compare)) {
    const two = detectTwo(input);
    if (two.length === 2) {
      const [a, b] = two.map((id) => quoteTool(id, {}, cur));
      const da = serviceDetails(two[0]), db = serviceDetails(two[1]);
      const txt = [a, b].map((r, i) => {
        const d = i === 0 ? da : db;
        return `• ${r.nombre}: desde ${r.rangoTexto} con valores típicos. ${'descripcion' in d ? d.descripcion : ''}`;
      }).join('\n');
      return { text: `${txt}\nLa elección depende de tu objetivo; si me dices para qué lo usarás, te digo cuál conviene.`, actions: two.map((id) => openQuoteAction(id, {}, `Cotizar ${displayName(id)}`)!).filter(Boolean), chips: [], serviceId: two[0], source: 'rules' };
    }
  }
  // R2 — pregunta de precio sin servicio identificable → preguntar
  if (!svcId) {
    if (has(q, K.price) || has(q, K.time) || has(q, K.include)) {
      return { text: '¿Qué te gustaría cotizar? Elige una línea o descríbelo en una frase (p. ej. “renders de mi producto”, “chatbot para mi web”).', actions: [], chips: lineChips(), source: 'rules' };
    }
    if (has(q, K.hello)) {
      return { text: '¡Hola! Te ayudo a estimar tu proyecto con precios reales. ¿Qué quieres lograr?', actions: [], chips: lineChips(), source: 'rules' };
    }
    const g = matchIntent(input, { section: 'inicio', contactEmail: '' } as ChatContext);
    return { text: g ?? 'No logré entender qué necesitas. ¿Es una web con 3D, un video, imágenes o algo con IA? También puedes escribirme a 3d@alexwoodcock.me.', actions: [], chips: lineChips(), source: 'rules' };
  }

  const given: Record<string, Val> = { ...extractQuantities(svcId, input), ...extractOptions(svcId, input) };
  // memoria: valores de la pantalla (si es ese servicio) y los ya dados en la conversación
  const baseVals: Record<string, Val> = {
    ...(ctx.serviceId === svcId && ctx.vals ? ctx.vals : {}),
    ...(ctx.lastServiceId === svcId && ctx.lastVals ? ctx.lastVals : {}),
  };
  const vals = { ...baseVals, ...given };
  const name = displayName(svcId);

  if (has(q, K.why)) {
    const e = explainTool(svcId, vals, cur);
    if ('error' in e) return { text: String(e.error), actions: [], chips: [], source: 'rules' };
    const body = e.tareas.slice(0, 6).map((t) => `• ${t.tarea}: ${t.horas} h × ${fmtMoney(cur, t.tarifaHora)}/h (${t.rol})`).join('\n');
    const enc = e.queLoEncarece.length ? `\nLo que más lo encarece: ${e.queLoEncarece.map((d) => `${d.variable.replace(/[¿?]/g, '')} (${d.ahorroTexto} menos si se reduce)`).join('; ')}.` : '';
    return { text: `Así se calcula ${name}:\n${body}\n${e.tarifas}; banda ±${e.bandaPct} %.${enc}`, actions: [openQuoteAction(svcId, vals)!].filter(Boolean), chips: ['¿Cómo lo hago más barato?', '¿Qué incluye?'], serviceId: svcId, vals, source: 'rules' };
  }
  if (has(q, K.cheaper)) {
    const e = explainTool(svcId, vals, cur);
    if ('error' in e || !e.queLoEncarece.length) {
      return { text: `${name} ya está en su alcance mínimo con estos datos. Otra vía: entregar por fases (lo esencial primero).`, actions: [openQuoteAction(svcId, vals)!].filter(Boolean), chips: [], serviceId: svcId, source: 'rules' };
    }
    return { text: `Para bajar el precio de ${name}:\n${e.queLoEncarece.map((d) => `• Reducir “${d.variable.replace(/[¿?]/g, '')}” (hoy: ${d.valorActual}) ahorra ${d.ahorroTexto}.`).join('\n')}\nTambién puedes empezar por una fase esencial y ampliar después.`, actions: [openQuoteAction(svcId, vals, 'Ajustar en el cotizador')!].filter(Boolean), chips: ['¿Por qué este precio?'], serviceId: svcId, vals, source: 'rules' };
  }
  if (has(q, K.include)) {
    const d = serviceDetails(svcId);
    if ('error' in d) return { text: String(d.error), actions: [], chips: [], source: 'rules' };
    const no = d.noIncluye.length ? `\nNo incluye: ${d.noIncluye.slice(0, 3).join('; ')}.` : '';
    return { text: `${name} incluye:\n${d.entregables.slice(0, 6).map((e) => `• ${e}`).join('\n')}${no}`, actions: [openQuoteAction(svcId, vals)!].filter(Boolean), chips: ['¿Cuánto cuesta?', '¿Cuánto tarda?'], serviceId: svcId, source: 'rules' };
  }
  if (has(q, K.time) && !has(q, K.price)) {
    const s = SERVICES.find((x) => x.id === svcId)!;
    const t = s.entregaDiasEs ? `${s.entregaDiasEs[0]}–${s.entregaDiasEs[1]} días hábiles según el alcance` : 'se acuerda en el brief según el alcance';
    const qt = quoteTool(svcId, vals, cur);
    return { text: `${name}: ${t}, contados desde el anticipo y el material completo. Con tus datos son ≈ ${qt.horasEstimadas} h de trabajo. Con urgencia (+25 % / +50 %) se acorta según disponibilidad.`, actions: [openQuoteAction(svcId, vals)!].filter(Boolean), chips: ['¿Cuánto cuesta?'], serviceId: svcId, source: 'rules' };
  }
  // R3 — cotización (por defecto cuando hay servicio)
  const r = quoteTool(svcId, vals, cur);
  if (!r.ok) return { text: r.error ?? 'No pude cotizar.', actions: [], chips: [], source: 'rules' };
  const tuyos = (r.tusDatos ?? []).length ? `Con tus datos (${r.tusDatos!.map((k) => `${k}: ${r.valoresUsados![k]}`).join(', ')}) ` : 'Con valores típicos ';
  const missing = keyMissingVariable(svcId, r.tusDatos ?? []);
  const ask = missing ? `\nPara afinarlo dime: ${missing}` : '';
  const avisos = r.avisos?.length ? `\nNota: ${r.avisos.join(' ')}` : '';
  const dias = r.entregaDiasHabiles ? ` Entrega: ${r.entregaDiasHabiles[0]}–${r.entregaDiasHabiles[1]} días hábiles.` : '';
  return {
    text: `${tuyos}${name} sale en ${r.rangoTexto} (≈ ${r.horasEstimadas} h).${dias}${ask}${avisos}`,
    actions: r.accion ? [r.accion] : [], chips: ['¿Por qué este precio?', '¿Qué incluye?', '¿Cómo lo hago más barato?'],
    serviceId: svcId, vals: Object.fromEntries((r.tusDatos ?? []).map((k) => [k, r.valoresUsados![k]])), source: 'rules',
  };
}

/** Línea de cada raíz para los chips de arranque → frase que entiende basicReply. */
export const ROOT_CHIP_TO_PROMPT: Record<string, string> = Object.fromEntries(
  Object.entries(SERVICE_ROOTS).map(([k]) => [LINE_LABELS[k], `¿Qué opciones hay de ${LINE_LABELS[k].toLowerCase()}?`]),
);
