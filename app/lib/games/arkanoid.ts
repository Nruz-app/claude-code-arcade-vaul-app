// ===== app/lib/games/arkanoid.ts =====
// Motor de BLOQUE BUSTER (Arkanoid), portado de
// references/templates/started-games/04-arkanoid/{game.js,levels.js}.
//
// Diferencias con el original, todas deliberadas (ver SPEC 09):
//  - Sin variables globales de módulo: el estado de partida vive en el closure
//    de createArkanoidGame (paso 6). El original guarda ocho globales y arranca
//    el bucle en el propio import, dentro del callback de loadSpritesheet(); en
//    Next eso sobrevive entre montajes y volver a la pantalla arrastraría la
//    muralla de la partida anterior.
//  - Sin spritesheet ni sonidos: los bloques, la paleta y la pelota se dibujan
//    con formas y la paleta neón del tema. Cargar una imagen es asíncrono y
//    GameFactory es síncrona, así que habría frames sin sprites.
//  - Sin HUD ni overlays dentro del canvas: el original pinta puntuación, nivel
//    y vidas arriba, más un overlay de pausa con botones clicables para saltar
//    de nivel. Aquí todo eso sale por los callbacks y lo pinta la plataforma;
//    el selector de nivel era depuración y desaparece.
//  - Los niveles ya no llevan su velocidad: los cinco patrones se reciclan
//    indefinidamente y la velocidad depende del número de nivel (levelSpeed).

import type { GameFactory, GameOverReason, GameOverSummary } from "./types";

// ── Constantes ────────────────────────────────────────────────────────────────

// Resolución lógica. El ajuste al contenedor es puramente CSS: el reproductor
// fija el canvas en 800×600 y .crt-screen declara aspect-ratio 4/3.
export const W = 800;
export const H = 600;

// Geometría de la muralla, portada tal cual de la referencia: 10×6 bloques de
// 64×24 centrados. Al no dibujar HUD dentro del canvas sobra el margen
// superior, pero se mantiene el original para no rehacer los cinco patrones.
const BLOCK_COLS = 10;
const BLOCK_ROWS = 6;
const BLOCK_W = 64;
const BLOCK_H = 24;
const BLOCKS_ORIGIN_X = (W - BLOCK_COLS * BLOCK_W) / 2; // 80
const BLOCKS_ORIGIN_Y = 80;

const PADDLE_W = 88;
const PADDLE_H = 14;
const PADDLE_Y = 552;
const PADDLE_SPEED = 480; // px/s con teclado

const BALL_SIZE = 14;
const BALL_SPEED = 380; // módulo, px/s, en el nivel 1
const MAX_BOUNCE_ANGLE = (60 * Math.PI) / 180; // desde la vertical, en los extremos
const LAUNCH_ANGLE = (35 * Math.PI) / 180; // salida inicial, lado aleatorio

// Ruido que se suma al ángulo de salida de la paleta. Existe por un caso
// concreto y medido: con la paleta exactamente centrada bajo la pelota el
// rebote sale vertical puro, y la pelota se queda taladrando una sola columna
// —en una simulación de 40 000 frames quedaban 52 bloques vivos en 9 columnas
// sin tocar—. Es pequeño a propósito: a lo ancho de la pantalla desvía unos
// 13 px, suficiente para que el bucle se deshaga solo y poco para estorbar a
// quien apunta.
const BOUNCE_JITTER = (1.5 * Math.PI) / 180;

// Progresión. El original multiplica la velocidad por 1.1 en cada uno de sus
// cinco niveles y ahí se acaba el juego; aquí sigue haciéndolo indefinidamente,
// con tope: sin él, hacia el nivel 15 la pelota va más rápido de lo que un
// humano reacciona y la partida termina sola.
const SPEED_STEP = 1.1;
const SPEED_MAX = 2.4; // el tope se alcanza en el nivel 11

// La pelota se integra en sub-pasos de este tamaño máximo (paso 3). Sin esto, a
// SPEED_MAX y con dt de 50 ms recorre 45 px por frame: más que el alto de un
// bloque (24), y lo atraviesa sin llegar a tocarlo.
const SUBSTEP_MAX = 6;

const START_LIVES = 3;

// Puntuación reescalada (ver Decisiones de la SPEC 09): la del original son 10
// puntos planos por bloque, un orden de magnitud por debajo del resto del Salón
// de la Fama.
const BLOCK_POINTS = 100; // × nivel
const LEVEL_BONUS = 1000; // × nivel, al limpiar la muralla
const LIFE_BONUS = 500; // × vidas restantes, al limpiar la muralla

