# Daily PWT · Pendiente

Solo lo que pasa a F2/F3. El alcance de cada fase está en `PRD.md` §0.

**Ramas (23/10/2026):** todo lo hecho hasta las animaciones está en `main` (las ramas apiladas se unieron con fast-forward y se borraron, decisión de Jose). El sonido va en `feature/f3-sonido` (desde `main`): los audios ya están descargados y versionados (se descargaron en local, desde la nube las fuentes están bloqueadas); falta implementarlo según «Sonido: plan de implementación».

## Campaña Nuzlocke de Hoenn Esmeralda

- **Verificación T4, 11/11/2026:** 33 tests nuevos en `leagueEvolution.test.ts`; `calendar.test.ts` adaptado a evolucionar antes de fijar la plantilla (DEC-93). Tanda focalizada: 44/44. TypeScript, lint, `validate:data`, build y `git diff --check` pasan. Vitest completo: 2600 aprobados, tres fallos y uno omitido. Antes de acreditar la regresión completa, resuelve los dos casos del importador afectados por T5 (`import-emerald-items.test.ts`: total antiguo de 70 frente a 134 y fixture sin `src/data/items.h`) y reconcilia la evidencia del calendario de `draft-results-100.json` con el calendario usado para el informe (`report-nuzlocke-draft.test.ts`). No actualices solo el hash sin comprobar la validez de la simulación histórica. T5 queda pendiente de su siguiente etapa; los E2E los ejecuta Claude según el reparto del backlog común.

- **D4(b/c), 11/11/2026:** `account.campaign` integra el guardado por cuenta en todos los puntos de D1 con confirmación remota, journal por propietario, UUID estable para reintentos y validación del registro. Conserva el recorrido síncrono local. La decisión de Jose de bloquear y ofrecer «Recargar campaña» está en PRD §0 y DEC-90: estado, operación y textos i18n listos para D7, sin interfaz nueva. Un conflicto o fallo de guardado detiene el motor; la recarga fallida conserva intención y bytes. Cerrar sesión limpia inmediatamente el registro activo y el worker, incluso si Auth o un resumen del diario siguen pendientes. La guía de integración y migración está en [GUARDADO.md](nuzlocke/GUARDADO.md). No se ha cambiado la migración validada ni se ha operado en producción.
- **Verificación D4(b/c), 11/11/2026:** 30 tests nuevos con los helpers de cloud; 71/71 focalizados y suite completa 2532/2532 en 147 ficheros (`npx vitest run --maxWorkers=2`, 427,55 s). Validación de datos, `tsc -b`, lint, build y `git diff --check` correctos. La tanda inicial con paralelismo por defecto se interrumpió tras un timeout de UT-101 en `App.cloud.test.tsx`; la pasada completa final con dos trabajadores pasa sin cambiar tests ni umbrales. Los tests SQL de la migración de D4(a) ya pasaron en Supabase local con el coordinador y no se ha modificado su SQL. Los E2E completos, incluida la tanda de tiempos, los ejecuta el coordinador por indicación de Jose; no se intenta Docker ni abrir puertos desde este sandbox. D7 debe presentar y verificar en navegador el aviso y el botón con las operaciones de esta entrega.
- **D4(a), 11/11/2026:** migración aditiva `20261111000000_pwt_campaign.sql`: registro por cuenta, formato v1, revisión esperada y recibos de operación, RPC propias y RLS de propietario. Contrato y motivos en DEC-89. `supabase/campaign.test.ts` añade 17 tests y ejecuta el SQL compartido `supabase/tests/campaign.test.sql`, que prueba aislamiento, privilegios y RLS con dos cuentas. Conserva los cambios de D1/D2/D3. Cliente y guía de uso implementados en D4(b/c), DEC-90; conecta la interfaz en D7.
- **Verificación D4(a), 11/11/2026:** Vitest completo 2494/2494; los 17 tests nuevos también pasan tras la revisión final. `validate:data`, `tsc -b`, lint, build y `git diff --check` correctos. Validación de Supabase local completada por Claude el 11/11/2026: `npx supabase db reset` aplica la migración y `npx supabase test db` pasa `campaign.test.sql` (Result: PASS). En el sandbox de Codex, `npx supabase start` y `npx supabase db reset --local` fallan al escribir `/home/quimi/.supabase/telemetry.json` (EROFS), y Docker deniega acceso a `/var/run/docker.sock`. En un entorno con esos permisos, ejecutar `npx supabase start`, `npx supabase db reset --local` y `npx supabase test db`. PGlite prueba todas las migraciones y el mismo SQL, pero no sustituye esa comprobación. E2E completo intentado: el servidor no arranca; `vite preview` confirma `listen EPERM` en `127.0.0.1:4391`, por lo que tampoco se ejecuta la tanda de tiempos. No se ha aplicado nada en producción.

- **D3(a), 11/11/2026:** simulador reproducible A/B/C con márgenes porcentuales y comparación con/sin garantía de tipo propio supereficaz por tramo. Regla de Jose en PRD §0; uso y metodología en [SIMULACION-DRAFT.md](nuzlocke/SIMULACION-DRAFT.md). Se han añadido tipos Gen 3 al catálogo reproducible y cobertura persistente al estado. Ejecutar las comprobaciones completas al liberar la máquina: los turnos D3(a/b) solo permiten tests focalizados, sin build ni E2E.
- **D3(b), 11/11/2026:** informe con tablas por escenario, margen e hito en [SIMULACION-DRAFT.md](nuzlocke/SIMULACION-DRAFT.md); evidencia persistente en `docs/nuzlocke/draft-results-100.json`. Incluye mínimo/mediana, diversidad por familias, repeticiones, tipos, BST relativo y reducción de cuartetos al forzar cobertura. Las tablas se regeneran con `scripts/report-nuzlocke-draft.mjs`, con comprobación `--check`. Comparación histórica: la propuesta A/±10 % queda descartada por la ventana absoluta de D3(c). La decisión aprobada de D3(c) sustituye esta propuesta.
- **Verificación D3(b):** 50 tests focalizados pasan, siete ficheros, seis tests nuevos; tablas idénticas al JSON y `git diff --check` correcto. D3(b) solo acredita la tanda focalizada por la restricción de carga; las comprobaciones completas se registran en D3(c).
- **Verificación D3(a):** 44 tests focalizados pasan (17 nuevos), seis ficheros, con pool de hilos y un trabajador. Regeneración local del catálogo y `git diff --check` correctos. Pasada de 100 semillas: 48 000 ofertas válidas, cero fallos y cero repeticiones con la oferta anterior; pool mínimo tras exclusiones: 36. Las comprobaciones completas se registran en D3(c).

