import { json, readSession, type Env } from '../../_lib/env';
import { serviceRequest } from '../../_lib/supabase';
import { isPmsRoomOccupied } from '../../_lib/pmsOccupancy';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

const MAX_NAME = 120;
const MAX_PHONE = 40;
const MAX_ROOM = 120;
const MAX_MESSAGE = 1000;

function dayValue(value: string): number | null {
  if (!DATE.test(value)) return null;
  const time = Date.parse(`${value}T00:00:00Z`);
  return Number.isNaN(time) ? null : time;
}

/**
 * Solicitud de reserva del formulario público.
 *
 * Escribe con la service role (el navegador no tiene permiso de escritura en
 * `reservas`). Si la petición trae la cookie de sesión de un cliente, la
 * solicitud queda vinculada a esa cuenta (`cliente_id`) y hereda su correo;
 * sin sesión se guarda como huésped anónimo. Nunca devuelve datos de otras
 * reservas: solo el identificador de la que acaba de crear.
 */
export async function handlePublicReservation(
  request: Request,
  env: Env
): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'Método no permitido' }, 405);

  const body = (await request.json().catch(() => null)) as
    | {
        hotel_id?: string;
        guest_name?: string;
        guest_phone?: string;
        guest_email?: string;
        check_in?: string;
        check_out?: string;
        adults?: number;
        children_count?: number;
        room_type?: string;
        room_unit?: string;
        message?: string;
      }
    | null;

  const hotelId = (body?.hotel_id || '').trim();
  const guestName = (body?.guest_name || '').trim();
  const guestPhone = (body?.guest_phone || '').trim();
  let guestEmail = (body?.guest_email || '').trim().toLowerCase();
  const checkIn = (body?.check_in || '').trim();
  const checkOut = (body?.check_out || '').trim();
  const roomType = (body?.room_type || '').trim();
  const roomUnit = (body?.room_unit || '').trim();
  const message = (body?.message || '').trim();
  const adults = Number(body?.adults ?? 1);
  const children = Number(body?.children_count ?? 0);

  if (!UUID.test(hotelId)) return json({ error: 'Hotel no válido' }, 400);
  if (guestName.length < 2 || guestName.length > MAX_NAME) {
    return json({ error: 'Ingresá tu nombre completo' }, 400);
  }
  if (guestPhone.length < 6 || guestPhone.length > MAX_PHONE) {
    return json({ error: 'Ingresá un teléfono de contacto válido' }, 400);
  }
  if (guestEmail && (!EMAIL.test(guestEmail) || guestEmail.length > 200)) {
    return json({ error: 'El correo no es válido' }, 400);
  }

  const inTime = dayValue(checkIn);
  const outTime = dayValue(checkOut);
  if (inTime === null || outTime === null) {
    return json({ error: 'Elegí las fechas de ingreso y salida' }, 400);
  }
  if (outTime <= inTime) {
    return json({ error: 'La fecha de salida debe ser posterior a la de ingreso' }, 400);
  }

  if (!roomType || roomType.length > MAX_ROOM) {
    return json({ error: 'Elegí un tipo de habitación' }, 400);
  }
  if (!Number.isInteger(adults) || adults < 1 || adults > 20) {
    return json({ error: 'La cantidad de adultos no es válida' }, 400);
  }
  if (!Number.isInteger(children) || children < 0 || children > 20) {
    return json({ error: 'La cantidad de niños no es válida' }, 400);
  }
  if (message.length > MAX_MESSAGE) {
    return json({ error: 'El mensaje es demasiado largo' }, 400);
  }
  if (roomUnit.length > MAX_ROOM) {
    return json({ error: 'La habitación elegida no es válida' }, 400);
  }

  const hotel = await serviceRequest<Array<{ id: string }>>(
    env,
    `hoteles?id=eq.${encodeURIComponent(hotelId)}&select=id&limit=1`
  );
  if (hotel.status === 503) return json({ error: 'Servicio no disponible. Probá más tarde.' }, 503);
  if (hotel.error || !hotel.data?.length) return json({ error: 'Hotel no encontrado' }, 404);

  // La unidad concreta no puede tener dos estadías activas que se solapen. El
  // formulario deshabilita las ocupadas, pero dos personas pueden enviar a la
  // vez: el chequeo del servidor evita la doble reserva.
  const roomLabel = roomUnit ? `${roomType} · ${roomUnit}` : roomType;
  if (roomUnit) {
    const overlapping = await serviceRequest<Array<{ id: string }>>(
      env,
      `reservas?hotel_id=eq.${encodeURIComponent(hotelId)}` +
        `&room_type=eq.${encodeURIComponent(roomLabel)}` +
        `&status=in.(pending,confirmed)` +
        `&check_in=lt.${checkOut}&check_out=gt.${checkIn}` +
        `&select=id&limit=1`
    );
    if (overlapping.status === 503) {
      return json({ error: 'Servicio no disponible. Probá más tarde.' }, 503);
    }
    if (overlapping.data && overlapping.data.length > 0) {
      return json(
        { error: 'Esa habitación ya está reservada en esas fechas. Elegí otra.' },
        409
      );
    }

    /*
     * El formulario deshabilita lo que el PMS tiene ocupado, pero el chequeo
     * tiene que existir también acá: alguien puede enviar el POST sin pasar por
     * la pantalla. Si el PMS no responde no se bloquea la solicitud.
     */
    const occupiedNow = await isPmsRoomOccupied(env, hotelId, roomLabel, checkIn, checkOut);
    if (occupiedNow) {
      return json(
        { error: 'Esa habitación está ocupada en el hotel en esas fechas. Elegí otra.' },
        409
      );
    }
  }

  // Vínculo con la cuenta de cliente: solo si la cookie es válida y la cuenta
  // sigue activa. El cliente nunca elige a qué cuenta se vincula la reserva.
  let clienteId: string | null = null;
  const session = await readSession(env, request);
  if (session?.role === 'client') {
    const client = await serviceRequest<
      Array<{ id: string; email: string | null; active: boolean }>
    >(
      env,
      `clientes?id=eq.${encodeURIComponent(session.sub)}&select=id,email,active&limit=1`
    );
    const account = client.data?.[0];
    if (!client.error && account?.active) {
      clienteId = account.id;
      if (!guestEmail && account.email) guestEmail = account.email.trim().toLowerCase();
    }
  }

  const inserted = await serviceRequest<Array<{ id: string }>>(env, 'reservas', {
    method: 'POST',
    body: JSON.stringify({
      hotel_id: hotelId,
      cliente_id: clienteId,
      guest_name: guestName,
      guest_phone: guestPhone,
      guest_email: guestEmail || null,
      check_in: checkIn,
      check_out: checkOut,
      adults,
      children_count: children,
      room_type: roomLabel,
      message: message || null,
      status: 'pending',
    }),
    prefer: 'return=representation',
  });

  if (inserted.status === 503) return json({ error: 'Servicio no disponible. Probá más tarde.' }, 503);
  if (inserted.error) return json({ error: 'No se pudo guardar la solicitud' }, 400);

  return json({ error: null, data: { id: inserted.data?.[0]?.id ?? null } }, 201);
}

export const onRequestPost = ({ request, env }: { request: Request; env: Env }) =>
  handlePublicReservation(request, env);
