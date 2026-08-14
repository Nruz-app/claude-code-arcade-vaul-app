// ===== tests/games/audio.test.ts =====
// El helper de efectos de sonido. Lo que se prueba no es que suene —bajo jsdom no
// suena nada— sino que la política de reproducción se cumple: una voz que se
// reinicia, y ningún camino que pueda tumbar una partida.

import { describe, expect, it, vi } from "vitest";

import { crearSfx } from "@/app/lib/games/audio";

import { vecesPausado, vecesReproducido } from "../harness/audio";

const SRC = "/rana-salto.mp3";

describe("crearSfx: reproducción", () => {
  it("fija el volumen que se le pasa", () => {
    // El elemento no está en el documento a propósito, así que se observa por
    // donde se le escribe: el setter del prototipo.
    const puestos: number[] = [];
    const espia = vi
      .spyOn(HTMLMediaElement.prototype, "volume", "set")
      .mockImplementation((v: number) => void puestos.push(v));

    const sfx = crearSfx(SRC, 0.35);

    expect(puestos).toEqual([0.35]);
    espia.mockRestore();
    sfx.destroy();
  });

  it("reproduce el src que se le dio", () => {
    const sfx = crearSfx(SRC, 0.5);
    sfx.play();
    sfx.play();
    expect(vecesReproducido(SRC)).toBe(2);
    sfx.destroy();
  });

  it("reinicia el efecto en cada disparo, para que no se solapen", () => {
    const sfx = crearSfx(SRC, 0.5);
    const puestos: number[] = [];
    const espia = vi
      .spyOn(HTMLMediaElement.prototype, "currentTime", "set")
      .mockImplementation((v: number) => void puestos.push(v));

    sfx.play();
    sfx.play();

    expect(puestos).toEqual([0, 0]);
    espia.mockRestore();
    sfx.destroy();
  });
});

describe("crearSfx: no puede tumbar una partida", () => {
  it("se traga un play() que rechaza, como el bloqueo de autoplay", async () => {
    const sfx = crearSfx(SRC, 0.5);
    const espia = vi
      .spyOn(HTMLMediaElement.prototype, "play")
      .mockImplementation(() => Promise.reject(new Error("NotAllowedError")));

    expect(() => sfx.play()).not.toThrow();
    // Si el rechazo no se capturara, saldría aquí como unhandled rejection.
    await Promise.resolve();

    espia.mockRestore();
    sfx.destroy();
  });

  it("se traga un play() que no devuelve promesa, que es lo que hace jsdom", () => {
    const sfx = crearSfx(SRC, 0.5);
    const espia = vi
      .spyOn(HTMLMediaElement.prototype, "play")
      .mockImplementation(() => undefined as unknown as Promise<void>);

    expect(() => sfx.play()).not.toThrow();

    espia.mockRestore();
    sfx.destroy();
  });

  it("se traga un play() que lanza", () => {
    const sfx = crearSfx(SRC, 0.5);
    const espia = vi
      .spyOn(HTMLMediaElement.prototype, "play")
      .mockImplementation(() => {
        throw new Error("sin salida de audio");
      });

    expect(() => sfx.play()).not.toThrow();

    espia.mockRestore();
    sfx.destroy();
  });
});

describe("crearSfx: silenciar y destroy", () => {
  it("silenciar() pausa sin soltar el elemento: se puede volver a disparar", () => {
    const sfx = crearSfx(SRC, 0.5);
    sfx.play();
    sfx.silenciar();
    expect(vecesPausado(SRC)).toBe(1);

    sfx.play();
    expect(vecesReproducido(SRC)).toBe(2);
    sfx.destroy();
  });

  it("destroy() pausa, suelta el src y deja el Sfx mudo", () => {
    const sfx = crearSfx(SRC, 0.5);
    sfx.play();
    sfx.destroy();

    const reproducidasAntes = vecesReproducido(SRC);
    sfx.play();
    sfx.silenciar();
    sfx.destroy();

    // Nada de eso vuelve a tocar el elemento soltado.
    expect(vecesReproducido(SRC)).toBe(reproducidasAntes);
  });
});
