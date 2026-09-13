# SPEC 19 — Pantallas de acceso y recuperación de contraseña

> **Estado:** Implementado
> **Depende de:** SPEC 04
> **Fecha:** 2026-09-11
> **Objetivo:** partir la tarjeta de pestañas de `/auth` en pantallas propias —`/auth/login` y `/auth/registro`— y añadir el flujo de recuperación de contraseña por correo, sin tocar el esquema de Supabase ni cerrar ninguna ruta del portal.

---

## Por qué existe esta spec

La SPEC 04 dejó la autenticación funcionando, y funciona: correo y contraseña reales contra
Supabase, el `username` resuelto por el trigger, los errores traducidos al español y `proxy.ts`
refrescando la cookie. Lo que dejó es **una sola pantalla**: `app/auth/page.tsx`, 218 líneas, una
tarjeta con dos pestañas que conmutan un `useState<"in" | "up">` y un formulario que cambia de
campos y de botón según cuál esté activa.

Eso tiene tres consecuencias que esta spec corrige:

1. **Login y registro no tienen URL.** No se puede enlazar a "crear cuenta" desde ningún sitio, ni
   compartir la pantalla de registro, ni volver a ella con el botón de atrás del navegador. La
   pestaña es estado de React, no navegación: entrar por `/auth` siempre aterriza en INICIAR
   SESIÓN.
2. **No hay `metadata`.** `/auth` es `"use client"` de arriba abajo, así que es la única ruta del
   proyecto sin `title` ni `description` propios — `/biblioteca`, `/acerca` y `/salon` ya siguen el
   patrón `page.tsx` servidor + `*-client.tsx`.
3. **No hay forma de recuperar una contraseña.** La SPEC 04 lo listó explícitamente como fuera de
   alcance. Hoy, un jugador que la olvida pierde su cuenta y sus marcas del Salón de la Fama, que
   están atadas a su `user_id` y no a su correo.

Lo que **no** hace esta spec, aunque se hablara de ello al definirla: OAuth real y redirigir a
`/biblioteca` a quien ya tenga sesión. Son otro dominio —proveedores externos y autorización— y
van en la SPEC 20. Dos specs en vez de una porque la configuración de dashboard que arrastra cada
una es distinta y porque autenticarse y autorizar no son lo mismo.

---

## Alcance

**Dentro:**

- **Cuatro pantallas**, cada una con el patrón `page.tsx` (Server Component con `metadata`) +
  `*-client.tsx` (toda la UI):
  - `/auth/login` — `signInWithPassword`, "JUGAR COMO INVITADO", los botones sociales decorativos
    y el enlace a recuperar.
  - `/auth/registro` — `signUp` con el `username` en `options.data`.
  - `/auth/recuperar` — pide el correo y dispara `resetPasswordForEmail`.
  - `/auth/nueva-password` — fija la contraseña nueva con `updateUser`.
- **Un Route Handler**, `app/auth/confirmar/route.ts`, que canjea el `code` del enlace del correo
  por una sesión (`exchangeCodeForSession`) y redirige.
- **Dos piezas compartidas**, extraídas del page actual sin cambiar su comportamiento:
  - `app/auth/errores.ts` — el mapa `ERRORES` y `traducir()`.
  - `app/auth/auth-card.tsx` — el marco (`.av-auth-wrap`, `.auth-card`, la cabecera con la marca,
    el `shake` y las pestañas), que hoy está copiado dentro del único page.
- **`app/auth/page.tsx` pasa a ser un `redirect("/auth/login")`** de servidor. Los cuatro enlaces
  que apuntan a `/auth` (`app/components/nav.tsx:59` y `:96`, `app/page.tsx:62` y `:227`) siguen
  valiendo tal cual.
- **`app/components/nav.tsx`**: `isAuth` pasa de `pathname === "/auth"` a comparar por prefijo, o
  el enlace de acceso deja de marcarse activo en las pantallas nuevas.
- **`app/globals.css`**: el selector `.auth-tabs button` se amplía a los `<a>`, y se añaden
  `.auth-aviso` (el bloque que hoy va con estilos en línea en el page) y `.auth-link` (el enlace
  de "¿olvidaste tu contraseña?" y los de ida y vuelta entre pantallas).
- **Configuración de dashboard y documentación**: _Authentication → URL Configuration → Redirect
  URLs_ con la URL de `/auth/confirmar`, anotada en el runbook `supabase/README.md` y en el
  `README.md`, más la lista de rutas de `CLAUDE.md`.

