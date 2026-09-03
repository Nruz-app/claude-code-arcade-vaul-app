# SPEC 14 — MANDO TÁCTIL: los cinco juegos, en el teléfono

> **Estado:** Inplementado
> **Depende de:** SPEC 05, SPEC 08, SPEC 09, SPEC 10, SPEC 13
> **Fecha:** 2026-09-02
> **Objetivo:** que los cinco juegos con motor real se puedan jugar con el dedo en una pantalla táctil, mediante un mando en pantalla que despacha las mismas teclas que ya escuchan los motores, sin tocar `GameHandle` ni la lógica de ningún juego.

---

## Por qué existe esta spec

Hoy el reproductor es honesto y por eso es incómodo: en pantallas de menos de 720 px muestra
un cartel magenta —`.game-keyboard-note`— que dice **«SE JUEGA CON TECLADO. CONÉCTATE DESDE UN
ORDENADOR PARA JUGAR»**. No es un descuido, es una deuda declarada por escrito: la SPEC 10 dejó
_«Controles táctiles»_ explícitamente fuera de alcance, con la nota de teclado como paliativo.
Desde entonces el catálogo pasó de uno a cinco motores, y el paliativo se ha ido quedando como
la única respuesta del portal a media internet.

Lo que hace barata esta spec es un detalle del diseño de los motores que nadie escribió
pensando en el táctil, pero que lo resuelve entero:

**Los cinco motores generan ellos mismos la repetición al mantener pulsado.** `tetris.ts` lo
dice con todas las letras —_«El auto-repeat del sistema se descarta entero: su cadencia depende
de la configuración de cada máquina»_— y descarta `e.repeat` en el `keydown`; la repetición la
produce su propio DAS. Los otros cuatro ni siquiera la necesitan: `asteroids.ts` y
`arkanoid.ts` solo consultan qué está `held` en cada fotograma, y `snake.ts` y `frogger.ts`
encolan un giro o un salto por transición de suelta a pulsada.

La consecuencia es directa: **un `keydown` al apoyar el dedo y un `keyup` al levantarlo es
exactamente lo que los motores esperan**. No hace falta simular cadencias, ni ampliar el
contrato, ni tocar la lógica de ningún juego.

Y hay una segunda pieza que ya está en el repo: `tests/harness/motor.ts` exporta `pulsa(code)`,
que despacha `new KeyboardEvent("keydown", { code, bubbles: true, cancelable: true })` sobre
`window`. Es, literalmente, lo que va a hacer el mando. El mecanismo que elige esta spec lleva
probándose en cada ejecución de la suite desde la SPEC 08, solo que hasta hoy nadie lo había
llamado «mando».

### Lo que enseñó mirar el reproductor en un teléfono de verdad

De una captura en un teléfono real —de una versión hermana del portal, no de este repo: su
ruta es `/game`, su juego se llama `ASTEROIDS` y su selector de skin vive en el HUD— salen dos
observaciones que sí valen aquí, porque son de maquetación y este reproductor comparte la
estructura:

1. **En vertical el reproductor es una pila de bloques a todo el ancho**, no una composición.
   HUD arriba, canvas debajo, y hueco de sobra al pie. El mando es, sencillamente, el tercer
   bloque de esa pila; no hay que inventarle sitio.
2. **El HUD se descuadra al envolverse.** Las cuatro estadísticas y los tres botones caben en
   una fila en escritorio, pero en un teléfono `flex-wrap` los reparte en tres renglones donde
   los valores se montan sobre las etiquetas. Es ilegible justo en el aparato donde esta spec
   quiere que se juegue, así que entra en el alcance: de nada sirve un mando impecable bajo un
   marcador que no se lee.

Lo que **no** se toma de esa captura: ni agrandar el canvas a costa del marco CRT, ni bajar el
selector de aspecto al HUD. Los motivos están en **Decisiones**.

---

## Alcance

**Dentro:**

- **Un mando táctil en pantalla** para los cinco juegos con motor: `rocas`, `caida`,
  `bloque-buster`, `serpentina` y `ranaria`.
- **`GAME_TOUCH`**, un cuarto mapa por id en `registry.ts`, que declara qué botones tiene el
  mando de cada juego y qué `code` despacha cada uno.
- **`app/components/mando-tactil.tsx`**, componente nuevo que dibuja el mando y traduce
  `pointerdown` → `keydown` y `pointerup` → `keyup` sobre `window`.