- Conecta las pantallas aprobadas con `LocalCampaignSession` y su estado en el hilo principal. La persistencia local de preparación, decisiones y reanudación está implementada (DEC-86); usa `account.campaign` para el guardado por cuenta de D4 (DEC-90 y [guía](nuzlocke/GUARDADO.md)). El worker ya prepara y cierra el combate con comandos propios, conserva el motor individual Gen 3 y devuelve el estado para que lo gestione el hilo principal (DEC-85). El núcleo ya aplica cuatro elecciones iniciales y dos por hito posterior, límites de equipo, bajas permanentes y cierre de la plantilla de Liga. La selección legal reúne los movimientos hasta el nivel en que se dejó cada forma y filtra las MT/MO desbloqueadas por compatibilidad con la forma actual.
- **D2, calendario y evoluciones (DEC-91/88):** extracción e informe completos; decisiones de Jose del 11/11 aplicadas al calendario reproducible y al núcleo. Consulta [CALENDARIO-MT.md](nuzlocke/CALENDARIO-MT.md) y PRD §0. Conecta la interfaz aprobada con las operaciones de Escáner, evoluciones y fijación explícita de plantilla de Liga, persistiendo la preparación antes de iniciar combate. El consumo se reconstruye del historial de todos los miembros, incluidos los caídos. No vuelvas a conceder objetos al cambiar de hito o reanudar.
- **Ventana del draft corregida (11/11/2026):** proporcional −6 %/+8 % de la media rival (`EMERALD_DRAFT_RATIO`), en lugar de −30/+40; tests hechos (`draftPolicy.test.ts`). Tramo de Erico resuelto por Jose el 12/11/2026: si la garantía es inviable, se salta (PRD §0, «Repetidos y normas inviables»).
- **D3(c), 11/11/2026:** Jose aprueba A y −30/+40 por candidato, equivalentes a `BST_WINDOW_1` del PWT entre seis (sustituida el mismo día por la ventana proporcional). El núcleo aplica la política sin límites manuales y comparte trayectorias con el simulador; reconstruye historia al reclutar sin consumir inventario anterior al reclutamiento (DEC-92). Evidencia absoluta: `docs/nuzlocke/draft-results-absolute-100.json`; 4 000 ofertas con/sin garantía, cero fallos, pool mínimo 50 tras exclusiones y cuatro candidatos de Tierra para Erico. Regla y alternativas descartadas en PRD §0; informe en [SIMULACION-DRAFT.md](nuzlocke/SIMULACION-DRAFT.md).
- **Verificación D3(c), 11/11/2026:** `validate:data`, Vitest completo con la configuración del proyecto (**2502/2502**, 145 ficheros, incluidos los tests de rendimiento), `tsc -b`, lint y build en verde. Ocho tests nuevos; dos casos previos adaptados al requisito de impedir pools/límites manuales. Tablas porcentuales y absolutas reproducidas mediante `--check`; `git diff --check` correcto. Los E2E completos, incluida la tanda de tiempos, quedan a cargo del coordinador según el encargo de Jose.
- **Verificación D2(a), 10/11/2026:** reproducción byte a byte, `validate:data`, `tsc -b`, lint y build correctos; 2439 tests de Vitest pasan con la configuración del proyecto, incluidos los nueve del extractor. El intento de E2E completo se detiene antes de ejecutar casos: el entorno rechaza `listen` en `127.0.0.1:4391` con `EPERM`; repítelo en un entorno que permita abrir el servidor local antes de acreditar la regresión en navegador.
- **Verificación D2(b), 11/11/2026:** cambios solo de documentación; tabla contrastada con los 13 hitos y 63 objetos de fuentes garantizadas, enlaces locales válidos. `validate:data`, TypeScript, lint y build pasan. Vitest con configuración del proyecto: 2438/2439; UT-44 de IA supera el límite de 50 ms (54,7 ms en la tanda completa y 51,0 ms al repetir el fichero aislado). Queda por acreditar esa comprobación de rendimiento con la máquina quieta. Los E2E de esta entrega los ejecuta Claude.
- **Verificación D2(c), 11/11/2026:** calendario reproducible, `validate:data`, TypeScript, lint y build correctos. Se añaden 15 tests de política y núcleo; los de Poder Oculto usan el hito legal de Erico. Vitest completo con la configuración del proyecto: 2453/2454; el único fallo es UT-44 de IA, que supera 50 ms (53,8 ms). La repetición completa con `--maxWorkers=2` también termina 2453/2454; el fichero de IA aislado pasa 45/45 y las comprobaciones finales dirigidas pasan 20/20. No se cambian configuración ni umbrales de los tests. Queda pendiente acreditar UT-44 con la máquina quieta; los E2E los ejecuta el coordinador.
- Prepara un tema visual de Esmeralda para los combates de campaña. Las identidades por posición de entrada de especies repetidas están resueltas en motor, registro y modelo de equipo/replay (DEC-84); conecta la interfaz usando esas identidades.
- Los E2E completos de D2 los ejecuta el coordinador, según el encargo de Jose. No se han ejecutado en esta etapa.
- Muestra a Jose las maquetas de escritorio y móvil antes de implementar las pantallas de campaña y el tema de combate.


## Pantallas de la campaña (D7)

- **Antes de llevar la Nuzlocke a `main` (Jose, 12/11/2026):** Jose la prueba en local, sobre todo que no rompa nada del reto diario. Hasta entonces no se fusiona, aunque la batería esté en verde. Lo que toca el diario en esta rama: «Modos de juego» en lugar de «Ayuda» en la cabecera (la Ayuda, desde Ajustes), opciones nuevas de `useBattle` que solo usa la campaña (`hpPause`, `switchStage`, `switchDurations`) y el índice de audio con los efectos y gritos de Esmeralda (el diario no los descarga, E2E-69).
- **Verificación completa, 12/11/2026 (`feature/nuzlocke-ui`):** `validate:data`, `tsc -b`, lint, build, Vitest 3361/3361, E2E 221/222 y tanda de tiempos 25/25. El que falló, T4 de la campaña en WebKit, se quedó en «Elige un POKéMON» con un Pokémon elegible hasta el tiempo límite; repetido dos veces aislado, pasa (y pasó en la batería anterior). Vigilarlo: si vuelve a salir, guardar la traza (`--trace on`) para ver si es el ayudante del test o un cambio forzado que no avanza.
- **Hecho (12/11/2026): guardado por cuenta en la pantalla** (D4 en D7, [GUARDADO.md](nuzlocke/GUARDADO.md)): con sesión de Google la campaña se carga y se guarda en la cuenta (`account.campaign`), con las sesiones de combate de la cuenta; sin ella, en el navegador como hasta ahora (el local no se importa). Mientras guarda o si algo falla, la pantalla queda bloqueada: en conflicto, el aviso y «Recargar campaña» (solo al pulsarlo); sin conexión, «Reintentar» con la misma operación. **Antes de llevarlo a `main`:** aplicar en producción la migración `20261111000000_pwt_campaign.sql` (con autorización de Jose) y probar a mano dos pestañas y el cierre de sesión con Supabase local.
- **Hecho:** Ruta, Modos, Draft y **Equipo y PC** (11/11/2026): PC «Mover POKéMON» con CAJA 1 y BAJAS y pantalla de equipo con el límite del rival; arrastrar, tocar origen y destino o teclado. En preparación, Continuar abre el Equipo; ACEPTAR guarda la alineación (de momento, solo en la pantalla) y vuelve a la Ruta.
- **Hecho (11/11/2026):** **Movimientos**, desde el menú del PC de Equipo y PC (MOVER / MOVIMIENTOS / CANCELAR): Recordador arriba y página de movimientos de Datos abajo; los elegidos se guardan por Pokémon en la campaña (DEC-96). Descripciones españolas redactadas en `data/nuzlocke/emerald-move-descriptions-es.json`; Jose las da por buenas de momento (12/11/2026).
- **Hecho (11/11/2026):** mensajes del combate al estilo de Esmeralda (`emeraldLog`), con los nombres de la época de movimientos, habilidades y objetos.
- **Hecho (11/11/2026):** **Combate** con el motor real (DEC-97): pantalla de Esmeralda, acciones, movimientos (nombres de la época, PP de Gen 3 con su color), cambio con SÍ/NO y cambio forzado; se reanuda tras recargar.
- **Hecho (12/11/2026) en Combate:** animaciones al ritmo del juego (DEC-97): la barra baja 1 PS por fotograma con el número a la vez, la caída al debilitarse, el envío (bola, Pokémon que crece con el color de la bola, caja de PS que entra) y la retirada. Hechos también las chispas al abrirse la bola y el vuelo de la bola del jugador (sube, gira a un tercio de velocidad cerca de lo alto y baja, como `SpriteCB_PlayerMonSendOut_2`). **Hecho (12/11/2026):** pantalla final para compartir (PRD §0), con la música de los créditos. **Hechos (12/11/2026):** fanfarria de «ha evolucionado», pitido de vida baja de Gen 3 sobre la música y gritos de la tercera generación del decompilado (`gen:emerald-cries`). **Música y efectos hechos (12/11/2026):** combate por rival, victorias, Salón de la Fama y evolución; golpes, Poké Ball, debilitado, características, menús y destellos (PRD §0, `campaignMusic.ts`).
- **Hecho (11/11/2026):** **Resultado**: medalla y Ficha de Entrenador (Puntos Batalla en DINERO, especies reclutadas en POKéDEX, tiempo desde el inicio en TIEMPO; Jose), «Has vencido» tras el Alto Mando, Salón de la Fama y derrota. Nombre: nickname o BRUNO/AURA por semilla. Las campañas empezadas antes no tienen `startedAt` y marcan 0:00.
- **Hecho (12/11/2026):** **Liga**: escena de evolución (A) al entrar (solo evoluciones sin objeto; las de piedra o intercambio, como Gloom o Poliwhirl, se quedan), los seis en Equipo y PC, ficha del rival y elección de 1 a 6 participantes (plantilla fijada hasta acabar la Liga) y los cinco combates seguidos con la plantilla.
- **Hecho (12/11/2026):** animación de evolución (fondo de paleta animada, siluetas que se alternan cada vez más rápido y destello, como `evolution_scene.c`/`evolution_graphics.c`); tocar la salta y con movimiento reducido no se anima. Destellos y tiempos de `evolution_graphics.c` hechos el mismo día: espiral mientras el Pokémon se vuelve blanco, arco, siluetas, círculo y lluvia con el fondo a blanco (unos 13 s, como el juego), con su música, sus efectos, los gritos y la fanfarria.
- **Hecho (12/11/2026):** **Mochila** desde OBJETO en el menú del PC (DAR / QUITAR si ya lleva algo): fondo y mochila del protagonista, bolsillos OBJETOS y BAYAS, lista de 8 filas que se desplaza, icono y descripción; nombres de la época y descripciones redactadas de los 39 objetos (`data/nuzlocke/emerald-item-names-es.json` y `emerald-item-descriptions-es.json`).
- **Hecho (12/11/2026):** **canje de PB** desde «Canje» en la barra de la Ruta al preparar un combate: PB, lista con precios que se desplaza, icono, descripción y confirmación; lo canjeado va a la Mochila.
- **Siguiente:** de lo anterior, para dar objetos y canje de PB (maquetas aprobadas el 11/11/2026, `maquetas.html?v=evo-a|mochila|canje`); iconos de objeto y Mochila ya extraídos (`gen:emerald-ui`). Faltan descripciones españolas de los objetos (redactarlas como las de los movimientos). Mochila: comprobar en capturas que con más objetos de los que caben la lista se desplaza como el juego, con sus flechas (Jose, 12/11/2026).
- **D6, nombres de la época:** hechos los de los movimientos de la campaña (`data/nuzlocke/emerald-move-names-es.json`, de guiasnintendo.com; aeroblast, followme y jumpkick no están en la guía y conservan el actual). Hechos también (12/11/2026) los de las 76 habilidades de Gen 3 (`emerald-ability-names-es.json`, misma guía; 12 cambian, p. ej. RASTRO por Calco) y los de los 39 objetos de la campaña; se usan en el draft y en los mensajes del combate. Regla (PRD §0): cada campaña, con nombres y datos de su generación; revisarlo al hacer otras generaciones.

