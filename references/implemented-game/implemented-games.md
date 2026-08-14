# Juegos implementados — Arcade Vault

> **Fecha:** 2026-08-13 (revisado el 2026-08-14 al implementarse RANARIA)
> **Fuente:** `GAME_ENGINES` (`app/lib/games/registry.ts`), los motores de
> `app/lib/games/` y una consulta a `game_sessions` en Supabase.

El catálogo (`GAMES`, en `app/lib/data.ts`) tiene **ocho juegos**, pero solo
**cinco tienen motor real**: corren sobre un canvas, se juegan de verdad y sus
partidas se registran en la base de datos. Los otros tres siguen cayendo en el
reproductor simulado, que es un `setInterval` subiendo un número.

La lista de abajo son los cinco reales. La base de datos lo confirma: en
`game_sessions` hay partidas registradas con exactamente esos cinco `game_id`
y ninguno más.

---

## Resumen

| Juego             | Id              | Clásico   | Categoría | Motor          | Spec                      | Vidas     |
| ----------------- | --------------- | --------- | --------- | -------------- | ------------------------- | --------- |
| **ROCAS**         | `rocas`         | Asteroids | SHOOTER   | `asteroids.ts` | 05                        | 3         |
| **CAÍDA**         | `caida`         | Tetris    | PUZZLE    | `tetris.ts`    | 08                        | — (1 → 0) |
| **BLOQUE BUSTER** | `bloque-buster` | Arkanoid  | ARCADE    | `arkanoid.ts`  | 09                        | 3         |
| **SERPENTINA**    | `serpentina`    | Snake     | ARCADE    | `snake.ts`     | 10                        | — (1 → 0) |
| **RANARIA**       | `ranaria`       | Frogger   | ARCADE    | `frogger.ts`   | `game-jam/ranaria/` + 11  | 3         |

Los ids están en español a propósito y no delatan el clásico que son. Son los
slugs de las URLs: `/juego/serpentina` y `/juego/serpentina/jugar`.

Los cinco comparten plataforma: canvas de **800×600**, la partida no arranca
hasta pulsar **ESPACIO** en el overlay, `ESC` pausa y reanuda, cambiar de
pestaña pausa solo, y al terminar se abre el modal de fin. Nada de eso lo
implementa el juego: lo pone el reproductor.

**Solo RANARIA suena.** Los otros cuatro son mudos, y el sonido lo dispara el
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

## Partidas registradas

Consulta a `game_sessions` del **14/08/2026** (fechas en UTC). Son datos de
desarrollo, de las pruebas de cada spec, no de uso real:

| Juego         | Partidas | Jugadores | Mejor score | Nivel máx. | Duración media | Última partida |
| ------------- | -------- | --------- | ----------- | ---------- | -------------- | -------------- |
| RANARIA       | 10       | 1         | 275         | 1          | 18 s           | 14/08/2026     |
| ROCAS         | 9        | 4         | 6 050       | 3          | 28 s           | 10/08/2026     |
| SERPENTINA    | 2        | 1         | 850         | 2          | 19 s           | 13/08/2026     |
| BLOQUE BUSTER | 1        | 1         | 400         | 1          | 7 s            | 13/08/2026     |
| CAÍDA         | 1        | 1         | 110         | 1          | 19 s           | 12/08/2026     |

**23 partidas en total.** Ningún otro `game_id` aparece en la tabla, lo que
confirma que los tres simulados no registran nada.

RANARIA es ya el más jugado en número de partidas —diez en su primer día, todas
del mismo jugador y ninguna pasando de nivel 1— y el de peor score máximo. Es lo
que se espera de un juego recién ajustado, no una señal de dificultad mal puesta:
con 275 puntos ni siquiera se llenó una vez la meta, que son 2000 × nivel.

> **Ojo con el campo `best` de `GAMES`** (`app/lib/data.ts`): sigue siendo mock.
> Las tarjetas del catálogo anuncian 41 200 para ROCAS o 7 820 para SERPENTINA,
> pero las marcas reales son las de la tabla de arriba. Lo mismo con `plays`
> ("15.6K", "9.1K"…). El único dato real es el que sale de `game_sessions`, y es
> lo que muestra el Salón de la Fama.

---

## Pendientes

Los tres que siguen con el reproductor simulado. El id ya existe en `GAMES`:
al implementarlos hay que usar ese, no inventar uno nuevo.

| Juego       | Id            | Clásico        | Categoría |
| ----------- | ------------- | -------------- | --------- |
| GLOTÓN      | `gloton`      | Pac-Man        | ARCADE    |
| INVASORES   | `invasores`   | Space Invaders | SHOOTER   |
| DUELO PIXEL | `duelo-pixel` | Pong           | VERSUS    |

Ninguno tiene código de referencia: como SERPENTINA y RANARIA, habría que
escribirlos enteros con las mecánicas fijadas en su spec.

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
2. Registrarlo en `app/lib/games/registry.ts`: una línea en `GAME_ENGINES` y
   otra en `GAME_CONTROLS` con las teclas que anunciará el overlay.
3. Añadir `tests/games/<juego>.test.ts`. Con una línea
   —`verificaContrato("NOMBRE", createXGame)`— hereda las 27 comprobaciones del
   contrato, y encima va solo lo propio del juego.

Lo hace la skill `/nuevo-juego`; sus invariantes están en
`.claude/skills/nuevo-juego/contrato.md`. La spec puede venir también del agente
`game-jam`, que es de donde salió RANARIA.
