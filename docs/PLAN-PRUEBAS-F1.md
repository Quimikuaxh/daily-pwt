# Daily PWT · Plan de pruebas F1

Base: [REQUISITOS-F1](REQUISITOS-F1.md), [ARQUITECTURA](ARQUITECTURA.md) §9.

## 0. Convenciones
- Niveles: **UT** (Vitest, Node), **CMP** (RTL + jsdom, user-event, fake timers), **INT** (motor en Node sobre `Battle` síncrono), **E2E** (Playwright sobre `vite preview` con `VITE_TEST_HOOKS=1`; chromium y webkit), **VIS** (capturas a 360×740 y 1280×800 con playwright-cli, revisadas con web-design-guidelines).
- Roster F1: `brock` (variantes `brock-kanto-leaders`, `brock-world-leaders`), `misty`, `camila`, `plubio`, `rojo`. Ciclo de la bolsa = 5 días.
- Fechas de referencia, **solo para el snapshot UT-17 y los tests de bolsa/ciclo** (`LAUNCH_DATE=2026-10-24`, fecha de lanzamiento fijada por Jose el 23/10/2026; desde F2 roster de 53 entrenadores y ciclo de 53 días, antes 6): D-1 2026-10-23; D0 2026-10-24; D+1..D+4 2026-10-25..28; D+5 2026-10-29; el ciclo 2 empieza en D+53 (antes D+6); D+365 2027-10-24; cambios de hora 2027 (Europe/Madrid) 03-27/28/29 y 10-30/31, 11-01.
- Fixtures: `GameData` sintético mínimo y real; `AiState` manual; semillas de combate fijas; pools imposibles; JSON corrupto.
- Criterios fijados: fecha anterior a `LAUNCH_DATE` = `#1` (prevalece sobre la fórmula literal de RF-09); "Sacar primero" sobre el ya elegido no lo deselecciona (siempre hay uno).
- Ningún test hace peticiones de red; los scripts de descarga no se ejecutan en tests.
- Aserciones estadísticas: semillas fijas; no relajar umbrales sin analizar.

## 1. Unitarios
**Núcleo y fechas**
- UT-01 PRNG: misma semilla → misma secuencia; distinta → distinta; `nextInt` en rango; `shuffle`/`sample` permutan sin mutar; `deriveSeed` distinto por flujo. (RF-02/03)
- UT-02 Aislamiento de `core/`: sin `Math.random`, `Date.now`, `new Date()` sin argumentos ni imports externos; el test falla con un fixture que lo incumple. (DEC-01)
- UT-03 `localDate` con getters locales (nunca UTC), TZ UTC/Madrid/Auckland, 23:59:59 → 00:00:00. (RF-01)
- UT-04 `challengeNumber`: D0 `#1`, D+1 `#2`, D+5 `#6`, D+365 `#366`, D-1 y anteriores `#1`; días de cambio de hora cuentan 1 día exacto. (RF-09)
- UT-05 `msUntilNextLocalMidnight`: 1000 ms a 23:59:59; 86 400 000 a 00:00; 82 800 000 en día de 23 h; 90 000 000 en día de 25 h. (RF-30)
- UT-06 `calcStats` coincide con `@pkmn/data` Gen 5 y el sim (Shedinja 1 PS, naturalezas, IV 20/25/30, EV ≠ 0). (RF-35/16)
- UT-07 Tabla de tipos Gen 5 completa igual que `@pkmn/data`; Acero resiste Fantasma y Siniestro; sin Hada. (RF-14)

**Generador y bolsa**
- UT-08 Pureza: dos llamadas iguales → `deepEqual`; `Math.random` espiado sin llamadas; contiene todos los campos de RF-04; el PRNG de combate no altera el reto. (RF-02/04)
- UT-09 Cambiar el prefijo de semilla cambia el reto; añadir un flujo nuevo no desplaza los existentes. (RF-03, DEC-02)
- UT-10 Bolsa: un ciclo = permutación del roster; 10 ciclos, cada bloque permutación. (RF-05)
- UT-11 Orden del JSON no afecta a la secuencia. (DEC-03)
- UT-12 Frontera de ciclo: si primero(k+1) = último(k) se intercambia con la posición 1; 1000 ciclos simulados con roster sintético de 2..6 ids sin repetición entre ciclos; roster de 1 no cuelga. (regla 12)
- UT-13 `rosterSchedule`: entrada fuera de frontera de ciclo falla con mensaje claro; añadir un entrenador en `fromDayIndex=5` no altera días 0-4.
- UT-14 Variante: Brock ≈50 % ±10 % en 400 fechas; una variante siempre esa; variantes idénticas deduplicadas sin sesgo. (RF-06)
- UT-15 Habilidad doble: siempre de la lista del set, ambas aparecen en 200 fechas, repetible por fecha; habilidad única se respeta. (RF-07)
- UT-16 `alwaysLeadsWith`: Misty→Starmie, Plubio→Milotic, Brock→Onix; sin regla (Rojo) el primero varía y es reproducible; regla con especie ausente → error de datos. (RF-08)
- UT-17 Snapshot de `getDailyChallenge` con las fechas de referencia y datos reales (incluye `number`, trainer, variant, rivalTeam con habilidades, playerTeam, `meta`); cambiar un dato lo rompe. Regenerar si cambian `LAUNCH_DATE`, el roster o las reglas de generación. (RF-04)
- Criterio transversal (DEC-35): los demás tests (unitarios, de componente y E2E) eligen rival y variante por id (`challengeFor`, `?trainer=&variant=`) y cuentan días desde `LAUNCH`/`LAUNCH_DATE` sin fijar su valor; cambiar `LAUNCH_DATE` solo debe romper UT-17.
- UT-18 Mismo string de fecha con distinto `TZ` → mismo reto.

**Equipo del jugador**
- UT-19 En D0..D+4: 6 sets; todos totalmente evolucionados; sin especies/objetos repetidos; sin legendarios prohibidos; ≥4 tipos; ≥1 movimiento de daño ×2 por tipos contra algún rival; Nv. 50, IV iguales a los del rival del día, EV 0, naturaleza Seria. (RF-10/12/13/14/16)
- UT-20 Igual en 365 días (también IV del jugador = IV del rival, `playerIvs.test.ts`: contra líder 20, campeón 25 y Rojo 30; el snapshot del reto solo cambia en `playerTeam[].ivs`); RF-14 solo relajado si consta en `meta.relaxedRules`; ningún día lanza error; `teamAttempts` ≤ 1000.
- UT-21 Ningún set con tag `source:<rivalDelDía>`; misma especie de otro rival puede entrar, solo una. (RF-11)
- UT-22 Onix (nfe) aparece en el rival; ninguna nfe en `player-sets.json` ni elegida; un pool contaminado no la devuelve.
- UT-19b/UT-20b (RF-13b, RF-13c; `team.test.ts`) Suma de estadísticas base >= 3060 y <= 2 del mismo tipo (antes 2800 y 3; cambios de requisito del 23/10/2026; el tope de intentos pasa de 20 a 100) con los datos reales en un ciclo y en 365 días (sin relajar, <= 20 intentos); pool sin suma posible → 1000 intentos y `relaxed` con RF-13b (y RF-14 solo si no hay movimiento x2); pool con >= 4 Pokémon forzosos de un mismo tipo → DataError (RF-13c no se relaja).
- UT-23 Tirada que incumple RF-13 → reintento (`attempts>1`), equipo válido y determinista. (RF-15)
- UT-24 Pool sin solución para RF-14 → 1000 intentos, `relaxed=['RF-14']`; pool sin solución para RF-12/13 → error de datos tipado en español. (regla 7)
- UT-25 Sin `nature` → `Serious` y marcado; con naturaleza se respeta. (regla 4)
- UT-26 Sustituir `player-sets.json` por otro fixture funciona sin tocar código.

