import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import HeroSection from '../../components/home/HeroSection';
import AvailabilityBar from '../../components/home/AvailabilityBar';
import PromotionsRibbon from '../../components/home/PromotionsRibbon';
import HotelShowcaseSection from '../../components/home/HotelShowcaseSection';
import BookingSection from '../../components/home/BookingSection';
import AmenitiesSection from '../../components/home/AmenitiesSection';
import RoomsSection from '../../components/home/RoomsSection';
import AttractionsSection from '../../components/home/AttractionsSection';
import CommentsSection from '../../components/home/CommentsSection';
import HomeBlocksSection, { parseHomeBlocks } from '../../components/home/HomeBlocksSection';
import { parsePromoRibbonPlacements } from '../../utils/promotions';
import { useHotelConfig, useHotels, useHeroSlides } from '../../hooks/useQueries';

export default function HomePage() {
  const { hash } = useLocation();
  const { data: hotels } = useHotels();
  const hotelId = hotels?.[0]?.id || '';
  const { data: heroSlides = [] } = useHeroSlides(hotelId);
  const { data: configsData = [] } = useHotelConfig(hotelId);

  // Avisos y cintas entre secciones: se editan desde el panel flotante y se
  // guardan como JSON en la configuración del hotel.
  const configs = (Array.isArray(configsData) ? configsData : []) as Array<{ key: string; value: string }>;
  const blocks = parseHomeBlocks(configs.find((config) => config.key === 'home_blocks')?.value);
  // La cinta de promociones se repite entre secciones (2 o 3 veces). Nunca se
  // muestra entre el hero y la sección de Información.
  const ribbonPlacements = parsePromoRibbonPlacements(
    configs.find((config) => config.key === 'promo_ribbon_placements')?.value
  );

  // La reserva rápida del panel del cliente llega como `/#reservar`. Las
  // imágenes de arriba terminan de cargar después del primer scroll y corren la
  // sección, así que se vuelve a ubicar un par de veces.
  useEffect(() => {
    if (hash !== '#reservar') return;
    const align = (smooth: boolean) => {
      const section = document.getElementById('reservar');
      if (!section) return;
      const top = section.getBoundingClientRect().top;
      if (top < 0 || top > 140) {
        section.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' });
      }
    };
    const timers = [
      window.setTimeout(() => align(true), 200),
      window.setTimeout(() => align(false), 1200),
      window.setTimeout(() => align(false), 2400),
    ];
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [hash]);

  return (
    <main>
      <HeroSection slides={heroSlides.length > 0 ? heroSlides : undefined} />
      <AvailabilityBar />
      <HotelShowcaseSection />
      {ribbonPlacements.includes('showcase') && <PromotionsRibbon />}
      <HomeBlocksSection blocks={blocks} after="showcase" />
      <AmenitiesSection />
      {ribbonPlacements.includes('amenities') && <PromotionsRibbon />}
      <HomeBlocksSection blocks={blocks} after="amenities" />
      <RoomsSection />
      {ribbonPlacements.includes('rooms') && <PromotionsRibbon />}
      <HomeBlocksSection blocks={blocks} after="rooms" />
      <BookingSection />
      {ribbonPlacements.includes('booking') && <PromotionsRibbon />}
      <HomeBlocksSection blocks={blocks} after="booking" />
      <AttractionsSection />
      {ribbonPlacements.includes('attractions') && <PromotionsRibbon />}
      <HomeBlocksSection blocks={blocks} after="attractions" />
      <CommentsSection />
      {ribbonPlacements.includes('comments') && <PromotionsRibbon />}
      <HomeBlocksSection blocks={blocks} after="comments" />
    </main>
  );
}
