import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  BedDouble,
  Building2,
  ChevronDown,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Loader2,
  Pencil,
  Save,
  Upload,
  X,
} from 'lucide-react';
import { uploadMedia } from '../../api/client';
import {
  useHotelConfig,
  useRoomTypes,
  useRoomUnits,
  useUpdateRoomType,
  useUpdateRoomUnit,
  useUpsertHotelConfig,
} from '../../hooks/useQueries';
import type { RoomGroup, RoomTypeInventory, RoomUnit } from '../../types';
import toast from 'react-hot-toast';

interface RoomInventoryEditorProps {
  hotelId: string;
}

const GROUPS: Array<{ id: RoomGroup; label: string; Icon: typeof BedDouble }> = [
  { id: 'habitacion', label: 'Habitaciones', Icon: BedDouble },
  { id: 'departamento', label: 'Departamentos', Icon: Building2 },
];

function unitNumber(name: string) {
  return name
    .replace(/^dep\.?\s*/i, '')
    .replace(/^n[.º°]?\s*/i, '')
    .replace(/^\./, '')
    .trim();
}

function ActiveToggle({
  active,
  onToggle,
  label,
}: {
  active: boolean;
  onToggle: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      title={active ? `Ocultar ${label}` : `Mostrar ${label}`}
      aria-pressed={active}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border transition-colors ${
        active
          ? 'border-gray-900 bg-gray-900 text-white'
          : 'border-gray-200 bg-white text-gray-400 hover:border-gray-300'
      }`}
    >
      {active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
    </button>
  );
}

interface UnitRowProps {
  unit: RoomUnit;
  singular: string;
  onSave: (id: string, data: Partial<RoomUnit>) => Promise<void>;
}

function UnitRow({ unit, singular, onSave }: UnitRowProps) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState({
    name: unit.name,
    floor: unit.floor || '',
    capacity: unit.capacity ? String(unit.capacity) : '',
    amenities: unit.amenities.join(', '),
  });

  const startEdit = () => {
    setDraft({
      name: unit.name,
      floor: unit.floor || '',
      capacity: unit.capacity ? String(unit.capacity) : '',
      amenities: unit.amenities.join(', '),
    });
    setEditing(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(unit.id, {
        name: draft.name.trim() || unit.name,
        floor: draft.floor.trim() || null,
        capacity: parseInt(draft.capacity, 10) || null,
        amenities: draft.amenities
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
      });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-3">
      {editing ? (
        <div className="space-y-2">
          <div className="grid grid-cols-3 gap-2">
            <input
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="Número"
              className="px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
            />
            <input
              value={draft.floor}
              onChange={(e) => setDraft({ ...draft, floor: e.target.value })}
              placeholder="Piso"
              className="px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
            />
            <input
              type="number"
              value={draft.capacity}
              onChange={(e) => setDraft({ ...draft, capacity: e.target.value })}
              placeholder="Capacidad"
              className="px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
            />
          </div>
          <input
            value={draft.amenities}
            onChange={(e) => setDraft({ ...draft, amenities: e.target.value })}
            placeholder="Características separadas por coma"
            className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800 disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Guardar unidad
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-200"
            >
              <X className="h-3.5 w-3.5" />
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-gray-900">
              {singular} {unitNumber(unit.name)}
              {unit.floor ? <span className="ml-2 text-xs font-normal text-gray-400">{unit.floor}</span> : null}
            </p>
            <p className="text-xs text-gray-500">
              {unit.capacity || 1} {unit.capacity === 1 ? 'persona' : 'personas'}
              {unit.amenities.length > 0 ? ` · ${unit.amenities.join(' · ')}` : ''}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <ActiveToggle
              active={unit.active}
              label={`la unidad ${unit.name}`}
              onToggle={() => onSave(unit.id, { active: !unit.active })}
            />
            <button
              type="button"
              onClick={startEdit}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:border-gray-300"
              title="Editar unidad"
            >
              <Pencil className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function RoomInventoryEditor({ hotelId }: RoomInventoryEditorProps) {
  const { data: typesData = [], isLoading: typesLoading } = useRoomTypes(hotelId, true);
  const { data: unitsData = [], isLoading: unitsLoading } = useRoomUnits(hotelId, true);
  const { data: configsData = [] } = useHotelConfig(hotelId);
  const updateType = useUpdateRoomType();
  const updateUnit = useUpdateRoomUnit();
  const upsertConfig = useUpsertHotelConfig();

  const types = (Array.isArray(typesData) ? typesData : []) as RoomTypeInventory[];
  const units = (Array.isArray(unitsData) ? unitsData : []) as RoomUnit[];
  const configs = (Array.isArray(configsData) ? configsData : []) as Array<{ key: string; value: string }>;
  const showNumbers = (configs.find((config) => config.key === 'gallery_unit_numbers')?.value || 'show') !== 'hide';

  const [openTypeId, setOpenTypeId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Record<string, string>>>({});
  const [savingTypeId, setSavingTypeId] = useState<string | null>(null);
  const [uploadingTypeId, setUploadingTypeId] = useState<string | null>(null);

  const unitsByType = useMemo(() => {
    const map = new Map<string, RoomUnit[]>();
    units.forEach((unit) => {
      if (!map.has(unit.tipo_id)) map.set(unit.tipo_id, []);
      map.get(unit.tipo_id)!.push(unit);
    });
    return map;
  }, [units]);

  const getDraft = (type: RoomTypeInventory) =>
    drafts[type.id] || {
      name: type.name,
      grupo: type.grupo,
      price: type.price !== null ? String(type.price) : '',
      description: type.description || '',
      image_url: type.image_url || '',
    };

  const setDraft = (id: string, patch: Record<string, string>) => {
    setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  };

  const toggleNumbers = async () => {
    if (!hotelId) return;
    try {
      await upsertConfig.mutateAsync({
        hotelId,
        key: 'gallery_unit_numbers',
        value: showNumbers ? 'hide' : 'show',
        group: 'gallery',
      });
    } catch {
      toast.error('No se pudo guardar la preferencia');
    }
  };

  const handleTypeToggle = async (type: RoomTypeInventory) => {
    try {
      await updateType.mutateAsync({ id: type.id, data: { active: !type.active } });
    } catch {
      toast.error('No se pudo actualizar el tipo');
    }
  };

  const handleSaveType = async (type: RoomTypeInventory) => {
    const draft = getDraft(type);
    setSavingTypeId(type.id);
    try {
      await updateType.mutateAsync({
        id: type.id,
        data: {
          name: draft.name.trim() || type.name,
          grupo: (draft.grupo as RoomGroup) || type.grupo,
          price: draft.price === '' ? null : Number(draft.price),
          description: draft.description.trim() || null,
          image_url: draft.image_url.trim() || null,
        },
      });
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[type.id];
        return next;
      });
      toast.success('Tipo actualizado');
    } catch {
      toast.error('No se pudo guardar el tipo');
    } finally {
      setSavingTypeId(null);
    }
  };

  const handleUpload = async (type: RoomTypeInventory, file: File | undefined) => {
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) {
      toast.error('La imagen supera los 50 MB');
      return;
    }
    setUploadingTypeId(type.id);
    const { media, error } = await uploadMedia(file, 'rooms/tipos');
    if (error || !media) {
      toast.error(error || 'No se pudo subir la imagen');
    } else {
      setDraft(type.id, { image_url: media.url });
      toast.success('Imagen subida. Guardá el tipo para aplicarla.');
    }
    setUploadingTypeId(null);
  };

  const handleSaveUnit = async (id: string, data: Partial<RoomUnit>) => {
    try {
      await updateUnit.mutateAsync({ id, data });
    } catch {
      toast.error('No se pudo guardar la unidad');
      throw new Error('No se pudo guardar la unidad');
    }
  };

  if (typesLoading || unitsLoading) {
    return (
      <div className="flex items-center justify-center py-10 text-sm text-gray-500">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Cargando inventario...
      </div>
    );
  }

  if (types.length === 0) {
    return <p className="py-8 text-center text-sm text-gray-500">No hay tipos de habitación registrados.</p>;
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4">
        <div>
          <p className="text-sm font-medium text-gray-900">Mostrar números de habitación</p>
          <p className="mt-1 text-xs leading-relaxed text-gray-500">
            Si lo desactivás, la galería muestra cada unidad como “Habitación” o “Departamento”, sin número.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={showNumbers}
          onClick={toggleNumbers}
          disabled={upsertConfig.isPending}
          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
            showNumbers ? 'bg-gray-900' : 'bg-gray-300'
          }`}
          title={showNumbers ? 'Ocultar números' : 'Mostrar números'}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              showNumbers ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {GROUPS.map((group) => {
        const groupTypes = types.filter((type) => type.grupo === group.id);
        return (
          <div key={group.id} className="space-y-2">
            <div className="flex items-center gap-2 px-1">
              <group.Icon className="h-4 w-4 text-gray-400" />
              <p className="text-xs font-medium uppercase tracking-wider text-gray-500">{group.label}</p>
              <span className="text-[10px] text-gray-400">{groupTypes.length}</span>
            </div>

            {groupTypes.length === 0 ? (
              <p className="rounded-xl border border-dashed border-gray-200 px-3 py-4 text-xs text-gray-400">
                Sin tipos en este grupo.
              </p>
            ) : (
              groupTypes.map((type) => {
                const typeUnits = unitsByType.get(type.id) || [];
                const draft = getDraft(type);
                const isOpen = openTypeId === type.id;
                return (
                  <div key={type.id} className="overflow-hidden rounded-xl border border-gray-200">
                    <div className="flex items-center gap-3 p-3">
                      <div className="h-12 w-14 shrink-0 overflow-hidden rounded-lg bg-gray-100">
                        {type.image_url ? (
                          <img src={type.image_url} alt={type.name} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-gray-300">
                            <ImageIcon className="h-4 w-4" />
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => setOpenTypeId(isOpen ? null : type.id)}
                        className="min-w-0 flex-1 text-left"
                        aria-expanded={isOpen}
                      >
                        <p className={`truncate text-sm font-medium ${type.active ? 'text-gray-900' : 'text-gray-400 line-through'}`}>
                          {type.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {typeUnits.length} {group.id === 'habitacion' ? 'habitaciones' : 'departamentos'}
                          {type.price ? ` · Bs. ${Number(type.price).toLocaleString('es-BO')}` : ''}
                          {type.active ? '' : ' · Oculto'}
                        </p>
                      </button>
                      <ActiveToggle active={type.active} label={type.name} onToggle={() => handleTypeToggle(type)} />
                      <button
                        type="button"
                        onClick={() => setOpenTypeId(isOpen ? null : type.id)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:border-gray-300"
                        title={isOpen ? 'Cerrar' : 'Editar y ver unidades'}
                      >
                        <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                      </button>
                    </div>

                    <AnimatePresence initial={false}>
                      {isOpen ? (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.25, ease: 'easeInOut' }}
                          className="overflow-hidden border-t border-gray-100"
                        >
                          <div className="space-y-4 bg-gray-50/60 p-3">
                            <div className="space-y-2">
                              <input
                                value={draft.name}
                                onChange={(e) => setDraft(type.id, { name: e.target.value })}
                                placeholder="Nombre del tipo"
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-gray-900/10 bg-white"
                              />
                              <div className="grid grid-cols-2 gap-2">
                                <select
                                  value={draft.grupo}
                                  onChange={(e) => setDraft(type.id, { grupo: e.target.value })}
                                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                                >
                                  <option value="habitacion">Habitaciones</option>
                                  <option value="departamento">Departamentos</option>
                                </select>
                                <input
                                  type="number"
                                  value={draft.price}
                                  onChange={(e) => setDraft(type.id, { price: e.target.value })}
                                  placeholder="Precio Bs."
                                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                                />
                              </div>
                              <textarea
                                rows={2}
                                value={draft.description}
                                onChange={(e) => setDraft(type.id, { description: e.target.value })}
                                placeholder="Descripción (opcional)"
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900/10 resize-none"
                              />
                              <div className="space-y-2 rounded-lg border border-gray-200 bg-white p-2">
                                <div className="flex items-center gap-2">
                                  <div className="h-12 w-16 shrink-0 overflow-hidden rounded bg-gray-100">
                                    {draft.image_url ? (
                                      <img src={draft.image_url} alt="Vista previa" className="h-full w-full object-cover" />
                                    ) : (
                                      <div className="flex h-full w-full items-center justify-center text-gray-300">
                                        <ImageIcon className="h-4 w-4" />
                                      </div>
                                    )}
                                  </div>
                                  <input
                                    value={draft.image_url}
                                    onChange={(e) => setDraft(type.id, { image_url: e.target.value })}
                                    placeholder="Imagen URL"
                                    className="min-w-0 flex-1 px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                                  />
                                  <label className="inline-flex cursor-pointer items-center gap-1 rounded-lg bg-gray-100 px-2 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-200">
                                    {uploadingTypeId === type.id ? (
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                      <Upload className="h-3.5 w-3.5" />
                                    )}
                                    Subir
                                    <input
                                      type="file"
                                      accept="image/*"
                                      className="hidden"
                                      onChange={(e) => handleUpload(type, e.target.files?.[0])}
                                    />
                                  </label>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleSaveType(type)}
                                disabled={savingTypeId === type.id}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
                              >
                                {savingTypeId === type.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Save className="h-4 w-4" />
                                )}
                                Guardar tipo
                              </button>
                            </div>

                            <div>
                              <div className="mb-2 flex items-center justify-between px-1">
                                <p className="text-[10px] font-medium uppercase tracking-wider text-gray-500">
                                  Unidades
                                </p>
                                <span className="text-[10px] text-gray-400">{typeUnits.length}</span>
                              </div>
                              <div className="space-y-1.5">
                                {typeUnits.map((unit) => (
                                  <UnitRow
                                    key={unit.id}
                                    unit={unit}
                                    singular={group.id === 'habitacion' ? 'Habitación' : 'Departamento'}
                                    onSave={handleSaveUnit}
                                  />
                                ))}
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      ) : null}
                    </AnimatePresence>
                  </div>
                );
              })
            )}
          </div>
        );
      })}
    </div>
  );
}
