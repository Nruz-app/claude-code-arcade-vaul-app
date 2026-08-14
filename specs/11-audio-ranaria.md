# SPEC 11 — Sonido en RANARIA: el salto y el atropello

> **Estado:** Borrador
> **Depende de:** SPEC 05, SPEC 06, spec de la jam `specs/game-jam/ranaria/`
> **Fecha:** 2026-08-13
> **Objetivo:** Dar sonido a las dos acciones que definen RANARIA —saltar y morir atropellado— reproduciendo desde el motor los dos efectos ya ajustados (`public/rana-salto.mp3` y `public/rana-choque.mp3`), sin tocar el reproductor, el contrato `GameHandle` ni Supabase, y dejando un helper mínimo (`app/lib/games/audio.ts`) sobre el que los siguientes juegos puedan poner efectos.

---

## Por qué existe esta spec

Hoy **ningún juego del portal suena**. Los cinco motores dibujan y nada más, y `CLAUDE.md`
lo dice explícitamente: _"Que haya `mp3/` no significa que la app tenga sonido"_. Esa frase
era cierta porque los mp3 de `references/` eran material suelto sin destinatario; ahora hay
dos grabados a propósito para la rana.

RANARIA es además el juego del catálogo que más gana con esto. Es el primer motor de
**esquiva**: la partida entera consiste en decidir el instante de un salto y en enterarse de
que te han pillado. Las dos únicas acciones que hay son exactamente las dos que tienen sonido,
así que dos efectos cubren el 100 % del bucle jugable sin abrir la puerta a una biblioteca de
audio.

La spec es pequeña a propósito, pero deja tres cosas asentadas para el portal: **dónde viven
los binarios de audio** (`public/`, como el PNG de SERPENTINA), **quién los dispara** (el
motor, nunca el reproductor) y **cómo se prueban bajo jsdom**, que no implementa
`HTMLMediaElement.play()`.

---

## Los efectos, medidos y ajustados

Las grabaciones de `references/mp3/` **no eran usables tal cual**. Medidas antes de tocarlas
(decodificando a PCM y midiendo la envolvente en ventanas de 20 ms):

| Medida         | `rana-salto.mp3`                | `rana-choque.mp3`          |
| -------------- | ------------------------------- | -------------------------- |
| Duración       | 2,090 s                         | 2,000 s                    |
| Formato        | 128 kbps estéreo 44,1 kHz       | 128 kbps estéreo 44,1 kHz  |
| Peso           | 33,5 KB                         | 33,1 KB                    |
| Pico           | −6,5 dBFS                       | **+0,7 dBFS**              |
| Sonido útil    | de 0,63 s a 1,15 s (**0,52 s**) | de 0,00 s a ~1,25 s        |
| Diferencia L/R | 0,027 (prácticamente mono)      | 0,175 (prácticamente mono) |

De ahí salen los dos defectos que había que corregir, y ninguno es cosmético:

1. **El salto llegaba 630 ms tarde.** Los primeros 0,63 s del archivo están por debajo de
   −70 dB: es aire. Un efecto de salto que suena seis fotogramas y medio después de la tecla
   no se percibe como el salto, sino como un ruido ajeno; y como el jugador salta cada 200–300
   ms, cada disparo habría cortado al anterior **antes** de que llegara a sonar nada. Con el
   archivo original el juego habría estado prácticamente mudo.
2. **El choque venía recortado.** Su pico decodificado es **+0,7 dBFS**, por encima de fondo
   de escala: el navegador satura esas muestras y el golpe suena a distorsión sucia en vez de
   a golpe.

Además los dos traían más de un segundo de cola inaudible (por debajo de −60 dB), y el choque
un artefacto suelto a 1,98 s.

### Lo que se les ha hecho

Los originales **se quedan intactos en `references/mp3/`** como material de partida; lo
ajustado se escribe en `public/`, que es lo único que sirve la app.

