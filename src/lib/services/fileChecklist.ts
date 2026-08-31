// S9a: autodiagnóstico de archivos — reglas por extensión y peso, sin backend.

export interface FileVerdict {
  name: string;
  sizeMB: number;
  ext: string;
  ok: boolean;
  notes: string[];
}

const CAD_MODEL_EXT = new Set([
  'step', 'stp', 'iges', 'igs', 'sldasm', 'sldprt', 'iam', 'ipt',
  'catproduct', 'catpart', 'prt', 'x_t', 'x_b', '3mf', 'obj', 'fbx',
  'glb', 'gltf', 'blend', 'usdz', 'stl',
]);
const MEDIA_DOC_EXT = new Set([
  'png', 'jpg', 'jpeg', 'webp', 'gif', 'pdf', 'ai', 'fig', 'xd', 'svg',
  'mp4', 'mov', 'zip',
]);

const HEAVY_MB = 100;
const VERY_HEAVY_MB = 250;

function extOf(name: string): string {
  const parts = name.toLowerCase().split('.');
  return parts.length > 1 ? parts[parts.length - 1] : '';
}

export function verdictFile(name: string, sizeBytes: number): FileVerdict {
  const ext = extOf(name);
  const sizeMB = Math.round((sizeBytes / (1024 * 1024)) * 10) / 10;
  const notes: string[] = [];
  let ok = true;

  if (!CAD_MODEL_EXT.has(ext) && !MEDIA_DOC_EXT.has(ext)) {
    ok = false;
    notes.push(`Formato “.${ext || '?'}” no lo reconocemos, pero envíalo igual: casi siempre hay conversión.`);
  }
  if (CAD_MODEL_EXT.has(ext)) {
    notes.push('Sirve como fuente para asset web ✓');
    if (sizeMB > HEAVY_MB) notes.push(`Pesado (${sizeMB} MB): perfecto, lo optimizamos nosotros.`);
    if (sizeMB > VERY_HEAVY_MB) notes.push('Considera comprimirlo en ZIP antes de enviarlo.');
  }
  if ((ext === 'png' || ext === 'jpg' || ext === 'jpeg' || ext === 'webp') && sizeMB < 0.05) {
    notes.push('Resolución muy baja para referencia; si tienes versión más grande, mejor.');
  }
  return { name, sizeMB, ext, ok, notes };
}

export interface FilesSummary {
  total: number;
  ready: number;
  heavy: number;
  unknown: number;
  message: string;
}

export function summarizeFiles(verdicts: FileVerdict[]): FilesSummary {
  const heavy = verdicts.filter((v) => v.sizeMB > HEAVY_MB).length;
  const unknown = verdicts.filter((v) => !v.ok).length;
  const ready = verdicts.length - unknown;
  let message = '';
  if (verdicts.length === 0) message = '';
  else if (unknown === verdicts.length) message = 'Revisamos estos formatos manualmente al recibirlos.';
  else if (heavy > 0) message = `${ready}/${verdicts.length} listos para empezar. Los pesados los optimizamos nosotros.`;
  else message = `${ready}/${verdicts.length} listos para empezar. En el brief confirmamos detalles.`;
  return { total: verdicts.length, ready, heavy, unknown, message };
}

/** Texto que se adjunta al resumen de cotización (inventario declarado). */
export function inventoryLine(names: string[]): string | undefined {
  if (names.length === 0) return undefined;
  return `Archivos que enviaré aparte (Drive/WeTransfer): ${names.slice(0, 5).join(', ')}${names.length > 5 ? ` +${names.length - 5} más` : ''}`;
}
