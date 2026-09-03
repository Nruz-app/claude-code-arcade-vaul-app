# SPEC 09 — BLOQUE BUSTER: el tercer juego real

> **Estado:** Implementado
> **Depende de:** SPEC 05, SPEC 06, SPEC 08
> **Fecha:** 2026-08-12
> **Objetivo:** Portar el Arkanoid de `references/templates/started-games/04-arkanoid/` a un motor TypeScript sobre canvas y registrarlo como el juego `bloque-buster`, sin tocar el reproductor, el contrato ni Supabase.

---

## Por qué existe esta spec

La SPEC 08 demostró que portar un juego es "un archivo nuevo y dos líneas en `registry.ts`".
Esta lo repite con un juego de física continua en vez de rejilla: **BLOQUE BUSTER no toca el
reproductor, ni `types.ts`, ni `supabase/migrations/`, ni `/salon`.**

El hueco ya existe en el catálogo: `GAMES` incluye `bloque-buster` — _"BLOQUE BUSTER ·
Rebota la pelota y destruye muros de neón"_, categoría `ARCADE`, acento cyan, portada
`cover-bricks`. Es además la **primera tarjeta** de la biblioteca, así que hoy el juego más
visible del portal es uno simulado. No hay que inventar ninguna entrada de catálogo.

El código de referencia son 268 líneas de JavaScript (`game.js`) más `levels.js` y
`assets/spritesheet.js`. Lo que hay que desmontar:

- **Ocho variables globales de módulo** (`blocks`, `explosions`, `lives`, `score`,
  `gameState`, `currentLevel`, `isPaused`, `lastTime`) más `paddle` y `ball` como objetos
  compartidos. En Next todo eso sobrevive entre montajes.
- **El bucle arranca en el import**, dentro del callback de `loadSpritesheet()`
  (`game.js:264`).
- **HUD dentro del canvas**: puntuación arriba a la izquierda, nivel centrado y las vidas
  dibujadas como pelotas arriba a la derecha (`game.js:230-244`).
- **Overlays dentro del canvas**: `GAME OVER`, `¡Completaste el juego!` y un **overlay de
  pausa con cinco botones clicables para saltar de nivel** (`game.js:70-85`, `183-212`).
  Es una herramienta de depuración, no una mecánica.
- **Listeners en `document` que nunca se quitan**, pausa propia con `P`/`Escape`, y
  `getElementById('game')`.
- **Assets con ruta relativa**: un spritesheet PNG cargado de forma asíncrona y dos `Audio`
  desde `assets/`. En Next esas rutas no resuelven.

Hay además tres diferencias de fondo con CAÍDA que condicionan el trabajo: la pelota se
mueve en **coordenadas continuas** (hay riesgo de atravesar bloques a velocidad alta), el
original **se puede ganar** y `GameOverReason` no admite `"win"`, y es el primer juego del
portal donde **las vidas del HUD significan algo de verdad**.

---

## Alcance

**Dentro:**

- **Motor de Arkanoid** en `app/lib/games/arkanoid.ts`, cumpliendo `GameFactory` sin cambios
  en el contrato: paleta, pelota, los cinco patrones de bloques de `levels.js`, colisiones,
  vidas, niveles cíclicos con velocidad creciente y partículas al romper un bloque.
- **Gráficos vectoriales de neón**, dibujados con formas y la paleta del tema. Sin
  spritesheet: la factory sigue siendo síncrona y no hay carga asíncrona que competir con
  `start()`.
- **Control con teclado y con ratón**: `←` `→` mueven la paleta y el puntero sobre el canvas
  también, como en el original. La pelota sale sola.
- **Física corregida** respecto a la referencia: el ángulo de salida depende del punto de
  impacto en la paleta —con un ruido de ±1.5° que impide el rebote vertical exacto—, y al
  golpear un bloque se invierte el eje realmente penetrado.
- **Integración por sub-pasos** para que la pelota no atraviese bloques a velocidad alta.
- **Progresión infinita**: tras el nivel 5 se recicla el patrón 1 con el nivel 6, 7… y la
  pelota cada vez más rápida, hasta un tope.
