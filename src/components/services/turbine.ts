/**
 * turbine.ts — Turbina real (colección TURBINE de Blender, 1065 nodos,
 * 181k tris) para el slider de nivel de detalle (ciclo 18/19).
 *
 * Pipeline: Blender (transforms APLICADAS: 1065 nodos identidad, geometría
 * en coords mundo) → GLB → webp+meshopt (grafo preservado) → 2.36 MB.
 *
 * Revelado pieza a pieza (frente→atrás) + despiece axial estilo exploded
 * view técnico: cada pieza vuela desde su posición explosionada hacia su
 * hogar a medida que sube el nivel de detalle.
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

export const TURBINE_URL = `${import.meta.env.BASE_URL}cotizador/models/turbine.glb`;

let cache: Promise<THREE.Group> | null = null;

/** Carga (una vez) la turbina normalizada: centrada, largo ~2.5 en X. */
export function loadTurbine(): Promise<THREE.Group> {
  if (!cache) {
    cache = new Promise((resolve, reject) => {
      fetch(TURBINE_URL)
        .then(r => {
          if (!r.ok) throw new Error(`GLB ${r.status}`);
          return r.arrayBuffer();
        })
        .then(buf => {
          const loader = new GLTFLoader();
          loader.setMeshoptDecoder(MeshoptDecoder);
          loader.parse(buf, '', gltf => {
            const root = gltf.scene;
            root.updateMatrixWorld(true);
            const box = new THREE.Box3().setFromObject(root);
            const size = box.getSize(new THREE.Vector3());
            const s = 2.5 / Math.max(size.x, size.y, size.z);
            root.scale.setScalar(s);
            root.updateMatrixWorld(true);
            const box2 = new THREE.Box3().setFromObject(root);
            const c = box2.getCenter(new THREE.Vector3());
            root.position.sub(c);
            if (size.y > size.x && size.y > size.z) root.rotation.z = Math.PI / 2;
            else if (size.z > size.x && size.z > size.y) root.rotation.y = Math.PI / 2;
            resolve(root);
          }, err => reject(err));
        })
        .catch(reject);
    });
  }
  return cache;
}

export interface TurbinePiece {
  mesh: THREE.Mesh;
  /** posición de reposo (ensamblada) en el espacio del grupo */
  home: THREE.Vector3;
  /** desplazamiento explosionado (axial + jitter radial determinista) */
  offset: THREE.Vector3;
  /** momento de entrada en el slider: 0 = primer bloque, 1 = último */
  t0: number;
}

export interface TurbineLayout {
  pieces: TurbinePiece[];
  /** bbox ensamblado (para alinear la silueta low-poly) */
  box: THREE.Box3;
  radio: number;
}

/** hash determinista → [0,1) — mismo truco que dirExplosion en ModelPreview */
function hash01(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 1000) / 1000;
}

/**
 * Ordena las piezas frente→atrás (X) con desempate radial y calcula el
 * despiece: dirección AXIAL (estilo vista explosionada técnica — cada
 * estación se desliza hacia afuera del centro del motor) + un jitter
 * radial pequeño y determinista para que las piezas apiladas se separen.
 */
export function buildTurbineLayout(root: THREE.Group): TurbineLayout {
  root.updateMatrixWorld(true);
  const items: { m: THREE.Mesh; cx: number; cy: number; cz: number; r: number }[] = [];
  root.traverse(o => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    if (!m.geometry.boundingSphere) m.geometry.computeBoundingSphere();
    const bs = m.geometry.boundingSphere!;
    const c = bs.center.clone().applyMatrix4(m.matrixWorld);
    items.push({ m, cx: c.x, cy: c.y, cz: c.z, r: Math.hypot(c.y, c.z) });
  });
  items.sort((a, b) => (a.cx - b.cx) || (a.r - b.r) || (a.cy - b.cy));

  const box = new THREE.Box3().setFromObject(root);
  const centroX = (box.min.x + box.max.x) / 2;
  const radio = Math.max(box.max.y - box.min.y, box.max.z - box.min.z) / 2;
  const largo = Math.max(0.001, box.max.x - box.min.x);

  const pieces: TurbinePiece[] = items.map((it, i) => {
    // axial: fuera del centro; los extremos viajan más lejos
    const dx = it.cx - centroX;
    const sign = dx === 0 ? 1 : Math.sign(dx);
    const rel = Math.abs(dx) / (largo / 2); // 0 centro, 1 extremo
    const axial = sign * (0.55 + rel * 1.15);
    // jitter radial determinista para separar piezas apiladas
    const h1 = hash01(it.m.name ?? String(i));
    const h2 = hash01((it.m.name ?? String(i)) + '#');
    const h3 = hash01((it.m.name ?? String(i)) + '%');
    const ang = h1 * Math.PI * 2;
    const rad = 0.18 + 0.4 * h3;
    const offset = new THREE.Vector3(
      axial,
      Math.sin(ang) * rad * 0.55,
      Math.cos(ang) * rad
    );
    return {
      mesh: it.m,
      home: it.m.position.clone(),
      offset,
      t0: items.length > 1 ? i / (items.length - 1) : 0,
    };
  });

  return { pieces, box, radio };
}
