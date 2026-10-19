import { json, readSession, type Env } from '../../_lib/env';

/**
 * Firma de subida para Cloudinary (solo personal del hotel).
 *
 *   POST /api/admin/cloudinary-signature  { folder: "relaxweb/galeria" }
 *
 * El navegador sube el archivo directo a Cloudinary con esta firma; el API
 * secret nunca sale del servidor. La firma incluye `folder` y `timestamp`, así
 * que solo sirve para subir a esa carpeta y vence en poco tiempo.
 */

const ALLOWED_FOLDERS = new Set([
  'relaxweb/galeria',
  'relaxweb/tipos',
  'relaxweb/amenidades',
  'relaxweb/promociones',
]);

async function sha1Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export async function handleCloudinarySignature(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'Método no permitido' }, 405);

  const session = await readSession(env, request);
  if (!session) return json({ error: 'Sesión no válida o expirada' }, 401);
  if (session.role !== 'admin' && session.role !== 'moderator') {
    return json({ error: 'La cuenta no tiene permisos de administración' }, 403);
  }

  const cloudName = (env.CLOUDINARY_CLOUD_NAME || '').trim();
  const apiKey = (env.CLOUDINARY_API_KEY || '').trim();
  const apiSecret = (env.CLOUDINARY_API_SECRET || '').trim();
  if (!cloudName || !apiKey || !apiSecret) {
    return json(
      { error: 'Cloudinary no está configurado. Faltan CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY o CLOUDINARY_API_SECRET.' },
      503
    );
  }

  const body = (await request.json().catch(() => null)) as { folder?: unknown } | null;
  const folder = typeof body?.folder === 'string' ? body.folder.trim() : '';
  if (!ALLOWED_FOLDERS.has(folder)) {
    return json({ error: 'Carpeta de destino no válida' }, 400);
  }

  const timestamp = Math.floor(Date.now() / 1000);
  // Cloudinary firma los parámetros ordenados alfabéticamente + el secret.
  const signature = await sha1Hex(`folder=${folder}&timestamp=${timestamp}${apiSecret}`);

  return json({
    data: {
      cloud_name: cloudName,
      api_key: apiKey,
      timestamp,
      signature,
      folder,
    },
    error: null,
  });
}

export const onRequestPost = ({ request, env }: { request: Request; env: Env }) =>
  handleCloudinarySignature(request, env);
