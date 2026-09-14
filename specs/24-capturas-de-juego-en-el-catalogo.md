# SPEC 24 — Capturas reales de cada juego en el catálogo

> **Estado:** Borrador
> **Depende de:** SPEC 01, SPEC 13, SPEC 17
> **Fecha:** 2026-09-14
> **Objetivo:** Que las tarjetas del catálogo enseñen una captura real de cada juego bajo el mismo cristal CRT que el reproductor, capturada de forma reproducible por un script, sin borrar las portadas CSS ni tocar un motor.

---

## Por qué existe esta spec

Hoy la portada de cada tarjeta es **arte CSS abstracto**: `cover-bricks` son franjas de
colores, `cover-rocas` son triángulos, `cover-tetro` son cuadrados. Están bien hechas y dan
ritmo de color al catálogo, pero **no dicen a qué estás a punto de jugar**. Con cinco juegos se
toleraba; con siete motores reales —cada uno con mecánica, escenario y densidad propias— la
diferencia entre GLOTÓN e INVASORES se decide mirando el título, no la tarjeta.

### La trampa de este cambio, y cómo se esquiva

Sustituir arte hecho a mano por siete capturas de 800×600 tiene un final conocido: una rejilla
de rectángulos fotográficos, que es exactamente el aspecto de cualquier listado de juegos de
cualquier sitio. Se ganaría información y se perdería la identidad, que es mal negocio.

La salida sale del propio asunto. **Un salón recreativo no te enseña capturas: te enseña la
máquina jugando sola tras el cristal.** Eso es el _attract mode_, y es el vocabulario nativo de
este portal. Así que la portada no pasa a ser una miniatura, pasa a ser **la pantalla del
mueble**: la captura va debajo del mismo tratamiento CRT que ya lleva el reproductor
—líneas de barrido, viñeta y curvatura de tubo—, y el acento del juego sigue tiñendo el bisel.
`/biblioteca` deja de leerse como una rejilla de imágenes y se lee como **una pared de
máquinas encendidas**, que es lo que el portal dice ser desde la SPEC 01.

El código ya está a favor: `.card .cover` declara `aspect-ratio: 4 / 3`, `position: relative` y
`overflow: hidden` —la misma forma que `.crt-screen` y que el canvas de 800×600— y **sus
pseudoelementos `::before` y `::after` están libres**.

---

## Alcance

**Dentro:**

- **`scripts/capturar-juegos.mjs`** — captura las siete pantallas con Playwright, de forma
  **reproducible**: misma semilla, mismo número de fotogramas, mismo archivo byte a byte.
- **Siete imágenes en `public/covers/<id>.webp`**, una por motor, capturadas en el aspecto
  `neon`.
- **El cristal CRT sobre la portada**: líneas de barrido, viñeta y curvatura, reutilizando el
  lenguaje de `.crt-screen` en `.card .cover`.
- **El encendido al pasar por encima**: la pantalla sube de brillo al `hover` y al `:focus-visible`,
  respetando `prefers-reduced-motion`.
- **La portada CSS se queda como capa de debajo.** No se borra ni una clase `cover-*`.
- Un campo nuevo en `app/lib/data.ts` que dice qué juegos tienen captura.
- `npm run covers` en `package.json`.
- Los tres sitios que pintan la portada: `app/page.tsx`, `app/biblioteca/biblioteca-client.tsx`
  y `app/juego/[id]/page.tsx`.

**Fuera, explícitamente:**

- **Tocar un motor.** `app/lib/games/` no se abre. La captura se toma desde fuera, por el
  navegador, como la toma un jugador.
- **Vídeo o GIF en la tarjeta.** El _attract mode_ de verdad se mueve; aquí no. Siete vídeos en
  bucle en `/biblioteca` son peso, batería y mareo, y el movimiento que hace falta ya lo pone el
  CRT con CSS. **Si algún día se quiere, es otra spec.**
- **`next/image`.** Hoy no se usa en ningún sitio del proyecto y meterlo por esto es un cambio
  de infraestructura con su propia discusión.
- **Capturar `duelo-pixel`.** Es el único sin motor: no hay partida real que fotografiar y su
  portada CSS se queda. Ver «El caso sin imagen».
