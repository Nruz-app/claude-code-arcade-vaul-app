# SPEC 13 — SKINS: el mismo juego, otra época

> **Estado:** Aprobado
> **Depende de:** SPEC 05, SPEC 06, SPEC 08, SPEC 09, SPEC 10
> **Fecha:** 2026-08-14
> **Objetivo:** que los cinco juegos con motor real puedan verse con tres aspectos —`neon`, `retro` y `clasico`—, elegibles por el jugador, con la garantía de que cada paleta se lee sobre el fondo oscuro del portal y de que quien no elige nada ve exactamente lo de siempre.

---

## Por qué existe esta spec

Hasta hoy cada motor lleva sus colores como literales hex copiados a mano de los tokens de
`:root`. No es un descuido: lo impone la **invariante nº 10** del contrato de motores
(`.claude/skills/nuevo-juego/contrato.md`), con un argumento que sigue siendo cierto — el
canvas no entiende variables CSS. Lo que esa invariante nunca tuvo es una forma de
verificarse, y el propio contrato lo reconocía por escrito.

Un sistema de skins toca exactamente ese punto. Y de paso lo arregla: para que un motor pueda
tener tres paletas, sus colores tienen que estar todos en un sitio y todos alcanzables, que es
justo lo que la invariante pedía y nadie podía comprobar.

Lo que hace distinta a esta spec de las de los juegos es que **no añade nada al catálogo**.
No hay motor nuevo, ni entrada en `GAMES`, ni migración de Supabase. Es una spec de
plataforma: cambia cómo se dibuja lo que ya existe.

Nace además con un segundo entregable, que es de dónde vino el encargo: el subagente
**`skin-designer`**, que es quien va a reskinear los cuatro motores restantes.

---

## Alcance

**Dentro:**

- **Tres skins** —`neon`, `retro`, `clasico`— para los **cinco juegos con motor**: `rocas`,
  `caida`, `bloque-buster`, `serpentina` y `ranaria`.
- **`neon` es el aspecto de hoy y el que se usa por defecto**, con cero regresión visual
  demostrada por pruebas.
- **Un tercer parámetro opcional en `GameFactory`** por donde el motor recibe el skin.
- **Un selector** en el overlay de arranque del reproductor, con la preferencia guardada en
  `localStorage`.
- **Umbrales de contraste comprobables** y un harness de pruebas que los mide.
- **El subagente `skin-designer`** y su memoria.

**Fuera de alcance (para specs futuras):**

- **Modo claro.** La app es y sigue siendo siempre oscura. Nada de `prefers-color-scheme` ni
  de `data-theme`.
- **Los tres juegos sin motor** (`gloton`, `invasores`, `duelo-pixel`): no dibujan nada, así
  que un skin ahí no tendría efecto visible.
- **El resto de la interfaz**: `app/globals.css`, los tokens de `:root`, el marco CRT, las
  portadas `cover-*` y el `GameColor` del catálogo se quedan como están. El skin es del
  **canvas**, no del portal.
- **Assets alternativos.** Ningún PNG ni MP3 nuevo.
- **Guardar el skin en Supabase.** Es una preferencia de aparato, no de cuenta.
- **Cambiar de skin con la partida en marcha.** Se elige antes de empezar.

---

## Modelo de datos

### Archivos que aparecen o cambian

| Archivo                            | Qué                                                                                            |
| ---------------------------------- | ---------------------------------------------------------------------------------------------- |
| `app/lib/games/skins.ts`           | **Nuevo.** `SkinId`, `ClaseDeRol`, `FichaDeSkins`, `conAlfa`, `esSkin`, `paletaDe`, `MINIMOS`. |
| `app/lib/games/types.ts`           | Tercer parámetro opcional en `GameFactory`.                                                    |
| `app/lib/games/asteroids.ts`       | Motor piloto: `PALETA_NEON`, `SKINS_ROCAS`, la paleta baja a las funciones de dibujo.          |
| `app/lib/games/registry.ts`        | `GAME_PALETAS`, el tercer mapa por id.                                                         |
| `app/lib/use-skin.ts`              | **Nuevo.** La preferencia del jugador, sobre `localStorage`.                                   |
| `app/juego/[id]/jugar/page.tsx`    | El selector en el overlay y el skin en las dependencias del efecto.                            |
| `app/globals.css`                  | `.game-skins*`, tres clases para el selector.                                                  |
| `tests/harness/contraste.ts`       | **Nuevo.** Aritmética de color: composición alfa, luminancia, ratio, distinguibilidad.         |
| `tests/harness/skins.ts`           | **Nuevo.** `verificaSkins()`, la suite compartida.                                             |
| `tests/harness/canvas.ts`          | El Proxy anota los colores asignados al contexto.                                              |
| `tests/games/skins.test.ts`        | **Nuevo.** La tabla «de oro» de neón y las pruebas del helper.                                 |
| `.claude/agents/skin-designer.md`  | **Nuevo.** El subagente.                                                                       |
| `.claude/memoria/skin-designer.md` | **Nuevo.** Su memoria: quince filas, una por par motor × skin.                                 |

