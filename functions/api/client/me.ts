import { json, readSession, type Env } from '../../_lib/env';
import { serviceRequest } from '../../_lib/supabase';
import {
  COUNTRY_CODES_KEY,
  DEFAULT_COUNTRY_CODES,
  buildInternationalPhone,
  findCountryCode,
  normalizeDial,
  normalizeLocalNumber,
  parseCountryCodes,
  type CountryCode,
} from '../../_lib/countries';
import { validateEmail } from '../../_lib/emailCheck';

const CLIENT_FIELDS = [
  'id',
  'name',
  'username',
  'email',
  'phone',
  'hotel_id',
  'active',
  'created_at',
  'last_login',
  'country_iso',
  'country_dial',
  'country_name',
  'gender',
  'age',
  'profession',
].join(',');

const GENDERS = new Set(['femenino', 'masculino', 'otro', 'prefiero-no-decir']);
const MIN_AGE = 13;
const MAX_AGE = 120;

interface ClientProfile {
  id: string;
  name: string;
  username: string;
  email: string | null;
  phone: string | null;
  hotel_id: string | null;
  active: boolean;
  created_at: string | null;
  last_login: string | null;
  country_iso: string | null;
  country_dial: string | null;
  country_name: string | null;
  gender: string | null;
  age: number | null;
  profession: string | null;
}

interface ProfileBody {
  name?: string;
  email?: string | null;
  country_iso?: string;
  dial_code?: string;
  phone?: string;
  gender?: string | null;
  age?: number | string | null;
  profession?: string | null;
}

async function loadCountryCodes(env: Env, hotelId: string | null): Promise<CountryCode[]> {
  if (!hotelId) return DEFAULT_COUNTRY_CODES;
  const result = await serviceRequest<Array<{ value: string }>>(
    env,
    `configuracion_hotel?hotel_id=eq.${encodeURIComponent(hotelId)}&key=eq.${COUNTRY_CODES_KEY}&select=value&limit=1`
  );
  const configured = parseCountryCodes(result.data?.[0]?.value);
  return configured.length > 0 ? configured : DEFAULT_COUNTRY_CODES;
}

function sessionGuard(env: Env, request: Request) {
  return readSession(env, request);
}

/**
 * Área de cliente protegida por la cookie de sesión (Pages Function).
 * Solo responde a sesiones con rol `client`; los usuarios del sistema usan el
 * panel de administración.
 */
async function handleGet(env: Env, request: Request): Promise<Response> {
  const session = await sessionGuard(env, request);
  if (!session) return json({ error: 'Sesión no válida o expirada' }, 401);
  if (session.role !== 'client') {
    return json({ error: 'Esta sección es para clientes' }, 403);
  }

  const clientResult = await serviceRequest<ClientProfile[]>(
    env,
    `clientes?id=eq.${encodeURIComponent(session.sub)}&select=${CLIENT_FIELDS}&limit=1`
  );

  if (clientResult.error) return json({ error: clientResult.error }, 400);

  const client = clientResult.data?.[0];
  if (!client) return json({ error: 'La cuenta ya no existe' }, 404);
  if (!client.active) return json({ error: 'Cuenta desactivada' }, 403);

  const commentsResult = await serviceRequest<Record<string, unknown>[]>(
    env,
    `comentarios?cliente_id=eq.${encodeURIComponent(session.sub)}&select=id,content,rating,status,admin_reply,created_at&order=created_at.desc&limit=50`
  );

  const reservationsResult = await serviceRequest<Record<string, unknown>[]>(
    env,
    `reservas?cliente_id=eq.${encodeURIComponent(session.sub)}&select=id,check_in,check_out,adults,children_count,room_type,status,message,created_at&order=created_at.desc&limit=50`
  );

  return json({
    data: {
      client,
      comments: commentsResult.data ?? [],
      reservations: reservationsResult.data ?? [],
    },
    error: null,
  });
}

/**
 * El cliente edita su propio perfil: nombre, correo, celular con país, género,
 * edad y profesión. Nunca puede cambiar su alias, su hotel ni su estado.
 */
