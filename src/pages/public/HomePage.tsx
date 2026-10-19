import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import HeroSection from '../../components/home/HeroSection';
import AvailabilityBar from '../../components/home/AvailabilityBar';
import HotelShowcaseSection from '../../components/home/HotelShowcaseSection';
import BookingSection from '../../components/home/BookingSection';
import AmenitiesSection from '../../components/home/AmenitiesSection';
import RoomsSection from '../../components/home/RoomsSection';
import AttractionsSection from '../../components/home/AttractionsSection';
import CommentsSection from '../../components/home/CommentsSection';
import HomeBlocksSection, { parseHomeBlocks } from '../../components/home/HomeBlocksSection';
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
      <HomeBlocksSection blocks={blocks} after="hero" />
      <AvailabilityBar />
      <HomeBlocksSection blocks={blocks} after="availability" />
      <HotelShowcaseSection />
      <HomeBlocksSection blocks={blocks} after="showcase" />
      <AmenitiesSection />
      <HomeBlocksSection blocks={blocks} after="amenities" />
      <RoomsSection />
      <HomeBlocksSection blocks={blocks} after="rooms" />
      <BookingSection />
      <HomeBlocksSection blocks={blocks} after="booking" />
      <AttractionsSection />
      <HomeBlocksSection blocks={blocks} after="attractions" />
      <CommentsSection />
      <HomeBlocksSection blocks={blocks} after="comments" />
    </main>
  );
}
