# Daily PWT · Requisitos de F1

Base: [PRD](PRD.md) (la §0 manda). Arquitectura: [ARQUITECTURA.md](ARQUITECTURA.md).

## 1. Alcance

F1 entrega el núcleo jugable: generador diario determinista, datos verificados de 6 entrenadores, pool del jugador (Smogon Gen 5 y sets de los rivales), combate 6v6 Gen 5 a Nv. 50 contra IA heurística y pantalla Hoy.

Lo marcado **[F1, se amplía]** es alcance de F1 y crece en F2/F3. Lo marcado **[regla]** es definitivo, aunque ajustable.

| PRD | En F1 | Fuera de F1 |
|---|---|---|
| §4.1/4.2 Reto y generador | Todo | — |
| §4.3 Oficial/prácticas | Nada: todo combate es libre, ilimitado y sin registro | F3 |
| §5 Reglas | Todas | — |
| §6 Equipo del jugador | Reglas de generación y pool de Smogon Gen 5 (todos los tiers de individuales) más los sets de los rivales | Validación por script completa (F2) |
| §7 Roster | 6 entrenadores **[F1, se amplía a 53 en F2]** | 53 entrenadores (F2) |
| §8.3 Validación | Test unitario con lo básico **[F1, se amplía a script CI en F2]** | Script CI (F2) |
| §9 IA | Reglas 1-5 | Calibración final (F2) |
| §10.1 Hoy | Todo salvo iconos Estadísticas/Ayuda/Ajustes, doble botón y **panel de emparejamientos (eliminado el 19/10/2026, PRD §0)**; botón único "Combatir"; un solo tema, con el estilo de los menús de N2/B2 y del PWT **[F1, se amplía en F3]** | F3 |
| §10.2 Combate | Todo salvo etiqueta OFICIAL/PRÁCTICA | F3 |
| §10.2.1 Intro | Sí (pasó de F3 a F1 el 19/10/2026) | — |
| §10.3 Resultado | Mínimo | Compartir, estadísticas, cuenta atrás (F3) |
| §10.4-10.6 | No | F3 |
| §10.7 Sprites | Solo especies y entrenadores de F1 **[F1, se amplía en F2]** | Descarga de todo el roster (F2) |
| §11 Persistencia, rachas, compartir | No | F3 |

## 2. Decisiones cerradas

1. Entrenadores de F1: Brock (2 variantes: Líderes de Kanto y Mundial), Misty, Camila, Plubio, Rojo y Máximo (adelantado de F2, ver PRD §0). Cubren `alwaysLeadsWith`, IV 20/25/30, primera fase con Mineral Evolutivo y habilidades dobles.
2. `LAUNCH_DATE` provisional = 2026-10-19, constante editable en `src/core/launch.ts` (`src/config.ts` la reexporta). Una fecha anterior cuenta como `#1`. Es un apaño para que el 2026-10-21 toque Máximo con el roster de 6 (ciclo de 6 días, sin entrada nueva en `rosterSchedule`); se fija en F2 y entonces se regeneran los snapshots.
3. Sprites: solo las especies y entrenadores de F1, descargados una vez al repo, con texto de reserva si falta alguno.
4. **[regla]** Naturaleza neutra (Seria) si el set no la indica; se marca en los datos.
5. Validación de datos en F1 como test unitario.
6. **[regla]** Aviso fan no oficial en el pie de Hoy; en F3 también en Ayuda.
7. **[regla]** Equipo del jugador sin solución: máximo 1000 intentos; después se relaja solo RF-14; si sigue sin solución, error de datos.
8. **[regla]** "Ataque eficaz ×2" solo por tipos, sin habilidades. (El panel de emparejamientos que mostraba el rango mín–máx se eliminó, RF-37.)
9. Dificultad: comprobación preliminar con los rivales de F1; calibración con 20 partidas en F2.
10. Hoy con botón único "Combatir", sin iconos de cabecera y un solo tema. Salir del combate pide confirmación y descarta la partida.
11. **[regla]** 300 turnos y empate cuentan como derrota.
12. **[regla]** Si el primero de un ciclo de la bolsa coincide con el último del ciclo anterior, se intercambia con la posición 1 para no repetir rival dos días seguidos.
13. Fuente pixelada: Pixelify Sans (OFL). No se usa `PokemonXandY.ttf` (licencia dudosa y no es de Gen 5).
14. Rama: `main` (repo nuevo).

