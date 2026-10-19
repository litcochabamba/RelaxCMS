import { json, type Env } from '../../_lib/env';
import { serviceRequest } from '../../_lib/supabase';
import {
  COUNTRY_CODES_KEY,
  DEFAULT_COUNTRY_CODES,
  parseCountryCodes,
  type CountryCode,
} from '../../_lib/countries';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Códigos de área que muestra el formulario de registro.
 *
 * Salen de la configuración del hotel, así que el administrador puede agregar,
 * editar o desactivar países desde el panel sin tocar el código.
 */
export async function handleCountryCodes(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') return json({ error: 'Método no permitido' }, 405);

  const requested = new URL(request.url).searchParams.get('hotel_id') || '';
  let hotelId = UUID.test(requested) ? requested : '';

  if (!hotelId) {
    const first = await serviceRequest<Array<{ id: string }>>(
      env,
      'hoteles?select=id&order=created_at.asc&limit=1'
    );
    hotelId = first.data?.[0]?.id || '';
  }
  if (!hotelId) return json({ data: DEFAULT_COUNTRY_CODES.filter((code) => code.active), error: null });

  const result = await serviceRequest<Array<{ value: string }>>(
    env,
    `configuracion_hotel?hotel_id=eq.${encodeURIComponent(hotelId)}&key=eq.${COUNTRY_CODES_KEY}&select=value&limit=1`
  );

  const configured = parseCountryCodes(result.data?.[0]?.value);
  const codes: CountryCode[] = (configured.length > 0 ? configured : DEFAULT_COUNTRY_CODES)
    .filter((code) => code.active)
    .sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));

  return json({ data: codes, error: null });
}

export const onRequestGet = ({ request, env }: { request: Request; env: Env }) =>
  handleCountryCodes(request, env);
