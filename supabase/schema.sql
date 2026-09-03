-- =============================================================================
-- schema.sql — el esquema completo de Arcade Vault, de un tirón
-- =============================================================================
--
-- Este archivo existe para una sola cosa: recrear la base de datos entera en un
-- proyecto de Supabase recién creado. Es lo que se pega en el editor SQL del
-- dashboard cuando hay que mudarse de proyecto. El procedimiento completo —que
-- incluye pasos que el SQL no puede cubrir, como desactivar «Confirm email» y
-- actualizar el project_ref en tres archivos— está en supabase/README.md.
--
-- Sale de tres specs: SPEC 04 (perfiles y autenticación), SPEC 06 (registro de
-- partidas) y SPEC 07 (Salón de la Fama). Deja en pie diez objetos:
--
--    1. tabla    public.profiles
--    2. política "perfiles legibles por cualquiera"        (select)
--    3. política "cada usuario edita su perfil"            (update)
--    4. función  public.handle_new_user()
--    5. trigger  on_auth_user_created                      (sobre auth.users)
--    6. tabla    public.game_sessions
--    7. política "partidas legibles por cualquiera"        (select)
--    8. política "cada usuario registra sus partidas"      (insert)
--    9. índice   game_sessions_game_score_idx
--   10. vista    public.game_leaderboard
--
-- ES IDEMPOTENTE Y NO DESTRUCTIVO. Ejecutarlo dos veces seguidas no da error y
-- no borra una sola fila: no hay ni un `drop table`, ni un `drop schema`, ni un
-- `truncate` en todo el archivo. Si algún día hace falta arrasar de verdad, se
-- escribe ese SQL en el momento y no se deja aquí a un clic de distancia.
--
-- RELACIÓN CON supabase/migrations/
-- ---------------------------------
-- Las migraciones siguen siendo el histórico y no se tocan: son las que cuentan
-- de qué SPEC salió cada objeto y por qué es como es. Este archivo dice el QUÉ;
-- ellas dicen el PORQUÉ. Al añadir una migración nueva hay que reflejarla aquí,
-- o este archivo se queda viejo en silencio y la próxima mudanza recrea una base
-- de datos incompleta.
--
-- Este archivo NO cambia el esquema. Es el reflejo exacto de las tres
-- migraciones actuales; cualquier diferencia que no sea una cláusula de
-- idempotencia es un bug.
--
-- CÓMO SE VUELVE IDEMPOTENTE CADA COSA
-- ------------------------------------
-- No hay una sola técnica, porque Postgres no ofrece la misma para todo:
--
--   tablas     → create table if not exists
--   RLS        → se ejecuta siempre (activarlo dos veces no es error)
--   políticas  → drop policy if exists + create policy
--                (`create policy` NO admite `if not exists`)
--   función    → create or replace function
--   trigger    → drop trigger if exists + create trigger
--   índice     → create index if not exists
--   vista      → create or replace view  ⚠ ver el aviso en su sección
--
-- LÍMITE CONOCIDO: `create table if not exists` no arregla una tabla que ya
-- exista con OTRA FORMA. Si a un `profiles` viejo le falta una columna, este
-- archivo pasa por encima sin decir nada y la app falla después, en otro sitio.
-- Se asume a conciencia: el caso de uso es un proyecto recién creado y vacío.
-- Para el resto está `npm run db:check`, que consulta las relaciones de verdad.
--
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. public.profiles — perfil público de cada jugador (SPEC 04)
-- -----------------------------------------------------------------------------
-- El nombre que se muestra en el Nav y en el Salón de la Fama. El correo y la
-- contraseña viven en auth.users, no aquí.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null check (char_length(username) between 1 and 10),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Sin esta línea las dos políticas de abajo no pintan nada: una política sobre
-- una tabla con RLS desactivada no se evalúa nunca.

-- 2. Lectura pública: el Salón de la Fama muestra nombres ajenos.
drop policy if exists "perfiles legibles por cualquiera" on public.profiles;
create policy "perfiles legibles por cualquiera"
  on public.profiles for select using (true);

-- 3. Cada quien edita solo el suyo.
drop policy if exists "cada usuario edita su perfil" on public.profiles;
create policy "cada usuario edita su perfil"
  on public.profiles for update using (auth.uid() = id);

-- OJO: no hay política de insert, y no es un olvido. El perfil lo crea el
-- trigger de abajo, nunca el cliente. Si añades una, estarás permitiendo que
-- alguien se fabrique un perfil con el id de otro.

