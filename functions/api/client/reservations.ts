import { json, readSession, type Env } from '../../_lib/env';
import { serviceRequest } from '../../_lib/supabase';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * El cliente cancela una de sus reservas pendientes.
 *
 * El filtro incluye `cliente_id` y `status`, así que solo puede tocar las
 * propias y solo si siguen pendientes. Al pasar a `cancelled`, la consulta de
 * disponibilidad deja de bloquear esa unidad para esas fechas.
 */
export async function handleClientReservations(
  request: Request,
  env: Env
): Promise<Response> {
  if (request.method !== 'PATCH') return json({ error: 'Método no permitido' }, 405);

  const session = await readSession(env, request);
  if (!session) return json({ error: 'Sesión no válida o expirada' }, 401);
  if (session.role !== 'client') {
    return json({ error: 'Esta sección es para clientes' }, 403);
  }

  const body = (await request.json().catch(() => null)) as { id?: string } | null;
  const id = (body?.id || '').trim();
  if (!UUID.test(id)) return json({ error: 'Reserva no válida' }, 400);

  const updated = await serviceRequest<Array<{ id: string; status: string }>>(
    env,
    `reservas?id=eq.${encodeURIComponent(id)}` +
      `&cliente_id=eq.${encodeURIComponent(session.sub)}` +
      `&status=eq.pending&select=id,status`,
    {
      method: 'PATCH',
      body: JSON.stringify({ status: 'cancelled' }),
      prefer: 'return=representation',
    }
  );

  if (updated.status === 503) {
    return json({ error: 'Servicio no disponible. Probá más tarde.' }, 503);
  }
  if (updated.error) return json({ error: 'No se pudo cancelar la reserva' }, 400);
  if (!updated.data?.length) {
    return json(
      { error: 'La reserva ya no está pendiente o no pertenece a tu cuenta' },
      409
    );
  }

  return json({ data: updated.data[0], error: null });
}

export const onRequestPatch = ({ request, env }: { request: Request; env: Env }) =>
  handleClientReservations(request, env);
