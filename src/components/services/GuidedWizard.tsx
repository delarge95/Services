/**
 * GuidedWizard.tsx — Cotizador guiado por árbol de decisión.
 * Nivel 1: ¿Qué quieres lograr? → Nivel 2: tipo de experiencia → Nivel 3: detalles.
 * Preview 3D interactiva que cambia con los sliders + i18n ES/EN (ciclo 2.1).
 */

import { useState, useMemo, useEffect, useRef } from 'react';
import type { CSSProperties, Dispatch, SetStateAction } from 'react';
import { ROOT_OPTIONS, WEB3D_LEVEL2, WEB3D_BRANCHES } from '../../data/services/decisionTree';
import type { TreeQuestion, TreeBranch, TreeOption } from '../../data/services/decisionTree';
import { planFromTreeAnswers } from '../../data/services/treeToQuote';
import type { WizardQuotePlan } from '../../data/services/treeToQuote';
import { EN, TREE_EN } from '../../data/services/i18n';
import type { Lang } from '../../data/services/i18n';
import { BRAND } from '../../data/services/branding';
// ciclo 13: polyLabel se importa para la caption del detail (el contador de
// tris ya no flota como overlay sobre el canvas — vive en "Boceto — … · ≈ 4k tris")
import { ModelPreview, VARIANT_SLOTS, SLOT_DEFAULT_COLORS, polyLabel } from './ModelPreview';
import type { PreviewMode, VariantSlotsState } from './ModelPreview';
import { TreeIcon, ChatIcon, MailIcon, GearIcon, InfoIcon, ExternalIcon } from './icons';

type Answers = Record<string, string | number | boolean>;

/** Espejo EN de una rama (tipado laxo: ids dinámicos, fallback a ES). */
type BranchEn = {
  title?: string; subtitle?: string;
  questions?: Record<string, {
    question?: string; help?: string; unit?: string;
    options?: Record<string, { label: string; desc?: string }>;
    advanced?: Record<string, { label?: string; help?: string; options?: Record<string, string> }>;
  }>;
};
const branchEn = (id: string): BranchEn | undefined =>
  (TREE_EN.branches as Record<string, BranchEn | undefined>)[id];

