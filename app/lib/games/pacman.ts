// ===== app/lib/games/pacman.ts =====
// Motor de GLOTÓN (Pac-Man). Como SERPENTINA, no es un porte: no hay carpeta en
// references/templates/started-games/, así que las mecánicas son las que fija la
// SPEC 18.
//
// Dos cosas lo separan de los cinco motores anteriores, y las dos están
// decididas en la spec:
//
//  - Es el primero con adversarios que piensan. Los cuatro fantasmas comparten
//    la regla de cruce y se diferencian SOLO en su función de destino, que es
//    como funciona el arcade original. Encima va una máquina de modos global
//    (scatter/chase por tabla de tiempos, más frightened con reloj propio).
//
//  - Es el primero con UN SOLO aspecto. Los otros cinco declaran una
//    FichaDeSkins con neon/retro/clasico; GLOTÓN declara una única paleta, la
//    clásica, y no se registra en GAME_PALETAS: el selector de aspecto no
//    aparece en su overlay. Es una excepción deliberada a la invariante 10 de
//    .claude/skills/nuevo-juego/contrato.md, razonada en la spec — los colores
//    de Pac-Man no son un tema encima de unas formas, son cómo se distingue a
//    Blinky de Clyde.
//
//    Lo que SÍ se mantiene de esa invariante: cero literales de color en el
//    dibujo y la paleta bajando por argumento a cada función que pinta. Hay una
//    prueba en tests/games/pacman.test.ts que lo comprueba contra el canvas.
//
// Como en los otros motores, el estado de partida vive en el closure de
// createPacmanGame: en Next un `let` de módulo sobrevive entre montajes y volver
// a la pantalla arrastraría la partida anterior.

import type { GameFactory, GameOverReason, GameOverSummary } from "./types";

// ── Constantes ────────────────────────────────────────────────────────────────

// Resolución lógica. El ajuste al contenedor es puramente CSS: el reproductor
// fija el canvas en 800×600 y .crt-screen declara aspect-ratio 4/3.
export const W = 800;
export const H = 600;

// El laberinto de Pac-Man es vertical: 28×31 celdas. A 18 px son 504×558, que
// cabe en 800×600 con sitio de sobra. Las bandas laterales (148 px por lado) se
// quedan del color de fondo A PROPÓSITO: estirar el trazado hasta 4:3
// deformaría un mapa que la gente reconoce de memoria.
export const COLS = 28;
export const FILAS = 31;
const CELDA = 18;
const OFFSET_X = (W - COLS * CELDA) / 2; // 148
const OFFSET_Y = (H - FILAS * CELDA) / 2; // 21

const VIDAS_INICIALES = 3;

// ── El laberinto ──────────────────────────────────────────────────────────────

// El trazado del arcade original, transcrito celda a celda. Es DATO, no lógica,
// y por eso las pruebas lo verifican contando en vez de mirándolo: 240 puntos,
// 4 píldoras, simetría especular y todas las celdas comestibles alcanzables
// desde la salida. Un muro de más deja puntos que no se pueden comer y el
// laberinto no se limpia nunca — un fallo que no se ve hasta que alguien juega
// una partida entera.
//
//   #  muro          .  punto (10)     o  píldora (50)
//   -  puerta        T  boca de túnel  (espacio) pasillo vacío
export const MAPA: readonly string[] = [
  "############################",
  "#............##............#",
  "#.####.#####.##.#####.####.#",
  "#o####.#####.##.#####.####o#",
  "#.####.#####.##.#####.####.#",
  "#..........................#",
  "#.####.##.########.##.####.#",
  "#.####.##.########.##.####.#",
  "#......##....##....##......#",
  "######.##### ## #####.######",
  "######.##### ## #####.######",
  "######.##          ##.######",
  "######.## ###--### ##.######",
  "######.## #      # ##.######",
  "T     .   #      #   .     T",
  "######.## #      # ##.######",
  "######.## ######## ##.######",
  "######.##          ##.######",
  "######.## ######## ##.######",
  "######.## ######## ##.######",
  "#............##............#",
  "#.####.#####.##.#####.####.#",
  "#.####.#####.##.#####.####.#",
  "#o..##.......  .......##..o#",
  "###.##.##.########.##.##.###",
  "###.##.##.########.##.##.###",
  "#......##....##....##......#",
  "#.##########.##.##########.#",
  "#.##########.##.##########.#",
  "#..........................#",
  "############################",
];

// La fila del túnel y la casilla de salida de Pac-Man, derivadas del trazado.
// Se declaran aquí para que las pruebas puedan afirmarlas sin recontar el mapa.
export const FILA_TUNEL = 14;

// La salida de Pac-Man. En el arcade original cae entre dos columnas (13,5),
// porque el hueco central de la fila 23 mide dos celdas; aquí arranca clavado en
// la 13, que es la izquierda de las dos. Media celda de diferencia que nadie ve,
// a cambio de que todos los móviles usen el mismo modelo de celda entera.
export const SALIDA_GLOTON = { fila: 23, col: 13 } as const;

// ── Paleta ────────────────────────────────────────────────────────────────────

// La paleta clásica del arcade, y la única que tiene este motor. No hay
// FichaDeSkins ni entrada en GAME_PALETAS: ver la cabecera del archivo.
//
// Cada color se guarda TAL COMO llega al contexto, con su alfa incluido si es
// fijo, que es la misma disciplina que siguen las paletas de los otros cinco.
const PALETA_CLASICA = {
  fondo: "#000",
  muro: "#2121de", // el azul del arcade original
  puerta: "#ffb8ff",
  punto: "#ffb897",
  pildora: "#ffb897",
  gloton: "#fff000", // ≈ --yellow del portal
  blinky: "#ff0000",
  pinky: "#ffb8ff",
  inky: "#00ffff",
  clyde: "#ffb851",
  asustado: "#2121de",
  asustadoParpadeo: "#ffffff",
  ojos: "#ffffff",
  pupila: "#2121de",
  fruta: "#ff0000",
  tallo: "#00b060",
  textoPuntos: "#00ffff", // el «200» que aparece al comer un fantasma
} as const;

export type RolGloton = keyof typeof PALETA_CLASICA;
export type PaletaGloton = Readonly<Record<RolGloton, string>>;

// Se exporta para que la prueba de "ningún color fuera de la paleta llega al
// canvas" tenga contra qué comparar. Es el sustituto de verificaSkins, que aquí
// no se puede invocar por no haber ficha.
export const PALETA: PaletaGloton = PALETA_CLASICA;

// ── Utilidades ────────────────────────────────────────────────────────────────

export type Celda = "#" | "." | "o" | " " | "-" | "T";

