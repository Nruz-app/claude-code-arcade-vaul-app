"use client";

// ===== app/auth/recuperar/recuperar-client.tsx — Pedir el enlace =====
// Primer tramo del flujo de recuperación (SPEC 19): se pide el correo y
// Supabase manda un enlace que acaba en /auth/confirmar.
//
// La respuesta es la misma exista la cuenta o no. Decir "ese correo no está
// registrado" convertiría esta pantalla en un enumerador de cuentas: cualquiera
// podría averiguar quién tiene cuenta probando correos.

import { useState } from "react";
import Link from "next/link";
import { createClient } from "../../lib/supabase/client";
import AuthCard from "../auth-card";
import { traducir } from "../errores";

export default function RecuperarClient() {
  const [supabase] = useState(() => createClient());
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(false);

  // Mismo patrón que el formulario de contacto de /acerca.
  const fallar = (mensaje: string) => {
    setError(traducir(mensaje));
    setShake(true);
    setTimeout(() => setShake(false), 400);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);

    // El origen se lee aquí y no en el módulo: en el servidor no hay window, y
    // así el enlace funciona igual en localhost que en producción.
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/confirmar`,
    });

    // Un error aquí es de red o de límite de envíos, nunca "ese correo no
    // existe": Supabase responde igual en los dos casos.
    if (error) fallar(error.message);
    else setEnviado(true);

    setBusy(false);
  };

  return (
    <AuthCard shake={shake}>
      {error && <div className="auth-error">{error}</div>}

      {enviado ? (
        <div className="auth-aviso">
          SI ESE CORREO TIENE CUENTA, TE HEMOS ENVIADO UN ENLACE
        </div>
      ) : (
        <form onSubmit={submit}>
          <div className="field">
            <label>Correo electrónico</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jugador@vault.gg"
            />
          </div>

          <button
            className="btn lg"
            type="submit"
            disabled={busy}
            style={{ width: "100%", marginTop: 8 }}
          >
            ENVIAR ENLACE
          </button>
        </form>
      )}

      <Link className="auth-link" href="/auth/login">
        VOLVER A <b>INICIAR SESIÓN</b>
      </Link>
    </AuthCard>
  );
}
