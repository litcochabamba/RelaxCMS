import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, Loader2, MapPin } from 'lucide-react';
import { useIntersectionObserver } from '../../hooks/useUtils';
import { useAttractionsWithImages, useHotelConfig, useHotels } from '../../hooks/useQueries';
import {
  findAttractionFolder,
  inferMediaType,
  isUploadedMedia,
  useAttractionsMedia,
  type AttractionMediaFile,
  type AttractionMediaFolder,
} from '../../hooks/useAttractionsMedia';
import AttractionMap from './AttractionMap';
import type { Attraction, AttractionImage, Hotel } from '../../types';

const DEMO_MEDIA = 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920&q=80';

interface SectionAttraction extends Attraction {
  media: AttractionMediaFile[];
}

interface AttractionLike extends Omit<Attraction, 'images'> {
  images?: AttractionImage[];
}

const fallbackAttractions: Array<
  Pick<Attraction, 'id' | 'title' | 'description' | 'location' | 'latitude' | 'longitude'> & {
    media: AttractionMediaFile[];
  }
> = [
  {
    id: '1',
    title: 'Cristo de la Concordia',
    description:
      'El Cristo de la Concordia es una estatua de Jesús ubicada en el cerro San Pedro, en la ciudad de Cochabamba, Bolivia. Con 34,20 metros de altura, es una de las estatuas de Jesús más grandes del mundo.',
    location: 'Cerro San Pedro, Cochabamba',
    latitude: -17.3843,
    longitude: -66.135,
    media: [{ name: 'cristo.jpg', url: DEMO_MEDIA, type: 'image' }],
  },
  {
    id: '2',
    title: 'Laguna Alalay',
    description:
      'La Laguna Alalay es un cuerpo de agua natural ubicado en el centro de Cochabamba. Es un espacio ideal para paseos, deportes y observación de aves.',
    location: 'Centro de Cochabamba',
    latitude: -17.4081,
    longitude: -66.139,
    media: [{ name: 'alalay.jpg', url: DEMO_MEDIA, type: 'image' }],
  },
];

function getConfigValue(configs: Array<{ key: string; value: string }>, key: string, fallback: string): string {
  const item = configs.find((config) => config.key === key);
  return item?.value || fallback;
}

function clampNumber(value: string | undefined, fallback: number, min: number, max: number): number {
  const parsed = Number.parseFloat(value ?? '');
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '').trim();
  const full = clean.length === 3 ? clean.split('').map((char) => char + char).join('') : clean;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return [255, 255, 255];
  return [
    Number.parseInt(full.slice(0, 2), 16),
    Number.parseInt(full.slice(2, 4), 16),
    Number.parseInt(full.slice(4, 6), 16),
  ];
}

const DEFAULT_ROTATION_SECONDS = 6;
const MIN_ROTATION_SECONDS = 3;
const MAX_ROTATION_SECONDS = 30;

function clampRotation(value?: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_ROTATION_SECONDS;
  return Math.min(MAX_ROTATION_SECONDS, Math.max(MIN_ROTATION_SECONDS, Math.round(value)));
}

function parseDurations(value?: string | null): Record<string, number> {
  if (!value) return {};
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>)
        .map(([id, seconds]) => [id, Number(seconds)] as const)
        .filter(([, seconds]) => Number.isFinite(seconds) && seconds > 0)
    );
  } catch {
    return {};
  }
}

function parseFolderOverrides(value?: string | null): Record<string, string> {
  if (!value) return {};
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>)
        .filter(([, folder]) => typeof folder === 'string' && folder.trim() !== '')
        .map(([id, folder]) => [id, String(folder).trim()])
    );
  } catch {
    return {};
  }
}

function resolveMedia(
  attraction: AttractionLike,
  folders: AttractionMediaFolder[],
  overrides: Record<string, string>
): AttractionMediaFile[] {
  const dbMedia: AttractionMediaFile[] = (attraction.images || [])
    .map((image) => image?.image_url)
    .filter((url): url is string => typeof url === 'string' && url !== '')
    .map((url, index) => ({
      name: `medio-${index + 1}`,
      url,
      type: inferMediaType(url),
    }));

  // Lo subido desde el CMS manda: reemplaza la carpeta del proyecto. Las filas
  // antiguas con URLs externas no pisan las fotos curadas de public/atractivos.
  const uploaded = dbMedia.filter((file) => isUploadedMedia(file.url));
  if (uploaded.length > 0) return uploaded;

  const folder = findAttractionFolder(folders, attraction.title, overrides[attraction.id]);
  if (folder && folder.files.length > 0) return folder.files;

  if (dbMedia.length > 0) return dbMedia;
  return [{ name: 'demo', url: DEMO_MEDIA, type: 'image' }];
}

