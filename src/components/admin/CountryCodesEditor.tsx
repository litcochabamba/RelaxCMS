import { useEffect, useRef, useState } from 'react';
import { Globe2, Loader2, Plus, Save, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useHotelConfig, useHotels, useUpsertHotelConfig } from '../../hooks/useQueries';
import { useCountryCodes } from '../../hooks/useCountryCodes';
import type { CountryDialCode, Hotel, HotelConfig } from '../../types';

const CONFIG_KEY = 'country_dial_codes';

interface DraftRow extends CountryDialCode {
  key: string;
}

let rowCounter = 0;
function newKey() {
  rowCounter += 1;
  return `row-${Date.now()}-${rowCounter}`;
}

function toDrafts(codes: CountryDialCode[]): DraftRow[] {
  return codes.map((code) => ({ ...code, key: newKey() }));
}

/**
 * Códigos de área que ofrece el registro. Se guardan como JSON en
 * `configuracion_hotel` (clave `country_dial_codes`), así que este editor es la
 * única fuente de verdad: agregar un país acá lo habilita en el formulario.
 */
export default function CountryCodesEditor() {
  const { data: hotels } = useHotels();
  const hotel = (Array.isArray(hotels) ? hotels[0] : undefined) as Hotel | undefined;
  const hotelId = hotel?.id || '';

  const { data: configs = [], isLoading } = useHotelConfig(hotelId);
  const { data: fallback = [] } = useCountryCodes();
  const upsertConfig = useUpsertHotelConfig();

  const [rows, setRows] = useState<DraftRow[]>([]);
  const [initialized, setInitialized] = useState(false);
  const seeded = useRef(false);

  useEffect(() => {
    if (!hotelId || isLoading || seeded.current) return;
    const list = (Array.isArray(configs) ? configs : []) as HotelConfig[];
    const stored = list.find((config) => config.key === CONFIG_KEY)?.value;

    let parsed: CountryDialCode[] = [];
    if (stored) {
      try {
        const value = JSON.parse(stored);
        if (Array.isArray(value)) {
          parsed = value
            .filter((item): item is CountryDialCode => Boolean(item && typeof item === 'object'))
            .map((item) => ({
              iso: String(item.iso || '').toUpperCase(),
              name: String(item.name || ''),
              dial: String(item.dial || ''),
              flag: String(item.flag || ''),
              active: item.active !== false,
            }))
            .filter((item) => item.iso && item.name && item.dial);
        }
      } catch {
        parsed = [];
      }
    }

    if (parsed.length === 0) parsed = fallback;
    // La lista configurada manda; si todavía no existe se parte de la sugerida.
    if (parsed.length > 0) {
      setRows(toDrafts([...parsed].sort((a, b) => a.name.localeCompare(b.name, 'es'))));
      setInitialized(true);
      seeded.current = true;
    }
  }, [hotelId, isLoading, configs, fallback]);

  const updateRow = (key: string, changes: Partial<CountryDialCode>) => {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...changes } : row)));
  };

  const addRow = () => {
    setRows((current) => [
      ...current,
      { key: newKey(), iso: '', name: '', dial: '+', flag: '', active: true },
    ]);
    setInitialized(true);
  };

  const removeRow = (key: string) => {
    setRows((current) => current.filter((row) => row.key !== key));
  };

  const handleSave = async () => {
    if (!hotelId) return;

    const cleaned: CountryDialCode[] = [];
    for (const row of rows) {
      const iso = row.iso.trim().toUpperCase();
      const name = row.name.trim();
      const dialDigits = row.dial.replace(/\D/g, '');
      if (!iso && !name && !dialDigits) continue; // fila vacía
      if (!/^[A-Z]{2}$/.test(iso)) {
        toast.error(`Código ISO inválido en "${name || 'fila sin nombre'}". Usá dos letras, por ejemplo BO.`);
        return;
      }
      if (!name) {
        toast.error('Cada código de área necesita un nombre de país.');
        return;
      }
      if (!dialDigits) {
        toast.error(`Falta el código de área de ${name}.`);
        return;
      }
      if (cleaned.some((code) => code.iso === iso)) {
        toast.error(`El país ${iso} está repetido.`);
        return;
      }
      cleaned.push({
        iso,
        name,
        dial: `+${dialDigits}`,
        flag: row.flag.trim(),
        active: row.active,
      });
    }

    try {
      await upsertConfig.mutateAsync({
        hotelId,
        key: CONFIG_KEY,
        value: JSON.stringify(
          cleaned.sort((a, b) => a.name.localeCompare(b.name, 'es')),
          null,
          2
        ),
        group: 'registro',
      });
      toast.success('Códigos de área actualizados');
    } catch {
      toast.error('No se pudieron guardar los códigos de área');
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-1">
        <h3 className="text-lg font-serif text-gray-900 flex items-center gap-2">
          <Globe2 className="w-5 h-5 text-gray-600" />
          Códigos de área
        </h3>
        <button
          type="button"
          onClick={addRow}
          className="inline-flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <Plus className="w-4 h-4" /> Agregar código
        </button>
      </div>
      <p className="text-sm text-gray-500 mb-4">
        Países disponibles en el registro de clientes. El país del cliente se deduce del código que elija.
      </p>

      {isLoading ? (
        <div className="flex items-center gap-2 py-4 text-sm text-gray-500">
          <Loader2 className="w-4 h-4 animate-spin" /> Cargando códigos...
        </div>
      ) : rows.length === 0 ? (
        <p className="py-4 text-sm text-gray-500">
          Todavía no hay códigos cargados. Agregá el primero para habilitar el registro.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-gray-400">
                <th className="py-2 pr-2 font-medium">Bandera</th>
                <th className="py-2 pr-2 font-medium">País</th>
                <th className="py-2 pr-2 font-medium">ISO</th>
                <th className="py-2 pr-2 font-medium">Código</th>
                <th className="py-2 pr-2 font-medium">Activo</th>
                <th className="py-2 font-medium sr-only">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map((row) => (
                <tr key={row.key}>
                  <td className="py-1.5 pr-2">
                    <input
                      value={row.flag}
                      onChange={(event) => updateRow(row.key, { flag: event.target.value })}
                      className="w-14 px-2 py-1.5 border border-gray-200 rounded-md text-center"
                      placeholder="🌐"
                      maxLength={4}
                      aria-label="Bandera"
                    />
                  </td>
                  <td className="py-1.5 pr-2">
                    <input
                      value={row.name}
                      onChange={(event) => updateRow(row.key, { name: event.target.value })}
                      className="w-full min-w-[140px] px-2 py-1.5 border border-gray-200 rounded-md"
                      placeholder="Bolivia"
                      aria-label="País"
                    />
                  </td>
                  <td className="py-1.5 pr-2">
                    <input
                      value={row.iso}
                      onChange={(event) =>
                        updateRow(row.key, {
                          iso: event.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2),
                        })
                      }
                      className="w-16 px-2 py-1.5 border border-gray-200 rounded-md uppercase"
                      placeholder="BO"
                      aria-label="Código ISO"
                    />
                  </td>
                  <td className="py-1.5 pr-2">
                    <input
                      value={row.dial}
                      onChange={(event) => updateRow(row.key, { dial: event.target.value })}
                      className="w-24 px-2 py-1.5 border border-gray-200 rounded-md tabular-nums"
                      placeholder="+591"
                      aria-label="Código de área"
                    />
                  </td>
                  <td className="py-1.5 pr-2">
                    <input
                      type="checkbox"
                      checked={row.active}
                      onChange={(event) => updateRow(row.key, { active: event.target.checked })}
                      className="w-4 h-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900/20"
                      aria-label={`Activo ${row.name || row.iso}`}
                    />
                  </td>
                  <td className="py-1.5 text-right">
                    <button
                      type="button"
                      onClick={() => removeRow(row.key)}
                      className="p-1.5 text-gray-400 hover:text-red-600 transition-colors"
                      aria-label={`Eliminar ${row.name || row.iso}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-gray-400 mt-3">
        Los países desactivados dejan de aparecer en el registro, pero las cuentas ya creadas conservan su país.
      </p>

      <button
        type="button"
        onClick={handleSave}
        disabled={!hotelId || !initialized || upsertConfig.isPending}
        className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
      >
        {upsertConfig.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        Guardar códigos
      </button>
    </div>
  );
}