-- -----------------------------------------------------------------------------
-- 4. public.handle_new_user() — crea el perfil al registrarse (SPEC 04)
-- -----------------------------------------------------------------------------
-- El nombre sale de options.data.username del signUp; si no viene, del correo.
-- Aquí se normaliza a mayúsculas y se corta a 10 caracteres, que es el límite
-- que declara el check de la tabla.
--
-- `security definer` es imprescindible: la función se dispara dentro de la
-- transacción de un registro, cuando todavía no hay sesión con la que satisfacer
-- ninguna política. Y `set search_path = ''` va con ella: sin eso, un esquema
-- malicioso en el search_path del invocador podría suplantar a `public`, que es
-- por lo que todas las referencias de dentro van cualificadas.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, username)
  values (
    new.id,
    upper(left(coalesce(
      new.raw_user_meta_data ->> 'username',
      split_part(new.email, '@', 1)
    ), 10))
  );
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- 5. on_auth_user_created — el trigger que la dispara (SPEC 04)
-- -----------------------------------------------------------------------------
-- Se usa `drop trigger if exists` + `create trigger` en lugar de
-- `create or replace trigger` (que existe desde PostgreSQL 14) a propósito: así
-- el archivo se puede pegar en un proyecto de cualquier edad.
--
-- OJO: estas dos sentencias tocan auth.users, que es un esquema del sistema, y
-- necesitan privilegios sobre él. Desde el editor SQL del dashboard se ejecuta
-- como `postgres` y funciona; por el CLI, con la conexión del `db push`,
-- también. Si algún día se intenta desde una conexión con menos permisos, este
-- es el punto exacto donde va a fallar, y el mensaje de Postgres no lo dirá con
-- estas palabras.

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- 6. public.game_sessions — una fila por partida terminada (SPEC 06)
-- -----------------------------------------------------------------------------
-- Sea por perder las vidas o por rendirse. El nombre del jugador NO se guarda
-- aquí: se resuelve por user_id contra public.profiles, que ya lo tiene.
--
-- El check de ended_reason es la otra mitad de GameOverReason en el código
-- (app/lib/games/types.ts): admite solo esos dos valores. Añadir un tercer
-- motivo obliga a migrar la base, así que los casos raros —por ejemplo llenar el
-- tablero en CAÍDA— se registran como 'game_over' normal.

create table if not exists public.game_sessions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  game_id       text not null check (char_length(game_id) between 1 and 40),
  score         integer not null check (score >= 0),
  level         integer not null check (level >= 1),
  duration_ms   integer not null check (duration_ms >= 0),
  ended_reason  text not null check (ended_reason in ('game_over', 'surrender')),
  created_at    timestamptz not null default now()
);

alter table public.game_sessions enable row level security;

-- 7. Lectura pública: los rankings del Salón de la Fama son públicos, igual que
-- profiles.
drop policy if exists "partidas legibles por cualquiera" on public.game_sessions;
create policy "partidas legibles por cualquiera"
  on public.game_sessions for select using (true);

-- 8. Solo puedes registrar partidas a tu nombre.
drop policy if exists "cada usuario registra sus partidas" on public.game_sessions;
create policy "cada usuario registra sus partidas"
  on public.game_sessions for insert with check (auth.uid() = user_id);

-- NO HAY política de update ni de delete, y tampoco es un olvido: una partida
-- jugada es un hecho, no un registro editable (SPEC 06). Que falten es la
-- decisión, no la tarea pendiente.

-- 9. Para el ranking por juego.
create index if not exists game_sessions_game_score_idx
  on public.game_sessions (game_id, score desc);

-- -----------------------------------------------------------------------------
-- 10. public.game_leaderboard — mejor marca de cada jugador por juego (SPEC 07)
-- -----------------------------------------------------------------------------
-- DISTINCT ON se queda con la primera fila de cada grupo, de ahí que el ORDER BY
-- tenga que empezar por las mismas columnas del DISTINCT y seguir por score
-- desc. Escribirlo en otro orden no da error: da el ranking equivocado en
-- silencio.
--
-- Ante dos partidas con la misma puntuación gana la más antigua: quien lo
-- consiguió primero tiene el mérito.
--
-- security_invoker = on hace que la vista se ejecute con los permisos de quien
-- consulta. Sin él correría con los del propietario y se saltaría las políticas
-- RLS de game_sessions y profiles.
--
-- ⚠ AVISO sobre `create or replace view`: falla si cambian el nombre, el tipo o
-- el orden de las columnas, y el error que devuelve habla de tipos y no de lo
-- que realmente pasa. Hoy no importa porque la vista no cambia; si algún día
-- gana o pierde una columna, hay que hacerle un `drop view` antes.

create or replace view public.game_leaderboard
with (security_invoker = on) as
select distinct on (gs.game_id, gs.user_id)
  gs.game_id,
  gs.user_id,
  p.username,
  gs.score,
  gs.level,
  gs.created_at
from public.game_sessions gs
join public.profiles p on p.id = gs.user_id
order by gs.game_id, gs.user_id, gs.score desc, gs.created_at asc;
