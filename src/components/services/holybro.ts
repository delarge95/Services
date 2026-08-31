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
    const name = o.name ?? '';
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

// ─── Stages de ensamblaje MOTOR-PRIMERO (ciclo 7, feedback Alexander) ───
// 1 motor → +hélice → +tubo → frame superior (×4 instancias) → frame inferior
// → aterrizaje → electrónica → batería → plataforma → tornillería (instancias).

export const ASSEMBLY_STAGE_PREDICATES: RegExp[] = [
  /DJ-2216-KV880_001|HMX5V-DIGAI-DIANJIZUO-MUJU_001/i,   // 0: UN motor con su base
  /x500v2_propeller_low/i,                                 // 1: UNA hélice
  /CARBON-FIBER-TUBE300_001/i,                             // 2: UN tubo del brazo
  /TOP-PLATE|CARBON-FIBER-TUBE|DJ-2216-KV880|HMX5V|propeller_instance|propeller_low/i, // 3: frame superior + instancias ×4
  /BOTTOM-PLATE|JIA-GUAN|GUAN-CHENG|JIA-LIANJIE/i,         // 4: frame inferior
  /PYLONS-X500|MAO-JIAO|JIAO-EVA|HUAN-GUIJIAO|JIAO-LIANJIE/i, // 5: tren de aterrizaje
  /PIXHAWK|IMU|PCB|GPS|TELEMETRY|XT60|BM06B|TOU-|DIKE-|MIANKE|GAI-GUANGLIU|ZHIJIA-CAMERA|GAN-GPSV5|GPSV5-ZHIJIA|GPS-ZHIJIA|x500v2_gps|x500v2_telemetry/i, // 6: electrónica
  /battery|BATTERY/i,                                      // 7: batería
  /PLATFORM-PLAT|X500-TAO/i,                               // 8: plataforma superior
  /./i,                                                    // 9: tornillería (instancias)
];

export const ASSEMBLY_STAGE_NAMES = HOLYBRO_STEPS;

/** Marca cada mesh con userData.assmStage (0-9) según los stages de ensamblaje. */
export function tagAssemblyStages(root: THREE.Group) {
  root.traverse(o => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const name = m.name ?? '';
    for (let i = 0; i < ASSEMBLY_STAGE_PREDICATES.length; i++) {
      if (ASSEMBLY_STAGE_PREDICATES[i].test(name)) { m.userData.assmStage = i; break; }
    }
  });
}

/** Revelado por stages: visible si assmStage <= k-1 (k = 1..10). */
export function revealAssemblyStages(root: THREE.Group, k: number) {
  root.traverse(o => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const st = m.userData.assmStage as number | undefined;
    if (st === undefined) return;
    m.visible = st <= k - 1;
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


// ─── Lista de ensamblaje pieza-a-pieza (ciclo 8, feedback Alexander) ───
// El slider 1-50 revela grupos 1:1: 1 = el motor, 2 = +hélice, 3 = +tubo,
// 4 = frame superior completo (instancias ×4)… y de ahí cada tipo de tornillería.

export interface AssemblyGroup { meshes: THREE.Mesh[]; es: string; en: string }

export function buildAssemblyReveal(root: THREE.Group): { list: AssemblyGroup[]; total: number } {
  const pick = (re: RegExp): THREE.Mesh[] => {
    const out: THREE.Mesh[] = [];
    root.traverse(o => {
      const m = o as THREE.Mesh;
      if (m.isMesh && re.test(m.name ?? '')) out.push(m);
    });
    return out;
  };
  const list: AssemblyGroup[] = [
    { meshes: pick(/DJ-2216-KV880_001|HMX5V-DIGAI-DIANJIZUO-MUJU_001/i), es: 'Motor', en: 'Motor' },
    { meshes: pick(/x500v2_propeller_low/i), es: 'Hélice', en: 'Propeller' },
    { meshes: pick(/CARBON-FIBER-TUBE300_001/i), es: 'Tubo del brazo', en: 'Arm tube' },
    { meshes: [...pick(/TOP-PLATE/i), ...pick(/CARBON-FIBER-TUBE/i), ...pick(/DJ-2216-KV880\.00/i), ...pick(/HMX5V/i), ...pick(/propeller_instance/i)], es: 'Frame superior (instancias ×4)', en: 'Top frame (×4 instances)' },
    { meshes: [...pick(/BOTTOM-PLATE/i), ...pick(/JIA-GUAN/i), ...pick(/GUAN-CHENG/i), ...pick(/JIA-LIANJIE/i)], es: 'Frame inferior', en: 'Bottom frame' },
    { meshes: [...pick(/PYLONS-X500/i), ...pick(/MAO-JIAO/i), ...pick(/JIAO-EVA/i), ...pick(/HUAN-GUIJIAO/i), ...pick(/JIAO-LIANJIE/i)], es: 'Tren de aterrizaje', en: 'Landing gear' },
    { meshes: [...pick(/PIXHAWK|IMU|PCB|GPS|TELEMETRY|XT60|BM06B|TOU-|DIKE-|MIANKE|GAI-GUANGLIU|ZHIJIA-CAMERA|GAN-GPSV5|GPSV5-ZHIJIA|GPS-ZHIJIA|x500v2_gps|x500v2_telemetry/i)], es: 'Electrónica', en: 'Electronics' },
    { meshes: pick(/battery|BATTERY/i), es: 'Batería', en: 'Battery' },
    { meshes: [...pick(/PLATFORM-PLAT/i), ...pick(/X500-TAO/i)], es: 'Plataforma superior', en: 'Top platform' },
  ];
  // Tornillería: cada TIPO de pieza (nombre normalizado) es un grupo individual
  const seen = new Set<string>();
  root.traverse(o => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const st = m.userData.step as number | undefined;
    if (st !== 9) return;
    const k = piezaKey(m.name ?? '');
    if (seen.has(k)) return;
    seen.add(k);
    const meshes: THREE.Mesh[] = [];
    root.traverse(o2 => {
      const m2 = o2 as THREE.Mesh;
      if (m2.isMesh && piezaKey(m2.name ?? '') === k) meshes.push(m2);
    });
    list.push({ meshes, es: 'Tornillería', en: 'Hardware' });
  });
  return { list, total: list.length };
}

/** Revela los primeros k grupos de la lista (el resto oculto). */
export function revealAssemblyList(list: AssemblyGroup[], k: number) {
  list.forEach((g, i) => { for (const m of g.meshes) m.visible = i < k; });
}
