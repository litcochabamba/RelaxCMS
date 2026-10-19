import { json, readSession, type Env } from '../../_lib/env';
import { hashPassword, serviceRequest } from '../../_lib/supabase';
import { sendCredentialsEmail, type EmailResult } from '../../_lib/email';

/**
 * Alta, listado y baja de cuentas desde el panel.
 *
 * - `type=users`   → usuarios del sistema (tabla `usuarios`; admin / moderador)
 * - `type=clients` → clientes (tabla `clientes`)
 *
 * Las altas hechas por un administrador autenticado NO pasan por captcha: la
 * sesión de administración ya prueba la identidad. El captcha solo protege el
 * login público.
 *
 * Si el alta incluye correo, se le envían las credenciales por Resend sin
 * bloquear la creación de la cuenta.
 */

const USER_ROLES = ['admin', 'moderator'];

interface AccountBody {
  type?: string;
  name?: string;
  username?: string;
  password?: string;
  email?: string;
  phone?: string;
  role?: string;
  hotel_id?: string;
}

function accountType(request: Request): 'users' | 'clients' {
  const value = new URL(request.url).searchParams.get('type');
  return value === 'clients' ? 'clients' : 'users';
}

async function authorize(env: Env, request: Request, write: boolean): Promise<Response | null> {
  const session = await readSession(env, request);
  if (!session) return json({ error: 'Sesión no válida o expirada' }, 401);
  const isAdmin = session.role === 'admin';
  if (write ? !isAdmin : !(isAdmin || session.role === 'moderator')) {
    return json({ error: 'La cuenta no tiene permisos para esta acción' }, 403);
  }
  return null;
}

export async function handleAccounts(request: Request, env: Env): Promise<Response> {
  const type = accountType(request);
  const table = type === 'clients' ? 'clientes' : 'usuarios';

  if (request.method === 'GET') {
    const denied = await authorize(env, request, false);
    if (denied) return denied;

    const select =
      type === 'clients'
        ? 'id,name,username,email,phone,active,created_at,last_login,country_iso,country_dial,country_name,gender,age,profession'
        : 'id,name,username,email,role,active,created_at,last_login,hotel_id';

    const result = await serviceRequest<Record<string, unknown>[]>(
      env,
      `${table}?select=${select}&order=created_at.desc&limit=200`
    );

    if (result.error) return json({ error: result.error }, 400);
    return json({ data: result.data ?? [], error: null });
  }

  if (request.method === 'POST') {
    const denied = await authorize(env, request, true);
    if (denied) return denied;

    const body = (await request.json().catch(() => null)) as AccountBody | null;
    const name = body?.name?.trim() || '';
    const username = body?.username?.trim().toLowerCase() || '';
    const password = body?.password || '';
    const email = body?.email?.trim() || null;
    const phone = body?.phone?.trim() || null;
    const role = (body?.role || 'moderator').trim();

    if (!name || !username || !password) {
      return json({ error: 'Nombre, usuario y contraseña son obligatorios' }, 400);
    }
    if (!/^[a-z0-9._-]{3,32}$/.test(username)) {
      return json({ error: 'El usuario debe tener entre 3 y 32 caracteres (letras, números, punto, guion)' }, 400);
    }
    if (password.length < 6) {
      return json({ error: 'La contraseña debe tener al menos 6 caracteres' }, 400);
    }
    if (type === 'users' && !USER_ROLES.includes(role)) {
      return json({ error: 'Rol no válido para un usuario del sistema' }, 400);
    }

    const passwordHash = await hashPassword(env, password);
    if (!passwordHash) return json({ error: 'No se pudo procesar la contraseña' }, 500);

    const payload: Record<string, unknown> =
      type === 'clients'
        ? {
            name,
            username,
            email,
            phone,
            password_hash: passwordHash,
            hotel_id: body?.hotel_id || null,
          }
        : {
            name,
            username,
            email,
            role,
            password_hash: passwordHash,
            hotel_id: body?.hotel_id || null,
          };

    // Nunca se devuelve password_hash al navegador.
    const returningColumns =
      type === 'clients'
        ? 'id,name,username,email,phone,active,created_at'
        : 'id,name,username,email,role,active,created_at,hotel_id';

    const result = await serviceRequest<Record<string, unknown>[]>(env, `${table}?select=${returningColumns}`, {
      method: 'POST',
      body: JSON.stringify(payload),
      prefer: 'return=representation',
    });

    if (result.error) {
      const duplicated = /duplicate key|already exists/i.test(result.error);
      return json(
        { error: duplicated ? 'Ese usuario o correo ya existe' : result.error },
        duplicated ? 409 : 400
      );
    }

    // Entrega de credenciales por correo: un fallo del proveedor no revierte el alta.
    let delivery: EmailResult | null = null;
    if (email) {
      const origin = env.APP_URL?.trim() || new URL(request.url).origin;
      delivery = await sendCredentialsEmail(env, {
        to: email,
        name,
        username,
        password,
        role: type === 'clients' ? 'client' : (role as 'admin' | 'moderator'),
        loginUrl: `${origin.replace(/\/$/, '')}/auth/login`,
      });
    }

    return json({ data: result.data?.[0] || null, error: null, emailStatus: delivery }, 201);
  }

  if (request.method === 'DELETE') {
    const denied = await authorize(env, request, true);
    if (denied) return denied;

    const id = new URL(request.url).searchParams.get('id');
    if (!id) return json({ error: 'Falta el id de la cuenta' }, 400);

    const session = await readSession(env, request);
    if (session?.sub === id) {
      return json({ error: 'No podés eliminar tu propia cuenta' }, 400);
    }

    const result = await serviceRequest(env, `${table}?id=eq.${encodeURIComponent(id)}`, {
      method: 'DELETE',
      prefer: 'return=minimal',
    });

    if (result.error) return json({ error: result.error }, 400);
    return json({ data: null, error: null });
  }

  return json({ error: 'Método no permitido' }, 405);
}

export const onRequestGet = ({ request, env }: { request: Request; env: Env }) =>
  handleAccounts(request, env);

export const onRequestPost = ({ request, env }: { request: Request; env: Env }) =>
  handleAccounts(request, env);

export const onRequestDelete = ({ request, env }: { request: Request; env: Env }) =>
  handleAccounts(request, env);