// El túnel envuelve por los lados; arriba y abajo no hay nada que envolver.
function envuelveCol(col: number): number {
  if (col < 0) return col + COLS;
  if (col >= COLS) return col - COLS;
  return col;
}

// Qué hay en el trazado ORIGINAL. Lo comido vive aparte, en la rejilla de la
// partida, para que reiniciar un nivel sea volver a copiar de aquí.
function celdaDelMapa(fila: number, col: number): Celda {
  if (fila < 0 || fila >= FILAS) return "#";
  return MAPA[fila][envuelveCol(col)] as Celda;
}

// La puerta de la casa es muro para Pac-Man y pasillo para los fantasmas, así
// que quién pregunta decide: Pac-Man la ve como muro, y los fantasmas que salen
// o los ojos que vuelven, como pasillo.
export function esMuro(
  fila: number,
  col: number,
  puertaEsMuro = true,
): boolean {
  const c = celdaDelMapa(fila, col);
  if (c === "-") return puertaEsMuro;
  return c === "#";
}

// ── Movimiento sobre la rejilla ───────────────────────────────────────────────

export type Rumbo = "arriba" | "abajo" | "izquierda" | "derecha";

const VECTOR: Readonly<Record<Rumbo, readonly [number, number]>> = {
  arriba: [0, -1],
  abajo: [0, 1],
  izquierda: [-1, 0],
  derecha: [1, 0],
};

const OPUESTO: Readonly<Record<Rumbo, Rumbo>> = {
  arriba: "abajo",
  abajo: "arriba",
  izquierda: "derecha",
  derecha: "izquierda",
};

// Un móvil no guarda coordenadas continuas sino la celda en la que está y
// cuánto lleva recorrido hacia la siguiente (0 a 1). Es lo que hace exacta la
// pregunta «¿ya llegué?»: con posiciones en decimales habría que comparar
// contra un epsilon, la deriva acumularía error y un fantasma acabaría
// atravesando una esquina. Además da un sitio natural donde decidir el rumbo y
// donde comer: el instante en que se entra en una celda nueva.
export interface Movil {
  fila: number;
  col: number;
  dir: Rumbo;
  progreso: number; // 0..1 hacia la celda siguiente
}

// Dónde se dibuja, interpolando entre la celda actual y la siguiente.
export function posicionDe(m: Movil): readonly [number, number] {
  const [dx, dy] = VECTOR[m.dir];
  return [m.col + dx * m.progreso, m.fila + dy * m.progreso];
}

export function hayPaso(
  fila: number,
  col: number,
  dir: Rumbo,
  puertaEsMuro = true,
): boolean {
  const [dx, dy] = VECTOR[dir];
  return !esMuro(fila + dy, envuelveCol(col + dx), puertaEsMuro);
}

// Avanza un móvil. `decide` se llama al llegar a cada celda —antes de elegir por
// dónde seguir— y `alEntrar` justo después de pisarla, que es donde el paso 3
// pondrá el comer.
//
// El bucle consume el desplazamiento a trozos que nunca cruzan más de una celda,
// así que un dt grande no teletransporta a nadie: recorre las celdas
// intermedias una a una y cada una tiene su oportunidad de decidir.
export function avanza(
  m: Movil,
  celdas: number,
  puertaEsMuro: boolean,
  decide: (m: Movil) => void,
  alEntrar?: (m: Movil) => void,
): void {
  let restante = celdas;
  while (restante > 0) {
    if (m.progreso === 0) {
      decide(m);
      // Pegado a un muro: se queda quieto mirando adonde miraba. Es lo que hace
      // que mantener una tecla contra la pared no vibre ni desalinee.
      if (!hayPaso(m.fila, m.col, m.dir, puertaEsMuro)) return;
    }
    const paso = Math.min(restante, 1 - m.progreso);
    m.progreso += paso;
    restante -= paso;
    if (m.progreso >= 1) {
      const [dx, dy] = VECTOR[m.dir];
      m.fila += dy;
      m.col = envuelveCol(m.col + dx); // el túnel envuelve por los lados
      m.progreso = 0;
      alEntrar?.(m);
    }
  }
}

// ── Teclado ───────────────────────────────────────────────────────────────────

// Flechas y WASD. `Space` NO está: es la tecla con la que el reproductor abre la
// partida desde el overlay, y dejarla libre evita tener que blindar el motor
// contra esa pulsación (lo mismo que decidieron BLOQUE BUSTER, SERPENTINA y
// RANARIA).
const RUMBOS: Readonly<Record<string, Rumbo>> = {
  ArrowUp: "arriba",
  KeyW: "arriba",
  ArrowDown: "abajo",
  KeyS: "abajo",
  ArrowLeft: "izquierda",
  KeyA: "izquierda",
  ArrowRight: "derecha",
  KeyD: "derecha",
};

const PREVENT_DEFAULT = new Set(Object.keys(RUMBOS));

class Input {
  private attached = false;
  private pedido: Rumbo | null = null;

  // Propiedades flecha y no métodos: con un método, removeEventListener recibe
  // otra referencia y el listener no se quita nunca.
  private onKeyDown = (e: KeyboardEvent) => {
    const rumbo = RUMBOS[e.code];
    if (!rumbo) return;
    e.preventDefault();
    // La repetición del sistema no aporta nada: el rumbo pedido se guarda hasta
    // que se puede aplicar. Y el mando táctil manda un solo keydown al apoyar el
    // dedo, así que depender del auto-repeat dejaría el botón muerto.
    if (e.repeat) return;
    this.pedido = rumbo;
  };

  private onKeyUp = (e: KeyboardEvent) => {
    if (PREVENT_DEFAULT.has(e.code)) e.preventDefault();
  };

  attach(): void {
    if (this.attached) return;
    this.attached = true;
    // En window y no en el canvas: así no hace falta que el canvas tenga el
    // foco, y sobre todo el mando táctil despacha sus KeyboardEvent aquí.
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
  }

  detach(): void {
    if (!this.attached) return;
    this.attached = false;
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    this.clear();
  }

  clear(): void {
    this.pedido = null;
  }

  // Se consume al leerlo: el rumbo pasa a vivir en el móvil, que lo conserva
  // hasta que hay por dónde girar.
  consumirPedido(): Rumbo | null {
    const p = this.pedido;
    this.pedido = null;
    return p;
  }
}

// ── Dibujo ────────────────────────────────────────────────────────────────────

function xDe(col: number): number {
  return OFFSET_X + col * CELDA;
}

function yDe(fila: number): number {
  return OFFSET_Y + fila * CELDA;
}

function drawFondo(ctx: CanvasRenderingContext2D, paleta: PaletaGloton): void {
  ctx.fillStyle = paleta.fondo;
  ctx.fillRect(0, 0, W, H);
}