### Cómo llega un skin al motor

```ts
export type GameFactory = (
  canvas: HTMLCanvasElement,
  callbacks: GameCallbacks,
  skin?: SkinId,
) => GameHandle;
```

Y cada motor lo declara **con valor por defecto**:

```ts
export const createAsteroidsGame: GameFactory = (canvas, callbacks, skin = "neon") => {
  const paleta = paletaDe(SKINS_ROCAS, skin);
```

### La ficha de un motor

```ts
export interface FichaDeSkins<R extends string> {
  roles: Readonly<Record<R, ExigenciaDeRol>>;
  grupos: readonly (readonly R[])[];
  paletas: Readonly<Record<SkinId, Readonly<Record<R, string>>>>;
}
```

El tipo de los roles sale de la propia paleta neón (`keyof typeof PALETA_NEON`), así que
TypeScript **obliga** a que `retro` y `clasico` definan todos: un rol olvidado es un error de
compilación y no un elemento invisible que alguien descubre jugando.

### Clases de contraste

| Clase        | Umbral  | De dónde sale                                         |
| ------------ | ------- | ----------------------------------------------------- |
| `texto`      | ≥ 4,5:1 | WCAG 2.2 SC 1.4.3. Solo el panel lateral de CAÍDA.    |
| `jugable`    | ≥ 3:1   | WCAG 2.2 SC 1.4.11, componentes gráficos.             |
| `decorado`   | ≥ 1,5:1 | Rejillas, bordes, guías, estelas.                     |
| `superficie` | ≤ 2:1   | Es un **máximo**: el fondo tiene que seguir siéndolo. |

### La paleta de ROCAS

```ts
const PALETA_NEON = {
  fondo: "#000",
  nave: "#00f5ff", // --cyan
  propulsor: "rgba(245,255,0,0.85)", // --yellow
  bala: "#e6e9ff", // --ink
  roca: "rgba(230,233,255,0.75)", // --ink atenuado
  particula: "#f5ff00", // --yellow, se desvanece con conAlfa()
  mejora: "#ff006e", // --magenta
} as const;
```

| Rol         | `neon`                           | `retro`                        | `clasico`                         |
| ----------- | -------------------------------- | ------------------------------ | --------------------------------- |
| `fondo`     | `#000`                           | `#000`                         | `#000`                            |
| `nave`      | `#00f5ff` — 15,50:1              | `#ffcf70` — 14,41:1            | `#ffffff` — 21,00:1               |
| `propulsor` | `rgba(245,255,0,.85)` — 13,59:1  | `rgba(255,176,0,.85)` — 8,28:1 | `rgba(255,255,255,.85)` — 14,84:1 |
| `bala`      | `#e6e9ff` — 17,46:1              | `#fffbe6` — 20,19:1            | `#ffffff` — 21,00:1               |
| `roca`      | `rgba(230,233,255,.75)` — 9,63:1 | `#c07800` — 5,93:1             | `#b9b9b9` — 10,70:1               |
| `particula` | `#f5ff00` — 19,19:1              | `#ffb000` — 11,46:1            | `#ffffff` — 21,00:1               |
| `mejora`    | `#ff006e` — **5,48:1**           | `#ff8c1a` — 9,02:1             | `#4d9fff` — **7,72:1**            |

El suelo de `neon` es el magenta a 5,48:1, casi el doble del mínimo de lo jugable.

---

## Plan de implementación

Cada paso deja la app compilando y la suite verde. **Los pasos 1 al 5 no cambian un solo
píxel**: la primera diferencia visible aparece en el 6, y solo si alguien elige algo distinto
de neón.

1. **`app/lib/games/skins.ts`.** Los tipos y los tres helpers. Nadie lo importa todavía.
2. **`app/lib/games/types.ts`.** El tercer parámetro. Los cinco motores siguen siendo
   asignables por estructura, así que las pruebas siguen pasando sin tocar ninguna.
