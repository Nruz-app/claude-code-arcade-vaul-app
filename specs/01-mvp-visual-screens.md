# SPEC 01 — MVP visual de Arcade Vault (portado a Next.js 16)

> **Estado:** Implementado
> **Depende de:** —  (es la primera spec del proyecto)
> **Fecha:** 2026-07-20
> **Objetivo:** Portar las 5 pantallas de referencia (`references/templates/`) a Next.js 16 App Router como una interfaz retro-arcade puramente visual, sin implementar ningún juego real.

---

## Alcance

**Dentro:**

- Cinco pantallas como rutas reales del App Router:
  - `/` → Biblioteca (hero, buscador, chips de categoría, grilla de tarjetas de juego).
  - `/juego/[id]` → Detalle (portada, info, stats, leaderboard lateral).
  - `/juego/[id]/jugar` → Reproductor (HUD, pantalla CRT decorativa, modal "FIN DEL JUEGO").
  - `/auth` → Acceso (pestañas iniciar sesión / crear cuenta, invitado, social).
  - `/salon` → Salón de la Fama (podio + tabla por juego).
- `Nav` (barra superior + panel móvil) y `footer` compartidos, en el layout raíz.
- Portado de `styles.css` (950 líneas) a `app/globals.css` conservando las clases y variables del sistema de diseño.
- Fuentes arcade (*Press Start 2P*, *JetBrains Mono*) vía `next/font/google`, reemplazando Geist.
- Datos mock portados a un módulo TypeScript (`GAMES`, `CATS`, `seededScores`) con tipos.
- Interactividad de UI puramente cosmética: buscador y filtros de la biblioteca, pestañas del salón, efecto tilt de las tarjetas, HUD del reproductor con su bucle de puntuación **falso** (`setInterval`) y modal de fin de juego.
- Persistencia falsa en `localStorage`: "login" (`av_user`) y guardado de puntuación (`av_scores`), compartida entre rutas mediante un contexto de React en el layout.

**Fuera de alcance (para specs futuras):**

- Cualquier lógica de juego real (motores, colisiones, controles jugables).
- Autenticación real (backend, OAuth de Google/GitHub — los botones son decorativos).
- Puntuaciones reales o persistidas en servidor; el leaderboard usa datos generados con `seededScores`.
- Tests automatizados (aún no hay runner configurado).
- SEO/metadata avanzada, i18n, modo claro, accesibilidad más allá de lo que ya trae el markup.
- Responsive fino más allá de lo que la referencia ya resuelve.

---

## Modelo de datos

No se introducen estructuras nuevas respecto a la referencia; se portan a TypeScript con tipos explícitos en `app/lib/data.ts`.

```ts
// app/lib/data.ts
export type GameColor = "cyan" | "magenta" | "yellow" | "green";
export type GameCat = "ARCADE" | "PUZZLE" | "SHOOTER" | "VERSUS";

export interface Game {
  id: string;          // slug, p. ej. "bloque-buster"
  title: string;
  short: string;       // descripción corta (tarjeta)
  long: string;        // descripción larga (detalle)
  cat: GameCat;
  cover: string;       // clase CSS de portada, p. ej. "cover-bricks"
  color: GameColor;    // acento del botón JUGAR
  best: number;        // mejor puntuación mostrada
  plays: string;       // partidas, texto ya formateado ("12.4K")
}

export interface ScoreRow {
  rank: number;
  name: string;
  score: number;
  date: string;        // "dd/mm/2026"
}

export const GAMES: Game[];                 // los 8 juegos de la referencia
export const CATS: readonly string[];       // ["TODOS","ARCADE","PUZZLE","SHOOTER","VERSUS"]
export function seededScores(seed: number, count?: number): ScoreRow[];
```

Datos persistidos en `localStorage` (cosméticos, sin versionado):

```ts
// clave "av_user"
type StoredUser = { name: string } | null;

// clave "av_scores"  (array acumulado, solo se escribe; no se lee para render)
type StoredScore = { game: string; score: number; name: string; at: number };
```

Convenciones:

- `id` es la clave de ruta (`/juego/[id]`) y la semilla implícita del leaderboard (`id.length`).
- Las puntuaciones del leaderboard/salón **no** son reales: se derivan de `seededScores`, determinista por semilla.

---

## Plan de implementación

