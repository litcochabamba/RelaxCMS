import { json, readSession, type Env } from '../../_lib/env';
import { serviceRequest } from '../../_lib/supabase';
import { fetchPmsCatalog } from '../../_lib/pmsCatalog';
import {
  fetchPmsOccupiedRooms,
  loadPmsRoomLabels,
  pmsRangesForWindow,
  type OccupiedRange,
} from '../../_lib/pmsOccupancy';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** `rooms.current_status` del PMS, para la galería del CMS. */
const PMS_STATUS_LABEL: Record<number, string> = {
  0: 'Disponible',
  1: 'Ocupada',
  2: 'Sucia',
  3: 'Mantenimiento',
  4: 'Reservada',
  5: 'Fuera de servicio',
};

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

  /*
   * `detail=1` agrega las fechas de cada estadía. Son dato interno: saber
   * cuándo entra y sale un huésped permite saber cuándo la habitación queda
   * sola, así que solo las recibe el personal del CMS. Un visitante o un
   * cliente registrado obtiene igual la lista de unidades ocupadas, sin
   * fechas, que es todo lo que necesita la galería pública.
   */
  const detail = params.get('detail') === '1';
  let canSeeRanges = false;
  if (detail) {
    const session = await readSession(env, request);
    canSeeRanges = session?.role === 'admin' || session?.role === 'moderator';
  }

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
  /*
   * «Próxima a liberarse»: la unidad está tomada ahora pero se conoce la fecha
   * de salida. Viaja como etiqueta —sin fechas— para que también un visitante
   * la vea: el rango exacto delata cuándo entra y sale un huésped.
   */
  const freeSoon = new Set<string>();
  for (const row of rows) if (row.room_type) freeSoon.add(row.room_type);

  /*
   * «Reservable desde»: para cada unidad tomada, el día en que vuelve a estar
   * libre. Es lo único que hace falta para venderla hacia adelante —igual que
   * en el PMS— sin publicar el rango completo de la estadía. Mantenimiento y
   * fuera de servicio no entran: no tienen liberación prevista.
   */
  const freeFromMap = new Map<string, string>();
  const rememberFree = (label: string | null, day: string | null) => {
    if (!label || !day) return;
    const current = freeFromMap.get(label);
    if (!current || day < current) freeFromMap.set(label, day);
  };
  for (const row of rows) rememberFree(row.room_type, row.check_out);

  if (pmsOccupied?.length) {
    const labels = await loadPmsRoomLabels(env, hotelId);
    const pmsRanges = pmsRangesForWindow(pmsOccupied, labels, checkIn, checkOut);
    for (const room of pmsOccupied) {
      const reason = String(room.reason);
      // Mantenimiento y fuera de servicio no tienen liberación prevista.
      if (reason !== 'stay' && reason !== 'reservation') continue;
      if (!room.check_out) continue;
      if (!(room.check_out > checkIn && (room.check_in ?? checkIn) < checkOut)) continue;
      const label = labels.byPmsId.get(Number(room.pms_room_id));
      if (label) freeSoon.add(label);
      if (label) rememberFree(label, room.check_out);
    }
    const seen = new Set(ranges.map((range) => `${range.room_type}|${range.check_in}|${range.check_out}`));
    for (const range of pmsRanges) {
      const key = `${range.room_type}|${range.check_in}|${range.check_out}`;
      if (seen.has(key)) continue;
      seen.add(key);
      ranges.push(range);
    }
  }

  const rooms = Array.from(new Set(ranges.map((range) => range.room_type).filter(Boolean)));

  const soon = Array.from(freeSoon);
  const freeFrom = Array.from(freeFromMap, ([room_type, free_from]) => ({ room_type, free_from }));

  /*
   * Estado operativo real de cada unidad, solo para el personal del CMS: la
   * galería del panel muestra Sucia, Mantenimiento, Reservada…, no un único
   * «Ocupada». Para un visitante esto no viaja nunca.
   */
  const states: Array<{ room_type: string; status: number | null; status_label: string | null }> = [];
  if (canSeeRanges) {
    const catalog = await fetchPmsCatalog(env).catch(() => null);
    if (catalog?.catalog) {
      const labels = await loadPmsRoomLabels(env, hotelId);
      for (const room of catalog.catalog.rooms) {
        const label = labels.byPmsId.get(Number(room.pms_id));
        if (!label) continue;
        const status = room.current_status === null ? null : Number(room.current_status);
        states.push({
          room_type: label,
          status,
          status_label: status === null ? null : PMS_STATUS_LABEL[status] ?? null,
        });
      }
    }
  }

  if (!canSeeRanges) return json({ data: { rooms, free_soon: soon, free_from: freeFrom }, error: null });

  return json({
    data: { rooms, ranges: ranges.slice(0, 500), free_soon: soon, free_from: freeFrom, states },
    error: null,
  });
}

export const onRequestGet = ({ request, env }: { request: Request; env: Env }) =>
  handlePublicAvailability(request, env);
