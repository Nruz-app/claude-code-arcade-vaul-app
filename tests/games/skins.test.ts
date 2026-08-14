// ===== tests/games/skins.test.ts =====
// El guardián de la cero-regresión y las pruebas del helper de skins.
//
// La tabla de abajo es verbosa a propósito: son los literales que cada motor
// tenía escritos ANTES de que existieran los skins, copiados a mano. Es lo
// único que impide que la promesa "quien no elige nada ve el portal igual que
// siempre" se erosione en un refactor futuro.
//
// Nada de snapshots: un snapshot se regenera solo y una regresión pasaría
// desapercibida, que es justo lo contrario de lo que hace falta aquí.

import { describe, expect, it } from "vitest";

import { SKINS_BLOQUE_BUSTER } from "@/app/lib/games/arkanoid";
import { SKINS_ROCAS } from "@/app/lib/games/asteroids";
import { SKINS_RANARIA } from "@/app/lib/games/frogger";
import { SKINS_SERPENTINA } from "@/app/lib/games/snake";
import { SKINS_CAIDA } from "@/app/lib/games/tetris";
import {
  MINIMOS,
  SKINS,
  conAlfa,
  esSkin,
  paletaDe,
} from "@/app/lib/games/skins";

import { contraste } from "../harness/contraste";

// Los valores de app/lib/games/asteroids.ts anteriores a la SPEC 13.
const ORO_ROCAS: Record<string, string> = {
  fondo: "#000",
  nave: "#00f5ff",
  propulsor: "rgba(245,255,0,0.85)",
  bala: "#e6e9ff",
  roca: "rgba(230,233,255,0.75)",
  // Era la entrada-función COLORS.particle(alpha), que producía
  // `rgba(245,255,0,${alpha.toFixed(2)})`. Aquí queda el color base y el alfa
  // lo pone conAlfa() en el punto de dibujo.
  particula: "#f5ff00",
  mejora: "#ff006e",
};

// Los valores de app/lib/games/arkanoid.ts anteriores a la SPEC 13: las siete
// entradas de BLOCK_COLORS, más BG_COLOR, PADDLE_COLOR, BALL_COLOR, HIGHLIGHT y
// PADDLE_CORE, que estaban sueltos —los dos últimos en la sección de dibujo, a
// cuatrocientas líneas de los demás—.
const ORO_BLOQUE_BUSTER: Record<string, string> = {
  fondo: "#000", // era BG_COLOR
  red: "#ff2d55",
  yellow: "#f5ff00",
  cyan: "#00f5ff",
  magenta: "#ff006e",
  hotpink: "#ff5cae",
  green: "#00ff88",
  gray: "#9aa0b5",
  barra: "#00f5ff", // era PADDLE_COLOR
  filoBarra: "rgba(255,255,255,0.35)", // era PADDLE_CORE
  pelota: "#e6e9ff", // era BALL_COLOR
  // La pelota se dibujaba con `ctx.shadowColor = PADDLE_COLOR`: el halo no
  // tenía nombre propio y heredaba el color de la barra. Ahora es un rol, con
  // el mismo literal, para que un skin pueda separarlos.
  haloPelota: "#00f5ff",
  relieve: "rgba(255,255,255,0.14)", // era HIGHLIGHT
};

// Los valores de app/lib/games/snake.ts anteriores a la SPEC 13: las nueve
// entradas del objeto COLORS, que ya estaba completo y en un solo bloque. Los
// nombres de rol son los suyos, en español, y se conservan tal cual.
const ORO_SERPENTINA: Record<string, string> = {
  fondo: "#000",
  rejilla: "rgba(0,255,136,0.06)",
  cuerpo: "#00ff88",
  cabeza: "#7dffc4",
  ojo: "#001a10",
  brillo: "rgba(0,255,136,0.35)",
  // Eran el fallback del rombo mientras el PNG no cargaba y, ya cargado, el
  // color del resplandor del sprite. Fuera de neón son lo único que hay: la
  // hoja de frutas trae el color horneado y ningún skin puede teñirla.
  frutaComun: "#f5ff00",
  frutaRara: "#ff006e",
  frutaExotica: "#00f5ff",
};

// Los valores de app/lib/games/tetris.ts anteriores a la SPEC 13. Es el motor
// que los tenía más repartidos: las ocho entradas de COLORS y GRID_COLOR arriba,
// y WELL_BG, WELL_BORDER, LABEL_COLOR y VALUE_COLOR trescientas líneas más
// abajo, en la sección de dibujo. El realce de relieve de cada celda no estaba
// ni en un bloque ni en el otro: era un rgba escrito a mano dentro de drawCell,
// el único literal del proyecto suelto en una función de dibujo, y ahora es el
// rol `brillo`.
const ORO_CAIDA: Record<string, string> = {
  pozo: "#0f0f18", // era WELL_BG
  rejilla: "rgba(230,233,255,0.07)", // era GRID_COLOR
  brillo: "rgba(255,255,255,0.12)", // estaba dentro de drawCell
  borde: "rgba(0,245,255,0.18)", // era WELL_BORDER
  etiqueta: "#8a8fb5", // era LABEL_COLOR
  valor: "#e6e9ff", // era VALUE_COLOR
  // COLORS, indexado por tipo de pieza (1..8). Ahora cada índice es un rol y el
  // color se resuelve al dibujar, que es lo que los hace alcanzables.
  piezaI: "#00f5ff",
  piezaO: "#f5ff00",
  piezaT: "#ff006e",
  piezaS: "#00ff88",
  piezaZ: "#ff5c00",
  piezaJ: "#4d7cff",
  piezaL: "#b14dff",
  piezaN: "#9aa0b5",
};

