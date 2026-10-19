import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '../api/client';
import type {
  Hotel, HeroSlide, Amenity,
  Attraction, GalleryItem, Comment, Inquiry, Reservation,
  Promotion, HotelConfig,
  RoomTypeInventory, RoomUnit, User
} from '../types';

// Hotels
export function useHotels() {
  return useQuery({
    queryKey: ['hotels'],
    queryFn: async () => {
      const { data, error } = await db.select<Hotel>('hoteles', {
        filters: { active: true },
        order: { column: 'name', ascending: true },
      });
      if (error) throw new Error(error);
      return data || [];
    },
  });
}

export function useHotel(slug: string) {
  return useQuery({
    queryKey: ['hotel', slug],
    queryFn: async () => {
      const { data, error } = await db.select<Hotel>('hoteles', {
        filters: { slug, active: true },
        single: true,
      });
      if (error) throw new Error(error);
      return data;
    },
    enabled: !!slug,
  });
}

// Hero Slides
export function useHeroSlides(hotelId: string) {
  return useQuery({
    queryKey: ['heroSlides', hotelId],
    queryFn: async () => {
      const { data, error } = await db.select<HeroSlide>('hero_slides', {
        filters: { hotel_id: hotelId, active: true },
        order: { column: 'order', ascending: true },
      });
      if (error) throw new Error(error);
      return data || [];
    },
    enabled: !!hotelId,
  });
}

export function useCreateHeroSlide() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Omit<HeroSlide, 'id' | 'created_at' | 'updated_at'>) => {
      const { data: result, error } = await db.insert<HeroSlide>('hero_slides', data);
      if (error) throw new Error(error);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['heroSlides'] });
    },
  });
}

export function useDeleteHeroSlide() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.delete('hero_slides', { id });
      if (error) throw new Error(error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['heroSlides'] });
    },
  });
}

export function useUpdateHeroSlides() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<HeroSlide> }) => {
      const { error } = await db.update('hero_slides', data, { id });
      if (error) throw new Error(error);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['heroSlides'] });
    },
  });
}

// Seed Hero Slides (demo data)
export function useSeedHeroSlides() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ hotelId, slides }: { hotelId: string; slides: Omit<import('../types').HeroSlide, 'id' | 'created_at' | 'updated_at'>[] }) => {
      let insertedCount = 0;
      for (const slide of slides) {
        const { error } = await db.insert('hero_slides', { ...slide, hotel_id: hotelId });
        if (error) throw new Error(error);
        insertedCount++;
      }
      return insertedCount;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['heroSlides'] });
    },
  });
}

// Inventario de tipos y unidades importado del PMS
export function useRoomTypes(hotelId: string, includeInactive = false) {
  return useQuery({
    queryKey: ['roomTypes', hotelId, includeInactive],
    queryFn: async () => {
      const params = {
        filters: includeInactive ? { hotel_id: hotelId } : { hotel_id: hotelId, active: true },
        order: { column: 'order', ascending: true },
      };
      // RLS oculta las filas inactivas al navegador: el panel las lee del servidor.
      const { data, error } = includeInactive
        ? await db.selectAdmin<RoomTypeInventory>('tipos_habitacion', params)
        : await db.select<RoomTypeInventory>('tipos_habitacion', params);
      if (error) throw new Error(error);
      return data || [];
    },
    enabled: !!hotelId,
  });
}

export function useRoomUnits(hotelId: string, includeInactive = false) {
  return useQuery({
    queryKey: ['roomUnits', hotelId, includeInactive],
    queryFn: async () => {
      const params = {
        filters: includeInactive ? { hotel_id: hotelId } : { hotel_id: hotelId, active: true },
        order: { column: 'order', ascending: true },
      };
      const { data, error } = includeInactive
        ? await db.selectAdmin<RoomUnit>('unidades_habitacion', params)
        : await db.select<RoomUnit>('unidades_habitacion', params);
      if (error) throw new Error(error);
      return data || [];
    },
    enabled: !!hotelId,
  });
}