## 3. Requisitos funcionales

### Generador diario
- RF-01 La fecha local del dispositivo (`YYYY-MM-DD`) es la entrada del reto.
- RF-02 `getDailyChallenge(date, data)` es pura: mismas entradas, mismo reto. Sin `Math.random()` ni fuentes no deterministas.
- RF-03 Semilla: `hash("daily-pwt:v1:" + fecha)` con PRNG determinista.
- RF-04 El reto contiene: rival, variante, habilidad elegida de cada Pokémon rival, primer Pokémon rival, 6 sets del jugador con su habilidad y el número `#N`.
- RF-05 Rival por bolsa barajada: roster ordenado y barajado con semilla fija por ciclo; el día *n* del ciclo toca la posición *n*; sin repeticiones dentro del ciclo; al acabar se baraja con otra semilla (regla 12 de §2).
- RF-06 Variante uniforme con el PRNG del día; variantes idénticas se deduplican antes.
- RF-07 Habilidad con dos opciones: se elige con el PRNG del día (rival y jugador).
- RF-08 `alwaysLeadsWith` se respeta; si no existe, el primero se elige con el PRNG del día.
- RF-09 `#N` = días desde `LAUNCH_DATE` + 1.

### Equipo del jugador
- RF-10 6 sets del pool elegidos con el PRNG del día.
- RF-11 Pool del jugador (`data/player-sets.json`, `npm run gen:player-sets`): los sets de Smogon de Gen 5 en individuales (Ubers, OU, UU, RU, NU, PU y ZU; solo objeto, habilidad y movimientos, con la regla de alternativas de DEC-31) más los sets totalmente evolucionados de todas las variantes de los rivales de F1, deduplicados, varios por especie, sin los del rival del día. Cada set pasa por el validador de `@pkmn/sim` (Gen 5) y por las prohibiciones del PWT; los descartados se listan en `data/smogon/discarded.json`.
- RF-11b Precarga: desde Hoy se piden con prioridad baja los gráficos de interfaz del combate y los sprites de los 12 Pokémon del reto (nunca los del resto del pool), y las pantallas de equipo y de datos no se enseñan hasta tener sus imágenes (DEC-33).
- RF-11c Los PS numéricos del jugador bajan o suben a la par de la barra (lineal, 700 ms a x1, enteros en cada fotograma, sin animación con `prefers-reduced-motion`) y terminan en el PS exacto (DEC-34).
- RF-12 Sin Pokémon evolucionables, especies repetidas, objetos repetidos ni legendarios prohibidos (lista de PRD §6).
- RF-13 Al menos 4 tipos distintos.
- RF-14 Al menos un movimiento de daño ×2 o más por tipos contra algún Pokémon del rival.
- RF-15 Si la tirada incumple, se repite con el siguiente valor del PRNG (regla 7 de §2).
- RF-16 IV iguales a los del rival del día (20 contra líderes, 25 contra campeones, 30 contra Rojo; `buildPlayerTeam` los toma de `rivalTeam[0].ivs`, función pura), EV 0, Nv. 50 y naturaleza Seria (regla 4). Hoy (tarjetas), la pantalla de datos y el motor usan estos IV a través del `ResolvedSet` del jugador.

### Datos
- RF-17 Esquema PRD §8.2; 6 Pokémon a Nv. 50 por variante; `sourceTournament` y `sourceUrl`.
- RF-18 Todos los sets de F1 con `verified: true` (dos fuentes).
- RF-19 IV del rival: 20 líderes, 25 campeones, 30 Rojo.
- RF-20 EV del rival: los del juego; si no se encuentran, 0 y marcado en los datos.
- RF-21 Todos los nombres mostrados en español.

