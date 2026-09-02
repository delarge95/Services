/**
 * ModelPreview.tsx — Previews WebGL procedurales para los sliders del cotizador.
 * Canvas transparente sin marco; reacciona en tiempo real al slider sin
 * reconstruir el contexto WebGL (stateRef + render loop).
 *
 * Ciclo 3 (feedback Alexander):
 * - detail:  slider CONTINUO — la geometría crece progresivamente entre los
 *            puntos discretos 1–5 (grupos con ventana de aparición) + contador
 *            de tris interpolado.
 * - pieces:  ensamblaje + explosión al idle 3 s.
 * - story:   replante 1.3 — catálogo de ANIMACIONES que se añaden con el slider
 *            y se reproducen en secuencia (giro, explosión, primer plano, órbita,
 *            salto, despliegue, tumble, presentación...). Timeline de chips bajo
 *            el canvas con la animación activa resaltada.
 * - variants: producto configurable. Ciclo 5: SLOTS ADITIVOS (variantSlots,
 *            cada slot una función única, se activan/apagan en vivo); el
 *            variantSel por ejes queda por compatibilidad.
 * - surface: yunque REAL (yunke.glb) con morph por influencias; el morph
 *            procedural cubo→esfera queda como fallback si el GLB falla.
 * - finish / assembly: HolyBro X500 real — instancia INDEPENDIENTE por canvas
 *            (loadHolybroInstance → clone(true)) para que el revelado por
 *            piezas de un canvas no envenene al otro (fix ciclo 5).
 */

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EN, TRIS_ETIQUETAS } from '../../data/services/i18n';
import { loadHolybroInstance, applyFinish, ensureVariadoSet, revealFrameOnly, droneStepFamily, buildAssemblyReveal, revealAssemblyList, MAX_SLIDER_PIECES } from './holybro';
import type { AssemblyEntry } from './holybro';
import type { FinishKind, VariadoSet } from './holybro';
import { loadAnvilInstance, applySurfaceMorph, ANVIL_MORPH_NODE } from './anvil';
import type { Lang } from '../../data/services/i18n';

export type PreviewMode = 'detail' | 'pieces' | 'story' | 'variants' | 'surface' | 'finish' | 'assembly' | 'hotspots' | 'shader-dial';

// ═══════════════════════════════════════════════════════════════
// Variantes (ciclo 6): 14 SLOTS sobre el DRONE HolyBro (solo el FRAME al
// inicio; batería/electrónica/plataforma se añaden como piezas desbloqueables).
// Se desbloquean con el slider, se activan/apagan en vivo. Ciclo 9: se retiran
// 'filtros-piezas' y 'color-cuaternario' (feedback Alexander); el estado
// inicial es BLANCO plano hasta encender el color base.
// ═══════════════════════════════════════════════════════════════
export type VariantSlotKind = 'color' | 'toggle' | 'luz';
export type ColorTarget = 'all' | 'motors' | 'propellers' | 'frames';
export type SlotFx = 'explode' | 'clip' | 'xray' | 'lineart' | 'flight' | 'battery' | 'electronics' | 'platform';

export interface VariantSlot {
  id: string;
  es: string;
  en: string;
  kind: VariantSlotKind;
  /** Para kind='color': qué set de meshes tiñe. */
  colorTarget?: ColorTarget;
  /** Comportamiento especial del slot. */
  fx?: SlotFx;
}

export const VARIANT_SLOTS: VariantSlot[] = [
  { id: 'color-base', es: 'Color base', en: 'Base color', kind: 'color', colorTarget: 'all' },
  { id: 'vista-explosionada', es: 'Vista explosionada', en: 'Exploded view', kind: 'toggle', fx: 'explode' },
  { id: 'color-secundario', es: 'Color secundario', en: 'Secondary color', kind: 'color', colorTarget: 'motors' },
  { id: 'color-terciario', es: 'Color terciario', en: 'Tertiary color', kind: 'color', colorTarget: 'propellers' },
  { id: 'cortes-transversales', es: 'Corte transversal', en: 'Cross-section', kind: 'toggle', fx: 'clip' },
  { id: 'pieza-adicional-1', es: 'Batería', en: 'Battery', kind: 'toggle', fx: 'battery' },
  { id: 'pieza-adicional-2', es: 'Electrónica', en: 'Electronics', kind: 'toggle', fx: 'electronics' },
  { id: 'pieza-adicional-3', es: 'Plataforma superior', en: 'Top platform', kind: 'toggle', fx: 'platform' },
  { id: 'shader-xray', es: 'Shader rayos X', en: 'Shader X-ray', kind: 'toggle', fx: 'xray' },
  { id: 'shader-lineart', es: 'Shader line-art', en: 'Shader line-art', kind: 'toggle', fx: 'lineart' },
  { id: 'animacion-vuelo', es: 'Animación de vuelo', en: 'Flight animation', kind: 'toggle', fx: 'flight' },
  { id: 'luz-estudio', es: 'Luz de estudio', en: 'Studio lighting', kind: 'luz' },
  { id: 'luz-natural', es: 'Luz natural', en: 'Natural lighting', kind: 'luz' },
  { id: 'luz-dramatica', es: 'Luz dramática', en: 'Dramatic lighting', kind: 'luz' },
];

/** Índices de slots por id (ciclo 9: los accesos por índice se rompían al
 *  reordenar los slots — ahora todo se busca por id y se valida en runtime). */
const SLOT_IDX = (id: string) => {
  const i = VARIANT_SLOTS.findIndex(s => s.id === id);
  if (i < 0) throw new Error(`VariantSlot '${id}' no existe`);
  return i;
};
const IDX_BASE = SLOT_IDX('color-base');
const IDX_EXPLODE = SLOT_IDX('vista-explosionada');
const IDX_SEC = SLOT_IDX('color-secundario');
const IDX_TER = SLOT_IDX('color-terciario');
const IDX_CLIP = SLOT_IDX('cortes-transversales');
const IDX_BAT = SLOT_IDX('pieza-adicional-1');
const IDX_ELE = SLOT_IDX('pieza-adicional-2');
const IDX_PLA = SLOT_IDX('pieza-adicional-3');
const IDX_XRAY = SLOT_IDX('shader-xray');
const IDX_LINEART = SLOT_IDX('shader-lineart');
const IDX_FLIGHT = SLOT_IDX('animacion-vuelo');
const IDX_LUZ0 = VARIANT_SLOTS.findIndex(s => s.kind === 'luz');

export interface VariantSlotsState {
  /** ON/OFF por slot (índice = posición en VARIANT_SLOTS). */
  on: boolean[];
  /** Color hex por slot de color (clave = slot.id). */
  colors: Record<string, string>;
}

/** Hex por defecto de cada slot de color. */
export const SLOT_DEFAULT_COLORS: Record<string, string> = {
  'color-base': '#22262c',
  'color-secundario': '#0071e3',
  'color-terciario': '#c9b99a',
};

/** Blanco PLANO del estado inicial (color-base OFF, ciclo 9): el drone nace
 *  blanco uniforme (#eef0f2, rugosidad 0.5, metal 0.05) hasta encender el base. */
const BLANK_HEX = '#eef0f2';
const blankMat = () => new THREE.MeshStandardMaterial({ color: 0xeef0f2, roughness: 0.5, metalness: 0.05 });

/** Catálogo de animaciones del modo story (1.3 replante). */
export const STORY_ANIMS = [
  { es: 'Giro', en: 'Spin', glyph: '↻' },
  { es: 'Explosión', en: 'Explode', glyph: '✦' },
  { es: 'Primer plano', en: 'Close-up', glyph: '⌕' },
  { es: 'Salto', en: 'Hop', glyph: '↑' },
  { es: 'Despliegue', en: 'Deploy', glyph: '✳' },
  { es: 'Tumble', en: 'Tumble', glyph: '⟳' },
  { es: 'Pulso', en: 'Pulse', glyph: '◉' },
  { es: 'Despegue', en: 'Takeoff', glyph: '▲' },
] as const;
const STORY_DURATION = 2.4; // segundos por animación

/** Interpolación del contador de tris entre etapas (trazable a POLY_POR_NIVEL). */
const POLY = [4000, 9000, 40000, 120000, 300000];
/** Ciclo 13: exportada — la consume la caption del detail en GuidedWizard
 *  (antes flotaba como overlay arriba a la derecha y confundía). */
export const polyLabel = (d: number) => {
  const f = Math.max(1, Math.min(5, d));
  const i = Math.min(3, Math.floor(f - 1));
  const frac = f - 1 - i;
  const v = POLY[i] + (POLY[i + 1] - POLY[i]) * frac;
  return `≈ ${v >= 1000 ? `${Math.round(v / 1000)}k` : Math.round(v)} tris`;
};

const smooth = (x: number) => { const t = Math.max(0, Math.min(1, x)); return t * t * (3 - 2 * t); };
/** Escala de un grupo cuya ventana de aparición es [a, b] sobre el slider d. */
const grow = (d: number, a: number, b: number) => smooth((d - a) / (b - a));

