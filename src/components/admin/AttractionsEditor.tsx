import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowDown,
  ArrowUp,
  Check,
  Eye,
  EyeOff,
  Film,
  FolderOpen,
  ImagePlus,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  Save,
  Trash2,
  Upload,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { db, deleteMedia, storagePathFromUrl, uploadMedia } from '../../api/client';
import { findAttractionFolder, inferMediaType, useAttractionsMedia } from '../../hooks/useAttractionsMedia';
import {
  useCreateAttraction,
  useDeleteAttraction,
  useUpdateAttraction,
} from '../../hooks/useQueries';
import type { Attraction, AttractionImage } from '../../types';
import ConfirmDialog from '../common/ConfirmDialog';

export interface AttractionsEditorHandle {
  save: () => Promise<void>;
}

interface AttractionsEditorProps {
  hotelId: string;
  /** Atractivos del hotel, incluidas las filas inactivas. */
  attractions: Array<Attraction & { images?: AttractionImage[] }>;
  /** Valor crudo de `configuracion_hotel.attractions_media_folders`. */
  folderOverrides?: string;
  /** Segundos de cada cambio de imagen, por id de atractivo. */
  durations?: Record<string, number>;
  onSaveDurations?: (durations: Record<string, number>) => Promise<void>;
  isLoading?: boolean;
}

const DEFAULT_DURATION = 6;
const MIN_DURATION = 3;
const MAX_DURATION = 30;

interface AttractionDraft {
  key: string;
  id?: string;
  title: string;
  description: string;
  location: string;
  latitude: string;
  longitude: string;
  active: boolean;
  folder: string;
}

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

export function suggestedFolder(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function parseOverrides(value?: string): Record<string, string> {
  if (!value) return {};
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>)
        .filter(([, folder]) => typeof folder === 'string' && folder.trim() !== '')
        .map(([id, folder]) => [id, String(folder).trim()])
    );
  } catch {
    return {};
  }
}

function coordinate(value: number | null | undefined): string {
  return typeof value === 'number' && Number.isFinite(value) ? String(value) : '';
}

