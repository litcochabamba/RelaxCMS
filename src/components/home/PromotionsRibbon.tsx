import { Link } from 'react-router-dom';
import { ArrowRight, Megaphone } from 'lucide-react';
import { useHotels, usePromotions } from '../../hooks/useQueries';
import type { Hotel, Promotion } from '../../types';
import {
  hasPromotionEnded,
  isPromotionUpcoming,
  promotionDateRangeLabel,
  promotionDiscountLabel,
} from '../../utils/promotions';

/**
 * Cinta automática de promociones. No depende de los bloques manuales de
 * "Avisos y cintas": aparece mientras haya una promoción activa que no haya
 * terminado. Las próximas se anuncian con su fecha.
 */
export default function PromotionsRibbon() {
  const { data: hotels } = useHotels();
  const hotelId = (Array.isArray(hotels) ? hotels[0]?.id : '') || '';
  const { data: promotionsData } = usePromotions(hotelId);
  const promotions = (Array.isArray(promotionsData) ? promotionsData : []) as Promotion[];

  const visible = promotions
    .filter((promotion) => !hasPromotionEnded(promotion))
    .sort((a, b) => {
      const upcomingA = isPromotionUpcoming(a);
      const upcomingB = isPromotionUpcoming(b);
      if (upcomingA !== upcomingB) return upcomingA ? 1 : -1;
      return String(b.start_date).localeCompare(String(a.start_date));
    });

  if (visible.length === 0) return null;

  return (
    <div className="w-full bg-gray-900 text-white">
      <Link
        to="/promociones"
        aria-label="Ver promociones"
        className="group flex items-stretch overflow-hidden"
        role="marquee"
      >
        <span className="z-10 flex shrink-0 items-center gap-2 bg-[var(--brand-primary)] px-4 py-3 text-[10px] font-bold uppercase tracking-[0.2em] sm:px-6 sm:text-xs">
          <Megaphone className="h-3.5 w-3.5" />
          Promo
        </span>

        <div className="flex flex-1 overflow-hidden py-3">
          {[0, 1].map((copy) => (
            <div
              key={copy}
              aria-hidden={copy === 1}
              className="animate-marquee flex min-w-full shrink-0 items-center justify-around gap-8 whitespace-nowrap px-6 text-[11px] font-medium uppercase tracking-[0.18em] motion-reduce:animate-none sm:text-xs"
              style={{ animationDuration: '30s' }}
            >
              {visible.map((promotion) => {
                const upcoming = isPromotionUpcoming(promotion);
                const discount = promotionDiscountLabel(promotion);
                const dates = promotionDateRangeLabel(promotion);

                return (
                  <span key={`${copy}-${promotion.id}`} className="inline-flex items-center gap-2">
                    {upcoming ? (
                      <span className="rounded-full bg-white/15 px-2 py-0.5 text-[9px] tracking-[0.2em] text-white/80">
                        Próximamente
                      </span>
                    ) : null}
                    <span>{promotion.title}</span>
                    {discount ? (
                      <>
                        <span aria-hidden>·</span>
                        <span className="text-[var(--brand-accent)]">{discount}</span>
                      </>
                    ) : null}
                    {dates ? (
                      <>
                        <span aria-hidden>·</span>
                        <span>{dates}</span>
                      </>
                    ) : null}
                  </span>
                );
              })}

              <span className="inline-flex items-center gap-1.5 text-white/70 transition-colors group-hover:text-white">
                Ver promociones
                <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </div>
          ))}
        </div>
      </Link>
    </div>
  );
}