| Paso                    | `rana-salto.mp3`                         | `rana-choque.mp3`             |
| ----------------------- | ---------------------------------------- | ----------------------------- |
| Recorte de entrada      | al primer ataque (−40 dBFS) = **0,63 s** | ninguno: ya arranca en 0      |
| Recorte de cola         | a **0,52 s** de sonido                   | a **1,25 s** de sonido        |
| Fundido de salida       | 60 ms                                    | 120 ms                        |
| Normalización a −1 dBFS | ganancia **×1,877** (+5,5 dB)            | ganancia **×0,818** (−1,7 dB) |
| Mezcla                  | mono                                     | mono                          |
| Reencode                | 96 kbps 44,1 kHz                         | 96 kbps 44,1 kHz              |
| **Resultado**           | **0,52 s · 6,6 KB**                      | **1,25 s · 15,4 KB**          |

De 66,5 KB a 22,0 KB, con el salto respondiendo en el instante de la tecla y el choque sin
saturar. Las dos muestras quedan al **mismo pico (−1 dBFS)** a propósito: así la mezcla entre
ellas la decide una constante del motor y no el azar de cómo se grabó cada una.

Las duraciones no son arbitrarias, van pegadas al juego:

- **0,52 s de salto** es más corto que el intervalo cómodo entre dos saltos (~0,25 s de
  pulsación humana, con la interpolación de `SALTO_MS = 90`), así que en carrera se cortan
  entre ellos y suenan a "boing-boing" de recreativa, que es lo que se quiere.
- **1,25 s de choque** cubre los `MUERTE_MS = 700` del destello **y sobra medio segundo**, que
  es justo lo que hace que en la última vida el golpe siga sonando cuando se abre el modal de
  FIN DEL JUEGO. Es deliberado (ver Decisiones).

El reencode con LAME mete ~26 ms de silencio de codificador al principio de cada archivo —un
fotograma y medio a 60 fps—. Se acepta: es inaudible, y quitarlo exige una cabecera de
reproducción sin huecos que `new Audio()` no aprovecha de forma fiable.

---

## Alcance

**Dentro:**

- **Los dos efectos ajustados en `public/`**: `public/rana-salto.mp3` y
  `public/rana-choque.mp3`, referenciados como `/rana-salto.mp3` y `/rana-choque.mp3`. **Ya
  hechos** (ver la sección anterior); el paso 1 del plan solo los verifica.
- **Helper `app/lib/games/audio.ts`**: `crearSfx(src, volumen)` devuelve un `Sfx` con
  `play()`, `silenciar()` y `destroy()`. Sin estado de módulo, sin React, sin tocar el
  documento.
- **Sonido de salto** en RANARIA, disparado **solo cuando la rana se mueve de verdad**.
- **Sonido de choque** en RANARIA, disparado **solo en la muerte por atropello**, que obliga a
  que `matar()` reciba el motivo.
- **Silencio al pausar y al destruir**: `pause()` corta lo que esté sonando y `destroy()`
  suelta los dos elementos.
- **Blindaje**: si el navegador bloquea la reproducción o el archivo no carga, el juego sigue
  igual. Ningún camino de audio puede lanzar ni dejar una promesa rechazada sin capturar.
- **Pruebas**: stub de audio en `tests/harness/audio.ts` instalado desde `setup.ts`,
  `tests/games/audio.test.ts` para el helper y tres casos nuevos en
  `tests/games/frogger.test.ts`.
- **Actualizar `CLAUDE.md`**: las dos frases que quedan mentirosas (la de que ningún juego
  reproduce audio y la de que `public/` solo tiene `snake-fruits.png`).

**Fuera de alcance (para specs futuras):**

- **Sonido en los otros cuatro motores.** ROCAS, CAÍDA, BLOQUE BUSTER y SERPENTINA siguen
  mudos. El helper queda escrito para ellos, pero esta spec no les añade ni un efecto.
