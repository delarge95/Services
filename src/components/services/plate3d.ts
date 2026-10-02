/**
 * plate3d.ts — Las láminas de «¿Qué quieres lograr?» pasan de 2D a 3D al pasar el cursor (ciclo 38).
 *
 * Misma idea que el dron de la intro, en pequeño:
 *   2D (SVG animado) → LINEART 3D en vista frontal sin perspectiva (calca el dibujo) → COLOR SÓLIDO plano
 *   → 3D con luz, materiales y texturas mientras la cámara gira a 3/4 (dolly-zoom 4° → 30°).
 * Al salir se recorre la misma línea de tiempo al revés y más rápido (×3).
 * Un único renderizador WebGL compartido: el lienzo se muda a la lámina activa (solo hay una a la vez).
 * Cada figura se construye en coordenadas del SVG (viewBox 320×180 → 3,2×1,8 unidades) para que la vista
 * frontal coincida con el dibujo.
 */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

type Fig = { root: THREE.Group; tick: (time: number, lit: number) => void };
const X = (x: number) => (x - 160) / 100;
const Y = (y: number) => -(y - 90) / 100;
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const smooth = (a: number, b: number, x: number) => { const k = clamp01((x - a) / (b - a)); return k * k * (3 - 2 * k); };
const ease = (x: number) => { x = clamp01(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
const END = 2.3;   // segundos de la línea de tiempo completa (2D → 3D)

type Pal = { ink: THREE.Color; acc: THREE.Color; sig: THREE.Color; mute: THREE.Color; bg: THREE.Color };
function palette(el: HTMLElement): Pal {
  const cs = getComputedStyle(el);
  const c = (v: string, d: string) => new THREE.Color((cs.getPropertyValue(v).trim() || d).replace(/\s/g, ''));
  const safe = (v: string, d: string) => { try { return c(v, d); } catch { return new THREE.Color(d); } };
  return { ink: safe('--cx-text', '#eceae4'), acc: safe('--cx-accent', '#ff7a3d'), sig: safe('--cx-signal', '#5ec8ff'), mute: safe('--cx-muted', '#9aa1ab'), bg: safe('--cx-bg', '#0b0c0e') };
}

/** Material que va de invisible → color plano (solo emisivo) → iluminado con texturas. */
type Mat = THREE.MeshStandardMaterial & { userData: { base: THREE.Color; flat: THREE.Color; maxOp?: number; glow?: number } };
function mat(color: THREE.Color, o: { rough?: number; metal?: number; map?: THREE.Texture | null; opacity?: number; flat?: THREE.Color } = {}): Mat {
  const m = new THREE.MeshStandardMaterial({ color: color.clone(), roughness: o.rough ?? 0.55, metalness: o.metal ?? 0.1, map: o.map ?? null, transparent: true, opacity: 0, emissive: color.clone() }) as Mat;
  m.userData.base = color.clone(); m.userData.flat = (o.flat ?? color).clone(); m.userData.maxOp = o.opacity ?? 1;   // flat: color sólido de la fase plana (las texturas llegan con la luz)
  return m;
}
function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; draw(cv.getContext('2d')!);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
const rounded = (w: number, h: number, r: number, x = -w / 2, y = -h / 2) => { const s = new THREE.Shape(); s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h); s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y); return s; };
function rod(a: THREE.Vector3, b: THREE.Vector3, r: number, m: THREE.Material) {
  const d = b.clone().sub(a), g = new THREE.CylinderGeometry(r, r, d.length(), 10); const o = new THREE.Mesh(g, m);
  o.position.copy(a).addScaledVector(d, 0.5); o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); return o;
}

