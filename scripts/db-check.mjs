// =============================================================================
// db-check.mjs — ¿está la base de datos donde y como debe estar?
// =============================================================================
//
//   npm run db:check
//
// Responde dos preguntas, en este orden, porque confundirlas cuesta tiempo:
//
//   FASE 1 — ¿existe el proyecto?  Un proyecto del plan gratuito puede haberse
//            pausado o borrado, y entonces su host deja de resolver. Ese caso se
//            detecta ANTES de tocar el esquema, con un dns.lookup() y un ping al
//            endpoint de salud, para poder decir «no se pudo conectar» en vez de
//            listar las tres tablas como fallidas.
//
//   FASE 2 — ¿está completo el esquema?  Solo si la fase 1 pasa.
//
// Usa la publishable key y no la contraseña de la base A PROPÓSITO: así se
// comprueba lo que ve la aplicación, con la RLS aplicada, y no lo que vería un
// superusuario que se salta las políticas.
//
// POR QUÉ NO USA @supabase/supabase-js
// ------------------------------------
// La SPEC 15 lo daba por hecho —es dependencia directa del proyecto—, pero
// `createClient()` construye un RealtimeClient dentro del constructor, y ese
// exige un `WebSocket` nativo que no existe hasta Node 22. Aquí corre Node
// 20.19.5, así que el script se caía antes de la primera consulta. Se habla
// directamente con PostgREST, que es lo que el cliente hace por debajo: mismas
// cabeceras, misma clave anónima, misma RLS. Y sigue sin dependencias nuevas,
// porque `fetch` es global desde Node 18.
//
// El procedimiento completo de mudanza está en supabase/README.md.
// =============================================================================

import { lookup } from "node:dns/promises";

const URL_SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL;
const CLAVE_SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

// Milisegundos antes de rendirse. El de red es corto a propósito: si el host no
// está, esperar veinte segundos no lo va a traer de vuelta.
const TIMEOUT_RED = 8_000;
const TIMEOUT_CONSULTA = 10_000;

// Códigos que hay que saber leer. Los que empiezan por PGRST los pone PostgREST;
// los de cinco caracteres vienen de PostgreSQL tal cual.
const NO_EXISTE = [
  "PGRST205", // la relación no está en el schema cache de PostgREST
  "42P01", // undefined_table, si el error llega crudo desde Postgres
];
const PRIVILEGIO_INSUFICIENTE = "42501"; // la RLS hizo su trabajo
const VIOLA_CLAVE_FORANEA = "23503"; // llegó hasta la FK: la política dejó pasar

const ANCHO = 24;

function linea(etiqueta, veredicto) {
  const puntos = ".".repeat(Math.max(1, ANCHO - etiqueta.length));
  console.log(`  ${etiqueta} ${puntos} ${veredicto}`);
}

function fallo(titulo, cuerpo) {
  console.log(`\n  ✗ ${titulo}\n`);
  for (const l of cuerpo) console.log(`    ${l}`);
  console.log("");
  process.exit(1);
}

// -----------------------------------------------------------------------------
// Antes de nada: ¿tenemos con qué?
// -----------------------------------------------------------------------------
// El script de npm inyecta el .env con `node --env-file=.env`, así que si faltan
// las variables es que el archivo está a medias, no que falte dotenv.

