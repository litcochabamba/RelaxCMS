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
import { useAuthStore } from '../../store/authStore';
import DesignHero from '../../components/home/designs/DesignHero';
import { DesignDivider, DesignSwitcher } from '../../components/home/designs/DesignParts';
import { useDesignFonts, useDesignRootMarker, useHomeDesign } from '../../components/home/designs/registry';
import '../../components/home/designs/designs.css';

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
  // Modelo de diseño de la portada: solo cambia la presentación.
  const { design, select, switcherEnabled } = useHomeDesign(
    configs.find((config) => config.key === 'home_design')?.value
  );
  const { user } = useAuthStore();
  const isStaff = user?.role === 'admin' || user?.role === 'moderator';
  useDesignFonts(design.fonts);
  useDesignRootMarker(design);
  const isClassic = design.id === 'clasico';
  const divider = (label: string) => (isClassic ? null : <DesignDivider design={design.id} label={label} />);

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
    <main className={isClassic ? undefined : `home-design home-design-${design.id}`}>
      {isClassic ? (
        <HeroSection slides={heroSlides.length > 0 ? heroSlides : undefined} />
      ) : (
        <DesignHero design={design.id} slides={heroSlides} />
      )}
      {isClassic ? <AvailabilityBar /> : <div className="dz-availability"><AvailabilityBar /></div>}
      <HotelShowcaseSection />
      {ribbonPlacements.includes('showcase') && <PromotionsRibbon />}
      <HomeBlocksSection blocks={blocks} after="showcase" />
      {divider('Amenidades')}
      <AmenitiesSection />
      {ribbonPlacements.includes('amenities') && <PromotionsRibbon />}
      <HomeBlocksSection blocks={blocks} after="amenities" />
      {divider('Habitaciones')}
      <RoomsSection />
      {ribbonPlacements.includes('rooms') && <PromotionsRibbon />}
      <HomeBlocksSection blocks={blocks} after="rooms" />
      {divider('Reservas')}
      <BookingSection />
      {ribbonPlacements.includes('booking') && <PromotionsRibbon />}
      <HomeBlocksSection blocks={blocks} after="booking" />
      {divider('Atractivos')}
      {isClassic ? <AttractionsSection /> : <div id="atractivos" className="scroll-mt-20"><AttractionsSection /></div>}
      {ribbonPlacements.includes('attractions') && <PromotionsRibbon />}
      <HomeBlocksSection blocks={blocks} after="attractions" />
      {divider('Huéspedes')}
      <CommentsSection />
      {ribbonPlacements.includes('comments') && <PromotionsRibbon />}
      <HomeBlocksSection blocks={blocks} after="comments" />
      {(switcherEnabled || isStaff) && <DesignSwitcher active={design} onSelect={select} />}
    </main>
  );
}
