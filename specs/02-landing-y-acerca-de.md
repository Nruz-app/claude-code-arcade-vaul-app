# SPEC 02 — Landing y página Acerca de

> **Estado:** Implementado
> **Depende de:** SPEC 01
> **Fecha:** 2026-07-24
> **Objetivo:** Portar la landing y la pantalla "Acerca de" de `references/templates/home-about/` a Next.js 16, moviendo la Biblioteca de `/` a `/biblioteca` para que `/` pase a ser la portada del sitio.

---

## Alcance

**Dentro:**

- Nueva landing en `/` portando `references/templates/home-about/home.jsx`: hero con siluetas
  pixel flotantes, sección "¿Por qué Arcade Vault?" (4 tarjetas de feature), rail de 6 juegos,
  banda de stats, "Actividad en vivo" (ticker de puntuaciones + top jugadores), precios con FAQ
  y CTA final.
- Nueva página `/acerca` portando `about.jsx`: hero de misión, fila de highlights, separador
  animado y formulario de contacto **falso** con terminal VAULT-OS de éxito.
- Movimiento de la Biblioteca de `/` a `/biblioteca`, actualizando los enlaces internos que
  hoy apuntan a `/`: "VOLVER AL VAULT" en el detalle y la redirección tras iniciar sesión o
  entrar como invitado en `/auth`.
- `Nav` (barra superior y panel móvil) con los cuatro enlaces de la referencia: Inicio,
  Biblioteca, Salón de la Fama, Acerca de, con estado activo por ruta.
- Porte de cuatro bloques de `references/templates/home-about/styles.css` a `app/globals.css`:
  `HOME PAGE`, `ABOUT PAGE`, `ACTIVITY` y `PRICING` (~350 líneas).
- Datos mock nuevos tipados en `app/lib/data.ts`: features, stats, últimas puntuaciones,
  top jugadores y preguntas frecuentes.
- Hook compartido `app/lib/use-reveal.ts` (IntersectionObserver) que añade la clase `.in` a
  los elementos `.reveal` al entrar en viewport.
- Iconos pixel-art SVG compartidos en `app/components/pixel-icons.tsx`
  (`FloatingSilhouettes`, `FeatureIcon`, `HighlightIcon`).
- `metadata` propia para `/biblioteca` y `/acerca`, usando el `template` del layout raíz.

**Fuera de alcance (para specs futuras):**

- Los bloques CSS `GAMEPAD` (~360 líneas) y `Theme variants` (~110) de `styles.css`: no hay
  JSX de referencia que los consuma en este directorio.
- Envío real del formulario de contacto (correo, Server Action, backend). Solo valida y
  muestra la terminal falsa.
- Datos reales en el ticker de actividad y el top de jugadores; son constantes escritas a mano.
- Redirección o `redirect` permanente de `/` a `/biblioteca` para enlaces antiguos: la app no
  está publicada y no hay URLs que preservar.
- Edición de SPEC 01 para reflejar la nueva ruta de la Biblioteca; queda como registro histórico.
- Reglas `prefers-reduced-motion` para las animaciones de la landing. Deuda conocida: SPEC 01
  ya dejó la accesibilidad fuera de alcance.
- Tests automatizados (sigue sin haber runner configurado).

---

## Modelo de datos

Se extiende `app/lib/data.ts` con las constantes de la landing y de Acerca de. No se
introducen datos persistidos nuevos: las claves `av_user` y `av_scores` de SPEC 01 no cambian.

```ts
// app/lib/data.ts  (añadidos)

// El acento reutiliza la paleta ya definida en SPEC 01.
// type GameColor = "cyan" | "magenta" | "yellow" | "green";

export type FeatureIconKind = "GAMEPAD" | "FREE" | "TROPHY" | "ROCKET";
export type HighlightIconKind = "HEART" | "BROWSER" | "PLANT";

export interface Feature {
  icon: FeatureIconKind;
  title: string;        // "JUEGOS CLÁSICOS"
  desc: string;
  color: GameColor;
}

export interface HomeStat {
  value: string;        // "12+"
  unit: string;         // "JUEGOS"
  sub: string;          // "Y CONTANDO"
}

export interface RecentScore {
  player: string;       // "NEONFOX"
  game: string;         // "Caída"  (texto libre, no es un id de GAMES)
  score: number;
  ago: string;          // "hace 2 min"  (texto fijo, no se recalcula)
  color: GameColor;
}

export interface TopPlayer {
  rank: number;         // 1..5
  player: string;
  score: number;
}

export interface Faq {
  q: string;
  a: string;
}

export interface Highlight {
  icon: HighlightIconKind;
  text: string;
  color: GameColor;
}

export const FEATURES: readonly Feature[];          // 4 tarjetas de "// 01"
export const HOME_STATS: readonly HomeStat[];       // 3 bloques de la banda de stats
export const RECENT_SCORES: readonly RecentScore[]; // 7 filas del ticker
export const TOP_PLAYERS: readonly TopPlayer[];     // 5 filas del top de hoy
export const PLAN_PERKS: readonly string[];         // 6 bullets del plan gratuito
export const FAQS: readonly Faq[];                  // 3 preguntas de la sección precios
export const HIGHLIGHTS: readonly Highlight[];      // 3 highlights de /acerca
```

