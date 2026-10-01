/**
 * IntroHero.tsx — Pantalla de inicio que se convierte en el hero (ciclo 34, guion aprobado).
 *
 * "De lo complejo a lo esencial", con el DRON como protagonista y UNA línea que solo revela:
 *   carga     línea neutra que crece desde el centro con los bytes reales
 *   origen    se recoge en un punto de luz naranja (anticipación)
 *   esqueleto desde ese punto se dibujan ~200 aristas largas, en vista frontal casi plana
 *             (lente larga, 13°): lo más reducido posible → máximo contraste con lo que viene
 *   detalle   entra el resto de aristas mientras la cámara hace un dolly-zoom (13° → 30°)
 *             y gira a la vista 3/4: del plano técnico 2D al objeto 3D
 *   realista  la línea vuelve como corte horizontal y baja revelando los materiales reales
 *   esencial  el corte sube y deja el objeto de diseño; el titular entra en dos tiempos
 *   hero      cortina, titular a su sitio (FLIP), la línea entra horizontal, gira 90° y es el
 *             divisor; lo realista entra desde la izquierda hasta ella
 *   scroll    al bajar a las opciones el dron se DESPIEZA (ligado al scroll y reversible)
 *             y la cámara gira hacia la vista cenital mientras las piezas pasan tras las tarjetas.
 * Timing: compás de 0,4 s; fases solapadas ~20 %; velocidad de giro continua (sin escalones);
 * entradas ease-out, traslados ease-in-out, asentamiento con muelle crítico (sin rebote).
 * Fluidez: meshopt en workers, preparación por lotes, sombreadores y texturas precompilados,
 * número de planos de recorte constante y reloj propio con dt acotado (pausa, nunca salta).
 * La versión del ciclo 33 (con la secuencia de marca AW) queda archivada en IntroHeroV33.tsx.
 */
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { preloadHolybro, meshEffectiveName } from '../holybro';
import './hero.css';

type Lang = 'es' | 'en';
let playedThisLoad = false;

const T = {
  es: { kicker: 'Alex Woodcock — 3D · Web · IA', l1: 'De lo complejo', l2a: 'a lo ', l2b: 'esencial', sub: 'Modelos, webs y experiencias 3D que tus clientes entienden a la primera. Cotiza tu proyecto en un minuto.',
    quote: 'Cotizar mi proyecto', work: 'Ver trabajo real', skip: 'Saltar', real: 'Realista', ess: 'Esencial', scroll: 'Desliza' },
  en: { kicker: 'Alex Woodcock — 3D · Web · AI', l1: 'From complex', l2a: 'to ', l2b: 'essential', sub: '3D models, websites and experiences your clients understand at first glance. Quote your project in a minute.',
    quote: 'Quote my project', work: 'See real work', skip: 'Skip', real: 'Realistic', ess: 'Essential', scroll: 'Scroll' },
};

