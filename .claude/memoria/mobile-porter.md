# Memoria de mobile-porter

Los pares ruta × viewport de Arcade Vault en móvil, con lo que se midió en cada uno y lo que
se arregló. La escribe y la lee el subagente `mobile-porter`
(`.claude/agents/mobile-porter.md`).

**Las filas no se borran ni se reescriben**: solo cambia la columna `Estado` y se rellenan las
medidas. Un histórico reescrito no es un histórico.

**«Móvil» aquí es la web en el navegador del teléfono.** No hay app nativa ni PWA en el repo, y
el agente no debe añadir una.

## Estados

- `pendiente` — ese par no se ha mirado nunca en un viewport real.
- `revisado` — se auditó y se midió, y no había nada que arreglar (o lo que había se dejó por
  escrito como observación).
- `arreglado` — se encontró al menos un defecto y se corrigió en `app/globals.css`, con
  captura de antes y después.
- `descartado` — no aplica. La columna `Peor defecto` explica por qué.

## Medidas

`Peor defecto` es el más grave que se midió en ese par, con su número: los píxeles que se
salía, el tamaño del área táctil, el cuerpo de la letra. Las cinco sondas están en el agente;
la primera —desbordamiento **por elemento**— es la que importa, porque `body` lleva
`overflow-x: hidden` (`app/globals.css:45`) y el desbordamiento se recorta en silencio.

Los cinco viewports: **320×568** (extremo), **375×667**, **412×915**, **844×390**
(horizontal) y **1440×900** (control de no-regresión en escritorio).

