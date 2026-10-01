import { useEffect, useMemo, useRef, useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { CONTACT_EMAIL } from '../../../lib/services/share';
import { matchIntent, matchIntentId, quickRepliesFor } from '../../../lib/services/chat/chatIntents';
import type { ChatContext } from '../../../lib/services/chat/chatIntents';
import { answerWithQuote, detectService } from '../../../lib/services/chat/quoteAssistant';
import type { Currency } from '../../../data/services/types';

interface Msg { role: 'user' | 'bot'; text: string }

/** Ciclo 24: además del contexto de sección, el asistente recibe el servicio y los
 *  valores en pantalla para cotizar y desglosar con el motor real. */
export interface CotizadorChatProps extends ChatContext {
  currency?: Currency;
  serviceId?: string;
  vals?: Record<string, number | string | boolean>;
}

/** Intenciones generales que mandan sobre el asistente si la pregunta no es de precio. */
const GENERAL_FIRST = new Set(['pago', 'proceso', 'revisiones', 'whitelabel', 'contacto', 'archivos', 'moneda', 'urgencia']);

/**
 * S12 → ciclo 24: asistente flotante. Responde con datos REALES del catálogo y del
 * motor de precios (quoteAssistant) y cae a las intenciones generales (chatIntents).
 * Estilo: tokens --cx-* (tema claro/oscuro), apertura animada, indicador de escritura.
 */
export function CotizadorChat(props: CotizadorChatProps) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [typing, setTyping] = useState(false);
  /** Último servicio mencionado: permite seguir la conversación (“¿y con 10?”). */
  const [lastSvc, setLastSvc] = useState<string | undefined>(undefined);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const ctx: ChatContext = useMemo(() => ({ ...props, contactEmail: CONTACT_EMAIL }), [props]);

  useEffect(() => {
    if (open && msgs.length === 0) setMsgs([{ role: 'bot', text: greetingFor(ctx.section, ctx.serviceName) }]);
    if (open) setTimeout(() => inputRef.current?.focus(), 120);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [msgs, open, typing]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const reply = (clean: string): string => {
    const general = matchIntentId(clean);
    const priceAsked = /cuant|precio|cuesta|vale|cotiz|desglose|por que/.test(clean.toLowerCase());
    if (!(general && GENERAL_FIRST.has(general) && !priceAsked)) {
      const mentioned = detectService(clean)?.id;
      if (mentioned) setLastSvc(mentioned);
      const sid = mentioned ?? lastSvc ?? props.serviceId;
      const real = answerWithQuote(clean, { currency: props.currency ?? 'COP', serviceId: sid, vals: sid === props.serviceId ? props.vals : undefined });
      if (real) return real;
    }
    return matchIntent(clean, ctx)
      ?? 'No estoy seguro de haber entendido. Prueba con “¿cuánto cuesta un render de 5 imágenes?”, “¿qué incluye?” o “¿qué servicios hay?”. '
        + `También puedes escribirme a ${CONTACT_EMAIL}: respondo en menos de 24 h.`;
  };

  const send = (text: string) => {
    const clean = text.trim();
    if (!clean || typing) return;
    setMsgs((m) => [...m, { role: 'user', text: clean }]);
    setInput('');
    setTyping(true);
    const answer = reply(clean);
    // microinteracción: breve "escribiendo…" proporcional a la respuesta (máx. 700 ms)
    setTimeout(() => { setMsgs((m) => [...m, { role: 'bot', text: answer }]); setTyping(false); }, Math.min(700, 250 + answer.length * 2));
  };

  const chips = props.serviceId
    ? ['¿Por qué este precio?', '¿Qué incluye?', '¿Cuánto tarda?']
    : ['¿Qué servicios hay?', '¿Cuánto cuesta un render de 5 imágenes?', '¿Cuánto cuesta un chatbot?', ...quickRepliesFor(ctx).slice(2)];

  return (
    <>
      <style>{`
        .cx-chat-fab { position: fixed; right: 18px; bottom: 96px; z-index: 60; width: 54px; height: 54px; border-radius: 16px; border: 1px solid var(--cx-accent-border); cursor: pointer;
          background: var(--cx-accent); color: var(--cx-on-accent); box-shadow: var(--cx-shadow-hover); display: grid; place-items: center;
          transition: transform .3s var(--cx-ease, ease), box-shadow .3s; }
        .cx-chat-fab:hover { transform: translateY(-3px) rotate(-4deg); }
        .cx-chat-fab .cx-chat-badge { position: absolute; top: -8px; right: -6px; font: 500 10px var(--cx-mono, monospace); letter-spacing: .08em;
          padding: 3px 7px; border-radius: 6px; background: var(--cx-signal, #c8f53f); color: var(--cx-bg); white-space: nowrap; }
        .cx-chat-panel { position: fixed; right: 18px; bottom: 96px; z-index: 61; width: min(380px, calc(100vw - 32px)); height: 520px; max-height: calc(100vh - 140px);
          display: flex; flex-direction: column; background: var(--cx-card-solid); color: var(--cx-text); border: 1px solid var(--cx-border-strong);
          border-radius: 16px; overflow: hidden; box-shadow: 0 24px 60px -20px rgba(0,0,0,.5); transform-origin: bottom right; animation: cx-chat-in .32s var(--cx-ease, ease) both; }
        @keyframes cx-chat-in { from { opacity: 0; transform: translateY(12px) scale(.96); } to { opacity: 1; transform: none; } }
        .cx-chat-head { display: flex; justify-content: space-between; align-items: center; padding: 12px 14px; border-bottom: 1px solid var(--cx-border); }
        .cx-chat-head small { display: block; font: 500 10px var(--cx-mono, monospace); letter-spacing: .14em; color: var(--cx-signal, var(--cx-accent)); text-transform: uppercase; }
        .cx-chat-msg { max-width: 88%; padding: 9px 12px; border-radius: 12px; font-size: 13px; line-height: 1.5; white-space: pre-wrap; animation: cx-chat-msg .28s var(--cx-ease, ease) both; }
        @keyframes cx-chat-msg { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
        .cx-chat-msg.user { align-self: flex-end; background: var(--cx-accent); color: var(--cx-on-accent); border-bottom-right-radius: 4px; }
        .cx-chat-msg.bot { align-self: flex-start; background: var(--cx-tile); color: var(--cx-text); border-bottom-left-radius: 4px; }
        .cx-chat-typing { align-self: flex-start; display: inline-flex; gap: 4px; padding: 10px 12px; border-radius: 12px; background: var(--cx-tile); }
        .cx-chat-typing i { width: 6px; height: 6px; border-radius: 50%; background: var(--cx-muted); animation: cx-dot 1s infinite; }
        .cx-chat-typing i:nth-child(2) { animation-delay: .15s; } .cx-chat-typing i:nth-child(3) { animation-delay: .3s; }
        @keyframes cx-dot { 0%, 100% { opacity: .3; transform: none; } 50% { opacity: 1; transform: translateY(-3px); } }
        .cx-chat-chip { font: inherit; font-size: 11.5px; cursor: pointer; color: var(--cx-accent); border: 1px solid var(--cx-accent-border); background: var(--cx-accent-soft);
          border-radius: 999px; padding: 5px 10px; transition: transform .2s, background .2s; }
        .cx-chat-chip:hover { transform: translateY(-1px); }
        .cx-chat-input { flex: 1; font: inherit; font-size: 13px; padding: 10px 12px; border: 1px solid var(--cx-border-strong); border-radius: 10px; background: var(--cx-tile); color: var(--cx-text); }
        .cx-chat-send { font: inherit; font-size: 13px; font-weight: 700; cursor: pointer; background: var(--cx-accent); color: var(--cx-on-accent); border: none; border-radius: 10px; padding: 10px 14px; }
        @media (max-width: 640px) { .cx-chat-fab { bottom: 128px; right: 14px; } .cx-chat-panel { right: 12px; left: 12px; width: auto; bottom: 12px; height: min(560px, calc(100vh - 24px)); max-height: none; } }
        @media (prefers-reduced-motion: reduce) { .cx-chat-panel, .cx-chat-msg, .cx-chat-typing i { animation: none; } }
      `}</style>
      {!open && (
        <button className="cx-chat-fab" data-noprint onClick={() => setOpen(true)} aria-label="Abrir asistente de cotización">
          <MessageCircle size={22} />
          <span className="cx-chat-badge">¿DUDAS?</span>
        </button>
      )}
      {open && (
        <div className="cx-chat-panel" role="dialog" aria-label="Asistente de cotización" data-noprint>
          <div className="cx-chat-head">
            <div>
              <small>Asistente · precios reales</small>
              <strong style={{ fontSize: 14 }}>{props.serviceName ?? 'Cotiza conversando'}</strong>
            </div>
            <button onClick={() => setOpen(false)} aria-label="Cerrar asistente"
              style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--cx-muted)', lineHeight: 1 }}>×</button>
          </div>

          <div ref={listRef} aria-live="polite" style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {msgs.map((m, i) => <div key={i} className={`cx-chat-msg ${m.role}`}>{m.text}</div>)}
            {typing && <div className="cx-chat-typing" aria-label="Escribiendo"><i /><i /><i /></div>}
          </div>

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', padding: '8px 12px 0' }}>
            {chips.map((c) => <button key={c} className="cx-chat-chip" onClick={() => send(c)}>{c}</button>)}
          </div>

          <form onSubmit={(e) => { e.preventDefault(); send(input); }} style={{ display: 'flex', gap: 8, padding: 12 }}>
            <input ref={inputRef} className="cx-chat-input" value={input} onChange={(e) => setInput(e.target.value)}
              placeholder="Ej.: ¿cuánto cuesta un video de 30 segundos?" aria-label="Mensaje para el asistente" />
            <button type="submit" className="cx-chat-send">Enviar</button>
          </form>
        </div>
      )}
    </>
  );
}

function greetingFor(section: ChatContext['section'], serviceName?: string): string {
  if (section === 'inicio') {
    return '¡Hola! Pregúntame el precio de cualquier servicio con tus cantidades —por ejemplo “¿cuánto cuesta un render de 5 imágenes?”— y te respondo con la cifra real del cotizador.';
  }
  if (section === 'variables') {
    return `Estás configurando ${serviceName ?? 'un servicio'}. Puedo desglosarte el precio, decirte qué incluye o cotizar otras cantidades.`;
  }
  return '¿Dudas sobre tu presupuesto? Pregúntame por el desglose, los plazos, el proceso o los archivos.';
}
