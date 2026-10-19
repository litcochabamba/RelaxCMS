import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useIntersectionObserver } from '../../hooks/useUtils';
import { useHotels, useRoomTypes, useRoomUnits, useHotelConfig } from '../../hooks/useQueries';
import { Loader2 } from 'lucide-react';
import type { Hotel, HotelConfig, RoomTypeInventory, RoomUnit } from '../../types';

// Icon mapping for room amenities/services
import {
  Wifi,
  Tv,
  Snowflake,
  Wind,
  Bath,
  ShowerHead,
  Coffee,
  UtensilsCrossed,
  Waves,
  Sparkles,
  Dumbbell,
  Car,
  Shirt,
  BedDouble,
  Flame,
  Phone,
  Lock,
  Zap,
  Droplets,
  Sun,
  Eye,
  Headphones,
  Volume2,
  Music,
  Wine,
  Sandwich,
  CakeSlice,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const amenityIconMap: Record<string, LucideIcon> = {
  wifi: Wifi,
  tv: Tv,
  televisor: Tv,
  aire: Snowflake,
  'aire acondicionado': Snowflake,
  ac: Snowflake,
  ventilador: Wind,
  baño: Bath,
  ducha: ShowerHead,
  'ducha caliente': ShowerHead,
  café: Coffee,
  cafetera: Coffee,
  'minibar': Sandwich,
  restaurante: UtensilsCrossed,
  piscina: Waves,
  alberca: Waves,
  spa: Sparkles,
  gimnasio: Dumbbell,
  estacionamiento: Car,
  parking: Car,
  lavandería: Shirt,
  cama: BedDouble,
  'sábanas': BedDouble,
  calefacción: Flame,
  teléfono: Phone,
  seguridad: Lock,
  'caja fuerte': Lock,
  toallas: Droplets,
  secador: Sun,
  espejo: Eye,
  'aire fresco': Wind,
  música: Music,
  vino: Wine,
  desayuno: Coffee,
  pastelería: CakeSlice,
};

const PLACEHOLDER_IMAGES = [
  'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=600&q=80',
  'https://images.unsplash.com/photo-1590490360182-c33d57733427?w=600&q=80',
  'https://images.unsplash.com/photo-1584132967334-10e028bd69f7?w=600&q=80',
  'https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=600&q=80',
  'https://images.unsplash.com/photo-1566665797739-1674de7a421a?w=600&q=80',
  'https://images.unsplash.com/photo-1578683010236-d716f9a3f461?w=600&q=80',
];

function getConfigValue(configs: any[], key: string, fallback: string): string {
  const item = configs.find(c => c.key === key);
  return item?.value || fallback;
}

function getAmenityIcon(name: string): LucideIcon {
  const lower = name.toLowerCase().trim();
  if (amenityIconMap[lower]) return amenityIconMap[lower];
  // Partial match
  for (const [key, icon] of Object.entries(amenityIconMap)) {
    if (lower.includes(key) || key.includes(lower)) return icon;
  }
  return Sparkles;
}

export default function RoomsSection() {
  const { ref, isVisible } = useIntersectionObserver();

  const { data: hotelsData } = useHotels();
  const hotels = (Array.isArray(hotelsData) ? hotelsData : []) as Hotel[];
  const hotelId = hotels[0]?.id || '';

  const { data: typesData = [], isLoading: typesLoading } = useRoomTypes(hotelId);
  const { data: unitsData = [] } = useRoomUnits(hotelId);
  const { data: configsData = [] } = useHotelConfig(hotelId);
  const types = (Array.isArray(typesData) ? typesData : []) as RoomTypeInventory[];
  const units = (Array.isArray(unitsData) ? unitsData : []) as RoomUnit[];
  const configs = (Array.isArray(configsData) ? configsData : []) as HotelConfig[];

  // Solo los tipos que tienen unidades reales, en el orden definido en el CMS.
  const availableTypes = useMemo(
    () => types.filter(type => units.some(unit => unit.tipo_id === type.id)),
    [types, units]
  );

  // Cuántas tarjetas de tipo se muestran en Inicio (configurable en el CMS).
  const visibleCount = useMemo(() => {
    const raw = parseInt(getConfigValue(configs, 'rooms_count', '5'), 10);
    if (!Number.isFinite(raw)) return 5;
    return Math.min(Math.max(raw, 1), Math.max(availableTypes.length, 1));
  }, [configs, availableTypes.length]);

  const displayRooms = useMemo(() => {
    return availableTypes.slice(0, visibleCount).map(type => {
      const typeUnits = units.filter(unit => unit.tipo_id === type.id);
      const amenityCounts = new Map<string, number>();
      typeUnits.forEach(unit =>
        (unit.amenities || []).forEach(amenity =>
          amenityCounts.set(amenity, (amenityCounts.get(amenity) || 0) + 1)
        )
      );
      return {
        id: type.id,
        name: type.name,
        description: type.description,
        price: type.price,
        image_url: type.image_url,
        groupLabel: type.grupo === 'departamento' ? 'Departamento' : 'Habitación',
        unitCount: typeUnits.length,
        capacity: type.max_capacity || type.min_capacity || null,
        amenities: [...amenityCounts.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 4)
          .map(([amenity]) => amenity),
      };
    });
  }, [availableTypes, units, visibleCount]);

  // Collect all unique amenities across displayed rooms for icon display
  const getRoomIcons = useMemo(() => {
    return (room: any) => {
      const allItems = [...(room.amenities || []), ...(room.services || [])];
      const unique = [...new Set(allItems)].slice(0, 7);
      return unique.map((item: string) => ({
        name: item,
        Icon: getAmenityIcon(item),
      }));
    };
  }, []);

  // Cinta "Ver todas las habitaciones" (color configurable en el CMS).
  const ctaColor = getConfigValue(configs, 'rooms_cta_color', '#D4AF37');
  const ctaTextColor = getConfigValue(configs, 'rooms_cta_text_color', '#1a1a2e');

  const isLoading = typesLoading;
  // Even without hotelId, render the section header so it's always visible
  const hasData = !!hotelId && displayRooms.length > 0;

  return (
    <section id="habitaciones" className="py-12 lg:py-16 bg-white">
      <div className="container-wide" ref={ref}>
        {/* Header — always visible */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isVisible ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8 }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-serif text-gray-900 mb-6">
            {getConfigValue(configs, 'rooms_title', 'Habitaciones & Departamentos')}
          </h2>
          <p className="text-gray-600 text-lg max-w-2xl mx-auto">
            {getConfigValue(configs, 'rooms_description', 'Descubre nuestras habitaciones diseñadas para ofrecerte la máxima comodidad y una experiencia inolvidable. Cada espacio ha sido cuidadosamente decorado para tu disfrute.')}
          </p>
        </motion.div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="animate-spin h-8 w-8 text-gray-400" />
            <span className="ml-3 text-gray-500">Cargando habitaciones...</span>
          </div>
        ) : hasData ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 lg:gap-10">
            {displayRooms.map((room, index) => {
              const icons = getRoomIcons(room);
              const imageUrl = room.image_url || PLACEHOLDER_IMAGES[index % PLACEHOLDER_IMAGES.length];

              return (
                <motion.div
                  key={room.id}
                  initial={{ opacity: 0, y: 40 }}
                  animate={isVisible ? { opacity: 1, y: 0 } : {}}
                  transition={{ duration: 0.6, delay: 0.2 + index * 0.15 }}
                  className="group"
                >
                  {/* Image */}
                  <div className="relative aspect-[4/3] overflow-hidden rounded-2xl mb-6">
                    <img
                      src={imageUrl}
                      alt={room.name}
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                      loading="lazy"
                    />
                    {/* Price badge */}
                    {room.price ? (
                      <div className="absolute bottom-4 right-4 bg-white/95 backdrop-blur-sm px-4 py-2 rounded-xl shadow-lg">
                        <span className="text-lg font-bold text-gray-900">Bs. {room.price}</span>
                        <span className="text-xs text-gray-500 ml-1">/noche</span>
                      </div>
                    ) : null}
                  </div>

                  {/* Content */}
                  <div className="px-1">
                    {/* Grupo + unidades reales */}
                    <span className="inline-block text-xs font-medium tracking-widest uppercase text-gray-400 mb-2">
                      {room.groupLabel} · {room.unitCount} {room.unitCount === 1 ? 'unidad' : 'unidades'}
                      {room.capacity ? ` · hasta ${room.capacity} personas` : ''}
                    </span>

                    {/* Room name */}
                    <h3 className="text-2xl font-serif font-semibold text-gray-900 mb-3">
                      {room.name}
                    </h3>

                    {/* Description */}
                    <p className="text-gray-500 text-sm leading-relaxed mb-5 line-clamp-2">
                      {room.description || 'Una habitación cómoda y elegante, diseñada para tu máximo confort y descanso.'}
                    </p>

                    {/* Amenity icons */}
                    {icons.length > 0 && (
                      <div className="flex items-center gap-4 pt-4 border-t border-gray-100">
                        {icons.map(({ name, Icon }, i) => (
                          <div
                            key={`${name}-${i}`}
                            className="group/icon relative"
                            title={name}
                          >
                            <Icon className="w-5 h-5 text-amber-700/70 hover:text-amber-700 transition-colors" />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        ) : (
          /* Fallback when no rooms data */
          <div className="text-center py-16">
            <p className="text-gray-400 text-lg">Próximamente mostrar nuestras habitaciones disponibles.</p>
          </div>
        )}

      </div>

      {/* Cinta "Ver todas las habitaciones": ancho completo del viewport */}
      {displayRooms.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={isVisible ? { opacity: 1 } : {}}
          transition={{ duration: 0.6, delay: 0.8 }}
          className="mt-14 w-full"
        >
          <Link
            to="/galeria"
            style={{ backgroundColor: ctaColor, color: ctaTextColor }}
            className="flex w-full items-center justify-center px-6 py-4 text-sm font-semibold uppercase tracking-[0.25em] transition-opacity duration-300 hover:opacity-90"
          >
            Ver todas las habitaciones
          </Link>
        </motion.div>
      )}
    </section>
  );
}
