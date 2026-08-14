# RANARIA — motor y modelo de datos

> Ver `01-spec.md` para el alcance y `03-plan.md` para el orden de implementación.

**No hace falta ninguna migración de Supabase.** `game_sessions` guarda `game_id` como texto
y la vista `game_leaderboard` agrupa por él; con el motor registrado, las partidas de
`ranaria` se graban y aparecen en el Salón sin cambios de esquema.

Tampoco se toca `app/lib/data.ts`: la entrada `ranaria` ya existe, con su portada
`cover-rana` en `app/globals.css`.

---

## Archivos que aparecen o cambian

| Archivo                       | Qué                                            |
| ----------------------------- | ---------------------------------------------- |
| `app/lib/games/frogger.ts`    | **Nuevo.** El motor                            |
| `app/lib/games/registry.ts`   | Dos entradas: `GAME_ENGINES` y `GAME_CONTROLS` |
| `specs/game-jam/ranaria/*.md` | Esta spec, seis archivos                       |

Nada más. Ni `public/`, ni `supabase/migrations/`, ni `app/globals.css`, ni `app/lib/data.ts`,
ni el reproductor, ni `types.ts`.

---

## El tablero

16 columnas × 12 filas de 50 px llenan 800×600 exacto, sin banda negra ni centrado. Las filas
se numeran desde arriba:

| Fila(s) | Qué es            | Mortal si…                                             |
| ------- | ----------------- | ------------------------------------------------------ |
| 0       | Meta, 5 nenúfares | aterrizas fuera de un nenúfar, o en uno ya ocupado     |
| 1–4     | Río, 4 carriles   | no estás encima de un tronco o de una tortuga emergida |
| 5       | Mediana           | nunca: es tierra firme                                 |
| 6–10    | Carretera         | te toca un vehículo                                    |
| 11      | Orilla de salida  | nunca: es tierra firme, y es donde reapareces          |

Los cinco nenúfares ocupan las columnas **1, 4, 7, 10 y 13**, con dos columnas de seto entre
cada dos. Los setos son tan mortales como el agua: es lo que obliga a alinear el último salto
en vez de llegar a la fila de arriba de cualquier manera.

---

## Constantes del motor

```ts
export const W = 800; // resolución lógica del canvas; el escalado es CSS
export const H = 600;

const CELL = 50;
const COLS = 16; // 16 × 50 = 800, exacto
const ROWS = 12; // 12 × 50 = 600, exacto

// Filas, de arriba a abajo
const FILA_META = 0;
const FILA_MEDIANA = 5;
const FILA_SALIDA = 11;
const COLS_NENUFAR = [1, 4, 7, 10, 13] as const;

// Salto: la celda de destino se resuelve al instante y la interpolación es solo
// visual (ver Decisiones). SALTO_MS corto a propósito: con un salto largo, la
// rana "debe" celdas al jugador cuando el tráfico va rápido.
const SALTO_MS = 90;

// La caja de colisión de la rana es menor que su celda: sin este margen, rozar
// el morro de un coche que va por el carril de al lado ya mata.
const RANA_INSET = 8;

// Temporizador del intento, en segundos. Se acorta con el nivel y tiene suelo.
const TIEMPO_BASE = 30;
const TIEMPO_DEC = 2; // menos por nivel
const TIEMPO_MIN = 18; // suelo, alcanzado en el nivel 7

// Velocidad de todos los carriles: multiplicador por nivel, con tope.
const VEL_STEP = 0.12;
const VEL_MAX = 2.2; // el tope se alcanza en el nivel 11

const VIDAS_INICIALES = 3;

// Animación de muerte: la rana destella y luego reaparece en la orilla. Es lo
// que impide morir dos veces seguidas por el mismo coche.
const MUERTE_MS = 700;

// Ciclo de las tortugas: emergida → parpadeo de aviso → sumergida.
const TORTUGA_EMERGIDA_MS = 4000;
const TORTUGA_PARPADEO_MS = 1000; // sigue siendo plataforma, pero ya avisa
const TORTUGA_SUMERGIDA_MS = 1500;
const TORTUGA_CICLO_MS = 6500; // suma de los tres

// Mosca de bonus: cada MOSCA_INTERVALO_MS se sortea, con esta probabilidad, un
// nenúfar libre al azar. Caduca sola.
const MOSCA_INTERVALO_MS = 9000;
const MOSCA_PROB = 0.35;
const MOSCA_MS = 6000;

// Puntuación (la justificación numérica está más abajo)
const PTS_AVANCE = 25; // × nivel, por cada fila nueva del intento
const PTS_NENUFAR = 500; // × nivel
const PTS_SEGUNDO = 20; // × nivel × segundos enteros restantes
const PTS_NIVEL = 2000; // × nivel, al llenar los cinco nenúfares
const PTS_MOSCA = 800; // × nivel
```

