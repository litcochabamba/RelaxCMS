import { useState, useEffect, useRef } from 'react';
import { deleteMedia, storagePathFromUrl, uploadMedia } from '../../api/client';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useCmsPanelStore } from '../../store/cmsStore';
import {
  useHotels, useRooms, useRoomCategories, useAmenities,
  useUpdateRoom, useUpdateHotel,
  useHeroSlides, useUpdateHeroSlides, useCreateHeroSlide, useDeleteHeroSlide, useSeedHeroSlides,
  useHotelConfig, useUpsertHotelConfig,
  useBookingRoomTypes, useUpdateBookingRoomType, useCreateBookingRoomType, useDeleteBookingRoomType,
  useComments,
  useAttractionsWithImages,
} from '../../hooks/useQueries';
import HeroMediaPicker, { SlideMediaPreview, type HeroMediaField } from './HeroMediaPicker';import ImageFolderPicker from './ImageFolderPicker';
import AmenitiesEditor, { type AmenitiesEditorHandle } from './AmenitiesEditor';
import HomeBlocksEditor from './HomeBlocksEditor';
import AttractionsEditor, { type AttractionsEditorHandle } from './AttractionsEditor';
import RoomInventoryEditor from './RoomInventoryEditor';
import Media from '../common/Media';
import MapEmbed from '../common/MapEmbed';
import { resolveMapEmbed } from '../../utils/mapEmbed';
import {
  DEFAULT_INFO_TITLE,
  DEFAULT_INFO_DESCRIPTION,
  DEFAULT_INFO_IMAGE_SETS,
  parseInfoImageSets,
  type ShowcaseImageSet,
} from '../home/HotelShowcaseSection';
import { DEMO_HERO_SLIDES } from '../../utils/seedData';
import { parseHeroOffsetX } from '../home/HeroSection';
import toast from 'react-hot-toast';
import type { Attraction, AttractionImage, HeroSlide, Hotel, Room, RoomCategory } from '../../types';
import {
  Palette,
  Info,
  Calendar,
  Star,
  BedDouble,
  Phone,
  Map,
  MapPin,
  MessageSquare,
  Settings,
  Loader2,
  Edit3,
  Save,
  X,
  Plus,
  Trash2,
  GripVertical,
  Image as ImageIcon,
  Upload,
  ChevronUp,
  ChevronDown,
  Megaphone,
} from 'lucide-react';

// Cada sección pertenece a la pestaña del sitio que edita. Las globales
// (colores, configuración) aplican a todo el sitio y se ven en todas.
type SectionPage = 'home' | 'gallery' | 'promotions' | 'contact' | 'global';

interface SectionDefinition {
  id: string;
  label: string;
  Icon: typeof Palette;
  page: SectionPage;
}

// El orden sigue el orden real de las secciones en la página de inicio.
const sections: SectionDefinition[] = [
  { id: 'hero', label: 'Hero', Icon: Palette, page: 'home' },
  { id: 'info', label: 'Información', Icon: Info, page: 'home' },
  { id: 'amenities', label: 'Amenidades', Icon: Star, page: 'home' },
  { id: 'rooms', label: 'Habitaciones', Icon: BedDouble, page: 'home' },
  { id: 'booking', label: 'Reservas', Icon: Calendar, page: 'home' },
  { id: 'attractions', label: 'Atractivos', Icon: Map, page: 'home' },
  { id: 'comments', label: 'Comentarios', Icon: MessageSquare, page: 'home' },
  { id: 'blocks', label: 'Avisos y cintas', Icon: Megaphone, page: 'home' },
  { id: 'gallery_header', label: 'Encabezado', Icon: Info, page: 'gallery' },
  { id: 'inventory', label: 'Tipos y unidades', Icon: BedDouble, page: 'gallery' },
  { id: 'promotions_header', label: 'Encabezado', Icon: Megaphone, page: 'promotions' },
  { id: 'contact', label: 'Contacto', Icon: Phone, page: 'contact' },
  { id: 'colors', label: 'Colores', Icon: Palette, page: 'global' },
  { id: 'settings', label: 'Configuración', Icon: Settings, page: 'global' },
];

const PAGE_LABELS: Record<Exclude<SectionPage, 'global'>, string> = {
  home: 'Inicio',
  gallery: 'Galería',
  promotions: 'Promociones',
  contact: 'Contacto',
};

type ConfigEntry = { key: string; value: string };

function parseAttractionDurations(value?: string): Record<string, number> {
  if (!value) return {};
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>)
        .map(([id, seconds]) => [id, Number(seconds)] as const)
        .filter(([, seconds]) => Number.isFinite(seconds) && seconds > 0)
    );
  } catch {
    return {};
  }
}

function parseIdList(value?: string): string[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === 'string' && id.length > 0);
  } catch {
    return [];
  }
}

function serializeInfoSets(sets: ShowcaseImageSet[]): string {
  return JSON.stringify(
    sets.map((set) => ({
      id: set.id,
      main: set.images[0],
      secondary: set.images[1],
      mainMap: set.maps?.[0] ?? null,
      secondaryMap: set.maps?.[1] ?? null,
    }))
  );
}

