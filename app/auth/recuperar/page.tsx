// ===== app/auth/recuperar/page.tsx =====
// Server Component contenedor: existe para exportar metadata, que un componente
// cliente no puede declarar. Toda la UI vive en recuperar-client.tsx.

import type { Metadata } from "next";
import RecuperarClient from "./recuperar-client";

export const metadata: Metadata = {
  title: "Recuperar Contraseña",
  description:
    "Pide un enlace por correo para volver a entrar en tu cuenta de Arcade Vault.",
};

export default function RecuperarPage() {
  return <RecuperarClient />;
}