---

## Colores

```ts
// Son los mismos valores que los tokens de :root en app/globals.css. Si el tema
// cambia, hay que tocar los dos sitios.
const COLORS = {
  fondo: "#000",
  tierra: "#0d1f18", // orillas y mediana: verde muy oscuro
  tierraBorde: "rgba(0,255,136,0.25)", // --green diluido
  asfalto: "#0a0a12",
  linea: "rgba(230,233,255,0.16)", // --ink diluido: la discontinua del carril
  agua: "#001a2a",
  aguaBrillo: "rgba(0,245,255,0.10)", // --cyan diluido: la ondulación
  rana: "#00ff88", // --green, que es el acento de ranaria en GAMES
  ranaClaro: "#7dffc4",
  ranaOjo: "#001a10",
  ranaMuerta: "#ff006e", // --magenta: el destello al morir
  nenufar: "rgba(0,255,136,0.35)",
  nenufarBorde: "#00ff88",
  seto: "#0a2a1c",
  tortuga: "#00f5ff", // --cyan
  tortugaCaparazon: "#005f6b",
  mosca: "#f5ff00", // --yellow
  barraTiempo: "#f5ff00", // --yellow
  barraTiempoBajo: "#ff006e", // --magenta, por debajo de 5 s
  // Vehículos: cuatro acentos del tema más un gris metálico para el camión
  vehiculos: ["#ff006e", "#f5ff00", "#00f5ff", "#ff5cae", "#9aa0b5"],
  // Los troncos son el único color fuera de la paleta (ver Decisiones)
  tronco: "#c98a4b",
  troncoBorde: "#f0b070",
} as const;
```

---

## Los carriles, como tabla de datos

Los nueve carriles móviles son **datos, no código**: una tabla de definiciones y una sola
clase `Movil` que sirve para coche, camión, tronco y tortuga. Es lo que mantiene el motor
dentro del presupuesto de líneas.

```ts
type TipoCarril = "vehiculo" | "tronco" | "tortuga";

interface CarrilDef {
  fila: number;
  tipo: TipoCarril;
  dir: 1 | -1; // 1 = hacia la derecha
  vel: number; // px/s en el nivel 1
  largo: number; // celdas que ocupa un móvil
  hueco: number; // celdas libres entre dos móviles
  color: string;
}
```

| Fila | Tipo     | Dir | Vel (px/s) | Largo | Hueco | Color         |
| ---- | -------- | --- | ---------- | ----- | ----- | ------------- |
| 1    | tronco   | →   | 55         | 3     | 3     | madera        |
| 2    | tortuga  | ←   | 70         | 2     | 3     | `--cyan`      |
| 3    | tronco   | →   | 45         | 4     | 4     | madera        |
| 4    | tortuga  | ←   | 85         | 3     | 4     | `--cyan`      |
| 6    | vehículo | →   | 75         | 2     | 5     | gris (camión) |
| 7    | vehículo | ←   | 160        | 1     | 5     | `--cyan`      |
| 8    | vehículo | →   | 110        | 1     | 3     | `--yellow`    |
| 9    | vehículo | ←   | 130        | 1     | 4     | rosa claro    |
| 10   | vehículo | →   | 90         | 1     | 4     | `--magenta`   |

