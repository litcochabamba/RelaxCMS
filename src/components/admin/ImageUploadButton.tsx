import { useRef, useState } from 'react';
import { Loader2, Upload } from 'lucide-react';
import toast from 'react-hot-toast';
import { uploadCloudinaryImage } from '../../api/client';

interface ImageUploadButtonProps {
  onUploaded: (url: string) => void;
  label?: string;
  folder?: string;
  disabled?: boolean;
  className?: string;
  /** Vacío para que el formulario que lo usa muestre su propio mensaje. */
  successMessage?: string;
}

/**
 * Abre el selector de archivos, sube la imagen a Cloudinary y entrega la URL
 * segura. La firma la genera el backend; el API secret no está en el navegador.
 */
export default function ImageUploadButton({
  onUploaded,
  label = 'Subir imagen',
  folder = 'relaxweb/galeria',
  disabled = false,
  className = '',
  successMessage = 'Imagen subida',
}: ImageUploadButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    const { upload, error } = await uploadCloudinaryImage(file, folder);
    setUploading(false);
    if (inputRef.current) inputRef.current.value = '';

    if (error || !upload) {
      toast.error(error || 'No se pudo subir la imagen');
      return;
    }
    onUploaded(upload.url);
    if (successMessage) toast.success(successMessage);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={disabled || uploading}
        className={`inline-flex items-center justify-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 transition-colors hover:border-gray-300 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      >
        {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
        {uploading ? 'Subiendo...' : label}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => void handleFile(event.target.files?.[0])}
      />
    </>
  );
}
