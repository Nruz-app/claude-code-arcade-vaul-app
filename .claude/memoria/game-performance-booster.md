# Memoria de game-performance-booster

Registro del coste por fotograma de cada motor de `app/lib/games/`: qué se midió, cuánto costaba,
qué se optimizó y qué se descartó por no compensar. La lee y la actualiza el subagente
`.claude/agents/game-performance-booster.md` en cada invocación.

**Las filas no se borran ni se reescriben**: solo cambia la columna `Estado` y se rellenan las
medidas. Un histórico reescrito no es un histórico — y aquí además es la única forma de saber si
una cifra de hoy es una mejora o una regresión.

## Estados

- `pendiente` — nadie ha medido este motor todavía.
- `medido` — tiene las cinco sondas tomadas, pero no se ha tocado el código.
- `optimizado` — medido, cambiado y vuelto a medir, con la suite entera en verde.
- `descartado` — medido, y lo que se encontró no compensa (o solo se arreglaba cambiando lo que
  se ve, que está vetado). La razón va en la última columna, con su cifra.

## Medidas

Las cinco sondas de la regla número cuatro del agente. Las cuatro primeras salen de Vitest con el
harness (`tests/harness/canvas.ts`, `reloj.ts` y `motor.ts`) y son deterministas; la quinta
necesita Chromium y es la única que ve el coste real del rasterizado.

- **Dibujo/frame** — delta de `llamadasDeDibujo(ctx)` en un fotograma. Es un contador global, sin
  desglose por método: el Proxy del harness devuelve el mismo `noop` para cualquier propiedad.
- **Colores/frame** — `coloresUsados(ctx).length` con `olvidaColores(ctx)` entre fotogramas.
  Cuenta las escrituras a `fillStyle`, `strokeStyle` y `shadowColor`, así que cuenta halos de
  paso.
- **Heap Δ 600f** — `used_heap_size` antes y después de `reloj.avanza(600)` (~10 s a 60 fps), con
  `global.gc()` a los dos lados. Es la sonda de las allocations por fotograma.
- **Frame p95** — percentil 95 del tiempo entre fotogramas reales en `/juego/<id>/jugar`, medido
  sobre un build de producción. La media miente; el p95 es lo que se percibe como tirón.

Se anotan **antes → después**. Una celda con un solo número es un motor `medido` o `descartado`,
que no llegó a tocarse.

| Fecha      | Motor         | Id              | Estado       | Dibujo/frame | Colores/frame | Heap Δ 600f            | Frame p95                                     | Optimización / Razón                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ---------- | ------------- | --------------- | ------------ | ------------ | ------------- | ---------------------- | --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-09-11 | ROCAS         | `rocas`         | `optimizado` | 175 → 150    | 15 → 7        | 1803 → 1364 KB         | 16,8 · sin vsync 2,9 p50 / 11,1 p95 (266 fps) | Sin caché posible: en ROCAS **no hay nada estático** (todo rota, se mueve o envuelve) y no usa `shadowBlur` en ningún sitio. Lo que había era estado de contexto reasignado por entidad y basura por fotograma: el estado común de cada grupo (`strokeStyle`/`lineWidth`/`lineJoin`) sube a `draw()` (−38 escrituras/frame, y `colores/frame` de la ventana quieta 6 → 3), `save()`+`translate()`+`rotate()`+`restore()` → `setTransform()` con la misma matriz (−2 llamadas por roca, 10/frame), 6 `.filter()` + 5 `forEach` + `concat` + `split()` por fotograma → `compactaVivos()` in situ y un búfer del closure, vértices de roca planos, y el `ts` del rAF en vez de `performance.now()` dentro de `draw()`. Verificado con una traza A/B contra HEAD (mismo LCG): 7169 operaciones de pintado, **geometría y estado relevante idénticos al 100 %**. Ver «Nota de ROCAS» al final. |
| 2026-09-11 | CAÍDA         | `caida`         | `optimizado` | 217 → 159    | 175 → 32      | 168 → 71 KB (±ruido)   | 17,0 · sin vsync 5,6 p50 / 13,9 p95 (157 fps) | Pozo + rejilla en caché offscreen (−59 llamadas/frame, eran 60 de 89) y color por celda agrupado en dos pasadas (−118 escrituras de estado). 0 px distintos.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 2026-09-11 | BLOQUE BUSTER | `bloque-buster` | `optimizado` | 136 → 23     | 193 → 8       | 73 → 42 KB (±ruido)    | 17,0 · sin vsync 2,4 p50 / 8,7 p95 (318 fps)  | Muralla cacheada en un canvas offscreen del closure (704×208): 118 `fillRect` con `shadowBlur` pasan a 1 `drawImage`. Ver «Nota de BLOQUE BUSTER» al final.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 2026-09-11 | SERPENTINA    | `serpentina`    | `optimizado` | 148 → 38     | 8 → 6         | ±ruido (−155…+286 KB)  | 16,8 · sin vsync 4,0 p50 / 10,2 p95 (226 fps) | Fondo + rejilla cacheados en un canvas offscreen del closure: 111 de las 148 llamadas pasan a 1 `drawImage`. Ver «Nota de SERPENTINA» al final.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 2026-09-11 | RANARIA       | `ranaria`       | `optimizado` | 951 → 465    | 150 → 103     | 114 → 140 KB (= ruido) | 16,9 · sin vsync 7,3 p50 / 12,9 p95 (139 fps) | Escenario estático cacheado (375 llamadas/frame, 320 de ellas `quadraticCurveTo` del río) → 1 `drawImage`; los 11 `save()`/`restore()` por entidad (118 llamadas) → 1; `shadowColor` por carril y no por móvil (−14 colores); sin `.find()` ni cajas nuevas por frame. 0 emisiones en 600f, ya estaba bien. Descartado: bajar `shadowBlur` (vetado) y reagrupar el dibujo por capas (movería los halos).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 2026-09-11 | GLOTÓN        | `gloton`        | `optimizado` | 2593 → 343   | 261 → 23      | 15 → 15 KB (= ruido)   | 16,9 · sin vsync 2,6 p50 / 9,4 p95 (278 fps)  | Laberinto (fondo + 548 muros + puerta) cacheado en un canvas offscreen del closure: 2 258 llamadas pasan a 1 `drawImage`. Comestibles por lista precalculada y en dos pasadas: 868 celdas visitadas → 244, y 233 `fillStyle` repetidos → 1. Medido aparte en Chromium: 0,9 → 0,4 ms de p50 por fotograma, 0 px distintos en 161 fotogramas. Ver «Nota de GLOTÓN» al final.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |

