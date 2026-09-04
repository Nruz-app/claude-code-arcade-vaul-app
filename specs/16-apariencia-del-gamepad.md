# SPEC 16 — GAMEPAD MK-II: el mando, igual que la referencia

> **Estado:** Implementado
> **Depende de:** SPEC 14
> **Fecha:** 2026-09-03
> **Objetivo:** que el mando del reproductor tenga exactamente el aspecto de `references/gamepad-assets/gamepad.html` —marco, geometría, cruz completa, los dos botones redondos, `:hover` y eco del teclado físico— y que además se vea y se use con el ratón en escritorio, sin tocar `GameHandle` ni la lógica de ningún motor.

---

## Por qué existe esta spec

El mando de hoy **ya es** un port de `references/gamepad-assets/gamepad.html`. Su propio
comentario de cabecera lo dice, y el bloque de `app/globals.css` (líneas 1254-1524) empieza
enumerando las tres desviaciones que la SPEC 14 introdujo a conciencia:

1. **Los objetivos táctiles subieron de 50 a 56 px**, que era un criterio de aceptación de
   aquella spec.
2. **La cruceta pasó de un marco fijo de 156×156 con posiciones absolutas a una rejilla 3×3 que
   colapsa las filas vacías**, para que BLOQUE BUSTER —que solo va de lado— no reservara el alto
   de una cruz entera.
3. **El mando aparece por `@media (pointer: coarse)`** y no siempre, porque la SPEC 14 era una
   spec de teléfonos: _«no cuánto mides, sino con qué señalas»_.

Las tres decisiones eran correctas para lo que aquella spec quería. El problema es lo que
dejaron por el camino, que se ve poniendo el PNG de referencia al lado de una captura del
reproductor:

- **La silueta cambia de un juego a otro.** ROCAS no usa «abajo» y BLOQUE BUSTER solo tiene
  izquierda y derecha, así que en tres de los cinco juegos la cruceta no es una cruz. Y como
  SERPENTINA, RANARIA y BLOQUE BUSTER no declaran ningún botón de acción, **en tres juegos el
  lado derecho del mando está sencillamente vacío**. El PNG enseña siempre lo mismo: una cruz
  completa a la izquierda y B + A a la derecha.
- **Falta media hoja de estilos de la referencia**: el `max-width: 760px` centrado, el
  contenedor interior con sus dos columnas `1fr 1fr`, la capa de sombra
  `0 0 0 1px rgba(255,255,255,0.02)`, los `:hover` de la cruceta y del aro, y la clase `.on` que
  enciende el botón en pantalla **cuando pulsas la tecla física**. Eso último no es decoración:
  es lo que convierte el mando en un indicador de lo que el motor está recibiendo.
- **En escritorio no se ve nada.** El `pointer: coarse` fue deliberado, pero deja el aspecto de
  la referencia —que se diseñó con `:hover` y con botones de 50 px, medidas de ratón— sin un
  solo sitio donde mirarse.

Lo que hace barata esta spec es lo mismo que hizo barata la 14: **el mecanismo no cambia**. El
componente ya traduce `pointerdown` → `keydown` y `pointerup` → `keyup` sobre `window`, ya
captura el puntero, ya suelta lo que quede apoyado al desmontar. Un ratón es un puntero como
cualquier otro, así que **enseñar el mando en escritorio no requiere ni una línea de lógica de
entrada nueva**: el clic ya funciona. Esta spec es de aspecto, de geometría y de una sola pieza
de comportamiento nueva —el eco del teclado—, que además es de una sola dirección: escucha, no
despacha.

---

## Alcance

**Dentro:**

- **La geometría exacta de la referencia** como base: cruceta de 50 px con hueco de 3 px sobre
  un marco fijo de 156×156, botones de acción de 74 px con 22 px de separación, flecha de 22 px,
  marco de `max-width: 760px` centrado con sus paddings.
- **Escalado táctil**: en `@media (pointer: coarse)` la cruceta sube a 56 px y los botones de
  acción a 76 px, que es el mínimo que fijó la SPEC 14. Las medidas de la referencia son las de
  ratón; las del dedo son mayores.
