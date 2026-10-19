import { json, readSession, type Env } from '../../_lib/env';
import { serviceRequest } from '../../_lib/supabase';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const MAX_NAME = 120;
const MAX_PHONE = 40;
const MAX_PROMOTION = 200;

/**
 * Marca interna de las consultas hechas desde una promoción. El feed de
 * integración (`functions/api/integrations/v1/promotion-inquiries`) filtra por
 * este valor para que RelaxPMS las reciba como avisos.
 */
const MARKER = 'promotion-inquiry';

/**
 * Consulta de una promoción desde el sitio público.
 *
 * El formulario pide nombre y celular antes de saltar a WhatsApp: eso es lo que
 * permite que recepción sepa quién preguntó. La fila se guarda en `consultas`
 * con la service role (el CRUD del CMS exige sesión y un visitante no la tiene)
 * y con `admin_notes = 'promotion-inquiry'`, que es la marca que lee el feed.
 */
export async function handlePublicPromotionInquiry(
  request: Request,
  env: Env
): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'Método no permitido' }, 405);

  const body = (await request.json().catch(() => null)) as
    | {
        hotel_id?: string;
        name?: string;
        phone?: string;
        email?: string;
        promotion?: string;
      }
    | null;

  const hotelId = (body?.hotel_id || '').trim();
  const name = (body?.name || '').trim().replace(/\s+/g, ' ');
  const phone = (body?.phone || '').trim();
  const promotion = (body?.promotion || '').trim().replace(/\s+/g, ' ');
  const providedEmail = (body?.email || '').trim().toLowerCase();

  if (!UUID.test(hotelId)) return json({ error: 'Hotel no válido' }, 400);
  if (name.length < 2 || name.length > MAX_NAME) return json({ error: 'Ingresá tu nombre' }, 400);
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 6 || digits.length > 15 || phone.length > MAX_PHONE) {
    return json({ error: 'Ingresá un número de celular válido' }, 400);
  }
  if (promotion.length > MAX_PROMOTION) {
    return json({ error: 'La promoción no es válida' }, 400);
  }
  if (providedEmail && (!EMAIL.test(providedEmail) || providedEmail.length > 200)) {
    return json({ error: 'El correo no es válido' }, 400);
  }

  const hotel = await serviceRequest<Array<{ id: string }>>(
    env,
    `hoteles?id=eq.${encodeURIComponent(hotelId)}&select=id&limit=1`
  );
  if (hotel.status === 503) return json({ error: 'Servicio no disponible. Probá más tarde.' }, 503);
  if (hotel.error || !hotel.data?.length) return json({ error: 'Hotel no encontrado' }, 404);

  // Si hay sesión de cliente, el correo de la cuenta queda asociado a la
  // consulta; un visitante anónimo puede no tener correo y la columna es
  // obligatoria, así que se guarda vacío.
  let email = providedEmail;
  const session = await readSession(env, request);
  if (!email && session?.role === 'client') {
    const client = await serviceRequest<Array<{ email: string | null }>>(
      env,
      `clientes?id=eq.${encodeURIComponent(session.sub)}&select=email&limit=1`
    );
    email = (client.data?.[0]?.email || '').trim().toLowerCase();
  }

  const inserted = await serviceRequest<Array<{ id: string }>>(env, 'consultas', {
    method: 'POST',
    body: JSON.stringify({
      hotel_id: hotelId,
      name,
      email,
      phone,
      message: promotion || 'Consulta general de promociones',
      status: 'pending',
      admin_notes: MARKER,
    }),
    prefer: 'return=representation',
  });

  if (inserted.status === 503) return json({ error: 'Servicio no disponible. Probá más tarde.' }, 503);
  if (inserted.error) return json({ error: 'No se pudo guardar la consulta' }, 400);

  return json({ error: null, data: { id: inserted.data?.[0]?.id ?? null } }, 201);
}

export const onRequestPost = ({ request, env }: { request: Request; env: Env }) =>
  handlePublicPromotionInquiry(request, env);
