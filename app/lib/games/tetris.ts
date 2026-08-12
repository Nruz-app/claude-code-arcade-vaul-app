// ===== app/lib/games/tetris.ts =====
// Motor de CAÍDA (Tetris), portado de
// references/templates/started-games/03-tetris/game.js.
//
// Diferencias con el original, todas deliberadas:
//  - Sin variables globales de módulo: el estado de partida vive en el closure
//    de createTetrisGame (paso 5). El original declara trece globales en una
//    línea y llama a init() en el propio import; en Next eso sobrevive entre
//    montajes y volver a la pantalla arrastraría el tablero de la partida
//    anterior.
//  - Las funciones de tablero reciben el `board` como argumento en vez de
//    leerlo del módulo, así son puras y comprobables por separado.
//  - Sin HUD ni overlay dentro del canvas: el original los pinta en el DOM con
//    once getElementById; aquí la puntuación, el nivel y las vidas salen por
//    los callbacks y los pinta la plataforma.
//  - Un solo canvas: el original usa uno para el tablero y otro para la pieza
//    siguiente. GameFactory recibe uno, así que el preview va en el panel
//    lateral del mismo canvas.

import type { GameFactory, GameOverReason, GameOverSummary } from "./types";

// ── Constantes ────────────────────────────────────────────────────────────────

// Resolución lógica. El ajuste al contenedor es puramente CSS: el reproductor
// fija el canvas en 800×600 y .crt-screen declara aspect-ratio 4/3.
export const W = 800;
export const H = 600;

const COLS = 10;
const ROWS = 20;
const BLOCK = 28; // 10×28 = 280 de ancho, 20×28 = 560 de alto

// El tablero no llena el canvas. Se coloca a la izquierda del centro y el panel
// de la pieza siguiente ocupa el hueco de la derecha. El conjunto mide 428
// (pozo 280 + hueco 60 + panel 88) y queda centrado con 186 px libres a cada
// lado; si cambia PREVIEW_BLOCK hay que recalcular estos dos valores.
const BOARD_X = 186;
const BOARD_Y = 20; // (600 − 560) / 2
const PANEL_X = 526;

// Puntos por líneas limpiadas de una vez, multiplicados por el nivel.
const LINE_SCORES = [0, 100, 300, 500, 800];

const DROP_BASE = 1000; // ms entre caídas en el nivel 1
const DROP_STEP = 90; // menos por cada nivel
const DROP_MIN = 100; // suelo de velocidad

// Repetición de teclas propia (paso 3), en ms. El auto-repeat del sistema
// operativo se configura por máquina: sin esto, el mismo juego se controlaría
// distinto en cada ordenador.
const DAS_DELAY = 170; // espera antes de empezar a repetir
const DAS_PERIOD = 50; // periodo de repetición

// Paleta de las ocho piezas. Los cuatro primeros son los tokens de :root en
// app/globals.css, copiados aquí porque el canvas no entiende de variables CSS;
// los cuatro siguientes son vecinos de la misma familia neón, porque el tema
// solo tiene cuatro colores y Tetris necesita distinguir ocho piezas. Si el
// tema cambia, hay que tocar los dos sitios.
//
// Indexados desde 0, pero en el tablero una celda vacía es 0 y una ocupada
// guarda el tipo de pieza (1..8): el color de una celda es COLORS[celda - 1].
const COLORS = [
  "#00f5ff", // I — --cyan
  "#f5ff00", // O — --yellow
  "#ff006e", // T — --magenta
  "#00ff88", // S — --green
  "#ff5c00", // Z — naranja neón
  "#4d7cff", // J — azul eléctrico
  "#b14dff", // L — violeta
  "#9aa0b5", // N — gris metálico (tuerca)
] as const;

const GRID_COLOR = "rgba(230,233,255,0.07)"; // --ink muy atenuado
const EMPTY = 0;

// ── Piezas ────────────────────────────────────────────────────────────────────

