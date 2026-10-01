/**
 * i18nMore.ts — Traducciones EN que faltaban (ciclo 30, 2026-09-30).
 * Auditoría: 63 variables y 16 servicios del catálogo no tenían inglés y el cotizador
 * mezclaba idiomas. Se fusionan en VARS_EN / CATALOG_EN desde i18n.ts (aditivo).
 * Las claves de `opciones` son los valores en español (son datos del motor, no se tocan).
 */
type VarEn = { question: string; unit?: string; help?: string; opciones?: Record<string, string> };

export const VARS_EN_MORE: Record<string, Record<string, VarEn>> = {
  'RND-01': {
    numImagenes: { question: 'How many images do you need?', unit: 'images' },
    numMateriales: { question: 'How many different materials does the product have?', unit: 'materials' },
    setDressing: { question: 'Do you need set dressing (props, environment)?' },
    modeloAportado: { question: 'Do you already have the 3D model?' },
    resolucion: { question: 'What resolution do you need?', opciones: { 'Web (≤2K)': 'Web (≤2K)', 'Print (4K+)': 'Print (4K+)' } },
    pipelineImagen: {
      question: 'How are the images produced?',
      help: 'AI is cheaper and faster; full 3D gives exact control of the product (dimensions, materials, angles).',
      opciones: {
        'Solo IA (generativa, sin modelo 3D)': 'AI only (generative, no 3D model)',
        '3D + IA (base 3D, variaciones/retoque con IA)': '3D + AI (3D base, AI variations/retouch)',
        'Render 3D fotorrealista completo': 'Full photoreal 3D render',
      },
    },
    ambientacion: {
      question: 'Background or environment?',
      opciones: { 'Fondo neutro de estudio': 'Neutral studio background', 'Escena simple (mesa, pared, props)': 'Simple scene (table, wall, props)', 'Escena lifestyle completa': 'Full lifestyle scene' },
    },
  },
  'RND-02': {
    duracion: { question: 'How many seconds should the video last?', unit: 'seconds' },
    numShots: { question: 'How many shots or cuts?', unit: 'shots' },
    simulaciones: { question: 'Does it include simulations (particles, fluids)?' },
    audioSync: { question: 'Sync with audio?' },
    motorRender: {
      question: 'How is the video rendered?',
      help: 'Real-time is faster and cheaper; prerendering gives cinematic quality.',
      opciones: {
        'Tiempo real (Eevee / Unreal)': 'Real-time (Eevee / Unreal)',
        'Prerender fotorrealista (Cycles / Redshift)': 'Photoreal prerender (Cycles / Redshift)',
        'Prerender + simulación (Houdini)': 'Prerender + simulation (Houdini)',
      },
    },
    resolucionVideo: { question: 'Output resolution?', opciones: { '1080p': '1080p', '2K / 1440p': '2K / 1440p', '4K': '4K' } },
  },
  'RTA-02': {
    polyCount: { question: 'What polygon budget?', unit: 'tris' },
    numHotspots: { question: 'How many hotspots or selectable parts?', unit: 'hotspots' },
  },
  'RTA-03': {
    polyCount: { question: 'What polygon budget?', unit: 'tris' },
    numLoops: { question: 'How many looping animation clips?', unit: 'clips' },
    rig: { question: 'Does it need a rig (skeleton to animate)?' },
    tipoAnimacion: {
      question: 'What kind of animation?',
      opciones: { 'Mecánica (piezas que giran o se desplazan)': 'Mechanical (parts that rotate or slide)', 'Orgánica / deformación': 'Organic / deformation', 'Personaje con rig completo': 'Fully rigged character' },
    },
  },
  'RTA-04': {
    polyCount: { question: 'What polygon budget?', unit: 'tris' },
    numEstados: { question: 'How many states or interactive animations?', unit: 'states' },
    rig: { question: 'Does it need a rig?' },
  },
  'RTA-06': {
    numPartes: { question: 'How many moving parts in the exploded view?', unit: 'parts' },
    profundidad: {
      question: 'How detailed should the exploded view be?',
      opciones: { 'Explosión simple (una etapa)': 'Simple explode (one stage)', 'Múltiples etapas con etiquetas': 'Multiple stages with labels', 'Completo con cotas y medición': 'Full, with dimensions and measuring' },
    },
  },
  'WEB-07': {
    carrito: { question: 'Does it include a cart or per-product quote?' },
    cmsCatalogo: { question: 'Is the catalog managed from a CMS?' },
  },
  'WEB-08': {
    animacionesSlides: {
      question: 'Animation level between slides?',
      opciones: { 'Transiciones simples': 'Simple transitions', 'Animaciones coreografiadas': 'Choreographed animations', '3D guiado por la narrativa': 'Story-driven 3D' },
    },
  },
  'AI-01': {
    fuentes: { question: 'How many content sources (docs, FAQs, pages)?', unit: 'sources' },
    idiomas: { question: 'In how many languages?', unit: 'languages' },
    acciones: { question: 'Can the chat take actions (book, search, etc.)?' },
    canales: { question: 'In how many channels does it reply (web, WhatsApp, Slack…)?', unit: 'channels' },
    integraciones: { question: 'How many systems does it connect to (CRM, calendar, inventory)?', unit: 'systems' },
    volumen: {
      question: 'Expected conversation volume?',
      help: 'Volume defines caching, limits and monitoring; API costs are paid by the client.',
      opciones: { 'Bajo (< 500/mes)': 'Low (< 500/month)', 'Medio (500–5.000/mes)': 'Medium (500–5,000/month)', 'Alto (> 5.000/mes)': 'High (> 5,000/month)' },
    },
  },
  'AI-02': {
    numFlujos: { question: 'How many flows do you want to automate?', unit: 'flows' },
    datosPrivados: { question: 'Does it process sensitive or private data?', help: 'Requires anonymization, logging and additional controls.' },
    evaluacionIA: {
      question: 'What level of quality evaluation?',
      opciones: { 'Pruebas manuales': 'Manual testing', 'Set de casos automatizado': 'Automated test set', 'Evaluación continua con métricas': 'Continuous evaluation with metrics' },
    },
  },
  'AI-03': {
    numProcesos: { question: 'How many processes do you want to automate?', unit: 'processes' },
    madurez: {
      question: 'How digital is your team?',
      opciones: { 'Muy digitalizado (herramientas cloud)': 'Highly digital (cloud tools)', 'Parcialmente digital': 'Partly digital', 'Poco digitalizado (papel/excel)': 'Barely digital (paper/Excel)' },
    },
    numSistemas: { question: 'How many systems or tools must be connected?', unit: 'systems' },
    aprobacionHumana: { question: 'Does the flow require human approval?' },
  },
  'AI-04': {
    tamanoOrg: { question: 'How big is the organization?', opciones: { 'Pequeña (<20 personas)': 'Small (<20 people)', 'Mediana (20–100)': 'Medium (20–100)', 'Grande (>100)': 'Large (>100)' } },
    numAreas: { question: 'How many areas or teams are assessed?', unit: 'areas' },
    entregableIA: { question: 'Which deliverable do you need?', opciones: { 'Diagnóstico': 'Assessment', 'Diagnóstico + hoja de ruta': 'Assessment + roadmap', 'Hoja de ruta + piloto': 'Roadmap + pilot' } },
  },
  'VFX-01': {
    complejidadFondo: { question: 'How complex is the background?', opciones: { 'Plano/simple': 'Flat/simple', 'Con profundidad': 'With depth', 'Muy complejo (muchos elementos)': 'Very complex (many elements)' } },
    duracionVfx: { question: 'How many seconds of footage with 3D?', unit: 'seconds' },
    tracking: { question: 'Does the camera move?', opciones: { 'Cámara fija': 'Locked-off camera', 'Tracking 2D': '2D tracking', 'Matchmove 3D': '3D matchmove' } },
  },
  'VFX-02': {
    movimientoCamara: { question: 'How does the camera move?', opciones: { 'Estática': 'Static', 'Handheld': 'Handheld', 'Dolly/grúa compleja': 'Complex dolly/crane' } },
    numElementosCG: { question: 'How many CG elements?', unit: 'elements' },
    tieneFX: { question: 'Does it include FX (particles, smoke)?' },
    duracionFx: { question: 'How many seconds of effect?', unit: 'seconds' },
    herramientaFx: {
      question: 'How is the effect produced?',
      help: 'Houdini gives higher-fidelity physical simulations; real-time iterates faster.',
      opciones: { 'Tiempo real (Unreal Niagara / EmberGen)': 'Real-time (Unreal Niagara / EmberGen)', 'Houdini prerenderizado': 'Prerendered Houdini' },
    },
  },
  'VFX-03': {
    tipoSim: { question: 'What kind of simulation?', opciones: { 'Partículas simples': 'Simple particles', 'Volumétricos (humo/niebla)': 'Volumetrics (smoke/fog)', 'Fluidos/destrucción RBD': 'Fluids/RBD destruction' } },
    reutilizable: { question: 'Do you need a reusable parametric setup?' },
    duracionMg: { question: 'Total length of the piece?', unit: 'seconds' },
    formatos: { question: 'In how many formats (16:9, 9:16, 1:1…)?', unit: 'formats' },
  },
  'TEX-01': {
    numSets: { question: 'How many texture sets?', unit: 'sets' },
    noai: { question: 'NoAI restriction (procedural only)?' },
    resolucionTex: { question: 'Texture resolution?', opciones: { '2K': '2K', '4K': '4K', '8K': '8K' } },
  },
  'PIPE-01': {
    numScripts: { question: 'How many scripts or tools?', unit: 'scripts' },
    dcc: { question: 'In which software?', opciones: { 'Blender': 'Blender', 'Houdini o Substance': 'Houdini or Substance', 'Varias herramientas (multi-DCC)': 'Several tools (multi-DCC)' } },
    interfaz: { question: 'Does it need a UI (panel / add-on)?' },
  },
  'CON-01': { numSesiones: { question: 'How many consulting sessions?', unit: 'sessions' } },
  'RET-01': {
    plan: {
      question: 'Which retainer plan?',
      opciones: { 'Lite (4 h/mes)': 'Lite (4 h/month)', 'Standard (8 h/mes)': 'Standard (8 h/month)', 'Pro (16 h/mes)': 'Pro (16 h/month)', 'Business (40 h/mes)': 'Business (40 h/month)', 'Enterprise (80 h/mes)': 'Enterprise (80 h/month)' },
    },
  },
};

