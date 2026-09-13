// ===== app/lib/games/invaders.ts =====
// Motor de INVASORES (Space Invaders), escrito desde cero contra la SPEC 21.
// No hay código de referencia en references/templates/started-games/: se agotó
// con BLOQUE BUSTER, así que las mecánicas salen de la spec y no de un port.
//
// Decisiones que vienen de la spec y conviene no "arreglar" al leerlas:
//  - Las siluetas son bitmaps de 11×8 declarados aquí como cadenas, no sprites
//    en public/. Son dato, no lógica: se transcriben una vez y las pruebas
//    comprueban sus dimensiones. Y así el color lo pone el rol de la paleta,
//    que es justo lo que un PNG impide.
//  - Los tres tipos comparten el rol de color `invasor`. En el arcade eran del
//    mismo blanco y se distinguen por silueta y por fila; tres roles de color
//    harían imposible declarar honestamente la paleta `clasico`, que es
//    monocroma. Es el mismo argumento con el que SKINS_ROCAS deja su bala fuera
//    del grupo de contraste.
//  - Sin HUD ni overlays dentro del canvas: de eso se encarga la plataforma.

import { paletaDe, type FichaDeSkins } from "./skins";
import type { GameFactory, GameOverReason, GameOverSummary } from "./types";

// ── Constantes ────────────────────────────────────────────────────────────────

// Resolución lógica, igual que en los seis motores anteriores. El ajuste al
// contenedor es puramente CSS: el juego siempre trabaja en 800×600.
export const W = 800;
export const H = 600;

// Píxeles de canvas por píxel de bitmap.
export const ESCALA = 3;

// La rejilla de la formación. La celda es mayor que la silueta a propósito: el
// hueco sobrante es la separación entre invasores.
export const FILAS = 5;
export const COLUMNAS = 11;
const CELDA_X = 48;
const CELDA_Y = 40;

// 11 × 48 = 528 px de ancho, así que la formación oscila dentro de los 800 con
// margen a los dos lados.
const ANCHO_FORMACION = COLUMNAS * CELDA_X;
const FORMACION_X0 = (W - ANCHO_FORMACION) / 2;
const FORMACION_Y0 = 96;

const Y_CANON = 540;
export const Y_LIMITE = 530; // un invasor vivo aquí termina la partida
const Y_SUELO = 566;

// ── El reloj de la formación ──────────────────────────────────────────────────

// La formación se mueve a PASOS, no de forma continua: salta PASO_X cada
// `intervalo` y, cuando el borde se lo impide, baja PASO_Y e invierte el
// sentido. Además de ser el aspecto del arcade, regala dos cosas: la animación
// no necesita reloj propio —el fotograma alterna con cada paso— y la
// aceleración por bajas es una función de cuántos quedan vivos, no un estado
// que se pueda desincronizar.
const PASO_X = 8;
const PASO_Y = 16;
const MARGEN_BORDE = 12; // lo que la formación respeta a cada lado

const INTERVALO_MAX = 0.55; // segundos, con los 55 vivos
const INTERVALO_MIN = 0.045; // segundos, con el último

const TOTAL_INVASORES = FILAS * COLUMNAS;

// Segundos entre dos pasos. Lineal sobre los vivos y escalada por el nivel,
// con suelo en la mitad: sin el tope, la oleada 13 sería injugable.
export function intervaloPara(vivos: number, nivel: number): number {
  const restantes = Math.min(Math.max(vivos, 1), TOTAL_INVASORES);
  const base =
    INTERVALO_MIN +
    ((restantes - 1) / (TOTAL_INVASORES - 1)) * (INTERVALO_MAX - INTERVALO_MIN);
  return base * Math.max(0.5, 1 - 0.08 * (nivel - 1));
}

// ── Paleta ────────────────────────────────────────────────────────────────────

// La paleta de referencia. Son los tokens de :root en app/globals.css copiados
// aquí, porque el canvas no entiende de variables CSS: si el tema cambia, hay
// que tocar los dos sitios. El acento del catálogo para `invasores` es --green,
// y de ahí sale el color de la formación.
//
// `fondo` va PRIMERO a propósito: tests/harness/skins.ts toma el primer rol como
// la superficie contra la que mide todos los demás.
const PALETA_NEON = {
  fondo: "#000",
  canon: "#00f5ff", // --cyan
  // El mismo cian que el cañón: la bala es del color de lo que la dispara. No
  // es --ink porque un blanco roto no se distingue de ningún amarillo sobre
  // negro ni por luminancia ni por tono, y el par bala propia / bala enemiga es
  // el que el jugador tiene que leer en un cuarto de segundo.
  balaJugador: "#00f5ff",
  invasor: "#00ff88", // --green
  balaInvasor: "#f5ff00", // --yellow
  nodriza: "#ff006e", // --magenta
  escudo: "#00c46a", // --green apagado: es escenario, no jugador
  explosion: "#ffcf3a", // --gold
  suelo: "rgba(0,255,136,0.45)",
  puntosNodriza: "#e6e9ff", // --ink
} as const;

export type RolInvasores = keyof typeof PALETA_NEON;
export type PaletaInvasores = Readonly<Record<RolInvasores, string>>;

