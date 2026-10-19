/**
 * Convierte un enlace pegado en el CMS (Google Maps, OpenStreetMap, un embed
 * ya armado o un par de coordenadas) en una URL segura para un <iframe>.
 *
 * No usa API keys: Google se resuelve con su visor `output=embed` y las
 * coordenadas se pintan con el visor público de OpenStreetMap, igual que el
 * mapa de los atractivos.
 */

export interface MapCoordinates {
  lat: number;
  lng: number;
}

export interface ResolvedMapEmbed {
  src: string;
  externalUrl: string;
  provider: 'osm' | 'google';
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
  const value = input.trim();
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

/** Visor público de OpenStreetMap centrado en las coordenadas. */
export function osmEmbedUrl(latitude: number, longitude: number): string {
  // Vista de ~2 km de alto, manteniendo la proporción en longitud según la latitud.
  const latDelta = 0.012;
  const cos = Math.max(Math.cos((latitude * Math.PI) / 180), 0.2);
  const lngDelta = latDelta / cos;
  const bbox = [
    longitude - lngDelta,
    latitude - latDelta,
    longitude + lngDelta,
    latitude + latDelta,
  ]
    .map((value) => value.toFixed(5))
    .join('%2C');

  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${latitude.toFixed(
    5
  )}%2C${longitude.toFixed(5)}`;
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

  // Embed de OpenStreetMap ya armado.
  if (isOsmHost(host) && value.includes('/export/embed')) {
    const coords = parseMapCoordinates(value);
    return {
      src: value,
      externalUrl: coords
        ? `https://www.openstreetmap.org/?mlat=${coords.lat}&mlon=${coords.lng}#map=16/${coords.lat}/${coords.lng}`
        : 'https://www.openstreetmap.org/',
      provider: 'osm',
      coords: coords || undefined,
    };
  }

  // Embed de Google Maps ya armado.
  if (
    isGoogleMapsHost(host) &&
    (value.includes('/maps/embed') || /[?&]output=embed/i.test(value))
  ) {
    return {
      src: value,
      externalUrl: value.replace(/([?&])output=embed(&|$)/i, '$1').replace(/[?&]$/, ''),
      provider: 'google',
      coords: parseMapCoordinates(value) || undefined,
    };
  }

  const coords = parseMapCoordinates(value);
  if (coords) {
    return {
      src: osmEmbedUrl(coords.lat, coords.lng),
      externalUrl: `https://www.openstreetmap.org/?mlat=${coords.lat}&mlon=${coords.lng}#map=16/${coords.lat}/${coords.lng}`,
      provider: 'osm',
      coords,
    };
  }

  // Enlaces cortos: no exponen coordenadas sin seguirlos.
  if (isShortGoogleLink(host)) return null;

  if (looksLikeUrl && !isGoogleMapsHost(host)) return null;

  const query = googlePlaceQuery(value);
  if (!query) return null;

  return {
    src: `https://maps.google.com/maps?q=${encodeURIComponent(query)}&z=16&hl=es&output=embed`,
    externalUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`,
    provider: 'google',
  };
}
