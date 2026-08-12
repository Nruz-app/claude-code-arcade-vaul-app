# SPEC 06 — Registro de partidas en Supabase

> **Estado:** Aprobado
> **Depende de:** SPEC 04, SPEC 05
> **Fecha:** 2026-08-09
> **Objetivo:** Grabar en Supabase cada partida terminada de ROCAS —puntuación, nivel, duración y desenlace— en una tabla `game_sessions` ligada al usuario autenticado.

---

## Por qué existe esta spec

La SPEC 04 trajo la autenticación y dejó las puntuaciones fuera. La SPEC 05 trajo el primer juego
real y también las dejó fuera: `saveScore()` sigue escribiendo en `localStorage` (`av_scores`),
que se pierde al cambiar de navegador y no permite comparar a dos jugadores.

Esta spec cierra ese hueco por el lado de la **escritura**. Leer y mostrar rankings —el Salón de
la Fama con datos reales, el campo `best` de `GAMES`— es un dominio distinto y va en otra spec.

Hay un detalle que condiciona el trabajo: el motor de ROCAS solo emite `onScore`, `onLives`,
`onLevel` y `onGameOver(score)`. La duración de la partida y el motivo por el que terminó **no
existen hoy en ninguna parte**, así que grabarlas obliga a ampliar el contrato `GameCallbacks`
que definió la SPEC 05.

---

## Alcance

**Dentro:**

- **Tabla `public.game_sessions`** con RLS: una fila por partida terminada, con `user_id`,
  `game_id`, `score`, `level`, `duration_ms`, `ended_reason` y `created_at`. Migración versionada
  en `supabase/migrations/` y aplicada al proyecto remoto.
- **Ampliación del contrato de motor** en `app/lib/games/types.ts`: `GameOverReason`,
  `GameOverSummary`, `onGameOver(summary)` en lugar de `onGameOver(score)`, y un método `end()`
  nuevo en `GameHandle` para rendirse.
- **Instrumentación del motor** en `app/lib/games/asteroids.ts`: acumular la duración jugada con
  el reloj del propio bucle (que excluye las pausas por construcción) e implementar `end()`,
  que termina la partida con motivo `surrender`.
- **Módulo de escritura** en `app/lib/game-sessions.ts`: `saveGameSession()` inserta la fila con
  el cliente de navegador de `@supabase/ssr`, resolviendo el `user_id` de la sesión activa.
- **Inserción automática al terminar** en `app/juego/[id]/jugar/page.tsx`, tanto por perder la
  última vida como por pulsar FIN. Sin depender de que el jugador pulse nada.
- **Estados de guardado en el modal de fin**: con sesión, se muestra el nombre del perfil y la
  confirmación de que la partida quedó registrada; si falla, un aviso discreto que no bloquea.
- **Solo juegos con motor real**: se graba lo que viene de `GAME_ENGINES`, hoy únicamente
  `rocas`. El reproductor simulado no escribe en la base.

**Fuera de alcance (para specs futuras):**

- **Leer y mostrar rankings.** `/salon` sigue con `seededScores()` y el campo `best` de `GAMES`
  sigue siendo el número mock. Es la SPEC 07.
- **Mostrar tu récord o "has batido tu marca"** en la pantalla de fin. Ninguna lectura de
  `game_sessions` entra aquí; esta spec solo escribe.
- **Partidas de invitados.** Sin sesión no se graba nada en la base; el modal lo indica.
- **Los otros siete juegos.** Siguen simulados y sin registrar nada.
- **Telemetría fina**: asteroides destruidos por tamaño, disparos, precisión, power-ups
  recogidos, vidas restantes. Se descartó para no instrumentar el motor entero.
- **Migrar a la base lo que ya hay en `av_scores`.** El guardado local sigue funcionando en
  paralelo, pero no se sube el histórico.
- **Validar la puntuación en el servidor.** El juego corre en el navegador; ver Riesgos.
- **Editar o borrar partidas.** La tabla no tendrá políticas de `update` ni `delete`.
- **Corregir el nombre por defecto del modal** (`"INVITADO"` precargado, heredado de SPEC 05).
  Esta spec lo esquiva para lo que se graba en la base, pero no lo arregla para `av_scores`.