- **Los otros sonidos que RANARIA podría tener**: ahogarse, ocupar un nenúfar, comer la mosca,
  subir de nivel. No hay grabaciones y usar la del choque para ahogarse mentiría.
- **Música de fondo.** Es otro problema: bucle, mezcla con los efectos y un control de volumen
  que hoy no existe.
- **Control de volumen, botón de mute o preferencia persistida.** El HUD del reproductor no
  tiene sitio reservado y añadirlo es tocar `app/juego/[id]/jugar/page.tsx`, que está vetado.
  Mientras tanto, silenciar la pestaña es cosa del navegador.
- **Tocar el contrato** (`app/lib/games/types.ts`). No hace falta ningún callback nuevo: el
  audio ni sale ni entra del motor.
- **Tocar el reproductor** (`app/juego/[id]/jugar/page.tsx`). Si hiciera falta, es señal de
  que el motor está haciendo algo que no le toca.
- **Migraciones de Supabase**, `app/lib/data.ts`, `app/globals.css` y el `best` mock.
- **Web Audio API.** Ver Decisiones.

---

## Modelo

### Archivos que aparecen o cambian

| Archivo                       | Qué                                                                |
| ----------------------------- | ------------------------------------------------------------------ |
| `public/rana-salto.mp3`       | **Nuevo, ya escrito.** 0,52 s mono, recortado y normalizado        |
| `public/rana-choque.mp3`      | **Nuevo, ya escrito.** 1,25 s mono, sin clipping                   |
| `app/lib/games/audio.ts`      | **Nuevo.** El helper `crearSfx()`, ~60 líneas                      |
| `app/lib/games/frogger.ts`    | Constantes de audio, `motivo` en `matar()`, tres puntos de disparo |
| `tests/harness/audio.ts`      | **Nuevo.** Stub de `HTMLMediaElement` para jsdom                   |
| `tests/harness/setup.ts`      | Una línea: instalar el stub                                        |
| `tests/games/audio.test.ts`   | **Nuevo.** Pruebas del helper                                      |
| `tests/games/frogger.test.ts` | Tres casos nuevos                                                  |
| `CLAUDE.md`                   | Dos frases desactualizadas                                         |

Nada más. Ni `registry.ts` (RANARIA ya está registrada), ni el reproductor, ni `types.ts`, ni
`data.ts`, ni CSS, ni `supabase/migrations/`.

### El helper

```ts
// app/lib/games/audio.ts

export interface Sfx {
  play: () => void; // reinicia y suena; nunca lanza
  silenciar: () => void; // corta lo que esté sonando
  destroy: () => void; // silencia y suelta el elemento
}

export function crearSfx(src: string, volumen: number): Sfx;
```

Cuatro reglas que el helper garantiza, y que son la razón de que exista como módulo aparte
en vez de veinte líneas dentro de `frogger.ts`:

1. **Una voz por efecto.** El mismo `HTMLAudioElement` se reinicia con `currentTime = 0`
   antes de cada `play()`. Dos saltos seguidos no se solapan: el segundo corta al primero.
2. **`play()` no lanza y no deja promesas colgando.** En el navegador devuelve una promesa que
   se rechaza si la política de autoplay lo bloquea (`NotAllowedError`), y **bajo jsdom
   devuelve `undefined`** porque `HTMLMediaElement.play` no está implementado. Las dos cosas
   se cubren con la misma guardia: `try`/`catch` alrededor, y `catch` sobre el resultado solo
   si es una promesa de verdad.
3. **Se puede construir sin `Audio`.** Si el entorno no lo define, `crearSfx` devuelve un
   `Sfx` que no hace nada. La factory de un motor es síncrona y corre en el navegador, pero un
   `Sfx` mudo es mejor que un `if` repartido por el motor.
4. **`destroy()` suelta de verdad.** `pause()`, `removeAttribute("src")` y `load()`, para que
   navegar entre juegos veinte veces no deje veinte elementos de audio vivos reteniendo el
   búfer. `src = ""` no vale: en varios navegadores dispara una petición a la propia URL de la
   página.

