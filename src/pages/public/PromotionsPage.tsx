import { useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { CalendarDays, Loader2, MessageCircle, Tag } from 'lucide-react';
import { useHotelConfig, useHotels, usePromotions } from '../../hooks/useQueries';
import type { Hotel, Promotion } from '../../types';
import { HOTEL_FALLBACKS } from '../../store/hotelStore';
import { generateWhatsAppUrl } from '../../utils/helpers';
import {
  hasPromotionEnded,
  isPromotionUpcoming,
  promotionDateRangeLabel,
  promotionDiscountLabel,
} from '../../utils/promotions';

const TYPE_LABELS: Record<Promotion['type'], string> = {
  discount: 'Descuento',
  event: 'Evento',
  package: 'Paquete',
  seasonal: 'Temporada',
};

function whatsappLink(phone: string, promotion?: Promotion) {
  if (!phone) return undefined;
  const detail = promotion
    ? `Hola, quiero consultar por la promoción "${promotion.title}"${
        promotion.code ? ` (código ${promotion.code})` : ''
      }.`
    : 'Hola, quiero consultar por las promociones y ofertas vigentes del hotel.';
  return generateWhatsAppUrl(phone, detail);
}

export default function PromotionsPage() {
  const { data: hotels } = useHotels();
  const hotelList = (Array.isArray(hotels) ? hotels : []) as Hotel[];
  const hotelId = hotelList[0]?.id || '';
  // Si la base todavía no tiene el contacto, se usa el número de respaldo
  // para no abrir un WhatsApp ajeno (el placeholder de la base).
  const whatsapp = hotelList[0]?.whatsapp || HOTEL_FALLBACKS.whatsapp;

  const { data: promotionsData, isLoading } = usePromotions(hotelId);
  const { data: configsData = [] } = useHotelConfig(hotelId);
  const configs = (Array.isArray(configsData) ? configsData : []) as Array<{ key: string; value: string }>;
  const configValue = (key: string, fallback: string) =>
    configs.find((config) => config.key === key)?.value || fallback;
  const pageTitle = configValue('promotions_title', 'Promociones');
  const pageDescription = configValue(
    'promotions_description',
    'Ofertas y paquetes publicados por el hotel. Consultá condiciones y disponibilidad por WhatsApp.'
  );

  const promotions = useMemo(() => {
    const list = (Array.isArray(promotionsData) ? promotionsData : []) as Promotion[];
    return list
      .filter((promotion) => !hasPromotionEnded(promotion))
      .sort((a, b) => {
        // Las vigentes primero; las próximas se anuncian igual, con su fecha.
        const upcomingA = isPromotionUpcoming(a);
        const upcomingB = isPromotionUpcoming(b);
        if (upcomingA !== upcomingB) return upcomingA ? 1 : -1;
        return String(b.start_date).localeCompare(String(a.start_date));
      });
  }, [promotionsData]);

  useEffect(() => {
    document.title = 'Promociones · Hostal Relax II';
  }, []);

  const generalWhatsApp = whatsappLink(whatsapp);

  return (
    <div className="min-h-screen bg-white pt-24 pb-16">
      <div className="container-wide">
        <motion.header
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-14 text-center"
        >
          <h1 className="mb-6 font-serif text-4xl text-gray-900 md:text-5xl">{pageTitle}</h1>
          <p className="mx-auto max-w-2xl text-lg text-gray-600">{pageDescription}</p>
        </motion.header>

        {isLoading ? (
          <div className="flex items-center justify-center py-24 text-gray-500">
            <Loader2 className="mr-3 h-6 w-6 animate-spin" /> Cargando promociones...
          </div>
        ) : promotions.length === 0 ? (
          <div className="py-20 text-center">
            <Tag className="mx-auto mb-4 h-10 w-10 text-gray-300" />
            <p className="text-lg text-gray-500">No hay promociones vigentes por ahora.</p>
            <p className="mt-2 text-sm text-gray-400">
              Escribinos por WhatsApp y te contamos las ofertas disponibles.
            </p>
            <a
              href={generalWhatsApp}
              target="_blank"
              rel="noopener noreferrer"
              aria-disabled={!generalWhatsApp}
              className={`mt-8 inline-flex items-center gap-2 rounded-lg bg-gray-900 px-8 py-4 text-sm font-semibold uppercase tracking-wider text-white transition-colors hover:bg-gray-800 ${
                generalWhatsApp ? '' : 'pointer-events-none opacity-50'
              }`}
            >
              <MessageCircle className="h-4 w-4" />
              Consultar por WhatsApp
            </a>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {promotions.map((promotion, index) => {
              const discount = promotionDiscountLabel(promotion);
              const upcoming = isPromotionUpcoming(promotion);
              const link = whatsappLink(whatsapp, promotion);
              return (
                <motion.article
                  key={promotion.id}
                  initial={{ opacity: 0, y: 18 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.05 }}
                  className="flex flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-[0_2px_12px_rgba(15,23,42,0.04)]"
                >
                  <div className="relative aspect-square bg-gray-100">
                    {promotion.image_url ? (
                      <img
                        src={promotion.image_url}
                        alt={promotion.title}
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
                        <Tag className="h-8 w-8 text-gray-400" strokeWidth={1.4} />
                      </div>
                    )}
                    <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-4">
                      <span
                        className={`rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-wider backdrop-blur ${
                          upcoming
                            ? 'bg-amber-50/95 text-amber-800'
                            : 'bg-white/90 text-gray-700'
                        }`}
                      >
                        {upcoming ? 'Próximamente' : TYPE_LABELS[promotion.type] || 'Promoción'}
                      </span>
                      {discount ? (
                        <span
                          className="rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white"
                          style={{ backgroundColor: 'var(--brand-primary)' }}
                        >
                          {discount}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex flex-1 flex-col p-5">
                    <h2 className="font-serif text-2xl text-gray-900">{promotion.title}</h2>
                    {promotion.description ? (
                      <p className="mt-2 flex-1 whitespace-pre-line text-sm leading-relaxed text-gray-600">
                        {promotion.description}
                      </p>
                    ) : (
                      <div className="flex-1" />
                    )}

                    <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
                      <span className="inline-flex items-center gap-1.5">
                        <CalendarDays className="h-3.5 w-3.5" />
                        {promotionDateRangeLabel(promotion)}
                      </span>
                      {promotion.code ? (
                        <span className="rounded border border-dashed border-gray-300 px-2 py-0.5 font-mono text-[11px] text-gray-700">
                          {promotion.code}
                        </span>
                      ) : null}
                    </div>

                    <a
                      href={link}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-disabled={!link}
                      className={`mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-gray-900 py-3 text-sm font-semibold uppercase tracking-wider text-white transition-colors hover:bg-gray-800 ${
                        link ? '' : 'pointer-events-none opacity-50'
                      }`}
                    >
                      <MessageCircle className="h-4 w-4" />
                      Consultar por WhatsApp
                    </a>
                  </div>
                </motion.article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
