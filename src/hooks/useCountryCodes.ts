import { useQuery } from '@tanstack/react-query';
import type { CountryDialCode } from '../types';

/**
 * Códigos de área configurados por el hotel (Configuración → Códigos de área).
 * El formulario de registro y el perfil del cliente usan esta lista, así que
 * agregar un país en el panel lo habilita sin tocar el código.
 */
export function useCountryCodes() {
  return useQuery({
    queryKey: ['countryDialCodes'],
    queryFn: async () => {
      const response = await fetch(`${import.meta.env.BASE_URL}api/public/country-codes`);
      const body = (await response.json().catch(() => null)) as
        | { data?: CountryDialCode[] | null; error?: string | null }
        | null;
      if (!response.ok) {
        throw new Error(body?.error || 'No se pudieron cargar los códigos de área');
      }
      return (body?.data ?? []) as CountryDialCode[];
    },
    staleTime: 5 * 60 * 1000,
  });
}
