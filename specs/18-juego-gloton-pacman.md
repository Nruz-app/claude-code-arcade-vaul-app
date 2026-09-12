# SPEC 18 — GLOTÓN: el sexto juego real

> **Estado:** Implementado
> **Depende de:** SPEC 05, SPEC 06, SPEC 13, SPEC 14
> **Fecha:** 2026-09-10
> **Objetivo:** Escribir desde cero un motor de Pac-Man en TypeScript sobre canvas —laberinto original de 28×31, las cuatro personalidades de fantasma y la alternancia scatter/chase— y registrarlo como el juego `gloton` con **un único aspecto, el clásico**, sin tocar el reproductor ni el Salón de la Fama.

---

## Por qué existe esta spec

`gloton` lleva en el catálogo desde la SPEC 01 —_«GLOTÓN · Devora puntos y escapa de los
fantasmas»_, categoría `ARCADE`, acento `yellow`, portada `cover-glot`— pero cae en el
reproductor simulado: hoy es un `setInterval` que sube un número. Esta spec lo convierte en
el sexto juego real, tras ROCAS, CAÍDA, BLOQUE BUSTER, SERPENTINA y RANARIA.

Lo eligió el usuario el 2026-09-10 sobre la recomendación de `game-planner`, y **no por
puntuación**: `gloton` empata a 31/35 con `invasores` y va detrás de `flujo` (33/35). Ganó
por objetivo — se pidió el juego grande, y la propia memoria del agente ya lo señalaba como
«el candidato natural cuando el objetivo sea un juego grande y no uno barato».

Se diferencia de los cinco anteriores en tres cosas, y las tres son el motivo de que esta
spec sea más larga que la 10:

1. **Es el primer juego con adversarios que piensan.** Los asteroides de ROCAS flotan, los
   coches de RANARIA van en línea recta y la fruta de SERPENTINA no se mueve. Aquí hay
   cuatro agentes con una función de destino cada uno y una máquina de estados global que
   los conmuta. Es el grueso del coste.
2. **Es el primero con un mapa tabulado.** El laberinto no se genera: se transcribe, celda a
   celda, de un trazado fijo de 28×31. Eso mueve el riesgo del algoritmo al dato, y por eso
   los criterios de aceptación cuentan puntos y píldoras en vez de mirarlos.
3. **Es el primero con un solo aspecto.** Los cinco motores existentes declaran una
   `FichaDeSkins` con `neon`, `retro` y `clasico`. GLOTÓN declara **una sola paleta, la
   clásica**, por decisión explícita del usuario. Es una excepción consciente a la
   invariante 10 de `contrato.md` y está razonada abajo, en Decisiones.

---

## Alcance

**Dentro:**

- `app/lib/games/pacman.ts` — el motor entero contra `GameFactory`, en un solo archivo, sin
  estado a nivel de módulo.
- El laberinto original de **28 columnas × 31 filas**, transcrito como matriz de caracteres:
  240 puntos, 4 píldoras, la casa de fantasmas central y el túnel lateral de la fila 14.
- **Pac-Man**: movimiento continuo sobre la rejilla con dirección pendiente (se puede pedir
  un giro antes de llegar al cruce), bloqueo contra muro y cruce del túnel.
- **Los cuatro fantasmas con sus personalidades canónicas**: Blinky persigue la casilla de
  Pac-Man; Pinky apunta cuatro casillas por delante; Inky refleja la posición de Blinky
  sobre el punto de Pinky; Clyde persigue si está a más de 8 casillas y se retira a su
  esquina si está más cerca.
- **La máquina de modos**: alternancia `scatter`/`chase` por tabla de tiempos, más el modo
  `frightened` que dispara la píldora y que **no consume** el reloj de scatter/chase.
- **Ojos que vuelven a casa**: un fantasma comido pasa a estado `eyes`, viaja a la casa
  central a velocidad alta y allí se regenera.
- **Frutas bonus**: aparecen bajo la casa al llevar 70 y 170 puntos comidos, duran ~9 s y
  puntúan según el nivel (cereza 100 → llave 5000).
- **Túnel lateral**: los pasillos de la fila 14 conectan ambos bordes; los fantasmas lo
  cruzan a velocidad reducida, que es el recurso de huida clásico.