export type Shape = number[][];
export type Board = number[][];

export interface Piece {
  type: number; // 1..8, el valor que se escribe en el tablero
  shape: Shape;
  x: number;
  y: number;
}

// Las siete clásicas más la tuerca. Cada celda guarda el tipo de la pieza para
// que al fusionarla en el tablero el color viaje con ella.
//
// La tuerca (N) no es una pieza estándar de Tetris: es un 3×3 con el centro
// hueco que sale con la misma probabilidad que las demás y deja un agujero
// imposible de rellenar. Está en el código de referencia aunque su propio
// CLAUDE.md no la mencione, y se conserva a propósito (ver SPEC 08).
const SHAPES: readonly Shape[] = [
  [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ], // I
  [
    [2, 2],
    [2, 2],
  ], // O
  [
    [0, 3, 0],
    [3, 3, 3],
    [0, 0, 0],
  ], // T
  [
    [0, 4, 4],
    [4, 4, 0],
    [0, 0, 0],
  ], // S
  [
    [5, 5, 0],
    [0, 5, 5],
    [0, 0, 0],
  ], // Z
  [
    [6, 0, 0],
    [6, 6, 6],
    [0, 0, 0],
  ], // J
  [
    [0, 0, 7],
    [7, 7, 7],
    [0, 0, 0],
  ], // L
  [
    [8, 8, 8],
    [8, 0, 8],
    [8, 8, 8],
  ], // N — tuerca
];

// ── Utilidades de tablero ─────────────────────────────────────────────────────

// Todas reciben el tablero como argumento: son puras y no dependen de que haya
// una partida en curso.

export function createBoard(): Board {
  return Array.from({ length: ROWS }, () =>
    new Array<number>(COLS).fill(EMPTY),
  );
}

export function randomPiece(): Piece {
  const index = Math.floor(Math.random() * SHAPES.length);
  // Copia profunda: rotar una pieza no debe mutar la plantilla compartida.
  const shape = SHAPES[index].map((row) => [...row]);
  return {
    type: index + 1,
    shape,
    x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2),
    y: 0,
  };
}

// ¿Chocaría `shape` si se colocara en (ox, oy)? Cuenta como choque salirse por
// los lados o por abajo, y solaparse con una celda ya ocupada. Por arriba no:
// las piezas entran desde fuera del tablero.
export function collide(
  board: Board,
  shape: Shape,
  ox: number,
  oy: number,
): boolean {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx] !== EMPTY) return true;
    }
  }
  return false;
}

// Rotación horaria: transponer y volver del revés cada fila.
export function rotateCW(shape: Shape): Shape {
  const rows = shape.length;
  const cols = shape[0].length;
  const result: Shape = Array.from({ length: cols }, () =>
    new Array<number>(rows).fill(EMPTY),
  );
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      result[c][rows - 1 - r] = shape[r][c];
    }
  }
  return result;
}

// ── Mecánicas de tablero ──────────────────────────────────────────────────────

// Desplazamientos que se prueban al rotar pegado a una pared o a otra pieza.
// Sin ellos, rotar contra el borde simplemente no hace nada y se siente roto.
const WALL_KICKS = [0, -1, 1, -2, 2] as const;

// Devuelve la pieza ya rotada y desplazada, o null si no cabe con ningún kick.
// No muta la pieza recibida: quien llama decide si adopta el resultado.
export function tryRotate(board: Board, piece: Piece): Piece | null {
  const rotated = rotateCW(piece.shape);
  for (const kick of WALL_KICKS) {
    if (!collide(board, rotated, piece.x + kick, piece.y)) {
      return { ...piece, shape: rotated, x: piece.x + kick };
    }
  }
  return null;
}

