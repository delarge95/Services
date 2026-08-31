import { useEffect, useMemo, useRef, useState } from 'react';
import { CONTACT_EMAIL } from '../../../lib/services/share';
import { matchIntent, quickRepliesFor } from '../../../lib/services/chat/chatIntents';
import type { ChatContext } from '../../../lib/services/chat/chatIntents';

interface Msg { role: 'user' | 'bot'; text: string }

/**
 * S12: asistente flotante contextual. Proactivo según sección del cotizador,
 * quick-replies por persona y respuestas dinámicas con el estado actual.
 */
export function CotizadorChat(props: ChatContext) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const listRef = useRef<HTMLDivElement>(null);

  const ctx: ChatContext = useMemo(() => ({ ...props, contactEmail: CONTACT_EMAIL }), [props]);

  useEffect(() => {
    if (open && msgs.length === 0) {
      setMsgs([{ role: 'bot', text: greetingFor(ctx.section, ctx.serviceName) }]);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [msgs, open]);

  const send = (text: string) => {
    const clean = text.trim();
    if (!clean) return;
    const answer = matchIntent(clean, ctx)
      ?? 'No estoy seguro de haber entendido. Prueba con “precio”, “plazos”, “archivos” o escríbenos a '
        + `${CONTACT_EMAIL} — respondemos en <24 h.`;
    setMsgs((m) => [...m, { role: 'user', text: clean }, { role: 'bot', text: answer }]);
    setInput('');
  };

  const chips = quickRepliesFor(ctx);
  const unreadHint = !open;

  return (
    <>
      {unreadHint && (
        <button onClick={() => setOpen(true)} aria-label="Abrir asistente"
          style={{
            position: 'fixed', right: 18, bottom: 18, zIndex: 60, border: 'none', cursor: 'pointer',
            width: 52, height: 52, borderRadius: 999, fontSize: 22,
            background: '#0a84ff', color: '#fff', boxShadow: '0 6px 18px rgba(10,132,255,.35)',
          }}>
          💬
          <span style={{
            position: 'absolute', top: -6, right: -4, background: '#166534', color: '#fff',
            borderRadius: 999, fontSize: 10.5, padding: '2px 8px', whiteSpace: 'nowrap',
          }}>
            ¿Dudas?
          </span>
        </button>
      )}
      {open && (
        <div role="dialog" aria-label="Asistente de cotización" data-noprint
          style={{
            position: 'fixed', right: 18, bottom: 18, zIndex: 61, width: 'min(360px, calc(100vw - 36px))',
            height: 460, maxHeight: '70vh', display: 'flex', flexDirection: 'column',
            background: '#fff', border: '1px solid #dde0e8', borderRadius: 14, overflow: 'hidden',
            boxShadow: '0 12px 32px rgba(20,24,40,.18)',
          }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderBottom: '1px solid #eceef3' }}>
            <strong style={{ fontSize: 13.5, color: '#1a1d29' }}>Asistente de cotización</strong>
            <button onClick={() => setOpen(false)} aria-label="Cerrar asistente"
              style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 16, color: '#5a5e6e' }}>×</button>
          </div>

          <div ref={listRef} style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {msgs.map((m, i) => (
              <div key={i} style={{
                maxWidth: '86%', padding: '8px 12px', borderRadius: 12, fontSize: 13, lineHeight: 1.45,
                alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                background: m.role === 'user' ? '#0a84ff' : '#f1f3f9',
                color: m.role === 'user' ? '#fff' : '#1a1d29',
                whiteSpace: 'pre-wrap',
              }}>{m.text}</div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', padding: '8px 12px 0' }} data-noprint>
            {chips.map((c) => (
              <button key={c} onClick={() => send(c)}
                style={{
                  font: 'inherit', fontSize: 11.5, cursor: 'pointer', color: '#0a84ff',
                  border: '1px solid #c7d7fe', background: '#f7f9ff', borderRadius: 999, padding: '4px 10px',
                }}>
                {c}
              </button>
            ))}
          </div>

          <form onSubmit={(e) => { e.preventDefault(); send(input); }}
            style={{ display: 'flex', gap: 8, padding: 12 }}>
            <input value={input} onChange={(e) => setInput(e.target.value)}
              placeholder="Escribe tu pregunta…"
              aria-label="Mensaje para el asistente"
              style={{
                flex: 1, font: 'inherit', fontSize: 13, padding: '9px 12px',
                border: '1px solid #dde0e8', borderRadius: 10, outlineColor: '#0a84ff',
              }} />
            <button type="submit"
              style={{
                font: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                background: '#0a84ff', color: '#fff', border: 'none', borderRadius: 10, padding: '9px 14px',
              }}>
              Enviar
            </button>
          </form>
        </div>
      )}
    </>
  );
}

function greetingFor(section: ChatContext['section'], serviceName?: string): string {
  if (section === 'inicio') {
    return '¡Hola! 👋 ¿Aún no sabes qué necesitas? Cuéntame tu objetivo en una frase o toca una opción de abajo.';
  }
  if (section === 'variables') {
    return `Estás configurando ${serviceName ?? 'un servicio'}. Puedo explicarte cualquier término o recomendarte valores si no sabes qué poner.`;
  }
  return '¿Dudas sobre tu presupuesto? Pregúntame por el precio, plazos, proceso o archivos.';
}
