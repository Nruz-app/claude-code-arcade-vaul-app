-- Migración 20260810004050_game_sessions
-- Registro de partidas jugadas (SPEC 06).
-- Una fila por partida terminada, sea por perder las vidas o por rendirse.
-- El nombre del jugador NO se guarda aquí: se resuelve por user_id contra
-- public.profiles, que ya lo tiene.

create table public.game_sessions (
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

-- Lectura pública: los rankings del Salón de la Fama son públicos, igual que profiles.
create policy "partidas legibles por cualquiera"
  on public.game_sessions for select using (true);

-- Solo puedes registrar partidas a tu nombre. Sin política de update ni delete:
-- una partida jugada es un hecho, no un registro editable.
create policy "cada usuario registra sus partidas"
  on public.game_sessions for insert with check (auth.uid() = user_id);

-- Para el ranking por juego.
create index game_sessions_game_score_idx
  on public.game_sessions (game_id, score desc);
