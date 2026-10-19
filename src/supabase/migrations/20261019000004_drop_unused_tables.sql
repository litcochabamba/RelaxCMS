-- =====================================================================
-- 20261019000004_drop_unused_tables
-- =====================================================================
--
-- Retira las tablas del CMS que quedaron sin uso al pasar el catálogo de
-- habitaciones al PMS y al descartar funciones que nunca llegaron al panel:
--
--   roles                 → el rol vive en usuarios.role / clientes
--   newsletter            → no hay formulario ni envío de newsletter
--   seo_config            → el SEO se resuelve en el HTML, sin tabla
--   habitacion_imagenes   → las imágenes viven en el catálogo del PMS
--   booking_room_types    → reemplazada por tipos_habitacion
--   categorias_habitacion → reemplazada por tipos_habitacion.grupo
--   habitaciones          → reemplazada por tipos_habitacion/unidades_habitacion
--
-- Antes de borrar se guardó esquema + datos en:
--   src/supabase/legacy/20261019-tablas-obsoletas.sql
--
-- Es idempotente: DROP TABLE IF EXISTS ... CASCADE.
-- =====================================================================

DROP TABLE IF EXISTS public.habitacion_imagenes   CASCADE;
DROP TABLE IF EXISTS public.habitaciones          CASCADE;
DROP TABLE IF EXISTS public.categorias_habitacion CASCADE;
DROP TABLE IF EXISTS public.booking_room_types    CASCADE;
DROP TABLE IF EXISTS public.seo_config            CASCADE;
DROP TABLE IF EXISTS public.newsletter            CASCADE;
DROP TABLE IF EXISTS public.roles                 CASCADE;

-- La portada ya no elige "tipos principales" desde `habitaciones`: el orden
-- lo define `tipos_habitacion.order`. Se retira la clave que guardaba esos ids.
DELETE FROM public.configuracion_hotel WHERE key = 'rooms_featured_ids';