Direcciones alternas en carriles contiguos, como el original: es lo que hace que el tráfico
se lea de un vistazo y que esperar en un carril no sea siempre la jugada correcta.

**Convoy con envoltura.** Cada carril se inicializa con `n = ceil((W + largo × CELL) / paso)`
móviles, donde `paso = (largo + hueco) × CELL`, repartidos cada `paso` píxeles sobre una
pista virtual de largo `pista = n × paso`. Cada frame el carril avanza `dir × vel × mult × dt`
y la posición de cada móvil se envuelve dentro de `[-largo × CELL, pista - largo × CELL)`.
Como `pista ≥ W + largo × CELL`, la envoltura siempre ocurre fuera de la pantalla y no se ve
aparecer nada de la nada. El multiplicador es `mult = min(1 + VEL_STEP × (nivel - 1), VEL_MAX)`.

Las tortugas de un mismo carril **no** se sumergen a la vez: cada móvil tortuga arranca con
un desfase `(i × TORTUGA_CICLO_MS) / n` dentro del ciclo. Si se hundieran todas a la vez el
carril sería un muro con ventanas, no un río.

---

## Tipos y estado interno

```ts
interface Movil {
  x: number; // px, esquina izquierda; puede ser negativa
  ciclo: number; // ms dentro del ciclo de tortuga; 0 para los demás
}

interface Carril {
  def: CarrilDef;
  moviles: Movil[];
  paso: number; // px entre dos móviles
  pista: number; // largo virtual de la pista
}

interface Nenufar {
  col: number;
  ocupado: boolean;
  moscaMs: number; // ms que le quedan a la mosca; 0 = sin mosca
}

type EstadoTortuga = "emergida" | "parpadeo" | "sumergida";
type EstadoJuego = "playing" | "muriendo" | "paused" | "gameover";
```

Todo el estado de partida vive dentro del closure de `createFroggerGame`, nada a nivel de
módulo:

```ts
let ranaX: number; // px, esquina izquierda: continua, porque los troncos arrastran
let ranaFila: number;
let saltoDesdeX: number | null; // origen de la interpolación visual; null = quieta
let saltoDesdeFila: number;
let saltoMs: number; // ms transcurridos del salto en curso
let carriles: Carril[];
let nenufares: Nenufar[];
let filaMinAlcanzada: number; // la fila más alta (menor índice) de este intento
let tiempoMs: number; // ms que le quedan al intento
let moscaAccum: number; // ms hacia el próximo sorteo de mosca
let muerteMs: number; // cuenta atrás de la animación de muerte
let score: number;
let lives: number;
let level: number;
let state: EstadoJuego;
let rafId: number | null;
let lastTime: number | null;
let elapsedMs: number; // tiempo jugado, sin pausas
```

No hay estado `"win"`: la partida no termina por completarla (ver `05-decisiones.md`).

---

## Reglas, en una pasada

Un frame de `update(dt)` con `state === "playing"`:

1. `elapsedMs += dt * 1000` y `tiempoMs -= dt * 1000`. Si llega a 0 → muerte por tiempo.
2. Avanzar los nueve carriles y los ciclos de tortuga.
3. Consumir **como mucho un salto** de la cola de teclado (ver `03-plan.md`, paso 3).
4. Si la rana está en una fila de río: buscar la plataforma bajo su centro. Si hay tronco o
   tortuga no sumergida, `ranaX += dir × vel × mult × dt`; si no, muerte por ahogo. Si tras
   el arrastre el centro de la rana sale del canvas, muerte por arrastre.
5. Si la rana está en una fila de carretera: comprobar solape de cajas (con `RANA_INSET`)
   contra los móviles del carril. Si toca, muerte por atropello.
