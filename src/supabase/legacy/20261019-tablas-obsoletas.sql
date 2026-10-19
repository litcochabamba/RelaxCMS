-- =====================================================================
-- BACKUP DE LAS TABLAS DEL CMS QUE SE RETIRARON EL 2026-10-19
-- Proyecto Supabase: CMSHostal (noaatcpccjukhrzukcet)
-- =====================================================================
--
-- Este archivo guarda el esquema y los datos de las tablas que dejaron de
-- usarse al pasar el catálogo de habitaciones al PMS. NO se ejecuta solo:
-- sirve para restaurar una tabla puntual si hiciera falta auditar algo.
--
-- Para restaurar: ejecutar el CREATE TABLE correspondiente (las tablas
-- `hoteles` debe existir) y después sus INSERT.
-- =====================================================================

-- ---------- roles ----------
CREATE TABLE IF NOT EXISTS public.roles (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL UNIQUE,
  description text,
  permissions jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now()
);

INSERT INTO public.roles ("id", "name", "description", "permissions", "created_at") VALUES
  ('7165ce90-a65a-4224-831e-849c0ef44fa6', 'client', 'Cliente con acceso limitado', '["profile:edit", "reservations:view"]'::jsonb, '2026-07-02T07:35:38.569102+00:00'),
  ('c4b068d5-6077-4035-a4bf-4c7af67213f5', 'admin', 'Administrador con acceso completo', '["*"]'::jsonb, '2026-07-02T07:35:38.569102+00:00'),
  ('dd3aa8c9-c784-4afa-956e-eebb9d4258e3', 'moderator', 'Moderador con acceso parcial', '["comments:approve", "comments:reply", "content:edit", "promotions:manage", "inquiries:respond"]'::jsonb, '2026-07-02T07:35:38.569102+00:00') ON CONFLICT DO NOTHING;

-- ---------- newsletter ----------
CREATE TABLE IF NOT EXISTS public.newsletter (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  hotel_id uuid NOT NULL REFERENCES public.hoteles(id) ON DELETE CASCADE,
  email text NOT NULL,
  name text,
  active boolean DEFAULT true,
  subscribed_at timestamptz DEFAULT now(),
  unsubscribed_at timestamptz,
  UNIQUE (hotel_id, email)
);
CREATE INDEX IF NOT EXISTS idx_newsletter_hotel ON public.newsletter (hotel_id, active);

-- ---------- seo_config ----------
CREATE TABLE IF NOT EXISTS public.seo_config (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  hotel_id uuid NOT NULL REFERENCES public.hoteles(id) ON DELETE CASCADE,
  page text NOT NULL,
  title text,
  description text,
  og_image text,
  keywords text,
  canonical_url text,
  schema_json jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (hotel_id, page)
);

