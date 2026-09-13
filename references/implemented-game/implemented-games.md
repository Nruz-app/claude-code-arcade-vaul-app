# Juegos implementados — Arcade Vault

> **Fecha:** 2026-08-13 (revisado el 2026-09-12 al implementarse INVASORES)
> **Fuente:** `GAME_ENGINES` (`app/lib/games/registry.ts`), los motores de
> `app/lib/games/` y una consulta a `game_sessions` en Supabase.

El catálogo (`GAMES`, en `app/lib/data.ts`) tiene **ocho juegos**, y ya
**siete tienen motor real**: corren sobre un canvas, se juegan de verdad y sus
partidas se registran en la base de datos. Solo queda uno (`duelo-pixel`)
cayendo en el reproductor simulado, que es un `setInterval` subiendo un número
— y sigue bloqueado por diseño, porque su marcador 0–11 no compara con el resto
del Salón.

La lista de abajo son los siete reales. **La base de datos ya no sirve para
confirmarlo**: hoy solo hay partidas de cinco `game_id`, porque el proyecto de
Supabase se recreó (SPEC 15) y las partidas anteriores no se migraron. Que un
juego no tenga filas en `game_sessions` dice que nadie lo ha jugado desde la
mudanza, no que le falte motor. La fuente de verdad de qué tiene motor es
`GAME_ENGINES`.

---

## Resumen

| Juego             | Id              | Clásico   | Categoría | Motor          | Spec                      | Vidas     |
| ----------------- | --------------- | --------- | --------- | -------------- | ------------------------- | --------- |
| **ROCAS**         | `rocas`         | Asteroids | SHOOTER   | `asteroids.ts` | 05                        | 3         |
| **CAÍDA**         | `caida`         | Tetris    | PUZZLE    | `tetris.ts`    | 08                        | — (1 → 0) |
| **BLOQUE BUSTER** | `bloque-buster` | Arkanoid  | ARCADE    | `arkanoid.ts`  | 09                        | 3         |
| **SERPENTINA**    | `serpentina`    | Snake     | ARCADE    | `snake.ts`     | 10                        | — (1 → 0) |
| **RANARIA**       | `ranaria`       | Frogger   | ARCADE    | `frogger.ts`   | `game-jam/ranaria/` + 11  | 3         |
| **GLOTÓN**        | `gloton`        | Pac-Man   | ARCADE    | `pacman.ts`    | 18                        | 3         |
| **INVASORES**     | `invasores`     | Space Inv. | SHOOTER   | `invaders.ts`  | 21                        | 3         |

Los ids están en español a propósito y no delatan el clásico que son. Son los
slugs de las URLs: `/juego/serpentina` y `/juego/serpentina/jugar`.

Los siete comparten plataforma: canvas de **800×600**, la partida no arranca
hasta pulsar **ESPACIO** en el overlay, `ESC` pausa y reanuda, cambiar de
pestaña pausa solo, y al terminar se abre el modal de fin. Nada de eso lo
implementa el juego: lo pone el reproductor.

**Solo RANARIA y BLOQUE BUSTER suenan.** Los otros cinco son mudos, y el sonido lo dispara el
motor con `crearSfx()` (`app/lib/games/audio.ts`), nunca el reproductor.

---

## ROCAS — `rocas`

Asteroids. **El primero que se implementó** (SPEC 05) y el que fijó el contrato
que cumplen todos los demás. Portado de
`references/templates/started-games/02-asteroids/`.

- **Motor:** `app/lib/games/asteroids.ts` (703 líneas)
- **Controles:** `← →` rotar · `↑` propulsar · `ESPACIO` disparar · `ESC` pausa
- **Puntuación:** por tamaño de roca — grande 20, mediana 50, pequeña 100. La
  roca grande se parte en fragmentos, así que pulverizarla entera renta más que
  el disparo inicial.
- **Vidas:** 3. Es el único junto a BLOQUE BUSTER que usa el HUD de corazones
  tal cual.
- **Nivel:** sube al limpiar todos los asteroides de la pantalla.
- **Extras:** power-ups (cae uno por nivel, garantizado al quinto) y OVNIs.

## CAÍDA — `caida`

