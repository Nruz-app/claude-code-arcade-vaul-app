# SPEC 08 — CAÍDA: el segundo juego real

> **Estado:** Aprobado
> **Depende de:** SPEC 05, SPEC 06
> **Fecha:** 2026-08-12
> **Objetivo:** Portar el Tetris de `references/templates/started-games/03-tetris/` a un motor TypeScript sobre canvas y registrarlo como el juego `caida`, sin tocar el reproductor ni el Salón de la Fama.

---

## Por qué existe esta spec

La SPEC 05 dejó escrito que el objetivo de aislar el motor era que "el segundo juego sea
añadir una entrada a un registro y no repetir toda la integración". Esta spec es la
comprobación de que aquello se cumplió: **CAÍDA no toca el reproductor, ni el contrato, ni
Supabase, ni `/salon`.** Es un archivo nuevo y dos líneas en `registry.ts`.

El hueco ya existe en el catálogo: `GAMES` incluye `caida` — _"CAÍDA · Encaja las piezas
antes de que el techo te aplaste"_, categoría `PUZZLE`, acento magenta, portada
`cover-tetro`. No hay que inventar ninguna entrada.

El código de referencia son 332 líneas de JavaScript con trece variables globales, once
`getElementById`, HUD y overlay en el DOM, un toggle de tema con `localStorage` e `init()`
ejecutándose en el propio import. Nada de eso sobrevive al porte.

Hay además una diferencia de fondo con ROCAS que condiciona el trabajo: Tetris **no tiene
vidas**, se juega en un tablero de 10×20 que no llena el canvas de 800×600, y usa un
segundo canvas para la pieza siguiente. Las tres cosas se resuelven dentro del motor.

---

## Alcance

**Dentro:**

- **Motor de Tetris** en `app/lib/games/tetris.ts`, cumpliendo `GameFactory` sin cambios en
  el contrato: tablero, las ocho piezas (las siete clásicas más la tuerca), rotación con
  _wall kicks_, fantasma, hard drop, soft drop, limpieza de líneas, niveles y velocidad
  creciente.
- **Todo en un solo canvas de 800×600**: el tablero centrado y un panel a su derecha con la
  pieza siguiente y el contador de líneas.
- **Repetición de teclas propia (DAS)** para el movimiento lateral y el soft drop, en vez
  de depender del auto-repeat del sistema operativo.
- **Registro** en `app/lib/games/registry.ts`: una línea en `GAME_ENGINES` y otra en
  `GAME_CONTROLS`.
- **Paleta neón de ocho colores** derivada de los tokens del tema.
- **`onLives` emitido como 1 → 0**, para que el HUD no mienta.

**Fuera de alcance (para specs futuras):**

- **Los otros seis juegos simulados.** `bloque-buster`, `serpentina`, `gloton`,
  `invasores`, `ranaria` y `duelo-pixel` siguen con el reproductor simulado.
- **Tocar el reproductor** (`app/juego/[id]/jugar/page.tsx`). Si hiciera falta, es señal de
  que el motor está haciendo algo que no le toca.
- **Tocar el contrato** (`app/lib/games/types.ts`). Estable desde la SPEC 06.
- **Migraciones de Supabase.** `game_id` es texto libre y `/salon` saca sus pestañas de
  `GAMES`: CAÍDA aparece en su ranking sin tocar la base.
- **El top 10 del detalle `/juego/caida`.** Sigue con `seededScores`, como el resto. Es
  deuda declarada de la SPEC 07.
- **El campo `best` de `GAMES`** (hoy `184220` para `caida`). Sigue siendo el número mock.
- **Controles táctiles.** En móvil se monta pero no se puede jugar; el aviso de teclado que
  ya existe cubre el caso.
- **Sonido.** El original no tiene y no se añade.
- **El tema claro/oscuro** del original (`game.js:307-330`). Es cosa de la plataforma.
- **La métrica de líneas en el HUD de la plataforma.** El contrato no tiene callback para
  ella; se dibuja en el panel del canvas (ver Decisiones).
- **Tests automatizados** (sigue sin haber runner configurado).

---

## Modelo de datos

**No hace falta ninguna migración de Supabase.** `game_sessions` guarda `game_id` como
texto y la vista `game_leaderboard` agrupa por él; con el motor registrado, las partidas de
`caida` se graban y aparecen en el Salón sin cambios de esquema.

Tampoco se toca `app/lib/data.ts`: la entrada `caida` ya existe.

