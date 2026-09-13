"use client";

// ===== app/components/nav.tsx =====
// Portado de references/templates/nav.jsx. El estado activo se deriva de la
// ruta actual con usePathname en lugar del objeto route del app.jsx original.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useUser } from "../lib/user-context";

export default function Nav() {
  const pathname = usePathname();
  const { user, signOut } = useUser();
  const [open, setOpen] = useState(false);

  // Inicio es coincidencia exacta; la landing no engloba otras rutas.
  const isHome = pathname === "/";
  // Biblioteca abarca también el detalle y el reproductor (/juego/...).
  const isLibrary = pathname === "/biblioteca" || pathname.startsWith("/juego");
  const isSalon = pathname === "/salon";
  const isAbout = pathname === "/acerca";
  // Acceso abarca las cuatro pantallas de /auth (login, registro, recuperar y
  // nueva-password): desde la SPEC 19 la igualdad exacta solo acertaría en la
  // ruta que redirige, que es justo la que nunca llega a pintarse.
  const isAuth = pathname.startsWith("/auth");
  const close = () => setOpen(false);

  return (
    <>
      <nav className="av-nav">
        <Link href="/" className="logo" onClick={close}>
          <div className="logo-mark"></div>
          <div className="logo-text neon-cyan">
            ARCADE <span className="neon-magenta">VAULT</span>
          </div>
        </Link>
        <div className="links">
          <Link className={isHome ? "active" : ""} href="/">
            Inicio
          </Link>
          <Link className={isLibrary ? "active" : ""} href="/biblioteca">
            Biblioteca
          </Link>
          <Link className={isSalon ? "active" : ""} href="/salon">
            Salón de la Fama
          </Link>
          <Link className={isAbout ? "active" : ""} href="/acerca">
            Acerca de
          </Link>
        </div>
        <div className="spacer"></div>
        <div className="coin-counter">
          <span className="coin"></span>
          <span>CRÉDITOS · 03</span>
        </div>
        {user ? (
          <button className="btn ghost auth-btn" onClick={signOut}>
            {user.name} ▾
          </button>
        ) : (
          <Link className="btn auth-btn" href="/auth">
            Iniciar Sesión
          </Link>
        )}
        <button
          className="btn ghost hamburger"
          onClick={() => setOpen(true)}
          aria-label="Menú"
        >
          ≡
        </button>
      </nav>

      <div
        className={"av-mobile-backdrop" + (open ? " open" : "")}
        onClick={close}
      ></div>
      <aside className={"av-mobile-panel" + (open ? " open" : "")}>
        <div
          className="pixel neon-cyan"
          style={{ fontSize: 11, marginBottom: 16 }}
        >
          MENÚ
        </div>
        <Link className={isHome ? "active" : ""} href="/" onClick={close}>
          Inicio
        </Link>
        <Link
          className={isLibrary ? "active" : ""}
          href="/biblioteca"
          onClick={close}
        >
          Biblioteca
        </Link>
        <Link className={isSalon ? "active" : ""} href="/salon" onClick={close}>
          Salón de la Fama
        </Link>
        <Link
          className={isAbout ? "active" : ""}
          href="/acerca"
          onClick={close}
        >
          Acerca de
        </Link>
        <Link className={isAuth ? "active" : ""} href="/auth" onClick={close}>
          {user ? "Cuenta" : "Iniciar Sesión"}
        </Link>
        <div style={{ flex: 1 }}></div>
        <div
          className="pixel"
          style={{
            fontSize: 9,
            color: "var(--ink-faint)",
            letterSpacing: "0.16em",
          }}
        >
          CRÉDITOS · 03
        </div>
      </aside>
    </>
  );
}