- Puntuación clásica, vidas (3, con vida extra a 10 000) y niveles (uno por laberinto
  limpiado), emitidos por `onScore`, `onLives` y `onLevel`.
- **Una sola paleta**, la clásica, como constante del motor: mapa plano rol → color CSS, sin
  literales sueltos en el dibujo y pasada por argumento a cada función que pinta.
- Registro en `app/lib/games/registry.ts`: `GAME_ENGINES`, `GAME_CONTROLS` y `GAME_TOUCH`.
- `tests/games/pacman.test.ts` con `verificaContrato` y `verificaMando`, más las pruebas
  propias del juego.

**Fuera, explícitamente:**

- **`GAME_PALETAS` y `verificaSkins`.** GLOTÓN no declara ficha de skins; ver Decisiones. El
  selector de ASPECTO no aparecerá en su overlay, y es lo esperado.
- **Sonido.** ROCAS, CAÍDA y SERPENTINA son mudos; GLOTÓN también. El _waka-waka_ y la
  sirena de fondo son una spec aparte, como lo fueron la 11 y la 12.
- **Sprites.** Todo se dibuja con primitivas del canvas: arcos, rectángulos y trazos. No se
  copia ningún asset a `public/`.
- **Modo cutscene** — las intermedias entre niveles del original.
- **El bug del nivel 256**, el _split screen_ del arcade original. Es folclore, no mecánica.
- **El top 10 del detalle** `/juego/gloton`, que sigue siendo `seededScores(seed)`.
- **El campo `best` de `GAMES`**, que sigue siendo mock (96 400).
- **El reproductor** (`app/juego/[id]/jugar/page.tsx`), **`types.ts`** y **Supabase**: no se
  toca ninguno. Un juego nuevo no necesita migración.
- **La entrada del catálogo y la portada**: `gloton` ya está entero en `GAMES`
  (`app/lib/data.ts:61`) y `cover-glot` ya existe en `app/globals.css:757`.

---

## Modelo de datos

### Archivos que aparecen o cambian

| Archivo                           | Qué pasa                                                      |
| --------------------------------- | ------------------------------------------------------------- |
| `app/lib/games/pacman.ts`         | **Nuevo.** El motor entero.                                   |
| `app/lib/games/registry.ts`       | Tres entradas: `GAME_ENGINES`, `GAME_CONTROLS`, `GAME_TOUCH`. |
| `tests/games/pacman.test.ts`      | **Nuevo.** Suites compartidas + lo propio.                    |
| `specs/18-juego-gloton-pacman.md` | Esta spec.                                                    |

**Ninguna migración de Supabase.** `game_id` es texto libre en `game_sessions` y las
pestañas del Salón salen de `GAMES`, así que `gloton` aparece en su ranking sin SQL.

### Geometría

```ts
const COLS = 28;
const FILAS = 31;
const CELDA = 18; // px
const ANCHO_MAPA = COLS * CELDA; // 504
const ALTO_MAPA = FILAS * CELDA; // 558
const OFFSET_X = (800 - ANCHO_MAPA) / 2; // 148
const OFFSET_Y = (600 - ALTO_MAPA) / 2; // 21
```

El canvas es **800×600**, como los cinco motores anteriores: el reproductor lo fija en el
JSX y `.crt-screen` declara `aspect-ratio: 4/3`. El mapa no llena el ancho —sobran 148 px a
cada lado— y eso es correcto: el laberinto de Pac-Man es vertical, y estirarlo para tapar
las bandas deformaría un trazado que la gente reconoce. Las bandas se pintan del color de
fondo, no de otro.

### El laberinto

Matriz de 31 cadenas de 28 caracteres, constante dentro del motor:

| Carácter  | Significado                    |
| --------- | ------------------------------ |
| `#`       | Muro                           |
| `.`       | Punto (10 pts)                 |
| `o`       | Píldora (50 pts)               |
| (espacio) | Pasillo vacío                  |
| `-`       | Puerta de la casa de fantasmas |
| `T`       | Boca de túnel                  |

Invariantes del trazado, que son lo que verifican los criterios de aceptación en vez de
mirar el dibujo:

