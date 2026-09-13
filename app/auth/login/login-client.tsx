"use client";

// ===== app/auth/login/login-client.tsx — Iniciar sesión =====
// La mitad "in" de la tarjeta de pestañas que dejó la SPEC 04, ahora con ruta
// propia (SPEC 19). Los botones sociales siguen decorativos hasta la SPEC 20.

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase/client";
import AuthCard from "../auth-card";
import BotonesOAuth from "../botones-oauth";
import { traducir } from "../errores";

// Estos dos mensajes no salen de Supabase, así que no viven en errores.ts: los
// escribe /auth/confirmar en la URL cuando no consigue completar el canje, ya
// venga del enlace de un correo o de la vuelta de un proveedor.
const AVISOS = {
  enlace: "EL ENLACE NO ES VÁLIDO O SE ABRIÓ EN OTRO NAVEGADOR",
  oauth: "NO SE COMPLETÓ EL ACCESO CON EL PROVEEDOR",
} as const;

export type MotivoDeVuelta = keyof typeof AVISOS;

export default function LoginClient({ motivo }: { motivo?: MotivoDeVuelta }) {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  // Sin sacudida al llegar: el shake es la respuesta a algo que acabas de
  // pulsar, y aquí el usuario viene de su correo o del proveedor sin haber
  // tocado nada en esta pantalla.
  const [error, setError] = useState<string | null>(
    motivo ? AVISOS[motivo] : null,
  );
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

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (!error) {
      // refresh() para que los Server Components vuelvan a renderizar ya con
      // la cookie de sesión puesta. No se apaga `busy`: la navegación ya va en
      // camino y el botón no debe volver a estar pulsable.
      router.push("/biblioteca");
      router.refresh();
      return;
    }

    fallar(error.message);
    setBusy(false);
  };

  return (
    <AuthCard shake={shake} pestanas="login">
      {error && <div className="auth-error">{error}</div>}

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
        <div className="field">
          <label>Contraseña</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </div>

        <button
          className="btn lg"
          type="submit"
          disabled={busy}
          style={{ width: "100%", marginTop: 8 }}
        >
          ENTRAR AL VAULT
        </button>
      </form>

      <Link className="auth-link" href="/auth/recuperar">
        ¿OLVIDASTE TU CONTRASEÑA?
      </Link>

      <button
        className="btn ghost"
        style={{ width: "100%", marginTop: 10 }}
        onClick={() => router.push("/biblioteca")}
      >
        JUGAR COMO INVITADO
      </button>

      <div className="auth-divider">O CONTINÚA CON</div>
      <BotonesOAuth />

      <div
        style={{
          marginTop: 18,
          textAlign: "center",
          fontSize: 11,
          color: "var(--ink-faint)",
          letterSpacing: "0.1em",
        }}
      >
        AL ENTRAR ACEPTAS LOS TÉRMINOS DEL SALÓN ARCADE
      </div>
    </AuthCard>
  );
}
