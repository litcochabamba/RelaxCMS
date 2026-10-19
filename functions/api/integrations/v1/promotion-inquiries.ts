import { json, type Env } from '../../../_lib/env';
import { serviceRequest } from '../../../_lib/supabase';

/**
 * Consultas hechas desde una promoción, para las notificaciones de RelaxPMS.
 *
 *   GET /api/integrations/v1/promotion-inquiries?created_since=...
 *
 * Misma autenticación servidor-a-servidor que `/promotions` y `/reservations`.
 * Las filas se guardan en `consultas` con la marca `admin_notes =
 * 'promotion-inquiry'`; el nombre y el celular son los que pide el modal antes
 * de abrir WhatsApp.
 */

const DATE_OR_TIME = /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:\d{2})?)?$/;
const MAX_LIMIT = 200;
const MARKER = 'promotion-inquiry';
const DEFAULT_WINDOW_DAYS = 30;

interface InquiryRow {
  id: string;
  name: string;
  phone: string | null;
  message: string;
  created_at: string;
}

function secureEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
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
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, Number.parseInt(params.get('limit') || '100', 10) || 100)
  );
  const offset = Math.max(0, Number.parseInt(params.get('offset') || '0', 10) || 0);

  if (createdSince && !DATE_OR_TIME.test(createdSince)) {
    return json({ error: 'created_since debe ser una fecha ISO' }, 400);
  }

  const since =
    createdSince || new Date(Date.now() - DEFAULT_WINDOW_DAYS * 86_400_000).toISOString();

  const path =
    'consultas?' +
    [
      `hotel_id=eq.${encodeURIComponent(hotelId)}`,
      `admin_notes=eq.${encodeURIComponent(MARKER)}`,
      `created_at=gte.${encodeURIComponent(since)}`,
      'select=id,name,phone,message,created_at',
      'order=created_at.asc,id.asc',
      `limit=${limit + 1}`,
      `offset=${offset}`,
    ].join('&');

  const result = await serviceRequest<InquiryRow[]>(env, path);
  if (result.status === 503) {
    return json({ error: 'Servicio no disponible. Probá más tarde.' }, 503);
  }
  if (result.error) return json({ error: 'No se pudieron leer las consultas' }, 500);

  const rows = result.data ?? [];
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;

  const data = page.map((row) => ({
    id: row.id,
    name: row.name,
    phone: row.phone || '',
    // En `message` guardamos el título de la promoción consultada (o una
    // etiqueta general si la consulta fue por todas las ofertas).
    promotion: row.message,
    created_at: row.created_at,
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

export async function handleIntegrationPromotionInquiries(
  request: Request,
  env: Env
): Promise<Response> {
  if (request.method !== 'GET') return json({ error: 'Método no permitido' }, 405);
  return handleGet(request, env);
}

export const onRequestGet = ({ request, env }: { request: Request; env: Env }) =>
  handleIntegrationPromotionInquiries(request, env);
