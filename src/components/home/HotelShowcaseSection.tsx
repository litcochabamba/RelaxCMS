import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useHotels, useHotelConfig } from '../../hooks/useQueries';
import Media from '../common/Media';
import MapEmbed from '../common/MapEmbed';
import { resolveMapEmbed } from '../../utils/mapEmbed';
import type { Hotel, HotelConfig } from '../../types';

export interface ShowcaseImageSet {
  id: string;
  images: [string, string]; // [mainImage (top-left), overlappingImage (bottom-right)]
  /**
   * Si el espacio es un mapa, acá va el enlace pegado en el CMS. `null`
   * significa que ese espacio sigue mostrando imagen o video.
   */
  maps?: [string | null, string | null];
}

interface HotelShowcaseSectionProps {
  title?: string;
  description?: string;
  imageSets?: ShowcaseImageSet[];
  intervalMs?: number;
}

export const DEFAULT_INFO_TITLE = 'El hotel más seguro y mejor valorado de Cochabamba.';

export const DEFAULT_INFO_DESCRIPTION = `Su seguridad y comodidad son nuestra prioridad, por lo que nuestro meticuloso proceso de selección garantiza que cada hotel cumpla con estrictos estándares de calidad. Ya sea que nos visite por negocios o por placer, confíe en nosotros para brindarle una estadía que combine la máxima seguridad y un servicio excepcional.\n\nDescubra Cochabamba como nunca antes con nuestra cuidada selección de alojamientos que cuentan con ubicaciones privilegiadas y medidas de seguridad inigualables. Desde encantadores hoteles boutique hasta lujosas opciones en el centro de la ciudad, hemos hecho el trabajo preliminar para presentarle una variedad de opciones que le garantizan una estadía sin preocupaciones.`;

export const DEFAULT_INFO_IMAGE_SETS: ShowcaseImageSet[] = [
  {
    id: 'hotel-1',
    images: [
      'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&q=80',
      'https://images.unsplash.com/photo-1582719508461-905c673771fd?w=600&q=80',
    ],
    maps: [null, null],
  },
  {
    id: 'hotel-2',
    images: [
      'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=800&q=80',
      'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=600&q=80',
    ],
    maps: [null, null],
  },
];

/**
 * Lee los conjuntos de imágenes guardados como JSON en la configuración.
 * Devuelve null cuando no hay nada válido para usar los valores por defecto.
 */
export function parseInfoImageSets(raw?: string | null): ShowcaseImageSet[] | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;

    const sets = parsed
      .map((entry, index): ShowcaseImageSet | null => {
        if (!entry || typeof entry !== 'object') return null;
        const record = entry as {
          id?: unknown;
          main?: unknown;
          secondary?: unknown;
          mainMap?: unknown;
          secondaryMap?: unknown;
        };
        const main = typeof record.main === 'string' ? record.main.trim() : '';
        const secondary = typeof record.secondary === 'string' ? record.secondary.trim() : '';
        const mainMap = typeof record.mainMap === 'string' ? record.mainMap : null;
        const secondaryMap = typeof record.secondaryMap === 'string' ? record.secondaryMap : null;
        if (!main && !secondary && mainMap === null && secondaryMap === null) return null;
        return {
          id: typeof record.id === 'string' && record.id ? record.id : `info-${index + 1}`,
          images: [main || secondary, secondary || main] as [string, string],
          maps: [mainMap, secondaryMap],
        };
      })
      .filter((set): set is ShowcaseImageSet => set !== null);

    return sets.length > 0 ? sets : null;
  } catch {
    return null;
  }
}

function getConfigValue(configs: HotelConfig[], key: string): string {
  return configs.find((config) => config.key === key)?.value || '';
}

/** Cada espacio del conjunto puede ser imagen/video o un mapa cargado en el CMS. */
function ShowcaseSlot({ set, slot, alt }: { set: ShowcaseImageSet; slot: 0 | 1; alt: string }) {
  const mapLink = set.maps?.[slot] ?? null;
  // Si el enlace guardado no se puede interpretar, el visitante sigue viendo
  // la imagen del espacio; el aviso de error queda en el CMS.
  if (mapLink && mapLink.trim() && resolveMapEmbed(mapLink)) {
    return <MapEmbed link={mapLink} title={alt} />;
  }
  return <Media src={set.images[slot]} alt={alt} />;
}

