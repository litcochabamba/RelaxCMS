/**
 * Códigos de área telefónicos del registro público.
 *
 * La lista efectiva la administra el hotel desde Configuración y se guarda en
 * `configuracion_hotel` con la clave `country_dial_codes`. La constante de
 * `DEFAULT_COUNTRY_CODES` solo se usa cuando esa configuración todavía no
 * existe, para que el formulario nunca quede vacío.
 */

export interface CountryCode {
  /** ISO 3166-1 alfa-2, por ejemplo `BO`. */
  iso: string;
  name: string;
  /** Código de área con `+`, por ejemplo `+591`. */
  dial: string;
  /** Bandera emoji; puede quedar vacía. */
  flag: string;
  active: boolean;
}

export const COUNTRY_CODES_KEY = 'country_dial_codes';

export const DEFAULT_COUNTRY_CODES: CountryCode[] = [
  { iso: 'AR', name: 'Argentina', dial: '+54', flag: '🇦🇷', active: true },
  { iso: 'BO', name: 'Bolivia', dial: '+591', flag: '🇧🇴', active: true },
  { iso: 'BR', name: 'Brasil', dial: '+55', flag: '🇧🇷', active: true },
  { iso: 'CL', name: 'Chile', dial: '+56', flag: '🇨🇱', active: true },
  { iso: 'CO', name: 'Colombia', dial: '+57', flag: '🇨🇴', active: true },
  { iso: 'CR', name: 'Costa Rica', dial: '+506', flag: '🇨🇷', active: true },
  { iso: 'CU', name: 'Cuba', dial: '+53', flag: '🇨🇺', active: true },
  { iso: 'EC', name: 'Ecuador', dial: '+593', flag: '🇪🇨', active: true },
  { iso: 'SV', name: 'El Salvador', dial: '+503', flag: '🇸🇻', active: true },
  { iso: 'ES', name: 'España', dial: '+34', flag: '🇪🇸', active: true },
  { iso: 'US', name: 'Estados Unidos', dial: '+1', flag: '🇺🇸', active: true },
  { iso: 'GT', name: 'Guatemala', dial: '+502', flag: '🇬🇹', active: true },
  { iso: 'HN', name: 'Honduras', dial: '+504', flag: '🇭🇳', active: true },
  { iso: 'MX', name: 'México', dial: '+52', flag: '🇲🇽', active: true },
  { iso: 'NI', name: 'Nicaragua', dial: '+505', flag: '🇳🇮', active: true },
  { iso: 'PA', name: 'Panamá', dial: '+507', flag: '🇵🇦', active: true },
  { iso: 'PY', name: 'Paraguay', dial: '+595', flag: '🇵🇾', active: true },
  { iso: 'PE', name: 'Perú', dial: '+51', flag: '🇵🇪', active: true },
  { iso: 'PR', name: 'Puerto Rico', dial: '+1', flag: '🇵🇷', active: true },
  { iso: 'DO', name: 'República Dominicana', dial: '+1', flag: '🇩🇴', active: true },
  { iso: 'UY', name: 'Uruguay', dial: '+598', flag: '🇺🇾', active: true },
  { iso: 'VE', name: 'Venezuela', dial: '+58', flag: '🇻🇪', active: true },
];

/** Deja el código de área en formato `+591`, sin espacios ni guiones. */
export function normalizeDial(value: unknown): string {
  const digits = String(value ?? '').replace(/\D/g, '');
  return digits ? `+${digits}` : '';
}

/** Solo dígitos, sin ceros iniciales (formato local para componer E.164). */
export function normalizeLocalNumber(value: unknown): string {
  return String(value ?? '')
    .replace(/\D/g, '')
    .replace(/^0+/, '');
}

export function buildInternationalPhone(dial: string, localNumber: string): string {
  return `${dial}${normalizeLocalNumber(localNumber)}`;
}

/**
 * Lee el JSON guardado en la configuración. Descarta entradas incompletas en
 * lugar de romper el formulario por un dato mal cargado.
 */
export function parseCountryCodes(raw: string | null | undefined): CountryCode[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  const codes: CountryCode[] = [];
  for (const item of parsed) {
    if (!item || typeof item !== 'object') continue;
    const record = item as Record<string, unknown>;
    const iso = String(record.iso ?? '').trim().toUpperCase();
    const name = String(record.name ?? '').trim();
    const dial = normalizeDial(record.dial);
    if (!/^[A-Z]{2}$/.test(iso) || !name || !dial) continue;
    codes.push({
      iso,
      name,
      dial,
      flag: typeof record.flag === 'string' ? record.flag.trim() : '',
      active: record.active !== false,
    });
  }
  return codes;
}

export function findCountryCode(
  codes: CountryCode[],
  iso: string,
  dial: string
): CountryCode | null {
  const wantedIso = String(iso || '').trim().toUpperCase();
  const wantedDial = normalizeDial(dial);
  return (
    codes.find((code) => code.iso === wantedIso && code.dial === wantedDial) ||
    // Compatibilidad: si el navegador manda solo el código de área y hay un
    // único país con ese código, se resuelve sin ambigüedad.
    (codes.filter((code) => code.dial === wantedDial).length === 1
      ? codes.find((code) => code.dial === wantedDial) || null
      : null)
  );
}
