## Arcade Vault

Es una plataforma para jugar online y competir por la mayor cantidad de puntos.

## Juegos

El catálogo tiene ocho juegos. **Cinco son reales**: corren sobre un canvas y
sus partidas se guardan en la base de datos y aparecen en el Salón de la Fama.
Los otros tres siguen siendo una simulación de la pantalla de juego, a la espera
de su motor.

| Juego             | Id              | Clásico        | Estado   |
| ----------------- | --------------- | -------------- | -------- |
| **ROCAS**         | `rocas`         | Asteroids      | Jugable  |
| **CAÍDA**         | `caida`         | Tetris         | Jugable  |
| **BLOQUE BUSTER** | `bloque-buster` | Arkanoid       | Jugable  |
| **SERPENTINA**    | `serpentina`    | Snake          | Jugable  |
| **RANARIA**       | `ranaria`       | Frogger        | Jugable  |
| GLOTÓN            | `gloton`        | Pac-Man        | Simulado |
| INVASORES         | `invasores`     | Space Invaders | Simulado |
| DUELO PIXEL       | `duelo-pixel`   | Pong           | Simulado |

Los ids están en español a propósito y no delatan el clásico que son. Son los
slugs de las URLs: `/juego/serpentina` y `/juego/serpentina/jugar`.

En cualquiera de los cinco juegos reales: la partida no arranca hasta pulsar
**ESPACIO** en el overlay, `ESC` pausa y reanuda, y cambiar de pestaña pausa
solo. Los controles de cada uno los anuncia el propio overlay.

**RANARIA**, el más reciente, es el único con sonido: suenan el salto y el
atropello, y nada más. Cruzas cinco carriles de coches y cuatro de río saltando
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
`npm run test:run` hace una pasada (177 pruebas) y `npm test` se queda en modo
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

El esquema vive en `supabase/migrations/`. Para recrearlo en un proyecto nuevo,
aplica los archivos en orden de nombre. `20260809191140_profiles.sql` crea la
tabla `public.profiles`, sus políticas RLS y el trigger `on_auth_user_created`,
que es quien inserta el perfil al registrarse: la aplicación nunca hace `insert`
sobre esa tabla.

En **Authentication → Sign In / Providers → Email**, la opción **Confirm email**
debe estar **desactivada**. Con ella activada, `signUp` no devuelve sesión y el
registro muestra "REVISA TU CORREO PARA CONFIRMAR LA CUENTA" en lugar de entrar
directo a la biblioteca.

## Usa Spec Driven Design

Basado en /spec y /spec-impl

Siguiendo las buenas practicas recomendadas aquí:
https://github.com/Klerith/fernando-skills

Las specs viven en `specs/`, numeradas. Las once están implementadas: las
pantallas del MVP (01), la landing y "Acerca de" (02), correcciones de layout
(03), la autenticación con Supabase (04), ROCAS (05), el registro de partidas
(06), el Salón de la Fama real (07), CAÍDA (08), BLOQUE BUSTER (09), SERPENTINA
(10) y el sonido de RANARIA (11). Cada una lleva una sección de **Decisiones**
que explica por qué las cosas quedaron así y qué se descartó.

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
2. Se registra en `app/lib/games/registry.ts`: una línea en `GAME_ENGINES` y
   otra en `GAME_CONTROLS` con las teclas que anunciará el overlay.
3. Se le añade `tests/games/<juego>.test.ts`. Las invariantes comunes ya están
   escritas como suite compartida, así que una línea —
   `verificaContrato("NOMBRE", createXGame)`— hereda las 27 comprobaciones, y
   encima va solo lo propio del juego.

Los assets (sprites, hojas de imágenes, mp3) van a `public/` y se referencian
con ruta absoluta —`/snake-fruits.png`—, nunca relativa al módulo. El sonido lo
dispara el motor con `crearSfx()` (`app/lib/games/audio.ts`), nunca el
reproductor.

Hay una skill del repo que hace justo esto, `/nuevo-juego`: escribe la spec,
para para que la revises y luego implementa el motor. Las invariantes que debe
cumplir un motor, con el porqué de cada una, están en
`.claude/skills/nuevo-juego/contrato.md`.

## Skills usadas

```bash
npx skills@latest add Klerith/fernando-skills
```

```bash
npx skills add https://github.com/anthropics/skills --skill frontend-design
```
