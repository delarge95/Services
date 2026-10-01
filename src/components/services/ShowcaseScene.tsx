/**
 * ShowcaseScene.tsx — Escena 3D DEDICADA para las tarjetas de opciones (ciclo 27).
 *
 * Sustituye a ChoicePreview (ciclo 26), que reutilizaba los modos de ModelPreview
 * dentro de un mismo visor: al cambiar de opción quedaban modelos superpuestos y el
 * modo "hotspots" mostraba el producto procedural antiguo (cápsula) en vez del dron.
 * Aquí cada opción RECONSTRUYE su contenido desde cero en un único renderer, y lo
 * que se ve coincide con la descripción de la tarjeta:
 *
 *  interacción (combinables): rotar · hotspots (puntos anclados a piezas reales,
 *    clic → nombre) · configurar (colorways con muestras clicables) · desarmar
 *    (despiece ordenado del dron COMPLETO).
 *  tipo de app: configurador · catálogo (carrusel de 3 productos) · herramienta
 *    (corte que barre + aristas + medidas a escala real) · minijuego (vista superior,
 *    el ratón/dedo controla el dron: atrapa piezas, esquiva obstáculos).
 *
 * Medidas: escala derivada de la distancia entre ejes del Holybro X500 = 500 mm
 * (dato del fabricante, nombre del producto), medida entre los 4 motores del GLB.
 */
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { loadHolybroInstance, applyFinish, HOLYBRO_STEPS, meshEffectiveName } from './holybro';
import { loadAnvilInstance, applySurfaceMorph } from './anvil';
import { createMorphTurbine } from './turbineMorph';

export type ShowcaseKind = 'interaction' | 'app-type';
type Lang = 'es' | 'en';

const smooth = (x: number) => { const t = Math.max(0, Math.min(1, x)); return t * t * (3 - 2 * t); };
const stepOf = (m: THREE.Mesh): number => {
  if (m.userData.step !== undefined) return m.userData.step as number;
  const n = meshEffectiveName(m);
  return HOLYBRO_STEPS.findIndex((s) => s.match.test(n));
};

/** Texto que acompaña a cada escena (debe coincidir con lo que se ve). */
export function showcaseCaption(kind: ShowcaseKind, key: string, lang: Lang = 'es'): string {
  const es: Record<string, string> = {
    rotar: 'Vista 360°: arrastra para girar el modelo',
    hotspots: 'Toca un punto naranja: muestra el nombre de la pieza',
    configurar: 'Elige un acabado: el modelo cambia en vivo',
    desarmar: 'Vista explosionada: cada pieza se separa y vuelve a su sitio',
    configurador: 'Configurador: el cliente elige acabados y ve el resultado',
    catalogo: 'Catálogo: varios productos 3D navegables',
    herramienta: 'Herramienta técnica: corte en vivo, aristas y medidas reales',
    juego: 'Minijuego: mueve el dron, atrapa piezas y esquiva obstáculos',
  };
  const en: Record<string, string> = {
    rotar: '360° view: drag to rotate the model', hotspots: 'Tap an orange point to see the part name',
    configurar: 'Pick a finish: the model updates live', desarmar: 'Exploded view: every part separates and returns',
    configurador: 'Configurator: the customer picks finishes and sees the result', catalogo: 'Catalog: several browsable 3D products',
    herramienta: 'Technical tool: live section, edges and real measurements', juego: 'Mini-game: steer the drone, catch parts, dodge obstacles',
  };
  const t = lang === 'en' ? en : es;
  return key.split('+').map((k) => t[k]).filter(Boolean).join(' · ');
}

interface Built { group: THREE.Object3D; update: (dt: number, t: number) => void; dispose: () => void; camera?: THREE.Camera; interactive?: boolean; fitMargin?: number }
interface Ctx {
  overlay: HTMLDivElement; renderer: THREE.WebGLRenderer; camera: THREE.PerspectiveCamera;
  canvas: HTMLCanvasElement; size: () => { w: number; h: number }; lang: Lang; signal: { cancelled: boolean };
}

// ─── utilidades de overlay ───
const el = (parent: HTMLElement, cls: string, html = ''): HTMLDivElement => {
  const d = document.createElement('div'); d.className = cls; d.innerHTML = html; parent.appendChild(d); return d;
};
const project = (v: THREE.Vector3, cam: THREE.Camera, w: number, h: number) => {
  const p = v.clone().project(cam);
  return { x: (p.x * 0.5 + 0.5) * w, y: (-p.y * 0.5 + 0.5) * h, behind: p.z > 1 };
};

// ─── dron base ───
async function droneFor(finish: 'detallado' | 'variado' | 'simple'): Promise<THREE.Group> {
  const root = await loadHolybroInstance();
  applyFinish(root, finish);
  root.traverse((o) => { o.visible = true; });
  return root;
}

