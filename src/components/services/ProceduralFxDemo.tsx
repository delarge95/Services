/**
 * ProceduralFxDemo.tsx — Demo EN VIVO de VFX-04 (ciclo 42): efectos generados en el navegador con un solo
 * fragment shader (WebGL 1, sin dependencias). Tres presets (humo, partículas, energía) que reaccionan al cursor,
 * con intensidad y color ajustables: exactamente lo que se entrega en el servicio, sin render por shot.
 * Sin cursor encima, el «cursor» del efecto describe una curva lenta para que nunca esté quieto.
 */
import { useEffect, useRef, useState } from 'react';

type Lang = 'es' | 'en';
const MODES = [
  { id: 0, es: 'Humo', en: 'Smoke' },
  { id: 1, es: 'Partículas', en: 'Particles' },
  { id: 2, es: 'Energía', en: 'Energy' },
] as const;
const COLORS = [
  { id: 'ember', rgb: [1.0, 0.48, 0.24], es: 'Brasa', en: 'Ember' },
  { id: 'signal', rgb: [0.35, 0.78, 0.98], es: 'Señal', en: 'Signal' },
  { id: 'ink', rgb: [0.93, 0.93, 0.91], es: 'Tinta', en: 'Ink' },
] as const;

const VERT = `attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }`;
const FRAG = `precision highp float;
uniform vec2 uRes; uniform float uT, uMode, uAmt; uniform vec2 uM; uniform vec3 uCol;
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++) { s += a * n(p); p = p * 2.03 + 11.7; a *= 0.5; } return s; }
void main(){
  vec2 uv = gl_FragCoord.xy / uRes; float asp = uRes.x / uRes.y;
  vec2 q = vec2(uv.x * asp, uv.y), m = vec2(uM.x * asp, uM.y);
  vec2 d = q - m; float r = length(d);
  vec3 bg = vec3(0.027, 0.031, 0.04); vec3 col = bg;
  if (uMode < 0.5) {
    // humo: ruido con deformación de dominio que sube; el cursor lo empuja y lo arremolina
    vec2 sw = vec2(-d.y, d.x) * exp(-r * 6.0) * 1.6;
    vec2 p = q * 2.2 + sw - vec2(0.0, uT * 0.18);
    vec2 w = vec2(fbm(p + uT * 0.05), fbm(p + 5.2 - uT * 0.04));
    float s = fbm(p + 2.4 * w);
    float dens = smoothstep(0.35, 0.95, s) * (0.55 + 0.9 * exp(-r * 3.2)) * uAmt;
    col = mix(bg, uCol, clamp(dens, 0.0, 1.0)); col += vec3(1.0) * pow(clamp(dens - 0.55, 0.0, 1.0), 2.0) * 0.9;
  } else if (uMode < 1.5) {
    // partículas: una por celda, a la deriva, atraídas en espiral hacia el cursor
    float acc = 0.0;
    for (int k = 0; k < 3; k++) {
      float sc = 18.0 + float(k) * 11.0;
      vec2 g = q * sc + vec2(0.0, uT * (0.6 + float(k) * 0.35));
      vec2 id = floor(g), f = fract(g) - 0.5;
      vec2 o = vec2(h(id), h(id + 3.1)) - 0.5;
      vec2 pull = normalize(d + 1e-4) * exp(-r * 5.0) * 0.35;
      vec2 pp = f - o * 0.7 + pull * sc * 0.05;
      float tw = 0.5 + 0.5 * sin(uT * 3.0 + h(id) * 40.0);
      acc += smoothstep(0.13, 0.0, length(pp)) * tw * (0.6 + 1.8 * exp(-r * 4.0));
    }
    col = mix(bg, uCol, clamp(acc * uAmt, 0.0, 1.0)) + vec3(1.0) * pow(clamp(acc * uAmt - 0.7, 0.0, 1.0), 2.0);
    col += uCol * exp(-r * 9.0) * 0.25 * uAmt;
  } else {
    // energía: ondas concéntricas desde el cursor, deformadas por ruido
    float wv = fbm(q * 3.0 + uT * 0.2) * 0.35;
    float ring = sin((r + wv) * 38.0 - uT * 4.0) * 0.5 + 0.5;
    float e = pow(ring, 6.0) * exp(-r * 2.4) * uAmt * 1.4 + exp(-r * 14.0) * 0.8;
    col = mix(bg, uCol, clamp(e, 0.0, 1.0)) + vec3(1.0) * pow(clamp(e - 0.6, 0.0, 1.0), 2.0);
  }
  col *= 1.0 - 0.35 * pow(length(uv - 0.5), 2.0);
  gl_FragColor = vec4(col, 1.0);
}`;