**Fuera de alcance:**

- **OAuth real con Google y GitHub** (SPEC 20). Los dos botones siguen decorativos, como los
  dejaron la SPEC 01 y la SPEC 04.
- **Redirigir a `/biblioteca` a quien ya tiene sesión y entra en `/auth/*`** (SPEC 20). Hoy ver la
  pantalla de login con la sesión abierta no rompe nada.
- **Rutas protegidas del portal.** Ninguna. "JUGAR COMO INVITADO" sigue siendo el diseño, y
  `proxy.ts` sigue sin redirigir a nadie.
- **`?next=`**: el destino tras entrar o registrarse sigue siendo siempre `/biblioteca`.
- **Pantalla de perfil** para ver o editar el `username`.
- **Cambio de correo y borrado de cuenta.**
- **Cualquier cambio de esquema**: ni migración, ni `schema.sql`, ni `unique` sobre
  `profiles.username`. El trigger `on_auth_user_created` ya hace todo lo que hace falta.
- **Pruebas automatizadas.** La suite de Vitest cubre `app/lib/games/` y esta spec no toca esa
  carpeta; lo que sí exige es que siga en verde.
- **Rediseño visual.** Las clases del tema (`.auth-card`, `.field`, `.btn`, `.social`,
  `.auth-divider`) se reutilizan tal cual: la tarjeta se ve igual, solo que ahora hay cuatro.

---

## Modelo de datos

**No se introduce ningún dato persistente nuevo.** No hay tabla, ni columna, ni migración, ni
clave de `localStorage`. Lo único que se añade es estado local de pantalla y la firma del marco
compartido.

### El marco compartido

```ts
// app/auth/auth-card.tsx  — "use client"

interface AuthCardProps {
  /** Dispara la animación shake de .auth-card. Lo controla cada pantalla. */
  shake: boolean;
  /** Qué pestaña se marca activa. Ausente en /auth/recuperar y /auth/nueva-password,
   *  que no tienen pestañas. */
  pestanas?: "login" | "registro";
  children: React.ReactNode;
}
```

Las pestañas dejan de ser `<button>` con `onClick` y pasan a ser `<Link href="/auth/login">` y
`<Link href="/auth/registro">`; la activa se decide por la prop, no por estado.

### Estado local de cada pantalla

Todas comparten el mismo trío de la SPEC 04 (`busy`, `error`, `shake`) y el mismo helper `fallar`:

| Pantalla         | Campos                          | Extra                                          |
| ---------------- | ------------------------------- | ---------------------------------------------- |
| `login`          | `email`, `password`             | —                                              |
| `registro`       | `username`, `email`, `password` | `aviso` (el "REVISA TU CORREO" actual)         |
| `recuperar`      | `email`                         | `enviado: boolean`                             |
| `nueva-password` | `password`, `password2`         | `sesion: boolean \| null` (null = comprobando) |

`errores.ts` exporta lo que hoy vive dentro del page, sin tocar el contenido del mapa:

```ts
// app/auth/errores.ts
export function traducir(mensaje: string): string;
```

y se le añaden las claves que puede devolver el flujo nuevo:

- `"new password should be different from the old password"` → `"LA CONTRASEÑA NUEVA TIENE QUE SER
DISTINTA DE LA ANTERIOR"`
- `"auth session missing"` → `"EL ENLACE HA CADUCADO, PÍDELO OTRA VEZ"`

El texto de reserva (`"NO SE PUDO COMPLETAR LA OPERACIÓN"`) no cambia.

---

## Plan de implementación

Cada paso deja la app ejecutable (`npx tsc --noEmit`, `npm run lint` y `npm run build` sin
errores) y es commiteable por sí solo.

1. **Extraer lo compartido sin cambiar nada visible.** Crear `app/auth/errores.ts` con el mapa y
   `traducir()` tal como están hoy, y `app/auth/auth-card.tsx` con el marco: el `div.av-auth-wrap`,
   la tarjeta con su `shake`, la cabecera (marca, `ARCADE VAULT`, `ACCESO AL SISTEMA · v2.6`) y las
   pestañas. `app/auth/page.tsx` sigue siendo la pantalla de pestañas, pero ahora consume las dos
   piezas.
   Verificación: `/auth` se comporta exactamente igual —entrar, registrarse, error con sacudida— y
   `npx tsc --noEmit` está limpio.

