// ===== tests/games/tetris.test.ts =====
// CAÍDA. Es un juego sin vidas, así que el HUD depende de que emita onLives(1)
// al empezar; si no, enseña tres corazones que no existen.

import { describe, expect, it } from "vitest";

import { H, W, createTetrisGame } from "@/app/lib/games/tetris";

import { verificaContrato } from "../harness/contrato";
import { montaMotor } from "../harness/motor";

verificaContrato("CAÍDA", createTetrisGame);

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
