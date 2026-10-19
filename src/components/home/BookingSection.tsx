import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { BadgeCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { useHotelDataStore } from '../../store/hotelStore';
import { useAuthStore } from '../../store/authStore';
import { bookingApi, clientApi } from '../../api/client';
import CountryPhoneInput from '../common/CountryPhoneInput';
import { useCountryCodes } from '../../hooks/useCountryCodes';
import {
  useHotels,
  useHotelConfig,
  useRoomAvailability,
  useRoomTypes,
  useRoomUnits,
} from '../../hooks/useQueries';
import type { RoomTypeInventory, RoomUnit } from '../../types';

function unitNumber(name: string) {
  return name
    .replace(/^dep\.?\s*/i, '')
    .replace(/^n[.º°]?\s*/i, '')
    .replace(/^\./, '')
    .trim();
}

// Rótulo con el que se guarda la unidad en `reservas.room_type`
// ("Matrimonial VIP · Habitación 07"). Debe coincidir con el del servidor.
function roomUnitLabel(type: RoomTypeInventory, unit: RoomUnit) {
  const prefix = type.grupo === 'departamento' ? 'Departamento' : 'Habitación';
  return `${prefix} ${unitNumber(unit.name)}`.trim();
}

function formatDay(value: string): string {
  const [year, month, day] = value.split('-');
  return year && month && day ? `${day}/${month}/${year}` : value;
}

function getConfigValue(configs: any[], key: string, fallback: string): string {
  const item = configs.find(c => c.key === key);
  return item?.value || fallback;
}

export default function BookingSection() {
  const queryClient = useQueryClient();
  const { whatsapp, hotelId } = useHotelDataStore();
  const { data: hotels } = useHotels();
  const actualHotelId = hotels?.[0]?.id || hotelId || '';
  const { data: configs = [] } = useHotelConfig(actualHotelId);
  const { data: typesData = [] } = useRoomTypes(actualHotelId);
  const { data: unitsData = [] } = useRoomUnits(actualHotelId);

  const roomTypes = (Array.isArray(typesData) ? typesData : []) as RoomTypeInventory[];
  const units = (Array.isArray(unitsData) ? unitsData : []) as RoomUnit[];
  const availableTypes = roomTypes.filter((type) => units.some((unit) => unit.tipo_id === type.id));

  const [form, setForm] = useState({
    nombre: '',
    adultos: 2,
    ninos: 0,
    fechaIngreso: '',
    fechaSalida: '',
    tipoHabitacion: '',
    habitacion: '',
    mensaje: '',
  });

  const { isAuthenticated, user } = useAuthStore();
  const isClient = isAuthenticated && user?.role === 'client';

  // País y número se guardan por separado para poder precargar los del cliente
  // y enviar el teléfono completo (+591…) al hotel.
  const { data: countries = [] } = useCountryCodes();
  const [countryIso, setCountryIso] = useState('');
  const [countryDial, setCountryDial] = useState('');
  const [phoneLocal, setPhoneLocal] = useState('');
  const [prefilled, setPrefilled] = useState(false);
  // Datos de la cuenta que se usan para precargar; el número se arma recién
  // cuando se conocen el país y el código de área.
  const clientPrefill = useRef<{
    name?: string;
    phone?: string | null;
    country_iso?: string | null;
    country_dial?: string | null;
  } | null>(null);
  const [prefillVersion, setPrefillVersion] = useState(0);
  const [phoneTouched, setPhoneTouched] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState<{ name: string; when: string; type: string; waText: string } | null>(
    null
  );
  // wa.me exige solo dígitos; el número del hotel puede venir con espacios o '+'.
  const whatsappNumber = whatsapp.replace(/\D/g, '');

  const selectedType = availableTypes.find((type) => type.name === form.tipoHabitacion) || null;
  const typeUnits = selectedType ? units.filter((unit) => unit.tipo_id === selectedType.id) : [];

  // Ocupación por fechas: las reservas pendientes y confirmadas bloquean su
  // unidad para todo rango que se solape. Se consulta solo con fechas válidas.
  const rangeValid = Boolean(
    form.fechaIngreso && form.fechaSalida && form.fechaSalida > form.fechaIngreso
  );
  const { data: occupiedRooms = [] } = useRoomAvailability(
    actualHotelId,
    rangeValid ? form.fechaIngreso : '',
    rangeValid ? form.fechaSalida : ''
  );
  const occupied = new Set(occupiedRooms);
  const isUnitOccupied = (type: RoomTypeInventory, unit: RoomUnit) =>
    occupied.has(`${type.name} · ${roomUnitLabel(type, unit)}`);
  const freeTypeUnits = selectedType
    ? units.filter((unit) => unit.tipo_id === selectedType.id && !isUnitOccupied(selectedType, unit))
        .length
    : 0;

  // Si las fechas elegidas dejan ocupada la unidad (o el tipo entero), se
  // limpia la selección para no enviar algo que ya está reservado.
  useEffect(() => {
    if (!form.tipoHabitacion) return;
    const type = roomTypes.find((item) => item.name === form.tipoHabitacion);
    if (!type) return;

    const taken = new Set(occupiedRooms);
    const free = units.filter(
      (unit) => unit.tipo_id === type.id && !taken.has(`${type.name} · ${roomUnitLabel(type, unit)}`)
    ).length;

    if (free === 0) {
      setForm((current) => ({ ...current, tipoHabitacion: '', habitacion: '' }));
      return;
    }
    if (form.habitacion && taken.has(`${type.name} · ${form.habitacion}`)) {
      setForm((current) => ({ ...current, habitacion: '' }));
    }
  }, [occupiedRooms, roomTypes, units, form.tipoHabitacion, form.habitacion]);

  // Carrusel de tipos: una tarjeta a la vez, sin flechas ni guías, avanzando
  // cada `booking_types_duration` segundos (configurable en el panel flotante).
  const carouselSeconds = Math.max(2, parseInt(getConfigValue(configs, 'booking_types_duration', '6'), 10) || 6);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (availableTypes.length <= 1) return;
    const interval = setInterval(() => {
      setActiveIndex((index) => (index + 1) % availableTypes.length);
    }, carouselSeconds * 1000);
    return () => clearInterval(interval);
  }, [availableTypes.length, carouselSeconds]);

  useEffect(() => {
    if (activeIndex >= availableTypes.length) setActiveIndex(0);
  }, [activeIndex, availableTypes.length]);

  const activeType = availableTypes[activeIndex] || null;

  // País por defecto para huéspedes nuevos: el primero configurado en el panel.
  useEffect(() => {
    if (countryDial || countries.length === 0) return;
    const fallback = countries.find((country) => country.iso === 'BO') || countries[0];
    setCountryIso(fallback.iso);
    setCountryDial(fallback.dial);
  }, [countries, countryDial]);

  // Si hay sesión de cliente, se completan nombre, celular y país con los de la
  // cuenta para que la solicitud quede vinculada sin volver a escribirlos.
  useEffect(() => {
    if (!isClient || !isAuthenticated) return;
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
      clientPrefill.current = client;
      setForm((current) => ({ ...current, nombre: current.nombre || client.name || '' }));
      setPrefilled(true);
      setPrefillVersion((version) => version + 1);
    });
    return () => {
      active = false;
    };
  }, [isClient, isAuthenticated]);

  // El teléfono guardado incluye el código de área; se separa para mostrarlo
  // junto al país. Si el cliente todavía no tocó el campo, se recalcula cuando
  // terminan de cargar los países.
  useEffect(() => {
    const client = clientPrefill.current;
    if (!client || phoneTouched) return;

    const matched = countries.find(
      (country) =>
        (client.country_iso && country.iso === client.country_iso) ||
        (client.country_dial && country.dial === client.country_dial)
    );
    const dial = client.country_dial || matched?.dial || countryDial;
    if (!dial) return;

    const digits = (client.phone || '').replace(/\D/g, '');
    const dialDigits = dial.replace(/\D/g, '');
    setCountryDial(dial);
    setCountryIso(client.country_iso || matched?.iso || countryIso);
    setPhoneLocal(
      dialDigits && digits.startsWith(dialDigits) ? digits.slice(dialDigits.length) : digits
    );
  }, [prefillVersion, countries, countryDial, countryIso, phoneTouched]);

  const whatsappMessage = (data: typeof form) => {
    const unitText = data.habitacion ? `\nUnidad: ${data.habitacion}` : '';
    return `Hola.\n\nMi nombre es ${data.nombre}.\nDeseo consultar disponibilidad.\n\nAdultos: ${data.adultos}\nNiños: ${data.ninos}\n\nIngreso: ${data.fechaIngreso}\nSalida: ${data.fechaSalida}\n\nTipo de habitación: ${data.tipoHabitacion}${unitText}\n\n${data.mensaje ? `Mensaje: ${data.mensaje}` : ''}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!actualHotelId) {
      toast.error('El hotel todavía no está configurado');
      return;
    }
    if (form.fechaSalida <= form.fechaIngreso) {
      toast.error('La fecha de salida debe ser posterior a la de ingreso');
      return;
    }
    if (phoneLocal.replace(/\D/g, '').length < 6) {
      toast.error('Ingresá un número de celular válido');
      return;
    }
    if (form.habitacion && occupied.has(`${form.tipoHabitacion} · ${form.habitacion}`)) {
      toast.error('Esa habitación ya está reservada en esas fechas. Elegí otra.');
      return;
    }

    setSubmitting(true);
    const { error } = await bookingApi.create({
      hotel_id: actualHotelId,
      guest_name: form.nombre,
      guest_phone: `${countryDial} ${phoneLocal}`.trim(),
      check_in: form.fechaIngreso,
      check_out: form.fechaSalida,
      adults: form.adultos,
      children_count: form.ninos,
      room_type: form.tipoHabitacion,
      room_unit: form.habitacion,
      message: form.mensaje,
    });
    setSubmitting(false);

    if (error) {
      toast.error(error);
      return;
    }

    setSent({
      name: form.nombre,
      when: `${formatDay(form.fechaIngreso)} → ${formatDay(form.fechaSalida)}`,
      type: form.habitacion ? `${form.tipoHabitacion} · ${form.habitacion}` : form.tipoHabitacion,
      // Se guarda el texto ya armado: el formulario se limpia a continuación.
      waText: encodeURIComponent(whatsappMessage(form)),
    });
    toast.success('Solicitud enviada. El hotel se va a contactar con vos.');
    // La unidad recién reservada debe aparecer ocupada si se consulta de nuevo.
    queryClient.invalidateQueries({ queryKey: ['roomAvailability'] });
    setForm({
      nombre: '',
      adultos: 2,
      ninos: 0,
      fechaIngreso: '',
      fechaSalida: '',
      tipoHabitacion: '',
      habitacion: '',
      mensaje: '',
    });
    clientPrefill.current = null;
    setPhoneLocal('');
    setPrefilled(false);
    setPhoneTouched(false);
  };

  return (
    <section id="reservar" className="scroll-mt-20 py-12 lg:py-16 bg-white">
      <div className="container-wide">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Left - Info */}
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            <h2 className="text-4xl md:text-5xl font-serif text-gray-900 leading-tight mb-6">
              {getConfigValue(configs, 'booking_title', 'Reserva una<br />Habitación').replace('<br />', '\n').split('\n').map((line, i) => (
                <span key={i}>{line}{i === 0 && <br />}</span>
              ))}
            </h2>
            <p className="text-gray-600 text-lg leading-relaxed mb-8">
              {getConfigValue(configs, 'booking_description', 'Consulta la disponibilidad de nuestras habitaciones. Nuestro equipo estará encantado de atenderte a través de WhatsApp para confirmar tu reserva.')}
            </p>

            {/* Carrusel de tipos: una tarjeta a la vez, sin controles */}
            <div className="relative overflow-hidden rounded-2xl bg-gray-100 aspect-[16/10]">
              <AnimatePresence mode="wait">
                {activeType ? (
                  <motion.button
                    key={activeType.id}
                    type="button"
                    initial={{ opacity: 0, scale: 1.04 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.8, ease: 'easeInOut' }}
                    onClick={() =>
                      setForm({ ...form, tipoHabitacion: activeType.name, habitacion: '' })
                    }
                    aria-label={`Elegir ${activeType.name}`}
                    className="absolute inset-0 block w-full text-left"
                  >
                    {activeType.image_url ? (
                      <img
                        src={activeType.image_url}
                        alt={activeType.name}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="h-full w-full bg-gray-200" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-6">
                      <div>
                        <p className="font-serif text-2xl text-white">{activeType.name}</p>
                        <p className="mt-1 text-xs uppercase tracking-[0.2em] text-white/70">
                          {(activeType.max_capacity || activeType.min_capacity || 1)}{' '}
                          {(activeType.max_capacity || activeType.min_capacity || 1) === 1 ? 'persona' : 'personas'}
                          {activeType.price ? ` · Bs. ${activeType.price.toLocaleString('es-BO')} / noche` : ''}
                        </p>
                      </div>
                      <span
                        className={`hidden sm:inline-flex shrink-0 rounded-full px-4 py-2 text-[11px] font-semibold uppercase tracking-wider transition-colors ${
                          form.tipoHabitacion === activeType.name
                            ? 'bg-white text-gray-900'
                            : 'bg-white/15 text-white backdrop-blur'
                        }`}
                      >
                        {form.tipoHabitacion === activeType.name ? 'Elegido' : 'Elegir'}
                      </span>
                    </div>
                  </motion.button>
                ) : null}
              </AnimatePresence>
            </div>
          </motion.div>

          {/* Right - Form */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            {sent ? (
              <div className="bg-gray-50 rounded-2xl p-8 lg:p-10 shadow-sm border border-gray-100">
                <div className="flex items-start gap-4">
                  <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-100 text-lg text-green-700">
                    ✓
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-[0.3em] text-gray-500">Solicitud recibida</p>
                    <h3 className="mt-2 font-serif text-2xl text-gray-900">Gracias, {sent.name}</h3>
                  </div>
                </div>
                <dl className="mt-6 space-y-3 rounded-xl border border-gray-200 bg-white p-5 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt className="text-gray-500">Habitación</dt>
                    <dd className="text-right font-medium text-gray-900">{sent.type}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-gray-500">Fechas</dt>
                    <dd className="text-right font-medium text-gray-900">{sent.when}</dd>
                  </div>
                </dl>
                <p className="mt-5 text-sm leading-relaxed text-gray-600">
                  Guardamos tu solicitud y el hotel va a confirmar la disponibilidad.
                  {isClient
                    ? ' Quedó asociada a tu cuenta, así que podés seguirla desde Mi cuenta.'
                    : ' Si querés, podés adelantarla por WhatsApp.'}
                </p>
                <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                  <a
                    href={`https://wa.me/${whatsappNumber}?text=${sent.waText}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex flex-1 items-center justify-center rounded-lg bg-gray-900 px-6 py-3 text-sm font-semibold uppercase tracking-wider text-white transition-colors hover:bg-gray-800"
                  >
                    Continuar por WhatsApp
                  </a>
                  <button
                    type="button"
                    onClick={() => setSent(null)}
                    className="inline-flex flex-1 items-center justify-center rounded-lg border border-gray-300 px-6 py-3 text-sm font-medium text-gray-700 transition-colors hover:bg-white"
                  >
                    Hacer otra solicitud
                  </button>
                </div>
              </div>
            ) : (
            <form
              onSubmit={handleSubmit}
              className="bg-gray-50 rounded-2xl p-8 lg:p-10 shadow-sm border border-gray-100"
            >
              {prefilled && (
                <p className="mb-5 flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-600">
                  <BadgeCheck className="h-4 w-4 shrink-0 text-green-600" />
                  Cargamos tu nombre, tu celular y tu país desde tu cuenta. Podés ajustarlos antes de
                  enviar.
                </p>
              )}

              <div className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Nombre completo *</label>
                    <input
                      type="text"
                      required
                      value={form.nombre}
                      onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                      className="w-full px-4 py-3 bg-white border border-gray-200 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-900 transition-all"
                      placeholder="Tu nombre"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Teléfono *</label>
                    <CountryPhoneInput
                      countries={countries}
                      iso={countryIso}
                      dial={countryDial}
                      phone={phoneLocal}
                      onCountryChange={(country) => {
                        setCountryIso(country.iso);
                        setCountryDial(country.dial);
                      }}
                      onPhoneChange={(value) => {
                        setPhoneLocal(value);
                        setPhoneTouched(true);
                      }}
                      placeholder="Número de celular"
                      className="bg-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Adultos</label>
                    <select
                      value={form.adultos}
                      onChange={(e) => setForm({ ...form, adultos: Number(e.target.value) })}
                      className="w-full px-4 py-3 bg-white border border-gray-200 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-900 transition-all"
                    >
                      {[1, 2, 3, 4, 5, 6].map((n) => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Niños</label>
                    <select
                      value={form.ninos}
                      onChange={(e) => setForm({ ...form, ninos: Number(e.target.value) })}
                      className="w-full px-4 py-3 bg-white border border-gray-200 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-900 transition-all"
                    >
                      {[0, 1, 2, 3, 4].map((n) => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Fecha ingreso *</label>
                    <input
                      type="date"
                      required
                      aria-label="Fecha de ingreso"
                      value={form.fechaIngreso}
                      onChange={(e) => setForm({ ...form, fechaIngreso: e.target.value })}
                      className="w-full px-4 py-3 bg-white border border-gray-200 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-900 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Fecha salida *</label>
                    <input
                      type="date"
                      required
                      aria-label="Fecha de salida"
                      value={form.fechaSalida}
                      onChange={(e) => setForm({ ...form, fechaSalida: e.target.value })}
                      className="w-full px-4 py-3 bg-white border border-gray-200 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-900 transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
                  <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de habitación *</label>
                  <select
                    required
                    aria-label="Tipo de habitación"
                    value={form.tipoHabitacion}
                    onChange={(e) => setForm({ ...form, tipoHabitacion: e.target.value, habitacion: '' })}
                    className="w-full px-4 py-3 bg-white border border-gray-200 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-900 transition-all"
                  >
                    <option value="">Seleccionar tipo</option>
                    {availableTypes.map((room) => {
                      const free = units.filter(
                        (unit) => unit.tipo_id === room.id && !isUnitOccupied(room, unit)
                      ).length;
                      const soldOut = rangeValid && free === 0;
                      return (
                        <option key={room.id} value={room.name} disabled={soldOut}>
                          {room.name}
                          {soldOut ? ' · sin disponibilidad' : ''}
                        </option>
                      );
                    })}
                  </select>
                  </div>

                  <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Habitación *</label>
                  <select
                    required
                    aria-label="Habitación"
                    value={form.habitacion}
                    onChange={(e) => setForm({ ...form, habitacion: e.target.value })}
                    disabled={!selectedType || typeUnits.length === 0}
                    className="w-full px-4 py-3 bg-white border border-gray-200 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-900 transition-all disabled:bg-gray-100 disabled:text-gray-400"
                  >
                    <option value="">
                      {!selectedType
                        ? 'Elegí primero un tipo'
                        : typeUnits.length === 0
                          ? 'Sin unidades disponibles'
                          : 'Seleccionar habitación'}
                    </option>
                    {typeUnits.map((unit) => {
                      const label = selectedType ? roomUnitLabel(selectedType, unit) : unit.name;
                      const taken = selectedType ? isUnitOccupied(selectedType, unit) : false;
                      return (
                        <option key={unit.id} value={label} disabled={taken}>
                          {label}
                          {unit.floor ? ` · ${unit.floor}` : ''}
                          {unit.capacity ? ` · ${unit.capacity} ${unit.capacity === 1 ? 'persona' : 'personas'}` : ''}
                          {taken ? ' · ocupada' : ''}
                        </option>
                      );
                    })}
                  </select>
                  {selectedType ? (
                    <p className="mt-1 text-xs text-gray-500">
                      {rangeValid
                        ? `${freeTypeUnits} de ${typeUnits.length} ${
                            typeUnits.length === 1 ? 'unidad libre' : 'unidades libres'
                          } para esas fechas`
                        : `${typeUnits.length} ${
                            typeUnits.length === 1 ? 'unidad' : 'unidades'
                          } en total`}
                      {selectedType.price ? ` · Bs. ${selectedType.price.toLocaleString('es-BO')} por noche` : ''}
                    </p>
                  ) : null}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Mensaje</label>
                  <textarea
                    rows={3}
                    value={form.mensaje}
                    onChange={(e) => setForm({ ...form, mensaje: e.target.value })}
                    className="w-full px-4 py-3 bg-white border border-gray-200 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-900 transition-all resize-none"
                    placeholder="Solicitudes especiales..."
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-4 bg-gray-900 text-white font-semibold text-sm tracking-wider uppercase hover:bg-gray-800 transition-all duration-300 rounded-lg hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? 'Enviando...' : 'Consultar Disponibilidad'}
                </button>
              </div>
            </form>
            )}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
