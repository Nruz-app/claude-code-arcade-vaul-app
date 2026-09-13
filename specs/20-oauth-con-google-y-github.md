# SPEC 20 — OAuth con Google y GitHub

> **Estado:** Implentado
> **Depende de:** SPEC 04, SPEC 19
> **Fecha:** 2026-09-12
> **Objetivo:** encender los botones de Google y GitHub que llevan decorativos desde la SPEC 01, de modo que se pueda entrar y crear cuenta con cualquiera de los dos desde `/auth/login` y `/auth/registro`, reutilizando el canje que ya hace `/auth/confirmar` y sin tocar el esquema.

---

## Por qué existe esta spec

Los botones **GOOGLE** y **GITHUB** están dibujados en la tarjeta de acceso desde la SPEC 01 y no
han hecho nunca nada. La SPEC 04 lo dejó por escrito —«los dos botones de `/auth` siguen siendo
decorativos»— y la SPEC 19 los mantuvo así, con un criterio de aceptación que literalmente exigía
que **no** funcionaran. Dos specs seguidas prometiendo que eso llegaría después.

El problema de un botón decorativo no es que falte una funcionalidad: es que **miente**. Un jugador
que ve «O CONTINÚA CON · GOOGLE» asume que puede entrar con su cuenta de Google, lo pulsa y no pasa
nada. No hay error, no hay aviso, no hay nada. Es el único punto del portal donde la interfaz
promete algo que no existe.

Esta spec lo cierra. Y resulta barata por dos motivos que no eran evidentes al planificarla:

1. **El canje ya está escrito.** `app/auth/confirmar/route.ts`, que la SPEC 19 creó para la
   recuperación de contraseña, hace `exchangeCodeForSession(code)` — que es **exactamente** el paso
   final de OAuth con PKCE. Lo único que le falta es saber a dónde ir después.
2. **El nombre de jugador ya está resuelto.** El trigger `handle_new_user` cae a
   `split_part(email,'@',1)` cuando no hay `username` en los metadatos, que es justo el caso de
   OAuth. Ni migración, ni política nueva, ni tocar la base.

Lo que **no** hace esta spec: redirigir a `/biblioteca` a quien ya tiene sesión y entra en
`/auth/*`. Se habló de meterlo aquí y se dejó fuera a propósito — eso es autorización, no
autenticación, y no comparte ni una línea con lo de abajo.

---

## Alcance

**Dentro:**

- **`app/auth/botones-oauth.tsx`** — componente cliente compartido con los dos botones, su estado
  de espera y su bloque de error. Mismo patrón que `auth-card.tsx` y `errores.ts`: lo que usan dos
  pantallas vive en un solo archivo.
- **`app/auth/confirmar/route.ts` acepta un destino** y gana una guardia contra _open redirect_. El
  destino por defecto sigue siendo `/auth/nueva-password`, así que el flujo de recuperación no
  cambia ni una coma.
- **`/auth/login`**: los dos `<button>` decorativos se sustituyen por el componente real.
- **`/auth/registro`**: aparecen el separador «O CONTINÚA CON» y los mismos dos botones, que hoy no
  están.
- **`app/auth/errores.ts`**: mensajes para el proveedor sin configurar y para la cancelación en la
  pantalla del proveedor.
- **Alta de las dos aplicaciones OAuth** (GitHub Developer Settings y Google Cloud Console) y sus
  Client ID / Secret en el dashboard de Supabase.
- **Documentación**: paso 3c del runbook `supabase/README.md`, más `README.md` y `CLAUDE.md`.

**Fuera de alcance:**

- **Redirigir a `/biblioteca` a quien ya tiene sesión** y entra en `/auth/*`. Es autorización y va
  en su propia spec.
- **Rutas protegidas del portal.** Ninguna, igual que hasta ahora: "JUGAR COMO INVITADO" sigue
  siendo el diseño y `proxy.ts` sigue sin redirigir a nadie.