const PARTICLES_PER_BLOCK = 8;
const PARTICLE_MS = 300; // vida de una partícula

// ── Colores ───────────────────────────────────────────────────────────────────

// Los siete nombres de color de levels.js mapeados a la paleta neón. Los cuatro
// que llevan comentario de token son los de :root en app/globals.css, copiados
// aquí porque el canvas no entiende de variables CSS; si el tema cambia, hay que
// tocar los dos sitios. Son los mismos literales que usa tetris.ts.
const BLOCK_COLORS = {
  red: "#ff2d55", // rojo neón
  yellow: "#f5ff00", // --yellow
  cyan: "#00f5ff", // --cyan
  magenta: "#ff006e", // --magenta
  hotpink: "#ff5cae", // rosa claro
  green: "#00ff88", // --green
  gray: "#9aa0b5", // gris metálico
} as const;

const PADDLE_COLOR = "#00f5ff"; // --cyan, el acento de bloque-buster en GAMES
const BALL_COLOR = "#e6e9ff"; // --ink
const BG_COLOR = "#000";

// ── Tipos ─────────────────────────────────────────────────────────────────────

export type BlockColor = keyof typeof BLOCK_COLORS;

// Un bloque tal y como lo describe un patrón: en coordenadas de rejilla, sin
// píxeles. La conversión a canvas ocurre al cargar el nivel (paso 6).
export interface BlockDef {
  col: number;
  row: number;
  color: BlockColor;
}

export interface LevelDef {
  blocks: readonly BlockDef[];
}

// Un bloque vivo en la partida. `alive` en vez de sacarlo del array porque el
// bucle recorre la muralla entera y filtrar en cada impacto es más caro.
export interface Block {
  x: number;
  y: number;
  w: number;
  h: number;
  color: BlockColor;
  alive: boolean;
}

export interface Paddle {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Ball {
  x: number;
  y: number;
  size: number;
  vx: number;
  vy: number;
}

// Sustituyen a los cuatro frames de explosión del spritesheet original.
export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: BlockColor;
  elapsed: number; // ms vividos; muere al llegar a PARTICLE_MS
}

// ── Niveles ───────────────────────────────────────────────────────────────────

// Los cinco patrones de levels.js, portados sin su campo `speed`: la velocidad
// ya no es propiedad del patrón sino del número de nivel, porque los patrones se
// reciclan (ver levelSpeed).
//
// Es una función y no una constante de módulo por costumbre del contrato: nada
// que dependa de una partida vive fuera del closure. Los patrones son inmutables
// y se construyen una vez al arrancar el motor.
export function buildLevels(): readonly LevelDef[] {
  const rowColors1: BlockColor[] = [
    "red",
    "yellow",
    "cyan",
    "magenta",
    "hotpink",
    "green",
  ];
  const rowColors2: BlockColor[] = [
    "gray",
    "cyan",
    "hotpink",
    "yellow",
    "magenta",
    "green",
  ];
  const rowColors4: BlockColor[] = [
    "cyan",
    "magenta",
    "green",
    "yellow",
    "hotpink",
    "red",
  ];

  // 1 — muralla completa, 60 bloques.
  const l1: BlockDef[] = [];
  for (let row = 0; row < BLOCK_ROWS; row++) {
    for (let col = 0; col < BLOCK_COLS; col++) {
      l1.push({ col, row, color: rowColors1[row] });
    }
  }

  // 2 — pirámide invertida, 40 bloques.
  const l2: BlockDef[] = [];
  const pyStart = [4, 3, 2, 1, 0, 0];
  const pyEnd = [5, 6, 7, 8, 9, 9];
  for (let row = 0; row < BLOCK_ROWS; row++) {
    for (let col = pyStart[row]; col <= pyEnd[row]; col++) {
      l2.push({ col, row, color: rowColors2[row] });
    }
  }

  // 3 — damero, 30 bloques.
  const l3: BlockDef[] = [];
  for (let row = 0; row < BLOCK_ROWS; row++) {
    for (let col = 0; col < BLOCK_COLS; col++) {
      if ((col + row) % 2 === 0) {
        l3.push({ col, row, color: row < 3 ? "yellow" : "magenta" });
      }
    }
  }

  // 4 — filas con huecos, 39 bloques.
  const gaps4 = [
    [2, 5, 8],
    [0, 4, 7, 9],
    [1, 3, 6],
    [2, 5, 8, 9],
    [0, 4, 7],
    [1, 3, 6, 9],
  ];
  const l4: BlockDef[] = [];
  for (let row = 0; row < BLOCK_ROWS; row++) {
    for (let col = 0; col < BLOCK_COLS; col++) {
      if (!gaps4[row].includes(col)) {
        l4.push({ col, row, color: rowColors4[row] });
      }
    }
  }

  // 5 — marco con cruz, 39 bloques.
  const l5: BlockDef[] = [];
  for (let row = 0; row < BLOCK_ROWS; row++) {
    for (let col = 0; col < BLOCK_COLS; col++) {
      const isFrame =
        col === 0 ||
        col === BLOCK_COLS - 1 ||
        row === 0 ||
        row === BLOCK_ROWS - 1;
      const isCross = col === 4 || row === 2;
      if (isFrame || isCross) {
        l5.push({ col, row, color: isCross && !isFrame ? "hotpink" : "cyan" });
      }
    }
  }

  return [
    { blocks: l1 },
    { blocks: l2 },
    { blocks: l3 },
    { blocks: l4 },
    { blocks: l5 },
  ];
}

