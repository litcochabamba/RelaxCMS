import type { Promotion } from '../types';

/** Fecha corta dd/mm/aaaa para las tarjetas y la cinta. */
export function formatPromotionDate(value: string | null | undefined): string {
  if (!value) return '';
  const [year, month, day] = value.slice(0, 10).split('-');
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

function startOfDay(value?: string | null): Date | null {
  if (!value) return null;
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function endOfDay(value?: string | null): Date | null {
  if (!value) return null;
  const date = new Date(`${value.slice(0, 10)}T23:59:59`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfToday(now = new Date()): Date {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  return today;
}

/** La promoción todavía no empezó. */
export function isPromotionUpcoming(promotion: Promotion, now = new Date()): boolean {
  const start = startOfDay(promotion.start_date);
  return !!start && startOfToday(now) < start;
}

/** La promoción ya terminó y no debe mostrarse. */
export function hasPromotionEnded(promotion: Promotion, now = new Date()): boolean {
  const end = endOfDay(promotion.end_date);
  return !!end && startOfToday(now) > end;
}

/** Está dentro de su rango de fechas (o no tiene fecha de inicio). */
export function isPromotionCurrent(promotion: Promotion, now = new Date()): boolean {
  if (hasPromotionEnded(promotion, now)) return false;
  const start = startOfDay(promotion.start_date);
  return !start || startOfToday(now) >= start;
}

/** Texto del descuento: "50% OFF" o "Bs. 50 menos". */
export function promotionDiscountLabel(promotion: Promotion): string {
  if (promotion.discount_percent) {
    const value = Number(promotion.discount_percent);
    if (Number.isFinite(value) && value > 0) {
      return `${value.toLocaleString('es-BO', { maximumFractionDigits: 1 })}% OFF`;
    }
  }
  if (promotion.discount_amount) {
    const value = Number(promotion.discount_amount);
    if (Number.isFinite(value) && value > 0) {
      return `Bs. ${value.toLocaleString('es-BO', { maximumFractionDigits: 0 })} menos`;
    }
  }
  return '';
}

/**
 * La cinta automática de promociones se repite entre secciones. El espacio
 * entre el hero y la sección de Información queda excluido a propósito.
 */
export const PROMO_RIBBON_PLACEMENTS = [
  'showcase',
  'amenities',
  'rooms',
  'booking',
  'attractions',
  'comments',
] as const;

export type PromoRibbonPlacement = (typeof PROMO_RIBBON_PLACEMENTS)[number];

/** Dos apariciones por defecto; el panel permite sumar una tercera. */
export const DEFAULT_PROMO_RIBBON_PLACEMENTS: PromoRibbonPlacement[] = ['showcase', 'rooms'];

export const MAX_PROMO_RIBBONS = 3;

function isPromoRibbonPlacement(value: unknown): value is PromoRibbonPlacement {
  return typeof value === 'string' && (PROMO_RIBBON_PLACEMENTS as readonly string[]).includes(value);
}

/**
 * Lee `promo_ribbon_placements` de la configuración. Un arreglo vacío significa
 * que el personal la ocultó; un valor ausente o inválido usa los valores por
 * defecto.
 */
export function parsePromoRibbonPlacements(raw?: string | null): PromoRibbonPlacement[] {
  if (!raw || !raw.trim()) return [...DEFAULT_PROMO_RIBBON_PLACEMENTS];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [...DEFAULT_PROMO_RIBBON_PLACEMENTS];
    const placements = Array.from(new Set(parsed.filter(isPromoRibbonPlacement))).slice(
      0,
      MAX_PROMO_RIBBONS
    );
    return placements;
  } catch {
    return [...DEFAULT_PROMO_RIBBON_PLACEMENTS];
  }
}

export function promotionDateRangeLabel(promotion: Promotion): string {
  const start = formatPromotionDate(promotion.start_date);
  const end = formatPromotionDate(promotion.end_date);
  if (start && end) return `${start} — ${end}`;
  return start || end;
}
