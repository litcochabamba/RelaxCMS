-- ============================================
-- Hero: variantes de medio por orientación
-- ============================================
-- El panel CMS permite elegir archivos de public/hero (imágenes y videos,
-- en versión horizontal para escritorio y vertical para móvil).
--   image_url         -> imagen horizontal (escritorio)  [ya existía]
--   image_mobile_url  -> imagen vertical (móvil)
--   video_url         -> video horizontal (escritorio)
--   video_mobile_url  -> video vertical (móvil)
-- Todas las columnas nuevas son opcionales: si están vacías el hero usa la
-- versión horizontal como respaldo, y las URLs manuales siguen funcionando.

ALTER TABLE public.hero_slides
  ADD COLUMN IF NOT EXISTS image_mobile_url TEXT,
  ADD COLUMN IF NOT EXISTS video_url        TEXT,
  ADD COLUMN IF NOT EXISTS video_mobile_url TEXT;

COMMENT ON COLUMN public.hero_slides.image_mobile_url IS 'Imagen vertical para móvil';
COMMENT ON COLUMN public.hero_slides.video_url        IS 'Video horizontal para escritorio';
COMMENT ON COLUMN public.hero_slides.video_mobile_url IS 'Video vertical para móvil';