## Temas de consola y recursos de Esmeralda (D5, 11/11/2026)

- **Hecho (D5 de la Nuzlocke, DEC-95):** canal de recursos de los decompilados de pret (`scripts/decomp/`, `npm run gen:emerald-ui`) con la receta de Esmeralda (interfaz de las maquetas aprobadas y sprites de las 386 especies) y temas de consola en `src/ui/console/` (`ConsoleStage`, `GameText`, `GameWindow`; Esmeralda y N2/B2). Sin pantallas de campaña ni cambios visibles en el reto diario.
- **Unida a `feature/nuzlocke-hoenn` el 11/11/2026** (sin push: a `main` no va nada de la Nuzlocke hasta que esté completa). D7 hace las pantallas encima.
## Ambiente del estadio y pancarta VS (11/11/2026, en `main`)

- **Hecho:** focos del suelo, haces del techo, sombras, destello con chispas, cámara de la intro y de los ataques, estallido al abrirse la Poké Ball (RF-136; giro por JS a 12 fps, DEC-87) y pancarta VS (RF-137): franja fina que entra sobre el estadio y choca, retratos del último fotograma del gif (`gen:trainer-vs`), logo en pixel art (`gen:vs-logo`), fogonazo que descubre la rejilla. Aprobado por Jose. También en repeticiones y directo.
- **Sin hacer:** fondo oscurecido en algunos ataques especiales (falta saber en cuáles). Si aparecieran los retratos VS de N2/B2, sustituirían a los `-vs.png`.
- **Conocido:** E2E-19 en WebKit falla con la máquina cargada por un aviso de precarga de chunk («preloaded but not used within a few seconds»); pasa igual en `main`. `npm run vis` se para antes del combate porque pulsa «Práctica», deshabilitado hasta jugar el oficial (desfase del script con `main`).

## Antes de desplegar el ajuste de estadísticas base (RF-13d)
- Fija `BST_WINDOW_2_FROM` al día siguiente del despliegue para conservar los retos publicados. Si cambia respecto al 10/11/2026, ajusta las fechas de los tests en `src/core/team.test.ts` y `src/test-utils/rules.ts`, y comprueba UT-17 y UT-103.

## Precarga de los iconos de objeto (06/11/2026)
- **Hecho:** los iconos de los objetos del reto se precargan desde Hoy y al abrir un combate (UT-158).

## Bostezo y paneles más grandes (06/11/2026)
- **Hecho:** los `-end` silenciosos del motor no se traducen (UT-156); los paneles laterales crecen hasta ×1,3 con sitio (RF-44c, DEC-81, UT-157).

## Icono del objeto en su ficha y texto centrado en los recuadros (06/11/2026, directo a `main`)
- **Hecho:** icono de la bolsa en la ficha del objeto (RF-44c, UT-153); texto centrado (o 1 px más abajo) en OFICIAL/PRÁCTICA/EN DIRECTO, «Objeto» y los tipos (PRD §0); `npm run gen:item-icons` baja los 80 de los sets a `public/sprites/items/` y `validate:data` exige que estén.

## Volumen en el visor, hueco fijo de las subidas, contadores y mensajes de objetos (06/11/2026, directo a `main`)
- **Hecho:** el visor de repeticiones y el directo llevan el botón «Sonido» del combate, con el volumen (RF-128, UT-154); en los paneles laterales el hueco de la «^» está siempre (RF-44c, UT-153); contadores sin «4/6», con el nombre del entrenador y sus Poké Balls a la izquierda (RF-45, CMP-17); `-item` con su texto según el origen (UT-155).

## Fondo de la aplicación (05/11/2026, directo a `main`)
- **Hecho:** cuadrícula de la pantalla de equipo de N2/B2 en vez del granate con franjas (PRD §0), con la barra de abajo, el velo de las ventanas y la privacidad en azul noche. Baldosa `public/ui/battle/party/bg-tile.png`, registrada en `data/ui-assets.json`.

## Rama `feature/paneles-laterales` (05/11/2026, fusionada)
- **Hecho:** paneles laterales del combate con ficha de movimientos, objetos y habilidades, subidas y bajadas con «^» y «v», la barra de botones encima de la consola con estilo nuevo (también en móvil) y la solicitud de directo rediseñada (RF-44c, DEC-81, UT-152, UT-153, E2E-77; maquetas aprobadas por Jose el 05/11/2026). Descripciones de objetos de PokeAPI (de Sol / Luna; las de X/Y están desplazadas). La franja de eficacia está hecha pero desactivada (`SHOW_EFFECTIVENESS`). Solo web, sin migración.
- **Fusionada en `main` el 05/11/2026** (Jose).

## «Jugando ahora» con actividad reciente (06/11/2026, directo a `main`)
- **Hecho:** RF-111c (cambio), DEC-82, UT-159. Migración `20261106000000_pwt_jugando_reciente.sql`, aplicada en producción el 06/11/2026 antes de publicar la web.
- **Arreglados también (06/11/2026)** tres E2E que fallaban en WebKit en `main` (`1fa1d73`):
  - E2E-32: medía mal a densidad 2 (WebKit de escritorio): se saltaba un margen fijo que recortaba las letras y contaba la sombra del texto. El texto cumple la regla del PRD §0 (medido con armonia-visual: +0,25 a +0,5 px más abajo); el test mide ahora la tinta real en px CSS y comprueba la regla, «nunca más arriba» incluido. El CSS no cambia.
  - E2E-10: al abrirse la pantalla de equipo, el foco se quedaba en el botón de debajo, ya `inert`, y en WebKit Tab no salía de ahí. Ahora el foco entra en la primera placa elegible al mostrarse la pantalla (UT-160).
  - E2E-33: medía cada texto con una llamada al navegador y con la tanda completa pasaba de los 120 s en WebKit; mide cada página en una sola llamada, con las mismas comprobaciones.
  - E2E-46 (WebKit, con la tanda): miraba si la animación de la Poké Ball seguía en marcha en un instante; con carga ya había terminado. Ahora registra que empieza (`animationstart`).
  - E2E-20 (WebKit): juega un combate entero y tarda ~90 s solo (igual en `main`), con 120 s de límite; con la tanda se pasaba. `test.slow()` en WebKit.

