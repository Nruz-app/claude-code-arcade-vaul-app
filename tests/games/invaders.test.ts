// ===== tests/games/invaders.test.ts =====
// Pruebas de INVASORES (Space Invaders), SPEC 21.
//
// Hereda las tres suites compartidas y añade lo propio del juego: las siluetas
// transcritas, el reloj de la formación, el carril del cañón, quién dispara de
// entre los invasores, los escudos destructibles y los dos finales posibles.

import { describe, expect, it } from "vitest";

import {
  COLUMNAS,
  FILAS,
  SILUETAS,
  SILUETA_CANON,
  SKINS_INVASORES,
  ESCALA,
  H,
  W,
  type Bitmap,
  type TipoInvasor,
  ESCUDO_COLS,
  ESCUDO_FILAS,
  NUM_ESCUDOS,
  Y_LIMITE,
  acotaCanon,
  alcanzaronElLimite,
  alturaDeSalida,
  arrasaEscudo,
  avanzaFormacion,
  celdasIntactas,
  creaEscudos,
  eligePuntosNodriza,
  eligeTirador,
  erosiona,
  impactaEscudo,
  reponEscudo,
  createInvadersGame,
  intervaloPara,
} from "@/app/lib/games/invaders";

import {
  montaMotor,
  pulsa,
  suelta,
  tieneRepetidosSeguidos,
} from "../harness/motor";
import { verificaContrato } from "../harness/contrato";
import { verificaMando } from "../harness/mando";
import { verificaSkins } from "../harness/skins";

// Las tres suites compartidas: 35 comprobaciones heredadas con tres líneas.
// Las invariantes del contrato de motores (.claude/skills/nuevo-juego/
// contrato.md), el contraste y la disciplina de paleta, y que cada `code` que
// GAME_TOUCH declara lo escuche el motor de verdad.
verificaContrato("INVASORES", createInvadersGame);
verificaSkins("INVASORES", createInvadersGame, SKINS_INVASORES);
verificaMando("INVASORES", "invasores", createInvadersGame);

const TIPOS: readonly TipoInvasor[] = ["alto", "medio", "bajo"];

// Math.random reemplazado por un LCG de semilla fija, y su restauración. Es el
// mismo recurso que usa tests/harness/skins.ts para comparar dos corridas: sin
// él, cualquier prueba que dependa de las apariciones enemigas vale una vez y
// falla la siguiente.
// Math.random clavado en un valor. Más brusco que el LCG y para otra cosa: con
// 0, `eligeTirador` toma siempre la primera columna ocupada, así que se sabe
// exactamente de dónde sale cada bala enemiga y se puede poner al cañón fuera
// de su alcance. Es lo que permite probar un final por descenso sin que las
// tres vidas se gasten antes por el camino.
function conAzarConstante(valor: number): () => void {
  const original = Math.random;
  Math.random = () => valor;
  return () => {
    Math.random = original;
  };
}

