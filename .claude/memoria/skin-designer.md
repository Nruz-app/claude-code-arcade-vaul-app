# Memoria de skin-designer

Los dieciocho pares motor × skin de Arcade Vault, con lo que se decidió en cada uno y lo que
se midió. La escribe y la lee el subagente `skin-designer` (`.claude/agents/skin-designer.md`).

Son dieciocho y no veintiuno porque **GLOTÓN (`gloton`) no tiene ficha, y es a propósito**: la
SPEC 18 le dio un solo aspecto, el clásico, así que no está en `GAME_PALETAS` y el reproductor
no le enseña el selector. La razón está escrita en `app/lib/games/registry.ts`, encima del
mapa. No es una fila pendiente: es un motor que queda fuera de este sistema.

**Las filas no se borran ni se reescriben**: solo cambia la columna `Estado` y se rellenan las
medidas. Un histórico reescrito no es un histórico.

**`neon` está congelado.** Sus filas existen para registrar el ratio medido, no para
modificarlas: es el aspecto que el portal ha tenido siempre y la promesa del sistema es que
quien no elige nada lo siga viendo igual.

## Estados

- `pendiente` — el motor todavía declara sus colores a la vieja usanza, sin ficha de skins.
- `auditado` — se levantó el mapa de colores del motor pero aún no se implementó.
- `implementado` — la ficha existe, está registrada en `GAME_PALETAS` y `verificaSkins` pasa.
- `revisado` — se retocó después de un cambio del motor o de la paleta.

## Medidas

`Ratio mín.` es el peor contraste de esa paleta y `Rol más flojo` dice de cuál. Los mínimos
por clase están en `app/lib/games/skins.ts`: 4,5:1 texto, 3:1 jugable, 1,5:1 decorado, y 2:1
como **máximo** para las superficies.

