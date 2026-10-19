import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, Users, BedDouble, ChevronDown, Minus, Plus } from 'lucide-react';
import { useHotelConfig, useHotels, useRoomTypes, useRoomUnits } from '../../hooks/useQueries';
import type { Hotel, HotelConfig, RoomTypeInventory, RoomUnit } from '../../types';
import { generateWhatsAppUrl } from '../../utils/helpers';
import DateRangePicker, { type DateRangeValue } from './DateRangePicker';

function getTodayStr() {
  const d = new Date();
  return d.toISOString().split('T')[0];
}
function getTomorrowStr() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
}
function formatDateDisplay(dateStr: string) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

function FieldLabel({ icon: Icon, children }: { icon: typeof Calendar; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon className="w-4 h-4 text-gray-400" />
      <span className="text-xs font-semibold tracking-wider uppercase text-gray-400 whitespace-nowrap">
        {children}
      </span>
    </div>
  );
}

function Counter({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-gray-600">{label}</span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label={`Quitar ${label.toLowerCase()}`}
          disabled={value <= min}
          onClick={() => onChange(Math.max(min, value - 1))}
          className="w-7 h-7 rounded-full border border-gray-300 flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors disabled:opacity-40 disabled:hover:bg-transparent"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>
        <span className="w-6 text-center text-sm tabular-nums">{value}</span>
        <button
          type="button"
          aria-label={`Agregar ${label.toLowerCase()}`}
          disabled={value >= max}
          onClick={() => onChange(Math.min(max, value + 1))}
          className="w-7 h-7 rounded-full border border-gray-300 flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors disabled:opacity-40 disabled:hover:bg-transparent"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

export default function AvailabilityBar() {
  const [stay, setStay] = useState<DateRangeValue>(() => ({
    checkIn: getTodayStr(),
    checkInTime: '05:00',
    checkOut: getTomorrowStr(),
    checkOutTime: '12:00',
  }));
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [rooms, setRooms] = useState(1);
  const [roomType, setRoomType] = useState('');
  const [guestsOpen, setGuestsOpen] = useState(false);
  const guestsRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const { data: hotels } = useHotels();
  const hotelList = (Array.isArray(hotels) ? hotels : []) as Hotel[];
  const whatsapp = hotelList[0]?.whatsapp || '';
  const hotelId = hotelList[0]?.id || '';
  const { data: hotelConfigs = [] } = useHotelConfig(hotelId);
  const { data: roomTypesData } = useRoomTypes(hotelId);
  const { data: roomUnitsData } = useRoomUnits(hotelId);

  const roomTypes = (Array.isArray(roomTypesData) ? roomTypesData : []) as RoomTypeInventory[];
  const roomUnits = (Array.isArray(roomUnitsData) ? roomUnitsData : []) as RoomUnit[];
  const selectableTypes = roomTypes.filter((type) =>
    roomUnits.some((unit) => unit.tipo_id === type.id)
  );

  // Si todavía no se eligió un tipo (o el elegido ya no existe), se usa el primero.
  useEffect(() => {
    if (selectableTypes.length === 0) return;
    if (!selectableTypes.some((type) => type.name === roomType)) {
      setRoomType(selectableTypes[0].name);
    }
  }, [selectableTypes, roomType]);

  // Horarios por defecto definidos en el panel (Configuración).
  const scheduleApplied = useRef(false);
  useEffect(() => {
    const configs = (Array.isArray(hotelConfigs) ? hotelConfigs : []) as HotelConfig[];
    if (scheduleApplied.current || configs.length === 0) return;
    scheduleApplied.current = true;
    const value = (key: string, fallback: string) => configs.find((config) => config.key === key)?.value || fallback;
    setStay((current) => ({
      ...current,
      checkInTime: value('checkin_time', '05:00'),
      checkOutTime: value('checkout_time', '12:00'),
    }));
  }, [hotelConfigs]);

  // La tarjeta se centra sobre la unión del hero y la sección siguiente:
  // se sube la mitad de su alto y se descuenta ese alto del flujo, dejando
  // el padding de la sección siguiente para que el contenido no quede tapado.
  const [verticalOffset, setVerticalOffset] = useState({ top: 0, bottom: 0 });
  useLayoutEffect(() => {
    const element = barRef.current;
    if (!element) return;
    const nextSectionPadding = 96; // py-24 de la sección que sigue
    const update = () => {
      const half = element.offsetHeight / 2;
      setVerticalOffset({ top: -half, bottom: -Math.min(half, nextSectionPadding) });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!guestsOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (guestsRef.current && !guestsRef.current.contains(event.target as Node)) {
        setGuestsOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setGuestsOpen(false);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [guestsOpen]);

  const guestsSummary = [
    `${adults} ${adults === 1 ? 'adulto' : 'adultos'}`,
    `${children} ${children === 1 ? 'niño' : 'niños'}`,
    `${rooms} hab.`,
  ].join(' · ');

  const handleConsult = () => {
    if (!whatsapp) return;
    const roomTypeLabel = roomType || 'Sin preferencia';
    const message = `Hola, deseo consultar disponibilidad.\n\nEntrada: ${formatDateDisplay(stay.checkIn)} ${stay.checkInTime}\nSalida: ${formatDateDisplay(stay.checkOut)} ${stay.checkOutTime}\n\nAdultos: ${adults}\nNiños: ${children}\nHabitaciones: ${rooms}\nTipo de habitación: ${roomTypeLabel}`;
    window.open(generateWhatsAppUrl(whatsapp, message), '_blank');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.3 }}
      ref={barRef}
      style={{ marginTop: verticalOffset.top, marginBottom: verticalOffset.bottom }}
      className="relative z-20 max-w-6xl mx-auto px-4"
    >
      <div className="bg-white rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.12)] p-6 lg:p-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1.85fr_0.95fr_1.35fr_auto] gap-5 items-end">
          {/* Fecha (entrada y salida) */}
          <div className="min-w-0 sm:col-span-2 lg:col-span-1">
            <FieldLabel icon={Calendar}>Fecha</FieldLabel>
            <DateRangePicker value={stay} onChange={setStay} />
          </div>

          {/* Tipo de habitación */}
          <div className="min-w-0">
            <FieldLabel icon={BedDouble}>Tipo de habitación</FieldLabel>
            <select
              value={roomType}
              onChange={(e) => setRoomType(e.target.value)}
              className="w-full h-[52px] border border-gray-200 rounded-lg px-4 text-gray-900 text-base focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-900 transition-all font-serif bg-white"
            >
              {selectableTypes.length === 0 ? (
                <option value="">Sin tipos disponibles</option>
              ) : (
                selectableTypes.map((type) => (
                  <option key={type.id} value={type.name}>
                    {type.name}
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Huéspedes y habitaciones */}
          <div className="min-w-0 sm:col-span-2 lg:col-span-1" ref={guestsRef}>
            <FieldLabel icon={Users}>Huéspedes y habitaciones</FieldLabel>
            <div className="relative">
              <button
                type="button"
                onClick={() => setGuestsOpen((open) => !open)}
                aria-haspopup="true"
                aria-expanded={guestsOpen}
                className="w-full h-[52px] flex items-center justify-between gap-2 border border-gray-200 rounded-lg px-4 text-gray-900 text-base font-serif bg-white focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-900 transition-all"
              >
                <span className="truncate text-left">{guestsSummary}</span>
                <ChevronDown
                  className={`w-4 h-4 flex-shrink-0 text-gray-400 transition-transform ${guestsOpen ? 'rotate-180' : ''}`}
                />
              </button>

              <AnimatePresence>
                {guestsOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.15 }}
                    className="absolute left-0 right-0 sm:right-auto sm:w-72 top-full mt-2 z-30 bg-white border border-gray-100 rounded-xl shadow-xl p-4 space-y-2"
                  >
                    <Counter label="Adultos" value={adults} min={1} max={12} onChange={setAdults} />
                    <Counter label="Niños" value={children} min={0} max={12} onChange={setChildren} />
                    <Counter label="Habitaciones" value={rooms} min={1} max={8} onChange={setRooms} />
                    <button
                      type="button"
                      onClick={() => setGuestsOpen(false)}
                      className="w-full mt-2 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition-colors"
                    >
                      Listo
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Botón consultar */}
          <button
            onClick={handleConsult}
            className="w-full lg:w-auto h-[52px] flex-shrink-0 bg-gray-900 text-white font-semibold text-sm tracking-wider uppercase px-8 rounded-lg hover:bg-gray-800 transition-all duration-300 hover:shadow-lg whitespace-nowrap sm:col-span-2 lg:col-span-1"
          >
            Consultar
          </button>
        </div>
      </div>
    </motion.div>
  );
}
