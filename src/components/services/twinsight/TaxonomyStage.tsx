/**
 * TaxonomyStage.tsx — Escena 3D de la diapositiva "Taxonomía" y "Thermal" de la sustentación
 * TwinSight X500, portada de assets/js/phaseb.js (ciclo 31). Misma lógica por pasos:
 *  tax 0 dron · 1 28 piezas por subsistema · 2 30 anclas (tornillería resaltada) · 3 257 elementos
 *  (alambre) · 4 hotspots · 5 tornillería 425 208 → 14 408 · 6 el tornillo se arma pieza a pieza ·
 *  7 las 5 piezas base. th: simulación térmica con los parámetros de ThermalSimulationManager.
 * Colores de marca del cotizador en lugar del lima de la presentación.
 */
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { DRONE_URL, SCREW_URL, loadScene, studioEnv, placeDrone, sm01, lerp } from './assets';

type Lang = 'es' | 'en';
type MeshRec = { mesh: THREE.Mesh; cat: number; tex: THREE.MeshStandardMaterial; th: THREE.MeshStandardMaterial; wire: THREE.Mesh; box: THREE.Box3; center: THREE.Vector3; name: string; canon: string; baseQ: THREE.Quaternion; node?: ThermalNode };
type ThermalNode = { id: string; T: number; P: { src: boolean; hover: number; peak: number; tau: number; exposure: number; w: number; k: number; cool: number }; meshes: MeshRec[] };

const ACC = 0xff7a3d, SIG = 0x67d4ff, AMBER = 0xffb224;
const CAT_RE = [null, /^DJ-2216/i, /propeller/i, /battery_PROXY|x500v2_battery|BATTERY-PAD/i, /PM06|XT60|BM06B/i, /PIXHAWK|gps_m10|GPS|telemetry|GAI-GUANGLIU/i, /^(GB70|LM-|M25-|M3-|NILONG|ZSLM)|_PRIM/i] as const;
const catOf = (n: string) => { if (CAT_RE[6]!.test(n)) return 6; for (let i = 1; i < 6; i++) if (CAT_RE[i]!.test(n)) return i; return 0; };
const quad = (c: THREE.Vector3) => (c.z >= 0 ? 'F' : 'B') + (c.x >= 0 ? 'R' : 'L');
function canonOf(name: string, c: THREE.Vector3) {
  if (CAT_RE[6]!.test(name)) return 'fastener';
  if (/^DJ-2216/i.test(name)) return 'motor_' + quad(c);
  if (/HMX5V|BAN-DJ-DIAN|propeller/i.test(name)) return 'arm_' + quad(c);
  if (/TOP-PLATE/i.test(name)) return 'top';
  if (/BOTTOM-PLATE/i.test(name)) return 'bottom';
  if (/BATTERY|LIPO|PYLONS|TUBE300|JIA-GUAN|HUAN-GUIJIAO|PLATFORM-PLAT|ZHIJIA-CAMERA|GAI-GUANGLIU/i.test(name)) return 'rails';
  if (/PM06|BM06B|XT60/i.test(name)) return 'power';
  if (/PIXHAWK/i.test(name)) return 'pixhawk';
  if (/gps_m10|GPS/i.test(name)) return 'gps';
  if (/CARBON-FIBER-TUBE|GUAN-CHENG|JIAO-EVA|LIANJIE|MAO-JIAO/i.test(name)) return 'landing';
  if (/telemetry/i.test(name)) return 'telemetry';
  return 'misc';
}
const SHADE: Record<string, number> = { FL: 1.25, FR: 1.0, BL: 0.78, BR: 0.58 };
const CANON_COL: Record<string, number> = { arm: 0x5b8cff, motor: ACC, top: SIG, bottom: 0x2aa6c9, rails: AMBER, power: 0xff5ca8, pixhawk: 0xc07dff, gps: 0x7dff5a, landing: 0x9aa4b5, telemetry: 0x7fd4ff };
const canonColor = (id: string, out: THREE.Color) => { const [fam, q] = id.split('_'); out.setHex(CANON_COL[fam] ?? 0x555555); if (q) out.multiplyScalar(SHADE[q] ?? 1); return out; };

