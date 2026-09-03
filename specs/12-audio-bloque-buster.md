# SPEC 12 — Sonido en BLOQUE BUSTER: el rebote y el ladrillo

> **Estado:** Implementado
> **Depende de:** SPEC 09, SPEC 11
> **Fecha:** 2026-08-13
> **Objetivo:** Dar sonido a las dos acciones que definen BLOQUE BUSTER —rebotar y romper un bloque— reproduciendo desde el motor los dos efectos de `references/mp3/` una vez ajustados a `public/`, reusando `crearSfx()` tal cual y sin tocar el reproductor, el contrato `GameHandle`, el helper de audio ni Supabase.

---

## Por qué existe esta spec

La SPEC 11 puso sonido en RANARIA y dejó escrito el helper (`app/lib/games/audio.ts`)
declarando que quedaba "para cuando haya muestras" de los otros motores. Ya las hay: los dos
mp3 de Arkanoid que estaban sueltos en `references/mp3/`.

Esta spec es, sobre todo, **la prueba de que la costura de la 11 aguanta**. Si añadir sonido a
un segundo motor obliga a tocar `audio.ts`, el helper no era la abstracción correcta. El
criterio de aceptación más importante de este documento es que `app/lib/games/audio.ts` no se
modifique ni una línea.

BLOQUE BUSTER es además el juego del catálogo que más nota la falta. Es física continua: la
pelota está permanentemente chocando con algo, y hoy un impacto contra la paleta y uno contra
el muro son indistinguibles salvo por lo que se ve. Con sonido, el jugador se entera de un
golpe que ocurre fuera de donde está mirando —que es siempre, porque mira la paleta— y el
derribo de la muralla pasa a tener recompensa audible.

