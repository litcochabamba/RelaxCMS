import type { Env } from './env';

/**
 * Cliente REST que usa la service role key. Solo se ejecuta en el servidor:
 * esa clave nunca se envía al navegador.
 */
export async function serviceRequest<T>(
  env: Env,
  path: string,
  init: RequestInit & { prefer?: string } = {}
): Promise<{ data: T | null; error: string | null; status: number }> {
  const { prefer, ...rest } = init;

  // Las variables se recortan porque al cargarlas en Cloudflare es fácil que se
  // pegue un salto de línea al final; eso rompe la URL y el header y, sin este
  // try/catch, la Function terminaba en un 500 sin explicación.
  const baseUrl = (env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const serviceKey = (env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

  let response: Response;
  try {
    response = await fetch(`${baseUrl}/rest/v1/${path}`, {
      ...rest,
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        ...(prefer ? { Prefer: prefer } : {}),
        ...(rest.headers as Record<string, string> | undefined),
      },
    });
  } catch (error) {
    console.error('[supabase] no se pudo conectar:', error);
    return { data: null, error: 'No se pudo conectar con la base de datos', status: 503 };
  }

  if (!response.ok) {
    const detail = await response.json().catch(() => null);
    const message =
      (detail && typeof detail === 'object' && 'message' in detail && String(detail.message)) ||
      `HTTP ${response.status}`;
    return { data: null, error: message, status: response.status };
  }

  const data = (await response.json().catch(() => null)) as T | null;
  return { data, error: null, status: response.status };
}

export async function findUserByUsername(env: Env, username: string) {
  const result = await serviceRequest<
    Array<{
      id: string;
      username: string;
      name: string;
      email: string | null;
      role: string;
      hotel_id: string | null;
      active: boolean;
      avatar_url: string | null;
    }>
  >(
    env,
    `usuarios?username=eq.${encodeURIComponent(username)}&select=id,username,name,email,role,hotel_id,active,avatar_url&limit=1`
  );

  if (result.error || !result.data) return null;
  return result.data[0] ?? null;
}

export interface CredentialCheck {
  ok: boolean;
  /** La base de datos no respondió: no es una contraseña incorrecta. */
  unavailable: boolean;
}

export async function verifyPassword(
  env: Env,
  username: string,
  password: string
): Promise<CredentialCheck> {
  const result = await serviceRequest<boolean>(env, 'rpc/verify_password', {
    method: 'POST',
    body: JSON.stringify({ p_username: username, p_password: password }),
  });

  if (result.status === 503) return { ok: false, unavailable: true };
  return { ok: result.error === null && result.data === true, unavailable: false };
}

export interface ClientAccount {
  id: string;
  username: string;
  name: string;
  email: string | null;
  phone: string | null;
  hotel_id: string | null;
  active: boolean;
  created_at: string | null;
  last_login: string | null;
}

export async function findClientByUsername(env: Env, username: string): Promise<ClientAccount | null> {
  const result = await serviceRequest<ClientAccount[]>(
    env,
    `clientes?username=eq.${encodeURIComponent(username)}&select=id,username,name,email,phone,hotel_id,active,created_at,last_login&limit=1`
  );

  if (result.error || !result.data) return null;
  return result.data[0] ?? null;
}

export async function verifyClientPassword(
  env: Env,
  username: string,
  password: string
): Promise<CredentialCheck> {
  const result = await serviceRequest<boolean>(env, 'rpc/verify_client_password', {
    method: 'POST',
    body: JSON.stringify({ p_username: username, p_password: password }),
  });

  if (result.status === 503) return { ok: false, unavailable: true };
  return { ok: result.error === null && result.data === true, unavailable: false };
}

export async function hashPassword(env: Env, password: string): Promise<string | null> {
  const result = await serviceRequest<string>(env, 'rpc/hash_password', {
    method: 'POST',
    body: JSON.stringify({ p_password: password }),
  });

  return result.error === null ? result.data : null;
}
