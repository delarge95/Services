/**
 * icons.tsx — Iconografía de línea (stroke) estilo Apple para el cotizador.
 * Sustituye a los emojis en las opciones del árbol: mismo tamaño óptico,
 * color heredado (currentColor), trazo 1.6, esquinas redondeadas.
 */

import type { ReactElement } from 'react';

interface IconProps { size?: number; color?: string }

const base = (size: number) => ({
  width: size, height: size, viewBox: '0 0 24 24', fill: 'none' as const,
  stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const, 'aria-hidden': true as const,
});

export function GlobeIcon({ size = 24, color }: IconProps) {
  return (
    <svg {...base(size)} color={color}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.7 2.6 4 5.7 4 9s-1.3 6.4-4 9c-2.7-2.6-4-5.7-4-9s1.3-6.4 4-9z" />
    </svg>
  );
}

export function FilmIcon({ size = 24, color }: IconProps) {
  return (
    <svg {...base(size)} color={color}>
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="M7 5v14M17 5v14M3 9.5h4M3 14.5h4M17 9.5h4M17 14.5h4" />
    </svg>
  );
}

export function CameraIcon({ size = 24, color }: IconProps) {
  return (
    <svg {...base(size)} color={color}>
      <path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.6a2 2 0 0 0 1.7-.9l.6-.9a1 1 0 0 1 .8-.4h1.6a1 1 0 0 1 .8.4l.6.9a2 2 0 0 0 1.7.9h1.6A2.5 2.5 0 0 1 20 8.5v8A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5v-8z" />
      <circle cx="12" cy="12.5" r="3.4" />
    </svg>
  );
}

export function ChipIcon({ size = 24, color }: IconProps) {
  return (
    <svg {...base(size)} color={color}>
      <rect x="6.5" y="6.5" width="11" height="11" rx="2" />
      <path d="M9.5 2.5v4M14.5 2.5v4M9.5 17.5v4M14.5 17.5v4M2.5 9.5h4M2.5 14.5h4M17.5 9.5h4M17.5 14.5h4" />
      <circle cx="12" cy="12" r="1.6" />
    </svg>
  );
}

export function SparkIcon({ size = 24, color }: IconProps) {
  return (
    <svg {...base(size)} color={color}>
      <path d="M12 3.5l1.9 5.1a2 2 0 0 0 1.2 1.2l5.1 1.9-5.1 1.9a2 2 0 0 0-1.2 1.2L12 19.9l-1.9-5.1a2 2 0 0 0-1.2-1.2L3.8 11.7l5.1-1.9a2 2 0 0 0 1.2-1.2L12 3.5z" />
    </svg>
  );
}

