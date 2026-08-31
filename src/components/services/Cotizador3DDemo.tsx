/**
 * Cotizador3DDemo.tsx — Demo WebGL en vivo: "qué significa cada nivel".
 *
 * Una sola pieza industrial procedural (válvula/soporte) renderizada en 5
 * calidades alineadas con los tiers del cotizador (XS→XL). El cliente NO
 * ingeniero VE la diferencia — y la pieza demuestra el oficio real del
 * servicio (Three.js/WebGL). Interacción: arrastrar=rotar, rueda=zoom,
 * botones de nivel; auto-rotación suave en reposo (respeta reduced-motion).
 *
 * Sin assets externos: geometría procedural propia, materiales estándar.
 */

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { TIER_SCOPE } from '../../data/services/galleryManifest';
import type { LevelId } from '../../data/services/types';

type Quality = Extract<LevelId, 'XS' | 'S' | 'M' | 'L' | 'XL'>;

const QUALITIES: Quality[] = ['XS', 'S', 'M', 'L', 'XL'];

const QUALITY_DESC: Record<Quality, string> = {
  XS: 'Boceto técnico: siluetas y estructura. Sirve para validar forma/tamaño.',
  S: 'Modelo simple con color plano: suficiente para diagramas y propuestas.',
  M: 'Materiales realistas y luz: el estándar para web y catálogo.',
  L: 'Acabados finos, sombras y reflejos: lista para marketing premium.',
  XL: 'Máximo detalle y ambiente: imagen de portada y campañas.',
};

/** Pieza industrial procedural: cuerpo + bridas + pernos (vale/soporte). */
function buildPart(): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(1, 1, 1.7, 48),
    new THREE.MeshStandardMaterial({ color: 0x8d97a8, metalness: 0.55, roughness: 0.45 }),
  );
  body.rotation.z = Math.PI / 2;
  g.add(body);
  const pipe = new THREE.Mesh(
    new THREE.CylinderGeometry(0.42, 0.42, 1.5, 32),
    new THREE.MeshStandardMaterial({ color: 0x9aa4b5, metalness: 0.6, roughness: 0.4 }),
  );
  pipe.rotation.x = Math.PI / 2;
  pipe.position.y = 0.55;
  g.add(pipe);
  for (const y of [-0.4, 0.4]) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.62, 0.13, 16, 48),
      new THREE.MeshStandardMaterial({ color: 0x5f6a7d, metalness: 0.7, roughness: 0.35 }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.set(0, y, 0.55);
    g.add(ring);
  }
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const bolt = new THREE.Mesh(
      new THREE.CylinderGeometry(0.055, 0.055, 0.16, 12),
      new THREE.MeshStandardMaterial({ color: 0xc9d2df, metalness: 0.85, roughness: 0.25 }),
    );
    bolt.rotation.x = Math.PI / 2;
    bolt.position.set(Math.cos(a) * 0.62, -0.4, 0.55);
    g.add(bolt);
  }
  const mount = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.9, 0.5),
    new THREE.MeshStandardMaterial({ color: 0x455066, metalness: 0.5, roughness: 0.5 }),
  );
  mount.position.set(0, 0, -0.85);
  g.add(mount);
  return g;
}

