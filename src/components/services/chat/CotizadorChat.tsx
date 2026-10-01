import { useEffect, useMemo, useRef, useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { CONTACT_EMAIL } from '../../../lib/services/share';
import { quickRepliesFor } from '../../../lib/services/chat/chatIntents';
import type { ChatContext } from '../../../lib/services/chat/chatIntents';
import { basicReply } from '../../../lib/services/chat/basicAssistant';
import type { OpenQuoteAction } from '../../../lib/services/chat/deepLink';
import { openInCotizador } from '../../../lib/services/chat/deepLink';
import { CHAT_ENDPOINT, CHAT_TIMEOUT_MS, CHAT_PRIVACY_NOTE } from '../../../data/services/chatConfig';
import type { Currency } from '../../../data/services/types';

interface Msg { role: 'user' | 'bot'; text: string; actions?: OpenQuoteAction[]; chips?: string[]; source?: 'ai' | 'rules' }

/** Ciclo 24: además del contexto de sección, el asistente recibe el servicio y los
 *  valores en pantalla para cotizar y desglosar con el motor real. */
export interface CotizadorChatProps extends ChatContext {
  currency?: Currency;
  serviceId?: string;
  vals?: Record<string, number | string | boolean>;
}

/**
 * Ciclo 26 — asistente en dos capas:
 *  1. IA (worker `cotizador-chat`: Gemini → Groq) si CHAT_ENDPOINT está configurado.
 *     El worker solo publica respuestas cuyas cifras salen del motor (verificador).
 *  2. Modo básico reforzado (basicAssistant) ante CUALQUIER falla: sin endpoint, timeout,
 *     cuota, red o rechazo del verificador. El chat nunca queda mudo.
 * Cada respuesta puede traer acciones "Abrir en el cotizador" (deepLink).
 */
export function CotizadorChat(props: CotizadorChatProps) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [typing, setTyping] = useState(false);
  /** Último servicio del que se habló: permite seguir la conversación (“¿y con 10?”). */
  const lastSvc = useRef<string | undefined>(undefined);
  /** Tras 2 fallos seguidos de la IA, el resto de la sesión va en modo básico (no hacer esperar). */
  const aiFailures = useRef(0);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const aiEnabled = !!CHAT_ENDPOINT;

  const ctx: ChatContext = useMemo(() => ({ ...props, contactEmail: CONTACT_EMAIL }), [props]);

  useEffect(() => {
    if (open && msgs.length === 0) setMsgs([{ role: 'bot', text: greetingFor(ctx.section, ctx.serviceName) }]);
    if (open) setTimeout(() => inputRef.current?.focus(), 120);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [msgs, open, typing]);

  // ciclo 25: otros componentes pueden abrir el chat (p.ej. "No estoy seguro") con una pregunta inicial
  const pendingPrompt = useRef<string | null>(null);
  useEffect(() => {
    const onOpen = (e: Event) => {
      const prompt = (e as CustomEvent<{ prompt?: string }>).detail?.prompt;
      if (prompt) pendingPrompt.current = prompt;
      setOpen(true);
    };
    window.addEventListener('cx-open-chat', onOpen);
    return () => window.removeEventListener('cx-open-chat', onOpen);
  }, []);
  useEffect(() => {
    if (open && pendingPrompt.current && msgs.length > 0 && !typing) {
      const p = pendingPrompt.current; pendingPrompt.current = null; void send(p);
    }
  }, [open, msgs.length]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  /** Modo básico (determinista). Actualiza la memoria del último servicio. */
  const basic = (clean: string): Msg => {
    const r = basicReply(clean, { currency: props.currency ?? 'COP', serviceId: props.serviceId, vals: props.vals, lastServiceId: lastSvc.current });
    if (r.serviceId) lastSvc.current = r.serviceId;
    return { role: 'bot', text: r.text, actions: r.actions, chips: r.chips, source: 'rules' };
  };

  /** Capa IA: null ante cualquier problema (el llamador cae al modo básico). */
  const askAI = async (history: Msg[]): Promise<Msg | null> => {
    if (!aiEnabled || aiFailures.current >= 2) return null;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), CHAT_TIMEOUT_MS);
    try {
      const res = await fetch(CHAT_ENDPOINT, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ctrl.signal,
        body: JSON.stringify({
          messages: history.slice(-12).map((m) => ({ role: m.role === 'user' ? 'user' : 'assistant', text: m.text })),
          context: { currency: props.currency ?? 'COP', serviceId: props.serviceId ?? lastSvc.current, vals: props.vals },
        }),
      });
      const data = (await res.json()) as { reply?: string; actions?: OpenQuoteAction[]; fallback?: boolean };
      if (!res.ok || data.fallback || !data.reply) { aiFailures.current++; return null; }
      aiFailures.current = 0;
      return { role: 'bot', text: data.reply, actions: (data.actions ?? []).slice(0, 3), source: 'ai' };
    } catch {
      aiFailures.current++;
      return null;
    } finally { clearTimeout(timer); }
  };

  const send = async (text: string) => {
    const clean = text.trim().slice(0, 600);
    if (!clean || typing) return;
    const userMsg: Msg = { role: 'user', text: clean };
    const history = [...msgs, userMsg];
    setMsgs(history);
    setInput('');
    setTyping(true);
    const started = performance.now();
    const ai = await askAI(history);
    const rules = basic(clean); // siempre: mantiene la memoria y aporta sugerencias coherentes
    const answer: Msg = ai ? { ...ai, chips: rules.chips, actions: ai.actions?.length ? ai.actions : rules.actions } : rules;
    // microinteracción: "escribiendo…" mínimo breve (el modo básico es instantáneo)
    const wait = Math.max(0, Math.min(650, 250 + answer.text.length * 2) - (performance.now() - started));
    setTimeout(() => { setMsgs((m) => [...m, answer]); setTyping(false); }, wait);
  };

  const go = (a: OpenQuoteAction) => {
    openInCotizador(a.target);
    if (typeof window !== 'undefined' && window.innerWidth < 640) setOpen(false);
  };

  const last = msgs[msgs.length - 1];
  const chips = last?.role === 'bot' && last.chips?.length ? last.chips.slice(0, 4)
    : props.serviceId
      ? ['¿Por qué este precio?', '¿Qué incluye?', '¿Cómo lo hago más barato?']
      : ['¿Qué servicios hay?', 'Video de producto de 30 segundos', '¿Cuánto cuesta un chatbot?', ...quickRepliesFor(ctx).slice(2, 3)];

  return (
    <>
      <style>{`
        .cx-chat-fab { position: fixed; right: 18px; bottom: 96px; z-index: 60; width: 54px; height: 54px; border-radius: 16px; border: 1px solid var(--cx-accent-border); cursor: pointer;
          background: var(--cx-accent); color: var(--cx-on-accent); box-shadow: var(--cx-shadow-hover); display: grid; place-items: center;
          transition: transform .3s var(--cx-ease, ease), box-shadow .3s; }
        .cx-chat-fab:hover { transform: translateY(-3px) rotate(-4deg); }
        .cx-chat-fab .cx-chat-badge { position: absolute; top: -8px; right: -6px; font: 500 10px var(--cx-mono, monospace); letter-spacing: .08em;
          padding: 3px 7px; border-radius: 6px; background: var(--cx-signal, #67d4ff); color: var(--cx-bg); white-space: nowrap; }
        .cx-chat-panel { position: fixed; right: 18px; bottom: 96px; z-index: 61; width: min(380px, calc(100vw - 32px)); height: 540px; max-height: calc(100vh - 140px);
          display: flex; flex-direction: column; background: var(--cx-card-solid); color: var(--cx-text); border: 1px solid var(--cx-border-strong);
          border-radius: 16px; overflow: hidden; box-shadow: 0 24px 60px -20px rgba(0,0,0,.5); transform-origin: bottom right; animation: cx-chat-in .32s var(--cx-ease, ease) both; }
        @keyframes cx-chat-in { from { opacity: 0; transform: translateY(12px) scale(.96); } to { opacity: 1; transform: none; } }
        .cx-chat-head { display: flex; justify-content: space-between; align-items: center; padding: 12px 14px; border-bottom: 1px solid var(--cx-border); }
        .cx-chat-head small { display: block; font: 500 10px var(--cx-mono, monospace); letter-spacing: .14em; color: var(--cx-signal, var(--cx-accent)); text-transform: uppercase; }
        .cx-chat-msg { max-width: 88%; padding: 9px 12px; border-radius: 12px; font-size: 13px; line-height: 1.5; white-space: pre-wrap; animation: cx-chat-msg .28s var(--cx-ease, ease) both; }
        @keyframes cx-chat-msg { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
        .cx-chat-msg.user { background: var(--cx-accent); color: var(--cx-on-accent); border-bottom-right-radius: 4px; }
        .cx-chat-msg.bot { background: var(--cx-tile); color: var(--cx-text); border-bottom-left-radius: 4px; }
        .cx-chat-action { font: inherit; font-size: 12.5px; font-weight: 600; text-align: left; cursor: pointer; padding: 8px 12px; border-radius: 10px;
          color: var(--cx-accent); background: var(--cx-card-solid); border: 1px solid var(--cx-accent-border); transition: background .2s, transform .2s; }
        .cx-chat-action:hover { background: var(--cx-accent-soft); transform: translateX(2px); }
        .cx-chat-src { font: 500 9.5px var(--cx-mono, monospace); letter-spacing: .12em; text-transform: uppercase; color: var(--cx-faint); padding-left: 4px; }
        .cx-chat-typing { align-self: flex-start; display: inline-flex; gap: 4px; padding: 10px 12px; border-radius: 12px; background: var(--cx-tile); }
        .cx-chat-typing i { width: 6px; height: 6px; border-radius: 50%; background: var(--cx-muted); animation: cx-dot 1s infinite; }
        .cx-chat-typing i:nth-child(2) { animation-delay: .15s; } .cx-chat-typing i:nth-child(3) { animation-delay: .3s; }
        @keyframes cx-dot { 0%, 100% { opacity: .3; transform: none; } 50% { opacity: 1; transform: translateY(-3px); } }
        .cx-chat-chip { font: inherit; font-size: 11.5px; cursor: pointer; color: var(--cx-accent); border: 1px solid var(--cx-accent-border); background: var(--cx-accent-soft);
          border-radius: 999px; padding: 5px 10px; transition: transform .2s, background .2s; }
        .cx-chat-chip:hover { transform: translateY(-1px); }
        .cx-chat-input { flex: 1; font: inherit; font-size: 13px; padding: 10px 12px; border: 1px solid var(--cx-border-strong); border-radius: 10px; background: var(--cx-tile); color: var(--cx-text); }
        .cx-chat-send { font: inherit; font-size: 13px; font-weight: 700; cursor: pointer; background: var(--cx-accent); color: var(--cx-on-accent); border: none; border-radius: 10px; padding: 10px 14px; }
        .cx-chat-send:disabled { opacity: .5; cursor: default; }
        @media (max-width: 640px) { .cx-chat-fab { bottom: 128px; right: 14px; } .cx-chat-panel { right: 12px; left: 12px; width: auto; bottom: 12px; height: min(580px, calc(100vh - 24px)); max-height: none; } }
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
              <small>Asistente · precios reales{aiEnabled ? ' · IA' : ''}</small>
              <strong style={{ fontSize: 14 }}>{props.serviceName ?? 'Cotiza conversando'}</strong>
            </div>
            <button onClick={() => setOpen(false)} aria-label="Cerrar asistente"
              style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--cx-muted)', lineHeight: 1 }}>×</button>
          </div>

          <div ref={listRef} aria-live="polite" style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {msgs.map((m, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div className={`cx-chat-msg ${m.role}`}>{m.text}</div>
                {m.actions && m.actions.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxWidth: '88%' }}>
                    {m.actions.map((a, k) => <button key={k} type="button" className="cx-chat-action" onClick={() => go(a)}>{a.label} →</button>)}
                  </div>
                )}
                {m.role === 'bot' && m.source && <span className="cx-chat-src">{m.source === 'ai' ? 'IA · cifras verificadas' : 'Modo básico'}</span>}
              </div>
            ))}
            {typing && <div className="cx-chat-typing" aria-label="Escribiendo"><i /><i /><i /></div>}
          </div>

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', padding: '8px 12px 0' }}>
            {chips.map((c) => <button key={c} className="cx-chat-chip" onClick={() => void send(c)}>{c}</button>)}
          </div>

          {aiEnabled && <div style={{ padding: '6px 12px 0', fontSize: 10.5, color: 'var(--cx-faint)' }}>{CHAT_PRIVACY_NOTE}</div>}
          <form onSubmit={(e) => { e.preventDefault(); void send(input); }} style={{ display: 'flex', gap: 8, padding: 12 }}>
            <input ref={inputRef} className="cx-chat-input" value={input} onChange={(e) => setInput(e.target.value)} maxLength={600}
              placeholder="Ej.: ¿cuánto cuesta un video de 30 segundos?" aria-label="Mensaje para el asistente" />
            <button type="submit" className="cx-chat-send" disabled={typing}>Enviar</button>
          </form>
        </div>
      )}
    </>
  );
}

function greetingFor(section: ChatContext['section'], serviceName?: string): string {
  if (section === 'inicio') {
    return '¡Hola! Cuéntame qué quieres lograr o pregúntame un precio con tus cantidades —por ejemplo “video de producto de 30 segundos”— y te respondo con la cifra real del cotizador y un enlace para ajustarlo.';
  }
  if (section === 'variables') {
    return `Estás configurando ${serviceName ?? 'un servicio'}. Puedo desglosarte el precio, decirte cómo bajarlo, qué incluye o cotizar otras cantidades.`;
  }
  return '¿Dudas sobre tu presupuesto? Pregúntame por el desglose, los plazos, el proceso o los archivos.';
}
