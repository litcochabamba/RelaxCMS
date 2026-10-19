// Supabase REST API Client
// Uses direct REST API calls to Supabase - no SDK dependency

import type { User } from '../types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

interface SupabaseQueryOptions {
  select?: string;
  filters?: Record<string, unknown>;
  order?: { column: string; ascending?: boolean };
  limit?: number;
  offset?: number;
  head?: boolean;
}

function buildQueryString(options: SupabaseQueryOptions): string {
  const params = new URLSearchParams();

  if (options.select) {
    params.append('select', options.select);
  }

  if (options.filters) {
    Object.entries(options.filters).forEach(([key, value]) => {
      if (value === null) {
        params.append(key, 'is.null');
      } else if (value === true) {
        params.append(key, 'eq.true');
      } else if (value === false) {
        params.append(key, 'eq.false');
      } else if (typeof value === 'number') {
        params.append(key, `eq.${value}`);
      } else if (typeof value === 'string' && value.startsWith('eq.')) {
        params.append(key, value);
      } else {
        params.append(key, `eq.${value}`);
      }
    });
  }

  if (options.order) {
    params.append('order', `${options.order.column}.${options.order.ascending ? 'asc' : 'desc'}`);
  }

  if (options.limit) {
    params.append('limit', String(options.limit));
  }

  if (options.offset) {
    params.append('offset', String(options.offset));
  }

  return params.toString();
}

// Only forward real Supabase JWTs. The local login stores a non-JWT marker, and
// sending it in the Authorization header makes PostgREST reject every request with 401.
function getAuthToken(): string | null {
  const token = localStorage.getItem('auth_token');
  return token && token.split('.').length === 3 ? token : null;
}