- **`?next=` como mecanismo general de retorno.** El destino que viaja a `/auth/confirmar` lo
  escribe el propio código, no el usuario; sigue sin haber ninguna pantalla que mande a login y
  espere volver.
- **Pantalla de perfil** para corregir el nombre derivado del correo.
- **`linkIdentity()` manual**, para añadir un proveedor a una cuenta ya iniciada desde una pantalla
  de ajustes. El enlazado automático cubre el caso que importa aquí.
- **Tocar el trigger** para leer `full_name` de Google o `user_name` de GitHub.
- **Más proveedores** (Discord, Twitch y compañía). Dos botones hay dibujados, dos se encienden.
- **Cualquier cambio de esquema**: ni migración, ni `schema.sql`, ni políticas.
- **Pruebas automatizadas.** La suite de Vitest cubre `app/lib/games/`; lo que esta spec exige es
  que siga en verde.
- **Rediseño visual.** Se reutilizan `.social`, `.btn.ghost`, `.auth-divider` y `.auth-error` tal
  como están.

---

## Modelo de datos

**No se introduce ningún dato persistente nuevo.** Ni tabla, ni columna, ni migración, ni clave de
`localStorage`. Supabase guarda la identidad del proveedor en `auth.identities`, que es suya y no
se toca, y el perfil lo sigue creando el trigger de siempre.

Lo único que se añade son dos contratos de código.

### El componente compartido

```ts
// app/auth/botones-oauth.tsx — "use client"

type Proveedor = "google" | "github";

interface BotonesOAuthProps {
  /** A dónde volver tras el canje. Siempre una ruta interna. */
  destino?: string; // por defecto "/biblioteca"
}
```

Los dos botones conservan su texto y sus símbolos actuales (`◆ GOOGLE`, `▣ GITHUB`) y la rejilla
`.social`. Mientras uno está en vuelo, **los dos** quedan deshabilitados: el navegador ya se está
yendo del sitio y pulsar el otro solo abriría una segunda negociación que se va a descartar.

### El destino de `/auth/confirmar`

```
/auth/confirmar?code=<code>&destino=<ruta interna>
```

| Situación                                                           | Qué hace el handler                                                    |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `code` válido, sin `destino`                                        | Canjea y va a `/auth/nueva-password` (el comportamiento de la SPEC 19) |
| `code` válido, `destino` interno                                    | Canjea y va a ese destino                                              |
| `code` válido, `destino` que no empieza por `/`, o empieza por `//` | Canjea y **usa el destino por defecto**, ignorando el parámetro        |
| Sin `code`, o el canje falla                                        | `/auth/login?error=enlace`                                             |
| Vuelve con `error` en la URL en vez de `code`                       | `/auth/login?error=oauth`                                              |

El **destino solo se acepta si es una ruta relativa**: tiene que empezar por `/` y no por `//`.
`//evil.example` es una URL absoluta protocol-relative disfrazada de ruta, y es el error clásico
que convierte un parámetro de redirección en un _open redirect_.

### Mensajes nuevos en `errores.ts`

- `"unsupported provider: provider is not enabled"` → `"ESE ACCESO NO ESTÁ DISPONIBLE TODAVÍA"`

Y en `login-client.tsx`, junto al `ENLACE_INVALIDO` que ya existe, el texto del `?error=oauth`:
`"NO SE COMPLETÓ EL ACCESO CON EL PROVEEDOR"`.

---

## Plan de implementación

Cada paso deja la app ejecutable (`npx tsc --noEmit`, `npm run lint` y `npm run build` sin errores).

1. **`/auth/confirmar` acepta destino.** Leer el parámetro, validarlo con la regla de arriba y
   usarlo como destino del `NextResponse.redirect` tras un canje correcto; si no viene o no pasa la
   validación, `/auth/nueva-password` como hasta ahora.
   Verificación: el flujo de recuperación de contraseña se comporta **exactamente igual** que
   antes; `?destino=/biblioteca` lleva a la biblioteca; `?destino=//evil.example` y
   `?destino=https://evil.example` acaban en el destino por defecto, no fuera del sitio.

