// ===== tests/harness/skins.ts =====
// Suite compartida de skins, hermana de `contrato.ts`. Un motor la hereda con
// una línea:
//
//   verificaSkins("ROCAS", createAsteroidsGame, SKINS_ROCAS);
//
// Es lo que convierte la invariante nº 10 del contrato de motores
// (.claude/skills/nuevo-juego/contrato.md) en algo comprobable. Hasta ahora esa
// invariante —"los colores salen del tema"— era la única que nadie podía
// verificar más que leyendo el archivo.

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  MINIMOS,
  SKINS,
  type FichaDeSkins,
  type SkinId,
} from "@/app/lib/games/skins";
import type { GameFactory } from "@/app/lib/games/types";

import { coloresUsados, llamadasDeDibujo, olvidaColores } from "./canvas";
import { aRgba, contraste, distinguibles, ratio } from "./contraste";
import { montaMotor } from "./motor";

const IDS: readonly SkinId[] = SKINS.map(([id]) => id);

// Fotogramas que se dejan correr antes de mirar los colores. Suficientes para
// que un motor pase por la mayoría de sus estados de dibujo (partículas,
// power-ups, cambios de nivel) sin alargar la suite.
const FOTOGRAMAS = 300;

// Semilla fija para las dos corridas de la prueba de cero-regresión. Los cinco
// motores usan Math.random para siluetas, apariciones y titileos: sin fijarlo,
// dos corridas del MISMO skin ya darían secuencias distintas y la comparación
// no querría decir nada.
function instalaAzarDeterminista(semilla = 0x5eed): () => void {
  const original = Math.random;
  let s = semilla >>> 0;
  Math.random = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
  return () => {
    Math.random = original;
  };
}

// Un color pertenece a la paleta si su RGB está en ella. El alfa se ignora a
// propósito: conAlfa() y las estelas que se desvanecen producen decenas de
// variantes del mismo color, y todas son legítimas.
function clave(css: string): string {
  const [r, g, b] = aRgba(css);
  return `${Math.round(r)},${Math.round(g)},${Math.round(b)}`;
}

export function verificaSkins<R extends string>(
  nombre: string,
  factory: GameFactory,
  ficha: FichaDeSkins<R>,
) {
  const roles = Object.keys(ficha.roles) as R[];

  // El color de la superficie sobre la que se pinta un rol. Sin `sobre`, el
  // fondo del canvas — que por convención es el rol declarado como la
  // superficie de todo lo demás.
  const superficieDe = (
    paleta: Readonly<Record<R, string>>,
    rol: R,
  ): string => {
    const s = ficha.roles[rol].sobre;
    return s ? paleta[s as R] : paleta[roles[0]];
  };

  describe(`skins de ${nombre}`, () => {
    let restauraAzar: () => void;

    beforeEach(() => {
      restauraAzar = instalaAzarDeterminista();
    });

    afterEach(() => {
      restauraAzar();
    });

    it("las tres paletas cubren exactamente los mismos roles", () => {
      const esperados = [...roles].sort();
      for (const id of IDS) {
        expect(Object.keys(ficha.paletas[id]).sort(), `skin ${id}`).toEqual(
          esperados,
        );
      }
    });

    it("declara al menos un rol de superficie", () => {
      // El primero de la lista es el fondo del canvas y es la referencia por
      // defecto de todos los demás. Si nadie lo declara, todo se estaría
      // midiendo contra un color que no es fondo.
      expect(ficha.roles[roles[0]].clase).toBe("superficie");
    });

    it.each(IDS)("«%s» cumple el contraste de cada rol", (id) => {
      const paleta = ficha.paletas[id];
      const fallos: string[] = [];

      for (const rol of roles) {
        const { clase } = ficha.roles[rol];
        const medido = contraste(paleta[rol], superficieDe(paleta, rol));
        const limite = MINIMOS[clase];

        // "superficie" es un máximo y el resto son mínimos: un fondo demasiado
        // claro deja de leerse como fondo dentro del marco CRT.
        const pasa =
          clase === "superficie" ? medido <= limite : medido >= limite;

        if (!pasa) {
          fallos.push(
            `${rol} (${clase}, ${paleta[rol]}): ${ratio(medido)}, ` +
              `${clase === "superficie" ? "máximo" : "mínimo"} ${ratio(limite)}`,
          );
        }
      }

      expect(fallos, `contraste insuficiente en el skin «${id}»`).toEqual([]);
    });

    it.each(IDS)("«%s» distingue los colores de cada grupo", (id) => {
      const paleta = ficha.paletas[id];
      const fallos: string[] = [];

      for (const grupo of ficha.grupos) {
        for (let i = 0; i < grupo.length; i++) {
          for (let j = i + 1; j < grupo.length; j++) {
            const [a, b] = [grupo[i], grupo[j]];
            const fondo = superficieDe(paleta, a);
            if (!distinguibles(paleta[a], paleta[b], fondo)) {
              fallos.push(`${a} (${paleta[a]}) vs ${b} (${paleta[b]})`);
            }
          }
        }
      }

      expect(fallos, `colores indistinguibles en el skin «${id}»`).toEqual([]);
    });

    it.each(IDS)("«%s» no pinta ningún color fuera de su paleta", (id) => {
      const { handle, canvas, reloj } = montaMotor(factory, undefined, id);
      const ctx = canvas.getContext("2d")!;
      const permitidos = new Set(
        roles.map((rol) => clave(ficha.paletas[id][rol])),
      );

      handle.start();
      olvidaColores(ctx);
      reloj.avanza(FOTOGRAMAS);

      const intrusos = [
        ...new Set(coloresUsados(ctx).filter((c) => !permitidos.has(clave(c)))),
      ];
      handle.destroy();

      expect(intrusos, `literales de color fuera de la paleta «${id}»`).toEqual(
        [],
      );
    });

    it("montar sin skin pinta exactamente igual que montar con «neon»", () => {
      const corrida = (skin?: SkinId) => {
        const restaura = instalaAzarDeterminista();
        const { handle, canvas, reloj } = montaMotor(factory, undefined, skin);
        const ctx = canvas.getContext("2d")!;
        handle.start();
        olvidaColores(ctx);
        reloj.avanza(FOTOGRAMAS);
        const salida = {
          colores: [...coloresUsados(ctx)],
          llamadas: llamadasDeDibujo(ctx),
        };
        handle.destroy();
        restaura();
        return salida;
      };

      // Ésta es la prueba de la promesa que sostiene todo el sistema: quien no
      // elige nada ve el portal exactamente como antes de que hubiera skins.
      const sinSkin = corrida(undefined);
      const conNeon = corrida("neon");

      expect(conNeon.colores).toEqual(sinSkin.colores);
      expect(conNeon.llamadas).toBe(sinSkin.llamadas);
      expect(sinSkin.colores.length).toBeGreaterThan(0);
    });
  });
}
