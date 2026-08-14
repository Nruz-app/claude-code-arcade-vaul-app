// ===== app/lib/games/frogger.ts =====
// Motor de RANARIA (Frogger). Como SERPENTINA, no es un porte: no hay carpeta en
// references/templates/started-games/, así que las mecánicas son las que fija la
// spec de la game jam, en specs/game-jam/ranaria/.
//
// Dos cosas se apartan del Frogger de recreativa a propósito:
//  - No se puede ganar. Llenar los cinco nenúfares sube el nivel, vacía la meta y
//    acelera los carriles, indefinidamente. GameOverReason solo admite
//    "game_over" | "surrender", y un techo fijo haría que todos los buenos
//    jugadores empataran y el ranking dejara de ordenar nada.
//  - No hay cocodrilos, ni serpientes sobre la mediana, ni rana hembra que
//    escoltar: son tres entidades más con sus propias reglas y el río ya tiene su
//    amenaza temporal con las tortugas.
//
// Tampoco hay sprites: la rana, los coches, los troncos y las tortugas se dibujan
// con primitivas del canvas, como hace BLOQUE BUSTER. Así la factory sigue siendo
// síncrona, sin ninguna carga asíncrona que absorber.
//
// Sí es el primer juego del portal con sonido (SPEC 11): dos efectos, el salto y
// el atropello, disparados con el helper de ./audio. Las otras cuatro muertes son
// mudas a propósito — no hay grabación para ellas y reutilizar la del golpe
// mentiría.
//
// Como en los otros motores, el estado de partida vive en el closure de
// createFroggerGame: en Next un `let` de módulo sobrevive entre montajes y volver
// a la pantalla arrastraría la partida anterior.

import { crearSfx } from "./audio";
import { paletaDe, type FichaDeSkins } from "./skins";
import type { GameFactory, GameOverReason, GameOverSummary } from "./types";

// ── Constantes ────────────────────────────────────────────────────────────────

// Resolución lógica. El ajuste al contenedor es puramente CSS: el reproductor
// fija el canvas en 800×600 y .crt-screen declara aspect-ratio 4/3.
export const W = 800;
export const H = 600;

// 16×50 = 800 y 12×50 = 600, exacto: el tablero llena el canvas sin bandas
// negras ni márgenes que centrar. 50 px dan sitio a una rana legible sin sprites.
const CELL = 50;
const COLS = 16;
const ROWS = 12;

// Filas, numeradas desde arriba: 0 meta, 1–4 río, 5 mediana, 6–10 carretera,
// 11 orilla de salida.
const FILA_META = 0;
const FILA_RIO_INI = 1;
const FILA_RIO_FIN = 4;
const FILA_MEDIANA = 5;
const FILA_CARRETERA_INI = 6;
const FILA_CARRETERA_FIN = 10;
const FILA_SALIDA = 11;

// Cinco nenúfares con dos columnas de seto entre cada dos. El seto mata: es lo
// que obliga a alinear el último salto en vez de llegar arriba de cualquier
// manera.
const COLS_NENUFAR = [1, 4, 7, 10, 13] as const;

// Salto: la celda de destino se resuelve al instante y la interpolación es solo
// visual. Corto a propósito: con un salto largo, la rana "debe" celdas al jugador
// cuando el tráfico va rápido.
const SALTO_MS = 90;

// La caja de colisión de la rana es menor que su celda: sin este margen, rozar el
// morro de un coche que va por el carril de al lado ya mata.
const RANA_INSET = 8;

// Temporizador del intento, en segundos. Se acorta con el nivel y tiene suelo,
// para que a partir del nivel 10 el intento no sea imposible por reloj en vez de
// por tráfico.
const TIEMPO_BASE = 30;
const TIEMPO_DEC = 2; // menos por nivel
const TIEMPO_MIN = 18; // suelo, alcanzado en el nivel 7

// Velocidad de todos los carriles: multiplicador por nivel, con tope. Sin tope,
// hacia el nivel 15 los coches del carril rápido cruzan la pantalla en menos de
// lo que dura un salto.
const VEL_STEP = 0.12;
const VEL_MAX = 2.2; // el tope se alcanza en el nivel 11

const VIDAS_INICIALES = 3;

// Animación de muerte: la rana destella y luego reaparece en la orilla. Es lo que
// impide morir dos veces seguidas con el mismo coche antes de soltar la tecla.
const MUERTE_MS = 700;

// Ciclo de las tortugas: emergida → parpadeo de aviso → sumergida. El parpadeo
// sigue siendo plataforma, pero ya avisa: así la muerte es culpa del jugador y no
// del azar.
const TORTUGA_EMERGIDA_MS = 4000;
const TORTUGA_PARPADEO_MS = 1000;
const TORTUGA_SUMERGIDA_MS = 1500;
const TORTUGA_CICLO_MS =
  TORTUGA_EMERGIDA_MS + TORTUGA_PARPADEO_MS + TORTUGA_SUMERGIDA_MS; // 6500

// Mosca de bonus: cada MOSCA_INTERVALO_MS se sortea, con esta probabilidad, un
// nenúfar libre al azar. Caduca sola.
const MOSCA_INTERVALO_MS = 9000;
const MOSCA_PROB = 0.35;
const MOSCA_MS = 6000;
const MOSCA_PARPADEO_MS = 1500; // últimos ms, en los que parpadea antes de irse

// Puntuación. La justificación numérica está en specs/game-jam/ranaria/02-motor.md:
// una partida que llega al nivel 4 ronda los 77.000, dentro de la banda que ocupan
// los otros cuatro juegos del Salón.
const PTS_AVANCE = 25; // × nivel, por cada fila nueva del intento
const PTS_NENUFAR = 500; // × nivel
const PTS_SEGUNDO = 20; // × nivel × segundos enteros restantes
const PTS_NIVEL = 2000; // × nivel, al llenar los cinco nenúfares
const PTS_MOSCA = 800; // × nivel

// Los efectos viven en public/, como el PNG de SERPENTINA: las rutas relativas al
// módulo no las resuelve Next. Los dos archivos están recortados y normalizados al
// mismo pico (−1 dBFS) a partir de los originales de references/mp3/, así que la
// mezcla entre ellos la deciden estos dos números y nada más (SPEC 11).
const SFX_SALTO_SRC = "/rana-salto.mp3";
const SFX_CHOQUE_SRC = "/rana-choque.mp3";