// Fija la pieza en el tablero. Muta `board` a propósito: es el estado del
// juego, no un valor. La comprobación de rango evita escribir fuera de la
// matriz si la pieza asoma por arriba, cosa que el original no cubre.
export function merge(board: Board, piece: Piece): void {
  for (let r = 0; r < piece.shape.length; r++) {
    for (let c = 0; c < piece.shape[r].length; c++) {
      if (!piece.shape[r][c]) continue;
      const y = piece.y + r;
      const x = piece.x + c;
      if (y < 0 || y >= ROWS || x < 0 || x >= COLS) continue;
      board[y][x] = piece.shape[r][c];
    }
  }
}

// Elimina las filas completas y devuelve cuántas eran. Recorre de abajo arriba
// y, tras quitar una fila, vuelve a mirar el mismo índice (`r++` compensa el
// `r--` del bucle): al desplazarse todo hacia abajo, en esa posición hay ahora
// una fila distinta que también puede estar completa.
export function clearLines(board: Board): number {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every((v) => v !== EMPTY)) {
      board.splice(r, 1);
      board.unshift(new Array<number>(COLS).fill(EMPTY));
      cleared++;
      r++;
    }
  }
  return cleared;
}

// Fila en la que aterrizaría la pieza si cayera ya. Sirve para dibujar el
// fantasma y para el hard drop, que es la misma proyección.
export function ghostY(board: Board, piece: Piece): number {
  let y = piece.y;
  while (!collide(board, piece.shape, piece.x, y + 1)) y++;
  return y;
}

// ── Progresión ────────────────────────────────────────────────────────────────

export function levelFor(lines: number): number {
  return Math.floor(lines / 10) + 1;
}

// Cuanto más alto el nivel, menos tiempo entre caídas, con un suelo para que
// siga siendo jugable.
export function dropIntervalFor(level: number): number {
  return Math.max(DROP_MIN, DROP_BASE - (level - 1) * DROP_STEP);
}

// Puntos por limpiar varias líneas de una vez, escalados por el nivel. Un
// tetris (cuatro líneas) renta ocho veces más que cuatro líneas sueltas.
export function scoreForLines(cleared: number, level: number): number {
  return (LINE_SCORES[cleared] ?? 0) * level;
}

// ── Teclado ───────────────────────────────────────────────────────────────────

// Códigos de las teclas del juego. Se usa `e.code` y no `e.key` para que no
// dependa de la distribución del teclado.
export const KEY_LEFT = "ArrowLeft";
export const KEY_RIGHT = "ArrowRight";
export const KEY_DOWN = "ArrowDown";
export const KEY_ROTATE = "ArrowUp";
export const KEY_ROTATE_ALT = "KeyX";
export const KEY_DROP = "Space";

// Las teclas del juego que además hacen scroll en la página. Se les corta el
// comportamiento por defecto, pero solo mientras el motor está enganchado:
// fuera de la partida el teclado vuelve a funcionar con normalidad.
const PREVENT_DEFAULT = new Set([
  KEY_LEFT,
  KEY_RIGHT,
  KEY_DOWN,
  KEY_ROTATE,
  KEY_DROP,
]);

export class Input {
  private held: Record<string, boolean> = {};
  private fresh: Record<string, boolean> = {};
  // ms que faltan para la siguiente repetición de cada tecla mantenida.
  private dasTimer: Record<string, number> = {};
  private attached = false;

  private onKeyDown = (e: KeyboardEvent) => {
    if (PREVENT_DEFAULT.has(e.code)) e.preventDefault();
    // El auto-repeat del sistema se descarta entero: su cadencia depende de la
    // configuración de cada máquina, así que la repetición la genera pulses()
    // con un ritmo igual para todos. Descartarlo aquí es además lo que impide
    // que mantener ↑ pulsado haga girar la pieza sin parar.
    if (e.repeat) return;
    if (!this.held[e.code]) {
      this.fresh[e.code] = true;
      this.dasTimer[e.code] = DAS_DELAY;
    }
    this.held[e.code] = true;
  };

