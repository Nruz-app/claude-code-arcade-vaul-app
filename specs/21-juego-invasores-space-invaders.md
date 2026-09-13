# SPEC 21 — INVASORES: el séptimo juego real

> **Estado:** Implementado
> **Depende de:** SPEC 05, SPEC 06, SPEC 13, SPEC 14
> **Fecha:** 2026-09-12
> **Objetivo:** Escribir desde cero un motor de Space Invaders en TypeScript sobre canvas —formación de 5×11 que acelera al morir, escudos que se erosionan disparo a disparo y nave nodriza— y registrarlo como el juego `invasores` con sus tres aspectos, sin tocar el reproductor ni el Salón de la Fama.

---

## Por qué existe esta spec

`invasores` lleva en el catálogo desde la SPEC 01 —_«INVASORES · Defiende el planeta de filas
alienígenas»_, categoría `SHOOTER`, acento `green`, portada `cover-invaders`
(`app/lib/data.ts:72`)— pero cae en el reproductor simulado: hoy es un `setInterval` que sube
un número. Esta spec lo convierte en el **séptimo** juego real, tras ROCAS, CAÍDA, BLOQUE
BUSTER, SERPENTINA, RANARIA y GLOTÓN.

La memoria de `game-planner` lo tiene como `propuesto` con 31/35, nº 2 del roadmap, y le
anotó dos pegas. Las dos se resuelven aquí, y conviene dejar escrito cómo:

1. **«Repite el _nave que dispara_ de ROCAS».** Es cierto en la descripción y falso en la
   mano. ROCAS es inercia y rotación en un espacio toroidal: la dificultad está en frenar.
   INVASORES es un carril horizontal sin inercia y **una sola bala en pantalla**: la
   dificultad está en no fallar. El aporte no es el disparo, es el reloj — una formación que
   acelera sola mientras te quedas sin escudos.
2. **«Quiere `ESPACIO`, que abre la partida».** No es un conflicto: ROCAS ya declara `Space`
   para DISPARAR desde la SPEC 05 y convive con el overlay, porque cuando la partida corre el
   overlay ya no está montado. Lo que sí hay que respetar es la regla del contrato: declarar
   `Space` **solo** porque el motor lo usa dentro de la partida, que es el caso.

Y una cosa más que lo separa de los seis anteriores: es el primer motor cuyo escenario
**es destruible**. Los escudos no son decorado ni obstáculo fijo; son el único dato mutable
grande del juego y el centro de su táctica.

---

## Alcance

**Dentro:**

- `app/lib/games/invaders.ts` — el motor entero contra `GameFactory`, en un solo archivo, sin
  estado a nivel de módulo.
- **La formación**: 5 filas × 11 columnas = 55 invasores de tres tipos, movimiento en pasos
  discretos, rebote contra los bordes con descenso, y aceleración según cuántos quedan vivos.
- **Los tres tipos como bitmap**: `alto`, `medio` y `bajo`, cada uno una matriz de 11×8 con
  **dos fotogramas**, dibujados con `fillRect`. Ningún asset en `public/`.
- **El cañón**: movimiento horizontal sin inercia, acotado a la pantalla, y **una sola bala
  en vuelo**.
- **Disparo con `Space` y con `ArrowUp`**, las dos teclas.
- **Las balas de los invasores**: hasta tres a la vez, salen del invasor más bajo de una
  columna al azar.
- **Cuatro escudos destructibles**, erosionados por los tres agentes que los tocan: la bala
  propia, la bala enemiga y el invasor que pasa por encima.
- **La nave nodriza**, que cruza por arriba cada cierto tiempo y puntúa 50/100/150/300.
- **Fin inmediato** si un invasor vivo alcanza la línea del cañón, aunque queden vidas.
- Puntuación clásica (10/20/30), 3 vidas con vida extra a 1 500 y niveles por oleada
  limpiada, emitidos por `onScore`, `onLives` y `onLevel`.
