/**
 * treeToQuote.ts — Puente entre el árbol de decisión (decisionTree.ts) y el
 * motor de cotización (serviceVariables.ts + formula.ts).
 *
 * Traduce respuestas en lenguaje humano del wizard (`answers` con ids del
 * árbol) a valores de SERVICE_VARIABLES por servicio. Solo fija las variables
 * que el árbol informa; el resto queda sin asignar para que el cliente las
 * refine en la pantalla de configuración (derivarTier ignora las no asignadas).
 *
 * Trazabilidad: cada valor proviene de una respuesta del cliente o de un
 * default documentado aquí — ningún número inventado en runtime.
 */

export type Val = number | string | boolean;

export interface WizardPick {
  serviceId: string;
  vals: Record<string, Val>;
  /** 'principal' = se abre en configuración; 'complemento' = línea extra en el panel. */
  role: 'principal' | 'complemento';
  /** Etiqueta humana del rol en la cotización (ej: "El modelo 3D"). */
  labelEs: string;
  /** Nota opcional para el cliente sobre este pick. */
  notaEs?: string;
}

export interface WizardQuotePlan {
  rootChoice: string;
  subChoice: string;
  picks: WizardPick[];
}

type Answers = Record<string, string | number | boolean>;

const str = (a: Answers, id: string): string => (typeof a[id] === 'string' ? (a[id] as string) : '');
const num = (a: Answers, id: string): number => (typeof a[id] === 'number' ? (a[id] as number) : NaN);
const has = (a: Answers, id: string): boolean => a[id] !== undefined && a[id] !== '';

// ─── Defaults documentados (cuando el árbol no informa la variable) ───

/** Presupuesto poligonal por nivel de detalle del slider 1–5 (RTA-01.polyCount). */
const POLY_POR_NIVEL = [4000, 9000, 40000, 120000, 300000];

/** Sets de texturas según acabados (materiales-acabado → RTA-01.numTexturas). */
const TEXTURAS_POR_ACABADO: Record<string, number> = { simple: 1, variado: 3, detallado: 6 };
const COMPLEJIDAD_POR_ACABADO: Record<string, string> = {
  simple: 'Prismática (cajas, placas, tubo recto)',
  variado: 'Freeform moderada (carenas, fillets)',
  detallado: 'Compleja (roscas, cables, orgánico)',
};

const clampa = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

// ─── Helpers de picks ───

const pickVisor = (a: Answers, hotspots: number, notaEs?: string): WizardPick => {  const donde = str(a, 'donde-mostrar');
  return {
    serviceId: 'WEB-01',
    role: 'principal',
    labelEs: 'El visor 3D en tu web',
    notaEs,
    vals: {
      numHotspots: hotspots,
      datos: 'Fijos (hardcode)',
      // Feria/pantalla táctil o app móvil exigen móvil; en web normal lo asumimos también.
      target: donde === 'feria' || donde === 'movil' || str(a, 'plataforma') === 'app' || donde === 'landing' ? 'Desktop + móvil' : 'Desktop',
    },
  };
};

/** Interpola el presupuesto poligonal entre etapas para sliders continuos (1.1). */
const polyDeNivel = (nivel: number): number => {
  const f = Math.max(1, Math.min(5, nivel));
  const i = Math.min(3, Math.floor(f - 1));
  const frac = f - 1 - i;
  const v = POLY_POR_NIVEL[i] + (POLY_POR_NIVEL[i + 1] - POLY_POR_NIVEL[i]) * frac;
  return Math.round(v / 500) * 500; // paso de RTA-01.polyCount
};

/** RTA-01 para crear el modelo desde cero (cliente no lo tiene). */
const pickModeloDesdeCero = (a: Answers): WizardPick => {
  const nivel = has(a, 'nivel-detalle') ? clampa(num(a, 'nivel-detalle'), 1, 5) : 3;
  const acabado = str(a, 'materiales-acabado');
  const piezas = has(a, 'cantidad-piezas') ? clampa(num(a, 'cantidad-piezas'), 1, 200) : 8;
  const superficie = has(a, 'superficie') ? clampa(num(a, 'superficie'), 1, 5) : 2;
  const fuente = str(a, 'modelo-existente') === 'no-crear' && (str(a, 'formato-archivo') === 'step' || str(a, 'calidad-fuente') === 'cad-limpio')
    ? 'Desde CAD (requiere conversión)'
    : 'Desde fotos (requiere modelado)';
  return {
    serviceId: 'RTA-01',
    role: 'complemento',
    labelEs: 'La creación del modelo 3D',
    vals: {
      fuente,
      polyCount: polyDeNivel(nivel),
      numPiezas: piezas,
      numTexturas: TEXTURAS_POR_ACABADO[acabado] ?? 2,
      tipoSuperficie: Math.round(superficie),
    },
    notaEs: superficie >= 4.5
      ? 'Superficies esculpidas/orgánicas: el alcance exacto se acota en una sesión de discovery.'
      : 'Tu producto aún no tiene modelo 3D: hay que construirlo antes de programar el visor.',
  };
};

