# SPEC 04 — Autenticación real con Supabase

> **Estado:** Aprobado
> **Depende de:** SPEC 01, SPEC 02
> **Fecha:** 2026-08-09
> **Objetivo:** Sustituir el login falso de `app/lib/user-context.tsx` por Supabase Auth con correo y contraseña, leyendo el nombre de jugador de la tabla `public.profiles` que ya existe en el proyecto remoto.

---

## Por qué existe esta spec

El backend ya está provisionado y las dependencias instaladas, pero **ningún archivo de `app/` toca
Supabase todavía**. Lo que ya existe hoy en el repositorio y en el proyecto remoto
`dkyghnxmytbfuopxlefe`:

- `@supabase/ssr@^0.12.4` y `@supabase/supabase-js@^2.112.2` en `package.json`.
- `.env` y `.env.example` con `NEXT_PUBLIC_SUPABASE_URL` y
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- Migración `20260809191140_profiles` aplicada en remoto: tabla `public.profiles`, RLS activo,
  políticas y el trigger `on_auth_user_created`.

Esta spec conecta la aplicación a eso. No crea tablas nuevas.

---

## Alcance

**Dentro:**

- **Clientes de Supabase** en `app/lib/supabase/`: `client.ts` (`createBrowserClient`, para
  componentes `"use client"`) y `server.ts` (`createServerClient` sobre el `cookies()`
  **asíncrono** de Next 16, para Server Components y Route Handlers).
- **`proxy.ts` en la raíz del proyecto** que refresca la cookie de sesión en cada request con
  `getAll`/`setAll`. En Next 16 la convención `middleware.ts` está **deprecada y renombrada a
  `proxy.ts`** (`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`);
  la documentación pública de Supabase todavía dice `middleware.ts`.
- **`app/lib/user-context.tsx` reescrito como fachada de la sesión de Supabase**: `useUser()`
  conserva su nombre y sus consumidores, pero `user` deja de leerse de `localStorage` y pasa a
  venir de `supabase.auth.getUser()` + `onAuthStateChange`, con el nombre resuelto contra
  `profiles.username`.
- **`app/auth/page.tsx` con autenticación real**: el tab INICIAR SESIÓN usa
  `signInWithPassword`; el tab CREAR CUENTA usa `signUp` pasando el nombre de jugador en
  `options.data.username`, que es de donde lo toma el trigger existente.
- **Bloque de error en `/auth`** con los mensajes de Supabase traducidos al español, reutilizando
  la animación `shake` que ya existe en `app/globals.css`.
- **`signOut` real** en `app/components/nav.tsx` (vía el contexto), que llama a
  `supabase.auth.signOut()`.
- **Esquema versionado en el repositorio**: volcar el SQL de la migración ya aplicada a
  `supabase/migrations/20260809191140_profiles.sql`.
- **Configuración de Auth en el dashboard**: desactivar _Confirm email_ para que `signUp`
  devuelva sesión inmediata.

**Fuera de alcance (para specs futuras):**

- **Puntuaciones en la base de datos.** `saveScore()` sigue escribiendo en `localStorage`
  (`av_scores`) y `/salon` sigue usando `seededScores()`. Es la SPEC 05.
- **OAuth con Google y GitHub.** Los dos botones de `/auth` siguen siendo decorativos, como en
  SPEC 01.
- **Sesiones anónimas** (`signInAnonymously`). "JUGAR COMO INVITADO" sigue siendo navegar sin
  sesión.
- **Rutas protegidas.** `proxy.ts` solo refresca la cookie; no redirige a nadie. Todas las rutas
  siguen siendo públicas, incluida `/juego/[id]/jugar`.
- **Recuperación de contraseña, cambio de correo y borrado de cuenta.**
- **Pantalla de perfil** para ver o editar el `username` (la política `UPDATE` de `profiles` ya
  existe, pero no hay UI que la use).
- **Tipos TypeScript generados de la base** (`generate_typescript_types`). Con una sola tabla y
  dos campos leídos, el tipo se escribe a mano.
- **Índice `unique` sobre `profiles.username`.** Hoy dos jugadores pueden llamarse igual.
- **Tests automatizados** (sigue sin haber runner configurado).

---

## Modelo de datos

### Ya existe en remoto — solo se versiona en el repositorio

No se crea ni se altera ninguna tabla. Esto es lo que hay y lo que se vuelca tal cual a
`supabase/migrations/20260809191140_profiles.sql`:

