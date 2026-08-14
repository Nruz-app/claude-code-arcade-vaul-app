// ===== app/lib/games/types.ts =====
// Contrato que cumple cualquier juego real del portal. La idea es que el
// reproductor (app/juego/[id]/jugar) no sepa nada del juego que monta: le pasa
// un canvas y unos callbacks, y recibe un mando para arrancarlo y pararlo.
//
// El motor no importa React ni toca el DOM fuera del canvas que recibe.

import type { SkinId } from "./skins";

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

// El skin entra por aquí, y no por el registro, porque un color de canvas solo
// puede aplicarlo quien llama a ctx.fillStyle: el reproductor monta el elemento
// pero nunca dibuja en él. GameHandle no cambia —sigue con sus cinco métodos—,
// igual que no cambió al añadir GAME_CONTROLS: lo que se amplía es la entrada de
// la factory, que ya es por donde el motor recibe todo lo que viene de fuera.
//
// Es opcional y cada motor lo declara CON VALOR POR DEFECTO (`skin = "neon"`),
// nunca como `skin?`. Dos motivos: entrar a un juego sin elegir nada tiene que
// verse exactamente como antes de que existieran los skins, y Function.length
// no cuenta los parámetros con valor por defecto, así que la aridad que afirma
// tests/games/registry.test.ts sigue siendo 2.
export type GameFactory = (
  canvas: HTMLCanvasElement,
  callbacks: GameCallbacks,
  skin?: SkinId,
) => GameHandle;