  private onKeyUp = (e: KeyboardEvent) => {
    if (PREVENT_DEFAULT.has(e.code)) e.preventDefault();
    this.held[e.code] = false;
    delete this.dasTimer[e.code];
  };

  attach() {
    if (this.attached) return;
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    this.attached = true;
  }

  detach() {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    this.attached = false;
    this.clear();
  }

  // Para las acciones que ocurren una sola vez por pulsación: rotar y soltar.
  // Se consume al leerla, así que devuelve true una vez y no vuelve a hacerlo
  // hasta que la tecla se suelte y se pulse de nuevo.
  wasPressed(code: string): boolean {
    const value = !!this.fresh[code];
    this.fresh[code] = false;
    return value;
  }

  // Para las acciones repetibles: mover a los lados y bajar. Devuelve cuántas
  // veces debe actuar la tecla en este frame — una al pulsarla, y después una
  // por cada periodo cumplido mientras siga abajo, tras la espera inicial.
  //
  // Asume el `dt` capado del bucle (50 ms): con el cap, el bucle interno da a
  // lo sumo un par de vueltas.
  pulses(code: string, dtMs: number): number {
    if (!this.held[code]) return 0;

    if (this.fresh[code]) {
      this.fresh[code] = false;
      this.dasTimer[code] = DAS_DELAY;
      return 1;
    }

    let count = 0;
    this.dasTimer[code] = (this.dasTimer[code] ?? DAS_DELAY) - dtMs;
    while (this.dasTimer[code] <= 0) {
      count++;
      this.dasTimer[code] += DAS_PERIOD;
    }
    return count;
  }

  // Al pausar conviene olvidar lo pulsado, o al reanudar la pieza sale
  // desplazándose con una tecla que el jugador ya soltó.
  clear() {
    this.held = {};
    this.fresh = {};
    this.dasTimer = {};
  }
}

// ── Dibujo ────────────────────────────────────────────────────────────────────

// Nada de HUD aquí: puntuación, nivel, vidas, fin de partida y pausa los pinta
// la plataforma. El canvas dibuja el pozo, las piezas y el panel lateral con lo
// que el contrato no sabe transportar — la pieza siguiente y las líneas.

const PREVIEW_BLOCK = 22; // lado de celda en el recuadro de la pieza siguiente
const PREVIEW_BOX = 4 * PREVIEW_BLOCK; // el marco es de 4×4 celdas

const WELL_BG = "#0f0f18"; // --bg-2
const WELL_BORDER = "rgba(0,245,255,0.18)"; // --line
const LABEL_COLOR = "#8a8fb5"; // --ink-dim
const VALUE_COLOR = "#e6e9ff"; // --ink

// Se usa monospace y no la Press Start 2P del tema: next/font genera un nombre
// de familia con hash que el canvas no puede resolver por su variable CSS, y
// una fuente que no carga degrada a un fallback impredecible. El texto del
// panel es corto y en mayúsculas, donde monospace encaja con la estética.
const LABEL_FONT = 'bold 11px ui-monospace, "Courier New", monospace';
const VALUE_FONT = 'bold 20px ui-monospace, "Courier New", monospace';

// Un bloque, en píxeles absolutos del canvas. El +1/−2 deja una junta oscura
// entre celdas contiguas y la banda superior clara simula el relieve del
// original.
function drawCell(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  type: number,
  size: number,
  alpha = 1,
): void {
  const color = COLORS[type - 1];
  if (!color) return;

  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.fillRect(px + 1, py + 1, size - 2, size - 2);
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  ctx.fillRect(px + 1, py + 1, size - 2, Math.max(2, Math.round(size * 0.14)));
  ctx.globalAlpha = 1;
}

