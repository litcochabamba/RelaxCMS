import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';
import type { CountryDialCode } from '../../types';

interface CountryPhoneInputProps {
  countries: CountryDialCode[];
  iso: string;
  dial: string;
  phone: string;
  onCountryChange: (country: CountryDialCode) => void;
  onPhoneChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  /** Clases extra para el campo (por ejemplo, para igualar el fondo del formulario). */
  className?: string;
}

/**
 * Selector de país con búsqueda + número local.
 *
 * El país se elige del listado configurado en el panel; nunca se escribe a mano.
 * Al elegirlo se muestra su bandera y su código de área, y el número se guarda
 * junto a ese código (el servidor deduce el país desde ahí).
 */
export default function CountryPhoneInput({
  countries,
  iso,
  dial,
  phone,
  onCountryChange,
  onPhoneChange,
  disabled = false,
  placeholder = 'Celular',
  className = '',
}: CountryPhoneInputProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selected = useMemo(
    () => countries.find((country) => country.iso === iso && country.dial === dial) || null,
    [countries, iso, dial]
  );

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return countries;
    return countries.filter(
      (country) =>
        country.name.toLowerCase().includes(term) ||
        country.iso.toLowerCase().includes(term) ||
        country.dial.includes(term)
    );
  }, [countries, query]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    const focusTimer = window.setTimeout(() => searchRef.current?.focus(), 0);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
      window.clearTimeout(focusTimer);
    };
  }, [open]);

  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <div
        className={`flex items-stretch rounded-lg border border-gray-200 overflow-hidden focus-within:ring-2 focus-within:ring-gray-900/10 focus-within:border-gray-900 transition-all ${className}`}
      >
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen((value) => !value)}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label="Elegir país y código de área"
          className="flex items-center gap-1.5 px-3 bg-gray-50 border-r border-gray-200 text-sm text-gray-700 hover:bg-gray-100 transition-colors disabled:opacity-50"
        >
          <span className="text-base leading-none">{selected?.flag || '🌐'}</span>
          <span className="font-medium tabular-nums">{selected?.dial || dial || '—'}</span>
          <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
        </button>
        <input
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          disabled={disabled}
          value={phone}
          onChange={(event) => onPhoneChange(event.target.value.replace(/[^\d\s-]/g, ''))}
          placeholder={placeholder}
          className="flex-1 min-w-0 px-3 py-3 text-gray-900 placeholder:text-gray-400 focus:outline-none disabled:bg-gray-50"
        />
      </div>

      {selected && (
        <p className="mt-1 text-xs text-gray-400">País: {selected.name}</p>
      )}

      {open && (
        <div className="absolute z-30 mt-1 w-full min-w-[260px] rounded-xl border border-gray-100 bg-white shadow-xl">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100">
            <Search className="w-4 h-4 text-gray-400" />
            <input
              ref={searchRef}
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar país o código..."
              className="flex-1 min-w-0 py-1 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none"
            />
          </div>
          <ul role="listbox" className="max-h-56 overflow-y-auto py-1">
            {filtered.length === 0 && (
              <li className="px-3 py-3 text-sm text-gray-500">Sin resultados</li>
            )}
            {filtered.map((country) => {
              const active = country.iso === iso && country.dial === dial;
              return (
                <li key={`${country.iso}-${country.dial}`}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => {
                      onCountryChange(country);
                      setOpen(false);
                    }}
                    className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <span className="text-base leading-none">{country.flag || '🌐'}</span>
                    <span className="flex-1 truncate">{country.name}</span>
                    <span className="text-gray-500 tabular-nums">{country.dial}</span>
                    {active && <Check className="w-4 h-4 text-gray-900" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