export function Cotizador3DDemo() {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    part: THREE.Group;
    lights: THREE.Object3D[];
    grid: THREE.GridHelper | null;
    shadowGround: THREE.Mesh | null;
    wire: THREE.LineSegments | null;
    raf: number;
  } | null>(null);
  const qualityRef = useRef<Quality>('M');
  const [quality, setQuality] = useState<Quality>('M');
  const [reduced] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const W = () => mount.clientWidth || 320;
    const H = () => 260;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0e1526);
    const camera = new THREE.PerspectiveCamera(38, W() / H(), 0.1, 60);
    camera.position.set(3.4, 2.2, 4.2);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(W(), H());
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.appendChild(renderer.domElement);

    const part = buildPart();
    part.position.y = 0.15;
    scene.add(part);

    const hemi = new THREE.HemisphereLight(0xdfe8ff, 0x2a3040, 0.8);
    scene.add(hemi);
    const key = new THREE.DirectionalLight(0xffffff, 2.1);
    key.position.set(4, 6, 3);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x6fa8ff, 0.9);
    rim.position.set(-4, 2, -3);
    scene.add(rim);

    const grid = new THREE.GridHelper(12, 24, 0x2c3a55, 0x1b2438);
    grid.position.y = -1.05;
    scene.add(grid);

    const shadowGround = new THREE.Mesh(
      new THREE.CircleGeometry(6, 48),
      new THREE.ShadowMaterial({ opacity: 0.35 }),
    );
    shadowGround.rotation.x = -Math.PI / 2;
    shadowGround.position.y = -1.04;
    shadowGround.receiveShadow = true;
    scene.add(shadowGround);

    const wire = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(3.2, 2.6, 2.6)),
      new THREE.LineBasicMaterial({ color: 0x35d0ff }),
    );
    wire.visible = false;
    scene.add(wire);

    // interacción: arrastrar=orbitar simple, rueda=zoom
    let dragging = false;
    let px = 0, py = 0;
    let theta = 0.6, phi = 1.12, dist = 5.6;
    const applyCamera = () => {
      camera.position.set(
        dist * Math.sin(phi) * Math.cos(theta),
        dist * Math.cos(phi),
        dist * Math.sin(phi) * Math.sin(theta),
      );
      camera.lookAt(0, 0, 0);
    };
    applyCamera();
    const el = renderer.domElement;
    el.style.touchAction = 'none';
    el.style.cursor = 'grab';
    const onDown = (e: PointerEvent) => { dragging = true; px = e.clientX; py = e.clientY; el.setPointerCapture(e.pointerId); el.style.cursor = 'grabbing'; };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      theta -= (e.clientX - px) * 0.008;
      phi = Math.min(1.45, Math.max(0.5, phi - (e.clientY - py) * 0.006));
      px = e.clientX; py = e.clientY;
      applyCamera();
    };
    const onUp = () => { dragging = false; el.style.cursor = 'grab'; };
    const onWheel = (e: WheelEvent) => { e.preventDefault(); dist = Math.min(9, Math.max(3, dist + e.deltaY * 0.004)); applyCamera(); };
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('wheel', onWheel, { passive: false });

    sceneRef.current = { renderer, scene, camera, part, lights: [hemi, key, rim], grid, shadowGround, wire, raf: 0 };

    let idleT = 0;
    const loop = (t: number) => {
      const st = sceneRef.current;
      if (!st) return;
      if (!dragging && !reduced) {
        idleT = t;
        theta += 0.0022;
        applyCamera();
      }
      renderer.render(scene, camera);
      st.raf = requestAnimationFrame(loop);
    };
    sceneRef.current.raf = requestAnimationFrame(loop);

    const ro = new ResizeObserver(() => {
      renderer.setSize(W(), H());
      camera.aspect = W() / H();
      camera.updateProjectionMatrix();
    });
    ro.observe(mount);

    return () => {
      ro.disconnect();
      const st = sceneRef.current;
      if (st) {
        cancelAnimationFrame(st.raf);
        el.removeEventListener('pointerdown', onDown);
        el.removeEventListener('pointermove', onMove);
        el.removeEventListener('pointerup', onUp);
        el.removeEventListener('wheel', onWheel);
        st.renderer.dispose();
        st.scene.traverse((o) => {
          const m = o as THREE.Mesh;
          if (m.geometry) m.geometry.dispose();
          const mat = m.material as THREE.Material | THREE.Material[] | undefined;
          if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
          else mat?.dispose();
        });
      }
      sceneRef.current = null;
      mount.replaceChildren();
    };
  }, [reduced]);

  // Calidad → materiales/luces/sombras
  useEffect(() => {
    qualityRef.current = quality;
    const st = sceneRef.current;
    if (!st) return;
    const q = quality;
    st.part.visible = q !== 'XS';
    if (st.wire) st.wire.visible = q === 'XS';
    if (st.grid) st.grid.visible = q === 'XS' || q === 'XL';
    st.shadowGround!.visible = q === 'L' || q === 'XL';
    const [hemi, key, rim] = st.lights as [THREE.HemisphereLight, THREE.DirectionalLight, THREE.DirectionalLight];
    hemi.intensity = q === 'XS' ? 1.4 : 0.8;
    key.intensity = q === 'XS' ? 0 : q === 'S' ? 1.1 : 2.1;
    key.castShadow = q === 'L' || q === 'XL';
    rim.intensity = q === 'S' ? 0 : q === 'XL' ? 1.3 : 0.9;
    st.scene.background = new THREE.Color(q === 'XL' ? 0x101a30 : 0x0e1526);
    st.part.traverse((o) => {
      const m = o as THREE.Mesh;
      const mat = m.material as THREE.MeshStandardMaterial | undefined;
      if (!mat || !('metalness' in mat)) return;
      if (q === 'S') { mat.wireframe = false; mat.metalness = 0; mat.roughness = 1; mat.flatShading = true; }
      else if (q === 'M') { mat.wireframe = false; mat.metalness = 0.35; mat.roughness = 0.6; mat.flatShading = false; }
      else if (q === 'L') { mat.wireframe = false; mat.metalness = 0.65; mat.roughness = 0.32; mat.flatShading = false; }
      else if (q === 'XL') { mat.wireframe = false; mat.metalness = 0.8; mat.roughness = 0.22; mat.flatShading = false; }
      mat.needsUpdate = true;
    });
  }, [quality]);

  return (
    <div data-noprint style={{ marginTop: 18 }}>
      <span style={{ display: 'block', fontSize: 15, fontWeight: 600, color: '#1a1d29', marginBottom: 4 }}>
        ¿Qué significa cada nivel? Verlo en vivo
      </span>
      <p style={{ margin: '0 0 10px', fontSize: 12.5, color: '#5a5e6e' }}>
        La misma pieza industrial renderizada en cada nivel de calidad. Arrastra para girar, usa la rueda para acercar.
      </p>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
        {QUALITIES.map((q) => (
          <button key={q} onClick={() => setQuality(q)}
            style={{
              padding: '6px 12px', borderRadius: 999, font: 'inherit', cursor: 'pointer',
              fontSize: 12.5, fontWeight: 700,
              border: quality === q ? '2px solid #0a84ff' : '1px solid #d5dbe8',
              background: quality === q ? '#e8f0fe' : '#fff',
              color: quality === q ? '#0a84ff' : '#44485a',
            }}>
            {q} · {TIER_SCOPE[q]?.label}
          </button>
        ))}
      </div>
      <div ref={mountRef} style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid #d5dbe8', background: '#0e1526' }} />
      <p style={{ margin: '8px 0 0', fontSize: 12, color: '#5a5e6e', lineHeight: 1.5 }}>
        <strong style={{ color: '#1a1d29' }}>{TIER_SCOPE[quality]?.label}:</strong> {QUALITY_DESC[quality]}
      </p>
    </div>
  );
}
