# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Crítico: lee primero la documentación incluida de Next.js

`AGENTS.md` no es texto de relleno. Este proyecto usa **Next.js 16.2.10** (React 19.2), que tiene cambios que rompen compatibilidad respecto a versiones anteriores. Es probable que tu conocimiento previo esté desactualizado para esta versión. **Antes de escribir o modificar cualquier código de Next.js** (routing, obtención de datos, caché, metadata, configuración, componentes de servidor/cliente), lee la guía correspondiente en `node_modules/next/dist/docs/` — la documentación del App Router está en `node_modules/next/dist/docs/01-app/`. Presta atención a los avisos de deprecación en esos documentos.

Casos concretos con los que ya se ha tropezado en este proyecto:

- **`params` en un page es una `Promise`** y hay que hacerle `await` (ver `app/juego/[id]/page.tsx`).
- **`middleware.ts` no existe: se llama `proxy.ts`.** Next 16 renombró la convención y la función se exporta como `proxy`. La documentación pública de Supabase para Next.js todavía dice `middleware.ts`; copiarla tal cual crea un archivo que Next ignora en silencio y la sesión deja de refrescarse. Además, Proxy usa el runtime de **Node.js** por defecto (antes era Edge).
- **`cookies()` es asíncrono** (`await cookies()`), como en `app/lib/supabase/server.ts`.
- **`export const dynamic` ya no aparece** en la tabla de configuración de segmento. No hace falta: usar `cookies()` en un Server Component ya excluye la ruta del prerenderizado, que es lo que mantiene `/salon` siempre fresca.

## Comandos

