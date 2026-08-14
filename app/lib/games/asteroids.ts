// ===== app/lib/games/asteroids.ts =====
// Motor de ROCAS (Asteroids), portado de
// references/templates/started-games/02-asteroids/game.js.
//
// Diferencias con el original, todas deliberadas:
//  - Sin variables globales de módulo: el estado de partida vive en el closure
//    de createAsteroidsGame (paso 4). En Next un global sobrevive entre
//    montajes y se convierte en una fuga al navegar entre juegos.
//  - Las entidades reciben el `ctx` en draw() en vez de capturarlo del módulo,
//    así el motor no depende de que exista un canvas al importarlo.
//  - Sin HUD ni overlay dentro del canvas: de eso se encarga la plataforma.

import { conAlfa, paletaDe, type FichaDeSkins } from "./skins";
import type { GameFactory, GameOverReason, GameOverSummary } from "./types";

// ── Constantes ────────────────────────────────────────────────────────────────

// Resolución lógica. El ajuste al contenedor es puramente CSS: la física, el
// envolvimiento de bordes y las colisiones siempre trabajan en 800×600.
export const W = 800;
export const H = 600;

// Indexados por tamaño de asteroide: 1 pequeño, 2 mediano, 3 grande.
const RADII = [0, 16, 30, 50];
const SPEEDS = [0, 85, 55, 32];
const POINTS = [0, 100, 50, 20];

// ── Paleta ────────────────────────────────────────────────────────────────────

// La paleta de referencia. Son los mismos valores que los tokens de :root en
// app/globals.css (--cyan, --yellow, --ink, --magenta), copiados aquí porque el
// canvas no entiende de variables CSS: si el tema cambia, hay que tocar los dos
// sitios.
//
// Cada color se guarda TAL COMO llega al contexto, con su alfa incluido si es
// fijo. El alfa variable —el de las estelas que se apagan— lo pone conAlfa() en
// el punto de dibujo.
const PALETA_NEON = {
  fondo: "#000",
  nave: "#00f5ff", // --cyan
  propulsor: "rgba(245,255,0,0.85)", // --yellow
  bala: "#e6e9ff", // --ink
  roca: "rgba(230,233,255,0.75)", // --ink atenuado
  particula: "#f5ff00", // --yellow, se desvanece con conAlfa()
  mejora: "#ff006e", // --magenta
} as const;

export type RolRocas = keyof typeof PALETA_NEON;
export type PaletaRocas = Readonly<Record<RolRocas, string>>;

export const SKINS_ROCAS: FichaDeSkins<RolRocas> = {
  roles: {
    fondo: { clase: "superficie" },
    nave: { clase: "jugable" },
    // El propulsor y las partículas son efectos: si se pierden un fotograma no
    // se pierde la partida, así que no se les exige el mínimo de lo jugable.
    propulsor: { clase: "decorado" },
    bala: { clase: "jugable" },
    roca: { clase: "jugable" },
    particula: { clase: "decorado" },
    mejora: { clase: "jugable" },
  },
  // La bala queda fuera del grupo a propósito. En el arcade original es del
  // mismo blanco que la nave y se distingue por tamaño y movimiento, no por
  // color; exigirle un salto la haría imposible en el skin clásico sin que
  // nadie viese mejor.
  grupos: [["nave", "roca", "mejora"]],
  paletas: {
    neon: PALETA_NEON,

    // Monitor de fósforo ámbar: un solo tono y todo el trabajo hecho por la
    // luminancia, que es lo que hace que se lea como un monitor y no como un
    // neón naranja.
    retro: {
      fondo: "#000",
      nave: "#ffcf70",
      propulsor: "rgba(255,176,0,0.85)",
      bala: "#fffbe6",
      roca: "#c07800",
      particula: "#ffb000",
      mejora: "#ff8c1a",
    },

    // Asteroids era vectorial monocromo: blanco sobre negro. La roca baja a
    // gris para separarse de la nave, y la mejora toma el azul que Asteroids
    // Deluxe (1981) trajo al añadir color — el original no tenía power-ups.
    clasico: {
      fondo: "#000",
      nave: "#ffffff",
      propulsor: "rgba(255,255,255,0.85)",
      bala: "#ffffff",
      roca: "#b9b9b9",
      particula: "#ffffff",
      mejora: "#4d9fff",
    },
  },
};

const POWERUP_DROP_CHANCE = 0.15;
const POWERUP_DURATION = 5; // segundos de triple disparo
const POWERUP_TTL = 12; // segundos antes de que caduque sin recoger
const TRIPLE_SPREAD = 0.18; // radianes de apertura entre balas

