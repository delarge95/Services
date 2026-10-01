/**
 * caseStudies.ts — Casos reales por servicio (ciclo 27, 2026-09-30).
 *
 * Fuente: proyecto TwinSight X500 (E:\WebGL_tesis). Solo afirmaciones DEFENDIBLES según
 * portafolio_personal/documentacion/04_Breakdown_Pipeline_CAD_a_WebGL.md ("Que si se puede
 * afirmar hoy"); nada de métricas before/after no medidas ni herramientas no usadas.
 * Imágenes: Informe_final/figures (capturas propias). Videos: recordings/vertical (capturas
 * del visor), recortados a 10 s en WebM. Assets en public/cotizador/cases/twinsight/.
 */
export interface CaseStep { img: string; title: string; text: string }
export interface CaseVideo { src: string; poster: string; label: string }
export interface CaseFact { value: string; label: string }
/** Ciclo 30: textos en inglés (mismo orden que steps/videos/facts). */
export interface CaseStudyEn { title: string; subtitle: string; steps?: [string, string][]; videos?: string[]; facts?: string[]; source: string }
export interface CaseStudy {
  title: string;
  subtitle: string;
  en?: CaseStudyEn;
  /** Ciclo 30: muestra una presentación interactiva (MiniDeck) en lugar de pasos. */
  deck?: boolean;
  steps?: CaseStep[];
  videos?: CaseVideo[];
  facts?: CaseFact[];
  liveUrl?: string;
  source: string;
}

const B = `${import.meta.env.BASE_URL}cotizador/cases/twinsight/`;
const v = (n: string, label: string): CaseVideo => ({ src: `${B}${n}.webm`, poster: `${B}${n}.webp`, label });
const LIVE = 'https://alexwoodcock.me/Twinsight-X500/';
const SRC = 'Proyecto TwinSight X500 (gemelo digital del dron Holybro X500 V2), capturas propias.';
const SRC_EN = 'TwinSight X500 project (digital twin of the Holybro X500 V2 drone), own captures.';