### Pantalla Hoy
- RF-30 Cabecera: logo, `#N`, cuenta atrás hh:mm:ss hasta la medianoche local.
- RF-31 Al llegar a 0, sin recargar, se muestra el reto nuevo y la cuenta atrás reinicia.
- RF-32 Tarjeta del rival: sprite, nombre, categoría, región y tipo de especialidad (si existe). No muestra el torneo de origen; `sourceTournament` y `sourceUrl` se conservan en los datos (PRD §7.4).
- RF-33 Equipo rival: 6 especies visibles.
- RF-34 Toggle "Ver movimientos y objetos del rival", oculto por defecto (`aria-expanded`). Abierto, cada Pokémon rival usa el mismo componente que las tarjetas del jugador, sin estadísticas: sprite, nombre, tipos (iconos en español), objeto y habilidad elegida con su etiqueta, y los 4 movimientos como filas (RF-35). El botón queda al final de los sets, su texto pasa a «Ocultar movimientos y objetos del rival» con `aria-expanded="true"`, y al ocultarlos la página sube con scroll suave (sin animación con `prefers-reduced-motion`) hasta el panel del rival.
- RF-35 "Tu equipo": 6 tarjetas con sprite, tipos, objeto y habilidad (con etiqueta), total de stats base, 6 stats reales a Nv. 50 y 4 movimientos como filas de rejilla fija: chip de tipo de ancho fijo en la misma columna en todas las filas, categoría con su icono, potencia y precisión en columnas alineadas ("—" si no aplica). Los iconos de tipo son la base de color ripeada con el nombre del tipo en español centrado, todos del mismo ancho.
- RF-35b Con la barra fija "Combatir", el contenido termina siempre por encima de ella: el último movimiento de la última tarjeta es visible al llegar al final.
- RF-36 "Sacar primero" por tarjeta; un único inicial seleccionado, visible.
- ~~RF-37 Panel de emparejamientos~~ **Eliminado (decisión de Jose, 19/10/2026, PRD §0)**: ya no hay panel, `estimate` ni carga diferida de `@smogon/calc` en Hoy. `damage.ts` y `@smogon/calc` siguen en el worker, para la IA (RF-50).
- RF-38 Botón único "Combatir"; desactivado sin inicial, con motivo visible.
- RF-39 Aviso de proyecto fan no oficial en el pie.

### Combate
- RF-40 Mecánicas Gen 5, Nv. 50, individual 6v6.
- RF-41 Sin cláusula de sueño ni de KO en un golpe. Cláusulas de especie y objeto solo en la generación del equipo del jugador.
- RF-42 Empieza con el inicial elegido y el primero del rival (RF-08).
- RF-43 PRNG del combate independiente de la semilla del reto y nuevo en cada combate.
- RF-44 Campo con ambos Pokémon (rival de frente, jugador de espaldas), barras de PS (rival solo en %, jugador actual/máx), estados y clima.
- RF-45 Indicador de Pokémon restantes por bando.
- RF-46 4 botones de movimiento: nombre y PP ("PP 24/24", centrados bajo el nombre con el mismo hueco tras "PP" para 1 a 3 cifras); el tipo se indica con el color del borde de la tesela y va en el nombre accesible ("Cascada, tipo Agua, PP 24 de 24"), sin icono ni texto de tipo visible; botón Volver ripeado del juego en su posición nativa; se desactivan los no utilizables (sin PP, Elección, Anulación, Mofa, Otra Vez…); si no queda ninguno, Forcejeo.
- RF-47 Botón Cambiar: abre la pantalla de equipo (RF-70); desactivado con motivo si está atrapado o no hay a quién.
- RF-48 Si el activo no puede elegir (recarga, dos turnos…), el turno avanza solo.
- RF-49 Debilitado o cambio forzado por movimiento: el jugador elige sustituto en la pantalla de equipo sin poder cancelar (sin Cancelar, sin Volver, Escape no sale). Datos (RF-71) sigue disponible.
- RF-50 IA del rival (PRD §9): 1) KO garantizado con más precisión; 2) mayor daño esperado; 3) estado/clima/estadísticas si es razonable; 4) cambio si hay clara desventaja y alguien resiste; 5) sucesor por mejor emparejamiento. Determinista dado el estado y el PRNG del combate.
- RF-51 Registro en español con mensajes propios (movimiento, efectividad, crítico, fallo, debilitado, cambio, estados, clima, objetos y habilidades comunes) y texto genérico en español de reserva. Nunca ids internos ni inglés.
- RF-52 Animaciones mínimas (bajada de PS, textos, debilitado) con control para acelerar.
- RF-53 Intro animada (PRD §10.2.1); el registro muestra "¡[Categoría] [Nombre] te desafía!", "¡[Nombre] saca a [Pokémon]!" y el envío del inicial. La Poké Ball sale de la mano del entrenador (jugador y rival) y cae donde aparece su Pokémon; es la bola de Negro/Blanco a su tamaño nativo.
- RF-54 Rendirse con confirmación = derrota; cancelar no cambia nada.
- RF-55 Gana quien debilita a los 6 rivales.
- RF-56 Límite de 300 turnos = derrota del jugador.
- RF-57 Aspecto fiel a N2/B2: campo, barras de PS, cajas de texto y menú de movimientos.