// Los muros se dibujan como tubos redondeados y no como bloques macizos: es lo
// que da el aspecto del original y, sobre todo, deja ver el pasillo. Un muro
// pintado a celda completa se come el hueco por donde pasa Pac-Man.
function drawLaberinto(
  ctx: CanvasRenderingContext2D,
  paleta: PaletaGloton,
): void {
  // Se dibuja el CONTORNO de los bloques de muro, no los bloques: de cada celda
  // solo se traza el lado que da a un pasillo. Eso fusiona las celdas contiguas
  // en una pared continua de línea fina, que es el aspecto del arcade.
  //
  // Rellenar cada celda, que es lo primero que se intentó, convierte el mapa en
  // un mar de cuadrados azules sueltos: los pasillos dejan de leerse y los
  // puntos se pierden entre tanto relleno.
  ctx.strokeStyle = paleta.muro;
  ctx.lineWidth = 2;
  ctx.lineCap = "square";

  for (let fila = 0; fila < FILAS; fila++) {
    for (let col = 0; col < COLS; col++) {
      if (celdaDelMapa(fila, col) !== "#") continue;
      const x = xDe(col);
      const y = yDe(fila);
      // Los bordes del mapa no se contornean contra el exterior: el marco
      // exterior sí, porque ahí el "vecino" es fuera del tablero.
      const lados: readonly [boolean, number, number, number, number][] = [
        [celdaDelMapa(fila - 1, col) !== "#", x, y, x + CELDA, y], // arriba
        [
          celdaDelMapa(fila + 1, col) !== "#",
          x,
          y + CELDA,
          x + CELDA,
          y + CELDA,
        ], // abajo
        [celdaDelMapa(fila, col - 1) !== "#", x, y, x, y + CELDA], // izquierda
        [
          celdaDelMapa(fila, col + 1) !== "#",
          x + CELDA,
          y,
          x + CELDA,
          y + CELDA,
        ], // derecha
      ];
      ctx.beginPath();
      for (const [hayQue, x0, y0, x1, y1] of lados) {
        if (!hayQue) continue;
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
      }
      ctx.stroke();
    }
  }

  // La puerta de la casa, una banda fina en su mitad de celda.
  ctx.fillStyle = paleta.puerta;
  for (let fila = 0; fila < FILAS; fila++) {
    for (let col = 0; col < COLS; col++) {
      if (celdaDelMapa(fila, col) !== "-") continue;
      ctx.fillRect(xDe(col), yDe(fila) + CELDA / 2 - 1, CELDA, 3);
    }
  }
}

// Dónde trae comestible el TRAZADO, separado por tipo y en el mismo orden en que
// los recorría el doble bucle de 868 celdas (fila a fila, columna a columna).
//
// Se calcula una vez, al cargar el módulo, y es DATO derivado de MAPA —no estado
// de partida—, como COMESTIBLES_TOTALES: la invariante nº 1 prohíbe estado de
// módulo, no constantes. Una celda con punto nunca pasa a tener píldora ni al
// contrario (lo comido se marca con " "), así que clasificar por el trazado
// original es exacto para toda la partida.
//
// Medido: drawComestibles visitaba 868 celdas por fotograma para pintar 244
// como máximo.
function celdasDelTrazado(
  tipo: Celda,
): readonly { fila: number; col: number }[] {
  const celdas: { fila: number; col: number }[] = [];
  for (let fila = 0; fila < FILAS; fila++) {
    for (let col = 0; col < COLS; col++) {
      if (MAPA[fila][col] === tipo) celdas.push({ fila, col });
    }
  }
  return celdas;
}

const CELDAS_PUNTO = celdasDelTrazado(".");
const CELDAS_PILDORA = celdasDelTrazado("o");

