// ===== app/lib/games/snake.ts =====
// Motor de SERPENTINA (Snake). A diferencia de ROCAS, CAÍDA y BLOQUE BUSTER no
// es un porte: no hay carpeta en references/templates/started-games/, así que
// las mecánicas son las que fija la SPEC 10.
//
// De references/templates/snake-assets/ solo se aprovecha el material gráfico, y
// con dos cambios deliberados:
//  - sprites.js publica el atlas en window.SPRITE_ATLAS. Aquí es una constante
//    tipada del módulo: window no existe al renderizar en el servidor y el motor
//    no debe depender de nada de references/.
//  - La ruta del original ("snake-assets/fruits.png") es relativa y en Next no
//    resuelve. El PNG está copiado en public/ y se sirve desde /snake-fruits.png.
//
// Los nombres de fruta de sprites.js están descuadrados respecto a la imagen (lo
// que llama "banana" es la manzana del primer recorte); las coordenadas sí son
// correctas. La tabla de abajo conserva las coordenadas y corrige los nombres
// mirando el PNG recorte a recorte.
//
// Como en los otros motores, el estado de partida vive en el closure de
// createSnakeGame: en Next un `let` de módulo sobrevive entre montajes y volver
// a la pantalla arrastraría la partida anterior.

import { paletaDe, type FichaDeSkins } from "./skins";
import type { GameFactory, GameOverReason, GameOverSummary } from "./types";

// ── Constantes ────────────────────────────────────────────────────────────────

// Resolución lógica. El ajuste al contenedor es puramente CSS: el reproductor
// fija el canvas en 800×600 y .crt-screen declara aspect-ratio 4/3.
export const W = 800;
export const H = 600;

// 32×25 = 800 y 24×25 = 600, exacto: la grilla llena el canvas sin bandas
// negras ni márgenes que centrar.
const CELL = 25;
const COLS = 32;
const ROWS = 24;

// Velocidad: milisegundos entre paso y paso de la serpiente. El nivel 1 avanza
// a ~7 pasos/s y el tope son ~18. El suelo (55 ms) queda por encima del cap de
// dt del bucle (50 ms), que es lo que garantiza que nunca toquen dos pasos en
// un mismo fotograma.
const STEP_BASE = 145;
const STEP_DEC = 8; // menos por cada nivel
const STEP_MIN = 55;

const FRUTAS_POR_NIVEL = 5; // nivel = floor(comidas / 5) + 1
const LARGO_INICIAL = 3; // segmentos al empezar, en el centro, mirando a la derecha

// Los recortes del atlas no son cuadrados (110–170 × 160), así que se dibujan
// conservando la proporción: se fija el alto y el ancho sale de él. 1.3 celdas
// de alto es lo que hace legible una fruta sobre una celda de 25 px.
const SPRITE_SRC = "/snake-fruits.png";
const SPRITE_ESCALA = 1.3;

// ── Paleta ────────────────────────────────────────────────────────────────────

// La paleta de referencia. Son los mismos valores que los tokens de :root en
// app/globals.css (--green, --yellow, --magenta, --cyan), copiados aquí porque
// el canvas no entiende de variables CSS: si el tema cambia, hay que tocar los
// dos sitios.
//
// Cada color se guarda TAL COMO llega al contexto, con su alfa incluido si es
// fijo: la rejilla y el resplandor de la serpiente son translúcidos siempre, así
// que su alfa es parte del color y es lo que hay que medir.
const PALETA_NEON = {
  fondo: "#000",
  rejilla: "rgba(0,255,136,0.06)", // --green muy diluido
  cuerpo: "#00ff88", // --green
  cabeza: "#7dffc4", // --green aclarado, para distinguir la cabeza
  ojo: "#001a10",
  brillo: "rgba(0,255,136,0.35)", // resplandor bajo la serpiente
  // Los tres colores de rareza. Tiñen el resplandor del sprite y, mientras el
  // PNG no ha cargado, pintan el rombo del fallback.
  frutaComun: "#f5ff00", // --yellow
  frutaRara: "#ff006e", // --magenta
  frutaExotica: "#00f5ff", // --cyan
} as const;

export type RolSerpentina = keyof typeof PALETA_NEON;
export type PaletaSerpentina = Readonly<Record<RolSerpentina, string>>;

