// ===== app/lib/supabase/client.ts =====
// Cliente de Supabase para el navegador. Lo usan los componentes "use client"
// (user-context, /auth). La clave publicable es pública por diseño: lo que
// protege los datos son las políticas RLS, no el secreto de la clave.

import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