### Constantes nuevas en `frogger.ts`

```ts
// Los efectos viven en public/, como el PNG de SERPENTINA: las rutas relativas
// al módulo no funcionan en Next. Los dos archivos están recortados y
// normalizados al mismo pico (−1 dBFS), así que la mezcla la deciden estos dos
// números y nada más.
const SFX_SALTO_SRC = "/rana-salto.mp3";
const SFX_CHOQUE_SRC = "/rana-choque.mp3";

// El salto suena hasta once veces por cruce y el choque una vez cada varios
// segundos: con los dos al mismo volumen, el salto tapa la partida y el golpe
// deja de leerse como un castigo. Los 6,6 dB de diferencia son deliberados.
const SFX_SALTO_VOL = 0.35;
const SFX_CHOQUE_VOL = 0.75;
```

### Motivos de muerte

`matar()` hoy no recibe nada, y hay cinco caminos hasta ella. Para que el choque suene solo
cuando es un choque, pasa a recibir el motivo:

```ts
type MotivoMuerte =
  | "atropello"
  | "ahogo"
  | "arrastre"
  | "seto" // incluye caer en un nenúfar ya ocupado
  | "tiempo";

function matar(motivo: MotivoMuerte) { … }
```

El motivo **no sale del motor**: no es un `GameOverReason`, no llega a Supabase y no toca el
contrato. Solo decide, hoy, si suena el golpe; mañana, qué otro efecto suena.

| Motivo      | Dónde se llama hoy en `update()`                     | Suena        |
| ----------- | ---------------------------------------------------- | ------------ |
| `atropello` | Solape con un móvil en fila de carretera             | **`choque`** |
| `ahogo`     | Fila de río sin plataforma bajo el centro de la rana | —            |
| `arrastre`  | El centro de la rana sale del canvas sobre un tronco | —            |
| `seto`      | `llegarAMeta()` sin nenúfar libre en esa columna     | —            |
| `tiempo`    | `tiempoMs <= 0`                                      | —            |

### Cuándo suena cada cosa

| Efecto   | Punto exacto                                         | Condición                                                            |
| -------- | ---------------------------------------------------- | -------------------------------------------------------------------- |
| `salto`  | `saltar()`, **después** de las dos guardias de borde | Solo si la rana se mueve: un salto ignorado contra el borde no suena |
| `choque` | `matar("atropello")`                                 | Solo ese motivo                                                      |

Y cuándo **se corta**:

| Método del `GameHandle` | Qué hace con el audio                                                                  |
| ----------------------- | -------------------------------------------------------------------------------------- |
| `start()`               | Nada: los `Sfx` se crean una vez en la factory, no por partida                         |
| `pause()`               | `silenciar()` en los dos                                                               |
| `resume()`              | Nada: un efecto cortado no se retoma a medias                                          |
| `end()`                 | Nada: los ~0,55 s de golpe que le quedan terminan de sonar sobre el modal, a propósito |
| `destroy()`             | `destroy()` en los dos                                                                 |

---

## Plan de implementación

Cada paso deja la app compilando y la suite en verde.

### 1. Los binarios — **hecho**

Los dos efectos ya están ajustados y escritos en `public/`, con la receta de "Los efectos,
medidos y ajustados". Los originales siguen intactos en `references/mp3/`.

Verificación: `http://localhost:3000/rana-salto.mp3` suena al instante, sin medio segundo de
aire delante, y `rana-choque.mp3` suena a golpe y no a distorsión.

Ojo al hacer commit: **`public/` está hoy sin seguimiento en git** (aparece como `??`, igual
que `snake-fruits.png`). Los dos mp3 hay que añadirlos a mano, seleccionando rutas, como pide
`CLAUDE.md`.

### 2. El helper

