# SPEC 22 — Endurecimiento de seguridad

> **Estado:** Implementado
> **Depende de:** SPEC 04, SPEC 06, SPEC 07, SPEC 15, SPEC 19, SPEC 20
> **Fecha:** 2026-09-12
> **Objetivo:** cerrar el checklist de seguridad básico —cabeceras HTTP en Next, la función del trigger fuera de la API pública, y la política de contraseñas y el límite de registros de Supabase— sin añadir ni una tabla, ni una ruta, ni una dependencia.

---

## Por qué existe esta spec

El portal lleva veintiuna specs creciendo hacia afuera: pantallas, juegos, sonido, skins, mando,
OAuth. La seguridad se fue resolviendo por el camino y **por partes**: la SPEC 04 puso la RLS en
`profiles`, la 06 en `game_sessions` con la política de inserción atada a `auth.uid()`, la 07 hizo
la vista `security_invoker`, la 15 dejó un `schema.sql` que lo reproduce todo, la 19 documentó los
dos ajustes de dashboard que el repo no puede fijar y la 20 añadió la guardia contra _open
redirect_ en `/auth/confirmar`.

Lo que nunca ha habido es **una pasada mirando el conjunto**. El checklist de
`references/security/security-checklist.md` es esa pasada, y al contrastarlo con el estado real del
proyecto salen tres tipos de cosas muy distintas:

| Ítem del checklist                      | Estado real, comprobado                                                                                                                      |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| RLS en las tablas                       | **Ya está.** `profiles` y `game_sessions` la tienen activada y la vista usa `security_invoker`. Los advisors no reportan ni un ERROR de RLS. |
| Cabeceras de seguridad en Next          | **No existe ninguna.** `next.config.ts` solo lleva `allowedDevOrigins`.                                                                      |
| `handle_new_user` es `SECURITY DEFINER` | **Dos WARN.** Es invocable por `anon` y por `authenticated` en `/rest/v1/rpc/handle_new_user`.                                               |
| _Leaked password protection_            | **Un WARN.** Desactivada.                                                                                                                    |
| _Minimum password length_               | Sin tocar: Supabase viene con 6.                                                                                                             |
| _Max signup rate_ por IP                | Sin tocar: el valor por defecto.                                                                                                             |

La RLS **no se toca**: esta spec la afirma en sus criterios de aceptación y sigue. Lo demás sí, y
hay un detalle que solo se ve mirando los privilegios de verdad. La ACL actual de la función es:

```
{=X/postgres, postgres=X/postgres, anon=X/postgres, authenticated=X/postgres, service_role=X/postgres}
```

El `=X/postgres` del principio es **PUBLIC**: cualquier rol tiene `EXECUTE`. Además hay tres grants
explícitos que pone Supabase por defecto. Revocar solo a `anon` y a `authenticated` —que es lo que
piden literalmente los dos WARN— **dejaría el permiso de PUBLIC en pie** y el linter seguiría
avisando. El revoke tiene que cubrir los cuatro.

Y hay dos efectos colaterales que esta spec existe para que no pasen en silencio:

1. **Subir el mínimo a 8 rompe una traducción.** `app/auth/errores.ts` tiene la clave literal
   `"password should be at least 6 characters"`. Con el mínimo en 8, Supabase manda «…at least 8
   characters», la clave no casa, y el usuario lee el genérico «NO SE PUDO COMPLETAR LA OPERACIÓN».
   Es decir: activar la medida **empeora** la interfaz si no se toca el código.
2. **La protección anti-filtradas introduce un error nuevo**, el de HaveIBeenPwned, que hoy no
   está traducido y cae en el mismo genérico. Alguien con una contraseña filtrada vería un rechazo
   que no explica nada y no sabría que basta con cambiarla.

Por eso las tres medidas de contraseña no son «un clic en el dashboard»: son un clic **y** cuatro
cadenas en `errores.ts`.

---

## Alcance

**Dentro:**

- **`next.config.ts`** — cinco cabeceras de seguridad aplicadas a todas las rutas con la función
  `headers()` de la configuración de Next.
