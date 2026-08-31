/**
 * i18n.ts — Idioma del cotizador: español (COP) e inglés (USD).
 *
 * Estrategia: el texto español vive donde siempre vivió (componentes y datos)
 * y es la fuente; este módulo aporta el ESPEJO en inglés por ids. Si falta una
 * traducción, la UI cae al español sin romper nada. La moneda se deriva del
 * idioma (decisión ciclo 2.1: español ⇒ COP, inglés ⇒ USD).
 */

import type { Currency } from './types';

export type Lang = 'es' | 'en';
export const LANG_CURRENCY: Record<Lang, Currency> = { es: 'COP', en: 'USD' };

/** Textos EN de la interfaz (el ES vive en los componentes). */
export const EN = {
  navQuote: 'Quote',
  navCatalog: 'Catalog',
  changeService: '← Change service',
  configurePrice: 'Adjust the variables to see the price',
  hours: 'Hours',
  delivery: 'Delivery',
  // ciclo 10: con extras el precio grande es el rango del PROYECTO completo
  yourProject: (n: number) => `Your project · ${n} services`,
  includes: 'Includes',
  alsoIncludes: 'Your project also includes',
  totalProject: 'Project total',
  bundleLine: (n: number, m: number) => `Includes −${n}% for bundling ${m} services`,
  paymentSuggested: 'Suggested payment:',
  rondas: '2 adjustment rounds included · extra round ≈ +10%',
  rangeValidity: 'Indicative range · valid 15 days',
  // ciclo 11: enlace destacado al prototipo en vivo (demo real de trabajo)
  prototypeAside: 'Doubts about the work? See the prototype: Twinsight X500',
  urgency: { normal: 'Standard', soon: 'Rush +30%', critical: 'Critical +50%' },
  launchDiscount: 'Launch discount −25%',
  tierWord: 'tier',
  tierNames: { XS: 'essential', S: 'standard', M: 'professional', L: 'premium', XL: 'maximum' } as Record<string, string>,
  catalogTitle: 'All services',
  catalogSubtitle: 'Web 3D, viewers, configurators, tools.',
  all: 'All',
  from: 'from',
  families: {
    'web-3d': 'Web 3D',
    'asset-rt': 'Realtime Assets',
    'render': '3D Render',
    'ia': 'AI',
    'vfx': 'VFX',
    'datos': 'CAD → Web',
    'texturas': 'Textures',
    'pipeline': 'Pipeline',
    'soporte': 'Support',
  } as Record<string, string>,
  wizard: {
    l1Title: 'What do you want to achieve?',
    l1Sub: 'Pick an option and we walk you through it.',
    notSure: 'Not sure — help me decide →',
    ideaTitle: 'Tell me your idea',
    ideaSub: 'You don’t need to know its name — describe what you imagine.',
    ideaWa: 'Describe your idea and I’ll reply',
    ideaMail: 'Attach files if you have them',
    whatsapp: 'WhatsApp',
    email: 'Email',
    back: '← Back',
    l2Title: 'What kind of 3D website?',
    l2Sub: 'No technical terms needed — describe what you imagine.',
    comingTitle: 'I’ll quote this personally',
    comingSub: 'The guided estimator covers 3D websites. For video, images or AI, message me directly and you’ll have a proposal in under 24 h.',
    comingWa: 'Tell me about your project',
    comingMail: 'With references if you have them',
    verPrecio: 'See estimated price →',
    hint: 'Anything left unanswered uses a recommended value — you can adjust it later.',
    detalles: '+ Technical details (optional)',
    sinOpciones: 'No options for this question.',
    opcionesTecnicas: 'Technical options',
    pieceSingular: 'part in the assembly',
    piecePlural: 'parts in the assembly',
    detailCaptions: ['Sketch — geometry only', 'Base — simple shapes', 'Web — production ready', 'High — fine details', 'Max — photoreal'],
    exploded: 'Exploded view',
    // ciclo 10: nota del asset temporal en los previews de nivel de detalle
    demoAsset: 'Preview uses a work-in-progress demo asset — the final version shows your product with its own models.',
    // ciclo 11: enlace al prototipo en vivo bajo el subtítulo del nivel 1
    prototypeLink: 'See a live prototype: Twinsight X500',
  },
  cta: {
    whatsapp: 'Send via WhatsApp',
    email: 'Send via email',
    copy: 'Copy link',
    print: 'Print / PDF',
    copyOk: '✓ Link copied: paste it to share this exact quote.',
    copyFail: 'Couldn’t copy automatically; select the text manually.',
    promise: 'Reply within 24 h · No commitment · Send your references/files later if you want.',
    subject: '3D project quote',
  },
  pago: { '100% anticipado': '100% upfront', '50/50': '50/50', '40/30/30': '40/30/30', 'Hitos quincenales': 'Biweekly milestones' } as Record<string, string>,
  role: 'Real-Time 3D Developer · Unity WebGL · Applied AI',
  variantes: {
    chip: (i: number, total: number) => `Variant ${i} of ${total} combinations`,
    colores: ['Graphite', 'Arctic white', 'Ocean blue', 'Coral', 'Forest green', 'Sand'],
    materiales: ['Matte finish', 'Glossy finish', 'Brushed metal'],
    accesorios: ['No accessory', 'Mounting ring', 'Carry handle'],
  },
};