// El salto suena hasta once veces por cruce y el choque una vez cada varios
// segundos: con los dos al mismo volumen, el salto tapa la partida y el golpe deja
// de leerse como un castigo. Los 6,6 dB de diferencia son deliberados.
const SFX_SALTO_VOL = 0.35;
const SFX_CHOQUE_VOL = 0.75;

// ── Paleta ────────────────────────────────────────────────────────────────────

// La paleta de referencia. Son los mismos valores que los tokens de :root en
// app/globals.css. El canvas no entiende de variables CSS: si el tema cambia,
// hay que tocar los dos sitios.
//
// El primer rol es el fondo del canvas y es la superficie contra la que se mide
// todo lo que no declare otra. Cada color se guarda TAL COMO llega al contexto,
// con su alfa incluido si es fijo.
//
// Los cinco colores de los vehículos vivían sueltos en la tabla CARRILES, donde
// ningún skin podía alcanzarlos: ahora son roles y la tabla guarda el NOMBRE del
// rol, que se resuelve al dibujar con paleta[def.color].
const PALETA_NEON = {
  // Superficies, de arriba abajo del tablero.
  fondo: "#000",
  seto: "#0a2a1c", // la meta: seto continuo con los nenúfares por huecos
  agua: "#001a2a",
  aguaBrillo: "rgba(0,245,255,0.10)", // --cyan diluido: la ondulación
  asfalto: "#0a0a12",
  linea: "rgba(230,233,255,0.16)", // --ink diluido: la discontinua del carril
  tierra: "#0d1f18", // orillas y mediana: verde muy oscuro
  tierraBorde: "rgba(0,255,136,0.25)", // --green diluido
  // La rana.
  rana: "#00ff88", // --green, que es el acento de ranaria en GAMES
  ranaClaro: "#7dffc4",
  ranaOjo: "#001a10",
  ranaMuerta: "#ff006e", // --magenta: el destello al morir
  // La meta.
  nenufar: "rgba(0,255,136,0.35)",
  nenufarBorde: "#00ff88",
  mosca: "#f5ff00", // --yellow
  // El río.
  tronco: "#c98a4b", // el único color fuera de la paleta del tema
  troncoBorde: "#f0b070",
  tortuga: "#00f5ff", // --cyan
  tortugaCaparazon: "#005f6b",
  // La carretera. Los cinco vehículos, uno por carril, de la fila 6 a la 10; el
  // camión es el de la 6, más largo y más lento.
  camion: "#9aa0b5",
  coche1: "#00f5ff",
  coche2: "#f5ff00",
  coche3: "#ff5cae",
  coche4: "#ff006e",
  faro: "#f5ff00", // el destello del morro; era un préstamo de `mosca`
  // El HUD del propio motor.
  barraTiempo: "#f5ff00", // --yellow
  barraTiempoBajo: "#ff006e", // --magenta, por debajo de 5 s
} as const;

export type RolRanaria = keyof typeof PALETA_NEON;
export type PaletaRanaria = Readonly<Record<RolRanaria, string>>;

export const SKINS_RANARIA: FichaDeSkins<RolRanaria> = {
  roles: {
    fondo: { clase: "superficie" },
    seto: { clase: "superficie" },
    agua: { clase: "superficie" },
    // La ondulación y la discontinua son TEXTURA de su superficie, no elementos
    // sobre ella: se les exige que no destaquen (máximo 2:1), que es justo lo
    // que mantiene el agua y el asfalto leyéndose como fondo. Con la exigencia
    // de "decorado" ni siquiera el neón que el portal lleva meses enseñando
    // pasaría (1,26:1 y 1,46:1), y el neón no se toca.
    aguaBrillo: { clase: "superficie", sobre: "agua" },
    asfalto: { clase: "superficie" },
    linea: { clase: "superficie", sobre: "asfalto" },
    tierra: { clase: "superficie" },
    tierraBorde: { clase: "decorado", sobre: "tierra" },
    // La rana cruza las tres bandas; se mide sobre el agua, que es la más clara
    // de las tres y por tanto el peor caso.
    rana: { clase: "jugable", sobre: "agua" },
    // El reflejo se mide contra el fondo del canvas y no contra el cuerpo de la
    // rana: es un detalle de forma pintado ENCIMA del cuerpo, y exigirle
    // contraste contra él lo convertiría en otro color, no en un reflejo.
    ranaClaro: { clase: "decorado" },
    ranaOjo: { clase: "decorado", sobre: "ranaClaro" },
    ranaMuerta: { clase: "jugable", sobre: "agua" },
    nenufar: { clase: "decorado", sobre: "seto" },
    nenufarBorde: { clase: "jugable", sobre: "seto" },
    mosca: { clase: "jugable", sobre: "seto" },
    tronco: { clase: "jugable", sobre: "agua" },
    troncoBorde: { clase: "decorado", sobre: "tronco" },
    tortuga: { clase: "jugable", sobre: "agua" },
    tortugaCaparazon: { clase: "decorado", sobre: "tortuga" },
    camion: { clase: "jugable", sobre: "asfalto" },
    coche1: { clase: "jugable", sobre: "asfalto" },
    coche2: { clase: "jugable", sobre: "asfalto" },
    coche3: { clase: "jugable", sobre: "asfalto" },
    coche4: { clase: "jugable", sobre: "asfalto" },
    faro: { clase: "decorado", sobre: "asfalto" },
    // La barra de tiempo se pinta sobre la orilla de salida.
    barraTiempo: { clase: "jugable", sobre: "tierra" },
    barraTiempoBajo: { clase: "jugable", sobre: "tierra" },
  },
  // Los grupos se declaran POR BANDA y no globalmente: un tronco y un coche
  // nunca comparten franja, así que no compiten entre sí y exigirles un salto
  // de color solo empobrecería las dos paletas nuevas.
  //
  // El camión va en un grupo aparte con la rana, no con los turismos. Es el
  // único vehículo de dos celdas y se lee por tamaño —por eso el neón lo pinta
  // gris, "para que se lea como otra cosa"—, y ese gris (saturación 0,15) no se
  // separa del rosa del coche3 ni por luminancia (1,09) ni por tono. Lo que sí
  // hay que distinguir siempre es al camión de la rana, y eso se mantiene.
  grupos: [
    ["rana", "tronco", "tortuga"], // el río
    ["coche1", "coche2", "coche3", "coche4", "rana"], // la carretera
    ["camion", "rana"],
  ],
  paletas: {
    neon: PALETA_NEON,

    // Monitor de fósforo ámbar: un solo tono, familia #ffb000, y todo el trabajo
    // hecho por la luminancia. Los cinco vehículos y la rana forman una escalera
    // de seis peldaños —camión el más apagado, rana el más claro— con al menos
    // 1,35× de luminancia entre peldaños contiguos, que es lo que permite
    // distinguirlos sin un segundo tono.
    retro: {
      fondo: "#000",
      seto: "#150c00",
      agua: "#0a0500",
      aguaBrillo: "rgba(255,176,0,0.10)",
      asfalto: "#0d0900",
      linea: "rgba(255,224,168,0.16)",
      tierra: "#1a1000",
      tierraBorde: "rgba(255,176,0,0.35)",
      rana: "#ffe6b8",
      ranaClaro: "#fff6e4",
      ranaOjo: "#1a0e00",
      ranaMuerta: "#ff7a00",
      nenufar: "rgba(255,176,0,0.30)",
      nenufarBorde: "#ffb000",
      mosca: "#ffe08c",
      tronco: "#c07800",
      troncoBorde: "#ffb000",
      tortuga: "#e0a030",
      tortugaCaparazon: "#4a2e00",
      camion: "#8a5a00",
      coche1: "#ffbe4a",
      coche2: "#e59d10",
      coche3: "#c88400",
      coche4: "#a86c00",
      faro: "#fff2d0",
      barraTiempo: "#ffb000",
      barraTiempoBajo: "#ff7a00",
    },

    // El Frogger de recreativa (Konami/Sega, 1981): río azul, troncos marrones,
    // tortugas amarillentas, rana lima y las franjas seguras en violeta.
    //
    // Dos subidas obligadas respecto al original, las dos por contraste: el azul
    // del agua no puede ser el #0000ff puro (2,44:1 sobre el negro del canvas,
    // por encima del máximo de 2:1 que separa un fondo de un elemento) y el azul
    // del coche tampoco (2,44:1, por debajo del 3:1 de lo jugable).
    clasico: {
      fondo: "#000",
      seto: "#0a3a14",
      agua: "#0000d0",
      aguaBrillo: "rgba(80,140,255,0.18)",
      asfalto: "#101010",
      linea: "rgba(255,255,255,0.14)",
      tierra: "#2a1052",
      tierraBorde: "rgba(190,120,255,0.45)",
      rana: "#66e000",
      ranaClaro: "#ffffff",
      ranaOjo: "#001400",
      ranaMuerta: "#ff4d3d",
      nenufar: "rgba(0,200,90,0.30)",
      nenufarBorde: "#00c853",
      mosca: "#ffe95c",
      tronco: "#cd853f",
      troncoBorde: "#eeb87a",
      tortuga: "#e0c000",
      tortugaCaparazon: "#6b5400",
      camion: "#f2f2f2",
      coche1: "#4d9fff",
      coche2: "#ffd400",
      coche3: "#c04ae6",
      coche4: "#ff7a00",
      faro: "#fff3b0",
      barraTiempo: "#ffd400",
      barraTiempoBajo: "#ff4d3d",
    },
  },
};

