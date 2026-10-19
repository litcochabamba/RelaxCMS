import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, MessageCircle, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { clientApi, submitPromotionInquiry } from '../../api/client';
import { useAuthStore } from '../../store/authStore';
import { generateWhatsAppUrl } from '../../utils/helpers';
import type { Promotion } from '../../types';

interface PromotionInquiryModalProps {
  open: boolean;
  promotion: Promotion | null;
  hotelId: string;
  whatsapp: string;
  onClose: () => void;
}

/**
 * Antes de saltar a WhatsApp pide nombre y celular. Así recepción sabe quién
 * consultó por la promoción y puede responderle, y la consulta queda además en
 * `consultas` para el panel del hotel.
 */
export default function PromotionInquiryModal({
  open,
  promotion,
  hotelId,
  whatsapp,
  onClose,
}: PromotionInquiryModalProps) {
  const { user, isAuthenticated } = useAuthStore();
  const isClient = isAuthenticated && user?.role === 'client';

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  // Al abrir se limpia el formulario y, si hay sesión de cliente, se completan
  // nombre y celular con los de su cuenta.
  useEffect(() => {
    if (!open) return;
    setName(isClient ? user?.name || '' : '');
    setPhone('');
    setClientEmail('');
    setError(null);
    setSending(false);

    if (!isClient) return;
    let active = true;
    clientApi.me().then((result) => {
      if (!active || result.error) return;
      const client = (
        result.data as {
          client?: {
            name?: string;
            phone?: string | null;
            email?: string | null;
          };
        } | null
      )?.client;
      if (!client) return;
      setName((current) => current || client.name || '');
      setPhone((current) => current || client.phone || '');
      setClientEmail(client.email || '');
    });
    return () => {
      active = false;
    };
  }, [open, isClient, user?.name]);

  // Escape cierra y el fondo no se desplaza mientras el diálogo está abierto.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !sending) onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, sending, onClose]);

  if (!open) return null;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (sending) return;

    const cleanName = name.trim().replace(/\s+/g, ' ');
    const cleanPhone = phone.trim();
    const digits = cleanPhone.replace(/\D/g, '');

    if (cleanName.length < 2) {
      setError('Ingresá tu nombre.');
      return;
    }
    if (digits.length < 6 || digits.length > 15) {
      setError('Ingresá un número de celular válido.');
      return;
    }
    if (!hotelId) {
      setError('No pudimos identificar el hotel. Recargá la página e intentá de nuevo.');
      return;
    }

    setError(null);
    setSending(true);

    // Se abre la pestaña dentro del gesto del usuario para que el navegador no
    // bloquee la redirección a WhatsApp después de la petición.
    const waWindow = whatsapp ? window.open('about:blank', '_blank') : null;
    if (waWindow) {
      waWindow.document.write(
        '<!doctype html><title>WhatsApp</title><body style="font-family:system-ui,sans-serif;padding:2rem;color:#374151">Abriendo WhatsApp…</body>'
      );
    }

    try {
      const result = await submitPromotionInquiry({
        hotel_id: hotelId,
        name: cleanName,
        email: clientEmail,
        phone: cleanPhone,
        promotion: promotion ? promotion.title : 'Consulta general de promociones',
      });
      if (result.error) throw new Error(result.error);

      if (!whatsapp) {
        toast.success('Consulta enviada');
        onClose();
        return;
      }

      const text = promotion
        ? `Hola, soy ${cleanName}. Mi celular es ${cleanPhone}. Quiero consultar por la promoción "${promotion.title}".`
        : `Hola, soy ${cleanName}. Mi celular es ${cleanPhone}. Quiero consultar por las promociones vigentes.`;
      const url = generateWhatsAppUrl(whatsapp, text);

      if (waWindow) waWindow.location.replace(url);
      else window.location.href = url;
      onClose();
    } catch (submitError) {
      if (waWindow) waWindow.close();
      setError(
        submitError instanceof Error && submitError.message
          ? submitError.message
          : 'No se pudo enviar la consulta. Probá de nuevo.'
      );
    } finally {
      setSending(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-gray-900/60 p-4 backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !sending) onClose();
      }}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="promo-inquiry-title"
        className="relative w-full max-w-md rounded-2xl border border-gray-100 bg-white p-6 shadow-2xl sm:p-7"
      >
        <button
          type="button"
          onClick={onClose}
          disabled={sending}
          aria-label="Cerrar"
          className="absolute right-4 top-4 rounded-full p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50"
        >
          <X className="h-4 w-4" />
        </button>

        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--brand-primary)]">
          Consulta por WhatsApp
        </p>
        <h2 id="promo-inquiry-title" className="mt-2 pr-6 font-serif text-2xl text-gray-900">
          {promotion ? promotion.title : 'Promociones y ofertas'}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-gray-500">
          Dejanos tu nombre y celular para que recepción sepa quién consulta. Después seguimos
          por WhatsApp.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="promo-inquiry-name" className="mb-1.5 block text-xs font-medium text-gray-600">
              Nombre
            </label>
            <input
              id="promo-inquiry-name"
              type="text"
              required
              autoComplete="name"
              autoFocus
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={sending}
              className="w-full rounded-lg border border-gray-200 px-4 py-3 text-sm text-gray-900 transition-colors focus:border-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/10 disabled:bg-gray-50"
              placeholder="Tu nombre completo"
            />
          </div>

          <div>
            <label htmlFor="promo-inquiry-phone" className="mb-1.5 block text-xs font-medium text-gray-600">
              Celular
            </label>
            <input
              id="promo-inquiry-phone"
              type="tel"
              required
              inputMode="tel"
              autoComplete="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              disabled={sending}
              className="w-full rounded-lg border border-gray-200 px-4 py-3 text-sm text-gray-900 transition-colors focus:border-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/10 disabled:bg-gray-50"
              placeholder="+591 70000000"
            />
          </div>

          {error ? (
            <p role="alert" className="text-xs leading-relaxed text-red-600">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={sending}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-gray-900 px-6 py-3.5 text-sm font-semibold uppercase tracking-wider text-white transition-colors hover:bg-gray-800 disabled:cursor-wait disabled:opacity-60"
          >
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <MessageCircle className="h-4 w-4" />
            )}
            {sending ? 'Enviando…' : 'Enviar y abrir WhatsApp'}
          </button>
        </form>

        <p className="mt-4 text-center text-[11px] leading-relaxed text-gray-400">
          Usamos tu nombre y celular solo para responder esta consulta.
        </p>
      </div>
    </div>,
    document.body
  );
}
