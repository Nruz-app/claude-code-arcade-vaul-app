// ===== vitest.config.ts =====
// Runner de pruebas unitarias del proyecto. Hoy cubre los motores de juego de
// `app/lib/games/`, que son la parte con lógica propia y sin React.
//
// Entorno jsdom porque los motores necesitan `window` (los listeners de teclado
// viven ahí, no en el canvas) y un `HTMLCanvasElement`. jsdom **no** implementa
// `getContext("2d")`: lo suple el stub de `tests/harness/canvas.ts`, que se
// instala desde `setupFiles`.

import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const raiz = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  resolve: {
    // Mismo alias que tsconfig.json: "@/*" apunta a la raíz del proyecto.
    alias: { "@": raiz },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/harness/setup.ts"],
    include: ["tests/**/*.test.ts"],
    // Sin esto, un motor que deje un bucle vivo colgaría el runner en vez de
    // fallar: justo lo que las pruebas de `destroy()` intentan detectar.
    testTimeout: 10_000,
  },
});