- **Rediseñar la tarjeta.** El tipo, el `.label` de categoría, la puntuación y el botón no se
  tocan. Lo único que cambia es la capa de la portada.
- **El campo `best` de `GAMES`**, que sigue siendo mock.
- **Capturas de las skins `retro` y `clasico`.** El catálogo enseña el portal, y el portal es
  `neon`. Ver Decisiones.
- **Retocar las capturas a mano** en un editor. Lo que no salga bien se arregla cambiando el
  guion de captura, no el píxel.

---

## Modelo de datos

### Archivos que aparecen o cambian

| Archivo                                        | Qué pasa                                              |
| ---------------------------------------------- | ----------------------------------------------------- |
| `scripts/capturar-juegos.mjs`                  | **Nuevo.** El guion de captura.                       |
| `public/covers/<id>.webp` (×7)                 | **Nuevos.** Una pantalla por motor.                   |
| `app/lib/data.ts`                              | El campo `shot` en el tipo `Game` y en siete fichas.  |
| `app/globals.css`                              | El cristal CRT, la capa `.cover-shot` y el encendido. |
| `app/page.tsx`                                 | La capa nueva en la portada.                          |
| `app/biblioteca/biblioteca-client.tsx`         | Ídem.                                                 |
| `app/juego/[id]/page.tsx`                      | Ídem.                                                 |
| `package.json`                                 | `npm run covers`.                                     |
| `specs/24-capturas-de-juego-en-el-catalogo.md` | Esta spec.                                            |

**`app/lib/games/` no aparece, y es la comprobación de que el diseño es correcto.** Si capturar
una pantalla pide abrir un motor, es que el guion está haciendo algo que no le toca.

### Las tres capas de la portada

De abajo arriba, dentro del `.card .cover` que ya existe:

```
┌─ .card .cover ──────────────── aspect-ratio 4/3, overflow hidden ─┐
│  3. cristal      ::before viñeta + ::after líneas de barrido      │
│  2. .cover-shot  la captura, background-image, object-fit cover   │  ← nueva
│  1. .cover-bg    el arte CSS de siempre (cover-rocas, cover-glot…)│
└───────────────────────────────────────────────────────────────────┘
```

La capa 1 **no se borra**. Es el fondo del tubo: lo que se ve mientras la imagen carga, y lo
que se ve para siempre en el juego que no tiene ninguna.

### El campo `shot`

```ts
export interface Game {
  // …lo que ya hay
  cover: string; // la clase CSS, sigue igual
  shot?: true; // hay public/covers/<id>.webp
}
```

Opcional y solo `true`: una ficha sin el campo es una ficha sin captura, que es la lectura
natural. Lo llevan los siete con motor; `duelo-pixel` no.

**Por qué un campo y no `id in GAME_ENGINES`**, que sería la verdad sin duplicar: importar
`registry.ts` desde `app/page.tsx` arrastraría **los siete motores al bundle de la landing**,
que es media aplicación de canvas para decidir el color de una portada. El campo cuesta siete
líneas y no cuesta un kilobyte de JavaScript.

### El nombre y el formato

`public/covers/<id>.webp`, con el `id` del catálogo: `public/covers/rocas.webp`. WebP y no PNG
porque son pantallas de color plano y contorno duro, donde WebP sin pérdida baja bastante sin
tocar un píxel. Se referencian con **ruta absoluta**, como el resto de `public/`.

---

## El guion de captura

`npm run covers` → `scripts/capturar-juegos.mjs`. Playwright ya es `devDependency` y Chromium
ya está descargado.

Para cada id de una lista escrita en el propio guion:

1. Abre `http://localhost:3000/juego/<id>/jugar`.
2. **Fija el azar antes de que cargue nada**, con `page.addInitScript`: sustituye
   `Math.random` por un LCG con semilla constante. Es la misma técnica que
   `tests/harness/skins.ts` usa para comparar secuencias de color.
3. Pulsa `Space` para salir del overlay de arranque.
4. **Avanza un número fijo de fotogramas** —no un `setTimeout`— y captura el `<canvas>`.
5. Guarda en `public/covers/<id>.webp`.

