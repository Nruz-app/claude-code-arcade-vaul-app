# SPEC 10 — SERPENTINA: el cuarto juego real

> **Estado:** Aprobado
> **Depende de:** SPEC 05, SPEC 06, SPEC 08
> **Fecha:** 2026-08-12
> **Objetivo:** Escribir desde cero un motor de Snake en TypeScript sobre canvas, con las frutas del atlas de `references/templates/snake-assets/`, y registrarlo como el juego `serpentina` sin tocar el reproductor ni el Salón de la Fama.

---

## Por qué existe esta spec

`serpentina` lleva en el catálogo desde la SPEC 01 —_"SERPENTINA · Crece sin morder tu
propia cola"_, categoría `ARCADE`, acento verde, portada `cover-snake`— pero cae en el
reproductor simulado: hoy es un `setInterval` que sube un número. Esta spec lo convierte en
un juego real, el cuarto tras ROCAS, CAÍDA y BLOQUE BUSTER.

Se diferencia de las tres anteriores en dos cosas:

1. **No hay código de referencia.** No existe carpeta en
   `references/templates/started-games/`, así que el motor no es un porte: se escribe
   entero, y las mecánicas son las que fija esta spec.
2. **Es el primer juego con sprites.** `references/templates/snake-assets/` trae
   `fruits.png` (3790×442, fondo transparente) y `sprites.js`, un atlas de 22 recortes de
   la fila central del PNG —la fila **pixel-art**, la que encaja con el marco CRT—. Hasta
   ahora todo se dibujaba con primitivas del canvas; aquí entra `drawImage`, y con él una
   carga asíncrona que la `GameFactory`, que es síncrona, tiene que absorber.

Del material de referencia hay dos cosas que no sobreviven: `sprites.js` publica el atlas
en `window.SPRITE_ATLAS` (pasa a ser un `const` tipado dentro del motor, sin tocar
`window`) y declara la ruta `snake-assets/fruits.png`, relativa, que en Next no resuelve
(el PNG se copia a `public/` y se referencia como `/snake-fruits.png`). Además **los
nombres del atlas están descuadrados respecto a la imagen** —lo que llama `banana` es la
manzana del primer recorte—; las coordenadas sí son correctas, así que se renombran
verificando contra el PNG.

---

## Alcance

**Dentro:**

- **Motor de Snake** en `app/lib/games/snake.ts`, cumpliendo `GameFactory` sin cambios en
  el contrato: grilla, serpiente con crecimiento, frutas con sprite, colisiones, niveles y
  velocidad creciente.
- **Grilla de 32×24 celdas de 25 px**, que llena exactamente el canvas de 800×600.
- **Bordes mortales**: chocar contra una pared termina la partida, igual que morderse.
- **22 frutas en tres rarezas** (común / rara / exótica) con puntuación y crecimiento
  distintos, dibujadas con `drawImage` desde el atlas.
- **El PNG copiado a `public/snake-fruits.png`** y el atlas como constante tipada.
- **Fallback de dibujo** mientras el sprite no ha cargado, para que la partida sea jugable
  desde el primer frame.
- **Controles: flechas y WASD**, con anti-reversa y cola de giros.
- **Registro** en `app/lib/games/registry.ts`: una línea en `GAME_ENGINES` y otra en
  `GAME_CONTROLS`.
- **`onLives` emitido como 1 → 0**, para que el HUD no mienta.

**Fuera de alcance (para specs futuras):**

- **Los otros cuatro juegos simulados**: `gloton`, `invasores`, `ranaria` y `duelo-pixel`
  siguen con el reproductor simulado.
- **Tocar el reproductor** (`app/juego/[id]/jugar/page.tsx`). Si hiciera falta, es señal de
  que el motor está haciendo algo que no le toca.
- **Tocar el contrato** (`app/lib/games/types.ts`). Estable desde la SPEC 06.
- **Migraciones de Supabase.** `game_id` es texto libre y `/salon` saca sus pestañas de
  `GAMES`: SERPENTINA aparece en su ranking sin tocar la base.
- **El top 10 del detalle `/juego/serpentina`.** Sigue con `seededScores`, como el resto.
  Es deuda declarada de la SPEC 07.
- **El campo `best` de `GAMES`** (hoy `7820` para `serpentina`). Sigue siendo mock.
- **Controles táctiles.** En móvil se monta pero no se puede jugar; el aviso de teclado que
  ya existe cubre el caso.
