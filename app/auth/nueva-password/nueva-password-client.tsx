"use client";

// ===== app/auth/nueva-password/nueva-password-client.tsx =====
// Último tramo del flujo de recuperación (SPEC 19). Se llega aquí desde
// /auth/confirmar, que ya dejó la sesión puesta al canjear el enlace; lo único
// que queda es updateUser.
//
// Sin esa sesión no hay a quién cambiarle la contraseña, así que la pantalla
// comprueba primero y no llega a pintar un formulario que no podría guardar
// nada.

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase/client";
import AuthCard from "../auth-card";
import { MIN_PASSWORD, PASSWORD_CORTA, traducir } from "../errores";

// El mismo texto con el que errores.ts traduce el "Auth session missing!" de
// Supabase: la causa es la misma, así que el usuario lee lo mismo llegue por
// donde llegue.
const SIN_SESION = "EL ENLACE HA CADUCADO, PÍDELO OTRA VEZ";

export default function NuevaPasswordClient() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [busy, setBusy] = useState(false);
  const [sesion, setSesion] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(false);

  useEffect(() => {
    let vivo = true;
    supabase.auth.getUser().then(({ data }) => {
      if (vivo) setSesion(Boolean(data.user));
    });
    return () => {
      vivo = false;
    };
  }, [supabase]);

  // Mismo patrón que el formulario de contacto de /acerca.
  const mostrarError = (texto: string) => {
    setError(texto);
    setShake(true);
    setTimeout(() => setShake(false), 400);
  };
  const fallar = (mensaje: string) => mostrarError(traducir(mensaje));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;

    // Se comprueba antes de salir a la red: es el único punto del flujo donde
    // equivocarse al teclear deja al usuario fuera hasta pedir otro correo.
    //
    // La longitud va primero (SPEC 22) y el orden importa: con dos contraseñas
    // cortas y distintas, saber que hacen falta ocho caracteres es más útil que
    // saber que no coinciden, porque hay que reescribir las dos igual.
    if (password.length < MIN_PASSWORD) {
      mostrarError(PASSWORD_CORTA);
      return;
    }
    if (password !== password2) {
      mostrarError("LAS CONTRASEÑAS NO COINCIDEN");
      return;
    }

    setBusy(true);
    setError(null);

    const { error } = await supabase.auth.updateUser({ password });
    if (!error) {
      // refresh() para que los Server Components vuelvan a renderizar ya con
      // la cookie de sesión puesta.
      router.push("/biblioteca");
      router.refresh();
      return;
    }

    fallar(error.message);
    setBusy(false);
  };

  return (
    <AuthCard shake={shake}>
      {error && <div className="auth-error">{error}</div>}

      {sesion === null && (
        <div className="auth-aviso">COMPROBANDO EL ENLACE…</div>
      )}

      {sesion === false && (
        <>
          {!error && <div className="auth-error">{SIN_SESION}</div>}
          <Link className="auth-link" href="/auth/recuperar">
            PEDIR <b>OTRO ENLACE</b>
          </Link>
        </>
      )}

      {sesion === true && (
        <form onSubmit={submit}>
          <div className="field">
            <label>Contraseña nueva</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              minLength={MIN_PASSWORD}
            />
          </div>
          <div className="field">
            <label>Repite la contraseña</label>
            <input
              type="password"
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
              placeholder="••••••••"
              minLength={MIN_PASSWORD}
            />
          </div>

          <button
            className="btn lg"
            type="submit"
            disabled={busy}
            style={{ width: "100%", marginTop: 8 }}
          >
            GUARDAR Y ENTRAR
          </button>
        </form>
      )}
    </AuthCard>
  );
}
