# SPEC 15 — ESQUEMA PORTÁTIL: mudarse de proyecto de Supabase sin reconstruir nada a mano

> **Estado:** Implementado
> **Depende de:** SPEC 04, SPEC 06, SPEC 07
> **Fecha:** 2026-09-03
> **Objetivo:** que recrear la base de datos completa en un proyecto de Supabase nuevo sea pegar un archivo SQL, seguir un checklist de seis pasos y comprobar el resultado con un comando, en vez de reconstruir diez objetos leyendo tres migraciones.

---

## Por qué existe esta spec

El 2 de septiembre de 2026 la app dejó de arrancar. El log del `npm run dev` daba dos
`AuthRetryableFetchError: fetch failed` y un `GET /auth 200 in 34.5s` del que **34.0 s eran de
`proxy.ts`**. El código estaba intacto: 337 pruebas en verde y `npx tsc --noEmit` sin una queja.
Lo que había desaparecido era el host:

```
Resolve-DnsName dkyghnxmytbfuopxlefe.supabase.co  → timeout
Resolve-DnsName ... -Server 8.8.8.8               → "El nombre DNS no existe"
Resolve-DnsName supabase.co                       → 76.76.21.21 (la red iba bien)
```

El proyecto de Supabase ya no estaba. Es el precio del plan gratuito, y **no es un accidente
que vaya a ocurrir una sola vez**: mientras el portal siga en ese plan, cada temporada de
inactividad puede terminar igual. La pregunta que abre esta spec no es «cómo evitarlo» sino
«cuánto cuesta volver».

Hoy cuesta demasiado, y por tres motivos distintos:

1. **El esquema está repartido en tres migraciones que no son reejecutables.** `supabase/migrations/`
   es un buen histórico —cada archivo cuenta de qué SPEC salió y por qué—, pero está escrito con
   `create table public.profiles (...)` a secas. Aplicarlas en orden funciona una vez; si te
   equivocas de pestaña, si una falla a medias o si repites por si acaso, revientan con
   `already exists` y te toca averiguar por dónde ibas.
2. **La mitad del trabajo no es SQL.** El `project_ref` está escrito en **tres archivos**
   (`.env`, `.env.example` y la URL del MCP en `.mcp.json`), y hay una casilla del dashboard
   —_Confirm email_ desactivado— que el CLAUDE.md ya identifica como «configuración que el repo
   no puede fijar» y sin la cual `signUp` no devuelve sesión. Nada de eso está en las migraciones,
   y es justo lo que se olvida.
3. **No hay forma de saber si quedó bien** salvo abrir la app y jugar. El diagnóstico de ayer
   —distinguir «Supabase está caído» de «hay un bug en el último cambio»— costó varios comandos
   de DNS y una consulta al MCP. Debería costar un `npm run db:check`.

Lo que hace barata esta spec es que **el esquema ya está escrito y no se toca**. No hay columna
nueva, ni política nueva, ni migración nueva. Es una spec de logística: coger lo que ya existe,
dejarlo en una forma que se pueda ejecutar tantas veces como haga falta, escribir al lado el
checklist de lo que el SQL no puede cubrir, y añadir el comando que dice si todo eso salió bien.

---

## Alcance

**Dentro:**

- **`supabase/schema.sql`** — el esquema completo de un tirón, **idempotente y no destructivo**:
  ejecutarlo dos veces seguidas no da error ni borra datos.
- **`supabase/README.md`** — el runbook de mudanza, con los seis pasos y las **tres vías** de
  ejecutar el SQL (editor del dashboard, MCP y CLI).
- **`scripts/db-check.mjs` y `npm run db:check`** — el verificador: dice si el esquema está
  completo y si la RLS está puesta, y distingue «no se puede conectar» de «falta algo».
- **La regla de sincronía**, escrita donde se lee: cada migración nueva se refleja en
  `schema.sql`, que si no se queda viejo en silencio.
- **Enlaces de una línea** al runbook desde `README.md` y `CLAUDE.md`.
- **Entradas del CLI en `.gitignore`** (`supabase/config.toml`, `supabase/.branches/`,
  `supabase/.temp/`), que es lo que genera `supabase link` y no debe versionarse.

**Fuera de alcance (para specs futuras):**

- **Cambiar el esquema.** Ni una columna, ni una política, ni un índice. `schema.sql` es el
  reflejo exacto de las tres migraciones actuales; si difiere, es un bug de esta spec.