// ── Tipos ─────────────────────────────────────────────────────────────────────

type TipoCarril = "vehiculo" | "tronco" | "tortuga";

interface CarrilDef {
  fila: number;
  tipo: TipoCarril;
  dir: 1 | -1; // 1 = hacia la derecha
  vel: number; // px/s en el nivel 1
  largo: number; // celdas que ocupa un móvil
  hueco: number; // celdas libres entre dos móviles
  // El NOMBRE del rol, no el color: un literal aquí sería inalcanzable para un
  // skin. Se resuelve en el punto de dibujo con paleta[def.color], como hace
  // BLOQUE BUSTER con sus bloques.
  color: RolRanaria;
}

interface Movil {
  x: number; // px, esquina izquierda; puede ser negativa
  ciclo: number; // ms dentro del ciclo de tortuga; 0 para los demás
}

interface Carril {
  def: CarrilDef;
  moviles: Movil[];
  paso: number; // px entre dos móviles
  pista: number; // largo virtual de la pista sobre la que se envuelven
}

interface Nenufar {
  col: number;
  ocupado: boolean;
  moscaMs: number; // ms que le quedan a la mosca; 0 = sin mosca
}

interface Caja {
  x: number;
  y: number;
  w: number;
  h: number;
}

// Dirección de un salto: una sola componente vale ±1, la otra 0.
interface Vec {
  dc: number;
  dr: number;
}

type EstadoTortuga = "emergida" | "parpadeo" | "sumergida";
type EstadoJuego = "playing" | "muriendo" | "paused" | "gameover";

// Los cinco caminos hasta matar(). No sale del motor: no es un GameOverReason, no
// llega a Supabase y no toca el contrato. Hoy solo decide si suena el golpe;
// mañana, qué otro efecto suena.
type MotivoMuerte = "atropello" | "ahogo" | "arrastre" | "seto" | "tiempo";

// ── Los carriles, como tabla de datos ─────────────────────────────────────────

// Los nueve carriles móviles son datos, no código: una sola clase de móvil sirve
// para coche, camión, tronco y tortuga. Retocar la dificultad es editar una fila.
//
// Las direcciones alternan en carriles contiguos, como el original: es lo que
// hace que el tráfico se lea de un vistazo y que esperar en un carril no sea
// siempre la jugada correcta.
const CARRILES: readonly CarrilDef[] = [
  // Río: lo que se mueve es lo único seguro.
  { fila: 1, tipo: "tronco", dir: 1, vel: 55, largo: 3, hueco: 3, color: "tronco" }, // prettier-ignore
  { fila: 2, tipo: "tortuga", dir: -1, vel: 70, largo: 2, hueco: 3, color: "tortuga" }, // prettier-ignore
  { fila: 3, tipo: "tronco", dir: 1, vel: 45, largo: 4, hueco: 4, color: "tronco" }, // prettier-ignore
  { fila: 4, tipo: "tortuga", dir: -1, vel: 85, largo: 3, hueco: 4, color: "tortuga" }, // prettier-ignore
  // Carretera: el suelo es seguro y lo que se mueve mata. El de la fila 6 es el
  // camión: más largo y más lento, y con su propio rol para que se lea como
  // "otra cosa" en las tres paletas.
  { fila: 6, tipo: "vehiculo", dir: 1, vel: 75, largo: 2, hueco: 5, color: "camion" }, // prettier-ignore
  { fila: 7, tipo: "vehiculo", dir: -1, vel: 160, largo: 1, hueco: 5, color: "coche1" }, // prettier-ignore
  { fila: 8, tipo: "vehiculo", dir: 1, vel: 110, largo: 1, hueco: 3, color: "coche2" }, // prettier-ignore
  { fila: 9, tipo: "vehiculo", dir: -1, vel: 130, largo: 1, hueco: 4, color: "coche3" }, // prettier-ignore
  { fila: 10, tipo: "vehiculo", dir: 1, vel: 90, largo: 1, hueco: 4, color: "coche4" }, // prettier-ignore
];

