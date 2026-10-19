export interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  SESSION_SECRET: string;
  /** Clave secreta de Cloudflare Turnstile (captcha del login público). */
  TURNSTILE_SECRET_KEY?: string;
  /** Clave de la API de Resend (envío de credenciales por correo). */
  RESEND_API_KEY?: string;
  /** Remitente verificado, p. ej. "Relax Hotel <cuentas@midominio.com>". */
  RESEND_FROM?: string;
  /** URL pública del sitio, usada en el enlace del correo. */
  APP_URL?: string;
  /** Clave que usa un sistema externo (RelaxPMS) para consultar reservas. */
  INTEGRATIONS_API_KEY?: string;
  /** Hotel cuyas reservas expone la integración. */
  INTEGRATIONS_HOTEL_ID?: string;
  /** Origen de RelaxPMS, sin barra final. Sin esto no se consultan las ocupadas. */
  RELAXPMS_API_URL?: string;
  /** Clave para consultar RelaxPMS; si falta se usa INTEGRATIONS_API_KEY. */
  RELAXPMS_API_KEY?: string;
}

/** Variables sin las cuales no se puede autenticar ni leer datos del panel. */
const REQUIRED_SERVER_VARS = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SESSION_SECRET'] as const;

function isAbsoluteHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

/**
 * Nombres (nunca valores) de las variables de entorno que faltan o están mal
 * formadas. Sirve para fallar con un mensaje claro en vez de con un 500 pelado
 * cuando el despliegue no tiene la configuración cargada.
 */
export function serverConfigProblems(env: Env): string[] {
  const problems: string[] = [];
  for (const name of REQUIRED_SERVER_VARS) {
    const value = (env[name] || '').trim();
    if (!value) {
      problems.push(`${name} ausente`);
      continue;
    }
    if (name === 'SUPABASE_URL' && !isAbsoluteHttpUrl(value)) {
      problems.push(`${name} inválida (se esperaba una URL absoluta http(s))`);
    }
  }
  return problems;
}

export const SESSION_COOKIE = 'cms_session';
const SESSION_MAX_AGE = 60 * 60 * 8; // 8 horas

export function json(data: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers },
  });
}

export function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get('Cookie') || '';
  const entry = header
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  return entry ? decodeURIComponent(entry.slice(name.length + 1)) : null;
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function sign(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return toBase64Url(new Uint8Array(signature));
}

export interface SessionPayload {
  sub: string;
  role: string;
  exp: number;
}

export async function createSessionToken(env: Env, payload: SessionPayload): Promise<string> {
  const body = toBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const signature = await sign(env.SESSION_SECRET, body);
  return `${body}.${signature}`;
}

export async function readSession(env: Env, request: Request): Promise<SessionPayload | null> {
  const token = readCookie(request, SESSION_COOKIE);
  if (!token) return null;

  const [body, signature] = token.split('.');
  if (!body || !signature) return null;

  const expected = await sign(env.SESSION_SECRET, body);
  if (signature.length !== expected.length) return null;

  let mismatch = 0;
  for (let i = 0; i < signature.length; i++) {
    mismatch |= signature.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  if (mismatch !== 0) return null;

  try {
    const payload = JSON.parse(atob(body.replace(/-/g, '+').replace(/_/g, '/'))) as SessionPayload;
    if (!payload?.sub || typeof payload.exp !== 'number' || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export function sessionCookie(token: string, isSecure: boolean): string {
  const flags = [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${SESSION_MAX_AGE}`,
  ];
  if (isSecure) flags.push('Secure');
  return flags.join('; ');
}

export function clearedSessionCookie(isSecure: boolean): string {
  const flags = [`${SESSION_COOKIE}=`, 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=0'];
  if (isSecure) flags.push('Secure');
  return flags.join('; ');
}

export function isSecureRequest(request: Request): boolean {
  return new URL(request.url).protocol === 'https:';
}