| Fecha      | Motor         | Id              | Skin      | Estado         | Ratio mín. | Rol más flojo | Decisión / Razón                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ---------- | ------------- | --------------- | --------- | -------------- | ---------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-08-14 | ROCAS         | `rocas`         | `neon`    | `implementado` | 5,48:1     | `mejora`      | Motor piloto de la SPEC 13. Literales movidos sin tocar un valor. `COLORS.particle(alpha)` pasó a `conAlfa(paleta.particula, alpha)`, que produce la misma cadena.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 2026-08-14 | ROCAS         | `rocas`         | `retro`   | `implementado` | 5,93:1     | `roca`        | Ámbar `#ffb000`. La roca es el rol más oscuro de la rampa para separarse de la nave (2,43× de luminancia) sin caer por debajo del mínimo de lo jugable.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 2026-08-14 | ROCAS         | `rocas`         | `clasico` | `implementado` | 7,72:1     | `mejora`      | Vectorial monocromo blanco, como el Asteroids de Atari. La roca baja a gris `#b9b9b9` para separarse de la nave; la mejora toma el azul de Asteroids Deluxe (1981), porque el original no tenía power-ups.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 2026-08-14 | BLOQUE BUSTER | `bloque-buster` | `neon`    | `implementado` | 5,48:1     | `magenta`     | 13 roles. Literales movidos sin tocar un valor: `BLOCK_COLORS`×7 + `BG_COLOR`, `PADDLE_COLOR`, `BALL_COLOR`, `HIGHLIGHT` y `PADDLE_CORE`. El `shadowColor` de la pelota heredaba `PADDLE_COLOR`: ahora es el rol `haloPelota`, con el mismo literal. **Grupo reducido a cinco vetas**: `red`/`hotpink`/`magenta` no se separan en neón (14°, 19° y 21° de tono, <1,3× de luminancia) y neón está congelado; se puede reducir porque el color de veta no lleva información de juego (todos los bloques valen igual y caen de un golpe).                                                                                                                                                                                                                                                                                                                                                            |
| 2026-08-14 | BLOQUE BUSTER | `bloque-buster` | `retro`   | `implementado` | 3,13:1     | `magenta`     | Rampa ámbar (255,176,0) de siete pasos a 1,33× de luminancia cada uno, en el mismo orden de brillo que neón (yellow arriba, magenta abajo). Las siete vetas se separan, no solo las cinco del grupo. El paso más bajo queda a 3,13:1 sobre negro: es el suelo de la rampa, subirlo comprime los otros seis.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 2026-08-14 | BLOQUE BUSTER | `bloque-buster` | `clasico` | `implementado` | 3,75:1     | `magenta`     | Muralla de Taito (1986): plata, oro, rojo, azul, naranja, cian y verde, Vaus rojo y pelota blanca. **Dos desviaciones del original, las dos por contraste**: el azul sube de `#0000ff` (2,44:1 sobre negro, ilegible) a `#0058f8` (3,75:1), y la plata baja de un gris claro a acero `#8a8a8a` (6,08:1) porque con `#c0c0c0` no llegaba al salto de 1,3× contra cian (1,09×) ni contra verde (1,13×) — en el arcade esa separación la hacía el degradado del sprite, que aquí no existe.                                                                                                                                                                                                                                                                                                                                                                                                          |
| 2026-08-14 | SERPENTINA    | `serpentina`    | `neon`    | `implementado` | 2,48:1     | `brillo`      | Nueve roles, claves en español: se conservan como están. Literales movidos sin tocar un valor; `COLORS` era un solo bloque completo y no hubo ninguna fuga que cerrar. **`rejilla` se declara `superficie` y no `decorado`**: `rgba(0,255,136,0.06)` da 1,07:1 y como decorado reprobaría el aspecto histórico — es fondo, no elemento. **La cabeza queda fuera del grupo**: en neón es el mismo verde aclarado del cuerpo (1,09× de luminancia, 0,8° de tono) y eso está congelado; se lee por posición y por los ojos.                                                                                                                                                                                                                                                                                                                                                                          |
| 2026-08-14 | SERPENTINA    | `serpentina`    | `retro`   | `implementado` | 2,11:1     | `brillo`      | Ámbar `#ffb000`. `/snake-fruits.png` tiene el color horneado: fuera de `neon` el motor **no pide la imagen** y se queda en el rombo vectorial que ya existía como fallback (SPEC 13), que es lo único que hace alcanzables los tres colores de rareza. Rampa de cinco pasos a ≥1,44×: común 3,75 < cuerpo 5,93 < cabeza 8,53 < rara 12,93 < exótica 19,05. La fruta común es el paso más bajo a propósito — sale el 65 % de las veces.                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 2026-08-14 | SERPENTINA    | `serpentina`    | `clasico` | `implementado` | 1,94:1     | `brillo`      | Fósforo verde DMG/Nokia: cabeza `#9bbc0f` (9,59:1) y ojo `#0f380f`, el tono más apagado de la Game Boy. **Rampa invertida respecto al original**: allí el verde era el FONDO y los píxeles se apagaban; aquí el portal es siempre oscuro, así que el verde de pantalla lo lleva la serpiente. Fruta rara `#c0d567` y exótica `#f1f6df` se salen de los cuatro tonos DMG porque con solo ellos no cabe una rampa de cinco pasos a 1,3× (`#8bac0f` vs `#9bbc0f` = 1,20×).                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 2026-08-14 | CAÍDA         | `caida`         | `neon`    | `implementado` | 1,51:1     | `borde`       | 14 roles. Era el más invasivo y salió tal cual: se fusionaron los dos bloques (`COLORS`×8 + `GRID_COLOR` arriba; `WELL_BG`, `WELL_BORDER`, `LABEL_COLOR` y `VALUE_COLOR` 300 líneas más abajo) y se cerró la fuga — el `rgba(255,255,255,0.12)` escrito a mano dentro de `drawCell`, único literal del proyecto suelto en una función de dibujo, es ahora el rol `brillo`. Literales movidos sin tocar un valor; el tipo de celda (1..8) indexa `ROL_DE_PIEZA` y el color se resuelve al dibujar. **`rejilla` (1,16:1) y `brillo` (1,37:1) se declaran `superficie` y no `decorado`**: son textura, y como decorado reprobarían el aspecto histórico. **La tuerca queda fuera del grupo**: gris `#9aa0b5`, saturación 0,15 (<0,40) y 1,19× de luminancia contra la Z — es el neón congelado el que no separa el par. Su silueta 3×3 con centro hueco ya la delata. Peor jugable: `piezaL` 4,88:1. |
| 2026-08-14 | CAÍDA         | `caida`         | `retro`   | `implementado` | 1,95:1     | `borde`       | Ámbar `#ffb000` sobre pozo `#120c00` — en un monitor de fósforo hasta el negro tira al color del tubo. Rampa de siete pasos a ~1,33× de luminancia cada uno, de 3,16:1 (`piezaL`) a 17,41:1 (`piezaI`); caben porque 3 × 1,3⁶ ≈ 14,5 < 21. Las siete clásicas se separan par a par sin tocar el umbral. La tuerca va a `#a08a5e` (5,83:1), ámbar sucio fuera de la rampa, y sigue fuera del grupo (choca con la S y con la Z). Peor jugable: `piezaL` 3,16:1, que es el suelo de la rampa — subirlo comprime los otros seis.                                                                                                                                                                                                                                                                                                                                                                      |
| 2026-08-14 | CAÍDA         | `caida`         | `clasico` | `implementado` | 3,65:1     | `borde`       | Los siete colores con los que se juega a Tetris desde el arcade —cian, amarillo, púrpura, verde, rojo, azul y naranja— sobre pozo `#0d0d0d`, más el gris `#a0a0a0` de la tuerca. **Dos desviaciones del original, las dos por contraste, medidas sobre el pozo: la J `#0000ff` da 2,20:1 y la T `#800080` también 2,20:1** (no 2,4 y 2,2 como se anotó de oído antes de medir). Suben a `#5c78ff` (5,17:1, tono 231°) y `#c14fd8` (4,98:1, tono 291°): se les sube la luminancia conservando el tono, que es la concesión mínima para que sigan siendo el azul y el púrpura de siempre. Peor jugable: `piezaZ` 4,86:1, que es el rojo `#ff0000` intacto.                                                                                                                                                                                                                                          |
| 2026-08-14 | RANARIA       | `ranaria`       | `neon`    | `pendiente`    | —          | —             | Veintiséis roles, el más caro. Los cinco literales crudos de `CARRILES` tienen que pasar a nombres de rol, o un skin no los alcanza.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 2026-08-14 | RANARIA       | `ranaria`       | `retro`   | `pendiente`    | —          | —             | Los grupos se declaran **por banda** (río y carretera), no globalmente: troncos y coches nunca comparten franja, así que no compiten.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 2026-08-14 | RANARIA       | `ranaria`       | `clasico` | `pendiente`    | —          | —             | Rana lima, agua azul, troncos marrones y coches en blanco/amarillo/púrpura/azul. Ojo con el azul del agua: cabe como `superficie` pero está cerca del máximo.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 2026-09-12 | INVASORES     | `invasores`     | `neon`    | `implementado` | 3,51:1     | `suelo`       | Diez roles. **Nació con ficha** (SPEC 21): no hubo literales que mover ni fuga que cerrar — las diez asignaciones de `fillStyle` del motor salen todas de la paleta y no hay `shadowColor`, `strokeStyle`, `globalAlpha`, gradiente ni patrón en todo el archivo. Auditado sin tocar un valor. **No le toca fila en la tabla «de oro»** de `tests/games/skins.test.ts`, que guarda literales _anteriores_ a la SPEC 13: aquí no hay «antes», igual que en RANARIA. **Un solo rol para los tres tipos de invasor**, que es lo que hace declarable un `clasico` monocromo. `canon` y `balaJugador` comparten literal (`#00f5ff`) a propósito. Peor jugable: `nodriza` 5,48:1.                                                                                                                                                                                                                       |
| 2026-09-12 | INVASORES     | `invasores`     | `retro`   | `revisado`     | 2,85:1     | `suelo`       | Ámbar del portal, tono 30–46° (la casa va de 2° en BLOQUE BUSTER a 21° en ROCAS: cabe, es un tono). Vocabulario compartido con los `retro` ya cerrados: `#ffcf70` es la nave de ROCAS, `#c07800` su roca, `#ffb000` la base y `#ff8c1a` su mejora. **Una corrección**: `explosion` sube de `#ffe9a8` (17,47:1) a `#fff3d7` (19,05:1). La explosión sustituye al cañón en la misma posición y con la misma huella (las dos siluetas son 13×8 y `draw()` pinta una o la otra), así que el color es la mitad del aviso de «te han dado»; en neón lo da un salto de tono de 137° (cian → oro) y aquí, con un solo tono, tiene que darlo la luminancia — y 1,21× sobre el cañón queda por debajo del 1,3× que la casa exige. Ahora 1,32×. Peor jugable: `escudo` 5,93:1.                                                                                                                               |
| 2026-09-12 | INVASORES     | `invasores`     | `clasico` | `revisado`     | 3,54:1     | `suelo`       | El gabinete del 78: tubo monocromo blanco y dos tiras de celofán, verde abajo (cañón, escudo, suelo, explosión) y roja arriba (nodriza). **Una corrección**: `puntosNodriza` pasa de `#ffffff` a `#ff2222` (5,50:1, sobre el mínimo 4,5 de texto). El número flota en la posición exacta de la nodriza (`Y_NODRIZA + ALTO_NODRIZA / 2`), o sea dentro de la tira roja; en blanco era el único rol que se salía de su propia banda. Comparte literal con `nodriza` sin coste: al crear el número el motor hace `nodriza = null`. **Desviación del original, por distinguibilidad y no por contraste**: `balaInvasor` es `#bfbfbf` (11,42:1) y no el blanco del tubo, porque `balaJugador`/`balaInvasor` son dos rectángulos de 3×9 idénticos y en el arcade los separaba la animación de tres fotogramas de la bala enemiga, que aquí no existe (quedan a 1,84×). Peor jugable: `nodriza` 5,50:1.  |