2. **`/auth/login`.** `app/auth/login/page.tsx` (Server Component con `metadata`: título "Iniciar
   Sesión") + `login-client.tsx` con `AuthCard pestanas="login"`, los dos campos, el botón "ENTRAR
   AL VAULT", "JUGAR COMO INVITADO", el separador "O CONTINÚA CON" con GOOGLE y GITHUB
   —decorativos, `type="button"`, sin `onClick`— y el enlace "¿OLVIDASTE TU CONTRASEÑA?" bajo el
   formulario. En `app/globals.css`, ampliar `.auth-tabs button` a `.auth-tabs a` (con
   `text-decoration: none` y `display: block`, que un enlace no hereda lo del botón) y añadir
   `.auth-link`.
   Verificación: `/auth/login` entra con credenciales correctas y aterriza en `/biblioteca`; con
   credenciales incorrectas sacude la tarjeta y muestra "CREDENCIALES INCORRECTAS"; la pestaña
   INICIAR SESIÓN está marcada y la otra navega a `/auth/registro`.

3. **`/auth/registro`.** `page.tsx` (título "Crear Cuenta") + `registro-client.tsx` con
   `AuthCard pestanas="registro"`, los tres campos (Usuario con `maxLength={10}`, Correo,
   Contraseña), el botón "CREAR Y JUGAR" y el bloque `.auth-aviso` para el caso
   `data.session === null`. **Sin** invitado y **sin** sociales: la pantalla acaba en un enlace
   "¿YA TIENES CUENTA? INICIAR SESIÓN".
   Verificación: crear una cuenta nueva entra directo a `/biblioteca`, la fila aparece en
   `auth.users` y su `profiles.username` en mayúsculas y de ≤10 caracteres, sin que el cliente
   haga ningún `insert`; un correo repetido muestra "ESE CORREO YA TIENE CUENTA".

4. **`/auth` redirige y el Nav marca por prefijo.** Sustituir el contenido de `app/auth/page.tsx`
   por un Server Component que hace `redirect("/auth/login")` (de `next/navigation`); ahí muere la
   versión con pestañas y el estado `tab`. En `app/components/nav.tsx`, `isAuth` pasa a
   `pathname.startsWith("/auth")`.
   Verificación: `/auth` aterriza en `/auth/login` sin parpadeo intermedio; los cuatro enlaces del
   código llegan a una pantalla viva; el enlace de acceso del Nav se marca activo en las cuatro
   rutas nuevas.

5. **`/auth/recuperar`.** `page.tsx` (título "Recuperar Contraseña") + cliente con un solo campo y
   el botón "ENVIAR ENLACE", que llama a
   `supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/auth/confirmar` })`.
   **El resultado se muestra igual haya cuenta o no**: el bloque `.auth-aviso` con "SI ESE CORREO
   TIENE CUENTA, TE HEMOS ENVIADO UN ENLACE", y el formulario se sustituye por él. Los errores de
   red o de límite de envíos sí se pintan en `.auth-error`. Un enlace de vuelta a `/auth/login`.
   Verificación: pedir el enlace con un correo registrado hace llegar el correo; con uno
   inexistente la pantalla dice exactamente lo mismo y no hay forma de distinguir los dos casos
   desde el navegador.

6. **`/auth/confirmar`.** Route Handler `app/auth/confirmar/route.ts` con un `GET` que lee el
   `code` de la query, crea el cliente de servidor (`app/lib/supabase/server.ts` — en un Route
   Handler sí se pueden escribir cookies, a diferencia de un Server Component) y llama a
   `exchangeCodeForSession(code)`. Si va bien, `NextResponse.redirect` a `/auth/nueva-password`. Si
   no hay `code` o el canje falla, redirige a `/auth/login?error=enlace`, y `login-client.tsx`
   pinta ese caso como "EL ENLACE NO ES VÁLIDO O SE ABRIÓ EN OTRO NAVEGADOR".
   Verificación: pulsar el enlace del correo en el mismo navegador que lo pidió aterriza en
   `/auth/nueva-password` con sesión; pegar la URL en otro navegador aterriza en `/auth/login` con
   el mensaje, sin pantalla en blanco ni error de servidor.

7. **`/auth/nueva-password`.** `page.tsx` (título "Nueva Contraseña") + cliente que al montar
   comprueba `supabase.auth.getUser()`; si no hay usuario, pinta el error y un enlace a
   `/auth/recuperar` en vez del formulario. Con sesión: dos campos (contraseña y repetición,
   comparados en cliente antes de enviar) y `updateUser({ password })`; al terminar,
   `router.push("/biblioteca")` + `router.refresh()`.
   Verificación: fijar una contraseña nueva permite volver a entrar con ella desde `/auth/login`,
   y la anterior deja de funcionar; entrar en `/auth/nueva-password` a pelo, sin venir del correo,
   muestra el error y no un formulario que no va a poder guardar nada.

8. **Dashboard y documentación.** En Supabase, _Authentication → URL Configuration → Redirect
   URLs_: añadir `http://localhost:3000/auth/confirmar` (y la URL de producción si la hay).
   Documentarlo como paso del runbook de mudanza en `supabase/README.md`, junto al de _Confirm
   email_, y mencionarlo en el `README.md`. Actualizar en `CLAUDE.md` la lista de rutas del App
   Router, que hoy dice `/auth` a secas.
   Verificación: un clon limpio del repo, siguiendo solo el README y el runbook, tiene el flujo de
   recuperación funcionando de punta a punta.