2. **`botones-oauth.tsx`, enganchado en login.** Crear el componente con
   `signInWithOAuth({ provider, options: { redirectTo } })`, donde `redirectTo` es
   `${window.location.origin}/auth/confirmar?destino=/biblioteca`. En `login-client.tsx`, sustituir
   el `<div className="social">` de botones muertos por `<BotonesOAuth />`. El separador «O CONTINÚA
   CON» se queda donde está.
   Verificación: pulsar GOOGLE sale del sitio hacia la pantalla de consentimiento del proveedor (o
   pinta el error traducido, si el proveedor todavía no está dado de alta); el botón de correo y el
   de invitado siguen funcionando igual.

3. **Los mismos botones en `/auth/registro`.** Añadir el separador y `<BotonesOAuth />` bajo el
   formulario, antes del enlace «¿YA TIENES CUENTA?».
   Verificación: la pantalla de registro ofrece las tres vías —formulario, Google y GitHub— y sigue
   **sin** botón de invitado.

4. **El camino de vuelta y sus errores.** En el handler, distinguir la vuelta con `error` (el
   usuario canceló o el proveedor rechazó) de la vuelta sin `code`; en `login-client.tsx`, pintar
   `?error=oauth` con su mensaje, igual que ya se hace con `?error=enlace`. Añadir a `errores.ts`
   el mensaje del proveedor no configurado.
   Verificación: cancelar en la pantalla de Google devuelve a `/auth/login` con el mensaje y sin
   sesión; con un proveedor deshabilitado, el botón muestra "ESE ACCESO NO ESTÁ DISPONIBLE TODAVÍA"
   en vez de no hacer nada.

5. **Alta de las aplicaciones y documentación.** En **GitHub** → _Settings → Developer settings →
   OAuth Apps → New_, con la _Authorization callback URL_ que muestra Supabase en la tarjeta del
   proveedor. En **Google** → _Cloud Console → APIs & Services_, pantalla de consentimiento y
   credenciales OAuth, con el mismo _Authorized redirect URI_. Los dos Client ID / Secret van a
   _Authentication → Sign In / Providers_ en Supabase, y cada proveedor se activa ahí. Documentarlo
   como **paso 3c** de `supabase/README.md`, junto a _Confirm email_ (3a) y _Redirect URLs_ (3b), y
   mencionarlo en `README.md` y en la línea de configuración de dashboard de `CLAUDE.md`.
   Verificación: un clon limpio del repositorio, siguiendo solo el README y el runbook, llega a
   tener los dos accesos funcionando.

---

## Criterios de aceptación

**Build y tipos**

- [ ] `npx tsc --noEmit`, `npm run lint` y `npm run build` terminan sin errores.
- [ ] `npm run test:run` sigue en verde: esta spec no toca `app/lib/games/`.
- [ ] La consola del navegador no muestra errores ni avisos de hidratación en `/auth/login` ni en
      `/auth/registro`.
- [ ] No hay ninguna migración nueva ni cambios en `supabase/schema.sql`.

**Entrar y registrarse con proveedor**

- [ ] Pulsar GOOGLE en `/auth/login` lleva a la pantalla de consentimiento de Google.
- [ ] Pulsar GITHUB en `/auth/login` lleva a la de GitHub.
- [ ] Los dos botones están también en `/auth/registro` y hacen lo mismo.
- [ ] Completar el consentimiento aterriza en `/biblioteca` con la sesión iniciada y el nombre en
      el Nav.
- [ ] Una cuenta que entra por primera vez con un proveedor aparece en `auth.users` **y** tiene su
      fila en `public.profiles`, con el nombre derivado del correo en mayúsculas y de ≤10
      caracteres, sin que el cliente haga ningún `insert`.
- [ ] Mientras la negociación está en vuelo, los dos botones quedan deshabilitados.

**Enlazado con la cuenta existente**

- [ ] Entrar con Google usando un correo que **ya tiene cuenta con contraseña** reutiliza el mismo
      `user_id`: no aparece una segunda fila en `auth.users`, el `profiles.username` sigue siendo
      el de antes y las partidas anteriores siguen en `/salon`.