export default function CmsPanel() {
  const { isOpen, activeSection, toggle, setActiveSection } = useCmsPanelStore();
  const { pathname } = useLocation();

  // Secciones visibles según la pestaña abierta del sitio.
  const currentPage: Exclude<SectionPage, 'global'> = pathname.startsWith('/galeria')
    ? 'gallery'
    : pathname.startsWith('/promociones')
      ? 'promotions'
      : pathname.startsWith('/contacto')
        ? 'contact'
        : 'home';
  const pageSections = sections.filter((section) => section.page === currentPage);
  const globalSections = sections.filter((section) => section.page === 'global');

  const { data: hotels } = useHotels();
  // useHotels devuelve la lista; el panel edita el primer hotel activo.
  const hotel = (Array.isArray(hotels) ? hotels[0] : undefined) as Hotel | undefined;
  const hotelId = hotel?.id || '';

  const { data: rooms = [], isLoading: roomsLoading } = useRooms(hotelId);
  const roomList = (Array.isArray(rooms) ? rooms : []) as Room[];
  const { data: categories = [] } = useRoomCategories(hotelId);
  const { data: amenities = [], isLoading: amenitiesLoading } = useAmenities(hotelId, true);
  const { data: heroSlides = [], isLoading: heroLoading } = useHeroSlides(hotelId);
  const { data: hotelConfigs = [] } = useHotelConfig(hotelId);
  const amenitiesGroupsConfig =
    (hotelConfigs as ConfigEntry[]).find((config) => config.key === 'amenities_groups')?.value || '';
  const amenitiesEditorRef = useRef<AmenitiesEditorHandle>(null);
  const { data: bookingRoomTypes = [], isLoading: brtLoading } = useBookingRoomTypes(hotelId);
  const { data: attractionsAll = [], isLoading: attractionsLoading } = useAttractionsWithImages(hotelId, true);
  const attractionsEditorRef = useRef<AttractionsEditorHandle>(null);
  const attractionsFolderOverrides =
    (hotelConfigs as ConfigEntry[]).find((config) => config.key === 'attractions_media_folders')?.value || '';
  const attractionsDurations = parseAttractionDurations(
    (hotelConfigs as ConfigEntry[]).find((config) => config.key === 'attractions_durations')?.value || ''
  );
  const homeBlocksConfig =
    (hotelConfigs as ConfigEntry[]).find((config) => config.key === 'home_blocks')?.value || '';
  const promoRibbonConfig =
    (hotelConfigs as ConfigEntry[]).find((config) => config.key === 'promo_ribbon_placements')?.value ||
    '';
  const { data: dbComments = [] } = useComments(hotelId);

  const updateHotel = useUpdateHotel();
  const updateRoom = useUpdateRoom();
  const updateHeroSlide = useUpdateHeroSlides();
  const createHeroSlide = useCreateHeroSlide();
  const deleteHeroSlide = useDeleteHeroSlide();
  const seedHeroSlides = useSeedHeroSlides();
  const upsertConfig = useUpsertHotelConfig();
  const updateBRT = useUpdateBookingRoomType();
  const createBRT = useCreateBookingRoomType();
  const deleteBRT = useDeleteBookingRoomType();

  const [editingHotel, setEditingHotel] = useState<Record<string, string>>({});
  const [logoUploading, setLogoUploading] = useState(false);
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null);
  const [editingRoom, setEditingRoom] = useState<Record<string, string>>({});

  // Hero slides state
  const [editingSlideId, setEditingSlideId] = useState<string | null>(null);
  const [editingSlide, setEditingSlide] = useState<Record<string, string>>({});
  const [showNewSlideForm, setShowNewSlideForm] = useState(false);
  const [newSlide, setNewSlide] = useState<Record<string, string>>({
    title: '',
    description: '',
    button_text: 'Reservar Ahora',
    image_url: '',
    image_mobile_url: '',
    video_url: '',
    video_mobile_url: '',
  });

  // Section content editing state
  const [editingSection, setEditingSection] = useState<Record<string, string>>({});
  const [heroOffsetX, setHeroOffsetX] = useState('0');
  const [infoSets, setInfoSets] = useState<ShowcaseImageSet[]>(DEFAULT_INFO_IMAGE_SETS);
  const [infoPickerSlot, setInfoPickerSlot] = useState<Record<string, 'main' | 'secondary'>>({});

  // Vista previa en vivo del desplazamiento del hero: el slider escribe una
  // variable CSS que HeroSection usa mientras el panel está abierto.
  useEffect(() => {
    const root = document.documentElement;
    if (activeSection !== 'hero') {
      root.style.removeProperty('--hero-content-offset-x');
      return;
    }
    root.style.setProperty('--hero-content-offset-x', `${parseHeroOffsetX(heroOffsetX)}px`);
    return () => {
      root.style.removeProperty('--hero-content-offset-x');
    };
  }, [activeSection, heroOffsetX]);

  // Al cambiar de pestaña, se cierra la sección que ya no pertenece a la vista.
  useEffect(() => {
    if (!activeSection) return;
    const section = sections.find((item) => item.id === activeSection);
    if (section && section.page !== 'global' && section.page !== currentPage) {
      setActiveSection(null);
    }
  }, [activeSection, currentPage, setActiveSection]);

  // Sync hotel config when loaded
  useEffect(() => {
    if (hotelConfigs.length > 0) {
      const configMap: Record<string, string> = {};
      hotelConfigs.forEach(c => { configMap[c.key] = c.value; });
      setInfoSets(parseInfoImageSets(configMap.info_image_sets) || DEFAULT_INFO_IMAGE_SETS);
      setHeroOffsetX(configMap.hero_content_offset_x || '0');
      setEditingSection({
        info_title: configMap.info_title || DEFAULT_INFO_TITLE,
        info_description: configMap.info_description || DEFAULT_INFO_DESCRIPTION,
        booking_title: configMap.booking_title || 'Reserva una\nHabitación',
        booking_description: configMap.booking_description || 'Consulta la disponibilidad de nuestras habitaciones. Nuestro equipo estará encantado de atenderte a través de WhatsApp para confirmar tu reserva.',
        booking_types_duration: configMap.booking_types_duration || '6',
        amenities_title: configMap.amenities_title || 'Amenidades',
        amenities_description: configMap.amenities_description || 'Todo lo que necesitas para una estancia perfecta. Disfruta de nuestras instalaciones y servicios diseñados para tu comodidad.',
        rooms_title: configMap.rooms_title || 'Habitaciones & Departamentos',
        rooms_description: configMap.rooms_description || 'Descubre nuestras habitaciones diseñadas para ofrecerte la máxima comodidad y una experiencia inolvidable.',
        rooms_count: configMap.rooms_count || '5',
        rooms_featured_ids: configMap.rooms_featured_ids || '[]',
        rooms_cta_color: configMap.rooms_cta_color || '#D4AF37',
        rooms_cta_text_color: configMap.rooms_cta_text_color || '#1a1a2e',
        contact_title: configMap.contact_title || 'Consulta sin\nCompromiso',
        contact_description: configMap.contact_description || 'Estamos aquí para ayudarte. Envíanos un mensaje y te responderemos lo antes posible.',
        attractions_title: configMap.attractions_title || 'Atractivos Turísticos',
        attractions_description: configMap.attractions_description || 'Pasa tus mejores momentos visitando los hermosos atractivos turísticos que Cochabamba tiene para ti y recupera energías hospedándote en nuestros hoteles. Será un placer recibirte.',
        attractions_card_color: configMap.attractions_card_color || '#ffffff',
        attractions_card_opacity: configMap.attractions_card_opacity || '82',
        attractions_card_blur: configMap.attractions_card_blur || '12',
        comments_title: configMap.comments_title || 'Lo que dicen nuestros huéspedes',
        gallery_title: configMap.gallery_title || 'Galería',
        gallery_description: configMap.gallery_description || 'Conoce nuestras habitaciones y departamentos. Elegí un tipo para ver sus unidades disponibles.',
        promotions_title: configMap.promotions_title || 'Promociones',
        promotions_description: configMap.promotions_description || 'Ofertas y paquetes publicados por el hotel. Consultá condiciones y disponibilidad por WhatsApp.',
      });
    }
  }, [hotelConfigs]);

  // Sync hotel data when loaded
  useEffect(() => {
    if (hotel) {
      setEditingHotel({
        primary_color: hotel.primary_color || '#8B0000',
        secondary_color: hotel.secondary_color || '#1a1a2e',
        accent_color: hotel.accent_color || '#D4AF37',
        name: hotel.name || '',
        whatsapp: hotel.whatsapp || '',
        email: hotel.email || '',
        address: hotel.address || '',
        facebook: hotel.facebook || '',
        instagram: hotel.instagram || '',
        tiktok: hotel.tiktok || '',
        phone: hotel.phone || '',
        logo_url: hotel.logo_url || '',
      });
    }
  }, [hotel]);

  const categoryList = (Array.isArray(categories) ? categories : []) as RoomCategory[];
  const categoryMap = Object.fromEntries(categoryList.map(c => [c.id, c.name]));

  // Orden de los tipos principales en la portada (ids de habitaciones del CMS).
  const featuredRoomIds = parseIdList(editingSection.rooms_featured_ids);
  const setFeaturedRoomIds = (ids: string[]) =>
    setEditingSection(prev => ({ ...prev, rooms_featured_ids: JSON.stringify(ids) }));
  const moveFeaturedRoom = (index: number, delta: number) => {
    const next = [...featuredRoomIds];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setFeaturedRoomIds(next);
  };

  const handleSaveColors = async () => {
    if (!hotelId) return;
    try {
      await updateHotel.mutateAsync({
        id: hotelId,
        data: {
          primary_color: editingHotel.primary_color,
          secondary_color: editingHotel.secondary_color,
          accent_color: editingHotel.accent_color,
        },
      });
      toast.success('Colores actualizados');
    } catch {
      toast.error('Error al guardar colores');
    }
  };

  const handleSaveSettings = async () => {
    if (!hotelId) return;
    try {
      await updateHotel.mutateAsync({
        id: hotelId,
        data: {
          name: editingHotel.name,
          whatsapp: editingHotel.whatsapp,
          email: editingHotel.email,
          address: editingHotel.address,
          facebook: editingHotel.facebook,
          instagram: editingHotel.instagram,
          tiktok: editingHotel.tiktok,
          phone: editingHotel.phone,
          logo_url: editingHotel.logo_url || null,
        },
      });
      toast.success('Configuracion actualizada');
    } catch {
      toast.error('Error al guardar configuracion');
    }
  };

  const handleSaveAttractionDurations = async (durations: Record<string, number>) => {
    if (!hotelId) throw new Error('Falta el hotel');
    await upsertConfig.mutateAsync({
      hotelId,
      key: 'attractions_durations',
      value: JSON.stringify(durations),
      group: 'sections',
    });
  };

  const handleLogoUpload = async (file: File | undefined) => {
    if (!file || !hotelId) return;
    if (file.size > 50 * 1024 * 1024) {
      toast.error('La imagen supera los 50 MB');
      return;
    }
    setLogoUploading(true);
    const { media, error } = await uploadMedia(file, 'branding/logos');
    if (error || !media) {
      toast.error(error || 'No se pudo subir el logo');
      setLogoUploading(false);
      return;
    }
    try {
      await updateHotel.mutateAsync({ id: hotelId, data: { logo_url: media.url } });
      setEditingHotel((prev) => ({ ...prev, logo_url: media.url }));
      toast.success('Logo actualizado');
    } catch {
      toast.error('No se pudo guardar el logo');
    }
    setLogoUploading(false);
  };

  const handleLogoRemove = async () => {
    if (!hotelId) return;
    const previous = editingHotel.logo_url;
    setLogoUploading(true);
    try {
      await updateHotel.mutateAsync({ id: hotelId, data: { logo_url: null } });
      setEditingHotel((prev) => ({ ...prev, logo_url: '' }));
      const path = previous ? storagePathFromUrl(previous) : null;
      if (path) await deleteMedia(path);
      toast.success('Logo eliminado');
    } catch {
      toast.error('No se pudo quitar el logo');
    }
    setLogoUploading(false);
  };

  const handleSaveRoom = async (roomId: string) => {
    try {
      const data: Record<string, unknown> = {
        name: editingRoom.name,
        price: parseFloat(editingRoom.price) || 0,
        max_guests: parseInt(editingRoom.max_guests) || 2,
        description: editingRoom.description,
      };
      if (editingRoom.services) {
        data.services = editingRoom.services.split(',').map(s => s.trim()).filter(Boolean);
      }
      if (editingRoom.amenities) {
        data.amenities = editingRoom.amenities.split(',').map(s => s.trim()).filter(Boolean);
      }
      await updateRoom.mutateAsync({ id: roomId, data });
      setEditingRoomId(null);
      toast.success('Habitacion actualizada');
    } catch {
      toast.error('Error al guardar habitacion');
    }
  };

  const startEditRoom = (room: { id: string; name: string; price: number; max_guests: number; description: string | null; services: string[]; amenities: string[] }) => {
    setEditingRoomId(room.id);
    setEditingRoom({
      name: room.name,
      price: String(room.price),
      max_guests: String(room.max_guests),
      description: room.description || '',
      services: (room.services || []).join(', '),
      amenities: (room.amenities || []).join(', '),
    });
  };

  const handleSave = async (section: string) => {
    if (section === 'colors') return handleSaveColors();
    if (section === 'settings') return handleSaveSettings();
    if (['info', 'booking', 'amenities', 'rooms', 'contact', 'attractions', 'comments', 'gallery_header', 'promotions_header'].includes(section)) {
      return handleSaveSection(section);
    }
  };

  const handleSaveSection = async (section: string) => {
    if (!hotelId) return;
    try {
      const prefix = section === 'gallery_header'
        ? 'gallery'
        : section === 'promotions_header'
          ? 'promotions'
          : section;
      const keys = [`${prefix}_title`, `${prefix}_description`];
      for (const key of keys) {
        if (editingSection[key] !== undefined) {
          await upsertConfig.mutateAsync({ hotelId, key, value: editingSection[key] || '', group: 'sections' });
        }
      }
      if (section === 'booking') {
        const seconds = Math.min(
          Math.max(parseInt(editingSection.booking_types_duration || '6', 10) || 6, 2),
          60
        );
        await upsertConfig.mutateAsync({
          hotelId,
          key: 'booking_types_duration',
          value: String(seconds),
          group: 'sections',
        });
      }
      if (section === 'rooms') {
        const count = Math.min(Math.max(parseInt(editingSection.rooms_count || '5', 10) || 5, 1), 24);
        await upsertConfig.mutateAsync({
          hotelId,
          key: 'rooms_count',
          value: String(count),
          group: 'sections',
        });
        const validIds = featuredRoomIds.filter(id => roomList.some(room => room.id === id));
        await upsertConfig.mutateAsync({
          hotelId,
          key: 'rooms_featured_ids',
          value: JSON.stringify(validIds),
          group: 'sections',
        });
        const hex = (value: string | undefined, fallback: string) =>
          /^#[0-9a-f]{6}$/i.test((value || '').trim()) ? value!.trim() : fallback;
        await upsertConfig.mutateAsync({
          hotelId,
          key: 'rooms_cta_color',
          value: hex(editingSection.rooms_cta_color, '#D4AF37'),
          group: 'sections',
        });
        await upsertConfig.mutateAsync({
          hotelId,
          key: 'rooms_cta_text_color',
          value: hex(editingSection.rooms_cta_text_color, '#1a1a2e'),
          group: 'sections',
        });
      }
      if (section === 'info') {
        await upsertConfig.mutateAsync({
          hotelId,
          key: 'info_image_sets',
          value: serializeInfoSets(infoSets),
          group: 'sections',
        });
      }
      // Amenidades: grupos, orden, visibilidad e ítems viven en su propio editor.
      if (section === 'amenities') {
        await amenitiesEditorRef.current?.save();
      }
      // Atractivos: filas y carpeta de medios por atractivo.
      if (section === 'attractions') {
        for (const key of ['attractions_card_color', 'attractions_card_opacity', 'attractions_card_blur']) {
          if (editingSection[key] !== undefined) {
            await upsertConfig.mutateAsync({ hotelId, key, value: editingSection[key] || '', group: 'sections' });
          }
        }
        await attractionsEditorRef.current?.save();
      }
      toast.success(`Seccion ${section.charAt(0).toUpperCase() + section.slice(1)} actualizada`);
    } catch (error) {
      toast.error(error instanceof Error && error.message ? error.message : `Error al guardar ${section}`);
    }
  };

  // Encabezados de página (Galería / Promociones): no llevan etiqueta, solo
  // título y descripción, igual que el resto de las secciones.
  const pageHeaderPrefix = activeSection === 'gallery_header'
    ? 'gallery'
    : activeSection === 'promotions_header'
      ? 'promotions'
      : null;

  const handleSaveBooking = async () => handleSaveSection('booking');
  const handleSaveAmenities = async () => handleSaveSection('amenities');

  // Hero: desplazamiento horizontal del bloque de contenido (global, todos los slides).
  const handleSaveHeroOffset = async () => {
    if (!hotelId) return;
    const value = String(parseHeroOffsetX(heroOffsetX));
    try {
      await upsertConfig.mutateAsync({ hotelId, key: 'hero_content_offset_x', value, group: 'sections' });
      setHeroOffsetX(value);
      toast.success('Posicion del hero actualizada');
    } catch (error) {
      toast.error(error instanceof Error && error.message ? error.message : 'Error al guardar la posicion');
    }
  };

  // Información: título, párrafos y pares de imágenes del carrusel.
  const updateInfoSetImage = (index: number, slot: 'main' | 'secondary', url: string) => {
    setInfoSets((prev) =>
      prev.map((set, position) => {
        if (position !== index) return set;
        const images: [string, string] = slot === 'main'
          ? [url, set.images[1]]
          : [set.images[0], url];
        return { ...set, images };
      })
    );
  };

  // Cada espacio de un conjunto puede ser imagen/video (null) o mapa (string
  // con el enlace pegado; vacío = modo mapa todavía sin enlace).
  const updateInfoSetMap = (
    index: number,
    slot: 'main' | 'secondary',
    link: string | null
  ) => {
    setInfoSets((prev) =>
      prev.map((set, position) => {
        if (position !== index) return set;
        const maps: [string | null, string | null] = set.maps
          ? [set.maps[0], set.maps[1]]
          : [null, null];
        maps[slot === 'main' ? 0 : 1] = link;
        return { ...set, maps };
      })
    );
  };

  const addInfoSet = () => {
    setInfoSets((prev) => [
      ...prev,
      { id: `info-${Date.now()}`, images: ['', ''], maps: [null, null] },
    ]);
  };

  const removeInfoSet = (index: number) => {
    setInfoSets((prev) => prev.filter((_, position) => position !== index));
  };

  const renderSectionButton = (section: SectionDefinition) => {
    const Icon = section.Icon;
    return (
      <button
        key={section.id}
        onClick={() => setActiveSection(section.id)}
        className="w-full flex items-center gap-3 p-4 rounded-xl border border-gray-100 hover:border-gray-200 hover:bg-gray-50 transition-all text-left"
      >
        <div className="w-10 h-10 rounded-lg bg-gray-50 flex items-center justify-center">
          <Icon className="w-5 h-5 text-gray-600" strokeWidth={1.5} />
        </div>
        <span className="font-medium text-gray-900">{section.label}</span>
        <svg className="w-4 h-4 text-gray-400 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
      </button>
    );
  };

  // Hero slides handlers
  const startEditSlide = (slide: HeroSlide) => {
    setEditingSlideId(slide.id);
    setEditingSlide({
      title: slide.title,
      description: slide.description || '',
      button_text: slide.button_text || '',
      image_url: slide.image_url,
      image_mobile_url: slide.image_mobile_url || '',
      video_url: slide.video_url || '',
      video_mobile_url: slide.video_mobile_url || '',
      duration: String(slide.duration || 6),
    });
  };

  const handleSaveSlide = async () => {
    if (!editingSlideId) return;
    try {
      await updateHeroSlide.mutateAsync({
        id: editingSlideId,
        data: {
          title: editingSlide.title,
          description: editingSlide.description || null,
          button_text: editingSlide.button_text || null,
          image_url: editingSlide.image_url,
          image_mobile_url: editingSlide.image_mobile_url || null,
          video_url: editingSlide.video_url || null,
          video_mobile_url: editingSlide.video_mobile_url || null,
          duration: parseInt(editingSlide.duration) || 6,
        },
      });
      setEditingSlideId(null);
      toast.success('Slide actualizado');
    } catch {
      toast.error('Error al guardar slide');
    }
  };

  const handleCreateSlide = async () => {
    if (!hotelId) return;
    if (!newSlide.title.trim()) {
      toast.error('El titulo es requerido');
      return;
    }
    try {
      await createHeroSlide.mutateAsync({
        hotel_id: hotelId,
        title: newSlide.title,
        description: newSlide.description || null,
        button_text: newSlide.button_text || null,
        button_link: null,
        image_url:
          newSlide.image_url || `${import.meta.env.BASE_URL}hero/images/horizontal/2.jpg`,
        image_mobile_url: newSlide.image_mobile_url || null,
        video_url: newSlide.video_url || null,
        video_mobile_url: newSlide.video_mobile_url || null,
        duration: 6,
        order: heroSlides.length,
        active: true,
      });
      setShowNewSlideForm(false);
      setNewSlide({ title: '', description: '', button_text: 'Reservar Ahora', image_url: '', image_mobile_url: '', video_url: '', video_mobile_url: '' });
      toast.success('Slide creado');
    } catch {
      toast.error('Error al crear slide');
    }
  };

  const handleDeleteSlide = async (id: string) => {
    try {
      await deleteHeroSlide.mutateAsync(id);
      toast.success('Slide eliminado');
    } catch {
      toast.error('Error al eliminar slide');
    }
  };

  const handleToggleSlideActive = async (slide: HeroSlide) => {
    try {
      await updateHeroSlide.mutateAsync({
        id: slide.id,
        data: { active: !slide.active },
      });
      toast.success(slide.active ? 'Slide desactivado' : 'Slide activado');
    } catch {
      toast.error('Error al cambiar estado');
    }
  };

  const handleSeedSlides = async () => {
    if (!hotelId) return;
    try {
      const count = await seedHeroSlides.mutateAsync({ hotelId, slides: DEMO_HERO_SLIDES });
      toast.success(`${count} slides de ejemplo cargados`);
    } catch {
      toast.error('Error al cargar datos de ejemplo');
    }
  };

  return (
    <>
      {/* Panel — se abre desde el botón CMS del navbar */}
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/30 z-50"
              onClick={toggle}
            />

            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'tween', duration: 0.3 }}
              className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-white z-50 shadow-2xl flex flex-col"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-gray-100">
                <div>
                  <h2 className="text-lg font-serif text-gray-900">Panel CMS</h2>
                  <p className="text-xs text-gray-500 mt-1">Edita el contenido del sitio</p>
                </div>
                <button
                  onClick={toggle}
                  className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors"
                  aria-label="Cerrar panel"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto">
                {!activeSection ? (
                  <div className="p-6 space-y-3">
                    <div className="mb-4">
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Secciones</p>
                      <p className="text-xs text-gray-400 mt-1">Página: {PAGE_LABELS[currentPage]}</p>
                    </div>

                    {pageSections.map(renderSectionButton)}

                    {pageSections.length === 0 && (
                      <p className="rounded-xl border border-dashed border-gray-200 p-4 text-xs leading-relaxed text-gray-500">
                        Esta página no tiene secciones editables. Los avisos y cintas se editan desde
                        Inicio.
                      </p>
                    )}

                    {globalSections.length > 0 && (
                      <>
                        <p className="text-xs font-medium text-gray-400 uppercase tracking-wider pt-4">
                          Ajustes generales
                        </p>
                        {globalSections.map(renderSectionButton)}
                      </>
                    )}
                  </div>
                ) : (
                  <div className="p-6">
                    <button
                      onClick={() => { setActiveSection(null); setEditingRoomId(null); }}
                      className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors mb-6"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                      Volver
                    </button>

                    <h3 className="text-xl font-serif text-gray-900 mb-6">
                      Editar {sections.find(s => s.id === activeSection)?.label}
                    </h3>

                    {/* Colors section */}
                    {activeSection === 'colors' && (
                      <div className="space-y-5">
                        {[
                          { key: 'primary_color', label: 'Color Primario', default: '#8B0000' },
                          { key: 'secondary_color', label: 'Color Secundario', default: '#1a1a2e' },
                          { key: 'accent_color', label: 'Color de Acento', default: '#D4AF37' },
                        ].map(({ key, label, default: def }) => (
                          <div key={key}>
                            <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
                            <div className="flex gap-3">
                              <input
                                type="color"
                                value={editingHotel[key] || def}
                                onChange={(e) => setEditingHotel({ ...editingHotel, [key]: e.target.value })}
                                className="w-12 h-12 rounded-lg border border-gray-200 cursor-pointer"
                              />
                              <input
                                type="text"
                                value={editingHotel[key] || def}
                                onChange={(e) => setEditingHotel({ ...editingHotel, [key]: e.target.value })}
                                className="flex-1 px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-900 font-mono"
                              />
                            </div>
                          </div>
                        ))}

                        {/* Muestra cómo quedan los colores en navbar y footer */}
                        <div className="rounded-xl border border-gray-200 p-3">
                          <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-gray-500">
                            Vista previa
                          </p>
                          <div
                            className="flex items-center justify-between rounded-lg px-3 py-2"
                            style={{ backgroundColor: editingHotel.secondary_color || '#1a1a2e' }}
                          >
                            <span
                              className="flex h-6 items-center rounded px-2 text-[10px] font-semibold uppercase tracking-wider text-white"
                              style={{ backgroundColor: editingHotel.primary_color || '#8B0000' }}
                            >
                              CMS
                            </span>
                            <span
                              className="h-2 w-10 rounded-full"
                              style={{ backgroundColor: editingHotel.accent_color || '#D4AF37' }}
                            />
                          </div>
                          <p className="mt-2 text-[11px] text-gray-400">
                            El secundario pinta el navbar y el footer, el primario la franja y los botones, y el
                            acento los enlaces activos y los íconos sociales. Se aplica al guardar.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Settings section */}
                    {activeSection === 'settings' && (
                      <div className="space-y-5">
                        <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-500">
                            Logo
                          </p>
                          <div className="flex items-center gap-3">
                            <div className="flex h-16 w-32 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-white">
                              {editingHotel.logo_url ? (
                                <img
                                  src={editingHotel.logo_url}
                                  alt="Vista previa del logo"
                                  className="max-h-14 w-auto max-w-[112px] object-contain"
                                />
                              ) : (
                                <span className="px-2 text-center text-[10px] uppercase tracking-wider text-gray-400">
                                  Sin logo
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <label
                                className={`flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white ${
                                  logoUploading ? 'bg-gray-400' : 'bg-gray-900 hover:bg-gray-800'
                                }`}
                              >
                                {logoUploading ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Upload className="h-3.5 w-3.5" />
                                )}
                                {editingHotel.logo_url ? 'Cambiar' : 'Subir logo'}
                                <input
                                  type="file"
                                  accept="image/png,image/jpeg,image/webp,image/svg+xml,image/avif"
                                  className="hidden"
                                  disabled={logoUploading}
                                  onChange={(event) => {
                                    void handleLogoUpload(event.target.files?.[0]);
                                    event.target.value = '';
                                  }}
                                />
                              </label>
                              {editingHotel.logo_url ? (
                                <button
                                  type="button"
                                  onClick={() => void handleLogoRemove()}
                                  disabled={logoUploading}
                                  className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50 disabled:opacity-50"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                  Quitar
                                </button>
                              ) : null}
                            </div>
                          </div>
                          <p className="mt-2 text-[11px] text-gray-400">
                            PNG, JPG, WebP o SVG. Se guarda al subirlo y se muestra en el navbar y en el
                            footer.
                          </p>
                        </div>

                        {[
                          { key: 'name', label: 'Nombre del Hotel', type: 'text', placeholder: 'Nombre del hotel' },
                          { key: 'phone', label: 'Telefono', type: 'tel', placeholder: '+591 4 000000' },
                          { key: 'whatsapp', label: 'WhatsApp', type: 'tel', placeholder: '59170000000' },
                          { key: 'email', label: 'Correo', type: 'email', placeholder: 'info@hotel.com' },
                          { key: 'address', label: 'Direccion', type: 'textarea', placeholder: 'Direccion completa' },
                          { key: 'facebook', label: 'Facebook', type: 'url', placeholder: 'https://facebook.com/...' },
                          { key: 'instagram', label: 'Instagram', type: 'url', placeholder: 'https://instagram.com/...' },
                          { key: 'tiktok', label: 'TikTok', type: 'url', placeholder: 'https://tiktok.com/@...' },
                        ].map(({ key, label, type, placeholder }) => (
                          <div key={key}>
                            <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
                            {type === 'textarea' ? (
                              <textarea
                                rows={2}
                                value={editingHotel[key] || ''}
                                onChange={(e) => setEditingHotel({ ...editingHotel, [key]: e.target.value })}
                                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-900 resize-none"
                                placeholder={placeholder}
                              />
                            ) : (
                              <input
                                type={type}
                                value={editingHotel[key] || ''}
                                onChange={(e) => setEditingHotel({ ...editingHotel, [key]: e.target.value })}
                                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-900"
                                placeholder={placeholder}
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Rooms section */}
                    {activeSection === 'rooms' && (
                      <div className="space-y-3">
                        {roomsLoading ? (
                          <div className="flex items-center justify-center py-8">
                            <Loader2 className="animate-spin h-6 w-6 text-gray-400" />
                            <span className="ml-2 text-sm text-gray-500">Cargando...</span>
                          </div>
                        ) : rooms.length === 0 ? (
                          <p className="text-center text-gray-500 py-8">No hay habitaciones registradas</p>
                        ) : (
                          rooms.map((room) => (
                            <div key={room.id} className="border border-gray-100 rounded-xl p-4">
                              {editingRoomId === room.id ? (
                                <div className="space-y-3">
                                  <input
                                    type="text"
                                    value={editingRoom.name || ''}
                                    onChange={(e) => setEditingRoom({ ...editingRoom, name: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                                    placeholder="Nombre"
                                  />
                                  <div className="grid grid-cols-2 gap-3">
                                    <input
                                      type="number"
                                      value={editingRoom.price || ''}
                                      onChange={(e) => setEditingRoom({ ...editingRoom, price: e.target.value })}
                                      className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                                      placeholder="Precio"
                                    />
                                    <input
                                      type="number"
                                      value={editingRoom.max_guests || ''}
                                      onChange={(e) => setEditingRoom({ ...editingRoom, max_guests: e.target.value })}
                                      className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                                      placeholder="Max huespedes"
                                    />
                                  </div>
                                  <textarea
                                    rows={2}
                                    value={editingRoom.description || ''}
                                    onChange={(e) => setEditingRoom({ ...editingRoom, description: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 resize-none"
                                    placeholder="Descripcion"
                                  />
                                  <input
                                    type="text"
                                    value={editingRoom.services || ''}
                                    onChange={(e) => setEditingRoom({ ...editingRoom, services: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                                    placeholder="Servicios (separados por coma)"
                                  />
                                  <input
                                    type="text"
                                    value={editingRoom.amenities || ''}
                                    onChange={(e) => setEditingRoom({ ...editingRoom, amenities: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                                    placeholder="Extras (separados por coma)"
                                  />
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => handleSaveRoom(room.id)}
                                      disabled={updateRoom.isPending}
                                      className="flex items-center gap-1.5 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
                                    >
                                      {updateRoom.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                      Guardar
                                    </button>
                                    <button
                                      onClick={() => setEditingRoomId(null)}
                                      className="flex items-center gap-1.5 px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
                                    >
                                      <X className="w-4 h-4" />
                                      Cancelar
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="text-sm font-medium text-gray-900">{room.name}</p>
                                    <p className="text-xs text-gray-500">
                                      {categoryMap[room.category_id] || 'Sin categoria'} · Bs. {room.price} · {room.max_guests} huespedes
                                    </p>
                                  </div>
                                  <button
                                    onClick={() => startEditRoom(room)}
                                    className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors"
                                  >
                                    <Edit3 className="w-4 h-4" />
                                  </button>
                                </div>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    )}

                    {/* Hero slides section */}
                    {activeSection === 'hero' && (
                      <div className="space-y-4">
                        {/* Posición del contenido */}
                        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                          <div className="flex items-center justify-between mb-3">
                            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Posición horizontal del contenido
                            </p>
                            <span className="text-xs font-mono text-gray-600">
                              {parseHeroOffsetX(heroOffsetX)} px
                            </span>
                          </div>
                          <input
                            type="range"
                            min={-32}
                            max={360}
                            step={4}
                            value={parseHeroOffsetX(heroOffsetX)}
                            onChange={(e) => setHeroOffsetX(e.target.value)}
                            className="w-full accent-gray-900"
                            aria-label="Desplazamiento horizontal del contenido del hero"
                          />
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <input
                              type="number"
                              min={-160}
                              max={600}
                              step={4}
                              value={heroOffsetX}
                              onChange={(e) => setHeroOffsetX(e.target.value)}
                              className="w-24 px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                            />
                            <span className="text-xs text-gray-400">px</span>
                            <button
                              onClick={() => setHeroOffsetX('0')}
                              className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
                            >
                              Restablecer
                            </button>
                            <button
                              onClick={handleSaveHeroOffset}
                              disabled={upsertConfig.isPending}
                              className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 text-white text-xs font-medium rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
                            >
                              {upsertConfig.isPending ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Save className="w-3.5 h-3.5" />
                              )}
                              Guardar posición
                            </button>
                          </div>
                          <p className="mt-2 text-[11px] text-gray-400">
                            Mueve todo el bloque de texto del hero (todos los slides). 0 es la posición original; en
                            móvil se limita automáticamente para no salirse de la pantalla.
                          </p>
                        </div>

                        {heroLoading ? (
                          <div className="flex items-center justify-center py-8">
                            <Loader2 className="animate-spin h-6 w-6 text-gray-400" />
                            <span className="ml-2 text-sm text-gray-500">Cargando slides...</span>
                          </div>
                        ) : (
                          <>
                            {/* Add new slide button */}
                            <button
                              onClick={() => setShowNewSlideForm(!showNewSlideForm)}
                              className="w-full flex items-center justify-center gap-2 p-3 border-2 border-dashed border-gray-200 rounded-xl text-gray-500 hover:border-gray-900 hover:text-gray-900 transition-all"
                            >
                              <Plus className="w-4 h-4" />
                              <span className="text-sm font-medium">Agregar slide</span>
                            </button>

                            {/* New slide form */}
                            <AnimatePresence>
                              {showNewSlideForm && (
                                <motion.div
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: 'auto' }}
                                  exit={{ opacity: 0, height: 0 }}
                                  className="overflow-hidden"
                                >
                                  <div className="border border-gray-200 rounded-xl p-4 space-y-3 bg-gray-50">
                                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Nuevo Slide</p>

                                    <SlideMediaPreview values={newSlide} />

                                    <div className="border-t border-gray-200 pt-3">
                                      <HeroMediaPicker
                                        values={newSlide}
                                        onSelect={(field: HeroMediaField, url: string) =>
                                          setNewSlide({ ...newSlide, [field]: url })
                                        }
                                      />
                                    </div>

                                    <div>
                                      <label className="block text-sm font-medium text-gray-700 mb-1">Imagen URL (horizontal / escritorio)</label>
                                      <input
                                        type="url"
                                        value={newSlide.image_url}
                                        onChange={(e) => setNewSlide({ ...newSlide, image_url: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                                        placeholder="https://..."
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-sm font-medium text-gray-700 mb-1">Imagen móvil URL (vertical)</label>
                                      <input
                                        type="url"
                                        value={newSlide.image_mobile_url}
                                        onChange={(e) => setNewSlide({ ...newSlide, image_mobile_url: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                                        placeholder="https://..."
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-sm font-medium text-gray-700 mb-1">Video URL (horizontal / escritorio)</label>
                                      <input
                                        type="url"
                                        value={newSlide.video_url}
                                        onChange={(e) => setNewSlide({ ...newSlide, video_url: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                                        placeholder="https://..."
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-sm font-medium text-gray-700 mb-1">Video móvil URL (vertical)</label>
                                      <input
                                        type="url"
                                        value={newSlide.video_mobile_url}
                                        onChange={(e) => setNewSlide({ ...newSlide, video_mobile_url: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                                        placeholder="https://..."
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-sm font-medium text-gray-700 mb-1">Titulo *</label>
                                      <input
                                        type="text"
                                        value={newSlide.title}
                                        onChange={(e) => setNewSlide({ ...newSlide, title: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                                        placeholder="Titulo principal del slide"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-sm font-medium text-gray-700 mb-1">Descripcion</label>
                                      <textarea
                                        rows={2}
                                        value={newSlide.description}
                                        onChange={(e) => setNewSlide({ ...newSlide, description: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 resize-none"
                                        placeholder="Texto descriptivo"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-sm font-medium text-gray-700 mb-1">Texto del boton</label>
                                      <input
                                        type="text"
                                        value={newSlide.button_text}
                                        onChange={(e) => setNewSlide({ ...newSlide, button_text: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                                        placeholder="Reservar Ahora"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-sm font-medium text-gray-700 mb-1">Duracion (segundos)</label>
                                      <input
                                        type="number"
                                        min={3}
                                        max={30}
                                        value={6}
                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                                        disabled
                                      />
                                    </div>
                                    <div className="flex gap-2 pt-1">
                                      <button
                                        onClick={handleCreateSlide}
                                        disabled={createHeroSlide.isPending || !newSlide.title.trim()}
                                        className="flex items-center gap-1.5 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
                                      >
                                        {createHeroSlide.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                        Crear
                                      </button>
                                      <button
                                        onClick={() => setShowNewSlideForm(false)}
                                        className="flex items-center gap-1.5 px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
                                      >
                                        <X className="w-4 h-4" />
                                        Cancelar
                                      </button>
                                    </div>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>

                            {/* Existing slides */}
                            {heroSlides.length === 0 ? (
                              <div className="text-center py-8">
                                <ImageIcon className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                                <p className="text-sm text-gray-500">No hay slides configurados</p>
                                <p className="text-xs text-gray-400 mt-1 mb-4">Carga datos de ejemplo o agrega un slide manualmente</p>
                                <button
                                  onClick={handleSeedSlides}
                                  disabled={seedHeroSlides.isPending}
                                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
                                >
                                  {seedHeroSlides.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                                  Cargar datos de ejemplo
                                </button>
                              </div>
                            ) : (
                              heroSlides.map((slide, index) => (
                                <div key={slide.id} className="border border-gray-100 rounded-xl overflow-hidden">
                                  {editingSlideId === slide.id ? (
                                    <div className="p-4 space-y-3">
                                      {/* Vista previa escritorio / móvil */}
                                      <SlideMediaPreview values={editingSlide} />

                                      {/* Archivos disponibles en public/hero */}
                                      <div className="border-t border-gray-100 pt-3">
                                        <HeroMediaPicker
                                          values={editingSlide}
                                          onSelect={(field: HeroMediaField, url: string) =>
                                            setEditingSlide({ ...editingSlide, [field]: url })
                                          }
                                        />
                                      </div>

                                      <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Imagen URL (horizontal / escritorio)</label>
                                        <input
                                          type="url"
                                          value={editingSlide.image_url}
                                          onChange={(e) => setEditingSlide({ ...editingSlide, image_url: e.target.value })}
                                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                                        />
                                      </div>
                                      <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Imagen móvil URL (vertical)</label>
                                        <input
                                          type="url"
                                          value={editingSlide.image_mobile_url || ''}
                                          onChange={(e) => setEditingSlide({ ...editingSlide, image_mobile_url: e.target.value })}
                                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                                        />
                                      </div>
                                      <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Video URL (horizontal / escritorio)</label>
                                        <input
                                          type="url"
                                          value={editingSlide.video_url || ''}
                                          onChange={(e) => setEditingSlide({ ...editingSlide, video_url: e.target.value })}
                                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                                        />
                                      </div>
                                      <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Video móvil URL (vertical)</label>
                                        <input
                                          type="url"
                                          value={editingSlide.video_mobile_url || ''}
                                          onChange={(e) => setEditingSlide({ ...editingSlide, video_mobile_url: e.target.value })}
                                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                                        />
                                      </div>
                                      <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Titulo</label>
                                        <input
                                          type="text"
                                          value={editingSlide.title}
                                          onChange={(e) => setEditingSlide({ ...editingSlide, title: e.target.value })}
                                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                                        />
                                      </div>
                                      <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Descripcion</label>
                                        <textarea
                                          rows={2}
                                          value={editingSlide.description}
                                          onChange={(e) => setEditingSlide({ ...editingSlide, description: e.target.value })}
                                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 resize-none"
                                        />
                                      </div>
                                      <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Texto del boton</label>
                                        <input
                                          type="text"
                                          value={editingSlide.button_text}
                                          onChange={(e) => setEditingSlide({ ...editingSlide, button_text: e.target.value })}
                                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                                        />
                                      </div>
                                      <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Duracion (segundos)</label>
                                        <input
                                          type="number"
                                          min={3}
                                          max={30}
                                          value={editingSlide.duration || '6'}
                                          onChange={(e) => setEditingSlide({ ...editingSlide, duration: e.target.value })}
                                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                                        />
                                      </div>
                                      <div className="flex gap-2 pt-1">
                                        <button
                                          onClick={handleSaveSlide}
                                          disabled={updateHeroSlide.isPending}
                                          className="flex items-center gap-1.5 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
                                        >
                                          {updateHeroSlide.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                          Guardar
                                        </button>
                                        <button
                                          onClick={() => setEditingSlideId(null)}
                                          className="flex items-center gap-1.5 px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
                                        >
                                          <X className="w-4 h-4" />
                                          Cancelar
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-3 p-3">
                                      {/* Thumbnail */}
                                      <div className="w-20 h-14 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                                        <img
                                          src={slide.image_url}
                                          alt={slide.title}
                                          className="w-full h-full object-cover"
                                          onError={(e) => {
                                            (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="80" height="56"><rect fill="%23e5e7eb" width="80" height="56"/><text x="40" y="30" text-anchor="middle" fill="%239ca3af" font-size="9">Sin imagen</text></svg>';
                                          }}
                                        />
                                      </div>
                                      {/* Info */}
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-gray-900 truncate">{slide.title}</p>
                                        <div className="flex items-center gap-2 mt-1">
                                          <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] ${slide.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'}`}>
                                            {slide.active ? 'Activo' : 'Inactivo'}
                                          </span>
                                          <span className="text-[10px] text-gray-400">{slide.duration || 6}s</span>
                                        </div>
                                      </div>
                                      {/* Actions */}
                                      <div className="flex items-center gap-1">
                                        <button
                                          onClick={() => handleToggleSlideActive(slide)}
                                          className="w-7 h-7 rounded-lg bg-gray-50 flex items-center justify-center text-gray-400 hover:bg-gray-100 transition-colors"
                                          title={slide.active ? 'Desactivar' : 'Activar'}
                                        >
                                          <div className={`w-3 h-3 rounded-full ${slide.active ? 'bg-green-500' : 'bg-gray-300'}`} />
                                        </button>
                                        <button
                                          onClick={() => startEditSlide(slide)}
                                          className="w-7 h-7 rounded-lg bg-gray-50 flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors"
                                        >
                                          <Edit3 className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                          onClick={() => handleDeleteSlide(slide.id)}
                                          className="w-7 h-7 rounded-lg bg-gray-50 flex items-center justify-center text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ))
                            )}

                            {heroSlides.length > 0 && (
                              <p className="text-xs text-gray-400 text-center pt-2">
                                {heroSlides.length} slide{heroSlides.length !== 1 ? 's' : ''} · Los slides aparecen en el orden listado
                              </p>
                            )}
                          </>
                        )}
                      </div>
                    )}

                    {/* Información section editor */}
                    {activeSection === 'info' && (
                      <div className="space-y-5">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Título</label>
                          <textarea
                            rows={3}
                            value={editingSection.info_title || ''}
                            onChange={(e) => setEditingSection({ ...editingSection, info_title: e.target.value })}
                            className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/10 resize-none"
                            placeholder="El hotel más seguro y mejor valorado de Cochabamba."
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Descripción</label>
                          <textarea
                            rows={8}
                            value={editingSection.info_description || ''}
                            onChange={(e) => setEditingSection({ ...editingSection, info_description: e.target.value })}
                            className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/10 resize-none"
                            placeholder="Texto de la sección"
                          />
                          <p className="text-xs text-gray-400 mt-1">Dejá una línea en blanco entre párrafos</p>
                        </div>

                        <div>
                          <div className="flex items-baseline justify-between mb-3">
                            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Imágenes y videos del carrusel</p>
                            <span className="text-[10px] text-gray-400">
                              {infoSets.length} conjunto{infoSets.length !== 1 ? 's' : ''}
                            </span>
                          </div>

                          <p className="text-[11px] text-gray-400 -mt-1 mb-2">
                            Cada espacio puede ser Imagen o Mapa. Para el mapa pegá la URL completa de Google
                            Maps o coordenadas (lat, lng). Los enlaces cortos maps.app.goo.gl no se pueden
                            leer.
                          </p>

                          <div className="space-y-3">
                            {infoSets.map((set, index) => {
                              const slot = infoPickerSlot[set.id] || 'main';
                              const maps = set.maps || [null, null];
                              const selectedIsMap = maps[slot === 'main' ? 0 : 1] !== null;

                              return (
                                <div key={set.id} className="border border-gray-100 rounded-xl p-3 space-y-3">
                                  <div className="flex items-center justify-between">
                                    <p className="text-sm font-medium text-gray-900">Conjunto {index + 1}</p>
                                    <button
                                      onClick={() => removeInfoSet(index)}
                                      className="w-7 h-7 rounded-lg bg-gray-50 flex items-center justify-center text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                                      title="Eliminar conjunto"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>

                                  <div className="grid grid-cols-2 gap-2">
                                    {(['main', 'secondary'] as const).map((target) => {
                                      const slotIndex = target === 'main' ? 0 : 1;
                                      const mapLink = maps[slotIndex];
                                      const isMap = mapLink !== null;
                                      const resolved = isMap ? resolveMapEmbed(mapLink) : null;
                                      const slotLabel = target === 'main' ? 'Principal' : 'Secundaria';
                                      const imageValue = set.images[slotIndex];

                                      return (
                                        <div key={target} className="min-w-0 space-y-2">
                                          <div className="flex items-center justify-between gap-1">
                                            <p className="text-[10px] uppercase tracking-wider text-gray-400">
                                              {slotLabel}
                                            </p>
                                            {isMap && (
                                              <span className="inline-flex items-center gap-1 rounded-full bg-gray-900 px-1.5 py-0.5 text-[9px] font-medium text-white">
                                                <MapPin className="w-2.5 h-2.5" />
                                                Mapa
                                              </span>
                                            )}
                                          </div>

                                          <div className="relative aspect-[4/3] rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center">
                                            {isMap ? (
                                              resolved ? (
                                                <MapEmbed
                                                  link={mapLink}
                                                  title={`Mapa ${slotLabel} del conjunto ${index + 1}`}
                                                  interactive={false}
                                                />
                                              ) : (
                                                <span className="flex flex-col items-center gap-1 px-2 text-center text-[10px] text-gray-400">
                                                  <MapPin className="w-4 h-4" />
                                                  {mapLink.trim() ? 'Enlace no reconocido' : 'Sin enlace de mapa'}
                                                </span>
                                              )
                                            ) : imageValue ? (
                                              <Media
                                                src={imageValue}
                                                alt={`Contenido ${slotLabel.toLowerCase()}`}
                                                className="w-full h-full object-cover"
                                                showVideoBadge
                                              />
                                            ) : (
                                              <span className="text-[10px] text-gray-400">Sin archivo</span>
                                            )}
                                          </div>

                                          <div className="grid grid-cols-2 gap-1 rounded-lg bg-gray-100 p-0.5">
                                            <button
                                              type="button"
                                              onClick={() => updateInfoSetMap(index, target, null)}
                                              className={`px-1 py-1 rounded-md text-[10px] font-medium transition-colors ${
                                                !isMap
                                                  ? 'bg-white text-gray-900 shadow-sm'
                                                  : 'text-gray-500 hover:text-gray-700'
                                              }`}
                                            >
                                              Imagen
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => updateInfoSetMap(index, target, isMap ? mapLink : '')}
                                              className={`px-1 py-1 rounded-md text-[10px] font-medium transition-colors ${
                                                isMap
                                                  ? 'bg-white text-gray-900 shadow-sm'
                                                  : 'text-gray-500 hover:text-gray-700'
                                              }`}
                                            >
                                              Mapa
                                            </button>
                                          </div>

                                          {isMap ? (
                                            <>
                                              <input
                                                type="text"
                                                value={mapLink}
                                                onChange={(e) => updateInfoSetMap(index, target, e.target.value)}
                                                className="w-full px-2 py-2 border border-gray-200 rounded-lg text-[11px] focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                                                placeholder="Enlace del hotel o lat, lng"
                                              />
                                              <p
                                                className={`text-[10px] leading-snug ${
                                                  !mapLink.trim()
                                                    ? 'text-gray-400'
                                                    : resolved
                                                      ? 'text-green-600'
                                                      : 'text-amber-600'
                                                }`}
                                              >
                                                {!mapLink.trim()
                                                  ? 'Pegá un enlace o coordenadas'
                                                  : resolved
                                                    ? 'Mapa listo (Google Maps)'
                                                    : 'Enlace no reconocido: usá la URL completa o lat, lng'}
                                              </p>
                                            </>
                                          ) : (
                                            <>
                                              <input
                                                type="url"
                                                value={imageValue}
                                                onChange={(e) => updateInfoSetImage(index, target, e.target.value)}
                                                className="w-full px-2 py-2 border border-gray-200 rounded-lg text-[11px] focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                                                placeholder={`URL ${slotLabel.toLowerCase()}`}
                                              />
                                              <button
                                                type="button"
                                                onClick={() =>
                                                  setInfoPickerSlot({ ...infoPickerSlot, [set.id]: target })
                                                }
                                                className={`w-full px-2 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${
                                                  slot === target
                                                    ? 'bg-gray-900 text-white'
                                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                                }`}
                                              >
                                                {slot === target ? 'Elegir archivo abajo' : 'Asignar archivo'}
                                              </button>
                                            </>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>

                                  {selectedIsMap ? (
                                    <p className="text-[11px] text-gray-400">
                                      El espacio {slot === 'main' ? 'principal' : 'secundario'} está en modo
                                      mapa. Cambialo a Imagen para asignar archivos de public/info.
                                    </p>
                                  ) : (
                                    <ImageFolderPicker
                                      source="info"
                                      selectedUrl={slot === 'main' ? set.images[0] : set.images[1]}
                                      onSelect={(url) => updateInfoSetImage(index, slot, url)}
                                      emptyHint="No hay archivos en public/info/images ni public/info/videos. Podés pegar URLs manuales."
                                    />
                                  )}
                                </div>
                              );
                            })}

                            <button
                              onClick={addInfoSet}
                              className="w-full flex items-center justify-center gap-2 p-3 border-2 border-dashed border-gray-200 rounded-xl text-gray-500 hover:border-gray-900 hover:text-gray-900 transition-all"
                            >
                              <Plus className="w-4 h-4" />
                              <span className="text-sm font-medium">Agregar conjunto</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Booking section editor */}
                    {activeSection === 'booking' && (
                      <div className="space-y-5">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Titulo principal</label>
                          <textarea
                            rows={2}
                            value={editingSection.booking_title || ''}
                            onChange={(e) => setEditingSection({ ...editingSection, booking_title: e.target.value })}
                            className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/10 resize-none"
                            placeholder="Reserva una Habitacion"
                          />
                          <p className="text-xs text-gray-400 mt-1">Usa enter para separar lineas</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Descripcion</label>
                          <textarea
                            rows={3}
                            value={editingSection.booking_description || ''}
                            onChange={(e) => setEditingSection({ ...editingSection, booking_description: e.target.value })}
                            className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/10 resize-none"
                            placeholder="Descripcion de la seccion"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Duracion del carrusel de tipos (segundos)
                          </label>
                          <input
                            type="number"
                            min={2}
                            max={60}
                            value={editingSection.booking_types_duration || '6'}
                            onChange={(e) => setEditingSection({ ...editingSection, booking_types_duration: e.target.value })}
                            className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                          />
                          <p className="text-xs text-gray-400 mt-1">
                            Cada cuanto cambia la tarjeta de tipo de habitacion en la seccion Reserva (minimo 2 s).
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Amenities section editor */}
                    {activeSection === 'amenities' && (
                      <div className="space-y-5">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Titulo principal</label>
                          <input
                            type="text"
                            value={editingSection.amenities_title || ''}
                            onChange={(e) => setEditingSection({ ...editingSection, amenities_title: e.target.value })}
                            className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                            placeholder="Amenidades"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Descripcion</label>
                          <textarea
                            rows={3}
                            value={editingSection.amenities_description || ''}
                            onChange={(e) => setEditingSection({ ...editingSection, amenities_description: e.target.value })}
                            className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/10 resize-none"
                            placeholder="Descripcion de la seccion"
                          />
                        </div>
                        {/* Grupos, visibilidad e ítems */}
                        <div className="border-t border-gray-100 pt-5">
                          <AmenitiesEditor
                            ref={amenitiesEditorRef}
                            hotelId={hotelId}
                            amenities={amenities}
                            groupsConfig={amenitiesGroupsConfig}
                            isLoading={amenitiesLoading}
                          />
                        </div>
                      </div>
                    )}

                    {/* Rooms section editor */}
                    {activeSection === 'rooms' && (
                      <div className="space-y-5">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Titulo</label>
                          <input type="text" value={editingSection.rooms_title || ''} onChange={(e) => setEditingSection({ ...editingSection, rooms_title: e.target.value })} className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/10" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Descripcion</label>
                          <textarea rows={3} value={editingSection.rooms_description || ''} onChange={(e) => setEditingSection({ ...editingSection, rooms_description: e.target.value })} className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/10 resize-none" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Tipos visibles en Inicio
                          </label>
                          <input
                            type="number"
                            min={1}
                            max={24}
                            step={1}
                            value={editingSection.rooms_count || '5'}
                            onChange={(e) => setEditingSection({ ...editingSection, rooms_count: e.target.value })}
                            className="w-32 px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                          />
                          <p className="text-xs text-gray-400 mt-1">
                            Se muestran en filas de 3. Por defecto: 5.
                          </p>
                        </div>

                        {/* Tipos principales y su orden en la portada */}
                        <div className="border-t border-gray-100 pt-5 space-y-3">
                          <div className="flex items-baseline justify-between gap-2">
                            <label className="text-sm font-medium text-gray-700">
                              Tipos principales en la portada
                            </label>
                            <span className="text-xs text-gray-400">
                              {featuredRoomIds.length} elegido{featuredRoomIds.length === 1 ? '' : 's'}
                            </span>
                          </div>
                          <p className="text-xs text-gray-400">
                            Se muestran primero y en este orden. Si eliges menos que los tipos visibles, el
                            resto se completa en orden alfabético.
                          </p>

                          {featuredRoomIds.length === 0 ? (
                            <p className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500">
                              Sin principales: se muestran las habitaciones destacadas y luego el resto en
                              orden alfabético.
                            </p>
                          ) : (
                            <ol className="space-y-2">
                              {featuredRoomIds.map((id, index) => {
                                const room = roomList.find(item => item.id === id);
                                return (
                                  <li
                                    key={id}
                                    className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2"
                                  >
                                    <span className="w-5 text-xs font-mono text-gray-400">{index + 1}</span>
                                    <span className="flex-1 truncate text-sm text-gray-800">
                                      {room?.name || 'Tipo no disponible'}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => moveFeaturedRoom(index, -1)}
                                      disabled={index === 0}
                                      title="Subir"
                                      className="w-7 h-7 rounded-lg bg-gray-50 flex items-center justify-center text-gray-500 hover:bg-gray-100 disabled:opacity-30"
                                    >
                                      <ChevronUp className="w-4 h-4" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => moveFeaturedRoom(index, 1)}
                                      disabled={index === featuredRoomIds.length - 1}
                                      title="Bajar"
                                      className="w-7 h-7 rounded-lg bg-gray-50 flex items-center justify-center text-gray-500 hover:bg-gray-100 disabled:opacity-30"
                                    >
                                      <ChevronDown className="w-4 h-4" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setFeaturedRoomIds(featuredRoomIds.filter(item => item !== id))}
                                      title="Quitar de principales"
                                      className="w-7 h-7 rounded-lg bg-gray-50 flex items-center justify-center text-gray-500 hover:bg-gray-100"
                                    >
                                      <X className="w-4 h-4" />
                                    </button>
                                  </li>
                                );
                              })}
                            </ol>
                          )}

                          {roomList.some(room => !featuredRoomIds.includes(room.id)) ? (
                            <div>
                              <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400 mb-2">
                                Agregar tipo
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {roomList
                                  .filter(room => !featuredRoomIds.includes(room.id))
                                  .map(room => (
                                    <button
                                      key={room.id}
                                      type="button"
                                      onClick={() => setFeaturedRoomIds([...featuredRoomIds, room.id])}
                                      className="inline-flex items-center gap-1 rounded-full border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:border-gray-900 hover:text-gray-900 transition-colors"
                                    >
                                      <Plus className="w-3 h-3" />
                                      {room.name}
                                    </button>
                                  ))}
                              </div>
                            </div>
                          ) : (
                            <p className="text-xs text-gray-400">Todos los tipos ya están como principales.</p>
                          )}
                        </div>

                        {/* Cinta "Ver todas las habitaciones" */}
                        <div className="border-t border-gray-100 pt-5 space-y-3">
                          <p className="text-sm font-medium text-gray-700">Cinta “Ver todas las habitaciones”</p>
                          <p className="text-xs text-gray-400">
                            Fondo dorado a todo el ancho, sin flecha ni subrayado.
                          </p>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={editingSection.rooms_cta_color || '#D4AF37'}
                              onChange={(e) =>
                                setEditingSection({ ...editingSection, rooms_cta_color: e.target.value })
                              }
                              className="h-9 w-12 rounded-lg border border-gray-200 bg-white p-1"
                              aria-label="Color de fondo de la cinta"
                            />
                            <input
                              type="text"
                              value={editingSection.rooms_cta_color || '#D4AF37'}
                              onChange={(e) =>
                                setEditingSection({ ...editingSection, rooms_cta_color: e.target.value })
                              }
                              className="w-28 px-3 py-1.5 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                            />
                            <span className="text-xs text-gray-400">Fondo</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={editingSection.rooms_cta_text_color || '#1a1a2e'}
                              onChange={(e) =>
                                setEditingSection({ ...editingSection, rooms_cta_text_color: e.target.value })
                              }
                              className="h-9 w-12 rounded-lg border border-gray-200 bg-white p-1"
                              aria-label="Color del texto de la cinta"
                            />
                            <input
                              type="text"
                              value={editingSection.rooms_cta_text_color || '#1a1a2e'}
                              onChange={(e) =>
                                setEditingSection({ ...editingSection, rooms_cta_text_color: e.target.value })
                              }
                              className="w-28 px-3 py-1.5 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                            />
                            <span className="text-xs text-gray-400">Texto</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Contact section editor */}
                    {activeSection === 'contact' && (
                      <div className="space-y-5">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Titulo</label>
                          <textarea rows={2} value={editingSection.contact_title || ''} onChange={(e) => setEditingSection({ ...editingSection, contact_title: e.target.value })} className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/10 resize-none" />
                          <p className="text-xs text-gray-400 mt-1">Usa enter para separar lineas</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Descripcion</label>
                          <textarea rows={3} value={editingSection.contact_description || ''} onChange={(e) => setEditingSection({ ...editingSection, contact_description: e.target.value })} className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/10 resize-none" />
                        </div>
                      </div>
                    )}

                    {/* Attractions section editor */}
                    {activeSection === 'attractions' && (
                      <div className="space-y-5">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Titulo</label>
                          <input type="text" value={editingSection.attractions_title || ''} onChange={(e) => setEditingSection({ ...editingSection, attractions_title: e.target.value })} className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/10" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Descripcion</label>
                          <textarea rows={3} value={editingSection.attractions_description || ''} onChange={(e) => setEditingSection({ ...editingSection, attractions_description: e.target.value })} className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/10 resize-none" />
                        </div>

                        {/* Card translúcida sobre la imagen de fondo */}
                        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3">
                          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Card del contenido
                          </p>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={editingSection.attractions_card_color || '#ffffff'}
                              onChange={(e) =>
                                setEditingSection({ ...editingSection, attractions_card_color: e.target.value })
                              }
                              className="h-9 w-12 rounded-lg border border-gray-200 bg-white p-1"
                              aria-label="Color de la card"
                            />
                            <input
                              type="text"
                              value={editingSection.attractions_card_color || '#ffffff'}
                              onChange={(e) =>
                                setEditingSection({ ...editingSection, attractions_card_color: e.target.value })
                              }
                              className="w-28 px-3 py-1.5 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                            />
                            <span className="text-xs text-gray-400">Color de fondo</span>
                          </div>
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="text-xs text-gray-600">Transparencia</label>
                              <span className="text-xs font-mono text-gray-500">
                                {editingSection.attractions_card_opacity || '82'}%
                              </span>
                            </div>
                            <input
                              type="range"
                              min={0}
                              max={100}
                              step={2}
                              value={Number(editingSection.attractions_card_opacity || 82)}
                              onChange={(e) =>
                                setEditingSection({ ...editingSection, attractions_card_opacity: e.target.value })
                              }
                              className="w-full accent-gray-900"
                              aria-label="Transparencia de la card"
                            />
                          </div>
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="text-xs text-gray-600">Difuminado del fondo</label>
                              <span className="text-xs font-mono text-gray-500">
                                {editingSection.attractions_card_blur || '12'} px
                              </span>
                            </div>
                            <input
                              type="range"
                              min={0}
                              max={40}
                              step={2}
                              value={Number(editingSection.attractions_card_blur || 12)}
                              onChange={(e) =>
                                setEditingSection({ ...editingSection, attractions_card_blur: e.target.value })
                              }
                              className="w-full accent-gray-900"
                              aria-label="Difuminado de la card"
                            />
                          </div>
                        </div>

                        <div className="border-t border-gray-100 pt-5">
                          <AttractionsEditor
                            ref={attractionsEditorRef}
                            hotelId={hotelId}
                            attractions={attractionsAll as Array<Attraction & { images?: AttractionImage[] }>}
                            folderOverrides={attractionsFolderOverrides}
                            durations={attractionsDurations}
                            onSaveDurations={handleSaveAttractionDurations}
                            isLoading={attractionsLoading}
                          />
                        </div>
                      </div>
                    )}

                    {/* Comments section editor */}
                    {activeSection === 'comments' && (
                      <div className="space-y-5">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Titulo</label>
                          <input type="text" value={editingSection.comments_title || ''} onChange={(e) => setEditingSection({ ...editingSection, comments_title: e.target.value })} className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/10" />
                        </div>
                        <div>
                          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Comentarios aprobados</p>
                          {dbComments.length === 0 ? (
                            <p className="text-sm text-gray-500 text-center py-4">No hay comentarios</p>
                          ) : (
                            dbComments.slice(0, 5).map((c) => (
                              <div key={c.id} className="p-3 border border-gray-100 rounded-lg mb-2">
                                <p className="text-sm font-medium text-gray-900">{c.name}</p>
                                <p className="text-xs text-gray-500 mt-1 line-clamp-2">{c.content}</p>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )}

                    {/* Encabezado de Galería / Promociones */}
                    {pageHeaderPrefix && (
                      <div className="space-y-5">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Título</label>
                          <input
                            type="text"
                            value={editingSection[`${pageHeaderPrefix}_title`] || ''}
                            onChange={(e) =>
                              setEditingSection({
                                ...editingSection,
                                [`${pageHeaderPrefix}_title`]: e.target.value,
                              })
                            }
                            className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Descripción</label>
                          <textarea
                            rows={4}
                            value={editingSection[`${pageHeaderPrefix}_description`] || ''}
                            onChange={(e) =>
                              setEditingSection({
                                ...editingSection,
                                [`${pageHeaderPrefix}_description`]: e.target.value,
                              })
                            }
                            className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/10 resize-none"
                          />
                        </div>
                        <p className="text-xs text-gray-400">
                          Es el encabezado de la página. Se muestra solo el título y la descripción.
                        </p>
                      </div>
                    )}

                    {/* Inventario de tipos y unidades */}
                    {activeSection === 'inventory' && (
                      <RoomInventoryEditor hotelId={hotelId} />
                    )}

                    {/* Avisos y cintas entre secciones (home) */}
                    {activeSection === 'blocks' && (
                      <HomeBlocksEditor
                        hotelId={hotelId}
                        configValue={homeBlocksConfig}
                        ribbonConfig={promoRibbonConfig}
                      />
                    )}

                    {['colors', 'settings', 'info', 'booking', 'amenities', 'rooms', 'contact', 'attractions', 'comments', 'gallery_header', 'promotions_header'].includes(activeSection || '') && (
                      <button
                        onClick={() => handleSave(activeSection || '')}
                        disabled={updateHotel.isPending}
                        className="w-full mt-8 py-3 bg-gray-900 text-white font-semibold text-sm tracking-wider uppercase rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {updateHotel.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                        Guardar Cambios
                      </button>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
