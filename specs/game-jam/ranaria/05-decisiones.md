# RANARIA — decisiones y riesgos

> Ver `00-resumen.md` para el tema y `02-motor.md` para los números que se justifican aquí.

Esta spec se ha escrito **sin supervisión**: cada hueco que la skill `/nuevo-juego` habría
resuelto preguntando está decidido aquí, con su porqué. Nada queda "por definir".

---

## Alcance

- **Sí:** usar el id `ranaria`, que ya está en `GAMES` sin motor. El tema aterriza exactamente
  ahí, y reutilizarlo se ahorra la entrada de catálogo, la clase `cover-*` en
  `app/globals.css` y las descripciones corta y larga. Inventar un id nuevo habría duplicado
  un juego que ya está anunciado en la biblioteca.
- **No:** tocar `app/lib/data.ts`. La entrada existe desde la SPEC 01 y su descripción larga
  —_"Salta entre carriles de coches a toda velocidad y troncos a la deriva en el río. Llega a
  los nenúfares antes de que se acabe el tiempo"_— describe con precisión el juego que
  especifica este documento, carriles, troncos, nenúfares y temporizador incluidos. Cumplirla
  al pie de la letra es gratis y evita que el catálogo mienta.
- **No:** migraciones de Supabase. Quinto juego, quinta vez que no hacen falta: `game_id` es
  texto libre por decisión de la SPEC 06 y `/salon` saca las pestañas de `GAMES`.
- **Sí:** el archivo se llama `frogger.ts` y la factory `createFroggerGame`, siguiendo a
  `asteroids.ts`, `tetris.ts`, `arkanoid.ts` y `snake.ts`: el nombre del archivo es el del
  clásico y el id del catálogo solo aparece en `registry.ts`.
- **No:** el `best` mock de `ranaria` (18.900). Cambiarlo es otra spec, y además la escala de
  puntos de `02-motor.md` está calibrada para que ese número siga siendo creíble.

## Juego

- **Sí:** tablero de 16×12 celdas de 50 px. Es la única combinación redonda que llena 800×600
  exacto, así que no queda banda negra ni hay que centrar nada, y 50 px deja sitio para
  dibujar una rana legible sin sprites.
- **Sí:** cinco carriles de carretera y cuatro de río, con una mediana entre medias. Es el
  reparto del original y el que hace que el juego tenga dos mitades con reglas opuestas: abajo
  el suelo es seguro y lo que se mueve mata, arriba lo que se mueve es lo único seguro.
- **Sí:** el seto entre nenúfares mata. Sin él, llegar a la fila de arriba de cualquier manera
  vale, y el último salto —el único que exige puntería— deja de existir.
- **Sí:** tres vidas reales, emitidas por `onLives` como `3 → 2 → 1 → 0`. RANARIA es un juego
  de intentos cortos y repetidos: sin vidas, cada roce sería el final de la partida y el
  ranking mediría suerte. Es además lo que hacen ROCAS y BLOQUE BUSTER, así que los corazones
  del HUD dicen la verdad.
- **Sí:** temporizador por intento, con bonus de puntos por lo que sobre. Hace tres trabajos a
  la vez: evita que un jugador se quede parado en la mediana esperando el hueco perfecto,
  impide que `duration_ms` mida tiempo sin jugar, y mete la tensión de decidir entre cruzar
  rápido o cruzar seguro.
- **Sí:** el temporizador se acorta con el nivel, con suelo en 18 s. Es una segunda palanca de
  dificultad independiente de la velocidad, y el suelo evita que a partir del nivel 10 el
  intento sea imposible por reloj y no por tráfico.
- **Sí:** nivel al llenar los cinco nenúfares. Es el hito natural del juego y llega cada
  cinco cruces, así que una partida decente alcanza el nivel 4 o 5: suficiente para que el
  `level` que llega al Salón distinga a unos jugadores de otros.
- **Sí:** progresión infinita reciclando el mismo mapa con más velocidad. La alternativa era
  terminar en victoria al llenar la meta, como el original, pero `GameOverReason` solo admite
  `"game_over" | "surrender"` y ampliarlo obliga a migrar la restricción `check` de
  `game_sessions`. Y sobre todo: un techo fijo hace que todos los buenos empaten y el ranking
  deje de ordenar nada.