- **Aparición por capacidad del puntero** (`@media (pointer: coarse)`), no por ancho.
- **Arranque táctil**: botón `EMPEZAR` en el overlay y toque en cualquier parte de él, con el
  texto adaptado al aparato.
- **Arrastre sobre el canvas en BLOQUE BUSTER**, con `touch-action: none` y **un `pointerdown`
  nuevo en `arkanoid.ts`** para que el primer toque coloque la paleta.
- **Corte de gestos del navegador** (scroll, zoom por doble toque, selección, destello de
  `:active`) **solo** sobre el canvas, el overlay y el mando.
- **El reproductor como pila de bloques a todo el ancho** en pantalla estrecha: HUD, CRT y
  mando, en ese orden, cada uno ocupando el ancho disponible.
- **HUD legible en móvil**: las cuatro estadísticas en una rejilla fija en vez de un `flex-wrap`
  que se descuadra, y los tres botones a lo ancho con objetivo táctil suficiente.
- **Retirada de `.game-keyboard-note`**, que deja de ser cierta.
- **Pruebas**: el cruce nuevo en `registry.test.ts` y `suelta(code)` en el harness, más una
  prueba de mando por motor.

**Fuera de alcance (para specs futuras):**

- **Tocar `app/lib/games/types.ts`.** `GameHandle` sigue con sus cinco métodos y `GameFactory`
  con sus tres parámetros. Si al implementar esto se acaba tocando el contrato, es señal de que
  el mando está haciendo algo que no le toca.
- **Tocar la lógica de los motores.** La **única** modificación en `app/lib/games/` es la línea
  de `pointerdown` en `arkanoid.ts`, y va justificada abajo.
- **Los tres juegos sin motor** (`gloton`, `invasores`, `duelo-pixel`). Caen en el reproductor
  simulado, donde no hay nada que controlar: un mando ahí no haría nada.
- **El resto de pantallas del portal.** Landing, biblioteca, detalle, salón y `/acerca` ya
  tienen sus media queries y no se auditan aquí. Del reproductor se toca el HUD y se añade el
  mando; el modal de fin, la pantalla de pausa y la barra de navegación se quedan como están.
- **Agrandar el canvas** a costa del marco CRT, o llevarlo a todo el ancho de la ventana. El
  CRT es la identidad de la pantalla de juego y su `aspect-ratio: 4/3` es lo que impide que el
  canvas de 800×600 salga deformado.
- **Mover el selector de aspecto al HUD.** Rompería la invariante de la SPEC 13.
- **Pantalla completa** (Fullscreen API). Añade un estado más al reproductor y se comporta
  distinto en iOS; merece su propia spec.
- **Vibración háptica.** `navigator.vibrate()` no existe en iOS y en los juegos de tecla
  mantenida cansa.
- **Gestos sobre el canvas** (deslizar para girar, tocar para disparar). Son invisibles: no hay
  forma de anunciarlos y compiten con el scroll.
- **Bloquear u obligar la orientación.** Se juega en vertical tal cual.
- **Configurar el mando** (recolocar botones, cambiar tamaños, zurdo/diestro).
- **Testing Library ni pruebas de componentes React.** El repo no las tiene y esta spec no las
  introduce; lo que se prueba es el mapa y el mecanismo, que son código sin React.
- **Migraciones de Supabase.** Nada nuevo que guardar.

---

## Modelo de datos

**No hay ninguna estructura persistida.** Ni Supabase ni `localStorage`: el mando no guarda
preferencias. Lo único nuevo es una estructura en memoria, `GAME_TOUCH`, que es metadata
estática por juego y vive en el registro, siguiendo la doctrina que ya fijaron `GAME_CONTROLS`
(SPEC 08) y `GAME_PALETAS` (SPEC 13): **lo que es metadata por juego y no comportamiento vive
en `registry.ts`, no en el contrato**.

### Archivos que aparecen o cambian

