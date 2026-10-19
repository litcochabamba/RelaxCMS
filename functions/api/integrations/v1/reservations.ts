import { json, type Env } from '../../../_lib/env';
import { serviceRequest } from '../../../_lib/supabase';

/**
 * Consulta de reservas para sistemas externos (RelaxPMS).
 *
 * `GET /api/integrations/v1/reservations`
 *
 * Autenticación servidor-a-servidor con `Authorization: Bearer <clave>`. La
 * clave y el hotel se configuran en el entorno (`INTEGRATIONS_API_KEY`,
 * `INTEGRATIONS_HOTEL_ID`); nunca en `configuracion_hotel`, que la lee el
 * navegador con la clave anónima.
 *
 * Devuelve solo lo necesario para que el otro sistema arme una notificación o
 * una reserva precargada: contacto del huésped, fechas, rótulo de habitación y
 * los `pms_id` para mapear contra las tablas del PMS. No expone la clave de
 * Supabase ni otras reservas del hotel.
 *
 * Paginación por `limit`/`offset`; el consumidor puede pedir otra página si
 * `meta.has_more` viene en true. `created_since` sirve para el primer llenado y
 * `updated_since` para traer cambios (cancelaciones, confirmaciones).
 */

const DATE_OR_TIME = /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:\d{2})?)?$/;
const STATUSES = new Set(['pending', 'confirmed', 'cancelled', 'completed']);
const MAX_LIMIT = 200;

