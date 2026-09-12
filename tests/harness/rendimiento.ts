// ===== tests/harness/rendimiento.ts =====
// La CUARTA suite compartida del repo: el presupuesto de coste por fotograma de
// un motor. Las otras tres (`contrato.ts`, `skins.ts`, `mando.ts`) afirman qué
// hace un motor; esta afirma **cuánto trabajo le cuesta hacerlo**, para que una
// regresión de rendimiento falle en CI en vez de notarse jugando.
//
// La escribió la primera invocación de `game-performance-booster` (GLOTÓN) y
// está pensada para que las otras cinco la reutilicen sin reestructurarla: el
// presupuesto NO vive aquí, llega por argumento desde
// `tests/games/<juego>.test.ts`. Este archivo solo sabe medir.
//
// ── Cómo se invoca (una línea, como las otras tres suites) ────────────────────
//
//   import { verificaRendimiento } from "../harness/rendimiento";
//
//   verificaRendimiento("GLOTÓN", createPacmanGame, {
//     dibujoPorFrame: 300,   // máximo de llamadas al contexto en un fotograma
//     coloresPorFrame: 20,   // máximo de escrituras a fill/stroke/shadowColor
//     emisionesEn600: 40,    // onScore + onLives + onLevel en 600 fotogramas
//     heapKbEn600: 700,      // KB retenidos tras 600 fotogramas, con gc() a los dos lados
//   });
//
// Las cuatro cifras son **techos medidos, no objetivos**: se ponen con holgura
// sobre lo que se midió de verdad (la convención de GLOTÓN es ~25 %), para que
// la prueba pille un cambio de orden de magnitud y no el ruido del runner.
//
// Y un cuarto parámetro opcional para los motores que necesitan otra ventana de
// medida (más calentamiento, teclas pulsadas antes de medir, otro skin):
//
//   verificaRendimiento("X", createXGame, presupuesto, {
//     calentamiento: 60,
//     antesDeMedir: (m) => toca("ArrowLeft"),
//   });
//
// ── Cómo se mide a mano, mientras se optimiza ────────────────────────────────
//
// Las cuatro sondas están exportadas por separado y devuelven números, así que
// un archivo de medida provisional (en el scratchpad, NO en el repo) puede
// imprimir el antes y el después sin pasar por `expect`:
//
//   const d = mideDibujoPorFrame(createPacmanGame);
//   console.log(d.max, d.media, desgloseLegible(d.desglose));
//
// ── Lo que esta suite NO puede ver ───────────────────────────────────────────
//
// El `Proxy` de `canvas.ts` se traga `shadowBlur`, `save()`/`restore()` y el
// rasterizado entero en 0 ms. Un motor puede cumplir las cuatro cifras de aquí
// y seguir siendo el más caro del catálogo por un blur gaussiano. Esa es la
// quinta sonda del agente (p50/p95 reales en Chromium) y **no es automatizable
// en Vitest**: vive en el informe y en la memoria, no aquí.

import { describe, expect, it } from "vitest";
import v8 from "node:v8";

import type { SkinId } from "@/app/lib/games/skins";
import type { GameFactory } from "@/app/lib/games/types";

import {
  coloresUsados,
  creaCanvas,
  llamadasDeDibujo,
  olvidaColores,
} from "./canvas";
import { instalaReloj, type Reloj } from "./reloj";
import { creaEspias, type MotorMontado } from "./motor";

// ── El presupuesto ───────────────────────────────────────────────────────────

export interface PresupuestoDeRendimiento {
  // Máximo de llamadas al contexto 2D en UN fotograma. Es el contador global de
  // `llamadasDeDibujo`: cada método de dibujo cuenta uno, sin distinguir cuál.
  dibujoPorFrame: number;
  // Máximo de escrituras a `fillStyle`/`strokeStyle`/`shadowColor` en UN
  // fotograma. Cuenta los halos de paso: un `shadowColor` por entidad sale aquí.
  coloresPorFrame: number;
  // Máximo de emisiones de `onScore` + `onLives` + `onLevel` en 600 fotogramas.
  // Cada emisión es un render de React del reproductor entero.
  emisionesEn600: number;
  // Máximo de KB retenidos tras 600 fotogramas (~10 s a 60 fps), con `gc()` a
  // los dos lados. Es la sonda de las allocations por fotograma.
  heapKbEn600: number;
}