export const SKINS_SERPENTINA: FichaDeSkins<RolSerpentina> = {
  roles: {
    fondo: { clase: "superficie" },
    // La rejilla es "superficie" y no "decorado" a propósito: su alfa de 0.06
    // sobre negro da 1.07:1, muy por debajo del 1.5:1 de un decorado. No es un
    // descuido de neón sino lo que se busca — da escala a la grilla sin competir
    // con la serpiente, y "superficie" (máximo 2:1) es justo la clase que exige
    // que siga siendo fondo en las tres skins.
    rejilla: { clase: "superficie" },
    cuerpo: { clase: "jugable" },
    cabeza: { clase: "jugable" },
    // Los ojos se pintan encima de la cabeza, no del tablero: medirlos contra el
    // fondo aprobaría un color que en pantalla no se ve.
    ojo: { clase: "jugable", sobre: "cabeza" },
    brillo: { clase: "decorado" },
    frutaComun: { clase: "jugable" },
    frutaRara: { clase: "jugable" },
    frutaExotica: { clase: "jugable" },
  },
  // Lo que hay que poder distinguir es la serpiente de la comida, y las tres
  // rarezas entre sí: la rareza decide puntos, crecimiento y frecuencia, así que
  // confundir una exótica con una común es confundir 300 puntos con 50.
  //
  // La cabeza queda fuera del grupo a propósito. En neón es el mismo verde
  // aclarado del cuerpo (1.09× de luminancia y 0.8° de tono), y esa relación
  // está congelada; se distingue por posición y por los ojos, no por color, como
  // en cualquier Snake. Meterla en el grupo habría obligado a cambiar neón.
  grupos: [["cuerpo", "frutaComun", "frutaRara", "frutaExotica"]],
  paletas: {
    neon: PALETA_NEON,

    // Monitor de fósforo ámbar: un solo tono y todo el trabajo hecho por la
    // luminancia. La rampa va de la fruta común (la que sale el 65% de las
    // veces, deliberadamente discreta) al blanco cálido de la exótica, pasando
    // por la serpiente: cuanto más rara es la fruta, más quema el fósforo.
    retro: {
      fondo: "#000",
      rejilla: "rgba(255,176,0,0.06)",
      cuerpo: "#c07800",
      cabeza: "#dc9800",
      ojo: "#2b1500",
      brillo: "rgba(255,176,0,0.35)",
      frutaComun: "#8a6000",
      frutaRara: "#ffc135",
      frutaExotica: "#fff3d7",
    },

    // La pantalla de fósforo verde de la Game Boy y del Snake de Nokia, con su
    // #9bbc0f para la cabeza. La rampa está invertida respecto al original —allí
    // el verde era el FONDO y los píxeles se apagaban a #0f380f— porque el
    // portal es siempre oscuro: aquí el verde de pantalla lo lleva la serpiente.
    // Los ojos sí conservan el #0f380f, que es el tono más apagado de la DMG.
    clasico: {
      fondo: "#000",
      rejilla: "rgba(155,188,15,0.06)",
      cuerpo: "#728b0b",
      cabeza: "#9bbc0f",
      ojo: "#0f380f",
      brillo: "rgba(155,188,15,0.35)",
      frutaComun: "#5c6f09",
      frutaRara: "#c0d567",
      frutaExotica: "#f1f6df",
    },
  },
};

// ── Tipos ─────────────────────────────────────────────────────────────────────

// Posición en la grilla, en celdas (no en píxeles).
interface Celda {
  col: number;
  row: number;
}

// Dirección de avance: una sola componente vale ±1, la otra 0.
interface Vec {
  dc: number;
  dr: number;
}

// Recorte dentro de snake-fruits.png, en píxeles de la imagen.
interface Recorte {
  x: number;
  y: number;
  w: number;
  h: number;
}

type Rareza = "comun" | "rara" | "exotica";

interface Fruta {
  nombre: string; // solo para leer el código; no se pinta en pantalla
  recorte: Recorte;
  rareza: Rareza;
}

// ── Frutas ────────────────────────────────────────────────────────────────────

// La rareza decide las tres cosas a la vez: cuánto puntúa, cuánto alarga la
// serpiente y con qué frecuencia sale. Que la fruta más golosa sea también la
// que más estorba después es el único sistema de riesgo/recompensa del juego.
const RAREZAS: Record<Rareza, { puntos: number; crece: number; peso: number }> =
  {
    comun: { puntos: 50, crece: 1, peso: 65 },
    rara: { puntos: 150, crece: 2, peso: 27 },
    exotica: { puntos: 300, crece: 3, peso: 8 },
  };

