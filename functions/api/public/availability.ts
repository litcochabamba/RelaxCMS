import { json, type Env } from '../../_lib/env';
import { serviceRequest } from '../../_lib/supabase';
import {
  fetchPmsOccupiedRooms,
  loadPmsRoomLabels,
  pmsRangesForWindow,
  type OccupiedRange,
} from '../../_lib/pmsOccupancy';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function dayValue(value: string): number | null {
  if (!DATE.test(value)) return null;
  const time = Date.parse(`${value}T00:00:00Z`);
  return Number.isNaN(time) ? null : time;
}

/**
 * Ocupación de habitaciones por fechas, para el formulario público de reservas.
 *
 * Solo expone el rótulo de la habitación (`room_type`), nunca datos del
 * huésped. Las solicitudes pendientes también bloquean la unidad: mientras el
 * hotel no las confirme o cancele, nadie más puede pedir la misma habitación
 * para esas fechas. Las canceladas liberan la unidad.
 */
export async function handlePublicAvailability(
  request: Request,
  env: Env
): Promise<Response> {
  if (request.method !== 'GET') return json({ error: 'Método no permitido' }, 405);

  const params = new URL(request.url).searchParams;
  const hotelId = (params.get('hotel_id') || '').trim();
  const checkIn = (params.get('check_in') || '').trim();
  const checkOut = (params.get('check_out') || '').trim();

  if (!UUID.test(hotelId)) return json({ error: 'Hotel no válido' }, 400);
  const inTime = dayValue(checkIn);
  const outTime = dayValue(checkOut);
  if (inTime === null || outTime === null) return json({ error: 'Fechas no válidas' }, 400);
  if (outTime <= inTime) return json({ error: 'El rango de fechas no es válido' }, 400);

  // `detail=1` agrega las fechas de cada estadía. La galería lo usa para
  // mostrar cuándo está ocupada una unidad sin exponer al huésped.
  const detail = params.get('detail') === '1';

  // Dos estadías se solapan si una entra antes de que la otra salga y sale
  // después de que la otra entra. En paralelo se pregunta al PMS por las
  // habitaciones ocupadas: es una foto del momento, no una sincronización.
  const [result, pmsOccupied] = await Promise.all([
    serviceRequest<Array<{ room_type: string; check_in: string; check_out: string }>>(
      env,
      `reservas?hotel_id=eq.${encodeURIComponent(hotelId)}` +
        `&status=in.(pending,confirmed)` +
        `&check_in=lt.${checkOut}&check_out=gt.${checkIn}` +
        `&select=room_type,check_in,check_out&order=check_in.asc&limit=1000`
    ),
    fetchPmsOccupiedRooms(env),
  ]);

  if (result.status === 503) {
    return json({ error: 'Servicio no disponible. Probá más tarde.' }, 503);
  }
  if (result.error) return json({ error: 'No se pudo consultar la disponibilidad' }, 400);

  const rows = result.data ?? [];

  // Solo el rótulo de la habitación y las fechas: lo mínimo para pintar una
  // tarjeta como ocupada. Nunca el nombre, el teléfono ni el correo del huésped.
  const ranges: OccupiedRange[] = rows
    .filter((row) => row.room_type)
    .slice(0, 500)
    .map((row) => ({ room_type: row.room_type, check_in: row.check_in, check_out: row.check_out }));

  /*
   * Se suman las ocupadas del PMS. Si el PMS no responde, `pmsOccupied` es null
   * y la respuesta sigue siendo válida con las reservas web: la web nunca se
   * cae por la integración.
   */
  if (pmsOccupied?.length) {
    const labels = await loadPmsRoomLabels(env, hotelId);
    const pmsRanges = pmsRangesForWindow(pmsOccupied, labels, checkIn, checkOut);
    const seen = new Set(ranges.map((range) => `${range.room_type}|${range.check_in}|${range.check_out}`));
    for (const range of pmsRanges) {
      const key = `${range.room_type}|${range.check_in}|${range.check_out}`;
      if (seen.has(key)) continue;
      seen.add(key);
      ranges.push(range);
    }
  }

  const rooms = Array.from(new Set(ranges.map((range) => range.room_type).filter(Boolean)));

  if (!detail) return json({ data: { rooms }, error: null });

  return json({ data: { rooms, ranges: ranges.slice(0, 500) }, error: null });
}

export const onRequestGet = ({ request, env }: { request: Request; env: Env }) =>
  handlePublicAvailability(request, env);
