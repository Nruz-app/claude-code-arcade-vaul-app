# SPEC 23 — Respaldo y migración de los datos de Supabase

> **Estado:** Impletando
> **Depende de:** SPEC 04, SPEC 06, SPEC 07, SPEC 15, SPEC 22
> **Fecha:** 2026-09-14
> **Objetivo:** Que una mudanza de proyecto de Supabase deje de costar las partidas, con un volcado versionable a JSON, una tabla `legacy_sessions` congelada donde restaurarlo sin fabricar cuentas, y el modelo de datos documentado de una vez.

---

## Por qué existe esta spec

El proyecto corre en el plan gratuito y **ya desapareció una vez**. El 2/9/2026 se perdió
`dkyghnxmytbfuopxlefe` con todas las cuentas y todas las partidas dentro. De ahí salió la
SPEC 15, que resolvió **la mitad** del problema —`supabase/schema.sql` idempotente, el runbook
de seis pasos y `npm run db:check`— y dejó la otra mitad escrita, con estas palabras, en su
sección final:

> _«Copias de seguridad periódicas de `game_sessions`. Sería la spec que hace que una mudanza
> no cueste las partidas; hoy las cuesta, y el runbook lo dice.»_

Esta es esa spec. El daño de no tenerla está medido en el repo:
`references/implemented-game/implemented-games.md` anota que _«hoy solo hay partidas de cinco
`game_id`, porque el proyecto de Supabase se recreó (SPEC 15) y las partidas anteriores no se
migraron»_.

**El esquema ya es portátil. Los datos no.**

### El obstáculo, y por qué no tiene una solución bonita

`game_sessions.user_id` referencia `auth.users`. En un proyecto nuevo esa tabla nace vacía y
los `uuid` que se generen no serán los de antes. Restaurar una partida tal cual es imposible
sin fabricar antes la cuenta a la que pertenece, y fabricar cuentas exige la `service_role`
key, que hoy no está ni en `.env` ni en `.env.example` y no se va a añadir: da acceso total a
la base y contradice el diseño de `db-check.mjs`, que usa la _publishable key_ **a propósito**
para ver lo mismo que ve la aplicación.

La salida es dejar de intentarlo: las partidas viejas no vuelven a `game_sessions`, van a un
**archivo histórico congelado** que no depende de ninguna cuenta. Es un modelo distinto y hay
que decirlo en voz alta: una fila de `legacy_sessions` **no es** una fila de `game_sessions`
que sobrevivió, es el recuerdo de una.

---

## Alcance

**Dentro:**

- **`supabase/MODELO.md`** — el modelo de datos documentado: diagrama, diccionario por
  columna, las políticas RLS por su nombre y las que deliberadamente no existen.
- **`public.legacy_sessions`** — tabla nueva, espejo de `game_sessions`, **sin clave foránea**,
  con el `username` desnormalizado como texto y la procedencia. RLS activada y **ninguna**
  política de escritura.
- **La vista `public.game_leaderboard` reescrita** como `union all` de las dos tablas,
  agrupando por `game_id, username`. Las **mismas seis columnas**, en el mismo orden y del
  mismo tipo.
- **`npm run db:dump`** (`scripts/db-dump.mjs`) — vuelca `profiles`, `game_sessions` y
  `legacy_sessions` a `supabase/backup/<fecha>-<project_ref>.json`, **versionado en git**.
- **`npm run db:restore`** (`scripts/db-restore.mjs`) — lee ese JSON y **genera** el `.sql` de
  importación para pegar en el editor SQL. Con `--verificar`, contrasta la base contra el JSON.
- **`db-check.mjs` ampliado**: comprueba `legacy_sessions`, prueba su insert anónimo, y una
  FASE 4 que sondea `/auth/v1/settings` para los ajustes de dashboard que sí son sondeables.
- **El primer respaldo real** del proyecto vivo (`yrzosefjyiwybtdyquhi`), versionado.
- `supabase/README.md`: un **paso 0** («respalda antes de nada») y un **paso 7** («devuelve el
  histórico»), y la tabla de «qué no se recupera» reescrita.
- La migración `supabase/migrations/20260914143000_legacy_sessions.sql` y su reflejo en
  `supabase/schema.sql` **en el mismo cambio**, que es la regla de sincronía.

**Fuera, explícitamente:**

- **Tocar `app/`.** Ni `app/lib/leaderboard.ts`, ni `app/lib/game-sessions.ts`, ni el Salón, ni
  los tres clientes, ni `proxy.ts`. Si algo parece pedirlo, el diseño de la vista está mal.