## Sospechas de partida (sin medir todavía)

Salieron de una lectura de los seis motores el 2026-09-11, al crear el agente. **Ninguna está
medida**: son puntos donde mirar primero, no defectos confirmados. Están aquí para que nadie las
«descubra» a mitad de una auditoría y se salga de su alcance intentando taparlas.

1. **`gloton` — `pacman.ts:342-398`.** `drawLaberinto` recorre **28 × 31 = 868 celdas cada
   fotograma** y, por cada celda de muro, construye **un array literal de cuatro tuplas** y hace
   **su propio `beginPath()`/`stroke()`**. El laberinto es completamente estático. Segundo doble
   bucle de 868 celdas para la puerta (`:392-397`), y un tercero en `drawComestibles`
   (`:404-436`). Es el candidato número uno del catálogo, y el motor más reciente.
2. **`bloque-buster` — `arkanoid.ts:726-738`.** `shadowBlur = 8` activo durante todo el bucle de
   bloques, con `shadowColor` reasignado **por bloque**: con 10 × 6 bloques son hasta 120
   `fillRect` con blur gaussiano por fotograma. Más `shadowBlur` en la pala (`:746`) y en la bola
   (`:765`). Es el que peor debería salir en la sonda 5 y el que mejor sale en las otras cuatro:
   el harness no ve el blur.
3. **`ranaria` — `frogger.ts:615-676` y `:688-909`.** El río se regenera con ~80
   `quadraticCurveTo` por fotograma aunque el agua sea estática, con un `setLineDash([18, 14])`
   que crea un array literal cada vez. Y hay **once pares `save()`/`restore()`**, casi todos por
   entidad, sobre los 40-60 móviles que producen los doce carriles.
4. **`rocas` — `asteroids.ts:649-684`.** Cuatro o cinco arrays nuevos por fotograma
   (`.filter()` encadenados más un `.concat()`). Y `performance.now()` dentro de `draw()`
   (`:321`) teniendo el `ts` del rAF a mano, más `ctx.font` asignado por power-up vivo (`:332`).
5. **`caida` — `tetris.ts:640-672`.** `ctx.font` reasignado **tres veces por fotograma** en
   `drawPanel`, y `globalAlpha` puesto y quitado **por celda** en `drawCell` (`:535`, `:540`),
   hasta doscientas veces. Por lo demás es el más limpio de los seis en allocations.
6. **`serpentina` — `snake.ts:534-590`.** La rejilla del fondo se retraza entera cada fotograma
   (31 verticales + 23 horizontales, eso sí, en un solo path), y el cuerpo entero se dibuja con
   `shadowBlur = 10` activo, un `rectRedondeado` con cuatro `arcTo` por segmento.

Y dos transversales, que afectan a todos:

- **Ningún motor pasa `{ alpha: false }` a `getContext("2d")`.** Sería gratis para los cinco que
  arrancan con un `fillRect(0, 0, W, H)` opaco. **No para CAÍDA**, que usa `clearRect` a propósito
  para dejar ver el marco CRT por detrás.
- **Ningún motor salta el `draw()`**: el bucle dibuja incondicionalmente. Es deliberado, y el
  agente tiene prohibido «arreglarlo» con dirty rectangles.

## Fuera de alcance (visto, y no es tuyo)

- **El reproductor no aplica `devicePixelRatio`** (`app/juego/[id]/jugar/page.tsx:286-291`): el
  canvas es 800×600 en atributos y se estira por CSS. Hoy eso abarata el rasterizado a cambio de
  verse borroso en pantallas HiDPI. Vive en el JSX, así que **no es del agente**: si alguien lo
  arregla, el coste de todos los motores sube con el DPR y **todas las cifras de frame p95 de
  esta tabla quedan obsoletas**.

## Notas de sesión

- 2026-09-11 — **Memoria inicializada al crear el agente.** Seis motores en el catálogo, los seis
  en `pendiente`. Ninguno se ha mirado nunca desde el rendimiento. El harness de medida
  (`tests/harness/rendimiento.ts`) todavía no existe: lo crea la primera invocación, y con él la
  cuarta suite compartida del repo, `verificaRendimiento`. Las seis sospechas de arriba salen de
  leer los seis archivos, no de medir: la primera invocación debería empezar por confirmarlas o
  tumbarlas.

## Nota de SERPENTINA (2026-09-11)

Sospecha nº 6 **confirmada a medias**: la rejilla sí era el coste dominante de las sondas
deterministas, pero el halo del cuerpo no se puede tocar.

Medido con `tests/harness/rendimiento.ts` en el momento fijo «fotograma 80, serpiente de 3
segmentos» (calentamiento 60 + 20 muestras, 16 ms/fotograma). **Bajo jsdom el PNG de las frutas
nunca carga**, así que lo medido es la rama del rombo de respaldo, que es la barata: con sprite,
cada fotograma cambia 9 llamadas del rombo por 1 `drawImage` + `save`/`restore`.

- **Dibujo/frame 148 → 38.** Las 148 eran: fondo y rejilla 111 (`fillRect` + `beginPath` + 54
  `moveTo` + 54 `lineTo` + `stroke`; 31 verticales y 23 horizontales en un único path, eso ya
  estaba bien), serpiente 28 (8 por segmento: `beginPath` + `moveTo` + 4 `arcTo` + `closePath` +
  `fill`, más 2 `fillRect` de los ojos y 2 `save`/`restore`) y fruta 9. La rejilla se pinta ahora
  una vez en un `<canvas>` del closure y se copia con un `drawImage`.
- **Colores/frame 8 → 6.** Las dos que bajan son `fondo` y `rejilla`, que ahora se asignan al
  contexto de la caché. No había ningún patrón de «reasignar el mismo color N veces»: las 8 eran
  8 colores distintos (el `#f5ff00` sale dos veces porque el rombo usa el mismo color en
  `fillStyle` y en `shadowColor`, que es intencionado).
- **Emisiones en 600 fotogramas: 1.** Nada que hacer, y conviene saber por qué: **sin tocar una
  tecla la partida se estrella contra la pared derecha en el fotograma 146** (16 pasos de 145 ms),
  así que de los 600 del presupuesto solo los 146 primeros hacen trabajo. Para medir 600
  fotogramas de verdad hay que conducir la serpiente en círculo (un giro cada 100 fotogramas).
- **Heap Δ 600f: inconcluyente por ruido.** Cuatro corridas dieron +5, −91, +247 y +279/+286 KB
  antes y después indistintamente. La señal de SERPENTINA está muy por debajo: sus únicas
  allocations por fotograma eran un objeto `{dc,dr}` y el array `[1,-1]` de los ojos (~1200
  objetos en 600 fotogramas, ≈38 KB), quitadas de todos modos porque era gratis. El presupuesto
  se dejó en 600 KB: solo caza una regresión de orden de magnitud.