function parseCoordinate(value: string): number | null {
  const parsed = Number.parseFloat(value.replace(',', '.').trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function buildDrafts(
  attractions: Array<Attraction & { images?: AttractionImage[] }>,
  overrides: Record<string, string>
): AttractionDraft[] {
  return attractions.map((attraction) => ({
    key: attraction.id,
    id: attraction.id,
    title: attraction.title,
    description: attraction.description || '',
    location: attraction.location || '',
    latitude: coordinate(attraction.latitude),
    longitude: coordinate(attraction.longitude),
    active: attraction.active,
    folder: overrides[attraction.id] || '',
  }));
}

let counter = 0;
function newKey() {
  counter += 1;
  return `nuevo-${Date.now()}-${counter}`;
}

const AttractionsEditor = forwardRef<AttractionsEditorHandle, AttractionsEditorProps>(
  ({ hotelId, attractions, folderOverrides, durations = {}, onSaveDurations, isLoading }, ref) => {
    const [drafts, setDrafts] = useState<AttractionDraft[]>(() =>
      buildDrafts(attractions, parseOverrides(folderOverrides))
    );
    const [durationDrafts, setDurationDrafts] = useState<Record<string, string>>(() =>
      Object.fromEntries(attractions.map((item) => [item.id, String(durations[item.id] ?? DEFAULT_DURATION)]))
    );
    const [savingDurationKey, setSavingDurationKey] = useState<string | null>(null);
    const [editingKey, setEditingKey] = useState<string | null>(null);
    const [uploadingKey, setUploadingKey] = useState<string | null>(null);
    const [removingMediaId, setRemovingMediaId] = useState<string | null>(null);
    const [geocodingKey, setGeocodingKey] = useState<string | null>(null);
    const [attractionToDelete, setAttractionToDelete] = useState<AttractionDraft | null>(null);
    const [mediaToDelete, setMediaToDelete] = useState<AttractionImage | null>(null);
    const { folders } = useAttractionsMedia();
    const queryClient = useQueryClient();

    const createAttraction = useCreateAttraction();
    const updateAttraction = useUpdateAttraction();
    const deleteAttraction = useDeleteAttraction();

    const dataSignature = useMemo(
      () =>
        `${attractions
          .map(
            (item) =>
              `${item.id}:${item.title}:${item.description ?? ''}:${item.location ?? ''}:${
                item.latitude ?? ''
              }:${item.longitude ?? ''}:${item.active}:${item.order}`
          )
          .join('|')}::${folderOverrides ?? ''}`,
      [attractions, folderOverrides]
    );
    const lastSignature = useRef<string | null>(null);

    useEffect(() => {
      if (lastSignature.current === dataSignature) return;
      lastSignature.current = dataSignature;
      setDrafts(buildDrafts(attractions, parseOverrides(folderOverrides)));
    }, [attractions, folderOverrides, dataSignature]);

    const durationSignature = useMemo(
      () => `${attractions.map((item) => item.id).join(',')}|${JSON.stringify(durations)}`,
      [attractions, durations]
    );

    // Refresca los campos de duración cuando cambia la configuración guardada.
    useEffect(() => {
      setDurationDrafts(
        Object.fromEntries(
          attractions.map((item) => [item.id, String(durations[item.id] ?? DEFAULT_DURATION)])
        )
      );
    }, [durationSignature]);

    const patch = (key: string, changes: Partial<AttractionDraft>) => {
      setDrafts((prev) => prev.map((draft) => (draft.key === key ? { ...draft, ...changes } : draft)));
    };

    const move = (key: string, direction: -1 | 1) => {
      setDrafts((prev) => {
        const index = prev.findIndex((draft) => draft.key === key);
        const target = index + direction;
        if (index < 0 || target < 0 || target >= prev.length) return prev;
        const next = [...prev];
        [next[index], next[target]] = [next[target], next[index]];
        return next;
      });
    };

    const refreshMedia = () =>
      queryClient.invalidateQueries({ queryKey: ['attractionsWithImages'] });

    const remove = (draft: AttractionDraft) => {
      setAttractionToDelete(draft);
    };

    const confirmRemove = () => {
      if (!attractionToDelete) return;
      setDrafts((prev) => prev.filter((item) => item.key !== attractionToDelete.key));
      if (editingKey === attractionToDelete.key) setEditingKey(null);
      setAttractionToDelete(null);
    };

    const add = () => {
      const key = newKey();
      setDrafts((prev) => [
        ...prev,
        {
          key,
          title: '',
          description: '',
          location: '',
          latitude: '',
          longitude: '',
          active: true,
          folder: '',
        },
      ]);
      setEditingKey(key);
    };

    const geocode = async (draft: AttractionDraft) => {
      const query = (draft.location || draft.title).trim();
      if (!query) {
        toast.error('Escribí primero la ubicación');
        return;
      }
      setGeocodingKey(draft.key);
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=bo&q=${encodeURIComponent(
            query
          )}`,
          { headers: { Accept: 'application/json' } }
        );
        const results = response.ok ? await response.json() : [];
        const first = Array.isArray(results) ? results[0] : null;
        if (!first?.lat || !first?.lon) {
          toast.error('No se encontró la ubicación. Ingresá las coordenadas a mano.');
          return;
        }
        patch(draft.key, {
          latitude: Number(first.lat).toFixed(5),
          longitude: Number(first.lon).toFixed(5),
        });
        toast.success('Coordenadas encontradas');
      } catch {
        toast.error('No se pudo buscar la ubicación');
      } finally {
        setGeocodingKey(null);
      }
    };

    const uploadFiles = async (draft: AttractionDraft, files: FileList | null) => {
      if (!draft.id || !files || files.length === 0) return;
      const existing = attractions.find((item) => item.id === draft.id)?.images || [];
      let order = existing.length;
      let failed = 0;
      setUploadingKey(draft.key);

      for (const file of Array.from(files)) {
        if (file.size > MAX_UPLOAD_BYTES) {
          toast.error(`${file.name} supera los 50 MB`);
          failed += 1;
          continue;
        }

        const { media, error } = await uploadMedia(file, `atractivos/${draft.id}`);
        if (error || !media) {
          toast.error(error || `No se pudo subir ${file.name}`);
          failed += 1;
          continue;
        }

        const { error: insertError } = await db.insert('atractivo_imagenes', {
          attraction_id: draft.id,
          image_url: media.url,
          alt_text: file.name,
          order,
        });
        if (insertError) {
          toast.error(insertError);
          failed += 1;
          continue;
        }
        order += 1;
      }

      await refreshMedia();
      setUploadingKey(null);
      if (failed === 0) toast.success('Archivos subidos');
    };

    const saveDuration = async (draft: AttractionDraft) => {
      if (!draft.id || !onSaveDurations) return;
      const parsed = Number.parseInt(durationDrafts[draft.id] ?? '', 10);
      if (!Number.isFinite(parsed)) {
        toast.error('Escribí una duración válida');
        return;
      }
      const seconds = Math.min(MAX_DURATION, Math.max(MIN_DURATION, parsed));
      setSavingDurationKey(draft.key);
      try {
        await onSaveDurations({ ...durations, [draft.id]: seconds });
        setDurationDrafts((prev) => ({ ...prev, [draft.id as string]: String(seconds) }));
        toast.success(`Duración guardada: ${seconds}s`);
      } catch {
        toast.error('No se pudo guardar la duración');
      }
      setSavingDurationKey(null);
    };

    const removeMedia = (image: AttractionImage) => {
      setMediaToDelete(image);
    };

    const confirmRemoveMedia = async () => {
      const image = mediaToDelete;
      if (!image) return;
      setRemovingMediaId(image.id);
      const path = storagePathFromUrl(image.image_url);
      const { error } = await db.delete('atractivo_imagenes', { id: image.id });
      if (error) {
        toast.error(error);
        setRemovingMediaId(null);
        return;
      }
      if (path) {
        const { error: storageError } = await deleteMedia(path);
        if (storageError) toast.error(storageError);
      }
      await refreshMedia();
      setRemovingMediaId(null);
      setMediaToDelete(null);
    };

    useImperativeHandle(ref, () => ({
      save: async () => {
        if (!hotelId) return;
        for (const draft of drafts) {
          if (!draft.title.trim()) throw new Error('Cada atractivo necesita un nombre');
        }

        const kept: string[] = [];
        for (const [index, draft] of drafts.entries()) {
          const payload = {
            hotel_id: hotelId,
            title: draft.title.trim(),
            description: draft.description.trim() || null,
            location: draft.location.trim() || null,
            latitude: parseCoordinate(draft.latitude),
            longitude: parseCoordinate(draft.longitude),
            active: draft.active,
            order: index,
          };

          if (draft.id) {
            kept.push(draft.id);
            const before = attractions.find((item) => item.id === draft.id);
            const changed =
              !before ||
              before.title !== payload.title ||
              (before.description || '') !== (payload.description || '') ||
              (before.location || '') !== (payload.location || '') ||
              (before.latitude ?? null) !== payload.latitude ||
              (before.longitude ?? null) !== payload.longitude ||
              before.active !== payload.active ||
              before.order !== payload.order;
            if (changed) await updateAttraction.mutateAsync({ id: draft.id, data: payload });
          } else {
            await createAttraction.mutateAsync(payload);
          }
        }

        for (const attraction of attractions) {
          if (!kept.includes(attraction.id)) await deleteAttraction.mutateAsync(attraction.id);
        }
      },
    }));

    if (isLoading) {
      return (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
        </div>
      );
    }

    return (
      <div className="space-y-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Atractivos</p>
          <p className="mt-1 text-xs text-gray-400">
            Las fotos y videos subidos acá se guardan en Supabase Storage y tienen prioridad sobre
            la carpeta <code>public/atractivos/&lt;carpeta&gt;</code>, que queda como respaldo.
          </p>
        </div>

        <button
          type="button"
          onClick={add}
          className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-200 p-3 text-sm font-medium text-gray-500 transition-colors hover:border-gray-900 hover:text-gray-900"
        >
          <Plus className="h-4 w-4" />
          Agregar atractivo
        </button>

        {drafts.length === 0 ? (
          <p className="rounded-xl border border-dashed border-gray-200 py-6 text-center text-sm text-gray-500">
            No hay atractivos todavía.
          </p>
        ) : null}

        {drafts.map((draft, index) => {
          const matchedFolder = findAttractionFolder(folders, draft.title, draft.folder);
          const uploadedMedia = attractions.find((item) => item.id === draft.id)?.images || [];
          const previewImage =
            uploadedMedia
              .map((image) => image.image_url)
              .find((url) => inferMediaType(url) === 'image') ||
            matchedFolder?.files.find((file) => file.type === 'image')?.url ||
            '';
          const folderCount = matchedFolder?.files.length || 0;
          const isEditing = editingKey === draft.key;
          const isUploading = uploadingKey === draft.key;

          return (
            <div key={draft.key} className="overflow-hidden rounded-xl border border-gray-200 bg-white">
              <div className="flex items-center gap-2 px-2 py-2">
                <div className="h-11 w-16 shrink-0 overflow-hidden rounded-lg bg-gray-100">
                  {previewImage ? (
                    <img src={previewImage} alt="" className="h-full w-full object-cover" loading="lazy" />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`truncate text-sm font-medium ${draft.active ? 'text-gray-900' : 'text-gray-400'}`}>
                    {draft.title || 'Sin nombre'}
                  </p>
                  <p className="truncate text-[11px] text-gray-400">
                    {uploadedMedia.length > 0
                      ? `${uploadedMedia.length} archivo${uploadedMedia.length === 1 ? '' : 's'} en la galería`
                      : matchedFolder
                        ? `${matchedFolder.folder} · ${folderCount} archivo${folderCount === 1 ? '' : 's'}`
                        : `Sin medios · public/atractivos/${suggestedFolder(draft.title) || 'nombre'}`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => patch(draft.key, { active: !draft.active })}
                  title={draft.active ? 'Ocultar en la portada' : 'Mostrar en la portada'}
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors ${
                    draft.active ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-400'
                  }`}
                >
                  {draft.active ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                </button>
                <button
                  type="button"
                  onClick={() => move(draft.key, -1)}
                  disabled={index === 0}
                  title="Subir"
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-30"
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => move(draft.key, 1)}
                  disabled={index === drafts.length - 1}
                  title="Bajar"
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-30"
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setEditingKey(isEditing ? null : draft.key)}
                  title="Editar"
                  className="flex h-7 w-7 items-center justify-center rounded-lg bg-gray-50 text-gray-500 hover:bg-gray-100"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => remove(draft)}
                  title="Eliminar"
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>

              {isEditing ? (
                <div className="space-y-2 border-t border-gray-100 bg-gray-50 p-3">
                  <input
                    type="text"
                    value={draft.title}
                    onChange={(event) => patch(draft.key, { title: event.target.value })}
                    placeholder="Nombre (ej. Cañón del Tunki)"
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                  />
                  <textarea
                    rows={3}
                    value={draft.description}
                    onChange={(event) => patch(draft.key, { description: event.target.value })}
                    placeholder="Descripción"
                    className="w-full resize-none rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                  />
                  <input
                    type="text"
                    value={draft.location}
                    onChange={(event) => patch(draft.key, { location: event.target.value })}
                    placeholder="Ubicación (ej. Colomi, Cochabamba)"
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                  />

                  <div className="rounded-lg border border-gray-200 bg-white p-2.5">
                    <label className="mb-1 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-gray-500">
                      <MapPin className="h-3 w-3" />
                      Ubicación en el mapa
                    </label>
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={draft.latitude}
                        onChange={(event) => patch(draft.key, { latitude: event.target.value })}
                        placeholder="Latitud (ej. -17.38431)"
                        className="w-1/2 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                      />
                      <input
                        type="text"
                        inputMode="decimal"
                        value={draft.longitude}
                        onChange={(event) => patch(draft.key, { longitude: event.target.value })}
                        placeholder="Longitud (ej. -66.13495)"
                        className="w-1/2 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                      />
                    </div>
                    <div className="mt-1.5 flex items-center justify-between gap-2">
                      <p className="text-[11px] text-gray-400">Se usa para el mapa de la sección.</p>
                      <button
                        type="button"
                        onClick={() => geocode(draft)}
                        disabled={geocodingKey === draft.key}
                        className="flex items-center gap-1 rounded-lg bg-gray-100 px-2 py-1 text-[11px] font-medium text-gray-600 hover:bg-gray-200 disabled:opacity-50"
                      >
                        {geocodingKey === draft.key ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <MapPin className="h-3 w-3" />
                        )}
                        Buscar por ubicación
                      </button>
                    </div>
                  </div>

                  <div className="rounded-lg border border-gray-200 bg-white p-2.5">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <p className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-gray-500">
                        <ImagePlus className="h-3 w-3" />
                        Fotos y videos
                      </p>
                      <label
                        className={`flex cursor-pointer items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium ${
                          draft.id
                            ? 'bg-gray-900 text-white hover:bg-gray-800'
                            : 'cursor-not-allowed bg-gray-100 text-gray-400'
                        }`}
                        title={draft.id ? 'Subir archivos' : 'Guardá el atractivo primero'}
                      >
                        {isUploading ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Upload className="h-3 w-3" />
                        )}
                        {isUploading ? 'Subiendo...' : 'Subir'}
                        <input
                          type="file"
                          multiple
                          accept="image/*,video/*"
                          className="hidden"
                          disabled={!draft.id || isUploading}
                          onChange={(event) => {
                            void uploadFiles(draft, event.target.files);
                            event.target.value = '';
                          }}
                        />
                      </label>
                    </div>

                    {uploadedMedia.length > 0 ? (
                      <div className="grid grid-cols-4 gap-1.5">
                        {uploadedMedia.map((image) => {
                          const isVideo = inferMediaType(image.image_url) === 'video';
                          return (
                            <div
                              key={image.id}
                              className="group relative aspect-square overflow-hidden rounded-lg bg-gray-100"
                              title={image.alt_text || image.image_url}
                            >
                              {isVideo ? (
                                <video
                                  src={image.image_url}
                                  muted
                                  preload="metadata"
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <img
                                  src={image.image_url}
                                  alt={image.alt_text || ''}
                                  className="h-full w-full object-cover"
                                  loading="lazy"
                                />
                              )}
                              {isVideo ? (
                                <span className="absolute bottom-1 left-1 flex items-center gap-0.5 rounded bg-black/60 px-1 py-0.5 text-[8px] font-semibold uppercase tracking-wider text-white">
                                  <Film className="h-2.5 w-2.5" />
                                </span>
                              ) : null}
                              <button
                                type="button"
                                onClick={() => void removeMedia(image)}
                                disabled={removingMediaId === image.id}
                                title="Eliminar archivo"
                                className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity hover:bg-red-600 focus:opacity-100 group-hover:opacity-100 disabled:opacity-100"
                              >
                                {removingMediaId === image.id ? (
                                  <Loader2 className="h-2.5 w-2.5 animate-spin" />
                                ) : (
                                  <Trash2 className="h-2.5 w-2.5" />
                                )}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="rounded-lg border border-dashed border-gray-200 bg-white py-3 text-center text-[11px] text-gray-400">
                        {draft.id
                          ? 'Todavía no subiste archivos. Mientras tanto se usa la carpeta del proyecto.'
                          : 'Guardá el atractivo y después subí sus fotos y videos.'}
                      </p>
                    )}

                    {uploadedMedia.length === 0 && matchedFolder && folderCount > 0 ? (
                      <div className="mt-2">
                        <p className="mb-1 text-[10px] uppercase tracking-wider text-gray-400">
                          Desde {matchedFolder.folder}
                        </p>
                        <div className="grid grid-cols-4 gap-1.5">
                          {matchedFolder.files.slice(0, 8).map((file) => (
                            <div
                              key={file.url}
                              className="relative aspect-square overflow-hidden rounded-lg bg-gray-100"
                              title={file.name}
                            >
                              {file.type === 'image' ? (
                                <img
                                  src={file.url}
                                  alt={file.name}
                                  className="h-full w-full object-cover"
                                  loading="lazy"
                                />
                              ) : (
                                <video
                                  src={file.url}
                                  muted
                                  preload="metadata"
                                  className="h-full w-full object-cover"
                                />
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <div>
                    <label className="mb-1 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-gray-500">
                      <FolderOpen className="h-3 w-3" />
                      Carpeta de medios
                    </label>
                    <select
                      value={draft.folder}
                      onChange={(event) => patch(draft.key, { folder: event.target.value })}
                      className="w-full rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                    >
                      <option value="">Automática (por nombre)</option>
                      {folders.map((folder) => (
                        <option key={folder.folder} value={folder.folder}>
                          {folder.folder} ({folder.files.length})
                        </option>
                      ))}
                    </select>
                    <p className="mt-1 text-[11px] text-gray-400">
                      Respaldo en el proyecto: <code>public/atractivos/{suggestedFolder(draft.title) || 'nombre'}</code>
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setEditingKey(null)}
                    className="flex items-center gap-1 rounded-lg bg-gray-900 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-gray-800"
                  >
                    <Check className="h-3.5 w-3.5" />
                    Listo
                  </button>
                </div>
              ) : null}

              {/* Ajuste independiente del tiempo entre imágenes */}
              <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 bg-gray-50 px-3 py-2">
                <label
                  htmlFor={`duracion-${draft.key}`}
                  className="text-[10px] font-medium uppercase tracking-wider text-gray-500"
                >
                  Duración
                </label>
                <input
                  id={`duracion-${draft.key}`}
                  type="number"
                  min={MIN_DURATION}
                  max={MAX_DURATION}
                  value={
                    draft.id
                      ? durationDrafts[draft.id] ?? String(DEFAULT_DURATION)
                      : String(DEFAULT_DURATION)
                  }
                  onChange={(event) => {
                    if (!draft.id) return;
                    const id = draft.id;
                    setDurationDrafts((prev) => ({ ...prev, [id]: event.target.value }));
                  }}
                  disabled={!draft.id}
                  className="w-16 rounded-lg border border-gray-200 bg-white px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 disabled:bg-gray-100 disabled:text-gray-400"
                  aria-label={`Duración del cambio de imagen de ${draft.title || 'este atractivo'}`}
                />
                <span className="text-[11px] text-gray-400">seg</span>
                {draft.id ? (
                  <button
                    type="button"
                    onClick={() => void saveDuration(draft)}
                    disabled={savingDurationKey === draft.key}
                    className="ml-auto flex items-center gap-1 rounded-lg bg-gray-900 px-2.5 py-1 text-[11px] font-medium text-white transition-colors hover:bg-gray-800 disabled:opacity-50"
                  >
                    {savingDurationKey === draft.key ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Save className="h-3 w-3" />
                    )}
                    Guardar
                  </button>
                ) : (
                  <span className="ml-auto text-[10px] text-gray-400">Guardá el atractivo primero</span>
                )}
              </div>
            </div>
          );
        })}

        <p className="text-center text-[11px] text-gray-400">
          Los cambios de texto y coordenadas se aplican con Guardar cambios. Los archivos se suben al
          instante.
        </p>

        <ConfirmDialog
          open={Boolean(attractionToDelete)}
          title="Eliminar atractivo"
          description={`¿Eliminar “${attractionToDelete?.title || ''}”? Sus archivos no se borran. Esta acción se aplica al guardar.`}
          confirmLabel="Eliminar atractivo"
          onConfirm={confirmRemove}
          onCancel={() => setAttractionToDelete(null)}
        />
        <ConfirmDialog
          open={Boolean(mediaToDelete)}
          title="Eliminar archivo"
          description="¿Eliminar este archivo? También se borra del almacenamiento. Esta acción no se puede deshacer."
          confirmLabel="Eliminar archivo"
          busy={removingMediaId === mediaToDelete?.id}
          onConfirm={() => void confirmRemoveMedia()}
          onCancel={() => {
            if (!removingMediaId) setMediaToDelete(null);
          }}
        />
      </div>
    );
  }
);

AttractionsEditor.displayName = 'AttractionsEditor';

export default AttractionsEditor;