Tetris. Portado de `references/templates/started-games/03-tetris/`, y la primera
spec escrita con la skill `/nuevo-juego`.

- **Motor:** `app/lib/games/tetris.ts` (774 líneas)
- **Controles:** `← →` mover · `↑ / X` rotar · `↓` bajar · `ESPACIO` soltar ·
  `ESC` pausa
- **Puntuación:** por líneas simultáneas × nivel — 100 / 300 / 500 / **800**
  (tetris). Es el juego que más escala del catálogo.
- **Vidas:** no tiene. Emite `onLives(1)` al empezar y `onLives(0)` al acabar,
  o el HUD se quedaría enseñando tres corazones que no existen.
- **Tablero:** 10 × 20 celdas. Con *wall kicks* al rotar pegado a la pared.
- **Nota de porte:** el original usaba dos canvas (tablero y pieza siguiente);
  como `GameFactory` recibe uno solo, el preview se dibuja en un panel lateral
  del mismo canvas.

## BLOQUE BUSTER — `bloque-buster`

Arkanoid. Portado de `references/templates/started-games/04-arkanoid/`. **Agotó
los juegos de referencia**: no queda ninguno por portar.

- **Motor:** `app/lib/games/arkanoid.ts` (871 líneas)
- **Controles:** `← →` o **ratón** para mover la paleta · `ESC` pausa
- **Puntuación:** 100 × nivel por bloque, más un bonus al limpiar la muralla de
  1000 × nivel y 500 × vidas restantes. Premia terminar el nivel entero sin
  morir.
- **Vidas:** 3.
- **Niveles:** cinco patrones de muralla (10 × 6 bloques) que se reciclan
  indefinidamente; la velocidad depende del número de nivel, no del patrón.
- **Sin ESPACIO a propósito:** la pelota sale sola, así que la tecla que arranca
  la partida desde el overlay no hace nada dentro del juego.
- **Nota de porte:** sin spritesheet ni sonidos — los bloques, la paleta y la
  pelota se dibujan con formas y la paleta neón del tema, porque cargar una
  imagen es asíncrono y `GameFactory` es síncrona.

## SERPENTINA — `serpentina`

Snake. Distinto de los tres anteriores en dos cosas: no es un porte —no había
código de referencia, las mecánicas las fija la SPEC 10— y es **el primero con
sprites**.

- **Motor:** `app/lib/games/snake.ts` (843 líneas)
- **Controles:** `← → ↑ ↓` o `W A S D` para girar · `ESC` pausa
- **Puntuación:** por rareza de la fruta × nivel, y la rareza decide a la vez
  cuánto puntúa y cuánto alarga:

  | Rareza    | Puntos      | Crece | Probabilidad | Frutas |
  | --------- | ----------- | ----- | ------------ | ------ |
  | Común     | 50 × nivel  | +1    | 65 %         | 12     |
  | Rara      | 150 × nivel | +2    | 27 %         | 7      |
  | Exótica   | 300 × nivel | +3    | 8 %          | 3      |

  La fruta que más puntúa es la que más te estorba después: riesgo y recompensa
  van en la misma decisión.
- **Vidas:** no tiene, igual que CAÍDA (1 → 0).
- **Tablero:** 32 × 24 celdas de 25 px — la única combinación redonda que llena
  800×600 exacto, sin bandas negras.
- **Reglas:** los cuatro bordes son pared y matan, morderse también, y la
  serpiente **arranca ya en movimiento** hacia la derecha (si esperase a la
  primera tecla, se podría dejar la partida quieta e inflar el `duration_ms`).
- **Velocidad:** empieza en 145 ms por paso y baja 8 ms por nivel hasta un tope
  de 55 ms. Sube de nivel cada **5 frutas**.
- **Assets:** `public/snake-fruits.png`, 22 recortes de la fila pixel-art del
  atlas. Mientras el PNG no ha cargado se dibuja un rombo del color de la
  rareza, para que la partida sea jugable desde el primer frame.

## RANARIA — `ranaria`

Frogger. **El más reciente**, y el que rompe dos costumbres del repo: su spec no
salió de `/nuevo-juego` sino del agente `game-jam` a partir del tema «la ranita»
(`specs/game-jam/ranaria/`, seis archivos en vez de un `.md` numerado), y es **el
primer juego con sonido** (SPEC 11).

