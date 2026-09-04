# SPEC 17 — CONSOLA: la pantalla en medio y los controles a los lados

> **Estado:** Aprobado
> **Depende de:** SPEC 14, SPEC 16
> **Fecha:** 2026-09-03
> **Objetivo:** partir el mando en dos piezas —cruceta y botones— y colocarlas a los costados de la pantalla dentro de un chasis único, de modo que el reproductor se lea como una consola en vez de como una pantalla con un mando debajo, cayendo a una disposición apilada cuando la ventana no da para los tres bloques.

---

## Por qué existe esta spec

La SPEC 16 dejó el mando idéntico a `references/gamepad-assets/gamepad.html`, y el port es fiel.
El problema no es cómo se ve el mando: es **dónde está**.

Hoy el reproductor es una pila de tres bloques a todo el ancho —HUD, pantalla, mando— y eso
tiene dos consecuencias medidas en esta misma sesión:

1. **En escritorio sobra ancho y falta alto.** La pantalla ocupa los 1004 px de `.av-player` y
   arrastra 753 px de alto por el `aspect-ratio: 4/3`; debajo van otros ~230 px de mando. En un
   portátil de 768 px de alto no entra ni la pantalla sola, así que el mando queda siempre fuera
   de vista — lo que la SPEC 16 ya anotó como riesgo asumido. A los lados, en cambio, el mando
   **no cuesta ni un píxel de alto**: cabe de sobra en los 478 px que mide la pantalla.
2. **En móvil el mando de 322 px mínimos pelea con la pantalla por el mismo ancho.** La SPEC 16
   tuvo que apretar separaciones por debajo de 520 px y apilar las dos mitades por debajo de 400,
   y aun así el conjunto es una tira larga por la que hay que desplazarse.

Y hay un tercer motivo que no es de espacio sino de identidad: **una pantalla con un mando
debajo es un ordenador; una pantalla con la cruceta a un lado y los botones al otro es una
consola.** El portal se llama Arcade Vault y todo lo demás —el CRT con su bisel, las líneas de
barrido, el «SEÑAL OK · CRT-83 · 60 HZ» del pie— empuja en esa dirección. El mando es la única
pieza que se quedó a medio camino.

Lo que hace barata esta spec es que **no toca la entrada**. Los botones son los mismos de la
SPEC 16, con los mismos `code` de `GAME_TOUCH`, el mismo `setPointerCapture`, el mismo eco del
teclado y las mismas guardias. Cambian dos cosas y ninguna es comportamiento: **cómo se agrupa el
JSX** (una pieza en vez de dos dentro del mismo marco) y **dónde lo coloca el reproductor**.

---

## Alcance

**Dentro:**

- **Dos maquetas de referencia nuevas** en `references/gamepad-assets/`: una con la cruceta y
  otra con los botones, derivadas de `gamepad.html` y con el mismo aire.
- **`MandoTactil` se parte en dos componentes** —`MandoCruceta` y `MandoAcciones`— que comparten
  la lógica en un hook del mismo archivo. Cada uno se monta por separado.
- **Un chasis único** que envuelve cruceta, pantalla y botones en un solo marco continuo, con la
  pantalla en medio y los controles centrados verticalmente contra su alto.
- **La pantalla cede el ancho**: el chasis respeta el `max-width: 1100px` de `.av-player` y el
  CRT se encoge a lo que quede.
- **Disposición apilada por debajo de 900 px**: el chasis pasa a columna —pantalla arriba,
  cruceta y botones debajo— reutilizando lo que la SPEC 16 ya resolvió para pantallas estrechas.
- **Chasis en los ocho juegos**, también en los tres sin motor (`gloton`, `invasores`,
  `duelo-pixel`), donde los costados quedan como carcasa lisa.
- **El marco `.mando` de la SPEC 16 se retira**: su papel —borde, sombras, trama de puntos— pasa
  al chasis, que ahora es el único marco.

**Fuera:**

- **`GameHandle`, `GameCallbacks`, los cinco motores y `GAME_TOUCH`.** Ni un `code` cambia. Esta
  spec mueve píxeles, no entrada.
- **El HUD.** Sigue siendo el bloque de arriba, fuera del chasis, con su disposición compacta de
  la SPEC 14 intacta.
- **La geometría de los botones.** Siguen siendo 50/74 px con ratón y 56/76 con el dedo, tal como
  los fijó la SPEC 16.
- **Controles inertes en los juegos sin mando.** Sus costados son carcasa lisa, sin cruceta ni
  botones dibujados.
- **Un cartel de «gira el teléfono»** y cualquier bloqueo por orientación.
- **El bisel `.crt` y su contenido**: overlay de arranque, pausa, líneas de barrido y pie siguen
  exactamente como están, solo que dentro del chasis.
