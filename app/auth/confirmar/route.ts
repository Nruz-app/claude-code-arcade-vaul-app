// ===== app/auth/confirmar/route.ts =====
// El canje de `code` por sesión, compartido por dos flujos: la recuperación de
// contraseña (SPEC 19) y el acceso con proveedor (SPEC 20). Los dos usan PKCE,
// así que el paso final es literalmente el mismo — solo cambia a dónde se va
// después, y eso lo dice el parámetro `destino`.
//
// Es un Route Handler y no un Server Component porque aquí sí se pueden
// escribir cookies: el try/catch del setAll de app/lib/supabase/server.ts está
// ahí por los Server Components, no por esta ruta.

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "../../lib/supabase/server";

// El de la recuperación, que es quien llega sin `destino`.
const DESTINO_POR_DEFECTO = "/auth/nueva-password";

/**
 * Resuelve el `destino` de la query, que **solo** se acepta si es una ruta
 * interna: tiene que empezar por "/" y no por "//" —eso último es una URL
 * absoluta protocol-relative disfrazada de ruta—. Cualquier otra cosa cae al
 * destino por defecto en vez de sacar al usuario del sitio.
 *
 * Además se comprueba el origen ya resuelto, y no es redundante: `new URL`
 * normaliza la barra invertida a barra, así que "/\evil.example" pasaría la
 * criba de prefijos y aterrizaría en otro host.
 */
function destinoSeguro(crudo: string | null, request: NextRequest): URL {
  const porDefecto = new URL(DESTINO_POR_DEFECTO, request.url);

  if (!crudo || !crudo.startsWith("/") || crudo.startsWith("//")) {
    return porDefecto;
  }

  const candidato = new URL(crudo, request.url);
  return candidato.origin === request.nextUrl.origin ? candidato : porDefecto;
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const code = params.get("code");
  const destino = destinoSeguro(params.get("destino"), request);

  // El proveedor vuelve con `error` en vez de `code` cuando el usuario cancela
  // en su pantalla o le niega los permisos. No es un enlace roto y no debe
  // leerse como tal, así que tiene su propio mensaje.
  if (params.has("error")) {
    return NextResponse.redirect(
      new URL("/auth/login?error=oauth", request.url),
    );
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(destino);
    }
  }

  // Sin `code`, o con uno que no se deja canjear. El caso corriente no es un
  // enlace caducado sino un enlace abierto en otro navegador: el verificador de
  // PKCE se quedó en una cookie del que pidió el correo.
  return NextResponse.redirect(
    new URL("/auth/login?error=enlace", request.url),
  );
}