- Exactamente **240 puntos** y **4 píldoras** (244 comestibles). Es el recuento del original
  y es lo que hace que «laberinto limpio» sea un número y no una impresión.
- Las cuatro píldoras van en las esquinas: filas 3 y 23, columnas 1 y 26.
- **Simetría especular** izquierda/derecha: la columna `c` y la `27 - c` son iguales.
- La casa de fantasmas ocupa las filas 13–15, columnas 10–17, con la puerta (`-`) en la fila 12.
- El túnel está en la **fila 14** y sus dos bocas son las columnas 0 y 27.
- Ninguna celda transitable queda aislada: desde la casilla de salida de Pac-Man (fila 23,
  columna 13,5) se alcanzan las 244.

La matriz es **dato, no lógica**: se transcribe una vez y las pruebas la cuentan.

### Velocidades

En celdas por segundo, para que no dependan del tamaño de celda:

```ts
const VEL_GLOTON = 8.0; // sube 0.3 por nivel, tope 11
const VEL_FANTASMA = 7.5; // sube 0.3 por nivel, tope 10.5
const VEL_ASUSTADO = 4.0; // constante
const VEL_OJOS = 16.0; // constante
const VEL_TUNEL = 3.5; // solo fantasmas, dentro del túnel
```

### Modos de los fantasmas

```ts
type ModoFantasma = "scatter" | "chase" | "frightened" | "eyes";
```

Tabla de tramos del nivel 1, en segundos (los niveles altos acortan los `scatter`):

```
scatter 7 → chase 20 → scatter 7 → chase 20 → scatter 5 → chase 20 → scatter 5 → chase ∞
```

Reglas que no son obvias y que el original tiene:

- `frightened` **no consume** el reloj de tramos: al acabar, los fantasmas vuelven al modo
  que tocaba. Sin esto, encadenar píldoras congelaría el juego en `scatter` para siempre.
- Un cambio de tramo **invierte la dirección** del fantasma en el sitio. Es el aviso visual
  de que el modo cambió, y sin él la conmutación es invisible.
- `eyes` ignora `frightened`: unos ojos no se asustan.
- Duración de `frightened`: 6 s en el nivel 1, −0,5 s por nivel, mínimo 1 s; a partir del
  nivel 13 la píldora deja de asustar y solo puntúa.

### Personalidades

Cada fantasma es una función de destino; el resto —elegir en el cruce la salida que minimiza
la distancia euclídea al destino, sin invertir el sentido— es común a los cuatro.

| Fantasma | Color   | Esquina (`scatter`) | Destino en `chase`                                             |
| -------- | ------- | ------------------- | -------------------------------------------------------------- |
| Blinky   | rojo    | arriba derecha      | La casilla de Pac-Man.                                         |
| Pinky    | rosa    | arriba izquierda    | 4 casillas por delante de Pac-Man.                             |
| Inky     | cian    | abajo derecha       | El reflejo de Blinky sobre el punto 2 casillas delante de Pac. |
| Clyde    | naranja | abajo izquierda     | Pac-Man si está a más de 8 casillas; su esquina si está menos. |

### Puntuación

| Concepto          | Puntos                                                        |
| ----------------- | ------------------------------------------------------------- |
| Punto             | 10                                                            |
| Píldora           | 50                                                            |
| Fantasma (cadena) | 200 → 400 → 800 → 1600, reinicia por píldora                  |
| Fruta             | 100 / 300 / 500 / 700 / 1000 / 2000 / 3000 / 5000 según nivel |
| Vida extra        | a los 10 000 puntos, una sola vez                             |

Una partida competente ronda los 8 000–15 000 por nivel. Es la escala de RANARIA y ROCAS, no
la de CAÍDA (184 220 en el Salón), y no hace falta corregirla: el Salón compara **por
juego**, cada uno en su pestaña.

### Colores — la paleta única

Un mapa plano rol → cadena CSS, con la misma disciplina que exige la invariante 10 salvo que
hay **una** paleta en vez de tres:

```ts
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
```

Las dos reglas de la invariante 10 que **sí** se mantienen: cero literales de color en el
dibujo —ningún `ctx.fillStyle = "#…"` fuera de esta constante— y la paleta baja por argumento
a cada función que pinta, sin leerse de un global.