- **Nueva migración en `supabase/migrations/`** — `revoke` de `execute` sobre
  `public.handle_new_user()` a `public`, `anon`, `authenticated` y `service_role`.
- **`supabase/schema.sql`** — el mismo revoke reflejado en su sección 4, en **este mismo cambio**,
  por la regla de sincronía de `CLAUDE.md`.
- **`app/auth/errores.ts`** — el mínimo de contraseña como constante exportada, la clave de «6
  characters» actualizada a 8, y los mensajes de contraseña filtrada y de límite de peticiones.
- **`app/auth/registro/registro-client.tsx`** y **`app/auth/nueva-password/nueva-password-client.tsx`**
  — `minLength` en los campos y una guardia previa al envío, para no gastar un viaje a la red en
  una contraseña que ya se sabe corta.
- **`scripts/db-check.mjs`** — una comprobación más: que la función del trigger **no** se pueda
  invocar por REST con la publishable key.
- **Tres ajustes en el dashboard de Supabase** (_Minimum password length_ = 8, _Leaked password
  protection_ activada, límite de _sign ups / sign ins_ por hora y por IP bajado a 10), y su
  documentación como **paso 3d** del runbook.
- **Documentación**: `supabase/README.md` (paso 3d y una fila nueva en la tabla de diagnóstico del
  paso 5), `README.md` y `CLAUDE.md`.

**Fuera de alcance:**

- **Content-Security-Policy**, en modo bloqueo o en `Report-Only`. Una CSP decente para Next
  necesita un nonce por petición generado en `proxy.ts`, y ese nonce **fuerza render dinámico en
  todas las rutas**: adiós al prerenderizado de `/`, `/biblioteca` y `/acerca`. Además hay que
  auditar los estilos inline que inyecta Next y las dos fuentes de `fonts.googleapis.com`. Es una
  spec propia, con su propia verificación.
- **CAPTCHA** (hCaptcha o Turnstile) en el registro. Es un proveedor externo más, una clave más en
  `.env`, un ajuste más de dashboard y tocar los formularios. El límite por IP cubre el caso que
  importa hoy.
- **Rutas protegidas o autorización en `proxy.ts`.** Todas las rutas siguen siendo públicas, igual
  que desde la SPEC 04, y «JUGAR COMO INVITADO» sigue siendo el diseño.
- **Volver a tocar la RLS.** Ya está puesta y los advisors lo confirman. Esta spec la **verifica**,
  no la cambia.
- **La puntuación autodeclarada.** El juego corre en el navegador; la RLS garantiza quién escribe,
  no que el dato sea cierto. Asumido a conciencia desde la SPEC 06 y no se reabre aquí.
- **Indicador de fuerza de contraseña**, requisitos de caracteres (mayúsculas, dígitos, símbolos),
  2FA, rotación de claves y auditoría de dependencias.
- **Pantalla de perfil** ni ningún cambio en `app/lib/user-context.tsx`.
- **Pruebas automatizadas nuevas de Vitest.** La suite cubre `app/lib/games/`; lo que esta spec
  exige es que siga en verde. La verificación de lo de aquí es `npm run db:check`, los advisors y
  los criterios manuales.

---

## Modelo de datos

**No se introduce ningún dato persistente nuevo.** Ni tabla, ni columna, ni vista, ni política, ni
clave de `localStorage`. Lo único que cambia en la base de datos son **privilegios** sobre una
función que ya existe.

### El revoke

```sql
revoke all on function public.handle_new_user() from public, anon, authenticated, service_role;
```

Qué cambia y qué no:

| Cosa                                                              | Antes      | Después                    |
| ----------------------------------------------------------------- | ---------- | -------------------------- |
| `security definer` y `set search_path = ''` en la función         | Sí         | **Sí, igual** (no se toca) |
| El trigger `on_auth_user_created` sobre `auth.users`              | Activo     | **Activo, igual**          |
| `EXECUTE` para PUBLIC / `anon` / `authenticated` / `service_role` | Concedido  | **Revocado**               |
| `/rest/v1/rpc/handle_new_user` con la publishable key             | Alcanzable | **No alcanzable**          |
| Propietario (`postgres`) y su `EXECUTE`                           | Sí         | **Sí, igual**              |

