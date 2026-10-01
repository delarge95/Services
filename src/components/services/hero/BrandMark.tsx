/**
 * BrandMark.tsx — Monograma "AW" de Alex Woodcock (ciclo 33, reconstruido con criterios de marca).
 *
 * Construcción (viewBox 100 × 60; documentada en docs/marca/MARCA_AW.md):
 *  · UNA SOLA TINTA (currentColor). La barra es parte del glifo, no un elemento añadido: el color
 *    de acento es un uso secundario (solo en la animación de entrada), nunca el símbolo primario.
 *  · Cuatro diagonales PARALELAS dos a dos (pendiente ±21/60), mismo grosor: ritmo constante.
 *  · Todas las terminales cortadas sobre DOS líneas (techo y base): seis terminales idénticas
 *    (8,5 u de ancho), sin picos ni remates que compitan.
 *  · Barra de la A al 60 % de la altura (centro óptico, un poco por debajo del geométrico):
 *    equilibra el contraforma triangular superior con la abertura inferior.
 *  · Compensación óptica: la horizontal es un 11 % más fina que las diagonales (8 frente a 9),
 *    porque a igual grosor nominal una horizontal se percibe más pesada.
 *  · La barra NACE DENTRO de las piernas (x 38 → 62): sus extremos quedan ocultos en el trazo,
 *    así que se funde sin juntas visibles.
 *  · Grosor 9/60 = 15 % de la altura: a 14 px iguala el asta de Space Grotesk 700 a 16 px.
 */
type Props = { size?: number; className?: string; title?: string };

export const AW = {
  // extremos prolongados fuera del recorte → terminales planas sobre techo y base
  w: 'M4.5 -10 L29 60 L50 0 L71 60 L95.5 -10',
  bar: 'M38 36 H62',
  stroke: 9,
  barStroke: 8,
};

export function BrandMark({ size = 14, className, title }: Props) {
  return (
    <svg className={`aw-mark${className ? ` ${className}` : ''}`} viewBox="0 0 100 60" width={(size * 100) / 60} height={size}
      fill="none" role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true} focusable="false">
      <defs><clipPath id="aw-clip"><rect x="0" y="0" width="100" height="60" /></clipPath></defs>
      <g clipPath="url(#aw-clip)" stroke="currentColor">
        <path className="aw-w" d={AW.w} strokeWidth={AW.stroke} strokeLinejoin="miter" strokeMiterlimit={10} pathLength={1} />
        <path className="aw-bar" d={AW.bar} strokeWidth={AW.barStroke} pathLength={1} />
      </g>
    </svg>
  );
}
