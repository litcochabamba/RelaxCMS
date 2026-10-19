import { json, readSession, type Env } from '../../_lib/env';
import { serviceRequest } from '../../_lib/supabase';

const STATUSES = ['pending', 'confirmed', 'cancelled', 'completed'] as const;
type Status = (typeof STATUSES)[number];

const COLUMNS = [
  'id',
  'hotel_id',
  'cliente_id',
  'guest_name',
  'guest_email',
  'guest_phone',
  'check_in',
  'check_out',
  'adults',
  'children_count',
  'room_type',
  'message',
  'status',
  'created_at',
].join(',');

async function authorize(request: Request, env: Env) {
  const session = await readSession(env, request);
  if (!session) return json({ error: 'Sesión no válida o expirada' }, 401);
  if (session.role !== 'admin' && session.role !== 'moderator') {
    return json({ error: 'La cuenta no tiene permisos de administración' }, 403);
  }
  return null;
}

/**
 * Reservas del panel.
 *
 * Se leen y escriben con la service role porque `reservas` guarda datos
 * personales de los huéspedes y no es legible con la clave anónima desde el
 * navegador. Solo se permite cambiar el estado y solo a valores conocidos.
 */
export async function handleAdminReservations(request: Request, env: Env): Promise<Response> {
  const denied = await authorize(request, env);
  if (denied) return denied;

  if (request.method === 'GET') {
    const hotelId = new URL(request.url).searchParams.get('hotel_id') || '';
    if (!hotelId) return json({ error: 'Falta hotel_id' }, 400);

    const result = await serviceRequest<Record<string, unknown>[]>(
      env,
      `reservas?select=${COLUMNS}&hotel_id=eq.${encodeURIComponent(hotelId)}&order=created_at.desc&limit=200`
    );
    if (result.error) return json({ error: 'No se pudieron cargar las reservas' }, 400);
    return json({ data: result.data ?? [], error: null });
  }

  if (request.method !== 'POST') return json({ error: 'Método no permitido' }, 405);

  const body = (await request.json().catch(() => null)) as
    | { id?: string; status?: string }
    | null;
  const id = (body?.id || '').trim();
  const status = (body?.status || '').trim() as Status;

  if (!id) return json({ error: 'Falta la reserva' }, 400);
  if (!STATUSES.includes(status)) return json({ error: 'Estado no válido' }, 400);

  const updated = await serviceRequest<Record<string, unknown>[]>(
    env,
    `reservas?id=eq.${encodeURIComponent(id)}&select=id,status`,
    {
      method: 'PATCH',
      body: JSON.stringify({ status }),
      prefer: 'return=representation',
    }
  );

  if (updated.error) return json({ error: 'No se pudo actualizar la reserva' }, 400);
  if (!updated.data?.length) return json({ error: 'La reserva ya no existe' }, 404);
  return json({ data: updated.data[0], error: null });
}

export const onRequestGet = ({ request, env }: { request: Request; env: Env }) =>
  handleAdminReservations(request, env);

export const onRequestPost = ({ request, env }: { request: Request; env: Env }) =>
  handleAdminReservations(request, env);