// Fila pixel-art de snake-fruits.png: y = 136, alto = 160. Las otras dos filas
// de la hoja son ilustraciones suaves que desentonan con el marco CRT.
const FRUTA_Y = 136;
const FRUTA_H = 160;

const FRUTAS: readonly Fruta[] = [
  {
    nombre: "manzana",
    recorte: { x: 34, y: FRUTA_Y, w: 110, h: FRUTA_H },
    rareza: "comun",
  },
  {
    nombre: "plátano",
    recorte: { x: 186, y: FRUTA_Y, w: 150, h: FRUTA_H },
    rareza: "comun",
  },
  {
    nombre: "piña",
    recorte: { x: 378, y: FRUTA_Y, w: 110, h: FRUTA_H },
    rareza: "exotica",
  },
  {
    nombre: "uvas",
    recorte: { x: 540, y: FRUTA_Y, w: 130, h: FRUTA_H },
    rareza: "comun",
  },
  {
    nombre: "calabaza",
    recorte: { x: 712, y: FRUTA_Y, w: 130, h: FRUTA_H },
    rareza: "rara",
  },
  {
    nombre: "nabo",
    recorte: { x: 894, y: FRUTA_Y, w: 110, h: FRUTA_H },
    rareza: "rara",
  },
  {
    nombre: "berenjena",
    recorte: { x: 1066, y: FRUTA_Y, w: 110, h: FRUTA_H },
    rareza: "rara",
  },
  {
    nombre: "fresa",
    recorte: { x: 1228, y: FRUTA_Y, w: 130, h: FRUTA_H },
    rareza: "comun",
  },
  {
    nombre: "cerezas",
    recorte: { x: 1400, y: FRUTA_Y, w: 130, h: FRUTA_H },
    rareza: "comun",
  },
  {
    nombre: "zanahoria",
    recorte: { x: 1582, y: FRUTA_Y, w: 110, h: FRUTA_H },
    rareza: "comun",
  },
  {
    nombre: "champiñón",
    recorte: { x: 1734, y: FRUTA_Y, w: 150, h: FRUTA_H },
    rareza: "exotica",
  },
  {
    nombre: "brócoli",
    recorte: { x: 1906, y: FRUTA_Y, w: 150, h: FRUTA_H },
    rareza: "comun",
  },
  {
    nombre: "sandía",
    recorte: { x: 2068, y: FRUTA_Y, w: 170, h: FRUTA_H },
    rareza: "comun",
  },
  {
    nombre: "chile",
    recorte: { x: 2250, y: FRUTA_Y, w: 140, h: FRUTA_H },
    rareza: "rara",
  },
  {
    nombre: "kiwi",
    recorte: { x: 2432, y: FRUTA_Y, w: 130, h: FRUTA_H },
    rareza: "rara",
  },
  {
    nombre: "limón",
    recorte: { x: 2604, y: FRUTA_Y, w: 130, h: FRUTA_H },
    rareza: "comun",
  },
  {
    nombre: "naranja",
    recorte: { x: 2786, y: FRUTA_Y, w: 110, h: FRUTA_H },
    rareza: "comun",
  },
  {
    nombre: "melocotón",
    recorte: { x: 2948, y: FRUTA_Y, w: 130, h: FRUTA_H },
    rareza: "comun",
  },
  {
    nombre: "cacahuete",
    recorte: { x: 3110, y: FRUTA_Y, w: 150, h: FRUTA_H },
    rareza: "rara",
  },
  {
    nombre: "frambuesa",
    recorte: { x: 3302, y: FRUTA_Y, w: 110, h: FRUTA_H },
    rareza: "rara",
  },
  {
    nombre: "tomate",
    recorte: { x: 3454, y: FRUTA_Y, w: 150, h: FRUTA_H },
    rareza: "comun",
  },
  {
    nombre: "cuenco de frutas",
    recorte: { x: 3637, y: FRUTA_Y, w: 130, h: FRUTA_H },
    rareza: "exotica",
  },
];

