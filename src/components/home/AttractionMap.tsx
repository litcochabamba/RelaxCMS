import { ExternalLink, MapPin } from 'lucide-react';
import { googleDirectionsLink, googleEmbedUrl } from '../../utils/mapEmbed';

interface AttractionMapProps {
  title: string;
  location?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  className?: string;
}

function readCoordinates(
  latitude?: number | null,
  longitude?: number | null
): { lat: number; lng: number } | null {
  if (
    typeof latitude !== 'number' ||
    typeof longitude !== 'number' ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    Math.abs(latitude) > 90 ||
    Math.abs(longitude) > 180
  ) {
    return null;
  }
  return { lat: latitude, lng: longitude };
}

/**
 * Mapa de la ubicación del atractivo activo. Usa el visor público de Google
 * Maps (sin API key) y un enlace externo de Google para obtener la ruta.
 */
export default function AttractionMap({
  title,
  location,
  latitude,
  longitude,
  className = '',
}: AttractionMapProps) {
  const place = location || title;
  const coords = readCoordinates(latitude, longitude);
  const externalUrl = googleDirectionsLink(coords || place);

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-white/30 bg-black/30 shadow-[0_20px_60px_-30px_rgba(0,0,0,0.8)] ${className}`}
    >
      {coords ? (
        <iframe
          key={`${coords.lat},${coords.lng}`}
          title={`Mapa de ${title}`}
          src={googleEmbedUrl(coords.lat, coords.lng)}
          className="h-full w-full border-0"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-2 px-6 text-center">
          <MapPin className="h-6 w-6 text-white/70" strokeWidth={1.5} />
          <p className="text-sm text-white/85">{place}</p>
          <p className="text-[11px] text-white/55">
            Este atractivo todavía no tiene coordenadas en el panel.
          </p>
        </div>
      )}

      {/* Texto de ubicación e icono de pin ya usados en la sección */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 bg-gradient-to-t from-black/75 via-black/35 to-transparent px-3 pb-2.5 pt-8">
        <span className="flex min-w-0 items-center gap-1.5 text-[11px] font-medium text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.7)]">
          <MapPin className="h-3.5 w-3.5 shrink-0" strokeWidth={1.7} />
          <span className="truncate">{place}</span>
        </span>
      </div>

      <a
        href={externalUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="absolute right-2 top-2 flex items-center gap-1 rounded-full border border-white/25 bg-black/45 px-2.5 py-1 text-[10px] font-medium text-white backdrop-blur-sm transition-colors hover:bg-black/70"
      >
        Cómo llegar
        <ExternalLink className="h-3 w-3" />
      </a>
    </div>
  );
}