**Validación de datos**
- UT-27 Estructura: 6 sets por variante, nivel 50, `sourceTournament`/`sourceUrl` válidos, ids únicos, categoría y región válidas, 4 movimientos; 53 entrenadores (46 líderes y 7 campeones) con ≥ 1 variante y los líderes con 2 (F2), Brock con 2 variantes, nombres de Acerón y Teniente Surge, calendario con los 53 en la última entrada.
- UT-28 Legalidad Gen 5: especie, objeto, habilidad (de la especie) y movimientos existen en Gen 5; nada prohibido por el PWT; validador de `@pkmn/sim` gen5; un set de Gen 6 se rechaza.
- UT-29 Todos `verified: true`.
- UT-30 IV por categoría: líderes 20, campeones 25, Rojo 30.
- UT-31 EV ausentes → 0 y marcados; presentes → usados.
- UT-32 Todo nombre resuelve en `names-es.json`; ninguno igual a su id; overrides mandan; Hidden Power y Vise Grip resuelven.
- UT-33 `dex-gen5.json`, `names-es.json`, `player-sets.json` iguales a su regeneración en memoria.
- UT-33 (F2): las comparaciones de `names-es.json` y `descriptions-es.json` con su regeneración necesitan `scripts/.cache/` y se omiten con aviso si falta (CI); la cobertura sin caché la da UT-60.
- UT-60 (F2) `scripts/validate-data.test.ts`: el validador de datos (`npm run validate:data`, PRD §8.3) acepta los datos reales (53 entrenadores, 0 problemas) y rechaza especie inexistente, legendario prohibido, objeto/movimiento prohibido (Rocío Bondad, Caída Libre), movimiento de Gen 6 o no aprendible, habilidad ajena, 3 movimientos o repetidos, nivel, nombre en español ausente, líder con 1 variante o sin variantes, IV incorrectos, equipo de 5, `alwaysLeadsWith` ausente y calendario con entrenador desconocido o fuera de frontera de ciclo.
- UT-61 (F3) `src/battle/messageOrder.test.ts` (DEC-44): crítico, supereficaz/poco eficaz, Banda Focus, Robustez, Cinta Focus y Aguante pasan detrás del `-damage` del mismo Pokémon, en su orden; el `-damage` de otro (retroceso) no cuenta; sin `-damage` no cruzan a la acción siguiente; el resto de líneas no se mueve.
- UT-62 (F3) `src/ui/battle/party/partyModel.test.ts` (DEC-46): un debilitado (`0 fnt`) muestra 0 / PS máximos; el icono de una forma (Landorus-T) se busca por `spriteId`; toda especie del dex (694, formas incluidas) tiene icono y nº de Pokédex por su `spriteId`; las formas tienen icono propio y el nº de su especie base.
- UT-63 (F3) `src/storage/playerStats.test.ts` (DEC-47, criterio 14): sin historial todo a 0; ganar dos días seguidos da racha 2; perder la pone a 0 (la de días sigue); saltarse un día pone la de días a 0; sin jugar hoy sigue viva la de ayer; el anulado cuenta como jugado, corta la de victorias y mantiene la de días; el en curso no cuenta; racha máxima entre huecos y entre meses; un día sin jugar rompe también la racha de victorias, y sin jugar hoy sigue viva la de ayer.
- UT-64 (F3) `src/ui/share/shareText.test.ts` (DEC-47, criterio 15): formato de victoria y derrota, casillas en orden del equipo, sin casillas en días antiguos, sin nombre del rival, nada que compartir en curso o anulado, racha al terminar ese día; `shareResult`: copia al portapapeles aunque haya panel de compartir (sin abrirlo; cambio de requisito del 23/10/2026) y fallo.
- UT-65 (F3) almacenamiento y pantallas: `localStorageStore.test.ts` (guarda `playerFainted`; un día antiguo sin él se lee con `null`; uno mal formado es roto), `engine.test.ts` (`playerFainted` en orden del equipo con el inicial en otra posición), `ResultScreen.test.tsx` (estadísticas y Copiar del oficial, práctica sin Copiar, modal con Escape y Cerrar) y `TodayScreen.official.test.tsx` (Estadísticas desde Hoy, vacío sin oficiales).
- UT-66 (F3) `src/storage/settings.test.ts` (DEC-49): ajustes por defecto sin datos o sin almacenamiento; guarda y recupera la velocidad; valor ilegible, de otra versión o velocidad inexistente vuelven al defecto; almacenamiento que lanza no rompe; borrar quita la clave. `localStorageStore.test.ts`: `clear` olvida todo y deja volver a jugar.
- UT-67 (F3) `src/ui/menu/AppMenu.test.tsx` y `App.official.test.tsx` (DEC-49): tres accesos con nombre; Ayuda con sus siete apartados, créditos y aviso legal; Ajustes marca la velocidad guardada y avisa al cambiarla; Borrar datos pide confirmación. En App: el combate arranca con la velocidad guardada y cambiarla en combate se guarda; borrar datos devuelve el oficial del día y los ajustes por defecto. `engine.test.ts` y `BattleScreen.test.tsx` (DEC-48): turnos del clima (Danza Lluvia 5 y bajando; Llovizna permanente) y su indicador. `useStageScale.test.ts`: `frame` solo si cabe sin bajar la escala (cambio de requisito: el resultado lleva ahora `frame`).
- UT-83 `settings.test.ts`, `BattleScreen*.test.tsx` y `AppMenu.test.tsx` (DEC-58): «Siempre» por defecto anima aunque el sistema pida reducir movimiento; «Según el sistema» con `prefers-reduced-motion` marca `data-reduced-motion`; «Nunca» lo marca siempre; `moveAnimations: false` guardado se lee «Nunca». Los casos de reducir movimiento del sistema (intro, cambios) pasan a usar «Según el sistema» (cambio de requisito).
- E2E-71 `e2e/party.spec.ts` (DEC-58): con `reducedMotion: 'reduce'` y Animaciones por defecto, el combate no se marca como reducido y `<html data-motion='full'>`. E2E-35 con reducir movimiento elige «Según el sistema».
- E2E-72 `e2e/today.spec.ts` (PRD §0, 24/10/2026): a 1920 px los sprites de Hoy miden 200 px (al doble) y a 1366 px, 100 px, también en tus tarjetas, donde el sprite cabe en su columna sin montarse sobre el nombre; el contenido no pasa de 1600 px.
- UT-80 `src/data/sprites.test.ts` (PRD §0, 24/10/2026): ningún fotograma de `lanturn.gif` (frente y espalda) dura menos de 100 ms, para que no vuelva el parpadeo del halo a 10 Hz.
- UT-34 Sprites existen (Pokémon front/back por `spriteId`; entrenador `.gif` y `-mini.png`) con cabecera GIF/PNG válida.
- UT-35 Pool: solo evolucionados completos, deduplicados, con tags `source:<idEntrenador>` o `source:smogon-<tier>`, ≥500 sets y ≥200 especies, todos los tiers presentes, sin Caída Libre ni Rocío Bondad, sets de Smogon sin EVs ni naturaleza y con habilidad de la especie; UT-28 valida la legalidad Gen 5 de todo el pool (Smeargle/Sketch aparte) y UT-33 la regeneración de `player-sets.json` y `battle-ui-images.json`; UT-34 existencia de los sprites de todas las especies del pool.

