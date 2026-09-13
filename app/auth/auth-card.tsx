"use client";

// ===== app/auth/auth-card.tsx — El marco de las pantallas de acceso =====
// El chasis que comparten las cuatro pantallas de /auth: el centrado, la
// tarjeta con su sacudida de error, la cabecera con la marca y —cuando la
// pantalla las tiene— las dos pestañas.
//
// Es un componente y no un layout.tsx a propósito (SPEC 19): `shake` es estado
// de cada pantalla y tiene que llegar a la clase de la tarjeta, y un layout de
// Next no recibe props de sus hijos.

import Link from "next/link";

interface AuthCardProps {
  /** Dispara la animación shake de .auth-card. Lo controla cada pantalla. */
  shake: boolean;
  /** Qué pestaña se marca activa. Ausente en /auth/recuperar y
   *  /auth/nueva-password, que no tienen pestañas. */
  pestanas?: "login" | "registro";
  children: React.ReactNode;
}

export default function AuthCard({ shake, pestanas, children }: AuthCardProps) {
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

        {/* Pestañas como navegación real: cada una es una ruta, no un estado. */}
        {pestanas && (
          <div className="auth-tabs">
            <Link
              className={pestanas === "login" ? "on" : ""}
              href="/auth/login"
            >
              INICIAR SESIÓN
            </Link>
            <Link
              className={pestanas === "registro" ? "on" : ""}
              href="/auth/registro"
            >
              CREAR CUENTA
            </Link>
          </div>
        )}

        {children}
      </div>
    </div>
  );
}
