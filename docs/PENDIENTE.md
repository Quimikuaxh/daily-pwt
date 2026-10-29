# Daily PWT · Pendiente

Solo lo que pasa a F2/F3. El alcance de cada fase está en `PRD.md` §0.

**Ramas (23/10/2026):** todo lo hecho hasta las animaciones está en `main` (las ramas apiladas se unieron con fast-forward y se borraron, decisión de Jose). El sonido va en `feature/f3-sonido` (desde `main`): los audios ya están descargados y versionados (se descargaron en local, desde la nube las fuentes están bloqueadas); falta implementarlo según «Sonido: plan de implementación».

## En `feature/mejoras-tras-f5` (un solo despliegue al final, decisión de Jose, 28/10/2026)
- **Hecho:** bolita naranja con las solicitudes pendientes en «Amigos» (RF-111); login con el botón oficial de Google (DEC-70, comprobado en local); oficial a medias a medianoche = derrota (RF-80b, DEC-71).
- **Antes de desplegar:** aplicar en producción la migración `20261029010000_pwt_oficial_caducado.sql` **antes** del despliegue (el cliente nuevo cuenta con que el servidor cierre los oficiales a medias). Tanda e2e completa.
- **Tras desplegar:** quitar del cliente OAuth de Google la URI de redirección de Supabase y el dominio `supabase.co` (ver «Marca en la pantalla de Google»).

## Corregir: objeto real en la pantalla de datos (petición de Jose, 29/10/2026)
- **Qué:** en los datos de cada Pokémon durante el combate (los propios y los del rival), el objeto que lleva **en ese momento**, no el del equipo del reto: tras Truco o Trapicheo, el que recibió; tras Desarme, consumir una baya o gastar un objeto, ninguno.
- **Por qué:** hoy `SummaryScreen` pinta `itemName` del equipo del reto (`cardModel.ts`), fijo durante todo el combate, y engaña al decidir.
- **Pista:** los propios ya traen el objeto actual en la petición del simulador (`RequestPokemon.item`); los del rival hay que seguirlos con los mensajes `-item` y `-enditem` del registro (lo que el jugador ha visto, como en el juego). Comprobar también al reanudar y en el visor de repeticiones.

## Siguiente: aviso de solicitudes en el icono de Estadísticas (Jose, 29/10/2026)
- **Qué:** un puntito rojo en el icono de Estadísticas de la cabecera cuando haya solicitudes de amistad pendientes, para verlo sin abrir la ventana (dentro ya está la bolita naranja de «Amigos», RF-111). Para lectores de pantalla, el nombre del botón lo dice.

## Corregir: nombres cortados en los rankings (Jose, 29/10/2026)
- **Qué:** en las filas de los rankings se cortan los rasgos que bajan de la línea (la «g» de «Andreugu»). Revisar la altura de línea y el `overflow` de la celda del nombre (con la fuente `pokemon-dp`, ver «Fuente» en `CLAUDE.md`), también en Amigos y en el nickname de la cabecera.

## Corregir: la pausa de la repetición no funciona (Jose, 29/10/2026)
- **Qué:** con «Reproducir» en marcha, pulsar «Pausa» debe parar la repetición; hoy sigue avanzando.
- **Pista:** `ReplayViewer.tsx` solo mira `playing` al llegar a un punto de descanso (efecto que programa el siguiente turno); el turno en curso (`busy`, `playNext`) sigue y quizá el temporizador ya programado no se cancela al pausar. Reproducir el fallo en un test (UT-107) antes de arreglarlo.

## Siguiente: ver los equipos en la repetición (Jose, 29/10/2026)
- **Qué:** en el visor de repeticiones, un botón para consultar el equipo propio y el del rival (la pantalla de datos del combate, con lo que había en ese momento de la repetición). Hoy el visor no ofrece menús y no hay forma de verlos.
- **Solo en el visor** (decisión de Jose, 29/10/2026); en el combate no.
- **Por definir:** un botón por equipo o uno con pestañas; si el rival se enseña entero (la repetición ya terminó) o solo lo visto hasta ese turno.

