# Memoria de game-planner

Registro persistente de las decisiones de catálogo de Arcade Vault. Lo lee y lo escribe el
agente `game-planner` (`.claude/agents/game-planner.md`). **No se borran filas**: lo que
cambia es la columna `Estado`.

Estados posibles:

- `propuesto` — recomendado por el agente, aún sin decisión del usuario.
- `aceptado` — el usuario dio el visto bueno; pendiente de `/nuevo-juego`.
- `descartado` — rechazado. La columna `Razón` explica por qué, y es lo que impide volver a
  proponerlo sin argumentos nuevos.
- `implementado` — tiene motor en `GAME_ENGINES`. Nunca se vuelve a proponer.

`Id` es el del catálogo `GAMES` (`app/lib/data.ts`), en español. `Spec` es el archivo de
`specs/` cuando existe.

| Fecha      | Juego          | Id              | Estado         | Spec                                   | Razón                                                                                                                                                                                                             |
| ---------- | -------------- | --------------- | -------------- | -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-08-13 | Asteroids      | `rocas`         | `implementado` | `05-juego-rocas-asteroids.md`          | Primer juego real. Fijó el contrato `GameFactory` y las convenciones de canvas 800×600.                                                                                                                           |
| 2026-08-13 | Tetris         | `caida`         | `implementado` | `08-juego-caida-tetris.md`             | Primer porte con `/nuevo-juego`. Sin vidas: emite `onLives(1)`/`onLives(0)`.                                                                                                                                      |
| 2026-08-13 | Arkanoid       | `bloque-buster` | `implementado` | `09-juego-bloque-buster-arkanoid.md`   | Agotó los juegos de `references/templates/started-games/`. Ganar se registra como `game_over`.                                                                                                                    |
| 2026-08-13 | Snake          | `serpentina`    | `implementado` | `10-juego-serpentina-snake.md`         | Primero escrito desde cero, sin código de referencia, y primero con sprites (`public/snake-fruits.png`).                                                                                                          |
| 2026-08-13 | Frogger        | `ranaria`       | `implementado` | `specs/game-jam/ranaria/` + `11`       | Ganó con 34/35 y se implementó el mismo día. La spec no salió de `/nuevo-juego` sino del agente `game-jam` (tema: "la ranita"); la SPEC 11 le añadió después el sonido, y es el único juego del portal que suena. |
| 2026-08-13 | Pipe Mania     | `flujo`         | `propuesto`    | —                                      | 33/35, nº 1 del roadmap. **No está en `GAMES`**: pide entrada de catálogo y portada `cover-flujo`, acento `magenta`. Sería el segundo PUZZLE, la categoría más vacía.                                             |
| 2026-08-13 | Space Invaders | `invasores`     | `implementado` | `21-juego-invasores-space-invaders.md` | 31/35, nº 2 del roadmap. Barato, pero repite el «nave que dispara» de ROCAS y quiere `ESPACIO`.                                                                                                                   |
| 2026-08-13 | Pac-Man        | `gloton`        | `implementado` | `18-juego-gloton-pacman.md`            | 31/35, nº 3 del roadmap **por coste, no por valor**: es el mejor juego de la lista y el más caro. Súbelo si el objetivo es un juego grande.                                                                       |
| 2026-08-13 | Pong           | `duelo-pixel`   | `propuesto`    | —                                      | 28/35, nº 4 y **bloqueado por diseño**: el marcador 0–11 no compara en el Salón. No implementar sin resolver antes la métrica de puntuación.                                                                      |

## Candidatos vivos del catálogo (aún sin motor)

Contexto de arranque, no decisiones. Se mueven a la tabla de arriba cuando el agente los
evalúa formalmente.

| Juego          | Id            | Categoría | Nota inicial                                                                            |
| -------------- | ------------- | --------- | --------------------------------------------------------------------------------------- |
| Pac-Man        | `gloton`      | ARCADE    | Laberinto + IA de cuatro fantasmas: el más caro de los que quedan.                      |
| Space Invaders | `invasores`   | SHOOTER   | Mecánica simple; ojo con `ESPACIO`, que el reproductor usa para arrancar la partida.    |
| Pong           | `duelo-pixel` | VERSUS    | Única categoría `VERSUS` del catálogo. Sin segundo jugador, necesita una IA como rival. |

## Notas de sesión

_(el agente añade aquí lo que no cabe en las tablas: criterios que cambiaron, preferencias
del usuario sobre el rumbo del catálogo, huecos detectados)_