## Rama `feature/amigos-en-directo` (04/11/2026, fusionada)
- **Hecho:** estadísticas de un amigo al día (RF-111b, cambio; UT-147) y ver en directo su oficial (RF-111c, DEC-80, UT-148 a UT-150).
- **Hecho también:** la repetición de hoy de un amigo, para quien ya terminó su oficial de hoy (UT-151, migración `20261104020000_pwt_repeticion_hoy.sql`). Arreglos de la prueba de Jose: «Ver en directo» no salía solo (el temporizador de la lista se reiniciaba cada segundo) y a 360 px el nombre se partía letra a letra. Después (Jose, 04/11/2026), «Jugando ahora» pasa a un punto rojo delante del nombre y el botón a uno cuadrado con «▶».
- **Probado** por la sesión remota con dos cuentas en local (escritorio y 360 px, dos vueltas): todo bien. Tras la prueba: la nota de la repetición de hoy solo sale si queda una sin poder verse, y en el visor del combate de otro (amigo, directo, enlace ajeno) el contador del jugador lleva su nickname en vez de «Tú».
- **Migraciones aplicadas en producción** (04/11/2026): `20261104000000_pwt_amigo_al_dia.sql`, `20261104010000_pwt_directo.sql` y `20261104020000_pwt_repeticion_hoy.sql`, antes de publicar la web.
- **Fusionada en `main` el 04/11/2026** (`bc0c572`, Jose) y desplegada.

## Sets del PWT con sinergia (04/11/2026, directo a `main`)
- **Hecho:** 169 sets del PWT fuera del equipo del jugador desde el 05/11/2026 (DEC-79, UT-145, UT-146); después, 9 más que solo estaban por Rayo Solar (3 del PWT y 6 de Smogon; el Exeggutor del 04/11/2026), 178 en total. Solo web, sin migración. Al cambiar la regla, `npm run gen:player-sets` y mover `POOL_RULES_FROM` al día siguiente del despliegue.

## Ideas para más adelante (Jose, 04/11/2026)
- **Iris en el roster:** hoy fuera porque no está en el PWT (PRD §7.1). Haría falta un equipo de fuera del PWT (p. ej. el de la Liga de N2/B2 a Nv. 50) y cambiar el roster, que cambia el reparto de los retos aún no publicados. De momento no.

## Pantalla «Estado» (03/11/2026, directo a `main`)
- **Hecho:** pastilla siempre visible y pantalla «Estado» en combate y en el visor (RF-44b, DEC-78, UT-143, UT-144, E2E-76). Solo web, sin migración.

## Rama `feature/discord-avisos` (03/11/2026)
- **Hecho:** aviso por Discord (RF-115 a RF-119, DEC-77, UT-140 a UT-142): migración `20261103000000_pwt_aviso_discord.sql`, Edge Function `pwt-discord` y apartado en Cuenta.
- **En producción (03/11/2026):** aplicación y bot de Discord, servidor del juego y secretos (Jose); `pg_net`, migración, Vault y función `pwt-discord` desplegada (sesión remota). La tarea de las 20:30 llamó a la función: 200 con `{"sent":0,"failed":0}`; sin el secreto, 403.
- **Fusionada en `main` el 03/11/2026** (Jose), sin la prueba con una cuenta real. **Falta:** que Jose conecte su Discord (bienvenida por privado) y reciba un aviso un día antes de jugar.

## Rama `feature/sonido-y-stats-rival` (03/11/2026)
- **Hecho:** interruptores de las músicas especiales (UT-136, UT-137), música silenciable y pausada en las repeticiones (UT-138) y estadísticas del rival en Hoy (UT-139).

## Rama `feature/genero-y-arreglos` (03/11/2026)
- **Hecho:** género de cada Pokémon (RF-12c, DEC-76, UT-135), el equipo se abre aunque no se pueda cambiar (UT-133) y el tema del último Pokémon ya no vuelve a empezar (UT-134).
- **Fusionada en `main` el 03/11/2026:** `GENDERS_FROM` = `2026-11-03`: Jose lo adelantó al mismo día (cambia el reto de hoy para quien aún no lo había jugado).

## Tema del último Pokémon del rival (30/10/2026, directo a `main`)
- **Hecho:** «Victory Lies Before You!» con el último Pokémon de cualquier rival, con transición y respetando la música de vida baja (PRD §0, RF-90, UT-122). Solo web y audio, sin migración.

## Repetición que empieza sola y música de vida baja (30/10/2026, rama `feature/repeticion-autoplay`)
- **Hecho:** el visor empieza reproduciéndose, sin pulsar «Reproducir» (RF-128, UT-107). Música de vida baja en vez del pitido (PRD §0, UT-121). Solo web, sin migración.
- **Desplegado** el 30/10/2026, con el visto bueno de Jose tras escucharlo en una repetición. Aviso «Toca para activar el sonido» en el visor (el navegador no deja sonar hasta el primer toque).

## Tanda en curso: `feature/mejoras-tras-f5` (desde `main` en 9b17abb, 29/10/2026; un solo despliegue al final)
Hecho: 1) resultado visual en el Historial (RF-124b; migración `20261029020000_pwt_historial_resultado.sql`, pendiente de aplicar en producción), 2) pausa de la repetición (RF-128), música continua en el visor (RF-129b), 3) objeto real en la pantalla de datos (RF-71, UT-114), 4) nombres cortados en los rankings y en la cabecera, 5) ventanas que cambian de tamaño al cargar (DEC-72), 6) puntito rojo en Estadísticas (RF-111) y cifra centrada en la bolita de «Amigos», 7) la página de detrás ya no se desplaza con una ventana abierta (UT-116, E2E-74), 8) equipos en el visor (RF-129c, UT-117). Antes de desplegar: migraciones en producción primero y tanda e2e completa («directo» no exime de los tests).

## Próxima mejora de la IA del rival (29/10/2026, sin empezar; PRD §0 «IA que aprende tu equipo»)
- **Nuzlocke de Hoenn (Jose, 11/11/2026):** el Alto Mando y el campeón deben usar una IA más inteligente que la de los gimnasios (hoy todos los encuentros de campaña usan `ai: 'heuristic'`, `src/core/nuzlocke/battle.ts`). Va con esta mejora: la versión más fuerte que se elija (opción 2 o 3 de abajo), solo para `kind` `elite` y `champion`; los gimnasios se quedan con la heurística. Por decidir con Jose cuál, al abordar la IA.
- **Selector de dificultad de la Nuzlocke (Jose, 11/11/2026, «quizás»):** elegir la dificultad antes de empezar la campaña con **dos selectores separados** (Jose, 11/11/2026: uno para cada cosa): **dificultad de la IA** (qué IA usan gimnasios, Alto Mando y campeón) y **dificultad de los Pokémon que salen** (p. ej., la ventana del draft respecto al rival). Sin decidir qué cambia en cada nivel ni cómo se guarda en la partida.
Hoy (DEC-12) la IA conoce tu equipo entero desde el principio (`ai/state.ts`) y es una heurística por reglas. Opciones habladas con Jose:

**Decidido por Jose**
- **No conoce tus sets de entrada:** los aprende sobre la marcha, con lo que se ve en el combate (como un jugador).
- **Cambia cuando queda bloqueada** (no solo por desventaja de tipos o daño): Otra Vez o Mofa que la dejan sin nada útil, Anulación, objeto Elección atado a un ataque que no te hace nada, Canto Mortal a punto de acabar, Tóxico avanzado o Drenadoras con poca vida.
- **Puede predecir, pero nunca decidir después de tu elección.** Hoy ya no la lee (`makeRivalChoice` llama a la IA tras registrar tu elección, pero `AiState` no la incluye). Propuesta: que el motor decida por el rival **antes** de pasar tu elección al sim, con un test que compruebe que con dos elecciones tuyas distintas el rival hace lo mismo.

