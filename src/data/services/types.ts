export type LevelId = 'XS' | 'S' | 'M' | 'L' | 'XL';
export type Currency = 'USD' | 'COP';
export type RateClass = 'RC-ART' | 'RC-RTA' | 'RC-WEB' | 'RC-AI' | 'RC-CON';
export type Confidence = 'explicit' | 'inferred' | 'qualitative';

export const LEVEL_IDS: LevelId[] = ['XS', 'S', 'M', 'L', 'XL'];
export const LEVEL_LABELS: Record<LevelId, string> = {
  XS: 'Micro', S: 'Simple', M: 'Estándar', L: 'Complejo', XL: 'Crítico',
};

export interface HourRange { min: number; max: number }
export type HoursByTier = Record<LevelId, HourRange>;

export interface Subtask {
  id: string;
  nameEs: string;
  hours: HoursByTier;
  optional?: boolean;
  appliesFrom?: LevelId;
  rateClass: RateClass;
}

export interface ServiceDef {
  id: string;
  catalogId: string;
  family: string;
  nameEs: string;
  unitEs: string;
  descripcionEs: string;
  entregablesEs: string[];
  noIncluyeEs?: string[];
  driversEs: string[];
  confidence: Confidence;
  subtasks: Subtask[];
  entregaDiasEs?: [number, number];
}

export interface RateBand { min: number; max: number }
export interface RateCardDef {
  currency: Currency;
  rates: Record<RateClass, RateBand>;
  roundStep: (v: number) => number;
  minProject: number;
}

export interface QuoteResult {
  serviceId: string;
  serviceName: string;
  level: LevelId;
  currency: Currency;
  hoursMin: number;
  hoursMax: number;
  subtotalMin: number;
  subtotalMax: number;
  discountPct: number;
  totalMin: number;
  totalMax: number;
  entregaDias?: [number, number];
  entregables: string[];
  noIncluye: string[];
  notesEs: string[];
}

export interface ComponentePaquete {
  serviceId: string;
  nivel: string;
  cantidad?: number;
}
