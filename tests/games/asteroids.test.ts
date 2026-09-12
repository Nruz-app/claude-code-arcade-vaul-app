// ===== tests/games/asteroids.test.ts =====
// ROCAS. Además del contrato común, aquí van sus utilidades puras, que son las
// únicas que el motor exporta al margen de la factory.

import { describe, expect, it } from "vitest";

import {
  Input,
  H,
  SKINS_ROCAS,
  W,
  createAsteroidsGame,
  dist,
  rand,
  wrap,
} from "@/app/lib/games/asteroids";

import { verificaContrato } from "../harness/contrato";
import { verificaMando } from "../harness/mando";
import { montaMotor, pulsa, suelta } from "../harness/motor";
import { verificaRendimiento } from "../harness/rendimiento";
import { verificaSkins } from "../harness/skins";

verificaContrato("ROCAS", createAsteroidsGame);
verificaSkins("ROCAS", createAsteroidsGame, SKINS_ROCAS);
verificaMando("ROCAS", "rocas", createAsteroidsGame);

// Presupuesto medido el 2026-09-11, con las opciones por defecto de la suite (60
// fotogramas de calentamiento, 20 medidos). Esa ventana es la tranquila —la nave
// no dispara, así que hay cuatro rocas y nada más—: 67 llamadas de dibujo y 3
// asignaciones de color en el fotograma más caro, 0 emisiones y ~40 KB. Antes de
// subir el estado de cada grupo a draw() y de cambiar save()/restore() por
// setTransform() eran 80 y 6 con el mismo escenario, y 174,9 y 15,3 de media en
// una partida de verdad (nave acelerando, un disparo cada 12 fotogramas, ocho
// rocas y ~18 partículas), que ahora cuesta 149,9 y 6,5.
//
// El techo de dibujo no es el medido + 25 % sino el PEOR caso posible de la
// ventana: cada roca se dibuja con entre 8 y 13 vértices al azar, así que cuatro
// rocas y la nave con llama pueden llegar a ~91 llamadas sin que nada vaya mal.
// El que de verdad muerde aquí es `coloresPorFrame`: en esta ventana solo hay
// cuatro colores posibles (fondo, roca, nave, propulsor) porque el color es del
// grupo y no de la entidad; volver a asignarlo por roca lo rompe al instante.
verificaRendimiento("ROCAS", createAsteroidsGame, {
  dibujoPorFrame: 110,
  coloresPorFrame: 6,
  emisionesEn600: 8,
  heapKbEn600: 300,
});

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

describe("ROCAS: el mando mantiene y suelta", () => {
  it("una tecla mantenida deja de estarlo al soltarla", () => {
    // Esto es el contrato exacto del mando táctil: `pointerdown` despacha
    // keydown y `pointerup` despacha keyup. Sin la segunda mitad, apoyar el
    // dedo en un botón lo dejaría pulsado para siempre.
    const input = new Input();
    input.attach();

    for (const code of ["ArrowLeft", "ArrowRight", "ArrowUp", "Space"]) {
      pulsa(code);
      expect(input.isHeld(code), `${code} no se registró como pulsada`).toBe(
        true,
      );
      suelta(code);
      expect(input.isHeld(code), `${code} se quedó pulsada al soltarla`).toBe(
        false,
      );
    }

    input.detach();
  });
});