| Archivo                                   | Qué                                                                                                                                  |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `app/lib/games/registry.ts`               | `BotonTactil`, `MandoDeJuego` y `GAME_TOUCH`, con las cinco entradas.                                                                |
| `app/components/mando-tactil.tsx`         | **Nuevo.** El mando: dibuja los botones y despacha las teclas.                                                                       |
| `app/juego/[id]/jugar/page.tsx`           | Monta el mando, arranque táctil en el overlay, `.hud-stats` en lugar del estilo inline, y fuera `.game-keyboard-note`.               |
| `app/lib/games/arkanoid.ts`               | Una línea: `pointerdown` en `attach()`, y su pareja en `detach()`.                                                                   |
| `app/globals.css`                         | `.mando-*`, `.hud-stats`, el bloque `@media (pointer: coarse)`, el HUD compacto en `@media (max-width: 720px)` y el corte de gestos. |
| `tests/harness/motor.ts`                  | `suelta(code)`, la pareja de `pulsa()` que hoy no existe.                                                                            |
| `tests/games/registry.test.ts`            | El bloque «registro de mandos táctiles».                                                                                             |
| `tests/games/arkanoid.test.ts`            | `pointerdown` coloca la paleta; `destroy()` suelta los **dos** listeners.                                                            |
| `tests/games/*.test.ts` (los cinco)       | Una prueba por motor: los `code` de su mando producen su efecto.                                                                     |
| `specs/14-controles-tactiles-en-movil.md` | Esta spec.                                                                                                                           |

### La forma de un mando

```ts
// app/lib/games/registry.ts

// Un botón del mando. `code` es el mismo valor de `KeyboardEvent.code` que ya
// escucha el motor: el mando no inventa un vocabulario propio, despacha la
// tecla que el juego lleva escuchando desde su spec.
export interface BotonTactil {
  readonly code: string; // "ArrowLeft", "Space", "KeyX"…
  readonly accion: string; // para aria-label: "Rotar a la izquierda"
}

// Un botón de acción, de los redondos de la derecha. Lleva dos cosas más que
// uno de la cruceta porque se dibuja distinto.
export interface BotonAccion extends BotonTactil {
  readonly etiqueta: string; // la letra: "A"
  readonly tono: "cyan" | "magenta";
}

export type Direccion = "arriba" | "abajo" | "izquierda" | "derecha";

export interface MandoDeJuego {
  // La cruceta, a la izquierda. Parcial a propósito: BLOQUE BUSTER solo tiene
  // horizontal y ROCAS no tiene "abajo".
  readonly cruceta: Partial<Record<Direccion, BotonTactil>>;
  // Los botones de acción, a la derecha.
  readonly acciones: readonly BotonAccion[];
  // Si además se juega arrastrando el dedo por el canvas. Solo BLOQUE BUSTER.
  readonly arrastre?: boolean;
}

export const GAME_TOUCH: Partial<Record<string, MandoDeJuego>> = { … };
```

> **Corrección durante la implementación (paso 2).** La primera redacción de esta spec declaraba
> un único `BotonTactil` con un campo `glifo`, dando por hecho que todos los botones se dibujan
> con un carácter. Al portar el CSS de `references/gamepad-assets/gamepad.html` se vio que no:
> **la cruceta dibuja sus flechas con SVG inline** —así que la flecha sale de la clave de
> dirección y un `glifo` ahí sería dato muerto— y **los botones de acción llevan una letra** en
> la fuente pixel, más un color. De ahí los dos tipos. El campo `glifo` no existe.

### Las cinco entradas

Cada `code` sale del propio motor, no se inventa aquí. La columna «de dónde» es la constante o
la tabla del motor que ya lo escucha.

| Juego           | Cruceta                             | Acciones           | Arrastre | De dónde                                  |
| --------------- | ----------------------------------- | ------------------ | -------- | ----------------------------------------- |
| `rocas`         | `←` `→` rotar, `↑` propulsar        | `ESPACIO` disparar | —        | `PREVENT_DEFAULT` de `asteroids.ts`       |
| `caida`         | `←` `→` mover, `↓` bajar, `↑` rotar | `ESPACIO` soltar   | —        | `KEY_LEFT`…`KEY_DROP` de `tetris.ts`      |
| `bloque-buster` | `←` `→` mover paleta                | —                  | **sí**   | `KEY_LEFT` / `KEY_RIGHT` de `arkanoid.ts` |
| `serpentina`    | `←` `→` `↑` `↓` girar               | —                  | —        | tabla `DIRECCIONES` de `snake.ts`         |
| `ranaria`       | `←` `→` `↑` `↓` saltar              | —                  | —        | tabla `SALTOS` de `frogger.ts`            |

