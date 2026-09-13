// ===== app/auth/nueva-password/page.tsx =====
// Server Component contenedor: existe para exportar metadata, que un componente
// cliente no puede declarar. Toda la UI vive en nueva-password-client.tsx.

import type { Metadata } from "next";
import NuevaPasswordClient from "./nueva-password-client";

export const metadata: Metadata = {
  title: "Nueva Contraseña",
  description: "Elige una contraseña nueva para tu cuenta de Arcade Vault.",
};

export default function NuevaPasswordPage() {
  return <NuevaPasswordClient />;
}
