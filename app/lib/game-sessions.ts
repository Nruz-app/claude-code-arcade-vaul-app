// ===== app/lib/game-sessions.ts =====
// Registro de partidas en Supabase. Se llama al terminar una partida de un
// juego con motor real; los juegos simulados no escriben nada.
//
// Esta función no lanza nunca: un fallo de red no debe romper la pantalla de
// fin de partida. Devuelve qué pasó y que decida quien llama.

import { createClient } from "./supabase/client";
import type { GameOverReason } from "./games/types";

export interface NewGameSession {
  gameId: string;
  score: number;
  level: number;
  durationMs: number;
  reason: GameOverReason;
}

// "anonymous" = no había sesión, así que no se intentó insertar.
export type SaveResult = "saved" | "anonymous" | "error";

export async function saveGameSession(
  entry: NewGameSession,
): Promise<SaveResult> {
  try {
    const supabase = createClient();

    // Sin sesión no se graba: la política RLS exige auth.uid() = user_id, así
    // que ni siquiera merece la pena intentar el insert.
    const { data } = await supabase.auth.getUser();
    const user = data.user;
    if (!user) return "anonymous";

    const { error } = await supabase.from("game_sessions").insert({
      user_id: user.id,
      game_id: entry.gameId,
      score: entry.score,
      level: entry.level,
      duration_ms: entry.durationMs,
      ended_reason: entry.reason,
    });

    return error ? "error" : "saved";
  } catch {
    // Red caída, cliente mal configurado… da igual: para el jugador es lo mismo.
    return "error";
  }
}
