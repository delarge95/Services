/**
 * turbineMorph.ts — Turbina procedural con morph continuo low-poly → detalle
 * (ciclo 20). Port del HTML de referencia "Morph Continuo v8": geometrías
 * registradas con dos posiciones de vértice (A = facetada low-poly, B =
 * detallada), anillos de álabes que CRECEN en cantidad con el slider,
 * micro-piezas que aparecen por umbral (grow), despiece axial por estación
 * y rotor que frena al explosionar.
 *
 * Todo procedural (0 bytes de red, carga instantánea) — reemplaza el GLB
 * en el slider de nivel de detalle.
 */

import * as THREE from 'three';

/* ---------- materiales (paleta ajustada al canvas claro del widget:
   metales medios/oscuros para contraste sobre blanco) ---------- */
const matTitan = new THREE.MeshStandardMaterial({ color: 0x6d737a, metalness: 0.85, roughness: 0.38 });
const matAlu = new THREE.MeshStandardMaterial({ color: 0x8a9096, metalness: 0.8, roughness: 0.45 });
const matSteel = new THREE.MeshStandardMaterial({ color: 0x54595f, metalness: 0.9, roughness: 0.5 });
const matDark = new THREE.MeshStandardMaterial({ color: 0x2b2e33, metalness: 0.85, roughness: 0.55 });
const matBlue = new THREE.MeshStandardMaterial({ color: 0x2f6fd0, metalness: 0.7, roughness: 0.35, emissive: 0x0a2a66, emissiveIntensity: 0.4 });
const matBurn = new THREE.MeshStandardMaterial({ color: 0x4c4750, metalness: 0.9, roughness: 0.5, side: THREE.DoubleSide });
const matRubber = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, metalness: 0, roughness: 0.85 });
const matCopper = new THREE.MeshStandardMaterial({ color: 0x9a5c26, metalness: 0.9, roughness: 0.4 });
const matCase = matAlu.clone(); matCase.side = THREE.DoubleSide;
const matNose = new THREE.MeshStandardMaterial({ color: 0x15181c, metalness: 0.6, roughness: 0.35 });

/* ---------- estado del morph ----------
 * Registro POR INSTANCIA: cada createMorphTurbine() construye con su propio
 * registro (los builders empujan al REGISTRO ACTIVO durante el build). Un
 * registro global compartido rompía el morph cuando otro preview montaba y
 * lo vaciaba — la turbina de detalle quedaba clavada en low-poly. */
interface TurbReg {
  morphGeos: THREE.BufferGeometry[];
  growMeshes: THREE.Object3D[];
  bladeRings: { blades: THREE.Mesh[]; holders: THREE.Object3D[]; min: number; max: number; appear: number }[];
  gearSpin: { o: THREE.Object3D; s: number }[];
}
let REG: TurbReg | null = null;

const SIDES = 12;
const RA = 0.62, RB = 0.60;
const T1 = 0.30, T2 = 0.45, T3 = 0.60, T4 = 0.75, T5 = 0.90, GW = 0.12;
const smooth01 = (x: number) => { x = x < 0 ? 0 : x > 1 ? 1 : x; return x * x * (3 - 2 * x); };

/* ---------- morfado de geometrías ---------- */
function facetArray(src: Float32Array, sides: number, axis: 'y' | 'z'): Float32Array {
  const out = new Float32Array(src.length);
  const seg = (Math.PI * 2) / sides, half = seg / 2, c = Math.cos(half);
  for (let i = 0; i < src.length; i += 3) {
    const x = src[i], y = src[i + 1], z = src[i + 2];
    if (axis === 'y') {
      const r = Math.hypot(x, z);
      if (r > 1e-6) {
        const th = Math.atan2(z, x);
        const local = ((th % seg) + seg) % seg;
        const f = c / Math.cos(local - half);
        out[i] = x * f; out[i + 1] = y; out[i + 2] = z * f;
      } else { out[i] = x; out[i + 1] = y; out[i + 2] = z; }
    } else {
      const r = Math.hypot(x, y);
      if (r > 1e-6) {
        const th = Math.atan2(y, x);
        const local = ((th % seg) + seg) % seg;
        const f = c / Math.cos(local - half);
        out[i] = x * f; out[i + 1] = y * f; out[i + 2] = z;
      } else { out[i] = x; out[i + 1] = y; out[i + 2] = z; }
    }
  }
  return out;
}
function registerFaceted(g: THREE.BufferGeometry, axis: 'y' | 'z'): THREE.BufferGeometry {
  const gn = g.index ? g.toNonIndexed() : g;
  const base = (gn.attributes.position.array as Float32Array).slice();
  gn.userData.morph = { a: facetArray(base, SIDES, axis), b: base };
  REG!.morphGeos.push(gn);
  return gn;
}
function registerAB(g: THREE.BufferGeometry, a: Float32Array, b: Float32Array): THREE.BufferGeometry {
  g.userData.morph = { a, b };
  REG!.morphGeos.push(g);
  return g;
}
function tubeify(g: THREE.BufferGeometry, R: number, zc: number, L: number, axis: 'y' | 'z'): THREE.BufferGeometry {
  const gn = g.index ? g.toNonIndexed() : g;
  const base = (gn.attributes.position.array as Float32Array).slice();
  let hmin = 1e9, hmax = -1e9;
  for (let i = 0; i < base.length; i += 3) {
    const h = axis === 'y' ? base[i + 1] : base[i + 2];
    if (h < hmin) hmin = h;
    if (h > hmax) hmax = h;
  }
  const hs = (hmax - hmin) || 1;
  const T = new Float32Array(base.length);
  for (let i = 0; i < base.length; i += 3) {
    const x = base[i], y = base[i + 1], z = base[i + 2];
    if (axis === 'y') {
      const rho = Math.hypot(x, z);
      if (rho > 1e-6) { T[i] = (x / rho) * R; T[i + 2] = (z / rho) * R; } else { T[i] = 0; T[i + 2] = 0; }
      T[i + 1] = zc + ((y - hmin) / hs - 0.5) * L;
    } else {
      const rho = Math.hypot(x, y);
      if (rho > 1e-6) { T[i] = (x / rho) * R; T[i + 1] = (y / rho) * R; } else { T[i] = 0; T[i + 1] = 0; }
      T[i + 2] = zc + ((z - hmin) / hs - 0.5) * L;
    }
  }
  gn.userData.morph = { a: facetArray(T, SIDES, axis), b: base };
  REG!.morphGeos.push(gn);
  return gn;
}