// ───────── figuras (coordenadas del SVG) ─────────
function figWeb(p: Pal): Fig {
  const root = new THREE.Group();
  const screen = canvasTex(512, 300, (g) => {
    g.fillStyle = '#0d1016'; g.fillRect(0, 0, 512, 300);
    g.strokeStyle = 'rgba(255,255,255,.06)'; for (let x = 0; x < 512; x += 24) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 300); g.stroke(); } for (let y = 0; y < 300; y += 24) { g.beginPath(); g.moveTo(0, y); g.lineTo(512, y); g.stroke(); }
    g.fillStyle = '#1b2030'; g.fillRect(0, 0, 512, 34); g.fillStyle = '#2c3346'; g.fillRect(96, 9, 220, 16);
    ['#ff5f57', '#febc2e', '#28c840'].forEach((c, i) => { g.fillStyle = c; g.beginPath(); g.arc(18 + i * 16, 17, 5, 0, 7); g.fill(); });
    g.fillStyle = 'rgba(255,255,255,.5)'; g.fillRect(28, 250, 120, 8); g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(28, 266, 80, 6);
  });
  const frame = new THREE.Mesh(new THREE.ExtrudeGeometry(rounded(2.52, 1.52, 0.07), { depth: 0.06, bevelEnabled: false }), mat(new THREE.Color('#1a1d24'), { rough: 0.4, metal: 0.3 }));
  frame.position.set(0, 0, -0.36);
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(2.46, 1.46), mat(new THREE.Color('#ffffff'), { map: screen, rough: 0.9, flat: new THREE.Color('#141822') })); scr.position.set(0, 0, -0.29);
  const cubeMats = [p.acc, p.ink.clone().multiplyScalar(0.55), p.ink.clone().multiplyScalar(0.3), p.acc.clone().multiplyScalar(0.7), p.ink.clone().multiplyScalar(0.45), p.ink.clone().multiplyScalar(0.25)].map((c) => mat(c, { rough: 0.35, metal: 0.2 }));
  const cube = new THREE.Mesh(new THREE.BoxGeometry(0.41, 0.41, 0.41), cubeMats);
  const cubeG = new THREE.Group(); cubeG.add(cube); cubeG.position.set(0, Y(98), 0.1);
  cube.rotation.set(Math.atan(1 / Math.SQRT2), Math.PI / 4, 0, 'XYZ');
  const orbit = new THREE.Mesh(new THREE.TorusGeometry(0.74, 0.008, 6, 96), mat(p.acc, { rough: 0.3 })); orbit.position.set(0, Y(100), 0.1); orbit.rotation.x = Math.acos(0.27);
  const hot = new THREE.Mesh(new THREE.SphereGeometry(0.035, 16, 12), mat(p.sig, { rough: 0.2 })); hot.position.set(X(189), Y(79), 0.32);
  const arrow = new THREE.Shape(); [[0, 0], [0, -16], [4, -12], [7, -19], [10, -17.5], [7, -10.5], [13, -10.5]].forEach(([x, y], i) => (i ? arrow.lineTo(x / 100, y / 100) : arrow.moveTo(x / 100, y / 100)));
  const cursor = new THREE.Mesh(new THREE.ExtrudeGeometry(arrow, { depth: 0.02, bevelEnabled: false }), mat(p.ink, { rough: 0.5 })); cursor.position.set(X(212), Y(128), 0.4);
  root.add(frame, scr, cubeG, orbit, hot, cursor);
  return { root, tick: (t, lit) => { cube.rotation.y = Math.PI / 4 + t * 0.9 * lit; cubeG.position.y = Y(98) + Math.sin(t * 2.2) * 0.03; cursor.position.x = X(212) - Math.sin(t * 2.2) * 0.25; orbit.rotation.z = t * 0.6; hot.scale.setScalar(1 + 0.4 * Math.abs(Math.sin(t * 3))); } };
}
function figVideo(p: Pal): Fig {
  const root = new THREE.Group();
  const frame = new THREE.Mesh(new THREE.ExtrudeGeometry(rounded(2.4, 1.04, 0.04), { depth: 0.04, bevelEnabled: false }), mat(new THREE.Color('#141821'), { rough: 0.8 })); frame.position.set(0, Y(66), -0.25);
  const pts = [[70, 96], [120.5, 44.7], [184.2, 37.4], [250, 70]].map(([x, y]) => new THREE.Vector3(X(x), Y(y), 0));
  const curve = new THREE.CatmullRomCurve3(pts);
  const path = new THREE.Mesh(new THREE.TubeGeometry(curve, 80, 0.006, 6), mat(p.mute, { rough: 0.6 }));
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.11, 32, 24), mat(p.acc, { rough: 0.25, metal: 0.1 }));
  const ghosts = pts.slice(0, 3).map((v, i) => { const g = new THREE.Mesh(new THREE.SphereGeometry(0.09, 20, 14), mat(p.acc, { rough: 0.6, opacity: 0.25 + i * 0.12 })); g.position.copy(v); return g; });
  const bar = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.025, 0.05), mat(p.mute, { rough: 0.5 })); bar.position.set(0, Y(146), 0);
  const keys = [70, 120, 184, 250].map((x) => { const k = new THREE.Mesh(new THREE.OctahedronGeometry(0.06), mat(p.acc, { rough: 0.3 })); k.position.set(X(x), Y(146), 0.02); return k; });
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.34, 0.03), mat(p.sig, { rough: 0.3 })); head.position.set(X(70), Y(145), 0.05);
  root.add(frame, path, ball, bar, head, ...ghosts, ...keys);
  return { root, tick: (t) => { const u = (t * 0.38) % 1, e = ease(Math.min(1, u * 1.12)); ball.position.copy(curve.getPoint(e)); head.position.x = X(70) + e * (X(250) - X(70)); keys.forEach((k) => { k.rotation.y = t * 1.5; }); } };
}
function figProduct(p: Pal): Fig {
  const root = new THREE.Group();
  const prof = [[0, 152], [24, 152], [30, 146], [32, 140], [32, 84], [28, 74], [10, 70], [9, 60], [0, 60]].map(([r, y]) => new THREE.Vector2(r / 100, Y(y)));
  const glass = new THREE.Mesh(new THREE.LatheGeometry(prof, 48), mat(p.sig.clone().lerp(new THREE.Color('#ffffff'), 0.55), { rough: 0.08, metal: 0.0, opacity: 0.78 }));
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.15, 40), mat(new THREE.Color('#1c1f26'), { rough: 0.25, metal: 0.8 })); cap.position.set(0, Y(52), 0);
  const label = canvasTex(512, 160, (g) => { g.fillStyle = '#efe9df'; g.fillRect(0, 0, 512, 160); g.fillStyle = '#1b1d22'; g.font = '700 64px sans-serif'; g.fillText('AW', 210, 92); g.fillRect(200, 112, 112, 4); g.font = '500 20px monospace'; g.fillText('50 ML · N.º 01', 186, 140); });
  const lab = new THREE.Mesh(new THREE.CylinderGeometry(0.325, 0.325, 0.24, 48, 1, true), mat(new THREE.Color('#ffffff'), { map: label, rough: 0.7, flat: new THREE.Color('#efe9df') })); lab.position.set(0, Y(114), 0);
  const ground = new THREE.Mesh(new THREE.CircleGeometry(0.62, 48), mat(p.ink.clone().multiplyScalar(0.18), { rough: 0.9 })); ground.rotation.x = -Math.PI / 2 + 0.12; ground.position.set(0, Y(154), 0);
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.32, 0.05), mat(new THREE.Color('#ffffff'), { rough: 0.9 })); box.position.set(X(74), Y(41), 0.1); box.rotation.z = -0.24;
  (box.material as Mat).userData.glow = 1;   // la caja de luz siempre emite
  root.add(glass, cap, lab, ground, box);
  return { root, tick: (t, lit) => { glass.rotation.y = lab.rotation.y = t * 0.5 * lit; } };
}
function figIA(p: Pal): Fig {
  const root = new THREE.Group();
  const nodes = [[52, 50], [52, 90], [52, 130], [132, 36], [132, 72], [132, 108], [132, 144], [208, 70], [208, 110]].map(([x, y]) => new THREE.Vector3(X(x), Y(y), 0));
  const nodeM = nodes.map((v, i) => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.06, 20, 14), mat(i >= 7 ? p.acc : p.ink.clone().multiplyScalar(0.8), { rough: 0.3, metal: 0.2 })); m.position.copy(v); return m; });
  const links: [THREE.Vector3, THREE.Vector3][] = [];
  for (let a = 0; a < 3; a++) for (let b = 3; b < 7; b++) links.push([nodes[a], nodes[b]]);
  for (let a = 3; a < 7; a++) for (let b = 7; b < 9; b++) links.push([nodes[a], nodes[b]]);
  const linkM = mat(p.mute, { rough: 0.6 }); const rods = links.map(([a, b]) => rod(a, b, 0.006, linkM));
  const pulses = links.map(() => new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 8), mat(p.acc, { rough: 0.2 })));
  const bub = new THREE.Shape(); { const s = rounded(0.62, 0.34, 0.1, X(236), Y(66)); s.getPoints().forEach((q, i) => (i ? bub.lineTo(q.x, q.y) : bub.moveTo(q.x, q.y))); }
  const bubble = new THREE.Mesh(new THREE.ExtrudeGeometry(bub, { depth: 0.06, bevelEnabled: true, bevelSize: 0.01, bevelThickness: 0.01, bevelSegments: 2 }), mat(new THREE.Color('#202532'), { rough: 0.5 }));
  const dots = [250, 262, 274].map((x) => { const d = new THREE.Mesh(new THREE.SphereGeometry(0.026, 12, 10), mat(p.ink, { rough: 0.4 })); d.position.set(X(x), Y(49), 0.09); return d; });
  const reply = new THREE.Mesh(new THREE.ExtrudeGeometry(rounded(0.64, 0.28, 0.08, X(232), Y(128)), { depth: 0.05, bevelEnabled: false }), mat(p.sig.clone().multiplyScalar(0.55), { rough: 0.4 }));
  root.add(...nodeM, ...rods, ...pulses, bubble, reply, ...dots);
  return { root, tick: (t) => { pulses.forEach((m, i) => { const u = ((t * 0.9 + (i % 4) * 0.22) % 1); m.position.lerpVectors(links[i][0], links[i][1], u); }); dots.forEach((d, i) => { d.position.y = Y(49) + Math.max(0, Math.sin(t * 6 - i * 0.7)) * 0.03; }); } };
}
function gearShape(r: number, teeth: number, depth: number) {
  const s = new THREE.Shape();
  for (let i = 0; i < teeth; i++) {
    const a0 = (i / teeth) * Math.PI * 2, st = (Math.PI * 2) / teeth;
    ([[a0, r - depth], [a0 + st * 0.18, r], [a0 + st * 0.5, r], [a0 + st * 0.68, r - depth]] as [number, number][]).forEach(([a, rr], k) => { const x = Math.cos(a) * rr, y = Math.sin(a) * rr; if (i === 0 && k === 0) s.moveTo(x, y); else s.lineTo(x, y); });
  }
  const hole = new THREE.Path(); hole.absarc(0, 0, 0.12, 0, Math.PI * 2, true); s.holes.push(hole); return s;
}
function figTech(p: Pal): Fig {
  const root = new THREE.Group();
  const metal = canvasTex(256, 256, (g) => { g.fillStyle = '#8b9099'; g.fillRect(0, 0, 256, 256); for (let i = 0; i < 900; i++) { g.strokeStyle = `rgba(255,255,255,${Math.random() * 0.08})`; const y = Math.random() * 256; g.beginPath(); g.moveTo(0, y); g.lineTo(256, y + Math.random() * 2); g.stroke(); } });
  metal.wrapS = metal.wrapT = THREE.RepeatWrapping;
  const gear = new THREE.Mesh(new THREE.ExtrudeGeometry(gearShape(0.42, 12, 0.07), { depth: 0.14, bevelEnabled: true, bevelSize: 0.008, bevelThickness: 0.008, bevelSegments: 1, curveSegments: 24 }), mat(new THREE.Color('#c9ccd2'), { map: metal, rough: 0.35, metal: 0.85, flat: new THREE.Color('#8b9099') }));
  gear.position.set(X(110), Y(100), -0.07);
  const ps = rounded(0.96, 0.34, 0.02, 0, 0); [0.21, 0.75].forEach((x) => { const h = new THREE.Path(); h.absarc(x, 0.17, 0.05, 0, Math.PI * 2, true); ps.holes.push(h); });
  const plate = new THREE.Mesh(new THREE.ExtrudeGeometry(ps, { depth: 0.16, bevelEnabled: false }), mat(new THREE.Color('#9aa0a8'), { map: metal, rough: 0.45, metal: 0.7, flat: new THREE.Color('#7d838c') }));
  plate.position.set(X(190), Y(130), -0.08);
  const screwM = mat(p.acc, { rough: 0.3, metal: 0.6 });
  const screws = [211, 265].map((x) => { const g = new THREE.Group(); const head = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.06, 6), screwM); const sh = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.26, 12), screwM); sh.position.y = -0.16; g.add(head, sh); g.position.set(X(x), Y(37), 0); return g; });
  root.add(gear, plate, ...screws);
  return { root, tick: (t) => { gear.rotation.z = -t * 0.7; const u = (t * 0.35) % 1, e = ease(clamp01(u * 1.6)); screws.forEach((s) => { s.position.y = Y(37) - e * 0.6; s.rotation.y = e * Math.PI * 4; }); } };
}
const BUILD: Record<string, (p: Pal) => Fig> = { 'web-3d': figWeb, 'video-anim': figVideo, imagenes: figProduct, ia: figIA, otros: figTech };