- **Sí:** tope de velocidad en `VEL_MAX = 2.2`, alcanzado en el nivel 11. Sin tope, hacia el
  nivel 15 los coches del carril rápido cruzan la pantalla en menos de lo que dura un salto y
  la partida se cierra sola.
- **Sí:** tortugas que se sumergen, con parpadeo de aviso. Es la mecánica que impide que el
  río se resuelva mirando una foto: obliga a leer el tiempo además del espacio, y el parpadeo
  hace que la muerte sea culpa del jugador y no del azar.
- **Sí:** las tortugas de un carril se hunden desfasadas. Si se hundieran a la vez, el carril
  alternaría entre muro y agujero y no habría ninguna decisión que tomar.
- **Sí:** la mosca de bonus. Cuesta unas veinte líneas, reutiliza la estructura de nenúfares
  que ya existe y añade la decisión de "voy al nenúfar cómodo o al que puntúa". Sin ella, con
  la meta medio llena todos los cruces valen lo mismo.
- **Sí:** el bonus por avanzar se cobra una sola vez por fila y por intento, contra
  `filaMinAlcanzada`. Cobrarlo en cada entrada convierte saltar arriba y abajo en la mediana
  en una máquina de puntos infinita, y el ranking pasaría a medir paciencia.
- **Sí:** el bonus de tiempo se cobra **al ocupar un nenúfar**, no al terminar la partida. Al
  terminar por game over el reloj está a cero y no se pagaría nunca; al terminar por FIN,
  premiaría rendirse pronto. Es el mismo razonamiento que el bonus por vidas de BLOQUE BUSTER.
- **Sí:** flechas **y** WASD. Son dos entradas al mismo salto, cuestan tres líneas y cubren a
  quien juega con la izquierda. Es lo que ya hace SERPENTINA.
- **No:** ESPACIO para nada. El reproductor la usa para arrancar la partida desde el overlay,
  y blindar el motor contra esa pulsación costó un criterio de aceptación entero en CAÍDA. Sin
  ESPACIO, el problema no existe: misma decisión que BLOQUE BUSTER y SERPENTINA.
- **No:** capturar `P` para pausar. El reproductor ya pausa con `Escape`, con el botón del HUD
  y al cambiar de pestaña.
- **No:** cocodrilos, serpientes sobre la mediana y rana hembra que hay que escoltar. Son tres
  entidades más con sus propias reglas, y el presupuesto de la jam es un motor de 400–800
  líneas. El río ya tiene su propia amenaza temporal con las tortugas.
- **No:** ratón. Un juego de saltos por celdas no gana nada con el puntero, y el veto de la
  jam solo lo admite como extra opcional.

## Arquitectura

- **Sí:** los carriles como tabla de datos (`CARRILES`) y una sola clase `Movil` para coche,
  camión, tronco y tortuga. Nueve carriles escritos a mano serían nueve bloques casi idénticos;
  con la tabla, retocar la dificultad en el paso 8 del plan es editar una fila.
- **Sí:** convoy con envoltura sobre una pista virtual, en vez de generar tráfico al azar. Un
  spawner aleatorio produce huecos imposibles cada varias partidas y hace que dos partidas no
  se puedan comparar; el convoy es determinista, siempre cruzable, y la envoltura ocurre fuera
  de pantalla por construcción.
- **Sí:** el salto se resuelve **lógicamente al instante** y la interpolación es solo visual.
  Un salto con estado intermedio obliga a decidir qué pasa si un coche te toca a medio salto y
  a duplicar las comprobaciones de colisión. Con la resolución instantánea hay una sola celda
  válida en cada frame y las reglas caben en una pasada de `update`.
- **Sí:** posición horizontal continua (`ranaX` en píxeles) y fila discreta. Es la mezcla que
  pide el juego: los troncos arrastran en píxeles, pero saltar es de fila en fila. Guardar
  solo la columna haría imposible el arrastre; guardar también la fila en píxeles complicaría
  las colisiones sin ganar nada.
