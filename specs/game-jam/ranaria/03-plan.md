# RANARIA — plan de implementación

> Ver `02-motor.md` para las constantes y `04-aceptacion.md` para lo que hay que comprobar al
> final.

Cada paso deja la app compilando (`npm run build` sin errores) y es commiteable por sí solo.
Hasta el paso 7 nada se monta en pantalla y la app se comporta exactamente como hoy: el motor
existe pero nadie lo importa.

El orden de secciones del archivo es el del contrato
(`.claude/skills/nuevo-juego/contrato.md`): cabecera doc → `import type` → constantes →
utilidades → teclado → entidades → motor.

---

## 1. Constantes, tipos y tabla de carriles

Crear `app/lib/games/frogger.ts` con:

- Cabecera doc: qué es el juego, que se escribe desde cero sin código de referencia, y las
  dos cosas que se apartan del Frogger de recreativa a propósito (no se puede ganar; no hay
  cocodrilos ni rana hembra).
- `import type { GameFactory, GameHandle, GameCallbacks, GameOverSummary } from "./types";`
  — solo tipos, cero dependencias en runtime.
- Las constantes de `02-motor.md`: `W`, `H`, `CELL`, `COLS`, `ROWS`, las filas, los
  temporizadores, la progresión, la puntuación y `COLORS`.
- Los tipos `TipoCarril`, `CarrilDef`, `Movil`, `Carril`, `Nenufar`, `EstadoTortuga`,
  `EstadoJuego`.
- La tabla `CARRILES: readonly CarrilDef[]` con los nueve carriles.

Verificación: `npm run build` compila con tipado strict; nada lo importa aún.

## 2. Reglas puras

Añadir los helpers, todos recibiendo por argumento lo que necesitan y sin leer nada de
módulo:

- `crearCarril(def)` → construye el convoy: `paso`, `n`, `pista` y los móviles repartidos,
  con el desfase de ciclo de las tortugas.
- `avanzarCarril(carril, dt, mult)` → mueve y envuelve.
- `multiplicador(level)` → `min(1 + VEL_STEP × (level - 1), VEL_MAX)`.
- `tiempoDelNivel(level)` → `max(TIEMPO_BASE - TIEMPO_DEC × (level - 1), TIEMPO_MIN)`.
- `estadoTortuga(ciclo)` → `"emergida" | "parpadeo" | "sumergida"`.
- `cajaMovil(carril, movil)` y `solapa(a, b)` → colisión de rectángulos.
- `plataformaBajo(carril, centroX)` → el móvil que sostiene a la rana, o `null`.
- `columnaDe(x)` y `snapColumna(x)` → columna del centro y ajuste a celda.
- `filaY(fila)` y `xDeColumna(col)` → geometría, para no repartir multiplicaciones por el
  archivo.

Verificación: `npm run build` compila.

## 3. Teclado

Clase `Input` siguiendo el patrón de `asteroids.ts`:

- Handlers como **propiedades flecha** (`private onKeyDown = (e) => {…}`), no métodos: con un
  método, `removeEventListener` recibe otra referencia y el listener no se quita.
- `attach()` idempotente (`if (this.attached) return;`), listeners en `window` para no
  depender del foco del canvas, `detach()` que los quita y `clear()` que vacía la cola.
- Traduce `ArrowUp/Down/Left/Right` y `KeyW/A/S/D` a un salto `{ dx, dy }` y lo **encola**.
  La cola tiene capacidad 2: sin cola, dos pulsaciones dentro del mismo frame pierden una y
  el juego se siente sordo; con cola infinita, machacar teclas encadena saltos que el jugador
  ya no controla.
- `preventDefault` **solo** sobre esas ocho teclas y **solo** mientras el motor está
  enganchado, para no bloquear el scroll de la página fuera de la partida.
- `e.code`, no `e.key`: `code` es independiente de la distribución del teclado.

**No se captura `Space`**: el reproductor la usa para abrir la partida desde el overlay, y no
capturarla es lo que evita tener que blindar el motor contra esa pulsación, como ya
decidieron BLOQUE BUSTER y SERPENTINA.

Verificación: `npm run build` compila.

## 4. Dibujo del escenario

- `drawEscenario(ctx)`: bandas de tierra (filas 5 y 11) con su borde verde, asfalto (filas
  6–10) con la discontinua de cada carril, agua (filas 1–4) con dos ondulaciones tenues, y la
  fila de meta: setos oscuros y cinco nenúfares dibujados como aros de `--green`.
