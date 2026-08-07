# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Crítico: lee primero la documentación incluida de Next.js

`AGENTS.md` no es texto de relleno. Este proyecto usa **Next.js 16.2.10** (React 19.2), que tiene cambios que rompen compatibilidad respecto a versiones anteriores. Es probable que tu conocimiento previo esté desactualizado para esta versión. **Antes de escribir o modificar cualquier código de Next.js** (routing, obtención de datos, caché, metadata, configuración, componentes de servidor/cliente), lee la guía correspondiente en `node_modules/next/dist/docs/` — la documentación del App Router está en `node_modules/next/dist/docs/01-app/`. Presta atención a los avisos de deprecación en esos documentos. Ejemplo concreto: en Next 16, `params` en un page es una **Promise** y hay que hacerle `await` (ver `app/juego/[id]/page.tsx`).

## Comandos

- `npm run dev` — inicia el servidor de desarrollo (http://localhost:3000)
- `npm run build` — build de producción
- `npm start` — sirve el build de producción
- `npm run lint` — ESLint (configuración flat, `eslint.config.mjs`)

Next.js 16 usa **Turbopack** por defecto tanto en `dev` como en `build`; espera el comportamiento y la salida de Turbopack, no de webpack.

Aún no hay un runner de tests configurado, así que valida los cambios con `npm run lint` y `npm run build` antes de darlos por terminados.

## Skills

Usa siempre `/frontend-design` para diseñar la interfaz de usuario.

## Flujo de trabajo: Spec Driven Design

El desarrollo sigue **Spec Driven Design** con las skills `/spec` y `/spec-impl` (de `Klerith/fernando-skills`). Prefiere escribir o refinar una spec antes de implementar funcionalidades.

- Las specs viven en `specs/` numeradas (`01-...md`, `02-...md`, …). `specs/.spec-config.yml` tiene `AutoCreateBranch: true`: `/spec-impl` crea y cambia a la rama `spec-NN-slug` automáticamente.
- `references/templates/` contiene los **mockups originales en JSX/HTML** de los que se portan las pantallas (p. ej. `home.jsx`, `about.jsx`, `salon.jsx`) y juegos HTML de ejemplo en `started-games/`. Es material de referencia, no código de la app: al portar algo, consúltalo pero escribe el resultado en `app/` con TypeScript y las convenciones de abajo.

## Arquitectura

"Arcade Vault" es un portal retro para jugar clásicos arcade y competir por puntuaciones (ver `README.md`). Todo es **frontend con datos mock** — no hay backend ni juegos reales todavía: el reproductor simula el score con un intervalo y el auth es falso.

- **Solo App Router** — todas las rutas viven en `app/`. Rutas actuales: `/` (landing), `/biblioteca` (catálogo con filtros), `/juego/[id]` (detalle), `/juego/[id]/jugar` (reproductor), `/salon` (rankings), `/acerca`, `/auth`.
- **Patrón servidor/cliente**: las páginas que necesitan estado son client components; cuando además necesitan `metadata`, se dividen en un `page.tsx` Server Component contenedor que exporta `metadata` + un `*-client.tsx` con toda la UI (ver `app/biblioteca/` y `app/acerca/`). Sigue este patrón para rutas nuevas.
- **Datos mock centralizados en `app/lib/data.ts`**: catálogo `GAMES` (los `id` son los slugs de las URLs), tipos compartidos (`Game`, `GameColor`, etc.) y datos de la landing. `seededScores(seed)` genera rankings deterministas — mismo seed, mismas filas — para que SSR y cliente coincidan.
- **Estado de usuario en `app/lib/user-context.tsx`** (`useUser()`): login falso y scores persistidos en localStorage (claves `av_user`, `av_scores`). La hidratación desde localStorage ocurre en un `useEffect` tras el montaje para no romper la hidratación de SSR — mantén ese patrón para cualquier lectura de `window`/`localStorage`.
- **Estilos**: Tailwind CSS v4 vía `@tailwindcss/postcss` (no hay `tailwind.config.js`; en v4 se configura en CSS). En la práctica casi todo el estilo es **CSS artesanal en `app/globals.css`** (~1300 líneas): tokens del tema en `:root` (`--cyan`, `--magenta`, `--yellow`, `--green`, `--bg`, `--line`…), clases del sistema (`av-*`, `cover-*`, `neon-*`, `.reveal`) y efectos de fondo. Al agregar UI, reutiliza esas clases y variables en vez de utilidades Tailwind sueltas, para mantener la estética consistente.
- **Fuentes**: Press Start 2P (`--font-pixel`, titulares/HUD) y JetBrains Mono (`--font-mono`, cuerpo) cargadas con `next/font/google` en `app/layout.tsx`. El CSS las consume vía `--pixel` y `--mono`.
- **Animación de scroll**: el hook `useReveal()` (`app/lib/use-reveal.ts`) revela elementos `.reveal` al entrar en viewport; el CSS hace la transición.
- **Iconos**: pixel-art en SVG inline en `app/components/pixel-icons.tsx`; la barra de navegación es `app/components/nav.tsx` y se monta en el layout raíz.
- **TypeScript**: modo strict. El alias de importación `@/*` apunta a la raíz del proyecto (p. ej. `@/app/...`).
- **Idioma**: toda la UI, los comentarios del código y las specs están en español. Mantenlo así.