- **Sonido.** No hay assets de audio y no se añaden.
- **Las otras dos filas de `fruits.png`.** Solo se usa la fila pixel-art (y = 136–295).
- **Obstáculos internos, power-ups y modo dos jugadores.**
- **Tests automatizados** (sigue sin haber runner configurado).

---

## Modelo de datos

**No hace falta ninguna migración de Supabase.** `game_sessions` guarda `game_id` como
texto y la vista `game_leaderboard` agrupa por él; con el motor registrado, las partidas de
`serpentina` se graban y aparecen en el Salón sin cambios de esquema.

Tampoco se toca `app/lib/data.ts`: la entrada `serpentina` ya existe, con su portada
`cover-snake` en `app/globals.css`.

### Archivos que aparecen o cambian

| Archivo                              | Qué                                                       |
| ------------------------------------ | --------------------------------------------------------- |
| `public/snake-fruits.png`            | **Nuevo.** Copia de `fruits.png` (585 KB), servido en `/` |
| `app/lib/games/snake.ts`             | **Nuevo.** El motor                                       |
| `app/lib/games/registry.ts`          | Dos entradas: `GAME_ENGINES` y `GAME_CONTROLS`            |
| `specs/10-juego-serpentina-snake.md` | Esta spec                                                 |

`references/templates/snake-assets/` se queda donde está, como material de referencia. Ojo
al commitear: `references/` **no** está en `.gitignore`, así que hay que seleccionar rutas
en vez de `git add -A`.

### Constantes del motor

```ts
export const W = 800; // resolución lógica del canvas; el escalado es CSS
export const H = 600;

const CELL = 25;
const COLS = 32; // 32 × 25 = 800, exacto
const ROWS = 24; // 24 × 25 = 600, exacto

// Velocidad: ms entre paso y paso. Nivel 1 ≈ 7 pasos/s, tope ≈ 18.
const STEP_BASE = 145;
const STEP_DEC = 8; // menos por nivel
const STEP_MIN = 55;

const FRUTAS_POR_NIVEL = 5; // nivel = floor(comidas / 5) + 1
const LARGO_INICIAL = 3; // segmentos al empezar, en el centro, mirando a la derecha
```

### Colores

```ts
// Son los mismos valores que los tokens de :root en app/globals.css. Si el tema
// cambia, hay que tocar los dos sitios.
const COLORS = {
  fondo: "#000",
  rejilla: "rgba(0,255,136,0.06)", // --green muy diluido
  cuerpo: "#00ff88", // --green
  cabeza: "#7dffc4", // --green aclarado, para distinguir la cabeza
  ojo: "#001a10",
  brillo: "rgba(0,255,136,0.35)", // resplandor bajo la serpiente
  // Fallback de fruta mientras el PNG no ha cargado, uno por rareza
  frutaComun: "#f5ff00", // --yellow
  frutaRara: "#ff006e", // --magenta
  frutaExotica: "#00f5ff", // --cyan
} as const;
```

### Frutas y rarezas

Los 22 recortes de la fila central (`y = 136`, `h = 160`), con las coordenadas de
`sprites.js` —correctas— y los nombres corregidos contra la imagen. Cada fruta lleva su
rareza; la rareza fija puntos, crecimiento y probabilidad:

| Rareza    | Puntos      | Crece | Peso | Cuántas |
| --------- | ----------- | ----- | ---- | ------- |
| `comun`   | 50 × nivel  | +1    | 65 % | 12      |
| `rara`    | 150 × nivel | +2    | 27 % | 7       |
| `exotica` | 300 × nivel | +3    | 8 %  | 3       |

```ts
interface Recorte {
  x: number;
  y: number;
  w: number;
  h: number;
}
type Rareza = "comun" | "rara" | "exotica";
interface Fruta {
  nombre: string; // solo para leer el código; no se pinta
  recorte: Recorte;
  rareza: Rareza;
}
```

Los recortes miden entre 110 y 170 px de ancho por 160 de alto, así que **no son
cuadrados**: se dibujan conservando la proporción, con la altura fijada a `CELL * 1.3` y el
ancho derivado, centrados sobre su celda. La colisión sigue siendo de celda, no de píxel.

### Estado interno

Todo dentro del closure de `createSnakeGame`, nada a nivel de módulo:

```ts
let snake: Celda[]; // [0] es la cabeza
let dir: Vec; // dirección aplicada en el último paso
let colaGiros: Vec[]; // hasta 2 giros pendientes, uno por paso
let fruta: { col: number; row: number; fruta: Fruta } | null;
let porCrecer: number; // segmentos pendientes de añadir
let score: number;
let comidas: number;
let level: number;
let state: "playing" | "paused" | "gameover";
let pasoAccum: number; // ms acumulados hacia el siguiente paso
let rafId: number | null;
let lastTime: number | null;
let elapsedMs: number; // tiempo jugado, sin pausas
let spriteListo: boolean; // el PNG ha cargado
```

No hay estado `"dead"`: sin vidas, un choque termina la partida de una vez.

### Lo que emite

| Callback     | Cuándo                                                              |
| ------------ | ------------------------------------------------------------------- |
| `onScore`    | Al comer una fruta, solo si cambia                                  |
| `onLevel`    | Al subir de nivel (`floor(comidas / 5) + 1`)                        |
| `onLives`    | `1` al arrancar la partida, `0` al terminar                         |
| `onGameOver` | Al chocar contra una pared o contra el propio cuerpo, o con `end()` |

---

## Plan de implementación

Cada paso deja la app compilando (`npm run build` sin errores) y es commiteable por sí
solo. Hasta el paso 6 nada se monta en pantalla y la app se comporta como hoy.

1. **Asset y atlas.** Copiar `references/templates/snake-assets/fruits.png` a
   `public/snake-fruits.png`. Crear `app/lib/games/snake.ts` con la cabecera doc, el
   `import type` del contrato, las constantes (`W`, `H`, `CELL`, `COLS`, `ROWS`, velocidad,
   `COLORS`), los tipos `Recorte`, `Rareza`, `Fruta`, `Celda`, `Vec`, y la tabla `FRUTAS`
   con los 22 recortes y su rareza. **Verificar los nombres contra el PNG** antes de
   escribirlos: los de `sprites.js` están descuadrados.
   Verificación: `npm run build` compila con tipado strict; nada lo importa aún.

2. **Reglas puras.** Añadir los helpers, todos recibiendo por argumento lo que necesitan y
   sin leer nada de módulo: `celdasLibres(snake)`, `nuevaFruta(snake)` (elige celda libre y
   fruta según los pesos de rareza), `mismaCelda(a, b)`, `chocaConCuerpo(snake, celda)` y
   `avanzar(cabeza, dir)`.
   Verificación: `npm run build` compila.

3. **Teclado.** Clase `Input` siguiendo el patrón de `asteroids.ts`: handlers como
   propiedades flecha, `attach()` idempotente, listeners en `window`, `detach()` que los
   quita y `preventDefault` acotado a las teclas del juego mientras el motor está
   enganchado. Traduce `ArrowLeft/Right/Up/Down` y `KeyW/A/S/D` a un vector y lo empuja a
   `colaGiros` **solo si no es una reversa** respecto al último giro encolado (o a `dir` si
   la cola está vacía) y si la cola no llega a 2. `clear()` vacía la cola.
   Verificación: `npm run build` compila.

4. **Dibujo de la serpiente y el tablero.** `drawFondo(ctx)` con la rejilla tenue y
   `drawSerpiente(ctx)`: segmentos redondeados en `--green` con resplandor, cabeza algo
   mayor en el verde aclarado y dos ojos orientados según `dir`. **Sin puntuación, sin
   nivel, sin GAME OVER y sin overlay de pausa dentro del canvas**: eso lo pinta la
   plataforma.
   Verificación: `npm run build` compila.

5. **Dibujo de la fruta.** Carga del sprite: `new Image()` con `src = "/snake-fruits.png"`,
   `onload` que pone `spriteListo = true`. Como la factory es síncrona y la carga no,
   `drawFruta(ctx)` pinta el recorte con `drawImage` si `spriteListo`, y si no un rombo con
   el color de la rareza. En `destroy()` hay que soltar el `onload` (`img.onload = null`)
   para que no escriba en el closure de un motor ya desmontado.
   Verificación: `npm run build` compila.

