import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { useMediaQuery, useScrollPosition } from '../../hooks/useUtils';
import { useAuthStore } from '../../store/authStore';
import { useHotelDataStore } from '../../store/hotelStore';
import { useCmsPanelStore } from '../../store/cmsStore';
import { cn } from '../../utils/helpers';
import { prefetchPromotionsPage } from '../../utils/prefetchPromotions';

const navLinks = [
  { label: 'Inicio', href: '/' },
  { label: 'Galería', href: '/galeria' },
  { label: 'Promociones', href: '/promociones' },
  { label: 'Contacto', href: '/contacto' },
];

// Ancho mínimo para que las pestañas no se metan debajo del logo centrado
// (nombre del hotel incluido). Por debajo, el menú pasa al desplegable móvil.
const DESKTOP_NAV_QUERY = '(min-width: 1200px)';

export default function Navbar() {
  const { isScrolled } = useScrollPosition();
  const showDesktopNav = useMediaQuery(DESKTOP_NAV_QUERY);
  const { isAuthenticated, user, logout } = useAuthStore();
  const { hotelName, logoUrl } = useHotelDataStore();
  const hotelId = useHotelDataStore((state) => state.hotelId);
  const queryClient = useQueryClient();
  const { toggle } = useCmsPanelStore();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const location = useLocation();

  const isStaff = user?.role === 'admin' || user?.role === 'moderator';

  // Al pasar el mouse, enfocar o tocar "Promociones" se descarga el chunk de la
  // página y se piden sus datos; el clic ya no arranca nada desde cero.
  const prefetchLink = (href: string) => {
    if (href === '/promociones') prefetchPromotionsPage(queryClient, hotelId);
  };

  // Un solo lugar decide a dónde lleva la cuenta: al panel para el personal del
  // hotel y a la cuenta propia para los clientes.
  const accountLink = isStaff
    ? { to: '/admin', label: 'Dashboard' }
    : user?.role === 'client'
      ? { to: '/cuenta', label: 'Mi cuenta' }
      : null;

  useEffect(() => {
    setMobileOpen(false);
    setUserMenuOpen(false);
  }, [location]);

  // Si la ventana crece mientras el menú móvil está abierto, se cierra.
  useEffect(() => {
    if (showDesktopNav) setMobileOpen(false);
  }, [showDesktopNav]);

  const closeMenus = () => {
    setMobileOpen(false);
    setUserMenuOpen(false);
  };

  const handleLogout = () => {
    logout();
    closeMenus();
  };

  const isHomePage = location.pathname === '/';
  const isScrolledActive = isScrolled || !isHomePage;

  return (
    <>
      <motion.nav
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className={cn(
          'fixed top-0 left-0 right-0 z-50 transition-[background-color,box-shadow,backdrop-filter] duration-500',
          isScrolledActive
            ? 'bg-white/95 backdrop-blur-md shadow-lg shadow-black/5'
            : 'bg-transparent'
        )}
      >
        <div className="container-wide">
          <div className="flex items-center justify-between h-20">
            {/* Left nav links */}
            {showDesktopNav && (
              <div className="flex items-center gap-8">
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    to={link.href}
                    onMouseEnter={() => prefetchLink(link.href)}
                    onFocus={() => prefetchLink(link.href)}
                    onTouchStart={() => prefetchLink(link.href)}
                    className={cn(
                      'text-sm font-medium tracking-wider uppercase transition-colors duration-300',
                      isScrolledActive
                        ? 'text-gray-700 hover:text-gray-900'
                        : 'text-white/80 hover:text-white'
                    )}
                    style={
                      location.pathname === link.href
                        ? { color: isScrolledActive ? 'var(--brand-primary)' : 'var(--brand-accent)' }
                        : undefined
                    }
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            )}

            {/* Logo - centered */}
            <Link to="/" className="absolute left-1/2 -translate-x-1/2 flex items-center gap-3">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt={hotelName}
                  className={cn(
                    'w-auto object-contain transition-all duration-300',
                    isScrolledActive
                      ? 'h-10 max-w-[180px]'
                      : 'h-10 max-w-[160px] rounded-md bg-white/90 px-2 py-1 shadow-sm backdrop-blur-sm'
                  )}
                />
              ) : (
                <div className="flex items-center gap-2">
                  <div
                    className={cn(
                      'w-8 h-8 rounded-sm flex items-center justify-center',
                      isScrolledActive ? '' : 'bg-white/20'
                    )}
                    style={isScrolledActive ? { backgroundColor: 'var(--brand-secondary)' } : undefined}
                  >
                    <span className="text-lg font-serif font-bold text-white">H</span>
                  </div>
                  <span
                    className={cn(
                      'text-xl font-serif font-semibold tracking-wide',
                      isScrolledActive ? 'text-gray-900' : 'text-white'
                    )}
                  >
                    {hotelName}
                  </span>
                </div>
              )}
            </Link>

            {/* Right side */}
            {showDesktopNav && (
              <div className="flex items-center gap-6">
                {isAuthenticated ? (
                  <div className="relative">
                    <button
                      onClick={() => setUserMenuOpen(!userMenuOpen)}
                      className={cn(
                        'flex items-center gap-2 text-sm font-medium transition-colors',
                        isScrolledActive ? 'text-gray-700 hover:text-gray-900' : 'text-white/80 hover:text-white'
                      )}
                    >
                      <div
                        className={cn(
                          'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold',
                          isScrolledActive ? 'text-white' : 'bg-white/20 text-white'
                        )}
                        style={isScrolledActive ? { backgroundColor: 'var(--brand-secondary)' } : undefined}
                      >
                        {user?.name?.charAt(0) || 'U'}
                      </div>
                      <span className="hidden lg:inline max-w-[140px] truncate">{user?.name}</span>
                    </button>
                    <AnimatePresence>
                      {userMenuOpen && (
                        <motion.div
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 8 }}
                          className="absolute right-0 top-full mt-2 w-48 bg-white rounded-lg shadow-xl border border-gray-100 py-2"
                        >
                          {accountLink && (
                            <Link
                              to={accountLink.to}
                              onClick={closeMenus}
                              className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                            >
                              {accountLink.label}
                            </Link>
                          )}
                          <button
                            onClick={handleLogout}
                            className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                          >
                            Cerrar Sesión
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ) : (
                  <Link
                    to="/auth/login"
                    className={cn(
                      'text-sm font-medium tracking-wider uppercase transition-colors duration-300',
                      isScrolledActive ? 'text-gray-700 hover:text-gray-900' : 'text-white/80 hover:text-white'
                    )}
                  >
                    Ingreso
                  </Link>
                )}
                {/* CMS Panel Toggle (admin only) */}
                {isStaff && (
                  <button
                    onClick={toggle}
                    className={cn(
                      'px-4 py-2 text-xs font-semibold tracking-wider uppercase rounded transition-all',
                      isScrolledActive
                        ? 'text-white hover:opacity-90'
                        : 'bg-white/20 text-white hover:bg-white/30 backdrop-blur'
                    )}
                    style={isScrolledActive ? { backgroundColor: 'var(--brand-secondary)' } : undefined}
                  >
                    CMS
                  </button>
                )}
              </div>
            )}

            {/* Mobile menu button */}
            {!showDesktopNav && (
              <button
                onClick={() => setMobileOpen(!mobileOpen)}
                className={cn(
                  'ml-auto p-2 rounded transition-colors',
                  isScrolledActive ? 'text-gray-900' : 'text-white'
                )}
                aria-label={mobileOpen ? 'Cerrar menú' : 'Abrir menú'}
                aria-expanded={mobileOpen}
              >
                <div className="w-6 h-5 flex flex-col justify-between">
                  <span
                    className={cn(
                      'w-full h-0.5 transition-all duration-300 origin-left',
                      isScrolledActive ? 'bg-gray-900' : 'bg-white',
                      mobileOpen && 'rotate-45'
                    )}
                  />
                  <span
                    className={cn(
                      'w-full h-0.5 transition-all duration-300',
                      isScrolledActive ? 'bg-gray-900' : 'bg-white',
                      mobileOpen && 'opacity-0'
                    )}
                  />
                  <span
                    className={cn(
                      'w-full h-0.5 transition-all duration-300 origin-left',
                      isScrolledActive ? 'bg-gray-900' : 'bg-white',
                      mobileOpen && '-rotate-45'
                    )}
                  />
                </div>
              </button>
            )}
          </div>
        </div>
      </motion.nav>      {/*
       * Menú móvil: panel desplegable anclado bajo el navbar. Antes era una
       * capa a pantalla completa que tapaba la página entera; así el visitante
       * mantiene el contexto de lo que estaba viendo.
       */}
      <AnimatePresence>
        {!showDesktopNav && mobileOpen && (
          <>
            {/* Capa invisible: cierra el panel al tocar fuera, sin oscurecer. */}
            <button
              type="button"
              aria-label="Cerrar menú"
              onClick={closeMenus}
              className="fixed inset-0 z-40 cursor-default"
              tabIndex={-1}
            />
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.98 }}
              transition={{ type: 'tween', duration: 0.2, ease: 'easeOut' }}
              className="fixed right-4 top-[5.25rem] z-50 w-[min(18rem,calc(100vw-2rem))] origin-top-right overflow-hidden rounded-2xl border border-gray-200 bg-white p-2 shadow-2xl shadow-black/15"
            >
              <nav className="flex flex-col">
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    to={link.href}
                    onMouseEnter={() => prefetchLink(link.href)}
                    onFocus={() => prefetchLink(link.href)}
                    onTouchStart={() => prefetchLink(link.href)}
                    className="rounded-xl px-3 py-2.5 text-sm font-medium tracking-wider uppercase text-gray-800 transition-colors hover:bg-gray-50 hover:text-gray-900"
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>

              <div className="my-1.5 h-px bg-gray-100" />

              <div className="flex flex-col">
                {isAuthenticated ? (
                  <>
                    {accountLink && (
                      <Link
                        to={accountLink.to}
                        className="rounded-xl px-3 py-2.5 text-sm text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900"
                      >
                        {accountLink.label}
                      </Link>
                    )}
                    {isStaff && (
                      <button
                        onClick={() => {
                          closeMenus();
                          toggle();
                        }}
                        className="rounded-xl px-3 py-2.5 text-left text-sm text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900"
                      >
                        CMS
                      </button>
                    )}
                    <button
                      onClick={handleLogout}
                      className="rounded-xl px-3 py-2.5 text-left text-sm text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900"
                    >
                      Cerrar Sesión
                    </button>
                  </>
                ) : (
                  <Link
                    to="/auth/login"
                    className="rounded-xl px-3 py-2.5 text-sm text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900"
                  >
                    Ingreso / Registro
                  </Link>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
