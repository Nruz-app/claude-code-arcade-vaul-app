"use client";

// ===== app/auth/page.tsx — Acceso =====
// Portado de references/templates/auth.jsx. Desde la SPEC 04 el auth es real:
// Supabase con correo y contraseña. Los botones sociales siguen decorativos.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../lib/supabase/client";

// Supabase devuelve los errores en inglés y toda la UI del proyecto está en
// español. Las claves van en minúscula y sin punto final porque el mismo error
// llega con distinta capitalización según el endpoint ("email rate limit
// exceeded") y a veces con punto ("...at least 6 characters.").
const ERRORES: Record<string, string> = {
  "invalid login credentials": "CREDENCIALES INCORRECTAS",
  "user already registered": "ESE CORREO YA TIENE CUENTA",
  "password should be at least 6 characters":
    "LA CONTRASEÑA NECESITA AL MENOS 6 CARACTERES",
  "email rate limit exceeded": "DEMASIADOS INTENTOS, PRUEBA EN UN RATO",
  "anonymous sign-ins are disabled": "RELLENA CORREO Y CONTRASEÑA",
};

function traducir(mensaje: string): string {
  const clave = mensaje.trim().toLowerCase().replace(/\.$/, "");
  return ERRORES[clave] ?? "NO SE PUDO COMPLETAR LA OPERACIÓN";
}

export default function Auth() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [tab, setTab] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
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
    setAviso(null);
    setError(null);

    if (tab === "in") {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (!error) {
        // refresh() para que los Server Components vuelvan a renderizar ya con
        // la cookie de sesión puesta.
        router.push("/biblioteca");
        router.refresh();
        return;
      }
      fallar(error.message);
    } else {
      // El perfil no se inserta desde aquí: el username viaja en los metadatos
      // y lo recoge el trigger on_auth_user_created.
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { username } },
      });
      if (!error) {
        if (data.session) {
          router.push("/biblioteca");
          router.refresh();
          return;
        }
        // Sin sesión = el proyecto tiene activada la confirmación por correo.
        setAviso("REVISA TU CORREO PARA CONFIRMAR LA CUENTA");
      } else {
        fallar(error.message);
      }
    }

    setBusy(false);
  };

  return (
    <div className="av-auth-wrap fade-in">
      <div className={"auth-card" + (shake ? " shake" : "")}>
        <div className="auth-header">
          <div className="mark"></div>
          <h2 className="neon-cyan">ARCADE VAULT</h2>
          <div
            className="mono"
            style={{
              fontSize: 11,
              color: "var(--ink-faint)",
              letterSpacing: "0.16em",
              marginTop: 6,
            }}
          >
            ACCESO AL SISTEMA · v2.6
          </div>
        </div>

        <div className="auth-tabs">
          <button
            className={tab === "in" ? "on" : ""}
            onClick={() => setTab("in")}
          >
            INICIAR SESIÓN
          </button>
          <button
            className={tab === "up" ? "on" : ""}
            onClick={() => setTab("up")}
          >
            CREAR CUENTA
          </button>
        </div>

        {error && <div className="auth-error">{error}</div>}

        {aviso && (
          <div
            className="mono"
            style={{
              margin: "14px 0 0",
              padding: "10px 12px",
              border: "1px solid var(--cyan)",
              color: "var(--cyan)",
              fontSize: 11,
              letterSpacing: "0.1em",
              textAlign: "center",
            }}
          >
            {aviso}
          </div>
        )}

        <form onSubmit={submit}>
          {tab === "up" && (
            <div className="field slide-in">
              <label>Usuario</label>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="px_kai"
                maxLength={10}
              />
            </div>
          )}
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
            {tab === "in" ? "ENTRAR AL VAULT" : "CREAR Y JUGAR"}
          </button>
        </form>

        <button
          className="btn ghost"
          style={{ width: "100%", marginTop: 10 }}
          onClick={() => router.push("/biblioteca")}
        >
          JUGAR COMO INVITADO
        </button>

        <div className="auth-divider">O CONTINÚA CON</div>
        <div className="social">
          <button className="btn ghost" type="button">
            ◆ GOOGLE
          </button>
          <button className="btn ghost" type="button">
            ▣ GITHUB
          </button>
        </div>

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
      </div>
    </div>
  );
}