La función **sigue siendo `SECURITY DEFINER` y tiene que serlo**: se dispara dentro de la
transacción del registro, cuando todavía no hay sesión que satisfaga ninguna política de
`profiles`. Lo que no tiene sentido es que además esté publicada como endpoint RPC, que es lo que
pasa por el grant por defecto y no por una decisión de nadie.

### Las cinco cabeceras

```ts
// next.config.ts
const CABECERAS_DE_SEGURIDAD = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];
```

Aplicadas con `source: "/(.*)"`, que es lo que documenta
`node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/headers.md`.
`allowedDevOrigins` se queda donde está.

### Los textos de `errores.ts`

| Clave (lo que manda Supabase, en minúscula y sin puntuación final) | Texto en pantalla                                    |
| ------------------------------------------------------------------ | ---------------------------------------------------- |
| `password should be at least 8 characters`                         | `LA CONTRASEÑA NECESITA AL MENOS 8 CARACTERES`       |
| el de HaveIBeenPwned                                               | `ESA CONTRASEÑA APARECE EN FILTRACIONES, ELIGE OTRA` |
| el de límite de peticiones por IP                                  | `DEMASIADOS INTENTOS DESDE AQUÍ, PRUEBA MÁS TARDE`   |

La clave de «6 characters» **se sustituye, no se conserva**: con el mínimo en 8 ese mensaje ya no
puede llegar, y dejarlo sería documentación falsa dentro del código.

> Las dos claves nuevas hay que **copiarlas del mensaje literal que devuelva el proyecto**, no de
> memoria: `traducir()` casa por cadena exacta (recortada, en minúsculas y sin `.` ni `!` final).
> El paso 4 del plan incluye provocar los dos errores a propósito y leer el `error.message` real.

### La constante del mínimo

```ts
// app/auth/errores.ts
export const MIN_PASSWORD = 8;
```

Vive **en `errores.ts` y no en un archivo nuevo** a propósito: es el mismo número que aparece en el
mensaje de error de dos líneas más arriba, y tenerlos separados es tener dos sitios donde cambiar
un 8 y la garantía de que un día solo se cambiará uno.

---

## Plan de implementación

Cada paso deja la app ejecutable (`npx tsc --noEmit`, `npm run lint` y `npm run build` sin errores).

1. **Las cabeceras.** Añadir `CABECERAS_DE_SEGURIDAD` y `async headers()` a `next.config.ts`.
   Verificación: `curl -I http://localhost:3000/` y `curl -I` sobre un estático de `/public`
   (`/snake-fruits.png`) muestran las cinco; `/`, `/biblioteca`, `/juego/rocas/jugar` y `/salon`
   se ven y se juegan igual, y la consola del navegador no protesta por ningún recurso bloqueado.

2. **El revoke.** Crear la migración en `supabase/migrations/` con el `revoke all` de arriba y su
   comentario, aplicarla, y reflejarla en la sección 4 de `supabase/schema.sql` junto a la función,
   con el recuento de objetos del encabezado actualizado.
   Verificación, **en este orden**: (a) **registrarse con una cuenta nueva y comprobar que aparece
   su fila en `public.profiles`** —es la puerta del paso, porque es justo lo que un revoke mal
   puesto rompería—; (b) `POST /rest/v1/rpc/handle_new_user` con la publishable key ya no llega a
   ejecutarse; (c) una pasada de advisors de seguridad: los dos WARN de `SECURITY DEFINER` han
   desaparecido; (d) `schema.sql` ejecutado dos veces seguidas no da error.

3. **Los tres ajustes del dashboard, y el paso 3d del runbook.** En _Authentication → Sign In /
   Providers → Email_: _Minimum password length_ a 8 y _Leaked password protection_ activada. En
   _Authentication → Rate Limits_: el límite de registros e inicios de sesión por hora y por IP a 10. Documentarlo como **paso 3d** de `supabase/README.md`, junto a 3a (_Confirm email_), 3b
   (_Redirect URLs_) y 3c (Google y GitHub), y actualizar la línea de `CLAUDE.md` que hoy dice que
   son tres ajustes.
   Verificación: el advisor `auth_leaked_password_protection` desaparece; una contraseña de 7
   caracteres se rechaza desde el servidor; `123456789` se rechaza por filtrada.