- **Motor:** `app/lib/games/frogger.ts` (1 173 líneas — el más largo del
  catálogo)
- **Controles:** `← → ↑ ↓` o `W A S D` para saltar · `ESC` pausa
- **Puntuación:** todo × nivel — 25 por cada fila nueva del intento, 500 por
  ocupar un nenúfar, 20 por segundo restante al ocuparlo, 800 por la mosca de
  bonus y 2000 al llenar los cinco nenúfares. El bonus por fila se cobra **una
  vez por fila y por intento**: sin eso, saltar arriba y abajo en la mediana
  sería una máquina de puntos.
- **Vidas:** 3, como ROCAS y BLOQUE BUSTER. Matan los vehículos, el agua, saltar
  a un nenúfar ocupado y que se agote el temporizador del intento.
- **Tablero:** 16 × 12 celdas de 50 px — otra combinación exacta de 800×600. De
  arriba abajo: meta con cinco nenúfares, cuatro carriles de río, mediana
  segura, cinco carriles de carretera y la orilla de salida.
- **El río al revés que la carretera:** ahí el agua mata, así que solo sobrevives
  **encima** de un tronco o una tortuga, que además te arrastran. Las tortugas se
  sumergen cada pocos segundos y avisan parpadeando 1 s antes.
- **Tensión de diseño:** el bonus de tiempo premia cruzar rápido y el río castiga
  cruzar rápido. Las dos cosas tiran a la vez, que es de donde sale la partida.
- **Progresión infinita:** llenar los cinco nenúfares sube el nivel, vacía la
  meta, acorta el temporizador (30 s → 18 s, suelo en el nivel 7) y acelera los
  carriles (tope en el nivel 11). Como en BLOQUE BUSTER, "ganar" no termina la
  partida: no hay techo que rompa el ranking.
- **Assets:** `public/rana-salto.mp3` y `public/rana-choque.mp3`, recortados y
  normalizados por la SPEC 11. Suenan el salto y el atropello; ahogarse no suena.

---

## GLOTÓN — `gloton`

Pac-Man. **El sexto y el más caro de todos** (SPEC 18): 1 326 líneas frente a las
943 de SERPENTINA. Escrito desde cero, sin material de referencia. Lo eligió el
usuario por encima de `flujo`, que iba primero en el roadmap, al pedir el juego
grande.

- **Motor:** `app/lib/games/pacman.ts` (1 326 líneas)
- **Controles:** `← → ↑ ↓` o `W A S D` mover · `ESC` pausa. No usa ESPACIO.
- **Puntuación:** punto 10 · píldora 50 · cadena de fantasmas 200 → 400 → 800 →
  1600 (reinicia con cada píldora) · fruta de 100 a 5000 según el nivel.
- **Vidas:** 3, más una extra a los 10 000 puntos.
- **Nivel:** sube al comerse los 244 comestibles del laberinto. Cada nivel
  acelera a todo el mundo y acorta lo que dura la píldora.
- **Extras:** los cuatro fantasmas con sus personalidades canónicas, alternancia
  scatter/chase por tabla de tiempos, ojos que vuelven a casa, túnel lateral que
  frena a los fantasmas y frutas bonus.

Tres cosas que lo hacen distinto de los otros cinco:

1. **Es el primero con adversarios que piensan.** Los cuatro comparten la regla
   de cruce —elegir la salida que minimiza la distancia al destino, sin invertir
   el sentido— y se diferencian **solo** en su función de destino. De ahí sale
   que se comporten distinto sin tener cuatro algoritmos.
2. **Es el primero con un mapa tabulado.** El laberinto de 28×31 no se genera:
   se transcribe. Eso mueve el riesgo del algoritmo al dato, y por eso sus
   pruebas cuentan (240 puntos, 4 píldoras, simetría especular y un BFS de
   alcanzabilidad) en vez de mirar.