Estado local del formulario de contacto (`/acerca`), no vive en `data.ts`:

```ts
type ContactForm = { name: string; email: string; msg: string };
// sent: string | null  → nombre enviado; null mientras se edita
// shake: boolean       → animación de error, se apaga a los 400 ms
```

Convenciones:

- Los campos usan nombres legibles (`player`, `score`, `ago`), no las abreviaturas de una
  letra de la referencia (`p`, `s`, `t`).
- `RecentScore.game` es texto libre: la referencia nombra juegos que no siempre coinciden
  con un `id` de `GAMES`. No se enlaza a `/juego/[id]` desde el ticker.
- `RecentScore.ago` es una cadena fija. No hay reloj: "hace 2 min" sigue diciendo lo mismo
  mañana. Es aceptable porque los datos son decorativos.

---

## Plan de implementación

Cada paso deja la app ejecutable (`npm run dev` / `npm run build` sin errores) y es commiteable
por sí solo. La landing se parte en cuatro pasos porque son ~200 líneas de JSX; cada uno añade
secciones a una página que ya renderiza.

1. **CSS de las pantallas nuevas.** Copiar de `references/templates/home-about/styles.css` los
   bloques `HOME PAGE` (líneas 930–1070), `ABOUT PAGE` (1071–1150), `ACTIVITY` (1621–1671) y
   `PRICING` (1672–1725) al final de `app/globals.css`, conservando nombres de clase y
   variables. No se copian `GAMEPAD` ni `Theme variants`.
   Verificación: `npm run build` pasa; las pantallas existentes se ven igual que antes.

2. **Datos mock.** Extender `app/lib/data.ts` con los tipos (`Feature`, `HomeStat`,
   `RecentScore`, `TopPlayer`, `Faq`, `Highlight`, `FeatureIconKind`, `HighlightIconKind`) y
   las constantes `FEATURES`, `HOME_STATS`, `RECENT_SCORES`, `TOP_PLAYERS`, `PLAN_PERKS`,
   `FAQS`, `HIGHLIGHTS`.
   Verificación: `npm run build` compila con tipado strict.

3. **Iconos pixel-art.** Crear `app/components/pixel-icons.tsx` con `FloatingSilhouettes`
   (8 siluetas del hero), `FeatureIcon` (`kind: FeatureIconKind`) y `HighlightIcon`
   (`kind: HighlightIconKind`), portados tal cual de `home.jsx` y `about.jsx`.
   Verificación: `npm run build` compila; los componentes aún no se usan.

4. **Hook de reveal.** Crear `app/lib/use-reveal.ts` (`"use client"`): `useReveal()` monta un
   `IntersectionObserver` con `threshold: 0.12` que añade la clase `in` a cada `.reveal` y deja
   de observarlo; desconecta en el cleanup.
   Verificación: `npm run lint` pasa (sin warnings de dependencias de `useEffect`).

5. **Mover la Biblioteca a `/biblioteca`.** Trasladar el contenido actual de `app/page.tsx` a
   `app/biblioteca/biblioteca-client.tsx` (`"use client"`) y crear `app/biblioteca/page.tsx`
   como Server Component que exporta `metadata` y renderiza ese cliente. Actualizar los tres
   enlaces que apuntaban a `/` como biblioteca: el del `Nav`, "VOLVER AL VAULT" en
   `app/juego/[id]/page.tsx` y la redirección tras login/invitado en `app/auth/page.tsx`.
   Dejar `app/page.tsx` como `redirect("/biblioteca")` provisional.
   Verificación: `/biblioteca` funciona igual que antes la home; `/` reenvía a `/biblioteca`;
   login y "volver" aterrizan en `/biblioteca`.

