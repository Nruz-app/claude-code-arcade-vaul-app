## Arcade Vault

Es una plataforma para jugar online y competir por la mayor cantidad de puntos.

## Juegos

El catálogo tiene ocho juegos. **Siete son reales**: corren sobre un canvas y
sus partidas se guardan en la base de datos y aparecen en el Salón de la Fama.
Solo queda uno simulando la pantalla de juego, a la espera de su motor.

| Juego             | Id              | Clásico        | Estado   | Spec                  |
| ----------------- | --------------- | -------------- | -------- | --------------------- |
| **ROCAS**         | `rocas`         | Asteroids      | Jugable  | 05                    |
| **CAÍDA**         | `caida`         | Tetris         | Jugable  | 08                    |
| **BLOQUE BUSTER** | `bloque-buster` | Arkanoid       | Jugable  | 09 · sonido en la 12  |
| **SERPENTINA**    | `serpentina`    | Snake          | Jugable  | 10                    |
| **RANARIA**       | `ranaria`       | Frogger        | Jugable  | game-jam · sonido: 11 |
| **GLOTÓN**        | `gloton`        | Pac-Man        | Jugable  | 18                    |
| **INVASORES**     | `invasores`     | Space Invaders | Jugable  | 21                    |
| DUELO PIXEL       | `duelo-pixel`   | Pong           | Simulado | —                     |

**DUELO PIXEL está bloqueado por diseño, no por falta de tiempo.** Su marcador de
0–11 no compara con el resto del Salón de la Fama, y además necesita una IA que
haga de segundo jugador. No tendrá motor hasta que se resuelva antes cómo puntúa.

Los ids están en español a propósito y no delatan el clásico que son. Son los
slugs de las URLs: `/juego/serpentina` y `/juego/serpentina/jugar`.

En cualquiera de los siete juegos reales: la partida no arranca hasta pulsar
**ESPACIO** en el overlay, `ESC` pausa y reanuda, y cambiar de pestaña pausa
solo. Los controles de cada uno los anuncia el propio overlay, y todos se juegan
también con el mando de la consola, a los lados de la pantalla.

**INVASORES** es el más reciente. Una formación de 5×11 baja hacia ti y
**acelera sola conforme la vacías**, hasta doce pasos por segundo con el último
invasor vivo; tienes **una sola bala en vuelo**, así que fallar cuesta. Los
cuatro escudos se erosionan disparo a disparo —los tuyos también— y el hueco que
abres a tiros es por donde disparas después. Si un invasor llega a tu línea la
partida termina en el acto, aunque te queden vidas.

**GLOTÓN** es el más caro de los siete: laberinto y cuatro fantasmas con
personalidad propia. Es el único juego sin selector de aspecto, y a propósito:
en Pac-Man el color _es_ el juego —el rojo y el rosa son cómo distingues a
Blinky de Pinky—, así que repintarlo rompería la lectura.

**RANARIA** es uno de los dos juegos con sonido —el otro es
BLOQUE BUSTER—: suenan el salto y el atropello, y nada más. Cruzas cinco carriles de coches y cuatro de río saltando
con las flechas o WASD; en el agua solo sobrevives encima de un tronco o de una
tortuga, y las tortugas se sumergen cada pocos segundos avisando con un
parpadeo. Cada intento corre contra un temporizador que también cuesta una vida
si se agota, y llegar a un nenúfar cobra bonus por el tiempo que sobre: correr
puntúa, pero el río castiga las prisas. Llenar los cinco nenúfares sube el nivel
y acelera todos los carriles, sin final.

**SERPENTINA** se gira con las flechas o con WASD, los cuatro bordes son pared y
la serpiente arranca ya en movimiento. Las frutas valen 50, 150 o 300 puntos por
el nivel según su rareza, y alargan la serpiente 1, 2 o 3 segmentos: la que más
puntúa es también la que más estorba después. Cada 5 frutas sube el nivel y con
él la velocidad.

Para guardar puntuaciones hace falta cuenta: como invitado se puede jugar, pero
la marca se queda en el navegador y no entra en el ranking.

## Puesta en marcha

```bash
npm install
cp .env.example .env   # y rellena los valores
npm run dev            # http://localhost:3000
```

Las pruebas son **Vitest sobre jsdom** y cubren los motores de juego:
`npm run test:run` hace una pasada (348 pruebas) y `npm test` se queda en modo
watch.

### Variables de entorno

`.env` no se versiona. Copia `.env.example` y rellena los dos valores desde el
dashboard de Supabase, en **Project Settings → API Keys**:

| Variable                               | De dónde sale                                            |
| -------------------------------------- | -------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | Project URL                                              |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable key (`sb_publishable_…`)                     |
| `SUPABASE_DB_PASS`                     | Solo la usa el CLI de Supabase; la aplicación no la lee. |

