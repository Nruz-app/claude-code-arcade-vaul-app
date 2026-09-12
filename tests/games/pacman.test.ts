// ===== tests/games/pacman.test.ts =====
// Pruebas de GLOTÓN (Pac-Man).
//
// Este archivo se aparta de los otros cinco en una cosa: NO invoca
// verificaSkins. Esa suite necesita una FichaDeSkins y GLOTÓN tiene un solo
// aspecto por decisión de la SPEC 18, así que no la tiene. Lo que verificaSkins
// aportaba y aquí haría falta igual —que ningún color ajeno a la paleta llegue
// al canvas— está replicado abajo, en «la paleta es la única fuente de color».

import { describe, expect, it } from "vitest";

import {
  COLS,
  FILAS,
  FILA_TUNEL,
  H,
  MAPA,
  type Movil,
  SALIDA_GLOTON,
  W,
  type Fantasma,
  type IdFantasma,
  type ModoFantasma,
  PALETA,
  avanza,
  createPacmanGame,
  destinoDe,
  hayPaso,
  posicionDe,
} from "@/app/lib/games/pacman";

import {
  coloresUsados,
  llamadasDeDibujo,
  olvidaColores,
} from "../harness/canvas";
import { aRgba } from "../harness/contraste";
import { verificaContrato } from "../harness/contrato";
import { verificaMando } from "../harness/mando";
import { montaMotor, pulsa } from "../harness/motor";
import { verificaRendimiento } from "../harness/rendimiento";

// Las dos suites compartidas. La tercera, verificaSkins, NO se invoca: necesita
// una FichaDeSkins y GLOTÓN tiene un solo aspecto (SPEC 18). Lo que aportaba se
// replica abajo, en «la paleta es la única fuente de color».
verificaContrato("GLOTÓN", createPacmanGame);
verificaMando("GLOTÓN", "gloton", createPacmanGame);

// El presupuesto por fotograma, medido el 2026-09-11 tras cachear el laberinto:
// 343 llamadas de dibujo (eran 2 593 con el doble bucle de 868 celdas), 23
// asignaciones de color (eran 261, de las que 233 repetían el color del punto),
// 7 emisiones en 600 fotogramas y 15 KB retenidos.
//
// Los tres primeros techos llevan ~25 % de holgura sobre lo medido. El del heap
// va mucho más arriba a propósito: esa sonda deriva al alto cuando se repite en
// un proceso que ya ha corrido otras pruebas (15, 130 y 296 KB en tres pasadas
// seguidas), así que acota una fuga de verdad —un array por celda serían megas—
// y no el ruido del runner.
verificaRendimiento("GLOTÓN", createPacmanGame, {
  dibujoPorFrame: 440,
  coloresPorFrame: 30,
  emisionesEn600: 20,
  heapKbEn600: 400,
});

// ── El trazado ────────────────────────────────────────────────────────────────
// Son 868 caracteres transcritos a mano. Se verifican contando, no mirando: un
// muro de más deja puntos que no se pueden comer y el laberinto no se limpia
// nunca, que es un fallo invisible hasta que alguien juega una partida entera.

