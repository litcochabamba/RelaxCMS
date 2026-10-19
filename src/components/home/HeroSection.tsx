import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useHotelConfig, useHotels } from '../../hooks/useQueries';
import type { HeroSlide, Hotel } from '../../types';

/** Desplazamiento horizontal del bloque de contenido del hero, en px. */
export const DEFAULT_HERO_CONTENT_OFFSET_X = 0;

export function parseHeroOffsetX(value?: string | number | null): number {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(value ?? '');
  if (!Number.isFinite(parsed)) return DEFAULT_HERO_CONTENT_OFFSET_X;
  return Math.max(-160, Math.min(600, parsed));
}

// Demo data - in production this comes from Supabase
const demoSlides = [
  {
    id: '1',
    image_url: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1920&q=80',
    image_mobile_url: null as string | null,
    video_url: 'https://noaatcpccjukhrzukcet.supabase.co/storage/v1/object/public/hero-videos/hero-video-demo.mp4',
    video_mobile_url: null as string | null,
    title: 'Bienvenido al Paraíso',
    description: 'Disfruta de una estancia inolvidable en el corazón de Cochabamba. Servicio de clase mundial, habitaciones de lujo y una experiencia que superará tus expectativas.',
    button_text: 'Reservar Ahora',
    duration: 8,
  },
  {
    id: '2',
    image_url: 'https://images.unsplash.com/photo-1582719508461-905c673771fd?w=1920&q=80',
    image_mobile_url: null as string | null,
    video_url: null as string | null,
    video_mobile_url: null as string | null,
    title: 'Habitaciones de Lujo',
    description: 'Cada habitación está diseñada para brindarte el máximo confort. Descansa en camas premium con ropa de cama de primera calidad.',
    button_text: 'Ver Habitaciones',
    duration: 6,
  },
  {
    id: '3',
    image_url: 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=1920&q=80',
    image_mobile_url: null as string | null,
    video_url: null as string | null,
    video_mobile_url: null as string | null,
    title: 'Experiencia Única',
    description: 'Desde spas de lujo hasta restaurantes gourmet. Creamos experiencias que recordarás para siempre.',
    button_text: 'Descubrir Más',
    duration: 6,
  },
];

interface HeroSectionProps {
  slides?: HeroSlide[];
}

// El hero usa los medios horizontales en escritorio y los verticales en móvil.
function useIsMobileViewport() {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches
  );

  useEffect(() => {
    const query = window.matchMedia('(max-width: 767px)');
    const handleChange = (event: MediaQueryListEvent) => setIsMobile(event.matches);
    query.addEventListener('change', handleChange);
    return () => query.removeEventListener('change', handleChange);
  }, []);

  return isMobile;
}

export default function HeroSection({ slides: propSlides }: HeroSectionProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const isMobile = useIsMobileViewport();

  const { data: hotels } = useHotels();
  const hotelId = (hotels as Hotel[] | null)?.[0]?.id || '';
  const { data: configs = [] } = useHotelConfig(hotelId);
  const configList = (Array.isArray(configs) ? configs : []) as Array<{ key: string; value: string }>;
  const offsetX = parseHeroOffsetX(configList.find((config) => config.key === 'hero_content_offset_x')?.value);

  const slides = (propSlides && propSlides.length > 0) ? propSlides : demoSlides;

  const goToSlide = useCallback((index: number) => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    setCurrentSlide(index);
    setTimeout(() => setIsTransitioning(false), 1000);
  }, [isTransitioning]);

  useEffect(() => {
    const duration = (slides[currentSlide] as any)?.duration || 6;
    const interval = setInterval(() => {
      goToSlide((currentSlide + 1) % slides.length);
    }, duration * 1000);
    return () => clearInterval(interval);
  }, [currentSlide, goToSlide, slides.length, slides]);

  const slide = slides[currentSlide];
  const videoUrl = isMobile
    ? slide.video_mobile_url || slide.video_url
    : slide.video_url;
  const imageUrl = isMobile
    ? slide.image_mobile_url || slide.image_url
    : slide.image_url;

  return (
    <section className="relative h-screen min-h-[700px] overflow-hidden">
      {/* Background images with Ken Burns effect */}
      <AnimatePresence mode="sync">
        <motion.div
          key={currentSlide}
          className="absolute inset-0"
          initial={{ opacity: 0, scale: 1.1 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 1.2, ease: 'easeInOut' }}
        >
          {videoUrl ? (
            /* Optimized video background with progressive streaming */
            <video
              key={videoUrl}
              className="absolute inset-0 w-full h-full object-cover"
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              poster={imageUrl}
            >
              <source
                src={videoUrl}
                type="video/mp4"
              />
            </video>
          ) : (
            /* Image background with Ken Burns effect */
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: `url(${imageUrl})` }}
            >
              <motion.div
                key={imageUrl}
                className="absolute inset-0"
                animate={{
                  scale: [1, 1.08, 1],
                }}
                transition={{
                  duration: 8,
                  repeat: Infinity,
                  ease: 'linear',
                }}
                style={{
                  backgroundImage: `url(${imageUrl})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }}
              />
            </div>
          )}
          {/* Dark overlay */}
          <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/30 to-transparent" />
        </motion.div>
      </AnimatePresence>

      {/* Content */}
      <div className="relative z-10 h-full flex items-center">
        <div className="container-wide w-full">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentSlide}
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              className="max-w-2xl"
              // La variable CSS permite la vista previa en vivo desde el CMS;
              // sin ella se usa el valor guardado en la configuración.
              style={{ marginLeft: `clamp(-32px, var(--hero-content-offset-x, ${offsetX}px), 24vw)` }}
            >
              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.8 }}
                className="text-5xl md:text-7xl lg:text-8xl font-serif text-white font-light leading-[1.1] mb-6"
              >
                {slide.title}
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6, duration: 0.8 }}
                className="text-white/70 text-lg leading-relaxed mb-10 max-w-xl"
              >
                {slide.description}
              </motion.p>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8, duration: 0.6 }}
              >
                <a
                  href="#reservar"
                  className="inline-block px-8 py-4 bg-white text-gray-900 font-semibold text-sm tracking-wider uppercase hover:bg-white/90 transition-all duration-300 hover:shadow-lg hover:shadow-white/20"
                >
                  {slide.button_text}
                </a>
              </motion.div>
            </motion.div>
          </AnimatePresence>

        </div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10"
        animate={{ y: [0, 8, 0] }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        <div className="w-6 h-10 border-2 border-white/30 rounded-full flex items-start justify-center p-2">
          <motion.div
            className="w-1 h-2 bg-white/60 rounded-full"
            animate={{ y: [0, 12, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        </div>
      </motion.div>
    </section>
  );
}
