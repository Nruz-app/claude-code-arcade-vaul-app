// ===== tests/games/arkanoid.test.ts =====
// BLOQUE BUSTER. Es el único motor que además engancha el ratón, y lo hace al
// canvas: `destroy()` tiene que soltar también ese listener.

import { describe, expect, it } from "vitest";

import {
  type Ball,
  type Block,
  type Paddle,
  H,
  SKINS_BLOQUE_BUSTER,
  W,
  createArkanoidGame,
  Input,
  stepBall,
} from "@/app/lib/games/arkanoid";

import { vecesPausado, vecesReproducido } from "../harness/audio";
import { creaCanvas } from "../harness/canvas";
import { verificaContrato } from "../harness/contrato";
import { verificaMando } from "../harness/mando";
import { montaMotor, pulsa, suelta } from "../harness/motor";
import { verificaRendimiento } from "../harness/rendimiento";
import { verificaSkins } from "../harness/skins";

const SFX_REBOTE = "/bloque-rebote.mp3";
const SFX_ROMPER = "/bloque-romper.mp3";

verificaContrato("BLOQUE BUSTER", createArkanoidGame);
verificaSkins("BLOQUE BUSTER", createArkanoidGame, SKINS_BLOQUE_BUSTER);
verificaMando("BLOQUE BUSTER", "bloque-buster", createArkanoidGame);
// Presupuesto medido el 2026-09-11, con la muralla cacheada en un canvas aparte
// (ver la caché del muro en arkanoid.ts). El peor fotograma de seis partidas de
// 600 fotogramas dio 23 llamadas de dibujo y 8 asignaciones de color; antes de
// la caché eran 136 y 193. Los techos están puestos para pillar que alguien
// vuelva a pintar los sesenta bloques con blur en cada fotograma, no el ruido
// del runner.
//
// El de heap va holgado a propósito: medido cinco veces seguidas en el mismo
// proceso osciló entre 42 y 393 KB, que es basura de los otros motores de la
// suite y no memoria que retenga este. Solo corre con --expose-gc.
verificaRendimiento("BLOQUE BUSTER", createArkanoidGame, {
  dibujoPorFrame: 32,
  coloresPorFrame: 12,
  emisionesEn600: 20,
  heapKbEn600: 700,
});

describe("BLOQUE BUSTER: resolución", () => {
  it("usa el canvas de 800×600 que fija el reproductor", () => {
    expect([W, H]).toEqual([800, 600]);
  });
});

// Un evento, un sonido: el rebote contra un muro o la paleta lo anuncia
// `bounced`, y el impacto contra un bloque NO, porque ese ya suena con su propio
// efecto. Se comprueba sobre `stepBall()` y no sobre el motor porque es ahí
// donde se decide, y porque es la línea que resulta tentador "arreglar" por
// simetría metiendo el marcado también en `bounceOffBlock()`.
describe("BLOQUE BUSTER: qué cuenta como rebote", () => {
  const paletaLejos: Paddle = { x: 0, y: 552, w: 88, h: 14 };

  it("rebotar contra un muro marca bounced", () => {
    // Pegada al muro izquierdo y yendo hacia él.
    const ball: Ball = { x: 2, y: 300, size: 14, vx: -300, vy: 0 };

    const outcome = stepBall(ball, 0.016, paletaLejos, [], 300);

    expect(outcome.bounced).toBe(true);
    expect(outcome.broken).toHaveLength(0);
  });

  it("romper un bloque no marca bounced, aunque físicamente sea un rebote", () => {
    // Subiendo hacia un bloque, lejos de los tres muros y de la paleta.
    const ball: Ball = { x: 400, y: 300, size: 14, vx: 0, vy: -300 };
    const bloque: Block = {
      x: 394,
      y: 250,
      w: 64,
      h: 24,
      color: "cyan",
      alive: true,
    };

    const outcome = stepBall(ball, 0.1, paletaLejos, [bloque], 300);

    expect(outcome.broken).toHaveLength(1);
    expect(outcome.bounced).toBe(false);
  });
});