const sw = (h: number) => `<i style="background:#${h.toString(16).padStart(6, '0')}"></i>`;
const LEG28: Record<Lang, [string, string, number][]> = {
  es: [['Brazos ×4 · FL FR BL BR', sw(0x5b8cff), 1], ['Motores ×4', sw(ACC), 1], ['Hélices ×4 · van con su brazo', sw(0x5b8cff), 0.55], ['Placa superior', sw(SIG), 1], ['Placa inferior', sw(0x2aa6c9), 1], ['Rieles y batería', sw(AMBER), 1], ['Tren de aterrizaje', sw(0x9aa4b5), 1], ['Pixhawk 6C', sw(0xc07dff), 1], ['Módulo de potencia', sw(0xff5ca8), 1], ['GPS M10', sw(0x7dff5a), 1], ['Radio de telemetría', sw(0x7fd4ff), 1]],
  en: [['Arms ×4 · FL FR BL BR', sw(0x5b8cff), 1], ['Motors ×4', sw(ACC), 1], ['Propellers ×4 · ride with their arm', sw(0x5b8cff), 0.55], ['Top plate', sw(SIG), 1], ['Bottom plate', sw(0x2aa6c9), 1], ['Rails and battery', sw(AMBER), 1], ['Landing gear', sw(0x9aa4b5), 1], ['Pixhawk 6C', sw(0xc07dff), 1], ['Power module', sw(0xff5ca8), 1], ['GPS M10', sw(0x7dff5a), 1], ['Telemetry radio', sw(0x7fd4ff), 1]],
};
const LEG30: Record<Lang, [string, string, number][]> = {
  es: [['28 piezas canónicas', '<i class="ghost"></i>', 0.6], ['+ grupo de tornillería', sw(AMBER), 1], ['+ grupo de misceláneos', '<i class="ghost"></i>', 0.7]],
  en: [['28 canonical parts', '<i class="ghost"></i>', 0.6], ['+ fastener group', sw(AMBER), 1], ['+ misc group', '<i class="ghost"></i>', 0.7]],
};
const legHTML = (rows: [string, string, number][]) => rows.map((r) => `<span style="opacity:${r[2]}">${r[0]}${r[1]}</span>`).join('');

// ── Simulación térmica (parámetros de ThermalSimulationManager, tal cual la presentación) ──
const AMB = 20, IDLE_LOAD = 0.2, HOVER_LOAD = 0.45, ACCEL = 3.5, DEF_COOL = 0.08;
const PARTS: [string, RegExp, boolean, number, number, number, number, number, number][] = [
  ['motor', /^DJ-2216/i, true, 55, 95, 10, 0.8, 1.0, 1.8], ['pixhawk6c', /PIXHAWK/i, true, 42, 60, 6, 0.45, 0.5, 0.4], ['power', /PM06|BM06B|XT60/i, true, 35, 55, 3, 0.55, 0.5, 0.4],
  ['battery', /x500v2_battery/i, true, 35, 55, 15, 0.35, 0.8, 0.18], ['gps', /gps_m10|GPS/i, true, 28, 40, 2, 0.55, 0.2, 0.65], ['telemetry', /telemetry/i, true, 32, 45, 2, 0.55, 0.2, 0.4],
  ['prop', /propeller/i, false, 22, 25, 0, 0.95, 0.08, 0.2], ['arm', /HMX5V|BAN-DJ-DIAN/i, false, 30, 45, 8, 0.8, 0.2, 0.65], ['top', /TOP-PLATE/i, false, 28, 38, 0, 0.55, 0.2, 0.65],
  ['bottom', /BOTTOM-PLATE/i, false, 25, 35, 0, 0.55, 0.2, 0.65], ['rails', /BATTERY-MOUNTING|BATTERY-PAD|PYLONS|TUBE300|JIA-GUAN|HUAN-GUIJIAO|PLATFORM|ZHIJIA-CAMERA/i, false, 22, 25, 0, 0.55, 0.2, 0.65],
  ['landing', /CARBON-FIBER-TUBE|GUAN-CHENG|JIAO-EVA|JIAO-LIANJIE|JIA-LIANJIE|MAO-JIAO/i, false, 22, 25, 0, 0.95, 0.2, 0.65], ['fastener', /_PRIM|^(GB70|LM-|M25-|M3-|ZSLM|NILONG)/i, false, 22, 26, 60, 0.55, 0.2, 1.0],
];
const C0 = new THREE.Color(0.05, 0.0, 0.35), C1 = new THREE.Color(1, 0.5, 0), C2 = new THREE.Color(1, 0.92, 0.08), C3 = new THREE.Color(1, 1, 1);
const ramp = (t: number, out: THREE.Color) => { t = Math.max(0, Math.min(1, t)); if (t < 0.33) return out.copy(C0).lerp(C1, t / 0.33); if (t < 0.66) return out.copy(C1).lerp(C2, (t - 0.33) / 0.33); return out.copy(C2).lerp(C3, (t - 0.66) / 0.34); };