- **Los tres aspectos** (`neon`, `retro`, `clasico`) en una `FichaDeSkins`, registrada en
  `GAME_PALETAS` y verificada por `verificaSkins`.
- Registro en `app/lib/games/registry.ts`: las **cuatro** entradas (`GAME_ENGINES`,
  `GAME_CONTROLS`, `GAME_PALETAS`, `GAME_TOUCH`).
- `tests/games/invaders.test.ts` con las tres suites compartidas más las pruebas propias.

**Fuera, explícitamente:**

- **Sonido.** ROCAS, CAÍDA, SERPENTINA y GLOTÓN son mudos; INVASORES también. El latido de
  cuatro notas que acelera es una spec aparte, como lo fueron la 11 y la 12.
- **Sprites en `public/`.** Todo son `fillRect` sobre bitmaps declarados en el motor.
- **La regla del disparo nº 23.** En el arcade la nodriza da 300 puntos si la derribas con el
  disparo número 23 y luego cada 15. Es folclore de máquina, no mecánica legible.
- **Modo dos jugadores por turnos**, que el original tenía y el reproductor no sabe presentar.
- **El top 10 del detalle** `/juego/invasores`, que sigue siendo `seededScores(seed)`.
- **El campo `best` de `GAMES`**, que sigue siendo mock (54 190).
- **El reproductor** (`app/juego/[id]/jugar/page.tsx`), **`types.ts`** y **Supabase**: no se
  toca ninguno. Un juego nuevo no necesita migración.
- **La entrada del catálogo y la portada**: `invasores` ya está entero en `GAMES` y
  `cover-invaders` ya existe en `app/globals.css:792`.

---

## Modelo de datos

### Archivos que aparecen o cambian

| Archivo                                      | Qué pasa                                    |
| -------------------------------------------- | ------------------------------------------- |
| `app/lib/games/invaders.ts`                  | **Nuevo.** El motor entero.                 |
| `app/lib/games/registry.ts`                  | Cuatro entradas, una por mapa del registro. |
| `tests/games/invaders.test.ts`               | **Nuevo.** Suites compartidas + lo propio.  |
| `specs/21-juego-invasores-space-invaders.md` | Esta spec.                                  |

**Ninguna migración de Supabase.** `game_id` es texto libre en `game_sessions` y las pestañas
del Salón salen de `GAMES`, así que `invasores` aparece en su ranking sin SQL.

### Geometría

```ts
const W = 800;
const H = 600;
const ESCALA = 3; // px por píxel de bitmap
const CELDA_X = 48; // paso de rejilla de la formación
const CELDA_Y = 40;
const FILAS = 5;
const COLUMNAS = 11;
const Y_CANON = 540;
const Y_ESCUDOS = 460;
const Y_LIMITE = 530; // un invasor vivo aquí termina la partida
const Y_SUELO = 566;
```

La formación mide `11 × 48 = 528` px de ancho, así que oscila dentro de los 800 con margen
suficiente a los dos lados. El canvas es **800×600** como los seis motores anteriores: el
reproductor lo fija en el JSX y `.crt-screen` declara `aspect-ratio: 4/3`.

### Los tres tipos de invasor

Cada tipo es una matriz de **11 columnas × 8 filas** de `0`/`1`, con dos fotogramas. Se
dibujan a `ESCALA` (33×24 px), y el fotograma **alterna con cada paso de la formación**, no
con un temporizador propio: es lo que hace que la animación y el movimiento sean la misma
cosa, como en el arcade.

| Tipo    | Filas | Puntos | Silueta clásica |
| ------- | ----- | ------ | --------------- |
| `alto`  | 0     | 30     | Calamar         |
| `medio` | 1 y 2 | 20     | Cangrejo        |
| `bajo`  | 3 y 4 | 10     | Pulpo           |