- **Sí:** ajustar a la columna al aterrizar en tierra firme, no en el río. Sin el ajuste, un
  salto desde un tronco deja la rana montada entre dos carriles de coches y la carretera se
  vuelve ilegible; con el ajuste en el río, el arrastre dejaría de existir.
- **Sí:** caja de colisión de la rana con `RANA_INSET` de 8 px. Con la celda entera, un coche
  del carril de al lado mata por rozar un píxel y la muerte se percibe como injusta.
- **Sí:** cola de saltos de capacidad 2. Sin cola, dos pulsaciones dentro del mismo frame
  pierden una y el control se siente sordo; con cola infinita, machacar teclas encadena saltos
  que el jugador ya no controla y lo mete en la carretera.
- **Sí:** un estado `"muriendo"` con 700 ms de destello. Reaparecer al instante permite morir
  dos veces con el mismo coche antes de soltar la tecla, y el jugador no llega a ver qué lo
  mató.
- **Sí:** todo el estado en el closure de `createFroggerGame`. Es la invariante 1 del contrato:
  en Next un `let` de módulo sobrevive entre montajes, y navegar a otro juego y volver
  arrastraría la puntuación y dejaría bucles vivos.
- **Sí:** `elapsedMs += dt * 1000` dentro del bucle, nunca `Date.now()`. Como el bucle se
  detiene al pausar, el tiempo en pausa queda fuera sin escribir una línea para ello
  (invariante 6, y decisión explícita de la SPEC 06).
- **Sí:** `dt` capado a 50 ms y `lastTime = null` al parar el bucle. Sin el cap, volver de otra
  pestaña adelanta el tráfico medio carril de golpe y mata a la rana sin que se vea nada.

## Presentación

- **Sí:** primitivas del canvas, sin ningún asset. Una jam sin supervisión no puede generar un
  PNG, y además el portal solo sirve hoy un binario (`snake-fruits.png`). Es la misma decisión
  que tomó BLOQUE BUSTER, y evita la carga asíncrona que la `GameFactory` síncrona tendría que
  absorber.
- **Sí:** la rana en `--green`. Es el acento que `ranaria` ya tiene en `GAMES` y el que usa su
  portada `cover-rana`, así que la partida y la tarjeta del catálogo pegan.
- **Sí:** los cuatro acentos del tema para los vehículos, más un gris metálico para el camión.
  Coches de colores distintos por carril es lo que permite reconocer el patrón de cada carril
  de un vistazo, y el gris marca que el camión es "otra cosa" antes de que se note que es más
  largo.
- **Sí:** el marrón del tronco (`#c98a4b`) es el único color fuera de la paleta del tema. Un
  tronco en verde se confunde con la rana justo cuando hay que saltar encima, y en cian se
  confunde con las tortugas. El resto del cuadro sigue siendo neón sobre negro.
- **Sí:** la barra de tiempo se dibuja **dentro del canvas**, pese a la invariante 4. Esa
  invariante prohíbe duplicar lo que ya pinta la plataforma —puntuación, vidas, nivel, GAME
  OVER, pausa—, y el tiempo restante no es nada de eso: es estado del juego, no lo transporta
  ningún callback del contrato, y sacarlo fuera exigiría ampliar `GameCallbacks`, es decir,
  tocar `types.ts`. Se dibuja en los 6 px inferiores del canvas para no invadir el campo de
  juego.
- **No:** dibujar la tortuga sumergida en semitransparente. Si se ve, el jugador cree que sigue
  habiendo plataforma; desaparecer del todo es lo que hace legible la regla.

---

## Alternativas descartadas

Se generaron tres conceptos a partir del tema y dos se cayeron en los vetos de la jam.

### CHARCO — saltar entre nenúfares que se hunden

Una rana en un estanque con scroll vertical infinito, saltando de nenúfar en nenúfar; cada
nenúfar aguanta un par de segundos antes de hundirse y hay moscas que dan puntos. Aguanta los
vetos técnicos: un canvas, teclado, puntuación creciente, un jugador y sin assets.