async function supabaseRequest<T>(
  table: string,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  body?: unknown,
  options?: SupabaseQueryOptions
): Promise<{ data: T | null; error: string | null; count?: number }> {
  const headers: Record<string, string> = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
  };

  const token = getAuthToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let url = `${SUPABASE_URL}/rest/v1/${table}`;

  if (method === 'GET' && options) {
    const queryString = buildQueryString(options);
    if (queryString) url += `?${queryString}`;
  }

  const response = await fetch(url, {
    method,
    headers: {
      ...headers,
      ...(options?.head ? { Prefer: 'count=exact' } : {}),
      ...(method === 'GET' && !options?.head ? { Prefer: 'return=representation' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    return { data: null, error: errorData.message || `HTTP ${response.status}` };
  }

  if (options?.head) {
    const count = response.headers.get('content-range');
    return { data: null, error: null, count: count ? parseInt(count.split('/')[1]) : 0 };
  }

  if (method === 'DELETE') {
    return { data: null, error: null };
  }

  const data = await response.json().catch(() => null);

  if (data === null) {
    return { data: null, error: 'Respuesta inválida del servidor' };
  }

  return { data: data as T, error: null };
}

// Las escrituras pasan por el backend (Cloudflare Pages Functions en producción,
// middleware de Vite en desarrollo), que guarda la service role key y valida la
// sesión del CMS. El navegador nunca recibe esa clave.
async function adminWrite<T>(payload: {
  table: string;
  action: 'insert' | 'update' | 'delete';
  data?: unknown;
  filters?: Record<string, unknown>;
}): Promise<{ data: T | null; error: string | null }> {
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}api/admin/db`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const body = (await response.json().catch(() => null)) as
      | { data?: T | null; error?: string | null }
      | null;

    if (!response.ok) {
      return { data: null, error: body?.error || `HTTP ${response.status}` };
    }

    return { data: body?.data ?? null, error: body?.error ?? null };
  } catch {
    return { data: null, error: 'No se pudo conectar con el servidor de administración' };
  }
}

// Generic CRUD operations

/**
 * `select` devuelve una lista, salvo con `single: true`, que devuelve la primera
 * fila. Las dos firmas evitan que quien consume la consulta reciba `T | T[]` y
 * tenga que adivinar la forma en cada componente.
 */
function selectRows<T>(
  table: string,
  options?: SupabaseQueryOptions & { single?: false }
): Promise<{ data: T[] | null; error: string | null; count?: number }>;
function selectRows<T>(
  table: string,
  options: SupabaseQueryOptions & { single: true }
): Promise<{ data: T | null; error: string | null; count?: number }>;
async function selectRows<T>(
  table: string,
  options?: SupabaseQueryOptions & { single?: boolean }
): Promise<{ data: T | T[] | null; error: string | null; count?: number }> {
  const result = await supabaseRequest<T[]>(table, 'GET', undefined, options);
  if (result.error) return result;
  if (options?.single) {
    const rows = result.data as T[] | null;
    return { data: rows?.[0] ?? null, error: null };
  }
  return result;
}

export const db = {
  // Select with filters
  select: selectRows,

  // Insert
  async insert<T>(
    table: string,
    data: Record<string, unknown> | Record<string, unknown>[]
  ): Promise<{ data: T | null; error: string | null }> {
    return adminWrite<T>({ table, action: 'insert', data });
  },

  // Update
  async update<T>(
    table: string,
    data: Record<string, unknown>,
    filters: Record<string, unknown>
  ): Promise<{ data: T | null; error: string | null }> {
    return adminWrite<T>({ table, action: 'update', data, filters });
  },

  // Delete
  async delete(
    table: string,
    filters: Record<string, unknown>
  ): Promise<{ data: null; error: string | null }> {
    const result = await adminWrite<null>({ table, action: 'delete', filters });
    return { data: null, error: result.error };
  },

  // Count
  async count(
    table: string,
    filters?: Record<string, unknown>
  ): Promise<{ count: number; error: string | null }> {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        params.append(key, `eq.${value}`);
      });
    }

    const headers: Record<string, string> = {
      apikey: SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
      Prefer: 'count=exact',
      Range: '0-0',
    };

    const url = `${SUPABASE_URL}/rest/v1/${table}?${params.toString()}`;
    const response = await fetch(url, { method: 'HEAD', headers });

    if (!response.ok) {
      return { count: 0, error: `HTTP ${response.status}` };
    }

    const contentRange = response.headers.get('content-range');
    const count = contentRange ? parseInt(contentRange.split('/')[1]) : 0;
    return { count, error: null };
  },
};

// Registro público: crea la cuenta de cliente y deja la sesión iniciada.
export interface RegisterInput {
  alias: string;
  name: string;
  password: string;
  country_iso: string;
  dial_code: string;
  phone: string;
  email?: string;
  turnstileToken?: string;
}

// Auth API (JWT-based, no Supabase auth)
export const authApi = {
  async login(username: string, password: string, turnstileToken?: string) {
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}api/login`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, turnstileToken: turnstileToken || '' }),
      });

      const body = (await response.json().catch(() => null)) as
        | { user?: User; error?: string }
        | null;

      if (!response.ok || !body?.user) {
        return { data: null, error: body?.error || 'No se pudo iniciar sesión' };
      }

      // La sesión real vive en una cookie HttpOnly; el valor local solo indica
      // que hay sesión iniciada y nunca se envía a Supabase.
      return { data: { user: body.user, token: 'session' }, error: null };
    } catch {
      return { data: null, error: 'No se pudo conectar con el servidor' };
    }
  },

  async register(input: RegisterInput) {
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}api/register`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...input,
          email: input.email?.trim() || undefined,
          turnstileToken: input.turnstileToken || '',
        }),
      });

      const body = (await response.json().catch(() => null)) as
        | { user?: User; error?: string }
        | null;

      if (!response.ok || !body?.user) {
        return { data: null, error: body?.error || 'No se pudo crear la cuenta' };
      }

      return { data: { user: body.user, token: 'session' }, error: null };
    } catch {
      return { data: null, error: 'No se pudo conectar con el servidor' };
    }
  },
};

// Cuentas de usuarios del sistema y de clientes. Pasa por Pages Functions
// (sesión de administración), así que no requiere captcha ni expone RPCs
// públicas de registro.
export interface AccountInput {
  name: string;
  username: string;
  password: string;
  email?: string;
  phone?: string;
  role?: string;
  hotel_id?: string;
}

export type AccountKind = 'users' | 'clients';

/** Resultado del envío de credenciales al crear una cuenta. */
export interface AccountEmailStatus {
  to: string;
  sent: boolean;
  error?: string;
}

async function accountsRequest<T>(
  kind: AccountKind,
  init: RequestInit & { id?: string }
): Promise<{ data: T | null; error: string | null; emailStatus: AccountEmailStatus | null }> {
  const { id, ...rest } = init;
  const url = `${import.meta.env.BASE_URL}api/admin/accounts?type=${kind}${id ? `&id=${encodeURIComponent(id)}` : ''}`;
  try {
    const response = await fetch(url, { credentials: 'include', ...rest });
    const body = (await response.json().catch(() => null)) as
      | { data?: T; error?: string | null; emailStatus?: AccountEmailStatus | null }
      | null;
    if (!response.ok) {
      return {
        data: null,
        error: body?.error || 'No se pudo completar la operación',
        emailStatus: null,
      };
    }
    return {
      data: (body?.data ?? null) as T | null,
      error: null,
      emailStatus: body?.emailStatus ?? null,
    };
  } catch {
    return { data: null, error: 'No se pudo conectar con el servidor', emailStatus: null };
  }
}

export const accountsApi = {
  list: <T,>(kind: AccountKind) => accountsRequest<T[]>(kind, { method: 'GET' }),
  create: <T,>(kind: AccountKind, input: AccountInput) =>
    accountsRequest<T>(kind, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    }),
  remove: (kind: AccountKind, id: string) =>
    accountsRequest<null>(kind, { method: 'DELETE', id }),
};

// Solicitudes de reserva del formulario público. Se guardan en la base; si hay
// sesión de cliente, el servidor las vincula a esa cuenta (el navegador nunca
// envía el identificador del cliente).
export interface BookingRequestInput {
  hotel_id: string;
  guest_name: string;
  guest_phone: string;
  guest_email?: string;
  check_in: string;
  check_out: string;
  adults: number;
  children_count: number;
  room_type: string;
  room_unit?: string;
  message?: string;
}

export const bookingApi = {
  async create(input: BookingRequestInput) {
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}api/public/reservation`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });

      const body = (await response.json().catch(() => null)) as
        | { data?: { id?: string | null } | null; error?: string | null }
        | null;

      if (!response.ok) {
        return { id: null, error: body?.error || 'No se pudo enviar la solicitud' };
      }
      return { id: body?.data?.id ?? null, error: null };
    } catch {
      return { id: null, error: 'No se pudo conectar con el servidor' };
    }
  },
};