Cada paso deja la app ejecutable (`npm run dev` / `npm run build` sin errores). Los pasos 5–9 son **portes** de un componente de referencia ya existente (traducción JSX→TSX + `next/link`), no lógica nueva.

1. **Estilos y fuentes base.** Portar `references/templates/styles.css` a `app/globals.css` (conservando clases y variables tras la capa de Tailwind v4). En `app/layout.tsx`, cargar *Press Start 2P* y *JetBrains Mono* con `next/font/google` y exponerlas como variables CSS (`--pixel`, `--mono`); quitar Geist. Añadir los divs de fondo `av-bg` y `av-noise` en el `body`. Verificación: la home starter se ve con fondo neón y tipografías retro.

2. **Módulo de datos.** Crear `app/lib/data.ts` con los tipos (`Game`, `ScoreRow`, `GameCat`, `GameColor`), `GAMES` (los 8 juegos), `CATS` y `seededScores`. Verificación: `npm run build` compila con tipado strict.

3. **Contexto de usuario.** Crear `app/lib/user-context.tsx` (`"use client"`): provider que lee/escribe `av_user` en `localStorage` y expone `user`, `login`, `signOut`, `saveScore` (escribe `av_scores`). Montarlo en el layout raíz. Verificación: el contexto está disponible sin romper el render.

4. **Nav + footer + layout.** Portar `nav.jsx` a `app/components/nav.tsx` (`"use client"`) usando `next/link` y `usePathname` para el estado activo, y consumiendo el contexto de usuario (nombre / cerrar sesión). Añadir el `footer` y el `<main className="av-main">` en `app/layout.tsx`. Verificación: la barra y el menú móvil aparecen en todas las rutas.

5. **Biblioteca (`/`).** Reescribir `app/page.tsx` (`"use client"`) portando `biblioteca.jsx`: `GameCard` con tilt, hero, buscador y chips de categoría con filtrado. Los enlaces van a `/juego/[id]`. Verificación: buscar/filtrar funciona; el estado vacío se muestra.

6. **Detalle (`/juego/[id]`).** Crear `app/juego/[id]/page.tsx` (Server Component) portando `detalle.jsx`: portada, info, `stat-strip`, acciones y leaderboard con `seededScores`. `params` es `Promise` en Next 16 (`await params`). Juego inexistente → `notFound()`. Verificación: cada juego abre su detalle; el botón "JUGAR AHORA" enlaza a `/juego/[id]/jugar`.

7. **Reproductor (`/juego/[id]/jugar`).** Crear `app/juego/[id]/jugar/page.tsx` (`"use client"`) portando `reproductor.jsx`: HUD, pantalla CRT decorativa, bucle de puntuación falso, pausa y modal "FIN DEL JUEGO" con guardado vía `saveScore`. Verificación: el score sube, pausa/fin funcionan, guardar muestra el toast.

8. **Acceso (`/auth`).** Crear `app/auth/page.tsx` (`"use client"`) portando `auth.jsx`: pestañas, campos, "jugar como invitado" y botones sociales decorativos; `login()` redirige a `/` con `useRouter`. Verificación: iniciar sesión/invitado deja el nombre en el Nav.

9. **Salón de la Fama (`/salon`).** Crear `app/salon/page.tsx` (`"use client"`) portando `salon.jsx`: pestañas por juego, podio y tabla con `seededScores`; fila "tu marca" si hay usuario. Verificación: cambiar de pestaña recalcula el ranking.

10. **Metadata y limpieza.** Ajustar `metadata` del layout (`title`, `description` de Arcade Vault) y eliminar restos del starter (`app/page.module.css`, SVGs de `public/` no usados). Verificación: `npm run lint` y `npm run build` pasan limpios.

---

## Criterios de aceptación

