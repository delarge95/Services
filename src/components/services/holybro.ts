/**
 * holybro.ts — Carga y utilidades del modelo real HolyBro X500 (GLB del cliente).
 * Se usa en los previews de acabados (finish) y piezas progresivas (assembly).
 *
 * Ciclo 5 — fix canvas en blanco (acabados/piezas):
 * La promesa cachea el parse NORMALIZADO en modo "solo lectura" (shared root).
 * Cada instancia de ModelPreview recibe root.clone(true) vía loadHolybroInstance():
 * así la visibilidad (revealSteps/revealPieces) y los materiales de un canvas
 * no envenenan al otro, y el add() de un preview no roba el root al otro.
 * Las geometrías/texturas son COMPARTIDAS entre clones (una sola subida a GPU);
 * las meshes se marcan userData.glbShared para que el cleanup NO las dispose.
 *
 * Ciclo 5 — acabados:
 * - simple: clay con flatShading (facetas legibles para leer los bordes).
 * - variado: presets construidos muestreando el color promedio de las texturas
 *   originales (canvas offscreen), agrupando materiales similares; el tipo
 *   metal/rough se infiere del color. Fallback a presets fijos si el muestreo
 *   no está listo o falla (CORS/textura no imagen).
 * - detallado: materiales originales.
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export const HOLYBRO_URL = `${import.meta.env.BASE_URL}cotizador/models/holybro-x500.glb`;

export type FinishKind = 'simple' | 'variado' | 'detallado';

let cache: Promise<THREE.Group> | null = null;

/** Carga (una vez) el X500 normalizado: centrado, escala ~2.6 unidades. */
export function loadHolybro(): Promise<THREE.Group> {
  if (!cache) {
    cache = new Promise((resolve, reject) => {
      fetch(HOLYBRO_URL)
        .then(r => {
          if (!r.ok) throw new Error(`GLB ${r.status}`);
          return r.arrayBuffer();
        })
        .then(buf => {
          new GLTFLoader().parse(buf, '', gltf => {
            const root = gltf.scene;
            // Normaliza: PRIMERO escala, luego recentra (si no, queda fuera de cámara)
            const box = new THREE.Box3().setFromObject(root);
            const size = box.getSize(new THREE.Vector3());
            const s = 2.6 / Math.max(size.x, size.y, size.z);
            root.scale.setScalar(s);
            root.updateMatrixWorld(true);
            const box2 = new THREE.Box3().setFromObject(root);
            const c2 = box2.getCenter(new THREE.Vector3());
            root.position.sub(c2);
            root.traverse(o => {
              const m = o as THREE.Mesh;
              if (m.isMesh) {
                m.frustumCulled = false;
                // marca meshes compartidas entre clones: el cleanup no debe dispose
                m.userData.glbShared = true;
              }
            });
            tagAssemblySteps(root);
            resolve(root);
          }, err => reject(err));
        })
        .catch(reject);
    });
  }
  return cache;
}

/**
 * Copia INDEPENDIENTE por instancia de preview: misma geometría/texturas (una
 * sola subida a GPU) pero árbol de objetos propio, de modo que la visibilidad
 * y los materiales que aplica un canvas no afectan a los demás.
 */
export function loadHolybroInstance(): Promise<THREE.Group> {
  return loadHolybro().then(root => root.clone(true));
}

// Ciclo 6: el clay anterior (0xd8cfc4) salía quemado/blanco con el iluminado
// de finish. Gris medio más oscuro (#847e77) para leer bordes y curvas.
const clayMat = () => new THREE.MeshStandardMaterial({ color: 0x615f66, roughness: 0.92, metalness: 0.0, flatShading: true });
const presetMats = () => [
  new THREE.MeshStandardMaterial({ color: 0x2b2b2f, roughness: 0.55, metalness: 0.25 }), // plástico negro
  new THREE.MeshStandardMaterial({ color: 0x8f9297, roughness: 0.35, metalness: 0.85 }), // aluminio
  new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.5, metalness: 0.1 }),  // fibra
  new THREE.MeshStandardMaterial({ color: 0x0071e3, roughness: 0.4, metalness: 0.2 }),  // acento
];

// ─── Muestreo de texturas para el acabado 'variado' ───