// ── Reglas puras ──────────────────────────────────────────────────────────────
//
// Todas reciben por argumento lo que necesitan y no leen nada del closure del
// motor: así se pueden razonar (y algún día probar) por separado.

function filaY(fila: number): number {
  return fila * CELL;
}

function xDeColumna(col: number): number {
  return col * CELL;
}

// Columna que contiene el centro de una caja de una celda de ancho.
function columnaDe(x: number): number {
  return Math.floor((x + CELL / 2) / CELL);
}

// Ajuste a la celda más cercana, acotado al tablero. Solo se aplica al aterrizar
// en tierra firme: en el río manda el arrastre.
function snapColumna(x: number): number {
  const col = Math.min(COLS - 1, Math.max(0, columnaDe(x)));
  return xDeColumna(col);
}

function esRio(fila: number): boolean {
  return fila >= FILA_RIO_INI && fila <= FILA_RIO_FIN;
}

function esCarretera(fila: number): boolean {
  return fila >= FILA_CARRETERA_INI && fila <= FILA_CARRETERA_FIN;
}

// Tierra firme: los tres sitios donde la rana se alinea con la rejilla.
function esTierraFirme(fila: number): boolean {
  return fila === FILA_META || fila === FILA_MEDIANA || fila === FILA_SALIDA;
}

function multiplicador(level: number): number {
  return Math.min(1 + VEL_STEP * (level - 1), VEL_MAX);
}

function tiempoDelNivel(level: number): number {
  return Math.max(TIEMPO_BASE - TIEMPO_DEC * (level - 1), TIEMPO_MIN);
}

function estadoTortuga(ciclo: number): EstadoTortuga {
  if (ciclo < TORTUGA_EMERGIDA_MS) return "emergida";
  if (ciclo < TORTUGA_EMERGIDA_MS + TORTUGA_PARPADEO_MS) return "parpadeo";
  return "sumergida";
}

// Convoy con envoltura sobre una pista virtual, en vez de un spawner aleatorio:
// un sorteo produce huecos imposibles cada varias partidas y hace que dos
// partidas no se puedan comparar. Como la pista mide al menos W + el largo de un
// móvil, la envoltura siempre ocurre fuera de la pantalla y no se ve aparecer
// nada de la nada.
function crearCarril(def: CarrilDef): Carril {
  const largoPx = def.largo * CELL;
  const paso = (def.largo + def.hueco) * CELL;
  const n = Math.ceil((W + largoPx) / paso);
  const pista = n * paso;

  const moviles: Movil[] = [];
  for (let i = 0; i < n; i++) {
    moviles.push({
      x: -largoPx + i * paso,
      // Las tortugas de un mismo carril no se hunden a la vez: si lo hicieran, el
      // carril alternaría entre muro y agujero y no habría decisión que tomar.
      ciclo: def.tipo === "tortuga" ? (i * TORTUGA_CICLO_MS) / n : 0,
    });
  }

  return { def, moviles, paso, pista };
}

function avanzarCarril(carril: Carril, dt: number, mult: number) {
  const { def } = carril;
  const min = -def.largo * CELL;
  const avance = def.dir * def.vel * mult * dt;
  const dtMs = dt * 1000;

  for (const movil of carril.moviles) {
    movil.x = ((movil.x + avance - min) % carril.pista + carril.pista) % carril.pista + min; // prettier-ignore
    if (def.tipo === "tortuga") {
      movil.ciclo = (movil.ciclo + dtMs) % TORTUGA_CICLO_MS;
    }
  }
}

function cajaMovil(carril: Carril, movil: Movil): Caja {
  return {
    x: movil.x,
    y: filaY(carril.def.fila),
    w: carril.def.largo * CELL,
    h: CELL,
  };
}

function solapa(a: Caja, b: Caja): boolean {
  return (
    a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
  );
}

// El móvil que sostiene a la rana, o null si debajo solo hay agua. Decide siempre
// por el CENTRO de la rana, nunca por su borde: con el borde, medio píxel sobre
// el tronco bastaría para salvarse y el arrastre se leería mal.
function plataformaBajo(carril: Carril, centroX: number): Movil | null {
  const largoPx = carril.def.largo * CELL;
  for (const movil of carril.moviles) {
    if (centroX < movil.x || centroX >= movil.x + largoPx) continue;
    if (
      carril.def.tipo === "tortuga" &&
      estadoTortuga(movil.ciclo) === "sumergida"
    ) {
      return null; // hay tortuga, pero está debajo del agua
    }
    return movil;
  }
  return null;
}

// ── Teclado ───────────────────────────────────────────────────────────────────

// Se usa e.code y no e.key porque es independiente de la distribución del
// teclado: en un AZERTY, KeyW sigue siendo la tecla de arriba a la izquierda.
const SALTOS: Record<string, Vec> = {
  ArrowUp: { dc: 0, dr: -1 },
  KeyW: { dc: 0, dr: -1 },
  ArrowDown: { dc: 0, dr: 1 },
  KeyS: { dc: 0, dr: 1 },
  ArrowLeft: { dc: -1, dr: 0 },
  KeyA: { dc: -1, dr: 0 },
  ArrowRight: { dc: 1, dr: 0 },
  KeyD: { dc: 1, dr: 0 },
};

// Solo las teclas del juego, y solo mientras el motor está enganchado: si no, las
// flechas dejarían de hacer scroll en el resto de la página.
const PREVENT_DEFAULT = new Set(Object.keys(SALTOS));

// Cuántos saltos se guardan por delante. Sin cola, dos pulsaciones dentro del
// mismo fotograma pierden una y el control se siente sordo; con cola infinita,
// machacar teclas encadena saltos que el jugador ya no controla y lo mete en la
// carretera.
const MAX_SALTOS_EN_COLA = 2;

// RANARIA no captura Space: el reproductor la usa para abrir la partida desde el
// overlay, y no capturarla es lo que evita tener que blindar el motor contra esa
// pulsación, como ya decidieron BLOQUE BUSTER y SERPENTINA.
class Input {
  private cola: Vec[] = [];
  private attached = false;

