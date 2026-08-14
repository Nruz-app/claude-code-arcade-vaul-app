// ===== tests/harness/setup.ts =====
// Se ejecuta antes de cada archivo de pruebas (`setupFiles` en vitest.config.ts).
// Deja el entorno jsdom en condiciones de albergar un motor de juego.

import { afterEach, beforeEach, vi } from "vitest";

import { instalaAudioStub, limpiaAudio } from "./audio";
import { instalaCanvas2d } from "./canvas";

// Los dos parches van una vez por archivo: tocan el prototipo, no una instancia,
// y son idempotentes.
instalaCanvas2d();
instalaAudioStub();

beforeEach(() => {
  // Cada prueba arranca con el body limpio: `creaCanvas()` cuelga el canvas de
  // ahí y un canvas huérfano de la prueba anterior confundiría las búsquedas.
  document.body.innerHTML = "";
  // Y con el registro de audio a cero, que también es global.
  limpiaAudio();
});

afterEach(() => {
  vi.restoreAllMocks();
});