El bitmap es **dato, no lógica**: se transcribe una vez y las pruebas comprueban sus
dimensiones y que ningún fotograma esté vacío.

### El movimiento de la formación

En **pasos discretos**, no continuo. Cada `intervalo` segundos la formación entera avanza
`PASO_X`; si algún invasor vivo tocaría el borde, en vez de avanzar baja `PASO_Y` e invierte
el sentido.

```ts
const PASO_X = 8;
const PASO_Y = 16;
const INTERVALO_MAX = 0.55; // con los 55 vivos
const INTERVALO_MIN = 0.045; // con el último

// vivos: 1..55 — nivel: 1..n
intervalo =
  (INTERVALO_MIN + ((vivos - 1) / 54) * (INTERVALO_MAX - INTERVALO_MIN)) *
  Math.max(0.5, 1 - 0.08 * (nivel - 1));
```

**La aceleración por bajas no es un estado**: es función de `vivos`, así que sale gratis y no
se puede desincronizar. El último invasor va a doce pasos por segundo, que es exactamente el
sabor del original.

### Proyectiles

```ts
const VEL_BALA_JUGADOR = 520; // px/s, hacia arriba
const VEL_BALA_INVASOR = 220; // px/s, +15 % por nivel
const MAX_BALAS_INVASOR = 3;
const CADENCIA_INVASOR = [0.8, 1.6]; // s, al azar dentro del rango
```

- **El jugador tiene una sola bala en vuelo.** No se puede volver a disparar hasta que impacta
  o sale por arriba. Es lo que hace que fallar cueste.
- El disparo se lee con `wasPressed` (la pulsación que se consume), no con `isHeld`: mantener
  la tecla no dispara en cada fotograma, y el motor **no depende del auto-repeat del sistema**
  —que además el mando táctil no manda.
- Las balas enemigas salen **del invasor más bajo** de una columna elegida al azar entre las
  que tienen alguien vivo. Disparar desde una fila de atrás dejaría balas atravesando a los
  de delante.

### Los escudos

Cuatro búnkeres, cada uno una rejilla de **22×16 celdas de 3 px** (66×48 px), repartidos a lo
ancho sobre `Y_ESCUDOS`.

```ts
interface Escudo {
  x: number;
  y: number;
  celdas: Uint8Array; // 22 * 16, 1 = intacta
}
```

Un impacto borra las celdas dentro de un radio pequeño del punto de contacto y consume la
bala. Un invasor que baja hasta la altura de un escudo borra las celdas que solapa: los
escudos no protegen de lo que ya está encima.

`Uint8Array` reutilizado y no un array de booleanos nuevo por fotograma: es el único dato
mutable grande del motor y no debe generar basura en el bucle.

### La nave nodriza

```ts
const NODRIZA_INTERVALO = [20, 30]; // s, al azar dentro del rango
const NODRIZA_VEL = 100; // px/s
const NODRIZA_PUNTOS = [50, 100, 150, 300];
```

Aparece por un borde al azar mientras queden **8 o más** invasores vivos —debajo de eso la
formación ya va deprisa y la nodriza estorbaría—, cruza la pantalla y desaparece. Al
derribarla, el número puntuado se queda flotando ~1 s en su sitio.

### Puntuación, vidas y niveles

| Concepto      | Puntos                           |
| ------------- | -------------------------------- |
| Invasor bajo  | 10                               |
| Invasor medio | 20                               |
| Invasor alto  | 30                               |
| Nodriza       | 50 / 100 / 150 / 300 al azar     |
| Vida extra    | a los 1 500 puntos, una sola vez |

Una oleada limpia da 990 puntos más lo que caiga de nodriza. Es una escala pequeña al lado de
los 184 220 de CAÍDA y **no hay nada que corregir**: el Salón compara por juego, cada uno en
su pestaña. Es el mismo argumento que cerró la escala de GLOTÓN.