- 2026-08-13 — Memoria inicializada al crear el agente. Estado del catálogo: 4 juegos con
  motor, 4 sin él. Ya no queda material en `references/templates/started-games/`, así que
  cualquier propuesta se escribe desde cero, como SERPENTINA.
- 2026-08-13 — **Primera evaluación completa de los cuatro candidatos.** Puntuación sobre 35
  (un canvas / solo teclado / puntuación / fin claro / un jugador / coste / aporte):

  | Candidato     | Total  | Dónde se hunde                                                                                                        |
  | ------------- | ------ | --------------------------------------------------------------------------------------------------------------------- |
  | `ranaria`     | **34** | Ninguno bajo. Solo pierde un punto en puntuación (la clásica de Frogger es escasa y hay que diseñarla).               |
  | `invasores`   | 31     | Aporte 3: es «nave que dispara», lo mismo que ROCAS. Además quiere `ESPACIO`, que abre la partida.                    |
  | `gloton`      | 31     | Coste 2: cuatro fantasmas con IA propia, laberinto y modos. El más caro con diferencia; mejor cuando haya más margen. |
  | `duelo-pixel` | 28     | Puntuación 2: Pong marca 0–11 y el Salón lo compara con los 184 220 de CAÍDA. Y sin rival humano exige IA.            |

  **Ninguno queda descartado**: los tres perdedores siguen vivos, solo que detrás. `gloton`
  es el candidato natural cuando el objetivo sea un juego grande y no uno barato.

- 2026-08-13 — Nota de escala: si `duelo-pixel` se recupera algún día, su puntuación **no**
  puede ser el marcador de sets. Habría que inventar una métrica acumulativa (rally más
  largo, toques totales) o su fila en el Salón queda ridícula al lado del resto.
- 2026-08-13 — **Segunda sesión: se pidió un roadmap de cinco.** El catálogo solo tiene
  cuatro huecos, así que el quinto obliga a salir de `GAMES`. Elegido **FLUJO** (`flujo`,
  Pipe Mania) con 33/35: llena la categoría **PUZZLE**, que hoy tiene un solo juego (CAÍDA),
  y su mecánica —construir contra reloj antes de que llegue el líquido— no se parece a nada
  del catálogo. Empataría a 34 con RANARIA si no costara entrada de catálogo y portada.
  Descartados como quinto: Galaga (calcado a `invasores`), Donkey Kong (plataformas: saltar
  con gravedad es lo más caro de afinar y no hay precedente en el repo), Missile Command
  (pide puntero) y Q\*bert (isométrico, mecánica interesante pero ARCADE, que ya va sobrada).
- 2026-08-13 — Criterio de reparto por categoría, para futuras evaluaciones. Implementados:
  ARCADE 2, SHOOTER 1, PUZZLE 1, VERSUS 0. **PUZZLE y VERSUS son los huecos**; ARCADE es
  donde menos falta hace añadir. Y de los colores de acento, `magenta` es el menos usado
  (1 de 8), así que un juego nuevo debería llevarlo.
- 2026-08-13 — **RANARIA implementada**, y no por la vía prevista: en vez de `/nuevo-juego`
  la spec la escribió el agente `game-jam` a partir del tema «la ranita»
  (`specs/game-jam/ranaria/`, seis archivos), y la SPEC 11 le añadió el sonido después. Dos
  cosas que esto deja para las próximas evaluaciones: **el nº 1 del roadmap se puede
  implementar sin pasar por la skill**, así que al evaluar hay que mirar `GAME_ENGINES` y
  no solo esta memoria; y el portal **ya tiene audio** (`app/lib/games/audio.ts`,
  `crearSfx()`), así que «tiene sonido» dejó de ser un coste extra para un candidato.
  Reparto tras RANARIA: ARCADE 3, SHOOTER 1, PUZZLE 1, VERSUS 0 — refuerza que el próximo
  no debería ser ARCADE, lo que empuja a **FLUJO** (PUZZLE) por delante de `gloton`.

- 2026-09-10 — **GLOTÓN (`gloton`) aceptado como siguiente**, y no por puntuación: empata a
  31 con `invasores` y va detrás de `flujo` (33). Lo decidió el objetivo — se pidió el juego
  grande, y para ese caso esta misma memoria ya lo señalaba como el candidato natural
  («súbelo si el objetivo es un juego grande»). `flujo` sigue siendo el nº 1 por puntuación
  y su fila no se toca. A favor de `gloton`: ya está entero en `GAMES` (`cover-glot`, acento
  `yellow`), así que no cuesta entrada de catálogo ni portada, que era el único punto donde
  `flujo` perdía. En contra: es ARCADE, y el reparto queda ARCADE 4 de 6 — PUZZLE y VERSUS
  siguen siendo los huecos, así que el argumento de categoría queda pendiente para el
  siguiente, no resuelto.
