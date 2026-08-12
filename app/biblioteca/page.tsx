// ===== app/biblioteca/page.tsx =====
// Server Component contenedor: existe para exportar metadata, que un componente
// cliente no puede declarar. Toda la UI vive en biblioteca-client.tsx.

import type { Metadata } from "next";
import BibliotecaClient from "./biblioteca-client";

export const metadata: Metadata = {
  title: "Biblioteca",
  description:
    "Explora el catálogo completo de juegos de Arcade Vault y filtra por categoría.",
};

export default function BibliotecaPage() {
  return <BibliotecaClient />;
}
