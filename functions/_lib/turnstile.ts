import { json, type Env } from './env';

const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

function isLocalRequest(request: Request): boolean {
  const host = new URL(request.url).hostname;
  return host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host === '::1';
}

export interface TurnstileResult {
  ok: boolean;
  error?: string;
  status?: number;
}

/**
 * Verifica el token de Cloudflare Turnstile del formulario de login.
 *
 * - Si `TURNSTILE_SECRET_KEY` está configurada, el token es obligatorio.
 * - Si no está configurada, se permite solo en desarrollo local; en cualquier
 *   otro host se rechaza el login (falla cerrado) para no dejar el acceso
 *   público sin captcha por un olvido de configuración.
 */
export async function verifyTurnstile(
  request: Request,
  env: Env,
  token: string | undefined
): Promise<TurnstileResult> {
  const secret = env.TURNSTILE_SECRET_KEY;

  if (!secret) {
    if (isLocalRequest(request)) return { ok: true };
    // Falla cerrado. El motivo real (falta la clave secreta) queda en el
    // código y no se le comunica al visitante. 
    return {
      ok: false,
      status: 503,
      error: 'El ingreso no está disponible en este momento. Probá más tarde.',
    };
  }

  if (!token) {
    return { ok: false, status: 400, error: 'Falta completar el captcha' };
  }

  const payload = new FormData();
  payload.append('secret', secret);
  payload.append('response', token);
  const ip = request.headers.get('CF-Connecting-IP');
  if (ip) payload.append('remoteip', ip);

  try {
    const response = await fetch(TURNSTILE_VERIFY_URL, { method: 'POST', body: payload });
    const result = (await response.json().catch(() => null)) as
      | { success?: boolean; 'error-codes'?: string[] }
      | null;

    if (!result?.success) {
      return { ok: false, status: 403, error: 'El captcha no se pudo validar. Probá de nuevo.' };
    }
    return { ok: true };
  } catch {
    return { ok: false, status: 502, error: 'No se pudo verificar el captcha. Probá de nuevo.' };
  }
}
