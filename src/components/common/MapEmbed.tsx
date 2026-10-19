import { MapPin } from 'lucide-react';
import { resolveMapEmbed } from '../../utils/mapEmbed';

interface MapEmbedProps {
  link?: string | null;
  title: string;
  /** Permite desactivar el zoom/arrastre en vistas previas pequeñas. */
  interactive?: boolean;
}

/**
 * Pinta el mapa público (OpenStreetMap o Google) que se cargó desde el CMS.
 * Si el enlace no se puede interpretar muestra una guía para corregirlo.
 */
export default function MapEmbed({ link, title, interactive = true }: MapEmbedProps) {
  const resolved = resolveMapEmbed(link || '');

  if (!resolved) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 bg-gray-100 px-4 text-center">
        <MapPin className="h-5 w-5 text-gray-400" strokeWidth={1.5} />
        <p className="text-[11px] font-medium text-gray-500">
          {link?.trim() ? 'Enlace de mapa no reconocido' : 'Sin enlace de mapa'}
        </p>
        <p className="text-[10px] leading-snug text-gray-400">
          {link?.trim()
            ? 'Abrí el enlace corto y copiá la URL completa o las coordenadas.'
            : 'Pegá un enlace de Google Maps, OpenStreetMap o unas coordenadas.'}
        </p>
      </div>
    );
  }

  return (
    <iframe
      key={resolved.src}
      title={title}
      src={resolved.src}
      className={`h-full w-full border-0 ${interactive ? '' : 'pointer-events-none'}`}
      loading="lazy"
      referrerPolicy="no-referrer-when-downgrade"
      allowFullScreen
    />
  );
}