6. **Landing — hero.** Reescribir `app/page.tsx` (`"use client"`) con la sección `home-hero`:
   `FloatingSilhouettes`, eyebrow "INSERTA UNA MONEDA", título de tres líneas, subtítulo, los
   dos CTAs (`/biblioteca` y `/auth`) y el indicador "DESLIZA". Llamar a `useReveal()`.
   Sustituye el redirect del paso 5.
   Verificación: `/` muestra el hero a pantalla completa con las siluetas animadas.

7. **Landing — features y rail de juegos.** Añadir la sección `// 01` con las 4 tarjetas de
   `FEATURES` (delay escalonado de 80 ms) y la `// 02` con `MiniCard` para `GAMES.slice(0, 6)`
   enlazando a `/juego/[id]`, más el botón "VER TODOS LOS JUEGOS →" hacia `/biblioteca`.
   Verificación: al hacer scroll las secciones aparecen con el efecto reveal; las mini-tarjetas
   navegan al detalle correcto.

8. **Landing — stats y actividad en vivo.** Añadir la banda `home-stats` con `HOME_STATS` y la
   sección `// 03` con las dos `activity-card`: ticker de `RECENT_SCORES` y lista
   `TOP_PLAYERS` (barra de progreso decreciente, medallas en los tres primeros) con el enlace
   "VER SALÓN →" a `/salon`.
   Verificación: las dos tarjetas se ven lado a lado en escritorio y apiladas en móvil.

9. **Landing — precios y CTA final.** Añadir la sección `// 04` con la tarjeta del plan
   gratuito (`PLAN_PERKS`, sello "FREE PLAY", CTA a `/auth`) y las tres `FAQS`, más el bloque
   `home-final` con el botón "INSERTAR MONEDA →" hacia `/biblioteca`.
   Verificación: la landing se recorre completa sin scroll horizontal ni errores en consola.

10. **Acerca de — hero y highlights.** Crear `app/acerca/page.tsx` (Server Component que
    exporta `metadata`) y `app/acerca/about-client.tsx` (`"use client"`) con el hero de misión,
    la fila de tres `HIGHLIGHTS` y el separador `about-divider` de 24 píxeles animados.
    Llamar a `useReveal()`.
    Verificación: `/acerca` responde y muestra hero, highlights y separador.

11. **Acerca de — formulario de contacto.** Añadir a `about-client.tsx` la sección de contacto:
    intro con los tres `tip`, formulario controlado (nombre, correo, mensaje), validación de
    campos no vacíos con animación `shake` de 400 ms, y el bloque `terminal-success` con el
    botón "ENVIAR OTRO MENSAJE" que reinicia el formulario.
    Verificación: enviar vacío sacude el formulario; enviar completo muestra la terminal.

12. **Nav de cuatro enlaces.** Actualizar `app/components/nav.tsx` (barra y panel móvil) con
    Inicio (`/`), Biblioteca (`/biblioteca`), Salón de la Fama (`/salon`) y Acerca de
    (`/acerca`). El estado activo de Biblioteca cubre también `/juego/...`; el de Inicio es
    coincidencia exacta con `/`.
    Verificación: cada enlace navega a su ruta y solo uno queda marcado como activo.

---

## Criterios de aceptación

**Build y rutas**

- [ ] `npm run lint` y `npm run build` terminan sin errores ni warnings de tipos.
- [ ] La consola del navegador no muestra errores al cargar `/`, `/biblioteca` y `/acerca`.
- [ ] `/`, `/biblioteca`, `/acerca`, `/salon`, `/auth`, `/juego/[id]` y `/juego/[id]/jugar`
      responden sin 404.
- [ ] `/biblioteca` conserva todo el comportamiento que `/` tenía en SPEC 01: buscador,
      chips de categoría, estado "NO HAY RESULTADOS" y navegación al detalle.
- [ ] Las pestañas del navegador muestran títulos propios en `/biblioteca` y `/acerca`,
      distintos del título por defecto de `/`.

**Landing (`/`)**

- [ ] El hero ocupa el alto de la ventana y muestra las 8 siluetas pixel flotando.
- [ ] "▶ EXPLORAR JUEGOS" navega a `/biblioteca` y "✦ CREAR CUENTA" a `/auth`.
- [ ] La sección "¿POR QUÉ ARCADE VAULT?" muestra 4 tarjetas, una por cada entrada de
      `FEATURES`, cada una con su icono y su color de acento.
