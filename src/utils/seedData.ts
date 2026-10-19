import { db } from '../api/client';
import type { HeroSlide } from '../types';

export const DEMO_HERO_SLIDES: Omit<HeroSlide, 'id' | 'created_at' | 'updated_at'>[] = [
  {
    hotel_id: '', // Will be filled dynamically
    image_url: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1920&q=80',
    title: 'Bienvenido al Paraíso',
    description: 'Disfruta de una estancia inolvidable en el corazón de Cochabamba. Servicio de clase mundial, habitaciones de lujo y una experiencia que superará tus expectativas.',
    button_text: 'Reservar Ahora',
    button_link: null,
    duration: 6,
    order: 0,
    active: true,
  },
  {
    hotel_id: '',
    image_url: 'https://images.unsplash.com/photo-1582719508461-905c673771fd?w=1920&q=80',
    title: 'Habitaciones de Lujo',
    description: 'Cada habitación está diseñada para brindarte el máximo confort. Descansa en camas premium con ropa de cama de primera calidad.',
    button_text: 'Ver Habitaciones',
    button_link: null,
    duration: 6,
    order: 1,
    active: true,
  },
  {
    hotel_id: '',
    image_url: 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=1920&q=80',
    title: 'Experiencia Única',
    description: 'Desde spas de lujo hasta restaurantes gourmet. Creamos experiencias que recordarás para siempre.',
    button_text: 'Descubrir Más',
    button_link: null,
    duration: 6,
    order: 2,
    active: true,
  },
];

export async function seedHeroSlides(hotelId: string): Promise<{ success: boolean; count: number; error?: string }> {
  if (!hotelId) {
    return { success: false, count: 0, error: 'No hay hotel seleccionado' };
  }

  let insertedCount = 0;

  for (const slide of DEMO_HERO_SLIDES) {
    const { error } = await db.insert('hero_slides', {
      ...slide,
      hotel_id: hotelId,
    });

    if (error) {
      return { success: false, count: insertedCount, error };
    }
    insertedCount++;
  }

  return { success: true, count: insertedCount };
}