### Constantes del motor

```ts
export const W = 800; // resolución lógica del canvas; el escalado es CSS
export const H = 600;

const COLS = 10;
const ROWS = 20;
const BLOCK = 28; // 10×28 = 280 de ancho, 20×28 = 560 de alto

// El tablero no llena el canvas: se coloca a la izquierda del centro y el panel
// de la pieza siguiente ocupa el hueco de la derecha.
const BOARD_X = 150;
const BOARD_Y = 20; // (600 − 560) / 2
const PANEL_X = 490;

const LINE_SCORES = [0, 100, 300, 500, 800]; // × nivel
const DROP_BASE = 1000; // ms entre caídas en el nivel 1
const DROP_STEP = 90; // menos por nivel
const DROP_MIN = 100; // suelo de velocidad

// Repetición de teclas propia, en ms. Sin esto, mantener ← pulsado depende del
// auto-repeat del sistema operativo, que varía en cada máquina.
const DAS_DELAY = 170; // espera antes de repetir
const DAS_PERIOD = 50; // periodo de repetición
```

### Piezas y colores

Las ocho piezas del original, incluida la **tuerca** (`N`), un 3×3 con el centro hueco que
sale con la misma probabilidad que las demás y deja un agujero imposible de rellenar.

Paleta neón de ocho colores: los cuatro tokens del tema (`--cyan`, `--yellow`, `--magenta`,
`--green`) más cuatro vecinos de la misma familia, para que cada pieza sea distinguible.
Como en `asteroids.ts`, van como literales con un comentario que recuerde que duplican los
tokens de `:root`.

```ts
const COLORS = [
  null,
  "#00f5ff", // I — --cyan
  "#f5ff00", // O — --yellow
  "#ff006e", // T — --magenta
  "#00ff9d", // S — --green
  "#ff5c00", // Z — naranja neón
  "#4d7cff", // J — azul eléctrico
  "#b14dff", // L — violeta
  "#9aa0b5", // N — gris metálico (tuerca)
] as const;
```

### Estado interno

Todo dentro del closure de `createTetrisGame`, nada a nivel de módulo:

```ts
let board: number[][]; // ROWS × COLS; 0 = vacío, 1..8 = índice de color
let current: Piece; // { type, shape, x, y }
let next: Piece;
let score: number;
let lines: number;
let level: number;
let state: "playing" | "paused" | "gameover";
let dropAccum: number; // ms acumulados hacia la siguiente caída
let dropInterval: number;
let rafId: number | null;
let lastTime: number | null;
let elapsedMs: number; // tiempo jugado, sin pausas
```

No hay estado `"dead"`: en Tetris no se muere y se reaparece, la partida termina de una vez.

### Lo que emite

| Callback     | Cuándo                                                          |
| ------------ | --------------------------------------------------------------- |
| `onScore`    | Al limpiar líneas y en cada hard/soft drop, solo si cambia      |
| `onLevel`    | Al subir de nivel (`floor(lines / 10) + 1`)                     |
| `onLives`    | `1` al arrancar la partida, `0` al terminar                     |
| `onGameOver` | Cuando una pieza no cabe al aparecer, o al rendirse con `end()` |

Puntuación, tal cual el original: `LINE_SCORES[limpiadas] × nivel`, más 2 puntos por celda
en hard drop y 1 por fila en soft drop.

---

## Plan de implementación

Cada paso deja la app compilando (`npm run build` sin errores) y es commiteable por sí solo.
Hasta el paso 5 nada se monta en pantalla y la app se comporta como hoy.

1. **Tablero y piezas.** Crear `app/lib/games/tetris.ts` con las constantes, `COLORS`,
   `PIECES`, el tipo `Piece`, y las funciones puras `createBoard()`, `randomPiece()`,
   `collide(board, shape, ox, oy)` y `rotateCW(shape)`. Todas reciben lo que necesitan como
   argumento: ninguna lee estado de módulo.
   Verificación: `npm run build` compila con tipado strict; nada lo importa aún.

2. **Mecánicas de tablero.** Añadir `tryRotate()` con los _wall kicks_ `[0,-1,1,-2,2]`,
   `merge()`, `clearLines()` (devuelve cuántas limpió), `ghostY()`, `lockPiece()` y
   `spawn()`.
   Verificación: `npm run build` compila.

