/**
 * plate3d.ts — Las láminas de «¿Qué quieres lograr?» pasan de 2D a 3D al pasar el cursor (ciclo 39).
 *
 * Misma idea que el dron de la intro, en pequeño y CALCADA del dibujo:
 *   2D (SVG animado) ─ barrido de la línea naranja → LINEART 3D (siluetas + aristas, caras del color del fondo,
 *   vista frontal sin perspectiva) → COLOR SÓLIDO plano → 3D con luz, materiales y texturas (dolly-zoom a 3/4).
 * Al salir se recorre la misma línea de tiempo al revés (×2,5) y la línea vuelve hacia la izquierda.
 *
 * Coincidencia 2D ↔ 3D:
 *  · cada figura se construye con las coordenadas EXACTAS del SVG (viewBox 320×180 → 3,2×1,8 u), con las mismas
 *    trayectorias (polilíneas entre fotogramas clave, no curvas suavizadas) y las mismas curvas de tiempo que el CSS
 *    (cubic-bezier evaluada aquí) y el mismo reloj: ambos empiezan al entrar el cursor;
 *  · mientras el 3D está activo la lámina lleva .p3d-live, así el SVG sigue animado y el regreso también coincide;
 *  · las anotaciones del plano (cotas, ejes, discontinuas, rótulos) existen también en 3D como líneas y rótulos.
 * Un único renderizador WebGL compartido: el lienzo se muda a la lámina activa.
 */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

type Fig = { root: THREE.Group; tick: (t: number, lit: number) => void };
const X = (x: number) => (x - 160) / 100;
const Y = (y: number) => -(y - 90) / 100;
const V = (x: number, y: number, z = 0) => new THREE.Vector3(X(x), Y(y), z);
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const smooth = (a: number, b: number, x: number) => { const k = clamp01((x - a) / (b - a)); return k * k * (3 - 2 * k); };
const ease = (x: number) => { x = clamp01(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
/** cubic-bezier de CSS (x1, y1, x2, y2) → f(t). */
function bez(x1: number, y1: number, x2: number, y2: number) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx, cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sx = (t: number) => ((ax * t + bx) * t + cx) * t, sy = (t: number) => ((ay * t + by) * t + cy) * t, dx = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  return (x: number) => { x = clamp01(x); let t = x; for (let i = 0; i < 6; i++) { const d = dx(t); if (Math.abs(d) < 1e-6) break; t -= (sx(t) - x) / d; } return sy(clamp01(t)); };
}
const CX_EASE = bez(0.22, 1, 0.36, 1), IN_OUT = bez(0.65, 0, 0.35, 1), SINE = bez(0.42, 0, 0.58, 1);
/** Fotogramas clave como en CSS: tiempos normalizados, valores, curva por tramo. */
function keys(ts: number[], vs: number[][], f: (x: number) => number, u: number) {
  if (u <= ts[0]) return vs[0];
  for (let i = 1; i < ts.length; i++) if (u <= ts[i]) { const k = f((u - ts[i - 1]) / (ts[i] - ts[i - 1])); return vs[i].map((v, j) => vs[i - 1][j] + (v - vs[i - 1][j]) * k); }
  return vs[vs.length - 1];
}
const END = 2.4;   // segundos de la línea de tiempo completa (2D → 3D)

type Pal = { ink: THREE.Color; acc: THREE.Color; sig: THREE.Color; mute: THREE.Color; faint: THREE.Color; bg: THREE.Color };
function palette(el: HTMLElement): Pal {
  const cs = getComputedStyle(el);
  const c = (v: string, d: string) => { const s = cs.getPropertyValue(v).trim(); try { return new THREE.Color(s && !s.includes('(') ? s : d); } catch { return new THREE.Color(d); } };
  return { ink: c('--cx-text', '#eceae4'), acc: c('--cx-accent', '#ff7a3d'), sig: c('--cx-signal', '#5ec8ff'), mute: c('--cx-muted', '#9aa1ab'), faint: c('--cx-faint', '#5d636d'), bg: c('--cx-bg', '#0b0c0e') };
}

// ───────── materiales por fases ─────────
type Mat = THREE.MeshStandardMaterial & { userData: { base: THREE.Color; flat: THREE.Color; maxOp: number; glow?: boolean; filled?: boolean; glass?: boolean } };
function mat(color: THREE.Color, o: { rough?: number; metal?: number; map?: THREE.Texture | null; opacity?: number; flat?: THREE.Color; glow?: boolean; filled?: boolean; physical?: boolean } = {}): Mat {
  // ciclo 41: SOLO lo que se vuelve translúcido es transparente (si todo lo es, three ordena mal etiqueta, líquido y vidrio)
  const P = { color: color.clone(), roughness: o.rough ?? 0.55, metalness: o.metal ?? 0.1, map: o.map ?? null, transparent: (o.opacity ?? 1) < 1 || !!o.physical, opacity: 1, emissive: color.clone() };
  // vidrio: MeshPhysicalMaterial con transmisión (refracción real), que entra con la luz
  const m = (o.physical ? new THREE.MeshPhysicalMaterial({ ...P, ior: 1.5, clearcoat: 1, clearcoatRoughness: 0.04, specularIntensity: 1, reflectivity: 0.6 }) : new THREE.MeshStandardMaterial(P)) as Mat;
  m.userData = { base: color.clone(), flat: (o.flat ?? color).clone(), maxOp: o.opacity ?? 1, glow: o.glow, filled: o.filled, glass: (o.opacity ?? 1) < 1, ...(o.physical ? { physical: true } : {}) } as Mat["userData"];   // filled: relleno ya en el 2D · glow: emite desde la fase sólida
  return m;
}
/** Contorno por «casco invertido»: la misma malla, caras traseras, empujada por su normal → silueta a cualquier ángulo. */
const OUTLINE_W = { value: 0.012 };
function outlineMat() {
  const m = new THREE.MeshBasicMaterial({ side: THREE.BackSide, transparent: true, depthWrite: false });
  m.onBeforeCompile = (sh) => { sh.uniforms.uW = OUTLINE_W; sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uW;').replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed += normalize(normal) * uW;'); };
  m.customProgramCacheKey = () => 'cx-plate-outline';
  return m;
}
function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; draw(cv.getContext('2d')!);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
/** Polilínea/discontinua en coordenadas del SVG (anotaciones del plano). */
type LineKind = 'ink' | 'acc' | 'sig' | 'mute';
function pl(pts: [number, number][], kind: LineKind, dashed = false, z = 0.02) {
  const g = new THREE.BufferGeometry().setFromPoints(pts.map(([x, y]) => V(x, y, z)));
  const m = dashed ? new THREE.LineDashedMaterial({ dashSize: 0.03, gapSize: 0.04, transparent: true }) : new THREE.LineBasicMaterial({ transparent: true });
  const l = new THREE.Line(g, m); if (dashed) l.computeLineDistances(); l.userData.kind = kind; l.userData.anno = true; return l;
}
function circlePts(cx: number, cy: number, r: number, n = 48): [number, number][] { return Array.from({ length: n + 1 }, (_, i) => [cx + Math.cos((i / n) * Math.PI * 2) * r, cy + Math.sin((i / n) * Math.PI * 2) * r]); }
function textPlane(text: string, x: number, y: number, align: 'left' | 'center' | 'right' = 'left') {
  const H = 64, cv = document.createElement('canvas'), g = cv.getContext('2d')!; g.font = `500 ${H * 0.62}px ui-monospace, monospace`;
  const w = Math.ceil(g.measureText(text).width + 8); cv.width = w; cv.height = H;
  g.font = `500 ${H * 0.62}px ui-monospace, monospace`; g.fillStyle = '#fff'; g.textBaseline = 'middle'; g.fillText(text, 4, H / 2);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const hh = 0.075, ww = (hh * w) / H;   // 7,5 u de cuerpo, como el rótulo del SVG
  const m = new THREE.Mesh(new THREE.PlaneGeometry(ww, hh * 1.25), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
  const ox = align === 'left' ? ww / 2 : align === 'right' ? -ww / 2 : 0;
  m.position.set(X(x) + ox, Y(y) + hh * 0.35, 0.03); m.userData.label = true; return m;
}
function shapeFrom(pts: [number, number][]) { const s = new THREE.Shape(); pts.forEach(([x, y], i) => (i ? s.lineTo(X(x), Y(y)) : s.moveTo(X(x), Y(y)))); return s; }
function roundedPts(x0: number, y0: number, x1: number, y1: number, r: number): [number, number][] {
  const out: [number, number][] = []; const arc = (cx: number, cy: number, a0: number) => { for (let i = 0; i <= 6; i++) { const a = a0 + (i / 6) * (Math.PI / 2); out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } };
  arc(x1 - r, y0 + r, -Math.PI / 2); arc(x1 - r, y1 - r, 0); arc(x0 + r, y1 - r, Math.PI / 2); arc(x0 + r, y0 + r, Math.PI); return out;
}
const extrude = (pts: [number, number][], depth: number, holes: [number, number, number][] = []) => { const s = shapeFrom(pts); holes.forEach(([cx, cy, r]) => { const h = new THREE.Path(); h.absarc(X(cx), Y(cy), r / 100, 0, Math.PI * 2, true); s.holes.push(h); }); return new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 18 }); };