-- ---------- booking_room_types ----------
CREATE TABLE IF NOT EXISTS public.booking_room_types (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  hotel_id uuid NOT NULL REFERENCES public.hoteles(id) ON DELETE CASCADE,
  name text NOT NULL,
  adults integer NOT NULL DEFAULT 2,
  image_url text NOT NULL,
  "order" integer DEFAULT 0,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_booking_room_types_hotel ON public.booking_room_types (hotel_id);

INSERT INTO public.booking_room_types ("id", "hotel_id", "name", "adults", "image_url", "order", "active", "created_at", "updated_at") VALUES
  ('2358f326-231c-4da5-9c21-bfba06c10250', 'e600b7bc-1c2a-4f1f-93f6-c4fd843671b0', 'Suite', 2, 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=400&q=80', 4, TRUE, '2026-07-13T05:54:18.005685+00:00', '2026-07-13T05:54:18.005685+00:00'),
  ('47e7b7b8-6ef5-4362-89e0-b737e8b09f00', 'e600b7bc-1c2a-4f1f-93f6-c4fd843671b0', 'Familiar', 4, 'https://images.unsplash.com/photo-1578683010236-d716f9a3f461?w=400&q=80', 3, TRUE, '2026-07-13T05:54:18.005685+00:00', '2026-07-13T05:54:18.005685+00:00'),
  ('6eb2ba6c-07a3-4b7c-86d2-2c06032d2228', 'e600b7bc-1c2a-4f1f-93f6-c4fd843671b0', 'Personal', 1, 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=400&q=80', 0, TRUE, '2026-07-13T05:54:18.005685+00:00', '2026-07-13T05:54:18.005685+00:00'),
  ('81c664db-b0e3-4f8a-83b2-26aa58d56287', 'e600b7bc-1c2a-4f1f-93f6-c4fd843671b0', 'Matrimonial', 2, 'https://images.unsplash.com/photo-1611892440504-42a792e24d32?w=400&q=80', 1, TRUE, '2026-07-13T05:54:18.005685+00:00', '2026-07-13T05:54:18.005685+00:00'),
  ('b83fb89d-285e-468d-8adb-d2af29069172', 'e600b7bc-1c2a-4f1f-93f6-c4fd843671b0', 'Doble', 2, 'https://images.unsplash.com/photo-1590490360182-c33d57733427?w=400&q=80', 2, TRUE, '2026-07-13T05:54:18.005685+00:00', '2026-07-13T05:54:18.005685+00:00') ON CONFLICT DO NOTHING;

-- ---------- categorias_habitacion ----------
CREATE TABLE IF NOT EXISTS public.categorias_habitacion (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  hotel_id uuid NOT NULL REFERENCES public.hoteles(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  description text,
  "order" integer DEFAULT 0,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (hotel_id, slug)
);
CREATE INDEX IF NOT EXISTS idx_categorias_order ON public.categorias_habitacion (hotel_id, "order");

INSERT INTO public.categorias_habitacion ("id", "hotel_id", "name", "slug", "description", "order", "active", "created_at", "updated_at") VALUES
  ('3948322e-7840-46c8-ade7-f3554fbfe31d', 'e600b7bc-1c2a-4f1f-93f6-c4fd843671b0', 'Semi Departamento', 'semi-departamento', 'Semi departamentos con cocina y mÃºltiples habitaciones', 6, TRUE, '2026-07-07T03:21:05.846639+00:00', '2026-07-07T03:21:05.846639+00:00'),
  ('565d0810-cbd5-4aa3-8b13-5eabd2344a28', 'e600b7bc-1c2a-4f1f-93f6-c4fd843671b0', 'Familiar', 'familiar', 'Habitaciones para familias', 4, TRUE, '2026-07-07T03:21:05.846639+00:00', '2026-07-07T03:21:05.846639+00:00'),
  ('8a34552d-4184-48d2-8e48-abab0d6f1928', 'e600b7bc-1c2a-4f1f-93f6-c4fd843671b0', 'VIP', 'vip', 'Habitaciones de categorÃ­a superior', 5, TRUE, '2026-07-07T03:21:05.846639+00:00', '2026-07-07T03:21:05.846639+00:00'),
  ('90199687-9235-4090-a411-67509619db59', 'e600b7bc-1c2a-4f1f-93f6-c4fd843671b0', 'Personal', 'personal', 'Habitaciones para viajeros individuales', 1, TRUE, '2026-07-07T03:21:05.846639+00:00', '2026-07-07T03:21:05.846639+00:00'),
  ('d1deac5f-093f-4a92-9bac-c9936decf3ce', 'e600b7bc-1c2a-4f1f-93f6-c4fd843671b0', 'Matrimonial', 'matrimonial', 'Habitaciones para parejas', 2, TRUE, '2026-07-07T03:21:05.846639+00:00', '2026-07-07T03:21:05.846639+00:00'),
  ('e38d3393-09f4-4e23-8254-5c7a9daf38ba', 'e600b7bc-1c2a-4f1f-93f6-c4fd843671b0', 'Doble', 'doble', 'Habitaciones con dos camas', 3, TRUE, '2026-07-07T03:21:05.846639+00:00', '2026-07-07T03:21:05.846639+00:00') ON CONFLICT DO NOTHING;

-- ---------- habitaciones ----------
CREATE TABLE IF NOT EXISTS public.habitaciones (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  hotel_id uuid NOT NULL REFERENCES public.hoteles(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.categorias_habitacion(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  description text,
  price numeric(10,2) NOT NULL DEFAULT 0,
  currency text DEFAULT 'BOB',
  max_adults integer DEFAULT 2,
  max_children integer DEFAULT 0,
  max_guests integer DEFAULT 2,
  bed_type text,
  size_sqm numeric,
  floor integer,
  amenities jsonb DEFAULT '[]'::jsonb,
  services jsonb DEFAULT '[]'::jsonb,
  active boolean DEFAULT true,
  featured boolean DEFAULT false,
  "order" integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (hotel_id, slug)
);
CREATE INDEX IF NOT EXISTS idx_habitaciones_hotel ON public.habitaciones (hotel_id, active);
CREATE INDEX IF NOT EXISTS idx_habitaciones_category ON public.habitaciones (category_id);
CREATE INDEX IF NOT EXISTS idx_habitaciones_order ON public.habitaciones (hotel_id, "order");

INSERT INTO public.habitaciones ("id", "hotel_id", "category_id", "name", "slug", "description", "price", "currency", "max_adults", "max_children", "max_guests", "bed_type", "size_sqm", "floor", "amenities", "services", "active", "featured", "order", "created_at", "updated_at") VALUES
  ('1078f65b-ca59-45e6-935f-898d9e117a0b', 'e600b7bc-1c2a-4f1f-93f6-c4fd843671b0', '565d0810-cbd5-4aa3-8b13-5eabd2344a28', 'Familiar (3 camas)', 'familiar-3-camas', 'Desayuno: Piso 11, de 7 a. m. a 9 a. m.
Ingreso: A partir de las 5 a. m.
Salida: MaÃ±ana a las 12 p. m.', 380, 'BOB', 4, 0, 4, NULL, NULL, NULL, '["3 camas de una plaza"]'::jsonb, '["BaÃ±o privado", "Ducha caliente", "Smart TV (Android)", "Wi-Fi"]'::jsonb, TRUE, FALSE, 4, '2026-07-07T03:21:48.283226+00:00', '2026-07-07T03:21:48.283226+00:00'),
  ('1d7335e0-34ca-4ab6-b38d-d6e3e7bee418', 'e600b7bc-1c2a-4f1f-93f6-c4fd843671b0', '3948322e-7840-46c8-ade7-f3554fbfe31d', 'Semi Departamento (2 habitaciones)', 'semi-departamento-2-habitaciones', 'Desayuno: Piso11 , de 7 a. m. a 9 a. m.
Ingreso: A partir de las 5 a. m.
Salida: MaÃ±ana a las 12 p. m.', 680, 'BOB', 8, 0, 8, NULL, NULL, NULL, '["Caldera elÃ©ctrica y utensilios", "2 habitaciones, cada una con 2 camas de 2 plazas"]'::jsonb, '["BaÃ±o privado", "Ducha caliente", "Smart TV (Android)", "Wi-Fi"]'::jsonb, TRUE, FALSE, 10, '2026-07-07T03:22:12.312642+00:00', '2026-07-07T03:22:12.312642+00:00'),
  ('21026a12-e251-4058-97e4-7ee0c902a695', 'e600b7bc-1c2a-4f1f-93f6-c4fd843671b0', 'e38d3393-09f4-4e23-8254-5c7a9daf38ba', 'Doble', 'doble', 'Desayuno: Piso 11, de 7 a. m. a 9 a. m.
Ingreso: A partir de las 5 a. m.
Salida: MaÃ±ana a las 12 p. m.', 300, 'BOB', 2, 0, 2, NULL, NULL, NULL, '["2 camas"]'::jsonb, '["BaÃ±o privado", "Ducha caliente", "Smart TV (Android)", "Wi-Fi"]'::jsonb, TRUE, FALSE, 3, '2026-07-07T03:21:37.789452+00:00', '2026-07-07T03:21:37.789452+00:00'),
  ('2318919a-3808-4585-bea0-ae6b0c5791dc', 'e600b7bc-1c2a-4f1f-93f6-c4fd843671b0', '3948322e-7840-46c8-ade7-f3554fbfe31d', 'Semi Departamento (2 camas, 2 plazas)', 'semi-departamento-2-camas-2-plazas', 'Desayuno: Piso 11, de 7 a. m. a 9 a. m.
Ingreso: A partir de las 5 a. m.
Salida: MaÃ±ana a las 12 p. m.', 450, 'BOB', 4, 0, 4, NULL, NULL, NULL, '["2 camas de 2 plazas", "Caldera elÃ©ctrica y utensilios"]'::jsonb, '["BaÃ±o privado", "Ducha caliente", "Smart TV (Android)", "Wi-Fi"]'::jsonb, TRUE, FALSE, 9, '2026-07-07T03:21:59.584371+00:00', '2026-07-07T03:21:59.584371+00:00'),
  ('37444a5c-2721-4b68-af57-88bbddc180e7', 'e600b7bc-1c2a-4f1f-93f6-c4fd843671b0', '3948322e-7840-46c8-ade7-f3554fbfe31d', 'Semi Departamento Amplio', 'semi-departamento-amplio', 'Desayuno: Piso 11, de 7 a. m. a 9 a. m.
Ingreso: A partir de las 5 a. m.
Salida: MaÃ±ana a las 12 p. m.', 550, 'BOB', 6, 0, 6, NULL, NULL, NULL, '["3 camas de 2 plazas", "Caldera elÃ©ctrica y utensilios"]'::jsonb, '["BaÃ±o privado", "Ducha caliente", "Smart TV (Android)", "Wi-Fi"]'::jsonb, TRUE, FALSE, 11, '2026-07-07T03:22:12.312642+00:00', '2026-07-07T03:22:12.312642+00:00'),
  ('4322b7d2-c01d-4d7f-b10e-796b812637d5', 'e600b7bc-1c2a-4f1f-93f6-c4fd843671b0', '8a34552d-4184-48d2-8e48-abab0d6f1928', 'Matrimonial King (VIP)', 'matrimonial-king-vip', 'Desayuno: Piso 11, de 7 a. m. a 9 a. m.
Ingreso: A partir de las 5 a. m.
Salida: MaÃ±ana a las 12 p. m.', 300, 'BOB', 2, 0, 2, NULL, NULL, NULL, '[]'::jsonb, '["BaÃ±o privado", "Ducha caliente", "Smart TV (Android)", "Wi-Fi"]'::jsonb, TRUE, TRUE, 7, '2026-07-07T03:21:59.584371+00:00', '2026-07-07T03:21:59.584371+00:00'),
  ('5605982b-3794-4174-9d42-6e4fb3628c2b', 'e600b7bc-1c2a-4f1f-93f6-c4fd843671b0', '565d0810-cbd5-4aa3-8b13-5eabd2344a28', 'Familiar (2 camas, 2 plazas)', 'familiar-2-camas-2-plazas', 'Desayuno: Piso 11, de 7 a. m. a 9 a. m.
Ingreso: A partir de las 5 a. m.
Salida: MaÃ±ana a las 12 p. m.', 380, 'BOB', 4, 0, 4, NULL, NULL, NULL, '["2 camas de 2 plazas"]'::jsonb, '["BaÃ±o privado", "Ducha caliente", "Smart TV (Android)", "Wi-Fi"]'::jsonb, TRUE, FALSE, 5, '2026-07-07T03:21:48.283226+00:00', '2026-07-07T03:21:48.283226+00:00'),
  ('5c80a24b-3a90-4060-9c8e-076a25b4d55c', 'e600b7bc-1c2a-4f1f-93f6-c4fd843671b0', '3948322e-7840-46c8-ade7-f3554fbfe31d', 'Semi Departamento (3 camas)', 'semi-departamento-3-camas', 'Desayuno: Piso 11, de 7 a. m. a 9 a. m.
Ingreso: A partir de las 5 a. m.
Salida: MaÃ±ana a las 12 p. m.', 500, 'BOB', 5, 0, 5, NULL, NULL, NULL, '["3 camas", "Caldera elÃ©ctrica y utensilios"]'::jsonb, '["BaÃ±o privado", "Ducha caliente", "Smart TV (Android)", "Wi-Fi"]'::jsonb, TRUE, FALSE, 12, '2026-07-07T03:22:12.312642+00:00', '2026-07-07T03:22:12.312642+00:00'),
  ('a7ce6b5e-ce7b-496a-a167-9fa0d9d92d08', 'e600b7bc-1c2a-4f1f-93f6-c4fd843671b0', '3948322e-7840-46c8-ade7-f3554fbfe31d', 'Semi Departamento', 'semi-departamento', 'Desayuno: Piso 11, de 7 a. m. a 9 a. m.
Ingreso: A partir de las 5 a. m.
Salida: MaÃ±ana a las 12 p. m.', 320, 'BOB', 2, 0, 2, NULL, NULL, NULL, '["Caldera elÃ©ctrica y utensilios"]'::jsonb, '["BaÃ±o privado", "Ducha caliente", "Smart TV (Android)", "Wi-Fi"]'::jsonb, TRUE, FALSE, 8, '2026-07-07T03:21:59.584371+00:00', '2026-07-07T03:21:59.584371+00:00'),
  ('c5b6b69c-4e95-4a93-be7c-55cceea9b3bb', 'e600b7bc-1c2a-4f1f-93f6-c4fd843671b0', 'd1deac5f-093f-4a92-9bac-c9936decf3ce', 'Matrimonial', 'matrimonial', 'Desayuno: Piso 11, de 7 a. m. a 9 a. m.
Ingreso: A partir de las 5 a. m.
Salida: MaÃ±ana a las 12 p. m.', 230, 'BOB', 2, 0, 2, NULL, NULL, NULL, '[]'::jsonb, '["BaÃ±o privado", "Ducha caliente", "Smart TV (Android)", "Wi-Fi"]'::jsonb, TRUE, FALSE, 2, '2026-07-07T03:21:37.789452+00:00', '2026-07-07T03:21:37.789452+00:00'),
  ('ec73888c-60ef-4229-84e8-d94a71f669b2', 'e600b7bc-1c2a-4f1f-93f6-c4fd843671b0', '565d0810-cbd5-4aa3-8b13-5eabd2344a28', 'Familiar', 'familiar', 'Desayuno: Piso 11, de 7 a. m. a 9 a. m.
Ingreso: A partir de las 5 a. m.
Salida: MaÃ±ana a las 12 p. m.', 330, 'BOB', 3, 0, 3, NULL, NULL, NULL, '["2 camas: una de 2 plazas y otra de 1 plaza"]'::jsonb, '["BaÃ±o privado", "Ducha caliente", "Smart TV (Android)", "Wi-Fi"]'::jsonb, TRUE, FALSE, 6, '2026-07-07T03:21:48.283226+00:00', '2026-07-07T03:21:48.283226+00:00'),
  ('fa1f7ae2-ca82-4844-a7a4-acfb11cecc44', 'e600b7bc-1c2a-4f1f-93f6-c4fd843671b0', '90199687-9235-4090-a411-67509619db59', 'Personal', 'personal', 'Desayuno: Piso 11, de 7 a. m. a 9 a. m.
Ingreso: A partir de las 5 a. m.
Salida: MaÃ±ana a las 12 p. m.', 170, 'BOB', 1, 0, 1, NULL, NULL, NULL, '[]'::jsonb, '["BaÃ±o privado", "Ducha caliente", "Smart TV (Android)", "Wi-Fi"]'::jsonb, TRUE, FALSE, 1, '2026-07-07T03:21:37.789452+00:00', '2026-07-07T03:21:37.789452+00:00') ON CONFLICT DO NOTHING;

-- ---------- habitacion_imagenes ----------
CREATE TABLE IF NOT EXISTS public.habitacion_imagenes (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id uuid NOT NULL REFERENCES public.habitaciones(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  alt_text text,
  is_primary boolean DEFAULT false,
  "order" integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_habitacionimagenes_room ON public.habitacion_imagenes (room_id, "order");

-- =====================================================================
-- FIN DEL BACKUP