- **Recrear cuentas de `auth.users`.** Correos y contraseñas no se recuperan. No se añade la
  `service_role` key al proyecto.
- **Restaurar `profiles`.** Un perfil sin su `auth.users` es una fila huérfana que además
  chocaría con el trigger si ese correo se vuelve a registrar. Los nombres viajan **dentro** de
  `legacy_sessions`, que es justo para lo que se desnormalizan.
- **Respaldos automáticos** — ni cron, ni hook `Stop`, ni GitHub Action. `db:dump` se lanza a
  mano, como `db:check`.
- **Automatizar el dashboard** con la Management API. La FASE 4 **verifica**, no configura.
- **`unique` en `profiles.username`.** Hoy no lo tiene y añadirlo es otra spec (ver Riesgos).
- **Tipos TypeScript generados** del esquema. Hoy ningún cliente está tipado; eso es refactor
  de app, no de migración.
- **Instalar el CLI de Supabase** ni versionar `supabase/config.toml`. La SPEC 15 lo descartó
  y sigue descartado: metería el `project_ref` en un cuarto archivo.
- **Cambiar el esquema existente.** Ni una columna, ni una política, ni un índice de
  `profiles` o `game_sessions`. Lo único que cambia de lo que ya había es el cuerpo de la
  vista.
- **El timeout de `proxy.ts`** con Supabase caído, que la SPEC 15 dejó pendiente y sigue
  pendiente.

---

## Modelo de datos

### Archivos que aparecen o cambian

| Archivo                                                  | Qué pasa                                                                       |
| -------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `supabase/MODELO.md`                                     | **Nuevo.** El modelo documentado.                                              |
| `supabase/migrations/20260914143000_legacy_sessions.sql` | **Nuevo.** Tabla, política, índice y la vista reescrita.                       |
| `supabase/schema.sql`                                    | Sección 11 nueva; la sección 10 (la vista) cambia de cuerpo.                   |
| `scripts/db-dump.mjs`                                    | **Nuevo.** El volcado.                                                         |
| `scripts/db-restore.mjs`                                 | **Nuevo.** Genera el `.sql` y verifica.                                        |
| `scripts/db-check.mjs`                                   | `legacy_sessions`, su insert anónimo y la FASE 4.                              |
| `supabase/backup/2026-09-14-yrzosefjyiwybtdyquhi.json`   | **Nuevo.** El primer respaldo real.                                            |
| `supabase/README.md`                                     | Pasos 0 y 7; el encabezado «Los seis pasos»; la tabla de «qué no se recupera». |
| `README.md`                                              | Dice «son seis pasos» (línea 85) y deja de ser cierto.                         |
| `package.json`                                           | `db:dump` y `db:restore`.                                                      |
| `.gitignore`                                             | El comentario de qué se versiona de `supabase/`.                               |
| `CLAUDE.md`                                              | Sección **Supabase**.                                                          |
| `specs/23-respaldo-y-migracion-de-datos.md`              | Esta spec.                                                                     |

**Nada de `app/` aparece en esa tabla, y no es un olvido.** Que el Salón de la Fama enseñe las
partidas heredadas sin que se toque una línea de TypeScript es el criterio que decide si el
diseño de la vista es el correcto.

### `public.legacy_sessions` — el DDL

Espejo de `game_sessions` con tres diferencias: sin FK, con `username` desnormalizado y con
procedencia.

```sql
create table if not exists public.legacy_sessions (
  id            uuid primary key,          -- el id original, SIN default
  user_id       uuid not null,             -- SIN references: ese auth.users ya no existe
  username      text not null check (char_length(username) between 1 and 10),
  game_id       text not null check (char_length(game_id) between 1 and 40),
  score         integer not null check (score >= 0),
  level         integer not null check (level >= 1),
  duration_ms   integer not null check (duration_ms >= 0),
  ended_reason  text not null check (ended_reason in ('game_over', 'surrender')),
  created_at    timestamptz not null,      -- el original, SIN default
  origen        text not null check (char_length(origen) between 1 and 40),
  imported_at   timestamptz not null default now()
);

alter table public.legacy_sessions enable row level security;

drop policy if exists "partidas heredadas legibles por cualquiera" on public.legacy_sessions;
create policy "partidas heredadas legibles por cualquiera"
  on public.legacy_sessions for select using (true);

create index if not exists legacy_sessions_game_score_idx
  on public.legacy_sessions (game_id, score desc);
```

Cuatro cosas que no son adorno:

1. **`id` y `created_at` no llevan `default`.** Los dos vienen del respaldo. Un `default` aquí
   invitaría a insertar una fila «nueva» en una tabla que por definición solo contiene
   antiguas, y el `id` original es lo que hace idempotente la importación.
2. **`user_id` sin `references`.** Es el único cambio estructural respecto a `game_sessions` y
   es el motivo entero de que esta tabla exista. Se conserva porque es dato: dice qué partidas
   fueron de la misma persona, aunque esa persona ya no tenga cuenta.
3. **Los `check` se copian literalmente de `game_sessions`.** Una fila importada tiene que
   cumplir lo mismo que una recién jugada. Es la última barrera contra un JSON corrupto o
   editado a mano, y es lo que impide que `ended_reason` se llene de valores que
   `GameOverReason` (`app/lib/games/types.ts`) no admite.
4. **Ni `insert`, ni `update`, ni `delete`.** Con RLS activada y sin una sola política de
   escritura, **ningún rol de la API puede tocar esta tabla nunca**. Se llena desde el editor
   SQL del dashboard, que corre como `postgres` —propietario de la tabla, y un propietario se
   salta la RLS—. Eso es lo que significa «congelada», y no hace falta nada más para
   conseguirlo.

### `public.game_leaderboard` — la vista reescrita

**Las mismas seis columnas, en el mismo orden y del mismo tipo.** No es una preferencia:
`create or replace view` falla si cambia cualquiera de las tres, y el error que devuelve habla
de tipos y no de lo que de verdad pasa. El aviso ya está escrito en `schema.sql`.

```sql
create or replace view public.game_leaderboard
with (security_invoker = on) as
with todas as (
  select gs.game_id, gs.user_id, p.username, gs.score, gs.level, gs.created_at
  from public.game_sessions gs
  join public.profiles p on p.id = gs.user_id

  union all

  select ls.game_id,
         coalesce(p.id, ls.user_id) as user_id,
         ls.username, ls.score, ls.level, ls.created_at
  from public.legacy_sessions ls
  left join public.profiles p on upper(p.username) = upper(ls.username)
)
select distinct on (game_id, username)
  game_id, user_id, username, score, level, created_at
from todas
order by game_id, username, score desc, created_at asc;
```

- **`distinct on (game_id, username)`**, y ya no `(game_id, user_id)`. Esto es lo que funde la
  marca vieja y la nueva de un mismo jugador en una sola fila con la mejor de las dos. El
  `order by` sigue empezando por las columnas del `distinct on`, que es obligatorio: escribirlo
  en otro orden no da error, da el ranking equivocado **en silencio**.
- **`coalesce(p.id, ls.user_id)`** es lo que mantiene vivo `getPlayerBest()`
  (`app/lib/leaderboard.ts`), que filtra la vista por `user_id`. Sin esa línea, un jugador que
  se vuelve a registrar vería su nombre en el ranking público y «sin marca» en su propia
  ficha. **No reasigna nada**: la tabla sigue congelada y la resolución ocurre al leer.
- El `left join` puede multiplicar una fila heredada si dos perfiles comparten nombre, pero el
  `distinct on` la vuelve a colapsar y el dato es el mismo. No hace falta defenderse de eso.

**La garantía que se mueve, y por qué importa.** Hoy el `distinct on (game_id, user_id)` no es
solo el criterio del ranking: es lo que asegura que la vista devuelve **como mucho una fila por
`(game_id, user_id)`**. Dos sitios de `app/` dependen de eso sin decirlo:

- `getPlayerBest()` (`app/lib/leaderboard.ts`) consulta con **`.maybeSingle()`**, que **da error
  si vuelven dos filas**. Y `getPlayerBest` devuelve `null` ante cualquier error, así que el
  jugador vería «sin marca» teniendo partidas, sin nada en la consola.
- El Salón usa **`key={r.userId}`** (`app/salon/salon-client.tsx:160`) como clave de lista de
  React.

Al agrupar por `username`, esa garantía pasa a ser `(game_id, username)` y la de
`(game_id, user_id)` deja de estar impuesta por el esquema: se sostiene solo porque cada
username resuelve a un `user_id` y viceversa. En la práctica se cumple —un perfil tiene un
nombre, y un `user_id` heredado trae el nombre que tenía al volcarse— pero **deja de ser una
garantía y pasa a ser una coincidencia**, así que se comprueba explícitamente en los criterios
de aceptación en vez de darse por hecha.

- `security_invoker = on` se mantiene. Sin él la vista correría con los permisos del
  propietario y se saltaría la RLS de las tres relaciones que consulta.