3. **Teclado con repetición.** Añadir la clase `Input` siguiendo el patrón de
   `asteroids.ts`: handlers como propiedades flecha, `attach()` idempotente, listeners en
   `window`, `detach()` que los quita, y `preventDefault` acotado a las teclas del juego
   mientras el motor está enganchado. Encima, la lógica DAS: `←`, `→` y `↓` repiten tras
   `DAS_DELAY` cada `DAS_PERIOD`; `↑`, `X` y `Espacio` actúan **una sola vez por
   pulsación** e ignoran las repeticiones del sistema (`e.repeat`).
   Verificación: `npm run build` compila.

4. **Dibujo.** Añadir `drawBoard(ctx)`, `drawGrid(ctx)` (con el color de rejilla como
   literal, no leyendo variables CSS), `drawPiece(ctx, …)`, el fantasma al 20% de opacidad
   y `drawPanel(ctx)` con la pieza siguiente y el contador de líneas. **Sin puntuación, sin
   nivel, sin GAME OVER y sin overlay de pausa dentro del canvas**: eso lo pinta la
   plataforma.
   Verificación: `npm run build` compila.

5. **Motor y bucle.** Añadir `createTetrisGame(canvas, callbacks)` con el estado en el
   closure, los emisores con deduplicación, `summary(reason)`, `initGame()`, `update(dt)`,
   `draw()`, `loop(ts)` con `dt` capado a 50 ms, `stopLoop()` y el `GameHandle`:
   - `start()` re-entrante (`stopLoop()` antes de `initGame()`), emite los tres callbacks
     forzados para resetear el HUD.
   - `pause()` / `resume()` con `input.clear()` al pausar.
   - `end()` con la guardia `if (state === "gameover") return;`.
   - `destroy()` = `stopLoop()` + `input.detach()`, sin emitir nada.
     `elapsedMs += dt * 1000` solo mientras `state === "playing"`.
     Verificación: `npm run build` y `npm run lint` limpios.

6. **Registro.** Añadir a `app/lib/games/registry.ts` la entrada `caida: createTetrisGame`
   en `GAME_ENGINES` y sus controles en `GAME_CONTROLS`:

   ```ts
   caida: [
     ["← →", "MOVER"],
     ["↑ / X", "ROTAR"],
     ["↓", "BAJAR"],
     ["ESPACIO", "SOLTAR"],
     ["ESC", "PAUSA"],
   ],
   ```

   Verificación: `/juego/caida/jugar` monta el canvas real en vez de la arena simulada, y
   el overlay de arranque anuncia estos cinco controles y no los de ROCAS.

7. **Ajuste visual.** Comprobar que las cinco filas de controles caben en el overlay (ROCAS
   tiene cuatro) y que el tablero y el panel quedan centrados dentro del marco CRT. Si el
   CSS de `.game-controls` no aguanta cinco filas, ajustarlo en `app/globals.css`.
   Verificación: a 1280×800 el conjunto se ve centrado y sin deformar; a 375 px sale el
   aviso de teclado y no hay scroll horizontal.

---

## Criterios de aceptación

**Build**

- [ ] `npm run lint` y `npm run build` terminan sin errores ni warnings de tipos.
- [ ] La consola del navegador no muestra errores al cargar `/juego/caida/jugar`.
- [ ] `app/lib/games/tetris.ts` no declara ninguna variable de estado de partida a nivel de
      módulo: todo vive dentro de `createTetrisGame`.
- [ ] `app/juego/[id]/jugar/page.tsx` y `app/lib/games/types.ts` **no** se han modificado.
- [ ] No se ha añadido ninguna migración en `supabase/migrations/`.

**El juego funciona**

- [ ] `←` y `→` mueven la pieza; mantenerlas pulsadas la repite tras una pausa breve.
- [ ] `↓` baja la pieza y suma 1 punto por fila.
- [ ] `↑` y `X` rotan la pieza; mantener la tecla **no** la hace girar sin parar.
- [ ] La rotación junto a una pared desplaza la pieza en vez de fallar (_wall kicks_).
- [ ] `Espacio` suelta la pieza de golpe y suma 2 puntos por celda recorrida.
- [ ] Ninguna de esas teclas scrollea la página mientras la partida está activa.
- [ ] Completar una línea la elimina y baja las de encima.
- [ ] Limpiar 1, 2, 3 y 4 líneas suma 100, 300, 500 y 800 puntos × el nivel.
- [ ] El nivel sube cada 10 líneas y las piezas caen más rápido.
- [ ] Aparece la pieza fantasma marcando dónde va a caer la actual.
- [ ] La pieza tuerca (3×3 hueca) aparece y deja un agujero al aterrizar.
- [ ] El panel derecho muestra la pieza siguiente y el número de líneas.
- [ ] La partida termina cuando una pieza nueva no cabe.

