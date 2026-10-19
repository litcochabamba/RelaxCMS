import { json, readSession, type Env } from '../../_lib/env';
import { serviceRequest } from '../../_lib/supabase';
import {
  buildCatalogPlan,
  fetchPmsCatalog,
  uniqueSlug,
  unitName,
  type CmsTypeRow,
  type CmsUnitRow,
} from '../../_lib/pmsCatalog';

/**
 * Importación del catálogo de RelaxPMS al CMS (solo personal del hotel).
 *
 *   GET  /api/admin/pms-import?hotel_id=…   → vista previa, no escribe nada
 *   POST /api/admin/pms-import               → aplica
 *
 * El PMS es la fuente de verdad de la estructura; el CMS conserva su contenido
 * editorial. La vista previa y la aplicación calculan el mismo plan con los
 * mismos datos, así que el botón nunca aplica algo distinto de lo mostrado.
 *
 * `GET` es de solo lectura: se puede abrir las veces que haga falta. `POST` es
 * idempotente por `pms_id`: correrlo dos veces no duplica tipos ni unidades.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface AdminContext {
  hotelId: string;
}

/** Sesión válida, rol del panel y pertenencia al hotel pedido. */
async function readAdmin(env: Env, request: Request, hotelId: string): Promise<Response | AdminContext> {
  if (!UUID.test(hotelId)) return json({ error: 'Hotel no válido' }, 400);

  const session = await readSession(env, request);
  if (!session) return json({ error: 'Sesión no válida o expirada' }, 401);
  if (session.role !== 'admin' && session.role !== 'moderator') {
    return json({ error: 'La cuenta no tiene permisos de administración' }, 403);
  }

  const user = await serviceRequest<Array<{ hotel_id: string | null }>>(
    env,
    `usuarios?id=eq.${encodeURIComponent(session.sub)}&select=hotel_id&limit=1`
  );
  if (user.status === 503) return json({ error: 'Servicio no disponible. Probá más tarde.' }, 503);
  if (user.error || !user.data?.length) return json({ error: 'La cuenta no existe' }, 403);
  if ((user.data[0].hotel_id || '') !== hotelId) {
    return json({ error: 'La cuenta no pertenece a ese hotel' }, 403);
  }

  return { hotelId };
}

type CmsCatalogResult =
  | { ok: true; types: CmsTypeRow[]; units: CmsUnitRow[] }
  | { ok: false; error: string; status: 400 | 500 | 503 };

async function loadCmsCatalog(env: Env, hotelId: string): Promise<CmsCatalogResult> {
  const [types, units] = await Promise.all([
    serviceRequest<CmsTypeRow[]>(
      env,
      `tipos_habitacion?hotel_id=eq.${encodeURIComponent(hotelId)}&select=id,pms_id,name,slug,grupo,order`
    ),
    serviceRequest<CmsUnitRow[]>(
      env,
      `unidades_habitacion?hotel_id=eq.${encodeURIComponent(hotelId)}&select=id,tipo_id,pms_id,name,floor,capacity,order,active`
    ),
  ]);

  if (types.status === 503 || units.status === 503) {
    return { ok: false, error: 'Servicio no disponible. Probá más tarde.', status: 503 };
  }
  if (types.error || units.error) {
    return { ok: false, error: 'No se pudo leer el catálogo del CMS', status: 500 };
  }
  return {
    ok: true,
    types: (types.data ?? []) as CmsTypeRow[],
    units: (units.data ?? []) as CmsUnitRow[],
  };
}

async function preview(env: Env, hotelId: string): Promise<Response> {
  const pms = await fetchPmsCatalog(env);
  if (!pms.catalog) {
    return json(
      {
        error:
          pms.error ||
          'No se pudo leer el catálogo de RelaxPMS. Revisá que el PMS esté en línea y que RELAXPMS_API_URL esté configurada.',
      },
      pms.status
    );
  }
  const catalog = pms.catalog;

  const cms = await loadCmsCatalog(env, hotelId);
  if (!cms.ok) return json({ error: cms.error }, cms.status);

  const plan = buildCatalogPlan(catalog, cms.types, cms.units);
  return json({ data: plan, error: null });
}