export const CASE_STUDIES: Record<string, CaseStudy> = {
  'CAD-01': {
    title: 'TwinSight X500: del CAD industrial al navegador',
    subtitle: 'Ensamblaje CAD del Holybro X500 convertido en un visor WebGL navegable, con piezas seleccionables, cortes y modos de inspección.',
    steps: [
      { img: `${B}p1-cad-importado.webp`, title: 'CAD importado', text: 'El ensamblaje llega con jerarquías inconsistentes y muchísimas subpiezas.' },
      { img: `${B}p2-topologia.webp`, title: 'Diagnóstico de topología', text: 'N-gons y granularidad excesiva: inviable tal cual para la web.' },
      { img: `${B}p3-low-poly.webp`, title: 'Versión optimizada (low)', text: 'Geometría ligera para tiempo real, conservando la silueta técnica.' },
      { img: `${B}p4-high-bake.webp`, title: 'High-poly para bake', text: 'El detalle se hornea en texturas en lugar de cargarlo como geometría.' },
      { img: `${B}p5-build-webgl.webp`, title: 'Build WebGL final', text: 'Visor en el navegador, en escritorio y móvil, sin instalar nada.' },
    ],
    videos: [v('inspeccion', 'Inspección de piezas'), v('corte', 'Corte transversal'), v('despiece', 'Despiece')],
    facts: [
      { value: '28', label: 'piezas canónicas con nombre y ficha técnica' },
      { value: '30', label: 'anclas de escena (28 piezas + tornillería + varios)' },
      { value: '257', label: 'renderers/colliders técnicos gestionados' },
      { value: '168', label: 'instancias de tornillería en 20 familias, con detalle bajo demanda' },
    ],
    liveUrl: LIVE,
    source: SRC,
    en: {
      title: 'TwinSight X500: from industrial CAD to the browser',
      subtitle: 'The Holybro X500 CAD assembly turned into a navigable WebGL viewer, with selectable parts, sections and inspection modes.',
      steps: [
        ['Imported CAD', 'The assembly arrives with inconsistent hierarchies and a huge number of sub-parts.'],
        ['Topology diagnosis', 'N-gons and excessive granularity: unusable as-is on the web.'],
        ['Optimized version (low)', 'Lightweight real-time geometry that keeps the technical silhouette.'],
        ['High-poly for baking', 'Detail is baked into textures instead of being loaded as geometry.'],
        ['Final WebGL build', 'A viewer in the browser, on desktop and mobile, nothing to install.'],
      ],
      videos: ['Part inspection', 'Cross-section', 'Exploded view'],
      facts: ['canonical parts with name and spec sheet', 'scene anchors (28 parts + fasteners + misc)', 'technical renderers/colliders managed', 'fastener instances in 20 families, detail on demand'],
      source: SRC_EN,
    },
  },
  'PIPE-01': {
    title: 'Automatización del pipeline del X500 en Blender',
    subtitle: 'Herramientas propias para limpiar, instanciar y catalogar un ensamblaje técnico sin trabajo manual repetitivo.',
    steps: [
      { img: `${B}blender-instancias.webp`, title: 'Masters e instancias', text: 'Piezas repetidas convertidas en instancias de un master: menos memoria y un solo punto de edición.' },
      { img: `${B}tornilleria-proxy.webp`, title: 'Tornillería: original → proxy', text: 'La tornillería densa del CAD se sustituye por proxies ligeros en reposo.' },
      { img: `${B}tornilleria-modular.webp`, title: 'Familias modulares', text: 'Cada tornillo pertenece a una familia; el detalle real se genera solo al seleccionarlo.' },
    ],
    facts: [
      { value: '3', label: 'add-ons/scripts propios: simetría CAD (v5 y v6 por lotes) e inventario automático' },
      { value: '20', label: 'familias de tornillería reconciliadas por datos (JSON)' },
      { value: '168', label: 'instancias con metadatos por pieza' },
    ],
    liveUrl: LIVE,
    source: SRC,
    en: {
      title: 'Automating the X500 pipeline in Blender',
      subtitle: 'In-house tools to clean, instance and catalog a technical assembly without repetitive manual work.',
      steps: [
        ['Masters and instances', 'Repeated parts turned into instances of a master: less memory and a single point of edit.'],
        ['Fasteners: original → proxy', 'The dense CAD fasteners are replaced by lightweight proxies at rest.'],
        ['Modular families', 'Each screw belongs to a family; the real detail is generated only when selected.'],
      ],
      facts: ['in-house add-ons/scripts: CAD symmetry (v5 and batch v6) and automatic inventory', 'fastener families reconciled through data (JSON)', 'instances with per-part metadata'],
      source: SRC_EN,
    },
  },
  'RTA-03': {
    title: 'Animaciones del gemelo digital X500',
    subtitle: 'Despiece animado, transiciones de cámara y cambios de presentación en tiempo real.',
    videos: [v('despiece', 'Despiece animado'), v('presets', 'Presets de estudio'), v('shaders', 'Cambio de shaders')],
    liveUrl: LIVE,
    source: SRC,
    en: {
      title: 'Animations of the X500 digital twin',
      subtitle: 'Animated exploded view, camera transitions and real-time presentation changes.',
      videos: ['Animated exploded view', 'Studio presets', 'Shader switching'],
      source: SRC_EN,
    },
  },
  'CON-01': {
    title: 'Consultoría técnica aplicada: TwinSight X500',
    subtitle: 'Investigación y decisiones técnicas para llevar un ensamblaje CAD a WebGL en varios dispositivos.',
    steps: [
      { img: `${B}matriz-dispositivos.webp`, title: 'Matriz de dispositivos', text: 'Validación de la interfaz y el rendimiento en escritorio y móvil.' },
      { img: `${B}modos-visuales.webp`, title: 'Modos de inspección', text: 'Rayos X, sólido, térmico y blueprint: cada modo responde a una necesidad de ingeniería.' },
    ],
    facts: [
      { value: 'LOD', label: 'estrategia de niveles de detalle evaluada frente a alternativas para WebGL' },
      { value: '4', label: 'modos visuales de inspección diseñados y validados' },
    ],
    liveUrl: LIVE,
    source: SRC,
    en: {
      title: 'Applied technical consulting: TwinSight X500',
      subtitle: 'Research and technical decisions to bring a CAD assembly to WebGL across devices.',
      steps: [
        ['Device matrix', 'Interface and performance validated on desktop and mobile.'],
        ['Inspection modes', 'X-ray, solid, thermal and blueprint: each mode answers an engineering need.'],
      ],
      facts: ['level-of-detail strategy evaluated against alternatives for WebGL', 'visual inspection modes designed and validated'],
      source: SRC_EN,
    },
  },
  // ciclo 30: presentación interactiva = versión simplificada de la sustentación de la tesis
  'WEB-08': {
    title: 'Sustentación de TwinSight X500, en versión interactiva',
    subtitle: 'La defensa de grado convertida en experiencia web: intro cinematográfica con el dron en vuelo, taxonomía 3D por pasos (hasta armar un tornillo pieza a pieza), simulación térmica en vivo y datos animados. Navega con las flechas, los puntos o deslizando.',
    deck: true,
    liveUrl: LIVE,
    source: 'Presentación de sustentación de TwinSight X500 (UNAD): 8 de sus diapositivas más fuertes, con sus modelos y efectos originales.',
    en: {
      title: 'TwinSight X500 thesis defense, as an interactive deck',
      subtitle: 'The degree defense turned into a web experience: a cinematic intro with the drone in flight, a step-by-step 3D taxonomy (down to assembling a screw piece by piece), a live thermal simulation and animated data. Navigate with the arrows, the dots or by swiping.',
      source: 'TwinSight X500 defense presentation (UNAD): 8 of its strongest slides, with their original models and effects.',
    },
  },
};
