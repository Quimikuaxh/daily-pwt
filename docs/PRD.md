# Daily PWT · Documento de requisitos (PRD)

> Versión 1.5 · 15/10/2026 (incorpora las respuestas de Jose). Las decisiones marcadas con **[DEFAULT]** son valores por defecto mientras Jose no diga lo contrario; están recogidas en la §15.
> Las decisiones de proyecto tomadas al arrancar el desarrollo están en la §0.
> Documentos de F1: [Requisitos F1](REQUISITOS-F1.md) · [Arquitectura](ARQUITECTURA.md).

---

## 0. Decisiones de arranque (17/10/2026)

| Tema | Decisión | Motivo / alcance |
|---|---|---|
| Repositorio | `daily-pwt/` como repo git propio en `main` | Igual que el resto de proyectos del directorio |
| Flujo | Agente `sw-dev` (PO → arquitecto → test plan → tests → dev → review) | Como en pokemon-heardle y home-planner; este PRD es la base de requisitos |
| Entrega | Por fases (ver abajo) | Reducir riesgo: combate jugable antes de cargar los 53 entrenadores |
| Estética | **Combate fiel a N2/B2; resto híbrido** | La pantalla de combate (campo, barras de PS, cajas de texto, menú de movimientos) imita la de Negro 2 / Blanco 2. Hoy, Estadísticas, Ayuda y Ajustes son modernas con detalles retro (sprites pixelados, algún marco o fuente de juego), no una réplica de menús de DS |
| Datos de referencia | Consultar el proyecto `../claude-test` (Pokémon Team Builder) | Ya resuelve datos de Pokémon, movimientos, sprites y nombres en español; reutilizar sus fuentes y enfoques en vez de rehacerlos. Se consulta y se copia lo útil; no se crea dependencia de ese repo |
| Máximo en F1 (21/10/2026) | **Máximo (Steven Stone) se adelanta de F2 a F1**: roster de F1 = 6 entrenadores, equipo del Torneo Campeones (único de 6 Pokémon a Nv. 50 que tiene en el PWT), IV 25, siempre saca primero a Metagross (§5). Para que el rival del 2026-10-21 sea Máximo se ajusta `LAUNCH_DATE` de 2026-10-17 a **2026-10-19** (provisional) con Máximo en la entrada base de `rosterSchedule` (bolsa rebarajada desde el inicio, sin entrada nueva) | Decisión de Jose. Es un apaño: cambia el rival de todas las fechas; la `LAUNCH_DATE` definitiva se fija en F2. Descartado: entrada nueva de calendario (no coloca a Máximo en esa fecha) |
| Roster completo y calendario (21/10/2026) | **Los 53 entrenadores se barajan todos juntos** (solo azar, sin restricciones de región) en una única entrada base del `rosterSchedule`, rebarajada desde el inicio: no se mantienen los 6 de F1 delante ni se añaden los 47 en una entrada posterior. `LAUNCH_DATE` sigue provisional (2026-10-19) y la fija Jose al final; con la fecha actual los días ya jugados (19 a 21 de octubre) pasan a Hiedra, Fredo y Antón y Máximo toca el 2026-11-26 (ver `F2-DATOS.md`, «Calendario») | Decisión de Jose. Cambia los retos ya publicados. Descartado: mantener los 6 delante, entrada de calendario nueva en fecha futura y restricciones por región |
| Skills de diseño | `web-design-guidelines` (revisión UI/accesibilidad) y `playwright-cli` (verificación visual con capturas) | `taste-skill` excluye pantallas de app; solo se aprovecha su bucle mirar-y-corregir sobre capturas. `image-to-code` no aplica (requiere generar imágenes) |

### Redirección visual (19/10/2026)

Sustituye la fila "Estética" de la tabla anterior y la fuente Pixelify Sans de REQUISITOS-F1.

