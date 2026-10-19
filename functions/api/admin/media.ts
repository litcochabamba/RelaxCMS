import { json, readSession, type Env } from '../../_lib/env';

// Los archivos no pueden vivir en el repositorio (el sitio se publica como
// estático en Cloudflare). Se guardan en un bucket público de Supabase Storage
// y la base solo conserva la URL.
const DEFAULT_BUCKET = 'media';
const MAX_SIZE = 50 * 1024 * 1024; // 50 MB
const ALLOWED_PREFIXES = ['atractivos/', 'branding/', 'galeria/'];

const MIME_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
};

function bucketName(env: Env): string {
  return (env as Env & { MEDIA_BUCKET?: string }).MEDIA_BUCKET || DEFAULT_BUCKET;
}

function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

/** Solo se aceptan rutas relativas simples: sin `..`, sin barras iniciales. */
function sanitizeFolder(folder: string | null): string | null {
  if (!folder) return null;
  const segments = folder
    .split('/')
    .map((segment) =>
      segment
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, '-')
        .replace(/^-+|-+$/g, '')
    )
    .filter(Boolean);

  if (segments.length === 0 || segments.length > 3) return null;
  return segments.join('/');
}

function isAllowedPath(path: string): boolean {
  if (!path || path.includes('..') || path.startsWith('/')) return false;
  return ALLOWED_PREFIXES.some((prefix) => path.startsWith(prefix));
}

function storageHeaders(env: Env, contentType?: string): Record<string, string> {
  return {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    ...(contentType ? { 'Content-Type': contentType } : {}),
  };
}

function publicUrl(env: Env, bucket: string, path: string): string {
  const encoded = path.split('/').map(encodeURIComponent).join('/');
  return `${env.SUPABASE_URL}/storage/v1/object/public/${bucket}/${encoded}`;
}

async function authorize(env: Env, request: Request): Promise<Response | null> {
  const session = await readSession(env, request);
  if (!session) return json({ error: 'Sesión no válida o expirada' }, 401);
  if (session.role !== 'admin' && session.role !== 'moderator') {
    return json({ error: 'La cuenta no tiene permisos de administración' }, 403);
  }
  return null;
}

export async function handleMedia(request: Request, env: Env): Promise<Response> {
  const denied = await authorize(env, request);
  if (denied) return denied;

  const bucket = bucketName(env);

  if (request.method === 'DELETE') {
    const body = (await request.json().catch(() => null)) as { path?: string } | null;
    const path = body?.path?.trim() || '';
    if (!isAllowedPath(path)) return json({ error: 'Ruta de archivo no válida' }, 400);

    const encoded = path.split('/').map(encodeURIComponent).join('/');
    const response = await fetch(`${env.SUPABASE_URL}/storage/v1/object/${bucket}/${encoded}`, {
      method: 'DELETE',
      headers: storageHeaders(env),
    });

    if (!response.ok && response.status !== 404) {
      const detail = await response.text().catch(() => '');
      return json({ error: `No se pudo borrar el archivo (HTTP ${response.status})`, detail }, 400);
    }
    return json({ error: null });
  }

  if (request.method !== 'POST') return json({ error: 'Método no permitido' }, 405);

  const form = await request.formData().catch(() => null);
  const file = form?.get('file');
  if (!form || !(file instanceof File)) return json({ error: 'Falta el archivo' }, 400);

  const folder = sanitizeFolder(typeof form.get('folder') === 'string' ? String(form.get('folder')) : null);
  if (!folder) return json({ error: 'Carpeta de destino no válida' }, 400);

  const extension = MIME_EXTENSIONS[file.type];
  if (!extension) {
    return json({ error: 'Formato no permitido. Usá JPG, PNG, WebP, AVIF, GIF, SVG, MP4, WebM o MOV.' }, 400);
  }
  if (file.size === 0) return json({ error: 'El archivo está vacío' }, 400);
  if (file.size > MAX_SIZE) return json({ error: 'El archivo supera los 50 MB' }, 413);

  const base = slugify(file.name) || 'archivo';
  const path = `${folder}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${base}.${extension}`;
  const encoded = path.split('/').map(encodeURIComponent).join('/');

  const response = await fetch(`${env.SUPABASE_URL}/storage/v1/object/${bucket}/${encoded}`, {
    method: 'POST',
    headers: {
      ...storageHeaders(env, file.type),
      'Cache-Control': 'public, max-age=31536000, immutable',
      'x-upsert': 'false',
    },
    body: await file.arrayBuffer(),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    return json({ error: `No se pudo subir el archivo (HTTP ${response.status})`, detail }, 400);
  }

  return json(
    {
      media: {
        url: publicUrl(env, bucket, path),
        path,
        name: file.name,
        type: file.type.startsWith('video/') ? 'video' : 'image',
        size: file.size,
      },
      error: null,
    },
    201
  );
}

export const onRequestPost = ({ request, env }: { request: Request; env: Env }) =>
  handleMedia(request, env);

export const onRequestDelete = ({ request, env }: { request: Request; env: Env }) =>
  handleMedia(request, env);