**Niveles:** limpiar la formación sube de nivel, repone los cuatro escudos y arranca la
oleada siguiente `PASO_Y` más abajo, con tope a las 8 oleadas. Más abajo de eso la partida
sería un game over de salida.

**Fin de partida:**

- Un invasor vivo alcanza `Y_LIMITE` → `onGameOver` con `"game_over"` **inmediatamente**,
  aunque queden vidas.
- Perder la última vida → `onLives(0)` y luego `onGameOver` con `"game_over"`.
- Pulsar FIN → `"surrender"`, desde `end()`.

INVASORES **no se puede ganar**: las oleadas no se acaban, así que no hay un tercer motivo que
mapear —que es lo que obligó a BLOQUE BUSTER a registrar la victoria como `game_over`.

### Colores — la ficha de skins

Diez roles, con la paleta neón como fuente del tipo, igual que `SKINS_ROCAS`:

```ts
const PALETA_NEON = {
  fondo: "#000",
  canon: "#00f5ff", // --cyan
  balaJugador: "#e6e9ff", // --ink
  invasor: "#00ff88", // --green, el acento del catálogo
  balaInvasor: "#f5ff00", // --yellow
  nodriza: "#ff006e", // --magenta
  escudo: "#00c46a", // --green apagado
  explosion: "#ffcf3a", // --gold
  suelo: "rgba(0,255,136,0.45)", // la línea del suelo
  puntosNodriza: "#e6e9ff",
} as const;

export type RolInvasores = keyof typeof PALETA_NEON;
export const SKINS_INVASORES: FichaDeSkins<RolInvasores> = {
  roles,
  grupos,
  paletas,
};
```

Clases de contraste: `fondo` es `superficie`; `canon`, `balaJugador`, `invasor`,
`balaInvasor`, `nodriza` y `escudo` son `jugable`; `explosion` y `suelo` son `decorado`;
`puntosNodriza` es `texto`.

```ts
grupos: [
  ["invasor", "nodriza"],
  ["balaJugador", "balaInvasor"],
  ["canon", "escudo"],
];
```

- `invasor` vs `nodriza` — la nodriza vale hasta 300 puntos y hay que verla llegar.
- `balaJugador` vs `balaInvasor` — saber cuál de las dos te viene es el juego entero.
- `canon` vs `escudo` — el cañón se mueve por detrás de los escudos y no puede confundirse
  con ellos.

Los tres aspectos:

- **`neon`** — los tokens de `:root`, con el acento `green` del catálogo para los invasores.
- **`retro`** — fósforo ámbar: un solo tono y todo el trabajo hecho por la luminancia.
- **`clasico`** — el gabinete del 78: invasores y balas en blanco, la franja baja (cañón,
  escudos, suelo) en verde y la nodriza en rojo. Es lo que daban las tiras de celofán pegadas
  sobre el tubo, que es de donde salía el color en una máquina monocroma.

### Estado interno

```ts
interface Invasor {
  col: number;
  fila: number;
  tipo: "alto" | "medio" | "bajo";
  vivo: boolean;
}

interface Bala {
  x: number;
  y: number;
  dy: number;
  dead: boolean;
}

interface Nodriza {
  x: number;
  dx: number;
}
```

La posición de un invasor **se deriva** de `col`, `fila` y el desplazamiento de la formación:
55 posiciones que se mueven a la vez no son 55 estados independientes. Todo vive en el closure
de la factory; a nivel de módulo solo las constantes inmutables (bitmaps, paletas, tuning).

### Lo que emite

| Callback     | Cuándo                                                                      |
| ------------ | --------------------------------------------------------------------------- |
| `onScore`    | Al cambiar la puntuación: invasor o nodriza.                                |
| `onLives`    | 3 al empezar; al morir; +1 al llegar a 1 500; 0 al terminar.                |
| `onLevel`    | 1 al empezar; +1 al limpiar la oleada.                                      |
| `onGameOver` | `GameOverSummary` con `score`, `level`, `durationMs` sin pausas y `reason`. |