```sql
-- public.profiles
--   id         uuid  primary key  references auth.users(id)
--   username   text  check (char_length(username) between 1 and 10)
--   created_at timestamptz default now()
-- RLS: activo
--   "perfiles legibles por cualquiera"  SELECT  using (true)
--   "cada usuario edita su perfil"      UPDATE  using (auth.uid() = id)

-- trigger on_auth_user_created on auth.users
--   → public.handle_new_user(): inserta en profiles tomando
--     upper(left(coalesce(raw_user_meta_data->>'username',
--                         split_part(email,'@',1)), 10))
```

La consecuencia práctica: **el cliente nunca inserta en `profiles`**. Basta con que `signUp`
mande `options.data.username`; el trigger hace el resto, y ya aplica el `upper()` y el corte a
10 caracteres que hoy hace a mano `app/auth/page.tsx`.

### Cambia en el cliente

```ts
// app/lib/user-context.tsx

export interface User {
  id: string; // uuid de auth.users — lo necesitará la SPEC 05 para las puntuaciones
  name: string; // profiles.username, ya en mayúsculas y ≤10 chars
}

interface UserContextValue {
  user: User | null;
  loading: boolean; // true hasta que se resuelve la sesión inicial
  signOut: () => Promise<void>;
  saveScore: (entry: Omit<StoredScore, "at">) => void; // sin cambios, sigue en localStorage
}
```

Diferencias con SPEC 01:

- **`login()` desaparece** del contexto. `/auth` habla directamente con Supabase y navega.
- **`User` gana `id`.** SPEC 01 solo tenía `name`.
- **La clave `av_user` de `localStorage` deja de usarse** y se borra al arrancar el contexto,
  para no dejar residuos en navegadores que ya la tenían.
- **`av_scores` y `StoredScore` no cambian.** Siguen exactamente como en SPEC 01.

### Estado local de `/auth`

```ts
type AuthTab = "in" | "up";
// email:    string
// password: string
// username: string   → solo en el tab "up"
// error:    string | null   → mensaje ya traducido al español
// busy:     boolean         → deshabilita el botón mientras la petición está en vuelo
// shake:    boolean         → animación de error, se apaga a los 400 ms (igual que /acerca)
```

---

## Plan de implementación

Cada paso deja la app ejecutable (`npm run dev` / `npm run build` sin errores) y es commiteable
por sí solo.

1. **Versionar el esquema y ajustar la configuración de Auth.** Crear
   `supabase/migrations/20260809191140_profiles.sql` con el SQL de la tabla, el `alter table …
enable row level security`, las dos políticas y la función + trigger `handle_new_user`, tal
   como están hoy en remoto. En el dashboard de Supabase, desactivar _Authentication → Sign In /
   Providers → Email → Confirm email_. Verificar que `.env` tiene las dos variables
   `NEXT_PUBLIC_*` y que `.env` está en `.gitignore`.
   Verificación: el archivo SQL existe en el repo y `npm run build` sigue pasando (no se ha
   tocado código todavía).

2. **Clientes de Supabase.** Crear `app/lib/supabase/client.ts` con `createBrowserClient` y
   `app/lib/supabase/server.ts` con `createServerClient`, leyendo las cookies con
   `await cookies()` (en Next 16 `cookies()` es asíncrono) e implementando `getAll`/`setAll`.
   El `setAll` del servidor va envuelto en `try/catch`: desde un Server Component no se pueden
   escribir cookies y ahí es correcto ignorarlo.
   Verificación: `npm run build` compila con tipado strict; los módulos aún no se importan.

3. **Refresco de sesión en `proxy.ts`.** Crear `proxy.ts` en la raíz del proyecto (al mismo nivel
   que `app/`), con la función exportada como `proxy` y un `config.matcher` que excluya
   `_next/static`, `_next/image`, el favicon y los assets de imagen. Dentro: crear un
   `createServerClient` sobre `NextRequest`/`NextResponse` y llamar a `supabase.auth.getUser()`
   para que la cookie se refresque. **No redirige a nadie.**
   Verificación: navegar por la app no cambia nada visible y la consola del servidor no muestra
   errores; en DevTools → Application → Cookies aparecen las cookies `sb-…` tras iniciar sesión
   en el paso siguiente.

