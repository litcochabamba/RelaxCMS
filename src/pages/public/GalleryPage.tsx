import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BedDouble,
  Building2,
  ChevronDown,
  Loader2,
  MapPin,
  Sparkles,
  Users,
} from 'lucide-react';
import { useGallery, useHotelConfig, useHotels, useRoomTypes, useRoomUnits } from '../../hooks/useQueries';
import type { GalleryItem, Hotel, RoomGroup, RoomTypeInventory, RoomUnit } from '../../types';

const SECTIONS: Array<{
  id: RoomGroup;
  label: string;
  singular: string;
  description: string;
  Icon: typeof BedDouble;
}> = [
  {
    id: 'habitacion',
    label: 'Habitaciones',
    singular: 'Habitación',
    description: 'Espacios cómodos pensados para descansar después de un día en Cochabamba.',
    Icon: BedDouble,
  },
  {
    id: 'departamento',
    label: 'Departamentos',
    singular: 'Departamento',
    description: 'Ambientes amplios con capacidad para familias y grupos, con todas las comodidades.',
    Icon: Building2,
  },
];

function getConfigValue(configs: Array<{ key: string; value: string }>, key: string, fallback: string) {
  const item = configs.find((config) => config.key === key);
  return item?.value || fallback;
}

function unitNumber(name: string) {
  return name
    .replace(/^dep\.?\s*/i, '')
    .replace(/^n[.º°]?\s*/i, '')
    .replace(/^\./, '')
    .trim();
}

function formatPrice(price: number | null) {
  if (price === null || price === undefined || price <= 0) return null;
  return `Bs. ${price.toLocaleString('es-BO', { maximumFractionDigits: 0 })}`;
}

function capacityLabel(type: RoomTypeInventory) {
  const min = type.min_capacity;
  const max = type.max_capacity;
  if (!min && !max) return null;
  if (!max || min === max) return `Para ${max || min} personas`;
  return `Para ${min} a ${max} personas`;
}

function unitCountLabel(type: RoomTypeInventory, count: number, singular: string) {
  const plural = singular === 'Habitación' ? 'habitaciones' : 'departamentos';
  return `${count} ${count === 1 ? singular.toLowerCase() : plural}`;
}

interface UnitCardProps {
  unit: RoomUnit;
  singular: string;
  showNumber: boolean;
}