**IA** (`chooseRivalAction`, ≥20 semillas por caso)
- UT-36 Regla 1: elige el KO garantizado de mayor precisión; KO solo con crítico no cuenta; sin KO garantizado pasa a regla 2.
- UT-37 Empate de KO: desempate determinista por semilla.
- UT-38 Regla 2: mayor daño × precisión con tipo, STAB, clima y objeto; nunca una inmunidad si hay otra opción.
- UT-39 Regla 3: Danza Espada / clima si está a salvo; ataca bajo amenaza de KO; no repite con +6, ni clima ya activo, ni estado sobre estado.
- UT-40 Regla 4: cambia al que resiste si recibe KO sin movimiento útil; no cambia sin resistente, atrapado ni sin desventaja.
- UT-41 Regla 5: mejor emparejamiento entre candidatos; índices de `switch N` según `request.side.pokemon` reordenado.
- UT-42 Determinismo; el RNG de la IA es `Prng(battleSeed+":ai")` y no consume el del sim.
- UT-43 IA trivial: primer movimiento habilitado o Forcejeo; primer vivo en `forceSwitch`; nunca inválida.
- UT-44 Decisión < 50 ms con 6 vs 6.

**Registro**
- UT-45 Una línea de cada uno de ~30 tipos → español sin ids; descartes de `-message`, `-hint`, `raw`, `debug`; tipo desconocido → texto genérico en español.
- UT-45b (DEC-36) `translate.items.test.ts`: secuencias `-enditem` capturadas del motor (`[eat]`, `[silent]`, `[weaken]`, gema, Sash, Hierba Blanca, Globo Helio, `[from]` move/stealeat) → un solo mensaje por uso, sin perder objetos quitados (Golpe Bajo, Calcinación) ni efectos propios (Restos, Vidasfera); mismos casos contra el motor real (Baya Zidra/Aranja/Safre/Anti-X, Ladrón, Truco, Bulbo Absorbente...) y 10 partidas con objetos donde ningún `[eat]`/`[silent]` da texto. (RF-51)
- UT-46 Sobre los logs de INT-01: sin `|`, ids, ni palabras inglesas (`used`, `fainted`, `sent out`, `super effective`, `The opposing`…). (RF-51)
- UT-47 Intro: "¡La Líder Camila te desafía!", "¡El Campeón Rojo te desafía!", "¡Camila saca a [Pokémon]!" y envío del inicial. (RF-53)
- UT-48 Sin literales de interfaz en `src/ui/**` fuera de `i18n/es.ts`.

**Vista y fin**
- UT-49 `viewReducer`: aplica líneas y se reconcilia con el snapshot; rival solo en %; restantes correctos.
- UT-50 Fin: turno 300 sigue, 301 → `turnLimit` derrota; empate → derrota; rendición → `lose('p1')`; gana quien debilita 6.
- UT-51 `partyMembers` (`partyModel.test.ts`): orden del request, estadísticas = `calcStats`, objeto/habilidad/naturaleza/movimientos en español, PP del estado del combate, debilitado/activo/estado, género, caída al request sin set. (RF-70, RF-71)
- UT-52 Datos generados: `icon-index.json`, `descriptions-es.json` y `sprite-boxes.json` iguales a su regeneración; toda especie usada tiene icono dentro de la hoja; todo movimiento y habilidad usados tienen descripción en español. (RF-71)
- UT-53 Geometría (`playerSpriteAnchor.test.ts`, `throwGeometry.test.ts`): el sprite del jugador asoma sobre la caja de mensajes (≥ 65 % visible, nada por arriba) para los 33 sprites; la mano del entrenador y el aterrizaje de la bola están dentro del campo y sobre su sprite. (RF-53, RF-72)
- UT-54 El motor expone los PP del jugador en la vista (no los del rival) y bajan al usar un movimiento (`engine.test.ts`). (RF-71)
- UT-55 `fetch-ui-assets`: operaciones `tile`, `clone` y `fill` con `clip`, `strip` y limpiezas con nombre válidas; todos los assets existen en `public/ui`. (RF-70, RF-71)