4. **`user-context.tsx` como fachada de la sesión, y login real en `/auth`.** Reescribir el
   contexto: al montar, `supabase.auth.getUser()`; si hay usuario, consultar
   `profiles.username` por `id` y guardar `{ id, name }`; suscribirse a `onAuthStateChange` y
   desuscribir en el cleanup; `signOut()` llama a `supabase.auth.signOut()`; borrar la clave
   `av_user`. En `app/auth/page.tsx`, el tab INICIAR SESIÓN pasa a `signInWithPassword({ email,
password })` y, si va bien, `router.push("/biblioteca")` + `router.refresh()`; el campo
   "Usuario" del tab de entrada se convierte en "Correo electrónico" (`type="email"`). El botón
   "JUGAR COMO INVITADO" deja de llamar a `login(null)` y solo navega a `/biblioteca`.
   Verificación: con un usuario ya creado en el dashboard, iniciar sesión aterriza en
   `/biblioteca` y el Nav muestra su `username`; recargar la página lo mantiene.

5. **Crear cuenta.** En el tab CREAR CUENTA, mostrar los tres campos (Usuario, Correo
   electrónico, Contraseña) y llamar a `signUp({ email, password, options: { data: { username } } })`.
   Si `data.session` llega, `router.push("/biblioteca")`; si llega `null` (porque el proyecto
   tuviera _Confirm email_ activo), mostrar el aviso "REVISA TU CORREO PARA CONFIRMAR LA CUENTA"
   en lugar de navegar.
   Verificación: crear una cuenta nueva entra directo a `/biblioteca`; en el dashboard aparece la
   fila en `auth.users` y su `profiles.username` en mayúsculas y de ≤10 caracteres.

