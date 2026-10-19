import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../store/authStore';
import SupabaseConnection from '../../components/admin/SupabaseConnection';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import CountryCodesEditor from '../../components/admin/CountryCodesEditor';
import StayScheduleSettings from '../../components/admin/StayScheduleSettings';
import ImageUploadButton from '../../components/admin/ImageUploadButton';
import { accountsApi } from '../../api/client';
import { 
  useHotels, useHeroSlides, 
  useAmenities, useGallery,
  useAttractionsWithImages, useAllComments, useUsers, useCreateGalleryItem, useDeleteGalleryItem,
  useSetCommentStatus, useDeleteComment, useDashboardStats,
  useReservations, useRoomTypes, useRoomUnits, useSetReservationStatus, useUpdateRoomType,
  useAdminPromotions, adminPromotionsQueryOptions, useCreatePromotion, useUpdatePromotion, useDeletePromotion
} from '../../hooks/useQueries';
import type { ClientAccount, Hotel, Promotion, RoomTypeInventory, RoomUnit, User } from '../../types';
import { 
  Building2, Bed, Tag, Star, Image, MapPin, 
  Mail, Users, XCircle, Plus, Edit, Trash2, Eye, 
  ChevronDown, ExternalLink, Loader2, AlertCircle, Settings, Phone, Check, RefreshCw, X
} from 'lucide-react';