// ───────── figuras (coordenadas del SVG de GoalPlates) ─────────
function figWeb(p: Pal): Fig {
  const root = new THREE.Group();
  const screen = canvasTex(512, 300, (g) => {
    g.fillStyle = '#0d1016'; g.fillRect(0, 0, 512, 300);
    g.strokeStyle = 'rgba(255,255,255,.06)'; for (let x = 0; x < 512; x += 24) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 300); g.stroke(); } for (let y = 0; y < 300; y += 24) { g.beginPath(); g.moveTo(0, y); g.lineTo(512, y); g.stroke(); }
    g.fillStyle = '#1b2030'; g.fillRect(0, 0, 512, 40);
    g.fillStyle = 'rgba(255,255,255,.5)'; g.fillRect(28, 252, 120, 8); g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(28, 268, 80, 6);
  });
  const frame = new THREE.Mesh(extrude(roundedPts(34, 14, 286, 166, 7), 0.06), mat(new THREE.Color('#1a1d24'), { rough: 0.4, metal: 0.3 })); frame.position.z = -0.36;
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(2.48, 1.48), mat(new THREE.Color('#ffffff'), { map: screen, rough: 0.9, flat: new THREE.Color('#141822') })); scr.position.set(0, 0, -0.295); scr.userData.noOutline = true;
  // ciclo 42: el tablero se pinta primero y NO escribe profundidad → la órbita discontinua pasa por delante de él
  // (y sigue escondiéndose detrás del cubo, que sí escribe profundidad)
  frame.userData.noDepth = scr.userData.noDepth = true; frame.renderOrder = -2; scr.renderOrder = -1.5;
  // cubo isométrico: hexágono de radio 0,36 → arista 0,36 / √(2/3); caras visibles: +Y (acento), −X (izq.), +Z (der.)
  const a = 0.36 / Math.sqrt(2 / 3), grey = (k: number) => p.ink.clone().multiplyScalar(k);
  const cube = new THREE.Mesh(new THREE.BoxGeometry(a, a, a), [mat(grey(0.3)), mat(grey(0.5), { rough: 0.35 }), mat(p.acc, { rough: 0.35, metal: 0.2 }), mat(grey(0.3)), mat(grey(0.25), { rough: 0.35 }), mat(grey(0.3))]);
  cube.rotation.set(Math.atan(1 / Math.SQRT2), Math.PI / 4, 0, 'XYZ');
  const cubeG = new THREE.Group(); cubeG.add(cube); cubeG.position.set(0, Y(98), 0.1);
  // órbita: elipse rx 74, ry 20 = círculo inclinado (discontinua, como el SVG)
  const orbitPts = Array.from({ length: 97 }, (_, i) => { const t = (i / 96) * Math.PI * 2; return new THREE.Vector3(0.74 * Math.cos(t), 0.2 * Math.sin(t), 0.71 * Math.sin(t)); });
  const orbit = new THREE.Line(new THREE.BufferGeometry().setFromPoints(orbitPts), new THREE.LineDashedMaterial({ dashSize: 0.03, gapSize: 0.04, transparent: true })); orbit.computeLineDistances(); orbit.userData.kind = 'acc'; orbit.userData.anno = true; orbit.position.set(0, Y(100), 0.1); orbit.renderOrder = 5;
  const arrow = pl([[229, 94], [234, 100], [240, 95]], 'acc', false, 0.12);
  const hot = new THREE.Mesh(new THREE.SphereGeometry(0.032, 16, 12), mat(p.sig, { rough: 0.2, filled: true })); hot.userData.noOutline = true;
  const leader = pl([[192, 77], [220, 56], [252, 56]], 'sig', false, 0.3);
  const lab = textPlane('HOTSPOT · 02', 222, 52);
  const urlbar = pl([...roundedPts(91, 19, 201, 29, 5), [96, 19]] as [number, number][], 'ink', false, -0.29), bar = pl([[34, 34], [286, 34]], 'ink', false, -0.29);
  const dots = [46, 55, 64].map((x) => pl(circlePts(x, 24, 2.5, 16), 'ink', false, -0.29));
  const ar: [number, number][] = [[0, 0], [0, 16], [4, 12], [7, 19], [10, 17.5], [7, 10.5], [13, 10.5]];
  const cursor = new THREE.Mesh(extrude(ar.map(([x, y]) => [212 + x, 128 + y] as [number, number]), 0.02), mat(p.ink, { rough: 0.5 })); cursor.position.z = 0.4;
  root.add(frame, scr, cubeG, orbit, arrow, hot, leader, lab, urlbar, bar, ...dots, cursor);
  const corner = new THREE.Vector3(a / 2, a / 2, a / 2), tmp = new THREE.Vector3();   // esquina que proyecta a (189, 79)
  return { root, tick: (t, lit) => {
    const u = (t % 2.8) / 2.8;
    cubeG.position.y = Y(98) + keys([0, 0.5, 1], [[0], [0.04], [0]], CX_EASE, u)[0];
    cursor.position.x = -keys([0, 0.5, 1], [[0], [0.3], [0]], CX_EASE, u)[0];
    cube.rotation.y = Math.PI / 4 + t * 0.9 * lit;
    orbit.rotation.y = t * 0.26;   // las discontinuas «marchan» como en el SVG
    // el punto de información sigue a su esquina del cubo (en 2D: (189, 79))
    tmp.copy(corner).applyEuler(cube.rotation).add(cubeG.position); hot.position.copy(tmp); hot.position.z += 0.02;
    hot.scale.setScalar(keys([0, 0.5, 1], [[1], [1.7], [1]], CX_EASE, (t % 1.4) / 1.4)[0]);
    const pos = leader.geometry.getAttribute('position') as THREE.BufferAttribute; pos.setXYZ(0, hot.position.x + 0.03, hot.position.y + 0.02, 0.3); pos.needsUpdate = true;
  } };
}
function figVideo(p: Pal): Fig {
  const root = new THREE.Group();
  const frame = new THREE.Mesh(extrude(roundedPts(40, 14, 280, 118, 4), 0.04), mat(new THREE.Color('#141821'), { rough: 0.8 })); frame.position.z = -0.25;
  // trayectoria: la cúbica EXACTA del SVG (M70 96 C110 20 190 20 250 70), discontinua
  const cb = new THREE.CubicBezierCurve(new THREE.Vector2(70, 96), new THREE.Vector2(110, 20), new THREE.Vector2(190, 20), new THREE.Vector2(250, 70));
  const path = pl(cb.getPoints(64).map((q) => [q.x, q.y] as [number, number]), 'mute', true, 0);
  const K = [[70, 96], [120.5, 44.7], [184.2, 37.4], [250, 70]];
  const ghosts = K.slice(0, 3).map(([x, y]) => pl(circlePts(x, y, 9, 28), 'acc', true, 0));
  const ghostM = K.slice(0, 3).map(([x, y], i) => { const g = new THREE.Mesh(new THREE.SphereGeometry(0.085, 20, 14), mat(p.acc, { rough: 0.6, opacity: 0.18 + i * 0.1 })); g.position.copy(V(x, y)); g.userData.noOutline = true; g.userData.litOnly = true; return g; });
  const target = pl(circlePts(250, 70, 11, 32), 'ink', false, 0);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.11, 32, 24), mat(p.acc, { rough: 0.25, metal: 0.1, filled: true })); ball.userData.noOutline = true;
  const base = pl([[40, 146], [280, 146]], 'ink'), ticks = new THREE.Group();
  for (let x = 40; x <= 280; x += 20) ticks.add(pl([[x, (x - 40) % 60 === 0 ? 142 : 143], [x, (x - 40) % 60 === 0 ? 150 : 149]], 'ink'));
  const kf = [70, 120, 184, 250].map((x) => { const k = new THREE.Mesh(new THREE.OctahedronGeometry(0.06), mat(p.acc, { rough: 0.3 })); k.position.set(X(x), Y(146), 0.02); k.scale.set(1, 1, 0.5); k.userData.lk = 'acc'; return k; });
  const head = new THREE.Group(); head.add(pl([[70, 128], [70, 162]], 'sig', false, 0.05), pl([[65, 124], [75, 124], [70, 130], [65, 124]], 'sig', false, 0.05));
  const l0 = textPlane('00:00', 40, 174), l1 = textPlane('00:04', 280, 174, 'right');
  root.add(frame, path, ...ghosts, ...ghostM, target, ball, base, ticks, ...kf, head, l0, l1);
  const bt = [0, 0.3, 0.6, 0.9, 1], bv = [[0, 0], [50.5, -51.3], [114.2, -58.6], [180, -26], [180, -26]], hv = [[0], [50.5], [114.2], [180], [180]];
  return { root, tick: (t, lit) => {
    const u = (t % 2.6) / 2.6, d = keys(bt, bv, IN_OUT, u);   // cxp-ball: cubic-bezier(.65,0,.35,1) por tramo, en línea recta
    ball.position.copy(V(70 + d[0], 96 + d[1], 0.02));
    head.position.x = keys(bt, hv, (x) => x, u)[0] / 100;     // cxp-head: lineal
    kf.forEach((k) => { k.rotation.y = t * 1.5 * lit; });
  } };
}
/** Tronco de pirámide rectangular: frente w0×h0 en z = 0 (abierto: lo tapa el difusor), fondo w1×h1 en z = −d. */
function frustum(w0: number, h0: number, w1: number, h1: number, d: number) {
  const f = [[-w0 / 2, -h0 / 2, 0], [w0 / 2, -h0 / 2, 0], [w0 / 2, h0 / 2, 0], [-w0 / 2, h0 / 2, 0]];
  const b = [[-w1 / 2, -h1 / 2, -d], [w1 / 2, -h1 / 2, -d], [w1 / 2, h1 / 2, -d], [-w1 / 2, h1 / 2, -d]];
  const P = [...f, ...b], quads = [[1, 0, 4, 5], [2, 1, 5, 6], [3, 2, 6, 7], [0, 3, 7, 4], [5, 4, 7, 6]];
  const pos: number[] = [];
  for (const [a, b2, c, e] of quads) for (const i of [a, b2, c, a, c, e]) pos.push(...P[i]);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals(); return g;
}