Los tres juegos que no usan `Space` dentro de la partida —BLOQUE BUSTER, SERPENTINA y
RANARIA— tampoco lo tienen en el mando: es coherente con la decisión, ya escrita en
`GAME_CONTROLS`, de dejar libre la tecla que abre la partida desde el overlay.

`caida` es el único con las cuatro direcciones **y** un botón de acción, y por eso es el caso
que fija el ancho del mando.

### Cómo llega el toque al motor

```
dedo apoya en ◀
   └─ pointerdown → setPointerCapture(e.pointerId)
        └─ window.dispatchEvent(new KeyboardEvent("keydown",
             { code: "ArrowLeft", bubbles: true, cancelable: true }))
             └─ Input.onKeyDown del motor → held["ArrowLeft"] = true
                  └─ el bucle del motor repite a su propio ritmo (DAS en CAÍDA)

dedo levanta
   └─ pointerup | pointercancel
        └─ window.dispatchEvent(new KeyboardEvent("keyup", { code: "ArrowLeft" … }))
             └─ Input.onKeyUp → held["ArrowLeft"] = false
```

`setPointerCapture` **no es un adorno**: sin él, apoyar el dedo en `↑` y deslizarlo fuera del
botón hace que el `pointerup` se entregue a otro elemento, el `keyup` nunca se despacha y la
nave propulsa para siempre. Con captura, el `pointerup` vuelve al botón que lo empezó pase lo
que pase.

Por el mismo motivo el mando **suelta todas las teclas que tenga pendientes al desmontarse**:
si el modal de fin aparece con un dedo apoyado, el `pointerup` ya no llega a nadie.

### Diseño en pantalla

El reproductor en vertical es **una pila de tres bloques a todo el ancho**. Ninguno se
superpone a otro y ninguno se sale del flujo normal de la página.

```
móvil, vertical                     escritorio (sin cambios)
┌────────────────────────┐          ┌────────────────────────────┐
│ JUG.  PUNT   ♥   NIVEL │ ①        │ HUD en una fila            │
│ NRUZ  12.400 ♥♥♥  03   │          │                            │
│ ┌──────┐┌────┐┌──────┐ │          ├────────────────────────────┤
│ │PAUSA ││FIN ││SALIR │ │          │                            │
│ └──────┘└────┘└──────┘ │          │      ┌──── CRT ────┐       │
├────────────────────────┤          │      │   canvas    │       │
│  ┌────── CRT ───────┐  │ ②        │      └─────────────┘       │
│  │      canvas      │  │          │                            │
│  └──────────────────┘  │          │  (el mando no se renderiza:│
├────────────────────────┤          │   @media (pointer: coarse))│
│    ▲           ┌────┐  │ ③        │                            │
│  ◀ ▼ ▶         │ ●  │  │          │                            │
│                └────┘  │          │                            │
└────────────────────────┘          └────────────────────────────┘
  cruceta        acción
```

**① El HUD.** Hoy es un `flex` con `justify-content: space-between` y `flex-wrap: wrap`, y las
cuatro estadísticas van dentro de un `div` con **estilo inline** (`display:flex; gap:24;
flexWrap:wrap`) escrito en el JSX. En un teléfono eso se parte en tres renglones y los valores
se montan sobre las etiquetas. El arreglo:

- Ese `div` pasa a ser `.hud-stats`, una clase. **Es un cambio obligado, no cosmético**: un
  estilo inline no lo puede sobrescribir una media query.
- En `@media (max-width: 720px)`: `.player-hud` en columna; `.hud-stats` como
  `grid-template-columns: repeat(4, 1fr)`, que reparte el ancho a partes iguales en vez de
  envolver; `.hud-stat .v` de 16 px a 12 px y `.l` de 10 px a 8 px, con menos `letter-spacing`.
- `.hud-actions` pasa a `grid-template-columns: repeat(3, 1fr)`: los tres botones ocupan el
  ancho y alcanzan los 44 px de alto que pide un objetivo táctil.
- El nombre del jugador admite 10 caracteres, así que su celda lleva `min-width: 0` y
  `text-overflow: ellipsis`, o vuelve a desbordar sobre la de al lado.

**② El CRT.** No cambia. Mantiene su marco y su `aspect-ratio: 4/3`; lo único que se le añade
es `touch-action: none` sobre el canvas.