**Integración con la plataforma**

- [ ] El overlay de arranque anuncia los cinco controles de CAÍDA, no los de ROCAS.
- [ ] La partida no empieza hasta pulsar ESPACIO, y esa misma pulsación **no** provoca un
      hard drop nada más arrancar.
- [ ] El HUD muestra la puntuación real del juego y el nivel.
- [ ] El HUD muestra un corazón durante la partida y ninguno al terminar.
- [ ] El canvas **no** dibuja puntuación, nivel, GAME OVER ni overlay de pausa.
- [ ] `Escape` y el botón PAUSA congelan el juego; cambiar de pestaña también.
- [ ] Al terminar se abre el modal "FIN DEL JUEGO" con la puntuación final.
- [ ] El botón FIN termina la partida y abre el modal con lo puntuado.
- [ ] "JUGAR DE NUEVO" reinicia con puntuación 0, nivel 1 y el tablero vacío.
- [ ] Con sesión iniciada, terminar una partida crea **exactamente una** fila en
      `game_sessions` con `game_id = 'caida'`.
- [ ] Esa partida aparece en `/salon`, en la pestaña de CAÍDA.
- [ ] Pausar un rato no infla el `duration_ms` registrado.

**Lo que no debe romperse**

- [ ] `/juego/rocas/jugar` sigue funcionando igual, con sus cuatro controles.
- [ ] Los otros seis juegos siguen con el reproductor simulado y no registran partidas.
- [ ] Navegar fuera de `/juego/caida/jugar` y volver arranca una partida limpia, sin bucles
      duplicados ni doble velocidad.
- [ ] A 375 px de ancho la pantalla no produce scroll horizontal.

---

## Decisiones

**Alcance**

- **Sí:** usar el id `caida` que ya está en `GAMES`. Los ids del catálogo están en español
  y no delatan el clásico; inventar `tetris` habría duplicado un juego existente.
- **Sí:** esta spec es la prueba de que la SPEC 05 acertó. Si al implementarla hace falta
  tocar el reproductor o el contrato, el fallo está en el motor, no en la plataforma.
- **No:** migraciones de Supabase. `game_id` es texto libre por decisión de la SPEC 06 y
  `/salon` saca las pestañas de `GAMES`: el leaderboard de CAÍDA sale gratis.

**Juego**

- **Sí:** se conserva la pieza **tuerca**. Está escrita y probada en la referencia, igual
  que pasó con el power-up de triple disparo de ROCAS: el `CLAUDE.md` de la referencia
  (que habla de "COLORS indexed 1–7") está desactualizado respecto a su propio código. Le
  da personalidad propia a CAÍDA frente a un Tetris genérico.
- **Sí:** se conserva la pieza fantasma. `ghostY()` hace falta igualmente para el hard drop,
  así que dibujarla son cuatro líneas.
- **Sí:** puntuación tal cual el original, con los puntos por hard y soft drop. Permite
  farmear bajando piezas sin hacer líneas, pero el rendimiento es ridículo comparado con un
  tetris (800 × nivel), así que no distorsiona el ranking.
- **Sí:** `Espacio` como hard drop. Es el estándar de Tetris y el músculo de cualquiera que
  haya jugado antes.

**Arquitectura**

- **Sí:** DAS propio en vez del auto-repeat del sistema. El del SO varía según la
  configuración de cada máquina: el mismo juego se controlaría distinto en cada ordenador.
- **Sí:** rotar y soltar ignoran `e.repeat`. Sin eso, dejar `↑` pulsado gira la pieza sin
  parar y el juego se vuelve incontrolable.
- **Sí:** la guardia contra el hard drop espurio al arrancar. El reproductor usa `Espacio`
  para empezar y el motor para soltar; solo cuenta una transición suelta→pulsada posterior
  a `start()`.
- **No:** capturar `P` para pausar, como hacía el original. El reproductor ya pausa con
  `Escape`, con el botón del HUD y al cambiar de pestaña. Una pausa que el motor gestione
  por su cuenta dejaría el HUD mostrando "PAUSA" mientras el juego está congelado.