- **Tests automatizados** (sigue sin haber runner configurado).

---

## Modelo de datos

### Tabla nueva

```sql
-- supabase/migrations/<timestamp>_game_sessions.sql
create table public.game_sessions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  game_id       text not null check (char_length(game_id) between 1 and 40),
  score         integer not null check (score >= 0),
  level         integer not null check (level >= 1),
  duration_ms   integer not null check (duration_ms >= 0),
  ended_reason  text not null check (ended_reason in ('game_over', 'surrender')),
  created_at    timestamptz not null default now()
);

alter table public.game_sessions enable row level security;

-- Lectura pública: los rankings de la SPEC 07 son públicos, igual que profiles.
create policy "partidas legibles por cualquiera"
  on public.game_sessions for select using (true);

-- Solo puedes registrar partidas a tu nombre.
create policy "cada usuario registra sus partidas"
  on public.game_sessions for insert with check (auth.uid() = user_id);

-- Para el ranking por juego de la SPEC 07.
create index game_sessions_game_score_idx
  on public.game_sessions (game_id, score desc);
```

Convenciones:

- **`game_id` es texto, no clave foránea.** El catálogo de juegos vive en `app/lib/data.ts`, no
  en la base; no hay tabla `games` con la que relacionar.
- **No se guarda el nombre del jugador.** Se resuelve por `user_id` contra `profiles.username`
  cuando haga falta. Así la tabla no duplica un dato que ya existe.
- **Sin políticas de `update` ni `delete`.** Una partida jugada es un hecho, no un registro
  editable.

### Contrato de motor (cambia)

```ts
// app/lib/games/types.ts

export type GameOverReason = "game_over" | "surrender";

export interface GameOverSummary {
  score: number;
  level: number; // nivel alcanzado
  durationMs: number; // tiempo jugado, sin contar pausas
  reason: GameOverReason; // "surrender" = el jugador pulsó FIN
}

export interface GameCallbacks {
  onScore: (score: number) => void;
  onLives: (lives: number) => void;
  onLevel: (level: number) => void;
  onGameOver: (summary: GameOverSummary) => void; // antes: (score: number)
}

export interface GameHandle {
  start: () => void;
  pause: () => void;
  resume: () => void;
  end: () => void; // rendirse: termina y emite onGameOver con "surrender"
  destroy: () => void;
}
```

`end()` es nuevo y hace falta: hoy el botón FIN llama a `destroy()`, que mata el bucle **sin
emitir nada**. Con el resumen viviendo dentro del motor, rendirse tiene que pasar por él.

### Escritura

```ts
// app/lib/game-sessions.ts

export interface NewGameSession {
  gameId: string;
  score: number;
  level: number;
  durationMs: number;
  reason: GameOverReason;
}

// "anonymous" = no había sesión, no se intentó insertar.
export type SaveResult = "saved" | "anonymous" | "error";

export async function saveGameSession(
  entry: NewGameSession,
): Promise<SaveResult>;
```

### Estado nuevo en el reproductor

`app/juego/[id]/jugar/page.tsx` añade uno:

```ts
// cloudSave: "idle" | "saving" | "saved" | "anonymous" | "error"
```

`av_scores` y `StoredScore` no cambian: `saveScore()` sigue exactamente como está.

---

## Plan de implementación

Cada paso deja la app ejecutable (`npm run dev` / `npm run build` sin errores) y es commiteable
por sí solo.

1. **Tabla `game_sessions`.** Crear `supabase/migrations/<timestamp>_game_sessions.sql` con el
   SQL de arriba y aplicarlo al proyecto remoto.
   Verificación: `list_tables` muestra `public.game_sessions` con RLS activo; un `insert` desde
   el cliente con la clave publicable y sin sesión es rechazado por la política.

2. **Ampliar el contrato.** En `app/lib/games/types.ts` añadir `GameOverReason` y
   `GameOverSummary`, cambiar la firma de `onGameOver` y añadir `end()` a `GameHandle`.
   Verificación: `npm run build` falla en los dos consumidores (motor y reproductor), que es
   exactamente lo que debe señalar el compilador. El paso no se da por cerrado hasta el 4.

