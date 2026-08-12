// ===== app/lib/supabase/server.ts =====
// Cliente de Supabase para Server Components y Route Handlers. En Next 16
// cookies() es asíncrono, de ahí el await. Hay que crear un cliente nuevo por
// render: nunca compartir uno entre peticiones, o se filtran sesiones.

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Desde un Server Component no se pueden escribir cookies. Se ignora
            // a propósito: quien refresca la sesión es proxy.ts.
          }
        },
      },
    },
  );
}
