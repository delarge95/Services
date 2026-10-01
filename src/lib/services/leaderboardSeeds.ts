/**
 * leaderboardSeeds.ts — Top 3 sembrado del minijuego (ciclo 32, decisión del usuario).
 * En vez de letreros que pidan "pon tu empresa", el ranking ya trae tres jugadores con un
 * nombre corto y su estudio/marca: el visitante ve que se puede firmar con la marca y lo
 * imita por sí mismo. Son nombres INVENTADOS (no empresas ni personas reales, para no
 * insinuar respaldos). Puntajes alcanzables para que valga la pena intentarlo.
 * Lo comparten el cliente (modo local) y el worker (modo global): una sola fuente.
 */
export interface SeedEntry { id: string; name: string; company?: string; score: number; at: string }

export const SEED_SCORES: SeedEntry[] = [
  { id: 'seed-1', name: 'Vale', company: 'Ocre Studio', score: 340, at: '2026-09-28T15:12:00.000Z' },
  { id: 'seed-2', name: 'Juanpa', company: 'Kilovolt', score: 270, at: '2026-09-29T21:40:00.000Z' },
  { id: 'seed-3', name: 'Mafe', company: 'Norte & Lima', score: 210, at: '2026-09-30T18:05:00.000Z' },
];

/** Mezcla el ranking real con el sembrado (desc por puntaje; en empate, el más antiguo primero). */
export function withSeeds<T extends { id?: string; score: number; at?: string }>(list: T[]): (T | SeedEntry)[] {
  return [...list.filter((x) => !String(x.id ?? '').startsWith('seed-')), ...SEED_SCORES]
    .sort((a, b) => b.score - a.score || String(a.at ?? '').localeCompare(String(b.at ?? '')));
}
