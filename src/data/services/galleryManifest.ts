// Manifest explícito de assets visuales por servicio×nivel (S7).
// Para añadir un ejemplo real: suelta el archivo en public/cotizador/gallery/
// y registra la ruta aquí. Sin entrada → placeholder elegante por familia.

export interface GalleryAsset {
  src: string;
  alt: string;
}

const A = (serviceId: string, tier: string, file: string, alt: string): [string, GalleryAsset] => [
  `${serviceId}:${tier}`,
  { src: `/cotizador/gallery/${serviceId}/${file}`, alt },
];

export const GALLERY_ASSETS: Record<string, GalleryAsset> = {};

export function getGalleryAsset(serviceId: string, tier: string): GalleryAsset | null {
  return GALLERY_ASSETS[`${serviceId}:${tier}`] ?? null;
}

/**
 * Arte ilustrativo por FAMILIA (demo público): se usa cuando un servicio×nivel
 * no tiene asset real registrado. Dibujo vectorial propio — sin copyright.
 * Sustituible por renders reales vía GALLERY_ASSETS sin tocar la UI.
 */
export function familyIllustration(family: string, tier: string): GalleryAsset {
  return {
    src: `/cotizador/gallery/family/${family}.svg`,
    alt: `Ilustración orientativa de trabajos de tipo ${family} (nivel ${tier})`,
  };
}

/** Qué cambia entre niveles (lenguaje humano, sin horas). */
export const TIER_SCOPE: Record<string, { label: string; desc: string }> = {
  XS: { label: 'Prueba rápida', desc: 'Alcance mínimo para validar la idea' },
  S: { label: 'Esencial', desc: 'Lo necesario para publicar con calidad' },
  M: { label: 'Profesional', desc: 'El estándar que espera tu cliente' },
  L: { label: 'Producción completa', desc: 'Más piezas, detalle y pulido' },
  XL: { label: 'Máximo alcance', desc: 'Sin límites prácticos de escala' },
};

const FAMILY_ICON: Record<string, string> = {
  render: '🖼️',
  'asset-rt': '🧊',
  'web-3d': '🌐',
  ia: '🤖',
  vfx: '✨',
  datos: '⚙️',
  texturas: '🎨',
  pipeline: '🧰',
  soporte: '🧭',
};

export function familyIcon(family: string): string {
  return FAMILY_ICON[family] ?? '📦';
}