- **Cruz completa siempre**: el marco de la cruceta reserva sus tres filas y tres columnas
  aunque el juego no use una dirección. El botón que no se usa **no se dibuja**; su hueco queda
  vacío.
- **Los dos botones redondos siempre**: B (cian, izquierda) y A (magenta, derecha). El slot que
  el juego no declara se dibuja **atenuado, sin manejadores de puntero y con `aria-hidden`**.
- **`:hover`** en la cruceta y en el aro de los botones de acción, dentro de
  `@media (hover: hover)`.
- **Eco del teclado físico**: pulsar la tecla que un botón despacha lo enciende en pantalla con
  la clase `.on`, con el mismo aspecto que `:active`.
- **El mando visible en escritorio**, siempre que haya partida en curso, y jugable con el ratón.
- **La pista «ARRASTRA EN LA PANTALLA» de BLOQUE BUSTER sale del marco** y pasa a ser un pie
  centrado bajo el gamepad.
- **`BotonAccion.etiqueta` se estrecha a `"A" | "B"`** y **`BotonAccion.tono` desaparece**: el
  slot decide la posición y el color.
- **Dos ayudas puras en `registry.ts`** —`accionEnSlot()` y `botonesDelMando()`— que el
  componente y las dos suites de pruebas comparten.

**Fuera:**

- **`GameHandle`, `GameCallbacks` y la lógica de los cinco motores.** Igual que en la SPEC 14:
  no se toca ni un motor. El mando sigue despachando los mismos `code`.
- **Botones de acción nuevos con función real.** Que SERPENTINA, RANARIA y BLOQUE BUSTER dibujen
  B y A no significa que hagan algo: los suyos son inertes. Darles una acción de verdad (pausa,
  por ejemplo) es otra spec, porque cambia el juego y no el aspecto.
- **El HUD, el marco CRT, el overlay de arranque y el selector de aspecto.** Esta spec empieza y
  acaba debajo de `.crt-bottom`.
- **El breakpoint de 620 px de la referencia con sus botones de 46 y 64 px.** Derogaría el
  mínimo de 56 px de la SPEC 14 en el aparato donde más importa. El corte estrecho sigue siendo
  el del portal.
- **Vibración, mando físico (Gamepad API) y remapeo de teclas.**
- **Pruebas de renderizado del componente.** No hay React Testing Library en el repo y esta spec
  no la introduce; lo comprobable sin ella se extrae a funciones puras.

---

## Modelo de datos

No hay datos nuevos ni nada que persistir. Lo que cambia es un tipo y aparecen dos ayudas.

### El tipo que se estrecha

```ts
// app/lib/games/registry.ts
export type SlotDeAccion = "B" | "A"; // izquierda, derecha — el orden del PNG

export interface BotonAccion extends BotonTactil {
  readonly etiqueta: SlotDeAccion; // antes: string
  // `tono` desaparece: el slot ya dice el color (B cian, A magenta).
}
```

`tono` se va porque con slots fijos **puede contradecir al dibujo**: un botón declarado
`{ etiqueta: "A", tono: "cyan" }` sería magenta en pantalla y cian en el registro, y nadie se
enteraría. Las dos únicas entradas que lo usan (`rocas` y `caida`) ya declaran `etiqueta: "A"`,
`tono: "magenta"`, así que borrarlo no cambia un solo píxel.

### Las dos ayudas puras

```ts
// app/lib/games/registry.ts
export function accionEnSlot(
  mando: MandoDeJuego,
  slot: SlotDeAccion,
): BotonAccion | undefined;

export function botonesDelMando(mando: MandoDeJuego): BotonTactil[];
```

`botonesDelMando()` ya existe **dos veces copiada**: en `tests/harness/mando.ts` y en
`tests/games/registry.test.ts` (ahí se llama `botonesDe`). Ahora la necesita también el
componente, para saber qué `code` tiene que escuchar el eco del teclado, así que sube al registro
y las tres la importan de un sitio.