- **Borrar o reescribir `supabase/migrations/`.** El histórico se queda intacto: es lo que
  explica el _porqué_ de cada objeto, y `schema.sql` solo dice el _qué_.
- **Migrar los datos del proyecto viejo.** Las partidas y las cuentas del proyecto perdido no
  se recuperan; el runbook lo dice con todas las letras en vez de dejarlo suponer.
- **Semillas de datos de prueba.** El Salón de la Fama sale vacío tras la mudanza, y eso es
  correcto: `game_sessions` referencia `auth.users`, así que sembrarlo obligaría a fabricar
  usuarios falsos en una tabla del sistema.
- **El timeout de `proxy.ts`.** Que la app tarde 34 s por request cuando Supabase no responde
  es el mismo síntoma, pero es un cambio de aplicación y no de base de datos. Merece su propia
  spec.
- **Versionar `supabase/config.toml`.** Metería el `project_ref` en un cuarto archivo y le
  añadiría una casilla al checklist. El runbook manda `supabase link --project-ref` en su lugar.
- **Automatizar la configuración del dashboard.** _Confirm email_ se desactiva a mano; es un
  paso del runbook, no código.
- **Dejar de estar en el plan gratuito.** Esta spec asume que la pausa volverá a pasar. Ese es
  su punto de partida, no un problema que resuelva.

---

## Modelo de datos

**Esta spec no introduce ninguna estructura nueva.** Consolida las que ya existen. Lo que sí
fija es el **inventario cerrado** de lo que `schema.sql` tiene que dejar en pie —diez objetos—,
porque es contra esta lista contra la que se escribe el verificador:

| #   | Objeto                               | Tipo                                           | De dónde viene |
| --- | ------------------------------------ | ---------------------------------------------- | -------------- |
| 1   | `public.profiles`                    | tabla                                          | SPEC 04        |
| 2   | `perfiles legibles por cualquiera`   | política `select` sobre `profiles`             | SPEC 04        |
| 3   | `cada usuario edita su perfil`       | política `update` sobre `profiles`             | SPEC 04        |
| 4   | `public.handle_new_user()`           | función `security definer`, `search_path = ''` | SPEC 04        |
| 5   | `on_auth_user_created`               | trigger `after insert` sobre `auth.users`      | SPEC 04        |
| 6   | `public.game_sessions`               | tabla                                          | SPEC 06        |
| 7   | `partidas legibles por cualquiera`   | política `select` sobre `game_sessions`        | SPEC 06        |
| 8   | `cada usuario registra sus partidas` | política `insert` sobre `game_sessions`        | SPEC 06        |
| 9   | `game_sessions_game_score_idx`       | índice `(game_id, score desc)`                 | SPEC 06        |
| 10  | `public.game_leaderboard`            | vista con `security_invoker = on`              | SPEC 07        |

Más las dos líneas de `alter table ... enable row level security`, que no son objetos pero sin
las cuales las cuatro políticas no pintan nada.

**Lo que deliberadamente NO está en la lista**: ninguna política de `update` ni `delete` sobre
`game_sessions`. Es una decisión de la SPEC 06 —«una partida jugada es un hecho, no un registro
editable»— y `schema.sql` la hereda tal cual. Que falten no es un olvido que haya que completar.

### Cómo se vuelve idempotente cada tipo de objeto

No hay una sola técnica: Postgres ofrece cosas distintas según el objeto, y dos de las diez
entradas de arriba **no admiten `if not exists`**. Esta es la tabla que resuelve el archivo:

| Objeto                      | Técnica                                                             | Por qué esa                                                                                                                                                                  |
| --------------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tablas                      | `create table if not exists`                                        | La forma estándar. **Ojo:** si la tabla ya existe con otra forma, no la corrige — ver _Riesgos_.                                                                             |
| `enable row level security` | Se ejecuta siempre                                                  | Activarlo dos veces no es error.                                                                                                                                             |
| Políticas                   | `drop policy if exists` y luego `create policy`                     | `create policy` **no** tiene `if not exists`; y el `drop` previo hace que una política editada se actualice de verdad.                                                       |
| Función                     | `create or replace function`                                        | Sustituye el cuerpo sin tocar el trigger que la usa.                                                                                                                         |
| Trigger                     | `drop trigger if exists ... on auth.users` y luego `create trigger` | Se evita `create or replace trigger` (PG14+) a propósito: el `drop` funciona en cualquier versión y deja el archivo pegable en un proyecto de cualquier edad.                |
| Índice                      | `create index if not exists`                                        | Directo.                                                                                                                                                                     |
| Vista                       | `create or replace view`                                            | **Con un aviso escrito en el archivo:** `or replace` falla si cambian el nombre, el tipo o el orden de las columnas. Si la vista cambia de forma, hay que `drop view` antes. |