- **Puntuación reescalada** para que las cifras convivan con las de ROCAS y CAÍDA en el
  Salón de la Fama.
- **Registro** en `app/lib/games/registry.ts`: una línea en `GAME_ENGINES` y otra en
  `GAME_CONTROLS`.

**Fuera de alcance (para specs futuras):**

- **Los otros cinco juegos simulados.** `serpentina`, `gloton`, `invasores`, `ranaria` y
  `duelo-pixel` siguen con el reproductor simulado.
- **Tocar el reproductor** (`app/juego/[id]/jugar/page.tsx`). Si hiciera falta, es señal de
  que el motor está haciendo algo que no le toca.
- **Tocar el contrato** (`app/lib/games/types.ts`). Estable desde la SPEC 06.
- **Migraciones de Supabase.** `game_id` es texto libre y `/salon` saca sus pestañas de
  `GAMES`.
- **El top 10 del detalle `/juego/bloque-buster`.** Sigue con `seededScores`. Deuda
  declarada de la SPEC 07.
- **El campo `best` de `GAMES`** (hoy `28450`). Sigue siendo el número mock.
- **El spritesheet y los dos `.mp3`** de la referencia. No se copian a `public/`.
- **Sonido**, coherente con lo que decidió la SPEC 08 para CAÍDA.
- **El selector de nivel del overlay de pausa** del original. Es depuración.
- **Power-ups** (paleta larga, multibola, láser). El original no los tiene.
- **Controles táctiles.** En móvil se monta pero no se puede jugar; el aviso de teclado que
  ya existe cubre el caso.
- **Tests automatizados** (sigue sin haber runner configurado).

---

## Modelo de datos

**No hace falta ninguna migración de Supabase.** `game_sessions` guarda `game_id` como texto
y la vista `game_leaderboard` agrupa por él; con el motor registrado, las partidas de
`bloque-buster` se graban y aparecen en el Salón sin cambios de esquema.

Tampoco se toca `app/lib/data.ts`: la entrada `bloque-buster` ya existe.

### Constantes del motor

```ts
export const W = 800; // resolución lógica del canvas; el escalado es CSS
export const H = 600;

// Geometría de la muralla, portada tal cual de la referencia: 10×6 bloques de
// 64×24 centrados. Al no dibujar HUD dentro del canvas se gana el margen
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

// Ruido que se suma al ángulo de salida de la paleta, para que el rebote nunca
// sea vertical exacto (ver Decisiones).
const BOUNCE_JITTER = (1.5 * Math.PI) / 180;

// Progresión. El original multiplica la velocidad por 1.1 en cada uno de sus
// cinco niveles; aquí sigue haciéndolo indefinidamente, con tope.
const SPEED_STEP = 1.1;
const SPEED_MAX = 2.4; // el tope se alcanza en el nivel 11 (1.1^10 pasa de 2.4)

// La pelota se integra en sub-pasos de este tamaño máximo. Sin esto, a
// SPEED_MAX y con dt de 50 ms recorre 45 px por frame: más que un bloque (24 de
// alto), y lo atraviesa sin tocarlo.
const SUBSTEP_MAX = 6;

const START_LIVES = 3;

// Puntuación reescalada (ver Decisiones): la del original son 10 puntos planos
// por bloque, un orden de magnitud por debajo del resto del Salón.
const BLOCK_POINTS = 100; // × nivel
const LEVEL_BONUS = 1000; // × nivel, al limpiar la muralla
const LIFE_BONUS = 500; // × vidas restantes, al limpiar la muralla

const PARTICLES_PER_BLOCK = 8;
const PARTICLE_MS = 300; // vida de una partícula
```

### Colores

Los mismos literales que usa `tetris.ts`, con el mismo aviso: el canvas no entiende
variables CSS, así que duplican los tokens de `:root` y si el tema cambia hay que tocar los
dos sitios. Los siete nombres de color de `levels.js` se mapean a la paleta neón:

```ts
const BLOCK_COLORS = {
  red: "#ff2d55", // rojo neón
  yellow: "#f5ff00", // --yellow
  cyan: "#00f5ff", // --cyan
  magenta: "#ff006e", // --magenta
  hotpink: "#ff5cae", // rosa claro
  green: "#00ff88", // --green
  gray: "#9aa0b5", // gris metálico
} as const;

const PADDLE_COLOR = "#00f5ff"; // --cyan, que es el acento de bloque-buster en GAMES
const BALL_COLOR = "#e6e9ff"; // --ink
const BG_COLOR = "#000";
```

### Niveles

Los cinco patrones de `levels.js` se portan a una función pura `buildLevels()` que devuelve
`readonly LevelDef[]`, donde `LevelDef = { blocks: readonly BlockDef[] }`. **Se cae el campo
`speed` de la referencia**: la velocidad ya no es propiedad del patrón sino del número de
nivel, porque los patrones se reciclan.

| Patrón | Forma                 | Bloques |
| ------ | --------------------- | ------- |
| 1      | Muralla completa 10×6 | 60      |
| 2      | Pirámide              | 40      |
| 3      | Damero                | 30      |
| 4      | Filas con huecos      | 39      |
| 5      | Marco con cruz        | 39      |

El patrón de un nivel es `LEVELS[(level - 1) % 5]` y su multiplicador de velocidad
`min(SPEED_STEP ** (level - 1), SPEED_MAX)`.

### Estado interno

Todo dentro del closure de `createArkanoidGame`, nada a nivel de módulo:

```ts
let paddle: Paddle; // { x, y, w, h }
let ball: Ball; // { x, y, size, vx, vy }
let blocks: Block[]; // { x, y, w, h, color, alive }
let particles: Particle[]; // { x, y, vx, vy, color, elapsed }
let score: number;
let lives: number;
let level: number;
let state: "playing" | "paused" | "gameover";
let rafId: number | null;
let lastTime: number | null;
let elapsedMs: number; // tiempo jugado, sin pausas
```

No hay estado `"win"`: el juego no se acaba por completarlo (ver Decisiones).

### Lo que emite

| Callback     | Cuándo                                                              |
| ------------ | ------------------------------------------------------------------- |
| `onScore`    | Al romper un bloque y al limpiar la muralla, solo si cambia         |
| `onLives`    | `3` al arrancar y en cada pérdida (`3 → 2 → 1 → 0`)                 |
| `onLevel`    | Al limpiar la muralla y pasar al siguiente nivel                    |
| `onGameOver` | Al perder la última vida (`"game_over"`), o al rendirse con `end()` |

Puntuación: `BLOCK_POINTS × nivel` por bloque roto, y al limpiar la muralla
`LEVEL_BONUS × nivel + LIFE_BONUS × vidas restantes`. Una partida que llegue al nivel 5
ronda los 60.000 puntos, en la escala del `best` mock de `bloque-buster` (28.450) y de los
otros dos motores.

---

## Plan de implementación

Cada paso deja la app compilando (`npm run build` sin errores) y es commiteable por sí solo.
Hasta el paso 6 nada se monta en pantalla y la app se comporta como hoy.

1. **Geometría y niveles.** Crear `app/lib/games/arkanoid.ts` con la cabecera doc, las
   constantes, `BLOCK_COLORS`, los tipos `BlockDef`, `Block`, `Ball`, `Paddle`, `Particle`,
   y las funciones puras `buildLevels()` y `levelSpeed(level)`. Todas reciben lo que
   necesitan como argumento: ninguna lee estado de módulo.
   Verificación: `npm run build` compila con tipado strict; nada lo importa aún.