### El formato del respaldo

`supabase/backup/<YYYY-MM-DD>-<project_ref>.json`:

```json
{
  "version": 1,
  "project_ref": "yrzosefjyiwybtdyquhi",
  "exported_at": "2026-09-14T18:00:00.000Z",
  "counts": { "profiles": 3, "game_sessions": 41, "legacy_sessions": 0 },
  "profiles": [{ "id": "…", "username": "NICO", "created_at": "…" }],
  "game_sessions": [
    {
      "id": "…",
      "user_id": "…",
      "game_id": "rocas",
      "score": 12340,
      "level": 3,
      "duration_ms": 91000,
      "ended_reason": "game_over",
      "created_at": "…"
    }
  ],
  "legacy_sessions": []
}
```

- **`legacy_sessions` se vuelca también.** Sin eso, la segunda mudanza perdería el archivo que
  salvó la primera, y el problema volvería exactamente igual una generación más tarde.
- **`profiles` se vuelca, pero no se restaura.** Está para poder resolver el `username` de cada
  partida al generar el `.sql`, y para poder mirar dentro de un respaldo viejo. La decisión de
  no reinsertarlo está arriba, en «Fuera».
- **`version: 1`** es la vía de escape si el formato cambia: `db-restore.mjs` comprueba el
  número y se niega a leer uno que no entienda, en vez de improvisar.
- **`auth.users` no aparece**, ni aparecerá. La _publishable key_ no lo alcanza.

### `origen`

El `project_ref` del proyecto del que salió la fila, copiado del JSON. Es lo que permite,
dentro de dos mudanzas, distinguir qué partidas venían de dónde con un `where origen = …` en
vez de deducirlo por fechas.

### Los dos scripts

Mismo patrón que `scripts/db-check.mjs`, y por los mismos motivos: `fetch` contra PostgREST y
no `@supabase/supabase-js` (cuyo `createClient()` exige un `WebSocket` nativo que no existe
hasta Node 22, y aquí corre Node 20), `node --env-file=.env`, cero dependencias nuevas y
diagnóstico con `fallo()`. Usan la _publishable key_, que basta para leer porque las tres
relaciones tienen `select using (true)`.

```
npm run db:dump                    # vuelca el proyecto de .env a supabase/backup/

npm run db:restore                 # coge el JSON más reciente de supabase/backup/
npm run db:restore -- <archivo>    # o el que se le diga
npm run db:restore -- --verificar  # compara la base de hoy contra el JSON
```

`db-restore.mjs` **nunca escribe en la base de datos**. Genera
`supabase/backup/<fecha>-restaurar.sql` con `insert … on conflict (id) do nothing` en lotes de
500 filas, y dice por consola que hay que pegarlo en el editor SQL.

---

## Plan de implementación

Cada paso deja el repo compilando y `npm run test:run` en verde, y es commitable por sí solo.

1. **`supabase/MODELO.md` con el modelo de HOY** — antes de tocar nada. Diagrama de entidades,
   diccionario por columna (tipo, restricción, **quién la escribe** y **quién la lee**), las
   cuatro políticas por su nombre exacto en español, las que deliberadamente no existen con su
   motivo, y las tres invariantes que no son SQL (`game_id` es texto libre y no hay tabla
   `games`; `ended_reason` es la otra mitad de `GameOverReason`; la puntuación es
   autodeclarada).

2. **`npm run db:dump` y el primer respaldo real.** `scripts/db-dump.mjs`, la entrada en
   `package.json` y el JSON de `yrzosefjyiwybtdyquhi` versionado.
   _Este paso ya salva los datos de hoy, antes de tocar una línea de SQL_ — que es el orden que
   importa si el proyecto muere mañana por la mañana.
   _Verificación:_ los `counts` del JSON cuadran con un `count(*)` por tabla vía MCP.

3. **La migración y su reflejo.** `20260914143000_legacy_sessions.sql` con la tabla, la
   política, el índice y la vista reescrita; y la sección 11 de `supabase/schema.sql` más el
   cuerpo nuevo de su sección 10, **en el mismo commit**.
   _Verificación:_ aplicada por MCP, `/salon` se ve exactamente igual con la tabla vacía.

4. **`npm run db:restore`.** Generación del `.sql` en lotes de 500 con
   `on conflict (id) do nothing`, resolución del `username` en JS contra los `profiles` del
   propio JSON, validación contra los `check` y escapado de comillas antes de emitir, y el
   modo `--verificar`.