Las políticas se identifican **por su nombre exacto en español**, comillas dobles incluidas.
Renombrar una en `schema.sql` sin renombrarla en la migración correspondiente deja dos políticas
distintas conviviendo, y el `select` público empieza a depender de cuál se aplicó por última vez.

### Archivos que aparecen o cambian

**Nuevos:**

| Archivo                | Qué es                                                                |
| ---------------------- | --------------------------------------------------------------------- |
| `supabase/schema.sql`  | El esquema completo, idempotente. Es lo que se pega en el editor SQL. |
| `supabase/README.md`   | El runbook de mudanza: seis pasos y las tres vías de ejecución.       |
| `scripts/db-check.mjs` | El verificador. Primer archivo de `scripts/`, que hoy no existe.      |

**Modificados:**

| Archivo        | Cambio                                                                                                 |
| -------------- | ------------------------------------------------------------------------------------------------------ |
| `package.json` | Un script: `"db:check": "node --env-file=.env scripts/db-check.mjs"`. **Sin dependencias nuevas.**     |
| `.gitignore`   | Tres entradas del CLI de Supabase.                                                                     |
| `README.md`    | Un enlace al runbook, junto a donde ya explica de dónde salen las variables de entorno.                |
| `CLAUDE.md`    | Un enlace al runbook en la sección **Supabase**, y la regla de sincronía `schema.sql` ↔ `migrations/`. |

**Intactos**, y conviene decirlo porque es la mitad del valor de la spec: `supabase/migrations/`
(los tres archivos, byte a byte), todo `app/`, `proxy.ts`, `tests/` y la suite de Vitest.

### El verificador, por dentro

`scripts/db-check.mjs` corre en Node, sin TypeScript ni build, y usa el
`@supabase/supabase-js` que el proyecto **ya tiene como dependencia directa**. Lee
`NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` del entorno, que el script
de npm inyecta con `node --env-file=.env` (soportado desde Node 20.6; aquí corre Node 20.19.5),
así que **no hace falta `dotenv`**.

Usa la _publishable key_ y no la contraseña de la base **a propósito**: así comprueba lo que ve
la aplicación, con la RLS aplicada, y no lo que vería un superusuario que se salta las políticas.

Corre en dos fases:

**Fase 1 — ¿existe el proyecto?** Antes de tocar Supabase hace un `dns.lookup()` del host de la
URL y luego un `fetch` a `/auth/v1/health` con un `AbortSignal.timeout` de 8 s. Esta fase es la
que convierte el fallo de ayer en una frase legible en vez de en tres consultas fallidas:

```
X No se pudo conectar a dkyghnxmytbfuopxlefe.supabase.co
  (el nombre DNS no existe)

  El proyecto puede estar pausado o eliminado.
  Ver supabase/README.md, paso 1.
```

**Fase 2 — ¿está completo el esquema?** Solo si la fase 1 pasa. Cinco comprobaciones:

| Comprobación                | Cómo                                | Veredicto                                                                                                         |
| --------------------------- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `profiles` responde         | `select id limit 1`                 | error `42P01` → _falta la tabla_                                                                                  |
| `game_sessions` responde    | `select id limit 1`                 | ídem                                                                                                              |
| `game_leaderboard` responde | `select game_id limit 1`            | ídem, y cubre que la vista exista                                                                                 |
| RLS activa                  | `insert` anónimo en `game_sessions` | debe ser **rechazado** (`42501`). Si pasa, es el fallo más grave posible: cualquiera puede escribir marcas ajenas |
| Trigger de perfiles         | —                                   | se informa como **no verificable** sin registrar un usuario, y se remite al paso 6 del runbook                    |

Una tabla vacía es un resultado **correcto**: se comprueba que la consulta responda, no que
haya filas. Salida `0` si todo va bien, `1` en cualquier otro caso.

---

## Plan de implementación

Cada paso deja el repositorio en un estado utilizable por sí mismo.