function figProduct(p: Pal): Fig {
  const root = new THREE.Group();
  // perfil del frasco: cuerpo 130–190 (r 30, esquinas r10 arriba y r8 abajo), cuello r 9 (60–72), tapa r 14 (45–60)
  const prof: [number, number][] = [[0, 152], [22, 152]];
  for (let i = 1; i <= 6; i++) { const a = -Math.PI / 2 + (i / 6) * (Math.PI / 2); prof.push([22 + Math.cos(a) * 8, 144 - Math.sin(a) * 8]); }
  prof.push([30, 82]); for (let i = 1; i <= 6; i++) { const a = (i / 6) * (Math.PI / 2); prof.push([20 + Math.cos(a) * 10, 82 - Math.sin(a) * 10]); }
  prof.push([9, 72], [9, 60], [0, 60]);
  const glassM = mat(new THREE.Color('#eef6ff'), { rough: 0.04, metal: 0, physical: true, flat: p.sig.clone().lerp(new THREE.Color('#ffffff'), 0.55) });
  const glass = new THREE.Mesh(new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r / 100, Y(y))), 56), glassM); glass.renderOrder = 4;   // el vidrio se dibuja el último
  // líquido (perfume ámbar) visible a través del vidrio solo en la fase iluminada
  const liq: [number, number][] = [[0, 149], [24, 149], [27, 145], [27, 98], [0, 98]];
  const liquid = new THREE.Mesh(new THREE.LatheGeometry(liq.map(([r, y]) => new THREE.Vector2(r / 100, Y(y))), 48), mat(new THREE.Color('#e08a2c'), { rough: 0.15, metal: 0 })); liquid.userData.litOnly = true; liquid.userData.noOutline = true;
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.15, 40), mat(new THREE.Color('#1c1f26'), { rough: 0.25, metal: 0.8 })); cap.position.y = Y(52.5);
  const label = canvasTex(512, 160, (g) => { g.fillStyle = '#efe9df'; g.fillRect(0, 0, 512, 160); g.fillStyle = '#1b1d22'; g.font = '700 64px sans-serif'; g.fillText('AW', 210, 92); g.fillRect(200, 112, 112, 4); g.font = '500 20px monospace'; g.fillText('50 ML · N.º 01', 186, 140); });
  const lab = new THREE.Mesh(new THREE.CylinderGeometry(0.302, 0.302, 0.24, 56, 1, true), mat(new THREE.Color('#ffffff'), { map: label, rough: 0.7, flat: new THREE.Color('#efe9df') })); lab.position.y = Y(114);
  const ground = new THREE.Mesh(new THREE.CircleGeometry(0.54, 56), mat(new THREE.Color('#141519'), { rough: 0.35, metal: 0.3 }));   // base de estudio oscura y algo reflectante
  ground.rotation.x = -Math.PI / 2 + Math.asin(6 / 54); ground.position.y = Y(154); ground.userData.noOutline = true; ground.userData.litOnly = true;
  const groundL = new THREE.Line(new THREE.BufferGeometry().setFromPoints(Array.from({ length: 65 }, (_, i) => { const a = (i / 64) * Math.PI * 2; return new THREE.Vector3(0.54 * Math.cos(a), Y(154) + 0.06 * Math.sin(a), 0.537 * Math.sin(a)); })), new THREE.LineDashedMaterial({ dashSize: 0.03, gapSize: 0.04, transparent: true })); groundL.computeLineDistances(); groundL.userData.kind = 'ink'; groundL.userData.anno = true;
  // caja de luz: cuadrilátero (44,32)-(96,20)-(104,52)-(52,64) → 0,53 × 0,33, girada +13° (y hacia arriba)
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.535, 0.33, 0.04), mat(new THREE.Color('#ffffff'), { rough: 0.9, glow: true }));
  // ciclo 42: una luz de estudio real (softbox): el difusor es la cara de un cuerpo troncopiramidal con fondo y pie;
  // de frente coincide con el dibujo 2D (el cuerpo queda oculto detrás) y al girar la cámara se ve su volumen
  const light = new THREE.Group(); light.position.set(X(74), Y(42), 0.1); light.rotation.z = Math.atan2(12, 52);
  const housing = new THREE.Mesh(frustum(0.535, 0.33, 0.2, 0.12, 0.32), mat(new THREE.Color('#23262d'), { rough: 0.8, metal: 0.05, flat: p.ink.clone().multiplyScalar(0.35) })); housing.position.z = -0.02;
  const yoke = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.08, 16), mat(new THREE.Color('#1c1f26'), { rough: 0.4, metal: 0.7 })); yoke.rotation.x = Math.PI / 2; yoke.position.z = -0.38; yoke.userData.noOutline = true;
  light.add(box, housing, yoke);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, Y(42) - Y(156), 12), mat(new THREE.Color('#1c1f26'), { rough: 0.4, metal: 0.7 }));
  pole.position.set(X(74), (Y(42) + Y(156)) / 2, 0.1 - 0.4); pole.userData.litOnly = true; pole.userData.noOutline = true;
  const rays = [[[104, 46], [134, 80]], [[100, 58], [132, 100]], [[92, 62], [130, 124]]].map((q) => pl(q as [number, number][], 'acc', true, 0.05));
  const brk = [[[116, 48], [116, 38], [126, 38]], [[204, 48], [204, 38], [194, 38]], [[116, 150], [116, 160], [126, 160]], [[204, 150], [204, 160], [194, 160]]].map((q) => pl(q as [number, number][], 'sig', false, 0.4));
  const lab2 = textPlane('f/8 · 1/125 · ISO 100', 214, 34);
  root.add(liquid, glass, cap, lab, ground, groundL, light, pole, ...rays, ...brk, lab2);
  return { root, tick: (t, lit) => { glass.rotation.y = liquid.rotation.y = t * 0.5 * lit; lab.rotation.y = Math.PI + t * 0.5 * lit; light.rotation.x = 0.3 * lit; } };   // u = 0,5 de la etiqueta (el «AW») de frente
}
function figIA(p: Pal): Fig {
  const root = new THREE.Group();
  const N = [[52, 50], [52, 90], [52, 130], [132, 36], [132, 72], [132, 108], [132, 144], [208, 70], [208, 110]];
  const nodes = N.map(([x, y], i) => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.06, 24, 16), mat(i >= 7 ? p.acc : p.ink.clone().multiplyScalar(0.8), { rough: 0.3, metal: 0.2 })); m.position.copy(V(x, y)); if (i >= 7) m.userData.lk = 'acc'; return m; });
  // aristas y pulsos IGUAL que el SVG: mismos extremos, 1,1 s lineal, mismos retrasos
  const all: [number, number, number, number, number][] = [];
  [[50, 36], [50, 72], [50, 108], [50, 144], [90, 36], [90, 72], [90, 108], [90, 144], [130, 36], [130, 72], [130, 108], [130, 144]].forEach(([y0, y1], i) => all.push([58, y0, 126, y1, (i % 4) * 0.22]));
  [[36, 70], [36, 110], [72, 70], [72, 110], [108, 70], [108, 110], [144, 70], [144, 110]].forEach(([y0, y1], i) => all.push([138, y0, 202, y1, 0.5 + (i % 4) * 0.2]));
  const links = all.map(([x0, y0, x1, y1]) => pl([[x0, y0], [x1, y1]], 'mute', false, -0.01));
  const pulses = all.map(() => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.02, 10, 8), mat(p.acc, { rough: 0.2, filled: true })); m.userData.noOutline = true; return m; });
  const bubPts: [number, number][] = [[236, 32], [288, 32], [295, 35], [298, 42], [298, 56], [295, 63], [288, 66], [248, 66], [238, 74], [238, 66], [236, 66], [229, 63], [226, 56], [226, 42], [229, 35]];
  const bubble = new THREE.Mesh(extrude(bubPts, 0.06), mat(new THREE.Color('#202532'), { rough: 0.5 })); bubble.position.z = -0.03;
  const dots = [250, 262, 274].map((x) => { const d = new THREE.Mesh(new THREE.SphereGeometry(0.026, 12, 10), mat(p.ink, { rough: 0.4 })); d.position.copy(V(x, 49, 0.06)); return d; });
  const reply = new THREE.Mesh(extrude(roundedPts(232, 100, 296, 128, 8), 0.05), mat(p.sig.clone().multiplyScalar(0.55), { rough: 0.4 })); reply.position.z = -0.025;
  const rl = [pl([[244, 110], [280, 110]], 'sig', false, 0.04), pl([[244, 118], [266, 118]], 'sig', false, 0.04)];
  root.add(...nodes, ...links, ...pulses, bubble, reply, ...rl, ...dots);
  return { root, tick: (t) => {
    pulses.forEach((m, i) => { const [x0, y0, x1, y1, dl] = all[i]; const u = t - dl; m.visible = u >= 0; const k = Math.min(1, ((u / 1.1) % 1) + 0.06); m.position.set(X(x0 + (x1 - x0) * k), Y(y0 + (y1 - y0) * k), 0.01); });
    dots.forEach((d, i) => { const u = t - i * 0.15; d.position.y = Y(49) + (u > 0 ? keys([0, 0.5, 1], [[0], [0.03], [0]], SINE, u % 1)[0] : 0); });
  } };
}
function figTech(p: Pal): Fig {
  const root = new THREE.Group();
  const metal = canvasTex(256, 256, (g) => { g.fillStyle = '#8b9099'; g.fillRect(0, 0, 256, 256); for (let i = 0; i < 900; i++) { g.strokeStyle = `rgba(255,255,255,${Math.random() * 0.08})`; const y = Math.random() * 256; g.beginPath(); g.moveTo(0, y); g.lineTo(256, y + Math.random() * 2); g.stroke(); } });
  metal.wrapS = metal.wrapT = THREE.RepeatWrapping;
  // engranaje: mismos dientes que el SVG (ángulos con y hacia abajo → espejo en 3D)
  const gs = new THREE.Shape();
  for (let i = 0; i < 12; i++) { const a0 = (i / 12) * Math.PI * 2, s = (Math.PI * 2) / 12; ([[a0, 35], [a0 + s * 0.18, 42], [a0 + s * 0.5, 42], [a0 + s * 0.68, 35]] as [number, number][]).forEach(([a, r], k) => { const x = (Math.cos(a) * r) / 100, y = -(Math.sin(a) * r) / 100; if (i === 0 && k === 0) gs.moveTo(x, y); else gs.lineTo(x, y); }); }
  const hole = new THREE.Path(); hole.absarc(0, 0, 0.12, 0, Math.PI * 2, true); gs.holes.push(hole);
  const gear = new THREE.Mesh(new THREE.ExtrudeGeometry(gs, { depth: 0.14, bevelEnabled: false, curveSegments: 24 }), mat(new THREE.Color('#c9ccd2'), { map: metal, rough: 0.35, metal: 0.85, flat: new THREE.Color('#8b9099') }));
  gear.position.set(X(110), Y(100), -0.07);
  const plate = new THREE.Mesh(extrude([[190, 96], [286, 96], [286, 130], [190, 130]], 0.16, [[211, 113, 5], [265, 113, 5]]), mat(new THREE.Color('#9aa0a8'), { map: metal, rough: 0.45, metal: 0.7, flat: new THREE.Color('#7d838c') })); plate.position.z = -0.08;
  const screwM = mat(p.acc, { rough: 0.3, metal: 0.6 });
  const screws = [211, 265].map((x) => {
    const g = new THREE.Group(); const head = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.06, 24), screwM); const sh = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.26, 16), screwM); sh.position.y = -0.16; head.userData.lk = sh.userData.lk = 'acc';
    g.add(head, sh); [46, 52, 58].forEach((y) => { const l = pl([[157, y - 37 + 90], [163, y - 37 + 90]], 'acc', false, 0.032); g.add(l); });
    g.position.set(X(x), Y(37), 0); return g;
  });
  const axes = [pl([[60, 100], [160, 100]], 'mute', true, 0.08), pl([[110, 50], [110, 150]], 'mute', true, 0.08), pl([[211, 70], [211, 108]], 'mute', true, 0.1), pl([[265, 70], [265, 108]], 'mute', true, 0.1)];
  const dim = [pl([[68, 152], [68, 162]], 'sig'), pl([[152, 152], [152, 162]], 'sig'), pl([[68, 158], [152, 158]], 'sig'), pl([[68, 158], [74, 155], [74, 161], [68, 158]], 'sig'), pl([[152, 158], [146, 155], [146, 161], [152, 158]], 'sig')];
  const lab = textPlane('Ø 84.0', 110, 176, 'center');
  root.add(gear, plate, ...screws, ...axes, ...dim, lab);
  return { root, tick: (t, lit) => {
    gear.rotation.z = -(t * Math.PI * 2) / 9;                 // cxp-spin: 9 s por vuelta, horario
    const e = IN_OUT(Math.min(1, t / 1));                     // tornillos: transición de 1 s y se quedan abajo
    screws.forEach((s) => { s.position.y = Y(37) - 0.56 * e; s.rotation.y = t * 1.2 * lit; });
  } };
}
const BUILD: Record<string, (p: Pal) => Fig> = { 'web-3d': figWeb, 'video-anim': figVideo, imagenes: figProduct, ia: figIA, otros: figTech };

