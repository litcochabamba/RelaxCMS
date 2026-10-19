import { json, readSession, type Env } from '../../_lib/env';
import { serviceRequest } from '../../_lib/supabase';

/**
 * El sitio público solo puede leer comentarios aprobados (RLS), así que el
 * panel necesita esta lectura autenticada para ver pendientes y rechazados.
 */
export async function handleAdminComments(request: Request, env: Env): Promise<Response> {
  const session = await readSession(env, request);
  if (!session) return json({ error: 'Sesión no válida o expirada' }, 401);
  if (session.role !== 'admin' && session.role !== 'moderator') {
    return json({ error: 'La cuenta no tiene permisos de administración' }, 403);
  }
  if (request.method !== 'GET') return json({ error: 'Método no permitido' }, 405);

  const hotelId = new URL(request.url).searchParams.get('hotel_id') || '';
  if (!hotelId) return json({ error: 'Falta hotel_id' }, 400);

  const result = await serviceRequest<Array<Record<string, unknown>>>(
    env,
    `comentarios?hotel_id=eq.${encodeURIComponent(hotelId)}&select=*&order=created_at.desc`
  );
  if (result.error) return json({ error: result.error }, 400);

  return json({ data: result.data ?? [] });
}

export const onRequestGet = ({ request, env }: { request: Request; env: Env }) =>
  handleAdminComments(request, env);
