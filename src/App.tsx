import { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import Navbar from './components/layout/Navbar';
import Footer from './components/layout/Footer';
import CmsPanel from './components/admin/CmsPanel';
import { useAuthStore } from './store/authStore';
import { useHotelBranding } from './hooks/useHotelBranding';

// Lazy loaded pages
const HomePage = lazy(() => import('./pages/public/HomePage'));
const GalleryPage = lazy(() => import('./pages/public/GalleryPage'));
const PromotionsPage = lazy(() => import('./pages/public/PromotionsPage'));
const ContactPage = lazy(() => import('./pages/public/ContactPage'));
const LoginPage = lazy(() => import('./pages/auth/LoginPage'));
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const ClientAccountPage = lazy(() => import('./pages/client/ClientAccountPage'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function LoadingSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="text-center">
        <div className="inline-block w-10 h-10 border-2 border-gray-200 border-t-gray-900 rounded-full animate-spin mb-4" />
        <p className="text-sm text-gray-500">Cargando...</p>
      </div>
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/auth/login" replace />;
  if (user?.role !== 'admin' && user?.role !== 'moderator') return <Navigate to="/" replace />;
  return <>{children}</>;
}

function ClientRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/auth/login" replace />;
  if (user?.role !== 'client') {
    return <Navigate to={user?.role === 'admin' || user?.role === 'moderator' ? '/admin' : '/'} replace />;
  }
  return <>{children}</>;
}

function PublicLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user } = useAuthStore();
  const showCms = isAuthenticated && (user?.role === 'admin' || user?.role === 'moderator');
  // Nombre, colores, contacto y redes del hotel vienen de la base de datos.
  useHotelBranding();

  return (
    <>
      <Navbar />
      {children}
      <Footer />
      {showCms && <CmsPanel />}
    </>
  );
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function AppRoutes() {
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith('/admin');
  const isAuthRoute = location.pathname.startsWith('/auth');

  return (
    <Suspense fallback={<LoadingSpinner />}>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<PublicLayout><HomePage /></PublicLayout>} />
        <Route path="/galeria" element={<PublicLayout><GalleryPage /></PublicLayout>} />
        <Route path="/promociones" element={<PublicLayout><PromotionsPage /></PublicLayout>} />
        <Route path="/contacto" element={<PublicLayout><ContactPage /></PublicLayout>} />
        <Route
          path="/cuenta"
          element={
            <ClientRoute>
              <PublicLayout>
                <ClientAccountPage />
              </PublicLayout>
            </ClientRoute>
          }
        />

        {/* Auth routes */}
        <Route path="/auth/login" element={<LoginPage />} />

        {/* Admin routes */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />

        {/* Catch all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ScrollToTop />
        <AppRoutes />
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#1a1a2e',
              color: '#fff',
              borderRadius: '12px',
              padding: '16px',
              fontSize: '14px',
            },
            success: {
              iconTheme: { primary: '#10B981', secondary: '#fff' },
            },
            error: {
              iconTheme: { primary: '#EF4444', secondary: '#fff' },
            },
          }}
        />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
