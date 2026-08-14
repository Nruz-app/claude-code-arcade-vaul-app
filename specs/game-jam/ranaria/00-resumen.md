# RANARIA — resumen de la jam

> Ver `01-spec.md`, `02-motor.md`, `03-plan.md`, `04-aceptacion.md` y `05-decisiones.md`.

## El tema recibido

> **"la ranita"** — el juego de la ranita que cruza la carretera y el río esquivando
> obstáculos.

## Cómo he leído el tema

El tema no es una restricción abstracta ("gravedad invertida"), es un juego concreto y
nombrado: el enunciado ya describe la mecánica de Frogger. Lo he leído, por tanto, como un
encargo de **hacer real el juego que el catálogo lleva prometiendo desde la SPEC 01**:
`ranaria` existe en `GAMES` con la descripción _"Salta entre carriles de coches a toda
velocidad y troncos a la deriva en el río. Llega a los nenúfares antes de que se acabe el
tiempo"_, y hoy cae en el reproductor simulado. La única libertad real que queda es cómo se
convierte ese clásico en una partida **sin techo**, porque el Frogger original se gana y un
juego que se gana no ordena un ranking.

## El juego

Eres una rana en la orilla inferior de una pantalla de 16×12 celdas. Arriba hay cinco
nenúfares vacíos y, entre tú y ellos, cinco carriles de tráfico y cuatro de río. Saltas de
celda en celda con las flechas: en la carretera te mata cualquier vehículo que te toque; en
el río te mata el agua, así que ahí solo sobrevives **encima** de un tronco o de una
tortuga, que te arrastran mientras te llevan — y las tortugas se sumergen cada pocos
segundos, avisando con un parpadeo. Llegar a un nenúfar libre lo ocupa y te devuelve a la
orilla a por el siguiente; llenar los cinco sube de nivel, vacía los nenúfares y acelera
todos los carriles. Cada intento tiene un temporizador que se agota y que también te cuesta
una vida. Enganchan tres cosas a la vez: el bonus de tiempo premia cruzar rápido, el río
castiga cruzar rápido, y el nenúfar que te falta siempre está en el peor sitio.

## Ficha

| Campo             | Valor                                                                   |
| ----------------- | ----------------------------------------------------------------------- |
| `game-id`         | `ranaria`                                                               |
| Título            | RANARIA                                                                 |
| Categoría (`cat`) | `ARCADE`                                                                |
| Color de acento   | `green`                                                                 |
| Portada           | `cover-rana`                                                            |
| Entrada           | **Reutiliza** la que ya existe en `GAMES`; no se toca `app/lib/data.ts` |
| Archivo del motor | `app/lib/games/frogger.ts`, factory `createFroggerGame`                 |
| Assets nuevos     | Ninguno: todo se dibuja con primitivas del canvas                       |
| Migraciones       | Ninguna                                                                 |

Que el id ya existiera abarata la spec entera: no hay entrada de catálogo que escribir, ni
clase `cover-*` que diseñar en `app/globals.css`, ni descripción corta y larga que inventar.
El trabajo es un archivo nuevo y dos líneas en `registry.ts`.

## Índice

| Archivo            | Qué contiene                                                          |
| ------------------ | --------------------------------------------------------------------- |
| `01-spec.md`       | Cabecera, por qué existe la spec y alcance (dentro / fuera)           |
| `02-motor.md`      | Constantes, colores, carriles, tipos, estado interno y callbacks      |
| `03-plan.md`       | Ocho pasos de implementación, cada uno dejando la app compilando      |
| `04-aceptacion.md` | Checklist booleana en cuatro grupos                                   |
| `05-decisiones.md` | Decisiones con su porqué, alternativas descartadas y tabla de riesgos |