export interface OpcionesDeRendimiento {
  // Fotogramas que se dejan correr antes de empezar a medir. El primero de una
  // partida nunca es representativo, y algunos motores tardan un segundo en
  // llegar a su régimen (GLOTÓN se come siete puntos al arrancar).
  calentamiento?: number;
  // Fotogramas medidos. De la ventana se toma el MÁXIMO, que es lo que el
  // presupuesto acota: la media esconde el fotograma caro.
  muestras?: number;
  // ms por fotograma del reloj determinista. 16 ≈ 60 fps, que es lo que los
  // motores esperan de un navegador.
  msPorFrame?: number;
  skin?: SkinId;
  // Se ejecuta después de `start()` y antes del calentamiento. Es el hueco para
  // los motores que no se mueven solos: pulsar una tecla, mover el puntero.
  antesDeMedir?: (motor: MotorMontado) => void;
}

const POR_DEFECTO = {
  calentamiento: 60,
  muestras: 20,
  msPorFrame: 16,
} as const;

// ── Montaje propio, con desglose por método ──────────────────────────────────

// El contador de `canvas.ts` es un único entero sin desglose: su Proxy devuelve
// el mismo `noop` para cualquier propiedad y no mira cuál. Para saber si el
// coste es `fillRect`, `arc` o `stroke` hace falta envolver el contexto otra
// vez, y eso se hace AQUÍ —nunca tocando `canvas.ts`, que sostiene 35
// aserciones compartidas—.
//
// Las escrituras de estado se anotan con el nombre prefijado por `=`
// (`=fillStyle`, `=shadowBlur`): cada una invalida el estado del contexto, así
// que son parte del coste aunque no dibujen nada.
export type DesglosePorMetodo = Record<string, number>;

interface ContextoEspiado {
  ctx: CanvasRenderingContext2D;
  desglose: DesglosePorMetodo;
  reinicia: () => void;
}

