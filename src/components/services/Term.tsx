import { GLOSSARY } from '../../data/services/glossary';

/** Término con tooltip accesible (hover/focus). Debe vivir dentro del cotizador, que inyecta los estilos .cx-term. */
export function Term({ id }: { id: keyof typeof GLOSSARY | string }) {
  const entry = GLOSSARY[id];
  if (!entry) return null;
  return (
    <span className="cx-term" tabIndex={0} aria-label={`${entry.term}: ${entry.def}`}>
      <span aria-hidden="true">ⓘ</span>
      <span role="tooltip" className="cx-term-pop">
        <strong>{entry.term}:</strong> {entry.def}
      </span>
    </span>
  );
}
