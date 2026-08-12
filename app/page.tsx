"use client";

// ===== app/page.tsx — Landing =====
// Portado de references/templates/home-about/home.jsx. Los botones del original
// llamaban a navigate({ name }); aquí son <Link>, que además dan URL real y
// abren en pestaña nueva con clic central.

import Link from "next/link";
import { FeatureIcon, FloatingSilhouettes } from "./components/pixel-icons";
import {
  FAQS,
  FEATURES,
  GAMES,
  HOME_STATS,
  PLAN_PERKS,
  RECENT_SCORES,
  TOP_PLAYERS,
  type Game,
} from "./lib/data";
import { useReveal } from "./lib/use-reveal";

function MiniCard({ game }: { game: Game }) {
  return (
    <Link className="mini-card" href={`/juego/${game.id}`}>
      <div className="mini-cover">
        <div className={"cover-bg " + game.cover}></div>
      </div>
      <div className="mini-meta">
        <div className="mini-title">{game.title}</div>
        <div className="mini-cat">{game.cat}</div>
      </div>
    </Link>
  );
}

export default function HomePage() {
  useReveal();

  return (
    <div className="home fade-in">
      {/* HERO */}
      <section className="home-hero">
        <FloatingSilhouettes />
        <div className="home-hero-inner">
          <div className="hero-eyebrow pixel neon-yellow">
            ▸ INSERTA UNA MONEDA<span className="blink">_</span>
          </div>
          <h1 className="home-title">
            <span className="line-1">EL ARCADE</span>
            <span className="line-2">CLÁSICO ESTÁ</span>
            <span className="line-3">DE VUELTA</span>
          </h1>
          <p className="home-sub">
            Juega los mejores clásicos directamente en tu navegador.
            <br />
            Sin descargas. Sin costo. Solo diversión.
          </p>
          <div className="home-ctas">
            <Link className="btn xl pulse" href="/biblioteca">
              ▶ EXPLORAR JUEGOS
            </Link>
            <Link className="btn xl magenta" href="/auth">
              ✦ CREAR CUENTA
            </Link>
          </div>
        </div>
        {/* Fuera de .home-hero-inner: se ancla al hero completo (alto de ventana),
            no al bloque de contenido, para no solaparse con los CTAs. */}
        <div className="hero-scroll" aria-hidden="true">
          <span>DESLIZA</span>
          <span className="arrow">▼</span>
        </div>
      </section>

      {/* WHY */}
      <section className="home-section reveal">
        <div className="section-head">
          {/* El texto va entre llaves: suelto, JSX lo tomaría por un comentario. */}
          <div className="kicker pixel neon-magenta">{"// 01"}</div>
          <h2 className="section-title">¿POR QUÉ ARCADE VAULT?</h2>
          <div className="section-rule"></div>
        </div>
        <div className="feature-grid">
          {FEATURES.map((f, i) => (
            <div
              key={f.title}
              className={"feature-card " + f.color}
              style={{ transitionDelay: i * 80 + "ms" }}
            >
              <FeatureIcon kind={f.icon} />
              <div className="ft-title pixel">{f.title}</div>
              <div className="ft-desc">{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* GAMES PREVIEW */}
      <section className="home-section reveal">
        <div className="section-head">
          <div className="kicker pixel neon-cyan">{"// 02"}</div>
          <h2 className="section-title">JUEGOS DISPONIBLES AHORA</h2>
          <div className="section-rule"></div>
        </div>
        <div className="mini-rail">
          {GAMES.slice(0, 6).map((g) => (
            <MiniCard key={g.id} game={g} />
          ))}
        </div>
        <div style={{ textAlign: "center", marginTop: 24 }}>
          <Link className="btn lg" href="/biblioteca">
            VER TODOS LOS JUEGOS →
          </Link>
        </div>
      </section>

      {/* STATS */}
      <section className="home-stats reveal">
        <div className="stats-inner">
          {HOME_STATS.map((st, i) => (
            <div
              key={st.unit}
              className="stat-block"
              style={{ transitionDelay: i * 90 + "ms" }}
            >
              <div className="stat-n neon-yellow">{st.value}</div>
              <div className="stat-u pixel">{st.unit}</div>
              <div className="stat-s">{st.sub}</div>
            </div>
          ))}
        </div>
      </section>

      {/* RECENT ACTIVITY / LEADERBOARD */}
      <section className="home-section reveal">
        <div className="section-head">
          <div className="kicker pixel neon-yellow">{"// 03"}</div>
          <h2 className="section-title">ACTIVIDAD EN VIVO</h2>
          <div className="section-rule"></div>
        </div>
        <div className="activity-grid">
          <div className="activity-card">
            <div className="ac-head">
              <div className="ac-title pixel">▸ ÚLTIMAS PUNTUACIONES</div>
            </div>
            <div className="ticker">
              {RECENT_SCORES.map((r, i) => (
                <div
                  key={r.player + r.game}
                  className="tick-row"
                  style={{ animationDelay: i * 60 + "ms" }}
                >
                  <span className={"tk-p neon-" + r.color}>{r.player}</span>
                  <span className="tk-mid">▸ {r.game}</span>
                  <span className="tk-s">
                    +{r.score.toLocaleString("es-ES")}
                  </span>
                  <span className="tk-t">{r.ago}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="activity-card">
            <div className="ac-head">
              <div className="ac-title pixel neon-magenta">
                ▸ TOP JUGADORES · HOY
              </div>
              <Link className="lb-link" href="/salon">
                VER SALÓN →
              </Link>
            </div>
            <div className="top-list">
              {TOP_PLAYERS.map((r, i) => (
                <div
                  key={r.player}
                  className={
                    "top-row" +
                    (i === 0
                      ? " top1"
                      : i === 1
                        ? " top2"
                        : i === 2
                          ? " top3"
                          : "")
                  }
                >
                  <span className="tp-rk">#{String(r.rank).padStart(2, "0")}</span>
                  <span className="tp-bar">
                    <span
                      className="tp-fill"
                      style={{ width: 100 - i * 16 + "%" }}
                    ></span>
                  </span>
                  <span className="tp-p">{r.player}</span>
                  <span className="tp-s">{r.score.toLocaleString("es-ES")}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section className="home-section reveal">
        <div className="section-head">
          <div className="kicker pixel neon-green">{"// 04"}</div>
          <h2 className="section-title">PRECIOS</h2>
          <div className="section-rule"></div>
        </div>
        <div className="pricing-grid">
          <div className="price-card">
            <div className="pc-label pixel">PLAN ÚNICO</div>
            <div className="pc-name pixel">JUGADOR VAULT</div>
            <div className="pc-amount">
              <span className="pc-amount-n">$0</span>
              <span className="pc-amount-u">/ SIEMPRE</span>
            </div>
            <div className="pc-tag">SIN TRUCOS · SIN LETRA PEQUEÑA</div>
            <ul className="pc-list">
              {PLAN_PERKS.map((perk) => (
                <li key={perk}>✔ {perk}</li>
              ))}
            </ul>
            <Link
              className="btn xl pulse"
              href="/auth"
              style={{ width: "100%" }}
            >
              EMPEZAR GRATIS →
            </Link>
            <div className="pc-foot">No pedimos tarjeta. Nunca lo haremos.</div>
            <div className="pc-stamp pixel">
              FREE
              <br />
              PLAY
            </div>
          </div>

          <div className="pricing-faq">
            {FAQS.map((f) => (
              <div key={f.q} className="faq-item">
                <div className="faq-q pixel">{f.q}</div>
                <div className="faq-a">{f.a}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="home-final reveal">
        <h2 className="final-title pixel">¿LISTO PARA JUGAR?</h2>
        <Link className="btn xl pulse final-cta" href="/biblioteca">
          INSERTAR MONEDA →
        </Link>
        <div className="final-tag">
          Gratis. Sin registro obligatorio. Empieza en segundos.
        </div>
      </section>
    </div>
  );
}