Escribir `app/lib/games/audio.ts` con la cabecera doc de rigor —qué problema resuelve, por
qué una sola voz y por qué el `try`/`catch`—, la interfaz `Sfx` y `crearSfx()`. Sin estado a
nivel de módulo: cada llamada crea su propio elemento en el closure.

Verificación: `npx tsc --noEmit` limpio; nadie lo importa aún.

### 3. El stub de pruebas y las pruebas del helper

- `tests/harness/audio.ts`: `instalaAudioStub()` parchea `HTMLMediaElement.prototype.play`
  (devolviendo `Promise.resolve()`) y `pause`, y cuenta las llamadas por `src`, igual de
  idempotente que `instalaCanvas2d()`. Sin él, la primera prueba que salte imprime el
  `jsdomError` de "Not implemented" en cada ejecución del hook.
- `tests/harness/setup.ts`: una línea para instalarlo.
- `tests/games/audio.test.ts`: que `crearSfx` fija el volumen, que `play()` reinicia
  `currentTime`, que un `play()` que rechaza no propaga, que uno que devuelve `undefined`
  tampoco, y que `destroy()` pausa y deja el elemento sin `src`.

Verificación: `npm run test:run` verde, sin ruido de jsdom en la salida.

### 4. Los disparos en el motor

En `frogger.ts`: las constantes, los dos `crearSfx()` en el preámbulo de la factory (junto al
`new Input()`), el tipo `MotivoMuerte`, el parámetro de `matar()` en sus cinco llamadas, y las
llamadas a `play()`, `silenciar()` y `destroy()` de la tabla de arriba.

Verificación: `npm run lint` y `npm run build` limpios.

### 5. Las pruebas del motor

Tres casos en `tests/games/frogger.test.ts`, encima de las 27 del contrato que ya hereda:

- Un salto válido reproduce `/rana-salto.mp3`; un salto contra el borde del canvas, no.
- Morir atropellado reproduce `/rana-choque.mp3`. Se puede llevar la rana a la carretera y
  avanzar fotogramas porque **el convoy es determinista**: las posiciones de los coches no
  dependen de `Math.random()`, que en RANARIA solo se usa para la mosca.
- Agotar el temporizador cuesta una vida y **no** reproduce nada.

Verificación: `npm run test:run` verde.

### 6. La documentación

En `CLAUDE.md`, dos frases:

- La de `references/templates/`: _"Que haya `mp3/` no significa que la app tenga sonido: hoy
  ningún juego reproduce audio"_ → pasa a decir que RANARIA reproduce dos efectos y que el
  resto sigue mudo.
- La de assets: _"hoy solo `snake-fruits.png`"_ → los tres archivos, con la nota de que los
  mp3 de `public/` son versiones recortadas y normalizadas de los de `references/mp3/`, no
  copias.

### 7. Ajuste jugable

Jugar una partida entera con el MCP de Playwright y ajustar **solo las dos constantes de
volumen**: si el salto tapa la partida, bajar `SFX_SALTO_VOL`; si el golpe no se lee como
castigo, subir `SFX_CHOQUE_VOL`. Como las dos muestras están al mismo pico, esos dos números
son toda la mezcla que hay.

---

## Criterios de aceptación

### Build

- [ ] `npm run test:run`, `npm run lint` y `npm run build` terminan sin errores ni warnings.
- [ ] La consola del navegador no muestra errores ni promesas rechazadas al jugar.
- [ ] `app/juego/[id]/jugar/page.tsx`, `app/lib/games/types.ts`, `app/lib/games/registry.ts`,
      `app/lib/data.ts` y `app/globals.css` **no** se han modificado.
- [ ] No se ha añadido ninguna migración en `supabase/migrations/`.
- [ ] `app/lib/games/audio.ts` no declara estado a nivel de módulo y no importa React.
- [ ] Nada de `app/` importa de `references/`: los mp3 se sirven desde `public/`.
- [ ] Los originales de `references/mp3/` siguen intactos.

### Los efectos

