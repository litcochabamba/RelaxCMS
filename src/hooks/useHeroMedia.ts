import { useEffect, useState } from 'react';

export interface HeroMediaItem {
  name: string;
  url: string;
  type?: 'image' | 'video';
}

export interface HeroMedia {
  images: { horizontal: HeroMediaItem[]; vertical: HeroMediaItem[] };
  videos: { horizontal: HeroMediaItem[]; vertical: HeroMediaItem[] };
}

export const EMPTY_HERO_MEDIA: HeroMedia = {
  images: { horizontal: [], vertical: [] },
  videos: { horizontal: [], vertical: [] },
};

function isHeroMedia(data: unknown): data is HeroMedia {
  if (!data || typeof data !== 'object') return false;
  const media = data as Partial<HeroMedia>;
  return !!media.images?.horizontal && !!media.images?.vertical
    && !!media.videos?.horizontal && !!media.videos?.vertical;
}

export type ImageFolder = 'gallery' | 'info';

/**
 * Lee el manifiesto de archivos de una carpeta de public/ (gallery o info).
 * public/info incluye imágenes y videos; una carpeta vacía o inexistente
 * devuelve una lista vacía.
 */
export function useFolderMedia(folder: ImageFolder) {
  const [items, setItems] = useState<HeroMediaItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isActive = true;
    setIsLoading(true);

    fetch(`${import.meta.env.BASE_URL}${folder}-media.json`, { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (isActive && Array.isArray(data)) {
          setItems(
            data.filter(
              (item): item is HeroMediaItem =>
                !!item && typeof item.url === 'string' && typeof item.name === 'string'
            )
          );
        }
      })
      .catch(() => {
        // Sin manifiesto se puede seguir usando una URL manual.
      })
      .finally(() => {
        if (isActive) setIsLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [folder]);

  return { items, isLoading };
}

/**
 * Lee el manifiesto de archivos de public/hero (imágenes y videos, en sus
 * variantes horizontal y vertical). Las carpetas vacías llegan como listas
 * vacías para poder ignorarlas en la interfaz.
 */
export function useHeroMedia() {
  const [media, setMedia] = useState<HeroMedia>(EMPTY_HERO_MEDIA);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isActive = true;

    fetch(`${import.meta.env.BASE_URL}hero-media.json`, { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (isActive && isHeroMedia(data)) setMedia(data);
      })
      .catch(() => {
        // Sin manifiesto la sección Hero funciona igual con URLs manuales.
      })
      .finally(() => {
        if (isActive) setIsLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, []);

  return { media, isLoading };
}