export const SKINS_INVASORES: FichaDeSkins<RolInvasores> = {
  roles: {
    fondo: { clase: "superficie" },
    canon: { clase: "jugable" },
    balaJugador: { clase: "jugable" },
    invasor: { clase: "jugable" },
    balaInvasor: { clase: "jugable" },
    nodriza: { clase: "jugable" },
    escudo: { clase: "jugable" },
    // La explosión dura tres cuartos de segundo y la línea del suelo es una
    // referencia visual: si se pierden un fotograma no se pierde la partida.
    explosion: { clase: "decorado" },
    suelo: { clase: "decorado" },
    puntosNodriza: { clase: "texto" },
  },
  // Tres pares, y cada uno es una decisión que el jugador toma mirándolos:
  // cuánto vale lo que cruza por arriba, cuál de las dos balas le viene, y
  // dónde acaba su escudo y empieza él.
  //
  // Los tres TIPOS de invasor quedan fuera de todo grupo a propósito: comparten
  // el rol `invasor` porque en el original eran del mismo color y se distinguen
  // por silueta y por fila.
  grupos: [
    ["invasor", "nodriza"],
    ["balaJugador", "balaInvasor"],
    ["canon", "escudo"],
  ],
  paletas: {
    neon: PALETA_NEON,

    // Monitor de fósforo ámbar: un solo tono y todo el trabajo hecho por la
    // luminancia, que es lo que hace que se lea como un monitor y no como un
    // neón naranja. La escalera va de la bala propia (lo más brillante) al
    // escudo (lo más apagado), que es el orden en que importan.
    retro: {
      fondo: "#000",
      canon: "#ffcf70",
      balaJugador: "#fff8e0",
      invasor: "#ffb000",
      balaInvasor: "#ff8c1a",
      nodriza: "#ffe08a",
      escudo: "#c07800",
      // El destello más brillante de la rampa, y no por gusto: la explosión
      // sustituye al cañón en la misma posición y con la misma huella (las dos
      // siluetas son 13×8 y draw() pinta una o la otra), así que el cambio de
      // color es la mitad del aviso de «te han dado». En neón ese aviso lo da
      // un salto de tono de 137° (cian → oro); aquí solo hay un tono, así que
      // tiene que darlo la luminancia. Con #ffe9a8 el salto sobre el cañón era
      // 1,21× —por debajo del 1,3× que la casa exige para distinguir dos
      // colores—; con #fff3d7 es 1,32×.
      explosion: "#fff3d7",
      suelo: "rgba(255,176,0,0.45)",
      puntosNodriza: "#fff8e0",
    },

    // El gabinete del 78. La máquina era monocroma en blanco: el color lo
    // ponían dos tiras de celofán pegadas sobre el tubo, verde en la franja
    // baja —cañón, escudos y suelo— y roja en la de arriba, donde cruza la
    // nodriza. Los invasores se quedaron en el blanco del tubo.
    clasico: {
      fondo: "#000",
      canon: "#4dff4d",
      balaJugador: "#ffffff",
      invasor: "#ffffff",
      balaInvasor: "#bfbfbf",
      nodriza: "#ff2222",
      escudo: "#1f9e3c",
      explosion: "#7dff7d",
      suelo: "rgba(77,255,77,0.45)",
      // Rojo, no blanco, y es el mismo literal que la nodriza a propósito: el
      // número flota en la posición exacta donde estaba ella (y = Y_NODRIZA +
      // ALTO_NODRIZA / 2), o sea dentro de la tira roja. El tubo lo emitía en
      // blanco; el celofán lo devuelve rojo, igual que a la nave que acaba de
      // explotar. No compiten: al crear el número se pone `nodriza = null`.
      puntosNodriza: "#ff2222",
    },
  },
};

// ── Siluetas ──────────────────────────────────────────────────────────────────

// Dato, no lógica. Cada fotograma son 8 cadenas de 11 caracteres: `#` pinta,
// cualquier otra cosa no. Las pruebas comprueban las dimensiones y que ningún
// fotograma esté vacío, que es lo único que un bitmap transcrito puede fallar.
export type Bitmap = readonly string[];

export type TipoInvasor = "alto" | "medio" | "bajo";

// Los dos fotogramas alternan CON CADA PASO de la formación, no con un reloj
// propio: en el arcade la animación y el movimiento son la misma cosa.
export const SILUETAS: Readonly<
  Record<TipoInvasor, readonly [Bitmap, Bitmap]>
> = {
  // El calamar de la fila de arriba, el que vale 30.
  alto: [
    [
      "....###....",
      "...#####...",
      "..#######..",
      ".##.###.##.",
      "###########",
      "..#.###.#..",
      ".#.#...#.#.",
      "#.#.....#.#",
    ],
    [
      "....###....",
      "...#####...",
      "..#######..",
      ".##.###.##.",
      "###########",
      ".#.#####.#.",
      "#.#.....#.#",
      "..#.....#..",
    ],
  ],
  // El cangrejo de las dos filas centrales, el que vale 20.
  medio: [
    [
      "..#.....#..",
      "...#...#...",
      "..#######..",
      ".##.###.##.",
      "###########",
      "#.#######.#",
      "#.#.....#.#",
      "...##.##...",
    ],
    [
      "..#.....#..",
      "#..#...#..#",
      "#.#######.#",
      "###.###.###",
      "###########",
      ".#########.",
      "..#.....#..",
      ".#.......#.",
    ],
  ],
  // El pulpo de las dos filas de abajo, el que vale 10.
  bajo: [
    [
      "...#####...",
      ".#########.",
      "###########",
      "###..#..###",
      "###########",
      "..###.###..",
      ".##.....##.",
      "..##...##..",
    ],
    [
      "...#####...",
      ".#########.",
      "###########",
      "###..#..###",
      "###########",
      "..#######..",
      ".##.....##.",
      "#.#.....#.#",
    ],
  ],
};

// 13 de ancho: el cañón es más ancho que un invasor, que es lo que hace que se
// lea como la pieza del jugador sin necesidad de otro color.
export const SILUETA_CANON: Bitmap = [
  "......#......",
  ".....###.....",
  ".....###.....",
  ".###########.",
  "#############",
  "#############",
  "#############",
  "#############",
];

// El cañón deshecho. Mismo ancho que la silueta entera, para que la explosión
// ocupe su sitio y no parezca que el jugador se ha encogido.
// El platillo que cruza por arriba. 16 de ancho: es lo bastante más grande que
// un invasor como para que se lea distinto de un vistazo, que es lo que hace
// que valga la pena desviar el único disparo que tienes.
export const SILUETA_NODRIZA: Bitmap = [
  ".....######.....",
  "...##########...",
  "..############..",
  ".##.##.##.##.##.",
  "################",
  "..###..##..###..",
  "...##......##...",
];

export const SILUETA_EXPLOSION: Bitmap = [
  ".#....#...#..",
  "..#..#..#..#.",
  "#..##..#...#.",
  ".##.#.##.#...",
  "#.#####.###.#",
  "##.###.####.#",
  "#.########.##",
  ".###.####.#.#",
];

// ── Escudos ───────────────────────────────────────────────────────────────────

// El búnker clásico: un bloque con los hombros redondeados y el arco recortado
// por abajo, donde cabe el cañón. No es decorado: el hueco que abres a tiros es
// por donde después disparas tú, y por donde te disparan a ti.
const PLANTILLA_ESCUDO: Bitmap = [
  "....##############....",
  "...################...",
  "..##################..",
  ".####################.",
  "######################",
  "######################",
  "######################",
  "######################",
  "######################",
  "######################",
  "######################",
  "#######........#######",
  "######..........######",
  "#####............#####",
  "#####............#####",
  "#####............#####",
];

export const ESCUDO_COLS = 22;
export const ESCUDO_FILAS = 16;
const CELDA_ESCUDO = ESCALA; // 3 px, igual que el píxel de una silueta
const ANCHO_ESCUDO = ESCUDO_COLS * CELDA_ESCUDO; // 66
const ALTO_ESCUDO = ESCUDO_FILAS * CELDA_ESCUDO; // 48
const Y_ESCUDOS = 460;
export const NUM_ESCUDOS = 4;
// En celdas. Un impacto abre un boquete, no borra un píxel: con radio 1 haría
// falta media partida para atravesar un búnker.
const RADIO_EROSION = 3;