**Descartado, con su cifra:**

- **Agrupar los segmentos del cuerpo en un solo path** (ahorraría `8 × (L−1) − 8` llamadas, 16 con
  la serpiente corta y ~500 con 64 segmentos): **cambia lo que se ve**. Hoy cada segmento se
  rellena por separado de la cola a la cabeza con `shadowBlur = 10`, así que el halo de un
  segmento se pinta **encima** del anterior; con un solo `fill` la sombra se compone una vez
  detrás de la unión. Vetado por la regla nº 2.
- **`{ alpha: false }` en `getContext("2d")`.** Sería seguro aquí (las tres paletas tienen
  `fondo: "#000"` y el primer trazo es un `fillRect` opaco de 800×600), pero **no lo ve ninguna de
  las cuatro sondas deterministas**: sin la quinta no hay forma de demostrar la ganancia, así que
  se queda sin aplicar. Candidato para cuando se mida el p95.
- **Los dos pares `save()`/`restore()`** de `drawSerpiente` y `drawFruta` (4 de las 38 llamadas
  restantes). Se pueden sustituir por un `shadowBlur = 0` explícito antes de los ojos sin cambiar
  un píxel, pero el harness se los traga en 0 ms: sin la sonda 5 no compensa el riesgo.
- **`celdasLibres()` (`snake.ts:365`)** construye hasta **768 objetos `Celda` + un `Set`** por
  fruta comida (≈31 KB de basura efímera). Se puede hacer equivalente sin allocations (contar
  libres, sortear el índice con el mismo `Math.random`, segunda pasada para localizar la celda
  k-ésima), pero **no está en el camino por fotograma** y la sonda 4 dice que las allocations no
  son el problema de este motor. Queda anotado para no volver a medirlo.
- **Frame p95 diferido por concurrencia** (seis auditorías en paralelo compartían `.next/` y el
  puerto 3000). Lo que hay que mirar cuando se mida: el cuerpo entero se rellena con
  `shadowBlur = 10` y la cabeza con 16, un blur gaussiano por segmento que crece con la partida,
  así que la cifra depende mucho del momento —fíjalo en el fotograma 80 y, aparte, con serpiente
  larga—. La caché del fondo debería notarse en el p50 (54 líneas de `stroke` menos) pero no en el
  p95, que lo manda el halo.

## Nota de BLOQUE BUSTER (2026-09-11)

Auditado desde `pendiente`. La sospecha nº 2 de la lista de arriba **se confirma en volumen y se
confirma también la letra pequeña**: el harness ve el número de llamadas pero no el blur, así que
las cuatro sondas deterministas ya daban el motor más caro del catálogo en dibujo y colores.

**Medido antes (partida sin tocar teclas, reloj determinista a 16 ms):**

- **Dibujo/frame 132** en la ventana de 20 fotogramas tras 60 de calentamiento, y **136 en el peor
  fotograma de seis partidas de 600** (`arkanoid.ts:726-738`, `drawBlocks`). Desglose:
  `fillRect×129`, `=fillStyle×130`, `=shadowColor×61`. De ahí 118 `fillRect` y 59 `shadowColor` son
  la muralla: 59 bloques vivos × (cuerpo + banda de relieve), todos con `shadowBlur = 8`.
- **Colores/frame 191–193**, de los que **177 son de la muralla** (`rgba(255,255,255,0.14)×59` del
  relieve + 118 entre veta y halo). El patrón «reasignar el mismo valor N veces» estaba en
  `shadowColor`: las filas de los cinco patrones son monocromas, así que se escribía el mismo halo
  diez veces seguidas.
- **Emisiones en 600 fotogramas: 8** (score 6, vidas 4, nivel 1, menos los 3 forzados de
  `initGame`). Ya estaba bien: nada que optimizar aquí.
- **Heap Δ 600f: +73 KB**, y **la sonda no ve el problema real de allocations**: los
  `particles.filter()` (`arkanoid.ts:978`) creaban **600 arrays en 600 fotogramas** —medido
  instrumentando `Array.prototype.filter`— pero son basura que se recoge, o sea presión de GC y no
  retención. Cinco corridas seguidas de `mideHeap` dieron 42, 71, 303, 327 y 393 KB: el ruido de
  los otros motores del proceso tapa cualquier señal de este.

**Optimizado (mismo momento, mismas sondas):**

- **Dibujo/frame 136 → 23** en el peor fotograma (−83 %), y 132 → 15 en la ventana de medida. Los
  23 del peor caso son 16 partículas vivas + fondo + paleta + pelota + el `drawImage`.
- **Colores/frame 193 → 8** (−96 %).
- **Amortizado, contando el canvas de la caché** (que las sondas no miran porque solo espían el
  contexto principal): **9,8 llamadas por fotograma**. En 600 fotogramas el muro se repinta **7
  veces** (carga de nivel + 6 bloques roídos) × 117 llamadas = 819, frente a las ~70 000 de antes.
- **`filter()` en 600 fotogramas: 600 → 0.** Heap 73 → 42 KB, dentro del ruido.
- **Identidad de píxeles demostrada, no supuesta:** rasterizando en Chromium con `page.setContent`
  (sin servidor, sin `.next/`) el dibujo directo y el cacheado dan **0 píxeles distintos de
  480 000, peor canal 0**, en cuatro patrones de muralla (completa, damero, un solo bloque, una fila
  suelta). Es la prueba de que «source-over» es asociativo y de que el margen de 32 px recoge el
  halo entero.

**Descartado, con su cifra:**

- **Agrupar los bloques por veta en un solo path** (ahorraría ~50 `fillStyle` por pintada de
  muralla): **cambia lo que se ve.** Con `shadowBlur = 8` el halo de cada bloque se pinta encima
  del bloque ya dibujado y de su banda de relieve; reordenar el recorrido recoloca esas
  superposiciones. Vetado por la regla nº 2 — y ya no hace falta, porque esa pintada ocurre 7 veces
  en 600 fotogramas y no 600.
- **Bajar `GLOW_BLOCK`/`GLOW_PADDLE`/`GLOW_BALL` (8/14/12) o quitar el blur de los bloques.** Es lo
  único que tocaría el coste dominante del rasterizado, y está vetado: el halo es el aspecto neón
  del portal. Pagado una sola vez con la caché, que es la vía que sí estaba permitida.