// Multiplicador de velocidad de la pelota para un nivel. El nivel 1 vale 1 y
// cada nivel siguiente multiplica por SPEED_STEP hasta SPEED_MAX.
export function levelSpeed(level: number): number {
  return Math.min(SPEED_STEP ** (level - 1), SPEED_MAX);
}

// ── Colisiones ────────────────────────────────────────────────────────────────

// Todas reciben la pelota y lo que la golpea como argumentos y modifican la
// pelota en el sitio: son las únicas funciones de este archivo que mutan algo, y
// lo hacen sobre un objeto que les pasa el llamador, no sobre estado de módulo.

// Lo mínimo que necesitan las colisiones: bloques y paleta valen igual.
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// AABB, igual que el collideAABB del original.
export function overlaps(ball: Ball, box: Rect): boolean {
  return (
    ball.x < box.x + box.w &&
    ball.x + ball.size > box.x &&
    ball.y < box.y + box.h &&
    ball.y + ball.size > box.y
  );
}

// Rebote contra un bloque, invirtiendo el eje **realmente** penetrado. El
// original invierte siempre vy (game.js:141), así que una pelota que entra por
// el lateral sale rebotada hacia atrás sin motivo aparente.
//
// El eje se decide comparando cuánto ha penetrado la pelota por cada lado: la
// penetración menor es la del lado por el que entró. El signo de la velocidad
// dice qué lado del bloque hay que medir. Además se devuelve la pelota al borde
// para que el sub-paso siguiente no la encuentre otra vez dentro del bloque.
export function bounceOffBlock(ball: Ball, block: Rect): void {
  const penX =
    ball.vx > 0 ? ball.x + ball.size - block.x : block.x + block.w - ball.x;
  const penY =
    ball.vy > 0 ? ball.y + ball.size - block.y : block.y + block.h - ball.y;

  if (penX < penY) {
    ball.x += ball.vx > 0 ? -penX : penX;
    ball.vx = -ball.vx;
  } else {
    ball.y += ball.vy > 0 ? -penY : penY;
    ball.vy = -ball.vy;
  }
}

// Rebote contra la paleta: el punto de impacto decide el ángulo de salida.
// Golpear por el centro devuelve la pelota casi vertical; por los extremos, con
// hasta MAX_BOUNCE_ANGLE de inclinación. El original devuelve siempre el mismo
// ángulo (ball.vy = -Math.abs(ball.vy)), así que el jugador no controla nada y
// la pelota cae en trayectorias repetitivas de las que no se puede salir.
//
// `speed` es el módulo que debe conservar la velocidad. Recalcularla en vez de
// invertir componentes es lo que impide que la pelota se acelere o se frene sola
// a cada golpe: el módulo lo fija el nivel, no la acumulación de rebotes.
export function bounceOffPaddle(ball: Ball, paddle: Rect, speed: number): void {
  const ballCenter = ball.x + ball.size / 2;
  const paddleCenter = paddle.x + paddle.w / 2;
  const offset = clamp((ballCenter - paddleCenter) / (paddle.w / 2), -1, 1);
  // El ruido va acotado al mismo máximo que el resto: sin el clamp exterior, un
  // golpe en el extremo podría pasarse de MAX_BOUNCE_ANGLE y dejar la pelota
  // más horizontal de lo que el juego admite.
  const jitter = (Math.random() - 0.5) * 2 * BOUNCE_JITTER;
  const angle = clamp(
    offset * MAX_BOUNCE_ANGLE + jitter,
    -MAX_BOUNCE_ANGLE,
    MAX_BOUNCE_ANGLE,
  );

  ball.vx = Math.sin(angle) * speed;
  ball.vy = -Math.cos(angle) * speed;
  ball.y = paddle.y - ball.size; // apoyada encima, no dentro
}

