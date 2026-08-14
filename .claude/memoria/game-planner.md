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

| Fecha      | Juego          | Id              | Estado         | Spec                                 | Razón                                                                                                                                                                                                             |
| ---------- | -------------- | --------------- | -------------- | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-08-13 | Asteroids      | `rocas`         | `implementado` | `05-juego-rocas-asteroids.md`        | Primer juego real. Fijó el contrato `GameFactory` y las convenciones de canvas 800×600.                                                                                                                           |
| 2026-08-13 | Tetris         | `caida`         | `implementado` | `08-juego-caida-tetris.md`           | Primer porte con `/nuevo-juego`. Sin vidas: emite `onLives(1)`/`onLives(0)`.                                                                                                                                      |
| 2026-08-13 | Arkanoid       | `bloque-buster` | `implementado` | `09-juego-bloque-buster-arkanoid.md` | Agotó los juegos de `references/templates/started-games/`. Ganar se registra como `game_over`.                                                                                                                    |
| 2026-08-13 | Snake          | `serpentina`    | `implementado` | `10-juego-serpentina-snake.md`       | Primero escrito desde cero, sin código de referencia, y primero con sprites (`public/snake-fruits.png`).                                                                                                          |
| 2026-08-13 | Frogger        | `ranaria`       | `implementado` | `specs/game-jam/ranaria/` + `11`     | Ganó con 34/35 y se implementó el mismo día. La spec no salió de `/nuevo-juego` sino del agente `game-jam` (tema: "la ranita"); la SPEC 11 le añadió después el sonido, y es el único juego del portal que suena. |
| 2026-08-13 | Pipe Mania     | `flujo`         | `propuesto`    | —                                    | 33/35, nº 1 del roadmap. **No está en `GAMES`**: pide entrada de catálogo y portada `cover-flujo`, acento `magenta`. Sería el segundo PUZZLE, la categoría más vacía.                                             |
| 2026-08-13 | Space Invaders | `invasores`     | `propuesto`    | —                                    | 31/35, nº 2 del roadmap. Barato, pero repite el «nave que dispara» de ROCAS y quiere `ESPACIO`.                                                                                                                   |
| 2026-08-13 | Pac-Man        | `gloton`        | `propuesto`    | —                                    | 31/35, nº 3 del roadmap **por coste, no por valor**: es el mejor juego de la lista y el más caro. Súbelo si el objetivo es un juego grande.                                                                       |
| 2026-08-13 | Pong           | `duelo-pixel`   | `propuesto`    | —                                    | 28/35, nº 4 y **bloqueado por diseño**: el marcador 0–11 no compara en el Salón. No implementar sin resolver antes la métrica de puntuación.                                                                      |

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