**③ El mando.** Va **fuera del CRT**, debajo, en el flujo normal. No se superpone al canvas: en
4:3 sobre un teléfono vertical sobra alto por abajo —se ve en la captura de referencia—, y
superponerlo taparía juego para ahorrar un espacio que no hace falta ahorrar.

Objetivos táctiles de **56 px mínimo** por botón del mando, con separación entre la cruceta y
las acciones para que no se pulsen a la vez con el pulgar contrario.

---

## Plan de implementación

Cada paso deja la app compilando y la suite verde. **Los pasos 1 a 3 no cambian nada de lo que
ve un jugador con teclado**; el paso 5 es el primero que retira algo.

1. **`tests/harness/motor.ts`.** `suelta(code)`, gemela de `pulsa()` con `"keyup"`. Nadie la
   usa todavía. Es lo primero porque es lo que hace comprobables los pasos 2 y 4.
2. **`registry.ts`.** `BotonTactil`, `Direccion`, `MandoDeJuego` y `GAME_TOUCH` con las cinco
   entradas de la tabla de arriba. Más el bloque nuevo de `registry.test.ts`. Nadie importa
   `GAME_TOUCH` todavía.
3. **Una prueba de mando por motor**, en cada `tests/games/*.test.ts`: recorrer
   `GAME_TOUCH[id]`, despachar `pulsa(code)` y `suelta(code)` de cada botón y comprobar el
   efecto observable que ese archivo ya sabe comprobar (que SERPENTINA gira, que la paleta de
   BLOQUE BUSTER se mueve, que la rana salta). **Esto se hace antes de escribir el
   componente**: demuestra que el mecanismo funciona antes de construir la interfaz que lo usa.
4. **`app/components/mando-tactil.tsx`** y sus estilos. `pointerdown`/`pointerup`, captura de
   puntero, soltar todo al desmontar, `aria-label` por botón.
5. **El reproductor.** Monta el mando bajo el CRT cuando hay motor, arranque táctil en el
   overlay (botón `EMPEZAR` + toque en el fondo, excluyendo la zona del selector de aspecto),
   texto del overlay adaptado, y **fuera `.game-keyboard-note`** del JSX y del CSS.
6. **El HUD en móvil.** El estilo inline de las estadísticas pasa a `.hud-stats`, y el bloque
   de `@media (max-width: 720px)` con la rejilla, los tamaños y los botones a lo ancho. Va
   después del mando a propósito: así se ve el HUD con la pila de tres bloques ya montada y se
   ajusta contra lo que de verdad hay en pantalla, no contra una maqueta.
7. **BLOQUE BUSTER.** `pointerdown` en `Input.attach()` de `arkanoid.ts` con su
   `removeEventListener` en `detach()`, `touch-action: none` en el canvas, y las dos pruebas
   de `arkanoid.test.ts`.
8. **Verificación en aparato.** `npm run dev` y el MCP de Playwright emulando un dispositivo
   táctil: los cinco juegos, arranque, mando, pausa, fin y reinicio, más una captura vertical
   por juego para comprobar los tres bloques y que el HUD se lee de un vistazo. La captura de
   referencia es el listón: lo que allí se solapa, aquí no.
9. **Documentación.** `CLAUDE.md` (la tabla de real/mock no cambia, pero sí la descripción del
   reproductor y la de `registry.ts`), y la invariante de entrada del contrato de
   `.claude/skills/nuevo-juego/contrato.md`: **un motor nuevo declara también su mando**.

---

## Criterios de aceptación

**El contrato, intacto**

- [ ] `app/lib/games/types.ts` no cambia ni una línea.
- [ ] `GameHandle` sigue teniendo exactamente cinco métodos.
- [ ] `GAME_ENGINES[id].length` sigue valiendo 2 para los cinco.
- [ ] El único cambio en `app/lib/games/` es el `pointerdown` de `arkanoid.ts`; `git diff --stat app/lib/games/` lo confirma (más `registry.ts`, que no es un motor).

**El mando**

- [ ] Los cinco motores tienen entrada en `GAME_TOUCH`, y `registry.test.ts` falla si falta una.
- [ ] Ningún mando declara dos botones con el mismo `code`.
- [ ] Todo `code` declarado es uno que el motor escucha de verdad: la prueba por motor lo
      despacha y comprueba el efecto.
- [ ] `suelta(code)` libera el estado: mantener y soltar `←` en ROCAS deja la nave quieta, no
      girando para siempre.
