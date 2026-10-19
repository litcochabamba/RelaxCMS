import { useState, useEffect } from 'react';
import { Database, CheckCircle, XCircle, RefreshCw } from 'lucide-react';

interface ConnectionStatus {
  connected: boolean;
  projectRef: string;
  lastChecked: Date | null;
}

export default function SupabaseConnection() {
  const [status, setStatus] = useState<ConnectionStatus>({
    connected: false,
    projectRef: '',
    lastChecked: null,
  });
  const [checking, setChecking] = useState(false);

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

  const checkConnection = async () => {
    setChecking(true);
    try {
      if (!supabaseUrl || !supabaseKey) {
        setStatus(prev => ({ ...prev, connected: false, lastChecked: new Date() }));
        return;
      }

      // Se consulta una tabla real: la raíz `/rest/v1/` (especificación OpenAPI)
      // responde 401 con la clave anónima aunque la base esté perfecta, y ese
      // falso "Sin conexión" confundía al panel.
      const response = await fetch(`${supabaseUrl}/rest/v1/hoteles?select=id&limit=1`, {
        method: 'GET',
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
      });

      if (response.ok) {
        const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] || '';
        setStatus({
          connected: true,
          projectRef,
          lastChecked: new Date(),
        });
      } else {
        setStatus(prev => ({ ...prev, connected: false, lastChecked: new Date() }));
      }
    } catch (error) {
      setStatus(prev => ({ ...prev, connected: false, lastChecked: new Date() }));
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    checkConnection();
  }, []);

  return (
    <div className="space-y-6">
      {/* Connection Status Card */}
      <div className={`rounded-xl border-2 p-6 ${
        status.connected 
          ? 'bg-green-50 border-green-200' 
          : 'bg-red-50 border-red-200'
      }`}>
        <div className="flex items-start gap-4">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
            status.connected ? 'bg-green-100' : 'bg-red-100'
          }`}>
            {status.connected ? (
              <CheckCircle className="w-6 h-6 text-green-600" />
            ) : (
              <XCircle className="w-6 h-6 text-red-600" />
            )}
          </div>
          <div className="flex-1">
            <h3 className={`text-lg font-semibold ${
              status.connected ? 'text-green-900' : 'text-red-900'
            }`}>
              {status.connected ? 'Conectado a Supabase' : 'Sin conexión a Supabase'}
            </h3>
            <p className={`text-sm mt-1 ${
              status.connected ? 'text-green-700' : 'text-red-700'
            }`}>
              {status.connected 
                ? `Proyecto: ${status.projectRef} • Región: São Paulo (sa-east-1)`
                : 'Verifica la configuración en las variables de entorno'
              }
            </p>
            {status.lastChecked && (
              <p className="text-xs text-gray-500 mt-2">
                Última verificación: {status.lastChecked.toLocaleTimeString()}
              </p>
            )}
          </div>
          <button
            onClick={checkConnection}
            disabled={checking}
            className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${checking ? 'animate-spin' : ''}`} />
            Verificar
          </button>
        </div>
      </div>

      {/* Database Info */}
      <div className="bg-white rounded-xl border border-gray-100 p-6">
        <h3 className="text-lg font-serif text-gray-900 mb-4 flex items-center gap-2">
          <Database className="w-5 h-5 text-gray-600" />
          Información de la Base de Datos
        </h3>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-500">Región</p>
            <p className="font-medium text-gray-900">São Paulo (sa-east-1)</p>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-500">Tablas</p>
            <p className="font-medium text-gray-900">18 tablas</p>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-500">RLS</p>
            <p className="font-medium text-gray-900">Habilitado</p>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-500">Triggers</p>
            <p className="font-medium text-gray-900">updated_at automático</p>
          </div>
        </div>
      </div>

      {/* Tables List */}
      <div className="bg-white rounded-xl border border-gray-100 p-6">
        <h3 className="text-lg font-serif text-gray-900 mb-4">Tablas Disponibles</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {[
            'hoteles', 'usuarios', 'roles', 'configuracion_hotel',
            'hero_slides', 'categorias_habitacion', 'habitaciones',
            'habitacion_imagenes', 'amenidades', 'atractivos_turisticos',
            'atractivo_imagenes', 'galeria', 'reservas', 'consultas',
            'comentarios', 'newsletter', 'promociones', 'seo_config'
          ].map((table) => (
            <div
              key={table}
              className="px-3 py-2 bg-gray-50 rounded-lg text-sm font-mono text-gray-600"
            >
              {table}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
