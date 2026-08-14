// ===== tests/harness/reloj.ts =====
// Reloj determinista de requestAnimationFrame.
//
// El rAF real de jsdom dispara con un temporizador de verdad: una prueba que
// quisiera 100 fotogramas tardaría 1,6 s y el resultado dependería de la carga
// de la máquina. Aquí los fotogramas los pide la prueba, uno a uno, con el `ts`
// que ella decide — que es justo lo que hace falta para comprobar el cap de
// `dt` y que el tiempo en pausa no se contabiliza.

export interface Reloj {
  // Fotogramas encolados ahora mismo. Es la sonda de `destroy()` y `pause()`:
  // un motor bien parado deja esto en 0.
  readonly pendientes: number;
  // Marca de tiempo actual, en ms, la misma que reciben los callbacks del rAF.
  readonly ahora: number;
  // Ejecuta `frames` fotogramas seguidos, avanzando `msPorFrame` en cada uno.
  // 16 ms ≈ 60 fps, que es lo que los motores esperan de un navegador.
  avanza(frames?: number, msPorFrame?: number): void;
  // Deja pasar el tiempo SIN ejecutar fotogramas: es una pausa, una pestaña en
  // segundo plano o un `pause()` del reproductor.
  salta(ms: number): void;
}

export function instalaReloj(): Reloj {
  let ahora = 0;
  let siguienteId = 1;
  let pendientes = new Map<number, FrameRequestCallback>();

  window.requestAnimationFrame = (cb: FrameRequestCallback): number => {
    const id = siguienteId++;
    pendientes.set(id, cb);
    return id;
  };

  window.cancelAnimationFrame = (id: number): void => {
    pendientes.delete(id);
  };

  return {
    get pendientes() {
      return pendientes.size;
    },
    get ahora() {
      return ahora;
    },
    avanza(frames = 1, msPorFrame = 16) {
      for (let i = 0; i < frames; i++) {
        // El lote se vacía ANTES de ejecutar: si no, el rAF que el propio
        // callback vuelve a pedir se ejecutaría en esta misma vuelta y el
        // bucle no terminaría nunca.
        const lote = [...pendientes.values()];
        pendientes = new Map();
        ahora += msPorFrame;
        for (const cb of lote) cb(ahora);
      }
    },
    salta(ms: number) {
      ahora += ms;
    },
  };
}
