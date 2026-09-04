"use client";

// ===== app/components/mando-tactil.tsx — Mando táctil (SPEC 14, 16, 17) =====
// Los cinco motores del portal escuchan el teclado en `window` y generan ellos
// mismos la repetición al mantener pulsado (el DAS de CAÍDA es el caso claro:
// descarta `e.repeat` y produce su propia cadencia). Así que para jugar con el
// dedo no hace falta ampliar el contrato ni tocar un solo motor: basta con
// despachar `keydown` al apoyar y `keyup` al levantar.
//
// Este archivo no sabe nada del juego que hay debajo. Recibe el mando del
// registro (`GAME_TOUCH`) y despacha los `code` que este declara.
//
// Desde la SPEC 17 el mando ya no es una pieza: son dos, `MandoCruceta` y
// `MandoAcciones`, porque van a costados opuestos de la pantalla dentro del
// chasis de la consola. Ninguna de las dos trae marco ni envoltorio — quien las
// coloca es el reproductor. Cada una está portada de su maqueta,
// `references/gamepad-assets/gamepad-cruceta.html` y `gamepad-botones.html`.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  accionEnSlot,
  type BotonTactil,
  type Direccion,
  type MandoDeJuego,
  type SlotDeAccion,
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

// Los dos huecos de botón redondo, en el orden en que se dibujan: B a la
// izquierda y A a la derecha, como en la referencia. Se recorren siempre los
// dos, tenga el juego uno, ninguno o los dos: el hueco que nadie declara sale
// como carcasa apagada (SPEC 16). Un hueco vacío a la derecha del mando no se
// lee como «este juego no dispara», se lee como un mando roto.
const SLOTS: readonly SlotDeAccion[] = ["B", "A"];

function despacha(tipo: "keydown" | "keyup", code: string) {
  // `bubbles` y `cancelable` como los de un teclado real: los motores llaman a
  // preventDefault() sobre sus teclas, y las pruebas se apoyan en eso.
  window.dispatchEvent(
    new KeyboardEvent(tipo, { code, bubbles: true, cancelable: true }),
  );
}

// Todo lo que las dos mitades hacen igual. Recibe los botones de UNA mitad, no
// el mando entero: así el eco del teclado solo se ocupa de las teclas que esa
// mitad dibuja, y pulsar ESPACIO no provoca un render en la cruceta.
//
// Cada mitad llama al hook por su cuenta, con lo que cada una tiene su propio
// estado y su propia escucha de `window`. Son dos listeners en vez de uno, y a
// cambio ninguna mitad depende de la otra para montarse — que es lo que permite
// ponerlas en costados opuestos del chasis sin un contexto de por medio.
function useMando(botones: readonly BotonTactil[]) {
  // Qué tecla mantiene apoyada cada dedo. Va en un ref y no en estado: cambiar
  // de tecla pulsada no tiene que provocar un render — el aspecto de «pulsado»
  // lo pone :active en CSS, que es más rápido y no pasa por React.
  const pulsadas = useRef(new Map<number, string>());

  // Qué teclas están encendidas en el dibujo. Esto sí es estado —cambia lo que
  // se pinta— y es lo único que separa el eco del teclado del `:active` de
  // siempre: el CSS no puede saber que alguien pulsó una tecla lejos del botón.
  const [encendidas, setEncendidas] = useState<ReadonlySet<string>>(new Set());

  // Bandera de «esto lo he mandado yo». El mando despacha KeyboardEvent sobre
  // `window`, así que su propia escucha los oye; sin la guardia, tocar un botón
  // se encendería dos veces (por :active y por el eco) y soltarlo dejaría al
  // eco discutiendo con el CSS. El despacho es síncrono, así que subir y bajar
  // la bandera alrededor de la llamada basta.
  const propio = useRef(false);

  const despachaPropio = useCallback(
    (tipo: "keydown" | "keyup", code: string) => {
      propio.current = true;
      try {
        despacha(tipo, code);
      } finally {
        propio.current = false;
      }
    },
    [],
  );

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
      despachaPropio("keydown", code);
    },
    [despachaPropio],
  );

  const levanta = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      // Idempotente a propósito: el mismo dedo puede disparar `pointerup` y
      // `lostpointercapture` seguidos, y el motor no debe recibir dos keyup.
      const code = pulsadas.current.get(e.pointerId);
      if (!code) return;
      pulsadas.current.delete(e.pointerId);
      despachaPropio("keyup", code);
    },
    [despachaPropio],
  );

  // Al desmontar hay que soltar lo que quede apoyado. El caso real: se pierde
  // la última vida con el dedo en un botón, el modal de fin tapa el mando y el
  // `pointerup` ya no llega a nadie. Sin esto, la partida siguiente arrancaría
  // con una tecla pulsada que nadie está pulsando.
  useEffect(() => {
    const apoyadas = pulsadas.current;
    return () => {
      for (const code of apoyadas.values()) despachaPropio("keyup", code);
      apoyadas.clear();
    };
  }, [despachaPropio]);

  // Las teclas de esta mitad. Se comparan contra `e.code` para no encender nada
  // por una tecla que no dibuja: ESC pausa la partida y no es un botón de aquí.
  const codes = useMemo(
    () => new Set(botones.map((b) => b.code)),
    // Los botones salen de GAME_TOUCH, que es una constante del módulo: la
    // identidad del array solo cambia si cambia el juego.
    [botones],
  );

  // El eco del teclado físico (SPEC 16). Va en una sola dirección: escucha
  // `window` y no despacha nada. Es lo que convierte el mando en un indicador
  // de lo que el motor está recibiendo cuando se juega con teclado.
  useEffect(() => {
    const enciende = (code: string, on: boolean) => {
      if (!codes.has(code)) return;
      setEncendidas((previas) => {
        // Sin esto, cada evento devolvería un Set nuevo y React re-renderizaría
        // por algo que no cambia nada.
        if (previas.has(code) === on) return previas;
        const siguientes = new Set(previas);
        if (on) siguientes.add(code);
        else siguientes.delete(code);
        return siguientes;
      });
    };

    const abajo = (e: KeyboardEvent) => {
      // `e.repeat` fuera: el auto-repeat del sistema dispara treinta keydown por
      // segundo mientras se mantiene una tecla, y serían treinta intentos de
      // render encima de un juego a 60 fps.
      if (propio.current || e.repeat) return;
      enciende(e.code, true);
    };
    const arriba = (e: KeyboardEvent) => {
      if (propio.current) return;
      enciende(e.code, false);
    };
    // Cambiar de pestaña con una tecla pulsada: el `keyup` no llega nunca y el
    // botón se quedaría encendido para siempre. Es el mismo fallo que en la
    // SPEC 14 obligó a soltar las teclas al desmontar, ahora en versión visual.
    const apaga = () =>
      setEncendidas((previas) => (previas.size ? new Set() : previas));

    window.addEventListener("keydown", abajo);
    window.addEventListener("keyup", arriba);
    window.addEventListener("blur", apaga);
    document.addEventListener("visibilitychange", apaga);
    return () => {
      window.removeEventListener("keydown", abajo);
      window.removeEventListener("keyup", arriba);
      window.removeEventListener("blur", apaga);
      document.removeEventListener("visibilitychange", apaga);
    };
  }, [codes]);

  const clases = (base: string, code: string) =>
    encendidas.has(code) ? `${base} on` : base;

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

  return { props, clases };
}

