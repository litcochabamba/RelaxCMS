import { json, readSession, type Env } from '../../_lib/env';
import { serviceRequest } from '../../_lib/supabase';

// Solo las tablas que edita el panel CMS.
const ALLOWED_TABLES = new Set([
  'hoteles',
  'configuracion_hotel',
  'hero_slides',
  'habitaciones',
  'habitacion_imagenes',
  'categorias_habitacion',
  'tipos_habitacion',
  'unidades_habitacion',
  'amenidades',
  'booking_room_types',
  'atractivos_turisticos',
  'atractivo_imagenes',
  'galeria',
  'comentarios',
  'promociones',
  'seo_config',
]);

type Action = 'insert' | 'update' | 'delete' | 'select';

function buildFilters(filters?: Record<string, unknown>): string {
  if (!filters) return '';
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value === null || value === undefined) continue;
    params.append(key, `eq.${String(value)}`);
  }
  return params.toString();
}

/**
 * Lectura desde el panel. Va por el servidor con la service role key porque
 * las políticas RLS de Supabase ocultan las filas con `active = false` a
 * cualquier token de navegador —incluido el del personal—. Sin esto, al
 * ocultar un tipo de habitación desaparece del CMS y no se puede volver a
 * mostrar. La sesión y el rol se validan igual que en las escrituras.
 */
async function selectRows(env: Env, body: Record<string, unknown>): Promise<Response> {
  const params = new URLSearchParams(buildFilters(body.filters as Record<string, unknown> | undefined));

  const order = body.order as { column?: unknown; ascending?: unknown } | undefined;
  const column = String(order?.column ?? '');
  if (column) {
    if (!/^[a-z0-9_]+$/i.test(column)) return json({ error: 'Orden no válido' }, 400);
    params.set('order', `${column}.${order?.ascending === false ? 'desc' : 'asc'}`);
  }

  const limit = Number(body.limit);
  if (Number.isFinite(limit) && limit > 0) params.set('limit', String(Math.min(limit, 2000)));

  const query = params.toString();
  const result = await serviceRequest<Record<string, unknown>[]>(env, query ? `${body.table}?${query}` : String(body.table));
  if (result.error) return json({ data: null, error: result.error }, 400);
  return json({ data: result.data ?? [], error: null });
}

export async function handleDb(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'Método no permitido' }, 405);

  const session = await readSession(env, request);
  if (!session) return json({ error: 'Sesión no válida o expirada' }, 401);
  if (session.role !== 'admin' && session.role !== 'moderator') {
    return json({ error: 'La cuenta no tiene permisos de administración' }, 403);
  }

  const body = (await request.json().catch(() => null)) as
    | {
        table?: string;
        action?: Action;
        data?: unknown;
        filters?: Record<string, unknown>;
        order?: { column?: string; ascending?: boolean };
        limit?: number;
      }
    | null;

  const table = body?.table;
  const action = body?.action;

  if (!table || !ALLOWED_TABLES.has(table)) return json({ error: 'Tabla no permitida' }, 400);
  if (action !== 'insert' && action !== 'update' && action !== 'delete' && action !== 'select') {
    return json({ error: 'Acción no permitida' }, 400);
  }

  if (action === 'select') return selectRows(env, { ...body, table });

  const query = buildFilters(body?.filters);
  if (action !== 'insert' && !query) return json({ error: 'La operación necesita filtros' }, 400);

  const path = query ? `${table}?${query}` : table;

  if (action === 'insert') {
    const result = await serviceRequest<Record<string, unknown>[]>(env, path, {
      method: 'POST',
      body: JSON.stringify(body?.data ?? {}),
      prefer: 'return=representation',
    });
    if (result.error) return json({ data: null, error: result.error }, 400);
    return json({ data: result.data?.[0] ?? null, error: null });
  }

  if (action === 'update') {
    const result = await serviceRequest<Record<string, unknown>[]>(env, path, {
      method: 'PATCH',
      body: JSON.stringify(body?.data ?? {}),
      prefer: 'return=representation',
    });
    if (result.error) return json({ data: null, error: result.error }, 400);
    return json({ data: result.data ?? null, error: null });
  }

  const result = await serviceRequest<Record<string, unknown>[]>(env, path, {
    method: 'DELETE',
    prefer: 'return=representation',
  });
  if (result.error) return json({ data: null, error: result.error }, 400);
  return json({ data: null, error: null });
}

export const onRequestPost = ({ request, env }: { request: Request; env: Env }) =>
  handleDb(request, env);