3. **Instrumentar el motor.** En `app/lib/games/asteroids.ts`, acumular `elapsedMs` sumando el
   `dt` de cada frame mientras el estado es `playing` o `dead` — como el bucle se detiene al
   pausar, el tiempo en pausa queda fuera sin lógica extra. `killShip()` emite el resumen con
   `reason: "game_over"`. Implementar `end()`: si la partida sigue viva, pasa a `gameover`,
   detiene el bucle y emite el resumen con `reason: "surrender"`. `initGame()` reinicia
   `elapsedMs` a 0.
   Verificación: `npm run build` compila el motor.

4. **Adaptar el reproductor a la nueva firma.** En `app/juego/[id]/jugar/page.tsx`, `onGameOver`
   pasa a recibir el resumen y guardarlo en un `useRef`. El botón FIN llama a `end()` en lugar de
   `destroy()`.
   Verificación: `npm run build` y `npm run lint` limpios; jugar en `/juego/rocas/jugar` funciona
   igual que en la SPEC 05, con modal tanto al perder como al pulsar FIN.

5. **Módulo de escritura.** Crear `app/lib/game-sessions.ts` con `saveGameSession()`: obtiene el
   usuario con `supabase.auth.getUser()`, devuelve `"anonymous"` si no hay, inserta la fila y
   devuelve `"saved"` o `"error"`. No lanza excepciones: el fin de partida no debe romperse
   porque falle la red.
   Verificación: `npm run build` compila; el módulo aún no se usa.

6. **Grabar al terminar.** En el reproductor, al recibir el resumen, llamar a `saveGameSession()`
   y reflejar el resultado en `cloudSave`. Solo se intenta cuando el juego tiene motor. Un
   `useRef` de guardia evita insertar dos veces la misma partida.
   Verificación: terminar una partida con sesión crea exactamente una fila en `game_sessions`
   con la puntuación, el nivel y el motivo correctos; rendirse con FIN crea una con
   `ended_reason = 'surrender'`.

7. **Modal de fin.** Con sesión: ocultar el campo "TUS INICIALES", mostrar el nombre del perfil y
   el estado del guardado ("GUARDANDO…", "PARTIDA REGISTRADA" o "NO SE PUDO GUARDAR EN LA NUBE").
   Sin sesión: el campo se queda como está y se indica que la partida solo se guarda en este
   navegador. En los dos casos, "JUGAR DE NUEVO" y "VOLVER AL VAULT" siguen funcionando.
   Verificación: con sesión el modal no pide iniciales y confirma el registro; sin sesión pide
   iniciales y avisa de que no se sube.

---

## Criterios de aceptación

**Build y esquema**

- [ ] `npm run lint` y `npm run build` terminan sin errores ni warnings de tipos.
- [ ] La consola del navegador no muestra errores al jugar y terminar una partida.
- [ ] `supabase/migrations/` contiene el archivo de `game_sessions` y el esquema remoto coincide
      con él.
- [ ] `public.game_sessions` tiene RLS activo, una política de `select` y una de `insert`, y
      **ninguna** de `update` ni `delete`.
- [ ] Un `insert` en `game_sessions` sin sesión es rechazado.
- [ ] Un `insert` con un `user_id` distinto al de la sesión es rechazado.

**Registro de partidas**

- [ ] Con sesión iniciada, perder la tercera vida en ROCAS crea **exactamente una** fila en
      `game_sessions`.
- [ ] Esa fila tiene el `user_id` del jugador, `game_id = 'rocas'` y `ended_reason = 'game_over'`.
- [ ] El `score` de la fila coincide con la puntuación final que muestra el modal.
- [ ] El `level` de la fila coincide con el nivel que muestra el HUD al terminar.
- [ ] El `duration_ms` es mayor que cero y se aproxima al tiempo realmente jugado.
- [ ] Pausar la partida un rato no infla `duration_ms`.
- [ ] Pulsar FIN crea una fila con `ended_reason = 'surrender'` y la puntuación de ese momento.
- [ ] Jugar dos partidas seguidas con "JUGAR DE NUEVO" crea dos filas distintas.
- [ ] Terminar una partida **no** crea filas duplicadas.

**Sin sesión y errores**