---

## Criterios de aceptación

**Build y tipos**

- [ ] `npx tsc --noEmit`, `npm run lint` y `npm run build` terminan sin errores ni warnings.
- [ ] `npm run test:run` sigue en verde (348 pruebas): esta spec no toca `app/lib/games/`.
- [ ] La consola del navegador no muestra errores ni avisos de hidratación en ninguna de las
      cuatro pantallas nuevas.
- [ ] Los cuatro `page.tsx` nuevos son Server Components y exportan `metadata`; ninguno lleva
      `"use client"`.
- [ ] No existe `app/auth/page.tsx` con estado de pestañas: es un `redirect`.
- [ ] `git status` no muestra archivos formateados de rebote (solo lo tocado en esta spec).

**Rutas y navegación**

- [ ] `/auth` redirige a `/auth/login`.
- [ ] Los cuatro enlaces existentes a `/auth` (`nav.tsx` ×2, `app/page.tsx` ×2) siguen llegando a
      la pantalla de login.
- [ ] Desde `/auth/login` la pestaña CREAR CUENTA navega a `/auth/registro`, y viceversa.
- [ ] El botón de atrás del navegador vuelve de registro a login, y la URL refleja siempre la
      pantalla visible.
- [ ] El enlace de acceso del Nav se marca activo en las cuatro rutas de `/auth/*`.

**Iniciar sesión**

- [ ] Con credenciales correctas navega a `/biblioteca` y el Nav muestra el `username` del perfil.
- [ ] Con credenciales incorrectas la tarjeta hace `shake`, muestra "CREDENCIALES INCORRECTAS" y no
      navega.
- [ ] Mientras la petición está en vuelo el botón queda deshabilitado.
- [ ] "JUGAR COMO INVITADO" navega a `/biblioteca` sin crear sesión.
- [ ] Los botones GOOGLE y GITHUB no hacen nada y no lanzan errores en consola.

**Crear cuenta**

- [ ] Muestra tres campos: Usuario, Correo electrónico y Contraseña.
- [ ] Registrarse con datos válidos crea la fila en `auth.users` y la de `public.profiles`, con el
      `username` en mayúsculas y ≤10 caracteres, sin ningún `insert` desde el cliente.
- [ ] Registrarse con datos válidos deja la sesión iniciada y aterriza en `/biblioteca`.
- [ ] Un correo ya registrado muestra "ESE CORREO YA TIENE CUENTA" y no navega.
- [ ] Una contraseña de menos de 6 caracteres muestra su mensaje.
- [ ] La pantalla **no** tiene botón de invitado ni botones sociales.

**Recuperar contraseña**

- [ ] `/auth/login` lleva un enlace visible a `/auth/recuperar`.
- [ ] Pedir el enlace con un correo registrado envía el correo.
- [ ] Pedir el enlace con un correo inexistente muestra **el mismo** mensaje, en el mismo tiempo,
      sin ninguna diferencia observable desde el navegador.
- [ ] El enlace del correo aterriza en `/auth/nueva-password` con sesión ya establecida.
- [ ] Fijar la contraseña nueva redirige a `/biblioteca` y permite volver a entrar con ella; la
      anterior deja de funcionar.
- [ ] Las dos contraseñas que no coinciden se rechazan en cliente, sin llamar a Supabase.
- [ ] Abrir el enlace en un navegador distinto del que lo pidió aterriza en `/auth/login` con un
      mensaje que lo explica, no en una pantalla rota.
- [ ] Entrar directamente en `/auth/nueva-password` sin sesión muestra el error y un enlace para
      pedir otro correo.

**Lo que no debe romperse**

