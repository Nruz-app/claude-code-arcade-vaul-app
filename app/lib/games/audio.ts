// ===== app/lib/games/audio.ts =====
// Efectos de sonido para los motores de juego. Hoy solo lo usa RANARIA
// (app/lib/games/frogger.ts); está aquí y no dentro de ese archivo porque es la
// costura por la que las pruebas sustituyen el audio, y porque la política de
// reproducción —una voz, reinicio, y tragarse los fallos— tiene que vivir en un
// único sitio en cuanto suene un segundo juego.
//
// Nada de esto toca el DOM de la página: un HTMLAudioElement que no se inserta
// en el documento es el mismo caso que el `new Image()` con el que SERPENTINA
// carga su hoja de sprites.
//
// Los binarios viven en public/ y se referencian con ruta absoluta ("/x.mp3"):
// las rutas relativas al módulo no las resuelve Next.

export interface Sfx {
  // Reinicia el efecto y lo dispara. Nunca lanza.
  play: () => void;
  // Corta lo que esté sonando, sin soltar el elemento.
  silenciar: () => void;
  // Silencia y suelta el elemento: se llama desde el destroy() del motor.
  destroy: () => void;
}

// El Sfx que se devuelve cuando el entorno no tiene `Audio`. Un objeto mudo sale
// más barato que repartir comprobaciones por el motor.
const MUDO: Sfx = {
  play: () => {},
  silenciar: () => {},
  destroy: () => {},
};

// `play()` devuelve una promesa en el navegador —que se rechaza, por ejemplo, si
// la política de autoplay bloquea el sonido— pero bajo jsdom devuelve `undefined`,
// porque HTMLMediaElement.play no está implementado. Las dos cosas se cubren
// igual: capturar el rechazo solo si de verdad hay una promesa.
//
// Que un efecto no suene nunca es motivo para parar una partida, así que aquí no
// se propaga nada. Es el mismo criterio de leaderboard.ts, que devuelve una lista
// vacía en vez de lanzar.
function reproduce(el: HTMLAudioElement) {
  try {
    el.currentTime = 0;
    const resultado: unknown = el.play();
    if (resultado instanceof Promise) resultado.catch(() => {});
  } catch {
    // Sin salida de audio, con el archivo ausente o con el elemento ya soltado.
  }
}

// Una voz por efecto: el mismo elemento se reinicia en cada disparo, así que dos
// saltos seguidos no se solapan, el segundo corta al primero. Es lo que hace una
// recreativa, y con muestras ya recortadas un pool de voces solo daría barro.
export function crearSfx(src: string, volumen: number): Sfx {
  if (typeof Audio === "undefined") return MUDO;

  let el: HTMLAudioElement | null = new Audio(src);
  el.preload = "auto";
  el.volume = volumen;

  return {
    play() {
      if (el) reproduce(el);
    },

    silenciar() {
      try {
        el?.pause();
      } catch {
        // Ídem: silenciar tampoco puede tumbar una partida.
      }
    },

    destroy() {
      if (!el) return;
      const anterior = el;
      el = null;
      try {
        anterior.pause();
        // `src = ""` no vale: varios navegadores lo interpretan como la URL de la
        // página y lanzan una petición. Quitar el atributo y recargar es lo que
        // suelta de verdad el búfer, que importa porque el motor se monta y se
        // desmonta cada vez que se entra y se sale del juego.
        anterior.removeAttribute("src");
        anterior.load();
      } catch {
        // Ídem.
      }
    },
  };
}
