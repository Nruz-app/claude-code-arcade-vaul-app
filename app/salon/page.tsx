// ===== app/salon/page.tsx =====
// Server Component contenedor: exporta metadata (que un componente cliente no
// puede declarar) y carga el ranking del primer juego, para que la pantalla
// llegue al navegador ya con datos en vez de vacía.
//
// La ruta es dinámica sin configurarlo: el cliente de servidor de Supabase lee
// cookies(), que es una API de tiempo de petición, y eso la excluye del
// prerenderizado. Así el ranking está siempre fresco.

import type { Metadata } from "next";
import SalonClient from "./salon-client";
import { GAMES } from "../lib/data";
import { getLeaderboard } from "../lib/leaderboard";
import { createClient } from "../lib/supabase/server";

export const metadata: Metadata = {
  title: "Salón de la Fama",
  description:
    "Las mejores marcas de cada juego de Arcade Vault y los nombres que nunca se borran de la pantalla.",
};

export default async function SalonPage() {
  const juegoInicial = GAMES[0].id;
  const supabase = await createClient();
  const rankingInicial = await getLeaderboard(supabase, juegoInicial);

  return (
    <SalonClient juegoInicial={juegoInicial} rankingInicial={rankingInicial} />
  );
}