2. **Colisiones.** Añadir `overlaps(ball, box)`, `bounceOffBlock(ball, block)` — que decide
   el eje a invertir comparando las penetraciones en X e Y y se queda con la menor — y
   `bounceOffPaddle(ball, paddle, speed)`, que calcula el desplazamiento normalizado
   `t = (centro de la pelota − centro de la paleta) / (ancho/2)`, lo acota a `[-1, 1]` y
   devuelve la velocidad con ángulo `t × MAX_BOUNCE_ANGLE ± BOUNCE_JITTER` desde la
   vertical, acotado otra vez a `±MAX_BOUNCE_ANGLE` y **conservando el módulo**. Sin
   conservarlo, la pelota se acelera o se frena sola en cada golpe.
   Verificación: `npm run build` compila.

3. **Integración por sub-pasos.** Añadir `stepBall(dt, …)`: parte el desplazamiento del
   frame en tramos de como mucho `SUBSTEP_MAX` píxeles y, en cada tramo, resuelve muros,
   paleta y **un solo bloque** (el primero que toque, como el `break` del original).
   Verificación: `npm run build` compila.

4. **Teclado y ratón.** Añadir la clase `Input` siguiendo el patrón de `asteroids.ts` y
   `tetris.ts`: handlers como propiedades flecha, `attach()` idempotente, `detach()` que los
   quita, `clear()`, listeners de teclado en `window` y `preventDefault` acotado a
   `ArrowLeft` y `ArrowRight` mientras el motor está enganchado. El puntero se escucha en
   **el canvas que recibe la factory** (`pointermove`), no en `document`, y traduce
   coordenadas con `getBoundingClientRect()` porque el canvas se escala por CSS.
   Verificación: `npm run build` compila.

5. **Dibujo.** Añadir `drawBlocks(ctx, …)`, `drawPaddle(ctx, …)`, `drawBall(ctx, …)` y
   `drawParticles(ctx, …)`, con el estilo neón del portal: relleno del color del bloque,
   borde más claro y un `shadowBlur` corto para el glow. **Sin puntuación, sin nivel, sin
   vidas, sin GAME OVER y sin overlay de pausa dentro del canvas**: eso lo pinta la
   plataforma.
   Verificación: `npm run build` compila.

6. **Motor y bucle.** Añadir `createArkanoidGame(canvas, callbacks)` con el estado en el
   closure, los emisores con deduplicación, `summary(reason)`, `initGame()`, `loadLevel(n)`,
   `resetBall()`, `update(dt)`, `draw()`, `loop(ts)` con `dt` capado a 50 ms, `stopLoop()` y
   el `GameHandle`:
   - `start()` re-entrante (`stopLoop()` antes de `initGame()`), emite los tres callbacks
     forzados para resetear el HUD.
   - `pause()` / `resume()` con `input.clear()` en ambos, igual que CAÍDA.
   - `end()` con la guardia `if (state === "gameover") return;`.
   - `destroy()` = `stopLoop()` + `input.detach()`, sin emitir nada.
     `elapsedMs += dt * 1000` solo mientras `state === "playing"`.
     Verificación: `npm run build` y `npm run lint` limpios.

7. **Registro.** Añadir a `app/lib/games/registry.ts` la entrada
   `"bloque-buster": createArkanoidGame` en `GAME_ENGINES` y sus controles en
   `GAME_CONTROLS`:

   ```ts
   "bloque-buster": [
     ["← →", "MOVER PALETA"],
     ["RATÓN", "MOVER PALETA"],
     ["ESC", "PAUSA"],
   ],
   ```

   La clave va entre comillas porque lleva guion.
   Verificación: `/juego/bloque-buster/jugar` monta el canvas real en vez de la arena
   simulada, y el overlay de arranque anuncia estos tres controles y no los de ROCAS.

8. **Comprobación jugable.** Recorrer los criterios de aceptación con el MCP de Playwright,
   incluyendo el registro de una partida en `/salon`.

---

## Criterios de aceptación

**Build**

- [ ] `npm run lint` y `npm run build` terminan sin errores ni warnings de tipos.
- [ ] La consola del navegador no muestra errores al cargar `/juego/bloque-buster/jugar`.
- [ ] `app/lib/games/arkanoid.ts` no declara ninguna variable de estado de partida a nivel
      de módulo: todo vive dentro de `createArkanoidGame`.
