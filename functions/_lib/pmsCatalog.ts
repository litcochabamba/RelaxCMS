import type { Env } from './env';

/**
 * Importación del catálogo de RelaxPMS al CMS.
 *
 * El PMS es la fuente de verdad de la estructura (qué tipos y habitaciones
 * existen, capacidad y piso). El CMS es la copia pública, con contenido
 * editorial propio: fotos, descripciones, precios, amenidades y el nombre
 * "lindo" que se muestra en la galería.
 *
 * Por eso la importación NO es un espejo ciego:
 *
 *   · crea los tipos y unidades que faltan;
 *   · actualiza de las unidades existentes lo operativo (nombre normalizado,
 *     capacidad, piso y tipo al que pertenecen);
 *   · conserva precio, fotos, descripción y amenidades;
 *   · no borra nada: lo que ya no está en el PMS se informa como «solo en el
 *     CMS» para que una persona decida;
 *   · los nombres de tipos existentes solo se pisan si se pide explícitamente
 *     (`overwrite_names`), porque el PMS usa abreviaturas («MATR. VIP») y el
 *     CMS muestra nombres pensados para el huésped.
 *
 * La vista previa se calcula en el servidor con los mismos datos que después
 * se aplican, así que lo que se muestra es lo que va a pasar.
 */

export interface PmsCatalogType {
  pms_id: number;
  name: string;
}

export interface PmsCatalogRoom {
  pms_id: number;
  pms_room_type_id: number;
  room_type: string | null;
  name: string;
  capacity: number | null;
  floor: string | null;
  /** `rooms.current_status` del PMS: 3 = mantenimiento, 5 = fuera de servicio. */
  current_status: number | null;
  /** `false` cuando la habitación no se puede usar (mantenimiento o fuera de servicio). */
  usable: boolean;
}

export interface PmsCatalog {
  types: PmsCatalogType[];
  rooms: PmsCatalogRoom[];
}

export interface CmsTypeRow {
  id: string;
  pms_id: number | null;
  name: string;
  slug: string;
  grupo: 'habitacion' | 'departamento';
  order: number;
}

export interface CmsUnitRow {
  id: string;
  tipo_id: string;
  pms_id: number | null;
  name: string;
  floor: string | null;
  capacity: number | null;
  order: number;
  active: boolean;
}

export interface TypeCreatePlan {
  pms_id: number;
  name: string;
  grupo: 'habitacion' | 'departamento';
  units: number;
  /** `true` si el tipo no tiene habitaciones en el PMS: se crea vacío. */
  empty: boolean;
}

export interface TypeRenamePlan {
  id: string;
  pms_id: number;
  from: string;
  to: string;
}

export interface UnitCreatePlan {
  pms_id: number;
  name: string;
  type_pms_id: number;
  type_name: string;
  capacity: number | null;
  floor: string | null;
  /** Se crea deshabilitada si el PMS la reporta fuera de servicio. */
  active: boolean;
}

export interface UnitUpdatePlan {
  id: string;
  pms_id: number;
  from: { name: string; capacity: number | null; floor: string | null; type_pms_id: number | null };
  to: { name: string; capacity: number | null; floor: string | null; type_pms_id: number };
  changes: string[];
}

export interface UnusableUnitPlan {
  pms_id: number;
  name: string;
  type_name: string;
  status: number | null;
  reason: string;
  /** `true` si la unidad todavía no existe en el CMS. */
  is_new: boolean;
}

export interface CatalogPlan {
  /** `types_without_rooms` ayuda a explicar por qué la galería muestra menos tipos. */
  pms: { types: number; rooms: number; types_with_rooms: number; types_without_rooms: number };
  types: {
    create: TypeCreatePlan[];
    rename: TypeRenamePlan[];
    unchanged: number;
  };
  units: {
    create: UnitCreatePlan[];
    update: UnitUpdatePlan[];
    unchanged: number;
    skipped: Array<{ pms_id: number; name: string; reason: string }>;
    /** Unidades que se van a ocultar por mantenimiento o fuera de servicio. */
    unusable: UnusableUnitPlan[];
  };
  missing: {
    types: Array<{ pms_id: number; name: string }>;
    units: Array<{ pms_id: number; name: string }>;
  };
}

const clean = (value: unknown) => String(value ?? '').trim();
const TIMEOUT_MS = 6000;

/** Estados del PMS que dejan la habitación fuera de servicio. */
export const UNUSABLE_ROOM_STATUS = new Set([3, 5]);

export function unusableReason(status: number | null): string {
  if (status === 3) return 'En mantenimiento en RelaxPMS';
  if (status === 5) return 'Fuera de servicio en RelaxPMS';
  return 'Deshabilitada en RelaxPMS';
}

function pmsConfig(env: Env) {
  return {
    base: clean(env.RELAXPMS_API_URL).replace(/\/+$/, ''),
    key: clean(env.RELAXPMS_API_KEY) || clean(env.INTEGRATIONS_API_KEY),
  };
}

