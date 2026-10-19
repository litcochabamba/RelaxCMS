import { useEffect } from 'react';
import { useHotels } from './useQueries';
import { HOTEL_FALLBACKS, useHotelDataStore } from '../store/hotelStore';
import type { Hotel } from '../types';

/**
 * Sincroniza los datos del hotel (nombre, colores, contacto y redes) desde la
 * base de datos hacia el store global y las variables CSS que consumen el
 * navbar y el footer. Si la base no devuelve un dato, se usa el valor de
 * respaldo de HOTEL_FALLBACKS.
 */
export function useHotelBranding() {
  const { data: hotels } = useHotels();
  const setHotelData = useHotelDataStore((state) => state.setHotelData);

  useEffect(() => {
    const hotel = (Array.isArray(hotels) ? hotels[0] : hotels) as Hotel | undefined;

    const branding = {
      hotelId: hotel?.id ?? null,
      hotelName: hotel?.name || HOTEL_FALLBACKS.hotelName,
      hotelSlug: hotel?.slug || HOTEL_FALLBACKS.hotelSlug,
      primaryColor: hotel?.primary_color || HOTEL_FALLBACKS.primaryColor,
      secondaryColor: hotel?.secondary_color || HOTEL_FALLBACKS.secondaryColor,
      accentColor: hotel?.accent_color || HOTEL_FALLBACKS.accentColor,
      whatsapp: hotel?.whatsapp || HOTEL_FALLBACKS.whatsapp,
      phone: hotel?.phone || HOTEL_FALLBACKS.phone,
      email: hotel?.email || HOTEL_FALLBACKS.email,
      address: hotel?.address || HOTEL_FALLBACKS.address,
      facebook: hotel?.facebook || HOTEL_FALLBACKS.facebook,
      instagram: hotel?.instagram || HOTEL_FALLBACKS.instagram,
      tiktok: hotel?.tiktok || HOTEL_FALLBACKS.tiktok,
      logoUrl: hotel?.logo_url || '',
    };

    setHotelData(branding);

    const root = document.documentElement;
    root.style.setProperty('--brand-primary', branding.primaryColor);
    root.style.setProperty('--brand-secondary', branding.secondaryColor);
    root.style.setProperty('--brand-accent', branding.accentColor);
  }, [hotels, setHotelData]);
}