5. **`db-check.mjs`.** `compruebaRelacion("legacy_sessions", "id")`, el insert anónimo contra
   ella, y la FASE 4 del dashboard: `GET /auth/v1/settings` para `mailer_autoconfirm`,
   `external.email`, `disable_signup` y
   `external.google` / `external.github`; lo que ese endpoint no expone se imprime como «no
   verificable desde fuera» con su paso del README.

6. **`supabase/README.md`.** El paso **0** («respalda antes de nada») y el paso **7**
   («devuelve el histórico»), y reescribir la tabla de «qué no se recupera»: las partidas ahora
   **sí**, si hay respaldo.

7. **`CLAUDE.md`, `.gitignore` y `MODELO.md` al día.** La sección Supabase con los dos scripts,
   la tabla nueva y el paso 7; y el comentario de `.gitignore` sobre qué se versiona de
   `supabase/`, que hoy dice «`migrations/`, `schema.sql` y `README.md`» y se queda corto.

8. **El ensayo de mudanza.** Ver los criterios de aceptación.

---

## Criterios de aceptación

### Build

- [ ] `npm run test:run` en verde, y las pruebas siguen sin tocar la red.
- [ ] `npm run lint` sin errores ni avisos nuevos.
- [ ] `npx tsc --noEmit` sin errores.
- [ ] `npm run build` completa con Turbopack.
- [ ] Ninguno de los dos scripts nuevos añade una dependencia a `package.json`.

### `legacy_sessions` y la vista

- [ ] La tabla existe con las once columnas del DDL de arriba.
- [ ] `legacy_sessions.user_id` **no** tiene clave foránea a `auth.users`.
- [ ] `id` y `created_at` **no** tienen valor por defecto.
- [ ] RLS está activada y la tabla tiene **exactamente una** política, de `select`.
- [ ] Un `insert` con la _publishable key_ sobre `legacy_sessions` devuelve `42501`, **no**
      `23503`: sin FK no hay nada que pueda enmascarar el veredicto de la RLS.
- [ ] `game_leaderboard` devuelve las mismas seis columnas, en el mismo orden y del mismo tipo
      que antes de esta spec.
- [ ] Con `legacy_sessions` vacía, `/salon` muestra **exactamente** lo mismo que antes.
- [ ] Una partida heredada de un jugador que ya no existe aparece en su ranking con su nombre.
- [ ] Un jugador con marca vieja y marca nueva aparece en **una sola fila**, con la mejor de
      las dos.
- [ ] Ese mismo jugador, consultado por `getPlayerBest()` con su `user_id` actual, recibe su
      mejor marca y no `null`.
- [ ] La vista **no devuelve dos filas con el mismo `(game_id, user_id)`**, comprobado con un
      `group by game_id, user_id having count(*) > 1` sobre una base con histórico restaurado.
      Es la garantía de la que dependen el `.maybeSingle()` de `getPlayerBest()` y la
      `key={r.userId}` del Salón, y al agrupar por `username` deja de imponerla el esquema.
- [ ] `/salon` no emite ningún aviso de clave de React duplicada con el histórico cargado.
- [ ] `schema.sql` sigue sin un solo `drop table`, `drop schema` ni `truncate`.
- [ ] Ejecutar `schema.sql` dos veces seguidas sobre una base con datos no da error y no borra
      ni una fila.

### `db:dump`

- [ ] Escribe `supabase/backup/<fecha>-<project_ref>.json` y lo deja **versionado** en git.
- [ ] El JSON incluye `profiles`, `game_sessions` **y** `legacy_sessions`.
- [ ] Los `counts` del JSON cuadran con un `count(*)` por tabla consultado por MCP.
- [ ] Con más de 1 000 filas en una tabla, las vuelca todas: pagina, no se queda en el tope de
      PostgREST.
- [ ] Contra un proyecto vivo y vacío escribe el JSON con los `counts` a cero y **sale 0**.
- [ ] Contra un host que no resuelve, nombra el host, remite al README y sale `1` **sin
      escribir ningún archivo**.

### `db:restore`

- [ ] Sin argumentos coge el JSON más reciente de `supabase/backup/` y dice cuál ha cogido.
- [ ] **No escribe en la base de datos.** Genera `supabase/backup/<fecha>-restaurar.sql` y lo
      dice por consola.
- [ ] El `.sql` generado se pega en el editor SQL sin un solo error.
- [ ] Pegarlo **dos veces** no duplica ni una fila (`on conflict (id) do nothing`).
- [ ] Una partida cuyo perfil no está en el JSON se descarta con aviso; el `username` nunca se
      inventa.
