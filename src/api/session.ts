import toast from 'react-hot-toast';
import { useAuthStore } from '../store/authStore';

/**
 * Pedido al backend autenticado por la cookie de sesión.
 *
 * La cookie la emite el servidor (`HttpOnly`) y caduca sola; el navegador no
 * puede leerla para saber si sigue viva. Por eso, cuando el servidor responde
 * 401 se descarta la sesión local en el acto: el panel vuelve al login en vez
 * de quedar abierto mostrando «Sesión no válida o expirada» en cada pantalla.
 */
export async function sessionFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const response = await fetch(input, { credentials: 'include', ...init });

  if (response.status === 401 && useAuthStore.getState().isAuthenticated) {
    useAuthStore.getState().expire();
    toast.error('Tu sesión expiró. Volvé a ingresar.');
  }

  return response;
}