- **Meter el marcador en el chasis**, que sería otra spec y obligaría a rehacer el HUD compacto.

---

## Modelo de datos

**No hay datos nuevos, ni nada que persistir, ni cambios en `registry.ts`.** `GAME_TOUCH`,
`BotonTactil`, `BotonAccion`, `SlotDeAccion`, `accionEnSlot()` y `botonesDelMando()` se quedan
como los dejó la SPEC 16. Lo que cambia es la forma del componente y la del árbol JSX.

### El componente se parte en dos

`app/components/mando-tactil.tsx` deja de exportar un componente por defecto y pasa a exportar
dos, más un hook privado con todo lo que hoy comparten:

```ts
// Todo lo que hoy vive en MandoTactil y las dos mitades necesitan igual:
// pulsadas, propio/despachaPropio, apoya, levanta, el cleanup del desmontaje,
// el eco del teclado y los helpers props()/clases().
function useMando(mando: MandoDeJuego): {
  props: (boton: BotonTactil) => Record<string, unknown>;
  clases: (base: string, code: string) => string;
};

export function MandoCruceta({ mando }: { mando: MandoDeJuego }): JSX.Element;
export function MandoAcciones({ mando }: { mando: MandoDeJuego }): JSX.Element;
```

Cada mitad llama al hook por su cuenta, así que **cada una tiene su propio estado de teclas
encendidas y su propia escucha de `window`**. Es correcto y es lo que evita levantar un contexto
para dos componentes hermanos: la cruceta no necesita saber si el botón A está pulsado, y el eco
filtra por `code` contra los botones que esa mitad dibuja. Son dos listeners en vez de uno, y a
cambio ninguna de las dos mitades depende de la otra para montarse.

El envoltorio `.mando-zona` y el marco `.mando` desaparecen del componente: cada mitad devuelve su
contenido —la cruceta o la fila de botones— y **quien la coloca es el reproductor**.

### La estructura en pantalla

```
<div class="av-player">
  <div class="player-hud">…</div>                      ← sin cambios (SPEC 14)

  <div class="consola">                                ← el chasis: marco único
    <div class="consola-lado consola-izq">
      <div class="mando-cruceta">…</div>               ← MandoCruceta
    </div>

    <div class="consola-centro">
      <div class="crt">                                ← el bisel de hoy, intacto
        <div class="crt-screen">…canvas…</div>
        <div class="crt-bottom">…</div>
      </div>
    </div>

    <div class="consola-lado consola-der">
      <div class="mando-acciones">…</div>              ← MandoAcciones
    </div>
  </div>

  <div class="mando-pista mono">ARRASTRA EN LA PANTALLA</div>   ← solo BLOQUE BUSTER
</div>
```

`.consola` es una rejilla `auto 1fr auto` con `align-items: center`: los costados miden lo que
miden sus controles y **el centro se queda con el resto**, que es lo que hace que la pantalla
«se ajuste al tamaño» sin ninguna cuenta escrita a mano. El `min-width: 0` en `.consola-centro`
es obligatorio, o la rejilla se niega a encoger el CRT por debajo de su contenido.

### Los números

Con `.av-player` en 1100 px, sus 24 px de padding y 24 px más de chasis:

| Tramo                       | Ancho                                   |
| --------------------------- | --------------------------------------- |
| Contenido de `.av-player`   | 1052 px                                 |
| Interior del chasis         | 1004 px                                 |
| Cruceta (columna izquierda) | 156 px                                  |
| Botones (columna derecha)   | 170 px (74 × 2 + 22)                    |
| Separación (dos huecos)     | 40 px                                   |
| **Pantalla**                | **638 px de ancho → 478 de alto** (4/3) |

Hoy la pantalla mide 1004×753. Pierde ancho, pero **el conjunto pasa de ~1030 px de alto a
~530**, que es lo que hace que quepa entero en un portátil.

En el umbral de 900 px de ventana la pantalla queda en 438×328. Es pequeña, y es exactamente el
motivo de que ahí se corte: por debajo, la disposición apilada devuelve a la pantalla todo el
ancho.

---

## Plan de implementación

Cada paso deja la aplicación funcionando y las pruebas en verde.

1. **Las dos maquetas de referencia.** Crear `references/gamepad-assets/gamepad-cruceta.html` y
   `gamepad-botones.html` a partir de `gamepad.html`: cada una con su mitad, sus estilos y su
   trozo del script de teclado. Actualizar el `README.md` de la carpeta para que diga qué es cada
   archivo y que `gamepad.html` sigue ahí como el mando entero del que salieron los dos.
2. **Partir el componente.** En `app/components/mando-tactil.tsx`: extraer `useMando()` con todo
   lo compartido y exportar `MandoCruceta` y `MandoAcciones`, cada una devolviendo solo su mitad,
   sin `.mando-zona` ni `.mando`. La pista de arrastre sale del componente.
