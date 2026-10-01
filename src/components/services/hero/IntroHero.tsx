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
import { BrandLockup } from './BrandLockup';
import './hero.css';

type Lang = 'es' | 'en';
let playedThisLoad = false;

const T = {
  es: { kicker: 'Alex Woodcock — 3D · Web · IA', l1: 'De lo complejo', l2a: 'a lo ', l2b: 'esencial', sub: 'Modelos, webs y experiencias 3D que tus clientes entienden a la primera. Cotiza tu proyecto en un minuto.',
    quote: 'Cotizar mi proyecto', work: 'Ver trabajo real', skip: 'Saltar', real: 'Realista', ess: 'Esencial', scroll: 'Desliza', hintOff: 'Clic para desarmar', hintOn: 'Clic para armar' },
  en: { kicker: 'Alex Woodcock — 3D · Web · AI', l1: 'From complex', l2a: 'to ', l2b: 'essential', sub: '3D models, websites and experiences your clients understand at first glance. Quote your project in a minute.',
    quote: 'Quote my project', work: 'See real work', skip: 'Skip', real: 'Realistic', ess: 'Essential', scroll: 'Scroll', hintOff: 'Click to take apart', hintOn: 'Click to assemble' },
};

/** Guion (segundos; se escala con K). Inicios sobre un compás de 0,4 s. */
const TL = {
  c0: 0, c: 0.6,           // la línea se recoge ACELERANDO hasta el punto (anticipación → impacto)
  sk0: 0.6, sk: 1.0,       // ICONO cenital: nace en el impacto (brazos, cuerpo, hélices)
  de0: 1.4, de: 1.0,       // detalle real (aristas) mientras el icono se apaga
  dz0: 1.2, dz: 1.6,       // la cámara baja de cenital a 3/4 con dolly-zoom (13° → 30°)
  r0: 2.2, r: 1.2,         // corte baja: realista
  m0: 3.2, m: 1.2,         // corte sube: esencial
  s0: 4.4, s: 1.2,         // asentamiento en el hero
  v0: 4.8, v: 0.6,         // la línea gira 90° mientras viaja al borde izquierdo del dron
  w0: 5.3, w: 1.0,         // la línea CRUZA el modelo: a su paso, lo esencial se vuelve realista
  t1: 2.6, t2: 3.8,        // titular, línea 1 y 2
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
  // cáscaras: componentes conexos por índice (el CAD separa las caras en sus aristas vivas → pedazos naturales)
  const parent = new Int32Array(pa.count); for (let i = 0; i < pa.count; i++) parent[i] = i;
  const find = (x: number): number => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
  if (idx) for (let t = 0; t < idx.length; t += 3) { const a = find(idx[t]), b = find(idx[t + 1]), c = find(idx[t + 2]); parent[b] = a; parent[find(c)] = a; }
  const sum = new Map<number, [number, number, number, number]>();
  for (let i = 0; i < pa.count; i++) { const r = find(i); const e = sum.get(r) ?? [0, 0, 0, 0]; e[0] += P[i * 3]; e[1] += P[i * 3 + 1]; e[2] += P[i * 3 + 2]; e[3]++; sum.set(r, e); }
  const Fr = new Float32Array(pa.count * 3);
  for (let i = 0; i < pa.count; i++) { const e = sum.get(find(i))!; Fr[i * 3] = e[0] / e[3]; Fr[i * 3 + 1] = e[1] / e[3]; Fr[i * 3 + 2] = e[2] / e[3]; }
  // posición → centro de su cáscara (para que las aristas se muevan con su cara)
  const key = (x: number, y: number, z: number) => `${Math.round(x * 2000)},${Math.round(y * 2000)},${Math.round(z * 2000)}`;
  const fragAt = new Map<string, number>(); for (let i = 0; i < pa.count; i++) fragAt.set(key(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]), i);
  return { P, N, Fr, idx, count: pa.count, c: bb.getCenter(new THREE.Vector3()), fragOf: (x: number, y: number, z: number) => { const i = fragAt.get(key(x, y, z)); return i === undefined ? null : i; } };
}
/** Une piezas en una geometría con `aOff` (desplazamiento de su pieza para el despiece). */
function merge(parts: ReturnType<typeof worldFloat>[], center: THREE.Vector3) {
  const total = parts.reduce((a, p) => a + p.count, 0);
  const nIdx = parts.reduce((a, p) => a + (p.idx ? p.idx.length : p.count), 0);
  const P = new Float32Array(total * 3), N = new Float32Array(total * 3), O = new Float32Array(total * 3), Fg = new Float32Array(total * 3), I = new Uint32Array(nIdx);
  let off = 0, io = 0;
  for (const p of parts) {
    P.set(p.P, off * 3); N.set(p.N, off * 3);
    const ox = p.c.x - center.x, oy = p.c.y - center.y, oz = p.c.z - center.z;
    for (let k = 0; k < p.count; k++) { O[(off + k) * 3] = ox; O[(off + k) * 3 + 1] = oy; O[(off + k) * 3 + 2] = oz; Fg[(off + k) * 3] = p.Fr[k * 3] - center.x; Fg[(off + k) * 3 + 1] = p.Fr[k * 3 + 1] - center.y; Fg[(off + k) * 3 + 2] = p.Fr[k * 3 + 2] - center.z; }
    if (p.idx) for (let k = 0; k < p.idx.length; k++) I[io++] = p.idx[k] + off; else for (let k = 0; k < p.count; k++) I[io++] = k + off;
    off += p.count;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.BufferAttribute(N, 3)); g.setAttribute('aOff', new THREE.BufferAttribute(O, 3)); g.setAttribute('aFrag', new THREE.BufferAttribute(Fg, 3));
  g.setIndex(new THREE.BufferAttribute(I, 1)); return g;
}
/** Uniforms compartidos del despiece y la fractura (todo en GPU). */
type XU = { uExplode: { value: number }; uMess: { value: number }; uSpread: { value: number }; uHover: { value: number }; uCrumple: { value: number }; uR: { value: number }; uPush: { value: number }; uCursor: { value: THREE.Vector3 }; uCenter: { value: THREE.Vector3 } };
const XGLSL = `
attribute vec3 aOff; attribute vec3 aFrag;
uniform float uExplode, uMess, uSpread, uHover, uCrumple, uR, uPush; uniform vec3 uCursor, uCenter;
vec3 cxHash(vec3 p) { return fract(sin(vec3(dot(p, vec3(127.1, 311.7, 74.7)), dot(p, vec3(269.5, 183.3, 246.1)), dot(p, vec3(113.5, 271.9, 124.6)))) * 43758.5453) - 0.5; }
vec3 cxRot(vec3 v, vec3 k, float a) { float c = cos(a), s = sin(a); return v * c + cross(k, v) * s + k * dot(k, v) * (1.0 - c); }
// deformación local (modo realista): abolladura radial + ruido por celdas (grietas) alrededor del cursor
vec3 cxCrumple(vec3 w) {
  vec3 d = w - uCursor; float l = length(d);
  float c = uCrumple * (1.0 - smoothstep(0.0, uR * 0.85, l));
  return (d / max(l, 1e-3)) * c * uPush * 0.45 + cxHash(floor(w * 30.0)) * c * uPush * 1.0;
}`;
/**
 * Despiece en GPU. Cada vértice conoce el centro de su PIEZA (aOff) y de su CÁSCARA (aFrag):
 *  · scroll / clic: la pieza se separa radialmente; con el clic además gira y se dispersa (desorden
 *    determinista por pieza: el hash sale de su centro, así siempre se desarma igual);
 *  · cursor: las cáscaras cercanas se desprenden, voltean y se apartan (fractura), y vuelven al alejarse.
 */