6. **Motor y bucle.** `createSnakeGame(canvas, callbacks)` con el estado en el closure, los
   emisores con deduplicación, `summary(reason)`, `initGame()`, `update(dt)`, `draw()`,
   `loop(ts)` con `dt` capado a 50 ms, `stopLoop()` y el `GameHandle`:
   - `update` acumula `pasoAccum += dt * 1000` y da **como mucho un paso por frame**
     (`if (pasoAccum >= intervalo)`, restando el intervalo y capando el sobrante): consumir
     varios pasos en un frame teletransportaría la serpiente por encima de su propia cola.
   - Un paso: sacar el primer giro de `colaGiros` si lo hay, mover la cabeza, comprobar
     pared y cuerpo, comer si toca la fruta (puntos, crecimiento, nivel, fruta nueva) y
     recortar la cola si no queda nada `porCrecer`.
   - `start()` re-entrante (`stopLoop()` antes de `initGame()`), emite los tres callbacks
     forzados para resetear el HUD.
   - `pause()` / `resume()` con `input.clear()` en ambos, y `lastTime = null` al parar el
     bucle.
   - `end()` con la guardia `if (state === "gameover") return;`.
   - `destroy()` = `stopLoop()` + `input.detach()` + soltar el `onload`, sin emitir nada.
     `elapsedMs += dt * 1000` solo mientras `state === "playing"`.
     Verificación: `npm run build` y `npm run lint` limpios.

7. **Registro.** Añadir a `app/lib/games/registry.ts` la entrada
   `serpentina: createSnakeGame` en `GAME_ENGINES` y sus controles en `GAME_CONTROLS`:

   ```ts
   // SERPENTINA tampoco usa ESPACIO: la serpiente arranca sola hacia la derecha,
   // así que la tecla que abre la partida desde el overlay no hace nada dentro.
   serpentina: [
     ["← → ↑ ↓", "GIRAR"],
     ["W A S D", "GIRAR"],
     ["ESC", "PAUSA"],
   ],
   ```

   Verificación: `/juego/serpentina/jugar` monta el canvas real en vez de la arena
   simulada, y el overlay anuncia estos tres controles y no los de ROCAS.

8. **Ajuste visual.** Comprobar que la fruta se lee a 25 px dentro del marco CRT y que la
   serpiente no se confunde con la rejilla. Si el sprite queda ilegible, subir el factor de
   escala (es una constante, no un rediseño).
   Verificación: a 1280×800 el tablero llena el marco sin deformar; a 375 px sale el aviso
   de teclado y no hay scroll horizontal.

---

## Criterios de aceptación

**Build**

- [ ] `npm run lint` y `npm run build` terminan sin errores ni warnings de tipos.
- [ ] La consola del navegador no muestra errores al cargar `/juego/serpentina/jugar`, y
      `/snake-fruits.png` se sirve con 200.
- [ ] `app/lib/games/snake.ts` no declara ninguna variable de estado de partida a nivel de
      módulo: todo vive dentro de `createSnakeGame`.
- [ ] `app/juego/[id]/jugar/page.tsx` y `app/lib/games/types.ts` **no** se han modificado.
- [ ] No se ha añadido ninguna migración en `supabase/migrations/`.
- [ ] El motor no toca `window.SPRITE_ATLAS` ni importa nada de `references/`.

**El juego funciona**

- [ ] Al arrancar hay tres segmentos en el centro avanzando hacia la derecha.
- [ ] Las flechas y WASD giran la serpiente; ninguna de esas teclas scrollea la página
      mientras la partida está activa.
- [ ] No se puede girar 180° sobre el propio cuello, **ni pulsando dos teclas seguidas muy
      rápido** dentro del mismo paso.
- [ ] Comer una fruta suma según su rareza (50 / 150 / 300 × nivel) y alarga la serpiente
      1, 2 o 3 segmentos.
- [ ] La fruta nueva nunca aparece encima de la serpiente.
- [ ] Cada 5 frutas sube el nivel y la serpiente se mueve visiblemente más rápido.
- [ ] Chocar contra cualquiera de los cuatro bordes termina la partida.
- [ ] Morderse el cuerpo termina la partida.
- [ ] Las frutas se ven como sprites pixel-art del PNG, no como formas planas.
- [ ] Con la caché deshabilitada, la partida es jugable desde el primer frame aunque el PNG
      aún no haya cargado (se ve el rombo de fallback).

**Integración con la plataforma**

- [ ] El overlay de arranque anuncia los tres controles de SERPENTINA, no los de ROCAS.
- [ ] La partida no empieza hasta pulsar ESPACIO, y esa pulsación no provoca ningún efecto
      dentro del juego.
- [ ] El HUD muestra la puntuación real y el nivel.
- [ ] El HUD muestra un corazón durante la partida y ninguno al terminar.
- [ ] El canvas **no** dibuja puntuación, nivel, GAME OVER ni overlay de pausa.
- [ ] `Escape` y el botón PAUSA congelan el juego; cambiar de pestaña también.
- [ ] Teclear con la partida en pausa no tiene efecto al reanudar: la serpiente no gira
      sola al volver.