3. **El harness.** El espía de color en `canvas.ts` (aditivo), `contraste.ts` y `skins.ts`.
4. **ROCAS**, el piloto: ficha, `skin = "neon"`, la paleta bajando por argumento a los cinco
   `draw()`, y `verificaSkins` en su archivo de pruebas.
5. **`registry.ts`.** `GAME_PALETAS` y las pruebas nuevas del registro.
6. **La UI.** `use-skin.ts`, el selector en el overlay, el skin en las dependencias.
7. **Documentación.** La invariante nº 10 reescrita, `CLAUDE.md`, el agente y su memoria.
8. **Los cuatro motores restantes**, uno por invocación de `skin-designer`, en orden
   `bloque-buster` → `serpentina` → `caida` → `ranaria`.

---

## Criterios de aceptación

**Cero regresión**

- [x] Entrar a un juego sin elegir nada se ve exactamente como antes de esta spec.
- [x] `verificaSkins` compara la secuencia completa de colores entre montar sin skin y montar
      con `"neon"`, y son idénticas.
- [x] La tabla «de oro» de `tests/games/skins.test.ts` conserva los literales previos.

**El contrato**

- [x] `GameHandle` sigue teniendo exactamente cinco métodos.
- [x] `GameCallbacks` y `GameOverSummary` no cambian.
- [x] `GAME_ENGINES[id].length` sigue valiendo 2.
- [x] El reproductor sigue sin saber nada del juego que monta más allá del canvas y los
      callbacks.

**Las paletas**

- [x] Cada rol cumple el umbral de su clase, medido sobre su superficie real y con el alfa
      compuesto.
- [x] Cada grupo declarado se distingue par a par.
- [ ] Los cinco motores tienen ficha registrada en `GAME_PALETAS`. _(hoy solo ROCAS)_

**La interfaz**

- [x] El selector aparece solo en el overlay de arranque y solo si el motor tiene paletas.
- [x] La preferencia sobrevive a recargar la página.
- [x] Elegir un skin no reinicia ninguna partida, porque no se puede elegir con una en marcha.
- [x] No hay aviso de desajuste de hidratación.

---

## Decisiones

**Sí: el skin entra por la factory.** Es el único sitio posible. Un color de canvas solo puede
aplicarlo quien llama a `ctx.fillStyle`, y el reproductor monta el elemento pero nunca dibuja
en él. La doctrina de `registry.ts` —que la metadata por juego que no es comportamiento viva
en el registro— protege `GameHandle`, y `GameHandle` no se toca: lo que se amplía es la
entrada de la factory, que ya es por donde el motor recibe todo lo de fuera.

**Sí: con valor por defecto, nunca `skin?`.** `Function.length` no cuenta los parámetros con
valor por defecto, así que la aridad que afirma `registry.test.ts` sigue siendo 2 y esa prueba
pasa a ser el guardián de esta regla. Escrito como `skin?`, montar sin skin dejaría al motor
sin paleta.

**No: una paleta mutable exportada por el motor.** Sería estado a nivel de módulo, que es la
invariante nº 1 del contrato y está probada («dos instancias no comparten estado»). Dos
motores montados a la vez compartirían skin.

**No: `GameHandle.setSkin()`.** Rompería el contrato que fijaron las SPEC 05 y 06, y hay una
prueba que cuenta los métodos.

**Sí: roles por motor, no un vocabulario compartido.** ROCAS tiene 7 roles y RANARIA 26. Un
juego de roles común sería o tan pobre que RANARIA necesitaría veinte «extra», o tan rico que
ROCAS dejaría diecinueve sin usar. Y obligaría a que «peligro» signifique lo mismo en un
tetrominó y en un camión, que no lo significa. Lo que se comparte es la **forma**, no las
claves.

**Sí: el mínimo de lo jugable es 3:1 y no 4,5:1.** No es laxitud: es el umbral que WCAG 2.2
define para componentes gráficos (SC 1.4.11) frente al de texto (SC 1.4.3). Y es aritmética —
con 4,5:1 una rampa monocroma de ocho pasos no cabe por debajo del máximo físico de 21:1, y
CAÍDA tiene ocho piezas que distinguir en el skin ámbar.

**Sí: se compone el alfa antes de medir.** Un `rgba(0,255,136,0.06)` sobre negro es `#00190d`,
ratio 1,07:1. Medir el color sin componer aprobaría media docena de roles que en pantalla no
se ven, y la verificación sería teatro.

**Sí: se mide contra la superficie real.** Las piezas de CAÍDA caen sobre el pozo (`#0f0f18`)
y la rana de RANARIA nada sobre el agua. Medirlo todo contra el negro del canvas da aprobados
optimistas.

