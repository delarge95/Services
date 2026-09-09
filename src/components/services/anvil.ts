/**
 * anvil.ts — Carga del yunque real (yunke.glb) para el modo 'surface' del preview.
 * Reemplaza el morph procedural cubo→esfera (que queda como fallback).
 *
 * Ciclo 6 — GLB optimizado (53MB → 5.6MB): ya no trae escena del curso de
 * Blender. Se conserva SOLO el objeto 'ANVIL LOW POLI' con sus 2 shape keys y
 * su material; texturas re-escaladas a 1024. La normalización por bbox sigue
 * midiendo únicamente la mesh del yunque (sin suelo ni cylinders alrededor).
 *
 * Semántica de las morph keys (corrección del usuario, ciclo 6):
 * - Key 2 = forma SIMPLE (nivel 1 del slider).
 * - Key 1 = forma INTERMEDIA (nivel 3).
 * - Base (ambas keys = 0) = yunque COMPLETO (nivel 5).
 * Va AL REVÉS de lo que se asumía en el ciclo 5 (antes se leían como
 * "colapso/compacto" en orden inverso).
 *
 * La promesa cachea el parse normalizado (solo lectura) y cada instancia de
 * ModelPreview recibe root.clone(true) — mismo patrón que holybro.ts.
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

export const ANVIL_URL = `${import.meta.env.BASE_URL}cotizador/models/yunke.glb`;
/** Nodo cuya mesh es la que morphea (identificado en el GLB). */
/** Ciclo 16e — extirpacion de la figura invasora del target "Prismatica dura":
 *  triangulos cuyos 3 vertices quedan fuera de los limites robustos (mediana
 *  +/- 4*MAD) de la posicion prisma se marcan degenerados (indice 0,0,0).
 *  Edicion SOLO del index buffer: no toca normales ni posiciones del basis. */
/** Ciclo 16f — reconstruccion del target "Key 1" (Prismatica dura):
 *  el target autorado colapsaba los 1109 verts a una caja de 7cm en el origen
 *  (figura invasora flotante a valores bajos del slider). El prisma correcto
 *  = el yunque clampeado a su caja envolvente: bloque duro de caras planas.
 *  Escritura SOLO de posiciones del target (delta): normales y winding intactos. */
function reconstruirPrisma(g: any): void {
  if (!g?.isMesh || !g.morphAttributes?.position?.length || !g.attributes.position) return;
  const morph0 = g.morphAttributes.position[0];
  const pos = g.attributes.position;
  const bmin = new THREE.Vector3(-1.02, -0.32, -0.38);
  const bmax = new THREE.Vector3(1.02, 0.44, 0.38);
  for (let i = 0; i < pos.count; i++) {
    morph0.setXYZ(i,
      Math.min(bmax.x, Math.max(bmin.x, pos.getX(i))),
      Math.min(bmax.y, Math.max(bmin.y, pos.getY(i))),
      Math.min(bmax.z, Math.max(bmin.z, pos.getZ(i))));
  }
  morph0.needsUpdate = true;
}

function extirparPlacaPrisma(g: any): number {
  if (!g?.isMesh) return 0;
  const morph0 = g.morphAttributes?.position?.[0];
  const pos = g.attributes.position;
  const idx = g.index;
  if (!morph0 || !pos || !idx) return 0;
  const n = Math.min(pos.count, morph0.count);
  const px = new Float32Array(n), py = new Float32Array(n), pz = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    px[i] = morph0.getX(i); py[i] = morph0.getY(i); pz[i] = morph0.getZ(i);
  }
  const robusto = (arr: Float32Array) => {
    const srt = Array.from(arr).sort((a, b) => a - b);
    const med = srt[n >> 1];
    const mad = srt[Math.floor(n * 0.75)] - srt[Math.floor(n * 0.25)] || 1;
    return { lo: med - 4 * Math.abs(mad) - 0.05, hi: med + 4 * Math.abs(mad) + 0.05 };
  };
  const rx = robusto(px), ry = robusto(py), rz = robusto(pz);
  const placa = new Uint8Array(n);
  let cnt = 0;
  for (let i = 0; i < n; i++) {
    const fuera = px[i] < rx.lo || px[i] > rx.hi || py[i] < ry.lo || py[i] > ry.hi || pz[i] < rz.lo || pz[i] > rz.hi;
    if (fuera) { placa[i] = 1; cnt++; }
  }
  let borrados = 0;
  for (let t = 0; t < idx.count; t += 3) {
    const a = idx.getX(t), b = idx.getX(t + 1), c = idx.getX(t + 2);
    if (placa[a] && placa[b] && placa[c]) {
      idx.setX(t, 0); idx.setX(t + 1, 0); idx.setX(t + 2, 0);
      borrados++;
    }
  }
  if (borrados) idx.needsUpdate = true;
  return borrados;
}