---

## Plan de implementación

Cada paso deja la app compilando y `npm run test:run` en verde.

1. **Los bitmaps y la paleta.** Transcribir los tres tipos con sus dos fotogramas, escribir
   `PALETA_NEON` y `SKINS_INVASORES`, y dibujar la formación de 5×11 quieta, centrada en el
   canvas de 800×600, con el suelo y el cañón. Sin movimiento.
   _Verificación:_ la prueba comprueba que cada fotograma mide 11×8 y no está vacío.

2. **La formación se mueve.** Pasos discretos, rebote contra los bordes con descenso,
   alternancia de fotograma por paso y el intervalo en función de `vivos` y `nivel`.

3. **El cañón dispara.** Teclado encapsulado (`ArrowLeft`, `ArrowRight`, `Space`, `ArrowUp`)
   con `preventDefault` acotado y limpieza en `destroy()`; una sola bala en vuelo; impacto con
   puntuación por tipo; `onScore` solo al cambiar.
   _Verificación:_ `verificaMando` despacha los `code` declarados y los consume.

4. **Devuelven el fuego.** Hasta tres balas enemigas desde el invasor más bajo de una columna
   al azar, muerte del cañón con su explosión, las 3 vidas por `onLives` y la vida extra a
   1 500.

5. **Los escudos.** La rejilla de celdas, el dibujo, y la erosión por los tres agentes: bala
   propia, bala enemiga e invasor que solapa.

6. **La nodriza y el fin.** Aparición temporizada, cruce, puntuación flotante; fin de oleada
   con `onLevel`, escudos repuestos y formación más baja; y el `onGameOver` inmediato al
   alcanzar `Y_LIMITE`.

7. **Registro y pruebas.** Las cuatro entradas de `registry.ts` y
   `tests/games/invaders.test.ts` con `verificaContrato`, `verificaSkins` y `verificaMando`,
   más lo propio del juego.

8. **Verificación final.** `npm run test:run`, `npm run lint`, `npm run build` y una partida
   real con Playwright en `/juego/invasores/jugar`.

---

## Criterios de aceptación

### Build

- [ ] `npm run test:run` en verde, incluida la suite nueva.
- [ ] `npm run lint` sin errores ni avisos nuevos.
- [ ] `npm run build` completa con Turbopack.
- [ ] `npx tsc --noEmit` sin errores.

### El juego funciona

- [ ] La partida arranca con 55 invasores: 11 `alto`, 22 `medio` y 22 `bajo`.
- [ ] Cada bitmap mide 11×8, tiene dos fotogramas y ninguno está vacío.
- [ ] La formación avanza en pasos, baja al tocar un borde e invierte el sentido.
- [ ] El fotograma de los invasores alterna con cada paso, no con un reloj propio.
- [ ] El intervalo entre pasos baja al morir invasores: con un solo vivo es menor que con 55.
- [ ] El cañón se mueve con `← →` y no sale de la pantalla.
- [ ] `Space` dispara y `ArrowUp` también.
- [ ] Con una bala en vuelo, pulsar de nuevo **no** crea una segunda.
- [ ] Derribar un invasor suma 10, 20 o 30 según su fila, y `onScore` se emite solo al cambiar.
- [ ] Los invasores disparan desde el más bajo de su columna, y nunca hay más de tres balas
      enemigas a la vez.
- [ ] Una bala enemiga que alcanza el cañón cuesta una vida y emite `onLives`.
- [ ] A los 1 500 puntos se gana una vida, una sola vez.
- [ ] Una bala del jugador, una bala enemiga y un invasor que pasa por encima erosionan el
      escudo, cada uno por su lado.