- `npm run dev` — inicia el servidor de desarrollo (http://localhost:3000)
- `npm run build` — build de producción
- `npm start` — sirve el build de producción
- `npm run lint` — ESLint (configuración flat, `eslint.config.mjs`)
- `npm run format` — Prettier sobre todo el proyecto; `npm run format:check` solo verifica

No hay script de `typecheck`: los errores de tipo aparecen al correr `npm run build`. `npm run lint` invoca `eslint` sin argumentos, que con la configuración flat recorre todo el proyecto.

Hay un hook `PostToolUse` que pasa Prettier a cada archivo que Claude Code escribe o edita, y además ESLint `--fix` si es JS/TS (`.claude/format-file.sh`). No hace falta formatear a mano lo que acabas de tocar. Vive en `.claude/settings.local.json`, que **está en `.gitignore`**: es configuración personal, así que en una copia nueva del repo puede no existir — ahí el formateo va con `npm run format`.

Ni el hook ni el script llevan la ruta del proyecto escrita a mano: el `command` usa `$CLAUDE_PROJECT_DIR` y el script deriva su raíz de dónde vive él mismo. Es a propósito — con la ruta fija, copiar la carpeta a otra ubicación dejaba el hook apuntando al proyecto viejo y fallando en silencio. Si lo tocas, mantenlo así.

Sobre espacios en blanco: Prettier ya deja **como máximo una línea vacía seguida**, sin espacios ni tabs al final de línea y con un único salto de línea al final del archivo. El hook aplica esa misma limpieza a los archivos que Prettier no sabe parsear (`.sh`, `.ps1`, `.txt`, `.svg`…), saltándose binarios y `.patch`/`.diff`. No hace falta cuidar esto a mano.

Next.js 16 usa **Turbopack** por defecto tanto en `dev` como en `build`; espera el comportamiento y la salida de Turbopack, no de webpack.

Aún no hay un runner de tests configurado, así que valida los cambios con `npm run lint` y `npm run build` antes de darlos por terminados. Para verificar cambios de UI hay un MCP de Playwright disponible: levanta `npm run dev` y navega a la ruta; las capturas van a `.playwright-screenshots/` (no versionado).

La app necesita `.env` (no versionado) con `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Copia `.env.example`; el README explica de dónde salen. `SUPABASE_DB_PASS` aparece en `.env.example` pero **la aplicación no la lee**: es solo para el CLI de Supabase.

Directorios que **no** son código de la app y conviene no tocar ni tomar como ejemplo: `references/` (mockups de diseño, ignorado por ESLint y Prettier), `demos/` (scratch), `.playwright-screenshots/` y `next-home.png`.

Ojo con qué ignora git aquí, porque no coincide con lo que ignoran ESLint y Prettier: `.gitignore` solo cubre `.playwright-screenshots/` y el contenido de `.playwright-mcp/` (salvo su `.gitkeep`). `references/`, `demos/` y `next-home.png` **no están ignorados** — aparecen como archivos sin seguimiento y entrarían en un commit si haces `git add -A`. Selecciona las rutas al hacer commit.

## Skills

Usa siempre `/frontend-design` para diseñar la interfaz de usuario.

`/nuevo-juego` (`.claude/skills/nuevo-juego/`) porta un juego jugable al catálogo: escribe la spec siguiendo el patrón de la 05, para para que la apruebes, y luego implementa el motor contra `GameFactory` y lo registra. Su `contrato.md` recoge las invariantes que debe cumplir un motor y el porqué de cada una. Es propia del repo, así que **no** entra en `skills-lock.json`.

`spec` y `spec-impl` están instaladas en el repo (`.claude/skills/`, `.agents/skills/`) y fijadas por hash en `skills-lock.json`. No las edites a mano: se actualizan con `npx skills@latest add Klerith/fernando-skills`.

## Flujo de trabajo: Spec Driven Design

El desarrollo sigue **Spec Driven Design** con las skills `/spec` y `/spec-impl` (de `Klerith/fernando-skills`). Prefiere escribir o refinar una spec antes de implementar funcionalidades.

- Las specs viven en `specs/` numeradas (`01-...md`, `02-...md`, …). `specs/.spec-config.yml` tiene `AutoCreateBranch: true`: `/spec-impl` crea y cambia a la rama `spec-NN-slug` automáticamente.
- `references/templates/` contiene los **mockups originales en JSX/HTML** de los que se portan las pantallas (p. ej. `home.jsx`, `about.jsx`, `salon.jsx`) y juegos HTML de ejemplo en `started-games/`. Es material de referencia, no código de la app: al portar algo, consúltalo pero escribe el resultado en `app/` con TypeScript y las convenciones de abajo.
- Hay siete specs implementadas: pantallas del MVP (01), landing y "Acerca de" (02), correcciones de layout (03), autenticación con Supabase (04), el juego ROCAS (05), registro de partidas (06) y el Salón de la Fama real (07). **Léelas antes de tocar lo que describen**: la sección "Decisiones" de cada una explica por qué las cosas son como son y qué alternativas se descartaron.
- La spec 08 es **CAÍDA** (`08-juego-caida-tetris.md`), el porte de Tetris al juego `caida`. Es la primera escrita con la skill `/nuevo-juego` y sirve de modelo para los siguientes juegos: demuestra que portar uno no toca el reproductor, el contrato, Supabase ni `/salon`.
- Los siguientes juegos de `references/templates/started-games/` (`03-tetris`, `04-arkanoid`) se portan escribiendo un motor en `app/lib/games/` y registrándolo; no hace falta tocar el reproductor. **Los ids del catálogo están en español y no delatan el clásico que son**: `rocas` = Asteroids (ya portado desde `02-asteroids`), `caida` = Tetris, `bloque-buster` = Arkanoid. Usa el id que ya existe en `GAMES`, no inventes uno nuevo.

## Arquitectura

"Arcade Vault" es un portal retro para jugar clásicos arcade y competir por puntuaciones (ver `README.md`). Ya **no** es solo frontend: hay autenticación real con Supabase, un juego real sobre canvas y las partidas se registran en la base de datos.

**Qué es real y qué sigue siendo mock**, porque conviven:

| Real                                                 | Mock                                                           |
| ---------------------------------------------------- | -------------------------------------------------------------- |
| Autenticación (Supabase, correo y contraseña)        | El catálogo `GAMES` y `CATS`, en `app/lib/data.ts`             |
| El juego **ROCAS** (`rocas`), Asteroids sobre canvas | Los otros siete juegos: reproductor simulado con `setInterval` |
| Registro de partidas en `game_sessions`              | El campo `best` de las tarjetas                                |
| El Salón de la Fama (`/salon`)                       | El top 10 del detalle `/juego/[id]` (`seededScores`)           |
|                                                      | El ticker de actividad y el top de jugadores de la landing     |

- **Solo App Router** — todas las rutas viven en `app/`. Rutas actuales: `/` (landing), `/biblioteca` (catálogo con filtros), `/juego/[id]` (detalle), `/juego/[id]/jugar` (reproductor), `/salon` (rankings), `/acerca`, `/auth`.
- **Patrón servidor/cliente**: las páginas que necesitan estado son client components; cuando además necesitan `metadata`, se dividen en un `page.tsx` Server Component contenedor que exporta `metadata` + un `*-client.tsx` con toda la UI (ver `app/biblioteca/`, `app/acerca/` y `app/salon/`). Sigue este patrón para rutas nuevas. `app/salon/page.tsx` va un paso más allá: además de la `metadata`, carga datos en el servidor y se los pasa al cliente como prop inicial.
- **Datos mock centralizados en `app/lib/data.ts`**: catálogo `GAMES` (los `id` son los slugs de las URLs), tipos compartidos (`Game`, `GameColor`, etc.) y datos de la landing. `seededScores(seed)` genera rankings deterministas — mismo seed, mismas filas; lo sigue usando el top del detalle, ya no el Salón.
- **Estado de usuario en `app/lib/user-context.tsx`** (`useUser()`): es una **fachada sobre la sesión de Supabase**. Al montar hace `supabase.auth.getUser()`, resuelve el nombre visible contra `profiles.username` y se suscribe a `onAuthStateChange`. Expone `{ user: { id, name } | null, loading, signOut, saveScore }`. `saveScore()` sigue escribiendo en `localStorage` (`av_scores`) — es lo único que tienen los invitados. La clave `av_user` del auth falso ya no se usa y se borra al arrancar.
- **Juegos reales en `app/lib/games/`**: `types.ts` define el contrato (`GameFactory`, `GameHandle` con `start`/`pause`/`resume`/`end`/`destroy`, y `GameCallbacks` con `onScore`/`onLives`/`onLevel`/`onGameOver`), `registry.ts` mapea `id` de `GAMES` a motor (`GAME_ENGINES`) y a las teclas que anuncia el overlay de arranque (`GAME_CONTROLS`), y `asteroids.ts` es el motor de ROCAS. Los controles viven en el registro y no en el motor **a propósito**: son texto de interfaz, y ponerlos ahí evita ampliar el contrato `GameHandle` que fijaron las specs 05 y 06. Antes estaban escritos a mano en el JSX del reproductor, así que los ocho juegos anunciaban los de ROCAS. **El motor no importa React ni toca el DOM fuera del canvas que recibe**, y todo su estado vive en el closure de `createAsteroidsGame` — nada a nivel de módulo, porque en Next un global sobrevive entre montajes. Para añadir un juego: escribe el motor y regístralo; el reproductor no cambia. El Salón de la Fama tampoco — sus pestañas salen de `GAMES` y `game_id` es texto libre en `game_sessions`, así que un juego con motor aparece en su ranking sin migración ni SQL. Lo hace la skill `/nuevo-juego`.
- **`app/juego/[id]/jugar/page.tsx` es un despachador**: si el `id` tiene motor en `GAME_ENGINES` monta el canvas real, si no cae en la simulación. HUD, pausa y modal de fin son los mismos en ambos casos, pero la rama con motor tiene comportamiento propio que conviene no romper al tocar el archivo: canvas fijo de 800×600, la partida no arranca hasta pulsar ESPACIO en un overlay, `blur` y `visibilitychange` la pausan solos (sin eso vuelves a una partida a cámara lenta), el `destroy()` del cleanup es lo que impide que queden bucles vivos al navegar, y el registro en Supabase está protegido por doble barrera contra duplicados (la guardia de `end()` en el motor más `registradaRef` aquí). Con motor **y** sesión el modal de fin no pide iniciales: la partida se registra sola con el nombre del perfil; sin sesión, o sin motor, se cae al `saveScore()` de `localStorage`.
- **Estilos**: Tailwind CSS v4 vía `@tailwindcss/postcss` (no hay `tailwind.config.js`; en v4 se configura en CSS). En la práctica casi todo el estilo es **CSS artesanal en `app/globals.css`** (~2900 líneas): tokens del tema en `:root` (`--cyan`, `--magenta`, `--yellow`, `--green`, `--bg`, `--line`…), clases del sistema (`av-*`, `cover-*`, `neon-*`, `.reveal`) y efectos de fondo. Al agregar UI, reutiliza esas clases y variables en vez de utilidades Tailwind sueltas, para mantener la estética consistente.
- **Fuentes**: Press Start 2P (`--font-pixel`, titulares/HUD) y JetBrains Mono (`--font-mono`, cuerpo) cargadas con `next/font/google` en `app/layout.tsx`. El CSS las consume vía `--pixel` y `--mono`.
- **Animación de scroll**: el hook `useReveal()` (`app/lib/use-reveal.ts`) revela elementos `.reveal` al entrar en viewport; el CSS hace la transición.
- **Iconos**: pixel-art en SVG inline en `app/components/pixel-icons.tsx`; la barra de navegación es `app/components/nav.tsx` y se monta en el layout raíz.
- **TypeScript**: modo strict. El alias de importación `@/*` apunta a la raíz del proyecto (p. ej. `@/app/...`).
- **Idioma**: toda la UI, los comentarios del código y las specs están en español. Mantenlo así.

## Supabase

Autenticación y persistencia con `@supabase/ssr`. Hay un servidor MCP de Supabase configurado en `.mcp.json` para consultar el esquema y aplicar migraciones; la URL lleva el `project_ref` fijado, así que apunta siempre al proyecto de este repo, y hay que habilitarlo (`enabledMcpjsonServers` en `.claude/settings.local.json`).

- **Tres clientes, cada uno en su sitio**: `app/lib/supabase/client.ts` (navegador), `app/lib/supabase/server.ts` (Server Components, con `await cookies()`) y el que crea `proxy.ts` sobre `NextRequest`/`NextResponse`. Nunca compartas un cliente entre peticiones: se filtran sesiones.
- **`proxy.ts` (raíz del proyecto)** refresca la cookie de sesión en cada request llamando a `supabase.auth.getUser()`. No autoriza ni redirige: **todas las rutas son públicas**. Implementa `getAll`/`setAll`, y el `setAll` de esta versión recibe un segundo argumento `headers` con las cabeceras anti-caché que hay que aplicar a la respuesta.
- **Esquema versionado en `supabase/migrations/`.** Aplica los archivos en orden de nombre para recrearlo. Hoy: `profiles`, `game_sessions` y la vista `game_leaderboard`.
  - `profiles` — perfil público. El trigger `on_auth_user_created` lo crea al registrarse tomando el nombre de `raw_user_meta_data.username`, en mayúsculas y cortado a 10 caracteres. **El cliente nunca inserta aquí**: basta con pasar `options.data.username` al `signUp`.
  - `game_sessions` — una fila por partida terminada (`score`, `level`, `duration_ms`, `ended_reason`). RLS: lectura pública, inserción solo con `auth.uid() = user_id`, y **sin políticas de `update` ni `delete`**.
  - `game_leaderboard` — vista con la mejor marca de cada jugador por juego (`DISTINCT ON`), creada con **`security_invoker = on`**; sin eso una vista se salta la RLS de las tablas que consulta.
- **Escritura y lectura**: `app/lib/game-sessions.ts` (`saveGameSession()`, se llama sola al terminar una partida con motor) y `app/lib/leaderboard.ts` (`getLeaderboard()`, `getPlayerBest()`). Ninguna lanza excepciones: devuelven un resultado o una lista vacía, para que un fallo de red no rompa la pantalla. Las de `leaderboard.ts` **reciben el cliente de Supabase como argumento** en vez de crearlo: así la misma función sirve al Server Component en la carga inicial de `/salon` y al componente cliente al cambiar de pestaña. Formatean fechas en **UTC** a propósito — con hora local, servidor y navegador discreparían y React avisaría de desajuste de hidratación.
- **Configuración del dashboard que el repo no puede fijar**: _Authentication → Sign In / Providers → Email → **Confirm email** desactivado_. Con ella activa, `signUp` no devuelve sesión.
- **La puntuación es autodeclarada.** El juego corre en el navegador, así que RLS garantiza _quién_ escribe, no que el dato sea cierto. Asumido a conciencia; no intentes "arreglarlo" con una Server Action, que no cambiaría nada.
