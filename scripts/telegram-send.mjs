// =============================================================================
// telegram-send.mjs — manda un mensaje a TU chat, y solo a ese
// =============================================================================
//
//   npm run tg:send -- "Arcade Vault en línea"
//   npm run tg:send -- --markdown "*listo*"
//   echo "texto largo" | npm run tg:send
//
// El destino NO es un parámetro: sale de TELEGRAM_CHAT_ID y no hay forma de
// pasarle otro. Es deliberado — un script que acepta destino es un script con
// el que se puede escribir a cualquiera desde esta máquina.
//
// El texto puede venir por argumento o por stdin. Lo segundo existe porque en
// PowerShell un mensaje multilínea o con comillas pelea con el argumento, y
// porque así se le puede tubear la salida de otro comando.
// =============================================================================

import {
  CHAT_ID,
  ErrorDeRed,
  ErrorDeTelegram,
  api,
  escapaMarkdown,
  fallo,
  limpia,
  trocea,
} from "./telegram.mjs";

const argumentos = process.argv.slice(2);
const markdown = argumentos.includes("--markdown");
const textoArgumento = argumentos.filter((a) => a !== "--markdown").join(" ");

async function leeStdin() {
  const trozos = [];
  for await (const t of process.stdin) trozos.push(t);
  return Buffer.concat(trozos).toString("utf8");
}

// Si no hay argumento se mira stdin, pero solo si hay algo tubeado: con una
// terminal interactiva detrás, leer stdin dejaría el proceso colgado esperando
// a un Ctrl+D que nadie va a pulsar.
const texto = (
  textoArgumento || (process.stdin.isTTY ? "" : await leeStdin())
).trim();

if (!texto) {
  fallo("No hay nada que enviar", [
    'Pasa el mensaje como argumento:  npm run tg:send -- "hola"',
    "o tubéalo por stdin:             echo hola | npm run tg:send",
  ]);
}

const trozos = trocea(texto);

try {
  // En serie y no en paralelo: Telegram no garantiza el orden de llegada de
  // varias peticiones simultáneas, y un mensaje partido en tres que aparece
  // desordenado en el móvil no se entiende.
  for (const [i, trozo] of trozos.entries()) {
    const enviado = await api("sendMessage", {
      chat_id: CHAT_ID,
      text: markdown ? escapaMarkdown(trozo) : trozo,
      ...(markdown ? { parse_mode: "MarkdownV2" } : {}),
    });

    const etiqueta = trozos.length > 1 ? `${i + 1}/${trozos.length} ` : "";
    console.log(`  ✓ enviado ${etiqueta}(message_id ${enviado.message_id})`);
  }
} catch (e) {
  if (e instanceof ErrorDeTelegram) {
    // El 403 es el tropiezo de la primera vez y merece su propia pista: un bot
    // no puede abrir una conversación, tienes que escribirle tú primero.
    const pistas =
      e.codigo === 403
        ? [
            "Un bot no puede iniciar una conversación.",
            "Abre el chat con tu bot en Telegram y escríbele algo,",
            "una sola vez. Después esto funciona siempre.",
          ]
        : e.codigo === 401
          ? [
              "El token no vale. Si acabas de hacer /revoke en @BotFather,",
              "pega el token NUEVO en .env (TELEGRAM_BOT_TOKEN).",
            ]
          : e.codigo === 400
            ? [
                "Revisa TELEGRAM_CHAT_ID en .env, o quita --markdown:",
                "MarkdownV2 rechaza el mensaje entero si algo no cuadra.",
              ]
            : [];

    fallo(`Telegram rechazó el envío (${e.codigo}): ${e.message}`, pistas);
  }

  if (e instanceof ErrorDeRed) {
    fallo(e.message, ["Comprueba la conexión y vuelve a intentarlo."]);
  }

  fallo(limpia(e.message));
}