## 2. Componente
- CMP-01 Cabecera: `#N`, cuenta atrás hh:mm:ss con ceros, sin iconos de Estadísticas/Ayuda/Ajustes.
- CMP-02 Cambio de día con fake timers sin recargar: `#1`→`#2`, rival/equipo cambian, cuenta atrás reinicia; un solo temporizador; variante de día de 23 h.
- CMP-03 Tarjeta rival: sprite, nombre, categoría, región, especialidad solo si existe, torneo.
- CMP-04 Equipo rival: 6 especies; con el toggle oculto no hay movimientos/objetos/habilidades en el DOM; al abrir, 4 movimientos, objeto y habilidad elegida; `aria-expanded`.
- CMP-05 Tarjeta jugador: sprite, tipos, objeto, habilidad, total de base, 6 stats Nv. 50 (= `calcStats`), 4 movimientos con tipo/categoría/potencia/precisión, "—" si no aplica; tipo y categoría en texto.
- CMP-06 "Sacar primero": único inicial, visible (`aria-pressed` y texto); repetir no deselecciona.
- CMP-07 "Combatir": desactivado sin inicial con motivo visible; con inicial llama a `onStart`; botón único, sin "Práctica".
- ~~CMP-08 Emparejamientos~~ **Eliminado** con RF-37 (PRD §0, 19/10/2026); sus tests y los de `estimate` en `damage.test.ts` se borraron.
- CMP-09 Pie con aviso fan (Nintendo, Creatures, GAME FREAK, The Pokémon Company).
- CMP-10 Datos corruptos / sin solución del equipo → error en español, sin traza ni ids, sin pantalla en blanco.
- CMP-11 Sprite ausente → caja con el nombre, mismas dimensiones.
- CMP-12 Menú de movimientos: 4 botones con tipo y PP; desactivados con motivo accesible; solo Forcejeo si no hay ninguno; los desactivados no llaman a `choose`.
- CMP-13 Cambiar: abre la pantalla de equipo con los 6 Pokémon; al elegir uno, Cambiar / Datos / Cancelar; el debilitado y el activo no son elegibles (Cambiar con `aria-disabled` y motivo); el `slot` sigue el orden de `side.pokemon`; atrapado o sin banquillo → botón desactivado con motivo.
- CMP-14 Cambio forzado: solo pantalla de equipo, sin Cancelar ni Volver ni movimientos; Escape no sale; Datos disponible; debilitados no elegibles.
- CMP-15 Turno automático (recarga, dos turnos) avanza sin input.
- CMP-16 Cinco clics rápidos → un `choose`; durante animación y turno rival la pantalla táctil queda en espera (sin botones ni movimientos) y al llegar el turno siguiente reaparece el menú principal con el foco en Luchar; «Turno N» no sale en la caja de mensajes pero sí en el historial. (RF-77, RF-78)
- CMP-17 Restantes 6/6 → bajan al debilitarse, con texto.
- CMP-18 Campo: rival de frente, jugador de espaldas; barra rival solo %, jugador actual/máx; estado en español, clima visible.
- CMP-19 Rendirse: diálogo (foco dentro, Escape cancela); cancelar sin cambios; confirmar → `forfeit` y Resultado derrota.
- CMP-20 Salir del combate pide confirmación y descarta.
- CMP-21 Control de velocidad; con `prefers-reduced-motion` sin desplazamientos.
- CMP-22 Error del worker → mensaje en español y "Volver a Hoy".
- CMP-23 Resultado: victoria (turnos, en pie), derrota (x/6), rendición, 300 turnos; "Volver a Hoy" y "Otro combate" (mismo reto, nuevo `battleSeed`).
- CMP-24 Navegación today → battle → result → today/battle; medianoche en combate mantiene el reto de inicio.
- CMP-25 Pantalla de equipo (`PartyScreen.test.tsx`): 6 placas con nombre, PS y estado accesibles; icono, nivel y placa roja del debilitado; menú Cambiar / Datos / Cancelar; Cambiar envía el `slot`; Escape cierra el menú y devuelve el foco; sin Cancelar/Volver en el forzado; desactivada si el turno no está abierto. (RF-49, RF-70)
- CMP-26 Pantalla de datos: tres páginas con ← →, botones « » y pestañas, sin pasar de los extremos; ↑ ↓ cambian de Pokémon dando la vuelta; Habilidades con las 5 estadísticas reales, PS, habilidad y descripción; naturaleza marcada con texto; detalle del movimiento (categoría, potencia, precisión, descripción, `aria-pressed`); PP actuales/máx; Volver, Escape y Cerrar; el foco vuelve a la placa. (RF-71)
- CMP-27 Cambio animado (`BattleScreen.switch.test.tsx`): retirada a los 0,5 s y envío con su texto; rival; forzado sin retirada (`-send`); controles bloqueados y abiertos al terminar; mensajes uno a uno y sin duplicados en el historial; x4; un toque adelanta el texto; `drag` sin bola; `prefers-reduced-motion`; no se anima en el primer update. (RF-72)
- CMP-28 Mochila atenuada con motivo accesible y aviso en la caja de texto (`BattleScreen.intro.test.tsx`). (RF-73)
- CMP-30 Orden de las fases (`introTimeline.test.ts`): en la intro y en los cambios el entrenador termina de salir antes de que empiece a aparecer su Pokémon (leído de `battle.css`). (RF-76)
- CMP-29 Escala del lienzo (`useStageScale.test.ts`): fraccionaria por debajo de x2 a todo el ancho (360, 400 px), entera desde x2, entre 1 y 4, el alto manda con ventanas bajas. (RNF-06)

## 3. Integración del motor (Node)
- INT-01 20 semillas × 5 retos, jugador trivial vs rival heurístico: todas terminan, turnos ≤ 301.
- INT-02 Misma semilla y elecciones → log idéntico byte a byte; semillas distintas difieren.
- INT-03 El reto no cambia tras correr partidas; dos combates del mismo reto con distinto `battleSeed` difieren; `battleSeed` de `crypto.getRandomValues`.
- INT-04 PS rival en `/100`; jugador con PS reales; sin `|debug|` ni `|raw|`.
- INT-05 Formato: sin Team Preview; Nv. 50; IV rival por categoría, jugador con los IV del rival/EV 0; stats del sim = `calcStats`; sin cláusula de sueño ni OHKO (Frío Polar usable); sin cláusulas de especie/objeto en combate.
- INT-06 Inicial del jugador y del rival (`alwaysLeadsWith`); índices de `switch N` tras reordenar.
- INT-07 Restricciones del request (Elección, Anulación, Mofa, Otra Vez, sin PP, atrapado, recarga, dos turnos); elección inválida rechazada sin avanzar.
- INT-08 Cambios forzados (KO, Ida y Vuelta, Voltiocambio, arrastre); sin banquillo se resuelve sin bloqueo.
- INT-09 Debilitamientos simultáneos y empate → derrota.
- INT-10 300 turnos exactos siguen; superarlos → `turnLimit` (con `maxTurns` bajo forzado).
- INT-11 `forfeit` → derrota; `choose` posterior ignorado.
- INT-12 Tras cada `choose`, la IA responde a todos los requests de p2 (incluido `forceSwitch`); sin cuelgues.
- INT-13 En ≥100 partidas el rival usa al menos un movimiento de estado y un cambio.
- INT-14 Dificultad preliminar: 50 partidas con jugador "mejor daño" sobre los 5 rivales; informe de % de victorias (detecta extremos <10 % o >95 %), sin aserción estricta.
- INT-15 Turno completo (jugador + IA + traducción) < 300 ms (mediana y p95 en 200 turnos).
- INT-16 Sin `debug`/`raw` en las líneas a la UI; un nombre con HTML se renderiza como texto.

## 4. E2E (los casos sensibles al tiempo llevan `@timing` en el título —E2E-03 de las 23:59:55, E2E-21, E2E-47, E2E-48, E2E-49, E2E-50, E2E-51—: `npm run test:e2e` los excluye de la tanda principal y los ejecuta después con `--workers=1`, `npm run test:e2e:timing`; chromium + webkit; ganchos `?date=`, `?trainer=`, `?variant=`, `?seed=`, `?ai=trivial`; `page.clock`)