| Tema | Decisión | Motivo / alcance |
|---|---|---|
| Estética de toda la app | **Fiel a N2/B2 en toda la app**. Combate como la pantalla de batalla real; Hoy y Resultado como los menús de N2/B2 y del PWT (paneles oscuros con franjas, cajas blancas y negras con borde, botones de la pantalla táctil) | El estilo híbrido daba una app genérica que no se reconocía como Pokémon. Descartado: estilo de la web oficial de Pokémon |
| Combate | Fondos de combate y elementos de interfaz (cajas de PS, caja de texto, botones de movimiento) **ripeados de N2/B2** (The Spriters Resource, Showdown), descargados al repo y acreditados en Ayuda. Tamaños y posiciones de los Pokémon como en el juego. Mensajes uno a uno en la caja de texto, como en el juego; el historial completo, aparte y a demanda | Fidelidad. Descartado: recrear fondos en CSS/SVG (poco fiel) y el registro con scroll siempre visible (no es como el juego) |
| Fuente | **Réplica fan de la fuente de N2/B2**, descargada al repo y acreditada | Se acepta el mismo riesgo de licencia que con los sprites. Descartada: Pixelify Sans (no se parece a la del juego) |
| Intro del combate (§10.2.1) | **Pasa de F3 a F1** | Es parte de que el combate se sienta como el juego |
| Panel de emparejamientos (§10.1) | **Eliminado** | Decisión de Jose: sobra en la pantalla Hoy |
| Menú de cambio de Pokémon (§10.2) | **Igual que el del juego**: pantalla táctil con los 6 Pokémon del equipo (icono, nombre, nivel, barra de PS y PS, estado; debilitados marcados) y al elegir uno, opciones de cambiar o ver datos | Fidelidad a N2/B2 |
| Pantalla de datos del Pokémon (en combate) | **Igual que la del juego**: fondo, tipografía, distribución y detalle (sprite, tipos, nivel, PS, estadísticas, habilidad, objeto, movimientos con tipo, PP, categoría, potencia y precisión) | Fidelidad a N2/B2 |
| Animación de cambio de Pokémon | Al cambiar (voluntario o forzado, en ambos lados): el Pokémon vuelve a su Poké Ball con el rayo rojo y se lanza el nuevo con la misma secuencia de Poké Ball de la intro | Fidelidad a N2/B2 |
| Torneo de origen en la tarjeta del rival (§10.1) | **No se muestra** en la interfaz. Se mantiene `sourceTournament` en los datos para trazabilidad (§7.4) | Decisión de Jose: no aporta al jugador |
| Escala del combate en móvil | Por debajo del ancho que permite x2, el combate **ocupa todo el ancho disponible** con escala fraccionaria y `image-rendering: pixelated` (sin suavizado). A partir de x2, múltiplos enteros como hasta ahora | Decisión de Jose: a escala 1 se veía demasiado pequeño en móvil. Se acepta la leve irregularidad de píxeles. Descartados: escala 1 exacta (pequeño) y escala fraccionaria suavizada (borroso). Sustituye la decisión anterior de mantener escala 1 a 360 px |
| Pool de sets del jugador (§6) | **Varios sets por Pokémon**: los de Smogon de Gen 5 en individuales (Ubers, OU, UU, RU, NU y demás tiers de individuales; sin dobles ni LC) más los sets de los rivales del PWT. De Smogon solo se toman objeto, habilidad y movimientos. **Adelantado a F1** (rama `fix/pulido-combate`): el pool provisional daba equipos casi solo de Agua, Eléctrico y Roca | Decisión de Jose. Sustituye al pool provisional (solo sets de rivales). Las reglas de §6 (totalmente evolucionados, sin repetidos, sin legendarios prohibidos en el PWT) siguen aplicando |
| IVs, EVs y naturaleza del jugador (§5) | **Los mismos IVs que el rival del día** (20 contra líderes, 25 contra campeones, 30 contra Rojo), **EVs 0 y naturaleza Seria** | Decisión de Jose: igualar al jugador con el rival de cada día. Sustituye a IVs 31. Descartados: EVs y naturalezas de Smogon (el jugador quedaba muy por encima) |
| Alojamiento y rachas (§11, §12) | **GitHub Pages**, sitio estático. Rachas y estadísticas **solo locales** (`localStorage`), sin cuentas ni backend | Decisión de Jose: la racha local basta. Implica que las rachas van por navegador y se pierden al borrar datos. Descartado: backend (p. ej. Supabase) para sincronizar entre dispositivos o clasificaciones |
| Música de combate | **En F3.** Cada combate suena con el tema del PWT que corresponde al rival (remix de líder o campeón de su región), con silencio y volumen en Ajustes y sin sonar hasta la primera interacción del usuario. Pistas descargadas de YouTube (las del catálogo de `../pokemon-heardle`), guardadas en el repo y acreditadas | Decisión de Jose. Saca el sonido de "fuera del MVP" (§13) solo para la música de combate |
| Combate oficial único, reanudar y práctica (§4.3, §11) | **Adelantado de F3 a F2** (rama `feature/f2-roster`): un oficial al día que queda registrado al empezar (salir, recargar o rendirse no dan otro intento), reanudación tras recargar en el mismo turno sin repetir la intro, y prácticas ilimitadas que no cuentan | Decisión de Jose: ahora se puede salir y repetir, y recargar pierde la partida |
| Equilibrio del equipo del jugador (§6) | Nuevas reglas de generación, además de las de §6: **suma de estadísticas base de los 6 ≥ 2800** y **como máximo 3 Pokémon que compartan un mismo tipo** (cada tipo de un Pokémon de doble tipo cuenta). Se aplican por código y siguen siendo deterministas | Decisión de Jose: evitar equipos muy flojos o monotemáticos. Descartados: mínimo por Pokémon (450) y máximo de 2 por tipo |
| Modo PWT (fase futura, tras F3) | Modo de torneo: el jugador se enfrenta con el **mismo equipo a 7 entrenadores aleatorios** seguidos | Idea de Jose. **Libre y repetible sin límite** (no es diario). Por definir: curación entre combates, si cuenta para estadísticas |
| Logros (fase futura, tras F3) | Sistema de logros con **login opcional**: el reto diario sigue jugándose sin cuenta. Con sesión iniciada, la **racha diaria y los logros se guardan en la cuenta**; sin sesión, la racha sigue guardándose en local | Idea de Jose. Requiere backend (cuentas y almacenamiento), lo que cambia la decisión de alojamiento "solo GitHub Pages, sin backend": habrá que elegir servicio (p. ej. Supabase, como en pokemon-heardle) |
| Efectos de sonido de combate | **En F3, junto a la música.** Sonidos de golpe según efectividad (supereficaz, poco eficaz, neutro), y los básicos del combate (Poké Ball, debilitado), ripeados de N2/B2, guardados en el repo y acreditados. Comparten silencio y volumen con la música | Decisión de Jose |
| Orden de los textos del golpe (22/10/2026) | Crítico, efectividad (supereficaz, poco eficaz), Robustez, Banda Focus, Cinta Focus y Aguante salen **después de que la barra de PS termine de bajar**, en ese orden | Decisión de Jose: así es en N2/B2 |
| Nombres en la caja de PS (22/10/2026) | Se **reduce el tamaño del nombre para todos** los Pokémon, no solo para los largos. Nombre y género **alineados a la derecha, junto al nivel**: un nombre más largo crece hacia la izquierda | Decisión de Jose. Descartado: estrechar o reducir solo los que no caben |
| Ramas de F3 (22/10/2026) | `fix/bugs-combate` → `feature/f3-estadisticas` → `feature/f3-ayuda-ajustes` → `feature/f3-sonido`, cada una **sobre la anterior** (las de F3 llevan los bugs corregidos) | Decisión de Jose |
| Estadísticas y compartir (22/10/2026) | Casillas 🟩/🟥 **en el orden del equipo**; la racha del texto es la **de victorias** (perder la pone a 0). Se guarda el estado de cada Pokémon del jugador al terminar; los días ya jugados sin ese dato se comparten sin cuadrícula. Un oficial `void` cuenta como jugado, no es victoria ni derrota, corta la racha de victorias y mantiene la de días. **Un día sin jugar rompe también la racha de victorias** (cuenta días seguidos ganados). Si hoy aún no se ha jugado, las rachas de ayer siguen vivas | Decisión de Jose. Descartado: que un día sin jugar no corte la racha de victorias |
| Ajustes (22/10/2026) | **Sin tema claro/oscuro** (no encaja con la estética de N2/B2). En escritorio, el juego va **enmarcado** (estilo consola o similar) en vez de flotar sobre el fondo. La **velocidad del combate** pasa también a Ajustes y se guarda entre sesiones | Decisión de Jose. Sustituye a «tema claro/oscuro» de §10.6 |
| Marco en PC (22/10/2026) | **DS sencilla**: carcasa oscura redondeada con un bisel en cada pantalla y la bisagra entre ambas, sin botones. En móvil, sin marco | Decisión de Jose sobre tres maquetas. Descartados: DS completa (cruceta y botones decorativos, más ancha) y marco con franjas del PWT |
| Clima en combate (22/10/2026) | En el hueco central de arriba de la pantalla táctil, con fondo del color del clima | Decisión de Jose (así lo recuerda del juego). Antes estaba arriba a la derecha, bajo la etiqueta OFICIAL/PRÁCTICA |
| Sonido (22/10/2026) | **Aparcado** hasta poder descargar los audios. Cuando se haga: activado por defecto (nada suena hasta la primera interacción), música solo en combate (y el jingle de victoria en Resultado si se gana), silencio y volumen en Ajustes. El tema de Mirto lo confirma Jose | Decisión de Jose. Descartado: música también en Hoy y Resultado |
| Retoques de Hoy y ventanas (22/10/2026) | Cuenta atrás en una placa como la de los botones de la cabecera; rótulos de sección que se desvanecen hacia la derecha; sin negrita ni cursiva inventadas sobre la fuente de píxel; las ventanas largas (Ayuda) desplazan solo el contenido | Peticiones de Jose sobre capturas |
| Mochila = equipo rival (22/10/2026) | El hueco de la Mochila del combate es el botón **RIVAL**: abre el equipo del rival con el mismo aspecto que el propio, **solo para consultar Datos** (sin Cambiar). Se ven **los 6** con su set completo (Hoy ya lo enseña), **PS en porcentaje** y **los PP que le quedan** (cambio del 22/10/2026: antes solo los máximos) | Decisión de Jose. Descartados: rótulo MOCHILA o EQUIPO RIVAL, PS exactos y ocultar los no vistos |
| Cambio del rival tras un KO (22/10/2026) | El entrenador **entra deslizándose desde la derecha, lanza la Poké Ball y sale** deslizándose (antes aparecía ya en el centro); igual en el lado del jugador | Decisión de Jose |
| Estado en la placa del equipo (22/10/2026) | Siempre en la misma posición horizontal y **centrado en vertical con los PS** | Decisión de Jose. Descartado: pegarlo a la cifra de PS |
| Animaciones de movimientos: primera tanda (22/10/2026) | **Genéricas por tipo y clase** (golpe físico, ataque especial y, de estado: subir, bajar, provocar estado, curar, proteger, sustituto, clima, trampas, pantallas y otros) **+ 20 propias** (los movimientos más usados entre rivales y pool). **Por código, en píxel** sobre el lienzo de la pantalla de arriba, con los colores del tipo. **Arrancan a la vez que el mensaje «X usó Y»**; no se animan los fallos ni los turnos de carga. **Interruptor en Ajustes** (activadas por defecto); con «reducir movimiento» del sistema no se muestran Mejora (22/10/2026): los físicos se distinguen por cómo golpean (mordisco, puñetazo, patada, corte o golpe) y los especiales sin animación propia tienen un efecto por tipo en vez de una bola («que no todo sean bolas; Lanzallamas no tiene sentido que sean bolas»). Segunda tanda de 20 propias (40 en total; lista en ARQUITECTURA DEC-53) | Decisión de Jose. Descartados: 40 propias en la primera tanda, solo genéricas, sprites dibujados a mano y animar después del mensaje |
| Poder Oculto con su tipo real (22/10/2026) | En Hoy, en el menú del combate, en Datos (propios y del rival) y en el color de su animación, Poder Oculto se muestra con **el tipo y la potencia que le dan sus IV** («Poder Oculto Lucha», 70). Con los IV del jugador (iguales en las seis características) sale Lucha 30 (IV 20), Siniestro 30 (IV 25) o Lucha 70 (IV 30). El mensaje del combate sigue diciendo «usó Poder Oculto», como el juego | Decisión de Jose |
| Accesos (22/10/2026) | Estadísticas, Ayuda y Ajustes como iconos en la cabecera de Hoy y también en Resultado | Decisión de Jose (§10.1) |
| Cabecera de Hoy en móvil (22/10/2026) | Hasta 640 px, **una sola fila**: el logo queda en la bola (sin el texto «Daily PWT»), `#N`, la cuenta atrás sin «Próximo reto en» y los tres iconos (44 px). Los dos textos siguen para lectores de pantalla | Decisión de Jose: en dos filas ocupaba demasiado. Descartados: dos filas más compactas y sacar la cuenta atrás de la cabecera |
| Descarga de la música (22/10/2026) | Se intenta desde la nube; si la red lo bloquea, Jose la lanza en local con el script | Decisión de Jose |
| Animaciones de movimientos | **Propias, lo último del proyecto (después de F3)**, en pixel art coherente con el lienzo de N2/B2 | Decisión de Jose. Descartados: las originales de N2/B2 (el juego las genera en tiempo real; no existen ripeadas) y las de Pokémon Showdown (arte de terceros y licencia del cliente sin confirmar). También descartado grabarlas desde un emulador con la ROM: no aísla bien los efectos de cámara y tintes, y exige grabar y limpiar cientos de movimientos |