- [ ] Después de eso, la contraseña original **sigue sirviendo** para entrar por el formulario.

**Errores**

- [ ] Cancelar en la pantalla del proveedor devuelve a `/auth/login` con un mensaje que lo explica,
      sin sesión y sin pantalla en blanco.
- [ ] Con un proveedor no configurado en el dashboard, el botón muestra "ESE ACCESO NO ESTÁ
      DISPONIBLE TODAVÍA" en lugar de no hacer nada.
- [ ] `/auth/confirmar?destino=//evil.example` y `?destino=https://evil.example` **no** sacan al
      usuario del sitio.

**Lo que no debe romperse**

- [ ] El flujo de recuperación de contraseña de la SPEC 19 funciona igual: `/auth/recuperar` →
      correo → `/auth/nueva-password` → `/biblioteca`.
- [ ] Entrar y registrarse con correo y contraseña siguen funcionando exactamente igual.
- [ ] "JUGAR COMO INVITADO" sigue navegando a `/biblioteca` sin crear sesión, y sigue **solo** en
      login.
- [ ] Ninguna ruta del portal redirige por falta de sesión; `proxy.ts` no cambia.
- [ ] `app/lib/user-context.tsx` no cambia: `useUser()` mantiene su API.

---

## Decisiones

**Arquitectura**

- **Sí:** reutilizar `/auth/confirmar` en vez de crear `/auth/callback`. Ese handler ya hace
  `exchangeCodeForSession`, que es literalmente el mismo canje que necesita OAuth; duplicarlo
  sería el mismo código en dos archivos, con dos sitios donde arreglar el mismo fallo, y obligaría
  a autorizar una segunda _Redirect URL_ en el dashboard.
- **Sí:** validar el destino aunque hoy lo escriba solo el propio código. Un parámetro de
  redirección sin guardia es la receta del _open redirect_, y el coste de la guardia son dos
  comparaciones de cadena. El día que ese parámetro quede expuesto —y los parámetros de
  redirección siempre acaban expuestos— ya estará protegido.
- **Sí:** un componente compartido para los dos botones. Los usan dos pantallas, y es el mismo
  patrón que la SPEC 19 aplicó a `auth-card.tsx` y `errores.ts`.
- **No:** `skipBrowserRedirect`. Desde el navegador, `signInWithOAuth` navega solo; gestionar la
  URL a mano solo tiene sentido desde el servidor.

**Interfaz**

- **Sí:** los botones también en `/auth/registro`. **Esto revierte una decisión de la SPEC 19**,
  que dejó esa pantalla sin salidas alternativas para no distraer del único objetivo. La razón por
  la que aquella decisión ya no aplica: con OAuth, «continuar con Google» en la pantalla de
  registro **no es una salida alternativa, es la propia acción de registrarse**. Mandar a alguien a
  la pestaña de «iniciar sesión» para crear su cuenta es pedirle que haga lo contrario de lo que
  quiere.
- **Sí:** los dos botones se deshabilitan a la vez mientras uno está en vuelo. El navegador ya se
  está yendo de la página; pulsar el otro abriría una negociación que se va a descartar.
- **No:** esconder el botón de un proveedor que no esté configurado. Habría que preguntar
  `/auth/v1/settings` en cada render para ahorrar un mensaje de error, y ese ajuste puede cambiar
  en el dashboard en cualquier momento.
- **Sí:** el texto y los símbolos de los botones se quedan como están. Llevan dos años dibujados
  así; esta spec los enciende, no los rediseña.

**Datos y cuentas**

- **Sí:** aceptar el nombre derivado del correo. El trigger ya lo hace y no hay que tocar nada.
- **No:** tocar el trigger para leer `full_name` de Google o `user_name` de GitHub. Sería una
  migración de base de datos para mejorar un nombre que, hoy por hoy, el usuario tampoco puede
  editar. Cuando exista la pantalla de perfil, se corrige ahí y se corrigen todos los casos, no
  solo el de OAuth.
