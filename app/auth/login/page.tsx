// ===== app/auth/login/page.tsx =====
// Server Component contenedor: existe para exportar metadata, que un componente
// cliente no puede declarar. Toda la UI vive en login-client.tsx.
//
// El `?error=…` con el que /auth/confirmar devuelve aquí a quien no pudo
// completar el canje —`enlace` desde un correo, `oauth` desde un proveedor— se
// lee en el servidor y baja como prop. Así el cliente no necesita
// useSearchParams, que obligaría a envolverlo en Suspense. En Next 16
// searchParams es una promesa, de ahí el await.

import type { Metadata } from "next";
import LoginClient, { type MotivoDeVuelta } from "./login-client";

export const metadata: Metadata = {
  title: "Iniciar Sesión",
  description:
    "Entra en Arcade Vault con tu correo para que tus partidas cuenten en el Salón de la Fama.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { error } = await searchParams;
  const motivo: MotivoDeVuelta | undefined =
    error === "enlace" || error === "oauth" ? error : undefined;

  return <LoginClient motivo={motivo} />;
}