// Agrupadas por rareza para elegir en dos tiempos (ver frutaAleatoria). Se
// calcula una vez al importar: no es estado de partida, es la misma tabla de
// arriba vista de otra forma.
const POR_RAREZA: Record<Rareza, readonly Fruta[]> = {
  comun: FRUTAS.filter((f) => f.rareza === "comun"),
  rara: FRUTAS.filter((f) => f.rareza === "rara"),
  exotica: FRUTAS.filter((f) => f.rareza === "exotica"),
};

// Una fruta ya colocada en la grilla.
interface FrutaEnJuego {
  col: number;
  row: number;
  fruta: Fruta;
}

// ── Reglas puras ──────────────────────────────────────────────────────────────
//
// Todas reciben por argumento lo que necesitan y no leen nada del closure del
// motor: así se pueden razonar (y algún día probar) por separado.

function mismaCelda(a: Celda, b: Celda): boolean {
  return a.col === b.col && a.row === b.row;
}

// La cabeza avanza una celda entera por paso: la serpiente se mueve en la
// grilla, no en píxeles, así que no hay posiciones intermedias.
function avanzar(cabeza: Celda, dir: Vec): Celda {
  return { col: cabeza.col + dir.dc, row: cabeza.row + dir.dr };
}

// Los cuatro bordes son pared: salirse termina la partida.
function fueraDeGrilla(celda: Celda): boolean {
  return (
    celda.col < 0 || celda.col >= COLS || celda.row < 0 || celda.row >= ROWS
  );
}

// `hasta` acota cuántos segmentos se miran, sin copiar el array. El motor lo usa
// para dejar fuera el último: si la serpiente no está creciendo, esa celda queda
// libre en el mismo paso, así que meter ahí la cabeza es legal y no un choque.
function chocaConCuerpo(
  snake: readonly Celda[],
  celda: Celda,
  hasta = snake.length,
): boolean {
  for (let i = 0; i < hasta; i++) {
    if (mismaCelda(snake[i], celda)) return true;
  }
  return false;
}

// Todas las celdas de la grilla que no ocupa la serpiente. Se recorre entera
// (768 celdas) en vez de sortear al azar y repetir hasta acertar: con la
// serpiente muy larga, el sorteo puede tardar arbitrariamente, y aquí además da
// gratis el caso de tablero lleno.
function celdasLibres(snake: readonly Celda[]): Celda[] {
  const ocupadas = new Set<number>();
  for (const s of snake) ocupadas.add(s.row * COLS + s.col);

  const libres: Celda[] = [];
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      if (!ocupadas.has(row * COLS + col)) libres.push({ col, row });
    }
  }
  return libres;
}

// Se sortea primero la rareza con sus pesos (65 / 27 / 8) y después una fruta
// cualquiera dentro de ella. Sorteando entre las 22 con el peso de su rareza
// saldría otra cosa: hay 12 comunes y solo 3 exóticas, así que el grupo grande
// se llevaría una probabilidad mucho mayor de la acordada.
function frutaAleatoria(): Fruta {
  const total = RAREZAS.comun.peso + RAREZAS.rara.peso + RAREZAS.exotica.peso;
  let tirada = Math.random() * total;

  for (const rareza of ["exotica", "rara", "comun"] as const) {
    tirada -= RAREZAS[rareza].peso;
    if (tirada < 0) {
      const grupo = POR_RAREZA[rareza];
      return grupo[Math.floor(Math.random() * grupo.length)];
    }
  }
  // Inalcanzable salvo por error de redondeo en la última resta.
  return POR_RAREZA.comun[0];
}

// null = no queda ni una celda libre, es decir, la serpiente llena el tablero.
// El motor lo trata como fin de partida (ver paso 6).
function nuevaFruta(snake: readonly Celda[]): FrutaEnJuego | null {
  const libres = celdasLibres(snake);
  if (libres.length === 0) return null;

  const celda = libres[Math.floor(Math.random() * libres.length)];
  return { col: celda.col, row: celda.row, fruta: frutaAleatoria() };
}

// ── Teclado ───────────────────────────────────────────────────────────────────

// Se usa e.code y no e.key porque es independiente de la distribución del
// teclado: en un AZERTY, KeyW sigue siendo la tecla de arriba a la izquierda.
const DIRECCIONES: Record<string, Vec> = {
  ArrowUp: { dc: 0, dr: -1 },
  KeyW: { dc: 0, dr: -1 },
  ArrowDown: { dc: 0, dr: 1 },
  KeyS: { dc: 0, dr: 1 },
  ArrowLeft: { dc: -1, dr: 0 },
  KeyA: { dc: -1, dr: 0 },
  ArrowRight: { dc: 1, dr: 0 },
  KeyD: { dc: 1, dr: 0 },
};

