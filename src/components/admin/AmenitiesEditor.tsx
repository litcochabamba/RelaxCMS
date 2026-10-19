import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  Eye,
  EyeOff,
  GripVertical,
  Loader2,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';
import { AMENITY_ICON_OPTIONS, getAmenityIcon } from '../../utils/amenityIcons';
import {
  parseAmenityGroups,
  serializeAmenityGroups,
  type AmenityGroupConfig,
} from '../home/AmenitiesSection';
import {
  useCreateAmenity,
  useDeleteAmenity,
  useUpdateAmenity,
  useUpsertHotelConfig,
} from '../../hooks/useQueries';
import type { Amenity } from '../../types';
import ConfirmDialog from '../common/ConfirmDialog';
import toast from 'react-hot-toast';

interface AmenityDraft {
  key: string;
  id?: string;
  name: string;
  description: string;
  icon: string;
  active: boolean;
}

interface GroupDraft {
  key: string;
  category: string;
  visible: boolean;
  items: AmenityDraft[];
}

export interface AmenitiesEditorHandle {
  save: () => Promise<void>;
}

interface AmenitiesEditorProps {
  hotelId: string;
  /** Todas las amenidades del hotel, incluidas las inactivas. */
  amenities: Amenity[];
  /** Valor crudo de `configuracion_hotel.amenities_groups`. */
  groupsConfig?: string;
  isLoading?: boolean;
}

let newItemCounter = 0;
function newKey(prefix: string) {
  newItemCounter += 1;
  return `${prefix}-${Date.now()}-${newItemCounter}`;
}

function buildDrafts(amenities: Amenity[], groupsConfig?: string): GroupDraft[] {
  const configured = parseAmenityGroups(groupsConfig) || [];
  const categories: string[] = [];
  amenities.forEach((amenity) => {
    if (amenity.category && !categories.includes(amenity.category)) categories.push(amenity.category);
  });

  const ordered = [
    ...configured.map((group) => group.category).filter((category) => categories.includes(category)),
    ...categories.filter((category) => !configured.some((group) => group.category === category)),
  ];

  return ordered.map((category) => {
    const config = configured.find((group) => group.category === category);
    return {
      key: category,
      category,
      visible: config ? config.visible : true,
      items: amenities
        .filter((amenity) => amenity.category === category)
        .map((amenity) => ({
          key: amenity.id,
          id: amenity.id,
          name: amenity.name,
          description: amenity.description || '',
          icon: amenity.icon || 'CircleDot',
          active: amenity.active,
        })),
    };
  });
}

