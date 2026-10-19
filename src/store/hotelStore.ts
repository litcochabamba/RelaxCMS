import { create } from 'zustand';

/**
 * Valores de respaldo del hotel. Se usan solo cuando la base de datos no
 * devuelve el dato: el sitio nunca depende de ellos para mostrar contenido real.
 */
export const HOTEL_FALLBACKS = {
  hotelName: 'Hostal Relax II',
  hotelSlug: 'hostal-relax',
  primaryColor: '#8B0000',
  secondaryColor: '#1a1a2e',
  accentColor: '#D4AF37',
  whatsapp: '59162665925',
  phone: '+591 62665925',
  email: 'info@hotel.com',
  address: 'Av. Independencia, entre General Álvarez y 6 de Agosto, Cochabamba, Bolivia',
  facebook: 'https://www.facebook.com/hostal.relax.ii/',
  instagram: 'https://www.instagram.com/hostal_relax_ii/',
  tiktok: 'https://www.tiktok.com/@hostal_relax',
} as const;

interface HotelDataState {
  hotelId: string | null;
  hotelName: string;
  hotelSlug: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  whatsapp: string;
  phone: string;
  email: string;
  address: string;
  facebook: string;
  instagram: string;
  tiktok: string;
  logoUrl: string;
  setHotelData: (data: Partial<HotelDataState>) => void;
}

export const useHotelDataStore = create<HotelDataState>((set) => ({
  hotelId: null,
  hotelName: HOTEL_FALLBACKS.hotelName,
  hotelSlug: HOTEL_FALLBACKS.hotelSlug,
  primaryColor: HOTEL_FALLBACKS.primaryColor,
  secondaryColor: HOTEL_FALLBACKS.secondaryColor,
  accentColor: HOTEL_FALLBACKS.accentColor,
  whatsapp: HOTEL_FALLBACKS.whatsapp,
  phone: HOTEL_FALLBACKS.phone,
  email: HOTEL_FALLBACKS.email,
  address: HOTEL_FALLBACKS.address,
  facebook: HOTEL_FALLBACKS.facebook,
  instagram: HOTEL_FALLBACKS.instagram,
  tiktok: HOTEL_FALLBACKS.tiktok,
  logoUrl: '',
  setHotelData: (data) => set(data),
}));