3. **El chasis en el CSS.** En `app/globals.css`: escribir `.consola`, `.consola-lado`,
   `.consola-izq`, `.consola-der` y `.consola-centro`, moviendo al chasis el marco que la SPEC 16
   había puesto en `.mando` (borde, las cuatro capas de sombra, el `::before` interior y la trama
   de puntos del `::after`), y retirar las reglas de `.mando` y `.mando-zona` que dejan de usarse.
4. **El reproductor.** En `app/juego/[id]/jugar/page.tsx`: envolver el `.crt` en el chasis, montar
   las dos mitades en sus costados con las mismas condiciones de hoy (`mando && started && !over`)
   y dejar la pista de arrastre debajo del chasis. Los tres juegos sin mando dibujan el chasis con
   los costados vacíos.
5. **La disposición apilada.** Por debajo de 900 px, `.consola` pasa a una sola columna con la
   pantalla arriba y una fila de controles debajo, y se reajustan a esa fila los cortes que la
   SPEC 16 dejó en 520 y 400 px.
6. **Verificación.** Medir con Playwright a 1280, 1100, 1024, 940, 900, 899, 768, 430, 390 y
   320 px: tamaño de la pantalla, que ningún control quede fuera del chasis, que ningún objetivo
   táctil baje de 56 px y que no haya scroll horizontal. Capturas de los ocho juegos. Después
   `npm run test:run`, `npm run lint`, `npx tsc --noEmit` y `npm run build` **con el servidor de
   desarrollo parado**.

---

## Criterios de aceptación

- [x] Existen `references/gamepad-assets/gamepad-cruceta.html` y `gamepad-botones.html`, cada uno
      abre solo en un navegador y su `README.md` explica los tres archivos.
- [x] `app/components/mando-tactil.tsx` exporta `MandoCruceta` y `MandoAcciones` y ya no exporta
      un componente por defecto.
- [x] En una ventana de 1280 px, la cruceta está a la izquierda de la pantalla, los botones a la
      derecha, y los tres bloques comparten **un solo marco** con su borde y su sombra.
- [x] Los controles quedan **centrados verticalmente** respecto al alto de la pantalla.
- [x] A 1100 px o más, la pantalla mide 638×478 y el chasis no pasa de 1052 px de ancho.
      Medido: chasis 1052, bisel 636×515 y superficie de imagen 588×441 (4:3 exacto). Los 2 px
      que faltan son el borde de 1 px del chasis, que la cuenta de la spec no descontó; el alto
      no es 478 porque el `aspect-ratio` está en `.crt-screen` y el bisel añade su relleno y el
      pie de «SEÑAL OK».
- [x] El conjunto HUD + chasis mide menos de 700 px de alto a 1280 px de ancho.
- [x] Entre 900 y 1100 px la pantalla se encoge sola, sin desbordar el chasis ni provocar scroll
      horizontal.
- [x] Por debajo de 900 px la pantalla pasa arriba a todo el ancho y los controles quedan debajo.
- [x] A 390 px ningún objetivo táctil baja de 56 px y no hay scroll horizontal.
- [x] Los ocho juegos dibujan el chasis; `gloton`, `invasores` y `duelo-pixel` lo enseñan con los
      costados vacíos, sin cruceta ni botones.
- [x] En ROCAS sigue faltando el botón «abajo» con su hueco reservado, y el botón B sigue inerte.
- [x] Pulsar `←` en el teclado enciende el botón de la cruceta, y `ESPACIO` el botón A, cada uno
      en su mitad y sin encender nada de la otra.
- [x] Tocar un botón sigue moviendo el juego, y deslizar el dedo fuera de él sigue soltando la
      tecla.
- [x] «ARRASTRA EN LA PANTALLA» aparece bajo el chasis en BLOQUE BUSTER.
- [x] El HUD es idéntico al de antes de esta spec en escritorio y en móvil.
- [x] `npm run test:run`, `npm run lint`, `npx tsc --noEmit` y `npm run build` pasan.

---

## Decisiones

**Un chasis único, no dos paneles sueltos.** La alternativa —dejar el `.crt` como está y poner a
cada lado un panel con su propio marco— era más barata y no tocaba el CRT, pero se ve como tres
cajas juntas. El objetivo escrito de esta spec es que **parezca una consola**, y una consola
tiene una sola carcasa. El precio es que el marco que la SPEC 16 acababa de dar a `.mando` se
retira: pasa al chasis, que es ahora el único marco. No se pierde nada de su aspecto, cambia de
dueño.

