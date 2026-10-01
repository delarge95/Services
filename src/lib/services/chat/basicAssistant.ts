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
import { VARS_EN, CATALOG_EN } from '../../../data/services/i18n';
import { SERVICE_ROOTS_EN } from '../../../data/services/i18nMore';

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
  /** Ciclo 30: idioma del visitante (respuestas en ese idioma). */
  lang?: 'es' | 'en';
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

/** Ciclo 30: nombre del servicio en el idioma del visitante. */
function nameIn(id: string, en: boolean): string {
  if (!en) return displayName(id);
  for (const r of Object.values(SERVICE_ROOTS_EN)) if (r.options[id]) return r.options[id].label;
  return CATALOG_EN[id]?.name ?? displayName(id);
}
/** Valor legible ("10 imágenes", "4K", "3 channels"), nunca el id interno de la variable. */
function fmtVal(id: string, k: string, v: Val, en: boolean): string {
  const vr = SERVICE_VARIABLES[id]?.variables.find((x) => x.id === k);
  const e = VARS_EN[id]?.[k];
  if (!vr) return `${k}: ${v}`;
  if (vr.type === 'number') return `${v} ${en ? e?.unit ?? vr.unidadEs ?? '' : vr.unidadEs ?? ''}`.trim();
  if (vr.type === 'toggle') return `${(en ? e?.question ?? vr.preguntaEs : vr.preguntaEs).replace(/[¿?]/g, '')}: ${v ? (en ? 'yes' : 'sí') : 'no'}`;
  return en ? e?.opciones?.[String(v)] ?? String(v) : String(v);
}
const qText = (id: string, vid: string, en: boolean) => {
  const vr = SERVICE_VARIABLES[id]?.variables.find((x) => x.id === vid);
  return ((en ? VARS_EN[id]?.[vid]?.question : undefined) ?? vr?.preguntaEs ?? vid).replace(/[¿?]/g, '');
};
const ROLE_EN: Record<string, string> = { 'Arte 3D': '3D art', 'Asset RT': 'Real-time assets', 'Dev Web 3D': '3D web development', 'IA aplicada': 'Applied AI', 'Consultoría': 'Consulting' };
const GENERAL_EN: Record<string, string> = {
  pago: '50% upfront to book the slot and 50% on delivery. Standard electronic invoicing. AI API/server costs are paid by the client (BYOK).',
  proceso: 'Flow: you get an estimate here → short brief (reply in <24 h) → 50% deposit → production with progress updates → 2 revision rounds included → delivery + guide.',
  revisiones: '2 revision rounds are included. Out-of-scope changes are estimated and approved before any work: no surprises.',
  whitelabel: 'Yes, white-label work with agencies: you are the face to your client and I am your invisible technical team.',
  contacto: 'Write to 3d@alexwoodcock.me or use the WhatsApp button under the estimate. Replies in less than 24 h.',
  archivos: 'You can drop your files in the 📎 area of the result: format and size are checked in your browser (nothing is uploaded). STEP/Blender/GLB are ideal sources.',
  urgencia: 'Timelines: standard goes into the normal queue; "Soon" +25% and "Critical" +50% depending on availability — confirmed by chat/email before starting.',
};