6. **Errores en español.** Añadir a `/auth` un mapa de mensajes de Supabase a español
   (`Invalid login credentials` → "CREDENCIALES INCORRECTAS", `User already registered` → "ESE
   CORREO YA TIENE CUENTA", `Password should be at least 6 characters` → "LA CONTRASEÑA NECESITA
   AL MENOS 6 CARACTERES"), con un texto genérico de reserva para cualquier otro caso. Pintar el
   mensaje en un bloque `.auth-error` dentro de la tarjeta y disparar `shake` 400 ms. Añadir la
   regla `.auth-error` a `app/globals.css` reutilizando los tokens del tema (`--magenta`,
   `--line`, `--mono`).
   Verificación: entrar con contraseña incorrecta sacude la tarjeta y muestra "CREDENCIALES
   INCORRECTAS"; registrarse con un correo ya usado muestra su mensaje.

7. **Cierre de sesión y documentación.** Comprobar que el botón del Nav (`{user.name} ▾`) llama
   al `signOut` del contexto y que tras pulsarlo el Nav vuelve a "Iniciar Sesión" sin recargar.
   Añadir al `README.md` una sección breve de puesta en marcha: copiar `.env.example` a `.env`,
   de dónde salen las dos claves y que el esquema está en `supabase/migrations/`.
   Verificación: cerrar sesión y recargar deja la app como invitado; un clon limpio del repo
   arranca siguiendo solo el README.

---

## Criterios de aceptación

**Build y configuración**

- [ ] `npm run lint` y `npm run build` terminan sin errores ni warnings de tipos.
- [ ] La consola del navegador no muestra errores al cargar `/`, `/biblioteca`, `/auth`,
      `/salon`, `/acerca`, `/juego/[id]` ni `/juego/[id]/jugar`.
- [ ] El archivo de sesión se llama `proxy.ts` y está en la raíz del proyecto. **No existe**
      `middleware.ts`.
- [ ] `supabase/migrations/20260809191140_profiles.sql` existe y contiene tabla, RLS, las dos
      políticas y el trigger.
- [ ] `.env` no está versionado; `.env.example` documenta las dos variables `NEXT_PUBLIC_*`.

**Crear cuenta**

- [ ] El tab CREAR CUENTA muestra tres campos: Usuario, Correo electrónico y Contraseña.
- [ ] Registrarse con datos válidos crea la fila en `auth.users` y la fila correspondiente en
      `public.profiles`, sin que el cliente haga ningún `insert`.
- [ ] El `username` guardado está en mayúsculas y tiene como máximo 10 caracteres.
- [ ] Registrarse con datos válidos deja la sesión iniciada y aterriza en `/biblioteca`.
- [ ] Registrarse con un correo ya existente no navega y muestra "ESE CORREO YA TIENE CUENTA".
- [ ] Registrarse con una contraseña de menos de 6 caracteres muestra el mensaje de contraseña
      corta.

**Iniciar sesión**

- [ ] El tab INICIAR SESIÓN pide Correo electrónico (no "Usuario") y Contraseña.
- [ ] Con credenciales correctas la app navega a `/biblioteca` y el Nav muestra el `username`
      del perfil.
- [ ] Con credenciales incorrectas la tarjeta hace `shake` y muestra "CREDENCIALES INCORRECTAS",
      sin navegar.
- [ ] Mientras la petición está en vuelo el botón de envío queda deshabilitado.
- [ ] Recargar cualquier página con sesión iniciada mantiene el nombre en el Nav.
- [ ] Cerrar el navegador y volver a abrirlo mantiene la sesión (la cookie la refresca `proxy.ts`).

**Sesión y cierre**

- [ ] Pulsar el botón del Nav con el nombre cierra la sesión y el botón vuelve a "Iniciar Sesión"
      sin recargar la página.
- [ ] Tras cerrar sesión, recargar la página no restaura al usuario.
- [ ] Un navegador con la clave `av_user` en `localStorage` de la versión anterior **no** aparece
      como logueado; la clave se elimina.

**Lo que no debe romperse**

- [ ] "JUGAR COMO INVITADO" navega a `/biblioteca` y la app funciona sin sesión.
- [ ] Los botones GOOGLE y GITHUB siguen sin hacer nada y no lanzan errores.
- [ ] Ninguna ruta redirige a `/auth` por falta de sesión.
- [ ] `/juego/[id]/jugar` sigue guardando la puntuación en `localStorage` (`av_scores`) al
      terminar, con o sin sesión.
- [ ] `/salon` sigue mostrando los rankings de `seededScores()`.

---

## Decisiones

**Alcance**

- **Sí:** esta spec cubre solo autenticación. Las puntuaciones en base de datos y `/salon` con
  datos reales son otro dominio y van en la SPEC 05. Tres dominios en un documento es una spec
  que nadie revisa.
- **No:** OAuth con Google y GitHub. Requiere configurar providers y URLs de callback en el
  dashboard, y el valor de aprendizaje está en el flujo de correo y contraseña. Los botones
  siguen decorativos, como los dejó SPEC 01.
- **No:** rutas protegidas. La app se diseñó para poder jugar como invitado y `proxy.ts` no es el
  sitio para autorizar (la propia doc de Next lo desaconseja explícitamente:
  _"Proxy should not be used as a full session management or authorization solution"_).
- **No:** sesión anónima de Supabase para el invitado. Ensuciaría `profiles` con filas sin
  nombre y obliga a habilitar _anonymous sign-ins_, a cambio de nada que la app necesite hoy.

**Arquitectura**

- **Sí:** `proxy.ts` en la raíz, no `middleware.ts`. Next 16 renombró la convención; escribir
  `middleware.ts` porque lo dice la guía de Supabase produciría un archivo que Next ignora.
  Este es exactamente el caso que advierte `AGENTS.md`.
- **Sí:** los dos clientes separados (`client.ts` y `server.ts`) del patrón `@supabase/ssr`,
  aunque en esta spec solo se use el de navegador. El de servidor cuesta 20 líneas y es lo que
  la SPEC 05 necesitará para leer puntuaciones desde Server Components.
- **No:** un único `createClient` compartido entre servidor y cliente. Es la fuente clásica de
  fugas de sesión entre peticiones en SSR.
- **Sí:** mantener `useUser()` como fachada. Lo consumen `nav.tsx`, `salon/page.tsx`,
  `juego/[id]/jugar/page.tsx` y `auth/page.tsx`; cambiar la fuente de datos sin cambiar la API
  deja tres de esos cuatro archivos intactos.
- **No:** eliminar el contexto y llamar a Supabase desde cada componente. Duplica la resolución
  del `username` en cada pantalla y deja `saveScore()` sin casa.
- **Sí:** `login()` sale del contexto. Con Supabase, iniciar sesión es una llamada asíncrona con
  su propio error; envolverla en el contexto solo añade una capa que hay que atravesar para
  mostrar el mensaje.
- **Sí:** `User` gana `id`. Es el `uuid` que la SPEC 05 usará como clave foránea de las
  puntuaciones; añadirlo ahora evita tocar el contexto otra vez.

**Datos y backend**

- **Sí:** el `username` viaja en `options.data.username` del `signUp` y lo inserta el trigger.
  El trigger ya existe, ya normaliza a mayúsculas y ya corta a 10 caracteres — replicarlo en el
  cliente sería tener la misma regla en dos sitios.
- **No:** insertar en `profiles` desde el cliente tras registrarse. Requeriría una política
  `INSERT` que hoy no existe y abre una ventana en la que el usuario existe pero no tiene perfil.
- **Sí:** volcar la migración ya aplicada a `supabase/migrations/`. Hoy el esquema solo vive en
  el servidor: si se pierde el proyecto, no hay forma de recrearlo.
- **Sí:** desactivar _Confirm email_. Es un proyecto de clase; la confirmación añade una ruta de
  callback y un estado de espera que no enseñan nada sobre la integración.
- **No:** índice `unique` sobre `profiles.username`. Cambiar el esquema abre la pregunta de qué
  hacer con las colisiones en la UI de registro, y eso es trabajo de otra spec.

**UI**

- **Sí:** el tab de entrada pide correo, no usuario. `signInWithPassword` necesita el correo, y
  entrar con nombre de jugador exigiría una consulta previa a `profiles` (que no expone el
  correo) o una función en la base.
- **Sí:** errores traducidos a mano con un mapa. Supabase los devuelve en inglés y toda la UI del
  proyecto está en español.
- **Sí:** bloque `.auth-error` con `shake`, reutilizando la animación del formulario de
  `/acerca`. El patrón de error del proyecto ya existe; no hace falta inventar otro.
- **No:** terminal VAULT-OS para los errores. Ocupa la tarjeta entera y obliga a un paso extra
  para volver a intentarlo.
- **Sí:** mientras se resuelve la sesión, el Nav muestra "Iniciar Sesión". Es lo que ya hace hoy
  y no requiere CSS nuevo; el parpadeo dura lo que tarda una consulta.
- **No:** un estado de carga con placeholder en el Nav. Añade un tercer estado visual para
  ahorrar un parpadeo de milisegundos.

---

## Riesgos

| Riesgo                                                                                                                                                                                                                            | Mitigación                                                                                                                                                                                                                                 |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| La documentación pública de Supabase para Next.js dice `middleware.ts`. Copiarla al pie de la letra crea un archivo que Next 16 ignora, y la sesión no se refresca: el usuario parece perder la sesión al cabo de una hora.       | El paso 3 nombra el archivo `proxy.ts` explícitamente y hay un criterio de aceptación que verifica que `middleware.ts` **no** existe. La referencia es `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`. |
| `cookies()` es asíncrono en Next 16. Los ejemplos de `@supabase/ssr` que circulan asumen la versión síncrona y fallan en tiempo de compilación o, peor, devuelven una promesa que se lee como objeto vacío.                       | `app/lib/supabase/server.ts` hace `await cookies()`. El paso 2 lo verifica con `npm run build` en modo strict.                                                                                                                             |
| Desactivar _Confirm email_ es configuración del dashboard, no del repositorio. Quien clone el proyecto y apunte a otro proyecto de Supabase tendrá `signUp` devolviendo `session: null` y un registro que aparenta no hacer nada. | El paso 5 trata `data.session === null` como caso explícito y muestra "REVISA TU CORREO PARA CONFIRMAR LA CUENTA". El README documenta el ajuste.                                                                                          |
| `profiles` es legible por cualquiera (`SELECT using (true)`), así que la clave publicable permite listar todos los nombres de jugador.                                                                                            | Es intencional: los rankings de `/salon` son públicos por diseño y un `username` no es dato sensible. El correo vive en `auth.users`, que no es accesible con esa clave.                                                                   |
| No hay `unique` en `profiles.username`: dos jugadores pueden llamarse `PLAYER1` y el Salón de la Fama los mostrará idénticos.                                                                                                     | Aceptado en esta spec y anotado como fuera de alcance. Cuando la SPEC 05 escriba puntuaciones reales, la clave será el `id`, no el nombre.                                                                                                 |
| El `user` llega tras el montaje (consulta asíncrona). Si algún componente lo usara durante el render del servidor, habría desajuste de hidratación.                                                                               | El contexto es `"use client"` y arranca en `null` tanto en SSR como en cliente, igual que en SPEC 01. Ningún Server Component lee la sesión en esta spec.                                                                                  |
| Navegadores con la clave `av_user` de SPEC 01 podrían mostrar un usuario fantasma si el contexto siguiera leyéndola.                                                                                                              | El paso 4 deja de leerla y la elimina al arrancar. Hay un criterio de aceptación para ello.                                                                                                                                                |

---

## Lo que **no** está en esta spec

- Puntuaciones en base de datos y `/salon` con rankings reales (SPEC 05).
- OAuth real con Google y GitHub.
- Sesiones anónimas para el modo invitado.
- Rutas protegidas o redirecciones por falta de sesión.
- Recuperación de contraseña, cambio de correo y borrado de cuenta.
- Pantalla de perfil para editar el `username`.
- Tipos TypeScript generados desde el esquema.
- Índice `unique` sobre `profiles.username`.
- Tests automatizados.

Cada una de esas, si aterriza, va en su propia spec.