**Qué sabe de cada Pokémon tuyo (modelo de información)**
- Especie: solo si ha salido al campo (no ve el banquillo). PS en %, estado y subidas: lo que se ve en su caja.
- Movimientos: los que has usado. Objeto: cuando se ve (Restos, baya comida, Vidasfera) o se deduce (repetir siempre el mismo ataque → Elección). Habilidad: cuando sale en un mensaje (Intimidación, Levitación…).
- Lo no visto, dos opciones:
  1. **Por los sets del pool del jugador** (`player-sets.json`), descartando los que no encajan con lo visto, como quien conoce el metajuego. *Recomendada.*
  2. **Lo básico** (ataques de su tipo, sin objeto especial) hasta verlo. Más ingenua.

**Opciones para hacerla más fuerte** (saber menos la hace algo más floja; combinables con lo anterior, siempre sobre lo que ha visto)
1. **Afinar la heurística:** quién ataca primero (velocidad y prioridad), prever tu cambio y atacar al que entra, cambiar a quien aguanta tu golpe previsto, no mejorar si la van a debilitar antes, guardar al Pokémon clave y sacrificar a otro. Barata, sin coste de cálculo.
2. **Mirar un turno por delante:** cada opción del rival contra todas tus respuestas posibles (no la elegida), con `@smogon/calc`; la que mejor resultado da contra tu mejor respuesta. Unas 80 combinaciones por turno, rápido en el worker.
3. **Búsqueda más profunda** (varios turnos o simulaciones aleatorias clonando el combate de `@pkmn/sim`). La más fuerte; en móvil puede tardar segundos por turno.

**Por decidir**
- Opción de información (1 o 2) y de fuerza (1, 2 o 3).
- Si la IA nueva es para todos o una dificultad elegible; si es elegible, cómo cuenta en rachas, puntos y la media del día (si no se separa, los rankings no son comparables).
- Calibrar con partidas de prueba (pendiente ya, «Necesitan a Jose») para que ningún día quede casi imposible.
- Simetría: tú sí puedes ver los sets del rival (ocultos por defecto, PRD P6); ¿se mantiene?
- Desde qué día se aplica: cambia lo que hace el rival en los retos (no el reto en sí); las repeticiones y reanudar siguen valiendo si la IA sigue siendo determinista con su semilla (`Prng(battleSeed+":ai")`), pero un oficial a medias al desplegar se reanudaría con otra IA.

## Gritos de los Pokémon (31/10/2026, DEC-75)
- **Hecho:** el código, el script y los gritos descargados (31/10/2026, en local con `gen:cries`): las 331 especies del juego, unos 5 MB. Al añadir especies, volver a lanzar `npm run gen:cries` en local.

## Combate de hoy en el historial de un amigo (31/10/2026)
- **Hecho:** RF-111b, UT-130.
- **Migración `20261031010000_pwt_amigo_hoy.sql` aplicada en producción** (31/10/2026, tras publicar la web).

## Aviso de nombre y cuenta (31/10/2026, directo a `main`)
- **Hecho:** RF-94b, UT-128, UT-129.
- **Migración `20261031000000_pwt_nombre_elegido.sql` aplicada en producción** (31/10/2026).

## Rankings con 0 (29/10/2026, directo a `main`)
- **Hecho:** salen con 0 quienes han terminado algún oficial (RF-107b, UT-126). Solo servidor: la web no cambia.
- **Migración `20261029060000_pwt_rankings_con_cero.sql` aplicada en producción** (31/10/2026).

## Investigar: E2E-19 y E2E-01 fallan a veces en webkit por avisos de precarga (29/10/2026)
- **Qué:** en la tanda completa, webkit avisa por consola de que algún fichero precargado (`hpBar-*.js`, `MemberIcon-*.js`, `icon-index-*.js`) «no se usó en los primeros segundos» y los tests que exigen consola limpia (E2E-19, E2E-01) fallan. Solos pasan siempre (3 de 3). Pasó tres veces el 29/10/2026, una en `main` antes de los cambios del día.
- **Pista:** con la máquina cargada la página tarda más en usar lo precargado. Mirar qué precarga Vite para esos ficheros (`modulePreload`) y si conviene no precargarlos o que esos tests ignoren solo ese aviso de webkit. No es un fallo de la web: no cambia lo que ve el jugador.

## Traspaso con los enlaces compartidos (29/10/2026, directo a `main`)
- **Hecho:** al pasar la sesión anónima a la cuenta, también sus enlaces compartidos (RF-97, UT-104). La repetición y el combate en curso ya pasaban (`on update cascade`). «Victorias: X/Y» (RF-114) desplegado en `f769445`.
- **Antes de desplegar:** aplicar en producción `20261029050000_pwt_traspaso_completo.sql`. No cambia la web: basta con la migración, pero va con su tanda e2e como siempre.

## Tanda `feature/amigos-y-privacidad` (29/10/2026)
- **Hecho:** vista de un amigo con sus estadísticas e historial (RF-111b, DEC-73); política de privacidad en `public/privacidad.html`, enlazada desde Ayuda (E2E-75).
- **Antes de desplegar:** aplicar en producción `20261029030000_pwt_amigo.sql` **antes** de publicar la web (sin ella, la vista del amigo da error). Tanda e2e completa.
- **Tras desplegar (Jose):** poner la URL de la política en Google Cloud («Pantalla de consentimiento → Marca», README).

## Más adelante (sin prisa): ids de repeticiones compartidas con aleatoriedad criptográfica (Jose, 29/10/2026)
- **Qué:** `pwt.new_replay_id` (`20261029000000_pwt_repeticiones.sql`) arma los 10 caracteres con `random()`, que no es criptográfico. Cambiarlo a `gen_random_bytes` (pgcrypto) en una migración nueva, con el mismo alfabeto y longitud (los enlaces ya compartidos siguen valiendo).
- **Por qué:** refuerzo, no un agujero: hay unos 3,6 billones de ids posibles y adivinar uno a ciegas no es viable, y una repetición compartida es pública por diseño. Jose: no es prioritario.

## Primera tanda en `feature/mejoras-tras-f5` (ya desplegada el 29/10/2026)
- **Hecho:** bolita naranja con las solicitudes pendientes en «Amigos» (RF-111); login con el botón oficial de Google (DEC-70, comprobado en local); oficial a medias a medianoche = derrota (RF-80b, DEC-71).
- **Antes de desplegar:** aplicar en producción la migración `20261029010000_pwt_oficial_caducado.sql` **antes** del despliegue (el cliente nuevo cuenta con que el servidor cierre los oficiales a medias). Tanda e2e completa.
- **Tras desplegar:** quitar del cliente OAuth de Google la URI de redirección de Supabase y el dominio `supabase.co` (ver «Marca en la pantalla de Google»).

## Antes de desplegar `feature/cuentas`
- **`TEAM_RULES_2_FROM`** (`src/core/launch.ts`, RF-12b y RF-13d, DEC-64 y DEC-66) vale `2026-10-29`: ponerlo al día siguiente del despliegue, o los días ya publicados entre esa fecha y el despliegue cambiarían de equipo si tenían formas repetidas. Volver a lanzar UT-17 (snapshot), UT-102 y UT-103; el snapshot solo debe cambiar en las fechas desde ese día.