Las dos primeras llevan el prefijo `NEXT_PUBLIC_` porque viajan al navegador.
La clave publicable es pública por diseño: lo que protege los datos son las
políticas RLS, no el secreto de la clave. La `service_role` no se usa en este
proyecto y no debe acabar en el repositorio.

### Base de datos

El esquema vive en `supabase/migrations/`, que es el histórico con el porqué de
cada objeto. `20260809191140_profiles.sql` crea la tabla `public.profiles`, sus
políticas RLS y el trigger `on_auth_user_created`, que es quien inserta el perfil
al registrarse: la aplicación nunca hace `insert` sobre esa tabla.

**Para recrear la base en un proyecto de Supabase nuevo** —porque el del plan
gratuito se pausó, se borró, o porque acabas de clonar el repositorio— sigue el
runbook de [`supabase/README.md`](supabase/README.md): son seis pasos, y el
segundo es pegar `supabase/schema.sql` entero en el editor SQL del dashboard.
`npm run db:check` dice si quedó bien y distingue «no se puede conectar» de
«falta el esquema».

En **Authentication → Sign In / Providers → Email**, la opción **Confirm email**
debe estar **desactivada**. Con ella activada, `signUp` no devuelve sesión y el
registro muestra "REVISA TU CORREO PARA CONFIRMAR LA CUENTA" en lugar de entrar
directo a la biblioteca.

En **Authentication → URL Configuration → Redirect URLs** tiene que estar
`http://localhost:3000/auth/confirmar` (y la equivalente de producción, si la
hay). Sin ella, el enlace de recuperación de contraseña llega al correo y
funciona, pero Supabase ignora el `redirectTo` y deja al usuario en la portada
en lugar de en la pantalla para escribir la contraseña nueva. Esa misma lista es
la que usa la vuelta de Google y GitHub, así que **si sirves el portal en otro
puerto, hay que añadirlo también**.

Para entrar con **Google o GitHub** hacen falta además dos aplicaciones OAuth
—una en Google Cloud Console y otra en GitHub Developer Settings—, las dos
apuntando a `https://<project_ref>.supabase.co/auth/v1/callback`, con su Client
ID y Secret pegados en **Authentication → Sign In / Providers**. El paso 3c del
runbook lo detalla. Sin ese alta, los dos botones muestran "ESE ACCESO NO ESTÁ
DISPONIBLE TODAVÍA" y el resto del acceso sigue funcionando igual.

Y tres interruptores de seguridad, en las mismas pantallas: **Minimum password
length** a **8** y **Leaked password protection** activada (ambos en
_Authentication → Sign In / Providers → Email_), más el límite de registros e
inicios de sesión por hora y por IP bajado a **10** en _Authentication → Rate
Limits_. Son el paso 3d del runbook. Si te olvidas, el portal funciona igual —
pero acepta contraseñas de seis caracteres y contraseñas ya filtradas, y el
mínimo que el formulario anuncia deja de ser el que aplica el servidor.

## Usa Spec Driven Design

Basado en /spec y /spec-impl

Siguiendo las buenas practicas recomendadas aquí:
https://github.com/Klerith/fernando-skills

Las specs viven en `specs/`, numeradas. Hay veintitrés y **veintidós están
implementadas**: las pantallas del MVP (01), la landing y "Acerca de" (02),
correcciones de layout (03), la autenticación con Supabase (04), ROCAS (05), el
registro de partidas (06), el Salón de la Fama real (07), CAÍDA (08), BLOQUE
BUSTER (09), SERPENTINA (10), el sonido de RANARIA (11), el de BLOQUE BUSTER
(12), las skins (13), el mando táctil (14), el esquema portátil de Supabase
(15), la apariencia del gamepad (16), la consola con los controles a los lados
(17), GLOTÓN (18), las pantallas de acceso y recuperación (19), OAuth con Google
y GitHub (20), INVASORES (21) y el endurecimiento de seguridad (22).

La **23** —respaldo y migración de los datos de Supabase— está aprobada pero
todavía **sin implementar**: es la que hará que perder el proyecto del plan
gratuito deje de costar las partidas.

Aparte de las numeradas está `specs/game-jam/`, que no sigue esa numeración: son
las que escribe el subagente `game-jam`, una carpeta por juego. Hoy hay una,
`ranaria`, de la que salió el quinto motor.

Cada una lleva una sección de **Decisiones** que explica por qué las cosas
quedaron así y qué se descartó.

Aparte de las numeradas está `specs/game-jam/`, una carpeta por juego con la
spec repartida en seis archivos. La escribe un subagente a partir de un tema
libre, sin hacer preguntas por el camino. De ahí salió RANARIA
(`specs/game-jam/ranaria/`), que después recibió su sonido en la SPEC 11.

## Cómo se añade un juego