/** Resultado del muestreo: material de preset por material original + fallback. */
export interface VariadoSet {
  byMat: Map<THREE.Material, THREE.MeshStandardMaterial>;
  fallback: THREE.MeshStandardMaterial[];
}
let variadoCache: Promise<VariadoSet | null> | null = null;

/** Color promedio de una textura dibujada en un canvas offscreen 24×24. */
function avgTextureColor(tex: THREE.Texture | null | undefined): THREE.Color | null {
  try {
    const img = tex?.image as { width?: number; height?: number; naturalWidth?: number } | null | undefined;
    if (!img || (!img.width && !img.naturalWidth)) return null;
    const W = 24, H = 24;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(img as CanvasImageSource, 0, 0, W, H);
    const d = ctx.getImageData(0, 0, W, H).data;
    let r = 0, g = 0, b = 0, n = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 16) continue;
      r += d[i]; g += d[i + 1]; b += d[i + 2]; n++;
    }
    if (!n) return null;
    return new THREE.Color(r / n / 255, g / n / 255, b / n / 255);
  } catch { return null; }
}

/** Infiere un tipo de material plausible a partir del color promedio. */
function guessMetal(c: THREE.Color): { metalness: number; roughness: number } {
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  if (hsl.l < 0.12) return { metalness: 0.15, roughness: 0.5 };                 // plástico oscuro
  if (hsl.s < 0.15 && hsl.l >= 0.3 && hsl.l < 0.72) return { metalness: 0.85, roughness: 0.35 }; // gris → metal
  if (hsl.h >= 0.55 && hsl.h <= 0.7 && hsl.s > 0.35) return { metalness: 0.2, roughness: 0.35 }; // azul → acento
  return { metalness: 0.08, roughness: 0.55 };                                  // pintura / plástico
}

/**
 * Muestrea los colores promedio de las texturas originales y construye los
 * presets 'variado' a partir de ellos (agrupa materiales similares). Cachea
 * el resultado a nivel de módulo. Devuelve null si no hay nada que muestrear.
 */
export function ensureVariadoSet(root: THREE.Group): Promise<VariadoSet | null> {
  if (!variadoCache) {
    variadoCache = (async () => {
      try {
        const byColor = new Map<THREE.Material, THREE.Color>();
        const seen = new Set<THREE.Material>();
        root.traverse(o => {
          const m = o as THREE.Mesh;
          if (!m.isMesh) return;
          const mat = m.material as THREE.MeshStandardMaterial;
          if (!mat || seen.has(mat)) return;
          seen.add(mat);
          const c = avgTextureColor(mat.map) ?? (mat.color ? mat.color.clone() : null);
          if (c) byColor.set(mat, c);
        });
        if (!byColor.size) return null;
        // Cluster simple por distancia de color (agrupa materiales similares)
        const clusters: Array<{ c: THREE.Color; mats: THREE.Material[] }> = [];
        for (const [mat, c] of byColor) {
          const hit = clusters.find(cl =>
            Math.abs(cl.c.r - c.r) + Math.abs(cl.c.g - c.g) + Math.abs(cl.c.b - c.b) < 0.18);
          if (hit) hit.mats.push(mat);
          else clusters.push({ c: c.clone(), mats: [mat] });
        }
        const byMat = new Map<THREE.Material, THREE.MeshStandardMaterial>();
        for (const cl of clusters) {
          const { metalness, roughness } = guessMetal(cl.c);
          const preset = new THREE.MeshStandardMaterial({ color: cl.c, metalness, roughness });
          for (const mat of cl.mats) byMat.set(mat, preset);
        }
        return { byMat, fallback: presetMats() };
      } catch { return null; }
    })();
  }
  return variadoCache;
}

/**
 * Aplica un nivel de acabado al modelo.
 * - simple: clay uniforme con flatShading (bordes legibles)
 * - variado: presets muestreados de las texturas originales (si el set está
 *   disponible; si no, presets fijos por hash del nombre)
 * - detallado: materiales originales del GLB (con texturas baked)
 */
