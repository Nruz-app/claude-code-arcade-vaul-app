-- Migración 20260810011800_game_leaderboard
-- Mejor marca de cada jugador en cada juego (SPEC 07).
--
-- DISTINCT ON se queda con la primera fila de cada grupo, de ahí que el
-- ORDER BY tenga que empezar por las mismas columnas del DISTINCT y seguir
-- por score desc. Escribirlo en otro orden no da error: da el ranking
-- equivocado en silencio.
--
-- Ante dos partidas con la misma puntuación gana la más antigua: quien lo
-- consiguió primero tiene el mérito.
--
-- security_invoker = on hace que la vista se ejecute con los permisos de quien
-- consulta. Sin él correría con los del propietario y se saltaría las
-- políticas RLS de game_sessions y profiles.

create view public.game_leaderboard
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