export function GuidedWizard({ onComplete, lang = 'es', homeSignal = 0 }: { onComplete?: (plan: WizardQuotePlan, answers?: Record<string, string | number | boolean>) => void; lang?: Lang; homeSignal?: number }) {
  const [level, setLevel] = useState(1);
  const [rootChoice, setRootChoice] = useState('');
  const [subChoice, setSubChoice] = useState('');
  const [answers, setAnswers] = useState<Answers>({});
  const [showAdvanced, setShowAdvanced] = useState(false);
  const en = lang === 'en';
  const W = EN.wizard;

  // ── Historial del navegador (ciclo 6): el botón atrás del navegador navega
  // entre pasos del wizard en vez de salir de /cotizador. Solo en cliente. ──

  // push/replace history al cambiar de paso (y actualiza answers en el nivel 3).
  useEffect(() => {
    if (level === 1) return;
    const state = level === 2
      ? { cx: 'cotizador', level: 2 }
      : { cx: 'cotizador', level: 3, rootChoice, subChoice, answers };
    const cur = window.history.state;
    if (cur && cur.cx === 'cotizador' && cur.level === state.level && !cur.config) {
      window.history.replaceState(state, '');
    } else {
      window.history.pushState(state, '');
    }
  }, [level, rootChoice, subChoice, answers]);

  // Escucha popstate: restaura el paso correspondiente (nivel 1 = base).
  useEffect(() => {
    const onPop = () => {
      const st = window.history.state;
      if (st && st.cx === 'cotizador') {
        if (st.level === 2) {
          setLevel(2); setRootChoice('web-3d'); setSubChoice('');
        } else if (st.level === 3) {
          setLevel(3); setRootChoice(st.rootChoice ?? 'web-3d'); setSubChoice(st.subChoice ?? ''); setAnswers(st.answers ?? {});
        } else if (st.config !== undefined) {
          // config lo maneja el padre
        } else {
          setLevel(1); setRootChoice(''); setSubChoice('');
        }
      } else {
        setLevel(1); setRootChoice(''); setSubChoice('');
      }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // #1: home → reset total del wizard (aunque esté montado en nivel 3)
  useEffect(() => {
    if (homeSignal > 0) {
      setLevel(1); setRootChoice(''); setSubChoice(''); setAnswers({}); setShowAdvanced(false);
    }
  }, [homeSignal]);

  const branch: TreeBranch | null = useMemo(() => {
    if (rootChoice === 'web-3d' && subChoice) return WEB3D_BRANCHES[subChoice] ?? null;
    return null;
  }, [rootChoice, subChoice]);

  const set = (id: string, val: string | number | boolean) =>
    setAnswers(p => ({ ...p, [id]: val }));

  /** Texto ES/EN de una opción del árbol (raíz, nivel 2 o pregunta de rama). */
  const optText = (scope: '__root' | '__level2' | { branchId: string; qId: string }, o: TreeOption): { label: string; desc?: string } => {
    if (!en) return { label: o.label, desc: o.desc };
    if (typeof scope === 'string') {
      const table = scope === '__root'
        ? (TREE_EN.root as Record<string, { label: string; desc?: string }>)
        : (TREE_EN.level2 as Record<string, { label: string; desc?: string }>);
      const t = table[o.id];
      return { label: t?.label ?? o.label, desc: t?.desc ?? o.desc };
    }
    const t = branchEn(scope.branchId)?.questions?.[scope.qId]?.options?.[o.id];
    return { label: t?.label ?? o.label, desc: t?.desc ?? o.desc };
  };

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '0 20px 80px' }}>
      {/* ═══ NIVEL 1: ¿Qué quieres lograr? ═══ */}
      {level === 1 && (
        <div style={{ paddingTop: 60 }}>
          <h1 style={{
            fontSize: 'clamp(2.2rem, 5vw, 3.5rem)', fontWeight: 700,
            letterSpacing: '-0.03em', color: 'var(--cx-text)', textAlign: 'center',
            margin: '0 0 12px', lineHeight: 1.1,
          }}>{en ? W.l1Title : '¿Qué quieres lograr?'}</h1>
          <p style={{ fontSize: 17, color: 'var(--cx-muted)', textAlign: 'center', margin: '0 0 10px' }}>
            {en ? W.l1Sub : 'Elige una opción y te guiamos paso a paso.'}
          </p>
          {/* ciclo 11: prototipo en vivo — la demo real del trabajo (Twinsight X500) */}
          <div style={{ textAlign: 'center', margin: '0 0 44px' }}>
            <a href={BRAND.prototypeUrl} target="_blank" rel="noopener noreferrer" className="cx-prototype-link cx-protolink"
              style={{ fontSize: 14.5, fontWeight: 500, color: 'var(--cx-accent)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              {en ? W.prototypeLink : 'Mira un prototipo en vivo: Twinsight X500'}
              <ExternalIcon size={13} />
            </a>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
            {ROOT_OPTIONS.filter(o => o.id !== 'no-se').map((o, i) => {
              const t = optText('__root', o);
              return (
                <button key={o.id}
                  onClick={() => { setRootChoice(o.id); setLevel(o.id === 'no-se' ? 1 : 2); }}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 14, padding: '20px 22px',
                    background: 'var(--cx-card)', backdropFilter: 'blur(12px)',
                    border: '1px solid var(--cx-border)', borderRadius: 20,
                    cursor: 'pointer', font: 'inherit', textAlign: 'left',
                    transition: 'transform 0.25s cubic-bezier(0.25,0.8,0.4,1), box-shadow 0.25s',
                    animation: `cardIn 0.4s ${i * 0.06}s cubic-bezier(0.25,0.8,0.4,1) both`,
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = 'var(--cx-shadow-hover)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}
                >
                  <span style={{ color: 'var(--cx-accent)', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                    <TreeIcon name={o.icon ?? ''} size={26} />
                  </span>
                  <div>
                    <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--cx-text)', letterSpacing: '-0.01em' }}>{t.label}</div>
                    <div style={{ fontSize: 13, color: 'var(--cx-muted)', marginTop: 3, lineHeight: 1.4 }}>{t.desc}</div>
                  </div>
                </button>
              );
            })}
          </div>
          <div style={{ textAlign: 'center', marginTop: 24 }}>
            <button onClick={() => setRootChoice('no-se')} className="cx-softbtn"
              style={{ font: '500 15px inherit', color: 'var(--cx-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: '8px 20px' }}>
              {en ? W.notSure : 'No estoy seguro — ayúdame a decidir →'}
            </button>
          </div>
        </div>
      )}

      {/* NO ESTOY SEGURO */}
      {level === 1 && rootChoice === 'no-se' && (
        <div style={{ paddingTop: 60, textAlign: 'center' }}>
          <h2 style={{ fontSize: 'clamp(1.8rem,3vw,2.4rem)', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--cx-text)', margin: '0 0 8px' }}>{en ? W.ideaTitle : 'Cuéntame tu idea'}</h2>
          <p style={{ fontSize: 15, color: 'var(--cx-muted)', margin: '0 0 40px' }}>{en ? W.ideaSub : 'No necesitas saber cómo se llama — describe lo que imaginas.'}</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 14, maxWidth: 520, margin: '0 auto' }}>
            <a href={`https://wa.me/${BRAND.whatsappNumber}`} target='_blank' rel='noopener noreferrer' style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '28px 24px', background: 'var(--cx-card)', backdropFilter: 'blur(12px)', border: '1px solid var(--cx-border)', borderRadius: 20, textDecoration: 'none', font: 'inherit', textAlign: 'center' }}>
              <span style={{ color: 'var(--cx-accent)', display: 'flex' }}><ChatIcon size={30} /></span>
              <strong style={{ fontSize: 17, fontWeight: 700, color: 'var(--cx-text)' }}>{en ? W.whatsapp : 'WhatsApp'}</strong>
              <span style={{ fontSize: 13, color: 'var(--cx-muted)' }}>{en ? W.ideaWa : 'Describe tu idea y te respondo'}</span>
            </a>
            <a href={`mailto:${BRAND.contactEmail}?subject=${encodeURIComponent(en ? 'Project idea' : 'Idea de proyecto')}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '28px 24px', background: 'var(--cx-card)', backdropFilter: 'blur(12px)', border: '1px solid var(--cx-border)', borderRadius: 20, textDecoration: 'none', font: 'inherit', textAlign: 'center' }}>
              <span style={{ color: 'var(--cx-accent)', display: 'flex' }}><MailIcon size={30} /></span>
              <strong style={{ fontSize: 17, fontWeight: 700, color: 'var(--cx-text)' }}>{en ? W.email : 'Correo'}</strong>
              <span style={{ fontSize: 13, color: 'var(--cx-muted)' }}>{en ? W.ideaMail : 'Adjunta archivos si los tienes'}</span>
            </a>
          </div>
          <button onClick={() => setRootChoice('')} style={{ marginTop: 20, font: '600 14px inherit', color: 'var(--cx-accent)', background: 'none', border: 'none', cursor: 'pointer' }}>{en ? W.back : '← Volver'}</button>
        </div>
      )}

      {/* RAMAS PRÓXIMAMENTE (video / imágenes / IA): contacto directo, sin dead-end */}
      {level === 2 && rootChoice !== 'web-3d' && (
        <div style={{ paddingTop: 60, textAlign: 'center' }}>
          <h2 style={{ fontSize: 'clamp(1.8rem,3vw,2.4rem)', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--cx-text)', margin: '0 0 8px' }}>{en ? W.comingTitle : 'Te cotizo esto personalmente'}</h2>
          <p style={{ fontSize: 15, color: 'var(--cx-muted)', margin: '0 auto 40px', maxWidth: 440, lineHeight: 1.5 }}>
            {en ? W.comingSub : 'El cotizador guiado cubre webs con 3D. Para video, imágenes o IA escríbeme directamente y te respondo con una propuesta en menos de 24 h.'}
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 14, maxWidth: 520, margin: '0 auto' }}>
            <a href={`https://wa.me/${BRAND.whatsappNumber}`} target='_blank' rel='noopener noreferrer' style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '28px 24px', background: 'var(--cx-card)', backdropFilter: 'blur(12px)', border: '1px solid var(--cx-border)', borderRadius: 20, textDecoration: 'none', font: 'inherit', textAlign: 'center' }}>
              <span style={{ color: 'var(--cx-accent)', display: 'flex' }}><ChatIcon size={30} /></span>
              <strong style={{ fontSize: 17, fontWeight: 700, color: 'var(--cx-text)' }}>{en ? W.whatsapp : 'WhatsApp'}</strong>
              <span style={{ fontSize: 13, color: 'var(--cx-muted)' }}>{en ? W.comingWa : 'Cuéntame tu proyecto'}</span>
            </a>
            <a href={`mailto:${BRAND.contactEmail}?subject=${encodeURIComponent(en ? 'Project quote' : 'Cotización de proyecto')}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '28px 24px', background: 'var(--cx-card)', backdropFilter: 'blur(12px)', border: '1px solid var(--cx-border)', borderRadius: 20, textDecoration: 'none', font: 'inherit', textAlign: 'center' }}>
              <span style={{ color: 'var(--cx-accent)', display: 'flex' }}><MailIcon size={30} /></span>
              <strong style={{ fontSize: 17, fontWeight: 700, color: 'var(--cx-text)' }}>{en ? W.email : 'Correo'}</strong>
              <span style={{ fontSize: 13, color: 'var(--cx-muted)' }}>{en ? W.comingMail : 'Con referencias si tienes'}</span>
            </a>
          </div>
          <button onClick={() => setLevel(1)} style={{ marginTop: 20, font: '600 14px inherit', color: 'var(--cx-accent)', background: 'none', border: 'none', cursor: 'pointer' }}>{en ? W.back : '← Volver'}</button>
        </div>
      )}

      {/* ═══ NIVEL 2 (web-3d): ¿Qué tipo de experiencia? ═══ */}
      {level === 2 && rootChoice === 'web-3d' && (
        <div style={{ paddingTop: 40 }}>
          <button onClick={() => { if (typeof window !== 'undefined') window.history.back(); }} className="cx-back"
            style={{ font: '600 14px inherit', color: 'var(--cx-accent)', background: 'none', border: 'none', cursor: 'pointer', marginBottom: 20 }}>{en ? W.back : '← Atrás'}</button>
          <h2 style={{ fontSize: 'clamp(1.8rem, 4vw, 2.5rem)', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--cx-text)', margin: '0 0 8px' }}>
            {en ? W.l2Title : '¿Qué tipo de web con 3D?'}
          </h2>
          <p style={{ fontSize: 15, color: 'var(--cx-muted)', margin: '0 0 32px' }}>{en ? W.l2Sub : 'No necesitas saber términos técnicos — describe lo que imaginas.'}</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
            {WEB3D_LEVEL2.map((o, i) => {
              const t = optText('__level2', o);
              return (
                <button key={o.id}
                  onClick={() => { setSubChoice(o.id); setLevel(3); }}
                  style={{
                    display: 'flex', flexDirection: 'column', gap: 6, padding: '22px 20px',
                    background: 'var(--cx-card)', backdropFilter: 'blur(12px)',
                    border: '1px solid var(--cx-border)', borderRadius: 20,
                    cursor: 'pointer', font: 'inherit', textAlign: 'left',
                    animation: `cardIn 0.4s ${i * 0.06}s both`,
                  }}>
                  <span style={{ color: 'var(--cx-accent)', display: 'flex', marginBottom: 8 }}>
                    <TreeIcon name={o.icon ?? ''} size={24} />
                  </span>
                  <strong style={{ fontSize: 17, fontWeight: 700, color: 'var(--cx-text)', letterSpacing: '-0.01em' }}>{t.label}</strong>
                  <span style={{ fontSize: 13, color: 'var(--cx-muted)', lineHeight: 1.45 }}>{t.desc}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══ NIVEL 3: Preguntas específicas de la rama ═══ */}
      {level === 3 && branch && (
        <div style={{ paddingTop: 40 }}>
          <button onClick={() => { if (typeof window !== 'undefined') window.history.back(); }} className="cx-back"
            style={{ font: '600 14px inherit', color: 'var(--cx-accent)', background: 'none', border: 'none', cursor: 'pointer', marginBottom: 20 }}>{en ? W.back : '← Atrás'}</button>
          <h2 style={{ fontSize: 'clamp(1.6rem, 3vw, 2.2rem)', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--cx-text)', margin: '0 0 6px' }}>
            {en ? branchEn(branch.id)?.title ?? branch.title : branch.title}
          </h2>
          <p style={{ fontSize: 15, color: 'var(--cx-muted)', margin: '0 0 36px' }}>
            {en ? branchEn(branch.id)?.subtitle ?? branch.subtitle : branch.subtitle}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
            {branch.questions.filter(q => !q.advanced || showAdvanced).map((q) => (
              <QuestionCard key={q.id} q={q} answers={answers} onAnswer={set} lang={lang} branchId={branch.id} />
            ))}

            {/* Opciones avanzadas */}
            {branch.questions.some(q => q.advanced) && !showAdvanced && (
              <button onClick={() => setShowAdvanced(true)}
                style={{
                  alignSelf: 'center', display: 'inline-flex', alignItems: 'center', gap: 8,
                  padding: '10px 24px', borderRadius: 999,
                  font: '600 14px inherit', color: 'var(--cx-accent)',
                  background: 'none', border: '1px solid var(--cx-accent-border)', cursor: 'pointer',
                }}>
                <GearIcon size={16} /> {en ? W.opcionesTecnicas : 'Opciones técnicas'}
              </button>
            )}
          </div>

          {/* Ver precio → mapea respuestas a servicios y cotiza */}
          <button
            onClick={() => {
              const plan = planFromTreeAnswers(rootChoice, subChoice, answers);
              if (typeof window !== 'undefined') {
                window.history.pushState({ cx: 'cotizador', config: plan.picks[0]?.serviceId, draft: { rootChoice, subChoice, answers }, plan }, '');
              }
              onComplete?.(plan, answers);
            }}
            style={{
              marginTop: 32, width: '100%', padding: '16px', borderRadius: 999,
              background: '#0071e3', color: '#fff', border: 'none',
              font: '700 16px inherit', letterSpacing: '-0.01em', cursor: 'pointer',
              transition: 'background 0.2s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--cx-accent-hover)'}
            onMouseLeave={e => e.currentTarget.style.background = '#0071e3'}
          >
            {en ? W.verPrecio : 'Ver precio estimado →'}
          </button>
          <p style={{ fontSize: 12, color: 'var(--cx-faint)', textAlign: 'center', margin: '10px 0 0' }}>
            {en ? W.hint : 'Si algo quedó sin responder usamos un valor recomendado — después lo ajustas.'}
          </p>
        </div>
      )}

      <style>{`
        @keyframes cardIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: none; } }
        .cx-tip:hover .cx-tip-box, .cx-tip:focus .cx-tip-box { opacity: 1 !important; visibility: visible !important; }
        /* ciclo 12 — área táctil del "?" invisible (16px visual -> 36px de hit
           area) sin romper el minimalismo; aplica en todos los viewports. */
        .cx-tip::before { content: ''; position: absolute; inset: -10px; border-radius: 50%; }
        /* ciclo 12 — móvil: pills de slots del configurador y opciones técnicas
           alcanzan 36px de alto táctil (antes ~27px). */
        @media (max-width: 768px) {
          button[data-slot-id] { min-height: 36px; }
          .cx-adv-btn { min-height: 36px; }
        }
      `}</style>
    </div>
  );
}

// ═══ Editor inline (ciclo 8, #4): todas las configuraciones del wizard en
// UNA sola card compacta, con las respuestas conservadas y previews 3D. ═══
export function WizardEditInline({ rootChoice, subChoice, initialAnswers, lang = 'es', onApply, onClose }: {
  rootChoice: string; subChoice: string;
  initialAnswers: Record<string, string | number | boolean>;
  lang?: Lang;
  onApply?: (answers: Record<string, string | number | boolean>) => void;
  onClose?: () => void;
}) {
  const [answers, setAnswers] = useState<Answers>(initialAnswers);
  const branch: TreeBranch | null = WEB3D_BRANCHES[subChoice] ?? null;
  const en = lang === 'en';
  const set = (id: string, val: string | number | boolean) => setAnswers(p => ({ ...p, [id]: val }));

  return (
    <div style={{
      background: 'var(--cx-card)', backdropFilter: 'blur(12px)',
      border: '1px solid var(--cx-accent-border)', borderRadius: 20, padding: 24,
      display: 'flex', flexDirection: 'column', gap: 20,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong style={{ fontSize: 15, color: 'var(--cx-text)' }}>
          {en ? 'Edit your configurations' : 'Edita tus configuraciones'}
        </strong>
        <button onClick={() => onClose?.()}
          style={{ font: '600 13px inherit', color: 'var(--cx-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>
          {en ? 'Close ✕' : 'Cerrar ✕'}
        </button>
      </div>
      {branch ? branch.questions.map(q => (
        <QuestionCard key={q.id} q={q} answers={answers} onAnswer={set} lang={lang} branchId={branch.id} compact />
      )) : (
        <span style={{ fontSize: 13, color: 'var(--cx-muted)' }}>{en ? 'No questions for this branch.' : 'Sin preguntas para esta rama.'}</span>
      )}
      <button
        onClick={() => onApply?.(answers)}
        style={{
          padding: '13px', borderRadius: 999, background: '#0071e3', color: '#fff', border: 'none',
          font: '700 15px inherit', cursor: 'pointer',
        }}
        onMouseEnter={e => e.currentTarget.style.background = 'var(--cx-accent-hover)'}
        onMouseLeave={e => e.currentTarget.style.background = '#0071e3'}
      >
        {en ? 'Apply and update price →' : 'Aplicar y actualizar precio →'}
      </button>
    </div>
  );
}

// ═══ InfoTip (#9): botón "?" con letrero al hover — aclara que lo que se ve
// en los previews son EJEMPLOS ilustrativos y explica la sección. ═══
function InfoTip({ text }: { text: string }) {
  return (
    <span className="cx-tip" tabIndex={0} role="note" aria-label={text}
      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', position: 'relative',
        width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
        border: '1px solid var(--cx-border-strong)', color: 'var(--cx-muted)',
        fontSize: 10, fontWeight: 700, cursor: 'help', userSelect: 'none' }}>
      ?
      <span className="cx-tip-box" role="tooltip" style={{
        position: 'absolute', bottom: 'calc(100% + 8px)', right: -8, width: 240, zIndex: 30,
        background: 'var(--cx-card-solid)', color: 'var(--cx-text)', border: '1px solid var(--cx-border-strong)',
        borderRadius: 10, padding: '8px 10px', fontSize: 11, fontWeight: 500, lineHeight: 1.45,
        boxShadow: 'var(--cx-shadow-hover)', opacity: 0, visibility: 'hidden', transition: 'opacity .2s',
        pointerEvents: 'none', textAlign: 'left',
      }}>{text}</span>
    </span>
  );
}

/** Texto del "?" para una pregunta (ejemplos + descripción de la sección). */
function tipFor(q: TreeQuestion, en: boolean): string {
  const ex = en ? 'What you see are illustrative examples with a sample model.' : 'Lo que se ve son ejemplos ilustrativos con un modelo de muestra.';
  const byPreview: Record<string, string> = {
    'detail-level': en
      ? 'Shows how detail grows on a sample model as the level rises. Drag the model to spin it.'
      : 'Muestra cómo crece el detalle de un modelo de muestra al subir el nivel. Arrastra el modelo para girarlo.',
    assembly: en
      ? 'Real drone (HolyBro X500): each unit of the slider adds exactly one part. After 3 s idle it alternates assembled/exploded.'
      : 'Dron real (HolyBro X500): cada unidad del slider añade exactamente una pieza. Tras 3 s sin mover el slider alterna armado/explosionado.',
    'piece-count': en
      ? 'Real drone (HolyBro X500): each unit of the slider adds exactly one part. After 3 s idle it alternates assembled/exploded.'
      : 'Dron real (HolyBro X500): cada unidad del slider añade exactamente una pieza. Tras 3 s sin mover el slider alterna armado/explosionado.',
    story: en
      ? 'The animations are examples of the moments your page will play on scroll. Click a moment to view it.'
      : 'Las animaciones son ejemplos de los momentos que tu página reproducirá al hacer scroll. Haz click en un momento para verlo.',
    'variant-swirl': en
      ? 'The options are examples of the real capabilities your configurator will offer.'
      : 'Las opciones son ejemplos de las capacidades reales que ofrecerá tu configurador.',
    'surface-morph': en
      ? 'The morph illustrates the surface complexity being quoted (sample part).'
      : 'El morph ilustra la complejidad de superficie que se está cotizando (pieza de muestra).',
    finish: en
      ? 'Real drone with the selected finish applied.'
      : 'Dron real con el acabado elegido aplicado.',
  };
  const extra = (q.slider?.preview && byPreview[q.slider.preview]) || (q.preview === 'finish' ? byPreview.finish : '') || ex;
  return extra;
}

// ═══ Question Card — renderiza según tipo ═══
function QuestionCard({ q, answers, onAnswer, lang, branchId, compact = false }: {
  q: TreeQuestion; answers: Answers; onAnswer: (id: string, val: string | number | boolean) => void; lang: Lang; branchId: string; compact?: boolean;
}) {
  const current = answers[q.id];
  const en = lang === 'en';
  const qEn = en ? branchEn(branchId)?.questions?.[q.id] : undefined;

  return (
    <div style={compact ? {
      padding: 0,
    } : {
      background: 'var(--cx-card)', backdropFilter: 'blur(12px)',
      border: '1px solid var(--cx-border)', borderRadius: 20, padding: 24,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <div style={{ fontSize: 15.5, fontWeight: 600, color: 'var(--cx-text)', flex: 1 }}>{qEn?.question ?? q.question}</div>
        <InfoTip text={tipFor(q, en) + ((qEn?.help ?? q.help) ? ` ${qEn?.help ?? q.help}` : '')} />
      </div>
      {(qEn?.help ?? q.help) && <div style={{ fontSize: 13, color: 'var(--cx-muted)', marginBottom: 14, lineHeight: 1.45 }}>{qEn?.help ?? q.help}</div>}

      {/* Ciclo 10: el preview usa un asset temporal — nota profesional aclaratoria */}
      {q.demoAsset && (
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 7, marginBottom: 14,
          fontSize: 12, color: 'var(--cx-muted)', lineHeight: 1.45,
        }}>
          <span style={{ display: 'inline-flex', flexShrink: 0, marginTop: 1 }}>
            <InfoIcon size={14} />
          </span>
          <span>
            {en ? EN.wizard.demoAsset : 'Vista con un asset de demostración en desarrollo — en la versión final se representa tu producto con sus propios modelos.'}
          </span>
        </div>
      )}

      {/* Preview de tarjetas: acabados con el modelo real (HolyBro X500) */}
      {q.type === 'cards' && q.preview === 'finish' && (
        <div style={{ marginBottom: 14 }}>
          <ModelPreview mode="finish" finish={(typeof current === 'string' && ['simple', 'variado', 'detallado'].includes(current) ? current : 'variado') as 'simple' | 'variado' | 'detallado'} lang={lang} height={290} />
          <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--cx-muted)', marginTop: 2 }}>
            {en ? 'Real model (HolyBro X500) with the selected finish' : 'Modelo real (HolyBro X500) con el acabado elegido'}
          </div>
        </div>
      )}

      {/* CARDS */}
      {q.type === 'cards' && q.options && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
          {q.options.map(o => {
            const t = en
              ? { label: qEn?.options?.[o.id]?.label ?? o.label, desc: qEn?.options?.[o.id]?.desc ?? o.desc }
              : { label: o.label, desc: o.desc };
            return (
              <button key={o.id} onClick={() => onAnswer(q.id, o.id)}
                style={{
                  padding: '16px 18px', borderRadius: 16, font: 'inherit', cursor: 'pointer', textAlign: 'left',
                  border: current === o.id ? '2px solid var(--cx-accent)' : '1px solid var(--cx-border)',
                  background: current === o.id ? 'var(--cx-accent-soft)' : 'var(--cx-card-solid)',
                  color: 'var(--cx-text)',
                  transition: 'border-color 0.2s, background 0.2s',
                }}>
                <div style={{ fontSize: 15, fontWeight: 600 }}>{t.label}</div>
                {t.desc && <div style={{ fontSize: 12, color: 'var(--cx-muted)', marginTop: 2, lineHeight: 1.4 }}>{t.desc}</div>}
              </button>
            );
          })}
        </div>
      )}

      {/* SLIDER */}
      {q.type === 'slider' && q.slider && (
        <SliderWithPreview
          branchId={branchId}
          questionId={q.id}
          config={q.slider}
          value={typeof current === 'number' ? current : q.slider.min}
          onChange={(n) => onAnswer(q.id, n)}
          lang={lang}
        />
      )}

      {/* SELECT */}
      {q.type === 'select' && q.options && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {q.options.map(o => {
            const label = en ? qEn?.options?.[o.id]?.label ?? o.label : o.label;
            return (
              <button key={o.id} onClick={() => onAnswer(q.id, o.id)}
                style={{
                  padding: '10px 20px', borderRadius: 999, font: `500 14px inherit`, cursor: 'pointer',
                  border: current === o.id ? '2px solid var(--cx-accent)' : '1px solid var(--cx-border-strong)',
                  background: current === o.id ? 'var(--cx-accent-soft)' : 'var(--cx-card-solid)', color: 'var(--cx-text)',
                }}>{label}</button>
            );
          })}
        </div>
      )}

      {/* TOGGLE (avanzado) */}
      {q.type === 'toggle' && (
        <div onClick={() => onAnswer(q.id, !current)}
          style={{
            width: 48, height: 28, borderRadius: 14, cursor: 'pointer', position: 'relative',
            background: current ? '#30d158' : 'var(--cx-soft)', transition: 'background 0.25s',
          }}>
          <div style={{
            position: 'absolute', top: 2, left: current ? 22 : 2, width: 24, height: 24,
            borderRadius: '50%', background: 'var(--cx-card-solid)', boxShadow: 'var(--cx-shadow-knob)',
            transition: 'left 0.25s cubic-bezier(0.3,0.9,0.4,1)',
          }} />
        </div>
      )}
      <details style={{ marginTop: 12 }}>
        <summary style={{ cursor: 'pointer', fontSize: 12, color: 'var(--cx-faint)', listStyle: 'none', userSelect: 'none' }}>
          {en ? EN.wizard.detalles : '+ Detalles técnicos (opcional)'}
        </summary>
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px dashed var(--cx-soft)', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {(q.advancedOptions || []).map((adv) => {
            const aEn = en ? qEn?.advanced?.[adv.id] : undefined;
            return (
              <div key={adv.id}>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--cx-muted)' }}>{aEn?.label ?? adv.label}</div>
                {(aEn?.help ?? adv.help) && <div style={{ fontSize: 11, color: 'var(--cx-faint)', marginBottom: 4 }}>{aEn?.help ?? adv.help}</div>}
                {adv.type === 'select' && adv.options && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {adv.options.map((o) => (
                      <button key={o.id} onClick={() => onAnswer(adv.id, o.id)} className="cx-adv-btn" style={{ padding: '5px 12px', borderRadius: 8, font: '400 12px inherit', cursor: 'pointer', border: answers[adv.id] === o.id ? '1.5px solid var(--cx-accent)' : '1px solid var(--cx-border)', background: answers[adv.id] === o.id ? 'var(--cx-accent-soft)' : 'var(--cx-tile)', color: answers[adv.id] === o.id ? 'var(--cx-accent)' : 'var(--cx-muted)' }}>{aEn?.options?.[o.id] ?? o.label}</button>
                    ))}
                  </div>
                )}
                {adv.type === 'slider' && (() => {
                  const av = answers[adv.id];
                  return (
                    <input type='range' min={adv.min || 1} max={adv.max || 5} step={adv.step || 1}
                      value={typeof av === 'number' ? av : adv.defaultValue ?? adv.min ?? 1}
                      onChange={e => onAnswer(adv.id, Number(e.target.value))}
                      style={{ width: '100%', height: 4, accentColor: '#0071e3' }} />
                  );
                })()}
              </div>
            );
          })}
          {!(q.advancedOptions || []).length && <span style={{ fontSize: 12, color: 'var(--cx-faint)' }}>{en ? EN.wizard.sinOpciones : 'Sin opciones para esta pregunta.'}</span>}
        </div>
      </details>
    </div>
  );
}

// ═══ Slider con Preview 3D procedural ═══
function SliderWithPreview({ branchId, questionId, config, value, onChange, lang }: {
  branchId: string; questionId: string; config: NonNullable<TreeQuestion['slider']>;
  value: number; onChange: (n: number) => void; lang: Lang;
}) {
  const en = lang === 'en';
  const qEn = en ? branchEn(branchId)?.questions?.[questionId] : undefined;

  // ciclo 5: estado de SLOTS ADITIVOS del configurador (sin ejes fijos).
  // Los slots desbloqueados nacen activos; apagar uno quita su efecto en vivo.
  // Las 3 luces son excluyentes: nace activa solo la primera (luz de estudio).
  const [slots, setSlots] = useState<VariantSlotsState>({
    on: VARIANT_SLOTS.map((_, i) => defaultSlotOn(i)),
    colors: { ...SLOT_DEFAULT_COLORS },
  });
  const tierHint = config.tierMap?.find(t => value <= t.max)?.tier ?? '';
  const preview = config.preview;
  const continuous = config.continuous === true;
  const shown = continuous ? Math.round(value * 10) / 10 : value;
  const pct = ((shown - config.min) / (config.max - config.min)) * 100;
  const unit = qEn?.unit ?? config.unit;

  // 1.1: snapping magnético a los puntos discretos al soltar
  const snapOnRelease = () => {
    if (!continuous) return;
    const snapped = Math.round(value);
    if (Math.abs(value - snapped) <= 0.25) onChange(snapped);
  };

  const applyValue = (clientX: number, el: HTMLDivElement) => {
    const r = el.getBoundingClientRect();
    const p = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    const raw = config.min + p * (config.max - config.min);
    const step = continuous ? 0.1 : config.step;
    onChange(Math.round(raw / step) * step);
  };

  // (ciclo 5: la selección por ejes color/material/accesorio fue sustituida por
  // los slots aditivos — estado `slots` al inicio del componente)

  let mode: PreviewMode | undefined;
  let caption = '';
  if (preview === 'detail-level') {
    mode = 'detail';
    const caps = en ? EN.wizard.detailCaptions : ['Boceto — solo geometría', 'Base — formas simples', 'Web — listo para producción', 'Alto — detalles finos', 'Máximo — nivel fotorrealista'];
    // ciclo 13: el contador de tris se integra a la caption (antes era un
    // overlay flotante arriba a la derecha que confundía fuera de contexto)
    caption = `${caps[Math.round(Math.min(5, Math.max(1, value))) - 1]} · ${polyLabel(shown)}`;
  } else if (preview === 'piece-count') {
    mode = 'pieces';
    caption = en ? `${value} ${value === 1 ? EN.wizard.pieceSingular : EN.wizard.piecePlural}` : `${value} ${value === 1 ? 'pieza en el ensamblaje' : 'piezas en el ensamblaje'}`;
  } else if (preview === 'story') {
    mode = 'story';
    caption = en
      ? `Your page will play ${value} animated moment${value === 1 ? '' : 's'} — they play in sequence`
      : `Tu página reproducirá ${value} momento${value === 1 ? '' : 's'} animado${value === 1 ? '' : 's'} — se reproducen en secuencia`;
  } else if (preview === 'variant-swirl') {
    mode = 'variants';
  } else if (preview === 'assembly') {
    mode = 'assembly';
    caption = en
      ? 'Real model (HolyBro X500): each unit of the slider adds exactly one part'
      : 'Modelo real (HolyBro X500): cada unidad del slider añade exactamente una pieza';
  } else if (preview === 'shader-dial') {
    mode = 'shader-dial';
    const caps = en
      ? ['Photoreal (PBR)', 'Product — clean studio', 'Semi-real grading', 'Toon / stylized', 'Hologram — full effect']
      : ['Fotorrealista (PBR)', 'Producto — estudio limpio', 'Semirrealista', 'Toon / estilizado', 'Holograma — efecto completo'];
    caption = caps[Math.round(Math.min(5, Math.max(1, value))) - 1];
  } else if (preview === 'surface-morph') {
    mode = 'surface';
    const caps = en
      ? ['Hard prismatic', 'Softening edges', 'Curved surfaces', 'Complex freeform', 'Sculpted — quoted via discovery']
      : ['Prismática dura', 'Bordes suavizándose', 'Curvas complejas', 'Freeform compleja', 'Esculpidas — se acota en discovery'];
    caption = caps[Math.round(Math.min(5, Math.max(1, value))) - 1];
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Preview WebGL procedural — reacciona al slider, se puede arrastrar */}
      {mode && (
        <div>
          {/* ciclo 11: previews a 290px de alto (antes 240) — sin corte vertical */}
          <ModelPreview mode={mode} detail={shown} pieces={value} story={value} surface={value}
            variantSlots={mode === 'variants' ? slots : undefined} estilo={value} lang={lang}
            height={290} />
          {mode !== 'variants' && (
            <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--cx-muted)', marginTop: 2 }}>{caption}</div>
          )}
        </div>
      )}

      {/* ciclo 5: configurador por SLOTS ADITIVOS — cada slot una función única,
          desbloqueados por el slider, ON/OFF con click, efecto en tiempo real */}
      {mode === 'variants' && <VariantSlotsPanel value={value} lang={lang} slots={slots} setSlots={setSlots} />}

      {/* Valor actual — ciclo 10: en assembly el máximo se etiqueta "50+"
          (a 50 el modelo completo es visible, incluida tornillería) */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <strong style={{ fontSize: 24, fontWeight: 700, color: 'var(--cx-accent)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>
          {shown}{config.preview === 'assembly' && value >= config.max ? '+' : ''}
          <span style={{ fontSize: 14, color: 'var(--cx-muted)', fontWeight: 400, marginLeft: 6 }}>{unit}</span>
        </strong>
        {tierHint && (
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--cx-accent)', background: 'var(--cx-accent-soft)', padding: '2px 10px', borderRadius: 6 }}>
            {tierHint}
          </span>
        )}
      </div>

      {/* Track — con puntos de snapping visibles en los sliders continuos */}
      <div
        style={{ position: 'relative', height: 6, borderRadius: 3, background: 'var(--cx-soft)', cursor: 'pointer', touchAction: 'none' }}
        onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); applyValue(e.clientX, e.currentTarget); }}
        onPointerMove={(e) => { if (e.buttons !== 1) return; applyValue(e.clientX, e.currentTarget); }}
        onPointerUp={snapOnRelease}
      >
        <div style={{
          position: 'absolute', left: 0, top: 0, height: '100%', borderRadius: 3,
          width: `${pct}%`, background: 'linear-gradient(90deg, #0071e3, #5ac8fa)',
        }} />
        {continuous && Array.from({ length: Math.round(config.max - config.min) + 1 }, (_, i) => {
          const sp = config.min + i;
          const spct = ((sp - config.min) / (config.max - config.min)) * 100;
          return <div key={sp} style={{ position: 'absolute', top: 1, left: `calc(${spct}% - 2.5px)`, width: 5, height: 5, borderRadius: '50%', background: 'var(--cx-card-solid)', boxShadow: '0 0 0 1px var(--cx-border-strong)' }} />;
        })}
        <div style={{
          position: 'absolute', top: -8, left: `calc(${pct}% - 11px)`, width: 22, height: 22,
          borderRadius: '50%', background: 'var(--cx-card-solid)', border: '0.5px solid var(--cx-border)',
          boxShadow: 'var(--cx-shadow-knob)',
        }} />
      </div>

      {/* Labels min/max — ciclo 10: el máximo del assembly se muestra "50+" */}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--cx-faint)' }}>
        <span>{config.min} {unit}</span>
        <span>{config.preview === 'assembly' ? `${config.max}+` : config.max} {unit}</span>
      </div>
    </div>
  );
}

/** Colores de los swatches de los slots de color (ES/EN iguales, hex). */
const SLOT_COLORS = ['#3a3f47', '#eef0f2', '#0071e3', '#ff6b57', '#2e7d4f', '#c9b99a'];

/** Estado inicial de un slot (ciclo 9): TODO nace apagado EXCEPTO la primera
 *  luz (excluyentes) — el drone arranca BLANCO PLANO y cada capacidad se
 *  enciende a mano; el color base tiñe el drone completo al activarse. */
const defaultSlotOn = (i: number) => {
  const s = VARIANT_SLOTS[i];
  if (s.kind === 'luz') return i === VARIANT_SLOTS.findIndex(x => x.kind === 'luz');
  return false;
};

/**
 * Panel de SLOTS del configurador (ciclo 7): PILLS compactas que envuelven
 * (como los chips de las otras secciones) — nada de filas verticales con toggle.
 * Color: click en la pill → selector de color nativo. N desbloquea N slots;
 * por encima del catálogo → chip "+N". Luces excluyentes. Sin aislamiento.
 */
function VariantSlotsPanel({ value, lang, slots, setSlots }: {
  value: number; lang: Lang; slots: VariantSlotsState; setSlots: Dispatch<SetStateAction<VariantSlotsState>>;
}) {
  const en = lang === 'en';
  const N = Math.max(0, Math.round(value));
  const unlocked = Math.min(VARIANT_SLOTS.length, N);

  // Al subir el slider, los slots recién desbloqueados NACEN ACTIVOS; los
  // bloqueados quedan OFF. Las luces son excluyentes (solo la primera nace ON).
  const prevUnlockedRef = useRef(unlocked);
  useEffect(() => {
    const prev = prevUnlockedRef.current;
    setSlots(sl => {
      const on = [...sl.on];
      for (let i = prev; i < unlocked; i++) on[i] = defaultSlotOn(i);
      for (let i = unlocked; i < VARIANT_SLOTS.length; i++) on[i] = false;
      return { ...sl, on };
    });
    prevUnlockedRef.current = unlocked;
  }, [unlocked, setSlots]);

  const toggleSlot = (i: number) => setSlots(sl => {
    const on = [...sl.on];
    on[i] = !on[i];
    if (on[i] && VARIANT_SLOTS[i].kind === 'luz') {
      VARIANT_SLOTS.forEach((sl2, j) => { if (sl2.kind === 'luz' && j !== i) on[j] = false; });
    }
    return { ...sl, on };
  });

  const setSlotColor = (slotId: string, color: string) => setSlots(sl => ({ ...sl, colors: { ...sl.colors, [slotId]: color } }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontSize: 12.5, color: 'var(--cx-accent)', fontWeight: 600, textAlign: 'center' }}>
        {en ? 'Each option is a real capability your customer can toggle' : 'Cada opción es una capacidad real que tu cliente puede encender o apagar'}
      </div>

      {/* Pills de slots (envuelven en horizontal) */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
        {VARIANT_SLOTS.slice(0, unlocked).map((slot, i) => {
          const active = !!slots.on[i];
          const label = en ? slot.en : slot.es;
          const isColor = slot.kind === 'color';
          const colorHex = slots.colors[slot.id] ?? '#eef0f2';
          return (
            <button key={slot.id} data-slot-id={slot.id} data-on={active ? '1' : '0'}
              onClick={() => toggleSlot(i)}
              title={active ? (en ? 'Turn off' : 'Apagar') : (en ? 'Turn on' : 'Encender')}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600,
                padding: '5px 12px', borderRadius: 999, cursor: 'pointer', font: 'inherit',
                border: active ? '1.5px solid var(--cx-accent)' : '1px solid var(--cx-border-strong)',
                background: active ? 'var(--cx-accent-soft)' : 'var(--cx-card-solid)',
                color: active ? 'var(--cx-accent)' : 'var(--cx-muted)',
              }}>
              {isColor && active && (
                <input type="color" value={colorHex}
                  onClick={e => e.stopPropagation()}
                  onChange={e => setSlotColor(slot.id, e.target.value)}
                  aria-label={en ? `Color of ${label}` : `Color de ${label}`}
                  title={en ? 'Pick color' : 'Elegir color'}
                  style={{ width: 14, height: 14, borderRadius: '50%', border: 'none', background: 'none', cursor: 'pointer', padding: 0 }} />
              )}
              {label}
            </button>
          );
        })}
        {N > VARIANT_SLOTS.length && (
          <span title={en ? 'Quoted as additional variants' : 'Se cotizan como variantes adicionales'}
            style={{
              display: 'inline-flex', alignItems: 'center', fontSize: 12, fontWeight: 700,
              padding: '5px 12px', borderRadius: 999,
              border: '1px dashed var(--cx-border-strong)', color: 'var(--cx-faint)', cursor: 'default',
            }}>
            +{N - VARIANT_SLOTS.length}
          </span>
        )}
      </div>

      <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--cx-muted)', marginTop: 2 }}>
        {en
          ? 'Each variant adds a real capability to the configurator; extras are quoted as additional variants.'
          : 'Cada variante añade una capacidad real al configurador; las extra se cotizan como variantes adicionales.'}
      </div>
    </div>
  );
}