- [ ] `app/juego/[id]/jugar/page.tsx` y `app/lib/games/types.ts` **no** se han modificado.
- [ ] No se ha añadido ninguna migración en `supabase/migrations/`.
- [ ] No se ha copiado ningún asset a `public/`.

**El juego funciona**

- [ ] `←` y `→` mueven la paleta y no la dejan salir del canvas.
- [ ] Mover el ratón sobre el canvas mueve la paleta, con el juego escalado a cualquier
      tamaño de ventana.
- [ ] Las flechas no scrollean la página mientras la partida está activa.
- [ ] La pelota rebota en los tres muros y en la paleta.
- [ ] Golpear la paleta cerca de un extremo devuelve la pelota con mucho ángulo; por el
      centro, casi vertical.
- [ ] La pelota **nunca** sale de la paleta en vertical exacto: con la paleta quieta y
      centrada bajo ella, no se queda taladrando siempre la misma columna.
- [ ] Golpear un bloque por el lateral invierte el movimiento horizontal, no el vertical.
- [ ] Al romper un bloque salen partículas de su color y se desvanecen.
- [ ] Cada bloque suma `100 × nivel` puntos.
- [ ] Limpiar la muralla pasa al nivel siguiente, con su patrón y más velocidad, y suma
      `1000 × nivel + 500 × vidas restantes`.
- [ ] Tras el nivel 5 el juego continúa con el patrón 1 y el nivel 6.
- [ ] La velocidad deja de crecer a partir del nivel 11 y la pelota **nunca** atraviesa un
      bloque sin romperlo.
- [ ] Perder la pelota resta una vida y relanza; con 0 vidas termina la partida.

**Integración con la plataforma**

- [ ] El overlay de arranque anuncia los tres controles de BLOQUE BUSTER, no los de ROCAS.
- [ ] La partida no empieza hasta pulsar ESPACIO.
- [ ] El HUD muestra la puntuación real y el nivel.
- [ ] El HUD muestra tres corazones al empezar y va perdiendo uno por vida.
- [ ] El canvas **no** dibuja puntuación, nivel, vidas, GAME OVER ni overlay de pausa.
- [ ] `Escape` y el botón PAUSA congelan el juego; cambiar de pestaña también.
- [ ] Mover el ratón con la partida en pausa no mueve la paleta.
- [ ] Al terminar se abre el modal "FIN DEL JUEGO" con la puntuación final.
- [ ] El botón FIN termina la partida y abre el modal con lo puntuado.
- [ ] "JUGAR DE NUEVO" reinicia con puntuación 0, nivel 1, tres vidas y la muralla completa.
- [ ] Con sesión iniciada, terminar una partida crea **exactamente una** fila en
      `game_sessions` con `game_id = 'bloque-buster'`.
- [ ] Esa partida aparece en `/salon`, en la pestaña de BLOQUE BUSTER.
- [ ] Pausar un rato no infla el `duration_ms` registrado.

**Lo que no debe romperse**

- [ ] `/juego/rocas/jugar` y `/juego/caida/jugar` siguen funcionando igual, con sus
      controles.
- [ ] Los otros cinco juegos siguen con el reproductor simulado y no registran partidas.
- [ ] Navegar fuera de `/juego/bloque-buster/jugar` y volver arranca una partida limpia, sin
      bucles duplicados ni doble velocidad.
- [ ] A 375 px de ancho la pantalla no produce scroll horizontal.

---

## Decisiones

**Alcance**

- **Sí:** usar el id `bloque-buster` que ya está en `GAMES`. Los ids del catálogo están en
  español y no delatan el clásico; inventar `arkanoid` habría duplicado un juego existente.
- **No:** migraciones de Supabase. Tercer juego, tercera vez que no hacen falta.
- **Sí:** el archivo se llama `arkanoid.ts` y la factory `createArkanoidGame`, siguiendo a
  `asteroids.ts` y `tetris.ts`: el nombre del archivo es el del clásico, el id del catálogo
  solo aparece en `registry.ts`.

**Presentación**

