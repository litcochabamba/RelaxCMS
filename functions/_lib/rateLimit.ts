import type { Env } from './env';
import { serviceRequest } from './supabase';

/**
 * Límite de reintentos del registro.
 *
 * Dos contadores globales (no por hotel), en `intentos_registro`:
 *  - alias + IP: 2 intentos cada 30 minutos.
 *  - IP: 10 intentos cada 30 minutos. Es alto a propósito: en una casa puede
 *    haber varias personas registrándose desde la misma IP, y el servidor no
 *    debe dejar afuera a las demás. No hay bloqueo permanente: la ventana se
 *    reinicia sola y la IP se guarda hasheada.
 *
 * Si el limitador falla (por ejemplo, la base no responde), el registro sigue
 * adelante: el captcha continúa siendo la barrera principal.
 */
const ALIAS_LIMIT = 2;
const IP_LIMIT = 10;
const WINDOW_MINUTES = 30;

export interface AttemptResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for') || '';
  const forwardedIp = forwarded.split(',')[0].trim();
  return (request.headers.get('CF-Connecting-IP') || forwardedIp || 'desconocida').trim();
}

async function registerAttempt(env: Env, key: string, limit: number): Promise<AttemptResult> {
  const result = await serviceRequest<Array<{ allowed: boolean; retry_after_seconds: number }>>(
    env,
    'rpc/check_registration_attempt',
    {
      method: 'POST',
      body: JSON.stringify({ p_key: key, p_limit: limit, p_window_minutes: WINDOW_MINUTES }),
    }
  );

  if (result.error || !result.data?.length) {
    console.error('[rateLimit] no se pudo contar el intento:', result.error);
    return { allowed: true, retryAfterSeconds: 0 };
  }

  const row = result.data[0];
  return {
    allowed: row.allowed !== false,
    retryAfterSeconds: Number(row.retry_after_seconds) || 0,
  };
}

export async function checkRegistrationAttempts(
  env: Env,
  request: Request,
  alias: string
): Promise<AttemptResult> {
  const ipHash = await sha256Hex(clientIp(request));

  const aliasAttempt = await registerAttempt(env, `alias:${alias}|ip:${ipHash}`, ALIAS_LIMIT);
  if (!aliasAttempt.allowed) return aliasAttempt;

  return registerAttempt(env, `ip:${ipHash}`, IP_LIMIT);
}

/** Borra contadores viejos cada tanto para que la tabla no crezca sin límite. */
export async function pruneOldAttempts(env: Env): Promise<void> {
  if (Math.random() > 0.05) return;
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  await serviceRequest(env, `intentos_registro?updated_at=lt.${encodeURIComponent(cutoff)}`, {
    method: 'DELETE',
    prefer: 'return=minimal',
  });
}
