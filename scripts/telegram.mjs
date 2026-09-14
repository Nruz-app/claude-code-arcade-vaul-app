// =============================================================================
// telegram.mjs — el núcleo que comparten enviar y recibir
// =============================================================================
//
// No es ejecutable: lo importan scripts/telegram-send.mjs y
// scripts/telegram-recv.mjs. Aquí vive todo lo que los dos necesitan y, sobre
// todo, LA REGLA DE UN SOLO USUARIO (`esMio`), que es el motivo de que este
// puente sea seguro tenerlo abierto.
//
// POR QUÉ NO HAY DEPENDENCIAS
// ---------------------------
// Mismo criterio que scripts/db-check.mjs: la API de bots de Telegram es HTTP
// con JSON, y `fetch` es global desde Node 18. Una librería aquí solo añadiría
// superficie y un paquete más que auditar para hablar con un endpoint.
//
// POR QUÉ POLLING Y NO WEBHOOK
// ----------------------------
// Un webhook obliga a tener una URL pública con TLS, o un túnel. Esto corre en
// una máquina de desarrollo: es el cliente quien llama a Telegram, no al revés,
// así que no se abre ningún puerto ni se expone nada.
// =============================================================================

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;

// A String y sin espacios A PROPÓSITO: Telegram devuelve los id como número y
// el .env los entrega como texto. Comparar 7527154661 con "7527154661" da falso
// y el filtro de usuario descartaría en silencio tus propios mensajes.
export const CHAT_ID = String(process.env.TELEGRAM_CHAT_ID ?? "").trim();

// Telegram corta los mensajes en 4096 caracteres. Se trocea por debajo para
// dejar margen a los saltos de línea que añade el reparto.
const LIMITE_TELEGRAM = 4000;

const TIMEOUT_POR_DEFECTO = 15_000;

// -----------------------------------------------------------------------------
// Diagnóstico, con el mismo formato que db-check.mjs
// -----------------------------------------------------------------------------

export function fallo(titulo, cuerpo = []) {
  console.error(`\n  ✗ ${limpia(titulo)}\n`);
  for (const l of cuerpo) console.error(`    ${l}`);
  console.error("");
  process.exit(1);
}

// El token no sale de aquí NUNCA, ni dentro de un mensaje de error.
//
// No es paranoia decorativa: la URL de la API lleva el token incrustado en la
// ruta (`/bot<token>/sendMessage`), así que cualquier error que arrastre la URL
// —un fallo de red de undici, un redirect, un stack trace— lo imprimiría entero
// en la consola, y de ahí al transcript de Claude Code. Todo lo que se escribe
// pasa por este filtro.
export function limpia(texto) {
  const t = String(texto);
  return TOKEN ? t.replaceAll(TOKEN, "<TOKEN>") : t;
}

// -----------------------------------------------------------------------------
// ¿Tenemos con qué?
// -----------------------------------------------------------------------------
// Los scripts arrancan con `node --env-file=.env`, así que si faltan es que el
// archivo está a medias, no que falte dotenv.

if (!TOKEN || !CHAT_ID) {
  const faltan = [
    !TOKEN && "TELEGRAM_BOT_TOKEN",
    !CHAT_ID && "TELEGRAM_CHAT_ID",
  ].filter(Boolean);

  fallo(`Falta en .env: ${faltan.join(" y ")}`, [
    "El token lo da @BotFather y el chat id es el tuyo.",
    "Ver .claude/skills/telegram-arcade-send/SKILL.md.",
  ]);
}

// -----------------------------------------------------------------------------
// La llamada
// -----------------------------------------------------------------------------

// Dos fallos distintos que conviene no confundir, igual que db-check separa
// «no se puede conectar» de «falta el esquema»: uno es la red y el otro es
// Telegram diciendo que no.
export class ErrorDeRed extends Error {}
export class ErrorDeTelegram extends Error {
  constructor(mensaje, codigo) {
    super(mensaje);
    this.codigo = codigo;
  }
}

export async function api(metodo, cuerpo = {}, timeout = TIMEOUT_POR_DEFECTO) {
  let r;
  try {
    r = await fetch(`https://api.telegram.org/bot${TOKEN}/${metodo}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cuerpo),
      signal: AbortSignal.timeout(timeout),
    });
  } catch (e) {
    const motivo =
      e.name === "TimeoutError"
        ? `sin respuesta en ${Math.round(timeout / 1000)} s`
        : limpia(e.message);
    throw new ErrorDeRed(`no se pudo hablar con Telegram (${motivo})`);
  }

  // Un 4xx de Telegram trae el motivo en el cuerpo, que es lo que interesa. Un
  // 5xx o un proxy de por medio pueden devolver otra cosa; que el parseo falle
  // no debe tumbar el script.
  let datos;
  try {
    datos = await r.json();
  } catch {
    datos = {};
  }

  if (!datos.ok) {
    throw new ErrorDeTelegram(
      limpia(datos.description ?? `respuesta HTTP ${r.status}`),
      datos.error_code ?? r.status,
    );
  }

  return datos.result;
}

// -----------------------------------------------------------------------------
// LA REGLA DE UN SOLO USUARIO
// -----------------------------------------------------------------------------
// Se comprueban las DOS identidades, y hacen falta las dos:
//
//   chat.id — de qué conversación viene. Descarta un grupo en el que alguien
//             haya metido al bot: ahí el chat es otro aunque escribas tú.
//   from.id — quién la escribió. Descarta que otra persona hable en un chat que
//             sí es tuyo, que es justo lo que pasa si el bot acaba en un grupo
//             contigo dentro.
//
// Un bot es descubrible por su @usuario, así que cualquiera puede escribirle.
// Esta función es lo único que separa «mi puente» de «un bot público».
export function esMio(update) {
  const m = update.message ?? update.edited_message;
  if (!m) return false;
  return String(m.chat?.id) === CHAT_ID && String(m.from?.id) === CHAT_ID;
}

// -----------------------------------------------------------------------------
// Trocear
// -----------------------------------------------------------------------------
// Se corta por el último salto de línea del trozo cuando lo hay, para no partir
// una frase por la mitad; si un párrafo es más largo que el límite, se corta a
// lo bruto y ya.
export function trocea(texto, limite = LIMITE_TELEGRAM) {
  const trozos = [];
  let resto = texto;

  while (resto.length > limite) {
    const ventana = resto.slice(0, limite);
    const corte = ventana.lastIndexOf("\n");
    const fin = corte > limite * 0.5 ? corte : limite;
    trozos.push(resto.slice(0, fin));
    resto = resto.slice(fin).replace(/^\n/, "");
  }

  if (resto.length > 0) trozos.push(resto);
  return trozos;
}

// -----------------------------------------------------------------------------
// MarkdownV2
// -----------------------------------------------------------------------------
// Los dieciocho reservados. Sin escapar, un guion suelto o un punto final hacen
// que Telegram rechace el mensaje entero con un 400, no que se vea raro.
const RESERVADOS = /[_*[\]()~`>#+\-=|{}.!]/g;

export function escapaMarkdown(texto) {
  return texto.replace(RESERVADOS, (c) => `\\${c}`);
}
