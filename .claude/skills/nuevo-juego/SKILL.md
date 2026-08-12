---
name: nuevo-juego
description: Porta un juego arcade a la plataforma siguiendo el patrón de ROCAS. Escribe primero la spec del juego y, tras aprobarla, implementa el motor contra el contrato GameFactory y lo registra. Úsala para añadir un juego jugable al catálogo, venga o no de references/templates/started-games/.
disable-model-invocation: true
argument-hint: "<id-del-juego> o el clásico a portar (p. ej. caida, tetris)"
allowed-tools: Read, Glob, Grep, Edit, Write, AskUserQuestion, Bash(ls:*), Bash(cat:*), Bash(date:*), Bash(npm run lint:*), Bash(npm run build:*)
---

# /nuevo-juego — Portador de juegos al Arcade Vault

## Contexto de sesión

Fecha de hoy (úsala en la cabecera de la spec, nunca la inventes):
!`date +%F`

Specs que ya existen:
!`ls specs/ 2>/dev/null || echo "No existe la carpeta specs/"`

Motores registrados hoy:
!`cat app/lib/games/registry.ts 2>/dev/null || echo "No existe registry.ts"`

Juegos de referencia disponibles:
!`ls references/templates/started-games/ 2>/dev/null || echo "No hay juegos de referencia"`

---

Esta skill añade un juego **jugable de verdad** a Arcade Vault. Trabaja en dos tiempos:
primero escribe la spec y **para** para que la apruebes, y solo después implementa el
motor. Es el flujo Spec Driven Design del proyecto, condensado en un comando.

Tus respuestas van **en español**, como todo en este repo.

## Lo que ya está resuelto y no hay que rehacer

Antes de nada, interioriza esto: **portar un juego es escribir un archivo y registrarlo.**
Todo lo demás ya existe.

- El **reproductor** (`app/juego/[id]/jugar/page.tsx`) es genérico: HUD, overlay de
  arranque, pausa por `Escape`/`blur`/cambio de pestaña, modal de fin y registro en
  Supabase funcionan igual para cualquier motor. **No hay que tocarlo.**
- El **Salón de la Fama** (`/salon`) también: las pestañas salen de `GAMES` y `game_id` es
  texto libre en `game_sessions`. Un juego con motor aparece en su leaderboard **sin
  migración, sin SQL y sin tocar `/salon`**.
- El **registro de partidas** se dispara solo al terminar (`app/lib/game-sessions.ts`).

Lo único que hay que garantizar es que el motor emita bien `onScore`, `onLevel` y
`onGameOver`: de esos tres salen las filas de `game_sessions`, y de ellas el ranking.

## Flujo

Sigue las cinco fases en orden. **No saltes la fase 2**: las preguntas son las que evitan
tener que reescribir el motor entero. **No empieces la fase 4 sin aprobación explícita.**

### Fase 1 — Identificar el juego y su origen

1. Lee `CLAUDE.md` para el contexto del proyecto.
2. Resuelve `$ARGUMENTS` contra el catálogo `GAMES` de `app/lib/data.ts`.

**Cuidado con los ids: están en español y no delatan el clásico que son.** Si el usuario
pide "tetris" o "arkanoid", el id del catálogo es otro:

| Piden      | Id del catálogo | Referencia               |
| ---------- | --------------- | ------------------------ |
| Asteroids  | `rocas`         | `02-asteroids` (portado) |
| Tetris     | `caida`         | `03-tetris`              |
| Arkanoid   | `bloque-buster` | `04-arkanoid`            |
| Snake      | `serpentina`    | —                        |
| Pac-Man    | `gloton`        | —                        |
| Space Inv. | `invasores`     | —                        |
| Frogger    | `ranaria`       | —                        |
| Pong       | `duelo-pixel`   | —                        |

**Nunca inventes un id nuevo si ya hay uno que corresponde.** Tres casos:

- **Ya tiene motor en `GAME_ENGINES`** → está portado. Dilo y para.
- **Está en `GAMES` sin motor** → sigue. Es el caso normal.
- **No está en `GAMES`** → hay que crear la entrada del catálogo y su portada
  `cover-*` en `app/globals.css`. Confírmalo en la fase 2.

