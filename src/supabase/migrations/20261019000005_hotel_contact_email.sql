-- =====================================================================
-- 20261019000005_hotel_contact_email
-- =====================================================================
--
-- El correo de contacto público del hotel estaba con el valor de ejemplo
-- `info@hotel.com`. El footer y la sección de contacto lo leen de
-- `hoteles.email`, así que se corrige en la base.
--
-- Solo pisa el valor de ejemplo: si el hotel ya tiene un correo propio,
-- no se toca.
-- =====================================================================

UPDATE public.hoteles
   SET email = 'relaxhostal02@gmail.com',
       updated_at = NOW()
 WHERE slug = 'hostal-relax'
   AND (email IS NULL OR email = 'info@hotel.com');
