/**
 * TwinsightDeck.tsx — Presentación interactiva TwinSight X500 (ciclo 31, sustituye a MiniDeck).
 * Hecha con los recursos REALES de la sustentación (E:\WebGL_tesis\Informe_final\presentation\
 * index_final_3d.html + assets/js/phaseb.js): pantalla de espera con la coreografía del dron,
 * efectos de texto (data-reveal, líneas que suben, decodificación por anagrama, contadores con
 * easing exponencial), taxonomía por pasos (dron → 28 piezas → tornillería → 257 elementos →
 * hotspots → tornillo armado pieza a pieza → 5 piezas base) y simulación térmica.
 * Cifras copiadas literalmente de la presentación. Colores: acento naranja del cotizador.
 */
import { useEffect, useRef, useState } from 'react';
import { Preshow } from './Preshow';
import { TaxonomyStage } from './TaxonomyStage';
import './twinsight.css';

type Lang = 'es' | 'en';
type T2 = [string, string];
type Stage = { mode: 'tax' | 'th'; step: number; cap?: T2 };

const fmt = (v: number, dec: number, en: boolean) => {
  const s = v.toFixed(dec); const [a, b] = s.split('.');
  const int = a.replace(/\B(?=(\d{3})+(?!\d))/g, en ? ',' : '\u202f');
  return b ? int + (en ? '.' : ',') + b : int;
};

/** animateCount del original: 1600 ms, easing exponencial. */
function Count({ to, dec = 0, on, en }: { to: number; dec?: number; on: boolean; en: boolean }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!on) { setV(0); return; }
    let raf = 0; const t0 = performance.now();
    const f = (t: number) => { const p = Math.min((t - t0) / 1600, 1); setV(to * (p === 1 ? 1 : 1 - Math.pow(2, -10 * p))); if (p < 1) raf = requestAnimationFrame(f); };
    raf = requestAnimationFrame(f);
    return () => cancelAnimationFrame(raf);
  }, [to, on]);
  return <>{fmt(on ? v : 0, dec, en)}</>;
}

/** scrambleIn del original: decodifica por anagrama los nodos de texto del elemento. */
function scrambleIn(el: HTMLElement, dur?: number) {
  const nodes: { node: Text; text: string }[] = [];
  const collect = (n: Node) => n.childNodes.forEach((c) => { if (c.nodeType === 3 && c.nodeValue?.trim()) nodes.push({ node: c as Text, text: c.nodeValue }); else if (c.nodeType === 1) collect(c); });
  collect(el);
  if (!nodes.length) return () => {};
  const total = nodes.reduce((a, x) => a + x.text.length, 0);
  const D = dur ?? Math.min(600 + total * 12, 1400);
  const t0 = performance.now(); let raf = 0;
  const frame = (t: number) => {
    const p = Math.min((t - t0) / D, 1);
    nodes.forEach(({ node, text }) => {
      const res = Math.floor(p * text.length), rest = text.slice(res);
      const pool = rest.replace(/\s/g, '').split('');
      for (let i = pool.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [pool[i], pool[j]] = [pool[j], pool[i]]; }
      let k = 0, out = text.slice(0, res);
      for (const c of rest) out += /\s/.test(c) ? c : pool[k++];
      node.nodeValue = out;
    });
    if (p < 1) raf = requestAnimationFrame(frame); else nodes.forEach(({ node, text }) => (node.nodeValue = text));
  };
  raf = requestAnimationFrame(frame);
  return () => { cancelAnimationFrame(raf); nodes.forEach(({ node, text }) => (node.nodeValue = text)); };
}

