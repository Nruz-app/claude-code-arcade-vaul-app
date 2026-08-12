// ===== app/acerca/page.tsx =====
// Server Component contenedor: existe para exportar metadata, que un componente
// cliente no puede declarar. Toda la UI vive en about-client.tsx.

import type { Metadata } from "next";
import AboutClient from "./about-client";

export const metadata: Metadata = {
  title: "Acerca de",
  description:
    "Qué es Arcade Vault, por qué existe y cómo ponerte en contacto con el proyecto.",
};

export default function AboutPage() {
  return <AboutClient />;
}