export const CATALOG_EN_MORE: Record<string, { name: string; unit: string; desc: string; entregables?: string[] }> = {
  'RND-01': { name: '3D product render (still)', unit: 'image', desc: 'Photoreal images of a product, object or scene for e-commerce, marketing or print.', entregables: ['High-resolution images (PNG/JPG/EXR)', 'Versions in agreed formats', '2 revision rounds'] },
  'RND-02': { name: '3D animation (offline render)', unit: 'clip (XS = 2–3 s loop)', desc: 'Rendered video for social media, web or presentations.', entregables: ['H.264/H.265 master video', '16:9, 1:1 and 9:16 versions', '2 revision rounds'] },
  'RTA-02': { name: 'Interactive real-time asset (hotspots)', unit: 'asset + interactivity', desc: '3D model with hotspots and part selection.', entregables: ['Everything in RTA-01', 'Hotspots with per-part info', 'Highlight/selection'] },
  'AI-01': { name: 'AI assistant on your website (RAG chat)', unit: 'installed assistant', desc: 'AI chat trained on your own content via RAG.', entregables: ['Embedded chat widget', 'RAG over your content', 'Guardrails/disclaimers', 'Documented test cases'] },
  'CON-01': { name: '3D / web technical consulting', unit: 'session or report', desc: 'Discovery, technical audits and roadmaps.', entregables: ['Discovery report', 'Draft SOW with estimate', 'Presentation to the team'] },
  'RET-01': { name: 'Monthly retainer', unit: 'hours/month block', desc: 'Recurring availability with an SLA per tier.', entregables: ['Recurring availability', 'Response SLA', '50% of hours roll over'] },
  'RTA-03': { name: 'Animated model (non-interactive)', unit: 'animated asset (GLB)', desc: 'Real-time asset with autoplay animation (operation/assembly/demo loop). Includes the base asset.', entregables: ['Everything in RTA-01', 'Embedded animation clips', 'Autoplay setup'] },
  'RTA-06': { name: 'Mechanics on a real-time asset', unit: 'mechanic', desc: 'Advanced interactivity on a real-time-ready asset: exploded view, cutaway, configurator, measurements.', entregables: ['Mechanic implemented on the asset', 'Labels/slider/caps as needed'] },
  'AI-02': { name: 'Embedded AI in a web product', unit: 'feature/package', desc: 'AI-powered features without a visible chat: semantic search, recommendations, templated generation.', entregables: ['AI features integrated into the web product', 'Lightweight control panel (tier L)'] },
  'AI-03': { name: 'Internal automation with LLMs', unit: 'workflow package', desc: 'LLM-assisted workflow for a repetitive manual process, with human review where risk requires it.', entregables: ['Process map + specification', 'Implemented workflow', 'Versioned prompts', 'Tests with real data', 'Handoff training'] },
  'AI-04': { name: 'AI consulting and audit', unit: 'audit/package', desc: 'Assessment of where AI adds real value, with a plan prioritized by impact/effort and risks.', entregables: ['Prioritized opportunities report', 'Actionable quick wins', 'Risk and cost matrix', 'First quick win (Roadmap + Pilot package)'] },
  'VFX-01': { name: '3D model composited into real footage', unit: 'shot', desc: 'A 3D model placed into real footage: tracking, lighting match and final compositing.', entregables: ['Final video/photo per shot', 'Key passes on request'] },
  'VFX-02': { name: 'Pure FX (video simulations)', unit: 'shot', desc: 'Simulated effects for video: particles, smoke, liquids, destruction, cloth.', entregables: ['FX simulation per shot', 'Look iteration within revision rounds'] },
  'VFX-03': { name: '3D motion graphics', unit: 'piece/package', desc: 'Animated graphics with a 3D component: logo reveals, lower thirds, transitions, templates.', entregables: ['Animated 3D graphic pieces', 'Reusable template (full branding)'] },
  'TEX-01': { name: 'Texture and map generation', unit: 'set/asset', desc: 'PBR map sets (albedo/normal/roughness/metal/AO), tileable, procedural or asset texturing.', entregables: ['Complete PBR map sets', 'Asset texturing', 'Standalone high→low bake'] },
  'PIPE-01': { name: 'Pipeline automation / scripts / tools', unit: 'tool', desc: 'Tools that remove repetitive work: Blender scripts (Python), Unity editor tools (C#), batch conversion, automated QA.', entregables: ['Tool (script/tool/pipeline)', 'Technical README', 'Explicit error handling', 'Handoff session'] },
};

