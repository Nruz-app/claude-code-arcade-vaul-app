# Contrato de un motor de juego

Esto no es un motor de ejemplo para copiar y pegar: es la **forma** que debe respetar
cualquier motor para encajar en el reproductor. Cada regla lleva su porqué, porque casi
todas existen para evitar un fallo concreto que ya se pagó al portar ROCAS.

La referencia viva es `app/lib/games/asteroids.ts` (703 líneas). Léelo cuando dudes de
cómo se resuelve algo en la práctica.

---

## El contrato, literal

`app/lib/games/types.ts` — no lo modifiques al portar un juego. Si un juego no encaja
aquí, es una conversación previa con el usuario, no un cambio silencioso.

```ts
export type GameOverReason = "game_over" | "surrender";

export interface GameOverSummary {
  score: number;
  level: number; // nivel alcanzado
  durationMs: number; // tiempo jugado, sin contar pausas
  reason: GameOverReason;
}

export interface GameCallbacks {
  onScore: (score: number) => void;
  onLives: (lives: number) => void;
  onLevel: (level: number) => void;
  onGameOver: (summary: GameOverSummary) => void;
}

export interface GameHandle {
  start: () => void; // arranca una partida nueva desde cero
  pause: () => void;
  resume: () => void;
  end: () => void; // rendirse: termina y emite onGameOver con "surrender"
  destroy: () => void; // cancela el rAF y quita los listeners
}

export type GameFactory = (
  canvas: HTMLCanvasElement,
  callbacks: GameCallbacks,
) => GameHandle;
```

Cinco métodos y cuatro callbacks, ni uno más. La factory es **síncrona** y **no arranca
el bucle**: eso lo hace `start()`.

---

## Las diez invariantes

### 1. Nada de estado a nivel de módulo

Todo el estado de partida vive en el closure de la factory:

```ts
export const createTetrisGame: GameFactory = (canvas, callbacks) => {
  let board: Cell[][];
  let score = 0;
  let rafId: number | null = null;
  // …
};
```

En Next un `let` de módulo **sobrevive entre montajes**. Con el estado fuera del closure,
navegar a otro juego y volver arrastra la puntuación anterior y deja bucles vivos. Es la
diferencia número uno respecto a los `game.js` de referencia, que son todos globales.

### 2. `draw(ctx)` recibe el contexto, no lo captura

Patrón uniforme de entidad: campos públicos + `dead` + `update(dt)` + `draw(ctx)`.

```ts
class Pieza {
  dead = false;
  update(dt: number) { … }
  draw(ctx: CanvasRenderingContext2D) { … }
}
```

Es lo que permite que importar el módulo no dependa de que exista un canvas.

### 3. Canvas 800×600

El reproductor lo escribe fijo en el JSX (`app/juego/[id]/jugar/page.tsx`) y `.crt-screen`
declara `aspect-ratio: 4 / 3` en `globals.css`. Un motor con otra resolución lógica sale
deformado o descuadrado.

Si el juego original usa otras dimensiones (Tetris son 300×600), **no cambies el canvas**:
adapta el juego dentro de 800×600, centrando el tablero y usando el espacio sobrante para
lo que el original ponía fuera del canvas.

Exporta `W` y `H` como constantes, igual que `asteroids.ts`.

### 4. Sin HUD ni overlays dentro del canvas

La puntuación, las vidas, el nivel, el "GAME OVER" y la pausa los pinta la plataforma.
El motor solo dibuja el juego.

Es la parte que más hay que **borrar** al portar. Arkanoid dibuja su HUD y un selector de
nivel clicable dentro del canvas; Tetris tiene un overlay en DOM y escribe en elementos
con `getElementById`. Todo eso desaparece: se sustituye por los callbacks.

### 5. Teclado encapsulado

Copia el patrón de la clase `Input` de `asteroids.ts`:

- Handlers como **propiedades flecha** (`private onKeyDown = (e) => {…}`), no métodos.
  Con un método, `removeEventListener` recibe otra referencia y el listener no se quita.
- `attach()` idempotente (`if (this.attached) return;`).
- Listeners en `window`, no en el canvas: así no hace falta que el canvas tenga el foco.
- `preventDefault` **solo** sobre las teclas del juego y **solo** mientras el motor está
  enganchado. Si no, el juego bloquea el scroll de la página fuera de la partida.
- Distingue tecla mantenida (`isHeld`) de pulsación única (`wasPressed`, que se consume al
  leerla). Sin esa distinción, rotar una pieza gira tres veces por pulsación.

