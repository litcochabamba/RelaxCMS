import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ImagePlus,
  Loader2,
  Megaphone,
  Pencil,
  Plus,
  Save,
  Trash2,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { uploadMedia } from '../../api/client';
import { useUpsertHotelConfig } from '../../hooks/useQueries';
import {
  PLACEMENT_LABELS,
  defaultBlock,
  parseHomeBlocks,
} from '../home/HomeBlocksSection';
import {
  MAX_PROMO_RIBBONS,
  PROMO_RIBBON_PLACEMENTS,
  parsePromoRibbonPlacements,
  type PromoRibbonPlacement,
} from '../../utils/promotions';
import type { HomeBlock, HomeBlockPlacement } from '../../types';

const PLACEMENTS = Object.keys(PLACEMENT_LABELS) as HomeBlockPlacement[];

interface HomeBlocksEditorProps {
  hotelId: string;
  /** Valor crudo de `configuracion_hotel.home_blocks`. */
  configValue?: string;
  /** Valor crudo de `configuracion_hotel.promo_ribbon_placements`. */
  ribbonConfig?: string;
}

let newBlockCounter = 0;

export default function HomeBlocksEditor({
  hotelId,
  configValue,
  ribbonConfig,
}: HomeBlocksEditorProps) {
  const upsertConfig = useUpsertHotelConfig();
  const parsed = useMemo(() => parseHomeBlocks(configValue), [configValue]);
  const parsedRibbon = useMemo(() => parsePromoRibbonPlacements(ribbonConfig), [ribbonConfig]);
  const [blocks, setBlocks] = useState<HomeBlock[]>(parsed);
  const [ribbonPlacements, setRibbonPlacements] = useState<PromoRibbonPlacement[]>(parsedRibbon);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // Se resincroniza cuando llega la configuración desde la base.
  useEffect(() => {
    setBlocks(parseHomeBlocks(configValue));
  }, [configValue]);

  useEffect(() => {
    setRibbonPlacements(parsePromoRibbonPlacements(ribbonConfig));
  }, [ribbonConfig]);

  const dirty = useMemo(
    () => JSON.stringify(blocks) !== JSON.stringify(parsed),
    [blocks, parsed]
  );

  const ribbonDirty = useMemo(
    () => JSON.stringify(ribbonPlacements) !== JSON.stringify(parsedRibbon),
    [ribbonPlacements, parsedRibbon]
  );

  const toggleRibbonPlacement = (placement: PromoRibbonPlacement) => {
    setRibbonPlacements((current) => {
      if (current.includes(placement)) return current.filter((item) => item !== placement);
      if (current.length >= MAX_PROMO_RIBBONS) return current;
      // Se mantiene el orden de la página, sin importar el orden de selección.
      return PROMO_RIBBON_PLACEMENTS.filter(
        (item) => current.includes(item) || item === placement
      ) as PromoRibbonPlacement[];
    });
  };

  const update = (id: string, patch: Partial<HomeBlock>) =>
    setBlocks((current) => current.map((block) => (block.id === id ? { ...block, ...patch } : block)));

  const add = (kind: HomeBlock['kind']) => {
    newBlockCounter += 1;
    const after: HomeBlockPlacement = kind === 'cinta' ? 'amenities' : 'rooms';
    const block = defaultBlock(kind, after);
    block.id = `${block.id}-${newBlockCounter}`;
    setBlocks((current) => [...current, block]);
    setEditingId(block.id);
  };

  const remove = (id: string) => {
    setBlocks((current) => current.filter((block) => block.id !== id));
    if (editingId === id) setEditingId(null);
  };

  const move = (id: string, direction: -1 | 1) => {
    setBlocks((current) => {
      const index = current.findIndex((block) => block.id === id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const handleUpload = async (id: string, file: File | undefined) => {
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      toast.error('La imagen supera los 20 MB');
      return;
    }
    setUploading(true);
    const { media, error } = await uploadMedia(file, 'bloques');
    setUploading(false);
    if (error || !media) {
      toast.error(error || 'No se pudo subir la imagen');
      return;
    }
    update(id, { image_url: media.url });
  };

  const handleSave = async () => {
    if (!hotelId) {
      toast.error('Falta el hotel');
      return;
    }
    try {
      if (dirty) {
        await upsertConfig.mutateAsync({
          hotelId,
          key: 'home_blocks',
          value: JSON.stringify(blocks),
          group: 'sections',
        });
      }
      if (ribbonDirty) {
        await upsertConfig.mutateAsync({
          hotelId,
          key: 'promo_ribbon_placements',
          value: JSON.stringify(ribbonPlacements),
          group: 'sections',
        });
      }
      toast.success('Avisos y cintas actualizados');
    } catch (error) {
      toast.error(error instanceof Error && error.message ? error.message : 'No se pudo guardar');
    }
  };

  const editing = blocks.find((block) => block.id === editingId) || null;

  return (
    <div className="space-y-4">
      <p className="text-xs leading-relaxed text-gray-500">
        Bloques a todo el ancho que se insertan entre las secciones de la home. Los avisos llevan
        imagen de fondo, alto propio y botón; las cintas son franjas de texto que se desplazan.
        El espacio debajo del hero queda reservado: el primer lugar disponible es después de
        Información.
      </p>

      <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-3">
        <div className="flex items-center gap-2">
          <Megaphone className="h-4 w-4 text-gray-500" />
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-600">
            Cinta de promociones
          </p>
          <span className="ml-auto text-[10px] text-gray-400">
            {ribbonPlacements.length} de {MAX_PROMO_RIBBONS}
          </span>
        </div>
        <p className="mt-1 text-[11px] leading-relaxed text-gray-500">
          La cinta automática con las promociones vigentes se repite hasta 3 veces entre
          secciones. Elegí las ubicaciones; nunca aparece debajo de la hero.
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {PROMO_RIBBON_PLACEMENTS.map((placement) => {
            const selected = ribbonPlacements.includes(placement);
            return (
              <button
                key={placement}
                type="button"
                onClick={() => toggleRibbonPlacement(placement)}
                disabled={!selected && ribbonPlacements.length >= MAX_PROMO_RIBBONS}
                aria-pressed={selected}
                className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                  selected
                    ? 'border-gray-900 bg-gray-900 text-white'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                }`}
              >
                {PLACEMENT_LABELS[placement as HomeBlockPlacement] || placement}
              </button>
            );
          })}
        </div>
        {ribbonPlacements.length === 0 ? (
          <p className="mt-2 text-[11px] text-amber-600">
            Sin ubicaciones seleccionadas: la cinta no se mostrará.
          </p>
        ) : null}
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => add('aviso')}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-gray-900 px-3 py-2 text-xs font-medium text-white hover:bg-gray-800"
        >
          <Plus className="h-3.5 w-3.5" /> Aviso
        </button>
        <button
          type="button"
          onClick={() => add('cinta')}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
        >
          <Plus className="h-3.5 w-3.5" /> Cinta
        </button>
      </div>

      {blocks.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 py-10 text-center">
          <Megaphone className="mx-auto mb-2 h-8 w-8 text-gray-300" />
          <p className="text-sm text-gray-500">Todavía no hay bloques</p>
          <p className="mt-1 text-xs text-gray-400">Agregá un aviso o una cinta para empezar</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {blocks.map((block, index) => (
            <li key={block.id} className="rounded-xl border border-gray-100">
              {editingId === block.id ? (
                <div className="space-y-3 p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium uppercase tracking-wider text-gray-500">
                      {block.kind === 'aviso' ? 'Aviso' : 'Cinta'}
                    </p>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="rounded p-1 text-gray-400 hover:bg-gray-100"
                      aria-label="Cerrar editor"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">Tipo</label>
                    <div className="grid grid-cols-2 gap-2">
                      {(['aviso', 'cinta'] as const).map((kind) => (
                        <button
                          key={kind}
                          type="button"
                          onClick={() =>
                            update(block.id, {
                              kind,
                              height: kind === 'aviso' ? Math.max(block.height, 200) : block.height,
                              speed: kind === 'cinta' && block.speed === 0 ? 22 : block.speed,
                            })
                          }
                          className={`rounded-lg border px-3 py-2 text-xs font-medium ${
                            block.kind === kind
                              ? 'border-gray-900 bg-gray-900 text-white'
                              : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                          }`}
                        >
                          {kind === 'aviso' ? 'Aviso grande' : 'Cinta'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">
                      Se muestra después de
                    </label>
                    <select
                      value={block.after}
                      onChange={(event) =>
                        update(block.id, { after: event.target.value as HomeBlockPlacement })
                      }
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
                    >
                      {PLACEMENTS.map((placement) => (
                        <option key={placement} value={placement}>
                          {PLACEMENT_LABELS[placement]}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">
                      {block.kind === 'aviso' ? 'Título' : 'Texto de la cinta'}
                    </label>
                    <input
                      type="text"
                      value={block.kind === 'aviso' ? block.title : block.text}
                      onChange={(event) =>
                        update(
                          block.id,
                          block.kind === 'aviso'
                            ? { title: event.target.value }
                            : { text: event.target.value }
                        )
                      }
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
                      placeholder={block.kind === 'aviso' ? 'Ofertas de temporada' : '2x1 en suites'}
                    />
                  </div>

                  {block.kind === 'aviso' ? (
                    <>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-gray-600">
                          Texto secundario
                        </label>
                        <textarea
                          rows={2}
                          value={block.text}
                          onChange={(event) => update(block.id, { text: event.target.value })}
                          className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
                          placeholder="Descripción del aviso"
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-xs font-medium text-gray-600">
                          Imagen de fondo
                        </label>
                        {block.image_url ? (
                          <div className="mb-2 flex items-center gap-2">
                            <img
                              src={block.image_url}
                              alt="Fondo del aviso"
                              className="h-14 w-24 rounded-lg object-cover"
                            />
                            <button
                              type="button"
                              onClick={() => update(block.id, { image_url: '' })}
                              className="rounded-lg px-2 py-1 text-xs font-medium text-red-500 hover:bg-red-50"
                            >
                              Quitar
                            </button>
                          </div>
                        ) : null}
                        <div className="flex flex-wrap gap-2">
                          <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50">
                            {uploading ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <ImagePlus className="h-3.5 w-3.5" />
                            )}
                            Subir imagen
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              disabled={uploading}
                              onChange={(event) => {
                                void handleUpload(block.id, event.target.files?.[0]);
                                event.target.value = '';
                              }}
                            />
                          </label>
                        </div>
                        <input
                          type="url"
                          value={block.image_url}
                          onChange={(event) => update(block.id, { image_url: event.target.value })}
                          className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-2 text-xs focus:border-gray-900 focus:outline-none"
                          placeholder="https://..."
                        />
                      </div>

                      <div>
                        <label className="mb-1 flex items-center justify-between text-xs font-medium text-gray-600">
                          <span>Alto del aviso</span>
                          <span className="font-mono text-gray-500">{block.height} px</span>
                        </label>
                        <input
                          type="range"
                          min={160}
                          max={900}
                          step={20}
                          value={block.height}
                          onChange={(event) => update(block.id, { height: Number(event.target.value) })}
                          className="w-full"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="mb-1 block text-xs font-medium text-gray-600">
                            Texto del botón
                          </label>
                          <input
                            type="text"
                            value={block.button_label}
                            onChange={(event) => update(block.id, { button_label: event.target.value })}
                            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
                            placeholder="Ir a promociones"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium text-gray-600">
                            Enlace del botón
                          </label>
                          <input
                            type="text"
                            value={block.button_href}
                            onChange={(event) => update(block.id, { button_href: event.target.value })}
                            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
                            placeholder="/promociones"
                          />
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-gray-600">
                          Texto alterno (opcional)
                        </label>
                        <input
                          type="text"
                          value={block.title}
                          onChange={(event) => update(block.id, { title: event.target.value })}
                          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
                          placeholder="Se alterna con el texto principal"
                        />
                      </div>
                      <div>
                        <label className="mb-1 flex items-center justify-between text-xs font-medium text-gray-600">
                          <span>Velocidad</span>
                          <span className="font-mono text-gray-500">
                            {block.speed === 0 ? 'quieta' : `${block.speed} s por vuelta`}
                          </span>
                        </label>
                        <input
                          type="range"
                          min={0}
                          max={60}
                          step={2}
                          value={block.speed}
                          onChange={(event) => update(block.id, { speed: Number(event.target.value) })}
                          className="w-full"
                        />
                      </div>
                    </>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600">Fondo</label>
                      <div className="flex gap-2">
                        <input
                          type="color"
                          value={block.bg}
                          onChange={(event) => update(block.id, { bg: event.target.value })}
                          className="h-9 w-10 cursor-pointer rounded border border-gray-200"
                        />
                        <input
                          type="text"
                          value={block.bg}
                          onChange={(event) => update(block.id, { bg: event.target.value })}
                          className="w-full rounded-lg border border-gray-200 px-2 py-1.5 font-mono text-xs focus:border-gray-900 focus:outline-none"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600">Texto</label>
                      <div className="flex gap-2">
                        <input
                          type="color"
                          value={block.fg}
                          onChange={(event) => update(block.id, { fg: event.target.value })}
                          className="h-9 w-10 cursor-pointer rounded border border-gray-200"
                        />
                        <input
                          type="text"
                          value={block.fg}
                          onChange={(event) => update(block.id, { fg: event.target.value })}
                          className="w-full rounded-lg border border-gray-200 px-2 py-1.5 font-mono text-xs focus:border-gray-900 focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={block.active}
                      onChange={(event) => update(block.id, { active: event.target.checked })}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    Visible en el sitio
                  </label>
                </div>
              ) : (
                <div className="flex items-center gap-2 p-3">
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[10px] font-semibold uppercase"
                    style={{ backgroundColor: block.bg, color: block.fg }}
                  >
                    {block.kind === 'aviso' ? 'Aviso' : 'Cinta'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900">
                      {block.kind === 'aviso' ? block.title : block.text}
                      {!block.active ? (
                        <span className="ml-2 text-[10px] uppercase tracking-wider text-gray-400">
                          oculto
                        </span>
                      ) : null}
                    </p>
                    <p className="truncate text-xs text-gray-500">
                      Después de {PLACEMENT_LABELS[block.after]}
                      {block.kind === 'aviso' ? ` · ${block.height} px` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => move(block.id, -1)}
                      disabled={index === 0}
                      className="rounded p-1 text-gray-400 hover:bg-gray-100 disabled:opacity-30"
                      aria-label="Subir"
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => move(block.id, 1)}
                      disabled={index === blocks.length - 1}
                      className="rounded p-1 text-gray-400 hover:bg-gray-100 disabled:opacity-30"
                      aria-label="Bajar"
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(block.id)}
                      className="rounded p-1 text-gray-500 hover:bg-gray-100"
                      aria-label="Editar"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(block.id)}
                      className="rounded p-1 text-red-400 hover:bg-red-50 hover:text-red-600"
                      aria-label="Eliminar"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={() => void handleSave()}
        disabled={upsertConfig.isPending || (!dirty && !ribbonDirty)}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-gray-900 py-3 text-sm font-semibold uppercase tracking-wider text-white transition-colors hover:bg-gray-800 disabled:opacity-50"
      >
        {upsertConfig.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Save className="h-4 w-4" />
        )}
        Guardar avisos
      </button>
      {dirty || ribbonDirty ? (
        <p className="text-center text-[11px] text-amber-600">Hay cambios sin guardar</p>
      ) : null}
    </div>
  );
}
