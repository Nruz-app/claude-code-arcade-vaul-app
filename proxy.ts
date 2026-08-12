// ===== proxy.ts =====
// Refresca la cookie de sesión de Supabase en cada request. En Next 16 la
// convención `middleware.ts` está deprecada y se llama `proxy.ts`; la guía
// pública de Supabase todavía dice `middleware.ts`, así que no se copia tal cual.
//
// Esto NO autoriza ni redirige a nadie: todas las rutas siguen siendo públicas
// (SPEC 04). La propia doc de Next desaconseja usar Proxy como capa de
// autorización.

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  // Respuesta que se irá reconstruyendo si Supabase renueva los tokens.
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          // Primero en la request, para que el render que viene detrás vea ya
          // las cookies nuevas.
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          response = NextResponse.next({ request });

          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });

          // Cabeceras anti-caché que exige @supabase/ssr al escribir cookies de
          // sesión: sin ellas un CDN podría servir el token de un usuario a otro.
          Object.entries(headers).forEach(([key, value]) => {
            response.headers.set(key, value);
          });
        },
      },
    },
  );

  // Llamada obligatoria: es la que dispara el refresco del token si toca.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    // Todo salvo los estáticos de Next, las imágenes optimizadas y los assets.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