1. **Escribir `supabase/schema.sql`.** Los diez objetos en orden de dependencia
   (`profiles` → función → trigger → `game_sessions` → índice → vista), con la técnica de
   idempotencia que le toca a cada uno según la tabla de arriba. Cabecera con qué es el archivo,
   de qué specs sale y la advertencia del `create or replace view`. Se conservan los comentarios
   que explican el _porqué_ (el orden del `DISTINCT ON`, el `security_invoker`, por qué no hay
   política de `insert` en `profiles`): son la parte que evita que alguien «arregle» el archivo
   y rompa un ranking en silencio. **Verificación del paso:** un diff a mano contra las tres
   migraciones, objeto por objeto, sin ninguna diferencia salvo las cláusulas de idempotencia.

2. **Escribir `scripts/db-check.mjs` y añadir `db:check` a `package.json`.** Las dos fases
   descritas arriba. Con el `.env` apuntando a un proyecto muerto debe imprimir el mensaje de la
   fase 1; contra un proyecto vivo y completo, las cinco líneas en verde. **Verificación del
   paso:** se ejecuta y se comprueban los dos caminos.

3. **Escribir `supabase/README.md`.** Los seis pasos del runbook:

   | Paso | Qué se hace                                                                                                                                                                                                       |
   | ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
   | 1    | Mirar si el proyecto solo está **pausado**: si sale _Restore_ en el dashboard, se restaura y no hay mudanza que hacer. Solo si desapareció, se crea uno nuevo y se anota el `project ref` y la _publishable key_. |
   | 2    | Ejecutar `supabase/schema.sql` por **una** de las tres vías (ver abajo).                                                                                                                                          |
   | 3    | Desactivar _Confirm email_ en **Authentication → Sign In / Providers → Email**. Sin esto `signUp` no devuelve sesión y el registro parece funcionar pero no entra nadie.                                          |
   | 4    | Actualizar el `project_ref` en los **tres** archivos: `.env`, `.env.example` y la URL de `.mcp.json`.                                                                                                             |
   | 5    | `npm run db:check` hasta que salga en verde.                                                                                                                                                                      |
   | 6    | `npm run dev`, registrar una cuenta nueva, jugar una partida y comprobar que aparece en `/salon`. Es el único paso que prueba el trigger `on_auth_user_created` de punta a punta.                                 |

   Y las tres vías del paso 2, en orden de menos a más requisitos:
   - **Editor SQL del dashboard** (el camino por defecto): copiar el archivo entero, pegar,
     _Run_. Cero dependencias y disponible en el minuto uno de un proyecto recién creado.
   - **MCP de Supabase**: con el `project_ref` ya actualizado en `.mcp.json` y el servidor
     habilitado en `.claude/settings.local.json`, se aplica desde una sesión de Claude Code con
     `apply_migration`.
   - **CLI**: `supabase link --project-ref <nuevo>` y después `supabase db push`, que usa
     `SUPABASE_DB_PASS` —que ya está en `.env` justo para esto—. `config.toml` lo genera el CLI
     y se queda fuera del repo.

   El runbook dice además, sin rodeos, **qué no se recupera**: las cuentas y las partidas del
   proyecto anterior. Hay que registrarse de nuevo. Lo que sí sobrevive es el `av_scores` de
   `localStorage`, porque vive en el navegador.

4. **Cerrar los cabos del repo.** Las tres entradas del CLI en `.gitignore`; el enlace al
   runbook en `README.md`; y en `CLAUDE.md`, el enlace más la **regla de sincronía**: al añadir
   una migración hay que reflejarla en `schema.sql`, y `migrations/` sigue siendo el histórico
   con el porqué.

5. **Ejecutar la mudanza de verdad.** Los seis pasos del runbook sobre el proyecto nuevo, y con
   el portal ya funcionando, volver a lanzar `schema.sql` **una segunda vez** para demostrar la
   idempotencia sobre una base con datos dentro: debe terminar sin error y la partida registrada
   en el paso 6 debe seguir estando. Cualquier fricción encontrada en el camino se corrige en el
   runbook antes de dar la spec por implementada — un runbook que no se ha recorrido entero es
   una hipótesis, no un procedimiento.

---

## Criterios de aceptación

**`schema.sql`**

- [ ] Existe `supabase/schema.sql` y contiene los **diez** objetos de la tabla de inventario.
- [ ] Ejecutarlo sobre un proyecto vacío deja el esquema completo: `npm run db:check` da verde.
- [ ] Ejecutarlo **dos veces seguidas** termina sin error las dos veces.
- [ ] Ejecutarlo sobre una base **con datos** no borra ninguna fila de `profiles` ni de
      `game_sessions`.
