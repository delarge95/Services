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
import { fetchTop, submitScore } from '../../lib/services/leaderboard';
import type { LbState } from '../../lib/services/leaderboard';

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
    juego: 'Minijuego: mueve el dron, atrapa anillos y esquiva rocas',
  };
  const en: Record<string, string> = {
    rotar: '360° view: drag to rotate the model', hotspots: 'Tap an orange point to see the part name',
    configurar: 'Pick a finish: the model updates live', desarmar: 'Exploded view: every part separates and returns',
    configurador: 'Configurator: the customer picks finishes and sees the result', catalogo: 'Catalog: several browsable 3D products',
    herramienta: 'Technical tool: live section, edges and real measurements', juego: 'Mini-game: steer the drone, catch rings, dodge rocks',
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

/**
 * Ciclo 29 — rotores que giran. Las hélices del GLB tienen la geometría "horneada"
 * (position ≈ 0), así que rotar la malla la haría orbitar el origen. Se agrupan por
 * cuadrante (una hélice por brazo), se crea un pivote en el centro de cada grupo y se
 * re-parentan las mallas manteniendo su transformación; el giro es alrededor del eje
 * vertical del dron expresado en el espacio del padre. Disco translúcido = desenfoque.
 */
function makeRotors(drone: THREE.Object3D, disposables: { dispose: () => void }[]) {
  drone.updateMatrixWorld(true);
  const groups = new Map<number, THREE.Mesh[]>();
  const droneInv = new THREE.Matrix4().copy(drone.matrixWorld).invert();
  drone.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || stepOf(m) !== 1) return;
    const g = m.geometry; if (!g.boundingBox) g.computeBoundingBox();
    const c = g.boundingBox!.getCenter(new THREE.Vector3()).applyMatrix4(m.matrixWorld).applyMatrix4(droneInv);
    const q = (c.x >= 0 ? 1 : 0) + (c.z >= 0 ? 2 : 0);
    (groups.get(q) ?? groups.set(q, []).get(q)!).push(m);
  });
  const rotors: { pivot: THREE.Object3D; axis: THREE.Vector3; dir: number; disc: THREE.Mesh }[] = [];
  const discGeo = new THREE.CircleGeometry(1, 40);
  const discMat = new THREE.MeshBasicMaterial({ color: 0xc9ced6, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
  disposables.push(discGeo, discMat);
  let i = 0;
  for (const meshes of groups.values()) {
    const parent = meshes[0].parent ?? drone;
    const box = new THREE.Box3();
    for (const m of meshes) box.union(new THREE.Box3().setFromObject(m));
    const cW = box.getCenter(new THREE.Vector3());
    const radius = Math.max(box.getSize(new THREE.Vector3()).x, box.getSize(new THREE.Vector3()).z) / 2;
    const pivot = new THREE.Group();
    parent.add(pivot);
    pivot.position.copy(parent.worldToLocal(cW.clone()));
    pivot.updateMatrixWorld(true);
    for (const m of meshes) pivot.attach(m); // conserva la transformación en mundo
    const upW = new THREE.Vector3(0, 1, 0).transformDirection(drone.matrixWorld);
    const a0 = parent.worldToLocal(cW.clone()), a1 = parent.worldToLocal(cW.clone().add(upW));
    const axis = a1.sub(a0).normalize();
    // disco de desenfoque en mundo: hijo del dron, plano horizontal
    const disc = new THREE.Mesh(discGeo, discMat);
    const dLocal = drone.worldToLocal(cW.clone());
    disc.position.copy(dLocal);
    disc.rotation.x = -Math.PI / 2;
    const sc = radius / drone.getWorldScale(new THREE.Vector3()).x;
    disc.scale.setScalar(sc);
    drone.add(disc);
    rotors.push({ pivot, axis, dir: i++ % 2 ? 1 : -1, disc });
  }
  return {
    /** speed en rad/s; blur 0..1 hace visible el disco. */
    spin(dt: number, speed: number, blur: number) {
      for (const r of rotors) r.pivot.rotateOnAxis(r.axis, r.dir * speed * dt);
      discMat.opacity = 0.16 * blur;
    },
  };
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
  // Ciclo 29 — paletas CURADAS: 2 tonos + material. Marco (carbono/pintura) + metal de
  // soportes + hélices; contrastes de valor claros y metales cálidos/fríos coherentes.
  type Way = { name: string; en: string; frame: number; frameRough: number; frameCoat: number; mount: number; mountRough: number; props: number };
  const WAYS: Way[] = [
    { name: 'Grafito y cobre', en: 'Graphite & copper', frame: 0x1c1e22, frameRough: 0.36, frameCoat: 1, mount: 0xb87333, mountRough: 0.32, props: 0x2a2c30 },
    { name: 'Titanio', en: 'Titanium', frame: 0x5c6168, frameRough: 0.5, frameCoat: 0.2, mount: 0xc9ccd1, mountRough: 0.24, props: 0x1f2124 },
    { name: 'Hueso y ascua', en: 'Bone & ember', frame: 0xe6e1d8, frameRough: 0.55, frameCoat: 0.3, mount: 0xd9581c, mountRough: 0.4, props: 0x3a3c40 },
    { name: 'Azul noche y latón', en: 'Midnight & brass', frame: 0x1b2533, frameRough: 0.4, frameCoat: 0.8, mount: 0xb89a5a, mountRough: 0.3, props: 0xd9d6cf },
    { name: 'Bosque y plata', en: 'Forest & silver', frame: 0x23312a, frameRough: 0.6, frameCoat: 0.1, mount: 0xb4b8be, mountRough: 0.28, props: 0x1c1e20 },
  ];
  let way = 0, wayHold = 0;
  const frameMat = new THREE.MeshPhysicalMaterial({ color: WAYS[0].frame, roughness: WAYS[0].frameRough, metalness: 0.1, clearcoat: WAYS[0].frameCoat, clearcoatRoughness: 0.12 });
  const mountMat = new THREE.MeshStandardMaterial({ color: WAYS[0].mount, roughness: WAYS[0].mountRough, metalness: 1 });
  const propMat = new THREE.MeshStandardMaterial({ color: WAYS[0].props, roughness: 0.5, metalness: 0 });
  // batería = acento de la paleta en acabado mate (no metálico): las 5 paletas son de 2 tonos + neutros
  const accentMat = new THREE.MeshStandardMaterial({ color: WAYS[0].mount, roughness: 0.6, metalness: 0 });
  disposables.push(frameMat, mountMat, propMat, accentMat);
  let swatchBar: HTMLDivElement | null = null;
  if (configure) {
    drone.traverse((o) => {
      const m = o as THREE.Mesh; if (!m.isMesh) return;
      const n = meshEffectiveName(m); const s = stepOf(m);
      if (/HMX5V-DIGAI|DIANJIZUO/i.test(n)) m.material = mountMat;
      else if (s >= 2 && s <= 4) m.material = frameMat;
      else if (s === 1) m.material = propMat;
      else if (s === 7) m.material = accentMat;
    });
    swatchBar = el(ctx.overlay, 'sc-swatches');
    WAYS.forEach((w, i) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'sc-swatch'; b.title = ctx.lang === 'en' ? w.en : w.name;
      const hx = (c: number) => `#${c.toString(16).padStart(6, '0')}`;
      b.innerHTML = `<i style="background:${hx(w.frame)}"></i><i style="background:linear-gradient(135deg, ${hx(w.mount)}, #fff8 60%, ${hx(w.mount)})"></i><span>${ctx.lang === 'en' ? w.en : w.name}</span>`;
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
        if (performance.now() > wayHold && t - lastSwitch > 2.6) { way = (way + 1) % WAYS.length; lastSwitch = t; }
        const W = WAYS[way];
        frameMat.color.lerp(cTmp.setHex(W.frame), 0.08);
        frameMat.roughness += (W.frameRough - frameMat.roughness) * 0.08;
        frameMat.clearcoat += (W.frameCoat - frameMat.clearcoat) * 0.08;
        mountMat.color.lerp(cTmp.setHex(W.mount), 0.08);
        mountMat.roughness += (W.mountRough - mountMat.roughness) * 0.08;
        propMat.color.lerp(cTmp.setHex(W.props), 0.08);
        accentMat.color.lerp(cTmp.setHex(W.mount), 0.08);
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
  // ciclo 32: catálogo INTERACTIVO — arrastrar gira el producto, tocar uno lateral lo trae al frente,
  // flechas/teclado y variantes reales por producto (acabados, nivel de detalle, despiece).
  const group = new THREE.Group();
  const en = ctx.lang === 'en';
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
  let explode = 0, explodeTo = 0;
  type Variant = { es: string; en: string; apply: () => void };
  type Item = { o: THREE.Group; tag: [string, string]; es: string; en: string; desc: [string, string]; variants: Variant[]; vi: number; yaw: number };
  const items: Item[] = [
    { o: fit(drone), tag: ['Ensamblaje técnico', 'Technical assembly'], es: 'Dron Holybro X500', en: 'Holybro X500 drone',
      desc: ['Cada pieza con su material: carbono, aluminio, goma.', 'Every part with its own material: carbon, aluminum, rubber.'],
      variants: [
        { es: 'Variado', en: 'Mixed', apply: () => applyFinish(drone, 'variado') },
        { es: 'Simple', en: 'Simple', apply: () => applyFinish(drone, 'simple') },
        { es: 'Detallado', en: 'Detailed', apply: () => applyFinish(drone, 'detallado') },
      ], vi: 0, yaw: 0 },
    { o: fit(anvil, 1.9), tag: ['Pieza única', 'Single piece'], es: 'Yunque de forja', en: 'Forge anvil',
      desc: ['Tres niveles de detalle de la misma malla, sin cambiar de archivo.', 'Three detail levels of the same mesh, without swapping files.'],
      variants: [
        { es: 'Completo', en: 'Full', apply: () => applySurfaceMorph(anvil, 5) },
        { es: 'Medio', en: 'Medium', apply: () => applySurfaceMorph(anvil, 3) },
        { es: 'Básico', en: 'Basic', apply: () => applySurfaceMorph(anvil, 1) },
      ], vi: 0, yaw: 0 },
    { o: fit(turb.root, 2.0), tag: ['Mecanismo', 'Mechanism'], es: 'Turbina', en: 'Turbine',
      desc: ['Despiece axial animado para ver cómo encaja cada etapa.', 'Animated axial exploded view to see how each stage fits.'],
      variants: [
        { es: 'Ensamblada', en: 'Assembled', apply: () => { explodeTo = 0; } },
        { es: 'Despiece', en: 'Exploded', apply: () => { explodeTo = 1; } },
      ], vi: 0, yaw: 0 },
  ];
  const R = 2.6;
  items.forEach((it) => group.add(it.o));
  let idx = 0, pos = 0, touched = false, lastAuto = 0;
  // ── interfaz ──
  const card = el(ctx.overlay, 'sc-cat-card');
  const vbar = el(ctx.overlay, 'sc-cat-variants');
  const bar = el(ctx.overlay, 'sc-catalog');
  const name = el(bar, 'sc-cat-name');
  const mk = (txt: string, label: string) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'sc-cat-btn'; b.textContent = txt; b.setAttribute('aria-label', label); return b; };
  const prev = mk('‹', en ? 'Previous product' : 'Producto anterior'), next = mk('›', en ? 'Next product' : 'Producto siguiente');
  bar.prepend(prev); bar.appendChild(next);
  const dots = el(ctx.overlay, 'sc-cat-dots', items.map((_, i) => `<button type="button" aria-label="${i + 1}"></button>`).join(''));
  const hint = el(ctx.overlay, 'sc-cat-hint', en ? 'Drag to rotate · tap a product' : 'Arrastra para girar · toca un producto');
  const render = () => {
    const it = items[idx];
    name.textContent = en ? it.en : it.es;
    card.innerHTML = `<small>${en ? it.tag[1] : it.tag[0]}</small><b>${en ? it.en : it.es}</b><span>${en ? it.desc[1] : it.desc[0]}</span>`;
    vbar.innerHTML = it.variants.map((v, k) => `<button type="button" data-v="${k}" aria-pressed="${k === it.vi}">${en ? v.en : v.es}</button>`).join('');
    [...dots.children].forEach((c, i) => { c.classList.toggle('on', i === idx); c.setAttribute('aria-current', String(i === idx)); });
  };
  const select = (k: number) => { idx = (k + items.length) % items.length; touched = true; hint.classList.add('off'); render(); };
  prev.addEventListener('click', () => select(idx - 1));
  next.addEventListener('click', () => select(idx + 1));
  [...dots.children].forEach((c, i) => c.addEventListener('click', () => select(i)));
  vbar.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest('button[data-v]') as HTMLButtonElement | null; if (!b) return;
    const it = items[idx]; it.vi = Number(b.dataset.v); it.variants[it.vi].apply(); touched = true; hint.classList.add('off'); render();
  });
  // arrastre (gira el producto del frente) y toque (selecciona el producto tocado)
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  let down = false, moved = 0, lastX = 0, vel = 0;
  const toNdc = (e: PointerEvent) => { const r = ctx.canvas.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, ctx.camera); };
  const onDown = (e: PointerEvent) => { down = true; moved = 0; lastX = e.clientX; vel = 0; };
  const onMove = (e: PointerEvent) => {
    if (down) {
      const dx = e.clientX - lastX; lastX = e.clientX; moved += Math.abs(dx); vel = dx * 0.012; items[idx].yaw += vel;
      if (moved > 4) { touched = true; hint.classList.add('off'); }
      return;
    }
    if (e.target !== ctx.canvas) return;
    toNdc(e); ctx.canvas.style.cursor = ray.intersectObject(group, true).length ? 'grab' : 'default';
  };
  const onUp = (e: PointerEvent) => {
    if (!down) return; down = false;
    if (moved > 5 || e.target !== ctx.canvas) return;
    toNdc(e);
    const hit = ray.intersectObject(group, true)[0];
    if (!hit) return;
    const k = items.findIndex((it) => { let o: THREE.Object3D | null = hit.object; while (o) { if (o === it.o) return true; o = o.parent; } return false; });
    if (k >= 0 && k !== idx) select(k);
  };
  const onKey = (e: KeyboardEvent) => { if (e.key === 'ArrowRight') { e.preventDefault(); select(idx + 1); } if (e.key === 'ArrowLeft') { e.preventDefault(); select(idx - 1); } };
  ctx.canvas.tabIndex = 0;
  ctx.canvas.setAttribute('aria-label', en ? '3D catalog: use the arrows to change product' : 'Catálogo 3D: usa las flechas para cambiar de producto');
  ctx.canvas.addEventListener('pointerdown', onDown); window.addEventListener('pointermove', onMove); window.addEventListener('pointerup', onUp);
  ctx.canvas.addEventListener('keydown', onKey);
  ctx.canvas.style.touchAction = 'pan-y';
  render();
  return {
    group, interactive: false,
    dispose: () => {
      ctx.canvas.removeEventListener('pointerdown', onDown); window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp);
      ctx.canvas.removeEventListener('keydown', onKey); ctx.canvas.style.cursor = ''; ctx.canvas.style.touchAction = ''; ctx.canvas.removeAttribute('tabindex');
    },
    update: (dt, t) => {
      // avanza solo mientras nadie ha tocado el catálogo
      if (!touched && t - lastAuto > 4.5) { if (lastAuto > 0) { idx = (idx + 1) % items.length; render(); } lastAuto = t; }
      const n = items.length;
      let d = idx - pos; d = ((d % n) + n + n / 2) % n - n / 2;
      pos += d * Math.min(1, dt * 4);
      explode += (explodeTo - explode) * Math.min(1, dt * 3); turb.applyExplode(explode);
      if (!down) vel *= 0.92;
      items.forEach((it, i) => {
        let k = i - pos; k = ((k % n) + n + n / 2) % n - n / 2;   // −n/2..n/2, 0 = al frente
        const a = (k / n) * Math.PI * 2;
        it.o.position.set(Math.sin(a) * R, 0, Math.cos(a) * R - R);
        const front = Math.max(0, 1 - Math.abs(k));
        it.o.scale.setScalar(0.5 + 0.5 * front);
        if (i === idx) { if (!down) it.yaw += vel + dt * (touched ? 0.12 : 0.35); }
        else it.yaw += dt * 0.15;
        it.o.children[0].rotation.y = it.yaw;
      });
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
// Ciclo 44: progresión por NIVELES de proyecto (S → M → L → XL, como las tallas del cotizador), obstáculos con
// comportamientos distintos, HERRAMIENTAS que se recogen (láser de inspección, abanico, pulso, escudo QA, imán),
// combos, pantalla completa y cierre con llamada a cotizar un juego así. Todo puntúa en múltiplos de 10.
type GKind = 'coin' | 'rock' | 'zig' | 'heavy' | 'gate' | 'dart' | 'tool';
type ToolId = 'laser' | 'fan' | 'pulse' | 'shield' | 'magnet';
const TOOL_COLOR: Record<ToolId, number> = { laser: 0x5ac8fa, fan: 0xa78bfa, pulse: 0xffd166, shield: 0x34d399, magnet: 0xf472b6 };
// ciclo 44c: cada nivel aleja un poco la cámara (view = alto visible) y acelera; en XL la velocidad y la frecuencia
// siguen subiendo SIN techo, de modo que casi nadie pase de ~3–4 min de partida
const LEVELS = [
  { at: 0, speed: 2.8, every: 0.8, view: 7, mix: { coin: 0.55, rock: 0.45 } },
  { at: 20, speed: 3.6, every: 0.66, view: 7.8, mix: { coin: 0.45, rock: 0.25, zig: 0.2, tool: 0.1 } },
  { at: 45, speed: 4.5, every: 0.54, view: 8.6, mix: { coin: 0.4, rock: 0.15, zig: 0.15, heavy: 0.1, gate: 0.1, tool: 0.1 } },
  { at: 75, speed: 5.8, every: 0.44, view: 9.6, mix: { coin: 0.35, rock: 0.12, zig: 0.15, heavy: 0.1, gate: 0.1, dart: 0.1, tool: 0.08 } },
] as const;
const XL_ACCEL = 0.09;   // +0,09 de velocidad por segundo en XL, constante y sin techo

async function buildGame(ctx: Ctx): Promise<Built> {
  const group = new THREE.Group();
  const drone = await droneFor('variado');
  const holder = new THREE.Group(); holder.add(drone); drone.scale.multiplyScalar(0.8);
  drone.rotation.y -= Math.PI / 2; // ciclo 31: el morro apunta hacia arriba de la pantalla (antes girado 90°)
  group.add(holder);
  const fxDisposables: { dispose: () => void }[] = [];
  const rotors = makeRotors(drone, fxDisposables);
  let viewH = 7; let viewW = viewH * (ctx.size().w / ctx.size().h), lastAspect = 0;
  const cam = new THREE.OrthographicCamera(-viewW / 2, viewW / 2, viewH / 2, -viewH / 2, 0.1, 50);
  cam.position.set(0, 20, 0); cam.up.set(0, 0, -1); cam.lookAt(0, 0, 0);
  const disposables: { dispose: () => void }[] = [];
  const std = (color: number, emissive: number, o: Partial<THREE.MeshStandardMaterialParameters> = {}) => new THREE.MeshStandardMaterial({ color, emissive, roughness: 0.6, flatShading: true, ...o });
  const coinGeo = new THREE.TorusGeometry(0.36, 0.13, 12, 28); const coinMat = new THREE.MeshStandardMaterial({ color: 0xff7a3d, emissive: 0xb8410f, emissiveIntensity: 0.9, metalness: 0.4, roughness: 0.3 });
  // ciclo 44b/c: ROJO = daño (púas o franjas de peligro); lo que se recoge brilla (anillos naranjas, insignias de herramienta)
  const spiky = (r: number, n: number) => {   // núcleo + púas: silueta de «peligro» legible desde arriba
    const core = new THREE.IcosahedronGeometry(r, 0), parts: THREE.BufferGeometry[] = [core.toNonIndexed()];
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2, c = new THREE.ConeGeometry(r * 0.32, r * 0.75, 5);
      c.rotateZ(-Math.PI / 2); c.translate(r * 1.15, 0, 0); c.rotateY(a); parts.push(c.toNonIndexed());
    }
    const pos: number[] = []; parts.forEach((g) => { pos.push(...(g.getAttribute('position').array as Float32Array)); g.dispose(); });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals(); return g;
  };
  const stripes = (() => {   // franjas de peligro rojo/negro para los muros
    const cv = document.createElement('canvas'); cv.width = 64; cv.height = 64; const g2 = cv.getContext('2d')!;
    g2.fillStyle = '#1a0c0c'; g2.fillRect(0, 0, 64, 64); g2.fillStyle = '#ff3b30';
    for (let k = -64; k < 128; k += 32) { g2.beginPath(); g2.moveTo(k, 0); g2.lineTo(k + 16, 0); g2.lineTo(k - 48, 64); g2.lineTo(k - 64, 64); g2.closePath(); g2.fill(); }
    const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace; tx.wrapS = tx.wrapT = THREE.RepeatWrapping; return tx;
  })();
  const rockGeo = spiky(0.36, 6); const rockMat = std(0xe0352b, 0x5c0d08, { roughness: 0.55 });
  const zigGeo = spiky(0.3, 8); const zigMat = std(0xff4f8b, 0x6b0f2e, { roughness: 0.45 });
  const heavyGeo = spiky(0.6, 7); const heavyMat = std(0x9e1b14, 0x3a0705, { roughness: 0.7 });
  const gateGeo = new THREE.BoxGeometry(0.95, 0.5, 0.55); const gateMat = new THREE.MeshStandardMaterial({ map: stripes, emissive: 0x3a0705, roughness: 0.6 });
  const dartGeo = new THREE.ConeGeometry(0.22, 0.9, 6); const dartMat = std(0xff3b30, 0x7a120c);
  // iconos de herramientas: insignia redonda (vista desde arriba) con el símbolo de la herramienta
  const TOOL_GLYPH: Record<ToolId, string> = { laser: '⇡', fan: '⋔', pulse: '◎', shield: '⛨', magnet: 'U' };
  const toolTex = Object.fromEntries((Object.keys(TOOL_COLOR) as ToolId[]).map((k) => {
    const cv = document.createElement('canvas'); cv.width = cv.height = 128; const g2 = cv.getContext('2d')!;
    const hex = `#${TOOL_COLOR[k].toString(16).padStart(6, '0')}`;
    g2.fillStyle = '#0b1410'; g2.beginPath(); g2.arc(64, 64, 58, 0, Math.PI * 2); g2.fill();
    g2.lineWidth = 10; g2.strokeStyle = hex; g2.stroke();
    g2.fillStyle = hex; g2.font = '700 70px system-ui, sans-serif'; g2.textAlign = 'center'; g2.textBaseline = 'middle'; g2.fillText(TOOL_GLYPH[k], 64, 70);
    const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace; return [k, tx];
  })) as Record<ToolId, THREE.CanvasTexture>;
  const badgeGeo = new THREE.PlaneGeometry(0.78, 0.78);
  const toolGeo = badgeGeo;
  const toolMats = Object.fromEntries((Object.keys(TOOL_COLOR) as ToolId[]).map((k) => [k, new THREE.MeshBasicMaterial({ map: toolTex[k], transparent: true, depthWrite: false })])) as Record<ToolId, THREE.MeshBasicMaterial>;
  const shotGeo = new THREE.BoxGeometry(0.09, 0.09, 0.42); const shotMat = new THREE.MeshBasicMaterial({ color: 0x9be7ff });
  const warnGeo = new THREE.PlaneGeometry(0.1, 1); const warnMat = new THREE.MeshBasicMaterial({ color: 0xff3b30, transparent: true, opacity: 0.5, depthWrite: false });
  const shieldGeo = new THREE.RingGeometry(0.95, 1.05, 48); const shieldMat = new THREE.MeshBasicMaterial({ color: 0x34d399, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false });
  disposables.push(stripes, ...Object.values(toolTex), coinGeo, coinMat, rockGeo, rockMat, zigGeo, zigMat, heavyGeo, heavyMat, gateGeo, gateMat, dartGeo, dartMat, toolGeo, ...Object.values(toolMats), shotGeo, shotMat, warnGeo, warnMat, shieldGeo, shieldMat);
  dartGeo.rotateX(Math.PI / 2); // la punta mira hacia el dron
  const shieldRing = new THREE.Mesh(shieldGeo, shieldMat); shieldRing.rotation.x = -Math.PI / 2; shieldRing.position.y = 0.2; shieldRing.visible = false; holder.add(shieldRing);
  // suelo con retícula para dar sensación de avance
  const grid = new THREE.GridHelper(80, 80, 0x2b3038, 0x1c2026); (grid.material as THREE.Material).transparent = true; (grid.material as THREE.Material).opacity = 0.6;
  grid.position.y = -1.2; group.add(grid); disposables.push(grid.geometry, grid.material as THREE.Material);

  // ── FX (ciclo 29) ──
  type Particle = { m: THREE.Mesh; v: THREE.Vector3; life: number; max: number; spin: number };
  type RingFx = { m: THREE.Mesh; life: number; max: number; grow: number };
  const particles: Particle[] = [];
  const rings: RingFx[] = [];
  const sparkGeo = new THREE.OctahedronGeometry(0.07, 0);
  const shardGeo = new THREE.TetrahedronGeometry(0.13, 0);
  const ringGeo = new THREE.RingGeometry(0.42, 0.5, 40);
  fxDisposables.push(sparkGeo, shardGeo, ringGeo);
  let shake = 0, flash = 0;
  const floatText = (pos: THREE.Vector3, text: string, cls: string) => {
    const { w: W, h: H } = ctx.size();
    const p = pos.clone().project(cam);
    const d = el(ctx.overlay, `sc-float ${cls}`, text);
    d.style.left = `${(p.x * 0.5 + 0.5) * W}px`; d.style.top = `${(-p.y * 0.5 + 0.5) * H}px`;
    setTimeout(() => d.remove(), 900);
  };
  const ringFx = (pos: THREE.Vector3, color: number, max = 0.45, grow = 2.4) => {
    const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.copy(pos).setY(0.3);
    group.add(ring); rings.push({ m: ring, life: 0, max, grow });
  };
  const burst = (pos: THREE.Vector3, color: number, n: number, shard: boolean) => {
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + Math.random() * 0.4, sp = 1.8 + Math.random() * 3;
      const m = new THREE.Mesh(shard ? shardGeo : sparkGeo, shard ? new THREE.MeshStandardMaterial({ color, roughness: 0.7, flatShading: true, transparent: true }) : new THREE.MeshBasicMaterial({ color, transparent: true }));
      m.position.copy(pos).setY(0.4);
      group.add(m);
      particles.push({ m, v: new THREE.Vector3(Math.cos(a) * sp, 0, Math.sin(a) * sp), life: 0, max: 0.45 + Math.random() * 0.3, spin: 6 + Math.random() * 6 });
    }
  };
  const flashEl = el(ctx.overlay, 'sc-hit-flash');
  const camHome = cam.position.clone();

  type Obj = { m: THREE.Mesh; kind: GKind; v: number; hp: number; r: number; x0: number; ph: number; tool?: ToolId };
  type Shot = { m: THREE.Mesh; vx: number; vz: number };
  type Warn = { m: THREE.Mesh; x: number; t: number };
  const objs: Obj[] = [], shots: Shot[] = [], warns: Warn[] = [];
  let score = 0, lives = 3, playing = false, over = false, spawnT = 0, speed = 2.6, best = 0, elapsed = 0, level = 0;
  let pulsePending = false, toolT = 0;
  let streak = 0, mult = 1, gateCd = 0, fireT = 0, shield = false, weapon: ToolId | null = null, weaponT = 0, magnetT = 0;
  const target = new THREE.Vector3();
  const hud = el(ctx.overlay, 'sc-hud');
  const toolHud = el(ctx.overlay, 'sc-tool');
  const lvlEl = el(ctx.overlay, 'sc-lvl');
  const screen = el(ctx.overlay, 'sc-game-screen');
  const en = ctx.lang === 'en';
  const L = en
    ? { play: '▶ Play', how: 'Steer the drone. Glowing items = grab them. Red = it hurts. Chain rings for combos up to ×3. The project levels up: S → M → L → XL.', over: 'Game over', again: '↻ Play again', pts: 'pts', best: 'best',
        rank: 'Leaderboard', local: 'on this device', global: 'all players', empty: 'No scores yet: be the first.', name: 'Your name', company: 'Team or brand (optional)',
        save: 'Save to the leaderboard', saved: 'Saved', savedLocal: 'Saved on this device', place: 'Position', blocked: 'That name is not allowed.', slow: 'Wait a few seconds and try again.', invalid: 'This score could not be saved.',
        cta: 'A game like this with your product? Get a quote →', grab: 'GRAB', avoid: 'AVOID · red = damage', ringLbl: 'Ring +10',
        haz: ['Spiked rock (−1 ♥)', 'Bug: zigzags', 'Heavy part: 3 laser hits', 'Hazard wall: fly through the gap', 'Dart: warns its lane in red'], reached: 'You reached level', fs: 'Full screen', lvl: 'Level',
        lv: ['Project S · warm-up', 'Project M · bugs and tools appear', 'Project L · walls and heavy parts', 'Project XL · rush delivery'],
        tools: { laser: 'Inspection laser', fan: 'Spread scan', pulse: 'Pulse', shield: 'QA shield', magnet: 'Magnet' } as Record<ToolId, string> }
    : { play: '▶ Jugar', how: 'Mueve el dron. Lo que brilla = recógelo. Rojo = hace daño. Encadena anillos para combos hasta ×3. El proyecto sube de nivel: S → M → L → XL.', over: 'Fin del juego', again: '↻ Jugar otra vez', pts: 'pts', best: 'récord',
        rank: 'Ranking', local: 'en este dispositivo', global: 'todos los jugadores', empty: 'Aún no hay puntajes: sé el primero.', name: 'Tu nombre', company: 'Equipo o marca (opcional)',
        save: 'Guardar en el ranking', saved: 'Guardado', savedLocal: 'Guardado en este dispositivo', place: 'Puesto', blocked: 'Ese nombre no está permitido.', slow: 'Espera unos segundos e inténtalo otra vez.', invalid: 'No se pudo guardar este puntaje.',
        cta: '¿Un juego así con tu producto? Cotízalo →', grab: 'RECOGE', avoid: 'EVITA · rojo = daño', ringLbl: 'Anillo +10',
        haz: ['Roca con púas (−1 ♥)', 'Bug: avanza en zigzag', 'Pieza pesada: 3 disparos', 'Muro de peligro: pasa por el hueco', 'Dardo: avisa su carril en rojo'], reached: 'Llegaste al nivel', fs: 'Pantalla completa', lvl: 'Nivel',
        lv: ['Proyecto S · calentamiento', 'Proyecto M · aparecen bugs y herramientas', 'Proyecto L · muros y piezas pesadas', 'Proyecto XL · entrega urgente'],
        tools: { laser: 'Láser de inspección', fan: 'Escaneo en abanico', pulse: 'Pulso', shield: 'Escudo QA', magnet: 'Imán' } as Record<ToolId, string> };
  const TIERS = ['S', 'M', 'L', 'XL'];
  const esc = (t: string) => t.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
  let lbState: LbState | null = null, startAt = 0;
  const lbHtml = (n: number, hiRank?: number) => {
    const st = lbState;
    const head = `<div class="sc-lb-h"><b>${L.rank}</b><small>Top 10</small></div>`;
    if (!st) return `<div class="sc-lb">${head}</div>`;
    const rows = st.scores.slice(0, n).map((e, k) => `<li class="${hiRank === k + 1 ? 'me' : ''}"><i>${k + 1}</i><span>${esc(e.name)}${e.company ? `<em>${esc(e.company)}</em>` : ''}</span><b>${e.score}</b></li>`).join('');
    return `<div class="sc-lb">${head}${rows ? `<ol>${rows}</ol>` : `<p>${L.empty}</p>`}</div>`;
  };
  const GLYPH: Record<ToolId, string> = { laser: '⇡', fan: '⋔', pulse: '◎', shield: '⛨', magnet: 'U' };
  const hx = (n: number) => `#${n.toString(16).padStart(6, '0')}`;
  const toolLegend = () => `<div class="sc-legend2">
    <div class="good"><b>${L.grab}</b>
      <span><i class="ring"></i>${L.ringLbl}</span>
      ${(Object.keys(TOOL_COLOR) as ToolId[]).map((k) => `<span><i class="badge" style="--c:${hx(TOOL_COLOR[k])}">${GLYPH[k]}</i>${L.tools[k]}</span>`).join('')}</div>
    <div class="bad"><b>${L.avoid}</b>
      ${L.haz.map((h, k) => `<span><i class="haz h${k}"></i>${h}</span>`).join('')}</div></div>`;
  const showStart = () => {
    // ciclo 44b: la portada del juego cabe sin scroll — leyenda completa y el top 3 en una línea (el ranking entero sale al terminar)
    const top3 = lbState?.scores.slice(0, 3).map((e, k) => `<span><i>${k + 1}</i>${esc(e.name)} <b>${e.score}</b></span>`).join('') ?? '';
    screen.innerHTML = `<div class="sc-gs-main"><button type="button" class="sc-gs-play" data-act="play">${L.play}</button><span>${L.how}</span>${toolLegend()}${top3 ? `<div class="sc-top3"><small>${L.rank}</small>${top3}</div>` : ''}</div>`;
    screen.style.display = 'flex';
  };
  const showOver = (finalScore: number, durationMs: number) => {
    const remembered = (() => { try { return JSON.parse(localStorage.getItem('cx-lb-me') ?? '{}') as { name?: string; company?: string }; } catch { return {}; } })();
    const canSave = finalScore >= 10;
    screen.innerHTML = `<div class="sc-gs-main"><strong>${L.over}: ${finalScore} ${L.pts}</strong><small class="sc-gs-lv">${L.reached} ${TIERS[level]}</small>
      ${canSave ? `<form class="sc-lb-form"><input name="name" maxlength="24" required minlength="2" placeholder="${L.name}" value="${esc(remembered.name ?? '')}" aria-label="${L.name}">
      <input name="company" maxlength="32" placeholder="${L.company}" value="${esc(remembered.company ?? '')}" aria-label="${L.company}">
      <button type="submit">${L.save}</button><small class="sc-lb-msg" aria-live="polite"></small></form>` : ''}
      <button type="button" class="sc-gs-play" data-act="play">${L.again}</button>
      <button type="button" class="sc-gs-cta" data-act="quote">${L.cta}</button></div>${lbHtml(10)}`;
    screen.style.display = 'flex';
    const form = screen.querySelector('form') as HTMLFormElement | null;
    form?.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const fd = new FormData(form);
      const name = String(fd.get('name') ?? '').trim(), company = String(fd.get('company') ?? '').trim();
      try { localStorage.setItem('cx-lb-me', JSON.stringify({ name, company })); } catch { /* sin almacenamiento */ }
      const btn = form.querySelector('button') as HTMLButtonElement; btn.disabled = true;
      const res = await submitScore({ name, company: company || undefined, score: finalScore, durationMs });
      lbState = res;
      const msg = res.error === 'blocked' ? L.blocked : res.error === 'slow down' ? L.slow : res.error ? L.invalid : `${res.mode === 'global' ? L.saved : L.savedLocal} · ${L.place} #${res.rank}`;
      const lb = screen.querySelector('.sc-lb'); if (lb) lb.outerHTML = lbHtml(10, res.error ? undefined : res.rank);
      const m = screen.querySelector('.sc-lb-msg'); if (m) m.textContent = msg;
      if (!res.error) form.querySelectorAll('input,button').forEach((x) => ((x as HTMLInputElement).disabled = true)); else btn.disabled = false;
    });
  };
  const renderHud = () => {
    hud.innerHTML = `<b>${score}</b> ${L.pts}${mult > 1 ? ` <span class="sc-mult">×${mult}</span>` : ''} · ${'♥'.repeat(Math.max(0, lives))}<em>${'♥'.repeat(Math.max(0, 3 - lives))}</em> · ${L.lvl} <b>${TIERS[level]}</b>${best ? ` · ${L.best} ${best}` : ''}`;
  };
  const renderTool = () => {
    const parts: string[] = [];
    if (weapon) parts.push(`<span style="--c:#${TOOL_COLOR[weapon].toString(16).padStart(6, '0')}"><i></i>${L.tools[weapon]} ${Math.ceil(weaponT)}s</span>`);
    if (magnetT > 0) parts.push(`<span style="--c:#f472b6"><i></i>${L.tools.magnet} ${Math.ceil(magnetT)}s</span>`);
    if (shield) parts.push(`<span style="--c:#34d399"><i></i>${L.tools.shield}</span>`);
    toolHud.innerHTML = parts.join('');
  };
  const banner = (k: number) => {
    lvlEl.innerHTML = `<b>${TIERS[k]}</b><span>${L.lv[k]}</span>`;
    lvlEl.classList.remove('on'); void lvlEl.offsetWidth; lvlEl.classList.add('on');
  };
  // pantalla completa (si el navegador lo permite)
  const wrap = ctx.overlay.parentElement as HTMLElement | null;
  if (wrap && document.fullscreenEnabled) {
    const fsBtn = el(ctx.overlay, 'sc-fs', '⛶');
    fsBtn.setAttribute('role', 'button'); fsBtn.tabIndex = 0;
    fsBtn.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fsBtn.click(); } }); fsBtn.setAttribute('title', L.fs); fsBtn.setAttribute('aria-label', L.fs);
    fsBtn.addEventListener('click', () => { if (document.fullscreenElement) void document.exitFullscreen(); else void wrap.requestFullscreen().catch(() => {}); });
  }
  showStart(); renderHud();
  fetchTop().then((st) => { lbState = st; if (!playing && !over) showStart(); });
  const unlink = (m: THREE.Mesh) => { group.remove(m); const h = m.userData.halo as THREE.Mesh | undefined; if (h) group.remove(h); };
  const clearAll = () => {
    for (const o of objs) unlink(o.m); objs.length = 0;
    for (const s of shots) group.remove(s.m); shots.length = 0;
    for (const w of warns) group.remove(w.m); warns.length = 0;
  };
  const start = () => {
    clearAll();
    score = 0; lives = 3; speed = LEVELS[0].speed; over = false; playing = true; elapsed = 0; level = 0; streak = 0; mult = 1;
    gateCd = 0; shield = false; weapon = null; weaponT = 0; magnetT = 0; shieldRing.visible = false;
    screen.style.display = 'none'; renderHud(); renderTool(); banner(0);
    startAt = performance.now();
    ctx.canvas.style.cursor = 'none'; ctx.canvas.style.touchAction = 'none';
  };
  screen.addEventListener('click', (e) => {
    const act = (e.target as HTMLElement).closest('[data-act]')?.getAttribute('data-act');
    if (act === 'play') start();
    if (act === 'quote') {
      if (document.fullscreenElement) void document.exitFullscreen();
      window.dispatchEvent(new CustomEvent('cx-open-quote', { detail: { kind: 'wizard', rootChoice: 'web-3d', subChoice: 'web-app', answers: { 'tipo-app': 'juego' } } }));
    }
  });
  const onMove = (e: PointerEvent) => {
    const r = ctx.canvas.getBoundingClientRect();
    target.set(((e.clientX - r.left) / r.width - 0.5) * viewW, 0, ((e.clientY - r.top) / r.height - 0.5) * viewH);
    target.x = Math.max(-viewW / 2 + 0.8, Math.min(viewW / 2 - 0.8, target.x));
    target.z = Math.max(-viewH / 2 + 0.8, Math.min(viewH / 2 - 0.8, target.z));
  };
  ctx.canvas.addEventListener('pointermove', onMove);
  ctx.canvas.addEventListener('pointerdown', onMove);

  const addObj = (kind: GKind, x: number, extra: Partial<Obj> = {}) => {
    const geo = { coin: coinGeo, rock: rockGeo, zig: zigGeo, heavy: heavyGeo, gate: gateGeo, dart: dartGeo, tool: toolGeo }[kind];
    const mat = kind === 'tool' ? toolMats[extra.tool!] : { coin: coinMat, rock: rockMat, zig: zigMat, heavy: heavyMat, gate: gateMat, dart: dartMat, tool: coinMat }[kind];
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, 0, -viewH / 2 - 0.8);
    if (kind === 'tool') m.rotation.x = -Math.PI / 2;
    group.add(m);
    const v = kind === 'dart' ? speed * 2.6 : kind === 'heavy' ? speed * 0.7 : kind === 'gate' ? speed * 0.85 : speed * (0.8 + Math.random() * 0.5);
    const r = { coin: 0.75, rock: 0.7, zig: 0.65, heavy: 1.0, gate: 0.62, dart: 0.55, tool: 0.7 }[kind];
    const o: Obj = { m, kind, v, hp: kind === 'heavy' ? 3 : 1, r, x0: x, ph: Math.random() * Math.PI * 2, ...extra };
    objs.push(o); return o;
  };
  const spawn = () => {
    const lv = LEVELS[level], mix = lv.mix as Record<string, number>;
    let pick = Math.random(), kind: GKind = 'coin';
    for (const [k, w] of Object.entries(mix)) { if (pick < w) { kind = k as GKind; break; } pick -= w; }
    if (kind === 'gate' && gateCd > 0) kind = 'rock';
    const xr = () => (Math.random() - 0.5) * (viewW - 1.8);
    if (kind === 'gate') {
      // muro con un hueco: se atraviesa o se abre con el láser
      const gap = 2.4, gx = (Math.random() - 0.5) * (viewW - gap - 2);
      for (let x = -viewW / 2 + 0.5; x < viewW / 2; x += 1.0) if (Math.abs(x - gx) > gap / 2) addObj('gate', x);
      gateCd = 3.5; return 1.0;
    }
    if (kind === 'dart') {
      // aviso: una línea roja marca el carril 0,7 s antes
      const x = xr(), m = new THREE.Mesh(warnGeo, warnMat); m.rotation.x = -Math.PI / 2; m.scale.y = viewH; m.position.set(x, -0.5, 0);
      group.add(m); warns.push({ m, x, t: 0.7 }); return 0;
    }
    if (kind === 'tool') {
      const ids = Object.keys(TOOL_COLOR) as ToolId[];
      addObj('tool', xr(), { tool: ids[Math.floor(Math.random() * ids.length)] }); return 0;
    }
    addObj(kind, xr()); return 0;
  };
  const gain = (pos: THREE.Vector3, base: number, cls = 'good') => { const p = base * mult; score += p; floatText(pos, `+${p}`, cls); };
  const destroy = (o: Obj, i: number) => {
    unlink(o.m); objs.splice(i, 1);
    burst(o.m.position, o.kind === 'zig' ? 0x5ac8fa : 0x9be7ff, 10, false); ringFx(o.m.position, 0x5ac8fa, 0.35);
    gain(o.m.position, 10, 'scan');
  };
  const takeHit = (o: Obj) => {
    if (shield) { shield = false; shieldRing.visible = false; burst(o.m.position, 0x34d399, 12, false); ringFx(o.m.position, 0x34d399); floatText(o.m.position, 'QA ✓', 'scan'); renderTool(); return; }
    lives -= 1; streak = 0; mult = 1;
    burst(o.m.position, 0x8b95a3, 14, true); ringFx(o.m.position, 0xff3b30, 0.35);
    shake = 0.35; flash = 1; floatText(o.m.position, '−1 ♥', 'bad');
  };
  const pickTool = (o: Obj) => {
    const t = o.tool!;
    ringFx(o.m.position, TOOL_COLOR[t], 0.5); burst(o.m.position, TOOL_COLOR[t], 12, false); floatText(o.m.position, L.tools[t], 'scan');
    if (t === 'laser' || t === 'fan') { weapon = t; weaponT = 8; fireT = 0; }
    else if (t === 'magnet') magnetT = 8;
    else if (t === 'shield') { shield = true; shieldRing.visible = true; }
    else if (t === 'pulse') pulsePending = true;   // se aplica tras recorrer los objetos
    renderTool();
  };
  const fire = () => {
    const dirs = weapon === 'fan' ? [-0.32, 0, 0.32] : [0];
    for (const a of dirs) {
      const m = new THREE.Mesh(shotGeo, shotMat); m.position.copy(holder.position).setY(0.3); m.position.z -= 0.6; m.rotation.y = -a;
      group.add(m); shots.push({ m, vx: Math.sin(a) * 12, vz: -Math.cos(a) * 12 });
    }
  };
  let lastX = 0;
  return {
    group, camera: cam, interactive: false,
    dispose: () => {
      clearAll();
      disposables.forEach((d) => d.dispose());
      fxDisposables.forEach((d) => d.dispose());
      particles.forEach((p) => (p.m.material as THREE.Material).dispose());
      rings.forEach((r) => (r.m.material as THREE.Material).dispose());
      ctx.canvas.removeEventListener('pointermove', onMove); ctx.canvas.removeEventListener('pointerdown', onMove);
      ctx.canvas.style.cursor = ''; ctx.canvas.style.touchAction = '';
    },
    update: (dt, t) => {
      // encuadre: la altura visible es fija; el ancho sigue a la forma del lienzo (pantalla completa incluida)
      const { w, h } = ctx.size(), asp = w / h;
      // la cámara se aleja con el nivel (transición suave)
      const vT = playing ? LEVELS[level].view : LEVELS[0].view, vN = viewH + (vT - viewH) * Math.min(1, dt * 1.2);
      if (Math.abs(asp - lastAspect) > 1e-3 || Math.abs(vN - viewH) > 1e-4) {
        lastAspect = asp; viewH = vN; viewW = viewH * asp;
        cam.left = -viewW / 2; cam.right = viewW / 2; cam.top = viewH / 2; cam.bottom = -viewH / 2; cam.updateProjectionMatrix();
      }
      grid.position.z = (t * speed) % 1;
      holder.position.lerp(playing ? target : new THREE.Vector3(Math.sin(t) * 1.5, 0, 1.5), Math.min(1, dt * 8));
      const vx = (holder.position.x - lastX) / Math.max(dt, 1e-3); lastX = holder.position.x;
      holder.rotation.z = THREE.MathUtils.clamp(-vx * 0.04, -0.4, 0.4);
      rotors.spin(dt, playing ? 34 : 22, playing ? 1 : 0.7);
      holder.scale.setScalar(1 + Math.sin(t * 3.2) * 0.025);
      shieldRing.rotation.z += dt * 1.5; shieldMat.opacity = 0.55 + Math.sin(t * 6) * 0.25;
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]; p.life += dt;
        const k = p.life / p.max;
        p.m.position.addScaledVector(p.v, dt); p.v.multiplyScalar(1 - dt * 3);
        p.m.rotation.x += dt * p.spin; p.m.rotation.y += dt * p.spin;
        (p.m.material as THREE.MeshBasicMaterial).opacity = 1 - k;
        p.m.scale.setScalar(1 - 0.5 * k);
        if (k >= 1) { group.remove(p.m); (p.m.material as THREE.Material).dispose(); particles.splice(i, 1); }
      }
      for (let i = rings.length - 1; i >= 0; i--) {
        const r = rings[i]; r.life += dt;
        const k = r.life / r.max;
        r.m.scale.setScalar(1 + k * r.grow);
        (r.m.material as THREE.MeshBasicMaterial).opacity = 1 - k;
        if (k >= 1) { group.remove(r.m); (r.m.material as THREE.Material).dispose(); rings.splice(i, 1); }
      }
      if (shake > 0) { shake = Math.max(0, shake - dt); const a = shake * 0.5; cam.position.set(camHome.x + (Math.random() - 0.5) * a, camHome.y, camHome.z + (Math.random() - 0.5) * a); }
      else cam.position.copy(camHome);
      if (flash > 0) { flash = Math.max(0, flash - dt * 3); flashEl.style.opacity = String(flash * 0.55); }
      drone.visible = !(flash > 0.2 && Math.floor(t * 20) % 2 === 0);
      if (!playing) return;
      // progresión: el proyecto sube de talla con el tiempo
      elapsed += dt;
      const nl = LEVELS.reduce((a, l, k) => (elapsed >= l.at ? k : a), 0);
      if (nl !== level) { level = nl; banner(level); renderHud(); }
      const inLv = elapsed - LEVELS[level].at, isXL = level === LEVELS.length - 1;
      speed = LEVELS[level].speed + inLv * (isXL ? XL_ACCEL : 0.02);
      gateCd = Math.max(0, gateCd - dt);
      spawnT -= dt;
      if (spawnT <= 0) spawnT = Math.max(0.2, LEVELS[level].every - (isXL ? inLv * 0.0025 : 0)) * (0.85 + Math.random() * 0.3) + spawn();
      for (let i = warns.length - 1; i >= 0; i--) {
        const wn = warns[i]; wn.t -= dt; (wn.m.material as THREE.MeshBasicMaterial).opacity = 0.25 + 0.35 * Math.abs(Math.sin(t * 18));
        if (wn.t <= 0) { group.remove(wn.m); warns.splice(i, 1); addObj('dart', wn.x); }
      }
      // herramientas activas
      if (weapon) { weaponT -= dt; fireT -= dt; if (fireT <= 0) { fire(); fireT = weapon === 'fan' ? 0.3 : 0.2; } if (weaponT <= 0) weapon = null; }
      if (magnetT > 0) magnetT = Math.max(0, magnetT - dt);
      toolT -= dt; if (toolT <= 0 && (weapon || magnetT > 0)) { toolT = 0.25; renderTool(); }
      for (let i = shots.length - 1; i >= 0; i--) {
        const s = shots[i]; s.m.position.x += s.vx * dt; s.m.position.z += s.vz * dt;
        let gone = s.m.position.z < -viewH / 2 - 1.5;
        for (let j = objs.length - 1; j >= 0 && !gone; j--) {
          const o = objs[j]; if (o.kind === 'coin' || o.kind === 'tool') continue;
          if (Math.hypot(o.m.position.x - s.m.position.x, o.m.position.z - s.m.position.z) < o.r * 0.75) {
            gone = true; o.hp -= 1;
            if (o.hp <= 0) destroy(o, j); else { burst(o.m.position, 0x9be7ff, 5, false); o.m.scale.setScalar(0.8 + 0.1 * o.hp); }
          }
        }
        if (gone) { group.remove(s.m); shots.splice(i, 1); }
      }
      let changed = false;
      for (let i = objs.length - 1; i >= 0; i--) {
        const o = objs[i];
        o.m.position.z += o.v * dt;
        if (o.kind === 'zig') o.m.position.x = o.x0 + Math.sin(elapsed * 2.4 + o.ph) * 1.4;
        if (o.kind === 'coin' && magnetT > 0) { const d = holder.position.clone().sub(o.m.position); const dl = d.length(); if (dl < 3.6) o.m.position.addScaledVector(d.normalize(), dt * 7); }
        if (o.kind === 'tool') o.m.scale.setScalar(1 + Math.sin(elapsed * 6) * 0.08);
        else if (o.kind !== 'dart' && o.kind !== 'gate') { o.m.rotation.y += dt * (o.kind === 'coin' ? 1.4 : 2.2); if (o.kind === 'coin') o.m.rotation.x += dt * 2; }

        const hit = Math.hypot(o.m.position.x - holder.position.x, o.m.position.z - holder.position.z) < o.r;
        if (hit || o.m.position.z > viewH / 2 + 1.2) {
          unlink(o.m); objs.splice(i, 1);
          if (hit) {
            changed = true;
            if (o.kind === 'coin') {
              streak += 1; mult = Math.min(3, 1 + Math.floor(streak / 5));
              gain(o.m.position, 10); burst(o.m.position, 0xffb066, 16, false); ringFx(o.m.position, 0xff7a3d);
              hud.classList.remove('pulse-good', 'pulse-bad'); void hud.offsetWidth; hud.classList.add('pulse-good');
            } else if (o.kind === 'tool') pickTool(o);
            else { takeHit(o); hud.classList.remove('pulse-good', 'pulse-bad'); void hud.offsetWidth; hud.classList.add('pulse-bad'); }
          }
        }
      }
      if (pulsePending) {
        // onda radial: limpia los obstáculos cercanos
        pulsePending = false; ringFx(holder.position, 0xffd166, 0.6, 9);
        for (let i = objs.length - 1; i >= 0; i--) { const q = objs[i]; if (q.kind !== 'coin' && q.kind !== 'tool' && q.m.position.distanceTo(holder.position) < 3.2) destroy(q, i); }
        changed = true;
      }
      if (changed) renderHud();
      if (lives <= 0 && !over) {
        over = true; playing = false; best = Math.max(best, score); weapon = null; magnetT = 0; renderTool();
        ctx.canvas.style.cursor = ''; ctx.canvas.style.touchAction = '';
        showOver(score, performance.now() - startAt); renderHud();
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
    // ciclo 44: en pantalla completa el lienzo toma el alto de la pantalla
    const size = () => { const fs = !!document.fullscreenElement?.contains(mount); return { w: mount.clientWidth || 600, h: fs ? (mount.clientHeight || window.innerHeight) : height }; };
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
        .sc-swatches { position: absolute; left: 50%; bottom: 10px; transform: translateX(-50%); display: flex; gap: 6px; max-width: calc(100% - 16px); overflow-x: auto; scrollbar-width: none; }
        .sc-swatches::-webkit-scrollbar { display: none; }
        .sc-swatch { flex: 0 0 auto; white-space: nowrap; display: inline-flex; align-items: center; gap: 4px; font: 600 11px var(--cx-sans, system-ui); padding: 5px 9px; border-radius: 999px; cursor: pointer;
          background: var(--cx-card-solid); color: var(--cx-muted); border: 1px solid var(--cx-border-strong); transition: border-color .2s, color .2s; }
        .sc-swatch i { width: 10px; height: 10px; border-radius: 50%; border: 1px solid rgba(127,127,127,.4); }
        .sc-swatch.on { border-color: var(--cx-accent); color: var(--cx-text); }
        @media (max-width: 560px) { .sc-swatch span { display: none; } .sc-swatch { padding: 6px; } .sc-swatch i { width: 14px; height: 14px; } }
        .sc-cat-card { position: absolute; left: 14px; top: 12px; max-width: 46%; display: grid; gap: 2px; pointer-events: none; }
        .sc-cat-card small { font: 600 9.5px var(--cx-mono, monospace); letter-spacing: .14em; text-transform: uppercase; color: var(--cx-accent); }
        .sc-cat-card b { font: 700 15px/1.2 var(--cx-display, system-ui); color: var(--cx-text); }
        .sc-cat-card span { font-size: 12px; line-height: 1.4; color: var(--cx-muted); }
        .sc-cat-variants { position: absolute; right: 12px; top: 12px; display: flex; gap: 4px; flex-wrap: wrap; justify-content: flex-end; max-width: 50%; }
        .sc-cat-variants button { font: 600 11.5px var(--cx-sans, system-ui); padding: 5px 10px; border-radius: 999px; cursor: pointer; border: 1px solid var(--cx-border-strong); background: var(--cx-card-solid); color: var(--cx-muted); transition: all .2s; }
        .sc-cat-variants button[aria-pressed='true'] { background: var(--cx-accent); border-color: var(--cx-accent); color: var(--cx-on-accent); }
        .sc-cat-hint { position: absolute; left: 50%; bottom: 62px; transform: translateX(-50%); font: 500 11px var(--cx-mono, monospace); letter-spacing: .06em; color: var(--cx-muted); background: var(--cx-card-solid); padding: 4px 10px; border-radius: 999px; pointer-events: none; transition: opacity .5s; white-space: nowrap; }
        .sc-cat-hint.off { opacity: 0; }
        .sc-cat-dots button { width: 6px; height: 6px; padding: 0; border: none; border-radius: 50%; cursor: pointer; background: var(--cx-border-strong); transition: background .2s, width .2s; }
        .sc-cat-dots button.on { background: var(--cx-accent); width: 16px; border-radius: 3px; }
        @media (max-width: 560px) { .sc-cat-card span { display: none; } .sc-cat-card { max-width: 48%; } }
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
        .sc-game-screen { flex-direction: row !important; flex-wrap: wrap; gap: 14px !important; padding: 12px 16px !important; overflow-y: auto; cursor: default !important; }
        .sc-gs-main { display: flex; flex-direction: column; align-items: center; gap: 8px; max-width: 300px; }
        .sc-gs-play { font: 700 15px var(--cx-display, system-ui); padding: 9px 18px; border-radius: 999px; border: none; cursor: pointer; background: var(--cx-accent); color: var(--cx-on-accent); box-shadow: 0 8px 24px -10px var(--cx-accent); }
        .sc-lb { min-width: 220px; max-width: 280px; text-align: left; background: var(--cx-card-solid); border: 1px solid var(--cx-border-strong); border-radius: 12px; padding: 10px 12px; }
        .sc-lb-h { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 6px; } .sc-lb-h b { font: 700 13px var(--cx-display, system-ui); color: var(--cx-text); } .sc-lb-h small { font: 500 10px var(--cx-mono, monospace); color: var(--cx-faint); letter-spacing: .08em; text-transform: uppercase; }
        .sc-lb ol { list-style: none; margin: 0; padding: 0; display: grid; gap: 3px; }
        .sc-lb li { display: grid; grid-template-columns: 18px 1fr auto; gap: 6px; align-items: center; font-size: 12px; color: var(--cx-text); padding: 2px 4px; border-radius: 6px; }
        .sc-lb li i { font: 600 10.5px var(--cx-mono, monospace); color: var(--cx-faint); font-style: normal; }
        .sc-lb li:nth-child(-n+3) i { color: var(--cx-accent); }
        .sc-lb li span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } .sc-lb li em { font-style: normal; margin-left: 6px; font: 600 10px var(--cx-mono, monospace); color: var(--cx-accent); }
        .sc-lb li b { font: 700 12px var(--cx-mono, monospace); } .sc-lb li.me { background: var(--cx-accent-soft); }
        .sc-lb p { margin: 4px 0 0; font-size: 11.5px; color: var(--cx-muted); } .sc-lb .sc-lb-cta { margin-top: 8px; font-size: 11px; color: var(--cx-accent); }
        .sc-lb-form { display: grid; gap: 5px; width: 100%; }
        .sc-lb-form input { font: inherit; font-size: 12.5px; padding: 7px 9px; border-radius: 8px; border: 1px solid var(--cx-border-strong); background: var(--cx-tile); color: var(--cx-text); }
        .sc-lb-form button { font: 600 12.5px var(--cx-sans, system-ui); padding: 7px 10px; border-radius: 8px; border: 1px solid var(--cx-accent-border); background: var(--cx-accent-soft); color: var(--cx-accent); cursor: pointer; }
        .sc-lb-msg { font-size: 11.5px; color: var(--cx-muted); min-height: 14px; }
        /* ciclo 44 · niveles, herramientas, pantalla completa y llamada a cotizar */
        .sc-wrap:fullscreen { width: 100vw; height: 100vh; border-radius: 0; background: var(--cx-bg, #0b0c0e); }
        .sc-wrap:fullscreen > div:first-child { height: 100vh !important; }
        .sc-fs { position: absolute; right: 10px; top: 8px; width: 30px; height: 30px; display: grid; place-items: center; border-radius: 8px; cursor: pointer; pointer-events: auto;
          font: 600 16px/1 system-ui; color: var(--cx-text); background: var(--cx-card-solid); border: 1px solid var(--cx-border-strong); z-index: 3; }
        .sc-fs:hover { border-color: var(--cx-accent); color: var(--cx-accent); }
        .sc-mult { color: #ffd166; font-weight: 700; }
        .sc-tool { position: absolute; left: 10px; top: 40px; display: flex; flex-direction: column; gap: 4px; pointer-events: none; }
        .sc-tool span { display: inline-flex; align-items: center; gap: 6px; font: 600 11px var(--cx-mono, monospace); color: var(--cx-text); background: var(--cx-card-solid); padding: 3px 8px; border-radius: 7px; border: 1px solid color-mix(in srgb, var(--c) 60%, transparent); }
        .sc-tool i { width: 8px; height: 8px; transform: rotate(45deg); background: var(--c); }
        .sc-lvl { position: absolute; left: 50%; top: 38%; transform: translate(-50%, -50%); display: grid; justify-items: center; gap: 2px; pointer-events: none; opacity: 0; text-align: center; }
        .sc-lvl b { font: 800 44px/1 var(--cx-display, system-ui); color: var(--cx-accent); text-shadow: 0 6px 30px rgba(0,0,0,.5); }
        .sc-lvl span { font: 600 12px var(--cx-mono, monospace); letter-spacing: .12em; text-transform: uppercase; color: var(--cx-text); background: var(--cx-card-solid); padding: 3px 9px; border-radius: 6px; }
        .sc-lvl.on { animation: sc-lvl 2.2s cubic-bezier(.16,1,.3,1) both; }
        @keyframes sc-lvl { 0% { opacity: 0; transform: translate(-50%, -40%) scale(.85); } 15% { opacity: 1; transform: translate(-50%, -50%) scale(1); } 75% { opacity: 1; } 100% { opacity: 0; transform: translate(-50%, -60%); } }
        .sc-legend2 { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 14px; text-align: left; font: 500 11px var(--cx-sans, system-ui); color: var(--cx-text); }
        .sc-legend2 > div { display: grid; gap: 4px; align-content: start; padding: 8px 10px; border-radius: 10px; background: var(--cx-card-solid); }
        .sc-legend2 .good { border: 1px solid var(--cx-border-strong); } .sc-legend2 .bad { border: 1px solid #ff3b3066; }
        .sc-legend2 b { font: 700 10px var(--cx-mono, monospace); letter-spacing: .1em; } .sc-legend2 .good b { color: var(--cx-accent); } .sc-legend2 .bad b { color: #ff5a4f; }
        .sc-legend2 span { display: flex; align-items: center; gap: 7px; }
        .sc-legend2 i { flex: 0 0 auto; width: 16px; height: 16px; display: grid; place-items: center; font: 700 10px system-ui; font-style: normal; }
        .sc-legend2 .ring { border-radius: 50%; border: 3px solid #ff7a3d; width: 12px; height: 12px; }
        .sc-legend2 .badge { border-radius: 50%; border: 2px solid var(--c); color: var(--c); background: #0b1410; }
        .sc-legend2 .haz { background: #e0352b; clip-path: polygon(50% 0, 62% 30%, 100% 35%, 70% 58%, 80% 100%, 50% 75%, 20% 100%, 30% 58%, 0 35%, 38% 30%); }
        .sc-legend2 .h1 { background: #ff4f8b; } .sc-legend2 .h2 { background: #9e1b14; width: 18px; height: 18px; }
        .sc-legend2 .h3 { clip-path: none; height: 10px; background: repeating-linear-gradient(-45deg, #ff3b30 0 4px, #1a0c0c 4px 8px); }
        .sc-legend2 .h4 { clip-path: polygon(50% 0, 100% 100%, 0 100%); background: #ff3b30; }
        .sc-gs-main { max-width: 440px !important; }
        .sc-top3 { display: flex; flex-wrap: wrap; justify-content: center; align-items: baseline; gap: 4px 12px; font: 500 11.5px var(--cx-sans, system-ui); color: var(--cx-muted); }
        .sc-top3 small { font: 600 10px var(--cx-mono, monospace); letter-spacing: .1em; text-transform: uppercase; color: var(--cx-faint); }
        .sc-top3 i { font: 600 10px var(--cx-mono, monospace); font-style: normal; color: var(--cx-accent); margin-right: 4px; } .sc-top3 b { color: var(--cx-text); font-family: var(--cx-mono, monospace); }
        @media (max-width: 560px) { .sc-legend2 { grid-template-columns: 1fr; } }
        .sc-legend { display: flex; flex-wrap: wrap; justify-content: center; gap: 4px 10px; font: 500 10.5px var(--cx-mono, monospace); color: var(--cx-muted); }
        .sc-legend span { display: inline-flex; align-items: center; gap: 5px; } .sc-legend i { width: 7px; height: 7px; transform: rotate(45deg); }
        .sc-gs-lv { font: 600 11px var(--cx-mono, monospace); letter-spacing: .1em; text-transform: uppercase; color: var(--cx-accent); }
        .sc-gs-cta { font: 600 12.5px var(--cx-sans, system-ui); padding: 6px 4px; border: 0; background: none; color: var(--cx-accent); cursor: pointer; text-decoration: underline; text-underline-offset: 3px; }
        .sc-float.scan { color: #9be7ff; }
        @media (prefers-reduced-motion: reduce) { .sc-lvl.on { animation-duration: .01s; } }
        .sc-float { position: absolute; transform: translate(-50%, -50%); font: 800 16px var(--cx-display, system-ui); pointer-events: none; animation: sc-float .9s cubic-bezier(.2,.8,.2,1) forwards; text-shadow: 0 2px 10px rgba(0,0,0,.5); }
        .sc-float.good { color: #ffb066; } .sc-float.bad { color: #ff5a4f; }
        @keyframes sc-float { 0% { opacity: 0; transform: translate(-50%, -30%) scale(.7); } 20% { opacity: 1; transform: translate(-50%, -60%) scale(1.15); } 100% { opacity: 0; transform: translate(-50%, -180%) scale(1); } }
        .sc-hit-flash { position: absolute; inset: 0; pointer-events: none; opacity: 0; background: radial-gradient(ellipse at center, transparent 40%, rgba(255,59,48,.55)); }
        .sc-hud.pulse-good { animation: sc-pg .4s; } .sc-hud.pulse-bad { animation: sc-pb .4s; }
        @keyframes sc-pg { 50% { transform: scale(1.12); box-shadow: 0 0 0 3px rgba(255,122,61,.5); } }
        @keyframes sc-pb { 25% { transform: translateX(-4px); } 75% { transform: translateX(4px); } }
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
