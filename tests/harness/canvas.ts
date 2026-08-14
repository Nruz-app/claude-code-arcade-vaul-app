// ===== tests/harness/canvas.ts =====
// jsdom trae HTMLCanvasElement pero no implementa `getContext("2d")`: devuelve
// null y escupe un "Not implemented" por stderr. Los cinco motores hacen
//
//   const context2d = canvas.getContext("2d");
//   if (!context2d) throw new Error("… necesita un canvas 2D");
//
// así que sin este stub ninguna prueba llega a instanciar un motor.
//
// La alternativa sería el paquete `canvas` (binding nativo de Cairo), que
// compila en la instalación y tarda minutos. Aquí no se pinta nada de verdad
// —lo que se prueba es el contrato, no los píxeles—, así que basta con un
// contexto que trague todas las llamadas.

// Valores iniciales realistas de las propiedades que leen o escriben los
// motores. Importa que sean del tipo correcto: si `globalAlpha` no fuese un
// número, un `ctx.globalAlpha = ctx.globalAlpha * 0.5` daría NaN en silencio.
const PROPIEDADES_INICIALES: Record<string, unknown> = {
  fillStyle: "#000000",
  strokeStyle: "#000000",
  lineWidth: 1,
  lineCap: "butt",
  lineJoin: "miter",
  globalAlpha: 1,
  globalCompositeOperation: "source-over",
  shadowBlur: 0,
  shadowColor: "rgba(0, 0, 0, 0)",
  shadowOffsetX: 0,
  shadowOffsetY: 0,
  font: "10px sans-serif",
  textAlign: "start",
  textBaseline: "alphabetic",
  imageSmoothingEnabled: true,
  imageSmoothingQuality: "low",
};

// Cuántas llamadas de dibujo ha recibido el contexto. Sirve para afirmar que
// `draw()` corrió (por ejemplo, que `pause()` repinta el último fotograma) sin
// tener que mirar píxeles.
export interface ContextoFalso {
  llamadas: number;
  // Todo color que el motor ha asignado al contexto, en orden. Es lo que hace
  // comprobable la invariante nº 10 del contrato: que ningún literal se cuele
  // fuera de la paleta. Ningún motor usa gradientes ni patrones, así que las
  // tres propiedades de abajo son el 100 % del color que llega al canvas.
  colores: string[];
}

const PROPIEDADES_DE_COLOR = new Set([
  "fillStyle",
  "strokeStyle",
  "shadowColor",
]);

// La prueba de aguante hace 600 fotogramas y cada uno asigna decenas de
// colores: sin tope, el historial crece sin sentido. Con esto sobra para
// afirmar sobre los primeros cientos de fotogramas, que es lo que se mide.
const TOPE_DE_COLORES = 20000;

const registros = new WeakMap<object, ContextoFalso>();

function creaContexto2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const registro: ContextoFalso = { llamadas: 0, colores: [] };
  const noop = () => {
    registro.llamadas++;
  };

  const base: Record<string | symbol, unknown> = {
    canvas,
    ...PROPIEDADES_INICIALES,
    // Las pocas que tienen que devolver algo con forma propia; el resto las
    // resuelve el `get` de abajo como no-op.
    measureText: () => ({ width: 0 }),
    getImageData: () => ({
      data: new Uint8ClampedArray(4),
      width: 1,
      height: 1,
    }),
    createLinearGradient: () => ({ addColorStop: () => {} }),
    createRadialGradient: () => ({ addColorStop: () => {} }),
    getLineDash: () => [] as number[],
  };

  const ctx = new Proxy(base, {
    get(destino, prop) {
      if (prop in destino) return destino[prop];
      // Los símbolos no son métodos de canvas: son inspecciones del runner
      // (util.inspect, Symbol.toStringTag…). Devolver un no-op ahí rompe el
      // formateo de los mensajes de error de Vitest.
      if (typeof prop === "symbol") return undefined;
      // Cualquier método de dibujo no previsto: se traga y se cuenta.
      return noop;
    },
    set(destino, prop, valor) {
      if (
        typeof valor === "string" &&
        PROPIEDADES_DE_COLOR.has(prop as string) &&
        registro.colores.length < TOPE_DE_COLORES
      ) {
        registro.colores.push(valor);
      }
      destino[prop] = valor;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;

  registros.set(ctx as unknown as object, registro);
  return ctx;
}

// Cuántas operaciones de dibujo ha recibido un contexto de estos.
export function llamadasDeDibujo(ctx: CanvasRenderingContext2D): number {
  return registros.get(ctx as unknown as object)?.llamadas ?? 0;
}

// Todo color asignado al contexto desde que existe, en orden de asignación.
export function coloresUsados(
  ctx: CanvasRenderingContext2D,
): readonly string[] {
  return registros.get(ctx as unknown as object)?.colores ?? [];
}

// Vacía el historial de color sin tocar el contador de dibujo. Sirve para medir
// solo los fotogramas que interesan, ignorando los de la construcción.
export function olvidaColores(ctx: CanvasRenderingContext2D) {
  const registro = registros.get(ctx as unknown as object);
  if (registro) registro.colores.length = 0;
}

// Parchea el prototipo una sola vez, desde setupFiles. Cada canvas conserva su
// contexto: `getContext("2d")` dos veces sobre el mismo elemento devuelve el
// mismo objeto, como en un navegador.
export function instalaCanvas2d() {
  const contextos = new WeakMap<HTMLCanvasElement, CanvasRenderingContext2D>();

  HTMLCanvasElement.prototype.getContext = function (
    this: HTMLCanvasElement,
    tipo: string,
  ) {
    if (tipo !== "2d") return null;
    let ctx = contextos.get(this);
    if (!ctx) {
      ctx = creaContexto2d(this);
      contextos.set(this, ctx);
    }
    return ctx;
  } as HTMLCanvasElement["getContext"];
}

// Un canvas con la resolución lógica que fija el reproductor (800×600). Que
// las tres cifras coincidan es en sí una invariante del contrato.
export function creaCanvas(ancho = 800, alto = 600): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = ancho;
  canvas.height = alto;
  document.body.appendChild(canvas);
  return canvas;
}
