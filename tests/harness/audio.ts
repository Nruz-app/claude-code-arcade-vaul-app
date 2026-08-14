// ===== tests/harness/audio.ts =====
// jsdom trae HTMLAudioElement pero no implementa nada que suene: `play()`,
// `pause()` y `load()` son "not implemented" y escupen un jsdomError por la
// consola virtual en cada llamada. Como la suite corre en cada guardado (hook
// PostToolUse), un motor que reproduzca sonido llenaría la salida de ruido.
//
// Además `play()` no devuelve una promesa, sino `undefined`. `crearSfx` ya lo
// contempla —captura el rechazo solo si lo que recibe es una promesa de verdad—,
// pero el stub devuelve una promesa resuelta para que ese camino, el del
// navegador, también se ejerza en las pruebas.
//
// El registro anota qué se reprodujo y en qué orden, que es lo que permite
// afirmar "saltar suena, ahogarse no" sin escuchar nada.

const reproducciones: string[] = [];
const pausas: string[] = [];

// El src tal cual lo escribió el motor ("/rana-salto.mp3"). El getter `.src` de
// jsdom devuelve la URL absoluta resuelta contra la base del documento, que hace
// las aserciones ilegibles.
function fuenteDe(el: HTMLMediaElement): string {
  return el.getAttribute("src") ?? "";
}

export function instalaAudioStub() {
  HTMLMediaElement.prototype.play = function (this: HTMLMediaElement) {
    reproducciones.push(fuenteDe(this));
    return Promise.resolve();
  };

  HTMLMediaElement.prototype.pause = function (this: HTMLMediaElement) {
    pausas.push(fuenteDe(this));
  };

  HTMLMediaElement.prototype.load = function () {};

  // jsdom no deja escribir `currentTime` (lanza "not implemented"), y el reinicio
  // en cada disparo es justo lo que hace que dos saltos seguidos no se solapen.
  Object.defineProperty(HTMLMediaElement.prototype, "currentTime", {
    configurable: true,
    get() {
      return (this as { _t?: number })._t ?? 0;
    },
    set(valor: number) {
      (this as { _t?: number })._t = valor;
    },
  });
}

// Se llama entre pruebas: el prototipo es global, así que sin esto una prueba
// heredaría las reproducciones de la anterior.
export function limpiaAudio() {
  reproducciones.length = 0;
  pausas.length = 0;
}

// Cuántas veces ha sonado un efecto, por su ruta.
export function vecesReproducido(src: string): number {
  return reproducciones.filter((s) => s === src).length;
}

export function vecesPausado(src: string): number {
  return pausas.filter((s) => s === src).length;
}

export function reproducidos(): readonly string[] {
  return reproducciones;
}