// Fondo y borde del área de juego. El original no lo necesita porque su canvas
// es exactamente el tablero; aquí el pozo flota dentro de 800×600 y sin marco
// no se distinguiría del vacío.
export function drawWell(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = WELL_BG;
  ctx.fillRect(BOARD_X, BOARD_Y, COLS * BLOCK, ROWS * BLOCK);
  ctx.strokeStyle = WELL_BORDER;
  ctx.lineWidth = 2;
  ctx.strokeRect(BOARD_X - 1, BOARD_Y - 1, COLS * BLOCK + 2, ROWS * BLOCK + 2);
}

// El medio píxel evita que una línea de 1 px quede repartida entre dos
// columnas de píxeles y se vea gris y difusa.
export function drawGrid(ctx: CanvasRenderingContext2D): void {
  ctx.strokeStyle = GRID_COLOR;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let c = 1; c < COLS; c++) {
    const x = BOARD_X + c * BLOCK + 0.5;
    ctx.moveTo(x, BOARD_Y);
    ctx.lineTo(x, BOARD_Y + ROWS * BLOCK);
  }
  for (let r = 1; r < ROWS; r++) {
    const y = BOARD_Y + r * BLOCK + 0.5;
    ctx.moveTo(BOARD_X, y);
    ctx.lineTo(BOARD_X + COLS * BLOCK, y);
  }
  ctx.stroke();
}

export function drawBoard(ctx: CanvasRenderingContext2D, board: Board): void {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = board[r][c];
      if (cell === EMPTY) continue;
      drawCell(ctx, BOARD_X + c * BLOCK, BOARD_Y + r * BLOCK, cell, BLOCK);
    }
  }
}

// `atY` permite dibujar la misma pieza en otra fila sin copiarla: es lo que usa
// el fantasma. Las celdas por encima del pozo no se pintan, porque una pieza
// recién aparecida asoma por arriba.
export function drawPiece(
  ctx: CanvasRenderingContext2D,
  piece: Piece,
  atY: number,
  alpha = 1,
): void {
  for (let r = 0; r < piece.shape.length; r++) {
    for (let c = 0; c < piece.shape[r].length; c++) {
      const cell = piece.shape[r][c];
      if (!cell) continue;
      const y = atY + r;
      if (y < 0 || y >= ROWS) continue;
      drawCell(
        ctx,
        BOARD_X + (piece.x + c) * BLOCK,
        BOARD_Y + y * BLOCK,
        cell,
        BLOCK,
        alpha,
      );
    }
  }
}

// Panel derecho: la pieza que viene y las líneas hechas. Las líneas se dibujan
// aquí porque el contrato de motor no tiene ningún callback que las
// transporte, y son la métrica central de Tetris.
export function drawPanel(
  ctx: CanvasRenderingContext2D,
  next: Piece,
  lines: number,
): void {
  const boxY = BOARD_Y + 34;

  ctx.font = LABEL_FONT;
  ctx.fillStyle = LABEL_COLOR;
  ctx.textBaseline = "alphabetic";
  ctx.fillText("SIGUIENTE", PANEL_X, BOARD_Y + 20);

  ctx.strokeStyle = WELL_BORDER;
  ctx.lineWidth = 1;
  ctx.strokeRect(PANEL_X + 0.5, boxY + 0.5, PREVIEW_BOX, PREVIEW_BOX);

  // Centrado dentro del recuadro de 4×4, que es la pieza más ancha (la I).
  const shape = next.shape;
  const offX = (4 - shape[0].length) / 2;
  const offY = (4 - shape.length) / 2;
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      const cell = shape[r][c];
      if (!cell) continue;
      drawCell(
        ctx,
        PANEL_X + (offX + c) * PREVIEW_BLOCK,
        boxY + (offY + r) * PREVIEW_BLOCK,
        cell,
        PREVIEW_BLOCK,
      );
    }
  }

  ctx.font = LABEL_FONT;
  ctx.fillStyle = LABEL_COLOR;
  ctx.fillText("LÍNEAS", PANEL_X, boxY + PREVIEW_BOX + 46);

  ctx.font = VALUE_FONT;
  ctx.fillStyle = VALUE_COLOR;
  ctx.fillText(String(lines), PANEL_X, boxY + PREVIEW_BOX + 74);
}

