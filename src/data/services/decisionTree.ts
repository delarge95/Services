/**
 * decisionTree.ts — Árbol de decisión del cotizador guiado.
 * Principio: preguntar LO QUE QUIERE LOGRAR (no técnico) → ramificar →
 * detalles técnicos SOLO en opciones avanzadas (expandible).
 */

export interface TreeOption {
  id: string;
  /** Texto que ve el cliente (NO técnico). */
  label: string;
  desc?: string;
  icon?: string;
  /** Servicios del catálogo que mapean a esta opción. */
  serviceIds?: string[];
  /** Preguntas del siguiente nivel (si hay más ramas). */
  children?: TreeQuestion[];
}

export interface AdvancedOption {
  id: string;
  label: string;
  help?: string;
  type: 'slider' | 'select';
  min?: number; max?: number; step?: number; unit?: string; defaultValue?: number;
  options?: Array<{ id: string; label: string }>;
}

export interface TreeQuestion {
  id: string;
  /** Pregunta en lenguaje humano. */
  question: string;
  help?: string;
  /** Tipo de control: cards, slider, toggle, select. */
  type: 'cards' | 'slider' | 'toggle' | 'select';
  /** Opciones si es cards/select. */
  options?: TreeOption[];
  /** Configuración si es slider. */
  slider?: {
    min: number; max: number; step: number; unit: string;
    /** Slider progresivo con puntos de snapping en los enteros (1.1). */
    continuous?: boolean;
    /** Preview 3D: qué modelo mostrar que cambie con el valor. */
    preview?: 'detail-level' | 'piece-count' | 'complexity' | 'story' | 'variant-swirl' | 'surface-morph' | 'assembly' | 'shader-dial';
    /** Mapeo valor → tier. */
    tierMap?: Array<{ max: number; tier: string }>;
  };
  /** Preview para preguntas de tarjetas (no slider). */
  preview?: 'finish';
  /** Ciclo 10: el preview usa un asset temporal de demostración → la QuestionCard
   *  muestra una nota profesional aclarando que la versión final usa los modelos
   *  del producto del cliente. */
  demoAsset?: boolean;
  /** Si es expandible como "opciones avanzadas". */
  advanced?: boolean;
  advancedOptions?: AdvancedOption[];
}

export interface TreeBranch {
  id: string;
  title: string;
  subtitle: string;
  questions: TreeQuestion[];
}

// ═══════════════════════════════════════════════════════════════
// NIVEL 1: ¿Qué quieres lograr?
// ═══════════════════════════════════════════════════════════════
export const ROOT_OPTIONS: TreeOption[] = [
  {
    id: 'web-3d',
    label: 'Una web con 3D',
    desc: 'Quiero que mi página web tenga elementos 3D interactivos',
    icon: 'globe',
  },
  {
    id: 'video-anim',
    label: 'Un video o animación',
    desc: 'Necesito un video 3D, animación de producto o VFX',
    icon: 'film',
  },
  {
    id: 'imagenes',
    label: 'Imágenes de producto',
    desc: 'Renders fotorrealistas para e-commerce, print o marketing',
    icon: 'camera',
  },
  {
    id: 'ia',
    label: 'Inteligencia artificial',
    desc: 'Chatbot, automatización o integración de IA en mi negocio',
    icon: 'chip',
  },
  {
    id: 'no-se',
    label: 'No estoy seguro',
    desc: 'Muéstrame el catálogo completo con filtros',
    icon: 'spark',
  },
];

