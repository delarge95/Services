const PASOS: Array<{ t: string; d: string }> = [
  { t: '1 · Cotizas aquí', d: 'Configuras lo que sabes; el nivel y el rango se calculan solos.' },
  { t: '2 · Brief corto', d: 'Por chat o email ajustamos alcance con tus referencias. Respondemos en <24 h.' },
  { t: '3 · Anticipo 50%', d: 'Precio cerrado por escrito antes de iniciar. El otro 50% contra entrega.' },
  { t: '4 · Producción', d: 'Avances parciales en hitos acordados; siempre sabes en qué va tu proyecto.' },
  { t: '5 · 2 rondas de revisión', d: 'Incluidas en el precio. Cambios extra fuera de alcance se cotizan aparte.' },
  { t: '6 · Entrega + handoff', d: 'Archivos finales organizados y guía de uso. Quedas autónomo.' },
];

const FAQS: Array<{ q: string; a: string }> = [
  { q: '¿El precio del cotizador es el precio final?', a: 'Es un rango orientativo calculado con nuestras tarifas reales. Tras el brief te damos precio cerrado por escrito; en la mayoría de casos queda dentro del rango mostrado.' },
  { q: '¿Qué pasa con mis archivos (CAD, modelos, fotos)?', a: 'Se usan solo para tu proyecto y se tratan como confidenciales. Si quieres, firmamos NDA antes de recibirlos.' },
  { q: '¿Por qué COP es más barato que USD?', a: 'USD es tarifa internacional; COP aplica costos de mercado local colombiano. La calidad del trabajo es idéntica.' },
  { q: '¿Puedes facturar a mi agencia en blanco (white label)?', a: 'Sí. Trabajamos white label con agencias: tú eres la cara ante tu cliente.' },
  { q: '¿Qué pasa si quiero cambios después de las 2 rondas?', a: 'Los cambios fuera del alcance acordado se estiman y aprueban antes de ejecutarse. Nunca hay sorpresas en la factura.' },
  { q: '¿Cómo empiezo?', a: 'Envía tu cotización desde esta página (WhatsApp o email). Te respondemos en menos de 24 h con próximos pasos.' },
];

/** S11: proceso público + FAQ — responde las preguntas del aprobador interno (persona P4) sin salir de la página. */
export function ProcesoFaq() {
  return (
    <div style={{ background: '#fff', border: '1px solid #dde0e8', borderRadius: 12, padding: 20, marginTop: 16 }} data-noprint>
      <strong style={{ fontSize: 15, color: '#1a1d29' }}>Cómo trabajamos</strong>
      <ol style={{ margin: '10px 0 0', paddingLeft: 18, color: '#1a1d29' }}>
        {PASOS.map((p) => (
          <li key={p.t} style={{ marginBottom: 8 }}>
            <strong style={{ fontSize: 13.5 }}>{p.t}</strong>
            <span style={{ display: 'block', fontSize: 12.5, color: '#5a5e6e' }}>{p.d}</span>
          </li>
        ))}
      </ol>
      <strong style={{ display: 'block', fontSize: 15, color: '#1a1d29', marginTop: 14 }}>Preguntas frecuentes</strong>
      {FAQS.map((f) => (
        <details key={f.q} style={{ borderBottom: '1px solid #eceef3', paddingBlock: 6 }}>
          <summary style={{ cursor: 'pointer', fontSize: 13.5, color: '#1a1d29' }}>{f.q}</summary>
          <p style={{ margin: '6px 0 8px', fontSize: 13, lineHeight: 1.5, color: '#44485a' }}>{f.a}</p>
        </details>
      ))}
    </div>
  );
}
