// ===== tests/games/asteroids.test.ts =====
// ROCAS. Además del contrato común, aquí van sus utilidades puras, que son las
// únicas que el motor exporta al margen de la factory.

import { describe, expect, it } from "vitest";

import {
  H,
  W,
  createAsteroidsGame,
  dist,
  rand,
  wrap,
} from "@/app/lib/games/asteroids";

import { verificaContrato } from "../harness/contrato";
import { montaMotor } from "../harness/motor";

verificaContrato("ROCAS", createAsteroidsGame);

describe("ROCAS: resolución", () => {
  it("usa el canvas de 800×600 que fija el reproductor", () => {
    // Otra resolución sale deformada: `.crt-screen` declara aspect-ratio 4/3.
    expect([W, H]).toEqual([800, 600]);
  });
});

describe("ROCAS: utilidades puras", () => {
  it("wrap() envuelve por los dos lados y deja pasar lo que está dentro", () => {
    expect(wrap(50, 800)).toBe(50);
    expect(wrap(-10, 800)).toBe(790);
    expect(wrap(810, 800)).toBe(10);
  });

  it("dist() es la distancia euclídea entre dos puntos", () => {
    expect(dist({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
    expect(dist({ x: 2, y: 2 }, { x: 2, y: 2 })).toBe(0);
  });

  it("rand() se queda dentro del rango pedido", () => {
    for (let i = 0; i < 200; i++) {
      const v = rand(10, 20);
      expect(v).toBeGreaterThanOrEqual(10);
      expect(v).toBeLessThan(20);
    }
  });
});

describe("ROCAS: vidas", () => {
  it("empieza con tres vidas", () => {
    const m = montaMotor(createAsteroidsGame);
    m.handle.start();
    expect(m.vidas[0]).toBe(3);
    m.handle.destroy();
  });
});
