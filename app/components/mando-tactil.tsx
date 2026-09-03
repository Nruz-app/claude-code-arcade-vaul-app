"use client";

// ===== app/components/mando-tactil.tsx — Mando táctil (SPEC 14) =====
// Los cinco motores del portal escuchan el teclado en `window` y generan ellos
// mismos la repetición al mantener pulsado (el DAS de CAÍDA es el caso claro:
// descarta `e.repeat` y produce su propia cadencia). Así que para jugar con el
// dedo no hace falta ampliar el contrato ni tocar un solo motor: basta con
// despachar `keydown` al apoyar y `keyup` al levantar.
//
// Este componente no sabe nada del juego que hay debajo. Recibe el mando del
// registro (`GAME_TOUCH`) y despacha los `code` que este declara. El aspecto
// está portado de `references/gamepad-assets/gamepad.html`.

import { useCallback, useEffect, useRef } from "react";

import type {
  BotonTactil,
  Direccion,
  MandoDeJuego,
} from "../lib/games/registry";

// Las flechas de la cruceta se dibujan con SVG y no con un carácter: Press
// Start 2P es una fuente pixel de cobertura limitada, y un triángulo que caiga
// en la fuente de reserva rompe la estética justo en los botones.
const FLECHAS: Record<Direccion, string> = {
  arriba: "M12 4 L20 16 L4 16 Z",
  derecha: "M8 4 L20 12 L8 20 Z",
  abajo: "M4 8 L20 8 L12 20 Z",
  izquierda: "M16 4 L16 20 L4 12 Z",
};

const ORDEN: readonly Direccion[] = ["arriba", "derecha", "abajo", "izquierda"];

function despacha(tipo: "keydown" | "keyup", code: string) {
  // `bubbles` y `cancelable` como los de un teclado real: los motores llaman a
  // preventDefault() sobre sus teclas, y las pruebas se apoyan en eso.
  window.dispatchEvent(
    new KeyboardEvent(tipo, { code, bubbles: true, cancelable: true }),
  );
}

export default function MandoTactil({ mando }: { mando: MandoDeJuego }) {
  // Qué tecla mantiene apoyada cada dedo. Va en un ref y no en estado: cambiar
  // de tecla pulsada no tiene que provocar un render — el aspecto de «pulsado»
  // lo pone :active en CSS, que es más rápido y no pasa por React.
  const pulsadas = useRef(new Map<number, string>());

  const apoya = useCallback(
    (e: React.PointerEvent<HTMLElement>, code: string) => {
      // Sin captura, deslizar el dedo fuera del botón entrega el `pointerup` a
      // otro elemento: el `keyup` no se despacharía nunca y la tecla se quedaría
      // pulsada para siempre — la nave de ROCAS propulsando hasta el final de la
      // partida. Es el fallo más caro de todo el mando.
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // Safari puede rechazarla si el puntero ya se soltó. No es motivo para
        // perder la pulsación: el keyup llega igual por pointercancel.
      }
      pulsadas.current.set(e.pointerId, code);
      despacha("keydown", code);
    },
    [],
  );

  const levanta = useCallback((e: React.PointerEvent<HTMLElement>) => {
    // Idempotente a propósito: el mismo dedo puede disparar `pointerup` y
    // `lostpointercapture` seguidos, y el motor no debe recibir dos keyup.
    const code = pulsadas.current.get(e.pointerId);
    if (!code) return;
    pulsadas.current.delete(e.pointerId);
    despacha("keyup", code);
  }, []);

  // Al desmontar hay que soltar lo que quede apoyado. El caso real: se pierde
  // la última vida con el dedo en un botón, el modal de fin tapa el mando y el
  // `pointerup` ya no llega a nadie. Sin esto, la partida siguiente arrancaría
  // con una tecla pulsada que nadie está pulsando.
  useEffect(() => {
    const apoyadas = pulsadas.current;
    return () => {
      for (const code of apoyadas.values()) despacha("keyup", code);
      apoyadas.clear();
    };
  }, []);

  const props = (boton: BotonTactil) => ({
    type: "button" as const,
    "aria-label": boton.accion,
    onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) =>
      apoya(e, boton.code),
    onPointerUp: levanta,
    onPointerCancel: levanta,
    onLostPointerCapture: levanta,
    // El botón no debe recibir el foco al tocarlo: con el foco puesto, la
    // barra espaciadora del teclado lo activaría además de llegar al motor.
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
    tabIndex: -1,
  });

  return (
    <div className="mando" role="group" aria-label="Mando táctil">
      <div className="mando-cruceta">
        {ORDEN.map((dir) => {
          const boton = mando.cruceta[dir];
          if (!boton) return null;
          return (
            <button
              key={dir}
              className={`mando-dir mando-${dir}`}
              {...props(boton)}
            >
              <svg
                className="mando-flecha"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path d={FLECHAS[dir]} fill="currentColor" />
              </svg>
            </button>
          );
        })}
        <div className="mando-hub" aria-hidden="true">
          <span className="mando-gema" />
        </div>
      </div>

      <div className="mando-acciones">
        {mando.acciones.map((boton) => (
          <button
            key={boton.code}
            className={`mando-accion mando-${boton.tono}`}
            {...props(boton)}
          >
            <span className="mando-aro" aria-hidden="true" />
            <span className="mando-letra">{boton.etiqueta}</span>
          </button>
        ))}
        {/* BLOQUE BUSTER se juega sobre todo arrastrando por la pantalla, y eso
            no hay forma de descubrirlo si nadie lo dice. */}
        {mando.arrastre && (
          <div className="mando-pista mono">
            ARRASTRA
            <br />
            EN LA PANTALLA
          </div>
        )}
      </div>
    </div>
  );
}