export default function AttractionsSection() {
  const { ref, isVisible } = useIntersectionObserver();
  const [activeAttraction, setActiveAttraction] = useState(0);
  const [activeMedia, setActiveMedia] = useState(0);
  const listRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const { data: hotels } = useHotels();
  const hotelId = (hotels as Hotel[] | null)?.[0]?.id || '';
  const { data: dbAttractions = [], isLoading } = useAttractionsWithImages(hotelId);
  const { data: configsData = [] } = useHotelConfig(hotelId);
  const { folders } = useAttractionsMedia();

  const configs = (Array.isArray(configsData) ? configsData : []) as Array<{ key: string; value: string }>;

  const cardColor = getConfigValue(configs, 'attractions_card_color', '#ffffff');
  const cardOpacity = clampNumber(getConfigValue(configs, 'attractions_card_opacity', '82'), 82, 0, 100);
  const cardBlur = clampNumber(getConfigValue(configs, 'attractions_card_blur', '12'), 12, 0, 40);
  const folderOverridesValue = getConfigValue(configs, 'attractions_media_folders', '');
  const folderOverrides = useMemo(
    () => parseFolderOverrides(folderOverridesValue),
    [folderOverridesValue]
  );
  const durationsValue = getConfigValue(configs, 'attractions_durations', '');
  const durations = useMemo(() => parseDurations(durationsValue), [durationsValue]);

  const attractions: SectionAttraction[] = useMemo(() => {
    const rows = (Array.isArray(dbAttractions) ? dbAttractions : []) as AttractionLike[];
    if (rows.length === 0) {
      return fallbackAttractions.map((item) => ({
        ...item,
        hotel_id: hotelId,
        order: 0,
        active: true,
        created_at: '',
        updated_at: '',
      }));
    }
    return rows.map((row) => ({
      ...row,
      media: resolveMedia(row, folders, folderOverrides),
    })) as SectionAttraction[];
  }, [dbAttractions, folders, folderOverrides, hotelId]);

  const attraction = attractions[activeAttraction] || attractions[0];
  const media = attraction?.media || [];

  // Si hay video en la carpeta del atractivo, se usa como fondo fijo; si no,
  // se rotan las imágenes del atractivo.
  const backgroundVideo = useMemo(() => media.find((file) => file.type === 'video'), [media]);
  const images = useMemo(() => media.filter((file) => file.type === 'image'), [media]);
  const posterImage = images[0]?.url;

  const activeFile = backgroundVideo || images[activeMedia % Math.max(images.length, 1)];

  // Duración propia de cada atractivo; mismo criterio que el hero.
  const rotationSeconds = clampRotation(attraction ? durations[attraction.id] : undefined);

  useEffect(() => {
    setActiveMedia(0);
  }, [activeAttraction]);

  // Mantiene visible el atractivo activo dentro del panel derecho.
  useEffect(() => {
    const list = listRef.current;
    const item = attraction ? itemRefs.current[attraction.id] : null;
    if (!list || !item) return;
    const listRect = list.getBoundingClientRect();
    const itemRect = item.getBoundingClientRect();
    if (itemRect.top < listRect.top) list.scrollTop -= listRect.top - itemRect.top + 8;
    else if (itemRect.bottom > listRect.bottom) list.scrollTop += itemRect.top - listRect.top - 8;
  }, [attraction?.id]);

  useEffect(() => {
    if (backgroundVideo || images.length < 2) return;
    const interval = setInterval(
      () => setActiveMedia((prev) => (prev + 1) % images.length),
      rotationSeconds * 1000
    );
    return () => clearInterval(interval);
  }, [backgroundVideo, images.length, activeAttraction, rotationSeconds]);

  const [r, g, b] = hexToRgb(cardColor);
  const cardStyle = {
    backgroundColor: `rgba(${r}, ${g}, ${b}, ${cardOpacity / 100})`,
    backdropFilter: cardBlur > 0 ? `blur(${cardBlur}px)` : undefined,
    WebkitBackdropFilter: cardBlur > 0 ? `blur(${cardBlur}px)` : undefined,
  } as React.CSSProperties;

  return (
    <section className="relative isolate overflow-hidden py-20 lg:py-28">
      {/* Fondo: medio del atractivo activo, cubriendo toda la sección */}
      <div className="absolute inset-0 -z-10 bg-gray-900">
        <AnimatePresence mode="sync">
          {activeFile ? (
            <motion.div
              key={`${attraction?.id}-${backgroundVideo ? 'video' : activeFile.url}`}
              initial={{ opacity: 0, scale: 1.04 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.9, ease: 'easeInOut' }}
              className="absolute inset-0"
            >
              {backgroundVideo ? (
                <video
                  key={backgroundVideo.url}
                  className="h-full w-full object-cover"
                  autoPlay
                  muted
                  loop
                  playsInline
                  preload="metadata"
                  poster={posterImage}
                >
                  <source src={backgroundVideo.url} type="video/mp4" />
                </video>
              ) : (
                <div
                  className="h-full w-full bg-cover bg-center"
                  style={{ backgroundImage: `url(${activeFile.url})` }}
                />
              )}
            </motion.div>
          ) : null}
        </AnimatePresence>
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-black/20" />
      </div>

      <div className="container-wide relative" ref={ref}>
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(300px,380px)] lg:items-stretch lg:gap-6">
          {/* Columna izquierda: encabezado arriba y la imagen libre debajo */}
          <div className="flex flex-col gap-6 lg:min-h-[620px]">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={isVisible ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.8 }}
              className="rounded-3xl border border-white/40 p-6 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.65)] sm:p-8 lg:p-10"
              style={cardStyle}
            >
              <h2 className="mb-4 font-serif text-3xl text-gray-900 sm:text-4xl lg:text-5xl">
                {getConfigValue(configs, 'attractions_title', 'Atractivos Turísticos')}
              </h2>
              <p className="text-base leading-relaxed text-gray-700 sm:text-lg">
                {getConfigValue(
                  configs,
                  'attractions_description',
                  'Pasa tus mejores momentos visitando los hermosos atractivos turísticos que Cochabamba tiene para ti y recupera energías hospedándote en nuestros hoteles. Será un placer recibirte.'
                )}
              </p>
            </motion.div>

            {/* Mapa del atractivo activo: reutiliza la ubicación y el pin */}
            <AttractionMap
              title={attraction?.title || ''}
              location={attraction?.location}
              latitude={attraction?.latitude}
              longitude={attraction?.longitude}
              className="min-h-[200px] flex-1 sm:min-h-[230px]"
            />

          </div>

          {/* Panel derecho: nombre y descripción de cada atractivo, con scroll propio */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={isVisible ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8, delay: 0.1 }}
            className="flex max-h-[560px] flex-col overflow-hidden rounded-3xl border border-white/40 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.65)] lg:max-h-[620px]"
            style={cardStyle}
          >
            <div className="flex items-center justify-between gap-3 border-b border-gray-900/10 px-5 py-4">
              <p className="text-[11px] font-medium uppercase tracking-[0.25em] text-gray-600">
                Atractivos
              </p>
              {attractions.length > 1 ? (
                <span className="text-[11px] text-gray-500">
                  {activeAttraction + 1} / {attractions.length}
                </span>
              ) : null}
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-16 text-gray-700">
                <Loader2 className="h-6 w-6 animate-spin" />
                <span className="ml-3 text-sm">Cargando atractivos...</span>
              </div>
            ) : (
              <div
                ref={listRef}
                className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain p-3 [scrollbar-color:rgba(17,24,39,0.35)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-900/35 [&::-webkit-scrollbar-track]:bg-transparent"
              >
                {attractions.map((item, index) => {
                  const isActive = index === activeAttraction;
                  return (
                    <button
                      key={item.id}
                      ref={(node) => {
                        itemRefs.current[item.id] = node;
                      }}
                      type="button"
                      onClick={() => setActiveAttraction(index)}
                      aria-current={isActive ? 'true' : undefined}
                      className={`block w-full rounded-2xl px-4 py-3 text-left transition-all duration-300 ${
                        isActive
                          ? 'bg-gray-900 text-white shadow-lg'
                          : 'bg-white/55 text-gray-800 hover:bg-white hover:shadow-sm'
                      }`}
                    >
                      <span className="flex items-start justify-between gap-3">
                        <span className="font-serif text-lg leading-snug">{item.title}</span>
                        <ChevronRight
                          className={`mt-1 h-4 w-4 shrink-0 transition-transform ${
                            isActive ? 'translate-x-0.5 text-white/70' : 'text-gray-400'
                          }`}
                        />
                      </span>
                      {item.description ? (
                        <span
                          className={`mt-1 line-clamp-3 block text-xs leading-relaxed ${
                            isActive ? 'text-white/75' : 'text-gray-600'
                          }`}
                        >
                          {item.description}
                        </span>
                      ) : null}
                      {item.location ? (
                        <span
                          className={`mt-2 flex items-center gap-1.5 text-[11px] ${
                            isActive ? 'text-white/60' : 'text-gray-500'
                          }`}
                        >
                          <MapPin className="h-3 w-3 shrink-0" strokeWidth={1.6} />
                          <span className="truncate">{item.location}</span>
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