### Estado interno

```ts
interface Gloton {
  x: number;
  y: number; // en celdas, con decimales
  dir: Direccion;
  dirPedida: Direccion | null;
  boca: number; // fase de la animación
}

interface Fantasma {
  id: "blinky" | "pinky" | "inky" | "clyde";
  x: number;
  y: number;
  dir: Direccion;
  modo: ModoFantasma;
  enCasa: boolean;
  puntosParaSalir: number;
}
```

Todo vive en el closure de la factory. **Nada a nivel de módulo** salvo las constantes
inmutables (el mapa, la paleta, las tablas): en Next un global sobrevive entre montajes.

### Lo que emite

| Callback     | Cuándo                                                                      |
| ------------ | --------------------------------------------------------------------------- |
| `onScore`    | Al cambiar la puntuación: punto, píldora, fantasma, fruta.                  |
| `onLives`    | 3 al empezar; al morir; +1 al llegar a 10 000; 0 al terminar.               |
| `onLevel`    | 1 al empezar; +1 al limpiar el laberinto.                                   |
| `onGameOver` | `GameOverSummary` con `score`, `level`, `durationMs` sin pausas y `reason`. |

`reason` es `"game_over"` al perder la última vida y `"surrender"` solo desde `end()`. GLOTÓN
**no se puede ganar**: los niveles no se acaban, así que no hay un tercer motivo que mapear
—que es lo que obligó a BLOQUE BUSTER a registrar la victoria como `game_over`.

---

## Plan de implementación

Cada paso deja la app compilando y `npm run test:run` en verde.

1. **El mapa y el dibujo estático.** Transcribir la matriz de 28×31, escribir
   `PALETA_CLASICA` y dibujar laberinto, puntos y píldoras centrados en el canvas de 800×600.
   Sin movimiento.
   _Verificación:_ la prueba cuenta 240 puntos, 4 píldoras y la simetría especular.

2. **Pac-Man se mueve.** Movimiento continuo sobre la rejilla, dirección pendiente que se
   aplica al llegar al centro de una celda, bloqueo contra muro, cruce del túnel, animación
   de boca. Teclado encapsulado (flechas + WASD) con `preventDefault` y limpieza en
   `destroy()`.
   _Verificación:_ `verificaMando` despacha los cuatro `code` declarados y los consume.

3. **Comer.** Puntos, píldoras, `onScore` solo al cambiar, y detección de laberinto limpio →
   `onLevel`, reconstrucción del mapa y reposición de todos.

4. **Los fantasmas se mueven.** Los cuatro con la regla común de cruce (minimizar distancia
   al destino sin invertir el sentido) y las cuatro funciones de destino. Salida escalonada
   de la casa por puntos comidos.

5. **La máquina de modos.** Tabla de tramos `scatter`/`chase`, inversión de dirección al
   conmutar, `frightened` con su reloj propio que no consume el de tramos, y el parpadeo
   final. Colisión con fantasma: muerte o cadena de 200/400/800/1600.

6. **Ojos, frutas y vidas.** El estado `eyes` con su viaje a casa y regeneración; la fruta a
   los 70 y 170 puntos comidos; las 3 vidas con `onLives`, la vida extra a 10 000 y el
   `onGameOver` al perder la última.

7. **Registro y pruebas.** Las tres entradas de `registry.ts` y `tests/games/pacman.test.ts`
   con `verificaContrato`, `verificaMando` y lo propio del juego.

8. **Verificación final.** `npm run test:run`, `npm run lint`, `npm run build` y una partida
   real con Playwright en `/juego/gloton/jugar`.

---

## Criterios de aceptación

### Build

- [ ] `npm run test:run` en verde, incluida la suite nueva.
- [ ] `npm run lint` sin errores ni avisos nuevos.
- [ ] `npm run build` completa con Turbopack.
- [ ] `npx tsc --noEmit` sin errores.

### El laberinto

- [ ] La matriz tiene 31 filas de exactamente 28 caracteres.
- [ ] Contiene exactamente 240 puntos y 4 píldoras.
- [ ] Es simétrica: la columna `c` y la `27 - c` coinciden.
- [ ] Las 244 celdas comestibles son alcanzables desde la casilla de salida de Pac-Man.
- [ ] El mapa se dibuja centrado en el canvas de 800×600, sin deformarse.