- **Sí:** gráficos vectoriales de neón en vez del spritesheet. Tres razones, en orden de
  peso: el pixel-art del PNG desentona dentro del marco CRT junto a ROCAS y CAÍDA; cargar
  una imagen es asíncrono y la factory es síncrona, así que habría que tolerar frames sin
  sprites o meter una espera que el contrato no contempla; y el portal no sirve hoy ningún
  asset binario.
- **Sí:** partículas al romper un bloque, que sustituyen a los cuatro frames de explosión del
  spritesheet. Dibujadas con formas, mantienen la sensación de impacto sin assets.
- **No:** sonido. La SPEC 08 lo dejó fuera para CAÍDA y meterlo aquí abriría el tema del
  volumen y del autoplay para todo el portal. Los dos `.mp3` de la referencia no se copian.

**Juego**

- **Sí:** progresión infinita reciclando los cinco patrones con más velocidad. La
  alternativa era terminar en victoria al limpiar el nivel 5, pero `GameOverReason` solo
  admite `"game_over" | "surrender"` y ampliarlo obliga a migrar la restricción `check` de
  `game_sessions` — y sobre todo pondría un techo fijo a la puntuación: todos los jugadores
  buenos empatarían y el ranking dejaría de ordenar nada.
- **Sí:** tope de velocidad en `SPEED_MAX`. Sin tope, hacia el nivel 15 la pelota va más
  rápido de lo que un humano reacciona y la partida termina sola.
- **Sí:** ángulo de salida según el punto de impacto en la paleta. El original devuelve
  siempre el mismo ángulo (`ball.vy = -Math.abs(ball.vy)`), así que el jugador no controla
  nada y la pelota cae en trayectorias repetitivas de las que no se sale.
- **Sí:** un ruido de ±1.5° sumado al ángulo de salida de la paleta. Con el ángulo dependiendo
  solo del punto de impacto, una paleta centrada al píxel bajo la pelota la devuelve en
  vertical **exacto** y la pelota se queda taladrando una sola columna. Está medido: en una
  simulación de 40 000 frames con la paleta siguiendo a la pelota con precisión perfecta
  quedaban 52 de los 60 bloques vivos y 9 columnas sin tocar; con el ruido, la pelota rompe
  en cinco columnas y la muralla avanza. El valor es pequeño a propósito —desvía unos 13 px
  a lo ancho de la pantalla, una quinta parte de un bloque— porque el juego se apunta: un
  ruido grande arreglaría el bucle a costa de que la puntería dejara de importar. Se acota
  a `±MAX_BOUNCE_ANGLE` después de sumarlo, para que un golpe en el extremo no se pase del
  máximo.
- **No:** una zona muerta determinista (forzar un ángulo mínimo cuando el impacto cae en el
  centro). Resuelve el mismo caso sin azar, pero convierte el golpe central en un salto
  brusco de ángulo justo donde el jugador espera precisión.
- **Sí:** rebote por eje al golpear un bloque. El original invierte siempre `vy`
  (`game.js:141`), así que una pelota que entra de lado rebota hacia atrás sin motivo
  aparente.
- **Sí:** integración por sub-pasos. Es la contrapartida de la velocidad creciente: con el
  `dt` capado a 50 ms y `SPEED_MAX`, un frame desplaza la pelota más que el alto de un
  bloque y lo atravesaría.
- **Sí:** tres vidas, como el original, emitidas por `onLives`. Es el primer juego del
  portal donde los corazones del HUD dicen la verdad: ROCAS también tiene vidas, y CAÍDA
  emite 1 → 0 justamente para no mentir.
- **Sí:** la pelota sale sola al empezar y tras perder una vida, con lado aleatorio. La
  alternativa —pelota pegada hasta pulsar ESPACIO— obliga a replicar la guardia
  anti-espurio de CAÍDA porque ESPACIO es la tecla que arranca la partida desde el overlay;
  el original tampoco la tiene.
- **Sí:** ratón además del teclado, como el original, escuchado en el canvas de la factory y
  no en `document`. Es el control natural del género.