**Reproducible quiere decir byte a byte.** Volver a ejecutarlo sin cambiar un motor tiene que
dejar los siete archivos idénticos, o cada ejecución ensucia el diff con siete binarios y nadie
volverá a lanzarlo. De ahí lo de la semilla y el conteo de fotogramas: un `await page.waitForTimeout(3000)`
da una imagen distinta cada vez.

Cuántos fotogramas es **por juego, escrito en una tabla del guion**, porque el instante bueno
no es el mismo: CAÍDA necesita piezas ya apiladas, INVASORES una formación mordida, SERPENTINA
una serpiente que ya tenga largo. **Una pantalla de fotograma cero es un mueble apagado.**

El guion **no levanta el servidor**: exige que `npm run dev` esté corriendo y lo dice claro si
no lo está, igual que `db:check` distingue «no conecta» de «falta el esquema».

---

## Diseño visual

No entra ni un color ni una tipografía nueva. **La disciplina es el diseño**: las capturas se
toman en el aspecto `neon`, así que ya están hechas de `--cyan`, `--magenta`, `--yellow` y
`--green` sobre `--bg`. El catálogo sigue siendo el mismo sistema; lo que cambia es que ahora
enseña la verdad.

- **El cristal.** `.card .cover::after` pinta las líneas de barrido con el mismo
  `repeating-linear-gradient` de 2 px y `mix-blend-mode: multiply` que `.crt-screen`;
  `::before` pinta la viñeta radial. La curvatura (`border-radius: 12px / 28px`) va en la
  tarjeta, no en la imagen.
- **El bisel sigue siendo del juego.** El acento de `GAMES.color` mantiene el resplandor del
  borde, que es lo que hoy da ritmo de color a la rejilla y lo único que una pared de capturas
  perdería.
- **El encendido.** Al `hover` y al `:focus-visible`, la pantalla sube brillo y saturación en
  ~180 ms. Es la única animación que añade esta spec, y va dentro de
  `@media (prefers-reduced-motion: no-preference)`.

Una sola cosa llamativa y el resto callado: **el cristal es la firma**, y por eso no hay
vídeo, ni parallax, ni brillo barriendo la imagen.

### El caso sin imagen

`duelo-pixel` no lleva `shot`, así que no se pinta la capa 2 y se ve su `cover-duelo` de
siempre. **No hay un `if` para él**: hay una capa que existe o no existe. El día que tenga
motor se le añade el `.webp` y el `shot: true`, y nada más cambia. Lo mismo vale mientras la
imagen viaja por la red: debajo ya hay algo, nunca un hueco negro.

---

## Plan de implementación

Cada paso deja la app compilando y `npm run test:run` en verde.

1. **El guion, contra un solo juego.** `scripts/capturar-juegos.mjs` y `npm run covers`,
   capturando solo `rocas` para ajustar semilla, fotogramas y recorte.
   _Verificación:_ dos ejecuciones seguidas dan un archivo **idéntico** (`git status` limpio).

2. **Los siete.** La tabla de fotogramas por juego y las siete imágenes en `public/covers/`.
   _Verificación:_ las siete se ven a 800×600, ninguna en fotograma cero, todas en `neon`.

3. **El campo y una sola pantalla.** `shot` en el tipo `Game` y en las siete fichas, y la capa
   `.cover-shot` pintada solo en `/biblioteca`, todavía sin cristal.
   _Verificación:_ las siete tarjetas enseñan su juego; `duelo-pixel` sigue con su arte CSS.

4. **El cristal y el encendido** en `app/globals.css`, con su bloque de
   `prefers-reduced-motion`.

5. **Los otros dos sitios**: la landing (`app/page.tsx`) y el detalle
   (`app/juego/[id]/page.tsx`).

6. **Verificación final**, abajo.

---

## Criterios de aceptación

### Build

- [ ] `npm run test:run` en verde, con las mismas 554 pruebas.
- [ ] `npm run lint` sin errores ni avisos nuevos — en particular, **ningún aviso
      `no-img-element`**, porque la captura entra como `background-image` y no como `<img>`.
- [ ] `npx tsc --noEmit` sin errores.
- [ ] `npm run build` completa con Turbopack.
- [ ] No se añade ninguna dependencia: Playwright ya es `devDependency`.