- **Sí:** el tablero y el panel en el mismo canvas de 800×600. `GameFactory` recibe un solo
  canvas, y el reproductor lo escribe fijo en el JSX; cambiar eso obligaría a tocar el
  contrato y la plataforma para un solo juego.
- **No:** un canvas del tamaño exacto del tablero. `.crt-screen` declara `aspect-ratio: 4/3`
  y el reproductor fija 800×600: cualquier otra resolución sale deformada.

**Presentación**

- **Sí:** paleta neón de ocho colores. La SPEC 05 fijó que el canvas use la paleta del
  proyecto, pero el tema solo tiene cuatro tokens y Tetris necesita distinguir ocho piezas:
  con cuatro, dos piezas distintas se verían iguales y leer el tablero sería adivinar. Los
  cuatro extra se eligen en la misma familia saturada para que no desentonen en el CRT.
- **Sí:** el contador de **líneas** se dibuja en el panel del canvas. Es la métrica central
  de Tetris y el contrato no tiene ningún callback que la transporte; la alternativa era no
  mostrarla. No es HUD de la plataforma: la puntuación, el nivel y las vidas siguen saliendo
  solo del HUD, y el canvas no pinta ni fin de partida ni pausa.
- **Sí:** `onLives` emitido como 1 → 0. Sin emitir nada, el HUD se quedaría mostrando los
  tres corazones que pone por defecto el reproductor, diciendo que tienes tres vidas cuando
  tienes una.

---

## Riesgos

| Riesgo                                                                                                                                                                                                                       | Mitigación                                                                                                                                                                         |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **El `Espacio` del overlay de arranque provoca un hard drop nada más empezar.** El reproductor lo usa para arrancar y el motor para soltar la pieza.                                                                         | El motor solo actúa ante una transición suelta→pulsada posterior a `start()`, e ignora `e.repeat`. Hay un criterio de aceptación específico.                                       |
| El overlay de arranque nunca ha mostrado más de cuatro filas de controles y CAÍDA tiene cinco. El CSS de `.game-controls` podría desbordarse.                                                                                | El paso 7 lo comprueba y ajusta `app/globals.css` si hace falta. Es el único punto donde esta spec puede tener que tocar CSS.                                                      |
| Sin DAS, mantener `←` pulsado depende del auto-repeat del sistema operativo: el juego se controla distinto en cada máquina y en algunas es injugable.                                                                        | El paso 3 implementa repetición propia con `DAS_DELAY` y `DAS_PERIOD`, y hay criterios de aceptación para mantener pulsada tanto una tecla de movimiento como una de rotación.     |
| El original ejecuta `init()` en el import (`game.js:332`) y guarda trece globales de módulo. Portado tal cual, en Next el estado sobrevive entre montajes: volver a la pantalla arrastraría el tablero de la partida previa. | Todo el estado va en el closure de `createTetrisGame` y el arranque solo ocurre en `start()`. Hay un criterio de aceptación que verifica que salir y volver da una partida limpia. |
| El tablero (280×560) no llena el canvas (800×600). Si el panel queda descolocado, se ve un juego pequeño flotando en negro.                                                                                                  | Las posiciones están fijadas como constantes en el modelo de datos y el paso 7 lo verifica a 1280×800.                                                                             |
| La pieza tuerca deja agujeros irrellenables y puede hacer el juego frustrante o bajar mucho las puntuaciones frente a los demás juegos del ranking.                                                                          | Es una decisión tomada a conciencia: sale 1 de cada 8 piezas, como en la referencia. Si tras jugarlo resulta excesiva, bajar su probabilidad es una constante, no un rediseño.     |
| `duration_ms` se acumula sumando `dt`, que se cuenta solo en `playing`. Con la pieza cayendo lento en el nivel 1, una partida larga es sobre todo tiempo de espera.                                                          | Es el comportamiento deseado y el mismo que ROCAS: mide tiempo jugado, no tiempo transcurrido. Documentado aquí porque el dato no coincidirá con un cronómetro.                    |

---

## Lo que **no** está en esta spec

- Los otros seis juegos simulados del catálogo.
- El top 10 del detalle `/juego/caida` y el campo `best` de `GAMES`.
- Controles táctiles para móvil.
- Sonido y el tema claro/oscuro del original.
- Mostrar las líneas en el HUD de la plataforma.
- Tests automatizados.

Cada una de esas, si aterriza, va en su propia spec.
