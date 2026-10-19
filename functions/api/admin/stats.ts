import { json, readSession, type Env } from '../../_lib/env';
import { serviceRequest } from '../../_lib/supabase';

interface Row {
  id: string;
  created_at?: string | null;
  [key: string]: unknown;
}

async function rows(env: Env, path: string): Promise<Row[]> {
  const result = await serviceRequest<Row[]>(env, path);
  return result.data ?? [];
}

/**
 * Datos reales del panel: se leen con la service role porque varias tablas
 * (reservas, comentarios pendientes) no son visibles con la clave anónima
 * desde el navegador.
 */
export async function handleDashboardStats(request: Request, env: Env): Promise<Response> {
  const session = await readSession(env, request);
  if (!session) return json({ error: 'Sesión no válida o expirada' }, 401);
  if (session.role !== 'admin' && session.role !== 'moderator') {
    return json({ error: 'La cuenta no tiene permisos de administración' }, 403);
  }
  if (request.method !== 'GET') return json({ error: 'Método no permitido' }, 405);

  const hotelId = new URL(request.url).searchParams.get('hotel_id') || '';
  if (!hotelId) return json({ error: 'Falta hotel_id' }, 400);

  const hotel = `hotel_id=eq.${encodeURIComponent(hotelId)}`;

  const [units, roomTypes, reservations, comments, attractions, gallery, inquiries] = await Promise.all([
    rows(env, `unidades_habitacion?select=id,tipo_id&${hotel}`),
    rows(env, `tipos_habitacion?select=id,grupo&${hotel}`),
    rows(env, `reservas?select=id,guest_name,created_at&${hotel}&order=created_at.desc&limit=50`),
    rows(env, `comentarios?select=id,name,content,status,created_at&${hotel}&order=created_at.desc&limit=50`),
    rows(env, `atractivos_turisticos?select=id,active&${hotel}`),
    rows(env, `galeria?select=id&${hotel}`),
    rows(env, `consultas?select=id,name,created_at&${hotel}&order=created_at.desc&limit=10`),
  ]);

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const reservationsMonth = reservations.filter((item) => {
    const date = item.created_at ? new Date(item.created_at) : null;
    return date ? date >= monthStart : false;
  }).length;

  const pendingComments = comments.filter((item) => item.status === 'pending').length;
  const approvedComments = comments.filter((item) => item.status === 'approved').length;

  // El inventario real vive en unidades_habitacion (cada habitación/departamento
  // físico), agrupado por el tipo al que pertenece. Es lo mismo que publica la
  // vista pública de Galería, así el panel no muestra números distintos.
  const groupByTypeId = new Map(roomTypes.map((type) => [type.id, String(type.grupo || '')]));
  let rooms = 0;
  let departments = 0;
  for (const unit of units) {
    const group = groupByTypeId.get(String(unit.tipo_id || ''));
    if (group === 'departamento') departments += 1;
    else rooms += 1;
  }
  const activeTypes = new Set(units.map((unit) => String(unit.tipo_id || ''))).size;

  const activity = [
    ...reservations.slice(0, 5).map((item) => ({
      type: 'reservation',
      text: `Reserva de ${String(item.guest_name || 'huésped')}`,
      date: item.created_at || null,
    })),
    ...comments.slice(0, 5).map((item) => ({
      type: 'comment',
      text: `Comentario de ${String(item.name || 'huésped')}`,
      date: item.created_at || null,
    })),
    ...inquiries.slice(0, 5).map((item) => ({
      type: 'inquiry',
      text: `Consulta de ${String(item.name || 'visitante')}`,
      date: item.created_at || null,
    })),
  ]
    .filter((item) => item.date)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
    .slice(0, 5);

  return json({
    data: {
      rooms,
      departments,
      units: units.length,
      roomTypes: activeTypes,
      reservations: reservations.length,
      reservationsMonth,
      pendingComments,
      approvedComments,
      attractions: attractions.length,
      activeAttractions: attractions.filter((item) => item.active === true).length,
      gallery: gallery.length,
      activity,
    },
  });
}

export const onRequestGet = ({ request, env }: { request: Request; env: Env }) =>
  handleDashboardStats(request, env);