### Archivos que aparecen o cambian

| Archivo                              | Qué le pasa                                                                                                 |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| `app/globals.css`                    | Se reescribe el bloque «mando táctil» (1254-1524) con la geometría, el marco y los estados de la referencia |
| `app/components/mando-tactil.tsx`    | Estructura nueva (zona + marco + cuerpo), slots fijos de acción y eco del teclado                           |
| `app/lib/games/registry.ts`          | `SlotDeAccion`, `etiqueta` estrechada, `tono` fuera, `accionEnSlot()` y `botonesDelMando()`                 |
| `tests/harness/mando.ts`             | Importa `botonesDelMando` del registro en vez de tener la suya                                              |
| `tests/games/registry.test.ts`       | Igual, y cambia la aserción de `tono` por la de `etiqueta` más las de `accionEnSlot()`                      |
| `specs/16-apariencia-del-gamepad.md` | Este archivo                                                                                                |

Ningún archivo nuevo de código. `app/juego/[id]/jugar/page.tsx` **no se toca**: la condición de
montaje (`mando && started && !over`) ya es la correcta, y el cambio de «solo táctil» a «también
escritorio» es entero de CSS.

### La geometría, en números

Todo sale de tres variables declaradas en `.mando`:

| Medida                 | Ratón (base)                   | Dedo (`pointer: coarse`) | Teléfono estrecho (≤420 px) |
| ---------------------- | ------------------------------ | ------------------------ | --------------------------- |
| `--mando-dir`          | 50px                           | 56px                     | 56px                        |
| `--mando-hueco`        | 3px                            | 3px                      | 3px                         |
| Cruceta (calculada)    | 156px                          | 174px                    | 174px                       |
| `--mando-accion`       | 74px                           | 76px                     | 68px                        |
| Separación de acciones | 22px                           | 22px                     | 16px                        |
| Flecha                 | 22px                           | 24px                     | 24px                        |
| Marco `.mando`         | `padding: 16px 22px 14px`      | igual                    | `12px 14px 10px`            |
| Cuerpo `.mando-cuerpo` | `padding: 24px 12px`, gap 18px | igual                    | `18px 6px`, gap 14px        |
| Radio del marco        | 22px                           | 22px                     | 16px                        |

La cruceta no lleva su tamaño escrito: es
`calc(var(--mando-dir) * 3 + var(--mando-hueco) * 2)`, y sus filas y columnas son
`repeat(3, var(--mando-dir))` **fijas, no `auto`** — eso es «marco fijo, hueco vacío». El
`--mando-accion` de 68 px del teléfono estrecho sigue por encima del mínimo de 56.

### La estructura en pantalla

La referencia tiene dos niveles (`.gp` el marco, `.gp-body` la rejilla) y hoy el componente tiene
uno solo. Además la pista de arrastre sale del marco, así que hace falta un tercero por fuera:

```
<div class="mando-zona">                     ← centra y aloja el pie
  <div class="mando" role="group">           ← el marco: max-width 760, ::before, ::after
    <div class="mando-cuerpo">               ← rejilla 1fr 1fr
      <div class="mando-col mando-col-izq">
        <div class="mando-cruceta">          ← 3×3 fija
          <button class="mando-dir mando-arriba">…    ← solo si el juego la declara
          <div class="mando-hub"><span class="mando-gema"/></div>
        </div>
      </div>
      <div class="mando-col mando-col-der">
        <div class="mando-acciones">
          <button class="mando-accion mando-b [inerte]">…   ← siempre
          <button class="mando-accion mando-a [inerte]">…   ← siempre
        </div>
      </div>
    </div>
  </div>
  <div class="mando-pista mono">ARRASTRA EN LA PANTALLA</div>   ← solo BLOQUE BUSTER
</div>
```

Un botón `inerte` lleva `aria-hidden="true"`, `disabled`, `pointer-events: none` y ningún
manejador, y se atenúa con `opacity: 0.32` y `filter: saturate(0.45)`. No es un botón
estropeado: es la carcasa del mando, y así se lo cuenta a un lector de pantalla.

