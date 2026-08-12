# SPEC 07 — Salón de la Fama con datos reales

> **Estado:** Aprobado
> **Depende de:** SPEC 04, SPEC 06
> **Fecha:** 2026-08-09
> **Objetivo:** Sustituir los rankings inventados de `/salon` por el Salón de la Fama real, leyendo la mejor marca de cada jugador desde una vista `game_leaderboard` sobre `game_sessions`.

---

## Por qué existe esta spec

`/salon` es hoy una pantalla completamente falsa. `seededScores(tab.length * 23 + 7, 12)` fabrica
doce filas deterministas a partir de la longitud del nombre del juego, y la fila "TU MEJOR MARCA"
llega más lejos: inventa el puesto con `Math.floor(8 + (tab.length % 4))` y la puntuación con
`rows[5].score - 2400`. Es decir, **la pantalla te dice que has quedado octavo en un juego que no
has jugado nunca**.

La SPEC 06 crea `game_sessions` y graba cada partida. Esta spec es la mitad que faltaba: leerlas.

Una advertencia sobre el orden: **la SPEC 06 todavía no está implementada**. Hasta que lo esté y
alguien juegue una partida, esta pantalla mostrará sus estados vacíos. Eso es correcto, no un
fallo.

---

## Alcance

**Dentro:**

- **Vista `public.game_leaderboard`** en una migración versionada: la mejor marca de cada jugador
  en cada juego, ya unida a `profiles` para traer el `username`.
- **Módulo de consulta** en `app/lib/leaderboard.ts`: `getLeaderboard()` para el top de un juego y
  `getPlayerBest()` para la marca y el puesto real del usuario.
- **`/salon` partido en dos** siguiendo el patrón del proyecto: `page.tsx` como Server Component
  que exporta `metadata` y carga el ranking inicial, y `salon-client.tsx` con la UI y las
  pestañas.
- **Las ocho pestañas se mantienen**; las de juegos sin partidas muestran un estado vacío.
- **Podio condicional**: solo aparece con tres marcas o más.
- **Fila "TU MEJOR MARCA" real**: puntuación y puesto calculados de verdad; si no has jugado ese
  juego, la fila invita a jugar en vez de inventar un número.
- **Top 12**, el mismo número de filas que hoy, para no tocar la composición.
- **Estados de carga y vacío** con CSS nuevo en `app/globals.css`.

**Fuera de alcance (para specs futuras):**

- **El top 10 del detalle `/juego/[id]`.** Sigue con `seededScores`; se aborda en otra spec.
- **El campo `best` de `GAMES`.** Sigue siendo el número mock en las tarjetas de la biblioteca y
  de la landing.
- **Mover el catálogo de juegos a Supabase.** `GAMES` y `CATS` siguen en `app/lib/data.ts`; no se
  crea ninguna tabla `games`. Eso toca seis archivos y es una spec entera.
- **Eliminar `seededScores` y `ScoreRow` de `data.ts`.** El detalle los sigue usando.
- **Paginación o "ver más".** El Salón muestra doce y punto.
- **Filtros por periodo** (hoy, esta semana, histórico).
- **Actualización en vivo** con Supabase Realtime.
- **El ticker "Actividad en vivo" de la landing** y el top de jugadores de la home, que siguen con
  las constantes de la SPEC 02.
- **Tests automatizados** (sigue sin haber runner configurado).

---

## Modelo de datos

No se crea ninguna tabla. Se añade **una vista** sobre `game_sessions`, la tabla que crea la
SPEC 06.

```sql
-- supabase/migrations/<timestamp>_game_leaderboard.sql

-- Mejor marca de cada jugador en cada juego. DISTINCT ON se queda con la
-- primera fila de cada grupo, de ahí que el ORDER BY empiece por las mismas
-- columnas del DISTINCT y siga por score desc.
-- En caso de empate gana la más antigua: quien lo consiguió primero.
create view public.game_leaderboard
with (security_invoker = on) as
select distinct on (gs.game_id, gs.user_id)
  gs.game_id,
  gs.user_id,
  p.username,
  gs.score,
  gs.level,
  gs.created_at
from public.game_sessions gs
join public.profiles p on p.id = gs.user_id
order by gs.game_id, gs.user_id, gs.score desc, gs.created_at asc;
```

`security_invoker = on` no es decorativo: sin él la vista se ejecuta con los permisos de su
propietario y **se salta las políticas RLS** de las tablas que consulta. Aquí no cambiaría el
resultado —`game_sessions` y `profiles` tienen lectura pública— pero deja la puerta abierta a una
fuga el día que alguna de las dos deje de serlo.