export function applyFinish(root: THREE.Group, kind: FinishKind, variado?: VariadoSet | null) {
  root.traverse(o => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    if (kind === 'detallado') {
      if (m.userData.origMat) m.material = m.userData.origMat;
    } else if (kind === 'simple') {
      if (!m.userData.origMat) m.userData.origMat = m.material;
      if (!m.userData.clayMat) m.userData.clayMat = clayMat();
      m.material = m.userData.clayMat;
    } else {
      if (!m.userData.origMat) m.userData.origMat = m.material;
      const preset = variado?.byMat.get(m.userData.origMat as THREE.Material);
      if (preset) {
        m.material = preset;
        return;
      }
      if (!m.userData.preset) m.userData.preset = (variado?.fallback ?? presetMats()).slice();
      const presets = m.userData.preset as THREE.MeshStandardMaterial[];
      m.material = presets[Math.abs(hash(m.name ?? '')) % presets.length];
    }
  });
}

const hash = (s: string) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7);

/**
 * Grupos de montaje en orden (grandes → pequeñas, según Alexander).
 * Expresiones sobre los nombres de nodo del GLB del X500.
 */
export const HOLYBRO_STEPS: Array<{ match: RegExp; es: string; en: string }> = [
  { match: /DJ-2216-KV880|HMX5V-DIGAI-DIANJIZUO-MUJU/i, es: 'Motor', en: 'Motor' },
  { match: /propeller/i, es: 'Hélice', en: 'Propeller' },
  { match: /CARBON-FIBER-TUBE300/i, es: 'Tubo del brazo', en: 'Arm tube' },
  { match: /TOP-PLATE|CARBON-FIBER-TUBE|DJ-2216-KV880|HMX5V|propeller_instance/i, es: 'Frame superior (instancias ×4)', en: 'Top frame (×4 instances)' },
  { match: /BOTTOM-PLATE|JIA-GUAN|GUAN-CHENG|JIA-LIANJIE/i, es: 'Frame inferior', en: 'Bottom frame' },
  { match: /PYLONS-X500|MAO-JIAO|JIAO-EVA|HUAN-GUIJIAO|JIAO-LIANJIE/i, es: 'Tren de aterrizaje', en: 'Landing gear' },
  { match: /PIXHAWK|IMU|PCB|GPS|TELEMETRY|XT60|BM06B|TOU-|DIKE-|MIANKE|GAI-GUANGLIU|ZHIJIA-CAMERA|GAN-GPSV5|GPSV5-ZHIJIA|GPS-ZHIJIA|x500v2_gps|x500v2_telemetry/i, es: 'Electrónica', en: 'Electronics' },
  { match: /battery|BATTERY/i, es: 'Batería', en: 'Battery' },
  { match: /PLATFORM-PLAT|X500-TAO/i, es: 'Plataforma superior', en: 'Top platform' },
  { match: /./i, es: 'Tornillería (instancias)', en: 'Hardware (instances)' },
];

/**
 * Marca cada nodo del GLB con su paso de montaje (userData.step) según HOLYBRO_STEPS.
 * Se llama una vez tras la carga (el clone por instancia hereda userData.step).
 */
export function tagAssemblySteps(root: THREE.Group) {
  root.traverse(o => {
    const name = (o as THREE.Mesh).isMesh ? meshEffectiveName(o as THREE.Mesh) : (o.name ?? '');
    for (let i = 0; i < HOLYBRO_STEPS.length; i++) {
      if (HOLYBRO_STEPS[i].match.test(name)) { o.userData.step = i; break; }
    }
  });
}

/** Visibilidad progresiva por pasos: muestra los pasos 0..n y anima la aparición del último. */
export function revealSteps(root: THREE.Group, n: number) {
  root.traverse(o => {
    if (o.userData.step === undefined) return;
    const visible = (o.userData.step as number) <= n;
    o.visible = visible;
  });
}

// ─── Revelado POR PIEZAS (ciclo 5, feedback Alexander) ───
// "el modelo viene con las piezas separadas, solo debes filtrar cuales mostrar".

/** Normaliza el nombre de nodo para agrupar instancias de la misma pieza. */
export const piezaKey = (name: string) => {
  const k = name.replace(/[.\-_]?\d+([.\-_]low)?([.\-_]PRIM)?$/i, '').trim();
  return k || name;
};

/**
 * Nombre EFECTIVO de una mesh (ciclo 9): las meshes hijas de nodos
 * multi-primitiva heredan el nombre del MESH del GLB, que puede ser genérico —
 * en el X500 las 4 hélices son grupos 'x500v2_propeller*' cuyas sub-mallas se
 * llaman 'mesh.002'/'mesh.002_1' (sin rastro de "propeller"). El nombre de la
 * pieza está en el nodo PADRE: se usa como fallback cuando el propio es genérico.
 */