- [ ] Una fila que no cumple los `check` (por ejemplo `score` negativo) aborta la generación,
      nombra la fila y **no deja un `.sql` a medias**.
- [ ] Un `username` con comilla simple sale escapado y el SQL sigue siendo válido.
- [ ] Un JSON con `version` distinta de 1 se rechaza con un mensaje que lo explica.
- [ ] `--verificar` compara el número de filas y el `max(score)` por `game_id` contra el JSON, y
      sale `1` si no cuadran.

### `db:check`

- [ ] Lista `legacy_sessions` entre las relaciones comprobadas.
- [ ] Prueba el insert anónimo contra `legacy_sessions` y exige `42501`.
- [ ] La FASE 4 informa de los **cinco** campos que el endpoint sí trae: `mailer_autoconfirm`,
      `external.email`, `disable_signup`, `external.google` y `external.github`.
- [ ] `external.email === false` es **fallo**: es el interruptor de cabecera de la tarjeta
      _Email_ del dashboard, el que el runbook avisa de no apagar, y con él apagado el registro
      devuelve `email_provider_disabled`.
- [ ] `disable_signup === true` es **fallo**: nadie puede registrarse.
- [ ] Junto a los proveedores dice que `true` significa «activado», **no** «sus credenciales
      sirven».
- [ ] Lo que `/auth/v1/settings` no expone —_Redirect URLs_, longitud mínima de contraseña,
      _leaked password protection_ y los rate limits— se imprime como **«no verificable desde
      fuera»** con su paso del README, y nunca como un veredicto.
- [ ] Un campo ausente en la respuesta se trata como «no verificable», no como un fallo.
- [ ] La FASE 4 **no suma problemas** salvo los tres que impiden registrarse:
      `mailer_autoconfirm === false`, `external.email === false` y `disable_signup === true`.
- [ ] Contra el proyecto completo sale `0`.

### El ensayo de mudanza

Es la única prueba que vale, y se hace sobre una **rama de base de datos**
(`mcp__supabase__create_branch`), que es limpia y desechable y no gasta un proyecto del plan
gratuito.

- [ ] `npm run db:dump` contra el proyecto vivo, con datos reales dentro.
- [ ] `supabase/schema.sql` entero en la rama, sin errores.
- [ ] `npm run db:restore` y el `.sql` generado en la rama, sin errores.
- [ ] Los dos archivos **otra vez**, sin errores y sin filas duplicadas.
- [ ] `npm run db:check` contra la rama, verde.
- [ ] `/salon` enseña las partidas heredadas **sin que se haya tocado una línea de `app/`**.
- [ ] Registrarse con un username que ya esté en el histórico, jugar una partida, y ver una
      sola fila con la mejor de las dos marcas.
- [ ] La rama se borra al terminar (`mcp__supabase__delete_branch`).

### Lo que no debe romperse

- [ ] Ningún archivo de `app/` cambia. Tampoco `proxy.ts`.
- [ ] Los cuatro archivos de `supabase/migrations/` anteriores no se modifican.
- [ ] Las cuatro políticas de `profiles` y `game_sessions` siguen con sus nombres exactos.
- [ ] `handle_new_user()` sigue `security definer` con `search_path = ''`, y el `revoke` de la
      sección 4b sigue puesto.
- [ ] `game_sessions` sigue sin políticas de `update` ni `delete`.
- [ ] `profiles` sigue sin política de `insert`.
- [ ] `mcp__supabase__get_advisors` de seguridad no devuelve ningún WARN nuevo.

---

## Decisiones

- **Sí: una tabla aparte y no reinsertar en `game_sessions`.** Es la decisión de la que cuelga
  todo lo demás. Meter una partida vieja en `game_sessions` exige fabricar su `auth.users`, y
  eso exige la `service_role` key. Una tabla sin FK cuesta once columnas y cero secretos.
- **Sí: el `username` desnormalizado dentro de la tabla.** Es la única forma de que el nombre
  sobreviva a la desaparición de su cuenta. Rompe la normalización a propósito: un archivo
  histórico no se normaliza contra tablas que ya no existen.
- **Sí: ninguna política de escritura, y ya está.** Se consideró una política de `insert` para
  que el script escribiese por REST, y se descartó: abre una ventana en la que cualquiera
  puede falsificar el histórico, y un olvido la deja abierta para siempre. Sin política, la
  tabla es inescribible por la API **por construcción**, no por vigilancia.