- [ ] `npm run lint` y `npm run build` terminan sin errores ni warnings de tipos.
- [ ] La consola del navegador no muestra errores al cargar cada una de las 5 rutas.
- [ ] Existen las rutas `/`, `/juego/[id]`, `/juego/[id]/jugar`, `/auth` y `/salon` y responden (sin 404).
- [ ] El fondo neón (`av-bg` + `av-noise`) y las fuentes *Press Start 2P* / *JetBrains Mono* se aplican en todas las rutas.
- [ ] El `Nav` marca como activa la sección actual y el panel móvil abre y cierra.
- [ ] En `/`, escribir en el buscador filtra las tarjetas por título en vivo.
- [ ] En `/`, pulsar un chip de categoría muestra solo los juegos de esa categoría; "TODOS" las muestra todas.
- [ ] En `/`, una búsqueda sin resultados muestra el bloque "NO HAY RESULTADOS".
- [ ] Pulsar una tarjeta o "JUGAR" navega a `/juego/[id]` del juego correcto.
- [ ] `/juego/[id]` con un `id` inexistente devuelve la página 404 (`notFound()`).
- [ ] En `/juego/[id]`, "JUGAR AHORA" navega a `/juego/[id]/jugar` y "VOLVER AL VAULT" a `/`.
- [ ] En `/juego/[id]/jugar`, la puntuación del HUD sube sola mientras no esté en pausa ni finalizado.
- [ ] En el reproductor, "PAUSA" detiene el bucle y muestra el overlay "EN PAUSA"; "REANUDAR" lo reanuda.
- [ ] En el reproductor, "FIN" abre el modal con la puntuación final; "GUARDAR PUNTUACIÓN" muestra el toast "PUNTUACIÓN GUARDADA".
- [ ] En `/auth`, iniciar sesión o "jugar como invitado" redirige a `/` y el nombre queda visible en el Nav.
- [ ] Tras iniciar sesión, recargar la página conserva el usuario (leído de `localStorage`).
- [ ] En `/salon`, cambiar de pestaña de juego recalcula podio y tabla; con usuario activo aparece la fila "TU MEJOR MARCA".

---

## Decisiones

- **Sí:** rutas reales del App Router (`/`, `/juego/[id]`, `/juego/[id]/jugar`, `/auth`, `/salon`). URLs compartibles y navegación idiomática de Next 16.
- **No:** replicar el router por `hash` del `app.jsx` original. Desperdicia el App Router; solo tendría sentido para una SPA de un único punto de entrada.
- **Sí:** portar `styles.css` casi tal cual a `app/globals.css`. Es un sistema de diseño completo y probado (950 líneas); reescribirlo sería trabajo y riesgo sin valor para un MVP visual.
- **No:** reconstruir el diseño con utilidades de Tailwind. Tailwind v4 queda disponible pero apenas se usa en esta spec.
- **Sí:** fuentes arcade (*Press Start 2P*, *JetBrains Mono*) vía `next/font/google`, reemplazando Geist. El look retro depende de ellas y `next/font` evita el CDN de Google.
- **Sí:** estado de usuario compartido mediante un Context de React en el layout. Sustituye el prop-drilling del original y sobrevive entre rutas reales.
- **Sí:** detalle (`/juego/[id]`) como Server Component; el resto como `"use client"`. El detalle no tiene estado, así que aprovecha el render en servidor.
- **Sí:** conservar interactividad y persistencia **falsas** (bucle de score, login y guardado en `localStorage`). Son cosméticas y forman parte de "lo visual"; sin backend.
- **No:** implementar cualquier juego real, auth real u OAuth. Va en specs futuras; los botones sociales son decorativos.
- **No:** versionar las claves de `localStorage` (`av_user`, `av_scores`). Datos desechables y cosméticos; no hay migración que proteger.

---

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Leer `localStorage` durante el render provoca desajuste de hidratación (SSR no tiene `window`). | El Context lee `localStorage` dentro de `useEffect` tras el montaje; el estado inicial es `null`/invitado. |
| Portar 950 líneas de CSS puede chocar con el reset/capas de Tailwind v4. | Colocar el CSS portado después de `@import "tailwindcss"`; verificar visualmente cada pantalla contra la referencia. |
| `params` es ahora una `Promise` en Next 16; el conocimiento previo asume objeto plano. | Usar `await params` en `/juego/[id]`; consultar `node_modules/next/dist/docs/01-app/` antes de escribir el routing. |
| Los efectos (tilt, bucle de score) usan APIs de navegador y romperían en Server Components. | Marcar esas pantallas como `"use client"` según el plan. |

---

## Lo que **no** está en esta spec

- Lógica de juego real (motores, colisiones, controles jugables).
- Autenticación real / OAuth de Google o GitHub.
- Puntuaciones reales o persistidas en servidor.
- Tests automatizados.

Cada una de esas, si aterriza, va en su propia spec.