- [ ] El salto se oye **en el instante de la tecla**: no hay medio segundo de aire delante.
- [ ] El choque suena a golpe limpio, sin la distorsión de saturación del original.
- [ ] Los dos archivos de `public/` pesan menos de 20 KB cada uno.
- [ ] Ni el salto ni el choque terminan con un clic: los dos llevan fundido de salida.

### El sonido en la partida

- [ ] Cada salto de la rana reproduce el efecto de salto, con las flechas y con WASD.
- [ ] Un salto ignorado por el borde del canvas **no** suena.
- [ ] Saltar rápido no solapa sonidos: cada salto corta al anterior y se oye un golpe por
      pulsación.
- [ ] Ser arrollado por un vehículo reproduce el efecto de choque, y se oye claramente por
      encima de los saltos.
- [ ] Ahogarse, ser arrastrado fuera del canvas, chocar contra el seto, caer en un nenúfar
      ocupado y agotar el tiempo **no** reproducen ningún sonido.
- [ ] En la última vida, el golpe sigue sonando cuando se abre el modal "FIN DEL JUEGO".
- [ ] Pausar con `Escape`, con el botón PAUSA o cambiando de pestaña corta el sonido en curso.
- [ ] Reanudar no reproduce nada por sí solo, y la rana tampoco salta sola.
- [ ] Navegar fuera de `/juego/ranaria/jugar` corta el sonido de inmediato.
- [ ] Entrar y salir del juego diez veces no deja audio acumulado ni sonidos duplicados.
- [ ] Con el archivo borrado de `public/` (prueba manual), el juego sigue siendo jugable: no
      hay excepciones ni fotogramas perdidos, simplemente no suena.

### Lo que no debe romperse

- [ ] Los otros cuatro juegos siguen exactamente igual, y siguen sin sonar.
- [ ] La partida sigue registrándose en `game_sessions` con `game_id = 'ranaria'`, una sola
      fila, con su `level` y su `ended_reason`.
- [ ] `duration_ms` sigue sin contar las pausas.
- [ ] El HUD, el modal de fin y "JUGAR DE NUEVO" se comportan igual que antes.
- [ ] Las 27 comprobaciones del contrato siguen pasando para los cinco motores.

---

## Decisiones

### Alcance

- **Sí:** solo RANARIA y solo dos efectos. Son las dos grabaciones que hay, y son justo las
  dos acciones del bucle jugable. Inventar sonidos para las otras cuatro muertes con las
  mismas muestras haría que ahogarse sonara a chapa abollada.
- **No:** sonido en los otros cuatro motores. Cada uno necesita sus propias muestras y su
  propia mezcla; el helper queda escrito para cuando las haya, y esa es toda la deuda que esta
  spec deja.
- **No:** control de volumen ni botón de mute. El único sitio donde cabría es el HUD del
  reproductor, y tocar `app/juego/[id]/jugar/page.tsx` está vetado desde la SPEC 05 — un mute
  por juego sería además la primera preferencia persistida del portal, con su propio
  almacenamiento y su propia spec. El navegador ya sabe silenciar una pestaña.
- **Sí:** actualizar `CLAUDE.md`. Sus dos frases sobre audio y assets dejan de ser ciertas con
  este cambio, y son justo las que un agente lee antes de tocar `public/`.

### Los assets

- **Sí:** editar las muestras en vez de compensar en el código. Los 630 ms de silencio del
  salto no se pueden arreglar con un `currentTime` de arranque —quedaría a merced de cómo
  decodifique cada navegador— y el clipping del choque no se arregla con volumen: ya viene
  recortado dentro del archivo. Lo que está mal en el binario se corrige en el binario.
- **Sí:** los originales se quedan en `references/mp3/` y lo ajustado va a `public/`. Es
  exactamente el papel que `CLAUDE.md` le da a cada carpeta: `references/` es material de
  partida y `public/` es lo que la app sirve. Y deja rehacer el ajuste con otros números sin
  haber perdido la fuente.
