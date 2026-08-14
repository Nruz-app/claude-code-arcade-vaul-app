// ===== app/lib/games/registry.ts =====
// Qué juegos tienen motor real. La clave es el id de GAMES (app/lib/data.ts).
// Lo que no esté aquí cae en el reproductor simulado, que es lo que hoy usan
// los otros cuatro juegos del catálogo.
//
// Es Partial a propósito: al indexar con un id cualquiera el tipo resultante es
// GameFactory | undefined, así que el despachador está obligado a comprobarlo.

import { createArkanoidGame } from "./arkanoid";
import { createAsteroidsGame } from "./asteroids";
import { createFroggerGame } from "./frogger";
import { createSnakeGame } from "./snake";
import { createTetrisGame } from "./tetris";
import type { GameFactory } from "./types";

export const GAME_ENGINES: Partial<Record<string, GameFactory>> = {
  rocas: createAsteroidsGame,
  caida: createTetrisGame,
  "bloque-buster": createArkanoidGame,
  serpentina: createSnakeGame,
  ranaria: createFroggerGame,
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
  caida: [
    ["← →", "MOVER"],
    ["↑ / X", "ROTAR"],
    ["↓", "BAJAR"],
    ["ESPACIO", "SOLTAR"],
    ["ESC", "PAUSA"],
  ],
  // BLOQUE BUSTER no usa ESPACIO: la pelota sale sola. Es lo que evita que la
  // misma tecla que arranca la partida desde el overlay haga algo dentro.
  "bloque-buster": [
    ["← →", "MOVER PALETA"],
    ["RATÓN", "MOVER PALETA"],
    ["ESC", "PAUSA"],
  ],
  // SERPENTINA tampoco usa ESPACIO: la serpiente arranca sola hacia la derecha,
  // así que la tecla que abre la partida desde el overlay no hace nada dentro.
  serpentina: [
    ["← → ↑ ↓", "GIRAR"],
    ["W A S D", "GIRAR"],
    ["ESC", "PAUSA"],
  ],
  // RANARIA tampoco usa ESPACIO: la rana solo salta con flechas o WASD, así que
  // la tecla que abre la partida desde el overlay no hace nada dentro.
  ranaria: [
    ["← → ↑ ↓", "SALTAR"],
    ["W A S D", "SALTAR"],
    ["ESC", "PAUSA"],
  ],
};