- [ ] Ninguna ruta del portal redirige a login por falta de sesión: `/`, `/biblioteca`,
      `/juego/[id]`, `/juego/[id]/jugar`, `/salon` y `/acerca` siguen abiertas al invitado.
- [ ] `proxy.ts` sigue sin redirigir a nadie y sigue llamando a `supabase.auth.getUser()`.
- [ ] `app/lib/user-context.tsx` no cambia: `useUser()` mantiene su API y sus consumidores.
- [ ] Cerrar sesión desde el Nav sigue funcionando y devuelve el botón a "Iniciar Sesión".
- [ ] No hay ninguna migración nueva en `supabase/migrations/` ni cambios en `supabase/schema.sql`.

---

## Decisiones

**Estructura de rutas**

- **Sí:** anidar bajo `/auth` (`/auth/login`, `/auth/registro`) en vez de `/login` y `/registro` de
  primer nivel. Mantiene el dominio de acceso agrupado en una carpeta, deja sitio natural al Route
  Handler del callback y evita tener que repasar todos los enlaces del proyecto.
- **Sí:** `/auth` redirige en lugar de desaparecer. Hay cuatro enlaces en el código y cualquier
  marcador que alguien tuviera guardado; un `redirect()` de tres líneas los cubre todos y cuesta
  menos que mantener la lista de enlaces sincronizada.
- **No:** dejar `/auth` con las pestañas funcionando en paralelo a las rutas nuevas. Serían tres
  pantallas haciendo lo mismo y dos sitios donde arreglar el mismo error.
- **Sí:** `login` en inglés y el resto en español (`registro`, `recuperar`, `nueva-password`).
  "Login" es un préstamo asentado y se reconoce de un vistazo en la barra de direcciones; el resto
  sigue la regla de idioma del proyecto.

**Componentes**

- **Sí:** el marco compartido es un componente cliente (`auth-card.tsx`) y no un `layout.tsx`. El
  `shake` es estado de cada pantalla y tiene que llegar a la clase de la tarjeta; un layout de Next
  no recibe props de sus hijos, así que habría que subir el estado a un contexto para ahorrar
  cuatro líneas de JSX.
- **Sí:** las pestañas se conservan, ahora como `<Link>`. El aspecto de la tarjeta no cambia y
  pasan a ser navegación real en vez de `useState` — que es justo el problema que abre esta spec.
- **Sí:** patrón `page.tsx` servidor + `*-client.tsx`, como `/acerca` y `/salon`. Es lo que
  `CLAUDE.md` fija para rutas nuevas y es lo que permite tener `metadata`.
- **Sí:** `errores.ts` como módulo aparte. Cuatro pantallas traduciendo los mismos mensajes con
  cuatro copias del mapa es la forma garantizada de que se desincronicen.

**Flujo de recuperación**

- **Sí:** enlace por correo, con `resetPasswordForEmail` + `exchangeCodeForSession` en un Route
  Handler. Es el flujo PKCE estándar de `@supabase/ssr` y funciona **con la plantilla de correo por
  defecto**, sin tocar nada más que las _Redirect URLs_.
- **No:** `verifyOtp` con `token_hash`. Obliga a editar la plantilla del correo en el dashboard
  para que apunte a `/auth/confirmar?token_hash=…&type=recovery`, y eso es configuración que el
  repositorio no puede versionar: se perdería en la primera mudanza de proyecto.
- **No:** código de 6 dígitos tecleado en la propia pantalla. Encajaría mejor con la estética
  arcade, pero arrastra la misma edición de plantilla y además un campo más que validar.
- **Sí:** el Route Handler usa el cliente de servidor de `app/lib/supabase/server.ts`. En un Route
  Handler el `setAll` sí puede escribir cookies —el `try/catch` que lo protege existe por los
  Server Components— y es lo que deja la sesión puesta antes del redirect.
- **Sí:** mensaje idéntico haya cuenta o no en `/auth/recuperar`. Responder distinto convierte la
  pantalla en un enumerador de cuentas: cualquiera podría averiguar qué correos están registrados.
- **Sí:** la pantalla de contraseña nueva pide la repetición. Es la única del flujo donde el
  usuario no puede comprobar lo que escribió volviendo a intentarlo: si se equivoca, queda fuera
  hasta pedir otro correo.

**Alcance**

- **Sí:** trocear en dos specs. OAuth trae dos proveedores con sus URLs de callback y la pregunta
  del `username`; redirigir a quien ya tiene sesión es autorización, no autenticación. Los cuatro
  dominios en un documento dan una spec que nadie revisa entera.