const cylG = (rt: number, rb: number, h: number, s: number, open = false) => registerFaceted(new THREE.CylinderGeometry(rt, rb, h, s, 1, open), 'y');
const coneG = (r: number, h: number, s: number) => registerFaceted(new THREE.ConeGeometry(r, h, s), 'y');
const torG = (r: number, t: number, rs: number, ts: number) => registerFaceted(new THREE.TorusGeometry(r, t, rs, ts), 'z');

function bladeGeoAB(len: number, thick: number, chord: number, pitch: number, curve: number, root: number): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(len, thick, chord, 12, 1, 6);
  const base = (g.attributes.position.array as Float32Array).slice();
  const A = new Float32Array(base.length), B = new Float32Array(base.length);
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  for (let i = 0; i < base.length; i += 3) {
    const x = base[i], y = base[i + 1], z = base[i + 2];
    A[i] = x + root + len / 2; A[i + 1] = y * cp - z * sp; A[i + 2] = y * sp + z * cp;
    const t = (x + len / 2) / len, u = z / chord;
    const th = pitch * (1.25 - 0.85 * t);
    const ct = Math.cos(th), st = Math.sin(th);
    const camber = curve * chord * 0.6 * (0.25 - u * u);
    const yT = y * (1 - 0.5 * t) + camber;
    B[i] = x + root + len / 2;
    B[i + 1] = yT * ct - z * st;
    B[i + 2] = yT * st + z * ct + curve * len * 0.22 * t * t;
  }
  return registerAB(g, A, B);
}
function housingGeoAB(): THREE.BufferGeometry {
  const w = 1.5, h = 0.55, dp = 1.9;
  const g = new THREE.BoxGeometry(w, h, dp, 6, 3, 6);
  const base = (g.attributes.position.array as Float32Array).slice();
  const B = new Float32Array(base.length);
  const hx = w / 2, hy = h / 2, hz = dp / 2;
  for (let i = 0; i < base.length; i += 3) {
    const x = base[i], y = base[i + 1], z = base[i + 2];
    const ax = Math.abs(x) / hx, ay = Math.abs(y) / hy, az = Math.abs(z) / hz;
    const corner = Math.max(0, ax + ay + az - 2);
    const f = 1 - 0.3 * corner;
    const bulge = 1 + 0.10 * (1 - ax) * (1 - az) * Math.max(0, y / hy);
    B[i] = x * f; B[i + 1] = y * f * bulge; B[i + 2] = z * f;
  }
  return registerAB(g, base, B);
}
function chamferedBox(w: number, h: number, d: number, f = 0.86): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, h, d, 2, 2, 2);
  const p = g.attributes.position;
  const hx = w / 2, hy = h / 2, hz = d / 2;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const cx = Math.abs(x) > hx - 0.001, cy = Math.abs(y) > hy - 0.001, cz = Math.abs(z) > hz - 0.001;
    p.setXYZ(i, x * (cx ? f : 1), y * (cy ? f : 1), z * (cz ? f : 1));
  }
  g.computeVertexNormals();
  return g;
}

function grow<T extends THREE.Object3D>(mesh: T, t0: number, w = GW): T {
  mesh.userData.grow = { t0, w };
  mesh.visible = false;
  REG!.growMeshes.push(mesh);
  return mesh;
}
const Z = <T extends THREE.Object3D>(g: T): T => { g.rotation.x = Math.PI / 2; return g; };
const noShadow = <T extends THREE.Object3D>(o: T): T => { o.traverse(m => { m.userData.noShadow = true; }); return o; };
function radial(obj: THREE.Object3D, a: number, radius: number, z: number): THREE.Object3D {
  const h = new THREE.Object3D(); h.rotation.z = a;
  obj.rotation.y = Math.PI / 2;
  obj.position.set(radius, 0, z);
  h.add(obj);
  return h;
}