6. Si la rana está en la fila de meta: buscar el nenúfar cuya celda contiene su centro. Si no
   hay, o está ocupado, muerte. Si está libre, se ocupa, se cobran los puntos y la rana vuelve
   a la orilla con el temporizador lleno. Con los cinco ocupados, sube el nivel.
7. Actualizar la mosca (caducidad y sorteo).

Con `state === "muriendo"` solo corren los carriles y la cuenta atrás de `MUERTE_MS`; al
llegar a 0, la rana reaparece en el centro de la fila de salida con el temporizador lleno, o
se acaba la partida si ya no quedan vidas. El tiempo de la animación **sí** cuenta como
tiempo jugado: la partida sigue en marcha.

**Aterrizajes alineados.** Al caer en tierra firme (filas 0, 5 y 11) la rana se ajusta a la
columna más cercana. En el río no: ahí manda el arrastre y quedar a medio carril es la gracia
del juego. Sin ese ajuste, un salto desde un tronco a la mediana deja a la rana montada entre
dos carriles de coches y la carretera se vuelve ilegible.

---

## Lo que emite

| Callback     | Cuándo                                                                                        |
| ------------ | --------------------------------------------------------------------------------------------- |
| `onScore`    | Al alcanzar una fila nueva del intento, al ocupar un nenúfar, al comer mosca y al subir nivel |
| `onLives`    | `3` al arrancar y en cada muerte (`3 → 2 → 1 → 0`)                                            |
| `onLevel`    | Al ocupar el quinto nenúfar y pasar al nivel siguiente                                        |
| `onGameOver` | Al perder la última vida (`"game_over"`), o al rendirse con `end()` (`"surrender"`)           |

Los tres primeros solo se emiten **si el valor cambia**, salvo en `initGame()`, donde se
fuerzan para que "JUGAR DE NUEVO" no deje el HUD con los números de la partida anterior.

---

## Calibración de la puntuación

| Acción                                               | Puntos                            |
| ---------------------------------------------------- | --------------------------------- |
| Alcanzar una fila más alta que nunca en este intento | `25 × nivel`                      |
| Ocupar un nenúfar                                    | `500 × nivel`                     |
| Bonus de tiempo al ocupar un nenúfar                 | `20 × nivel × segundos restantes` |
| Comer la mosca de un nenúfar                         | `800 × nivel`                     |
| Llenar los cinco nenúfares                           | `2.000 × nivel`                   |

El bonus por fila se cobra **una sola vez por fila y por intento**, contra
`filaMinAlcanzada`: sin eso, saltar arriba y abajo en la mediana sería una máquina de puntos
infinita y el ranking mediría paciencia en vez de habilidad.

Cuentas de un nivel completo (cinco cruces):

- Avance: 11 filas × 25 = **275 × nivel** por cruce → 1.375 × nivel.
- Nenúfares: 5 × 500 = **2.500 × nivel**.
- Bonus de tiempo: un cruce decente deja unos 18 s → 360 × nivel por cruce → **1.800 × nivel**.
- Bonus de nivel: **2.000 × nivel**.

Total ≈ **7.675 × nivel**, y una partida que llega al nivel _N_ acumula
`7.675 × N(N+1)/2`:

| Nivel alcanzado | Puntuación aproximada |
| --------------- | --------------------- |
| 2               | 23.000                |
| 3               | 46.000                |
| 4               | 77.000                |
| 5               | 115.000               |

Una partida buena termina entre 10.000 y 150.000, que es la banda pedida y la que ocupan
BLOQUE BUSTER (28.450 de `best` mock) y SERPENTINA (7.820), por debajo de CAÍDA (184.220).
El `best` mock de `ranaria` es 18.900, que en esta escala es "llegar al nivel 2 con soltura":
una cifra creíble que no hay que tocar. La mosca añade como mucho un 10 % y no cambia el
orden de magnitud.