- **Sí:** normalizar las dos al mismo pico (−1 dBFS) y dejar la mezcla en dos constantes del
  motor. Con las muestras a niveles distintos, tocar el equilibrio entre salto y golpe obliga
  a reeditar audio; así es cambiar un número y recargar.
- **Sí:** −1 dBFS y no 0. Deja margen para el sobreimpulso que introduce el propio codificador
  mp3 al reconstruir la onda, que es justo lo que había convertido el choque en un archivo con
  picos por encima de fondo de escala.
- **Sí:** mono. Las dos muestras ya eran casi mono (diferencia L/R de 0,027 y 0,175), en un
  juego sin panorama espacial el estéreo no aporta nada, y a cambio pesan la mitad.
- **Sí:** 96 kbps. Sobra para dos efectos cortos que van a sonar bajo el volumen del sistema, y
  el resultado (22 KB entre los dos) es un tercio del original.
- **Sí:** recortar el salto a 0,52 s. Es más corto que el intervalo entre dos pulsaciones
  cómodas, así que cada salto se oye entero salvo cuando el jugador corre — y ahí cortarse es
  el comportamiento que se busca.
- **Sí:** dejar el choque en 1,25 s, más largo que los 700 ms del destello de muerte. El golpe
  sobrevive medio segundo a la apertura del modal en la última vida, y eso es lo que hace que
  el final se lea como una consecuencia y no como un corte seco.
- **No:** recortar el choque a la duración del destello. Un golpe de coche que se apaga en
  seco a los 700 ms suena a error de reproducción, no a diseño.
- **No:** generar variaciones del salto (dos o tres tomas alternándose) para que no canse.
  Solo hay una grabación, y fabricar variantes con cambios de tono es trabajo de assets que
  esta spec no encarga.

### Arquitectura

- **Sí:** un helper compartido en `app/lib/games/audio.ts` en vez de veinte líneas dentro de
  `frogger.ts`. No es reutilización especulativa: es **la costura por la que las pruebas
  sustituyen el audio**, y tenerla en un módulo deja un único sitio donde vive la política de
  `play()` —reinicio, captura de la promesa y guardia de entorno— en vez de repetirla en cada
  motor que acabe sonando.
- **Sí:** `HTMLAudioElement` (`new Audio()`) y no la Web Audio API. Dos efectos disparados por
  eventos discretos no necesitan grafo de nodos, ni `AudioContext` que haya que reanudar tras
  el gesto del usuario, ni decodificación manual del búfer. Web Audio se justifica cuando hace
  falta mezclar, hacer bucles o cortar con precisión de milisegundos; aquí sería más código
  para el mismo sonido.
- **Sí:** crear los `Sfx` en la factory, no en `start()`. La factory es síncrona y se llama una
  vez por montaje; crearlos por partida haría que "JUGAR DE NUEVO" fabricara elementos nuevos
  cada vez y que el primer salto de cada partida llegara tarde por la descarga.
- **Sí:** `new Audio()` dentro del motor, pese a la regla de "no tocar el DOM fuera del
  canvas". Un elemento de audio que nunca se inserta en el documento no es tocar el DOM de la
  página: es el mismo precedente que el `new Image()` de SERPENTINA, que carga
  `snake-fruits.png` sin colgar nada de ningún sitio. Lo que la regla prohíbe —escribir en
  elementos ajenos, montar overlays, buscar por `getElementById`— sigue sin ocurrir.
- **Sí:** una voz por efecto, reiniciando con `currentTime = 0`. Es lo que hace una
  recreativa: cada salto corta al anterior y se oye un golpe por pulsación. Con la muestra ya
  recortada a 0,52 s, un pool de voces solapadas solo produciría barro.
- **Sí:** `matar()` recibe el motivo. Es la alternativa a duplicar el disparo del sonido en el
  único punto de llamada del atropello, que dejaría el audio repartido por `update()` en
  cuanto haya un segundo efecto de muerte. La spec de la jam ya describía la función como
  `matar(motivo)`; esto la pone al día.
