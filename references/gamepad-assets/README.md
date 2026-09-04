# Arcade Vault — Gamepad MK-II

Componente de gamepad neón listo para usar, extraído del portal Arcade Vault.

## Archivos

- **`gamepad.html`** — El mando entero, en una sola barra: cruceta a la izquierda y botones a la
  derecha dentro del mismo marco. Es el original, del que salieron los otros dos, y el que
  documenta la SPEC 16. Soporta teclado (flechas/WASD, Z/J = A, X/K = B) y eventos de puntero
  (ratón + táctil).
- **`gamepad-cruceta.html`** — Solo la cruceta. Flechas y WASD.
- **`gamepad-botones.html`** — Solo los botones redondos. Z/J = A, X/K = B. El botón B se dibuja
  inerte para enseñar ese estado: los dos huecos existen siempre, y el que un juego no declara
  sale como carcasa apagada.
- **`gamepad-neon.png`** — Captura del mando entero.

## Por qué hay tres HTML

La SPEC 17 parte el mando en dos porque en la app las mitades dejan de compartir marco: la
cruceta va a un costado de la pantalla y los botones al otro, dentro de un chasis único que hace
de consola. Cada mitad se porta desde su archivo; `gamepad.html` se queda porque es el original y
la SPEC 16 lo cita.

En los dos archivos partidos el marco es un panel al tamaño de la pieza, y solo sirve para poder
abrir el archivo y ver el control suelto. **En la app ese marco no existe**: lo pone el chasis.

## Uso

Abre cualquiera de los tres directamente en un navegador moderno. Para incrustarlos en otro
proyecto, copia el contenido del bloque `<style>` y el HTML dentro de `.page` — no requieren
librerías externas (solo las fuentes de Google Fonts).