- **Sí: el script genera SQL en vez de insertar.** Es el mismo gesto que el paso 2 del runbook
  —pegar un `.sql` en el editor—, así que no añade un paso de naturaleza nueva a la mudanza. Y
  deja el archivo a la vista antes de ejecutarlo, que es lo que uno quiere de algo que va a
  escribir cientos de filas.
- **Sí: `on conflict (id) do nothing`.** Los `id` son `uuid` generados por
  `gen_random_uuid()`, así que colisionar entre proyectos es imposible en la práctica y el
  `id` original identifica la partida para siempre. Eso hace la importación idempotente con
  una cláusula, igual que `schema.sql` lo es con `if not exists`.
- **Sí: `distinct on (game_id, username)` en la vista.** Es lo que hace que un jugador que
  vuelve tenga una fila y no dos. El coste está en Riesgos y se asume.
- **Sí: `coalesce(p.id, ls.user_id)`.** Sin esa línea el Salón quedaría coherente y la ficha
  de jugador no, que es el peor de los dos mundos. Resolver al leer no es reasignar: no escribe
  nada y se puede quitar sin migrar.
- **Sí: el respaldo versionado en git.** Es el único sitio que sobrevive a que mueran a la vez
  el proyecto de Supabase y esta máquina, que es literalmente el escenario del que trata esta
  spec. Contiene usernames de diez caracteres y puntuaciones —lo que el Salón ya publica— y ni
  un correo ni una contraseña.
- **Sí: volcar `legacy_sessions` en el respaldo.** Un respaldo que no se respalda a sí mismo
  solo aplaza la pérdida.
- **Sí: `version: 1` en el JSON.** Cuesta una línea hoy y es lo que permite cambiar el formato
  mañana sin que un respaldo viejo se lea mal en silencio.
- **Sí: «paso 0» y «paso 7», y no renumerar del 1 al 8.** Es feo a propósito. Los seis pasos
  actuales están referenciados por número desde cinco sitios —`scripts/db-check.mjs` (pasos 1,
  2, 4 y 6), `CLAUDE.md` (2 y 3), `README.md` (3c y 3d), `.claude/memoria/security-auditor.md`
  (3b y 3d) y **`app/auth/errores.ts`** (3d)—. Renumerar obligaría a tocar un archivo de
  `app/`, que esta spec promete no tocar, y a reescribir cuatro filas de la memoria de un
  subagente. Un paso 0 antes del 1 y un paso 7 después del 6 no mueven ni una referencia.
- **Sí: la FASE 4 avisa pero no suspende.** Un rate limit flojo no es un esquema incompleto, y
  hacer que `db:check` salga `1` por eso enseñaría a ignorar su salida. La excepción es
  `mailer_autoconfirm === false`, porque con eso `signUp` no devuelve sesión y la aplicación
  sencillamente no funciona.
- **No: la `service_role` key.** Resolvería el problema de las identidades de verdad, pero
  mete en `.env` una clave que se salta toda la RLS, y el repo entero está construido sobre no
  tener ninguna (`db-check.mjs` usa la _publishable_ **a propósito**, para ver lo que ve la
  app).
- **No: reasignar las partidas al volver a registrarse.** Haría falta un trigger sobre
  `auth.users` que escribiese en `game_sessions`, y cualquiera que registrase el username de
  otro heredaría sus marcas. La resolución al leer da el mismo resultado visible sin escribir
  ni una fila ni abrir ese agujero.
- **No: restaurar `profiles`.** Un perfil sin su fila en `auth.users` es basura que además
  chocaría con el trigger si ese correo se vuelve a registrar.
- **No: el CLI de Supabase.** `supabase db dump` haría este trabajo, pero exige instalarlo,
  `supabase link`, la contraseña de la base y, en el plan gratuito, un puerto que puede no
  estar. La SPEC 15 ya eligió no depender de él y esa elección se sostiene.
- **No: `pg_dump`.** Mismo motivo, más Postgres instalado en la máquina.
- **No: respaldos automáticos.** Un cron o un hook `Stop` que vuelca la base en cada turno
  llenaría el repo de JSON casi idénticos. `db:dump` se lanza cuando hay algo que salvar, que
  es antes de una mudanza y de vez en cuando.
- **No: `unique` en `profiles.username`.** Arreglaría el efecto lateral del `distinct on`, pero
  es un cambio destructivo sobre una tabla con datos —si hoy hay dos nombres iguales, la
  migración falla— y afecta al registro, no a la migración. Otra spec.
- **No: automatizar el dashboard con la Management API.** Otro token, otro secreto, y una API
  que cambia sin aviso para ahorrar cuatro clics que se dan una vez cada mudanza.

---

## Riesgos