3. **Es el primero con un solo aspecto.** No declara `FichaDeSkins` ni entra en
   `GAME_PALETAS`, así que su overlay **no enseña el selector de ASPECTO**. Es
   decisión del usuario, razonada en la spec: los colores de Pac-Man no son un
   tema encima de unas formas, son cómo se distingue a Blinky de Clyde. A cambio
   no puede heredar `verificaSkins`, y su archivo de pruebas la sustituye por una
   propia que comprueba contra el canvas que ningún color ajeno a la paleta llega
   a pintarse.

---

## INVASORES — `invasores`

Space Invaders. **El séptimo** (SPEC 21) y el primero con **escenario
destruible**. Escrito desde cero, sin material de referencia: los juegos de
`references/templates/started-games/` se agotaron con BLOQUE BUSTER.

- **Motor:** `app/lib/games/invaders.ts` (1479 líneas)
- **Controles:** `← →` mover · `ESPACIO` o `↑` disparar · `ESC` pausa. **Sí usa
  ESPACIO**, como ROCAS: no choca con el overlay de arranque porque cuando la
  partida corre el overlay ya no está montado.
- **Puntuación:** invasor de la fila de arriba 30 · filas centrales 20 · filas de
  abajo 10 · nave nodriza 50/100/150/300 al azar. Una oleada limpia da 990.
- **Vidas:** 3, más una extra a los 1 500 puntos.
- **Nivel:** sube al limpiar los 55 invasores. Cada oleada repone los búnkeres y
  arranca un escalón más abajo, con tope a las ocho.
- **Extras:** cuatro escudos que se erosionan, nave nodriza, una sola bala del
  jugador en vuelo y aceleración de la formación según cuántos quedan vivos.

Cuatro cosas que conviene saber antes de tocarlo:

1. **Es el primero con escenario destruible.** Cada búnker es un `Uint8Array` de
   22×16 celdas que se **reusa** entre oleadas en vez de recrearse, y lo erosionan
   tres agentes distintos: la bala del jugador, la del invasor y el invasor que
   baja hasta él. La dirección importa —una bala que sube revienta la celda más
   baja que toca y una que baja la más alta—, y con un solo criterio el disparo
   propio abriría el boquete en el techo atravesando el resto sin tocarlo.
2. **La formación se mueve a pasos discretos**, como el arcade. De ahí salen dos
   cosas gratis: la animación no necesita reloj propio (el fotograma alterna con
   cada paso) y la aceleración por bajas es una **función** de cuántos quedan
   vivos, no un estado que se pueda desincronizar.
3. **Una sola bala en vuelo**, que es el límite del original y lo que convierte
   el juego en puntería en vez de en cortina de fuego. Se lee con `wasPressed`,
   así que no depende del auto-repeat del sistema — que además el mando táctil no
   manda: al apoyar el dedo llega un solo `keydown`.
4. **Un solo rol de color para los tres tipos de invasor.** En el arcade eran del
   mismo blanco y se distinguen por silueta y por fila; tres roles harían
   imposible declarar honestamente la paleta `clasico`, que es monocroma. Su
   `clasico` reproduce el gabinete del 78, donde el color no lo daba el tubo sino
   dos tiras de celofán: verde en la franja baja y roja arriba.

**El juego es una carrera, y está medida**: sin que nadie dispare, la formación
tarda **282 s** en cruzar la línea del cañón; limpiarla apuntando cuesta unos
**55 s**. Si algún día se toca el ritmo del descenso, ese es el margen que no hay
que romper.

---

## Partidas registradas

Consulta a `game_sessions` del **12/09/2026** (fechas en UTC). Son datos de
desarrollo, de las pruebas de cada spec, no de uso real:

| Juego         | Partidas | Jugadores | Mejor score | Nivel máx. | Duración media | Última partida |
| ------------- | -------- | --------- | ----------- | ---------- | -------------- | -------------- |
| BLOQUE BUSTER | 5        | 1         | 3 900       | 1          | 23 s           | 03/09/2026     |
| CAÍDA         | 2        | 1         | 251         | 1          | 102 s          | 04/09/2026     |
| GLOTÓN        | 1        | 1         | 910         | 1          | 20 s           | 11/09/2026     |
| ROCAS         | 1        | 1         | 3 830       | 2          | 73 s           | 05/09/2026     |
| SERPENTINA    | 1        | 1         | 50          | 1          | 16 s           | 05/09/2026     |