- [ ] Volver de otra pestaña no teletransporta la serpiente ni la mata sola.
- [ ] Al terminar se abre el modal "FIN DEL JUEGO" con la puntuación final.
- [ ] El botón FIN termina la partida y abre el modal con lo puntuado.
- [ ] "JUGAR DE NUEVO" reinicia con puntuación 0, nivel 1 y la serpiente de 3 segmentos.
- [ ] Con sesión iniciada, terminar una partida crea **exactamente una** fila en
      `game_sessions` con `game_id = 'serpentina'`.
- [ ] Esa partida aparece en `/salon`, en la pestaña de SERPENTINA.
- [ ] Pausar un rato no infla el `duration_ms` registrado.

**Lo que no debe romperse**

- [ ] `/juego/rocas/jugar`, `/juego/caida/jugar` y `/juego/bloque-buster/jugar` siguen
      funcionando igual, con sus controles.
- [ ] Los otros cuatro juegos siguen con el reproductor simulado y no registran partidas.
- [ ] Navegar fuera de `/juego/serpentina/jugar` y volver arranca una partida limpia, sin
      bucles duplicados ni doble velocidad.
- [ ] A 375 px de ancho la pantalla no produce scroll horizontal.

---

## Decisiones

**Alcance**

- **Sí:** usar el id `serpentina` que ya está en `GAMES`. Los ids del catálogo están en
  español y no delatan el clásico; inventar `snake` habría duplicado un juego existente.
- **No:** migraciones de Supabase. `game_id` es texto libre por decisión de la SPEC 06 y
  `/salon` saca las pestañas de `GAMES`: el leaderboard de SERPENTINA sale gratis.
- **No:** tocar `app/lib/data.ts`. La entrada y la portada `cover-snake` ya existen desde la
  SPEC 01.

**Juego**

- **Sí:** bordes mortales. Es el Snake clásico y es lo que da sentido a la velocidad
  creciente; con wrap, hasta que la cola es enorme no hay riesgo real y las partidas se
  hacen planas.
- **Sí:** grilla de 32×24 celdas de 25 px. Es la única combinación redonda que llena
  800×600 exacto, así que no queda banda negra ni hay que centrar nada.
- **Sí:** rareza de fruta que decide **a la vez** puntos y crecimiento (50/+1, 150/+2,
  300/+3). La fruta que más puntúa es la que más te estorba después: el riesgo y la
  recompensa van juntos en la misma decisión, sin añadir ningún sistema nuevo.
- **Sí:** nivel cada 5 frutas. Con 10 las primeras partidas son largas y el `level` que
  llega al Salón se queda en números bajos que no distinguen a nadie.
- **Sí:** la serpiente arranca ya en movimiento. Si esperase a la primera tecla, el jugador
  podría dejar la partida quieta indefinidamente y `duration_ms` mediría tiempo sin jugar.
- **Sí:** flechas **y** WASD. Son dos entradas al mismo vector, cuestan tres líneas y
  cubren a quien juega con la izquierda.
- **No:** ESPACIO para acelerar. El reproductor la usa para arrancar desde el overlay, y
  blindar el motor contra esa pulsación costó un criterio de aceptación entero en CAÍDA.
  Sin ESPACIO, el problema no existe: es la misma decisión que BLOQUE BUSTER.
- **Sí:** llenar el tablero entero (768 celdas) se trata como fin de partida normal, con
  `reason: "game_over"`. `GameOverReason` solo admite `"game_over" | "surrender"` y
  ampliarlo obligaría a migrar la restricción `check` de `game_sessions` por un caso que
  casi nadie va a ver.

**Arquitectura**

- **Sí:** cola de hasta dos giros, aplicados uno por paso. Comprobar la reversa contra
  `dir` en el momento de la pulsación no basta: entre dos pasos caben dos teclas, y
  ↑ seguido de ↓ metería la cabeza dentro del cuello. La cola valida cada giro contra el
  anterior **encolado**, no contra el aplicado.
- **Sí:** un solo paso de serpiente por frame como máximo. Con el `dt` capado a 50 ms y el
  intervalo mínimo en 55 ms nunca deberían tocar dos, pero si tocaran, la serpiente
  avanzaría dos celdas sin dibujarse y se comería a sí misma sin que se viera.
- **Sí:** el atlas como constante tipada dentro del motor. `sprites.js` escribe en
  `window`, que en Next no existe en el servidor, y además el motor no debe depender de
  nada de `references/`.