// Solo las teclas del juego, y solo mientras el motor está enganchado: si no,
// las flechas dejarían de hacer scroll en el resto de la página.
const PREVENT_DEFAULT = new Set(Object.keys(DIRECCIONES));

// Cuántos giros se guardan por delante. Con uno solo, girar dos veces seguidas
// muy rápido (↑ e inmediatamente →) perdería el segundo; con más de dos, la
// serpiente sigue obedeciendo teclas pulsadas hace rato y se siente pastosa.
const MAX_GIROS_EN_COLA = 2;

function esOpuesta(a: Vec, b: Vec): boolean {
  return a.dc === -b.dc && a.dr === -b.dr;
}

function esIgual(a: Vec, b: Vec): boolean {
  return a.dc === b.dc && a.dr === b.dr;
}

class Input {
  private cola: Vec[] = [];
  private attached = false;
  // Dirección del último paso dado. Es la referencia contra la que se valida un
  // giro cuando la cola está vacía.
  private dirAplicada: Vec = { dc: 1, dr: 0 };

  private onKeyDown = (e: KeyboardEvent) => {
    const dir = DIRECCIONES[e.code];
    if (!dir) return;
    e.preventDefault();

    if (this.cola.length >= MAX_GIROS_EN_COLA) return;

    // La referencia es el último giro ENCOLADO, no el aplicado. Comprobar
    // contra el aplicado dejaría pasar la reversa en dos teclas: entre paso y
    // paso caben ↑ y ↓, y la segunda metería la cabeza dentro del cuello.
    const ref = this.cola.length
      ? this.cola[this.cola.length - 1]
      : this.dirAplicada;

    // La misma dirección no se encola: ocuparía sitio y retrasaría un giro real.
    if (esIgual(dir, ref) || esOpuesta(dir, ref)) return;

    this.cola.push(dir);
  };

  private onKeyUp = (e: KeyboardEvent) => {
    if (PREVENT_DEFAULT.has(e.code)) e.preventDefault();
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

  // Al empezar una partida: vacía la cola y fija la dirección de referencia.
  reiniciar(dir: Vec) {
    this.cola = [];
    this.dirAplicada = dir;
  }

  // Devuelve el siguiente giro pendiente, o null si no hay ninguno. Consume el
  // giro y pasa a ser la nueva referencia.
  siguienteGiro(): Vec | null {
    const dir = this.cola.shift();
    if (!dir) return null;
    this.dirAplicada = dir;
    return dir;
  }

  // Al pausar, para no reanudar con un giro que el jugador encoló hace rato; y
  // al reanudar, porque los listeners siguen enganchados con el juego congelado
  // y lo tecleado durante la pausa se aplicaría de golpe al volver.
  clear() {
    this.cola = [];
  }
}

// ── Dibujo del tablero y la serpiente ─────────────────────────────────────────
//
// Las funciones de dibujo reciben el contexto y los datos por argumento; no
// capturan nada. Aquí no se pinta ni puntuación, ni nivel, ni vidas, ni GAME
// OVER, ni overlay de pausa: todo eso es HUD y lo pone la plataforma.

// roundRect existe en los navegadores modernos, pero se dibuja a mano para no
// depender de él ni de la versión de las tipificaciones del DOM.
function rectRedondeado(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radio = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radio, y);
  ctx.arcTo(x + w, y, x + w, y + h, radio);
  ctx.arcTo(x + w, y + h, x, y + h, radio);
  ctx.arcTo(x, y + h, x, y, radio);
  ctx.arcTo(x, y, x + w, y, radio);
  ctx.closePath();
  ctx.fill();
}

