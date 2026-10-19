export interface Hotel {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  logo_url: string | null;
  banner_url: string | null;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  font_heading: string;
  font_body: string;
  facebook: string | null;
  instagram: string | null;
  tiktok: string | null;
  latitude: number | null;
  longitude: number | null;
  timezone: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  hotel_id: string | null;
  name: string;
  email: string | null;
  username?: string | null;
  password_hash?: string;
  role: 'admin' | 'moderator' | 'client';
  avatar_url: string | null;
  active?: boolean;
  last_login?: string | null;
  created_at?: string;
  updated_at?: string;
}

/** Cuenta de cliente (tabla `clientes`, separada de los usuarios del sistema). */
export interface ClientAccount {
  id: string;
  hotel_id?: string | null;
  name: string;
  username: string;
  email: string | null;
  phone: string | null;
  active: boolean;
  last_login?: string | null;
  created_at?: string;
  /** País deducido del código de área del celular. */
  country_iso?: string | null;
  country_dial?: string | null;
  country_name?: string | null;
  gender?: string | null;
  age?: number | null;
  profession?: string | null;
}

/** Código de área telefónico configurable desde el panel. */
export interface CountryDialCode {
  iso: string;
  name: string;
  dial: string;
  flag: string;
  active: boolean;
}

export interface Role {
  id: string;
  name: 'admin' | 'moderator' | 'client';
  description: string;
  permissions: string[];
}

export interface HotelConfig {
  id: string;
  hotel_id: string;
  key: string;
  value: string;
  group: string;
  created_at: string;
  updated_at: string;
}

export interface HeroSlide {
  id: string;
  hotel_id: string;
  /** Imagen horizontal (escritorio) */
  image_url: string;
  /** Imagen vertical (móvil) */
  image_mobile_url?: string | null;
  /** Video horizontal (escritorio) */
  video_url?: string | null;
  /** Video vertical (móvil) */
  video_mobile_url?: string | null;
  title: string;
  /** Campo heredado: ya no se muestra ni se edita en el panel. */
  subtitle?: string | null;
  description: string | null;
  button_text: string | null;
  button_link: string | null;
  duration: number;
  order: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export type RoomGroup = 'habitacion' | 'departamento';

/** Tipo de habitación o departamento importado del inventario del PMS. */
export interface RoomTypeInventory {
  id: string;
  hotel_id: string;
  pms_id: number | null;
  name: string;
  slug: string;
  grupo: RoomGroup;
  description: string | null;
  image_url: string | null;
  min_capacity: number | null;
  max_capacity: number | null;
  price: number | null;
  order: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

/** Unidad física (habitación o departamento) dentro de un tipo. */
export interface RoomUnit {
  id: string;
  hotel_id: string;
  tipo_id: string;
  pms_id: number | null;
  name: string;
  floor: string | null;
  capacity: number | null;
  amenities: string[];
  order: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Amenity {
  id: string;
  hotel_id: string;
  name: string;
  icon: string | null;
  description: string | null;
  /** Foto opcional de la amenidad; se muestra dentro de la tarjeta. */
  image_url: string | null;
  category: string;
  value: string | null;
  order: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Attraction {
  id: string;
  hotel_id: string;
  title: string;
  description: string | null;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  order: number;
  active: boolean;
  created_at: string;
  updated_at: string;
  images?: AttractionImage[];
}

export interface AttractionImage {
  id: string;
  attraction_id: string;
  image_url: string;
  alt_text: string | null;
  order: number;
  created_at: string;
}

export interface GalleryItem {
  id: string;
  hotel_id: string;
  image_url: string;
  title: string | null;
  description: string | null;
  category: string;
  alt_text: string | null;
  order: number;
  created_at: string;
  updated_at: string;
}

export interface Reservation {
  id: string;
  hotel_id: string;
  user_id: string | null;
  cliente_id: string | null;
  guest_name: string;
  guest_email: string | null;
  guest_phone: string;
  check_in: string;
  check_out: string;
  adults: number;
  children_count: number;
  room_type: string;
  message: string | null;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  created_at: string;
  updated_at: string;
  hotel?: Hotel;
}

export interface Inquiry {
  id: string;
  hotel_id: string;
  name: string;
  email: string;
  phone: string | null;
  message: string;
  status: 'pending' | 'read' | 'replied' | 'archived';
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Comment {
  id: string;
  hotel_id: string;
  name: string;
  email: string;
  content: string;
  status: 'pending' | 'approved' | 'rejected';
  admin_reply: string | null;
  created_at: string;
  updated_at: string;
}

export interface Promotion {
  id: string;
  hotel_id: string;
  title: string;
  description: string | null;
  discount_percent: number | null;
  discount_amount: number | null;
  code: string | null;
  start_date: string;
  end_date: string;
  image_url: string | null;
  type: 'discount' | 'event' | 'package' | 'seasonal';
  active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// Bloques libres entre secciones de la home: avisos grandes y cintas de texto.
// Se guardan como JSON en `configuracion_hotel` (clave `home_blocks`).
export type HomeBlockKind = 'aviso' | 'cinta';

// El espacio entre el hero y la sección de Información queda reservado (barra
// de disponibilidad): los avisos y cintas empiezan después de Información.
export type HomeBlockPlacement =
  | 'showcase'
  | 'amenities'
  | 'rooms'
  | 'booking'
  | 'attractions'
  | 'comments';

export interface HomeBlock {
  id: string;
  kind: HomeBlockKind;
  /** Sección después de la cual se muestra el bloque. */
  after: HomeBlockPlacement;
  title: string;
  text: string;
  image_url: string;
  /** Alto en píxeles del aviso (las cintas lo ignoran). */
  height: number;
  bg: string;
  fg: string;
  button_label: string;
  button_href: string;
  /** Segundos por vuelta de la cinta; 0 la deja quieta. */
  speed: number;
  active: boolean;
}

// Auth types
export interface RegisterAccountInput {
  alias: string;
  name: string;
  password: string;
  country_iso: string;
  dial_code: string;
  phone: string;
  email?: string;
  turnstileToken?: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string, turnstileToken?: string) => Promise<void>;
  register: (input: RegisterAccountInput) => Promise<void>;
  logout: () => void;
  setUser: (user: User) => void;
}

// CMS Panel types
export interface CmsPanelState {
  isOpen: boolean;
  activeSection: string | null;
  toggle: () => void;
  open: () => void;
  close: () => void;
  setActiveSection: (section: string | null) => void;
}

// Hotel selection for admin
export interface HotelSelectionState {
  selectedHotelId: string | null;
  setSelectedHotelId: (id: string | null) => void;
}

// API Response types
export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
  count?: number;
}

// Pagination
export interface PaginationParams {
  page: number;
  per_page: number;
  hotel_id?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

// WhatsApp message
export interface WhatsAppMessage {
  guestName: string;
  adults: number;
  children: number;
  checkIn: string;
  checkOut: string;
  roomType: string;
}