**Fases**
- **F1:** generador diario determinista + datos de unos pocos entrenadores (verificados) + pool provisional del jugador + combate 6v6 jugable con IA heurística + pantalla Hoy.
- **F2:** los 53 entrenadores con todas sus variantes, scripts de datos y validación (§8.3), descarga de sprites (Pokémon y entrenadores).
- **F3:** oficial/práctica/reanudar, estadísticas, compartir, Ayuda, Ajustes y pulido.

---

## 1. Visión

**Daily PWT** es un juego web diario, inspirado en [Daily Red](https://daily-red.com/), en el que cada día todos los jugadores se enfrentan al **mismo rival elegido al azar entre los entrenadores del Pokémon World Tournament (PWT) de Pokémon Negro 2 / Blanco 2**: los 46 líderes de gimnasio de las cinco regiones y los 7 campeones. El rival usa **uno de sus equipos definidos en el PWT**, también elegido al azar.

El jugador tiene **un combate oficial al día**, puede practicar sin límite, y comparte un resultado sin spoilers, al estilo Wordle.

**Objetivo de producto:** un reto rápido (5-15 min), rejugable cada día, que premie conocer tipos, sets y mecánicas de 5ª generación, y que se sienta "fiel al PWT".

---

## 2. Referencia: cómo funciona Daily Red

| Aspecto | Daily Red |
|---|---|
| Reto diario | Todos reciben los mismos 6 Pokémon aleatorios (Nv. 100, Gen 1-3). Cambia a medianoche **hora local**. |
| Rival | Siempre Rojo, equipo fijo (Pikachu, Espeon, Snorlax, Venusaur, Charizard, Blastoise), siempre abre con Pikachu. |
| Combate | Simulador tipo Pokémon Showdown con reglas de Gen 3. Cada turno: atacar o cambiar. Se elige el Pokémon inicial antes de empezar. |
| Información | Cada Pokémon del jugador muestra objeto, habilidad, total de estadísticas base y las 6 estadísticas. Panel "Today's matchups" (quién de tu equipo golpea fuerte a cada rival y cuánto te hace él). Toggle para ver movimientos y objetos de Rojo. |
| Intentos | 1 combate oficial al día. Prácticas ilimitadas que no afectan a la racha. |
| Persistencia | Si sales a mitad de combate, se guarda y se reanuda. Todo en el navegador, sin cuenta. |
| Estadísticas | Jugados, % victorias, racha de victorias, racha de días. |
| Compartir | Cuadrícula de resultado sin spoilers. |
| Otros | Cuenta atrás hasta el siguiente reto, consejos de estrategia, FAQ de mecánicas, aviso de proyecto fan no oficial. |

## 3. Qué cambia en Daily PWT

| | Daily Red | **Daily PWT** |
|---|---|---|
| Rival | Siempre Rojo | **Aleatorio cada día** entre los 53 entrenadores con equipo en el PWT (46 líderes y 7 campeones) |
| Equipo rival | Fijo | **Aleatorio entre los equipos definidos** de ese entrenador (variantes por torneo del PWT) |
| Generación / reglas | Gen 3, Nv. 100 | **Gen 5 (mecánicas de N2/B2), Nv. 50** como en el PWT |
| Formato | 6 contra 6 | **6 contra 6** (confirmado) |
| Equipo del jugador | 6 aleatorios Gen 1-3 | 6 aleatorios de un **pool de sets propio** que definirá el equipo (ver §6) |

---

## 4. Mecánica diaria

### 4.1 Reto del día
- Cada día natural hay un **reto** identificado por un número correlativo (`#1` = día de lanzamiento).
- El reto se compone de: **rival**, **variante de equipo del rival** y **equipo del jugador**.
- Todos los jugadores reciben el mismo reto para la misma fecha.
- **[DEFAULT]** El día cambia a medianoche **en la zona horaria local del jugador** (como Daily Red). La fecha local `YYYY-MM-DD` es la entrada del generador.

### 4.2 Generación determinista
- Todo el reto se deriva de una semilla: `seed = hash("daily-pwt:v1:" + YYYY-MM-DD)` con un PRNG determinista (p. ej. `sfc32` o `mulberry32`). Nada depende de `Math.random()`.
- El generador es una función pura `getDailyChallenge(date, dataVersion) → Challenge`, testeable.
- **Selección del rival sin repeticiones cercanas [DEFAULT]:** "bolsa barajada". Se baraja el roster completo con una semilla fija por ciclo; el día *n* del ciclo toca la posición *n*. Ningún entrenador se repite hasta que han salido todos. Al acabar el ciclo se baraja de nuevo con otra semilla.
- **Variante:** dentro del rival, se elige una de sus variantes de equipo con el PRNG del día (uniforme).
- **Cambios de datos:** si se añaden entrenadores, el cambio aplica desde el siguiente ciclo, para no alterar retos ya jugados. Las fechas pasadas deben seguir generando el mismo reto (test de regresión con fechas fijas).

### 4.3 Intento oficial y prácticas
- **1 combate oficial por día.** Al empezarlo queda registrado; abandonar o recargar no da otro intento (se reanuda).
- **Rendirse** cuenta como derrota.
- **Prácticas ilimitadas** con el mismo reto del día; no cuentan para estadísticas. Disponibles antes y después del oficial **[DEFAULT]**.
- Un combate oficial empezado el día N y terminado después de medianoche cuenta para el día N.

---

## 5. Reglas del combate

- **Mecánicas:** Generación 5 (Pokémon Negro 2 / Blanco 2). Clima permanente por habilidad, Gemas, Mineral Evolutivo, categorías físico/especial por movimiento, etc.
- **Formato (confirmado): combate individual 6 contra 6**, como Daily Red. El rival usa su equipo completo y el jugador sus 6.
- **Nivel:** todos los Pokémon a **Nv. 50**.
- **IVs/EVs del rival:** según el juego. En el PWT los IVs son fijos: líderes 20, campeones 25, Rojo 30 (fuente: WikiDex). EVs: usar los datos del juego si se encuentran; si no, 0 **[DEFAULT]** y marcarlo en los datos.
- **IVs/EVs del jugador:** los mismos IVs que el rival del día (20/25/30), EVs 0, naturaleza Seria (ver §0). Ajustable tras pruebas de dificultad.
- **Primer Pokémon del rival:** si el entrenador tiene regla "siempre saca primero X" (p. ej. Brock → Onix, Misty → Starmie, Lance → Dragonite, Máximo → Metagross, Plubio → Milotic), se respeta. Si no, el primero se elige con el PRNG del día.
- **Primer Pokémon del jugador:** lo elige el jugador antes de empezar.
- **Cláusulas:** las del juego, no las de Smogon. Sin cláusula de sueño ni de KO en un golpe (p. ej. Frío Polar de Walrein es legal). Cláusula de especie y de objeto solo para generar el equipo del jugador.
- **Fin:** gana quien debilite a los 6 rivales. Sin límite de turnos (opcional: límite técnico de 300 turnos = derrota, para evitar bucles).
- **Aleatoriedad del combate:** el PRNG del combate es independiente de la semilla del reto y nuevo en cada intento (los críticos/fallos no son iguales para todos). Se guarda para poder reanudar.

---

## 6. Equipo del jugador

**Decisión de Jose:** los sets del jugador los definirá el equipo del proyecto (o se tomarán de una fuente que Jose investigará). El juego debe funcionar con cualquier pool que cumpla este contrato:

- **Fichero de datos propio** `data/player-sets.json` con una lista de `PokemonSet` (mismo esquema que §8.2, más un campo `tags` opcional).
- **Reglas de generación** (aplicadas por código, no por los datos):
  - 6 sets elegidos con el PRNG del día.
  - Solo Pokémon totalmente evolucionados (sin primeras fases ni fases intermedias).
  - Sin especies repetidas y sin objetos repetidos.
  - Sin los legendarios prohibidos en el PWT (Mewtwo, Mew, Lugia, Ho-Oh, Celebi, Kyogre, Groudon, Rayquaza, Jirachi, Deoxys, Dialga, Palkia, Giratina, Phione, Manaphy, Darkrai, Shaymin, Arceus, Victini, Reshiram, Zekrom, Kyurem, Keldeo, Meloetta, Genesect).
  - **Equilibrio del jugador (§0):** suma de estadísticas base de los 6 ≥ 2800 y como máximo 3 Pokémon que compartan un mismo tipo (cada tipo de un Pokémon de doble tipo cuenta).
  - **Equilibrio mínimo [DEFAULT]:** al menos 4 tipos distintos entre los 6, y al menos un Pokémon con un ataque eficaz (×2) contra algún miembro del rival. Si la tirada no cumple, se repite con el siguiente valor del PRNG (sigue siendo determinista).
- **Pool provisional para desarrollo [DEFAULT]:** mientras no exista el pool definitivo, se usan los sets totalmente evolucionados de los equipos rivales del propio dataset (excluyendo los del rival del día). Se sustituye cambiando solo el fichero.
- El validador de datos (§8.3) también valida este fichero.

---

## 7. Entrenadores y equipos

### 7.1 Alcance del roster (decisión de Jose: solo PWT)
- Solo entran entrenadores **con equipo propio de 6 Pokémon a Nv. 50 en el PWT** de Negro 2 / Blanco 2: los **46 líderes** y los **7 campeones**.
- **Fuera:** el Alto Mando, Iris y los especiales (Aura, Blasco, Plata, Israel, N, Ghechis...), porque no participan en el PWT. Matís y Acromo solo aparecen en el Torneo Fayenza a Nv. 25 y Bel solo en torneos de alquiler, así que también quedan fuera. Verificado en Bulbapedia y WikiDex.
- El modelo de datos admite añadir más categorías en el futuro (§13).

### 7.2 Origen de los equipos (variantes)
Cada entrenador tiene una o más **variantes**: sus equipos en los distintos torneos del PWT. El rival del día usa una de ellas, elegida al azar.

| Torneo de origen | Quién | ¿Entra? |
|---|---|---|
| Torneo Líderes de Teselia/Kanto/Johto/Hoenn/Sinnoh | Líderes de su región | **Sí** |
| Torneo Mundial de Líderes | Los 46 líderes | **Sí** |
| Supertorneo Tipo (Type Expert) | 46 líderes, monotipo | **Sí**, si el equipo es distinto de los anteriores |
| Torneo Campeones | 7 campeones | **Sí** |
| Supertorneo Trueque (Mix Master) | Líderes de Teselia N2/B2 | Usa los equipos del Mundial, no aporta variantes |
| Torneos de descarga ("¡El desafío del Campeón Lance!", etc.) | Lance, Morti, Blanca, Erika, personajes del anime y campeones mundiales reales | **No**: equipos de 3 Pokémon, no sirven para 6 contra 6 |
| Torneo Fayenza (Nv. 25) y torneos de Préstamo | Varios | **No**: fases intermedias o equipos de alquiler |

Ejemplo verificado de variantes: Brock usa Onix, Golem, Kabutops, **Omastar**, Aerodactyl, **Relicanth** en el Torneo Líderes de Kanto, y Onix, Golem, Kabutops, **Tyranitar**, Aerodactyl, **Rhyperior** en el Torneo Mundial de Líderes, con objetos y movimientos diferentes. Si dos variantes son idénticas, se deduplican.

Las primeras fases **sí** pueden aparecer en equipos rivales (p. ej. Onix de Brock con Mineral Evolutivo). La regla "sin primeras fases" es solo para el jugador.

### 7.3 Roster del MVP (53 entrenadores)
Nombres en español; **verificar todos contra WikiDex** al construir los datos.

**Líderes (46)**
- Kanto: Brock, Misty, Teniente Surge, Erika, Sachiko, Sabrina, Blaine, Giovanni
- Johto: Pegaso, Antón, Blanca, Morti, Aníbal, Yasmina, Fredo, Débora
- Hoenn: Petra, Marcial, Erico, Candela, Norman, Alana, Vito, Leti, Galano
- Sinnoh: Roco, Gardenia, Brega, Mananti, Fantina, Acerón, Inverna, Lectro
- Teselia: Millo, Zeo, Maíz, Aloe, Camus, Camila, Yakón, Gerania, Junco, Lirio, Cheren, Hiedra, Ciprián

**Campeones (7):** Rojo, Azul, Lance, Máximo, Plubio, Cintia, Mirto

### 7.4 Notas de datos
- Todos los equipos del PWT tienen 6 Pokémon a Nv. 50.
- Cuando el juego da dos habilidades posibles, se elige una con el PRNG del día.
- Cada variante guarda `sourceTournament` y `sourceUrl` para poder trazarla.

### 7.5 Ejemplo de datos verificados
Rojo (Torneo Campeones, Nv. 50, IV 30):
| Pokémon | Objeto | Habilidad | Movimientos |
|---|---|---|---|
| Pikachu | Bola Luminosa | Electricidad Estática | Placaje Eléctrico, Cola Férrea, Demolición, Sorpresa |
| Venusaur | Hierba Blanca | Espesura | Lluevehojas, Bomba Lodo, Terremoto, Somnífero |
| Charizard | Banda Focus | Mar Llamas | Llamarada, Onda Certera, Tajo Aéreo, Pulso Dragón |
| Blastoise | Pañuelo Elección | Torrente | Salpicar, Hidrobomba, Ventisca, Onda Certera |
| Snorlax | Garra Rápida | Inmunidad / Sebo | Golpe Cuerpo, Terremoto, Triturar, Bomba Germen |
| Lapras | Baya Zidra | Absorbe Agua / Caparazón | Rayo Hielo, Hidrobomba, Canto Helado, Rayo |

---

## 8. Datos necesarios

### 8.1 Fuentes
- **Referencia interna:** el proyecto `../claude-test` (Pokémon Team Builder) para datos de Pokémon, movimientos, sprites y nombres en español (ver §0).
- **Equipos:** páginas de Bulbapedia de cada torneo (`Champions_Tournament`, `World_Leaders_Tournament/{Kanto,Johto,Hoenn,Sinnoh,Unova}`, `{Kanto,Johto,Hoenn,Sinnoh,Unova}_Leaders_Tournament`, `Type_Expert_Tournament/{Tipo}`). Contraste con WikiDex y Serebii (`serebii.net/black2white2/pwt/`).
- **Nombres en español** (Pokémon, movimientos, habilidades, objetos, tipos): CSV de PokeAPI (`pokemon_species_names`, `move_names`, `ability_names`, `item_names`, `type_names`, `local_language_id = 7`).
- **Mecánicas y datos de combate:** `@pkmn/sim` / `@pkmn/data` (Gen 5).
- **Sprites:** ver §10.7 (sprites animados de Negro 2 / Blanco 2).

### 8.2 Esquema (JSON versionado en el repo)
```ts
type Trainer = {
  id: string;                 // "brock"
  nameEs: string;             // "Brock"
  nameEn: string;
  gender: "F" | "M";        // género gramatical: "La Líder Camila", "El Campeón Rojo"
  category: "leader" | "champion"; // ampliable en el futuro
  region: "kanto" | "johto" | "hoenn" | "sinnoh" | "unova" | null;
  specialtyType?: TypeName;   // tipo del gimnasio
  sprite: string;
  ivs: number;                // 20 líderes | 25 campeones | 30 Rojo
  alwaysLeadsWith?: string;   // species id
  variants: TeamVariant[];
};
type TeamVariant = {
  id: string;                 // "brock-world-leaders"
  sourceTournament: string;   // "World Leaders", "Kanto Leaders", "Type Expert: Rock", "Champions"
  sourceUrl: string;
  team: PokemonSet[];         // exactamente 6
};
type PokemonSet = {
  species: string;            // id de @pkmn
  level: 50;
  item: string;
  abilities: string[];        // si el juego da 2 posibles, se elige con el PRNG del día
  moves: [string, string, string, string];
  nature?: string;
  evs?: Partial<StatsTable>;
  gender?: "M" | "F";
  verified: boolean;          // cotejado con 2 fuentes
};
```

### 8.3 Validación de datos (script obligatorio en CI)
- Cada variante tiene exactamente 6 Pokémon; especies, movimientos, habilidades y objetos existen en `@pkmn/data` Gen 5.
- Nada de lo prohibido por el PWT (Rocío Bondad, Caída Libre, legendarios de la lista).
- Todos los `id` son únicos; todos los nombres en español resuelven.
- Informe de cobertura: entrenadores sin variantes, sets con `verified: false`.

---

## 9. IA del rival

- **MVP:** IA heurística determinista dado el estado (y el PRNG del combate para desempates):
  1. Si puede debilitar al rival este turno, usa el movimiento que lo garantice con más precisión.
  2. Si no, usa el movimiento con mayor daño esperado (cálculo con `@smogon/calc` o `@pkmn/dmg`), teniendo en cuenta tipos, STAB, clima y objetos.
  3. Usa movimientos de estado/clima/cambios de estadística cuando su set lo tiene y es razonable (p. ej. Danza Espada si está a salvo, Tormenta Arena al salir).
  4. Cambia si su Pokémon está en clara desventaja (recibiría KO y no puede hacer nada útil) y tiene a alguien que resiste.
  5. Elige el siguiente Pokémon tras un KO por mejor emparejamiento.
- Objetivo: que se sienta "un entrenador competente", no perfecto. La dificultad se calibra con partidas de prueba (criterio en §14).

---

## 10. Pantallas

> Estética según §0: la pantalla de combate (§10.2) es fiel a N2/B2; el resto, híbrida.

### 10.1 Hoy (pantalla principal)
- Cabecera: logo, número de reto `#N`, cuenta atrás al siguiente reto, iconos de Estadísticas, Ayuda y Ajustes.
- **Tarjeta del rival:** sprite, nombre, categoría (Líder / Campeón), región, tipo de especialidad. ~~Torneo de origen~~: no se muestra (ver §0).
- **Equipo rival:** las 6 especies visibles (vista previa de equipo). Toggle "Ver movimientos y objetos del rival" (oculto por defecto).
- **Tu equipo:** 6 tarjetas con sprite, tipos, objeto, habilidad, total de estadísticas base, las 6 estadísticas reales a Nv. 50 y los 4 movimientos (tipo, categoría, potencia, precisión).
- **Elegir inicial:** botón "Sacar primero" en cada tarjeta.
- ~~**Panel de emparejamientos**~~: eliminado (ver §0, redirección visual).
- Botones: **Combate oficial** (deshabilitado si ya se jugó; muestra el resultado) y **Práctica**.

### 10.2 Combate
- Campo de batalla con ambos Pokémon, barras de PS (rival en %), estados, clima.
- 4 botones de movimiento (tipo, PP). Botón **Cambiar** con los Pokémon disponibles.
- Indicador de cuántos Pokémon quedan a cada lado.
- **Registro del combate en español** (mensajes propios para los eventos principales: uso de movimiento, efectividad, crítico, fallo, debilitado, cambio, estados, clima, objetos y habilidades comunes; texto genérico de reserva para el resto).
- Botón **Rendirse** con confirmación. Etiqueta visible "OFICIAL" o "PRÁCTICA".
- Animaciones de combate mínimas (bajada de PS, textos, Pokémon debilitado), con opción de acelerar. La intro se describe en §10.2.1.

### 10.2.1 Animación de inicio del combate
Al empezar cada combate (oficial y práctica) se reproduce una intro que imita la de Negro 2 / Blanco 2:
1. Transición de entrada a pantalla de combate.
2. El **sprite del entrenador rival entra deslizándose** desde el borde derecho hasta su posición en el campo rival, y el del jugador (protagonista de N2/B2, de espaldas) desde el izquierdo.
3. Texto: "¡[Categoría] [Nombre] te desafía!" (p. ej. "¡La Líder Camila te desafía!").
4. El rival **lanza su primer Pokémon**: animación de lanzar del entrenador, Poké Ball volando y abriéndose con destello, y aparece el sprite animado del Pokémon. El entrenador sale de la pantalla deslizándose.
5. Texto: "¡[Nombre] saca a [Pokémon]!". Después el jugador saca su inicial con la misma secuencia de Poké Ball.
- Duración total orientativa: 3-5 s. Se puede **saltar** con un toque o tecla.
- Respetar `prefers-reduced-motion`: versión sin desplazamientos, solo fundidos.
- Al reanudar un combate guardado, no se repite la intro.

### 10.3 Resultado
- Victoria o derrota, turnos, Pokémon que sobrevivieron.
- Botón **Compartir** (Web Share API en móvil, copiar al portapapeles como alternativa).
- Estadísticas actualizadas, cuenta atrás y enlace a **Práctica**.

### 10.4 Estadísticas (modal)
Jugados, % victorias, racha de victorias actual y máxima, racha de días actual y máxima.

### 10.5 Ayuda / FAQ (modal)
Cómo se juega, reglas (§5), notas de mecánicas de Gen 5, consejos, créditos y aviso legal.

### 10.6 Ajustes
Velocidad de animación, tema claro/oscuro, borrar datos locales.

### 10.7 Estilo visual y sprites (requisito de Jose)
- **Pokémon:** sprites **animados de Negro 2 / Blanco 2** (pixel art de Gen 5). Rival de frente, jugador de espaldas. Fuente recomendada: los sprites animados de Gen 5 que publica Pokémon Showdown (`gen5ani` y `gen5ani-back`), descargados al repo en el build, no enlazados en caliente.
- **Entrenadores:** sprites de combate **de Negro 2 / Blanco 2**, animados. **Fuente indicada por Jose: WikiDex**, en la sección "Sprites" de la página de cada entrenador (ej.: https://www.wikidex.net/wiki/Misty). El fichero es `<Nombre>_N2B2.gif` ("Frontal animado"), p. ej. `Misty_N2B2.gif`; también existe `<Nombre>_N2B2_mini.png` para iconos pequeños.
  - Descargar los GIF al repo en el build (script que recorra el roster y guarde `trainers/<id>.gif` y `trainers/<id>-mini.png`), sin enlazar en caliente a WikiDex. Comprobar que el fichero existe para los 53 entrenadores.
  - La intro (§10.2.1) usa el GIF animado de N2/B2 para la animación del entrenador. El deslizamiento de entrada y salida y la Poké Ball se programan aparte.
  - Si algún entrenador no tiene `_N2B2.gif`, se usa su sprite estático con un movimiento simple programado.
  - Créditos a WikiDex en la pantalla de Ayuda.
- Los sprites se escalan solo a múltiplos enteros con `image-rendering: pixelated`, sin suavizado.
- Las tarjetas de la pantalla Hoy también usan los sprites animados.
- Créditos a las fuentes de sprites en la pantalla de Ayuda.

## 11. Persistencia, estadísticas y compartir

- **Sin cuentas ni backend.** Todo en `localStorage` con clave versionada (`daily-pwt:v1`), envuelto en try/catch.
- Se guarda por día: estado (no jugado / en curso / ganado / perdido), semilla del combate y **registro de decisiones** del jugador. Reanudar = recrear el combate con la misma semilla y reproducir las decisiones.
- **Racha de victorias:** victorias oficiales consecutivas. **Racha de días:** días consecutivos con combate oficial terminado.
- **Texto para compartir [DEFAULT]** (sin nombre del rival, para no hacer spoiler):
```
Daily PWT #42
✅ Victoria en 23 turnos
🟩🟩🟥🟩🟥🟩
🔥 Racha: 5
https://<dominio>
```
Una casilla por Pokémon del jugador en orden de equipo: 🟩 sigue en pie, 🟥 debilitado. En derrota: `❌ Derrota (3/6 rivales debilitados)`.

---

## 12. Requisitos no funcionales

- **Stack sugerido:** Vite + React + TypeScript, `@pkmn/sim` en el navegador (Web Worker), `@pkmn/data`, `@smogon/calc`. Sitio 100 % estático.
- **Rendimiento:** carga inicial < 3 s en 4G; cada turno se resuelve en < 300 ms.
- **Responsive:** usable a 360 px de ancho; táctil.
- **Accesibilidad:** contraste AA, botones con texto (no solo color), navegable con teclado.
- **Idioma:** español en toda la interfaz; textos centralizados para poder traducir más tarde.
- **Tests:** unitarios del generador diario (fechas fijas → reto esperado), de rachas y del texto de compartir; validación de datos (§8.3); test e2e de una partida completa contra una IA trivial.
- **Legal:** aviso de proyecto fan no oficial, sin relación con Nintendo, Creatures, GAME FREAK ni The Pokémon Company. Sin monetización.

---

## 13. Alcance

### MVP
- Roster de 53 entrenadores del PWT (§7.3) con todas sus variantes de §7.2.
- Pool de sets del jugador cargado desde `data/player-sets.json` (provisional según §6).
- Generador diario determinista con bolsa barajada.
- Equipo del jugador según §6.
- Combate individual 6 vs 6, Gen 5, Nv. 50, con IA heurística.
- Pantallas §10.1 a §10.6.
- Combate oficial único, prácticas ilimitadas, reanudar partida.
- Estadísticas y compartir.

### Fuera del MVP (fases siguientes)
- Alto Mando, Iris y especiales (Aura, Blasco, Plata...) si más adelante se definen equipos para ellos.
- Archivo de retos anteriores y "colección" de entrenadores vencidos.
- Modo difícil (p. ej. sin ver los sets del rival) y "día monotipo" cuando sale una variante del Supertorneo Tipo.
- Formatos dobles, triples y rotatorios.
- Inglés, sonido, animaciones de movimientos, cuentas y clasificaciones.

---

## 14. Criterios de aceptación

**Reto diario**
1. Dos navegadores distintos con la misma fecha local muestran el mismo rival, la misma variante y el mismo equipo del jugador.
2. Al pasar la medianoche local, la pantalla muestra el reto siguiente sin recargar manualmente (o al recargar) y la cuenta atrás se reinicia.
3. En un ciclo completo de la bolsa (tantos días como entrenadores, 53 en el MVP) no se repite ningún entrenador. Un test lo comprueba.
4. `getDailyChallenge` con un conjunto de fechas de referencia devuelve siempre los mismos retos (snapshot).

**Combate**
5. Las reglas de §5 se aplican: Nv. 50, mecánicas de Gen 5, inicial del rival respetado cuando existe `alwaysLeadsWith`.
6. El jugador puede elegir movimiento o cambio cada turno; el rival responde con la IA de §9.
7. Recargar la página a mitad del combate oficial lo reanuda en el mismo turno y con el mismo estado.
8. Tras terminar el oficial, el botón de combate oficial no permite jugar otra vez ese día.
9. Rendirse cuenta como derrota.
10. Las prácticas no cambian ninguna estadística.

**Datos**
11. El script de validación pasa sin errores: todas las variantes tienen 6 Pokémon legales en Gen 5 y `player-sets.json` es válido.
12. Los 53 entrenadores del roster tienen al menos 1 variante; los líderes tienen al menos 2 (regional y Mundial).
13. El equipo del jugador nunca contiene Pokémon que puedan evolucionar, especies repetidas, objetos repetidos ni legendarios prohibidos.

**Estadísticas y compartir**
14. Ganar dos días seguidos da racha de victorias 2; perder la pone a 0; saltarse un día pone la racha de días a 0.
15. El texto de compartir sigue el formato de §11 y no revela el rival ni el equipo.

**Visual**
16. Todos los Pokémon y entrenadores del roster tienen sprite de N2/B2; los Pokémon se ven animados y nítidos (sin difuminado) en móvil y escritorio.
17. Cada combate empieza con la intro de §10.2.1: el rival entra deslizándose, lanza su primer Pokémon y este aparece animado; la intro se puede saltar y no se repite al reanudar.

**Calidad**
18. Funciona en las dos últimas versiones de Chrome, Safari (iOS) y Firefox, a 360 px de ancho.
19. **Dificultad:** en 20 partidas de prueba de un jugador con experiencia, la tasa de victoria está entre 40 % y 80 %. Si no, se ajustan IVs/EVs o la IA.

---

## 15. Decisiones por defecto y preguntas abiertas

| # | Pregunta | Default aplicado | Alternativas |
|---|---|---|---|
| P1 | ¿Alto Mando? | **Resuelto:** fuera, porque no tiene equipo en el PWT | Añadirlo en el futuro con equipos propios |
| P2 | ¿De dónde sale el equipo del jugador? | **Resuelto:** pool de sets propio en `data/player-sets.json`; provisionalmente, sets de los rivales (§6) | Fuente externa que investigará Jose |
| P3 | ¿Formato del combate? | **Resuelto:** 6 contra 6 | |
| P8 | ¿Hasta qué generación? | **Resuelto:** Gen 1-5 | |
| P9 | ¿Equipos de quien no está en el PWT? | **Resuelto:** solo PWT; quien no tiene equipo allí queda fuera | |
| P4 | ¿Especiales (Aura, Blasco...)? | **Resuelto:** fuera, no tienen equipo en el PWT | Añadirlos en el futuro con equipos propios |
| P5 | ¿Cambio de día? | Medianoche local | Medianoche UTC/Madrid (mismo reto a la vez para todos) |
| P6 | ¿Mostrar los sets del rival? | Especies visibles, sets tras un toggle | Todo oculto (más difícil) |
| P7 | ¿Nombre del rival en el texto de compartir? | No | Sí |

---

## 16. Fuentes consultadas
- Daily Red: https://daily-red.com/ y reseña en Dexerto.
- Bulbapedia: Pokémon World Tournament, Champions Tournament, World Leaders Tournament (y subpáginas), Kanto Leaders Tournament, Driftveil Tournament, World Champion / World Finalist / World Runner-up / Master Representative (Trainer class).
- WikiDex: Pokémon World Tournament, Torneo Fayenza, nombres en español y sprites de entrenadores (p. ej. https://www.wikidex.net/wiki/Misty).
- Serebii: https://www.serebii.net/black2white2/pwt/