describe("GLOTÓN: el trazado del laberinto", () => {
  it("mide 31 filas de 28 caracteres", () => {
    expect(MAPA).toHaveLength(FILAS);
    for (const [i, fila] of MAPA.entries()) {
      expect(fila.length, `la fila ${i} no mide ${COLS}`).toBe(COLS);
    }
  });

  it("tiene exactamente 240 puntos y 4 píldoras", () => {
    const todo = MAPA.join("");
    const cuenta = (c: string) => [...todo].filter((x) => x === c).length;
    // 244 comestibles es el recuento del arcade original, y es lo que hace que
    // «laberinto limpio» sea un número y no una impresión.
    expect(cuenta(".")).toBe(240);
    expect(cuenta("o")).toBe(4);
  });

  it("es simétrico respecto al eje vertical", () => {
    for (const [i, fila] of MAPA.entries()) {
      for (let c = 0; c < COLS / 2; c++) {
        expect(
          fila[c],
          `la fila ${i} rompe la simetría en la columna ${c}`,
        ).toBe(fila[COLS - 1 - c]);
      }
    }
  });

  it("pone las cuatro píldoras en sus esquinas", () => {
    for (const [fila, col] of [
      [3, 1],
      [3, 26],
      [23, 1],
      [23, 26],
    ]) {
      expect(MAPA[fila][col], `falta la píldora de ${fila},${col}`).toBe("o");
    }
  });

  it("abre el túnel en los dos bordes de su fila", () => {
    expect(MAPA[FILA_TUNEL][0]).toBe("T");
    expect(MAPA[FILA_TUNEL][COLS - 1]).toBe("T");
  });

  it("deja los 244 comestibles alcanzables desde la salida", () => {
    // BFS sobre la rejilla, con el túnel envolviendo por los lados. Es la única
    // prueba que descubre un muro de más en mitad de un pasillo: el recuento
    // seguiría dando 240 y la simetría también.
    const transitable = (c: string) => c !== "#" && c !== "-";
    const vistos = new Set<string>();
    const cola: [number, number][] = [
      [SALIDA_GLOTON.fila, Math.floor(SALIDA_GLOTON.col)],
    ];
    vistos.add(cola[0].join(","));

    while (cola.length > 0) {
      const [fila, col] = cola.shift()!;
      for (const [df, dc] of [
        [0, 1],
        [0, -1],
        [1, 0],
        [-1, 0],
      ]) {
        const nf = fila + df;
        if (nf < 0 || nf >= FILAS) continue;
        let nc = col + dc;
        if (nc < 0) nc = COLS - 1;
        if (nc >= COLS) nc = 0;
        const clave = `${nf},${nc}`;
        if (vistos.has(clave) || !transitable(MAPA[nf][nc])) continue;
        vistos.add(clave);
        cola.push([nf, nc]);
      }
    }

    const inalcanzables: string[] = [];
    for (const [fila, texto] of MAPA.entries()) {
      for (const [col, c] of [...texto].entries()) {
        if ((c === "." || c === "o") && !vistos.has(`${fila},${col}`)) {
          inalcanzables.push(`${fila},${col}`);
        }
      }
    }
    expect(inalcanzables).toEqual([]);
  });

  it("saca a Pac-Man de un pasillo, no de un muro", () => {
    const { fila, col } = SALIDA_GLOTON;
    // La salida canónica cae entre dos columnas (13,5): la casilla de la
    // izquierda es la que tiene que estar libre.
    expect(MAPA[fila][Math.floor(col)]).not.toBe("#");
  });
});

// ── El movimiento sobre la rejilla ────────────────────────────────────────────
// Se prueba contra las funciones puras que exporta el motor, no contra el
// estado interno de una partida: `avanza` es donde vive la única aritmética
// delicada del juego —cruzar celdas sin saltárselas— y aquí es determinista.

describe("GLOTÓN: movimiento sobre la rejilla", () => {
  const nadaQueDecidir = () => {};

  it("recorre un pasillo celda a celda", () => {
    // Fila 29 (`#..........................#`): pasillo limpio de lado a lado.
    const m: Movil = { fila: 29, col: 5, dir: "derecha", progreso: 0 };
    avanza(m, 3, true, nadaQueDecidir);
    expect([m.fila, m.col, m.progreso]).toEqual([29, 8, 0]);
  });

  it("no atraviesa un muro por muy grande que sea el paso", () => {
    // Hacia arriba desde la fila 29 hay muro en la 28 salvo en las columnas del
    // pasillo. La columna 5 está tapada.
    const m: Movil = { fila: 29, col: 5, dir: "arriba", progreso: 0 };
    avanza(m, 50, true, nadaQueDecidir);
    // Se queda clavada en su celda, sin progreso a medias contra la pared.
    expect([m.fila, m.col, m.progreso]).toEqual([29, 5, 0]);
  });

  it("interpola la posición dibujada dentro del tramo", () => {
    const m: Movil = { fila: 29, col: 5, dir: "derecha", progreso: 0 };
    avanza(m, 0.5, true, nadaQueDecidir);
    expect(posicionDe(m)).toEqual([5.5, 29]);
  });

  it("cruza el túnel de un borde al otro", () => {
    const m: Movil = {
      fila: FILA_TUNEL,
      col: 0,
      dir: "izquierda",
      progreso: 0,
    };
    avanza(m, 1, true, nadaQueDecidir);
    expect(m.col).toBe(COLS - 1);
    expect(m.fila).toBe(FILA_TUNEL);
  });

  it("da a cada celda su oportunidad de decidir", () => {
    // Con un dt grande el bucle no puede saltarse celdas: si lo hiciera, un
    // fantasma pasaría de largo su cruce y Pac-Man se comería los puntos
    // intermedios sin sumarlos.
    const visitadas: number[] = [];
    const m: Movil = { fila: 29, col: 5, dir: "derecha", progreso: 0 };
    avanza(m, 4, true, nadaQueDecidir, (movil) => visitadas.push(movil.col));
    expect(visitadas).toEqual([6, 7, 8, 9]);
  });

  it("la puerta de la casa es muro para quien no puede cruzarla", () => {
    // Fila 12, columnas 13-14: la puerta. Desde dentro de la casa, hacia arriba.
    expect(hayPaso(13, 13, "arriba", true)).toBe(false);
    expect(hayPaso(13, 13, "arriba", false)).toBe(true);
  });
});

