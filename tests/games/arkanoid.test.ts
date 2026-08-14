// ===== tests/games/arkanoid.test.ts =====
// BLOQUE BUSTER. Es el único motor que además engancha el ratón, y lo hace al
// canvas: `destroy()` tiene que soltar también ese listener.

import { describe, expect, it } from "vitest";

import { H, W, createArkanoidGame } from "@/app/lib/games/arkanoid";

import { verificaContrato } from "../harness/contrato";
import { montaMotor } from "../harness/motor";

verificaContrato("BLOQUE BUSTER", createArkanoidGame);

describe("BLOQUE BUSTER: resolución", () => {
  it("usa el canvas de 800×600 que fija el reproductor", () => {
    expect([W, H]).toEqual([800, 600]);
  });
});

describe("BLOQUE BUSTER: ratón", () => {
  it("destroy() suelta también el listener de puntero del canvas", () => {
    const m = montaMotor(createArkanoidGame);
    m.handle.start();
    m.handle.destroy();

    // Si el listener siguiera puesto escribiría en el closure de un motor ya
    // destruido. No debe ni lanzar ni reaccionar.
    expect(() => {
      m.canvas.dispatchEvent(
        new MouseEvent("pointermove", { clientX: 400, bubbles: true }),
      );
    }).not.toThrow();
    expect(m.reloj.pendientes).toBe(0);
  });
});
