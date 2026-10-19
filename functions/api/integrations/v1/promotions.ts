import { json, type Env } from '../../../_lib/env';
import { serviceRequest } from '../../../_lib/supabase';

/**
 * Promociones publicadas para sistemas externos (RelaxPMS).
 *
 * `GET /api/integrations/v1/promotions`
 *
 * Misma autenticación servidor-a-servidor que
 * `/api/integrations/v1/reservations`. Devuelve solo promociones activas y no
 * vencidas, con los datos justos para que recepción reciba un aviso: título,
 * código, descuento, vigencia y el enlace a la página pública.
 *
 * `updated_since` es lo que usa el PMS para traer lo publicado o editado desde
 * la última sincronización; `created_since` sirve para un primer llenado.
 */

const DATE_OR_TIME = /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:\d{2})?)?$/;
const MAX_LIMIT = 200;

interface PromotionRow {
  id: string;
  title: string;
  code: string | null;
  description: string | null;
  type: string;
  discount_percent: number | null;
  discount_amount: number | null;
  start_date: string;
  end_date: string;
  image_url: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

function secureEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Página pública de promociones, si el despliegue tiene `APP_URL`. */
function promotionsPageUrl(env: Env): string | null {
  const base = (env.APP_URL || '').trim().replace(/\/+$/, '');
  return base ? `${base}/promociones` : null;
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

  const today = new Date().toISOString().slice(0, 10);
  const filters = [
    `hotel_id=eq.${encodeURIComponent(hotelId)}`,
    'active=eq.true',
    `end_date=gte.${today}`,
  ];
  if (createdSince) filters.push(`created_at=gte.${encodeURIComponent(createdSince)}`);
  if (updatedSince) filters.push(`updated_at=gt.${encodeURIComponent(updatedSince)}`);

  const path =
    'promociones?' +
    [
      ...filters,
      'select=id,title,code,description,type,discount_percent,discount_amount,start_date,end_date,image_url,active,created_at,updated_at',
      'order=updated_at.asc,id.asc',
      `limit=${limit + 1}`,
      `offset=${offset}`,
    ].join('&');

  const result = await serviceRequest<PromotionRow[]>(env, path);
  if (result.status === 503) {
    return json({ error: 'Servicio no disponible. Probá más tarde.' }, 503);
  }
  if (result.error) return json({ error: 'No se pudieron leer las promociones' }, 500);

  const rows = result.data ?? [];
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const pageUrl = promotionsPageUrl(env);

  const data = page.map((row) => ({
    id: row.id,
    title: row.title,
    code: row.code,
    description: row.description,
    type: row.type,
    discount_percent: row.discount_percent,
    discount_amount: row.discount_amount,
    start_date: row.start_date,
    end_date: row.end_date,
    image_url: row.image_url,
    active: row.active,
    created_at: row.created_at,
    updated_at: row.updated_at,
    url: pageUrl,
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

export async function handleIntegrationPromotions(
  request: Request,
  env: Env
): Promise<Response> {
  if (request.method !== 'GET') return json({ error: 'Método no permitido' }, 405);
  return handleGet(request, env);
}

export const onRequestGet = ({ request, env }: { request: Request; env: Env }) =>
  handleIntegrationPromotions(request, env);