async function apply(env: Env, hotelId: string, overwriteNames: boolean): Promise<Response> {
  const pms = await fetchPmsCatalog(env);
  if (!pms.catalog) {
    return json(
      {
        error:
          pms.error ||
          'No se pudo leer el catálogo de RelaxPMS. Revisá que el PMS esté en línea y que RELAXPMS_API_URL esté configurada.',
      },
      pms.status
    );
  }
  const catalog = pms.catalog;

  const cms = await loadCmsCatalog(env, hotelId);
  if (!cms.ok) return json({ error: cms.error }, cms.status);

  const plan = buildCatalogPlan(catalog, cms.types, cms.units);
  const result = {
    created_types: 0,
    updated_types: 0,
    created_units: 0,
    updated_units: 0,
    disabled_units: 0,
    skipped: plan.units.skipped,
    errors: [] as string[],
  };

  const takenSlugs = new Set(cms.types.map((type) => type.slug));
  const typeIdByPms = new Map<number, string>();
  for (const type of cms.types) {
    if (type.pms_id !== null) typeIdByPms.set(Number(type.pms_id), type.id);
  }

  let nextTypeOrder = Math.max(0, ...cms.types.map((type) => Number(type.order) || 0)) + 1;
  const roomsByType = new Map<number, typeof catalog.rooms>();
  for (const room of catalog.rooms) {
    const list = roomsByType.get(Number(room.pms_room_type_id)) || [];
    list.push(room);
    roomsByType.set(Number(room.pms_room_type_id), list);
  }

  for (const type of plan.types.create) {
    const rooms = roomsByType.get(type.pms_id) ?? [];
    const capacities = rooms
      .map((room) => Number(room.capacity))
      .filter((value) => Number.isFinite(value) && value > 0);
    const payload = {
      hotel_id: hotelId,
      pms_id: type.pms_id,
      name: type.name,
      slug: uniqueSlug(type.name, type.pms_id, takenSlugs),
      grupo: type.grupo,
      description: null,
      image_url: null,
      min_capacity: capacities.length ? Math.min(...capacities) : null,
      max_capacity: capacities.length ? Math.max(...capacities) : null,
      price: null,
      order: nextTypeOrder++,
      active: true,
    };

    const inserted = await serviceRequest<Array<{ id: string }>>(env, 'tipos_habitacion', {
      method: 'POST',
      prefer: 'return=representation',
      body: JSON.stringify(payload),
    });

    if (inserted.error || !inserted.data?.[0]?.id) {
      result.errors.push(`No se pudo crear el tipo «${type.name}»: ${inserted.error || 'sin respuesta'}`);
      continue;
    }
    typeIdByPms.set(type.pms_id, inserted.data[0].id);
    result.created_types += 1;
  }

  if (overwriteNames) {
    for (const rename of plan.types.rename) {
      const updated = await serviceRequest<unknown>(env, `tipos_habitacion?id=eq.${encodeURIComponent(rename.id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: rename.to }),
      });
      if (updated.error) {
        result.errors.push(`No se pudo renombrar «${rename.from}»: ${updated.error}`);
        continue;
      }
      result.updated_types += 1;
    }
  }

  const unitByPms = new Map<number, CmsUnitRow>();
  for (const unit of cms.units) {
    if (unit.pms_id !== null) unitByPms.set(Number(unit.pms_id), unit);
  }

  let nextUnitOrder = Math.max(0, ...cms.units.map((unit) => Number(unit.order) || 0)) + 1;

  for (const room of catalog.rooms) {
    const typeId = typeIdByPms.get(Number(room.pms_room_type_id));
    // Los tipos que no se pudieron crear ya quedaron en `plan.units.skipped`.
    if (!typeId) continue;

    const name = unitName(room.name);

    const capacity = Number.isFinite(Number(room.capacity)) ? Number(room.capacity) : null;
    const floor = String(room.floor ?? '').trim() || null;

    const existing = unitByPms.get(Number(room.pms_id));
    if (existing) {
      const changes: Record<string, unknown> = {};
      if (existing.name !== name) changes.name = name;
      if ((existing.capacity ?? null) !== capacity) changes.capacity = capacity;
      if ((existing.floor ?? null) !== floor) changes.floor = floor;
      if (existing.tipo_id !== typeId) changes.tipo_id = typeId;
      // Mantenimiento y fuera de servicio se ocultan en el CMS. Si la unidad
      // vuelve a estar disponible no se publica sola: la decisión es del hotel.
      if (room.usable === false && existing.active !== false) changes.active = false;
      if (Object.keys(changes).length === 0) continue;

      const updated = await serviceRequest<unknown>(env, `unidades_habitacion?id=eq.${encodeURIComponent(existing.id)}`, {
        method: 'PATCH',
        body: JSON.stringify(changes),
      });
      if (updated.error) {
        result.errors.push(`No se pudo actualizar la unidad ${room.name}: ${updated.error}`);
        continue;
      }
      result.updated_units += 1;
      if (changes.active === false) result.disabled_units += 1;
      continue;
    }

    const inserted = await serviceRequest<Array<{ id: string }>>(env, 'unidades_habitacion', {
      method: 'POST',
      prefer: 'return=representation',
      body: JSON.stringify({
        hotel_id: hotelId,
        tipo_id: typeId,
        pms_id: Number(room.pms_id),
        name,
        floor,
        capacity,
        amenities: [],
        order: nextUnitOrder++,
        active: room.usable !== false,
      }),
    });
    if (inserted.error) {
      result.errors.push(`No se pudo crear la unidad ${room.name}: ${inserted.error}`);
      continue;
    }
    result.created_units += 1;
    if (room.usable === false) result.disabled_units += 1;
  }

  return json({ data: result, error: null });
}

async function handle(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);

  if (request.method === 'GET') {
    const admin = await readAdmin(env, request, (url.searchParams.get('hotel_id') || '').trim());
    if (admin instanceof Response) return admin;
    return preview(env, admin.hotelId);
  }

  if (request.method === 'POST') {
    const body = (await request.json().catch(() => null)) as
      | { hotel_id?: string; overwrite_names?: boolean }
      | null;
    const admin = await readAdmin(env, request, String(body?.hotel_id || '').trim());
    if (admin instanceof Response) return admin;
    return apply(env, admin.hotelId, body?.overwrite_names === true);
  }

  return json({ error: 'Método no permitido' }, 405);
}

export const onRequest = ({ request, env }: { request: Request; env: Env }) => handle(request, env);