/** Despiece ordenado (dirección desde el centro geométrico de cada pieza, capas en Y). */
function prepareExplode(root: THREE.Group) {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const center = box.getCenter(new THREE.Vector3());
  const radius = Math.max(1e-3, box.getSize(new THREE.Vector3()).length() / 2);
  const items: { m: THREE.Mesh; home: THREE.Vector3; off: THREE.Vector3 }[] = [];
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const g = m.geometry; if (!g.boundingBox) g.computeBoundingBox();
    const cW = g.boundingBox!.getCenter(new THREE.Vector3()).applyMatrix4(m.matrixWorld);
    const d = cW.clone().sub(center);
    const r = Math.min(1, d.length() / radius);
    const dirW = new THREE.Vector3(d.x, d.y * 1.6, d.z);
    if (dirW.lengthSq() < 1e-8) dirW.set(0, 1, 0);
    dirW.normalize().multiplyScalar(radius * 0.85 * (0.25 + 0.75 * r));
    const parent = m.parent ?? root;
    const a0 = parent.worldToLocal(cW.clone()), a1 = parent.worldToLocal(cW.clone().add(dirW));
    items.push({ m, home: m.position.clone(), off: a1.sub(a0) });
  });
  return (e: number) => { for (const it of items) it.m.position.copy(it.home).addScaledVector(it.off, e); };
}

// ─── interacción (combinable) ───
async function buildInteraction(ctx: Ctx, flags: Set<string>): Promise<Built> {
  const group = new THREE.Group();
  const disposables: { dispose: () => void }[] = [];
  const configure = flags.has('configurar');
  const drone = await droneFor(configure ? 'variado' : 'detallado');
  group.add(drone);
  const explode = flags.has('desarmar') ? prepareExplode(drone) : null;

  // hotspots: anclas en piezas reales (nombres del CAD del X500)
  type Spot = { label: string; mesh: THREE.Mesh; local: THREE.Vector3; dot: HTMLDivElement };
  const spots: Spot[] = [];
  let active = 0, holdUntil = 0;
  if (flags.has('hotspots')) {
    const CATS: { label: string; en: string; test: (m: THREE.Mesh) => boolean; far?: boolean }[] = [
      { label: 'Motor 2216 KV880', en: 'Motor 2216 KV880', test: (m) => /DJ-2216-KV880/i.test(meshEffectiveName(m)), far: true },
      { label: 'Hélice', en: 'Propeller', test: (m) => stepOf(m) === 1, far: true },
      { label: 'Controlador de vuelo', en: 'Flight controller', test: (m) => /PIXHAWK/i.test(meshEffectiveName(m)) },
      { label: 'Antena GPS', en: 'GPS antenna', test: (m) => /GPS/i.test(meshEffectiveName(m)) },
      { label: 'Tren de aterrizaje', en: 'Landing gear', test: (m) => stepOf(m) === 5 },
      { label: 'Brazo de fibra de carbono', en: 'Carbon fiber arm', test: (m) => stepOf(m) === 2, far: true },
    ];
    const used = new Set<THREE.Mesh>();
    const usedQuads = new Set<number>();
    drone.updateMatrixWorld(true);
    for (const c of CATS) {
      let best: THREE.Mesh | null = null, bestV = -1;
      drone.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh || used.has(m) || !c.test(m)) return;
        const g = m.geometry; if (!g.boundingBox) g.computeBoundingBox();
        const s = g.boundingBox!.getSize(new THREE.Vector3());
        // motores/hélices/brazos: el más lejano del centro (punta de brazo, en otro cuadrante que el resto)
        let v = s.x * s.y * s.z;
        if (c.far) {
          const p = g.boundingBox!.getCenter(new THREE.Vector3()).applyMatrix4(m.matrixWorld);
          const quad = (p.x >= 0 ? 1 : 0) + (p.z >= 0 ? 2 : 0);
          v = Math.hypot(p.x, p.z) - (usedQuads.has(quad) ? 100 : 0);
          m.userData.__quad = quad;
        }
        if (v > bestV) { bestV = v; best = m; }
      });
      if (!best) continue;
      const mesh = best as THREE.Mesh; used.add(mesh);
      if (c.far && mesh.userData.__quad !== undefined) usedQuads.add(mesh.userData.__quad as number);
      const local = mesh.geometry.boundingBox!.getCenter(new THREE.Vector3());
      const dot = el(ctx.overlay, 'sc-spot', `<i></i><span>${ctx.lang === 'en' ? c.en : c.label}</span>`);
      const idx = spots.length;
      dot.addEventListener('click', () => { active = idx; holdUntil = performance.now() + 6000; });
      spots.push({ label: c.label, mesh, local, dot });
    }
  }

  // configurar: colorways con muestras
  const WAYS: { name: string; en: string; frame: number; mount: number }[] = [
    { name: 'Carbono', en: 'Carbon', frame: 0x17191d, mount: 0x1f7fd1 },
    { name: 'Rojo racing', en: 'Racing red', frame: 0x9d1c1c, mount: 0x1a1a1a },
    { name: 'Blanco ártico', en: 'Arctic white', frame: 0xe9eaec, mount: 0xff7a3d },
  ];
  let way = 0, wayHold = 0;
  const frameMat = new THREE.MeshPhysicalMaterial({ color: WAYS[0].frame, roughness: 0.32, metalness: 0.15, clearcoat: 1, clearcoatRoughness: 0.15 });
  const mountMat = new THREE.MeshStandardMaterial({ color: WAYS[0].mount, roughness: 0.3, metalness: 0.75 });
  disposables.push(frameMat, mountMat);
  let swatchBar: HTMLDivElement | null = null;
  if (configure) {
    drone.traverse((o) => {
      const m = o as THREE.Mesh; if (!m.isMesh) return;
      const n = meshEffectiveName(m); const s = stepOf(m);
      if (/HMX5V-DIGAI|DIANJIZUO/i.test(n)) m.material = mountMat;
      else if (s >= 2 && s <= 4) m.material = frameMat;
    });
    swatchBar = el(ctx.overlay, 'sc-swatches');
    WAYS.forEach((w, i) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'sc-swatch'; b.title = ctx.lang === 'en' ? w.en : w.name;
      b.innerHTML = `<i style="background:#${w.frame.toString(16).padStart(6, '0')}"></i><i style="background:#${w.mount.toString(16).padStart(6, '0')}"></i><span>${ctx.lang === 'en' ? w.en : w.name}</span>`;
      b.addEventListener('click', () => { way = i; wayHold = performance.now() + 7000; });
      swatchBar!.appendChild(b);
    });
  }
  const cTmp = new THREE.Color();
  let lastSwitch = 0, lastWay = -1;

  return {
    group,
    interactive: true,
    fitMargin: explode ? 1.75 : 1,
    dispose: () => disposables.forEach((d) => d.dispose()),
    update: (_dt, t) => {
      if (explode) {
        const ph = t % 6;
        explode(ph < 1.2 ? 0 : ph < 2.4 ? smooth(ph - 1.2) / 1 * 1 : ph < 4.6 ? 1 : 1 - smooth((ph - 4.6) / 1.2));
      }
      if (configure) {
        if (performance.now() > wayHold && t - lastSwitch > 2.2) { way = (way + 1) % WAYS.length; lastSwitch = t; }
        frameMat.color.lerp(cTmp.setHex(WAYS[way].frame), 0.08);
        mountMat.color.lerp(cTmp.setHex(WAYS[way].mount), 0.08);
        if (way !== lastWay && swatchBar) { [...swatchBar.children].forEach((c, i) => c.classList.toggle('on', i === way)); lastWay = way; }
      }
      if (spots.length) {
        if (performance.now() > holdUntil && Math.floor(t / 1.8) % spots.length !== active) active = Math.floor(t / 1.8) % spots.length;
        const { w, h } = ctx.size();
        spots.forEach((s, i) => {
          const p = project(s.local.clone().applyMatrix4(s.mesh.matrixWorld), ctx.camera, w, h);
          s.dot.style.transform = `translate(${p.x}px, ${p.y}px)`;
          s.dot.style.opacity = p.behind ? '0' : '1';
          s.dot.classList.toggle('on', i === active);
        });
      }
    },
  };
}

