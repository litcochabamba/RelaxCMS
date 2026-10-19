/**
 * Convierte un enlace pegado en el CMS (Google Maps, un embed ya armado o un
 * par de coordenadas) en una URL segura para un <iframe>.
 *
 * Todos los mapas se dibujan con el visor público de Google Maps
 * (`output=embed`), sin API key. Los enlaces de OpenStreetMap que ya estén
 * guardados se convierten a Google usando sus coordenadas.
 */

export interface MapCoordinates {
  lat: number;
  lng: number;
}

export interface ResolvedMapEmbed {
  src: string;
  externalUrl: string;
  provider: 'google';
  coords?: MapCoordinates;
}

const DECIMAL = String.raw`-?\d{1,3}(?:\.\d+)?`;

const COORDINATE_PATTERNS: RegExp[] = [
  // Google Maps: /@lat,lng,15z
  new RegExp(`@(${DECIMAL}),(${DECIMAL})`),
  // Google Maps: !3dLAT!4dLNG (ficha del lugar)
  new RegExp(`!3d(${DECIMAL})!4d(${DECIMAL})`),
  // Parámetros habituales: ?q=lat,lng, ?ll=..., ?center=...
  new RegExp(
    `[?&#](?:q|query|ll|center|sll|daddr|destination|marker)=(${DECIMAL})\\s*,\\s*(${DECIMAL})`,
    'i'
  ),
  // OpenStreetMap: ?mlat=lat&mlon=lng
  new RegExp(`[?&#]mlat=(${DECIMAL})(?:[^#]*)mlon=(${DECIMAL})`, 'i'),
  // OpenStreetMap: #map=15/lat/lng
  new RegExp(`#map=\\d+(?:\\.\\d+)?\\/(${DECIMAL})\\/(${DECIMAL})`),
  // Coordenadas sueltas: "17.3895, -66.1568" o "geo:17.3895,-66.1568"
  new RegExp(`^\\s*(?:geo:)?\\s*(${DECIMAL})\\s*,\\s*(${DECIMAL})\\s*$`, 'i'),
];