### El guion

- [ ] `npm run covers` escribe siete archivos en `public/covers/`.
- [ ] Ejecutarlo **dos veces seguidas** deja `git status` limpio: los siete archivos son
      idénticos byte a byte.
- [ ] Sin `npm run dev` levantado, falla con un mensaje que lo dice y sale `1`, sin escribir
      ningún archivo a medias.
- [ ] Ninguna captura está en el fotograma cero: las siete enseñan una partida empezada.
- [ ] Las siete están tomadas en el aspecto `neon`.
- [ ] `app/lib/games/` no se ha modificado.

### La portada

- [ ] Las siete tarjetas con motor enseñan su captura en `/biblioteca`, en la landing y en
      `/juego/[id]`.
- [ ] `duelo-pixel` enseña su `cover-duelo` de siempre, en los tres sitios.
- [ ] Las clases `cover-*` siguen todas en `app/globals.css`, ninguna borrada.
- [ ] Con la imagen bloqueada en las herramientas de red, la tarjeta enseña su arte CSS y
      **no** un hueco negro.
- [ ] La portada mantiene `aspect-ratio: 4 / 3` y la captura no sale deformada ni recortada por
      un lado.
- [ ] Las líneas de barrido y la viñeta se ven sobre la captura.
- [ ] El acento de color de cada juego sigue tiñendo el borde de su tarjeta.
- [ ] Al pasar el ratón la pantalla sube de brillo; con `prefers-reduced-motion: reduce` no hay
      transición.
- [ ] El `.label` de categoría sigue legible por encima del cristal.
- [ ] A 320 px de ancho la rejilla sigue sin desbordarse en horizontal.

### Lo que no debe romperse

- [ ] `app/lib/games/` no se toca, ni un archivo.
- [ ] `app/juego/[id]/jugar/page.tsx` no se toca: el reproductor no sabe que esto existe.
- [ ] `app/lib/games/types.ts` no se toca.
- [ ] Ninguna migración de Supabase.
- [ ] El peso total de `public/covers/` se queda por debajo de **600 KB** entre los siete.

---

## Decisiones

- **Sí: el cristal CRT en vez de una miniatura a secas.** Es la decisión de la que depende que
  esto no convierta el catálogo en un listado genérico. El lenguaje ya existe en `.crt-screen`
  y en la consola de la SPEC 17; extenderlo a la tarjeta hace que `/biblioteca` se lea como una
  pared de muebles, que es lo que el portal dice ser.
- **Sí: la portada CSS se queda debajo.** Sale gratis —ya está escrita— y resuelve de un golpe
  tres casos: la imagen cargando, la imagen que falla y el juego que no tiene ninguna. Borrarla
  obligaría a inventar un estado vacío para los tres.
- **Sí: capturas en `neon` y solo en `neon`.** El catálogo enseña el portal, y el portal es
  neón: es el aspecto histórico, el que `skin-designer` tiene congelado y el que comparte los
  tokens de `:root`. Una rejilla con tres estéticas mezcladas no es variedad, es ruido. Y las
  skins son una preferencia del jugador que vive en `localStorage`: la tarjeta no la conoce, y
  hacer que la conozca significaría pintar la portada en cliente y desajustar la hidratación.
- **Sí: reproducible byte a byte, con semilla y conteo de fotogramas.** Es lo que separa un
  guion que se vuelve a ejecutar de uno que nadie vuelve a tocar. Con un `waitForTimeout`, cada
  ejecución produce siete binarios distintos y el `git status` deja de significar nada.
- **Sí: un fotograma con la partida ya empezada, elegido por juego.** Una pantalla en el
  fotograma cero es un mueble apagado, y es justo lo que no queremos enseñar. El número va en
  una tabla del guion porque el instante bueno de CAÍDA no es el de SERPENTINA.
- **Sí: `shot?: true` en `data.ts`.** Explícito, siete líneas, coste cero en el bundle.
- **No: derivar la captura de `GAME_ENGINES`.** Sería la única fuente de verdad y no duplicaría
  nada, pero importar el registro desde la landing **arrastra los siete motores al bundle**. Es
  el argumento que decide, y por eso queda escrito aquí.
