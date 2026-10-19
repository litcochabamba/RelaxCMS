import { Check, Film, Loader2 } from 'lucide-react';
import { useFolderMedia, type ImageFolder, type HeroMediaItem } from '../../hooks/useHeroMedia';
import { isVideoUrl } from '../common/Media';

interface ImageFolderPickerProps {
  selectedUrl?: string;
  onSelect: (url: string) => void;
  source?: ImageFolder;
  title?: string;
  emptyHint?: string;
}

function isVideo(item: HeroMediaItem): boolean {
  return item.type === 'video' || isVideoUrl(item.url);
}

function MediaThumb({ item }: { item: HeroMediaItem }) {
  if (!isVideo(item)) {
    return <img src={item.url} alt={item.name} className="w-full h-full object-cover" loading="lazy" />;
  }

  return (
    <div className="relative w-full h-full">
      <video src={item.url} muted loop autoPlay playsInline preload="metadata" className="w-full h-full object-cover" />
      <Film className="absolute bottom-1 right-1 w-3 h-3 text-white drop-shadow" />
    </div>
  );
}

/**
 * Muestra los archivos de una carpeta de public/ (gallery o info) para
 * asignarlos a un campo. public/info incluye tanto imágenes como videos.
 * Si la carpeta está vacía no pinta nada: queda la URL manual.
 */
export default function ImageFolderPicker({
  selectedUrl,
  onSelect,
  source = 'gallery',
  title = 'Archivos en carpeta',
  emptyHint,
}: ImageFolderPickerProps) {
  const { items, isLoading } = useFolderMedia(source);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-3 text-sm text-gray-500">
        <Loader2 className="w-4 h-4 animate-spin" />
        Buscando archivos en public/{source}...
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <p className="text-xs text-gray-400 py-1">
        {emptyHint || `No hay archivos en public/${source}. Puedes seguir usando una URL manual.`}
      </p>
    );
  }

  const images = items.filter((item) => !isVideo(item));
  const videos = items.filter(isVideo);

  const renderGroup = (group: HeroMediaItem[]) => (
    <div className="grid grid-cols-3 gap-2">
      {group.map((item) => {
        const isSelected = selectedUrl === item.url;
        return (
          <button
            key={item.url}
            type="button"
            onClick={() => onSelect(isSelected ? '' : item.url)}
            title={isSelected ? `${item.name} (clic para quitar)` : item.name}
            className={`relative group rounded-lg overflow-hidden border-2 transition-all ${
              isSelected ? 'border-gray-900 ring-2 ring-gray-900/10' : 'border-transparent hover:border-gray-300'
            }`}
          >
            <div className="aspect-[4/3] bg-gray-100 flex items-center justify-center overflow-hidden">
              <MediaThumb item={item} />
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
  );

  return (
    <div className="space-y-3">
      <div className="flex items-baseline gap-2">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{title}</p>
        <span className="text-[10px] text-gray-400 uppercase tracking-wider">public/{source}</span>
        <span className="text-[10px] text-gray-400 ml-auto">{items.length}</span>
      </div>

      {images.length > 0 && renderGroup(images)}

      {videos.length > 0 && (
        <div>
          <div className="flex items-baseline gap-2 mb-2">
            <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">Videos</p>
            <span className="text-[10px] text-gray-400 ml-auto">{videos.length}</span>
          </div>
          {renderGroup(videos)}
        </div>
      )}
    </div>
  );
}