### El eco del teclado

Es la única pieza de comportamiento nueva, y va en una sola dirección: **escucha `window` y no
despacha nada**.

```ts
const [encendidas, setEncendidas] = useState<ReadonlySet<string>>(new Set());
const codes = useMemo(
  () => new Set(botonesDelMando(mando).map((b) => b.code)),
  [mando],
);
```

Cuatro reglas, cada una por un fallo concreto:

1. **`e.repeat` se descarta.** El auto-repeat del sistema dispara `keydown` treinta veces por
   segundo mientras se mantiene una tecla; sin la guardia, el mando provocaría treinta renders
   por segundo encima de un juego a 60 fps.
2. **No se realimenta.** El propio mando despacha `KeyboardEvent` sobre `window`, así que su
   escucha oiría sus propios eventos. Se ignora con un `useRef` puesto a `true` alrededor de la
   llamada a `despacha()`: el envío es síncrono, así que la bandera es fiable. El botón tocado ya
   se enciende con `:active`; el eco es para el teclado.
3. **`blur` y `visibilitychange` apagan todo.** Si cambias de pestaña con una tecla pulsada, el
   `keyup` no llega nunca y el botón se quedaría encendido para siempre — el mismo fallo que en
   la SPEC 14 costó el cleanup del desmontaje, ahora en versión visual.
4. **Si el `code` ya estaba en el conjunto, se devuelve el mismo conjunto**, para que React no
   re-renderice por un evento que no cambia nada.

---

## Plan de implementación

Cada paso deja la aplicación funcionando y las pruebas en verde.

1. **Registro.** En `app/lib/games/registry.ts`: añadir `SlotDeAccion`, estrechar
   `BotonAccion.etiqueta`, borrar `tono`, quitar `tono` de las entradas de `rocas` y `caida` en
   `GAME_TOUCH`, y exportar `accionEnSlot()` y `botonesDelMando()`. Actualizar
   `tests/harness/mando.ts` y `tests/games/registry.test.ts` para que importen `botonesDelMando`
   en vez de tener cada uno su copia. `npx tsc --noEmit` señala todo lo que falte.
2. **Pruebas del registro.** En `tests/games/registry.test.ts`: sustituir la aserción de `tono`
   por una de `etiqueta` (`"A"` o `"B"`, sin repetir slot dentro de un mismo mando) y añadir las
   de `accionEnSlot()` — devuelve el botón declarado y `undefined` en el slot libre.
3. **CSS.** Reescribir el bloque «mando táctil» de `app/globals.css`: sacar `.mando` de
   `@media (pointer: coarse)` para que se vea siempre, montar el marco de la referencia con sus
   dos niveles (`.mando` + `.mando-cuerpo`), las variables de geometría con su escalado táctil,
   la cruceta 3×3 fija, `:hover` bajo `@media (hover: hover)`, `.on` compartiendo selector con
   `:active`, el estado `.inerte` y el pie `.mando-pista` centrado bajo el marco.
4. **Componente, estructura.** En `app/components/mando-tactil.tsx`: envolver en `.mando-zona`,
   añadir `.mando-cuerpo` y las dos columnas, dibujar siempre los dos slots de acción con
   `accionEnSlot()` (inerte el que no exista) y mover la pista fuera del marco.
5. **Componente, eco del teclado.** Añadir la escucha de `keydown`/`keyup` sobre `window` con las
   cuatro reglas de arriba, y la clase `on` en los botones cuyo `code` esté encendido.
6. **Verificación visual.** `npm run dev` y, con el MCP de Playwright, capturar
   `/juego/caida/jugar` con la partida arrancada en escritorio (1280×800) y en un teléfono
   emulado, comparando contra `references/gamepad-assets/gamepad-neon.png`. Después
   `npm run test:run`, `npm run lint` y `npm run build`.

---

## Criterios de aceptación

- [ ] En un escritorio con ratón, el mando se ve bajo el marco CRT mientras hay partida en curso,
      y clicar un botón mueve el juego.
