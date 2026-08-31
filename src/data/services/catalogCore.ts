import type { Currency, LevelId, QuoteResult, RateClass } from './types';
import { getRateCard, LAUNCH_DISCOUNT } from './rateCard';

export interface HourRange { min: number; max: number }
export type HoursByTier = Record<LevelId, HourRange>;

export interface Subtask { id: string; nameEs: string; hours: HoursByTier; rateClass: RateClass; optional?: boolean }
export interface ServiceDef {
  id: string; catalogId: string; family: string;
  nameEs: string; unitEs: string; descripcionEs: string;
  entregablesEs: string[]; noIncluyeEs?: string[];
  driversEs: string[]; confidence: 'explicit' | 'inferred' | 'qualitative';
  subtasks: Subtask[]; entregaDiasEs?: [number, number];
}

type T = [number, number];
type RC = RateClass;
const h = (a: number, b: number) => ({ min: a, max: b });
const xs = (a: number, b: number) => ({ XS: h(a, b) });
const all = (xs2: T, s: T, m: T, l: T, xl: T): HoursByTier => ({ XS: h(xs2[0], xs2[1]), S: h(s[0], s[1]), M: h(m[0], m[1]), L: h(l[0], l[1]), XL: h(xl[0], xl[1]) });
const noXs = (s: T, m: T, l: T, xl: T): HoursByTier => ({ XS: h(0, 0), S: h(s[0], s[1]), M: h(m[0], m[1]), L: h(l[0], l[1]), XL: h(xl[0], xl[1]) });

function svc(id: string, cat: string, fam: string, name: string, unit: string, desc: string, entreg: string[], noInc: string[] | undefined, drivers: string[], conf: ServiceDef['confidence'], dias: [number, number], subs: Subtask[]): ServiceDef {
  return { id, catalogId: cat, family: fam, nameEs: name, unitEs: unit, descripcionEs: desc, entregablesEs: entreg, noIncluyeEs: noInc, driversEs: drivers, confidence: conf, subtasks: subs, entregaDiasEs: dias };
}
function st(id: string, name: string, rc: RC, hours: HoursByTier): Subtask { return { id, nameEs: name, hours, rateClass: rc }; }