4. **Los mensajes y la validación en el cliente.** En `errores.ts`, exportar `MIN_PASSWORD`,
   sustituir la clave de «6» y añadir las dos nuevas con el literal real observado en el paso 3. En
   `registro-client.tsx` y `nueva-password-client.tsx`, `minLength={MIN_PASSWORD}` en los campos de
   contraseña y una guardia antes del `await`, con el mismo patrón que el «LAS CONTRASEÑAS NO
   COINCIDEN» que ya existe en la segunda.
   Verificación: escribir 7 caracteres y enviar pinta el aviso **sin** ninguna petición en la
   pestaña de red; una contraseña filtrada de 9 caracteres sí sale a la red y vuelve con su mensaje
   en español; el orden de comprobaciones en `/auth/nueva-password` avisa primero de que son
   cortas y solo después de que no coinciden, o al revés, pero **siempre el mismo**.

5. **`npm run db:check` cierra el círculo.** Una fase más, después de la de «RLS: insert anónimo»,
   que hace `POST /rest/v1/rpc/handle_new_user` con la publishable key y exige que **no** se pueda
   ejecutar: vale `PGRST202`/404 (PostgREST ya no la publica) o `42501` (privilegio insuficiente).
   **Ojo con el falso verde**: hoy, sin el revoke, esa llamada ya falla con `0A000` («trigger
   functions can only be called as triggers»), así que ese código concreto cuenta como **FALLO** —
   significa que la función sigue expuesta y que lo único que la salva es su tipo de retorno. El
   código exacto se confirma ejecutando la llamada antes y después del paso 2. Añadir su fila a la
   tabla de diagnóstico del paso 5 del runbook.
   Verificación: `npm run db:check` pasa contra el proyecto con el revoke aplicado, y el mensaje
   que da contra uno sin él dice qué hacer y apunta al paso 2.

---

## Criterios de aceptación

**Build, tipos y no-regresión**

- [ ] `npx tsc --noEmit`, `npm run lint` y `npm run build` terminan sin errores.
- [ ] `npm run test:run` sigue en verde: esta spec no toca `app/lib/games/`.
- [ ] Los siete juegos con motor arrancan, se juegan y registran su partida igual que antes.
- [ ] `/salon` sigue cargando sus rankings, y `/juego/[id]` su top 10.

**Cabeceras**

- [ ] `curl -I http://localhost:3000/` devuelve las cinco cabeceras.
- [ ] `curl -I http://localhost:3000/snake-fruits.png` devuelve también las cinco: no solo las
      rutas de React están cubiertas.
- [ ] Con el build de producción (`npm run build && npm start`) el resultado es el mismo.
- [ ] Ninguna pantalla pierde una imagen, una fuente o un `mp3` por culpa de las cabeceras, y la
      consola del navegador no muestra errores nuevos.

**Base de datos**

- [ ] Existe una migración nueva en `supabase/migrations/` con el `revoke`, y `supabase/schema.sql`
      la refleja en su sección 4.
- [ ] `schema.sql` ejecutado dos veces seguidas no da error ni borra filas: sigue siendo
      idempotente y no destructivo.
- [ ] La ACL de `public.handle_new_user()` ya no contiene `=X/postgres` ni los grants a `anon`,
      `authenticated` y `service_role`.
- [ ] `public.handle_new_user()` **sigue** siendo `security definer` con `search_path = ''`, y el
      trigger `on_auth_user_created` sigue en pie.
- [ ] **Registrarse con una cuenta nueva sigue creando su fila en `public.profiles`**, con el
      nombre en mayúsculas y de ≤10 caracteres, sin que el cliente haga ningún `insert`.
- [ ] Entrar por primera vez con Google o GitHub también crea el perfil (el mismo trigger, el
      camino de la SPEC 20).