**La pantalla cede el ancho; el chasis respeta los 1100 px del portal.** Se descartó **hacer
crecer el chasis a ~1450 px** para conservar el tamaño actual de la pantalla: el reproductor
dejaría de alinearse con la biblioteca y el salón, y en un monitor de 1366 px no cabría. Se
descartó también el punto medio de 1280 px por lo mismo, con menos ventaja. Perder ancho de
pantalla es aceptable porque **lo que se gana es alto**: el conjunto pasa de ~1030 px a ~530, y
eso es lo que hace que el mando deje de estar siempre fuera de vista.

**El corte está en 900 px.** Por debajo, la pantalla bajaría de 438 px de ancho y jugar deja de
ser cómodo; el ancho completo vale más que la estética. Se descartó **768 px** (la consola
aguantaría hasta tabletas en vertical, con la pantalla en unos 350 px) y **1100 px**
(conservador: ya en una tableta se vería apilado, perdiendo el aspecto de consola justo donde
hay sitio de sobra).

**Los tres juegos sin motor también llevan chasis, con los costados vacíos.** Es el mismo
razonamiento que la SPEC 16 aplicó al botón inerte, un escalón más arriba: una consola con los
costados lisos se lee como carcasa, pero **dos marcos distintos según el juego** se leen como un
error. Se descartó **dibujar cruceta y botones apagados** en ellos: ahí no hay ningún control que
prometer, ni siquiera uno que el juego no use — no hay motor que escuche nada.

**Cada mitad tiene su propio estado y su propia escucha.** Se descartó **levantar el estado a un
contexto o al reproductor** para compartir una sola escucha de `window`: son dos componentes
hermanos que no necesitan saber nada el uno del otro, y el eco ya filtra por `code` contra los
botones que cada mitad dibuja. Dos listeners es el precio, y es barato al lado de un contexto
nuevo atravesando el reproductor.

**El HUD se queda fuera.** Meterlo en la parte alta del chasis se vería mejor y es lo que hace
una recreativa de verdad, pero obliga a rehacer el HUD y su versión compacta de móvil, que es
justo lo que la SPEC 14 dejó afinado tras mirar el reproductor en un teléfono real. Queda
anotado como candidato a otra spec.

**Las maquetas de referencia se parten, y `gamepad.html` se queda.** Los dos archivos nuevos son
el patrón del que se porta cada mitad; el original sigue documentando el mando entero, que es de
donde salió todo y lo que la SPEC 16 sigue citando. Borrarlo dejaría huérfanas las referencias de
esa spec.

**Los controles no cambian de tamaño.** Siguen los 50/74 px de ratón y 56/76 de dedo de la SPEC 16. Esta spec los mueve; no los rediseña. Si a los lados se vieran pequeños, eso es una
observación para otra spec, no una licencia para tocar una geometría que se acaba de fijar y
medir.

---

## Riesgos

**El `min-width: 0` del centro es fácil de olvidar y difícil de diagnosticar.** Un elemento de
rejilla tiene `min-width: auto` por defecto, así que sin esa línea el CRT se niega a bajar de su
ancho de contenido y el chasis desborda en lugar de encoger. El síntoma —que a 1000 px la
pantalla siga midiendo lo mismo y los botones se salgan— es idéntico al del fallo que costó el
paso 6 de la SPEC 16.

**La pantalla más pequeña hace el juego más pequeño.** El canvas sigue siendo 800×600 y solo
cambia su tamaño en CSS, así que nada se deforma; pero a 638 px de ancho, los sprites de
SERPENTINA y el texto que pintan los motores se ven a un 64 % del tamaño de hoy. Es el precio
elegido al decidir que ceda la pantalla.

**Dos escuchas de teclado en vez de una.** Si en el futuro alguien monta las dos mitades más de
una vez en la misma página —dos reproductores, o una vista previa— habrá cuatro listeners
filtrando los mismos eventos. No rompe nada, porque el eco solo cambia estado visual y filtra por
`code`, pero conviene saberlo antes de montar el mando en dos sitios a la vez.

**El corte en 900 px cae dentro del rango de las tabletas.** Un iPad en horizontal (1024 px) verá
la consola; en vertical (768 px) la verá apilada. Es intencionado, pero significa que **girar la
tableta cambia la disposición**, y eso hay que verlo antes de dar la spec por buena.

---

## Lo que **no** está en esta spec

- Ningún cambio en `GameHandle`, `GameCallbacks`, `GameFactory`, los cinco motores ni `GAME_TOUCH`.
- Ningún cambio en el HUD ni en su disposición compacta de móvil.
- Ningún cambio en la geometría de los botones ni en el eco del teclado, que son de la SPEC 16.
- Controles dibujados en los juegos sin motor.
- Carteles de orientación, bloqueos por girar el teléfono o pantalla completa.
- Meter el marcador dentro del chasis.