// ── Integración ───────────────────────────────────────────────────────────────

// Lo que ha pasado durante un frame. El motor lo traduce a puntos, partículas y
// vidas; stepBall no sabe nada de eso.
export interface StepOutcome {
  broken: Block[]; // bloques rotos, como mucho uno por sub-paso
  lost: boolean; // la pelota se ha ido por abajo
}

// Mueve la pelota el desplazamiento de un frame, partido en sub-pasos de como
// mucho SUBSTEP_MAX píxeles, y resuelve las colisiones en cada uno.
//
// El original mueve la pelota de una vez por frame (game.js:113-114). Con la
// velocidad creciendo nivel a nivel eso rompe la detección: a SPEED_MAX y con el
// dt capado a 50 ms el desplazamiento son 45 px, más que el alto de un bloque,
// y la pelota lo atraviesa sin que overlaps() llegue a verlo nunca.
//
// El número de sub-pasos se calcula una vez, al principio: los rebotes cambian
// la dirección de la velocidad pero nunca su módulo, así que el tramo recorrido
// en cada sub-paso sigue acotado.
export function stepBall(
  ball: Ball,
  dt: number,
  paddle: Paddle,
  blocks: Block[],
  speed: number,
): StepOutcome {
  const outcome: StepOutcome = { broken: [], lost: false };

  const distance = Math.hypot(ball.vx * dt, ball.vy * dt);
  const steps = Math.max(1, Math.ceil(distance / SUBSTEP_MAX));
  const stepDt = dt / steps;

  for (let i = 0; i < steps; i++) {
    ball.x += ball.vx * stepDt;
    ball.y += ball.vy * stepDt;

    // Muros: izquierda, derecha y techo. Abajo no hay muro, ahí se pierde.
    if (ball.x <= 0) {
      ball.x = 0;
      ball.vx = Math.abs(ball.vx);
    }
    if (ball.x + ball.size >= W) {
      ball.x = W - ball.size;
      ball.vx = -Math.abs(ball.vx);
    }
    if (ball.y <= 0) {
      ball.y = 0;
      ball.vy = Math.abs(ball.vy);
    }

    // Paleta. Solo cuenta si la pelota baja y la toca por arriba: sin la
    // segunda condición, una pelota que roza la paleta desde abajo saltaría de
    // golpe a su borde superior.
    if (
      ball.vy > 0 &&
      overlaps(ball, paddle) &&
      ball.y + ball.size <= paddle.y + paddle.h
    ) {
      bounceOffPaddle(ball, paddle, speed);
    }

    // Un solo bloque por sub-paso, igual que el `break` del original: con
    // tramos de 6 px no da tiempo a tocar dos, y resolver dos rebotes seguidos
    // sobre la misma posición devolvería la pelota por donde vino.
    for (const block of blocks) {
      if (!block.alive) continue;
      if (!overlaps(ball, block)) continue;
      block.alive = false;
      bounceOffBlock(ball, block);
      outcome.broken.push(block);
      break;
    }

    if (ball.y > H) {
      outcome.lost = true;
      break;
    }
  }

  return outcome;
}

// ── Entrada ───────────────────────────────────────────────────────────────────

// Códigos de las teclas del juego. Se usa `e.code` y no `e.key` para que no
// dependa de la distribución del teclado.
export const KEY_LEFT = "ArrowLeft";
export const KEY_RIGHT = "ArrowRight";

// Las teclas del juego que además hacen scroll en la página. Se les corta el
// comportamiento por defecto, pero solo mientras el motor está enganchado:
// fuera de la partida el teclado vuelve a funcionar con normalidad.
const PREVENT_DEFAULT = new Set([KEY_LEFT, KEY_RIGHT]);