### El juego funciona

- [ ] Pac-Man se mueve con flechas y con WASD, y no atraviesa muros.
- [ ] Un giro pedido antes de llegar al cruce se aplica al llegar, no se pierde.
- [ ] El túnel de la fila 14 conecta ambos bordes en los dos sentidos.
- [ ] Comer un punto suma 10 y una píldora 50, y `onScore` se emite solo al cambiar.
- [ ] Limpiar las 244 sube de nivel, emite `onLevel` y repone mapa y personajes.
- [ ] Los cuatro fantasmas salen de la casa de forma escalonada.
- [ ] Cada fantasma persigue su destino: Blinky la casilla de Pac-Man, Pinky cuatro por
      delante, Inky el reflejo sobre Blinky, Clyde se retira a menos de 8 casillas.
- [ ] Un fantasma nunca invierte el sentido salvo al cambiar de tramo.
- [ ] La alternancia `scatter`/`chase` sigue la tabla y la conmutación invierte la dirección.
- [ ] La píldora pone a los fantasmas en `frightened` y los hace huir.
- [ ] `frightened` no consume el reloj de tramos: al acabar se vuelve al modo que tocaba.
- [ ] La cadena de fantasmas puntúa 200/400/800/1600 y reinicia con cada píldora.
- [ ] Un fantasma comido pasa a `eyes`, vuelve a casa y se regenera.
- [ ] Unos ojos no se asustan con una píldora nueva.
- [ ] La fruta aparece a los 70 y 170 puntos comidos y se va sola a los ~9 s.
- [ ] Chocar con un fantasma en `chase` o `scatter` cuesta una vida.
- [ ] A los 10 000 puntos se gana una vida y `onLives` lo refleja.
- [ ] Perder la última vida emite `onLives(0)` y luego `onGameOver` con `"game_over"`.

### Integración con la plataforma

- [ ] `gloton` está en `GAME_ENGINES`, `GAME_CONTROLS` y `GAME_TOUCH`.
- [ ] El overlay de arranque anuncia los controles de GLOTÓN, no los de otro juego.
- [ ] **El overlay NO muestra el selector de ASPECTO**, porque `gloton` no está en
      `GAME_PALETAS`. Es el resultado buscado, no un fallo.
- [ ] El HUD de la plataforma mueve puntuación, vidas y nivel al jugar.
- [ ] `Escape`, `blur` y cambio de pestaña pausan; el tiempo en pausa no cuenta en
      `durationMs`.
- [ ] El mando táctil mueve a Pac-Man en las cuatro direcciones.
- [ ] Con sesión iniciada, terminar una partida la registra y aparece en `/salon`.
- [ ] Salir de la pantalla y volver arranca una partida limpia, sin doble velocidad.

### Lo que no debe romperse

- [ ] `app/juego/[id]/jugar/page.tsx` no se toca.
- [ ] `app/lib/games/types.ts` no se toca.
- [ ] Los cinco motores existentes siguen con sus pruebas en verde, skins incluidas.
- [ ] `registry.test.ts` sigue en verde con un motor que no tiene ficha de skins.
- [ ] No hay migración nueva en `supabase/migrations/`.

---

## Decisiones

- **Sí: un único aspecto, el clásico.** GLOTÓN no declara `FichaDeSkins` ni entra en
  `GAME_PALETAS`, así que `tieneSkins` es `false` en el reproductor
  (`app/juego/[id]/jugar/page.tsx:35`) y el selector de ASPECTO no se dibuja. Es una
  excepción deliberada a la invariante 10 de `contrato.md`, pedida por el usuario, y tiene un
  argumento propio: los colores de Pac-Man **son** el juego. El azul `#2121de` del laberinto
  y el rojo, rosa, cian y naranja de los cuatro fantasmas no son un tema aplicado encima de
  unas formas, son cómo se distingue a Blinky de Clyde. Una versión ámbar monocroma —que es
  lo que `retro` significa en este repo— borraría esa distinción y con ella la lectura
  táctica que costó implementar en el paso 5.