export function TaxonomyStage({ mode, step, lang = 'es', height = 420, cap }: { mode: 'tax' | 'th'; step: number; lang?: Lang; height?: number | string; cap?: string }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const capRef = useRef<HTMLDivElement>(null);
  const legRef = useRef<HTMLDivElement>(null);
  const labRef = useRef<HTMLDivElement>(null);
  const hsRef = useRef<HTMLDivElement>(null);
  const hudRef = useRef<HTMLDivElement>(null);
  const stepRef = useRef(step); stepRef.current = step;
  const modeRef = useRef(mode); modeRef.current = mode;
  const capOv = useRef(cap); capOv.current = cap;
  const en = lang === 'en';

  useEffect(() => {
    const host = hostRef.current!;
    let disposed = false, raf = 0, visible = true;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    host.insertBefore(renderer.domElement, host.firstChild);
    const scene = new THREE.Scene();
    scene.environment = studioEnv(renderer);
    const camera = new THREE.PerspectiveCamera(32, 1, 0.01, 60);
    const key = new THREE.DirectionalLight(0xfff4e8, 2.4); key.position.set(-3.2, 6.5, 3.4); scene.add(key);
    const rim = new THREE.DirectionalLight(0xcfe0ff, 1.6); rim.position.set(2.5, 3, -4.5); scene.add(rim);
    scene.add(new THREE.HemisphereLight(0xdfe6ee, 0x0a0b0e, 0.35));
    const resize = () => { const w = host.clientWidth || 600, h = host.clientHeight || 420; renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); };
    resize(); const ro = new ResizeObserver(resize); ro.observe(host);
    const io = new IntersectionObserver((e) => { visible = e.some((x) => x.isIntersecting); }, { threshold: 0.05 }); io.observe(host);

    const meshes: MeshRec[] = [];
    let ready = false, S = 1, H = 1;
    const target = new THREE.Vector3();
    const hotspots: { el: HTMLDivElement; pos: THREE.Vector3 }[] = [];
    const screw: { ok: boolean; prox?: MeshRec; grp?: THREE.Group; tip?: THREE.Mesh; turns?: THREE.Mesh[]; head?: THREE.Mesh; dir?: THREE.Vector3; center?: THREE.Vector3; L?: number; headD?: number; lib?: THREE.Mesh[]; N?: number } = { ok: false };
    const nodes: ThermalNode[] = []; const links: [ThermalNode, ThermalNode, number][] = [];

    Promise.all([loadScene(DRONE_URL), loadScene(SCREW_URL).catch(() => null)]).then(([obj, sg]) => {
      if (disposed) return;
      const placed = placeDrone(obj);
      scene.add(placed.wrap); S = placed.scale; H = placed.height; target.set(0, H * 0.45, 0);
      const list: THREE.Mesh[] = []; obj.traverse((o) => { if ((o as THREE.Mesh).isMesh) list.push(o as THREE.Mesh); });
      list.forEach((o) => {
        const tex = (o.material as THREE.MeshStandardMaterial).clone();
        if (tex.name === 'X500_Atlas') { tex.metalness = 0.32; tex.roughness = 1.0; tex.envMapIntensity = 1.1; }
        tex.emissive = new THREE.Color(0); tex.transparent = true; tex.opacity = 1;
        const th = new THREE.MeshStandardMaterial({ color: 0x0d0059, roughness: 0.55, metalness: 0.08, emissive: 0x000000, envMapIntensity: 0.6 });
        o.material = tex;
        const wire = new THREE.Mesh(o.geometry, new THREE.MeshBasicMaterial({ color: SIG, wireframe: true, transparent: true, opacity: 0, depthWrite: false }));
        wire.visible = false; o.add(wire);
        const b = new THREE.Box3().setFromObject(o); const cen = b.getCenter(new THREE.Vector3());
        meshes.push({ mesh: o, cat: catOf(o.name), tex, th, wire, box: b, center: cen, name: o.name, canon: canonOf(o.name, cen), baseQ: o.quaternion.clone() });
      });
      // hotspots (etiquetas de DronePartData en la app)
      const add = (m: MeshRec | undefined, label: string) => {
        if (!m || !hsRef.current) return;
        const el = document.createElement('div'); el.className = 'pb-dot'; if (label) el.innerHTML = `<span>${label}</span>`;
        hsRef.current.appendChild(el); hotspots.push({ el, pos: m.center.clone().add(new THREE.Vector3(0, 0.05, 0)) });
      };
      meshes.filter((m) => /^DJ-2216/.test(m.name)).forEach((m, i) => add(m, i === 0 ? (en ? 'Propulsion system' : 'Sistema de propulsión') : ''));
      add(meshes.find((m) => /gps_m10/.test(m.name)), en ? 'GPS & compass' : 'GPS y brújula');
      add(meshes.find((m) => /MIANKE-PIXHAWK/.test(m.name)), en ? 'Flight controller' : 'Controladora de vuelo');
      add(meshes.find((m) => /x500v2_battery/.test(m.name)), en ? 'Battery' : 'Batería');
      // térmico
      meshes.forEach((m) => {
        const def = PARTS.find((p) => p[1].test(m.name));
        let id: string, P: ThermalNode['P'];
        if (def) {
          P = { src: def[2], hover: def[3], peak: def[4], tau: def[5] || (def[2] ? 12 : 20), exposure: def[6], w: def[7], k: def[8], cool: 0 };
          id = def[0] === 'fastener' ? 'f:' + m.name : /motor|arm|prop/.test(def[0]) ? def[0] + '_' + quad(m.center) : def[0];
          if (def[0] === 'prop') { P.hover = Math.min(Math.max(P.hover, 21.5), 24); P.peak = Math.min(Math.max(P.peak, 25), 32); }
          if (P.src && def[0] === 'battery') P.hover = Math.max(P.hover, 35);
          P.cool = def[0] === 'prop' ? 0.34 : DEF_COOL * (0.75 + 0.75 * P.exposure);
        } else { id = 'p:' + m.name; P = { src: false, hover: 22, peak: 60, tau: 12, exposure: 0.55, w: 0.2, k: 0.65, cool: DEF_COOL * (0.75 + 0.75 * 0.55) }; }
        let n = nodes.find((x) => x.id === id);
        if (!n) { n = { id, T: AMB, P, meshes: [] }; nodes.push(n); }
        n.meshes.push(m); m.node = n;
      });
      const e = 0.0015 * S, tmp = new THREE.Box3(), inter = new THREE.Box3(), sz = new THREE.Vector3(), acc = new Map<string, { a: ThermalNode; b: ThermalNode; g: number }>();
      for (let i = 0; i < meshes.length; i++) {
        tmp.copy(meshes[i].box).expandByScalar(e);
        for (let j = i + 1; j < meshes.length; j++) {
          const a = meshes[i].node!, b = meshes[j].node!;
          if (a === b || !tmp.intersectsBox(meshes[j].box)) continue;
          inter.copy(tmp).intersect(meshes[j].box.clone().expandByScalar(e)); inter.getSize(sz);
          const d = [sz.x, sz.y, sz.z].sort((x, y) => y - x);
          const k2 = a.id < b.id ? a.id + '|' + b.id : b.id + '|' + a.id;
          const cur = acc.get(k2) ?? { a, b, g: 0 };
          cur.g += ((d[0] / S) * 100 * ((d[1] / S) * 100)) / Math.max(1, (meshes[i].center.distanceTo(meshes[j].center) / S) * 1000);
          acc.set(k2, cur);
        }
      }
      acc.forEach(({ a, b, g }) => links.push([a, b, Math.min(0.09, Math.max(0.006, 0.02 * g * 0.5 * (a.P.k + b.P.k)))]));
      // tornillo modular
      if (sg) buildScrew(sg);
      ready = true;
    }).catch(() => { /* sin modelo: queda el fondo */ });

    function buildScrew(sgScene: THREE.Group) {
      const pieces: Record<string, THREE.Mesh> = {};
      sgScene.updateMatrixWorld(true);
      sgScene.traverse((o) => { if ((o as THREE.Mesh).isMesh) pieces[o.name.replace(/\.\d+$/, '')] = o as THREE.Mesh; });
      const need = ['mod_head_ding', 'mod_head_pan', 'mod_head_chen', 'mod_thread_turn', 'mod_thread_end'];
      if (!need.every((n) => pieces[n])) return;
      const geo: Record<string, { g: THREE.BufferGeometry; h: number; w: number }> = {};
      need.forEach((n) => {
        // el GLB está cuantizado (KHR_mesh_quantization): pasar a float ANTES de hornear la matriz
        const m = pieces[n]; const g = new THREE.BufferGeometry();
        for (const key of ['position', 'normal'] as const) {
          const at = m.geometry.getAttribute(key); if (!at) continue;
          const f = new Float32Array(at.count * 3);
          for (let i = 0; i < at.count; i++) { f[i * 3] = at.getX(i); f[i * 3 + 1] = at.getY(i); f[i * 3 + 2] = at.getZ(i); }
          g.setAttribute(key, new THREE.BufferAttribute(f, 3));
        }
        if (m.geometry.index) g.setIndex(Array.from(m.geometry.index.array as ArrayLike<number>));
        g.applyMatrix4(m.matrixWorld); if (!g.getAttribute('normal')) g.computeVertexNormals();
        g.computeBoundingBox(); const cc = g.boundingBox!.getCenter(new THREE.Vector3()); g.translate(-cc.x, -cc.y, -cc.z); g.computeBoundingBox();
        const s2 = g.boundingBox!.getSize(new THREE.Vector3()); geo[n] = { g, h: s2.y, w: Math.max(s2.x, s2.z) };
      });
      const cand = meshes.filter((m) => /GB70-M3-38/i.test(m.name));
      if (!cand.length) return;
      cand.sort((a, b) => (b.center.x + b.center.z) - (a.center.x + a.center.z));
      const prox = cand[0];
      const bs = prox.box.getSize(new THREE.Vector3());
      const axisIdx = bs.x >= bs.y && bs.x >= bs.z ? 0 : bs.y >= bs.z ? 1 : 2;
      const axis = new THREE.Vector3(axisIdx === 0 ? 1 : 0, axisIdx === 1 ? 1 : 0, axisIdx === 2 ? 1 : 0);
      const L = bs.getComponent(axisIdx);
      const dHead = Math.max(bs.getComponent((axisIdx + 1) % 3), bs.getComponent((axisIdx + 2) % 3));
      const pos = prox.mesh.geometry.attributes.position, v = new THREE.Vector3(), c0 = prox.center, ends = [0, 0];
      for (let i = 0; i < pos.count; i += 2) {
        v.fromBufferAttribute(pos as THREE.BufferAttribute, i).applyMatrix4(prox.mesh.matrixWorld);
        const d = v.clone().sub(c0); const tt = d.dot(axis) / (L / 2);
        const rad = d.clone().sub(axis.clone().multiplyScalar(d.dot(axis))).length();
        if (tt > 0.8) ends[1] = Math.max(ends[1], rad); else if (tt < -0.8) ends[0] = Math.max(ends[0], rad);
      }
      const dir = axis.clone().multiplyScalar(ends[1] >= ends[0] ? 1 : -1);
      const tipPt = c0.clone().addScaledVector(dir, -L / 2);
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      const steel = new THREE.MeshStandardMaterial({ color: 0x8c9199, metalness: 0.95, roughness: 0.28, envMapIntensity: 1.5, transparent: true, opacity: 0 });
      const shaftD = dHead * 0.56, headH = L * 0.08, tipH = L * 0.035, shaftLen = L - headH - tipH;
      const N = Math.max(2, Math.min(56, Math.round(shaftLen / (0.0005 * S))));
      const seg = shaftLen / N;
      const grp = new THREE.Group(); scene.add(grp);
      const part = (n: string, len: number, diam: number, at: number) => {
        const G = geo[n]; const m = new THREE.Mesh(G.g, steel.clone());
        m.scale.set(diam / G.w, len / G.h, diam / G.w); m.quaternion.copy(q);
        m.userData.home = tipPt.clone().addScaledVector(dir, at); m.position.copy(m.userData.home); m.renderOrder = 5; grp.add(m); return m;
      };
      const tip = part('mod_thread_end', tipH, shaftD, tipH / 2);
      const turns: THREE.Mesh[] = []; for (let i = 0; i < N; i++) turns.push(part('mod_thread_turn', seg * 0.98, shaftD, tipH + seg * (i + 0.5)));
      const head = part('mod_head_ding', headH, dHead, tipH + shaftLen + headH / 2);
      const lib = ['mod_head_ding', 'mod_head_chen', 'mod_head_pan', 'mod_thread_turn', 'mod_thread_end'].map((n) => {
        const G = geo[n], k = (dHead * 1.6) / Math.max(G.w, G.h * 1.2);
        const m = new THREE.Mesh(G.g, steel.clone()); m.scale.setScalar(k); m.quaternion.copy(q); m.visible = false; grp.add(m); return m;
      });
      Object.assign(screw, { ok: true, prox, grp, tip, turns, head, dir, center: c0.clone(), L, headD: dHead, lib, N });
    }

    const libGap = () => (camera.aspect > 1.6 ? 3.4 : 2.6);
    const LIBL = en ? ['Socket head', 'Countersunk head', 'Pan head', 'Thread turn', 'Tip'] : ['Cabeza cilíndrica', 'Cabeza avellanada', 'Cabeza redondeada', 'Vuelta de rosca', 'Punta'];
    const camPos = new THREE.Vector3(), camLook = new THREE.Vector3(), wantPos = new THREE.Vector3(), wantLook = new THREE.Vector3();
    const orbitPose = (theta: number, phi: number, r: number, tg: THREE.Vector3) => { wantLook.copy(tg); wantPos.set(tg.x + r * Math.sin(phi) * Math.sin(theta), tg.y + r * Math.cos(phi), tg.z + r * Math.sin(phi) * Math.cos(theta)); };
    const _c = new THREE.Color();
    let t = 0, last = performance.now(), stepPrev = -1, stepT = 0, snap = true, thT = 0, thRunning = false, lastMode = '';
    // hélices del modo térmico
    const props = () => meshes.filter((m) => /propeller/i.test(m.name));
    const propAng = new Map<MeshRec, number>(); let rpmTh = 0;
    const _qY = new THREE.Quaternion(), _axY = new THREE.Vector3(0, 1, 0);
    const setCap = (html0: string) => { const html = capOv.current ?? html0; if (capRef.current && capRef.current.innerHTML !== html) capRef.current.innerHTML = html; };
    const project = (v: THREE.Vector3) => { const p = v.clone().project(camera); return { x: (p.x * 0.5 + 0.5) * 100, y: (-p.y * 0.5 + 0.5) * 100 }; };

    const updateTax = (dt: number, step: number) => {
      if (step !== stepPrev) { stepPrev = step; stepT = 0; }
      stepT += dt;
      const ghost = step >= 5; const glow = 1.1 + 0.35 * Math.sin(t * 4);
      meshes.forEach((m) => {
        const mat = m.tex, isF = m.cat === 6;
        let tgt: THREE.Color;
        if (step === 1) tgt = isF ? _c.setRGB(0, 0, 0) : canonColor(m.canon, _c).multiplyScalar(0.42);
        else if (step === 2) tgt = isF ? _c.setHex(AMBER).multiplyScalar(glow) : _c.setRGB(0, 0, 0);
        else if (step === 3) tgt = isF ? _c.setRGB(0, 0, 0) : canonColor(m.canon, _c).multiplyScalar(0.12);
        else if (step === 5) tgt = isF ? _c.setHex(AMBER).multiplyScalar(0.8) : _c.setRGB(0, 0, 0);
        else if (step >= 6) tgt = isF ? _c.setHex(AMBER).multiplyScalar(0.25) : _c.setRGB(0, 0, 0);
        else tgt = _c.setRGB(0, 0, 0);
        mat.emissive.lerp(tgt, Math.min(1, dt * 5));
        let op = ghost ? (!isF ? (step >= 6 ? 0.05 : 0.2) : step >= 6 ? 0.05 : 1) : 1;
        if (step === 1 && isF) op = 0.12;
        if (step === 2 && !isF) op = 0.2;
        mat.opacity = lerp(mat.opacity, op, Math.min(1, dt * 4)); mat.depthWrite = mat.opacity > 0.9;
        if (isF && step >= 6 && screw.ok && m === screw.prox) mat.opacity = lerp(mat.opacity, 0, Math.min(1, dt * 6));
        const wOn = step === 3; const wm = m.wire.material as THREE.MeshBasicMaterial;
        m.wire.visible = wOn || wm.opacity > 0.01; wm.opacity = lerp(wm.opacity, wOn ? 0.22 : 0, Math.min(1, dt * 5));
      });
      if (legRef.current) {
        legRef.current.style.opacity = step >= 1 && step <= 2 ? '1' : '0';
        const want = step === 2 ? 'L30' : 'L28';
        if (legRef.current.dataset.v !== want) { legRef.current.dataset.v = want; legRef.current.innerHTML = legHTML((step === 2 ? LEG30 : LEG28)[lang]); }
      }
      hotspots.forEach((h, i) => {
        const on = step === 4; h.el.classList.toggle('on', on); h.el.classList.toggle('act', on && i === 0 && t % 4 > 2);
        if (on) { const p = project(h.pos); h.el.style.left = p.x + '%'; h.el.style.top = p.y + '%'; h.el.classList.toggle('lft', p.x > 62); }
      });
      let html = '';
      if (screw.ok) {
        const a = step >= 6 ? stepT + (step >= 7 ? 99 : 0) : -1;
        const show = (m: THREE.Mesh, t0: number, from: number) => {
          const k = a < 0 ? 0 : sm01((a - t0) / 0.35);
          (m.material as THREE.MeshStandardMaterial).opacity = k; m.visible = k > 0.001;
          m.position.copy(m.userData.home as THREE.Vector3).addScaledVector(screw.dir!, (1 - k) * from);
        };
        show(screw.tip!, 0.4, -screw.L! * 0.25);
        screw.turns!.forEach((m, i) => show(m, 0.6 + i * 0.03, -screw.L! * 0.3));
        show(screw.head!, 0.8 + screw.N! * 0.03, screw.L! * 0.5);
        const camR = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0), camU = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
        screw.lib!.forEach((m, i) => {
          const on = step >= 7; m.visible = on; if (!on) return;
          const k = sm01((stepT - i * 0.12) / 0.5); (m.material as THREE.MeshStandardMaterial).opacity = k;
          const p = screw.center!.clone().addScaledVector(camR, screw.headD! * (3.0 + i * libGap())).addScaledVector(camU, screw.L! * 0.12);
          m.position.copy(p); m.rotation.y += dt * 0.6;
          const up = i % 2 === 0;
          const sp = p.clone().addScaledVector(camU, screw.headD! * (up ? 1.5 : -1.7)).project(camera);
          html += `<span style="left:${((sp.x * 0.5 + 0.5) * 100).toFixed(2)}%;top:${((-sp.y * 0.5 + 0.5) * 100).toFixed(2)}%;opacity:${k.toFixed(2)};transform:translate(-50%,${up ? '-120%' : '20%'})">${LIBL[i]}</span>`;
        });
      }
      if (labRef.current && labRef.current.innerHTML !== html) labRef.current.innerHTML = html;
      if (step >= 6 && screw.ok) {
        const tg = screw.center!.clone().addScaledVector(screw.dir!, screw.L! * 0.05);
        const off = new THREE.Vector3(1, 0.35, 0.9).normalize();
        const wide = camera.aspect > 1.6, r = screw.L! * (step >= 7 ? (wide ? 3.5 : 4.8) : wide ? 2.2 : 2.6);
        wantLook.copy(tg).add(step >= 7 ? new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0).multiplyScalar(screw.headD! * (1.5 + 2 * libGap())) : new THREE.Vector3());
        wantPos.copy(tg).add(off.applyAxisAngle(new THREE.Vector3(0, 1, 0), step >= 7 ? 0 : t * 0.08).multiplyScalar(r));
      } else {
        const th0 = 0.6 + t * 0.06;
        orbitPose(th0, step === 4 ? 1.02 : 1.12, camera.aspect > 1.6 ? 4.4 : 5.4, target);
        if (step === 1 || step === 2) { const rx = Math.cos(th0) * 0.95, rz = -Math.sin(th0) * 0.95; wantPos.x += rx; wantPos.z += rz; wantLook.x += rx; wantLook.z += rz; }
      }
      const caps = en
        ? ['The Holybro X500 V2, ready to be read part by part', '<b>28</b> canonical parts · each motor, arm and propeller counts separately', '<b>30</b> anchors = 28 parts + fastener group + misc group', '<b>257</b> elements that are drawn or touched', 'Hotspots · one tap selects the group',
          'Fasteners · <b>425,208 → 14,408</b> triangles', screw.ok ? `Screw assembled in the app · head + <b>${screw.N}</b> turns + tip` : 'Modular screw', '<b>5</b> base pieces build any screw']
        : ['El Holybro X500 V2, listo para leerse pieza a pieza', '<b>28</b> piezas canónicas · cada motor, brazo y hélice cuenta por separado', '<b>30</b> anclas = 28 piezas + grupo de tornillería + grupo de misceláneos', '<b>257</b> elementos que se dibujan o se tocan', 'Hotspots · un toque selecciona el grupo',
          'Tornillería · <b>425 208 → 14 408</b> triángulos', screw.ok ? `Tornillo armado en la app · cabeza + <b>${screw.N}</b> vueltas + punta` : 'Tornillo modular', '<b>5</b> piezas base arman cualquier tornillo'];
      setCap(caps[Math.min(step, caps.length - 1)]);
    };

    const loadAt = (ts: number) => ts < 1.5 ? { load: Math.max(0.1, IDLE_LOAD * 0.5), es: 'Arranque', en: 'Start-up' } : ts < 4 ? { load: IDLE_LOAD, es: 'Reposo · motores armados', en: 'Idle · motors armed' } : ts < 12 ? { load: HOVER_LOAD, es: 'Vuelo estacionario', en: 'Hover' } : { load: 0.8, es: 'Vuelo · carga 80 %', en: 'Flight · 80% load' };
    const equilibrium = (P: ThermalNode['P'], load: number) => (!P.src || load <= 0) ? AMB : load <= HOVER_LOAD ? AMB + (P.hover - AMB) * sm01(load / HOVER_LOAD) : P.hover + (P.peak - P.hover) * sm01((load - HOVER_LOAD) / (1 - HOVER_LOAD));
    const stepThermal = (dt: number, load: number) => {
      const d = new Map<ThermalNode, number>();
      for (const n of nodes) { let dT = (equilibrium(n.P, load) - n.T) * (1 - Math.exp(-dt / Math.max(n.P.tau, 0.2))) * n.P.w; dT += (AMB - n.T) * n.P.cool * n.P.exposure * dt; d.set(n, dT); }
      for (const [a, b, G] of links) { const q = (b.T - a.T) * G * dt; d.set(a, d.get(a)! + q); d.set(b, d.get(b)! - q); }
      for (const n of nodes) n.T = Math.min(Math.max(n.T + d.get(n)!, AMB), Math.max(n.P.peak + 15, AMB + 5));
    };
    const spinProps = (dt: number, tgt: number) => {
      rpmTh += (tgt - rpmTh) * Math.min(1, dt * 1.6);
      const omega = rpmTh < 0.3 ? (rpmTh / 0.3) * 20 : 20 + (rpmTh - 0.3) * 55;
      props().forEach((m) => { const a = (propAng.get(m) ?? 0) + omega * dt * (Math.sign(m.mesh.position.x * m.mesh.position.y) || 1); propAng.set(m, a); m.mesh.quaternion.copy(m.baseQ).multiply(_qY.setFromAxisAngle(_axY, a)); });
    };
    const updateTh = (dt: number, step: number) => {
      if (legRef.current) legRef.current.style.opacity = '0';
      if (step >= 1 && !thRunning) { thRunning = true; thT = 0; }
      if (step < 1 && thRunning) { thRunning = false; nodes.forEach((n) => (n.T = AMB)); }
      let hud = '';
      if (thRunning) {
        thT += dt; const st = loadAt(thT);
        spinProps(dt, st.load <= 0.1 ? 0.18 : st.load <= IDLE_LOAD ? 0.28 : st.load <= HOVER_LOAD ? 0.85 : 1.0);
        for (let i = 0; i < 4; i++) stepThermal((dt * ACCEL) / 4, st.load);
        const avg = (re: RegExp) => { const g = meshes.filter((m) => re.test(m.name)); return g.length ? g.reduce((a, m) => a + m.node!.T, 0) / g.length : AMB; };
        hud = `<span class="st">${en ? st.en : st.es}</span><br>${en ? 'Motors' : 'Motores'} <b>${avg(/^DJ-2216/).toFixed(0)} °C</b><br>${en ? 'Controller' : 'Controladora'} <b>${avg(/PIXHAWK/).toFixed(0)} °C</b><br>${en ? 'Battery' : 'Batería'} <b>${avg(/x500v2_battery/).toFixed(0)} °C</b><br>${en ? 'Arms' : 'Brazos'} <b>${avg(/HMX5V|BAN-DJ-DIAN/).toFixed(0)} °C</b><br><small>+${Math.round(thT * ACCEL)} s ${en ? 'simulated' : 'simulados'}</small>`;
      } else { spinProps(dt, 0); hud = `<span class="st">${en ? 'Off' : 'Apagado'}</span><br>${en ? 'All at' : 'Todo a'} ${AMB} °C`; }
      if (hudRef.current && hudRef.current.innerHTML !== hud) hudRef.current.innerHTML = hud;
      meshes.forEach((m) => { ramp((m.node!.T - AMB) / (95 - AMB), _c); m.th.color.copy(_c); m.th.emissive.copy(_c).multiplyScalar(0.28); });
      setCap(en ? 'Accelerated time · uncalibrated · <b>model °C</b>' : 'Tiempo acelerado · sin calibrar · <b>°C del modelo</b>');
      orbitPose(-0.9 + t * 0.05, 1.08, camera.aspect > 1.6 ? 4.3 : 5.2, target);
    };

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (!ready || !visible || document.hidden) return;
      const mode = modeRef.current;
      if (lastMode !== mode) {
        lastMode = mode; snap = true; stepPrev = -1;
        meshes.forEach((m) => { m.mesh.material = mode === 'th' ? m.th : m.tex; m.wire.visible = false; m.tex.opacity = 1; m.tex.emissive.setRGB(0, 0, 0); });
        if (screw.grp) screw.grp.visible = mode === 'tax';
        if (mode !== 'tax') hotspots.forEach((h) => h.el.classList.remove('on'));
        if (labRef.current) labRef.current.innerHTML = '';
        if (mode === 'th') { nodes.forEach((n) => (n.T = AMB)); thRunning = false; thT = 0; }
      }
      t += dt;
      const step = stepRef.current;
      if (mode === 'tax') updateTax(dt, step); else updateTh(dt, step);
      const near = mode === 'tax' && step >= 6 ? 0.004 : 0.02;
      if (camera.near !== near) { camera.near = near; camera.updateProjectionMatrix(); }
      if (snap) { camPos.copy(wantPos); camLook.copy(wantLook); snap = false; }
      const k = Math.min(1, dt * 2.2); camPos.lerp(wantPos, k); camLook.lerp(wantLook, k);
      camera.position.copy(camPos); camera.lookAt(camLook);
      renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(frame);
    return () => { disposed = true; cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); scene.environment?.dispose(); renderer.dispose(); renderer.domElement.remove(); hsRef.current?.replaceChildren(); };
  }, [lang, en]);

  return (
    <div ref={hostRef} className={`pb-host pb-${mode}`} style={{ height }}>
      <div ref={hsRef} className="pb-hs" />
      <div ref={labRef} className="pb-labels" />
      <div ref={legRef} className="pb-legend" style={{ opacity: 0 }} />
      <div className="pb-th" hidden={mode !== 'th'}>
        <div className="pb-therm"><em style={{ top: -2 }}>95 °C</em><em style={{ top: '33%' }}>70</em><em style={{ top: '66%' }}>45</em><em style={{ bottom: -2 }}>20 °C</em></div>
        <div ref={hudRef} className="pb-hud" />
      </div>
      <div ref={capRef} className="pb-cap" />
    </div>
  );
}