## Para F2 (resto)
- **`LAUNCH_DATE` fijada: 2026-10-24** (Jose, 23/10/2026), con Misty de #1 (`LAUNCH_OPENING`, PRD §0 «Lanzamiento»). El 27/10/2026, reparto de campeones, regiones y hermanos (DEC-62) con #1 a #4 fijos; cambia lo que sale desde el #5. Snapshot y fechas de referencia regenerados. Cambiarla de nuevo, o cambiar el roster o las reglas de generación, cambia lo ya publicado (rival, variante, equipo, `#N`): README, «Lanzamiento».
- **Calibrar la dificultad** (PRD §14, criterio 19) con el roster completo. Resultado preliminar (INT-14, solo los 5 de F1) con el jugador de prueba "mejor daño" y los IV del jugador iguales a los del rival (RF-16): Brock 100 %, Misty 70 %, Camila 70 %, Plubio 50 %, Rojo 0 %. Brock y Rojo siguen fuera del rango 40-80 %.
- **Stunfisk de Camila (Mundial):** Juego Sucio según Bulbapedia y Serebii, Impresionar según WikiDex; se usa Juego Sucio (resolución manual en `data/pwt-raw/resolutions.json`).
- **Ruta crítica 230 KB gzip (decidido: se deja así).** Con el roster de 53 el chunk principal pasa a 208 KB (era 182) y la carga sigue < 3 s en 4G (2,1-2,5 s). Optimización futura, solo si hace falta: carga por entrenador (JSON por entrenador, `GameData` asíncrono) o recortar dex/names.
- **Iconos `-mini.png`:** completos (28/10/2026). A los 11 que faltaban, WikiDex los guarda como `<Nombre>_mini.png` o `<Nombre>_mini_NB.png` en vez de `<Nombre>_N2B2_mini.png`; `gen:sprites` prueba los tres nombres (`miniFileCandidates`). Se usan en el Historial (F5).
- **E2E en CI:** hecho, humo en Chromium (`e2e-smoke`, DEC-50). La batería completa sigue siendo local.

## Orden de trabajo
1. **F3** (sección «Para F3»): estadísticas y rachas (el almacenamiento `daily-pwt:v1` ya guarda el historial por día), compartir, Ayuda (créditos y aviso legal) y Ajustes; después música y efectos de sonido.
2. **Resto de F2** que no depende de Jose: minis de entrenador (en local, ver arriba). E2E en CI y capturas con `?trainer=`, hechos.
3. **Necesitan a Jose**: calibrar la dificultad (partidas de prueba), verificar en Windows y Safari iOS reales.
4. **Fases futuras**: F4 cuentas y rankings (descrita, sin empezar), modo PWT, logros; las animaciones de movimientos, lo último.

## Para F3
- **Hecho** (DEC-47): estadísticas y rachas, compartir.
- **Hecho** (DEC-48 y DEC-49): Ayuda, Ajustes (velocidad guardada, borrar datos locales), marco de consola en escritorio, clima en la pantalla táctil con turnos restantes y nombres de la caja de PS alineados al nivel.
- **En curso** (`feature/f3-sonido`, 23/10/2026): música y efectos de sonido. Decidido: sonido activado por defecto (nada suena hasta la primera interacción), música solo en combate (en Resultado, el jingle de victoria si se gana), silencio y volumen en Ajustes; temas y fuentes en PRD §0, «Fuentes y temas del sonido». Audios en el repo; los pasos que faltan, en «Sonido: plan de implementación».
- **Contrastar con el juego real:** posición y aspecto del indicador de clima (DEC-48).

## Fases futuras (tras F3; PRD §0)
- **Modo PWT:** 7 entrenadores aleatorios seguidos con el mismo equipo. Libre y repetible sin límite (no es diario). Por definir: curación entre combates, si cuenta para estadísticas.
- **F4 · Cuentas y rankings** (PRD §0, 27/10/2026; rama `feature/cuentas`): descripción en [REQUISITOS-F4.md](REQUISITOS-F4.md) y diseño en DEC-63. Desarrollo empezado el 27/10/2026 (decisiones en §3). Supabase: el proyecto de claude-test, esquema `pwt` (DEC-63); Jose prepara lo de REQUISITOS-F4 §4.
  - **Hecho:** migración `supabase/migrations/20261027000000_pwt_cuentas.sql` con sus tests en PGlite (UT-90 a UT-96); cliente `src/cloud/` (sesión anónima o Google, caché por cuenta, cola de envíos), cuenta en Ajustes y en la cabecera de Hoy, pestañas Rankings y Amigos dentro de Estadísticas, puntos del mes y de hoy; jugadores sin cuenta con nickname, puntos y rankings, tick de verificado y liberación de nombres a los 30 días (RF-112, RF-113) (UT-97 a UT-101); secretos en `deploy.yml`; README «Cuentas y rankings».
  - **28/10/2026:** el reto cambia a la medianoche de Madrid para todos (DEC-65); los puntos solo se muestran cuando el día está cerrado (RF-105; migración `20261028000000_pwt_puntos_definitivos.sql`, ya aplicada); cuenta en su propio icono de la cabecera (RF-93).
  - **Marca en la pantalla de Google (en `feature/mejoras-tras-f5`):** el proyecto de Google Cloud `pokemon-teambuilder` pasa a ser el de Daily PWT (decisión de Jose, 28/10/2026; el Team Builder tendrá otro). Hecho en código: login con el botón oficial de Google y `signInWithIdToken` (DEC-70), sin redirección a Supabase. Falta: añadir los orígenes de JavaScript autorizados (README), comprobar el login en local, quitar la URI de redirección y el dominio de Supabase del cliente tras desplegar, la página de política de privacidad ya está (`public/privacidad.html`; falta ponerla en Google Cloud), verificar `quimikuaxh.github.io` en Search Console y pedir la verificación de la marca. El nombre que sale en la pantalla de Google y en el correo de permisos es el de «Pantalla de consentimiento → Marca» (hoy «teambuilder»): cambiarlo a «Daily PWT» también lo cambia para el Team Builder mientras comparta el cliente, así que antes conviene darle al Team Builder su propio proyecto.
  - **Ayuda** explica cuenta, puntos, multiplicador, rankings y amigos (sección «Cuenta, puntos y rankings»). Datos de prueba de Supabase borrados antes del lanzamiento (28/10/2026); solo queda la cuenta de Jose.
  - **Supabase configurado (28/10/2026)** en el proyecto `xvkvzrdvtcnjnbhtydfn`: Google, sesiones anónimas, enlace de identidades, URL de redirección, `pg_cron` con `pwt-close-days` y `pwt-release-nicknames`, migración aplicada y `pwt` publicado. `.env.local` (ignorado) apunta a él.
  - **Falta:** los secretos `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` en GitHub (Jose); después, probar el flujo real (login, enlace de la sesión anónima, dos dispositivos, cierre del día con `pg_cron`) y añadir un e2e contra el proyecto real o simulado si hace falta.
  - **Ruta crítica:** el JS principal queda en 224,4 KB gzip, como antes de F4 (medido por Vite; E2E-21 mide HTML + CSS + JS y su límite es 230). Para que quepa, van en ficheros aparte la cuenta (`Account`, `supabase-js`), las ventanas de la cabecera (Estadísticas, Ayuda, Ajustes, que se traen en reposo), los textos de Ayuda (`esHelp.ts`) y de cuenta, rankings y amigos (`esCloud.ts`) y su CSS (`ui/stats/cloud.css`).
- **F5 · Historial y repeticiones** (28/10/2026; rama `feature/historial-repeticiones`): descripción en [REQUISITOS-F5.md](REQUISITOS-F5.md). Desarrollado (DEC-67, DEC-68; UT-105 a UT-108). Al desplegar, aplicar en Supabase de producción `supabase/migrations/20261029000000_pwt_repeticiones.sql` **antes** de publicar la web (sin ella, el historial da error y las repeticiones se quedan en la cola del navegador). Para probar en local: Supabase local (README, «Supabase en local»). Las repeticiones se guardan a partir del despliegue: los oficiales anteriores no tienen.
- **Logros con login opcional:** requiere backend (cuentas y almacenamiento); el daily sigue sin cuenta. Con sesión, racha diaria y logros en la cuenta; sin sesión, racha en local. Por definir: servicio, qué logros, migración de las estadísticas locales.
- **Logros de la Nuzlocke** (Jose, 11/11/2026): incluir logros propios de los lockes en el sistema de logros (p. ej., campeón sin bajas, Liga con un solo Pokémon, completar con cada tipo). Sin diseñar: se concretan con Jose al abordar los logros.
- **Pokédex de los lockes** (Jose, 11/11/2026): registro, por cuenta, de los Pokémon que el jugador ha utilizado en sus campañas Nuzlocke (los reclutados y llevados a combate), con su número y forma, para ir completándola entre partidas y regiones. Sin diseñar: falta decidir qué cuenta como «utilizado» (reclutado, usado en combate o llegado a la Liga), si guarda datos por especie (veces, mejor resultado) y dónde se ve (menú de Modos o pantalla propia).