// Habitaciones ocupadas en un rango de fechas (solo rótulos, sin datos del
// huésped). Las pendientes cuentan como ocupadas hasta que el hotel las cancele.
export function useRoomAvailability(hotelId: string, checkIn: string, checkOut: string) {
  return useQuery({
    queryKey: ['roomAvailability', hotelId, checkIn, checkOut],
    queryFn: async () => {
      const params = new URLSearchParams({
        hotel_id: hotelId,
        check_in: checkIn,
        check_out: checkOut,
      });
      const response = await fetch(`${import.meta.env.BASE_URL}api/public/availability?${params}`);
      const body = (await response.json().catch(() => null)) as
        | { data?: { rooms?: string[] | null } | null; error?: string | null }
        | null;
      if (!response.ok) {
        throw new Error(body?.error || 'No se pudo consultar la disponibilidad');
      }
      return body?.data?.rooms ?? [];
    },
    enabled: !!hotelId && !!checkIn && !!checkOut && checkOut > checkIn,
    staleTime: 30 * 1000,
  });
}

/**
 * Lo mismo que `useRoomAvailability`, con las fechas de cada estadía.
 *
 * La galería necesita saber CUÁNDO está ocupada una unidad para poder pintarla
 * como ocupada y ofrecer el botón de reserva solo para las libres. Comparte la
 * clave de caché con la versión simple para que reservar invalide las dos.
 */
export interface OccupiedRange {
  room_type: string;
  check_in: string;
  check_out: string;
}

export function useRoomAvailabilityRanges(
  hotelId: string,
  checkIn: string,
  checkOut: string
) {
  return useQuery({
    queryKey: ['roomAvailability', hotelId, checkIn, checkOut],
    queryFn: async () => {
      const params = new URLSearchParams({
        hotel_id: hotelId,
        check_in: checkIn,
        check_out: checkOut,
        detail: '1',
      });
      const response = await fetch(`${import.meta.env.BASE_URL}api/public/availability?${params}`);
      const body = (await response.json().catch(() => null)) as
        | { data?: { rooms?: string[] | null; ranges?: OccupiedRange[] | null } | null; error?: string | null }
        | null;
      if (!response.ok) {
        throw new Error(body?.error || 'No se pudo consultar la disponibilidad');
      }
      return {
        rooms: body?.data?.rooms ?? [],
        ranges: body?.data?.ranges ?? [],
      };
    },
    enabled: !!hotelId && !!checkIn && !!checkOut && checkOut > checkIn,
    staleTime: 30 * 1000,
  });
}

export function useUpdateRoomType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<RoomTypeInventory> }) => {
      const { error } = await db.update('tipos_habitacion', data as Record<string, unknown>, { id });
      if (error) throw new Error(error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roomTypes'] });
    },
  });
}

export function useUpdateRoomUnit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<RoomUnit> }) => {
      const { error } = await db.update('unidades_habitacion', data as Record<string, unknown>, { id });
      if (error) throw new Error(error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roomUnits'] });
    },
  });
}

// Amenities
export function useAmenities(hotelId: string, includeInactive = false) {
  return useQuery({
    queryKey: ['amenities', hotelId, includeInactive],
    queryFn: async () => {
      const { data, error } = await db.select<Amenity>('amenidades', {
        filters: includeInactive
          ? { hotel_id: hotelId }
          : { hotel_id: hotelId, active: true },
        order: { column: 'order', ascending: true },
      });
      if (error) throw new Error(error);
      return data || [];
    },
    enabled: !!hotelId,
  });
}

export function useCreateAmenity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<Amenity> & { hotel_id: string; name: string; category: string }) => {
      const { data: created, error } = await db.insert<Amenity>('amenidades', data as Record<string, unknown>);
      if (error) throw new Error(error);
      return created;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['amenities'] });
    },
  });
}

export function useUpdateAmenity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Amenity> }) => {
      const { error } = await db.update('amenidades', data as Record<string, unknown>, { id });
      if (error) throw new Error(error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['amenities'] });
    },
  });
}