Las fechas "D0", "3 fechas" y "5 fechas" de abajo son, desde DEC-35, escenarios por rival (`e2e/support.ts`: Plubio, Misty, Máximo, Camila, Rojo, Brock); la fecha de cada escenario es un literal que solo siembra el equipo del jugador.
- E2E-01 Hoy completo con `?date=2026-10-19`: `#1`, cuenta atrás, rival, 6 especies, 6 tarjetas, "Combatir" desactivado con motivo, aviso fan, consola limpia. F3 (22/10/2026, cambio de requisito): la cabecera tiene los botones de Estadísticas, Ayuda y Ajustes (antes se exigía que no hubiera ninguno).
- E2E-02 Dos contextos (distinto `timezoneId`) con la misma fecha → mismo reto.
- E2E-03 `page.clock` 23:59:55 + 10 s: `#1`→`#2`, cambia el reto, reinicia la cuenta atrás, sin recarga; variante 2027-03-27 (~23 h). La cuenta atrás del #2 se espera con la duración real de ese día en Madrid (23 de octubre de 2026: con `LAUNCH_DATE` = 2026-10-24, el #2 es el 25, de 25 h, y se espera «24:59:..»; antes se suponía siempre 23:59).
- E2E-04 Medianoche con combate en curso: sigue el reto original; Hoy muestra el nuevo al volver.
- E2E-05 Partida completa contra IA trivial (3 semillas × 3 fechas) hasta Resultado; registro en español; misma semilla y decisiones → mismo resultado. Límite por partida: 420 s (24/10/2026; con equipos más fuertes las de Plubio rozaban los 240 s con 4 trabajadores en paralelo). El ayudante `waitForActionOrResult` espera a las placas de la pantalla de equipo si está abierta (cambio forzado) en vez de intentar pulsar Luchar, que queda tapado mientras cargan.
- E2E-06 Cambio voluntario y forzado tras KO.
- E2E-07 Rendirse: cancelar sin cambios; confirmar → Derrota; "Volver a Hoy" y "Otro combate".
- E2E-08 Salir del combate pide confirmación y descarta.
- E2E-09 Toggle del rival: oculto por defecto, mostrar/ocultar con datos (ya no hay toggle de emparejamientos).
- E2E-44 Hoy precarga los 10 dígitos de PS y las 3 barras antes del combate (sin parpadeo de dígitos viejos). Unitario: `preloadAssets.test.ts`; propiedad de PS exactos y sin subidas fuera de curaciones: `viewReducer.hpSequence.test.ts`.
- E2E-45 Ocultar los sets del rival (1280 y 360 px y con `prefers-reduced-motion`): texto «Ver/Ocultar…», `aria-expanded` y panel del rival a la vista tras ocultar. Unitarios en `TodayScreen.test.tsx` (texto, `aria-expanded`, `scrollIntoView` con `smooth`/`auto`). (RF-34)
- E2E-46 Cambio forzado: la pantalla de equipo se cierra al elegir y el nuevo Pokémon sale con la Poké Ball (`data-switch="player-send"`, bola animada). (RF-47)
- E2E-48 Hoy solo pide sprites del reto de hoy (≤12 especies con frente y espalda y 1 entrenador). (RF-11b)
- E2E-49 Con la red lenta (retardo en `/ui/battle/*.png`), Equipo y Datos no se enseñan a medio cargar: todas las `<img>` ya cargadas en el primer fotograma. Falla sin la precarga y la espera. (RF-11b)
- E2E-50 Los PS numéricos del jugador bajan monótonos, con valores intermedios y a la par de la barra (≤1 px), y terminan en el PS exacto. Unitarios: `DataBox.hpAnimation.test.tsx` (bajada, curación, varios golpes, x2/x4, `prefers-reduced-motion`, cambio de Pokémon). (RF-11c)
- E2E-51 Orden del debilitado (`e2e/faint-order.spec.ts`, chromium y webkit, x1/x2/x4, tiempo real, sin `page.clock`): muestreo cada 50 ms de la anchura del relleno de la barra (`--fill`), el atributo `data-fainted`, la opacidad del sprite y el mensaje; en cada paso a debilitado (jugador y rival) el relleno ya es 0, el mensaje «se ha debilitado» ya se ve y el sprite seguía opaco justo antes. Falla con la vista marcando debilitado en el golpe (relleno 11-12 px al pasar a debilitado). Unitarios: `faintOrder.test.ts` (vista del golpe letal) y `BattleScreen.faint.test.tsx` (con reloj simulado: barra -> mensaje -> sprite, jugador y rival). (DEC-42)
- E2E-52 Recargar a mitad del oficial (`e2e/official.spec.ts`, chromium y webkit): tras tres decisiones, recargar y Reanudar deja el mismo Registro, PS y contadores, no recorre ninguna fase de intro y no duplica decisiones guardadas; se puede seguir jugando. (PRD §14.7 y §14.17, DEC-43)
- E2E-53 Salir y volver a Hoy: el oficial pasa a Reanudar, habilitado sin elegir inicial, y retoma el mismo estado. (PRD §4.3)
- E2E-54 Rendirse en el oficial es derrota; el botón queda deshabilitado con «Derrota · N turnos · X/6 en pie», también tras recargar; una práctica posterior (a medias o terminada) no cambia lo guardado. (PRD §14.8, §14.9, §14.10)
- E2E-55 Una práctica antes del oficial no lo gasta, no escribe en `localStorage` y no se reanuda al recargar.
- E2E-56 `@timing` (`page.clock`): un oficial empezado a las 23:59:30 y terminado pasada la medianoche se registra en el día de inicio; Hoy muestra el reto nuevo (#N+1) con el oficial libre. (PRD §4.3)
- E2E-57 `localStorage` bloqueado (lanza): el sitio funciona, avisa de que no se guarda, el oficial queda gastado en memoria y la consola queda limpia.
- E2E-58 Registro guardado irreproducible (versión de datos y variante que ya no existen): aviso en español, oficial «Anulado» y deshabilitado, también tras recargar, y la práctica sigue disponible. (política de DEC-43)
- E2E-59 JSON corrupto en `daily-pwt:v1`: Hoy carga sin errores y el oficial está libre.
- E2E-60 (F3) `e2e/official.spec.ts`: tras rendirse en el oficial, Resultado enseña jugados 1, 0 % y racha de días 1; Copiar copia (Chromium) el texto con el formato de PRD §11 sin el nombre del rival; Estadísticas se abre desde Hoy y se cierra con Escape. E2E-11 pasa también axe con Estadísticas abierto.
- E2E-61 a 63 (F3) `e2e/menu.spec.ts`: Ayuda desde Hoy con créditos y aviso legal (Escape la cierra); la velocidad de Ajustes sobrevive a recargar y la usa el combate; borrar datos tras el oficial lo deja otra vez «Jugar» y sin claves `daily-pwt*`. E2E-11 pasa axe también con Ayuda y Ajustes abiertos.
- E2E-64 (F3) `e2e/menu.spec.ts`: a 1440×900 el combate va enmarcado con escala 2; a 1280×720, sin marco.
- Humo en CI (DEC-50): los casos marcados `@smoke` (E2E-01, E2E-05 registro en español, E2E-17 build sin ganchos, E2E-60 y E2E-61) corren en Chromium en el job `e2e-smoke` de `ci.yml` (`npm run test:e2e:smoke`).
- E2E-65 `e2e/intro-slide.spec.ts` (DEC-51): tras un KO, la animación del entrenador rival es `bt-visit-right-send` y, recorrida con la Animation API, empieza fuera por la derecha, está en el centro al lanzar (30 %) y acaba fuera. E2E-49 (red lenta) vuelve a pasar con `useImagesLoadedIn` y los fondos de Datos montados siempre.
- UT-68 `partyModel.test.ts` (DEC-52): `rivalMembers` da los 6 en orden con set y estadísticas reales, PS en porcentaje, debilitado, estado y activo desde la vista, y los PP que le quedan desde la vista (llenos si no los trae; antes `pp: null`, cambio de requisito del 22/10/2026); `engine.test.ts`: la vista de los dos bandos trae los PP. `BattleScreen.intro.test.tsx` y E2E-23 (cambio de requisito, antes la Mochila atenuada): RIVAL abre el equipo rival con 6 placas en %, sin Cambiar, Datos con los PP que quedan («x/y»; antes solo el máximo), y se cierra.
- UT-69 `src/ui/battle/fx/effects.test.ts` (DEC-53): los 95 efectos (17 genéricos, 17 especiales por tipo y 61 propios: tres tandas de 20 y Maldición; 23/10/2026) caben en el tiempo del mensaje, dibujan algo, con coordenadas finitas, puntos de 1 a 7 px y dentro del lienzo, son deterministas con la misma semilla y sus temblores son pequeños y se apagan al terminar; 40 propios; `effectFor` elige el propio, el especial de su tipo (uno distinto por cada uno de los 17 tipos) o el genérico; físicos clasificados por cómo golpean (muerden, puñetazo, patada, corte); `move-fx.json` con clases conocidas y bien clasificadas. `generated.test.ts`: `move-fx.json` igual a su regeneración y cubre todos los movimientos de los equipos.
- UT-70 `src/hooks/moveFxCues.test.ts` (DEC-53, DEC-55): movimiento, usuario y objetivo de la línea `|move|` (Maldición sin ser Fantasma y Danza Espada, sobre el propio usuario); no se anima con `[miss]`, `[still]` ni `[notarget]`.
- UT-74 `src/hooks/moveFxCues.test.ts` y `effects.test.ts` (DEC-55): estados (al caer, `cant`, daño de quemadura y veneno, confusión), bayas que suben una característica, subidas y bajadas (sin flechas con 0 niveles) y golpes múltiples (desde el segundo `-damage` sin `[from]` del objetivo; ni retroceso, ni objetos, ni el turno siguiente, ni movimientos sobre uno mismo); cada estado, la baya y las flechas tienen su efecto; Maldición se dibuja sobre el usuario o sobre el objetivo. `translate.test.ts`: «¡La Baya Aslac ha subido la Velocidad de…!» y los demás objetos con el mensaje de siempre.
- UT-71 `BattleScreen.test.tsx` (DEC-53): el lienzo recibe el movimiento usado; con las animaciones desactivadas, ninguno. `settings.test.ts` y `AppMenu.test.tsx`: la opción se guarda, se lee activada en ajustes antiguos y se cambia en Ajustes.
- UT-72 `src/core/hiddenPower.test.ts` (DEC-54): Lucha 30, Siniestro 30 y Lucha 70 con IV 20, 25 y 30; coincide con el simulador en IV variados; `resolveHiddenPowerId` solo cambia Poder Oculto.
- UT-73 `src/ui/hiddenPowerDisplay.test.ts` (DEC-54): tarjeta, datos (propios y del rival) y menú del combate enseñan «Poder Oculto <tipo>» con su potencia real.
- E2E-66 `e2e/battle.spec.ts` (DEC-53): al usar un movimiento el lienzo pinta algo; con las animaciones desactivadas en Ajustes no hay animación.
- UT-75 `scripts/build-audio.test.ts` (DEC-57): las 10 pistas de combate tienen puntos de bucle (vuelta de más de 40 s, después de 5 s y a más de 10 s del final) y `victory-pwt` no; `planAudio` rechaza un punto sin el otro o el final antes del principio.
- UT-76 `src/audio/audioEngine.test.ts` (DEC-57), con un `AudioContext` falso: nada suena antes de la primera interacción y la música pedida antes empieza al tocar; bucle con sus puntos y jingle sin bucle; volumen y silencio en la ganancia maestra al instante; parar funde y una descarga tardía no la vuelve a encender; cada audio se descarga y decodifica una vez bajo la raíz del sitio; sin Web Audio o con la red caída, mudo y sin lanzar; `crossfadeLoopSeam` funde la costura.
- UT-77 `settings.test.ts` y `AppMenu.test.tsx` (DEC-57): `sound` y `volume` se guardan; los ajustes guardados sin ellos, o con un volumen fuera de 0-100 o no entero, se leen activado y a 70; en Ajustes, Activado/Silenciado y el deslizador «Volumen» (en %) avisan con el valor nuevo.
- UT-78 `battleSfx.test.ts` y `useBattle.replay.test.tsx` (DEC-57): golpe neutro, supereficaz o poco eficaz según la misma acción y el mismo objetivo (no la siguiente ni otro Pokémon), uno por golpe en los múltiples, ninguno con `[from]`; tiempos de la Poké Ball; `conditionSoundFor`, un sonido por estado, la baya y las subidas y bajadas, y ninguno para los movimientos (cambio de requisito del 23/10/2026: antes la baya y las flechas no sonaban); en vivo suenan las 4 de la intro y los golpes, y al reproducir un combate guardado nada.
- E2E-68 `e2e/sound.spec.ts` (RF-91): Silenciado y el volumen bajado con el teclado a 40 % siguen así al recargar.
- E2E-70 `e2e/sound.spec.ts` (RF-91): en combate, el botón Sonido abre su ventana; Silenciado y subir el volumen a 75 % se guardan en `daily-pwt:settings`.
- E2E-69 `e2e/sound.spec.ts` (RF-87, RF-92): sin interacción, Hoy no pide audio; el combate pide una sola pista (`gym-`/`champion-` + región) y todos los efectos del índice; sin errores en consola. **Límite:** el Chromium de Playwright no trae AAC (`canPlayType` vacío, `decodeAudioData` falla), así que los E2E no oyen nada: que suene de verdad (bucles, volumen, efectos) se comprueba a mano en Chrome, Firefox o Safari.
- UT-79 `menuSounds.test.ts` (DEC-57): «elegir» en los botones de la pantalla táctil, el equipo y los datos (también al tocar dentro del botón), «cancelar» en volver y cerrar; nada en botones desactivados, fuera del menú o en lo que no es botón.
- UT-80 `battleModel.pinch.test.ts` y `audioEngine.test.ts` (DEC-57): el pitido de vida baja solo con el activo del jugador en rojo (≤ 20 %) y en pie; nunca por el rival, ni en amarillo, ni con PS a 0, ni con otro activo; el motor lo hace en bucle, lo arranca al tocar si se pidió antes y lo para con `null`.
- UT-81 `BattleScreen.test.tsx` (RF-77b): tras pulsar un movimiento, la caja de mensajes está vacía (antes asomaba el último mensaje del turno anterior hasta la respuesta del motor).
- UT-82 `bag.test.ts` y `challenge.test.ts` (apertura del lanzamiento, DEC-03): en el primer ciclo, el de la apertura sale el día 0 intercambiado con quien estaba; el resto de ciclos no cambia; un id ausente se ignora; con los datos reales, el #1 (y las fechas anteriores) es Misty.
- E2E-67 `e2e/mobile.spec.ts` (PRD §0, 22/10/2026): a 360 px la cabecera de Hoy va en una fila (bola, `#N`, cuenta atrás y los tres iconos, sin solaparse ni salirse), y el título «Daily PWT» y «Próximo reto en» siguen para lectores de pantalla.
- UT del progreso guardado (DEC-43): `src/storage/localStorageStore.test.ts` (un oficial por día, dos pestañas, versión del esquema, JSON y días corruptos, almacenamiento nulo/bloqueado/cuota llena y su recuperación); `src/hooks/useBattle.replay.test.tsx` (reproducción con el motor real: mismo estado, petición e historial que en vivo, sin intro, sin notificar decisiones reproducidas, fallos por checkpoint, decisión rechazada y fin anticipado, rendición como última decisión); `src/App.official.test.tsx` (un intento, reanudar, resultado, rendirse, prácticas sin efecto, regla del día de inicio, día anterior sin terminar, política de reproducción fallida, sin almacenamiento); `src/ui/today/TodayScreen.official.test.tsx` (estados Jugar / Reanudar / Victoria / Derrota / Anulado, práctica, avisos); `src/ui/battle/BattleScreen.mode.test.tsx` (etiqueta y diálogos).
- E2E-47 Intro (`e2e/intro-slide.spec.ts`, chromium y webkit, tiempo real: sin `page.clock` ni saltar la transición): muestreo cada 50 ms con `getBoundingClientRect`; cada entrenador presenta >= 3 posiciones x intermedias distintas dentro del lienzo durante >= 400 ms en total, parte del borde, y la fase `enter` empieza con el iris ya revelado (opacidad < 5 %). Con el código anterior falla (iris a ~30 % al empezar la entrada). (PRD §10.2.1, DEC-30)
- E2E-10 Teclado completo: partida jugable sin ratón, foco visible, diálogos devuelven el foco.
- E2E-11 `@axe-core/playwright` sin violaciones serias/críticas en Hoy, Combate, Resultado y diálogo; contraste AA.
- E2E-12 360 px táctil: `scrollWidth ≤ 360`, objetivos ≥ 44 px, jugable con `tap`.
- E2E-13 Datos corruptos (`page.route`) → error en español.
- E2E-14 Fallo del worker → error con volver a Hoy.
- E2E-15 GIF abortado → caja con nombre.
- E2E-16 `image-rendering: pixelated`; tamaño renderizado múltiplo entero del natural; GIF animado.
- E2E-17 Build sin `VITE_TEST_HOOKS`: ganchos ignorados y ausentes del bundle.
- E2E-18 Táctil en espera durante animación y turno rival; cinco clics = una decisión; «Turno N» no sale en pantalla. (RF-77, RF-78)
- E2E-19 Solo peticiones del mismo origen; fuente local.
- E2E-20 Resultado mínimo (RF-60/61).
- E2E-21 Throttling 4G + CPU ×4: Hoy < 3 s; ruta crítica < 230 KB gzip (provisional, DEC-40); sim y `@smogon/calc` fuera de ella.
- E2E-22 E2E-01, 05, 07, 10 y 12 pasan en chromium y webkit; Firefox si el entorno lo permite.
- E2E-23 Mochila atenuada: `aria-disabled`, motivo accesible y aviso en la caja de texto. (RF-73)
- E2E-24 El sprite del jugador asoma sobre la caja de mensajes. (RF-44)
- E2E-25 Equipo desde el combate: 6 placas con nombre, nivel, PS, estado e icono; Volver; elegir Pokémon abre Cambiar / Datos / Cancelar y cambiar desde el menú envía el cambio. (RF-70)
- E2E-26 Datos: tres páginas con botones y teclado, otro Pokémon, detalle de movimiento, Volver y Escape; los PS y PP reflejan el combate. (RF-71)
- E2E-27 Cambio forzado: sin Cancelar ni Volver, Escape no sale, Datos disponible. (RF-49)
- E2E-28 axe sin violaciones serias en equipo, menú y las tres páginas de datos. (RNF-04)
- E2E-29 Teclado en el equipo: Tab, Enter abre el menú con el foco en Cambiar, Escape devuelve el foco a la placa.
- E2E-30 Alineación en Hoy: iconos de tipo del mismo ancho; en cada lista de movimientos tipo, categoría, potencia y precisión en la misma columna; cabeceras y tarjetas de la misma fila con la misma altura; tarjetas del jugador con la misma rejilla. (RF-34, RF-35)
- E2E-31 El contenido de Hoy termina por encima de la barra fija «Combatir». (RF-35b)
- E2E-32 Texto de los iconos de tipo centrado (tinta medida sobre una captura, tolerancia 2 px lógicos en horizontal). (RF-35)
- E2E-33 Pantalla de datos sin desbordes en 5 fechas × 6 Pokémon × 3 páginas (cajas dentro del lienzo, `scrollHeight ≤ clientHeight`, nombre del movimiento a la derecha del icono, descripción de la habilidad centrada en vertical). (RF-71)
- E2E-34 Ningún texto con `overflow` oculto corta los descendentes de la fuente (se mide el alto de tinta de `ÁÉÍÓÚpgjqyÑ` con la fuente cargada frente al alto útil de la caja) en Hoy, combate, equipo y datos.
- E2E-35 Cambio animado: el entrenador y la bola aparecen en el campo durante el cambio y desaparecen al terminar, sin bloquear el turno. (RF-72)
- E2E-37 Rejillas de Hoy (equipo rival, tarjetas del jugador y detalle del rival) a 360, 768, 1280 y 1440 px: el último elemento de cada fila llega al borde derecho del panel (±2 px).
- E2E-38 Datos: texto de los iconos de tipo de las placas de movimientos centrado (≤ 1 px lógico); el selector « Página » y el título de la cabecera se comprueban en E2E-42. (RF-71)
- E2E-42 Pantalla de datos: las mayúsculas de cada texto quedan centradas en la franja del fondo que le corresponde (`data-band`, tabla `summaryLayout.ts`), ≤ 1 px nativo, en las tres páginas. (RF-71)
- E2E-43 Equipo: las mayúsculas del nombre, el nivel y los PS de cada placa quedan centradas en su franja (`PANEL_BANDS`), ≤ 1 px nativo. (RF-70)
- E2E-39 Intro: el entrenador sale antes de que aparezca su Pokémon (rival y protagonista, leído de `getAnimations()`) y no queda ninguno tras la intro. (RF-76)
- E2E-40 Barra superior en una línea en escritorio. (RF-75)
- E2E-41 Teselas de movimiento: sin icono de tipo, nombre accesible con tipo y PP, PP centrados con el mismo hueco, botón Volver ripeado. (RF-46)
- E2E-36 Escala: a 360 y 400 px el lienzo ocupa todo el ancho (fraccionaria); a 1280×800 escala 2 y sin escala fraccionaria en los sprites. (RNF-06)

## 5. Verificación visual (360×740 y 1280×800, fechas fijas; capturas en `e2e-artifacts/vis/` con `npm run vis`, ignoradas por git)
| ID | Estado | Comprobar |
|---|---|---|
| VIS-01 | Hoy en D0, D+1, D+3 | Jerarquía, sin scroll horizontal, estilo de los menús de N2/B2 y del PWT |
| VIS-02 | Hoy con el panel del rival abierto | Sin desbordes ni truncados |
| VIS-03 | Inicial elegido / sin inicial con motivo | Selección distinguible sin color |
| VIS-04 | Nombres largos, "—" en movimientos | Sin recortes, stats alineados |
| VIS-05 | Error de datos | Mensaje legible |
| VIS-06 | Combate: inicio | Lienzo 256×192 a escala entera, campo, caja de texto, menú 2×2, barras |
| VIS-07 | Movimientos desactivados / PP bajos | Desactivado sin solo color, tipo en texto |
| VIS-08 | Cambio y cambio forzado | Legible a 360 px, sin cancelar en forzado |
| VIS-09 | Estados, clima, PS bajos | Etiquetas de estado, contraste |
| VIS-10 | Diálogo de Rendirse | Foco, contraste, tamaño táctil |
| VIS-11 | Registro | Español, sin ids ni inglés |
| VIS-12 | Resultado victoria y derrota | Datos de RF-60 |
| VIS-13 | Pixelado | Sprites sin difuminar |
| VIS-14 | `prefers-reduced-motion`, alto contraste | Sin desplazamientos, sin pérdida de información |
| VIS-16 | Pantalla de equipo (360, 400, 1280) y menú Cambiar / Datos | Comparada con `BW_Party`/`B2W2_Party`: posiciones de placas, texto y barras |
| VIS-17 | Datos, páginas 1 a 3 (360, 400, 1280) | Superpuestas a `BW_summary_1/2/2_desc` (50 %): cada texto en su hueco, sin restos del fondo original |
| VIS-18 | Hoy (360, 1280) con el rival abierto | Cajas integradas, iconos de tipo en español alineados |
| VIS-21 | Elegir ataque, espera y turno siguiente (400 px) | Menú de movimientos → táctil en espera → menú principal |
| VIS-19 | Lanzamiento de la intro y cambio (hoja de contactos) | La bola sale de la mano y cae sobre el Pokémon; retirada con rayo rojo |

Aceptación: las 14 capturas × 2 anchos revisadas sin hallazgos de severidad alta abiertos; cada hallazgo corregido o justificado.

## 6. Trazabilidad resumida
RF-01 UT-03/18, E2E-02/03 · RF-02/03 UT-01/02/08/09 · RF-04 UT-08/17 · RF-05 UT-10..13 · RF-06 UT-14 · RF-07 UT-15 · RF-08 UT-16, INT-06 · RF-09 UT-04 · RF-10..16 UT-19..26 · RF-17..21 UT-27..32 · RF-30/31 UT-05, CMP-01/02, E2E-03/04 · RF-32..36 y RF-38/39 CMP-03..07 y CMP-09 (RF-37 eliminado) · RF-40..43 INT-01..06, UT-42 · RF-44/45 UT-49, INT-04, CMP-17/18 · RF-46..49 CMP-12..15, INT-07/08 · RF-70 CMP-25, UT-51, E2E-25/27..29, VIS-16 · RF-71 CMP-26, UT-51/52/54, E2E-26/28/33, VIS-17 · RF-72 CMP-27, UT-53, E2E-35, VIS-19 · RF-73 CMP-28, E2E-23 · RF-74 VIS-06 · RF-50 UT-36..44, INT-12/13 · RF-51/53 UT-45..48, INT-16 · RF-52 CMP-21 · RF-54..56 UT-50, INT-10/11, CMP-19, E2E-07 · RF-57 VIS-06..11 · RF-60/61 CMP-23, E2E-20 · RNF-01 E2E-21 · RNF-02 INT-15 · RNF-03 E2E-12 · RNF-04 E2E-10/11 · RNF-05 UT-32/46/48 · RNF-06 UT-34, CMP-29, E2E-16/36 · RNF-07 E2E-19 · RNF-08 E2E-22 · RNF-10 VIS · criterios 1..13 cubiertos por los casos anteriores (1: UT-08, E2E-02; 2: CMP-02, E2E-03; 3: UT-10/12; 4: UT-17; 5: INT-05/06; 6: UT-36/40/41; 7: CMP-19, E2E-07; 8: UT-19/20; 9: UT-28/29; 10: UT-34, E2E-16; 11: E2E-05; 12: VIS; 13: E2E-10/11).

## 7. Entorno y limitaciones
- Node ≥ 22.12; `@pkmn/sim` 0.10.11 y `@smogon/calc` 0.12.0 exactas; `@axe-core/playwright` como devDependency; Playwright con chromium y webkit (`npx playwright install`).
- `VITE_TEST_HOOKS=1` para el build de E2E; segundo build sin ella para E2E-17. `TZ` controlable por proceso en UT-03/05.
- Limitaciones: Safari iOS real, Firefox y móviles modestos quedan como prueba manual; rendimiento con throttling simulado; axe cubre solo parte de WCAG; RF-57 (fidelidad N2/B2) y el criterio 12 son revisión visual; los datos se validan en forma y legalidad, no en exactitud frente al juego (revisión manual con dos fuentes); el sim puede diferir de N2/B2 en casos concretos; el pool provisional es pequeño y puede forzar la relajación de RF-14.