/** Variantes del configurador (1.4) — ejes compartidos por ES/EN en el preview. */
export const VARIANTES = {
  colores: ['#3a3f47', '#eef0f2', '#0071e3', '#ff6b57', '#2e7d4f', '#c9b99a'],
  materiales: [
    { es: 'Acabado mate', en: 'Matte finish', roughness: 0.75, metalness: 0.05 },
    { es: 'Acabado brillante', en: 'Glossy finish', roughness: 0.18, metalness: 0.1 },
    { es: 'Metal cepillado', en: 'Brushed metal', roughness: 0.35, metalness: 0.85 },
  ],
  accesorios: [
    { es: 'Sin accesorio', en: 'No accessory', kind: 'ninguno' },
    { es: 'Anillo de montaje', en: 'Mounting ring', kind: 'anillo' },
    { es: 'Asa de transporte', en: 'Carry handle', kind: 'asa' },
  ],
} as const;

/** Contador de tris por etapa del slider de detalle (trazable a POLY_POR_NIVEL). */
export const TRIS_ETIQUETAS = ['≈ 4k tris', '≈ 9k tris', '≈ 40k tris', '≈ 120k tris', '≈ 300k tris'];

/** EN del árbol de decisión, en espejo por ids (si falta un id, cae al ES). */
export const TREE_EN = {
  root: {
    'web-3d': { label: 'A 3D website', desc: 'I want my website to have interactive 3D elements' },
    'video-anim': { label: 'A video or animation', desc: 'I need a 3D video, product animation or VFX' },
    'imagenes': { label: 'Product images', desc: 'Photoreal renders for e-commerce, print or marketing' },
    'ia': { label: 'Artificial intelligence', desc: 'Chatbot, automation or AI integration for my business' },
    'no-se': { label: 'Not sure', desc: 'Show me the full catalog with filters' },
  },
  level2: {
    'ver-modelo': { label: 'Just display it', desc: 'A 3D model that can be rotated on the web, nothing more' },
    'interactivo': { label: 'Make it interactive', desc: 'Change colors, see part info, configure the product' },
    'scrollytelling': { label: 'Tell a story', desc: 'The 3D animates and changes as the user scrolls' },
    'web-app': { label: 'Full application', desc: 'A web tool that uses 3D as its main interface' },
  },
  branches: {
    'ver-modelo': {
      title: 'Display a 3D model on your website',
      subtitle: 'Visitors can rotate it and see it from every angle, installing nothing.',
      questions: {
        'modelo-existente': {
          question: 'Do you already have the 3D model of your product?',
          options: {
            'si-tengo': { label: 'Yes, I have it', desc: 'I have the file in some digital format' },
            'no-crear': { label: 'No, it must be created', desc: 'I need my product modeled from scratch or from references' },
          },
          advanced: {
            'formato-archivo': { label: 'File format', help: 'If you don’t know, we assume CAD and convert it.',
              options: { step: 'STEP / STP (CAD)', blend: 'Blender (.blend)', fbx: 'FBX', stl: 'STL (3D printing)', obj: 'OBJ', gltf: 'glTF / GLB (web)', nosabe: 'Don’t know / other' } },
            'calidad-fuente': { label: 'Source file quality', help: 'A clean CAD converts better than photos.',
              options: { 'cad-limpio': 'Clean CAD with history', 'mesh-lista': 'Ready mesh (good topology)', scan: '3D scan (needs cleanup)', fotos: 'Photos or drawings only' } },
          },
        },
        'nivel-detalle': {
          question: 'What level of detail do you need?',
          help: 'More detail = more modeling hours. For the web, level 3 is usually enough.',
          unit: 'level',
        },
        estilo: {
          question: 'What visual style are you after?',
          help: 'From physically realistic materials to fully stylized shader looks.',
          unit: 'style',
        },
        'cantidad-piezas': {
          question: 'How many parts or pieces does your product have?',
          help: 'One part is simpler than a 20-part assembly.',
          unit: 'parts',
          // ciclo 9: advanced (piezas-moviles / piezas-desmontables) retirado.
        },
        'materiales-acabado': {
          question: 'What finishes does your product have?',
          options: {
            simple: { label: 'Simple', desc: 'A single color or uniform material' },
            variado: { label: 'Varied', desc: 'Metal, plastic, rubber, paint' },
            detallado: { label: 'Detailed', desc: 'Textures, logos, engravings, wear' },
          },
          // ciclo 9: advanced (pbr / iluminacion) retirado.
        },
        // ciclo 9: 'interaccion-visual' retirada del árbol (no aportaba al precio).
        'donde-mostrar': {
          question: 'Where will you show the 3D model?',
          options: {
            'mi-web': { label: 'On my current website' },
            landing: { label: 'On a new landing page' },
            feria: { label: 'On a touch screen (trade show)' },
            movil: { label: 'In a mobile app (WebView)' },
          },
          // ciclo 9: advanced (cms / rendimiento) retirado.
        },
      },
    },
    'interactivo': {
      title: 'Interactive 3D experience',
      subtitle: 'Visitors can do things: change colors, open parts, configure the product.',
      questions: {
        'tipo-interactividad': {
          question: 'What do you want the visitor to be able to do?',
          options: {
            rotar: { label: 'Just rotate and view it', desc: '360° view, nothing more' },
            hotspots: { label: 'See part information', desc: 'Click a part → show name, specs or description' },
            configurar: { label: 'Configure the product', desc: 'Change colors, materials, sizes, options' },
            desarmar: { label: 'Disassemble / explore it', desc: 'Exploded view, open/close parts, cutaways' },
          },
        },
        'modelo-existente': {
          question: 'Do you already have the 3D model of your product?',
          options: {
            'si-tengo': { label: 'Yes, I have it', desc: 'I have the file in some digital format' },
            'no-crear': { label: 'No, it must be created', desc: 'I need my product modeled from scratch or from references' },
          },
        },
        'nivel-detalle': {
          question: 'What level of detail do you need?',
          help: 'More detail = more modeling hours. For the web, level 3 is usually enough.',
          unit: 'level',
        },
        estilo: {
          question: 'What visual style are you after?',
          help: 'From physically realistic materials to fully stylized shader looks.',
          unit: 'style',
        },
        'cantidad-piezas': {
          question: 'How many parts or pieces does your product have?',
          help: 'One part is simpler than a 20-part assembly.',
          unit: 'parts',
        },
        plataforma: {
          question: 'Where will it be used?',
          options: {
            'mi-web': { label: 'My current website' },
            landing: { label: 'A new landing page' },
            feria: { label: 'Touch screen at a trade show/event' },
            app: { label: 'Full web application' },
          },
          // ciclo 9: advanced (rendimiento) retirado.
        },
      },
    },
    'scrollytelling': {
      title: 'Scrollytelling with 3D',
      subtitle: 'Your product’s story unfolds on scroll — the 3D animates and changes.',
      questions: {
        escenas: { question: 'How many scenes or moments does your story have?', help: 'Each scene is a scroll “stop” where the 3D shows something different.', unit: 'scenes' },
        'modelo-para-scroll': {
          question: 'Do you already have the 3D model?',
          options: { si: { label: 'Yes', desc: 'I have the file ready' }, no: { label: 'No', desc: 'It must be modeled' } },
        },
        'nivel-detalle': {
          question: 'What level of detail does the model need?',
          help: 'In scrollytelling the 3D is seen in motion: level 2–3 is usually enough.',
          unit: 'level',
        },
        // ciclo 9: 'tono-historia' retirada del árbol (no aportaba al precio).
      },
    },
    'web-app': {
      title: 'Full 3D web application',
      subtitle: 'A tool that uses 3D as its interface: configurators, technical viewers, tools.',
      questions: {
        'tipo-app': {
          question: 'What kind of application do you need?',
          options: {
            configurador: { label: 'Product configurator', desc: 'The customer customizes and sees the result in 3D' },
            catalogo: { label: 'Interactive 3D catalog', desc: 'A list of products navigable in 3D' },
            herramienta: { label: 'Technical tool', desc: 'CAD viewer, simulator, design tool' },
            juego: { label: 'Minigame or experience', desc: 'Something playful for engagement' },
          },
        },
        'num-variantes': {
          question: 'How many configurable variants or options does it have?',
          help: 'Colors, materials, sizes, accessories… each option with its rules. An approximation is fine.',
          unit: 'variants',
        },
        'modelo-existente': {
          question: 'Do you already have the 3D models?',
          options: {
            'si-tengo': { label: 'Yes, I have them', desc: 'Files ready or almost ready' },
            'no-crear': { label: 'No, they must be created', desc: 'We model your products from references or CAD' },
          },
        },
        usuarios: {
          question: 'Who will use the application?',
          options: {
            publico: { label: 'General public (your website)' },
            clientes: { label: 'Your B2B customers' },
            'equipo-interno': { label: 'Internal team / sales reps' },
          },
          advanced: {
            datos: { label: 'Where does the data come from (prices, variants)?',
              options: { estaticos: 'Local file (JSON)', cms: 'CMS (you edit it)', api: 'My system’s API' } },
          },
        },
      },
    },
  },
} as const;