/** `MATR. (pasillo)` → `matr-pasillo`. */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 60) || 'tipo';
}

/** El PMS guarda «.13» o «DEP. 02»; el CMS muestra «13» o «02». */
export function unitName(name: string): string {
  const stripped = clean(name)
    .replace(/^dep\.?\s*/i, '')
    .replace(/^n[.º°]?\s*/i, '')
    .replace(/^\./, '')
    .trim();
  return stripped || clean(name);
}

/** El PMS no tiene el concepto de grupo: se deduce del nombre del tipo. */
export function inferGroup(name: string): 'habitacion' | 'departamento' {
  return /^\s*(dep\.?|departamento)\b/i.test(clean(name)) ? 'departamento' : 'habitacion';
}

export interface PmsCatalogResult {
  catalog: PmsCatalog | null;
  error: string | null;
  status: number;
}

export async function fetchPmsCatalog(env: Env): Promise<PmsCatalogResult> {
  const { base, key } = pmsConfig(env);
  if (!base || !key) {
    return {
      catalog: null,
      error:
        'Falta configurar RELAXPMS_API_URL y la clave de integración en el CMS (RELAXPMS_API_KEY o INTEGRATIONS_API_KEY).',
      status: 503,
    };
  }

  try {
    const response = await fetch(`${base}/api/integrations/v1/room-catalog`, {
      headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!response.ok) {
      const detail = (await response.json().catch(() => null)) as { error?: string } | null;
      const serverMessage = clean(detail?.error);
      let message = `RelaxPMS respondió HTTP ${response.status}`;

      if (response.status === 401 || response.status === 403) {
        message =
          `RelaxPMS rechazó la clave de integración (HTTP ${response.status}). ` +
          'Verificá que RELAXPMS_API_KEY del CMS coincida con INTEGRATIONS_API_KEY del PMS.';
      } else if (response.status === 404) {
        message =
          'RelaxPMS no tiene el endpoint /api/integrations/v1/room-catalog (HTTP 404). ' +
          'Verificá que el PMS esté actualizado y que RELAXPMS_API_URL apunte al sitio correcto.';
      } else if (serverMessage) {
        message += `: ${serverMessage}`;
      }

      console.error('[pms-import] catálogo rechazado:', response.status, serverMessage || '');
      return { catalog: null, error: message, status: 502 };
    }

    const body = (await response.json().catch(() => null)) as
      | { data?: { types?: PmsCatalogType[]; rooms?: PmsCatalogRoom[] } | null }
      | null;
    const types = body?.data?.types;
    const rooms = body?.data?.rooms;
    if (!Array.isArray(types) || !Array.isArray(rooms)) {
      return {
        catalog: null,
        error: 'RelaxPMS devolvió un catálogo con un formato inesperado.',
        status: 502,
      };
    }

    return {
      catalog: {
        types: types.filter((type) => Number.isFinite(Number(type?.pms_id)) && clean(type?.name)),
        rooms: rooms
          .filter(
            (room) =>
              Number.isFinite(Number(room?.pms_id)) &&
              Number.isFinite(Number(room?.pms_room_type_id)) &&
              clean(room?.name)
          )
          .map((room) => {
            const rawStatus = Number(room?.current_status);
            const current_status = Number.isFinite(rawStatus) ? rawStatus : null;
            const usable =
              typeof room?.usable === 'boolean'
                ? room.usable
                : current_status === null || !UNUSABLE_ROOM_STATUS.has(current_status);
            return { ...room, current_status, usable };
          }),
      },
      error: null,
      status: 200,
    };
  } catch (error) {
    console.error('[pms-import] no se pudo conectar con RelaxPMS:', error);
    return {
      catalog: null,
      error: 'No se pudo conectar con RelaxPMS. Revisá RELAXPMS_API_URL y que el PMS esté en línea.',
      status: 502,
    };
  }
}

/** Compara el catálogo del PMS con lo que ya hay en el CMS. */
export function buildCatalogPlan(
  catalog: PmsCatalog,
  cmsTypes: CmsTypeRow[],
  cmsUnits: CmsUnitRow[]
): CatalogPlan {
  const typesByPms = new Map<number, CmsTypeRow>();
  const slugs = new Set(cmsTypes.map((type) => type.slug));
  for (const type of cmsTypes) {
    if (type.pms_id !== null) typesByPms.set(Number(type.pms_id), type);
  }

  const unitsByPms = new Map<number, CmsUnitRow>();
  for (const unit of cmsUnits) {
    if (unit.pms_id !== null) unitsByPms.set(Number(unit.pms_id), unit);
  }

  const roomsByType = new Map<number, PmsCatalogRoom[]>();
  for (const room of catalog.rooms) {
    const list = roomsByType.get(Number(room.pms_room_type_id)) || [];
    list.push(room);
    roomsByType.set(Number(room.pms_room_type_id), list);
  }

  const typesWithRooms = new Set(catalog.rooms.map((room) => Number(room.pms_room_type_id)));
  const typesWithRoomsCount = catalog.types.filter((type) => typesWithRooms.has(Number(type.pms_id))).length;

  const plan: CatalogPlan = {
    pms: {
      types: catalog.types.length,
      rooms: catalog.rooms.length,
      types_with_rooms: typesWithRoomsCount,
      types_without_rooms: catalog.types.length - typesWithRoomsCount,
    },
    types: { create: [], rename: [], unchanged: 0 },
    units: { create: [], update: [], unchanged: 0, skipped: [], unusable: [] },
    missing: { types: [], units: [] },
  };

  const catalogTypeIds = new Set(catalog.types.map((type) => Number(type.pms_id)));

  /*
   * `typeIdByPms` incluye tanto los tipos existentes como los que se van a
   * crear: una unidad nueva puede apuntar a un tipo nuevo sin id todavía.
   */
  const typeIdByPms = new Map<number, string | 'nuevo'>();

  for (const type of catalog.types) {
    const pmsId = Number(type.pms_id);
    const existing = typesByPms.get(pmsId);
    if (existing) {
      typeIdByPms.set(pmsId, existing.id);
      if (clean(existing.name) !== clean(type.name)) {
        plan.types.rename.push({ id: existing.id, pms_id: pmsId, from: existing.name, to: clean(type.name) });
      } else {
        plan.types.unchanged += 1;
      }
      continue;
    }

    const rooms = roomsByType.get(pmsId) ?? [];
    plan.types.create.push({
      pms_id: pmsId,
      name: clean(type.name),
      grupo: inferGroup(type.name),
      units: rooms.length,
      empty: rooms.length === 0,
    });
    typeIdByPms.set(pmsId, 'nuevo');
  }

  for (const type of cmsTypes) {
    if (type.pms_id !== null && !catalogTypeIds.has(Number(type.pms_id))) {
      plan.missing.types.push({ pms_id: Number(type.pms_id), name: type.name });
    }
  }

  const catalogRoomIds = new Set(catalog.rooms.map((room) => Number(room.pms_id)));
  for (const room of catalog.rooms) {
    const pmsId = Number(room.pms_id);
    const typePmsId = Number(room.pms_room_type_id);
    const targetType = typeIdByPms.get(typePmsId);
    if (!targetType) {
      plan.units.skipped.push({
        pms_id: pmsId,
        name: clean(room.name),
        reason: 'El tipo de habitación no está en el catálogo del PMS',
      });
      continue;
    }

    const name = unitName(room.name);
    const capacity = Number.isFinite(Number(room.capacity)) ? Number(room.capacity) : null;
    const floor = clean(room.floor) || null;
    const typeName =
      clean(room.room_type) || clean(catalog.types.find((t) => Number(t.pms_id) === typePmsId)?.name);
    const existing = unitsByPms.get(pmsId);

    if (!existing) {
      plan.units.create.push({
        pms_id: pmsId,
        name,
        type_pms_id: typePmsId,
        type_name: typeName,
        capacity,
        floor,
        active: room.usable !== false,
      });
      if (room.usable === false) {
        plan.units.unusable.push({
          pms_id: pmsId,
          name,
          type_name: typeName,
          status: room.current_status,
          reason: unusableReason(room.current_status),
          is_new: true,
        });
      }
      continue;
    }

    const existingTypePms = cmsTypes.find((type) => type.id === existing.tipo_id)?.pms_id ?? null;
    const changes: string[] = [];
    if (existing.name !== name) changes.push('nombre');
    if ((existing.capacity ?? null) !== capacity) changes.push('capacidad');
    if ((existing.floor ?? null) !== floor) changes.push('piso');
    if (Number(existingTypePms) !== typePmsId) changes.push('tipo');
    if (room.usable === false && existing.active !== false) changes.push('deshabilitar');

    if (room.usable === false && existing.active !== false) {
      plan.units.unusable.push({
        pms_id: pmsId,
        name,
        type_name: typeName,
        status: room.current_status,
        reason: unusableReason(room.current_status),
        is_new: false,
      });
    }

    if (changes.length === 0) {
      plan.units.unchanged += 1;
    } else {
      plan.units.update.push({
        id: existing.id,
        pms_id: pmsId,
        from: {
          name: existing.name,
          capacity: existing.capacity,
          floor: existing.floor,
          type_pms_id: existingTypePms === null ? null : Number(existingTypePms),
        },
        to: { name, capacity, floor, type_pms_id: typePmsId },
        changes,
      });
    }
  }

  for (const unit of cmsUnits) {
    if (unit.pms_id !== null && !catalogRoomIds.has(Number(unit.pms_id))) {
      plan.missing.units.push({ pms_id: Number(unit.pms_id), name: unit.name });
    }
  }

  return plan;
}

/** `MATR. VIP` → `matr-vip`, sin chocar con un slug ya usado. */
export function uniqueSlug(name: string, pmsId: number, taken: Set<string>): string {
  const base = slugify(name);
  if (!taken.has(base)) {
    taken.add(base);
    return base;
  }
  const candidate = `${base}-${pmsId}`;
  taken.add(candidate);
  return candidate;
}