export const meshEffectiveName = (m: THREE.Mesh): string => {
  const n = m.name ?? '';
  return /^mesh([.\d_]+)?$/i.test(n) && m.parent?.name ? m.parent.name : n;
};

export interface PieceGroup {
  /** Todas las instancias de esta pieza (cuentan UNA vez para el slider). */
  meshes: THREE.Mesh[];
  /** Índice del paso de montaje (HOLYBRO_STEPS) de la pieza. */
  step: number;
}

/**
 * Agrupa las meshes del GLB en piezas únicas (por nombre de nodo normalizado)
 * ordenadas por paso de montaje (grandes → pequeñas). Las instancias de una
 * misma pieza cuentan una vez y se revelan juntas.
 */
export function buildPieceOrder(root: THREE.Group): PieceGroup[] {
  const map = new Map<string, PieceGroup>();
  root.traverse(o => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const key = piezaKey(m.name ?? '');
    let g = map.get(key);
    if (!g) {
      g = { meshes: [], step: (m.userData.step as number) ?? HOLYBRO_STEPS.length - 1 };
      map.set(key, g);
    }
    // step del grupo = MÍNIMO de sus miembros (un motor .002 es tan motor como el _001)
    g.step = Math.min(g.step, (m.userData.step as number) ?? HOLYBRO_STEPS.length - 1);
    g.meshes.push(m);
  });
  return [...map.values()].sort((a, b) => a.step - b.step);
}

/** Revelado granular: visibles las primeras k piezas únicas (el resto oculto). */
export function revealPieces(order: PieceGroup[], k: number) {
  order.forEach((g, i) => {
    const vis = i < k;
    for (const m of g.meshes) m.visible = vis;
  });
}

// ─── Familias del drone (ciclo 6, variantes) ───
// Clasifica una pieza por su paso de montaje para los filtros/colores/aislamiento
// del configurador web-app. El "frame" agrupa tubos + frames + tren de aterrizaje.

export type DroneFamily = 'motors' | 'propellers' | 'frame' | 'electronics' | 'battery' | 'platform' | 'hardware';

/** Familia del drone a partir del paso de montaje (HOLYBRO_STEPS). */
export function droneStepFamily(step: number | undefined): DroneFamily {
  if (step === 0) return 'motors';
  if (step === 1) return 'propellers';
  if (step !== undefined && step >= 2 && step <= 5) return 'frame';
  if (step === 6) return 'electronics';
  if (step === 7) return 'battery';
  if (step === 8) return 'platform';
  return 'hardware';
}

/** Muestra solo el FRAME del drone (motores + hélices + tubos + frames + tren),
 *  sin electrónica/batería/plataforma/tornillería. Estado inicial del configurador.
 *  Solo actúa sobre meshes: si tocara grupos, el nodo raíz (que cae en el paso
 *  catch-all de tornillería) quedaría oculto y arrastraría a TODO el drone. */
export function revealFrameOnly(root: THREE.Group) {
  root.traverse(o => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const s = m.userData.step as number | undefined;
    if (s === undefined) return;
    const fam = droneStepFamily(s);
    m.visible = fam === 'motors' || fam === 'propellers' || fam === 'frame';
  });
}


// ─── Lista de ensamblaje — ORDEN DEFINITIVO (ciclo 11, feedback Alexander) ───
// Alexander verificó en Blender el orden REAL de aparición de las piezas del
// GLB y lo entregó por escrito; reemplaza el orden por buckets+cuadrantes del
// ciclo 10. Estructura (57 entradas que consumen slider):
//   1-7   Cuadrante 1 (−x,−z): motor → placa → soporte → hélice → base →
//         tubo de posicionamiento → abrazadera del brazo (×2 juntas).
//   8-9   Frame superior; frame inferior. El frame inferior ARRASTRA en `with`
//         (mecanismo del ciclo 10) TODAS las demás instancias de las piezas de
//         los pasos 1-7 (los otros 3 motores con sus acompañantes): aparecen
//         solas en el paso 9 SIN consumir slider.
//   10-37 Pilones, abrazaderas, anillos, tubos, electrónica, batería,
//         plataforma y tren — en el orden exacto dado por el usuario.
//   38-57 Tornillería por SETS COMPLETOS (una entrada por tipo, ordenadas de
//         mayor a menor cantidad según el GLB; label humanizado + conteo).
// Matching por regex ANCLADOS sobre el nombre de NODO (o el nodo padre para
// los grupos multi-primitiva: motor y hélices) — NO piezaKey genérico, para
// no pisar instancias. Nombres verificados contra el chunk JSON del GLB.

