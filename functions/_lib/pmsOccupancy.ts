import type { Env } from './env';
import { serviceRequest } from './supabase';

/**
 * Habitaciones ocupadas que publica RelaxPMS.
 *
 * La web las consulta al abrir una página que muestra disponibilidad (galería
 * o formulario de reserva). No hay polling ni botón de sincronizar: cada
 * consulta de disponibilidad pregunta al PMS en ese momento, y si el PMS no
 * responde la web sigue funcionando con las reservas de Supabase.
 *
 * La clave de la integración vive solo en el servidor. El navegador nunca
 * habla con RelaxPMS.
 */

export interface PmsOccupiedRoom {
  pms_room_id: number;
  room_type: string | null;
  room_name: string | null;
  check_in: string;
  check_out: string | null;
  reason: 'stay' | 'status';
}

export interface OccupiedRange {
  room_type: string;
  check_in: string;
  check_out: string;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIMEOUT_MS = 4000;

const clean = (value: unknown) => String(value ?? '').trim();

function isDate(value: unknown): value is string {
  return typeof value === 'string' && DATE.test(value);
}

function plusOneDay(date: string): string {
  const time = Date.parse(`${date}T00:00:00Z`);
  if (Number.isNaN(time)) return date;
  return new Date(time + 86_400_000).toISOString().slice(0, 10);
}

/** Mismo criterio visible que usa la galería y el formulario. */
function unitNumber(name: string): string {
  return name
    .replace(/^dep\.?\s*/i, '')
    .replace(/^n[.º°]?\s*/i, '')
    .replace(/^\./, '')
    .trim();
}

/**
 * Pide las ocupadas al PMS. Devuelve `null` si la integración no está
 * configurada o si el PMS no respondió: en los dos casos la disponibilidad
 * sigue con lo que hay en Supabase.
 */
export async function fetchPmsOccupiedRooms(env: Env): Promise<PmsOccupiedRoom[] | null> {
  const base = clean(env.RELAXPMS_API_URL).replace(/\/+$/, '');
  const key = clean(env.RELAXPMS_API_KEY) || clean(env.INTEGRATIONS_API_KEY);
  if (!base || !key) return null;

  try {
    const response = await fetch(`${base}/api/integrations/v1/occupied-rooms`, {
      headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) return null;

    const body = (await response.json().catch(() => null)) as
      | { data?: { rooms?: PmsOccupiedRoom[] | null } | null }
      | null;
    const rows = body?.data?.rooms;
    if (!Array.isArray(rows)) return null;

    return rows.filter(
      (room) =>
        Number.isFinite(Number(room?.pms_room_id)) &&
        Number(room.pms_room_id) > 0 &&
        isDate(room.check_in) &&
        (room.check_out === null || isDate(room.check_out))
    );
  } catch {
    return null;
  }
}

interface RoomLabelMaps {
  /** pms_id de la unidad → "Tipo · Habitación 13". */
  byPmsId: Map<number, string>;
  /** "Tipo · Habitación 13" → pms_id de la unidad. */
  byLabel: Map<string, number>;
}

/**
 * Traduce los ids del PMS al rótulo que usa la web (`tipos_habitacion` y
 * `unidades_habitacion` guardan `pms_id` justamente para esto).
 */
export async function loadPmsRoomLabels(env: Env, hotelId: string): Promise<RoomLabelMaps> {
  const byPmsId = new Map<number, string>();
  const byLabel = new Map<string, number>();

  const [types, units] = await Promise.all([
    serviceRequest<Array<{ id: string; name: string; grupo: string | null }>>(
      env,
      `tipos_habitacion?hotel_id=eq.${encodeURIComponent(hotelId)}&select=id,name,grupo`
    ),
    serviceRequest<Array<{ id: string; tipo_id: string; name: string; pms_id: number | null }>>(
      env,
      `unidades_habitacion?hotel_id=eq.${encodeURIComponent(hotelId)}&select=id,tipo_id,name,pms_id`
    ),
  ]);

  const typeById = new Map((types.data ?? []).map((type) => [type.id, type]));
  for (const unit of units.data ?? []) {
    const type = typeById.get(unit.tipo_id);
    const pmsId = Number(unit.pms_id);
    if (!type || !Number.isFinite(pmsId) || pmsId <= 0) continue;
    const prefix = type.grupo === 'departamento' ? 'Departamento' : 'Habitación';
    const label = `${type.name} · ${prefix} ${unitNumber(unit.name)}`.trim();
    byPmsId.set(pmsId, label);
    byLabel.set(label, pmsId);
  }

  return { byPmsId, byLabel };
}

/**
 * Convierte las ocupadas del PMS en rangos para la ventana consultada.
 *
 * Una ocupación sin fecha de salida (`status` sin estadía) bloquea solo el día
 * de hoy: mañana la habitación vuelve a ofrecerse, salvo que el PMS diga otra
 * cosa. Una estadía usa su salida estimada.
 */
export function pmsRangesForWindow(
  rooms: PmsOccupiedRoom[],
  labels: RoomLabelMaps,
  checkIn: string,
  checkOut: string
): OccupiedRange[] {
  const out: OccupiedRange[] = [];
  for (const room of rooms) {
    const label = labels.byPmsId.get(Number(room.pms_room_id));
    if (!label) continue;

    const from = isDate(room.check_in) ? room.check_in : checkIn;
    const until = isDate(room.check_out) ? room.check_out : plusOneDay(from);

    // Sin solapamiento con la ventana pedida: no bloquea esas fechas.
    if (!(until > checkIn && from < checkOut)) continue;
    out.push({ room_type: label, check_in: from, check_out: until });
  }
  return out;
}

/**
 * ¿Esta unidad está ocupada en el PMS para esas fechas?
 *
 * Se usa al guardar la solicitud: el formulario ya la deshabilita, pero dos
 * personas pueden enviar a la vez. Si no se puede mapear el rótulo o el PMS no
 * responde, no se bloquea (la reserva sigue su curso normal).
 */
export async function isPmsRoomOccupied(
  env: Env,
  hotelId: string,
  roomLabel: string,
  checkIn: string,
  checkOut: string
): Promise<boolean> {
  const occupied = await fetchPmsOccupiedRooms(env);
  if (!occupied?.length) return false;

  const labels = await loadPmsRoomLabels(env, hotelId);
  const pmsId = labels.byLabel.get(roomLabel);
  if (!pmsId) return false;

  const matches = occupied.filter((room) => Number(room.pms_room_id) === pmsId);
  return pmsRangesForWindow(matches, labels, checkIn, checkOut).length > 0;
}