/** Guion (segundos; se escala con K). Inicios sobre un compás de 0,4 s. */
const TL = {
  c0: 0, c: 0.55,          // la línea se recoge en un punto de luz
  sk0: 0.4, sk: 1.0,       // ICONO cenital: brazos desde el centro, cuerpo, círculos de hélice
  de0: 1.2, de: 1.0,       // detalle real (aristas) mientras el icono se apaga
  dz0: 1.0, dz: 1.6,       // la cámara baja de cenital a 3/4 con dolly-zoom (13° → 30°)
  r0: 2.0, r: 1.2,         // corte baja: realista
  m0: 3.0, m: 1.2,         // corte sube: esencial
  s0: 4.2, s: 1.2,         // asentamiento en el hero
  v0: 4.6, v: 0.6,         // la línea gira 90° y es el divisor
  w0: 5.2, w: 0.6,         // lo realista entra hasta el divisor
  t1: 2.4, t2: 3.6,        // titular, línea 1 y 2
};
const FOV0 = 13, FOV1 = 30;

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const ease = (x: number) => { x = clamp01(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };   // in-out cúbica
const easeOut = (x: number) => { x = clamp01(x); return 1 - Math.pow(1 - x, 5); };                                      // out quinta
const easeOutExpo = (x: number) => { x = clamp01(x); return x === 1 ? 1 : 1 - Math.pow(2, -10 * x); };
const smooth = (a: number, b: number, x: number) => { const k = clamp01((x - a) / (b - a)); return k * k * (3 - 2 * k); };
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

/** Copia float (GLB cuantizado) de posiciones/normales en espacio mundo + centro de la pieza. */
function worldFloat(m: THREE.Mesh) {
  const pa = m.geometry.getAttribute('position'), na = m.geometry.getAttribute('normal');
  const P = new Float32Array(pa.count * 3), N = new Float32Array(pa.count * 3);
  const v = new THREE.Vector3(), nm = new THREE.Matrix3().getNormalMatrix(m.matrixWorld);
  const bb = new THREE.Box3();
  for (let i = 0; i < pa.count; i++) {
    v.set(pa.getX(i), pa.getY(i), pa.getZ(i)).applyMatrix4(m.matrixWorld); P[i * 3] = v.x; P[i * 3 + 1] = v.y; P[i * 3 + 2] = v.z; bb.expandByPoint(v);
    if (na) { v.set(na.getX(i), na.getY(i), na.getZ(i)).applyMatrix3(nm).normalize(); N[i * 3] = v.x; N[i * 3 + 1] = v.y; N[i * 3 + 2] = v.z; }
  }
  const idx = m.geometry.index ? (m.geometry.index.array as ArrayLike<number>) : null;
  return { P, N, idx, count: pa.count, c: bb.getCenter(new THREE.Vector3()) };
}
/** Une piezas en una geometría con `aOff` (desplazamiento de su pieza para el despiece). */
function merge(parts: ReturnType<typeof worldFloat>[], center: THREE.Vector3) {
  const total = parts.reduce((a, p) => a + p.count, 0);
  const nIdx = parts.reduce((a, p) => a + (p.idx ? p.idx.length : p.count), 0);
  const P = new Float32Array(total * 3), N = new Float32Array(total * 3), O = new Float32Array(total * 3), I = new Uint32Array(nIdx);
  let off = 0, io = 0;
  for (const p of parts) {
    P.set(p.P, off * 3); N.set(p.N, off * 3);
    const ox = p.c.x - center.x, oy = p.c.y - center.y, oz = p.c.z - center.z;
    for (let k = 0; k < p.count; k++) { O[(off + k) * 3] = ox; O[(off + k) * 3 + 1] = oy; O[(off + k) * 3 + 2] = oz; }
    if (p.idx) for (let k = 0; k < p.idx.length; k++) I[io++] = p.idx[k] + off; else for (let k = 0; k < p.count; k++) I[io++] = k + off;
    off += p.count;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.BufferAttribute(N, 3)); g.setAttribute('aOff', new THREE.BufferAttribute(O, 3));
  g.setIndex(new THREE.BufferAttribute(I, 1)); return g;
}
/** Despiece en GPU: desplaza cada vértice según el centro de su pieza (uniform compartido). */
function withExplode<M extends THREE.Material>(mat: M, u: { value: number }): M {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uExplode = u;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 aOff;\nuniform float uExplode;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed += aOff * uExplode;');
  };
  mat.customProgramCacheKey = () => 'cx-explode';
  return mat;
}
/** Segmentos ordenados (centro → afuera) a geometría de líneas con `aOff`. */
function lineGeo(pos: number[], offs: number[], dist: number[], order?: Uint32Array) {
  const n = dist.length, o = order ?? (() => { const a = new Uint32Array(n); for (let i = 0; i < n; i++) a[i] = i; return a.sort((x, y) => dist[x] - dist[y]); })();
  const P = new Float32Array(n * 6), O = new Float32Array(n * 6);
  for (let i = 0; i < n; i++) { const s = o[i]; for (let k = 0; k < 6; k++) P[i * 6 + k] = pos[s * 6 + k]; for (let k = 0; k < 3; k++) { O[i * 6 + k] = offs[s * 3 + k]; O[i * 6 + 3 + k] = offs[s * 3 + k]; } }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('aOff', new THREE.BufferAttribute(O, 3));
  return g;
}