// ═══════════════════════════════════════════════════════════════
// RAMA: Web con 3D → ¿Qué tipo de experiencia?
// ═══════════════════════════════════════════════════════════════
export const WEB3D_BRANCHES: Record<string, TreeBranch> = {
  'ver-modelo': {
    id: 'ver-modelo',
    title: 'Mostrar un modelo 3D en tu web',
    subtitle: 'El visitante puede rotarlo y verlo desde todos los ángulos, sin instalar nada.',
    questions: [
      {
        id: 'modelo-existente',
        question: '¿Ya tienes el modelo 3D de tu producto?',
        type: 'cards',
        options: [
          { id: 'si-tengo', label: 'Sí, lo tengo', desc: 'Tengo el archivo en algún formato digital' },
          { id: 'no-crear', label: 'No, hay que crearlo', desc: 'Necesito que modelen mi producto desde cero o desde referencias' },
        ],
        advancedOptions: [
          { id: 'formato-archivo', label: 'Formato del archivo', help: 'Si no lo sabes, asumimos CAD y lo convertimos.', type: 'select',
            options: [{id:'step',label:'STEP / STP (CAD)'},{id:'blend',label:'Blender (.blend)'},{id:'fbx',label:'FBX'},{id:'stl',label:'STL (impresión 3D)'},{id:'obj',label:'OBJ'},{id:'gltf',label:'glTF / GLB (web)'},{id:'nosabe',label:'No sé / otro'}] },
          { id: 'calidad-fuente', label: 'Calidad del archivo fuente', help: 'Un CAD limpio convierte mejor que fotos.', type: 'select',
            options: [{id:'cad-limpio',label:'CAD limpio con historial'},{id:'mesh-lista',label:'Malla lista (topología buena)'},{id:'scan',label:'Escaneo 3D (necesita limpieza)'},{id:'fotos',label:'Solo fotos o dibujos'}] },
        ],
      },
      {
        id: 'nivel-detalle',
        question: '¿Qué nivel de detalle necesitas?',
        help: 'Más detalle = más horas de modelado. Para web, el nivel 3 suele ser suficiente.',
        demoAsset: true,
        type: 'slider',
        slider: { min: 1, max: 5, step: 0.1, unit: 'nivel', preview: 'detail-level', continuous: true,
          tierMap: [{max:1,tier:'XS'},{max:2,tier:'S'},{max:3,tier:'M'},{max:4,tier:'L'},{max:5,tier:'XL'}] },
        advancedOptions: [
          { id: 'num-materiales', label: 'Cantidad de materiales', help: 'Cada material único añade trabajo.', type: 'slider', min:1, max:15, step:1, defaultValue:2 },
          { id: 'nivel-fidelidad', label: 'Fidelidad visual', help: '1 = estilizado, 5 = réplica exacta del real.', type: 'slider', min:1, max:5, step:1, defaultValue:3 },
          { id: 'carga-poligonal', label: 'Carga poligonal objetivo', help: 'Para web: bajo o medio.', type: 'select',
            options: [{id:'ultra-low',label:'Ultra bajo (<10k) móvil antiguo'},{id:'low',label:'Bajo (10-50k) móvil moderno'},{id:'mid',label:'Medio (50-200k) PC'},{id:'high',label:'Alto (200k+) solo desktop'}] },
          { id: 'texturas-res', label: 'Resolución de texturas', help: '1K-2K suficiente para web.', type: 'select',
            options: [{id:'sin-tex',label:'Sin texturas (solo color)'},{id:'1k',label:'1K (1024px) web estandar'},{id:'2k',label:'2K (2048px) detalle medio'},{id:'4k',label:'4K (4096px) maximo'}] },
        ],
      },
      {
        id: 'superficie',
        question: '¿Cómo es la superficie de tu producto?',
        help: 'De formas duras y prismáticas a curvas orgánicas. El extremo esculpido se acota en una sesión de discovery.',
        type: 'slider',
        slider: { min: 1, max: 5, step: 0.1, unit: 'superficie', preview: 'surface-morph', continuous: true,
          tierMap: [{max:2,tier:'S'},{max:3,tier:'M'},{max:4,tier:'L'},{max:5,tier:'XL'}] },
      },
      // 'estilo' retirada por decisión de producto (2026-08-30): no aportaba al precio.
      {
        id: 'cantidad-piezas',
        question: '¿Cuántas piezas o partes tiene tu producto?',
        help: 'Las instancias de una misma pieza cuentan una vez (40 tornillos = 1 tipo).',
        type: 'slider',
        slider: { min: 1, max: 50, step: 1, unit: 'piezas', preview: 'assembly',
          tierMap: [{max:5,tier:'S'},{max:15,tier:'M'},{max:30,tier:'L'},{max:50,tier:'XL'}] },
        // ciclo 9: 'piezas-moviles'/'piezas-desmontables' retiradas (informativas,
        // no movían el precio — ver auditoria-precios-ciclo7.md §2/§5).
      },
      {
        id: 'materiales-acabado',
        question: '¿Qué acabados tiene tu producto?',
        help: 'Compara en el modelo real: clay simple, materiales variados o texturizado completo.',
        preview: 'finish',
        type: 'cards',
        options: [
          { id: 'simple', label: 'Simple', desc: 'Un solo color o material uniforme' },
          { id: 'variado', label: 'Variado', desc: 'Metal, plástico, goma, pintura' },
          { id: 'detallado', label: 'Detallado', desc: 'Texturas, logos, grabados, desgaste' },
        ],
        // ciclo 9: 'pbr'/'iluminacion' retiradas (informativas).
      },
      {
        id: 'donde-mostrar',
        question: '¿Dónde vas a mostrar el modelo 3D?',
        type: 'select',
        options: [
          { id: 'mi-web', label: 'En mi página web actual' },
          { id: 'landing', label: 'En una landing page nueva' },
          { id: 'feria', label: 'En pantalla táctil (feria)' },
          { id: 'movil', label: 'En app móvil (WebView)' },
        ],
        // ciclo 9: 'cms'/'rendimiento' retiradas (informativas). La pregunta se
        // conserva: 'feria'/'movil' suben el target del visor a Desktop + móvil.
        // ciclo 9: 'interaccion-visual' (rotar/rotar-zoom/auto) retirada COMPLETA
        // — las tres opciones cotizaban igual y no aportaba al precio.
      },
    ],
  },
'interactivo': {
    id: 'interactivo',
    title: 'Experiencia 3D interactiva',
    subtitle: 'El visitante puede hacer cosas: cambiar colores, abrir partes, configurar el producto.',
    questions: [
      {
        id: 'tipo-interactividad',
        question: '¿Qué quieres que pueda hacer el visitante?',
        type: 'cards',
        options: [
          { id: 'rotar', label: 'Solo rotarlo y verlo', desc: 'Vista 360° sin más interacción' },
          { id: 'hotspots', label: 'Ver información de partes', desc: 'Click en una pieza → mostrar nombre, specs o descripción' },
          { id: 'configurar', label: 'Configurar el producto', desc: 'Cambiar colores, materiales, tamaños, opciones' },
          { id: 'desarmar', label: 'Desarmarlo / explorarlo', desc: 'Vista explosionada, abrir/cerrar partes, cortes' },
        ],
      },
      {
        id: 'modelo-existente',
        question: '¿Ya tienes el modelo 3D de tu producto?',
        type: 'cards',
        options: [
          { id: 'si-tengo', label: 'Sí, lo tengo', desc: 'Tengo el archivo en algún formato digital' },
          { id: 'no-crear', label: 'No, hay que crearlo', desc: 'Necesito que modelen mi producto desde cero o desde referencias' },
        ],
        advancedOptions: [
          { id: 'formato-archivo', label: 'Formato del archivo', help: 'Si no lo sabes, asumimos CAD y lo convertimos.', type: 'select',
            options: [{id:'step',label:'STEP / STP (CAD)'},{id:'blend',label:'Blender (.blend)'},{id:'fbx',label:'FBX'},{id:'stl',label:'STL (impresión 3D)'},{id:'obj',label:'OBJ'},{id:'gltf',label:'glTF / GLB (web)'},{id:'nosabe',label:'No sé / otro'}] },
          { id: 'calidad-fuente', label: 'Calidad del archivo fuente', help: 'Un CAD limpio convierte mejor que fotos.', type: 'select',
            options: [{id:'cad-limpio',label:'CAD limpio con historial'},{id:'mesh-lista',label:'Malla lista (topología buena)'},{id:'scan',label:'Escaneo 3D (necesita limpieza)'},{id:'fotos',label:'Solo fotos o dibujos'}] },
        ],
      },
      {
        id: 'nivel-detalle',
        question: '¿Qué nivel de detalle necesitas?',
        help: 'Más detalle = más horas de modelado. Para web, el nivel 3 suele ser suficiente.',
        demoAsset: true,
        type: 'slider',
        slider: { min: 1, max: 5, step: 0.1, unit: 'nivel', preview: 'detail-level', continuous: true,
          tierMap: [{max:1,tier:'XS'},{max:2,tier:'S'},{max:3,tier:'M'},{max:4,tier:'L'},{max:5,tier:'XL'}] },
        advancedOptions: [
          { id: 'carga-poligonal', label: 'Carga poligonal objetivo', help: 'Para web: bajo o medio.', type: 'select',
            options: [{id:'ultra-low',label:'Ultra bajo (<10k) móvil antiguo'},{id:'low',label:'Bajo (10-50k) móvil moderno'},{id:'mid',label:'Medio (50-200k) PC'},{id:'high',label:'Alto (200k+) solo desktop'}] },
        ],
      },
      {
        id: 'superficie',
        question: '¿Cómo es la superficie de tu producto?',
        help: 'De formas duras y prismáticas a curvas orgánicas. El extremo esculpido se acota en una sesión de discovery.',
        type: 'slider',
        slider: { min: 1, max: 5, step: 0.1, unit: 'superficie', preview: 'surface-morph', continuous: true,
          tierMap: [{max:2,tier:'S'},{max:3,tier:'M'},{max:4,tier:'L'},{max:5,tier:'XL'}] },
      },
      // 'estilo' retirada por decisión de producto (2026-08-30): no aportaba al precio.
      {
        id: 'cantidad-piezas',
        question: '¿Cuántas piezas o partes tiene tu producto?',
        help: 'Las instancias de una misma pieza cuentan una vez (40 tornillos = 1 tipo).',
        type: 'slider',
        slider: { min: 1, max: 50, step: 1, unit: 'piezas', preview: 'assembly',
          tierMap: [{max:5,tier:'S'},{max:15,tier:'M'},{max:30,tier:'L'},{max:50,tier:'XL'}] },
        // ciclo 9: 'piezas-moviles' retirada (informativa).
      },
      {
        id: 'materiales-acabado',
        question: '¿Qué acabados tiene tu producto?',
        help: 'Compara en el modelo real: clay simple, materiales variados o texturizado completo.',
        preview: 'finish',
        type: 'cards',
        options: [
          { id: 'simple', label: 'Simple', desc: 'Un solo color o material uniforme' },
          { id: 'variado', label: 'Variado', desc: 'Metal, plástico, goma, pintura' },
          { id: 'detallado', label: 'Detallado', desc: 'Texturas, logos, grabados, desgaste' },
        ],
      },
      {
        id: 'plataforma',
        question: '¿Dónde lo vas a usar?',
        type: 'select',
        options: [
          { id: 'mi-web', label: 'Mi página web actual' },
          { id: 'landing', label: 'Una landing page nueva' },
          { id: 'feria', label: 'Pantalla táctil en feria/evento' },
          { id: 'app', label: 'Aplicación web completa' },
        ],
        // ciclo 9: 'rendimiento' retirada (informativa).
      },
    ],
  },
  'scrollytelling': {
    id: 'scrollytelling',
    title: 'Scrollytelling con 3D',
    subtitle: 'La historia de tu producto se cuenta al hacer scroll — el 3D anima y cambia.',
    questions: [
      {
        id: 'escenas',
        question: '¿Cuántas escenas o momentos tiene tu historia?',
        help: 'Cada escena es una "parada" del scroll donde el 3D muestra algo diferente.',
        type: 'slider',
        slider: {
          min: 1, max: 15, step: 1, unit: 'escenas', preview: 'story',
          tierMap: [
            { max: 4, tier: 'S' },
            { max: 7, tier: 'L' },
            { max: 10, tier: 'XL' },
          ],
        },
      },
      {
        id: 'modelo-para-scroll',
        question: '¿Ya tienes el modelo 3D?',
        type: 'cards',
        options: [
          { id: 'si', label: 'Sí', desc: 'Tengo el archivo listo' },
          { id: 'no', label: 'No', desc: 'Hay que modelarlo' },
        ],
        advancedOptions: [
          { id: 'formato-archivo', label: 'Formato del archivo', help: 'Si no lo sabes, asumimos CAD y lo convertimos.', type: 'select',
            options: [{id:'step',label:'STEP / STP (CAD)'},{id:'blend',label:'Blender (.blend)'},{id:'fbx',label:'FBX'},{id:'stl',label:'STL (impresión 3D)'},{id:'obj',label:'OBJ'},{id:'gltf',label:'glTF / GLB (web)'},{id:'nosabe',label:'No sé / otro'}] },
          { id: 'calidad-fuente', label: 'Calidad del archivo fuente', type: 'select',
            options: [{id:'cad-limpio',label:'CAD limpio con historial'},{id:'mesh-lista',label:'Malla lista (topología buena)'},{id:'scan',label:'Escaneo 3D (necesita limpieza)'},{id:'fotos',label:'Solo fotos o dibujos'}] },
        ],
      },
      {
        id: 'nivel-detalle',
        question: '¿Qué nivel de detalle necesita el modelo?',
        help: 'Para scrollytelling el 3D se ve en movimiento: el nivel 2-3 suele bastar.',
        demoAsset: true,
        type: 'slider',
        slider: { min: 1, max: 5, step: 0.1, unit: 'nivel', preview: 'detail-level', continuous: true,
          tierMap: [{max:1,tier:'XS'},{max:2,tier:'S'},{max:3,tier:'M'},{max:4,tier:'L'},{max:5,tier:'XL'}] },
      },
      {
        id: 'superficie',
        question: '¿Cómo es la superficie de tu producto?',
        help: 'De formas duras y prismáticas a curvas orgánicas. El extremo esculpido se acota en discovery.',
        type: 'slider',
        slider: { min: 1, max: 5, step: 0.1, unit: 'superficie', preview: 'surface-morph', continuous: true,
          tierMap: [{max:2,tier:'S'},{max:3,tier:'M'},{max:4,tier:'L'},{max:5,tier:'XL'}] },
      },
      {
        id: 'cantidad-piezas',
        question: '¿Cuántas piezas o partes tiene tu producto?',
        help: 'Las instancias de una misma pieza cuentan una vez (40 tornillos = 1 tipo).',
        type: 'slider',
        slider: { min: 1, max: 50, step: 1, unit: 'piezas', preview: 'assembly',
          tierMap: [{max:5,tier:'S'},{max:15,tier:'M'},{max:30,tier:'L'},{max:50,tier:'XL'}] },
      },
      {
        id: 'materiales-acabado',
        question: '¿Qué acabados tiene tu producto?',
        help: 'Compara en el modelo real: clay simple, materiales variados o texturizado completo.',
        preview: 'finish',
        type: 'cards',
        options: [
          { id: 'simple', label: 'Simple', desc: 'Un solo color o material uniforme' },
          { id: 'variado', label: 'Variado', desc: 'Metal, plástico, goma, pintura' },
          { id: 'detallado', label: 'Detallado', desc: 'Texturas, logos, grabados, desgaste' },
        ],
      },
      // ciclo 9: 'tono-historia' retirada por decisión de producto — la historia
      // se cuenta igual (cámara/transformación/texto son decisión de diseño, no
      // del cliente) y la pregunta no movía el precio (auditoria-precios-ciclo7.md §2).
    ],
  },
  'web-app': {
    id: 'web-app',
    title: 'Aplicación web 3D completa',
    subtitle: 'Una herramienta que usa 3D como interfaz: configuradores, visores técnicos, herramientas.',
    questions: [
      {
        id: 'tipo-app',
        question: '¿Qué tipo de aplicación necesitas?',
        type: 'cards',
        options: [
          { id: 'configurador', label: 'Configurador de producto', desc: 'El cliente personaliza y ve el resultado en 3D' },
          { id: 'catalogo', label: 'Catálogo 3D interactivo', desc: 'Lista de productos navegables en 3D' },
          { id: 'herramienta', label: 'Herramienta técnica', desc: 'Visor CAD, simulador, herramienta de diseño' },
          { id: 'juego', label: 'Minijuego o experiencia', desc: 'Algo lúdico para engagement' },
        ],
      },
      {
        id: 'num-variantes',
        question: '¿Cuántas variantes u opciones configurables tiene?',
        help: 'Colores, materiales, tamaños, accesorios… cada opción con sus reglas. Una aproximación basta.',
        type: 'slider',
        slider: { min: 2, max: 50, step: 1, unit: 'variantes', preview: 'variant-swirl',
          tierMap: [{max:10,tier:'S'},{max:25,tier:'M'},{max:50,tier:'L'}] },
      },
      {
        id: 'superficie',
        question: '¿Cómo es la superficie de tu producto?',
        help: 'De formas duras y prismáticas a curvas orgánicas. El extremo esculpido se acota en discovery.',
        type: 'slider',
        slider: { min: 1, max: 5, step: 0.1, unit: 'superficie', preview: 'surface-morph', continuous: true,
          tierMap: [{max:2,tier:'S'},{max:3,tier:'M'},{max:4,tier:'L'},{max:5,tier:'XL'}] },
      },
      {
        id: 'cantidad-piezas',
        question: '¿Cuántas piezas o partes tiene tu producto?',
        help: 'Las instancias de una misma pieza cuentan una vez (40 tornillos = 1 tipo).',
        type: 'slider',
        slider: { min: 1, max: 50, step: 1, unit: 'piezas', preview: 'assembly',
          tierMap: [{max:5,tier:'S'},{max:15,tier:'M'},{max:30,tier:'L'},{max:50,tier:'XL'}] },
      },
      {
        id: 'materiales-acabado',
        question: '¿Qué acabados tiene tu producto?',
        help: 'Compara en el modelo real: clay simple, materiales variados o texturizado completo.',
        preview: 'finish',
        type: 'cards',
        options: [
          { id: 'simple', label: 'Simple', desc: 'Un solo color o material uniforme' },
          { id: 'variado', label: 'Variado', desc: 'Metal, plástico, goma, pintura' },
          { id: 'detallado', label: 'Detallado', desc: 'Texturas, logos, grabados, desgaste' },
        ],
      },
      {
        id: 'modelo-existente',
        question: '¿Ya tienes los modelos 3D?',
        type: 'cards',
        options: [
          { id: 'si-tengo', label: 'Sí, los tengo', desc: 'Archivos listos o casi listos' },
          { id: 'no-crear', label: 'No, hay que crearlos', desc: 'Modelamos tus productos desde referencias o CAD' },
        ],
        advancedOptions: [
          { id: 'formato-archivo', label: 'Formato del archivo', help: 'Si no lo sabes, asumimos CAD y lo convertimos.', type: 'select',
            options: [{id:'step',label:'STEP / STP (CAD)'},{id:'blend',label:'Blender (.blend)'},{id:'fbx',label:'FBX'},{id:'stl',label:'STL (impresión 3D)'},{id:'obj',label:'OBJ'},{id:'gltf',label:'glTF / GLB (web)'},{id:'nosabe',label:'No sé / otro'}] },
          { id: 'calidad-fuente', label: 'Calidad del archivo fuente', type: 'select',
            options: [{id:'cad-limpio',label:'CAD limpio con historial'},{id:'mesh-lista',label:'Malla lista (topología buena)'},{id:'scan',label:'Escaneo 3D (necesita limpieza)'},{id:'fotos',label:'Solo fotos o dibujos'}] },
        ],
      },
      {
        id: 'usuarios',
        question: '¿Quién va a usar la aplicación?',
        type: 'select',
        options: [
          { id: 'publico', label: 'Público general (tu web)' },
          { id: 'clientes', label: 'Tus clientes B2B' },
          { id: 'equipo-interno', label: 'Equipo interno / vendedores' },
        ],
        advancedOptions: [
          { id: 'datos', label: '¿De dónde salen los datos (precios, variantes)?', type: 'select',
            options: [{id:'estaticos',label:'Archivo local (JSON)'},{id:'cms',label:'CMS (los editas tú)'},{id:'api',label:'API de mi sistema'}] },
        ],
      },
    ],
  },
};

// ═══════════════════════════════════════════════════════════════
// NIVEL 2 (Web con 3D): ¿Qué tipo de experiencia?
// ═══════════════════════════════════════════════════════════════
export const WEB3D_LEVEL2: TreeOption[] = [
  {
    id: 'ver-modelo',
    label: 'Solo mostrarlo',
    desc: 'Un modelo 3D que se puede rotar en la web, sin más interacción',
    icon: 'eye',
  },
  {
    id: 'interactivo',
    label: 'Que sea interactivo',
    desc: 'Cambiar colores, ver información de partes, configurar el producto',
    icon: 'cursor',
  },
  {
    id: 'scrollytelling',
    label: 'Contar una historia',
    desc: 'El 3D anima y cambia mientras el usuario hace scroll',
    icon: 'story',
  },
  {
    id: 'web-app',
    label: 'Aplicación completa',
    desc: 'Una herramienta web que usa 3D como interfaz principal',
    icon: 'monitor',
  },
];
