# SPEC 05 — ROCAS: el primer juego real

> **Estado:** Implementado
> **Depende de:** SPEC 01
> **Fecha:** 2026-08-09
> **Objetivo:** Portar el Asteroids de `references/templates/started-games/02-asteroids/` a un motor TypeScript sobre canvas y montarlo en `/juego/rocas/jugar`, dejando el reproductor simulado para los otros siete juegos.

---

## Por qué existe esta spec

Hasta ahora `/juego/[id]/jugar` es una **simulación**: un `setInterval` sube la puntuación sola y
la "arena" es un montón de `<div>` animados por CSS. Esta spec mete el primer juego de verdad.

El hueco ya existe en el catálogo: `GAMES` incluye `rocas` — _"ROCAS · Pulveriza asteroides en
gravedad cero"_, categoría `SHOOTER`, acento amarillo. No hay que inventar una entrada nueva.

El código de referencia son 510 líneas de JavaScript con variables globales, acceso directo al
DOM y su propio HUD dibujado dentro del canvas. Nada de eso encaja tal cual en un componente de
React que se monta y desmonta. El trabajo real de esta spec es **convertir ese script en un motor
con contrato**, para que el segundo juego (Tetris, Arkanoid) sea añadir una entrada a un registro
y no repetir toda la integración.

---

## Alcance

**Dentro:**

- **Contrato de motor de juego** en `app/lib/games/types.ts`: `GameHandle`
  (`start`/`pause`/`resume`/`destroy`), `GameCallbacks` (`onScore`/`onLives`/`onLevel`/
  `onGameOver`) y `GameFactory`.
- **Motor de Asteroids** en `app/lib/games/asteroids.ts`: puerto completo de `game.js` sin
  variables globales, sin `document.getElementById` y sin HUD propio. Incluye nave, asteroides
  con división por tamaños, balas, partículas de explosión, vidas con invencibilidad al
  reaparecer, niveles y el **power-up de triple disparo**.
- **Registro de juegos** en `app/lib/games/registry.ts`: mapa de `id` de `GAMES` a `GameFactory`.
  Hoy con una sola entrada, `rocas`.
- **Despachador en `app/juego/[id]/jugar/page.tsx`**: si el `id` tiene motor registrado, monta el
  canvas real; si no, mantiene la simulación actual intacta.
- **HUD de la plataforma alimentado por el motor**: puntuación, vidas y nivel salen de los
  callbacks. Se eliminan `drawHUD()` y el overlay de GAME OVER del canvas.
- **Fin de partida por el modal existente**, con "GUARDAR PUNTUACIÓN" y "JUGAR DE NUEVO".
- **Arranque explícito**: overlay "PULSA ESPACIO PARA EMPEZAR" con los controles.
- **Pausa por tres vías**: el botón PAUSA del HUD, la tecla `Escape` y automáticamente al perder
  el foco la pestaña.
- **Paleta del proyecto** dentro del canvas: nave en cian, propulsor amarillo, asteroides en
  blanco tenue, power-up magenta.
- **`preventDefault`** sobre flechas y espacio mientras la partida está activa, para que el juego
  no scrollee la página.
- **Aviso en pantallas pequeñas** de que ROCAS necesita teclado.
- **CSS nuevo en `app/globals.css`**: `.game-canvas`, overlay de arranque y aviso de teclado.

**Fuera de alcance (para specs futuras):**

- **Los otros siete juegos.** `bloque-buster`, `caida`, `serpentina`, `gloton`, `invasores`,
  `ranaria` y `duelo-pixel` siguen con el reproductor simulado, sin cambios.
- **Controles táctiles.** En móvil el juego se monta pero no se puede jugar; solo se avisa.
- **Puntuaciones en base de datos.** `saveScore()` sigue escribiendo en `localStorage`
  (`av_scores`), como dejó SPEC 01. Supabase para puntuaciones es otra spec.