async function handlePatch(env: Env, request: Request): Promise<Response> {
  const session = await sessionGuard(env, request);
  if (!session) return json({ error: 'Sesión no válida o expirada' }, 401);
  if (session.role !== 'client') {
    return json({ error: 'Esta sección es para clientes' }, 403);
  }

  const current = await serviceRequest<ClientProfile[]>(
    env,
    `clientes?id=eq.${encodeURIComponent(session.sub)}&select=${CLIENT_FIELDS}&limit=1`
  );
  if (current.error) return json({ error: current.error }, 400);
  const client = current.data?.[0];
  if (!client) return json({ error: 'La cuenta ya no existe' }, 404);
  if (!client.active) return json({ error: 'Cuenta desactivada' }, 403);

  const body = (await request.json().catch(() => null)) as ProfileBody | null;
  if (!body) return json({ error: 'Datos inválidos' }, 400);

  const changes: Record<string, unknown> = {};

  if (body.name !== undefined) {
    const name = String(body.name).trim().replace(/\s+/g, ' ');
    if (name.length < 2 || name.length > 80) {
      return json({ error: 'El nombre debe tener entre 2 y 80 caracteres.' }, 400);
    }
    changes.name = name;
  }

  if (body.email !== undefined) {
    const raw = String(body.email ?? '').trim();
    if (!raw) {
      changes.email = null;
    } else {
      const check = await validateEmail(raw);
      if (!check.ok) return json({ error: check.error }, 400);
      changes.email = check.email ?? null;
    }
  }

  if (body.phone !== undefined || body.dial_code !== undefined) {
    const dialCode = normalizeDial(body.dial_code ?? client.country_dial ?? '');
    const localNumber = normalizeLocalNumber(body.phone ?? client.phone ?? '');
    if (!dialCode || localNumber.length < 6 || localNumber.length > 15) {
      return json({ error: 'Ingresá un número de celular válido.' }, 400);
    }
    const countryCodes = await loadCountryCodes(env, client.hotel_id);
    const country = findCountryCode(
      countryCodes.filter((code) => code.active),
      String(body.country_iso ?? client.country_iso ?? ''),
      dialCode
    );
    if (!country) return json({ error: 'Elegí un país del listado de códigos de área.' }, 400);
    changes.phone = buildInternationalPhone(country.dial, localNumber);
    changes.country_iso = country.iso;
    changes.country_dial = country.dial;
    changes.country_name = country.name;
  }

  if (body.gender !== undefined) {
    const gender = String(body.gender ?? '').trim().toLowerCase();
    if (!gender) {
      changes.gender = null;
    } else if (!GENDERS.has(gender)) {
      return json({ error: 'Género no válido.' }, 400);
    } else {
      changes.gender = gender;
    }
  }

  if (body.age !== undefined) {
    const raw = body.age;
    if (raw === null || raw === '') {
      changes.age = null;
    } else {
      const age = Number(raw);
      if (!Number.isInteger(age) || age < MIN_AGE || age > MAX_AGE) {
        return json({ error: `La edad debe estar entre ${MIN_AGE} y ${MAX_AGE} años.` }, 400);
      }
      changes.age = age;
    }
  }

  if (body.profession !== undefined) {
    const profession = String(body.profession ?? '').trim();
    if (profession.length > 80) {
      return json({ error: 'La profesión no puede superar los 80 caracteres.' }, 400);
    }
    changes.profession = profession || null;
  }

  if (Object.keys(changes).length === 0) {
    return json({ data: { client }, error: null });
  }

  // `select` acota la respuesta: PATCH con `return=representation` devolvería
  // todas las columnas, incluido `password_hash`, y eso nunca debe salir
  // del servidor.
  const updated = await serviceRequest<ClientProfile[]>(
    env,
    `clientes?id=eq.${encodeURIComponent(session.sub)}&select=${CLIENT_FIELDS}`,
    {
      method: 'PATCH',
      body: JSON.stringify(changes),
      prefer: 'return=representation',
    }
  );

  if (updated.error || !updated.data?.length) {
    console.error('[client/me] no se pudo actualizar el perfil:', updated.error);
    return json({ error: 'No se pudo guardar el perfil. Probá de nuevo.' }, 400);
  }

  return json({ data: { client: updated.data[0] }, error: null });
}

export async function handleClientMe(request: Request, env: Env): Promise<Response> {
  if (request.method === 'GET') return handleGet(env, request);
  if (request.method === 'PATCH') return handlePatch(env, request);
  return json({ error: 'Método no permitido' }, 405);
}

export const onRequestGet = ({ request, env }: { request: Request; env: Env }) =>
  handleClientMe(request, env);

export const onRequestPatch = ({ request, env }: { request: Request; env: Env }) =>
  handleClientMe(request, env);