- [ ] Apoyar el dedo en un botón, arrastrarlo fuera y levantarlo **suelta la tecla**.
- [ ] Desmontar el mando con una tecla apoyada la suelta.

**En el aparato**

- [ ] Los cinco juegos se completan de principio a fin con el dedo en un teléfono vertical, sin
      teclado: arrancar, jugar, pausar, reanudar, perder y volver a jugar.
- [ ] Arrastrar por el canvas de BLOQUE BUSTER mueve la paleta y **no** hace scroll ni zoom.
- [ ] Un toque simple en el canvas de BLOQUE BUSTER coloca la paleta.
- [ ] Machacar los botones no selecciona texto, no hace zoom por doble toque y no deja destello
      azul.
- [ ] Se puede hacer scroll de la página fuera de la zona de juego, y el botón SALIR es
      alcanzable.
- [ ] Bloquear el teléfono con la partida en marcha la pausa (`visibilitychange`, que ya está).

**El HUD y la pila de bloques**

- [ ] En vertical el reproductor son tres bloques apilados a todo el ancho —HUD, CRT, mando— y
      ninguno se superpone a otro.
- [ ] Las cuatro estadísticas caben en **una sola fila** y ningún valor se monta sobre su
      etiqueta ni sobre la celda contigua.
- [ ] Un nombre de 10 caracteres no desborda su celda.
- [ ] PAUSA, FIN y SALIR ocupan el ancho, tienen al menos 44 px de alto y no se solapan.
- [ ] El HUD no lleva ningún estilo inline de maquetación: las estadísticas van en `.hud-stats`.
- [ ] El selector de aspecto **sigue estando solo en el overlay de arranque**, no en el HUD.

**Sin regresión en escritorio**

- [ ] Con ratón y teclado el reproductor se ve y se comporta exactamente igual que antes: el
      mando no se renderiza.
- [ ] El overlay sigue diciendo «PULSA ESPACIO PARA EMPEZAR» y ESPACIO sigue arrancando.
- [ ] El selector de aspecto sigue respondiendo a 1/2/3 y sus botones siguen sin arrancar la
      partida por accidente.
- [ ] `npm run test:run`, `npm run lint` y `npm run build` en verde.
- [ ] `.game-keyboard-note` no aparece en ninguna búsqueda del repo.

---

## Decisiones

**Sí: eventos de teclado sintéticos.** Es la decisión que sostiene toda la spec, y la sostiene
un hecho del código: los cinco motores descartan el auto-repeat del sistema y generan su propia
cadencia, así que un `keydown` al apoyar y un `keyup` al levantar es literalmente su entrada
esperada. Además, `tests/harness/motor.ts` lleva despachando exactamente esos eventos desde la
SPEC 08: el mecanismo no es nuevo, solo es la primera vez que lo usa la interfaz y no una
prueba. Coste: cero líneas en cuatro de los cinco motores y cero en el contrato.

**No: un sexto método `input()` en `GameHandle`.** Es la vía tipada y limpia, y es cara: toca
`types.ts` (estable desde la SPEC 06), los cinco motores, `contrato.md` y las 27 aserciones
compartidas de `tests/harness/contrato.ts`, incluida la que cuenta los métodos. Compra
seguridad de tipos sobre un vocabulario —`AccionTactil`— que después habría que traducir a
`code` de todos modos para no duplicar el `Input` de cada motor. No paga.

**No: que cada motor escuche el canvas por su cuenta.** Repartiría la misma lógica de gestos
por cinco archivos y obligaría a todo juego futuro a reimplementarla. El contrato no cambia,
pero el coste marginal de cada juego nuevo sube, que es justo lo que la arquitectura de este
repo lleva cuidando desde la SPEC 06.

**Sí: `GAME_TOUCH` en el registro.** Tercera aplicación de la misma doctrina: `GAME_CONTROLS`
(qué teclas anunciar), `GAME_PALETAS` (qué colores ofrecer) y ahora `GAME_TOUCH` (qué botones
dibujar). Las tres son metadata por juego que no es comportamiento, y las tres las cruza
`registry.test.ts` contra `GAME_ENGINES` para que registrar un motor a medias no pase
inadvertido.

**Sí: `code` y no un vocabulario propio.** El mando podría declarar `"izquierda"` y traducirlo,
pero eso sería un segundo vocabulario que mantener sincronizado con el primero. Declarando el
`code` que el motor ya escucha, la prueba por motor verifica la traducción entera de una vez:
si alguien cambia una tecla en el motor, la prueba del mando se cae.