### Tipos y consultas

```ts
// app/lib/leaderboard.ts

export interface LeaderboardRow {
  rank: number; // 1..N, calculado al ordenar
  userId: string;
  username: string;
  score: number;
  level: number;
  date: string; // "dd/mm/aaaa", como el ScoreRow actual
}

export interface PlayerBest {
  rank: number; // puesto real en el ranking del juego
  score: number;
  date: string;
}

// El cliente se pasa como argumento para poder llamarlas tanto desde el
// Server Component como desde el componente cliente al cambiar de pestaña.
export async function getLeaderboard(
  supabase: SupabaseClient,
  gameId: string,
  limit = 12,
): Promise<LeaderboardRow[]>;

// Devuelve null si el jugador no tiene ninguna partida en ese juego.
export async function getPlayerBest(
  supabase: SupabaseClient,
  gameId: string,
  userId: string,
): Promise<PlayerBest | null>;
```

El puesto de `getPlayerBest` sale de un conteo: cuántas filas de `game_leaderboard` de ese juego
tienen una puntuación **mayor** que la tuya. El puesto es ese número más uno. Con empates, dos
jugadores comparten puesto; es el comportamiento clásico de una tabla arcade y se acepta.

`ScoreRow` y `seededScores` siguen en `data.ts` sin cambios, porque los usa el detalle.

---

## Plan de implementación

Cada paso deja la app ejecutable (`npm run dev` / `npm run build` sin errores) y es commiteable
por sí solo.

1. **Vista `game_leaderboard`.** Crear la migración con el SQL de arriba y aplicarla al proyecto
   remoto.
   Verificación: un `select * from public.game_leaderboard` responde sin error (vacío si aún no
   hay partidas), y `select` con la clave publicable también funciona.

2. **Módulo de consulta — ranking.** Crear `app/lib/leaderboard.ts` con `LeaderboardRow` y
   `getLeaderboard()`: filtra por `game_id`, ordena por `score` descendente, limita, y numera las
   posiciones formateando `created_at` como `dd/mm/aaaa`.
   Verificación: `npm run build` compila; el módulo aún no se usa.

3. **Módulo de consulta — marca del jugador.** Añadir `PlayerBest` y `getPlayerBest()`: busca la
   fila del jugador en la vista y, si existe, cuenta cuántas la superan para calcular el puesto.
   Verificación: `npm run build` compila.

4. **Partir `/salon` en servidor y cliente.** Mover la UI actual a
   `app/salon/salon-client.tsx` (`"use client"`) y dejar `app/salon/page.tsx` como Server
   Component que exporta `metadata` y renderiza el cliente. **Sin cambios de comportamiento
   todavía**: sigue usando `seededScores`.
   Verificación: `/salon` se ve y se comporta exactamente igual que antes, y ahora tiene título
   propio en la pestaña del navegador.

5. **Ranking real.** `page.tsx` carga el ranking del primer juego con
   `app/lib/supabase/server.ts` y se lo pasa al cliente como prop inicial. El cliente consulta con
   el cliente de navegador al cambiar de pestaña, con estado de carga. Se deja de llamar a
   `seededScores` en esta pantalla.
   Verificación: la pestaña de ROCAS muestra las partidas reales de `game_sessions`; cambiar de
   pestaña carga el ranking de ese juego.

6. **Podio condicional y estado vacío.** El podio solo se renderiza con tres marcas o más. Con una
   o dos, se muestra únicamente la tabla. Sin ninguna, un mensaje invitando a ser el primero.
   Verificación: un juego sin partidas no rompe la pantalla ni deja huecos; ROCAS con una sola
   partida muestra la tabla sin podio.

7. **Tu mejor marca.** Sustituir el puesto y la puntuación inventados por los de
   `getPlayerBest()`. Sin sesión, la fila no aparece, igual que hoy. Con sesión y sin partidas en
   ese juego, la fila invita a jugar.
   Verificación: tras jugar una partida, la fila muestra esa puntuación y un puesto coherente con
   la tabla de arriba.

8. **CSS de los estados nuevos.** Añadir a `app/globals.css` las clases del estado vacío y del
   estado de carga, reutilizando los tokens del tema y el patrón de `.hall-table`.
   Verificación: a 1280 px y a 375 px los estados vacío y de carga se ven alineados con el resto
   de la pantalla y no producen scroll horizontal.

