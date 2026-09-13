# TODO — Sugerencias de juegos para Arcade Vault

> **Lo mantiene el agente `game-planner`** (`.claude/agents/game-planner.md`).
> Cada vez que sugiere un juego, añade o mueve su línea aquí.
> Compañero: `implemented-games.md`, en esta misma carpeta, que documenta lo ya hecho.

Esto es la **lista accionable**: qué toca hacer y en qué orden. El histórico completo —con
el porqué de cada descarte y las notas de sesión— vive en `.claude/memoria/game-planner.md`,
que es la fuente de verdad. Si los dos discrepan, manda la memoria.

Formato de cada línea:

```
- [ ] **JUEGO** (`id`) — una frase de por qué · _sugerido: AAAA-MM-DD_ · spec: NN o —
```

---

## ⏭️ Siguiente — aceptado, pendiente de implementar

_Como mucho uno. Es lo que va a `/nuevo-juego <id>`._

- _(vacío — nadie ha aceptado nada todavía)_

## 💡 Propuesto — esperando decisión

_Sugerencias del agente sin visto bueno. Al aprobarse suben a «Siguiente»; al rechazarse
bajan a «Descartado» con el motivo._

**Roadmap** (2026-08-13). El orden es el de puntuación. Era de cinco; RANARIA, que iba
primera, ya está hecha y ha bajado a «Hecho», y GLOTÓN (SPEC 18, el 2026-09-11) e INVASORES
(SPEC 21, el 2026-09-12) también, así que quedan dos:

1. - [ ] **FLUJO** (`flujo`) — Pipe Mania. 33/35. **No está en `GAMES`**: hay que crear la
        entrada del catálogo y la portada `cover-flujo`. Sería el **segundo PUZZLE**, la
        categoría más vacía — y tras INVASORES el reparto va ARCADE 4, SHOOTER 2, PUZZLE 1,
        VERSUS 0, así que su argumento de categoría sigue intacto y sin gastar.
        · _sugerido: 2026-08-13_ · spec: —
2. - [ ] **DUELO PIXEL** (`duelo-pixel`) — Pong. 28/35. **Bloqueado por diseño**: su marcador
        0–11 no compara con el resto del Salón. Antes de implementarlo hay que inventarle una
        métrica acumulativa. · _sugerido: 2026-08-13_ · spec: —

## ❌ Descartado

_No se vuelven a proponer salvo que cambie algo concreto, y entonces hay que decir el qué._

- _(vacío)_

## ✅ Hecho — con motor en `GAME_ENGINES`

- [x] **ROCAS** (`rocas`) — Asteroids. Fijó el contrato `GameFactory`. · spec: 05
- [x] **CAÍDA** (`caida`) — Tetris. Primer porte con `/nuevo-juego`. · spec: 08
- [x] **BLOQUE BUSTER** (`bloque-buster`) — Arkanoid. Agotó los juegos de referencia. · spec: 09
- [x] **SERPENTINA** (`serpentina`) — Snake. Primero desde cero y primero con sprites. · spec: 10
- [x] **RANARIA** (`ranaria`) — Frogger. Primera spec del agente `game-jam` y primer juego con
      sonido. · spec: `specs/game-jam/ranaria/` + 11
- [x] **GLOTÓN** (`gloton`) — Pac-Man. El más caro del roadmap y el primero con IA de
      adversarios. Primer motor con **un solo aspecto**: sin ficha de skins ni selector.
      · spec: 18
- [x] **INVASORES** (`invasores`) — Space Invaders. Primero con **escenario destruible**: los
      cuatro búnkeres se erosionan disparo a disparo. Respondió por escrito las dos pegas que
      arrastraba desde 2026-08-13 (el «repite ROCAS» y el «quiere `ESPACIO`»). · spec: 21

---

## Puntuación de los candidatos

Evaluados el **2026-08-13** sobre 35 puntos (un canvas / solo teclado / puntuación / fin
claro / un jugador / coste / aporte). El desglose por criterio está en la memoria del agente.

| Juego       | Id            | Categoría | En `GAMES` | Puntos | Nota                                                                |
| ----------- | ------------- | --------- | ---------- | -----: | ------------------------------------------------------------------- |
| ~~RANARIA~~ | `ranaria`     | ARCADE    | Sí         | **34** | **Ya implementada.** Ganó por coste bajo y mecánica nueva.          |
| FLUJO       | `flujo`       | PUZZLE    | **No**     |     33 | Segundo PUZZLE. Empataría a 34 si no costara entrada + portada.     |
| ~~INVASORES~~ | `invasores` | SHOOTER   | Sí         |     31 | **Ya implementado** (SPEC 21). Las dos pegas quedaron respondidas.   |
| GLOTÓN      | `gloton`      | ARCADE    | Sí         |     31 | El más caro: laberinto + IA de cuatro fantasmas. También el mejor.  |
| DUELO PIXEL | `duelo-pixel` | VERSUS    | Sí         |     28 | Marcador 0–11: no compara con el resto del Salón. Y necesita IA.    |

Los que ya tienen id en `GAMES` salen más baratos: **usa el id que ya está, no crees otro.**
FLUJO es el único que además pide entrada en `GAMES` (`app/lib/data.ts`) y una clase
`cover-flujo` en `app/globals.css`; acento `magenta`, el color menos usado del catálogo.

Ninguno tiene código en `references/templates/started-games/`: se escriben enteros, como
SERPENTINA.