**10 partidas en total**, de cinco `game_id`. **RANARIA e INVASORES no tienen
ninguna**, y eso no dice nada de sus motores: la tabla se vació al recrearse el
proyecto de Supabase (SPEC 15) y desde entonces nadie ha jugado a RANARIA;
INVASORES acaba de nacer, y las partidas con las que se verificó fueron **como
invitado**, que van a `localStorage` y no a la base. La revisión anterior de este
documento (14/08/2026) contaba 23 partidas y afirmaba que los cinco motores de
entonces tenían filas —cierto aquel día, ya no.

Lección para la próxima revisión: **`game_sessions` mide quién ha jugado, no qué
está implementado.** Para lo segundo, `GAME_ENGINES`.

> **Ojo con el campo `best` de `GAMES`** (`app/lib/data.ts`): sigue siendo mock.
> Las tarjetas del catálogo anuncian 41 200 para ROCAS o 7 820 para SERPENTINA,
> pero las marcas reales son las de la tabla de arriba. Lo mismo con `plays`
> ("15.6K", "9.1K"…). El único dato real es el que sale de `game_sessions`, y es
> lo que muestra el Salón de la Fama.

---

## Pendientes

El único que sigue con el reproductor simulado. El id ya existe en `GAMES`:
al implementarlo hay que usar ese, no inventar uno nuevo.

| Juego       | Id            | Clásico | Categoría |
| ----------- | ------------- | ------- | --------- |
| DUELO PIXEL | `duelo-pixel` | Pong    | VERSUS    |

**Y está bloqueado por diseño**, no por coste: su marcador 0–11 no compara con
los 184 220 de CAÍDA en el Salón, así que antes de escribir una línea hay que
inventarle una métrica acumulativa (rally más largo, toques totales). Tampoco
tiene código de referencia: como SERPENTINA, RANARIA, GLOTÓN e INVASORES, habría
que escribirlo entero con las mecánicas fijadas en su spec.

Hay además un segundo candidato que **no está en `GAMES`**: FLUJO (`flujo`, Pipe
Mania), el nº 1 del roadmap por puntuación. Ese sí obliga a crear la entrada del
catálogo y su portada `cover-flujo`. Sería el segundo PUZZLE, que junto a VERSUS
es la categoría más vacía — y tras INVASORES el reparto va ARCADE 4, SHOOTER 2,
PUZZLE 1, VERSUS 0, así que ese argumento sigue intacto y sin gastar.

El orden en que conviene atacarlos, y por qué, está en
`game-suggestions-todo.md`, en esta misma carpeta.

---

## Cómo se añade uno

Un juego nuevo es **un archivo, dos líneas y sus pruebas**. No hay que tocar el
reproductor, ni el contrato de `app/lib/games/types.ts`, ni Supabase, ni el
Salón de la Fama —sus pestañas salen de `GAMES` y `game_id` es texto libre en
`game_sessions`, así que un juego con motor aparece en su ranking sin migración
ni SQL—.

1. Escribir el motor en `app/lib/games/<juego>.ts` cumpliendo `GameFactory`:
   recibe un canvas y cuatro callbacks (`onScore`, `onLives`, `onLevel`,
   `onGameOver`) y devuelve un mando con `start`, `pause`, `resume`, `end` y
   `destroy`.
2. Registrarlo en `app/lib/games/registry.ts`: `GAME_ENGINES` (el motor),
   `GAME_CONTROLS` (las teclas que anunciará el overlay), `GAME_TOUCH` (el mando
   táctil) y `GAME_PALETAS` (la ficha de skins) — esta última **es la única
   opcional**: GLOTÓN no la tiene y por eso no enseña selector de aspecto.
3. Añadir `tests/games/<juego>.test.ts`. Con una línea
   —`verificaContrato("NOMBRE", createXGame)`— hereda las 27 comprobaciones del
   contrato, y encima va solo lo propio del juego.

Lo hace la skill `/nuevo-juego`; sus invariantes están en
`.claude/skills/nuevo-juego/contrato.md`. La spec puede venir también del agente
`game-jam`, que es de donde salió RANARIA.