- **Sí:** apoyarse en el enlazado automático de identidades de Supabase en vez de gestionarlo. Es
  el comportamiento por defecto, está documentado y hace justo lo que se quiere.
- **No:** `linkIdentity()` desde una pantalla de ajustes. Sirve para añadir un proveedor con un
  correo **distinto**, que es otro caso de uso y necesita una pantalla que no existe.

**Alcance**

- **Sí:** dejar fuera la redirección de `/auth/*` con sesión iniciada, aunque al escribir la SPEC 19
  se anotara para aquí. No comparte una línea de código con OAuth: es autorización, y merece
  decidirse mirando el portal entero y no la tarjeta de acceso.
- **No:** añadir proveedores más allá de los dos dibujados. Cada uno son dos altas fuera de Supabase
  y un botón más en una tarjeta que ya está llena.

---

## Riesgos

| Riesgo                                                                                                                                                                    | Mitigación                                                                                                                                                                                                                                           |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **El enlazado de identidades es automático y silencioso.** Supabase une a un mismo usuario las identidades con el mismo correo. Suena a que puede pisar cuentas.          | Es el comportamiento buscado y solo ocurre con correos verificados. Una cuenta existente con contraseña **conserva su `user_id`, su perfil y sus partidas** al entrar por primera vez con Google. Hay dos criterios de aceptación que lo comprueban. |
| **La configuración fuera de Supabase es la parte larga**, y Google es el peor: exige pantalla de consentimiento en Cloud Console. Mientras no esté, el botón parece roto. | El paso 4 traduce `Unsupported provider: provider is not enabled` a un mensaje que se entiende, en vez del silencio de hoy. El paso 5 documenta el alta completa.                                                                                    |
| **Tercer y cuarto ajuste de dashboard del proyecto**, tras _Confirm email_ y _Redirect URLs_. Cada uno que se añade es otro que se olvida en una mudanza.                 | El runbook ya tiene el sitio y la disciplina: paso 3, que la SPEC 19 partió en 3a y 3b y esta amplía con 3c.                                                                                                                                         |
| **PKCE otra vez**: el canje sigue atado a la cookie del navegador que empezó el flujo.                                                                                    | Es el mismo mecanismo y la misma mitigación que la SPEC 19 ya dejó escrita y probada en `/auth/confirmar`. En OAuth el riesgo es menor: la ida y la vuelta ocurren en la misma pestaña.                                                              |
| **El nombre derivado es feo**: `ruznicolas176@gmail.com` se convierte en `RUZNICOLAS`, y hoy no hay pantalla para cambiarlo.                                              | Asumido por decisión explícita. Queda anotado como el argumento más fuerte a favor de la pantalla de perfil.                                                                                                                                         |
| **El destino del callback es un parámetro de redirección**, y esos son el vector clásico del _open redirect_.                                                             | Solo se aceptan rutas que empiecen por `/` y no por `//`; cualquier otra cosa cae al destino por defecto. Hay criterio de aceptación con los dos casos hostiles.                                                                                     |
| **`/auth/confirmar` pasa a servir dos flujos.** Un cambio pensado para OAuth puede romper la recuperación de contraseña sin que nadie lo note.                            | El destino por defecto es el de la recuperación, así que el flujo antiguo funciona aunque el parámetro no llegue. El paso 1 lo verifica antes de tocar nada más.                                                                                     |

---

## Lo que **no** está en esta spec

- Redirigir a `/biblioteca` a quien ya tiene sesión y entra en `/auth/*`.
- Rutas protegidas del portal.
- `?next=` como mecanismo general de retorno tras iniciar sesión.
- Pantalla de perfil para ver o editar el nombre de jugador.
- `linkIdentity()` para añadir un proveedor con otro correo.
- Cambios en el trigger `handle_new_user` o en cualquier objeto de la base.
- Proveedores más allá de Google y GitHub.
- Pruebas automatizadas de las pantallas de acceso.
- Rediseño visual de la tarjeta.

Cada una de esas, si aterriza, va en su propia spec.
