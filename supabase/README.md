# Mudarse de proyecto de Supabase

Este es el procedimiento para recrear la base de datos de Arcade Vault en un
proyecto de Supabase nuevo. Se lee dos o tres veces al año: cuando el proyecto
del plan gratuito se pausa por inactividad, cuando desaparece del todo, o cuando
alguien clona el repositorio y necesita su propia base.

No es una guía de arquitectura. El _porqué_ de cada objeto está en
`migrations/`, y el esquema completo listo para pegar está en
[`schema.sql`](./schema.sql).

---

## Antes de empezar: qué no se recupera

**Las cuentas y las partidas del proyecto anterior se pierden.** No hay copia de
seguridad, y esta spec no la introduce. Concretamente:

| Se pierde                             | Sobrevive                                          |
| ------------------------------------- | -------------------------------------------------- |
| Todos los usuarios de `auth.users`    | El código, que no cambia                           |
| Todos los perfiles de `profiles`      | El `av_scores` de `localStorage` de cada navegador |
| Todas las partidas de `game_sessions` | La preferencia de skin (`av_skin`), por lo mismo   |
| El Salón de la Fama, que sale vacío   |                                                    |

Hay que **registrarse de nuevo**, aunque uses el mismo correo. El Salón de la
Fama arranca vacío y eso es correcto: no se siembran datos de prueba, porque
`game_sessions` referencia `auth.users` y sembrarlo obligaría a fabricar cuentas
falsas en una tabla del sistema.

---

## Los seis pasos

| Paso  | Qué se hace                                                     |
| ----- | --------------------------------------------------------------- |
| **1** | ¿Está pausado o desaparecido? Restaurar, o crear proyecto nuevo |
| **2** | Ejecutar `schema.sql` por una de las tres vías                  |
| **3** | Cuatro ajustes de _Authentication_ en el dashboard              |
| **4** | Actualizar el `project_ref`: tres archivos, y dos sitios más    |
| **5** | `npm run db:check` hasta que salga en verde                     |
| **6** | Registrarse, jugar una partida y verla en `/salon`              |

Los pasos 3 y 4 son los que se olvidan, y son justo los que el SQL no puede
cubrir. El paso 6 no es una formalidad: es el único que prueba el trigger.

---

### Paso 1 — ¿Pausado o desaparecido?

