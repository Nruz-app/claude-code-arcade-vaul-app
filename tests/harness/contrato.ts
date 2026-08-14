// ===== tests/harness/contrato.ts =====
// La suite compartida: las invariantes de `.claude/skills/nuevo-juego/contrato.md`
// convertidas en aserciones. Cada archivo de `tests/games/` la invoca con su
// factory, así que un motor nuevo hereda las 20 comprobaciones con una línea.
//
// Solo va aquí lo que TODO motor debe cumplir. Lo propio de un juego (que las
// líneas de CAÍDA puntúen, que la serpiente crezca) vive en su archivo.

import { describe, expect, it } from "vitest";

import type { GameFactory } from "@/app/lib/games/types";

import { llamadasDeDibujo } from "./canvas";
import { instalaReloj } from "./reloj";
import { montaMotor, pulsa, tieneRepetidosSeguidos } from "./motor";

// Tecla presente en el PREVENT_DEFAULT de los cinco motores, así que sirve
// como sonda para saber si los listeners siguen enganchados.
const TECLA_COMUN = "ArrowLeft";

const MOTIVOS_VALIDOS = ["game_over", "surrender"];

export function verificaContrato(nombre: string, factory: GameFactory) {
  describe(`contrato de ${nombre}`, () => {
    // ── La factory ────────────────────────────────────────────────────────────

    it("la factory es síncrona y no arranca el bucle", () => {
      const m = montaMotor(factory);
      expect(m.reloj.pendientes).toBe(0);
      // Tampoco emite nada: el HUD no debe moverse hasta que se pulse ESPACIO.
      expect(m.scores).toEqual([]);
      expect(m.vidas).toEqual([]);
      expect(m.niveles).toEqual([]);
      expect(m.finales).toEqual([]);
    });

    it("devuelve los cinco métodos del GameHandle, ni uno más", () => {
      const m = montaMotor(factory);
      expect(Object.keys(m.handle).sort()).toEqual([
        "destroy",
        "end",
        "pause",
        "resume",
        "start",
      ]);
    });

    it("dos instancias no comparten estado (nada a nivel de módulo)", () => {
      // La invariante nº 1: en Next un `let` de módulo sobrevive entre
      // montajes, así que navegar a otro juego y volver arrastraría la
      // puntuación anterior.
      const reloj = instalaReloj();
      const a = montaMotor(factory, reloj);
      const b = montaMotor(factory, reloj);

      a.handle.start();
      b.handle.start();
      reloj.avanza(30);
      a.handle.end();

      // Terminar A no termina B.
      expect(a.finales).toHaveLength(1);
      expect(b.finales).toHaveLength(0);

      // Y B sigue viva: su bucle continúa encolando.
      expect(reloj.pendientes).toBeGreaterThan(0);

      b.handle.destroy();
      a.handle.destroy();
    });

    it("una partida nueva arranca de cero aunque la anterior puntuara", () => {
      const m = montaMotor(factory);
      m.handle.start();
      m.reloj.avanza(120);
      m.handle.start(); // "JUGAR DE NUEVO"

      // La invariante nº 8: initGame() fuerza los tres callbacks sin pasar por
      // los setters, justo para que el HUD no se quede con la partida vieja.
      expect(m.scores.at(-1)).toBe(0);
      expect(m.niveles.at(-1)).toBe(1);
      m.handle.destroy();
    });

    // ── start() ───────────────────────────────────────────────────────────────

    it("start() emite los tres callbacks del HUD", () => {
      const m = montaMotor(factory);
      m.handle.start();

      expect(m.scores[0]).toBe(0);
      expect(m.niveles[0]).toBe(1);
      // Los juegos sin vidas emiten onLives(1); el resto, sus vidas iniciales.
      // Sin esta emisión el HUD enseña tres corazones que no existen.
      expect(m.vidas[0]).toBeGreaterThanOrEqual(1);
      m.handle.destroy();
    });

    it("start() encola exactamente un fotograma", () => {
      const m = montaMotor(factory);
      m.handle.start();
      expect(m.reloj.pendientes).toBe(1);
      m.handle.destroy();
    });

    it("start() es re-entrante: no deja dos bucles vivos", () => {
      const m = montaMotor(factory);
      m.handle.start();
      m.reloj.avanza(10);
      m.handle.start();
      // Dos bucles simultáneos harían correr el juego al doble de velocidad.
      expect(m.reloj.pendientes).toBe(1);
      m.handle.destroy();
    });

    it("dibuja en el canvas que recibe", () => {
      const m = montaMotor(factory);
      const ctx = m.canvas.getContext("2d")!;
      m.handle.start();
      m.reloj.avanza(3);
      expect(llamadasDeDibujo(ctx)).toBeGreaterThan(0);
      m.handle.destroy();
    });

    // ── Emisión de callbacks ──────────────────────────────────────────────────

    it("emite los callbacks solo cuando el valor cambia", () => {
      const m = montaMotor(factory);
      m.handle.start();
      m.reloj.avanza(180); // ~3 s de juego

      // Un valor repetido justo detrás de otro igual es una emisión de más, y
      // cada emisión provoca un render de React.
      expect(tieneRepetidosSeguidos(m.scores)).toBe(false);
      expect(tieneRepetidosSeguidos(m.vidas)).toBe(false);
      expect(tieneRepetidosSeguidos(m.niveles)).toBe(false);
      m.handle.destroy();
    });

    it("no emite un callback por fotograma", () => {
      const m = montaMotor(factory);
      m.handle.start();
      m.reloj.avanza(180);
      // Con 180 fotogramas, cualquier cifra cercana significa que se emite en
      // el bucle en vez de en el cambio.
      expect(m.scores.length).toBeLessThan(60);
      expect(m.niveles.length).toBeLessThan(60);
      m.handle.destroy();
    });

    // ── pause() / resume() ────────────────────────────────────────────────────

    it("pause() detiene el bucle y resume() lo reanuda", () => {
      const m = montaMotor(factory);
      m.handle.start();
      m.reloj.avanza(5);

      m.handle.pause();
      expect(m.reloj.pendientes).toBe(0);

      m.handle.resume();
      expect(m.reloj.pendientes).toBe(1);
      m.handle.destroy();
    });

    it("el tiempo en pausa no cuenta como tiempo jugado", () => {
      // La invariante nº 6, que es lo que mide la columna `duration_ms` de
      // Supabase: tiempo jugado, no tiempo transcurrido.
      const m = montaMotor(factory);
      m.handle.start();
      m.reloj.avanza(10); // ~160 ms jugados
      m.handle.pause();
      m.reloj.salta(60_000); // un minuto con la partida pausada
      m.handle.resume();
      m.reloj.avanza(10); // ~160 ms más
      m.handle.end();

      const { durationMs } = m.finales[0];
      expect(durationMs).toBeGreaterThan(0);
      expect(durationMs).toBeLessThan(2_000);
      m.handle.destroy();
    });

    it("pause() y resume() fuera de partida no rompen ni tocan el HUD", () => {
      // Ojo con lo que NO se afirma aquí: los cinco motores arrancan en estado
      // "playing", así que un `resume()` sobre un motor recién creado sí encola
      // un fotograma. Es inalcanzable desde el reproductor —el efecto de
      // `blur` lleva `if (!engine || !started …)` y el botón de PAUSA no
      // existe hasta arrancar—, y el contrato no promete nada al respecto, así
      // que la prueba se queda en que no revienta y no ensucia el HUD.
      const m = montaMotor(factory);
      expect(() => m.handle.pause()).not.toThrow();
      expect(() => m.handle.resume()).not.toThrow();
      expect(m.scores).toEqual([]);
      expect(m.finales).toEqual([]);
      m.handle.destroy();
    });

    // ── dt capado ─────────────────────────────────────────────────────────────

    it("capa el dt: volver de otra pestaña no teletransporta nada", () => {
      // La invariante nº 7. Sin el cap, un fotograma de 10 s avanzaría el juego
      // 10 s de golpe: en BLOQUE BUSTER la bola atraviesa los bloques.
      const m = montaMotor(factory);
      m.handle.start();
      m.reloj.avanza(1); // el primero trae dt = 0 (lastTime === null)
      m.reloj.avanza(1, 10_000); // fotograma con 10 s de salto
      m.handle.end();

      // Con el cap en 50 ms, ese fotograma aporta 50 ms como mucho.
      expect(m.finales[0].durationMs).toBeLessThan(200);
      m.handle.destroy();
    });

    it("reanudar tras una pausa no produce un salto de dt", () => {
      const m = montaMotor(factory);
      m.handle.start();
      m.reloj.avanza(5);
      m.handle.pause();
      m.reloj.salta(30_000);
      m.handle.resume();
      m.reloj.avanza(1); // primer fotograma tras reanudar
      m.handle.end();

      // stopLoop() pone lastTime = null, así que este fotograma vale dt = 0.
      expect(m.finales[0].durationMs).toBeLessThan(1_000);
      m.handle.destroy();
    });

    // ── end() ─────────────────────────────────────────────────────────────────

    it("end() emite onGameOver una sola vez, con motivo surrender", () => {
      const m = montaMotor(factory);
      m.handle.start();
      m.reloj.avanza(20);
      m.handle.end();

      expect(m.finales).toHaveLength(1);
      expect(m.finales[0].reason).toBe("surrender");
      m.handle.destroy();
    });

    it("end() dos veces no registra la partida por duplicado", () => {
      // Primera de las dos barreras contra el duplicado en Supabase; la
      // segunda es `registradaRef` en el reproductor.
      const m = montaMotor(factory);
      m.handle.start();
      m.reloj.avanza(20);
      m.handle.end();
      m.handle.end();
      m.handle.end();

      expect(m.finales).toHaveLength(1);
      m.handle.destroy();
    });

    it("end() detiene el bucle", () => {
      const m = montaMotor(factory);
      m.handle.start();
      m.reloj.avanza(20);
      m.handle.end();
      expect(m.reloj.pendientes).toBe(0);
      m.handle.destroy();
    });

    it("el GameOverSummary tiene la forma que espera Supabase", () => {
      const m = montaMotor(factory);
      m.handle.start();
      m.reloj.avanza(60);
      m.handle.end();

      const resumen = m.finales[0];
      expect(Object.keys(resumen).sort()).toEqual([
        "durationMs",
        "level",
        "reason",
        "score",
      ]);
      expect(Number.isInteger(resumen.score)).toBe(true);
      expect(resumen.score).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(resumen.level)).toBe(true);
      expect(resumen.level).toBeGreaterThanOrEqual(1);
      // `duration_ms` es un entero en la base: un decimal se guardaría mal.
      expect(Number.isInteger(resumen.durationMs)).toBe(true);
      expect(resumen.durationMs).toBeGreaterThanOrEqual(0);
      // La restricción `check` de game_sessions solo admite estos dos.
      expect(MOTIVOS_VALIDOS).toContain(resumen.reason);
      m.handle.destroy();
    });

    it("el score final del resumen coincide con el último emitido", () => {
      const m = montaMotor(factory);
      m.handle.start();
      m.reloj.avanza(120);
      m.handle.end();
      expect(m.finales[0].score).toBe(m.scores.at(-1));
      expect(m.finales[0].level).toBe(m.niveles.at(-1));
      m.handle.destroy();
    });

    // ── destroy() ─────────────────────────────────────────────────────────────

    it("destroy() no emite onGameOver: desmontar no es terminar", () => {
      // Si emitiera, navegar fuera del reproductor registraría una partida
      // fantasma en Supabase.
      const m = montaMotor(factory);
      m.handle.start();
      m.reloj.avanza(20);
      m.handle.destroy();
      expect(m.finales).toHaveLength(0);
    });

    it("destroy() cancela el bucle", () => {
      const m = montaMotor(factory);
      m.handle.start();
      m.reloj.avanza(20);
      m.handle.destroy();
      expect(m.reloj.pendientes).toBe(0);

      // Y no revive solo: avanzar el reloj no vuelve a encolar.
      m.reloj.avanza(20);
      expect(m.reloj.pendientes).toBe(0);
    });

    it("destroy() quita los listeners de teclado de window", () => {
      const m = montaMotor(factory);
      m.handle.start();

      // Con el motor enganchado, la tecla del juego se consume.
      expect(pulsa(TECLA_COMUN).defaultPrevented).toBe(true);

      m.handle.destroy();

      // Después no: si el listener siguiera puesto, el juego bloquearía el
      // scroll de la página desde fuera de la partida.
      expect(pulsa(TECLA_COMUN).defaultPrevented).toBe(false);
    });

    it("destroy() sin haber arrancado no rompe ni emite", () => {
      const m = montaMotor(factory);
      expect(() => m.handle.destroy()).not.toThrow();
      expect(m.finales).toHaveLength(0);
    });

    it("destroy() dos veces no rompe", () => {
      const m = montaMotor(factory);
      m.handle.start();
      m.handle.destroy();
      expect(() => m.handle.destroy()).not.toThrow();
    });

    // ── Aguante ───────────────────────────────────────────────────────────────

    it("aguanta 600 fotogramas sin lanzar", () => {
      // ~10 s de juego a 60 fps. No comprueba reglas: comprueba que ninguna
      // ruta del update/draw revienta con el paso del tiempo.
      const m = montaMotor(factory);
      m.handle.start();
      expect(() => m.reloj.avanza(600)).not.toThrow();
      m.handle.destroy();
    });

    it("aguanta las teclas del juego pulsadas durante la partida", () => {
      const m = montaMotor(factory);
      m.handle.start();
      expect(() => {
        for (let i = 0; i < 60; i++) {
          pulsa(
            ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space"][i % 5],
          );
          m.reloj.avanza(4);
        }
      }).not.toThrow();
      m.handle.destroy();
    });
  });
}