- [ ] No contiene ningún `drop table`, ningún `drop schema` ni ningún `truncate`.
- [ ] Cada política se crea con su nombre en español **idéntico** al de la migración de origen.
- [ ] La vista se crea con `security_invoker = on` y su `order by` empieza por
      `gs.game_id, gs.user_id` (si no, el ranking sale mal sin dar error).
- [ ] La función `handle_new_user` conserva `security definer` y `set search_path = ''`.
- [ ] `game_sessions` conserva el `check` de `ended_reason in ('game_over', 'surrender')`.
- [ ] No hay política de `update` ni de `delete` sobre `game_sessions`.

**`db:check`**

- [ ] `npm run db:check` existe y **no** añadió dependencias a `package.json`.
- [ ] Contra un proyecto completo: sale `0` y lista las cinco comprobaciones.
- [ ] Contra un host que no resuelve: dice que no pudo conectar, nombra el host, remite a
      `supabase/README.md` y sale `1` — **sin** listar las tablas como fallidas.
- [ ] Contra un proyecto vivo pero con el esquema sin aplicar: dice qué relación falta y sale `1`.
- [ ] Si el `insert` anónimo en `game_sessions` **se acepta**, lo reporta como fallo grave y sale `1`.
- [ ] Una tabla existente pero vacía cuenta como **correcta**.

**Runbook y repo**

- [ ] `supabase/README.md` lista los seis pasos y las tres vías de ejecución.
- [ ] Nombra los **tres** archivos donde vive el `project_ref`, y el nombre exacto de la casilla
      _Confirm email_ con su ruta en el dashboard.
- [ ] Dice explícitamente que las cuentas y las partidas del proyecto anterior no se recuperan.
- [ ] `README.md` y `CLAUDE.md` enlazan al runbook.
- [ ] `CLAUDE.md` recoge la regla de sincronía `schema.sql` ↔ `migrations/`.
- [ ] `.gitignore` cubre `supabase/config.toml`, `supabase/.branches/` y `supabase/.temp/`.

**No regresión**

- [ ] Los tres archivos de `supabase/migrations/` están **sin modificar** (`git diff` vacío).
- [ ] `npm run test:run` sigue en verde y **no depende de la red**: no se añadió ninguna prueba
      que consulte Supabase.
- [ ] `npm run lint` y `npm run build` pasan.
- [ ] La mudanza completa se ha recorrido de verdad y el paso 6 terminó con una partida visible
      en `/salon`.

---

## Decisiones

**`schema.sql` se añade y `migrations/` se queda.** Se descartó consolidar y borrar el
histórico: las migraciones son las que explican _por qué_ el `order by` de la vista es ese, por
qué la función lleva `search_path = ''` y por qué no hay política de `insert` en `profiles`. Ese
texto vale más que la duplicación que se evitaría. El coste asumido es real —dos sitios que
mantener— y se paga con la regla de sincronía escrita en `CLAUDE.md`. También se descartó no
escribir SQL nuevo y limitarse a un script que concatenara las migraciones: **no son
idempotentes**, así que ese script solo habría servido para el caso perfecto, que es justo el
que no necesita ayuda.

**Idempotente y no destructivo, sin un `reset.sql` de compañía.** Un archivo que empieza con
`drop table ... cascade` es más predecible, y por eso mismo más peligroso: basta con tenerlo
abierto en la pestaña equivocada para borrar todas las partidas del proyecto bueno. Se valoró
escribir los dos archivos y se descartó por la misma razón: el destructivo se usaría una vez al
año y estaría ahí, a un clic, los otros 364 días. Si algún día hace falta arrasar, se escribe
en el momento.

**La _publishable key_ y no la contraseña de la base.** El verificador podría consultar
`pg_tables` y `pg_policies` con `pg` y comprobar objeto por objeto, lo cual sería más exhaustivo.
Se descartó por dos motivos: añade una dependencia, y sobre todo **comprobaría el esquema desde
un punto de vista que la app nunca tiene**. Un `select` que funciona como superusuario pero que
la RLS bloquearía para un anónimo es exactamente el fallo que se quiere detectar, y con `pg` no
se vería.

**El verificador es un script, no una prueba de Vitest.** Integrarlo en `npm run test:run` era
tentador, pero los hooks del repo corren la suite entera **en cada guardado** de un archivo
JS/TS. Una prueba que pega a la red convertiría cada guardado en algo que depende de internet y
de que el proyecto esté vivo, y con `Stop` devolviendo `decision: "block"` un corte de red
bloquearía el turno. El script se invoca cuando se necesita, que es tres veces al año.

