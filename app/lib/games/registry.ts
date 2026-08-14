// ===== app/lib/games/registry.ts =====
// Qué juegos tienen motor real. La clave es el id de GAMES (app/lib/data.ts).
// Lo que no esté aquí cae en el reproductor simulado, que es lo que hoy usan
// los otros cuatro juegos del catálogo.
//
// Es Partial a propósito: al indexar con un id cualquiera el tipo resultante es
// GameFactory | undefined, así que el despachador está obligado a comprobarlo.

import { SKINS_BLOQUE_BUSTER, createArkanoidGame } from "./arkanoid";
import { SKINS_ROCAS, createAsteroidsGame } from "./asteroids";
import { SKINS_RANARIA, createFroggerGame } from "./frogger";
import type { FichaDeSkins } from "./skins";
import { SKINS_SERPENTINA, createSnakeGame } from "./snake";
import { SKINS_CAIDA, createTetrisGame } from "./tetris";
import type { GameFactory } from "./types";

export const GAME_ENGINES: Partial<Record<string, GameFactory>> = {
  rocas: createAsteroidsGame,
  caida: createTetrisGame,
  "bloque-buster": createArkanoidGame,
  serpentina: createSnakeGame,
  ranaria: createFroggerGame,
};

// Qué motores tienen paletas de skin declaradas. Sigue el mismo patrón que
// GAME_CONTROLS —un mapa por id de juego para lo que no es comportamiento— y
// cumple dos papeles: el reproductor decide con él si enseñar el selector de
// skin, y tests/games/registry.test.ts lo cruza con GAME_ENGINES para que
// registrar un motor sin skins no pase inadvertido.
//
// En tiempo de ejecución el motor NO lee de aquí: resuelve su propia paleta a
// partir del skin que recibe. Este mapa es para la plataforma.
export const GAME_PALETAS: Partial<Record<string, FichaDeSkins<string>>> = {
  rocas: SKINS_ROCAS,
  "bloque-buster": SKINS_BLOQUE_BUSTER,
  serpentina: SKINS_SERPENTINA,
  caida: SKINS_CAIDA,
  ranaria: SKINS_RANARIA,
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