// ── La cruceta ────────────────────────────────────────────────────────────────
// Reserva sus tres filas siempre: el botón que el juego no usa no se dibuja,
// pero su hueco sigue ahí. Aquí sí se deja el vacío —y en los redondos no—
// porque una dirección apagada donde el jugador espera un control sugiere una
// acción que no ha descubierto, y la carcasa de un mando no.
export function MandoCruceta({ mando }: { mando: MandoDeJuego }) {
  const botones = useMemo(
    () => ORDEN.map((dir) => mando.cruceta[dir]).filter((b) => b !== undefined),
    [mando],
  );
  const { props, clases } = useMando(botones);

  return (
    <div className="mando-cruceta" role="group" aria-label="Cruceta">
      {ORDEN.map((dir) => {
        const boton = mando.cruceta[dir];
        if (!boton) return null;
        return (
          <button
            key={dir}
            className={clases(`mando-dir mando-${dir}`, boton.code)}
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
  );
}

// ── Los botones redondos ──────────────────────────────────────────────────────
// Los dos huecos, siempre. El que el juego no declara sale como carcasa.
export function MandoAcciones({ mando }: { mando: MandoDeJuego }) {
  const { props, clases } = useMando(mando.acciones);

  return (
    <div className="mando-acciones" role="group" aria-label="Botones de acción">
      {SLOTS.map((slot) => {
        const boton = accionEnSlot(mando, slot);
        const clase = `mando-accion mando-${slot.toLowerCase()}`;
        // El hueco que nadie declara es carcasa: se ve, no se toca y no existe
        // para un lector de pantalla. `disabled` es lo que lo saca del recorrido
        // de tabulación y de cualquier clic; el `pointer-events: none` del CSS
        // es el cinturón sobre eso.
        if (!boton) {
          return (
            <button
              key={slot}
              type="button"
              className={`${clase} inerte`}
              disabled
              aria-hidden="true"
              tabIndex={-1}
            >
              <span className="mando-aro" />
              <span className="mando-letra">{slot}</span>
            </button>
          );
        }
        return (
          <button
            key={slot}
            className={clases(clase, boton.code)}
            {...props(boton)}
          >
            <span className="mando-aro" aria-hidden="true" />
            <span className="mando-letra">{boton.etiqueta}</span>
          </button>
        );
      })}
    </div>
  );
}