**Sí: `retro` es ámbar y no verde fósforo.** El verde ya es el acento de SERPENTINA y RANARIA
en el catálogo, y es también el verde Nokia del `clasico` de SERPENTINA. El ámbar es el único
tono que no colisiona con nada del portal.

**Sí: `clasico` es el original subido al mínimo de contraste cuando el original no llega.** La
J del Tetris de 1984 (`#0000ff`) da 2,4:1 sobre el pozo. Se aclara, y la desviación se anota
en la memoria del agente con su ratio. Sin la prueba, esa concesión se tomaría a ojo y nadie
sabría que se tomó.

**Sí: la preferencia es global, no por juego.** Es una preferencia estética del portal, con un
selector y una clave. No se pierde nada: como cada motor tiene su propia paleta `clasico`, una
única preferencia global ya produce CAÍDA con sus colores de Tetris y SERPENTINA en verde
Nokia. Lo per-juego sale gratis por el lado de las paletas; no hace falta comprarlo por el
lado del estado.

**Sí: el skin entra en las dependencias del efecto que monta el motor.** Cambiarlo destruye el
motor y lo vuelve a crear, y eso es inofensivo porque el selector **solo se renderiza dentro
del overlay de arranque**, donde `start()` todavía no se ha llamado: no hay partida que
reiniciar. Es la invariante más frágil de esta spec y va comentada junto a las dependencias.

**No: un selector en el HUD o en la pantalla de pausa.** Rompería esa invariante y no hay
ninguna prueba que lo detectase.

**Sí: en SERPENTINA, `retro` y `clasico` fuerzan el camino vectorial.** El atlas
`/snake-fruits.png` tiene el color horneado. Teñirlo con `globalCompositeOperation` costaría
un canvas auxiliar por fotograma y destrozaría un pixel-art de 160 px reducido a 32; un atlas
por skin exigiría assets nuevos. El fallback vectorial ya existe, ya está probado y ya toma su
color de la paleta.

**Sí: la invariante nº 10 se reescribe, no se elimina.** Su espíritu sigue en pie —el canvas
no entiende variables CSS y `neon` sigue copiando `:root`—, pero pasa a exigir una ficha, cero
literales sueltos y una clase de contraste por rol. Y por primera vez queda cubierta por
pruebas, que es probablemente el mejor subproducto de todo esto.

**Sí: `skin-designer` escribe en `app/`, y es la única excepción del repo.** Una skin es
código de dibujo dentro del motor y no hay ningún otro sitio donde pueda vivir. A cambio su
alcance está acotado a un motor por invocación y sus deberes de verificación son más duros que
los de cualquier skill.

---

## Riesgos

| Riesgo                                                       | Mitigación                                                                                                                                                      |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Regresión visual en `neon`                                   | Tres redes: los literales se mueven y no se reescriben; la tabla «de oro»; y la comparación de la secuencia completa de colores con `Math.random` estabilizado. |
| Que el selector salga del overlay y reinicie partidas        | La invariante va comentada junto a las dependencias. **No hay prueba que lo detecte**: es el punto más frágil.                                                  |
| `retro` monocromo no distingue las ocho piezas de CAÍDA      | El umbral de 3:1 deja sitio (1,3⁷ ≈ 6,3× de rango). Si un par falla, se **reduce el grupo** con un motivo escrito, nunca se baja el umbral.                     |
| El clásico literal no pasa el contraste                      | Regla escrita: original subido al mínimo, con la desviación y su ratio en la memoria del agente.                                                                |
| RANARIA es un pantano de 26 roles                            | Va la última, con el patrón validado cuatro veces. El cambio de tipo de `CarrilDef.color` lo apoya el compilador.                                               |
| Deriva del tema: alguien cambia `:root` y `neon` queda vieja | Es la deuda que ya existía y no empeora. La tabla «de oro» la hace visible: cambiar `:root` obliga a cambiar la tabla, y ahí se ve el alcance.                  |
| El agente se sale de su alcance                              | Vetos duros, reglas duras, y el «NO toca:» de su descripción. La spec queda en `Borrador` hasta revisión.                                                       |

---

## Lo que **no** está en esta spec

- Un skin para el portal entero. Esto es del canvas.
- Modo claro, en ninguna forma.
- Skins para los tres juegos simulados.
- Que el jugador pueda definir su propia paleta.
- Guardar la preferencia en la cuenta de Supabase.
- Cambiar de skin sin volver al overlay.