- **El objeto `StepOutcome` de `stepBall()`** (`arkanoid.ts:535`): 1 objeto + 1 array por
  fotograma, 1200 en 600 fotogramas. Se quitaría con un buffer del closure, pero `stepBall` es una
  función exportada y probada por separado (`tests/games/arkanoid.test.ts`), así que pasar a
  parámetro de salida cambiaría su firma y las pruebas que la usan. Dos objetos por fotograma no lo
  justifican; queda anotado para no volver a medirlo.
- **El `pointerdown`/`pointermove` y los dos `crearSfx`**: no son coste por fotograma. El audio
  dispara como mucho un `play()` de cada efecto por fotograma y ya estaba acotado por la SPEC 12.

**Aplicado sin poder medirlo todavía:** `{ alpha: false }` en `getContext("2d")`. Es pixel-idéntico
aquí —el motor tapa el canvas con `paleta.fondo`, opaco en las tres paletas, y detrás solo hay el
`background: #000` de `.crt-screen`—, se incluyó en la comparación de píxeles de Chromium (0
diferencias) pero **ninguna de las cuatro sondas de Vitest lo ve**, porque el stub ignora el segundo
argumento. Si alguien le da un `fondo` translúcido a un skin futuro, hay que quitarlo.

**Frame p95 diferido por concurrencia** (seis auditorías en paralelo compartían `.next/` y el puerto
3000). Lo que hay que medir cuando se pueda, y contra qué: muestrear
`/juego/bloque-buster/jugar` dos veces en el **mismo momento**, al **segundo 2** (muralla completa,
59-60 bloques vivos) y al **segundo 30** (muralla mediada), porque el coste de este motor **baja**
con la partida en vez de subir. La hipótesis a confirmar es que este era el peor p95 de los seis y
que la caché se lo lleva casi entero: lo que desaparece del fotograma son **118 `fillRect` con un
blur gaussiano de σ = 4 sobre 62×22 px cada uno**, y lo que queda es un `drawImage` de 704×208 más
el blur de la paleta (14) y la pelota (12), que son dos formas. No hay cifra de referencia: nadie ha
medido nunca el p95 de este juego, así que el antes hay que sacarlo de `git show` del archivo
anterior a este cambio.

## CAÍDA (`caida`) — 2026-09-11

Medido con `tests/harness/rendimiento.ts` y su desglose por método (el contador de `canvas.ts` es
un entero sin desglose). Dos escenarios, porque el coste de este motor lo manda **cuántas celdas
hay en el pozo**: `vacío` (las opciones por defecto de la suite, ~1 pieza fijada) y `poblado`
(16 hard drops repartidos por el pozo con ArrowLeft/ArrowRight; más de 16 y la partida se acaba,
porque sin colocar bien las piezas el pozo se llena en una docena de drops).

| Sonda                | Vacío                                             | Poblado (16 drops) | Dónde estaba el coste                                    |
| -------------------- | ------------------------------------------------- | ------------------ | -------------------------------------------------------- |
| Dibujo/frame         | 89 → **31**                                       | 217 → **159**      | `tetris.ts:559-577` (rejilla) y `:523-541` (`drawCell`)  |
| Colores/frame        | 47 → **11**                                       | 175 → **32**       | `drawCell` asignaba `fillStyle` 2× **por celda**         |
| Escrituras de estado | 62 → **18**                                       | 318 → **43**       | `globalAlpha` 2× por celda (152 en un frame) + `font` ×3 |
| Emisiones en 600 f   | 0 → 0                                             | —                  | ya era correcto: `setScore`/`setLevel` comparan antes    |
| Heap Δ 600 f         | 168 → 71 KB                                       | ±ruido             | no hay allocations por fotograma, ni antes ni después    |
| Frame p95 (Chromium) | 17,0 ms con vsync / 5,6 sin vsync (ver «Sonda 5») |                    | —                                                        |

**Lo que se hizo** (todo en `app/lib/games/tetris.ts`):

1. **Caché del interior del pozo en un canvas offscreen del closure.** El `fillRect` de 280×560 y
   las **28 líneas de rejilla** eran **60 de las 89** llamadas al contexto de un fotograma con el
   pozo vacío, y no cambian nunca (dependen solo de la paleta, y cambiar de skin recrea el motor).
   Ahora son **un `drawImage`**. Se cachea **solo el interior, que es 100 % opaco**: el marco
   translúcido se sigue trazando en directo para no guardar píxeles premultiplicados a 8 bits en un
   canvas intermedio. El marco no toca ni un píxel del interior (cubre las columnas 184-185/466-467
   y las filas 18-19/580-581), así que pintarlo después de la rejilla da la misma imagen.
2. **Cuerpo y banda de relieve en dos pasadas.** `drawCell` asignaba `fillStyle` 2× y
   `globalAlpha` 2× por celda: con el pozo a medio llenar, **140 + 136 escrituras de estado por
   fotograma**. Ahora el cuerpo agrupa celdas consecutivas del mismo color y la banda (`brillo`, el
   mismo color en todas) va en una pasada con un único `fillStyle`; `globalAlpha` solo se toca para
   el fantasma (0.2), una vez por pieza. **Mismo número de `fillRect`**, en el mismo sitio.
3. **Quitado el tercer `ctx.font` del fotograma** (`drawPanel`): nada entre el primero y él tocaba
   la fuente. Quedan dos, que son las dos imprescindibles.

**Píxeles idénticos, demostrado y no argumentado:** las dos rutas de dibujo (la vieja y la nueva)
transcritas a un script de scratchpad y ejecutadas en **Chromium sobre una página pelada con
`setContent`** (sin servidor ni puerto), comparando `getImageData` de dos canvas de 800×600 en 24
escenarios (pozo vacío, pozos medio llenos con las ocho piezas, fantasma solapando la pieza, las
ocho piezas en el preview): **0 píxeles distintos de 480 000 en cada escenario**.

**Descartado, con su cifra:**

- **Cachear `ghostY`** (`tetris.ts:371-375`), que se recalcula cada fotograma en `draw()`: medido a
  **0,7 µs por llamada** (200 000 iteraciones sobre un pozo medio lleno) = **0,004 % de un
  fotograma de 16,7 ms**. Se puede invalidar bien (depende solo de forma, `x` y tablero, no de `y`),
  pero no compensa el riesgo de que el fantasma salga en la fila equivocada. No volver a medirlo.
- **`{ alpha: false }` en `getContext("2d")`**: **vetado para este motor**, y no por coste. CAÍDA
  limpia con `clearRect` a propósito para que el hueco alrededor del pozo deje ver el marco CRT;
  con el contexto opaco el canvas se pintaría de negro y se perdería el efecto.