- **Sí:** el destino tras entrar sigue siendo `/biblioteca`, sin `?next=`. Hoy nada envía al
  usuario a login desde otra pantalla, porque no hay rutas protegidas: un parámetro de retorno
  sería código sin ningún llamante, y validarlo para no abrir un _open redirect_ es trabajo que
  corresponde a la SPEC 20.
- **Sí:** invitado y sociales solo en `/auth/login`. El registro tiene un único objetivo —que el
  usuario termine de registrarse— y tres salidas alternativas juegan en su contra.
- **No:** tocar el esquema. Ni `unique` sobre `username`, ni columnas nuevas. El trigger
  `on_auth_user_created` ya resuelve el nombre y esta spec no le da un caso que no cubra.
- **No:** pruebas automatizadas de estas pantallas. La suite de Vitest se montó para la lógica de
  los motores, que no depende de React ni de red; probar cuatro formularios que hablan con Supabase
  pide un runner de integración que el proyecto no tiene, y montarlo es una spec en sí misma.

---

## Riesgos

| Riesgo                                                                                                                                                                                                              | Mitigación                                                                                                                                                                             |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **PKCE ata el enlace al navegador.** El verificador se guarda en una cookie del navegador que pidió el reset; abrir el correo en el móvil habiendo pedido el enlace en el escritorio hace fallar el canje.          | El paso 6 trata el fallo como caso explícito y redirige a `/auth/login?error=enlace` con un mensaje que dice que hay que abrirlo donde se pidió. Hay criterio de aceptación para ello. |
| **Límite de correos.** El SMTP por defecto de Supabase permite muy pocos envíos por hora; probando el flujo se agota enseguida y los envíos empiezan a fallar.                                                      | `"email rate limit exceeded"` ya está en el mapa de `errores.ts` y se pinta como "DEMASIADOS INTENTOS, PRUEBA EN UN RATO". Es limitación del plan, no un fallo del código.             |
| **_Redirect URLs_ es configuración de dashboard**, igual que _Confirm email_ en la SPEC 04. Sin ella, Supabase ignora el `redirectTo` y manda al Site URL: el enlace "funciona" pero no lleva a ninguna parte útil. | Paso 8: queda documentado en `supabase/README.md`, que es el runbook de mudanza, con la misma disciplina que el resto de ajustes que el repo no puede fijar.                           |
| **Canjear el enlace deja sesión iniciada.** Quien tenga acceso al correo entra en la cuenta, aunque no complete el cambio de contraseña.                                                                            | Es el comportamiento estándar de Supabase y no se puede desactivar desde el cliente. Asumido y escrito aquí para que nadie lo descubra por sorpresa.                                   |
| **_Confirm email_ está desactivado en el proyecto.** Puede parecer que eso apaga también los correos de recuperación y que el flujo no se puede probar.                                                             | Son plantillas y ajustes distintos: la recuperación funciona con _Confirm email_ desactivado. Anotado en el paso 8.                                                                    |
| **El Nav marca activo por igualdad exacta** (`pathname === "/auth"`). Al mover las pantallas, el enlace de acceso dejaría de resaltarse y nadie lo notaría en una revisión de código.                               | Paso 4, con criterio de aceptación propio que comprueba las cuatro rutas.                                                                                                              |
| **`npm run format:check` ya falla** en unos quince archivos anteriores al hook de Prettier. Un rojo tras esta spec puede confundirse con algo roto.                                                                 | `CLAUDE.md` ya lo advierte: no lanzar `format` global antes de un commit, comprobar si los archivos que salen son de este cambio. Hay criterio de aceptación sobre el diff.            |

---

## Lo que **no** está en esta spec

- OAuth real con Google y GitHub (SPEC 20).
- Redirigir a `/biblioteca` a quien ya tiene sesión y entra en `/auth/*` (SPEC 20).
- Rutas protegidas del portal: no hay ninguna, y el modo invitado sigue siendo el diseño.
- `?next=` o cualquier destino distinto de `/biblioteca` tras entrar.
- Pantalla de perfil para ver o editar el `username`.
- Cambio de correo y borrado de cuenta.
- Índice `unique` sobre `profiles.username`.
- Migraciones, `schema.sql` o cualquier cambio en la base de datos.
- Pruebas automatizadas de las pantallas de acceso.
- Rediseño visual de la tarjeta.

Cada una de esas, si aterriza, va en su propia spec.