- [ ] Jugando como invitado no se crea ninguna fila en `game_sessions`.
- [ ] Jugando como invitado la puntuación sí se guarda en `av_scores`, como antes.
- [ ] Si la escritura remota falla, el modal muestra el aviso y el resto de botones siguen
      funcionando.
- [ ] Un fallo de escritura no impide volver a jugar ni salir de la pantalla.

**Modal**

- [ ] Con sesión, el modal no muestra el campo "TUS INICIALES" y sí el nombre del perfil.
- [ ] Con sesión, el modal confirma que la partida quedó registrada.
- [ ] Sin sesión, el modal mantiene el campo "TUS INICIALES" y avisa de que la partida solo se
      guarda en este navegador.

**Lo que no debe romperse**

- [ ] Los otros siete juegos siguen con el reproductor simulado y **no** escriben en
      `game_sessions`.
- [ ] `/salon` sigue mostrando los rankings de `seededScores()`.
- [ ] El campo `best` de `GAMES` sigue siendo el valor mock.
- [ ] ROCAS conserva todo su comportamiento de la SPEC 05: controles, división de asteroides,
      power-up, overlay de arranque y pausa.

---

## Decisiones

**Alcance**

- **Sí:** esta spec solo escribe. Leer rankings toca `/salon`, el campo `best` y consultas de
  agregación; es otro dominio y otra spec.
- **No:** mostrar el récord personal en la pantalla de fin. Es una lectura, y abre la pregunta de
  qué hacer cuando aún no tienes partidas.
- **Sí:** grabar solo lo que venga de `GAME_ENGINES`. Los siete juegos simulados puntúan con un
  `setInterval`; registrar eso llenaría la tabla de ruido desde el primer día.
- **No:** telemetría fina (disparos, precisión, power-ups). Obliga a instrumentar el motor entero
  y a decidir el esquema de media docena de métricas más, para datos que hoy nadie consume.

**Datos**

- **Sí:** `game_sessions` con una fila por partida. Guardar el historial permite calcular después
  el récord, el total de partidas o la media; una tabla de solo récords no se puede reconstruir.
- **No:** `high_scores` con una fila por jugador. Es una vista de los datos, no los datos.
- **Sí:** `user_id` sin copia del nombre. `profiles.username` ya existe y es resoluble por join;
  duplicarlo obliga a decidir qué hacer cuando alguien se cambia el nombre.
- **Sí:** `select` público. Los rankings del Salón de la Fama son públicos por diseño, igual que
  `profiles` desde la SPEC 04.
- **Sí:** `ended_reason` como texto con `check`, no como enum de Postgres. Añadir un valor a un
  `check` es una migración trivial; a un enum, no tanto.
- **Sí:** `game_id` como texto libre. No hay tabla de juegos con la que relacionar: el catálogo
  vive en `app/lib/data.ts`.
- **Sí:** conservar `av_scores` en paralelo. Es la red de seguridad si la escritura remota falla,
  y lo único que tienen los invitados.
- **No:** migrar el histórico de `av_scores` a la base al iniciar sesión. Trae duplicados y
  partidas de otra persona que usó el mismo navegador.

**Motor**

- **Sí:** ampliar `onGameOver` para que emita un resumen. La duración y el motivo solo los sabe
  con certeza el motor; deducirlos desde React obliga a llevar una contabilidad paralela.
- **Sí:** medir el tiempo con el reloj del bucle. Como el bucle se detiene al pausar, el tiempo
  en pausa queda excluido sin escribir nada para ello.
- **No:** cronometrar desde el componente con `Date.now()`. Contaría las pausas como tiempo
  jugado, y el jugador puede pausar indefinidamente.
- **Sí:** añadir `end()` a `GameHandle`. Hoy FIN llama a `destroy()`, que mata el bucle sin
  emitir nada; con el resumen dentro del motor, rendirse tiene que pasar por él.
- **Sí:** asumir que cambia el contrato de la SPEC 05. Solo hay un motor y un consumidor, así que
  el compilador señala los dos sitios exactos.

**Escritura y UI**

- **Sí:** grabar automáticamente al terminar. Es un registro de partidas, no un tablón al que uno
  se apunta: olvidar pulsar un botón no debería costar la marca.