/* ---------- micro-piezas ---------- */
function makeBolt(mat: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  const head = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.05, 6), mat);
  head.rotation.x = Math.PI / 2; head.position.z = 0.06; g.add(head);
  const wash = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.012, 6, 12), mat); wash.position.z = 0.03; g.add(wash);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.12, 8), mat);
  shaft.rotation.x = Math.PI / 2; g.add(shaft);
  return noShadow(g);
}
function makePlug(mat: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  const hex = Z(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.08, 6), mat)); g.add(hex);
  const col = Z(new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.03, 12), mat)); col.position.z = -0.05; g.add(col);
  return noShadow(g);
}
function makePipe(mat: THREE.Material, len = 1.6): THREE.Group {
  const g = new THREE.Group();
  const a = Z(new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, len * 0.5, 12), mat)); a.position.z = -len * 0.2; g.add(a);
  const col = Z(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.14, 12), mat)); g.add(col);
  const b = Z(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, len * 0.45, 12), mat)); b.position.z = len * 0.28; g.add(b);
  const nut = Z(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.08, 6), mat)); nut.position.z = len * 0.5; g.add(nut);
  return g;
}
function makeActuator(matB: THREE.Material, matR: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  const body = Z(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.45, 16), matB)); g.add(body);
  const cF = Z(new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.06, 16), matB)); cF.position.z = 0.25; g.add(cF);
  const cR = Z(new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.06, 16), matB)); cR.position.z = -0.25; g.add(cR);
  const rod = Z(new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.35, 10), matR)); rod.position.z = 0.42; g.add(rod);
  const clevis = new THREE.Mesh(chamferedBox(0.1, 0.1, 0.08), matR); clevis.position.z = 0.6; g.add(clevis);
  return g;
}
function makeProbe(mat: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  const hex = Z(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.06, 6), mat)); g.add(hex);
  const sh = Z(new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.22, 8), mat)); sh.position.z = 0.13; g.add(sh);
  const tip = Z(new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.06, 8), mat)); tip.position.z = 0.26; g.add(tip);
  return noShadow(g);
}
function makeInjector(mat: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  const col = Z(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.06, 12), mat)); g.add(col);
  const noz = Z(new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.14, 10), mat)); noz.position.z = 0.1; g.add(noz);
  return noShadow(g);
}
function makeCap(mat: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.07, 12), mat); g.add(body);
  const ridge = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.015, 6, 12), mat);
  ridge.rotation.x = Math.PI / 2; ridge.position.y = 0.02; g.add(ridge);
  const tab = new THREE.Mesh(chamferedBox(0.12, 0.03, 0.04), mat); tab.position.y = 0.05; g.add(tab);
  return noShadow(g);
}
function makeAccessory(mat: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  const m1 = Z(new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.4, 24), mat)); g.add(m1);
  const fl = Z(new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.06, 24), mat)); fl.position.z = 0.2; g.add(fl);
  const m2 = Z(new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.25, 20), mat)); m2.position.z = -0.3; g.add(m2);
  const pad = new THREE.Mesh(chamferedBox(0.3, 0.12, 0.3), mat); pad.position.set(0, -0.38, -0.05); g.add(pad);
  return g;
}
function gear(r: number, teeth: number, th: number, mat: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(r, r, th, 20), mat);
  body.rotation.x = Math.PI / 2; g.add(body);
  for (let i = 0; i < teeth; i++) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(r * 0.3, th, r * 0.24), mat);
    const a = (i / teeth) * Math.PI * 2;
    t.position.set(Math.cos(a) * r * 1.06, Math.sin(a) * r * 1.06, 0);
    t.rotation.z = a; g.add(t);
  }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.3, r * 0.3, th * 1.7, 12), mat);
  hub.rotation.x = Math.PI / 2; g.add(hub);
  return g;
}
function placeGear(parent: THREE.Group, r: number, teeth: number, th: number, mat: THREE.Material, pos: [number, number, number], t0: number, speed: number): void {
  const outer = new THREE.Object3D();
  outer.position.set(pos[0], pos[1], pos[2]);
  outer.rotation.y = Math.PI / 2;
  const inner = gear(r, teeth, th, mat);
  outer.add(inner);
  parent.add(grow(outer, t0));
  REG!.gearSpin.push({ o: inner, s: speed });
}

let spiralTex: THREE.CanvasTexture | null = null;
function spiralTexture(): THREE.CanvasTexture {
  if (spiralTex) return spiralTex;
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const x = c.getContext('2d')!;
  x.fillStyle = '#15181c'; x.fillRect(0, 0, 256, 256);
  x.strokeStyle = '#f5f5f5'; x.lineWidth = 26;
  for (const o of [-256, 0, 256]) { x.beginPath(); x.moveTo(o - 40, 296); x.lineTo(o + 296, -40); x.stroke(); }
  spiralTex = new THREE.CanvasTexture(c); spiralTex.colorSpace = THREE.SRGBColorSpace;
  return spiralTex;
}