// Teclado y ratón. No hace falta ni DAS ni pulsaciones únicas como en CAÍDA: la
// paleta se mueve de forma continua mientras la tecla está abajo, así que basta
// con saber qué hay pulsado.
//
// Los handlers son propiedades flecha y no métodos: con un método,
// removeEventListener recibiría otra referencia y el listener no se quitaría
// nunca, con lo que salir de la pantalla y volver dejaría dos motores moviendo
// la misma paleta.
export class Input {
  private held: Record<string, boolean> = {};
  // Última posición del puntero traducida a coordenadas del canvas. Es null
  // mientras el ratón no se mueva; ver takePointerX().
  private pointerX: number | null = null;
  private attached = false;

  // El canvas es el que recibe la factory: los eventos de puntero se escuchan
  // ahí y no en `document`, para no vigilar toda la página.
  constructor(private canvas: HTMLCanvasElement) {}

  private onKeyDown = (e: KeyboardEvent) => {
    if (PREVENT_DEFAULT.has(e.code)) e.preventDefault();
    this.held[e.code] = true;
  };

  private onKeyUp = (e: KeyboardEvent) => {
    if (PREVENT_DEFAULT.has(e.code)) e.preventDefault();
    this.held[e.code] = false;
  };

  // El canvas se escala por CSS, así que las coordenadas del evento están en
  // píxeles de pantalla y hay que llevarlas a la resolución lógica.
  private onPointerMove = (e: PointerEvent) => {
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width === 0) return;
    this.pointerX = ((e.clientX - rect.left) * W) / rect.width;
  };

  attach() {
    if (this.attached) return;
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    this.canvas.addEventListener("pointermove", this.onPointerMove);
    this.attached = true;
  }

  detach() {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    this.canvas.removeEventListener("pointermove", this.onPointerMove);
    this.attached = false;
    this.clear();
  }

  isHeld(code: string): boolean {
    return !!this.held[code];
  }

  // Devuelve la posición del puntero **y la olvida**. Sin consumirla, el último
  // sitio donde estuvo el ratón se aplicaría en todos los frames siguientes y
  // las flechas no podrían mover la paleta: el ratón mandaría siempre, aunque
  // llevara parado un minuto. Así solo manda mientras se mueve.
  takePointerX(): number | null {
    const value = this.pointerX;
    this.pointerX = null;
    return value;
  }

  // Al pausar conviene olvidar lo pulsado, o al reanudar la paleta sale
  // corriendo con una tecla que el jugador ya soltó.
  clear() {
    this.held = {};
    this.pointerX = null;
  }
}

// ── Dibujo ────────────────────────────────────────────────────────────────────

// Nada de HUD aquí: puntuación, nivel, vidas, fin de partida y pausa los pinta
// la plataforma. El original dibuja las tres primeras dentro del canvas y añade
// un overlay de pausa con botones para saltar de nivel; todo eso desaparece.
//
// Tampoco hay spritesheet: las formas se dibujan con relleno plano, una banda
// clara arriba que simula el relieve del sprite original, y un halo corto con
// shadowBlur para que encajen con el neón del resto del portal.

const GLOW_BLOCK = 8;
const GLOW_PADDLE = 14;
const GLOW_BALL = 12;

const HIGHLIGHT = "rgba(255,255,255,0.14)"; // banda de relieve
const PADDLE_CORE = "rgba(255,255,255,0.35)"; // filo claro de la paleta

export function drawBackground(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = BG_COLOR;
  ctx.fillRect(0, 0, W, H);
}

// El +1/−2 deja una junta oscura entre bloques contiguos: sin ella, una fila
// entera del mismo color se ve como una banda maciza y no como diez piezas.
export function drawBlocks(
  ctx: CanvasRenderingContext2D,
  blocks: readonly Block[],
): void {
  ctx.shadowBlur = GLOW_BLOCK;
  for (const block of blocks) {
    if (!block.alive) continue;
    const color = BLOCK_COLORS[block.color];
    ctx.shadowColor = color;
    ctx.fillStyle = color;
    ctx.fillRect(block.x + 1, block.y + 1, block.w - 2, block.h - 2);
    ctx.fillStyle = HIGHLIGHT;
    ctx.fillRect(block.x + 1, block.y + 1, block.w - 2, 4);
  }
  ctx.shadowBlur = 0;
}