// ─── catálogo (carrusel de 3 productos reales del cotizador) ───
async function buildCatalog(ctx: Ctx): Promise<Built> {
  const group = new THREE.Group();
  const fit = (o: THREE.Object3D, size = 2.1) => {
    const holder = new THREE.Group(); holder.add(o);
    o.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(o); const s = b.getSize(new THREE.Vector3());
    o.scale.multiplyScalar(size / Math.max(s.x, s.y, s.z));
    o.updateMatrixWorld(true);
    const c = new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3());
    o.position.sub(c);
    return holder;
  };
  const drone = await droneFor('variado');
  const anvil = await loadAnvilInstance(); applySurfaceMorph(anvil, 5);
  const turb = createMorphTurbine(); turb.applyDetail(1); turb.root.rotation.y = Math.PI / 2;
  const items = [
    { o: fit(drone), es: 'Dron X500', en: 'X500 drone' },
    { o: fit(anvil, 1.9), es: 'Yunque de forja', en: 'Forge anvil' },
    { o: fit(turb.root, 2.0), es: 'Turbina', en: 'Turbine' },
  ];
  const R = 2.6;
  items.forEach((it) => group.add(it.o));
  let idx = 0, hold = 0, last = 0, pos = 0;
  const bar = el(ctx.overlay, 'sc-catalog');
  const name = el(bar, 'sc-cat-name');
  const prev = document.createElement('button'); prev.type = 'button'; prev.className = 'sc-cat-btn'; prev.textContent = '‹'; prev.setAttribute('aria-label', 'Anterior');
  const next = document.createElement('button'); next.type = 'button'; next.className = 'sc-cat-btn'; next.textContent = '›'; next.setAttribute('aria-label', 'Siguiente');
  bar.prepend(prev); bar.appendChild(next);
  const dots = el(ctx.overlay, 'sc-cat-dots', items.map(() => '<i></i>').join(''));
  const go = (d: number) => { idx = (idx + d + items.length) % items.length; hold = performance.now() + 7000; };
  prev.addEventListener('click', () => go(-1)); next.addEventListener('click', () => go(1));
  let lastIdx = -1;
  return {
    group, interactive: false,
    dispose: () => { /* geometrías del GLB compartidas; la turbina se libera con la escena */ },
    update: (dt, t) => {
      if (performance.now() > hold && t - last > 3.2) { idx = (idx + 1) % items.length; last = t; }
      // índice continuo que persigue al elegido por el camino corto (con vuelta)
      const n = items.length;
      let d = idx - pos; d = ((d % n) + n + n / 2) % n - n / 2;
      pos += d * Math.min(1, dt * 4);
      items.forEach((it, i) => {
        let k = i - pos; k = ((k % n) + n + n / 2) % n - n / 2;   // −n/2..n/2, 0 = al frente
        const a = (k / n) * Math.PI * 2;
        it.o.position.set(Math.sin(a) * R, 0, Math.cos(a) * R - R);
        const front = Math.max(0, 1 - Math.abs(k));
        it.o.scale.setScalar(0.5 + 0.5 * front);
        it.o.children[0].rotation.y += dt * (0.15 + 0.5 * front);
      });
      if (idx !== lastIdx) {
        name.textContent = ctx.lang === 'en' ? items[idx].en : items[idx].es;
        [...dots.children].forEach((c, i) => c.classList.toggle('on', i === idx));
        lastIdx = idx;
      }
    },
  };
}

