"use client";

// ===== app/lib/use-reveal.ts =====
// Portado del useReveal() de references/templates/home-about/home.jsx, que
// about.jsx repetía en línea. Añade la clase "in" a cada elemento .reveal
// cuando entra en viewport; el CSS (.reveal / .reveal.in) hace la transición.

import { useEffect } from "react";

/**
 * Observa los elementos .reveal presentes en el momento del montaje y los
 * revela al entrar en viewport. Cada elemento se deja de observar en cuanto
 * se revela: la animación ocurre una sola vez, no al volver a subir.
 */
export function useReveal() {
  useEffect(() => {
    const els = document.querySelectorAll(".reveal");
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12 },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}
