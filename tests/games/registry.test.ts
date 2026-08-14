// ===== tests/games/registry.test.ts =====
// El registro es lo único que hay que tocar para que un juego nuevo aparezca en
// el reproductor y en el Salón de la Fama. Estas pruebas cubren los dos olvidos
// típicos al registrar un motor: usar un id que no existe en el catálogo, y
// dejar el juego sin su entrada de controles (antes eso hacía que el overlay
// anunciara los de ROCAS).

import { describe, expect, it } from "vitest";

import { GAMES } from "@/app/lib/data";
import { GAME_CONTROLS, GAME_ENGINES } from "@/app/lib/games/registry";

const idsDelCatalogo = new Set(GAMES.map((g) => g.id));
const idsConMotor = Object.keys(GAME_ENGINES);

describe("registro de motores", () => {
  it("hay motores registrados", () => {
    expect(idsConMotor.length).toBeGreaterThan(0);
  });

  it.each(idsConMotor)("«%s» es un id que existe en GAMES", (id) => {
    // Un id inventado deja el juego fuera del catálogo y del Salón: `game_id`
    // es texto libre en `game_sessions`, así que nadie más lo detecta.
    expect(idsDelCatalogo).toContain(id);
  });

  it.each(idsConMotor)("«%s» anuncia sus propios controles", (id) => {
    const controles = GAME_CONTROLS[id];
    expect(
      controles,
      `falta la entrada de ${id} en GAME_CONTROLS`,
    ).toBeDefined();
    expect(controles!.length).toBeGreaterThan(0);
    for (const [tecla, accion] of controles!) {
      expect(tecla.trim()).not.toBe("");
      expect(accion.trim()).not.toBe("");
    }
  });

  it.each(idsConMotor)("«%s» expone una factory invocable", (id) => {
    expect(typeof GAME_ENGINES[id]).toBe("function");
    // La factory recibe (canvas, callbacks): dos argumentos, ni uno más.
    expect(GAME_ENGINES[id]!.length).toBe(2);
  });

  it("no anuncia controles de juegos que no tienen motor", () => {
    // Un juego sin motor cae en el reproductor simulado, que no muestra el
    // overlay de teclas: la entrada sobraría y confundiría al siguiente.
    for (const id of Object.keys(GAME_CONTROLS)) {
      expect(idsConMotor, `${id} tiene controles pero no motor`).toContain(id);
    }
  });
});