export function ModelPreview({ mode, detail = 3, pieces = 8, story = 5, surface = 1, variantSel, variantSlots, finish = 'detallado', estilo = 2, hotspots = 0, lang = 'es', height = 290 }: {
  mode: PreviewMode;
  /** Slider continuo 1–5 (detail). */
  detail?: number;
  /** Slider piezas 1–50 (pieces / assembly). */
  pieces?: number;
  /** Nº de animaciones en la línea de tiempo 1–10 (story). */
  story?: number;
  /** Slider superficie 1–5 continuo (surface): 1 = prismática, 5 = esculpida. */
  surface?: number;
  /** Selección del configurador (variants): índices de color/material/accesorio. Legado. */
  variantSel?: { c: number; m: number; a: number };
  /** Slots aditivos del configurador (variants, ciclo 5). Camino nuevo. */
  variantSlots?: VariantSlotsState;
  /** Acabado con el HolyBro X500 real (finish). */
  finish?: FinishKind;
  /** Estilo de shader 1–5 (shader-dial): 1 fotorrealista → 5 holograma. Sin uso activo. */
  estilo?: number;
  /** Nº de hotspots (hotspots, sección 3). */
  hotspots?: number;
  lang?: Lang;
  height?: number;
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const uiRef = useRef<HTMLDivElement>(null);
  const badgeRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef({ mode, detail, pieces, story, surface, variantSel, variantSlots, finish, estilo, hotspots, lang });
  stateRef.current = { mode, detail, pieces, story, surface, variantSel, variantSlots, finish, estilo, hotspots, lang };

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const st = stateRef.current;

    const scene = new THREE.Scene();
    const cam = new THREE.PerspectiveCamera(38, 1, 0.1, 60);
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    mount.appendChild(renderer.domElement);

    const hemi = new THREE.HemisphereLight(0xffffff, 0xdde4ee, 1.05);
    scene.add(hemi);
    const key = new THREE.DirectionalLight(0xffffff, 1.4); key.position.set(3, 5, 4); scene.add(key);
    const rim = new THREE.DirectionalLight(0x9ecbff, 0.8); rim.position.set(-4, 2, -3); scene.add(rim);
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;

    const group = new THREE.Group();
    scene.add(group);

    // ── Materiales compartidos ──
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xeef0f2, metalness: 0.3, roughness: 0.4 });
    const solidMat = new THREE.MeshStandardMaterial({ color: 0xdfe3e8, metalness: 0.1, roughness: 0.7, flatShading: true });
    const accentMat = new THREE.MeshStandardMaterial({ color: 0x0071e3, metalness: 0.5, roughness: 0.3 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x3a3f47, metalness: 0.6, roughness: 0.35 });
    const wireMat = new THREE.MeshBasicMaterial({ color: 0x0071e3, wireframe: true, transparent: true, opacity: 0.9 });
    const setEnv = (v: number) => { bodyMat.envMapIntensity = v; accentMat.envMapIntensity = v; darkMat.envMapIntensity = v; };

    // ═══ detail (1.1): MORPH real — edges → sólido → cuerpo suave en UNA malla ═══
    const detailRoot = new THREE.Group();
    group.add(detailRoot);
    type Part = { obj: THREE.Object3D; a: number; b: number; shrinkAt?: [number, number] };
    const detailParts: Part[] = [];
    const addPart = (obj: THREE.Object3D, a: number, b: number) => {
      obj.scale.setScalar(a <= 1 ? 1 : 0.0001);
      detailParts.push({ obj, a, b });
      detailRoot.add(obj);
    };
    // Malla única: caja merged (20 seg) que se MORPHEA a píldora en [2,3]
    const detailGeo = new THREE.BoxGeometry(1.3, 0.9, 1.0, 16, 12, 12);
    detailGeo.translate(0, 0.15, 0);
    const detailMesh = new THREE.Mesh(detailGeo, solidMat);
    detailMesh.material = solidMat.clone();
    (detailMesh.material as THREE.MeshStandardMaterial).transparent = true;
    (detailMesh.material as THREE.MeshStandardMaterial).opacity = 0;
    detailRoot.add(detailMesh);
    const detailPos0 = (detailGeo.getAttribute('position') as THREE.BufferAttribute).array.slice();
    // Aristas azules (etapa 1): el wireframe ES esta malla
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(1.3, 0.9, 1.0).translate(0, 0.15, 0)),
      new THREE.LineBasicMaterial({ color: 0x0071e3, transparent: true, opacity: 1 }),
    );
    detailRoot.add(edges);
    // Base placa (aparece rellenando en [1.5, 2.2], permanece)
    const plate = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.18, 1.4), darkMat);
    plate.position.y = -0.5;
    addPart(plate, 1.5, 2.2);
    // Tapa superior (etapa 1–2): se funde en el morph hacia la píldora
    const topBox = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.35, 0.7), solidMat);
    topBox.position.y = 0.78;
    addPart(topBox, 1.35, 2.0);
    topBox.userData.shrinkWindow = [2.0, 2.7] as [number, number];
    detailParts[detailParts.length - 1].shrinkAt = [2.0, 2.7];
    // Morph box → píldora (cuerpo suave de la etapa 3)
    const pillR = 0.52, pillHC = 0.18, pillCY = 0.32;
    const morphToPill = (t: number) => {
      const posAttr = detailMesh.geometry.getAttribute('position') as THREE.BufferAttribute;
      const arr = posAttr.array as Float32Array;
      for (let i = 0; i < arr.length; i += 3) {
        const sx = detailPos0[i], sy = detailPos0[i + 1], sz = detailPos0[i + 2];
        const yl = sy - pillCY;
        const lxz = Math.sqrt(sx * sx + sz * sz) || 1;
        let tx: number, ty: number, tz: number;
        if (Math.abs(yl) <= pillHC) {
          tx = (sx / lxz) * pillR; ty = sy; tz = (sz / lxz) * pillR;
        } else {
          const sgn = Math.sign(yl);
          const vx = sx, vy = Math.abs(yl) - pillHC, vz = sz;
          const vl = Math.sqrt(vx * vx + vy * vy + vz * vz) || 1;
          tx = (vx / vl) * pillR; ty = pillCY + sgn * (pillHC + (vy / vl) * pillR); tz = (vz / vl) * pillR;
        }
        arr[i] = sx + (tx - sx) * t;
        arr[i + 1] = sy + (ty - sy) * t;
        arr[i + 2] = sz + (tz - sz) * t;
      }
      posAttr.needsUpdate = true;
      detailMesh.geometry.computeVertexNormals();
    };
    let lastFlat = true;
    let builtDetailMode = true;
    // Etapa 4: detalles — anillo, pernos, asa
    const ring4 = new THREE.Mesh(new THREE.TorusGeometry(0.82, 0.055, 14, 52), accentMat);
    ring4.rotation.x = Math.PI / 2; ring4.position.y = -0.32;
    addPart(ring4, 2.9, 3.5);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.14, 12), darkMat);
      bolt.position.set(Math.cos(a) * 0.92, -0.42, Math.sin(a) * 0.92);
      addPart(bolt, 3.15 + i * 0.06, 3.65 + i * 0.06);
    }
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.12, 0.16), darkMat);
    handle.position.y = 1.34;
    addPart(handle, 3.6, 4.1);
    // Etapa 5: pulido
    const strip = new THREE.Mesh(new THREE.TorusGeometry(0.76, 0.028, 10, 52), accentMat);
    strip.rotation.x = Math.PI / 2; strip.position.y = 0.55;
    addPart(strip, 4.05, 4.6);
    const panel = new THREE.Mesh(new THREE.TorusGeometry(0.805, 0.012, 8, 56), darkMat);
    panel.rotation.x = Math.PI / 2; panel.position.y = 0.1;
    addPart(panel, 4.3, 4.8);
    // ciclo 11: el conjunto procedural un 10% más pequeño (detailMesh + edges
    // + placa + detalles): un solo scale en la raíz — camino menos invasivo,
    // las ventanas de aparición del slider no cambian.
    // Ciclo 13: 0.9 → 0.585 (−35%, feedback Alexander). El auto-encuadre
    // compensa la escala acercando la cámara, así que el margen de cámara del
    // modo detail sube 1.8 → 2.77 (1.8/0.65) para que la reducción se VEA.
    detailRoot.scale.setScalar(0.585);
    detailRoot.visible = true;

    // ═══ pieces (1.2): hub + ensamblaje + explosión al idle ═══
    const hub = new THREE.Group();
    const hubBase = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 1.0, 0.4, 36), darkMat); hubBase.position.y = -0.35;
    const hubBody = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.66, 0.75, 36), bodyMat); hubBody.position.y = 0.2;
    const hubCap = new THREE.Mesh(new THREE.SphereGeometry(0.6, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), accentMat); hubCap.position.y = 0.575;
    hub.add(hubBase, hubBody, hubCap);
    group.add(hub);
    const satRoot = new THREE.Group();
    group.add(satRoot);
    const PART_TYPES = [
      () => new THREE.CylinderGeometry(0.09, 0.09, 0.34, 12),
      () => new THREE.TorusGeometry(0.16, 0.055, 10, 22),
      () => new THREE.BoxGeometry(0.3, 0.12, 0.2),
      () => new THREE.CylinderGeometry(0.045, 0.045, 0.5, 8),
      () => new THREE.DodecahedronGeometry(0.15),
      () => new THREE.SphereGeometry(0.11, 14, 10),
    ];
    const MAX_VISIBLE = 18;
    type Sat = { mesh: THREE.Mesh; dir: THREE.Vector3; assembled: THREE.Vector3; born: number };
    let sats: Sat[] = [];
    let builtPieces = -1;
    let explode = 0, explodeTarget = 0;
    let lastPiecesChange = performance.now();
    const syncParts = (n: number) => {
      while (sats.length > n) { const s = sats.pop()!; satRoot.remove(s.mesh); s.mesh.geometry.dispose(); }
      while (sats.length < n) {
        const i = sats.length;
        const mesh = new THREE.Mesh(PART_TYPES[i % PART_TYPES.length](), i % 3 === 0 ? accentMat : i % 3 === 1 ? darkMat : bodyMat);
        const angle = (i / n) * Math.PI * 2 + i * 0.35;
        const radius = 1.55 + (i % 3) * 0.38;
        const pos = new THREE.Vector3(Math.cos(angle) * radius, -0.25 + (i % 4) * 0.22, Math.sin(angle) * radius);
        mesh.position.copy(pos);
        satRoot.add(mesh);
        sats.push({ mesh, dir: new THREE.Vector3(pos.x, 0.15, pos.z).normalize(), assembled: pos.clone(), born: performance.now() });
      }
      lastPiecesChange = performance.now();
      explodeTarget = 0;
    };

    // ═══ Producto compartido por story / variants ═══
    const prod = new THREE.Group();
    const pBase = new THREE.Mesh(new THREE.CylinderGeometry(0.66, 0.74, 0.2, 36), darkMat); pBase.position.y = -0.62;
    const pBody = new THREE.Mesh(new THREE.CapsuleGeometry(0.5, 0.72, 8, 28), bodyMat); pBody.position.y = 0.18;
    const pRing = new THREE.Mesh(new THREE.TorusGeometry(0.54, 0.055, 12, 40), accentMat); pRing.rotation.x = Math.PI / 2; pRing.position.y = -0.1;
    const pCap = new THREE.Mesh(new THREE.SphereGeometry(0.34, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2), accentMat); pCap.position.y = 0.82;
    prod.add(pBase, pBody, pRing, pCap);
    const storySats: THREE.Vector3[] = [];
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const s = new THREE.Mesh(i % 2 ? new THREE.CylinderGeometry(0.07, 0.07, 0.3, 10) : new THREE.SphereGeometry(0.1, 12, 8), i % 2 ? darkMat : accentMat);
      s.position.set(Math.cos(a) * 0.72, 0.1 + (i % 2) * 0.35, Math.sin(a) * 0.72);
      storySats.push(s.position.clone());
      s.userData.home = s.position.clone();
      prod.add(s);
    }
    group.add(prod);

    // ═══ surface: morph cubo→esfera ═══
    const morphRoot = new THREE.Group();
    group.add(morphRoot);
    let boxGeo: THREE.BufferGeometry = new THREE.BoxGeometry(1.5, 1.5, 1.5, 20, 20, 20);
    const morph = new THREE.Mesh(boxGeo, bodyMat);
    morphRoot.add(morph);
    let cubePos: ArrayLike<number> = (boxGeo.getAttribute('position') as THREE.BufferAttribute).array;
    const tmpV = new THREE.Vector3();
    let lastMorphT = -1;
    const applyMorph = (t01: number) => {
      const t = smooth(t01);
      const posAttr = morph.geometry.getAttribute('position') as THREE.BufferAttribute;
      const arr = posAttr.array as Float32Array;
      const radius = 1.02;
      for (let i = 0; i < arr.length; i += 3) {
        const sx = cubePos[i], sy = cubePos[i + 1], sz = cubePos[i + 2];
        const len = Math.sqrt(sx * sx + sy * sy + sz * sz) || 1;
        arr[i] = sx + ((sx / len) * radius - sx) * t;
        arr[i + 1] = sy + ((sy / len) * radius - sy) * t;
        arr[i + 2] = sz + ((sz / len) * radius - sz) * t;
      }
      posAttr.needsUpdate = true;
      morph.geometry.computeVertexNormals();
      bodyMat.metalness = 0.5 - t * 0.45;
      bodyMat.roughness = 0.3 + t * 0.5;
    };
    // Vertices compartidos (merge) para que la esfera final quede suave
    import('three/examples/jsm/utils/BufferGeometryUtils.js')
      .then(({ mergeVertices }) => {
        const merged = mergeVertices(boxGeo);
        boxGeo.dispose();
        boxGeo = merged;
        morph.geometry = merged;
        cubePos = (merged.getAttribute('position') as THREE.BufferAttribute).array;
        applyMorph((stateRef.current.surface - 1) / 4);
      })
      .catch(() => { /* sin merge, el morph funciona igual con caras separadas */ });
    applyMorph((st.surface - 1) / 4);

    // ═══ variants: producto configurable ═══
    const colorTarget = new THREE.Color(0xeef0f2);
    const matTarget = { roughness: 0.4, metalness: 0.3 };
    const VARIANT_HEX = [0x3a3f47, 0xeef0f2, 0x0071e3, 0xff6b57, 0x2e7d4f, 0xc9b99a];
    const applyVariant = (sel?: { c: number; m: number; a: number }) => {
      if (!sel) return;
      colorTarget.setHex(VARIANT_HEX[sel.c % VARIANT_HEX.length]);
      const mats = [{ r: 0.75, m: 0.05 }, { r: 0.18, m: 0.1 }, { r: 0.35, m: 0.85 }];
      matTarget.roughness = mats[sel.m % mats.length].r;
      matTarget.metalness = mats[sel.m % mats.length].m;
      pRing.visible = sel.a % 3 !== 2;
      pCap.visible = sel.a % 3 !== 1;
    };

    // ── variants SLOTS ADITIVOS (ciclo 5) ──
    // Materiales propios del modo (para no mutar los compartidos con detail/story)
    const prodParts: THREE.Mesh[] = [pBase, pBody, pRing, pCap];
    const PART_BASE_HEX = [0x3a3f47, 0xeef0f2, 0x0071e3, 0x0071e3];
    const partMats = [
      new THREE.MeshStandardMaterial({ color: PART_BASE_HEX[0], metalness: 0.6, roughness: 0.35 }),
      new THREE.MeshStandardMaterial({ color: PART_BASE_HEX[1], metalness: 0.3, roughness: 0.4 }),
      new THREE.MeshStandardMaterial({ color: PART_BASE_HEX[2], metalness: 0.5, roughness: 0.3 }),
      new THREE.MeshStandardMaterial({ color: PART_BASE_HEX[3], metalness: 0.5, roughness: 0.3 }),
    ];
    const prodOriginalMats: THREE.MeshStandardMaterial[] = [pBase.material, pBody.material, pRing.material, pCap.material];
    // slot shader-lineart: overlay de aristas por pieza
    const edgesOverlays = prodParts.map(p => {
      const e = new THREE.LineSegments(
        new THREE.EdgesGeometry(p.geometry, 25),
        new THREE.LineBasicMaterial({ color: 0x1d1d1f, transparent: true, opacity: 0.85 }),
      );
      e.visible = false;
      p.add(e);
      return e;
    });
    // slot shader-rayos-x: fresnel aditivo semitransparente
    const xrayMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
      uniforms: { uColor: { value: new THREE.Color(0x2997ff) } },
      vertexShader: `varying vec3 vN; void main(){ vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `uniform vec3 uColor; varying vec3 vN;
        void main(){ float fres = pow(1.0 - abs(normalize(vN).z), 1.8); gl_FragColor = vec4(uColor * (0.55 + fres), 0.32 + fres * 0.5); }`,
    });
    // slot shader-clay: clay plano (facetado legible)
    const claySlotMat = new THREE.MeshStandardMaterial({ color: 0xd8cfc4, roughness: 0.92, metalness: 0.0, flatShading: true });
    // slot shader-deform: posiciones base del cuerpo para el twist/wobble
    const deformBase = (pBody.geometry.getAttribute('position') as THREE.BufferAttribute).array.slice() as Float32Array;
    let deformOn = false;
    const applyDeform = (t: number, k: number) => {
      const posAttr = pBody.geometry.getAttribute('position') as THREE.BufferAttribute;
      const arr = posAttr.array as Float32Array;
      for (let i = 0; i < arr.length; i += 3) {
        const x = deformBase[i], y = deformBase[i + 1], z = deformBase[i + 2];
        const a = k * 0.85 * y + Math.sin(t * 2.2) * k * 0.05;
        const c = Math.cos(a), s = Math.sin(a);
        arr[i] = x * c - z * s + Math.sin(y * 5 + t * 2.6) * k * 0.045;
        arr[i + 1] = y;
        arr[i + 2] = x * s + z * c;
      }
      posAttr.needsUpdate = true;
      pBody.geometry.computeVertexNormals();
    };
    // Presets de iluminación (slots 11-13, excluyentes entre sí).
    // Ciclo 13: endurecidos para que se SIENTAN distintos. Dos palancas por
    // preset: (1) luces de escena (hemi/key/rim), (2) entorno — setEnv en los
    // procedurales + envMapIntensity en TODOS los materiales del drone de
    // variantes + scene.environmentIntensity (r184): el RoomEnvironment es una
    // caja de luz MUY brillante y dominaba todo — con env 0.25 el drone blanco
    // seguía en lum ~200+ y los presets eran indistinguibles (feedback
    // Alexander). dramática mueve key a ángulo bajo (y≈0.5); keyHome guarda la
    // posición original y los demás presets la restauran.
    const keyHome = key.position.clone();
    const applyDroneEnv = (v: number) => {
      if (!variantDroneReady) return;
      variantDroneReady.traverse(o => {
        const m = o as THREE.Mesh;
        if (!m.isMesh || !m.material) return;
        const mat = m.material as THREE.MeshStandardMaterial;
        if (mat.envMapIntensity !== undefined) mat.envMapIntensity = v;
      });
    };
    const applyLuzPreset = (idx: number) => {
      if (idx === 0) {        // estudio: neutra fría, sombras definidas, rim notable
        hemi.intensity = 0.5; hemi.color.setHex(0xffffff); hemi.groundColor.setHex(0xdde4ee);
        key.intensity = 1.4; key.color.setHex(0xffffff); key.position.copy(keyHome);
        rim.intensity = 1.1; rim.color.setHex(0xeaf2ff);
        renderer.toneMappingExposure = 0.7;
        scene.environmentIntensity = 0.12;
        setEnv(0.55); applyDroneEnv(0.55);
      } else if (idx === 1) { // natural: cálida dorada, suave y luminosa
        hemi.intensity = 1.6; hemi.color.setHex(0xffd9a8); hemi.groundColor.setHex(0xe7dbc8);
        key.intensity = 1.2; key.color.setHex(0xffd9a8); key.position.copy(keyHome);
        rim.intensity = 0.35; rim.color.setHex(0xffe0b8);
        renderer.toneMappingExposure = 1.5;
        scene.environmentIntensity = 1.2;
        setEnv(1.35); applyDroneEnv(1.35);
      } else if (idx === 2) { // dramática: contraste fuerte, key baja, rim azul frío
        hemi.intensity = 0.18; hemi.color.setHex(0xffffff); hemi.groundColor.setHex(0x2a2d33);
        key.intensity = 4.2; key.color.setHex(0xffffff); key.position.set(keyHome.x, 0.5, keyHome.z);
        rim.intensity = 1.2; rim.color.setHex(0x9ecbff);
        renderer.toneMappingExposure = 0.75;
        scene.environmentIntensity = 0.08;
        setEnv(0.25); applyDroneEnv(0.25);
      } else {                // neutral (sin preset activo)
        hemi.intensity = 1.05; hemi.color.setHex(0xffffff); hemi.groundColor.setHex(0xdde4ee);
        key.intensity = 1.4; key.color.setHex(0xffffff); key.position.copy(keyHome);
        rim.intensity = 0.8; rim.color.setHex(0x9ecbff);
        renderer.toneMappingExposure = 1.0;
        scene.environmentIntensity = 0.85;
        setEnv(0.9); applyDroneEnv(0.9);
      }
    };
    let lastSlotsKey = '';
    let slotsDeformWanted = false;

    // ── Yunque real (surface, ciclo 5): raíz propia + fallback procedural ──
    const anvilRoot = new THREE.Group();
    group.add(anvilRoot);
    let anvilReady: THREE.Group | null = null;
    let anvilStarted = false;
    let lastAnvilT = -1;
    function startAnvil() {
      if (anvilStarted) return;
      anvilStarted = true;
      loadAnvilInstance()
        .then(root => {
          anvilRoot.add(root);
          anvilReady = root;
          applySurfaceMorph(root, stateRef.current.surface);
          // yunque listo: visible en surface (si el modo sigue activo) y el
          // morph procedural cubo→esfera pasa a fallback oculto
          anvilRoot.visible = stateRef.current.mode === 'surface';
          if (stateRef.current.mode === 'surface') morphRoot.visible = false;
        })
        .catch(() => { anvilStarted = false; /* fallback: morph procedural cubo→esfera */ });
    }

    // Visibilidad por modo
    const applyModeVisibility = (m: PreviewMode) => {
      detailRoot.visible = m === 'detail';
      hub.visible = satRoot.visible = m === 'pieces';
      // ciclo 6: story usa el drone HolyBro real; prod queda para variants/hotspots/shaders
      prod.visible = m === 'variants' || m === 'hotspots' || m === 'shader-dial';
      // surface: yunque real si ya cargó; mientras carga (o si falla) el morph
      // procedural cubo→esfera hace de fallback
      morphRoot.visible = m === 'surface' && !anvilReady;
      anvilRoot.visible = m === 'surface' && !!anvilReady;
      storyDroneRoot.visible = m === 'story' && !!storyDroneReady;
      variantDroneRoot.visible = false;
      prod.children.forEach((c, i) => { if (i >= 4) c.visible = false; });
      if (m === 'variants') {
        // materiales propios del modo variants (no contaminan otros modos)
        [pBase, pBody, pRing, pCap].forEach((p, i) => { p.material = partMats[i]; });
        lastSlotsKey = ''; // fuerza re-aplicación del estado de slots al reentrar
        lastVariantKey = ''; // ídem para el drone de variantes
      } else {
        [pBase, pBody, pRing, pCap].forEach((p, i) => { p.material = prodOriginalMats[i]; });
        edgesOverlays.forEach(e => { e.visible = false; });
        if (deformOn) { applyDeform(0, 0); deformOn = false; slotsDeformWanted = false; }
      }
      if (m === 'variants' || m === 'shader-dial') { pRing.visible = true; pCap.visible = true; }
      if (m === 'detail') setEnv(0.9);
      // ciclo 13: salir de variants restaura el entorno base (los presets de
      // luz dejan scene.environmentIntensity en 0.18-1.25)
      scene.environmentIntensity = 1;
      if (m === 'finish' || m === 'assembly') {
        // ciclo 6: luz más moderada para que el clay no se queme (2.4→1.4 env,
        // key 3.2→2.4) y exposición 1.0 (antes 1.45/1.18).
        setEnv(1.4);
        key.intensity = 2.4;
        hemi.intensity = 1.2;
        key.position.copy(keyHome); // ciclo 13: dramática deja key baja — restaurar
        renderer.toneMappingExposure = 1.0;
        // reentrar sin remount: finish vuelve a revelar TODO (idempotente),
        // assembly recalcula las k piezas del slider
        finishRevealed = false;
        if (m === 'assembly') lastPieceCount = -1;
        startHolybro();
      } else {
        key.intensity = 1.4;
        hemi.intensity = 1.05;
        key.position.copy(keyHome); // ciclo 13: ídem
        renderer.toneMappingExposure = 1.0;
        // luces por defecto (los presets de slots solo viven en variants)
        hemi.color.setHex(0xffffff); hemi.groundColor.setHex(0xdde4ee);
        key.color.setHex(0xffffff); rim.color.setHex(0x9ecbff); rim.intensity = 0.8;
      }
      if (m === 'surface') startAnvil();
      if (m === 'story') startStoryDrone();
      if (m === 'variants') startVariantDrone();
    };

    // ═══ HolyBro X500 real: finish (acabados) + assembly (piezas) ═══
    // Cada instancia recibe SU PROPIO clone (fix: root compartido envenenaba
    // los canvas entre sí — acabados solo se veía si piezas llegaba a 50).
    const holybroRoot = new THREE.Group();
    group.add(holybroRoot);
    let holybroStarted = false;
    let holybroReady: THREE.Group | null = null;
    let variadoSet: VariadoSet | null = null;
    let lastFinish: FinishKind | null = null;
    let lastPieceCount = -1;
    // ciclo 9 — el modo finish comparte la instancia con assembly: al cargar (o
    // al reentrar sin remount) debe dejar TODO visible, no solo 1 pieza.
    let finishRevealed = false;
    // ciclo 8 — explosión con RITMO: 3 s armado → explota → 3,4 s explosionado → une
    let hbCenter = new THREE.Vector3(0, 0, 0);
    let assmList: AssemblyEntry[] = [];
    // ciclo 10 — entradas que SÍ consumen slider (las `auto` se revelan con los frames)
    let assmSlider: AssemblyEntry[] = [];
    function startHolybro() {
      if (holybroStarted) return;
      holybroStarted = true;
      loadHolybroInstance()
        .then(root => {
          holybroRoot.add(root);
          holybroReady = root;
          const rev = buildAssemblyReveal(root);
          assmList = rev.list;
          // ciclo 11: sin entradas `auto` — las instancias de los cuadrantes
          // 2-4 viajan en el `with` del frame inferior (paso 9)
          assmSlider = rev.list;
          (window as any).__assmTotal = rev.total;
          (window as any).__assmEntries = rev.list.length;
          // sonda QA ciclo 11: orden definitivo con nodo y cuadrante
          // (posición en espacio LOCAL del modelo: inmune a la rotación idle)
          (window as any).__assmList = rev.list.map(e => ({
            nodo: e.nodo ?? null, es: e.es, en: e.en, cuadrante: e.cuadrante ?? null,
            worldPos: (() => { const p = root.worldToLocal(e.mesh.getWorldPosition(new THREE.Vector3())); return [+p.x.toFixed(3), +p.y.toFixed(3), +p.z.toFixed(3)]; })(),
            meshes: 1 + (e.with?.length ?? 0),
            nombres: [e.mesh.name, ...(e.with ?? []).map(m => m.name)],
          }));
          // finish: drone COMPLETO; assembly: arranca con UNA pieza
          if (stateRef.current.mode === 'finish') {
            revealAssemblyList(assmList, Infinity);
            finishRevealed = true;
          } else {
            revealAssemblyList(assmList, 1);
          }
          // posición base de cada pieza (para la explosión) y centro del drone
          root.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) m.userData.assmHome = m.position.clone(); });
          hbCenter = new THREE.Box3().setFromObject(root).getCenter(new THREE.Vector3());
          // UNA sola aplicación inicial: assembly usa presets 'variado',
          // finish usa el acabado elegido (o 'detallado' por defecto)
          const finishFor: FinishKind = stateRef.current.mode === 'assembly'
            ? 'variado'
            : (stateRef.current.finish ?? 'detallado');
          applyFinish(root, finishFor, variadoSet);
          lastFinish = finishFor;
          lastPieceCount = -1;
          // presets 'variado' fieles a las texturas originales (async, cacheado)
          return ensureVariadoSet(root).then(set => {
            variadoSet = set;
            const cur = stateRef.current;
            if ((cur.mode === 'assembly') || (cur.mode === 'finish' && (cur.finish ?? 'detallado') === 'variado')) {
              applyFinish(root, 'variado', variadoSet);
              lastFinish = 'variado';
            }
          });
        })
        .catch(err => { holybroStarted = false; console.error('[holybro] carga fallida:', err); });
    }

    // ═══ Story drone (ciclo 6): el scrollytelling usa el HolyBro REAL en vez
    // del producto procedural. Instancia propia (clone) como finish/assembly. ═══
    const storyDroneRoot = new THREE.Group();
    group.add(storyDroneRoot);
    let storyDroneStarted = false;
    let storyDroneReady: THREE.Group | null = null;
    let storyDroneVariado: VariadoSet | null = null;
    let storyCenter = new THREE.Vector3(0, 0, 0);
    function startStoryDrone() {
      if (storyDroneStarted) return;
      storyDroneStarted = true;
      loadHolybroInstance()
        .then(root => {
          storyDroneRoot.add(root);
          storyDroneReady = root;
          applyFinish(root, 'variado', null);
          // hogares por mesh para la explosión REAL del story (ciclo 7)
          root.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) m.userData.storyHome = m.position.clone(); });
          storyCenter = new THREE.Box3().setFromObject(root).getCenter(new THREE.Vector3());
          storyDroneRoot.visible = stateRef.current.mode === 'story';
          if (stateRef.current.mode === 'story') prod.visible = false;
          return ensureVariadoSet(root).then(set => {
            storyDroneVariado = set;
            applyFinish(root, 'variado', set);
          });
        })
        .catch(err => { storyDroneStarted = false; console.error('[story drone] carga fallida:', err); });
    }

    // ═══ Variants drone (ciclo 6): el configurador usa el FRAME del HolyBro real.
    // Batería/electrónica/plataforma se añaden como piezas desbloqueables. ═══
    const variantDroneRoot = new THREE.Group();
    group.add(variantDroneRoot);
    let variantDroneStarted = false;
    let variantDroneReady: THREE.Group | null = null;
    let lastVariantKey = '';
    let varExplode = 0;
    let varFlightT0 = -1;
    const variantTintCache = new Map<string, THREE.MeshStandardMaterial>();
    const tintMat = (hex: string) => {
      let m = variantTintCache.get(hex);
      if (!m) {
        m = new THREE.MeshStandardMaterial({ color: hex, metalness: 0.3, roughness: 0.45 });
        variantTintCache.set(hex, m);
      }
      return m;
    };
    // ciclo 13: los LineSegments del line-art viven como HIJOS de su propia
    // mesh (antes se apilaban en variantEdgesGroup en la raíz SIN la transform
    // de su mesh → todas las aristas colapsaban en el origen = "mancha negra").
    const variantEdges: THREE.LineSegments[] = [];

    /** Clasifica una mesh del drone para los targets de color.
     *  base=todas · secundario=motores · terciario=hélices. El resto (tubos,
     *  frames, tren, tornillería) cae en 'frames' (set visible del frame). */
    const colorTargetOf = (step: number | undefined): ColorTarget | 'other' => {
      if (step === 0) return 'motors';
      if (step === 1) return 'propellers';
      return 'frames';
    };

    function startVariantDrone() {
      if (variantDroneStarted) return;
      variantDroneStarted = true;
      loadHolybroInstance()
        .then(root => {
          variantDroneRoot.add(root);
          variantDroneReady = root;
          (window as any).__variantReady = root.children.length;
          (window as any).__variantMeshCount = 0;
          root.traverse(o => { if ((o as THREE.Mesh).isMesh) (window as any).__variantMeshCount++; });
          revealFrameOnly(root); // estado inicial: solo el frame
          root.traverse(o => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).userData.variantHome = (o as THREE.Mesh).position.clone(); });
          variantDroneRoot.visible = false;
          return ensureVariadoSet(root).then(() => {
            // ciclo 9: ya no se aplican materiales 'variado' en variants — todo
            // material lo fija applyVariantSlots (blanco plano o tinte por slot).
            // overlays de aristas para shader-lineart (ciclo 13):
            // - cada LineSegments es HIJO del propio mesh → hereda transform
            //   (y sigue la explosión/vuelo sin código extra);
            // - umbral de EdgesGeometry 40° (menos ruido denso);
            // - solo meshes con radio de esfera envolvente (en mundo) > 0.06 —
            //   la tornillería microscópica genera ruido ilegible;
            // - color 0x9aa0a8 neutro, legible sobre blanco (tema claro) y
            //   sobre el drone oscuro (tema oscuro).
            root.updateMatrixWorld(true);
            const _ws = new THREE.Vector3();
            const meshes: THREE.Mesh[] = [];
            root.traverse(o => { if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh); });
            const edgeMat = new THREE.LineBasicMaterial({ color: 0x9aa0a8, transparent: true, opacity: 0.85 });
            for (const m of meshes) {
              if (!m.geometry.boundingSphere) m.geometry.computeBoundingSphere();
              const bs = m.geometry.boundingSphere;
              const s = m.getWorldScale(_ws);
              const r = (bs ? bs.radius : 0) * Math.max(s.x, s.y, s.z);
              if (r <= 0.06) continue;
              const e = new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry, 40), edgeMat);
              e.visible = false;
              m.add(e);
              variantEdges.push(e);
            }
          });
        })
        .catch(err => { variantDroneStarted = false; console.error('[variant drone] carga fallida:', err); });
    }

    /** Aplica el estado de slots al drone (estático: visibilidad/colores/shaders/luces). */
    const applyVariantSlots = (root: THREE.Group | null, s: VariantSlotsState) => {
      if (!root) return;
      const key = JSON.stringify(s);
      if (key === lastVariantKey) return;
      lastVariantKey = key;
      (window as any).__variantSlotsApplied = key;
      const on = (id: string) => !!s.on[SLOT_IDX(id)];

      // ── 1. visibilidad: frame + piezas extra desbloqueables ──
      // Solo meshes: si tocara grupos, el nodo raíz (paso catch-all de
      // tornillería) quedaría oculto y arrastraría a TODO el drone.
      root.traverse(o => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        const step = m.userData.step as number | undefined;
        if (step === undefined) return;
        const fam = droneStepFamily(step);
        let vis = fam === 'motors' || fam === 'propellers' || fam === 'frame';
        if (on('pieza-adicional-1')) vis = vis || fam === 'battery';
        if (on('pieza-adicional-2')) vis = vis || fam === 'electronics';
        if (on('pieza-adicional-3')) vis = vis || fam === 'platform';
        m.visible = vis;
      });

      // ── 2. colores (ciclo 9): blanco plano con base OFF; los acentos tiñen su
      // set SOLO si su slot está ON; con base ON el drone se tiñe del base y los
      // acentos van coloreando sets por encima. ──
      const baseOn = on('color-base');
      const baseHex = s.colors['color-base'] ?? '#22262c';
      const secOn = on('color-secundario');
      const terOn = on('color-terciario');
      const secHex = s.colors['color-secundario'];
      const terHex = s.colors['color-terciario'];
      root.traverse(o => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        const tgt = colorTargetOf(m.userData.step as number | undefined);
        let hex = baseOn ? baseHex : BLANK_HEX;
        if (secOn && tgt === 'motors') hex = secHex ?? hex;
        if (terOn && tgt === 'propellers') hex = terHex ?? hex;
        m.material = tintMat(hex);
      });

      // ── 3. shaders ──
      const xrayOn = on('shader-xray'), lineartOn = on('shader-lineart');
      if (xrayOn) {
        root.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) m.material = xrayMat; });
      }
      variantEdges.forEach(e => { e.visible = lineartOn; });

      // ── 4. corte transversal (clipping plane) ──
      if (on('cortes-transversales')) {
        const plane = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0);
        renderer.clippingPlanes = [plane];
        renderer.localClippingEnabled = true;
        root.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh && m.material) (m.material as THREE.Material).clippingPlanes = [plane]; });
      } else {
        renderer.clippingPlanes = [];
        root.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh && m.material) (m.material as THREE.Material).clippingPlanes = []; });
      }

      // ── 5. luces (excluyentes) ──
      applyLuzPreset(on('luz-estudio') ? 0 : on('luz-natural') ? 1 : on('luz-dramatica') ? 2 : -1);
    };

    // ── Hotspots (sección 3): marcadores que pulsan sobre el producto ──
    const markerGroup = new THREE.Group();
    group.add(markerGroup);
    const ANCHORS: Array<[number, number, number]> = [
      [0, 1.05, 0], [0.55, 0.45, 0.35], [-0.55, 0.45, 0.35], [0.55, 0.45, -0.35], [-0.55, 0.45, -0.35],
      [0.7, -0.5, 0.45], [-0.7, -0.5, 0.45], [0.7, -0.5, -0.45], [-0.7, -0.5, -0.45], [0, -0.35, 0.72],
      [0, -0.35, -0.72], [0.62, 0.1, 0], [-0.62, 0.1, 0],
    ];
    const markers = ANCHORS.map((pos, i) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.075, 14, 10), accentMat);
      m.position.set(...pos);
      m.userData.i = i;
      markerGroup.add(m);
      return m;
    });
    markerGroup.visible = false;

    // ── shader-dial: presets de material sobre el producto ──
    let toonMat: THREE.MeshToonMaterial | null = null;
    let holoMat: THREE.ShaderMaterial | null = null;
    let lastEstilo = -1;
    const stdSaved: Array<{ mesh: THREE.Mesh; mat: THREE.Material }> = [];
    const saveStd = () => {
      if (stdSaved.length) return;
      for (const m of [pBase, pBody, pRing, pCap]) stdSaved.push({ mesh: m, mat: m.material });
    };
    const gradientMap = (() => {
      const data = new Uint8Array([80, 160, 255]);
      const tex = new THREE.DataTexture(data, 3, 1, THREE.RedFormat);
      tex.needsUpdate = true;
      return tex;
    })();
    const applyEstilo = (e: number) => {
      const estilo = Math.max(1, Math.min(5, Math.round(e)));
      if (estilo === lastEstilo) return;
      lastEstilo = estilo;
      saveStd();
      if (estilo <= 3) {
        for (const { mesh, mat } of stdSaved) mesh.material = mat;
        setEnv(estilo === 1 ? 1.3 : estilo === 2 ? 0.9 : 0.7);
        bodyMat.metalness = estilo === 1 ? 0.6 : 0.3;
        bodyMat.roughness = estilo === 1 ? 0.25 : 0.45;
        bodyMat.color.setHex(estilo === 3 ? 0xf3e9d6 : 0xeef0f2);
        accentMat.emissiveIntensity = 0;
        return;
      }
      if (estilo === 4) {
        if (!toonMat) {
          toonMat = new THREE.MeshToonMaterial({ color: 0xf2f4f8, gradientMap });
        }
        const tMat = toonMat as unknown as THREE.MeshStandardMaterial;
        pBody.material = tMat; pCap.material = tMat; pBase.material = tMat;
        setEnv(0);
        return;
      }
      if (!holoMat) {
        holoMat = new THREE.ShaderMaterial({
          transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
          uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(0x2997ff) } },
          vertexShader: `varying vec3 vN; varying vec3 vP; void main(){ vN = normalize(normalMatrix * normal); vec4 wp = modelViewMatrix * vec4(position,1.0); vP = wp.xyz; gl_Position = projectionMatrix * wp; }`,
          fragmentShader: `uniform float uTime; uniform vec3 uColor; varying vec3 vN; varying vec3 vP;
            void main(){
              float fres = pow(1.0 - abs(normalize(vN).z), 2.2);
              float scan = 0.55 + 0.45 * sin((vP.y + uTime * 40.0) * 14.0);
              float a = fres * (0.35 + 0.65 * scan);
              gl_FragColor = vec4(uColor * (0.7 + fres), a * 0.9);
            }`,
        });
      }
      const hM = holoMat as unknown as THREE.MeshStandardMaterial;
      pBody.material = hM; pCap.material = hM; pBase.material = hM; pRing.material = hM;
      setEnv(0);
    };

    // ── Interacción: arrastrar para rotar + inercia ──
    let dragging = false, lastX = 0, lastY = 0;
    let rotY = 0.6, rotX = 0.12, velY = 0;
    const el = renderer.domElement;
    el.style.touchAction = 'pan-y';
    // ciclo 14: canvas es display:inline por defecto — el baseline del line box
    // deja un hueco de descender (~4-5px) bajo el canvas dentro del mount.
    // block lo elimina y el canvas ocupa exactamente su caja.
    el.style.display = 'block';
    const onDown = (e: PointerEvent) => { dragging = true; lastX = e.clientX; lastY = e.clientY; el.setPointerCapture(e.pointerId); };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      velY = (e.clientX - lastX) * 0.006;
      rotY += velY;
      rotX = Math.max(-0.5, Math.min(0.6, rotX + (e.clientY - lastY) * 0.004));
      lastX = e.clientX; lastY = e.clientY;
    };
    const onUp = () => { dragging = false; };
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);

    // ── Resize + visibilidad ──
    // ciclo 13: en móvil (wrapper < 600px, media query ≤640px) el canvas baja a
    // 240px de alto vía CSS (.cx-preview-mount) y la cámara añade aire
    // (compactMul) — antes el auto-encuadre llenaba el canvas y el modelo se
    // veía enorme/cortado en 390×844 y 360×740.
    let narrow = false;
    const resize = () => {
      const w = mount.clientWidth || 260, h = mount.clientHeight || height;
      narrow = w > 0 && w < 600;
      // ciclo 14 — centrado responsive: setSize(w, h, false) dejaba el canvas SIN
      // estilo CSS (style.width/height vacíos y ninguna regla de stylesheet lo
      // dimensionaba) → el navegador lo pintaba al tamaño del drawing-buffer
      // (mount × DPR). Con escala del SO ≠ 100% (DPR 1.25/1.5 típico de Windows,
      // 2-3 en móviles) el canvas se veía un 25-75% más grande que su contenedor:
      // desbordaba a la derecha y hacia abajo y el modelo quedaba descentrado
      // respecto a la card (baseline ciclo 14: offX +153.5px en 1280@1.25,
      // +94.5px en 390@3; en DPR=1 todo medía bien y por eso el QA anterior no
      // lo veía). setSize(w, h) fija style.width/height = tamaño CSS del mount y
      // el buffer queda w×DPR — redimensiona buffers, no reinstancia el contexto.
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75)); // re-aplicar por si el DPR cambió (zoom, mover entre monitores)
      renderer.setSize(w, h);
      cam.aspect = w / h; cam.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize); ro.observe(mount);
    let visible = true;
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; });
    io.observe(mount);

    // Inicialización de modo (tras declarar TODO lo que usa)
    applyModeVisibility(st.mode);
    if (st.mode === 'variants') applyVariant(st.variantSel);

    // ── Overlays HTML ──
    let storyActive = 0;
    let storyT0 = performance.now() / 1000;
    let lastStoryCount = -1;
    const renderUi = () => {
      const cur = stateRef.current;
      const ui = uiRef.current, badge = badgeRef.current;
      if (ui) {
        // ciclo 13: el detail ya NO usa este overlay — el contador de tris vive
        // en la caption bajo el preview (polyLabel exportada a GuidedWizard).
        // Se conservan: pieces "+N" y assembly "paso · k/total" (útiles ahí).
        if (cur.mode === 'pieces' && cur.pieces > MAX_VISIBLE) {
          ui.textContent = `+${cur.pieces - MAX_VISIBLE}`;
          ui.style.opacity = '1';
        } else {
          ui.style.opacity = '0';
        }
      }
      if (badge) {
        const exploded = cur.mode === 'pieces' && explode > 0.5;
        badge.textContent = cur.lang === 'es' ? 'Vista explosionada' : EN.wizard.exploded;
        badge.style.opacity = exploded ? '1' : '0';
      }
      const tl = timelineRef.current;
      if (tl) {
        if (cur.mode === 'story') {
          const n = Math.max(1, Math.round(cur.story));
          if (tl.childElementCount !== n) {
            tl.replaceChildren();
            for (let i = 0; i < n; i++) {
              const chip = document.createElement('span');
              chip.style.cssText = 'display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:600;padding:3px 10px;border-radius:999px;border:1px solid var(--cx-border);background:var(--cx-card-solid);color:var(--cx-muted);white-space:nowrap;transition:all .25s;pointer-events:auto;cursor:pointer;';
              chip.addEventListener('click', () => {
                // seleccionar momento: salta a reproducirlo; el ciclo continúa desde ahí
                storyActive = Math.min(i, STORY_ANIMS.length - 1);
                storyT0 = performance.now() / 1000 - storyActive * STORY_DURATION;
                lastStoryCount = n;
              });
              tl.appendChild(chip);
            }
          }
          const kids = Array.from(tl.children) as HTMLElement[];
          kids.forEach((chip, i) => {
            const anim = STORY_ANIMS[i];
            const name = anim
              ? (cur.lang === 'es' ? anim.es : anim.en)
              : `+${i - STORY_ANIMS.length + 1}`;
            const text = anim ? `${anim.glyph} ${name}` : name;
            if (chip.textContent !== text) chip.textContent = text;
            const active = i === storyActive;
            chip.style.borderColor = active ? 'var(--cx-accent)' : 'var(--cx-border)';
            chip.style.color = active ? 'var(--cx-accent)' : 'var(--cx-muted)';
            chip.style.background = active ? 'var(--cx-accent-soft)' : 'var(--cx-card-solid)';
            chip.style.transform = active ? 'translateY(-1px)' : 'none';
          });
          tl.style.opacity = '1';
        } else {
          tl.style.opacity = '0';
        }
      }
    };

    // ── Encuadre dinámico (assembly, ciclo 6): bounding sphere de piezas visibles ──
    const _v = new THREE.Vector3();
    const _c = new THREE.Vector3();
    let assmCamDist = 4.5; // distancia actual de cámara en assembly (lerped)
    const computeVisibleSphere = (root: THREE.Object3D): { center: THREE.Vector3; radius: number } => {
      const centers: THREE.Vector3[] = [];
      const radii: number[] = [];
      let cx = 0, cy = 0, cz = 0;
      // ciclo 9: una mesh cuenta SOLO si toda su cadena de ancestros es visible
      // (antes, subtrees ocultos — cubo morph, hub, prod… — inflaban la esfera
      // y alejaban la cámara del contenido real)
      const isShown = (o: THREE.Object3D | null): boolean => {
        let p = o;
        while (p) { if (!p.visible) return false; p = p.parent; }
        return true;
      };
      root.traverse(o => {
        const m = o as THREE.Mesh;
        if (!m.isMesh || !m.visible || !isShown(m)) return;
        const geo = m.geometry;
        if (!geo.boundingSphere) geo.computeBoundingSphere();
        const bs = geo.boundingSphere;
        const s = m.getWorldScale(_v);
        const r = (bs ? bs.radius : 0.5) * Math.max(s.x, s.y, s.z);
        m.getWorldPosition(_c);
        cx += _c.x; cy += _c.y; cz += _c.z;
        centers.push(_c.clone());
        radii.push(r);
      });
      if (!centers.length) return { center: new THREE.Vector3(0, 0.15, 0), radius: 1.3 };
      const centroid = new THREE.Vector3(cx / centers.length, cy / centers.length, cz / centers.length);
      let R = 0;
      for (let i = 0; i < centers.length; i++) R = Math.max(R, radii[i] + centers[i].distanceTo(centroid));
      return { center: centroid, radius: R };
    };

    // ── Loop ──
    let raf = 0;
    let frameDist = 4.8;
    const start = performance.now();
    const loop = () => {
      raf = requestAnimationFrame(loop);
      if (!visible || document.hidden) return;
      const t = (performance.now() - start) / 1000;
      const cur = stateRef.current;

      if (cur.mode !== group.userData.mode) { group.userData.mode = cur.mode; applyModeVisibility(cur.mode); }

      if (cur.mode === 'detail') {
        const d = Math.max(1, Math.min(5, cur.detail));
        // [1,2] la malla se RELLENA dentro de sus aristas; edges se desvanecen después
        const fill = grow(d, 1.0, 2.0);
        detailMesh.scale.setScalar(0.9 + 0.1 * fill);
        (detailMesh.material as THREE.MeshStandardMaterial).opacity = fill;
        (edges.material as THREE.LineBasicMaterial).opacity = 1 - grow(d, 1.7, 2.6);
        // [2,3] MORPH box → píldora (la MISMA malla se transforma)
        const mt = grow(d, 2.0, 3.0);
        morphToPill(mt);
        const wantFlat = mt < 0.45;
        if (wantFlat !== lastFlat) {
          lastFlat = wantFlat;
          const mm = detailMesh.material as THREE.MeshStandardMaterial;
          mm.flatShading = wantFlat;
          mm.needsUpdate = true;
        }
        for (const p of detailParts) {
          let sc = grow(d, p.a, p.b);
          if (p.shrinkAt) sc *= 1 - grow(d, p.shrinkAt[0], p.shrinkAt[1]);
          p.obj.scale.setScalar(Math.max(0.0001, sc));
        }
        setEnv(grow(d, 3.4, 5));
        accentMat.emissive.setHex(0x0071e3);
        accentMat.emissiveIntensity = grow(d, 4.0, 5) * 0.35;
        if (bodyMat.metalness > 0.5 || bodyMat.roughness < 0.3) { bodyMat.metalness = 0.3; bodyMat.roughness = 0.4; }
      }
      if (cur.mode === 'finish') {
        // ciclo 9: reentrada sin remount (o cambio de modo) — asegura visibilidad
        // completa UNA vez (assembly la necesita a 1 pieza, finish la comparte)
        if (holybroReady && assmList.length && !finishRevealed) {
          revealAssemblyList(assmList, Infinity);
          finishRevealed = true;
        }
        if (holybroReady && cur.finish !== lastFinish) { applyFinish(holybroReady, cur.finish, variadoSet); lastFinish = cur.finish; }
        let finVis = 0;
        if (holybroReady) holybroReady.traverse(o => { if ((o as THREE.Mesh).isMesh && o.visible) finVis++; });
        (window as any).__finishVisible = finVis;
        holybroRoot.rotation.y = t * 0.25;
      }
      if (cur.mode === 'assembly') {
        if (holybroReady && assmList.length) {
          // ciclo 10 — PIEZA A PIEZA por cuadrantes: k = piezas que consumen el
          // slider (1-50; las instancias de los cuadrantes 2-4 se revelan solas
          // con los frames y a 50 se ve TODO — etiqueta "50+")
          const k = Math.max(1, Math.min(MAX_SLIDER_PIECES, Math.round(Math.max(1, Math.min(50, cur.pieces)))));
          if (k !== lastPieceCount) { revealAssemblyList(assmList, k); lastPieceCount = k; lastPiecesChange = performance.now(); }
          const totalEntries = assmSlider.length;
          const g = assmSlider[Math.min(k, totalEntries) - 1] ?? assmList[assmList.length - 1];
          if (uiRef.current) {
            // contador visible (ciclo 11): nombre del paso + k/total-entradas;
            // "50+" muestra el modelo completo
            const kLabel = k >= MAX_SLIDER_PIECES ? `${MAX_SLIDER_PIECES}+` : `${k}`;
            uiRef.current.textContent = `${cur.lang === 'es' ? g.es : g.en} · ${kLabel}/${totalEntries}`;
            uiRef.current.style.opacity = '1';
          }
          let assmVis = 0;
          holybroReady.traverse(o => { if ((o as THREE.Mesh).isMesh && o.visible) assmVis++; });
          (window as any).__assmVisible = assmVis;
          holybroRoot.rotation.y = t * 0.25;
          // cámara SIEMPRE enfocada en las piezas visibles (lo más grande posible)
          // ciclo 10: factor 2.4→1.85 (drone ≥55% del ancho con canvas 240px)
          // ciclo 13: compactMul ×1.25 en móvil (aire, como el auto-encuadre)
          const sph = computeVisibleSphere(holybroReady);
          const asmCompact = narrow ? 1.25 : 1;
          const targetDist = Math.max(0.85, Math.min(4.2 * asmCompact, sph.radius * 1.85 * asmCompact));
          assmCamDist += (targetDist - assmCamDist) * 0.06;
          cam.position.set(sph.center.x, sph.center.y + sph.radius * 0.45, sph.center.z + assmCamDist);
          cam.lookAt(sph.center.x, sph.center.y, sph.center.z);
          // ciclo 8 — RITMO con pausas: 3 s armado → explota (1 s) → 3,4 s explosionado → une (1 s) → repite
          const idle = (performance.now() - lastPiecesChange) / 1000;
          let e = 0;
          if (idle > 3) {
            const ph = (idle - 3) % 8.4;
            e = ph < 3 ? 0 : ph < 4 ? smooth(ph - 3) : ph < 7.4 ? 1 : 1 - smooth(ph - 7.4);
          }
          holybroReady.traverse(o => {
            const m = o as THREE.Mesh;
            if (!m.isMesh || !m.visible) return;
            const home = m.userData.assmHome as THREE.Vector3 | undefined;
            if (!home) return;
            const dir = home.clone().sub(hbCenter);
            const target = home.clone().add(dir.clone().normalize().multiplyScalar(dir.length() * 0.95 * e));
            m.position.lerp(target, 0.12);
          });
        }
      }
      if (cur.mode === 'hotspots') {
        markerGroup.visible = true;
        const n = Math.max(0, Math.min(markers.length, Math.round(cur.hotspots)));
        markers.forEach((m, i) => {
          m.visible = i < n;
          if (m.visible) {
            const k = 1 + 0.35 * Math.sin(t * 3 + i * 1.4);
            m.scale.setScalar(k);
          }
        });
        if (uiRef.current) {
          uiRef.current.textContent = cur.hotspots > markers.length ? `+${cur.hotspots - markers.length}` : '';
          uiRef.current.style.opacity = cur.hotspots > markers.length ? '1' : '0';
        }
      } else {
        markerGroup.visible = false;
      }
      if (cur.mode === 'shader-dial') {
        applyEstilo(cur.estilo);
        if (holoMat) holoMat.uniforms.uTime.value = t;
        prod.rotation.y = t * 0.3;
      } else if (lastEstilo > 0) {
        applyEstilo(1);
        lastEstilo = -1;
      }
      if (cur.mode === 'pieces') {
        if (cur.pieces !== builtPieces) { syncParts(Math.min(MAX_VISIBLE, Math.max(1, cur.pieces))); builtPieces = cur.pieces; }
        const idle = (performance.now() - lastPiecesChange) / 1000;
        // ciclo 7 — desarma ↔ arma en ciclo (no queda estático desarmado)
        explode = idle > 3 ? 0.5 - 0.5 * Math.cos(((idle - 3) * Math.PI * 2) / 3.2) : 0;
        const e = explode * explode * (3 - 2 * explode);
        for (const part of sats) {
          const age = Math.min(1, (performance.now() - part.born) / 380);
          const back = 1 + 2.2 * Math.pow(age - 1, 3) + 1.2 * Math.pow(age - 1, 2);
          const target = part.assembled.clone().add(part.dir.clone().multiplyScalar(1.35 * e));
          part.mesh.position.lerp(target, 0.16);
          part.mesh.scale.setScalar(0.001 + back);
          part.mesh.rotation.y += 0.004;
        }
      }
      if (cur.mode === 'story') {
        // ciclo 7: más escenas que las del catálogo → las extra son chips '+N'
        const n = Math.max(1, Math.round(cur.story));
        if (n !== lastStoryCount) {
          storyActive = Math.min(n, STORY_ANIMS.length) - 1;
          storyT0 = performance.now() / 1000 - storyActive * STORY_DURATION;
          lastStoryCount = n;
        }
        const elapsed = performance.now() / 1000 - storyT0;
        const idx = Math.floor(elapsed / STORY_DURATION) % n;
        storyActive = idx;
        // sonda QA ciclo 9: escena activa + desplazamiento máximo de las meshes
        // respecto a su home (la explosión lo sube; las demás escenas deben
        // encontrarlo ~0 — las piezas se resetean a home cada frame)
        (window as any).__storyScene = idx;
        let maxOff = 0;
        if (storyDroneReady) storyDroneReady.traverse(o => {
          const m = o as THREE.Mesh;
          if (!m.isMesh) return;
          const home = m.userData.storyHome as THREE.Vector3 | undefined;
          if (!home) return;
          const d = m.position.distanceToSquared(home);
          if (d > maxOff) maxOff = d;
        });
        (window as any).__storyMaxOffset = Math.sqrt(maxOff);
        const p = (elapsed % STORY_DURATION) / STORY_DURATION;
        const ease = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
        // reset base del drone HolyBro
        storyDroneRoot.position.set(0, 0, 0);
        storyDroneRoot.rotation.set(0, 0, 0);
        storyDroneRoot.scale.set(1, 1, 1);
        // ciclo 9: también las MESHES individuales — la explosión (escena 1)
        // desplaza las piezas con un lerp que nunca llega exactamente a home;
        // sin este reset el drone arrastraba las piezas corridas a las escenas 2+.
        if (storyDroneReady) {
          storyDroneReady.traverse(o => {
            const m = o as THREE.Mesh;
            if (!m.isMesh) return;
            const home = m.userData.storyHome as THREE.Vector3 | undefined;
            if (home && m.position.distanceToSquared(home) > 1e-10) m.position.copy(home);
          });
        }
        cam.position.set(0, 1.0, 4.8);
        cam.lookAt(0, 0.15, 0);
        // hélices girando sobre su eje vertical (despegue/giro/extra)
        // ciclo 9: por nombre efectivo — las sub-mallas 'mesh.002' de las
        // hélices llevan el nombre real en el nodo padre
        const spinProps = (k: number) => {
          if (!storyDroneReady) return;
          storyDroneReady.traverse(o => {
            const m = o as THREE.Mesh;
            if (m.isMesh && (/propeller/i.test(m.name ?? '') || /propeller/i.test(m.parent?.name ?? ''))) m.rotation.y += k;
          });
        };
        switch (idx) {
          case 0: spinProps(0.35); storyDroneRoot.rotation.y = ease * Math.PI * 2; break;
          case 1: {
            // ciclo 7 — Explosión REAL: la vista explosionada de las piezas del HolyBro
            // ciclo 9: posición DETERMINÍSTICA (copy, no lerp) — el reset de home
            // por frame amortiguaría el lerp acumulativo a solo su primer 18%;
            // el desplazamiento sigue la envolvente k = sin(p·π) de la escena.
            const k = Math.sin(p * Math.PI);
            if (storyDroneReady) {
              storyDroneReady.traverse(o => {
                const m = o as THREE.Mesh;
                if (!m.isMesh) return;
                const home = m.userData.storyHome as THREE.Vector3 | undefined;
                if (!home) return;
                const dir = home.clone().sub(storyCenter);
                const target = home.clone().add(dir.clone().normalize().multiplyScalar(dir.length() * 1.1 * k));
                m.position.copy(target);
              });
            }
            break;
          }
          case 2: cam.position.set(0.5, 0.9, 3.2 - Math.sin(p * Math.PI) * 0.8); cam.lookAt(0, 0.3, 0); break;
          case 3: { const k = Math.abs(Math.sin(p * Math.PI * 2)); storyDroneRoot.position.y = k * 0.6; storyDroneRoot.scale.set(1 + (1 - k) * 0.1, 1 - (1 - k) * 0.15, 1 + (1 - k) * 0.1); break; }
          case 4: { const k = Math.sin(p * Math.PI); storyDroneRoot.scale.setScalar(1 + k * 0.5); storyDroneRoot.rotation.y = ease * Math.PI; break; }
          case 5: storyDroneRoot.rotation.x = ease * Math.PI * 1.4; storyDroneRoot.rotation.y = ease * 0.8; break;
          case 6: { const k = Math.sin(p * Math.PI * 3); storyDroneRoot.scale.setScalar(1 + k * 0.06); break; }
          case 7: {
            // Despegue: spin-up con vibración → subida → levitación, hélices girando
            const spinUp = smooth(Math.min(1, p / 0.35));
            const climb = smooth(Math.max(0, (p - 0.25) / 0.5));
            const vibe = spinUp * (1 - climb) * 0.03;
            const y = climb * climb * 1.1 + Math.sin(t * 55) * vibe;
            storyDroneRoot.position.y = climb >= 1 ? 1.1 + Math.sin(t * 2.2) * 0.06 : y;
            storyDroneRoot.rotation.z = Math.sin(t * 40) * vibe * 0.4;
            storyDroneRoot.rotation.x = Math.sin(t * 33) * vibe * 0.4;
            spinProps(0.25 + climb * 0.65);
            break;
          }
          default: spinProps(0.3); break; // escenas extra (+N): giro suave con hélices
        }
        if (idx !== 6) accentMat.emissiveIntensity = 0;
      }
      if (cur.mode === 'surface') {
        // sonda QA ciclo 9: indica si el GLB real del yunque cargó (vs fallback)
        (window as any).__surfaceAnvil = !!anvilReady;
        if (anvilReady) {
          // yunque real: influencias de morph continuas y bidireccionales
          if (Math.abs(cur.surface - lastAnvilT) > 0.004) { applySurfaceMorph(anvilReady, cur.surface); lastAnvilT = cur.surface; }
        } else {
          // fallback procedural cubo→esfera (si el GLB del yunque no carga)
          const t01 = (Math.max(1, Math.min(5, cur.surface)) - 1) / 4;
          if (Math.abs(t01 - lastMorphT) > 0.0005) { applyMorph(t01); lastMorphT = t01; }
        }
      }
      if (cur.mode === 'variants') {
        if (cur.variantSlots) {
          // ciclo 6: slots sobre el drone HolyBro (frame + piezas extra desbloqueables)
          prod.visible = false;
          variantDroneRoot.visible = !!variantDroneReady;
          (window as any).__variantRootVisible = variantDroneRoot.visible;
          (window as any).__variantVisMesh = 0;
          if (variantDroneReady) variantDroneReady.traverse(o => { if ((o as THREE.Mesh).isMesh && o.visible) (window as any).__variantVisMesh++; });
          applyVariantSlots(variantDroneReady, cur.variantSlots);
          // debug: material real de las primeras meshes visibles
          (window as any).__variantFinalMats = [];
          if (variantDroneReady) {
            let cnt = 0;
            variantDroneReady.traverse(o => {
              const m = o as THREE.Mesh;
              if (!m.isMesh || !m.visible) return;
              if (cnt++ < 5) (window as any).__variantFinalMats.push(`${m.name}:${m.material ? ((m.material as THREE.MeshStandardMaterial).color ? '#'+(m.material as THREE.MeshStandardMaterial).color.getHexString() : 'noColor') : 'null'}:op${m.material ? (m.material as THREE.MeshStandardMaterial).opacity : '?'}`);
            });
          }
          // sonda QA ciclo 9: las hélices DEBEN verse en el estado inicial blanco
          (window as any).__variantPropVisible = false;
          if (variantDroneReady) {
            variantDroneReady.traverse(o => {
              const m = o as THREE.Mesh;
              if (m.isMesh && m.visible && (/propeller/i.test(m.name ?? '') || /propeller/i.test(m.parent?.name ?? ''))) (window as any).__variantPropVisible = true;
            });
          }
          // vista explosionada (slot por id): separación radial continua con ease
          const wantExplode = cur.variantSlots.on[IDX_EXPLODE] ? 1 : 0;
          varExplode += (wantExplode - varExplode) * 0.06;
          const e = varExplode * varExplode * (3 - 2 * varExplode);
          if (variantDroneReady) {
            variantDroneReady.traverse(o => {
              const m = o as THREE.Mesh;
              if (!m.isMesh || !m.visible) return;
              const home = m.userData.variantHome as THREE.Vector3 | undefined;
              if (!home) return;
              const len = home.length();
              if (len < 0.001) { m.position.lerp(home, 0.12); return; }
              const target = home.clone().add(home.clone().normalize().multiplyScalar(len * 0.7 * e));
              m.position.lerp(target, 0.12);
            });
          }
          // animación de vuelo (slot por id): spin-up de hélices + levitación
          if (cur.variantSlots.on[IDX_FLIGHT]) {
            if (varFlightT0 < 0) varFlightT0 = t;
            const ft = t - varFlightT0;
            const spin = Math.min(1, ft / 0.8);
            const rise = smooth(Math.min(1, ft / 1.4));
            variantDroneRoot.position.y = rise * rise * 0.9 + Math.sin(t * 2) * 0.04;
            if (variantDroneReady) {
              variantDroneReady.traverse(o => {
                const m = o as THREE.Mesh;
                if (!m.isMesh) return;
                if (droneStepFamily(m.userData.step as number | undefined) === 'propellers') m.rotation.y += 0.5 * spin;
              });
            }
          } else {
            varFlightT0 = -1;
            variantDroneRoot.position.y = 0;
          }
        } else if (cur.variantSel) {
          // legado (sección 3 de config): ejes color/material/accesorio
          prod.visible = true;
          variantDroneRoot.visible = false;
          applyVariant(cur.variantSel);
          pBody.material.color.lerp(colorTarget, 0.12);
          pBody.material.roughness += (matTarget.roughness - pBody.material.roughness) * 0.12;
          pBody.material.metalness += (matTarget.metalness - pBody.material.metalness) * 0.12;
        }
      }

      if (!dragging && cur.mode !== 'story') {
        velY *= 0.94;
        rotY += 0.0035 + velY;
      }
      group.rotation.y += (rotY - group.rotation.y) * 0.12;
      group.rotation.x += (rotX - group.rotation.x) * 0.12;
      if (cur.mode !== 'story' && cur.mode !== 'assembly') {
        // ciclo 8 — AUTO-ENCUADRE por contenido: la cámara se acerca hasta que el
        // modelo llena el canvas. Ciclo 10 — margen 2.35→1.5 (Alexander: "el
        // drone sigue pequeño"): con canvas 240px el drone llena ~50-70% del
        // ancho sin cortarse (medido: 1.3 cortaba el finish en los laterales;
        // el yunque conserva su 1.06 medido en ciclo 9).
        // Ciclo 11 — canvas 290px: el modo 'detail' (contenido más ALTO respecto
        // a su radio: placa + asa + anillo) tocaba ambos bordes (99% medido) →
        // margen propio 1.8; el resto conserva 1.5 (finish 82%, surface 90%).
        // Ciclo 13 — (a) surface 1.06→1.5 y detail 1.8→3.8: el auto-encuadre
        // anula los cambios de ESCALA (acercan la cámara en la misma proporción),
        // así que la reducción real del yunque (−25%) y del conjunto detail
        // (−35%) se obtiene AUMENTANDO el margen — calibrado con capturas:
        // detail-5 baja de ~86% a ~54% del alto del canvas, el yunque de ~91%
        // a ~67%. (b) compactMul ×1.25 en móvil (wrapper < 600px): el modelo
        // queda completo, con aire y sin verse gigante en 390/360 px.
        // Ciclo 13b (feedback: "modelos ligeramente a la derecha, en movil
        // excesivamente" + "yunque mas pequeno en movil"): (a) la camara se
        // centra en sph.center.x (antes x=0 FIJO: la geometria del contenido
        // no esta centrada en el eje de giro y el modelo quedaba sesgado a un
        // lado, mas notorio en movil). (b) surface 1.5 -> 2.1 en desktop y un
        // extra x1.3 en narrow: el yunque (base ancha) llenaba 74% del ancho
        // en 390px; ahora 56% (medido, rotacion congelada). El barrido
        // lateral del yunque al girar se elimino recentrando su GEOMETRIA en
        // anvil.ts (pivote = centro visual).
        const sph = computeVisibleSphere(group);
        const compactMul = narrow ? 1.25 : 1;
        const baseMargin = cur.mode === 'surface' ? 2.1 : cur.mode === 'detail' ? 3.8 : 1.5;
        const anvilNarrow = cur.mode === 'surface' && narrow ? 1.3 : 1;
        const margin = baseMargin * compactMul * anvilNarrow;
        const minDist = cur.mode === 'surface' ? 1.0 : 1.2;
        const targetDist = Math.max(minDist, Math.min(7 * compactMul, sph.radius * margin));
        frameDist += (targetDist - frameDist) * 0.08;
        cam.position.set(sph.center.x, sph.center.y + sph.radius * 0.22, sph.center.z + frameDist);
        cam.lookAt(sph.center.x, sph.center.y, sph.center.z);
      }
      renderer.render(scene, cam);
      renderUi();
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect(); io.disconnect();
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
      renderer.dispose(); pmrem.dispose(); envTex.dispose();
      // las geometrías de los GLB (glbShared) se COMPARTEN entre clones vía la
      // caché del loader — no se disposean aquí o romperían las otras instancias
      scene.traverse(o => {
        const m = o as THREE.Mesh;
        if (m.geometry && !(m.userData && (m.userData as { glbShared?: boolean }).glbShared)) m.geometry.dispose();
      });
      mount.replaceChildren();
    };
  }, [height]);

  return (
    // ciclo 11 — horizontal: el wrapper se DUPLICA respecto a la card (2×680,
    // techo 1360, nunca más ancho que el viewport) y sangra por ambos lados
    // con overflow visible — sangrado intencional, sombra limpia. En móvil
    // (≤640px) vuelve al 100% para no romper el layout.
    <div className="cx-preview-wrap">
      <style>{`
        .cx-preview-wrap {
          --pw: min(1360px, calc(200% + 48px), calc(100vw - 32px));
          position: relative; width: var(--pw);
          margin-left: calc((100% - var(--pw)) / 2);
        }
        @media (max-width: 640px) { .cx-preview-wrap { --pw: 100%; } }
        /* ciclo 13 — móvil: canvas 240px de alto (antes 290). El wrapper ya
           colapsa a 100% en ≤640px; el ResizeObserver del preview recalcula
           el tamaño del canvas cuando el alto cambia. */
        @media (max-width: 640px) { .cx-preview-mount { height: 240px !important; } }
      `}</style>
      <div ref={mountRef} className="cx-preview-mount" style={{ width: '100%', height, cursor: 'grab' }} aria-hidden="true" />
      <div ref={uiRef} style={{
        position: 'absolute', top: 6, right: 6, fontSize: 11, fontWeight: 600, color: 'var(--cx-muted)',
        fontVariantNumeric: 'tabular-nums', opacity: 0, transition: 'opacity 0.3s', pointerEvents: 'none',
      }} />
      <div ref={badgeRef} style={{
        position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)', whiteSpace: 'nowrap',
        fontSize: 11, fontWeight: 600, color: 'var(--cx-accent)', background: 'var(--cx-accent-soft)',
        padding: '2px 10px', borderRadius: 999, opacity: 0, transition: 'opacity 0.4s', pointerEvents: 'none',
      }} />
      {/* Timeline de animaciones (modo story) — indicadores, no un segundo control.
          Ciclo 13: limitado al ancho de la CARD (max-width 640px = card 680 − padding,
          y ≤ wrapper en pantallas chicas) y centrado sobre ella — antes vivía a lo
          ancho del wrapper de 1360px que SANGRA la card y con 15 escenas los chips
          desbordaban horizontalmente. flexWrap ya envuelve. */}
      <div ref={timelineRef} style={{
        display: 'flex', gap: 5, flexWrap: 'wrap', justifyContent: 'center',
        maxWidth: 'min(100%, 640px)', margin: '6px auto 0',
        opacity: 0, transition: 'opacity 0.3s', pointerEvents: 'none', minHeight: 22,
      }} />
      <div style={{
        width: '58%', height: 12, margin: '-6px auto 0', borderRadius: '50%',
        background: 'radial-gradient(ellipse at center, var(--cx-obj-shadow) 0%, transparent 70%)',
      }} />
    </div>
  );
}