export function ProceduralFxDemo({ lang = 'es', height = 380 }: { lang?: Lang; height?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [mode, setMode] = useState(0);
  const [amt, setAmt] = useState(0.8);
  const [color, setColor] = useState(0);
  const [failed, setFailed] = useState(false);
  const st = useRef({ mode: 0, amt: 0.8, col: COLORS[0].rgb as readonly number[] });
  st.current = { mode, amt, col: COLORS[color].rgb };

  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    const gl = cv.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' });
    if (!gl) { setFailed(true); return; }
    const sh = (type: number, src: string) => { const s = gl.createShader(type)!; gl.shaderSource(s, src); gl.compileShader(s); return s; };
    const pr = gl.createProgram()!; gl.attachShader(pr, sh(gl.VERTEX_SHADER, VERT)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FRAG)); gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) { setFailed(true); return; }
    gl.useProgram(pr);
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const U = (k: string) => gl.getUniformLocation(pr, k);
    const uRes = U('uRes'), uT = U('uT'), uMode = U('uMode'), uAmt = U('uAmt'), uM = U('uM'), uCol = U('uCol');
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let raf = 0, visible = true, hover = false, tx = 0.5, ty = 0.5, mx = 0.5, my = 0.5, last = performance.now(), time = 0;
    const col = [...st.current.col];
    const size = () => { const r = cv.getBoundingClientRect(), k = Math.min(window.devicePixelRatio || 1, 1.5); cv.width = Math.max(1, Math.round(r.width * k)); cv.height = Math.max(1, Math.round(r.height * k)); gl.viewport(0, 0, cv.width, cv.height); };
    const move = (e: PointerEvent) => { const r = cv.getBoundingClientRect(); tx = (e.clientX - r.left) / r.width; ty = 1 - (e.clientY - r.top) / r.height; hover = true; };
    const out = () => { hover = false; };
    const frame = (now: number) => {
      raf = visible ? requestAnimationFrame(frame) : 0;
      const dt = Math.min(0.05, (now - last) / 1000); last = now; time += dt * (reduce ? 0.25 : 1);
      if (!hover) { tx = 0.5 + 0.28 * Math.sin(time * 0.45); ty = 0.5 + 0.22 * Math.sin(time * 0.31 + 1.2); }
      const k = 1 - Math.exp(-dt * (hover ? 10 : 3)); mx += (tx - mx) * k; my += (ty - my) * k;
      const c = st.current.col; for (let i = 0; i < 3; i++) col[i] += (c[i] - col[i]) * (1 - Math.exp(-dt * 6));
      gl.uniform2f(uRes, cv.width, cv.height); gl.uniform1f(uT, time); gl.uniform1f(uMode, st.current.mode);
      gl.uniform1f(uAmt, st.current.amt); gl.uniform2f(uM, mx, my); gl.uniform3f(uCol, col[0], col[1], col[2]);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible && !raf) { last = performance.now(); raf = requestAnimationFrame(frame); } });
    io.observe(cv);
    const ro = new ResizeObserver(size); ro.observe(cv); size();
    cv.addEventListener('pointermove', move); cv.addEventListener('pointerleave', out);
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); io.disconnect(); ro.disconnect(); cv.removeEventListener('pointermove', move); cv.removeEventListener('pointerleave', out); gl.getExtension('WEBGL_lose_context')?.loseContext(); };
  }, []);

  const L = (o: { es: string; en: string }) => (lang === 'en' ? o.en : o.es);
  return (
    <div className="pfx">
      <style>{`
        .pfx { position: relative; border: 1px solid var(--cx-border); background: #07080a; }
        .pfx canvas { display: block; width: 100%; cursor: crosshair; touch-action: pan-y; }
        .pfx-ui { position: absolute; left: 12px; right: 12px; bottom: 12px; display: flex; flex-wrap: wrap; gap: 8px 14px; align-items: center; justify-content: space-between; pointer-events: none; }
        .pfx-ui > * { pointer-events: auto; }
        .pfx-seg { display: flex; border: 1px solid rgba(255,255,255,.18); background: rgba(7,8,10,.62); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); }
        .pfx-seg button { font: 500 11px/1 var(--cx-mono, ui-monospace, monospace); letter-spacing: .14em; text-transform: uppercase; color: rgba(237,238,232,.7);
          background: none; border: 0; padding: 9px 12px; cursor: pointer; transition: color .25s, background .25s; }
        .pfx-seg button[aria-pressed="true"] { color: #fff; background: rgba(255,122,61,.22); }
        .pfx-seg button:hover { color: #fff; }
        .pfx-amt { display: flex; align-items: center; gap: 8px; font: 500 10.5px/1 var(--cx-mono, ui-monospace, monospace); letter-spacing: .14em; text-transform: uppercase; color: rgba(237,238,232,.7);
          padding: 6px 10px; border: 1px solid rgba(255,255,255,.18); background: rgba(7,8,10,.62); }
        .pfx-amt input { width: 110px; accent-color: #ff7a3d; }
        .pfx-sw { width: 16px; height: 16px; padding: 0 !important; margin: 0 4px; border: 1px solid rgba(255,255,255,.3) !important; }
        .pfx-sw[aria-pressed="true"] { outline: 1px solid #fff; outline-offset: 2px; }
        .pfx-hint { position: absolute; left: 12px; top: 10px; font: 500 10px/1 var(--cx-mono, ui-monospace, monospace); letter-spacing: .18em; text-transform: uppercase; color: rgba(237,238,232,.55); pointer-events: none; }
        .pfx-fail { display: grid; place-items: center; color: var(--cx-muted); font-size: 13px; }
      `}</style>
      {failed ? <div className="pfx-fail" style={{ height }}>{lang === 'en' ? 'Your browser has WebGL disabled.' : 'Tu navegador tiene WebGL desactivado.'}</div>
        : <canvas ref={ref} style={{ height }} aria-label={lang === 'en' ? 'Procedural effect generated live; move the cursor over it' : 'Efecto procedural generado en vivo; mueve el cursor encima'} />}
      <span className="pfx-hint" aria-hidden="true">{lang === 'en' ? 'Live · WebGL · move the cursor' : 'En vivo · WebGL · mueve el cursor'}</span>
      {!failed && (
        <div className="pfx-ui">
          <div className="pfx-seg" role="group" aria-label={lang === 'en' ? 'Effect' : 'Efecto'}>
            {MODES.map((m) => <button key={m.id} type="button" aria-pressed={mode === m.id} onClick={() => setMode(m.id)}>{L(m)}</button>)}
          </div>
          <label className="pfx-amt">{lang === 'en' ? 'Intensity' : 'Intensidad'}
            <input type="range" min={0.2} max={1.4} step={0.01} value={amt} onChange={(e) => setAmt(Number(e.target.value))} />
          </label>
          <div className="pfx-seg" role="group" aria-label={lang === 'en' ? 'Color' : 'Color'} style={{ padding: '6px 6px' }}>
            {COLORS.map((c, i) => <button key={c.id} type="button" className="pfx-sw" aria-pressed={color === i} aria-label={L(c)} title={L(c)} onClick={() => setColor(i)}
              style={{ background: `rgb(${c.rgb.map((v) => Math.round(v * 255)).join(',')})` }} />)}
          </div>
        </div>
      )}
    </div>
  );
}
