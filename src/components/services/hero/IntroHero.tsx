/**
 * IntroHero.tsx — Pantalla de inicio (carga) que se convierte en el hero.
 * Ciclo 32: "de lo complejo a lo esencial" con el X500 (aristas → realista → esencial → hero).
 * Ciclo 33: la MARCA entra en la historia y se corrige la fluidez.
 *
 *  · UNA SOLA LÍNEA cuenta toda la historia:
 *      carga (la línea crece con los bytes reales)
 *      → se contrae y se vuelve la BARRA de la A del monograma AW (la W se dibuja desde ella)
 *      → el monograma suelta las iniciales "A W" y se escribe "Alex Woodcock"
 *      → el logotipo viaja a la barra superior
 *      → la línea vuelve como CORTE que barre el dron (realista / esencial)
 *      → en el hero gira 90° y es el DIVISOR "realista | esencial" que mueve el usuario.
 *  · Variantes para comparar (parámetro ?intro=…, se recuerda en la sesión):
 *      brand (por defecto) · minimal (marca + dron sin fase realista, ~4 s) · classic (ciclo 32).
 *  · Fluidez: decodificación meshopt en workers, preparación por lotes (cede un cuadro cada
 *    ~8 ms), sombreadores precompilados (compileAsync) y texturas subidas ANTES de empezar,
 *    número de planos de recorte constante (sin recompilar a mitad) y reloj de animación
 *    propio con dt acotado (si el navegador se atasca, la animación se pausa; nunca salta).
 */
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { preloadHolybro, meshEffectiveName } from '../holybro';
import { BrandMark } from './BrandMark';
import './hero.css';

type Lang = 'es' | 'en';
type Variant = 'brand' | 'minimal' | 'classic';
let playedThisLoad = false;

