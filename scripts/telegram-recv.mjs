// =============================================================================
// telegram-recv.mjs — trae lo que TÚ le hayas escrito al bot
// =============================================================================
//
//   npm run tg:recv                          una pasada: lo pendiente y sale
//   npm run tg:recv -- --esperar             se queda esperando un mensaje
//   npm run tg:recv -- --esperar --max-min 3 ...como mucho tres minutos
//
// El modo --esperar está pensado para lanzarse EN SEGUNDO PLANO desde Claude
// Code: el proceso bloquea en un long polling contra Telegram y, en cuanto
// llega un mensaje tuyo, lo imprime y termina — y al terminar, la sesión se
// reactiva con el mensaje ya en pantalla. Es lo que permite darle órdenes al
// proyecto desde el móvil sin dejar nada escuchando en la máquina.
//
// Lo que NO hace: ejecutar nada. Imprime. Quien decide qué hacer con lo que
// llega es quien lea la salida, con la supervisión que eso implica.
// =============================================================================

import { readFileSync, writeFileSync } from "node:fs";

import {
  CHAT_ID,
  ErrorDeRed,
  ErrorDeTelegram,
  api,
  esMio,
  fallo,
  limpia,
} from "./telegram.mjs";

// Dónde se recuerda por dónde íbamos. En la raíz del proyecto y fuera de git
// (ver .gitignore): es estado de esta máquina, como el marcapáginas de un
// lector, y no algo que compartir.
const ARCHIVO_OFFSET = new URL("../.telegram-offset.json", import.meta.url);

// Cuánto aguanta Telegram la conexión abierta sin nada que contar. El
// AbortSignal va por encima a propósito: si se corta la red a mitad de un long
// polling, fetch puede quedarse colgado más allá del timeout del servidor.
const ESPERA_TELEGRAM = 25;
const TIMEOUT_RED = (ESPERA_TELEGRAM + 5) * 1000;

const argumentos = process.argv.slice(2);
const esperar = argumentos.includes("--esperar");
const maxMin = Number(argumentos[argumentos.indexOf("--max-min") + 1] ?? 10);

if (esperar && (!Number.isFinite(maxMin) || maxMin <= 0)) {
  fallo("--max-min quiere un número de minutos mayor que cero");
}

function leeOffset() {
  try {
    const { offset } = JSON.parse(readFileSync(ARCHIVO_OFFSET, "utf8"));
    return Number.isInteger(offset) ? offset : 0;
  } catch {
    // Primera ejecución, o archivo a medias. Empezar de cero es correcto: lo
    // peor que pasa es releer lo que Telegram todavía guarde (24 h).
    return 0;
  }
}

function guardaOffset(offset) {
  writeFileSync(ARCHIVO_OFFSET, `${JSON.stringify({ offset }, null, 2)}\n`);
}

// Un mensaje puede no traer texto (una foto, un audio, un sticker). Aquí no se
// descargan adjuntos: se dice qué llegó, para que quien lo lea sepa que hay
// algo y no crea que el mensaje venía vacío.
const CAMPOS_SOBRE = ["message_id", "from", "chat", "date"];

function describe(m) {
  if (m.text) return m.text;
  const tipo = Object.keys(m).find((k) => !CAMPOS_SOBRE.includes(k));
  return `[${tipo ?? "mensaje sin texto"}]`;
}

function imprime(update) {
  const m = update.message ?? update.edited_message;
  const cuando = new Date(m.date * 1000).toISOString().slice(11, 19);
  const editado = update.edited_message ? " (editado)" : "";
  console.log(`  [${cuando} UTC]${editado} ${describe(m)}`);
}

async function unaPasada(espera) {
  const offset = leeOffset();

  const updates = await api(
    "getUpdates",
    {
      ...(offset > 0 ? { offset } : {}),
      timeout: espera,
      // Solo mensajes: sin esto Telegram entrega también reacciones y entradas
      // y salidas de miembros, que aquí no interesan y solo llenan la cola.
      allowed_updates: ["message", "edited_message"],
    },
    espera > 0 ? TIMEOUT_RED : 15_000,
  );

  if (updates.length === 0) return { mios: 0, ajenos: 0 };

  // El offset avanza SIEMPRE, también por los descartados. Si solo avanzara con
  // los tuyos, el mensaje de un desconocido se quedaría eternamente al frente
  // de la cola tapando todo lo que llegue detrás.
  guardaOffset(updates.at(-1).update_id + 1);

  const mios = updates.filter(esMio);
  const ajenos = updates.length - mios.length;

  for (const u of mios) imprime(u);

  // Los ajenos se cuentan y se dicen, no se tragan en silencio: que un
  // desconocido haya encontrado tu bot es justo lo que querrías saber.
  if (ajenos > 0) {
    const frase =
      ajenos === 1
        ? "mensaje descartado: no es de tu chat"
        : "mensajes descartados: no son de tu chat";
    console.log(`  · ${ajenos} ${frase} (${CHAT_ID})`);
  }

  return { mios: mios.length, ajenos };
}

try {
  if (!esperar) {
    const { mios } = await unaPasada(0);
    if (mios === 0) console.log("  · sin mensajes nuevos");
    process.exit(0);
  }

  const limite = Date.now() + maxMin * 60_000;
  console.log(`  · esperando un mensaje tuyo (hasta ${maxMin} min)…`);

  while (Date.now() < limite) {
    const { mios } = await unaPasada(ESPERA_TELEGRAM);
    // Solo termina si el mensaje era TUYO: uno ajeno se descarta y se sigue
    // esperando, que es lo que se pidió.
    if (mios > 0) process.exit(0);
  }

  console.log(`  · sin mensajes en ${maxMin} min`);
  process.exit(0);
} catch (e) {
  if (e instanceof ErrorDeTelegram) {
    const pistas =
      e.codigo === 401
        ? [
            "El token no vale. Si acabas de hacer /revoke en @BotFather,",
            "pega el token NUEVO en .env (TELEGRAM_BOT_TOKEN).",
          ]
        : e.codigo === 409
          ? [
              "Otro proceso está leyendo el mismo bot, o quedó un webhook puesto.",
              "Cierra el otro tg:recv, o llama a deleteWebhook.",
            ]
          : [];

    fallo(`Telegram rechazó la consulta (${e.codigo}): ${e.message}`, pistas);
  }

  if (e instanceof ErrorDeRed) {
    fallo(e.message, ["Comprueba la conexión y vuelve a intentarlo."]);
  }

  fallo(limpia(e.message));
}
