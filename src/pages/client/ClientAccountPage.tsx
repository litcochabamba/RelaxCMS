import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  CalendarDays,
  CalendarPlus,
  Globe2,
  LayoutDashboard,
  Loader2,
  LogOut,
  Mail,
  MessageSquare,
  Phone,
  Save,
  ShieldCheck,
  User,
  UserRound,
  XCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { clientApi } from '../../api/client';
import CountryPhoneInput from '../../components/common/CountryPhoneInput';
import { useCountryCodes } from '../../hooks/useCountryCodes';
import { useAuthStore } from '../../store/authStore';
import { cn } from '../../utils/helpers';
import type { ClientAccount } from '../../types';

interface ClientReservation {
  id: string;
  check_in: string;
  check_out: string;
  room_type: string;
  adults: number | null;
  children_count: number | null;
  status: string | null;
  message?: string | null;
  created_at: string | null;
}

interface ClientComment {
  id: string;
  content: string;
  status: string | null;
  created_at: string | null;
}

interface ClientPayload {
  client: ClientAccount & { created_at?: string | null; last_login?: string | null };
  reservations: ClientReservation[];
  comments: ClientComment[];
}

type ClientSection = 'resumen' | 'datos' | 'reservas' | 'comentarios';

const SECTIONS: { id: ClientSection; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'resumen', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'datos', label: 'Datos', icon: UserRound },
  { id: 'reservas', label: 'Reservaciones', icon: CalendarDays },
  { id: 'comentarios', label: 'Comentarios', icon: MessageSquare },
];

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  confirmed: 'Confirmada',
  cancelled: 'Cancelada',
  completed: 'Completada',
  approved: 'Aprobado',
  rejected: 'Rechazado',
};

const GENDER_LABELS: Record<string, string> = {
  femenino: 'Femenino',
  masculino: 'Masculino',
  otro: 'Otro',
  'prefiero-no-decir': 'Prefiero no decirlo',
};

const GENDER_OPTIONS = [
  { value: '', label: 'Sin especificar' },
  { value: 'femenino', label: 'Femenino' },
  { value: 'masculino', label: 'Masculino' },
  { value: 'otro', label: 'Otro' },
  { value: 'prefiero-no-decir', label: 'Prefiero no decirlo' },
];

const fieldClass =
  'w-full px-4 py-3 border border-gray-200 rounded-lg text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-900 transition-all';
const labelClass = 'block text-sm font-medium text-gray-700 mb-2';

function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  // Las fechas de la base vienen como `YYYY-MM-DD`: se leen al mediodía local
  // para que el día no se corra en zonas horarias detrás de UTC.
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('es-BO', { day: '2-digit', month: 'short', year: 'numeric' });
}

function InfoCard({ label, value, Icon }: { label: string; value: string; Icon: typeof User }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4">
      <p className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-gray-400">
        <Icon className="w-3.5 h-3.5" /> {label}
      </p>
      <p className="mt-1 text-sm font-medium text-gray-900 break-words">{value}</p>
    </div>
  );
}

function SectionHeader({ title, count, Icon }: { title: string; count?: number; Icon: typeof User }) {
  return (
    <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-gray-100">
      <h2 className="flex items-center gap-2 font-serif text-xl text-gray-900">
        <Icon className="w-5 h-5 text-gray-400" /> {title}
      </h2>
      {count !== undefined && <span className="text-xs text-gray-400">{count}</span>}
    </div>
  );
}

