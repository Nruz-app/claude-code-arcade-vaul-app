// ===== app/lib/games/registry.ts =====
// Qué juegos tienen motor real. La clave es el id de GAMES (app/lib/data.ts).
// Lo que no esté aquí cae en el reproductor simulado, que es lo que hoy usan
// los otros siete juegos del catálogo.
//
// Es Partial a propósito: al indexar con un id cualquiera el tipo resultante es
// GameFactory | undefined, así que el despachador está obligado a comprobarlo.

import { createAsteroidsGame } from "./asteroids";
import type { GameFactory } from "./types";

export const GAME_ENGINES: Partial<Record<string, GameFactory>> = {
  rocas: createAsteroidsGame,
};

// Teclas que anuncia el overlay de arranque del reproductor. Viven aquí y no
// dentro del motor para no tocar el contrato GameHandle que fijaron la SPEC 05
// y la SPEC 06: son texto de interfaz, no comportamiento del juego.
//
// Antes estaban escritas a mano en el JSX del reproductor, así que los ocho
// juegos anunciaban los controles de ROCAS. Al registrar un motor nuevo, añade
// aquí su entrada; el reproductor no hay que tocarlo.
export type ControlHint = readonly [tecla: string, accion: string];

export const GAME_CONTROLS: Partial<Record<string, readonly ControlHint[]>> = {
  rocas: [
    ["← →", "ROTAR"],
    ["↑", "PROPULSAR"],
    ["ESPACIO", "DISPARAR"],
    ["ESC", "PAUSA"],
  ],
};