/** Ramas generadas (serviceBranches.SERVICE_ROOTS) en inglés. */
export const SERVICE_ROOTS_EN: Record<string, { title: string; subtitle: string; options: Record<string, { label: string; desc: string }> }> = {
  'video-anim': {
    title: 'What kind of video do you need?', subtitle: 'Pick the closest one; you fine-tune the details next.',
    options: {
      'RND-02': { label: '3D product animation', desc: 'Rendered video: the product spins, assembles or shows in action' },
      'VFX-01': { label: 'My product in real footage', desc: 'Place a 3D model into your photos or videos' },
      'VFX-02': { label: 'Visual effects (VFX)', desc: 'Simulations, particles, smoke or destruction over video' },
      'VFX-03': { label: '3D motion graphics', desc: 'Animated pieces for social media, intros or ads' },
    },
  },
  imagenes: {
    title: 'What images do you need?', subtitle: 'Photoreal renders or ready-to-use materials.',
    options: {
      'RND-01': { label: 'Product renders', desc: 'Photoreal images for e-commerce, catalog or print' },
      'RTA-01': { label: '3D model of your product', desc: 'Build the optimized 3D model (for web, AR or future renders)' },
      'TEX-01': { label: 'Textures and materials', desc: 'PBR texture sets for your models or engine' },
    },
  },
  ia: {
    title: 'What do you want to do with AI?', subtitle: 'Practical LLM integrations, measurable and with a closed scope.',
    options: {
      'AI-01': { label: 'An assistant on my website', desc: 'A chat that answers with your business information' },
      'AI-02': { label: 'AI inside my product', desc: 'AI features in your web or app (summaries, search, classification)' },
      'AI-03': { label: 'Automate internal processes', desc: 'AI workflows that save hours of repetitive work' },
      'AI-04': { label: 'AI consulting', desc: 'Audit and roadmap to adopt AI in your organization' },
    },
  },
  otros: {
    title: 'What do you need?', subtitle: 'Technical 3D, web and support services.',
    options: {
      'CAD-01': { label: 'My CAD on the web', desc: 'Turn CAD/STEP models into lightweight 3D for the browser' },
      'RTA-03': { label: 'Animated model', desc: 'A 3D model with looping animations for web or apps' },
      'WEB-07': { label: '3D catalog', desc: 'Several browsable 3D products with filters' },
      'WEB-08': { label: 'Interactive presentation', desc: 'A web presentation with slides and 3D' },
      'PIPE-01': { label: 'Tools and scripts', desc: 'Automate your 3D pipeline (Blender, exports, validations)' },
      'CON-01': { label: 'Technical consulting', desc: 'Sessions to solve 3D or web questions' },
      'RET-01': { label: 'Monthly support', desc: 'Fixed hours per month for maintenance and improvements' },
    },
  },
};