**Sí: un mando visible, no gestos.** Un swipe es invisible —no hay dónde anunciarlo— y compite
con el scroll de la página. Un botón se ve, se puede etiquetar para lectores de pantalla y no
tiene ambigüedad de intención. El precio es espacio en pantalla, y en 4:3 vertical ese espacio
sobra.

**Sí: `@media (pointer: coarse)` y no un ancho.** El umbral de 720 px que usa hoy
`.game-keyboard-note` se equivoca en las dos direcciones: esconde el mando en una tablet grande
y lo enseña en una ventana de escritorio estrecha. La pregunta que importa no es «cuánto mides»
sino «con qué señalas».

**Sí: el mando fuera del CRT.** Superponerlo taparía juego para ahorrar un alto que en vertical
sobra. Y mantiene el canvas como una superficie limpia, que es lo que permite que BLOQUE BUSTER
lo use entero para arrastrar.

**Sí: el HUD se arregla en esta spec y no en otra.** Se podría argumentar que es maquetación y
no controles, y que le tocaría su propia spec. Pero esta spec existe para que se pueda jugar en
un teléfono, y jugar incluye leer cuántas vidas quedan. Un mando impecable bajo un marcador
ilegible no cumple el objetivo. El alcance se acota igualmente: **solo el HUD del reproductor**,
ni el modal de fin, ni la pantalla de pausa, ni la navegación.

**Sí: el HUD por ancho y el mando por puntero.** Son dos umbrales distintos en el mismo archivo
y es deliberado. El HUD se descuadra porque la **ventana es estrecha**, y eso pasa igual en un
escritorio con la ventana a medias: va en `@media (max-width: 720px)`. El mando aparece porque
se señala **con el dedo**, que es independiente del ancho: va en `@media (pointer: coarse)`.
Unificar los dos criterios rompería uno de los dos casos, y el comentario del CSS lo dirá.

**Sí: el estilo inline de las estadísticas pasa a una clase.** No es limpieza opcional: un
`style={{ display:"flex" … }}` gana a cualquier regla de una media query, así que sin ese
cambio el HUD compacto sencillamente no se puede escribir.

**No: agrandar el canvas o quitarle el marco CRT.** Es lo primero que se piensa al ver el juego
pequeño en un teléfono, y sale caro: el `aspect-ratio: 4/3` del CRT es lo único que impide que
el canvas de 800×600 salga deformado —el propio CSS lo avisa por escrito— y el marco es la
identidad de la pantalla de juego. Si el tamaño resulta insuficiente en el paso 8, la salida es
una spec de pantalla completa, no desmontar el CRT.

**No: el selector de aspecto en el HUD.** Es lo que hace la captura de referencia, y aquí
rompería la invariante más frágil de la SPEC 13: `skin` está en las dependencias del efecto que
monta el motor, así que cambiarlo remonta el juego. Eso es inofensivo **solo** porque el
selector vive dentro del overlay de arranque, donde `start()` todavía no se ha llamado. En el
HUD, cambiar de aspecto reiniciaría la partida en curso, y no hay ninguna prueba que lo detecte.

**Sí: `setPointerCapture` en cada botón.** Sin captura, deslizar el dedo fuera de un botón
mantenido entrega el `pointerup` a otro elemento y la tecla se queda pulsada para siempre. Es
el fallo más probable de toda esta spec y el único que arruina una partida en vez de molestar.

**Sí: se toca `arkanoid.ts`, y es la única excepción.** El motor solo escucha `pointermove`, y
en táctil ese evento no existe hasta que el dedo se desplaza: tocar sin arrastrar no coloca la
paleta. Es una línea, reusa el handler que ya existe y su pareja en `detach()` la cubre la
prueba que ese archivo ya tiene sobre soltar listeners. La alternativa —convivir con ello— deja
un control que se siente roto en el único juego cuyo control natural es el puntero.

**Sí: un componente aparte.** `jugar/page.tsx` ya son ~430 líneas y seis efectos, y es el
archivo más largo de la app. El mando recibe el `MandoDeJuego` del registro y no sabe nada del
reproductor, así que no hay motivo para meterlo dentro.

