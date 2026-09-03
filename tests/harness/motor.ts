// ===== tests/harness/motor.ts =====
// Montaje de un motor bajo prueba: canvas falso, reloj determinista y espías de
// los cuatro callbacks. Es el equivalente de lo que hace el reproductor
// (`app/juego/[id]/jugar/page.tsx`) cuando monta un juego real.

import { vi } from "vitest";

import type { SkinId } from "@/app/lib/games/skins";
import type {
  GameCallbacks,
  GameFactory,
  GameHandle,
  GameOverSummary,
} from "@/app/lib/games/types";

import { creaCanvas } from "./canvas";
import { instalaReloj, type Reloj } from "./reloj";

export interface Espias {
  callbacks: GameCallbacks;
  // Los valores emitidos, en orden. Guardar la secuencia y no solo el último
  // valor es lo que permite comprobar que un callback se emite SOLO al cambiar.
  scores: number[];
  vidas: number[];
  niveles: number[];
  finales: GameOverSummary[];
}

export function creaEspias(): Espias {
  const scores: number[] = [];
  const vidas: number[] = [];
  const niveles: number[] = [];
  const finales: GameOverSummary[] = [];

  return {
    scores,
    vidas,
    niveles,
    finales,
    callbacks: {
      onScore: vi.fn((v: number) => void scores.push(v)),
      onLives: vi.fn((v: number) => void vidas.push(v)),
      onLevel: vi.fn((v: number) => void niveles.push(v)),
      onGameOver: vi.fn((s: GameOverSummary) => void finales.push(s)),
    },
  };
}

export interface MotorMontado extends Espias {
  handle: GameHandle;
  canvas: HTMLCanvasElement;
  reloj: Reloj;
}

// Instancia un motor listo para probar. No llama a `start()`: varias pruebas
// necesitan mirar el estado justo después de la factory.
//
// `relojCompartido` sirve para montar dos motores a la vez: `instalaReloj()`
// pisa el rAF global, así que sin reusar el reloj el segundo motor dejaría al
// primero encolando en una cola que ya nadie vacía.
// `skin` se pasa tal cual, incluido `undefined`: montar sin skin y montar con
// "neon" tienen que producir exactamente lo mismo, y las pruebas de
// tests/harness/skins.ts comparan justo esas dos corridas.
export function montaMotor(
  factory: GameFactory,
  relojCompartido?: Reloj,
  skin?: SkinId,
): MotorMontado {
  const reloj = relojCompartido ?? instalaReloj();
  const canvas = creaCanvas();
  const espias = creaEspias();
  const handle = factory(canvas, espias.callbacks, skin);
  return { ...espias, handle, canvas, reloj };
}

// ¿Hay algún valor repetido justo detrás de otro igual? Es la firma de un
// callback que se emite sin que el valor haya cambiado, que es lo que vuelve
// lenta la pantalla: cada emisión provoca un render de React.
export function tieneRepetidosSeguidos(valores: readonly number[]): boolean {
  return valores.some((v, i) => i > 0 && v === valores[i - 1]);
}

// Lanza una pulsación de tecla sobre `window`, que es donde los motores
// enganchan sus listeners. `cancelable` importa: la prueba de `destroy()` mira
// `defaultPrevented` para saber si el listener seguía puesto.
export function pulsa(code: string): KeyboardEvent {
  const evento = new KeyboardEvent("keydown", {
    code,
    bubbles: true,
    cancelable: true,
  });
  window.dispatchEvent(evento);
  return evento;
}

// La gemela de `pulsa()`: suelta la tecla. Hasta la SPEC 14 no hacía falta
// porque las pruebas solo comprobaban qué pasa al pulsar, pero el mando táctil
// despacha exactamente este par —`keydown` al apoyar el dedo, `keyup` al
// levantarlo— y sin soltar, una tecla mantenida se queda pulsada para siempre:
// la nave de ROCAS giraría sola hasta el final de la partida.
export function suelta(code: string): KeyboardEvent {
  const evento = new KeyboardEvent("keyup", {
    code,
    bubbles: true,
    cancelable: true,
  });
  window.dispatchEvent(evento);
  return evento;
}

// Una pulsación completa: apoyar y levantar. Es lo que hace un toque en un
// botón del mando, y lo que basta para las acciones que el motor resuelve por
// transición (girar en SERPENTINA, saltar en RANARIA, rotar en CAÍDA).
export function toca(code: string): void {
  pulsa(code);
  suelta(code);
}
