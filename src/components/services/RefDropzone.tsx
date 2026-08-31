import { useRef, useState } from 'react';
import { summarizeFiles, verdictFile } from '../../lib/services/fileChecklist';
import type { FileVerdict } from '../../lib/services/fileChecklist';

/**
 * S9: zona drag & drop local (no sube nada). Valida extensión/peso con
 * checklist autodiagnóstico y declara el inventario para adjuntarlo al contacto.
 */
export function RefDropzone({ onInventory }: { onInventory: (names: string[]) => void }) {
  const [verdicts, setVerdicts] = useState<FileVerdict[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const next = [...verdicts];
    for (const f of Array.from(files)) next.push(verdictFile(f.name, f.size));
    setVerdicts(next);
    onInventory(next.map((v) => v.name));
  };

  const summary = summarizeFiles(verdicts);

  return (
    <div style={{ marginTop: 14 }} data-noprint>
      <strong style={{ fontSize: 13.5, color: '#1a1d29' }}>¿Tienes referencias o archivos? Suelta aquí (no se sube nada)</strong>
      <div
        role="button" tabIndex={0} aria-label="Zona para soltar archivos"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click(); }}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files); }}
        style={{
          marginTop: 8, padding: '18px 14px', textAlign: 'center', cursor: 'pointer',
          border: dragOver ? '2px solid #0a84ff' : '2px dashed #c7d7fe',
          borderRadius: 10, background: dragOver ? '#e8f0fe' : '#fff', color: '#44485a',
        }}>
          <span style={{ fontSize: 20 }} aria-hidden="true">📎</span>
          <span style={{ display: 'block', fontSize: 13, marginTop: 4 }}>
            Arrastra tu modelo (STEP, Blender, GLB…), fotos o moodboard
          </span>
          <span style={{ display: 'block', fontSize: 11, color: '#5a5e6e', marginTop: 2 }}>
            Todo queda en tu navegador; los archivos reales los envías después como prefieras.
          </span>
          <input ref={inputRef} type="file" multiple hidden onChange={(e) => addFiles(e.target.files)} />
      </div>

      {verdicts.length > 0 && (
        <div style={{ fontSize: 12, color: '#1a1d29' }}>
          <ul style={{ paddingLeft: 16, margin: '8px 0 4px' }}>
            {verdicts.map((v, i) => (
              <li key={`${v.name}-${i}`} style={{ marginBottom: 4, opacity: v.ok ? 1 : 0.8 }}>
                <strong>{v.name}</strong> · {v.sizeMB} MB
                {v.notes.map((n, j) => (
                  <span key={j} style={{ display: 'block', fontSize: 11, color: n.startsWith('Formato') ? '#b45309' : '#166534' }}>
                    {v.ok ? '✓' : '!'} {n}
                  </span>
                ))}
              </li>
            ))}
          </ul>
          <p style={{ margin: 0, color: '#166534' }}>{summary.message}</p>
          <button onClick={() => { setVerdicts([]); onInventory([]); }}
            style={{
              font: 'inherit', fontSize: 11.5, background: 'none', border: 'none',
              cursor: 'pointer', color: '#0a84ff', textDecoration: 'underline', padding: 0, marginTop: 4,
            }}>
            Limpiar lista
          </button>
        </div>
      )}
    </div>
  );
}
