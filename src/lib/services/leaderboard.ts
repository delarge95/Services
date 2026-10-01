/**
 * leaderboard.ts — Ranking del minijuego (ciclo 31, 2026-10-01).
 * Global: worker `cotizador-chat` (GET/POST /scores, KV). Mientras el worker no esté
 * desplegado (CHAT_ENDPOINT vacío) o falle, el ranking es LOCAL a este navegador y la UI
 * lo dice. Nunca bloquea el juego.
 */
import { CHAT_ENDPOINT } from '../../data/services/chatConfig';
import { withSeeds } from './leaderboardSeeds';

export interface LbEntry { id?: string; name: string; company?: string; score: number; at?: string }
export interface LbState { mode: 'global' | 'local'; scores: LbEntry[]; total: number }

const API = CHAT_ENDPOINT ? CHAT_ENDPOINT.replace(/\/chat\/?$/, '') + '/scores' : '';
const LOCAL_KEY = 'cx-lb-local-v1';

function readLocal(): LbEntry[] {
  try { return JSON.parse(localStorage.getItem(LOCAL_KEY) ?? '[]') as LbEntry[]; } catch { return []; }
}
function writeLocal(list: LbEntry[]) {
  try { localStorage.setItem(LOCAL_KEY, JSON.stringify(list.slice(0, 20))); } catch { /* sin almacenamiento */ }
}

export async function fetchTop(): Promise<LbState> {
  if (API) {
    try {
      const r = await fetch(API, { signal: AbortSignal.timeout(6000) });
      if (r.ok) { const d = await r.json() as { scores: LbEntry[]; total: number }; return { mode: 'global', scores: d.scores, total: d.total }; }
    } catch { /* cae a local */ }
  }
  const l = withSeeds(readLocal());
  return { mode: 'local', scores: l.slice(0, 10), total: l.length };
}

export async function submitScore(e: { name: string; company?: string; score: number; durationMs: number }): Promise<LbState & { rank?: number; error?: string }> {
  if (API) {
    try {
      const r = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(e), signal: AbortSignal.timeout(6000) });
      const d = await r.json() as { scores?: LbEntry[]; total?: number; rank?: number; error?: string };
      if (r.ok && d.scores) return { mode: 'global', scores: d.scores, total: d.total ?? d.scores.length, rank: d.rank };
      if (r.status === 422 || r.status === 429) return { ...(await fetchTop()), error: d.error };
    } catch { /* cae a local */ }
  }
  const name = e.name.replace(/[<>]/g, '').trim().slice(0, 24), company = e.company?.replace(/[<>]/g, '').trim().slice(0, 32) || undefined;
  const at = new Date().toISOString();
  const list = [...readLocal(), { name, company, score: e.score, at }].sort((a, b) => b.score - a.score);
  writeLocal(list);
  const shown = withSeeds(list);
  return { mode: 'local', scores: shown.slice(0, 10), total: shown.length, rank: shown.findIndex((x) => x.at === at) + 1 };
}
