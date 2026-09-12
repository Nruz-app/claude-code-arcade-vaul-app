---
name: spec-imp-game
description: Implementa una spec de juego aprobada y cierra el trabajo con los dos subagentes que escriben en app/. Hace exactamente lo que /spec-impl —misma validación de estado, misma rama, mismos pasos con pausa— y al terminar lanza skin-designer y después mobile-porter, uno detrás de otro y nunca a la vez. Úsala en vez de /spec-impl cuando la spec añada o cambie un juego del catálogo.
disable-model-invocation: true
argument-hint: "<NN-nombre-spec> [id-del-juego]"
allowed-tools: Read, Glob, Grep, Edit, Write, AskUserQuestion, Task, Bash(git status:*), Bash(git branch:*), Bash(git checkout:*), Bash(git log:*), Bash(git diff:*), Bash(git stash:*), Bash(cat:*), Bash(ls:*), Bash(date:*), Bash(npm run lint:*), Bash(npm run build:*), Bash(npm run test:run:*), Bash(npx vitest run:*)
---

# /spec-imp-game — implementar una spec de juego y cerrarla entera

## Contexto de sesión

Estado del repositorio:
!`git status --short`

Rama actual:
!`git branch --show-current`

Specs disponibles:
!`ls specs/ 2>/dev/null || echo "No existe la carpeta specs/"`

Motores registrados hoy:
!`cat app/lib/games/registry.ts 2>/dev/null || echo "No existe registry.ts"`

Fecha de hoy (para las memorias, nunca la inventes):
!`date +%F`

---

Este comando es `/spec-impl` **más el cierre que una spec de juego siempre necesita**.
Implementar el motor no termina el trabajo: falta darle sus tres aspectos y comprobar que
se ve bien en un teléfono. Eso lo hacen dos subagentes, y hasta hoy había que acordarse de
lanzarlos a mano.

Tus respuestas van **en español**, como todo en este repo.

## Fase A — Implementar, siguiendo `/spec-impl` al pie de la letra

**Lee `.claude/skills/spec-impl/SKILL.md` con la herramienta Read y ejecuta sus cuatro fases
tal cual están escritas.** No las resumas de memoria y no las reinterpretes: léelas cada vez.

Por qué se lee el archivo en vez de invocar la skill: `/spec-impl` lleva
`disable-model-invocation: true`, así que **no es invocable por el modelo** —solo la carga el
usuario al teclearla—. Y tampoco se copia aquí su contenido: está **fijado por hash en
`skills-lock.json`** y se actualiza con `npx skills@latest add`, de modo que una copia se
quedaría vieja en silencio. Leerlo es lo único que no se pudre.

Lo suyo se respeta sin excepciones, y en particular estas tres:

- **El estado tiene que significar «Aprobado».** El bloqueo es intencionado: no lo ablandes,
  no ofrezcas «puedo empezar igual» y no cambies tú el estado de la spec. Eso lo hace el
  humano.
- **Nunca commitees solo.** Ni por paso ni al final.
- **Una ambigüedad se pregunta, no se improvisa.** Y lo que esté fuera del alcance de la
  spec no se implementa: se anota para la siguiente.

El argumento que recibes es: `$ARGUMENTS`. El primer valor es la spec, igual que en
`/spec-impl`. El segundo, **opcional**, es el id del juego; si no viene, lo deduces del
registro y **lo confirmas** antes de la Fase C.

## Fase B — Las cuatro puertas

Cuando la Fase A termine, **no lances nada todavía**. Estas cuatro tienen que estar en verde.
Si una falla, para y dilo; no lances agentes a ver si cuela.

| Puerta                | Qué compruebas                                                                                                                 |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **Plan terminado**    | Todos los pasos del plan hechos y los criterios de aceptación de la spec verificados **uno a uno**, no de un vistazo.          |
| **Suite en verde**    | `npm run test:run`, `npm run lint` y `npm run build`. Los tres, con su salida a la vista.                                      |
| **El juego existe**   | El id está en `GAME_ENGINES` y tiene entrada en `GAME_CONTROLS` y en `GAME_TOUCH` (`app/lib/games/registry.ts`).               |
| **El diff, separado** | **Ofrece** commitear la implementación antes de que los agentes añadan la suya. Ofrecer, no hacerlo: el commit es del usuario. |

**La tercera puerta es además el detector de «esta spec no era de un juego».** Si la spec no
registra un motor —como hicieron la 14, la 15, la 16 y la 17, que no tocaron un solo motor—
no hay nada que skinear ni ninguna ruta nueva que auditar. Dilo, **sáltate la Fase C** y
termina como terminaría `/spec-impl`. Lanzar `skin-designer` contra un juego sin motor es
hacerle perder el tiempo a todo el mundo.