export function IntroHero({ lang = 'es' }: { lang?: Lang }) {
  const L = T[lang];
  const [mounted, setMounted] = useState(false);
  const [stage, setStage] = useState<'intro' | 'hero'>('intro');
  const layerRef = useRef<HTMLDivElement>(null);
  const curtainRef = useRef<HTMLDivElement>(null);
  const hudRef = useRef<HTMLDivElement>(null);
  const countRef = useRef<HTMLSpanElement>(null);
  const lineRef = useRef<HTMLElement>(null);
  const dotRef = useRef<HTMLElement>(null);
  const introTitleRef = useRef<HTMLDivElement>(null);
  const heroTitleRef = useRef<HTMLHeadingElement>(null);
  const dividerRef = useRef<HTMLDivElement>(null);
  const skipRef = useRef<() => void>(() => {});

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!mounted) return;
    const html = document.documentElement;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const wantIntro = !playedThisLoad && !reduce && html.dataset.cxIntro !== undefined;
    let short = false;
    try { short = sessionStorage.getItem('cx-intro') === '1'; } catch { /* sin almacenamiento */ }
    // depuración de timing: ?introAt=2.4 congela la intro en ese instante del guion (revisión fotograma a fotograma)
    let freezeAt = NaN; try { freezeAt = Number(new URLSearchParams(location.search).get('introAt') ?? 'NaN'); } catch { /* */ }
    const K = short && !Number.isFinite(freezeAt) ? 0.55 : 1;
    if (wantIntro) html.dataset.cxIntro = 'on'; else { delete html.dataset.cxIntro; setStage('hero'); }
    MeshoptDecoder.useWorkers?.(2);

    const layer = layerRef.current!;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, window.innerWidth < 760 ? 1.5 : 1.75));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.localClippingEnabled = true;
    renderer.setClearColor(0x000000, 0);
    layer.prepend(renderer.domElement);
    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env; scene.environmentIntensity = 0.9;
    scene.add(new THREE.HemisphereLight(0xffffff, 0x20232a, 0.9));
    const key = new THREE.DirectionalLight(0xffffff, 2.4); key.position.set(-3, 5, 3); scene.add(key);
    const rim = new THREE.DirectionalLight(0xffc7a8, 1.2); rim.position.set(3, 2, -4); scene.add(rim);
    const camera = new THREE.PerspectiveCamera(wantIntro ? FOV0 : FOV1, 1, 0.05, 200);
    let W = 1, H = 1;
    const resize = () => { W = window.innerWidth; H = window.innerHeight; renderer.setSize(W, H); camera.aspect = W / H; camera.updateProjectionMatrix(); };
    resize(); window.addEventListener('resize', resize);

    const themeCols = () => html.dataset.cxTheme === 'light'
      ? { face: new THREE.Color(0xeef0f3), edge: new THREE.Color(0x1b2433), acc: new THREE.Color(0xc4400d), edgeOp: 0.5 }
      : { face: new THREE.Color(0x15171b), edge: new THREE.Color(0xe9e6df), acc: new THREE.Color(0xff7a3d), edgeOp: 0.55 };
    let cols = themeCols();
    const mo = new MutationObserver(() => { cols = themeCols(); });
    mo.observe(html, { attributes: true, attributeFilter: ['data-cx-theme'] });

    // planos de recorte: SIEMPRE uno por material (cambiar el número recompila el sombreador)
    const planeReal = new THREE.Plane(new THREE.Vector3(0, 1, 0), -1e6);   // empieza oculto
    const planeMin = new THREE.Plane(new THREE.Vector3(0, -1, 0), -1e6);   // empieza oculto
    const planeEdge = new THREE.Plane(new THREE.Vector3(0, 1, 0), 1e6);    // empieza visible entero
    const uExplode = { value: 0 };
    const minMat = withExplode(new THREE.MeshStandardMaterial({ color: cols.face, roughness: 0.82, metalness: 0.0, clippingPlanes: [planeMin], polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }), uExplode);
    const accMat = withExplode(new THREE.MeshStandardMaterial({ color: cols.acc, roughness: 0.55, metalness: 0.1, emissive: cols.acc, emissiveIntensity: 0.25, clippingPlanes: [planeMin], polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }), uExplode);
    const edgeMat = withExplode(new THREE.LineBasicMaterial({ color: 0xe9e6df, transparent: true, opacity: 0.55, depthWrite: false, clippingPlanes: [planeEdge] }), uExplode);
    const skelMat = withExplode(new THREE.LineBasicMaterial({ color: 0xf4f2ec, transparent: true, opacity: 0.95, depthWrite: false, clippingPlanes: [planeEdge] }), uExplode);
    const frontMat = withExplode(new THREE.LineBasicMaterial({ color: 0xff7a3d, transparent: true, opacity: 1, depthWrite: false, blending: THREE.AdditiveBlending }), uExplode);
    const scanMat = new THREE.LineBasicMaterial({ color: 0xff7a3d, transparent: true, opacity: 0, depthWrite: false });
    const disposables: { dispose: () => void }[] = [env, pmrem, minMat, accMat, edgeMat, skelMat, frontMat, scanMat];

    const pivot = new THREE.Group(); pivot.visible = false; scene.add(pivot);
    let ready = false, failed = false, disposed = false, compiling = false;
    const box = new THREE.Box3(), center = new THREE.Vector3(), size = new THREE.Vector3(1, 0.5, 1);
    let rH = 1.3, radius = 1.5;
    let edges: THREE.LineSegments | null = null, skel: THREE.LineSegments | null = null;
    let frontS: THREE.LineSegments | null = null, frontD: THREE.LineSegments | null = null;
    let nDet = 0, nSk = 0;
    let skKeys = new Float32Array(0);   // claves de dibujo del icono, ordenadas
    let real: THREE.Group | null = null, scan: THREE.LineLoop | null = null;
    let dl = 0, stage2 = 0, prep = 0, parseT0 = 0;

    (async () => {
      const root = await preloadHolybro((p) => { dl = p; if (p >= 0.99 && !parseT0) parseT0 = performance.now(); });
      if (disposed) return;
      stage2 = 1;
      const drone = root.clone(true);
      pivot.add(drone); pivot.updateMatrixWorld(true);
      box.setFromObject(drone); box.getCenter(center); box.getSize(size);
      rH = Math.hypot(size.x, size.z) / 2; radius = size.length() / 2;
      const meshes: THREE.Mesh[] = []; drone.traverse((o) => { if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh); });
      const matMap = new Map<THREE.Material, THREE.Material>();
      const minParts: ReturnType<typeof worldFloat>[] = [], accParts: ReturnType<typeof worldFloat>[] = [];
      const dA: number[] = [], dO: number[] = [], dD: number[] = [];                  // detalle
      const motorMeshes: THREE.Box3[] = [];                                          // para el icono
      let budget = performance.now();
      const push = (ep: THREE.BufferAttribute | THREE.InterleavedBufferAttribute, c: THREE.Vector3, A: number[], O: number[], D: number[], Lr?: number[]) => {
        for (let k = 0; k < ep.count; k += 2) {
          const ax = ep.getX(k), ay = ep.getY(k), az = ep.getZ(k), bx = ep.getX(k + 1), by = ep.getY(k + 1), bz = ep.getZ(k + 1);
          A.push(ax, ay, az, bx, by, bz); O.push(c.x - center.x, c.y - center.y, c.z - center.z);
          D.push(Math.hypot((ax + bx) / 2 - center.x, (ay + by) / 2 - center.y, (az + bz) / 2 - center.z));
          Lr?.push(Math.hypot(bx - ax, by - ay, bz - az));
        }
      };
      for (let i = 0; i < meshes.length; i++) {
        const m = meshes[i];
        const src = m.material as THREE.Material;
        let c = matMap.get(src);
        if (!c) { c = src.clone(); (c as THREE.MeshStandardMaterial).clippingPlanes = [planeReal]; matMap.set(src, c); disposables.push(c); }
        m.material = c;
        const wf = worldFloat(m);
        const isMotor = /DJ-2216/i.test(meshEffectiveName(m));
        (isMotor ? accParts : minParts).push(wf);
        if (isMotor) motorMeshes.push(new THREE.Box3().setFromBufferAttribute(new THREE.BufferAttribute(wf.P, 3)));
        const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(wf.P, 3)); if (wf.idx) g.setIndex(Array.from(wf.idx));
        const eg = new THREE.EdgesGeometry(g, 28); push(eg.getAttribute('position'), wf.c, dA, dO, dD);
        g.dispose(); eg.dispose();
        prep = (i + 1) / meshes.length * 0.8;
        if (performance.now() - budget > 8) { await nextFrame(); budget = performance.now(); if (disposed) return; }
      }
      real = drone;
      // ICONO cenital (lo más reducido posible): 4 brazos del centro a los motores, un rombo de cuerpo
      // con los vértices sobre los brazos y 4 círculos de hélice. Cada segmento lleva una "clave" de
      // dibujo: brazos 0→1, cuerpo 0,2→0,7, círculos 1→2 (empiezan en el extremo de su brazo).
      const quads = new Map<string, THREE.Box3>();
      motorMeshes.forEach((b) => { const c = b.getCenter(new THREE.Vector3()); const q = `${c.x > center.x ? 1 : 0}${c.z > center.z ? 1 : 0}`; quads.set(q, (quads.get(q) ?? new THREE.Box3()).union(b)); });
      const motors = [...quads.values()].map((b) => { const c = b.getCenter(new THREE.Vector3()); c.y = b.max.y; return c; });
      const planeY = motors.length ? Math.max(...motors.map((m) => m.y)) : center.y;
      const hub = new THREE.Vector3(center.x, planeY, center.z);
      const armLen = motors.length ? motors.reduce((a, m) => a + Math.hypot(m.x - hub.x, m.z - hub.z), 0) / motors.length : rH * 0.7;
      const SA: number[] = [], SO: number[] = [], SK: number[] = [];
      const seg = (a: THREE.Vector3, b: THREE.Vector3, key: number, off: THREE.Vector3) => { SA.push(a.x, a.y, a.z, b.x, b.y, b.z); SO.push(off.x, off.y, off.z); SK.push(key); };
      const zero = new THREE.Vector3();
      motors.sort((a, b) => Math.atan2(a.z - hub.z, a.x - hub.x) - Math.atan2(b.z - hub.z, b.x - hub.x));
      motors.forEach((m) => {
        const N = 24; for (let i = 0; i < N; i++) seg(hub.clone().lerp(m, i / N).setY(planeY), hub.clone().lerp(m, (i + 1) / N).setY(planeY), (i + 1) / N, zero);
        const pr = armLen * 0.46, a0 = Math.atan2(m.z - hub.z, m.x - hub.x), C = 56, mo = m.clone().sub(center);
        for (let j = 0; j < C; j++) {
          const a1 = a0 + (j / C) * Math.PI * 2, a2 = a0 + ((j + 1) / C) * Math.PI * 2;
          seg(new THREE.Vector3(m.x + Math.cos(a1) * pr, planeY, m.z + Math.sin(a1) * pr), new THREE.Vector3(m.x + Math.cos(a2) * pr, planeY, m.z + Math.sin(a2) * pr), 1 + (j + 1) / C, mo);
        }
      });
      const bodyPts = motors.map((m) => hub.clone().lerp(m, 0.3).setY(planeY));
      bodyPts.forEach((p0, i) => { const p1 = bodyPts[(i + 1) % bodyPts.length]; const N = 8; for (let k = 0; k < N; k++) seg(p0.clone().lerp(p1, k / N), p0.clone().lerp(p1, (k + 1) / N), 0.2 + 0.5 * ((i * N + k + 1) / (bodyPts.length * N)), zero); });
      const skOrder = Uint32Array.from(SK.map((_, i) => i)).sort((x, y) => SK[x] - SK[y]);
      skKeys = Float32Array.from(skOrder, (i) => SK[i]);
      const skGeo = lineGeo(SA, SO, SK, skOrder); nSk = SK.length;
      await nextFrame(); if (disposed) return;
      const deGeo = lineGeo(dA, dO, dD); nDet = dD.length;
      await nextFrame(); if (disposed) return;
      const mkFront = (g: THREE.BufferGeometry) => { const f = new THREE.BufferGeometry(); f.setAttribute('position', g.getAttribute('position')); f.setAttribute('aOff', g.getAttribute('aOff')); disposables.push(f); const o = new THREE.LineSegments(f, frontMat); o.renderOrder = 5; o.frustumCulled = false; return o; };
      edges = new THREE.LineSegments(deGeo, edgeMat); edges.renderOrder = 3; edges.frustumCulled = false;
      skel = new THREE.LineSegments(skGeo, skelMat); skel.renderOrder = 4; skel.frustumCulled = false;
      frontS = mkFront(skGeo); frontD = mkFront(deGeo);
      const minMesh = new THREE.Mesh(merge(minParts, center), minMat), accMesh = new THREE.Mesh(merge(accParts, center), accMat);
      minMesh.frustumCulled = accMesh.frustumCulled = false;
      pivot.add(minMesh, accMesh, edges, skel, frontS, frontD);
      const s = size.clone().multiplyScalar(0.56);
      const scg = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-s.x, 0, -s.z), new THREE.Vector3(s.x, 0, -s.z), new THREE.Vector3(s.x, 0, s.z), new THREE.Vector3(-s.x, 0, s.z)]);
      scan = new THREE.LineLoop(scg, scanMat); scan.position.copy(center); pivot.add(scan);
      disposables.push(skGeo, deGeo, minMesh.geometry, accMesh.geometry, scg);
      prep = 0.9; await nextFrame(); if (disposed) return;
      const texKeys = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap'] as const;
      matMap.forEach((mm) => texKeys.forEach((k) => { const t = (mm as unknown as Record<string, THREE.Texture | null>)[k]; if (t) renderer.initTexture(t); }));
      camera.position.set(center.x, center.y + 2, center.z + 6); camera.lookAt(center);
      pivot.visible = true; compiling = true;
      // precompilación con límite: en equipos lentos la barra nunca espera más de 1,5 s
      try { await Promise.race([renderer.compileAsync(pivot, camera, scene), new Promise((r) => setTimeout(r, 1500))]); } catch { /* compila al primer dibujo */ }
      compiling = false;
      if (disposed) return;
      pivot.visible = false;
      prep = 1; ready = true;
    })().catch(() => { failed = true; });

    // ── interacción ──
    let mx = 0, my = 0, mxS = 0, myS = 0, spin = 0, lastMove = -10, divX = -1, heroT = -1;
    const onMove = (e: PointerEvent) => { mx = e.clientX / W * 2 - 1; my = e.clientY / H * 2 - 1; lastMove = performance.now() / 1000; };
    window.addEventListener('pointermove', onMove, { passive: true });
    let scrollRaw = 0, scrollE = 0;
    const onScroll = () => {
      scrollRaw = clamp01(window.scrollY / (H * 0.9));
      if (window.scrollY < 24) html.dataset.cxHeroTop = '1'; else delete html.dataset.cxHeroTop;
    };
    window.addEventListener('scroll', onScroll, { passive: true }); onScroll();

    // ── reloj ──
    const t0 = performance.now() / 1000;
    let clock = -1, settleAt = -1, done = !wantIntro, flipDone = !wantIntro, shown = 0, raf = 0, last = t0;
    const finish = () => {
      if (done) return; done = true; playedThisLoad = true;
      try { sessionStorage.setItem('cx-intro', '1'); } catch { /* */ }
      delete html.dataset.cxIntro; setStage('hero');
    };
    const ff = () => {
      if (!wantIntro || done) return;
      if (clock < 0) { if (!ready) return; clock = 0; }
      clock = Math.max(clock, (TL.s0 - 0.02) * K);
      document.getAnimations?.().forEach((an) => { try { an.finish(); } catch { /* */ } });
    };
    skipRef.current = ff;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') ff(); };
    window.addEventListener('keydown', onKey);

    const _v = new THREE.Vector3(), _r = new THREE.Vector3(), _c = new THREE.Color();
    const rectOf = () => {
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (let i = 0; i < 8; i++) {
        _v.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).project(camera);
        const x = (_v.x * 0.5 + 0.5) * W, y = (-_v.y * 0.5 + 0.5) * H;
        x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      }
      return { x0, x1, y0, y1 };
    };
    /** Plano vertical de pantalla en la x dada (normal = derecha de la cámara). */
    const planeAtX = (x: number, out: THREE.Plane, keepLeft: boolean) => {
      _v.set((x / W) * 2 - 1, 0, 0.5).unproject(camera);
      const dir = _v.sub(camera.position).normalize();
      const p = camera.position.clone().addScaledVector(dir, camera.position.distanceTo(center));
      _r.setFromMatrixColumn(camera.matrixWorld, 0).normalize();
      out.setFromNormalAndCoplanarPoint(keepLeft ? _r.clone().negate() : _r, p);
    };

    const frame = () => {
      raf = requestAnimationFrame(frame);
      const now = performance.now() / 1000; const rawDt = now - last; last = now;
      if (document.hidden) return;
      const dt = Math.min(rawDt, 1 / 30);
      // scroll suavizado (el despiece sigue al scroll con inercia corta, sin temblor)
      scrollE += (scrollRaw - scrollE) * (1 - Math.exp(-dt * 10));
      const ex = done ? easeOut(scrollE) : 0;
      // el despiece deja paso al contenido: se apaga entre el 40 % y el 90 % del recorrido
      layer.style.opacity = String(done ? 1 - smooth(0.4, 0.9, scrollE) : 1);
      if (done && scrollE > 0.9) return;
      // carga: etapas reales + suavizado crítico
      const parseK = stage2 ? 1 : parseT0 ? 1 - Math.exp(-(performance.now() - parseT0) / 450) : 0;
      const target = ready ? 1 : Math.min(0.995, dl * 0.7 + parseK * 0.1 + prep * 0.2);
      shown += (target - shown) * (1 - Math.exp(-dt * 7));
      if (ready && target - shown < 0.004) shown = 1;
      if (countRef.current) countRef.current.textContent = String(Math.round(clamp01(shown) * 100)).padStart(3, '0');
      if (wantIntro && failed) { finish(); flipDone = true; curtainRef.current?.classList.add('out'); }
      if (wantIntro && clock < 0 && shown >= 1 && now - t0 > (short ? 0.25 : 0.5)) { clock = 0; hudRef.current?.classList.add('loaded'); }
      // depuración: window.__cxIntroAt = 1.2 fija el instante sin recargar (solo con ?introAt)
      const fz = (window as unknown as { __cxIntroAt?: number }).__cxIntroAt;
      if (Number.isFinite(freezeAt) && typeof fz === 'number') freezeAt = fz;
      if (clock >= 0 && !done) clock = Number.isFinite(freezeAt) ? freezeAt : clock + dt;
      const t = !wantIntro || done ? 99 : clock < 0 ? -1 : clock / K;
      // línea: crece desde el centro con la carga; al 100 % se recoge en un punto de luz
      if (lineRef.current && !done) lineRef.current.style.transform = `scaleX(${(clamp01(shown) * (t < 0 ? 1 : 1 - ease((t - TL.c0) / TL.c))).toFixed(4)})`;
      if (dotRef.current && !done) {
        const a = t < 0 ? 0 : smooth(0.2, TL.c, t) * (1 - smooth(TL.sk0 + 0.2, TL.sk0 + 0.6, t));
        dotRef.current.style.opacity = a.toFixed(3);
        dotRef.current.style.transform = `translate(-50%,-50%) scale(${(0.6 + 0.8 * smooth(0.2, TL.c, t)).toFixed(3)})`;
      }
      if (!ready || compiling) { if (!compiling) renderer.render(scene, camera); return; }
      pivot.visible = t >= TL.sk0;

      // ── fases ──
      const sk = easeOut((t - TL.sk0) / TL.sk), de = easeOut((t - TL.de0) / TL.de), dz = ease((t - TL.dz0) / TL.dz);
      const u = ease((t - TL.r0) / TL.r), v = ease((t - TL.m0) / TL.m), s4 = ease((t - TL.s0) / TL.s);
      const k = done ? 1 : s4;
      // cámara: frontal y plana (13°) → 3/4 en perspectiva (30°); el encuadre se recalcula con el fov (dolly-zoom)
      const rate = done ? 0.05 : t < TL.s0 ? 0.14 * dz : lerp(0.14, 0.05, ease((t - TL.s0) / 1.6));
      if (t >= TL.dz0 && !Number.isFinite(freezeAt)) spin += dt * rate;
      mxS += (mx - mxS) * Math.min(1, dt * 3); myS += (my - myS) * Math.min(1, dt * 3);
      camera.fov = done ? FOV1 : lerp(FOV0, FOV1, dz);
      const theta = lerp(0, 0.95, done ? 1 : dz) + spin + mxS * 0.22 * k + ex * 0.9;
      const phi = lerp(0.04, 1.16, done ? 1 : dz) + myS * 0.06 * k - ex * 0.62;
      const mobile = W < 760 || W / H < 0.95;
      const tgt = mobile ? { x0: 0.04, x1: 0.96, y0: 0.09, y1: 0.47 } : { x0: 0.46, x1: 1.0, y0: 0.06, y1: 0.96 };
      const rx0 = lerp(0.12, tgt.x0, k) * W, rx1 = lerp(0.88, tgt.x1, k) * W, ry0 = lerp(0.16, tgt.y0, k) * H, ry1 = lerp(0.84, tgt.y1, k) * H;
      const vf = THREE.MathUtils.degToRad(camera.fov), hfT = Math.tan(vf / 2) * (W / H), vfT = Math.tan(vf / 2);
      const halfV = (size.y * Math.sin(phi) + 2 * rH * Math.abs(Math.cos(phi))) / 2;
      const fit = Math.max(rH / (hfT * ((rx1 - rx0) / W)), halfV / (vfT * ((ry1 - ry0) / H))) * 0.92 + rH * 0.15;
      const r = fit * (1 + ex * 0.15);
      camera.position.set(center.x + r * Math.sin(phi) * Math.sin(theta), center.y + r * Math.cos(phi), center.z + r * Math.sin(phi) * Math.cos(theta));
      camera.lookAt(center);
      // parallax: mientras el contenido sube desde abajo, el dron despiezado sube y se aparta
      const offX = -((rx0 + rx1) / 2 - W / 2), offY = H / 2 - (ry0 + ry1) / 2 + ex * H * 0.32;
      if (Math.abs(offX) + Math.abs(offY) > 0.5) camera.setViewOffset(W, H, offX, offY, W, H); else camera.clearViewOffset();
      camera.near = Math.max(0.05, r / 60); camera.far = r * 8;
      camera.updateProjectionMatrix(); camera.updateMatrixWorld();
      uExplode.value = ex * 1.25;

      // aristas: esqueleto y detalle se dibujan del centro hacia afuera, cada uno con su frente de luz
      const draw = (obj: THREE.LineSegments, front: THREE.LineSegments, n: number, p: number) => {
        const head = Math.floor(n * p), band = Math.max(4, Math.floor(n * 0.06));
        obj.geometry.setDrawRange(0, head * 2);
        front.visible = p > 0 && p < 1;
        front.geometry.setDrawRange(Math.max(0, head - band) * 2, Math.min(band, head) * 2);
      };
      { // icono: avanza por CLAVE (brazos y cuerpo 0–1, círculos 1–2), no por número de segmentos
        const kt = (done ? 1 : sk) * 2; let lo = 0, hi = skKeys.length;
        while (lo < hi) { const mid = (lo + hi) >> 1; if (skKeys[mid] <= kt) lo = mid + 1; else hi = mid; }
        draw(skel!, frontS!, nSk, nSk ? lo / nSk : 0);
        const fadeIcon = 1 - smooth(TL.de0 + 0.3, TL.de0 + 1.0, t);
        skel!.visible = !done && fadeIcon > 0.01; frontS!.visible = frontS!.visible && skel!.visible;
        skelMat.opacity = 0.95 * fadeIcon;
      }
      draw(edges!, frontD!, nDet, done ? 1 : de);

      const yTop = box.max.y + 0.02, yBot = box.min.y - 0.02;
      if (!done && t < TL.s0 + TL.v * 0.3) {
        // intro: cortes horizontales
        const sR = lerp(yTop, yBot, u), sM = lerp(yBot, yTop, v);
        real!.visible = u > 0;
        planeReal.normal.set(0, 1, 0); planeReal.constant = v > 0 ? -sM : u > 0 ? -sR : -1e6;
        planeMin.normal.set(0, -1, 0); planeMin.constant = v > 0 ? sM : -1e6;
        planeEdge.normal.set(0, 1, 0); planeEdge.constant = 1e6;
        const scanOn = (u > 0 && u < 1) || (v > 0 && v < 1);
        scan!.position.y = v > 0 ? sM : sR; scanMat.opacity = scanOn ? 0.95 : 0;
        const eo = lerp(lerp(0.6, 0.12, u), cols.edgeOp, v);
        edgeMat.opacity = eo;
        edgeMat.color.set(0xe9e6df); skelMat.color.set(0xf4f2ec);
        if (dividerRef.current) dividerRef.current.style.opacity = '0';
      } else {
        // hero: la línea entra horizontal, gira 90° y es el divisor; lo realista entra hasta ella
        scanMat.opacity = 0; real!.visible = true;
        if (heroT < 0) heroT = now;
        const rc = rectOf(), cx = (rc.x0 + rc.x1) / 2, cy = (rc.y0 + rc.y1) / 2, w = rc.x1 - rc.x0, h = rc.y1 - rc.y0;
        const rot = done ? 1 : easeOutExpo((t - TL.v0) / TL.v);            // 0 = horizontal · 1 = vertical
        const wipe = done ? 1 : ease((t - TL.w0) / TL.w);
        const idle = now - lastMove > 2.5 || window.matchMedia('(pointer: coarse)').matches;
        const target2 = idle ? cx + 0.3 * w * Math.sin((now - heroT) * 0.55) : rc.x0 + ((mx + 1) / 2) * w;
        if (divX < 0) divX = cx;
        if (rot >= 1) divX += (target2 - divX) * Math.min(1, dt * (idle ? 1.5 : 6));
        // frontera real|esencial: barrido desde la izquierda hasta el divisor; al hacer scroll, todo esencial
        let bx = lerp(rc.x0 - 2, divX, wipe);
        bx = lerp(bx, rc.x0 - 2, smooth(0, 0.12, scrollE));
        planeAtX(bx, planeReal, true); planeAtX(bx, planeMin, false); planeEdge.copy(planeMin);
        _c.set(0xe9e6df).lerp(cols.edge, k); edgeMat.color.copy(_c); skelMat.color.copy(_c);
        edgeMat.opacity = cols.edgeOp;
        const dv = dividerRef.current;
        if (dv) {
          const len = lerp(w * 0.9, h, rot), x = lerp(cx, divX, rot);
          dv.style.opacity = String(clamp01(smooth(TL.v0 - 0.15, TL.v0 + 0.1, done ? 99 : t)) * (1 - smooth(0, 0.1, scrollE)));
          dv.style.height = `${Math.max(0, len).toFixed(0)}px`;
          dv.style.transform = `translate3d(${x.toFixed(1)}px, ${(cy - len / 2).toFixed(1)}px, 0) rotate(${((1 - rot) * 90).toFixed(2)}deg)`;
          dv.classList.toggle('labels', rot >= 1);
        }
      }
      minMat.color.lerp(cols.face, 0.1); accMat.color.lerp(cols.acc, 0.1); accMat.emissive.copy(accMat.color);

      // titular y cierre
      if (wantIntro && !done) {
        introTitleRef.current?.classList.toggle('l1', t > TL.t1);
        introTitleRef.current?.classList.toggle('l2', t > TL.t2);
        hudRef.current?.classList.toggle('skip-on', now - t0 > 1.5);
        if (t >= TL.s0 && settleAt < 0) {
          settleAt = now;
          curtainRef.current?.classList.add('out');
          hudRef.current?.classList.add('out');
          const a2 = introTitleRef.current, b2 = heroTitleRef.current;
          if (a2 && b2) {
            const ra = a2.getBoundingClientRect(), rb = b2.getBoundingClientRect();
            const to = getComputedStyle(b2).color;
            a2.style.transformOrigin = '0 0';
            a2.animate([{ transform: 'translate(0,0) scale(1)', color: '#edeee8' }, { transform: `translate(${rb.left - ra.left}px, ${rb.top - ra.top}px) scale(${rb.height / Math.max(1, ra.height)})`, color: to }],
              { duration: 1100 * K, easing: 'cubic-bezier(.65,0,.35,1)', fill: 'forwards' })
              .finished.then(() => { flipDone = true; b2.classList.add('in'); a2.style.opacity = '0'; }).catch(() => { flipDone = true; });
          } else flipDone = true;
        }
        // salvaguarda: si el viaje del titular no termina (pestaña oculta, animaciones pausadas), se completa igual
        if (settleAt > 0 && !flipDone && now - settleAt > 2 * K) { flipDone = true; heroTitleRef.current?.classList.add('in'); if (introTitleRef.current) introTitleRef.current.style.opacity = '0'; }
        if (settleAt > 0 && flipDone && t >= TL.w0 + TL.w) finish();
      }
      renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      disposed = true; cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize); window.removeEventListener('pointermove', onMove);
      window.removeEventListener('scroll', onScroll); window.removeEventListener('keydown', onKey);
      delete html.dataset.cxHeroTop;
      mo.disconnect(); disposables.forEach((d) => d.dispose()); renderer.dispose(); renderer.domElement.remove();
      if (!done) { playedThisLoad = true; delete html.dataset.cxIntro; }
    };
  }, [mounted, lang]);

  const scrollTo = (sel: string) => document.querySelector(sel)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const hero = stage === 'hero';
  return (
    <>
      <section className={`ih-hero${hero ? ' ih-on' : ''}`} aria-label={`${L.l1} ${L.l2a}${L.l2b}`}>
        <div className="ih-copy">
          <p className="ih-kicker">{L.kicker}</p>
          <h1 className={`ih-h1${hero ? ' in' : ''}`} ref={heroTitleRef}><span>{L.l1}</span><span>{L.l2a}<em>{L.l2b}</em>.</span></h1>
          <p className="ih-sub">{L.sub}</p>
          <div className="ih-ctas">
            <button type="button" className="ih-btn pri" onClick={() => scrollTo('#cx-goals')}>{L.quote} <span aria-hidden="true">↓</span></button>
            <button type="button" className="ih-btn" onClick={() => scrollTo('.cx-show')}>{L.work}</button>
          </div>
        </div>
        <div className="ih-cue" aria-hidden="true"><i />{L.scroll}</div>
      </section>
      {mounted && createPortal(
        <div className={`ih-root${hero ? ' ih-done' : ''}`} aria-hidden={hero ? 'true' : undefined}>
          <div ref={curtainRef} className="ih-curtain" />
          <div ref={layerRef} className="ih-layer">
            <div ref={dividerRef} className="ih-divider"><span className="l">← {L.real}</span><span className="r">{L.ess} →</span></div>
          </div>
          {!hero && (
            <div ref={hudRef} className="ih-hud ih-v34" role="status" aria-live="polite">
              <div ref={introTitleRef} className="ih-intro-title" aria-hidden="true"><span>{L.l1}</span><span>{L.l2a}<em>{L.l2b}</em>.</span></div>
              <div className="ih-hud-bot">
                <span className="ih-count"><b ref={countRef}>000</b></span>
                <button type="button" className="ih-skip" onClick={() => skipRef.current()}>{L.skip} →</button>
              </div>
              <i ref={lineRef} className="ih-bar" />
              <i ref={dotRef} className="ih-dot" />
            </div>
          )}
        </div>,
        document.body,
      )}
    </>
  );
}
