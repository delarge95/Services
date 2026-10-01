/**
 * IntroHero.tsx — Pantalla de inicio (carga) que se convierte en el hero (ciclo 32).
 *
 * Idea: "de lo complejo a lo esencial". Un solo lienzo 3D a pantalla completa con el X500:
 *   0 · carga   contador real de bytes del GLB (es el mismo modelo que usa todo el cotizador:
 *               la intro lo deja en caché para las demás escenas).
 *   1 · bordes  el dron se dibuja solo con aristas, del centro hacia afuera (frente naranja).
 *   2 · real    un barrido de luz baja y revela las caras con sus materiales reales.
 *   3 · esencial un segundo barrido sube y lo convierte en objeto de diseño: caras planas,
 *               aristas finas, motores en el acento de marca.
 *   4 · hero    el titular viaja a su sitio, la cortina se abre, el dron se queda como hero:
 *               un divisor que sigue al cursor separa "realista" de "esencial" SOBRE el modelo,
 *               con paralaje suave; al hacer scroll se aleja y se apaga (y deja de renderizar).
 * Primera visita de la sesión: versión completa (~6 s). Siguientes: versión corta (~2,5 s).
 * prefers-reduced-motion o volver con el historial: sin intro. "Saltar" / Esc en todo momento.
 */
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { preloadHolybro, meshEffectiveName } from '../holybro';
import './hero.css';

type Lang = 'es' | 'en';
let playedThisLoad = false;