- 2026-09-10 — Apareció `specs/game-jam/frogger/01-flogger-core.md`, una spec de Frogger con
  id `frogger`. **No se implementó, y no debe implementarse**: Frogger ya tiene motor como
  `ranaria` desde el 2026-08-13, y además esa spec describe una arquitectura que no es la de
  este repo (componente React `FroggerGame.tsx` con `useEffect`, ruta `app/games/<id>/play/`,
  una tabla `games` en Supabase, `onGameOver(finalScore)` en vez de `GameOverSummary`, canvas
  640×560). Queda anotado aquí porque la fila de Frogger ya está en `implementado` y un
  documento suelto con otro id es justo lo que esta memoria existe para desmentir.
- 2026-09-11 — **GLOTÓN implementado** (SPEC 18, `app/lib/games/pacman.ts`). Sexto motor del
  portal. Tres cosas que dejan enseñanza para las próximas evaluaciones: el coste estimado
  («el más caro con diferencia») **se confirmó** —1 326 líneas de motor frente a las 943 de
  SERPENTINA—, pero la mitad de ese coste fue el laberinto, que es dato transcrito y no
  lógica; el trazado se validó **contando** (240 puntos, 4 píldoras, simetría y BFS de
  alcanzabilidad) y esas pruebas cazaron dos errores de transcripción que ni el tipo ni la
  vista detectan. Y es el **primer motor con un solo aspecto**: no declara `FichaDeSkins` ni
  entra en `GAME_PALETAS` por decisión del usuario, así que su overlay no enseña el selector.
  Reparto tras GLOTÓN: ARCADE 4, SHOOTER 1, PUZZLE 1, VERSUS 0 — **PUZZLE y VERSUS siguen
  siendo los huecos**, y el argumento de categoría que empujaba a `flujo` sigue intacto y sin
  gastar.

- 2026-09-12 — **INVASORES implementado** (SPEC 21, `app/lib/games/invaders.ts`). Séptimo
  motor del portal. Las dos pegas que esta memoria le tenía anotadas desde el 2026-08-13
  quedaron respondidas por escrito en la spec, y conviene no volver a levantarlas sin
  argumentos nuevos: **«repite el nave que dispara de ROCAS»** es cierto en la descripción
  y falso en la mano —ROCAS es inercia y rotación en un espacio toroidal, y la dificultad
  está en frenar; INVASORES es un carril sin inercia con **una sola bala en pantalla**, y
  la dificultad está en no fallar—; y **«quiere `ESPACIO`»** no era un conflicto, porque
  ROCAS ya la declara desde la SPEC 05 y convive con el overlay de arranque: cuando la
  partida corre, el overlay ya no está montado.
- 2026-09-12 — Tres cosas medidas durante la implementación que sirven para evaluar futuros
  candidatos. **El escenario destruible salió barato**: los cuatro búnkeres son un
  `Uint8Array` de 352 bytes cada uno y toda su lógica cabe en tres funciones puras, así que
  «el juego tiene terreno que se rompe» no debería seguir contando como coste alto.
  **Un jugador guionizado no sirve para verificar un juego de puntería**: tres estrategias
  distintas se quedaron en 830 de los 990 puntos de la primera oleada, así que el fin de
  oleada quedó cubierto por helpers puros y verificado a mano, no de punta a punta.
  Y **la carrera del juego está medida**: la formación tarda **282 s** en cruzar la línea
  del cañón sin que nadie dispare, contra los ~55 s que cuesta limpiarla apuntando.
- 2026-09-12 — Reparto tras INVASORES: **ARCADE 4, SHOOTER 2, PUZZLE 1, VERSUS 0**. El
  argumento de categoría que empujaba a `flujo` **sigue intacto y sin gastar**: PUZZLE tiene
  un solo juego y VERSUS ninguno, así que `flujo` (33/35) se queda como nº 1 del roadmap y
  con un motivo más que antes. Recuerda que es la única propuesta que **no** está en `GAMES`:
  pide entrada de catálogo y portada `cover-flujo`, acento `magenta`. El otro que queda,
  `duelo-pixel`, sigue bloqueado por su métrica de puntuación.