const ANCHO_INVASOR = 11 * ESCALA; // 33
const ALTO_INVASOR = 8 * ESCALA; // 24
const ANCHO_CANON = 13 * ESCALA; // 39
const ALTO_CANON = 8 * ESCALA; // 24

// Lo que sobra de la celda, repartido: es la separación entre siluetas.
const HUECO_X = Math.floor((CELDA_X - ANCHO_INVASOR) / 2);
const HUECO_Y = Math.floor((CELDA_Y - ALTO_INVASOR) / 2);

// Qué tipo ocupa cada fila. Es el reparto del original: una de calamares, dos
// de cangrejos y dos de pulpos.
// Lo que vale cada tipo. Es la tabla del original, sin inflar: una oleada
// limpia da 990 puntos. El Salón compara por juego, cada uno en su pestaña, así
// que no hay nada que igualar con los 184 220 de CAÍDA.
export const PUNTOS_POR_TIPO: Readonly<Record<TipoInvasor, number>> = {
  alto: 30,
  medio: 20,
  bajo: 10,
};

const VEL_CANON = 320; // px/s, sin inercia: el carril es el juego
const VEL_BALA_JUGADOR = 520; // px/s, hacia arriba
const ANCHO_BALA = ESCALA;
const ALTO_BALA = 4 * ESCALA;

// Los invasores disparan despacio comparados con el jugador: lo que mata no es
// la bala suelta, es que caen tres a la vez mientras la formación baja.
const VEL_BALA_INVASOR = 220; // px/s, hacia abajo, en el nivel 1
const SUBIDA_POR_NIVEL = 0.15; // +15 % de velocidad por oleada
const MAX_BALAS_INVASOR = 3;
const CADENCIA_MIN = 800; // ms
const CADENCIA_MAX = 1600; // ms

// La nodriza. No aparece con la formación casi limpia: con ocho o menos vivos
// la oleada ya va disparada y un platillo cruzando por arriba solo estorba.
const NODRIZA_MIN_VIVOS = 8;
const NODRIZA_INTERVALO_MIN = 20000; // ms
const NODRIZA_INTERVALO_MAX = 30000; // ms
const NODRIZA_VEL = 100; // px/s
const Y_NODRIZA = 56;
const ANCHO_NODRIZA = 16 * ESCALA; // 48
const ALTO_NODRIZA = 7 * ESCALA; // 21
const PUNTOS_NODRIZA = [50, 100, 150, 300] as const;
const DURACION_PUNTOS = 1000; // ms que el número se queda flotando

// Cuántas oleadas siguen bajando el punto de partida. A partir de la novena la
// formación arranca siempre a la misma altura: más abajo, la partida sería un
// game over de salida.
const TOPE_DESCENSO = 8;

const VIDAS_INICIALES = 3;
const PUNTOS_VIDA_EXTRA = 1500;
const DURACION_EXPLOSION = 900; // ms que el cañón pasa deshecho

const TIPO_POR_FILA: readonly TipoInvasor[] = [
  "alto",
  "medio",
  "medio",
  "bajo",
  "bajo",
];

// ── Teclado ───────────────────────────────────────────────────────────────────

// Las teclas del juego que además hacen scroll en la página. Se les corta el
// comportamiento por defecto, pero solo mientras el motor está enganchado:
// fuera de la partida el teclado vuelve a funcionar con normalidad.
//
// ArrowDown no está: INVASORES no la usa, y cortarle el scroll a una tecla que
// el juego ignora es quitarle la página al jugador a cambio de nada.
const PREVENT_DEFAULT = new Set([
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "Space",
]);

// Las dos que disparan. Las dos, y no una: ESPACIO es la que todo el mundo
// busca en un Space Invaders, y la flecha arriba es donde ya está el pulgar de
// quien se mueve con las flechas.
export const TECLAS_DISPARO = ["Space", "ArrowUp"] as const;

export class Input {
  private held: Record<string, boolean> = {};
  private fresh: Record<string, boolean> = {};
  private attached = false;

  private onKeyDown = (e: KeyboardEvent) => {
    if (PREVENT_DEFAULT.has(e.code)) e.preventDefault();
    // `fresh` solo se marca en la transición de suelta a pulsada. Es lo que
    // convierte el disparo en una pulsación y no en una ametralladora, y lo que
    // hace que el motor no dependa del auto-repeat del sistema — que además el
    // mando táctil no manda: al apoyar el dedo llega UN keydown.
    if (!this.held[e.code]) this.fresh[e.code] = true;
    this.held[e.code] = true;
  };

