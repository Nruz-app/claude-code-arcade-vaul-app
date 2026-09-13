// ===== app/auth/page.tsx =====
// Aquí vivía la tarjeta de pestañas de la SPEC 04. Desde la SPEC 19 login y
// registro tienen ruta propia, y esta queda como puerta de entrada: hay cuatro
// enlaces a /auth repartidos por la app (el Nav, dos veces, y la landing, otras
// dos) y marcadores que la gente pueda tener guardados. Redirigir cuesta tres
// líneas y los cubre todos.

import { redirect } from "next/navigation";

export default function AuthPage() {
  redirect("/auth/login");
}
