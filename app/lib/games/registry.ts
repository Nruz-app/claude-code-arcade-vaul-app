// ===== app/lib/games/registry.ts =====
// Qué juegos tienen motor real. La clave es el id de GAMES (app/lib/data.ts).
// Lo que no esté aquí cae en el reproductor simulado, que es lo que hoy usan
// los otros tres juegos del catálogo (gloton, invasores y duelo-pixel).
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

// ── Mando táctil (SPEC 14) ────────────────────────────────────────────────────
// Qué botones dibuja el mando de cada juego y qué tecla despacha cada uno.
//
// Tercera aplicación de la misma doctrina que GAME_CONTROLS y GAME_PALETAS: lo
// que es metadata por juego y no comportamiento vive aquí, no en el contrato.
// GameHandle no cambia, y los motores no leen de este mapa — ni saben que
// existe. El mando despacha KeyboardEvent sobre `window`, que es justo lo que
// los cinco motores llevan escuchando desde la SPEC 05.
//
// `code` es el mismo valor de KeyboardEvent.code que el motor ya escucha: el
// mando NO inventa un vocabulario propio. Eso es lo que permite que la prueba
// de cada motor verifique la traducción entera —despacha el code declarado y
// exige el efecto— en vez de comprobar que dos tablas coinciden entre sí.
export interface BotonTactil {
  readonly code: string; // "ArrowLeft", "Space"…
  readonly accion: string; // para el aria-label: "Rotar a la izquierda"
}

// Un botón de acción, de los redondos de la derecha. Lleva dos cosas más que
// uno de la cruceta porque se dibuja distinto: la cruceta saca su flecha (un
// SVG) de la clave de dirección, y estos necesitan letra y color.
export interface BotonAccion extends BotonTactil {
  readonly etiqueta: string; // la letra: "A"
  readonly tono: "cyan" | "magenta";
}

export type Direccion = "arriba" | "abajo" | "izquierda" | "derecha";

export interface MandoDeJuego {
  // Parcial a propósito: BLOQUE BUSTER solo tiene horizontal y ROCAS no usa
  // "abajo". Un juego no dibuja los botones que no le sirven.
  readonly cruceta: Partial<Record<Direccion, BotonTactil>>;
  readonly acciones: readonly BotonAccion[];
  // Si además se juega arrastrando el dedo por el canvas. Solo BLOQUE BUSTER,
  // cuyo motor ya escucha el puntero desde la SPEC 09.
  readonly arrastre?: boolean;
}

export const GAME_TOUCH: Partial<Record<string, MandoDeJuego>> = {
  rocas: {
    cruceta: {
      izquierda: { code: "ArrowLeft", accion: "Rotar a la izquierda" },
      derecha: { code: "ArrowRight", accion: "Rotar a la derecha" },
      arriba: { code: "ArrowUp", accion: "Propulsar" },
    },
    acciones: [
      { code: "Space", accion: "Disparar", etiqueta: "A", tono: "magenta" },
    ],
  },
  caida: {
    cruceta: {
      izquierda: { code: "ArrowLeft", accion: "Mover a la izquierda" },
      derecha: { code: "ArrowRight", accion: "Mover a la derecha" },
      arriba: { code: "ArrowUp", accion: "Rotar la pieza" },
      abajo: { code: "ArrowDown", accion: "Bajar más rápido" },
    },
    acciones: [
      {
        code: "Space",
        accion: "Soltar la pieza",
        etiqueta: "A",
        tono: "magenta",
      },
    ],
  },
  // Sin botón de acción: la pelota sale sola. Y con arrastre, que es el control
  // natural del juego — el motor ya traduce el puntero a posición de paleta.
  "bloque-buster": {
    cruceta: {
      izquierda: {
        code: "ArrowLeft",
        accion: "Mover la paleta a la izquierda",
      },
      derecha: { code: "ArrowRight", accion: "Mover la paleta a la derecha" },
    },
    acciones: [],
    arrastre: true,
  },
  serpentina: {
    cruceta: {
      izquierda: { code: "ArrowLeft", accion: "Girar a la izquierda" },
      derecha: { code: "ArrowRight", accion: "Girar a la derecha" },
      arriba: { code: "ArrowUp", accion: "Girar hacia arriba" },
      abajo: { code: "ArrowDown", accion: "Girar hacia abajo" },
    },
    acciones: [],
  },
  ranaria: {
    cruceta: {
      izquierda: { code: "ArrowLeft", accion: "Saltar a la izquierda" },
      derecha: { code: "ArrowRight", accion: "Saltar a la derecha" },
      arriba: { code: "ArrowUp", accion: "Saltar hacia arriba" },
      abajo: { code: "ArrowDown", accion: "Saltar hacia atrás" },
    },
    acciones: [],
  },
};