export function useDeleteAmenity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.delete('amenidades', { id });
      if (error) throw new Error(error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['amenities'] });
    },
  });
}

// Attractions
export function useAttractions(hotelId: string, includeInactive = false) {
  return useQuery({
    queryKey: ['attractions', hotelId, includeInactive],
    queryFn: async () => {
      const { data, error } = await db.select<Attraction>('atractivos_turisticos', {
        filters: includeInactive ? { hotel_id: hotelId } : { hotel_id: hotelId, active: true },
        order: { column: 'order', ascending: true },
      });
      if (error) throw new Error(error);
      return data || [];
    },
    enabled: !!hotelId,
  });
}

export function useCreateAttraction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<Attraction> & { hotel_id: string; title: string }) => {
      const { data: created, error } = await db.insert<Attraction>('atractivos_turisticos', data as Record<string, unknown>);
      if (error) throw new Error(error);
      return created;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attractions'] });
      queryClient.invalidateQueries({ queryKey: ['attractionsWithImages'] });
    },
  });
}

export function useUpdateAttraction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Attraction> }) => {
      const { error } = await db.update('atractivos_turisticos', data as Record<string, unknown>, { id });
      if (error) throw new Error(error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attractions'] });
      queryClient.invalidateQueries({ queryKey: ['attractionsWithImages'] });
    },
  });
}

export function useDeleteAttraction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.delete('atractivos_turisticos', { id });
      if (error) throw new Error(error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attractions'] });
      queryClient.invalidateQueries({ queryKey: ['attractionsWithImages'] });
    },
  });
}

export function useAttractionsWithImages(hotelId: string, includeInactive = false) {
  return useQuery({
    queryKey: ['attractionsWithImages', hotelId, includeInactive],
    queryFn: async () => {
      const { data: attractions, error: err1 } = await db.select<any>('atractivos_turisticos', {
        filters: includeInactive ? { hotel_id: hotelId } : { hotel_id: hotelId, active: true },
        order: { column: 'order', ascending: true },
      });
      if (err1) throw new Error(err1);
      if (!attractions || attractions.length === 0) return [];

      // Fetch images for each attraction
      const results = await Promise.all(
        attractions.map(async (attr) => {
          const { data: images } = await db.select<any>('atractivo_imagenes', {
            filters: { attraction_id: attr.id },
            order: { column: 'order', ascending: true },
          });
          return { ...attr, images: images || [] };
        })
      );
      return results;
    },
    enabled: !!hotelId,
  });
}

// Gallery
export function useGallery(hotelId: string, category?: string) {
  return useQuery({
    queryKey: ['gallery', hotelId, category],
    queryFn: async () => {
      const filters: Record<string, unknown> = { hotel_id: hotelId };
      if (category) filters.category = category;

      const { data, error } = await db.select<GalleryItem>('galeria', {
        filters,
        order: { column: 'order', ascending: true },
      });
      if (error) throw new Error(error);
      return data || [];
    },
    enabled: !!hotelId,
  });
}

export function useCreateGalleryItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const { error } = await db.insert('galeria', data);
      if (error) throw new Error(error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gallery'] });
    },
  });
}

export function useUpdateGalleryItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) => {
      const { error } = await db.update('galeria', data, { id });
      if (error) throw new Error(error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gallery'] });
    },
  });
}

export function useDeleteGalleryItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.delete('galeria', { id });
      if (error) throw new Error(error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gallery'] });
    },
  });
}

// Comments
export function useComments(hotelId: string) {
  return useQuery({
    queryKey: ['comments', hotelId],
    queryFn: async () => {
      const { data, error } = await db.select<Comment>('comentarios', {
        filters: { hotel_id: hotelId, status: 'approved' },
        order: { column: 'created_at', ascending: false },
      });
      if (error) throw new Error(error);
      return data || [];
    },
    enabled: !!hotelId,
  });
}

