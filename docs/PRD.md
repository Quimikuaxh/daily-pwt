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
| Roster completo y calendario (21/10/2026) | **Los 53 entrenadores se barajan todos juntos** (solo azar, sin restricciones de región; el 27/10/2026 se añadió el reparto: ver «Reparto de entrenadores») en una única entrada base del `rosterSchedule`, rebarajada desde el inicio: no se mantienen los 6 de F1 delante ni se añaden los 47 en una entrada posterior. `LAUNCH_DATE` sigue provisional (2026-10-19) y la fija Jose al final; con la fecha actual los días ya jugados (19 a 21 de octubre) pasan a Hiedra, Fredo y Antón y Máximo toca el 2026-11-26 (ver `F2-DATOS.md`, «Calendario») | Decisión de Jose. Cambia los retos ya publicados. Descartado: mantener los 6 delante, entrada de calendario nueva en fecha futura y restricciones por región |
| Skills de diseño | `web-design-guidelines` (revisión UI/accesibilidad) y `playwright-cli` (verificación visual con capturas) | `taste-skill` excluye pantallas de app; solo se aprovecha su bucle mirar-y-corregir sobre capturas. `image-to-code` no aplica (requiere generar imágenes) |

### Ambiente del estadio (10/11/2026)

| Tema | Decisión | Motivo / alcance |
|---|---|---|
| Animaciones del PWT | Jose pasa un vídeo de un combate real del PWT y pide sus animaciones «lo que se pueda, de lo más fácil a lo más difícil», en una rama aparte desde `main` (`feature/animaciones-pwt`). Hechas: focos del suelo, haces del techo, sombras de los Pokémon (silueta aplastada que se mueve con ellos, elegida por Jose), destello con chispas y estallido de la Poké Ball (RF-136); los zooms de cámara de la intro y de los ataques se quitaron el 11/11/2026 (Jose: raros y distintos del juego) | Fidelidad al juego. Descartado: el plano general del estadio con pantalla gigante y focos (escena 3D sin gráficos aprovechables; no quedaría como el original). Pancarta VS (RF-137): sin los retratos VS de N2/B2 (no están en Bulbapedia ni en su copia del Internet Archive), Jose pide recrearla lo más parecida posible: se hace con CSS y los sprites de combate del rival y los de frente de Nate y Rosa (Showdown); alarga la intro 2 s a x1 (hasta 6,9 s; Jose aprobó hasta 7 s) |

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
| Equilibrio del equipo del jugador (§6) | Nuevas reglas de generación, además de las de §6: **suma de estadísticas base de los 6 ≥ 3060** y **como máximo 2 Pokémon que compartan un mismo tipo** (cada tipo de un Pokémon de doble tipo cuenta). Se aplican por código y siguen siendo deterministas | Decisión de Jose: evitar equipos muy flojos o monotemáticos. Cambios del 23/10/2026 (Jose): antes ≥ 2800 y como máximo 3; luego ≥ 2860; ahora ≥ 3060. Descartado: mínimo por Pokémon (450) |
| Conflicto de guardado de campaña (11/11/2026) | Si el guardado remoto es más reciente, bloquea las escrituras y avisa. Ofrece **«Recargar campaña»**; carga el guardado remoto y descarta los cambios locales pendientes solo cuando el jugador lo confirme. D4 expone estado y operación; D7 presenta el aviso y el botón. | Decisión de Jose: impedir sobrescrituras y conservar los cambios pendientes hasta una acción explícita. Descartadas: que la otra pestaña gane automáticamente (pierde cambios sin avisar) y preguntar qué conservar (permite sobrescribir la partida más reciente). |
| Calendario de Hoenn (11/11/2026) | Usa el recorrido habitual de [CALENDARIO-MT.md](nuzlocke/CALENDARIO-MT.md), sin premios aleatorios, posliga ni objetos sin fuente nativa. En Oromar conserva solo el Retroceso garantizado del meteorito. Las MT/MO siguen siendo gratis y reutilizables; recibir una MO y poder usarla fuera de combate son condiciones distintas. | Decisión de Jose: conservar una progresión previsible y evitar adelantar cobertura con desvíos o farmeo. Descarta exploración opcional completa y premios por azar. |
| Inventario de evolución de Hoenn (11/11/2026) | Concede una sola unidad de cada piedra y objeto de evolución durante toda la campaña y consúmela al evolucionar. El Escáner permite una única elección persistida entre Diente Mar. y Escama Mar.; solo concede la elegida, también consumible. | Decisión de Jose: mantener el coste de oportunidad entre reclutas. Sustituye la recomendación de objetos reutilizables del informe; descarta conceder ambos premios del Escáner. |
| Amistad para evolucionar en Hoenn (11/11/2026) | Exige tres victorias con el miembro en la alineación y superviviente, o pertenecer a la plantilla de Liga ya fijada, aunque no reúna tres. Conserva identidad y contador al evolucionar. Permite elegir la franja día/noche en preparación para Eevee. | Decisión de Jose: premiar la continuidad sin bloquear los reclutas tardíos al entrar en la Liga; aplica la recomendación de selector sin esperas del reloj real. |
| Amistad de combate en Hoenn (11/11/2026) | Fija en 255 la amistad de todos los Pokémon del jugador: Retroceso tiene potencia máxima y Frustración mínima. Es independiente de las victorias exigidas para evolucionar. | Decisión de Jose: asegurar la potencia de Retroceso sin conceder evoluciones inmediatas. No cambia el modo diario ni los sets rivales. |
| Belleza de Feebas en Hoenn (11/11/2026) | Habilita Feebas → Milotic tras Norman, antes de Alana, sin minijuego ni contador adicional. | Decisión de Jose: abstraer la preparación de belleza y reservar Milotic para el tramo de Surf. Descarta belleza inmediata desde el primer draft o victorias propias adicionales. |
| Nincada en Hoenn (11/11/2026) | Evoluciona automáticamente a Ninjask desde nivel 20; Shedinja solo puede reclutarse como candidato independiente del draft, sin crear un miembro adicional gratuito. | Decisión de Jose: conservar el presupuesto de elecciones del draft y mantener Shedinja elegible sin duplicar reclutas. |
| Ramas por nivel en Hoenn (11/11/2026) | Fija la rama de Wurmple por un sorteo determinista de semilla e identidad y no lo repitas al reanudar. El jugador elige la rama de Tyrogue desde nivel 20. | Decisión de Jose: conservar incertidumbre reproducible en Wurmple y dar elección expresa para Tyrogue. Sustituye la recomendación de decidir Tyrogue por Ataque/Defensa. |
| Cobertura del draft de Hoenn (11/11/2026) | En las cuatro ofertas anteriores a Petra y en las dos ofertas de cada tramo hasta el siguiente gimnasio, ofrece al menos un Pokémon con alguno de sus tipos propios supereficaz contra el tipo del gimnasio en Esmeralda. Cuenta lo ofrecido, aunque se descarte; no cuenta la cobertura de movimientos. La Liga queda excluida. | Decisión de Jose: garantizar una oportunidad de cobertura por tramo sin exigirla en cada oferta. Conserva cuatro candidatos distintos, el margen de estadísticas base y la exclusión de la oferta inmediatamente anterior. |
| IA del Alto Mando y del campeón de Hoenn (12/11/2026) | Miran **un turno por delante** (cada opción suya contra todas tus respuestas posibles, la mejor contra tu mejor respuesta) y **conocen tu equipo entero, banquillo incluido, pero no tus movimientos exactos ni tus objetos**: cuentan con los ataques que te han visto usar y predicen los posibles con lo que cada Pokémon tuyo puede llevar en la campaña (por nivel y MT desbloqueadas; el ataque más fuerte de cada tipo). **Cambian cuando tiene sentido**: si están atados a algo inútil (Otra Vez, Anulación, Tormento, Mofa, objeto Elección), si algo les va a debilitar sin remedio (Canto Mortal a punto de acabar, Tóxico avanzado o Drenadoras con poca vida) o si no hacen casi nada y otro de su equipo planta cara; y **no cambian tontamente**: cada uno vale según lo que planta cara a tu equipo (más si es el único que gana a alguno), y no meten a uno clave a recibir por salvar a otro que hace menos falta. Los gimnasios siguen con la IA actual y **la IA del reto diario no cambia** | Decisiones de Jose (12/11/2026, corregida el mismo día: el banquillo sí lo conocen; después, cuándo cambiar). Descartados: la búsqueda de varios turnos (lenta en móvil) y que conozcan tus sets desde el principio |
| Evoluciones fuera de la Liga e intercambio (12/11/2026) | En la preparación, el menú del PC tiene **EVOLUCIONAR** cuando un Pokémon puede evolucionar ya (objeto, intercambio, amistad o belleza), con la escena de evolución. Las evoluciones **por intercambio son en el Nv37**; las que además piden objeto, **en el Nv37 y con el objeto** (en la campaña no hay intercambio). Afecta también a qué formas pueden salir en el draft | Decisiones de Jose. Antes, las de intercambio sin objeto valían siempre y fuera de la Liga no había forma de evolucionar con objeto, intercambio o amistad |
| Repetidos y normas inviables en el draft de Hoenn (12/11/2026) | En el draft **no salen especies ni líneas evolutivas que ya se tienen**, también las de los caídos (cláusula de repetidos de las Nuzlocke). Si una norma del draft es inviable tras varios intentos, se salta: la garantía de tipo propio supereficaz, cuando en el último intento del tramo no queda ningún candidato que la cumpla (p. ej., Erico con los suyos ya reclutados); y si tras quitar las líneas que ya se tienen no quedan cuatro candidatos, la ventana se amplía **solo por abajo**, un 50 % del margen inferior cada vez, hasta cuatro veces. El margen normal pasa a **−10 %/+8 %** de la media rival (antes −6 %/+8 %) | Decisiones de Jose (ampliar por abajo el margen normal y el de cuando faltan candidatos). Interpretación de Claude, a confirmar: los caídos cuentan como «ya tenidos» |
| Objetos equipables de Hoenn (11/11/2026) | Tus Pokémon pueden llevar objeto. Disponibles, como mínimo, los equipables que se consiguen en el recorrido de la aventura, con el mismo calendario que las MT: **una unidad por fuente** (cada una la lleva un solo Pokémon a la vez y se cambia entre combates); las **bayas conseguidas son infinitas**. De las tiendas solo cuentan los equipables (pociones, Poké Balls y demás consumibles no existen en la campaña); interpretación de Claude, a confirmar: los equipables de tienda ya disponible, sin límite (no hay dinero). **Competitivos** (Cinta Elegida, Periscopio, Restos…): con **Puntos Batalla** ganados durante la aventura (no tras la Liga) y canjeados entre hitos con el catálogo del canje del Frente Batalla de Esmeralda, de forma que pasando los gimnasios de forma normal se puedan comprar 2-3, y alguno más sin bajas: **20 PB por gimnasio ganado y 8 más si nadie se debilita** en ese combate, con los precios del canje de Esmeralda (48 PB: Restos, Hierba Blanca, Garra Rápida, Hierba Mental; 64 PB: Polvo Brillo, Cinta Elegida, Roca del Rey, Banda Focus, Periscopio); 160 PB en los ocho gimnasios, 224 sin bajas. Cifras ajustables (`BP_PER_GYM`, `BP_FLAWLESS_BONUS`). | Jose: los equipables obtenibles deben estar como las MT; los competitivos, con una vía propia equilibrada. *Descartados:* premio fijo por medalla, solo los objetos de la historia, unidades infinitas de todo y precios del Frente Batalla original (demasiado caros). El Pañuelo Elegido no existe en Gen 3. Extraídos del decompilado: 35 equipables con fuente en la aventura (el resto solo sale al azar de Pokémon salvajes o tras la Liga) y el canje (DEC-94). Núcleo hecho; falta la interfaz. |
| Liga con los Pokémon evolucionados (11/11/2026) | Al entrar en la Liga, cada Pokémon de la caja y cada candidato del draft de la Liga evoluciona hasta su forma final por todas las vías que **no** necesitan objeto (nivel, intercambio sin objeto, amistad, belleza), sin esperar al nivel ni a las condiciones. Si hay varias formas finales, **elige el jugador** (como Tyrogue). Las evoluciones por piedra u objeto de evolución siguen siendo opcionales: el jugador decide si usar el objeto, solo si lo tiene, y se gasta (regla del inventario). Confirmado por Jose («quien dice piedra dice objeto evolutivo»): los intercambios con objeto (Roca del Rey, Revestimiento Metálico, Escama Dragón, Mejora, Diente Mar./Escama Mar.) cuentan como «por objeto». | Jose: que en la Liga se puedan usar Pokémon que tardan demasiado en evolucionar (Tyranitar, Salamence). *Descartado:* evolucionar también por piedra sin tenerla y decidir las ramas al azar o fijas. Implementado en el núcleo (`evolveForLeague`, DEC-93); la elección en pantalla va con la interfaz de la Liga. Los candidatos del draft de la Liga se ofrecen por la ventana con la forma que tienen y evolucionan al reclutarse (la ventana sobre la forma final dejaría fuera justo a Tyranitar o Salamence). |
| Movimientos desde el PC (11/11/2026) | En Equipo y PC, tocar un Pokémon (del equipo o de la caja) abre el **menú del PC** del juego: MOVER, MOVIMIENTOS y CANCELAR; arrastrar sigue moviéndolo directamente. MOVIMIENTOS abre su pantalla Movimientos (Recordador + página de movimientos de Datos) y SALIR vuelve al Equipo. Los elegidos se guardan en la campaña por Pokémon; sin elegir, combate con los cuatro últimos aprendidos por nivel, como en el juego | Decisión de Jose (la maqueta solo enseñaba un Pokémon). Descartados: recorrerlos uno tras otro al aceptar el equipo, tocar el retrato para cambiar y botones fuera del juego |
| Descripciones de movimientos en español (11/11/2026) | Las de la pantalla Movimientos son **redactadas** a partir de la inglesa de Esmeralda, en dos líneas que caben en los huecos del juego (`data/nuzlocke/emerald-move-descriptions-es.json`, revisables). No hay fuente con las de la edición española: pret/pokeemerald es la inglesa, PokeAPI solo tiene español desde X/Y y WikiDex no las recoge por juego | Decisión de Jose. Descartados: las actuales de PokeAPI cortadas con «…» (solo caben 105 de 347) y los resúmenes de efecto de guiasnintendo.com (no son el texto del juego y son redacción de la guía); de esa guía sí sirven los nombres de la época para D6 |
| Cada campaña, con los datos de su generación (11/11/2026) | Los movimientos de una campaña son los de **su generación**, tal cual estaban: nombre de la época (Esmeralda: LÁTIGO y no Agitacola; `data/nuzlocke/emerald-move-names-es.json`), PP, potencia, precisión, probabilidad de los efectos y categoría (en Gen 3, por tipo). El motor de la campaña de Hoenn ya combate en Gen 3 y la pantalla Movimientos lee `src/generated/emerald/moves.json` (Gen 3). Al hacer campañas de otras generaciones, revisar lo mismo para cada una (nombres, datos y textos) | Jose. Descartado: los nombres y datos actuales del reto diario (Gen 5) |
| Mensajes del combate de la campaña (11/11/2026) | Con el estilo de Esmeralda: «¡GEODUDE enemigo se debilitó!», «¡PETRA envió a NOSEPASS!», «¡La DEFENSA de NOSEPASS enemigo subió!», «¡La Líder PETRA quiere luchar!» (nombres en mayúsculas, el rival como «… enemigo», pasado simple). Redactadas a partir de los textos ingleses del juego (`src/i18n/esEmeraldLog.ts`); el resto de frases, las del diario | Jose. Descartado: las frases del reto diario («¡El Geodude de Petra se ha debilitado!») |
| Resultado de la campaña (11/11/2026) | El nombre del jugador es su **nickname** o, sin cuenta, el protagonista de Esmeralda (BRUNO o AURA, fijo por semilla) con su sprite en la ficha. La Ficha de Entrenador rellena sus campos con equivalentes: **DINERO** = Puntos Batalla, **POKéDEX** = especies reclutadas, **TIEMPO** = tiempo desde que empezó la campaña | Jose. Descartados: siempre el protagonista, elegirlo al empezar, ficha solo con POKéDEX y medallas, y sin ficha |
| Liga: evoluciones y objetos (11/11/2026) | **Evolución de la Liga** con la escena de evolución del juego (fondo negro, el Pokémon y la caja de mensajes): los de una sola forma final evolucionan con su mensaje; los de varias, con «¿En qué debería evolucionar GLOOM?» y una ventana con las formas. **Objetos**: OBJETO en el menú del PC de Equipo y PC abre la **Mochila de Esmeralda** replicada (fondo, mochila del protagonista, bolsillos OBJETOS y BAYAS, lista con cantidades, icono y descripción; nombre del bolsillo en negro) para ese Pokémon. **Canje de PB** en el mostrador del Frente Batalla (PB, lista con precios, icono y descripción), con un botón en la barra de la Ruta | Jose, sobre maquetas (`maquetas.html`, solo desarrollo). Descartados para la evolución: Datos como el Draft y EVOLUCIONAR en el menú del PC; para los objetos, una lista sencilla en el PC |
| Tres elecciones al entrar en la Liga (11/11/2026) | El draft ofrece cuatro elecciones antes de Petra, dos antes de cada gimnasio y **tres al entrar en la Liga** (`draftPicks` en `campaign.ts`; antes, dos). | Jose: la Liga son cinco combates seguidos con la caja cerrada; un recluta más compensa. *Descartado:* mantener dos. |
| Equilibrio del draft de Hoenn (11/11/2026) | Fija el escenario A (formas viables al nivel y calendario de D2) y una ventana inclusiva de estadísticas base **proporcional: media rival −6 % a media rival +8 % por candidato** (corrección de Jose del mismo día: «como en el PWT» era el tamaño del margen, no que fuese fijo; −30/+40 absoluto, la versión anterior, era demasiado margen al principio). Usa la media por Pokémon en gimnasios y la media de las cinco medias de equipo para la Liga. El núcleo aplica la política sin aceptar límites o formas alternativos del llamador. | Decisión de Jose: el tamaño de `BST_WINDOW_1` anterior del PWT (−180/+240 sobre la mediana de 2983 de las sumas de sus equipos: −6 %/+8 %), más centrado porque el jugador elige Pokémon y ataques. Descarta la absoluta −30/+40 (ancha al principio). Descarta la prima de `BST_WINDOW_2` (−15/+45 por Pokémon), los porcentajes ±10/15/20/25 % (amplitud dependiente del rival), B (excluye evoluciones especiales disponibles) y C (admite formas sin trayectoria viable). La simulación A/−6 %/+8 % completa 100 semillas sin fallos, con pool mínimo 18 tras exclusiones (Marcial) y cobertura en los ocho gimnasios (Erico solo con dos candidatos supereficaces); no se amplía por hito. Fuentes, alcance de A y tablas en [SIMULACION-DRAFT.md](nuzlocke/SIMULACION-DRAFT.md). |
| Estadísticas de combate de Hoenn (10/11/2026) | Aplica 20 IV en cada estadística, 0 EV y naturaleza neutra en ambos bandos. Los rivales conservan especies, niveles, movimientos y objetos equipados de Esmeralda. Con Poder Oculto, sortea cada IV entre 19 y 20 y repite si coinciden los seis. Conserva los IV del jugador por Pokémon durante la partida, aunque evolucione o cambie de movimientos. Conserva los IV del rival al reanudar el encuentro. | Los mismos parámetros de entrenamiento en ambos bandos dejan que el draft, el equipo y las bajas determinen la dificultad. Solo aplica a la campaña de Hoenn. |
| Estadísticas base según el rival (28/10/2026) | La suma de estadísticas base del equipo del jugador va de **la del rival − 180** a **la del rival + 240** (RF-13d), en vez de ≥ 3060 | Decisión de Jose: equilibrar la dificultad entre rivales (Brock salía demasiado fácil y Rojo demasiado difícil). Más margen hacia arriba porque los equipos del rival están hechos para jugar juntos y los del jugador se sortean. (Corregido el 04/11/2026: antes decía que el rival lleva EV y naturalezas y el jugador no; los dos van con EVs 0 y naturaleza neutra, porque las fuentes del PWT no los publican.) Solo para los retos desde `TEAM_RULES_2_FROM`. Descartado: un suelo fijo de 2800 |
| Límites de estadísticas base (09/11/2026) | Desde `BST_WINDOW_2_FROM`, usa el intervalo **rival − 90 a rival + 270** (RF-13d). | Eleva el mínimo para reducir los equipos débiles. El máximo conserva margen para los equipos sorteados y queda 60 puntos por debajo del +330 planteado inicialmente para limitar la ventaja del jugador. |
| Hora del reto (28/10/2026) | El reto cambia para todos a la **medianoche de Madrid** (en Canarias, a la 1:00 local; en América, por la tarde), no a la de cada dispositivo | Decisión de Jose: el día es el mismo en todo el mundo y cuadra con el cierre del día del servidor (F4). Descartado: seguir con la hora del dispositivo y que el servidor aceptara todos los husos (cerraría el día hacia las 13:00-14:00 de Madrid del día siguiente) |
| Temas de Mirto y Cheren (28/10/2026) | Mirto suena con su tema de campeón de Negro / Blanco («Battle! (Champion)», Alder) y Cheren con el de rival («Battle! (Cheren-Bianca)»), en vez del tema de campeón de N2/B2 (el de Iris) y del de líder de Teselia | Decisión de Jose. Del Super Music Collection de Negro / Blanco en Internet Archive (no del vídeo de YouTube que pasó Jose: es el mismo tema, en FLAC y con crédito). El resto sigue con su tema por categoría y región; los temas propios van en `trainers` de `data/audio.json` |
| Música de vida baja (30/10/2026) | Con el Pokémon del jugador en rojo **se corta la música del rival y suena la de vida baja** de Negro / Blanco, desde el principio y en bucle (sin el fundido final del vídeo). Al dejar de estar en rojo (se cura, se debilita o se cambia), vuelve la del rival **por donde iba**, con una transición corta (la de vida baja se apaga en 0,8 s y la del rival entra desde bajo y sube durante 1,5 s; Jose, 30/10/2026); si vuelve a estar en rojo, la de vida baja empieza otra vez desde el principio. **Sustituye al pitido** de vida baja, que se quita | Decisión de Jose. La pista no está en ningún Super Music Collection: sale del vídeo que pasó Jose («Critical Health Music», canal Pokeli en YouTube), con su crédito en `data/audio.json`. Descartados: seguir buscando un ripeo del juego y que suenen música y pitido a la vez |
| Tema del último Pokémon (30/10/2026) | Cuando el rival tiene en el campo su **último Pokémon**, suena «Victory Lies Before You!» (N2/B2) en vez de su tema, **con todos los rivales** (también campeones). Entra con transición (0,8 s: el del rival se apaga mientras entra este, desde el principio). **Sigue sonando cuando cae ese último Pokémon** hasta que se funde al terminar (Jose, 30/10/2026; antes volvía el tema del rival). Con el Pokémon del jugador en rojo manda la música de vida baja, con las mismas normas: al dejar de estar en rojo vuelve este tema, por donde iba (o desde el principio, si aún no había sonado) | Decisión de Jose. Del Super Music Collection de N2/B2 (Internet Archive, `Disc 1/50`), no del vídeo de YouTube que pasó Jose: es el mismo tema, en FLAC y con crédito. Descartados: solo con los líderes, como en el juego, y entrar con corte seco |
| Puntos desde el 29/10/2026 (29/10/2026) | Los dos oficiales del 28/10 que puntuaron (adelapina y un invitado; el resto eran días importados, que no puntúan) se marcaron en producción como no validados (`validated = false`): nadie tiene puntos antes del 29/10 y todos empiezan igual. Su resultado, su racha, sus estadísticas y su repetición se quedan | Decisión de Jose. Descartado: borrar esas filas (se perdían el resultado, la racha y la repetición). Se deshace con `update pwt.day_results set validated = true where date = '2026-10-28' and not imported` |
| Formas de una misma especie (28/10/2026) | El equipo del jugador **no lleva dos formas de la misma especie** (Thundurus y Thundurus-Therian, Rotom y sus formas, Wormadam y sus mantos), RF-12b | Decisión de Jose. Solo para los retos **desde el día siguiente al despliegue** (`TEAM_RULES_2_FROM`): los ya publicados no cambian. Descartado: aplicarlo a todos (cambiaría equipos que la gente ya jugó y anularía sus oficiales guardados al reanudar) |
| Modo PWT (fase futura, tras F3) | Modo de torneo: el jugador se enfrenta con el **mismo equipo a 7 entrenadores aleatorios** seguidos | Idea de Jose. **Libre y repetible sin límite** (no es diario). Por definir: curación entre combates, si cuenta para estadísticas |
| Día Soleado, climas y caja de mensajes (30/10/2026) | La animación de **Día Soleado** son **rayos de sol** desde una esquina, no puntos que caen. **Cada clima tiene la suya** (también arena y granizo) y se ve también cuando lo pone una habilidad y en cada turno que sigue, como en el juego. De la cuarta a la octava tanda de animaciones: los 100 movimientos más usados que no tenían (Truco incluido). La **caja de mensajes** llega hasta el borde inferior de la pantalla de arriba (antes quedaba una franja del campo debajo) | Decisiones de Jose: el sol parecía lluvia de fuego |
| Repetición de hoy de un amigo (04/11/2026) | Quien **ya ha terminado su oficial de hoy** (ganado, perdido o anulado) puede ver la repetición de hoy de sus amigos; quien no, a medianoche como antes | Decisión de Jose: quien ya lo jugó no tiene nada que descubrir |
| Paneles laterales en el combate (05/11/2026) | En escritorio, si caben sin bajar la escala de la consola, **tu equipo a la izquierda y el del rival a la derecha** (estilo de la opción B de la maqueta a los dos lados): el Pokémon en combate con tipos, PS, estado, **estadísticas** (con sus subidas y bajadas), objeto, habilidad y movimientos con los PP que les quedan (también los del rival); el resto, iconos con su barra de PS; arriba, Poké Balls de los que quedan en pie (sin el «5/6»). Al pulsar un movimiento, el objeto o la habilidad, **su ficha** sale debajo del panel (movimiento: tipo, categoría, potencia, precisión, PP y descripción, ; la **franja de eficacia** contra el de enfrente, hecha pero **desactivada** por Jose el mismo día). Subidas y bajadas: el valor original y, debajo, una «^» fina verde o una «v» roja (sin borde ni recuadro) y el número si son varios niveles. Lo pulsado, con sombreado y texto amarillo (sin recuadro). Al pulsar uno del banquillo, el panel lo enseña; al salir otro al campo, el panel vuelve solo al que está en combate. Los botones Salir, Registro, Velocidad y Sonido, **encima de la consola** y con estilo nuevo (oscuros, esquinas cortadas, icono de píxel; en móvil también, sin icono, más finos y bajos); la solicitud de directo con el mismo estilo, centrada bajo el juego en móvil y al pie de tu columna con paneles; los contadores «Tú / Rival» no salen (lo dicen las Poké Balls). Sin sitio, todo como antes. También en el visor de repeticiones y en el directo. Descripciones de los objetos, de PokeAPI | Idea y decisiones de Jose (maquetas del 05/11/2026). Descartados: un panel ancho por lado con los movimientos de todo el banquillo (opción A), una sola columna a la derecha (B), botones claros, línea de eficacia en placa o en barra de segmentos, recuadro amarillo en lo pulsado flechas, rectángulos de color o «^» macizas con borde para las subidas y bajadas, y la estadística ya calculada con la subida |
| Paneles laterales más grandes (06/11/2026) | Con sitio de sobra los paneles laterales crecen enteros (texto, iconos y ficha) hasta **×1,3**, lo que quepa a lo ancho sin pisar la consola y a lo alto; a 1920 × 1080 (unos 1920 × 950 de ventana) salen a ×1,3 y a 1440 × 900 a ×1,15. Por debajo de ×1 se quitan como antes | Jose, a la vista de maquetas a ×1, ×1,3 y ×1,5 (×1,5 rozaba el alto) |
| Texto centrado en los recuadros (06/11/2026) | El texto de los recuadros (OFICIAL / PRÁCTICA / REPETICIÓN / EN DIRECTO, «Objeto» / «Habilidad» de la ficha y los tipos) va centrado en vertical sobre la altura de las mayúsculas; si no se puede centrar exacto, 1 px más abajo, nunca más arriba. La caja «Objeto» tiene su centro a la altura del del nombre | Petición de Jose; medido en capturas (a 1440 px y a 360 px) |
| Icono del objeto en su ficha (06/11/2026) | La ficha del objeto de los paneles laterales lleva su **icono de la bolsa** (los de PokeAPI, estilo N2/B2) en un círculo a la izquierda, como el sprite de la franja de eficacia; sin «Lo lleva…». Los de los 12 Pokémon del reto se precargan con sus sprites desde Hoy, y al abrir un combate (repeticiones y directos), para que salgan al instante (Jose, 06/11/2026) | Elegida por Jose entre maquetas. Descartadas: la línea «Objeto» del panel como franja dorada con el icono y una franja dorada al pie de la ficha |
| Contadores y mensajes de objetos (06/11/2026) | Los contadores «Tú / Rival» bajo la consola, sin el «4/6» a la vista (queda para el lector de pantalla), con el nombre del entrenador en vez de «Rival» (con «…» si no cabe) y sus Poké Balls a su izquierda (las de los dos hacia el centro) y a la altura del nombre. El mensaje de objeto revelado ya no dice siempre «ha obtenido»: Globo Helio al salir («¡X flota gracias a su Globo Helio!»), Cacheo, robos y objetos recuperados con su propio texto; «ha obtenido» solo al recibirlo (Truco…) | Petición de Jose a la vista de un directo en móvil |
| Volumen en las repeticiones (06/11/2026) | El visor de repeticiones y el directo llevan arriba el botón **«Sonido»** del combate (Activado/Silenciado y volumen, guardados en Ajustes); el botón de música de la barra sigue silenciando solo la de esa repetición. En los paneles laterales, el hueco bajo cada estadística para la «^» o la «v» está siempre: la caja no crece al subir o bajar algo | Petición de Jose: en las repeticiones solo se podía silenciar. Descartado: un deslizador nuevo en la barra de la repetición (dos controles de volumen distintos) |
| Fondo de la aplicación (05/11/2026) | El fondo de toda la web es la **cuadrícula de la pantalla de equipo de N2/B2** (oscura y azulada, con puntos en los cruces; baldosa ripeada de la misma hoja, al doble y fija) en vez del granate con franjas; la barra de Combate oficial / Práctica, el velo de las ventanas y la página de privacidad pasan a azul noche a juego. La cabecera y los botones siguen rojos | Decisión de Jose entre maquetas sobre la pantalla real. Descartados: rejilla de puntos granate, foco granate, el estadio del PWT desenfocado, Poké Balls, la cuadrícula en granate, la clara de Datos y una carcasa de consola negra |
| Ver en directo a un amigo (04/11/2026) | Desde «Amigos» se **pide ver en directo** el oficial de un amigo que está jugando; él lo **acepta o lo rechaza** durante su combate (aviso en la fila de los Pokémon en pie, sin tapar el combate) y, aceptado, se ve en el visor de repeticiones con «EN DIRECTO», turno a turno. Cualquier amigo, haya jugado o no (RF-111c) | Idea y decisiones de Jose. Descartados: sin permiso, solo quien ya jugó su oficial y un aviso encima del combate (en móvil tapaba) |
| Estadísticas de un amigo al día (04/11/2026) | En la vista de un amigo, **sus estadísticas cuentan también su oficial de hoy**, como las propias, con «Hoy: X/6 en pie»; sus puntos de hoy llegan a medianoche, igual que los tuyos. Su repetición de hoy sigue oculta hasta el día siguiente | Decisión de Jose. Antes contaban solo los días cerrados para no adelantar cómo le fue. Descartado: abrir también su repetición de hoy |
| Sets del PWT con sinergia (04/11/2026) | El equipo del jugador **deja de sacar los sets del PWT sin sinergia**: con menos de 2 ataques fuertes (70 o más de potencia, de varios golpes o variables; a los muros, que recuperan PS y ponen un estado o una trampa, les basta 1), sin uno de esos de su tipo y con 90 o más de precisión, con más de un ataque del lado (físico o especial) que no le conviene o con movimientos sin uso o de azar (Doble Equipo, Rayo Confuso, Contoneo, Atracción, Comesueños, Danza Caos…) o con todos sus ataques de 80 de precisión o menos. 169 de los 588 sets del PWT (también los que solo tienen de su tipo Llamarada, Hidrobomba, Roca Afilada o Ventisca); los de Smogon no cambian y ninguna especie se queda sin set. Rayo Solar no cuenta como ataque fuerte, y por esa regla también salen los de Smogon que solo estaban por él (Exeggutor, Entei, Arcanine y Charizard con Día Soleado; Jose, 04/11/2026): 178 en total. Desde el 05/11/2026 (`POOL_RULES_FROM`) | Decisión de Jose: «hay sets que no convencen». Descartados: quitar todos los del PWT, quitar también Hipnosis y los sueños poco precisos (el Gengar de Morti, por lo demás bueno) y dar EVs y naturalezas de Smogon (el rival va sin ellos) |
| Pantalla «Estado» (03/11/2026) | La pastilla de arriba de la pantalla táctil **se ve siempre**: con clima como antes; sin él, gris clarito con «Estado». Al pulsarla, la pantalla **«Estado»**: una ficha por Pokémon en combate (borde azul el tuyo, rojo el rival) con sus **subidas y bajadas como flechas ▲/▼, una por nivel**, y sus efectos (Sustituto, Mofa, Canto Mortal…) con el reloj de turnos; y tres franjas, **CAMPO** (Espacio Raro, Gravedad…), **TÚ** y **RIVAL** (Viento Afín, Reflejo, Púas ×2…). Con muchos cambios, la ficha pasa a compacta (abreviadas en dos columnas; más de 3 niveles, flecha y número). Lo que no cabe en una franja se resume en «y N más» y, al pulsarla (o una ficha), el detalle entero sale en la caja de mensajes. También en el visor de repeticiones | Idea y decisiones de Jose, tras tres mocks. Descartados: números (+2) en vez de flechas, franjas claras como las de Datos, que la franja crezca a varias líneas y la pastilla vacía o «Campo» sin clima |
| Aviso por Discord (03/11/2026) | Con cuenta, en Cuenta, **«Conectar Discord»**: un bot manda un **mensaje privado a la hora que elige el jugador** (de media en media hora, en la zona de su dispositivo) si ese día aún no ha empezado el oficial. Se activa, se cambia de hora y se desconecta desde la web. Al conectar, el jugador entra en un servidor de Discord del juego, porque el bot solo puede escribir por privado a quien comparte servidor con él | Idea y decisiones de Jose (privado y hora elegible). Descartados: mención en un canal, hora fija para todos, sin cuenta (con la sesión anónima) y vincular con un comando del bot |
| Músicas, repeticiones y estadísticas del rival (03/11/2026) | Interruptores **«Música de vida baja»** y **«Tema del último Pokémon»** en Ajustes y en Sonido (desactivados, sigue el tema del rival). En las repeticiones, botón **«Música»** para silenciarla (sin guardar) y **la pausa congela la música**. En Hoy, al desplegar «Ver movimientos y objetos», **las estadísticas del rival** como las propias | Decisiones de Jose. Descartados: un solo interruptor para las dos músicas, un ajuste guardado para la música de las repeticiones y las estadísticas del rival siempre a la vista |
| Género, equipo con un solo Pokémon y tema del último (03/11/2026) | **Cada Pokémon tiene género** (♂/♀ en el combate: caja de PS, equipo y Datos) con la proporción de su especie; los sin género (Metagross), ninguno; desde el 03/11/2026 (`GENDERS_FROM`; Jose lo adelantó al mismo día del despliegue). Sin poder cambiar (atrapado o sin nadie más en pie), **el equipo se abre igual para ver sus Datos**, con Cambiar desactivado y su motivo. **El tema del último Pokémon no vuelve a empezar** cuando su barra llega a 0 | Decisiones de Jose. Descartados: 50/50 en todos los géneros, cambiar ya el reto de hoy y enseñar el género también en Hoy |
| Práctica tras el oficial (31/10/2026) | **La práctica solo se puede jugar después del combate oficial** del día (ganado, perdido o anulado). Antes, el botón se ve deshabilitado con un aviso | Decisión de Jose. Antes, prácticas antes y después del oficial (§4.3). Descartado: ocultar el botón hasta entonces |
| Gritos de los Pokémon (31/10/2026) | Cada Pokémon (tuyo y del rival) **grita al salir al campo** y, **más grave, al debilitarse**, como en el juego. Gritos de Pokémon Showdown; cada combate descarga solo los de sus 12 Pokémon; mismo volumen y silencio que el resto del sonido | Decisión de Jose. Descartados: ripearlos de N2/B2 y un interruptor aparte en Ajustes |
| Combate de hoy en el historial de un amigo (31/10/2026) | En el historial de un amigo **sale su combate de hoy**, **sin el botón de repetición**, que aparece **al día siguiente**. Sus estadísticas y puntos siguen siendo los de los días cerrados | Decisión de Jose. Antes el de hoy no salía hasta medianoche |
| Aviso de nombre y cuenta (31/10/2026) | Al entrar en Hoy, a quien no ha elegido nombre o juega sin cuenta, un aviso que lo explica, con «Ir a Cuenta», «Ahora no» y **«No volver a mostrar»**; como mucho **una vez al día** | Decisión de Jose. Descartados: el campo del nombre y el botón de Google dentro del aviso, en cada visita o solo la primera vez. REQUISITOS-F4 RF-94b |
| IA que aprende tu equipo (29/10/2026, sin empezar) | La IA del rival **no conoce tus sets de entrada**: los aprende con lo que se ve en el combate. **Cambia cuando queda bloqueada** (Otra Vez, Mofa, Anulación, Elección atada a algo inútil, Canto Mortal, Tóxico o Drenadoras con poca vida). **Puede predecir, pero nunca decide después de tu elección** | Decisión de Jose. Opciones de información y de fuerza, y lo que falta por decidir: PENDIENTE, «Próxima mejora de la IA del rival». Hoy (DEC-12) la IA tiene información completa |
| Rankings con 0 (29/10/2026) | En los rankings de puntos y de racha **salen también los que tienen 0**, siempre que hayan terminado algún oficial (en el de puntos, ese mes o antes). Quien solo abrió la web no sale | Decisión de Jose. Descartados: todos los que tienen nickname (se llenaría de visitantes sin jugar) y solo los que tienen cuenta |
| Cuentas, rachas y rankings (27/10/2026) | **Login opcional con Google** (Supabase; la web sigue en GitHub Pages). Con sesión: **nickname** cambiable sin límite si no está cogido; **rachas guardadas en la cuenta**; **ranking mensual** por racha y por puntos; **amigos** buscados por nickname, con solicitud y aceptación, y comparativa entre amigos. **Puntos del día** = Pokémon sin debilitar × multiplicador; **multiplicador = 1 + (6 − media)/6**, donde la media es la de supervivientes de todos los jugadores ese día, calculada al cerrar el día (×1 si todos acaban con 6, ×2 con media 0); **también cuentan los oficiales de quien juega sin cuenta**, que además tiene nickname, puntúa y sale en los rankings (los de cuenta, con tick de verificado; nombres únicos entre todos; el de quien no tiene cuenta se libera tras 30 días sin jugar; amigos solo con cuenta; cambio del 27/10/2026). **Validación:** el cliente envía el estado del combate a la base de datos en cada turno y se borra al acabar. El ranking de racha es el de la **racha actual** (no mensual); el de puntos, mensual. **Rendirse da 0 puntos** (es derrota). Al iniciar sesión **se sube el historial local**. Nickname de 3 a 16 letras, números y `_`, único sin distinguir mayúsculas. El día cierra a **medianoche de Madrid**. Fase **F4**, requisitos en [REQUISITOS-F4.md](REQUISITOS-F4.md) | Decisión de Jose. Descartados: Firebase (rankings y cierre del día más costosos de montar) y repetir el combate entero en servidor. Decisiones: REQUISITOS-F4 §3 |
| Logros (fase futura, tras F3) | Sistema de logros con **login opcional**: el reto diario sigue jugándose sin cuenta. Con sesión iniciada, la **racha diaria y los logros se guardan en la cuenta**; sin sesión, la racha sigue guardándose en local | Idea de Jose. Requiere backend (cuentas y almacenamiento), lo que cambia la decisión de alojamiento "solo GitHub Pages, sin backend": habrá que elegir servicio (p. ej. Supabase, como en pokemon-heardle) |
| Efectos de sonido de combate | **En F3, junto a la música.** Sonidos de golpe según efectividad (supereficaz, poco eficaz, neutro), y los básicos del combate (Poké Ball); además (23/10/2026) el pitido de vida baja solo con el Pokémon del jugador en rojo (como en N2/B2; se corta al debilitarse) y el de debilitarse al caer el sprite (`SEQ_SE_DEAD`, elegido por Jose; el que había antes era el pitido), los botones del menú de batalla (elegir y cancelar), cada estado, comerse una baya y subir o bajar una característica, con su animación, ripeados de N2/B2, guardados en el repo y acreditados. Comparten silencio y volumen con la música | Decisión de Jose |
| Orden de los textos del golpe (22/10/2026) | Crítico, efectividad (supereficaz, poco eficaz), Robustez, Banda Focus, Cinta Focus y Aguante salen **después de que la barra de PS termine de bajar**, en ese orden | Decisión de Jose: así es en N2/B2 |
| Nombres en la caja de PS (22/10/2026) | Se **reduce el tamaño del nombre para todos** los Pokémon, no solo para los largos. Nombre y género **alineados a la derecha, junto al nivel**: un nombre más largo crece hacia la izquierda | Decisión de Jose. Descartado: estrechar o reducir solo los que no caben |
| Ramas de F3 (22/10/2026) | `fix/bugs-combate` → `feature/f3-estadisticas` → `feature/f3-ayuda-ajustes` → `feature/f3-sonido`, cada una **sobre la anterior** (las de F3 llevan los bugs corregidos) | Decisión de Jose |
| Estadísticas y compartir (22/10/2026) | Casillas 🟩/🟥 **en el orden del equipo**; la racha del texto es la **de victorias** (perder la pone a 0). Se guarda el estado de cada Pokémon del jugador al terminar; los días ya jugados sin ese dato se comparten sin cuadrícula. Un oficial `void` cuenta como jugado, no es victoria ni derrota, corta la racha de victorias y mantiene la de días. **Un día sin jugar rompe también la racha de victorias** (cuenta días seguidos ganados). Si hoy aún no se ha jugado, las rachas de ayer siguen vivas | Decisión de Jose. Descartado: que un día sin jugar no corte la racha de victorias |
| Ajustes (22/10/2026) | **Sin tema claro/oscuro** (no encaja con la estética de N2/B2). En escritorio, el juego va **enmarcado** (estilo consola o similar) en vez de flotar sobre el fondo. La **velocidad del combate** pasa también a Ajustes y se guarda entre sesiones | Decisión de Jose. Sustituye a «tema claro/oscuro» de §10.6 |
| Marco en PC (22/10/2026) | **DS sencilla**: carcasa oscura redondeada con un bisel en cada pantalla y la bisagra entre ambas, sin botones. En móvil, sin marco | Decisión de Jose sobre tres maquetas. Descartados: DS completa (cruceta y botones decorativos, más ancha) y marco con franjas del PWT |
| Clima en combate (22/10/2026) | En el hueco central de arriba de la pantalla táctil, con fondo del color del clima | Decisión de Jose (así lo recuerda del juego). Antes estaba arriba a la derecha, bajo la etiqueta OFICIAL/PRÁCTICA |
| Sonido (22/10/2026) | **Aparcado** hasta poder descargar los audios. Cuando se haga: activado por defecto (nada suena hasta la primera interacción), música solo en combate (y el jingle de victoria en Resultado si se gana), silencio y volumen en Ajustes. Temas y fuentes: fila «Fuentes y temas del sonido (23/10/2026)» | Decisión de Jose. Descartado: música también en Hoy y Resultado |
| Fuentes y temas del sonido (23/10/2026) | **Música del OST oficial** (*Super Music Collection* de N2/B2 en FLAC, Internet Archive `pkmn-bw2-soundtrack`), no de YouTube. Tema por rival: líderes con el «Battle! (Gym Leader - [región])» de su región (Teselia: «Battle! (Gym Leader)»); Rojo y Azul con «Champion - Kanto», Lance con «Champion - Johto», Máximo y Plubio con «Champion - Hoenn», Cintia con «Champion - Sinnoh» y **Mirto con el tema de campeón de N2/B2 (Iris, «Battle! (Champion)»)**. Efectos de The Sounds Resource, descargados con un navegador automatizado (Playwright) porque el sitio tiene reto de Cloudflare | Decisiones de Jose. Descartados: YouTube (peor calidad y silencios variables); el tema de Mirto en N/B (no está en el OST de N2/B2) y «PWT Final Round!». Rojo se queda con Kanto aunque Bulbapedia (lista de temas de combate) le asigna «Champion - Johto» en N2/B2 |
| Música de la campaña de Hoenn (12/11/2026) | En los menús de cada tramo (Ruta, draft, equipo, Movimientos, Mochila, Tienda, Liga), el tema de la ciudad del gimnasio que toca; donde el juego repite el de otra ciudad, una pista de la zona (Malvalona: Pueblo Verdegal; Lavacalda: Monte Cenizo; Algaria: Ciudad Calagua); en la Liga, Ciudad Colosalia. Pistas de Esmeralda **de vídeos de YouTube que elige Jose** (no hay un Super Music Collection de la tercera generación en Internet Archive): «Battle! (Gym Leader)» con los líderes, la del Alto Mando con el Alto Mando y la del campeón con Plubio; en Resultado, «Victory! (Gym Leader)» tras un líder, «Victory! (Champion)» tras el Alto Mando y el Salón de la Fama tras el campeón; la de evolución durante la animación. Las victorias y el Salón de la Fama suenan una vez. Efectos de Esmeralda del ZIP de The Sounds Resource que baja Jose: golpes, Poké Ball, debilitado, características, selección en menús y los cuatro de los destellos de la evolución; los de estado y la baya del diario no tienen equivalente y no suenan | Decisión de Jose. Después (12/11/2026): fanfarria de evolución de YouTube, pitido de vida baja de Gen 3 encima de la música (como el juego; en el diario se cambió por música) y gritos de la tercera generación, las muestras del decompilado, en vez de los actuales de Showdown |
| Modos de juego más vistosos (12/11/2026) | Cada modo con una miniatura a la izquierda y su descripción, uno debajo de otro: el reto diario con el escenario del PWT, Máximo, Cintia y el VS; cada campaña con su región y sus dos protagonistas (Hoenn: Bruno y Aura). El modo en el que se está va en rojo, como los botones principales, en vez de «Estás aquí» | Decisiones de Jose (opción A de las maquetas). Descartada la B (dos tarjetas con imagen grande) |
| Retoques del combate y la campaña (12/11/2026, probando en local) | Entrada al combate con transición (dos destellos y franjas negras) y el líder que entra, reta y sale antes de enviar su Pokémon; al volver a entrar en la campaña con un combate a medias, sigue donde estaba sin la entrada. En la lista de movimientos, CANCELAR abajo y Esc para volver; un solo ▶ (el del foco). Estados alterados en las cajas de PS. Golpes de Esmeralda 6 dB más altos (sonaban por debajo de los del PWT). Tras ganar, el líder vuelve a salir al dar la medalla y abajo pone «Tu equipo.»; el nombre provisional de la cuenta no se usa (sale el protagonista). Fuera de la Mochila los equipables que no hacen nada en combate (Moneda Amuleto, Repartir Exp, Amuleto, Bola Humo, Campana Alivio, Piedraeterna, Vestidura). La ficha del gimnasio y de la Liga da solo el nivel máximo de todo el equipo del rival. Notas de evolución con «al Nv16», no «en el Nv16». POTENCIA y PRECISIÓN en un hueco del ancho de «100» centrado. CANCELAR en la Mochila. La colocación de Equipo y PC se conserva al salir y volver a entrar. |
| Dificultad de la Nuzlocke y animaciones de ataques (13/11/2026) | Al empezar una campaña se eligen dos dificultades por separado, guardadas en la partida. **IA:** Fácil, la heurística del diario en todos los combates; Normal, la heurística en los gimnasios y mirar un turno por delante en la Liga (lo de antes); Difícil, mirar un turno por delante también en los gimnasios. **Pokémon del draft** (ventana de estadísticas base respecto a la media del rival): Fácil, −5 % / +15 %; Normal, −10 % / +8 % (lo de antes); Difícil, −15 % / +3 %. Las campañas ya empezadas son Normal/Normal. **Animaciones de los ataques:** las del reto diario (DEC-53) también en el combate de la campaña, sobre el campo de Esmeralda (Jose: en Esmeralda el atacante no se mueve; se descartaron una embestida y un impacto propios). Los 57 movimientos de los rivales de la campaña que no tenían animación propia la tienen ahora, en el mismo catálogo, así que valen también en el diario; los demás usan la genérica de su clase. La cabecera de la campaña tiene el botón Sonido (activado/silenciado y volumen), el mismo del combate del diario y guardado en Ajustes. |
| Más retoques de la campaña (12/11/2026, probando en local) | Cada ataque suena con los efectos de su animación en Esmeralda (`gen:emerald-move-sounds`), además del golpe. El equipo del tramo siguiente arranca con los del último combate que siguen en pie (`lastTeam`). MALDICIÓN lleva el tipo «???». El estado alterado sale en la caja de PS como en el juego: el icono de color en el sitio del rótulo PS en la del rival y bajo la barra en la propia. En la Ruta, la ficha de la Liga enseña al rival que toca y se recorren los cinco con flechas, cada uno con su estado. Entre rondas de la Liga, Continuar abre Equipo y PC con la plantilla fijada (orden, movimientos y objetos; la caja sigue cerrada) y después la ficha del rival. El panel «Tu equipo» enseña también la caja. La IA del Alto Mando y el campeón no cambia recién entrado salvo que esté atado o en peligro (DEC-98). Bucles de las pistas de ciudad hechos a mano, revisados. |
| Paneles laterales de la campaña en escritorio (12/11/2026) | A los lados de la consola, con estética de Esmeralda (no de N2/B2): «Tu campaña» como la Ficha de Entrenador (Puntos Batalla, tiempo, bajas, especies, caja, siguiente rival y las 8 medallas en sus huecos) y «Tu equipo» como la pantalla de equipo (placas con PS y el objeto en un recuadro; sin movimientos, Jose: no hacen falta). Con los paneles, la tira de medallas de la barra de debajo solo se ve en móvil. Botones de la campaña como ventanas blancas con marco y ▶ en la acción principal; el de empezar otra se llama «Nueva partida» («Nueva» no se entendía). Descartadas: el estilo oscuro y amarillo del reto diario y las píldoras moradas. En los combates de campaña, paneles como los del PWT con el estilo de la ficha del Domo Batalla (verde azulado, elegido entre tres maquetas: `maquetas.html?v=paneles-combate`): el propio con estadísticas (y sus subidas y bajadas), objeto, habilidad, movimientos con PP y el banquillo; el del rival con su sprite, sus Pokémon, la habilidad y los ataques de cada uno, sin estadísticas ni objeto (Jose: «es mejor no saber lo que tienen»; se descartó un botón «Ver set» que lo enseñaba todo). Los paneles solo salen si caben a los lados de la consola sin cambiar su escala. «Volver a la ruta» solo en los menús (draft, equipo, Movimientos, Mochila, Tienda, Liga) y en la pantalla final, que no tiene otra salida; en el combate, el resultado y la evolución no (se pulsaba sin querer; descartadas: quitarlo en todas o pedir confirmación en el combate). |
| Liga Pokémon en la campaña (13/11/2026) | Durante la Liga **no hay Tienda** (ni botón ni pantalla de canje): en el juego no se puede salir de la Liga una vez dentro. En la Ruta, desde que se gana al primer miembro del Alto Mando, la cabeza del jugador está en Ciudad Colosalia. La ficha de la Liga enseña el sprite del rival que toca, y las flechas para ver los demás van en los márgenes a los lados de la ficha, centradas en el cuadro del título (dentro de la ficha pisaban la franja del título). En el panel «Tu equipo», la caja se pagina de 10 en 10 con flechas (con solo «Y n más» no había forma de verlos). En la ficha del rival, CANCELAR vuelve a Equipo y PC (de donde se llega), no a la ruta. En Equipo y PC, el Pokémon del equipo que se arrastra conserva sus datos en la placa hasta soltarlo (vaciarla al empezar parecía que ya se había movido) | Decisión de Jose |
| Final de la campaña para compartir (12/11/2026) | Tras el Salón de la Fama (o al perder la campaña), pantalla final con la opción A de las maquetas: arriba el Salón de la Fama con los que ganaron la Liga (al perder, los del último combate en gris y ante quién), abajo la Ficha de Entrenador con POKéDEX, BAJAS, TIEMPO y medallas. «Compartir» abre el menú del sistema con la imagen de las dos pantallas (720 × 960, PNG) y «Guardar imagen» la descarga; suena la música de los créditos de Esmeralda. En el Salón de la Fama la fila de abajo se pinta delante de la de arriba, al revés que el juego, para que no salga pisada | Decisiones de Jose. Descartada la opción B (resumen en una línea y los seis en la pantalla de equipo) y una pantalla de créditos aparte |
| Retoques de Hoy y ventanas (22/10/2026) | Cuenta atrás en una placa como la de los botones de la cabecera; rótulos de sección que se desvanecen hacia la derecha; sin negrita ni cursiva inventadas sobre la fuente de píxel; las ventanas largas (Ayuda) desplazan solo el contenido | Peticiones de Jose sobre capturas |
| Mochila = equipo rival (22/10/2026) | El hueco de la Mochila del combate es el botón **RIVAL**: abre el equipo del rival con el mismo aspecto que el propio, **solo para consultar Datos** (sin Cambiar). Se ven **los 6** con su set completo (Hoy ya lo enseña), **PS en porcentaje** y **los PP que le quedan** (cambio del 22/10/2026: antes solo los máximos) | Decisión de Jose. Descartados: rótulo MOCHILA o EQUIPO RIVAL, PS exactos y ocultar los no vistos |
| Cambio del rival tras un KO (22/10/2026) | El entrenador **entra deslizándose desde la derecha, lanza la Poké Ball y sale** deslizándose (antes aparecía ya en el centro); igual en el lado del jugador | Decisión de Jose |
| Estado en la placa del equipo (22/10/2026) | Siempre en la misma posición horizontal y **centrado en vertical con los PS** | Decisión de Jose. Descartado: pegarlo a la cifra de PS |
| Animaciones de movimientos: primera tanda (22/10/2026) | **Genéricas por tipo y clase** (golpe físico, ataque especial y, de estado: subir, bajar, provocar estado, curar, proteger, sustituto, clima, trampas, pantallas y otros) **+ 20 propias** (los movimientos más usados entre rivales y pool). **Por código, en píxel** sobre el lienzo de la pantalla de arriba, con los colores del tipo. **Arrancan a la vez que el mensaje «X usó Y»**; no se animan los fallos ni los turnos de carga. **Interruptor en Ajustes** (activadas por defecto); con «reducir movimiento» del sistema no se muestran Mejora (22/10/2026): los físicos se distinguen por cómo golpean (mordisco, puñetazo, patada, corte o golpe) y los especiales sin animación propia tienen un efecto por tipo en vez de una bola («que no todo sean bolas; Lanzallamas no tiene sentido que sean bolas»). Segunda tanda de 20 propias (40 en total; lista en ARQUITECTURA DEC-53). Tercera tanda (23/10/2026, acordada con Jose): las 20 siguientes por uso (60 en total) | Decisión de Jose. Descartados: 40 propias en la primera tanda, solo genéricas, sprites dibujados a mano y animar después del mensaje |
| Sustituto visible (27/10/2026) | Con un sustituto en pie, en el campo se ve **el muñeco del sustituto de N2/B2** (de frente o de espaldas) en vez del Pokémon, hasta que se rompe o se cambia; **apoyado en la plataforma como los Pokémon** (Jose, 27/10/2026) | Decisión de Jose. Descartados: dibujarlo por código y una marca junto a la caja de PS |
| Consultar al rival en el cambio forzado (27/10/2026) | Tras un KO, la pantalla de elegir sustituto tiene un botón **RIVAL** abajo a la derecha (donde van Salir y Volver, que ahí no se usan). Abre el equipo del rival como el botón RIVAL del combate y su Volver devuelve a elegir sustituto | Decisión de Jose. Descartado: pestañas Tu equipo / Rival |
| Drenadoras contra Muro Mágico (27/10/2026) | Al sembrar: «¡El Clefable de Cintia ha sido infectado!». Si Muro Mágico evita el drenaje, al final de cada turno: «¡Muro Mágico protege al Clefable de Cintia de Drenadoras!» (el juego no dice nada; se añade para que se entienda) | Decisión de Jose. Descartados: dejarlo mudo como N2/B2 y solo cambiar el mensaje al sembrar |
| Hoy en pantallas anchas (24/10/2026) | El contenido de Hoy llega hasta **100rem (1600 px)** (antes 72rem) y, desde 1400 px de ventana, los **sprites** (el escenario del entrenador, el equipo rival y tu equipo) **se ven al doble** (`zoom: 2`, nítidos). El texto no cambia; en móvil y pantallas menores, como antes | Decisión de Jose. Descartados: escalar toda la pantalla y solo ensanchar |
| Animaciones en Ajustes (24/10/2026) | Una opción **Animaciones: Siempre / Según el sistema / Nunca** para todo el combate (ataques, estados, barras de vida, intro, cambios y debilitados), **Siempre por defecto**: se ven aunque el dispositivo tenga «reducir movimiento». Sustituye a «Animaciones de movimientos» (los que la tenían desactivada pasan a Nunca) | Decisión de Jose: había jugadores sin animaciones ni bajadas de vida por tener «reducir movimiento» sin saberlo. Descartados: dos opciones separadas y respetar el sistema por defecto |
| Sin parpadeo en los sprites (24/10/2026) | El sprite de **Lanturn** (frente y espalda) encendía y apagaba el halo de las antenas cada 50 ms, unos 10 destellos por segundo (riesgo para personas con epilepsia fotosensible). Se deja **con el halo fijo**: solo los fotogramas con halo, a 100 ms (misma duración total) | Decisión de Jose. Descartados: quitar el halo y revisar todos los sprites (solo Lanturn, por ahora) |
| Copiar el resultado (23/10/2026) | El botón de Resultado y de Estadísticas es **Copiar** y copia el texto al portapapeles directamente, también en móvil | Decisión de Jose. Descartado: el panel de compartir del sistema (Web Share API) |
| Artículo en los Pokémon rivales (23/10/2026) | Los mensajes del combate dicen «**El** Garchomp de Cintia usó…», «…la Velocidad **del** Garchomp de Cintia», «…zarandea **al** Garchomp de Cintia», como N2/B2. Los del jugador, sin artículo | Decisión de Jose |
| Animaciones de estados, objetos y golpes (23/10/2026) | **Estados** (quemado, envenenado, paralizado, dormido, congelado, confuso): animación sobre quien lo sufre con su mensaje, al caer en él, al no poder moverse, al hacerle daño y al seguir confuso. **Subidas y bajadas de características**: flechas rojas que suben o azules que caen con cada mensaje; los movimientos que las provocan tienen su propio dibujo (aura, ondas) para no repetir flechas. **Movimientos sobre uno mismo** (Maldición, Danza Espada, Tambor…): se animan sobre el usuario. **Bayas que suben una característica** (Aslac, Lichi…): un solo mensaje «¡La Baya Aslac ha subido la Velocidad de X!» y la animación de comérsela con las flechas. **Varios golpes** (Pedrada, Doble Patada…): la animación completa se repite en cada golpe antes de que baje la vida. Icono de estado de la caja de PS 1 px más arriba (y 7..12, del rótulo «HP» a la barra) | Decisiones de Jose. Descartados: «se ha comido su Baya Aslac» como mensaje aparte e impactos cortos en vez de la animación completa por golpe |
| Poder Oculto con su tipo real (22/10/2026) | En Hoy, en el menú del combate, en Datos (propios y del rival) y en el color de su animación, Poder Oculto se muestra con **el tipo y la potencia que le dan sus IV** (icono y color de Lucha, 70). **El nombre es solo «Poder Oculto»**, sin el tipo (cambio de Jose del 28/10/2026; antes, «Poder Oculto Lucha»). Con los IV del jugador (iguales en las seis características) sale Lucha 30 (IV 20), Siniestro 30 (IV 25) o Lucha 70 (IV 30). El mensaje del combate sigue diciendo «usó Poder Oculto», como el juego | Decisión de Jose |
| Accesos (22/10/2026) | Estadísticas, Ayuda y Ajustes como iconos en la cabecera de Hoy y también en Resultado | Decisión de Jose (§10.1) |
| Cabecera de Hoy en móvil (22/10/2026) | Hasta 640 px, **una sola fila**: el logo queda en la bola (sin el texto «Daily PWT»), `#N`, la cuenta atrás sin «Próximo reto en» y los tres iconos (44 px). Los dos textos siguen para lectores de pantalla | Decisión de Jose: en dos filas ocupaba demasiado. Descartados: dos filas más compactas y sacar la cuenta atrás de la cabecera |
| Reparto de entrenadores (27/10/2026) | Los **campeones**, repartidos: uno cada 7 u 8 días (nunca menos de 6, también entre ciclos). **Nunca dos de la misma región seguidos.** **Millo, Maíz y Zeo** separados al menos una semana. Los retos #1 a #4 (Misty, Fredo, Antón, Mirto), ya publicados, no cambian; desde el #5 sí | Decisión de Jose (los campeones salían muy juntos y Millo y Maíz seguidos). Descartados: cambiar la semilla hasta dar con un orden bueno (no garantiza nada en los ciclos siguientes) y reordenar también lo publicado |
| Lanzamiento (23/10/2026) | **#1 el 2026-10-24, contra Misty.** En el primer ciclo de la bolsa, Misty pasa al día #1 y Hiedra (que tocaba ese día) a su hueco, el #46; cada entrenador sigue saliendo una vez por ciclo y el resto del calendario no cambia | Decisión de Jose. Descartados: fijar el #1 sin intercambio (Misty saldría dos veces en el primer ciclo e Hiedra ninguna) y otra semilla de barajado (cambia todo el calendario) |
| Descarga de la música (22/10/2026) | Se intenta desde la nube; si la red lo bloquea, Jose la lanza en local con el script | Decisión de Jose |
| Animaciones de movimientos | **Propias, lo último del proyecto (después de F3)**, en pixel art coherente con el lienzo de N2/B2 | Decisión de Jose. Descartados: las originales de N2/B2 (el juego las genera en tiempo real; no existen ripeadas) y las de Pokémon Showdown (arte de terceros y licencia del cliente sin confirmar). También descartado grabarlas desde un emulador con la ROM: no aísla bien los efectos de cámara y tintes, y exige grabar y limpiar cientos de movimientos |
| Ver a cualquier jugador (13/11/2026) | Desde los rankings y desde la búsqueda de Amigos se abren las estadísticas y el historial de cualquier jugador, aunque no sea amigo y aunque no tenga cuenta, con las mismas reglas que la vista de un amigo (RF-111d). Nadie puede ocultarse | Decisión de Jose: son datos de juego, no personales. *Descartado:* un ajuste para ocultar el perfil y dejar fuera a los jugadores sin cuenta |

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
  - **Equilibrio del jugador (§0):** suma de estadísticas base de los 6 ≥ 3060 y como máximo 2 Pokémon que compartan un mismo tipo (cada tipo de un Pokémon de doble tipo cuenta).
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
- Duración total orientativa: 3-7 s a x1 (era 3-5 s; la pancarta VS de 2 s la alarga, decisión de Jose del 11/11/2026, RF-137). Se puede **saltar** con un toque o tecla.
- Respetar `prefers-reduced-motion`: versión sin desplazamientos, solo fundidos.
- Al reanudar un combate guardado, no se repite la intro.

### 10.3 Resultado
- Victoria o derrota, turnos, Pokémon que sobrevivieron.
- Botón **Copiar**: copia el resultado al portapapeles, también en móvil (PRD §0, 23/10/2026; antes, Web Share API en móvil).
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