**El trigger se declara «no verificable» en vez de probarse.** Comprobar
`on_auth_user_created` de verdad exige registrar un usuario, y el verificador dejaría basura en
`auth.users` en cada ejecución. Se prefiere una línea honesta que remite al paso 6 del runbook
—que sí lo prueba, jugando una partida— antes que una comprobación silenciosa que no comprueba
nada o una que ensucia la base.

**`supabase link` en vez de versionar `config.toml`.** Meter el archivo en el repo haría el CLI
más cómodo a cambio de que el `project_ref` viviera en **cuatro** sitios. El valor del paso 4
del runbook está en que la lista sea corta y se pueda comprobar de un vistazo; una casilla más
es una casilla más que olvidar, y olvidar esa deja el MCP o la app apuntando al proyecto muerto
con un error que no dice por qué.

**El runbook vive en `supabase/README.md`.** Junto al SQL que manda ejecutar. Se descartó el
`README.md` raíz porque el runbook es largo y solo se lee tres veces al año, y se descartó
ponerlo como comentario de cabecera del `.sql` porque entonces no se puede enlazar, y porque
son cuarenta líneas de instrucciones que acabarías pegando en el editor SQL cada vez.

**El timeout de `proxy.ts` queda fuera.** Es la otra mitad del incidente —con Supabase caído,
cada request tarda 34 s aunque la página no necesite sesión— y arreglarlo tiene sentido. Pero
es un cambio de comportamiento de la aplicación, con sus propias decisiones (¿cuántos segundos?,
¿qué pasa con la sesión que no se refresca?, ¿se avisa al usuario?), y mezclarlo aquí
convertiría una spec de logística en dos specs a medias.

**Sin semillas.** Un Salón de la Fama vacío tras la mudanza es la verdad. Sembrarlo obligaría a
crear usuarios en `auth.users` para satisfacer la clave foránea de `game_sessions`, es decir, a
fabricar cuentas falsas en una tabla del sistema para que una pantalla no se vea sosa.

---

## Riesgos

**`create table if not exists` no arregla una tabla que ya existe con otra forma.** Es el
límite real de la idempotencia elegida: si un proyecto tiene un `profiles` de una versión
anterior al que le falta una columna, el archivo pasa por encima sin decir nada y la app falla
después, en otro sitio. Se asume a conciencia —el caso de uso es un proyecto **recién creado y
vacío**— y se mitiga con `db:check`, que consulta las relaciones de verdad. Un verificador de
columna por columna sería el siguiente escalón si esto llega a morder.

**El `drop trigger ... on auth.users` necesita privilegios sobre un esquema del sistema.** En
el editor SQL del dashboard se ejecuta como `postgres` y funciona. Por el CLI, con la conexión
del `db push`, también. Pero si algún día se intenta desde una conexión con menos permisos,
ese es el punto donde va a fallar, y el mensaje de Postgres no será obvio. El archivo lleva un
comentario en esa línea diciéndolo.

**`create or replace view` es frágil ante un cambio de columnas.** Hoy no importa porque la
vista no cambia, pero si algún día `game_leaderboard` gana o pierde una columna, el `or replace`
fallará con un error que habla de tipos y no de lo que pasa. El aviso va escrito junto a la
sentencia.

**El `.env.example` todavía no está en el repositorio** (aparece como archivo sin seguimiento).
El paso 4 del runbook manda actualizarlo, así que conviene versionarlo al implementar esta spec
o el checklist apunta a un archivo que solo existe en esta máquina. Relacionado: `.gitignore`
menciona `.env.example` dos veces, una para ignorarlo y otra —la última, que es la que manda—
para reincluirlo; funciona, pero es confuso y merece limpiarse de paso.

**El runbook envejece con el dashboard.** «Authentication → Sign In / Providers → Email» es la
ruta de hoy en la interfaz de Supabase; si la mueven, el paso 3 apuntará a un sitio que no
existe. No hay forma de blindarlo: se mitiga nombrando también **qué** se busca (_Confirm
email_, desactivado) y no solo dónde está.

---

## Lo que **no** está en esta spec

- Evitar que el proyecto se vuelva a pausar. Esta spec asume que pasará otra vez.
- Copias de seguridad periódicas de `game_sessions`. Sería la spec que hace que una mudanza no
  cueste las partidas; hoy las cuesta, y el runbook lo dice.
- El timeout de `proxy.ts` y cualquier otra degradación elegante con Supabase caído.
- Cambios en el esquema, en la app, en las pruebas o en el reproductor.
