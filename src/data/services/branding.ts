/**
 * branding.ts — Identidad pública del cotizador (lo que ve el CLIENTE).
 *
 * AG-SERV es el nombre interno del agente (docs/agents); NUNCA se muestra.
 * Los campos marcados PENDIENTE requieren confirmación del usuario.
 */

export const BRAND = {
  /** Nombre profesional público. */
  name: 'Alexander Woodcock',
  role: 'Real-Time 3D Developer · Unity WebGL · IA aplicada',
  /** Una línea para un visitante B2B que no sabe qué es render ni pipeline. */
  valueProp:
    'Convierto productos y datos industriales en experiencias 3D interactivas: desde renders fotorrealistas hasta configuradores web que tu cliente puede usar sin instalar nada.',
  /** Email público (ciclo 11: 3d@alexwoodcock.me reemplaza al anterior). */
  contactEmail: '3d@alexwoodcock.me',
  whatsappNumber: '573054396581',
  /** Prototipo en vivo (demo real de trabajo, ciclo 11). */
  prototypeUrl: 'http://alexwoodcock.me/Twinsight-X500/',
  /** URL pública base de las cotizaciones compartidas con estado (ciclo 11):
   *  los enlaces copiados/impresos apuntan aquí — nunca al dominio del dev. */
  quoteUrl: 'https://services.alexwoodcock.me/cotizador/',
  links: {
    portfolio: 'https://delarge95.github.io/PlanMaestroOS/',
    artstation: 'https://www.artstation.com/alexanderwoodcocksalomon3',
    github: 'https://github.com/delarge95',
  },
  /** Garantías que un comprador B2B quiere leer antes de cotizar. */
  trustPoints: [
    { icon: '📦', text: 'Entregables definidos por escrito antes de empezar' },
    { icon: '🔁', text: '2 rondas de ajuste incluidas en cada cotización' },
    { icon: '🗓️', text: 'Tiempos en días hábiles, con fecha de entrega en el contrato' },
    { icon: '🔒', text: 'Tus archivos CAD/modelos no se publican sin autorización' },
  ],
} as const;

/** Cómo funciona (3 pasos, lenguaje no-engineer). */
export const HOW_IT_WORKS = [
  {
    n: 1,
    title: 'Cuéntanos qué necesitas',
    desc: 'Elige tu objetivo y responde 2–4 preguntas. Si no sabes algo, marca “No sé” y usamos el valor recomendado para proyectos como el tuyo.',
  },
  {
    n: 2,
    title: 'Ve el rango al instante',
    desc: 'Obtienes costo y tiempo estimados con el desglose de lo que incluye. Sin registro, sin llamada previa.',
  },
  {
    n: 3,
    title: 'Envíalo y lo confirmamos',
    desc: 'Mandas la cotización por WhatsApp o email. Respondemos con alcance final y fecha — el precio orientativo rara vez cambia más de 10%.',
  },
] as const;