function espiaContexto(real: CanvasRenderingContext2D): ContextoEspiado {
  let desglose: DesglosePorMetodo = {};
  const envueltos = new Map<string, unknown>();
  const destino = real as unknown as Record<string | symbol, unknown>;

  const ctx = new Proxy(destino, {
    get(_d, prop) {
      const valor = destino[prop];
      if (typeof valor !== "function") return valor;
      const nombre = String(prop);
      let fn = envueltos.get(nombre);
      if (!fn) {
        fn = (...args: unknown[]) => {
          desglose[nombre] = (desglose[nombre] ?? 0) + 1;
          return (valor as (...a: unknown[]) => unknown).apply(destino, args);
        };
        envueltos.set(nombre, fn);
      }
      return fn;
    },
    set(_d, prop, valor) {
      const nombre = `=${String(prop)}`;
      desglose[nombre] = (desglose[nombre] ?? 0) + 1;
      destino[prop] = valor;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;

  return {
    ctx,
    get desglose() {
      return desglose;
    },
    reinicia() {
      desglose = {};
    },
  } as ContextoEspiado;
}

export interface MotorMedido extends MotorMontado {
  // El contexto REAL del canvas (el del stub de `canvas.ts`), que es sobre el
  // que valen `llamadasDeDibujo` y `coloresUsados`.
  ctx: CanvasRenderingContext2D;
  // Qué métodos se llamaron y cuántas veces, desde el último `reiniciaDesglose`.
  desglose: () => DesglosePorMetodo;
  reiniciaDesglose: () => void;
}

// Monta un motor como lo hace `montaMotor()`, pero interponiendo el espía de
// métodos entre el motor y el contexto. No se puede reutilizar `montaMotor`
// porque el canvas hay que parchearlo ANTES de que corra la factory: el motor
// pide su contexto en el preámbulo y se lo queda para siempre.
export function montaMedido(
  factory: GameFactory,
  opciones: OpcionesDeRendimiento = {},
  relojCompartido?: Reloj,
): MotorMedido {
  const reloj = relojCompartido ?? instalaReloj();
  const canvas = creaCanvas();
  const real = canvas.getContext("2d");
  if (!real) throw new Error("el stub de canvas no está instalado");
  const espia = espiaContexto(real);

  // Propiedad propia del elemento: pisa la del prototipo solo para este canvas,
  // así el resto de las pruebas sigue viendo el stub tal cual.
  const devuelve = () => espia.ctx;
  Object.defineProperty(canvas, "getContext", {
    configurable: true,
    value: (tipo: string) => (tipo === "2d" ? devuelve() : null),
  });

  const espias = creaEspias();
  const handle = factory(canvas, espias.callbacks, opciones.skin);

  // Se restaura para que quien mire el canvas después (una aserción sobre
  // `llamadasDeDibujo`, por ejemplo) reciba el contexto real.
  Object.defineProperty(canvas, "getContext", {
    configurable: true,
    value: (tipo: string) => (tipo === "2d" ? real : null),
  });

  return {
    ...espias,
    handle,
    canvas,
    reloj,
    ctx: real,
    desglose: () => espia.desglose,
    reiniciaDesglose: espia.reinicia,
  };
}

// ── Sonda 1: llamadas de dibujo por fotograma ────────────────────────────────

export interface MedidaPorFrame {
  max: number;
  min: number;
  media: number;
  // Desglose por método del ÚLTIMO fotograma medido: es el que explica el número.
  desglose: DesglosePorMetodo;
}

export function mideDibujoPorFrame(
  factory: GameFactory,
  opciones: OpcionesDeRendimiento = {},
): MedidaPorFrame {
  const o = { ...POR_DEFECTO, ...opciones };
  const m = montaMedido(factory, opciones);
  m.handle.start();
  o.antesDeMedir?.(m);
  m.reloj.avanza(o.calentamiento, o.msPorFrame);

  const porFrame: number[] = [];
  for (let i = 0; i < o.muestras; i++) {
    m.reiniciaDesglose();
    const antes = llamadasDeDibujo(m.ctx);
    m.reloj.avanza(1, o.msPorFrame);
    porFrame.push(llamadasDeDibujo(m.ctx) - antes);
  }
  const desglose = { ...m.desglose() };
  m.handle.destroy();
  return { ...resume(porFrame), desglose };
}

// ── Sonda 2: asignaciones de color por fotograma ─────────────────────────────

export function mideColoresPorFrame(
  factory: GameFactory,
  opciones: OpcionesDeRendimiento = {},
): MedidaPorFrame {
  const o = { ...POR_DEFECTO, ...opciones };
  const m = montaMedido(factory, opciones);
  m.handle.start();
  o.antesDeMedir?.(m);
  m.reloj.avanza(o.calentamiento, o.msPorFrame);

  const porFrame: number[] = [];
  let ultimos: readonly string[] = [];
  for (let i = 0; i < o.muestras; i++) {
    olvidaColores(m.ctx);
    m.reloj.avanza(1, o.msPorFrame);
    ultimos = [...coloresUsados(m.ctx)];
    porFrame.push(ultimos.length);
  }
  m.handle.destroy();

  // El «desglose» de esta sonda es cuántas veces se asignó cada color: es lo
  // que delata el patrón «reasignar el mismo color N veces seguidas».
  const desglose: DesglosePorMetodo = {};
  for (const c of ultimos) desglose[c] = (desglose[c] ?? 0) + 1;
  return { ...resume(porFrame), desglose };
}

// ── Sonda 3: emisiones de callback ───────────────────────────────────────────

export interface MedidaDeEmisiones {
  scores: number;
  vidas: number;
  niveles: number;
  total: number;
  frames: number;
}

// Cada emisión es un `setState` del reproductor, o sea un render de React del
// árbol entero. Lo que se mide es el VOLUMEN; que no haya repetidos seguidos ya
// lo afirma `contrato.ts`.
export function mideEmisiones(
  factory: GameFactory,
  frames = 600,
  opciones: OpcionesDeRendimiento = {},
): MedidaDeEmisiones {
  const o = { ...POR_DEFECTO, ...opciones };
  const m = montaMedido(factory, opciones);
  m.handle.start();
  o.antesDeMedir?.(m);
  // Los tres forzados de `initGame()` no son coste de régimen: el presupuesto
  // mide la partida, no el arranque.
  const base = m.scores.length + m.vidas.length + m.niveles.length;
  m.reloj.avanza(frames, o.msPorFrame);
  const medida = {
    scores: m.scores.length,
    vidas: m.vidas.length,
    niveles: m.niveles.length,
    total: m.scores.length + m.vidas.length + m.niveles.length - base,
    frames,
  };
  m.handle.destroy();
  return medida;
}

// ── Sonda 4: heap tras N fotogramas ──────────────────────────────────────────

export interface MedidaDeHeap {
  // KB retenidos. Redondeado: el byte exacto no es reproducible ni interesa.
  kb: number;
  // false si el runner corre sin `--expose-gc`: sin `gc()` la cifra no vale
  // nada, porque mide basura pendiente y no memoria retenida.
  fiable: boolean;
  frames: number;
}

function recogeBasura(): boolean {
  const gc = (globalThis as { gc?: () => void }).gc;
  if (!gc) return false;
  // Dos pasadas: la primera deja objetos alcanzables solo desde el finalizador.
  gc();
  gc();
  return true;
}

export function mideHeap(
  factory: GameFactory,
  frames = 600,
  opciones: OpcionesDeRendimiento = {},
): MedidaDeHeap {
  const o = { ...POR_DEFECTO, ...opciones };
  const fiable = recogeBasura();
  const m = montaMedido(factory, opciones);
  m.handle.start();
  o.antesDeMedir?.(m);
  m.reloj.avanza(o.calentamiento, o.msPorFrame);
  recogeBasura();
  const antes = v8.getHeapStatistics().used_heap_size;
  m.reloj.avanza(frames, o.msPorFrame);
  recogeBasura();
  const despues = v8.getHeapStatistics().used_heap_size;
  m.handle.destroy();
  return {
    kb: Math.round((despues - antes) / 1024),
    fiable,
    frames,
  };
}

// ── Ayudas de lectura ────────────────────────────────────────────────────────

function resume(valores: readonly number[]): {
  max: number;
  min: number;
  media: number;
} {
  const suma = valores.reduce((a, b) => a + b, 0);
  return {
    max: Math.max(...valores),
    min: Math.min(...valores),
    media: Math.round((suma / valores.length) * 10) / 10,
  };
}

// Un desglose ordenado de mayor a menor, para volcarlo en el informe.
export function desgloseLegible(
  desglose: DesglosePorMetodo,
  tope = 12,
): string {
  return Object.entries(desglose)
    .sort((a, b) => b[1] - a[1])
    .slice(0, tope)
    .map(([k, v]) => `${k}×${v}`)
    .join(" ");
}

// ── La suite ─────────────────────────────────────────────────────────────────

export function verificaRendimiento(
  nombre: string,
  factory: GameFactory,
  presupuesto: PresupuestoDeRendimiento,
  opciones: OpcionesDeRendimiento = {},
): void {
  describe(`${nombre}: presupuesto por fotograma`, () => {
    it(`no pasa de ${presupuesto.dibujoPorFrame} llamadas de dibujo por fotograma`, () => {
      const medida = mideDibujoPorFrame(factory, opciones);
      expect(
        medida.max,
        `llamadas al contexto en el fotograma más caro (media ${medida.media}): ${desgloseLegible(medida.desglose)}`,
      ).toBeLessThanOrEqual(presupuesto.dibujoPorFrame);
    });

    it(`no pasa de ${presupuesto.coloresPorFrame} asignaciones de color por fotograma`, () => {
      const medida = mideColoresPorFrame(factory, opciones);
      expect(
        medida.max,
        `escrituras a fillStyle/strokeStyle/shadowColor (media ${medida.media}): ${desgloseLegible(medida.desglose)}`,
      ).toBeLessThanOrEqual(presupuesto.coloresPorFrame);
    });

    it(`no emite más de ${presupuesto.emisionesEn600} callbacks en 600 fotogramas`, () => {
      const medida = mideEmisiones(factory, 600, opciones);
      expect(
        medida.total,
        `renders de React provocados en 600 fotogramas (score ${medida.scores}, vidas ${medida.vidas}, nivel ${medida.niveles})`,
      ).toBeLessThanOrEqual(presupuesto.emisionesEn600);
    });

    // Sin `--expose-gc` no hay `global.gc()` y la cifra mediría basura
    // pendiente, no memoria retenida: la prueba se salta en vez de mentir. Para
    // exigirla de verdad:
    //   NODE_OPTIONS=--expose-gc npx vitest run tests/games/<juego>.test.ts
    it.skipIf(!(globalThis as { gc?: () => void }).gc)(
      `no retiene más de ${presupuesto.heapKbEn600} KB tras 600 fotogramas`,
      () => {
        const medida = mideHeap(factory, 600, opciones);
        expect(
          medida.kb,
          "KB retenidos tras 600 fotogramas con gc() a los dos lados",
        ).toBeLessThanOrEqual(presupuesto.heapKbEn600);
      },
    );
  });
}