function bladeRing(minC: number, maxC: number, root: number, len: number, chord: number, thick: number, pitch: number, mat: THREE.Material, curve: number, appear = 0): THREE.Group {
  const g = new THREE.Group();
  const geo = bladeGeoAB(len, thick, chord, pitch, curve, root);
  const blades: THREE.Mesh[] = [], holders: THREE.Object3D[] = [];
  for (let i = 0; i < maxC; i++) {
    const b = new THREE.Mesh(geo, mat);
    const h = new THREE.Object3D();
    h.userData.aLow = (minC > 0 && i < minC) ? (i / minC) * Math.PI * 2 : (i / maxC) * Math.PI * 2;
    h.userData.aHigh = (i / maxC) * Math.PI * 2;
    h.add(b); g.add(h); blades.push(b); holders.push(h);
  }
  REG!.bladeRings.push({ blades, holders, min: minC, max: maxC, appear });
  return g;
}
function bolts(group: THREE.Group, radius: number, count: number, z: number, mat: THREE.Material, t0: number): void {
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    const b = makeBolt(mat);
    b.position.set(Math.cos(a) * radius, Math.sin(a) * radius, z);
    group.add(grow(b, t0));
  }
}

/* ---------- piezas ---------- */
function buildNose(): THREE.Group {
  const g = new THREE.Group();
  const m = new THREE.Mesh(coneG(0.5, 1.3, 48), matNose);
  m.rotation.x = Math.PI / 2; g.add(m);
  const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.06, 10), matSteel);
  tip.rotation.x = Math.PI / 2; tip.position.z = 0.68; g.add(grow(tip, T4));
  const ring = new THREE.Mesh(torG(0.5, 0.04, 8, 48), matSteel); ring.position.z = -0.6; g.add(grow(ring, T1));
  const ice = new THREE.Mesh(torG(0.32, 0.03, 8, 40), matCopper); ice.position.z = -0.05; g.add(grow(ice, T4));
  bolts(g, 0.5, 8, -0.6, matSteel, T4);
  return g;
}
function buildFan(): THREE.Group {
  const g = new THREE.Group();
  const disk = Z(new THREE.Mesh(cylG(0.5, 0.5, 0.25, 24), matSteel)); g.add(disk);
  const hub = new THREE.Mesh(coneG(0.55, 0.7, 32), matTitan); hub.rotation.x = Math.PI / 2; hub.position.z = 0.15; g.add(grow(hub, T1));
  const hubRing = new THREE.Mesh(torG(0.5, 0.03, 8, 40), matSteel); hubRing.position.z = -0.15; g.add(grow(hubRing, T4));
  g.add(bladeRing(6, 22, 0.45, 1.65, 0.6, 0.05, 1.05, matTitan, 1.0, 0));
  const d = Z(new THREE.Mesh(cylG(0.55, 0.55, 0.18, 48), matSteel)); d.position.z = -0.5; g.add(d);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const tab = new THREE.Mesh(chamferedBox(0.06, 0.04, 0.08), matSteel);
    tab.position.set(Math.cos(a) * 0.56, Math.sin(a) * 0.56, -0.5); tab.rotation.z = a;
    g.add(grow(tab, T4));
  }
  bolts(g, 0.55, 12, -0.5, matSteel, T3);
  return g;
}
function buildCase(): THREE.Group {
  const g = new THREE.Group();
  g.add(Z(new THREE.Mesh(cylG(2.25, 2.25, 1.5, 72, true), matCase)));
  const l1 = new THREE.Mesh(torG(2.25, 0.07, 8, 72), matAlu); l1.position.z = 0.75; g.add(grow(l1, T1));
  const l2 = new THREE.Mesh(torG(2.25, 0.07, 8, 72), matAlu); l2.position.z = -0.75; g.add(grow(l2, T1));
  const liner = Z(new THREE.Mesh(cylG(2.16, 2.16, 1.3, 60, true), matDark.clone())); g.add(grow(liner, T2));
  const ogv = bladeRing(0, 10, 1.2, 0.94, 0.5, 0.06, 0.5, matAlu, 0.2, 0.65); ogv.position.z = -0.6; g.add(ogv);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const rib = new THREE.Mesh(chamferedBox(0.07, 0.07, 1.4), matAlu);
    rib.position.set(Math.cos(a) * 2.26, Math.sin(a) * 2.26, 0);
    g.add(grow(rib, T2));
  }
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const lug = new THREE.Mesh(chamferedBox(0.3, 0.25, 0.4), matSteel);
    lug.position.set(Math.cos(a) * 2.3, Math.sin(a) * 2.3, -0.5);
    lug.rotation.z = a; g.add(grow(lug, T3));
    const boss = Z(new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.14, 12), matSteel));
    boss.position.set(Math.cos(a) * 2.36, Math.sin(a) * 2.36, -0.5); g.add(grow(boss, T3));
  }
  const lift = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.05, 8, 20), matSteel); lift.position.set(0, 2.3, -0.6); g.add(grow(lift, T3));
  const drain = makePlug(matSteel); drain.rotation.x = Math.PI / 2; drain.position.set(0, -2.28, 0.4); g.add(grow(drain, T4));
  const acc = makeAccessory(matSteel); acc.position.set(0, -2.32, -0.2); g.add(acc);
  const acc2 = new THREE.Mesh(chamferedBox(0.5, 0.4, 0.7), matSteel); acc2.position.set(0.55, -2.35, 0.15); g.add(grow(acc2, T2));
  bolts(g, 2.25, 24, 0.75, matSteel, T4);
  bolts(g, 2.25, 24, -0.75, matSteel, T4);

  const housing = new THREE.Mesh(housingGeoAB(), matAlu);
  housing.position.set(0, 2.42, 0); g.add(housing);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const gu = new THREE.Mesh(chamferedBox(0.06, 0.35, 0.5), matAlu);
    gu.position.set(sx * 0.7, 2.2, sz * 0.6); g.add(grow(gu, T2));
  }
  const cover = new THREE.Mesh(chamferedBox(1.3, 0.07, 1.7), matAlu);
  cover.position.set(0, 2.72, 0); g.add(grow(cover, T2));
  const rib1 = new THREE.Mesh(chamferedBox(1.1, 0.05, 0.12), matAlu); rib1.position.set(0, 2.77, 0.4); g.add(grow(rib1, T3));
  const rib2 = new THREE.Mesh(chamferedBox(1.1, 0.05, 0.12), matAlu); rib2.position.set(0, 2.77, -0.4); g.add(grow(rib2, T3));
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const b = makeBolt(matSteel);
    b.rotation.x = -Math.PI / 2;
    b.position.set(Math.cos(a) * 0.55, 2.76, Math.sin(a) * 0.72);
    g.add(grow(b, T3));
  }
  for (let i = 0; i < 5; i++) {
    const f = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.02, 0.06), matAlu);
    f.position.set(0, 2.3 + i * 0.09, 0.98); g.add(grow(f, T3));
    const f2 = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.02, 0.06), matAlu);
    f2.position.set(0, 2.3 + i * 0.09, -0.98); g.add(grow(f2, T3));
  }
  const p1 = makePipe(matSteel); p1.position.set(0.78, 2.45, -0.4); g.add(grow(p1, T3));
  const p2 = makePipe(matSteel); p2.position.set(-0.78, 2.45, -0.4); g.add(grow(p2, T3));
  const act = makeActuator(matDark, matSteel); act.position.set(0, 2.45, 1.15); g.add(grow(act, T3));
  placeGear(g, 0.22, 10, 0.12, matSteel, [0.78, 2.45, 0.35], T4, 1.4);
  placeGear(g, 0.14, 8, 0.10, matDark, [0.78, 2.45, -0.02], T4, -2.2);
  placeGear(g, 0.09, 7, 0.08, matCopper, [0.78, 2.45, -0.28], T5, 3.4);
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.03, 12), matCopper);
  glass.rotation.z = Math.PI / 2; glass.position.set(0.76, 2.35, 0.6); g.add(grow(glass, T4));
  const conduit = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.5, 2.6, -0.75), new THREE.Vector3(-0.95, 2.3, -0.95),
    new THREE.Vector3(-1.5, 1.6, -0.95), new THREE.Vector3(-2.1, 0.75, -0.7),
  ]), 20, 0.035, 8, false), matRubber);
  g.add(grow(conduit, T4));
  const conn = new THREE.Mesh(chamferedBox(0.25, 0.18, 0.3), matDark); conn.position.set(-0.78, 2.5, -0.75); g.add(grow(conn, T5));
  for (let i = 0; i < 3; i++) {
    const pl = makePlug(matSteel);
    pl.rotation.x = -Math.PI / 2;
    pl.position.set(-0.86 + i * 0.08, 2.62, -0.75); g.add(grow(pl, T5));
  }
  const cap = makeCap(matDark); cap.position.set(0.4, 2.79, 0.5); g.add(grow(cap, T5));
  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.02, 0.25), matSteel); plate.position.set(-0.3, 2.76, 0.6); g.add(grow(plate, T5));
  const brk = new THREE.Mesh(chamferedBox(0.12, 0.5, 0.12), matSteel); brk.position.set(0.6, 2.5, 0.98); g.add(grow(brk, T4));
  return g;
}
function buildShaftLP(): THREE.Group {
  const g = new THREE.Group();
  g.add(Z(new THREE.Mesh(cylG(0.09, 0.09, 2.6, 32), matSteel)));
  const g1 = Z(new THREE.Mesh(cylG(0.28, 0.28, 0.14, 32), matSteel)); g1.position.z = 0.9; g.add(grow(g1, T2));
  const g2 = Z(new THREE.Mesh(cylG(0.22, 0.22, 0.12, 32), matSteel)); g2.position.z = -0.9; g.add(grow(g2, T2));
  bolts(g, 0.26, 8, 0.9, matSteel, T4);
  bolts(g, 0.2, 8, -0.9, matSteel, T4);
  return g;
}
function buildStageA(): THREE.Group {
  const g = new THREE.Group();
  g.add(Z(new THREE.Mesh(cylG(0.48, 0.48, 0.14, 48), matAlu)));
  const cap = new THREE.Mesh(coneG(0.3, 0.5, 32), matTitan); cap.rotation.x = Math.PI / 2; cap.position.z = 0.3; g.add(grow(cap, T1));
  g.add(bladeRing(0, 36, 0.44, 0.32, 0.2, 0.03, 0.9, matSteel, 0.5, 0.6));
  bolts(g, 0.48, 12, 0, matSteel, T3);
  return g;
}
function buildStageB(): THREE.Group {
  const g = new THREE.Group();
  g.add(Z(new THREE.Mesh(cylG(0.44, 0.44, 0.12, 48), matBlue)));
  g.add(bladeRing(0, 30, 0.40, 0.28, 0.18, 0.03, 0.9, matDark, 0.5, 0.6));
  g.add(new THREE.Mesh(torG(0.52, 0.05, 8, 48), matDark));
  bolts(g, 0.52, 16, 0, matDark, T3);
  return g;
}
function buildCore(): THREE.Group {
  const g = new THREE.Group();
  const c1 = Z(new THREE.Mesh(tubeify(new THREE.CylinderGeometry(0.8, 0.8, 0.5, 48, 1, true), RA, 0.74, 0.857, 'y'), matCase)); c1.position.z = 0.6; g.add(c1);
  const c2 = Z(new THREE.Mesh(tubeify(new THREE.CylinderGeometry(0.7, 0.7, 0.6, 48, 1, true), RB, 0.525, 0.857, 'y'), matCase)); g.add(c2);
  const c3 = Z(new THREE.Mesh(tubeify(new THREE.CylinderGeometry(0.6, 0.6, 0.5, 48, 1, true), RA, 0.31, 0.857, 'y'), matCase)); c3.position.z = -0.6; g.add(c3);
  g.add(grow(Z(new THREE.Mesh(cylG(0.12, 0.12, 2.4, 32), matSteel)), T1));
  const r1 = new THREE.Mesh(torG(0.8, 0.04, 8, 48), matSteel); r1.position.z = 0.35; g.add(grow(r1, T2));
  const r2 = new THREE.Mesh(torG(0.62, 0.04, 8, 48), matSteel); r2.position.z = -0.4; g.add(grow(r2, T2));
  const flange = new THREE.Mesh(torG(0.72, 0.05, 8, 48), matSteel); flange.position.z = 0.3; g.add(grow(flange, T2));
  const oil = makePipe(matCopper, 0.9); oil.position.set(0, 0.74, 0.2); g.add(grow(oil, T3));
  g.add(radial(grow(makeProbe(matSteel), T4), 0.5, 0.7, 0));
  g.add(radial(grow(makeProbe(matSteel), T4), 2.6, 0.7, 0));
  bolts(g, 0.8, 16, 0.35, matSteel, T4);
  bolts(g, 0.7, 14, 0, matSteel, T4);
  bolts(g, 0.6, 12, -0.6, matSteel, T4);
  return g;
}
function buildHPC(): THREE.Group {
  const g = new THREE.Group();
  const d0 = Z(new THREE.Mesh(tubeify(new THREE.CylinderGeometry(0.62, 0.62, 0.1, 40), RB, -0.55, 0.74, 'y'), matSteel)); d0.position.z = 0.5; g.add(d0);
  const igv = bladeRing(0, 20, 0.5, 0.12, 0.1, 0.02, 0.8, matTitan, 0.3, 0.65); igv.position.z = 0.78; g.add(igv);
  for (let i = 1; i < 5; i++) {
    const r = 0.62 - 0.07 * i, z = 0.5 - i * 0.28;
    const d = Z(new THREE.Mesh(cylG(r, r, 0.1, 40), matSteel)); d.position.z = z; g.add(grow(d, T1));
    const bl = bladeRing(0, 30, r - 0.04, 0.16, 0.12, 0.02, 0.9, matTitan, 0.4, 0.6); bl.position.z = z; g.add(bl);
    if (i < 4) {
      const stator = new THREE.Mesh(torG(r - 0.03, 0.025, 6, 40), matDark); stator.position.z = z - 0.14; g.add(grow(stator, T3));
    }
  }
  const bleedDuct = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.04, 8, 32, Math.PI), matSteel);
  bleedDuct.position.z = -0.1; g.add(grow(bleedDuct, T4));
  const bleed = new THREE.Mesh(chamferedBox(0.15, 0.12, 0.2), matDark); bleed.position.set(0.55, 0, -0.2); g.add(grow(bleed, T4));
  const cap = new THREE.Mesh(coneG(0.3, 0.4, 32), matTitan); cap.rotation.x = Math.PI / 2; cap.position.z = 0.85; g.add(grow(cap, T1));
  bolts(g, 0.26, 8, 0.7, matSteel, T4);
  return g;
}
function buildComb1(): THREE.Group {
  const g = new THREE.Group();
  const body = Z(new THREE.Mesh(tubeify(new THREE.CylinderGeometry(0.6, 0.6, 0.08, 64), RA, 0, 0.44, 'y'), matBurn)); g.add(body);
  g.add(grow(new THREE.Mesh(torG(0.75, 0.12, 8, 64), matDark), T1));
  const dome = new THREE.Mesh(torG(0.68, 0.06, 8, 48), matBurn); dome.position.z = 0.22; g.add(grow(dome, T3));
  const manifold = new THREE.Mesh(torG(0.75, 0.05, 8, 48), matCopper); manifold.position.z = 0.25; g.add(grow(manifold, T3));
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const tube = makePipe(matCopper, 0.3);
    tube.position.set(Math.cos(a) * 0.72, Math.sin(a) * 0.72, 0.25); g.add(grow(tube, T4));
  }
  const v1 = bladeRing(0, 24, 0.66, 0.18, 0.22, 0.03, 1.2, matDark, 0.3, 0.6); v1.position.z = 0.1; g.add(v1);
  const v2 = bladeRing(0, 24, 0.66, 0.18, 0.22, 0.03, -1.2, matDark, 0.3, 0.6); v2.position.z = -0.1; g.add(v2);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const noz = makeInjector(matCopper);
    noz.position.set(Math.cos(a) * 0.70, Math.sin(a) * 0.70, 0.30); g.add(grow(noz, T4));
  }
  bolts(g, 0.85, 16, 0, matSteel, T4);
  return g;
}
function buildComb2(): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(tubeify(new THREE.TorusGeometry(0.72, 0.09, 8, 64), RB, -0.05, 0.44, 'z'), matBlue); g.add(body);
  const ngv = bladeRing(0, 30, 0.6, 0.14, 0.14, 0.02, 0.9, matDark, 0.4, 0.65); ngv.position.z = -0.18; g.add(ngv);
  const inner = new THREE.Mesh(torG(0.5, 0.05, 8, 64), matDark); g.add(grow(inner, T2));
  for (let i = 0; i < 10; i++) {
    const m = makePlug(matSteel);
    const a = (i / 10) * Math.PI * 2; m.position.set(Math.cos(a) * 0.78, Math.sin(a) * 0.78, 0);
    g.add(grow(m, T3));
  }
  for (let i = 0; i < 2; i++) {
    const a = i * Math.PI + 0.7;
    g.add(radial(grow(makeProbe(matCopper), T4), a, 0.8, 0));
  }
  return g;
}
function buildExhaust(): THREE.Group {
  const g = new THREE.Group();
  const high: [number, number][] = [[1.05, 0.6], [1.12, 0.2], [1.08, 0], [1.05, -0.2], [0.92, -0.5], [0.85, -0.6], [0.72, -0.8], [0.62, -0.9]];
  const noz = new THREE.Mesh(tubeify(new THREE.LatheGeometry(high.map(p => new THREE.Vector2(p[0], p[1])), 64), RA, -0.25, 1.34, 'y'), matBurn);
  noz.rotation.x = Math.PI / 2; g.add(noz);
  const hubT = Z(new THREE.Mesh(cylG(0.55, 0.55, 0.12, 48), matDark)); hubT.position.z = 0.3; g.add(grow(hubT, T3));
  const tb = bladeRing(0, 44, 0.5, 0.4, 0.22, 0.03, 0.85, matBlue, 0.6, 0.6); tb.position.z = 0.3; g.add(tb);
  const st = new THREE.Mesh(torG(0.95, 0.06, 8, 48), matDark); st.position.z = 0.3; g.add(grow(st, T3));
  const shroud = new THREE.Mesh(torG(0.92, 0.03, 8, 48), matBurn); shroud.position.z = 0.3; g.add(grow(shroud, T4));
  const band = Z(new THREE.Mesh(cylG(1.0, 1.0, 0.3, 48, true), matBurn.clone())); band.position.z = 0.3; g.add(grow(band, T3));
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const strut = new THREE.Mesh(chamferedBox(0.42, 0.07, 0.14), matDark);
    strut.position.set(Math.cos(a) * 0.75, Math.sin(a) * 0.75, 0.3); strut.rotation.z = a;
    g.add(grow(strut, T3));
  }
  const cone = new THREE.Mesh(coneG(0.45, 1.2, 48), matDark); cone.rotation.x = -Math.PI / 2; cone.position.z = -0.3; g.add(grow(cone, T1));
  const tipcap = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 8), matDark); tipcap.position.z = -0.95; g.add(grow(tipcap, T4));
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const s = new THREE.Mesh(chamferedBox(0.85, 0.06, 0.12), matDark);
    s.position.set(Math.cos(a) * 0.62, Math.sin(a) * 0.62, -0.2); s.rotation.z = a;
    g.add(grow(s, T1));
  }
  const clamp = new THREE.Mesh(torG(1.08, 0.04, 8, 48), matSteel); clamp.position.z = 0.4; g.add(grow(clamp, T4));
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    g.add(radial(grow(makeProbe(matCopper), T4), a, 0.95, -0.2));
  }
  bolts(g, 1.05, 16, 0.6, matSteel, T4);
  return g;
}

