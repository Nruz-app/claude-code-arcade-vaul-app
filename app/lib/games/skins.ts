// ===== app/lib/games/skins.ts =====
// Los tres aspectos que puede tener un juego. Es la forma compartida; las
// paletas concretas las declara cada motor, porque ROCAS necesita 7 colores y
// RANARIA 26: un vocabulario de roles común sería o inservible o vacío.
//
// El motor recibe el skin por el tercer parámetro de GameFactory y resuelve su
// propia paleta. El reproductor nunca toca el canvas, así que no hay ningún
// otro sitio desde donde se pueda aplicar un color.

// "neon" es el aspecto histórico del portal y el que se usa si nadie elige:
// los cinco motores lo declaran como valor por defecto de su tercer parámetro.
export type SkinId = "neon" | "retro" | "clasico";

export const SKIN_POR_DEFECTO: SkinId = "neon";

// Lo que enseña el selector del overlay de arranque, en orden.
export const SKINS: readonly (readonly [SkinId, string])[] = [
  ["neon", "NEÓN"],
  ["retro", "RETRO"],
  ["clasico", "CLÁSICO"],
];

export function esSkin(valor: unknown): valor is SkinId {
  return valor === "neon" || valor === "retro" || valor === "clasico";
}

// ── Exigencia de contraste ────────────────────────────────────────────────────

// Cuánto contraste tiene que tener un rol para que "se vea bien en oscuro" deje
// de ser una opinión. Los umbrales salen de WCAG 2.2 y los mide
// tests/harness/skins.ts contra la superficie real sobre la que se pinta.
//
// El mínimo de un elemento de juego es 3:1 (SC 1.4.11, componentes gráficos) y
// no 4.5:1 (SC 1.4.3, que es de texto). No es laxitud: con 4.5:1 una rampa
// monocroma de ocho pasos no cabe por debajo del máximo físico de 21:1, y CAÍDA
// tiene ocho piezas que distinguir.
export type ClaseDeRol =
  | "texto" // >= 4.5:1 — solo el panel lateral de CAÍDA
  | "jugable" // >= 3:1  — lo que el jugador tiene que ver y esquivar
  | "decorado" // >= 1.5:1 — rejillas, bordes, guías, estelas
  | "superficie"; // <= 2:1  — es un MÁXIMO: el fondo tiene que seguir siendo fondo

export const MINIMOS: Readonly<Record<ClaseDeRol, number>> = {
  texto: 4.5,
  jugable: 3,
  decorado: 1.5,
  superficie: 2, // se compara con <=, ver arriba
};

export interface ExigenciaDeRol {
  clase: ClaseDeRol;
  // Rol de la superficie sobre la que se pinta. Sin esto se mediría todo contra
  // el negro del canvas y saldrían aprobados falsos: las piezas de CAÍDA caen
  // sobre el pozo (#0f0f18) y la rana de RANARIA nada sobre el agua.
  sobre?: string;
}

// ── La ficha de un motor ──────────────────────────────────────────────────────

export interface FichaDeSkins<R extends string> {
  roles: Readonly<Record<R, ExigenciaDeRol>>;
  // Conjuntos que el jugador tiene que poder distinguir ENTRE SÍ. Se declaran
  // por banda de pantalla y no globalmente: en RANARIA los troncos y los coches
  // nunca comparten franja, así que no compiten.
  grupos: readonly (readonly R[])[];
  paletas: Readonly<Record<SkinId, Readonly<Record<R, string>>>>;
}

// Un motor declara su ficha con la paleta neón como fuente del tipo:
//
//   const PALETA_NEON = { fondo: "#000", nave: "#00f5ff" } as const;
//   export type RolRocas = keyof typeof PALETA_NEON;
//
// así TypeScript obliga a que "retro" y "clasico" definan todos los roles. Un
// rol olvidado es un error de compilación y no un elemento invisible que
// alguien descubre jugando.

// Resuelve la paleta de un skin, cayendo a neón si llega un valor imposible
// (localStorage manipulado, por ejemplo). Nunca devuelve undefined: un motor sin
// paleta no dibuja nada.
export function paletaDe<R extends string>(
  ficha: FichaDeSkins<R>,
  skin: SkinId,
): Readonly<Record<R, string>> {
  return ficha.paletas[skin] ?? ficha.paletas.neon;
}

// ── Alfa ──────────────────────────────────────────────────────────────────────

// La paleta guarda el color TAL COMO llega al contexto, con su alfa incluido si
// es fijo. Esto es lo que permite medir el contraste de verdad: un
// rgba(0,255,136,0.06) sobre negro es #00190d, no verde brillante.
//
// conAlfa() es para el alfa VARIABLE, el que se desvanece con el tiempo (las
// estelas de las partículas). Reproduce el formato exacto que usaban los
// motores antes de esto —"rgba(245,255,0,0.85)", sin espacios y con dos
// decimales—, que es lo que mantiene la cero-regresión de neón.
export function conAlfa(color: string, alfa: number): string {
  const rgb = componentes(color);
  if (!rgb) return color;
  const a = Math.max(0, Math.min(1, alfa * rgb[3]));
  return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a.toFixed(2)})`;
}

// #rgb, #rrggbb y rgba()/rgb(). Devuelve null en cualquier otro caso, que es lo
// que hace que conAlfa() deje pasar el color intacto en vez de romper el dibujo.
function componentes(css: string): [number, number, number, number] | null {
  const s = css.trim();

  if (s.startsWith("#")) {
    const hex = s.slice(1);
    if (hex.length === 3) {
      const [r, g, b] = [...hex].map((c) => parseInt(c + c, 16));
      return [r, g, b, 1];
    }
    if (hex.length === 6) {
      return [
        parseInt(hex.slice(0, 2), 16),
        parseInt(hex.slice(2, 4), 16),
        parseInt(hex.slice(4, 6), 16),
        1,
      ];
    }
    return null;
  }

  const m = s.match(/^rgba?\(([^)]+)\)$/i);
  if (!m) return null;
  const partes = m[1].split(",").map((p) => Number(p.trim()));
  if (partes.length < 3 || partes.some(Number.isNaN)) return null;
  return [partes[0], partes[1], partes[2], partes.length > 3 ? partes[3] : 1];
}

// Se exporta para tests/harness/contraste.ts, que necesita el mismo parseo.
export { componentes as componentesDeColor };