function toCoordinates(latValue: string, lngValue: string): MapCoordinates | null {
  const lat = Number(latValue);
  const lng = Number(lngValue);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

/** Busca coordenadas en texto libre, enlaces de Google Maps u OSM. */
export function parseMapCoordinates(input: string): MapCoordinates | null {
  // Los enlaces guardados suelen traer la coma codificada como %2C.
  const value = input.trim().replace(/%2c/gi, ',');
  if (!value) return null;

  for (const pattern of COORDINATE_PATTERNS) {
    const match = value.match(pattern);
    if (!match) continue;
    const coords = toCoordinates(match[1], match[2]);
    if (coords) return coords;
  }

  // OpenStreetMap también admite el orden invertido (mlon antes de mlat).
  const inverted = value.match(
    new RegExp(`[?&#]mlon=(${DECIMAL})(?:[^#]*)mlat=(${DECIMAL})`, 'i')
  );
  return inverted ? toCoordinates(inverted[2], inverted[1]) : null;
}

/** Visor público de Google Maps centrado en las coordenadas. */
export function googleEmbedUrl(latitude: number, longitude: number, zoom = 16): string {
  const lat = latitude.toFixed(5);
  const lng = longitude.toFixed(5);
  return `https://maps.google.com/maps?q=${lat}%2C${lng}&z=${zoom}&hl=es&output=embed`;
}

function googleSearchUrl(query: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

function googleDirectionsUrl(destination: string): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
}

function safeHost(input: string): string {
  try {
    return new URL(input).hostname.toLowerCase();
  } catch {
    return '';
  }
}

function isOsmHost(host: string): boolean {
  return host === 'openstreetmap.org' || host.endsWith('.openstreetmap.org');
}

function isGoogleMapsHost(host: string): boolean {
  // Solo dominios reales de Google (google.com, google.com.bo, etc.). Evita
  // aceptar hosts como google.ejemplo.com en un embed guardado.
  return /(^|\.)google\.(com|es|bo|com\.bo|ar|com\.ar|pe|com\.pe|mx|com\.mx|co|com\.co|cl|com\.ec|com\.ve|com\.uy|com\.py|com\.br|pt)$/.test(
    host
  );
}

function isShortGoogleLink(host: string): boolean {
  return host === 'maps.app.goo.gl' || host === 'goo.gl' || host === 'g.co';
}

/** Centro del `bbox` de un embed de OpenStreetMap guardado. */
function osmBboxCenter(value: string): MapCoordinates | null {
  try {
    const bbox = new URL(value).searchParams.get('bbox');
    if (!bbox) return null;
    const [minLng, minLat, maxLng, maxLat] = bbox.split(',').map(Number);
    if (![minLng, minLat, maxLng, maxLat].every(Number.isFinite)) return null;
    return toCoordinates(String((minLat + maxLat) / 2), String((minLng + maxLng) / 2));
  } catch {
    return null;
  }
}

/** Extrae el texto de un enlace de Google Maps cuando no trae coordenadas. */
function googlePlaceQuery(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  if (!/^https?:\/\//i.test(trimmed)) {
    // Dirección o nombre del hotel escrito a mano.
    return trimmed;
  }

  try {
    const url = new URL(trimmed);
    const q = url.searchParams.get('q') || url.searchParams.get('query');
    if (q) return q;

    const placeMatch = url.pathname.match(/\/maps\/place\/([^/]+)/);
    if (placeMatch) return decodeURIComponent(placeMatch[1].replace(/\+/g, ' '));

    const searchMatch = url.pathname.match(/\/maps\/search\/([^/]+)/);
    if (searchMatch) return decodeURIComponent(searchMatch[1].replace(/\+/g, ' '));

    return null;
  } catch {
    return null;
  }
}

function googleResult(coords: MapCoordinates): ResolvedMapEmbed {
  const query = `${coords.lat},${coords.lng}`;
  return {
    src: googleEmbedUrl(coords.lat, coords.lng),
    // El enlace externo lleva a la ficha del lugar; "Cómo llegar" usa dir/.
    externalUrl: googleSearchUrl(query),
    provider: 'google',
    coords,
  };
}

/**
 * Devuelve la URL del iframe y un enlace externo. `null` cuando el enlace no
 * se puede interpretar (por ejemplo los enlaces cortos maps.app.goo.gl, que
 * redirigen y no se pueden leer desde el navegador).
 */
export function resolveMapEmbed(input: string): ResolvedMapEmbed | null {
  const value = input.trim();
  if (!value) return null;

  const host = safeHost(value);
  const looksLikeUrl = /^https?:\/\//i.test(value);

  // Enlaces de OpenStreetMap guardados: se convierten a Google con sus
  // coordenadas (o con el centro del bbox si es un embed).
  if (isOsmHost(host)) {
    const coords = parseMapCoordinates(value) || osmBboxCenter(value);
    return coords ? googleResult(coords) : null;
  }

  // Embed de Google ya armado ("Compartir > Insertar mapa").
  if (isGoogleMapsHost(host) && value.includes('/maps/embed')) {
    return {
      src: value,
      externalUrl: 'https://www.google.com/maps',
      provider: 'google',
      coords: parseMapCoordinates(value) || undefined,
    };
  }

  // Enlaces cortos: no exponen coordenadas sin seguirlos.
  if (isShortGoogleLink(host)) return null;

  if (looksLikeUrl && !isGoogleMapsHost(host)) return null;

  const coords = parseMapCoordinates(value);
  if (coords) return googleResult(coords);

  const query = googlePlaceQuery(value);
  if (!query) return null;

  return {
    src: `https://maps.google.com/maps?q=${encodeURIComponent(query)}&z=16&hl=es&output=embed`,
    externalUrl: googleSearchUrl(query),
    provider: 'google',
  };
}

/** Enlace externo de Google Maps para "Cómo llegar". */
export function googleDirectionsLink(
  destination: MapCoordinates | string | null | undefined
): string {
  if (!destination) return 'https://www.google.com/maps';
  const query =
    typeof destination === 'string' ? destination : `${destination.lat},${destination.lng}`;
  return googleDirectionsUrl(query);
}
