/**
 * chatConfig.ts — Configuración del asistente con IA (ciclo 26).
 * CHAT_ENDPOINT: URL del worker `cotizador-chat` (worker-cotizador/). Vacío = solo modo básico.
 * Se puede sobreescribir en build con la variable PUBLIC_COTIZADOR_CHAT_URL.
 * Tras `npx wrangler deploy`, pegar aquí la URL que imprime (…workers.dev) + '/chat'.
 */
const fromEnv = (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.PUBLIC_COTIZADOR_CHAT_URL;

export const CHAT_ENDPOINT: string = fromEnv ?? '';

/** Tiempo máximo de espera de la IA antes de responder en modo básico. */
export const CHAT_TIMEOUT_MS = 15000;

/** Aviso de privacidad mostrado cuando la IA está activa (capa gratuita de Gemini). */
export const CHAT_PRIVACY_NOTE = 'Con IA (Google Gemini). No escribas datos personales sensibles.';