**Sí: se corta `touch-action` solo en la zona de juego.** Ponerlo en `.av-player` entero
impediría hacer scroll cuando el contenido no cabe, y el botón SALIR quedaría fuera de alcance
en un teléfono pequeño. El corte va donde el gesto es del juego: canvas, overlay y mando.

**Sí: botón `EMPEZAR` y además toque en el overlay.** El botón es el objetivo explícito y
descubrible; el toque en el fondo es la comodidad. La zona del selector de aspecto se excluye
del toque de fondo, o elegir «RETRO» arrancaría la partida.

**No: vibración háptica.** `navigator.vibrate()` no existe en iOS, así que la mitad de los
teléfonos no la tendrían; y en ROCAS o CAÍDA, donde se mantiene pulsado, vibrar por toque
cansa. Se puede añadir después sin cambiar nada de esta spec.

**No: pantalla completa ni bloqueo de orientación.** Ganan pantalla, añaden un estado más al
reproductor y se comportan distinto en iOS. Son su propia spec.

**No: Testing Library.** Probar el componente exigiría una dependencia y un patrón de pruebas
nuevos en un repo que hoy solo prueba `app/lib/games/`. Lo que de verdad puede romperse —que un
`code` no corresponda a ninguna tecla del motor, o que soltar no libere el estado— se prueba sin
React, que es donde esta spec pone su red.

**Sí: `.game-keyboard-note` se borra, no se suaviza.** Deja de ser verdad en el momento en que
existe el mando. Un aviso reescrito como «se juega mejor con teclado» no aporta nada accionable
y se convierte en el próximo texto que nadie se atreve a quitar.

---

## Riesgos

| Riesgo                                                                                  | Mitigación                                                                                                                                                                                                    |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Una tecla se queda pulsada (dedo arrastrado fuera del botón, desmontaje con dedo abajo) | `setPointerCapture`, `pointercancel` tratado como `pointerup`, y soltar todo lo pendiente al desmontar. Con prueba en la suite.                                                                               |
| El mecanismo depende de que los motores sigan escuchando `window`                       | Es una invariante de los cinco desde la SPEC 05. La prueba de mando por motor la vigila: mover el listener al canvas la rompe.                                                                                |
| Un `code` mal escrito en `GAME_TOUCH` da un botón que no hace nada                      | La prueba por motor despacha cada `code` declarado y exige un efecto observable. Un typo no llega a producción.                                                                                               |
| El canvas 4:3 en vertical queda diminuto en teléfonos pequeños                          | Es el precio aceptado de no bloquear la orientación. Se mide en el paso 8 con Playwright; si no es jugable, la salida es una spec de pantalla completa, no bajar el mando.                                    |
| `touch-action: none` en el canvas atrapa el scroll de la página                         | Se aplica solo al canvas, al overlay y al mando. Criterio de aceptación explícito: el botón SALIR sigue siendo alcanzable.                                                                                    |
| iOS Safari y los eventos de puntero                                                     | Se usan Pointer Events, soportados desde iOS 13. No se usa `touchstart`, que obligaría a llevar dos caminos.                                                                                                  |
| El toque de fondo del overlay arranca la partida al elegir aspecto                      | La zona del selector se excluye del toque de fondo. Es la trampa más fácil de este paso.                                                                                                                      |
| El sexto juego se registra sin mando                                                    | `registry.test.ts` cruza `GAME_TOUCH` con `GAME_ENGINES`, igual que ya hace con controles y paletas, y el contrato de `/nuevo-juego` lo recoge.                                                               |
| Tocar el HUD rompe su aspecto en escritorio                                             | Todo el cambio vive dentro de `@media (max-width: 720px)`; lo único que sale del bloque es convertir un estilo inline en clase, con las mismas propiedades. Criterio de aceptación explícito de no regresión. |
| El HUD compacto se descuadra con números grandes                                        | La rejilla de cuatro columnas reparte a partes iguales, y el nombre lleva `min-width: 0` + elipsis. Se comprueba con la puntuación de seis cifras y un nombre de 10 caracteres.                               |

---

## Lo que **no** está en esta spec

- Cambiar el contrato de los motores, en ninguna forma.
- Reescribir la lógica de ningún juego para que «sea más táctil».
- Mando para los tres juegos simulados.
- Un mando configurable por el jugador.
- Agrandar el canvas o quitarle el marco CRT.
- El selector de aspecto fuera del overlay de arranque.
- Auditar el resto del portal en pantallas pequeñas.