describe("BLOQUE BUSTER: sonido", () => {
  // La pelota sale de la paleta a 35° desde el centro del canvas: vaya al lado
  // que vaya, la muralla del nivel 1 ocupa las diez columnas, así que la alcanza
  // en ~1 s sin haber tocado antes ninguna pared. No hace falta tocar
  // `Math.random()`.
  it("romper un bloque reproduce el ladrillo y no el rebote", () => {
    const m = montaMotor(createArkanoidGame);
    m.handle.start();

    // `initGame()` emite onScore(0) de salida; el segundo valor es el bloque.
    for (let i = 0; i < 200 && m.scores.length < 2; i++) m.reloj.avanza(1);

    expect(m.scores.at(-1)).toBeGreaterThan(0);
    expect(vecesReproducido(SFX_ROMPER)).toBe(1);
    expect(vecesReproducido(SFX_REBOTE)).toBe(0);
    m.handle.destroy();
  });

  it("el rebote suena durante la partida", () => {
    const m = montaMotor(createArkanoidGame);
    m.handle.start();
    m.reloj.avanza(400);

    expect(vecesReproducido(SFX_REBOTE)).toBeGreaterThan(0);
    m.handle.destroy();
  });

  it("pause() corta los dos efectos y destroy() los suelta", () => {
    const m = montaMotor(createArkanoidGame);
    m.handle.start();
    m.reloj.avanza(10);

    m.handle.pause();
    expect(vecesPausado(SFX_REBOTE)).toBe(1);
    expect(vecesPausado(SFX_ROMPER)).toBe(1);

    // `destroy()` vuelve a pausar antes de soltar el elemento.
    m.handle.destroy();
    expect(vecesPausado(SFX_REBOTE)).toBe(2);
    expect(vecesPausado(SFX_ROMPER)).toBe(2);
  });

  // end() NO silencia, a propósito: la cola del último golpe termina de sonar
  // sobre el modal de FIN DEL JUEGO.
  it("end() no corta lo que esté sonando", () => {
    const m = montaMotor(createArkanoidGame);
    m.handle.start();
    m.reloj.avanza(10);

    m.handle.end();

    expect(vecesPausado(SFX_REBOTE)).toBe(0);
    expect(vecesPausado(SFX_ROMPER)).toBe(0);
    m.handle.destroy();
  });
});

describe("BLOQUE BUSTER: ratón y dedo", () => {
  it("destroy() suelta los DOS listeners de puntero del canvas", () => {
    const m = montaMotor(createArkanoidGame);
    m.handle.start();
    m.handle.destroy();

    // Si alguno siguiera puesto escribiría en el closure de un motor ya
    // destruido. No debe ni lanzar ni reaccionar.
    for (const tipo of ["pointermove", "pointerdown"]) {
      expect(() => {
        m.canvas.dispatchEvent(
          new MouseEvent(tipo, { clientX: 400, bubbles: true }),
        );
      }, `${tipo} sigue enganchado tras destroy()`).not.toThrow();
    }
    expect(m.reloj.pendientes).toBe(0);
  });

  it("un toque sin arrastrar coloca la paleta (SPEC 14)", () => {
    // Con ratón `pointermove` basta: el puntero ya está sobre el canvas. Con un
    // dedo no existe "estar encima", así que el primer evento de un toque es
    // `pointerdown`; sin escucharlo, tocar la pantalla no movía la paleta hasta
    // que el dedo se desplazaba unos píxeles.
    const canvas = creaCanvas();
    // jsdom no maqueta, así que devuelve un rect de ancho 0 y el handler se
    // cortaría en su propia guardia. Con un rect real se puede comprobar además
    // la conversión de píxeles de pantalla a la resolución lógica del canvas.
    canvas.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 400, height: 300 }) as DOMRect;

    const input = new Input(canvas);
    input.attach();

    expect(input.takePointerX()).toBeNull(); // nada tocado todavía

    canvas.dispatchEvent(
      new MouseEvent("pointerdown", { clientX: 200, bubbles: true }),
    );

    // El canvas se enseña a 400 px de ancho y trabaja a 800: la mitad de la
    // pantalla es la mitad del mundo del juego.
    expect(input.takePointerX()).toBe(W / 2);
    input.detach();
  });
});

describe("BLOQUE BUSTER: el mando mantiene y suelta", () => {
  it("una tecla mantenida deja de estarlo al soltarla", () => {
    // Esto es el contrato exacto del mando táctil: `pointerdown` despacha
    // keydown y `pointerup` despacha keyup. Sin la segunda mitad, apoyar el
    // dedo en un botón lo dejaría pulsado para siempre.
    const input = new Input(creaCanvas());
    input.attach();

    for (const code of ["ArrowLeft", "ArrowRight"]) {
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
