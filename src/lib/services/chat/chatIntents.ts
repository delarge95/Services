import { GLOSSARY } from '../../../data/services/glossary';
import { CONTACT_EMAIL } from '../share';

export type Section = 'inicio' | 'variables' | 'resultado';

export interface ChatContext {
  section: Section;
  serviceName?: string;
  tier?: string;
  totalRange?: string;
  entrega?: string;
  contactEmail: string;
}

interface Intent {
  id: string;
  kw: string[];
  answer: (ctx: ChatContext) => string;
}

// Normalización sin acentos para matching robusto.
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .replaceAll('á', 'a').replaceAll('é', 'e').replaceAll('í', 'i')
    .replaceAll('ó', 'o').replaceAll('ú', 'u').replaceAll('ü', 'u')
    .replaceAll('ñ', 'n');
}

const glossaryIntent = (id: string, kw: string[]): Intent => ({
  id: `glos-${id}`,
  kw,
  answer: () => `${GLOSSARY[id].term}: ${GLOSSARY[id].def}`,
});

const INTENTS: Intent[] = [
  {
    id: 'servicios',
    kw: ['servicio', 'que hacen', 'que ofrecen', 'catalogo', 'opciones', 'que puedo'],
    answer: (c) => c.serviceName
      ? `Estás viendo ${c.serviceName}. Arriba puedes cambiar de servicio o filtrar por objetivo (🌐 producto web, 🎬 video, 📸 imágenes, 🕹️ interactivo, 🤖 IA).`
      : 'Trabajamos 5 líneas: renders e imágenes de producto, videos/VFX, assets y webs 3D interactivas, CAD→web, e IA/automatización. ¿Cuál se parece a lo que buscas?',
  },
  {
    id: 'recomendacion',
    kw: ['recomienda', 'no se que', 'que necesito', 'ayuda a elegir', 'guia', 'empezar'],
    answer: () => 'Cuéntame tu objetivo en una frase (ej: "mostrar mi catálogo en la web") o usa las tarjetas "¿Qué quieres lograr?" de arriba. Con eso te digo exactamente qué servicio te conviene.',
  },
  {
    id: 'precio',
    kw: ['precio', 'cuanto cuesta', 'costo', 'caro', 'barato', 'por que ese valor', 'presupuesto'],
    answer: (c) => c.totalRange
      ? `Tu rango actual es ${c.totalRange}. El panel “¿Por qué este precio?” muestra qué variables lo mueven y cuánto; bajar una pieza o una vista puede reducirlo varios puntos.`
      : 'El precio depende del nivel (derivado de tus variables), las horas por subtarea y condiciones (urgencia, lote, lanzamiento). Configura un servicio y verás rango al instante + desglose causal.',
  },
  {
    id: 'moneda',
    kw: ['cop', 'usd', 'dolar', 'pesos', 'moneda', 'trm', 'por que mas barato'],
    answer: () => GLOSSARY.moneda.def,
  },
  {
    id: 'nivel',
    kw: ['nivel', 'tier', 'xs', 'xl', 'que significa la letra', 's m l'],
    answer: (c) => c.tier
      ? `Tu nivel calculado es ${c.tier}: se deriva solo de tus respuestas (nunca lo eliges). En “¿Qué incluye cada nivel?” comparas S/M/L con precio y alcance.`
      : 'El nivel (XS–XL) mide escala de trabajo. Se calcula automáticamente desde tus variables; tú solo describes tu proyecto.',
  },
  {
    id: 'urgencia',
    kw: ['urgente', 'rapido', 'apurado', 'pronto posible', 'fecha limite', 'viernes', 'manana', 'esta semana'],
    answer: (c) => `Plazos: estándar entra a cola normal${c.entrega ? ` (tu configuración: ${c.entrega})` : ''}; “Pronto” +25% y “Crítico” +50% según disponibilidad — se confirman por chat/email antes de iniciar.`,
  },
  {
    id: 'pago',
    kw: ['pago', 'anticipo', '50', 'factura', 'transferencia', 'nequi', 'paypal', 'metodo'],
    answer: () => 'Esquema 50% anticipo para agendar y 50% contra entrega. Facturación electrónica normal. Los costos de API/servidores de IA los paga el cliente (BYOK).',
  },
  {
    id: 'proceso',
    kw: ['proceso', 'como funciona', 'pasos', 'que sigue', 'despues de cotizar'],
    answer: () => 'Flujo: cotizas aquí → brief corto (<24 h respuesta) → anticipo 50% → producción con avances → 2 rondas incluidas → entrega + guía. Todo detallado en “Cómo trabajamos” al final de la página.',
  },
  {
    id: 'revisiones',
    kw: ['revision', 'cambio', 'ajuste', 'modificar', 'no me gusto'],
    answer: () => 'Incluimos 2 rondas de revisión dentro del precio. Cambios fuera del alcance acordado se estiman y aprueban antes de ejecutar: nunca hay sorpresas.',
  },
  {
    id: 'whitelabel',
    kw: ['white label', 'agencia', 'mi cliente', 'marca propia', 'revender'],
    answer: () => 'Sí trabajamos white label con agencias: tú eres la cara ante tu cliente y nosotros tu equipo técnico invisible.',
  },
  {
    id: 'archivos',
    kw: ['archivo', 'step', 'cad', 'blend', 'glb', 'modelo 3d', 'pesa', 'formato', 'subir'],
    answer: () => 'Puedes soltar tus archivos en la zona 📎 del resultado: validamos formato y peso al instante en tu navegador (nada se sube). STEP/Blender/GLB son ideales como fuente.',
  },
  {
    id: 'contacto',
    kw: ['humano', 'persona', 'hablar', 'whatsapp', 'correo', 'email', 'contacto', 'llamada'],
    answer: (c) => `Escríbenos a ${c.contactEmail} o usa el botón “Enviar por WhatsApp” bajo el presupuesto. Respondemos en menos de 24 h.`,
  },
  // Términos técnicos → glosario (reutiliza definiciones del cotizador)
  glossaryIntent('tris', ['tri', 'poligono', 'poligonos', 'polycount']),
  glossaryIntent('lods', ['lod']),
  glossaryIntent('pbr', ['pbr', 'textura fisica']),
  glossaryIntent('draco', ['draco', 'ktx2']),
  glossaryIntent('glb', ['glb', 'gltf']),
  glossaryIntent('hdri', ['hdri']),
  glossaryIntent('rag', ['rag']),
];

export function quickRepliesFor(ctx: ChatContext): string[] {
  if (ctx.section === 'inicio') {
    return ['¿Qué servicios hay?', 'No sé qué necesito', '¿Cómo se calcula el precio?'];
  }
  if (ctx.section === 'variables') {
    return ['¿Qué son los tris?', 'Recomiéndame valores', '¿Qué significa el nivel?'];
  }
  return ['¿Por qué este precio?', '¿Qué pasa después?', '¿Y si es urgente?'];
}

/** Devuelve la respuesta al input; null si no reconoce (el widget usa su fallback). */
export function matchIntent(input: string, ctx: ChatContext): string | null {
  const q = normalize(input);
  let best: { intent: Intent; score: number } | null = null;
  for (const intent of INTENTS) {
    let score = 0;
    for (const k of intent.kw) if (q.includes(normalize(k))) score += k.includes(' ') ? 3 : 1;
    if (score > 0 && (!best || score > best.score)) best = { intent, score };
  }
  if (!best) return null;
  return best.intent.answer({ ...ctx, contactEmail: ctx.contactEmail || CONTACT_EMAIL });
}
