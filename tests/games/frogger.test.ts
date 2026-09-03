// ===== tests/games/frogger.test.ts =====
// RANARIA. Es el primer motor con sonido (SPEC 11): dos efectos, el salto y el
// atropello. Bajo jsdom no suena nada, así que lo que se comprueba es quién
// dispara qué, con el stub de tests/harness/audio.ts.

import { describe, expect, it } from "vitest";

import {
  H,
  SKINS_RANARIA,
  W,
  createFroggerGame,
} from "@/app/lib/games/frogger";

import { vecesReproducido } from "../harness/audio";
import { verificaContrato } from "../harness/contrato";
import { verificaMando } from "../harness/mando";
import { montaMotor, pulsa, suelta } from "../harness/motor";
import { verificaSkins } from "../harness/skins";

const SFX_SALTO = "/rana-salto.mp3";
const SFX_CHOQUE = "/rana-choque.mp3";

verificaContrato("RANARIA", createFroggerGame);
verificaSkins("RANARIA", createFroggerGame, SKINS_RANARIA);
verificaMando("RANARIA", "ranaria", createFroggerGame);

describe("RANARIA: resolución", () => {
  it("usa el canvas de 800×600 que fija el reproductor", () => {
    expect([W, H]).toEqual([800, 600]);
  });
});

describe("RANARIA: sonido del salto", () => {
  it("suena en cada salto que mueve a la rana", () => {
    const m = montaMotor(createFroggerGame);
    m.handle.start();

    // Un salto a la izquierda y otro a la derecha: los dos caben, la rana
    // arranca en el centro de la orilla.
    pulsa("ArrowLeft");
    m.reloj.avanza(1);
    pulsa("ArrowRight");
    m.reloj.avanza(8); // la interpolación del salto dura 90 ms

    expect(vecesReproducido(SFX_SALTO)).toBe(2);
    m.handle.destroy();
  });

  it("no suena si el salto se ignora por el borde del canvas", () => {
    const m = montaMotor(createFroggerGame);
    m.handle.start();

    // Hacia abajo desde la orilla de salida: no hay fila 12, así que saltar() se
    // corta en la guardia y no debe sonar nada.
    pulsa("ArrowDown");
    m.reloj.avanza(8);

    expect(vecesReproducido(SFX_SALTO)).toBe(0);
    m.handle.destroy();
  });
});

describe("RANARIA: sonido del atropello", () => {
  it("suena al ser arrollada, y solo entonces", () => {
    const m = montaMotor(createFroggerGame);
    m.handle.start();

    // El convoy es determinista —Math.random() solo interviene en la mosca—, así
    // que meterse en el primer carril de carretera y esperar acaba siempre en
    // atropello. Se avanza hasta que se pierde la primera vida.
    pulsa("ArrowUp");
    for (let i = 0; i < 400 && m.vidas.at(-1) === 3; i++) m.reloj.avanza(1);

    expect(m.vidas.at(-1)).toBe(2);
    expect(vecesReproducido(SFX_CHOQUE)).toBe(1);
    m.handle.destroy();
  });

  it("agotar el temporizador cuesta una vida y no suena", () => {
    const m = montaMotor(createFroggerGame);
    m.handle.start();

    // Quieta en la orilla, que es tierra firme: la única muerte posible es el
    // reloj. TIEMPO_BASE son 30 s, y el dt del bucle está capado a 50 ms.
    for (let i = 0; i < 700 && m.vidas.at(-1) === 3; i++) m.reloj.avanza(1, 50);

    expect(m.vidas.at(-1)).toBe(2);
    expect(vecesReproducido(SFX_CHOQUE)).toBe(0);
    expect(vecesReproducido(SFX_SALTO)).toBe(0);
    m.handle.destroy();
  });
});

describe("RANARIA: el mando salta", () => {
  it("cada botón de la cruceta que mueve a la rana suena", () => {
    // El efecto observable de RANARIA es su sonido, que es como ya lo comprueba
    // el resto de este archivo. Tres de las cuatro direcciones mueven a la rana
    // desde la orilla de salida; ArrowDown no, porque debajo no hay fila.
    const m = montaMotor(createFroggerGame);
    m.handle.start();

    for (const code of ["ArrowLeft", "ArrowRight", "ArrowUp"]) {
      pulsa(code);
      suelta(code);
      m.reloj.avanza(8); // la interpolación del salto dura 90 ms
    }

    expect(vecesReproducido(SFX_SALTO)).toBe(3);
    m.handle.destroy();
  });
});
