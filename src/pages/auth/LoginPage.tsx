import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AtSign, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import TurnstileWidget from '../../components/auth/TurnstileWidget';
import CountryPhoneInput from '../../components/common/CountryPhoneInput';
import { useCountryCodes } from '../../hooks/useCountryCodes';
import { cn } from '../../utils/helpers';
import toast from 'react-hot-toast';

const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || '';

type Mode = 'login' | 'register';

const inputClass =
  'w-full px-4 py-3 border border-gray-200 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-900 transition-all';

const labelClass = 'block text-sm font-medium text-gray-700 mb-2';

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>('login');

  // Ingreso
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Registro
  const [alias, setAlias] = useState('');
  const [name, setName] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [countryIso, setCountryIso] = useState('');
  const [dialCode, setDialCode] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  const [captchaToken, setCaptchaToken] = useState('');
  const [captchaReset, setCaptchaReset] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const { login, register, isLoading } = useAuthStore();
  const navigate = useNavigate();
  const { data: countries = [], isLoading: loadingCountries } = useCountryCodes();

  const selectedCountry = useMemo(
    () => countries.find((country) => country.iso === countryIso && country.dial === dialCode) || null,
    [countries, countryIso, dialCode]
  );

  // País por defecto: el primero de la lista configurada por el hotel.
  useEffect(() => {
    if (selectedCountry || countries.length === 0) return;
    const preferred = countries.find((country) => country.iso === 'BO') || countries[0];
    setCountryIso(preferred.iso);
    setDialCode(preferred.dial);
  }, [countries, selectedCountry]);

  const handleToken = useCallback((token: string) => setCaptchaToken(token), []);

  // El token de Turnstile pertenece al widget montado: al cambiar de pestaña se
  // descarta y el widget nuevo pide otro.
  useEffect(() => {
    setCaptchaToken('');
    setCaptchaReset((value) => value + 1);
  }, [mode]);

  const resetCaptcha = () => {
    setCaptchaToken('');
    setCaptchaReset((value) => value + 1);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await login(username, password, captchaToken);
      const stored = localStorage.getItem('auth_user');
      const role = stored ? (JSON.parse(stored) as { role?: string }).role : undefined;
      toast.success('¡Bienvenido!');
      navigate(role === 'client' ? '/cuenta' : '/admin');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error al iniciar sesión');
      // El token de Turnstile es de un solo uso: se pide uno nuevo.
      resetCaptcha();
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dialCode) {
      toast.error('Elegí tu país y código de área');
      return;
    }
    setSubmitting(true);
    try {
      await register({
        alias,
        name,
        password: registerPassword,
        country_iso: countryIso,
        dial_code: dialCode,
        phone,
        email: email.trim() || undefined,
        turnstileToken: captchaToken,
      });
      toast.success('¡Cuenta creada! Ya podés reservar con tu alias.');
      navigate('/cuenta');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo crear la cuenta');
      resetCaptcha();
    } finally {
      setSubmitting(false);
    }
  };

  const busy = submitting || isLoading;

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-6 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-md"
      >
        <Link to="/" className="flex items-center gap-2 text-gray-500 hover:text-gray-900 transition-colors mb-8">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          Volver al inicio
        </Link>

        <div className="bg-white rounded-2xl p-8 lg:p-10 shadow-sm border border-gray-100">
          <div className="grid grid-cols-2 gap-1 rounded-full bg-gray-100 p-1 mb-7" role="tablist">
            {([
              { id: 'login', label: 'Ingreso' },
              { id: 'register', label: 'Registro' },
            ] as const).map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={mode === tab.id}
                onClick={() => setMode(tab.id)}
                className={cn(
                  'rounded-full py-2 text-sm font-medium transition-all',
                  mode === tab.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <h1 className="text-3xl font-serif text-gray-900 mb-2">
            {mode === 'login' ? 'Iniciar Sesión' : 'Crear cuenta'}
          </h1>
          <p className="text-gray-500 mb-8">
            {mode === 'login'
              ? 'Ingresá con tu usuario del sistema o tu cuenta de cliente.'
              : 'Tu alias y tu celular alcanzan. Podés completar el resto después.'}
          </p>

          {mode === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className={labelClass} htmlFor="login-username">Usuario</label>
                <input
                  id="login-username"
                  type="text"
                  required
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className={inputClass}
                  placeholder="Tu usuario"
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="login-password">Contraseña</label>
                <div className="relative">
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={cn(inputClass, 'pr-12')}
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    tabIndex={-1}
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <TurnstileWidget siteKey={TURNSTILE_SITE_KEY} onToken={handleToken} resetKey={captchaReset} />

              <button
                type="submit"
                disabled={busy}
                className="w-full py-3 bg-gray-900 text-white font-semibold rounded-lg hover:bg-gray-800 transition-all disabled:opacity-50"
              >
                {busy ? 'Ingresando...' : 'Iniciar Sesión'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-5">
              <div>
                <label className={labelClass} htmlFor="register-alias">Alias</label>
                <div className="relative">
                  <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    id="register-alias"
                    type="text"
                    required
                    autoComplete="username"
                    value={alias}
                    onChange={(e) => setAlias(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ''))}
                    className={cn(inputClass, 'pl-9')}
                    placeholder="tu.alias"
                    minLength={3}
                    maxLength={24}
                  />
                </div>
                <p className="mt-1 text-xs text-gray-400">
                  Así vas a ingresar: 3 a 24 caracteres, sin espacios ni mayúsculas.
                </p>
              </div>

              <div>
                <label className={labelClass} htmlFor="register-name">Nombre</label>
                <input
                  id="register-name"
                  type="text"
                  required
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={inputClass}
                  placeholder="Nombre y apellido"
                  maxLength={80}
                />
              </div>

              <div>
                <label className={labelClass} htmlFor="register-password">Contraseña</label>
                <div className="relative">
                  <input
                    id="register-password"
                    type={showRegisterPassword ? 'text' : 'password'}
                    required
                    autoComplete="new-password"
                    value={registerPassword}
                    onChange={(e) => setRegisterPassword(e.target.value)}
                    className={cn(inputClass, 'pr-12')}
                    placeholder="Mínimo 8 caracteres"
                    minLength={8}
                    maxLength={72}
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegisterPassword(!showRegisterPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    tabIndex={-1}
                    aria-label={showRegisterPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  >
                    {showRegisterPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className={labelClass}>Celular</label>
                <CountryPhoneInput
                  countries={countries}
                  iso={countryIso}
                  dial={dialCode}
                  phone={phone}
                  onCountryChange={(country) => {
                    setCountryIso(country.iso);
                    setDialCode(country.dial);
                  }}
                  onPhoneChange={setPhone}
                  placeholder={loadingCountries ? 'Cargando países...' : 'Número de celular'}
                />
                <p className="mt-1 text-xs text-gray-400">
                  Elegí el código de área: el país se completa solo.
                </p>
              </div>

              <div>
                <label className={labelClass} htmlFor="register-email">
                  Correo <span className="font-normal text-gray-400">(opcional)</span>
                </label>
                <input
                  id="register-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputClass}
                  placeholder="tucorreo@ejemplo.com"
                />
                <p className="mt-1 text-xs text-gray-400">
                  Verificamos que el dominio reciba correo antes de guardarlo.
                </p>
              </div>

              <TurnstileWidget siteKey={TURNSTILE_SITE_KEY} onToken={handleToken} resetKey={captchaReset} />

              <button
                type="submit"
                disabled={busy}
                className="w-full py-3 bg-gray-900 text-white font-semibold rounded-lg hover:bg-gray-800 transition-all disabled:opacity-50 inline-flex items-center justify-center gap-2"
              >
                {busy && <Loader2 className="w-4 h-4 animate-spin" />}
                {busy ? 'Creando cuenta...' : 'Crear cuenta'}
              </button>

              <p className="text-center text-xs text-gray-400">
                Al crear la cuenta aceptás que el hotel use tus datos para gestionar tus reservas.
              </p>
            </form>
          )}

          <p className="mt-6 text-center text-xs text-gray-400">
            {mode === 'login'
              ? 'Las cuentas de cliente se crean desde la pestaña Registro.'
              : 'El personal del hotel sigue ingresando con su usuario del sistema.'}
          </p>
          {selectedCountry && mode === 'register' && (
            <p className="sr-only" aria-live="polite">
              País seleccionado: {selectedCountry.name} {selectedCountry.dial}
            </p>
          )}
        </div>
      </motion.div>
    </div>
  );
}