// ── Motor ─────────────────────────────────────────────────────────────────────

export const createTetrisGame: GameFactory = (canvas, callbacks) => {
  const context2d = canvas.getContext("2d");
  if (!context2d) throw new Error("CAÍDA necesita un canvas 2D");
  // Con tipo explícito: el estrechamiento del guard no llega hasta draw(), que
  // es un closure.
  const ctx: CanvasRenderingContext2D = context2d;

  const input = new Input();

  // Todo el estado de partida vive aquí dentro. A nivel de módulo sobreviviría
  // entre montajes y volver a la pantalla arrastraría la partida anterior.
  let board: Board = createBoard();
  let current: Piece = randomPiece();
  let next: Piece = randomPiece();
  let score = 0;
  let lines = 0;
  let level = 1;
  let state: "playing" | "paused" | "gameover" = "playing";
  let dropAccum = 0; // ms acumulados hacia la siguiente caída automática
  let dropInterval = DROP_BASE;
  let rafId: number | null = null;
  let lastTime: number | null = null;
  // Tiempo jugado, no transcurrido: se acumula con el dt del bucle, que deja de
  // correr al pausar. Las pausas quedan fuera sin lógica extra.
  let elapsedMs = 0;

  // Los callbacks provocan renders de React: solo se emite cuando el valor
  // cambia de verdad.
  function setScore(value: number) {
    if (value === score) return;
    score = value;
    callbacks.onScore(score);
  }

  function setLevel(value: number) {
    if (value === level) return;
    level = value;
    callbacks.onLevel(level);
  }

  function summary(reason: GameOverReason): GameOverSummary {
    return { score, level, durationMs: Math.round(elapsedMs), reason };
  }

  // Único camino hacia el fin de partida, y por tanto el único sitio donde vive
  // la guardia: sin ella, rendirse tras un game over natural emitiría el
  // resumen dos veces y registraría la partida por duplicado en Supabase.
  function finish(reason: GameOverReason) {
    if (state === "gameover") return;
    state = "gameover";
    stopLoop();
    // CAÍDA no tiene vidas: se emite 1 al empezar y 0 al acabar, para que el
    // HUD no se quede mostrando los tres corazones que pone por defecto.
    callbacks.onLives(0);
    callbacks.onGameOver(summary(reason));
  }

  function initGame() {
    board = createBoard();
    current = randomPiece();
    next = randomPiece();
    score = 0;
    lines = 0;
    level = 1;
    state = "playing";
    dropAccum = 0;
    dropInterval = dropIntervalFor(level);
    elapsedMs = 0;
    lastTime = null;
    input.clear();

    // Emitidos directamente, sin pasar por los setters: al reiniciar los
    // valores coinciden con los de la partida anterior y el HUD se quedaría
    // enseñando la puntuación vieja.
    callbacks.onScore(score);
    callbacks.onLevel(level);
    callbacks.onLives(1);
  }

  function spawnNext() {
    current = next;
    next = randomPiece();
    // Si la pieza nueva no cabe, el pozo está lleno: se acabó.
    if (collide(board, current.shape, current.x, current.y)) {
      finish("game_over");
    }
  }

  function lockPiece() {
    merge(board, current);
    const cleared = clearLines(board);
    if (cleared > 0) {
      lines += cleared;
      // El orden importa: los puntos se cobran al nivel en el que se hizo la
      // línea, y solo después sube el nivel. Es lo que hace el original.
      setScore(score + scoreForLines(cleared, level));
      setLevel(levelFor(lines));
      dropInterval = dropIntervalFor(level);
    }
    spawnNext();
  }

  function move(dx: number) {
    if (!collide(board, current.shape, current.x + dx, current.y)) {
      current.x += dx;
    }
  }

  function softDrop() {
    if (!collide(board, current.shape, current.x, current.y + 1)) {
      current.y++;
      setScore(score + 1);
    } else {
      lockPiece();
    }
  }

  function hardDrop() {
    const y = ghostY(board, current);
    setScore(score + (y - current.y) * 2);
    current.y = y;
    lockPiece();
  }

  function update(dt: number) {
    if (state !== "playing") return;

    const dtMs = dt * 1000;
    elapsedMs += dtMs;

    for (let i = input.pulses(KEY_LEFT, dtMs); i > 0; i--) move(-1);
    for (let i = input.pulses(KEY_RIGHT, dtMs); i > 0; i--) move(1);
    for (let i = input.pulses(KEY_DOWN, dtMs); i > 0; i--) {
      softDrop();
      if (state !== "playing") return; // el soft drop pudo terminar la partida
    }

    // Las dos teclas de rotación se consumen siempre, sin cortocircuito: con
    // `a() || b()`, pulsar ↑ dejaría la X sin consumir y giraría de más en el
    // frame siguiente.
    const rotaUp = input.wasPressed(KEY_ROTATE);
    const rotaX = input.wasPressed(KEY_ROTATE_ALT);
    if (rotaUp || rotaX) {
      const rotated = tryRotate(board, current);
      if (rotated) current = rotated;
    }

    if (input.wasPressed(KEY_DROP)) {
      hardDrop();
      if (state !== "playing") return;
    }

    dropAccum += dtMs;
    if (dropAccum >= dropInterval) {
      dropAccum = 0;
      if (!collide(board, current.shape, current.x, current.y + 1)) {
        current.y++;
      } else {
        lockPiece();
      }
    }
  }

  // Se limpia en vez de pintar un fondo opaco: así el área que rodea al pozo
  // deja ver el fondo del marco CRT en lugar de un rectángulo negro pegado.
  function draw() {
    ctx.clearRect(0, 0, W, H);
    drawWell(ctx);
    drawGrid(ctx);
    drawBoard(ctx, board);
    if (state !== "gameover") {
      drawPiece(ctx, current, ghostY(board, current), 0.2);
      drawPiece(ctx, current, current.y);
    }
    drawPanel(ctx, next, lines);
  }

  function loop(ts: number) {
    // dt capado: sin el tope, volver de otra pestaña haría caer la pieza varias
    // filas de golpe en un solo frame.
    const dt = lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, 0.05);
    lastTime = ts;

    update(dt);
    draw();

    if (state === "gameover") {
      rafId = null;
      return;
    }
    rafId = requestAnimationFrame(loop);
  }

  function stopLoop() {
    if (rafId !== null) cancelAnimationFrame(rafId);
    rafId = null;
    // Sin esto, reanudar produciría un dt enorme con el tiempo en pausa dentro.
    lastTime = null;
  }

  return {
    // Re-entrante: es también lo que usa "JUGAR DE NUEVO" del modal de fin.
    start() {
      stopLoop();
      initGame();
      input.attach();
      rafId = requestAnimationFrame(loop);
    },

    pause() {
      if (state !== "playing") return;
      state = "paused";
      input.clear();
      stopLoop();
      draw(); // deja el frame congelado bajo el overlay de la plataforma
    },

    resume() {
      if (state !== "paused") return;
      // También aquí, y no solo al pausar: los listeners siguen enganchados
      // durante la pausa, así que lo que se teclee con el juego congelado queda
      // registrado y se ejecutaría de golpe al reanudar — pulsar ESPACIO en la
      // pausa soltaría la pieza nada más volver.
      input.clear();
      state = "playing";
      rafId = requestAnimationFrame(loop);
    },

    end() {
      finish("surrender");
    },

    // Desmontar no es terminar una partida: no emite onGameOver.
    destroy() {
      stopLoop();
      input.detach();
    },
  };
};