## Fase C — Los dos agentes, uno detrás de otro

### La regla dura

**Una llamada a `Task` por mensaje.** Dos llamadas en el mismo mensaje se ejecutan **en
paralelo**, y aquí eso está prohibido. Lanzas uno, **esperas su notificación de fin**, lees
su informe, y solo entonces lanzas el otro.

Y no te adelantes al resultado: mientras el primero corre no se escribe lo que «habrá
hecho». Si el usuario pregunta, la respuesta es que sigue trabajando.

### Por qué en ese orden

Primero las skins y después el móvil, y no al revés: **una skin cambia lo que se dibuja**, así
que auditar el teléfono antes es medir un juego a medio vestir. Además cada uno escribe en un
archivo distinto —`skin-designer` en el motor, `mobile-porter` en `app/globals.css`—, así que
en secuencia no se pisan; en paralelo sí podrían.

### 1) `skin-designer`

Lánzalo con **el id del motor** (uno por invocación; es su regla). Le toca darle sus tres
aspectos, registrarlo en `GAME_PALETAS`, añadir `verificaSkins` a su archivo de pruebas y la
fila de oro, y actualizar `.claude/memoria/skin-designer.md`.

Recuérdale en el prompt lo que no es negociable: **`neon` no se toca** —es el aspecto
histórico del portal y las pruebas comparan la secuencia entera de colores—, `retro` es ámbar
y `clasico` es el arcade original de ese juego.

### 2) Esperar y comprobar

Cuando termine, **no te fíes solo de su informe**:

- `npx vitest run tests/games/<juego>.test.ts` — que `verificaSkins` pasa de verdad.
- Que sus tres filas de `.claude/memoria/skin-designer.md` están cerradas con su ratio.

Si algo no cuadra, arréglalo o devuélveselo **antes** de lanzar el segundo.

### 3) `mobile-porter`

Lánzalo con **las dos rutas nuevas**: `/juego/<id>` y `/juego/<id>/jugar`, en los cinco
viewports de su banco (320×568, 375×667, 412×915, 844×390 en horizontal y 1440×900 como
control de no-regresión).

Dile explícitamente que **añada las filas de esas dos rutas a `.claude/memoria/mobile-porter.md`**:
su tabla se creó con las de `serpentina` como ejemplo y un juego nuevo no tiene fila. Y
recuérdale su alcance: **solo `app/globals.css`**, nada de JSX ni del motor que acaba de tocar
`skin-designer`.

## Fase D — Los tres documentos del catálogo

`CLAUDE.md` manda tocar los tres al implementar un juego. Este es el sitio:

1. **`.claude/memoria/game-planner.md`** — la fila del juego pasa a `implementado`. Solo
   cambia la columna `Estado`: las filas no se borran ni se reescriben. Sin esto,
   `game-planner` volverá a proponer un juego que ya existe.
2. **`references/implemented-game/game-suggestions-todo.md`** — se mueve su línea a lo hecho.
3. **`references/implemented-game/implemented-games.md`** — su ficha: mecánicas, puntuación y
   la foto de `game_sessions`, **consultada a Supabase por el MCP**, nunca escrita a mano.

Si los dos primeros discrepan, **manda la memoria**: es la fuente de verdad.

## Fase E — Informe

Devuelve, en este orden:

1. **Qué spec** implementaste y en qué rama.
2. **Qué hiciste**, paso a paso del plan.
3. **Las cuatro puertas**, con la salida de los comandos.
4. **`skin-designer`** — resumen de su informe y qué comprobaste tú.
5. **`mobile-porter`** — defectos que encontró, cuáles arregló y cuáles dejó, con su razón.
6. **Qué documentos del catálogo tocaste.**
7. **Qué quedó fuera y por qué**, con nombre y apellidos. Nada de «quedan detalles menores».

## Reglas duras

- **No copies aquí el contenido de `/spec-impl`.** Se lee del archivo, siempre.
- **No relajes el bloqueo por estado** ni cambies tú el estado de una spec.
- **No commitees por tu cuenta**, en ninguna fase.
- **Nunca lances los dos agentes en el mismo mensaje.** Uno, esperar, el otro.
- **No inventes el resultado de un agente que sigue corriendo.**
- **No lances `skin-designer` si el juego no tiene motor registrado.**
- **No hagas tú el trabajo de los agentes.** Si `mobile-porter` encuentra algo, lo arregla
  él: para eso tiene el alcance acotado y las sondas.
- **No dejes las memorias sin actualizar.** Una sesión sin escribirlas se pierde entera.
