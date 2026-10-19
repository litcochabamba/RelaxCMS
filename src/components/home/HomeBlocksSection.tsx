import { Link } from 'react-router-dom';
import type { HomeBlock, HomeBlockPlacement } from '../../types';

export const PLACEMENT_LABELS: Record<HomeBlockPlacement, string> = {
  hero: 'Hero',
  availability: 'Barra de disponibilidad',
  showcase: 'Información',
  amenities: 'Amenidades',
  rooms: 'Habitaciones',
  booking: 'Reservas',
  attractions: 'Atractivos',
  comments: 'Comentarios',
};

const PLACEMENTS = Object.keys(PLACEMENT_LABELS) as HomeBlockPlacement[];

export function defaultBlock(kind: HomeBlock['kind'], after: HomeBlockPlacement): HomeBlock {
  return {
    id: `bloque-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    kind,
    after,
    title: kind === 'aviso' ? 'Ofertas de temporada' : 'Novedades del hotel',
    text:
      kind === 'aviso'
        ? 'Descubrí las promociones vigentes y reservá con precio especial.'
        : 'Descuentos y paquetes vigentes · Consultá en recepción',
    image_url: '',
    height: kind === 'aviso' ? 340 : 56,
    bg: kind === 'aviso' ? '#1a1a2e' : '#d4af37',
    fg: kind === 'aviso' ? '#ffffff' : '#1a1a2e',
    button_label: 'Ir a promociones',
    button_href: '/promociones',
    speed: kind === 'cinta' ? 22 : 0,
    active: true,
  };
}

/**
 * Lee `home_blocks` de la configuración. Tolera valores viejos o corruptos:
 * cualquier bloque inválido se descarta en lugar de romper la página.
 */
export function parseHomeBlocks(value?: string | null): HomeBlock[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
      .map((item, index) => {
        const kind = item.kind === 'cinta' ? 'cinta' : 'aviso';
        const after = PLACEMENTS.includes(item.after as HomeBlockPlacement)
          ? (item.after as HomeBlockPlacement)
          : 'hero';
        const height = Number(item.height);
        const speed = Number(item.speed);
        return {
          id: typeof item.id === 'string' && item.id ? item.id : `bloque-${index}`,
          kind,
          after,
          title: typeof item.title === 'string' ? item.title : '',
          text: typeof item.text === 'string' ? item.text : '',
          image_url: typeof item.image_url === 'string' ? item.image_url : '',
          height: Number.isFinite(height) ? Math.min(Math.max(height, 120), 1200) : 340,
          bg: typeof item.bg === 'string' && item.bg ? item.bg : '#1a1a2e',
          fg: typeof item.fg === 'string' && item.fg ? item.fg : '#ffffff',
          button_label: typeof item.button_label === 'string' ? item.button_label : '',
          button_href: typeof item.button_href === 'string' ? item.button_href : '',
          speed: Number.isFinite(speed) ? Math.min(Math.max(speed, 0), 120) : 0,
          active: item.active !== false,
        } satisfies HomeBlock;
      });
  } catch {
    return [];
  }
}

function BlockButton({ block }: { block: HomeBlock }) {
  if (!block.button_label.trim() || !block.button_href.trim()) return null;
  const className =
    'inline-flex items-center justify-center rounded-lg px-7 py-3 text-sm font-semibold uppercase tracking-wider transition-opacity hover:opacity-85';
  const style = { backgroundColor: block.fg, color: block.bg };

  if (/^https?:\/\//i.test(block.button_href)) {
    return (
      <a href={block.button_href} target="_blank" rel="noreferrer" className={className} style={style}>
        {block.button_label}
      </a>
    );
  }

  return (
    <Link to={block.button_href} className={className} style={style}>
      {block.button_label}
    </Link>
  );
}

function AvisoBlock({ block }: { block: HomeBlock }) {
  return (
    <section
      className="relative flex w-full items-center justify-center overflow-hidden"
      style={{ backgroundColor: block.bg, minHeight: block.height }}
    >
      {block.image_url ? (
        <>
          <img
            src={block.image_url}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            loading="lazy"
          />
          <div
            className="absolute inset-0"
            style={{ background: `linear-gradient(180deg, ${block.bg}99, ${block.bg}e6)` }}
          />
        </>
      ) : null}

      <div
        className="relative mx-auto flex w-full max-w-4xl flex-col items-center justify-center gap-4 px-6 py-14 text-center"
        style={{ color: block.fg, minHeight: block.height }}
      >
        {block.title ? <h2 className="font-serif text-3xl md:text-5xl">{block.title}</h2> : null}
        {block.text ? (
          <p className="max-w-2xl text-base leading-relaxed opacity-90 md:text-lg">{block.text}</p>
        ) : null}
        <BlockButton block={block} />
      </div>
    </section>
  );
}

function CintaBlock({ block }: { block: HomeBlock }) {
  const content = block.text || block.title;
  if (!content) return null;

  if (block.speed <= 0) {
    return (
      <div
        className="w-full px-6 py-3 text-center text-sm font-medium uppercase tracking-[0.18em]"
        style={{ backgroundColor: block.bg, color: block.fg }}
      >
        {content}
      </div>
    );
  }

  return (
    <div
      className="flex w-full overflow-hidden py-3"
      style={{ backgroundColor: block.bg, color: block.fg }}
      role="marquee"
    >
      {[0, 1].map((copy) => (
        <div
          key={copy}
          aria-hidden={copy === 1}
          className="animate-marquee flex shrink-0 items-center gap-10 whitespace-nowrap pl-10 text-sm font-medium uppercase tracking-[0.18em]"
          style={{ animationDuration: `${block.speed}s` }}
        >
          <span>{content}</span>
          {block.title && block.title !== content ? <span aria-hidden>·</span> : null}
          {block.title && block.title !== content ? <span>{block.title}</span> : null}
          <span aria-hidden>·</span>
        </div>
      ))}
    </div>
  );
}

/** Bloques activos ubicados después de una sección concreta de la home. */
export default function HomeBlocksSection({
  blocks,
  after,
}: {
  blocks: HomeBlock[];
  after: HomeBlockPlacement;
}) {
  const visible = blocks.filter((block) => block.active && block.after === after);
  if (visible.length === 0) return null;

  return (
    <>
      {visible.map((block) =>
        block.kind === 'cinta' ? (
          <CintaBlock key={block.id} block={block} />
        ) : (
          <AvisoBlock key={block.id} block={block} />
        )
      )}
    </>
  );
}