// ─── herramienta técnica: corte que barre + aristas + medidas ───
async function buildTool(ctx: Ctx): Promise<Built> {
  const group = new THREE.Group();
  const drone = await droneFor('simple');
  group.add(drone);
  ctx.renderer.localClippingEnabled = true;
  const plane = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0);
  const clay = new THREE.MeshStandardMaterial({ color: 0x6b7480, roughness: 0.55, metalness: 0.15, clippingPlanes: [plane], side: THREE.DoubleSide });
  // aristas SIN recorte: la parte cortada queda como fantasma de alambre (se entiende el corte)
  const edgeMat = new THREE.LineBasicMaterial({ color: 0x67d4ff, transparent: true, opacity: 0.7 });
  const disposables: { dispose: () => void }[] = [clay, edgeMat];
  drone.updateMatrixWorld(true);
  drone.traverse((o) => {
    const m = o as THREE.Mesh; if (!m.isMesh) return;
    m.material = clay;
    const eg = new THREE.EdgesGeometry(m.geometry, 35); disposables.push(eg);
    const ls = new THREE.LineSegments(eg, edgeMat); ls.raycast = () => {}; m.add(ls);
  });
  // escala real: distancia entre ejes (motor a motor en diagonal) = 500 mm
  const motors: THREE.Vector3[] = [];
  drone.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && /DJ-2216-KV880/i.test(meshEffectiveName(m))) {
      const g = m.geometry; if (!g.boundingBox) g.computeBoundingBox();
      motors.push(g.boundingBox!.getCenter(new THREE.Vector3()).applyMatrix4(m.matrixWorld));
    }
  });
  let diag = 0;
  for (const a of motors) for (const b of motors) diag = Math.max(diag, Math.hypot(a.x - b.x, a.z - b.z));
  const mmPerUnit = diag > 0 ? 500 / diag : 0;
  const box = new THREE.Box3().setFromObject(drone);
  const size = box.getSize(new THREE.Vector3());
  // cotas (líneas) ancho y alto
  const dimMat = new THREE.LineBasicMaterial({ color: 0xff7a3d }); disposables.push(dimMat);
  const y0 = box.min.y - 0.15, x0 = box.max.x + 0.25, z = box.max.z;
  const pts = [
    new THREE.Vector3(box.min.x, y0, z), new THREE.Vector3(box.max.x, y0, z),
    new THREE.Vector3(box.min.x, y0 - 0.06, z), new THREE.Vector3(box.min.x, y0 + 0.06, z),
    new THREE.Vector3(box.max.x, y0 - 0.06, z), new THREE.Vector3(box.max.x, y0 + 0.06, z),
    new THREE.Vector3(x0, box.min.y, z), new THREE.Vector3(x0, box.max.y, z),
    new THREE.Vector3(x0 - 0.06, box.min.y, z), new THREE.Vector3(x0 + 0.06, box.min.y, z),
    new THREE.Vector3(x0 - 0.06, box.max.y, z), new THREE.Vector3(x0 + 0.06, box.max.y, z),
  ];
  const dimGeo = new THREE.BufferGeometry().setFromPoints(pts); disposables.push(dimGeo);
  const dims = new THREE.LineSegments(dimGeo, dimMat); group.add(dims);
  // plano de corte visible
  const pg = new THREE.PlaneGeometry(size.z * 1.3, size.y * 1.4); disposables.push(pg);
  const pm = new THREE.LineBasicMaterial({ color: 0xff7a3d, transparent: true, opacity: 0.85 }); disposables.push(pm);
  const pe = new THREE.EdgesGeometry(pg); disposables.push(pe);
  const planeMesh = new THREE.LineSegments(pe, pm); planeMesh.rotation.y = Math.PI / 2; group.add(planeMesh);
  const lw = el(ctx.overlay, 'sc-dim', ''); const lh = el(ctx.overlay, 'sc-dim', '');
  const fmt = (u: number) => mmPerUnit ? `${Math.round((u * mmPerUnit) / 5) * 5} mm` : '';
  lw.textContent = `${ctx.lang === 'en' ? 'Width' : 'Ancho'} ≈ ${fmt(size.x)}`;
  lh.textContent = `${ctx.lang === 'en' ? 'Height' : 'Alto'} ≈ ${fmt(size.y)}`;
  el(ctx.overlay, 'sc-note', ctx.lang === 'en' ? 'Scale: 500 mm wheelbase (Holybro X500)' : 'Escala: 500 mm entre ejes (Holybro X500)');
  return {
    group, interactive: true, fitMargin: 1.35,
    dispose: () => { disposables.forEach((d) => d.dispose()); ctx.renderer.localClippingEnabled = false; },
    update: (_dt, t) => {
      const k = 0.5 + 0.5 * Math.sin(t * 0.7);
      const x = box.min.x + (box.max.x - box.min.x) * (0.35 + 0.65 * k);
      group.updateMatrixWorld(true);
      // el plano se define en espacio del grupo (gira con el modelo)
      const local = new THREE.Plane(new THREE.Vector3(-1, 0, 0), x);
      plane.copy(local).applyMatrix4(group.matrixWorld);
      planeMesh.position.set(x, (box.min.y + box.max.y) / 2, (box.min.z + box.max.z) / 2);
      const { w, h } = ctx.size();
      const pw = project(new THREE.Vector3((box.min.x + box.max.x) / 2, y0 - 0.12, z).applyMatrix4(group.matrixWorld), ctx.camera, w, h);
      const ph = project(new THREE.Vector3(x0 + 0.1, (box.min.y + box.max.y) / 2, z).applyMatrix4(group.matrixWorld), ctx.camera, w, h);
      lw.style.transform = `translate(${pw.x}px, ${pw.y}px) translate(-50%, 0)`;
      lh.style.transform = `translate(${ph.x}px, ${ph.y}px) translate(6px, -50%)`;
    },
  };
}

