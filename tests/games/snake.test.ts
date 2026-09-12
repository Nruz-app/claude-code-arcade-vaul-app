// ===== tests/games/snake.test.ts =====
// SERPENTINA. Es el primer motor con sprites, así que tiene una carga asíncrona
// (`new Image()`) que la factory síncrona no puede esperar: el motor dibuja un
// fallback hasta el onload. En jsdom la imagen nunca carga, que es justamente
// el caso que debe seguir funcionando.

import { describe, expect, it } from "vitest";

import { H, SKINS_SERPENTINA, W, createSnakeGame } from "@/app/lib/games/snake";

import { verificaContrato } from "../harness/contrato";
import { verificaMando } from "../harness/mando";
import { montaMotor, pulsa } from "../harness/motor";
import { verificaRendimiento } from "../harness/rendimiento";
import { verificaSkins } from "../harness/skins";

verificaContrato("SERPENTINA", createSnakeGame);
verificaSkins("SERPENTINA", createSnakeGame, SKINS_SERPENTINA);
verificaMando("SERPENTINA", "serpentina", createSnakeGame);

// Presupuesto medido el 2026-09-11 (fotograma 80, serpiente de 3 segmentos):
// 38 llamadas de dibujo y 6 asignaciones de color por fotograma, 1 emisión en
// 600 fotogramas. Antes de cachear el fondo eran 148 y 8.
//
// Los techos llevan holgura sobre lo medido, no son objetivos: el de dibujo
// absorbe que la serpiente crezca hasta 3 segmentos si come dentro de la
// ventana (+24 llamadas) y sigue pillando de sobra una vuelta a retrazar la
// rejilla entera. El de heap está por encima del ruido del runner, que en esta
// máquina va de −155 a +286 KB: solo caza una regresión de orden de magnitud.
verificaRendimiento("SERPENTINA", createSnakeGame, {
  dibujoPorFrame: 72,
  coloresPorFrame: 8,
  emisionesEn600: 20,
  heapKbEn600: 600,
});

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

describe("SERPENTINA: el mando gira la serpiente", () => {
  // Cuántos fotogramas tarda la partida en acabarse contra una pared, girando
  // antes hacia `code` o sin girar. La serpiente arranca en el centro (col 16
  // de 32, fila 12 de 24) mirando a la derecha, así que el techo está más cerca
  // que la pared derecha: girar hacia arriba tiene que acortar la partida.
  function fotogramasHastaElFinal(code?: string): number {
    const m = montaMotor(createSnakeGame);
    m.handle.start();
    if (code) pulsa(code);

    let n = 0;
    while (m.finales.length === 0 && n < 400) {
      m.reloj.avanza(1);
      n++;
    }
    m.handle.destroy();
    return n;
  }

  it("girar hacia arriba estrella la serpiente antes que seguir recto", () => {
    // Si el giro no llegara al motor, las dos partidas durarían lo mismo: la
    // serpiente seguiría hacia la derecha en los dos casos.
    const recto = fotogramasHastaElFinal();
    const arriba = fotogramasHastaElFinal("ArrowUp");

    expect(recto).toBeLessThan(400); // la partida termina sola, sin girar
    expect(arriba).toBeLessThan(recto);
  });

  it("un giro imposible se descarta, como con el teclado", () => {
    // La serpiente arranca hacia la derecha, así que ArrowLeft es una reversa
    // y el motor la descarta: la partida tiene que durar exactamente lo mismo
    // que sin tocar nada. Prueba que el mando no se salta las reglas del
    // motor —despacha la misma tecla y pasa por el mismo `Input`—, no solo que
    // "algo llega".
    expect(fotogramasHastaElFinal("ArrowLeft")).toBe(fotogramasHastaElFinal());
  });
});
