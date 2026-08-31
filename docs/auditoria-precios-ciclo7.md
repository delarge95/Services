# Auditoría de precios — preguntas ↔ cotización (ciclo 7)

> Alcance: cada pregunta del wizard y del panel de configuración, y si mueve el precio. Resultado: **sin preguntas huérfanas bloqueantes**, pero hay 7 preguntas informativas (no cambian el precio) listadas al final con recomendación.

## 1. Preguntas del wizard que SÍ cambian el precio

| Rama | Pregunta | Variable/servicio que mueve |
|---|---|---|
| Todas | ¿Ya tienes el modelo 3D? + formato + calidad | Decide si se suma RTA-01 (creación) o CAD-01 (conversión) — el mayor multiplicador del presupuesto |
| ver-modelo / interactivo / scrollytelling / web-app | Nivel de detalle (1–5 continuo) | RTA-01.polyCount interpolado (4k→300k tris) |
| ver-modelo / interactivo / scrollytelling / web-app | Superficie (1–5 continuo) | RTA-01.tipoSuperficie (S→XL); ≥4.5 añade nota de discovery |
| ver-modelo / interactivo / scrollytelling / web-app | Cantidad de piezas | RTA-01.numPiezas / CAD-01.numPiezas |
| ver-modelo / interactivo / scrollytelling / web-app | Acabados (simple/variado/detallado) | RTA-01.numTexturas (1/3/6) |
| ver-modelo | Hotspots (avanzado) | WEB-01.numHotspots |
| ver-modelo | Dónde se muestra | WEB-01.target |
| interactivo | Tipo de interactividad + plataforma | Enruta a WEB-01 vs WEB-04 |
| scrollytelling | Escenas | WEB-05.numSecciones |
| web-app | Tipo de app | Enruta a WEB-04 / WEB-07 / WEB-06 |
| web-app | Variantes configurables | WEB-04.numVariantes |
| web-app | Usuarios (avanzado) | WEB-04.auth |
| web-app | Origen de datos (avanzado) | WEB-04.fuenteDatos |

## 2. Preguntas INFORMATIVAS (hoy no cambian el precio) — decisión pendiente

| Pregunta | Dónde | Recomendación |
|---|---|---|
| ¿Cómo se cuenta la historia? (tono) | scrollytelling | **Mantener**: califica el proyecto para el brief y no confunde. Etiquetarla como "(orientativo)" si se quiere ser estricto |
| PBR / iluminación del modelo (avanzado) | ver-modelo | Mantener: solo aplican si hay creación de modelo (y ahí sí afectan horas de lookdev en la cotización manual). Bajo impacto |
| Fondo / plataforma CMS / prioridad rendimiento (avanzados) | ver-modelo | Mantener: informan el brief; rendimiento podría subir a tier en una futura versión |
| Interacción visual: rotar / rotar-zoom / auto | ver-modelo | Los tres cotizan igual HOY (la diferencia real aparece con hotspots). Mantener por UX; no confunden precio |
| Piezas móviles / vista explosionada (avanzados) | ver-modelo / interactivo | Sin mapeo. **Candidatas a mapear** a RTA-03/RTA-06 en una próxima iteración de tarifas |

Ninguna de estas rompe la cotización: todas se envían en el resumen de WhatsApp/email como contexto del brief.

## 3. Panel de configuración (tras el wizard)

- Las variables que el wizard ya preguntó están **ocultas** (WEB-01: hotspots · WEB-05: secciones · WEB-04: variantes/auth/datos) y se editan con **"Editar detalles"** (regresa al menú anterior con las respuestas conservadas).
- Las variables restantes (SKUs, productos, mecanica, scores, CMS, Unity bridge, slides…) **todas mapean** a su servicio y re-precian en vivo.

## 4. Consistencia front-end ↔ motor

- `derivarTier` + `computeQuote` son las ÚNICAS fuentes de números (un solo motor para wizard, config y catálogo).
- Los rangos del PDF de la agencia se generaron con el mismo `computeQuote` sobre la rate card COP (script `propuesta-agencia/calc-rangos.ts`).
- Tests de consistencia: todo pick del wizard verifica que sus variables existan en `SERVICE_VARIABLES` y que coticen > 0 (25 tests en `treeToQuote.test.ts`).
