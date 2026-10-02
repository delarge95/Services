import { useState } from 'react';
import { CONTACT_EMAIL } from '../../lib/services/share';
import { BRAND } from '../../data/services/branding';
import { EN } from '../../data/services/i18n';
import type { Lang } from '../../data/services/i18n';
import { formalText, printFormal } from '../../lib/services/formalQuote';
import type { FormalQuote } from '../../lib/services/formalQuote';

/**
 * S1+S5: CTA post-presupuesto sin dead-end.
 * WhatsApp/email con resumen prellenado · copiar enlace compartible · imprimir/PDF.
 */
export function QuoteCta({ summary, url, lang = 'es', formal = null }: { summary: string; url: string; lang?: Lang; formal?: FormalQuote | null }) {
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
  // ciclo 41: WhatsApp y correo llevan la cotización FORMAL (mismo contenido que el PDF)
  const mailSubject = formal ? encodeURIComponent(`${en ? 'Quote' : 'Cotización'} ${formal.id} — ${formal.main.name}`) : subject;
  const mailto = `mailto:${CONTACT_EMAIL}?subject=${mailSubject}&body=${encodeURIComponent(formal ? formalText(formal, 'email') : summary)}`;
  const whatsapp = `https://wa.me/${BRAND.whatsappNumber}?text=${encodeURIComponent(formal ? formalText(formal, 'whatsapp') : summary)}`;
  const btn = { padding: '9px 13px', borderRadius: 0, font: 'inherit', fontSize: 13, fontWeight: 600, textDecoration: 'none', cursor: 'pointer', background: 'transparent', color: 'var(--cx-text)', border: '1px solid var(--cx-border-strong)' } as const;

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <a href={whatsapp} target="_blank" rel="noreferrer"
          style={{ ...btn, background: '#128c4b', color: '#fff', border: '1px solid #128c4b' }}>
          {en ? EN.cta.whatsapp : 'Enviar por WhatsApp'}
        </a>
        <a href={mailto} style={btn}>
          {en ? EN.cta.email : 'Enviar por email'}
        </a>
        <button onClick={() => copy(url, en ? EN.cta.copyOk : '✓ Enlace copiado: puedes pegarlo para compartir esta cotización exacta.')} style={btn}>
          {en ? EN.cta.copy : 'Copiar enlace'}
        </button>
        <button onClick={() => (formal ? printFormal(formal) : window.print())} style={btn}>
          {en ? 'PDF quote' : 'Cotización en PDF'}
        </button>
      </div>
      <p aria-live="polite" style={{ minHeight: 0, margin: feedback ? '6px 0 0' : 0, fontSize: 12.5, color: 'var(--cx-signal)' }}>{feedback}</p>
      <p style={{ margin: '8px 0 0', fontSize: 11.5, color: 'var(--cx-muted)', lineHeight: 1.4 }}>
        {en ? EN.cta.promise : 'Respuesta en menos de 24 h · Sin compromiso · Tus referencias/archivos los envías después si quieres.'}
      </p>
    </div>
  );
}