/** Nombres en español CON tildes para mostrar (catalogCore guarda los nombres sin tildes). */
export const NAME_ES_DISPLAY: Record<string, string> = {
  'RND-01': 'Render 3D estático', 'RND-02': 'Animación 3D (render offline)', 'RTA-01': 'Asset 3D en tiempo real (estático)',
  'RTA-02': 'Asset en tiempo real interactivo (hotspots)', 'CAD-01': 'CAD a WebGL (servicio insignia)', 'WEB-01': 'Visor 3D a medida (three.js / Babylon.js)',
  'WEB-04': 'Web app 3D (configurador / herramienta)', 'AI-01': 'Asistente de IA en tu web (chat RAG)', 'CON-01': 'Consultoría técnica 3D / web',
  'RET-01': 'Soporte mensual (retainer)', 'RTA-03': 'Modelo animado no interactivo', 'RTA-04': 'Modelo animado interactivo', 'RTA-05': 'Shaders estilizados',
  'RTA-06': 'Mecánicas sobre asset en tiempo real', 'WEB-02': 'Visor embebido (Spline / Sketchfab / model-viewer)', 'WEB-03': 'Unity WebGL: build y embebido',
  'WEB-05': 'Scrollytelling con 3D', 'WEB-06': 'Minijuego web', 'WEB-07': 'Catálogo 3D interactivo', 'WEB-08': 'Presentación web interactiva',
  'AI-02': 'IA integrada en producto web', 'AI-03': 'Automatización interna con LLM', 'AI-04': 'Consultoría y auditoría de IA',
  'VFX-01': 'Modelo 3D integrado en foto/video real', 'VFX-02': 'FX puro (simulaciones en video)', 'VFX-03': 'Motion graphics 3D',
  'TEX-01': 'Generación de texturas y mapas', 'PIPE-01': 'Automatización de pipeline / scripts / herramientas',
};