export function drawPaddle(
  ctx: CanvasRenderingContext2D,
  paddle: Paddle,
): void {
  ctx.shadowBlur = GLOW_PADDLE;
  ctx.shadowColor = PADDLE_COLOR;
  ctx.fillStyle = PADDLE_COLOR;
  ctx.fillRect(paddle.x, paddle.y, paddle.w, paddle.h);
  ctx.shadowBlur = 0;
  // Filo claro en el centro, para que se lea el punto que devuelve la pelota
  // en vertical: el ángulo de salida depende de dónde golpee (bounceOffPaddle).
  ctx.fillStyle = PADDLE_CORE;
  ctx.fillRect(paddle.x + paddle.w / 2 - 6, paddle.y + 3, 12, paddle.h - 6);
}

// Redonda, aunque las colisiones la traten como un cuadrado: con 14 px de lado
// la diferencia no se percibe jugando, y un cuadrado desentona junto al resto.
export function drawBall(ctx: CanvasRenderingContext2D, ball: Ball): void {
  const radius = ball.size / 2;
  ctx.shadowBlur = GLOW_BALL;
  ctx.shadowColor = PADDLE_COLOR;
  ctx.fillStyle = BALL_COLOR;
  ctx.beginPath();
  ctx.arc(ball.x + radius, ball.y + radius, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
}

// Sustituyen a los cuatro frames de explosión del spritesheet. Se encogen y se
// apagan a la vez: el tamaño hace el impacto y la opacidad lo disuelve.
export function drawParticles(
  ctx: CanvasRenderingContext2D,
  particles: readonly Particle[],
): void {
  for (const particle of particles) {
    const life = 1 - particle.elapsed / PARTICLE_MS;
    if (life <= 0) continue;
    const size = 2 + 4 * life;
    ctx.globalAlpha = life;
    ctx.fillStyle = BLOCK_COLORS[particle.color];
    ctx.fillRect(particle.x - size / 2, particle.y - size / 2, size, size);
  }
  ctx.globalAlpha = 1;
}

// ── Motor ─────────────────────────────────────────────────────────────────────

export const createArkanoidGame: GameFactory = (canvas, callbacks) => {
  const context2d = canvas.getContext("2d");
  if (!context2d) throw new Error("BLOQUE BUSTER necesita un canvas 2D");
  // Con tipo explícito: el estrechamiento del guard no llega hasta draw(), que
  // es un closure.
  const ctx: CanvasRenderingContext2D = context2d;

  const input = new Input(canvas);
  // Los patrones son inmutables y no dependen de la partida: se construyen una
  // vez por motor, no en cada nivel.
  const levels = buildLevels();

  // Todo el estado de partida vive aquí dentro. A nivel de módulo sobreviviría
  // entre montajes y volver a la pantalla arrastraría la partida anterior.
  const paddle: Paddle = {
    x: (W - PADDLE_W) / 2,
    y: PADDLE_Y,
    w: PADDLE_W,
    h: PADDLE_H,
  };
  const ball: Ball = { x: 0, y: 0, size: BALL_SIZE, vx: 0, vy: 0 };
  let blocks: Block[] = [];
  let particles: Particle[] = [];
  let score = 0;
  let lives = START_LIVES;
  let level = 1;
  let state: "playing" | "paused" | "gameover" = "playing";
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

  function setLives(value: number) {
    if (value === lives) return;
    lives = value;
    callbacks.onLives(lives);
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
  // la guardia: sin ella, rendirse tras quedarse sin vidas emitiría el resumen
  // dos veces y registraría la partida por duplicado en Supabase.
  function finish(reason: GameOverReason) {
    if (state === "gameover") return;
    state = "gameover";
    stopLoop();
    callbacks.onGameOver(summary(reason));
  }

  // El módulo de la velocidad de la pelota en el nivel actual. Es el que
  // conservan los rebotes: la velocidad la fija el nivel, no la acumulación de
  // golpes.
  function ballSpeed(): number {
    return BALL_SPEED * levelSpeed(level);
  }

  // Deja la pelota apoyada sobre la paleta centrada y la lanza hacia arriba, a
  // un lado o al otro. El original la lanza siempre en la misma dirección.
  function resetBall() {
    paddle.x = (W - paddle.w) / 2;
    const direction = Math.random() < 0.5 ? -1 : 1;
    const speed = ballSpeed();
    ball.x = paddle.x + (paddle.w - ball.size) / 2;
    ball.y = paddle.y - ball.size;
    ball.vx = Math.sin(LAUNCH_ANGLE) * speed * direction;
    ball.vy = -Math.cos(LAUNCH_ANGLE) * speed;
  }

  // Monta la muralla del nivel n. Los patrones se reciclan con el módulo, así
  // que n puede crecer indefinidamente: el nivel 6 vuelve al primer patrón, con
  // la velocidad que le toque.
  function loadLevel(n: number) {
    setLevel(n);
    const pattern = levels[(n - 1) % levels.length];
    blocks = pattern.blocks.map((definition) => ({
      x: BLOCKS_ORIGIN_X + definition.col * BLOCK_W,
      y: BLOCKS_ORIGIN_Y + definition.row * BLOCK_H,
      w: BLOCK_W,
      h: BLOCK_H,
      color: definition.color,
      alive: true,
    }));
    particles = [];
    resetBall();
  }

  function initGame() {
    score = 0;
    lives = START_LIVES;
    level = 1;
    state = "playing";
    elapsedMs = 0;
    lastTime = null;
    particles = [];
    input.clear();

    // Emitidos directamente, sin pasar por los setters: al reiniciar los
    // valores coinciden con los de la partida anterior y el HUD se quedaría
    // enseñando la puntuación vieja.
    callbacks.onScore(score);
    callbacks.onLevel(level);
    callbacks.onLives(lives);

    loadLevel(1);
  }

  function spawnParticles(block: Block) {
    const cx = block.x + block.w / 2;
    const cy = block.y + block.h / 2;
    for (let i = 0; i < PARTICLES_PER_BLOCK; i++) {
      // Repartidas en círculo con algo de ruido, para que no salgan siempre en
      // las mismas ocho direcciones.
      const angle =
        (Math.PI * 2 * i) / PARTICLES_PER_BLOCK + Math.random() * 0.5;
      const speed = 70 + Math.random() * 110;
      particles.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: block.color,
        elapsed: 0,
      });
    }
  }

  function loseLife() {
    setLives(lives - 1);
    if (lives <= 0) {
      finish("game_over");
      return;
    }
    resetBall();
  }

  // El bonus se cobra al limpiar la muralla y **al nivel que se acaba de
  // limpiar**, antes de subir: en el fin de partida las vidas son 0, así que
  // pagarlo entonces sería no pagarlo nunca; y al rendirse premiaría abandonar.
  function advanceLevel() {
    setScore(score + LEVEL_BONUS * level + LIFE_BONUS * lives);
    loadLevel(level + 1);
  }

  function update(dt: number) {
    if (state !== "playing") return;

    const dtMs = dt * 1000;
    elapsedMs += dtMs;

    if (input.isHeld(KEY_LEFT)) paddle.x -= PADDLE_SPEED * dt;
    if (input.isHeld(KEY_RIGHT)) paddle.x += PADDLE_SPEED * dt;
    // El ratón manda solo en los frames en los que se ha movido (takePointerX
    // consume la lectura), así que el teclado sigue funcionando con el puntero
    // parado encima del canvas.
    const pointerX = input.takePointerX();
    if (pointerX !== null) paddle.x = pointerX - paddle.w / 2;
    paddle.x = clamp(paddle.x, 0, W - paddle.w);

    const outcome = stepBall(ball, dt, paddle, blocks, ballSpeed());
    for (const block of outcome.broken) {
      setScore(score + BLOCK_POINTS * level);
      spawnParticles(block);
    }

    for (const particle of particles) {
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.elapsed += dtMs;
    }
    particles = particles.filter((particle) => particle.elapsed < PARTICLE_MS);

    // Perder la pelota manda sobre limpiar la muralla: si el último bloque cae
    // en el mismo frame en que la pelota se escapa, stepBall ya ha salido del
    // bucle y la muralla se recarga sola en la vida siguiente.
    if (outcome.lost) {
      loseLife();
      return;
    }
    if (blocks.every((block) => !block.alive)) advanceLevel();
  }

  function draw() {
    drawBackground(ctx);
    drawBlocks(ctx, blocks);
    drawParticles(ctx, particles);
    drawPaddle(ctx, paddle);
    drawBall(ctx, ball);
  }

  function loop(ts: number) {
    // dt capado: sin el tope, volver de otra pestaña movería la pelota media
    // pantalla en un solo frame.
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
      // durante la pausa, así que lo que se teclee o se mueva el ratón con el
      // juego congelado queda registrado y saltaría de golpe al reanudar.
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
