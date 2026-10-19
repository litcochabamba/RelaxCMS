import {
  createSessionToken,
  isSecureRequest,
  json,
  serverConfigProblems,
  sessionCookie,
  type Env,
} from '../_lib/env';
import { hashPassword, serviceRequest } from '../_lib/supabase';
import { verifyTurnstile } from '../_lib/turnstile';
import {
  COUNTRY_CODES_KEY,
  DEFAULT_COUNTRY_CODES,
  buildInternationalPhone,
  findCountryCode,
  normalizeDial,
  normalizeLocalNumber,
  parseCountryCodes,
  type CountryCode,
} from '../_lib/countries';
import { validateEmail } from '../_lib/emailCheck';
import { checkRegistrationAttempts, pruneOldAttempts } from '../_lib/rateLimit';

const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const UNAVAILABLE = 'El registro no está disponible en este momento. Probá más tarde.';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ALIAS_PATTERN = /^[a-z0-9._-]{3,24}$/;
const RESERVED_ALIASES = new Set([
  'admin',
  'administrador',
  'root',
  'sistema',
  'soporte',
  'hostal',
  'hotel',
  'staff',
  'reservas',
]);

const MIN_PASSWORD = 8;
const MAX_PASSWORD = 72;
const MIN_NAME = 2;
const MAX_NAME = 80;
const MIN_PHONE = 6;
const MAX_PHONE = 15;

interface RegisterBody {
  hotel_id?: string;
  alias?: string;
  name?: string;
  password?: string;
  country_iso?: string;
  dial_code?: string;
  phone?: string;
  email?: string;
  turnstileToken?: string;
  'cf-turnstile-response'?: string;
}

interface ClientRow {
  id: string;
  username: string;
  name: string;
  email: string | null;
  phone: string | null;
  hotel_id: string | null;
}

async function loadCountryCodes(env: Env, hotelId: string): Promise<CountryCode[]> {
  const result = await serviceRequest<Array<{ value: string }>>(
    env,
    `configuracion_hotel?hotel_id=eq.${encodeURIComponent(hotelId)}&key=eq.${COUNTRY_CODES_KEY}&select=value&limit=1`
  );
  const configured = parseCountryCodes(result.data?.[0]?.value);
  return configured.length > 0 ? configured : DEFAULT_COUNTRY_CODES;
}

/** Hotel al que se registra la cuenta: el que manda el sitio o el primero activo. */
async function resolveHotelId(env: Env, requested: string | undefined): Promise<string | null> {
  if (requested && UUID.test(requested)) {
    const found = await serviceRequest<Array<{ id: string }>>(
      env,
      `hoteles?id=eq.${encodeURIComponent(requested)}&select=id&limit=1`
    );
    return found.data?.[0]?.id ?? null;
  }
  const first = await serviceRequest<Array<{ id: string }>>(
    env,
    'hoteles?select=id&order=created_at.asc&limit=1'
  );
  return first.data?.[0]?.id ?? null;
}

async function aliasTaken(env: Env, alias: string): Promise<{ taken: boolean; unavailable: boolean }> {
  const filter = `username=eq.${encodeURIComponent(alias)}&select=id&limit=1`;
  const [clients, users] = await Promise.all([
    serviceRequest<Array<{ id: string }>>(env, `clientes?${filter}`),
    serviceRequest<Array<{ id: string }>>(env, `usuarios?${filter}`),
  ]);

  if (clients.status === 503 || users.status === 503) return { taken: false, unavailable: true };
  if (clients.error || users.error) return { taken: false, unavailable: true };
  return { taken: Boolean(clients.data?.length || users.data?.length), unavailable: false };
}

/**
 * Registro público de clientes.
 *
 * Solo pide alias, nombre, contraseña y celular con código de área; el correo es
 * opcional. El país del cliente se deduce del código de área elegido, que sale
 * de la configuración del hotel (Configuración → Códigos de área), nunca de una
 * lista embebida en el formulario.
 */