- [ ] Las secciones marcadas `.reveal` empiezan ocultas y aparecen al entrar en viewport
      al hacer scroll.
- [ ] "JUEGOS DISPONIBLES AHORA" muestra exactamente 6 mini-tarjetas y cada una navega a
      `/juego/[id]` del juego correspondiente.
- [ ] "VER TODOS LOS JUEGOS →" y "INSERTAR MONEDA →" navegan a `/biblioteca`.
- [ ] "ACTIVIDAD EN VIVO" muestra 7 filas de ticker y 5 filas de top jugadores, con los tres
      primeros puestos destacados.
- [ ] "VER SALÓN →" navega a `/salon`.
- [ ] La sección de precios muestra los 6 bullets de `PLAN_PERKS` y las 3 preguntas de `FAQS`;
      "EMPEZAR GRATIS →" navega a `/auth`.
- [ ] A 375 px de ancho la landing no produce scroll horizontal.

**Acerca de (`/acerca`)**

- [ ] La página muestra el hero de misión y los 3 highlights con sus iconos.
- [ ] Enviar el formulario con cualquier campo vacío no muestra la terminal y dispara la
      animación `shake`.
- [ ] Enviar el formulario con los tres campos rellenos sustituye el formulario por la
      terminal VAULT-OS y el mensaje incluye el nombre escrito en mayúsculas.
- [ ] "ENVIAR OTRO MENSAJE" devuelve el formulario con los tres campos vacíos.

**Navegación**

- [ ] El `Nav` muestra los cuatro enlaces: Inicio, Biblioteca, Salón de la Fama, Acerca de.
- [ ] En `/` solo "Inicio" está marcado como activo; en `/biblioteca` y en `/juego/[id]` solo
      "Biblioteca"; en `/acerca` solo "Acerca de".
- [ ] El panel móvil abre, muestra los mismos cuatro enlaces y se cierra al pulsar uno.
- [ ] Tras iniciar sesión o entrar como invitado en `/auth`, la app redirige a `/biblioteca`.
- [ ] "VOLVER AL VAULT" en `/juego/[id]` navega a `/biblioteca`.

---

## Decisiones

**Rutas**

- **Sí:** la landing pasa a ser `/` y la Biblioteca se mueve a `/biblioteca`. El nav de la
  referencia separa "Inicio" de "Biblioteca"; la portada de un producto es la landing.
- **No:** dejar la Biblioteca en `/` y poner la landing en `/inicio`. Evitaba tocar código
  existente, pero deja la portada del sitio en la pantalla equivocada.
- **Sí:** `/acerca` como slug, en español y sin guion. Coherente con `/salon`, `/juego` y
  `/biblioteca`.
- **No:** `/about`. Rompe la convención de rutas en español del proyecto.
- **Sí:** tras iniciar sesión o entrar como invitado, redirigir a `/biblioteca`. Quien acaba
  de identificarse quiere jugar, no leer la página de "crea tu cuenta".
- **No:** un `redirect` permanente de la antigua ruta de la Biblioteca. La app no está
  publicada; no hay URLs que preservar.

**Estructura**

- **Sí:** `/` y el cliente de `/acerca` como `"use client"`, con `useReveal()` compartido en
  `app/lib/use-reveal.ts`. Es el porte directo de la referencia y sigue el patrón de SPEC 01,
  donde solo el detalle es Server Component.
- **No:** Server Components con una isla `<Reveal>` por sección. Mejor HTML inicial, pero
  envuelve cada sección en un wrapper para ganar poco en una app sin SEO real todavía.
- **Sí:** `/biblioteca` y `/acerca` partidas en `page.tsx` (servidor, exporta `metadata`) más
  un `*-client.tsx`. Es el patrón documentado de Next 16 para metadata en pantallas cliente.
- **No:** un `layout.tsx` por ruta solo para alojar la `metadata`. Ahorra un archivo pero
  añade un layout anidado que no hace nada más.
- **Sí:** iconos y siluetas SVG en `app/components/pixel-icons.tsx`. Son ~150 líneas de
  `<rect>` que ensuciarían las dos páginas y son reutilizables.
- **Sí:** datos mock nuevos en `app/lib/data.ts`, junto a `GAMES` y `CATS`. Un solo módulo de
  datos, como estableció SPEC 01.
- **No:** un `app/lib/home-data.ts` aparte. Fragmenta el modelo por pantalla sin ganar nada.

**Datos y contenido**