## Orden recomendado

`bloque-buster` → `serpentina` → `caida` → `ranaria`, de más limpio a más sucio. Va así a
propósito: cuando le toque a RANARIA, que es el pantano, el patrón estará validado cuatro
veces y su cambio de tipo (`CarrilDef.color` de `string` a rol) lo apoyará el compilador —
cada sitio que rompa es un sitio que había que tocar.

## Notas de sesión

**2026-08-14** — Sesión de arranque. Se montó la infraestructura completa (`skins.ts`, el
tercer parámetro de `GameFactory`, el harness de contraste y de skins, el selector del
overlay) y se cerró ROCAS como piloto, para que el patrón exista antes de que el agente lo
copie. Los otros cuatro motores quedan para `skin-designer`, uno por invocación.

Dos cosas que se decidieron aquí y que no hay que volver a discutir: **`retro` es ámbar**, no
verde fósforo (el verde ya es el acento de SERPENTINA y RANARIA en el catálogo y es el
`clasico` de SERPENTINA); y **la bala de ROCAS queda fuera del grupo de distinguibilidad**,
porque en el arcade original es del mismo blanco que la nave y se distingue por tamaño y
movimiento — meterla en el grupo habría hecho imposible el skin clásico sin que nadie viese
mejor.

**2026-08-14** — BLOQUE BUSTER cerrado. Tres cosas que valen para los motores que quedan:

1. **El grupo se mide primero en neón, antes de diseñar nada.** Aquí las siete vetas no
   pasaban en neón (`red`/`hotpink`/`magenta` son el mismo rojo-rosa) y neón no se toca, así
   que el grupo se redujo a cinco con la razón escrita en la ficha. La plantilla de la
   auditoría debería llevar esta medida: si el propio neón no separa un grupo, el grupo está
   mal declarado, no el skin nuevo.
2. **Los overlays translúcidos son `superficie`, no `decorado`.** `filoBarra`
   (`rgba(255,255,255,0.35)` sobre la barra) y `relieve` (`rgba(255,255,255,0.14)` sobre el
   bloque) dan 1,06:1 los dos en neón: como `decorado` (mín. 1,5:1) reprobarían el aspecto
   histórico. No son elementos que haya que ver, son modulaciones de lo que tienen debajo, y
   lo que hay que garantizar es que **no lo tapen** — que es justo lo que mide un máximo.
   CAÍDA y RANARIA tienen overlays parecidos.
3. **Un `shadowColor` prestado es un rol que falta.** La pelota se dibujaba con el
   `shadowColor` de la barra; sin separarlo, ningún skin podía darle un halo propio. En neón
   los dos valores siguen siendo el mismo literal, así que la cero-regresión no se entera.

**2026-08-14** — SERPENTINA cerrado. Fue el motor más limpio de los tres hechos hasta hoy: su
`COLORS` ya era un bloque único y completo, sin literales sueltos en las funciones de dibujo
ni colores dentro de tablas de datos, así que la ficha salió de mover nueve valores y añadir
un argumento `paleta` a cuatro funciones. Dos cosas que valen para CAÍDA y RANARIA:

1. **Un asset con el color horneado se resuelve apagando el asset, no tiñéndolo.** El PNG de
   frutas solo se pide cuando `skin === "neon"`; en las otras dos skins `sprite` es `null` y
   el dibujo cae en el rombo vectorial que ya existía como fallback del PNG que tarda. No hay
   rama nueva que probar —era la única que jsdom ejercitaba— y los tres colores de rareza,
   que antes solo se veían durante la carga, pasan a ser el aspecto normal fuera de neón.
   RANARIA no tiene assets, así que esto se queda sin usar; conviene que siga así.
2. **En un skin monocromo, el orden de la rampa es una decisión de diseño, no un residuo del
   neón.** Aquí las frutas no heredaron su brillo relativo de neón: se ordenaron por rareza
   (común 3,75 → exótica 19,05) con la serpiente en medio, porque la rareza es información de
   juego y el tono no puede transmitirla cuando solo hay uno. En neón esa jerarquía la
   llevaban tres tonos distintos (amarillo, magenta, cian) y el brillo no significaba nada.