Entra en [supabase.com/dashboard](https://supabase.com/dashboard) y busca el
proyecto.

- **Si aparece con un botón _Restore_**, solo está pausado. Restáuralo, espera a
  que arranque y **salta al paso 5**. No hay mudanza que hacer: el esquema y los
  datos siguen ahí.
- **Si no aparece**, se borró. Crea uno nuevo y anota dos cosas de
  _Project Settings → API_:
  - el **project ref** (el subdominio: `https://<project_ref>.supabase.co`),
  - la **publishable key** (la clave anónima, la que puede ir en el navegador).

Para distinguir «pausado» de «borrado» sin abrir el navegador:

```bash
Resolve-DnsName <project_ref>.supabase.co    # PowerShell
```

Si el nombre no existe, el proyecto se borró. Si resuelve pero la app no
responde, está pausado. `npm run db:check` hace esta misma distinción y la dice
con palabras.

---

### Paso 2 — Ejecutar `schema.sql`

Elige **una** de las tres vías. Hacen lo mismo; cambian los requisitos.

`schema.sql` es **idempotente y no destructivo**: ejecutarlo dos veces seguidas
no da error y no borra una sola fila. No contiene ningún `drop table`, ningún
`drop schema` ni ningún `truncate`. Se puede relanzar sin miedo.

#### Vía A — Editor SQL del dashboard (por defecto)

La que menos requisitos tiene y la única disponible en el minuto uno de un
proyecto recién creado.

1. Dashboard → **SQL Editor** → _New query_.
2. Copia `supabase/schema.sql` **entero** y pégalo.
3. _Run_.

Se ejecuta como `postgres`, así que el `drop trigger ... on auth.users` del
objeto 5 tiene los privilegios que necesita.

#### Vía B — MCP de Supabase

Desde una sesión de Claude Code, con `apply_migration`. Requiere dos cosas
hechas de antemano:

- el `project_ref` **ya actualizado** en la URL de `.mcp.json` (paso 4), porque
  si no aplicarás el esquema en el proyecto equivocado o en ninguno;
- el servidor habilitado en `enabledMcpjsonServers`, dentro de
  `.claude/settings.local.json` (que no está versionado).

Si vas por aquí, haz el paso 4 **antes** que el 2.

#### Vía C — CLI de Supabase

```bash
supabase link --project-ref <nuevo_project_ref>
supabase db push
```

`db push` aplica los archivos de `migrations/`, no `schema.sql`, y pide la
contraseña de la base: es la `SUPABASE_DB_PASS` del `.env`, que está ahí justo
para esto y que la aplicación no lee nunca.

`supabase link` genera `config.toml` y las carpetas `.branches/` y `.temp/`
dentro de `supabase/`. **No se versionan** (están en `.gitignore`): meter
`config.toml` en el repo pondría el `project_ref` en un cuarto archivo, y el
valor del paso 4 está en que la lista sea corta.

---

### Paso 3 — Cuatro ajustes de _Authentication_

Los cuatro viven en el dashboard, así que el repositorio no puede fijarlos, y cada
uno rompe algo distinto si se olvida. Están en pantallas diferentes.

El **3c es el único opcional**: sin él el portal funciona entero con correo y
contraseña, y lo que se pierde es entrar con Google o GitHub. El **3d no rompe
nada si se olvida** —el portal funciona igual— pero deja el proyecto con la
política de contraseñas por defecto y un aviso encendido en _Advisors_.

#### 3a — Desactivar _Confirm email_

Dashboard → **Authentication → Sign In / Providers → Email** → desactivar
**Confirm email**.

Sin esto, `signUp` no devuelve sesión: el registro _parece_ funcionar —no da
error— pero nadie entra, porque Supabase se queda esperando una confirmación por
correo que el portal no gestiona.

Es configuración del dashboard, así que el repositorio no puede fijarla y no hay
forma de automatizarla. Si algún día Supabase mueve esa pantalla de sitio, busca
la casilla por su nombre: **Confirm email**, y tiene que quedar **desactivada**.

> ⚠ **En esa tarjeta hay DOS interruptores y se parecen.** El de la cabecera
> habilita el **proveedor Email entero**; el de dentro es **Confirm email**. Hay
> que apagar solo el segundo. Apagar el primero deja el portal sin su único
> método de acceso, y el registro falla con un error que no menciona ningún
> interruptor:
>
> ```
> {"code":400,"error_code":"email_provider_disabled","msg":"Email signups are disabled"}
> ```

**Cómo comprobar que quedó bien**, sin abrir la app y sin registrar a nadie —
`/auth/v1/settings` es público y devuelve la configuración de verdad:

```bash
node --env-file=.env -e '
const r = await fetch(process.env.NEXT_PUBLIC_SUPABASE_URL + "/auth/v1/settings", {
  headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY },
});
const s = await r.json();
console.log("proveedor Email activo  :", s.external?.email);        // debe ser true
console.log("Confirm email desactivado:", s.mailer_autoconfirm);    // debe ser true
console.log("registro bloqueado      :", s.disable_signup);         // debe ser false
'
```

Los tres valores tienen que salir `true`, `true`, `false`. Cualquier otra
combinación se arregla en esta misma pantalla del dashboard.

#### 3b — Autorizar la URL de vuelta de `/auth/confirmar`

Dashboard → **Authentication → URL Configuration → Redirect URLs** → añadir:

```
http://localhost:3000/auth/confirmar
```

y, si el portal está desplegado, también la de producción
(`https://<dominio>/auth/confirmar`).

Es lo que necesita el flujo de recuperación de contraseña (SPEC 19).
`/auth/recuperar` llama a `resetPasswordForEmail` pasando esa dirección en
`redirectTo`, y **Supabase solo respeta un `redirectTo` que esté en esta lista**:
si no está, ignora el parámetro sin avisar y manda al usuario al _Site URL_. El
síntoma es de los que despistan, porque el correo llega y el enlace funciona —
solo que aterriza en la portada en vez de en la pantalla para escribir la
contraseña nueva, y nadie puede cambiarla.

_Confirm email_ (3a) y esto son independientes: **la recuperación de contraseña
manda correo aunque la confirmación de registro esté desactivada**, porque son
plantillas distintas. Tenerla apagada no impide probar el flujo.

> El SMTP por defecto de Supabase permite muy pocos correos por hora. Probando la
> recuperación se agota enseguida, y a partir de ahí `/auth/recuperar` muestra
> "DEMASIADOS INTENTOS, PRUEBA EN UN RATO". Es el plan gratuito, no un fallo.

#### 3c — Activar Google y GitHub

Lo que pide la SPEC 20. Son **dos altas fuera de Supabase** más dos pares de
credenciales dentro, y es la parte más larga de todo el runbook.

Las dos aplicaciones apuntan a la **misma** URL de vuelta, que es de Supabase y no
del portal — la muestra la propia tarjeta del proveedor en el dashboard:

```
https://<project_ref>.supabase.co/auth/v1/callback
```

`/auth/confirmar` **no** se pone aquí: el navegador pasa primero por Supabase, y es
Supabase quien reenvía al portal usando la lista de 3b.

1. **GitHub** → _Settings → Developer settings → OAuth Apps → New OAuth App_. La
   _Homepage URL_ puede ser `http://localhost:3000`; la **Authorization callback
   URL** es la de arriba. Genera un _client secret_ y cópialo antes de salir: no se
   vuelve a mostrar.
2. **Google** → _Cloud Console → APIs & Services_. Primero la **pantalla de
   consentimiento** (_OAuth consent screen_) y luego _Credentials → Create
   credentials → OAuth client ID_, tipo _Web application_, con la misma URL en
   **Authorized redirect URIs**. Esto es bastante más pesado que GitHub: cuenta con
   ello.
3. En Supabase → _Authentication → Sign In / Providers_, abre **Google** y
   **GitHub**, activa cada uno y pega su _Client ID_ y su _Client Secret_.

**Cómo comprobar que quedó bien** sin pulsar un botón, con el mismo endpoint público
que usa 3a:

```bash
node --env-file=.env -e '
const r = await fetch(process.env.NEXT_PUBLIC_SUPABASE_URL + "/auth/v1/settings", {
  headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY },
});
const s = await r.json();
console.log("google:", s.external?.google, "| github:", s.external?.github);
'
```

> ⚠ **`external.google: true` no significa que esté configurado.** Ese campo dice
> que el proveedor está activado, no que sus credenciales sirvan. La comprobación de
> verdad es pulsar el botón en `/auth/login`: si sales a la pantalla del proveedor,
> está bien; si se queda en la tarjeta con "ESE ACCESO NO ESTÁ DISPONIBLE TODAVÍA",
> es que falta el alta.

Mientras un proveedor no esté activado, su botón **no se esconde**: muestra ese
mensaje. Es deliberado (SPEC 20), para no preguntar la configuración en cada render.

> ⚠ **Google: la pantalla de consentimiento nace en modo _Testing_**, y en ese
> modo **solo entran los correos que estén en su lista de usuarios de prueba**. El
> resto ve un «Acceso bloqueado» diciendo que la aplicación no ha completado la
> verificación de Google — y aparece **después** de teclear el correo, así que el
> botón, el redirect URI y Supabase parecen estar bien, porque lo están.
>
> Dos salidas, en _Cloud Console → Google Auth Platform → **Audience**_:
>
> - **Añadirte como usuario de prueba** (_Test users → Add users_). Inmediato, sin
>   revisión, admite hasta 100 correos. Es lo que hace falta para desarrollar.
> - **Publicar la app** (_Publish app_). Permanente y para cualquiera. **No exige
>   la revisión de Google** en este caso, porque Supabase solo pide los permisos
>   no sensibles `openid`, `email` y `profile`.
>
> GitHub no tiene equivalente: una OAuth App sirve a cualquier cuenta desde el
> minuto uno.

#### 3d — Política de contraseñas y límite de registros

Lo que pide la SPEC 22. Son tres interruptores en dos pantallas, y ninguno tiene
código detrás: el repositorio no puede fijarlos.

En _Authentication → **Sign In / Providers** → Email_, la misma tarjeta del 3a:

1. **Minimum password length** → **8**. Supabase viene con 6. El número está
   también en `app/auth/errores.ts` (`MIN_PASSWORD`), que es lo que valida el
   formulario antes de salir a la red y lo que dice el mensaje de error: si aquí
   pones otro valor, cámbialo también allí o los dos se contradicen.
2. **Leaked password protection** → **activada**. Comprueba la contraseña contra
   HaveIBeenPwned. Es el aviso `auth_leaked_password_protection` de _Advisors_, y
   es el único de los tres que se puede verificar desde fuera.

En _Authentication → **Rate Limits**_:

3. El límite de **registros e inicios de sesión por hora y por IP** → **10**. Por
   defecto es 30. Diez es de sobra para cualquier uso legítimo de un portal de
   juegos, incluida una demo con varias personas en la misma red; si te quedas
   corto en una clase, súbelo — el valor no es sagrado, pero el límite sí.

**Cómo comprobar que quedó bien**, sin crear una cuenta: en el dashboard,
_Advisors → Security_, el aviso **Leaked Password Protection Disabled** tiene que
haber desaparecido. Los otros dos no asoman por ningún endpoint público; se ven
en su pantalla o probándolos.

> ⚠ **El mínimo se aplica al crear y al cambiar la contraseña, no al entrar.**
> Una cuenta con una contraseña de 6 caracteres de antes sigue pudiendo iniciar
> sesión. Esto no echa a nadie fuera.

> ⚠ **Los mensajes de error del portal casan por texto literal.** Si cambias el
> mínimo, el mensaje que devuelve Supabase cambia con él («…at least 8
> characters») y `app/auth/errores.ts` tiene que llevar exactamente esa cadena, o
> el usuario acaba leyendo el genérico «NO SE PUDO COMPLETAR LA OPERACIÓN».

---

### Paso 4 — El `project_ref`: tres archivos, y dos sitios más

El `project_ref` vive en tres sitios y hay que cambiarlo en los tres. Olvidar
uno deja la app o el MCP apuntando al proyecto muerto, con un error que no dice
por qué.

| Archivo        | Qué se cambia                                                       | ¿Versionado?      |
| -------------- | ------------------------------------------------------------------- | ----------------- |
| `.env`         | `NEXT_PUBLIC_SUPABASE_URL`, la publishable key y `SUPABASE_DB_PASS` | No (`.gitignore`) |
| `.env.example` | La URL de ejemplo, para que el siguiente no copie la vieja          | Sí                |
| `.mcp.json`    | El `project_ref=` de la URL del servidor MCP                        | Sí                |

Para comprobar que no queda ninguno sin actualizar:

```bash
grep -rn "<project_ref_viejo>" .env .env.example .mcp.json
```

Si devuelve algo, todavía falta uno.

#### Y dos sitios más, fuera del repositorio, si hiciste el 3c

**El `grep` de arriba no los ve, y una mudanza los rompe los dos.** La URL de
vuelta que llevan registradas las aplicaciones OAuth **contiene el
`project_ref`**:

```
https://<project_ref>.supabase.co/auth/v1/callback
```

Así que al mudarse hay que editarla en los dos sitios donde vive:

| Dónde                                                | Campo                      |
| ---------------------------------------------------- | -------------------------- |
| GitHub → Settings → Developer settings → OAuth Apps  | Authorization callback URL |
| Google Cloud Console → APIs & Services → Credentials | Authorized redirect URIs   |

**El síntoma no menciona Supabase ni el portal**, y es de los que hacen perder
una tarde buscando en el sitio equivocado. GitHub responde:

> **Be careful!** The `redirect_uri` is not associated with this application.

Y Google, un `Error 400: redirect_uri_mismatch`. Los dos suenan a que la
aplicación está mal programada; lo que pasa es que apuntan al proyecto anterior.
La consola del navegador sale limpia, porque nadie ha fallado del lado del
portal.

---

### Paso 5 — `npm run db:check`

```bash
npm run db:check
```

Comprueba, en dos fases, que el proyecto existe y que el esquema está completo.
Usa la publishable key **a propósito**: así ve lo que ve la aplicación, con la
RLS aplicada, y no lo que vería un superusuario que se salta las políticas.

Cuando todo está bien:

```
  Comprobando <project_ref>.supabase.co

  conexión ................ OK
  profiles ................ OK
  game_sessions ........... OK
  game_leaderboard ........ OK
  RLS: insert anónimo ..... RECHAZADO (correcto)
  trigger de perfiles ..... no verificable sin registrar

  ✓ Esquema listo.
```

**Una tabla vacía cuenta como correcta**: se comprueba que la consulta responda,
no que haya filas. Tras una mudanza no hay ninguna.

Qué significa cada fallo:

| Sale                                  | Qué pasó                                                                  | Qué hacer                          |
| ------------------------------------- | ------------------------------------------------------------------------- | ---------------------------------- |
| `No se pudo resolver …`               | El host no existe: el proyecto se borró                                   | Paso 1                             |
| `respondió 5xx al comprobar su salud` | El host resuelve pero no sirve: suele estar pausado                       | Paso 1, _Restore_                  |
| `NO EXISTE — falta por crear`         | El proyecto está vivo pero el esquema no se aplicó                        | Paso 2                             |
| `ACEPTADO — ¡FALLO GRAVE!`            | Un anónimo pudo escribir en `game_sessions`: la RLS no está puesta        | Paso 2, y borra la fila `db-check` |
| `EXPUESTA — falta el revoke`          | `handle_new_user()` es alcanzable en `/rest/v1/rpc/`: falta la sección 4b | Paso 2                             |
| `Falta en .env: …`                    | El `.env` está a medias                                                   | Paso 4                             |

El **trigger no se puede verificar aquí**: probarlo de verdad exige registrar un
usuario, y el script no va a dejar basura en `auth.users` en cada ejecución. Eso
lo prueba el paso 6.

Lo que sí verifica, desde la SPEC 22, es que **su función no esté publicada como
endpoint RPC**. Ojo con la trampa de esa comprobación: la llamada a
`/rest/v1/rpc/handle_new_user` falla **también** sin el revoke, porque una función
de trigger no se puede invocar directamente. Por eso el script no mira si la
llamada falló, sino **por qué**: `PGRST202` o `42501` significan cerrada; `0A000`
—«trigger functions can only be called as triggers»— significa que sigue abierta
y cuenta como fallo.

---

### Paso 6 — Registrarse y jugar

```bash
npm run dev
```

1. `/auth/registro` → registrar una cuenta nueva.
2. Comprobar que **el nombre aparece en la barra de navegación**. Si aparece, el
   trigger `on_auth_user_created` funcionó: creó la fila en `profiles` tomando el
   nombre de `raw_user_meta_data.username`, en mayúsculas y cortado a 10
   caracteres.
3. Jugar una partida completa de cualquier juego con motor (ROCAS, CAÍDA, BLOQUE
   BUSTER, SERPENTINA o RANARIA) y dejarla terminar.
4. `/salon` → la marca tiene que estar ahí.

Este paso recorre la cadena entera —`signUp` → trigger → `profiles` →
`game_sessions` → vista `game_leaderboard`— y es el único que demuestra que el
trigger existe. Hasta aquí, la mudanza no está terminada.

Si el nombre **no** aparece en el Nav pero la cuenta se creó, el trigger no está:
vuelve al paso 2 y comprueba que `schema.sql` se ejecutó completo, sin cortarse
a la mitad.

#### Cuentas huérfanas: por qué el orden de los pasos no es decorativo

**No te registres antes de haber hecho el paso 2.** El trigger es `after insert`,
así que solo actúa sobre registros **nuevos**: una cuenta creada cuando `profiles`
y el trigger todavía no existían se queda **para siempre sin perfil**, y nada la
repara sola después. Ejecutar `schema.sql` más tarde crea el trigger, no los
perfiles que faltaron.

El síntoma es engañoso, porque casi todo parece funcionar:

- la sesión se inicia y se puede jugar;
- la partida **sí** se guarda en `game_sessions` (la política de `insert` solo
  exige `auth.uid() = user_id`, no exige tener perfil);
- pero en `/salon` **no aparece nada**, porque `game_leaderboard` hace `join` con
  `profiles` y esa fila no existe.

Es decir: la marca está guardada y es invisible. Para detectarlo y repararlo, en
el editor SQL del dashboard:

```sql
-- ¿hay cuentas sin perfil?
select u.id, u.email
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;

-- repararlas: hace lo mismo que habría hecho el trigger
insert into public.profiles (id, username)
select u.id,
       upper(left(coalesce(u.raw_user_meta_data ->> 'username',
                           split_part(u.email, '@', 1)), 10))
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;
```

El `insert` es seguro de relanzar: solo toca las cuentas a las que les falta el
perfil. La alternativa —borrar la cuenta y registrarse de nuevo— también funciona,
pero se lleva por delante las partidas ya jugadas.

---

## Comprobar la idempotencia

Con el portal ya funcionando y una partida registrada, vuelve a ejecutar
`schema.sql` una segunda vez. Tiene que terminar **sin error**, y la partida del
paso 6 tiene que **seguir estando** en `/salon`. Si algo de eso falla, el archivo
tiene un bug y no es seguro relanzarlo.

---

## Qué deja en pie `schema.sql`

Diez objetos, de tres specs. Es la lista contra la que está escrito
`db-check.mjs`:

| #   | Objeto                               | Tipo                                           | Spec |
| --- | ------------------------------------ | ---------------------------------------------- | ---- |
| 1   | `public.profiles`                    | tabla                                          | 04   |
| 2   | `perfiles legibles por cualquiera`   | política `select` sobre `profiles`             | 04   |
| 3   | `cada usuario edita su perfil`       | política `update` sobre `profiles`             | 04   |
| 4   | `public.handle_new_user()`           | función `security definer`, `search_path = ''` | 04   |
| 5   | `on_auth_user_created`               | trigger `after insert` sobre `auth.users`      | 04   |
| 6   | `public.game_sessions`               | tabla                                          | 06   |
| 7   | `partidas legibles por cualquiera`   | política `select` sobre `game_sessions`        | 06   |
| 8   | `cada usuario registra sus partidas` | política `insert` sobre `game_sessions`        | 06   |
| 9   | `game_sessions_game_score_idx`       | índice `(game_id, score desc)`                 | 06   |
| 10  | `public.game_leaderboard`            | vista con `security_invoker = on`              | 07   |

Más las dos líneas de `enable row level security`, que no son objetos pero sin
las cuales las cuatro políticas no se evalúan nunca.

**No hay política de `update` ni de `delete` sobre `game_sessions`, y no es un
olvido**: una partida jugada es un hecho, no un registro editable (SPEC 06). Que
falten es la decisión, no la tarea pendiente.

---

## `schema.sql` y `migrations/`: la regla de sincronía

Los dos describen el mismo esquema y ninguno sustituye al otro:

- **`migrations/`** es el histórico. Cada archivo cuenta de qué SPEC salió y
  **por qué** es como es —por qué el `order by` de la vista empieza por esas
  columnas, por qué la función lleva `search_path = ''`, por qué `profiles` no
  tiene política de `insert`—. No se toca ni se reescribe.
- **`schema.sql`** dice el **qué**, de un tirón y de forma reejecutable. Es lo
  que se pega en una mudanza.

**Al añadir una migración nueva hay que reflejarla en `schema.sql` en el mismo
cambio.** Si no, el archivo se queda viejo en silencio y la siguiente mudanza
recrea una base de datos incompleta — que es un fallo que no se descubre hasta
meses después, con el proyecto ya perdido.

---

## Límite conocido

`create table if not exists` **no arregla una tabla que ya exista con otra
forma**. Si un proyecto tiene un `profiles` de una versión anterior al que le
falta una columna, `schema.sql` pasa por encima sin decir nada y la app falla
después, en otro sitio.

Se asume a conciencia: el caso de uso de este runbook es un proyecto **recién
creado y vacío**. Para el resto está `db:check`, que consulta las relaciones de
verdad en vez de fiarse del SQL.
