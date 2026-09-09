import { useEffect, useRef, useState } from 'react';
import { useAnimatedNumber } from '../../lib/services/useAnimatedNumber';

export interface QuoteRange { min: number; max: number }
type Lang = 'es' | 'en';
type Cur = 'COP' | 'USD';

const fmt = (cur: Cur, n: number, lang: Lang) =>
  new Intl.NumberFormat(cur === 'COP' ? 'es-CO' : 'en-US', {
    style: 'currency', currency: cur, maximumFractionDigits: 0,
  }).format(n);

/** Visor del precio (ciclo 17): números animados + chip de delta + anuncio
 *  accesible debounced. NO toca normales ni estado del wizard: solo muestra
 *  el quote derivado que le pasa el padre. */
export function PriceDisplay({ min, max, currency, lang = 'es' }: {
  min: number; max: number; currency: Cur; lang?: Lang;
}) {
  const minA = useAnimatedNumber(min);
  const maxA = useAnimatedNumber(max);

  // Chip de delta en cada cambio (signo correcto)
  const prev = useRef(min);
  const [delta, setDelta] = useState<{ v: number; k: number } | null>(null);
  const kRef = useRef(0);
  useEffect(() => {
    const d = min - prev.current;
    prev.current = min;
    if (d !== 0) {
      kRef.current += 1;
      setDelta({ v: d, k: kRef.current });
      const t = setTimeout(() => setDelta(null), 900);
      return () => clearTimeout(t);
    }
  }, [min]);

  // Anuncio accesible, una vez por "pausa" del usuario (no por frame)
  const [announce, setAnnounce] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setAnnounce(
      lang === 'es'
        ? `Rango estimado de ${fmt(currency, min, lang)} a ${fmt(currency, max, lang)}`
        : `Estimated range ${fmt(currency, min, lang)} to ${fmt(currency, max, lang)}`
    ), 600);
    return () => clearTimeout(t);
  }, [min, max, currency, lang]);

  return (
    <div className="cx-price">
      <div className="cx-price-row">
        <span className="cx-price-num">{fmt(currency, minA, lang)}</span>
        <span className="cx-price-dash">—</span>
        <span className="cx-price-num">{fmt(currency, maxA, lang)}</span>
        <span className="cx-price-cur">{currency}</span>
        {delta && (
          <span key={delta.k} className={`cx-price-delta ${delta.v > 0 ? 'up' : 'down'}`}>
            {delta.v > 0 ? '+' : '−'}{fmt(currency, Math.abs(delta.v), lang)}
          </span>
        )}
      </div>
      <span className="sr-only" role="status" aria-live="polite">{announce}</span>
    </div>
  );
}

/** Barra pegajosa del precio en modo guiado: vive FUERA de los paneles del
 *  wizard y persiste en todos los pasos (sticky bottom). Ciclo 17. */
export function PriceBar({ min, max, currency, lang = 'es' }: {
  min: number; max: number; currency: Cur; lang?: Lang;
}) {
  return (
    <div className="cx-pricebar">
      <div className="cx-pricebar-label">
        {lang === 'es' ? 'Inversión estimada' : 'Estimated investment'}
      </div>
      <PriceDisplay min={min} max={max} currency={currency} lang={lang} />
    </div>
  );
}