| Fecha      | Ruta                      | Viewport | Estado      | Peor defecto                                                                                                                                                                                                | Arreglo / Razón                                                                                                                                                           |
| ---------- | ------------------------- | -------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| —          | `/`                       | 320×568  | `pendiente` | —                                                                                                                                                                                                           | —                                                                                                                                                                         |
| —          | `/`                       | 375×667  | `pendiente` | —                                                                                                                                                                                                           | —                                                                                                                                                                         |
| —          | `/`                       | 412×915  | `pendiente` | —                                                                                                                                                                                                           | —                                                                                                                                                                         |
| —          | `/`                       | 844×390  | `pendiente` | —                                                                                                                                                                                                           | —                                                                                                                                                                         |
| —          | `/`                       | 1440×900 | `pendiente` | —                                                                                                                                                                                                           | —                                                                                                                                                                         |
| —          | `/biblioteca`             | 320×568  | `pendiente` | —                                                                                                                                                                                                           | —                                                                                                                                                                         |
| —          | `/biblioteca`             | 375×667  | `pendiente` | —                                                                                                                                                                                                           | —                                                                                                                                                                         |
| —          | `/biblioteca`             | 412×915  | `pendiente` | —                                                                                                                                                                                                           | —                                                                                                                                                                         |
| —          | `/biblioteca`             | 844×390  | `pendiente` | —                                                                                                                                                                                                           | —                                                                                                                                                                         |
| —          | `/biblioteca`             | 1440×900 | `pendiente` | —                                                                                                                                                                                                           | —                                                                                                                                                                         |
| 2026-09-11 | `/juego/gloton`           | 320×568  | `arreglado` | `.stat-strip` forzaba 338 px de min-content contra 288 de hueco: 36 elementos de `.av-detail` desbordaban 34 px del viewport y la descripción salía cortada a media palabra                                 | Relleno 12/8 y valor a 13 px bajo `max-width: 520px`; min-content 250 px. Sonda por elemento: 36 → 0                                                                      |
| 2026-09-11 | `/juego/gloton`           | 375×667  | `revisado`  | Ninguno. min-content de `.stat-strip` 338 px contra 343 de hueco: entra por 5 px                                                                                                                            | Sin cambios. El corte de 520 lo compacta igual, por CAÍDA (min-content 354, desbordaba ya aquí)                                                                           |
| 2026-09-11 | `/juego/gloton`           | 412×915  | `revisado`  | Ninguno. 0 desbordamientos, 0 objetivos táctiles propios de la ficha por debajo de 44                                                                                                                       | Sin cambios                                                                                                                                                               |
| 2026-09-11 | `/juego/gloton`           | 844×390  | `revisado`  | Ninguno propio. Del nav: «Iniciar Sesión» 204×41 y hamburguesa 57×41, 3 px por debajo de 44                                                                                                                 | Sin cambios: el nav es de las siete rutas y sus filas siguen `pendiente`                                                                                                  |
| 2026-09-11 | `/juego/gloton`           | 1440×900 | `revisado`  | Ninguno (control de no-regresión). `.stat-strip` 714×75, relleno 14 px y valor 16 px: la regla de 520 no llega                                                                                              | Sin cambios                                                                                                                                                               |
| 2026-09-11 | `/juego/gloton/jugar`     | 320×568  | `arreglado` | Overlay de arranque de 186 px de contenido en una pantalla de 158: 14 px recortados arriba y abajo por el `overflow: hidden` de `.crt-screen`, con el titular partido y el botón EMPEZAR sin borde inferior | Titular 14 px, controles 9 px y botón 44 px bajo `(pointer: coarse) and (max-width: 420px)`: contenido 154 ≤ 158. Además `.crt-bottom` envuelve por rótulo entero         |
| 2026-09-11 | `/juego/gloton/jugar`     | 375×667  | `arreglado` | `.crt-bottom` se partía por dentro de cada rótulo y los tres quedaban entrelazados en dos renglones                                                                                                         | `flex-wrap: wrap` + `row-gap: 4px`, sin media query (a 392 px de hueco ya caben en una línea)                                                                             |
| 2026-09-11 | `/juego/gloton/jugar`     | 412×915  | `arreglado` | Lo mismo de `.crt-bottom`: se leía «SEÑAL GLOTÓN · CRT-83 CARGA ·» / «OK · 60 HZ 1MB»                                                                                                                       | Igual que arriba. Overlay ya cabía: 186 de contenido en 227 de pantalla                                                                                                   |
| 2026-09-11 | `/juego/gloton/jugar`     | 844×390  | `arreglado` | El apilado de la SPEC 17 (por ancho) dejaba la pantalla en 714×536 dentro de una ventana de 390 de alto, y la cruceta 446 px por debajo del borde de la pantalla: jugar y ver el juego eran excluyentes     | `@media (max-height: 520px) and (min-width: 600px)` deshace el apilado. Pantalla 310×233 y chasis de 389 px: cabe entero en los 390, con cruceta y botones a los costados |
| 2026-09-11 | `/juego/gloton/jugar`     | 1440×900 | `revisado`  | Ninguno (control de no-regresión). Pantalla 588×441, chasis 565, `.crt-bottom` 588×12 con los tres rótulos en la misma línea, botones del HUD en 41 px como antes                                           | Sin cambios: los tres arreglos van en media queries que no llegan aquí                                                                                                    |
| —          | `/juego/serpentina`       | 320×568  | `pendiente` | —                                                                                                                                                                                                           | —                                                                                                                                                                         |
| —          | `/juego/serpentina`       | 375×667  | `pendiente` | —                                                                                                                                                                                                           | —                                                                                                                                                                         |
| —          | `/juego/serpentina`       | 412×915  | `pendiente` | —                                                                                                                                                                                                           | —                                                                                                                                                                         |
| —          | `/juego/serpentina`       | 844×390  | `pendiente` | —                                                                                                                                                                                                           | —                                                                                                                                                                         |
| —          | `/juego/serpentina`       | 1440×900 | `pendiente` | —                                                                                                                                                                                                           | —                                                                                                                                                                         |
| —          | `/juego/serpentina/jugar` | 320×568  | `pendiente` | —                                                                                                                                                                                                           | —                                                                                                                                                                         |
| —          | `/juego/serpentina/jugar` | 375×667  | `pendiente` | —                                                                                                                                                                                                           | —                                                                                                                                                                         |
| —          | `/juego/serpentina/jugar` | 412×915  | `pendiente` | —                                                                                                                                                                                                           | —                                                                                                                                                                         |
| —          | `/juego/serpentina/jugar` | 844×390  | `pendiente` | —                                                                                                                                                                                                           | —                                                                                                                                                                         |
| —          | `/juego/serpentina/jugar` | 1440×900 | `pendiente` | —                                                                                                                                                                                                           | —                                                                                                                                                                         |
| —          | `/salon`                  | 320×568  | `pendiente` | —                                                                                                                                                                                                           | —                                                                                                                                                                         |
| —          | `/salon`                  | 375×667  | `pendiente` | —                                                                                                                                                                                                           | —                                                                                                                                                                         |
| —          | `/salon`                  | 412×915  | `pendiente` | —                                                                                                                                                                                                           | —                                                                                                                                                                         |
| —          | `/salon`                  | 844×390  | `pendiente` | —                                                                                                                                                                                                           | —                                                                                                                                                                         |
| —          | `/salon`                  | 1440×900 | `pendiente` | —                                                                                                                                                                                                           | —                                                                                                                                                                         |
| —          | `/acerca`                 | 320×568  | `pendiente` | —                                                                                                                                                                                                           | —                                                                                                                                                                         |
| —          | `/acerca`                 | 375×667  | `pendiente` | —                                                                                                                                                                                                           | —                                                                                                                                                                         |
| —          | `/acerca`                 | 412×915  | `pendiente` | —                                                                                                                                                                                                           | —                                                                                                                                                                         |
| —          | `/acerca`                 | 844×390  | `pendiente` | —                                                                                                                                                                                                           | —                                                                                                                                                                         |
| —          | `/acerca`                 | 1440×900 | `pendiente` | —                                                                                                                                                                                                           | —                                                                                                                                                                         |
| —          | `/auth`                   | 320×568  | `pendiente` | —                                                                                                                                                                                                           | —                                                                                                                                                                         |
| —          | `/auth`                   | 375×667  | `pendiente` | —                                                                                                                                                                                                           | —                                                                                                                                                                         |
| —          | `/auth`                   | 412×915  | `pendiente` | —                                                                                                                                                                                                           | —                                                                                                                                                                         |
| —          | `/auth`                   | 844×390  | `pendiente` | —                                                                                                                                                                                                           | —                                                                                                                                                                         |
| —          | `/auth`                   | 1440×900 | `pendiente` | —                                                                                                                                                                                                           | —                                                                                                                                                                         |

