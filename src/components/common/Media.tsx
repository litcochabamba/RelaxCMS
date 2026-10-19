import { Film } from 'lucide-react';
import { cn } from '../../utils/helpers';

const VIDEO_URL = /\.(mp4|webm|ogv|mov|m4v)$/i;

/** Detecta si la URL corresponde a un video por su extensión. */
export function isVideoUrl(url?: string | null): boolean {
  if (!url) return false;
  const clean = url.split('?')[0].split('#')[0];
  return VIDEO_URL.test(clean);
}

interface MediaProps {
  src?: string;
  alt: string;
  className?: string;
  /** Muestra un pequeño icono de video sobre la esquina inferior. */
  showVideoBadge?: boolean;
}

/**
 * Pinta una imagen o un video (silenciado, en bucle) con el mismo encuadre.
 * Sirve tanto para las secciones públicas como para las vistas previas del CMS.
 */
export default function Media({ src, alt, className, showVideoBadge = false }: MediaProps) {
  if (!src) return null;

  if (isVideoUrl(src)) {
    return (
      <>
        <video
          src={src}
          className={cn('w-full h-full object-cover', className)}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          aria-label={alt}
        />
        {showVideoBadge && (
          <span className="absolute bottom-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center pointer-events-none">
            <Film className="w-3 h-3" />
          </span>
        )}
      </>
    );
  }

  return <img src={src} alt={alt} className={cn('w-full h-full object-cover', className)} loading="lazy" />;
}