/** EN de variables de servicio (subset alcanzable desde el wizard web-3D). */
export const VARS_EN: Record<string, Record<string, { question: string; unit?: string; help?: string; opciones?: Record<string, string> }>> = {
  'WEB-01': {
    numHotspots: { question: 'How many parts of the model will have an info point?', unit: 'points', help: 'Each point marks a part; clicking it shows its name or specs. The preview above shows them live.' },
    datos: { question: 'Do the data come from a CMS/API or are they hard-coded?', opciones: { 'Fijos (hardcode)': 'Hard-coded', 'Dinámicos (CMS/API)': 'Dynamic (CMS/API)' } },
    target: { question: 'Where does it run?', opciones: { 'Desktop': 'Desktop', 'Desktop + móvil': 'Desktop + mobile' } },
  },
  'WEB-02': { numEscenas: { question: 'How many scenes do you need to embed?', unit: 'scenes' } },
  'WEB-03': {
    tamanoProyecto: { question: 'How big is the Unity project?', opciones: { 'Pequeño (demo/prototype)': 'Small (demo/prototype)', 'Medio (producto funcional)': 'Medium (working product)', 'Grande (app completa)': 'Large (full app)' } },
    bridge: { question: 'Do you need JS↔Unity communication?' },
  },
  'WEB-04': {
    numVariantes: { question: 'How many configuration variants or rules?', unit: 'variants' },
    numSKUs: { question: 'How many distinct products will it serve?', unit: 'SKUs', help: 'Each product gets its own 3D model inside the same app. If there is only one, leave it at 1.' },
    fuenteDatos: { question: 'Where does the data come from?', opciones: { 'Estáticos (JSON local)': 'Local JSON file', 'CMS': 'CMS', 'API externa': 'External API' } },
    auth: { question: 'Does it need login/authentication?' },
  },
  'WEB-05': { numSecciones: { question: 'How many scroll stops will the story have?', unit: 'sections', help: 'This is the number of scenes you set in the wizard; you can adjust it here.' } },
  'WEB-06': {
    mecanica: { question: 'What kind of gameplay?', opciones: { 'Simple (quiz, memory, puzzle)': 'Simple (quiz, memory, puzzle)', 'Media (runner, plataforma)': 'Medium (runner, platformer)', 'Compleja (multiplayer, física)': 'Complex (multiplayer, physics)' } },
    scores: { question: 'Does it need a leaderboard/scores?' },
  },
  'WEB-07': {
    numProductos: { question: 'How many products in the catalog?', unit: 'products' },
    filtros: { question: 'Does it need filters and search?' },
  },
  'WEB-08': {
    numSlides: { question: 'How many slides or sections?', unit: 'slides' },
    tiene3D: { question: 'Does it include an interactive 3D block?' },
  },
  'RTA-05': {
    numShaders: { question: 'How many shaders or effects do you need?', unit: 'shaders' },
    target: { question: 'Where does it run?', opciones: { 'Desktop': 'Desktop', 'Desktop + móvil': 'Desktop + mobile' } },
  },
  'RTA-01': {
    polyCount: { question: 'What polygon budget does it need?', unit: 'tris' },
    tipoSuperficie: { question: 'What is the product surface like?', unit: 'surface' },
    numPiezas: { question: 'How many parts does the model have?', unit: 'parts' },
    fuente: { question: 'Where does the model come from?', opciones: { 'Ya tengo el modelo 3D': 'I already have the 3D model', 'Desde CAD (requiere conversión)': 'From CAD (needs conversion)', 'Desde fotos (requiere modelado)': 'From photos (needs modeling)' } },
    numTexturas: { question: 'How many PBR texture sets?', unit: 'sets' },
  },
  'CAD-01': {
    numPiezas: { question: 'How many parts does the CAD assembly have?', unit: 'parts' },
    complejidad: { question: 'What is the geometry like?', opciones: { 'Prismática (cajas, placas, tubo recto)': 'Prismatic (boxes, plates, straight tube)', 'Freeform moderada (carenas, fillets)': 'Moderate freeform (hulls, fillets)', 'Compleja (roscas, cables, orgánico)': 'Complex (threads, cables, organic)' } },
    calidadCAD: { question: 'How is the source CAD?', opciones: { 'Limpio (export correcto, unidades ok)': 'Clean (correct export, units ok)', 'Con problemas (tolerancias, geometría sucia)': 'With issues (tolerances, dirty geometry)' } },
    target: { question: 'Which platform?', opciones: { 'Desktop web': 'Desktop web', 'Móvil exigente': 'Demanding mobile' } },
  },
};