## Siguiente: resultado visual en el Historial (petición de Jose, 28/10/2026)
- **Qué (propuesta, por confirmar el diseño):** en cada combate del Historial, en vez de la palabra «Victoria» / «Derrota», un distintivo de color (copa dorada y borde dorado si se ganó; Poké Ball gris y borde rojo si se perdió), con los turnos y los Pokémon en pie debajo; los Pokémon del equipo que acabaron debilitados, apagados (como en la pantalla de equipo). Para lectores de pantalla sigue diciendo «Victoria» o «Derrota».
- **Hace falta:** que `my_history` devuelva también `player_fainted` (nueva migración: la de F5 ya estará aplicada).

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
  - **Marca en la pantalla de Google (en `feature/mejoras-tras-f5`):** el proyecto de Google Cloud `pokemon-teambuilder` pasa a ser el de Daily PWT (decisión de Jose, 28/10/2026; el Team Builder tendrá otro). Hecho en código: login con el botón oficial de Google y `signInWithIdToken` (DEC-70), sin redirección a Supabase. Falta: añadir los orígenes de JavaScript autorizados (README), comprobar el login en local, quitar la URI de redirección y el dominio de Supabase del cliente tras desplegar, la página de política de privacidad (contacto `quimikuaxh@gmail.com`), verificar `quimikuaxh.github.io` en Search Console y pedir la verificación de la marca. El nombre que sale en la pantalla de Google y en el correo de permisos es el de «Pantalla de consentimiento → Marca» (hoy «teambuilder»): cambiarlo a «Daily PWT» también lo cambia para el Team Builder mientras comparta el cliente, así que antes conviene darle al Team Builder su propio proyecto.
  - **Ayuda** explica cuenta, puntos, multiplicador, rankings y amigos (sección «Cuenta, puntos y rankings»). Datos de prueba de Supabase borrados antes del lanzamiento (28/10/2026); solo queda la cuenta de Jose.
  - **Supabase configurado (28/10/2026)** en el proyecto `xvkvzrdvtcnjnbhtydfn`: Google, sesiones anónimas, enlace de identidades, URL de redirección, `pg_cron` con `pwt-close-days` y `pwt-release-nicknames`, migración aplicada y `pwt` publicado. `.env.local` (ignorado) apunta a él.
  - **Falta:** los secretos `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` en GitHub (Jose); después, probar el flujo real (login, enlace de la sesión anónima, dos dispositivos, cierre del día con `pg_cron`) y añadir un e2e contra el proyecto real o simulado si hace falta.
  - **Ruta crítica:** el JS principal queda en 224,4 KB gzip, como antes de F4 (medido por Vite; E2E-21 mide HTML + CSS + JS y su límite es 230). Para que quepa, van en ficheros aparte la cuenta (`Account`, `supabase-js`), las ventanas de la cabecera (Estadísticas, Ayuda, Ajustes, que se traen en reposo), los textos de Ayuda (`esHelp.ts`) y de cuenta, rankings y amigos (`esCloud.ts`) y su CSS (`ui/stats/cloud.css`).
- **F5 · Historial y repeticiones** (28/10/2026; rama `feature/historial-repeticiones`): descripción en [REQUISITOS-F5.md](REQUISITOS-F5.md). Desarrollado (DEC-67, DEC-68; UT-105 a UT-108). Al desplegar, aplicar en Supabase de producción `supabase/migrations/20261029000000_pwt_repeticiones.sql` **antes** de publicar la web (sin ella, el historial da error y las repeticiones se quedan en la cola del navegador). Para probar en local: Supabase local (README, «Supabase en local»). Las repeticiones se guardan a partir del despliegue: los oficiales anteriores no tienen.
- **Logros con login opcional:** requiere backend (cuentas y almacenamiento); el daily sigue sin cuenta. Con sesión, racha diaria y logros en la cuenta; sin sesión, racha en local. Por definir: servicio, qué logros, migración de las estadísticas locales.

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