export const SERVICES: ServiceDef[] = [
  svc('RND-01','C1','render','Render 3D estatico','imagen','Imagenes fotorrealistas de producto/objeto/escena para e-commerce, marketing o print.',
    ['Imagenes en alta resolucion (PNG/JPG/EXR)','Versiones en formatos acordados','2 rondas de revision'],
    undefined,['complejidad del asset','numero de vistas','materiales','resolucion'],'explicit',[1,14],
    [st('r1-brief','Brief + moodboard','RC-ART',all([0.5,1],[0.5,1],[1,2],[1,2],[2,3])),
     st('r1-setup','Setup escena (camara, luz, HDRI)','RC-ART',all([0.5,1],[1,2],[1.5,3],[2,5],[4,8])),
     st('r1-lookdev','Materiales y texturizado','RC-ART',all([0.5,1.5],[1,3],[2,6],[4,10],[8,16])),
     st('r1-render','Render + denoise','RC-ART',all([0.5,0.5],[0.5,1],[1,2],[1.5,4],[3,6])),
     st('r1-post','Post-produccion','RC-ART',all([0.25,0.5],[0.5,1],[1,2],[2,4],[4,8])),
     st('r1-qa','QA + export','RC-ART',all([0.25,0.5],[0.5,1],[0.5,1],[0.5,1],[1,2]))]),

  svc('RND-02','C1','render','Animacion 3D (render offline)','clip (XS=loop 2-3s)','Video renderizado para social, web o presentaciones.',
    ['Video master H.264/H.265','Versiones 16:9, 1:1, 9:16','2 rondas de revision'],
    undefined,['duracion','shots','animacion','simulaciones'],'explicit',[3,42],
    [st('r2-story','Storyboard/previs','RC-ART',all([0.5,1],[2,4],[3,6],[4,8],[6,12])),
     st('r2-layout','Layout escena y camaras','RC-ART',all([0.5,1],[1,2],[2,4],[3,6],[5,8])),
     st('r2-anim','Animacion (camara/objetos)','RC-ART',all([1,2],[4,8],[8,16],[12,24],[20,40])),
     st('r2-look','Iluminacion + lookdev','RC-ART',all([1,2],[2,4],[4,7],[5,10],[8,14])),
     st('r2-render','Renders/passes','RC-ART',all([1,1.5],[2,3],[3,5],[4,8],[6,12])),
     st('r2-comp','Composicion, edit, grade','RC-ART',all([1,1.5],[2,3],[3,5],[4,8],[6,12]))]),

  svc('RTA-01','C2','asset-rt','Asset 3D realtime estatico','asset optimizado','Modelo 3D optimizado para WebGL/videojuegos.',
    ['GLB/GLTF con Draco/KTX2','Texturas PBR','LODs','Reporte de performance'],
    undefined,['presupuesto poligonal','piezas','fuente'],'explicit',[1,42],
    [st('rt1-intake','Intake/QC specs','RC-RTA',noXs([0.5,1],[1,2],[2,3],[3,5])),
     st('rt1-model','Modelado hi-low','RC-RTA',noXs([2,4],[4,10],[10,25],[25,80])),
     st('rt1-uv','UV unwrap','RC-RTA',noXs([1,2],[2,4],[4,8],[8,16])),
     st('rt1-bake','Baking de mapas','RC-RTA',noXs([0.5,1],[1,3],[3,6],[6,12])),
     st('rt1-text','Texturizado PBR','RC-RTA',noXs([1,3],[3,6],[6,14],[14,30])),
     st('rt1-opt','Optimizacion LODs/Draco','RC-RTA',noXs([0.5,1],[1,3],[3,6],[6,12])),
     st('rt1-qa','QA motor target','RC-RTA',noXs([0.5,1],[1,2],[2,4],[4,8]))]),

  svc('RTA-02','C2','asset-rt','Asset RT interactuable (hotspots)','asset + interactividad','Modelo 3D con hotspots y seleccion de partes.',
    ['Todo lo de RTA-01','Hotspots con info por parte','Highlight/seleccion'],
    undefined,['hotspots','poligonal'],'explicit',[2,49],
    [st('rt2-core','Pipeline base (ver RTA-01)','RC-RTA',noXs([6,13],[14,30],[30,66],[66,163])),
     st('rt2-interaccion','Interactividad basica','RC-WEB',noXs([2,4],[4,8],[8,16],[16,32]))]),

  svc('CAD-01','C6','datos','CAD a WebGL ready (servicio insignia)','ensamblaje CAD','Conversion de ensamblajes CAD a assets web optimizados con metadata por pieza.',
    ['GLB optimizado con metadata por pieza','LODs + compresion','Texturas PBR tecnicos','QA visor + reporte perf'],
    ['Vista explosionada (cotizar RTA-06)','Animacion (cotizar RTA-03/04)'],['numero de piezas','complejidad geometrica','calidad del CAD'],'explicit',[1,70],
    [st('cad-ingesta','Ingesta CAD/QC','RC-RTA',all([0.5,1],[0.5,1],[1,3],[3,6],[6,15])),
     st('cad-retopo','Decimado/retopo por pieza','RC-RTA',all([0.75,1.5],[1,3],[3,10],[10,30],[30,100])),
     st('cad-uv','UVs + baking batch','RC-RTA',all([0.5,1.25],[1,2],[2,6],[6,15],[15,40])),
     st('cad-texturas','Texturas PBR tecnicos','RC-ART',all([0.75,1.5],[1,3],[3,8],[8,20],[20,45])),
     st('cad-metadata','Jerarquia/metadata por pieza','RC-RTA',all([0.25,0.75],[0.5,1],[1,3],[3,8],[8,20])),
     st('cad-lods','LODs + compresion','RC-RTA',all([0.25,0.75],[0.5,1],[1,3],[3,8],[8,18])),
     st('cad-qa','QA visor + reporte perf','RC-WEB',all([0.25,0.75],[0.5,1],[1,2],[2,5],[5,12]))]),

  svc('WEB-01','C3','web-3d','Visor custom three.js / Babylon.js','visor web','Visor web a medida con orbita, hotspots, UI y perf mobile.',
    ['Visor web interactivo','Pipeline de carga optimizado','Responsive mobile-first','Analytics events'],
    undefined,['hotspots/features','datos dinamicos','AR opcional'],'explicit',[2,21],
    [st('web1-spec','Spec + pipeline de carga','RC-WEB',noXs([2.5,6],[7,13],[14,28],[28,56])),
     st('web1-interaccion','Interaccion + UI overlay','RC-WEB',noXs([3.5,9],[9,18],[18,38],[38,76])),
     st('web1-perf','Perf movil + QA + entrega','RC-WEB',noXs([1.5,5],[4,9],[10,22],[22,49]))]),

  svc('WEB-04','C3','web-3d','Web App 3D (configurador/herramienta)','aplicacion web','Aplicacion web con estado real: configuradores, herramientas tecnicas.',
    ['Aplicacion web completa','Escena 3D configurable','Export/share de resultados','Deploy documentado'],
    ['Assets 3D (cotizar RTA/CAD)'],['variantes/reglas','fuente de datos','autenticacion'],'inferred',[7,112],
    [st('web4-discovery','Discovery/spec funcional','RC-WEB',noXs([5,11],[11,26],[27,57],[57,112])),
     st('web4-core','Arquitectura + escena configurable','RC-WEB',noXs([11,23],[23,58],[58,124],[124,244])),
     st('web4-qa','QA/E2E + perf + deploy','RC-WEB',noXs([5,11],[11,30],[29,64],[64,124]))]),

  svc('AI-01','C4','ia','Asistente IA en sitio web (chat RAG)','asistente instalado','Chat IA entrenado con contenido del cliente via RAG.',
    ['Chat widget embebido','RAG sobre contenido propio','Guardrails/disclaimers','Casos de prueba documentados'],
    ['Costos de API (BYOK)'],['volumen de contenido','idiomas','acciones permitidas'],'explicit',[3,70],
    [st('e1-discovery','Discovery/casos de uso','RC-AI',noXs([3,5],[5,8],[8,14],[8,14])),
     st('e1-rag','Pipeline ingesta/RAG','RC-AI',noXs([8,16],[16,30],[30,60],[30,60])),
     st('e1-prompts','Prompt engineering + guardrails','RC-AI',noXs([4,8],[8,14],[14,26],[14,26])),
     st('e1-widget','Widget UI + integracion','RC-WEB',noXs([6,12],[12,24],[24,44],[24,44])),
     st('e1-eval','Evaluacion + casos de prueba','RC-AI',noXs([4,7],[7,12],[12,22],[12,22]))]),

  svc('CON-01','C7','soporte','Consultoria tecnica 3D / web','sesion o informe','Discovery, auditorias tecnicas, roadmaps.',
    ['Informe de discovery','SOW borrador con estimacion','Presentacion al equipo'],
    undefined,['stakeholders','material de entrada'],'qualitative',[2,10],
    [st('con-trabajo','Intake/analisis/SOW','RC-CON',all([2,4.5],[2.5,6],[6,12],[12,24],[12,24])),
     st('con-presentacion','Presentacion y revision','RC-CON',all([0.5,1.5],[1,2],[2,4],[4,8],[4,8]))]),

  svc('RET-01','C7','soporte','Retainer mensual','bloque horas/mes','Disponibilidad recurrente con SLA por tier.',
    ['Disponibilidad recurrente','SLA de respuesta','Horas rollean 50%'],
    undefined,['horas/mes','tipo de trabajo'],'explicit',[0,0],
    [st('ret-lite','Lite: 4h/mes','RC-RTA',all([4,4],[4,4],[4,4],[4,4],[4,4])),
     st('ret-std','Standard: 8h/mes','RC-RTA',all([8,8],[8,8],[8,8],[8,8],[8,8])),
     st('ret-pro','Pro: 16h/mes','RC-RTA',all([16,16],[16,16],[16,16],[16,16],[16,16])),
     st('ret-biz','Business: 40h/mes','RC-CON',all([40,40],[40,40],[40,40],[40,40],[40,40]))]),
  // ── C2: RTA-03..06 ──
  svc('RTA-03','C2','asset-rt','Modelo animado no interactuable','asset animado (GLB)','Asset realtime con animacion autoplay (loop funcionamiento/ensamblaje/demo). Incluye asset base.',
    ['Todo lo de RTA-01','Clips de animacion embebidos','Configuracion de autoplay'],
    ['Rig organico/personaje (discovery obligatorio)'],['piezas','clips de animacion'],'explicit',[3,60],
    [st('rt3-core','Pipeline base RTA-01','RC-RTA',noXs([6,13],[14,30],[30,66],[45,99])),
     st('rt3-setupanim','Setup animacion mecanica (pivots/jerarquia)','RC-RTA',noXs([1,3],[2,5],[3,7],[4,9])),
     st('rt3-clips','Clips de animacion (loop -> secuencias)','RC-RTA',noXs([1,5],[2,7],[5,13],[6,16])),
     st('rt3-timeline','Timeline autoplay + optimizacion clips','RC-RTA',noXs([1,2],[1,2],[1,2],[1,2]))]),
  svc('RTA-04','C2','asset-rt','Modelo animado interactuable','asset animado + control','Animacion bajo control del usuario: play/pausa, seleccion de clips, triggers por pieza. Incluye asset base.',
    ['Todo lo de RTA-03','Modulo de control (UI + estado) integrado'],
    undefined,['piezas','triggers de interaccion'],'explicit',[5,80],
    [st('rt4-core','Pipeline base RTA-03','RC-RTA',noXs([8,23],[17,44],[39,88],[55,123])),
     st('rt4-ui','UI de controles (play/pausa/velocidad)','RC-WEB',noXs([2,4],[2,5],[3,6],[4,8])),
     st('rt4-triggers','Estado + triggers por interaccion','RC-WEB',noXs([3,6],[4,10],[6,20],[8,25])),
     st('rt4-qa','QA de estados y combinaciones','RC-WEB',noXs([1,2],[2,4],[3,8],[4,10]))]),
  svc('RTA-05','C2','asset-rt','Shaders estilizados','shader / set','Materiales custom (toon, holograma, disolucion, fresnel) sobre assets existentes, con fallback movil.',
    ['Shader(s) sobre asset existente','Fallback movil','Integracion + tuning performance'],
    undefined,['n shaders','complejidad efecto'],'explicit',[1,30],
    [st('rt5-shaderS','Shader basico (fresnel/emissive/gradiente)','RC-RTA',noXs([2,4],[0,0],[0,0],[0,0])),
     st('rt5-shaderM','Shader medio (disolucion/holograma/toon rampas)','RC-RTA',noXs([0,0],[4,8],[0,0],[0,0])),
     st('rt5-pipeline','Pipeline estilizado (outline pass + lighting custom)','RC-RTA',noXs([0,0],[0,0],[8,16],[10,20])),
     st('rt5-integr','Integracion + tuning por batch','RC-WEB',noXs([2,6],[2,6],[2,6],[2,6]))]),
  svc('RTA-06','C2','asset-rt','Mecanicas sobre asset realtime','mecanica','Interactividad avanzada sobre asset ya realtime-ready: explosionado, cutaway, configurador, mediciones.',
    ['Mecanica implementada sobre el asset','Etiquetas/slider/caps segun mecanica'],
    ['El asset base (premisa: RTA-01 hecho; si no, se suma su tier primero)'],['tipo mecanica','piezas/opciones'],'explicit',[2,40],
    [st('rt6-mecanicaS','Mecanica S (explosion <=10 pzs / config <=5 opciones / cutaway simple)','RC-WEB',noXs([3,9],[0,0],[0,0],[0,0])),
     st('rt6-mecanicaM','Mecanica M (11-40 pzs etiquetas / config 6-15 opciones)','RC-WEB',noXs([0,0],[7,20],[0,0],[0,0])),
     st('rt6-mecanicaL','Mecanica L (multi-nivel / multi-eje + share URL)','RC-WEB',noXs([0,0],[0,0],[18,40],[22,50])),
     st('rt6-medicion','Mediciones/cotas en escena (opcional)','RC-WEB',noXs([1,3],[2,5],[3,7],[4,8]) )]),

  // ── C3: WEB-02,03,05,06,07,08 ──
  svc('WEB-02','C3','web-3d','Visor embebido (Spline/Sketchfab/model-viewer)','embed','Visualizacion via plataforma existente: mas barato y rapido, menos control que visor custom.',
    ['Asset adaptado al formato de la plataforma','Embed responsive configurado'],
    ['Suscripciones/licencias de la plataforma (cliente)','Mecanicas custom (subir a WEB-01)'],['personalizacion embed'],'explicit',[1,15],
    [st('w2-basic','Adaptar asset + embed responsive','RC-WEB',noXs([2,5],[0,0],[0,0],[0,0])),
     st('w2-skin','Skin/loading custom + API + analytics','RC-WEB',noXs([0,0],[5,12],[0,0],[0,0])),
     st('w2-multi','Multi-escena + contenido via JSON editable','RC-WEB',noXs([0,0],[0,0],[12,24],[14,29]))]),
  svc('WEB-03','C3','web-3d','Unity WebGL: build y embedding','build','Proyecto Unity corriendo en web con buen loading y presupuesto de memoria movil.',
    ['Build WebGL comprimida (Brotli/gzip)','Template de loading','Embed responsive','Guia de despliegue'],
    undefined,['puente JS-Unity','multi-escena/streaming'],'explicit',[3,70],
    [st('w3-build','Build + compresion + template loading','RC-WEB',noXs([4,6],[4,7],[6,10],[7,12])),
     st('w3-embed','Embed responsive + integracion al sitio','RC-WEB',noXs([2,4],[3,6],[4,8],[5,9])),
     st('w3-bridge','Puente JS <-> Unity bidireccional','RC-WEB',all([0,0],[0,0],[4,8],[8,14],[10,17])),
     st('w3-memory','Presupuesto memoria/perf movil','RC-WEB',noXs([2,4],[3,5],[4,7],[5,8])),
     st('w3-qa','QA navegadores (iOS Safari incluido)','RC-WEB',noXs([2,4],[3,6],[4,8],[5,9]))]),
  svc('WEB-05','C3','web-3d','Scrollytelling con 3D','pagina/experiencia','Narrativa controlada por scroll donde la escena 3D evoluciona (camara, estado, secciones DOM).',
    ['Pagina/seccion implementada','Timeline de scroll calibrada','Fallback estatico para moviles gama baja'],
    ['Assets 3D desde cero en tier L (se cotizan aparte MOD-A/RTA-xx)'],['n secciones','procedencia assets'],'explicit',[4,120],
    [st('w5-story','Storyboard tecnico + wireframe scroll','RC-WEB',noXs([2,3],[3,5],[4,8],[5,9])),
     st('w5-timeline','Timeline scroll-driven (camara/estado)','RC-WEB',noXs([5,8],[8,15],[15,30],[18,36])),
     st('w5-dom','Sincronizacion copy/secciones DOM','RC-WEB',noXs([2,4],[3,5],[4,8],[5,9])),
     st('w5-perf','Perf movil + fallbacks estaticos','RC-WEB',noXs([1,3],[3,6],[5,10],[6,12])),
     st('w5-qa','QA dispositivos','RC-WEB',noXs([1,2],[2,4],[3,6],[4,7]))]),
  svc('WEB-06','C3','web-3d','Minijuego web','juego','Juego jugable en navegador (three.js o Unity WebGL), score, estados, controles tactiles.',
    ['Mini-GDD documentado','Controles tactiles','Pantalla inicial/fin','Hook de analitica opcional'],
    ['Audio (archivos del cliente)','Base WEB-03 S si motor es Unity WebGL (se suma)'],['n niveles','progresion/sistemas'],'explicit',[15,180],
    [st('w6-gdd','Mini-GDD + prototipo mecanica','RC-WEB',noXs([5,10],[8,16],[12,24],[14,28])),
     st('w6-dev','Implementacion gameplay + niveles','RC-WEB',noXs([15,35],[35,70],[70,130],[85,156])),
     st('w6-polish','Game-feel, estados, pantalla inicio/fin','RC-WEB',noXs([4,8],[8,16],[14,26],[17,31])),
     st('w6-qa','QA dispositivos + controles tactiles','RC-WEB',noXs([1,2],[4,8],[6,12],[7,14]))]),
  svc('WEB-07','C3','web-3d','Catalogo interactivo 3D','catalogo/proyecto','Catalogo de productos navegable con visor 3D compartido, filtros y fichas JSON/CMS-lite.',
    ['Catalogo navegable','Visor 3D compartido','Filtros y fichas','Gestion datos por JSON/CMS-lite'],
    ['Assets 3D de cada producto (se cotizan aparte C2, descuento bundle)'],['n productos','variantes/filtros'],'explicit',[10,160],
    [st('w7-visorsp','Visor 3D compartido + pipeline carga','RC-WEB',noXs([8,18],[14,32],[24,50],[28,58])),
     st('w7-fichas','Fichas + plantillas producto','RC-WEB',noXs([6,14],[12,26],[24,48],[29,56])),
     st('w7-filtros','Filtros/busqueda/variantes SKU','RC-WEB',noXs([3,8],[10,20],[24,44],[29,51])),
     st('w7-datos','Gestion datos JSON/CMS-lite','RC-WEB',noXs([1,2],[4,7],[13,18],[16,21]))]),
  svc('WEB-08','C3','web-3d','Presentacion web interactiva','presentacion','Presentacion navegable (alternativa viva a PPT/PDF) con 3D embebido y navegacion no lineal.',
    ['Presentacion navegable con 3D embebido','Media y navegacion no lineal'],
    undefined,['n slides','datos vivos/filtros'],'explicit',[3,60],
    [st('w8-slides','Slides + plantilla visual','RC-WEB',noXs([6,12],[10,20],[16,30],[19,35])),
     st('w8-nav','Navegacion (lineal/no lineal) + media','RC-WEB',noXs([1,4],[5,9],[10,18],[12,21])),
     st('w8-datos','Datos vivos/filtros tiempo real (L+)','RC-WEB',all([0,0],[0,0],[0,0],[9,12],[11,14]))]),

  // ── C4: AI-02..04 ──
  svc('AI-02','C4','ia','IA indirecta en producto web','feature/paquete','Funciones potenciadas por IA sin chat visible: busqueda semantica, recomendaciones, generacion bajo plantilla.',
    ['Features IA integradas en producto web','Panel de control ligero (tier L)'],
    undefined,['n features','integracion entre si'],'explicit',[5,140],
    [st('a2-feature1','Feature IA base (busqueda semantica/recomendador)','RC-AI',noXs([10,24],[10,24],[10,24],[10,24])),
     st('a2-featureN','Features adicionales integradas','RC-AI',all([0,0],[0,0],[12,30],[24,60],[30,72])),
     st('a2-panel','Panel de control ligero','RC-AI',all([0,0],[0,0],[0,0],[8,16],[10,19]))]),
  svc('AI-03','C4','ia','Automatizacion interna con LLM','paquete workflow','Workflow asistido por LLM para proceso manual repetitivo, con revision humana cuando el riesgo lo pide.',
    ['Mapa del proceso + especificacion','Workflow implementado','Prompts versionados','Pruebas con datos reales','Capacitacion handoff'],
    ['Evolucion mensual del workflow (retainer C7)'],['n workflows','human-in-the-loop'],'explicit',[10,170],
    [st('a3-discovery','Discovery fijo del proceso','RC-CON',noXs([4,8],[4,8],[8,16],[9,18])),
     st('a3-impl','Implementacion workflow(s)','RC-AI',noXs([20,45],[45,85],[85,150],[100,170])),
     st('a3-pruebas','Pruebas con datos reales + capacitacion','RC-AI',noXs([3,6],[5,10],[8,14],[9,16]))]),
  svc('AI-04','C4','ia','Consultoria y auditoria de IA','auditoria/paquete','Diagnostico de donde la IA aporta valor real, con plan priorizado por impacto/esfuerzo y riesgos.',
    ['Informe oportunidades priorizadas','Quick-wins ejecutables','Matriz de riesgos y costos','Primer quick-win (paquete Roadmap+Piloto)'],
    undefined,['alcance diagnostico'],'qualitative',[5,40],
    [st('a4-express','Auditoria express (1 proceso/departamento)','RC-CON',all([8,16],[0,0],[0,0],[0,0],[0,0])),
     st('a4-media','Auditoria empresa/agencia pequena completa','RC-CON',all([0,0],[16,32],[0,0],[0,0],[0,0])),
     st('a4-roadmap','Roadmap + piloto implementado','RC-CON',all([0,0],[0,0],[24,48],[29,57],[34,68]))]),

  // ── C5: VFX-01..03 ──
  svc('VFX-01','C5','vfx','Modelo 3D integrado en foto/video real','shot','Incorporar modelo 3D sobre grabacion real: tracking, match de iluminacion y composicion final.',
    ['Video/foto final por shot','Passes clave a solicitud'],
    ['Footage base (lo provee el cliente con derechos confirmados)','Modelo 3D si no existe (sumar C1/C6)'],['movimiento camara','n elementos'],'explicit',[2,53],
    [st('v1-analisis','Analisis de escena (perspectiva/luz/optica)','RC-ART',noXs([1,2],[1.5,3],[2,4],[2.5,5])),
     st('v1-tracking','Tracking de camara/matchmove','RC-ART',noXs([1,3],[3,6],[7,14],[8,16])),
     st('v1-proxy','Geometria proxy/planos segun escena','RC-ART',noXs([1,2.5],[2,5],[4,9],[5,10])),
     st('v1-light','Match iluminacion + sombras/reflejos','RC-ART',noXs([1.5,3.5],[3,6],[5,11],[6,13])),
     st('v1-render','Render elemento 3D + passes','RC-ART',noXs([0.5,1.5],[1.5,4],[3,8],[4,9])),
     st('v1-comp','Compositing (grain/color match/motion blur)','RC-ART',noXs([1,3],[2,4],[3,7],[4,8]))]),
  svc('VFX-02','C5','vfx','FX puro (simulaciones video)','shot','Efectos simulados para pieza audiovisual: particulas, humo, liquidos, destruccion, tela.',
    ['Simulacion FX por shot','Iteracion de look incluida en rondas de revision'],
    ['Horas de maquina (supervision tecnica gestionada)'],['complejidad efecto'],'explicit',[1,90],
    [st('v2-basica','FX basico (chispas/polvo/humo ligero)','RC-ART',all([6,14],[0,0],[0,0],[0,0],[0,0])),
     st('v2-media','FX medio (humo denso/liquido simple/telas)','RC-ART',all([0,0],[14,35],[0,0],[0,0],[0,0])),
     st('v2-pesada','FX pesado (fluido hero/destruccion estructural)','RC-ART',all([0,0],[0,0],[35,80],[42,96],[50,112]))]),
  svc('VFX-03','C5','vfx','Motion graphics 3D','pieza/paquete','Piezas graficas animadas con componente 3D: logo reveals, lower thirds, transiciones, plantillas.',
    ['Piezas graficas animadas 3D','Plantilla reutilizable (branding completo)'],
    undefined,['n piezas','plantilla reusable'],'explicit',[2,40],
    [st('v3-reveal','Logo reveal (<=5s, 1 estilo)','RC-ART',noXs([4,8],[0,0],[0,0],[0,0])),
     st('v3-set','Set editorial (lowers/transitions/bumpers)','RC-ART',noXs([0,0],[8,16],[0,0],[0,0])),
     st('v3-branding','Branding animado completo + plantilla','RC-ART',noXs([0,0],[0,0],[18,40],[22,48]))]),

  // ── C6: TEX-01, PIPE-01 ──
  svc('TEX-01','C6','texturas','Generacion de texturas y mapas','set/asset','Sets de mapas PBR (albedo/normal/roughness/metal/AO), tileables, procedurales o texturizado de assets.',
    ['Sets de mapas PBR completos','Texturizado de asset','Bake high->low standalone'],
    undefined,['n materiales','tileable/procedural'],'explicit',[1,45],
    [st('tx-setS','Set tileable S (material limpio simple)','RC-RTA',noXs([2,5],[0,0],[0,0],[0,0])),
     st('tx-setM','Set tileable M (variaciones/desgaste moderado)','RC-RTA',noXs([0,0],[5,10],[0,0],[0,0])),
     st('tx-procL','Set procedural parametrico (exposables en motor)','RC-RTA',noXs([0,0],[0,0],[10,20],[12,24])),
     st('tx-textur','Texturizado asset completo (segun n materiales)','RC-RTA',noXs([3,8],[8,20],[20,45],[24,54])),
     st('tx-bake','Baking standalone high->low','RC-RTA',noXs([1,4],[1,4],[1,4],[1,4]))]),
  svc('PIPE-01','C6','pipeline','Automatizacion de pipeline/scripts/tools','herramienta','Herramientas que eliminan trabajo repetitivo: scripts Blender (Python), editor tools Unity (C#), conversion batch, QA automatico.',
    ['Herramienta (script/tool/pipeline)','README tecnico','Manejo de errores explicito','Sesion de handoff'],
    ['Mantenimiento evolutivo (retainer C7)'],['alcance herramienta'],'explicit',[1,80],
    [st('pp-script','Script utilitario CLI (batch export/rename/conversion)','RC-WEB',noXs([4,12],[0,0],[0,0],[0,0])),
     st('pp-tool','Tool con UI (panel/presets/validaciones)','RC-WEB',noXs([0,0],[12,30],[0,0],[0,0])),
     st('pp-pipeline','Pipeline completo end-to-end documentado + QA auto','RC-AI',noXs([0,0],[0,0],[30,80],[36,96]))]),];

export function getServiceById(id: string): ServiceDef | undefined {
  return SERVICES.find((s) => s.id === id);
}