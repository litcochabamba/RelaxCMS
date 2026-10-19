import { json, type Env } from '../../_lib/env';
import { serviceRequest } from '../../_lib/supabase';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const MAX_NAME = 120;
const MAX_EMAIL = 200;
const MAX_CONTENT = 2000;

/**
 * Los comentarios del sitio público no pasan por el CRUD del CMS (ese exige
 * sesión). Este endpoint inserta con la service role, fuerza el estado
 * `pending` y valida los campos antes de guardar.
 */
export async function handlePublicComment(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'Método no permitido' }, 405);

  const body = (await request.json().catch(() => null)) as
    | { hotel_id?: string; name?: string; email?: string; content?: string }
    | null;

  const hotelId = (body?.hotel_id || '').trim();
  const name = (body?.name || '').trim();
  const email = (body?.email || '').trim();
  const content = (body?.content || '').trim();

  if (!UUID.test(hotelId)) return json({ error: 'Hotel no válido' }, 400);
  if (!name || name.length > MAX_NAME) return json({ error: 'Nombre no válido' }, 400);
  if (!EMAIL.test(email) || email.length > MAX_EMAIL) return json({ error: 'Correo no válido' }, 400);
  if (content.length < 5 || content.length > MAX_CONTENT) {
    return json({ error: 'El comentario debe tener entre 5 y 2000 caracteres' }, 400);
  }

  const hotel = await serviceRequest<Array<{ id: string }>>(
    env,
    `hoteles?id=eq.${encodeURIComponent(hotelId)}&select=id&limit=1`
  );
  if (hotel.status === 503) return json({ error: 'Servicio no disponible. Probá más tarde.' }, 503);
  if (hotel.error || !hotel.data?.length) return json({ error: 'Hotel no encontrado' }, 404);

  const inserted = await serviceRequest<Record<string, unknown>>(env, 'comentarios', {
    method: 'POST',
    body: JSON.stringify({ hotel_id: hotelId, name, email, content, status: 'pending' }),
    prefer: 'return=minimal',
  });

  if (inserted.status === 503) return json({ error: 'Servicio no disponible. Probá más tarde.' }, 503);
  if (inserted.error) return json({ error: 'No se pudo guardar el comentario' }, 400);
  return json({ error: null }, 201);
}

export const onRequestPost = ({ request, env }: { request: Request; env: Env }) =>
  handlePublicComment(request, env);