const menuItems = [
  { id: 'dashboard', label: 'Inicio', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  { id: 'rooms', label: 'Tipos de habitación', icon: 'M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm0 8a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zm12 0a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z' },
  { id: 'amenities', label: 'Amenidades', icon: 'M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z' },
  { id: 'hero', label: 'Carrusel Hero', icon: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z' },
  { id: 'gallery', label: 'Galería', icon: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z' },
  { id: 'attractions', label: 'Atractivos Turísticos', icon: 'M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7' },
  { id: 'comments', label: 'Comentarios', icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z' },
  { id: 'reservations', label: 'Reservas', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
  { id: 'promotions', label: 'Promociones', icon: 'M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z' },
  { id: 'users', label: 'Usuarios', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z' },
  { id: 'clients', label: 'Clientes', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z' },
  { id: 'settings', label: 'Configuración', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z' },
];

// Generic section component for data tables
function DataSection({ 
  title, 
  description, 
  isLoading, 
  error, 
  data, 
  columns,
  emptyMessage,
  onAdd,
  addLabel,
  rowActions,
  emptyHint
}: {
  title: string;
  description: string;
  isLoading: boolean;
  error: Error | null;
  data: unknown[];
  columns: { key: string; label: string; render?: (item: unknown) => React.ReactNode }[];
  emptyMessage: string;
  onAdd?: () => void;
  addLabel?: string;
  rowActions?: (item: any) => React.ReactNode;
  emptyHint?: string;
}) {
  if (isLoading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-xl border border-gray-100 p-8"
      >
        <div className="flex items-center justify-center py-12">
          <Loader2 className="animate-spin h-8 w-8 text-gray-400" />
          <span className="ml-3 text-gray-600">Cargando {title.toLowerCase()}...</span>
        </div>
      </motion.div>
    );
  }

  if (error) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-xl border border-gray-100 p-8"
      >
        <div className="text-center py-12">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Error al cargar {title.toLowerCase()}</h3>
          <p className="text-gray-500 text-sm">{error.message}</p>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-serif text-gray-900">{title}</h2>
          <p className="text-gray-500">{description}</p>
        </div>
        {onAdd && (
          <button 
            onClick={onAdd}
            className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            {addLabel || 'Nuevo'}
          </button>
        )}
      </div>

      {data && data.length > 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  {columns.map((col) => (
                    <th key={col.key} className="text-left px-6 py-4 text-sm font-medium text-gray-500">
                      {col.label}
                    </th>
                  ))}
                  <th className="text-right px-6 py-4 text-sm font-medium text-gray-500">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.map((item: any, index: number) => (
                  <tr key={item.id || index} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    {columns.map((col) => (
                      <td key={col.key} className="px-6 py-4 text-sm text-gray-900">
                        {col.render ? col.render(item) : item[col.key]}
                      </td>
                    ))}
                    <td className="px-6 py-4 text-right">
                      {rowActions ? (
                        <div className="flex items-center justify-end gap-2">{rowActions(item)}</div>
                      ) : (
                        <span className="text-sm text-gray-300">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={menuItems.find(i => i.label.toLowerCase() === title.toLowerCase())?.icon || ''} />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">{emptyMessage}</h3>
          <p className="text-gray-500 text-sm mb-6">{emptyHint || 'Aún no hay registros en el sistema.'}</p>
          {onAdd && (
            <button 
              onClick={onAdd}
              className="px-6 py-3 bg-gray-900 text-white font-semibold text-sm rounded-lg hover:bg-gray-800 transition-colors"
            >
              {addLabel || `Crear ${title.toLowerCase()}`}
            </button>
          )}
        </div>
      )}
    </motion.div>
  );
}

function relativeTime(value: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const minutes = Math.floor((Date.now() - date.getTime()) / 60000);
  if (minutes < 1) return 'Ahora';
  if (minutes < 60) return `Hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Hace ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Ayer';
  if (days < 7) return `Hace ${days} días`;
  return date.toLocaleDateString('es-BO', { day: '2-digit', month: 'short' });
}

function DashboardOverview() {
  const { data: hotels } = useHotels();
  const hotel = (Array.isArray(hotels) ? hotels[0] : undefined) as Hotel | undefined;
  const hotelId = hotel?.id || '';
  const { data: stats, isLoading } = useDashboardStats(hotelId);

  const cards = [
    {
      label: 'Unidades',
      value: stats?.units ?? 0,
      detail: `${stats?.rooms ?? 0} habitaciones · ${stats?.departments ?? 0} departamentos`,
      color: 'bg-green-500',
    },
    { label: 'Reservas', value: stats?.reservations ?? 0, detail: `${stats?.reservationsMonth ?? 0} este mes`, color: 'bg-purple-500' },
    { label: 'Comentarios pendientes', value: stats?.pendingComments ?? 0, detail: `${stats?.approvedComments ?? 0} aprobados`, color: 'bg-orange-500' },
    { label: 'Atractivos', value: stats?.attractions ?? 0, detail: `${stats?.activeAttractions ?? 0} activos`, color: 'bg-blue-500' },
  ];

  const dotColor = (type: string) =>
    type === 'reservation' ? 'bg-green-500' : type === 'comment' ? 'bg-yellow-500' : 'bg-blue-500';

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {cards.map((card) => (
          <div key={card.label} className="bg-white rounded-xl p-6 border border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-gray-500">{card.label}</span>
              <span className={`w-2 h-2 rounded-full ${card.color}`} />
            </div>
            {isLoading ? (
              <div className="h-9 flex items-center text-gray-400">
                <Loader2 className="w-5 h-5 animate-spin" />
              </div>
            ) : (
              <p className="text-3xl font-bold text-gray-900">{card.value}</p>
            )}
            <p className="text-sm text-gray-400 mt-1">{card.detail}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-100">
        <div className="p-6 border-b border-gray-100">
          <h3 className="text-lg font-serif text-gray-900">Actividad Reciente</h3>
        </div>
        {isLoading ? (
          <div className="flex items-center justify-center py-10 text-gray-400">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : stats && stats.activity.length > 0 ? (
          <div className="divide-y divide-gray-50">
            {stats.activity.map((item, index) => (
              <div key={`${item.type}-${index}`} className="p-4 flex items-center gap-4">
                <div className={`w-2 h-2 rounded-full ${dotColor(item.type)}`} />
                <div className="flex-1">
                  <p className="text-sm text-gray-900">{item.text}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{relativeTime(item.date)}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="p-6 text-sm text-gray-500">Todavía no hay reservas, comentarios ni consultas registradas.</p>
        )}
      </div>
    </div>
  );
}


// Hero Slides Section
function HeroSection() {
  const { data: hotels } = useHotels();
  const selectedHotelId = hotels?.[0]?.id;
  const { data: slides, isLoading, error } = useHeroSlides(selectedHotelId || '');

  return (
    <DataSection
      title="Carrusel Hero"
      description="Gestiona las imágenes del carrusel principal."
      isLoading={isLoading}
      error={error}
      data={slides || []}
      columns={[
        { key: 'title', label: 'Título' },
        { key: 'image_url', label: 'Imagen', render: (item: any) => (
          <img src={item.image_url} alt={item.title} className="w-16 h-10 object-cover rounded" />
        )},
        { key: 'order', label: 'Orden' },
        { key: 'active', label: 'Estado', render: (item: any) => (
          <span className={`px-2 py-1 rounded-full text-xs ${item.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
            {item.active ? 'Activo' : 'Inactivo'}
          </span>
        )},
      ]}
      emptyMessage="No hay slides en el carrusel"
      onAdd={() => {}}
    />
  );
}

// Tipos de habitación: inventario real (unidades físicas) agrupado por tipo.
function RoomsSection() {
  const { data: hotels } = useHotels();
  const hotel = (Array.isArray(hotels) ? hotels[0] : undefined) as Hotel | undefined;
  const hotelId = hotel?.id || '';
  // El inventario incluye tipos ocultos y tipos sin unidades: si se filtraran,
  // el PMS podría tener 20 tipos y esta pantalla mostrar solo 15 sin explicar
  // por qué. La galería sí los oculta, pero acá se administran todos.
  const { data: typesData, isLoading, error } = useRoomTypes(hotelId, true);
  const { data: unitsData } = useRoomUnits(hotelId);
  const queryClient = useQueryClient();
  const updateType = useUpdateRoomType();
  const [importOpen, setImportOpen] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [imageSavingId, setImageSavingId] = useState<string | null>(null);

  const saveTypeImage = async (type: RoomTypeInventory, url: string) => {
    setImageSavingId(type.id);
    try {
      await updateType.mutateAsync({ id: type.id, data: { image_url: url } });
      toast.success(`Foto de «${type.name}» actualizada`);
    } catch {
      toast.error('No se pudo guardar la foto del tipo');
    } finally {
      setImageSavingId(null);
    }
  };

  const toggleActive = async (type: RoomTypeInventory) => {
    setTogglingId(type.id);
    try {
      await updateType.mutateAsync({ id: type.id, data: { active: !type.active } });
      toast.success(type.active ? `«${type.name}» oculto` : `«${type.name}» publicado`);
    } catch {
      toast.error('No se pudo actualizar el tipo');
    } finally {
      setTogglingId(null);
    }
  };

  const types = (Array.isArray(typesData) ? typesData : []) as RoomTypeInventory[];
  const units = (Array.isArray(unitsData) ? unitsData : []) as RoomUnit[];

  const countByType = new Map<string, number>();
  units.forEach((unit) => countByType.set(unit.tipo_id, (countByType.get(unit.tipo_id) || 0) + 1));

  const groups = [
    { id: 'habitacion' as const, label: 'Habitaciones' },
    { id: 'departamento' as const, label: 'Departamentos' },
  ];
  const rows = groups
    .map((group) => ({
      group,
      types: types.filter((type) => type.grupo === group.id),
    }))
    .filter((entry) => entry.types.length > 0);

  const totalUnits = units.length;
  const totalRooms = types
    .filter((type) => type.grupo === 'habitacion')
    .reduce((sum, type) => sum + (countByType.get(type.id) || 0), 0);
  const totalDepartments = totalUnits - totalRooms;

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 p-10 flex items-center justify-center text-gray-500">
        <Loader2 className="w-5 h-5 animate-spin mr-3" /> Cargando habitaciones...
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 p-10 text-center">
        <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-3" />
        <p className="text-sm text-gray-600">{error.message}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-serif text-gray-900">Tipos de habitación</h2>
          <p className="text-gray-500">Cada tipo con sus unidades reales, capacidad y tarifa.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-white border border-gray-200 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.15em] text-gray-500">
            {types.length} tipos · {totalUnits} unidades · {totalRooms} habitaciones ·{' '}
            {totalDepartments} departamentos
          </span>
          <button
            type="button"
            onClick={() => setImportOpen(true)}
            disabled={!hotelId}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:border-gray-400 hover:text-gray-900 disabled:opacity-50"
          >
            <RefreshCw className="h-4 w-4" /> Importar desde RelaxPMS
          </button>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
          <Building2 className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">Todavía no hay unidades registradas.</p>
        </div>
      ) : (
        rows.map(({ group, types: groupTypes }) => {
          const groupUnits = groupTypes.reduce((sum, type) => sum + (countByType.get(type.id) || 0), 0);
          return (
            <div key={group.id} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-gray-100">
                <h3 className="font-serif text-lg text-gray-900">{group.label}</h3>
                <span className="text-xs text-gray-400">
                  {groupTypes.length} tipos · {groupUnits} unidades
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100">
                      {['Tipo', 'Unidades', 'Capacidad', 'Precio', 'Estado'].map((label) => (
                        <th key={label} className="text-left px-6 py-3 text-sm font-medium text-gray-500">
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {groupTypes.map((type) => {
                      const capacity =
                        type.min_capacity && type.max_capacity && type.min_capacity !== type.max_capacity
                          ? `${type.min_capacity} a ${type.max_capacity} personas`
                          : `${type.max_capacity || type.min_capacity || 1} personas`;
                      return (
                        <tr key={type.id} className="border-b border-gray-50 last:border-0">
                          <td className="px-6 py-3">
                            <div className="flex items-center gap-3">
                              {type.image_url ? (
                                <img
                                  src={type.image_url}
                                  alt={type.name}
                                  loading="lazy"
                                  className="w-12 h-12 rounded-lg object-cover"
                                />
                              ) : (
                                <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center text-gray-300">
                                  <Bed className="w-5 h-5" />
                                </div>
                              )}
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-gray-900">{type.name}</p>
                                <ImageUploadButton
                                  label="Cambiar foto"
                                  folder="relaxweb/tipos"
                                  successMessage=""
                                  disabled={imageSavingId === type.id}
                                  className="mt-1 !px-2 !py-1 !text-[10px]"
                                  onUploaded={(url) => void saveTypeImage(type, url)}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-3 text-sm text-gray-700">
                            <span className="block">{countByType.get(type.id) || 0}</span>
                            {(countByType.get(type.id) || 0) === 0 ? (
                              <span className="block text-[11px] text-amber-700">sin habitaciones</span>
                            ) : null}
                          </td>
                          <td className="px-6 py-3 text-sm text-gray-700">{capacity}</td>
                          <td className="px-6 py-3 text-sm text-gray-700">
                            {type.price ? `Bs. ${type.price.toLocaleString('es-BO')}` : 'Consultar'}
                          </td>
                          <td className="px-6 py-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={`px-2 py-1 rounded-full text-xs ${
                                  type.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                                }`}
                              >
                                {type.active ? 'Activo' : 'Oculto'}
                              </span>
                              <button
                                type="button"
                                onClick={() => void toggleActive(type)}
                                disabled={togglingId === type.id}
                                className="text-xs font-medium text-gray-500 underline-offset-2 hover:text-gray-900 hover:underline disabled:opacity-50"
                              >
                                {togglingId === type.id
                                  ? 'Guardando...'
                                  : type.active
                                    ? 'Ocultar'
                                    : 'Publicar'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })
      )}

      {importOpen ? (
        <PmsImportDialog
          hotelId={hotelId}
          onClose={() => setImportOpen(false)}
          onApplied={() => {
            queryClient.invalidateQueries({ queryKey: ['roomTypes'] });
            queryClient.invalidateQueries({ queryKey: ['roomUnits'] });
          }}
        />
      ) : null}
    </div>
  );
}

interface PmsImportPreview {
  pms: {
    types: number;
    rooms: number;
    types_with_rooms?: number;
    types_without_rooms?: number;
  };
  types: {
    create: Array<{ pms_id: number; name: string; grupo: string; units: number; empty: boolean }>;
    rename: Array<{ pms_id: number; from: string; to: string }>;
    unchanged: number;
  };
  units: {
    create: Array<{ pms_id: number; name: string; type_name: string; active?: boolean }>;
    update: Array<{ pms_id: number; name: string; to: { name: string }; changes: string[] }>;
    unchanged: number;
    skipped: Array<{ pms_id: number; name: string; reason: string }>;
    unusable?: Array<{
      pms_id: number;
      name: string;
      type_name: string;
      status: number | null;
      reason: string;
      is_new: boolean;
    }>;
  };
  missing: { types: Array<{ pms_id: number; name: string }>; units: Array<{ pms_id: number; name: string }> };
}

/**
 * Vista previa de la importación del catálogo del PMS.
 *
 * Muestra exactamente lo que va a cambiar y aplica el mismo plan que calculó
 * el servidor. No borra nada: lo que ya no está en el PMS se informa aparte.
 */
function PmsImportDialog({
  hotelId,
  onClose,
  onApplied,
}: {
  hotelId: string;
  onClose: () => void;
  onApplied: () => void;
}) {
  const [preview, setPreview] = useState<PmsImportPreview | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [overwriteNames, setOverwriteNames] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(
        `${import.meta.env.BASE_URL}api/admin/pms-import?hotel_id=${encodeURIComponent(hotelId)}`
      );
      const body = (await response.json().catch(() => null)) as
        | { data?: PmsImportPreview | null; error?: string | null }
        | null;
      if (!response.ok) throw new Error(body?.error || 'No se pudo leer el catálogo del PMS');
      setPreview(body?.data ?? null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo leer el catálogo del PMS');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // Solo al abrir: recargar es explícito con el botón Reintentar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const apply = async () => {
    setApplying(true);
    setError('');
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}api/admin/pms-import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hotel_id: hotelId, overwrite_names: overwriteNames }),
      });
      const body = (await response.json().catch(() => null)) as
        | {
            data?: {
              created_types: number;
              updated_types: number;
              created_units: number;
              updated_units: number;
              disabled_units?: number;
              errors: string[];
            } | null;
            error?: string | null;
          }
        | null;
      if (!response.ok) throw new Error(body?.error || 'No se pudo aplicar la importación');

      const data = body?.data;
      if (data?.errors?.length) {
        toast.error(data.errors[0]);
      } else {
        toast.success(
          `Importado: ${data?.created_types ?? 0} tipos y ${data?.created_units ?? 0} unidades nuevos` +
            (data?.disabled_units ? ` · ${data.disabled_units} deshabilitadas` : '')
        );
      }
      onApplied();
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo aplicar la importación');
    } finally {
      setApplying(false);
    }
  };

  const newTypes = preview?.types.create ?? [];
  const renames = preview?.types.rename ?? [];
  const newUnits = preview?.units.create ?? [];
  const updatedUnits = preview?.units.update ?? [];
  const unusableUnits = preview?.units.unusable ?? [];
  const skipped = preview?.units.skipped ?? [];
  const missingTypes = preview?.missing.types ?? [];
  const missingUnits = preview?.missing.units ?? [];
  const structuralChanges = newTypes.length + newUnits.length + updatedUnits.length;
  const nothingToDo = structuralChanges === 0 && renames.length === 0;
  const canApply = structuralChanges > 0 || (overwriteNames && renames.length > 0);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-6 py-4">
          <div>
            <h3 className="font-serif text-xl text-gray-900">Importar desde RelaxPMS</h3>
            <p className="mt-1 text-sm text-gray-500">
              Trae los tipos y habitaciones creados en el PMS. No borra nada y conserva fotos, precios,
              descripciones y amenidades del CMS.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {loading ? (
            <div className="flex items-center justify-center py-10 text-sm text-gray-500">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Consultando el PMS...
            </div>
          ) : error ? (
            <div className="rounded-xl border border-red-100 bg-red-50 p-4">
              <p className="text-sm text-red-700">{error}</p>
              <button
                type="button"
                onClick={() => void load()}
                className="mt-3 inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-sm text-red-700 hover:bg-red-50"
              >
                <RefreshCw className="h-4 w-4" /> Reintentar
              </button>
            </div>
          ) : preview ? (
            <div className="space-y-5">
              <p className="text-xs uppercase tracking-wider text-gray-400">
                El PMS tiene {preview.pms.types} tipos y {preview.pms.rooms} habitaciones
                {preview.pms.types_without_rooms
                  ? ` · ${preview.pms.types_without_rooms} sin habitaciones`
                  : ''}
              </p>

              {preview.pms.types_without_rooms ? (
                <p className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs leading-relaxed text-gray-600">
                  Los tipos sin habitaciones se importan igual, pero no se publican en la galería
                  hasta que el PMS les asigne al menos una unidad.
                </p>
              ) : null}

              {nothingToDo ? (
                <div className="rounded-xl border border-green-100 bg-green-50 p-4 text-sm text-green-800">
                  Todo al día: no hay tipos ni habitaciones nuevas para importar.
                </div>
              ) : (
                <div className="space-y-4">
                  {structuralChanges === 0 ? (
                    <p className="text-xs text-gray-500">
                      No hay altas ni cambios de unidades. Solo quedan nombres de tipos distintos.
                    </p>
                  ) : null}
                  {newTypes.length > 0 ? (
                    <div className="rounded-xl border border-gray-200 p-4">
                      <p className="text-sm font-medium text-gray-900">
                        {newTypes.length} tipo(s) nuevo(s)
                      </p>
                      <ul className="mt-2 space-y-1 text-xs text-gray-600">
                        {newTypes.slice(0, 8).map((type) => (
                          <li key={type.pms_id}>
                            {type.name}{' '}
                            <span className="text-gray-400">
                              · {type.grupo === 'departamento' ? 'Departamento' : 'Habitación'} ·{' '}
                              {type.units} unidad(es){type.empty ? ' · sin habitaciones en el PMS' : ''}
                            </span>
                          </li>
                        ))}
                        {newTypes.length > 8 ? (
                          <li className="text-gray-400">y {newTypes.length - 8} más…</li>
                        ) : null}
                      </ul>
                    </div>
                  ) : null}

                  {newUnits.length > 0 ? (
                    <div className="rounded-xl border border-gray-200 p-4">
                      <p className="text-sm font-medium text-gray-900">
                        {newUnits.length} unidad(es) nueva(s)
                      </p>
                      <p className="mt-1 text-xs text-gray-600">
                        {newUnits.slice(0, 10).map((unit) =>
                          `${unit.name} (${unit.type_name})${unit.active === false ? ' · deshabilitada' : ''}`
                        ).join(', ')}
                        {newUnits.length > 10 ? ` y ${newUnits.length - 10} más` : ''}
                      </p>
                    </div>
                  ) : null}

                  {unusableUnits.length > 0 ? (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                      <p className="text-sm font-medium text-amber-900">
                        {unusableUnits.length} unidad(es) quedarán deshabilitadas
                      </p>
                      <p className="mt-1 text-xs text-amber-800">
                        Están en mantenimiento o fuera de servicio en RelaxPMS. No se publican en la galería;
                        podés volver a habilitarlas desde el inventario.
                      </p>
                      <ul className="mt-2 space-y-1 text-xs text-amber-900">
                        {unusableUnits.slice(0, 8).map((unit) => (
                          <li key={`${unit.pms_id}-${unit.is_new ? 'new' : 'existing'}`}>
                            {unit.name} ({unit.type_name}){' '}
                            <span className="text-amber-700">· {unit.reason}</span>
                          </li>
                        ))}
                        {unusableUnits.length > 8 ? (
                          <li className="text-amber-700">y {unusableUnits.length - 8} más…</li>
                        ) : null}
                      </ul>
                    </div>
                  ) : null}

                  {updatedUnits.length > 0 ? (
                    <div className="rounded-xl border border-gray-200 p-4">
                      <p className="text-sm font-medium text-gray-900">
                        {updatedUnits.length} unidad(es) con cambios
                      </p>
                      <p className="mt-1 text-xs text-gray-600">
                        Se actualizan {[...new Set(updatedUnits.flatMap((unit) => unit.changes))].join(', ')}.
                        Los nombres de tipo no se tocan salvo que lo pidas abajo.
                      </p>
                    </div>
                  ) : null}

                  {renames.length > 0 ? (
                    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
                      <input
                        type="checkbox"
                        checked={overwriteNames}
                        onChange={(event) => setOverwriteNames(event.target.checked)}
                        className="mt-0.5 h-4 w-4 accent-gray-900"
                      />
                      <span className="text-xs leading-relaxed text-amber-900">
                        <span className="block text-sm font-medium">
                          Actualizar también los nombres de los {renames.length} tipos existentes
                        </span>
                        El PMS usa abreviaturas («MATR. VIP») y el CMS nombres para el huésped. Si no lo
                        marcás, se conservan los del CMS.
                      </span>
                    </label>
                  ) : null}
                </div>
              )}

              {skipped.length > 0 ? (
                <p className="text-xs text-amber-700">
                  {skipped.length} unidad(es) no se pueden importar: {skipped[0].reason}.
                </p>
              ) : null}

              {missingTypes.length + missingUnits.length > 0 ? (
                <p className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-xs text-gray-500">
                  Solo en el CMS (no se tocan): {missingTypes.length} tipo(s) y {missingUnits.length}{' '}
                  unidad(es) que ya no están en el PMS.
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-100 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void apply()}
            disabled={loading || !!error || !preview || !canApply || applying}
            className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {applying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Aplicar cambios
          </button>
        </div>
      </div>
    </div>
  );
}

// Amenities Section
function AmenitiesSection() {
  const { data: hotels } = useHotels();
  const selectedHotelId = hotels?.[0]?.id;
  const { data: amenities, isLoading, error } = useAmenities(selectedHotelId || '');

  return (
    <DataSection
      title="Amenidades"
      description="Gestiona las amenidades del hotel."
      isLoading={isLoading}
      error={error}
      data={amenities || []}
      columns={[
        { key: 'name', label: 'Nombre' },
        { key: 'category', label: 'Categoría' },
        { key: 'icon', label: 'Icono' },
        { key: 'active', label: 'Estado', render: (item: any) => (
          <span className={`px-2 py-1 rounded-full text-xs ${item.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
            {item.active ? 'Activa' : 'Inactiva'}
          </span>
        )},
      ]}
      emptyMessage="No hay amenidades registradas"
      onAdd={() => {}}
    />
  );
}

// Gallery Section: refleja exactamente lo que publica la vista /galeria
// (habitaciones y departamentos reales agrupados por tipo + instalaciones).
const GALLERY_GROUPS = [
  {
    id: 'habitacion' as const,
    label: 'Habitaciones',
    singular: 'Habitación',
    plural: 'habitaciones',
    description: 'Espacios cómodos pensados para descansar después de un día en Cochabamba.',
    Icon: Bed,
  },
  {
    id: 'departamento' as const,
    label: 'Departamentos',
    singular: 'Departamento',
    plural: 'departamentos',
    description: 'Ambientes amplios con capacidad para familias y grupos, con todas las comodidades.',
    Icon: Building2,
  },
];

function formatPrice(price: number | null) {
  if (!price || price <= 0) return null;
  return `Bs. ${price.toLocaleString('es-BO', { maximumFractionDigits: 0 })}`;
}

function unitLabel(name: string) {
  return name
    .replace(/^dep\.?\s*/i, '')
    .replace(/^n[.º°]?\s*/i, '')
    .replace(/^\./, '')
    .trim();
}

function GallerySection() {
  const { data: hotels } = useHotels();
  const hotel = (Array.isArray(hotels) ? hotels[0] : undefined) as Hotel | undefined;
  const hotelId = hotel?.id || '';
  // Se leen también los ocultos para poder explicar qué no se publica.
  const { data: typesData, isLoading: typesLoading, error: typesError } = useRoomTypes(hotelId, true);
  const { data: unitsData, isLoading: unitsLoading } = useRoomUnits(hotelId);
  const { data: gallery, isLoading: galleryLoading, error: galleryError } = useGallery(hotelId);
  const createGalleryItem = useCreateGalleryItem();
  const deleteGalleryItem = useDeleteGalleryItem();

  const [openTypeId, setOpenTypeId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ image_url: '', title: '', category: 'instalaciones', description: '' });
  const [formError, setFormError] = useState<string | null>(null);
  const [imageToDelete, setImageToDelete] = useState<{ id: string; title: string | null } | null>(null);

  const types = (Array.isArray(typesData) ? typesData : []) as RoomTypeInventory[];
  const units = (Array.isArray(unitsData) ? unitsData : []) as RoomUnit[];
  const images = (Array.isArray(gallery) ? gallery : []) as Array<{
    id: string;
    image_url: string;
    title: string | null;
    category: string | null;
  }>;

  const unitsByType = new Map<string, RoomUnit[]>();
  units.forEach((unit) => {
    if (!unitsByType.has(unit.tipo_id)) unitsByType.set(unit.tipo_id, []);
    unitsByType.get(unit.tipo_id)!.push(unit);
  });

  // La galería publica solo tipos activos y con al menos una unidad.
  const sections = GALLERY_GROUPS.map((group) => ({
    ...group,
    types: types.filter(
      (type) =>
        type.grupo === group.id &&
        type.active &&
        (unitsByType.get(type.id)?.length || 0) > 0
    ),
  })).filter((group) => group.types.length > 0);

  const hiddenTypes = types.filter((type) => !type.active).length;
  const emptyTypes = types.filter(
    (type) => type.active && (unitsByType.get(type.id)?.length || 0) === 0
  ).length;
  const notPublished = hiddenTypes + emptyTypes;

  const unitCount = (typeId: string) => unitsByType.get(typeId)?.length || 0;
  const totalUnits = units.length;
  const totalRooms = sections
    .filter((section) => section.id === 'habitacion')
    .reduce((sum, section) => sum + section.types.reduce((acc, type) => acc + unitCount(type.id), 0), 0);
  const totalDepartments = totalUnits - totalRooms;

  const handleCreate = async () => {
    if (!hotelId) {
      setFormError('Falta el hotel activo');
      return;
    }
    if (!form.image_url.trim()) {
      setFormError('La URL de la imagen es obligatoria');
      return;
    }
    try {
      await createGalleryItem.mutateAsync({
        hotel_id: hotelId,
        image_url: form.image_url.trim(),
        title: form.title.trim() || null,
        description: form.description.trim() || null,
        category: form.category.trim() || 'instalaciones',
        order: images.length,
      });
      setForm({ image_url: '', title: '', category: 'instalaciones', description: '' });
      setFormError(null);
      setShowForm(false);
    } catch {
      setFormError('No se pudo guardar la imagen');
    }
  };

  const confirmDeleteImage = async () => {
    if (!imageToDelete) return;
    try {
      await deleteGalleryItem.mutateAsync(imageToDelete.id);
      toast.success('Imagen eliminada');
      setImageToDelete(null);
    } catch {
      toast.error('No se pudo eliminar la imagen');
    }
  };

  if (typesError) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 p-10 text-center">
        <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-3" />
        <p className="text-sm text-gray-600">{typesError.message}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ConfirmDialog
        open={Boolean(imageToDelete)}
        title="Eliminar imagen"
        description={
          imageToDelete?.title
            ? `¿Eliminar la imagen “${imageToDelete.title}”? Esta acción no se puede deshacer.`
            : '¿Eliminar esta imagen? Esta acción no se puede deshacer.'
        }
        confirmLabel="Eliminar imagen"
        busy={deleteGalleryItem.isPending}
        onConfirm={() => void confirmDeleteImage()}
        onCancel={() => {
          if (!deleteGalleryItem.isPending) setImageToDelete(null);
        }}
      />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-serif text-gray-900">Galería</h2>
          <p className="text-gray-500">
            Habitaciones, departamentos e instalaciones tal como se publican en el sitio.
          </p>
        </div>
        <a
          href={`${import.meta.env.BASE_URL}galeria`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-white transition-colors"
        >
          <ExternalLink className="w-4 h-4" /> Ver en el sitio
        </a>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Unidades', value: totalUnits },
          { label: 'Habitaciones', value: totalRooms },
          { label: 'Departamentos', value: totalDepartments },
          { label: 'Imágenes de instalaciones', value: images.length },
        ].map((item) => (
          <div key={item.label} className="bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-xs uppercase tracking-wider text-gray-400">{item.label}</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">{item.value}</p>
          </div>
        ))}
      </div>

      {notPublished > 0 ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-900">
          {notPublished === 1
            ? '1 tipo del CMS no se publica en la galería'
            : `${notPublished} tipos del CMS no se publican en la galería`}
          {hiddenTypes > 0
            ? `: ${hiddenTypes} ${hiddenTypes === 1 ? 'oculto' : 'ocultos'}`
            : ''}
          {emptyTypes > 0
            ? `${hiddenTypes > 0 ? ' y' : ':'} ${emptyTypes} sin habitaciones`
            : ''}
          .{hiddenTypes > 0 ? ' Podés publicarlos desde «Tipos de habitación».' : ''}
          {emptyTypes > 0
            ? ' Los tipos sin unidades aparecen cuando el PMS les asigna habitaciones.'
            : ''}
        </p>
      ) : null}

      {typesLoading || unitsLoading ? (
        <div className="bg-white rounded-xl border border-gray-100 p-10 flex items-center justify-center text-gray-500">
          <Loader2 className="w-5 h-5 animate-spin mr-3" /> Cargando habitaciones...
        </div>
      ) : sections.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
          <Image className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">Todavía no hay habitaciones ni departamentos publicados.</p>
        </div>
      ) : (
        sections.map((section) => {
          const groupUnits = section.types.reduce((sum, type) => sum + unitCount(type.id), 0);
          return (
            <div key={section.id} className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gray-900 text-white">
                    <section.Icon className="w-5 h-5" strokeWidth={1.6} />
                  </span>
                  <div>
                    <h3 className="font-serif text-xl text-gray-900">{section.label}</h3>
                    <p className="text-xs text-gray-500">{section.description}</p>
                  </div>
                </div>
                <span className="rounded-full bg-white border border-gray-200 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.15em] text-gray-500">
                  {section.types.length} {section.types.length === 1 ? 'tipo' : 'tipos'} · {groupUnits}{' '}
                  {section.plural}
                </span>
              </div>

              <div className="space-y-3">
                {section.types.map((type) => {
                  const typeUnits = unitsByType.get(type.id) || [];
                  const price = formatPrice(type.price);
                  const isOpen = openTypeId === type.id;
                  const capacity =
                    type.min_capacity && type.max_capacity && type.min_capacity !== type.max_capacity
                      ? `Para ${type.min_capacity} a ${type.max_capacity} personas`
                      : type.max_capacity || type.min_capacity
                        ? `Para ${type.max_capacity || type.min_capacity} personas`
                        : null;

                  return (
                    <div
                      key={type.id}
                      className={`bg-white rounded-xl border overflow-hidden transition-shadow ${
                        isOpen ? 'border-gray-300 shadow-sm' : 'border-gray-100'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setOpenTypeId(isOpen ? null : type.id)}
                        aria-expanded={isOpen}
                        className="grid w-full text-left md:grid-cols-[120px_1fr_auto] items-stretch"
                      >
                        <div className="relative h-28 md:h-full bg-gray-100">
                          {type.image_url ? (
                            <img
                              src={type.image_url}
                              alt={type.name}
                              loading="lazy"
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center text-gray-300">
                              <section.Icon className="w-6 h-6" strokeWidth={1.5} />
                            </div>
                          )}
                        </div>

                        <div className="min-w-0 p-4">
                          <h4 className="font-serif text-lg text-gray-900">{type.name}</h4>
                          {type.description ? (
                            <p className="mt-1 line-clamp-1 text-xs text-gray-500">{type.description}</p>
                          ) : null}
                          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
                            {capacity ? (
                              <span className="inline-flex items-center gap-1.5">
                                <Users className="w-3.5 h-3.5" strokeWidth={1.8} /> {capacity}
                              </span>
                            ) : null}
                            <span>
                              {typeUnits.length}{' '}
                              {typeUnits.length === 1 ? section.singular.toLowerCase() : section.plural}
                            </span>
                            {!type.active ? <span className="text-amber-700">Inactivo</span> : null}
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-4 px-4 py-3 md:flex-col md:items-end md:justify-center border-t md:border-t-0 md:border-l border-gray-50">
                          <div className="md:text-right">
                            {price ? (
                              <>
                                <p className="text-[10px] uppercase tracking-[0.2em] text-gray-400">Desde</p>
                                <p className="font-serif text-lg text-gray-900">{price}</p>
                                <p className="text-[10px] uppercase tracking-wider text-gray-400">por noche</p>
                              </>
                            ) : (
                              <p className="text-xs text-gray-400">Consultar tarifa</p>
                            )}
                          </div>
                          <span
                            className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${
                              isOpen ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 text-gray-400'
                            }`}
                          >
                            <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                          </span>
                        </div>
                      </button>

                      {isOpen ? (
                        <div className="border-t border-gray-100 bg-gray-50/60 px-4 py-4">
                          <div className="mb-2 flex items-center justify-between">
                            <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-gray-500">
                              Unidades
                            </p>
                            <span className="text-[10px] text-gray-400">{typeUnits.length} en total</span>
                          </div>
                          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                            {typeUnits.map((unit) => (
                              <div key={unit.id} className="rounded-lg border border-gray-100 bg-white px-3 py-2">
                                <p className="text-xs font-semibold text-gray-900">
                                  {section.singular} {unitLabel(unit.name)}
                                </p>
                                <p className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-gray-500">
                                  {unit.floor ? (
                                    <span className="inline-flex items-center gap-1">
                                      <MapPin className="w-3 h-3" strokeWidth={1.8} /> {unit.floor}
                                    </span>
                                  ) : null}
                                  <span>
                                    {unit.capacity || 1} {unit.capacity === 1 ? 'persona' : 'personas'}
                                  </span>
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })
      )}

      <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-serif text-xl text-gray-900">Instalaciones</h3>
            <p className="text-xs text-gray-500">Fotos generales que aparecen al final de la galería pública.</p>
          </div>
          <button
            type="button"
            onClick={() => { setShowForm((value) => !value); setFormError(null); }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
          >
            <Plus className="w-4 h-4" /> Agregar imagen
          </button>
        </div>

        {showForm ? (
          <div className="space-y-3 rounded-lg border border-gray-100 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <ImageUploadButton
                label="Subir desde mi equipo"
                onUploaded={(url) => setForm({ ...form, image_url: url })}
              />
              <span className="text-xs text-gray-400">o pegá una URL abajo</span>
            </div>
            {form.image_url ? (
              <img
                src={form.image_url}
                alt="Vista previa"
                className="h-40 w-full rounded-lg object-cover"
              />
            ) : null}
            <input
              type="url"
              value={form.image_url}
              onChange={(event) => setForm({ ...form, image_url: event.target.value })}
              placeholder="https://... (URL de la imagen)"
              className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                value={form.title}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
                placeholder="Título (opcional)"
                className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
              />
              <input
                type="text"
                value={form.category}
                onChange={(event) => setForm({ ...form, category: event.target.value })}
                placeholder="Categoría"
                className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
              />
            </div>
            {formError ? <p className="text-sm text-red-600">{formError}</p> : null}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleCreate}
                disabled={createGalleryItem.isPending}
                className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
              >
                {createGalleryItem.isPending ? 'Guardando...' : 'Guardar imagen'}
              </button>
              <button
                type="button"
                onClick={() => { setShowForm(false); setFormError(null); }}
                className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : null}

        {galleryLoading ? (
          <div className="flex items-center justify-center py-8 text-gray-400">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : galleryError ? (
          <p className="text-sm text-red-600">{galleryError.message}</p>
        ) : images.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-200 p-8 text-center">
            <Image className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500">Todavía no hay imágenes de instalaciones.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {images.map((item) => (
              <figure key={item.id} className="group relative aspect-[4/3] overflow-hidden rounded-xl bg-gray-100">
                <img
                  src={item.image_url}
                  alt={item.title || 'Imagen de la galería'}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => setImageToDelete(item)}
                  disabled={deleteGalleryItem.isPending}
                  title="Eliminar imagen"
                  className="absolute top-2 right-2 p-2 rounded-lg bg-white/90 text-gray-600 hover:text-red-600 transition-colors disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                {item.title || item.category ? (
                  <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/65 to-transparent p-3 text-white">
                    {item.title ? <p className="text-sm font-medium">{item.title}</p> : null}
                    {item.category ? <p className="text-[11px] text-white/70">{item.category}</p> : null}
                  </figcaption>
                ) : null}
              </figure>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Attractions Section
function AttractionsSection() {
  const { data: hotels } = useHotels();
  const selectedHotelId = hotels?.[0]?.id;
  const { data: attractions, isLoading, error } = useAttractionsWithImages(selectedHotelId || '', true);

  return (
    <DataSection
      title="Atractivos Turísticos"
      description="Gestiona los atractivos turísticos cercanos."
      isLoading={isLoading}
      error={error}
      data={attractions || []}
      columns={[
        {
          key: 'title',
          label: 'Nombre',
          render: (item: any) => (
            <div className="flex items-center gap-3 min-w-0">
              {item.images?.[0]?.image_url ? (
                <img
                  src={item.images[0].image_url}
                  alt={item.title}
                  className="w-12 h-9 object-cover rounded flex-shrink-0"
                />
              ) : (
                <div className="w-12 h-9 rounded bg-gray-100 flex-shrink-0" />
              )}
              <span className="font-medium text-gray-900 truncate">{item.title}</span>
            </div>
          ),
        },
        { key: 'description', label: 'Descripción', render: (item: any) => (
          <span className="line-clamp-1">{item.description}</span>
        )},
        { key: 'location', label: 'Ubicación', render: (item: any) => (
          <span className="text-gray-500">{item.location || '—'}</span>
        )},
        { key: 'active', label: 'Estado', render: (item: any) => (
          <span className={`px-2 py-1 rounded-full text-xs ${item.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
            {item.active ? 'Activo' : 'Inactivo'}
          </span>
        )},
      ]}
      emptyMessage="No hay atractivos turísticos registrados"
      onAdd={() => {}}
    />
  );
}

// Comments Section
function CommentsSection() {
  const { data: hotels } = useHotels();
  const selectedHotelId = hotels?.[0]?.id;
  const { data: comments, isLoading, error } = useAllComments(selectedHotelId || '');
  const setStatus = useSetCommentStatus();
  const deleteComment = useDeleteComment();
  const [commentToDelete, setCommentToDelete] = useState<{ id: string; name: string } | null>(null);

  const confirmDeleteComment = async () => {
    if (!commentToDelete) return;
    try {
      await deleteComment.mutateAsync(commentToDelete.id);
      setCommentToDelete(null);
    } catch {
      toast.error('No se pudo eliminar el comentario');
    }
  };

  return (
    <>
      <DataSection
      title="Comentarios"
      description="Gestiona los comentarios y testimonios."
      isLoading={isLoading}
      error={error}
      data={comments || []}
      columns={[
        { key: 'name', label: 'Autor' },
        { key: 'content', label: 'Comentario', render: (item: any) => (
          <span className="line-clamp-1">{item.content}</span>
        )},
        { key: 'rating', label: 'Rating', render: (item: any) => (
          item.rating ? (
            <div className="flex items-center">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className={`w-4 h-4 ${i < item.rating ? 'text-yellow-400 fill-current' : 'text-gray-300'}`} />
              ))}
            </div>
          ) : (
            <span className="text-xs text-gray-400">Sin rating</span>
          )
        )},
        { key: 'status', label: 'Estado', render: (item: any) => {
          const styles: Record<string, string> = {
            approved: 'bg-green-100 text-green-800',
            pending: 'bg-yellow-100 text-yellow-800',
            rejected: 'bg-red-100 text-red-800',
          };
          const labels: Record<string, string> = {
            approved: 'Aprobado',
            pending: 'Pendiente',
            rejected: 'Rechazado',
          };
          return (
            <span className={`px-2 py-1 rounded-full text-xs ${styles[item.status] || 'bg-gray-100 text-gray-800'}`}>
              {labels[item.status] || item.status || '—'}
            </span>
          );
        }},
      ]}
      emptyMessage="No hay comentarios registrados"
      rowActions={(item: any) => (
        <>
          {item.status !== 'approved' && (
            <button
              type="button"
              onClick={() => setStatus.mutate({ id: item.id, status: 'approved' })}
              disabled={setStatus.isPending}
              title="Aprobar comentario"
              className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-40"
            >
              <Check className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setCommentToDelete({ id: item.id, name: item.name })}
            disabled={deleteComment.isPending}
            title="Eliminar comentario"
            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </>
      )}
      />
      <ConfirmDialog
        open={Boolean(commentToDelete)}
        title="Eliminar comentario"
        description={`¿Eliminar el comentario de ${commentToDelete?.name || 'este autor'}? Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar comentario"
        busy={deleteComment.isPending}
        onConfirm={() => void confirmDeleteComment()}
        onCancel={() => {
          if (!deleteComment.isPending) setCommentToDelete(null);
        }}
      />
    </>
  );
}

const RESERVATION_STATUS: Record<string, { label: string; className: string }> = {
  pending: { label: 'Pendiente', className: 'bg-yellow-100 text-yellow-800' },
  confirmed: { label: 'Confirmada', className: 'bg-green-100 text-green-800' },
  cancelled: { label: 'Cancelada', className: 'bg-red-100 text-red-700' },
  completed: { label: 'Completada', className: 'bg-gray-100 text-gray-700' },
};

function formatReservationDate(value: string | null) {
  if (!value) return '—';
  const date = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('es-BO', { day: '2-digit', month: 'short', year: 'numeric' });
}

// Reservas: solicitudes del formulario público, vinculadas a la cuenta del
// cliente cuando la hizo con sesión iniciada.
function ReservationsSection() {
  const { data: hotels } = useHotels();
  const selectedHotelId = hotels?.[0]?.id;
  const { data: reservations, isLoading, error } = useReservations(selectedHotelId || '');
  const setStatus = useSetReservationStatus();

  const changeStatus = (id: string, status: 'confirmed' | 'cancelled' | 'completed') => {
    setStatus.mutate(
      { id, status },
      {
        onSuccess: () =>
          toast.success(
            status === 'confirmed'
              ? 'Reserva confirmada'
              : status === 'cancelled'
                ? 'Reserva cancelada'
                : 'Reserva marcada como completada'
          ),
        onError: (mutationError) =>
          toast.error(
            mutationError instanceof Error
              ? mutationError.message
              : 'No se pudo actualizar la reserva'
          ),
      }
    );
  };

  return (
    <DataSection
      title="Reservas"
      description="Solicitudes recibidas desde el formulario público."
      isLoading={isLoading}
      error={error}
      data={reservations || []}
      columns={[
        {
          key: 'guest_name',
          label: 'Huésped',
          render: (item: any) => (
            <div>
              <p className="font-medium text-gray-900">{item.guest_name}</p>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-gray-500">
                <span className="inline-flex items-center gap-1">
                  <Phone className="w-3 h-3" /> {item.guest_phone}
                </span>
                {item.guest_email ? (
                  <span className="inline-flex items-center gap-1">
                    <Mail className="w-3 h-3" /> {item.guest_email}
                  </span>
                ) : null}
                {item.cliente_id ? (
                  <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] uppercase tracking-wider text-blue-700">
                    Cuenta de cliente
                  </span>
                ) : null}
              </p>
            </div>
          ),
        },
        {
          key: 'room_type',
          label: 'Habitación',
          render: (item: any) => (
            <div>
              <p className="text-gray-900">{item.room_type}</p>
              <p className="mt-0.5 text-xs text-gray-500">
                {item.adults || 1} adultos{item.children_count ? ` · ${item.children_count} niños` : ''}
              </p>
            </div>
          ),
        },
        {
          key: 'check_in',
          label: 'Fechas',
          render: (item: any) => (
            <div className="whitespace-nowrap">
              <p className="text-gray-900">{formatReservationDate(item.check_in)}</p>
              <p className="mt-0.5 text-xs text-gray-500">hasta {formatReservationDate(item.check_out)}</p>
            </div>
          ),
        },
        {
          key: 'message',
          label: 'Mensaje',
          render: (item: any) =>
            item.message ? (
              <p className="max-w-[14rem] text-xs leading-relaxed text-gray-600">{item.message}</p>
            ) : (
              <span className="text-gray-300">—</span>
            ),
        },
        {
          key: 'status',
          label: 'Estado',
          render: (item: any) => {
            const badge = RESERVATION_STATUS[item.status] || {
              label: item.status,
              className: 'bg-gray-100 text-gray-800',
            };
            return (
              <span className={`px-2 py-1 rounded-full text-xs ${badge.className}`}>{badge.label}</span>
            );
          },
        },
      ]}
      rowActions={(item: any) => (
        <>
          {item.status !== 'confirmed' && item.status !== 'completed' && (
            <button
              type="button"
              onClick={() => changeStatus(item.id, 'confirmed')}
              disabled={setStatus.isPending}
              title="Confirmar reserva"
              className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-40"
            >
              <Check className="w-4 h-4" />
            </button>
          )}
          {item.status !== 'cancelled' && (
            <button
              type="button"
              onClick={() => changeStatus(item.id, 'cancelled')}
              disabled={setStatus.isPending}
              title="Cancelar reserva"
              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40"
            >
              <XCircle className="w-4 h-4" />
            </button>
          )}
        </>
      )}
      emptyMessage="No hay reservas registradas"
      emptyHint="Las solicitudes del formulario público de la web aparecen acá."
    />
  );
}

const PROMOTION_TYPES: Array<{ value: Promotion['type']; label: string }> = [
  { value: 'discount', label: 'Descuento' },
  { value: 'event', label: 'Evento' },
  { value: 'package', label: 'Paquete' },
  { value: 'seasonal', label: 'Temporada' },
];

const EMPTY_PROMOTION = {
  title: '',
  description: '',
  type: 'discount' as Promotion['type'],
  discount_percent: '',
  discount_amount: '',
  code: '',
  start_date: '',
  end_date: '',
  image_url: '',
  active: true,
};

// Promociones: CRUD real contra la tabla `promociones` (el panel las ve todas,
// la web solo las activas y vigentes).
function PromotionsSection() {
  const { data: hotels } = useHotels();
  const selectedHotelId = hotels?.[0]?.id;
  const { data: promotions, isLoading, error } = useAdminPromotions(selectedHotelId || '');
  const createPromotion = useCreatePromotion();
  const updatePromotion = useUpdatePromotion();
  const deletePromotion = useDeletePromotion();

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_PROMOTION });
  const [formError, setFormError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [promotionToDelete, setPromotionToDelete] = useState<Promotion | null>(null);

  const openNew = () => {
    setEditingId(null);
    setForm({ ...EMPTY_PROMOTION });
    setFormError(null);
    setFormOpen(true);
  };

  const openEdit = (promotion: Promotion) => {
    setEditingId(promotion.id);
    setForm({
      title: promotion.title,
      description: promotion.description || '',
      type: promotion.type || 'discount',
      discount_percent: promotion.discount_percent ? String(promotion.discount_percent) : '',
      discount_amount: promotion.discount_amount ? String(promotion.discount_amount) : '',
      code: promotion.code || '',
      start_date: promotion.start_date ? promotion.start_date.slice(0, 10) : '',
      end_date: promotion.end_date ? promotion.end_date.slice(0, 10) : '',
      image_url: promotion.image_url || '',
      active: promotion.active !== false,
    });
    setFormError(null);
    setFormOpen(true);
  };

  const handleSave = async () => {
    if (!selectedHotelId) return;
    if (!form.title.trim()) {
      setFormError('El título es obligatorio');
      return;
    }
    if (!form.start_date || !form.end_date) {
      setFormError('Indicá el inicio y el fin de la promoción');
      return;
    }
    if (form.end_date < form.start_date) {
      setFormError('La fecha de fin no puede ser anterior al inicio');
      return;
    }

    const percent = Number(form.discount_percent.replace(',', '.'));
    const amount = Number(form.discount_amount.replace(',', '.'));
    const payload: Record<string, unknown> = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      type: form.type,
      discount_percent: Number.isFinite(percent) && percent > 0 ? percent : null,
      discount_amount: Number.isFinite(amount) && amount > 0 ? amount : null,
      code: form.code.trim() || null,
      start_date: form.start_date,
      end_date: form.end_date,
      image_url: form.image_url.trim() || null,
      active: form.active,
    };

    try {
      if (editingId) {
        await updatePromotion.mutateAsync({ id: editingId, data: payload });
        toast.success('Promoción actualizada');
      } else {
        await createPromotion.mutateAsync({ ...payload, hotel_id: selectedHotelId });
        toast.success('Promoción creada');
      }
      setFormOpen(false);
      setEditingId(null);
      setForm({ ...EMPTY_PROMOTION });
    } catch (saveError) {
      setFormError(saveError instanceof Error ? saveError.message : 'No se pudo guardar');
    }
  };

  const handleDelete = async () => {
    const promotion = promotionToDelete;
    if (!promotion) return;
    setDeletingId(promotion.id);
    try {
      await deletePromotion.mutateAsync(promotion.id);
      setPromotionToDelete(null);
      toast.success('Promoción eliminada');
    } catch (deleteError) {
      toast.error(deleteError instanceof Error ? deleteError.message : 'No se pudo eliminar');
    } finally {
      setDeletingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-gray-100 bg-white p-12 text-gray-500">
        <Loader2 className="mr-3 h-6 w-6 animate-spin" /> Cargando promociones...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-gray-100 bg-white p-10 text-center">
        <AlertCircle className="mx-auto mb-3 h-10 w-10 text-red-500" />
        <p className="text-gray-700">No se pudieron cargar las promociones</p>
        <p className="mt-1 text-sm text-gray-500">{error.message}</p>
      </div>
    );
  }

  const list = promotions || [];

  return (
    <div className="space-y-6">
      <ConfirmDialog
        open={Boolean(promotionToDelete)}
        title="Eliminar promoción"
        description={`¿Eliminar la promoción “${promotionToDelete?.title || ''}”? Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar promoción"
        busy={Boolean(deletingId)}
        onConfirm={() => void handleDelete()}
        onCancel={() => {
          if (!deletingId) setPromotionToDelete(null);
        }}
      />
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-serif text-gray-900">Promociones</h2>
          <p className="text-gray-500">Ofertas visibles en la página de promociones.</p>
        </div>
        <button
          type="button"
          onClick={openNew}
          className="flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800"
        >
          <Plus className="h-4 w-4" /> Nueva
        </button>
      </div>

      {formOpen ? (
        <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-gray-700">Título *</label>
              <input
                type="text"
                value={form.title}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
                className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-gray-900 focus:outline-none"
                placeholder="Escapada de fin de semana"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Tipo</label>
              <select
                value={form.type}
                onChange={(event) =>
                  setForm({ ...form, type: event.target.value as Promotion['type'] })
                }
                className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-gray-900 focus:outline-none"
              >
                {PROMOTION_TYPES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Código</label>
              <input
                type="text"
                value={form.code}
                onChange={(event) => setForm({ ...form, code: event.target.value })}
                className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-gray-900 focus:outline-none"
                placeholder="RELAX10"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-gray-700">Descripción</label>
              <textarea
                rows={3}
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
                className="w-full resize-none rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-gray-900 focus:outline-none"
                placeholder="Qué incluye la promoción"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Descuento (%)</label>
              <input
                type="number"
                min={0}
                max={100}
                step={0.5}
                value={form.discount_percent}
                onChange={(event) => setForm({ ...form, discount_percent: event.target.value })}
                className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-gray-900 focus:outline-none"
                placeholder="15"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Monto fijo (Bs.)</label>
              <input
                type="number"
                min={0}
                step={1}
                value={form.discount_amount}
                onChange={(event) => setForm({ ...form, discount_amount: event.target.value })}
                className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-gray-900 focus:outline-none"
                placeholder="50"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Inicio *</label>
              <input
                type="date"
                value={form.start_date}
                onChange={(event) => setForm({ ...form, start_date: event.target.value })}
                className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-gray-900 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Fin *</label>
              <input
                type="date"
                value={form.end_date}
                onChange={(event) => setForm({ ...form, end_date: event.target.value })}
                className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-gray-900 focus:outline-none"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-gray-700">Imagen (URL)</label>
              <div className="flex flex-wrap items-center gap-2">
                <ImageUploadButton
                  label="Subir desde mi equipo"
                  folder="relaxweb/promociones"
                  successMessage=""
                  onUploaded={(url) => setForm({ ...form, image_url: url })}
                />
                <span className="text-xs text-gray-400">o pegá una URL</span>
              </div>
              <input
                type="url"
                value={form.image_url}
                onChange={(event) => setForm({ ...form, image_url: event.target.value })}
                className="mt-2 w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-gray-900 focus:outline-none"
                placeholder="https://..."
              />
              {form.image_url ? (
                <img
                  src={form.image_url}
                  alt="Vista previa de la promoción"
                  className="mt-3 aspect-square w-32 rounded-lg border border-gray-200 object-cover"
                />
              ) : null}
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(event) => setForm({ ...form, active: event.target.checked })}
              className="h-4 w-4 rounded border-gray-300"
            />
            Visible en la web
          </label>

          {formError ? <p className="text-sm text-red-600">{formError}</p> : null}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={createPromotion.isPending || updatePromotion.isPending}
              className="flex items-center gap-2 rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
            >
              {createPromotion.isPending || updatePromotion.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              Guardar
            </button>
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="rounded-lg bg-gray-100 px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-200"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : null}

      {list.length === 0 ? (
        <div className="rounded-xl border border-gray-100 bg-white p-12 text-center">
          <Tag className="mx-auto mb-3 h-10 w-10 text-gray-300" />
          <p className="text-lg text-gray-900">No hay promociones registradas</p>
          <p className="mt-1 text-sm text-gray-500">Creá la primera para que aparezca en /promociones.</p>
          <button
            type="button"
            onClick={openNew}
            className="mt-5 rounded-lg bg-gray-900 px-6 py-3 text-sm font-medium text-white hover:bg-gray-800"
          >
            Crear promoción
          </button>
        </div>
      ) : (
        <div className="grid gap-3">
          {list.map((promotion) => (
            <div
              key={promotion.id}
              className="flex flex-wrap items-center gap-4 rounded-xl border border-gray-100 bg-white p-4"
            >
              <div className="h-16 w-24 shrink-0 overflow-hidden rounded-lg bg-gray-100">
                {promotion.image_url ? (
                  <img
                    src={promotion.image_url}
                    alt={promotion.title}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-gray-400">
                    <Tag className="h-5 w-5" />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-gray-900">{promotion.title}</p>
                <p className="text-xs text-gray-500">
                  {formatReservationDate(promotion.start_date)} →{' '}
                  {formatReservationDate(promotion.end_date)}
                  {promotion.discount_percent ? ` · ${promotion.discount_percent}%` : ''}
                  {promotion.discount_amount ? ` · Bs. ${promotion.discount_amount}` : ''}
                  {promotion.code ? ` · ${promotion.code}` : ''}
                </p>
              </div>
              <span
                className={`rounded-full px-2 py-1 text-[11px] ${
                  promotion.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                }`}
              >
                {promotion.active ? 'Visible' : 'Oculta'}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => openEdit(promotion)}
                  className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                  title="Editar"
                >
                  <Edit className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setPromotionToDelete(promotion)}
                  disabled={deletingId === promotion.id}
                  className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                  title="Eliminar"
                >
                  {deletingId === promotion.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const CLIENT_GENDER_LABELS: Record<string, string> = {
  femenino: 'Femenino',
  masculino: 'Masculino',
  otro: 'Otro',
  'prefiero-no-decir': 'Prefiere no decirlo',
};

// Valor del filtro para las cuentas anteriores al registro con país.
const NO_COUNTRY = 'sin-pais';

// Clients Section: cuentas de clientes (tabla clientes), separadas de los usuarios del sistema.
function ClientsSection() {
  const { data: hotels } = useHotels();
  const hotel = (Array.isArray(hotels) ? hotels[0] : undefined) as Hotel | undefined;
  const selectedHotelId = hotel?.id || '';
  const [clients, setClients] = useState<ClientAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', username: '', email: '', phone: '', password: '' });
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [clientToDelete, setClientToDelete] = useState<ClientAccount | null>(null);
  const [countryFilter, setCountryFilter] = useState('');

  const { countries: countryOptions, hasClientsWithoutCountry } = useMemo(() => {
    const names = new Set<string>();
    let withoutCountry = false;
    clients.forEach((client) => {
      if (client.country_name) names.add(client.country_name);
      else withoutCountry = true;
    });
    return {
      countries: Array.from(names).sort((a, b) => a.localeCompare(b, 'es')),
      hasClientsWithoutCountry: withoutCountry,
    };
  }, [clients]);

  const visibleClients = useMemo(() => {
    if (!countryFilter) return clients;
    if (countryFilter === NO_COUNTRY) return clients.filter((client) => !client.country_name);
    return clients.filter((client) => client.country_name === countryFilter);
  }, [clients, countryFilter]);

  const load = async () => {
    const { data, error: loadError } = await accountsApi.list<ClientAccount>('clients');
    setIsLoading(false);
    if (loadError) {
      setError(loadError);
      return;
    }
    setError(null);
    setClients(data || []);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreate = async () => {
    if (!form.name.trim() || !form.username.trim() || !form.password) {
      setFormError('Nombre, usuario y contraseña son obligatorios');
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const { data: created, error: createError, emailStatus } = await accountsApi.create<ClientAccount>('clients', {
        name: form.name.trim(),
        username: form.username.trim(),
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        password: form.password,
        hotel_id: selectedHotelId || undefined,
      });
      if (!created) {
        setFormError(createError || 'No se pudo crear el cliente');
        return;
      }
      setClients((current) => [created, ...current]);
      setForm({ name: '', username: '', email: '', phone: '', password: '' });
      setShowForm(false);
      if (emailStatus?.sent) {
        toast.success(`Credenciales enviadas a ${emailStatus.to}`);
      } else if (emailStatus) {
        toast.error(`Cliente creado, pero no se envió el correo: ${emailStatus.error}`);
      } else {
        toast.success('Cliente creado');
      }
    } catch {
      setFormError('No se pudo crear el cliente');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    const client = clientToDelete;
    if (!client) return;
    setDeletingId(client.id);
    const { error: deleteError } = await accountsApi.remove('clients', client.id);
    setDeletingId(null);
    if (deleteError) {
      toast.error(deleteError);
      return;
    }
    setClients((current) => current.filter((item) => item.id !== client.id));
    setClientToDelete(null);
    toast.success('Cliente eliminado');
  };

  return (
    <div className="space-y-4">
      <ConfirmDialog
        open={Boolean(clientToDelete)}
        title="Eliminar cliente"
        description={`¿Eliminar la cuenta de ${clientToDelete?.name || 'este cliente'}? Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar cliente"
        busy={Boolean(deletingId)}
        onConfirm={() => void handleDelete()}
        onCancel={() => {
          if (!deletingId) setClientToDelete(null);
        }}
      />
      {showForm && (
        <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-3">
          <h3 className="text-lg font-serif text-gray-900">Nuevo cliente</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="text"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              placeholder="Nombre completo"
              className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
            />
            <input
              type="text"
              value={form.username}
              onChange={(event) => setForm({ ...form, username: event.target.value })}
              placeholder="Nombre de usuario"
              className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
            />
            <input
              type="email"
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
              placeholder="Correo (opcional)"
              className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
            />
            <input
              type="tel"
              value={form.phone}
              onChange={(event) => setForm({ ...form, phone: event.target.value })}
              placeholder="Teléfono (opcional)"
              className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
            />
            <input
              type="password"
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
              placeholder="Contraseña"
              className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
            />
          </div>
          <p className="text-xs text-gray-400">
            El cliente entra por el mismo login del sitio; no se le pide captcha al crearlo desde acá. Si
            cargás un correo, recibe ahí su usuario y contraseña.
          </p>
          {formError && <p className="text-sm text-red-600">{formError}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleCreate}
              disabled={saving}
              className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              {saving ? 'Creando...' : 'Crear cliente'}
            </button>
            <button
              type="button"
              onClick={() => { setShowForm(false); setFormError(null); }}
              className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor="clients-country-filter" className="text-sm text-gray-500">
          País
        </label>
        <select
          id="clients-country-filter"
          value={countryFilter}
          onChange={(event) => setCountryFilter(event.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-900 transition-all"
        >
          <option value="">Todos los países</option>
          {countryOptions.map((country) => (
            <option key={country} value={country}>
              {country}
            </option>
          ))}
          {hasClientsWithoutCountry && <option value={NO_COUNTRY}>Sin país</option>}
        </select>
        {countryFilter && (
          <span className="text-xs text-gray-400">
            Mostrando {visibleClients.length} de {clients.length}
          </span>
        )}
      </div>

      <DataSection
        title="Clientes"
        description="Cuentas de clientes del hotel (distintas de los usuarios del sistema)."
        isLoading={isLoading}
        error={error ? new Error(error) : null}
        data={visibleClients}
        columns={[
          { key: 'name', label: 'Nombre' },
          { key: 'username', label: 'Usuario' },
          { key: 'email', label: 'Correo', render: (item: any) => item.email || '—' },
          { key: 'phone', label: 'Teléfono', render: (item: any) => item.phone || '—' },
          {
            key: 'country',
            label: 'País',
            render: (item: any) =>
              item.country_name
                ? `${item.country_name}${item.country_dial ? ` (${item.country_dial})` : ''}`
                : '—',
          },
          {
            key: 'gender',
            label: 'Género',
            render: (item: any) => CLIENT_GENDER_LABELS[item.gender] || item.gender || '—',
          },
          {
            key: 'active',
            label: 'Estado',
            render: (item: any) => (
              <span className={`px-2 py-1 rounded-full text-xs ${item.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                {item.active ? 'Activo' : 'Inactivo'}
              </span>
            ),
          },
        ]}
        emptyMessage="No hay clientes registrados"
        addLabel="Nuevo cliente"
        onAdd={() => setShowForm(true)}
        rowActions={(item: ClientAccount) => (
          <button
            type="button"
            onClick={() => setClientToDelete(item)}
            disabled={deletingId === item.id}
            title="Eliminar cliente"
            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      />
    </div>
  );
}

// Users Section
const EMPTY_USER_FORM = {
  name: '',
  username: '',
  email: '',
  password: '',
  role: 'moderator',
  active: true,
};

function formatAccountDate(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('es-BO', { dateStyle: 'medium', timeStyle: 'short' });
}

function UsersSection() {
  const { data: hotels } = useHotels();
  const selectedHotelId = hotels?.[0]?.id || '';
  const { user: currentUser } = useAuthStore();
  const { data: users, isLoading, error } = useUsers();
  const queryClient = useQueryClient();

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [viewing, setViewing] = useState<User | null>(null);
  const [form, setForm] = useState(EMPTY_USER_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);

  const roleLabels: Record<string, string> = {
    admin: 'Administrador',
    moderator: 'Moderador',
    client: 'Cliente',
  };

  const closeForm = () => {
    setShowForm(false);
    setEditing(null);
    setForm(EMPTY_USER_FORM);
    setFormError(null);
  };

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_USER_FORM);
    setFormError(null);
    setShowForm(true);
  };

  const openEdit = (user: User) => {
    setEditing(user);
    setForm({
      name: user.name || '',
      username: user.username || '',
      email: user.email || '',
      password: '',
      role: user.role === 'admin' ? 'admin' : 'moderator',
      active: user.active !== false,
    });
    setFormError(null);
    setShowForm(true);
  };

  const handleSave = async () => {
    const name = form.name.trim();
    const username = form.username.trim();
    if (!name || !username) {
      setFormError('Nombre y usuario son obligatorios');
      return;
    }
    if (!editing && !form.password) {
      setFormError('La contraseña es obligatoria para un usuario nuevo');
      return;
    }
    if (form.password && form.password.length < 6) {
      setFormError('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    setSaving(true);
    setFormError(null);
    setActionError(null);
    try {
      if (editing) {
        const { data: updated, error: updateError } = await accountsApi.update<User>('users', editing.id, {
          name,
          username,
          email: form.email.trim(),
          role: form.role,
          active: form.active,
          ...(form.password ? { password: form.password } : {}),
        });
        if (!updated) {
          setFormError(updateError || 'No se pudo actualizar el usuario');
          return;
        }
        await queryClient.invalidateQueries({ queryKey: ['users'] });
        toast.success('Usuario actualizado');
        closeForm();
        return;
      }

      // Alta desde el panel: no requiere captcha (la sesión de admin ya autenticó).
      const { data: created, error: createError, emailStatus } = await accountsApi.create<{ id: string }>('users', {
        name,
        username,
        email: form.email.trim() || undefined,
        password: form.password,
        role: form.role,
        hotel_id: selectedHotelId || undefined,
      });
      if (!created) {
        setFormError(createError || 'No se pudo crear el usuario');
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ['users'] });
      closeForm();
      if (emailStatus?.sent) {
        toast.success(`Credenciales enviadas a ${emailStatus.to}`);
      } else if (emailStatus) {
        toast.error(`Usuario creado, pero no se envió el correo: ${emailStatus.error}`);
      } else {
        toast.success('Usuario creado');
      }
    } catch {
      setFormError(editing ? 'No se pudo actualizar el usuario' : 'No se pudo crear el usuario');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    const user = userToDelete;
    if (!user || user.id === currentUser?.id) return;
    setDeletingId(user.id);
    setActionError(null);
    const { error: deleteError } = await accountsApi.remove('users', user.id);
    setDeletingId(null);
    if (deleteError) {
      setActionError(deleteError);
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ['users'] });
    setUserToDelete(null);
    toast.success('Usuario eliminado');
  };

  return (
    <div className="space-y-4">
      <ConfirmDialog
        open={Boolean(userToDelete)}
        title="Eliminar usuario"
        description={`¿Eliminar la cuenta de ${userToDelete?.name || 'este usuario'}${userToDelete?.username ? ` (@${userToDelete.username})` : ''}? Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar usuario"
        busy={Boolean(deletingId)}
        onConfirm={() => void handleDelete()}
        onCancel={() => {
          if (!deletingId) setUserToDelete(null);
        }}
      />
      {viewing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 p-4"
          onClick={() => setViewing(null)}
          role="presentation"
        >
          <div
            className="w-full max-w-md rounded-2xl border border-gray-100 bg-white p-6 shadow-xl"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={`Detalle de ${viewing.name}`}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-serif text-gray-900">{viewing.name}</h3>
                <p className="text-sm text-gray-500">@{viewing.username || 'sin usuario'}</p>
              </div>
              <button
                type="button"
                onClick={() => setViewing(null)}
                className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                title="Cerrar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <dl className="mt-5 space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-gray-500">Email</dt>
                <dd className="text-right text-gray-900">{viewing.email || '—'}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-gray-500">Rol</dt>
                <dd className="text-right text-gray-900">{roleLabels[viewing.role] || viewing.role}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-gray-500">Estado</dt>
                <dd className="text-right text-gray-900">{viewing.active !== false ? 'Activo' : 'Inactivo'}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-gray-500">Creado</dt>
                <dd className="text-right text-gray-900">{formatAccountDate(viewing.created_at)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-gray-500">Último acceso</dt>
                <dd className="text-right text-gray-900">{formatAccountDate(viewing.last_login)}</dd>
              </div>
            </dl>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  const target = viewing;
                  setViewing(null);
                  openEdit(target);
                }}
                className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
              >
                <Edit className="h-4 w-4" /> Editar
              </button>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-3">
          <h3 className="text-lg font-serif text-gray-900">
            {editing ? `Editar usuario · @${editing.username || ''}` : 'Nuevo usuario'}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="text"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              placeholder="Nombre completo"
              className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
            />
            <input
              type="text"
              value={form.username}
              onChange={(event) => setForm({ ...form, username: event.target.value })}
              placeholder="Nombre de usuario"
              className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
            />
            <input
              type="email"
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
              placeholder="Email (opcional)"
              className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
            />
            <input
              type="password"
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
              placeholder={editing ? 'Nueva contraseña (opcional)' : 'Contraseña'}
              autoComplete="new-password"
              className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
            />
            <select
              value={form.role}
              onChange={(event) => setForm({ ...form, role: event.target.value })}
              disabled={editing?.id === currentUser?.id}
              className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900/10 disabled:bg-gray-50 disabled:text-gray-500"
            >
              <option value="moderator">Moderador</option>
              <option value="admin">Administrador</option>
            </select>
            {editing ? (
              <label className="flex items-center gap-2 px-4 py-3 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={form.active}
                  disabled={editing.id === currentUser?.id}
                  onChange={(event) => setForm({ ...form, active: event.target.checked })}
                  className="h-4 w-4 rounded border-gray-300"
                />
                Cuenta activa
              </label>
            ) : null}
          </div>
          <p className="text-xs text-gray-400">
            {editing
              ? editing.id === currentUser?.id
                ? 'No podés cambiar tu propio rol ni desactivar tu cuenta. Dejá la contraseña vacía para conservarla.'
                : 'Dejá la contraseña vacía para conservarla. Los cambios se aplican al instante.'
              : 'Alta desde el panel: no pide captcha. Los clientes se crean en la pestaña Clientes. Si cargás un correo, recibe ahí su usuario y contraseña.'}
          </p>
          {formError && <p className="text-sm text-red-600">{formError}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving}
              className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              {saving ? 'Guardando...' : editing ? 'Guardar cambios' : 'Crear usuario'}
            </button>
            <button
              type="button"
              onClick={closeForm}
              className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {actionError && (
        <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          {actionError}
        </div>
      )}

      <DataSection
        title="Usuarios"
        description="Gestiona los usuarios del sistema."
        isLoading={isLoading}
        error={error}
        data={users || []}
        columns={[
          {
            key: 'name',
            label: 'Nombre',
            render: (item: any) => (
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-900">{item.name}</span>
                {currentUser?.id === item.id && (
                  <span className="px-2 py-0.5 rounded-full bg-gray-900 text-white text-[10px] uppercase tracking-wider">
                    Vos
                  </span>
                )}
              </div>
            ),
          },
          { key: 'username', label: 'Usuario' },
          { key: 'email', label: 'Email', render: (item: any) => item.email || '—' },
          { key: 'role', label: 'Rol', render: (item: any) => roleLabels[item.role] || item.role },
          {
            key: 'active',
            label: 'Estado',
            render: (item: any) => (
              <span className={`px-2 py-1 rounded-full text-xs ${item.active !== false ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                {item.active !== false ? 'Activo' : 'Inactivo'}
              </span>
            ),
          },
        ]}
        emptyMessage="No hay usuarios registrados"
        addLabel="Nuevo usuario"
        onAdd={openCreate}
        rowActions={(item: User) => (
          <>
            <button
              type="button"
              onClick={() => setViewing(item)}
              title="Ver detalle"
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <Eye className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => openEdit(item)}
              title="Editar usuario"
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <Edit className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setUserToDelete(item)}
              disabled={item.id === currentUser?.id || deletingId === item.id}
              title={item.id === currentUser?.id ? 'No podés eliminar tu propia cuenta' : 'Eliminar usuario'}
              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:cursor-not-allowed disabled:opacity-30"
            >
              {deletingId === item.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            </button>
          </>
        )}
      />
    </div>
  );
}

export default function AdminDashboard() {
  const [activeSection, setActiveSection] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: hotels } = useHotels();
  const hotelId = hotels?.[0]?.id || '';

  // Al pasar el mouse por "Promociones" la sección ya llega con sus datos.
  const prefetchSection = (id: string) => {
    if (id !== 'promotions' || !hotelId) return;
    void queryClient.prefetchQuery(adminPromotionsQueryOptions(hotelId));
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-64' : 'w-20'} bg-gray-900 text-white transition-all duration-300 flex flex-col`}>
        {/* Logo */}
        <div className="h-16 flex items-center px-6 border-b border-white/10">
          {sidebarOpen ? (
            <span className="text-lg font-serif font-semibold">CMS Hotel</span>
          ) : (
            <span className="text-lg font-serif font-semibold mx-auto">H</span>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4">
          {/* Ir a Web button */}
          <a
            href="/"
            className="w-full flex items-center gap-3 px-6 py-3 text-sm text-white/60 hover:text-white hover:bg-white/5 transition-all"
          >
            <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            {sidebarOpen && <span>Ir a Web</span>}
          </a>
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveSection(item.id)}
              onMouseEnter={() => prefetchSection(item.id)}
              onFocus={() => prefetchSection(item.id)}
              className={`w-full flex items-center gap-3 px-6 py-3 text-sm transition-all ${
                activeSection === item.id
                  ? 'bg-white/10 text-white border-r-2 border-white'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={item.icon} />
              </svg>
              {sidebarOpen && <span>{item.label}</span>}
            </button>
          ))}
        </nav>

        {/* Toggle */}
        <div className="p-4 border-t border-white/10">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="w-full flex items-center justify-center gap-2 py-2 text-white/60 hover:text-white transition-colors text-sm"
          >
            <svg className={`w-5 h-5 transition-transform ${sidebarOpen ? '' : 'rotate-180'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
            {sidebarOpen && <span>Contraer</span>}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col">
        {/* Top bar */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6">
          <h1 className="text-lg font-serif text-gray-900">
            {menuItems.find(i => i.id === activeSection)?.label || 'Dashboard'}
          </h1>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gray-900 flex items-center justify-center text-white text-xs font-bold">
                {user?.name?.charAt(0) || 'A'}
              </div>
              <div className="hidden md:block">
                <p className="text-sm font-medium text-gray-900">{user?.name || 'Admin'}</p>
                <p className="text-xs text-gray-500">{user?.role || 'admin'}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-sm text-gray-500 hover:text-gray-900 transition-colors"
            >
              Cerrar Sesión
            </button>
          </div>
        </header>

        {/* Content area */}
        <main className="flex-1 p-6 overflow-y-auto">
          <div>
            {activeSection === 'dashboard' && (
              <motion.div
                key="dashboard"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <DashboardOverview />
              </motion.div>
            )}

            {activeSection === 'settings' && (
              <motion.div
                key="settings"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <div className="space-y-6">
                  <StayScheduleSettings />
                  <CountryCodesEditor />
                  <SupabaseConnection />
                </div>
              </motion.div>
            )}

            {activeSection === 'hero' && <HeroSection />}
            {activeSection === 'rooms' && <RoomsSection />}
            {activeSection === 'amenities' && <AmenitiesSection />}
            {activeSection === 'gallery' && <GallerySection />}
            {activeSection === 'attractions' && <AttractionsSection />}
            {activeSection === 'comments' && <CommentsSection />}
            {activeSection === 'reservations' && <ReservationsSection />}
            {activeSection === 'promotions' && <PromotionsSection />}
            {activeSection === 'users' && <UsersSection />}
            {activeSection === 'clients' && <ClientsSection />}
          </div>
        </main>
      </div>
    </div>
  );
}
