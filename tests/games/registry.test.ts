// ===== tests/games/registry.test.ts =====
// El registro es lo único que hay que tocar para que un juego nuevo aparezca en
// el reproductor y en el Salón de la Fama. Estas pruebas cubren los dos olvidos
// típicos al registrar un motor: usar un id que no existe en el catálogo, y
// dejar el juego sin su entrada de controles (antes eso hacía que el overlay
// anunciara los de ROCAS).

import { describe, expect, it } from "vitest";

import { GAMES } from "@/app/lib/data";
import {
  GAME_CONTROLS,
  GAME_ENGINES,
  GAME_PALETAS,
  GAME_TOUCH,
  type BotonTactil,
  type MandoDeJuego,
} from "@/app/lib/games/registry";

import { creaCanvas } from "../harness/canvas";
import { creaEspias } from "../harness/motor";

const idsDelCatalogo = new Set(GAMES.map((g) => g.id));
const idsConMotor = Object.keys(GAME_ENGINES);

// Todos los botones de un mando en una lista: la cruceta y las acciones juntas.
// Casi todas las comprobaciones de abajo son sobre el mando entero, no sobre
// una mitad.
function botonesDe(mando: MandoDeJuego): BotonTactil[] {
  return [...Object.values(mando.cruceta), ...mando.acciones];
}

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
    // La factory tiene exactamente dos parámetros OBLIGATORIOS: canvas y
    // callbacks. El skin es el tercero, y Function.length no lo cuenta porque
    // cada motor lo declara con valor por defecto (`skin = "neon"`). Eso es
    // justo lo que esta prueba guarda: escrito como `skin?` la aridad subiría a
    // 3 y montar sin skin dejaría al motor sin paleta.
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

describe("registro de paletas", () => {
  // Todavía no están los cinco: la infraestructura de skins se estrenó con
  // ROCAS y el resto los va cerrando el subagente skin-designer, uno por uno.
  // Cuando GAME_PALETAS cubra los cinco ids, este bloque pasa a it.each sobre
  // idsConMotor y la lista deja de poder quedarse corta en silencio.
  const idsConPaleta = Object.keys(GAME_PALETAS);

  it("hay paletas registradas", () => {
    expect(idsConPaleta.length).toBeGreaterThan(0);
  });

  it("no registra paletas de juegos que no tienen motor", () => {
    for (const id of idsConPaleta) {
      expect(idsConMotor, `${id} tiene paleta pero no motor`).toContain(id);
    }
  });

  it.each(idsConPaleta)("«%s» declara las tres skins", (id) => {
    const ficha = GAME_PALETAS[id]!;
    expect(Object.keys(ficha.paletas).sort()).toEqual([
      "clasico",
      "neon",
      "retro",
    ]);
  });

  it.each(idsConPaleta)("«%s» declara al menos un grupo y sus roles", (id) => {
    const ficha = GAME_PALETAS[id]!;
    const roles = new Set(Object.keys(ficha.roles));
    expect(roles.size).toBeGreaterThan(0);
    expect(ficha.grupos.length).toBeGreaterThan(0);
    // Un grupo que nombra un rol inexistente compararía `undefined` contra
    // `undefined` y pasaría el contraste sin medir nada.
    for (const grupo of ficha.grupos) {
      for (const rol of grupo) {
        expect(
          roles,
          `el grupo de ${id} nombra un rol que no existe`,
        ).toContain(rol);
      }
    }
  });

  it.each(idsConPaleta)("«%s» acepta un skin por el tercer argumento", (id) => {
    const canvas = creaCanvas();
    const espias = creaEspias();
    expect(() =>
      GAME_ENGINES[id]!(canvas, espias.callbacks, "retro").destroy(),
    ).not.toThrow();
  });
});

describe("registro de mandos táctiles", () => {
  // Los cinco motores tienen que tener mando: sin él, el juego se monta en un
  // teléfono y no responde a nada, que es exactamente el estado que la SPEC 14
  // vino a arreglar. Este it.each va sobre idsConMotor y no sobre las claves de
  // GAME_TOUCH a propósito: así la lista no puede quedarse corta en silencio.
  it.each(idsConMotor)("«%s» declara su mando", (id) => {
    const mando = GAME_TOUCH[id];
    expect(mando, `falta la entrada de ${id} en GAME_TOUCH`).toBeDefined();
  });

  it("no declara mandos de juegos que no tienen motor", () => {
    for (const id of Object.keys(GAME_TOUCH)) {
      expect(idsConMotor, `${id} tiene mando pero no motor`).toContain(id);
    }
  });

  it.each(idsConMotor)("«%s» se puede jugar con el dedo", (id) => {
    const mando = GAME_TOUCH[id]!;
    const botones = botonesDe(mando);
    // Un mando sin botones y sin arrastre es un mando que no hace nada. Pasa si
    // alguien registra la entrada para callar a la prueba de arriba y se olvida
    // de rellenarla.
    expect(
      botones.length > 0 || mando.arrastre === true,
      `el mando de ${id} no tiene ni botones ni arrastre`,
    ).toBe(true);
  });

  it.each(idsConMotor)("«%s» no repite una tecla en dos botones", (id) => {
    const codes = botonesDe(GAME_TOUCH[id]!).map((b) => b.code);
    // Dos botones con el mismo code son dos formas de hacer lo mismo ocupando
    // el sitio de un control que falta.
    expect(new Set(codes).size, `${id} repite un code en su mando`).toBe(
      codes.length,
    );
  });

  it.each(idsConMotor)("«%s» describe cada botón para el lector", (id) => {
    for (const boton of botonesDe(GAME_TOUCH[id]!)) {
      // `accion` acaba en el aria-label: sin él, el mando es un montón de
      // botones sin nombre para quien no ve la flecha.
      expect(boton.accion.trim(), `un botón de ${id} no tiene acción`).not.toBe(
        "",
      );
      expect(boton.code.trim(), `un botón de ${id} no tiene code`).not.toBe("");
    }
  });

  it.each(idsConMotor)("«%s» etiqueta sus botones de acción", (id) => {
    for (const boton of GAME_TOUCH[id]!.acciones) {
      // La cruceta saca su flecha de la dirección; los redondos se dibujan con
      // una letra, así que sin etiqueta salen vacíos.
      expect(boton.etiqueta.trim()).not.toBe("");
      expect(["cyan", "magenta"]).toContain(boton.tono);
    }
  });

  it("solo BLOQUE BUSTER se juega arrastrando", () => {
    // El arrastre depende de que el motor escuche el puntero, y solo el de
    // BLOQUE BUSTER lo hace. Declararlo en otro juego dibujaría una promesa que
    // el motor no cumple.
    const conArrastre = idsConMotor.filter((id) => GAME_TOUCH[id]?.arrastre);
    expect(conArrastre).toEqual(["bloque-buster"]);
  });
});