- **Sí:** los nombres de fruta se corrigen contra la imagen. Los de `sprites.js` están
  desplazados; las coordenadas no. Los nombres no se pintan en pantalla, pero un `apple`
  que es una naranja hace que el reparto de rarezas sea imposible de revisar.
- **Sí:** fallback de dibujo mientras el PNG carga. `GameFactory` es síncrona y devuelve el
  handle al momento; esperar a la imagen exigiría una factory asíncrona, es decir, tocar el
  contrato.
- **Sí:** `img.onload = null` en `destroy()`. Es el mismo problema que los listeners sin
  quitar: un `onload` que llega tarde escribiría en el closure de un motor ya desmontado.
- **No:** capturar `P` para pausar. El reproductor ya pausa con `Escape`, con el botón del
  HUD y al cambiar de pestaña.

**Presentación**

- **Sí:** serpiente neón verde con cabeza diferenciada y ojos. `--green` es el acento que
  `serpentina` ya tiene en el catálogo, y la cabeza marcada es lo que permite leer hacia
  dónde vas cuando la cola cruza la pantalla.
- **Sí:** solo la fila pixel-art del PNG. Las otras dos filas son ilustraciones suaves que
  desentonan con el CRT y con los otros tres juegos.
- **Sí:** el sprite se dibuja a `CELL * 1.3` conservando proporción. Los recortes no son
  cuadrados (110–170 × 160): forzarlos a una celda cuadrada los deforma.
- **Sí:** `onLives` emitido como 1 → 0. Sin emitir nada, el HUD se quedaría mostrando los
  tres corazones por defecto del reproductor.

---

## Riesgos

| Riesgo                                                                                                                                                                               | Mitigación                                                                                                                                                                           |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **La carga del sprite es asíncrona y `GameFactory` es síncrona.** Si el motor espera a la imagen, hay que cambiar el contrato; si no la espera, los primeros frames no tienen fruta. | Flag `spriteListo` y fallback en rombo con el color de la rareza. Hay un criterio de aceptación que lo comprueba con la caché deshabilitada.                                         |
| El `onload` puede llegar después de desmontar el componente y escribir en el closure de un motor muerto.                                                                             | `destroy()` suelta `img.onload = null`, igual que quita los listeners de teclado.                                                                                                    |
| **Reversa instantánea**: dos teclas opuestas dentro del mismo paso meten la cabeza en el cuello y matan al jugador sin que haya hecho nada raro.                                     | Cola de hasta dos giros, cada uno validado contra el anterior encolado. Criterio de aceptación específico para pulsar dos teclas seguidas muy rápido.                                |
| Los nombres del atlas de `sprites.js` no coinciden con la imagen; copiarlos tal cual reparte las rarezas a ciegas.                                                                   | El paso 1 obliga a verificar los 22 recortes contra el PNG antes de escribir la tabla.                                                                                               |
| Volver de otra pestaña con un `dt` grande podría consumir varios pasos de golpe y matar a la serpiente sola.                                                                         | `dt` capado a 50 ms, `lastTime = null` al parar el bucle y como mucho un paso por frame. Criterio de aceptación al volver de otra pestaña.                                           |
| Un sprite de fruta a 25 px puede quedar ilegible dentro del marco CRT, sobre todo las frutas pequeñas y oscuras.                                                                     | Se dibuja a `CELL * 1.3` y el paso 8 lo verifica a 1280×800. Subir el factor es cambiar una constante.                                                                               |
| Con rareza × nivel, una partida muy larga podría dispararse de escala frente a los otros juegos del ranking global.                                                                  | El techo real lo pone la longitud de la serpiente: a más frutas, menos hueco para maniobrar. Los órdenes de magnitud quedan por debajo de CAÍDA, que llega a 800 × nivel por tetris. |
| `references/` no está en `.gitignore`: un `git add -A` metería `snake-assets/` y los 585 KB duplicados en el commit.                                                                 | El paso 1 copia el PNG a `public/` y el commit selecciona rutas, como ya advierte `CLAUDE.md`.                                                                                       |

---

## Lo que **no** está en esta spec

- Los otros cuatro juegos simulados del catálogo (`gloton`, `invasores`, `ranaria`,
  `duelo-pixel`).
- El top 10 del detalle `/juego/serpentina` y el campo `best` de `GAMES`.
- Controles táctiles para móvil.
- Sonido.
- Obstáculos internos, power-ups y modo dos jugadores.
- Las otras dos filas de sprites de `fruits.png`.
- Tests automatizados.

Cada una de esas, si aterriza, va en su propia spec.