/** Ciclo 30 — inglés COMPARTIDO por id de pregunta (fallback para todas las ramas web-3d). */
type QEn = { question?: string; help?: string; unit?: string; options?: Record<string, { label: string; desc?: string }>; advanced?: Record<string, { label?: string; help?: string; options?: Record<string, string> }> };
const FORMAT_OPTS = { step: 'STEP / STP (CAD)', blend: 'Blender (.blend)', fbx: 'FBX', stl: 'STL (3D printing)', obj: 'OBJ', gltf: 'glTF / GLB (web)', nosabe: "Don't know / other" };
const QUALITY_OPTS = { 'cad-limpio': 'Clean CAD with history', 'mesh-lista': 'Ready mesh (good topology)', scan: '3D scan (needs cleanup)', fotos: 'Only photos or drawings' };
const SOURCE_ADV = {
  'formato-archivo': { label: 'File format', help: "If you don't know, we assume CAD and convert it.", options: FORMAT_OPTS },
  'calidad-fuente': { label: 'Source file quality', help: 'A clean CAD converts better than photos.', options: QUALITY_OPTS },
};
export const TREE_SHARED_EN: Record<string, QEn> = {
  superficie: { question: "What is your product's surface like?", help: 'From hard, prismatic shapes to organic curves. The sculpted extreme is scoped in a discovery session.', unit: 'surface' },
  'cantidad-piezas': { question: 'How many pieces or parts does your product have?', help: 'Instances of the same part count once (40 screws = 1 type).', unit: 'parts' },
  'materiales-acabado': {
    question: 'What finishes does your product have?',
    help: 'Compare on the real model: simple clay, varied materials or full texturing.',
    options: { simple: { label: 'Simple', desc: 'A single color or uniform material' }, variado: { label: 'Varied', desc: 'Metal, plastic, rubber, paint' }, detallado: { label: 'Detailed', desc: 'Textures, logos, engravings, wear' } },
  },
  'nivel-detalle': {
    advanced: {
      'num-materiales': { label: 'Number of materials', help: 'Each unique material adds work. Defaults to the chosen finish.' },
      'carga-poligonal': { label: 'Target polygon budget', help: 'For the web: low or medium.', options: { 'ultra-low': 'Ultra low (<10k) old phones', low: 'Low (10–50k) modern phones', mid: 'Medium (50–200k) PC', high: 'High (200k+) desktop only' } },
    },
  },
  'tipo-interactividad': {
    help: 'You can pick several.',
    advanced: {
      'num-hotspots': { label: 'Number of information points', help: 'Each point with its own text/card. 8 by default.' },
      'datos-hotspots': { label: 'Information source', help: 'Connecting to a CMS or API adds integration work.', options: { fijos: 'Fixed (we write it)', cms: 'Dynamic (CMS / API)' } },
      'profundidad-despiece': { label: 'Exploded view depth', help: 'Only applies if you chose disassemble.', options: { simple: 'Simple explode', etapas: 'Several stages with labels', cotas: 'With dimensions and measuring' } },
    },
  },
  'modelo-existente': { advanced: SOURCE_ADV },
  'modelo-para-scroll': { advanced: SOURCE_ADV },
};

