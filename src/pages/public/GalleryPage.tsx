import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BedDouble,
  Building2,
  CalendarDays,
  ChevronDown,
  Loader2,
  MapPin,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { bookingApi, clientApi } from '../../api/client';
import { useAuthStore } from '../../store/authStore';
import CountryPhoneInput from '../../components/common/CountryPhoneInput';
import { useCountryCodes } from '../../hooks/useCountryCodes';
import {
  useGallery,
  useHotelConfig,
  useHotels,
  useRoomAvailabilityRanges,
  useRoomTypes,
  useRoomUnits,
} from '../../hooks/useQueries';
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

/** Mismo rótulo con el que se guarda la unidad en `reservas.room_type`. */
function roomUnitLabel(type: RoomTypeInventory, unit: RoomUnit) {
  const prefix = type.grupo === 'departamento' ? 'Departamento' : 'Habitación';
  return `${prefix} ${unitNumber(unit.name)}`.trim();
}

function isoDaysFromNow(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function formatDay(value: string): string {
  const [year, month, day] = value.split('-');
  return year && month && day ? `${day}/${month}/${year}` : value;
}

/** «2026-10-23 → 2026-10-27»: las fechas en que la unidad ya está tomada. */
function rangeLabel(range: { check_in: string; check_out: string }, onlyUpcoming = false) {
  const from = onlyUpcoming && range.check_in ? formatDay(range.check_in) : null;
  return from ? `Ocupada desde el ${from}` : `${formatDay(range.check_in)} → ${formatDay(range.check_out)}`;
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
  /** Fechas en que esta unidad ya está tomada (pendiente o confirmada). */
  occupied: Array<{ check_in: string; check_out: string }>;
  price: number | null;
  onReserve: () => void;
}

function UnitCard({ unit, singular, showNumber, occupied, price, onReserve }: UnitCardProps) {
  const number = unitNumber(unit.name);
  const busy = occupied.length > 0;
  const nextRange = occupied[0] ?? null;

  return (
    <div
      className={`flex h-full flex-col rounded-2xl border p-4 transition-colors ${
        busy
          ? 'border-gray-100 bg-gray-50/70'
          : 'border-gray-100 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <p className={`text-sm font-semibold ${busy ? 'text-gray-600' : 'text-gray-900'}`}>
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

      {/*
       * Ocupación real de estas fechas: las pendientes también bloquean la
       * unidad, igual que en el formulario de reserva. Se muestran las fechas
       * tomadas, nunca quién las reservó.
       */}
      {busy ? (
        <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-amber-50 px-2 py-1.5 text-[11px] leading-snug text-amber-800">
          <CalendarDays className="mt-0.5 h-3 w-3 shrink-0" strokeWidth={1.8} />
          <span>
            {nextRange ? rangeLabel(nextRange) : 'Ocupada'}
            {occupied.length > 1 ? ` · ${occupied.length} estadías` : ''}
          </span>
        </p>
      ) : null}

      <div className="mt-auto pt-4">
        {busy ? (
          <button
            type="button"
            disabled
            className="w-full cursor-not-allowed rounded-lg border border-gray-200 bg-gray-100 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-gray-400"
          >
            No disponible
          </button>
        ) : (
          <button
            type="button"
            onClick={onReserve}
            className="w-full rounded-lg bg-gray-900 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-white transition-colors hover:bg-gray-800"
          >
            Reservar{price ? ` · Bs. ${price.toLocaleString('es-BO', { maximumFractionDigits: 0 })}` : ''}
          </button>
        )}
      </div>
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
  occupiedByUnit: (unit: RoomUnit) => Array<{ check_in: string; check_out: string }>;
  onReserve: (unit: RoomUnit) => void;
}

function TypeCard({
  type,
  units,
  singular,
  showNumbers,
  isOpen,
  onToggle,
  occupiedByUnit,
  onReserve,
}: TypeCardProps) {
  const price = formatPrice(type.price);
  const capacity = capacityLabel(type);
  const freeCount = units.filter((unit) => occupiedByUnit(unit).length === 0).length;
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
        className="grid w-full text-left md:grid-cols-[220px_1fr_auto]"
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
                  {showNumbers ? 'Unidades' : 'Unidades'}
                </p>
                {/*
                 * «3 de 9 libres» dice lo mismo que «6 ocupadas» sin que nadie
                 * tenga que restar, y evita prometer disponibilidad que no hay.
                 */}
                <span className="text-[10px] text-gray-400">
                  {freeCount === units.length
                    ? `${units.length} en total`
                    : `${freeCount} de ${units.length} libres`}
                </span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {units.map((unit) => (
                  <UnitCard
                    key={unit.id}
                    unit={unit}
                    singular={singular}
                    showNumber={showNumbers}
                    occupied={occupiedByUnit(unit)}
                    price={type.price ?? null}
                    onReserve={() => onReserve(unit)}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.article>
  );
}

interface GalleryReservationProps {
  hotelId: string;
  type: RoomTypeInventory;
  unit: RoomUnit;
  onClose: () => void;
}

/**
 * Reserva de una unidad concreta desde la galería.
 *
 * Manda al MISMO endpoint que el formulario de la home
 * (`POST /api/public/reservation`), así que la solicitud bloquea la unidad y
 * genera el aviso de recepción en RelaxPMS por el camino de siempre.
 */
function GalleryReservation({ hotelId, type, unit, onClose }: GalleryReservationProps) {
  const queryClient = useQueryClient();
  const { isAuthenticated, user } = useAuthStore();
  const isClient = isAuthenticated && user?.role === 'client';
  const { data: countries = [] } = useCountryCodes();

  const [checkIn, setCheckIn] = useState(isoDaysFromNow(1));
  const [checkOut, setCheckOut] = useState(isoDaysFromNow(3));
  const [name, setName] = useState('');
  const [countryIso, setCountryIso] = useState('');
  const [countryDial, setCountryDial] = useState('');
  const [phone, setPhone] = useState('');
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const phoneTouched = useRef(false);

  // País por defecto: Bolivia, o el primero configurado por el hotel.
  useEffect(() => {
    if (countryDial || countries.length === 0) return;
    const fallback = countries.find((country) => country.iso === 'BO') || countries[0];
    setCountryIso(fallback.iso);
    setCountryDial(fallback.dial);
  }, [countries, countryDial]);

  // Con sesión de cliente se completa nombre y teléfono; la solicitud queda
  // vinculada a la cuenta, igual que en la home.
  useEffect(() => {
    if (!isClient) return;
    let active = true;
    clientApi.me().then((result) => {
      if (!active || result.error) return;
      const client = (
        result.data as {
          client?: {
            name?: string;
            phone?: string | null;
            country_iso?: string | null;
            country_dial?: string | null;
          };
        } | null
      )?.client;
      if (!client) return;
      setName((current) => current || client.name || '');
      if (phoneTouched.current) return;
      const matched = countries.find(
        (country) =>
          (client.country_iso && country.iso === client.country_iso) ||
          (client.country_dial && country.dial === client.country_dial)
      );
      const dial = client.country_dial || matched?.dial || countryDial;
      const digits = (client.phone || '').replace(/\D/g, '');
      const dialDigits = (dial || '').replace(/\D/g, '');
      if (dial) setCountryDial(dial);
      setCountryIso(client.country_iso || matched?.iso || countryIso);
      setPhone(dialDigits && digits.startsWith(dialDigits) ? digits.slice(dialDigits.length) : digits);
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isClient, countries.length]);

  const unitLabel = roomUnitLabel(type, unit);

  const submit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      if (!hotelId) {
        toast.error('El hotel todavía no está configurado');
        return;
      }
      if (checkOut <= checkIn) {
        toast.error('La fecha de salida debe ser posterior a la de ingreso');
        return;
      }
      if (phone.replace(/\D/g, '').length < 6) {
        toast.error('Ingresá un número de celular válido');
        return;
      }
      setSubmitting(true);
      const { error } = await bookingApi.create({
        hotel_id: hotelId,
        guest_name: name.trim(),
        guest_phone: `${countryDial} ${phone}`.trim(),
        check_in: checkIn,
        check_out: checkOut,
        adults,
        children_count: children,
        room_type: type.name,
        room_unit: unitLabel,
        message: message.trim(),
      });
      setSubmitting(false);
      if (error) {
        toast.error(error);
        // Otra persona pudo tomarla mientras el formulario estaba abierto.
        queryClient.invalidateQueries({ queryKey: ['roomAvailability'] });
        return;
      }
      queryClient.invalidateQueries({ queryKey: ['roomAvailability'] });
      toast.success('Solicitud enviada. El hotel se va a contactar con vos.');
      setSent(true);
    },
    [
      hotelId, checkIn, checkOut, name, countryDial, phone, adults, children, message,
      type.name, unitLabel, queryClient,
    ]
  );

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-6">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-6 shadow-2xl sm:rounded-3xl"
        role="dialog"
        aria-modal="true"
        aria-label={`Reservar ${unitLabel}`}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.25em] text-gray-400">Reservar</p>
            <h3 className="mt-1 font-serif text-2xl text-gray-900">{type.name}</h3>
            <p className="mt-1 text-sm text-gray-500">
              {unitLabel}{unit.floor ? ` · ${unit.floor}` : ''}
              {type.price ? ` · Bs. ${type.price.toLocaleString('es-BO', { maximumFractionDigits: 0 })} por noche` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-full p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {sent ? (
          <div className="mt-6 rounded-2xl border border-green-200 bg-green-50 p-5">
            <p className="text-xs font-medium uppercase tracking-[0.25em] text-green-700">Solicitud recibida</p>
            <p className="mt-2 text-sm text-gray-700">
              Guardamos tu pedido para {unitLabel} del {formatDay(checkIn)} al {formatDay(checkOut)}.
              El hotel va a confirmar la disponibilidad y la unidad queda bloqueada mientras tanto.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-4 w-full rounded-lg bg-gray-900 px-4 py-3 text-sm font-semibold uppercase tracking-wider text-white hover:bg-gray-800"
            >
              Cerrar
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm text-gray-700">
                <span className="mb-2 block font-medium">Fecha ingreso *</span>
                <input
                  type="date"
                  required
                  value={checkIn}
                  min={isoDaysFromNow(0)}
                  onChange={(event) => setCheckIn(event.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-gray-900 focus:border-gray-900 focus:outline-none"
                />
              </label>
              <label className="text-sm text-gray-700">
                <span className="mb-2 block font-medium">Fecha salida *</span>
                <input
                  type="date"
                  required
                  value={checkOut}
                  min={checkIn || isoDaysFromNow(0)}
                  onChange={(event) => setCheckOut(event.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-gray-900 focus:border-gray-900 focus:outline-none"
                />
              </label>
            </div>

            <label className="block text-sm text-gray-700">
              <span className="mb-2 block font-medium">Nombre completo *</span>
              <input
                type="text"
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Tu nombre"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-gray-900 focus:border-gray-900 focus:outline-none"
              />
            </label>

            <div className="text-sm text-gray-700">
              <span className="mb-2 block font-medium">Teléfono *</span>
              <CountryPhoneInput
                countries={countries}
                iso={countryIso}
                dial={countryDial}
                phone={phone}
                onCountryChange={(country) => {
                  setCountryIso(country.iso);
                  setCountryDial(country.dial);
                }}
                onPhoneChange={(value) => {
                  phoneTouched.current = true;
                  setPhone(value);
                }}
                placeholder="Número de celular"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm text-gray-700">
                <span className="mb-2 block font-medium">Adultos</span>
                <select
                  value={adults}
                  onChange={(event) => setAdults(Number(event.target.value))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-gray-900 focus:border-gray-900 focus:outline-none"
                >
                  {Array.from({ length: 8 }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm text-gray-700">
                <span className="mb-2 block font-medium">Niños</span>
                <select
                  value={children}
                  onChange={(event) => setChildren(Number(event.target.value))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-gray-900 focus:border-gray-900 focus:outline-none"
                >
                  {Array.from({ length: 7 }, (_, i) => i).map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </label>
            </div>

            <label className="block text-sm text-gray-700">
              <span className="mb-2 block font-medium">Mensaje</span>
              <textarea
                rows={2}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Solicitudes especiales..."
                className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-gray-900 focus:border-gray-900 focus:outline-none"
              />
            </label>

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-gray-900 px-4 py-3 text-sm font-semibold uppercase tracking-wider text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? 'Enviando...' : 'Enviar solicitud'}
            </button>
            <p className="text-center text-xs text-gray-400">
              La habitación queda bloqueada apenas se envía la solicitud, hasta que el hotel la confirme o la cancele.
            </p>
          </form>
        )}
      </motion.div>
    </div>
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
  const [reserving, setReserving] = useState<{ typeId: string; unitId: string } | null>(null);
  const isLoading = typesLoading || unitsLoading;

  /*
   * Ocupación de TODAS las unidades en una ventana amplia (hoy → +90 días).
   * La galería no pregunta fechas antes de reservar, así que muestra la unidad
   * como ocupada si tiene cualquier estadía en ese rango, con las fechas
   * tomadas a la vista. Al reservar se elige el rango exacto, y el servidor
   * vuelve a rechazar cualquier choque de fechas.
   */
  const today = new Date().toISOString().slice(0, 10);
  const horizon = isoDaysFromNow(90);
  const { data: availability } = useRoomAvailabilityRanges(hotelId, today, horizon);
  const ranges = availability?.ranges ?? [];

  const occupiedByUnit = useCallback(
    (type: RoomTypeInventory, unit: RoomUnit) =>
      ranges.filter((range) => range.room_type === `${type.name} · ${roomUnitLabel(type, unit)}`),
    [ranges]
  );

  const unitsByType = useMemo(() => {
    const map = new Map<string, RoomUnit[]>();
    units.forEach((unit) => {
      if (!map.has(unit.tipo_id)) map.set(unit.tipo_id, []);
      map.get(unit.tipo_id)!.push(unit);
    });
    return map;
  }, [units]);

  const reservingType = reserving
    ? types.find((type) => type.id === reserving.typeId) ?? null
    : null;
  const reservingUnit = reservingType
    ? (unitsByType.get(reservingType.id) || []).find((unit) => unit.id === reserving?.unitId) ?? null
    : null;

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

                  {/* Dos tipos por fila en escritorio; en pantallas angostas se apilan. */}
                  <div className="grid items-start gap-4 xl:grid-cols-2">
                    {section.types.map((type) => (
                      <TypeCard
                        key={type.id}
                        type={type}
                        units={unitsByType.get(type.id) || []}
                        singular={section.singular}
                        showNumbers={showNumbers}
                        isOpen={openTypeId === type.id}
                        onToggle={() => setOpenTypeId(openTypeId === type.id ? null : type.id)}
                        occupiedByUnit={(unit) => occupiedByUnit(type, unit)}
                        onReserve={(unit) => setReserving({ typeId: type.id, unitId: unit.id })}
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

      {reservingType && reservingUnit ? (
        <GalleryReservation
          hotelId={hotelId}
          type={reservingType}
          unit={reservingUnit}
          onClose={() => setReserving(null)}
        />
      ) : null}
    </div>
  );
}
