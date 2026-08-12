// ===== app/lib/leaderboard.ts =====
// Lectura del Salón de la Fama. Consulta la vista public.game_leaderboard,
// que ya trae la mejor marca de cada jugador por juego con su username.
//
// El cliente de Supabase se recibe como argumento a propósito: la misma
// función sirve al Server Component en la carga inicial y al componente
// cliente al cambiar de pestaña, sin duplicar la consulta.

import type { SupabaseClient } from "@supabase/supabase-js";

export interface PlayerBest {
  rank: number; // puesto real en el ranking del juego
  score: number;
  date: string;
}

export interface LeaderboardRow {
  rank: number; // 1..N, según el orden de la consulta
  userId: string;
  username: string;
  score: number;
  level: number;
  date: string; // "dd/mm/aaaa", como el ScoreRow de data.ts
}

// En UTC y no en hora local: la carga inicial se formatea en el servidor y los
// cambios de pestaña en el navegador. Con la hora local, una partida cerca de
// medianoche saldría con un día distinto en cada sitio y React avisaría de
// desajuste de hidratación.
function formatearFecha(iso: string): string {
  const d = new Date(iso);
  const dia = String(d.getUTCDate()).padStart(2, "0");
  const mes = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${dia}/${mes}/${d.getUTCFullYear()}`;
}

export async function getLeaderboard(
  supabase: SupabaseClient,
  gameId: string,
  limit = 12,
): Promise<LeaderboardRow[]> {
  const { data, error } = await supabase
    .from("game_leaderboard")
    .select("user_id, username, score, level, created_at")
    .eq("game_id", gameId)
    .order("score", { ascending: false })
    // Desempate estable: ante la misma puntuación, primero quien la logró antes.
    .order("created_at", { ascending: true })
    .limit(limit);

  // Un fallo de red no debe romper la pantalla: se muestra el estado vacío.
  if (error || !data) return [];

  return data.map((row, i) => ({
    rank: i + 1,
    userId: row.user_id as string,
    username: row.username as string,
    score: row.score as number,
    level: row.level as number,
    date: formatearFecha(row.created_at as string),
  }));
}

// Devuelve null si el jugador no tiene ninguna partida en ese juego. El puesto
// no se busca en la lista del top: hay que contar cuántos le superan, porque
// puede estar más allá de las doce posiciones que se muestran.
export async function getPlayerBest(
  supabase: SupabaseClient,
  gameId: string,
  userId: string,
): Promise<PlayerBest | null> {
  const { data, error } = await supabase
    .from("game_leaderboard")
    .select("score, created_at")
    .eq("game_id", gameId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) return null;

  const score = data.score as number;

  // head: true no trae filas, solo el total.
  const { count, error: errorConteo } = await supabase
    .from("game_leaderboard")
    .select("user_id", { count: "exact", head: true })
    .eq("game_id", gameId)
    .gt("score", score);

  // Sin el conteo no hay puesto, y esta spec existe precisamente para dejar de
  // enseñar puestos inventados: mejor no mostrar la fila.
  if (errorConteo || count === null) return null;

  return {
    rank: count + 1,
    score,
    date: formatearFecha(data.created_at as string),
  };
}
