-- =====================================================================
-- 20261017000001_complete_schema
-- HOSTAL RELAX CMS — ESQUEMA COMPLETO (BASE PARA UN PROYECTO NUEVO)
-- Supabase / PostgreSQL 17
-- Actualizado: 2026-10-19
-- =====================================================================
--
-- Reemplaza la versión anterior de esta migración, que todavía creaba las
-- tablas roles, newsletter, seo_config, habitacion_imagenes,
-- booking_room_types, categorias_habitacion y habitaciones.
--
-- Estado que reproduce: 16 tablas, catálogo de habitaciones importado del
-- PMS (tipos_habitacion / unidades_habitacion), cuentas de clientes
-- separadas en clientes y límite de intentos de registro.
--
-- Es idempotente. Ejecutar en el SQL Editor de un proyecto Supabase vacío.
-- Para actualizar una base existente sin recrearla, usar las migraciones
-- incrementales en orden (la última es 20261019000005).
-- =====================================================================


-- =====================================================================
-- 0. EXTENSIONES
-- =====================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'extensions') THEN
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
    CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
  ELSE
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
    CREATE EXTENSION IF NOT EXISTS pgcrypto;
  END IF;
END;
$$;

SET search_path TO public, extensions;

-- =====================================================================
-- 1. FUNCIÓN AUXILIAR DE updated_at
-- =====================================================================
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- =====================================================================
-- 2. TABLAS
-- =====================================================================