export function basicReply(input: string, ctx: BasicContext): AssistantReply {
  const en = ctx.lang === 'en';
  const T = (es: string, enText: string) => (en ? enText : es);
  const q = normalize(input.trim()).slice(0, 500);
  const cur = ctx.currency;
  const mentioned = detectService(input)?.id;
  const svcId = mentioned ?? ctx.lastServiceId ?? ctx.serviceId;
  const general = matchIntentId(input) ?? (en ? matchIntentIdEn(q) : null);
  const chipsLines = en ? ['A 3D website', 'A video or animation', 'Product images', 'Artificial intelligence'] : lineChips();
  const money = (t: string | undefined) => (en ? (t ?? '').replace('(proyecto mínimo)', '(minimum project)') : t ?? '');

  // Chips de línea → opciones de esa línea con acceso directo a cada una
  const LINE_BY_CHIP: Record<string, string> = {
    'una web con 3d': 'web-3d', 'un video o animacion': 'video-anim', 'imagenes de producto': 'imagenes', 'inteligencia artificial': 'ia', 'servicios tecnicos y soporte': 'otros',
    'a 3d website': 'web-3d', 'a video or animation': 'video-anim', 'product images': 'imagenes', 'artificial intelligence': 'ia', 'technical services & support': 'otros',
  };
  const line = LINE_BY_CHIP[q.replace(/[¿?.!]/g, '').trim()];
  if (line) {
    if (line === 'web-3d') {
      const subs: [string, string, string][] = [
        ['ver-modelo', 'Solo mostrar el producto en 3D', 'Just display the product in 3D'],
        ['interactivo', 'Que el visitante interactúe (info, configurar, desarmar)', 'Let visitors interact (info, configure, disassemble)'],
        ['scrollytelling', 'Contar una historia con scroll', 'Tell a story with scroll'],
        ['web-app', 'Aplicación web 3D completa', 'Full 3D web application'],
      ];
      return { text: T('Webs con 3D: elige el tipo de experiencia y te llevo a sus preguntas.', '3D websites: pick the kind of experience and I will take you to its questions.'), actions: subs.map(([sub, es, e]) => ({ label: en ? e : es, target: { kind: 'wizard' as const, rootChoice: 'web-3d', subChoice: sub, answers: {} } })), chips: [], source: 'rules' };
    }
    const r = SERVICE_ROOTS[line];
    const rEn = SERVICE_ROOTS_EN[line];
    const lbl = (o: { id: string; label: string; desc?: string }) => (en ? rEn?.options[o.id] ?? o : o);
    return { text: [en ? rEn?.title ?? r.title : r.title, ...r.options.map((o) => `• ${lbl(o).label}: ${lbl(o).desc ?? ''}`)].join('\n'), actions: r.options.map((o) => openQuoteAction(o.id, {}, lbl(o).label)!).filter(Boolean), chips: [], source: 'rules' };
  }

  // R5 — fuera de alcance
  if ((has(q, K.offTopic) || (en && has(q, K_EN.offTopic))) && !mentioned) {
    return { text: T('Solo puedo ayudarte con los servicios de este cotizador (3D, web, video, imágenes e IA aplicada): precios, plazos, alcance y proceso. ¿Qué te gustaría cotizar?', 'I can only help with the services in this estimator (3D, web, video, images and applied AI): prices, timelines, scope and process. What would you like to estimate?'), actions: [], chips: chipsLines, source: 'rules' };
  }
  // catálogo
  if (has(q, K.list) || (en && has(q, K_EN.list))) {
    const by: Record<string, string[]> = {};
    for (const s of listServices()) (by[en ? LINE_EN[s.linea] ?? s.linea : s.linea] ??= []).push(nameIn(s.id, en));
    const text = Object.entries(by).map(([l, ns]) => `• ${l}: ${ns.join(', ')}`).join('\n');
    return { text: T(`Puedes cotizar aquí mismo:\n${text}\n\nDime qué quieres lograr o pregúntame un precio con cantidades, p. ej. “video de producto de 30 segundos”.`, `You can get an estimate right here:\n${text}\n\nTell me what you want to achieve or ask a price with quantities, e.g. “30-second product video”.`), actions: [], chips: chipsLines, source: 'rules' };
  }
  // moneda
  if (has(q, ['cop', 'usd', 'dolar', 'pesos', 'moneda', 'trm', 'internacional', 'nacional', 'currency', 'dollar'])) {
    return { text: T(CURRENCY_NOTE + ' Cambias de moneda arriba a la derecha.', 'COP = domestic contract (client in Colombia, Colombian market rates). USD = international contract (international market rates). They are not a conversion of each other. Switch currency at the top right.'), actions: [], chips: [], source: 'rules' };
  }
  // qué necesito para empezar
  if (has(q, K.needs) || (en && has(q, K_EN.needs))) {
    const d = svcId ? serviceDetails(svcId) : null;
    const extra = d && !('error' in d) ? T(`\nPara ${nameIn(svcId!, en)} ayuda tener: referencias visuales, archivos fuente si existen (CAD/3D), y estos datos: ${d.variables.slice(0, 3).map((v) => qText(svcId!, v.id, en)).join('; ')}.`, `\nFor ${nameIn(svcId!, en)} it helps to have: visual references, source files if any (CAD/3D), and: ${d.variables.slice(0, 3).map((v) => qText(svcId!, v.id, en)).join('; ')}.`) : '';
    return { text: T('Para empezar: una descripción breve del objetivo, referencias y la fecha límite. Con eso respondo en menos de 24 h y, si avanzamos, se agenda con 50 % de anticipo.', 'To start: a short description of the goal, references and the deadline. I reply within 24 h and, if we go ahead, the slot is booked with a 50% deposit.') + extra, actions: svcId ? [openQuoteAction(svcId, {}, T('Abrir en el cotizador', 'Open in the estimator'))!].filter(Boolean) : [], chips: [], serviceId: svcId, source: 'rules' };
  }
  // reglas comerciales generales (pago, proceso, revisiones, contacto…) si no se pide precio
  if (general && ['pago', 'proceso', 'revisiones', 'whitelabel', 'contacto', 'archivos', 'urgencia'].includes(general) && !has(q, K.price) && !(en && has(q, K_EN.price))) {
    return { text: en ? GENERAL_EN[general] : matchIntent(input, { section: 'inicio', contactEmail: '' } as ChatContext) ?? '', actions: [], chips: [], serviceId: svcId, source: 'rules' };
  }
  // comparación
  if (has(q, K.compare) || (en && has(q, K_EN.compare))) {
    const two = detectTwo(input);
    if (two.length === 2) {
      const [a, b] = two.map((id) => quoteTool(id, {}, cur));
      const txt = [a, b].map((r, i) => {
        const id = two[i];
        const desc = en ? CATALOG_EN[id]?.desc ?? '' : (serviceDetails(id) as { descripcion?: string }).descripcion ?? '';
        return T(`• ${nameIn(id, en)}: desde ${money(r.rangoTexto)} con valores típicos. ${desc}`, `• ${nameIn(id, en)}: from ${money(r.rangoTexto)} with typical values. ${desc}`);
      }).join('\n');
      return { text: txt + T('\nLa elección depende de tu objetivo; si me dices para qué lo usarás, te digo cuál conviene.', '\nThe choice depends on your goal; tell me what it is for and I will tell you which fits.'), actions: two.map((id) => openQuoteAction(id, {}, T(`Cotizar ${nameIn(id, en)}`, `Estimate ${nameIn(id, en)}`))!).filter(Boolean), chips: [], serviceId: two[0], source: 'rules' };
    }
  }
  const asksPrice = has(q, K.price) || (en && has(q, K_EN.price));
  const asksTime = has(q, K.time) || (en && has(q, K_EN.time));
  const asksInclude = has(q, K.include) || (en && has(q, K_EN.include));
  const asksWhy = has(q, K.why) || (en && has(q, K_EN.why));
  const asksCheaper = has(q, K.cheaper) || (en && has(q, K_EN.cheaper));
  // R2 — pregunta de precio sin servicio identificable → preguntar
  if (!svcId) {
    if (asksPrice || asksTime || asksInclude) {
      return { text: T('¿Qué te gustaría cotizar? Elige una línea o descríbelo en una frase (p. ej. “renders de mi producto”, “chatbot para mi web”).', 'What would you like to estimate? Pick a line or describe it in one sentence (e.g. “renders of my product”, “a chatbot for my website”).'), actions: [], chips: chipsLines, source: 'rules' };
    }
    if (has(q, K.hello) || (en && has(q, K_EN.hello))) {
      return { text: T('¡Hola! Te ayudo a estimar tu proyecto con precios reales. ¿Qué quieres lograr?', 'Hi! I can estimate your project with real prices. What do you want to achieve?'), actions: [], chips: chipsLines, source: 'rules' };
    }
    const g = en ? null : matchIntent(input, { section: 'inicio', contactEmail: '' } as ChatContext);
    return { text: g ?? T('No logré entender qué necesitas. ¿Es una web con 3D, un video, imágenes o algo con IA? También puedes escribirme a 3d@alexwoodcock.me.', 'I did not quite get what you need. Is it a 3D website, a video, images or something with AI? You can also write to 3d@alexwoodcock.me.'), actions: [], chips: chipsLines, source: 'rules' };
  }

  const given: Record<string, Val> = { ...extractQuantities(svcId, input), ...extractOptions(svcId, input) };
  // memoria: valores de la pantalla (si es ese servicio) y los ya dados en la conversación
  const baseVals: Record<string, Val> = {
    ...(ctx.serviceId === svcId && ctx.vals ? ctx.vals : {}),
    ...(ctx.lastServiceId === svcId && ctx.lastVals ? ctx.lastVals : {}),
  };
  const vals = { ...baseVals, ...given };
  const name = nameIn(svcId, en);
  const openLbl = T('Abrir en el cotizador', 'Open in the estimator');

  if (asksWhy) {
    const e = explainTool(svcId, vals, cur);
    if ('error' in e) return { text: String(e.error), actions: [], chips: [], source: 'rules' };
    let body: string;
    if (en) {
      // en inglés se agrupa por rol (los nombres de subtareas del catálogo están en español)
      const byRole = new Map<string, { h: number; rate: number }>();
      for (const t of e.tareas) { const k = ROLE_EN[t.rol] ?? t.rol; const g = byRole.get(k) ?? { h: 0, rate: t.tarifaHora }; g.h += t.horas; byRole.set(k, g); }
      body = [...byRole.entries()].map(([k, g]) => `• ${k}: ${Math.round(g.h * 10) / 10} h × ${fmtMoney(cur, g.rate)}/h`).join('\n');
    } else {
      body = e.tareas.slice(0, 6).map((t) => `• ${t.tarea}: ${t.horas} h × ${fmtMoney(cur, t.tarifaHora)}/h (${t.rol})`).join('\n');
    }
    const enc = e.queLoEncarece.length ? T(`\nLo que más lo encarece: ${e.queLoEncarece.map((d) => `${d.variable.replace(/[¿?]/g, '')} (${d.ahorroTexto} menos si se reduce)`).join('; ')}.`, `\nWhat drives it up most: ${e.queLoEncarece.map((d) => `${qText(svcId, varIdOf(svcId, d.variable), true)} (${d.ahorroTexto} less if reduced)`).join('; ')}.`) : '';
    const tarifas = en ? `${cur === 'COP' ? 'Domestic contract (COP)' : 'International contract (USD)'} rates, at the floor of the market range` : e.tarifas;
    return { text: T(`Así se calcula ${name}:\n${body}\n${tarifas}; banda ±${e.bandaPct} %.${enc}`, `How ${name} is calculated:\n${body}\n${tarifas}; ±${e.bandaPct}% band.${enc}`), actions: [openQuoteAction(svcId, vals, openLbl)!].filter(Boolean), chips: en ? ['How can I make it cheaper?', "What's included?"] : ['¿Cómo lo hago más barato?', '¿Qué incluye?'], serviceId: svcId, vals, source: 'rules' };
  }
  if (asksCheaper) {
    const e = explainTool(svcId, vals, cur);
    if ('error' in e || !e.queLoEncarece.length) {
      return { text: T(`${name} ya está en su alcance mínimo con estos datos. Otra vía: entregar por fases (lo esencial primero).`, `${name} is already at its minimum scope with these values. Another option: deliver in phases (essentials first).`), actions: [openQuoteAction(svcId, vals, openLbl)!].filter(Boolean), chips: [], serviceId: svcId, source: 'rules' };
    }
    const lines = e.queLoEncarece.map((d) => {
      const vid = varIdOf(svcId, d.variable);
      const curv = fmtVal(svcId, vid, d.valorActual as Val, en);
      return T(`• Reducir “${d.variable.replace(/[¿?]/g, '')}” (hoy: ${curv}) ahorra ${d.ahorroTexto}.`, `• Reducing “${qText(svcId, vid, true)}” (now: ${curv}) saves ${d.ahorroTexto}.`);
    }).join('\n');
    return { text: T(`Para bajar el precio de ${name}:\n${lines}\nTambién puedes empezar por una fase esencial y ampliar después.`, `To lower the price of ${name}:\n${lines}\nYou can also start with an essential phase and expand later.`), actions: [openQuoteAction(svcId, vals, T('Ajustar en el cotizador', 'Adjust in the estimator'))!].filter(Boolean), chips: en ? ['Why this price?'] : ['¿Por qué este precio?'], serviceId: svcId, vals, source: 'rules' };
  }
  if (asksInclude) {
    const d = serviceDetails(svcId);
    if ('error' in d) return { text: String(d.error), actions: [], chips: [], source: 'rules' };
    const ent = en ? CATALOG_EN[svcId]?.entregables ?? d.entregables : d.entregables;
    const no = !en && d.noIncluye.length ? `\nNo incluye: ${d.noIncluye.slice(0, 3).join('; ')}.` : '';
    return { text: T(`${name} incluye:`, `${name} includes:`) + `\n${ent.slice(0, 6).map((x) => `• ${x}`).join('\n')}${no}`, actions: [openQuoteAction(svcId, vals, openLbl)!].filter(Boolean), chips: en ? ['How much is it?', 'How long does it take?'] : ['¿Cuánto cuesta?', '¿Cuánto tarda?'], serviceId: svcId, source: 'rules' };
  }
  if (asksTime && !asksPrice) {
    const s = SERVICES.find((x) => x.id === svcId)!;
    const qt = quoteTool(svcId, vals, cur);
    const t = s.entregaDiasEs
      ? T(`${s.entregaDiasEs[0]}–${s.entregaDiasEs[1]} días hábiles según el alcance`, `${s.entregaDiasEs[0]}–${s.entregaDiasEs[1]} business days depending on scope`)
      : T('se acuerda en el brief según el alcance', 'agreed in the brief depending on scope');
    return { text: T(`${name}: ${t}, contados desde el anticipo y el material completo. Con tus datos son ≈ ${qt.horasEstimadas} h de trabajo. Con urgencia (+25 % / +50 %) se acorta según disponibilidad.`, `${name}: ${t}, counted from the deposit and complete materials. With your values it is ≈ ${qt.horasEstimadas} h of work. With urgency (+25% / +50%) it gets shorter depending on availability.`), actions: [openQuoteAction(svcId, vals, openLbl)!].filter(Boolean), chips: en ? ['How much is it?'] : ['¿Cuánto cuesta?'], serviceId: svcId, source: 'rules' };
  }
  // R3 — cotización (por defecto cuando hay servicio)
  const r = quoteTool(svcId, vals, cur);
  if (!r.ok) return { text: r.error ?? T('No pude cotizar.', 'I could not estimate it.'), actions: [], chips: [], source: 'rules' };
  const datos = (r.tusDatos ?? []).map((k) => fmtVal(svcId, k, r.valoresUsados![k], en)).join(', ');
  const tuyos = (r.tusDatos ?? []).length ? T(`Con tus datos (${datos}) `, `With your values (${datos}) `) : T('Con valores típicos ', 'With typical values ');
  const missingId = keyMissingVariableId(svcId, r.tusDatos ?? []);
  const ask = missingId ? T(`\nPara afinarlo dime: ${qText(svcId, missingId, false)}?`, `\nTo refine it, tell me: ${qText(svcId, missingId, true)}?`).replace('dime: ', 'dime: ¿').replace('¿¿', '¿') : '';
  const avisos = r.avisos?.length ? T(`\nNota: ${r.avisos.join(' ')}`, '\nNote: some values were adjusted to the allowed range.') : '';
  const dias = r.entregaDiasHabiles ? T(` Entrega: ${r.entregaDiasHabiles[0]}–${r.entregaDiasHabiles[1]} días hábiles.`, ` Delivery: ${r.entregaDiasHabiles[0]}–${r.entregaDiasHabiles[1]} business days.`) : '';
  return {
    text: `${tuyos}${T(`${name} sale en`, `${name} comes to`)} ${money(r.rangoTexto)} (≈ ${r.horasEstimadas} h).${dias}${ask}${avisos}`,
    actions: r.accion ? [{ ...r.accion, label: openLbl }] : [],
    chips: en ? ['Why this price?', "What's included?", 'How can I make it cheaper?'] : ['¿Por qué este precio?', '¿Qué incluye?', '¿Cómo lo hago más barato?'],
    serviceId: svcId, vals: Object.fromEntries((r.tusDatos ?? []).map((k) => [k, r.valoresUsados![k]])), source: 'rules',
  };
}