/** Máximo del slider de piezas (decisionTree): a este valor todo es visible. */
export const MAX_SLIDER_PIECES = 50;

/** Cuadrante del brazo según la posición mundo (x=izq/der, z=frente/atrás). */
export type Quadrante = '(-x,-z)' | '(+x,-z)' | '(+x,+z)' | '(-x,+z)';

export interface AssemblyEntry {
  mesh: THREE.Mesh;
  es: string;
  en: string;
  /** Meshes que se revelan JUNTAS con `mesh` sin consumir slider extra
   *  (sub-mallas del mismo grupo multi-primitiva, sets completos y — en el
   *  paso 9 — todas las instancias restantes de los pasos 1-7). */
  with?: THREE.Mesh[];
  /** Cuadrante de la pieza (posición de su primera mesh, espacio local). */
  cuadrante?: Quadrante;
  /** Nombre de nodo que identifica la entrada (QA/Blender). */
  nodo?: string;
}

/** Cuadrante de una posición mundo (tolerancia: piezas centradas → undefined). */
const QUAD_TOL = 0.02;
function quadOfPos(x: number, z: number): Quadrante | undefined {
  if (Math.abs(x) < QUAD_TOL && Math.abs(z) < QUAD_TOL) return undefined;
  return `(${x < 0 ? '-' : '+'}x,${z < 0 ? '-' : '+'}z)` as Quadrante;
}

/**
 * Sets de tornillería en orden fijo (ciclo 11): cada set = UNA entrada del
 * slider con TODAS sus meshes. Regex ANCLADOS por prefijo — OJO: GLTFLoader
 * sanea los nombres de nodo (PropertyBinding.sanitizeNodeName) y ELIMINA los
 * puntos, p.ej. 'GB70-M3-6.001_low_PRIM' llega como 'GB70-M3-6001_low_PRIM'.
 * Los prefijos son disjuntos entre familias (ninguno es prefijo de otro set,
 * p.ej. GB70-M25-10 no pisa GB70-M25-12), así que el ancla ^ basta.
 * `n` = cantidad esperada según el GLB; se verifica en runtime (warn si difiere).
 */
const FASTENER_SETS: Array<{ re: RegExp; n: number; es: string; en: string }> = [
  { re: /^GB70-M25-10/, n: 8, es: 'Tornillos M25×10', en: 'M25×10 screws' },
  { re: /^GB70-M25-12/, n: 13, es: 'Tornillos M25×12', en: 'M25×12 screws' },
  { re: /^GB70-M25-6/, n: 24, es: 'Tornillos M25×6', en: 'M25×6 screws' },
  { re: /^GB70-M3-21-DING/, n: 2, es: 'Tornillos M3×21 DING', en: 'M3×21 DING screws' },
  { re: /^GB70-M3-25-DING/, n: 2, es: 'Tornillos M3×25 DING', en: 'M3×25 DING screws' },
  { re: /^GB70-M3-38/, n: 16, es: 'Tornillos M3×38', en: 'M3×38 screws' },
  { re: /^GB70-M3-6/, n: 16, es: 'Tornillos M3×6', en: 'M3×6 screws' },
  { re: /^GB70-M3-8-DING/, n: 12, es: 'Tornillos M3×8 DING', en: 'M3×8 DING screws' },
  { re: /^LM-M3-DING/, n: 8, es: 'Remaches M3 DING', en: 'M3 DING rivets' },
  { re: /^LM-M3-NILONG/, n: 2, es: 'Remaches M3 nylon', en: 'M3 nylon rivets' },
  { re: /^M25-6-CHEN-LIU/, n: 12, es: 'Tornillos M25×6 avellanados', en: 'M25×6 countersunk screws' },
  { re: /^M3-10-PAN-DING/, n: 4, es: 'Tornillos M3×10 pan', en: 'M3×10 pan screws' },
  { re: /^M3-14-PAN/, n: 4, es: 'Tornillos M3×14 pan', en: 'M3×14 pan screws' },
  { re: /^M3-16-CHEN-LIU/, n: 2, es: 'Tornillos M3×16 avellanados', en: 'M3×16 countersunk screws' },
  { re: /^NILONGZHU-M25-5/, n: 4, es: 'Postes nylon M25×5', en: 'M25×5 nylon standoffs' },
  { re: /^NILONGZHU-M3-5/, n: 4, es: 'Postes nylon M3×5', en: 'M3×5 nylon standoffs' },
  { re: /^ZSLM-M25/, n: 4, es: 'Tuercas M25 autoblocantes', en: 'M25 self-lock nuts' },
  { re: /^ZSLM-M3-DING/, n: 8, es: 'Tuercas M3 DING', en: 'M3 DING nuts' },
  { re: /^ZSLM-M3-FALAN/, n: 16, es: 'Tuercas M3 con brida', en: 'M3 flange nuts' },
  { re: /^BM06B-WO/, n: 1, es: 'Conector BM06B', en: 'BM06B connector' },
];