- RF-70 Pantalla de equipo (menú de cambio): ocupa las dos pantallas; la superior es la cuadrícula del juego y la inferior las 6 placas (icono de menú del Pokémon, nombre, nivel, género, barra de PS, PS actuales/máx y estado). Color de la placa: azul disponible, azul claro el activo, rojo el debilitado, verde el elegido. Al elegir una, el menú Cambiar / Datos / Cancelar; Cambiar queda desactivado con motivo (debilitado o ya en combate). Escape y Volver salen (no en el cambio forzado). Solo el equipo del jugador.
- RF-71 Pantalla de datos del Pokémon (desde el menú de equipo): fondo del juego a dos pantallas y tres páginas: Información (número de Pokédex, nombre, tipos, nivel, habilidad, naturaleza con la estadística que sube y la que baja, PS, objeto, género, sprite animado), Habilidades y estadísticas (PS con barra, 5 estadísticas reales a Nv. 50 con la naturaleza marcada, habilidad con su descripción, los 4 movimientos con tipo, PP actuales/máx) y Movimientos (detalle del elegido: categoría con icono, potencia, precisión y descripción). Navegación: botones « » de la cabecera, pestañas, ▲ ▼ (otro Pokémon), Volver y Cerrar; teclado ← → páginas, ↑ ↓ Pokémon, Escape vuelve. Los PS y PP son los del combate en ese momento.
- RF-72 Cambio de Pokémon animado, voluntario o forzado, del jugador y del rival: el entrenador entra, el rayo rojo retira al Pokémon (si seguía en pie) y lanza la bola del nuevo, con la secuencia de la intro (1,6 s a x1; 1,1 s si el anterior estaba debilitado). Respeta la velocidad x1/x2/x4; con `prefers-reduced-motion` solo fundidos. Los mensajes siguen saliendo uno a uno y el historial no cambia; los controles se abren al terminar. Arrastrar (Remolino, Rugido) no lleva bola.
- RF-73 Mochila: botón atenuado (`aria-disabled`) con motivo accesible; al tocarlo la caja de texto dice que en el PWT no se pueden usar objetos.
- RF-77 La caja de mensajes del combate no muestra «Turno N» (sigue en el historial/Registro).
- RF-78 Al elegir un movimiento o un cambio, la pantalla táctil vuelve al fondo de espera, sin botones ni menú de movimientos, mientras se resuelve el turno (un solo `choose` por turno, RF-52/CMP-16); al empezar el turno siguiente reaparece el menú principal (Luchar, Mochila, Rendirse, Pokémon) y el foco vuelve a Luchar si se había perdido. El mensaje actual sigue siendo una región `aria-live`.
- RF-75 Barra superior del combate: en escritorio Salir, Registro y Velocidad van en una sola línea (los contadores debajo); en móvil, en una fila sobre el lienzo.
- RF-76 Intro y cambios: el entrenador (rival o protagonista) termina de salir antes de que aparezca su Pokémon y no queda ningún entrenador visible al acabar.
- RF-74 Pantalla táctil: los cuatro rótulos (Luchar, Mochila, Rendirse, Pokémon) usan la misma fuente y el mismo contorno.