if (!URL_SUPABASE || !CLAVE_SUPABASE) {
  const faltan = [
    !URL_SUPABASE && "NEXT_PUBLIC_SUPABASE_URL",
    !CLAVE_SUPABASE && "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  ].filter(Boolean);

  fallo(`Falta en .env: ${faltan.join(" y ")}`, [
    "Copia .env.example como .env y rellena los valores del",
    "dashboard de Supabase. Ver supabase/README.md, paso 4.",
  ]);
}

let anfitrion;
try {
  anfitrion = new URL(URL_SUPABASE).hostname;
} catch {
  fallo(`NEXT_PUBLIC_SUPABASE_URL no es una URL válida: ${URL_SUPABASE}`, [
    "Debe tener la forma https://<project_ref>.supabase.co",
  ]);
}

console.log(`\n  Comprobando ${anfitrion}\n`);

// -----------------------------------------------------------------------------
// FASE 1 — ¿existe el proyecto?
// -----------------------------------------------------------------------------

const DNS_CAIDO = {
  ENOTFOUND: "el nombre DNS no existe",
  EAI_AGAIN: "el DNS no respondió a tiempo",
};

try {
  await lookup(anfitrion);
} catch (e) {
  const motivo = DNS_CAIDO[e.code] ?? e.code ?? e.message;
  fallo(`No se pudo resolver ${anfitrion} (${motivo})`, [
    "El proyecto puede estar pausado o eliminado.",
    "Ver supabase/README.md, paso 1.",
  ]);
}

try {
  const r = await fetch(`${URL_SUPABASE}/auth/v1/health`, {
    headers: { apikey: CLAVE_SUPABASE },
    signal: AbortSignal.timeout(TIMEOUT_RED),
  });
  if (!r.ok) {
    fallo(`${anfitrion} respondió ${r.status} al comprobar su salud`, [
      "El host resuelve pero el proyecto no está sirviendo.",
      "Suele significar que está pausado. Ver supabase/README.md, paso 1.",
    ]);
  }
} catch (e) {
  const motivo =
    e.name === "TimeoutError"
      ? `sin respuesta en ${TIMEOUT_RED / 1000} s`
      : e.message;
  fallo(`No se pudo conectar a ${anfitrion} (${motivo})`, [
    "El proyecto puede estar pausado o eliminado.",
    "Ver supabase/README.md, paso 1.",
  ]);
}

linea("conexión", "OK");

// -----------------------------------------------------------------------------
// FASE 2 — ¿está completo el esquema?
// -----------------------------------------------------------------------------

// La publishable key va en las dos cabeceras: `apikey` es la que exige el
// gateway, y `Authorization` la que fija el rol `anon` con el que PostgREST
// evalúa la RLS. Es exactamente lo que manda el cliente del navegador.
const CABECERAS = {
  apikey: CLAVE_SUPABASE,
  Authorization: `Bearer ${CLAVE_SUPABASE}`,
};

let problemas = 0;

// PostgREST contesta el error en JSON, pero un 500 o un gateway de por medio
// pueden devolver otra cosa. Que el parseo falle no debe tumbar el script.
async function cuerpoDeError(respuesta) {
  try {
    return await respuesta.json();
  } catch {
    return {};
  }
}

// Una relación vacía es un resultado CORRECTO: se comprueba que responda, no que
// tenga filas. Tras una mudanza no hay ninguna, y eso está bien.
async function compruebaRelacion(nombre, columna) {
  let r;
  try {
    r = await fetch(
      `${URL_SUPABASE}/rest/v1/${nombre}?select=${columna}&limit=1`,
      { headers: CABECERAS, signal: AbortSignal.timeout(TIMEOUT_CONSULTA) },
    );
  } catch (e) {
    problemas++;
    linea(nombre, `ERROR de red — ${e.message}`);
    return false;
  }

  if (r.ok) {
    linea(nombre, "OK");
    return true;
  }

  problemas++;
  const { code, message } = await cuerpoDeError(r);
  if (NO_EXISTE.includes(code)) {
    linea(nombre, "NO EXISTE — falta por crear");
  } else {
    linea(nombre, `ERROR ${code ?? r.status} ${message ?? ""}`.trim());
  }
  return false;
}

await compruebaRelacion("profiles", "id");
const haySesiones = await compruebaRelacion("game_sessions", "id");
await compruebaRelacion("game_leaderboard", "game_id");

// La prueba que de verdad importa: que un anónimo no pueda escribir marcas. Si
// esto pasa, cualquiera puede inventarse el ranking del Salón de la Fama.
if (!haySesiones) {
  // Sin tabla no hay política que probar, y el fallo ya está contado arriba.
  // Contarlo dos veces solo haría más ruidoso un diagnóstico que ya es claro.
  linea("RLS: insert anónimo", "no verificable — falta la tabla");
} else {
  let r = null;
  try {
    r = await fetch(`${URL_SUPABASE}/rest/v1/game_sessions`, {
      method: "POST",
      headers: { ...CABECERAS, "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: "00000000-0000-0000-0000-000000000000",
        game_id: "db-check",
        score: 0,
        level: 1,
        duration_ms: 0,
        ended_reason: "game_over",
      }),
      signal: AbortSignal.timeout(TIMEOUT_CONSULTA),
    });
  } catch (e) {
    problemas++;
    linea("RLS: insert anónimo", `ERROR de red — ${e.message}`);
  }

  if (r && r.ok) {
    problemas++;
    linea("RLS: insert anónimo", "ACEPTADO — ¡FALLO GRAVE!");
    console.log("");
    console.log(
      "    Un anónimo acaba de escribir en game_sessions. La política",
    );
    console.log(
      '    "cada usuario registra sus partidas" no está aplicándose.',
    );
    console.log(
      "    Vuelve a ejecutar supabase/schema.sql y borra la fila con",
    );
    console.log("    game_id = 'db-check' desde el dashboard.");
  } else if (r) {
    const { code } = await cuerpoDeError(r);
    if (code === PRIVILEGIO_INSUFICIENTE) {
      linea("RLS: insert anónimo", "RECHAZADO (correcto)");
    } else if (code === VIOLA_CLAVE_FORANEA) {
      problemas++;
      linea("RLS: insert anónimo", "lo frenó la clave foránea, no la RLS");
      console.log("");
      console.log(
        "    La fila pasó la política y solo la detuvo la referencia",
      );
      console.log("    a auth.users. Revisa que la RLS esté activada en");
      console.log("    game_sessions.");
    } else {
      // Rechazado, pero por un motivo que no esperábamos. No se da por bueno en
      // silencio: se enseña el código para que quien lo lea decida.
      problemas++;
      linea(
        "RLS: insert anónimo",
        `rechazado por ${code ?? r.status} — inesperado`,
      );
    }
  }
}

// El trigger on_auth_user_created solo se puede probar registrando un usuario, y
// este script no va a dejar basura en auth.users cada vez que se ejecute.
linea("trigger de perfiles", "no verificable sin registrar");

if (problemas > 0) {
  console.log(
    `\n  ✗ ${problemas} ${problemas === 1 ? "problema" : "problemas"}.`,
  );
  console.log(
    "    Ejecuta supabase/schema.sql. Ver supabase/README.md, paso 2.\n",
  );
  process.exit(1);
}

console.log("\n  ✓ Esquema listo.");
console.log("    Falta probar el trigger: regístrate y juega una partida");
console.log("    (supabase/README.md, paso 6).\n");
