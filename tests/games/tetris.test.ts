// ===== tests/games/tetris.test.ts =====
// CAÍDA. Es un juego sin vidas, así que el HUD depende de que emita onLives(1)
// al empezar; si no, enseña tres corazones que no existen.

import { describe, expect, it } from "vitest";

import {
  H,
  Input,
  SKINS_CAIDA,
  W,
  createTetrisGame,
} from "@/app/lib/games/tetris";

import { verificaContrato } from "../harness/contrato";
import { verificaMando } from "../harness/mando";
import { montaMotor, pulsa, suelta } from "../harness/motor";
import { verificaRendimiento } from "../harness/rendimiento";
import { verificaSkins } from "../harness/skins";

verificaContrato("CAÍDA", createTetrisGame);
verificaSkins("CAÍDA", createTetrisGame, SKINS_CAIDA);
verificaMando("CAÍDA", "caida", createTetrisGame);

// Presupuesto medido el 2026-09-11 con las opciones por defecto de la suite
// (60 fotogramas de calentamiento, 20 medidos): 47 llamadas de dibujo y 11
// asignaciones de color en el fotograma más caro de doce corridas, 0 emisiones
// en 600 fotogramas y ≤97 KB retenidos. Antes de cachear el fondo del pozo y de
// agrupar el color por celda eran 89 y 31 (y 217 y 175 con el pozo a medio
// llenar). Los techos llevan holgura para que no los mueva el azar de la pieza
// —la tuerca son ocho celdas, el doble que cualquier otra—, pero siguen por
// debajo de lo que costaba el motor antes: una regresión de las de verdad
// (volver a trazar la rejilla cada fotograma, reasignar el color por celda) los
// rompe.
verificaRendimiento("CAÍDA", createTetrisGame, {
  dibujoPorFrame: 80,
  coloresPorFrame: 18,
  emisionesEn600: 20,
  heapKbEn600: 400,
});

describe("CAÍDA: resolución", () => {
  it("usa el canvas de 800×600 aunque el tablero sea de 300×600", () => {
    // El tablero se centra dentro del canvas del reproductor en vez de cambiar
    // la resolución lógica.
    expect([W, H]).toEqual([800, 600]);
  });
});

describe("CAÍDA: vidas", () => {
  it("emite onLives(1) al empezar y onLives(0) al terminar", () => {
    const m = montaMotor(createTetrisGame);
    m.handle.start();
    expect(m.vidas[0]).toBe(1);

    m.reloj.avanza(20);
    m.handle.end();
    expect(m.vidas.at(-1)).toBe(0);
    m.handle.destroy();
  });
});

describe("CAÍDA: el mando mantiene y suelta", () => {
  const CODES = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space"];

  it("una tecla mantenida deja de estarlo al soltarla", () => {
    // Esto es el contrato exacto del mando táctil: `pointerdown` despacha
    // keydown y `pointerup` despacha keyup. Sin la segunda mitad, apoyar el
    // dedo en un botón lo dejaría pulsado para siempre.
    //
    // CAÍDA no expone `isHeld()` como los otros dos: su Input responde con
    // `pulses()`, que dice cuántas veces debe actuar la tecla en este frame.
    // Mientras está pulsada devuelve al menos 1; suelta, 0.
    const input = new Input();
    input.attach();

    for (const code of CODES) {
      pulsa(code);
      expect(
        input.pulses(code, 16),
        `${code} no se registró como pulsada`,
      ).toBe(1);
      suelta(code);
      expect(
        input.pulses(code, 16),
        `${code} se quedó pulsada al soltarla`,
      ).toBe(0);
    }

    input.detach();
  });

  it("la repetición la genera el motor, no el auto-repeat del sistema", () => {
    // Es la afirmación que sostiene toda la SPEC 14: un solo `keydown` del
    // mando basta, porque la cadencia la produce el DAS del motor. Si algún día
    // se volviera a depender del auto-repeat del sistema operativo, el mando
    // movería la pieza una vez y se quedaría quieto con el dedo apoyado.
    const input = new Input();
    input.attach();

    pulsa("ArrowLeft"); // un único keydown, como el que despacha un botón
    expect(input.pulses("ArrowLeft", 16)).toBe(1); // la pulsación inicial

    // Durante la espera del DAS no se repite...
    let repeticiones = 0;
    for (let i = 0; i < 10; i++) repeticiones += input.pulses("ArrowLeft", 16);
    expect(repeticiones).toBe(0);

    // ...y después sí, sin que nadie haya despachado un segundo keydown.
    for (let i = 0; i < 10; i++) repeticiones += input.pulses("ArrowLeft", 16);
    expect(repeticiones).toBeGreaterThan(0);

    suelta("ArrowLeft");
    expect(input.pulses("ArrowLeft", 16)).toBe(0);
    input.detach();
  });

  it("descarta el auto-repeat del sistema", () => {
    // El motor ignora los keydown con `repeat: true`. El mando nunca los
    // manda, pero un teclado físico sí, y las dos entradas conviven.
    const input = new Input();
    input.attach();

    window.dispatchEvent(
      new KeyboardEvent("keydown", {
        code: "ArrowUp",
        repeat: true,
        bubbles: true,
        cancelable: true,
      }),
    );
    expect(input.wasPressed("ArrowUp")).toBe(false);

    input.detach();
  });
});