// ── Utilidades ────────────────────────────────────────────────────────────────

interface Point {
  x: number;
  y: number;
}

// El espacio es toroidal: salir por un borde es entrar por el opuesto.
const wrap = (v: number, max: number) => ((v % max) + max) % max;
const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const rand = (min: number, max: number) => min + Math.random() * (max - min);
const randInt = (min: number, max: number) => Math.floor(rand(min, max + 1));

// ── Teclado ───────────────────────────────────────────────────────────────────

// Las teclas del juego que además hacen scroll en la página. Se les corta el
// comportamiento por defecto, pero solo mientras el motor está enganchado:
// fuera de la partida el teclado vuelve a funcionar con normalidad.
const PREVENT_DEFAULT = new Set([
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "Space",
]);

export class Input {
  private held: Record<string, boolean> = {};
  private fresh: Record<string, boolean> = {};
  private attached = false;

  private onKeyDown = (e: KeyboardEvent) => {
    if (PREVENT_DEFAULT.has(e.code)) e.preventDefault();
    // `fresh` solo se marca en la transición de suelta a pulsada, para que
    // mantener el espacio no dispare en cada frame.
    if (!this.held[e.code]) this.fresh[e.code] = true;
    this.held[e.code] = true;
  };

  private onKeyUp = (e: KeyboardEvent) => {
    if (PREVENT_DEFAULT.has(e.code)) e.preventDefault();
    this.held[e.code] = false;
  };

  attach() {
    if (this.attached) return;
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    this.attached = true;
  }

  detach() {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    this.attached = false;
    this.clear();
  }

  isHeld(code: string): boolean {
    return !!this.held[code];
  }

  // Se consume al leerla: devuelve true una sola vez por pulsación.
  wasPressed(code: string): boolean {
    const value = !!this.fresh[code];
    this.fresh[code] = false;
    return value;
  }

  // Al pausar conviene olvidar lo pulsado, o al reanudar la nave sale
  // acelerando con una tecla que el jugador ya soltó.
  clear() {
    this.held = {};
    this.fresh = {};
  }
}

// ── Bala ──────────────────────────────────────────────────────────────────────

export class Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ttl = 1.1;
  radius = 2;
  dead = false;

  constructor(x: number, y: number, angle: number) {
    this.x = x;
    this.y = y;
    const SPEED = 520;
    this.vx = Math.cos(angle) * SPEED;
    this.vy = Math.sin(angle) * SPEED;
  }

  update(dt: number) {
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw(ctx: CanvasRenderingContext2D, paleta: PaletaRocas) {
    ctx.fillStyle = paleta.bala;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ── Asteroide ─────────────────────────────────────────────────────────────────

export class Asteroid {
  x: number;
  y: number;
  size: number;
  radius: number;
  vx: number;
  vy: number;
  rot: number;
  rotSpeed: number;
  verts: [number, number][] = [];
  dead = false;

  constructor(x: number, y: number, size = 3) {
    this.x = x;
    this.y = y;
    this.size = size;
    this.radius = RADII[size];

    const angle = rand(0, Math.PI * 2);
    const speed = SPEEDS[size] + rand(-15, 15);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.rotSpeed = rand(-1.2, 1.2);
    this.rot = rand(0, Math.PI * 2);

    // Polígono irregular: cada asteroide tiene su propia silueta.
    const n = randInt(8, 13);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const r = this.radius * rand(0.6, 1.0);
      this.verts.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
  }

  get points(): number {
    return POINTS[this.size];
  }

  update(dt: number) {
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
    this.rot += this.rotSpeed * dt;
  }

  // Los pequeños (tamaño 1) no se parten.
  split(): Asteroid[] {
    if (this.size <= 1) return [];
    return [
      new Asteroid(this.x, this.y, this.size - 1),
      new Asteroid(this.x, this.y, this.size - 1),
    ];
  }

  draw(ctx: CanvasRenderingContext2D, paleta: PaletaRocas) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot);
    ctx.strokeStyle = paleta.roca;
    ctx.lineWidth = 1.5;
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(this.verts[0][0], this.verts[0][1]);
    for (let i = 1; i < this.verts.length; i++)
      ctx.lineTo(this.verts[i][0], this.verts[i][1]);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }
}

// ── Power-up (triple disparo) ─────────────────────────────────────────────────

export class PowerUp {
  static readonly DURATION = POWERUP_DURATION;
  static readonly DROP_CHANCE = POWERUP_DROP_CHANCE;

