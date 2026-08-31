import type { LevelId } from './types';

// ─── Modelo de variables por servicio ───
// Cada variable es una pregunta que el cliente responde.
// Las variables determinan el tier (XS/S/M/L/XL) según umbrales.

export type VarType = 'number' | 'toggle' | 'select';

export interface ServiceVariable {
  id: string;
  preguntaEs: string;
  /** Texto de ayuda opcional que se muestra bajo la pregunta en la configuración. */
  ayudaEs?: string;
  type: VarType;
  /** Para type='number' */
  min?: number;
  max?: number;
  step?: number;
  unidadEs?: string;
  /** No mostrar en el panel de configuración (el valor sigue viniendo del wizard). */
  ocultarEnConfig?: boolean;
  /** Para type='toggle' o 'select' */
  opciones?: Array<{ valorEs: string; tierHint?: LevelId }>;
  /** Cómo esta variable mapea a tiers (para type='number') */
  tierMap?: Array<{ maxVal: number; tier: LevelId }>;
  /** Si es toggle=true, qué nivel sugiere */
  tierSiActivo?: LevelId;
  /** Valor recomendado por objetivo (wizard/modo no-sé): clave = goal id o 'default' */
  recommendedFor?: Record<string, number | string | boolean>;
}

export interface ServiceConfig {
  serviceId: string;
  variables: ServiceVariable[];
  /** Subtareas opcionales que el cliente puede activar (add-ons) */
  addonsOpcionales?: Array<{ subtaskId: string; labelEs: string }>;
}

// ─── Definición de variables para TODOS los servicios ───
// Extraído directamente de los markdowns docs/servicios/

