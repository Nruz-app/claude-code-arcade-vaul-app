# SPEC 03 — Correcciones de layout del hero y visibilidad de contacto

> **Estado:** Implementado
> **Depende de:** SPEC 02
> **Fecha:** 2026-07-24
> **Objetivo:** Corregir dos defectos visuales heredados de SPEC 02 — el indicador "DESLIZA" del hero de `/` que se solapa con los botones CTA, y el formulario de contacto de `/acerca` que queda invisible al cargar por depender del efecto `reveal`.

---

## Alcance

**Dentro:**

- **Home (`/`):** reubicar el indicador `.hero-scroll` ("DESLIZA ▼") para que se ancle al borde
  inferior de `.home-hero` (alto de ventana) en lugar de posicionarse respecto a
  `.home-hero-inner`, eliminando el solape con "EXPLORAR JUEGOS" / "CREAR CUENTA". Cambio en
  `app/page.tsx` (mover el elemento fuera de `.home-hero-inner`) y en `app/globals.css` (ajustar
  `.hero-scroll` de `bottom: -20px` anclado al inner a `bottom` positivo anclado al hero).
- **Acerca de (`/acerca`):** hacer que la sección `.about-contact` (formulario CONTÁCTANOS) sea
  visible al cargar, sin depender del IntersectionObserver. Cambio en
  `app/acerca/about-client.tsx`.

**Fuera de alcance:**

- Rediseñar el patrón `.reveal` a nivel global (que arranque visible y anime solo por JS) en
  todas las secciones de la landing. Se evalúa como decisión, pero no se aplica al resto de
  secciones.
- Reglas `prefers-reduced-motion` (siguen fuera desde SPEC 01/02).
- Cualquier otro ajuste de contenido, datos o comportamiento de las dos pantallas.
- Tests automatizados (sigue sin haber runner).

---

## Modelo de datos

No aplica. Esta spec solo mueve un elemento en el árbol JSX y elimina una clase CSS; no
introduce ni modifica estructuras de datos.

---

## Plan de implementación

Cada paso deja la app ejecutable (`npm run dev` / `npm run build` sin errores) y es commiteable
por sí solo.

1. **Reubicar el indicador DESLIZA en el hero.** En `app/page.tsx`, mover el bloque
   `<div className="hero-scroll">…</div>` para que sea hijo directo de
   `<section className="home-hero">` (fuera de `.home-hero-inner`). En `app/globals.css`, cambiar
   `.hero-scroll` de `bottom: -20px` a `bottom: 24px` (ahora ancla al `.home-hero`, que ya es
   `position: relative`).
   Verificación: a 1280×800 el "DESLIZA ▼" aparece centrado sobre el borde inferior del hero, sin
   tocar los botones CTA; el hero sigue ocupando el alto de ventana.

2. **Hacer visible el formulario de contacto de /acerca.** En `app/acerca/about-client.tsx`,
   quitar la clase `reveal` de `<section className="about-contact reveal">`, dejándola como
   `<section className="about-contact">`. La sección deja de arrancar en `opacity: 0` y se ve al
   cargar.
   Verificación: al cargar `/acerca` (sin scrollear) el formulario CONTÁCTANOS es visible; ya no
   hay hueco negro entre el separador y el footer.

---

## Criterios de aceptación

**Build**

- [ ] `npm run lint` y `npm run build` terminan sin errores ni warnings de tipos.
- [ ] La consola del navegador no muestra errores al cargar `/` y `/acerca`.

**Home (`/`)**

- [ ] El indicador "DESLIZA ▼" no se solapa con los botones "EXPLORAR JUEGOS" ni "CREAR CUENTA"
      en ningún alto de ventana común (probar a 1280×800).
- [ ] "DESLIZA ▼" queda anclado cerca del borde inferior del hero, centrado horizontalmente.
- [ ] El hero sigue ocupando el alto de la ventana (`min-height: calc(100vh - 60px)`) y las
      siluetas pixel siguen animando.
- [ ] A 375 px de ancho la landing no produce scroll horizontal y el indicador no se solapa con
      los CTAs.

**Acerca de (`/acerca`)**

- [ ] Al cargar `/acerca` sin hacer scroll, el formulario CONTÁCTANOS es visible; no hay hueco
      negro entre el separador y el footer.
- [ ] El formulario conserva su comportamiento de SPEC 02: enviar vacío dispara `shake`; enviar
      completo muestra la terminal VAULT-OS; "ENVIAR OTRO MENSAJE" reinicia los campos.
- [ ] El separador animado y el resto de secciones `.reveal` de la landing siguen apareciendo
      con su efecto al entrar en viewport.

---

## Decisiones

**Home**

- **Sí:** mover `.hero-scroll` fuera de `.home-hero-inner` para que ancle al `.home-hero`. El bug
  venía de que el inner solo mide lo que ocupa su contenido; anclar al hero lo lleva al borde
  inferior de la ventana, que es la intención de la referencia.
- **No:** quitar `position: relative` de `.home-hero-inner` para que el scroll ancle al hero sin
  mover el JSX. El inner necesita ese `position` para su `z-index: 3` sobre las siluetas; tocarlo
  arriesga el apilado.
- **No:** eliminar el indicador DESLIZA. Es una pista de scroll útil; el problema era la
  posición, no su existencia.

**Acerca de**

- **Sí:** quitar la clase `reveal` de `.about-contact` para que el formulario sea visible siempre.
  En una página corta, esa sección cae en el pliegue en viewports de ~800 px y el observer no
  dispara al cargar; el contenido central de la pantalla no debe depender de JS para verse.
- **No:** rediseñar `.reveal` global para que arranque visible y anime solo por JS (la mitigación
  que anticipó SPEC 02). Es el arreglo "correcto" a futuro, pero toca todas las secciones de la
  landing y excede el alcance de estas dos correcciones puntuales. Queda como deuda conocida.
- **No:** bajar el `threshold` del IntersectionObserver o forzar un disparo al montar. Sigue
  dejando el contenido oculto un instante y no resuelve el caso de JS bloqueado.
- **Sí:** conservar el `reveal` del separador (`.about-divider`). Sí revela al cargar (queda
  sobre el pliegue) y su animación de píxeles no deja hueco vacío.

---

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Anclar `.hero-scroll` con `bottom: 24px` al `.home-hero` podría solaparse con los CTAs en ventanas muy bajas (<600 px de alto), donde el contenido del inner llena casi toda la altura. | El hero mantiene `padding-bottom: 60px`; a altos comunes (≥700 px) hay separación de sobra. Se verifica a 1280×800 y a 375 px. En ventanas extremadamente bajas es aceptable degradar. |
| Quitar `reveal` de `.about-contact` la deja sin la animación de entrada, creando una leve inconsistencia con el separador que sí anima. | Es intencional: la visibilidad del contenido pesa más que la animación. Documentado en Decisiones. |

---

## Lo que **no** está en esta spec

- Rediseño global del patrón `.reveal` (arrancar visible + animar por JS).
- Reglas `prefers-reduced-motion`.
- Otros ajustes de contenido o comportamiento de `/` y `/acerca`.
- Tests automatizados.

Cada una de esas, si aterriza, va en su propia spec.