## Sospechas de partida (sin medir todavía)

Salieron de leer el CSS al crear el agente, el 2026-09-10. **No son defectos confirmados**:
son los sitios por donde conviene empezar a mirar, y cada uno se cierra con una medida o se
descarta.

1. **`env(safe-area-inset-*)` no aparece ni una vez** en las ~3450 líneas de
   `app/globals.css`. En un teléfono con notch, el nav fijo de arriba y lo pegado abajo se
   meten debajo del sistema. Es la sospecha más probable de las cinco.
2. **`.home-hero { min-height: calc(100vh - 60px) }`** (línea 2346) es el único `100vh` del
   archivo: en móvil la barra de direcciones se come esos píxeles. `dvh` es el arreglo.
3. **`body { overflow-x: hidden }`** (línea 45) esconde los desbordamientos en vez de
   arreglarlos. Ya hay un caso admitido por escrito en el nav (línea 313). Hay que medir por
   elemento, no por documento.
4. **Press Start 2P + mayúsculas en español** es la combinación que más desborda: fuente de
   ancho fijo y cadenas más largas que en inglés. Los titulares del hero y las pestañas del
   salón son los candidatos.
5. **El horizontal (844×390) no lo ha mirado nadie.** El chasis `.consola` se apila por debajo
   de 899.98 px de **ancho**, así que en horizontal sale en fila con muy poco alto: es el par
   con más probabilidades de estar roto y el que ninguna spec contempló.

## Fuera de alcance (visto, y no es tuyo)

- **Las mayúsculas acentuadas salen en minúscula**: «SALóN DE LA FAMA», «CAíDA», «GLOTóN»,
  «AúN NADIE HA JUGADO». Press Start 2P **no trae glifo para Á/É/Í/Ó/Ú**, así que el
  `text-transform: uppercase` se queda a medias y esas letras caen a la fuente de reserva.
  **No es un defecto de móvil** —pasa igual en escritorio— y no se arregla con una media
  query: o se cambia la fuente, o se sustituye el glifo, o se escriben los títulos sin tilde.
  Es una spec, no un arreglo de CSS. Está aquí para que nadie lo «descubra» a mitad de una
  auditoría y se salga de su alcance intentando taparlo.