  x: number;
  y: number;
  vx: number;
  vy: number;
  radius = 12;
  ttl = POWERUP_TTL;
  dead = false;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
    const angle = rand(0, Math.PI * 2);
    const speed = rand(20, 40);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
  }

  update(dt: number) {
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw(ctx: CanvasRenderingContext2D, paleta: PaletaRocas) {
    // Parpadea los dos últimos segundos para avisar de que se va.
    if (this.ttl < 2 && Math.floor(this.ttl * 8) % 2 === 0) return;

    const pulse = 0.85 + Math.sin(performance.now() / 150) * 0.15;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(Math.PI / 4);
    ctx.strokeStyle = paleta.mejora;
    ctx.lineWidth = 2;
    const r = this.radius * pulse;
    ctx.strokeRect(-r, -r, r * 2, r * 2);
    ctx.restore();

    ctx.fillStyle = paleta.mejora;
    ctx.font = "bold 12px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("3x", this.x, this.y);
  }
}

// ── Nave ──────────────────────────────────────────────────────────────────────

export class Ship {
  x = W / 2;
  y = H / 2;
  angle = -Math.PI / 2; // mirando hacia arriba
  vx = 0;
  vy = 0;
  radius = 12;
  thrusting = false;
  invincible = 3; // segundos de gracia al aparecer
  shootCooldown = 0;
  dead = false;
  // Fuera de reset() a propósito: el triple disparo sobrevive a reaparecer y a
  // cambiar de nivel, igual que en el original.
  tripleShot = 0;

  reset() {
    this.x = W / 2;
    this.y = H / 2;
    this.angle = -Math.PI / 2;
    this.vx = 0;
    this.vy = 0;
    this.thrusting = false;
    this.invincible = 3;
    this.shootCooldown = 0;
    this.dead = false;
  }

  update(dt: number, input: Input) {
    if (this.dead) return;
    if (this.invincible > 0) this.invincible -= dt;
    if (this.shootCooldown > 0) this.shootCooldown -= dt;
    if (this.tripleShot > 0) this.tripleShot -= dt;

    const ROT = 3.5; // rad/s
    const THRUST = 260; // px/s²
    const DRAG = 0.987;

    if (input.isHeld("ArrowLeft")) this.angle -= ROT * dt;
    if (input.isHeld("ArrowRight")) this.angle += ROT * dt;

    this.thrusting = input.isHeld("ArrowUp");
    if (this.thrusting) {
      this.vx += Math.cos(this.angle) * THRUST * dt;
      this.vy += Math.sin(this.angle) * THRUST * dt;
    }

    // Sin fricción real: el drag es lo que evita que la nave sea ingobernable.
    this.vx *= DRAG;
    this.vy *= DRAG;
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
  }

  tryShoot(): Bullet[] {
    if (this.shootCooldown > 0 || this.dead) return [];
    this.shootCooldown = 0.2;

    const NOSE = 21;
    const ox = this.x + Math.cos(this.angle) * NOSE;
    const oy = this.y + Math.sin(this.angle) * NOSE;

    if (this.tripleShot > 0) {
      return [
        new Bullet(ox, oy, this.angle - TRIPLE_SPREAD),
        new Bullet(ox, oy, this.angle),
        new Bullet(ox, oy, this.angle + TRIPLE_SPREAD),
      ];
    }
    return [new Bullet(ox, oy, this.angle)];
  }

  draw(ctx: CanvasRenderingContext2D, paleta: PaletaRocas) {
    if (this.dead) return;
    // Parpadeo mientras es invencible tras reaparecer.
    if (this.invincible > 0 && Math.floor(this.invincible * 8) % 2 === 0)
      return;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    ctx.strokeStyle = paleta.nave;
    ctx.lineWidth = 1.5;
    ctx.lineJoin = "round";

    // Silueta clásica: triángulo con muesca trasera.
    ctx.beginPath();
    ctx.moveTo(20, 0); // nariz
    ctx.lineTo(-12, -9); // ala izquierda
    ctx.lineTo(-7, 0); // muesca
    ctx.lineTo(-12, 9); // ala derecha
    ctx.closePath();
    ctx.stroke();

    // Llama del propulsor, intermitente para que titile.
    if (this.thrusting && Math.random() > 0.35) {
      ctx.beginPath();
      ctx.moveTo(-8, -4);
      ctx.lineTo(-8 - rand(6, 14), 0);
      ctx.lineTo(-8, 4);
      ctx.strokeStyle = paleta.propulsor;
      ctx.stroke();
    }

    ctx.restore();
  }
}

// ── Partícula de explosión ────────────────────────────────────────────────────