- **El campo `best` de `GAMES`.** Sigue siendo el número mock; no se recalcula con lo que juegues.
- **`/salon`.** Sigue con `seededScores()`.
- **Distintivo visual de "juego jugable"** en la biblioteca o en el detalle. No se toca `data.ts`
  ni ninguna otra pantalla.
- **Sonido.** El original no tiene y no se añade.
- **OVNIs enemigos**, que la descripción larga de `rocas` menciona ("Cuidado con los OVNIs en el
  horizonte"). No están en el código de referencia y no se inventan aquí.
- **Corregir el nombre por defecto del modal de fin.** Ver el aviso en Riesgos: hoy
  `app/juego/[id]/jugar/page.tsx` calcula `useState(user ? user.name : "INVITADO")` en el primer
  render, cuando `user` todavía es `null`, así que **quien tiene sesión guarda su puntuación como
  "INVITADO"**. Es un defecto anterior a esta spec y su arreglo no entra aquí; si lo quieres
  dentro, dilo antes de aprobar.
- **Reglas `prefers-reduced-motion`.** Deuda conocida desde SPEC 01.
- **Tests automatizados** (sigue sin haber runner configurado).

---

## Modelo de datos

No se toca `app/lib/data.ts`: `GAMES`, `Game` y `ScoreRow` quedan como están. Tampoco cambian
`av_scores` ni `StoredScore`.

### Contrato de motor (nuevo)

```ts
// app/lib/games/types.ts

export interface GameCallbacks {
  onScore: (score: number) => void;
  onLives: (lives: number) => void;
  onLevel: (level: number) => void;
  onGameOver: (score: number) => void; // puntuación final
}

export interface GameHandle {
  start: () => void; // arranca una partida nueva desde cero
  pause: () => void;
  resume: () => void;
  destroy: () => void; // cancela el rAF y quita los listeners
}

export type GameFactory = (
  canvas: HTMLCanvasElement,
  callbacks: GameCallbacks,
) => GameHandle;
```

```ts
// app/lib/games/registry.ts
// La clave es el id de GAMES. Lo que no esté aquí usa el reproductor simulado.
export const GAME_ENGINES: Partial<Record<string, GameFactory>>;
```

### Estado interno del motor

Vive en el closure de `createAsteroidsGame`, **no en React** y **no en globals de módulo**. Son
las mismas variables que hoy son globales en `game.js`:

```ts
// dentro de createAsteroidsGame()
let ship: Ship;
let bullets: Bullet[];
let asteroids: Asteroid[];
let particles: Particle[];
let powerUps: PowerUp[];
let score: number;
let lives: number; // arranca en 3
let level: number; // arranca en 1
let state: "playing" | "dead" | "gameover" | "paused";
let deadTimer: number;
let powerUpSpawned: boolean;
let killsSinceSpawn: number;
let rafId: number | null;
let lastTime: number | null;
```

Constantes portadas tal cual del original, indexadas por tamaño de asteroide 1–3:

```ts
const W = 800,
  H = 600; // resolución lógica; el escalado es CSS
const RADII = [0, 16, 30, 50];
const SPEEDS = [0, 85, 55, 32];
const POINTS = [0, 100, 50, 20]; // pequeño 100, mediano 50, grande 20
const POWERUP_DROP_CHANCE = 0.15;
const POWERUP_DURATION = 5; // segundos de triple disparo
const POWERUP_TTL = 12; // segundos antes de que el power-up caduque
const TRIPLE_SPREAD = 0.18; // radianes de apertura entre balas
```

`state` gana el valor `"paused"`, que el original no tenía: allí el juego nunca se pausaba.

### Estado nuevo en el reproductor

`app/juego/[id]/jugar/page.tsx` conserva `score`, `lives`, `paused`, `over`, `name` y `saved`, y
añade uno:

```ts
// started: false hasta que el jugador pulsa ESPACIO en el overlay de arranque
```

`lives` deja de ser una constante (`useState(3)` sin setter) y pasa a alimentarse del motor en el
caso de `rocas`.

---

## Plan de implementación

Cada paso deja la app ejecutable (`npm run dev` / `npm run build` sin errores) y es commiteable
por sí solo. El motor se construye en cuatro pasos porque son ~450 líneas de puerto; hasta el
paso 6 nada de esto se monta en pantalla y la app sigue comportándose como hoy.

1. **Contrato y registro.** Crear `app/lib/games/types.ts` con `GameCallbacks`, `GameHandle` y
   `GameFactory`, y `app/lib/games/registry.ts` exportando `GAME_ENGINES` vacío.
   Verificación: `npm run build` compila; nada los importa todavía.

2. **Motor — utilidades y entidades pasivas.** Crear `app/lib/games/asteroids.ts` con las
   constantes, los helpers (`wrap`, `dist`, `rand`, `randInt`) y las clases `Bullet`, `Asteroid`
   (con `split()` y el polígono irregular), `PowerUp` y `Particle`, cada una con `update(dt)` y
   `draw(ctx)`. El `ctx` se pasa como argumento: ninguna clase captura un canvas del módulo.
   Verificación: `npm run build` compila con tipado strict.

3. **Motor — nave y entrada de teclado.** Añadir la clase `Ship` (rotación, propulsión, drag,
   invencibilidad, `tryShoot()` con triple disparo) y un gestor de teclado encapsulado que
   registra los listeners al arrancar y los quita en `destroy()`. El gestor hace `preventDefault`
   sobre `ArrowLeft`, `ArrowRight`, `ArrowUp`, `ArrowDown` y `Space`, y solo mientras el motor
   está activo.
   Verificación: `npm run build` compila; sigue sin montarse nada.

4. **Motor — bucle, colisiones y callbacks.** Añadir `createAsteroidsGame(canvas, callbacks)`:
   `initGame()`, `spawnAsteroids()`, `nextLevel()`, `explode()`, `killShip()`, `update(dt)`,
   `draw()` y el `loop(ts)` con `dt` capado a 50 ms. Emite `onScore` al puntuar, `onLives` al
   perder una vida, `onLevel` al cambiar de nivel y `onGameOver` al agotar las vidas. **No**
   se portan `drawHUD()`, `drawOverlay()` ni el reinicio con `Space` desde `gameover`: de eso se
   encarga la plataforma. Registrar el motor en `GAME_ENGINES` bajo la clave `rocas`.
   Verificación: `npm run build` compila y `npm run lint` pasa.

5. **Paleta del proyecto.** Sustituir los colores del original por los tokens del tema, como
   constantes en el motor: nave `#00f5ff` (`--cyan`), propulsor `#f5ff00` (`--yellow`), balas y
   asteroides `#e6e9ff` (`--ink`, los asteroides con opacidad), partículas amarillas que se
   desvanecen y power-up `#ff006e` (`--magenta`).
   Verificación: `npm run build` compila; los colores se ven en el paso 6.

6. **Integración en el reproductor.** En `app/juego/[id]/jugar/page.tsx`, resolver
   `GAME_ENGINES[game.id]`. Si hay motor: renderizar `<canvas width={800} height={600}>` dentro
   de `.crt-screen` en lugar de `.game-arena`, crearlo en un `useEffect` con los callbacks que
   actualizan `score`, `lives` y `level`, y llamar a `destroy()` en el cleanup. `onGameOver` pone
   `over` a `true` y abre el modal existente. El botón FIN llama a `destroy()` y abre el modal con
   lo puntuado; "JUGAR DE NUEVO" reinicia el motor. Si no hay motor, el `setInterval` y la arena
   CSS siguen exactamente como hoy.
   Verificación: `/juego/rocas/jugar` se juega con las flechas y el espacio, la puntuación sube en
   el HUD al destruir asteroides y al perder las tres vidas se abre el modal.
   `/juego/caida/jugar` sigue simulado.

7. **Arranque y pausa.** Añadir el estado `started` y el overlay "PULSA ESPACIO PARA EMPEZAR" con
   la lista de controles; el motor no arranca hasta entonces. Conectar el botón PAUSA a
   `pause()`/`resume()`, añadir `Escape` como atajo y pausar automáticamente en el evento
   `blur` de la ventana.
   Verificación: al entrar no se pierde ninguna vida hasta pulsar espacio; cambiar de pestaña
   deja el juego en pausa y el HUD muestra "REANUDAR".

8. **CSS y aviso de teclado.** Añadir a `app/globals.css` la clase `.game-canvas`
   (`width: 100%; height: 100%; display: block`), el overlay de arranque reutilizando el patrón
   del bloque de pausa que ya existe, y `.game-keyboard-note`, visible solo por debajo de 720 px,
   avisando de que ROCAS necesita teclado.
   Verificación: a 1280×800 el canvas llena el marco CRT sin deformarse; a 375 px se ve el aviso
   y no hay scroll horizontal.

---

## Criterios de aceptación

**Build**

- [ ] `npm run lint` y `npm run build` terminan sin errores ni warnings de tipos.
- [ ] La consola del navegador no muestra errores al cargar `/juego/rocas/jugar`.
- [ ] `app/lib/games/asteroids.ts` no declara ninguna variable de estado de partida a nivel de
      módulo: todo vive dentro de `createAsteroidsGame`.

**El juego funciona**

- [ ] `←` y `→` rotan la nave; `↑` propulsa y dibuja la llama; `Espacio` dispara.
- [ ] Ninguna de esas teclas scrollea la página mientras la partida está activa.
- [ ] Un asteroide grande se parte en dos medianos y cada mediano en dos pequeños; los pequeños
      no se parten.
- [ ] Destruir asteroides suma 20 (grande), 50 (mediano) y 100 (pequeño) puntos.
- [ ] Al destruir todos los asteroides empieza el nivel siguiente con más asteroides.
- [ ] La nave y los asteroides reaparecen por el borde opuesto al salir de la pantalla.
- [ ] Al chocar, la nave explota en partículas, se pierde una vida y reaparece parpadeando
      (invencible unos segundos).
- [ ] El power-up `3x` aparece tras destruir asteroides, y al recogerlo la nave dispara tres
      balas en abanico durante unos segundos.
- [ ] El power-up parpadea antes de caducar y desaparece si no se recoge.

**Integración con la plataforma**

- [ ] El HUD de la plataforma muestra la puntuación real del juego, no una simulada.
- [ ] El HUD muestra 3 vidas al empezar y va bajando al chocar.
- [ ] El HUD muestra el nivel y sube al completar uno.
- [ ] El canvas **no** dibuja HUD ni overlay de GAME OVER: esa información solo está en la UI de
      la plataforma.
- [ ] Al perder la tercera vida se abre el modal "FIN DEL JUEGO" con la puntuación final.
- [ ] "GUARDAR PUNTUACIÓN" añade la entrada a `av_scores` en `localStorage`.
- [ ] "JUGAR DE NUEVO" reinicia la partida con puntuación 0, 3 vidas y nivel 1.
- [ ] El botón FIN termina la partida y abre el modal con lo puntuado hasta ese momento.
- [ ] "SALIR" vuelve a `/juego/rocas` y el bucle deja de ejecutarse.

**Arranque y pausa**

- [ ] Al entrar en `/juego/rocas/jugar` el juego está detenido y se ve "PULSA ESPACIO PARA
      EMPEZAR" con los controles.
- [ ] No se pierde ninguna vida antes de pulsar espacio.
- [ ] El botón PAUSA congela el juego y cambia a "REANUDAR"; volver a pulsarlo lo reanuda.
- [ ] `Escape` pausa y reanuda igual que el botón.
- [ ] Cambiar a otra pestaña deja el juego en pausa.

**Lo que no debe romperse**

- [ ] `/juego/caida/jugar` y el resto de los siete juegos siguen con el reproductor simulado, con
      su puntuación automática y su arena CSS.
- [ ] El marco CRT, sus líneas de barrido y la barra inferior siguen igual en las dos variantes.
- [ ] A 375 px de ancho la pantalla no produce scroll horizontal y se ve el aviso de teclado.
- [ ] Navegar fuera de `/juego/rocas/jugar` y volver arranca una partida limpia, sin bucles
      duplicados ni la puntuación anterior.

---

## Decisiones

**Alcance e integración**

- **Sí:** despachador por `id` en el reproductor que ya existe. Los siete juegos simulados siguen
  intactos y añadir Tetris o Arkanoid será registrar una `GameFactory` más.
- **No:** una ruta propia para ROCAS. Duplicaría el HUD, el marco CRT y el modal, y habría que
  volver a duplicarlos con el segundo juego.
- **No:** eliminar el reproductor simulado. Dejaría siete pantallas peor de lo que están hoy.
- **Sí:** usar la entrada `rocas` que ya está en `GAMES`. Su descripción ("Pulveriza asteroides
  en gravedad cero") es exactamente este juego.
- **No:** distintivo de "jugable" en biblioteca y detalle. Toca dos pantallas más y esta spec ya
  es un porte grande; si hace falta, va en su propia spec.

**Arquitectura**

- **Sí:** motor en TypeScript aislado del framework, con `GameHandle` y callbacks. El original
  usa globals de módulo, que en Next sobreviven entre montajes y son una fuga garantizada al
  navegar entre juegos.
- **No:** pegar el JS dentro de un `useEffect`. Funciona a la primera y falla al segundo montaje.
- **No:** reescribir la simulación en estado de React. Un bucle a 60 fps no puede pasar por
  `setState` en cada frame.
- **Sí:** `ctx` como parámetro de `draw(ctx)` en cada entidad, en vez de capturarlo del módulo.
  Es lo que permite que el motor no dependa de que exista un canvas concreto al importarlo.
- **Sí:** contrato genérico (`types.ts`) desde el primer juego, aunque solo haya uno. Escribirlo
  con dos juegos ya hechos significa refactorizar los dos.

**Juego**

- **Sí:** se conserva el power-up de triple disparo. Está escrito y probado en la referencia; el
  README simplemente está desactualizado respecto al código.
- **No:** añadir los OVNIs que menciona la descripción de `rocas` en `GAMES`. No existen en el
  código de referencia; inventarlos es diseñar un juego, no portarlo.
- **Sí:** mando la plataforma para HUD y fin de partida. Es lo que permite guardar la puntuación
  en `av_scores` sin duplicar interfaz dentro del canvas.
- **No:** conservar `drawHUD()` y el `GAME OVER` del canvas. Duplicarían en pantalla lo que ya
  muestran el HUD y el modal.
- **No:** conservar el reinicio con `Space` desde `gameover` del original. Entra en conflicto con
  el botón "JUGAR DE NUEVO" del modal y con el espacio del overlay de arranque.

**Presentación**

- **Sí:** paleta del proyecto dentro del canvas. El juego va dentro de un marco CRT de neón; el
  blanco puro sobre negro se ve como una ventana ajena pegada encima.
- **No:** canvas responsive que recalcule `W` y `H`. Obligaría a revisar spawn, envolvimiento de
  bordes y velocidades, y haría que la dificultad dependiera del tamaño de la ventana.
- **Sí:** resolución lógica fija de 800×600 escalada por CSS. `.crt-screen` ya tiene
  `aspect-ratio: 4 / 3`, que es exactamente la proporción de 800×600: el canvas encaja sin
  deformarse y la física no se toca.
- **Sí:** overlay de arranque. Sin él pierdes vidas mientras lees los controles, y además deja
  claro que la pantalla espera teclado.
- **Sí:** auto-pausa al perder el foco. El `dt` capado a 50 ms evita que el juego dé un salto,
  pero volver de otra pestaña con la nave a la deriva se siente como una muerte injusta.
- **Sí:** aviso en móvil en vez de controles táctiles. Los táctiles son una capa de UI y de estado
  que duplicaría el tamaño de esta spec.

---

## Riesgos

| Riesgo                                                                                                                                                                                                                                                                                                           | Mitigación                                                                                                                                                                                                                       |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Quien tiene sesión guarda su puntuación como "INVITADO".** `app/juego/[id]/jugar/page.tsx` calcula `useState(user ? user.name : "INVITADO")` en el primer render, cuando `user` todavía es `null` porque el contexto resuelve la sesión tras el montaje. Con Supabase (SPEC 04) la ventana es mayor que antes. | Defecto anterior a esta spec y declarado fuera de alcance. Se documenta aquí para que no se pierda. El arreglo es sincronizar `name` con `user` en un efecto; si se quiere dentro, hay que decidirlo antes de aprobar esta spec. |
| En desarrollo, React monta los efectos dos veces. Si `destroy()` no cancela el `requestAnimationFrame` y no quita los listeners de teclado, quedan dos bucles corriendo: el juego va al doble de velocidad y las teclas se procesan dos veces.                                                                   | `destroy()` cancela el `rafId` y elimina los listeners; el `useEffect` del paso 6 lo llama en el cleanup. Hay un criterio de aceptación que verifica que salir y volver arranca una partida limpia.                              |
| `preventDefault` sobre `Space` y las flechas puede bloquear el scroll de la página o la activación de botones con teclado si el listener queda vivo fuera de la partida.                                                                                                                                         | Los listeners solo existen entre `start()` y `destroy()`, y `preventDefault` se aplica únicamente a esas cinco teclas.                                                                                                           |
| El motor emite `onScore` en cada impacto. Si cada callback provoca un render de React durante el bucle, la pantalla se puede volver lenta.                                                                                                                                                                       | Solo se emite al cambiar el valor, no en cada frame: los impactos son eventos discretos, no continuos. Si aun así se notara, agrupar las emisiones es un cambio interno del motor, no del contrato.                              |
| El canvas se estira por CSS. Si el contenedor deja de ser 4:3, la nave se ve ovalada.                                                                                                                                                                                                                            | El canvas va dentro de `.crt-screen`, que ya declara `aspect-ratio: 4 / 3`. Queda documentado aquí porque el día que alguien cambie esa regla, el juego se deforma.                                                              |
| El juego se monta igualmente en móvil, donde no hay teclado: la nave queda quieta recibiendo impactos hasta perder las tres vidas.                                                                                                                                                                               | El paso 8 añade el aviso visible por debajo de 720 px. La partida no arranca sola: sin pulsar espacio no se pierde ninguna vida.                                                                                                 |
| El puerto son ~450 líneas de un único archivo de referencia; es fácil colar una errata silenciosa (un índice, un signo) que solo se note jugando.                                                                                                                                                                | El motor se parte en cuatro pasos (2–5) y los criterios de aceptación cubren cada mecánica por separado: división por tamaños, puntos por tamaño, envolvimiento, invencibilidad y power-up.                                      |

---

## Lo que **no** está en esta spec

- Los otros siete juegos del catálogo.
- Controles táctiles para móvil.
- Puntuaciones en base de datos y `/salon` con datos reales.
- Recalcular el campo `best` de `GAMES`.
- Distintivo de "jugable" en la biblioteca o el detalle.
- Sonido.
- Los OVNIs que menciona la descripción de `rocas`.
- El arreglo del nombre "INVITADO" en el modal de fin de partida.
- Reglas `prefers-reduced-motion`.
- Tests automatizados.

Cada una de esas, si aterriza, va en su propia spec.