// ─── minijuego (vista superior) ───
async function buildGame(ctx: Ctx): Promise<Built> {
  const group = new THREE.Group();
  const drone = await droneFor('variado');
  const holder = new THREE.Group(); holder.add(drone); drone.scale.multiplyScalar(0.8);
  group.add(holder);
  const { w, h } = ctx.size();
  const viewH = 7, aspect = w / h, viewW = viewH * aspect;
  const cam = new THREE.OrthographicCamera(-viewW / 2, viewW / 2, viewH / 2, -viewH / 2, 0.1, 50);
  cam.position.set(0, 20, 0); cam.up.set(0, 0, -1); cam.lookAt(0, 0, 0);
  const disposables: { dispose: () => void }[] = [];
  const coinGeo = new THREE.TorusGeometry(0.36, 0.13, 12, 28); const coinMat = new THREE.MeshStandardMaterial({ color: 0xff7a3d, emissive: 0xb8410f, emissiveIntensity: 0.9, metalness: 0.4, roughness: 0.3 });
  const rockGeo = new THREE.IcosahedronGeometry(0.5, 0); const rockMat = new THREE.MeshStandardMaterial({ color: 0x8b95a3, emissive: 0x2a2f38, roughness: 0.7, flatShading: true });
  disposables.push(coinGeo, coinMat, rockGeo, rockMat);
  // suelo con retícula para dar sensación de avance
  const grid = new THREE.GridHelper(40, 40, 0x2b3038, 0x1c2026); (grid.material as THREE.Material).transparent = true; (grid.material as THREE.Material).opacity = 0.6;
  grid.position.y = -1.2; group.add(grid); disposables.push(grid.geometry, grid.material as THREE.Material);

  type Obj = { m: THREE.Mesh; coin: boolean; v: number };
  const objs: Obj[] = [];
  let score = 0, lives = 3, playing = false, over = false, spawnT = 0, speed = 2.6, best = 0;
  const target = new THREE.Vector3();
  const hud = el(ctx.overlay, 'sc-hud');
  const screen = el(ctx.overlay, 'sc-game-screen');
  const L = ctx.lang === 'en'
    ? { start: 'Click to play', how: 'Move the drone with your mouse or finger. Catch the orange parts (+10), dodge the rocks (−1 life).', over: 'Game over', again: 'Click to play again', pts: 'pts', best: 'best' }
    : { start: 'Clic para jugar', how: 'Mueve el dron con el ratón o el dedo. Atrapa las piezas naranjas (+10) y esquiva las rocas (−1 vida).', over: 'Fin del juego', again: 'Clic para jugar otra vez', pts: 'pts', best: 'récord' };
  const showScreen = (title: string, sub: string) => { screen.innerHTML = `<strong>${title}</strong><span>${sub}</span>`; screen.style.display = 'flex'; };
  const renderHud = () => { hud.innerHTML = `<b>${score}</b> ${L.pts} · ${'♥'.repeat(lives)}<em>${'♥'.repeat(3 - lives)}</em>${best ? ` · ${L.best} ${best}` : ''}`; };
  showScreen(L.start, L.how); renderHud();
  const start = () => {
    for (const o of objs) group.remove(o.m); objs.length = 0;
    score = 0; lives = 3; speed = 2.6; over = false; playing = true; screen.style.display = 'none'; renderHud();
    ctx.canvas.style.cursor = 'none'; ctx.canvas.style.touchAction = 'none';
  };
  screen.addEventListener('click', start);
  const onMove = (e: PointerEvent) => {
    const r = ctx.canvas.getBoundingClientRect();
    target.set(((e.clientX - r.left) / r.width - 0.5) * viewW, 0, ((e.clientY - r.top) / r.height - 0.5) * viewH);
    target.x = Math.max(-viewW / 2 + 0.8, Math.min(viewW / 2 - 0.8, target.x));
    target.z = Math.max(-viewH / 2 + 0.8, Math.min(viewH / 2 - 0.8, target.z));
  };
  ctx.canvas.addEventListener('pointermove', onMove);
  ctx.canvas.addEventListener('pointerdown', onMove);
  let lastX = 0;
  return {
    group, camera: cam, interactive: false,
    dispose: () => {
      disposables.forEach((d) => d.dispose());
      ctx.canvas.removeEventListener('pointermove', onMove); ctx.canvas.removeEventListener('pointerdown', onMove);
      ctx.canvas.style.cursor = ''; ctx.canvas.style.touchAction = '';
    },
    update: (dt, t) => {
      grid.position.z = (t * speed) % 1;
      holder.position.lerp(playing ? target : new THREE.Vector3(Math.sin(t) * 1.5, 0, 1.5), Math.min(1, dt * 8));
      const vx = (holder.position.x - lastX) / Math.max(dt, 1e-3); lastX = holder.position.x;
      holder.rotation.z = THREE.MathUtils.clamp(-vx * 0.04, -0.4, 0.4);
      if (!playing) return;
      spawnT -= dt;
      if (spawnT <= 0) {
        const coin = Math.random() < 0.55;
        const m = new THREE.Mesh(coin ? coinGeo : rockGeo, coin ? coinMat : rockMat);
        m.position.set((Math.random() - 0.5) * (viewW - 1.6), 0, -viewH / 2 - 0.6);
        group.add(m); objs.push({ m, coin, v: speed * (0.8 + Math.random() * 0.5) });
        spawnT = Math.max(0.35, 0.9 - score / 600);
      }
      speed = Math.min(6, speed + dt * 0.05);
      for (let i = objs.length - 1; i >= 0; i--) {
        const o = objs[i];
        o.m.position.z += o.v * dt;
        o.m.rotation.x += dt * 2; o.m.rotation.y += dt * 1.4;
        const hit = Math.hypot(o.m.position.x - holder.position.x, o.m.position.z - holder.position.z) < (o.coin ? 0.75 : 0.7);
        if (hit || o.m.position.z > viewH / 2 + 1) {
          group.remove(o.m); objs.splice(i, 1);
          if (hit) { if (o.coin) score += 10; else lives -= 1; renderHud(); }
        }
      }
      if (lives <= 0 && !over) {
        over = true; playing = false; best = Math.max(best, score);
        ctx.canvas.style.cursor = ''; ctx.canvas.style.touchAction = '';
        showScreen(`${L.over}: ${score} ${L.pts}`, L.again); renderHud();
      }
    },
  };
}

