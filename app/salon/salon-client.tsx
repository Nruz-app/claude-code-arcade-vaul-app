"use client";

// ===== app/salon/salon-client.tsx — Salón de la Fama =====
// Portado de references/templates/salon.jsx. Los rankings ya no son
// deterministas: salen de la vista game_leaderboard. El ranking del primer
// juego llega renderizado desde el servidor; los demás se consultan aquí al
// cambiar de pestaña.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { GAMES } from "../lib/data";
import { useUser } from "../lib/user-context";
import { createClient } from "../lib/supabase/client";
import {
  getLeaderboard,
  getPlayerBest,
  type LeaderboardRow,
  type PlayerBest,
} from "../lib/leaderboard";

interface Props {
  juegoInicial: string;
  rankingInicial: LeaderboardRow[];
}

export default function SalonClient({ juegoInicial, rankingInicial }: Props) {
  const { user } = useUser();
  const [supabase] = useState(() => createClient());
  const [tab, setTab] = useState(juegoInicial);
  const [rows, setRows] = useState<LeaderboardRow[]>(rankingInicial);
  const [cargando, setCargando] = useState(false);
  // Qué juego corresponde a lo que hay en `rows`. Evita repetir en el cliente
  // la consulta que ya hizo el servidor.
  const cargadoRef = useRef(juegoInicial);

  useEffect(() => {
    if (cargadoRef.current === tab) return;
    cargadoRef.current = tab;

    let vigente = true;
    setCargando(true);
    void getLeaderboard(supabase, tab).then((filas) => {
      if (!vigente) return;
      setRows(filas);
      setCargando(false);
    });
    return () => {
      vigente = false;
    };
  }, [tab, supabase]);

  // Tu marca no se busca en el top visible: puedes estar más allá del puesto 12.
  const [miMarca, setMiMarca] = useState<PlayerBest | null>(null);
  // A qué pestaña y jugador corresponde lo que hay en `miMarca`. Guardarlo
  // evita un segundo estado que habría que resetear dentro del efecto, y de
  // paso impide enseñar la marca de la pestaña anterior mientras carga la nueva.
  const [marcaDe, setMarcaDe] = useState<{
    tab: string;
    userId: string;
  } | null>(null);

  useEffect(() => {
    if (!user) return;
    let vigente = true;
    void getPlayerBest(supabase, tab, user.id).then((marca) => {
      if (!vigente) return;
      setMiMarca(marca);
      setMarcaDe({ tab, userId: user.id });
    });
    return () => {
      vigente = false;
    };
  }, [supabase, tab, user]);

  const miMarcaResuelta =
    !!user && marcaDe?.tab === tab && marcaDe?.userId === user.id;

  const game = GAMES.find((g) => g.id === tab)!;

  return (
    <div className="av-hall fade-in">
      <div className="hall-head">
        <h1>SALÓN DE LA FAMA</h1>
        <p className="pixel" style={{ fontSize: 10 }}>
          LOS NOMBRES QUE NUNCA SE BORRAN DE LA PANTALLA
        </p>
      </div>

      <div className="hall-tabs">
        {GAMES.map((g) => (
          <button
            key={g.id}
            className={"chip" + (tab === g.id ? " active" : "")}
            onClick={() => setTab(g.id)}
          >
            {g.title}
          </button>
        ))}
      </div>

      {/* El podio necesita tres marcas. Con datos reales un juego puede tener
          una sola, y leer rows[1] a ciegas reventaría la pantalla. */}
      {rows.length >= 3 && (
        <div className="podium">
          <div className="podium-slot silver">
            <div className="rank-num">02</div>
            <div className="name">{rows[1].username}</div>
            <div className="score">{rows[1].score.toLocaleString("es-ES")}</div>
            <div className="date">{rows[1].date}</div>
          </div>
          <div className="podium-slot gold">
            <div
              className="pixel"
              style={{
                fontSize: 9,
                color: "var(--gold)",
                letterSpacing: "0.18em",
              }}
            >
              CAMPEÓN
            </div>
            <div className="rank-num" style={{ fontSize: 36, marginTop: 4 }}>
              01
            </div>
            <div className="name">{rows[0].username}</div>
            <div className="score" style={{ fontSize: 20 }}>
              {rows[0].score.toLocaleString("es-ES")}
            </div>
            <div className="date">{rows[0].date}</div>
          </div>
          <div className="podium-slot bronze">
            <div className="rank-num">03</div>
            <div className="name">{rows[2].username}</div>
            <div className="score">{rows[2].score.toLocaleString("es-ES")}</div>
            <div className="date">{rows[2].date}</div>
          </div>
        </div>
      )}

      <div className="hall-table">
        {/* Sin filas no se pinta la cabecera: una tabla con encabezados y nada
            debajo parece un fallo, no un juego sin estrenar. */}
        {cargando ? (
          <div className="hall-state">CARGANDO RANKING…</div>
        ) : rows.length === 0 ? (
          <div className="hall-state empty">
            <div className="pixel">AÚN NADIE HA JUGADO A {game.title}</div>
            <div className="sub mono">SÉ EL PRIMERO EN DEJAR TU MARCA</div>
          </div>
        ) : (
          <>
            <div className="th">
              <div>RANGO</div>
              <div>JUGADOR</div>
              <div>PUNTUACIÓN</div>
              <div>FECHA</div>
            </div>
            {rows.map((r, i) => (
              <div
                key={r.userId}
                className={
                  "tr" +
                  (i === 0
                    ? " top1"
                    : i === 1
                      ? " top2"
                      : i === 2
                        ? " top3"
                        : "")
                }
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <div className="rk">#{String(r.rank).padStart(2, "0")}</div>
                <div className="pl">{r.username}</div>
                <div className="sc">{r.score.toLocaleString("es-ES")}</div>
                <div className="dt">{r.date}</div>
              </div>
            ))}
          </>
        )}
        {user && !cargando && rows.length > 0 && miMarcaResuelta && (
          <>
            <div className="tr you-label">▸ TU MEJOR MARCA EN {game.title}</div>
            {miMarca ? (
              <div
                className="tr you"
                style={{ animationDelay: `${rows.length * 50 + 50}ms` }}
              >
                <div className="rk" style={{ color: "var(--yellow)" }}>
                  #{String(miMarca.rank).padStart(2, "0")}
                </div>
                <div className="pl" style={{ color: "var(--yellow)" }}>
                  {user.name}
                </div>
                <div
                  className="sc"
                  style={{
                    color: "var(--yellow)",
                    textShadow: "0 0 6px rgba(245,255,0,0.5)",
                  }}
                >
                  {miMarca.score.toLocaleString("es-ES")}
                </div>
                <div className="dt">{miMarca.date}</div>
              </div>
            ) : (
              /* Sin partidas en este juego no se inventa un puesto: se invita
                 a jugar, que es de lo que iba esta pantalla. */
              <div className="hall-state sub mono">
                AÚN NO HAS JUGADO A {game.title}
              </div>
            )}
          </>
        )}
      </div>

      <div style={{ textAlign: "center", marginTop: 32 }}>
        <Link className="btn lg" href="/biblioteca">
          VOLVER A LA BIBLIOTECA
        </Link>
      </div>
    </div>
  );
}
