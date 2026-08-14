"use client";

// ===== app/lib/use-skin.ts =====
// La preferencia de aspecto del jugador. Vive en localStorage, junto a la clave
// `av_scores` que ya usa user-context.tsx para las marcas de los invitados.
//
// Es GLOBAL y no por juego a propósito: es una preferencia estética del portal,
// con un solo selector y una sola clave. No se pierde nada, porque cada motor
// tiene su propia paleta `clasico` — una única preferencia global ya produce
// CAÍDA con sus colores de Tetris y SERPENTINA en verde Nokia.
//
// Se lee con useSyncExternalStore y no con useState + useEffect. localStorage
// es exactamente el "sistema externo" para el que existe ese hook: el
// instantáneo de servidor devuelve el skin por defecto, así que el HTML del
// servidor y el del primer render coinciden y no hay desajuste de hidratación.

import { useCallback, useSyncExternalStore } from "react";

import { SKIN_POR_DEFECTO, esSkin, type SkinId } from "./games/skins";

const CLAVE = "av_skin";

// Estado de módulo, que aquí sí es lo correcto: la preferencia es del navegador
// y una sola, y es lo que mantiene sincronizadas dos pestañas o dos
// componentes. Es también el respaldo cuando localStorage no está disponible
// (modo privado, cookies bloqueadas), donde la elección vale para la sesión
// aunque no sobreviva a una recarga.
let enMemoria: SkinId | null = null;
const oyentes = new Set<() => void>();

function suscribe(alCambiar: () => void): () => void {
  oyentes.add(alCambiar);
  // "storage" solo se dispara en las OTRAS pestañas; la propia se entera por el
  // conjunto de oyentes de arriba.
  window.addEventListener("storage", alCambiar);
  return () => {
    oyentes.delete(alCambiar);
    window.removeEventListener("storage", alCambiar);
  };
}

function leer(): SkinId {
  if (enMemoria) return enMemoria;
  try {
    const guardado = window.localStorage.getItem(CLAVE);
    // Se sanea siempre: un valor manipulado a mano no debe dejar al motor
    // indexando su paleta con una clave que no existe.
    if (esSkin(guardado)) return guardado;
  } catch {
    // Quedarse con el skin por defecto es una degradación aceptable; romper la
    // pantalla del juego no lo es.
  }
  return SKIN_POR_DEFECTO;
}

function leerEnServidor(): SkinId {
  return SKIN_POR_DEFECTO;
}

export function useSkin(): [SkinId, (siguiente: SkinId) => void] {
  const skin = useSyncExternalStore(suscribe, leer, leerEnServidor);

  const elegir = useCallback((siguiente: SkinId) => {
    enMemoria = siguiente;
    try {
      window.localStorage.setItem(CLAVE, siguiente);
    } catch {
      // La elección sigue valiendo para esta sesión: solo se pierde al recargar.
    }
    for (const avisar of oyentes) avisar();
  }, []);

  return [skin, elegir];
}