**Lo que lo hundió: el criterio del `game-id`.** Es un juego nuevo, así que obliga a escribir
una entrada en `GAMES` con su `title`, `short`, `long`, `best` y `plays`, y a diseñar una clase
`cover-*` nueva en `app/globals.css` — es decir, a tocar dos archivos que RANARIA no toca —
**mientras `ranaria` sigue vacío en el catálogo**, prometiendo justo el juego del tema.
Encima, hundirse en el agua es la mecánica que RANARIA ya tiene en el río, así que el portal
acabaría con dos juegos de rana solapados.

### LENGUA — la rana cazamoscas

La rana fija en la orilla y una lengua que se dispara apuntando con el ratón a los insectos que
cruzan el estanque, con combos por encadenar aciertos.

**Lo que lo hundió: el veto de "solo teclado".** Apuntar es analógico y el ratón aquí no sería
un extra opcional sino el control principal, cosa que el veto no admite. Sustituir el apuntado
por rotación con las flechas lo convierte en ROCAS con otra piel: mismo esquema de girar y
disparar que ya tiene el portal. Y "la ranita que cruza la carretera y el río" es literalmente
lo que pedía el tema, así que este concepto además se alejaba del encargo.

---

## Riesgos

| Riesgo                                                                                                                                                                    | Mitigación                                                                                                                                                                                                                 |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **La dificultad del nivel 1 está calculada sobre el papel.** Nueve carriles con velocidad, largo y hueco elegidos a ojo pueden hacer el primer cruce imposible o trivial. | Toda la dificultad vive en la tabla `CARRILES` y en cuatro constantes; el paso 8 del plan la ajusta jugando, y dice explícitamente qué tocar en cada caso. Ninguna de esas correcciones es un rediseño.                    |
| Con velocidad creciente y `dt` capado a 50 ms, un coche puede recorrer más de una celda por frame y atravesar la rana sin tocarla.                                        | A `VEL_MAX` el carril más rápido va a 352 px/s: 17,6 px por frame de 50 ms, muy por debajo de los 50 px de una celda. El cap de `dt` es lo que garantiza esa cota, y hay criterio de aceptación al volver de otra pestaña. |
| El arrastre sobre troncos usa posición continua y el resto del juego rejilla; una conversión mal hecha deja a la rana muerta "sin motivo" al saltar del río a la mediana. | El ajuste a columna al aterrizar en tierra firme, con criterio de aceptación propio, y `plataformaBajo()` decidiendo siempre por el **centro** de la rana, nunca por su borde.                                             |
| Cinco causas de muerte distintas son cinco caminos hacia `matar()`; que alguna no descuente vida o no reinicie el temporizador es fácil de colar.                         | Una sola función `matar(motivo)` centraliza vida, temporizador, estado `"muriendo"` y reaparición. Cada una de las cinco tiene su casilla en `04-aceptacion.md`.                                                           |
| El presupuesto de líneas: escenario, cuatro tipos de móvil, nenúfares, mosca, temporizador y cinco muertes es más superficie que la de SERPENTINA.                        | Los carriles son datos y hay una sola clase `Movil` con un dispatch de dibujo; el plan parte el trabajo en ocho pasos compilables y el juego reutiliza un único tablero, sin patrones por nivel.                           |
| Una partida muy buena no termina nunca y `duration_ms` crece sin límite.                                                                                                  | Es el mismo modelo que ROCAS, CAÍDA y BLOQUE BUSTER. El temporizador decreciente y la velocidad con tope acaban cerrando la partida, y el botón FIN siempre está disponible.                                               |
| La barra de tiempo dentro del canvas puede leerse como una violación de la invariante 4 en la revisión.                                                                   | Queda argumentada arriba y anotada en el criterio de aceptación correspondiente: es estado de juego sin callback en el contrato, y ampliarlo obligaría a tocar `types.ts`.                                                 |
| El marrón del tronco desentona con el neón del marco CRT.                                                                                                                 | Lleva borde claro y va sobre agua muy oscura, que es el mayor contraste del cuadro. Si al verlo no encaja, es una constante de `COLORS` y el paso 8 lo cubre.                                                              |
