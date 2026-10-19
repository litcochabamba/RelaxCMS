import { useEffect, useState } from 'react';
import { Clock, Loader2, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import { useHotels, useHotelConfig, useUpsertHotelConfig } from '../../hooks/useQueries';
import type { Hotel, HotelConfig } from '../../types';

const DEFAULT_CHECKIN = '05:00';
const DEFAULT_CHECKOUT = '12:00';

/**
 * Horarios por defecto que usa la barra de disponibilidad de la portada:
 * la entrada se propone para hoy a esa hora y la salida para el día
 * siguiente a la hora configurada.
 */
export default function StayScheduleSettings() {
  const { data: hotels } = useHotels();
  const hotel = (Array.isArray(hotels) ? hotels[0] : undefined) as Hotel | undefined;
  const hotelId = hotel?.id || '';
  const { data: configs = [], isLoading } = useHotelConfig(hotelId);
  const upsertConfig = useUpsertHotelConfig();

  const [checkIn, setCheckIn] = useState(DEFAULT_CHECKIN);
  const [checkOut, setCheckOut] = useState(DEFAULT_CHECKOUT);

  useEffect(() => {
    const list = (Array.isArray(configs) ? configs : []) as HotelConfig[];
    if (list.length === 0) return;
    const value = (key: string, fallback: string) => list.find(config => config.key === key)?.value || fallback;
    setCheckIn(value('checkin_time', DEFAULT_CHECKIN));
    setCheckOut(value('checkout_time', DEFAULT_CHECKOUT));
  }, [configs]);

  const handleSave = async () => {
    if (!hotelId) return;
    try {
      await upsertConfig.mutateAsync({ hotelId, key: 'checkin_time', value: checkIn, group: 'reservas' });
      await upsertConfig.mutateAsync({ hotelId, key: 'checkout_time', value: checkOut, group: 'reservas' });
      toast.success('Horarios actualizados');
    } catch {
      toast.error('No se pudieron guardar los horarios');
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-6">
      <h3 className="text-lg font-serif text-gray-900 mb-1 flex items-center gap-2">
        <Clock className="w-5 h-5 text-gray-600" />
        Horarios de la estancia
      </h3>
      <p className="text-sm text-gray-500 mb-4">
        Horas sugeridas por defecto en la barra de disponibilidad de la portada.
      </p>

      {isLoading ? (
        <div className="flex items-center gap-2 py-4 text-sm text-gray-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          Cargando horarios...
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="block">
            <span className="block text-sm text-gray-500 mb-1">Entrada (check-in)</span>
            <input
              type="time"
              step={60}
              value={checkIn}
              onChange={(event) => setCheckIn(event.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/10"
            />
          </label>
          <label className="block">
            <span className="block text-sm text-gray-500 mb-1">Salida (check-out)</span>
            <input
              type="time"
              step={60}
              value={checkOut}
              onChange={(event) => setCheckOut(event.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/10"
            />
          </label>
        </div>
      )}

      <p className="text-xs text-gray-400 mt-3">
        La salida se propone para el día siguiente a la fecha de entrada.
      </p>

      <button
        type="button"
        onClick={handleSave}
        disabled={!hotelId || upsertConfig.isPending}
        className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
      >
        {upsertConfig.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        Guardar horarios
      </button>
    </div>
  );
}