## Notas de sesión

- 2026-09-10 — Memoria inicializada al crear el agente. Estado del portal: 22 `@media` en
  `app/globals.css`, escritas spec a spec, con la escala
  `1100 · 980 · 900 · 899.98 · 840 · 820 · 720 · 600 · 520 · 420` más `pointer: coarse` y
  `hover: hover`. Tres cortes están medidos y documentados en el CSS (899.98, 420 y el apilado
  a 400): **no se mueven** sin releer las SPECS 14, 16 y 17. Ningún par auditado todavía.
- 2026-09-10 — **El banco de pruebas se probó de verdad** antes de dar el agente por bueno:
  `npm run dev`, Chromium de `playwright` y captura de `/salon` a 375×667. Salió, y de paso
  dejó dos cosas medidas que ya están en el agente: la sonda **por documento** da
  `scrollWidth 375 === innerWidth 375` en una página que no se puede afirmar que esté limpia
  (es el `overflow-x: hidden` mintiendo), y la sonda **por elemento** devuelve nueve
  desbordados que son el panel lateral cerrado y sus ocho hijos — de ahí que el filtro tenga
  que ser por ascendencia (`closest`) y no por elemento. Con el filtro bien, `/salon` a
  375×667 da **cero desbordamientos**; las otras cuatro sondas de ese par siguen sin pasar,
  así que su fila sigue en `pendiente`.
- 2026-09-11 — **Primera auditoría de verdad**: las dos rutas nuevas de GLOTÓN (SPEC 18) en los
  cinco viewports, diez pares, diez filas cerradas. Cuatro defectos medidos y arreglados, y
  cinco cosas que conviene no volver a descubrir desde cero:
  1. **El `min-content` de `.stat-strip` decide el ancho mínimo de toda la ficha de detalle**,
     porque sus tres celdas son `1fr` con `min-width: auto` y el valor va en Press Start 2P,
     que es de ancho fijo. Min-content por juego: CAÍDA 354 (desbordaba ya a 375), GLOTÓN 338,
     ROCAS 338, BLOQUE BUSTER 338, RANARIA 321, SERPENTINA 289. Tras el arreglo, las seis
     fichas dan cero desbordamientos a 320.
  2. **El overlay de arranque se recorta en silencio**: `.crt-screen` lleva `overflow: hidden`
     y a 320 la pantalla mide 158 px de alto. GLOTÓN es el único de los seis que ahora cabe
     (154) precisamente porque **no tiene selector de ASPECTO**. Los otros cinco siguen
     recortados ahí: SERPENTINA, BLOQUE BUSTER y RANARIA 328 px de contenido (171 de recorte),
     ROCAS 346 (188) y CAÍDA 363 (206). **Sus filas siguen `pendiente`**; el culpable es el
     bloque `.game-skins`, no el titular.
  3. **El horizontal ya no es tierra ignota.** El apilado de la SPEC 17 mira solo el ancho y en
     un teléfono tumbado lo que falta es alto: a 844×390 la pantalla salía de 714×536 y la
     cruceta quedaba 446 px por debajo de ella. Se añadió el único corte nuevo de la sesión,
     `(max-height: 520px) and (min-width: 600px)`, que deshace el apilado; los dos números son
     de la escala que ya existía y no se tocó 899.98, 420 ni el apilado a 400.
  4. **`env(safe-area-inset-*)` sigue sin aparecer en el archivo, y hoy no serviría de nada**:
     `app/layout.tsx` no exporta `viewport`, así que Next emite el meta por defecto **sin**
     `viewport-fit=cover` y los cuatro insets valen 0. La sospecha nº 1 de esta memoria no se
     puede cerrar desde CSS: primero hace falta `export const viewport = { viewportFit:
"cover" }`, que es TSX y no es del agente.
  5. **`white-space: nowrap` en `.crt-bottom` es una trampa**: se probó, y el rótulo del juego
     de nombre más largo —«BLOQUE BUSTER · CRT-83 · 60 HZ», 278 px— se salía 21 px del viewport
     a 320. La versión buena solo envuelve el contenedor y deja que el rótulo se parta si ni él
     solo cabe.
