import { useEffect, useState } from 'react';

export interface AttractionMediaFile {
  name: string;
  url: string;
  type: 'image' | 'video';
}

export interface AttractionMediaFolder {
  folder: string;
  files: AttractionMediaFile[];
}

const VIDEO_URL_PATTERN = /\.(mp4|webm|ogv|mov|m4v)(\?|#|$)/i;
const UPLOADED_MEDIA_PATTERN = /\/storage\/v1\/object\/public\/media\//i;

/** Indica si la URL corresponde a un archivo subido desde el CMS. */
export function isUploadedMedia(url: string): boolean {
  return UPLOADED_MEDIA_PATTERN.test(url);
}

/** Deduce si un archivo subido desde el CMS es una foto o un video. */
export function inferMediaType(url: string): 'image' | 'video' {
  return VIDEO_URL_PATTERN.test(url.split('?')[0]) ? 'video' : 'image';
}

interface AttractionsMediaManifest {
  folders: AttractionMediaFolder[];
}

const EMPTY_MANIFEST: AttractionsMediaManifest = { folders: [] };

/**
 * Clave para emparejar el nombre de un atractivo con su carpeta de
 * public/atractivos: sin acentos, minúsculas y solo letras y números.
 * "Cañón del Tunki" y "canon_del_tunki" quedan en la misma clave.
 */
export function normalizeMediaKey(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

export function findAttractionFolder(
  folders: AttractionMediaFolder[],
  title: string,
  overrideFolder?: string | null
): AttractionMediaFolder | null {
  if (overrideFolder) {
    const exact = folders.find((entry) => entry.folder === overrideFolder);
    if (exact) return exact;
  }
  if (!title) return null;
  const key = normalizeMediaKey(title);
  return folders.find((entry) => normalizeMediaKey(entry.folder) === key) || null;
}

/** Lee el manifiesto /atractivos-media.json con los medios por atractivo. */
export function useAttractionsMedia() {
  const [manifest, setManifest] = useState<AttractionsMediaManifest>(EMPTY_MANIFEST);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isActive = true;

    fetch(`${import.meta.env.BASE_URL}atractivos-media.json`, { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!isActive || !data || !Array.isArray(data.folders)) return;
        const folders = (data.folders as AttractionMediaFolder[])
          .filter((entry) => entry && typeof entry.folder === 'string' && Array.isArray(entry.files))
          .map((entry) => ({
            folder: entry.folder,
            files: entry.files.filter(
              (file): file is AttractionMediaFile =>
                !!file && typeof file.url === 'string' && (file.type === 'image' || file.type === 'video')
            ),
          }));
        setManifest({ folders });
      })
      .catch(() => {
        // Sin manifiesto se usan las imágenes guardadas en la base.
      })
      .finally(() => {
        if (isActive) setIsLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, []);

  return { folders: manifest.folders, isLoading };
}