interface SlideDef { id: string; label: T2; stage?: Stage; steps?: number }
const SLIDES: SlideDef[] = [
  { id: 'cover', label: ['PORTADA', 'COVER'], stage: { mode: 'tax', step: 0 } },
  { id: 'problem', label: ['PROBLEMA', 'PROBLEM'], stage: { mode: 'tax', step: 4 } },
  { id: 'pipeline', label: ['PIPELINE', 'PIPELINE'], stage: { mode: 'tax', step: 3, cap: ['El activo que corre aquí · <b>95 617</b> triángulos, cada pieza seleccionable', 'The asset running here · <b>95,617</b> triangles, every part selectable'] } },
  { id: 'taxonomy', label: ['TAXONOMIA', 'TAXONOMY'], stage: { mode: 'tax', step: 0 }, steps: 6 },
  { id: 'thermal', label: ['THERMAL', 'THERMAL'], stage: { mode: 'th', step: 0 }, steps: 2 },
  { id: 'perf', label: ['RENDIMIENTO', 'PERFORMANCE'] },
  { id: 'sus', label: ['USABILIDAD_SUS', 'USABILITY_SUS'] },
  { id: 'close', label: ['CIERRE', 'CLOSING'], stage: { mode: 'tax', step: 0, cap: ['Holybro X500 V2 · WebGL en tiempo real, en tu navegador', 'Holybro X500 V2 · real-time WebGL, in your browser'] } },
];
// ciclo 41: la taxonomía se queda con 6 pasos (sin «30 anclas» ni «257»); TAX_MAP los lleva a los pasos de la escena 3D
const TAX_STEPS: T2[] = [['Dron', 'Drone'], ['28 piezas', '28 parts'], ['Hotspots', 'Hotspots'], ['Tornillería', 'Fasteners'], ['Tornillo', 'Screw'], ['5 piezas', '5 pieces']];
const TAX_MAP = [0, 1, 4, 5, 6, 7];