/* ---------- API ---------- */
export interface MorphTurbine {
  /** grupo 'engine' (eje del motor = Z, nariz en +Z) */
  root: THREE.Group;
  /** morph continuo 0 = low-poly facetado, 1 = detalle completo */
  applyDetail(d: number): void;
  /** despiece axial: 0 = ensamblado, 1 = explosionado */
  applyExplode(e: number): void;
  spinners: THREE.Object3D[];
  gearSpin: { o: THREE.Object3D; s: number }[];
}

/**
 * Una turbina POR INSTANCIA: sin singleton (el doble-mount re-parentaba el
 * root compartido) y con registro propio — montar OTRO preview en la página
 * ya no vacía los registros de esta (bug: morph clavado en low-poly).
 */
export function createMorphTurbine(): MorphTurbine {
  const reg: TurbReg = { morphGeos: [], growMeshes: [], bladeRings: [], gearSpin: [] };
  const prevReg = REG;
  REG = reg;

  const engine = new THREE.Group();
  const parts: { g: THREE.Group; asm: THREE.Vector3; exp: THREE.Vector3 }[] = [];
  const spinners: THREE.Object3D[] = [];
  const CONFIG: { b: () => THREE.Group; asm: number; exp: number; spin?: boolean }[] = [
    { b: buildNose, asm: 2.1, exp: 8.6, spin: true },
    { b: buildFan, asm: 0.9, exp: 6.2, spin: true },
    { b: buildCase, asm: 0.6, exp: 3.6 },
    { b: buildShaftLP, asm: -0.2, exp: 1.4, spin: true },
    { b: buildStageA, asm: -0.9, exp: -0.4, spin: true },
    { b: buildStageB, asm: -1.25, exp: -2.2, spin: true },
    { b: buildCore, asm: -1.9, exp: -4.4 },
    { b: buildHPC, asm: -2.9, exp: -6.6 },
    { b: buildComb1, asm: -3.5, exp: -8.6 },
    { b: buildComb2, asm: -3.85, exp: -10.4 },
    { b: buildExhaust, asm: -4.5, exp: -12.6 },
  ];
  try {
    for (const cfg of CONFIG) {
      const inner = cfg.b();
      const g = new THREE.Group(); g.add(inner);
      g.position.set(0, 0, cfg.asm);
      parts.push({ g, asm: new THREE.Vector3(0, 0, cfg.asm), exp: new THREE.Vector3(0, 0, cfg.exp) });
      engine.add(g);
      if (cfg.spin) spinners.push(inner);
    }
  } finally {
    REG = prevReg;
  }

  let noseTextured = true;
  function applyDetail(d: number): void {
    for (const g of reg.morphGeos) {
      const { a, b } = g.userData.morph as { a: Float32Array; b: Float32Array };
      const arr = g.attributes.position.array as Float32Array;
      for (let i = 0; i < arr.length; i++) arr[i] = a[i] + (b[i] - a[i]) * d;
      g.attributes.position.needsUpdate = true;
      g.computeVertexNormals();
    }
    for (const m of reg.growMeshes) {
      const { t0, w } = m.userData.grow as { t0: number; w: number };
      const s = smooth01((d - t0) / w);
      m.visible = s > 0.02; m.scale.setScalar(Math.max(s, 1e-4));
    }
    for (const r of reg.bladeRings) {
      const vc = r.min + (r.max - r.min) * d;
      const gate = r.appear > 0 ? smooth01((d - r.appear) / 0.25) : 1;
      // SIMETRÍA SIEMPRE: cada aspa i se sienta en i/n·360° con n = conteo
      // continuo — el anillo se re-reparte uniforme mientras se llena (6→22
      // en el fan) y el aspa entrante crece justo en su hueco futuro
      const n = Math.max(vc, r.min, 1);
      for (let i = 0; i < r.blades.length; i++) {
        const s = smooth01(vc - i) * gate;
        r.blades[i].visible = s > 0.02; r.blades[i].scale.setScalar(Math.max(s, 1e-4));
        const h = r.holders[i];
        h.rotation.z = (i / n) * Math.PI * 2;
      }
    }
    const want = d > 0.3;
    if (want !== noseTextured) {
      noseTextured = want;
      matNose.map = want ? spiralTexture() : null;
      matNose.needsUpdate = true;
    }
  }

  function applyExplode(e: number): void {
    // factor 0.55: el despiece de la referencia es enorme (±12.6) — pensado
    // para pantalla completa; en el widget de 290px lo moderamos
    for (const p of parts) {
      p.g.position.set(
        p.asm.x + (p.exp.x - p.asm.x) * e * 0.55,
        p.asm.y + (p.exp.y - p.asm.y) * e * 0.55,
        p.asm.z + (p.exp.z - p.asm.z) * e * 0.55,
      );
    }
  }

  applyDetail(0);
  return { root: engine, applyDetail, applyExplode, spinners, gearSpin: reg.gearSpin };
}
