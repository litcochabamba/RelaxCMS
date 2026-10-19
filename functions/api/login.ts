import {
  createSessionToken,
  isSecureRequest,
  json,
  serverConfigProblems,
  sessionCookie,
  type Env,
} from '../_lib/env';
import {
  findClientByUsername,
  findUserByUsername,
  serviceRequest,
  verifyClientPassword,
  verifyPassword,
} from '../_lib/supabase';
import { verifyTurnstile } from '../_lib/turnstile';

const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const UNAVAILABLE = 'El ingreso no está disponible en este momento. Probá más tarde.';

interface LoginBody {
  username?: string;
  password?: string;
  turnstileToken?: string;
  'cf-turnstile-response'?: string;
}

/**
 * Un solo login para todos: primero se buscan usuarios del sistema
 * (`usuarios`) y, si no existe, clientes (`clientes`). El panel de admin y
 * las funciones de administración siguen exigiendo rol admin/moderador.
 */
export async function handleLogin(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'Método no permitido' }, 405);

  // Sin estas variables no hay forma de validar credenciales ni de firmar la
  // sesión. Se avisa en los logs del despliegue y se responde un 503 genérico
  // (nunca se exponen nombres de variables ni valores al visitante).
  const configProblems = serverConfigProblems(env);
  if (configProblems.length > 0) {
    console.error('[login] configuración incompleta:', configProblems.join('; '));
    return json({ error: UNAVAILABLE }, 503);
  }

  const body = (await request.json().catch(() => null)) as LoginBody | null;

  const username = body?.username?.trim();
  const password = body?.password;
  const captchaToken = body?.turnstileToken || body?.['cf-turnstile-response'];

  if (!username || !password) {
    return json({ error: 'Usuario y contraseña son obligatorios' }, 400);
  }

  const captcha = await verifyTurnstile(request, env, captchaToken);
  if (!captcha.ok) {
    return json({ error: captcha.error || 'Captcha inválido' }, captcha.status || 400);
  }

  // ---------- Usuario del sistema ----------
  const userCheck = await verifyPassword(env, username, password);
  if (userCheck.unavailable) {
    console.error('[login] Supabase no respondió al verificar el usuario');
    return json({ error: UNAVAILABLE }, 503);
  }
  if (userCheck.ok) {
    const user = await findUserByUsername(env, username);
    if (!user) return json({ error: 'Credenciales inválidas' }, 401);
    if (!user.active) return json({ error: 'Cuenta desactivada' }, 403);

    await serviceRequest(env, `usuarios?id=eq.${encodeURIComponent(user.id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ last_login: new Date().toISOString() }),
      prefer: 'return=minimal',
    });

    const token = await createSessionToken(env, {
      sub: user.id,
      role: user.role,
      exp: Date.now() + SESSION_TTL_MS,
    });

    return json({ user }, 200, { 'Set-Cookie': sessionCookie(token, isSecureRequest(request)) });
  }

  // ---------- Cliente ----------
  const clientCheck = await verifyClientPassword(env, username, password);
  if (clientCheck.unavailable) {
    console.error('[login] Supabase no respondió al verificar el cliente');
    return json({ error: UNAVAILABLE }, 503);
  }
  if (clientCheck.ok) {
    const client = await findClientByUsername(env, username);
    if (!client) return json({ error: 'Credenciales inválidas' }, 401);
    if (!client.active) return json({ error: 'Cuenta desactivada' }, 403);

    await serviceRequest(env, `clientes?id=eq.${encodeURIComponent(client.id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ last_login: new Date().toISOString() }),
      prefer: 'return=minimal',
    });

    const token = await createSessionToken(env, {
      sub: client.id,
      role: 'client',
      exp: Date.now() + SESSION_TTL_MS,
    });

    return json(
      {
        user: {
          id: client.id,
          username: client.username,
          name: client.name,
          email: client.email,
          role: 'client',
          hotel_id: client.hotel_id,
          avatar_url: null,
        },
      },
      200,
      { 'Set-Cookie': sessionCookie(token, isSecureRequest(request)) }
    );
  }

  return json({ error: 'Credenciales inválidas' }, 401);
}

export const onRequestPost = async ({ request, env }: { request: Request; env: Env }) => {
  try {
    return await handleLogin(request, env);
  } catch (error) {
    // Antes esto salía como "error code: 1101" (excepción del Worker) y el
    // navegador solo veía un 500 sin cuerpo útil.
    console.error('[login] error inesperado:', error);
    return json({ error: UNAVAILABLE }, 503);
  }
};