Un juego nuevo es **un archivo, dos líneas y sus pruebas**. La plataforma ya
está hecha: el reproductor, el HUD, la pausa, el modal de fin, el registro de la
partida en Supabase y el Salón de la Fama funcionan igual para cualquier motor,
y no hay que tocar nada de eso. Tampoco hace falta ninguna migración: `game_id`
es texto libre en `game_sessions` y las pestañas del Salón salen del catálogo.

1. Se escribe el motor en `app/lib/games/<juego>.ts` cumpliendo el contrato de
   `app/lib/games/types.ts`: recibe un canvas y cuatro callbacks
   (`onScore`, `onLives`, `onLevel`, `onGameOver`) y devuelve un mando con
   `start`, `pause`, `resume`, `end` y `destroy`.
2. Se registra en `app/lib/games/registry.ts`, que son **cuatro** entradas: una
   línea en `GAME_ENGINES`, otra en `GAME_CONTROLS` con las teclas que anunciará
   el overlay, otra en `GAME_PALETAS` con su ficha de skins y otra en
   `GAME_TOUCH` con los botones del mando. `registry.test.ts` cruza los cuatro
   mapas, así que olvidarse de uno no pasa inadvertido.
3. Se le añade `tests/games/<juego>.test.ts`. Las invariantes comunes ya están
   escritas como suites compartidas, así que **tres líneas heredan 35
   comprobaciones**: `verificaContrato("NOMBRE", createXGame)` son 27,
   `verificaSkins("NOMBRE", createXGame, SKINS_X)` otras 3 —que los colores
   salgan del tema y que montar sin skin pinte igual que con `neon`— y
   `verificaMando("NOMBRE", "id", createXGame)` las 5 últimas, que despachan de
   verdad los `code` declarados en `GAME_TOUCH` y comprueban que el motor los
   consume. Encima va solo lo propio del juego.

Los assets (sprites, hojas de imágenes, mp3) van a `public/` y se referencian
con ruta absoluta —`/snake-fruits.png`—, nunca relativa al módulo. El sonido lo
dispara el motor con `crearSfx()` (`app/lib/games/audio.ts`), nunca el
reproductor.

Hay una skill del repo que hace justo esto, `/nuevo-juego`: escribe la spec,
para para que la revises y luego implementa el motor. Las invariantes que debe
cumplir un motor, con el porqué de cada una, están en
`.claude/skills/nuevo-juego/contrato.md`.

## Skills usadas

Dos vienen de fuera y están fijadas por hash en `skills-lock.json`, así que no se
editan a mano:

```bash
npx skills@latest add Klerith/fernando-skills
```

```bash
npx skills add https://github.com/anthropics/skills --skill frontend-design
```

Y tres son **propias del repo**, en `.claude/skills/`, que por eso **no** entran
en `skills-lock.json`:

| Skill                   | Qué hace                                                                                                                                            |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/nuevo-juego`          | Añade un juego jugable: escribe la spec, para para que la apruebes, implementa el motor, lo registra y escribe sus pruebas.                         |
| `/spec-imp-game`        | `/spec-impl` con el cierre que una spec de juego siempre necesita: al terminar lanza `skin-designer` y después `mobile-porter`, uno detrás de otro. |
| `/telegram-arcade-send` | Puente local con el móvil del propietario. Herramienta de desarrollo, como `db:check`; `app/` no la importa ni sabe que existe.                     |

## Subagentes

Seis, en `.claude/agents/`. Lo que los hace útiles no es el prompt sino su
**memoria**, en `.claude/memoria/`: una tabla por agente que se lee antes de
trabajar y se actualiza al terminar, y cuyas filas nunca se borran. Es lo que
impide que vuelvan a proponer, auditar o medir lo mismo cada vez.

| Agente                     | Qué decide o arregla                                           | Escribe en                      |
| -------------------------- | -------------------------------------------------------------- | ------------------------------- |
| `game-planner`             | Cuál debería ser el próximo juego del catálogo.                | Nada — solo su memoria.         |
| `game-jam`                 | Convierte un tema libre en una spec completa, sin supervisión. | `specs/game-jam/<id>/`          |
| `skin-designer`            | Los tres aspectos (`neon`, `retro`, `clasico`) de un motor.    | El motor que le toca.           |
| `mobile-porter`            | Cómo se ve el portal en un teléfono.                           | `app/globals.css`, y solo ahí.  |
| `game-performance-booster` | El coste por fotograma de un motor, sin cambiar un solo píxel. | El motor que le toca.           |
| `security-auditor`         | Que lo que el portal da por seguro lo siga siendo.             | Cuatro archivos, lista cerrada. |

Estado de sus memorias hoy: `game-planner` al día (siete juegos implementados,
dos propuestos); `game-performance-booster` con seis motores `optimizado` y solo
INVASORES sin medir; `skin-designer` con las tres filas de RANARIA aún
`pendiente`; `security-auditor` con 9 de 47 controles verificados; y
`mobile-porter` sin empezar.