**2026-08-14** — CAÍDA cerrado. Era el motor con la paleta más repartida y confirmó las tres
lecciones anteriores sin excepciones: el grupo lo rompía el propio neón (la tuerca), los dos
overlays van como `superficie` y la rampa de retro se ordena por diseño. Tres cosas nuevas,
para RANARIA:

1. **Un literal dentro de una función de dibujo es un rol sin nombre.** El realce de relieve
   de cada celda (`rgba(255,255,255,0.12)` dentro de `drawCell`) era el único del proyecto y
   nadie lo habría encontrado leyendo la sección de constantes: se busca por
   `fillStyle`/`strokeStyle`/`shadowColor` y no por dónde están declaradas las constantes.
   Como rol `brillo` conserva el literal en neón, así que la cero-regresión no se entera.
2. **La superficie de referencia no tiene por qué ser lo que el canvas limpia.** CAÍDA hace
   `clearRect` y nunca pinta un fondo —el hueco alrededor del pozo deja ver el marco CRT—, así
   que el rol de clase `superficie` es el **pozo**, que es el fondo del área de juego. El
   panel lateral se pinta en realidad sobre `--bg` (`#0a0a0f`), más oscuro que el pozo, o sea
   que medirlo contra el pozo aprueba de menos y nunca de más.
3. **Ocho pasos monocromos caben, pero solo si uno se sale del grupo.** Siete escalones a
   ~1,33× ocupan de 3,16:1 a 17,41:1 y dejan casi todo el rango físico consumido; el octavo no
   entra. Que el que sobra sea justo la pieza reconocible por su silueta no es suerte: es la
   razón por la que se puede sacar sin que nadie vea peor.

**2026-09-12** — INVASORES cerrado. **Primer motor que llega aquí ya con sus tres paletas
escritas y registradas**: la SPEC 21 lo implementó con ficha, así que esta invocación no fue
un reskineado sino una auditoría. Cambia el trabajo, y conviene saberlo para los que vengan
igual:

1. **Cuando no hay literales que mover, el veto de neón se cumple solo y lo que queda es el de
   coherencia de época.** No hubo fugas que cerrar (diez `fillStyle`, todos desde la paleta,
   ningún `shadowColor` ni gradiente), así que la auditoría se fue entera a preguntar si cada
   skin cumple _su propia premisa_, que es lo que ningún umbral mide. Las dos correcciones
   salieron de ahí y ninguna de un test en rojo: `verificaSkins` ya pasaba antes de tocar nada.
2. **Un rol que aparece dentro de una banda tiene que llevar el color de esa banda.** En un
   `clasico` de celofán la premisa es geométrica, no cromática: el número de puntos de la
   nodriza se pinta en la posición de la nodriza, o sea en la tira roja, y estaba en blanco. Es
   el mismo tipo de fallo que un literal suelto en una función de dibujo, pero no lo encuentra
   ningún grep — hay que cruzar cada rol con las coordenadas en las que se dibuja.
3. **Un cambio de sprite en el sitio es un par que hay que medir aunque no esté en ningún
   grupo.** La explosión sustituye al cañón en la misma posición y con la misma huella, así que
   compite consigo misma en el tiempo: el jugador no compara dos cosas en pantalla, compara el
   fotograma de antes con el de después. En neón ese aviso lo da un salto de tono; en un skin
   monocromo tiene que darlo la luminancia o no lo da nadie. `verificaSkins` no lo ve porque
   solo mide los grupos declarados y el contraste contra el fondo. **Vale para todo motor con
   estados de muerte, vidas o power-ups**: si dos roles nunca coexisten pero uno reemplaza al
   otro en el sitio, mídelos igual.
4. **Y la excepción de la misma regla**: en `clasico` la explosión se queda a 1,05× del cañón
   a propósito. En el gabinete los dos eran el mismo blanco bajo el mismo celofán verde y los
   separaba la silueta; subirla exigiría ≥20,4:1, que bajo celofán verde no existe sin pintar
   blanco y romper la premisa. Es la misma concesión que la tuerca de CAÍDA, al revés: allí el
   neón congelado impedía separar un par, aquí lo impide la física del gabinete.

Dos cosas que quedaron fuera y que **no son olvidos**: las tres filas de RANARIA siguen en
`pendiente` —no tocaban en esta invocación— y INVASORES no tiene fila en la tabla «de oro» de
`tests/games/skins.test.ts`, por la misma razón que RANARIA: esa tabla guarda literales
anteriores a la SPEC 13 y aquí no hay «antes» que copiar.
