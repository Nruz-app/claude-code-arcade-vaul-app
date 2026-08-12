import type { Metadata } from "next";
import { Press_Start_2P, JetBrains_Mono } from "next/font/google";
import { UserProvider } from "./lib/user-context";
import Nav from "./components/nav";
import "./globals.css";

// Fuente "pixel" del tema (titulares, HUD, botones). Press Start 2P no es
// variable, así que requiere un weight explícito.
const pressStart2P = Press_Start_2P({
  variable: "--font-pixel",
  weight: "400",
  subsets: ["latin"],
  display: "swap",
});

// Fuente "mono" del tema (texto de cuerpo, inputs, tablas).
const jetBrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Arcade Vault · Portal Retro",
    template: "%s · Arcade Vault",
  },
  description:
    "Juega clásicos arcade online y compite por las mayores puntuaciones.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${pressStart2P.variable} ${jetBrainsMono.variable}`}
    >
      <body>
        {/* Fondo global del tema: grilla en perspectiva + scanlines + ruido */}
        <div className="av-bg" aria-hidden="true" />
        <div className="av-noise" aria-hidden="true" />
        <UserProvider>
          <div id="root">
            <Nav />
            <main className="av-main">{children}</main>
            <footer
              style={{
                borderTop: "1px solid var(--line)",
                padding: "20px 32px",
                textAlign: "center",
                color: "var(--ink-faint)",
                fontFamily: "var(--mono)",
                fontSize: 11,
                letterSpacing: "0.16em",
              }}
            >
              © 2026 ARCADE VAULT · HECHO CON PIXELES Y NEÓN · v2.6.0
            </footer>
          </div>
        </UserProvider>
      </body>
    </html>
  );
}