## Sonido: plan de implementación (F3, PRD §0)
Recursos ya en el repo (DEC-56): `public/audio/music/*.m4a` (11 pistas completas), `public/audio/sfx/*.m4a` (18 efectos) y `src/generated/audio-index.json` (ruta y duración). Fuente y manifiesto: `data/audio.json`; cómo se regeneran: README, «Sonido». No hace falta red para implementar: todo lo necesario está versionado.

Decisiones que aplican (PRD §0, «Sonido» y «Fuentes y temas del sonido»): activado por defecto; nada suena hasta la primera interacción; música solo en combate y, en Resultado, el jingle de victoria si se gana; silencio y volumen en Ajustes, compartidos por música y efectos.

| Rival | Pista |
|---|---|
| Líderes | `gym-<región>` (Teselia: `gym-unova`, «Battle! (Gym Leader)») |
| Campeones | `champion-<región>`: Rojo y Azul `champion-kanto`, Lance `champion-johto`, Máximo y Plubio `champion-hoenn`, Cintia `champion-sinnoh`, Mirto `champion-unova` (tema de Iris) |
| Victoria (Resultado) | `victory-pwt` («Winning in the PWT!») |

La regla `category` + `region` de `data/trainers.json` cubre a los 53; `scripts/build-audio.test.ts` lo comprueba.

Pasos, en este orden (cada uno depende del anterior):
1. **Hecho (DEC-57):** puntos de bucle en `data/audio.json` con `scripts/find-loops.py` y fundido de 40 ms en la costura. Plan original: **Puntos de bucle** de las 10 pistas de combate: `loopStartSec`/`loopEndSec` en `data/audio.json`, que `gen:audio` copia a `audio-index.json` (o un script aparte que los detecte sobre los `.m4a`, ya que el FLAC no se puede bajar desde la nube). Cada pista trae introducción + bucle ×2 + fundido. Primera prueba (23/10/2026), correlación normalizada en una sola ventana de 4 s situada 6 s antes del fundido: solo clara en `champion-kanto` (L = 60,014 s, ncc 0,997), `champion-sinnoh` (75,017 s, 0,999), `champion-unova` (92,52 s, 0,957) y `gym-unova` (75,017 s, 0,935); en las demás la ventana caía mal. Siguiente intento: barrer la posición de la ventana por toda la pista y quedarse con el desfase que más se repite, comprobando el residuo de la costura (< −30 dB). Si no sale, ajustarlos a oído con Jose. `victory-pwt` no hace bucle: suena una vez.
2. **Hecho (DEC-57, `src/audio/`).** Plan original: **Motor de audio** (`src/audio/`): un `AudioContext` creado o reanudado en el primer `pointerdown`/`keydown` (política de autoplay y decisión de Jose), un `GainNode` maestro con el volumen de Ajustes, carga perezosa con `fetch` + `decodeAudioData` y caché por id, `playMusic(id)` con `AudioBufferSourceNode` (`loop`, `loopStart`, `loopEnd`), `stopMusic(fadeMs)` y `playSfx(id)`. Rutas con `import.meta.env.BASE_URL` (el sitio vive en `/daily-pwt/`). Sin `AudioContext` (tests, navegador sin Web Audio) no hace nada ni lanza. Precargar solo la pista del rival al entrar al combate y los 6 efectos; nunca toda la música.
3. **Hecho (DEC-57):** Activado/Silenciado y deslizador de volumen (0-100 de 5 en 5, 70 por defecto). Plan original: **Ajustes** (`src/storage/settings.ts`, `SettingsDialog.tsx`, `es.settings`): `sound` (activado/silenciado) y `volume` (0-100). Los ajustes guardados sin esos campos se leen con los valores por defecto, como `moveAnimations`. Volumen por defecto: 70, con un deslizador (decisión de Jose, 23/10/2026). Cambiar el volumen afecta al instante a lo que suena.
4. **Hecho (DEC-57, `BattleScreen`).** Plan original: **Música en combate** (`BattleScreen` o `App`): empieza con la intro (fase `iris`) y también al reanudar un oficial (sin intro); para con un fundido corto al salir, al terminar (`onFinish`) y al desmontar. La velocidad x2/x4 no cambia la música.
5. **Hecho (DEC-57).** Plan original: **Jingle en Resultado** (`ResultScreen`): `victory-pwt` una vez si se gana; nada si se pierde o se rinde. Se corta al salir de Resultado (Hoy o revancha).
6. **Hecho (DEC-57, `src/hooks/battleSfx.ts`).** Plan original: **Efectos** (`useBattle`, nunca durante la reproducción de un combate guardado):
   - Golpe: en el `-damage` sin `[from]` que baja la barra del objetivo. El sonido depende de si en esa acción llega `-supereffective` o `-resisted` para ese objetivo (`deferHitMessages` los coloca después del daño, así que hay que mirar adelante en los pasos de la acción, hasta la siguiente línea de `ACTION_END` de `moveFxCues.ts`). Sin ninguno de los dos, `hit-neutral`. En golpes múltiples, uno por golpe.
   - Poké Ball: `ball-throw` al lanzarla y `ball-open` al abrirse, con los tiempos del CSS divididos por la velocidad. Intro: rival lanza a 100 ms y se abre a 520 ms de la fase `rivalSend`; jugador, 650 y 1070 ms de `playerSend`. Cambios (`switchAnim`): lanza a 800 ms y se abre a 1120 ms, menos 500 ms si no hay retirada (`-send`, `--switch-skip`). Si se salta la intro, no suenan los de la intro.
   - Debilitado: `faint` (`SEQ_SE_DEAD`) cuando cae el sprite. Vida baja: `low-hp` en bucle con el Pokémon del jugador en rojo (DEC-57).
7. **Hecho.** Plan original: **Créditos en Ayuda** (`es.help.credits`): música (Super Music Collection de N2/B2, Internet Archive) y efectos (The Sounds Resource). En el README ya están.
8. **Hecho (UT-75..UT-78, E2E-68, E2E-69, RF-87..RF-92, DEC-57).** El Chromium de Playwright no decodifica AAC: los E2E comprueban descargas y errores, no que suene. Plan original: **Tests y documentación**: unitarios del motor de audio con un `AudioContext` falso (desbloqueo, volumen, silencio, bucle, caché), de los ajustes nuevos y de los disparadores de efectos en `useBattle` (qué sonido por línea; ninguno al reproducir); E2E: Ajustes guarda silencio y volumen, y la página no da errores sin interacción. Requisitos numerados, casos en `PLAN-PRUEBAS-F1.md`, DEC nueva para el motor y Ayuda/README si cambia el uso.
9. **Hecho (23/10/2026): efectos de menú, estados, baya y características.** Elegidos por Jose a oído en el ZIP: `menu-select` `SEQ_SE_DECIDE1`, `menu-cancel` `SEQ_SE_CANCEL1`; de `SEQ_SE_BE_SE_*`, 01 dormido, 02 envenenado, 03 quemado, 04 congelado, 05 paralizado, 06 confuso, 10 comerse una baya (`berry`), 12 subir característica (`stat-up`) y 13 bajarla (`stat-down`). Baya y características suenan con su animación de DEC-55 (cambio de requisito de Jose). Falta revisarlos en partidas reales.

10. **Revisar con Jose a oído**: costuras de los bucles, efecto elegido para abrir la Poké Ball (`SEQ_SE_BOWA2`; alternativas en el ZIP: `BOWA1`, `BOWA3`) y volumen relativo de música y efectos.