function UnitCard({ unit, singular, showNumber }: UnitCardProps) {
  const number = unitNumber(unit.name);
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold text-gray-900">
          {showNumber && number ? `${singular} ${number}` : singular}
        </p>
        {unit.floor ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-gray-50 px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-gray-500">
            <MapPin className="h-3 w-3" strokeWidth={1.8} />
            {unit.floor}
          </span>
        ) : null}
      </div>

      <p className="mt-1 flex items-center gap-1.5 text-xs text-gray-500">
        <Users className="h-3.5 w-3.5" strokeWidth={1.8} />
        Para {unit.capacity || 1} {unit.capacity === 1 ? 'persona' : 'personas'}
      </p>

      {unit.amenities.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {unit.amenities.map((amenity) => (
            <span
              key={amenity}
              className="rounded-full bg-gray-50 px-2 py-0.5 text-[10px] font-medium text-gray-600"
            >
              {amenity}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

interface TypeCardProps {
  type: RoomTypeInventory;
  units: RoomUnit[];
  singular: string;
  showNumbers: boolean;
  isOpen: boolean;
  onToggle: () => void;
}

function TypeCard({ type, units, singular, showNumbers, isOpen, onToggle }: TypeCardProps) {
  const price = formatPrice(type.price);
  const capacity = capacityLabel(type);
  const features = useMemo(() => {
    const counts = new Map<string, number>();
    units.forEach((unit) =>
      unit.amenities.forEach((amenity) => counts.set(amenity, (counts.get(amenity) || 0) + 1))
    );
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([amenity]) => amenity);
  }, [units]);

  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.45 }}
      className={`overflow-hidden rounded-3xl border bg-white transition-shadow duration-300 ${
        isOpen
          ? 'border-gray-300 shadow-[0_24px_60px_-32px_rgba(15,23,42,0.45)]'
          : 'border-gray-200/80 shadow-[0_2px_12px_rgba(15,23,42,0.04)] hover:shadow-[0_18px_40px_-28px_rgba(15,23,42,0.4)]'
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls={`tipo-${type.id}`}
        className="grid w-full text-left md:grid-cols-[260px_1fr_auto]"
      >
        <div className="relative h-48 overflow-hidden bg-gray-100 md:h-full md:min-h-[190px]">
          {type.image_url ? (
            <img
              src={type.image_url}
              alt={type.name}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-700 hover:scale-105"
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 text-gray-400">
              <BedDouble className="h-8 w-8" strokeWidth={1.4} />
            </div>
          )}
        </div>

        <div className="min-w-0 p-5 sm:p-6">
          <h3 className="font-serif text-2xl text-gray-900">{type.name}</h3>
          {type.description ? (
            <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-gray-500">{type.description}</p>
          ) : null}
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-gray-500">
            {capacity ? (
              <span className="inline-flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" strokeWidth={1.8} />
                {capacity}
              </span>
            ) : null}
            <span>{unitCountLabel(type, units.length, singular)}</span>
          </div>
          {features.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {features.map((feature) => (
                <span
                  key={feature}
                  className="inline-flex items-center gap-1 rounded-full border border-gray-200/80 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-gray-500"
                >
                  <Sparkles className="h-2.5 w-2.5 text-amber-700/60" strokeWidth={2} />
                  {feature}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        <div className="flex items-end justify-between gap-4 border-t border-gray-100 p-5 md:flex-col md:items-end md:border-t-0 sm:p-6">
          <div className="md:text-right">
            {price ? (
              <>
                <p className="text-[10px] uppercase tracking-[0.2em] text-gray-400">Desde</p>
                <p className="font-serif text-xl text-gray-900">{price}</p>
                <p className="text-[10px] uppercase tracking-wider text-gray-400">por noche</p>
              </>
            ) : (
              <p className="text-xs text-gray-400">Consultar tarifa</p>
            )}
          </div>
          <span
            className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition-colors ${
              isOpen ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 text-gray-500'
            }`}
          >
            <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </span>
        </div>
      </button>

      <AnimatePresence initial={false}>
        {isOpen ? (
          <motion.div
            id={`tipo-${type.id}`}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="border-t border-gray-100 bg-gray-50/70 px-4 py-5 sm:px-6">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-[10px] font-medium uppercase tracking-[0.25em] text-gray-500">
                  {showNumbers ? 'Unidades disponibles' : 'Unidades'}
                </p>
                <span className="text-[10px] text-gray-400">
                  {units.length} en total
                </span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {units.map((unit) => (
                  <UnitCard key={unit.id} unit={unit} singular={singular} showNumber={showNumbers} />
                ))}
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.article>
  );
}

export default function GalleryPage() {
  const { data: hotels } = useHotels();
  const hotelList = (Array.isArray(hotels) ? hotels : []) as Hotel[];
  const hotelId = hotelList[0]?.id || '';
  const { data: typesData, isLoading: typesLoading } = useRoomTypes(hotelId);
  const { data: unitsData, isLoading: unitsLoading } = useRoomUnits(hotelId);
  const { data: configsData = [] } = useHotelConfig(hotelId);
  const { data: galleryData } = useGallery(hotelId);

  const types = (Array.isArray(typesData) ? typesData : []) as RoomTypeInventory[];
  const units = (Array.isArray(unitsData) ? unitsData : []) as RoomUnit[];
  const configs = (Array.isArray(configsData) ? configsData : []) as Array<{ key: string; value: string }>;
  const galleryImages = (Array.isArray(galleryData) ? galleryData : []) as GalleryItem[];

  const showNumbers = getConfigValue(configs, 'gallery_unit_numbers', 'show') !== 'hide';
  // Encabezado editable desde el panel flotante (sección «Encabezado»).
  const galleryTitle = getConfigValue(configs, 'gallery_title', 'Galería');
  const galleryDescription = getConfigValue(
    configs,
    'gallery_description',
    'Conoce nuestras habitaciones y departamentos. Elegí un tipo para ver sus unidades disponibles.'
  );
  const [openTypeId, setOpenTypeId] = useState<string | null>(null);
  const isLoading = typesLoading || unitsLoading;

  const unitsByType = useMemo(() => {
    const map = new Map<string, RoomUnit[]>();
    units.forEach((unit) => {
      if (!map.has(unit.tipo_id)) map.set(unit.tipo_id, []);
      map.get(unit.tipo_id)!.push(unit);
    });
    return map;
  }, [units]);

  const sections = useMemo(
    () =>
      SECTIONS.map((section) => ({
        ...section,
        types: types.filter((type) => type.grupo === section.id && (unitsByType.get(type.id)?.length || 0) > 0),
      })).filter((section) => section.types.length > 0),
    [types, unitsByType]
  );

  return (
    <div className="min-h-screen bg-white pt-24 pb-16">
      <div className="container-wide">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-14 text-center"
        >
          <h1 className="mb-6 font-serif text-4xl text-gray-900 md:text-5xl">{galleryTitle}</h1>
          <p className="mx-auto max-w-2xl text-lg text-gray-600">{galleryDescription}</p>
        </motion.div>

        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            <span className="ml-3 text-gray-500">Cargando habitaciones...</span>
          </div>
        ) : sections.length === 0 ? (
          <div className="py-20 text-center">
            <p className="text-lg text-gray-400">Próximamente publicaremos nuestras habitaciones y departamentos.</p>
          </div>
        ) : (
          <div className="space-y-16">
            {sections.map((section) => {
              const totalUnits = section.types.reduce(
                (sum, type) => sum + (unitsByType.get(type.id)?.length || 0),
                0
              );
              return (
                <section key={section.id} id={section.id} className="scroll-mt-28">
                  <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5 }}
                    className="mb-7 flex flex-wrap items-end justify-between gap-4"
                  >
                    <div className="flex items-center gap-4">
                      <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-900 text-white">
                        <section.Icon className="h-5 w-5" strokeWidth={1.6} />
                      </span>
                      <div>
                        <h2 className="font-serif text-3xl text-gray-900">{section.label}</h2>
                        <p className="mt-1 max-w-xl text-sm text-gray-500">{section.description}</p>
                      </div>
                    </div>
                    <span className="rounded-full bg-gray-50 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.2em] text-gray-500">
                      {section.types.length} {section.types.length === 1 ? 'tipo' : 'tipos'} · {totalUnits}{' '}
                      {section.id === 'habitacion' ? 'habitaciones' : 'departamentos'}
                    </span>
                  </motion.div>

                  <div className="space-y-4">
                    {section.types.map((type) => (
                      <TypeCard
                        key={type.id}
                        type={type}
                        units={unitsByType.get(type.id) || []}
                        singular={section.singular}
                        showNumbers={showNumbers}
                        isOpen={openTypeId === type.id}
                        onToggle={() => setOpenTypeId(openTypeId === type.id ? null : type.id)}
                      />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}

        {galleryImages.length > 0 ? (
          <section className="mt-20">
            <div className="mb-7 flex items-end justify-between gap-4">
              <h2 className="font-serif text-3xl text-gray-900">Instalaciones</h2>
              <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-gray-400">
                {galleryImages.length} imágenes
              </span>
            </div>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {galleryImages.map((item, index) => (
                <motion.figure
                  key={item.id}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.04 }}
                  className="group relative aspect-[4/3] overflow-hidden rounded-2xl"
                >
                  <img
                    src={item.image_url}
                    alt={item.alt_text || item.title || 'Imagen de la galería'}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  {item.title || item.category ? (
                    <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/65 to-transparent p-4 text-white">
                      {item.title ? <p className="font-medium">{item.title}</p> : null}
                      {item.category ? <p className="text-xs text-white/70">{item.category}</p> : null}
                    </figcaption>
                  ) : null}
                </motion.figure>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
