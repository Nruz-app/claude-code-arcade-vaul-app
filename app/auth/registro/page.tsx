// ===== app/auth/registro/page.tsx =====
// Server Component contenedor: existe para exportar metadata, que un componente
// cliente no puede declarar. Toda la UI vive en registro-client.tsx.

import type { Metadata } from "next";
import RegistroClient from "./registro-client";

export const metadata: Metadata = {
  title: "Crear Cuenta",
  description:
    "Crea tu cuenta de Arcade Vault y elige el nombre con el que firmarás tus marcas.",
};

export default function RegistroPage() {
  return <RegistroClient />;
}