- **No:** grabar solo al pulsar "GUARDAR PUNTUACIÓN". Se pierden todas las partidas en las que el
  jugador cierre la pestaña.
- **Sí:** insertar desde el cliente con RLS. Es el patrón que ya montó la SPEC 04 y no añade
  infraestructura.
- **No:** Server Action. Tampoco impediría una puntuación inventada —el juego corre en el
  navegador— así que su única ventaja real no existe aquí.
- **Sí:** solo con sesión. Permitir inserciones anónimas obliga a abrir una política por la que
  cualquiera puede escribir en la tabla de puntuaciones sin identificarse.
- **Sí:** aviso discreto si falla, sin bloquear. Un fallo de red no debe secuestrar la pantalla
  de fin de partida.
- **No:** fallar en silencio. El jugador creería que su marca quedó registrada.
- **Sí:** ocultar "TUS INICIALES" cuando hay sesión. El nombre lo pone el perfil; pedir un texto
  que no se usa en lo que de verdad se graba es engañoso. De paso esquiva el defecto del
  `"INVITADO"` precargado para el caso que importa.

---

## Riesgos

| Riesgo                                                                                                                                                                                                                              | Mitigación                                                                                                                                                                                           |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **La puntuación es autodeclarada.** El juego corre en el navegador, así que cualquiera con la consola abierta puede insertar una fila con `score` arbitrario a su nombre. RLS garantiza _quién_ escribe, no que el dato sea cierto. | Aceptado y documentado. Validarlo de verdad exigiría simular la partida en el servidor, que es desproporcionado. Si algún día importa, la vía es un ranking con revisión, no una Server Action.      |
| Cambiar la firma de `onGameOver` rompe el contrato que fijó la SPEC 05.                                                                                                                                                             | Hay un solo motor y un solo consumidor; el compilador señala los dos sitios. El paso 2 se cierra junto con el 4 precisamente por eso.                                                                |
| Emitir el resumen dos veces (por ejemplo, pulsar FIN cuando la partida ya había terminado) insertaría la partida por duplicado.                                                                                                     | `end()` no hace nada si el estado ya es `gameover`, y el reproductor lleva un `useRef` de guardia que solo permite un guardado por partida. Hay un criterio de aceptación para los duplicados.       |
| En desarrollo React monta los efectos dos veces; si la inserción colgara de un efecto de montaje, se duplicaría.                                                                                                                    | La inserción se dispara desde el callback de fin de partida, no desde un efecto de montaje.                                                                                                          |
| `duration_ms` se acumula sumando `dt`, que está capado a 50 ms por frame. Con la pestaña en segundo plano el navegador baja `requestAnimationFrame` a ~1 Hz, así que el tiempo registrado se queda corto frente al reloj de pared.  | Es el comportamiento deseado: mide _tiempo jugado_, no tiempo transcurrido. La auto-pausa de la SPEC 05 hace que ese caso sea raro. Documentado aquí porque el dato no coincidirá con un cronómetro. |
| La sesión puede caducar entre el arranque de la partida y su final.                                                                                                                                                                 | `saveGameSession()` resuelve el usuario en el momento de insertar y devuelve `"anonymous"` o `"error"` sin lanzar; el modal lo refleja y `av_scores` conserva la marca.                              |
| El jugador termina la partida y navega fuera antes de que la inserción responda.                                                                                                                                                    | La partida se pierde. Se acepta: reintentar en segundo plano o usar `sendBeacon` es complejidad que no compensa en este proyecto.                                                                    |

---

## Lo que **no** está en esta spec

- Leer rankings: `/salon` con datos reales y el campo `best` de `GAMES`.
- Mostrar el récord personal o avisar de que has batido tu marca.
- Registrar partidas de invitados.
- Los otros siete juegos del catálogo.
- Telemetría fina del juego (disparos, precisión, power-ups, asteroides por tamaño).
- Migrar a Supabase el histórico de `av_scores`.
- Validar la puntuación en el servidor.
- Editar o borrar partidas.
- Arreglar el `"INVITADO"` precargado del modal para el guardado local.
- Tests automatizados.

Cada una de esas, si aterriza, va en su propia spec.