- **Cachear también el panel lateral** («SIGUIENTE», «LÍNEAS» y el recuadro: ahorraría 2 `fillText`,
  2 escrituras de `font` y 1 `strokeRect` por fotograma, ~7 de las 31 llamadas restantes con el pozo
  vacío). **No se hizo por fidelidad**: el antialiasing de los glifos y el recuadro
  `rgba(0,245,255,0.18)` son píxeles translúcidos sobre el vacío del canvas, y pasarlos por un
  canvas intermedio los almacena premultiplicados a 8 bits, lo que puede mover un ±1 en los bordes.
  Siete llamadas no valen arriesgar la regla nº 2.
- **El `e.repeat` y el DAS** (`tetris.ts:424-497`) y las emisiones `onLives(1)`/`onLives(0)`: son
  entrada y contrato, no dibujo. No se tocaron.
- **Frame p95 diferido por concurrencia** (seis auditorías en paralelo compartían `.next/` y el
  puerto 3000). Lo que hay que mirar cuando se mida: **este motor no usa `shadowBlur` en ningún
  sitio**, así que debería ser el más barato de los seis en rasterizado; el coste real estaba en el
  relleno de 280×560 + 28 líneas translúcidas por fotograma, que ahora es un blit. Fija el momento
  en el fotograma 80 con el pozo vacío y, aparte, con el pozo a media altura: el coste crece con las
  celdas (2 `fillRect` cada una).

**Presupuesto dejado en `tests/games/tetris.test.ts`**: `dibujoPorFrame: 80`, `coloresPorFrame: 18`,
`emisionesEn600: 20`, `heapKbEn600: 400`. Medido con las opciones por defecto de la suite en 12
corridas: 47 / 11 / 0 / ≤97 KB. La holgura del primero es para el azar de la pieza (la tuerca son
ocho celdas, el doble que cualquier otra, y pueden coincidir en tablero, pieza, fantasma y preview);
aun así los cuatro techos quedan por debajo de lo que el motor costaba antes, así que una regresión
de verdad —volver a trazar la rejilla, o reasignar el color por celda— los rompe.

## Nota de GLOTÓN (2026-09-11)

La sospecha nº 1 de la lista de arriba **estaba bien puesta y se queda confirmada con cifra**:
`drawLaberinto` + `drawComestibles` eran **2 258 de las 2 593 llamadas al contexto por fotograma**.
Desglose del fotograma más caro antes de tocar nada (sonda 1 con el Proxy propio de
`tests/harness/rendimiento.ts`): `lineTo`×604 `moveTo`×577 `beginPath`×569 `stroke`×548
`=fillStyle`×256 `fillRect`×236 `fill`×21 `arc`×13 `ellipse`×8 `closePath`×5. Los 548 `stroke()`
son uno por celda de muro; el laberinto es **dato constante** (`MAPA`) y GLOTÓN tiene **una sola
paleta**, así que no había nada dinámico que justificara repintarlo 60 veces por segundo.

Qué se hizo, en `app/lib/games/pacman.ts`:

1. **Caché del laberinto** (`laberintoCacheado()`, en el closure de la factory): fondo + muros +
   puerta en un `document.createElement("canvas")` de 800×600, pintado una vez y copiado con un
   `drawImage`. Se suelta en `destroy()`. **No se invalida nunca dentro de una instancia** y eso es
   correcto aquí: no hay selector de aspecto (SPEC 18) y reponer el laberinto al pasar de nivel solo
   repone comestibles. El fondo entra en la caché a propósito, para que la copia sea **opaca** y
   cubra el fotograma anterior ella sola, exactamente igual que el `fillRect` que sustituye.
2. **Comestibles por lista precalculada** (`CELDAS_PUNTO` / `CELDAS_PILDORA`, derivadas de `MAPA` al
   cargar el módulo, como `COMESTIBLES_TOTALES`): 868 celdas visitadas por fotograma → 244, y el
   `fillStyle` sale del bucle, así que los **233 `fillStyle` idénticos** por fotograma pasan a 1.

**La trampa que casi cuesta un píxel, anotada porque se repetirá en cualquier motor que cachee:**
`drawLaberinto` dejaba `lineCap = "square"` **en el contexto principal**, y `drawFruta` traza el
tallo de la cereza sin fijar su propio `lineCap`. Al mover el laberinto a la caché, ese ajuste se
quedaba en el lienzo de la caché y el tallo pasaba a tener remates `butt`: 1 px menos por punta. Se
repone con un `ctx.lineCap = "square"` justo tras el `drawImage`. Al cachear, **lo que hay que mirar
no es solo qué se dibuja, sino qué estado del contexto dejaba puesto para los que venían detrás.**

**Verificación de píxeles, hecha de verdad y no por argumento** (script en el scratchpad, no en el
repo): las dos versiones del motor compiladas con `tsc`, montadas en la **misma página de Chromium**
con el mismo reloj manual, la misma semilla de `Math.random` y las mismas teclas, comparando
`getImageData` completo. **161 fotogramas, 0 bytes distintos** de 1,92 MB cada uno. En 104 de esos
161 fotogramas había cereza en pantalla —`FRUTA_EN` adelantada a `[2, 170]` en las **dos** copias
solo para la prueba—, así que el `lineCap` del tallo está cubierto por la comparación. Lo que **no**
cubrió: el modo `frightened` (nunca se comió una píldora en la corrida) y el «200» flotante; ninguno
de los dos pasa por el código que se tocó.

**Coste real de fotograma en Chromium, que el harness no puede ver** (mismo script, 600 fotogramas,
tres rondas alternando el orden, con un `getImageData(0,0,1,1)` por fotograma para forzar el
rasterizado): **p50 0,9 → 0,4 ms y p95 1,1-1,2 → 0,5-0,6 ms**. No es la quinta sonda —no hay React,
ni CSS del portal, ni compositor de página— pero demuestra que la mejora del contador se traduce en
tiempo real y no solo en llamadas.

Qué se midió y **no** se hizo:

- **Cachear también la capa de puntos.** Es lo único que queda grande: `fillRect`×233, 233 de las
  343 llamadas restantes. Se invalidaría en cada bocado (~8/s a 8 celdas/s), así que el cambio es
  barato de escribir. **No se aplica porque no se puede medir hoy**: cambia 233 `fillRect` de 3×3 px
  por un `drawImage` de 800×600, y quién gana eso solo lo dice la sonda 5. Además los puntos caen en
  coordenadas `.5` (`xDe(col) + 9 - 1.5`), así que esa capa tiene que ser **transparente** y pasaría
  los bordes antialiased por un buffer premultiplicado de 8 bits: un ±1 posible, justo lo que el
  laberinto evita por ser opaco. Si alguien la retoma, que mida antes.