- [ ] `get_advisors` de seguridad devuelve **cero** de los tres WARN actuales.

**Contraseñas**

- [ ] Una contraseña de 7 caracteres se rechaza en `/auth/registro` **sin salir a la red**, con un
      mensaje en español que dice el número.
- [ ] Lo mismo en `/auth/nueva-password`.
- [ ] Una contraseña de ≥8 caracteres presente en filtraciones se rechaza con
      `ESA CONTRASEÑA APARECE EN FILTRACIONES, ELIGE OTRA`, no con el genérico.
- [ ] Ninguno de los tres mensajes nuevos cae en «NO SE PUDO COMPLETAR LA OPERACIÓN».
- [ ] Las contraseñas existentes de menos de 8 caracteres **siguen sirviendo para entrar**: el
      mínimo se aplica al crear y al cambiar, no al iniciar sesión.

**Verificación permanente**

- [ ] `npm run db:check` incluye la comprobación de la función y pasa con el revoke aplicado.
- [ ] Esa comprobación **falla** si el revoke no está —incluido el caso `0A000`, que no cuenta como
      éxito.
- [ ] `supabase/README.md` tiene el paso 3d con los tres ajustes y la fila nueva en la tabla de
      diagnóstico del paso 5.
- [ ] `CLAUDE.md` y `README.md` ya no dicen que los ajustes de dashboard sean tres.
- [ ] Un clon limpio, siguiendo solo el README y el runbook, llega a un proyecto con los tres
      advisors en verde.

**Lo que no debe romperse**

- [ ] El flujo de recuperación de la SPEC 19 funciona igual: `/auth/recuperar` → correo →
      `/auth/nueva-password` → `/biblioteca`.
- [ ] El acceso con Google y con GitHub de la SPEC 20 funciona igual.
- [ ] «JUGAR COMO INVITADO» sigue navegando a `/biblioteca` sin crear sesión.
- [ ] Ninguna ruta redirige por falta de sesión; `proxy.ts` no cambia.
- [ ] `app/lib/user-context.tsx`, `app/lib/game-sessions.ts` y `app/lib/leaderboard.ts` no cambian.

---

## Decisiones

**Cabeceras**

- **Sí:** las tres del checklist **más** HSTS y `Permissions-Policy`. Las cinco son cadenas
  estáticas, no dependen de la petición y no pueden romper un render. Las dos añadidas cubren los
  dos agujeros más obvios que dejaban las tres: degradar a HTTP y que un script de terceros pida
  cámara o ubicación.
- **Sí:** en `next.config.ts`, no en `proxy.ts`. Las cabeceras de `headers()` se aplican **antes
  del sistema de archivos**, así que cubren también `/public`; el `matcher` de `proxy.ts` excluye
  los estáticos a propósito, y meterlas ahí las dejaría fuera. Además `proxy.ts` tiene un trabajo —
  refrescar la cookie de sesión— y mezclarle otro es cómo se convierte en el cajón de sastre.
- **No:** Content-Security-Policy, en ninguno de sus dos modos. Con nonce, cada ruta pasa a
  renderizarse en cada petición y se pierde el prerenderizado; sin nonce hay que abrir
  `'unsafe-inline'` para los scripts de hidratación de Next, que es la mitad de lo que una CSP
  sirve para impedir. Y en `Report-Only`, sin endpoint de recogida, la única forma de leer los
  informes es mirar la consola a mano. Merece su spec, con tiempo para auditar estilos inline y
  fuentes.
- **No:** `preload` en HSTS. Entrar en la lista de precarga de los navegadores es fácil y salir es
  lento; con un proyecto que todavía se sirve en `localhost` es prometer algo que no toca prometer.
- **Sí:** `X-Frame-Options: DENY` y no `SAMEORIGIN`. No hay ni un `iframe` ni un
  `dangerouslySetInnerHTML` en todo `app/` (comprobado), así que no hay nada que se embeba a sí
  mismo. Si algún día se quiere incrustar un juego en otra página, será una decisión explícita y
  esta línea es donde se verá.

**La función del trigger**