/** Conversión CAD→Web (CAD-01) cuando el cliente YA tiene un CAD. */
const pickConversionCAD = (a: Answers): WizardPick => {
  const piezas = has(a, 'cantidad-piezas') ? clampa(num(a, 'cantidad-piezas'), 1, 300) : 10;
  const acabado = str(a, 'materiales-acabado');
  return {
    serviceId: 'CAD-01',
    role: 'complemento',
    labelEs: 'La conversión de tu CAD a web',
    notaEs: 'Tu archivo CAD se convierte y optimiza para correr en el navegador.',
    vals: {
      numPiezas: piezas,
      complejidad: COMPLEJIDAD_POR_ACABADO[acabado] ?? 'Freeform moderada (carenas, fillets)',
      calidadCAD: str(a, 'calidad-fuente') === 'scan' ? 'Con problemas (tolerancias, geometría sucia)' : 'Limpio (export correcto, unidades ok)',
      target: str(a, 'donde-mostrar') === 'feria' || str(a, 'donde-mostrar') === 'movil' ? 'Móvil exigente' : 'Desktop web',
    },
  };
};

/** ¿El archivo que dice tener requiere conversión/creación como pick extra? */
function extrasPorModeloExistente(a: Answers): WizardPick | null {
  if (str(a, 'modelo-existente') !== 'si-tengo') return null;
  const formato = str(a, 'formato-archivo');
  const calidad = str(a, 'calidad-fuente');
  if (formato === 'gltf') return null; // glTF/GLB ya es web-ready
  if (formato === 'step' || calidad === 'cad-limpio') return pickConversionCAD(a);
  if (calidad === 'scan' || calidad === 'fotos') {
    return {
      serviceId: 'RTA-01',
      role: 'complemento',
      labelEs: 'La preparación de tu modelo para web',
      notaEs: 'Tu archivo (escaneo o fotos) se reconstruye como modelo optimizado para web.',
      vals: {
        fuente: 'Desde fotos (requiere modelado)',
        polyCount: polyDeNivel(has(a, 'nivel-detalle') ? clampa(num(a, 'nivel-detalle'), 1, 5) : 3),
        numPiezas: has(a, 'cantidad-piezas') ? clampa(num(a, 'cantidad-piezas'), 1, 200) : 8,
        numTexturas: TEXTURAS_POR_ACABADO[str(a, 'materiales-acabado')] ?? 2,
        tipoSuperficie: has(a, 'superficie') ? Math.round(clampa(num(a, 'superficie'), 1, 5)) : 2,
      },
    };
  }
  // .blend/.fbx/.obj o sin dato: el modelo sirve, la conversión a GLB va dentro del visor.
  return null;
}

// ─── Mapeo por rama ───
// Nota ciclo 5: pickShaders (RTA-05 por estilo>=4) se ELIMINÓ junto con la
// pregunta 'estilo', retirada por decisión de producto (no aportaba al precio).

function planVerModelo(a: Answers): WizardQuotePlan {
  const extra = extrasPorModeloExistente(a);
  const creaModelo = str(a, 'modelo-existente') === 'no-crear';
  // ciclo 9: la pregunta 'interaccion-visual' (y su avanzado 'interfaz') se
  // retiró del árbol; los hotspots se ajustan en el panel de configuración.
  const visor = pickVisor(a, 0);
  const picks: WizardPick[] = [visor];
  if (creaModelo) picks.push(pickModeloDesdeCero(a));
  else if (extra) picks.push(extra);
  return { rootChoice: 'web-3d', subChoice: 'ver-modelo', picks };
}