- [ ] La cruceta mide **156×156** con botones de **50 px** y hueco de **3 px** en puntero fino, y
      **174×174** con botones de **56 px** en `pointer: coarse`.
- [ ] Los botones de acción miden **74 px** en puntero fino y **76 px** en `pointer: coarse`, con
      **22 px** entre ellos.
- [ ] El marco tiene `max-width: 760px`, está centrado y lleva las cuatro capas de `box-shadow`
      de la referencia, incluida `0 0 0 1px rgba(255,255,255,0.02)`.
- [ ] Los cinco juegos dibujan **la misma silueta**: cruz de tres filas y tres columnas a la
      izquierda, dos botones redondos a la derecha.
- [ ] En ROCAS el hueco de «abajo» está vacío —sin botón— y la cruceta conserva su alto.
- [ ] En SERPENTINA, RANARIA y BLOQUE BUSTER los botones B y A se dibujan atenuados, no responden
      al puntero y llevan `aria-hidden="true"`.
- [ ] En ROCAS y CAÍDA el botón A es magenta y funciona; el B está inerte.
- [ ] Con el ratón encima, un botón de la cruceta se pone cian y su borde también; el aro punteado
      de un botón de acción aparece al 45 %.
- [ ] Pulsar `←` en el teclado físico enciende el botón izquierdo de la cruceta en pantalla, y
      soltarla lo apaga.
- [ ] Mantener una tecla pulsada no provoca renders repetidos (se descarta `e.repeat`).
- [ ] Cambiar de pestaña con una tecla pulsada deja todos los botones apagados al volver.
- [ ] Tocar un botón con el dedo no enciende ningún otro: el mando no oye sus propios eventos.
- [ ] En BLOQUE BUSTER, «ARRASTRA EN LA PANTALLA» aparece **debajo** del marco, centrada, y no
      dentro de la columna de botones.
- [ ] `BotonAccion` no tiene campo `tono` y `etiqueta` solo admite `"A"` o `"B"`.
- [ ] `botonesDelMando()` está declarada una sola vez, en `app/lib/games/registry.ts`.
- [ ] `npm run test:run`, `npm run lint`, `npx tsc --noEmit` y `npm run build` pasan.
- [ ] En un teléfono de 390 px de ancho ningún objetivo táctil baja de 56 px y el mando no provoca
      scroll horizontal.

---

## Decisiones

**El mando se ve también en escritorio.** La referencia tiene `:hover` y botones de 50 px: está
pensada para ratón, y esconderla tras `pointer: coarse` dejaba la mitad de su hoja de estilos sin
un sitio donde verse. Se descartó **mantenerlo solo táctil** (los `:hover` y las medidas de la
referencia serían código muerto) y **un interruptor en el HUD** (añade estado, botón y preferencia
persistida para algo que no cuesta nada tener siempre). Que funcione con el ratón no costó nada:
el componente escucha eventos de puntero, y un ratón es un puntero.

**Dos juegos de medidas, no uno.** La geometría de la referencia (50/74) es la base, y
`pointer: coarse` la sube a 56/76. Se descartó **copiar 50/74 en todas partes**, que derogaría el
mínimo de 56 px que la SPEC 14 fijó como criterio de aceptación tras mirar el reproductor en un
teléfono real, y **quedarse en 56/76 siempre**, que en escritorio deja un mando más gordo que el
PNG sin ninguna razón. Las dos medidas viven en variables CSS, así que el escalado es una regla de
tres líneas y no una segunda hoja de estilos.

**La cruceta reserva la cruz entera; el botón que no se usa no se dibuja.** Es el punto medio
entre la silueta de la referencia y no mentir. Se descartó **dibujar los cuatro atenuados** —
enseña botones que no hacen nada donde el jugador espera que hagan algo: en ROCAS un «abajo»
apagado sugiere una acción que no ha descubierto — y **mantener la rejilla colapsable** de hoy,
que cambia la forma del mando en tres de los cinco juegos.