/** Ciclo 31 (auditoría): unidad visible en el catálogo ES — tildes y sin jerga interna.
 *  Aditivo: el dato base (`unitEs`) no cambia; se usa solo para mostrar. */
export const UNIT_ES_DISPLAY: Record<string, string> = {
  'clip (XS=loop 2-3s)': 'clip animado',
  'asset + interactividad': 'asset con interactividad',
  'aplicacion web': 'aplicación web',
  'sesion o informe': 'sesión o informe',
  'bloque horas/mes': 'bloque de horas al mes',
  'asset animado (GLB)': 'asset animado (GLB)',
  'mecanica': 'mecánica',
  'embed': 'visor embebido',
  'build': 'build web',
  'pagina/experiencia': 'página o experiencia',
  'catalogo/proyecto': 'catálogo por proyecto',
  'presentacion': 'presentación',
  'feature/paquete': 'función o paquete',
  'paquete workflow': 'paquete de flujo de trabajo',
  'auditoria/paquete': 'auditoría o paquete',
  'shot': 'plano',
  'pieza/paquete': 'pieza o paquete',
  'set/asset': 'set por asset',
  'shader / set': 'shader o set',
};

/** Ciclo 31 (auditoría de contenido): texto ES visible sin jerga en inglés ni tildes faltantes.
 *  SOLO presentación: los valores base (`valorEs`, `entregablesEs`…) siguen intactos porque el motor,
 *  los enlaces profundos y las pruebas dependen de ellos. Primero frases completas, luego palabras. */