- **Agrupar los 233 puntos en un solo path** (`beginPath` + 233 `rect` + 1 `fill`). En la sonda 1
  sale igual (235 vs 234), así que sin la sonda 5 no hay forma de saber si gana. Medido y aparcado.
- **`{ alpha: false }` en `getContext("2d")`.** Aquí **sí** sería válido —GLOTÓN arranca con un
  `fillRect(0,0,800,600)` opaco, no con `clearRect` como CAÍDA—, pero no se aplica: ninguna de las
  cuatro sondas deterministas lo ve, y en Chromium un canvas opaco puede activar antialiasing
  subpíxel en `fillText`, que cambiaría los píxeles del «200» flotante. Sin medida y con riesgo para
  la regla nº 2, se queda fuera.
- **Los arrays por fotograma**: `posicionDe` devuelve una tupla (5 por fotograma), `drawFantasma` y
  `drawFruta` iteran un `[-1, 1]` literal (5 por fotograma). **No se tocaron: no hay nada que
  arreglar.** La sonda 4 da **15 KB retenidos en 600 fotogramas** (25 bytes por fotograma), y esa
  misma sonda repetida en el mismo proceso devuelve −141, 177 y 393 KB: el ruido es un orden de
  magnitud mayor que lo que se podría ahorrar. V8 ya se come esas tuplas.
- **Las emisiones de callback ya estaban bien**: 7 en 600 fotogramas (todas de `onScore`, una por
  bocado). Los setters con deduplicación funcionan; no había nada que hacer.
- **El array literal de cuatro lados por celda de muro** (`pacman.ts`, dentro de `drawLaberinto`),
  que la sospecha nº 1 señalaba: sigue ahí tal cual **a propósito**. Ahora corre **una vez por
  instancia** en vez de 868 veces por fotograma, así que reescribirlo no ahorra nada medible y
  tocarlo solo añadiría riesgo al único sitio que define la forma de la pared.

**Presupuesto dejado en `tests/games/pacman.test.ts`**: `dibujoPorFrame: 440`,
`coloresPorFrame: 30`, `emisionesEn600: 20`, `heapKbEn600: 400`. Medido con las opciones por defecto
de la suite: 343 / 23 / 7 / 15 KB. Los tres primeros llevan ~25 % de holgura (el de dibujo cubre
además el peor fotograma teórico, ~393: laberinto lleno con 240 puntos, 4 píldoras encendidas,
cereza y aviso a la vez, que el calentamiento de 60 fotogramas no alcanza). El del heap va mucho
más arriba porque esa sonda es la ruidosa: acota una fuga de verdad, no el runner.

## RANARIA (`ranaria`) — 2026-09-11

**Medido antes** (sondas del harness, rana quieta en la orilla y los doce carriles llenos, que es el
régimen estable del motor): **951 llamadas de dibujo/frame**, **150 asignaciones de color/frame**,
**0 emisiones en 600 fotogramas**, **heap +114 KB/600f**. Desglose del fotograma:
`quadraticCurveTo×320 arcTo×116 =fillStyle×104 beginPath×79 fillRect×67 moveTo×66 fill×62 save×59
restore×59 arc×33 =shadowColor×31 =shadowBlur×31 stroke×29`.

**Las dos sospechas de la lista se confirmaron, y la del río era la gorda:**

- `frogger.ts:615-676` (`drawEscenario`) costaba **375 de las 951 llamadas (39 %)**, con **320
  `quadraticCurveTo`** de ocho ondulaciones idénticas y un `setLineDash([18, 14])` que creaba un
  array por fotograma. Ahora se pinta **una vez** en un canvas del closure (`fondoCacheado()`) y el
  fotograma paga **un `drawImage`**. No se invalida nunca durante un montaje: depende solo de la
  paleta, y cambiar de skin destruye y recrea el motor.
- Los **once `save()`/`restore()`** eran **118 llamadas/frame** (59 pares), 76 de ellas dos por
  vehículo. Quedan **uno** (el cuerpo de la rana, que tiene `translate()`/`scale()`). El estado
  compartido se pone **una vez por carril** y cada función sale con `shadowBlur = 0` y
  `globalAlpha = 1`.

**Después: 465 dibujo/frame (−51 %) y 103 colores/frame (−31 %)**, con el mismo desglose sin una sola
curva: `arcTo×116 =fillStyle×90 beginPath×69 fill×62 fillRect×61 drawImage×1 save×1 restore×1`.

**La clave de que no cambia un píxel**, y conviene que no se «arregle» por las buenas: no se restaura
`shadowColor`, solo se apaga `shadowBlur`. El estándar solo dibuja la sombra si `shadowColor` es
opaco **y además** el blur o alguno de los dos desplazamientos no es cero, así que un `shadowColor`
viejo con blur 0 no pinta nada — ni debajo de un relleno translúcido, que era el riesgo real (las
ventanillas al 55 %, el nenúfar `rgba(0,255,136,0.35)` y las vetas del tronco al 50 %).
**Comprobado en Chromium de verdad**, con `setContent` y sin servidor: la escena vieja
(`save()`/`restore()` por entidad) contra la nueva (`shadowColor` sucio + blur 0) y contra la copiada
con `drawImage` desde un canvas aparte → **0 de 1.920.000 subpíxeles distintos en las dos
comparaciones**.

**Descartado, con su cifra:**

- **Reagrupar el dibujo por capas** (todas las carrocerías, luego todas las ventanillas, luego todos
  los faros): ahorraría ~38 escrituras de `globalAlpha` y ~19 de `fillStyle` por fotograma, pero
  mueve los halos de `shadowBlur` 10 por debajo o por encima de lo que hoy les toca. El halo de un
  coche de la fila 7 llega a ~340 px y la ventanilla de la fila 6 acaba en 336: **4 px de margen**.
  No compensa jugarse la regla nº 2 por 57 escrituras de estado.
- **Cambiar `globalAlpha = 0.55` por `conAlfa(paleta.fondo, 0.55)`** en las ventanillas (ahorraría 38
  escrituras de estado por fotograma, y es equivalente exacto en composición): obliga a construir la
  cadena `rgba()` por carril y por fotograma, o a derivar un color que la ficha de skins no declara.
  Se deja; si alguien lo retoma, el sitio es `drawCarril`, rama de vehículos.
