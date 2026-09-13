import type { NextConfig } from "next";

// ===== Cabeceras de seguridad (SPEC 22) =====
// Cinco cadenas fijas: no dependen de la petición, así que no pueden romper un
// render ni forzar el paso a dinámico de ninguna ruta. Van aquí y no en
// `proxy.ts` a propósito: las cabeceras de `headers()` se aplican ANTES del
// sistema de archivos, así que cubren también lo que se sirve de `public/`
// (los mp3 y el PNG de sprites), que el `matcher` de Proxy excluye.
//
// Lo que NO hay, y no es un olvido: Content-Security-Policy. Una CSP decente
// para Next necesita un nonce por petición, y ese nonce fuerza render dinámico
// en todas las rutas; sin nonce hay que abrir 'unsafe-inline' para los scripts
// de hidratación, que es la mitad de lo que una CSP sirve para impedir. Va en su
// propia spec.
const CABECERAS_DE_SEGURIDAD = [
  // El navegador respeta el Content-Type declarado en vez de adivinarlo.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // DENY y no SAMEORIGIN: no hay ni un iframe en toda la app, así que no hay
  // nada que se embeba a sí mismo. Si algún día se quiere incrustar un juego
  // fuera, será una decisión explícita y esta línea es donde se verá.
  { key: "X-Frame-Options", value: "DENY" },
  // Hacia otro sitio viaja solo el origen, y nada si se baja a HTTP.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Dos años. SIN `preload`: entrar en la lista de precarga de los navegadores
  // es fácil y salir es lento, y esto todavía se sirve en localhost —donde la
  // cabecera es inerte, porque sin HTTPS válido no se aplica.
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains",
  },
  // El portal no pide cámara, micrófono ni ubicación, y nada de lo que carga
  // debería poder pedirlos por él.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];

const nextConfig: NextConfig = {
  /* config options here */
  allowedDevOrigins: ["172.29.128.1"],

  async headers() {
    return [{ source: "/(.*)", headers: CABECERAS_DE_SEGURIDAD }];
  },
};

export default nextConfig;
