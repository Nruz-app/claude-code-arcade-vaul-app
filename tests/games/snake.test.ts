// ===== tests/games/snake.test.ts =====
// SERPENTINA. Es el primer motor con sprites, así que tiene una carga asíncrona
// (`new Image()`) que la factory síncrona no puede esperar: el motor dibuja un
// fallback hasta el onload. En jsdom la imagen nunca carga, que es justamente
// el caso que debe seguir funcionando.

import { describe, expect, it } from "vitest";

import { H, SKINS_SERPENTINA, W, createSnakeGame } from "@/app/lib/games/snake";

import { verificaContrato } from "../harness/contrato";
import { montaMotor } from "../harness/motor";
import { verificaSkins } from "../harness/skins";

verificaContrato("SERPENTINA", createSnakeGame);
verificaSkins("SERPENTINA", createSnakeGame, SKINS_SERPENTINA);

describe("SERPENTINA: resolución", () => {
  it("usa el canvas de 800×600 que fija el reproductor", () => {
    expect([W, H]).toEqual([800, 600]);
  });
});

describe("SERPENTINA: vidas", () => {
  it("emite onLives(1) al empezar y onLives(0) al terminar", () => {
    const m = montaMotor(createSnakeGame);
    m.handle.start();
    expect(m.vidas[0]).toBe(1);

    m.reloj.avanza(20);
    m.handle.end();
    expect(m.vidas.at(-1)).toBe(0);
    m.handle.destroy();
  });
});

describe("SERPENTINA: sprite de las frutas", () => {
  it("juega con normalidad aunque el PNG no llegue a cargar", () => {
    // El fallback (un rombo del color de la rareza) es lo que evita que una
    // red lenta deje la partida sin frutas visibles.
    const m = montaMotor(createSnakeGame);
    m.handle.start();
    expect(() => m.reloj.avanza(300)).not.toThrow();
    m.handle.destroy();
  });
});