const T = {
  es: { kicker: '3D · Web · IA', l1: 'De lo complejo', l2a: 'a lo ', l2b: 'esencial', sub: 'Modelos, webs y experiencias 3D que tus clientes entienden a la primera. Cotiza tu proyecto en un minuto.',
    quote: 'Cotizar mi proyecto', work: 'Ver trabajo real', skip: 'Saltar', load: 'Cargando', ph: ['01 · Bordes', '02 · Realista', '03 · Esencial'], real: 'Realista', ess: 'Esencial', scroll: 'Desliza' },
  en: { kicker: '3D · Web · AI', l1: 'From complex', l2a: 'to ', l2b: 'essential', sub: '3D models, websites and experiences your clients understand at first glance. Quote your project in a minute.',
    quote: 'Quote my project', work: 'See real work', skip: 'Skip', load: 'Loading', ph: ['01 · Edges', '02 · Realistic', '03 · Essential'], real: 'Realistic', ess: 'Essential', scroll: 'Scroll' },
};
/** Fases del dron por variante (segundos de animación; se escalan con K). */
const PH: Record<Variant, { e: number; r0: number; r: number; m0: number; m: number; settle: number; t1: number; t2: number; d0: number }> = {
  classic: { e: 1.6, r0: 1.3, r: 1.3, m0: 2.9, m: 1.3, settle: 4.5, t1: 1.5, t2: 3.1, d0: 0 },
  brand:   { e: 1.4, r0: 1.1, r: 1.2, m0: 2.5, m: 1.2, settle: 3.9, t1: 1.3, t2: 2.7, d0: 2.35 },
  minimal: { e: 1.0, r0: 99, r: 0, m0: 0.8, m: 1.0, settle: 2.1, t1: 0.6, t2: 1.2, d0: 2.35 },
};
const NAME = ['A', 'lex', ' ', 'W', 'oodcock'];

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const ease = (x: number) => { x = clamp01(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

function pickVariant(): Variant {
  const ok = (v: unknown): v is Variant => v === 'brand' || v === 'minimal' || v === 'classic';
  try {
    const q = new URLSearchParams(location.search).get('intro');
    if (ok(q)) { sessionStorage.setItem('cx-intro-v', q); return q; }
    const s = sessionStorage.getItem('cx-intro-v'); if (ok(s)) return s;
  } catch { /* sin almacenamiento */ }
  return 'brand';
}

/** Copia float (los GLB están cuantizados) de posiciones/normales ya en espacio mundo. */
function worldFloat(m: THREE.Mesh) {
  const pa = m.geometry.getAttribute('position'), na = m.geometry.getAttribute('normal');
  const P = new Float32Array(pa.count * 3), N = new Float32Array(pa.count * 3);
  const v = new THREE.Vector3(), nm = new THREE.Matrix3().getNormalMatrix(m.matrixWorld);
  for (let i = 0; i < pa.count; i++) {
    v.set(pa.getX(i), pa.getY(i), pa.getZ(i)).applyMatrix4(m.matrixWorld); P[i * 3] = v.x; P[i * 3 + 1] = v.y; P[i * 3 + 2] = v.z;
    if (na) { v.set(na.getX(i), na.getY(i), na.getZ(i)).applyMatrix3(nm).normalize(); N[i * 3] = v.x; N[i * 3 + 1] = v.y; N[i * 3 + 2] = v.z; }
  }
  const idx = m.geometry.index ? (m.geometry.index.array as ArrayLike<number>) : null;
  return { P, N, idx, count: pa.count };
}
function merge(parts: ReturnType<typeof worldFloat>[]) {
  const total = parts.reduce((a, p) => a + p.count, 0);
  const nIdx = parts.reduce((a, p) => a + (p.idx ? p.idx.length : p.count), 0);
  const P = new Float32Array(total * 3), N = new Float32Array(total * 3), I = new Uint32Array(nIdx);
  let off = 0, io = 0;
  for (const p of parts) {
    P.set(p.P, off * 3); N.set(p.N, off * 3);
    if (p.idx) for (let k = 0; k < p.idx.length; k++) I[io++] = p.idx[k] + off; else for (let k = 0; k < p.count; k++) I[io++] = k + off;
    off += p.count;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.BufferAttribute(N, 3));
  g.setIndex(new THREE.BufferAttribute(I, 1)); return g;
}

export function IntroHero({ lang = 'es' }: { lang?: Lang }) {
  const L = T[lang];
  const [mounted, setMounted] = useState(false);
  const [stage, setStage] = useState<'intro' | 'hero'>('intro');
  const [variant, setVariant] = useState<Variant>('brand');
  const [showLock, setShowLock] = useState(true);   // el logotipo de la intro se desvanece tras el relevo con la barra
  const layerRef = useRef<HTMLDivElement>(null);
  const curtainRef = useRef<HTMLDivElement>(null);
  const hudRef = useRef<HTMLDivElement>(null);
  const countRef = useRef<HTMLSpanElement>(null);
  const phaseRef = useRef<HTMLSpanElement>(null);
  const lineRef = useRef<HTMLElement>(null);
  const lockRef = useRef<HTMLDivElement>(null);
  const introTitleRef = useRef<HTMLDivElement>(null);
  const heroTitleRef = useRef<HTMLHeadingElement>(null);
  const dividerRef = useRef<HTMLDivElement>(null);
  const skipRef = useRef<() => void>(() => {});

  useEffect(() => { setVariant(pickVariant()); setMounted(true); }, []);

  useEffect(() => {
    if (!mounted) return;
    const html = document.documentElement;
    const V: Variant = variant, P = PH[V], brand = V !== 'classic';
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const wantIntro = !playedThisLoad && !reduce && html.dataset.cxIntro !== undefined;
    let short = false;
    try { short = sessionStorage.getItem('cx-intro') === '1'; } catch { /* sin almacenamiento */ }
    const K = short ? 0.55 : 1;
    if (wantIntro) html.dataset.cxIntro = 'on'; else { delete html.dataset.cxIntro; setStage('hero'); setShowLock(false); }
    MeshoptDecoder.useWorkers?.(2);   // decodificación fuera del hilo principal

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
    const camera = new THREE.PerspectiveCamera(30, 1, 0.05, 60);
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
    const planeReal = new THREE.Plane(new THREE.Vector3(0, 1, 0), 1e6);
    const planeMin = new THREE.Plane(new THREE.Vector3(0, -1, 0), -1e6);
    const planeEdge = new THREE.Plane(new THREE.Vector3(0, 1, 0), 1e6);
    const minMat = new THREE.MeshStandardMaterial({ color: cols.face, roughness: 0.82, metalness: 0.0, clippingPlanes: [planeMin], polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
    const accMat = new THREE.MeshStandardMaterial({ color: cols.acc, roughness: 0.55, metalness: 0.1, emissive: cols.acc, emissiveIntensity: 0.25, clippingPlanes: [planeMin], polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
    const edgeMat = new THREE.LineBasicMaterial({ color: 0xe9e6df, transparent: true, opacity: 0.6, depthWrite: false, clippingPlanes: [planeEdge] });
    const frontMat = new THREE.LineBasicMaterial({ color: 0xff7a3d, transparent: true, opacity: 1, depthWrite: false, blending: THREE.AdditiveBlending });
    const scanMat = new THREE.LineBasicMaterial({ color: 0xff7a3d, transparent: true, opacity: 0, depthWrite: false });
    const disposables: { dispose: () => void }[] = [env, pmrem, minMat, accMat, edgeMat, frontMat, scanMat];

    const pivot = new THREE.Group(); pivot.visible = false; scene.add(pivot);
    let ready = false, failed = false, disposed = false;
    const box = new THREE.Box3(), center = new THREE.Vector3(), size = new THREE.Vector3(1, 0.5, 1);
    let rH = 1.3;
    let edges: THREE.LineSegments | null = null, front: THREE.LineSegments | null = null, segCount = 0;
    let real: THREE.Group | null = null, scan: THREE.LineLoop | null = null;
    // progreso por etapas reales: descarga 0–70 % · decodificación 70–80 % · preparación 80–100 %
    let dl = 0, stage2 = 0, prep = 0, parseT0 = 0;
    let compiling = false;

    (async () => {
      const root = await preloadHolybro((p) => { dl = p; if (p >= 0.99 && !parseT0) parseT0 = performance.now(); });
      if (disposed) return;
      stage2 = 1;
      const drone = root.clone(true);
      pivot.add(drone); pivot.updateMatrixWorld(true);
      box.setFromObject(drone); box.getCenter(center); box.getSize(size);
      rH = Math.hypot(size.x, size.z) / 2;
      const meshes: THREE.Mesh[] = []; drone.traverse((o) => { if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh); });
      const matMap = new Map<THREE.Material, THREE.Material>();
      const minParts: ReturnType<typeof worldFloat>[] = [], accParts: ReturnType<typeof worldFloat>[] = [];
      const segA: number[] = [], segD: number[] = [];
      const a = new THREE.Vector3(), b = new THREE.Vector3();
      let budget = performance.now();
      for (let i = 0; i < meshes.length; i++) {
        const m = meshes[i];
        const src = m.material as THREE.Material;
        let c = matMap.get(src);
        if (!c) { c = src.clone(); (c as THREE.MeshStandardMaterial).clippingPlanes = [planeReal]; matMap.set(src, c); disposables.push(c); }
        m.material = c;
        const wf = worldFloat(m);
        (/DJ-2216/i.test(meshEffectiveName(m)) ? accParts : minParts).push(wf);
        const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(wf.P, 3)); if (wf.idx) g.setIndex(Array.from(wf.idx));
        const eg = new THREE.EdgesGeometry(g, 28); const ep = eg.getAttribute('position');
        for (let k = 0; k < ep.count; k += 2) {
          a.set(ep.getX(k), ep.getY(k), ep.getZ(k)); b.set(ep.getX(k + 1), ep.getY(k + 1), ep.getZ(k + 1));
          segA.push(a.x, a.y, a.z, b.x, b.y, b.z);
          segD.push(Math.hypot((a.x + b.x) / 2 - center.x, (a.y + b.y) / 2 - center.y, (a.z + b.z) / 2 - center.z));
        }
        g.dispose(); eg.dispose();
        prep = (i + 1) / meshes.length * 0.85;
        if (performance.now() - budget > 8) { await nextFrame(); budget = performance.now(); if (disposed) return; }
      }
      real = drone;
      // aristas ordenadas del centro hacia afuera (índice ordenado, sin objetos por segmento)
      segCount = segD.length;
      const order = new Uint32Array(segCount); for (let i = 0; i < segCount; i++) order[i] = i;
      order.sort((x, y) => segD[x] - segD[y]);
      const EP = new Float32Array(segCount * 6);
      for (let i = 0; i < segCount; i++) { const o = order[i] * 6; for (let k = 0; k < 6; k++) EP[i * 6 + k] = segA[o + k]; }
      await nextFrame(); if (disposed) return;
      const eGeo = new THREE.BufferGeometry(); eGeo.setAttribute('position', new THREE.BufferAttribute(EP, 3));
      edges = new THREE.LineSegments(eGeo, edgeMat); edges.renderOrder = 3; edges.frustumCulled = false; pivot.add(edges);
      const fGeo = new THREE.BufferGeometry(); fGeo.setAttribute('position', eGeo.getAttribute('position'));
      front = new THREE.LineSegments(fGeo, frontMat); front.renderOrder = 4; front.frustumCulled = false; pivot.add(front);
      const minMesh = new THREE.Mesh(merge(minParts), minMat), accMesh = new THREE.Mesh(merge(accParts), accMat);
      minMesh.frustumCulled = accMesh.frustumCulled = false;
      pivot.add(minMesh, accMesh);
      const s = size.clone().multiplyScalar(0.56);
      const sg = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-s.x, 0, -s.z), new THREE.Vector3(s.x, 0, -s.z), new THREE.Vector3(s.x, 0, s.z), new THREE.Vector3(-s.x, 0, s.z)]);
      scan = new THREE.LineLoop(sg, scanMat); scan.position.copy(center); pivot.add(scan);
      disposables.push(eGeo, fGeo, minMesh.geometry, accMesh.geometry, sg);
      prep = 0.9; await nextFrame(); if (disposed) return;
      // sube texturas y compila sombreadores ANTES de animar (antes: tirón al aparecer cada fase)
      const texKeys = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap'] as const;
      matMap.forEach((mm) => texKeys.forEach((k) => { const t = (mm as unknown as Record<string, THREE.Texture | null>)[k]; if (t) renderer.initTexture(t); }));
      camera.position.set(center.x, center.y + 2, center.z + 6); camera.lookAt(center);
      pivot.visible = true; compiling = true;
      try { await renderer.compileAsync(pivot, camera, scene); } catch { /* sin paralelismo: compila al primer dibujo */ }
      compiling = false;
      if (disposed) return;
      prep = 1; ready = true;
    })().catch(() => { failed = true; });

    // ── interacción ──
    let mx = 0, my = 0, mxS = 0, myS = 0, spin = 0, lastMove = -10, divX = -1;
    const onMove = (e: PointerEvent) => { mx = e.clientX / W * 2 - 1; my = e.clientY / H * 2 - 1; lastMove = performance.now() / 1000; };
    window.addEventListener('pointermove', onMove, { passive: true });
    let scrollK = 0;
    const onScroll = () => {
      scrollK = clamp01(window.scrollY / (H * 0.85));
      if (window.scrollY < 24) html.dataset.cxHeroTop = '1'; else delete html.dataset.cxHeroTop;
    };
    window.addEventListener('scroll', onScroll, { passive: true }); onScroll();

    // ── reloj: dt acotado → si el navegador se atasca, la animación se pausa (nunca salta) ──
    const t0 = performance.now() / 1000;
    let clock = -1, settleAt = -1, done = !wantIntro, flipDone = !wantIntro, shown = 0, raf = 0, last = t0;
    const brandSteps = { line: false, draw: false, ini: false, full: false, fly: false };
    const finish = () => {
      if (done) return; done = true; playedThisLoad = true;
      try { sessionStorage.setItem('cx-intro', '1'); } catch { /* */ }
      delete html.dataset.cxIntro; setStage('hero');
      setTimeout(() => setShowLock(false), 1500);
    };
    const ff = () => { // saltar: lleva el reloj al final de la coreografía
      if (!wantIntro || done) return;
      if (clock < 0) { if (!ready) return; clock = 0; }
      clock = Math.max(clock, P.d0 * K + (P.settle - 0.05) * K);
      document.getAnimations?.().forEach((an) => { try { an.finish(); } catch { /* */ } });
      lockRef.current?.classList.add('gone');
    };
    skipRef.current = ff;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') ff(); };
    window.addEventListener('keydown', onKey);

    const _v = new THREE.Vector3(), _r = new THREE.Vector3(), _c = new THREE.Color();
    const rectOf = () => {
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (let i = 0; i < 8; i++) {
        _v.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).applyMatrix4(pivot.matrixWorld).project(camera);
        const x = (_v.x * 0.5 + 0.5) * W, y = (-_v.y * 0.5 + 0.5) * H;
        x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      }
      return { x0, x1, y0, y1 };
    };

    /** Secuencia de marca (2D): línea → barra de la A → W → iniciales → nombre → barra superior. */
    const brandTick = (c: number) => {
      const lock = lockRef.current, line = lineRef.current;
      if (!lock || !line) return;
      if (!brandSteps.line) {
        brandSteps.line = true;
        const bar = lock.querySelector('.aw-bar') as SVGGraphicsElement | null;
        const rb = bar?.getBoundingClientRect(), rl = line.getBoundingClientRect();
        if (rb && rl.width > 0) {
          line.style.transformOrigin = '0 50%';
          line.animate([{ transform: 'translate(0,0) scale(1,1)' },
            { transform: `translate(${rb.left - rl.left}px, ${rb.top + rb.height / 2 - (rl.top + rl.height / 2)}px) scale(${rb.width / rl.width}, ${rb.height / Math.max(1, rl.height)})` }],
          { duration: 650 * K, easing: 'cubic-bezier(.7,0,.2,1)', fill: 'forwards' }).finished.then(() => { lock.classList.add('bar'); line.style.opacity = '0'; }).catch(() => {});
        } else lock.classList.add('bar');
      }
      if (!brandSteps.draw && c > 0.55 * K) { brandSteps.draw = true; lock.classList.add('draw'); }
      if (!brandSteps.ini && c > 1.2 * K) { brandSteps.ini = true; lock.classList.add('ini'); }
      if (!brandSteps.full && c > 1.55 * K) { brandSteps.full = true; lock.classList.add('full'); }
      if (!brandSteps.fly && c > 2.35 * K) {
        brandSteps.fly = true;
        const navB = document.querySelector('.cx-nav .cx-brand') as HTMLElement | null;
        const rl = lock.getBoundingClientRect(), rn = navB?.getBoundingClientRect();
        if (rn && rn.width > 0) {
          const sc = rn.height / rl.height;
          lock.style.transformOrigin = '0 0';
          lock.animate([{ transform: 'translate(0,0) scale(1)' }, { transform: `translate(${rn.left - rl.left}px, ${rn.top - rl.top}px) scale(${sc})` }],
            { duration: 950 * K, easing: 'cubic-bezier(.7,0,.2,1)', fill: 'forwards' });
        } else lock.classList.add('gone');
      }
    };

    const frame = () => {
      raf = requestAnimationFrame(frame);
      const now = performance.now() / 1000; const rawDt = now - last; last = now;
      if (document.hidden) return;
      const dt = Math.min(rawDt, 1 / 30);
      const fade = 1 - scrollK;
      layer.style.opacity = String(done ? fade : 1);
      if (done && fade <= 0.001) return;
      // barra de carga: etapas reales + suavizado crítico (no se "traba": siempre avanza mientras hay trabajo)
      const parseK = stage2 ? 1 : parseT0 ? 1 - Math.exp(-(performance.now() - parseT0) / 450) : 0;
      const target = ready ? 1 : Math.min(0.995, dl * 0.7 + parseK * 0.1 + prep * 0.2);
      shown += (target - shown) * (1 - Math.exp(-dt * 7));
      if (ready && target - shown < 0.004) shown = 1;
      if (countRef.current) countRef.current.textContent = String(Math.round(clamp01(shown) * 100)).padStart(3, '0');
      if (lineRef.current && !brandSteps.line) lineRef.current.style.transform = `scaleX(${clamp01(shown).toFixed(4)})`;
      if (wantIntro && failed) { finish(); flipDone = true; curtainRef.current?.classList.add('out'); }
      if (!ready || compiling) { if (!compiling) renderer.render(scene, camera); return; }
      if (wantIntro && clock < 0 && shown >= 1 && now - t0 > (short ? 0.3 : 0.6)) { clock = 0; hudRef.current?.classList.add('loaded'); }
      if (clock >= 0 && !done) clock += dt;

      // secuencia de marca
      if (wantIntro && !done && brand && clock >= 0) brandTick(clock);
      const t = !wantIntro || done ? 99 : clock < 0 ? -1 : (clock - P.d0 * K) / K;   // tiempo del dron
      const edgeP = t < 0 ? 0 : ease(t / P.e);
      const u = P.r > 0 ? ease((t - P.r0) / P.r) : 0, v = ease((t - P.m0) / P.m), s4 = ease((t - P.settle) / 1.2);
      const yTop = box.max.y + 0.02, yBot = box.min.y - 0.02;
      const sR = lerp(yTop, yBot, u), sM = lerp(yBot, yTop, v);

      if (t >= 0) spin += dt * lerp(0.16 / K, 0.05, done ? 1 : ease((t - P.settle + 0.3) / 1.6));
      const par = done ? 1 : s4;
      mxS += (mx - mxS) * Math.min(1, dt * 3); myS += (my - myS) * Math.min(1, dt * 3);
      const theta = 0.95 + spin + mxS * 0.22 * par;
      const phi = lerp(0.72, 1.16, ease(t / (P.settle + 0.3))) + myS * 0.06 * par;
      const k = done ? 1 : s4;
      const mobile = W < 760 || W / H < 0.95;
      const tgt = mobile ? { x0: 0.04, x1: 0.96, y0: 0.09, y1: 0.47 } : { x0: 0.46, x1: 1.0, y0: 0.06, y1: 0.96 };
      const rx0 = lerp(0.1, tgt.x0, k) * W, rx1 = lerp(0.9, tgt.x1, k) * W, ry0 = lerp(0.12, tgt.y0, k) * H, ry1 = lerp(0.88, tgt.y1, k) * H;
      const vf = THREE.MathUtils.degToRad(camera.fov), hfT = Math.tan(vf / 2) * (W / H), vfT = Math.tan(vf / 2);
      const halfV = (size.y * Math.sin(phi) + 2 * rH * Math.cos(phi)) / 2;
      const fit = Math.max(rH / (hfT * ((rx1 - rx0) / W)), halfV / (vfT * ((ry1 - ry0) / H))) * 0.92 + rH * 0.15;
      const r = fit * lerp(0.66, 1, ease(t / (P.settle + 0.3))) * (1 + scrollK * 0.2);
      camera.position.set(center.x + r * Math.sin(phi) * Math.sin(theta), center.y + r * Math.cos(phi), center.z + r * Math.sin(phi) * Math.cos(theta));
      camera.lookAt(center);
      const offX = -((rx0 + rx1) / 2 - W / 2), offY = H / 2 - (ry0 + ry1) / 2 + scrollK * H * 0.1;
      if (Math.abs(offX) + Math.abs(offY) > 0.5) camera.setViewOffset(W, H, offX, offY, W, H); else camera.clearViewOffset();
      camera.updateProjectionMatrix();
      pivot.updateMatrixWorld(true);
      pivot.visible = t >= 0;

      // aristas: del centro hacia afuera con frente naranja
      const n = segCount, head = Math.floor(n * edgeP), band = Math.floor(n * 0.05);
      edges!.geometry.setDrawRange(0, head * 2);
      front!.visible = edgeP > 0 && edgeP < 1;
      front!.geometry.setDrawRange(Math.max(0, head - band) * 2, Math.min(band, head) * 2);

      if (!done && t < P.settle) {
        real!.visible = u > 0;
        planeReal.normal.set(0, 1, 0); planeReal.constant = v > 0 ? -sM : u > 0 ? -sR : -1e6;
        planeMin.normal.set(0, -1, 0); planeMin.constant = v > 0 ? sM : -1e6;
        planeEdge.normal.set(0, 1, 0); planeEdge.constant = 1e6;
        const scanOn = (u > 0 && u < 1) || (v > 0 && v < 1);
        scan!.position.y = v > 0 ? sM : sR; scanMat.opacity = scanOn ? 0.95 : 0;
        edgeMat.opacity = lerp(lerp(0.75, 0.14, u), cols.edgeOp, v);
        edgeMat.color.set(0xe9e6df);
        if (dividerRef.current) dividerRef.current.style.opacity = '0';
      } else {
        scanMat.opacity = 0; real!.visible = true;
        const rc = rectOf();
        const idle = now - lastMove > 2.5 || window.matchMedia('(pointer: coarse)').matches;
        const target2 = idle ? rc.x0 + (0.5 + 0.3 * Math.sin(now * 0.55)) * (rc.x1 - rc.x0) : rc.x0 + ((mx + 1) / 2) * (rc.x1 - rc.x0);
        if (divX < 0) divX = rc.x1;
        divX += (target2 - divX) * Math.min(1, dt * (idle ? 1.5 : 6));
        _v.set((divX / W) * 2 - 1, 0, 0.5).unproject(camera);
        const dir = _v.sub(camera.position).normalize();
        const p = camera.position.clone().addScaledVector(dir, camera.position.distanceTo(center));
        _r.setFromMatrixColumn(camera.matrixWorld, 0).normalize();
        planeReal.setFromNormalAndCoplanarPoint(_r.clone().negate(), p);
        planeMin.setFromNormalAndCoplanarPoint(_r, p);
        planeEdge.copy(planeMin);
        _c.set(0xe9e6df).lerp(cols.edge, k); edgeMat.color.copy(_c);
        edgeMat.opacity = cols.edgeOp;
        const dv = dividerRef.current;
        if (dv) {
          dv.style.opacity = String(k * fade);
          dv.style.transform = `translate3d(${divX.toFixed(1)}px, ${rc.y0.toFixed(1)}px, 0)`;
          dv.style.height = `${Math.max(0, rc.y1 - rc.y0).toFixed(0)}px`;
        }
      }
      minMat.color.lerp(cols.face, 0.1); accMat.color.lerp(cols.acc, 0.1); accMat.emissive.copy(accMat.color);

      // HUD + título + cierre
      if (wantIntro && !done) {
        const ph = t < 0 ? -1 : t < P.r0 || P.r === 0 ? (t < P.m0 ? 0 : 2) : t < P.m0 ? 1 : 2;
        if (phaseRef.current) phaseRef.current.textContent = ph < 0 ? L.load : L.ph[ph];
        introTitleRef.current?.classList.toggle('l1', t > P.t1);
        introTitleRef.current?.classList.toggle('l2', t > P.t2);
        if (t >= P.settle && settleAt < 0) {
          settleAt = now;
          curtainRef.current?.classList.add('out');
          hudRef.current?.classList.add('out');
          const a2 = introTitleRef.current, b2 = heroTitleRef.current;
          if (a2 && b2) {
            const ra = a2.getBoundingClientRect(), rb = b2.getBoundingClientRect();
            const to = getComputedStyle(b2).color;
            a2.style.transformOrigin = '0 0';
            a2.animate([{ transform: 'translate(0,0) scale(1)', color: '#edeee8' }, { transform: `translate(${rb.left - ra.left}px, ${rb.top - ra.top}px) scale(${rb.height / Math.max(1, ra.height)})`, color: to }],
              { duration: 1100 * K, easing: 'cubic-bezier(.7,0,.2,1)', fill: 'forwards' })
              .finished.then(() => { flipDone = true; b2.classList.add('in'); a2.style.opacity = '0'; }).catch(() => { flipDone = true; });
          } else flipDone = true;
        }
        if (settleAt > 0 && flipDone && now - settleAt > 1.15 * K) finish();
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
  }, [mounted, lang, variant]);

  const scrollTo = (sel: string) => document.querySelector(sel)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const hero = stage === 'hero';
  const brand = variant !== 'classic';
  return (
    <>
      <section className={`ih-hero${hero ? ' ih-on' : ''}`} aria-label={`${L.l1} ${L.l2a}${L.l2b}`}>
        <div className="ih-copy">
          <p className="ih-kicker"><BrandMark size={10} /> Alex Woodcock — {L.kicker}</p>
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
          {brand && showLock && (
                <div ref={lockRef} className="ih-lock" aria-label="Alex Woodcock">
                  <BrandMark className="ih-lock-mark" />
                  <span className="ih-word" aria-hidden="true">
                    {NAME.map((part, i) => part === ' '
                      ? <span key={i} className="sp"> </span>
                      : part.length === 1
                        ? <span key={i} className="ini">{part}</span>
                        : <span key={i} className="rest">{part.split('').map((ch, j) => <span key={j} style={{ ['--i' as string]: j }}>{ch}</span>)}</span>)}
                  </span>
                </div>
          )}
          {!hero && (
            <div ref={hudRef} className={`ih-hud${brand ? ' ih-brand' : ''}`} role="status" aria-live="polite">
              {!brand && <div className="ih-hud-top"><span>Alex Woodcock</span><span>3D · Web · {lang === 'en' ? 'AI' : 'IA'}</span></div>}
              <div ref={introTitleRef} className="ih-intro-title" aria-hidden="true"><span>{L.l1}</span><span>{L.l2a}<em>{L.l2b}</em>.</span></div>
              <div className="ih-hud-bot">
                <span><span ref={phaseRef}>{L.load}</span> <b ref={countRef}>000</b></span>
                <button type="button" className="ih-skip" onClick={() => skipRef.current()}>{L.skip} →</button>
              </div>
              <i ref={lineRef} className="ih-bar" />
            </div>
          )}
        </div>,
        document.body,
      )}
    </>
  );
}
