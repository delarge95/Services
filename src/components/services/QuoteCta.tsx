import { useState } from 'react';
import { CONTACT_EMAIL } from '../../lib/services/share';
import { BRAND } from '../../data/services/branding';
import { EN } from '../../data/services/i18n';
import type { Lang } from '../../data/services/i18n';

/**
 * S1+S5: CTA post-presupuesto sin dead-end.
 * WhatsApp/email con resumen prellenado · copiar enlace compartible · imprimir/PDF.
 */
export function QuoteCta({ summary, url, lang = 'es' }: { summary: string; url: string; lang?: Lang }) {
  const [feedback, setFeedback] = useState('');
  const en = lang === 'en';

  const copy = async (text: string, msg: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setFeedback(msg);
    } catch {
      setFeedback(en ? EN.cta.copyFail : 'No se pudo copiar automáticamente; selecciona el texto manualmente.');
    }
    setTimeout(() => setFeedback(''), 3500);
  };

  const subject = encodeURIComponent(en ? EN.cta.subject : 'Cotización de proyecto 3D');
  const mailto = `mailto:${CONTACT_EMAIL}?subject=${subject}&body=${encodeURIComponent(summary)}`;
  const whatsapp = `https://wa.me/${BRAND.whatsappNumber}?text=${encodeURIComponent(summary)}`;

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <a href={whatsapp} target="_blank" rel="noreferrer"
          style={{
            padding: '12px 20px', borderRadius: 10, textDecoration: 'none', fontWeight: 600, fontSize: 14,
            background: '#128c4b', color: '#fff', border: 'none', cursor: 'pointer',
          }}>
          {en ? EN.cta.whatsapp : 'Enviar por WhatsApp'}
        </a>
        <a href={mailto}
          style={{
            padding: '12px 20px', borderRadius: 10, textDecoration: 'none', fontWeight: 600, fontSize: 14,
            background: 'var(--cx-card-solid)', color: 'var(--cx-text)', border: '1px solid var(--cx-border-strong)', cursor: 'pointer',
          }}>
          {en ? EN.cta.email : 'Enviar por email'}
        </a>
        <button onClick={() => copy(url, en ? EN.cta.copyOk : '✓ Enlace copiado: puedes pegarlo para compartir esta cotización exacta.')}
          style={{
            padding: '12px 20px', borderRadius: 10, font: 'inherit', fontSize: 14,
            background: 'var(--cx-card-solid)', color: 'var(--cx-text)', border: '1px solid var(--cx-border-strong)', cursor: 'pointer',
          }}>
          {en ? EN.cta.copy : 'Copiar enlace'}
        </button>
        <button onClick={() => window.print()}
          style={{
            padding: '12px 20px', borderRadius: 10, font: 'inherit', fontSize: 14,
            background: 'var(--cx-card-solid)', color: 'var(--cx-text)', border: '1px solid var(--cx-border-strong)', cursor: 'pointer',
          }}>
          {en ? EN.cta.print : 'Imprimir / PDF'}
        </button>
      </div>
      <p aria-live="polite" style={{ minHeight: 18, margin: '8px 0 0', fontSize: 12.5, color: '#166534' }}>{feedback}</p>
      <p style={{ margin: 0, fontSize: 12, color: 'var(--cx-muted)' }}>
        {en ? EN.cta.promise : 'Respuesta en menos de 24 h · Sin compromiso · Tus referencias/archivos los envías después si quieres.'}
      </p>
    </div>
  );
}
