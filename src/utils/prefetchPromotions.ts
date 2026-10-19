import type { QueryClient } from '@tanstack/react-query';
import {
  hotelConfigQueryOptions,
  hotelsQueryOptions,
  promotionsQueryOptions,
} from '../hooks/useQueries';

/**
 * Precarga la pestaña de promociones al pasar el mouse, enfocar o tocar el
 * enlace del navbar.
 *
 * Descarga el chunk de la página y deja en la caché de React Query las dos
 * consultas que necesita (`promociones` y `configuracion_hotel`). Si el hotel
 * todavía no está en el store —por ejemplo en una visita directa— espera a la
 * consulta de hoteles que ya está en curso y recién ahí pide las promociones.
 * Es best-effort: un fallo no interrumpe la navegación, que vuelve a intentar
 * las consultas al montar la página.
 */
export function prefetchPromotionsPage(
  queryClient: QueryClient,
  hotelId?: string | null
): void {
  void import('../pages/public/PromotionsPage');

  const idPromise = hotelId
    ? Promise.resolve(hotelId)
    : queryClient
        .ensureQueryData(hotelsQueryOptions())
        .then((hotels) => hotels[0]?.id ?? null)
        .catch(() => null);

  void idPromise.then((id) => {
    if (!id) return;
    void queryClient.prefetchQuery(promotionsQueryOptions(id));
    void queryClient.prefetchQuery(hotelConfigQueryOptions(id));
  });
}