- **Sí: la disciplina de la paleta se mantiene aunque no haya ficha.** Un mapa plano rol →
  color, cero literales en el dibujo y la paleta por argumento. Lo que se pierde al no tener
  ficha es la comprobación automática (`verificaSkins` mide contraste y caza literales
  sueltos), así que el archivo de pruebas la sustituye por una propia: monta el motor, juega
  unos fotogramas y comprueba contra el Proxy de `tests/harness/canvas.ts` que **todo** color
  que llegó a `fillStyle`/`strokeStyle` sale de `PALETA_CLASICA`. Sin esto, «un solo tema»
  sería sinónimo de «colores a mano por todo el archivo».
- **Sí: el trazado original transcrito, no generado.** Es dato, y el dato se verifica
  contando. Un laberinto generado tendría que demostrar que es jugable en cada partida; este
  solo tiene que demostrar que se copió bien.
- **Sí: las cuatro personalidades canónicas.** Es lo que separa a Pac-Man de un juego de
  perseguir. Sin Pinky emboscando y sin Clyde retirándose, los cuatro fantasmas convergen y
  el juego se reduce a correr en círculos.
- **Sí: el mapa no llena el ancho.** Sobran 148 px a cada lado en el canvas de 800×600.
  Estirar el laberinto a 4:3 deformaría un trazado que la gente reconoce de memoria.
- **Sí: velocidades en celdas por segundo.** Desacopla la dificultad del tamaño de celda: si
  algún día `CELDA` cambia, el juego se comporta igual.
- **No: sonido.** Tres de los cinco motores son mudos y esto ya es el juego más caro del
  catálogo. El _waka-waka_ y la sirena van en su propia spec, como la 11 y la 12.
- **No: sprites.** Pac-Man es un arco y un fantasma es un rectángulo redondeado con festón.
  Dibujarlo con primitivas evita la carga asíncrona que SERPENTINA tuvo que absorber.
- **No: `ESPACIO` para nada.** Es la tecla que abre la partida desde el overlay y la de los
  botones redondos del mando. GLOTÓN no la necesita: se mueve y ya está, como SERPENTINA y
  RANARIA.
- **No: cutscenes entre niveles.** Son animación, no mecánica, y el reproductor no tiene
  dónde ponerlas.
- **No: tocar el reproductor.** Si algo parece pedirlo, es que el motor está haciendo el
  trabajo de la plataforma.

---

## Riesgos

| Riesgo                                                                                                 | Mitigación                                                                                                                                                 |
| ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Transcribir mal el laberinto.** 868 caracteres a mano; un muro de más deja 244 puntos inalcanzables. | Los criterios cuentan puntos, píldoras y simetría, y comprueban alcanzabilidad desde la salida. Un error de trazado falla la suite, no la vista.           |
| **La IA de los fantasmas es el 60 % del motor** y es donde se va el presupuesto.                       | El paso 4 los deja moviéndose con la regla común antes de que el paso 5 añada los modos. Cada paso es jugable por separado.                                |
| **`frightened` consumiendo el reloj de tramos** — el fallo clásico al implementarlo.                   | Criterio de aceptación explícito y prueba propia: encadenar dos píldoras no debe dejar el juego en `scatter`.                                              |
| **Fantasmas que oscilan** en un cruce por invertir el sentido cada fotograma.                          | La regla común prohíbe la inversión salvo al conmutar de tramo. Es una invariante, no un ajuste.                                                           |
| **El sexto motor sin ficha de skins** deja de estar cubierto por `verificaSkins`.                      | La prueba propia de literales lo compensa. Y queda anotado: si algún día GLOTÓN quiere sus tres aspectos, `skin-designer` tiene el trabajo hecho a medias. |
| **Escala de puntuación** distinta a CAÍDA.                                                             | El Salón compara por juego, cada uno en su pestaña. No hay nada que corregir.                                                                              |

---

## Lo que **no** está en esta spec

- El sonido de GLOTÓN.
- Los tres aspectos (`neon`, `retro`, `clasico`) y su entrada en `GAME_PALETAS`.
- El top 10 real del detalle `/juego/gloton`, que sigue siendo `seededScores`.
- El campo `best` del catálogo, que sigue siendo mock.
- La auditoría móvil de las dos rutas nuevas, que es trabajo de `mobile-porter`.