// Usuarios del panel (sin exponer el hash de la contraseña).
export function useUsers(hotelId?: string) {
  return useQuery({
    queryKey: ['users', hotelId || 'all'],
    queryFn: async () => {
      const { data, error } = await db.select<User>('usuarios', {
        select: 'id,hotel_id,name,username,email,role,avatar_url,active,last_login,created_at',
        ...(hotelId ? { filters: { hotel_id: hotelId } } : {}),
        order: { column: 'name', ascending: true },
      });
      if (error) throw new Error(error);
      return data || [];
    },
  });
}

export function useSubmitComment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (comment: { hotel_id: string; name: string; email: string; content: string }) => {
      // Los comentarios públicos se envían por un endpoint sin sesión; el
      // backend valida y fuerza el estado `pending`.
      const response = await fetch(`${import.meta.env.BASE_URL}api/public/comment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(comment),
      });
      const body = (await response.json().catch(() => null)) as { error?: string | null } | null;
      if (!response.ok) throw new Error(body?.error || 'No se pudo enviar el comentario');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments'] });
    },
  });
}

// Inquiries
export function useSubmitInquiry() {
  return useMutation({
    mutationFn: async (inquiry: { hotel_id: string; name: string; email: string; phone?: string; message: string }) => {
      const { error } = await db.insert('consultas', inquiry);
      if (error) throw new Error(error);
    },
  });
}

// Promotions
export function usePromotions(hotelId: string) {
  return useQuery({
    queryKey: ['promotions', hotelId],
    queryFn: async () => {
      const { data, error } = await db.select<Promotion>('promociones', {
        filters: { hotel_id: hotelId, active: true },
        order: { column: 'created_at', ascending: false },
      });
      if (error) throw new Error(error);
      return data || [];
    },
    enabled: !!hotelId,
  });
}

// Hotel Config
export function useHotelConfig(hotelId: string) {
  return useQuery({
    queryKey: ['hotelConfig', hotelId],
    queryFn: async () => {
      const { data, error } = await db.select<HotelConfig>('configuracion_hotel', {
        filters: { hotel_id: hotelId },
      });
      if (error) throw new Error(error);
      return data || [];
    },
    enabled: !!hotelId,
  });
}

// Promociones en el panel: incluye las inactivas, a diferencia de la vista pública.
export function useAdminPromotions(hotelId: string) {
  return useQuery({
    queryKey: ['adminPromotions', hotelId],
    queryFn: async () => {
      const { data, error } = await db.select<Promotion>('promociones', {
        filters: { hotel_id: hotelId },
        order: { column: 'start_date', ascending: false },
      });
      if (error) throw new Error(error);
      return (data as Promotion[] | null) || [];
    },
    enabled: !!hotelId,
  });
}

function usePromotionMutation<TArgs>(
  run: (args: TArgs) => Promise<{ error: string | null }>
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (args: TArgs) => {
      const { error } = await run(args);
      if (error) throw new Error(error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminPromotions'] });
      queryClient.invalidateQueries({ queryKey: ['promotions'] });
    },
  });
}

export function useCreatePromotion() {
  return usePromotionMutation((data: Record<string, unknown>) => db.insert('promociones', data));
}

export function useUpdatePromotion() {
  return usePromotionMutation(({ id, data }: { id: string; data: Record<string, unknown> }) =>
    db.update('promociones', data, { id })
  );
}

export function useDeletePromotion() {
  return usePromotionMutation((id: string) => db.delete('promociones', { id }));
}

// Reservas (panel). Pasan por el backend autenticado: la tabla guarda datos
// personales de los huéspedes y no se lee con la clave anónima.
export function useReservations(hotelId: string) {
  return useQuery({
    queryKey: ['reservations', hotelId],
    queryFn: async () => {
      const response = await fetch(
        `${import.meta.env.BASE_URL}api/admin/reservations?hotel_id=${encodeURIComponent(hotelId)}`,
        { credentials: 'include' }
      );
      const body = (await response.json().catch(() => null)) as
        | { data?: Reservation[] | null; error?: string | null }
        | null;
      if (!response.ok) throw new Error(body?.error || 'No se pudieron cargar las reservas');
      return body?.data || [];
    },
    enabled: !!hotelId,
  });
}

// Cambiar el estado de una reserva desde el panel (confirmar, cancelar...).
export function useSetReservationStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Reservation['status'] }) => {
      const response = await fetch(`${import.meta.env.BASE_URL}api/admin/reservations`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      });
      const body = (await response.json().catch(() => null)) as { error?: string | null } | null;
      if (!response.ok) throw new Error(body?.error || 'No se pudo actualizar la reserva');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
    },
  });
}

// Update hotel mutation
export function useUpdateHotel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Hotel> }) => {
      const { error } = await db.update('hoteles', data as Record<string, unknown>, { id });
      if (error) throw new Error(error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hotels'] });
    },
  });
}

// All comments for admin (incluye pendientes: requiere sesión del CMS).
export function useAllComments(hotelId: string) {
  return useQuery({
    queryKey: ['allComments', hotelId],
    queryFn: async () => {
      const response = await fetch(
        `${import.meta.env.BASE_URL}api/admin/comments?hotel_id=${encodeURIComponent(hotelId)}`,
        { credentials: 'include' }
      );
      const body = (await response.json().catch(() => null)) as
        | { data?: Comment[]; error?: string | null }
        | null;
      if (!response.ok) throw new Error(body?.error || 'No se pudieron cargar los comentarios');
      return body?.data || [];
    },
    enabled: !!hotelId,
  });
}

export interface DashboardStats {
  rooms: number;
  departments: number;
  units: number;
  roomTypes: number;
  reservations: number;
  reservationsMonth: number;
  pendingComments: number;
  approvedComments: number;
  attractions: number;
  activeAttractions: number;
  gallery: number;
  activity: Array<{ type: 'reservation' | 'comment' | 'inquiry'; text: string; date: string }>;
}

// Estadísticas reales del panel (lectura autenticada con service role).
export function useDashboardStats(hotelId: string) {
  return useQuery({
    queryKey: ['dashboardStats', hotelId],
    queryFn: async () => {
      const response = await fetch(
        `${import.meta.env.BASE_URL}api/admin/stats?hotel_id=${encodeURIComponent(hotelId)}`,
        { credentials: 'include' }
      );
      const body = (await response.json().catch(() => null)) as
        | { data?: DashboardStats; error?: string | null }
        | null;
      if (!response.ok || !body?.data) throw new Error(body?.error || 'No se pudieron cargar las estadísticas');
      return body.data;
    },
    enabled: !!hotelId,
  });
}

export function useSetCommentStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'pending' | 'approved' | 'rejected' }) => {
      const { error } = await db.update('comentarios', { status }, { id });
      if (error) throw new Error(error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allComments'] });
      queryClient.invalidateQueries({ queryKey: ['comments'] });
    },
  });
}

export function useDeleteComment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.delete('comentarios', { id });
      if (error) throw new Error(error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allComments'] });
      queryClient.invalidateQueries({ queryKey: ['comments'] });
    },
  });
}

// All inquiries for admin
export function useAllInquiries(hotelId: string) {
  return useQuery({
    queryKey: ['allInquiries', hotelId],
    queryFn: async () => {
      const { data, error } = await db.select<Inquiry>('consultas', {
        filters: { hotel_id: hotelId },
        order: { column: 'created_at', ascending: false },
      });
      if (error) throw new Error(error);
      return data || [];
    },
    enabled: !!hotelId,
  });
}

// Hotel Config mutations
export function useUpsertHotelConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ hotelId, key, value, group }: { hotelId: string; key: string; value: string; group?: string }) => {
      // Try to find existing config
      const { data: existing } = await db.select<HotelConfig>('configuracion_hotel', {
        filters: { hotel_id: hotelId, key },
        single: true,
      });
      if (existing) {
        const { error } = await db.update('configuracion_hotel', { value }, { id: existing.id });
        if (error) throw new Error(error);
      } else {
        const { error } = await db.insert('configuracion_hotel', {
          hotel_id: hotelId,
          key,
          value,
          group: group || 'general',
        });
        if (error) throw new Error(error);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hotelConfig'] });
    },
  });
}