- `drawNenufares(ctx, nenufares)`: el nenúfar ocupado lleva dentro una ranita pequeña; el que
  tiene mosca, un punto amarillo que parpadea al acercarse su caducidad.
- `drawBarraTiempo(ctx, tiempoMs, level)`: barra fina en los 6 px inferiores del canvas, que
  se acorta y pasa a magenta por debajo de 5 s. Es **estado del juego**, no HUD de la
  plataforma: no hay ningún callback que pueda transportarlo (ver `05-decisiones.md`).

**Sin puntuación, sin vidas, sin nivel, sin GAME OVER y sin overlay de pausa dentro del
canvas**: eso lo pinta la plataforma.

Verificación: `npm run build` compila.

## 5. Dibujo de los móviles y de la rana

- `drawMovil(ctx, carril, movil)`: un solo dispatch por `def.tipo`. Vehículo: rectángulo
  redondeado del color del carril, con `shadowBlur` corto para el glow, dos ventanillas y
  faros en el morro según `dir`. Tronco: rectángulo marrón con tres vetas. Tortuga: dos o
  tres caparazones de `--cyan` con la cúpula más oscura; en `"parpadeo"` alterna la opacidad
  cada 150 ms, y en `"sumergida"` **no se dibuja**, para que se vea el agua donde antes había
  suelo.
- `drawRana(ctx, …)`: cuerpo redondeado en `--green`, dos patas traseras, dos ojos claros con
  pupila oscura orientados según el último salto, y un aplastamiento vertical durante la
  interpolación del salto (se estira al despegar y se recoge al caer). Durante `"muriendo"`
  se dibuja en magenta parpadeando.

Verificación: `npm run build` compila.

## 6. Motor y bucle

`createFroggerGame(canvas, callbacks)` con `getContext("2d")` y su guard, el estado en el
closure, los emisores con deduplicación, `summary(reason)`, `initGame()`, `nuevoIntento()`,
`subirNivel()`, `matar(motivo)`, `update(dt)`, `draw()`, `loop(ts)`, `stopLoop()` y el
`GameHandle`:

- `loop(ts)` con `dt = lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, 0.05)`. Sin
  el cap, volver de otra pestaña teletransporta los coches por encima de la rana.
- `update(dt)` en el orden de "Reglas, en una pasada" de `02-motor.md`. `elapsedMs += dt * 1000`
  dentro del bucle, nunca `Date.now()`: como el bucle se para al pausar, el tiempo en pausa
  queda fuera sin escribir una línea para ello.
- `start()` re-entrante (`stopLoop()` antes de `initGame()`) porque es lo que usa "JUGAR DE
  NUEVO", y emite los tres callbacks **forzados** para resetear el HUD.
- `pause()` / `resume()` con `input.clear()` en **ambos**, y `lastTime = null` al parar el
  bucle: así teclear en pausa no dispara saltos al reanudar.
- `end()` con la guardia `if (state === "gameover") return;` — es la primera de las dos
  barreras contra registrar la partida por duplicado en Supabase.
- `destroy()` = `stopLoop()` + `input.detach()`, **sin emitir `onGameOver`**: desmontar el
  componente no es terminar una partida.

Verificación: `npm run build` y `npm run lint` limpios.

## 7. Registro

Añadir a `app/lib/games/registry.ts` la entrada `ranaria: createFroggerGame` en
`GAME_ENGINES` y sus controles en `GAME_CONTROLS`:

```ts
// RANARIA tampoco usa ESPACIO: la rana solo salta con flechas o WASD, así que la
// tecla que abre la partida desde el overlay no hace nada dentro.
ranaria: [
  ["← → ↑ ↓", "SALTAR"],
  ["W A S D", "SALTAR"],
  ["ESC", "PAUSA"],
],
```

Verificación: `/juego/ranaria/jugar` monta el canvas real en vez de la arena simulada, y el
overlay de arranque anuncia estos tres controles y no los de ROCAS.

## 8. Ajuste jugable

Recorrer `04-aceptacion.md` con el MCP de Playwright, incluyendo una partida registrada en
`/salon`. Dos cosas que solo se ven jugando y que se corrigen tocando **constantes**, no
diseño:

- Si el primer cruce resulta imposible, bajar `vel` de los carriles 7 y 9 o subir su `hueco`.
- Si la rana muere por roces injustos, subir `RANA_INSET`.

Verificación: a 1280×800 el tablero llena el marco CRT sin deformarse; a 375 px sale el aviso
de teclado y no hay scroll horizontal.