// Datos que el cliente puede editar desde su cuenta.
export interface ProfileInput {
  name?: string;
  email?: string;
  country_iso?: string;
  dial_code?: string;
  phone?: string;
  gender?: string;
  age?: number | null;
  profession?: string;
}

// Área de cliente (protegida por la cookie de sesión en el servidor).
export const clientApi = {
  async me() {
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}api/client/me`, {
        credentials: 'include',
      });
      const body = (await response.json().catch(() => null)) as
        | { data?: unknown; error?: string | null }
        | null;
      if (!response.ok) {
        return { data: null, error: body?.error || 'No se pudo cargar tu cuenta' };
      }
      return { data: body?.data ?? null, error: null };
    } catch {
      return { data: null, error: 'No se pudo conectar con el servidor' };
    }
  },

  /** Cancela una reserva pendiente propia; la unidad vuelve a quedar libre. */
  async cancelReservation(id: string) {
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}api/client/reservations`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const body = (await response.json().catch(() => null)) as
        | { data?: { id?: string; status?: string } | null; error?: string | null }
        | null;
      if (!response.ok) {
        return { data: null, error: body?.error || 'No se pudo cancelar la reserva' };
      }
      return { data: body?.data ?? null, error: null };
    } catch {
      return { data: null, error: 'No se pudo conectar con el servidor' };
    }
  },

  async updateProfile(input: ProfileInput) {
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}api/client/me`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      const body = (await response.json().catch(() => null)) as
        | { data?: { client?: unknown } | null; error?: string | null }
        | null;
      if (!response.ok) {
        return { data: null, error: body?.error || 'No se pudo guardar el perfil' };
      }
      return { data: body?.data?.client ?? null, error: null };
    } catch {
      return { data: null, error: 'No se pudo conectar con el servidor' };
    }
  },
};

// File upload
export async function uploadFile(
  bucket: string,
  path: string,
  file: File
): Promise<{ url: string | null; error: string | null }> {
  const headers: Record<string, string> = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${getAuthToken() || SUPABASE_ANON_KEY}`,
    'Content-Type': file.type,
  };

  const response = await fetch(
    `${SUPABASE_URL}/storage/v1/upload/${bucket}/${path}`,
    { method: 'POST', headers, body: file }
  );

  if (!response.ok) {
    return { url: null, error: `Upload failed: ${response.status}` };
  }

  const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
  return { url: publicUrl, error: null };
}