export function ShowcaseScene({ kind, selected, hovered, lang = 'es', height = 320 }: {
  kind: ShowcaseKind; selected?: string; hovered?: string | null; lang?: Lang; height?: number;
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<{ set: (key: string) => void } | null>(null);

  const sceneKey = useMemo(() => {
    const picked = String(selected ?? '').split(',').filter(Boolean);
    if (kind === 'interaction') {
      const ids = hovered ? [hovered] : picked.length ? picked : ['rotar'];
      const order = ['hotspots', 'configurar', 'desarmar'];
      const f = order.filter((o) => ids.includes(o));
      return f.length ? f.join('+') : 'rotar';
    }
    // tipo de app (una sola opción): manda la ELEGIDA; el hover solo previsualiza si aún no hay elección
    // (si no, al llevar el ratón al canvas para jugar se cambiaría de escena)
    return picked[0] ?? hovered ?? 'configurador';
  }, [kind, selected, hovered]);

  useEffect(() => {
    const mount = mountRef.current!, overlay = overlayRef.current!;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env; scene.environmentIntensity = 1.1;
    scene.add(new THREE.HemisphereLight(0xffffff, 0x2a2f38, 0.9));
    const key = new THREE.DirectionalLight(0xffffff, 2.8); key.position.set(-3, 5, 4); scene.add(key);
    const rim = new THREE.DirectionalLight(0xffb58a, 1.4); rim.position.set(3, 2.5, -4); scene.add(rim);
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
    camera.position.set(0, 1.6, 6.2); camera.lookAt(0, 0, 0);
    const size = () => ({ w: mount.clientWidth || 600, h: height });
    const resize = () => { const { w, h } = size(); renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); };
    resize();
    const ro = new ResizeObserver(resize); ro.observe(mount);

    let current: Built | null = null;
    let token = { cancelled: false };
    let yaw = 0.5, dragging = false, lastX = 0, autoT = 0;
    const onDown = (e: PointerEvent) => { if (!current?.interactive) return; dragging = true; lastX = e.clientX; };
    const onMoveDrag = (e: PointerEvent) => { if (!dragging) return; yaw += (e.clientX - lastX) * 0.01; lastX = e.clientX; autoT = performance.now() + 2500; };
    const onUp = () => { dragging = false; };
    renderer.domElement.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMoveDrag);
    window.addEventListener('pointerup', onUp);

    /** Encuadre por esfera envolvente (vale para cualquier ángulo de giro). */
    const fitCamera = (obj: THREE.Object3D, margin: number) => {
      obj.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(obj);
      const c = box.getCenter(new THREE.Vector3()), sz = box.getSize(new THREE.Vector3());
      const { w, h } = size();
      const vf = THREE.MathUtils.degToRad(camera.fov);
      const hf = 2 * Math.atan(Math.tan(vf / 2) * (w / h));
      // horizontal: radio en XZ (el modelo gira); vertical: alto real + inclinación de cámara
      const rH = Math.hypot(sz.x, sz.z) / 2;
      const dist = Math.max(rH / Math.tan(hf / 2), (sz.y / 2) / Math.tan(vf / 2) * 1.3) * margin + rH * 0.4;
      const dir = new THREE.Vector3(0, 0.3, 1).normalize();
      camera.position.copy(c).addScaledVector(dir, dist);
      camera.near = Math.max(0.05, dist / 50); camera.far = dist * 10;
      camera.lookAt(c); camera.updateProjectionMatrix();
    };
    const set = (k: string) => {
      token.cancelled = true;
      token = { cancelled: false };
      const my = token;
      if (current) { scene.remove(current.group); current.dispose(); current = null; }
      overlay.replaceChildren();
      const ctx: Ctx = { overlay, renderer, camera, canvas: renderer.domElement, size, lang, signal: my };
      const flags = new Set(k.split('+'));
      const p = kind === 'interaction' ? buildInteraction(ctx, flags)
        : k === 'catalogo' ? buildCatalog(ctx)
        : k === 'herramienta' ? buildTool(ctx)
        : k === 'juego' ? buildGame(ctx)
        : buildInteraction(ctx, new Set(['configurar']));
      p.then((b) => {
        if (my.cancelled) { b.dispose(); return; }
        current = b; scene.add(b.group);
        b.update(0, 0); // coloca el contenido antes de encuadrar
        if (!b.camera) fitCamera(b.group, b.fitMargin ?? (b.interactive ? 1.0 : 1.15));
        overlay.classList.add('ready');
      }).catch(() => { /* sin GLB: el overlay queda vacío */ });
      overlay.classList.remove('ready');
    };
    apiRef.current = { set };

    let raf = 0, visible = true, lastT = performance.now();
    const io = new IntersectionObserver((e) => { visible = e.some((x) => x.isIntersecting); }, { rootMargin: '100px' });
    io.observe(mount);
    const t0 = performance.now();
    const loop = () => {
      raf = requestAnimationFrame(loop);
      if (!visible || document.hidden) return;
      const now = performance.now(); const dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
      const t = (now - t0) / 1000;
      if (current) {
        // escenas orbitables: giro automático + arrastre (catálogo y juego controlan su propia vista)
        if (!current.camera && current.interactive) {
          if (!dragging && now > autoT) yaw += dt * 0.35;
          current.group.rotation.y = yaw;
        }
        current.update(dt, t);
      }
      renderer.render(scene, current?.camera ?? camera);
    };
    loop();
    return () => {
      cancelAnimationFrame(raf); io.disconnect(); ro.disconnect();
      token.cancelled = true;
      if (current) current.dispose();
      renderer.domElement.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMoveDrag); window.removeEventListener('pointerup', onUp);
      env.dispose(); pmrem.dispose(); renderer.dispose();
      mount.replaceChildren();
      apiRef.current = null;
    };
  }, [kind, height, lang]);

  useEffect(() => { apiRef.current?.set(sceneKey); }, [sceneKey, kind, height, lang]);

  return (
    <div style={{ marginBottom: 14 }}>
      <style>{`
        .sc-wrap { position: relative; border-radius: 14px; overflow: hidden; }
        .sc-overlay { position: absolute; inset: 0; pointer-events: none; opacity: 0; transition: opacity .35s; font-family: var(--cx-sans, system-ui); }
        .sc-overlay.ready { opacity: 1; }
        .sc-overlay button, .sc-spot, .sc-game-screen { pointer-events: auto; }
        .sc-spot { position: absolute; left: 0; top: 0; cursor: pointer; transition: opacity .2s; }
        .sc-spot i { position: absolute; left: -7px; top: -7px; width: 14px; height: 14px; border-radius: 50%; background: var(--cx-accent); box-shadow: 0 0 0 4px var(--cx-accent-soft); }
        .sc-spot.on i { animation: sc-pulse 1.2s infinite; }
        .sc-spot span { position: absolute; left: 12px; top: -12px; white-space: nowrap; font: 600 11.5px var(--cx-sans, system-ui); padding: 4px 8px; border-radius: 7px;
          background: var(--cx-card-solid); color: var(--cx-text); border: 1px solid var(--cx-accent-border); opacity: 0; transform: translateX(-4px); transition: opacity .25s, transform .25s; }
        .sc-spot.on span, .sc-spot:hover span { opacity: 1; transform: none; }
        @keyframes sc-pulse { 0%, 100% { box-shadow: 0 0 0 4px var(--cx-accent-soft); } 50% { box-shadow: 0 0 0 10px transparent; } }
        .sc-swatches { position: absolute; left: 50%; bottom: 10px; transform: translateX(-50%); display: flex; gap: 6px; }
        .sc-swatch { display: inline-flex; align-items: center; gap: 4px; font: 600 11px var(--cx-sans, system-ui); padding: 5px 9px; border-radius: 999px; cursor: pointer;
          background: var(--cx-card-solid); color: var(--cx-muted); border: 1px solid var(--cx-border-strong); transition: border-color .2s, color .2s; }
        .sc-swatch i { width: 10px; height: 10px; border-radius: 50%; border: 1px solid rgba(127,127,127,.4); }
        .sc-swatch.on { border-color: var(--cx-accent); color: var(--cx-text); }
        .sc-catalog { position: absolute; left: 50%; bottom: 26px; transform: translateX(-50%); display: flex; align-items: center; gap: 10px; }
        .sc-cat-name { font: 700 14px var(--cx-display, system-ui); color: var(--cx-text); min-width: 120px; text-align: center; }
        .sc-cat-btn { width: 30px; height: 30px; border-radius: 50%; cursor: pointer; font: 600 18px/1 system-ui; color: var(--cx-text); background: var(--cx-card-solid); border: 1px solid var(--cx-border-strong); }
        .sc-cat-dots { position: absolute; left: 50%; bottom: 10px; transform: translateX(-50%); display: flex; gap: 5px; }
        .sc-cat-dots i { width: 6px; height: 6px; border-radius: 50%; background: var(--cx-border-strong); transition: background .2s, width .2s; }
        .sc-cat-dots i.on { background: var(--cx-accent); width: 16px; border-radius: 3px; }
        .sc-dim { position: absolute; left: 0; top: 0; font: 600 11px var(--cx-mono, monospace); color: var(--cx-accent); background: var(--cx-card-solid); padding: 2px 6px; border-radius: 5px; white-space: nowrap; }
        .sc-note { position: absolute; left: 10px; top: 8px; font: 500 10.5px var(--cx-mono, monospace); color: var(--cx-faint); }
        .sc-hud { position: absolute; left: 10px; top: 8px; font: 600 13px var(--cx-mono, monospace); color: var(--cx-text); background: var(--cx-card-solid); padding: 4px 9px; border-radius: 8px; }
        .sc-hud b { color: var(--cx-accent); } .sc-hud em { font-style: normal; opacity: .25; }
        .sc-game-screen { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; cursor: pointer; text-align: center; padding: 0 24px;
          background: color-mix(in srgb, var(--cx-bg) 55%, transparent); backdrop-filter: blur(2px); }
        .sc-game-screen strong { font: 700 20px var(--cx-display, system-ui); color: var(--cx-accent); }
        .sc-game-screen span { font-size: 12.5px; color: var(--cx-muted); max-width: 360px; }
      `}</style>
      <div className="sc-wrap">
        <div ref={mountRef} style={{ width: '100%', height }} />
        <div ref={overlayRef} className="sc-overlay" />
      </div>
      <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--cx-muted)', marginTop: 4 }} aria-live="polite">{showcaseCaption(kind, sceneKey, lang)}</div>
    </div>
  );
}