interface ReservationRow {
  id: string;
  hotel_id: string;
  cliente_id: string | null;
  guest_name: string;
  guest_phone: string;
  guest_email: string | null;
  check_in: string;
  check_out: string;
  adults: number | null;
  children_count: number | null;
  room_type: string;
  message: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

interface RoomTypeRow {
  id: string;
  name: string;
  grupo: string | null;
  pms_id: number | null;
}

interface RoomUnitRow {
  id: string;
  tipo_id: string;
  name: string;
  pms_id: number | null;
}

/** Comparación en tiempo constante: no filtra cuántos caracteres coinciden. */
function secureEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Mismo criterio que el formulario público para armar "Habitación 07". */
function unitNumber(name: string): string {
  return name
    .replace(/^dep\.?\s*/i, '')
    .replace(/^n[.º°]?\s*/i, '')
    .replace(/^\./, '')
    .trim();
}

function unitLabel(type: RoomTypeRow, unit: RoomUnitRow): string {
  const prefix = type.grupo === 'departamento' ? 'Departamento' : 'Habitación';
  return `${prefix} ${unitNumber(unit.name)}`.trim();
}

function nightsBetween(checkIn: string, checkOut: string): number {
  const from = Date.parse(`${checkIn}T00:00:00Z`);
  const to = Date.parse(`${checkOut}T00:00:00Z`);
  if (Number.isNaN(from) || Number.isNaN(to) || to <= from) return 0;
  return Math.round((to - from) / 86_400_000);
}

/**
 * `reservas.room_type` guarda el rótulo visible ("Matrimonial VIP ·
 * Habitación 07"). Para que el PMS no tenga que adivinar, se traduce a los
 * `pms_id` que ya existen en `tipos_habitacion` y `unidades_habitacion`.
 */
function buildRoomResolver(types: RoomTypeRow[], units: RoomUnitRow[]) {
  const byTypeName = new Map(types.map((type) => [type.name, type]));
  const byLabel = new Map<string, RoomUnitRow>();
  for (const type of types) {
    for (const unit of units.filter((item) => item.tipo_id === type.id)) {
      byLabel.set(`${type.name} · ${unitLabel(type, unit)}`, unit);
    }
  }

  return (label: string) => {
    const separator = label.lastIndexOf(' · ');
    const typeName = separator >= 0 ? label.slice(0, separator) : label;
    const unitText = separator >= 0 ? label.slice(separator + 3) : '';
    const type = byTypeName.get(typeName) || null;
    const unit = type && unitText ? byLabel.get(label) || null : null;

    return {
      type: type?.name || typeName,
      type_pms_id: type?.pms_id ?? null,
      unit: unitText || null,
      unit_pms_id: unit?.pms_id ?? null,
    };
  };
}

async function handleGet(request: Request, env: Env): Promise<Response> {
  const expectedKey = (env.INTEGRATIONS_API_KEY || '').trim();
  const hotelId = (env.INTEGRATIONS_HOTEL_ID || '').trim();
  if (!expectedKey || !hotelId) {
    return json(
      { error: 'La integración no está configurada (INTEGRATIONS_API_KEY / INTEGRATIONS_HOTEL_ID)' },
      503
    );
  }

  const authorization = request.headers.get('Authorization') || '';
  const providedKey = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  if (!providedKey || !secureEqual(providedKey, expectedKey)) {
    return json({ error: 'Clave de integración no válida' }, 401);
  }

  const params = new URL(request.url).searchParams;
  const createdSince = (params.get('created_since') || '').trim();
  const updatedSince = (params.get('updated_since') || '').trim();
  const statusParam = (params.get('status') || '').trim();
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, Number.parseInt(params.get('limit') || '100', 10) || 100)
  );
  const offset = Math.max(0, Number.parseInt(params.get('offset') || '0', 10) || 0);

  if (createdSince && !DATE_OR_TIME.test(createdSince)) {
    return json({ error: 'created_since debe ser una fecha ISO' }, 400);
  }
  if (updatedSince && !DATE_OR_TIME.test(updatedSince)) {
    return json({ error: 'updated_since debe ser una fecha ISO' }, 400);
  }
  const statuses = statusParam
    ? statusParam
        .split(',')
        .map((status) => status.trim())
        .filter(Boolean)
    : [];
  if (statuses.some((status) => !STATUSES.has(status))) {
    return json({ error: 'status no válido' }, 400);
  }

  const filters = [`hotel_id=eq.${encodeURIComponent(hotelId)}`];
  if (createdSince) filters.push(`created_at=gte.${encodeURIComponent(createdSince)}`);
  if (updatedSince) filters.push(`updated_at=gt.${encodeURIComponent(updatedSince)}`);
  if (statuses.length) filters.push(`status=in.(${statuses.join(',')})`);

  const path =
    'reservas?' +
    [
      ...filters,
      'select=id,hotel_id,cliente_id,guest_name,guest_phone,guest_email,check_in,check_out,adults,children_count,room_type,message,status,created_at,updated_at',
      'order=updated_at.asc,id.asc',
      `limit=${limit + 1}`,
      `offset=${offset}`,
    ].join('&');

  const [reservations, types, units] = await Promise.all([
    serviceRequest<ReservationRow[]>(env, path),
    serviceRequest<RoomTypeRow[]>(
      env,
      `tipos_habitacion?hotel_id=eq.${encodeURIComponent(hotelId)}&select=id,name,grupo,pms_id`
    ),
    serviceRequest<RoomUnitRow[]>(
      env,
      `unidades_habitacion?hotel_id=eq.${encodeURIComponent(hotelId)}&select=id,tipo_id,name,pms_id`
    ),
  ]);

  if (reservations.status === 503) {
    return json({ error: 'Servicio no disponible. Probá más tarde.' }, 503);
  }
  if (reservations.error) return json({ error: 'No se pudieron leer las reservas' }, 500);

  const rows = reservations.data ?? [];
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const resolveRoom = buildRoomResolver(types.data ?? [], units.data ?? []);

  const data = page.map((row) => ({
    id: row.id,
    status: row.status,
    guest: {
      name: row.guest_name,
      phone: row.guest_phone,
      email: row.guest_email,
    },
    stay: {
      check_in: row.check_in,
      check_out: row.check_out,
      nights: nightsBetween(row.check_in, row.check_out),
    },
    room: resolveRoom(row.room_type),
    adults: row.adults ?? 1,
    children: row.children_count ?? 0,
    message: row.message,
    source: row.cliente_id ? 'client' : 'guest',
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));

  return json({
    data,
    meta: {
      count: data.length,
      has_more: hasMore,
      next_offset: hasMore ? offset + limit : null,
      server_time: new Date().toISOString(),
    },
    error: null,
  });
}

export async function handleIntegrationReservations(
  request: Request,
  env: Env
): Promise<Response> {
  if (request.method !== 'GET') return json({ error: 'Método no permitido' }, 405);
  return handleGet(request, env);
}

export const onRequestGet = ({ request, env }: { request: Request; env: Env }) =>
  handleIntegrationReservations(request, env);
