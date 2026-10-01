/**
 * Preshow.tsx — Pantalla de espera de la sustentación TwinSight X500, portada al cotizador (ciclo 31).
 * Misma coreografía que la presentación original (9 planos: órbita, detalle de motor, cenital,
 * encendido, arranque, despegue, vuelo estacionario, aterrizaje, apagado), LEDs de GPS y
 * controladora, polvo del flujo de rotores, disco de desenfoque de hélices, viñeta, grano,
 * barras de cine y tarjetas "Detrás del proyecto". Acento lima → acento del cotizador.
 */
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { DRONE_URL, loadScene, studioEnv, canvasTex, placeDrone, smooth, lerp } from './assets';

type Lang = 'es' | 'en';
const LORE: Record<Lang, [string, string][]> = {
  es: [
    ['46 000<i>+</i>', 'líneas de C# en 125 scripts escritos para la app'],
    ['780<i>+</i>', 'commits en el repositorio del proyecto'],
    ['6,5 M <i>→</i> 95 617', 'triángulos: del CAD teselado al activo que corre en la web'],
    ['425 208 <i>→</i> 14 408', 'triángulos de tornillería, reemplazada por proxies livianos'],
    ['5 <i>piezas</i>', 'arman en detalle cualquier tornillo del dron'],
    ['4K', 'atlas horneado a mano: color, normales, oclusión y rugosidad'],
    ['11 <i>shaders</i>', 'escritos para leer el dron de otra manera'],
    ['12 <i>·</i> 96', 'personas y tareas en la evaluación con usuarios'],
  ],
  en: [
    ['46,000<i>+</i>', 'lines of C# across 125 scripts written for the app'],
    ['780<i>+</i>', 'commits in the project repository'],
    ['6.5 M <i>→</i> 95,617', 'triangles: from tessellated CAD to the asset running on the web'],
    ['425,208 <i>→</i> 14,408', 'fastener triangles, replaced by lightweight proxies'],
    ['5 <i>pieces</i>', 'build any screw of the drone in detail'],
    ['4K', 'hand-baked atlas: color, normals, occlusion and roughness'],
    ['11 <i>shaders</i>', 'written to read the drone in other ways'],
    ['12 <i>·</i> 96', 'people and tasks in the user evaluation'],
  ],
};
const SHOTS: { es: string; en: string; dur: number; tgt: 'center' | 'motor' | 'top' | 'drone'; look?: 'drone'; a: [number, number, number]; b: [number, number, number] }[] = [
  { es: 'CAM 01 · Órbita', en: 'CAM 01 · Orbit', dur: 10, tgt: 'center', a: [0.35, 1.18, 6.4], b: [1.25, 1.08, 5.7] },
  { es: 'CAM 02 · Detalle · motor', en: 'CAM 02 · Detail · motor', dur: 8, tgt: 'motor', a: [0.2, 1.05, 1.75], b: [0.8, 0.95, 1.45] },
  { es: 'CAM 03 · Cenital', en: 'CAM 03 · Top-down', dur: 9, tgt: 'center', a: [0.0, 0.16, 6.6], b: [0.8, 0.24, 5.9] },
  { es: 'CAM 04 · Encendido', en: 'CAM 04 · Power on', dur: 8, tgt: 'top', a: [3.6, 0.85, 1.9], b: [4.2, 0.95, 1.65] },
  { es: 'CAM 05 · Arranque de motores', en: 'CAM 05 · Motor spin-up', dur: 8, tgt: 'motor', a: [5.6, 0.92, 2.3], b: [5.25, 0.98, 2.0] },
  { es: 'CAM 06 · Despegue', en: 'CAM 06 · Take-off', dur: 10, tgt: 'center', look: 'drone', a: [2.45, 1.52, 5.6], b: [2.15, 1.47, 5.0] },
  { es: 'CAM 07 · Vuelo estacionario', en: 'CAM 07 · Hover', dur: 10, tgt: 'drone', a: [3.3, 1.22, 4.8], b: [4.5, 1.12, 4.3] },
  { es: 'CAM 08 · Aterrizaje', en: 'CAM 08 · Landing', dur: 10, tgt: 'center', look: 'drone', a: [-1.0, 1.4, 5.4], b: [-0.8, 1.44, 5.0] },
  { es: 'CAM 09 · Apagado', en: 'CAM 09 · Shutdown', dur: 8, tgt: 'center', a: [2.55, 1.42, 5.4], b: [2.2, 1.36, 4.8] },
];
const STATES: Record<string, [string, string]> = {
  off: ['Sistema apagado', 'System off'], boot: ['Encendido · inicializando', 'Power on · booting'], gps: ['GPS · posición fijada', 'GPS · position locked'],
  armed: ['Armado · motores en ralentí', 'Armed · motors idling'], takeoff: ['Despegue', 'Take-off'], hover: ['Vuelo estacionario', 'Hovering'],
  landing: ['Aterrizaje', 'Landing'], disarmed: ['Desarmado', 'Disarmed'],
};

