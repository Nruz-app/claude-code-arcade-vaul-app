# RANARIA — criterios de aceptación

> Ver `03-plan.md` para el orden de implementación y `02-motor.md` para los números que se
> comprueban aquí.

Todo lo de esta lista se verifica **mirando la pantalla** o leyendo una fila de la base de
datos. Si algo no se puede comprobar así, es que está mal escrito.

## Build

- [ ] `npm run lint` y `npm run build` terminan sin errores ni warnings de tipos.
- [ ] La consola del navegador no muestra errores al cargar `/juego/ranaria/jugar`.
- [ ] `app/lib/games/frogger.ts` no declara ninguna variable de estado de partida a nivel de
      módulo: todo vive dentro de `createFroggerGame`.
- [ ] `app/juego/[id]/jugar/page.tsx` y `app/lib/games/types.ts` **no** se han modificado.
- [ ] `app/lib/data.ts` y `app/globals.css` **no** se han modificado.
- [ ] No se ha añadido ninguna migración en `supabase/migrations/`.
- [ ] No se ha copiado ningún asset a `public/`.
- [ ] El motor no importa React, ni nada de `references/`, ni toca el DOM fuera del canvas
      que recibe.

## El juego funciona

- [ ] La partida arranca con la rana en el centro de la orilla inferior, mirando hacia
      arriba.
- [ ] Las flechas y WASD hacen saltar una celda exacta en cada pulsación; mantener la tecla
      no encadena saltos sin control.
- [ ] Ninguna de esas ocho teclas scrollea la página mientras la partida está activa.
- [ ] La rana no puede salir del canvas saltando: los saltos que la sacarían se ignoran.
- [ ] Los cinco carriles de carretera llevan tráfico en direcciones alternas, y el camión de
      la fila 6 es más largo y más lento que los coches.
- [ ] Ningún vehículo aparece ni desaparece dentro de la pantalla: la envoltura del convoy
      ocurre siempre fuera del canvas.
- [ ] Ser tocado por un vehículo cuesta una vida.
- [ ] Rozar un vehículo del carril contiguo sin invadirlo **no** mata.
- [ ] Entrar en el agua sin plataforma debajo cuesta una vida.
- [ ] Encima de un tronco la rana se desplaza con él, y queda desalineada de la rejilla.
- [ ] Dejar que un tronco arrastre la rana fuera del canvas cuesta una vida.
- [ ] Las tortugas se sumergen en ciclo, parpadean antes de hacerlo y **no todas a la vez**
      dentro del mismo carril.
- [ ] Quedarse sobre una tortuga sumergida cuesta una vida.
- [ ] Saltar a la fila de meta fuera de un nenúfar (contra el seto) cuesta una vida.
- [ ] Saltar a un nenúfar ya ocupado cuesta una vida.
- [ ] Ocupar un nenúfar libre lo marca con una ranita, devuelve la rana a la orilla y
      reinicia el temporizador.
- [ ] Al aterrizar en la mediana, en la orilla o en un nenúfar, la rana queda alineada con la
      columna; en el río, no.
- [ ] La barra de tiempo del borde inferior se acorta durante el intento y se pone magenta en
      los últimos 5 s.
- [ ] Agotar el tiempo cuesta una vida y reinicia el intento.
- [ ] Cada fila nueva alcanzada en un intento suma `25 × nivel`, y volver atrás y repetirla
      **no** vuelve a sumar.
- [ ] Ocupar un nenúfar suma `500 × nivel` más `20 × nivel` por segundo entero restante.
- [ ] La mosca aparece de vez en cuando sobre un nenúfar libre, caduca sola, y comérsela suma
      `800 × nivel`.
- [ ] Llenar los cinco nenúfares sube el nivel, vacía la meta, suma `2.000 × nivel` y acelera
      visiblemente todos los carriles.
- [ ] El temporizador del intento se acorta con el nivel y no baja de 18 s.
- [ ] La velocidad deja de crecer a partir del nivel 11: el juego sigue siendo jugable
      indefinidamente.
- [ ] Morir muestra un destello magenta antes de reaparecer, y durante ese destello no se
      puede morir otra vez.

## Integración con la plataforma

- [ ] El overlay de arranque anuncia los tres controles de RANARIA, no los de ROCAS.
- [ ] La partida no empieza hasta pulsar ESPACIO, y esa pulsación no provoca ningún efecto
      dentro del juego.
- [ ] El HUD muestra la puntuación real y el nivel.
- [ ] El HUD muestra tres corazones al empezar y va perdiendo uno por cada muerte.
- [ ] El canvas **no** dibuja puntuación, vidas, nivel, GAME OVER ni overlay de pausa. La
      barra de tiempo sí, y es lo único parecido.
- [ ] `Escape` y el botón PAUSA congelan el juego; cambiar de pestaña también.
- [ ] Teclear con la partida en pausa no tiene efecto al reanudar: la rana no salta sola al
      volver.
- [ ] Volver de otra pestaña no teletransporta el tráfico ni mata a la rana sola.
- [ ] Al perder la tercera vida se abre el modal "FIN DEL JUEGO" con la puntuación final.
- [ ] El botón FIN termina la partida y abre el modal con lo puntuado.
- [ ] Pulsar FIN después de un game over natural no registra una segunda partida.
- [ ] "JUGAR DE NUEVO" reinicia con puntuación 0, nivel 1, tres vidas, los cinco nenúfares
      vacíos y la rana en la orilla.
- [ ] Con sesión iniciada, terminar una partida crea **exactamente una** fila en
      `game_sessions` con `game_id = 'ranaria'`.
- [ ] Esa fila lleva el `level` alcanzado y un `ended_reason` de `game_over` o `surrender`
      según cómo se terminara.
- [ ] Esa partida aparece en `/salon`, en la pestaña de RANARIA.
- [ ] Pausar un rato no infla el `duration_ms` registrado.
- [ ] Sin sesión, el modal de fin sigue pidiendo iniciales y guarda en `localStorage`, como
      el resto.

## Lo que no debe romperse

- [ ] `/juego/rocas/jugar`, `/juego/caida/jugar`, `/juego/bloque-buster/jugar` y
      `/juego/serpentina/jugar` siguen funcionando igual, con sus controles.
- [ ] Los otros tres juegos (`gloton`, `invasores`, `duelo-pixel`) siguen con el reproductor
      simulado y no registran partidas.
- [ ] La tarjeta de RANARIA en `/biblioteca` y su detalle `/juego/ranaria` se ven igual que
      antes: misma portada, misma descripción, mismo `best` mock de 18.900.
- [ ] Navegar fuera de `/juego/ranaria/jugar` y volver arranca una partida limpia, sin bucles
      duplicados ni tráfico a doble velocidad.
- [ ] A 375 px de ancho la pantalla no produce scroll horizontal y sale el aviso de teclado.