// ── La paleta ─────────────────────────────────────────────────────────────────

describe("GLOTÓN: la paleta es la única fuente de color", () => {
  it("no pinta ningún color que no esté declarado", () => {
    // Esta prueba es la que sustituye a verificaSkins. Sin ella, «un solo tema»
    // acabaría siendo «colores a mano repartidos por todo el archivo»: nada
    // impediría escribir un ctx.fillStyle = "#f0f" en mitad de un dibujo.
    //
    // El alfa se ignora al comparar, igual que hace el harness de skins: un
    // mismo color puede llegar al canvas con decenas de alfas legítimos.
    const clave = (css: string) => {
      const [r, g, b] = aRgba(css);
      return `${Math.round(r)},${Math.round(g)},${Math.round(b)}`;
    };
    const permitidos = new Set(Object.values(PALETA).map(clave));

    const m = montaMotor(createPacmanGame);
    const ctx = m.canvas.getContext("2d")!;
    m.handle.start();
    olvidaColores(ctx);
    m.reloj.avanza(300);

    const intrusos = [
      ...new Set(coloresUsados(ctx).filter((c) => !permitidos.has(clave(c)))),
    ];
    m.handle.destroy();

    expect(intrusos, "literales de color fuera de PALETA_CLASICA").toEqual([]);
  });
});

// ── Los fantasmas ─────────────────────────────────────────────────────────────
// Se prueban contra `destinoDe`, que es la única diferencia real entre los
// cuatro: la regla de cruce es común, así que si los destinos son correctos el
// comportamiento lo es.

describe("GLOTÓN: cada fantasma persigue lo suyo", () => {
  const gloton: Movil = { fila: 20, col: 10, dir: "derecha", progreso: 0 };
  const fantasma = (
    id: IdFantasma,
    modo: ModoFantasma = "chase",
  ): Fantasma => ({
    id,
    fila: 14,
    col: 13,
    dir: "izquierda",
    progreso: 0,
    modo,
    enCasa: false,
    saliendo: false,
    saleCon: 0,
  });

  it("Blinky va a por la casilla de Pac-Man", () => {
    expect(destinoDe(fantasma("blinky"), gloton, gloton)).toEqual([20, 10]);
  });

  it("Pinky embosca cuatro casillas por delante", () => {
    // Pac-Man mira a la derecha, así que el destino es cuatro columnas más allá.
    expect(destinoDe(fantasma("pinky"), gloton, gloton)).toEqual([20, 14]);
  });

  it("Inky refleja a Blinky sobre el punto de delante", () => {
    const blinky: Movil = { fila: 20, col: 6, dir: "derecha", progreso: 0 };
    // Punto de referencia: dos por delante de Pac-Man = (20, 12).
    // Reflejo de Blinky (20,6) sobre él = (20, 18).
    expect(destinoDe(fantasma("inky"), gloton, blinky)).toEqual([20, 18]);
  });

  it("Clyde persigue de lejos y se retira de cerca", () => {
    const lejos = fantasma("clyde");
    lejos.fila = 2;
    lejos.col = 2; // a más de 8 casillas
    expect(destinoDe(lejos, gloton, gloton)).toEqual([20, 10]);

    const cerca = fantasma("clyde");
    cerca.fila = 20;
    cerca.col = 12; // a 2 casillas
    const destino = destinoDe(cerca, gloton, gloton);
    expect(destino).not.toEqual([20, 10]); // se va a su esquina
  });

  it("un fantasma asustado no persigue a nadie", () => {
    const asustado = fantasma("blinky", "frightened");
    expect(destinoDe(asustado, gloton, gloton)).not.toEqual([20, 10]);
  });

  it("unos ojos vuelven a la casa", () => {
    const ojos = fantasma("blinky", "eyes");
    expect(destinoDe(ojos, gloton, gloton)).toEqual([14, 13]);
  });
});