-- ---------- hoteles ----------
CREATE TABLE IF NOT EXISTS public.hoteles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  phone TEXT,
  whatsapp TEXT,
  email TEXT,
  address TEXT,
  city TEXT,
  country TEXT DEFAULT 'Bolivia',
  logo_url TEXT,
  banner_url TEXT,
  primary_color TEXT DEFAULT '#8B0000',
  secondary_color TEXT DEFAULT '#1a1a2e',
  accent_color TEXT DEFAULT '#D4AF37',
  font_heading TEXT DEFAULT 'Playfair Display',
  font_body TEXT DEFAULT 'Inter',
  facebook TEXT,
  instagram TEXT,
  tiktok TEXT,
  latitude NUMERIC,
  longitude NUMERIC,
  timezone TEXT DEFAULT 'America/La_Paz',
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------- usuarios (personal del sistema: admin / moderator) ----------
CREATE TABLE IF NOT EXISTS public.usuarios (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  hotel_id UUID REFERENCES public.hoteles(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  email TEXT UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'client' CHECK (role IN ('admin', 'moderator', 'client')),
  avatar_url TEXT,
  active BOOLEAN DEFAULT true,
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  username TEXT UNIQUE
);

ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS username TEXT UNIQUE;
ALTER TABLE public.usuarios ALTER COLUMN email DROP NOT NULL;

-- ---------- clientes (cuentas del sitio público) ----------
CREATE TABLE IF NOT EXISTS public.clientes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  hotel_id UUID REFERENCES public.hoteles(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  username TEXT NOT NULL UNIQUE,
  email TEXT UNIQUE,
  phone TEXT,
  password_hash TEXT NOT NULL,
  notes TEXT,
  active BOOLEAN DEFAULT true,
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  country_iso TEXT,
  country_dial TEXT,
  country_name TEXT,
  gender TEXT,
  age INTEGER,
  profession TEXT
);

ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS country_iso TEXT,
  ADD COLUMN IF NOT EXISTS country_dial TEXT,
  ADD COLUMN IF NOT EXISTS country_name TEXT,
  ADD COLUMN IF NOT EXISTS gender TEXT,
  ADD COLUMN IF NOT EXISTS age INTEGER,
  ADD COLUMN IF NOT EXISTS profession TEXT;

-- ---------- configuración del hotel (clave/valor) ----------
CREATE TABLE IF NOT EXISTS public.configuracion_hotel (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  hotel_id UUID NOT NULL REFERENCES public.hoteles(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value TEXT,
  "group" TEXT DEFAULT 'general',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (hotel_id, key)
);

-- ---------- hero_slides ----------
CREATE TABLE IF NOT EXISTS public.hero_slides (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  hotel_id UUID NOT NULL REFERENCES public.hoteles(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  title TEXT NOT NULL,
  subtitle TEXT,
  description TEXT,
  button_text TEXT,
  button_link TEXT,
  "order" INTEGER DEFAULT 0,
  active BOOLEAN DEFAULT true,
  duration INTEGER DEFAULT 6,
  image_mobile_url TEXT,
  video_url TEXT,
  video_mobile_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.hero_slides
  ADD COLUMN IF NOT EXISTS duration INTEGER DEFAULT 6,
  ADD COLUMN IF NOT EXISTS image_mobile_url TEXT,
  ADD COLUMN IF NOT EXISTS video_url TEXT,
  ADD COLUMN IF NOT EXISTS video_mobile_url TEXT;

-- ---------- amenidades ----------
CREATE TABLE IF NOT EXISTS public.amenidades (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  hotel_id UUID NOT NULL REFERENCES public.hoteles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT,
  description TEXT,
  category TEXT DEFAULT 'general',
  value TEXT,
  "order" INTEGER DEFAULT 0,
  active BOOLEAN DEFAULT true,
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.amenidades ADD COLUMN IF NOT EXISTS image_url TEXT;

-- ---------- atractivos_turisticos ----------
CREATE TABLE IF NOT EXISTS public.atractivos_turisticos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  hotel_id UUID NOT NULL REFERENCES public.hoteles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  location TEXT,
  latitude NUMERIC,
  longitude NUMERIC,
  "order" INTEGER DEFAULT 0,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------- atractivo_imagenes ----------
CREATE TABLE IF NOT EXISTS public.atractivo_imagenes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  attraction_id UUID NOT NULL REFERENCES public.atractivos_turisticos(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  alt_text TEXT,
  "order" INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------- galeria ----------
CREATE TABLE IF NOT EXISTS public.galeria (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  hotel_id UUID NOT NULL REFERENCES public.hoteles(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  title TEXT,
  description TEXT,
  category TEXT DEFAULT 'general',
  alt_text TEXT,
  "order" INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------- reservas (solicitudes web) ----------
CREATE TABLE IF NOT EXISTS public.reservas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  hotel_id UUID NOT NULL REFERENCES public.hoteles(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  guest_name TEXT NOT NULL,
  guest_email TEXT,
  guest_phone TEXT NOT NULL,
  check_in DATE NOT NULL,
  check_out DATE NOT NULL,
  adults INTEGER DEFAULT 1,
  children_count INTEGER DEFAULT 0,
  room_type TEXT NOT NULL,
  message TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.reservas
  ADD COLUMN IF NOT EXISTS cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL;

-- ---------- consultas (formulario de contacto y consultas por promoción) ----------
CREATE TABLE IF NOT EXISTS public.consultas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  hotel_id UUID NOT NULL REFERENCES public.hoteles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  message TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'read', 'replied', 'archived')),
  admin_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------- comentarios / testimonios ----------
CREATE TABLE IF NOT EXISTS public.comentarios (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  hotel_id UUID NOT NULL REFERENCES public.hoteles(id) ON DELETE CASCADE,
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  content TEXT NOT NULL,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_reply TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.comentarios
  ADD COLUMN IF NOT EXISTS rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  ADD COLUMN IF NOT EXISTS cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL;

-- ---------- promociones ----------
CREATE TABLE IF NOT EXISTS public.promociones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  hotel_id UUID NOT NULL REFERENCES public.hoteles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  discount_percent NUMERIC(5,2),
  discount_amount NUMERIC(10,2),
  code TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  image_url TEXT,
  type TEXT DEFAULT 'discount' CHECK (type IN ('discount', 'event', 'package', 'seasonal')),
  active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------- tipos_habitacion (catálogo importado del PMS) ----------
CREATE TABLE IF NOT EXISTS public.tipos_habitacion (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id UUID NOT NULL REFERENCES public.hoteles(id) ON DELETE CASCADE,
  pms_id INTEGER UNIQUE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  grupo TEXT NOT NULL DEFAULT 'habitacion' CHECK (grupo IN ('habitacion', 'departamento')),
  description TEXT,
  image_url TEXT,
  min_capacity INTEGER,
  max_capacity INTEGER,
  price NUMERIC,
  "order" INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (hotel_id, slug)
);

-- ---------- unidades_habitacion (unidades físicas del PMS) ----------
CREATE TABLE IF NOT EXISTS public.unidades_habitacion (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id UUID NOT NULL REFERENCES public.hoteles(id) ON DELETE CASCADE,
  tipo_id UUID NOT NULL REFERENCES public.tipos_habitacion(id) ON DELETE CASCADE,
  pms_id INTEGER UNIQUE,
  name TEXT NOT NULL,
  floor TEXT,
  capacity INTEGER,
  amenities TEXT[] NOT NULL DEFAULT '{}'::text[],
  "order" INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------- intentos_registro (límite de intentos de registro) ----------
CREATE TABLE IF NOT EXISTS public.intentos_registro (
  attempt_key TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL DEFAULT 0,
  window_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================================
-- 3. ÍNDICES
-- =====================================================================
CREATE INDEX IF NOT EXISTS idx_hero_slides_hotel        ON public.hero_slides (hotel_id, "order");
CREATE INDEX IF NOT EXISTS idx_amenidades_hotel         ON public.amenidades (hotel_id, active);
CREATE INDEX IF NOT EXISTS idx_atractivos_hotel         ON public.atractivos_turisticos (hotel_id, active);
CREATE INDEX IF NOT EXISTS idx_galeria_hotel            ON public.galeria (hotel_id, category);
CREATE INDEX IF NOT EXISTS idx_reservas_hotel           ON public.reservas (hotel_id, status);
CREATE INDEX IF NOT EXISTS idx_reservas_cliente         ON public.reservas (cliente_id);
CREATE INDEX IF NOT EXISTS idx_comentarios_hotel        ON public.comentarios (hotel_id, status);
CREATE INDEX IF NOT EXISTS idx_comentarios_cliente      ON public.comentarios (cliente_id);
CREATE INDEX IF NOT EXISTS idx_promociones_hotel        ON public.promociones (hotel_id, active);
CREATE INDEX IF NOT EXISTS idx_config_hotel             ON public.configuracion_hotel (hotel_id, "group");
CREATE INDEX IF NOT EXISTS idx_usuarios_email           ON public.usuarios (email);
CREATE INDEX IF NOT EXISTS idx_usuarios_username        ON public.usuarios (username);
CREATE INDEX IF NOT EXISTS idx_clientes_hotel           ON public.clientes (hotel_id);
CREATE INDEX IF NOT EXISTS idx_clientes_active          ON public.clientes (active);
CREATE INDEX IF NOT EXISTS tipos_habitacion_hotel_idx   ON public.tipos_habitacion (hotel_id);
CREATE INDEX IF NOT EXISTS unidades_habitacion_tipo_idx ON public.unidades_habitacion (tipo_id);
CREATE INDEX IF NOT EXISTS intentos_registro_updated_at_idx ON public.intentos_registro (updated_at);

-- =====================================================================
-- 4. ROW LEVEL SECURITY
-- =====================================================================
ALTER TABLE public.hoteles               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuarios              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuracion_hotel   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hero_slides           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.amenidades            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atractivos_turisticos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atractivo_imagenes    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.galeria               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservas              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consultas             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comentarios           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promociones           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tipos_habitacion      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unidades_habitacion   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intentos_registro     ENABLE ROW LEVEL SECURITY;

-- ---------- hoteles ----------
DROP POLICY IF EXISTS "Public can view active hotels"    ON public.hoteles;
DROP POLICY IF EXISTS "Authenticated can view hotels"    ON public.hoteles;
DROP POLICY IF EXISTS "Authenticated can update hotels"  ON public.hoteles;
CREATE POLICY "Public can view active hotels"   ON public.hoteles FOR SELECT USING (active = true);
CREATE POLICY "Authenticated can view hotels"   ON public.hoteles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can update hotels" ON public.hoteles FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- ---------- usuarios ----------
DROP POLICY IF EXISTS "Allow public read users"        ON public.usuarios;
DROP POLICY IF EXISTS "Allow insert users"             ON public.usuarios;
DROP POLICY IF EXISTS "Allow update users"             ON public.usuarios;
DROP POLICY IF EXISTS "Authenticated can view users"   ON public.usuarios;
DROP POLICY IF EXISTS "Authenticated can manage users" ON public.usuarios;
CREATE POLICY "Allow public read users"        ON public.usuarios FOR SELECT USING (true);
CREATE POLICY "Allow insert users"             ON public.usuarios FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update users"             ON public.usuarios FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can view users"   ON public.usuarios FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can manage users" ON public.usuarios FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ---------- clientes ----------
-- Sin políticas: solo la service role (Pages Functions) lee y escribe.
REVOKE ALL ON public.clientes FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clientes TO service_role;

-- ---------- configuracion_hotel ----------
DROP POLICY IF EXISTS "Public can view hotel config"     ON public.configuracion_hotel;
DROP POLICY IF EXISTS "Authenticated can view config"    ON public.configuracion_hotel;
DROP POLICY IF EXISTS "Authenticated can manage config"  ON public.configuracion_hotel;
CREATE POLICY "Public can view hotel config"    ON public.configuracion_hotel FOR SELECT USING (true);
CREATE POLICY "Authenticated can view config"   ON public.configuracion_hotel FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can manage config" ON public.configuracion_hotel FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ---------- hero_slides ----------
DROP POLICY IF EXISTS "Public can view active hero slides"    ON public.hero_slides;
DROP POLICY IF EXISTS "Authenticated can view hero slides"    ON public.hero_slides;
DROP POLICY IF EXISTS "Authenticated can manage hero slides"  ON public.hero_slides;
CREATE POLICY "Public can view active hero slides"   ON public.hero_slides FOR SELECT USING (active = true);
CREATE POLICY "Authenticated can view hero slides"   ON public.hero_slides FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can manage hero slides" ON public.hero_slides FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ---------- amenidades ----------
DROP POLICY IF EXISTS "Public can view active amenities"    ON public.amenidades;
DROP POLICY IF EXISTS "Authenticated can view amenities"    ON public.amenidades;
DROP POLICY IF EXISTS "Authenticated can manage amenities"  ON public.amenidades;
CREATE POLICY "Public can view active amenities"   ON public.amenidades FOR SELECT USING (active = true);
CREATE POLICY "Authenticated can view amenities"   ON public.amenidades FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can manage amenities" ON public.amenidades FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ---------- atractivos_turisticos ----------
DROP POLICY IF EXISTS "Public can view active attractions"    ON public.atractivos_turisticos;
DROP POLICY IF EXISTS "Authenticated can view attractions"    ON public.atractivos_turisticos;
DROP POLICY IF EXISTS "Authenticated can manage attractions"  ON public.atractivos_turisticos;
CREATE POLICY "Public can view active attractions"   ON public.atractivos_turisticos FOR SELECT USING (active = true);
CREATE POLICY "Authenticated can view attractions"   ON public.atractivos_turisticos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can manage attractions" ON public.atractivos_turisticos FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ---------- atractivo_imagenes ----------
DROP POLICY IF EXISTS "Public can view attraction images"    ON public.atractivo_imagenes;
DROP POLICY IF EXISTS "Authenticated can view attraction images"  ON public.atractivo_imagenes;
DROP POLICY IF EXISTS "Authenticated can manage attraction images" ON public.atractivo_imagenes;
CREATE POLICY "Public can view attraction images"    ON public.atractivo_imagenes FOR SELECT USING (true);
CREATE POLICY "Authenticated can view attraction images"   ON public.atractivo_imagenes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can manage attraction images" ON public.atractivo_imagenes FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ---------- galeria ----------
DROP POLICY IF EXISTS "Public can view gallery"    ON public.galeria;
DROP POLICY IF EXISTS "Authenticated can view gallery"    ON public.galeria;
DROP POLICY IF EXISTS "Authenticated can manage gallery"  ON public.galeria;
CREATE POLICY "Public can view gallery"    ON public.galeria FOR SELECT USING (true);
CREATE POLICY "Authenticated can view gallery"   ON public.galeria FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can manage gallery" ON public.galeria FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ---------- reservas ----------
DROP POLICY IF EXISTS "Public can insert reservations"    ON public.reservas;
DROP POLICY IF EXISTS "Authenticated can view reservations"    ON public.reservas;
DROP POLICY IF EXISTS "Authenticated can manage reservations"  ON public.reservas;
CREATE POLICY "Public can insert reservations"    ON public.reservas FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated can view reservations"   ON public.reservas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can manage reservations" ON public.reservas FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ---------- consultas ----------
DROP POLICY IF EXISTS "Public can insert inquiries"    ON public.consultas;
DROP POLICY IF EXISTS "Authenticated can view inquiries"    ON public.consultas;
DROP POLICY IF EXISTS "Authenticated can manage inquiries"  ON public.consultas;
CREATE POLICY "Public can insert inquiries"    ON public.consultas FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated can view inquiries"   ON public.consultas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can manage inquiries" ON public.consultas FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ---------- comentarios ----------
DROP POLICY IF EXISTS "Public can insert comments"        ON public.comentarios;
DROP POLICY IF EXISTS "Public can view approved comments" ON public.comentarios;
DROP POLICY IF EXISTS "Authenticated can view comments"   ON public.comentarios;
DROP POLICY IF EXISTS "Authenticated can manage comments" ON public.comentarios;
CREATE POLICY "Public can insert comments"        ON public.comentarios FOR INSERT WITH CHECK (true);
CREATE POLICY "Public can view approved comments" ON public.comentarios FOR SELECT USING (status = 'approved');
CREATE POLICY "Authenticated can view comments"   ON public.comentarios FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can manage comments" ON public.comentarios FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ---------- promociones ----------
DROP POLICY IF EXISTS "Public can view active promotions"    ON public.promociones;
DROP POLICY IF EXISTS "Authenticated can view promotions"    ON public.promociones;
DROP POLICY IF EXISTS "Authenticated can manage promotions"  ON public.promociones;
CREATE POLICY "Public can view active promotions"   ON public.promociones FOR SELECT USING (active = true);
CREATE POLICY "Authenticated can view promotions"   ON public.promociones FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can manage promotions" ON public.promociones FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ---------- tipos_habitacion ----------
DROP POLICY IF EXISTS "Public can view active room types"   ON public.tipos_habitacion;
DROP POLICY IF EXISTS "Authenticated can manage room types" ON public.tipos_habitacion;
CREATE POLICY "Public can view active room types"   ON public.tipos_habitacion FOR SELECT USING (active = true);
CREATE POLICY "Authenticated can manage room types" ON public.tipos_habitacion FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ---------- unidades_habitacion ----------
DROP POLICY IF EXISTS "Public can view active room units"   ON public.unidades_habitacion;
DROP POLICY IF EXISTS "Authenticated can manage room units" ON public.unidades_habitacion;
CREATE POLICY "Public can view active room units"   ON public.unidades_habitacion FOR SELECT USING (active = true);
CREATE POLICY "Authenticated can manage room units" ON public.unidades_habitacion FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ---------- intentos_registro ----------
-- Sin políticas: solo la service role usa esta tabla.
REVOKE ALL ON public.intentos_registro FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.intentos_registro TO service_role;

-- =====================================================================
-- 5. TRIGGERS DE updated_at
-- =====================================================================
DROP TRIGGER IF EXISTS trigger_hoteles_updated_at       ON public.hoteles;
CREATE TRIGGER trigger_hoteles_updated_at BEFORE UPDATE ON public.hoteles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS trigger_usuarios_updated_at      ON public.usuarios;
CREATE TRIGGER trigger_usuarios_updated_at BEFORE UPDATE ON public.usuarios
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS trigger_clientes_updated_at      ON public.clientes;
CREATE TRIGGER trigger_clientes_updated_at BEFORE UPDATE ON public.clientes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS trigger_config_updated_at        ON public.configuracion_hotel;
CREATE TRIGGER trigger_config_updated_at BEFORE UPDATE ON public.configuracion_hotel
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS trigger_hero_slides_updated_at   ON public.hero_slides;
CREATE TRIGGER trigger_hero_slides_updated_at BEFORE UPDATE ON public.hero_slides
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS trigger_amenidades_updated_at    ON public.amenidades;
CREATE TRIGGER trigger_amenidades_updated_at BEFORE UPDATE ON public.amenidades
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS trigger_atractivos_updated_at    ON public.atractivos_turisticos;
CREATE TRIGGER trigger_atractivos_updated_at BEFORE UPDATE ON public.atractivos_turisticos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS trigger_galeria_updated_at       ON public.galeria;
CREATE TRIGGER trigger_galeria_updated_at BEFORE UPDATE ON public.galeria
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS trigger_reservas_updated_at      ON public.reservas;
CREATE TRIGGER trigger_reservas_updated_at BEFORE UPDATE ON public.reservas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS trigger_consultas_updated_at     ON public.consultas;
CREATE TRIGGER trigger_consultas_updated_at BEFORE UPDATE ON public.consultas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS trigger_comentarios_updated_at   ON public.comentarios;
CREATE TRIGGER trigger_comentarios_updated_at BEFORE UPDATE ON public.comentarios
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS trigger_promociones_updated_at   ON public.promociones;
CREATE TRIGGER trigger_promociones_updated_at BEFORE UPDATE ON public.promociones
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- =====================================================================
-- 6. FUNCIONES RPC
-- =====================================================================

-- ---------- verify_password ----------
CREATE OR REPLACE FUNCTION public.verify_password(p_username TEXT, p_password TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  stored_hash TEXT;
BEGIN
  SELECT password_hash INTO stored_hash
  FROM public.usuarios
  WHERE username = p_username AND active = true;

  IF stored_hash IS NULL THEN
    RETURN FALSE;
  END IF;

  RETURN crypt(p_password, stored_hash) = stored_hash;
END;
$$;

-- ---------- hash_password ----------
CREATE OR REPLACE FUNCTION public.hash_password(p_password TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN crypt(p_password, gen_salt('bf', 10));
END;
$$;

-- ---------- generate_token ----------
CREATE OR REPLACE FUNCTION public.generate_token(p_user_id UUID, p_role TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  secret_key TEXT := 'hostal-relax-secret-key-2024';
  payload TEXT;
  token TEXT;
BEGIN
  payload := json_build_object(
    'sub', p_user_id,
    'role', p_role,
    'iat', EXTRACT(EPOCH FROM NOW())::INTEGER,
    'exp', EXTRACT(EPOCH FROM NOW() + INTERVAL '7 days')::INTEGER
  )::TEXT;

  token := encode(sha256((payload || secret_key)::bytea), 'hex');

  RETURN token;
END;
$$;

-- ---------- register_user ----------
CREATE OR REPLACE FUNCTION public.register_user(
  p_name TEXT,
  p_username TEXT,
  p_password TEXT,
  p_email TEXT DEFAULT NULL,
  p_hotel_id UUID DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_user RECORD;
BEGIN
  INSERT INTO public.usuarios (name, username, email, password_hash, role, hotel_id)
  VALUES (
    p_name,
    p_username,
    NULLIF(p_email, ''),
    crypt(p_password, gen_salt('bf', 10)),
    'client',
    p_hotel_id
  )
  RETURNING id, name, username, email, role INTO new_user;

  RETURN json_build_object(
    'id', new_user.id,
    'name', new_user.name,
    'username', new_user.username,
    'email', new_user.email,
    'role', new_user.role
  );
END;
$$;

-- ---------- verify_client_password ----------
CREATE OR REPLACE FUNCTION public.verify_client_password(p_username TEXT, p_password TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  stored_hash TEXT;
BEGIN
  SELECT password_hash INTO stored_hash
  FROM public.clientes
  WHERE username = p_username AND active = true;

  IF stored_hash IS NULL THEN
    RETURN FALSE;
  END IF;

  RETURN crypt(p_password, stored_hash) = stored_hash;
END;
$$;

-- ---------- check_registration_attempt ----------
CREATE OR REPLACE FUNCTION public.check_registration_attempt(
  p_key TEXT,
  p_limit INTEGER,
  p_window_minutes INTEGER
)
RETURNS TABLE (allowed BOOLEAN, retry_after_seconds INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now TIMESTAMPTZ := NOW();
  v_window INTERVAL := make_interval(mins => GREATEST(p_window_minutes, 1));
  v_row public.intentos_registro%ROWTYPE;
BEGIN
  INSERT INTO public.intentos_registro AS t (attempt_key, attempts, window_started_at, updated_at)
  VALUES (p_key, 0, v_now, v_now)
  ON CONFLICT (attempt_key) DO NOTHING;

  SELECT * INTO v_row
  FROM public.intentos_registro
  WHERE attempt_key = p_key
  FOR UPDATE;

  IF v_row.window_started_at + v_window <= v_now THEN
    UPDATE public.intentos_registro
      SET attempts = 1, window_started_at = v_now, updated_at = v_now
      WHERE attempt_key = p_key;
    RETURN QUERY SELECT TRUE, 0;
    RETURN;
  END IF;

  IF v_row.attempts >= p_limit THEN
    RETURN QUERY
      SELECT FALSE,
             GREATEST(1, CEIL(EXTRACT(EPOCH FROM (v_row.window_started_at + v_window - v_now)))::INTEGER);
    RETURN;
  END IF;

  UPDATE public.intentos_registro
    SET attempts = attempts + 1, updated_at = v_now
    WHERE attempt_key = p_key;

  RETURN QUERY SELECT TRUE, 0;
END;
$$;

-- Permisos de las RPC
REVOKE ALL ON FUNCTION public.update_updated_at() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.verify_password(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.hash_password(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.generate_token(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.register_user(TEXT, TEXT, TEXT, TEXT, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.check_registration_attempt(TEXT, INTEGER, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.check_registration_attempt(TEXT, INTEGER, INTEGER) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.verify_client_password(TEXT, TEXT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.update_updated_at() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_password(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hash_password(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_token(UUID, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.register_user(TEXT, TEXT, TEXT, TEXT, UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_client_password(TEXT, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.check_registration_attempt(TEXT, INTEGER, INTEGER) TO service_role;

-- =====================================================================
-- 7. STORAGE
-- =====================================================================
DO $$
BEGIN
  IF to_regclass('storage.buckets') IS NOT NULL THEN
    INSERT INTO storage.buckets (id, name, public)
    VALUES ('hero-videos', 'hero-videos', true)
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES (
      'media',
      'media',
      true,
      52428800,
      ARRAY['image/jpeg','image/png','image/webp','image/avif','image/gif','image/svg+xml','video/mp4','video/webm','video/quicktime']
    )
    ON CONFLICT (id) DO NOTHING;

    DROP POLICY IF EXISTS "Public Access" ON storage.objects;
    CREATE POLICY "Public Access" ON storage.objects
      FOR SELECT USING (bucket_id = 'hero-videos');

    DROP POLICY IF EXISTS "Public Upload" ON storage.objects;
    CREATE POLICY "Public Upload" ON storage.objects
      FOR INSERT WITH CHECK (bucket_id = 'hero-videos');
  END IF;
END;
$$;

-- =====================================================================
-- 8. NOTAS
-- =====================================================================
-- Las tablas retiradas (roles, newsletter, seo_config, habitacion_imagenes,
-- booking_room_types, categorias_habitacion y habitaciones) quedaron
-- respaldadas en src/supabase/legacy/20261019-tablas-obsoletas.sql.
--
-- Para crear el primer administrador:
--   INSERT INTO public.usuarios (name, username, email, password_hash, role)
--   VALUES ('Admin', 'admin', 'admin@hotel.com',
--           public.hash_password('cambia-esta-contrasena'), 'admin');
-- =====================================================================
-- FIN DEL ESQUEMA
