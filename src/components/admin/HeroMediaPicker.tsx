import { Check, Film, Loader2 } from 'lucide-react';
import { useHeroMedia, type HeroMedia } from '../../hooks/useHeroMedia';

export type HeroMediaField =
  | 'image_url'
  | 'image_mobile_url'
  | 'video_url'
  | 'video_mobile_url';

export interface HeroMediaValues {
  image_url?: string;
  image_mobile_url?: string;
  video_url?: string;
  video_mobile_url?: string;
}

interface HeroMediaPickerProps {
  values: HeroMediaValues;
  onSelect: (field: HeroMediaField, url: string) => void;
}

interface MediaGroup {
  title: string;
  hint: string;
  kind: 'images' | 'videos';
  orientation: 'horizontal' | 'vertical';
  field: HeroMediaField;
}

const GROUPS: MediaGroup[] = [
  { title: 'Videos horizontal', hint: 'Escritorio', kind: 'videos', orientation: 'horizontal', field: 'video_url' },
  { title: 'Video vertical', hint: 'Móvil', kind: 'videos', orientation: 'vertical', field: 'video_mobile_url' },
  { title: 'Imágenes horizontal', hint: 'Escritorio', kind: 'images', orientation: 'horizontal', field: 'image_url' },
  { title: 'Imágenes vertical', hint: 'Móvil', kind: 'images', orientation: 'vertical', field: 'image_mobile_url' },
];

function groupItems(media: HeroMedia, group: MediaGroup) {
  return media[group.kind][group.orientation];
}

function SlotMedia({ videoUrl, imageUrl }: { videoUrl?: string; imageUrl?: string }) {
  if (videoUrl) {
    return <video src={videoUrl} muted loop playsInline preload="metadata" className="w-full h-full object-cover" />;
  }
  if (imageUrl) {
    return <img src={imageUrl} alt="Vista previa" className="w-full h-full object-cover" />;
  }
  return <span className="text-[10px] text-gray-400">Sin medio</span>;
}

/** Vista previa del medio que se verá en escritorio y en móvil. */
export function SlideMediaPreview({ values }: { values: HeroMediaValues }) {
  const mobileUsesOwnMedia = !!(values.video_mobile_url || values.image_mobile_url);

  return (
    <div className="flex gap-3">
      <div className="flex-1 min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">Escritorio</p>
        <div className="relative aspect-video rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center">
          <SlotMedia videoUrl={values.video_url} imageUrl={values.image_url} />
        </div>
      </div>
      <div className="w-20 flex-shrink-0">
        <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">Móvil</p>
        <div className="relative aspect-[9/16] rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center">
          {mobileUsesOwnMedia ? (
            <SlotMedia videoUrl={values.video_mobile_url} imageUrl={values.image_mobile_url} />
          ) : (
            <SlotMedia videoUrl={values.video_url} imageUrl={values.image_url} />
          )}
        </div>
      </div>
    </div>
  );
}

export default function HeroMediaPicker({ values, onSelect }: HeroMediaPickerProps) {
  const { media, isLoading } = useHeroMedia();
  const visibleGroups = GROUPS.filter((group) => groupItems(media, group).length > 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-4 text-sm text-gray-500">
        <Loader2 className="w-4 h-4 animate-spin" />
        Buscando archivos en public/hero...
      </div>
    );
  }

  if (visibleGroups.length === 0) {
    return (
      <p className="text-xs text-gray-400 py-2">
        No hay archivos en public/hero/images ni public/hero/videos. Puedes seguir usando una URL manual.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      {visibleGroups.map((group) => {
        const items = groupItems(media, group);
        const selected = values[group.field] || '';

        return (
          <div key={group.field}>
            <div className="flex items-baseline gap-2 mb-2">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{group.title}</p>
              <span className="text-[10px] text-gray-400 uppercase tracking-wider">{group.hint}</span>
              <span className="text-[10px] text-gray-400 ml-auto">{items.length}</span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {items.map((item) => {
                const isSelected = selected === item.url;
                return (
                  <button
                    key={item.url}
                    type="button"
                    onClick={() => onSelect(group.field, isSelected ? '' : item.url)}
                    title={isSelected ? `${item.name} (clic para quitar)` : item.name}
                    className={`relative group rounded-lg overflow-hidden border-2 transition-all ${
                      isSelected ? 'border-gray-900 ring-2 ring-gray-900/10' : 'border-transparent hover:border-gray-300'
                    }`}
                  >
                    <div className="aspect-video bg-gray-100 flex items-center justify-center overflow-hidden">
                      {group.kind === 'images' ? (
                        <img src={item.url} alt={item.name} className="w-full h-full object-cover" loading="lazy" />
                      ) : (
                        <div className="relative w-full h-full">
                          <video src={item.url} muted preload="metadata" className="w-full h-full object-cover" />
                          <Film className="absolute bottom-1 right-1 w-3 h-3 text-white drop-shadow" />
                        </div>
                      )}
                    </div>
                    <span className="block px-1 py-1 text-[10px] text-gray-500 truncate bg-white">{item.name}</span>
                    {isSelected && (
                      <span className="absolute top-1 right-1 w-5 h-5 rounded-full bg-gray-900 text-white flex items-center justify-center">
                        <Check className="w-3 h-3" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
