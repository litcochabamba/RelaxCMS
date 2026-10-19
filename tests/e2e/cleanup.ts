import fs from 'node:fs';
import path from 'node:path';

/**
 * Limpieza de los datos que crea la prueba contra la base local.
 *
 * Lee `.dev.vars` como lo hace el servidor de desarrollo: es la única forma de
 * borrar las filas de prueba sin exponer la clave en la salida. Nunca imprime
 * valores de configuración.
 */
function readDevVars(): Record<string, string> {
  try {
    const raw = fs.readFileSync(path.join(process.cwd(), '.dev.vars'), 'utf8');
    return Object.fromEntries(
      raw
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('#') && line.includes('='))
        .map((line) => {
          const index = line.indexOf('=');
          return [
            line.slice(0, index).trim(),
            line.slice(index + 1).trim().replace(/^["']|["']$/g, ''),
          ];
        })
    );
  } catch {
    return {};
  }
}

const devVars = readDevVars();
const supabaseUrl = (devVars.SUPABASE_URL || '').trim().replace(/\/+$/, '');
const serviceKey = (devVars.SUPABASE_SERVICE_ROLE_KEY || '').trim();

function requireConfig() {
  if (!supabaseUrl || !serviceKey) {
    throw new Error(
      'Faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .dev.vars: no se pueden limpiar los datos de prueba.'
    );
  }
}

async function rest(pathname: string, init: RequestInit = {}) {
  requireConfig();
  const response = await fetch(`${supabaseUrl}/rest/v1/${pathname}`, {
    ...init,
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      ...(init.headers as Record<string, string> | undefined),
    },
  });
  if (!response.ok) {
    throw new Error(`Limpieza de prueba falló con HTTP ${response.status}`);
  }
  return response;
}

/** Crea un usuario admin temporal para las pruebas del panel. */
export async function createTestAdmin(input: {
  username: string;
  email: string;
  password: string;
  hotelId?: string;
}): Promise<string> {
  const hashResponse = await rest('rpc/hash_password', {
    method: 'POST',
    body: JSON.stringify({ p_password: input.password }),
  });
  const passwordHash = (await hashResponse.json()) as string;
  if (!passwordHash) throw new Error('No se pudo generar el hash de la contraseña de prueba');

  let hotelId = input.hotelId;
  if (!hotelId) {
    const hotelsResponse = await rest(
      'hoteles?select=id&active=eq.true&order=name.asc&limit=1'
    );
    const hotels = (await hotelsResponse.json()) as Array<{ id: string }>;
    hotelId = hotels[0]?.id;
  }

  const response = await rest('usuarios?select=id', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      name: 'Admin E2E Promociones',
      username: input.username,
      email: input.email,
      password_hash: passwordHash,
      role: 'admin',
      hotel_id: hotelId || null,
      active: true,
    }),
  });
  const rows = (await response.json()) as Array<{ id: string }>;
  if (!rows[0]?.id) throw new Error('No se pudo crear el admin de prueba');
  return rows[0].id;
}

/**
 * Borra las reservas y la cuenta de cliente creadas por la prueba.
 * Se busca por alias porque el id puede no conocerse si la prueba falló pronto.
 */
export async function deleteTestClientByUsername(username: string) {
  requireConfig();
  const response = await rest(
    `clientes?username=eq.${encodeURIComponent(username)}&select=id`
  );
  const rows = (await response.json()) as Array<{ id: string }>;

  for (const row of rows) {
    await rest(`reservas?cliente_id=eq.${encodeURIComponent(row.id)}`, { method: 'DELETE' });
    await rest(`clientes?id=eq.${encodeURIComponent(row.id)}`, { method: 'DELETE' });
  }
}

/** Borra las promociones creadas por la prueba, se haya guardado o no el id. */
export async function deletePromotionsByTitle(title: string) {
  await rest(`promociones?title=eq.${encodeURIComponent(title)}`, { method: 'DELETE' });
}

/**
 * Credenciales del feed de integración. Se leen de `.dev.vars` y nunca se
 * imprimen: la prueba solo las usa para autenticarse contra el endpoint.
 */
export function integrationCredentials(): { key: string; hotelId: string } {
  const key = (devVars.INTEGRATIONS_API_KEY || '').trim();
  const hotelId = (devVars.INTEGRATIONS_HOTEL_ID || '').trim();
  if (!key || !hotelId) {
    throw new Error(
      'Faltan INTEGRATIONS_API_KEY e INTEGRATIONS_HOTEL_ID en .dev.vars: no se puede leer el feed que consume RelaxPMS.'
    );
  }
  return { key, hotelId };
}

/** Borra el usuario admin temporal de la prueba. */
export async function deleteTestUserByUsername(username: string) {
  await rest(`usuarios?username=eq.${encodeURIComponent(username)}`, { method: 'DELETE' });
}