describe("paletas neón congeladas", () => {
  it("ROCAS conserva exactamente los literales que tenía", () => {
    expect(SKINS_ROCAS.paletas.neon).toEqual(ORO_ROCAS);
  });

  it("BLOQUE BUSTER conserva exactamente los literales que tenía", () => {
    expect(SKINS_BLOQUE_BUSTER.paletas.neon).toEqual(ORO_BLOQUE_BUSTER);
  });

  it("SERPENTINA conserva exactamente los literales que tenía", () => {
    expect(SKINS_SERPENTINA.paletas.neon).toEqual(ORO_SERPENTINA);
  });

  it("CAÍDA conserva exactamente los literales que tenía", () => {
    expect(SKINS_CAIDA.paletas.neon).toEqual(ORO_CAIDA);
  });
});

describe("conAlfa()", () => {
  it("reproduce el formato exacto que usaban los motores", () => {
    // Sin espacios y con dos decimales: cualquier otra cosa sería un color
    // distinto para la prueba de secuencia de verificaSkins.
    expect(conAlfa("#f5ff00", 0.85)).toBe("rgba(245,255,0,0.85)");
    expect(conAlfa("#f5ff00", 1)).toBe("rgba(245,255,0,1.00)");
  });

  it("multiplica el alfa que el color ya traía", () => {
    // Atenuar algo que ya era translúcido no puede devolverlo opaco.
    expect(conAlfa("rgba(230,233,255,0.75)", 0.5)).toBe(
      "rgba(230,233,255,0.38)",
    );
  });

  it("acepta hex de tres dígitos", () => {
    expect(conAlfa("#000", 0.5)).toBe("rgba(0,0,0,0.50)");
  });

  it("recorta el alfa al rango válido", () => {
    expect(conAlfa("#ffffff", 2)).toBe("rgba(255,255,255,1.00)");
    expect(conAlfa("#ffffff", -1)).toBe("rgba(255,255,255,0.00)");
  });

  it("deja pasar intacto lo que no sabe leer", () => {
    // Mejor un color sin atenuar que un dibujo roto a media partida.
    expect(conAlfa("papayawhip", 0.5)).toBe("papayawhip");
  });
});

describe("esSkin()", () => {
  it("acepta los tres y rechaza lo demás", () => {
    // Es el saneador de localStorage: sin él, un valor manipulado dejaría al
    // motor indexando la paleta con una clave que no existe.
    for (const [id] of SKINS) expect(esSkin(id)).toBe(true);
    for (const basura of ["NEON", "", null, undefined, 3, {}]) {
      expect(esSkin(basura)).toBe(false);
    }
  });
});

describe("paletaDe()", () => {
  it("cae a neón si le llega un skin imposible", () => {
    const raro = "fosforo" as unknown as Parameters<typeof paletaDe>[1];
    expect(paletaDe(SKINS_ROCAS, raro)).toBe(SKINS_ROCAS.paletas.neon);
  });
});

describe("umbrales de contraste", () => {
  it("el mínimo de lo jugable es el 3:1 de WCAG 1.4.11, no el 4.5:1 de texto", () => {
    // No es laxitud: con 4.5:1 una rampa monocroma de ocho pasos no cabe por
    // debajo del máximo físico de 21:1, y CAÍDA tiene ocho piezas.
    expect(MINIMOS.jugable).toBe(3);
    expect(MINIMOS.texto).toBe(4.5);
    expect(MINIMOS.jugable * Math.pow(1.3, 7)).toBeLessThan(21);
    expect(MINIMOS.texto * Math.pow(1.3, 7)).toBeGreaterThan(21);
  });

  it("el neón que ya existía pasa el umbral con margen", () => {
    // El suelo real de neón es --magenta, a 5.5:1. Que los umbrales estén
    // calibrados por debajo de lo que el portal ya hacía es lo que garantiza
    // que retro y clásico nunca serán menos legibles que hoy.
    const magenta = contraste("#ff006e", "#000");
    expect(magenta).toBeGreaterThan(MINIMOS.jugable);
    expect(magenta).toBeCloseTo(5.48, 1);
  });
});

describe("aritmética de contraste", () => {
  it("compone el alfa antes de medir", () => {
    // Sin componer, un rgba(0,255,136,0.06) mediría como verde brillante
    // (15.7:1) cuando en pantalla es casi negro.
    expect(contraste("rgba(0,255,136,0.06)", "#000")).toBeLessThan(1.2);
    expect(contraste("#00ff88", "#000")).toBeGreaterThan(15);
  });

  it("mide contra la superficie real y no contra el negro", () => {
    // La misma pieza sobre el pozo de CAÍDA contrasta menos que sobre negro.
    const sobreNegro = contraste("#4d7cff", "#000");
    const sobrePozo = contraste("#4d7cff", "#0f0f18");
    expect(sobrePozo).toBeLessThan(sobreNegro);
  });

  it("blanco sobre negro es el máximo físico de 21:1", () => {
    expect(contraste("#ffffff", "#000000")).toBeCloseTo(21, 1);
    expect(contraste("#000000", "#000000")).toBeCloseTo(1, 5);
  });
});