- **Sí:** `revoke`, y a los cuatro roles. Es la solución mínima y reversible: dos líneas de SQL que
  no tocan ni la función, ni el trigger, ni el registro. Y tiene que incluir a **PUBLIC**, porque
  ahí es donde está de verdad el permiso: revocar solo a `anon` y `authenticated` —que es lo que
  dice la letra del WARN— deja el `=X/postgres` en pie y no arregla nada.
- **No:** pasarla a `security invoker`, aunque sea lo primero que sugiere el texto del linter.
  **Aquí rompe el registro**: durante el `signUp` no hay sesión que satisfaga ninguna política de
  `profiles`, y `profiles` **no tiene política de insert** a propósito (SPEC 04). El insert
  fallaría y con él la creación de la cuenta.
- **No:** mover la función a un esquema privado no expuesto por PostgREST. Es más limpio sobre el
  papel, pero obliga a recrear el trigger sobre `auth.users` —el punto del `schema.sql` que ya
  necesita privilegios especiales y que el runbook señala como el más frágil de una mudanza— para
  cerrar exactamente la misma clase de ataque que cierra un `revoke`.
- **Sí:** dejar escrito en la migración el escape por si el trigger dejara de dispararse:
  `grant execute ... to supabase_auth_admin`, que es el rol que inserta en `auth.users` y que
  PostgREST no expone, así que los advisors seguirían en verde. Es un seguro documentado, no un
  paso del plan: Postgres comprueba `EXECUTE` al **crear** el trigger, no al dispararlo.

**Contraseñas**

- **Sí:** el ajuste del dashboard **y** el código. Hacer solo lo primero deja dos mensajes
  mintiendo en pantalla; hacer solo lo segundo es validación de escaparate, porque el servidor
  seguiría aceptando seis caracteres. Las dos mitades son la misma medida.
- **Sí:** validar también antes de enviar. Ahorra un viaje a la red en el error más frecuente y da
  respuesta instantánea. No sustituye al servidor: es Supabase quien decide, y la guardia del
  cliente solo se adelanta al caso que ya se sabe.
- **No:** exigir mayúsculas, dígitos o símbolos. Alarga la contraseña sin mejorarla —es lo que
  empuja a la gente al `Passw0rd!`— y la protección anti-filtradas ataca el problema real, que es
  reutilizar una contraseña ya conocida.
- **No:** indicador de fuerza. Es interfaz nueva en dos pantallas para un dato que el servidor ya
  evalúa mejor.
- **Sí:** 8 y no 10 o 12. Es lo que pide el checklist y lo que recomienda Supabase por defecto;
  subirlo más invalidaría contraseñas existentes en un portal donde nadie puede cambiarlas todavía
  salvo por el flujo de recuperación.

**Registros por IP**

- **Sí:** bajar el límite de sign ups / sign ins a 10 por hora y por IP. Es un portal de juegos
  retro, no un SaaS: diez cuentas por hora desde la misma IP es de sobra para cualquier uso
  legítimo, incluida una demo con varias personas.
- **No:** CAPTCHA. Es una dependencia externa, una clave más en `.env` y un ajuste más de
  dashboard, para un portal que hoy no tiene un problema de bots. El límite por IP es gratis y
  cubre el mismo caso.

**Verificación**

- **Sí:** meter la comprobación en `npm run db:check`. El script ya habla con PostgREST con la
  publishable key —o sea, ve exactamente lo que ve un anónimo— y ya tiene la costumbre de
  comprobar que algo **no** se puede hacer, con el insert anónimo en `game_sessions`. Esto es la
  misma idea aplicada a la función.
- **Sí:** tratar `0A000` como fallo. Es el detalle que decide si la comprobación sirve para algo:
  sin él, la fase pasaría en verde contra un proyecto sin el revoke, porque una función de trigger
  llamada por RPC falla igual **por otro motivo**. Una comprobación que pasa siempre es peor que no
  tenerla, porque da una confianza que nadie se ha ganado.
- **No:** una prueba de Vitest sobre las cabeceras. Importar `next.config.ts` y afirmar que el
  array tiene cinco entradas prueba que el array existe, no que el servidor las mande. La
  verificación real es `curl -I`, y está en los criterios de aceptación.
