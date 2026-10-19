-- =====================================================================
-- 20261018000001_clientes
--
-- Separa las CUENTAS DE CLIENTES de la tabla `usuarios`, que queda
-- exclusivamente para usuarios del sistema (admin / moderador).
--
--  • public.clientes: credenciales y datos de contacto de los clientes.
--  • public.comentarios.cliente_id: enlaza un testimonio con su cliente.
--  • verify_client_password(): valida credenciales de cliente igual que
--    verify_password() lo hace para usuarios del sistema.
--  • Datos por defecto: 3 clientes y sus 3 testimonios aprobados.
--
-- Idempotente: se puede correr varias veces sobre la misma base.
-- Contraseña inicial de los clientes de ejemplo: Cliente2026!
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------- clientes ----------
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
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clientes_hotel   ON public.clientes (hotel_id);
CREATE INDEX IF NOT EXISTS idx_clientes_active  ON public.clientes (active);

-- ---------- comentarios.cliente_id ----------
ALTER TABLE public.comentarios
  ADD COLUMN IF NOT EXISTS cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_comentarios_cliente ON public.comentarios (cliente_id);

-- ---------- reservas.cliente_id ----------
-- Permite que el área de cliente muestre sus propias reservas.
ALTER TABLE public.reservas
  ADD COLUMN IF NOT EXISTS cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_reservas_cliente ON public.reservas (cliente_id);

-- ---------- RLS y permisos ----------
-- Los clientes no se exponen con la clave anónima: solo la service role
-- (Pages Functions y panel) los lee y escribe.
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.clientes TO service_role;

-- ---------- updated_at ----------
DROP TRIGGER IF EXISTS trigger_clientes_updated_at ON public.clientes;
CREATE TRIGGER trigger_clientes_updated_at BEFORE UPDATE ON public.clientes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

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

REVOKE ALL ON FUNCTION public.verify_client_password(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_client_password(TEXT, TEXT) TO anon, authenticated, service_role;

-- ---------- Datos por defecto ----------
-- Los comentarios de ejemplo que traía la demo se reemplazan por los
-- testimonios reales de los 3 clientes.
DELETE FROM public.comentarios
WHERE email IN (
  'laura@email.com',
  'roberto@email.com',
  'ana@email.com',
  'carlos@email.com',
  'maria@email.com'
);

-- Cuentas con rol 'client' que todavía vivían en `usuarios` se mueven a
-- `clientes` conservando sus credenciales (siguen entrando por el mismo login).
INSERT INTO public.clientes (hotel_id, name, username, email, password_hash, active, created_at)
SELECT
  u.hotel_id,
  u.name,
  COALESCE(NULLIF(u.username, ''), split_part(u.email, '@', 1), u.id::text),
  u.email,
  u.password_hash,
  u.active,
  u.created_at
FROM public.usuarios u
WHERE u.role = 'client'
ON CONFLICT (username) DO NOTHING;

DELETE FROM public.usuarios WHERE role = 'client';

INSERT INTO public.clientes (hotel_id, name, username, email, phone, password_hash)
SELECT h.id, v.name, v.username, v.email, v.phone, public.hash_password('Cliente2026!')
FROM (SELECT id FROM public.hoteles ORDER BY created_at LIMIT 1) AS h
CROSS JOIN (
  VALUES
    ('Lucia Mendez',      'lucia.mendez',      'lucia.mendez@hostalrelax.com',      '+591 70000001'),
    ('Faustino Canare',   'faustino.canare',   'faustino.canare@hostalrelax.com',   '+591 70000002'),
    ('Limber Espinoza',   'limber.espinoza',   'limber.espinoza@hostalrelax.com',   '+591 70000003')
) AS v (name, username, email, phone)
ON CONFLICT (username) DO NOTHING;

INSERT INTO public.comentarios (hotel_id, cliente_id, name, email, content, rating, status)
SELECT c.hotel_id, c.id, c.name, c.email, v.content, v.rating, 'approved'
FROM public.clientes c
JOIN (
  VALUES
    (
      'lucia.mendez',
      'Me hicieron sentir como en casa. Destacan la amabilidad del personal y la disposición para ayudar en todo momento.',
      5
    ),
    (
      'faustino.canare',
      'Los ambientes son bien espaciosos y salubres. Se encuentran en un punto estratégico.',
      5
    ),
    (
      'limber.espinoza',
      'Cuenta con unas de las mejores vistas de la ciudad de Cochabamba.',
      5
    )
) AS v (username, content, rating) ON v.username = c.username
WHERE NOT EXISTS (
  SELECT 1 FROM public.comentarios existing WHERE existing.content = v.content
);