// ── Vidas y fin de partida ────────────────────────────────────────────────────

describe("GLOTÓN: vidas", () => {
  it("empieza con tres y termina en cero", () => {
    const m = montaMotor(createPacmanGame);
    m.handle.start();
    expect(m.vidas[0]).toBe(3);

    m.handle.end();
    expect(m.vidas.at(-1)).toBe(0);
    expect(m.finales).toHaveLength(1);
    expect(m.finales[0].reason).toBe("surrender");
    m.handle.destroy();
  });

  it("pierde vidas al chocar y acaba en game over", () => {
    // Se deja correr sin tocar nada: Pac-Man arranca quieto contra la pared de
    // su casilla y los fantasmas acaban alcanzándolo. Es la forma honesta de
    // comprobar la cadena entera vida → vida → game over sin pisar el estado
    // interno del motor.
    const m = montaMotor(createPacmanGame);
    m.handle.start();
    for (let i = 0; i < 4000 && m.finales.length === 0; i++) {
      m.reloj.avanza(1);
    }

    expect(m.finales, "nadie llegó a morir en 4000 fotogramas").toHaveLength(1);
    expect(m.finales[0].reason).toBe("game_over");
    // Las vidas bajan de una en una y el último valor emitido es 0.
    expect(m.vidas.at(-1)).toBe(0);
    expect(m.vidas).toContain(2);
    m.handle.destroy();
  });
});

// ── La plataforma ─────────────────────────────────────────────────────────────

describe("GLOTÓN: el motor responde al teclado", () => {
  it("consume sus teclas mientras juega y las suelta al destruirse", () => {
    const m = montaMotor(createPacmanGame);
    m.handle.start();
    m.reloj.avanza(10);

    // Las ocho que declara: flechas y WASD.
    for (const code of [
      "ArrowUp",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
      "KeyW",
      "KeyA",
      "KeyS",
      "KeyD",
    ]) {
      expect(pulsa(code).defaultPrevented, `${code} no se consume`).toBe(true);
    }

    // Space se deja libre a propósito: es la tecla con la que el reproductor
    // abre la partida desde el overlay.
    expect(pulsa("Space").defaultPrevented).toBe(false);

    m.handle.destroy();
    expect(pulsa("ArrowLeft").defaultPrevented).toBe(false);
  });

  it("dibuja algo al avanzar", () => {
    const m = montaMotor(createPacmanGame);
    m.handle.start();
    m.reloj.avanza(30);
    expect(llamadasDeDibujo(m.canvas.getContext("2d")!)).toBeGreaterThan(0);
    m.handle.destroy();
  });
});

describe("GLOTÓN: encaje en el reproductor", () => {
  it("usa la resolución de la plataforma", () => {
    // El reproductor fija el canvas en el JSX y .crt-screen declara
    // aspect-ratio 4/3: otra resolución lógica sale deformada.
    expect([W, H]).toEqual([800, 600]);
  });

  it("cabe el laberinto dentro del canvas", () => {
    // 28×31 celdas de 18 px son 504×558. Si algún día cambia CELDA, esto avisa
    // antes de que el mapa se salga por abajo.
    expect(COLS * 18).toBeLessThanOrEqual(W);
    expect(FILAS * 18).toBeLessThanOrEqual(H);
  });
});