- **No:** meter los ajustes de dashboard en `db:check`. Habría que consultar la API de gestión con
  una clave que el `.env` no tiene y que no debería tener.

---

## Riesgos

| Riesgo                                                                                                                                                                                 | Mitigación                                                                                                                                                                                                                                             |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **El revoke rompe el registro.** Si el `EXECUTE` se comprobara al disparar el trigger y no al crearlo, quitarlo dejaría `auth.users` insertando y `profiles` vacío: cuentas huérfanas. | Postgres lo comprueba al **crear** el trigger. Aun así, la puerta del paso 2 es un registro real verificado contra `profiles`, antes de seguir, y la migración lleva escrito el `grant execute ... to supabase_auth_admin` como escape, con su porqué. |
| **Cuentas huérfanas si algo falla a medias**, el caso que el runbook ya describe en el paso 6.                                                                                         | El paso 2 se verifica con una cuenta nueva desechable; si no aparece el perfil, se revierte el revoke antes de tocar nada más.                                                                                                                         |
| **HSTS es difícil de revertir**: el navegador recuerda el `max-age` aunque se quite la cabecera.                                                                                       | En `localhost` es inerte (los navegadores lo ignoran sin HTTPS válido) y se deja **sin `preload`**, que es la parte de verdad irreversible.                                                                                                            |
| **`X-Frame-Options: DENY` rompe cualquier embebido**, presente o futuro.                                                                                                               | Hoy no hay ninguno: cero `iframe` y cero `dangerouslySetInnerHTML` en `app/`. Queda como decisión visible en una sola línea.                                                                                                                           |
| **Bajar el límite por IP molesta en una demo** con varias personas registrándose desde la misma red.                                                                                   | 10 por hora da margen de sobra, el valor queda documentado como ajustable en el paso 3d, y el error que produce pasa a estar traducido en vez de caer en el genérico.                                                                                  |
| **Las claves de `errores.ts` dependen del texto literal de Supabase.** Si cambian el mensaje, el usuario vuelve al genérico sin que nadie se entere.                                   | Ya era así desde la SPEC 19 y no empeora. El paso 4 exige copiar el literal **observado**, no el recordado, y el genérico sigue siendo una red de seguridad legible.                                                                                   |
| **Cuarto ajuste de dashboard que el repo no puede fijar**, tras _Confirm email_, _Redirect URLs_ y los proveedores. Cada uno es otro que se olvida en la próxima mudanza.              | El runbook ya tiene el sitio y la disciplina: paso 3, ahora con 3d. Y dos de los tres los delata un advisor, así que el olvido es detectable.                                                                                                          |
| **`schema.sql` se queda viejo**: la migración se aplica y el reflejo no, y meses después una mudanza recrea una base con la función otra vez expuesta.                                 | La regla de sincronía de `CLAUDE.md` es explícita, y el criterio de aceptación pide las dos cosas en el mismo cambio. Además la fase nueva de `db:check` lo delata en la primera ejecución después de mudarse.                                         |
| **El mínimo de 8 deja fuera a contraseñas existentes de 6 o 7.**                                                                                                                       | El mínimo se aplica al crear y al cambiar, no al iniciar sesión: quien ya tiene cuenta entra igual. Hay criterio de aceptación que lo comprueba.                                                                                                       |

---

## Lo que **no** está en esta spec

- Content-Security-Policy, ni con nonce ni en `Report-Only`.
- CAPTCHA en el registro.
- Rutas protegidas, redirección de `/auth/*` con sesión iniciada, o cualquier autorización en
  `proxy.ts`.
- Requisitos de composición de la contraseña, indicador de fuerza o 2FA.
- Cambios en la RLS, en las políticas o en la vista `game_leaderboard`.
- Validar la puntuación en el servidor.
- Rotación de la publishable key, auditoría de dependencias o cabeceras `Report-To`.
- Pantalla de perfil.
- Pruebas de Vitest para las pantallas de acceso o para la configuración de Next.

Cada una de esas, si aterriza, va en su propia spec.