function planInteractivo(a: Answers): WizardQuotePlan {
  const tipo = str(a, 'tipo-interactividad');
  const plataforma = str(a, 'plataforma');
  const appCompleta = plataforma === 'app' || tipo === 'configurar';
  const picks: WizardPick[] = [];
  if (appCompleta) {
    picks.push({
      serviceId: 'WEB-04',
      role: 'principal',
      labelEs: 'La aplicación web 3D',
      vals: { numVariantes: 10, numSKUs: 1, fuenteDatos: 'Estáticos (JSON local)', auth: false },
    });
  } else {
    const hotspots = tipo === 'hotspots' ? 8 : tipo === 'desarmar' ? 4 : 0;
    picks.push(pickVisor(a, hotspots,
      tipo === 'desarmar' ? 'El despiece interactivo se agrega como mecánica sobre el asset (RTA-06) — lo afinamos por chat.' : undefined));
  }
  if (str(a, 'modelo-existente') === 'no-crear') picks.push(pickModeloDesdeCero(a));
  else {
    const extra = extrasPorModeloExistente(a);
    if (extra) picks.push(extra);
  }
  return { rootChoice: 'web-3d', subChoice: 'interactivo', picks };
}

function planScrollytelling(a: Answers): WizardQuotePlan {
  const escenas = has(a, 'escenas') ? clampa(num(a, 'escenas'), 1, 15) : 5;
  const picks: WizardPick[] = [{
    serviceId: 'WEB-05',
    role: 'principal',
    labelEs: 'La experiencia de scrollytelling',
    vals: { numSecciones: escenas },
  }];
  if (str(a, 'modelo-para-scroll') === 'no') {
    // nivel-detalle/cantidad-piezas/materiales se toman del árbol si existen
    // (pickModeloDesdeCero aplica defaults documentados si faltan).
    picks.push(pickModeloDesdeCero(a));
  } else {
    const extra = extrasPorModeloExistente(a);
    if (extra) picks.push(extra);
  }
  return { rootChoice: 'web-3d', subChoice: 'scrollytelling', picks };
}

function planWebApp(a: Answers): WizardQuotePlan {
  const tipo = str(a, 'tipo-app');
  let principal: WizardPick;
  if (tipo === 'catalogo') {
    principal = {
      serviceId: 'WEB-07',
      role: 'principal',
      labelEs: 'El catálogo 3D interactivo',
      vals: { numProductos: 10, filtros: true },
    };
  } else if (tipo === 'juego') {
    principal = {
      serviceId: 'WEB-06',
      role: 'principal',
      labelEs: 'El minijuego web',
      vals: { mecanica: 'Media (runner, plataforma)', scores: false },
    };
  } else {
    // configurador y herramienta técnica comparten WEB-04
    const variantes = has(a, 'num-variantes') ? clampa(num(a, 'num-variantes'), 2, 50) : 10;
    const datosMap: Record<string, string> = {
      estaticos: 'Estáticos (JSON local)',
      cms: 'CMS',
      api: 'API externa',
    };
    const datos = datosMap[str(a, 'datos')];
    principal = {
      serviceId: 'WEB-04',
      role: 'principal',
      labelEs: 'La aplicación web 3D',
      vals: {
        numVariantes: variantes,
        numSKUs: tipo === 'configurador' ? 5 : 1,
        fuenteDatos: datos ?? 'Estáticos (JSON local)',
        auth: str(a, 'usuarios') === 'equipo-interno',
      },
    };
  }
  const picks: WizardPick[] = [principal];
  if (str(a, 'modelo-existente') === 'no-crear') picks.push(pickModeloDesdeCero(a));
  else {
    const extra = extrasPorModeloExistente(a);
    if (extra) picks.push(extra);
  }
  return { rootChoice: 'web-3d', subChoice: 'web-app', picks };
}

/**
 * Punto de entrada: respuestas del wizard → plan de cotización.
 * Devuelve picks ordenados (principal primero); el caller cotiza cada pick
 * con derivarTier + computeQuote.
 */
export function planFromTreeAnswers(rootChoice: string, subChoice: string, answers: Answers): WizardQuotePlan {
  if (rootChoice !== 'web-3d') {
    // Ramas fuera de web-3d aún no tienen wizard: devolver plan vacío.
    return { rootChoice, subChoice, picks: [] };
  }
  switch (subChoice) {
    case 'ver-modelo': return planVerModelo(answers);
    case 'interactivo': return planInteractivo(answers);
    case 'scrollytelling': return planScrollytelling(answers);
    case 'web-app': return planWebApp(answers);
    default: return { rootChoice, subChoice, picks: [] };
  }
}