  private onKeyDown = (e: KeyboardEvent) => {
    const salto = SALTOS[e.code];
    if (!salto) return;
    e.preventDefault();

    if (this.cola.length >= MAX_SALTOS_EN_COLA) return;
    this.cola.push(salto);
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

  // Devuelve el siguiente salto pendiente, o null si no hay ninguno.
  siguienteSalto(): Vec | null {
    return this.cola.shift() ?? null;
  }

  // Al pausar, para no reanudar con un salto que el jugador encoló hace rato; y
  // al reanudar, porque los listeners siguen enganchados con el juego congelado y
  // lo tecleado durante la pausa se aplicaría de golpe al volver.
  clear() {
    this.cola = [];
  }
}

// ── Dibujo ────────────────────────────────────────────────────────────────────
//
// Las funciones de dibujo reciben el contexto y los datos por argumento; no
// capturan nada. Aquí no se pinta ni puntuación, ni nivel, ni vidas, ni GAME
// OVER, ni overlay de pausa: todo eso es HUD y lo pone la plataforma. La barra de
// tiempo sí, y es la única excepción: es estado del juego y no hay ningún
// callback del contrato capaz de transportarlo.

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

function drawEscenario(ctx: CanvasRenderingContext2D, paleta: PaletaRanaria) {
  ctx.fillStyle = paleta.fondo;
  ctx.fillRect(0, 0, W, H);

  // Río, con dos ondulaciones tenues por carril para que el agua no sea un
  // rectángulo plano.
  const filasRio = FILA_RIO_FIN - FILA_RIO_INI + 1;
  ctx.fillStyle = paleta.agua;
  ctx.fillRect(0, filaY(FILA_RIO_INI), W, filasRio * CELL);

  ctx.strokeStyle = paleta.aguaBrillo;
  ctx.lineWidth = 2;
  for (let fila = FILA_RIO_INI; fila <= FILA_RIO_FIN; fila++) {
    for (const off of [0.32, 0.68]) {
      const y = filaY(fila) + CELL * off;
      ctx.beginPath();
      ctx.moveTo(0, y);
      for (let x = 0; x < W; x += 40) {
        ctx.quadraticCurveTo(x + 10, y - 4, x + 20, y);
        ctx.quadraticCurveTo(x + 30, y + 4, x + 40, y);
      }
      ctx.stroke();
    }
  }

  // Carretera, con la discontinua entre carril y carril.
  const filasVia = FILA_CARRETERA_FIN - FILA_CARRETERA_INI + 1;
  ctx.fillStyle = paleta.asfalto;
  ctx.fillRect(0, filaY(FILA_CARRETERA_INI), W, filasVia * CELL);

  ctx.save();
  ctx.strokeStyle = paleta.linea;
  ctx.lineWidth = 2;
  ctx.setLineDash([18, 14]);
  ctx.beginPath();
  for (let fila = FILA_CARRETERA_INI + 1; fila <= FILA_CARRETERA_FIN; fila++) {
    ctx.moveTo(0, filaY(fila));
    ctx.lineTo(W, filaY(fila));
  }
  ctx.stroke();
  ctx.restore();

  // Tierra firme: mediana y orilla de salida, con su borde verde.
  ctx.fillStyle = paleta.tierra;
  ctx.fillRect(0, filaY(FILA_MEDIANA), W, CELL);
  ctx.fillRect(0, filaY(FILA_SALIDA), W, CELL);

  ctx.strokeStyle = paleta.tierraBorde;
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (const fila of [FILA_MEDIANA, FILA_SALIDA]) {
    ctx.moveTo(0, filaY(fila) + 1);
    ctx.lineTo(W, filaY(fila) + 1);
    ctx.moveTo(0, filaY(fila + 1) - 1);
    ctx.lineTo(W, filaY(fila + 1) - 1);
  }
  ctx.stroke();

  // Meta: seto continuo del que los nenúfares son los únicos huecos.
  ctx.fillStyle = paleta.seto;
  ctx.fillRect(0, filaY(FILA_META), W, CELL);
}

function drawNenufares(
  ctx: CanvasRenderingContext2D,
  paleta: PaletaRanaria,
  nenufares: readonly Nenufar[],
  ahora: number,
) {
  for (const nenufar of nenufares) {
    const cx = xDeColumna(nenufar.col) + CELL / 2;
    const cy = filaY(FILA_META) + CELL / 2;

    ctx.save();
    ctx.fillStyle = paleta.nenufar;
    ctx.strokeStyle = paleta.nenufarBorde;
    ctx.lineWidth = 2;
    ctx.shadowColor = paleta.nenufarBorde;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(cx, cy, CELL * 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // El nenúfar ocupado lleva dentro una ranita pequeña: es el marcador de
    // progreso del nivel, y se lee de un vistazo.
    if (nenufar.ocupado) {
      ctx.save();
      ctx.fillStyle = paleta.rana;
      ctx.beginPath();
      ctx.arc(cx, cy + 2, CELL * 0.18, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = paleta.ranaClaro;
      for (const lado of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(cx + lado * CELL * 0.11, cy - CELL * 0.1, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      continue;
    }

    // La mosca parpadea en sus últimos MOSCA_PARPADEO_MS, para que se vea que se
    // va y la decisión de ir a por ella tenga prisa.
    if (nenufar.moscaMs > 0) {
      const avisando = nenufar.moscaMs < MOSCA_PARPADEO_MS;
      if (avisando && Math.floor(ahora / 150) % 2 === 0) continue;

      ctx.save();
      ctx.fillStyle = paleta.mosca;
      ctx.shadowColor = paleta.mosca;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(cx, cy, CELL * 0.13, 0, Math.PI * 2);
      ctx.fill();
      // Dos alitas, para que no sea solo un punto amarillo.
      ctx.globalAlpha = 0.5;
      for (const lado of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(
          cx + lado * CELL * 0.16,
          cy - CELL * 0.06,
          CELL * 0.1,
          CELL * 0.05,
          lado * 0.6,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
      ctx.restore();
    }
  }
}

function drawMovil(
  ctx: CanvasRenderingContext2D,
  paleta: PaletaRanaria,
  carril: Carril,
  movil: Movil,
  ahora: number,
) {
  const { def } = carril;
  const x = movil.x;
  const y = filaY(def.fila);
  const w = def.largo * CELL;
  // La tabla guarda el nombre del rol; el color sale de la paleta del skin.
  const color = paleta[def.color];

  if (def.tipo === "tronco") {
    ctx.save();
    ctx.fillStyle = color;
    rectRedondeado(ctx, x + 2, y + 8, w - 4, CELL - 16, 8);
    ctx.strokeStyle = paleta.troncoBorde;
    ctx.lineWidth = 2;
    ctx.stroke();
    // Tres vetas, para que el tronco no sea una barra lisa.
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    for (let i = 1; i <= 3; i++) {
      const vx = x + (w * i) / 4;
      ctx.moveTo(vx, y + 13);
      ctx.lineTo(vx, y + CELL - 13);
    }
    ctx.stroke();
    ctx.restore();
    return;
  }

  if (def.tipo === "tortuga") {
    const estado = estadoTortuga(movil.ciclo);
    // Sumergida no se dibuja: hay que ver el agua donde antes había suelo.
    if (estado === "sumergida") return;

    ctx.save();
    if (estado === "parpadeo") {
      ctx.globalAlpha = Math.floor(ahora / 150) % 2 === 0 ? 0.35 : 0.85;
    }
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
    for (let i = 0; i < def.largo; i++) {
      const cx = x + i * CELL + CELL / 2;
      const cy = y + CELL / 2;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(cx, cy, CELL * 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = paleta.tortugaCaparazon;
      ctx.beginPath();
      ctx.arc(cx, cy, CELL * 0.26, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    return;
  }

  // Vehículo. El morro va en el sentido de la marcha, así que los faros cambian
  // de lado con dir.
  ctx.save();
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 10;
  rectRedondeado(ctx, x + 4, y + 7, w - 8, CELL - 14, 7);
  ctx.restore();

  // Las ventanillas son el hueco oscuro del vehículo, y por eso reutilizan el
  // rol del fondo en vez de tener uno propio: un cristal más claro que la
  // carrocería dejaría de leerse como hueco en cualquiera de las tres paletas.
  ctx.save();
  ctx.fillStyle = paleta.fondo;
  ctx.globalAlpha = 0.55;
  const ventanillas = Math.max(1, def.largo);
  for (let i = 0; i < ventanillas; i++) {
    ctx.fillRect(x + 12 + i * CELL, y + 14, CELL - 24, CELL - 28);
  }
  ctx.restore();

  ctx.fillStyle = paleta.faro;
  const faroX = def.dir === 1 ? x + w - 9 : x + 4;
  ctx.fillRect(faroX, y + 12, 5, 5);
  ctx.fillRect(faroX, y + CELL - 17, 5, 5);
}

function drawRana(
  ctx: CanvasRenderingContext2D,
  paleta: PaletaRanaria,
  x: number,
  y: number,
  mirando: Vec,
  saltando: number, // 0–1 dentro del salto; 0 = quieta
  muriendo: boolean,
  ahora: number,
) {
  // Durante la muerte parpadea con el color de alarma de la paleta (magenta en
  // neón): el destello es lo que deja ver qué te mató antes de reaparecer.
  if (muriendo && Math.floor(ahora / 90) % 2 === 0) return;

  const cx = x + CELL / 2;
  const cy = y + CELL / 2;
  const cuerpo = muriendo ? paleta.ranaMuerta : paleta.rana;
  const claro = muriendo ? paleta.ranaMuerta : paleta.ranaClaro;

  // Se estira al despegar y se recoge al caer, conservando el volumen: es lo que
  // hace legible el salto con una interpolación de solo 90 ms.
  const estiron = Math.sin(Math.PI * saltando) * 0.35;
  const escalaLargo = 1 + estiron;
  const escalaAncho = 1 - estiron * 0.5;
  const alargaEnY = mirando.dr !== 0;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(
    alargaEnY ? escalaAncho : escalaLargo,
    alargaEnY ? escalaLargo : escalaAncho,
  );
  ctx.shadowColor = cuerpo;
  ctx.shadowBlur = 12;

  // Patas traseras, en el lado contrario al que mira.
  ctx.fillStyle = cuerpo;
  for (const lado of [-1, 1]) {
    const px = mirando.dc !== 0 ? -mirando.dc * 13 : lado * 13;
    const py = mirando.dr !== 0 ? -mirando.dr * 13 : lado * 13;
    rectRedondeado(ctx, px - 6, py - 6, 12, 12, 4);
  }

  const cuerpoLado = CELL - 18;
  rectRedondeado(
    ctx,
    -cuerpoLado / 2,
    -cuerpoLado / 2,
    cuerpoLado,
    cuerpoLado,
    9,
  );
  ctx.restore();

  // Los ojos van hacia donde mira la rana: es lo que permite saber en qué
  // dirección saltó la última vez sin mirar el tablero entero.
  const perp = { dc: -mirando.dr, dr: mirando.dc };
  ctx.save();
  for (const lado of [1, -1]) {
    const ox = cx + mirando.dc * 9 + perp.dc * 8 * lado;
    const oy = cy + mirando.dr * 9 + perp.dr * 8 * lado;
    ctx.fillStyle = claro;
    ctx.beginPath();
    ctx.arc(ox, oy, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = paleta.ranaOjo;
    ctx.beginPath();
    ctx.arc(ox + mirando.dc * 1.5, oy + mirando.dr * 1.5, 2.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawBarraTiempo(
  ctx: CanvasRenderingContext2D,
  paleta: PaletaRanaria,
  tiempoMs: number,
  tiempoTotalMs: number,
) {
  const frac = Math.max(0, Math.min(1, tiempoMs / tiempoTotalMs));
  const bajo = tiempoMs <= 5000;
  const color = bajo ? paleta.barraTiempoBajo : paleta.barraTiempo;
  ctx.save();
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 8;
  ctx.fillRect(0, H - 6, W * frac, 6);
  ctx.restore();
}

// ── Motor ─────────────────────────────────────────────────────────────────────

export const createFroggerGame: GameFactory = (
  canvas,
  callbacks,
  skin = "neon",
) => {
  const context2d = canvas.getContext("2d");
  if (!context2d) throw new Error("RANARIA necesita un canvas 2D");
  // La paleta se resuelve una vez y baja por argumento a cada función de dibujo:
  // nada de esto puede vivir a nivel de módulo (invariante nº 1 del contrato).
  const paleta = paletaDe(SKINS_RANARIA, skin);
  // Con tipo explícito: el estrechamiento del guard no llega hasta draw(), que es
  // un closure.
  const ctx: CanvasRenderingContext2D = context2d;

  const input = new Input();

  // Se crean una vez por montaje, no por partida: "JUGAR DE NUEVO" fabricaría
  // elementos nuevos cada vez y el primer salto de cada partida llegaría tarde
  // esperando la descarga.
  const sfxSalto = crearSfx(SFX_SALTO_SRC, SFX_SALTO_VOL);
  const sfxChoque = crearSfx(SFX_CHOQUE_SRC, SFX_CHOQUE_VOL);

  // Todo el estado de partida vive aquí dentro. A nivel de módulo sobreviviría
  // entre montajes y volver a la pantalla arrastraría la partida anterior.
  let ranaX = 0; // px, esquina izquierda: continua, porque los troncos arrastran
  let ranaFila = FILA_SALIDA;
  let mirando: Vec = { dc: 0, dr: -1 };
  let saltoDesdeX: number | null = null; // origen de la interpolación; null = quieta
  let saltoDesdeFila = FILA_SALIDA;
  let saltoMs = 0;
  let carriles: Carril[] = [];
  let nenufares: Nenufar[] = [];
  let filaMinAlcanzada = FILA_SALIDA; // la fila más alta de este intento
  let tiempoMs = 0;
  let tiempoTotalMs = 0;
  let moscaAccum = 0;
  let muerteMs = 0;
  let score = 0;
  let lives = VIDAS_INICIALES;
  let level = 1;
  let state: EstadoJuego = "playing";
  let estadoPrevio: EstadoJuego = "playing"; // el de antes de pausar
  let rafId: number | null = null;
  let lastTime: number | null = null;
  // Tiempo jugado, no transcurrido: se acumula con el dt del bucle, que deja de
  // correr al pausar. Las pausas quedan fuera sin lógica extra.
  let elapsedMs = 0;
  let reloj = 0; // ms desde el arranque, solo para las animaciones de dibujo

  // Los callbacks provocan renders de React: solo se emite cuando el valor cambia
  // de verdad.
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

  // Único camino hacia el fin de partida, y por tanto el único sitio donde vive la
  // guardia: sin ella, rendirse tras la última muerte emitiría el resumen dos
  // veces y registraría la partida por duplicado en Supabase.
  function finish(reason: GameOverReason) {
    if (state === "gameover") return;
    state = "gameover";
    stopLoop();
    callbacks.onGameOver(summary(reason));
  }

  // Un intento: la rana vuelve al centro de la orilla con el reloj lleno. Se llama
  // al empezar, al reaparecer y al ocupar un nenúfar.
  function nuevoIntento() {
    ranaX = xDeColumna(Math.floor(COLS / 2));
    ranaFila = FILA_SALIDA;
    mirando = { dc: 0, dr: -1 };
    saltoDesdeX = null;
    saltoMs = 0;
    filaMinAlcanzada = FILA_SALIDA;
    tiempoTotalMs = tiempoDelNivel(level) * 1000;
    tiempoMs = tiempoTotalMs;
    input.clear();
  }

  function initGame() {
    carriles = CARRILES.map(crearCarril);
    nenufares = COLS_NENUFAR.map((col) => ({
      col,
      ocupado: false,
      moscaMs: 0,
    }));

    score = 0;
    lives = VIDAS_INICIALES;
    level = 1;
    state = "playing";
    estadoPrevio = "playing";
    moscaAccum = 0;
    muerteMs = 0;
    elapsedMs = 0;
    reloj = 0;
    lastTime = null;
    nuevoIntento();

    // Emitidos directamente, sin pasar por los setters: al reiniciar los valores
    // coinciden con los de la partida anterior y el HUD se quedaría enseñando la
    // puntuación vieja.
    callbacks.onScore(score);
    callbacks.onLives(lives);
    callbacks.onLevel(level);
  }

  // El bonus por avanzar se cobra una sola vez por fila y por intento: cobrarlo en
  // cada entrada convertiría saltar arriba y abajo en la mediana en una máquina de
  // puntos infinita.
  function cobrarAvance() {
    if (ranaFila >= filaMinAlcanzada) return;
    const filas = filaMinAlcanzada - ranaFila;
    filaMinAlcanzada = ranaFila;
    setScore(score + PTS_AVANCE * level * filas);
  }

  function subirNivel() {
    // El orden importa: el bonus se cobra al nivel que se acaba de completar.
    setScore(score + PTS_NIVEL * level);
    setLevel(level + 1);
    for (const nenufar of nenufares) {
      nenufar.ocupado = false;
      nenufar.moscaMs = 0;
    }
    moscaAccum = 0;
    nuevoIntento();
  }

  // El motivo solo se usa para el sonido, pero pasa por aquí y no por el punto de
  // llamada: con un segundo efecto de muerte, el audio quedaría repartido por
  // update() en vez de en un solo sitio.
  function matar(motivo: MotivoMuerte) {
    if (state !== "playing") return;
    // El golpe dura 1,25 s y el destello 0,7 s: en la última vida sigue sonando
    // cuando se abre el modal de fin, y es a propósito.
    if (motivo === "atropello") sfxChoque.play();
    state = "muriendo";
    muerteMs = MUERTE_MS;
    setLives(lives - 1);
    input.clear();
  }

  // Se llama al agotarse el destello de la muerte. Con vidas, otro intento; sin
  // ellas, se acabó. El fin llega tras el destello a propósito: así el jugador ve
  // qué lo mató antes de que se abra el modal.
  function finDelDestello() {
    if (lives <= 0) {
      finish("game_over");
      return;
    }
    state = "playing";
    nuevoIntento();
  }

  function saltar(salto: Vec) {
    const filaDestino = ranaFila + salto.dr;
    const xDestino = ranaX + salto.dc * CELL;

    mirando = salto;

    // Los saltos que sacarían a la rana del canvas se ignoran, pero el giro de la
    // cabeza sí se aplica: da respuesta a la tecla sin mover nada.
    if (filaDestino < 0 || filaDestino >= ROWS) return;
    if (xDestino < 0 || xDestino > W - CELL) return;

    // Suena aquí, pasadas las dos guardias: un salto que se ignora contra el
    // borde no mueve nada, y sonar sin moverse se percibe como un fallo.
    sfxSalto.play();

    saltoDesdeX = ranaX;
    saltoDesdeFila = ranaFila;
    saltoMs = 0;

    ranaFila = filaDestino;
    ranaX = xDestino;

    // Al aterrizar en tierra firme la rana se alinea con la columna; en el río no,
    // porque ahí manda el arrastre y quedar a medio carril es la gracia del juego.
    if (esTierraFirme(ranaFila)) ranaX = snapColumna(ranaX);

    cobrarAvance();
  }

  function carrilDe(fila: number): Carril | undefined {
    return carriles.find((carril) => carril.def.fila === fila);
  }

  function llegarAMeta() {
    const centroX = ranaX + CELL / 2;
    const nenufar = nenufares.find((n) => n.col === columnaDe(centroX));

    // Contra el seto, o contra un nenúfar ya ocupado: las dos matan. Es lo que
    // obliga a apuntar el último salto.
    if (!nenufar || nenufar.ocupado) {
      matar("seto");
      return;
    }

    const segundos = Math.floor(tiempoMs / 1000);
    let ganado = PTS_NENUFAR * level + PTS_SEGUNDO * level * segundos;
    if (nenufar.moscaMs > 0) ganado += PTS_MOSCA * level;
    setScore(score + ganado);

    nenufar.ocupado = true;
    nenufar.moscaMs = 0;

    if (nenufares.every((n) => n.ocupado)) subirNivel();
    else nuevoIntento();
  }

  function actualizarMosca(dtMs: number) {
    for (const nenufar of nenufares) {
      if (nenufar.moscaMs > 0) nenufar.moscaMs = Math.max(0, nenufar.moscaMs - dtMs); // prettier-ignore
    }

    moscaAccum += dtMs;
    if (moscaAccum < MOSCA_INTERVALO_MS) return;
    moscaAccum = 0;
    if (Math.random() >= MOSCA_PROB) return;

    const libres = nenufares.filter((n) => !n.ocupado && n.moscaMs === 0);
    if (libres.length === 0) return;
    libres[Math.floor(Math.random() * libres.length)].moscaMs = MOSCA_MS;
  }

  function update(dt: number) {
    if (state !== "playing" && state !== "muriendo") return;

    const dtMs = dt * 1000;
    reloj += dtMs;
    // El tiempo del destello también cuenta como tiempo jugado: la partida sigue
    // en marcha.
    elapsedMs += dtMs;

    const mult = multiplicador(level);
    for (const carril of carriles) avanzarCarril(carril, dt, mult);

    if (saltoDesdeX !== null) {
      saltoMs += dtMs;
      if (saltoMs >= SALTO_MS) saltoDesdeX = null;
    }

    if (state === "muriendo") {
      muerteMs -= dtMs;
      if (muerteMs <= 0) finDelDestello();
      return;
    }

    tiempoMs -= dtMs;
    if (tiempoMs <= 0) {
      tiempoMs = 0;
      matar("tiempo");
      return;
    }

    // Como mucho un salto por fotograma, y solo con la interpolación anterior
    // terminada: encadenar dos saltos sin dibujar entre medias movería la rana dos
    // celdas de golpe y la carretera se volvería ilegible.
    if (saltoDesdeX === null) {
      const salto = input.siguienteSalto();
      if (salto) {
        saltar(salto);
        if (ranaFila === FILA_META) {
          llegarAMeta();
          return;
        }
      }
    }

    const carril = carrilDe(ranaFila);

    if (esRio(ranaFila)) {
      const plataforma = carril
        ? plataformaBajo(carril, ranaX + CELL / 2)
        : null;
      if (!plataforma || !carril) {
        matar("ahogo"); // ni tronco, ni tortuga emergida
        return;
      }
      ranaX += carril.def.dir * carril.def.vel * mult * dt;
      const centroX = ranaX + CELL / 2;
      if (centroX < 0 || centroX > W) {
        matar("arrastre"); // arrastrada fuera del canvas
        return;
      }
    } else if (esCarretera(ranaFila) && carril) {
      const caja: Caja = {
        x: ranaX + RANA_INSET,
        y: filaY(ranaFila) + RANA_INSET,
        w: CELL - RANA_INSET * 2,
        h: CELL - RANA_INSET * 2,
      };
      for (const movil of carril.moviles) {
        if (solapa(caja, cajaMovil(carril, movil))) {
          matar("atropello");
          return;
        }
      }
    }

    actualizarMosca(dtMs);
  }

  function draw() {
    drawEscenario(ctx, paleta);
    drawNenufares(ctx, paleta, nenufares, reloj);

    for (const carril of carriles) {
      for (const movil of carril.moviles)
        drawMovil(ctx, paleta, carril, movil, reloj);
    }

    // La posición dibujada interpola el salto, pero la lógica ya está resuelta en
    // la celda de destino: lo que se ve es un adorno de 90 ms.
    const t = saltoDesdeX === null ? 1 : Math.min(saltoMs / SALTO_MS, 1);
    const xDibujo = saltoDesdeX === null ? ranaX : saltoDesdeX + (ranaX - saltoDesdeX) * t; // prettier-ignore
    const filaDibujo =
      saltoDesdeX === null
        ? ranaFila
        : saltoDesdeFila + (ranaFila - saltoDesdeFila) * t;

    drawRana(
      ctx,
      paleta,
      xDibujo,
      filaY(filaDibujo),
      mirando,
      saltoDesdeX === null ? 0 : t,
      state === "muriendo",
      reloj,
    );

    drawBarraTiempo(ctx, paleta, tiempoMs, tiempoTotalMs);
  }

  function loop(ts: number) {
    // dt capado: sin el tope, volver de otra pestaña adelantaría el tráfico medio
    // carril de golpe y mataría a la rana sin que se viera nada.
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
      if (state !== "playing" && state !== "muriendo") return;
      estadoPrevio = state;
      state = "paused";
      input.clear();
      // Un golpe sonando bajo el overlay de PAUSA delata que algo del motor sigue
      // en marcha, justo lo contrario de lo que la pausa promete. Reanudar no lo
      // retoma: un efecto a medias no se recupera.
      sfxSalto.silenciar();
      sfxChoque.silenciar();
      stopLoop();
      draw(); // deja el frame congelado bajo el overlay de la plataforma
    },

    resume() {
      if (state !== "paused") return;
      // También aquí, y no solo al pausar: los listeners siguen enganchados
      // durante la pausa, así que lo tecleado con el juego congelado se aplicaría
      // de golpe al volver.
      input.clear();
      state = estadoPrevio;
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
      // Como los listeners: sin esto, entrar y salir del juego deja un elemento
      // de audio vivo por montaje.
      sfxSalto.destroy();
      sfxChoque.destroy();
    },
  };
};