- **Bajar o quitar el `shadowBlur`**: vetado. Son 47 encendidos por fotograma (carrocerías,
  tortugas, nenúfares, mosca, barra de tiempo y la rana) y es lo más caro del motor en un navegador
  real, pero el halo es el aspecto del portal.
- **`{ alpha: false }` en `getContext("2d")`**: RANARIA **sí** podría llevarlo (abre con un
  `fillRect(0,0,W,H)` opaco, no con `clearRect` como CAÍDA). No se hizo porque el contexto lo pide el
  preámbulo de la factory y el canvas lo crea el reproductor: **el primer `getContext("2d")` gana**,
  y si alguna vez el reproductor lo pidiera antes, el atributo del motor se ignoraría en silencio. Sin
  la sonda 5 no hay forma de medir la ganancia, así que queda anotado y sin tocar.
- **Las emisiones de callback ya estaban bien**: **0 en 600 fotogramas**. Emite al avanzar de fila,
  al ocupar un nenúfar y al morir, nunca por fotograma.
- **La sonda de heap no resuelve este motor**: cinco pasadas seguidas dieron 191/208/466/205/192 KB y
  una por proceso 190/−3/191/56 KB. O sea, **no hay fuga** (aparece el 0) y la cifra de antes y
  después (114 → 140 KB) está dentro del ruido. Las allocations quitadas son reales pero por debajo
  de lo que la sonda ve: 3 arrays literales del escenario, el closure del `.find()` de `carrilDe()`,
  las dos cajas de colisión, el objeto `perp` de la rana y los `[-1, 1]` de los bucles simétricos.
  **No volver a medir el heap de RANARIA esperando una cifra limpia.**
- **Frame p95 diferido por concurrencia** (seis auditorías a la vez compartiendo `.next/` y el puerto
  3000). Qué esperar cuando se mida: es **la única sonda que ve lo que esta auditoría ha quitado de
  verdad** —118 `save()`/`restore()` y 8 polilíneas de 40 curvas trazadas con alfa a lo ancho de los
  800 px— y lo que no se puede quitar, los 47 `shadowBlur`. Fija el momento en el **segundo 3 con la
  rana quieta en la orilla** (el tablero ya está lleno de móviles y no depende del jugador) y, aparte,
  en el **nivel 2**, donde los carriles van 1,12× más rápidos pero el número de móviles es el mismo.

**Presupuesto dejado en `tests/games/frogger.test.ts`**: `dibujoPorFrame: 580`,
`coloresPorFrame: 130`, `emisionesEn600: 10`, `heapKbEn600: 500`. Medido con las opciones por defecto
de la suite: 465 / 103 / 0 / ≤191 KB. El techo de dibujo tiene ~25 % de holgura (las tortugas
sumergidas no se dibujan, así que el fotograma caro depende del ciclo) y el de emisiones está puesto
en 10 para delatar una emisión por fotograma, que serían 600.

## Nota de ROCAS (2026-09-11)

**ROCAS es el caso raro del catálogo: no hay nada que cachear y no hay ni un `shadowBlur`.** Todo lo
que pinta se mueve, rota o envuelve por los bordes, así que las dos técnicas que resolvieron los
otros cinco motores —canvas offscreen para lo estático, pagar el blur una sola vez— aquí no aplican.
Lo que había era **estado de contexto reasignado por entidad y basura por fotograma**, y eso es todo
lo que se podía quitar. Quien venga buscando un `drawImage` milagroso que no pierda el tiempo.

Medido en dos ventanas, porque el coste de ROCAS depende del jugador:

- **Ventana quieta** (la que usa la suite: 60 fotogramas de calentamiento, 20 medidos, sin teclas).
  Cuatro rocas y la nave: **80 → 67** llamadas de dibujo y **6 → 3** colores en el fotograma caro.
- **Partida en régimen** (nave acelerando y girando, un disparo cada 12 fotogramas, ~8 rocas y ~18
  partículas, 300 fotogramas de calentamiento): **174,9 → 149,9** llamadas de media (máximo 198 →
  173), **15,3 → 6,5** colores de media (máximo 21 → 12), **1803 → 1364 KB** de heap en 600
  fotogramas y **64 945 → 57 044** llamadas al contexto en 400 fotogramas (−12,2 %).
  Las dos corridas comparten semilla LCG, así que es el mismo escenario roca a roca.

**Cómo se demostró que no cambia ni un píxel, sin navegador.** Se extrajo el motor de HEAD
(`git show HEAD:app/lib/games/asteroids.ts`) al scratchpad y se corrieron las dos versiones en el
mismo proceso, con el mismo LCG y con `performance.now()` atado al reloj determinista, contra un
contexto que **resuelve la matriz a mano y apunta cada operación de pintado con sus coordenadas ya
en absolutas** más el estado que esa operación usa de verdad. Resultado: **7169 operaciones de
pintado en las dos, en el mismo orden, con geometría y estado relevante idénticos**. Las 2739 líneas
que difieren lo hacen **solo en `lineJoin`** y **solo en trazos de un único segmento** (las estelas
de las partículas: un `moveTo` y un `lineTo`), donde no existe unión que dibujar. El script está en
el scratchpad; si hay que repetirlo, lo que importa es comparar el estado **relevante por operación**
y no el vector entero: el `lineWidth` vigente al rellenar un círculo no pinta nada, y es justo lo que
esta optimización deja de reasignar.

**Lo medido y descartado, con su cifra:**

- **`Path2D` para la silueta de las rocas.** Es la ganancia grande que queda: **~110 `lineTo` por
  fotograma** (8-10 rocas × 8-13 vértices) que se volverían un `stroke(path)` por roca, con el path
  construido una vez en el constructor. **No se hizo porque `Path2D` no existe en jsdom**
  (`typeof Path2D === "undefined"`, comprobado): haría falta una rama de respaldo, la suite mediría
  **siempre la rama vieja** y el presupuesto del test no diría nada de lo que corre en producción.
  Candidato número uno si alguien automatiza la sonda 5 con rasterizado real.
- **`{ alpha: false }` en `getContext("2d")`.** ROCAS abre con un `fillRect(0,0,W,H)` opaco en los
  tres skins, así que sería seguro **hoy**. Dos razones para no tocarlo: la ganancia es de composición
  y **no la ve ninguna de las cuatro sondas deterministas**, y ataría el motor a que `fondo` siga
  siendo opaco, que es decisión de `skin-designer` y no mía.
