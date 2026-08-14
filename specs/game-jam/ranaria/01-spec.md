# RANARIA — spec

> Ver `00-resumen.md` para el tema y la ficha, y `02-motor.md` para el modelo de datos.

> **Estado:** Borrador
> **Depende de:** SPEC 05, SPEC 06
> **Fecha:** 2026-08-13
> **Objetivo:** Escribir desde cero un motor de Frogger en TypeScript sobre canvas, con carretera, río, tortugas que se sumergen y progresión infinita, y registrarlo como el juego `ranaria` sin tocar el reproductor, el contrato ni Supabase.

---

## Por qué existe esta spec

El tema de la jam es **"la ranita"**, y la rana ya tiene sitio reservado en el portal:
`GAMES` incluye `ranaria` desde la SPEC 01 —_"RANARIA · Cruza la autopista de pixeles"_,
categoría `ARCADE`, acento verde, portada `cover-rana`, `best` mock de 18.900— pero hoy es
uno de los cuatro juegos que caen en el reproductor simulado, ese `setInterval` que sube un
número solo. Esta spec lo convierte en el quinto juego real, tras ROCAS, CAÍDA, BLOQUE
BUSTER y SERPENTINA.

Llena además un hueco de género. Los cuatro motores que hay son: un shooter en gravedad cero
(ROCAS), un puzzle de rejilla (CAÍDA), un rebote de física continua (BLOQUE BUSTER) y una
serpiente por pasos discretos (SERPENTINA). RANARIA es el primero de **esquiva**: no
disparas, no encajas y no creces, solo lees patrones de tráfico y eliges el momento. Es
también el primero que mezcla las dos formas de movimiento del portal — la rana salta por
celdas discretas, pero los coches y los troncos se mueven en píxeles continuos, y la rana
arrastrada por un tronco deja de estar alineada con la rejilla.

Como SERPENTINA, **no hay código de referencia**: `references/templates/started-games/` solo
tenía tres juegos y los tres están portados. El motor se escribe entero y las mecánicas son
las que fija esta spec. A diferencia de SERPENTINA, aquí **no hay sprites**: no se puede
generar un PNG en una jam sin supervisión, así que la rana, los coches, los troncos y las
tortugas se dibujan con primitivas del canvas, como hace BLOQUE BUSTER.

Hay una decisión de fondo que condiciona todo el diseño: **el Frogger original se gana**
—cinco ranas en casa y fin—, y `GameOverReason` solo admite `"game_over" | "surrender"`.
Igual que en BLOQUE BUSTER, llenar los cinco nenúfares no termina la partida: sube el nivel,
vacía los nenúfares y acelera los carriles, indefinidamente y con tope de velocidad.

---

## Alcance

**Dentro:**

- **Motor de Frogger** en `app/lib/games/frogger.ts`, cumpliendo `GameFactory` sin cambios
  en el contrato.
- **Tablero de 16×12 celdas de 50 px**, que llena exactamente el canvas de 800×600: fila de
  meta con cinco nenúfares, cuatro carriles de río, una mediana segura, cinco carriles de
  carretera y la orilla de salida.
- **Nueve carriles guiados por una tabla de datos** (`CARRILES`): tipo, dirección, velocidad
  base, largo del móvil y hueco entre móviles. Añadir o retocar un carril es editar una fila
  de la tabla, no escribir código.
- **Tres tipos de móvil**: coches y camiones (mortales al contacto), troncos (plataforma) y
  tortugas (plataforma que **se sumerge** en ciclo, con parpadeo de aviso).
- **Salto por celdas** con las flechas y con WASD, interpolado visualmente para que se lea el
  movimiento, pero **resuelto lógicamente al instante** en la celda de destino.
- **Arrastre**: sobre un tronco o una tortuga la rana avanza con la plataforma y queda
  desalineada de la rejilla; si la plataforma la saca del canvas, muere.
- **Cinco muertes distintas**: atropello, ahogo, arrastre fuera de pantalla, aterrizaje en la
  fila de meta fuera de un nenúfar libre y agotar el temporizador del intento.
- **Tres vidas reales**, emitidas por `onLives` (3 → 2 → 1 → 0), como ROCAS y BLOQUE BUSTER.
- **Temporizador por intento**, dibujado como una barra fina en el borde inferior del canvas,
  que se acorta con el nivel y que también da bonus de puntos al llegar a un nenúfar.
- **Mosca de bonus** que aparece de vez en cuando sobre un nenúfar libre y caduca sola.
- **Progresión infinita**: llenar los cinco nenúfares sube el nivel, vacía la meta, acorta el
  temporizador y multiplica la velocidad de todos los carriles, con **tope**.
- **Puntuación calibrada** para convivir en el Salón de la Fama con los otros cuatro juegos
  (ver la justificación numérica en `02-motor.md`).
- **Registro** en `app/lib/games/registry.ts`: una línea en `GAME_ENGINES` y otra en
  `GAME_CONTROLS`.

**Fuera de alcance (para specs futuras):**

- **Los otros tres juegos simulados.** `gloton`, `invasores` y `duelo-pixel` siguen con el
  reproductor simulado.
- **Tocar el reproductor** (`app/juego/[id]/jugar/page.tsx`). Si hiciera falta, es señal de
  que el motor está haciendo algo que no le toca.
- **Tocar el contrato** (`app/lib/games/types.ts`). Estable desde la SPEC 06.
- **Tocar `app/lib/data.ts`.** La entrada `ranaria` y su portada `cover-rana` ya existen.
- **Migraciones de Supabase.** `game_id` es texto libre y `/salon` saca sus pestañas de
  `GAMES`: RANARIA aparece en su ranking sin tocar la base.
- **El top 10 del detalle `/juego/ranaria`.** Sigue con `seededScores`, como el resto. Es
  deuda declarada de la SPEC 07.
- **El campo `best` de `GAMES`** (hoy `18900` para `ranaria`). Sigue siendo el número mock.
- **Assets nuevos en `public/`.** Ni PNG ni MP3: todo se dibuja con el canvas.
- **Sonido**, coherente con lo que decidieron las SPEC 08, 09 y 10.
- **Controles táctiles.** En móvil se monta pero no se puede jugar; el aviso de teclado que
  ya existe cubre el caso.
- **Nuevas clases CSS.** El reproductor y `.game-canvas` ya existen desde la SPEC 05.
- **El cocodrilo, la serpiente y la rana hembra** del Frogger de recreativa. Son tres
  entidades más con sus reglas, y el presupuesto de la jam es un motor de 400–800 líneas.
- **Tests automatizados** (sigue sin haber runner configurado).