- [ ] Un escudo erosionado deja pasar los disparos por el hueco abierto.
- [ ] La nodriza aparece mientras queden 8 o más invasores, cruza y puntúa 50/100/150/300.
- [ ] Limpiar la oleada sube de nivel, emite `onLevel`, repone los escudos y baja la formación.
- [ ] Un invasor vivo que alcanza `Y_LIMITE` emite `onGameOver` con `"game_over"` **aunque
      queden vidas**.
- [ ] Perder la última vida emite `onLives(0)` y luego `onGameOver` con `"game_over"`.

### Integración con la plataforma

- [ ] `invasores` está en `GAME_ENGINES`, `GAME_CONTROLS`, `GAME_PALETAS` y `GAME_TOUCH`.
- [ ] El overlay de arranque anuncia los controles de INVASORES, no los de otro juego.
- [ ] **El overlay muestra el selector de ASPECTO** con las tres opciones.
- [ ] Montar el motor sin skin pinta exactamente igual que montarlo con `"neon"`.
- [ ] `createInvadersGame.length` sigue siendo 2 (el tercer parámetro va con valor por
      defecto, nunca opcional).
- [ ] El HUD de la plataforma mueve puntuación, vidas y nivel al jugar.
- [ ] `Escape`, `blur` y cambio de pestaña pausan; el tiempo en pausa no cuenta en
      `durationMs`.
- [ ] El mando táctil mueve el cañón y el botón A dispara.
- [ ] Con sesión iniciada, terminar una partida la registra y aparece en `/salon`.
- [ ] Salir de la pantalla y volver arranca una partida limpia, sin doble velocidad.

### Lo que no debe romperse

- [ ] `app/juego/[id]/jugar/page.tsx` no se toca.
- [ ] `app/lib/games/types.ts` no se toca.
- [ ] Los seis motores existentes siguen con sus pruebas en verde, skins incluidas.
- [ ] `registry.test.ts` sigue en verde con siete motores registrados.
- [ ] No hay migración nueva en `supabase/migrations/`.

---

## Decisiones

- **Sí: `Space` y `ArrowUp` disparan las dos.** La memoria de `game-planner` avisaba de que
  `invasores` «quiere `ESPACIO`, que abre la partida», pero no es un choque: ROCAS lo declara
  desde la SPEC 05 y funciona, porque cuando la partida corre el overlay ya no está montado.
  `ArrowUp` va además porque la mano que mueve con las flechas tiene el pulgar ahí, y el
  contrato no cobra nada por escuchar dos `code` para la misma acción.
- **Sí: una sola bala del jugador en vuelo.** Es el límite del original y es lo que convierte
  el juego en puntería en vez de en cortina de fuego. Sin él, ametrallar la fila de abajo gana
  la oleada sin decidir nada.
- **Sí: movimiento por pasos discretos.** Además de ser el aspecto del arcade —la formación
  salta, no desliza—, regala dos cosas: la animación no necesita reloj propio (alterna por
  paso) y la aceleración por bajas es una función de `vivos`, no un estado que se pueda
  desincronizar.
- **Sí: tres aspectos, al revés que GLOTÓN.** En Pac-Man el color **es** el juego: el rojo y
  el rosa son cómo se distingue a Blinky de Pinky. Aquí las siluetas hacen ese trabajo, así
  que la paleta vuelve a ser un tema y el motor entra en `GAME_PALETAS` con `verificaSkins`,
  como los cinco primeros.
- **Sí: un solo rol `invasor` para los tres tipos.** Se distinguen por silueta y por fila,
  como en el original, donde los tres eran del mismo blanco. Tres roles de color harían
  imposible declarar honestamente la paleta `clasico`, que es monocroma por definición. Es el
  mismo argumento con el que `SKINS_ROCAS` deja su bala fuera del grupo de contraste.
- **Sí: los escudos como rejilla de celdas.** Un rectángulo que desaparece de golpe al tercer
  impacto no es un escudo de Space Invaders: el hueco que abres a tiros es por donde después
  disparas tú, y eso pide resolución de píxel.