- **Sí:** puntuación reescalada (100 por bloque × nivel, más bonus de nivel y de vidas). Con
  los 10 puntos planos del original una partida completa ronda los 2.500, un orden de
  magnitud por debajo del resto del Salón, y la tabla global quedaría absurda.
- **Sí:** el bonus por vidas se cobra **al limpiar la muralla**, no al terminar la partida.
  Al terminar por game over las vidas son 0 y el bonus nunca se pagaría; al terminar por
  FIN, premiaría rendirse. Cobrarlo por nivel premia lo que se quería premiar: llegar entero.
- **No:** capturar `P` para pausar, como hacía el original. El reproductor ya pausa con
  `Escape`, con el botón del HUD y al cambiar de pestaña.
- **No:** el selector de nivel del overlay de pausa (`game.js:70-85`). Es depuración, y
  además saltarse niveles falsearía el leaderboard.
- **No:** power-ups. El original no los tiene y añadirlos es rediseñar, no portar.

---

## Riesgos

| Riesgo                                                                                                                                                                      | Mitigación                                                                                                                                                             |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **La pelota atraviesa bloques** a velocidad alta o al volver de otra pestaña: es el fallo clásico de la colisión discreta, y aquí la velocidad crece sin límite de niveles. | `dt` capado a 50 ms (invariante 7 del contrato), `SPEED_MAX` como tope, e integración en sub-pasos de `SUBSTEP_MAX` píxeles. Hay un criterio de aceptación específico. |
| El listener del ratón se engancha al canvas y, si `detach()` no lo quita, navegar fuera y volver deja dos motores moviendo la misma paleta.                                 | `Input.detach()` quita también el `pointermove`, y hay un criterio de aceptación de salir y volver. El patrón de handlers como propiedades flecha lo hace posible.     |
| El original guarda ocho globales de módulo y arranca el bucle en el import (`game.js:264`). Portado tal cual, en Next el estado sobrevive entre montajes.                   | Todo el estado va en el closure de `createArkanoidGame` y el arranque solo ocurre en `start()`. Es la invariante 1 del contrato.                                       |
| Con el ángulo por punto de impacto, un golpe muy cerca del borde puede dejar la pelota casi horizontal y hacerla rebotar entre las paredes sin bajar.                       | `MAX_BOUNCE_ANGLE` de 60° desde la vertical acota el caso, y el ruido se acota junto con él: la componente vertical nunca baja del 50 % del módulo.                    |
| El extremo contrario: con la paleta centrada al píxel el rebote sale vertical exacto y la pelota se queda taladrando siempre la misma columna.                              | `BOUNCE_JITTER` de ±1.5° hace imposible el vertical exacto. El valor está elegido para deshacer el bucle sin que la puntería deje de importar (ver Decisiones).        |
| Reciclar patrones hace que la partida no acabe nunca si el jugador es bueno, y `duration_ms` puede crecer mucho.                                                            | Es el mismo modelo que ROCAS y CAÍDA. La velocidad creciente termina cerrando la partida, y el botón FIN siempre está disponible.                                      |
| La puntuación reescalada (×10 sobre el original) desentona si mañana se porta otro juego con la escala de su referencia.                                                    | La escala elegida se justifica contra el `best` mock de `bloque-buster` y contra ROCAS y CAÍDA. Queda documentada aquí para que el siguiente porte la use de vara.     |
| Las partículas se acumulan si no se filtran, y con la muralla completa son 480 objetos por nivel.                                                                           | Viven `PARTICLE_MS` y se filtran cada frame, como los `explosions` del original. Son 8 por bloque y no más de un bloque por sub-paso.                                  |

---

## Lo que **no** está en esta spec

- Los otros cinco juegos simulados del catálogo.
- El top 10 del detalle `/juego/bloque-buster` y el campo `best` de `GAMES`.
- Controles táctiles para móvil.
- Sonido, spritesheet y power-ups.
- El selector de nivel del overlay de pausa del original.
- Tests automatizados.

Cada una de esas, si aterriza, va en su propia spec.