// `rejilla` es lo que queda por comer: la copia viva del trazado. Se pasa por
// argumento, como la paleta, para que la función no capture nada del closure.
function drawComestibles(
  ctx: CanvasRenderingContext2D,
  paleta: PaletaGloton,
  rejilla: readonly Celda[][],
  parpadeo: boolean,
): void {
  // Dos pasadas, puntos y luego píldoras, en vez de una sola interleando los
  // dos colores: así cada color se asigna UNA vez por fotograma en lugar de una
  // por punto. Medido: 233 escrituras de `fillStyle` por fotograma al empezar un
  // laberinto (sonda 2: 261 asignaciones de color por fotograma, de las que 233
  // eran el mismo valor repetido).
  //
  // Separar las pasadas no mueve un píxel: un punto y una píldora nunca
  // comparten celda y ninguna de las dos formas sale de la suya —el punto mide
  // 3 px y la píldora 10, centrados en una celda de 18—, así que no hay
  // solapamiento donde el orden pudiera notarse.
  ctx.fillStyle = paleta.punto;
  for (const celda of CELDAS_PUNTO) {
    if (rejilla[celda.fila][celda.col] !== ".") continue;
    ctx.fillRect(
      xDe(celda.col) + CELDA / 2 - 1.5,
      yDe(celda.fila) + CELDA / 2 - 1.5,
      3,
      3,
    );
  }

  if (!parpadeo) return; // en el medio ciclo apagado no hay nada que pintar
  ctx.fillStyle = paleta.pildora;
  for (const celda of CELDAS_PILDORA) {
    if (rejilla[celda.fila][celda.col] !== "o") continue;
    ctx.beginPath();
    ctx.arc(
      xDe(celda.col) + CELDA / 2,
      yDe(celda.fila) + CELDA / 2,
      5,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
}

// Hacia dónde apunta la boca, en radianes.
const ANGULO: Readonly<Record<Rumbo, number>> = {
  derecha: 0,
  abajo: Math.PI / 2,
  izquierda: Math.PI,
  arriba: -Math.PI / 2,
};

// `fase` va de 0 a 1 y da la vuelta al ciclo de la boca. La abertura máxima es
// 0,35π: más y Pac-Man parece un pastel al que le falta un trozo, menos y no se
// lee que está masticando.
function drawGloton(
  ctx: CanvasRenderingContext2D,
  paleta: PaletaGloton,
  x: number,
  y: number,
  dir: Rumbo,
  fase: number,
): void {
  const cx = xDe(x) + CELDA / 2;
  const cy = yDe(y) + CELDA / 2;
  const radio = CELDA * 0.45;
  const abertura = Math.abs(Math.sin(fase * Math.PI)) * 0.35 * Math.PI;
  const base = ANGULO[dir];

  ctx.fillStyle = paleta.gloton;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.arc(cx, cy, radio, base + abertura, base - abertura + Math.PI * 2);
  ctx.closePath();
  ctx.fill();
}

// ── Los fantasmas ─────────────────────────────────────────────────────────────

export type IdFantasma = "blinky" | "pinky" | "inky" | "clyde";

// scatter y chase son los dos modos normales y se alternan por tabla de tiempos.
// frightened lo dispara la píldora. eyes es un fantasma comido volviendo a casa.
export type ModoFantasma = "scatter" | "chase" | "frightened" | "eyes";

export interface Fantasma extends Movil {
  id: IdFantasma;
  modo: ModoFantasma;
  enCasa: boolean;
  saliendo: boolean; // cruzando la puerta hacia arriba
  saleCon: number; // comestibles que hacen falta para que salga
}

// La casa central. La puerta (fila 12, columnas 13-14) solo la cruzan los que
// salen y los ojos que vuelven; para Pac-Man es un muro, y por eso `hayPaso`
// recibe `puertaEsMuro`.
const DENTRO_CASA = { fila: 14, col: 13 } as const;
const FUERA_CASA = { fila: 11, col: 13 } as const;

// Las cuatro esquinas de scatter. Caen FUERA del mapa a propósito, igual que en
// el arcade: un destino inalcanzable hace que el fantasma orbite su cuadrante en
// vez de quedarse clavado en una celda.
const ESQUINA: Readonly<Record<IdFantasma, readonly [number, number]>> = {
  blinky: [-3, 25], // arriba derecha
  pinky: [-3, 2], // arriba izquierda
  inky: [FILAS + 2, 27], // abajo derecha
  clyde: [FILAS + 2, 0], // abajo izquierda
};

// El orden de desempate del arcade cuando dos salidas quedan a la misma
// distancia: arriba, izquierda, abajo, derecha. No es decorativo — es lo que
// hace que los fantasmas tomen rutas predecibles y que el juego se pueda
// aprender.
const ORDEN_DESEMPATE: readonly Rumbo[] = [
  "arriba",
  "izquierda",
  "abajo",
  "derecha",
];

function nuevosFantasmas(): Fantasma[] {
  // Blinky empieza fuera, sobre la puerta; los otros tres dentro. Los que
  // esperan salen cuando Pac-Man lleva comidos los suyos, que es lo que hace
  // que el principio de cada nivel no sea una avalancha.
  return [
    {
      id: "blinky",
      fila: FUERA_CASA.fila,
      col: FUERA_CASA.col,
      dir: "izquierda",
      progreso: 0,
      modo: "scatter",
      enCasa: false,
      saliendo: false,
      saleCon: 0,
    },
    {
      id: "pinky",
      fila: DENTRO_CASA.fila,
      col: 13,
      dir: "arriba",
      progreso: 0,
      modo: "scatter",
      enCasa: true,
      saliendo: false,
      saleCon: 0,
    },
    {
      id: "inky",
      fila: DENTRO_CASA.fila,
      col: 11,
      dir: "arriba",
      progreso: 0,
      modo: "scatter",
      enCasa: true,
      saliendo: false,
      saleCon: 30,
    },
    {
      id: "clyde",
      fila: DENTRO_CASA.fila,
      col: 16,
      dir: "arriba",
      progreso: 0,
      modo: "scatter",
      enCasa: true,
      saliendo: false,
      saleCon: 60,
    },
  ];
}

// A dónde quiere ir cada fantasma. Es lo ÚNICO que los diferencia: la regla de
// cruce es la misma para los cuatro, y de ahí sale que cada uno se comporte
// distinto sin tener cuatro algoritmos.
export function destinoDe(
  f: Fantasma,
  gloton: Movil,
  blinky: Movil,
): readonly [number, number] {
  if (f.modo === "eyes") return [DENTRO_CASA.fila, DENTRO_CASA.col];
  if (f.modo === "scatter" || f.modo === "frightened") return ESQUINA[f.id];

  const [gdx, gdy] = VECTOR[gloton.dir];
  switch (f.id) {
    case "blinky":
      return [gloton.fila, gloton.col];
    case "pinky":
      // Cuatro casillas por delante: es el que corta el paso.
      return [gloton.fila + gdy * 4, gloton.col + gdx * 4];
    case "inky": {
      // El reflejo de Blinky sobre el punto dos casillas delante de Pac-Man.
      // Es el destino más raro de los cuatro y el que hace que Inky a veces
      // aparezca de frente: depende de dónde esté Blinky, no solo Pac-Man.
      const pf = gloton.fila + gdy * 2;
      const pc = gloton.col + gdx * 2;
      return [pf * 2 - blinky.fila, pc * 2 - blinky.col];
    }
    case "clyde": {
      // Persigue de lejos y se retira en cuanto se acerca. Es el que deja
      // huecos por los que escapar.
      const d = Math.hypot(f.fila - gloton.fila, f.col - gloton.col);
      return d > 8 ? [gloton.fila, gloton.col] : ESQUINA.clyde;
    }
  }
}

// ── Dibujo de los fantasmas ───────────────────────────────────────────────────

const COLOR_DE: Readonly<Record<IdFantasma, RolGloton>> = {
  blinky: "blinky",
  pinky: "pinky",
  inky: "inky",
  clyde: "clyde",
};

function drawFantasma(
  ctx: CanvasRenderingContext2D,
  paleta: PaletaGloton,
  f: Fantasma,
  x: number,
  y: number,
  parpadeaAsustado: boolean,
): void {
  const cx = xDe(x) + CELDA / 2;
  const cy = yDe(y) + CELDA / 2;
  const r = CELDA * 0.45;

  // Un fantasma comido es solo un par de ojos: el cuerpo no se dibuja.
  if (f.modo !== "eyes") {
    ctx.fillStyle =
      f.modo === "frightened"
        ? parpadeaAsustado
          ? paleta.asustadoParpadeo
          : paleta.asustado
        : paleta[COLOR_DE[f.id]];

    ctx.beginPath();
    ctx.arc(cx, cy - r * 0.1, r, Math.PI, 0); // la cúpula
    ctx.lineTo(cx + r, cy + r * 0.75);
    // El festón de abajo, tres picos.
    const pico = (r * 2) / 3;
    for (let i = 0; i < 3; i++) {
      const x0 = cx + r - i * pico;
      ctx.lineTo(x0 - pico / 2, cy + r * 0.4);
      ctx.lineTo(x0 - pico, cy + r * 0.75);
    }
    ctx.closePath();
    ctx.fill();
  }

  // Los ojos miran hacia donde va, que es la única pista de su rumbo.
  const [mx, my] = VECTOR[f.dir];
  for (const lado of [-1, 1]) {
    const ox = cx + lado * r * 0.35;
    const oy = cy - r * 0.15;
    ctx.fillStyle = paleta.ojos;
    ctx.beginPath();
    ctx.ellipse(ox, oy, r * 0.28, r * 0.34, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = paleta.pupila;
    ctx.beginPath();
    ctx.arc(ox + mx * r * 0.12, oy + my * r * 0.14, r * 0.14, 0, Math.PI * 2);
    ctx.fill();
  }
}

// La fruta: una cereza, que es la del primer nivel y la que todo el mundo
// reconoce. No cambia de forma con el nivel, solo de valor.
function drawFruta(
  ctx: CanvasRenderingContext2D,
  paleta: PaletaGloton,
  fila: number,
  col: number,
): void {
  const cx = xDe(col) + CELDA / 2;
  const cy = yDe(fila) + CELDA / 2;
  ctx.fillStyle = paleta.fruta;
  for (const lado of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(
      cx + lado * CELDA * 0.16,
      cy + CELDA * 0.12,
      CELDA * 0.22,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
  ctx.strokeStyle = paleta.tallo;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - CELDA * 0.16, cy + CELDA * 0.12);
  ctx.quadraticCurveTo(
    cx + CELDA * 0.1,
    cy - CELDA * 0.3,
    cx + CELDA * 0.3,
    cy - CELDA * 0.2,
  );
  ctx.stroke();
}

// El «200» que sale flotando al comer un fantasma.
function drawPuntosFlotantes(
  ctx: CanvasRenderingContext2D,
  paleta: PaletaGloton,
  texto: string,
  x: number,
  y: number,
): void {
  ctx.fillStyle = paleta.textoPuntos;
  ctx.font = `${Math.round(CELDA * 0.7)}px monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(texto, xDe(x) + CELDA / 2, yDe(y) + CELDA / 2);
  ctx.textAlign = "start";
  ctx.textBaseline = "alphabetic";
}

// ── Motor ─────────────────────────────────────────────────────────────────────

type Estado = "playing" | "paused" | "gameover";

// Celdas por segundo. Se declara así, y no en píxeles, para que la dificultad no
// dependa del tamaño de celda: si algún día CELDA cambia, el juego se comporta
// igual.
const VEL_GLOTON = 8;

// Cada cuánto da una vuelta completa el ciclo de la boca, en segundos.
const CICLO_BOCA = 0.22;

// La tabla de puntos del arcade. Una partida competente ronda los 8 000–15 000
// por nivel: la escala de RANARIA y ROCAS, no la de CAÍDA. No hace falta
// corregirla porque el Salón compara por juego, cada uno en su pestaña.
const PUNTOS_PUNTO = 10;
const PUNTOS_PILDORA = 50;

// Cuántos comestibles trae el trazado. Se cuenta una vez, del mapa, en vez de
// escribir 244 a mano: si algún día el trazado cambia, esto no se queda viejo.
const COMESTIBLES_TOTALES = MAPA.join("").replace(/[^.o]/g, "").length;

// Lo que vale cada fantasma de una misma píldora. Comerse los cuatro son 3 000
// puntos, que es el gran premio del juego.
const CADENA_FANTASMA = [200, 400, 800, 1600] as const;

// La fruta sale dos veces por laberinto y se va sola. Su valor sube con el
// nivel hasta la llave.
const FRUTA_EN = [70, 170] as const;
const FRUTA_CELDA = { fila: 17, col: 13 } as const;
const FRUTA_DURACION = 9;
const VALOR_FRUTA = [
  100, 300, 500, 500, 700, 700, 1000, 1000, 2000, 2000, 3000, 3000, 5000,
] as const;

// Una vida extra, una sola vez en la partida.
const VIDA_EXTRA_EN = 10_000;

// Velocidades, en celdas por segundo.
const VEL_FANTASMA = 7.5;
const VEL_ASUSTADO = 4;
const VEL_OJOS = 16;
const VEL_TUNEL = 3.5; // solo fantasmas: el túnel es el recurso de huida

// Cuánto dura cada tramo de la alternancia, en segundos. Al agotarse la tabla
// los fantasmas se quedan en chase para siempre, que es lo que hace que los
// niveles largos aprieten.
const TRAMOS: readonly (readonly ["scatter" | "chase", number])[] = [
  ["scatter", 7],
  ["chase", 20],
  ["scatter", 7],
  ["chase", 20],
  ["scatter", 5],
  ["chase", 20],
  ["scatter", 5],
];

// Cuánto asusta una píldora. A partir del nivel 13 deja de asustar y solo
// puntúa, como en el arcade.
function duracionAsustado(level: number): number {
  if (level >= 13) return 0;
  return Math.max(1, 6 - (level - 1) * 0.5);
}

function velocidadGloton(level: number): number {
  return Math.min(11, VEL_GLOTON + (level - 1) * 0.3);
}

function velocidadFantasma(level: number): number {
  return Math.min(10.5, VEL_FANTASMA + (level - 1) * 0.3);
}

// Pac-Man recién puesto en su casilla. Se llama al empezar una partida y, desde
// el paso 6, también al perder una vida.
function nuevoGloton(): Movil {
  return {
    fila: SALIDA_GLOTON.fila,
    col: SALIDA_GLOTON.col,
    dir: "izquierda", // mirando a la izquierda, como en el arcade
    progreso: 0,
  };
}

export const createPacmanGame: GameFactory = (
  canvas,
  callbacks,
  // El skin entra en la firma y se ignora: GLOTÓN tiene un solo aspecto. Va con
  // valor por defecto y NO como `skin?` porque Function.length no cuenta los
  // parámetros con valor por defecto, y tests/games/registry.test.ts afirma que
  // la aridad de toda factory es 2.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  skin = "neon",
) => {
  const context2d = canvas.getContext("2d");
  if (!context2d) throw new Error("GLOTÓN necesita un canvas 2D");
  const ctx: CanvasRenderingContext2D = context2d; // el guard no llega a draw()

  const paleta = PALETA_CLASICA;
  const input = new Input();

  // ── Caché del laberinto ──
  // El fondo, los muros y la puerta son lo MISMO en todos los fotogramas de una
  // instancia: MAPA es dato constante y GLOTÓN tiene una sola paleta. Así que se
  // pintan una vez en un lienzo aparte y cada fotograma los copia con un solo
  // drawImage.
  //
  // Medido (tests/harness/rendimiento.ts, sonda 1): drawLaberinto recorría
  // 28×31 = 868 celdas y hacía 548 beginPath()/stroke(), uno por celda de muro,
  // más 1 181 moveTo/lineTo y un segundo barrido de 868 celdas para la puerta.
  // Eran 2 258 de las 2 593 llamadas al contexto por fotograma.
  //
  // Cuándo se invalida: NUNCA dentro de una instancia. No hay selector de
  // aspecto en este juego, y cambiar de skin destruiría y recrearía el motor
  // entero de todas formas. Reponer el laberinto al pasar de nivel solo repone
  // los comestibles, que se siguen pintando en directo porque se los van
  // comiendo.
  //
  // El lienzo vive en el closure y no a nivel de módulo —en Next un global
  // sobrevive entre montajes (invariante nº 1)— y se suelta en destroy().
  // OffscreenCanvas no se usa: no existe en jsdom, y document.createElement sí
  // funciona en las pruebas porque el stub parchea el prototipo.
  let cacheLaberinto: HTMLCanvasElement | null = null;

  function laberintoCacheado(): HTMLCanvasElement | null {
    if (cacheLaberinto !== null) return cacheLaberinto;
    const lienzo = document.createElement("canvas");
    lienzo.width = W;
    lienzo.height = H;
    const cctx = lienzo.getContext("2d");
    if (!cctx) return null; // sin lienzo de caché se pinta en directo, igual que antes
    // El fondo entra en la caché: así la copia es opaca y cubre el fotograma
    // anterior ella sola, exactamente como lo hacía el fillRect que sustituye.
    drawFondo(cctx, paleta);
    drawLaberinto(cctx, paleta);
    cacheLaberinto = lienzo;
    return cacheLaberinto;
  }

  // ── Estado de partida (todo en el closure) ──
  let gloton: Movil = nuevoGloton();
  let pedido: Rumbo | null = null; // rumbo que espera un hueco por donde girar
  // Arranca con el laberinto entero, no vacía: el reproductor puede pedir un
  // draw() antes del primer start() —al pausar desde el overlay, por ejemplo— y
  // una rejilla sin filas hacía que ese dibujo reventara.
  let rejilla: Celda[][] = nuevaRejilla();
  let score = 0;
  let lives = VIDAS_INICIALES;
  let level = 1;
  let state: Estado = "playing";
  let rafId: number | null = null;
  let lastTime: number | null = null;
  let elapsedMs = 0;
  let reloj = 0; // para las animaciones; se reinicia con la partida
  let comidos = 0; // comestibles de ESTE laberinto, no de la partida
  let fantasmas: Fantasma[] = nuevosFantasmas();

  // La alternancia scatter/chase: en qué tramo va y cuánto lleva en él.
  let tramo = 0;
  let tiempoTramo = 0;

  // Lo que queda de píldora, en segundos. Mientras corre, el reloj de tramos se
  // para: ese es el detalle que más se falla al implementar esto.
  let asustadoRestante = 0;
  let cadena = 0; // fantasmas comidos con la píldora actual

  // La fruta, si está en pantalla.
  let frutaRestante = 0;
  let frutasSacadas = 0;

  // El «200» flotante tras comerse un fantasma.
  let aviso: {
    texto: string;
    x: number;
    y: number;
    restante: number;
  } | null = null;

  let vidaExtraDada = false;

  // ── Setters con deduplicación ──
  // Los callbacks provocan renders de React: emitir en cada fotograma vuelve la
  // pantalla lenta.
  function setScore(value: number): void {
    if (value === score) return;
    score = value;
    callbacks.onScore(score);
  }

  function setLives(value: number): void {
    if (value === lives) return;
    lives = value;
    callbacks.onLives(lives);
  }

  function setLevel(value: number): void {
    if (value === level) return;
    level = value;
    callbacks.onLevel(level);
  }

  function summary(reason: GameOverReason): GameOverSummary {
    return { score, level, durationMs: Math.round(elapsedMs), reason };
  }

  // Único camino al fin de partida, y donde vive la guardia. Es la primera de
  // las dos barreras contra registrar la partida por duplicado en Supabase; la
  // segunda es registradaRef en el reproductor.
  function finish(reason: GameOverReason): void {
    if (state === "gameover") return;
    state = "gameover";
    stopLoop();
    setLives(0);
    callbacks.onGameOver(summary(reason));
  }

  function nuevaRejilla(): Celda[][] {
    return MAPA.map((fila) => [...fila] as Celda[]);
  }

  // Deja el laberinto entero y a todo el mundo en su sitio, sin tocar la
  // puntuación ni las vidas. Lo usan el arranque de partida y el cambio de
  // nivel, que se diferencian solo en eso.
  function reponerLaberinto(): void {
    rejilla = nuevaRejilla();
    comidos = 0;
    frutasSacadas = 0; // la fruta es por laberinto, no por partida
    reponerMoviles();
  }

  function reponerMoviles(): void {
    gloton = nuevoGloton();
    pedido = null;
    input.clear();
    fantasmas = nuevosFantasmas();
    for (const f of fantasmas) f.modo = modoDelTramo();
    tramo = 0;
    tiempoTramo = 0;
    asustadoRestante = 0;
    cadena = 0;
    frutaRestante = 0;
    aviso = null;
  }

  function initGame(): void {
    reponerLaberinto();
    score = 0;
    lives = VIDAS_INICIALES;
    level = 1;
    state = "playing";
    elapsedMs = 0;
    reloj = 0;
    lastTime = null;
    vidaExtraDada = false; // la vida extra es una por partida

    // Forzados sin pasar por los setters: al reiniciar los valores coinciden con
    // los de la partida anterior y el HUD se quedaría con la puntuación vieja.
    callbacks.onScore(score);
    callbacks.onLevel(level);
    callbacks.onLives(lives);
  }

  // Al llegar a una celda: si hay un rumbo pedido y por ahí se puede, se toma.
  // El giro de 180° se concede siempre —no necesita hueco— y es lo que hace que
  // dar media vuelta en un pasillo sea instantáneo, como en el original.
  function decideGloton(m: Movil): void {
    if (pedido === null) return;
    if (pedido === OPUESTO[m.dir] || hayPaso(m.fila, m.col, pedido)) {
      m.dir = pedido;
      pedido = null;
    }
  }

  // ── La máquina de modos ──

  function modoDelTramo(): "scatter" | "chase" {
    // Agotada la tabla, chase para siempre.
    return tramo < TRAMOS.length ? TRAMOS[tramo][0] : "chase";
  }

  // Al conmutar de tramo, todo el mundo da media vuelta en el sitio. Es el aviso
  // visual de que el modo cambió; sin él, la conmutación es invisible.
  function invierteATodos(): void {
    for (const f of fantasmas) {
      if (f.modo === "eyes" || f.enCasa) continue;
      giraEnRedondo(f);
    }
  }

  function giraEnRedondo(m: Movil): void {
    if (m.progreso > 0) {
      const [dx, dy] = VECTOR[m.dir];
      m.fila += dy;
      m.col = envuelveCol(m.col + dx);
      m.progreso = 1 - m.progreso;
    }
    m.dir = OPUESTO[m.dir];
  }

  function actualizaModos(dt: number): void {
    if (asustadoRestante > 0) {
      asustadoRestante -= dt;
      if (asustadoRestante <= 0) {
        asustadoRestante = 0;
        cadena = 0;
        for (const f of fantasmas) {
          if (f.modo === "frightened") f.modo = modoDelTramo();
        }
      }
      // El reloj de tramos NO corre mientras dura la píldora: al acabarse, los
      // fantasmas vuelven al modo que les tocaba. Sin esto, encadenar píldoras
      // dejaría el juego congelado en scatter para siempre.
      return;
    }

    if (tramo >= TRAMOS.length) return; // chase infinito: nada que contar
    tiempoTramo += dt;
    if (tiempoTramo < TRAMOS[tramo][1]) return;

    tiempoTramo = 0;
    tramo += 1;
    invierteATodos();
    for (const f of fantasmas) {
      if (f.modo === "scatter" || f.modo === "chase") f.modo = modoDelTramo();
    }
  }

  // ── La regla de cruce, común a los cuatro ──

  function decideFantasma(f: Fantasma): void {
    // Saliendo de la casa: sube en línea recta y no decide nada hasta estar
    // fuera. La puerta solo se cruza así.
    if (f.saliendo) {
      if (f.fila <= FUERA_CASA.fila) {
        f.saliendo = false;
        f.enCasa = false;
        f.dir = "izquierda";
      } else {
        f.dir = "arriba";
      }
      return;
    }
    if (f.enCasa) return;

    // Un fantasma comido que llega a la casa se regenera y vuelve a salir.
    if (
      f.modo === "eyes" &&
      f.fila === DENTRO_CASA.fila &&
      f.col === DENTRO_CASA.col
    ) {
      f.modo = modoDelTramo();
      f.enCasa = true;
      f.saliendo = true;
      f.dir = "arriba";
      return;
    }

    const puertaEsMuro = f.modo !== "eyes";
    const opciones = ORDEN_DESEMPATE.filter(
      (r) => r !== OPUESTO[f.dir] && hayPaso(f.fila, f.col, r, puertaEsMuro),
    );
    // Callejón sin salida: la única opción es volver por donde vino. Es el único
    // caso en que se permite invertir fuera de un cambio de tramo.
    if (opciones.length === 0) {
      f.dir = OPUESTO[f.dir];
      return;
    }
    if (opciones.length === 1) {
      f.dir = opciones[0];
      return;
    }

    // Asustado se mueve al azar: es lo que lo hace atrapable.
    if (f.modo === "frightened") {
      f.dir = opciones[Math.floor(Math.random() * opciones.length)];
      return;
    }

    const blinky = fantasmas.find((g) => g.id === "blinky") ?? f;
    const [df, dc] = destinoDe(f, gloton, blinky);
    let mejor = opciones[0];
    let mejorDist = Infinity;
    for (const r of opciones) {
      const [dx, dy] = VECTOR[r];
      const nf = f.fila + dy;
      const nc = f.col + dx;
      const dist = (nf - df) ** 2 + (nc - dc) ** 2;
      // Estrictamente menor: ORDEN_DESEMPATE ya viene en el orden del arcade,
      // así que el primero en empatar gana.
      if (dist < mejorDist) {
        mejorDist = dist;
        mejor = r;
      }
    }
    f.dir = mejor;
  }

  function velocidadDe(f: Fantasma): number {
    if (f.modo === "eyes") return VEL_OJOS;
    if (f.saliendo) return VEL_FANTASMA;
    if (f.modo === "frightened") return VEL_ASUSTADO;
    // El túnel los frena, que es lo que lo convierte en vía de escape.
    if (f.fila === FILA_TUNEL && (f.col <= 5 || f.col >= COLS - 6)) {
      return VEL_TUNEL;
    }
    return velocidadFantasma(level);
  }

  function mueveFantasmas(dt: number): void {
    for (const f of fantasmas) {
      if (f.enCasa && !f.saliendo) {
        // Esperando turno. Sale cuando Pac-Man lleva comidos los suyos.
        if (comidos >= f.saleCon) {
          f.saliendo = true;
          f.fila = DENTRO_CASA.fila;
          f.col = DENTRO_CASA.col; // se alinea con la puerta antes de subir
          f.progreso = 0;
          f.dir = "arriba";
        }
        continue;
      }
      avanza(f, velocidadDe(f) * dt, f.modo !== "eyes" && !f.saliendo, (m) =>
        decideFantasma(m as Fantasma),
      );
    }
  }

  // ── Comer ──

  // Lo que pasa al pisar una celda: comer lo que hubiera y, si era el último
  // comestible, cerrar el laberinto.
  function alEntrarGloton(m: Movil): void {
    const c = rejilla[m.fila][m.col];
    if (c !== "." && c !== "o") return;

    rejilla[m.fila][m.col] = " ";
    comidos += 1;
    sumar(c === "." ? PUNTOS_PUNTO : PUNTOS_PILDORA);

    if (c === "o") asusta();

    // La fruta sale al llegar a las cuentas del arcade.
    if (frutasSacadas < FRUTA_EN.length && comidos >= FRUTA_EN[frutasSacadas]) {
      frutasSacadas += 1;
      frutaRestante = FRUTA_DURACION;
    }

    if (comidos >= COMESTIBLES_TOTALES) siguienteNivel();
  }

  // Todo lo que suma puntos pasa por aquí, porque la vida extra depende del
  // total y no de qué lo produjo.
  function sumar(puntos: number): void {
    setScore(score + puntos);
    if (!vidaExtraDada && score >= VIDA_EXTRA_EN) {
      vidaExtraDada = true;
      setLives(lives + 1);
    }
  }

  function asusta(): void {
    const duracion = duracionAsustado(level);
    cadena = 0;
    if (duracion <= 0) return; // del nivel 13 en adelante solo puntúa
    asustadoRestante = duracion;
    for (const f of fantasmas) {
      if (f.modo === "eyes" || f.enCasa) continue; // unos ojos no se asustan
      f.modo = "frightened";
      giraEnRedondo(f);
    }
  }

  function siguienteNivel(): void {
    setLevel(level + 1);
    reponerLaberinto();
  }

  // ── Choques ──

  function compruebaChoques(): void {
    const [gx, gy] = posicionDe(gloton);

    // La fruta, si sigue en pantalla.
    if (
      frutaRestante > 0 &&
      Math.hypot(gx - FRUTA_CELDA.col, gy - FRUTA_CELDA.fila) < 0.7
    ) {
      frutaRestante = 0;
      const valor = VALOR_FRUTA[Math.min(level, VALOR_FRUTA.length) - 1];
      sumar(valor);
      aviso = {
        texto: String(valor),
        x: FRUTA_CELDA.col,
        y: FRUTA_CELDA.fila,
        restante: 1,
      };
    }

    for (const f of fantasmas) {
      if (f.modo === "eyes" || f.enCasa) continue;
      const [fx, fy] = posicionDe(f);
      // Medio ancho de celda: lo justo para que un cruce de frente cuente y un
      // roce de esquina no.
      if (Math.hypot(gx - fx, gy - fy) > 0.6) continue;

      if (f.modo === "frightened") {
        const valor = CADENA_FANTASMA[Math.min(cadena, 3)];
        cadena += 1;
        sumar(valor);
        f.modo = "eyes";
        aviso = { texto: String(valor), x: fx, y: fy, restante: 1 };
      } else {
        matar();
        return; // una muerte por fotograma
      }
    }
  }

  function matar(): void {
    if (lives <= 1) {
      // setLives(0) lo hace finish(), y después va onGameOver: el orden importa
      // porque el HUD tiene que quedarse sin corazones antes del modal.
      finish("game_over");
      return;
    }
    setLives(lives - 1);
    reponerMoviles();
  }

  function update(dt: number): void {
    if (state !== "playing") return;
    const dtMs = dt * 1000;
    elapsedMs += dtMs;
    reloj += dtMs;

    const nuevo = input.consumirPedido();
    if (nuevo !== null) pedido = nuevo;

    // Un giro de 180° no espera a la siguiente celda: se aplica en el sitio,
    // incluso a medio tramo. Sin esto, huir de un fantasma que aparece de frente
    // obliga a recorrer hasta el próximo centro, que es media celda de más y en
    // Pac-Man es la diferencia entre escapar y morir.
    if (pedido !== null && pedido === OPUESTO[gloton.dir]) {
      if (gloton.progreso > 0) {
        // A medio tramo, la celda de referencia pasa a ser la de destino y el
        // progreso se invierte: la posición dibujada no se mueve ni un píxel,
        // solo cambia desde dónde se mide.
        const [dx, dy] = VECTOR[gloton.dir];
        gloton.fila += dy;
        gloton.col = envuelveCol(gloton.col + dx);
        gloton.progreso = 1 - gloton.progreso;
      }
      gloton.dir = pedido;
      pedido = null;
    }

    avanza(
      gloton,
      velocidadGloton(level) * dt,
      true,
      decideGloton,
      alEntrarGloton,
    );

    // Si el último punto cerró el laberinto, el nivel ya se repuso y mover a los
    // fantasmas con las posiciones nuevas sería adelantarles un fotograma.
    if (state !== "playing") return;

    actualizaModos(dt);
    mueveFantasmas(dt);
    compruebaChoques();

    if (frutaRestante > 0) frutaRestante = Math.max(0, frutaRestante - dt);
    if (aviso !== null) {
      aviso.restante -= dt;
      if (aviso.restante <= 0) aviso = null;
    }
  }

  function draw(): void {
    // Fondo + muros + puerta, de una copia: ver laberintoCacheado().
    const cache = laberintoCacheado();
    if (cache !== null) {
      ctx.drawImage(cache, 0, 0);
      // drawLaberinto dejaba lineCap en "square" en ESTE contexto, y el tallo de
      // la cereza (drawFruta) estrena trazo sin fijar el suyo: con la caché, ese
      // ajuste se quedaría en el lienzo de la caché y el tallo pasaría a tener
      // remates "butt", 1 px más corto por punta. Se repone aquí para que el
      // estado del contexto sea el mismo que antes, píxel por píxel. Los otros
      // dos que tocaba —strokeStyle y lineWidth— no hacen falta: drawFruta los
      // escribe ella antes de trazar.
      ctx.lineCap = "square";
    } else {
      drawFondo(ctx, paleta);
      drawLaberinto(ctx, paleta);
    }
    // Las píldoras parpadean a ~4 Hz, como en el original.
    drawComestibles(ctx, paleta, rejilla, Math.floor(reloj / 250) % 2 === 0);
    if (frutaRestante > 0) {
      drawFruta(ctx, paleta, FRUTA_CELDA.fila, FRUTA_CELDA.col);
    }

    const [x, y] = posicionDe(gloton);
    drawGloton(ctx, paleta, x, y, gloton.dir, (reloj / 1000 / CICLO_BOCA) % 1);

    // Los dos últimos segundos de píldora parpadean: es el aviso de que se
    // acaba el tiempo de cazar.
    const parpadea =
      asustadoRestante > 0 &&
      asustadoRestante < 2 &&
      Math.floor(reloj / 200) % 2 === 0;
    // Se dibujan también los que esperan dentro de la casa: verlos ahí es parte
    // de la tensión del arranque de nivel.
    for (const f of fantasmas) {
      const [fx, fy] = posicionDe(f);
      drawFantasma(ctx, paleta, f, fx, fy, parpadea);
    }

    if (aviso !== null) {
      drawPuntosFlotantes(ctx, paleta, aviso.texto, aviso.x, aviso.y);
    }
  }

  function loop(ts: number): void {
    // Cap de 50 ms: sin él, volver de otra pestaña genera un dt enorme y las
    // entidades se teletransportan.
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

  function stopLoop(): void {
    if (rafId !== null) cancelAnimationFrame(rafId);
    rafId = null;
    lastTime = null; // sin esto, reanudar produce un salto
  }

  return {
    start() {
      stopLoop(); // re-entrante: es lo que usa "JUGAR DE NUEVO"
      initGame();
      input.attach();
      rafId = requestAnimationFrame(loop);
    },
    pause() {
      if (state !== "playing") return;
      state = "paused";
      input.clear(); // un rumbo pedido antes de pausar no se ejecuta al volver
      stopLoop();
      draw(); // deja el fotograma congelado bajo el overlay de la plataforma
    },
    resume() {
      if (state !== "paused") return;
      input.clear();
      state = "playing";
      rafId = requestAnimationFrame(loop);
    },
    end() {
      finish("surrender");
    },
    destroy() {
      // No emite onGameOver: desmontar no es terminar una partida. Si emitiera,
      // navegar fuera registraría una partida fantasma en Supabase.
      stopLoop();
      input.detach();
      // El lienzo de caché (800×600, ~1,9 MB de píxeles) se suelta aquí: es lo
      // único que el motor asigna fuera del closure de datos, y si un montaje
      // tras otro lo dejara vivo se acumularía un lienzo por visita.
      cacheLaberinto = null;
    },
  };
};
