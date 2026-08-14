// ===== tests/harness/contraste.ts =====
// Aritmética de color para verificar que un skin se lee sobre el fondo oscuro
// del portal. Vive solo en las pruebas: no entra en el bundle.
//
// "Que luzca bien en modo oscuro" es una opinión hasta que alguien la mide. Lo
// que se mide aquí es el ratio de contraste de WCAG 2.2, y hay tres detalles
// sin los cuales la medición sería teatro:
//
//  1. Se compone el alfa sobre el fondo ANTES de medir. Un
//     rgba(0,255,136,0.06) no es verde brillante: sobre negro es #00190d, ratio
//     1.07:1. Medir el color sin componer aprobaría media docena de roles que
//     en pantalla no se ven.
//  2. La referencia es la superficie real, no el negro del canvas. Las piezas
//     de CAÍDA caen sobre el pozo (#0f0f18) y la rana de RANARIA nada sobre el
//     agua; medir contra negro las aprueba de más.
//  3. Para los roles de clase "superficie" el umbral es un MÁXIMO. Si un skin
//     sube el fondo por encima de 2:1 el marco CRT deja de leerse como marco.

import { componentesDeColor } from "@/app/lib/games/skins";

export type Rgb = [number, number, number];

// Cualquier color que sepa escribir un motor: #rgb, #rrggbb, rgb() y rgba().
// Lanza en vez de devolver null a propósito: un color que el harness no sabe
// leer es un color que no se está verificando, y eso tiene que romper la
// prueba, no pasar en silencio.
export function aRgba(css: string): [number, number, number, number] {
  const rgba = componentesDeColor(css);
  if (!rgba) throw new Error(`color que el harness no sabe leer: ${css}`);
  return rgba;
}

// Composición alfa clásica: el color por encima, la superficie por debajo. La
// superficie se asume opaca — y lo es, porque la de más abajo siempre es el
// fondo del canvas.
export function sobre(color: string, superficie: string): Rgb {
  const [r, g, b, a] = aRgba(color);
  const [sr, sg, sb] = aRgba(superficie);
  return [r * a + sr * (1 - a), g * a + sg * (1 - a), b * a + sb * (1 - a)];
}

// Luminancia relativa de sRGB, tal como la define WCAG.
export function luminancia([r, g, b]: Rgb): number {
  const canal = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
}

// Ratio de contraste entre un color y la superficie sobre la que se pinta, con
// el alfa ya compuesto. Va de 1:1 (invisible) a 21:1 (blanco sobre negro).
export function contraste(color: string, superficie: string): number {
  const a = luminancia(sobre(color, superficie));
  const b = luminancia(sobre(superficie, superficie));
  const [claro, oscuro] = a > b ? [a, b] : [b, a];
  return (claro + 0.05) / (oscuro + 0.05);
}

// Tono en grados (0-360) y saturación (0-1), del modelo HSL. Se usan solo para
// decidir si dos colores son distinguibles.
export function tonoYSaturacion(
  color: string,
  superficie: string,
): [number, number] {
  const [r, g, b] = sobre(color, superficie).map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (d === 0) return [0, 0];

  let h: number;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h = (h * 60 + 360) % 360;

  const l = (max + min) / 2;
  const s = d / (1 - Math.abs(2 * l - 1) || 1);
  return [h, s];
}

// Dos colores del mismo grupo son distinguibles si se separan en luminancia o
// en tono. Los dos caminos son necesarios: un skin monocromo solo puede jugar
// con la luminancia (las ocho piezas de CAÍDA en ámbar), y uno de colores puede
// tener dos tonos muy distintos con la misma luminancia (el cian y el magenta
// del neón).
export const SALTO_DE_LUMINANCIA = 1.3;
export const SALTO_DE_TONO = 30; // grados
export const SATURACION_MINIMA = 0.4;

export function distinguibles(
  a: string,
  b: string,
  superficie: string,
): boolean {
  const la = luminancia(sobre(a, superficie));
  const lb = luminancia(sobre(b, superficie));
  const [claro, oscuro] = la > lb ? [la, lb] : [lb, la];
  if ((claro + 0.05) / (oscuro + 0.05) >= SALTO_DE_LUMINANCIA) return true;

  const [ha, sa] = tonoYSaturacion(a, superficie);
  const [hb, sb] = tonoYSaturacion(b, superficie);
  if (sa < SATURACION_MINIMA || sb < SATURACION_MINIMA) return false;
  const delta = Math.abs(ha - hb);
  return Math.min(delta, 360 - delta) >= SALTO_DE_TONO;
}

// Para los mensajes de fallo: "4.83:1" se lee mucho mejor que 4.8271604938.
export function ratio(valor: number): string {
  return `${valor.toFixed(2)}:1`;
}