- **No: vídeo ni GIF en bucle.** El _attract mode_ real se mueve, sí, pero siete vídeos en una
  rejilla son peso, batería y mareo, y obligan a un control de reproducción y a respetar
  `prefers-reduced-motion` en siete sitios. El movimiento que la tarjeta necesita lo da el
  cristal, que es CSS y no pesa. Si algún día se quiere de verdad, es su propia spec.
- **No: `next/image`.** Daría redimensionado y `srcset` gratis, pero hoy no se usa en ninguna
  parte del proyecto, y estrenarlo por una portada mete configuración de imágenes, un
  componente nuevo y su propio comportamiento de carga en un cambio que si no es de tres capas
  CSS.
- **No: `<img>` con `object-fit`.** Es lo natural en cualquier otro proyecto, pero aquí
  `eslint-config-next` avisa con `no-img-element` y la regla del repo es que `npm run lint` se
  queda limpio. `background-image` hace lo mismo, apila igual de bien y no discute con el
  linter.
- **No: retocar las capturas a mano.** Una imagen editada deja de ser reproducible, y a la
  tercera nadie sabe si `rocas.webp` sale del guion o del editor.
- **No: rediseñar la tarjeta.** El tipo, la categoría, la puntuación y el botón funcionan. El
  cambio es de una capa, no de un componente.

---

## Riesgos

| Riesgo                                                                                                                                                           | Mitigación                                                                                                                                                                                                                       |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Siete binarios versionados** que alguien regenera sin querer y mete en un commit ajeno.                                                                        | Reproducible por semilla: si no cambia el motor, no cambia el archivo, y `git status` se queda limpio. Es criterio de aceptación ejecutar el guion dos veces.                                                                    |
| **Las líneas de barrido sobre una captura ya pixelada** pueden dar muaré, que en el reproductor no pasa porque el canvas es grande y aquí la tarjeta es pequeña. | El `repeating-linear-gradient` es de 2 px como en `.crt-screen`; si aparece muaré a tamaño de tarjeta, se sube el paso en la tarjeta —no en el reproductor— y se comprueba a 320, 420 y 1440 px.                                 |
| **La captura tapa el `.label` de categoría**, que hoy vive sobre arte plano y controlado.                                                                        | La viñeta del `::before` oscurece justo las esquinas, que es donde está el `.label`. Criterio de aceptación explícito de que sigue legible.                                                                                      |
| **Un motor cambia y su captura se queda vieja** sin que nadie se entere: la imagen no la comprueba ninguna prueba.                                               | Es real y se asume. La mitigación es que regenerar cuesta un comando, y que `/nuevo-juego` y `/spec-imp-game` pueden pedirlo al final. **No se añade una prueba que compare píxeles**: sería un snapshot, y el repo los rechaza. |
| **Capturar exige `npm run dev` levantado**, que es un paso manual más.                                                                                           | El guion lo detecta y lo dice. Levantar el servidor dentro del guion significaría gestionar un proceso hijo y su apagado, y eso falla peor y más callado en Windows.                                                             |
| **`duelo-pixel` queda visiblemente distinto** al lado de siete capturas: la única tarjeta con arte abstracto.                                                    | Es información honesta, no un defecto: es el único juego que todavía no se puede jugar de verdad. La alternativa —fotografiar el reproductor simulado— enseñaría algo que no es un juego.                                        |

---

## Lo que **no** está en esta spec

- Vídeo, GIF o cualquier portada en movimiento.
- Capturas de los aspectos `retro` y `clasico`.
- Una captura para `duelo-pixel`, que no tiene motor.
- `next/image` y la configuración de imágenes de Next.
- Rediseñar la tarjeta, el detalle del juego o la landing más allá de la capa de portada.
- Una prueba automática que compare las capturas píxel a píxel.
- Regenerar las capturas dentro de `/nuevo-juego` o de `/spec-imp-game`.
- El campo `best` del catálogo, que sigue siendo mock.
- La auditoría móvil de la rejilla nueva, que es trabajo de `mobile-porter`.

Cada una de ellas, si llega, en su propia spec.
