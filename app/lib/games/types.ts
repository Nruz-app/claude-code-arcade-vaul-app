// ===== app/lib/games/types.ts =====
// Contrato que cumple cualquier juego real del portal. La idea es que el
// reproductor (app/juego/[id]/jugar) no sepa nada del juego que monta: le pasa
// un canvas y unos callbacks, y recibe un mando para arrancarlo y pararlo.
//
// El motor no importa React ni toca el DOM fuera del canvas que recibe.

// "surrender" = el jugador pulsó FIN en lugar de quedarse sin vidas.
export type GameOverReason = "game_over" | "surrender";

// Lo que se sabe de una partida cuando termina. Es lo que se registra en
// Supabase, así que el motor es quien tiene que producirlo: es el único que
// sabe cuánto se jugó de verdad.
export interface GameOverSummary {
  score: number;
  level: number; // nivel alcanzado
  durationMs: number; // tiempo jugado, sin contar pausas
  reason: GameOverReason;
}

export interface GameCallbacks {
  onScore: (score: number) => void;
  onLives: (lives: number) => void;
  onLevel: (level: number) => void;
  onGameOver: (summary: GameOverSummary) => void;
}

export interface GameHandle {
  start: () => void; // arranca una partida nueva desde cero
  pause: () => void;
  resume: () => void;
  end: () => void; // rendirse: termina y emite onGameOver con "surrender"
  destroy: () => void; // cancela el rAF y quita los listeners
}

export type GameFactory = (
  canvas: HTMLCanvasElement,
  callbacks: GameCallbacks,
) => GameHandle;