export const SERVICE_VARIABLES: Record<string, ServiceConfig> = {
  // ═══ C1 · RENDER 3D ═══

  'RND-01': {
    serviceId: 'RND-01',
    variables: [
      {
        id: 'numImagenes', preguntaEs: '¿Cuántas imágenes necesitas?',
        type: 'number', min: 1, max: 20, step: 1, unidadEs: 'imágenes',
        tierMap: [{ maxVal: 2, tier: 'S' }, { maxVal: 5, tier: 'M' }, { maxVal: 12, tier: 'L' }],
      },
      {
        id: 'numMateriales', preguntaEs: '¿Cuántos materiales diferentes tiene el producto?',
        type: 'number', min: 1, max: 20, step: 1, unidadEs: 'materiales',
        tierMap: [{ maxVal: 3, tier: 'S' }, { maxVal: 6, tier: 'M' }, { maxVal: 99, tier: 'L' }],
      },
      {
        id: 'setDressing', preguntaEs: '¿Necesitas set dressing (props, ambiente)?',
        type: 'toggle',
        tierSiActivo: 'L',
      },
      {
        id: 'modeloAportado', preguntaEs: '¿Tienes el modelo 3D ya hecho?',
        type: 'toggle',
      },
      {
        id: 'resolucion', preguntaEs: '¿Qué resolución necesitas?',
        type: 'select',
        opciones: [
          { valorEs: 'Web (≤2K)', tierHint: 'S' },
          { valorEs: 'Print (4K+)', tierHint: 'M' },
        ],
      },
    ],
  },

  'RND-02': {
    serviceId: 'RND-02',
    variables: [
      {
        id: 'duracion', preguntaEs: '¿De cuántos segundos necesita el video?',
        type: 'number', min: 2, max: 90, step: 1, unidadEs: 'segundos',
        tierMap: [{ maxVal: 10, tier: 'S' }, { maxVal: 30, tier: 'M' }, { maxVal: 90, tier: 'L' }],
      },
      {
        id: 'numShots', preguntaEs: '¿Cuántos shots o cortes?',
        type: 'number', min: 1, max: 12, step: 1, unidadEs: 'shots',
        tierMap: [{ maxVal: 2, tier: 'S' }, { maxVal: 4, tier: 'M' }, { maxVal: 12, tier: 'L' }],
      },
      {
        id: 'simulaciones', preguntaEs: '¿Incluye simulaciones (partículas, fluidos)?',
        type: 'toggle',
        tierSiActivo: 'M',
      },
      {
        id: 'audioSync', preguntaEs: '¿Sincronización con audio?',
        type: 'toggle',
        tierSiActivo: 'L',
      },
    ],
  },

  // ═══ C2 · ASSETS REALTIME ═══

  'RTA-01': {
    serviceId: 'RTA-01',
    variables: [
      {
        id: 'polyCount', preguntaEs: '¿Qué presupuesto de polígonos necesita?',
        type: 'number', min: 500, max: 500000, step: 500, unidadEs: 'tris',
        tierMap: [{ maxVal: 10000, tier: 'S' }, { maxVal: 50000, tier: 'M' }, { maxVal: 150000, tier: 'L' }],
      },
      {
        id: 'numPiezas', preguntaEs: '¿Cuántas piezas tiene el modelo?',
        type: 'number', min: 1, max: 200, step: 1, unidadEs: 'piezas',
        tierMap: [{ maxVal: 8, tier: 'S' }, { maxVal: 30, tier: 'M' }, { maxVal: 100, tier: 'L' }],
      },
      {
        id: 'tipoSuperficie', preguntaEs: '¿Cómo es la superficie del producto?',
        type: 'number', min: 1, max: 5, step: 1, unidadEs: 'superficie',
        tierMap: [{ maxVal: 2, tier: 'S' }, { maxVal: 3, tier: 'M' }, { maxVal: 4, tier: 'L' }, { maxVal: 5, tier: 'XL' }],
      },
      {
        id: 'fuente', preguntaEs: '¿De dónde viene el modelo?',
        type: 'select',
        opciones: [
          { valorEs: 'Ya tengo el modelo 3D', tierHint: 'S' },
          { valorEs: 'Desde CAD (requiere conversión)', tierHint: 'M' },
          { valorEs: 'Desde fotos (requiere modelado)', tierHint: 'L' },
        ],
      },
      {
        id: 'numTexturas', preguntaEs: '¿Cuántos sets de texturas PBR?',
        type: 'number', min: 1, max: 10, step: 1, unidadEs: 'sets',
        tierMap: [{ maxVal: 2, tier: 'S' }, { maxVal: 4, tier: 'M' }, { maxVal: 10, tier: 'L' }],
      },
    ],
  },

  'RTA-02': {
    serviceId: 'RTA-02',
    variables: [
      {
        id: 'polyCount', preguntaEs: '¿Qué presupuesto de polígonos?',
        type: 'number', min: 500, max: 500000, step: 500, unidadEs: 'tris',
        tierMap: [{ maxVal: 10000, tier: 'S' }, { maxVal: 50000, tier: 'M' }, { maxVal: 150000, tier: 'L' }],
      },
      {
        id: 'numHotspots', preguntaEs: '¿Cuántos hotspots o partes seleccionables?',
        ocultarEnConfig: true, // hotspots quedan para integración futura (ciclo 6)
        type: 'number', min: 1, max: 30, step: 1, unidadEs: 'hotspots',
        tierMap: [{ maxVal: 5, tier: 'S' }, { maxVal: 15, tier: 'M' }, { maxVal: 30, tier: 'L' }],
      },
    ],
  },

  'RTA-03': {
    serviceId: 'RTA-03',
    variables: [
      {
        id: 'polyCount', preguntaEs: '¿Qué presupuesto de polígonos?',
        type: 'number', min: 500, max: 500000, step: 500, unidadEs: 'tris',
        tierMap: [{ maxVal: 10000, tier: 'S' }, { maxVal: 50000, tier: 'M' }, { maxVal: 150000, tier: 'L' }],
      },
      {
        id: 'numLoops', preguntaEs: '¿Cuántos clips de animación loop?',
        type: 'number', min: 1, max: 10, step: 1, unidadEs: 'clips',
        tierMap: [{ maxVal: 2, tier: 'S' }, { maxVal: 5, tier: 'M' }, { maxVal: 10, tier: 'L' }],
      },
      {
        id: 'rig', preguntaEs: '¿Necesita rig (esqueleto para animar)?',
        type: 'toggle',
        tierSiActivo: 'M',
      },
    ],
  },

  'RTA-04': {
    serviceId: 'RTA-04',
    variables: [
      {
        id: 'polyCount', preguntaEs: '¿Qué presupuesto de polígonos?',
        type: 'number', min: 500, max: 500000, step: 500, unidadEs: 'tris',
        tierMap: [{ maxVal: 10000, tier: 'S' }, { maxVal: 50000, tier: 'M' }, { maxVal: 150000, tier: 'L' }],
      },
      {
        id: 'numEstados', preguntaEs: '¿Cuántos estados o animaciones interactivas?',
        type: 'number', min: 2, max: 20, step: 1, unidadEs: 'estados',
        tierMap: [{ maxVal: 5, tier: 'S' }, { maxVal: 12, tier: 'M' }, { maxVal: 20, tier: 'L' }],
      },
      {
        id: 'rig', preguntaEs: '¿Necesita rig?',
        type: 'toggle',
        tierSiActivo: 'M',
      },
    ],
  },

  'RTA-05': {
    serviceId: 'RTA-05',
    variables: [
      {
        id: 'numShaders', preguntaEs: '¿Cuántos shaders o efectos necesitas?',
        type: 'number', min: 1, max: 15, step: 1, unidadEs: 'shaders',
        tierMap: [{ maxVal: 3, tier: 'S' }, { maxVal: 8, tier: 'M' }, { maxVal: 15, tier: 'L' }],
      },
      {
        id: 'target', preguntaEs: '¿Dónde va a correr?',
        type: 'select',
        opciones: [
          { valorEs: 'Desktop', tierHint: 'S' },
          { valorEs: 'Desktop + móvil', tierHint: 'M' },
        ],
      },
    ],
  },

  'RTA-06': {
    serviceId: 'RTA-06',
    variables: [
      {
        id: 'numPartes', preguntaEs: '¿Cuántas partes móviles tiene el despiece?',
        type: 'number', min: 2, max: 100, step: 1, unidadEs: 'partes',
        tierMap: [{ maxVal: 10, tier: 'S' }, { maxVal: 40, tier: 'M' }, { maxVal: 100, tier: 'L' }],
      },
      {
        id: 'profundidad', preguntaEs: '¿Qué tan detallado debe ser el despiece?',
        type: 'select',
        opciones: [
          { valorEs: 'Explosión simple (una etapa)', tierHint: 'S' },
          { valorEs: 'Múltiples etapas con etiquetas', tierHint: 'M' },
          { valorEs: 'Completo con cotas y medición', tierHint: 'L' },
        ],
      },
    ],
  },

  // ═══ C3 · WEB 3D ═══

  'WEB-01': {
    serviceId: 'WEB-01',
    variables: [
      {
        id: 'numHotspots', preguntaEs: '¿Cuántas partes del modelo llevarán punto de información?',
        ayudaEs: 'Cada punto marca una pieza; al hacer click muestra su nombre o specs. El preview de arriba los muestra en vivo.',
        ocultarEnConfig: true, // hotspots quedan para integración futura (ciclo 6)
        type: 'number', min: 0, max: 30, step: 1, unidadEs: 'puntos',
        tierMap: [{ maxVal: 5, tier: 'S' }, { maxVal: 15, tier: 'M' }, { maxVal: 30, tier: 'L' }],
      },
      {
        id: 'datos', preguntaEs: '¿Los datos vienen de un CMS/API o son fijos?',
        type: 'select',
        opciones: [
          { valorEs: 'Fijos (hardcode)', tierHint: 'S' },
          { valorEs: 'Dinámicos (CMS/API)', tierHint: 'M' },
        ],
      },
      {
        id: 'target', preguntaEs: '¿Dónde va a correr?',
        type: 'select',
        opciones: [
          { valorEs: 'Desktop', tierHint: 'S' },
          { valorEs: 'Desktop + móvil', tierHint: 'M' },
        ],
      },
    ],
  },

  'WEB-02': {
    serviceId: 'WEB-02',
    variables: [
      {
        id: 'numEscenas', preguntaEs: '¿Cuántas escenas necesitas embeber?',
        type: 'number', min: 1, max: 10, step: 1, unidadEs: 'escenas',
        tierMap: [{ maxVal: 2, tier: 'S' }, { maxVal: 5, tier: 'M' }, { maxVal: 10, tier: 'L' }],
      },
    ],
  },

  'WEB-03': {
    serviceId: 'WEB-03',
    variables: [
      {
        id: 'tamanoProyecto', preguntaEs: '¿Qué tan grande es el proyecto Unity?',
        type: 'select',
        opciones: [
          { valorEs: 'Pequeño (demo/prototype)', tierHint: 'S' },
          { valorEs: 'Medio (producto funcional)', tierHint: 'M' },
          { valorEs: 'Grande (app completa)', tierHint: 'L' },
        ],
      },
      {
        id: 'bridge', preguntaEs: '¿Necesitas comunicación JS↔Unity?',
        type: 'toggle',
        tierSiActivo: 'M',
      },
    ],
  },

  'WEB-04': {
    serviceId: 'WEB-04',
    variables: [
      {
        id: 'numVariantes', preguntaEs: '¿Cuántas variantes o reglas de configuración?',
        ocultarEnConfig: true, // ya se preguntó en el wizard (web-app): redundante aquí
        type: 'number', min: 2, max: 50, step: 1, unidadEs: 'variantes',
        tierMap: [{ maxVal: 10, tier: 'S' }, { maxVal: 25, tier: 'M' }, { maxVal: 50, tier: 'L' }],
      },
      {
        id: 'numSKUs', preguntaEs: '¿Para cuántos productos distintos servirá?',
        ayudaEs: 'Cada producto con su propio modelo 3D dentro de la misma app. Si es uno solo, deja 1.',
        type: 'number', min: 1, max: 100, step: 1, unidadEs: 'SKUs',
        tierMap: [{ maxVal: 5, tier: 'S' }, { maxVal: 20, tier: 'M' }, { maxVal: 100, tier: 'L' }],
      },
      {
        id: 'fuenteDatos', preguntaEs: '¿De dónde vienen los datos?',
        type: 'select',
        opciones: [
          { valorEs: 'Estáticos (JSON local)', tierHint: 'S' },
          { valorEs: 'CMS', tierHint: 'M' },
          { valorEs: 'API externa', tierHint: 'L' },
        ],
      },
      {
        id: 'auth', preguntaEs: '¿Necesita login/autenticación?',
        type: 'toggle',
        tierSiActivo: 'L',
      },
    ],
  },

  'WEB-05': {
    serviceId: 'WEB-05',
    variables: [
      {
        id: 'numSecciones', preguntaEs: '¿Cuántas paradas de scroll tendrá la historia?',
        ayudaEs: 'Es el número de escenas que definiste en el wizard; puedes ajustarlo aquí.',
        type: 'number', min: 2, max: 15, step: 1, unidadEs: 'secciones',
        tierMap: [{ maxVal: 4, tier: 'S' }, { maxVal: 8, tier: 'M' }, { maxVal: 15, tier: 'L' }],
      },
    ],
  },

  'WEB-06': {
    serviceId: 'WEB-06',
    variables: [
      {
        id: 'mecanica', preguntaEs: '¿Qué tipo de mecánica?',
        type: 'select',
        opciones: [
          { valorEs: 'Simple (quiz, memory, puzzle)', tierHint: 'S' },
          { valorEs: 'Media (runner, plataforma)', tierHint: 'M' },
          { valorEs: 'Compleja (multiplayer, física)', tierHint: 'L' },
        ],
      },
      {
        id: 'scores', preguntaEs: '¿Necesita leaderboard/scores?',
        type: 'toggle',
        tierSiActivo: 'M',
      },
    ],
  },

  'WEB-07': {
    serviceId: 'WEB-07',
    variables: [
      {
        id: 'numProductos', preguntaEs: '¿Cuántos productos en el catálogo?',
        type: 'number', min: 1, max: 100, step: 1, unidadEs: 'productos',
        tierMap: [{ maxVal: 5, tier: 'S' }, { maxVal: 20, tier: 'M' }, { maxVal: 100, tier: 'L' }],
      },
      {
        id: 'filtros', preguntaEs: '¿Necesita filtros y búsqueda?',
        type: 'toggle',
        tierSiActivo: 'M',
      },
    ],
  },

  'WEB-08': {
    serviceId: 'WEB-08',
    variables: [
      {
        id: 'numSlides', preguntaEs: '¿Cuántas slides o secciones?',
        type: 'number', min: 3, max: 30, step: 1, unidadEs: 'slides',
        tierMap: [{ maxVal: 8, tier: 'S' }, { maxVal: 15, tier: 'M' }, { maxVal: 30, tier: 'L' }],
      },
      {
        id: 'tiene3D', preguntaEs: '¿Incluye bloque 3D interactivo?',
        type: 'toggle',
        tierSiActivo: 'M',
      },
    ],
  },

  // ═══ C4 · IA ═══

  'AI-01': {
    serviceId: 'AI-01',
    variables: [
      {
        id: 'fuentes', preguntaEs: '¿Cuántas fuentes de contenido tiene (docs, FAQs, páginas)?',
        type: 'number', min: 1, max: 50, step: 1, unidadEs: 'fuentes',
        tierMap: [{ maxVal: 5, tier: 'S' }, { maxVal: 15, tier: 'M' }, { maxVal: 50, tier: 'L' }],
      },
      {
        id: 'idiomas', preguntaEs: '¿En cuántos idiomas?',
        type: 'number', min: 1, max: 5, step: 1, unidadEs: 'idiomas',
        tierMap: [{ maxVal: 1, tier: 'S' }, { maxVal: 2, tier: 'M' }, { maxVal: 5, tier: 'L' }],
      },
      {
        id: 'acciones', preguntaEs: '¿El chat puede ejecutar acciones (agendar, buscar, etc.)?',
        type: 'toggle',
        tierSiActivo: 'L',
      },
    ],
  },

  'AI-02': {
    serviceId: 'AI-02',
    variables: [
      {
        id: 'numFlujos', preguntaEs: '¿Cuántos flujos quieres automatizar?',
        type: 'number', min: 1, max: 15, step: 1, unidadEs: 'flujos',
        tierMap: [{ maxVal: 3, tier: 'S' }, { maxVal: 8, tier: 'M' }, { maxVal: 15, tier: 'L' }],
      },
    ],
  },

  'AI-03': {
    serviceId: 'AI-03',
    variables: [
      {
        id: 'numProcesos', preguntaEs: '¿Cuántos procesos quieres automatizar?',
        type: 'number', min: 1, max: 20, step: 1, unidadEs: 'procesos',
        tierMap: [{ maxVal: 3, tier: 'S' }, { maxVal: 8, tier: 'M' }, { maxVal: 20, tier: 'L' }],
      },
      {
        id: 'madurez', preguntaEs: '¿Qué tan digitalizado está tu equipo?',
        type: 'select',
        opciones: [
          { valorEs: 'Muy digitalizado (herramientas cloud)', tierHint: 'S' },
          { valorEs: 'Parcialmente digital', tierHint: 'M' },
          { valorEs: 'Poco digitalizado (papel/excel)', tierHint: 'L' },
        ],
      },
    ],
  },

  'AI-04': {
    serviceId: 'AI-04',
    variables: [
      {
        id: 'tamanoOrg', preguntaEs: '¿De qué tamaño es la organización?',
        type: 'select',
        opciones: [
          { valorEs: 'Pequeña (<20 personas)', tierHint: 'S' },
          { valorEs: 'Mediana (20–100)', tierHint: 'M' },
          { valorEs: 'Grande (>100)', tierHint: 'L' },
        ],
      },
    ],
  },

  // ═══ C5 · VFX ═══

  'VFX-01': {
    serviceId: 'VFX-01',
    variables: [
      {
        id: 'complejidadFondo', preguntaEs: '¿Qué tan complejo es el fondo?',
        type: 'select',
        opciones: [
          { valorEs: 'Plano/simple', tierHint: 'S' },
          { valorEs: 'Con profundidad', tierHint: 'M' },
          { valorEs: 'Muy complejo (muchos elementos)', tierHint: 'L' },
        ],
      },
    ],
  },

  'VFX-02': {
    serviceId: 'VFX-02',
    variables: [
      {
        id: 'movimientoCamara', preguntaEs: '¿Cómo se mueve la cámara?',
        type: 'select',
        opciones: [
          { valorEs: 'Estática', tierHint: 'S' },
          { valorEs: 'Handheld', tierHint: 'M' },
          { valorEs: 'Dolly/grúa compleja', tierHint: 'L' },
        ],
      },
      {
        id: 'numElementosCG', preguntaEs: '¿Cuántos elementos CG?',
        type: 'number', min: 1, max: 10, step: 1, unidadEs: 'elementos',
        tierMap: [{ maxVal: 2, tier: 'S' }, { maxVal: 5, tier: 'M' }, { maxVal: 10, tier: 'L' }],
      },
      {
        id: 'tieneFX', preguntaEs: '¿Incluye FX (partículas, humo)?',
        type: 'toggle',
        tierSiActivo: 'M',
      },
    ],
  },

  'VFX-03': {
    serviceId: 'VFX-03',
    variables: [
      {
        id: 'tipoSim', preguntaEs: '¿Qué tipo de simulación?',
        type: 'select',
        opciones: [
          { valorEs: 'Partículas simples', tierHint: 'S' },
          { valorEs: 'Volumétricos (humo/niebla)', tierHint: 'M' },
          { valorEs: 'Fluidos/destrucción RBD', tierHint: 'L' },
        ],
      },
      {
        id: 'reutilizable', preguntaEs: '¿Necesitas setup paramétrico reutilizable?',
        type: 'toggle',
        tierSiActivo: 'L',
      },
    ],
  },

  // ═══ C6 · CAD/TEXTURAS/PIPELINE ═══

  'TEX-01': {
    serviceId: 'TEX-01',
    variables: [
      {
        id: 'numSets', preguntaEs: '¿Cuántos sets de texturas?',
        type: 'number', min: 1, max: 30, step: 1, unidadEs: 'sets',
        tierMap: [{ maxVal: 3, tier: 'S' }, { maxVal: 10, tier: 'M' }, { maxVal: 30, tier: 'L' }],
      },
      {
        id: 'noai', preguntaEs: '¿Restricción NoAI (solo procedural)?',
        type: 'toggle',
      },
    ],
  },

  'PIPE-01': {
    serviceId: 'PIPE-01',
    variables: [
      {
        id: 'numScripts', preguntaEs: '¿Cuántos scripts o herramientas?',
        type: 'number', min: 1, max: 20, step: 1, unidadEs: 'scripts',
        tierMap: [{ maxVal: 3, tier: 'S' }, { maxVal: 8, tier: 'M' }, { maxVal: 20, tier: 'L' }],
      },
    ],
  },

  // ═══ C7 · TRANSVERSALES ═══

  'CON-01': {
    serviceId: 'CON-01',
    variables: [
      {
        id: 'numSesiones', preguntaEs: '¿Cuántas sesiones de consultoría?',
        type: 'number', min: 1, max: 20, step: 1, unidadEs: 'sesiones',
        tierMap: [{ maxVal: 3, tier: 'S' }, { maxVal: 8, tier: 'M' }, { maxVal: 20, tier: 'L' }],
      },
    ],
  },

  'RET-01': {
    serviceId: 'RET-01',
    variables: [
      {
        id: 'plan', preguntaEs: '¿Qué plan de retainer?',
        type: 'select',
        opciones: [
          { valorEs: 'Lite (4 h/mes)', tierHint: 'S' },
          { valorEs: 'Standard (8 h/mes)', tierHint: 'S' },
          { valorEs: 'Pro (16 h/mes)', tierHint: 'M' },
          { valorEs: 'Business (40 h/mes)', tierHint: 'L' },
          { valorEs: 'Enterprise (80 h/mes)', tierHint: 'XL' },
        ],
      },
    ],
  },

  // ═══ C6 · CAD (alias) ═══
  'CAD-01': {
    serviceId: 'CAD-01',
    variables: [
      {
        id: 'numPiezas', preguntaEs: '¿Cuántas piezas tiene el ensamblaje CAD?',
        type: 'number', min: 1, max: 300, step: 1, unidadEs: 'piezas',
        tierMap: [{ maxVal: 15, tier: 'S' }, { maxVal: 60, tier: 'M' }, { maxVal: 150, tier: 'M' }, { maxVal: 300, tier: 'L' }],
      },
      {
        id: 'complejidad', preguntaEs: '¿Cómo es la geometría?',
        type: 'select',
        opciones: [
          { valorEs: 'Prismática (cajas, placas, tubo recto)', tierHint: 'S' },
          { valorEs: 'Freeform moderada (carenas, fillets)', tierHint: 'M' },
          { valorEs: 'Compleja (roscas, cables, orgánico)', tierHint: 'L' },
        ],
      },
      {
        id: 'calidadCAD', preguntaEs: '¿Cómo está el CAD de origen?',
        type: 'select',
        opciones: [
          { valorEs: 'Limpio (export correcto, unidades ok)', tierHint: 'S' },
          { valorEs: 'Con problemas (tolerancias, geometría sucia)', tierHint: 'M' },
        ],
      },
      {
        id: 'target', preguntaEs: '¿Para qué plataforma?',
        type: 'select',
        opciones: [
          { valorEs: 'Desktop web', tierHint: 'S' },
          { valorEs: 'Móvil exigente', tierHint: 'M' },
        ],
      },
    ],
    addonsOpcionales: [
      { subtaskId: 'b6-explosion', labelEs: 'Vista explosionada' },
      { subtaskId: 'b6-ui', labelEs: 'UI de despiece' },
    ],
  },
};