- **No:** llevar el motivo de muerte a `GameOverSummary`. Sería ampliar el contrato y, detrás,
  migrar la restricción `check` de `game_sessions`. El motivo es información de presentación
  y se queda dentro del motor.
- **Sí:** tragarse todos los errores de reproducción. La política de autoplay, un mp3 que no
  descarga o un dispositivo sin salida de audio son cosas que pasan; ninguna es razón para que
  una partida se pare. Es el mismo criterio que `leaderboard.ts`, que devuelve lista vacía en
  vez de lanzar.
- **Sí:** cubrir explícitamente el `play()` que devuelve `undefined`. No es paranoia: es
  exactamente lo que hace jsdom, y sin la guardia la suite entera se cae en cuanto la rana
  salte dentro de una prueba.
- **Sí:** silenciar al pausar. Un golpe sonando bajo el overlay de PAUSA delata que el motor
  sigue teniendo algo en marcha, justo lo contrario de lo que la pausa promete.
- **No:** silenciar en `end()`. Ver arriba: la cola del golpe sobre el modal es intencionada.

---

## Riesgos

| Riesgo                                                                                                              | Mitigación                                                                                                                                                                                             |
| ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| El ajuste reencoda un mp3 que ya era mp3: hay pérdida de generación.                                                | Una sola pasada, a 96 kbps mono sobre material que en origen era estéreo a 128: el margen sobra para dos efectos cortos. Y los originales quedan en `references/mp3/` para rehacerlo si hiciera falta. |
| Los recortes se decidieron midiendo la envolvente, no escuchando; un corte podría comerse una cola audible.         | Los dos cortes caen por debajo de −50 dB y llevan fundido de salida. El paso 1 los escucha en el navegador, y mover el corte es reejecutar el ajuste con otro número.                                  |
| La política de autoplay bloquea el primer sonido si la partida arrancara sin gesto del usuario.                     | El reproductor obliga a pulsar ESPACIO en el overlay antes de `start()`, así que siempre hay gesto previo. Y si aun así se rechaza, el `catch` deja el juego intacto.                                  |
| jsdom no implementa `play()` y ensucia la salida de la suite, que corre en cada guardado por el hook `PostToolUse`. | `tests/harness/audio.ts` lo sustituye desde `setupFiles`, igual que `canvas.ts` hace con `getContext("2d")`.                                                                                           |
| Entrar y salir del juego muchas veces deja elementos de audio vivos reteniendo búferes.                             | `destroy()` del motor llama a `destroy()` de los dos `Sfx`, que pausan, quitan el `src` y llaman a `load()`. Hay criterio de aceptación de diez ciclos.                                                |
| El salto suena hasta once veces por cruce y puede volverse cansino en una partida larga.                            | Volumen bajo por defecto (`0.35`, 6,6 dB por debajo del golpe) y una constante que el paso 7 ajusta jugando.                                                                                           |
| Añadir audio al motor puede leerse como una violación de "no tocar el DOM fuera del canvas" en la revisión.         | Queda argumentado en Decisiones y con el precedente del `new Image()` de SERPENTINA: el elemento nunca se inserta en el documento.                                                                     |
| Pasar `motivo` a `matar()` toca sus cinco llamadas y es fácil dejar una con el motivo equivocado.                   | Los cinco motivos tienen fila en la tabla de "Motivos de muerte" y casilla propia en los criterios de aceptación; el tipo `MotivoMuerte` impide inventarse un sexto.                                   |

---

## Lo que **no** está en esta spec

- El resto de sonidos de RANARIA (nenúfar, mosca, nivel, ahogo) y el sonido de los otros
  cuatro juegos.
- Música de fondo, mezclador y control de volumen en el HUD.
- El top 10 del detalle `/juego/ranaria`, que sigue con `seededScores` (deuda de la SPEC 07).
- El `best` mock de `ranaria` (18.900).
- Controles táctiles.
