"use client";

// ===== app/auth/registro/registro-client.tsx — Crear cuenta =====
// La mitad "up" de la tarjeta de pestañas que dejó la SPEC 04, ahora con ruta
// propia (SPEC 19). Sin invitado ni botones sociales: esta pantalla tiene un
// solo objetivo y tres salidas alternativas juegan en su contra.
//
// El perfil no se inserta desde aquí: el username viaja en los metadatos y lo
// recoge el trigger on_auth_user_created, que ya lo pasa a mayúsculas y lo
// corta a 10 caracteres.

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase/client";
import AuthCard from "../auth-card";
import BotonesOAuth from "../botones-oauth";
import { MIN_PASSWORD, PASSWORD_CORTA, traducir } from "../errores";

export default function RegistroClient() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(false);

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

    // Se comprueba antes de salir a la red (SPEC 22). Quien manda sigue siendo
    // el dashboard de Supabase; esto solo se ahorra el viaje en el error más
    // frecuente y responde al instante.
    if (password.length < MIN_PASSWORD) {
      mostrarError(PASSWORD_CORTA);
      return;
    }

    setBusy(true);
    setAviso(null);
    setError(null);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username } },
    });

    if (!error) {
      if (data.session) {
        // refresh() para que los Server Components vuelvan a renderizar ya con
        // la cookie de sesión puesta.
        router.push("/biblioteca");
        router.refresh();
        return;
      }
      // Sin sesión = el proyecto tiene activada la confirmación por correo.
      setAviso("REVISA TU CORREO PARA CONFIRMAR LA CUENTA");
    } else {
      fallar(error.message);
    }

    setBusy(false);
  };

  return (
    <AuthCard shake={shake} pestanas="registro">
      {error && <div className="auth-error">{error}</div>}
      {aviso && <div className="auth-aviso">{aviso}</div>}

      <form onSubmit={submit}>
        <div className="field">
          <label>Usuario</label>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="px_kai"
            maxLength={10}
          />
        </div>
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
            minLength={MIN_PASSWORD}
          />
        </div>

        <button
          className="btn lg"
          type="submit"
          disabled={busy}
          style={{ width: "100%", marginTop: 8 }}
        >
          CREAR Y JUGAR
        </button>
      </form>

      {/* Con OAuth, "continuar con Google" no es una salida de esta pantalla:
          es la propia acción de registrarse. Por eso la SPEC 20 revierte aquí
          la decisión de la 19 de dejar el registro sin nada más que su form. */}
      <div className="auth-divider">O CONTINÚA CON</div>
      <BotonesOAuth />

      <Link className="auth-link" href="/auth/login">
        ¿YA TIENES CUENTA? <b>INICIAR SESIÓN</b>
      </Link>

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