### Resultado
- RF-60 Victoria/derrota, turnos, Pokémon del jugador en pie; en derrota, rivales debilitados (x/6).
- RF-61 Volver a Hoy o empezar otro combate con el mismo reto.

## 4. Requisitos no funcionales
- RNF-01 Carga inicial < 3 s en 4G. RNF-02 Turno < 300 ms sin animaciones.
- RNF-03 Usable a 360 px sin scroll horizontal, táctil.
- RNF-04 Contraste AA; tipo y efectividad no solo por color; todo navegable con teclado.
- RNF-05 Español; textos centralizados.
- RNF-06 Pixel art sin suavizar (`image-rendering: pixelated`), en el repo. Los sprites del campo y el lienzo de combate usan escala entera desde x2 (1280×800 vale 2); por debajo de x2 el lienzo ocupa todo el ancho disponible con escala fraccionaria (360 px vale ≈1,4). El texto va en la fuente del juego a su tamaño de píxel dentro del lienzo, escalado con él.
- RNF-07 Sitio 100 % estático. RNF-08 Dos últimas versiones de Chrome, Safari iOS y Firefox.
- RNF-09 Tests: snapshot del generador, no repetición en un ciclo, reglas del equipo en un ciclo, validación básica de datos, IA por regla, e2e de partida completa contra IA trivial.
- RNF-10 Verificación visual con capturas a 360 px y escritorio (playwright-cli) y revisión con web-design-guidelines.
- RNF-11 Pantallas fuera del combate: estética híbrida (moderna con detalles retro).

## 5. Casos límite y negativos
- Medianoche con Hoy abierta: cambia el reto. Con combate en curso: sigue con el reto con que empezó.
- Cambio de hora (días de 23/25 h): la cuenta atrás termina en la medianoche local real.
- Reloj o zona cambiados: se usa la fecha del dispositivo.
- Rival con una variante: siempre esa. Variantes idénticas: deduplicadas.
- Primeras fases válidas en el rival, nunca en el pool del jugador.
- Misma especie en varios rivales: puede entrar cualquiera, solo una por especie.
- Debilitamientos simultáneos: regla del simulador; empate = derrota.
- Ida y Vuelta/Voltiocambio sin banquillo: se resuelve sin cambio.
- Sprite ausente: caja con el nombre en lugar de imagen rota.
- Varias pulsaciones seguidas: una sola acción por turno; controles desactivados durante animación o turno rival.
- Datos corruptos o no cargados: mensaje de error en español en Hoy, sin pantalla en blanco.
- Fallo del motor: mensaje de error con opción de volver a Hoy.
- No debe ocurrir: retos distintos para la misma fecha; el PRNG del combate alterando el reto; equipo que incumpla RF-12; texto en inglés o ids internos.

## 6. Criterios de aceptación F1
1. Misma fecha → mismo rival, variante, habilidades, primer rival y equipo del jugador.
2. Medianoche local: Hoy cambia de reto sin recargar y la cuenta atrás reinicia.
3. En un ciclo completo de la bolsa no se repite entrenador (test).
4. Snapshot de `getDailyChallenge` con fechas de referencia.
5. Reglas de PRD §5 aplicadas (Nv. 50, Gen 5, IV/EV, `alwaysLeadsWith`, sin cláusulas de sueño ni OHKO).
6. El jugador elige movimiento o cambio cada turno; el rival responde según la IA; tests de las reglas 1, 4 y 5 de la IA.
7. Rendirse con confirmación termina como derrota.
8. En todas las fechas de un ciclo el equipo cumple RF-12, RF-13 y RF-14.
9. Sets de F1 con `verified: true` y legales en Gen 5.
10. Sprites N2/B2 de las especies y entrenadores de F1; Pokémon animados y nítidos.
11. E2E de partida completa contra IA trivial en verde.
12. Hoy y Combate a 360 px y escritorio; capturas revisadas con web-design-guidelines.
13. Uso completo con teclado y contraste AA.