export async function handleRegister(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'Método no permitido' }, 405);

  const configProblems = serverConfigProblems(env);
  if (configProblems.length > 0) {
    console.error('[register] configuración incompleta:', configProblems.join('; '));
    return json({ error: UNAVAILABLE }, 503);
  }

  const body = (await request.json().catch(() => null)) as RegisterBody | null;

  const alias = String(body?.alias ?? '').trim().toLowerCase();
  const name = String(body?.name ?? '').trim().replace(/\s+/g, ' ');
  const password = String(body?.password ?? '');
  const iso = String(body?.country_iso ?? '').trim().toUpperCase();
  const dial = normalizeDial(body?.dial_code);
  const localNumber = normalizeLocalNumber(body?.phone);
  const emailInput = String(body?.email ?? '').trim();

  if (!ALIAS_PATTERN.test(alias)) {
    return json(
      { error: 'El alias debe tener entre 3 y 24 caracteres: letras, números, punto, guion o guion bajo.' },
      400
    );
  }
  if (RESERVED_ALIASES.has(alias)) {
    return json({ error: 'Ese alias está reservado. Elegí otro.' }, 400);
  }
  if (name.length < MIN_NAME || name.length > MAX_NAME) {
    return json({ error: `El nombre debe tener entre ${MIN_NAME} y ${MAX_NAME} caracteres.` }, 400);
  }
  if (password.length < MIN_PASSWORD || password.length > MAX_PASSWORD) {
    return json(
      { error: `La contraseña debe tener entre ${MIN_PASSWORD} y ${MAX_PASSWORD} caracteres.` },
      400
    );
  }
  if (!dial || localNumber.length < MIN_PHONE || localNumber.length > MAX_PHONE) {
    return json({ error: 'Ingresá un número de celular válido.' }, 400);
  }

  // Límite de reintentos: 2 por alias+IP y 10 por IP cada 30 minutos. Se cuenta
  // antes del captcha para no gastar tokens en un reintento bloqueado.
  const attempts = await checkRegistrationAttempts(env, request, alias);
  if (!attempts.allowed) {
    const minutes = Math.max(1, Math.ceil(attempts.retryAfterSeconds / 60));
    return json(
      {
        error: `Hiciste varios intentos seguidos. Esperá ${minutes} minuto${
          minutes === 1 ? '' : 's'
        } y probá de nuevo.`,
      },
      429,
      { 'Retry-After': String(attempts.retryAfterSeconds) }
    );
  }

  const captcha = await verifyTurnstile(
    request,
    env,
    body?.turnstileToken || body?.['cf-turnstile-response']
  );
  if (!captcha.ok) {
    return json({ error: captcha.error || 'Captcha inválido' }, captcha.status || 400);
  }

  const hotelId = await resolveHotelId(env, body?.hotel_id);
  if (!hotelId) {
    console.error('[register] no hay hotel activo para asociar la cuenta');
    return json({ error: UNAVAILABLE }, 503);
  }

  // El país sale del código de área configurado por el hotel: el formulario
  // nunca decide el país por su cuenta.
  const countryCodes = await loadCountryCodes(env, hotelId);
  const country = findCountryCode(
    countryCodes.filter((code) => code.active),
    iso,
    dial
  );
  if (!country) {
    return json({ error: 'Elegí un país del listado de códigos de área.' }, 400);
  }

  let email: string | null = null;
  if (emailInput) {
    const emailCheck = await validateEmail(emailInput);
    if (!emailCheck.ok) return json({ error: emailCheck.error }, 400);
    email = emailCheck.email ?? null;
  }

  const aliasCheck = await aliasTaken(env, alias);
  if (aliasCheck.unavailable) {
    console.error('[register] Supabase no respondió al verificar el alias');
    return json({ error: UNAVAILABLE }, 503);
  }
  if (aliasCheck.taken) {
    return json({ error: 'Ese alias ya está en uso. Probá con otro.' }, 409);
  }

  const passwordHash = await hashPassword(env, password);
  if (!passwordHash) {
    console.error('[register] no se pudo generar el hash de la contraseña');
    return json({ error: UNAVAILABLE }, 503);
  }

  const inserted = await serviceRequest<ClientRow[]>(
    env,
    'clientes?select=id,username,name,email,phone,hotel_id',
    {
      method: 'POST',
      body: JSON.stringify({
        hotel_id: hotelId,
        name,
        username: alias,
        email,
        phone: buildInternationalPhone(country.dial, localNumber),
        password_hash: passwordHash,
        country_iso: country.iso,
        country_dial: country.dial,
        country_name: country.name,
        active: true,
        last_login: new Date().toISOString(),
      }),
      prefer: 'return=representation',
    }
  );

  if (inserted.error || !inserted.data?.length) {
    console.error('[register] no se pudo crear la cuenta:', inserted.error);
    if (inserted.status === 409) {
      return json({ error: 'Ese alias ya está en uso. Probá con otro.' }, 409);
    }
    // PostgREST avisa con "schema cache" cuando falta aplicar la migración.
    if (/schema cache|column .* does not exist/i.test(inserted.error || '')) {
      return json(
        { error: 'El registro todavía no está habilitado. Probá más tarde o escribinos.' },
        503
      );
    }
    return json({ error: 'No se pudo crear la cuenta. Probá de nuevo.' }, 400);
  }

  void pruneOldAttempts(env);

  const client = inserted.data[0];
  const token = await createSessionToken(env, {
    sub: client.id,
    role: 'client',
    exp: Date.now() + SESSION_TTL_MS,
  });

  return json(
    {
      user: {
        id: client.id,
        username: client.username,
        name: client.name,
        email: client.email,
        phone: client.phone,
        role: 'client',
        hotel_id: client.hotel_id,
        avatar_url: null,
        country_iso: country.iso,
        country_dial: country.dial,
        country_name: country.name,
      },
    },
    201,
    { 'Set-Cookie': sessionCookie(token, isSecureRequest(request)) }
  );
}

export const onRequestPost = async ({ request, env }: { request: Request; env: Env }) => {
  try {
    return await handleRegister(request, env);
  } catch (error) {
    console.error('[register] error inesperado:', error);
    return json({ error: UNAVAILABLE }, 503);
  }
};