const T = {
  es: { kicker: 'Alex Woodcock — 3D · Web · IA', l1: 'De lo complejo', l2a: 'a lo ', l2b: 'esencial', sub: 'Modelos, webs y experiencias 3D que tus clientes entienden a la primera. Cotiza tu proyecto en un minuto.',
    quote: 'Cotizar mi proyecto', work: 'Ver trabajo real', skip: 'Saltar', load: 'Cargando', ph: ['01 · Bordes', '02 · Realista', '03 · Esencial'], real: 'Realista', ess: 'Esencial', scroll: 'Desliza' },
  en: { kicker: 'Alex Woodcock — 3D · Web · AI', l1: 'From complex', l2a: 'to ', l2b: 'essential', sub: '3D models, websites and experiences your clients understand at first glance. Quote your project in a minute.',
    quote: 'Quote my project', work: 'See real work', skip: 'Skip', load: 'Loading', ph: ['01 · Edges', '02 · Realistic', '03 · Essential'], real: 'Realistic', ess: 'Essential', scroll: 'Scroll' },
};

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const ease = (x: number) => { x = clamp01(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Copia float (los GLB están cuantizados) de posiciones/normales ya en espacio mundo. */
function worldFloat(m: THREE.Mesh) {
  const pa = m.geometry.getAttribute('position'), na = m.geometry.getAttribute('normal');
  const P = new Float32Array(pa.count * 3), N = new Float32Array(pa.count * 3);
  const v = new THREE.Vector3(), nm = new THREE.Matrix3().getNormalMatrix(m.matrixWorld);
  for (let i = 0; i < pa.count; i++) {
    v.set(pa.getX(i), pa.getY(i), pa.getZ(i)).applyMatrix4(m.matrixWorld); P[i * 3] = v.x; P[i * 3 + 1] = v.y; P[i * 3 + 2] = v.z;
    if (na) { v.set(na.getX(i), na.getY(i), na.getZ(i)).applyMatrix3(nm).normalize(); N[i * 3] = v.x; N[i * 3 + 1] = v.y; N[i * 3 + 2] = v.z; }
  }
  const idx = m.geometry.index ? Array.from(m.geometry.index.array as ArrayLike<number>) : null;
  return { P, N, idx, count: pa.count };
}
function merge(parts: ReturnType<typeof worldFloat>[]) {
  const total = parts.reduce((a, p) => a + p.count, 0);
  const P = new Float32Array(total * 3), N = new Float32Array(total * 3), I: number[] = [];
  let off = 0;
  for (const p of parts) {
    P.set(p.P, off * 3); N.set(p.N, off * 3);
    if (p.idx) for (const k of p.idx) I.push(k + off); else for (let k = 0; k < p.count; k++) I.push(k + off);
    off += p.count;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.BufferAttribute(N, 3));
  g.setIndex(I); return g;
}

export function IntroHero({ lang = 'es' }: { lang?: Lang }) {
  const L = T[lang];
  const [mounted, setMounted] = useState(false);
  const [stage, setStage] = useState<'intro' | 'hero'>('intro');
  const layerRef = useRef<HTMLDivElement>(null);      // lienzo fijo (z alto en la intro, 0 en el hero)
  const curtainRef = useRef<HTMLDivElement>(null);    // fondo oscuro de la intro
  const hudRef = useRef<HTMLDivElement>(null);
  const countRef = useRef<HTMLSpanElement>(null);
  const phaseRef = useRef<HTMLSpanElement>(null);
  const barRef = useRef<HTMLElement>(null);
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
    const K = short ? 0.5 : 1;                 // escala de tiempos
    if (wantIntro) html.dataset.cxIntro = 'on'; else { delete html.dataset.cxIntro; setStage('hero'); }

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
    const hemi = new THREE.HemisphereLight(0xffffff, 0x20232a, 0.9); scene.add(hemi);
    const key = new THREE.DirectionalLight(0xffffff, 2.4); key.position.set(-3, 5, 3); scene.add(key);
    const rim = new THREE.DirectionalLight(0xffc7a8, 1.2); rim.position.set(3, 2, -4); scene.add(rim);
    const camera = new THREE.PerspectiveCamera(30, 1, 0.05, 60);
    let W = 1, H = 1;
    const resize = () => { W = window.innerWidth; H = window.innerHeight; renderer.setSize(W, H); camera.aspect = W / H; camera.updateProjectionMatrix(); };
    resize(); window.addEventListener('resize', resize);

    // ── tema (el hero vive sobre el fondo de la página; la intro siempre en oscuro) ──
    const themeCols = () => html.dataset.cxTheme === 'light'
      ? { face: new THREE.Color(0xeef0f3), edge: new THREE.Color(0x1b2433), acc: new THREE.Color(0xc4400d), edgeOp: 0.5 }
      : { face: new THREE.Color(0x15171b), edge: new THREE.Color(0xe9e6df), acc: new THREE.Color(0xff7a3d), edgeOp: 0.55 };
    let cols = themeCols();
    const mo = new MutationObserver(() => { cols = themeCols(); });
    mo.observe(html, { attributes: true, attributeFilter: ['data-cx-theme'] });

    // ── planos de recorte ──
    const planeReal = new THREE.Plane(new THREE.Vector3(0, 1, 0), 99);   // realista: lo que queda del lado positivo
    const planeMin = new THREE.Plane(new THREE.Vector3(0, -1, 0), -99);  // esencial
    const minMat = new THREE.MeshStandardMaterial({ color: cols.face, roughness: 0.82, metalness: 0.0, clippingPlanes: [planeMin], polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
    const accMat = new THREE.MeshStandardMaterial({ color: cols.acc, roughness: 0.55, metalness: 0.1, emissive: cols.acc, emissiveIntensity: 0.25, clippingPlanes: [planeMin], polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
    const edgeMat = new THREE.LineBasicMaterial({ color: 0xe9e6df, transparent: true, opacity: 0.6, depthWrite: false });
    const frontMat = new THREE.LineBasicMaterial({ color: 0xff7a3d, transparent: true, opacity: 1, depthWrite: false, blending: THREE.AdditiveBlending });
    const scanMat = new THREE.LineBasicMaterial({ color: 0xff7a3d, transparent: true, opacity: 0, depthWrite: false });
    const disposables: { dispose: () => void }[] = [env, pmrem, minMat, accMat, edgeMat, frontMat, scanMat];

    const pivot = new THREE.Group(); scene.add(pivot);
    let ready = false, failed = false, box = new THREE.Box3(), center = new THREE.Vector3(), radius = 1.5, rH = 1.3;
    const size = new THREE.Vector3(1, 0.5, 1);
    let edges: THREE.LineSegments | null = null, front: THREE.LineSegments | null = null, segCount = 0;
    let real: THREE.Group | null = null, scan: THREE.LineLoop | null = null;
    let progress = 0, shownProgress = 0;

    preloadHolybro((p) => { progress = p; }).then((root) => {
      if (disposed) return;
      const drone = root.clone(true);
      pivot.add(drone); pivot.updateMatrixWorld(true);
      box = new THREE.Box3().setFromObject(drone); box.getCenter(center);
      radius = box.getSize(size).length() / 2; rH = Math.hypot(size.x, size.z) / 2;
      // realista: materiales originales CLONADOS (los compartidos los usan otras escenas)
      const matMap = new Map<THREE.Material, THREE.Material>();
      const minParts: ReturnType<typeof worldFloat>[] = [], accParts: ReturnType<typeof worldFloat>[] = [];
      const segs: { a: THREE.Vector3; b: THREE.Vector3; d: number }[] = [];
      drone.traverse((o) => {
        const m = o as THREE.Mesh; if (!m.isMesh) return;
        const src = m.material as THREE.Material;
        let c = matMap.get(src);
        if (!c) { c = src.clone(); (c as THREE.MeshStandardMaterial).clippingPlanes = [planeReal]; matMap.set(src, c); disposables.push(c); }
        m.material = c;
        const wf = worldFloat(m);
        (/DJ-2216/i.test(meshEffectiveName(m)) ? accParts : minParts).push(wf);
        // aristas (en espacio mundo) ordenadas del centro hacia afuera
        const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(wf.P, 3)); if (wf.idx) g.setIndex(wf.idx);
        const eg = new THREE.EdgesGeometry(g, 28); const ep = eg.getAttribute('position');
        for (let i = 0; i < ep.count; i += 2) {
          const a = new THREE.Vector3(ep.getX(i), ep.getY(i), ep.getZ(i)), b = new THREE.Vector3(ep.getX(i + 1), ep.getY(i + 1), ep.getZ(i + 1));
          segs.push({ a, b, d: a.clone().add(b).multiplyScalar(0.5).sub(center).length() });
        }
        g.dispose(); eg.dispose();
      });
      real = drone;
      segs.sort((x, y) => x.d - y.d);
      segCount = segs.length;
      const EP = new Float32Array(segCount * 6);
      segs.forEach((s, i) => { EP.set([s.a.x, s.a.y, s.a.z, s.b.x, s.b.y, s.b.z], i * 6); });
      const eGeo = new THREE.BufferGeometry(); eGeo.setAttribute('position', new THREE.BufferAttribute(EP, 3));
      edges = new THREE.LineSegments(eGeo, edgeMat); edges.renderOrder = 3; pivot.add(edges);
      // el frente usa OTRA geometría con el MISMO atributo (el rango de dibujo es por geometría)
      const fGeo = new THREE.BufferGeometry(); fGeo.setAttribute('position', eGeo.getAttribute('position')); disposables.push(fGeo);
      front = new THREE.LineSegments(fGeo, frontMat); front.renderOrder = 4; pivot.add(front);
      const minMesh = new THREE.Mesh(merge(minParts), minMat), accMesh = new THREE.Mesh(merge(accParts), accMat);
      pivot.add(minMesh, accMesh);
      disposables.push(eGeo, minMesh.geometry, accMesh.geometry);
      // rectángulo del barrido (corte horizontal que recorre el dron)
      const s = box.getSize(new THREE.Vector3()).multiplyScalar(0.56);
      const sg = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-s.x, 0, -s.z), new THREE.Vector3(s.x, 0, -s.z), new THREE.Vector3(s.x, 0, s.z), new THREE.Vector3(-s.x, 0, s.z)]);
      scan = new THREE.LineLoop(sg, scanMat); scan.position.copy(center); pivot.add(scan); disposables.push(sg);
      ready = true;
    }).catch(() => { failed = true; });

    // ── interacción ──
    let mx = 0, my = 0, mxS = 0, myS = 0, spin = 0, lastMove = -10, divX = -1, edgeClip = false;
    const onMove = (e: PointerEvent) => { mx = e.clientX / W * 2 - 1; my = e.clientY / H * 2 - 1; lastMove = performance.now() / 1000; };
    window.addEventListener('pointermove', onMove, { passive: true });
    let scrollK = 0;
    const onScroll = () => {
      scrollK = clamp01(window.scrollY / (H * 0.85));
      if (window.scrollY < 24) html.dataset.cxHeroTop = '1'; else delete html.dataset.cxHeroTop;
    };
    window.addEventListener('scroll', onScroll, { passive: true }); onScroll();

    // ── reloj ──
    const t0 = performance.now() / 1000;
    let tLoaded = -1, settleAt = -1, done = !wantIntro, revealHero = !wantIntro, flipDone = !wantIntro;
    let disposed = false, raf = 0, last = t0;
    const minLoad = wantIntro ? (short ? 0.35 : 0.9) : 0;
    const finish = () => { // fin de la intro: el lienzo pasa detrás del contenido
      if (done) return; done = true; playedThisLoad = true;
      try { sessionStorage.setItem('cx-intro', '1'); } catch { /* */ }
      delete html.dataset.cxIntro; setStage('hero');
    };
    skipRef.current = () => { if (!wantIntro || done) return; if (tLoaded < 0) { if (!ready) return; tLoaded = performance.now() / 1000 - 4.6 * K; } else tLoaded = Math.min(tLoaded, performance.now() / 1000 - 4.6 * K); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') skipRef.current(); };
    window.addEventListener('keydown', onKey);

    const _v = new THREE.Vector3(), _r = new THREE.Vector3(), _c = new THREE.Color();
    const rectOf = () => { // rectángulo de pantalla del dron
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (let i = 0; i < 8; i++) {
        _v.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).applyMatrix4(pivot.matrixWorld).project(camera);
        const x = (_v.x * 0.5 + 0.5) * W, y = (-_v.y * 0.5 + 0.5) * H;
        x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      }
      return { x0, x1, y0, y1 };
    };

    const frame = () => {
      raf = requestAnimationFrame(frame);
      const now = performance.now() / 1000; const dt = Math.min(0.05, now - last); last = now;
      if (document.hidden) return;
      const fade = 1 - scrollK;
      layer.style.opacity = String(done ? fade : 1);
      if (done && fade <= 0.001) return;   // fuera de vista: no se dibuja
      // progreso de carga
      shownProgress += (Math.max(progress, Math.min(0.9, (now - t0) / 2.2) * (ready ? 1 : 0.92)) - shownProgress) * Math.min(1, dt * 6);
      if (ready) shownProgress = Math.max(shownProgress, progress);
      if (countRef.current) countRef.current.textContent = String(Math.round(clamp01(shownProgress) * 100)).padStart(3, '0');
      if (barRef.current) barRef.current.style.transform = `scaleX(${clamp01(shownProgress)})`;
      if (wantIntro && tLoaded < 0 && (ready || failed) && now - t0 > minLoad && shownProgress > 0.97) tLoaded = now;
      if (wantIntro && failed && tLoaded > 0 && now - tLoaded > 0.4) { finish(); revealHero = true; flipDone = true; curtainRef.current?.classList.add('out'); }
      if (!ready) { renderer.render(scene, camera); return; }

      const t = tLoaded < 0 ? (wantIntro ? -1 : 99) : (now - tLoaded) / K;     // tiempo de la coreografía
      // fases
      const edgeP = t < 0 ? 0 : ease(t / 1.6);
      const u = ease((t - 1.3) / 1.3), v = ease((t - 2.9) / 1.3), s4 = ease((t - 4.5) / 1.2);
      const yTop = box.max.y + 0.02, yBot = box.min.y - 0.02;
      const sR = lerp(yTop, yBot, u), sM = lerp(yBot, yTop, v);
      // cámara: órbita de la intro → pose del hero (con paralaje del cursor)
      if (t >= 0) spin += dt * lerp(0.16 / K, 0.05, done ? 1 : ease((t - 4.2) / 1.6));
      const par = done ? 1 : s4;
      mxS += (mx - mxS) * Math.min(1, dt * 3); myS += (my - myS) * Math.min(1, dt * 3);
      const theta = 0.95 + spin + mxS * 0.22 * par;
      const phi = lerp(0.62, 1.16, ease(t / 4.8)) + myS * 0.06 * par;
      // ENCUADRE por rectángulo objetivo: intro = centro de la pantalla; hero = mitad derecha
      // (escritorio) o franja superior (móvil), para no tapar nunca el texto.
      const k = done ? 1 : s4;
      const mobile = W < 760 || W / H < 0.95;
      const tgt = mobile ? { x0: 0.04, x1: 0.96, y0: 0.09, y1: 0.47 } : { x0: 0.46, x1: 1.0, y0: 0.06, y1: 0.96 };
      const rx0 = lerp(0.1, tgt.x0, k) * W, rx1 = lerp(0.9, tgt.x1, k) * W, ry0 = lerp(0.12, tgt.y0, k) * H, ry1 = lerp(0.88, tgt.y1, k) * H;
      const vf = THREE.MathUtils.degToRad(camera.fov), hfT = Math.tan(vf / 2) * (W / H), vfT = Math.tan(vf / 2);
      const halfV = (size.y * Math.sin(phi) + 2 * rH * Math.cos(phi)) / 2;
      const fit = Math.max(rH / (hfT * ((rx1 - rx0) / W)), halfV / (vfT * ((ry1 - ry0) / H))) * 0.92 + rH * 0.15;
      const r = fit * lerp(0.58, 1, ease(t / 4.8)) * (1 + scrollK * 0.2);
      camera.position.set(center.x + r * Math.sin(phi) * Math.sin(theta), center.y + r * Math.cos(phi), center.z + r * Math.sin(phi) * Math.cos(theta));
      camera.lookAt(center);
      const offX = -((rx0 + rx1) / 2 - W / 2), offY = H / 2 - (ry0 + ry1) / 2 + scrollK * H * 0.1;
      if (Math.abs(offX) + Math.abs(offY) > 0.5) camera.setViewOffset(W, H, offX, offY, W, H); else camera.clearViewOffset();
      camera.updateProjectionMatrix();
      pivot.updateMatrixWorld(true);

      // aristas: dibujo del centro hacia afuera con frente naranja
      const n = segCount;
      edges!.geometry.setDrawRange(0, Math.floor(n * edgeP) * 2);
      const band = Math.floor(n * 0.05), head = Math.floor(n * edgeP);
      front!.visible = edgeP > 0 && edgeP < 1;
      front!.geometry.setDrawRange(Math.max(0, head - band) * 2, Math.min(band, head) * 2);

      if (!done && t < 4.5) {
        // intro: barridos horizontales
        real!.visible = u > 0;
        planeReal.normal.set(0, 1, 0); planeReal.constant = v > 0 ? -sM : -sR;
        planeMin.normal.set(0, -1, 0); planeMin.constant = v > 0 ? sM : yBot - 1;
        const scanOn = (u > 0 && u < 1) || (v > 0 && v < 1);
        scan!.position.y = v > 0 ? sM : sR; scanMat.opacity = scanOn ? 0.95 : 0;
        edgeMat.opacity = lerp(lerp(0.75, 0.14, u), cols.edgeOp, v);
        edgeMat.color.set(0xe9e6df);
        if (edgeClip) { edgeMat.clippingPlanes = null; edgeMat.needsUpdate = true; edgeClip = false; }
        if (dividerRef.current) dividerRef.current.style.opacity = '0';
      } else {
        // hero: divisor vertical que sigue al cursor (realista a la izquierda, esencial a la derecha)
        scanMat.opacity = 0; real!.visible = true;
        const rc = rectOf();
        const idle = now - lastMove > 2.5 || window.matchMedia('(pointer: coarse)').matches;
        const target = idle ? rc.x0 + (0.5 + 0.3 * Math.sin(now * 0.55)) * (rc.x1 - rc.x0) : rc.x0 + ((mx + 1) / 2) * (rc.x1 - rc.x0);
        if (divX < 0) divX = rc.x1;   // entra desde la derecha: todo esencial → aparece lo realista
        divX += (target - divX) * Math.min(1, dt * (idle ? 1.5 : 6));
        const ndcX = (divX / W) * 2 - 1;
        _v.set(ndcX, 0, 0.5).unproject(camera);
        const dir = _v.sub(camera.position).normalize();
        const p = camera.position.clone().addScaledVector(dir, camera.position.distanceTo(center));
        _r.setFromMatrixColumn(camera.matrixWorld, 0).normalize();
        planeReal.setFromNormalAndCoplanarPoint(_r.clone().negate(), p);
        planeMin.setFromNormalAndCoplanarPoint(_r, p);
        if (!edgeClip) { edgeMat.clippingPlanes = [planeMin]; edgeMat.needsUpdate = true; edgeClip = true; }
        _c.set(0xe9e6df).lerp(cols.edge, done ? 1 : s4); edgeMat.color.copy(_c);
        edgeMat.opacity = cols.edgeOp;
        const dv = dividerRef.current;
        if (dv) {
          dv.style.opacity = String((done ? 1 : s4) * fade);
          dv.style.transform = `translate3d(${divX.toFixed(1)}px, ${rc.y0.toFixed(1)}px, 0)`;
          dv.style.height = `${Math.max(0, rc.y1 - rc.y0).toFixed(0)}px`;
        }
      }
      minMat.color.lerp(cols.face, 0.1); accMat.color.lerp(cols.acc, 0.1); accMat.emissive.copy(accMat.color);

      // HUD de la intro
      if (wantIntro && !done) {
        const ph = t < 0 ? -1 : t < 1.3 ? 0 : t < 2.9 ? 1 : 2;
        if (phaseRef.current) phaseRef.current.textContent = ph < 0 ? L.load : L.ph[ph];
        hudRef.current?.classList.toggle('loaded', t >= 0);
        introTitleRef.current?.classList.toggle('l1', t > 1.5);
        introTitleRef.current?.classList.toggle('l2', t > 3.1);
        if (t >= 4.5 && settleAt < 0) {
          settleAt = now;
          curtainRef.current?.classList.add('out');
          hudRef.current?.classList.add('out');
          // FLIP: el titular de la intro viaja a la posición del titular del hero
          const a = introTitleRef.current, b = heroTitleRef.current;
          if (a && b) {
            const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
            const sc = rb.height / Math.max(1, ra.height);
            a.style.transformOrigin = '0 0';
            const to = getComputedStyle(b).color;
            a.animate([{ transform: 'translate(0,0) scale(1)', color: '#edeee8' }, { transform: `translate(${rb.left - ra.left}px, ${rb.top - ra.top}px) scale(${sc})`, color: to }],
              { duration: 1100 * K, easing: 'cubic-bezier(.7,0,.2,1)', fill: 'forwards' })
              .finished.then(() => { flipDone = true; b.classList.add('in'); a.style.opacity = '0'; }).catch(() => { flipDone = true; });
          } else flipDone = true;
        }
        if (settleAt > 0 && now - settleAt > 0.75 * K && !revealHero) { revealHero = true; layer.classList.add('behind'); }
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
            <div ref={hudRef} className="ih-hud" role="status" aria-live="polite">
              <div className="ih-hud-top"><span>Alex Woodcock</span><span>3D · Web · {lang === 'en' ? 'AI' : 'IA'}</span></div>
              <div ref={introTitleRef} className="ih-intro-title" aria-hidden="true"><span>{L.l1}</span><span>{L.l2a}<em>{L.l2b}</em>.</span></div>
              <div className="ih-hud-bot">
                <span><span ref={phaseRef}>{L.load}</span> <b ref={countRef}>000</b></span>
                <button type="button" className="ih-skip" onClick={() => skipRef.current()}>{L.skip} →</button>
              </div>
              <i ref={barRef} className="ih-bar" />
            </div>
          )}
        </div>,
        document.body,
      )}
    </>
  );
}
