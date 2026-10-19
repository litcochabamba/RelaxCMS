import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useIntersectionObserver } from '../../hooks/useUtils';
import { useHotels, useAmenities, useHotelConfig } from '../../hooks/useQueries';
import { Loader2 } from 'lucide-react';
import { getAmenityIcon } from '../../utils/amenityIcons';
import type { Amenity, Hotel } from '../../types';

/**
 * Configuración de los grupos de amenidades guardada en
 * `configuracion_hotel.amenities_groups`: el orden del arreglo es el orden en
 * la portada y `visible` decide si el grupo se muestra.
 */
export interface AmenityGroupConfig {
  category: string;
  visible: boolean;
}

const DEFAULT_TITLE = 'Amenidades';
const DEFAULT_DESCRIPTION =
  'Todo lo que necesitas para una estancia perfecta. Disfruta de nuestras instalaciones y servicios diseñados para tu comodidad.';

const FALLBACK_AMENITIES: Array<Pick<Amenity, 'name' | 'description' | 'icon'>> = [
  { icon: 'Wifi', name: 'Wi-Fi Gratuito', description: 'Conexión de alta velocidad en todas las áreas del hotel.' },
  { icon: 'Waves', name: 'Piscina', description: 'Disfruta de nuestra piscina con vista panorámica.' },
  { icon: 'Sparkles', name: 'Spa & Bienestar', description: 'Relájate con nuestros tratamientos de masaje y bienestar.' },
  { icon: 'UtensilsCrossed', name: 'Restaurante', description: 'Cocina gourmet con ingredientes locales frescos.' },
  { icon: 'Dumbbell', name: 'Gimnasio', description: 'Equipamiento moderno para tu rutina de ejercicios.' },
  { icon: 'Car', name: 'Estacionamiento', description: 'Estacionamiento privado y seguro para huéspedes.' },
];

export function parseAmenityGroups(value?: string | null): AmenityGroupConfig[] | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return null;
    const groups = parsed
      .filter(
        (item): item is { category: string; visible?: boolean } =>
          !!item && typeof item === 'object' && typeof (item as { category?: unknown }).category === 'string'
      )
      .map((item) => ({ category: item.category.trim(), visible: item.visible !== false }))
      .filter((item) => item.category !== '');
    return groups.length > 0 ? groups : null;
  } catch {
    return null;
  }
}

export function serializeAmenityGroups(groups: AmenityGroupConfig[]): string {
  return JSON.stringify(groups.map((group) => ({ category: group.category, visible: group.visible })));
}

function getConfigValue(configs: Array<{ key: string; value: string }>, key: string, fallback: string): string {
  const item = configs.find((config) => config.key === key);
  return item?.value || fallback;
}

interface AmenityCardProps {
  name: string;
  description?: string | null;
  icon?: string | null;
  imageUrl?: string | null;
  delay: number;
  isVisible: boolean;
}

// Card rectangular con el icono sobresaliendo por el borde superior. Si la
// amenidad tiene foto, la foto ocupa el ancho de la card y el texto va debajo.
function AmenityCard({ name, description, icon, imageUrl, delay, isVisible }: AmenityCardProps) {
  const Icon = getAmenityIcon(icon);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={isVisible ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay }}
      className="group relative rounded-2xl border border-gray-200/80 bg-white px-6 pb-6 pt-9 shadow-[0_2px_10px_rgba(15,23,42,0.04)] transition-all duration-300 hover:-translate-y-1 hover:border-gray-300 hover:shadow-[0_20px_40px_-24px_rgba(15,23,42,0.45)]"
    >
      <span className="absolute -top-5 left-6 z-10 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gray-900 text-white shadow-lg shadow-gray-900/25 ring-4 ring-white transition-colors duration-300 group-hover:bg-gray-700">
        <Icon className="h-5 w-5" strokeWidth={1.6} />
      </span>
      {imageUrl ? (
        <div className="-mx-6 -mt-9 mb-4 overflow-hidden rounded-t-2xl bg-gray-100">
          <img
            src={imageUrl}
            alt={name}
            loading="lazy"
            className="aspect-[16/9] w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        </div>
      ) : null}
      <h4 className="mb-1.5 text-base font-semibold leading-snug text-gray-900">{name}</h4>
      {description ? (
        <p className="text-sm leading-relaxed text-gray-500">{description}</p>
      ) : null}
    </motion.div>
  );
}