3. Si hay carpeta en `references/templates/started-games/`, lee su `game.js` y reporta en
   dos o tres frases **qué habrá que desmontar**: variables globales, HUD dibujado en el
   canvas, `getElementById`, listeners sin limpiar, assets con ruta relativa. No es
   crítica al código original: es un juego suelto, no un módulo de una app.

   Si no hay carpeta, el juego se escribe desde cero y las mecánicas salen de la fase 2.

### Fase 2 — Preguntas

Bloques de 3 a 5 preguntas con `AskUserQuestion`. Pon tu recomendación primero y márcala.
Estas categorías no son opcionales: cada una decide algo que el contrato obliga a fijar.

- **Vidas.** El contrato tiene `onLives` y el HUD pinta `"♥ ".repeat(lives)`. Pero hay
  juegos sin vidas (Tetris). Decide: no emitirlo nunca, o emitir 1 al empezar y 0 al morir.
- **Niveles.** Qué los hace subir y qué cambia con ellos. `level` acaba en la columna
  `level` de `game_sessions` y se ve en el Salón.
- **Puntuación.** La tabla de puntos exacta. Es **el** dato del leaderboard: si las
  magnitudes se van de escala respecto a los otros juegos, el ranking global queda raro.
- **Controles.** Las teclas exactas, que irán a `GAME_CONTROLS`. Avisa si el juego quiere
  `Space`: el reproductor la usa para arrancar la partida desde el overlay.
- **Fin de partida.** Qué la termina. Si el juego se puede **ganar** (Arkanoid al superar
  el último nivel), hay que mapearlo a `game_over`: `GameOverReason` solo admite
  `"game_over" | "surrender"` y ampliarlo obliga a migrar la restricción `check` de la
  tabla.
- **Assets.** Sprites o sonidos van a `public/` y se referencian como `/loquesea.png`. Las
  rutas relativas al módulo no funcionan en Next.
- **Un solo canvas.** `GameFactory` recibe **uno**. Si el original usa dos (Tetris pinta la
  pieza siguiente en un canvas aparte), hay que decidir dónde cabe dentro del principal.
- **Entrada de catálogo**, si el juego no estaba en `GAMES`: título, categoría
  (`ARCADE` / `PUZZLE` / `SHOOTER` / `VERSUS`), color de acento y descripciones corta y
  larga.

Deja de preguntar cuando puedas responder sin suponer nada: qué archivos aparecen o
cambian, cuál es el primer paso ejecutable y cuál el último, y cómo se verifica que está
terminado.

### Fase 3 — Escribir la spec

Escribe la spec en `specs/NN-slug.md`, donde `NN` es el número siguiente al mayor que
aparezca en el listado del contexto de sesión.

**Toma como modelo la SPEC 05** (`specs/05-juego-rocas-asteroids.md`): es exactamente este
mismo trabajo ya hecho una vez. Las 06 y 07 completan el cuadro de registro y ranking, y la
**SPEC 08** (`08-juego-caida-tetris.md`) es la primera escrita con esta skill — útil como
modelo de un porte que no toca ni el reproductor ni la base de datos.

Estructura, la misma que la 05:

1. **Cabecera** — Estado, Depende de, Fecha (la del contexto de sesión), y el objetivo en
   **una** frase.
2. **Por qué existe esta spec** — el hueco concreto que llena.
3. **Alcance** — dentro y, explícitamente, **fuera**. Lo que queda fuera casi siempre
   incluye: el top 10 del detalle `/juego/[id]`, el campo `best` de `GAMES`, los controles
   táctiles y el sonido.
4. **Modelo de datos** — el estado interno del motor y sus constantes. Di explícitamente si
   no hace falta ninguna migración de Supabase (es lo normal).
5. **Plan de implementación** — pasos numerados, cada uno dejando la app compilando. Un
   motor son varios cientos de líneas: pártelo en pasos (entidades → entrada → bucle y
   colisiones → integración), como hizo la SPEC 05.