/** EN de tarjetas de catálogo y entregables (subset web-3D + assets del wizard). */
export const CATALOG_EN: Record<string, { name: string; unit: string; desc: string; entregables?: string[] }> = {
  'WEB-01': { name: 'Custom three.js / Babylon.js viewer', unit: 'web viewer', desc: 'Custom web viewer with orbit, hotspots, UI and mobile performance.', entregables: ['Interactive web viewer', 'Optimized loading pipeline', 'Mobile-first responsive', 'Analytics events'] },
  'WEB-02': { name: 'Embedded viewer (Spline/Sketchfab/model-viewer)', unit: 'embed', desc: 'Visualization via an existing platform: cheaper and faster, less control than a custom viewer.', entregables: ['Asset adapted to the platform format', 'Responsive embed configured'] },
  'WEB-03': { name: 'Unity WebGL: build & embedding', unit: 'build', desc: 'Unity project running on the web with good loading and a mobile memory budget.', entregables: ['Compressed WebGL build (Brotli/gzip)', 'Loading template', 'Responsive embed', 'Deployment guide'] },
  'WEB-04': { name: '3D Web App (configurator/tool)', unit: 'web application', desc: 'Web application with real state: configurators, technical tools.', entregables: ['Complete web application', 'Configurable 3D scene', 'Result export/share', 'Documented deploy'] },
  'WEB-05': { name: 'Scrollytelling with 3D', unit: 'page/experience', desc: 'Scroll-driven narrative where the 3D scene evolves (camera, state, DOM sections).', entregables: ['Implemented page/section', 'Calibrated scroll timeline', 'Static fallback for low-end phones'] },
  'WEB-06': { name: 'Web minigame', unit: 'game', desc: 'Playable browser game (three.js or Unity WebGL), score, states, touch controls.', entregables: ['Documented mini-GDD', 'Touch controls', 'Start/end screens', 'Optional analytics hook'] },
  'WEB-07': { name: 'Interactive 3D catalog', unit: 'catalog/project', desc: 'Navigable product catalog with a shared 3D viewer, filters and JSON/CMS-lite sheets.', entregables: ['Navigable catalog', 'Shared 3D viewer', 'Filters and sheets', 'JSON/CMS-lite data management'] },
  'WEB-08': { name: 'Interactive web presentation', unit: 'presentation', desc: 'Navigable presentation (a living alternative to PPT/PDF) with embedded 3D and non-linear navigation.', entregables: ['Navigable presentation with embedded 3D', 'Media and non-linear navigation'] },
  'RTA-01': { name: 'Static realtime 3D asset', unit: 'optimized asset', desc: '3D model optimized for WebGL/games.', entregables: ['GLB/GLTF with Draco/KTX2', 'PBR textures', 'LODs', 'Performance report'] },
  'RTA-04': { name: 'Interactive animated model', unit: 'animated asset + control', desc: 'User-controlled animation: play/pause, clip selection, per-part triggers. Includes base asset.', entregables: ['Everything in RTA-03', 'Integrated control module (UI + state)'] },
  'RTA-05': { name: 'Stylized shaders', unit: 'shader / set', desc: 'Custom materials (toon, hologram, dissolve, fresnel) on existing assets, with mobile fallback.', entregables: ['Shader(s) on existing asset', 'Mobile fallback', 'Integration + performance tuning'] },
  'CAD-01': { name: 'CAD to WebGL-ready (flagship service)', unit: 'CAD assembly', desc: 'Conversion of CAD assemblies into optimized web assets with per-part metadata.', entregables: ['Optimized GLB with per-part metadata', 'LODs + compression', 'Technical PBR textures', 'Viewer QA + perf report'] },
};

