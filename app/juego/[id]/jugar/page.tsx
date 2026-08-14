"use client";

// ===== app/juego/[id]/jugar/page.tsx — Reproductor =====
// Despachador: si el id tiene motor registrado en app/lib/games/registry.ts,
// monta el juego real sobre un canvas; si no, cae en la simulación cosmética
// (un setInterval sube el score solo), que es lo que usan los otros juegos.
// El HUD, la pausa y el modal de fin son los mismos en los dos casos.

import { useCallback, useEffect, useRef, useState } from "react";
import { notFound, useParams, useRouter } from "next/navigation";
import { GAMES } from "../../../lib/data";
import { useUser } from "../../../lib/user-context";
import {
  GAME_CONTROLS,
  GAME_ENGINES,
  GAME_PALETAS,
} from "../../../lib/games/registry";
import { saveGameSession, type SaveResult } from "../../../lib/game-sessions";
import { SKINS } from "../../../lib/games/skins";
import { useSkin } from "../../../lib/use-skin";
import type { GameHandle, GameOverSummary } from "../../../lib/games/types";

export default function GamePlayer() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const { user, saveScore } = useUser();
  const game = GAMES.find((g) => g.id === params.id);

  const engine = game ? GAME_ENGINES[game.id] : undefined;
  // El selector solo se ofrece si el motor tiene paletas declaradas. Mientras
  // no las tengan los cinco, enseñarlo en los demás sería ofrecer una opción
  // que no cambia nada.
  const tieneSkins = game ? !!GAME_PALETAS[game.id] : false;
  const [skin, elegirSkin] = useSkin();

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const handleRef = useRef<GameHandle | null>(null);
  // Resumen de la última partida terminada. En un ref y no en estado: solo se
  // lee al registrarla, no hace falta que provoque un render.
  const summaryRef = useRef<GameOverSummary | null>(null);
  // Segunda barrera contra el registro duplicado: la primera es la guardia de
  // end() dentro del motor. Se levanta al empezar cada partida.
  const registradaRef = useRef(false);

  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [engineLevel, setEngineLevel] = useState(1);
  const [paused, setPaused] = useState(false);
  const [over, setOver] = useState(false);
  const [name, setName] = useState(user ? user.name : "INVITADO");
  const [saved, setSaved] = useState(false);
  // Solo para juegos con motor: la partida no corre hasta pulsar ESPACIO.
  const [started, setStarted] = useState(false);
  // Estado del registro en Supabase de la partida recién terminada.
  const [cloudSave, setCloudSave] = useState<"idle" | "saving" | SaveResult>(
    "idle",
  );

  // Con motor real el nivel lo dice el juego; en la simulación se deriva del
  // score (uno cada 2500 puntos), como hasta ahora.
  const level = engine ? engineLevel : 1 + Math.floor(score / 2500);

  // Bucle de puntuación falso. Solo para los juegos sin motor.
  useEffect(() => {
    if (engine || over || paused) return;
    const t = setInterval(
      () => setScore((s) => s + Math.floor(10 + Math.random() * 90)),
      220,
    );
    return () => clearInterval(t);
  }, [engine, over, paused]);

  // Ciclo de vida del juego real. destroy() en el cleanup es lo que evita que
  // queden bucles corriendo al navegar o al remontar el efecto en desarrollo.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!engine || !canvas || !game) return;
    const gameId = game.id;

    const handle = engine(
      canvas,
      {
        onScore: setScore,
        onLives: setLives,
        onLevel: setEngineLevel,
        onGameOver: (resumen) => {
          summaryRef.current = resumen;
          setScore(resumen.score);
          setOver(true);

          if (registradaRef.current) return;
          registradaRef.current = true;
          setCloudSave("saving");
          // Sin await: el modal ya está abierto y no debe esperar a la red.
          void saveGameSession({
            gameId,
            score: resumen.score,
            level: resumen.level,
            durationMs: resumen.durationMs,
            reason: resumen.reason,
          }).then(setCloudSave);
        },
      },
      skin,
    );
    handleRef.current = handle;
    // No se arranca aquí: espera al overlay de inicio.

    return () => {
      handle.destroy();
      handleRef.current = null;
    };
    // `skin` entra en las dependencias, así que cambiarlo destruye el motor y
    // lo vuelve a crear. Es inofensivo porque el selector SOLO se renderiza
    // dentro del overlay de arranque (`engine && !started && !over`), y ahí
    // start() todavía no se ha llamado: no hay partida que reiniciar.
    //
    // Esa es la invariante que sostiene esta línea. Si alguna vez el selector
    // sale del overlay —al HUD, a la pantalla de pausa—, cambiar de skin
    // reiniciará la partida en curso, y no hay ninguna prueba que lo detecte.
  }, [engine, game, skin]);

  const togglePause = useCallback(() => {
    const next = !paused;
    setPaused(next);
    if (next) handleRef.current?.pause();
    else handleRef.current?.resume();
  }, [paused]);

  // Arranque: ESPACIO en el overlay.
  useEffect(() => {
    if (!engine || started) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      e.preventDefault(); // que no scrollee la página al empezar
      setStarted(true);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [engine, started]);

  // Elegir aspecto con 1, 2 y 3, solo mientras el overlay está delante. Ningún
  // motor escucha las teclas de dígito, así que no hay conflicto — pero este
  // listener se retira igual en cuanto la partida arranca.
  useEffect(() => {
    if (!engine || !tieneSkins || started) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const i = SKINS.findIndex((_, n) => e.code === `Digit${n + 1}`);
      if (i >= 0) elegirSkin(SKINS[i][0]);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [engine, tieneSkins, started, elegirSkin]);

  useEffect(() => {
    if (!engine || !started) return;
    handleRef.current?.start();
  }, [engine, started]);

  // Escape pausa y reanuda, igual que el botón del HUD.
  useEffect(() => {
    if (!engine || !started || over) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Escape") togglePause();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [engine, started, over, togglePause]);

  // Dejar de mirar la partida la pausa. El navegador ya frena
  // requestAnimationFrame en segundo plano, así que sin esto vuelves a una
  // partida a cámara lenta con la nave a la deriva.
  //
  // Hacen falta los dos eventos: `blur` cubre cambiar de ventana o de
  // aplicación, pero NO se dispara al cambiar de pestaña — ahí lo que salta es
  // `visibilitychange`.
  useEffect(() => {
    if (!engine || !started || over || paused) return;

    const pausar = () => {
      setPaused(true);
      handleRef.current?.pause();
    };
    const onVisibility = () => {
      if (document.hidden) pausar();
    };

    window.addEventListener("blur", pausar);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("blur", pausar);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [engine, started, over, paused]);

  if (!game) notFound();

  // Rendirse cuenta como terminar: se para el juego y se ofrece guardar lo
  // conseguido hasta aquí. Con motor, end() emite el resumen y es ese callback
  // quien abre el modal; sin motor no hay nadie que lo haga.
  const endGame = () => {
    if (handleRef.current) handleRef.current.end();
    else setOver(true);
  };

  const restart = () => {
    setPaused(false);
    setOver(false);
    setSaved(false);
    setCloudSave("idle");
    // Partida nueva, registro nuevo.
    registradaRef.current = false;
    if (handleRef.current) {
      // start() reinicia la partida y vuelve a emitir score, vidas y nivel.
      handleRef.current.start();
    } else {
      setScore(0);
    }
  };

  return (
    <div className="av-player fade-in">
      <div className="player-hud">
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          <div className="hud-stat">
            <div className="l">Jugador</div>
            <div className="v" style={{ color: "var(--ink)" }}>
              {name}
            </div>
          </div>
          <div className="hud-stat">
            <div className="l">Puntuación</div>
            <div className="v">{score.toLocaleString("es-ES")}</div>
          </div>
          <div className="hud-stat lives">
            <div className="l">Vidas</div>
            <div className="v">{"♥ ".repeat(lives).trim() || "—"}</div>
          </div>
          <div className="hud-stat level">
            <div className="l">Nivel</div>
            <div className="v">{String(level).padStart(2, "0")}</div>
          </div>
        </div>
        <div className="hud-actions">
          <button className="btn yellow" onClick={togglePause}>
            {paused ? "REANUDAR" : "PAUSA"}
          </button>
          <button className="btn magenta" onClick={endGame}>
            FIN
          </button>
          <button
            className="btn ghost"
            onClick={() => router.push(`/juego/${game.id}`)}
          >
            SALIR
          </button>
        </div>
      </div>

      <div className="crt">
        <div className="crt-screen">
          {engine ? (
            <canvas
              ref={canvasRef}
              className="game-canvas"
              width={800}
              height={600}
            />
          ) : (
            <div className="game-arena">
              <div className="grid-floor"></div>
              <div className="enemy e1"></div>
              <div className="enemy e2"></div>
              <div className="enemy e3"></div>
              <div className="player-ship"></div>
            </div>
          )}
          {engine && !started && !over && (
            <div
              className="crt-content game-start"
              style={{ background: "rgba(0,0,0,0.72)", zIndex: 6 }}
            >
              <div>
                <div className="pixel neon-cyan" style={{ fontSize: 20 }}>
                  PULSA ESPACIO PARA EMPEZAR
                </div>
                <div className="game-controls mono">
                  {(GAME_CONTROLS[game.id] ?? []).map(([tecla, accion]) => (
                    <div key={tecla}>
                      <span>{tecla}</span> {accion}
                    </div>
                  ))}
                </div>
                {tieneSkins && (
                  <div className="game-skins">
                    <div className="mono game-skins-label">ASPECTO</div>
                    <div className="game-skins-opciones">
                      {SKINS.map(([id, etiqueta], i) => (
                        <button
                          key={id}
                          className={"btn" + (id === skin ? "" : " ghost")}
                          onClick={() => elegirSkin(id)}
                        >
                          {i + 1} · {etiqueta}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
          {paused && (
            <div
              className="crt-content"
              style={{ background: "rgba(0,0,0,0.6)", zIndex: 5 }}
            >
              <div>
                <div className="pixel neon-yellow" style={{ fontSize: 22 }}>
                  EN PAUSA
                </div>
                <div
                  className="mono"
                  style={{
                    fontSize: 11,
                    color: "var(--ink-dim)",
                    marginTop: 10,
                    letterSpacing: "0.16em",
                  }}
                >
                  PULSA REANUDAR PARA CONTINUAR
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="crt-bottom">
          <span className="led">SEÑAL OK</span>
          <span>{game.title} · CRT-83 · 60 HZ</span>
          <span>CARGA · 1MB</span>
        </div>
      </div>

      {engine && (
        <div className="game-keyboard-note">
          {game.title} SE JUEGA CON TECLADO. CONÉCTATE DESDE UN ORDENADOR PARA
          JUGAR.
        </div>
      )}

      {over && (
        <div className="modal-bd">
          <div className="modal">
            <h2>FIN DEL JUEGO</h2>
            <div className="final-label">PUNTUACIÓN FINAL</div>
            <div className="final">{score.toLocaleString("es-ES")}</div>
            {/* Con motor y sesión la partida se registra sola: el nombre lo
                pone el perfil, así que no se piden iniciales. Los juegos
                simulados no registran nada y siguen con el guardado local. */}
            {engine && user ? (
              <>
                {cloudSave === "saving" && (
                  <div className="cloud-status">GUARDANDO PARTIDA…</div>
                )}
                {cloudSave === "saved" && (
                  <div className="toast-saved">
                    ▸ PARTIDA REGISTRADA COMO {user.name}_
                  </div>
                )}
                {(cloudSave === "error" || cloudSave === "anonymous") && (
                  <div className="cloud-status error">
                    NO SE PUDO GUARDAR EN LA NUBE
                  </div>
                )}
              </>
            ) : !saved ? (
              <>
                <div className="input-row">
                  <input
                    value={name}
                    onChange={(e) =>
                      setName(e.target.value.toUpperCase().slice(0, 10))
                    }
                    placeholder="TUS INICIALES"
                  />
                  <button
                    className="btn yellow"
                    onClick={() => {
                      saveScore({ game: game.id, score, name });
                      setSaved(true);
                    }}
                  >
                    GUARDAR PUNTUACIÓN
                  </button>
                </div>
                {engine && (
                  <div className="cloud-status">
                    SIN SESIÓN: SOLO SE GUARDA EN ESTE NAVEGADOR
                  </div>
                )}
              </>
            ) : (
              <div className="toast-saved">▸ PUNTUACIÓN GUARDADA_</div>
            )}
            <div className="actions">
              <button className="btn" onClick={restart}>
                JUGAR DE NUEVO
              </button>
              <button
                className="btn magenta"
                onClick={() => router.push("/biblioteca")}
              >
                VOLVER AL VAULT
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