function drawFondo(ctx: CanvasRenderingContext2D, paleta: PaletaSerpentina) {
  ctx.fillStyle = paleta.fondo;
  ctx.fillRect(0, 0, W, H);

  // Rejilla muy tenue: da escala a la grilla sin competir con la serpiente. El
  // medio píxel es para que las líneas salgan nítidas y no difuminadas en dos.
  ctx.strokeStyle = paleta.rejilla;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let col = 1; col < COLS; col++) {
    ctx.moveTo(col * CELL + 0.5, 0);
    ctx.lineTo(col * CELL + 0.5, H);
  }
  for (let row = 1; row < ROWS; row++) {
    ctx.moveTo(0, row * CELL + 0.5);
    ctx.lineTo(W, row * CELL + 0.5);
  }
  ctx.stroke();
}

function drawSerpiente(
  ctx: CanvasRenderingContext2D,
  paleta: PaletaSerpentina,
  snake: readonly Celda[],
  dir: Vec,
) {
  ctx.save();
  ctx.shadowColor = paleta.brillo;
  ctx.shadowBlur = 10;

  // De la cola hacia la cabeza, para que la cabeza quede por encima cuando la
  // serpiente se pliega sobre sí misma.
  ctx.fillStyle = paleta.cuerpo;
  for (let i = snake.length - 1; i >= 1; i--) {
    const s = snake[i];
    rectRedondeado(
      ctx,
      s.col * CELL + 2,
      s.row * CELL + 2,
      CELL - 4,
      CELL - 4,
      6,
    );
  }

  const cabeza = snake[0];
  ctx.fillStyle = paleta.cabeza;
  ctx.shadowBlur = 16;
  rectRedondeado(
    ctx,
    cabeza.col * CELL + 1,
    cabeza.row * CELL + 1,
    CELL - 2,
    CELL - 2,
    7,
  );
  ctx.restore();

  // Los ojos miran hacia donde avanza la serpiente: es lo que permite leer la
  // dirección de un vistazo cuando la cola cruza media pantalla.
  const cx = cabeza.col * CELL + CELL / 2;
  const cy = cabeza.row * CELL + CELL / 2;
  const perp = { dc: -dir.dr, dr: dir.dc }; // perpendicular a la marcha
  const AVANCE = CELL * 0.16; // hacia el morro
  const SEPARACION = CELL * 0.2; // a cada lado del eje
  const OJO = Math.round(CELL * 0.18);

  ctx.fillStyle = paleta.ojo;
  for (const lado of [1, -1]) {
    const ox = cx + dir.dc * AVANCE + perp.dc * SEPARACION * lado;
    const oy = cy + dir.dr * AVANCE + perp.dr * SEPARACION * lado;
    ctx.fillRect(Math.round(ox - OJO / 2), Math.round(oy - OJO / 2), OJO, OJO);
  }
}

// ── Dibujo de la fruta ────────────────────────────────────────────────────────

// La carga de la imagen es asíncrona y GameFactory es síncrona, así que el
// motor no puede esperarla: crea la imagen al arrancar y sigue dibujando el
// fallback hasta que llega el onload. Devuelve la imagen para que destroy()
// pueda soltar el handler; si llegase después de desmontar, escribiría en el
// closure de un motor que ya no existe.
function cargarSprite(alCargar: () => void): HTMLImageElement {
  const img = new Image();
  img.onload = alCargar;
  img.src = SPRITE_SRC;
  return img;
}

function colorDeRareza(paleta: PaletaSerpentina, rareza: Rareza): string {
  if (rareza === "exotica") return paleta.frutaExotica;
  if (rareza === "rara") return paleta.frutaRara;
  return paleta.frutaComun;
}