function ReservationsList({
  reservations,
  onCancel,
}: {
  reservations: ClientReservation[];
  onCancel: (id: string) => Promise<boolean>;
}) {
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const handleCancel = async (id: string) => {
    setCancellingId(id);
    const cancelled = await onCancel(id);
    setCancellingId(null);
    if (cancelled) setConfirmingId(null);
  };

  return (
    <section className="bg-white rounded-xl border border-gray-100">
      <SectionHeader title="Mis reservas" count={reservations.length} Icon={CalendarDays} />
      {reservations.length === 0 ? (
        <p className="px-6 py-8 text-sm text-gray-500">
          Todavía no tenés reservas registradas. Cuando reserves, vas a verlas acá.
        </p>
      ) : (
        <ul className="divide-y divide-gray-50">
          {reservations.map((reservation) => (
            <li key={reservation.id} className="px-6 py-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-gray-900">{reservation.room_type}</p>
                <span className="rounded-full bg-gray-50 px-2 py-1 text-[11px] uppercase tracking-wider text-gray-500">
                  {STATUS_LABELS[reservation.status || ''] || reservation.status || 'Pendiente'}
                </span>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                {formatDate(reservation.check_in)} → {formatDate(reservation.check_out)} ·{' '}
                {reservation.adults || 1} adultos
                {reservation.children_count ? ` · ${reservation.children_count} niños` : ''}
                {reservation.created_at ? ` · solicitada el ${formatDate(reservation.created_at)}` : ''}
              </p>
              {reservation.message ? (
                <p className="mt-2 rounded-lg bg-gray-50 px-3 py-2 text-xs leading-relaxed text-gray-600">
                  {reservation.message}
                </p>
              ) : null}
              {reservation.status === 'pending' &&
                (confirmingId === reservation.id ? (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="text-xs text-gray-500">¿Cancelar esta reserva?</span>
                    <button
                      type="button"
                      onClick={() => handleCancel(reservation.id)}
                      disabled={cancellingId === reservation.id}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-gray-800 disabled:opacity-60"
                    >
                      {cancellingId === reservation.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <XCircle className="h-3.5 w-3.5" />
                      )}
                      Sí, cancelar
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmingId(null)}
                      className="rounded-lg px-3 py-1.5 text-xs font-medium text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-900"
                    >
                      Volver
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmingId(reservation.id)}
                    className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 transition-colors hover:text-red-600"
                  >
                    <XCircle className="h-3.5 w-3.5" /> Cancelar reserva
                  </button>
                ))}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function CommentsList({ comments }: { comments: ClientComment[] }) {
  return (
    <section className="bg-white rounded-xl border border-gray-100">
      <SectionHeader title="Mis comentarios" count={comments.length} Icon={MessageSquare} />
      {comments.length === 0 ? (
        <p className="px-6 py-8 text-sm text-gray-500">Todavía no dejaste comentarios.</p>
      ) : (
        <ul className="divide-y divide-gray-50">
          {comments.map((comment) => (
            <li key={comment.id} className="px-6 py-4">
              <p className="text-sm text-gray-800">{comment.content}</p>
              <p className="mt-1 text-xs text-gray-400">
                {formatDate(comment.created_at)} ·{' '}
                {STATUS_LABELS[comment.status || ''] || comment.status || 'Pendiente'}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

interface ProfileFormProps {
  client: ClientAccount;
  onSaved: (client: ClientAccount) => void;
}

/**
 * Datos que el cliente puede completar o corregir después de registrarse.
 * El alias no se edita: es su forma de ingresar.
 */
function ProfileForm({ client, onSaved }: ProfileFormProps) {
  const { data: countries = [], isLoading: loadingCountries } = useCountryCodes();

  const [name, setName] = useState(client.name);
  const [email, setEmail] = useState(client.email || '');
  const [iso, setIso] = useState(client.country_iso || '');
  const [dial, setDial] = useState(client.country_dial || '');
  const [phone, setPhone] = useState('');
  const [gender, setGender] = useState(client.gender || '');
  const [age, setAge] = useState(client.age !== null && client.age !== undefined ? String(client.age) : '');
  const [profession, setProfession] = useState(client.profession || '');
  const [saving, setSaving] = useState(false);

  // El teléfono se guarda completo (+591…) y en el formulario se muestra solo
  // la parte local, al lado del código de área elegido.
  useEffect(() => {
    if (dial && phone) return;
    if (countries.length === 0) return;

    const stored = countries.find(
      (country) => country.iso === (client.country_iso || iso) && country.dial === (client.country_dial || dial)
    );
    const fallback = stored || countries[0];
    setIso(fallback.iso);
    setDial(fallback.dial);

    const digits = (client.phone || '').replace(/\D/g, '');
    const dialDigits = fallback.dial.replace(/\D/g, '');
    setPhone(digits.startsWith(dialDigits) ? digits.slice(dialDigits.length) : digits);
    // Se ejecuta al cargar los países y cuando cambia la cuenta.
  }, [countries, client, iso, dial, phone]);

  const handleSave = async () => {
    if (!dial) {
      toast.error('Elegí tu país y código de área');
      return;
    }
    setSaving(true);
    const result = await clientApi.updateProfile({
      name,
      email: email.trim(),
      country_iso: iso,
      dial_code: dial,
      phone,
      gender,
      age: age.trim() ? Number(age) : null,
      profession,
    });
    setSaving(false);

    if (result.error || !result.data) {
      toast.error(result.error || 'No se pudo guardar el perfil');
      return;
    }
    toast.success('Datos actualizados');
    onSaved(result.data as ClientAccount);
  };

  return (
    <section className="bg-white rounded-xl border border-gray-100">
      <SectionHeader title="Mis datos" Icon={UserRound} />

      <div className="px-6 py-5 grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass} htmlFor="profile-name">Nombre</label>
          <input
            id="profile-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className={fieldClass}
            maxLength={80}
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="profile-email">
            Correo <span className="font-normal text-gray-400">(opcional)</span>
          </label>
          <input
            id="profile-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className={fieldClass}
            placeholder="tucorreo@ejemplo.com"
          />
        </div>

        <div>
          <label className={labelClass}>Celular</label>
          <CountryPhoneInput
            countries={countries}
            iso={iso}
            dial={dial}
            phone={phone}
            onCountryChange={(country) => {
              setIso(country.iso);
              setDial(country.dial);
            }}
            onPhoneChange={setPhone}
            placeholder={loadingCountries ? 'Cargando países...' : 'Número de celular'}
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="profile-gender">Género</label>
          <select
            id="profile-gender"
            value={gender}
            onChange={(event) => setGender(event.target.value)}
            className={fieldClass}
          >
            {GENDER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass} htmlFor="profile-age">Edad</label>
          <input
            id="profile-age"
            type="number"
            min={13}
            max={120}
            value={age}
            onChange={(event) => setAge(event.target.value)}
            className={fieldClass}
            placeholder="Opcional"
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="profile-profession">Profesión</label>
          <input
            id="profile-profession"
            value={profession}
            onChange={(event) => setProfession(event.target.value)}
            className={fieldClass}
            placeholder="Opcional"
            maxLength={80}
          />
        </div>
      </div>

      <div className="px-6 pb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-gray-400">Tu alias no se puede cambiar: es con lo que ingresás.</p>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Guardar cambios
        </button>
      </div>
    </section>
  );
}

function SummarySection({
  client,
  reservations,
  comments,
  onOpen,
  onQuickBook,
}: {
  client: ClientAccount;
  reservations: ClientReservation[];
  comments: ClientComment[];
  onOpen: (section: ClientSection) => void;
  onQuickBook: () => void;
}) {
  return (
    <div className="space-y-6">
      {/* Reserva rápida: abre el formulario de la web con los datos de la cuenta ya cargados. */}
      <section className="overflow-hidden rounded-xl bg-gray-900 p-6 text-white sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.3em] text-white/50">Reserva rápida</p>
            <h2 className="mt-2 font-serif text-2xl">Reservá con tus datos</h2>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-white/70">
              Abrimos el formulario de la web con tu nombre y tu celular ya cargados. Solo elegís
              las fechas y la habitación.
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-[11px]">
              {[
                { label: client.name, Icon: User },
                { label: client.phone || 'Sin teléfono', Icon: Phone },
                { label: client.country_name || 'Sin país', Icon: Globe2 },
              ].map(({ label, Icon }) => (
                <span
                  key={label}
                  className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-white/80"
                >
                  <Icon className="h-3 w-3 shrink-0" />
                  <span className="truncate">{label}</span>
                </span>
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={onQuickBook}
            className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-white px-5 py-3 text-sm font-semibold text-gray-900 transition-colors hover:bg-gray-100"
          >
            <CalendarPlus className="h-4 w-4" /> Reservar ahora
          </button>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <InfoCard label="Nombre" value={client.name} Icon={User} />
        <InfoCard label="País" value={client.country_name || 'Sin país'} Icon={Globe2} />
        <InfoCard label="Correo" value={client.email || 'Sin correo'} Icon={Mail} />
        <InfoCard label="Teléfono" value={client.phone || 'Sin teléfono'} Icon={Phone} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <InfoCard label="Género" value={GENDER_LABELS[client.gender || ''] || 'Sin especificar'} Icon={UserRound} />
        <InfoCard label="Edad" value={client.age ? `${client.age} años` : 'Sin especificar'} Icon={User} />
        <InfoCard label="Profesión" value={client.profession || 'Sin especificar'} Icon={ShieldCheck} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {[
          {
            key: 'reservas' as ClientSection,
            label: 'Reservaciones',
            count: reservations.length,
            hint: reservations.length ? 'Ver el detalle de tus estadías' : 'Todavía no reservaste',
            Icon: CalendarDays,
          },
          {
            key: 'comentarios' as ClientSection,
            label: 'Comentarios',
            count: comments.length,
            hint: comments.length ? 'Ver lo que publicaste' : 'Todavía no comentaste',
            Icon: MessageSquare,
          },
        ].map(({ key, label, count, hint, Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => onOpen(key)}
            className="flex items-center gap-4 rounded-xl border border-gray-100 bg-white p-5 text-left hover:border-gray-200 hover:shadow-sm transition-all"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-50 text-gray-500">
              <Icon className="h-5 w-5" />
            </span>
            <span className="min-w-0">
              <span className="block text-[11px] uppercase tracking-wider text-gray-400">{label}</span>
              <span className="block text-lg font-medium text-gray-900">{count}</span>
              <span className="block text-xs text-gray-500">{hint}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function ClientAccountPage() {
  const [payload, setPayload] = useState<ClientPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState<ClientSection>('resumen');
  const { logout } = useAuthStore();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    let active = true;
    clientApi.me().then((result) => {
      if (!active) return;
      if (result.error || !result.data) {
        setError(result.error || 'No se pudo cargar tu cuenta');
        setLoading(false);
        return;
      }
      setPayload(result.data as ClientPayload);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  // El formulario público precarga los datos de la cuenta al detectar la sesión;
  // acá solo hay que llevar al cliente hasta esa sección.
  const handleQuickBook = () => {
    navigate('/#reservar');
  };

  // Cancelar libera la unidad: el backend cambia el estado y la disponibilidad
  // pública deja de incluirla en la próxima consulta.
  const handleCancelReservation = async (id: string) => {
    const result = await clientApi.cancelReservation(id);
    if (result.error) {
      toast.error(result.error);
      return false;
    }

    setPayload((current) =>
      current
        ? {
            ...current,
            reservations: current.reservations.map((reservation) =>
              reservation.id === id ? { ...reservation, status: 'cancelled' } : reservation
            ),
          }
        : current
    );
    queryClient.invalidateQueries({ queryKey: ['roomAvailability'] });
    toast.success('Reserva cancelada. La habitación volvió a quedar libre.');
    return true;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        <Loader2 className="w-6 h-6 animate-spin mr-3" /> Cargando tu cuenta...
      </div>
    );
  }

  if (error || !payload) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="max-w-md text-center">
          <ShieldCheck className="w-10 h-10 text-gray-300 mx-auto mb-4" />
          <h1 className="font-serif text-2xl text-gray-900 mb-2">No pudimos abrir tu cuenta</h1>
          <p className="text-sm text-gray-500 mb-6">{error}</p>
          <button
            type="button"
            onClick={() => navigate('/auth/login')}
            className="px-5 py-3 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
          >
            Iniciar sesión
          </button>
        </div>
      </div>
    );
  }

  const { client, reservations, comments } = payload;
  const sectionLabel = SECTIONS.find((item) => item.id === section)?.label || 'Mi cuenta';

  return (
    <div className="min-h-screen bg-gray-50 pt-20">
      <div className="flex flex-col lg:flex-row">
        {/* Sidebar con el mismo lenguaje visual que el panel de administración. */}
        <aside className="flex flex-col bg-gray-900 text-white lg:sticky lg:top-20 lg:h-[calc(100vh-5rem)] lg:w-64 lg:shrink-0">
          <div className="hidden border-b border-white/10 px-6 py-5 lg:block">
            <p className="font-serif text-lg font-semibold leading-none">Mi cuenta</p>
            <p className="mt-1.5 text-[11px] uppercase tracking-wider text-white/50">
              @{client.username}
            </p>
          </div>

          <nav className="flex overflow-x-auto lg:flex-1 lg:flex-col lg:overflow-y-auto lg:py-3">
            {/* Reserva rápida: acción principal, como "Ir a Web" en el panel del CMS. */}
            <button
              type="button"
              onClick={handleQuickBook}
              className="flex shrink-0 items-center gap-3 whitespace-nowrap bg-white/10 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-white/15 lg:mx-3 lg:mb-2 lg:rounded-lg lg:px-3"
            >
              <CalendarPlus className="h-4 w-4 shrink-0" />
              Reservar ahora
            </button>

            <div className="my-1 hidden border-t border-white/10 lg:mx-6 lg:block" />

            {SECTIONS.map(({ id, label, icon: Icon }) => {
              const count =
                id === 'reservas' ? reservations.length : id === 'comentarios' ? comments.length : 0;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setSection(id)}
                  aria-current={section === id ? 'page' : undefined}
                  className={cn(
                    'flex shrink-0 items-center gap-3 whitespace-nowrap border-b-2 px-6 py-3 text-sm transition-all lg:w-full lg:border-b-0 lg:border-r-2',
                    section === id
                      ? 'border-white bg-white/10 text-white'
                      : 'border-transparent text-white/60 hover:bg-white/5 hover:text-white'
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {label}
                  {count > 0 && (
                    <span
                      className={cn(
                        'ml-auto rounded-full px-2 py-0.5 text-[11px]',
                        section === id ? 'bg-white/20 text-white' : 'bg-white/10 text-white/60'
                      )}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          <div className="hidden border-t border-white/10 p-3 lg:block">
            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-white/60 transition-colors hover:bg-white/5 hover:text-white"
            >
              <LogOut className="h-4 w-4" />
              Cerrar sesión
            </button>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-16 items-center justify-between gap-3 border-b border-gray-200 bg-white px-4 sm:px-6 lg:sticky lg:top-20 lg:z-10">
            <div className="min-w-0">
              <h1 className="truncate font-serif text-lg text-gray-900">{sectionLabel}</h1>
              <p className="text-[11px] text-gray-400 lg:hidden">@{client.username}</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden items-center gap-3 sm:flex">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-900 text-xs font-bold text-white">
                  {client.name.charAt(0).toUpperCase()}
                </div>
                <div className="hidden md:block">
                  <p className="text-sm font-medium text-gray-900">{client.name}</p>
                  <p className="text-xs text-gray-500">Cliente</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900 lg:hidden"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Salir</span>
              </button>
            </div>
          </header>

          <main className="flex-1 p-4 sm:p-6">
            <motion.div
              key={section}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mx-auto w-full max-w-4xl"
            >
              {section === 'resumen' && (
                <SummarySection
                  client={client}
                  reservations={reservations}
                  comments={comments}
                  onOpen={setSection}
                  onQuickBook={handleQuickBook}
                />
              )}

              {section === 'datos' && (
                <ProfileForm
                  client={client}
                  onSaved={(updated) => setPayload((current) => (current ? { ...current, client: updated } : current))}
                />
              )}

              {section === 'reservas' && (
                <ReservationsList
                  reservations={reservations}
                  onCancel={handleCancelReservation}
                />
              )}

              {section === 'comentarios' && <CommentsList comments={comments} />}
            </motion.div>
          </main>
        </div>
      </div>
    </div>
  );
}