function conAzarFijo(semilla = 0x5eed): () => void {
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

describe("la resolución", () => {
  it("usa el canvas de 800×600 que fija el reproductor", () => {
    // Es la única invariante del contrato que las suites compartidas no pueden
    // comprobar: son constantes por módulo. El reproductor lo escribe fijo en
    // el JSX y .crt-screen declara aspect-ratio 4/3, así que otra resolución
    // sale deformada.
    expect([W, H]).toEqual([800, 600]);
  });
});

describe("las siluetas de INVASORES", () => {
  // Un bitmap transcrito a mano solo puede fallar de tres maneras: una fila de
  // más, una fila corta o un fotograma que se quedó en blanco. Ninguna de las
  // tres la detecta el compilador —son cadenas— ni nadie mirando la pantalla,
  // porque una fila corta simplemente dibuja un invasor un poco más estrecho.
  const mide = (bitmap: Bitmap, ancho: number) => {
    expect(bitmap).toHaveLength(8);
    for (const fila of bitmap) expect(fila).toHaveLength(ancho);
  };

  const encendidos = (bitmap: Bitmap) =>
    bitmap.reduce(
      (total, fila) => total + [...fila].filter((c) => c === "#").length,
      0,
    );

  it.each(TIPOS)("«%s» tiene dos fotogramas de 11×8", (tipo) => {
    const [a, b] = SILUETAS[tipo];
    expect(SILUETAS[tipo]).toHaveLength(2);
    mide(a, 11);
    mide(b, 11);
  });

  it.each(TIPOS)(
    "los dos fotogramas de «%s» pintan algo y no son iguales",
    (tipo) => {
      const [a, b] = SILUETAS[tipo];
      expect(encendidos(a)).toBeGreaterThan(0);
      expect(encendidos(b)).toBeGreaterThan(0);
      // Dos fotogramas idénticos serían una animación que no anima, y el bucle no
      // tiene forma de quejarse.
      expect(a.join("\n")).not.toBe(b.join("\n"));
    },
  );

  it("el cañón mide 13×8 y es más ancho que un invasor", () => {
    mide(SILUETA_CANON, 13);
    expect(encendidos(SILUETA_CANON)).toBeGreaterThan(0);
  });
});

describe("el reloj de la formación", () => {
  const TOTAL = FILAS * COLUMNAS;

  it("acelera al morir invasores", () => {
    // La curva de tensión del original: el último invasor va disparado. Es lo
    // que hace que limpiar una oleada sea más difícil al final que al principio
    // aunque queden menos enemigos.
    const lleno = intervaloPara(TOTAL, 1);
    const ultimo = intervaloPara(1, 1);
    expect(ultimo).toBeLessThan(lleno);
    expect(lleno / ultimo).toBeGreaterThan(10);

    // Y lo hace de forma monótona, no a saltos: cada baja acorta el intervalo.
    for (let vivos = TOTAL; vivos > 1; vivos--) {
      expect(intervaloPara(vivos - 1, 1)).toBeLessThan(intervaloPara(vivos, 1));
    }
  });

  it("acelera con el nivel, pero con suelo", () => {
    expect(intervaloPara(TOTAL, 2)).toBeLessThan(intervaloPara(TOTAL, 1));
    // A partir de la oleada 7 el factor toca su mínimo y deja de bajar: sin el
    // tope, la 13 llegaría a intervalo cero o negativo.
    expect(intervaloPara(TOTAL, 20)).toBeCloseTo(intervaloPara(TOTAL, 1) * 0.5);
    expect(intervaloPara(1, 20)).toBeGreaterThan(0);
  });

  it("ignora un número de vivos imposible", () => {
    // El intervalo se calcula con el recuento del momento; que nunca salga de
    // rango es responsabilidad del motor, pero un 0 dividiendo sería un juego
    // congelado y no un error visible.
    expect(intervaloPara(0, 1)).toBe(intervaloPara(1, 1));
    expect(intervaloPara(999, 1)).toBe(intervaloPara(TOTAL, 1));
  });
});

describe("el paso de la formación", () => {
  // Las columnas ocupadas de una formación intacta.
  const LLENA = [0, COLUMNAS - 1] as const;

  it("avanza en horizontal mientras quepa", () => {
    const antes = { formX: 136, formY: 96 };
    const despues = avanzaFormacion(antes.formX, antes.formY, 1, ...LLENA);
    expect(despues.formX).toBeGreaterThan(antes.formX);
    expect(despues.formY).toBe(antes.formY);
    expect(despues.dir).toBe(1);
  });

  it("al llegar al borde baja e invierte, y no hace las dos cosas", () => {
    // Pegada al borde derecho: el siguiente avance se saldría.
    const pegada = avanzaFormacion(400, 96, 1, ...LLENA);
    expect(pegada.dir).toBe(-1);
    expect(pegada.formY).toBeGreaterThan(96);
    // Lo que NO puede pasar: bajar y avanzar a la vez deja la formación
    // pegada al borde descendiendo en vertical.
    expect(pegada.formX).toBe(400);
  });

  it("rebota igual contra el borde izquierdo", () => {
    const pegada = avanzaFormacion(-100, 96, -1, ...LLENA);
    expect(pegada.dir).toBe(1);
    expect(pegada.formY).toBeGreaterThan(96);
    expect(pegada.formX).toBe(-100);
  });

  it("gana margen cuando muere la columna del extremo", () => {
    // Misma posición y mismo sentido, pero sin la última columna: donde la
    // formación intacta rebota, la mermada todavía avanza.
    const x = 280;
    expect(avanzaFormacion(x, 96, 1, ...LLENA).dir).toBe(-1);
    expect(avanzaFormacion(x, 96, 1, 0, COLUMNAS - 2).dir).toBe(1);
  });

  it("nunca saca un invasor vivo de la pantalla", () => {
    // Mil pasos seguidos desde el centro: la formación rebota sola y ningún
    // extremo se sale. Es la prueba de que el rebote no depende de acertar con
    // el intervalo.
    let estado = { formX: 136, formY: 0, dir: 1 as 1 | -1 };
    for (let i = 0; i < 1000; i++) {
      estado = avanzaFormacion(
        estado.formX,
        estado.formY,
        estado.dir,
        ...LLENA,
      );
      expect(estado.formX).toBeGreaterThanOrEqual(0);
      expect(estado.formX + COLUMNAS * 48).toBeLessThanOrEqual(W);
    }
  });
});

describe("el cañón y su bala", () => {
  // Una partida recién arrancada, con un fotograma corrido para que el motor
  // tenga un `lastTime` y el siguiente dt no sea cero.
  //
  // `scores` arranca SIEMPRE en [0]: initGame emite los tres callbacks a pelo
  // para que el HUD no arrastre la partida anterior. Por eso las aserciones de
  // aquí abajo cuentan desde el segundo valor.
  const arranca = () => {
    const motor = montaMotor(createInvadersGame);
    motor.handle.start();
    motor.reloj.avanza(1);
    return motor;
  };

  // 45 fotogramas de 16 ms son 720 ms: de sobra para que la bala recorra a
  // 520 px/s los ~380 px que separan al cañón de la fila de abajo.
  const VUELO = 45;

  it("ESPACIO y flecha arriba disparan las dos", () => {
    for (const code of ["Space", "ArrowUp"]) {
      const motor = arranca();
      pulsa(code);
      suelta(code);
      motor.reloj.avanza(VUELO);
      expect(motor.scores, `${code} no derribó nada`).toEqual([0, 10]);
      motor.handle.destroy();
    }
  });

  it("con una bala en vuelo, pulsar de nuevo no crea una segunda", () => {
    const motor = arranca();

    // Dos pulsaciones seguidas, con su suelta en medio para que la segunda sea
    // una transición de verdad y no la misma tecla mantenida.
    pulsa("Space");
    suelta("Space");
    motor.reloj.avanza(2);
    pulsa("Space");
    suelta("Space");
    motor.reloj.avanza(VUELO);

    // Si la segunda pulsación hubiera creado otra bala, caerían dos invasores.
    expect(motor.scores).toEqual([0, 10]);
    motor.handle.destroy();
  });

  it("mantener la tecla no dispara en cada fotograma", () => {
    const motor = arranca();
    pulsa("Space"); // y NO se suelta
    motor.reloj.avanza(120);

    // Con el auto-repeat mal resuelto esto sería una ametralladora: una bala
    // nueva en cuanto la anterior impacta o sale de pantalla.
    expect(motor.scores).toEqual([0, 10]);
    motor.handle.destroy();
    suelta("Space");
  });

  it("derribar un invasor de la fila de abajo suma 10", () => {
    const motor = arranca();
    pulsa("Space");
    suelta("Space");
    motor.reloj.avanza(VUELO);

    // El cañón arranca centrado y la columna del medio está ocupada, así que
    // la bala toca al pulpo de la fila 4, que es el que vale 10.
    expect(motor.scores.at(-1)).toBe(10);
    motor.handle.destroy();
  });

  it("onScore se emite solo al cambiar", () => {
    const motor = arranca();
    for (let i = 0; i < 4; i++) {
      pulsa("Space");
      suelta("Space");
      motor.reloj.avanza(VUELO + 10);
    }
    expect(motor.scores.length).toBeGreaterThan(2);
    expect(tieneRepetidosSeguidos(motor.scores)).toBe(false);
    motor.handle.destroy();
  });

  it("mover a tope hacia un lado deja el cañón dentro de la pantalla", () => {
    const motor = arranca();
    // Cuatro segundos hacia la izquierda a 320 px/s son 1280 px: más que la
    // pantalla entera. Lo que se comprueba aquí es que el motor sobrevive a
    // ello; dónde queda exactamente lo fija acotaCanon, que se prueba aparte.
    pulsa("ArrowLeft");
    motor.reloj.avanza(250);
    suelta("ArrowLeft");
    pulsa("ArrowRight");
    motor.reloj.avanza(250);
    suelta("ArrowRight");
    expect(motor.finales).toHaveLength(0);
    motor.handle.destroy();
  });

  it("destroy() suelta las teclas del juego", () => {
    const motor = arranca();
    motor.handle.destroy();
    // Mientras el listener está puesto, el motor corta el comportamiento por
    // defecto de sus teclas; tras destroy() la página vuelve a ser del usuario.
    expect(pulsa("Space").defaultPrevented).toBe(false);
    expect(pulsa("ArrowLeft").defaultPrevented).toBe(false);
  });
});

describe("el carril del cañón", () => {
  it("no deja salir el cañón por ninguno de los dos lados", () => {
    expect(acotaCanon(-500)).toBe(0);
    expect(acotaCanon(9999)).toBe(W - 13 * ESCALA);
  });

  it("no toca una posición que ya está dentro", () => {
    expect(acotaCanon(380)).toBe(380);
  });

  it("deja el cañón entero visible en los dos extremos", () => {
    // Acotar por el borde IZQUIERDO de la silueta es el error fácil: el cañón
    // llega al borde derecho y se sale por la mitad.
    expect(acotaCanon(9999) + 13 * ESCALA).toBeLessThanOrEqual(W);
    expect(acotaCanon(-500)).toBeGreaterThanOrEqual(0);
  });
});

describe("quién dispara de la formación", () => {
  const formacion = (vivas: readonly (readonly [number, number])[]) =>
    vivas.map(([col, fila]) => ({
      col,
      fila,
      tipo: "bajo" as const,
      vivo: true,
    }));

  it("elige siempre el más bajo de su columna", () => {
    // Tres en la misma columna: la bala tiene que salir de la fila 4, o
    // atravesaría a los dos de delante.
    const invasores = formacion([
      [3, 0],
      [3, 2],
      [3, 4],
    ]);
    expect(eligeTirador(invasores, 0)?.fila).toBe(4);
    expect(eligeTirador(invasores, 0.99)?.fila).toBe(4);
  });

  it("solo elige entre las columnas que quedan ocupadas", () => {
    // Con una sola columna viva, el azar da igual: el fuego no se apaga porque
    // se hayan limpiado las otras diez.
    const invasores = formacion([[7, 1]]);
    for (const azar of [0, 0.25, 0.5, 0.75, 0.999]) {
      expect(eligeTirador(invasores, azar)?.col).toBe(7);
    }
  });

  it("reparte entre las columnas ocupadas", () => {
    const invasores = formacion([
      [1, 4],
      [9, 4],
    ]);
    expect(eligeTirador(invasores, 0)?.col).toBe(1);
    expect(eligeTirador(invasores, 0.9)?.col).toBe(9);
  });

  it("ignora a los muertos y aguanta un azar de 1", () => {
    const invasores = [
      { col: 2, fila: 4, tipo: "bajo" as const, vivo: false },
      { col: 2, fila: 1, tipo: "medio" as const, vivo: true },
    ];
    expect(eligeTirador(invasores, 1)?.fila).toBe(1);
  });

  it("devuelve null cuando no queda nadie", () => {
    expect(eligeTirador([], 0.5)).toBeNull();
    expect(
      eligeTirador([{ col: 0, fila: 0, tipo: "alto", vivo: false }], 0.5),
    ).toBeNull();
  });
});

describe("las vidas", () => {
  // Una partida abandonada a su suerte: el cañón no se mueve ni dispara, así
  // que las balas enemigas acaban dándole. Hacen falta bastantes fotogramas
  // porque el tirador es una columna al azar y tiene que tocarle la del cañón:
  // con una cadencia de 0,8–1,6 s y once columnas, cada muerte cuesta ~13 s.
  //
  // El azar se fija con un LCG, como hace tests/harness/skins.ts. Sin eso la
  // prueba depende de la secuencia de Math.random que le toque —cuántas balas
  // salen y de qué columna—, y "en 4 000 fotogramas caen las tres vidas" pasa
  // sola unas veces y otras no. Con semilla fija, si pasa una vez pasa siempre.
  const dejaQueLoMaten = (frames = 4000) => {
    const restaura = conAzarFijo();
    try {
      const motor = montaMotor(createInvadersGame);
      motor.handle.start();
      motor.reloj.avanza(frames);
      return motor;
    } finally {
      restaura();
    }
  };

  it("empieza en 3 y va bajando de una en una", () => {
    const motor = dejaQueLoMaten();
    expect(motor.vidas[0]).toBe(3);
    // Sin repetidos y estrictamente decreciente: cada emisión es una muerte.
    expect(tieneRepetidosSeguidos(motor.vidas)).toBe(false);
    for (let i = 1; i < motor.vidas.length; i++) {
      expect(motor.vidas[i]).toBe(motor.vidas[i - 1] - 1);
    }
    motor.handle.destroy();
  });

  it("perder la última emite onLives(0) y luego el fin", () => {
    const motor = dejaQueLoMaten();
    expect(motor.vidas.at(-1)).toBe(0);
    expect(motor.finales).toHaveLength(1);
    expect(motor.finales[0].reason).toBe("game_over");
    motor.handle.destroy();
  });

  it("la explosión para el mundo mientras dura", () => {
    const motor = dejaQueLoMaten();
    expect(motor.finales).toHaveLength(1);

    // El suelo que impone la pausa: cada muerte cuesta DURACION_EXPLOSION de
    // mundo parado, así que tres vidas no caben en menos de tres explosiones.
    // Sin la pausa —y sin vaciar las balas al morir— la misma andanada se
    // llevaría las tres seguidas y la partida duraría un suspiro.
    expect(motor.finales[0].durationMs).toBeGreaterThan(3 * 900);
    motor.handle.destroy();
  });

  it("no registra la partida dos veces", () => {
    const motor = dejaQueLoMaten();
    motor.handle.end();
    motor.handle.end();
    expect(motor.finales).toHaveLength(1);
    motor.handle.destroy();
  });
});

describe("los escudos", () => {
  it("son cuatro, repartidos a lo ancho y por encima del cañón", () => {
    const escudos = creaEscudos();
    expect(escudos).toHaveLength(NUM_ESCUDOS);

    const xs = escudos.map((e) => e.x);
    expect([...xs].sort((a, b) => a - b)).toEqual(xs); // en orden, sin solaparse
    for (const e of escudos) {
      expect(e.x).toBeGreaterThanOrEqual(0);
      expect(e.x + ESCUDO_COLS * ESCALA).toBeLessThanOrEqual(W);
      // Por encima del cañón, o el jugador no cabría debajo de su propio búnker.
      expect(e.y + ESCUDO_FILAS * ESCALA).toBeLessThan(540);
    }

    // Y separados por igual: los huecos entre búnkeres son todos el mismo.
    const huecos = xs.slice(1).map((x, i) => x - xs[i]);
    for (const hueco of huecos) expect(hueco).toBe(huecos[0]);
  });

  it("nacen intactos y con el arco recortado por abajo", () => {
    const [escudo] = creaEscudos();
    const total = ESCUDO_COLS * ESCUDO_FILAS;
    const intactas = celdasIntactas(escudo.celdas);
    expect(intactas).toBeGreaterThan(0);
    // Ni macizo ni vacío: el arco de abajo y los hombros redondeados existen.
    expect(intactas).toBeLessThan(total);
    // La fila de abajo tiene hueco en el centro (el arco) y celdas en los lados.
    const ultima = (ESCUDO_FILAS - 1) * ESCUDO_COLS;
    expect(escudo.celdas[ultima]).toBe(1);
    expect(escudo.celdas[ultima + Math.floor(ESCUDO_COLS / 2)]).toBe(0);
  });

  it("un impacto abre un boquete, no borra una celda", () => {
    const [escudo] = creaEscudos();
    const antes = celdasIntactas(escudo.celdas);
    erosiona(escudo.celdas, 11, 5);
    const quitadas = antes - celdasIntactas(escudo.celdas);
    expect(quitadas).toBeGreaterThan(1);
    // Circular, no cuadrado: un radio de 3 quita menos que el cuadrado de 7×7.
    expect(quitadas).toBeLessThan(49);
  });

  it("erosionar dos veces el mismo sitio no quita más", () => {
    const [escudo] = creaEscudos();
    erosiona(escudo.celdas, 11, 5);
    const tras1 = celdasIntactas(escudo.celdas);
    erosiona(escudo.celdas, 11, 5);
    expect(celdasIntactas(escudo.celdas)).toBe(tras1);
  });

  it("erosionar en el borde no se sale del búnker", () => {
    const [escudo] = creaEscudos();
    // Sin el recorte de índices, esto escribiría en la fila de al lado —el
    // array es plano— y abriría un boquete en el otro extremo del búnker.
    expect(() => erosiona(escudo.celdas, 0, 0)).not.toThrow();
    expect(() => erosiona(escudo.celdas, ESCUDO_COLS - 1, ESCUDO_FILAS - 1)).not.toThrow();
    expect(escudo.celdas.length).toBe(ESCUDO_COLS * ESCUDO_FILAS);
  });

  it("una bala que sube revienta la celda más baja que toca", () => {
    const [escudo] = creaEscudos();
    const x = escudo.x + 3 * ESCALA; // una columna maciza, fuera del arco
    // Una bala larga metida dentro del búnker: toca varias filas a la vez.
    const alto = 6 * ESCALA;
    const y = escudo.y + 6 * ESCALA;
    expect(impactaEscudo(escudo, x, y, ESCALA, alto, false)).toBe(true);

    // Con el criterio equivocado el boquete saldría arriba del todo del rango
    // tocado; subiendo, tiene que salir abajo.
    const filaMasBaja = Math.floor((y + alto - 1 - escudo.y) / ESCALA);
    const col = Math.floor((x - escudo.x) / ESCALA);
    expect(escudo.celdas[filaMasBaja * ESCUDO_COLS + col]).toBe(0);
  });

  it("una bala que baja revienta la celda más alta que toca", () => {
    const [escudo] = creaEscudos();
    const x = escudo.x + 3 * ESCALA;
    const alto = 6 * ESCALA;
    const y = escudo.y + 6 * ESCALA;
    expect(impactaEscudo(escudo, x, y, ESCALA, alto, true)).toBe(true);

    const filaMasAlta = Math.floor((y - escudo.y) / ESCALA);
    const col = Math.floor((x - escudo.x) / ESCALA);
    expect(escudo.celdas[filaMasAlta * ESCUDO_COLS + col]).toBe(0);
  });

  it("una bala que pasa por el hueco abierto no impacta", () => {
    const [escudo] = creaEscudos();
    const col = 11;
    const x = escudo.x + col * ESCALA;
    // Se abre un túnel vertical entero en esa columna.
    for (let f = 0; f < ESCUDO_FILAS; f++) erosiona(escudo.celdas, col, f);
    expect(
      impactaEscudo(escudo, x, escudo.y, ESCALA, ESCUDO_FILAS * ESCALA, true),
    ).toBe(false);
  });

  it("una bala que ni roza el búnker no lo toca", () => {
    const [escudo] = creaEscudos();
    const antes = celdasIntactas(escudo.celdas);
    expect(impactaEscudo(escudo, escudo.x - 100, escudo.y, ESCALA, ESCALA, true)).toBe(false);
    expect(celdasIntactas(escudo.celdas)).toBe(antes);
  });

  it("un invasor que pasa por encima arrasa lo que solapa", () => {
    const [escudo] = creaEscudos();
    const antes = celdasIntactas(escudo.celdas);
    // Un invasor justo encima del búnker: 33×24 px sobre su esquina.
    arrasaEscudo(escudo, escudo.x, escudo.y, 11 * ESCALA, 8 * ESCALA);
    const despues = celdasIntactas(escudo.celdas);
    expect(despues).toBeLessThan(antes);
    // Y arrasa un rectángulo, no un círculo: la esquina superior izquierda
    // queda limpia entera.
    expect(escudo.celdas[0]).toBe(0);
  });

  it("reponer devuelve el búnker a su estado de fábrica, en el mismo array", () => {
    const [escudo] = creaEscudos();
    const original = celdasIntactas(escudo.celdas);
    const array = escudo.celdas;

    for (let f = 0; f < ESCUDO_FILAS; f++) erosiona(escudo.celdas, 11, f);
    expect(celdasIntactas(escudo.celdas)).toBeLessThan(original);

    reponEscudo(escudo.celdas);
    expect(celdasIntactas(escudo.celdas)).toBe(original);
    // El mismo Uint8Array: reponer no crea otro. Es la razón de que sea un
    // Uint8Array y no un boolean[] nuevo por oleada.
    expect(escudo.celdas).toBe(array);
  });

  it("en partida, el búnker se come la bala del jugador", () => {
    const restaura = conAzarFijo();
    try {
      const motor = montaMotor(createInvadersGame);
      motor.handle.start();
      motor.reloj.avanza(1);

      // El cañón arranca en el hueco entre el segundo y el tercer búnker, así
      // que hay que moverlo: 20 fotogramas a la izquierda a 320 px/s son ~102
      // px, que lo dejan justo debajo del segundo.
      pulsa("ArrowLeft");
      motor.reloj.avanza(20);
      suelta("ArrowLeft");

      pulsa("Space");
      suelta("Space");
      motor.reloj.avanza(40);

      // La bala entra por el arco, revienta contra el techo del búnker y no
      // llega a la formación: nadie muere y la puntuación sigue en su 0 inicial.
      expect(motor.scores).toEqual([0]);
      motor.handle.destroy();
    } finally {
      restaura();
    }
  });

  it("desde el hueco entre búnkeres la bala sí llega a la formación", () => {
    const restaura = conAzarFijo();
    try {
      const motor = montaMotor(createInvadersGame);
      motor.handle.start();
      motor.reloj.avanza(1);

      // La gemela del test de arriba, y la que le da sentido: sin moverse, el
      // cañón está en el hueco y el disparo sí derriba. Sin este par, "no
      // derribó nada" también sería lo que pasa si el disparo no funciona.
      pulsa("Space");
      suelta("Space");
      motor.reloj.avanza(40);

      expect(motor.scores).toEqual([0, 10]);
      motor.handle.destroy();
    } finally {
      restaura();
    }
  });
});

describe("la nodriza", () => {
  it("puntúa uno de los cuatro valores clásicos", () => {
    const vistos = new Set<number>();
    for (let i = 0; i < 100; i++) vistos.add(eligePuntosNodriza(i / 100));
    expect([...vistos].sort((a, b) => a - b)).toEqual([50, 100, 150, 300]);
  });

  it("aguanta un azar de 1 sin salirse de la tabla", () => {
    // Math.random() nunca devuelve 1, pero el redondeo de un 0,999… sí puede
    // caerse del array si el índice no se recorta.
    expect(eligePuntosNodriza(1)).toBe(300);
    expect(eligePuntosNodriza(0)).toBe(50);
  });
});

describe("el fin de oleada", () => {
  it("cada oleada arranca un escalón más abajo", () => {
    expect(alturaDeSalida(2)).toBeGreaterThan(alturaDeSalida(1));
    expect(alturaDeSalida(3)).toBeGreaterThan(alturaDeSalida(2));
  });

  it("el descenso tiene tope", () => {
    // Sin tope, la oleada 20 arrancaría con la formación ya en el suelo y la
    // partida sería un game over de salida.
    expect(alturaDeSalida(20)).toBe(alturaDeSalida(9));
    expect(alturaDeSalida(9)).toBe(alturaDeSalida(100));
  });

  it("la formación de salida nunca nace pasada la línea del cañón", () => {
    for (let nivel = 1; nivel <= 50; nivel++) {
      expect(alturaDeSalida(nivel)).toBeLessThan(Y_LIMITE);
    }
  });
});

describe("la línea del cañón", () => {
  const formacion = (filas: readonly number[]) =>
    filas.map((fila, i) => ({
      col: i,
      fila,
      tipo: "bajo" as const,
      vivo: true,
    }));

  it("no se dispara con la formación arriba", () => {
    expect(alcanzaronElLimite(formacion([0, 1, 2]), 96)).toBe(false);
  });

  it("se dispara en cuanto uno vivo la alcanza", () => {
    // Empujando la formación hacia abajo, en algún momento el de la fila 2
    // cruza la línea.
    expect(alcanzaronElLimite(formacion([0, 1, 2]), Y_LIMITE)).toBe(true);
  });

  it("los muertos no cuentan", () => {
    const invasores = formacion([0, 1, 2]).map((inv) => ({
      ...inv,
      vivo: false,
    }));
    // Una formación entera aniquilada y hundida no termina la partida: la
    // termina el fin de oleada, que es otra cosa.
    expect(alcanzaronElLimite(invasores, Y_LIMITE + 500)).toBe(false);
  });

  it("termina la partida aunque queden vidas", () => {
    // Con el azar clavado en 0 los invasores disparan SIEMPRE desde su columna
    // más a la izquierda, así que un cañón pegado al borde derecho es
    // inalcanzable. Sin ese montaje las tres vidas se gastan mucho antes de que
    // la formación llegue abajo: cada muerte cuesta ~13 s y el descenso ~264.
    const restaura = conAzarConstante(0);
    try {
      const motor = montaMotor(createInvadersGame);
      motor.handle.start();
      motor.reloj.avanza(1);

      pulsa("ArrowRight");
      motor.reloj.avanza(400); // hasta el tope derecho, y ahí se queda
      suelta("ArrowRight");

      // Sin disparar: con los 55 vivos cada rebote cuesta ~16 s y hacen falta
      // dieciséis para que la fila de abajo cruce la línea.
      motor.reloj.avanza(20000);

      expect(motor.finales).toHaveLength(1);
      expect(motor.finales[0].reason).toBe("game_over");
      // La clave: NO se llegó a 0 vidas. La partida acabó por la línea, que es
      // lo que impide que las vidas sean un colchón infinito.
      expect(motor.vidas).toEqual([3]);
      motor.handle.destroy();
    } finally {
      restaura();
    }
  });
});
