"use client";

// ===== app/auth/botones-oauth.tsx — Acceso con proveedor =====
// Los dos botones que llevaban decorativos desde la SPEC 01. Viven aquí y no
// dentro de cada pantalla porque los usan dos (SPEC 20), igual que auth-card.tsx
// y errores.ts.
//
// Con OAuth no hay dos acciones distintas: el primer signInWithOAuth crea la
// cuenta y los siguientes inician sesión. De ahí que el mismo componente sirva
// para /auth/login y para /auth/registro sin cambiar nada.

import { useState } from "react";
import { createClient } from "../lib/supabase/client";
import { traducir } from "./errores";

type Proveedor = "google" | "github";

// Las etiquetas son las que la tarjeta lleva dibujadas desde la SPEC 01.
const PROVEEDORES: { id: Proveedor; etiqueta: string }[] = [
  { id: "google", etiqueta: "◆ GOOGLE" },
  { id: "github", etiqueta: "▣ GITHUB" },
];

interface BotonesOAuthProps {
  /** A dónde volver tras el canje. Siempre una ruta interna. */
  destino?: string;
}

export default function BotonesOAuth({
  destino = "/biblioteca",
}: BotonesOAuthProps) {
  const [supabase] = useState(() => createClient());
  const [enVuelo, setEnVuelo] = useState<Proveedor | null>(null);
  const [error, setError] = useState<string | null>(null);

  const entrar = async (proveedor: Proveedor) => {
    if (enVuelo) return;
    setEnVuelo(proveedor);
    setError(null);

    // El origen se lee aquí y no a nivel de módulo: en el servidor no hay
    // window, y así el enlace de vuelta vale igual en localhost que desplegado.
    const vuelta = new URL("/auth/confirmar", window.location.origin);
    vuelta.searchParams.set("destino", destino);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: proveedor,
      options: { redirectTo: vuelta.toString() },
    });

    // Si la llamada va bien no se llega hasta aquí: el navegador ya se marchó a
    // la pantalla de consentimiento del proveedor.
    if (error) {
      setError(traducir(error.message));
      setEnVuelo(null);
    }
  };

  return (
    <>
      {error && <div className="auth-error">{error}</div>}

      <div className="social">
        {PROVEEDORES.map(({ id, etiqueta }) => (
          <button
            key={id}
            className="btn ghost"
            type="button"
            // Los dos se apagan a la vez: el navegador ya se está yendo, y
            // pulsar el otro solo abriría una negociación que se va a descartar.
            disabled={enVuelo !== null}
            onClick={() => entrar(id)}
          >
            {enVuelo === id ? "CONECTANDO…" : etiqueta}
          </button>
        ))}
      </div>
    </>
  );
}