const AmenitiesEditor = forwardRef<AmenitiesEditorHandle, AmenitiesEditorProps>(
  ({ hotelId, amenities, groupsConfig, isLoading }, ref) => {
    const [groups, setGroups] = useState<GroupDraft[]>(() => buildDrafts(amenities, groupsConfig));
    const [expanded, setExpanded] = useState<Record<string, boolean>>({});
    const [editingItem, setEditingItem] = useState<string | null>(null);
    const [newGroup, setNewGroup] = useState('');
    const [groupToDelete, setGroupToDelete] = useState<GroupDraft | null>(null);

    const createAmenity = useCreateAmenity();
    const updateAmenity = useUpdateAmenity();
    const deleteAmenity = useDeleteAmenity();
    const upsertConfig = useUpsertHotelConfig();

    const saving =
      createAmenity.isPending || updateAmenity.isPending || deleteAmenity.isPending || upsertConfig.isPending;

    // La configuración y las filas llegan de la base: se rearma el borrador
    // solo cuando los datos cambian de verdad, para no perder ediciones en
    // curso cuando React Query vuelve a consultar (p. ej. al enfocar la ventana).
    const dataSignature = useMemo(
      () =>
        `${amenities
          .map(
            (amenity) =>
              `${amenity.id}:${amenity.category}:${amenity.name}:${amenity.icon}:${amenity.active}:${amenity.order}:${amenity.description ?? ''}`
          )
          .join('|')}::${groupsConfig ?? ''}`,
      [amenities, groupsConfig]
    );
    const lastSignature = useRef<string | null>(null);

    useEffect(() => {
      if (lastSignature.current === dataSignature) return;
      lastSignature.current = dataSignature;
      setGroups(buildDrafts(amenities, groupsConfig));
      setEditingItem(null);
    }, [amenities, groupsConfig, dataSignature]);

    const totalItems = useMemo(() => groups.reduce((sum, group) => sum + group.items.length, 0), [groups]);

    const patchGroup = (key: string, patch: Partial<GroupDraft>) => {
      setGroups((prev) => prev.map((group) => (group.key === key ? { ...group, ...patch } : group)));
    };

    const moveGroup = (key: string, direction: -1 | 1) => {
      setGroups((prev) => {
        const index = prev.findIndex((group) => group.key === key);
        const target = index + direction;
        if (index < 0 || target < 0 || target >= prev.length) return prev;
        const next = [...prev];
        [next[index], next[target]] = [next[target], next[index]];
        return next;
      });
    };

    const removeGroup = (group: GroupDraft) => {
      if (group.items.length > 0) {
        setGroupToDelete(group);
        return;
      }
      setGroups((prev) => prev.filter((item) => item.key !== group.key));
    };

    const confirmRemoveGroup = () => {
      if (!groupToDelete) return;
      setGroups((prev) => prev.filter((item) => item.key !== groupToDelete.key));
      setGroupToDelete(null);
    };

    const addGroup = () => {
      const category = newGroup.trim();
      if (!category) return;
      if (groups.some((group) => group.category.toLowerCase() === category.toLowerCase())) {
        toast.error('Ya existe un grupo con ese nombre');
        return;
      }
      const key = newKey('grupo');
      setGroups((prev) => [...prev, { key, category, visible: true, items: [] }]);
      setExpanded((prev) => ({ ...prev, [key]: true }));
      setNewGroup('');
    };

    const patchItem = (groupKey: string, itemKey: string, patch: Partial<AmenityDraft>) => {
      setGroups((prev) =>
        prev.map((group) =>
          group.key === groupKey
            ? {
                ...group,
                items: group.items.map((item) => (item.key === itemKey ? { ...item, ...patch } : item)),
              }
            : group
        )
      );
    };

    const addItem = (groupKey: string) => {
      const key = newKey('item');
      setGroups((prev) =>
        prev.map((group) =>
          group.key === groupKey
            ? {
                ...group,
                items: [
                  ...group.items,
                  { key, name: '', description: '', icon: 'CircleDot', active: true },
                ],
              }
            : group
        )
      );
      setEditingItem(key);
      setExpanded((prev) => ({ ...prev, [groupKey]: true }));
    };

    const removeItem = (groupKey: string, itemKey: string) => {
      setGroups((prev) =>
        prev.map((group) =>
          group.key === groupKey
            ? { ...group, items: group.items.filter((item) => item.key !== itemKey) }
            : group
        )
      );
      if (editingItem === itemKey) setEditingItem(null);
    };

    const moveItem = (groupKey: string, itemKey: string, direction: -1 | 1) => {
      setGroups((prev) =>
        prev.map((group) => {
          if (group.key !== groupKey) return group;
          const index = group.items.findIndex((item) => item.key === itemKey);
          const target = index + direction;
          if (index < 0 || target < 0 || target >= group.items.length) return group;
          const items = [...group.items];
          [items[index], items[target]] = [items[target], items[index]];
          return { ...group, items };
        })
      );
    };

    useImperativeHandle(ref, () => ({
      save: async () => {
        if (!hotelId) return;

        const cleaned = groups
          .map((group) => ({ ...group, category: group.category.trim() }))
          .filter((group) => group.category !== '');

        const seen = new Set<string>();
        for (const group of cleaned) {
          const normalized = group.category.toLowerCase();
          if (seen.has(normalized)) throw new Error(`El grupo "${group.category}" está repetido`);
          seen.add(normalized);
          for (const item of group.items) {
            if (!item.name.trim()) throw new Error(`Hay un ítem sin nombre en "${group.category}"`);
          }
        }

        const previous = new Map(amenities.map((amenity) => [amenity.id, amenity]));
        const kept: string[] = [];

        // El orden es global (no por grupo) para que la consulta que ordena
        // por `order` mantenga el orden elegido dentro de cada grupo.
        let position = 0;

        for (const group of cleaned) {
          for (const item of group.items) {
            const payload = {
              hotel_id: hotelId,
              category: group.category,
              name: item.name.trim(),
              description: item.description.trim() || null,
              icon: item.icon || 'CircleDot',
              active: item.active,
              order: position,
            };
            position += 1;

            if (item.id) {
              kept.push(item.id);
              const before = previous.get(item.id);
              const changed =
                !before ||
                before.category !== payload.category ||
                before.name !== payload.name ||
                (before.description || '') !== (payload.description || '') ||
                (before.icon || '') !== payload.icon ||
                before.active !== payload.active ||
                before.order !== payload.order;
              if (changed) await updateAmenity.mutateAsync({ id: item.id, data: payload });
            } else {
              await createAmenity.mutateAsync(payload);
            }
          }
        }

        for (const amenity of amenities) {
          if (!kept.includes(amenity.id)) await deleteAmenity.mutateAsync(amenity.id);
        }

        const groupConfig: AmenityGroupConfig[] = cleaned.map((group) => ({
          category: group.category,
          visible: group.visible,
        }));
        await upsertConfig.mutateAsync({
          hotelId,
          key: 'amenities_groups',
          value: serializeAmenityGroups(groupConfig),
          group: 'sections',
        });
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
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Grupos</p>
            <p className="mt-1 text-xs text-gray-400">
              {groups.length} grupo(s) · {totalItems} ítem(s). Ocultá un grupo con el ojo; el orden de la
              lista es el orden en la portada.
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={newGroup}
            onChange={(event) => setNewGroup(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                addGroup();
              }
            }}
            placeholder="Nuevo grupo (ej. Servicios)"
            className="min-w-0 flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
          />
          <button
            type="button"
            onClick={addGroup}
            disabled={!newGroup.trim()}
            className="flex items-center gap-1.5 rounded-lg bg-gray-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:opacity-40"
          >
            <Plus className="h-4 w-4" />
            Agregar
          </button>
        </div>

        {groups.length === 0 ? (
          <p className="rounded-xl border border-dashed border-gray-200 py-6 text-center text-sm text-gray-500">
            No hay grupos todavía. Creá uno para empezar.
          </p>
        ) : null}

        {groups.map((group, groupIndex) => {
          const isOpen = expanded[group.key] ?? false;
          return (
            <div
              key={group.key}
              className={`overflow-hidden rounded-xl border bg-white ${
                group.visible ? 'border-gray-200' : 'border-dashed border-gray-300 bg-gray-50/60'
              }`}
            >
              <div className="flex items-center gap-1 border-b border-gray-100 px-2 py-2">
                <button
                  type="button"
                  onClick={() => patchGroup(group.key, { visible: !group.visible })}
                  title={group.visible ? 'Ocultar en la portada' : 'Mostrar en la portada'}
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors ${
                    group.visible
                      ? 'bg-gray-900 text-white hover:bg-gray-700'
                      : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                  }`}
                >
                  {group.visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                </button>

                <input
                  type="text"
                  value={group.category}
                  onChange={(event) => patchGroup(group.key, { category: event.target.value })}
                  className="min-w-0 flex-1 rounded-md border border-transparent px-1.5 py-1 text-sm font-medium text-gray-900 hover:border-gray-200 focus:border-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                />

                <span className="shrink-0 text-[10px] text-gray-400">{group.items.length}</span>
                <button
                  type="button"
                  onClick={() => moveGroup(group.key, -1)}
                  disabled={groupIndex === 0}
                  title="Subir grupo"
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30"
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => moveGroup(group.key, 1)}
                  disabled={groupIndex === groups.length - 1}
                  title="Bajar grupo"
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30"
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setExpanded((prev) => ({ ...prev, [group.key]: !isOpen }))}
                  title={isOpen ? 'Contraer' : 'Expandir'}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
                >
                  <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>
                <button
                  type="button"
                  onClick={() => removeGroup(group)}
                  title="Eliminar grupo"
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-red-400 transition-colors hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>

              {!group.visible ? (
                <p className="px-3 pt-2 text-[10px] uppercase tracking-wider text-gray-400">
                  Oculto en la portada
                </p>
              ) : null}

              {isOpen ? (
                <div className="space-y-2 p-3">
                  {group.items.length === 0 ? (
                    <p className="py-2 text-center text-xs text-gray-400">Este grupo no tiene ítems.</p>
                  ) : null}

                  {group.items.map((item, itemIndex) => {
                    const Icon = getAmenityIcon(item.icon);
                    const isEditing = editingItem === item.key;

                    if (isEditing) {
                      return (
                        <div key={item.key} className="space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
                          <div className="flex items-start gap-2">
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-900 text-white">
                              <Icon className="h-4 w-4" />
                            </span>
                            <input
                              type="text"
                              value={item.name}
                              onChange={(event) => patchItem(group.key, item.key, { name: event.target.value })}
                              placeholder="Nombre (ej. Wi-Fi)"
                              className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                            />
                          </div>
                          <textarea
                            rows={2}
                            value={item.description}
                            onChange={(event) =>
                              patchItem(group.key, item.key, { description: event.target.value })
                            }
                            placeholder="Descripción breve"
                            className="w-full resize-none rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                          />

                          <div>
                            <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-gray-500">
                              Icono
                            </p>
                            <div className="grid max-h-32 grid-cols-8 gap-1 overflow-y-auto rounded-lg border border-gray-200 bg-white p-1.5">
                              {AMENITY_ICON_OPTIONS.map((iconName) => {
                                const OptionIcon = getAmenityIcon(iconName);
                                const selected = item.icon === iconName;
                                return (
                                  <button
                                    key={iconName}
                                    type="button"
                                    title={iconName}
                                    onClick={() => patchItem(group.key, item.key, { icon: iconName })}
                                    className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
                                      selected
                                        ? 'bg-gray-900 text-white'
                                        : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
                                    }`}
                                  >
                                    <OptionIcon className="h-3.5 w-3.5" />
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          <div className="flex items-center justify-between gap-2">
                            <label className="flex items-center gap-2 text-xs text-gray-600">
                              <input
                                type="checkbox"
                                checked={item.active}
                                onChange={(event) =>
                                  patchItem(group.key, item.key, { active: event.target.checked })
                                }
                                className="h-3.5 w-3.5 rounded border-gray-300"
                              />
                              Visible en la portada
                            </label>
                            <div className="flex gap-1">
                              <button
                                type="button"
                                onClick={() => moveItem(group.key, item.key, -1)}
                                disabled={itemIndex === 0}
                                title="Subir ítem"
                                className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-gray-400 hover:text-gray-700 disabled:opacity-30"
                              >
                                <ArrowUp className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => moveItem(group.key, item.key, 1)}
                                disabled={itemIndex === group.items.length - 1}
                                title="Bajar ítem"
                                className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-gray-400 hover:text-gray-700 disabled:opacity-30"
                              >
                                <ArrowDown className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingItem(null)}
                                className="flex items-center gap-1 rounded-lg bg-gray-900 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-gray-800"
                              >
                                <Check className="h-3.5 w-3.5" />
                                Listo
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={item.key}
                        className="flex items-center gap-2 rounded-lg border border-gray-100 px-2 py-1.5"
                      >
                        <GripVertical className="hidden h-3.5 w-3.5 shrink-0 text-gray-300 sm:block" />
                        <span
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                            item.active ? 'bg-gray-100 text-gray-700' : 'bg-gray-50 text-gray-300'
                          }`}
                        >
                          <Icon className="h-4 w-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className={`truncate text-sm ${item.active ? 'text-gray-800' : 'text-gray-400'}`}>
                            {item.name || 'Sin nombre'}
                          </p>
                          {item.description ? (
                            <p className="truncate text-[11px] text-gray-400">{item.description}</p>
                          ) : null}
                        </div>
                        {!item.active ? (
                          <span className="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500">
                            Oculto
                          </span>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => setEditingItem(item.key)}
                          title="Editar ítem"
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gray-50 text-gray-500 hover:bg-gray-100"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeItem(group.key, item.key)}
                          title="Eliminar ítem"
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gray-50 text-red-400 hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    );
                  })}

                  <button
                    type="button"
                    onClick={() => addItem(group.key)}
                    className="flex w-full items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-gray-200 py-2 text-xs font-medium text-gray-500 transition-colors hover:border-gray-900 hover:text-gray-900"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Agregar ítem
                  </button>
                </div>
              ) : null}
            </div>
          );
        })}

        {saving ? (
          <p className="flex items-center justify-center gap-2 text-xs text-gray-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Guardando amenidades...
          </p>
        ) : (
          <p className="text-center text-[11px] text-gray-400">
            Los cambios de grupos e ítems se aplican con Guardar cambios.
          </p>
        )}

        <ConfirmDialog
          open={Boolean(groupToDelete)}
          title="Eliminar grupo"
          description={`¿Eliminar el grupo “${groupToDelete?.category || ''}” y sus ${groupToDelete?.items.length || 0} ítem(s)? Esta acción se aplica al guardar.`}
          confirmLabel="Eliminar grupo"
          onConfirm={confirmRemoveGroup}
          onCancel={() => setGroupToDelete(null)}
        />
      </div>
    );
  }
);

AmenitiesEditor.displayName = 'AmenitiesEditor';

export default AmenitiesEditor;
