import type { DriverInfo } from '../../lib/services/priceWhy';

/**
 * S10: transparencia causal del precio — top drivers por impacto + condiciones aplicadas.
 */
export function PriceWhy({ drivers, conditions, onLower }: {
  drivers: DriverInfo[];
  conditions: string[];
  onLower: (varId: string, minValue: number) => void;
}) {
  return (
    <details style={{ marginTop: 10 }} data-noprint>
      <summary style={{ cursor: 'pointer', fontSize: 13, color: '#0a84ff' }}>¿Por qué este precio?</summary>
      <div style={{ fontSize: 12.5, marginTop: 8, color: '#1a1d29' }}>
        {drivers.length === 0
          ? <p style={{ margin: 0 }}>Estás en configuración base: este es el punto de partida del servicio.</p>
          : (
            <ul style={{ paddingLeft: 18, margin: '0 0 8px' }}>
              {drivers.map((d) => (
                <li key={d.varId} style={{ marginBottom: 4 }}>
                  ↑ <strong>{d.label.replace(/^¿|\?$/g, '')}</strong>: {d.valueLabel}{' '}
                  <span style={{ color: '#b45309', fontWeight: 700 }}>+{Math.round(d.pctUp * 100)}%</span>
                  {' '}
                  <button onClick={() => onLower(d.varId, d.minValue)}
                    style={{
                      font: 'inherit', fontSize: 11.5, color: '#0a84ff', background: 'none',
                      border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0,
                    }}>
                    bajar al mínimo
                  </button>
                </li>
              ))}
            </ul>
          )}
        {conditions.length > 0 && (
          <p style={{ margin: 0, opacity: 0.75 }}>Condiciones: {conditions.join(' · ')}</p>
        )}
      </div>
    </details>
  );
}