export class Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  ttl: number;
  dead = false;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
    const angle = rand(0, Math.PI * 2);
    const speed = rand(30, 130);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.life = rand(0.4, 1.1);
    this.ttl = this.life;
  }

  // Las partículas no envuelven: se apagan donde caen.
  update(dt: number) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw(ctx: CanvasRenderingContext2D, paleta: PaletaRocas) {
    const alpha = this.ttl / this.life;
    ctx.strokeStyle = conAlfa(paleta.particula, alpha);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(this.x - this.vx * 0.05, this.y - this.vy * 0.05);
    ctx.stroke();
  }
}

// ── Motor ─────────────────────────────────────────────────────────────────────

// `skin` lleva valor por defecto y no interrogante: montar el motor sin elegir
// nada tiene que pintar exactamente lo mismo que montarlo con "neon", y eso lo
// comprueba verificaSkins() comparando las dos secuencias de color.
export const createAsteroidsGame: GameFactory = (
  canvas,
  callbacks,
  skin = "neon",
) => {
  const context2d = canvas.getContext("2d");
  if (!context2d) throw new Error("ROCAS necesita un canvas 2D");
  // Con tipo explícito: el estrechamiento del guard no llega hasta draw(),
  // que es un closure.
  const ctx: CanvasRenderingContext2D = context2d;

  // Se resuelve una vez al montar. La paleta no es estado del módulo: vive en
  // el closure, como todo lo demás, así que dos motores con skins distintos no
  // se pisan.
  const paleta = paletaDe(SKINS_ROCAS, skin);

  const input = new Input();

  // Todo el estado de partida vive aquí dentro: dos instancias del motor no se
  // pisan, y al destruirlo se va con el closure.
  let ship = new Ship();
  let bullets: Bullet[] = [];
  let asteroids: Asteroid[] = [];
  let particles: Particle[] = [];
  let powerUps: PowerUp[] = [];
  let score = 0;
  let lives = 3;
  let level = 1;
  let state: "playing" | "dead" | "gameover" | "paused" = "playing";
  let deadTimer = 0;
  let powerUpSpawned = false;
  let killsSinceSpawn = 0;
  let rafId: number | null = null;
  let lastTime: number | null = null;
  // Tiempo jugado, no tiempo transcurrido: se acumula con el dt del bucle, que
  // deja de correr al pausar. Las pausas quedan fuera sin lógica extra.
  let elapsedMs = 0;

  // Los callbacks se emiten solo cuando el valor cambia: son eventos discretos,
  // no algo que deba dispararse en cada frame.
  function setScore(next: number) {
    if (next === score) return;
    score = next;
    callbacks.onScore(score);
  }

  function setLives(next: number) {
    if (next === lives) return;
    lives = next;
    callbacks.onLives(lives);
  }

  function setLevel(next: number) {
    if (next === level) return;
    level = next;
    callbacks.onLevel(level);
  }

  function summary(reason: GameOverReason): GameOverSummary {
    return { score, level, durationMs: Math.round(elapsedMs), reason };
  }

  function spawnAsteroids(count: number) {
    const SAFE_DIST = 130; // no aparecen encima de la nave
    for (let i = 0; i < count; i++) {
      let x: number, y: number;
      do {
        x = rand(0, W);
        y = rand(0, H);
      } while (Math.hypot(x - W / 2, y - H / 2) < SAFE_DIST);
      asteroids.push(new Asteroid(x, y, 3));
    }
  }

  function initGame() {
    ship = new Ship();
    bullets = [];
    asteroids = [];
    particles = [];
    powerUps = [];
    powerUpSpawned = false;
    killsSinceSpawn = 0;
    deadTimer = 0;
    elapsedMs = 0;
    state = "playing";
    spawnAsteroids(4);

    // Se emiten sin pasar por los setters para que el HUD se reinicie aunque
    // los valores coincidan con los de la partida anterior.
    score = 0;
    lives = 3;
    level = 1;
    callbacks.onScore(score);
    callbacks.onLives(lives);
    callbacks.onLevel(level);
  }

  function nextLevel() {
    setLevel(level + 1);
    bullets = [];
    particles = [];
    powerUps = [];
    powerUpSpawned = false;
    killsSinceSpawn = 0;
    ship.reset();
    spawnAsteroids(3 + level);
  }

  function explode(x: number, y: number, count = 8) {
    for (let i = 0; i < count; i++) particles.push(new Particle(x, y));
  }

  function killShip() {
    explode(ship.x, ship.y, 14);
    ship.dead = true;
    setLives(lives - 1);

    if (lives <= 0) {
      state = "gameover";
      callbacks.onGameOver(summary("game_over"));
    } else {
      state = "dead";
      deadTimer = 2;
    }
  }

  function update(dt: number) {
    if (state === "gameover" || state === "paused") return;

    // Cuenta también el estado "dead": los dos segundos hasta reaparecer son
    // parte de la partida.
    elapsedMs += dt * 1000;

    // Tras morir, los asteroides siguen moviéndose mientras se espera a
    // reaparecer; la nave no responde.
    if (state === "dead") {
      deadTimer -= dt;
      particles.forEach((p) => p.update(dt));
      particles = particles.filter((p) => !p.dead);
      asteroids.forEach((a) => a.update(dt));
      if (deadTimer <= 0) {
        state = "playing";
        ship.reset();
      }
      return;
    }

    if (input.wasPressed("Space")) bullets.push(...ship.tryShoot());

    ship.update(dt, input);
    bullets.forEach((b) => b.update(dt));
    asteroids.forEach((a) => a.update(dt));
    particles.forEach((p) => p.update(dt));
    powerUps.forEach((p) => p.update(dt));

    bullets = bullets.filter((b) => !b.dead);
    particles = particles.filter((p) => !p.dead);
    powerUps = powerUps.filter((p) => !p.dead);

    // Nave vs power-up
    for (const p of powerUps) {
      if (!p.dead && dist(ship, p) < ship.radius + p.radius) {
        p.dead = true;
        ship.tripleShot = PowerUp.DURATION;
      }
    }

    // Bala vs asteroide
    const spawned: Asteroid[] = [];
    for (const b of bullets) {
      for (const a of asteroids) {
        if (a.dead || b.dead || dist(b, a) >= a.radius) continue;

        b.dead = true;
        a.dead = true;
        setScore(score + a.points);
        explode(a.x, a.y, a.size * 5);
        spawned.push(...a.split());

        // Solo cae un power-up por nivel: al azar, pero garantizado al quinto
        // asteroide para que no dependa de la suerte.
        if (!powerUpSpawned) {
          killsSinceSpawn++;
          if (killsSinceSpawn >= 5 || Math.random() < PowerUp.DROP_CHANCE) {
            powerUps.push(new PowerUp(a.x, a.y));
            powerUpSpawned = true;
          }
        }
      }
    }
    asteroids = asteroids.filter((a) => !a.dead).concat(spawned);
    bullets = bullets.filter((b) => !b.dead);

    // Nave vs asteroide. El 0.82 es holgura a favor del jugador.
    if (ship.invincible <= 0) {
      for (const a of asteroids) {
        if (dist(ship, a) < ship.radius + a.radius * 0.82) {
          killShip();
          break;
        }
      }
    }

    if (asteroids.length === 0) nextLevel();
  }

  // Sin HUD ni overlay: la puntuación, las vidas, el nivel y el fin de partida
  // los pinta la plataforma a partir de los callbacks.
  function draw() {
    ctx.fillStyle = paleta.fondo;
    ctx.fillRect(0, 0, W, H);

    particles.forEach((p) => p.draw(ctx, paleta));
    asteroids.forEach((a) => a.draw(ctx, paleta));
    powerUps.forEach((p) => p.draw(ctx, paleta));
    bullets.forEach((b) => b.draw(ctx, paleta));
    ship.draw(ctx, paleta);
  }

  function loop(ts: number) {
    // dt capado: volver de otra pestaña no debe avanzar el juego de golpe.
    const dt = lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, 0.05);
    lastTime = ts;

    update(dt);
    draw();

    if (state === "gameover") {
      rafId = null;
      return;
    }
    rafId = requestAnimationFrame(loop);
  }

  function stopLoop() {
    if (rafId !== null) cancelAnimationFrame(rafId);
    rafId = null;
    lastTime = null;
  }

  return {
    start() {
      stopLoop();
      initGame();
      input.attach();
      rafId = requestAnimationFrame(loop);
    },

    pause() {
      if (state !== "playing" && state !== "dead") return;
      state = "paused";
      // Olvidar lo pulsado: si no, al reanudar la nave sale acelerando con una
      // tecla que el jugador ya soltó.
      input.clear();
      stopLoop();
      draw();
    },

    resume() {
      if (state !== "paused") return;
      state = deadTimer > 0 ? "dead" : "playing";
      rafId = requestAnimationFrame(loop);
    },

    // Rendirse. No hace nada si la partida ya había terminado: es la guardia
    // que evita emitir el fin dos veces y registrar la partida por duplicado.
    end() {
      if (state === "gameover") return;
      state = "gameover";
      stopLoop();
      callbacks.onGameOver(summary("surrender"));
    },

    destroy() {
      stopLoop();
      input.detach();
    },
  };
};

export { TRIPLE_SPREAD, dist, rand, wrap };
