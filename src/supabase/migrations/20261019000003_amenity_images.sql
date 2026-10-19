-- Foto de la amenidad (Cloudinary: relaxweb/amenidades).
-- Es opcional: las amenidades sin foto conservan la tarjeta de solo texto.
ALTER TABLE public.amenidades
  ADD COLUMN IF NOT EXISTS image_url TEXT;