/** EN de las etiquetas/notas que treeToQuote pone en los extras del panel. */
export const EXTRA_LABELS_EN: Record<string, string> = {
  'El visor 3D en tu web': 'The 3D viewer on your website',
  'La creación del modelo 3D': 'The 3D model creation',
  'La conversión de tu CAD a web': 'Converting your CAD for the web',
  'La preparación de tu modelo para web': 'Preparing your model for the web',
  'La aplicación web 3D': 'The 3D web application',
  'La experiencia de scrollytelling': 'The scrollytelling experience',
  'El catálogo 3D interactivo': 'The interactive 3D catalog',
  'El minijuego web': 'The web minigame',
};
export const EXTRA_NOTAS_EN: Record<string, string> = {
  'Tu producto aún no tiene modelo 3D: hay que construirlo antes de programar el visor.': 'Your product doesn’t have a 3D model yet: it must be built before programming the viewer.',
  'Tu archivo CAD se convierte y optimiza para correr en el navegador.': 'Your CAD file is converted and optimized to run in the browser.',
  'Tu archivo (escaneo o fotos) se reconstruye como modelo optimizado para web.': 'Your file (scan or photos) is rebuilt as a web-optimized model.',
  'El despiece interactivo se agrega como mecánica sobre el asset (RTA-06) — lo afinamos por chat.': 'The interactive exploded view is added as mechanics on the asset (RTA-06) — we fine-tune it by chat.',
};