function withExplode<M extends THREE.Material>(mat: M, u: XU): M {
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>' + XGLSL)
      .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
        { vec3 h = cxHash(aOff * 7.0 + 0.13); objectNormal = cxRot(objectNormal, normalize(h + vec3(0.001, 0.002, 0.003)), uMess * h.x * 0.8); }`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vec3 cxH = cxHash(aOff * 7.0 + 0.13), cxHf = cxHash(aFrag * 13.0 + 0.71);
        vec3 cxPc = uCenter + aOff;
        transformed = cxPc + cxRot(transformed - cxPc, normalize(cxH + vec3(0.001, 0.002, 0.003)), uMess * cxH.x * 0.8);
        vec3 cxDisp = aOff * uExplode + cxH * vec3(1.0, 0.55, 1.0) * uMess * uSpread;
        transformed += cxDisp;
        vec3 cxFc = uCenter + aFrag + cxDisp, cxD = cxFc - uCursor; float cxL = length(cxD);
        float cxF = uHover * (1.0 - smoothstep(0.0, uR, cxL));   // cáscaras (solo en modo esencial)
        transformed = cxFc + cxRot(transformed - cxFc, normalize(cxHf + vec3(0.002, 0.001, 0.003)), cxF * cxHf.z * 1.6);
        transformed += (cxD / max(cxL, 1e-3)) * cxF * uPush + cxHf * cxF * uPush * 0.9;
        transformed += cxCrumple(transformed);`);
  };
  mat.customProgramCacheKey = () => 'cx-explode-36';
  return mat;
}
/** Materiales REALISTAS (mallas originales): misma deformación, en espacio mundo y de vuelta a local. */
function withCrumple<M extends THREE.Material>(mat: M, u: XU): M {
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uExplode, uMess, uSpread, uHover, uCrumple, uR, uPush; uniform vec3 uCursor, uCenter;\nvec3 cxHash(vec3 p) { return fract(sin(vec3(dot(p, vec3(127.1, 311.7, 74.7)), dot(p, vec3(269.5, 183.3, 246.1)), dot(p, vec3(113.5, 271.9, 124.6)))) * 43758.5453) - 0.5; }\nvec3 cxCrumple(vec3 w) { vec3 d = w - uCursor; float l = length(d); float c = uCrumple * (1.0 - smoothstep(0.0, uR * 0.85, l)); return (d / max(l, 1e-3)) * c * uPush * 0.45 + cxHash(floor(w * 30.0)) * c * uPush * 1.0; }')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        if (uCrumple > 0.0005) { vec4 cxW = modelMatrix * vec4(transformed, 1.0); cxW.xyz += cxCrumple(cxW.xyz); transformed = (inverse(modelMatrix) * cxW).xyz; }`);
  };
  mat.customProgramCacheKey = () => 'cx-crumple-36';
  return mat;
}
/** Segmentos ordenados (centro → afuera) a geometría de líneas con `aOff`. */
function lineGeo(pos: number[], offs: number[], dist: number[], order?: Uint32Array, frags?: number[]) {
  const n = dist.length, o = order ?? (() => { const a = new Uint32Array(n); for (let i = 0; i < n; i++) a[i] = i; return a.sort((x, y) => dist[x] - dist[y]); })();
  const P = new Float32Array(n * 6), O = new Float32Array(n * 6), Fg = new Float32Array(n * 6);
  const fr = frags ?? offs;
  for (let i = 0; i < n; i++) { const s = o[i]; for (let k = 0; k < 6; k++) P[i * 6 + k] = pos[s * 6 + k]; for (let k = 0; k < 3; k++) { O[i * 6 + k] = offs[s * 3 + k]; O[i * 6 + 3 + k] = offs[s * 3 + k]; Fg[i * 6 + k] = fr[s * 3 + k]; Fg[i * 6 + 3 + k] = fr[s * 3 + k]; } }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('aOff', new THREE.BufferAttribute(O, 3)); g.setAttribute('aFrag', new THREE.BufferAttribute(Fg, 3));
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
  const hintRef = useRef<HTMLDivElement>(null);
  const [brandPos, setBrandPos] = useState<{ left: number; top: number } | null>(null);
  const [showBrand, setShowBrand] = useState(true);
  const skipRef = useRef<() => void>(() => {});

  useEffect(() => { setMounted(true); }, []);
  // posición exacta de la marca de la barra superior (para dibujarla encima de la cortina durante la intro)
  useEffect(() => {
    if (!mounted) return;
    const place = () => { const el = document.querySelector('.cx-nav .cx-brand svg'); if (el) { const r = el.getBoundingClientRect(); setBrandPos({ left: r.left, top: r.top }); } };
    place(); const t = setTimeout(place, 600); window.addEventListener('resize', place);
    return () => { clearTimeout(t); window.removeEventListener('resize', place); };
  }, [mounted]);
  useEffect(() => { if (stage === 'hero') { const t = setTimeout(() => setShowBrand(false), 1400); return () => clearTimeout(t); } }, [stage]);

  useEffect(() => {
    if (!mounted) return;
    const html = document.documentElement;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const wantIntro = !playedThisLoad && !reduce && html.dataset.cxIntro !== undefined;
    let short = false;
    try { short = sessionStorage.getItem('cx-intro') === '1'; } catch { /* sin almacenamiento */ }
    // depuración de timing: ?introAt=2.4 congela la intro en ese instante del guion (revisión fotograma a fotograma)
    let freezeAt = NaN; try { freezeAt = Number(new URLSearchParams(location.search).get('introAt') ?? 'NaN'); } catch { /* */ }
    const K = short && !Number.isFinite(freezeAt) ? 0.6 : 1.12;   // ciclo 35: versión completa un 12 % más lenta
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
    const U: XU = { uExplode: { value: 0 }, uMess: { value: 0 }, uSpread: { value: 1 }, uHover: { value: 0 }, uCrumple: { value: 0 }, uR: { value: 1 }, uPush: { value: 0.2 }, uCursor: { value: new THREE.Vector3(0, -99, 0) }, uCenter: { value: new THREE.Vector3() } };
    const minMat = withExplode(new THREE.MeshStandardMaterial({ color: cols.face, roughness: 0.82, metalness: 0.0, transparent: true, clippingPlanes: [planeMin], polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }), U);
    const accMat = withExplode(new THREE.MeshStandardMaterial({ color: cols.acc, roughness: 0.55, metalness: 0.1, emissive: cols.acc, emissiveIntensity: 0.25, transparent: true, clippingPlanes: [planeMin], polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }), U);
    const edgeMat = withExplode(new THREE.LineBasicMaterial({ color: 0xe9e6df, transparent: true, opacity: 0.55, depthWrite: false, clippingPlanes: [planeEdge] }), U);
    const skelMat = withExplode(new THREE.LineBasicMaterial({ color: 0xf4f2ec, transparent: true, opacity: 0.95, depthWrite: false, clippingPlanes: [planeEdge] }), U);
    const frontMat = withExplode(new THREE.LineBasicMaterial({ color: 0xff7a3d, transparent: true, opacity: 1, depthWrite: false, blending: THREE.AdditiveBlending }), U);
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
    let realPartsRef: { m: THREE.Mesh; base: THREE.Vector3; c: THREE.Vector3; inv: THREE.Matrix3 }[] = [];

    (async () => {
      const root = await preloadHolybro((p) => { dl = p; if (p >= 0.99 && !parseT0) parseT0 = performance.now(); });
      if (disposed) return;
      stage2 = 1;
      const drone = root.clone(true);
      pivot.add(drone); pivot.updateMatrixWorld(true);
      box.setFromObject(drone); box.getCenter(center); box.getSize(size);
      rH = Math.hypot(size.x, size.z) / 2; radius = size.length() / 2;
      U.uCenter.value.copy(center); U.uR.value = rH * 0.5; U.uPush.value = rH * 0.16; U.uSpread.value = rH * 0.36;
      const meshes: THREE.Mesh[] = []; drone.traverse((o) => { if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh); });
      const matMap = new Map<THREE.Material, THREE.Material>();
      const minParts: ReturnType<typeof worldFloat>[] = [], accParts: ReturnType<typeof worldFloat>[] = [];
      const dA: number[] = [], dO: number[] = [], dD: number[] = [], dF: number[] = []; // detalle (+ cáscara)
      const realParts: { m: THREE.Mesh; base: THREE.Vector3; c: THREE.Vector3; inv: THREE.Matrix3 }[] = [];
      const motorMeshes: THREE.Box3[] = [];                                          // para el icono
      let budget = performance.now();
      const push = (ep: THREE.BufferAttribute | THREE.InterleavedBufferAttribute, c: THREE.Vector3, A: number[], O: number[], D: number[], Lr?: number[], Fo?: number[], wf?: ReturnType<typeof worldFloat>) => {
        for (let k = 0; k < ep.count; k += 2) {
          const ax = ep.getX(k), ay = ep.getY(k), az = ep.getZ(k), bx = ep.getX(k + 1), by = ep.getY(k + 1), bz = ep.getZ(k + 1);
          if (!Number.isFinite(ax + ay + az + bx + by + bz)) continue;   // aristas degeneradas del CAD
          A.push(ax, ay, az, bx, by, bz); O.push(c.x - center.x, c.y - center.y, c.z - center.z);
          D.push(Math.hypot((ax + bx) / 2 - center.x, (ay + by) / 2 - center.y, (az + bz) / 2 - center.z));
          Lr?.push(Math.hypot(bx - ax, by - ay, bz - az));
          if (Fo && wf) { const vi = wf.fragOf(ax, ay, az); if (vi === null) Fo.push(c.x - center.x, c.y - center.y, c.z - center.z); else Fo.push(wf.Fr[vi * 3] - center.x, wf.Fr[vi * 3 + 1] - center.y, wf.Fr[vi * 3 + 2] - center.z); }
        }
      };
      for (let i = 0; i < meshes.length; i++) {
        const m = meshes[i];
        const src = m.material as THREE.Material;
        let c = matMap.get(src);
        if (!c) { c = withCrumple(src.clone(), U); (c as THREE.MeshStandardMaterial).clippingPlanes = [planeReal]; matMap.set(src, c); disposables.push(c); }
        m.material = c;
        const wf = worldFloat(m);
        const isMotor = /DJ-2216/i.test(meshEffectiveName(m));
        (isMotor ? accParts : minParts).push(wf);
        if (isMotor) motorMeshes.push(new THREE.Box3().setFromBufferAttribute(new THREE.BufferAttribute(wf.P, 3)));
        const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(wf.P, 3)); if (wf.idx) g.setIndex(Array.from(wf.idx));
        const eg = new THREE.EdgesGeometry(g, 28); push(eg.getAttribute('position'), wf.c, dA, dO, dD, undefined, dF, wf);
        realParts.push({ m, base: m.position.clone(), c: wf.c.clone(), inv: new THREE.Matrix3().setFromMatrix4(m.parent ? m.parent.matrixWorld.clone().invert() : new THREE.Matrix4()) });
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
      const seg = (a: THREE.Vector3, b: THREE.Vector3, key: number, off: THREE.Vector3) => { if (!Number.isFinite(a.x + a.y + a.z + b.x + b.y + b.z)) return; SA.push(a.x, a.y, a.z, b.x, b.y, b.z); SO.push(off.x, off.y, off.z); SK.push(key); };
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
      const deGeo = lineGeo(dA, dO, dD, undefined, dF); nDet = dD.length;
      realPartsRef = realParts;
      await nextFrame(); if (disposed) return;
      const mkFront = (g: THREE.BufferGeometry) => { const f = new THREE.BufferGeometry(); f.setAttribute('position', g.getAttribute('position')); f.setAttribute('aOff', g.getAttribute('aOff')); f.setAttribute('aFrag', g.getAttribute('aFrag')); disposables.push(f); const o = new THREE.LineSegments(f, frontMat); o.renderOrder = 5; o.frustumCulled = false; return o; };
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
      real!.visible = true; [edges, skel, frontS, frontD].forEach((o) => { o!.visible = true; o!.geometry.setDrawRange(0, Infinity); });
      renderer.setScissorTest(true); renderer.setScissor(0, 0, 2, 2); renderer.setViewport(0, 0, 2, 2);
      renderer.render(scene, camera);
      renderer.setScissorTest(false); renderer.setViewport(0, 0, W, H); renderer.clear();
      real!.visible = false;
      pivot.visible = false;
      prep = 1; ready = true;
    })().catch(() => { failed = true; });

    // ── interacción ──
    let mx = 0, my = 0, mxS = 0, myS = 0, spin = 0, lastMove = -10, divX = -1, heroT = -1;
    let px = -1, py = -1, overDrone = false, hoverE = 0, messT = 0, messE = 0, lastRect = { x0: 0, x1: 0, y0: 0, y1: 0 };
    let sweepT0 = -1, sweepFrom = 0; const SWEEP = 1.15;   // cambio de modo: la línea cruza el modelo en 1,15 s
    const interactive = (t: EventTarget | null) => !!(t as HTMLElement | null)?.closest?.('a,button,input,select,textarea,label,summary,[role="button"],.cx-chat-fab,.cx-nav,.cx-option,.cx-show-card');
    const inRect = (x: number, y: number) => { const r = lastRect, mX = (r.x1 - r.x0) * 0.06, mY = (r.y1 - r.y0) * 0.06; return x > r.x0 - mX && x < r.x1 + mX && y > r.y0 - mY && y < r.y1 + mY; };
    const onMove = (e: PointerEvent) => {
      mx = e.clientX / W * 2 - 1; my = e.clientY / H * 2 - 1; lastMove = performance.now() / 1000; px = e.clientX; py = e.clientY;
      overDrone = done && scrollE < 0.25 && !interactive(e.target) && inRect(px, py);
      html.style.cursor = overDrone ? 'pointer' : '';
    };
    const onClick = (e: MouseEvent) => {
      if (!done || scrollE > 0.25 || interactive(e.target) || !inRect(e.clientX, e.clientY)) return;
      if (sweepT0 > 0 && performance.now() / 1000 - sweepT0 < SWEEP) return;   // espera a que termine el barrido
      messT = messT > 0.5 ? 0 : 1; sweepT0 = performance.now() / 1000; sweepFrom = messE;   // clic: cambia de modo
    };
    window.addEventListener('click', onClick);
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
      // despiece al bajar: crece SIEMPRE con el scroll (lineal + acelerando), sin tope dentro del recorrido
      const ex = done ? scrollE * 1.6 + scrollE * scrollE * 2.4 : 0;
      // al bajar: se separa más, las caras se apagan (queda la SILUETA en líneas), la perspectiva se aplana
      // a 2D y al final desaparece antes de cruzar las opciones
      const sil = done ? smooth(0.22, 0.5, scrollE) : 0;
      const fadeOut = done ? smooth(0.42, 0.9, scrollE) : 0;
      layer.style.opacity = String(1 - fadeOut);
      if (done && scrollE > 0.92) return;
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
      // línea: crece desde el centro con la carga; al 100 % se recoge ACELERANDO (ease-in) hasta el punto:
      // máxima velocidad justo en el impacto → golpe de luz + onda; el icono nace de ese impacto
      const cin = (x: number) => { x = clamp01(x); return x * x * x; };
      if (lineRef.current && !done) lineRef.current.style.transform = `scaleX(${(clamp01(shown) * (t < 0 ? 1 : 1 - cin((t - TL.c0) / TL.c))).toFixed(4)})`;
      if (dotRef.current && !done) {
        const pre = smooth(TL.c * 0.4, TL.c, t);
        const hit = t < TL.c ? 0 : Math.exp(-(t - TL.c) * 7) * Math.sin(Math.min(Math.PI, (t - TL.c) * 9)) ;
        const a = t < 0 ? 0 : pre * (1 - smooth(TL.sk0 + 0.35, TL.sk0 + 0.9, t));
        dotRef.current.style.opacity = a.toFixed(3);
        dotRef.current.style.transform = `translate(-50%,-50%) scale(${(0.5 + 0.7 * pre + 1.6 * hit).toFixed(3)})`;
        if (t >= TL.c && !hudRef.current?.classList.contains('hit')) hudRef.current?.classList.add('hit');
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
      camera.fov = done ? lerp(FOV1, 11, smooth(0.3, 0.9, scrollE)) : lerp(FOV0, FOV1, dz);
      const theta = lerp(0, 0.95, done ? 1 : dz) + spin + mxS * 0.22 * k + ex * 0.9;
      const phi = lerp(0.04, 1.16, done ? 1 : dz) + myS * 0.06 * k - ex * 0.62;
      const mobile = W < 760 || W / H < 0.95;
      const tgt = mobile ? { x0: 0.04, x1: 0.96, y0: 0.09, y1: 0.47 } : { x0: 0.46, x1: 1.0, y0: 0.06, y1: 0.96 };
      const rx0 = lerp(0.12, tgt.x0, k) * W, rx1 = lerp(0.88, tgt.x1, k) * W, ry0 = lerp(0.16, tgt.y0, k) * H, ry1 = lerp(0.84, tgt.y1, k) * H;
      const vf = THREE.MathUtils.degToRad(camera.fov), hfT = Math.tan(vf / 2) * (W / H), vfT = Math.tan(vf / 2);
      const halfV = (size.y * Math.sin(phi) + 2 * rH * Math.abs(Math.cos(phi))) / 2;
      const fit = Math.max(rH / (hfT * ((rx1 - rx0) / W)), halfV / (vfT * ((ry1 - ry0) / H))) * 0.92 + rH * 0.15;
      const r = fit * (1 + Math.min(ex, 2) * 0.08);
      camera.position.set(center.x + r * Math.sin(phi) * Math.sin(theta), center.y + r * Math.cos(phi), center.z + r * Math.sin(phi) * Math.cos(theta));
      camera.lookAt(center);
      // parallax: mientras el contenido sube desde abajo, el dron despiezado sube y se aparta
      const offX = -((rx0 + rx1) / 2 - W / 2), offY = H / 2 - (ry0 + ry1) / 2 + Math.min(ex, 1.6) * H * 0.2;
      if (Math.abs(offX) + Math.abs(offY) > 0.5) camera.setViewOffset(W, H, offX, offY, W, H); else camera.clearViewOffset();
      camera.near = Math.max(0.05, r / 60); camera.far = r * 8;
      camera.updateProjectionMatrix(); camera.updateMatrixWorld();
      // despiece: scroll (radial, amplio) + clic (radial + desorden), muelle exponencial sin rebote
      // el despiece por clic sigue al barrido de la línea (se desarma a medida que la línea pasa)
      if (sweepT0 > 0) { const sp = ease((now - sweepT0) / SWEEP); messE = lerp(sweepFrom, messT, sp); }
      U.uExplode.value = ex * 2.6 + messE * 0.75;
      U.uMess.value = messE;
      minMat.opacity = accMat.opacity = 1 - sil; minMat.depthWrite = accMat.depthWrite = sil < 0.02;
      // fractura: las cáscaras cercanas al cursor se desprenden (solo con el hero en reposo)
      // la deformación se va ACUMULANDO mientras el cursor sigue encima (≈1,6 s) y se recupera algo más rápido
      hoverE += ((overDrone ? 1 : 0) - hoverE) * (1 - Math.exp(-dt * (overDrone ? 1.6 : 3)));
      const hk = hoverE * (1 - smooth(0, 0.2, scrollE));
      U.uHover.value = hk * messE;             // modo esencial (desarmado): las cáscaras se desprenden
      U.uCrumple.value = hk * (1 - messE);     // modo realista: el modelo se DEFORMA (abolladura + grietas), sin mover piezas
      if (hoverE > 0.001 && px >= 0) {
        const ray = new THREE.Raycaster(); ray.setFromCamera(new THREE.Vector2((px / W) * 2 - 1, -(py / H) * 2 + 1), camera);
        const n = camera.getWorldDirection(new THREE.Vector3());
        const hit = ray.ray.intersectPlane(new THREE.Plane().setFromNormalAndCoplanarPoint(n, center), new THREE.Vector3());
        if (hit) U.uCursor.value.lerp(hit, Math.min(1, dt * 14));
      }
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
        // hero: la línea entra horizontal, gira 90° viajando al borde izquierdo y CRUZA el modelo:
        // a su paso queda el modo nuevo (izquierda = nuevo, derecha = anterior). Reposo = realista completo.
        scanMat.opacity = 0; real!.visible = true;
        if (heroT < 0) heroT = now;
        const rc = rectOf(), cy = (rc.y0 + rc.y1) / 2, w = rc.x1 - rc.x0, h = rc.y1 - rc.y0;
        if (messE < 0.02 && ex < 0.02 && (sweepT0 < 0 || now - sweepT0 > SWEEP)) lastRect = rc;   // zona de clic: el dron armado
        const lr = lastRect, lw = lr.x1 - lr.x0 || w, lcx = (lr.x0 + lr.x1) / 2 || (rc.x0 + rc.x1) / 2;
        const xL = lcx - lw * 0.62, xR = lcx + lw * 0.62;   // margen: el despiece ocupa más que el dron armado
        let lineX = -1, lineA = 0, rotA = 1, lineLen = h * 1.3, newIsEssential = false, prog = 1;
        if (!done && t < TL.w0 + TL.w + 0.2) {
          // cierre de la intro: esencial → realista
          const rot = easeOutExpo((t - TL.v0) / TL.v); rotA = rot;
          prog = ease((t - TL.w0) / TL.w);
          const xRot = lerp((rc.x0 + rc.x1) / 2, rc.x0 - w * 0.08, rot);
          lineX = t < TL.w0 ? xRot : lerp(rc.x0 - w * 0.08, rc.x1 + w * 0.08, prog);
          lineLen = lerp(w * 0.9, h * 1.15, rot);
          lineA = smooth(TL.v0 - 0.15, TL.v0 + 0.1, t) * (1 - smooth(0.85, 1, prog));
          newIsEssential = false;
        } else if (sweepT0 > 0 && now - sweepT0 < SWEEP + 0.25) {
          // clic: la línea cruza de izquierda a derecha y deja el modo nuevo a su paso
          prog = ease((now - sweepT0) / SWEEP);
          lineX = lerp(xL, xR, prog); lineLen = h * (1.25 + 0.5 * messE);
          lineA = smooth(0, 0.08, prog) * (1 - smooth(0.9, 1, prog));
          newIsEssential = messT > 0.5;
        } else { prog = 1; newIsEssential = messT > 0.5; }
        // planos: lo que ya cruzó la línea (izquierda) está en el modo nuevo
        // antes del barrido: modo anterior completo (-∞); al terminar: modo nuevo completo (+∞); durante: la línea
        const bx = prog >= 1 ? 1e5 : prog <= 0 ? -1e5 : lineX;
        const essentialAll = scrollE > 0.04;   // al bajar: siempre esencial (silueta)
        if (essentialAll) { planeReal.set(new THREE.Vector3(0, 1, 0), -1e6); planeMin.set(new THREE.Vector3(0, -1, 0), 1e6); }
        else if (newIsEssential) { planeAtX(bx, planeMin, true); planeAtX(bx, planeReal, false); }
        else { planeAtX(bx, planeReal, true); planeAtX(bx, planeMin, false); }
        planeEdge.copy(planeMin);
        _c.set(0xe9e6df).lerp(cols.edge, k); edgeMat.color.copy(_c); skelMat.color.copy(_c);
        edgeMat.opacity = cols.edgeOp * (1 - fadeOut * 0.7);
        const dv = dividerRef.current;
        if (dv) {
          dv.style.opacity = String(clamp01(lineA) * (1 - smooth(0, 0.08, scrollE)));
          dv.style.height = `${Math.max(0, lineLen).toFixed(0)}px`;
          dv.style.transform = `translate3d(${lineX.toFixed(1)}px, ${(cy - lineLen / 2).toFixed(1)}px, 0) rotate(${((1 - rotA) * 90).toFixed(2)}deg)`;
          dv.classList.remove('labels');
        }
      }
      minMat.color.lerp(cols.face, 0.1); accMat.color.lerp(cols.acc, 0.1); accMat.emissive.copy(accMat.color);
      // pista discreta bajo el dron
      if (hintRef.current) {
        const show = done && (overDrone || messE > 0.5) && scrollE < 0.15 && (sweepT0 < 0 || now - sweepT0 > SWEEP);
        hintRef.current.style.opacity = show ? '1' : '0';
        hintRef.current.textContent = messT > 0.5 ? L.hintOn : L.hintOff;
        hintRef.current.style.transform = `translate3d(${((lastRect.x0 + lastRect.x1) / 2).toFixed(0)}px, ${(lastRect.y1 + 14).toFixed(0)}px, 0) translateX(-50%)`;
      }

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
        if (settleAt > 0 && flipDone && t >= TL.w0 + TL.w + 0.2) finish();
      }
      renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      disposed = true; cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize); window.removeEventListener('pointermove', onMove);
      window.removeEventListener('scroll', onScroll); window.removeEventListener('keydown', onKey); window.removeEventListener('click', onClick);
      html.style.cursor = '';
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
            <div ref={hintRef} className="ih-hint" />
          </div>
          {showBrand && brandPos && <div className="ih-brand" style={{ left: brandPos.left, top: brandPos.top }}><BrandLockup state="mark" height={13} /></div>}
          {!hero && (
            <div ref={hudRef} className="ih-hud ih-v34" role="status" aria-live="polite">
              <div ref={introTitleRef} className="ih-intro-title" aria-hidden="true"><span>{L.l1}</span><span>{L.l2a}<em>{L.l2b}</em>.</span></div>
              <div className="ih-hud-bot">
                <span className="ih-count"><b ref={countRef}>000</b></span>
                <button type="button" className="ih-skip" onClick={() => skipRef.current()}>{L.skip} →</button>
              </div>
              <i ref={lineRef} className="ih-bar" />
              <i ref={dotRef} className="ih-dot" />
              <i className="ih-ring" /><i className="ih-flash" />
            </div>
          )}
        </div>,
        document.body,
      )}
    </>
  );
}
