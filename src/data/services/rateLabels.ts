import type { LevelId, Subtask } from './types';

// Etiquetas legibles por clase de trabajo (oculta códigos RC-*)
export const RATE_LABELS: Record<string, string> = {
  'RC-ART': 'Arte y diseño',
  'RC-RTA': 'Ingeniería 3D',
  'RC-WEB': 'Desarrollo web',
  'RC-AI': 'Inteligencia artificial',
  'RC-CON': 'Consultoría',
};

export type PhaseId = 'descubrimiento' | 'produccion' | 'calidad';

export const PHASES: Array<{ id: PhaseId; label: string; icon: string }> = [
  { id: 'descubrimiento', label: 'Descubrimiento y diseño', icon: '🧭' },
  { id: 'produccion', label: 'Producción', icon: '🛠️' },
  { id: 'calidad', label: 'Calidad y entrega', icon: '✅' },
];

const DISCOVERY_RE = /(brief|discovery|intake|storyboard|previs|gdd|analisis|especif|wireframe|moodboard|auditoria)/i;
const QA_RE = /(qa|export|handoff|deploy|documentacion|capacitacion|pruebas|evaluacion|reporte|entrega)/i;

export function phaseOf(st: Subtask): PhaseId {
  if (DISCOVERY_RE.test(st.nameEs)) return 'descubrimiento';
  if (QA_RE.test(st.nameEs)) return 'calidad';
  return 'produccion';
}

export interface PhaseGroupItem {
  id: string;
  nameEs: string;
  hoursLabel: string;
  classLabel: string;
}

export interface PhaseGroup {
  phase: PhaseId;
  items: PhaseGroupItem[];
  hoursLabel: string;
}

function sumHours(subtasks: Subtask[], tier: LevelId): { min: number; max: number } {
  let min = 0;
  let max = 0;
  for (const st of subtasks) {
    const r = st.hours[tier];
    if (!r) continue;
    min += r.min;
    max += r.max;
  }
  return { min, max };
}

export function groupSubtasksByPhase(subtasks: Subtask[], tier: LevelId): PhaseGroup[] {
  return PHASES.map(({ id }) => {
    const inPhase = subtasks.filter((st) => !st.optional && phaseOf(st) === id);
    const items = inPhase.map((st) => {
      const r = st.hours[tier];
      return {
        id: st.id,
        nameEs: st.nameEs,
        hoursLabel: r ? `${r.min}–${r.max} h` : '—',
        classLabel: RATE_LABELS[st.rateClass] ?? st.rateClass,
      };
    });
    const tot = sumHours(inPhase, tier);
    return {
      phase: id,
      items,
      hoursLabel: items.length > 0 ? `${tot.min}–${tot.max} h` : '',
    };
  }).filter((g) => g.items.length > 0);
}