export function Preshow({ lang = 'es', onStart, height = 460 }: { lang?: Lang; onStart: () => void; height?: number }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const shotRef = useRef<HTMLSpanElement>(null);
  const stateRef = useRef<HTMLSpanElement>(null);
  const dipRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [lore, setLore] = useState(0);
  const en = lang === 'en';

  useEffect(() => { const t = setInterval(() => setLore((k) => (k + 1) % LORE.es.length), 6500); return () => clearInterval(t); }, []);

  useEffect(() => {
    const mount = mountRef.current!;
    let disposed = false, raf = 0, visible = true;
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setClearColor(0x08090b, 1);
    mount.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x08090b, 7, 17);
    scene.environment = studioEnv(renderer);
    const camera = new THREE.PerspectiveCamera(30, 1, 0.02, 60);
    const key = new THREE.DirectionalLight(0xfff4e8, 2.6);
    key.position.set(-3.2, 6.5, 3.4); key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    Object.assign(key.shadow.camera, { left: -2.4, right: 2.4, top: 2.4, bottom: -2.4, near: 1, far: 16 });
    key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02; key.shadow.radius = 4;
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xcfe0ff, 1.8); rim.position.set(2.5, 3, -4.5); scene.add(rim);
    scene.add(new THREE.HemisphereLight(0xdfe6ee, 0x0a0b0e, 0.35));
    const disposables: { dispose: () => void }[] = [];
    const radial = canvasTex(256, (x, n) => { const g = x.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2); g.addColorStop(0, 'rgba(46,50,58,1)'); g.addColorStop(1, 'rgba(8,9,11,0)'); x.fillStyle = g; x.fillRect(0, 0, n, n); });
    const shadowPlane = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), new THREE.ShadowMaterial({ opacity: 0.55 }));
    shadowPlane.rotation.x = -Math.PI / 2; shadowPlane.receiveShadow = true; scene.add(shadowPlane);
    const halo = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), new THREE.MeshBasicMaterial({ map: radial, transparent: true, depthWrite: false }));
    halo.rotation.x = -Math.PI / 2; halo.position.y = -0.002; scene.add(halo);
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.92, 1.935, 128), new THREE.MeshBasicMaterial({ color: 0xff7a3d, transparent: true, opacity: 0.28, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.001; scene.add(ring);
    disposables.push(radial, shadowPlane.geometry, halo.geometry, ring.geometry);

    const resize = () => {
      const w = mount.clientWidth || 800, h = height;
      renderer.setSize(w, h);
      camera.aspect = w / h; camera.fov = w / h < 1 ? 46 : 30;
      if (w / h > 1.2) camera.setViewOffset(w, h, -w * 0.13, 0, w, h); else camera.clearViewOffset();
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize); ro.observe(mount);
    const io = new IntersectionObserver((e) => { visible = e.some((x) => x.isIntersecting); }, { threshold: 0.05 });
    io.observe(mount);

    let drone: THREE.Group | null = null, baseY = 0, H = 1;
    const target = new THREE.Vector3();
    const focus: Record<string, THREE.Vector3> = {};
    const blades: { mesh: THREE.Mesh; disc: THREE.Mesh; base: THREE.Quaternion; dir: number; ang: number }[] = [];
    const leds: { gps?: { sprite: THREE.Sprite; light: THREE.PointLight }; fc?: { sprite: THREE.Sprite; light: THREE.PointLight } } = {};
    let dust: THREE.Points | null = null;
    const dustData: { a: number; r: number; v: number; y: number }[] = [];
    let t0 = 0, lastNow = 0, shotIdx = -1, lastState = '';

    loadScene(DRONE_URL).then((obj) => {
      if (disposed) return;
      const props: THREE.Mesh[] = [];
      obj.traverse((o) => {
        const m = o as THREE.Mesh; if (!m.isMesh) return;
        m.castShadow = true; m.receiveShadow = true;
        const mat = m.material as THREE.MeshStandardMaterial;
        if (mat.name === 'X500_Atlas') { mat.metalness = 0.32; mat.roughness = 1.0; mat.envMapIntensity = 1.15; mat.normalScale?.set(1.1, 1.1); if (mat.map) mat.map.anisotropy = renderer.capabilities.getMaxAnisotropy(); }
        else mat.envMapIntensity = 1.4;
        if (/propeller/i.test(m.name)) props.push(m);
      });
      const placed = placeDrone(obj);
      drone = placed.wrap; scene.add(drone);
      baseY = drone.position.y; H = placed.height; target.set(0, H * 0.45, 0);
      const s = placed.scale;
      const blurTex = canvasTex(512, (x, n) => {
        const c = n / 2; const g = x.createRadialGradient(c, c, n * 0.05, c, c, c);
        [[0, 'rgba(20,22,26,0)'], [0.1, 'rgba(20,22,26,0)'], [0.16, 'rgba(24,26,30,.55)'], [0.6, 'rgba(26,28,33,.38)'], [0.9, 'rgba(40,43,49,.30)'], [0.955, 'rgba(120,126,136,.34)'], [0.985, 'rgba(60,64,72,.12)'], [1, 'rgba(20,22,26,0)']]
          .forEach(([k, col]) => g.addColorStop(k as number, col as string));
        x.fillStyle = g; x.fillRect(0, 0, n, n);
        for (let i = 0; i < 90; i++) { const r = c * (0.2 + Math.random() * 0.76), a0 = Math.random() * Math.PI * 2; x.strokeStyle = `rgba(150,156,166,${0.03 + Math.random() * 0.06})`; x.lineWidth = 1 + Math.random() * 2; x.beginPath(); x.arc(c, c, r, a0, a0 + 0.4 + Math.random() * 1.6); x.stroke(); }
      });
      disposables.push(blurTex);
      props.forEach((p) => {
        p.material = (p.material as THREE.Material).clone(); (p.material as THREE.Material).transparent = true;
        const pb = new THREE.Box3().setFromBufferAttribute(p.geometry.attributes.position as THREE.BufferAttribute);
        const R = Math.max(pb.max.x, -pb.min.x, pb.max.z, -pb.min.z);
        const disc = new THREE.Mesh(new THREE.CircleGeometry(R * 1.02, 72), new THREE.MeshBasicMaterial({ map: blurTex, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
        disc.rotation.x = -Math.PI / 2; p.add(disc);
        blades.push({ mesh: p, disc, base: p.quaternion.clone(), dir: Math.sign(p.position.x * p.position.y) || 1, ang: Math.random() * 6.28 });
      });
      const find = (re: RegExp) => { let best: THREE.Mesh | null = null; obj.traverse((o) => { if (!best && (o as THREE.Mesh).isMesh && re.test(o.name)) best = o as THREE.Mesh; }); return best as THREE.Mesh | null; };
      const center = (m: THREE.Mesh | null, top = false) => { if (!m) return null; const b = new THREE.Box3().setFromObject(m); const v = b.getCenter(new THREE.Vector3()); if (top) v.y = b.max.y; return v; };
      focus.motor = center(find(/2216|motor/i)) ?? new THREE.Vector3(1, H * 0.6, 1);
      focus.top = center(find(/gps_m10|GPS/i)) ?? new THREE.Vector3(0, H * 0.9, 0);
      focus.core = center(find(/PIXHAWK/i)) ?? new THREE.Vector3(0, H * 0.55, 0);
      const glow = canvasTex(128, (x, n) => { const g = x.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.18, 'rgba(255,255,255,.85)'); g.addColorStop(0.45, 'rgba(255,255,255,.22)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, n, n); });
      disposables.push(glow);
      const led = (world: THREE.Vector3, color: number, size: number) => {
        const local = drone!.worldToLocal(world.clone());
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
        sprite.position.copy(local); sprite.scale.setScalar(size / s); drone!.add(sprite);
        const light = new THREE.PointLight(color, 0, 0.9, 2); light.position.copy(local); drone!.add(light);
        return { sprite, light };
      };
      const gpsTop = center(find(/gps_m10|GPS/i), true) ?? focus.top.clone();
      const pxTop = center(find(/MIANKE-PIXHAWK|PIXHAWK/i), true) ?? focus.core.clone();
      leds.gps = led(gpsTop.add(new THREE.Vector3(0, 0.012, 0)), 0x3fa0ff, 0.09);
      leds.fc = led(pxTop.add(new THREE.Vector3(0, 0.01, 0)), 0x7dff5a, 0.08);
      const N = 260; const pos = new Float32Array(N * 3);
      for (let i = 0; i < N; i++) dustData.push({ a: Math.random() * 6.283, r: 0.35 + Math.random() * 2.2, v: 0.4 + Math.random() * 0.9, y: 0.01 + Math.random() * 0.05 });
      const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const dustTex = canvasTex(64, (x, n) => { const g = x.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2); g.addColorStop(0, 'rgba(255,255,255,.9)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, n, n); });
      disposables.push(dustTex, dg);
      dust = new THREE.Points(dg, new THREE.PointsMaterial({ map: dustTex, color: 0x9aa1ab, size: 0.045, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
      scene.add(dust);
      t0 = performance.now(); lastNow = t0;
      setReady(true);
    }).catch(() => setReady(true));

    // ── coreografía (idéntica a la presentación) ──
    const TOTAL = SHOTS.reduce((a, x) => a + x.dur, 0);
    const T: number[] = []; { let acc = 0; SHOTS.forEach((x, i) => { T[i] = acc; acc += x.dur; }); }
    const ON = T[3] + 2.2, ARM = T[4] + 1.2, SPOOL = T[5] + 0.8, LIFT = T[5] + 2.6, HOVER = T[5] + 8.6, DESC = T[7] + 1.0, TOUCH = T[7] + 7.0, DISARM = T[7] + 8.4, OFF = T[8] + 3.5;
    const HOVER_H = 1.05;
    const ease = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
    const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
    const droneState = (t: number) => {
      const power = t >= ON && t < OFF ? 1 : 0;
      let rpm = 0;
      if (t >= ARM && t < SPOOL) rpm = 0.28 * smooth(ARM, ARM + 2.4, t);
      else if (t >= SPOOL && t < TOUCH) rpm = lerp(0.28, 1.0, smooth(SPOOL, SPOOL + 1.8, t)) - (t > DESC ? 0.1 * smooth(DESC, DESC + 1, t) : 0);
      else if (t >= TOUCH && t < DISARM) rpm = lerp(0.9, 0.28, smooth(TOUCH, TOUCH + 0.9, t));
      else if (t >= DISARM) rpm = 0.28 * (1 - smooth(DISARM, DISARM + 2.6, t));
      let lift = 0;
      if (t >= LIFT && t < DESC) { const up = smooth(LIFT, LIFT + 5.2, t); const over = Math.pow(Math.sin(clamp01((t - LIFT - 3.6) / 3.0) * Math.PI), 2) * 0.06; lift = HOVER_H * up + over * up; }
      else if (t >= DESC && t < TOUCH) { const k = clamp01((t - DESC) / (TOUCH - DESC)); const u = 1 - Math.pow(1 - k, 1.5); lift = HOVER_H * (1 - u * u * (3 - 2 * u)); }
      let st = 'off';
      if (power) st = t < ON + 1.6 ? 'boot' : t < ARM ? 'gps' : t < LIFT ? 'armed' : t < HOVER ? 'takeoff' : t < DESC ? 'hover' : t < TOUCH ? 'landing' : 'disarmed';
      return { rpm, lift, st };
    };
    const ledPattern = (t: number) => {
      if (t < ON || t >= OFF) return { gps: 0, fc: 0, fcColor: 0x7dff5a };
      const since = t - ON;
      const fcBoot = since < 1.6 ? (Math.sin(since * 38) > 0 ? 1 : 0.15) : 1;
      const fcColor = since < 1.6 ? 0xffffff : t >= DISARM ? 0x3f8cff : 0x7dff5a;
      const gps = since < 3.2 ? (Math.sin(since * 9) > 0.2 ? 1 : 0.1) : 0.85;
      const fade = 1 - smooth(OFF - 0.6, OFF, t);
      return { gps: gps * fade, fc: fcBoot * fade * (t >= DISARM ? (Math.sin(t * 5) > 0 ? 1 : 0.2) : 1), fcColor };
    };
    const _tg = new THREE.Vector3(), _look = new THREE.Vector3(), _q = new THREE.Quaternion(), _Y = new THREE.Vector3(0, 1, 0);
    const wob = (t: number, a: number, b: number, c: number) => Math.sin(t * a) * 0.5 + Math.sin(t * b + 1.7) * 0.3 + Math.sin(t * c + 4.1) * 0.2;

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (!drone || !visible || document.hidden) { lastNow = now; return; }
      const dt = Math.min(0.05, (now - lastNow) / 1000); lastNow = now;
      const t = (now - t0) / 1000;
      const tt = t % TOTAL;
      let acc = 0, i = 0;
      for (; i < SHOTS.length; i++) { if (tt < acc + SHOTS[i].dur) break; acc += SHOTS[i].dur; }
      const sh = SHOTS[i], k = ease(Math.min(1, (tt - acc) / sh.dur));
      if (i !== shotIdx) {
        shotIdx = i;
        const el = shotRef.current;
        if (el) { el.classList.add('swap'); setTimeout(() => { el.textContent = en ? sh.en : sh.es; el.classList.remove('swap'); }, 450); }
      }
      dipRef.current?.classList.toggle('on', sh.dur - (tt - acc) < 0.55 || tt - acc < 0.12);
      const st = droneState(tt);
      if (st.st !== lastState) { lastState = st.st; if (stateRef.current) stateRef.current.textContent = STATES[st.st][en ? 1 : 0]; }
      const air = smooth(0, 0.35, st.lift);
      const vib = 0.0012 * smooth(0.05, 0.4, st.rpm) * (1 - air);
      drone.position.set(air * (Math.sin(tt * 0.9) * 0.02 + Math.sin(tt * 2.3) * 0.006), baseY + st.lift + air * (Math.sin(tt * 1.4) * 0.018 + Math.sin(tt * 3.1) * 0.006) + vib * wob(tt, 61, 83, 97), air * Math.sin(tt * 0.7 + 1) * 0.02);
      drone.rotation.set(air * (Math.sin(tt * 1.1) * 0.012 + Math.sin(tt * 2.7) * 0.004), air * Math.sin(tt * 0.25) * 0.08, air * (Math.sin(tt * 1.3 + 2) * 0.012 + Math.sin(tt * 3.3) * 0.004));
      const omega = st.rpm < 0.3 ? (st.rpm / 0.3) * 22 : 22 + (st.rpm - 0.3) * 60;
      const blur = smooth(0.16, 0.5, st.rpm);
      blades.forEach((b) => {
        b.ang += omega * dt * b.dir;
        b.mesh.quaternion.copy(b.base).multiply(_q.setFromAxisAngle(_Y, b.ang));
        const bm = b.mesh.material as THREE.MeshStandardMaterial; bm.opacity = 1 - 0.9 * blur; bm.depthWrite = blur < 0.5;
        (b.disc.material as THREE.MeshBasicMaterial).opacity = 0.95 * blur;
      });
      const lp = ledPattern(tt);
      if (leds.gps && leds.fc) {
        leds.gps.sprite.material.opacity = lp.gps; leds.gps.light.intensity = lp.gps * 0.35;
        leds.fc.sprite.material.color.setHex(lp.fcColor); leds.fc.light.color.setHex(lp.fcColor);
        leds.fc.sprite.material.opacity = lp.fc; leds.fc.light.intensity = lp.fc * 0.3;
      }
      const wash = smooth(0.3, 0.9, st.rpm) * (1 - smooth(0.1, 1.0, st.lift));
      if (dust) {
        (dust.material as THREE.PointsMaterial).opacity = 0.42 * wash;
        if (wash > 0.01) {
          const p = (dust.geometry.attributes.position as THREE.BufferAttribute).array as Float32Array;
          dustData.forEach((d, j) => {
            d.r += d.v * dt * (0.6 + wash * 1.6); d.a += dt * 0.25;
            if (d.r > 2.8) { d.r = 0.35 + Math.random() * 0.3; d.a = Math.random() * 6.283; }
            const fade = Math.min(1, (2.8 - d.r) * 1.2);
            p[j * 3] = Math.cos(d.a) * d.r; p[j * 3 + 1] = d.y * fade; p[j * 3 + 2] = Math.sin(d.a) * d.r;
          });
          dust.geometry.attributes.position.needsUpdate = true;
        }
      }
      const th = lerp(sh.a[0], sh.b[0], k), ph = lerp(sh.a[1], sh.b[1], k), r = lerp(sh.a[2], sh.b[2], k);
      const tg = sh.tgt === 'motor' ? _tg.copy(focus.motor).setY(focus.motor.y + st.lift)
        : sh.tgt === 'top' ? _tg.copy(focus.top).lerp(focus.core, 0.4).setY(_tg.y + st.lift)
        : sh.tgt === 'drone' ? _tg.copy(target).setY(target.y + st.lift) : _tg.copy(target);
      const br = Math.sin(t * 0.7) * 0.012;
      const shake = 0.0025 * smooth(0.5, 1.0, st.rpm) * (1 - smooth(0.05, 0.4, st.lift));
      camera.position.set(tg.x + r * Math.sin(ph) * Math.sin(th) + shake * wob(t, 23, 31, 41), Math.max(0.06, tg.y + r * Math.cos(ph) + br + shake * wob(t, 27, 37, 43)), tg.z + r * Math.sin(ph) * Math.cos(th));
      if (sh.look === 'drone') { _look.copy(target).setY(target.y + st.lift); _look.lerp(tg, 0.15); camera.lookAt(_look); } else camera.lookAt(tg);
      renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      disposed = true; cancelAnimationFrame(raf); ro.disconnect(); io.disconnect();
      disposables.forEach((d) => d.dispose()); scene.environment?.dispose();
      renderer.dispose(); mount.replaceChildren();
    };
  }, [height, en]);

  const items = LORE[lang];
  return (
    <div className={`ps-root${ready ? ' ready' : ''}`} style={{ height }}>
      <div ref={mountRef} className="ps-canvas" aria-hidden="true" />
      <div className="ps-vignette" /><div className="ps-grain" /><div className="ps-frame" aria-hidden="true"><i /><i /><i /><i /></div>
      <div ref={dipRef} className="ps-dip" />
      <div className="ps-load">{en ? 'Loading model' : 'Cargando modelo'}</div>
      <div className="ps-lore" aria-hidden="true">
        <div className="lk">{en ? 'Behind the project' : 'Detrás del proyecto'}</div>
        <div className="lc">{items.map(([v, t], i) => <div key={i} className={`li${i === lore ? ' on' : ''}`}><div className="lv" dangerouslySetInnerHTML={{ __html: v }} /><div className="lt">{t}</div></div>)}</div>
        <div className="ld">{items.map((_, i) => <b key={i} className={i === lore ? 'on' : ''} />)}</div>
      </div>
      <div className="ps-title">
        <p className="ps-kicker">{en ? 'Degree defense · Multimedia Engineering · UNAD' : 'Defensa de grado · Ingeniería Multimedia · UNAD'}</p>
        <h1>TwinSight <em>X500</em></h1>
        <p className="ps-sub">{en ? 'Interactive 3D visualization for the technical inspection of the Holybro X500 V2 drone.' : 'Visualización 3D interactiva para la inspección técnica del dron Holybro X500 V2.'}</p>
        <button type="button" className="ps-cta" onClick={onStart}>{en ? 'Start the presentation' : 'Ver la presentación'} →</button>
      </div>
      <div className="ps-cam" aria-hidden="true">
        <span className="shot" ref={shotRef}>{en ? SHOTS[0].en : SHOTS[0].es}</span>
        <span>Holybro X500 V2 · {en ? 'live WebGL' : 'WebGL en vivo'}</span>
        <span className="state" ref={stateRef}>{STATES.off[en ? 1 : 0]}</span>
      </div>
      <div className="ps-bar top"><span><b>◆ TwinSight X500</b></span><span className="ps-live"><i />{en ? 'Standby' : 'En espera'}</span></div>
      <div className="ps-bar bot"><span>{en ? 'Real-time WebGL' : 'WebGL en tiempo real'}</span><span className="hide-sm">Holybro X500 V2 · 68 847 {en ? 'vertices' : 'vértices'}</span></div>
    </div>
  );
}