/**
 * Lista de ensamblaje DEFINITIVA (ciclo 11). Los regex van sobre el nombre de
 * NODO; para los grupos multi-primitiva (4 motores, 4 hélices, 4 patas EVA)
 * el nombre de instancia vive en el nodo PADRE (GLTFLoader nombra las
 * sub-mallas con el nombre de la MESH del glTF, compartido por las 4
 * instancias: 'DJ-2216-KV880.019', 'mesh.002', 'JIAO-EVA.015'). Devuelve
 * además el total de MESHES (para el contador 1:1 y QA).
 */
export function buildAssemblyReveal(root: THREE.Group): { list: AssemblyEntry[]; total: number } {
  root.updateMatrixWorld(true);
  const all: THREE.Mesh[] = [];
  root.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) all.push(m); });
  const total = all.length;

  /** Nombre de NODO de una mesh: las sub-mallas hijas de un grupo
   *  multi-primitiva (motor, hélice, pata EVA) toman el nombre del PADRE
   *  (grupo ≠ raíz y ≠ mesh); las mallas single-prim SE NOMBRAN con el nombre
   *  del nodo (GLTFLoader: node.name pisa mesh.name) → m.name. */
  const nodeName = (m: THREE.Mesh): string => {
    const p = m.parent;
    if (p && p !== root && !(p as THREE.Mesh).isMesh && p.name) return p.name;
    return m.name ?? '';
  };
  const byName = (re: RegExp): THREE.Mesh[] => all.filter(m => re.test(nodeName(m)));
  const quadOfMeshes = (meshes: THREE.Mesh[]): Quadrante | undefined => {
    if (!meshes.length) return undefined;
    const p = root.worldToLocal(meshes[0].getWorldPosition(new THREE.Vector3()));
    return quadOfPos(p.x, p.z);
  };

  const list: AssemblyEntry[] = [];
  const used = new Set<THREE.Mesh>();
  const add = (meshes: THREE.Mesh[], es: string, en: string, nodo?: string) => {
    if (!meshes.length) { console.warn(`[assembly] pieza ausente: ${es}`); return; }
    for (const m of meshes) used.add(m);
    const rest = meshes.slice(1);
    list.push({
      mesh: meshes[0], es, en,
      with: rest.length ? rest : undefined,
      cuadrante: quadOfMeshes(meshes),
      nodo: nodo ?? nodeName(meshes[0]),
    });
  };

  // ── 1-7: cuadrante (−x,−z) ──
  // Motores y hélices: piezas = GRUPOS multi-primitiva (2 sub-mallas por
  // nodo). El motor/hélice del cuadrante 1 se identifica por NODO ('_001'
  // / '_low'), verificado por Alexander en Blender y contra el GLB.
  const motorGroups = new Map<THREE.Object3D, THREE.Mesh[]>();
  const propGroups = new Map<THREE.Object3D, THREE.Mesh[]>();
  for (const m of all) {
    const p = m.parent;
    if (!p || p === root) continue;
    if (/^DJ-2216-KV880/i.test(p.name ?? '')) {
      const g = motorGroups.get(p) ?? []; g.push(m); motorGroups.set(p, g);
    } else if (/^x500v2_propeller/i.test(p.name ?? '')) {
      const g = propGroups.get(p) ?? []; g.push(m); propGroups.set(p, g);
    }
  }
  const motorOf = (re: RegExp) => [...motorGroups.entries()].find(([, ms]) => re.test(ms[0].parent?.name ?? ''))?.[1] ?? [];
  const propOf = (re: RegExp) => [...propGroups.entries()].find(([, ms]) => re.test(ms[0].parent?.name ?? ''))?.[1] ?? [];

  add(motorOf(/^DJ-2216-KV880[._]?0*1/i), 'Motor', 'Motor');
  add(byName(/^BAN-DJ-DIAN-F2[._]?001/i), 'Placa del motor', 'Motor plate');
  add(byName(/^HMX5V-ZUO-DJ-MUJU[._]?001/i), 'Soporte del motor', 'Motor holder');
  add(propOf(/^x500v2_propeller_low$/i), 'Hélice', 'Propeller');
  add(byName(/^HMX5V-DIGAI-DIANJIZUO-MUJU[._]?001/i), 'Base del motor', 'Motor mount');
  add(byName(/^HMX5V-GUAN-DINGWEI[._]?001/i), 'Tubo de posicionamiento', 'Positioning tube');
  add(byName(/^HMX5V-JIBI-JIA-MUJU[._]?00[12]/i), 'Abrazadera del brazo', 'Arm clip');

  // Sanity (verificación del usuario): el motor '_001' debe caer en (−x,−z).
  const q1 = list[0]?.cuadrante;
  if (q1 && q1 !== '(-x,-z)') console.warn(`[assembly] motor _001 fuera del cuadrante (−x,−z): ${q1}`);

  // ── 8-9: frames. El frame inferior arrastra TODAS las demás instancias de
  // las piezas de los pasos 1-7 (los otros 3 motores y acompañantes): mecanismo
  // `with` del ciclo 10 — aparecen solas aquí, SIN consumir slider. ──
  add(byName(/^TOP-PLATE-X500-V5/i), 'Frame superior', 'Top plate');
  const othersQ1 = [
    ...[...motorGroups.values()].filter(ms => !/^DJ-2216-KV880[._]?0*1/i.test(ms[0].parent?.name ?? '')).flat(),
    ...byName(/^BAN-DJ-DIAN-F2/i).filter(m => !/^BAN-DJ-DIAN-F2[._]?001/i.test(nodeName(m))),
    ...byName(/^HMX5V-ZUO-DJ-MUJU/i).filter(m => !/^HMX5V-ZUO-DJ-MUJU[._]?001/i.test(nodeName(m))),
    ...[...propGroups.values()].filter(ms => !/^x500v2_propeller_low$/i.test(ms[0].parent?.name ?? '')).flat(),
    ...byName(/^HMX5V-DIGAI-DIANJIZUO-MUJU/i).filter(m => !/^HMX5V-DIGAI-DIANJIZUO-MUJU[._]?001/i.test(nodeName(m))),
    ...byName(/^HMX5V-GUAN-DINGWEI/i).filter(m => !/^HMX5V-GUAN-DINGWEI[._]?001/i.test(nodeName(m))),
    ...byName(/^HMX5V-JIBI-JIA-MUJU/i).filter(m => !/^HMX5V-JIBI-JIA-MUJU[._]?00[12]/i.test(nodeName(m))),
  ];
  const bottomMeshes = byName(/^BOTTOM-PLATE-X500-V5/i);
  add([...bottomMeshes, ...othersQ1], 'Frame inferior', 'Bottom plate', bottomMeshes[0]?.name);

  // ── 10-37: tren, electrónica, batería y plataforma (orden exacto) ──
  add(byName(/^PYLONS-X500/i), 'Pilones', 'Pylons');
  add(byName(/^JIA-GUAN[._]?00[1-4]/i), 'Abrazadera de tubo', 'Tube clamp');
  add(byName(/^HUAN-GUIJIAO/i), 'Anillo del tren de aterrizaje', 'Landing gear ring');
  add(byName(/^CARBON-FIBER-TUBE300/i), 'Tubo del brazo', 'Arm tube');
  add(byName(/^ZHIJIA-CAMERA-INTEL/i), 'Soporte de cámara Intel', 'Intel camera mount');
  add(byName(/^GAI-GUANGLIU/i), 'Tapa de flujo óptico', 'Optical flow cover');
  add([...byName(/^PLATFORM-PLAT/i), ...byName(/^JIA-GUAN[._]?00[5-8]/i)], 'Plataforma superior', 'Top platform');
  add([...byName(/^BATTERY-MOUNTING-PLAT/i), ...byName(/^BATTERY-PAD/i)], 'Placa de montaje de batería', 'Battery mounting plate');
  add(byName(/^x500v2_battery/i), 'Batería', 'Battery');
  add([...byName(/^GPS-ZHIJIA-ZUO/i), ...byName(/^GPS-ZHIJIA-ZHUANJIETOU/i)], 'Soporte GPS', 'GPS mount');
  add(byName(/^GPSV5-ZHIJIA-LUOMAO/i), 'Tuerca del soporte GPS', 'GPS mount nut');
  add(byName(/^GAN-GPSV5/i), 'Poste del GPS', 'GPS post');
  add(byName(/^GPSV5-ZHIJIA-TUOPAN/i), 'Bandeja del GPS', 'GPS tray');
  add(byName(/^x500v2_gps/i), 'Módulo GPS (M10)', 'GPS module (M10)');
  add(byName(/^JIA-LIANJIE/i), 'Conector del frame', 'Frame connector');
  add(byName(/^GUAN-CHENG/i), 'Manguito del frame', 'Frame sleeve');
  add(byName(/^JIAO-LIANJIE/i), 'Conexión de pata', 'Leg connector');
  add(byName(/^CARBON-FIBER-TUBE(?!300)/i), 'Tubo del frame', 'Frame tube');
  add(byName(/^JIAO-EVA/i), 'Patas de EVA', 'EVA leg pads');
  add(byName(/^MAO-JIAO/i), 'Remates de pata', 'Leg caps');
  add(byName(/^x500v2_telemetry/i), 'Radio de telemetría', 'Telemetry radio');
  add(byName(/^DIKE-PIXHAWK6C/i), 'Base de Pixhawk 6C', 'Pixhawk 6C base');
  add(byName(/^PCB-PIXHAWK6C/i), 'PCB de Pixhawk 6C', 'Pixhawk 6C PCB');
  add(byName(/^IMU-PIXHAWK6C/i), 'IMU de Pixhawk 6C', 'Pixhawk 6C IMU');
  add(byName(/^MIANKE-PIXHAWK6C/i), 'Tapa de Pixhawk 6C', 'Pixhawk 6C cover');
  add(byName(/^PCB-PM06/i), 'Módulo de potencia PM06', 'PM06 power module');
  add(byName(/^TOU-XT60H/i), 'Conector XT60 (14 AWG)', 'XT60 connector (14 AWG)');
  add(byName(/^X500-TAO-XT60/i), 'Cubierta XT60', 'XT60 cover');

  // ── 38-57: sets de tornillería completos (mayor → menor cantidad) ──
  const libres = all.filter(m => !used.has(m));
  for (const set of FASTENER_SETS) {
    const meshes = libres.filter(m => set.re.test(nodeName(m)));
    if (meshes.length !== set.n) {
      console.warn(`[assembly] set ${set.es}: ${meshes.length} meshes (esperadas ${set.n})`);
    }
    add(meshes, `${set.es} (${meshes.length})`, `${set.en} (${meshes.length})`);
  }
  // Red de seguridad: cualquier mesh que ningún paso haya recogido (un cambio
  // de nombres en el GLB no debe dejar piezas invisibles a 50+).
  const sobrantes = all.filter(m => !used.has(m));
  if (sobrantes.length) {
    console.warn(`[assembly] ${sobrantes.length} meshes fuera del orden definitivo`);
    add(sobrantes, 'Tornillería restante', 'Remaining hardware');
  }
  return { list, total };
}

/**
 * Revelado (ciclo 11): k = entradas visibles del slider (1-50). Las meshes
 * `with` de cada entrada se revelan con ella (instancias del paso 9, sets
 * completos de tornillería). k ≥ 50 → TODO visible (etiqueta "50+").
 */
export function revealAssemblyList(list: AssemblyEntry[], k: number) {
  const all = k >= MAX_SLIDER_PIECES;
  let r = 0;
  for (const e of list) {
    r++;
    const vis = all || r <= k;
    e.mesh.visible = vis;
    if (e.with) for (const m of e.with) m.visible = vis;
  }
}