---

## Criterios de aceptación

**Build y esquema**

- [ ] `npm run lint` y `npm run build` terminan sin errores ni warnings de tipos.
- [ ] La consola del navegador no muestra errores al cargar `/salon` ni al cambiar de pestaña.
- [ ] `supabase/migrations/` contiene el archivo de `game_leaderboard` y la vista existe en el
      proyecto remoto.
- [ ] La vista está creada con `security_invoker = on`.
- [ ] `/salon` tiene `metadata` propia y su título aparece en la pestaña del navegador.

**Ranking**

- [ ] La pestaña de un juego muestra las mejores marcas reales de `game_sessions`, no
      `seededScores`.
- [ ] Cada jugador aparece **una sola vez** por juego, con su puntuación más alta.
- [ ] Las filas están ordenadas de mayor a menor puntuación y numeradas del 1 en adelante.
- [ ] La tabla muestra como máximo 12 posiciones.
- [ ] El nombre mostrado es el `username` del perfil.
- [ ] La fecha mostrada corresponde a la partida en la que se consiguió esa marca.
- [ ] Jugar una partida nueva y volver a `/salon` refleja el cambio sin esperas ni recargas
      forzadas.

**Estados vacíos**

- [ ] Un juego sin ninguna partida muestra el mensaje de "sé el primero" y **no** rompe la
      pantalla.
- [ ] Con una o dos marcas se muestra la tabla y **no** se muestra el podio.
- [ ] Con tres o más marcas aparece el podio con los tres primeros.
- [ ] Cambiar de pestaña muestra un estado de carga y no deja la pantalla en blanco.

**Tu mejor marca**

- [ ] Sin sesión, la fila "TU MEJOR MARCA" no aparece.
- [ ] Con sesión y sin partidas en ese juego, la fila invita a jugar y no muestra ningún número.
- [ ] Con sesión y con partidas, la fila muestra tu mejor puntuación real en ese juego.
- [ ] El puesto de esa fila es coherente con la tabla: si tu marca es la mejor, pone `#01`.
- [ ] Ningún puesto ni puntuación de la pantalla es inventado.

**Lo que no debe romperse**

- [ ] Las ocho pestañas siguen presentes, con los mismos nombres de juego.
- [ ] El detalle `/juego/[id]` sigue mostrando su top 10 de `seededScores`.
- [ ] El campo `best` de las tarjetas de biblioteca y landing sigue mostrando el valor mock.
- [ ] `seededScores` y `ScoreRow` siguen existiendo en `app/lib/data.ts`.
- [ ] A 375 px la pantalla no produce scroll horizontal.

---

## Decisiones

**Alcance**

- **Sí:** esta spec solo lee. La escritura es la SPEC 06; separarlas mantiene un dominio por
  documento y permite verificar cada mitad por su cuenta.
- **No:** mover el catálogo de juegos a una tabla `games` de Supabase. Toca los seis archivos que
  consumen `GAMES` y obliga a convertir pantallas en Server Components; es una spec propia.
- **No:** cambiar el top del detalle ni el campo `best`. Cada uno añade su consulta y sus estados
  vacíos a pantallas que hoy no fallan.
- **Sí:** mantener las ocho pestañas aunque solo ROCAS tenga datos. La pantalla no cambia de forma
  y se va llenando según se implementen juegos.
- **No:** mezclar `seededScores` en las pestañas sin datos. Datos reales e inventados
  indistinguibles en la misma pantalla es peor que un hueco honesto.

**Consulta**

- **Sí:** una vista `game_leaderboard` con `DISTINCT ON`. La agrupación "máximo por jugador" es
  SQL, y en la base se escribe una vez y se versiona en la migración.
- **No:** agrupar en el cliente. Habría que traer todas las partidas del juego para que el
  resultado fuera correcto, y deja de serlo en cuanto haya más de las que quepan en el límite.
- **No:** función RPC. Aporta parámetros que aquí no hacen falta y una API menos transparente que
  un `select` sobre una vista.
- **Sí:** `security_invoker = on`. Sin él la vista ignora las políticas RLS de las tablas que
  consulta. Hoy daría igual, pero es exactamente el tipo de detalle que se convierte en fuga
  cuando alguien restringe `game_sessions` más adelante.
- **Sí:** empates compartiendo puesto. Es el comportamiento clásico de una tabla arcade y evita
  inventar un desempate.
- **Sí:** en la vista, ante dos partidas con la misma puntuación gana la más antigua. Quien lo
  consiguió primero tiene el mérito.