- **La basura que queda (1364 KB / 600 fotogramas) es casi toda de `conAlfa()`**: ~18 partículas ×
  (un array de componentes + el `rgba()` nuevo) ≈ 2,3 KB por fotograma. Se puede cachear —el alfa
  solo toma 101 valores porque `conAlfa` lo redondea a dos decimales—, pero eso **mete el redondeo de
  `skins.ts` dentro del motor**: si `conAlfa` pasara a `toFixed(3)`, el motor pintaría colores
  distintos en silencio. `skins.ts` no es archivo mío. Se deja.
- **Fundir las balas en un solo path** (mismo `fillStyle`): **−4 llamadas por fotograma con dos
  balas, hasta −18 con triple disparo**. Descartado porque las tres balas del triple disparo nacen
  **en el mismo punto**: con un `bala` opaco el resultado es idéntico, pero si alguna vez lleva alfa,
  un único relleno de la unión y tres rellenos solapados **no** pintan lo mismo. Mismo motivo para no
  agrupar las partículas: cada una tiene su alfa y agruparlas cambiaría el orden de mezcla.
- **`Math.hypot` → `sqrt` de cuadrados en `dist()`**: el coste de JS medido (46-80 ms por 600
  fotogramas en jsdom, sin rasterizar) bajó ~20 % con el resto de los cambios, pero está **dentro del
  ruido de la medida** y ninguna de las cuatro sondas lo ve. `dist()` además está exportada y
  probada. Sin la sonda 5 no hay forma de justificarlo: se deja.
- **Las emisiones de callback ya estaban bien**: **30 en 1560 fotogramas** antes y después (tres del
  reinicio forzado más los cambios de puntuación y nivel de verdad). No hay nada que arreglar ahí.
- **El heap de la ventana quieta no sirve para nada**: 31 vs 40 KB en 600 fotogramas y 192 vs 405 KB
  en 1800, con el escenario cambiando de una corrida a otra porque la suite no fija `Math.random`. La
  cifra que vale es la del A/B con semilla (1803 → 1364 KB). **No volver a medir el heap de ROCAS sin
  sembrar el azar.**
- **Frame p95 diferido por concurrencia** (seis auditorías a la vez compartiendo `.next/` y el puerto
  3000). Qué esperar cuando se mida: ROCAS debería salir **el más barato de los seis** —es todo
  trazos finos, sin un solo `shadowBlur` y sin relleno grande más que el fondo—, así que el p95 estará
  dominado por el `fillRect` de 800×600 y por el rasterizado de ~10 polígonos. Lo que esta auditoría
  quitó que la sonda 5 sí ve son los **10 `save()`/`restore()` por fotograma** (copia completa del
  estado) y las ~38 invalidaciones de estado. Fija el momento en el **segundo 5 con ArrowUp mantenido
  y un disparo cada 12 fotogramas**, que es el guion con el que están tomadas todas las cifras de
  arriba: medir «al arrancar» no vale, porque en el segundo 1 hay cuatro rocas y ninguna partícula.

**Presupuesto dejado en `tests/games/asteroids.test.ts`**: `dibujoPorFrame: 110`,
`coloresPorFrame: 6`, `emisionesEn600: 8`, `heapKbEn600: 300`. Medido con las opciones por defecto de
la suite: 67 / 3 / 0 / ~40 KB. El techo de dibujo **no** es el medido + 25 %: cada roca se traza con
entre 8 y 13 vértices al azar y la suite no siembra `Math.random`, así que el peor caso posible de
esa ventana son ~91 llamadas y por debajo de eso la prueba sería intermitente. El que muerde de
verdad aquí es **`coloresPorFrame: 6`**: en la ventana quieta solo hay cuatro colores posibles porque
el color es del grupo y no de la entidad, así que volver a asignarlo por roca rompe la prueba al
instante.

## Sonda 5 medida en serie (2026-09-11)

La midió **quien orquestó las seis auditorías**, no los agentes: durante la sesión corrieron en
paralelo y les prohibí `npm run build`/`start`/`dev` y el puerto 3000, porque las seis comparten
`.next/`. Por eso las seis filas decían `pendiente (diferido por concurrencia)`; ahora llevan la
cifra. **Es solo el «después»**: reconstruir el árbol «antes» para comparar exige revertir los seis
motores, y eso quedó pendiente de decisión del usuario.

Condiciones: build de producción (`npm run build` + `npm start`), Chromium **headed con GPU real**
vía Playwright 1.62.1, viewport 1440×980, ventana de 8 s (6 s en BLOQUE BUSTER) tras 1,5 s de
asentamiento, **dos rondas** por juego. RANARIA y CAÍDA se midieron sin tocar teclas (su régimen
estable); los otros cuatro con una tecla cada 0,4-0,9 s para no morir dentro de la ventana.

Dos lecturas por juego, y hacen falta las dos:

- **Con vsync** — la condición real. Los **seis van clavados a 60 fps**: `dt` p50 16,7 ms en los
  seis y p95 entre 16,8 y 17,0, con 0-8 fotogramas por encima de 20 ms de ~600. Ninguno tiene
  tirones hoy en este equipo, así que esta lectura **no ordena los motores**: los empata.
- **Sin vsync** (`--disable-gpu-vsync --disable-frame-rate-limit`) — lo que revela la holgura.
  Ahí sí se separan: BLOQUE BUSTER 2,4 ms p50 (318 fps), GLOTÓN 2,6 (278), ROCAS 2,9 (266),
  SERPENTINA 4,0 (226), CAÍDA 5,6 (157) y RANARIA 7,3 (139). Sobre el presupuesto de 16,7 ms,
  RANARIA consume el **44 %** de un fotograma y BLOQUE BUSTER el **14 %**.

El callback de `requestAnimationFrame` (JS del motor + grabación de órdenes de canvas) es
**0,1-0,4 ms p50 y ≤0,6 ms p95 en los seis**: el trabajo de JavaScript ya no es el coste. Lo que
queda en el `dt` es rasterizado y composición.

**Dos medidas que probé y descarté, para que nadie las repita creyendo que faltan:**

1. **Chromium headless**: capa el rAF a ~30 fps (`dt` p50 33,3 y p95 50,0 **idénticos en los
   seis**). Mide el planificador del headless, no los motores. La sonda 5 **necesita headed**.
2. **`getImageData(0,0,1,1)` por fotograma para forzar el rasterizado**: bloquea esperando al GPU
   y capa los seis a ~70 fps, con un coste de 11-13 ms que es la espera del readback, no el
   rasterizado del motor (CAÍDA y GLOTÓN, que **no tienen ni un `shadowBlur`**, salían igual de
   «caros» que RANARIA, que tiene 15). Útil solo para comparar dos versiones del mismo motor en la
   misma página, que es como lo usó la auditoría de GLOTÓN.