6. **Criterios de aceptación** — checklist booleana, agrupada en Build / El juego funciona
   / Integración con la plataforma / Lo que no debe romperse.
7. **Decisiones** — con los "Sí:" y "No:" y su porqué. Es la sección de más valor a futuro.
8. **Riesgos** — tabla de riesgo y mitigación.

Guarda el archivo con el estado en **`Borrador`** y **para aquí**. Di la ruta del archivo y
pide que se revise y se apruebe. No empieces a implementar.

### Fase 4 — Implementar

Solo tras aprobación explícita del usuario.

**Antes de escribir una línea, lee `contrato.md`** (en esta misma carpeta): tiene las diez
invariantes que hacen que un motor encaje, y el porqué de cada una. Casi todas existen
para evitar un fallo concreto que ya se pagó portando ROCAS.

Orden de trabajo:

1. **Catálogo**, si el juego es nuevo: entrada en `GAMES` (`app/lib/data.ts`) y clase de
   portada `cover-*` en `app/globals.css`, siguiendo las que ya existen.
2. **Assets a `public/`**, si los hay, y reescribe las rutas.
3. **El motor** en `app/lib/games/<juego>.ts`, en los pasos que fijó la spec.
4. **Registro**: una línea en `GAME_ENGINES` y otra en `GAME_CONTROLS`, las dos en
   `app/lib/games/registry.ts`.

Ve marcando los pasos de la spec conforme los cierres.

### Fase 5 — Verificar

1. `npm run lint` y `npm run build`. No hay runner de tests en el proyecto: esto es la
   validación, y `build` es además lo único que comprueba los tipos.
2. Comprobación jugable con el MCP de Playwright, levantando `npm run dev` y navegando a
   `/juego/<id>/jugar`:
   - El overlay de arranque muestra **los controles del juego** y no arranca hasta ESPACIO.
   - El HUD se mueve al jugar: puntuación, y vidas o nivel según lo decidido.
   - `Escape` pausa y reanuda; cambiar de pestaña deja el juego en pausa.
   - Al terminar se abre el modal de fin con la puntuación.
   - Salir de la pantalla y volver arranca una partida limpia, sin doble velocidad (si va
     al doble, `destroy()` no está limpiando el bucle o los listeners).
3. Con sesión iniciada, terminar una partida y comprobar que aparece en `/salon`, en la
   pestaña del juego. Es la prueba de que el leaderboard funciona de punta a punta.

Cierra diciendo qué quedó fuera de alcance y sigue pendiente.

## Reglas duras

- **No toques `app/juego/[id]/jugar/page.tsx`.** Es genérico desde el refactor de
  `GAME_CONTROLS`. Si te parece que hay que tocarlo, es señal de que el motor está
  haciendo algo que le corresponde a la plataforma —dibujar HUD, gestionar el fin de
  partida— y lo que hay que arreglar es el motor.
- **No toques `app/lib/games/types.ts`.** El contrato es estable desde la SPEC 06. Si un
  juego no encaja, plantéalo al usuario en la fase 2; no lo cambies por tu cuenta.
- **No crees migraciones de Supabase.** Un juego nuevo no necesita ninguna.
- **No escribas código en la fase 3.** Solo la spec.
- **No implementes sin aprobación.** La fase 3 termina con el archivo guardado en
  `Borrador` y la pelota en el tejado del usuario.
- **Nada de estado a nivel de módulo en el motor.** En Next sobrevive entre montajes. Es el
  error que más caro sale y el más difícil de ver.
- **Todo en español**: la UI, los comentarios del código y la spec.

## Argumentos

`$ARGUMENTS` es el juego a portar: puede ser un id del catálogo (`caida`), el nombre del
clásico (`tetris`), o una carpeta de `references/templates/started-games/`. Resuélvelo en
la fase 1 contra la tabla de arriba.

Si viene vacío, muestra qué juegos del catálogo aún no tienen motor y qué carpetas de
referencia quedan sin portar, y pregunta cuál.