export function createPlate3D() {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.NoToneMapping; renderer.setClearColor(0, 0);
  const canvas = renderer.domElement; canvas.className = 'cx-plate-3d'; canvas.setAttribute('aria-hidden', 'true');
  const scene = new THREE.Scene();
  const pm = new THREE.PMREMGenerator(renderer); const env = pm.fromScene(new RoomEnvironment(), 0.04).texture; scene.environment = env;
  const hemi = new THREE.HemisphereLight(0xffffff, 0x1a1d24, 0); const key = new THREE.DirectionalLight(0xffffff, 0); key.position.set(-2, 3, 4); const rim = new THREE.DirectionalLight(0xffc7a8, 0); rim.position.set(3, 1, -3);
  scene.add(hemi, key, rim);
  const camera = new THREE.PerspectiveCamera(4, 16 / 9, 0.05, 400);
  const lineMat = new THREE.LineBasicMaterial({ transparent: true, depthWrite: false });
  const cache = new Map<string, { fig: Fig; mats: Mat[]; lines: THREE.LineSegments[] }>();
  let active: { id: string; plate: HTMLElement; svg: SVGSVGElement; P: number; dir: 1 | -1; t0: number } | null = null;
  let raf = 0, last = 0;

  const prep = (id: string, pal: Pal) => {
    let c = cache.get(id); if (c) return c;
    const fig = (BUILD[id] ?? figWeb)(pal); const mats: Mat[] = []; const lines: THREE.LineSegments[] = [];
    fig.root.traverse((o) => { const m = o as THREE.Mesh; if (!m.isMesh) return; (Array.isArray(m.material) ? m.material : [m.material]).forEach((x) => mats.push(x as Mat)); const l = new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry, 25), lineMat); m.add(l); lines.push(l); });
    c = { fig, mats: [...new Set(mats)], lines }; cache.set(id, c); return c;
  };
  const place = () => {
    if (!active) return;
    const fig = active.svg.parentElement as HTMLElement, r = active.svg.getBoundingClientRect(), f = fig.getBoundingClientRect();
    if (canvas.parentElement !== fig) fig.appendChild(canvas);
    canvas.style.left = `${r.left - f.left}px`; canvas.style.top = `${r.top - f.top}px`; canvas.style.width = `${r.width}px`; canvas.style.height = `${r.height}px`;
    renderer.setSize(Math.max(1, r.width), Math.max(1, r.height), false); camera.aspect = r.width / Math.max(1, r.height);
  };
  const frame = (now: number) => {
    raf = 0; if (!active) return;
    const dt = Math.min(0.05, (now - last) / 1000 || 0); last = now;
    active.P = Math.max(0, Math.min(END, active.P + dt * (active.dir > 0 ? 1 : -3)));
    const P = active.P, time = (now - active.t0) / 1000;
    const pal = palette(active.plate); const c = prep(active.id, pal);
    scene.children.filter((o) => o.userData.fig).forEach((o) => scene.remove(o)); c.fig.root.userData.fig = true; scene.add(c.fig.root);
    // fases: lineart (0,35–0,75) → sólido (0,8–1,25) → luz y texturas (1,25–1,9); cámara 1,2–2,3
    const line = smooth(0.35, 0.75, P), solid = smooth(0.8, 1.25, P), lit = smooth(1.25, 1.9, P), cam = ease(smooth(1.2, END, P));
    canvas.style.opacity = String(line); active.svg.style.opacity = String(1 - line);
    lineMat.color.copy(pal.ink); lineMat.opacity = 0.85 * (1 - 0.8 * lit);
    for (const m of c.mats) {
      const base = m.userData.base, maxOp = m.userData.maxOp ?? 1;
      m.opacity = solid * maxOp; m.visible = solid > 0.001; m.depthWrite = solid > 0.5;
      m.emissive.copy(m.userData.glow ? base : m.userData.flat).multiplyScalar((m.userData.glow ? 1 : 1 - lit) * 0.92); m.color.copy(base);
      m.envMapIntensity = lit;
    }
    hemi.intensity = 0.9 * lit; key.intensity = 2.2 * lit; rim.intensity = 1.1 * lit;
    c.fig.tick(time, lit);
    const fov = 4 + 26 * cam, half = Math.tan(THREE.MathUtils.degToRad(fov) / 2);
    const d = (1.6 / (half * camera.aspect)) * (1 + 0.38 * cam);   // 3,2 de ancho exactos en z = 0 (calca el SVG); en 3D se abre el encuadre
    const th = 0.62 * cam, ph = 0.3 * cam;
    camera.fov = fov; camera.position.set(d * Math.sin(th) * Math.cos(ph), d * Math.sin(ph), d * Math.cos(th) * Math.cos(ph)); camera.lookAt(0, 0, 0);
    camera.near = d / 50; camera.far = d * 4; camera.updateProjectionMatrix();
    renderer.render(scene, camera);
    if (active.dir < 0 && P <= 0) { active.svg.style.opacity = ''; canvas.remove(); active = null; return; }
    raf = requestAnimationFrame(frame);
  };
  const kick = () => { if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); } };
  const onResize = () => place();
  window.addEventListener('resize', onResize);

  return {
    enter(plate: HTMLElement, id: string) {
      const svg = plate.querySelector('.cx-plate-fig svg') as SVGSVGElement | null; if (!svg) return;
      if (active && active.plate !== plate) { active.svg.style.opacity = ''; active = null; }
      if (!active) active = { id, plate, svg, P: 0, dir: 1, t0: performance.now() };
      active.dir = 1; place(); kick();
    },
    leave(plate: HTMLElement) { if (active && active.plate === plate) { active.dir = -1; kick(); } },
    dispose() { cancelAnimationFrame(raf); window.removeEventListener('resize', onResize); canvas.remove(); env.dispose(); pm.dispose(); renderer.dispose(); },
  };
}