// ─── Derivación de tier desde variables ───
export function derivarTier(
  serviceId: string,
  valores: Record<string, number | string | boolean>,
): LevelId {
  const config = SERVICE_VARIABLES[serviceId];
  if (!config) return 'M';

  let maxTierIdx = 0;
  const order: LevelId[] = ['XS', 'S', 'M', 'L', 'XL'];

  for (const v of config.variables) {
    const val = valores[v.id];
    if (val === undefined || val === null) continue;

    if (v.type === 'number' && v.tierMap && v.tierMap.length > 0) {
      const numVal = Number(val);
      let matched = false;
      for (const tm of v.tierMap) {
        if (numVal <= tm.maxVal) {
          const idx = order.indexOf(tm.tier);
          if (idx > maxTierIdx) maxTierIdx = idx;
          matched = true;
          break;
        }
      }
      // FIX: si el valor excede todos los umbrales, usar el ULTIMO tier del map
      // (que siempre es el mas alto). Sin esto, valores muy altos BAJABAN el nivel.
      if (!matched) {
        const lastEntry = v.tierMap[v.tierMap.length - 1];
        const lastIdx = order.indexOf(lastEntry.tier);
        if (lastIdx > maxTierIdx) maxTierIdx = lastIdx;
      }
    }

    if (v.type === 'toggle' && v.tierSiActivo && val === true) {
      const idx = order.indexOf(v.tierSiActivo);
      if (idx > maxTierIdx) maxTierIdx = idx;
    }

    if (v.type === 'select' && typeof val === 'string') {
      const opcion = v.opciones?.find((o) => o.valorEs === val);
      if (opcion?.tierHint) {
        const idx = order.indexOf(opcion.tierHint);
        if (idx > maxTierIdx) maxTierIdx = idx;
      }
    }
  }

  return order[maxTierIdx];
}

/** Valor sugerido para modo "No estoy seguro": override por goal > default > punto medio/primera opción. */
export function recommendedValue(v: ServiceVariable, goalId: string): number | string | boolean | null {
  const rec = v.recommendedFor;
  if (rec) {
    const hit = rec[goalId] ?? rec['default'];
    if (hit !== undefined) return hit;
  }
  if (v.type === 'number' && v.min !== undefined && v.max !== undefined) {
    const step = v.step && v.step > 0 ? v.step : 1;
    return Math.round((v.min + v.max) / 2 / step) * step;
  }
  if (v.type === 'select') return v.opciones?.[0]?.valorEs ?? null;
  if (v.type === 'toggle') return false;
  return null;
}