/** id de variable a partir de su pregunta (explainTool devuelve la pregunta). */
function varIdOf(id: string, pregunta: string): string {
  return SERVICE_VARIABLES[id]?.variables.find((x) => x.preguntaEs === pregunta)?.id ?? pregunta;
}
function keyMissingVariableId(id: string, given: string[]): string | null {
  const v = (SERVICE_VARIABLES[id]?.variables ?? []).find((x) => x.type === 'number' && x.tierMap?.length && !given.includes(x.id));
  return v ? v.id : null;
}
const LINE_EN: Record<string, string> = { 'Webs con 3D': '3D websites', 'Video y animación': 'Video and animation', 'Imágenes y modelos 3D': 'Images and 3D models', 'Inteligencia artificial': 'Artificial intelligence', 'Técnicos y soporte': 'Technical and support' };
/** Vocabulario inglés (el visitante en EN escribe en inglés). */
const K_EN = {
  price: ['how much', 'price', 'cost', 'quote', 'budget', 'rate', 'estimate'],
  include: ['include', 'deliverable', 'what do i get', 'what will i get'],
  time: ['how long', 'timeline', 'deadline', 'days', 'weeks', 'delivery time'],
  why: ['why', 'breakdown', 'how is it calculated', 'explain'],
  cheaper: ['cheaper', 'lower the price', 'reduce', 'save money', 'tight budget'],
  compare: ['difference', 'compare', ' vs ', 'versus', 'which is better'],
  list: ['what services', 'what do you offer', 'what can i', 'services do you', 'catalog'],
  hello: ['hello', 'hi ', 'hey', 'good morning'],
  needs: ['what do you need', 'what should i send', 'to get started', 'requirements'],
  offTopic: ['weather', 'football', 'recipe', 'joke', 'politics', 'homework', 'poem', 'write code'],
};
function matchIntentIdEn(q: string): string | null {
  const map: [string, string[]][] = [
    ['pago', ['payment', 'deposit', 'invoice', 'pay ']], ['proceso', ['process', 'how does it work', 'next steps', 'what happens after']],
    ['revisiones', ['revision', 'changes', 'feedback round']], ['contacto', ['contact', 'email', 'whatsapp', 'call', 'talk to']],
    ['archivos', ['file', 'upload', 'format', 'step file', 'blend']], ['urgencia', ['urgent', 'rush', 'asap', 'deadline']],
    ['whitelabel', ['white label', 'agency', 'resell']],
  ];
  for (const [id, kws] of map) if (kws.some((k) => q.includes(k))) return id;
  return null;
}

/** Línea de cada raíz para los chips de arranque → frase que entiende basicReply. */
export const ROOT_CHIP_TO_PROMPT: Record<string, string> = Object.fromEntries(
  Object.entries(SERVICE_ROOTS).map(([k]) => [LINE_LABELS[k], `¿Qué opciones hay de ${LINE_LABELS[k].toLowerCase()}?`]),
);