Usa `e.code` (`"ArrowLeft"`, `"Space"`, `"KeyX"`), no `e.key`: `code` es independiente de
la distribución del teclado.

### 6. `elapsedMs += dt * 1000` dentro del bucle

Nunca `Date.now()` ni una marca de inicio. Como el bucle se detiene al pausar, **el tiempo
en pausa queda fuera sin escribir una línea para ello**. Es una decisión explícita de la
SPEC 06: la columna `duration_ms` mide tiempo jugado, no tiempo transcurrido.

### 7. `dt` capado

```ts
const dt = lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, 0.05);
```

Sin el cap, volver de otra pestaña genera un `dt` enorme y las entidades se teletransportan
—en Arkanoid la bola atraviesa los bloques—. Al parar el bucle, pon `lastTime = null` para
que reanudar no produzca un salto.

### 8. Emitir solo al cambiar, pero forzar en el reinicio

Los callbacks provocan renders de React. Emitir en cada frame vuelve la pantalla lenta:

```ts
function setScore(next: number) {
  if (next === score) return;
  score = next;
  callbacks.onScore(score);
}
```

**Excepción:** en `initGame()` emite los tres directamente, sin pasar por los setters. Al
reiniciar, los valores coinciden con los de la partida anterior y el HUD se quedaría
mostrando la puntuación vieja.

### 9. `end()` con guardia, `destroy()` sin emitir

```ts
end() {
  if (state === "gameover") return; // no emitir el fin dos veces
  state = "gameover";
  stopLoop();
  callbacks.onGameOver(summary("surrender"));
},
destroy() {
  stopLoop();
  input.detach();
},
```

La guardia de `end()` es la **primera de dos barreras** contra registrar la partida por
duplicado en Supabase; la segunda es `registradaRef` en el reproductor. Cubre pulsar FIN
después de un game over natural, y pulsar FIN dos veces.

`destroy()` **no emite `onGameOver`**: desmontar el componente no es terminar una partida.
Si emitiera, navegar fuera registraría una partida fantasma.

`start()` debe ser re-entrante (llamar `stopLoop()` antes de `initGame()`): es lo que usa
el botón "JUGAR DE NUEVO".

### 10. Colores del tema como literales

El canvas no entiende variables CSS. Copia los tokens de `:root` con un comentario que lo
diga, como hace `asteroids.ts`:

```ts
// Son los mismos valores que los tokens de :root en app/globals.css. Si el tema
// cambia, hay que tocar los dos sitios.
const COLORS = {
  bg: "#000",
  ship: "#00f5ff", // --cyan
  thruster: "rgba(245,255,0,0.85)", // --yellow
  bullet: "#e6e9ff", // --ink
  powerUp: "#ff006e", // --magenta
} as const;
```

Un juego en blanco puro sobre negro dentro del marco CRT de neón se ve como una ventana
ajena pegada encima.

---

## Esqueleto de archivo

El orden de secciones de `asteroids.ts`, con banners `// ── Nombre ───`:

```
1. Cabecera doc     — de dónde viene y qué se cambió a propósito
2. import type      — solo tipos: cero dependencias en runtime
3. Constantes       — W, H, COLORS, tuning
4. Utilidades       — helpers puros (wrap, dist, rand)
5. Teclado          — class Input
6. Entidades        — una clase por entidad
7. Motor            — export const createXGame: GameFactory
```

El motor, por dentro: preámbulo (`getContext("2d")` con guard) → estado en el closure →
setters con deduplicación → `summary(reason)` → funciones internas (`initGame`, `update`,
`draw`, `loop`, `stopLoop`) → el objeto `GameHandle` devuelto.

---

## Qué NO tocar al portar un juego

- **`app/juego/[id]/jugar/page.tsx`** — el reproductor ya es genérico. Si crees que hay que
  tocarlo, probablemente el motor esté haciendo algo que le toca a la plataforma.
- **`app/juego/[id]/page.tsx`** — el detalle sigue con `seededScores`. Es deuda declarada
  de la SPEC 07 y tiene su propia spec pendiente.
- **`app/salon/`** — el Salón de la Fama funciona solo para cualquier juego nuevo. Las
  pestañas salen de `GAMES` y `game_id` es texto libre en `game_sessions`.
- **`supabase/migrations/`** — no hace falta ninguna migración para un juego nuevo.
- **El campo `best` de `GAMES`** — sigue siendo el número mock. Cambiarlo es otra spec.
- **`app/lib/games/types.ts`** — el contrato es estable desde la SPEC 06.