export default function AmenitiesSection() {
  const { ref, isVisible } = useIntersectionObserver();

  const { data: hotels } = useHotels();
  const hotelId = (hotels as Hotel[] | null)?.[0]?.id || '';

  const { data: amenitiesData = [], isLoading } = useAmenities(hotelId);
  const amenities = (Array.isArray(amenitiesData) ? amenitiesData : []) as Amenity[];
  const { data: configsData = [] } = useHotelConfig(hotelId);
  const configs = (Array.isArray(configsData) ? configsData : []) as Array<{ key: string; value: string }>;

  const groupsConfig = getConfigValue(configs, 'amenities_groups', '');

  // Grupos en el orden configurado; los que existan en la base pero no en la
  // configuración se agregan al final y visibles, para no ocultar contenido.
  const groups = useMemo(() => {
    const categories = [...new Set(amenities.map((amenity) => amenity.category).filter(Boolean))];
    const configured = parseAmenityGroups(groupsConfig) || [];
    const ordered: AmenityGroupConfig[] = configured.filter((group) => categories.includes(group.category));
    categories.forEach((category) => {
      if (!ordered.some((group) => group.category === category)) {
        ordered.push({ category, visible: true });
      }
    });
    return ordered;
  }, [amenities, groupsConfig]);

  const visibleGroups = groups.filter((group) => group.visible);

  return (
    <section className="py-12 lg:py-16 bg-gray-50">
      <div className="container-wide" ref={ref}>
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isVisible ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8 }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-serif text-gray-900 mb-6">
            {getConfigValue(configs, 'amenities_title', DEFAULT_TITLE)}
          </h2>
          <p className="text-gray-600 text-lg max-w-2xl mx-auto">
            {getConfigValue(configs, 'amenities_description', DEFAULT_DESCRIPTION)}
          </p>
        </motion.div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="animate-spin h-8 w-8 text-gray-400" />
            <span className="ml-3 text-gray-500">Cargando amenidades...</span>
          </div>
        ) : amenities.length === 0 ? (
          /* Fallback amenities when DB is empty */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-10">
            {FALLBACK_AMENITIES.map((item, index) => (
              <AmenityCard
                key={item.name}
                name={item.name}
                description={item.description}
                icon={item.icon}
                delay={index * 0.05}
                isVisible={isVisible}
              />
            ))}
          </div>
        ) : (
          visibleGroups.map((group, groupIndex) => {
            const items = amenities.filter((amenity) => amenity.category === group.category);
            if (items.length === 0) return null;

            return (
              <div key={group.category} className="mb-16 last:mb-0">
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={isVisible ? { opacity: 1, x: 0 } : {}}
                  transition={{ duration: 0.6, delay: groupIndex * 0.1 }}
                  className="mb-8 flex items-center gap-4"
                >
                  <h3 className="text-xl font-semibold tracking-tight text-gray-900">{group.category}</h3>
                  <span className="h-px flex-1 bg-gray-200" />
                  <span className="text-[11px] uppercase tracking-[0.25em] text-gray-400">
                    {items.length} {items.length === 1 ? 'detalle' : 'detalles'}
                  </span>
                </motion.div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-10">
                  {items.map((amenity, index) => (
                    <AmenityCard
                      key={amenity.id}
                      name={amenity.name}
                      description={amenity.description}
                      icon={amenity.icon}
                      imageUrl={amenity.image_url}
                      delay={groupIndex * 0.1 + index * 0.05}
                      isVisible={isVisible}
                    />
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