  private onKeyUp = (e: KeyboardEvent) => {
    if (PREVENT_DEFAULT.has(e.code)) e.preventDefault();
    this.held[e.code] = false;
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

  isHeld(code: string): boolean {
    return !!this.held[code];
  }

  // Se consume al leerla: devuelve true una sola vez por pulsación.
  wasPressed(code: string): boolean {
    const value = !!this.fresh[code];
    this.fresh[code] = false;
    return value;
  }

  // Cualquiera de las teclas de disparo, consumiéndolas TODAS: sin el bucle
  // completo, apoyar ESPACIO y flecha arriba a la vez dejaría una pulsación
  // guardada que dispararía sola al soltar.
  disparo(): boolean {
    let pulsado = false;
    for (const code of TECLAS_DISPARO) {
      if (this.wasPressed(code)) pulsado = true;
    }
    return pulsado;
  }

  // Al pausar conviene olvidar lo pulsado, o al reanudar el cañón sale
  // corriendo con una tecla que el jugador ya soltó.
  clear() {
    this.held = {};
    this.fresh = {};
  }
}

// ── Utilidades ────────────────────────────────────────────────────────────────

export interface Invasor {
  col: number;
  fila: number;
  tipo: TipoInvasor;
  vivo: boolean;
}

// La posición NO se guarda: se deriva de la celda y del desplazamiento de la
// formación. 55 siluetas que se mueven a la vez no son 55 estados
// independientes, y guardarlas por separado es la vía rápida a que una se
// quede atrás.
function xDe(inv: Invasor, formX: number): number {
  return formX + inv.col * CELDA_X + HUECO_X;
}

function yDe(inv: Invasor, formY: number): number {
  return formY + inv.fila * CELDA_Y + HUECO_Y;
}

export interface Bala {
  x: number;
  y: number;
}

// Solape de dos rectángulos. Toda la colisión del juego es esto: balas contra
// siluetas y siluetas contra el cañón, sin radios ni distancias, porque los
// bitmaps son rectangulares y afinar más sería castigar al jugador por los
// huecos de una silueta que él ve maciza.
export function solapan(
  ax: number,
  ay: number,
  aw: number,
  ah: number,
  bx: number,
  by: number,
  bw: number,
  bh: number,
): boolean {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

// Quién dispara de entre los vivos: el MÁS BAJO de una columna elegida al azar.
// Las dos mitades de la regla importan. Si disparara uno cualquiera, las balas
// saldrían de las filas de atrás y atravesarían a los de delante; y si la
// columna se eligiera entre las once y no entre las ocupadas, el fuego se
// apagaría a medida que se limpian columnas, justo cuando el juego debería
// apretar.
//
// `azar` entra por argumento en vez de llamar a Math.random aquí dentro: es lo
// que permite que la prueba fije la columna y afirme cuál sale.
export function eligeTirador(
  invasores: readonly Invasor[],
  azar: number,
): Invasor | null {
  const ocupadas: number[] = [];
  for (const inv of invasores) {
    if (inv.vivo && !ocupadas.includes(inv.col)) ocupadas.push(inv.col);
  }
  if (ocupadas.length === 0) return null;

  const col =
    ocupadas[Math.min(Math.floor(azar * ocupadas.length), ocupadas.length - 1)];
  let masBajo: Invasor | null = null;
  for (const inv of invasores) {
    if (!inv.vivo || inv.col !== col) continue;
    if (!masBajo || inv.fila > masBajo.fila) masBajo = inv;
  }
  return masBajo;
}

export interface Escudo {
  x: number;
  y: number;
  // Una celda por byte, 1 = intacta. Uint8Array y no boolean[] porque son 1 408
  // celdas entre los cuatro búnkeres y el array se REUSA: al reponerlos entre
  // oleadas se reescribe en sitio, no se crea otro. Es el único dato mutable
  // grande del motor y está en el camino de todas las colisiones.
  celdas: Uint8Array;
}

// Rellena un búnker con la plantilla. Sirve para crearlo y para reponerlo entre
// oleadas, que es la misma operación.
export function reponEscudo(celdas: Uint8Array): void {
  for (let f = 0; f < ESCUDO_FILAS; f++) {
    const fila = PLANTILLA_ESCUDO[f];
    for (let c = 0; c < ESCUDO_COLS; c++) {
      celdas[f * ESCUDO_COLS + c] = fila[c] === "#" ? 1 : 0;
    }
  }
}

export function creaEscudos(): Escudo[] {
  const escudos: Escudo[] = [];
  for (let i = 0; i < NUM_ESCUDOS; i++) {
    const celdas = new Uint8Array(ESCUDO_COLS * ESCUDO_FILAS);
    reponEscudo(celdas);
    // Repartidos a lo ancho por su centro, no por su borde: así los dos de los
    // extremos guardan el mismo margen que la separación entre ellos.
    const centro = (W * (i + 0.5)) / NUM_ESCUDOS;
    escudos.push({
      x: Math.round(centro - ANCHO_ESCUDO / 2),
      y: Y_ESCUDOS,
      celdas,
    });
  }
  return escudos;
}

export function celdasIntactas(celdas: Uint8Array): number {
  let total = 0;
  for (const celda of celdas) if (celda) total++;
  return total;
}

// Abre un boquete alrededor de una celda. Circular y no cuadrado: un cuadrado
// se nota a simple vista en cuanto hay dos impactos cerca.
export function erosiona(
  celdas: Uint8Array,
  col: number,
  fila: number,
  radio = RADIO_EROSION,
): void {
  for (let f = fila - radio; f <= fila + radio; f++) {
    if (f < 0 || f >= ESCUDO_FILAS) continue;
    for (let c = col - radio; c <= col + radio; c++) {
      if (c < 0 || c >= ESCUDO_COLS) continue;
      const dc = c - col;
      const df = f - fila;
      if (dc * dc + df * df > radio * radio) continue;
      celdas[f * ESCUDO_COLS + c] = 0;
    }
  }
}

// ¿Este rectángulo toca una celda intacta del búnker? Si la toca, abre el
// boquete y devuelve true, que es lo que consume la bala.
//
// `desdeArriba` dice por dónde entra el proyectil, y no es un detalle: una bala
// que sube tiene que reventar la celda MÁS BAJA que toca, y una que baja la más
// alta. Con un solo criterio, la bala del jugador abre el boquete en el techo
// del búnker atravesando el resto sin tocarlo.
export function impactaEscudo(
  escudo: Escudo,
  x: number,
  y: number,
  w: number,
  h: number,
  desdeArriba: boolean,
): boolean {
  if (!solapan(x, y, w, h, escudo.x, escudo.y, ANCHO_ESCUDO, ALTO_ESCUDO)) {
    return false;
  }

  const c0 = Math.max(0, Math.floor((x - escudo.x) / CELDA_ESCUDO));
  const c1 = Math.min(
    ESCUDO_COLS - 1,
    Math.floor((x + w - 1 - escudo.x) / CELDA_ESCUDO),
  );
  const f0 = Math.max(0, Math.floor((y - escudo.y) / CELDA_ESCUDO));
  const f1 = Math.min(
    ESCUDO_FILAS - 1,
    Math.floor((y + h - 1 - escudo.y) / CELDA_ESCUDO),
  );

  const desde = desdeArriba ? f0 : f1;
  const hasta = desdeArriba ? f1 : f0;
  const avance = desdeArriba ? 1 : -1;

  for (let f = desde; desdeArriba ? f <= hasta : f >= hasta; f += avance) {
    for (let c = c0; c <= c1; c++) {
      if (!escudo.celdas[f * ESCUDO_COLS + c]) continue;
      erosiona(escudo.celdas, c, f);
      return true;
    }
  }
  return false;
}

// Lo que borra un invasor que baja hasta la altura del búnker: todas las celdas
// que solapa, sin boquete circular. Un escudo no protege de lo que ya está
// encima, y es la señal de que la oleada está a punto de ganar.
export function arrasaEscudo(
  escudo: Escudo,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  if (!solapan(x, y, w, h, escudo.x, escudo.y, ANCHO_ESCUDO, ALTO_ESCUDO)) {
    return;
  }
  for (let f = 0; f < ESCUDO_FILAS; f++) {
    const cy = escudo.y + f * CELDA_ESCUDO;
    if (cy + CELDA_ESCUDO <= y || cy >= y + h) continue;
    for (let c = 0; c < ESCUDO_COLS; c++) {
      const cx = escudo.x + c * CELDA_ESCUDO;
      if (cx + CELDA_ESCUDO <= x || cx >= x + w) continue;
      escudo.celdas[f * ESCUDO_COLS + c] = 0;
    }
  }
}

export interface PuntosFlotantes {
  x: number;
  y: number;
  valor: number;
  ms: number; // lo que le queda en pantalla
}

export interface Nodriza {
  x: number;
  dx: 1 | -1;
}

// Lo que vale el platillo. Al azar entre los cuatro valores clásicos, y no por
// la regla del disparo nº 23 del arcade: esa premia contar disparos, no apuntar,
// y no la descubre nadie jugando.
export function eligePuntosNodriza(azar: number): number {
  const i = Math.min(
    Math.floor(azar * PUNTOS_NODRIZA.length),
    PUNTOS_NODRIZA.length - 1,
  );
  return PUNTOS_NODRIZA[i];
}

// ¿Ha llegado alguno vivo a la línea del cañón? Es el fin inmediato de la
// partida, aunque queden vidas: es la presión que le da reloj al juego. Sin
// ella las vidas son un colchón y la oleada nunca termina de apretar.
export function alcanzaronElLimite(
  invasores: readonly Invasor[],
  formY: number,
): boolean {
  for (const inv of invasores) {
    if (!inv.vivo) continue;
    if (yDe(inv, formY) + ALTO_INVASOR >= Y_LIMITE) return true;
  }
  return false;
}

// Dónde arranca la formación en cada oleada: un escalón más abajo por nivel,
// con tope. Pura para que el tope se pueda comprobar sin jugar ocho oleadas.
export function alturaDeSalida(nivel: number): number {
  return FORMACION_Y0 + Math.min(nivel - 1, TOPE_DESCENSO) * PASO_Y;
}

// El cañón vive en un carril: nunca sale de la pantalla. Pura y a nivel de
// módulo por lo mismo que avanzaFormacion — el harness de canvas no guarda los
// argumentos de fillRect, así que desde dentro del closure no hay forma de
// afirmar dónde quedó.
export function acotaCanon(x: number): number {
  return Math.min(Math.max(x, 0), W - ANCHO_CANON);
}

export interface PasoDeFormacion {
  formX: number;
  formY: number;
  dir: 1 | -1;
}

// Dónde queda la formación tras un paso. Es una función pura y vive fuera del
// closure a propósito: es la única regla del movimiento que tiene casos de
// borde —y el harness de canvas no guarda los argumentos de fillRect, así que
// por dentro del motor no habría forma de afirmar dónde acabó.
//
// `minCol` y `maxCol` son las columnas ocupadas, no las 0 y 10: cuando muere el
// último de una columna la formación gana ese margen, que es parte de por qué
// el final de una oleada se juega tan pegado a los bordes.
export function avanzaFormacion(
  formX: number,
  formY: number,
  dir: 1 | -1,
  minCol: number,
  maxCol: number,
): PasoDeFormacion {
  const izquierda = formX + minCol * CELDA_X + HUECO_X;
  const derecha = formX + maxCol * CELDA_X + HUECO_X + ANCHO_INVASOR;
  const avance = dir * PASO_X;

  // O se avanza, o se baja y se invierte: nunca las dos cosas en el mismo paso.
  // Hacer las dos deja la formación pegada al borde bajando en vertical, que es
  // el fallo clásico al implementarlo.
  if (
    izquierda + avance < MARGEN_BORDE ||
    derecha + avance > W - MARGEN_BORDE
  ) {
    return { formX, formY: formY + PASO_Y, dir: dir === 1 ? -1 : 1 };
  }
  return { formX: formX + avance, formY, dir };
}

// Pinta un bitmap fusionando las tiras horizontales de `#` en un solo fillRect.
// Un rectángulo por píxel encendido serían ~50 llamadas por invasor y ~2 700
// por fotograma; por tiras son ~8.
function dibujaBitmap(
  ctx: CanvasRenderingContext2D,
  bitmap: Bitmap,
  x: number,
  y: number,
) {
  for (let f = 0; f < bitmap.length; f++) {
    const fila = bitmap[f];
    let c = 0;
    while (c < fila.length) {
      if (fila[c] !== "#") {
        c++;
        continue;
      }
      let fin = c;
      while (fin < fila.length && fila[fin] === "#") fin++;
      ctx.fillRect(x + c * ESCALA, y + f * ESCALA, (fin - c) * ESCALA, ESCALA);
      c = fin;
    }
  }
}

// ── Dibujo ────────────────────────────────────────────────────────────────────

function dibujaFondo(ctx: CanvasRenderingContext2D, paleta: PaletaInvasores) {
  ctx.fillStyle = paleta.fondo;
  ctx.fillRect(0, 0, W, H);

  // La línea del suelo: la referencia que dice hasta dónde puede bajar la
  // formación antes de que se acabe la partida.
  ctx.fillStyle = paleta.suelo;
  ctx.fillRect(0, Y_SUELO, W, 2);
}

function dibujaFormacion(
  ctx: CanvasRenderingContext2D,
  paleta: PaletaInvasores,
  invasores: readonly Invasor[],
  formX: number,
  formY: number,
  fotograma: 0 | 1,
) {
  ctx.fillStyle = paleta.invasor;
  for (const inv of invasores) {
    if (!inv.vivo) continue;
    dibujaBitmap(
      ctx,
      SILUETAS[inv.tipo][fotograma],
      xDe(inv, formX),
      yDe(inv, formY),
    );
  }
}

function dibujaCanon(
  ctx: CanvasRenderingContext2D,
  paleta: PaletaInvasores,
  canonX: number,
) {
  ctx.fillStyle = paleta.canon;
  dibujaBitmap(ctx, SILUETA_CANON, canonX, Y_CANON);
}

function dibujaBalaJugador(
  ctx: CanvasRenderingContext2D,
  paleta: PaletaInvasores,
  bala: Bala,
) {
  ctx.fillStyle = paleta.balaJugador;
  ctx.fillRect(bala.x, bala.y, ANCHO_BALA, ALTO_BALA);
}

function dibujaBalasInvasor(
  ctx: CanvasRenderingContext2D,
  paleta: PaletaInvasores,
  balas: readonly Bala[],
) {
  if (balas.length === 0) return;
  ctx.fillStyle = paleta.balaInvasor;
  for (const b of balas) ctx.fillRect(b.x, b.y, ANCHO_BALA, ALTO_BALA);
}

function dibujaEscudos(
  ctx: CanvasRenderingContext2D,
  paleta: PaletaInvasores,
  escudos: readonly Escudo[],
) {
  ctx.fillStyle = paleta.escudo;
  for (const escudo of escudos) {
    for (let f = 0; f < ESCUDO_FILAS; f++) {
      let c = 0;
      // Por tiras horizontales, como dibujaBitmap: un fillRect por celda serían
      // hasta 1 408 llamadas por fotograma solo de escudos.
      while (c < ESCUDO_COLS) {
        if (!escudo.celdas[f * ESCUDO_COLS + c]) {
          c++;
          continue;
        }
        let fin = c;
        while (fin < ESCUDO_COLS && escudo.celdas[f * ESCUDO_COLS + fin]) fin++;
        ctx.fillRect(
          escudo.x + c * CELDA_ESCUDO,
          escudo.y + f * CELDA_ESCUDO,
          (fin - c) * CELDA_ESCUDO,
          CELDA_ESCUDO,
        );
        c = fin;
      }
    }
  }
}

function dibujaNodriza(
  ctx: CanvasRenderingContext2D,
  paleta: PaletaInvasores,
  nodriza: Nodriza,
) {
  ctx.fillStyle = paleta.nodriza;
  dibujaBitmap(ctx, SILUETA_NODRIZA, nodriza.x, Y_NODRIZA);
}

function dibujaPuntosFlotantes(
  ctx: CanvasRenderingContext2D,
  paleta: PaletaInvasores,
  puntos: PuntosFlotantes,
) {
  ctx.fillStyle = paleta.puntosNodriza;
  ctx.font = `${6 * ESCALA}px monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(puntos.valor), puntos.x, puntos.y);
}

function dibujaExplosion(
  ctx: CanvasRenderingContext2D,
  paleta: PaletaInvasores,
  canonX: number,
) {
  ctx.fillStyle = paleta.explosion;
  dibujaBitmap(ctx, SILUETA_EXPLOSION, canonX, Y_CANON);
}

// ── Motor ─────────────────────────────────────────────────────────────────────

export const createInvadersGame: GameFactory = (
  canvas,
  callbacks,
  skin = "neon",
) => {
  const context2d = canvas.getContext("2d");
  if (!context2d) throw new Error("INVASORES necesita un canvas 2D");
  // Con tipo explícito: el estrechamiento del guard no llega hasta draw(), que
  // es un closure.
  const ctx: CanvasRenderingContext2D = context2d;

  // Se resuelve una vez al montar. La paleta no es estado del módulo: vive en
  // el closure, como todo lo demás, así que dos motores con skins distintos no
  // se pisan.
  const paleta = paletaDe(SKINS_INVASORES, skin);

  // Todo el estado de partida vive aquí dentro. A nivel de módulo sobreviviría
  // entre montajes y volver a la pantalla arrastraría la partida anterior.
  let invasores: Invasor[] = [];
  let formX = FORMACION_X0;
  let formY = FORMACION_Y0;
  let fotograma: 0 | 1 = 0;
  let dirFormacion: 1 | -1 = 1;
  let pasoAccum = 0; // ms acumulados hacia el siguiente paso
  let canonX = (W - ANCHO_CANON) / 2;
  // Una sola bala en vuelo. No es una lista de una: es el límite del original y
  // es lo que convierte el juego en puntería en vez de en cortina de fuego.
  let bala: Bala | null = null;
  // Las suyas sí son una lista: hasta tres a la vez, que es lo que convierte
  // esquivar en elegir por dónde, y no en apartarse.
  let balasInvasor: Bala[] = [];
  let cadenciaMs = 0; // ms que faltan para el siguiente disparo enemigo
  // Mientras corre, el cañón está deshecho: la formación no avanza, nadie
  // dispara y lo único que pasa en pantalla es la explosión.
  let muriendoMs = 0;
  let vidaExtraDada = false;
  // Se crean UNA vez por motor. Entre oleadas se reponen en sitio (reponEscudo)
  // en vez de crear cuatro Uint8Array nuevos.
  let escudos: Escudo[] = [];
  let nodriza: Nodriza | null = null;
  let nodrizaMs = 0; // ms hasta el siguiente intento de aparición
  let puntosFlotantes: PuntosFlotantes | null = null;
  let score = 0;
  let lives = VIDAS_INICIALES;
  let level = 1;
  let state: "playing" | "paused" | "gameover" = "playing";
  let rafId: number | null = null;
  let lastTime: number | null = null;
  // Tiempo jugado, no transcurrido: se acumula con el dt del bucle, que deja de
  // correr al pausar. Las pausas quedan fuera sin lógica extra.
  let elapsedMs = 0;

  const input = new Input();

  // Los callbacks provocan renders de React: solo se emite cuando el valor
  // cambia de verdad. setLives llega en el paso 4 y setLevel en el 6.
  function setScore(value: number) {
    if (value === score) return;
    score = value;
    callbacks.onScore(score);

    // La vida extra va aquí y no en el punto de cada impacto: es la única forma
    // de que dé igual por dónde se hayan sumado los 1 500 —invasor, nodriza o
    // las dos cosas en el mismo fotograma— y de que se dé UNA vez.
    if (!vidaExtraDada && score >= PUNTOS_VIDA_EXTRA) {
      vidaExtraDada = true;
      setLives(lives + 1);
    }
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
  // la guardia: sin ella, rendirse tras un game over emitiría el resumen dos
  // veces y registraría la partida por duplicado en Supabase.
  function finish(reason: GameOverReason) {
    if (state === "gameover") return;
    state = "gameover";
    stopLoop();
    callbacks.onGameOver(summary(reason));
  }

  // La formación de una oleada: 55 invasores, con el tipo decidido por la fila.
  function creaFormacion(): Invasor[] {
    const nuevos: Invasor[] = [];
    for (let fila = 0; fila < FILAS; fila++) {
      for (let col = 0; col < COLUMNAS; col++) {
        nuevos.push({ col, fila, tipo: TIPO_POR_FILA[fila], vivo: true });
      }
    }
    return nuevos;
  }

  function vivos(): number {
    let total = 0;
    for (const inv of invasores) if (inv.vivo) total++;
    return total;
  }

  // Las columnas ocupadas más a la izquierda y más a la derecha, que son las que
  // deciden cuándo rebota la formación. Se recalculan en cada paso porque
  // cambian al morir el último de una columna: si se guardaran, la formación
  // seguiría rebotando contra el borde de un invasor que ya no está.
  // Devuelve null cuando no queda nadie vivo.
  function extremosVivos(): readonly [number, number] | null {
    let min = COLUMNAS;
    let max = -1;
    for (const inv of invasores) {
      if (!inv.vivo) continue;
      if (inv.col < min) min = inv.col;
      if (inv.col > max) max = inv.col;
    }
    return max < 0 ? null : [min, max];
  }

  // Un paso de la formación: la unidad de tiempo del juego.
  function pasoFormacion() {
    const extremos = extremosVivos();
    if (!extremos) return;

    const siguiente = avanzaFormacion(
      formX,
      formY,
      dirFormacion,
      extremos[0],
      extremos[1],
    );
    formX = siguiente.formX;
    formY = siguiente.formY;
    dirFormacion = siguiente.dir;

    fotograma = fotograma === 0 ? 1 : 0;

    // Solo tras un paso, no en cada fotograma: la formación únicamente se mueve
    // aquí, así que entre paso y paso no hay nada nuevo que arrasar.
    arrasaConLaFormacion();

    // Y por lo mismo, el límite se mira aquí: la formación solo baja al rebotar.
    if (alcanzaronElLimite(invasores, formY)) finish("game_over");
  }

  // Los invasores que han bajado hasta los búnkeres se los comen al pasar.
  function arrasaConLaFormacion() {
    for (const inv of invasores) {
      if (!inv.vivo) continue;
      const y = yDe(inv, formY);
      // Corte barato antes de entrar en las celdas: mientras la formación está
      // arriba —que es casi toda la partida— esto no toca ningún escudo.
      if (y + ALTO_INVASOR < Y_ESCUDOS) continue;
      const x = xDe(inv, formX);
      for (const escudo of escudos) {
        arrasaEscudo(escudo, x, y, ANCHO_INVASOR, ALTO_INVASOR);
      }
    }
  }

  // Formación limpia: sube el nivel, se reponen los búnkeres y la siguiente
  // arranca un escalón más abajo. Lo que NO se toca son las vidas ni la
  // puntuación: una oleada nueva no es una partida nueva.
  function siguienteOleada() {
    setLevel(level + 1);
    invasores = creaFormacion();
    formX = FORMACION_X0;
    formY = alturaDeSalida(level);
    dirFormacion = 1;
    fotograma = 0;
    pasoAccum = 0;
    bala = null;
    balasInvasor = [];
    nodriza = null;
    puntosFlotantes = null;
    cadenciaMs = nuevaCadencia();
    nodrizaMs = nuevoRelojDeNodriza();
    for (const escudo of escudos) reponEscudo(escudo.celdas);
  }

  function initGame() {
    invasores = creaFormacion();
    formX = FORMACION_X0;
    formY = FORMACION_Y0;
    fotograma = 0;
    dirFormacion = 1;
    pasoAccum = 0;
    canonX = (W - ANCHO_CANON) / 2;
    bala = null;
    balasInvasor = [];
    if (escudos.length === 0) escudos = creaEscudos();
    else for (const escudo of escudos) reponEscudo(escudo.celdas);
    cadenciaMs = nuevaCadencia();
    nodriza = null;
    nodrizaMs = nuevoRelojDeNodriza();
    puntosFlotantes = null;
    muriendoMs = 0;
    vidaExtraDada = false;
    input.clear();
    score = 0;
    lives = VIDAS_INICIALES;
    level = 1;
    state = "playing";
    elapsedMs = 0;
    lastTime = null;

    // Emitidos directamente, sin pasar por los setters: al reiniciar los
    // valores coinciden con los de la partida anterior y el HUD se quedaría
    // enseñando la puntuación vieja.
    callbacks.onScore(score);
    callbacks.onLives(lives);
    callbacks.onLevel(level);
  }

  // El cañón: carril horizontal sin inercia, acotado a la pantalla.
  function mueveCanon(dt: number) {
    let dx = 0;
    if (input.isHeld("ArrowLeft")) dx -= 1;
    if (input.isHeld("ArrowRight")) dx += 1;
    if (dx === 0) return;
    canonX = acotaCanon(canonX + dx * VEL_CANON * dt);
  }

  function dispara() {
    // La guardia entera del límite del original: mientras haya bala en vuelo no
    // sale otra. Sin ella, mantener el dedo en el botón A del mando barrería la
    // formación sin apuntar.
    if (bala) return;
    bala = {
      x: canonX + (ANCHO_CANON - ANCHO_BALA) / 2,
      y: Y_CANON - ALTO_BALA,
    };
  }

  // Devuelve el invasor tocado, o null. Recorre de abajo arriba porque los de
  // las filas bajas son los que tapan a los de arriba: son los que se pueden
  // tocar primero.
  function invasorEn(x: number, y: number, w: number, h: number) {
    for (let i = invasores.length - 1; i >= 0; i--) {
      const inv = invasores[i];
      if (!inv.vivo) continue;
      if (
        solapan(
          x,
          y,
          w,
          h,
          xDe(inv, formX),
          yDe(inv, formY),
          ANCHO_INVASOR,
          ALTO_INVASOR,
        )
      ) {
        return inv;
      }
    }
    return null;
  }

  function mueveBala(dt: number) {
    if (!bala) return;
    bala.y -= VEL_BALA_JUGADOR * dt;

    // Salir por arriba también libera el disparo: fallar cuesta el tiempo que
    // la bala tarda en cruzar la pantalla, y ese es el precio de fallar.
    if (bala.y + ALTO_BALA < 0) {
      bala = null;
      return;
    }

    // El escudo se comprueba ANTES que la formación: está en medio, así que un
    // disparo que atravesara el búnker para tocar a un invasor detrás sería el
    // juego regalando lo que acaba de cobrar.
    for (const escudo of escudos) {
      if (impactaEscudo(escudo, bala.x, bala.y, ANCHO_BALA, ALTO_BALA, false)) {
        bala = null;
        return;
      }
    }

    if (
      nodriza &&
      solapan(
        bala.x,
        bala.y,
        ANCHO_BALA,
        ALTO_BALA,
        nodriza.x,
        Y_NODRIZA,
        ANCHO_NODRIZA,
        ALTO_NODRIZA,
      )
    ) {
      const valor = eligePuntosNodriza(Math.random());
      puntosFlotantes = {
        x: nodriza.x + ANCHO_NODRIZA / 2,
        y: Y_NODRIZA + ALTO_NODRIZA / 2,
        valor,
        ms: DURACION_PUNTOS,
      };
      nodriza = null;
      bala = null;
      setScore(score + valor);
      return;
    }

    const tocado = invasorEn(bala.x, bala.y, ANCHO_BALA, ALTO_BALA);
    if (!tocado) return;
    tocado.vivo = false;
    bala = null;
    setScore(score + PUNTOS_POR_TIPO[tocado.tipo]);

    // Última de la oleada: se sube de nivel aquí mismo, no en el fotograma
    // siguiente, o el paso de formación intermedio movería una formación vacía.
    if (vivos() === 0) siguienteOleada();
  }

  function nuevoRelojDeNodriza(): number {
    return (
      NODRIZA_INTERVALO_MIN +
      Math.random() * (NODRIZA_INTERVALO_MAX - NODRIZA_INTERVALO_MIN)
    );
  }

  // Entra por un borde al azar y cruza entera. Se llama cuando vence el reloj;
  // si no toca —ya hay una, o quedan pocos invasores— el reloj se reinicia
  // igual, así que la siguiente oportunidad llega cuando debe y no de golpe.
  function apareceNodriza() {
    if (nodriza || vivos() < NODRIZA_MIN_VIVOS) return;
    const haciaLaDerecha = Math.random() < 0.5;
    nodriza = {
      x: haciaLaDerecha ? -ANCHO_NODRIZA : W,
      dx: haciaLaDerecha ? 1 : -1,
    };
  }

  function mueveNodriza(dt: number) {
    if (!nodriza) return;
    nodriza.x += nodriza.dx * NODRIZA_VEL * dt;
    if (nodriza.x > W || nodriza.x + ANCHO_NODRIZA < 0) nodriza = null;
  }

  function nuevaCadencia(): number {
    return CADENCIA_MIN + Math.random() * (CADENCIA_MAX - CADENCIA_MIN);
  }

  function velBalaInvasor(): number {
    return VEL_BALA_INVASOR * (1 + SUBIDA_POR_NIVEL * (level - 1));
  }

  function disparaInvasor() {
    if (balasInvasor.length >= MAX_BALAS_INVASOR) return;
    const tirador = eligeTirador(invasores, Math.random());
    if (!tirador) return;
    balasInvasor.push({
      x: xDe(tirador, formX) + (ANCHO_INVASOR - ANCHO_BALA) / 2,
      y: yDe(tirador, formY) + ALTO_INVASOR,
    });
  }

  // Una vida menos. Es el único camino, y por eso es donde vive el orden que
  // fija la spec: onLives(0) primero y onGameOver después, para que el HUD no
  // enseñe una vida de más bajo el modal de fin.
  function muereElCanon() {
    bala = null;
    balasInvasor = [];
    muriendoMs = DURACION_EXPLOSION;
    setLives(lives - 1);
    if (lives <= 0) finish("game_over");
  }

  function mueveBalasInvasor(dt: number) {
    if (balasInvasor.length === 0) return;
    const vel = velBalaInvasor() * dt;

    // Se recorre al revés para poder quitar in situ sin saltarse el siguiente.
    for (let i = balasInvasor.length - 1; i >= 0; i--) {
      const b = balasInvasor[i];
      b.y += vel;

      if (b.y > H) {
        balasInvasor.splice(i, 1);
        continue;
      }

      let frenada = false;
      for (const escudo of escudos) {
        if (impactaEscudo(escudo, b.x, b.y, ANCHO_BALA, ALTO_BALA, true)) {
          balasInvasor.splice(i, 1);
          frenada = true;
          break;
        }
      }
      if (frenada) continue;

      if (
        solapan(
          b.x,
          b.y,
          ANCHO_BALA,
          ALTO_BALA,
          canonX,
          Y_CANON,
          ANCHO_CANON,
          ALTO_CANON,
        )
      ) {
        muereElCanon();
        return;
      }
    }
  }

  function update(dt: number) {
    if (state !== "playing") return;

    const dtMs = dt * 1000;
    elapsedMs += dtMs;

    // Con el cañón deshecho el mundo se para: la formación no avanza, nadie
    // dispara y el jugador ve lo que le ha pasado. Sin esta pausa, la bala que
    // acaba de matarlo se lleva por delante la vida siguiente.
    if (muriendoMs > 0) {
      muriendoMs -= dtMs;
      if (muriendoMs <= 0) {
        muriendoMs = 0;
        canonX = (W - ANCHO_CANON) / 2;
        cadenciaMs = nuevaCadencia();
      }
      return;
    }

    pasoAccum += dtMs;

    mueveCanon(dt);
    if (input.disparo()) dispara();
    mueveBala(dt);

    cadenciaMs -= dtMs;
    if (cadenciaMs <= 0) {
      disparaInvasor();
      cadenciaMs = nuevaCadencia();
    }
    mueveBalasInvasor(dt);
    if (state !== "playing") return;

    nodrizaMs -= dtMs;
    if (nodrizaMs <= 0) {
      apareceNodriza();
      nodrizaMs = nuevoRelojDeNodriza();
    }
    mueveNodriza(dt);

    if (puntosFlotantes) {
      puntosFlotantes.ms -= dtMs;
      if (puntosFlotantes.ms <= 0) puntosFlotantes = null;
    }

    const intervalo = intervaloPara(vivos(), level) * 1000;
    if (pasoAccum >= intervalo) {
      // Como mucho un paso por fotograma, y el sobrante se capa. Encadenar dos
      // pasos sin dibujar entre medias movería la formación 16 px de golpe, y
      // con el último invasor —que va a doce pasos por segundo— eso es
      // exactamente lo que pasaría tras un dt largo.
      pasoAccum = Math.min(pasoAccum - intervalo, intervalo);
      pasoFormacion();
    }
  }

  function draw() {
    dibujaFondo(ctx, paleta);
    dibujaFormacion(ctx, paleta, invasores, formX, formY, fotograma);
    if (nodriza) dibujaNodriza(ctx, paleta, nodriza);
    if (puntosFlotantes) dibujaPuntosFlotantes(ctx, paleta, puntosFlotantes);
    dibujaEscudos(ctx, paleta, escudos);
    if (muriendoMs > 0) dibujaExplosion(ctx, paleta, canonX);
    else dibujaCanon(ctx, paleta, canonX);
    if (bala) dibujaBalaJugador(ctx, paleta, bala);
    dibujaBalasInvasor(ctx, paleta, balasInvasor);
  }

  function loop(ts: number) {
    // dt capado: sin el tope, volver de otra pestaña acumularía de golpe el
    // tiempo que la pestaña estuvo oculta y todo se teletransportaría.
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
      draw(); // deja el fotograma congelado bajo el overlay de la plataforma
    },

    resume() {
      if (state !== "paused") return;
      // También aquí, y no solo al pausar: los listeners siguen enganchados
      // durante la pausa, así que un disparo tecleado con el juego congelado
      // saldría de golpe al reanudar.
      input.clear();
      state = "playing";
      rafId = requestAnimationFrame(loop);
    },

    end() {
      finish("surrender");
    },

    // Desmontar no es terminar una partida: no emite onGameOver. Si lo hiciera,
    // navegar fuera registraría una partida fantasma en Supabase.
    destroy() {
      stopLoop();
      input.detach();
    },
  };
};