export default function HotelShowcaseSection({
  title: titleProp,
  description: descriptionProp,
  imageSets: imageSetsProp,
  intervalMs = 7000,
}: HotelShowcaseSectionProps) {
  const { data: hotels } = useHotels();
  const hotelList = (Array.isArray(hotels) ? hotels : []) as Hotel[];
  const hotelId = hotelList[0]?.id || '';
  const { data: configsData } = useHotelConfig(hotelId);
  const configs = (Array.isArray(configsData) ? configsData : []) as HotelConfig[];

  const title = titleProp || getConfigValue(configs, 'info_title') || DEFAULT_INFO_TITLE;
  const description = descriptionProp || getConfigValue(configs, 'info_description') || DEFAULT_INFO_DESCRIPTION;
  const imageSets =
    imageSetsProp || parseInfoImageSets(getConfigValue(configs, 'info_image_sets')) || DEFAULT_INFO_IMAGE_SETS;

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const nextSlide = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % imageSets.length);
  }, [imageSets.length]);

  useEffect(() => {
    if (isPaused || imageSets.length <= 1) return;
    const timer = setInterval(nextSlide, intervalMs);
    return () => clearInterval(timer);
  }, [isPaused, nextSlide, intervalMs, imageSets.length]);

  // Si cambian los conjuntos desde el panel, evitamos un índice fuera de rango.
  useEffect(() => {
    if (currentIndex >= imageSets.length) setCurrentIndex(0);
  }, [currentIndex, imageSets.length]);

  const currentSet = imageSets[Math.min(currentIndex, imageSets.length - 1)];

  return (
    <section className="pt-24 pb-12 lg:pt-32 lg:pb-16 bg-white overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 lg:px-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-20 items-center">
          {/* Left: Overlapping Images Carousel */}
          <div
            className="relative w-full aspect-[4/3] min-h-[420px]"
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={currentSet.id}
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.02 }}
                transition={{ duration: 0.7, ease: 'easeInOut' }}
                className="absolute inset-0"
              >
                {/* Contenido principal (arriba a la izquierda, más grande) */}
                <div className="absolute top-0 left-0 w-[70%] h-[85%] rounded-2xl overflow-hidden shadow-xl">
                  <ShowcaseSlot
                    set={currentSet}
                    slot={0}
                    alt="Contenido principal de la sección"
                  />
                </div>

                {/* Contenido secundario (abajo a la derecha, superpuesto) */}
                <div className="absolute bottom-0 right-0 w-[58%] h-[65%] rounded-2xl overflow-hidden shadow-2xl border-4 border-white">
                  <ShowcaseSlot
                    set={currentSet}
                    slot={1}
                    alt="Contenido secundario de la sección"
                  />
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Dots navigation */}
            {imageSets.length > 1 && (
              <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 flex gap-2.5 z-10">
                {imageSets.map((set, i) => (
                  <button
                    key={set.id}
                    onClick={() => setCurrentIndex(i)}
                    className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                      i === currentIndex
                        ? 'bg-gray-900 w-7'
                        : 'bg-gray-300 hover:bg-gray-400'
                    }`}
                    aria-label={`Ver imágenes del set ${i + 1}`}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Right: Text content */}
          <div className="relative">
            {/* Decorative palm */}
            <div className="absolute -right-8 top-0 opacity-[0.06] pointer-events-none select-none">
              <svg width="120" height="200" viewBox="0 0 120 200" fill="currentColor" className="text-gray-900">
                <path d="M60 200V80M60 80C50 50 20 30 5 40c15-5 30 0 40 15M60 80c10-30 40-50 55-40-15-5-30 0-40 15M60 100c-15-25-45-35-60-25 15 0 30 10 40 25M60 100c15-25 45-35 60-25-15 0-30 10-40 25M60 120c-10-15-30-20-45-12 10 5 20 12 30 20M60 120c10-15 30-20 45-12-10 5-20 12-30 20" strokeWidth="1.5" stroke="currentColor" fill="none"/>
              </svg>
            </div>

            <h2 className="text-4xl lg:text-5xl xl:text-6xl font-serif text-gray-900 leading-[1.1] mb-8">
              {title}
            </h2>

            <div className="space-y-5">
              {description.split('\n\n').filter(Boolean).map((paragraph, i) => (
                <p key={i} className="text-gray-500 leading-relaxed text-base lg:text-lg">
                  {paragraph}
                </p>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