/** Un lienzo 3D (renderer + escena) que anima UNA lámina a la vez. */
function makeSlot() {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.NoToneMapping; renderer.setClearColor(0, 0);
  const canvas = renderer.domElement; canvas.className = 'cx-plate-3d'; canvas.setAttribute('aria-hidden', 'true');
  const wipe = document.createElement('i'); wipe.className = 'cx-plate-wipe'; wipe.setAttribute('aria-hidden', 'true');
  const scene = new THREE.Scene();
  const pm = new THREE.PMREMGenerator(renderer); const env = pm.fromScene(new RoomEnvironment(), 0.04).texture; scene.environment = env;
  const hemi = new THREE.HemisphereLight(0xffffff, 0x1a1d24, 0); const key = new THREE.DirectionalLight(0xffffff, 0); key.position.set(-2, 3, 4); const rim = new THREE.DirectionalLight(0xffc7a8, 0); rim.position.set(3, 1, -3);
  scene.add(hemi, key, rim);
  const camera = new THREE.PerspectiveCamera(4, 16 / 9, 0.05, 400);
  const LK = ['ink', 'acc', 'sig'] as const;
  const edgeMats = Object.fromEntries(LK.map((k) => [k, new THREE.LineBasicMaterial({ transparent: true, depthWrite: false })])) as Record<(typeof LK)[number], THREE.LineBasicMaterial>;
  const outMats = Object.fromEntries(LK.map((k) => [k, outlineMat()])) as Record<(typeof LK)[number], THREE.MeshBasicMaterial>;
  const outClones: { k: (typeof LK)[number]; m: THREE.MeshBasicMaterial }[] = [];   // ciclo 42: contornos sin profundidad
  const cache = new Map<string, { fig: Fig; mats: Mat[]; annos: THREE.Line[]; labels: THREE.Mesh[]; litOnly: THREE.Object3D[] }>();
  let active: { id: string; plate: HTMLElement; svg: SVGSVGElement; P: number; dir: 1 | -1; t0: number } | null = null;
  let raf = 0, last = 0;

  const prep = (id: string, pal: Pal) => {
    let c = cache.get(id); if (c) return c;
    const fig = (BUILD[id] ?? figWeb)(pal); const mats: Mat[] = [], annos: THREE.Line[] = [], labels: THREE.Mesh[] = [], litOnly: THREE.Object3D[] = [];
    const meshes: THREE.Mesh[] = [];
    fig.root.traverse((o) => { if ((o as THREE.Line).isLine && o.userData.anno) annos.push(o as THREE.Line); else if ((o as THREE.Mesh).isMesh && o.userData.label) labels.push(o as THREE.Mesh); else if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh); if (o.userData.litOnly) litOnly.push(o); });
    for (const m of meshes) {
      (Array.isArray(m.material) ? m.material : [m.material]).forEach((x) => mats.push(x as Mat));
      if (m.userData.litOnly) continue;
      const lk = (m.userData.lk ?? 'ink') as (typeof LK)[number];
      m.add(new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry, 28), edgeMats[lk]));
      if (m.userData.noDepth) (Array.isArray(m.material) ? m.material : [m.material]).forEach((x) => { (x.userData as { noDepth?: boolean }).noDepth = true; });
      if (!m.userData.noOutline) {
        // ciclo 42: el contorno de una pieza sin profundidad va antes que ella y tampoco escribe profundidad
        let om = outMats[lk];
        if (m.userData.noDepth) { om = outMats[lk].clone(); om.depthWrite = false; outClones.push({ k: lk, m: om }); }
        const o = new THREE.Mesh(m.geometry, om); o.renderOrder = m.userData.noDepth ? -3 : -1; m.add(o);
      }
    }
    c = { fig, mats: [...new Set(mats)], annos, labels, litOnly }; cache.set(id, c); return c;
  };
  const place = () => {
    if (!active) return;
    const fig = active.svg.parentElement as HTMLElement, r = active.svg.getBoundingClientRect(), f = fig.getBoundingClientRect();
    if (canvas.parentElement !== fig) { fig.appendChild(canvas); fig.appendChild(wipe); }
    canvas.style.left = `${r.left - f.left}px`; canvas.style.top = `${r.top - f.top}px`; canvas.style.width = `${r.width}px`; canvas.style.height = `${r.height}px`;
    wipe.style.top = `${r.top - f.top}px`; wipe.style.height = `${r.height}px`;
    renderer.setSize(Math.max(1, r.width), Math.max(1, r.height), false); camera.aspect = r.width / Math.max(1, r.height);
  };
  const frame = (now: number) => {
    raf = 0; if (!active) return;
    const dt = Math.min(0.05, (now - last) / 1000 || 0); last = now;
    active.P = Math.max(0, Math.min(END, active.P + dt * (active.dir > 0 ? 1 : -2.5)));
    const P = active.P, time = (now - active.t0) / 1000;
    const pal = palette(active.plate); const c = prep(active.id, pal);
    scene.children.filter((o) => o.userData.fig).forEach((o) => scene.remove(o)); c.fig.root.userData.fig = true; scene.add(c.fig.root);
    // fases: barrido 2D → lineart 3D (0,45–0,95) → color sólido (0,95–1,4) → luz y texturas (1,4–2,0); cámara 1,3–2,4
    const w = ease(smooth(0.45, 0.95, P)), solid = smooth(0.95, 1.4, P), lit = smooth(1.4, 2.0, P), cam = ease(smooth(1.3, END, P));
    const cw = parseFloat(canvas.style.width) || 1;
    canvas.style.opacity = '1'; canvas.style.clipPath = `inset(-30% ${((1 - w) * 100).toFixed(2)}% -30% -30%)`;
    active.svg.style.clipPath = w > 0 ? `inset(-30% -30% -30% ${(w * 100).toFixed(2)}%)` : '';
    wipe.style.left = `${parseFloat(canvas.style.left) + w * cw}px`; wipe.style.opacity = w > 0.001 && w < 0.999 ? '1' : '0';
    // las líneas del SVG en hover van a ,8 de opacidad → el lineart 3D también
    const lineOp = 0.8 * (1 - 0.75 * lit);
    const lc = { ink: pal.ink, acc: pal.acc, sig: pal.sig };
    LK.forEach((k) => { edgeMats[k].color.copy(lc[k]); edgeMats[k].opacity = lineOp; outMats[k].color.copy(lc[k]); outMats[k].opacity = lineOp; });
    for (const o of outClones) { o.m.color.copy(lc[o.k]); o.m.opacity = lineOp; }
    OUTLINE_W.value = (1.15 / cw) * 3.2 * (1 + cam * 0.6);
    const kc: Record<string, THREE.Color> = { ink: pal.ink, acc: pal.acc, sig: pal.sig, mute: pal.mute };
    for (const l of c.annos) { const m = l.material as THREE.LineBasicMaterial; m.color.copy(kc[l.userData.kind as string] ?? pal.ink); m.opacity = (l.userData.kind === 'mute' ? 0.55 : 0.85) * (1 - 0.45 * lit); }
    for (const l of c.labels) { const m = l.material as THREE.MeshBasicMaterial; m.color.copy(pal.faint); m.opacity = 1 - 0.5 * lit; }
    for (const o of c.litOnly) o.visible = lit > 0.01;
    for (const m of c.mats) {
      const d = m.userData;
      // lineart: caras del color del fondo (tapan lo de atrás, como el dibujo) → sólido plano → iluminado
      m.opacity = d.glass ? 1 - (1 - d.maxOp) * solid : d.maxOp; m.depthWrite = !d.glass || solid < 0.5;
      if (d.filled) m.emissive.copy(d.base).multiplyScalar(1 - 0.6 * lit);
      else if (d.glow) m.emissive.copy(pal.bg).lerp(d.base, solid);
      else m.emissive.copy(pal.bg).lerp(d.flat, solid).multiplyScalar(1 - lit);
      m.color.copy(d.base).multiplyScalar(Math.max(0.0001, lit)); m.envMapIntensity = lit;
      // vidrio: transparente con reflejos del entorno y barniz (deja ver el líquido); sin transmisión (el fondo es transparente)
      if ((d as { physical?: boolean }).physical) { m.opacity = 1 - 0.74 * lit; m.depthWrite = lit < 0.5; m.envMapIntensity = 2.2 * lit; }
      if ((d as { noDepth?: boolean }).noDepth) m.depthWrite = false;
    }
    hemi.intensity = 0.9 * lit; key.intensity = 2.2 * lit; rim.intensity = 1.1 * lit;
    c.fig.tick(time, lit);
    // encuadre «meet» del SVG: limita el ancho (3,2 u) o el alto (1,8 u); en 3D se abre un poco
    const fov = 4 + 26 * cam, half = Math.tan(THREE.MathUtils.degToRad(fov) / 2);
    const d = Math.max(0.9 / half, 1.6 / (half * camera.aspect)) * (1 + 0.38 * cam);
    const th = 0.62 * cam, ph = 0.3 * cam;
    camera.fov = fov; camera.position.set(d * Math.sin(th) * Math.cos(ph), d * Math.sin(ph), d * Math.cos(th) * Math.cos(ph)); camera.lookAt(0, 0, 0);
    camera.near = d / 50; camera.far = d * 4; camera.updateProjectionMatrix();
    renderer.render(scene, camera);
    if (active.dir < 0 && P <= 0) { active.svg.style.clipPath = ''; active.plate.classList.remove('p3d-live'); canvas.remove(); wipe.remove(); active = null; return; }
    raf = requestAnimationFrame(frame);
  };
  const kick = () => { if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); } };
  const onResize = () => place();
  window.addEventListener('resize', onResize);

  return {
    plate: () => active?.plate ?? null,
    leaving: () => !!active && active.dir < 0,
    progress: () => active?.P ?? 0,
    enter(plate: HTMLElement, id: string) {
      const svg = plate.querySelector('.cx-plate-fig svg') as SVGSVGElement | null; if (!svg) return;
      if (active && active.plate !== plate) { active.svg.style.clipPath = ''; active.plate.classList.remove('p3d-live'); active = null; }
      // el reloj del 3D arranca con el del CSS (:hover): mismas animaciones, mismo instante
      if (!active) active = { id, plate, svg, P: 0, dir: 1, t0: performance.now() };
      active.dir = 1; plate.classList.add('p3d-live'); place(); kick();
    },
    leave(plate: HTMLElement) { if (active && active.plate === plate) { active.dir = -1; kick(); } },
    dispose() { cancelAnimationFrame(raf); window.removeEventListener('resize', onResize); canvas.remove(); wipe.remove(); env.dispose(); pm.dispose(); renderer.dispose(); },
  };
}

/**
 * Ciclo 43: DOS lienzos. Al pasar de una lámina a otra, la que se deja termina su salida (3D → lineart → 2D)
 * en su propio lienzo mientras la nueva empieza la entrada en el otro; antes el único lienzo cortaba la salida.
 * El segundo lienzo se crea solo cuando hace falta.
 */
export function createPlate3D() {
  const slots = [makeSlot()];
  return {
    enter(plate: HTMLElement, id: string) {
      let s = slots.find((x) => x.plate() === plate) ?? slots.find((x) => !x.plate());
      if (!s && slots.length < 2) { s = makeSlot(); slots.push(s); }
      // los dos ocupados (cambios muy rápidos): se recicla el que va saliendo y está más cerca de terminar
      if (!s) s = slots.filter((x) => x.leaving()).sort((a, b) => a.progress() - b.progress())[0] ?? slots[0];
      s.enter(plate, id);
    },
    leave(plate: HTMLElement) { slots.find((x) => x.plate() === plate)?.leave(plate); },
    dispose() { slots.forEach((x) => x.dispose()); },
  };
}
