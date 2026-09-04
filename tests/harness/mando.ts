// ===== tests/harness/mando.ts =====
// La suite compartida del mando táctil (SPEC 14). Cada archivo de tests/games/
// la invoca con su id y su factory, y un motor nuevo hereda las comprobaciones
// con una línea, igual que con `verificaContrato` y `verificaSkins`.
//
// Lo que verifica es la unión entre dos mitades que se escribieron por separado
// y que nada más cruza: el mapa `GAME_TOUCH` del registro, que dice qué teclas
// despacha cada botón, y el `Input` del motor, que dice cuáles escucha. Un
// `code` mal escrito en el registro da un botón que no hace nada, y sin esta
// suite no lo detecta ni el compilador (es un `string`) ni nadie mirando la
// pantalla en un escritorio, donde el mando ni se dibuja.
//
// La sonda es `defaultPrevented`: los cinco motores llaman a `preventDefault()`
// sobre las teclas que reconocen —para que las flechas no hagan scroll de la
// página mientras se juega— y `pulsa()` despacha el evento con
// `cancelable: true`. Que un `code` se consuma prueba dos cosas de una vez: que
// el listener está en `window`, que es donde el mando despacha, y que el motor
// reconoce ese código exacto.

import { describe, expect, it } from "vitest";

import { GAME_TOUCH, botonesDelMando } from "@/app/lib/games/registry";
import type { GameFactory } from "@/app/lib/games/types";

import { montaMotor, pulsa, suelta } from "./motor";

export function verificaMando(
  nombre: string,
  id: string,
  factory: GameFactory,
) {
  describe(`mando táctil de ${nombre}`, () => {
    const mando = GAME_TOUCH[id];

    it("está registrado en GAME_TOUCH", () => {
      // Si esto falla, las demás no pueden correr: sin mando no hay teclas que
      // comprobar. El cruce con GAME_ENGINES vive en registry.test.ts.
      expect(mando, `falta la entrada de «${id}» en GAME_TOUCH`).toBeDefined();
    });

    it("cada botón despacha una tecla que el motor escucha", () => {
      const m = montaMotor(factory);
      m.handle.start();

      for (const boton of botonesDelMando(mando!)) {
        // Un `code` con una errata —"ArrowLef"— llegaría a `window` y nadie lo
        // recogería: el botón se dibujaría y no haría nada.
        expect(
          pulsa(boton.code).defaultPrevented,
          `el motor de ${id} no escucha «${boton.code}» (botón: ${boton.accion})`,
        ).toBe(true);
        suelta(boton.code);
      }

      m.handle.destroy();
    });

    it("pulsar todo el mando no termina la partida ni rompe nada", () => {
      const m = montaMotor(factory);
      m.handle.start();

      // Machacar botones es lo que hace cualquiera con un mando delante. Nada
      // de lo que el mando despacha puede acabar una partida por sí solo: el
      // único botón que termina es FIN, y ese es del HUD.
      expect(() => {
        for (const boton of botonesDelMando(mando!)) {
          pulsa(boton.code);
          suelta(boton.code);
        }
        m.reloj.avanza(5);
      }).not.toThrow();

      expect(m.finales).toHaveLength(0);
      m.handle.destroy();
    });

    it("deja de escuchar sus teclas después de destroy()", () => {
      const m = montaMotor(factory);
      m.handle.start();
      m.handle.destroy();

      for (const boton of botonesDelMando(mando!)) {
        // El mando se desmonta con el juego. Si el motor siguiera enganchado,
        // sus teclas bloquearían el scroll de la página fuera de la partida.
        expect(
          pulsa(boton.code).defaultPrevented,
          `${id} sigue escuchando «${boton.code}» tras destroy()`,
        ).toBe(false);
      }
    });

    it("suelta la tecla aunque el dedo se levante con la partida en pausa", () => {
      const m = montaMotor(factory);
      m.handle.start();

      // El caso real: se mantiene un botón, algo pausa la partida (cambiar de
      // pestaña, que el reproductor gatea con `blur`) y el dedo se levanta
      // después. El `keyup` tiene que seguir llegando sin romper nada, o la
      // tecla se queda pulsada al reanudar.
      const botones = botonesDelMando(mando!);
      for (const boton of botones) pulsa(boton.code);
      m.handle.pause();
      expect(() => {
        for (const boton of botones) suelta(boton.code);
      }).not.toThrow();

      m.handle.resume();
      m.reloj.avanza(10);
      expect(m.finales).toHaveLength(0);
      m.handle.destroy();
    });
  });
}