**Arquitectura**

- **Sí:** `/salon` partida en `page.tsx` (servidor, exporta `metadata`) más `salon-client.tsx`. Es
  el patrón que ya usan `/biblioteca` y `/acerca` desde la SPEC 02, y de paso la pantalla gana la
  `metadata` propia que nunca tuvo.
- **Sí:** el paso 4 es un refactor puro, sin cambio de comportamiento. Separar el movimiento de
  archivos del cambio de datos hace que, si algo se rompe, se sepa cuál de los dos fue.
- **Sí:** `getLeaderboard()` recibe el cliente de Supabase como argumento. Así la misma función
  sirve al Server Component en la carga inicial y al componente cliente al cambiar de pestaña, sin
  duplicar la consulta.
- **Sí:** la página es dinámica **por construcción**, sin configuración. `app/lib/supabase/server.ts`
  usa `cookies()`, que es una Request-time API, y eso ya excluye la ruta del prerenderizado. En
  Next 16 `export const dynamic` ni siquiera aparece ya en la tabla de configuración de segmento
  de la documentación incluida.
- **No:** revalidar cada 60 segundos. Acabas de jugar, entras al Salón y no apareces: parece que
  la partida no se guardó.

**Presentación**

- **Sí:** podio solo con tres marcas o más. El código actual lee `rows[0]`, `rows[1]` y `rows[2]`
  sin comprobar nada: con datos reales, un juego con una sola partida reventaría la pantalla.
- **Sí:** top 12, como ahora. Conserva el CSS y la composición existentes.
- **No:** paginación ni "ver más". Un salón de la fama muestra a los mejores, no a todos.
- **Sí:** fila "TU MEJOR MARCA" con puesto real, y sin números cuando no has jugado. La pantalla
  ya promete ese dato hoy; esta spec lo cumple en vez de fingirlo.

---

## Riesgos

| Riesgo                                                                                                                                                                                          | Mitigación                                                                                                                                       |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Esta spec no sirve de nada hasta que la SPEC 06 esté implementada.** La vista se apoya en `game_sessions`, que hoy no existe: la migración del paso 1 falla si se aplica antes.               | Está declarada como dependencia en la cabecera. El orden es implementar la 06 y después esta.                                                    |
| El podio actual accede a `rows[0]`, `rows[1]` y `rows[2]` sin comprobar la longitud. Con datos reales, un juego con menos de tres marcas produce un error en tiempo de ejecución.               | El paso 6 hace el podio condicional, y hay criterios de aceptación para cero, una y tres marcas.                                                 |
| Una vista sin `security_invoker = on` se ejecuta con los permisos de su propietario y salta la RLS de las tablas subyacentes.                                                                   | La migración lo incluye y hay un criterio de aceptación que lo verifica.                                                                         |
| `DISTINCT ON` exige que el `ORDER BY` empiece por las mismas columnas del `DISTINCT`. Escribirlo al revés no da error: da el ranking equivocado, silenciosamente.                               | El SQL está escrito completo en el modelo de datos, con el orden correcto y comentado.                                                           |
| El puesto de "tu mejor marca" sale de una consulta distinta a la del ranking. Entre las dos consultas alguien puede registrar una partida y dejar los dos números momentáneamente incoherentes. | La ventana es de milisegundos y el dato es un ranking de juegos, no un saldo bancario. Se acepta.                                                |
| Durante un tiempo `/salon` mostrará datos reales mientras el detalle `/juego/[id]` sigue mostrando marcas inventadas para el mismo juego.                                                       | Es consecuencia de acotar el alcance a una pantalla. Queda documentado como deuda visible y es lo primero que debería abordar la spec siguiente. |
| El primer jugador que registre una partida verá su nombre solo en el Salón: la pantalla puede parecer vacía y dar sensación de que no funciona.                                                 | Los estados vacíos son explícitos ("sé el primero") en vez de una tabla en blanco.                                                               |

---

## Lo que **no** está en esta spec

- El top 10 del detalle `/juego/[id]`.
- El campo `best` de `GAMES` en biblioteca y landing.
- Mover el catálogo de juegos a una tabla `games` de Supabase.
- Eliminar `seededScores` y `ScoreRow` de `app/lib/data.ts`.
- Paginación, "ver más" y filtros por periodo.
- Actualización en vivo con Realtime.
- El ticker de actividad y el top de jugadores de la landing.
- Tests automatizados.

Cada una de esas, si aterriza, va en su propia spec.
