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
export interface CaseStudy {
  title: string;
  subtitle: string;
  steps?: CaseStep[];
  videos?: CaseVideo[];
  facts?: CaseFact[];
  liveUrl?: string;
  source: string;
}

const B = `${import.meta.env.BASE_URL}cotizador/cases/twinsight/`;
const v = (n: string, label: string): CaseVideo => ({ src: `${B}${n}.webm`, poster: `${B}${n}.webp`, label });
const LIVE = 'http://alexwoodcock.me/Twinsight-X500/';
const SRC = 'Proyecto TwinSight X500 (gemelo digital del dron Holybro X500 V2), capturas propias.';

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
  },
  'RTA-03': {
    title: 'Animaciones del gemelo digital X500',
    subtitle: 'Despiece animado, transiciones de cámara y cambios de presentación en tiempo real.',
    videos: [v('despiece', 'Despiece animado'), v('presets', 'Presets de estudio'), v('shaders', 'Cambio de shaders')],
    liveUrl: LIVE,
    source: SRC,
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
  },
};
