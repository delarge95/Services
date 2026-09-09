import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import type { PreviewMode, VariantSlotsState } from './previewConstants';

/** ModelPreview se code-splitea (ciclo 15): three.js (~600KB) solo se
 *  descarga cuando un preview entra en viewport, no en el bundle inicial
 *  del wizard. El placeholder conserva la altura para no mover el layout. */
const ModelPreview = lazy(() => import('./ModelPreview').then(m => ({ default: m.ModelPreview })));

export interface LazyModelPreviewProps {
  mode: PreviewMode;
  detail?: number;
  pieces?: number;
  story?: number;
  surface?: number;
  variantSel?: { c: number; m: number; a: number };
  variantSlots?: VariantSlotsState;
  finish?: 'simple' | 'variado' | 'detallado';
  estilo?: number;
  hotspots?: number;
  lang?: 'es' | 'en';
  height?: number;
}

export default function LazyModelPreview(props: LazyModelPreviewProps) {
  const { height = 290 } = props;
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!ref.current || visible) return;
    if (!('IntersectionObserver' in window)) { setVisible(true); return; }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) { setVisible(true); io.disconnect(); }
        }
      },
      { rootMargin: '300px', threshold: 0.01 },
    );
    io.observe(ref.current);
    return () => io.disconnect();
  }, [visible]);

  return (
    <div ref={ref}>
      {visible ? (
        <Suspense fallback={<div style={{ height }} aria-hidden="true" />}>
          <ModelPreview {...props} />
        </Suspense>
      ) : (
        <div style={{ height }} aria-hidden="true" />
      )}
    </div>
  );
}