## Animaciones de movimientos (PRD §0, DEC-53)
- **Hecho**: genéricas por tipo y clase y 20 propias, por código en píxel, con interruptor en Ajustes. Mejora (22/10/2026): físicos según cómo golpean (mordisco, puñetazo, patada, corte, golpe) y especiales con un efecto distinto por tipo (chorro de llamas, zigzag eléctrico, hojas, cristales…).
- **Segunda tanda hecha:** 20 propias más (Enfado, Triturar, A Bocajarro, Tierra Viva, Ventisca, Respiro, Escaldar, Paz Mental, Gigadrenado, Retribución, Tijera X, Corpulencia, Rayo Señal, Fuego Fatuo, Megacuerno, Voltio Cruel, Acróbata, Onda Trueno, Tajo Aéreo y Cascada); 40 en total. Revisar con Jose el aspecto en partidas reales; más tandas, por orden de uso, si él quiere.
- **Tercera tanda hecha (rama `feature/animaciones-3`, 23/10/2026, acordada con Jose):** las 20 siguientes por uso: Mofa, Surf, Psicocarga, Divide Dolor, Hierba Lazo, Voltiocambio, Lanzallamas, Danza Lluvia, Pájaro Osado, Somnífero, Descanso, Hipnosis, Púas, Espacio Raro, Puño Drenaje, Tajo Umbrío, Recuperación, Giro Bola, Trueno y Cabezazo Zen; 60 en total. Revisar con Jose en partidas reales.
- **Cuarta tanda hecha (30/10/2026, Jose; directo a `main`):** los climas con animación propia (Día Soleado con rayos de sol, Tormenta Arena y Granizo; Danza Lluvia ya la tenía), también cuando los pone una habilidad y en cada turno que siguen, y los 20 siguientes por uso sin animación propia: Danza Dragón, Puño Fuego, Acua Cola, Bostezo, Pantalla Luz, Reflejo, Zumbido, Maquinación, Rompecoraza, Patada Baja, Demolición, Acua Jet, Otra Vez, Puño Trueno, Onda Ígnea, Truco, Machada, Persecución, Pulso Umbrío y Viento Afín; 84 en total. Revisar con Jose en partidas reales.
- **Quinta tanda hecha (30/10/2026, Jose; directo a `main`):** los 20 siguientes por uso: Pedrada, Cabeza de Hierro, Sorpresa, Bomba Lodo, Drenadoras, Sofoco, Cometa Draco, Lluevehojas, Pulso Dragón, Doble Filo, Explosión, Relevo, Canto Helado, Foco Resplandor, Hoja Aguda, Sonámbulo, Puya Nociva, Ataque Rápido, Velocidad Extrema y Terratemblor; 104 en total. Revisar con Jose en partidas reales.
- **Sexta a octava tanda hechas (30/10/2026, Jose; directo a `main`):** 60 más, los siguientes por uso. Sexta: Vendaval, Giro Rápido, Chispazo, Síntesis, Rayo Solar, Latigazo, Envite Ígneo, Deseo, Bomba Germen, Puño Bala, Garra Dragón, Testarazo, Cascabel Cura, Pulimento, Puño Certero, Golpe Aéreo, Doble Equipo, Energibola, Viento Hielo y Mazazo. Séptima: Colmillo Hielo, Joya de Luz, Danza Aleteo, Cola Dragón, Imagen, Ultrapuño, Rizo Algodón, Come Sueños, Colmillo Ígneo, Agilidad, Superdiente, Espora, Remolino, Rayo Confuso, Rayo Carga, Taladradora, Garra Umbría, Masa Cósmica, Patada Salto Alta y Psicocorte. Octava: Meteorobola, Poder Pasado, Alud, Nitrocarga, Chuzos, Relajo, Danza Pétalo, Rugido, Sombra Vil, Deslumbrar, Canto Mortal, Reserva, Defensa Férrea, Luz Lunar, Juego Sucio, Recurrente, Afilagarras, Frío Polar, Tajo Cruzado y Enrosque; 164 en total. Revisar con Jose en partidas reales.
- **Estados, características, bayas y golpes (23/10/2026, DEC-55):** hecho. Revisar con Jose en partidas reales.

## Sustituto (27/10/2026, DEC-61)
- **Muñeco del sustituto** (27/10/2026): en el repo (lo bajó Jose) y recortado a su contenido para que pise la plataforma como los Pokémon (DEC-61, UT-89). Revisado con captura: rival y jugador en su sitio.

## Pantalla de equipo y de datos
- **Poder Oculto y los IV del jugador:** como los IV del jugador son iguales en las seis características, su Poder Oculto es siempre Lucha 30, Siniestro 30 o Lucha 70 (DEC-54), aunque el set de Smogon pensara en otro tipo. Si se quiere respetar el tipo previsto habría que darle IV distintos (decisión de producto, ver PRD §0 «IVs, EVs y naturaleza del jugador»).
- **Mochila = equipo rival:** hecho (DEC-52).
- **Fondo de la pantalla de datos de N2/B2:** el actual es el de Negro/Blanco (limpiado por script de capturas de Bulbagarden Archives). Si aparece un rip limpio de N2/B2, sustituir las URLs de `battle/summary/*` en `data/ui-assets.json` y quitar sus `cleanups`.
- **Descripciones en español:** son de Pokémon X/Y (primera edición con español en PokeAPI), no de N2/B2.
- **Rival:** sin animación de lanzamiento ripeada (los sprites de entrenador son estáticos); la bola sale de una mano estimada a partir del tamaño de su sprite.
- **Cambiar con el activo atrapado o sin banquillo:** el botón sigue desactivado (RF-47), así que en esos casos no se puede abrir el equipo para ver Datos.

## Pendientes menores conocidos
- **Verificar en un Windows real** el arreglo de métricas de la fuente (`@font-face` con `ascent/descent/line-gap-override`, ARQUITECTURA DEC-27): comparar la pantalla de datos con la captura de Linux (texto alineado con el fondo, barra de PS en su hueco). En Linux se reprodujo y corrigió con Chromium y Firefox.
- **Parpadeo de PS del jugador:** la causa más probable (dígitos sin precargar, DEC-28) está corregida, pero no se reprodujo con el motor ni con el DOM. Si reaparece, anotar fecha, semilla y el texto del Registro del turno.
- **Primera línea del registro:** es la frase de desafío de la intro (`¡[Categoría] [Nombre] te desafía!`); los e2e dependen de ello.
- **`translate="no"`** está en los nombres propios de Hoy; revisar que no falte en nombres de entrenadores y Pokémon de otras pantallas.
- **Enlace "saltar al contenido"** solo existe en Hoy.
- **`forced-colors` (alto contraste):** el combate se captura (VIS-14) pero los gráficos ripeados no se adaptan.
- **E2E-05 «plubio semilla c» en la batería completa (23/10/2026):** falla por tiempo (4 min) en tres tandas seguidas (webkit y chromium), y pasa sola en 24-30 s. No es solo carga: investigar con la traza (`test-results/`) si se queda esperando en algún paso cuando corre en paralelo.
- **Navegadores:** Firefox sin probar (se activa con `E2E_FIREFOX=1`); Safari iOS real y móviles modestos, prueba manual.

## Sustituir la fuente (Pokémon Black and White 2 de FontStruct)
1. Deja el TTF en `public/fonts/` con un nombre `[a-z0-9-]+.ttf`, p. ej. `pokemon-bw2.ttf`.
2. En `data/ui-assets.json`, sección `fonts`: cambia `path` y `url` (o quita la `url` y el origen si el fichero ya está en el repo; `scripts/fetch-ui-assets.mjs` valida el nombre y la cabecera TrueType) y actualiza el crédito y la licencia del origen. Borra el TTF antiguo.
3. En `src/index.css`: cambia solo el `src: url("/fonts/...")` de la única `@font-face` (familia "Game"). La variable `--font-game` y todo lo demás no se tocan.
4. Comprueba `ñ`, `¡`, `¿` y las vocales con tilde, y que el 5 y la S se distinguen (PS, PP, niveles y nombres): `npm run vis`, o abre un combate con `?seed=a&ai=trivial` (build con `VITE_TEST_HOOKS=1`).
5. Si cambia el ancho de los glifos, repasa los textos de la caja de mensajes (2 líneas de 240 px) y los de las teselas de movimiento.
6. `npx vitest run` (hay un test que exige una sola `@font-face` y una sola variable) y `npx playwright test e2e/resilience.spec.ts` (comprueba la fuente local).