export function TwinsightDeck({ lang = 'es', liveUrl }: { lang?: Lang; liveUrl?: string }) {
  const en = lang === 'en';
  const L = (p: T2) => (en ? p[1] : p[0]);
  const [phase, setPhase] = useState<'pre' | 'deck'>('pre');
  const [i, setI] = useState(0);
  const [sub, setSub] = useState(0);
  const [armedFor, setArmedFor] = useState(-1);
  const armed = armedFor === i;
  const rootRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLSpanElement>(null);
  const sysRef = useRef<HTMLSpanElement>(null);
  const touch = useRef<number | null>(null);
  const n = SLIDES.length, s = SLIDES[i], steps = s.steps ?? 1;

  // re-dispara las transiciones de aparición en cada diapositiva
  useEffect(() => {
    if (phase !== 'deck') return;
    let r2 = 0; const r1 = requestAnimationFrame(() => { r2 = requestAnimationFrame(() => setArmedFor(i)); });
    return () => { cancelAnimationFrame(r1); cancelAnimationFrame(r2); };
  }, [i, phase]);
  // decodificación por anagrama del título y del lector SYS://
  useEffect(() => {
    if (phase !== 'deck' || !armed) return;
    const stops: (() => void)[] = [];
    const t = setTimeout(() => { if (titleRef.current) stops.push(scrambleIn(titleRef.current)); }, 390);
    if (sysRef.current) { sysRef.current.textContent = `SYS://${String(i + 1).padStart(2, '0')}_${L(s.label)}`; stops.push(scrambleIn(sysRef.current, 420)); }
    return () => { clearTimeout(t); stops.forEach((f) => f()); };
  }, [armed, i, phase, lang]);

  const go = (d: number) => {
    if (d > 0 && sub < steps - 1) { setSub(sub + 1); return; }
    if (d < 0 && sub > 0) { setSub(sub - 1); return; }
    const k = Math.max(0, Math.min(n - 1, i + d));
    if (k === i) return;
    setI(k); setSub(d < 0 ? (SLIDES[k].steps ?? 1) - 1 : 0);
  };
  const jump = (k: number) => { setI(k); setSub(0); };
  const stage: Stage | undefined = s.stage && { ...s.stage, step: s.steps ? (s.id === 'taxonomy' ? TAX_MAP[sub] ?? sub : sub) : s.stage.step };
  const act = armed ? ' active' : '';
  const scrollToQuote = () => {
    const card = rootRef.current?.closest('.cs-card');
    (card?.nextElementSibling as HTMLElement | null)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  if (phase === 'pre') {
    return (
      <div className="tw-deck" ref={rootRef} role="region" aria-label={en ? 'Interactive presentation: TwinSight X500' : 'Presentación interactiva: TwinSight X500'}>
        <Preshow lang={lang} height="100%" onStart={() => { setPhase('deck'); requestAnimationFrame(() => rootRef.current?.focus({ preventScroll: true })); }} />
      </div>
    );
  }

  const title = (es: React.ReactNode, enT: React.ReactNode, d = '.24s') => (
    <h4 className="tw-h"><span className="ln" ref={titleRef} style={{ ['--d' as string]: d }}>{en ? enT : es}</span></h4>
  );
  const kicker = (es: string, enK: string) => <p className="tw-kicker" data-reveal style={{ ['--d' as string]: '.12s' }}><span className="n">{String(i + 1).padStart(2, '0')}</span>{en ? enK : es}</p>;
  const rv = (d: number) => ({ 'data-reveal': '', style: { ['--d' as string]: `${d}s` } });

  let text: React.ReactNode = null, visual: React.ReactNode = null;
  switch (s.id) {
    case 'cover':
      text = <>
        {kicker('Defensa de grado · Ingeniería Multimedia', 'Degree defense · Multimedia Engineering')}
        {title(<>TwinSight <em>X500</em></>, <>TwinSight <em>X500</em></>, '.3s')}
        <p className="tw-p" {...rv(0.58)}>{en ? <>Turns a complex assembly into an <strong>inspectable WebGL experience</strong>.</> : <>Convierte un ensamblaje complejo en una <strong>experiencia WebGL inspeccionable</strong>.</>}</p>
        <p className="tw-p" {...rv(0.7)}>{en ? 'It makes the drone’s parts legible, how they relate and how they read, right in the browser.' : 'Hace legibles las piezas del dron, cómo se relacionan y cómo se leen, directamente en el navegador.'}</p>
        <div className="tw-metrics" {...rv(0.85)}>
          <div className="tw-metric acc"><div className="v"><Count to={95617} on={armed} en={en} /></div><span>{en ? 'triangles in the web asset' : 'triángulos en el activo web'}</span></div>
          <div className="tw-metric"><div className="v"><Count to={28} on={armed} en={en} /></div><span>{en ? 'canonical parts' : 'piezas canónicas'}</span></div>
          <div className="tw-metric"><div className="v"><Count to={91.88} dec={2} on={armed} en={en} /></div><span>SUS · n = 12</span></div>
        </div>
      </>;
      break;
    case 'problem':
      text = <>
        {kicker('Problema', 'Problem')}
        {title(<>El reto es entender cómo se <em>relacionan</em> las piezas.</>, <>The challenge is understanding how the parts <em>relate</em>.</>)}
        <div className="tw-cards">
          {([['Documentación', 'Documentation', 'Planos, manuales y referencias técnicas contienen información útil, pero repartida en soportes separados.', 'Drawings, manuals and technical references hold useful information, but it is spread across separate media.'],
            ['Fricción', 'Friction', 'El usuario reconstruye mentalmente profundidad, ubicación y ensamblaje a partir de vistas planas.', 'Users rebuild depth, location and assembly in their heads from flat views.'],
            ['Respuesta', 'Answer', 'Una capa 3D web permite ubicar, seleccionar, aislar y relacionar piezas sin abrir herramientas CAD pesadas.', 'A web 3D layer lets you locate, select, isolate and relate parts without opening heavy CAD tools.']] as const).map((c, k) => (
            <div key={k} className={`tw-card${k === 2 ? ' on' : ''}`} {...rv(0.45 + k * 0.12)}><span className="tag"><span className="n">0{k + 1}</span>{en ? c[1] : c[0]}</span><p style={{ marginTop: 6 }}>{en ? c[3] : c[2]}</p></div>
          ))}
        </div>
        <div className="tw-key" {...rv(0.85)}><b>{en ? 'Key idea' : 'Idea clave'}</b>{en ? 'The data exists. What is missing is a bridge between that data and the spatial understanding of the whole.' : 'Los datos existen. Lo que falta es un puente entre esos datos y la comprensión espacial del conjunto.'}</div>
      </>;
      break;
    case 'pipeline':
      text = <>
        {kicker('Pipeline', 'Pipeline')}
        {title(<>De <em>6,5 millones</em> a 95 617 triángulos.</>, <>From <em>6.5 million</em> to 95,617 triangles.</>)}
        <div className="tw-big" {...rv(0.45)}>
          <span className="from"><Count to={6525748} on={armed} en={en} /></span><span className="to"><Count to={95617} on={armed} en={en} /></span>
          <small>{en ? 'tessellated CAD (STEPper) → WebGL asset · −98.5%' : 'CAD teselado (STEPper) → activo WebGL · −98,5 %'}</small>
        </div>
        <div className="tw-flow" {...rv(0.6)}>
          {([['CAD STEP', 'superficies', 'surfaces'], ['STEPper', 'teselación', 'tessellation'], ['Blender', 'limpieza', 'cleanup'], ['Retopo', 'proxies', 'proxies'], ['Bake', 'normal · AO', 'normal · AO'], ['Unity', 'FBX', 'FBX'], ['WebGL', 'runtime', 'runtime']] as const).map((f, k) => (
            <span key={f[0]} style={{ display: 'contents' }}>{k > 0 && <i>→</i>}<span>{f[0]}<small>{en ? f[2] : f[1]}</small></span></span>
          ))}
        </div>
        <div className="tw-cards" style={{ gridTemplateColumns: 'repeat(2, minmax(0,1fr))' }}>
          <div className="tw-card" {...rv(0.75)}><span className="tag">{en ? 'Why optimize' : 'Por qué optimizar'}</span><p style={{ marginTop: 6 }}>{en ? 'A STEP describes mathematical surfaces. Tessellating it yields dense meshes, internal faces and repeated fasteners.' : 'Un STEP describe superficies matemáticas. Al teselarlo salen mallas densas, caras internas y tornillería repetida.'}</p></div>
          <div className="tw-card on" {...rv(0.85)}><span className="tag">{en ? 'What is kept' : 'Qué se conserva'}</span><p style={{ marginTop: 6 }}>{en ? 'Every part keeps its name and place in the hierarchy: it can be selected, isolated and separated.' : 'Cada pieza conserva su nombre y su lugar en la jerarquía: se puede seleccionar, aislar y separar.'}</p></div>
        </div>
      </>;
      break;
    case 'taxonomy': {
      const met: [number, T2, number][] = [[28, ['Piezas canónicas', 'Canonical parts'], 1]];
      const trio: [T2, T2, T2, number[]][] = [
        [['Hotspots', 'Hotspots'], ['Puntos de entrada', 'Entry points'], ['Un toque selecciona el grupo sin apuntar a una pieza diminuta.', 'One tap selects the group without aiming at a tiny part.'], [2]],
        [['Tornillería', 'Fasteners'], ['El mayor peso', 'The heaviest load'], ['425 208 triángulos: el 79 % del archivo importado. En escena, proxies de 88 triángulos o menos (14 408 en total).', '425,208 triangles: 79% of the imported file. In the scene, proxies of 88 triangles or fewer (14,408 total).'], [3]],
        [['Tornillo modular', 'Modular screw'], ['5 piezas base', '5 base pieces'], ['Al inspeccionar un tornillo, la app lo arma con cabeza, vueltas de rosca y punta. Vueltas = largo ÷ paso.', 'When a screw is inspected, the app builds it from head, thread turns and tip. Turns = length ÷ pitch.'], [4, 5]],
      ];
      text = <>
        {kicker('Taxonomía', 'Taxonomy')}
        {title(<>La taxonomía le dice a la app <em>qué tocó</em> el usuario.</>, <>The taxonomy tells the app <em>what the user touched</em>.</>)}
        <div className="tw-metrics" {...rv(0.4)}>
          {met.map(([v, l, k]) => <div key={v} className={`tw-metric${sub >= k ? ' on acc' : ' off'}`}><div className="v"><Count to={v} on={armed && sub >= k} en={en} /></div><span>{L(l)}</span></div>)}
        </div>
        {/* ciclo 32: una sola tarjeta, la del paso actual (antes 3 a la vez: alargaban la diapositiva) */}
        <div className="tw-onecard" {...rv(0.55)}>
          {(() => {
            const cur = trio.find(([, , , on]) => on.includes(sub));
            if (!cur) return <p className="tw-p" style={{ margin: 0 }}>{en ? 'Every part has a name, a group and a place: that is how the app knows what you touched. Go through the steps to see it.' : 'Cada pieza tiene nombre, grupo y lugar: así la app sabe qué tocaste. Recorre los pasos para verlo.'}</p>;
            const [tag, h, p] = cur;
            return <div key={tag[0]} className="tw-card on" style={{ animation: 'tw-card-in .5s cubic-bezier(.2,.8,.2,1) both' }}><span className="tag">{L(tag)}</span><h5>{L(h)}</h5><p>{L(p)}</p></div>;
          })()}
        </div>
        <div className="tw-substeps" role="group" aria-label={en ? 'Taxonomy steps' : 'Pasos de la taxonomía'} {...rv(0.7)}>
          {TAX_STEPS.map((t, k) => <button key={k} type="button" aria-current={k === sub} onClick={() => setSub(k)}>{k + 1} · {L(t)}</button>)}
        </div>
      </>;
      break;
    }
    case 'thermal':
      text = <>
        {kicker('Thermal', 'Thermal')}
        {title(<>Thermal estima el calor con un <em>modelo físico simplificado</em>.</>, <>Thermal estimates heat with a <em>simplified physical model</em>.</>)}
        <ul className="tw-bullets" {...rv(0.45)}>
          <li>{en ? 'Each part is a node with its own temperature.' : 'Cada pieza es un nodo con su propia temperatura.'}</li>
          <li>{en ? 'Motors, ESC and battery generate heat according to the drone’s state: off, start-up, idle or flight.' : 'Motores, ESC y batería generan calor según el estado del dron: apagado, arranque, reposo o vuelo.'}</li>
          <li>{en ? 'Heat flows between touching parts according to contact area, path length and material conductivity.' : 'El calor pasa entre piezas en contacto según el área de contacto, la longitud del camino y la conductividad.'}</li>
          <li>{en ? 'Air cools each part according to how exposed it is.' : 'El aire enfría cada pieza según cuánto está expuesta.'}</li>
        </ul>
        <div className="tw-flow" {...rv(0.65)}>
          {([[en ? 'Source' : 'Fuente', en ? 'motor · ESC · LiPo' : 'motor · ESC · LiPo'], [en ? 'conduction' : 'conducción', en ? 'area / length · k' : 'área / longitud · k'], [en ? 'Neighbor' : 'Pieza vecina', en ? 'arm · plate' : 'brazo · placa'], [en ? 'convection' : 'convección', en ? 'by exposure' : 'según exposición'], [en ? 'Air' : 'Aire', en ? 'ambient' : 'ambiente']] as const).map((f, k) => (
            <span key={k} style={{ display: 'contents' }}>{k > 0 && <i>→</i>}<span>{f[0]}<small>{f[1]}</small></span></span>
          ))}
        </div>
        <div className="tw-cta" {...rv(0.8)}>
          <button type="button" className="pri" onClick={() => setSub(sub ? 0 : 1)}>{sub ? (en ? '■ Turn off' : '■ Apagar') : (en ? '▶ Start the simulation' : '▶ Encender la simulación')}</button>
        </div>
      </>;
      break;
    case 'perf': {
      const rows: [string, number, T2][] = [[en ? 'Desktop' : 'Escritorio', 59.8, ['estable', 'stable']], ['iOS Premium', 58.7, ['estable', 'stable']], ['Redmi Note 10S', 26.5, ['funcional', 'functional']], [en ? 'Low-end Android' : 'Android gama baja', 17.6, ['límite', 'limit']]];
      text = <>
        {kicker('Rendimiento', 'Performance')}
        {title(<>El rendimiento es <em>viable</em>, pero no universal en todo móvil.</>, <>Performance is <em>viable</em>, but not universal on every phone.</>)}
        <div className="tw-cards">
          <div className="tw-card on" {...rv(0.45)}><span className="tag">{en ? 'Desktop / iOS · stable' : 'Escritorio / iOS · estable'}</span><p style={{ marginTop: 6 }}>{en ? '≈16.7–17 ms per frame (~60 FPS), well under the 33.33 ms budget (30 FPS).' : '≈16,7–17 ms por cuadro (~60 FPS), muy por debajo del presupuesto de 33,33 ms (30 FPS).'}</p></div>
          <div className="tw-card" {...rv(0.57)}><span className="tag">{en ? 'Mid-range · below target' : 'Gama media · bajo la meta'}</span><p style={{ marginTop: 6 }}>{en ? 'Redmi Note 10S: 26.5 FPS. Works in the main flow, with noticeable dips.' : 'Redmi Note 10S: 26,5 FPS. Funcional en el flujo principal, con picos perceptibles.'}</p></div>
          <div className="tw-card" {...rv(0.69)}><span className="tag">{en ? 'Low-end · operating limit' : 'Gama baja · límite operativo'}</span><p style={{ marginTop: 6 }}>{en ? 'Android Adreno 610: 17.6 FPS. Navigable, but below the 30 FPS target.' : 'Android Adreno 610: 17,6 FPS. Navegable, pero por debajo de la meta de 30 FPS.'}</p></div>
        </div>
      </>;
      visual = (
        <div className="tw-bars" data-reveal="media">
          <h6>{en ? 'Average FPS per device' : 'FPS promedio por dispositivo'}</h6>
          {rows.map(([l, f, st], k) => (
            <div key={l} className="tw-bar"><span>{l}<br /><small style={{ color: 'var(--tw-faint)', fontSize: 10.5 }}>{L(st)}</small></span>
              <div><i style={{ width: `${(f / 60) * 100}%`, background: f >= 30 ? 'var(--tw-acc)' : f >= 25 ? 'var(--tw-amber)' : 'var(--tw-faint)', ['--d' as string]: `${0.6 + k * 0.12}s` }} /></div>
              <b><Count to={f} dec={1} on={armed} en={en} /></b></div>
          ))}
          <p className="cap">┆ {en ? '30 FPS target · Unity WebGL profiler' : 'meta 30 FPS · profiler Unity WebGL'}</p>
        </div>
      );
      break;
    }
    case 'sus': {
      const R = 120, C = Math.PI * R, k = 91.88 / 100, ra = Math.PI * (1 - 0.68);
      text = <>
        {kicker('Usabilidad', 'Usability')}
        {title(<>SUS <em>91,88</em>: una recepción muy favorable.</>, <>SUS <em>91.88</em>: a very favorable reception.</>)}
        <p className="tw-p" {...rv(0.45)}>{en ? 'System Usability Scale applied to the 3D viewer with 12 people and 96 tasks.' : 'Escala SUS aplicada al visor 3D con 12 personas y 96 tareas.'}</p>
        <div className="tw-metrics" {...rv(0.6)}>
          <div className="tw-metric acc"><div className="v"><Count to={95} on={armed} en={en} /></div><span>{en ? 'median' : 'mediana'}</span></div>
          <div className="tw-metric"><div className="v">60–100</div><span>{en ? 'range' : 'rango'}</span></div>
          <div className="tw-metric"><div className="v" style={{ color: 'var(--tw-amber)' }}><Count to={68} on={armed} en={en} /></div><span>{en ? 'historical mean · context, not a pass mark' : 'media histórica · contexto, no umbral'}</span></div>
        </div>
      </>;
      visual = (
        <div className="tw-gauge" data-reveal="media">
          <svg viewBox="-150 -140 300 160" role="img" aria-label="SUS 91.88">
            <path d={`M${-R} 0 A${R} ${R} 0 0 1 ${R} 0`} fill="none" stroke="rgba(237,238,232,.08)" strokeWidth="18" strokeLinecap="round" />
            <path className="arc" d={`M${-R} 0 A${R} ${R} 0 0 1 ${R} 0`} fill="none" stroke="var(--tw-acc)" strokeWidth="18" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={armed ? C * (1 - k) : C} />
            <line x1={-Math.cos(Math.PI * 0.68) * (R - 16)} y1={-Math.sin(ra) * (R - 16)} x2={-Math.cos(Math.PI * 0.68) * (R + 16)} y2={-Math.sin(ra) * (R + 16)} stroke="var(--tw-amber)" strokeWidth="2" />
            <text x={-Math.cos(Math.PI * 0.68) * (R + 30)} y={-Math.sin(ra) * (R + 30) + 4} fontSize="12" fill="var(--tw-amber)" textAnchor="middle" fontFamily="var(--cx-mono, monospace)">68</text>
            <text x="0" y="-18" textAnchor="middle" fontSize="54" fontWeight="500" fill="var(--tw-ink)" fontFamily="var(--cx-display, system-ui)"><Count to={91.88} dec={2} on={armed} en={en} /></text>
            <text x={-R} y="18" textAnchor="middle" fontSize="11" fill="var(--tw-faint)" fontFamily="var(--cx-mono, monospace)">0</text>
            <text x={R} y="18" textAnchor="middle" fontSize="11" fill="var(--tw-faint)" fontFamily="var(--cx-mono, monospace)">100</text>
          </svg>
          <span className="cap">SUS · {en ? '3D prototype' : 'prototipo 3D'} · n = 12</span>
        </div>
      );
      break;
    }
    case 'close':
      text = <>
        {kicker('Cierre', 'Closing')}
        {title(<>De la complejidad física a la <em>legibilidad interactiva</em>.</>, <>From physical complexity to <em>interactive legibility</em>.</>)}
        <p className="tw-p" {...rv(0.45)}>{en ? 'A traceable WebGL architecture for the technical inspection of complex assemblies.' : 'Una arquitectura WebGL trazable para la inspección técnica de ensamblajes complejos.'}</p>
        <div className="tw-key" {...rv(0.6)}><b>{en ? 'For your project' : 'Para tu proyecto'}</b>{en ? 'This is what an interactive presentation can be: your product in real 3D, your data animated and your brand, in any browser with no installs. Ideal for pitches, launches, trade fairs and defenses.' : 'Así puede ser una presentación interactiva: tu producto en 3D real, tus datos animados y tu marca, en cualquier navegador y sin instalar nada. Ideal para pitches, lanzamientos, ferias y sustentaciones.'}</div>
        <div className="tw-cta" {...rv(0.75)}>
          <button type="button" className="pri" onClick={scrollToQuote}>{en ? 'Quote mine ↓' : 'Cotizar la mía ↓'}</button>
          <button type="button" onClick={() => window.dispatchEvent(new CustomEvent('cx-open-chat'))}>{en ? 'Ask the assistant' : 'Preguntar al asistente'}</button>
          {liveUrl && <a href={liveUrl} target="_blank" rel="noopener noreferrer">{en ? 'Live viewer ↗' : 'Visor en vivo ↗'}</a>}
        </div>
      </>;
      break;
  }

  return (
    <div className="tw-deck" data-snap data-snap-offset="70" ref={rootRef} tabIndex={0} role="region" aria-roledescription={en ? 'slideshow' : 'presentación'}
      aria-label={en ? 'Interactive presentation: TwinSight X500' : 'Presentación interactiva: TwinSight X500'}
      onKeyDown={(e) => {
        if ((e.target as HTMLElement).closest('button,a') && (e.key === ' ' || e.key === 'Enter')) return;
        if (['ArrowRight', 'PageDown', ' '].includes(e.key)) { e.preventDefault(); go(1); }
        if (['ArrowLeft', 'PageUp'].includes(e.key)) { e.preventDefault(); go(-1); }
      }}
      onTouchStart={(e) => { touch.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => { if (touch.current === null) return; const d = e.changedTouches[0].clientX - touch.current; if (Math.abs(d) > 60) go(d < 0 ? 1 : -1); touch.current = null; }}>
      <div className="tw-top"><span className="sys" ref={sysRef} aria-hidden="true" /><span>TwinSight X500</span></div>
      <div className="tw-progress"><i style={{ width: `${((i + (sub + 1) / steps) / n) * 100}%` }} /></div>
      <div className={`tw-body${act}`} aria-live="polite">
        <div className="tw-text" key={`t${i}`}>{text}</div>
        <div className="tw-visual" key={stage ? 'stage' : `v${i}`}>
          {stage ? <TaxonomyStage mode={stage.mode} step={stage.step} lang={lang} height="100%" cap={stage.cap ? L(stage.cap) : undefined} /> : visual}
        </div>
      </div>
      <div className="tw-nav">
        <button type="button" onClick={() => go(-1)} disabled={i === 0 && sub === 0}>← {en ? 'Previous' : 'Anterior'}</button>
        <div className="tw-dots">
          {SLIDES.map((x, k) => <button key={k} type="button" aria-label={`${k + 1} · ${L(x.label)}`} aria-current={k === i} onClick={() => jump(k)} />)}
          <span className="tw-num">{String(i + 1).padStart(2, '0')}/{String(n).padStart(2, '0')}</span>
          <span className="tw-hint">· ← → {en ? 'or swipe' : 'o desliza'}</span>
        </div>
        <button type="button" className="next" onClick={() => go(1)} disabled={i === n - 1}>{s.steps && sub < steps - 1 ? (en ? 'Step' : 'Paso') : (en ? 'Next' : 'Siguiente')} →</button>
      </div>
    </div>
  );
}
