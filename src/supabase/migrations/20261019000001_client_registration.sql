-- Registro público de clientes: datos de contacto por país y perfil ampliado.
--
-- 1) `clientes` guarda el país derivado del código de área (ISO, código
--    telefónico y nombre) y los datos opcionales del perfil.
-- 2) Los códigos de área que muestra el formulario de registro NO están
--    hardcodeados: viven en `configuracion_hotel.country_dial_codes` y el
--    administrador los edita desde Configuración. Esta migración siembra una
--    lista inicial para cada hotel que todavía no la tenga.

alter table public.clientes
  add column if not exists country_iso text,
  add column if not exists country_dial text,
  add column if not exists country_name text,
  add column if not exists gender text,
  add column if not exists age integer,
  add column if not exists profession text;

comment on column public.clientes.country_iso is 'ISO 3166-1 alfa-2 del país del teléfono (p. ej. BO).';
comment on column public.clientes.country_dial is 'Código de área telefónico elegido (p. ej. +591).';
comment on column public.clientes.country_name is 'Nombre del país según la configuración del hotel al registrarse.';
comment on column public.clientes.gender is 'Género declarado por el cliente (opcional).';
comment on column public.clientes.age is 'Edad declarada por el cliente (opcional).';
comment on column public.clientes.profession is 'Profesión u ocupación declarada por el cliente (opcional).';

-- Lista inicial de códigos de área. El panel puede agregar, editar o quitar
-- entradas; esta lista solo evita que el formulario quede vacío al empezar.
insert into public.configuracion_hotel (hotel_id, key, value, "group")
select
  h.id,
  'country_dial_codes',
  $json$[
    {"iso":"AR","name":"Argentina","dial":"+54","flag":"🇦🇷","active":true},
    {"iso":"BO","name":"Bolivia","dial":"+591","flag":"🇧🇴","active":true},
    {"iso":"BR","name":"Brasil","dial":"+55","flag":"🇧🇷","active":true},
    {"iso":"CL","name":"Chile","dial":"+56","flag":"🇨🇱","active":true},
    {"iso":"CO","name":"Colombia","dial":"+57","flag":"🇨🇴","active":true},
    {"iso":"CR","name":"Costa Rica","dial":"+506","flag":"🇨🇷","active":true},
    {"iso":"CU","name":"Cuba","dial":"+53","flag":"🇨🇺","active":true},
    {"iso":"EC","name":"Ecuador","dial":"+593","flag":"🇪🇨","active":true},
    {"iso":"SV","name":"El Salvador","dial":"+503","flag":"🇸🇻","active":true},
    {"iso":"ES","name":"España","dial":"+34","flag":"🇪🇸","active":true},
    {"iso":"US","name":"Estados Unidos","dial":"+1","flag":"🇺🇸","active":true},
    {"iso":"GT","name":"Guatemala","dial":"+502","flag":"🇬🇹","active":true},
    {"iso":"HN","name":"Honduras","dial":"+504","flag":"🇭🇳","active":true},
    {"iso":"MX","name":"México","dial":"+52","flag":"🇲🇽","active":true},
    {"iso":"NI","name":"Nicaragua","dial":"+505","flag":"🇳🇮","active":true},
    {"iso":"PA","name":"Panamá","dial":"+507","flag":"🇵🇦","active":true},
    {"iso":"PY","name":"Paraguay","dial":"+595","flag":"🇵🇾","active":true},
    {"iso":"PE","name":"Perú","dial":"+51","flag":"🇵🇪","active":true},
    {"iso":"PR","name":"Puerto Rico","dial":"+1","flag":"🇵🇷","active":true},
    {"iso":"DO","name":"República Dominicana","dial":"+1","flag":"🇩🇴","active":true},
    {"iso":"UY","name":"Uruguay","dial":"+598","flag":"🇺🇾","active":true},
    {"iso":"VE","name":"Venezuela","dial":"+58","flag":"🇻🇪","active":true}
  ]$json$,
  'registro'
from public.hoteles h
where not exists (
  select 1
  from public.configuracion_hotel c
  where c.hotel_id = h.id and c.key = 'country_dial_codes'
);

-- Los clientes ya registrados quedan sin país: el formulario les pide
-- completarlo la próxima vez que editen su perfil.

-- ---------------------------------------------------------------------------
-- Límite de intentos de registro.
--
-- Tabla global (no por hotel) con dos alcances:
--   * alias+IP -> 2 intentos cada 30 minutos (frena el reintento repetido
--                 sobre el mismo alias desde la misma conexión).
--   * IP       -> 10 intentos cada 30 minutos. El tope es alto a propósito:
--                 varias personas de una misma casa comparten IP y cada una
--                 tiene que poder registrarse. No hay bloqueo permanente:
--                 al terminar la ventana el contador se reinicia solo.
-- La IP se guarda hasheada (SHA-256), nunca en texto plano.
-- ---------------------------------------------------------------------------

create table if not exists public.intentos_registro (
  attempt_key text primary key,
  attempts integer not null default 0,
  window_started_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists intentos_registro_updated_at_idx
  on public.intentos_registro (updated_at);

alter table public.intentos_registro enable row level security;

-- Solo el servidor (service role) toca esta tabla: no tiene políticas para
-- anon/authenticated, así que el navegador no puede leerla ni modificarla.
comment on table public.intentos_registro is
  'Contadores de intentos de registro (global), usados por el backend para limitar reintentos.';

-- Registra un intento y devuelve si está permitido. Atómico: bloquea la fila
-- de la clave para que dos requests simultáneos no se salteen el límite.
create or replace function public.check_registration_attempt(
  p_key text,
  p_limit integer,
  p_window_minutes integer
) returns table (allowed boolean, retry_after_seconds integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_window interval := make_interval(mins => greatest(p_window_minutes, 1));
  v_row public.intentos_registro%rowtype;
begin
  insert into public.intentos_registro as t (attempt_key, attempts, window_started_at, updated_at)
  values (p_key, 0, v_now, v_now)
  on conflict (attempt_key) do nothing;

  select * into v_row
  from public.intentos_registro
  where attempt_key = p_key
  for update;

  -- Ventana vencida: se reinicia y este intento cuenta como el primero.
  if v_row.window_started_at + v_window <= v_now then
    update public.intentos_registro
      set attempts = 1, window_started_at = v_now, updated_at = v_now
      where attempt_key = p_key;
    return query select true, 0;
    return;
  end if;

  if v_row.attempts >= p_limit then
    return query
      select false,
             greatest(1, ceil(extract(epoch from (v_row.window_started_at + v_window - v_now)))::integer);
    return;
  end if;

  update public.intentos_registro
    set attempts = attempts + 1, updated_at = v_now
    where attempt_key = p_key;

  return query select true, 0;
end;
$$;

revoke all on function public.check_registration_attempt(text, integer, integer) from public;
revoke all on function public.check_registration_attempt(text, integer, integer) from anon;
revoke all on function public.check_registration_attempt(text, integer, integer) from authenticated;
grant execute on function public.check_registration_attempt(text, integer, integer) to service_role;

-- Privilegios de la tabla: solo el backend (service_role) la usa. Sin GRANT
-- explícito, PostgREST responde 403 aunque la clave sea la service role.
grant select, insert, update, delete on public.intentos_registro to service_role;
revoke all on public.intentos_registro from anon;
revoke all on public.intentos_registro from authenticated;