const PHRASE_ES: Record<string, string> = {
  'Fijos (hardcode)': 'Fijos (no cambian)',
  'Desktop': 'Escritorio',
  'Desktop + móvil': 'Escritorio + móvil',
  'Responsive mobile-first': 'Diseño adaptable, primero para móvil',
  'Analytics events': 'Eventos de analítica',
  'Pipeline de carga optimizado': 'Carga optimizada',
  'Export/share de resultados': 'Exportar y compartir resultados',
  'Deploy documentado': 'Despliegue documentado',
  'Chat widget embebido': 'Chat integrado en tu web',
  'Guardrails/disclaimers': 'Límites y avisos de seguridad',
  'Highlight/seleccion': 'Resaltado y selección',
  'QA visor + reporte perf': 'Pruebas del visor e informe de rendimiento',
  'Reporte de performance': 'Informe de rendimiento',
  'Integracion + tuning performance': 'Integración y ajuste de rendimiento',
  'Fallback movil': 'Versión alternativa para móvil',
  'Template de loading': 'Pantalla de carga',
  'Embed responsive': 'Inserción adaptable',
  'Embed responsive configurado': 'Inserción adaptable configurada',
  'Mini-GDD documentado': 'Documento de diseño del juego',
  'Hook de analitica opcional': 'Conexión opcional con analítica',
  'Gestion datos por JSON/CMS-lite': 'Datos editables (JSON o CMS ligero)',
  'Prompts versionados': 'Instrucciones de la IA versionadas',
  'Capacitacion handoff': 'Capacitación y entrega',
  'Quick-wins ejecutables': 'Mejoras rápidas ejecutables',
  'Primer quick-win (paquete Roadmap+Piloto)': 'Primera mejora rápida (paquete hoja de ruta + piloto)',
  'Passes clave a solicitud': 'Pases de render clave a solicitud',
  'Bake high->low standalone': 'Horneado de alto a bajo detalle',
  'README tecnico': 'Documentación técnica',
  'Sesion de handoff': 'Sesión de entrega',
  'Informe oportunidades priorizadas': 'Informe de oportunidades priorizadas',
  'SOW borrador con estimacion': 'Borrador de alcance con estimación',
  'Mapa del proceso + especificacion': 'Mapa del proceso y especificación',
  'Horas rollean 50%': 'El 50 % de las horas no usadas pasa al mes siguiente',
  'Disponibilidad recurrente': 'Disponibilidad cada mes',
  'Fallback estatico para moviles gama baja': 'Versión estática para móviles de gama baja',
  'Desktop web': 'Web de escritorio',
  'SLA de respuesta': 'Tiempo de respuesta garantizado',
  'Iteracion de look incluida en rondas de revision': 'Ajustes de estilo incluidos en las rondas de revisión',
};
const WORD_ES: [RegExp, string][] = ([
  ['Imagenes', 'Imágenes'], ['resolucion', 'resolución'], ['revision', 'revisión'], ['Animacion', 'Animación'], ['animacion', 'animación'],
  ['seleccion', 'selección'], ['compresion', 'compresión'], ['tecnicos', 'técnicos'], ['tecnico', 'técnico'], ['Aplicacion', 'Aplicación'],
  ['Presentacion', 'Presentación'], ['estimacion', 'estimación'], ['Configuracion', 'Configuración'], ['Integracion', 'Integración'],
  ['Modulo', 'Módulo'], ['moviles', 'móviles'], ['movil', 'móvil'], ['Pagina', 'Página'], ['seccion', 'sección'], ['tactiles', 'táctiles'],
  ['analitica', 'analítica'], ['Catalogo', 'Catálogo'], ['Gestion', 'Gestión'], ['navegacion', 'navegación'], ['Evolucion', 'Evolución'],
  ['Capacitacion', 'Capacitación'], ['Simulacion', 'Simulación'], ['graficas', 'gráficas'], ['Sesion', 'Sesión'], ['Guia', 'Guía'],
  ['Mecanicas', 'Mecánicas'], ['Mecanica', 'Mecánica'], ['mecanica', 'mecánica'], ['geometrica', 'geométrica'], ['numero', 'número'], ['camara', 'cámara'],
  ['Simulacion', 'Simulación'], ['segun', 'según'], ['maquina', 'máquina'], ['supervision', 'supervisión'],
] as [string, string][]).map(([a, b]) => [new RegExp(String.raw`\b${a}\b`, 'g'), b]);
export function esDisplay(text: string): string {
  const p = PHRASE_ES[text];
  if (p) return p;
  let out = text;
  for (const [re, b] of WORD_ES) out = out.replace(re, b);
  return out;
}