// `sprite` es null mientras el PNG no ha cargado, y siempre fuera de neón: la
// hoja de frutas trae el color horneado y ningún skin puede teñirla.
function drawFruta(
  ctx: CanvasRenderingContext2D,
  paleta: PaletaSerpentina,
  fruta: FrutaEnJuego,
  sprite: HTMLImageElement | null,
) {
  const cx = fruta.col * CELL + CELL / 2;
  const cy = fruta.row * CELL + CELL / 2;

  if (!sprite) {
    // Fallback: un rombo del color de la rareza. No pretende parecerse a la
    // fruta, solo dejar claro dónde está y cuánto vale hasta que cargue.
    const r = CELL * 0.32;
    const color = colorDeRareza(paleta, fruta.fruta.rareza);
    ctx.save();
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.moveTo(cx, cy - r);
    ctx.lineTo(cx + r, cy);
    ctx.lineTo(cx, cy + r);
    ctx.lineTo(cx - r, cy);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    return;
  }

  // Los recortes miden entre 110 y 170 px de ancho por 160 de alto: se fija el
  // alto y el ancho sale de la proporción, o las frutas anchas (sandía,
  // cacahuete) saldrían aplastadas.
  const { x, y, w, h } = fruta.fruta.recorte;
  const alto = CELL * SPRITE_ESCALA;
  const ancho = alto * (w / h);

  ctx.save();
  // El resplandor hace que la fruta pertenezca al mismo mundo que la serpiente
  // y no parezca un icono pegado encima.
  ctx.shadowColor = colorDeRareza(paleta, fruta.fruta.rareza);
  ctx.shadowBlur = 10;
  // Se deja el suavizado activo a propósito: el recorte mide 160 px de alto y
  // se dibuja a 32, y con nearest-neighbor una reducción de 5× se come cuatro
  // de cada cinco píxeles y deja la fruta hecha jirones.
  ctx.drawImage(
    sprite,
    x,
    y,
    w,
    h,
    Math.round(cx - ancho / 2),
    Math.round(cy - alto / 2),
    Math.round(ancho),
    Math.round(alto),
  );
  ctx.restore();
}

// ── Motor ─────────────────────────────────────────────────────────────────────

function nivelPara(comidas: number): number {
  return Math.floor(comidas / FRUTAS_POR_NIVEL) + 1;
}

function intervaloPara(nivel: number): number {
  return Math.max(STEP_MIN, STEP_BASE - (nivel - 1) * STEP_DEC);
}