| Riesgo                                                                                                                                                                                                                                                                                                                                                  | Mitigación                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`create or replace view` falla si cambian el nombre, el tipo o el orden de las columnas**, y el error habla de tipos, no de lo que pasa.                                                                                                                                                                                                              | Las seis columnas se mantienen idénticas; es criterio de aceptación explícito y el ensayo de mudanza lo ejecuta de verdad. Si algún día hay que cambiarlas, primero un `drop view`.                                                                                                                                                                                                                        |
| **Dos jugadores VIVOS distintos con el mismo `username`**: uno de los dos **desaparece** del ranking y `getPlayerBest()` le devuelve `null`, o sea que ve «sin marca» teniendo partidas. No es que se «fundan»: hay un perdedor silencioso. `username` no es `unique` y el trigger lo corta a 10 caracteres en mayúsculas, así que colisionar es fácil. | Se documenta en `MODELO.md` y en Decisiones, con estas palabras. Es el precio de unir por nombre, que es lo único que sobrevive a la mudanza. Poner `unique` en `profiles.username` lo arreglaría y es otra spec, destructiva: si hoy ya hay dos nombres iguales, esa migración falla. **Antes de implementar, comprobar con un `group by username having count(*) > 1` si el caso existe ya en la base.** |
| **El `.sql` generado se pega a ciegas** en el editor SQL, que corre como `postgres` y se salta toda la RLS.                                                                                                                                                                                                                                             | El script valida cada fila contra los `check` antes de emitir, escapa las comillas, y si algo no cuadra **no escribe el archivo**. Y lo que emite son solo `insert` sobre una tabla: ni un `drop`, ni un `update`.                                                                                                                                                                                         |
| **Un respaldo viejo restaurado sobre una base que ya lo tiene** duplicaría el histórico.                                                                                                                                                                                                                                                                | `on conflict (id) do nothing` sobre la clave primaria. Idempotente por construcción, y es criterio de aceptación pegarlo dos veces.                                                                                                                                                                                                                                                                        |
| **El JSON versionado crece sin límite** conforme se acumulan partidas.                                                                                                                                                                                                                                                                                  | Una fila son ~200 bytes: con miles de partidas son cientos de KB. Si algún día molesta se podan los respaldos viejos a mano; no se automatiza nada hoy.                                                                                                                                                                                                                                                    |
| **`/auth/v1/settings` no es una API con contrato** y puede cambiar de forma.                                                                                                                                                                                                                                                                            | Campo ausente → «no verificable», nunca un veredicto inventado. Y la FASE 4 no suma problemas salvo `mailer_autoconfirm`, así que un cambio de forma no rompe `db:check`.                                                                                                                                                                                                                                  |
| **El respaldo se hace tarde.** Un proyecto del plan gratuito desaparece sin avisar, y `db:dump` no sirve de nada si se lanza el día después.                                                                                                                                                                                                            | El paso 2 del plan salva los datos de hoy antes de escribir una línea de SQL, y el paso **0** del runbook es «respalda antes de nada». Más que eso serían respaldos automáticos, que están fuera a propósito.                                                                                                                                                                                              |
| **`legacy_sessions` es la primera tabla que se llena desde fuera de la app**, y nadie la vigila.                                                                                                                                                                                                                                                        | Su insert anónimo entra en `db:check`, y ahí —al no haber FK— un `42501` significa exactamente lo que dice, sin el `23503` que puede enmascarar el de `game_sessions`.                                                                                                                                                                                                                                     |

---

## Lo que **no** está en esta spec

- Recrear las cuentas de `auth.users`. Los correos y las contraseñas del proyecto perdido no
  vuelven, y esta spec no lo intenta.
- Restaurar `profiles`.
- Cualquier cambio en `app/`.
- Respaldos automáticos: cron, hook `Stop` o GitHub Action.
- Automatizar la configuración del dashboard con la Management API.
- Poner `unique` en `profiles.username`.
- Tipos TypeScript generados desde el esquema.
- Instalar el CLI de Supabase o versionar `supabase/config.toml`.
- El timeout de `proxy.ts` con Supabase caído, que sigue pendiente desde la SPEC 15.
- Refrescar la foto de `game_sessions` de `references/implemented-game/implemented-games.md`.
- Dar de alta el control de RLS de `legacy_sessions` en `.claude/memoria/security-auditor.md`:
  eso es trabajo del agente, no de la spec.
- Dejar el plan gratuito, que sigue siendo la única solución de verdad al problema de fondo.

Cada una de ellas, si llega, en su propia spec.