export interface UploadedMedia {
  url: string;
  path: string;
  name: string;
  type: 'image' | 'video';
  size: number;
}

/**
 * Sube una foto o video al bucket público de Supabase Storage. Pasa por el
 * backend porque el navegador no tiene (ni debe tener) la service role key.
 */
export async function uploadMedia(
  file: File,
  folder: string
): Promise<{ media: UploadedMedia | null; error: string | null }> {
  try {
    const form = new FormData();
    form.append('file', file);
    form.append('folder', folder);

    const response = await fetch(`${import.meta.env.BASE_URL}api/admin/media`, {
      method: 'POST',
      credentials: 'include',
      body: form,
    });

    const body = (await response.json().catch(() => null)) as
      | { media?: UploadedMedia; error?: string | null }
      | null;

    if (!response.ok || !body?.media) {
      return { media: null, error: body?.error || `HTTP ${response.status}` };
    }
    return { media: body.media, error: null };
  } catch {
    return { media: null, error: 'No se pudo conectar con el servidor de administración' };
  }
}

/** Borra un archivo del bucket a partir de su ruta relativa. */
export async function deleteMedia(path: string): Promise<{ error: string | null }> {
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}api/admin/media`, {
      method: 'DELETE',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path }),
    });
    const body = (await response.json().catch(() => null)) as { error?: string | null } | null;
    return { error: response.ok ? null : body?.error || `HTTP ${response.status}` };
  } catch {
    return { error: 'No se pudo conectar con el servidor de administración' };
  }
}

/** Extrae la ruta interna (`atractivos/...`) desde una URL pública del bucket. */
export function storagePathFromUrl(url: string): string | null {
  const marker = '/storage/v1/object/public/';
  const index = url.indexOf(marker);
  if (index < 0) return null;
  const rest = url.slice(index + marker.length);
  const slash = rest.indexOf('/');
  if (slash < 0) return null;
  const path = rest.slice(slash + 1).split('?')[0];
  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
}

// WhatsApp message builder
export function buildWhatsAppMessage(
  hotelWhatsapp: string,
  data: {
    guestName: string;
    adults: number;
    children: number;
    checkIn: string;
    checkOut: string;
    roomType: string;
  }
): string {
  const message = `Hola.\n\nMi nombre es ${data.guestName}.\nDeseo consultar disponibilidad.\n\nAdultos: ${data.adults}\nNiños: ${data.children}\n\nIngreso: ${data.checkIn}\nSalida: ${data.checkOut}\n\nHabitación: ${data.roomType}`;

  const encodedMessage = encodeURIComponent(message);
  return `https://wa.me/${hotelWhatsapp}?text=${encodedMessage}`;
}