// `skin` lleva valor por defecto y no interrogante: montar el motor sin elegir
// nada tiene que pintar exactamente lo de siempre, y Function.length no cuenta
// los parámetros con valor por defecto, así que la aridad sigue siendo 2.
export const createSnakeGame: GameFactory = (
  canvas,
  callbacks,
  skin = "neon",
) => {
  const context2d = canvas.getContext("2d");
  if (!context2d) throw new Error("SERPENTINA necesita un canvas 2D");
  // Con tipo explícito: el estrechamiento del guard no llega hasta draw(), que
  // es un closure.
  const ctx: CanvasRenderingContext2D = context2d;

  // Se resuelve una vez al montar. La paleta no es estado del módulo: vive en el
  // closure, como todo lo demás, así que dos motores con skins distintos no se
  // pisan.
  const paleta = paletaDe(SKINS_SERPENTINA, skin);

  const input = new Input();

  // Todo el estado de partida vive aquí dentro. A nivel de módulo sobreviviría
  // entre montajes y volver a la pantalla arrastraría la partida anterior.
  let snake: Celda[] = [];
  let dir: Vec = { dc: 1, dr: 0 };
  let fruta: FrutaEnJuego | null = null;
  let porCrecer = 0; // segmentos pendientes de añadir
  let score = 0;
  let comidas = 0;
  let level = 1;
  let state: "playing" | "paused" | "gameover" = "playing";
  let pasoAccum = 0; // ms acumulados hacia el siguiente paso
  let pasoIntervalo = STEP_BASE;
  let rafId: number | null = null;
  let lastTime: number | null = null;
  // Tiempo jugado, no transcurrido: se acumula con el dt del bucle, que deja de
  // correr al pausar. Las pausas quedan fuera sin lógica extra.
  let elapsedMs = 0;
  let spriteListo = false;

  // La imagen tarda en llegar y la factory no puede esperarla: hasta que cargue,
  // drawFruta pinta el fallback.
  //
  // Solo se pide en neón. La hoja de frutas trae el color horneado en los
  // píxeles y ningún skin puede teñirla, así que retro y clásico se quedan en el
  // camino vectorial —el mismo rombo que ya existe y ya está probado—, que es lo
  // único que hace alcanzables sus tres colores de rareza. Ni assets nuevos ni
  // una petición de red que no se va a usar.
  const sprite =
    skin === "neon" ? cargarSprite(() => (spriteListo = true)) : null;

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
  // la guardia: sin ella, rendirse tras un choque emitiría el resumen dos veces
  // y registraría la partida por duplicado en Supabase.
  function finish(reason: GameOverReason) {
    if (state === "gameover") return;
    state = "gameover";
    stopLoop();
    // SERPENTINA no tiene vidas: se emite 1 al empezar y 0 al acabar, para que
    // el HUD no se quede mostrando los tres corazones que pone por defecto.
    callbacks.onLives(0);
    callbacks.onGameOver(summary(reason));
  }

  function initGame() {
    // Tres segmentos en el centro, en horizontal y con la cabeza a la derecha:
    // la serpiente arranca ya en movimiento, sin esperar a ninguna tecla.
    const col = Math.floor(COLS / 2);
    const row = Math.floor(ROWS / 2);
    snake = [];
    for (let i = 0; i < LARGO_INICIAL; i++) snake.push({ col: col - i, row });

    dir = { dc: 1, dr: 0 };
    input.reiniciar(dir);
    fruta = nuevaFruta(snake);
    porCrecer = 0;
    score = 0;
    comidas = 0;
    level = 1;
    state = "playing";
    pasoAccum = 0;
    pasoIntervalo = intervaloPara(level);
    elapsedMs = 0;
    lastTime = null;

    // Emitidos directamente, sin pasar por los setters: al reiniciar los valores
    // coinciden con los de la partida anterior y el HUD se quedaría enseñando la
    // puntuación vieja.
    callbacks.onScore(score);
    callbacks.onLevel(level);
    callbacks.onLives(1);
  }

  function comer(comida: FrutaEnJuego) {
    const rareza = RAREZAS[comida.fruta.rareza];
    // El orden importa: los puntos se cobran al nivel en el que se comió la
    // fruta, y solo después sube el nivel.
    setScore(score + rareza.puntos * level);
    porCrecer += rareza.crece;
    comidas++;
    setLevel(nivelPara(comidas));
    pasoIntervalo = intervaloPara(level);

    // La serpiente ya lleva la cabeza nueva, así que la fruta nunca cae encima
    // de ella. null = no queda hueco: el tablero está lleno.
    fruta = nuevaFruta(snake);
    if (!fruta) finish("game_over");
  }

  // Un paso de rejilla: la unidad de tiempo del juego.
  function paso() {
    const giro = input.siguienteGiro();
    if (giro) dir = giro;

    const cabeza = avanzar(snake[0], dir);

    if (fueraDeGrilla(cabeza)) {
      finish("game_over");
      return;
    }

    // Si no está creciendo, el último segmento se va a mover en este mismo paso:
    // la celda queda libre y entrar en ella no es morderse.
    const hasta = porCrecer === 0 ? snake.length - 1 : snake.length;
    if (chocaConCuerpo(snake, cabeza, hasta)) {
      finish("game_over");
      return;
    }

    snake.unshift(cabeza);

    if (fruta && mismaCelda(cabeza, fruta)) {
      comer(fruta);
      if (state !== "playing") return;
    }

    if (porCrecer > 0) porCrecer--;
    else snake.pop();
  }

  function update(dt: number) {
    if (state !== "playing") return;

    const dtMs = dt * 1000;
    elapsedMs += dtMs;
    pasoAccum += dtMs;

    if (pasoAccum >= pasoIntervalo) {
      // Como mucho un paso por fotograma, y el sobrante se capa: encadenar dos
      // pasos sin dibujar entre medias movería la serpiente dos celdas de golpe,
      // y se comería a sí misma sin que se llegara a ver.
      pasoAccum = Math.min(pasoAccum - pasoIntervalo, pasoIntervalo);
      paso();
    }
  }

  function draw() {
    drawFondo(ctx, paleta);
    if (fruta) drawFruta(ctx, paleta, fruta, spriteListo ? sprite : null);
    if (snake.length > 0) drawSerpiente(ctx, paleta, snake, dir);
  }

  function loop(ts: number) {
    // dt capado: sin el tope, volver de otra pestaña acumularía de golpe el
    // tiempo que la pestaña estuvo oculta.
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
      // durante la pausa, así que los giros tecleados con el juego congelado se
      // aplicarían de golpe al reanudar.
      input.clear();
      state = "playing";
      rafId = requestAnimationFrame(loop);
    },

    end() {
      finish("surrender");
    },

    // Desmontar no es terminar una partida: no emite onGameOver. Soltar el
    // onload es de lo mismo que quitar los listeners: si la imagen llega tarde,
    // escribiría en el closure de un motor que ya nadie usa. Fuera de neón no
    // hay imagen que soltar: ese camino dibuja las frutas con primitivas.
    destroy() {
      stopLoop();
      input.detach();
      if (sprite) sprite.onload = null;
    },
  };
};