**Los botones de acción sí se dibujan siempre, aunque estén inertes.** Aquí la disyuntiva se
resuelve al revés que en la cruceta, y a propósito: un hueco vacío a la derecha del mando no se
lee como «este juego no dispara», se lee como **un mando roto**. Dos botones apagados se leen como
carcasa. La asimetría es deliberada y esta es su justificación. Se descartó **reasignarles una
acción real** —el segundo botón como pausa, por ejemplo—: cambiaría el comportamiento de cinco
juegos, y esta spec es de aspecto.

**El slot decide color y posición; `tono` desaparece.** Con B a la izquierda en cian y A a la
derecha en magenta fijados por el dibujo, un campo `tono` en el registro solo puede coincidir o
contradecir. Se descartó **conservarlo** por compatibilidad: lo usan dos entradas, las dos
consistentes, y quitarlo hace imposible el estado inconsistente en vez de obligar a probarlo.

**El eco del teclado se implementa con estado de React y no tocando el DOM.** La alternativa
—guardar los nodos en refs y hacer `classList.toggle`, como el script de la referencia— evita
renders, pero mete manipulación manual del DOM en un componente de React por un ahorro que no
existe: descartando `e.repeat` y devolviendo el mismo `Set` cuando no cambia nada, los renders son
uno por transición de tecla, no uno por fotograma.

**`:hover` va dentro de `@media (hover: hover)`.** La referencia no lo hace porque es una página
suelta; aquí no: en táctil, un `:hover` sin guardia se queda **pegado** en el último botón tocado
hasta que se toca otro, y el mando acabaría con un botón cian permanentemente encendido que nadie
está pulsando.

**El corte estrecho es el del portal (420 px), no el de la referencia (620 px).** El de la
referencia baja los botones a 46 y 64 px, por debajo del mínimo de 56 px, y lo haría justo en el
aparato para el que se escribió ese mínimo. Es la única medida de la referencia que esta spec no
copia, y es una decisión y no un olvido.

**La pista de arrastre baja al pie.** Con los dos slots ocupados siempre ya no cabe donde estaba, y
meter texto dentro del marco es exactamente lo que la referencia no tiene. Se descartó
**borrarla**: es la única indicación de que BLOQUE BUSTER se juega arrastrando por el canvas, y sin
ella el juego parece que solo se mueve a golpes de flecha.

**`botonesDelMando()` sube al registro.** Existía copiada en dos archivos de pruebas y ahora la
necesita también el componente. Tres copias de la misma función es donde una se queda vieja.

---

## Riesgos

**El mando en escritorio compite por el alto de la ventana.** El reproductor ya apila HUD, CRT de
800×600 y ahora un mando de ~200 px. En un portátil de 768 px de alto habrá que desplazar la
página para verlo entero. Se asume: en escritorio el mando es opcional —el teclado sigue siendo el
control principal— y va debajo del canvas, así que lo que se pierde de vista es él y no el juego.

**El eco del teclado y el `:active` pueden solaparse.** Un botón tocado con el dedo mientras la
misma tecla está pulsada en el teclado tendría `.on` y `:active` a la vez. Comparten declaración en
el CSS, así que el resultado es idéntico y no hay parpadeo; queda anotado por si alguien separa los
dos selectores más adelante.

**Estrechar `etiqueta` a `"A" | "B"` rompe la compilación de quien añada un juego con tres botones
de acción.** Es intencionado: el mando tiene dos slots, y un tercer botón necesita decidir dónde va
antes de existir. El error de TypeScript llega en el momento correcto.

---

## Lo que **no** está en esta spec

- Ninguna acción nueva en ningún juego: los botones que hoy no hacen nada siguen sin hacerlo, solo
  que ahora se ven.
- Ningún cambio en `GameHandle`, `GameCallbacks`, `GameFactory` ni en los cinco motores.
- Ningún cambio en `app/juego/[id]/jugar/page.tsx`.
- Soporte de mandos físicos (Gamepad API), vibración ni remapeo de teclas.
- Pruebas de renderizado del componente: lo comprobable sin React Testing Library se extrae a
  funciones puras del registro; el resto se verifica con capturas.