export function EyeIcon({ size = 24, color }: IconProps) {
  return (
    <svg {...base(size)} color={color}>
      <path d="M2.5 12S6 5.8 12 5.8 21.5 12 21.5 12 18 18.2 12 18.2 2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function CursorIcon({ size = 24, color }: IconProps) {
  return (
    <svg {...base(size)} color={color}>
      <path d="M5.5 3.8l13.2 6.4c.7.3.6 1.3-.1 1.6l-5.5 1.9a2 2 0 0 0-1.2 1.2l-1.9 5.5c-.3.7-1.3.8-1.6.1L4 6.3c-.4-.9.6-1.9 1.5-1.5z" />
    </svg>
  );
}

export function StoryIcon({ size = 24, color }: IconProps) {
  return (
    <svg {...base(size)} color={color}>
      <path d="M12 6.2C10.7 4.9 8.7 4.2 6 4.2c-.9 0-1.7.1-2.5.3v13.8c.8-.2 1.6-.3 2.5-.3 2.7 0 4.7.7 6 2 1.3-1.3 3.3-2 6-2 .9 0 1.7.1 2.5.3V4.5c-.8-.2-1.6-.3-2.5-.3-2.7 0-4.7.7-6 2z" />
      <path d="M12 6.2v13.8" />
    </svg>
  );
}

export function MonitorIcon({ size = 24, color }: IconProps) {
  return (
    <svg {...base(size)} color={color}>
      <rect x="3" y="4.5" width="18" height="12.5" rx="2" />
      <path d="M9.5 20.5h5M12 17v3.5" />
    </svg>
  );
}

export function GearIcon({ size = 24, color }: IconProps) {
  return (
    <svg {...base(size)} color={color}>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 2.8l1 2.6a6.8 6.8 0 0 1 2.2.9l2.6-1 1.9 3.3-2 1.9c.1.4.2.9.2 1.5s-.1 1.1-.2 1.5l2 1.9-1.9 3.3-2.6-1a6.8 6.8 0 0 1-2.2.9l-1 2.6h-.1l-1-2.6a6.8 6.8 0 0 1-2.2-.9l-2.6 1-1.9-3.3 2-1.9A6.6 6.6 0 0 1 5.9 12c0-.6.1-1.1.2-1.5l-2-1.9L6 5.3l2.6 1a6.8 6.8 0 0 1 2.2-.9l1-2.6h.2z" />
    </svg>
  );
}

export function ChatIcon({ size = 24, color }: IconProps) {
  return (
    <svg {...base(size)} color={color}>
      <path d="M21 11.8a8.4 8.4 0 0 1-8.5 8.3c-1.5 0-2.9-.3-4.1-1L3 20.2l1.2-4.2a8 8 0 0 1-1.2-4.2A8.4 8.4 0 0 1 11.5 3.5 8.4 8.4 0 0 1 21 11.8z" />
    </svg>
  );
}

export function MailIcon({ size = 24, color }: IconProps) {
  return (
    <svg {...base(size)} color={color}>
      <rect x="3" y="5.5" width="18" height="13" rx="2.2" />
      <path d="M3.5 7l7.6 5.7a1.6 1.6 0 0 0 1.8 0L20.5 7" />
    </svg>
  );
}

export function SunIcon({ size = 24, color }: IconProps) {
  return (
    <svg {...base(size)} color={color}>
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 2.5v2.4M12 19.1v2.4M2.5 12h2.4M19.1 12h2.4M5 5l1.7 1.7M17.3 17.3L19 19M19 5l-1.7 1.7M6.7 17.3L5 19" />
    </svg>
  );
}

export function HomeIcon({ size = 24, color }: IconProps) {
  return (
    <svg {...base(size)} color={color}>
      <path d="M4 11.2 12 4l8 7.2" />
      <path d="M6 9.8V20h12V9.8" />
    </svg>
  );
}

export function MoonIcon({ size = 24, color }: IconProps) {
  return (
    <svg {...base(size)} color={color}>
      <path d="M20 13.6A8.2 8.2 0 0 1 10.4 4 8.2 8.2 0 1 0 20 13.6z" />
    </svg>
  );
}

export function InfoIcon({ size = 24, color }: IconProps) {
  return (
    <svg {...base(size)} color={color}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5.5" />
      <path d="M12 7.6v.2" />
    </svg>
  );
}

/** Enlace externo (ciclo 11): cuadrado con flecha saliente, para los links al
 *  prototipo Twinsight X500. */
export function ExternalIcon({ size = 24, color }: IconProps) {
  return (
    <svg {...base(size)} color={color}>
      <path d="M14 5h5v5" />
      <path d="M19 5l-8 8" />
      <path d="M19 13.5V18a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 18V7a1.5 1.5 0 0 1 1.5-1.5H10" />
    </svg>
  );
}

/** Mapa nombre→icono para los datos del árbol (decisionTree usa ids, no emojis). */
const ICONS: Record<string, (p: IconProps) => ReactElement> = {
  globe: GlobeIcon,
  film: FilmIcon,
  camera: CameraIcon,
  chip: ChipIcon,
  spark: SparkIcon,
  eye: EyeIcon,
  cursor: CursorIcon,
  story: StoryIcon,
  monitor: MonitorIcon,
  gear: GearIcon,
  chat: ChatIcon,
  mail: MailIcon,
};

export function TreeIcon({ name, size = 22, color = '#0071e3' }: { name: string } & IconProps) {
  const Cmp = ICONS[name];
  if (!Cmp) return <span style={{ fontSize: size, lineHeight: 1 }}>{name}</span>; // compat: valor literal
  return <Cmp size={size} color={color} />;
}