export const ANVIL_MORPH_NODE = 'ANVIL LOW POLI';
/** GLTFLoader nombra la mesh con el NOMBRE DEL NODO ('ANVIL LOW POLI'), así que
 *  el match es por forma normalizada (espacio/guion/barra baja equivalentes). */
const ANVIL_MORPH_RE = /^ANVIL[\s_\-]?LOW[\s_\-]?POLI$/i;
/** Nombres de los morph targets del GLB (mesh.extras.targetNames). */
export const ANVIL_KEYS = ['Key 1', 'Key 2'] as const;

/** Influencia de pico por key. 'A tope' = peso 1: cada morph target es la forma
 *  final de su nivel (simple o intermedia). La transición es continua y ambas
 *  caen a 0 en t=5 (yunque base/completo). */
export const SURFACE_KEY2_MAX = 1.0;
export const SURFACE_KEY1_MAX = 1.0;

let cache: Promise<THREE.Group> | null = null;

function normalize(root: THREE.Group): THREE.Group {
  // marca la mesh del yunque (única visible) y las demás como compartidas
  const morphMeshes: THREE.Mesh[] = [];
  root.traverse(o => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    m.frustumCulled = false;
    m.userData.glbShared = true; // geometrías compartidas entre clones: no dispose en cleanup
    // Solo la mesh con morphs se muestra; las otras piezas de la escena
    // (duplicados sin morph + plano de suelo) estorban — ver cabecera.
    m.visible = ANVIL_MORPH_RE.test(m.name);
    if (m.visible) morphMeshes.push(m);
  });
  const morphMesh = morphMeshes[0] ?? null;
  // La escala se calcula SOLO con la mesh del yunque: la escena incluye un
  // plano de suelo gigante (×9.83) que, si se midiera entera, dejaría el
  // yunque a tamaño de grano (lección de la primera iteración del ciclo 5).
  root.updateMatrixWorld(true);
  const box = morphMesh
    ? new THREE.Box3().setFromObject(morphMesh)
    : new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  // ciclo 9: 2.6 → 3.4 — el yunque es una malla plana (alto ≈ 1/3 del ancho) y
  // el auto-encuadre por esfera lo dejaba pequeño en el canvas de surface.
  // ciclo 11: 3.4 → 3.06 (−10%) — el usuario lo veía grande en el canvas 290.
  // ciclo 13: 3.06 → 2.30 (−25% total, feedback Alexander). El auto-encuadre
  // anula los cambios de escala (acercan la cámara en la misma proporción),
  // así que el margen de cámara del modo surface sube 1.06 → 1.57 en
  // ModelPreview — ahí es donde la reducción se hace visible.
  const s = 2.30 / Math.max(size.x, size.y, size.z);
  root.scale.setScalar(s);
  root.updateMatrixWorld(true);
  const box2 = morphMesh
    ? new THREE.Box3().setFromObject(morphMesh)
    : new THREE.Box3().setFromObject(root);
  const c2 = box2.getCenter(new THREE.Vector3());
  root.position.sub(c2);
  // ciclo 13b (feedback: "centrados a la derecha, en movil excesivamente"):
  // el pivote del nodo de la mesh no coincide con su centro visual - al girar,
  // el contenido orbita el pivote y BARRE lateralmente (off -12%..-3% medido en
  // 390px). Recentramos la GEOMETRIA sobre el origen de su propio nodo: los
  // morph targets son deltas relativos, asi que se trasladan igual y el morph
  // sigue funcionando identico; el giro pasa a ser alrededor del centro visual.
  if (morphMesh) {
    const g = morphMesh.geometry;
    g.computeBoundingBox();
    const gc = g.boundingBox!.getCenter(new THREE.Vector3());
    g.translate(-gc.x, -gc.y, -gc.z);
    root.updateMatrixWorld(true);
    const box3 = new THREE.Box3().setFromObject(morphMesh);
    root.position.sub(box3.getCenter(new THREE.Vector3()));
  }
  return root;
}

