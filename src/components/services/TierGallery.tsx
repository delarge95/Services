import { useMemo } from 'react';
import { computeQuote } from '../../data/services/formula';
import { getGalleryAsset, familyIllustration, TIER_SCOPE, familyIcon } from '../../data/services/galleryManifest';
import type { ServiceDef } from '../../data/services/catalogCore';
import type { Currency, LevelId } from '../../data/services/types';

const BAR_LEVELS: LevelId[] = ['XS', 'S', 'M', 'L', 'XL'];

/**
 * S7: "¿Qué incluye este nivel?" — comparador S/M/L con precio desde,
 * barra relativa y ejemplo visual cuando existe asset en el manifest.
 */
export function TierGallery({ svc, tier, currency, quoteOpts }: {
  svc: ServiceDef;
  tier: LevelId;
  currency: Currency;
  quoteOpts: { firstClientLaunch?: boolean; batchUnits?: number; urgencyPct?: number };
}) {
  const quotes = useMemo(() => {
    const map = new Map<LevelId, { min: number; max: number }>();
    for (const l of BAR_LEVELS) {
      try {
        const q = computeQuote(svc.id, l, currency, quoteOpts);
        if (q) map.set(l, { min: q.totalMin, max: q.totalMax });
      } catch { /* nivel no soportado */ }
    }
    return map;
  }, [svc.id, currency, quoteOpts]);

  const maxMid = Math.max(
    ...BAR_LEVELS.map((l) => {
      const q = quotes.get(l);
      return q ? (q.min + q.max) / 2 : 0;
    }),
    1,
  );

  const fmtV = (v: number): string =>
    new Intl.NumberFormat(currency === 'COP' ? 'es-CO' : 'en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(v);

  return (
    <div style={{ marginTop: 14 }} data-noprint>
      <strong style={{ fontSize: 13.5, color: '#1a1d29' }}>¿Qué incluye cada nivel?</strong>
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBlock: 10 }}>
        {BAR_LEVELS.map((l) => {
          const q = quotes.get(l);
          const mid = q ? (q.min + q.max) / 2 : 0;
          const active = l === tier;
          const scope = TIER_SCOPE[l];
          return (
            <div key={l} style={{
              minWidth: 118, flex: '0 0 auto', borderRadius: 10, padding: 10,
              border: active ? '2px solid #0a84ff' : '1px solid #dde0e8',
              background: active ? '#e8f0fe' : '#fff',
              opacity: q ? 1 : 0.5,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <strong style={{ fontSize: 15, color: active ? '#0a84ff' : '#1a1d29' }}>{l}</strong>
                <span style={{ fontSize: 10.5, color: '#5a5e6e' }}>{scope.label}</span>
              </div>
              <div aria-hidden="true" style={{ height: 6, background: '#e3e7f0', borderRadius: 4, margin: '6px 0', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.max(6, (mid / maxMid) * 100)}%`, background: active ? '#0a84ff' : '#9db4d8', borderRadius: 4 }} />
              </div>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: '#1a1d29' }}>
                {q && q.max > 0 ? `${fmtV(q.min)}–${fmtV(q.max)}` : '—'}
              </div>
              <div style={{ fontSize: 10.5, color: '#5a5e6e', marginTop: 2 }}>{scope.desc}</div>
            </div>
          );
        })}
      </div>

      <LevelMedia svc={svc} tier={tier} />
    </div>
  );
}

function LevelMedia({ svc, tier }: { svc: ServiceDef; tier: LevelId }) {
  const asset = getGalleryAsset(svc.id, tier) ?? familyIllustration(svc.family, tier);
  if (asset) {
    return (
      <figure style={{ margin: '4px 0 0' }}>
        <img src={asset.src} alt={asset.alt} loading="lazy"
          style={{ width: '100%', maxHeight: 220, objectFit: 'cover', borderRadius: 10, border: '1px solid #dde0e8' }} />
        <figcaption style={{ fontSize: 11, color: '#5a5e6e', marginTop: 4 }}>
          Ejemplo orientativo del nivel {tier}. Tu versión parte de tus referencias.
        </figcaption>
      </figure>
    );
  }
  return (
    <div style={{
      display: 'flex', gap: 10, alignItems: 'center',
      background: 'linear-gradient(135deg,#eef2fb 0%,#f7f9ff 60%,#eefaf3 100%)',
      border: '1px dashed #c7d7fe', borderRadius: 10, padding: 12,
    }}>
      <span style={{ fontSize: 22 }}>{familyIcon(svc.family)}</span>
      <span style={{ fontSize: 12, lineHeight: 1.45, color: '#44485a' }}>
        Nivel <strong>{tier}</strong> ({TIER_SCOPE[tier]?.label}). El desglose de arriba describe
        exactamente qué recibes en este nivel.
      </span>
    </div>
  );
}
