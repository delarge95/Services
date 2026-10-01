/**
 * twinsight/assets.ts — Modelos de la presentación de sustentación TwinSight X500 (ciclo 31).
 * Origen: E:\WebGL_tesis\Informe_final\presentation\assets\model\{preshow_glb,screw_parts}_datauri.js
 * (data-URI → GLB). Optimizados SIN simplificar: texturas WebP + compresión meshopt
 * (68 847 vértices y 252 nodos intactos). 1,66 MB + 0,2 MB, carga diferida.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

const BASE = `${import.meta.env.BASE_URL}cotizador/cases/twinsight/models/`;
export const DRONE_URL = `${BASE}x500-twinsight.glb`;
export const SCREW_URL = `${BASE}screw-parts.glb`;

const buffers = new Map<string, Promise<ArrayBuffer>>();
const fetchBuf = (url: string) => {
  let p = buffers.get(url);
  if (!p) { p = fetch(url).then((r) => { if (!r.ok) throw new Error(`GLB ${r.status}`); return r.arrayBuffer(); }); buffers.set(url, p); }
  return p;
};

/** Escena NUEVA en cada llamada (cada visor tiene su propio grafo; el binario se descarga una vez). */
export async function loadScene(url: string): Promise<THREE.Group> {
  const buf = await fetchBuf(url);
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const g = await loader.parseAsync(buf.slice(0), '');
  return g.scene;
}

/** Entorno de estudio con softboxes (idéntico a la presentación) para reflejos PBR. */
export function studioEnv(renderer: THREE.WebGLRenderer, accent = new THREE.Color(1.0, 0.55, 0.25)): THREE.Texture {
  const env = new THREE.Scene();
  const room = new THREE.Mesh(new THREE.BoxGeometry(20, 12, 20), new THREE.MeshBasicMaterial({ color: 0x0d0e11, side: THREE.BackSide }));
  room.position.y = 4; env.add(room);
  const box = (w: number, h: number, x: number, y: number, z: number, ry: number, rx: number, c: THREE.Color) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide }));
    m.position.set(x, y, z); m.rotation.set(rx, ry, 0); env.add(m);
  };
  const W = new THREE.Color(1, 1, 1);
  box(9, 5, 0, 9.5, 0, 0, Math.PI / 2, W.clone().multiplyScalar(5));
  box(3.2, 6, -8.5, 4, 3, Math.PI / 2, 0, W.clone().multiplyScalar(7));
  box(1.2, 8, 8.5, 4, -2, -Math.PI / 2, 0, new THREE.Color(2.6, 2.9, 3.4));
  box(1.2, 8, 3, 4, -9.5, 0, 0, new THREE.Color(3.2, 3.3, 3.4));
  box(6, 1.4, 0, 1.2, 9.5, Math.PI, 0, accent.clone().multiplyScalar(0.9));   // acento de marca muy tenue (antes lima)
  const pm = new THREE.PMREMGenerator(renderer);
  const tex = pm.fromScene(env, 0.035).texture;
  pm.dispose();
  return tex;
}

export function canvasTex(size: number, draw: (x: CanvasRenderingContext2D, n: number) => void, srgb = true): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = c.height = size;
  draw(c.getContext('2d')!, size);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Orienta y escala el dron como en la presentación: eje más corto = altura, envergadura 2,7. */
export function placeDrone(obj: THREE.Object3D) {
  const raw = new THREE.Box3().setFromObject(obj).getSize(new THREE.Vector3());
  const orient = new THREE.Group(); orient.add(obj);
  if (raw.z < raw.y && raw.z <= raw.x) orient.rotation.x = -Math.PI / 2;
  else if (raw.x < raw.y && raw.x < raw.z) orient.rotation.z = Math.PI / 2;
  orient.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(orient);
  const size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
  const s = 2.7 / Math.max(size.x, size.z);
  orient.position.sub(c);
  const wrap = new THREE.Group(); wrap.add(orient); wrap.scale.setScalar(s);
  wrap.position.y = (size.y * s) / 2;
  wrap.updateMatrixWorld(true);
  return { wrap, scale: s, height: size.y * s };
}

export const smooth = (a: number, b: number, x: number) => { const k = Math.max(0, Math.min(1, (x - a) / (b - a))); return k * k * (3 - 2 * k); };
export const sm01 = (x: number) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