/** Carga (una vez) el yunque normalizado y con las piezas no-morph ocultas. */
export function loadAnvil(): Promise<THREE.Group> {
  if (!cache) {
    cache = new Promise((resolve, reject) => {
      fetch(ANVIL_URL)
        .then(r => {
          if (!r.ok) throw new Error(`GLB ${r.status}`);
          return r.arrayBuffer();
        })
        .then(buf => {
          const loader = new GLTFLoader();
          loader.setMeshoptDecoder(MeshoptDecoder); // GLBs optimizados con meshopt (ciclo 15)
          loader.parse(buf, '', gltf => {
            const raiz = normalize(gltf.scene);
            let quitados = 0;
            try {
              raiz.traverse((o: any) => {
                if (o.isMesh && o.geometry) {
                  quitados += extirparPlacaPrisma(o.geometry);
                  reconstruirPrisma(o.geometry);
                }
              });
              console.info(`[anvil] placa invasora extirpada: ${quitados} triangulos`);
            } catch (e) {
              // la cirugia nunca debe tumbar la carga: sin cirugia, yunque con placa
              console.error('[anvil] extirpacion fallo:', e);
            }
            resolve(raiz);
          }, err => reject(err));
        })
        .catch(reject);
    });
  }
  return cache;
}

/** Copia independiente por instancia de preview (mismo patrón que holybro). */
export function loadAnvilInstance(): Promise<THREE.Group> {
  return loadAnvil().then(root => root.clone(true));
}

const smooth = (x: number) => { const t = Math.max(0, Math.min(1, x)); return t * t * (3 - 2 * t); };

/**
 * Reparto progresivo del slider superficie t∈[1,5] sobre los dos morph targets
 * (semántica corregida, ciclo 6 — va al revés del ciclo 5):
 * - t=1: Key 2 a tope (forma SIMPLE), Key 1 en 0.
 * - t=3: Key 1 a tope (forma INTERMEDIA), Key 2 en 0.
 * - t=5: ambas en 0 (yunque BASE / completo).
 * Curva continua y bidireccional:
 *   Key2(t) = smooth((3-t)/2) para t∈[1,3], 0 después        (1 → 0)
 *   Key1(t) = smooth((t-1)/2) para t∈[1,3], smooth((5-t)/2)  (0 → 1 → 0)
 * Las influencias son absolutas (robusto al subir/bajar el slider).
 */
export function surfaceWeights(t: number): [number, number] {
  const x = Math.max(1, Math.min(5, t));
  const w2 = x <= 3 ? smooth((3 - x) / 2) : 0;                 // simple: 1→0 en [1,3]
  const w1 = x <= 3 ? smooth((x - 1) / 2) : smooth((5 - x) / 2); // intermedia: 0→1→0
  return [SURFACE_KEY1_MAX * w1, SURFACE_KEY2_MAX * w2];
}

/** Aplica el slider superficie al morph del yunque (por instancia). */
export function applySurfaceMorph(root: THREE.Group, t: number) {
  const [w1, w2] = surfaceWeights(t);
  root.traverse(o => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || !m.morphTargetDictionary || !m.morphTargetInfluences) return;
    const dict = m.morphTargetDictionary;
    if (dict[ANVIL_KEYS[0]] !== undefined) m.morphTargetInfluences[dict[ANVIL_KEYS[0]]] = w1;
    if (dict[ANVIL_KEYS[1]] !== undefined) m.morphTargetInfluences[dict[ANVIL_KEYS[1]]] = w2;
  });
}