- **Sí:** reutilizar el tipo `GameColor` como acento de features, ticker y highlights. Es la
  misma paleta de cuatro colores; un tipo `Accent` paralelo sería el mismo tipo con otro nombre.
- **Sí:** `RecentScore.ago` como cadena fija ("hace 2 min"). Guardar un timestamp haría que el
  texto envejeciera a "hace 3 días" la semana que viene, que es peor que un dato claramente
  decorativo.
- **No:** rotar el ticker de "Actividad en vivo" con un `setInterval`. La referencia lo deja
  estático y añadir movimiento falso no aporta al MVP visual.
- **Sí:** nombres de campo legibles (`player`, `score`, `color`) en vez de las abreviaturas de
  una letra de la referencia (`p`, `s`, `c`). El JSX de referencia es código desechable; el
  módulo de datos se queda.

**CSS y alcance**

- **Sí:** portar solo los bloques `HOME PAGE`, `ABOUT PAGE`, `ACTIVITY` y `PRICING`
  (~350 líneas). Es exactamente lo que consumen las dos pantallas.
- **No:** portar `GAMEPAD` (~360 líneas) y `Theme variants` (~110). No hay JSX de referencia
  que las use; sería CSS muerto esperando pantallas que aún no existen.
- **Sí:** formulario de contacto falso, con validación en cliente y terminal de éxito.
  Coherente con la persistencia falsa que ya asumió SPEC 01.
- **No:** Server Action para el contacto. Introduce infraestructura sin destino mientras no
  haya correo ni backend.
- **Sí:** dejar SPEC 01 intacta pese a que sus criterios dicen "En `/`". Es el registro de lo
  que se implementó entonces; este documento deja constancia del cambio de ruta.
- **No:** editar SPEC 01 para que diga `/biblioteca`. Reescribe historia y hace que la spec
  describa algo que no ocurrió así.

---

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| `.reveal` parte con `opacity: 0`. Si el `IntersectionObserver` no llega a ejecutarse (error de hidratación, JS bloqueado), las secciones de `/` y `/acerca` quedan invisibles y la página parece vacía. | El hook se monta en `useEffect` de un componente `"use client"` ya montado. Al verificar el paso 6 se comprueba que las secciones aparecen; si en el futuro se pasa a Server Components, `.reveal` debe empezar visible y ocultarse solo desde JS. |
| Mover la Biblioteca de `/` a `/biblioteca` deja enlaces obsoletos apuntando a la landing. Son cuatro sitios: `Nav`, "VOLVER AL VAULT" del detalle, la redirección de `/auth` y el `MiniCard`/CTA de la nueva home. | El paso 5 actualiza los tres enlaces existentes en el mismo commit que crea la ruta, y `/` queda como `redirect("/biblioteca")` hasta el paso 6. Verificación final: `grep -rn 'href="/"' app/` solo debe devolver el logo y el enlace "Inicio" del `Nav`. |
| Los bloques CSS nuevos redefinen `.divider` (idéntico) y añaden `.btn.press`. Copiar sin revisar duplicaría reglas. | Comprobado al redactar esta spec: son las dos únicas colisiones con `app/globals.css`. Al portar se omite `.divider` y se conserva `.btn.press`. |
| Un componente cliente no puede exportar `metadata`; olvidarlo hace que `next build` falle o que la metadata se ignore en silencio. | `/biblioteca` y `/acerca` se parten en `page.tsx` (servidor) + `*-client.tsx`, según los pasos 5 y 10. |
| La landing es la pantalla más larga del proyecto (~200 líneas de JSX en un solo archivo). | Se construye en cuatro pasos commiteables (6–9). Si al terminar el archivo resulta incómodo, extraer secciones a `app/components/` es refactor mecánico, no parte de esta spec. |
| El hero usa `min-height: calc(100vh - 60px)`, que asume una barra de 60 px. Si el `Nav` cambia de alto, el hero deja de encajar. | Es el valor de la referencia y el `Nav` no se toca en esta spec más allá de sus enlaces. Queda documentado aquí. |

---

## Lo que **no** está en esta spec

- Los bloques CSS `GAMEPAD` y `Theme variants` de la referencia.
- Envío real del formulario de contacto (correo, Server Action, backend).
- Datos reales en el ticker de actividad y en el top de jugadores.
- Reglas `prefers-reduced-motion` para las animaciones de la landing.
- Edición de SPEC 01 para reflejar la nueva ruta de la Biblioteca.
- Tests automatizados.

Cada una de esas, si aterriza, va en su propia spec.
