import type { Currency, LevelId } from '../../data/services/types';

import { BRAND } from '../../data/services/branding';

/** Fuente única del email público: branding.ts (PENDIENTE usuario: confirmar real). */
export const CONTACT_EMAIL = BRAND.contactEmail;
const LS_KEY = 'agserv-quote-v1';

type UrgencyId = 'none' | '72h' | '24h';

export interface ShareState {
  serviceId: string;
  vals: Record<string, number | string | boolean>;
  currency: Currency;
  firstClient: boolean;
  urgency: UrgencyId;
  quantity: number;
}

// ── base64 unicode-safe (browser + node) ──
function b64uEncode(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}
function b64uDecode(s: string): string {
  const bin = atob(s);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function encodeShare(s: ShareState): string {
  const p = new URLSearchParams();
  p.set('svc', s.serviceId);
  p.set('cur', s.currency);
  p.set('fc', s.firstClient ? '1' : '0');
  p.set('urg', s.urgency);
  p.set('qty', String(Math.max(1, Math.floor(s.quantity))));
  p.set('v', b64uEncode(JSON.stringify(s.vals)));
  return p.toString();
}

export function decodeShare(search: string): ShareState | null {
  try {
    const raw = search.startsWith('?') ? search.slice(1) : search;
    if (!raw) return null;
    const p = new URLSearchParams(raw);
    const svc = p.get('svc');
    if (!svc) return null;
    const urgRaw = p.get('urg') ?? 'none';
    const curRaw = p.get('cur') ?? 'USD';
    return {
      serviceId: svc,
      currency: curRaw === 'COP' ? 'COP' : 'USD',
      firstClient: p.get('fc') !== '0',
      urgency: (['none', '72h', '24h'].includes(urgRaw) ? urgRaw : 'none') as UrgencyId,
      quantity: Math.max(1, Number(p.get('qty') ?? '1') || 1),
      vals: p.get('v') ? (JSON.parse(b64uDecode(p.get('v')!)) as Record<string, number | string | boolean>) : {},
    };
  } catch {
    return null;
  }
}

export function loadLocal(): ShareState | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as ShareState) : null;
  } catch {
    return null;
  }
}

export function saveLocal(s: ShareState): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(s));
  } catch {
    /* almacenamiento no disponible */
  }
}

/** ID corto estable de la cotización (hash djb2 del estado serializado). */
export function quoteId(s: ShareState): string {
  const str = encodeShare(s);
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
  return h.toString(36).toUpperCase().padStart(7, '0').slice(-7);
}

export interface SummaryArgs {
  id: string;
  serviceName: string;
  serviceCode: string;
  tier: LevelId;
  currency: Currency;
  totalRange: string;
  hoursRange: string;
  entrega?: string;
  entregables: string[];
  noIncluye: string[];
  url: string;
  adjuntos?: string;
}

export function buildSummary(a: SummaryArgs): string {
  const lines = [
    `Cotización de proyecto 3D · ${a.id}`,
    `Servicio: ${a.serviceName} (${a.serviceCode})`,
    `Nivel calculado: ${a.tier}`,
    `Horas estimadas: ${a.hoursRange}`,
    `Total orientativo (${a.currency}): ${a.totalRange}`,
  ];
  if (a.entrega) lines.push(`Entrega: ${a.entrega}`);
  if (a.entregables.length > 0) lines.push(`Incluye: ${a.entregables.slice(0, 6).join(' · ')}`);
  if (a.noIncluye.length > 0) lines.push(`No incluye: ${a.noIncluye.slice(0, 3).join(' · ')}`);
  if (a.adjuntos) lines.push(a.adjuntos);
  lines.push(`Ver cotización: ${a.url}`);
  lines.push('(Rango orientativo, no cotización formal.)');
  return lines.join('\n');
}