La SPEC 09 dejó el sonido explícitamente fuera de alcance ("los dos `.mp3` de la referencia no
se copian"), con el argumento de que meterlo entonces abría el tema del volumen y del autoplay
para todo el portal. Ese tema lo cerró la SPEC 11: los efectos los dispara el motor, el volumen
son constantes del motor, y el gesto previo lo garantiza el overlay de ESPACIO. Esta spec
revoca aquella exclusión sobre esa base, no por capricho.

---

## Los efectos, medidos

Cabeceras de trama de los dos originales, y medidas sobre el PCM decodificado (envolvente en
ventanas de 20 ms):

| Medida               | `arkanoid-ball-bounce.mp3` | `arkanoid-break-sound.mp3` |
| -------------------- | -------------------------- | -------------------------- |
| Duración (cabecera)  | 0,672 s                    | 0,552 s                    |
| Duración (PCM)       | 0,610 s                    | 0,485 s                    |
| Formato              | VBR 64–128 kbps            | VBR 64–128 kbps            |
| Muestreo             | 48 kHz                     | 48 kHz                     |
| Canales              | estéreo / joint stereo     | estéreo / joint stereo     |
| Peso                 | 10,6 KB                    | 8,7 KB                     |
| Cabecera VBR         | `Info` (LAME)              | `Info` (LAME)              |
| **Pico**             | −0,33 dBFS                 | **+1,33 dBFS**             |
| RMS                  | −23,7 dBFS                 | −17,6 dBFS                 |
| **Silencio inicial** | **0,183 s**                | **0,099 s**                |
| Sonido útil          | de 0,18 s a 0,44 s         | de 0,10 s al final         |
| Correlación L/R      | +0,998 (casi mono)         | +0,727                     |

La medición desmiente lo que este documento suponía cuando se escribió, y conviene dejarlo
anotado porque cambia el porqué del paso 1:

1. **El rebote sí llegaba tarde**, no tanto como el salto de la rana pero lo bastante: **183 ms
   de silencio** por delante, once fotogramas a 60 fps. Un golpe que suena once fotogramas
   después del impacto no se lee como el impacto. Es el mismo defecto de la SPEC 11 a un tercio
   de escala, no un defecto ausente.
2. **El ladrillo venía recortado, y peor que el choque de la rana**: **+1,33 dBFS**, frente a
   los +0,7 de `rana-choque.mp3`. El navegador satura esas muestras y el golpe suena a
   distorsión sucia.
3. **El ladrillo no era casi-mono** (correlación +0,727, frente al +0,998 del rebote). La
   decisión de pasarlo a mono se sostiene igual —se justificó en que el juego no tiene panorama
   espacial, no en que la muestra ya lo fuera—, pero había que comprobar que la suma no
   cancelara nada: la pérdida medida es de **−0,64 dB** de RMS, que la normalización devuelve.

Además, el ladrillo **termina cortado en seco**: su última ventana está a −11 dBFS, o sea que
el archivo se acaba con el sonido a pleno nivel. Sin fundido de salida eso es un clic.

### Lo que se les hace

Misma división de papeles que en la SPEC 11: **los originales se quedan intactos en
`references/mp3/`** y lo ajustado se escribe en `public/`.

| Paso                    | `bloque-rebote.mp3`                        | `bloque-romper.mp3`                         |
| ----------------------- | ------------------------------------------ | ------------------------------------------- |
| Mezcla                  | mono                                       | mono (−0,64 dB de cancelación)              |
| Recorte de entrada      | **183 ms** (ataque −40 dBFS, menos 5 ms)   | **99 ms** (ídem)                            |
| Recorte de cola         | **188 ms** (última muestra sobre −50 dBFS) | ninguno: sigue sonando al acabar el archivo |
| Fundido de salida       | 40 ms                                      | 60 ms                                       |
| Normalización a −1 dBFS | ganancia **×0,929** (−0,64 dB)             | ganancia **×0,800** (−1,94 dB)              |
| Reencode                | 44,1 kHz, 96 kbps CBR                      | 44,1 kHz, 96 kbps CBR                       |
| **Resultado**           | **0,240 s · 3,7 KB**                       | **0,386 s · 5,2 KB**                        |

Tres de esos pasos merecen justificación, porque no son cosméticos:

1. **Mismo pico (−1 dBFS) en las dos muestras.** Es lo que deja la mezcla entre rebote y
   ladrillo en dos constantes del motor. Con las muestras a niveles distintos, equilibrarlas
   obliga a reeditar audio cada vez.
2. **CBR en vez de VBR.** Los dos originales llevan cabecera `Info` de LAME y bitrate variable
   entre 64 y 128 kbps. `new Audio()` reproduce VBR sin problema, pero la búsqueda —que es
   exactamente lo que hace `currentTime = 0` en cada disparo, y aquí se dispara varias veces
   por segundo— depende de una tabla de índices que no todos los navegadores usan igual. Con
   CBR el desplazamiento es aritmética.
3. **44,1 kHz y no 48.** Es lo que ya sirve el portal (los dos efectos de RANARIA) y evita que
   el navegador reamuestree en tiempo real dos veces por segundo. Los de RANARIA no se tocan.

−1 dBFS y no 0 por lo mismo que en la SPEC 11: deja margen para el sobreimpulso que introduce
el propio codificador mp3 al reconstruir la onda.

### El resultado, medido

Sobre el mp3 ya encodeado y vuelto a decodificar, que es lo único que cuenta:

| Comprobación | `bloque-rebote.mp3`       | `bloque-romper.mp3`       |
| ------------ | ------------------------- | ------------------------- |
| Ataque       | 0,000 s                   | 0,000 s                   |
| Pico         | −1,25 dBFS                | −1,35 dBFS                |
| Duración     | 0,240 s                   | 0,386 s                   |
| Formato      | mono 44,1 kHz 96 kbps CBR | mono 44,1 kHz 96 kbps CBR |
| Peso         | 3,7 KB                    | 5,2 KB                    |

De 19,3 KB a 8,9 KB, con el rebote respondiendo en el instante del golpe y el ladrillo sin
saturar. Los dos picos quedan a 0,1 dB uno del otro: el reparto entre ellos lo decide una
constante del motor y no el azar de cómo se grabó cada uno. El margen de −1 dBFS resultó
suficiente: el codificador no se pasó de fondo de escala en ninguno de los dos.

Los ~26 ms de retardo de codificador que mete LAME **no aparecen al reproducir**: la cabecera
`Info` los declara y el decodificador los descuenta, que es por lo que el ataque medido cae en
0,000 s en los dos. Es una mejora respecto a lo que asumía la SPEC 11.

Los ~26 ms de silencio de codificador que mete LAME se aceptan, igual que en la 11. Aquí
importa un poco más —el rebote debe leerse como simultáneo al golpe— pero siguen siendo un
fotograma y medio a 60 fps, por debajo del umbral en el que se percibe desincronía.

---

## Alcance

**Dentro:**

- **Los dos efectos ajustados en `public/`**: `public/bloque-rebote.mp3` y
  `public/bloque-romper.mp3`, referenciados como `/bloque-rebote.mp3` y `/bloque-romper.mp3`.
- **Sonido de rebote** en BLOQUE BUSTER, disparado al golpear **la paleta y los tres muros**.
- **Sonido de ladrillo**, disparado al **destruir un bloque**, y solo eso: un impacto contra un
  bloque **no** dispara además el de rebote.
- **Un campo nuevo en `StepOutcome`** (`bounced`), que es cómo la función pura `stepBall()` le
  cuenta al motor que hubo rebote sin saber nada de audio.
- **Como mucho un disparo de cada efecto por fotograma**, aunque en ese fotograma haya varios
  rebotes o varios bloques rotos.
- **Silencio al pausar y al destruir**: `pause()` corta lo que suene, `destroy()` suelta los dos
  elementos. `end()` **no** silencia, igual que en RANARIA.
- **Blindaje heredado**: todo pasa por `crearSfx()`, que no lanza ni deja promesas colgando. Si
  el archivo no carga o el navegador bloquea la reproducción, la partida sigue igual.
- **Pruebas**: casos nuevos en `tests/games/arkanoid.test.ts`, con el stub de audio que ya
  existe en `tests/harness/audio.ts`.
- **Actualizar la cabecera doc de `arkanoid.ts`**, que hoy dice "Sin spritesheet ni sonidos".
- **Actualizar `CLAUDE.md`**: la frase de que solo RANARIA suena y la lista de assets de
  `public/`.

**Fuera de alcance (para specs futuras):**

- **Tocar `app/lib/games/audio.ts`.** No hace falta ni una línea, y que no haga falta es el
  punto de esta spec. Ver Decisiones.
- **Sonido en los otros tres motores.** ROCAS, CAÍDA y SERPENTINA siguen mudos. No hay
  grabaciones suyas y esta spec no encarga assets.
- **Sonido para perder una vida, limpiar la muralla o terminar la partida.** No hay muestra
  propia; reutilizar `bloque-romper` como castigo diría lo contrario de lo que significa.
- **Música de fondo, control de volumen, botón de mute o preferencia persistida.** Igual que en
  la SPEC 11: el único sitio donde cabría es el HUD del reproductor, que está vetado.
- **Un pool de voces** en el helper, para que los derribos en cadena se solapen. Ver Decisiones.
- **Tocar el contrato** (`app/lib/games/types.ts`) ni el reproductor
  (`app/juego/[id]/jugar/page.tsx`). Si hiciera falta, es señal de que el motor está haciendo
  algo que no le toca.
- **Migraciones de Supabase**, `app/lib/data.ts`, `app/lib/games/registry.ts` (BLOQUE BUSTER ya
  está registrado) y `app/globals.css`.
- **Los tres `.mp3` restantes de `references/mp3/`**: los dos originales de RANARIA, que ya
  cumplieron su papel, y `claudecode-finished.mp3`, que es un sonido de sistema de Claude Code
  y no de la app.

---

## Modelo

### Archivos que aparecen o cambian

| Archivo                        | Qué                                                                     |
| ------------------------------ | ----------------------------------------------------------------------- |
| `public/bloque-rebote.mp3`     | **Nuevo.** Ajuste de `references/mp3/arkanoid-ball-bounce.mp3`          |
| `public/bloque-romper.mp3`     | **Nuevo.** Ajuste de `references/mp3/arkanoid-break-sound.mp3`          |
| `app/lib/games/arkanoid.ts`    | Cabecera doc, constantes de audio, `bounced` en `StepOutcome`, disparos |
| `tests/games/arkanoid.test.ts` | Casos nuevos                                                            |
| `CLAUDE.md`                    | Dos frases desactualizadas                                              |

Nada más. **`app/lib/games/audio.ts` no aparece en esta tabla a propósito.**

### Constantes nuevas en `arkanoid.ts`

```ts
// Los efectos viven en public/, como los de RANARIA: las rutas relativas al
// módulo no las resuelve Next. Los dos archivos están normalizados al mismo pico
// (−1 dBFS), así que la mezcla la deciden estos dos números y nada más.
const SFX_REBOTE_SRC = "/bloque-rebote.mp3";
const SFX_ROMPER_SRC = "/bloque-romper.mp3";

// El rebote suena varias veces por segundo —muros y paleta— y el ladrillo una
// vez por bloque. Con los dos al mismo volumen el rebote se convierte en un
// zumbido de fondo y romper la muralla deja de premiar.
const SFX_REBOTE_VOL = 0.3;
const SFX_ROMPER_VOL = 0.6;
```

La separación resultante son **7,7 dB**, no los 6,0 que sugiere la razón 0,3 : 0,6. Los dos
archivos están al mismo **pico** —que es lo que hace comparable la mezcla— pero el ladrillo es
1,7 dB más denso en RMS (−19,0 frente a −20,7 dBFS: dura más y va más lleno), y eso se suma.
Medido sobre los mp3 finales:

| Efecto   | RMS del archivo | Volumen        | RMS efectivo |
| -------- | --------------- | -------------- | ------------ |
| `rebote` | −20,7 dBFS      | 0,3 (−10,5 dB) | −31,2 dBFS   |
| `romper` | −19,0 dBFS      | 0,6 (−4,4 dB)  | −23,4 dBFS   |

Queda anotado porque al sustituir una muestra es fácil mirar solo las constantes: lo que hay
que comparar es RMS + volumen.

### Qué cambia en `stepBall()`

`stepBall()` es una función pura exportada que resuelve muros, paleta y bloques dentro de sus
sub-pasos, y le devuelve al motor un `StepOutcome`. El audio no entra ahí: **se le añade un
campo y el motor decide qué suena.**

```ts
export interface StepOutcome {
  broken: Block[]; // bloques rotos, como mucho uno por sub-paso
  lost: boolean; // la pelota se ha ido por abajo
  bounced: boolean; // ha rebotado en un muro o en la paleta durante el frame
}
```

`bounced` es un booleano y no un contador porque **con una sola voz por efecto da igual**: dos
rebotes en el mismo fotograma producen un solo sonido de todas formas. Se pone a `true` en los
cuatro puntos que ya existen —los tres muros y `bounceOffPaddle()`— y **no** en
`bounceOffBlock()`, que es lo que implementa la regla "un evento, un sonido".

### Cuándo suena cada cosa

| Efecto   | Punto exacto en `update()` | Condición                                          |
| -------- | -------------------------- | -------------------------------------------------- |
| `rebote` | Tras `stepBall()`          | `outcome.bounced === true`, una vez por fotograma  |
| `romper` | Tras `stepBall()`          | `outcome.broken.length > 0`, una vez por fotograma |

Los dos pueden sonar **a la vez** en el mismo fotograma —la pelota rebota en el muro y rompe un
bloque en sub-pasos distintos— y eso está bien: son dos elementos de audio independientes.

Un fotograma dura como mucho 50 ms (el `dt` está capado), así que "una vez por fotograma" es un
techo de 20 disparos por segundo por efecto. En la práctica el rebote suena 2–4 veces por
segundo en niveles altos.

Y cuándo **se corta**:

| Método del `GameHandle` | Qué hace con el audio                                          |
| ----------------------- | -------------------------------------------------------------- |
| `start()`               | Nada: los `Sfx` se crean una vez en la factory, no por partida |
| `pause()`               | `silenciar()` en los dos                                       |
| `resume()`              | Nada: un efecto cortado no se retoma a medias                  |
| `end()`                 | Nada: la cola del último golpe termina de sonar sobre el modal |
| `destroy()`             | `destroy()` en los dos                                         |

Es la misma tabla que la de RANARIA, línea por línea. Que salga idéntica es la señal de que la
política de audio vive en el helper y no en cada motor.

---

## Plan de implementación

Cada paso deja la app compilando y la suite en verde.

### 1. Medir y ajustar los binarios

Decodificar los dos originales a PCM, medir pico y envolvente en ventanas de 20 ms, y aplicar
la receta de "Lo que se les hace". Escribir el resultado en `public/bloque-rebote.mp3` y
`public/bloque-romper.mp3`. Los originales de `references/mp3/` **no se tocan**.

Anotar en esta spec, bajo "Los efectos, medidos", los números que salgan (pico original,
silencio de entrada, ganancia aplicada, duración y peso finales), igual que hizo la SPEC 11.
Un ajuste sin sus números no se puede rehacer.

Verificación: `http://localhost:3000/bloque-rebote.mp3` suena a golpe seco e inmediato, sin
aire delante; `bloque-romper.mp3` suena a ladrillo roto y no a distorsión; los dos son mono
44,1 kHz 96 kbps CBR.

Ojo al hacer commit: **`public/` está sin seguimiento en git**. Los dos mp3 hay que añadirlos
seleccionando rutas, como pide `CLAUDE.md`.

### 2. `bounced` en `StepOutcome`

En `arkanoid.ts`: añadir el campo a la interfaz, inicializarlo a `false` en `stepBall()` y
ponerlo a `true` en los tres muros y en el golpe de paleta. Sin tocar `bounceOffBlock()`.

Verificación: `npx tsc --noEmit` limpio. Nadie lee el campo aún y el juego se comporta igual.

### 3. Los disparos en el motor

Importar `crearSfx` de `./audio`, añadir las cuatro constantes, crear los dos `Sfx` en el
preámbulo de la factory (junto al `new Input(canvas)`), y colocar `play()`, `silenciar()` y
`destroy()` según las dos tablas de "Cuándo suena cada cosa".

Actualizar la cabecera doc del archivo: hoy dice "Sin spritesheet ni sonidos", y a partir de
aquí la mitad de esa frase es mentira. El spritesheet sigue descartado; los sonidos ya no.

Verificación: `npm run lint` y `npm run build` limpios.

### 4. Las pruebas

Casos nuevos en `tests/games/arkanoid.test.ts`, encima de las 27 del contrato que ya hereda.
El stub (`tests/harness/audio.ts`) y su instalación en `setup.ts` ya existen desde la SPEC 11:
no hay andamiaje nuevo que escribir.

- **`stepBall()`, como unidad:** un rebote contra un muro deja `bounced` en `true`; romper un
  bloque deja `bounced` en `false` y un elemento en `broken`. Es la aserción que fija la regla
  "un evento, un sonido" en el sitio donde se decide.
- **Romper un bloque reproduce `/bloque-romper.mp3`.** Se puede hacer avanzando fotogramas
  desde el arranque sin tocar `Math.random()`: la pelota sale de la paleta a 35° y, vaya al
  lado que vaya, la muralla del nivel 1 ocupa las diez columnas, así que la alcanza en ~1 s
  sin haber tocado antes ninguna pared lateral.
- **Ese mismo impacto no reproduce `/bloque-rebote.mp3`.** El contrapunto del caso anterior.
- **`pause()` silencia los dos** y **`destroy()` los suelta**, comprobado con `vecesPausado()`.

Verificación: `npm run test:run` verde, sin ruido de jsdom en la salida.

### 5. La documentación

En `CLAUDE.md`, dos frases:

- La de `references/templates/`: _"**Solo RANARIA tiene sonido** (SPEC 11): dos efectos, el
  salto y el atropello. Los otros cuatro juegos son mudos"_ → pasan a ser dos los juegos con
  sonido, con sus dos efectos cada uno, y tres los mudos.
- La de assets de `public/`: añadir `bloque-rebote.mp3` y `bloque-romper.mp3`, con la misma
  nota que llevan los de RANARIA: son versiones ajustadas de los de `references/mp3/`, no
  copias.

### 6. Ajuste jugable

Jugar una partida entera con el MCP de Playwright y ajustar **solo las dos constantes de
volumen**. El caso que hay que escuchar de verdad es el nivel 8 o superior, donde la pelota va
al doble de velocidad: si ahí el rebote se vuelve un zumbido, bajar `SFX_REBOTE_VOL`.

---

## Criterios de aceptación

### Build

- [ ] `npm run test:run`, `npm run lint` y `npm run build` terminan sin errores ni warnings.
- [ ] La consola del navegador no muestra errores ni promesas rechazadas al jugar.
- [ ] **`app/lib/games/audio.ts` no se ha modificado**, ni `tests/harness/audio.ts`, ni
      `tests/harness/setup.ts`.
- [ ] `app/juego/[id]/jugar/page.tsx`, `app/lib/games/types.ts`, `app/lib/games/registry.ts`,
      `app/lib/data.ts` y `app/globals.css` **no** se han modificado.
- [ ] No se ha añadido ninguna migración en `supabase/migrations/`.
- [ ] `arkanoid.ts` no declara estado de audio a nivel de módulo: los dos `Sfx` viven en el
      closure de `createArkanoidGame`.
- [ ] Nada de `app/` importa de `references/`: los mp3 se sirven desde `public/`.
- [ ] Los originales de `references/mp3/` siguen intactos.

### Los efectos

- [ ] Los dos archivos de `public/` son **mono, 44,1 kHz, 96 kbps CBR**.
- [ ] Los dos están normalizados al mismo pico, −1 dBFS, y ninguno satura.
- [ ] Ninguno de los dos termina con un clic: los dos llevan fundido de salida.
- [ ] Los dos pesan menos de 12 KB.
- [ ] La sección "Los efectos, medidos" de esta spec recoge los números reales del ajuste.

### El sonido en la partida

- [ ] Golpear la paleta reproduce el sonido de rebote.
- [ ] Rebotar en el muro izquierdo, en el derecho y en el techo reproduce el mismo sonido.
- [ ] Romper un bloque reproduce el sonido de ladrillo.
- [ ] Romper un bloque **no** reproduce además el de rebote.
- [ ] Perder una vida, limpiar la muralla y terminar la partida **no** reproducen nada.
- [ ] En un derribo en cadena los golpes no se solapan: se oye uno por fotograma como mucho.
- [ ] En el nivel 10, con la pelota al doble de velocidad, el rebote sigue leyéndose como un
      golpe y no como un zumbido continuo.
- [ ] El ladrillo se oye por encima del rebote.
- [ ] Mover la paleta con el ratón suena igual que moverla con las flechas: el sonido depende
      del golpe, no del control.
- [ ] En la última vida, la cola del último sonido sigue oyéndose cuando se abre el modal "FIN
      DEL JUEGO".
- [ ] Pausar con `Escape`, con el botón PAUSA o cambiando de pestaña corta el sonido en curso.
- [ ] Reanudar no reproduce nada por sí solo.
- [ ] Navegar fuera de `/juego/bloque-buster/jugar` corta el sonido de inmediato.
- [ ] Entrar y salir del juego diez veces no deja audio acumulado ni sonidos duplicados.
- [ ] Con los archivos borrados de `public/` (prueba manual), el juego sigue siendo jugable: no
      hay excepciones ni fotogramas perdidos, simplemente no suena.

### Lo que no debe romperse

- [ ] RANARIA sigue sonando exactamente igual, con sus dos efectos y sus volúmenes.
- [ ] ROCAS, CAÍDA y SERPENTINA siguen mudos.
- [ ] La física de BLOQUE BUSTER no cambia: la pelota rebota, puntúa y sube de nivel igual que
      antes, y sigue sin atravesar bloques.
- [ ] La partida sigue registrándose en `game_sessions` con `game_id = 'bloque-buster'`, una
      sola fila, con su `level` y su `ended_reason`.
- [ ] `duration_ms` sigue sin contar las pausas.
- [ ] El HUD, el modal de fin y "JUGAR DE NUEVO" se comportan igual que antes.
- [ ] Las 27 comprobaciones del contrato siguen pasando para los cinco motores.

---

## Decisiones

### Alcance

- **Sí:** revocar la exclusión de sonido de la SPEC 09. Aquella decisión se justificó en que
  meter audio abría el tema del volumen y del autoplay para todo el portal; la SPEC 11 lo cerró
  con el helper, el gesto previo del overlay y el volumen como constante del motor. La razón
  desapareció, así que la exclusión también.
- **Sí:** solo BLOQUE BUSTER, y solo dos efectos. Son las dos grabaciones que hay y son las dos
  acciones del bucle jugable.
- **No:** sonido para perder una vida, limpiar la muralla o terminar. Es el mismo criterio que
  la SPEC 11 aplicó a las cuatro muertes sin muestra de RANARIA. `bloque-romper` como sonido de
  perder la pelota sería peor que el silencio: el jugador lleva toda la partida asociándolo a
  sumar puntos, y de golpe significaría lo contrario.
- **No:** control de volumen ni botón de mute. Sin cambios respecto a la SPEC 11: el único
  sitio donde cabría es el HUD del reproductor, vetado desde la SPEC 05, y sería la primera
  preferencia persistida del portal.

### Los assets

- **Sí:** ajustarlos en vez de copiarlos tal cual, aunque el material de partida sea bueno. No
  es por rescatar nada —estos no traen los 630 ms de aire que tenía el salto de la rana— sino
  por dos cosas concretas: dejar los dos al mismo pico, que es lo que permite mezclar desde el
  código, y quitar el VBR, que hace la búsqueda menos predecible en el `currentTime = 0` de
  cada disparo.
- **Sí:** 44,1 kHz aunque los originales sean de 48. Es el muestreo que ya sirve el portal, y
  con un efecto sonando varias veces por segundo el reamuestreo en tiempo real es trabajo
  gratuito. Los dos mp3 de RANARIA no se retocan para igualarlos por el otro lado: ya están
  bien.
- **Sí:** mono. Ninguno de los dos juegos tiene panorama espacial, el canvas mide 800 px y el
  archivo pesa la mitad.
- **Sí:** los originales se quedan en `references/mp3/` y lo ajustado va a `public/`. Es el
  papel que `CLAUDE.md` da a cada carpeta, y deja rehacer el ajuste con otros números.
- **Sí:** nombres `bloque-rebote.mp3` y `bloque-romper.mp3`, prefijados por el juego y con la
  acción en español, siguiendo a `rana-salto.mp3` y `rana-choque.mp3`. Los nombres de origen
  (`arkanoid-*`) delatan el clásico, y los ids del catálogo están en español precisamente para
  no hacerlo.
- **No:** fundidos largos. Los de la SPEC 11 eran de 60 y 120 ms sobre muestras de 0,52 y
  1,25 s; aquí las muestras son de medio segundo y un fundido largo se comería el golpe.

### Arquitectura

- **Sí:** `audio.ts` no se toca. Es el criterio de aceptación más importante de la spec, no un
  detalle: la SPEC 11 justificó el helper como "la costura por la que las pruebas sustituyen el
  audio" y como el sitio único donde vive la política de reproducción. Si el segundo motor que
  suena obligara a modificarlo, esa justificación era falsa y habría que rehacer la
  abstracción. Que las dos tablas de "cuándo se corta" salgan idénticas es la comprobación de
  que no lo era.
- **Sí:** un campo `bounced` en `StepOutcome` en vez de un callback de audio dentro de
  `stepBall()`. `stepBall()` es una función pura y exportada, y las pruebas la usan como
  unidad; pasarle un `onBounce` la convertiría en algo que hay que instrumentar para probar. El
  patrón ya existe en el archivo: `broken` y `lost` son exactamente eso, hechos que la función
  reporta y que el motor traduce a puntos, partículas y vidas.
- **Sí:** booleano y no contador. Con una voz por efecto, dos rebotes en el mismo fotograma
  producen un solo sonido igualmente, así que un contador sería información que nadie usa.
- **Sí:** el impacto contra un bloque **no** dispara el rebote, aunque físicamente lo sea. Dos
  muestras simultáneas en cada bloque roto se suman en el mismo instante de ataque y el
  resultado es barro, no un golpe más gordo. Un evento, un sonido.
- **Sí:** los muros suenan, no solo la paleta. Es lo que hace que el jugador se entere de lo que
  pasa arriba mientras mira la paleta, que es donde mira siempre. El riesgo —que en niveles
  altos se vuelva un zumbido— se controla con `SFX_REBOTE_VOL` y hay un criterio de aceptación
  que lo escucha en el nivel 10.
- **No:** un pool de voces para que los derribos en cadena se solapen. Sería lo fiel a una
  demolición real, pero cuesta ampliar `audio.ts` —que hoy usa RANARIA— más sus pruebas, y
  encima con muestras de medio segundo tres voces solapadas dan barro por el mismo motivo del
  punto anterior. Una voz es lo que hace una recreativa.
- **Sí:** un disparo por fotograma como máximo, comprobando `broken.length > 0` en vez de
  llamar a `play()` dentro del bucle de bloques rotos. Con una sola voz el resultado audible es
  el mismo, pero llamar N veces reinicia el elemento N veces en el mismo tick y ensucia lo que
  cuenta el stub de pruebas: una aserción sobre "cuántas veces sonó" dejaría de significar
  "cuántos golpes se oyeron".
- **Sí:** crear los `Sfx` en la factory y no en `start()`. Mismo motivo que en RANARIA: "JUGAR
  DE NUEVO" fabricaría elementos nuevos cada vez y el primer golpe de cada partida llegaría
  tarde por la descarga.
- **Sí:** silenciar al pausar. Un rebote sonando bajo el overlay de PAUSA delata que el motor
  sigue teniendo algo en marcha.
- **No:** silenciar en `end()`. La cola del último golpe sobre el modal es lo que hace que el
  final se lea como consecuencia y no como un corte seco. Decidido en la SPEC 11 y sin motivo
  para cambiarlo.

---

## Riesgos

| Riesgo                                                                                                                                                       | Mitigación                                                                                                                                                                                           |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **El rebote cansa.** Es el efecto que más suena del portal con diferencia: muros y paleta, varias veces por segundo, y creciendo con la velocidad del nivel. | Volumen bajo por defecto (`0.3`, ~5,5 dB por debajo del ladrillo), un disparo por fotograma como techo, y un criterio de aceptación que lo escucha específicamente en el nivel 10.                   |
| Añadir `bounced` toca `stepBall()`, que es la función con la física del juego y la que más criterios de aceptación de la SPEC 09 sostiene.                   | El cambio es aditivo y no lee nada: un `let` que se pone a `true` en cuatro sitios y viaja en el `StepOutcome`. Hay criterio de aceptación de que la física no cambia, y las 27 del contrato siguen. |
| Es fácil marcar `bounced` también en `bounceOffBlock()` por simetría, y entonces cada bloque roto sonaría doble.                                             | Hay una prueba unitaria sobre `stepBall()` que afirma exactamente lo contrario, y un criterio de aceptación aparte.                                                                                  |
| Reencodear un mp3 que ya era mp3: hay pérdida de generación, y aquí además se baja de 48 a 44,1 kHz.                                                         | Una sola pasada, sobre material que en origen llega a 128 kbps, para dos efectos cortos de golpe seco. Los originales quedan en `references/mp3/` para rehacerlo.                                    |
| El ajuste se decide midiendo la envolvente, no escuchando: un corte podría comerse una cola audible en muestras que ya son cortas.                           | Los cortes caen por debajo de −50 dBFS y llevan fundido. El paso 1 los escucha en el navegador y el paso 6 los escucha jugando.                                                                      |
| Tocar `audio.ts` "de paso" durante la implementación rompería lo que esta spec quiere demostrar.                                                             | Es un criterio de aceptación explícito y verificable con `git diff --stat`.                                                                                                                          |
| Entrar y salir del juego muchas veces deja elementos de audio vivos reteniendo búferes.                                                                      | `destroy()` del motor llama al `destroy()` de los dos `Sfx`, que ya pausa, quita el `src` y llama a `load()`. Hay criterio de aceptación de diez ciclos.                                             |
| BLOQUE BUSTER es el único motor con listener de puntero; añadir audio a su `destroy()` puede tapar una regresión en el `detach()` del ratón.                 | La prueba que ya existe (`destroy() suelta también el listener de puntero del canvas`) no se toca, y las nuevas se añaden aparte.                                                                    |

---

## Lo que **no** está en esta spec

- El sonido de ROCAS, CAÍDA y SERPENTINA, y los efectos que le faltan a RANARIA.
- Música de fondo, mezclador y control de volumen en el HUD.
- Un pool de voces en `crearSfx()`.
- El spritesheet y los power-ups de Arkanoid, que la SPEC 09 dejó fuera y siguen fuera.
- El top 10 del detalle `/juego/bloque-buster`, que sigue con `seededScores` (deuda de la
  SPEC 07).
- El `best` mock de `bloque-buster` (28.450).
- Controles táctiles.