- **Sí: `Uint8Array` reutilizado para las celdas.** Son 1 408 celdas entre los cuatro
  búnkeres; un array de booleanos nuevo por fotograma sería la mayor fuente de basura del
  motor. Es la misma disciplina que llevó a `compactaVivos()` en `asteroids.ts`.
- **Sí: fin inmediato al alcanzar la línea del cañón.** Es la presión que le da reloj a la
  partida. Con la alternativa —perder una vida y reponer la oleada— las vidas se vuelven un
  colchón y el juego deja de tener final.
- **Sí: puntuación clásica sin inflar.** El Salón compara por juego, cada uno en su pestaña.
  Multiplicar por diez para acercarse a CAÍDA sería maquillaje.
- **No: sonido.** Cuatro de los seis motores son mudos. El latido de cuatro notas que acelera
  merece su propia spec, como la 11 y la 12, porque el trabajo es de audio (recorte,
  normalizado a −1 dBFS, mono) y no de código.
- **No: sprites en `public/`.** Los bitmaps de 11×8 caben en el archivo y evitan la carga
  asíncrona que SERPENTINA tuvo que absorber. Además el color sale del rol de la paleta, que
  es justo lo que un PNG impide.
- **No: la regla del disparo nº 23** para los 300 puntos de la nodriza. Es folclore de
  máquina: nadie lo descubre jugando y premia contar, no apuntar. Queda al azar entre los
  cuatro valores.
- **No: `arriba` en la cruceta del mando.** El botón redondo A ya dispara y es donde va el
  pulgar derecho; una flecha arriba que hace lo mismo que A confunde el mando.
- **No: tocar el reproductor.** Si algo parece pedirlo, es que el motor está haciendo el
  trabajo de la plataforma.

---

## Riesgos

| Riesgo                                                                                                         | Mitigación                                                                                                                                          |
| -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| **La erosión de los escudos es el único dato mutable grande** y está en el camino de todas las colisiones.     | `Uint8Array` por escudo, reutilizado y reinicializado por oleada. Prueba propia que dispara contra un escudo y cuenta celdas antes y después.       |
| **La paleta `clasico` monocroma tensa el grupo `["canon","escudo"]`**: los dos son verdes en el gabinete real. | `verificaSkins` mide el ratio y obliga a separarlos por luminancia. Si no sale, el que cede es el escudo, que es escenario y no jugador.            |
| **El intervalo de la formación depende de dos variables** (`vivos` y `nivel`) y es fácil que se descuadre.     | Es una función pura de las dos, sin estado acumulado. Criterio de aceptación explícito: con un vivo el intervalo es menor que con 55.               |
| **Una bala enemiga por columna al azar** puede dejar al jugador sin nada que esquivar si la elección es mala.  | La columna se elige entre las que tienen alguien vivo, no entre las once. Con la formación casi limpia el ritmo lo lleva la velocidad, no el fuego. |
| **El disparo con `wasPressed`** es donde fallan los motores que confían en el auto-repeat.                     | El contrato lo prohíbe explícitamente (invariante 5) y el mando táctil manda un solo `keydown`: `verificaMando` lo despacha y exige el efecto.      |
| **Escala de puntuación** mucho menor que la de CAÍDA.                                                          | El Salón compara por juego. No hay nada que corregir.                                                                                               |

---

## Lo que **no** está en esta spec

- El sonido de INVASORES.
- El modo de dos jugadores por turnos.
- El top 10 real del detalle `/juego/invasores`, que sigue siendo `seededScores`.
- El campo `best` del catálogo, que sigue siendo mock.
- La auditoría móvil, que es trabajo de `mobile-porter`.
- Pasar la fila de `invasores` a `implementado` en `.claude/memoria/game-planner.md`: eso se
  hace al implementar, no al escribir la spec.
