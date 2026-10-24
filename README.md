# Daily PWT

Reto diario de combate Pokémon. Cada día, todos los jugadores se enfrentan al mismo entrenador, elegido entre los del Pokémon World Tournament (PWT) de Pokémon Negro 2 / Blanco 2, con su equipo definido en el PWT. Mecánicas de Generación 5, todos los Pokémon a Nv. 50, combate 6 contra 6.

Es un **proyecto de fans, no oficial**. Ver [Aviso legal](#aviso-legal).

Sitio 100 % estático: no tiene backend, cuentas ni persistencia de datos de usuario.

## Estado y alcance

El desarrollo se divide en tres fases (detalle en [docs/PRD.md](docs/PRD.md) §0 y §13 y en [docs/PENDIENTE.md](docs/PENDIENTE.md)).

| Fase | Contenido |
|---|---|
| F1 (hecha) | Reto diario determinista; 6 entrenadores (Brock, Misty, Camila, Plubio, Rojo, Máximo) con 9 variantes de equipo; pool del jugador (sets de Smogon Gen 5 y de los rivales); combate 6 contra 6 con IA heurística; pantalla Hoy, combate (con intro, mensajes uno a uno e historial a demanda) y resultado, con el estilo de los menús de N2/B2 y del PWT. |
| F2 (datos hechos; falta fijar `LAUNCH_DATE` y calibrar la dificultad) | Roster completo de 53 entrenadores (46 líderes y 7 campeones) con sus 99 variantes (594 sets, todos verificados con ≥ 2 fuentes), todos barajados juntos en la bolsa; pool del jugador con los sets de los 53 rivales y Smogon; sprites de todos los entrenadores y especies; validación de datos (`npm run validate:data`) y CI. |
| F3 | Combate oficial único y prácticas, reanudar partida, estadísticas, compartir, pantallas Ayuda y Ajustes. |

En F1 no hay límite de un combate oficial al día ni persistencia: un mismo reto admite combates ilimitados.

Fecha de lanzamiento (`#1`): 2026-10-24 (ver [Configuración](#lanzamiento-launch_date)).

## Requisitos

- Node.js `>=22.12.0` (campo `engines` de `package.json`).
- npm (se incluye `package-lock.json`).
- Para los tests e2e: navegadores de Playwright (ver [Tests e2e](#tests-e2e)).

## Instalación

```sh
npm install
```

## Scripts

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo de Vite. |
| `npm run build` | Comprueba tipos (`tsc -b`) y genera el sitio estático en `dist/`. |
| `npm run preview` | Sirve `dist/` con `vite preview` para probar el build. |
| `npm test` | Tests unitarios y de componentes con Vitest (una pasada). |
| `npm run test:watch` | Vitest en modo interactivo. |
| `npm run test:e2e` | Tests end-to-end con Playwright. |
| `npm run test:e2e:install` | Instala los navegadores de Playwright necesarios (chromium y webkit). |
| `npm run lint` | ESLint sobre el proyecto. |
| `npm run vis` | Capturas de verificación visual (ver [Capturas visuales](#capturas-visuales)). |
| `npm run gen` | Regenera los datos precalculados: `gen:names`, `gen:dex` y `gen:player-sets`. |
| `npm run gen:names` | Genera `src/generated/names-es.json` (nombres en español). |
| `npm run gen:dex` | Genera `src/generated/dex-gen5.json` (especies, movimientos y tabla de tipos Gen 5). |
| `npm run gen:smogon` | Descarga los sets de Smogon Gen 5 (individuales) a `data/smogon/` (requiere red; el resultado se versiona). |
| `npm run gen:player-sets` | Genera `data/player-sets.json` (pool del jugador) desde `data/smogon/` y `data/trainers.json`, y `data/smogon/discarded.json`. Sin red. |
| `npm run gen:ui-index` | Genera `src/generated/battle-ui-images.json` (gráficos de interfaz que se precargan desde Hoy). |
| `npm run validate:data` | Valida `data/*.json`, `src/generated/` y los sprites (PRD §8.3; ver [Validación de datos](#validación-de-datos-y-ci)). Sin red ni `scripts/.cache`; sale con código 1 si hay algún problema. |
| `npm run gen:pwt-raw` / `npm run gen:pwt` | Extraen los equipos del PWT de Bulbapedia, Serebii y WikiDex y los fusionan (ver [docs/F2-DATOS.md](docs/F2-DATOS.md)). `npm run gen:pwt -- --write` además escribe `data/trainers.json`. |
| `npm run gen:sprites` | Descarga a `public/sprites/` los sprites que falten (requiere red). |
| `npm run gen:ui` | Descarga y recorta a `public/ui/` los gráficos de interfaz de N2/B2 (`--force` los rehace todos). Requiere red. |
| `npm run gen:audio` | Codifica a `public/audio/` la música (OST de N2/B2, se descarga) y los efectos de sonido (ZIP descargado a mano) y escribe `src/generated/audio-index.json` (`--force` los rehace todos). Requiere `ffmpeg`, `ffprobe` y `unzip`. Ver «Sonido». |

`gen:sprites`, `gen:ui`, `gen:audio`, `gen:pwt-raw` y `gen:pwt` no forman parte de `npm run gen`. Tras cargar o cambiar entrenadores: `npm run gen:pwt -- --write`, `npm run gen`, `npm run gen:sprites` (si faltan sprites), `npm run gen:sprite-boxes`, `gen:icon-index`, `gen:descriptions`, `gen:ui-index` (si cambian sprites o especies) y `npm run validate:data`.

## Validación de datos y CI

`npm run validate:data` (`scripts/validate-data.mjs`) ejecuta las comprobaciones de PRD §8.3 sin red: 53 entrenadores del roster con ≥ 1 variante (líderes ≥ 2: regional y Mundial; los 46 tienen 2), 6 Pokémon por variante, especies, movimientos (aprendibles), habilidades (de la especie) y objetos de Gen 5, nada prohibido por el PWT, ids únicos, nombres en español, IV por categoría, pool del jugador, calendario y sprites existentes. Imprime el informe de cobertura (sets `verified: false`, entrenadores sin variantes).

`.github/workflows/ci.yml` (pull requests, push a ramas distintas de `main` y requisito previo del despliegue) ejecuta `npm ci`, `validate:data`, `npm test`, `npx tsc -b`, `npm run lint` y `npm run build`. No ejecuta Playwright (en local son ~7 min con 4 workers; en CI, con 2 workers y la instalación de navegadores, pasaría de 10 min y es sensible a la carga): se lanza en local antes de hacer merge.

## Construcción y despliegue

```sh
npm run build
```

Genera `dist/`: HTML, JS, CSS, fuentes y sprites, con rutas relativas (`base: './'`). Puede copiarse a cualquier servidor de ficheros estáticos.

El build de producción no incluye los ganchos de prueba (ver [Ganchos de prueba](#ganchos-de-prueba)).

### GitHub Pages

`.github/workflows/deploy.yml` valida (job `validate`, el de `ci.yml`), construye y publica `dist/` en GitHub Pages en cada push a `main` (también se puede lanzar a mano desde la pestaña Actions). Como las rutas son relativas, funciona bajo `https://<usuario>.github.io/daily-pwt/` sin configurar `base`.

Configuración única del repositorio: Settings > Pages > Source = **GitHub Actions**.

## Estructura

```
daily-pwt/
  data/                      Datos editables: trainers.json, player-sets.json, names-es-overrides.json
  docs/                      PRD, requisitos, arquitectura, plan de pruebas, pendientes
  e2e/                       Tests Playwright (*.spec.ts, pages/, support.ts)
  public/sprites/            Sprites versionados: pokemon/{front,back}/<id>.gif, trainers/<id>.gif y <id>-mini.png
  public/ui/                 Gráficos de interfaz de N2/B2 versionados (ver más abajo)
  scripts/                   Generadores y descargas (build-*.mjs, fetch-sprites.mjs, fetch-ui-assets.mjs, capture-vis.mjs)
    lib/                     Utilidades compartidas de los scripts
    .cache/                  CSV de PokeAPI descargados (ignorado por git)
  src/
    core/                    Lógica pura del reto diario (sin React, DOM ni reloj): fechas, PRNG, equipos, LAUNCH_DATE
    battle/                  Motor de combate (Web Worker con @pkmn/sim), IA rival, traducción del registro
    storage/                 Progreso guardado: interfaz GameStore y LocalStorageStore (oficial del día, decisiones para reanudar)
    ui/                      Componentes de Hoy, Combate y Resultado
    generated/              Datos precalculados (no editar a mano)
    i18n/es.ts               Textos de la interfaz
    config.ts                Reexporta LAUNCH_DATE y define MAX_TURNS (300)
    testHooks.ts             Ganchos de prueba ?date=, ?seed=, ?ai=, ?trainer=, ?variant=
```

## Combate (cómo se juega)

- El combate sigue la pantalla de Pokémon Negro 2 / Blanco 2: arriba la batalla, abajo la pantalla táctil (Luchar, Cambiar, Rendirse y **Rival**: en el PWT no hay objetos, así que el hueco de la Mochila abre el equipo del rival para consultar sus Datos, con PS en porcentaje y solo los PP máximos). Luchar abre los movimientos y Volver regresa al menú.
- **Cambiar** abre la pantalla de equipo (dos pantallas): 6 placas con icono, nombre, nivel, PS y estado. Al elegir un Pokémon salen Cambiar, Datos y Cancelar. **Datos** abre su pantalla de datos con tres páginas (Información, Habilidades y estadísticas, Movimientos): ← → cambian de página, ↑ ↓ de Pokémon y Escape vuelve; también hay botones « », pestañas, ▲ ▼, Volver y Cerrar. En el cambio forzado tras un KO no hay Cancelar ni Volver, pero Datos sigue disponible.
- Al cambiar de Pokémon (el tuyo o el del rival) el entrenador entra, el rayo rojo retira al Pokémon y la Poké Ball lanza el nuevo; respeta la velocidad y `prefers-reduced-motion`.
- Los mensajes salen uno a uno en la caja de texto y avanzan solos. Un toque en la caja, Enter o Espacio los adelanta; en la intro, la salta. **Velocidad** cicla x1, x2 y x4.
- **Registro** abre el historial completo del combate (aparte, a demanda). **Salir** descarta la partida si es una práctica; si es el oficial, queda guardada y se reanuda desde Hoy.
- **Oficial y práctica** (PRD §4.3): en Hoy, «Combate oficial» y «Práctica». Solo hay un oficial por día del reto: queda registrado al empezarlo, salir o recargar lo reanuda en el mismo turno (sin intro) y rendirse es derrota; terminado, el botón queda deshabilitado con el resultado. Un oficial que empieza el día N y acaba pasada la medianoche cuenta para N. La práctica es ilimitada, no cuenta para nada y no se guarda. La etiqueta OFICIAL o PRÁCTICA se ve arriba a la derecha del combate.
- **Ayuda y Ajustes** (DEC-49): iconos de la cabecera de Hoy y de Resultado. Ayuda: cómo se juega, reglas, mecánicas de 5.ª generación, consejos, créditos y aviso legal. Ajustes: velocidad del combate (x1, x2, x4; también con el botón Velocidad del combate), animaciones (Siempre, Según el sistema o Nunca; por defecto Siempre, aunque el sistema tenga «reducir movimiento»), sonido (Activado/Silenciado) y volumen (deslizador, 70 % por defecto) y «Borrar datos locales». El sonido y el volumen también se cambian en combate con el botón Sonido. Los ajustes se guardan en `localStorage`, clave `daily-pwt:settings`. Sin tema claro/oscuro.
- **Marco de consola** (DEC-49): en escritorio, si cabe sin bajar la escala del lienzo (p. ej. 1440×900 o 1920×1080), el combate va dentro de una DS sencilla; en móvil y a 1280×800, sin marco.
- **Sonido** (DEC-57): música del rival en combate (en bucle desde la intro), «Winning in the PWT!» en Resultado si se gana, y efectos de golpe, Poké Ball y debilitado. No suena nada hasta tocar la página o pulsar una tecla. Cada combate descarga solo su pista (2-3 MB) y los efectos. En los E2E no se oye: el Chromium de Playwright no trae AAC.
- **Animaciones de movimientos** (DEC-53): cada movimiento usado se anima a la vez que su mensaje, en píxel y con los colores de su tipo (genéricas por clase y 20 propias). Se desactivan en Ajustes o con «reducir movimiento» del sistema. Se regeneran con `npm run gen:move-fx` si cambian los equipos.
- **Clima** (DEC-48): en el hueco de arriba de la pantalla táctil, con dibujo del clima y, si lo provocó un movimiento, el reloj con los turnos que le quedan.
- **Estadísticas y compartir** (DEC-47): el botón de barras de la cabecera de Hoy (y de Resultado) abre Estadísticas: jugados, % de victorias y rachas de victorias y de días (actual y máxima), solo con oficiales. Resultado del oficial muestra las cifras actualizadas y **Copiar** (copia el resultado al portapapeles, también en móvil) con un texto sin spoilers: número del reto, resultado, una casilla 🟩/🟥 por Pokémon en el orden del equipo y la racha de victorias.
- **Datos locales** (DEC-43): el progreso vive en `localStorage`, clave `daily-pwt:v1` (un registro por día con rival, variante, resultado, turnos, supervivientes, qué Pokémon cayeron y horas, más las decisiones del combate en curso). Si el navegador no deja guardar, el sitio funciona igual y Hoy avisa de que no se recordará. Para empezar de cero: DevTools → Application → Local Storage → borrar `daily-pwt:v1` (y `daily-pwt:v1:corrupt` si existe), o `localStorage.removeItem('daily-pwt:v1')` en la consola. Borrarlos devuelve el oficial del día; lo mismo hace **Ajustes → Borrar datos locales** (con confirmación), que además borra los ajustes.
- Escala del lienzo: por debajo de x2 ocupa todo el ancho con escala fraccionaria (≈1,4 a 360 px, 1,5 a 400 px) y `image-rendering: pixelated`; desde x2 solo enteros (2 a 1280×800). Con `prefers-reduced-motion` la intro y los cambios no desplazan nada: solo fundidos.

## Configuración

### Lanzamiento (`LAUNCH_DATE`)

- Archivo: `src/core/launch.ts` (`src/config.ts` lo reexporta). Valor: `2026-10-24`, fecha de lanzamiento fijada por Jose el 23/10/2026.
- Efecto: fija el día `#1` del reto y, con él, el desplazamiento de la bolsa de entrenadores. Las fechas anteriores a `LAUNCH_DATE` muestran `#1`.
- Cambiarlo altera el entrenador, la variante y el equipo de cada fecha y los números `#N`. La secuencia de rivales solo depende del índice de día (los 53 se barajan juntos desde el día 0): con esta fecha los días 2026-10-24 a 26 son Misty, Fredo y Antón y Máximo toca el día `#39` (2026-12-01, `D + 38`). Misty es el #1 por la apertura del lanzamiento (`LAUNCH_OPENING` en `src/core/launch.ts`): en el primer ciclo, los de esa lista pasan a los primeros días intercambiados con quien estaba (la bolsa daba Hiedra, que pasa al #46). Vaciar la lista devuelve el orden puro de la bolsa. Para cambiarla: poner la nueva fecha `D` en `src/core/launch.ts`, mover las fechas de referencia de `src/test-utils/dates.ts` (D-1 … D+5 y D+365), regenerar el snapshot y revisarlo (pasos siguientes). Efecto completo y opciones descartadas en [docs/F2-DATOS.md](docs/F2-DATOS.md), «Calendario».
- Cambiar el roster (añadir o quitar entrenadores) rebaraja la bolsa igual que cambiar la fecha: regenerar el snapshot y avisar de que cambia lo ya publicado.

Pasos al cambiarlo:

1. Salvo `REFERENCE_DATES` (`src/test-utils/dates.ts`, literales relativos a la fecha de lanzamiento), no hay que tocar fechas en los tests: `LAUNCH` (`src/test-utils/dates.ts`) y `LAUNCH_DATE` (`e2e/support.ts`) siguen a `src/core/launch.ts`, y los rivales se eligen por id (ver [Ganchos de prueba](#ganchos-de-prueba)). Solo el snapshot de referencia depende de la fecha.
2. Regenerar el snapshot de referencia y revisarlo a mano antes de versionarlo:
   ```sh
   npx vitest run src/core/challenge.snapshot.test.ts -u
   ```
   Con `CI=true` Vitest no escribe snapshots nuevos.
3. Ejecutar `npm test` y, si procede, `npm run test:e2e`.

### Ganchos de prueba

Solo existen en builds con `VITE_TEST_HOOKS=1`. En el build normal son ignorados y el código correspondiente se elimina del bundle.

| Parámetro | Valor | Efecto |
|---|---|---|
| `?date=` | `YYYY-MM-DD` (fecha local) | Fija el reto de esa fecha, y con él el día del oficial guardado. Un valor con otro formato se ignora. |
| `?seed=` | 1–64 caracteres `[A-Za-z0-9_.:-]` | Semilla del primer combate de la sesión. Los siguientes usan `<seed>-<n>`. Sin el parámetro, la semilla es aleatoria. |
| `?trainer=` | id de entrenador (`[a-z0-9-]`, p. ej. `brock`) | Fuerza ese rival sin pasar por la bolsa. La fecha (`?date=` o la del reloj) sigue aportando el número del reto y las semillas de variante y equipo del jugador. Un id que no existe da el error de datos de Hoy. |
| `?variant=` | id de variante (p. ej. `brock-world-leaders`) | Fuerza la variante de equipo; solo vale junto a `?trainer=`. Sin él, la variante sale del PRNG de la fecha. |
| `?ai=` | `trivial` | Sustituye la IA heurística del rival por una IA que elige el primer movimiento disponible. |

```sh
VITE_TEST_HOOKS=1 npm run build
```

Los tests eligen el escenario por id, no por fecha (DEC-35 en [ARQUITECTURA.md](docs/ARQUITECTURA.md)): en vitest, `challengeFor({ trainerId, variantId?, date }, data)` (`src/core/challenge.ts`); en Playwright, los escenarios de `e2e/support.ts` (`PLUBIO`, `MISTY`... con `scenarioQuery`), cuya fecha es un literal que solo siembra el equipo del jugador. Así añadir entrenadores o fijar `LAUNCH_DATE` no obliga a reajustar los tests; solo se regenera el snapshot del generador.

## Datos

### Entrenadores y equipos (`data/trainers.json`)

- Contiene `dataVersion`, `rosterSchedule` (orden de la bolsa por ciclos) y `trainers`.
- Cada entrenador tiene `variants`; cada variante tiene exactamente 6 sets (`team`) a Nv. 50 con `sourceTournament` y `sourceUrl`.
- Los IV son fijos por categoría del rival: líderes 20, campeones 25, Rojo 30. El jugador lleva los mismos IV que el rival del día, EV 0 y naturaleza Seria. Los EV ausentes del rival se toman como 0 y se marcan.
- `verified: true` indica que el set se ha cotejado con dos fuentes.
- Los 53 entrenadores se generan con `npm run gen:pwt -- --write` (ver [docs/F2-DATOS.md](docs/F2-DATOS.md)); un nuevo `--write` sobrescribe el fichero. `rosterSchedule` tiene una única entrada con los 53 desde el día 0. Los tests y `npm run validate:data` comprueban forma, legalidad en Gen 5 y prohibiciones del PWT, pero no la exactitud frente al juego.

### Pool del jugador (`data/player-sets.json`)

- Sets de los que se elige el equipo del jugador cada día: 1568 sets de 329 especies, de Smogon (Gen 5, individuales: Ubers, OU, UU, RU, NU, PU y ZU) y de los equipos de los rivales del PWT. De Smogon solo se toman objeto, habilidad y movimientos; EVs 0, naturaleza Seria, IV iguales a los del rival del día.
- Solo Pokémon totalmente evolucionados, sin legendarios, movimientos ni objetos prohibidos en el PWT (`src/core/pwt-rules.json`) y legales en Gen 5 según el validador de `@pkmn/sim`. Los descartados están en `data/smogon/discarded.json`. Tags: `source:smogon-<tier>` y `source:<idEntrenador>`.
- Regla de alternativas de Smogon (varios movimientos u objetos por hueco): la primera opción de cada hueco; un set de Smogon da un único set (ver ARQUITECTURA DEC-31).
- `data/smogon/` contiene los JSON descargados con `npm run gen:smogon` y su `manifest.json` (URL, fecha, SHA-256): `npm run gen:player-sets` es offline y determinista. `gen:player-sets` **sobrescribe** `data/player-sets.json`.
- Origen y crédito: **Smogon University** (https://www.smogon.com/dex/bw/), a través del volcado de https://data.pkmn.cc/sets (proyecto `@pkmn`).

### Nombres en español (`data/names-es-overrides.json`)

Traducciones manuales que prevalecen sobre las de PokeAPI.

### Datos generados (`src/generated/`)

- `dex-gen5.json`: generado con `npm run gen:dex` a partir de `@pkmn/data` (Gen 5). No necesita red.
- `names-es.json`: generado con `npm run gen:names`. Usa los CSV de PokeAPI en `scripts/.cache/`, fijados al commit `6fd69dfe90465ba96534f6816fc817737d1f97f6` (constante `POKEAPI_COMMIT` en `scripts/build-names-es.mjs`). Si `scripts/.cache/` no existe, el script necesita red para descargarlos.
- Para actualizar los CSV: cambiar `POKEAPI_COMMIT` y borrar `scripts/.cache/`.
- Ejecutar `npm run gen` tras cambiar `data/trainers.json`, `data/names-es-overrides.json` o el commit de PokeAPI, y `npm run gen:sprites` si aparecen especies o entrenadores nuevos. Los tests comparan los ficheros versionados con su regeneración en memoria.

### Gráficos de interfaz (`public/ui/`)

- `data/ui-assets.json` es la fuente de verdad: cada fichero de `public/ui/` lleva su origen, URL, crédito y licencia, y, si sale de una hoja, el recorte `[x, y, ancho, alto]`, los colores clave que pasan a transparentes y los rectángulos borrados.
- Orígenes: Bulbagarden Archives (fondos de combate de N2/B2, iconos de tipo y de categoría, protagonistas de espaldas, capturas de Negro/Blanco para el fondo de la pantalla de datos), The Spriters Resource vía Internet Archive (databoxes y barras de PS, botones de la pantalla táctil, Poké Ball de transición y fotogramas de la Poké Ball lanzada, fondos y placas de la pantalla de equipo, protagonistas lanzando; el sitio está tras Cloudflare) y Pokémon Showdown (iconos de menú de los Pokémon, destello).
- **Fondo de la pantalla de datos**: es de Negro/Blanco, no de N2/B2. Sale de capturas de Bulbagarden Archives limpiadas por script (`cleanups` en el manifest: `tile`, `clone`, `fill` con `clip`); los textos, el sprite y las barras se pintan en ejecución. Para sustituirlo por un rip limpio basta cambiar la URL y quitar la limpieza.
- Iconos de tipo en español: `types-blank/` (icono sin rótulo, `fill` con `from`) más el nombre pintado en ejecución. La Poké Ball es una tira de 7 fotogramas (`strip`, reducida a la mitad con `shrink`) de la hoja «Poké Balls» de Negro/Blanco.
- `npm run gen:ui` (`scripts/fetch-ui-assets.mjs`) solo escribe dentro de `public/ui/` (rutas `^[a-z0-9-]+(/[a-z0-9-]+)*\.png$`), valida la cabecera PNG y el tamaño esperado, recorta sin reescalar y salta lo que ya existe. Los PNG quedan en su resolución nativa de DS (256x192 por pantalla).
- Estructura: `battle/{bg,databox,hp,icons,status,digits,touch,transition,trainers,types,types-blank,categories,party,summary,fx}`.
- Fuente del juego: `public/fonts/pokemon-dp.ttf`, descrita en la sección `fonts` del manifest y descargada por el mismo script. Una sola `@font-face` y una sola variable CSS (`--font-game`) en `src/index.css`: para cambiar de fuente se sustituye el fichero.
- Los rótulos ingleses BAG/RUN de `touch/` se tapan en el asset con `clone` (copia de una caja del propio PNG repitiendo el patrón de puntos de periodo 5); la UI dibuja los rótulos en español.

### Sonido (`public/audio/`)

- `data/audio.json` es la fuente de verdad: cada pista y efecto con su origen, crédito y licencia. Destino: `public/audio/music/<id>.m4a` y `public/audio/sfx/<id>.m4a`, en AAC a 48 kHz estéreo (música a 128 kbps, efectos a 96 kbps). `src/generated/audio-index.json` lista ruta y duración de cada uno.
- **Música**: pistas completas del *Super Music Collection* de N2/B2 en FLAC (Internet Archive, `pkmn-bw2-soundtrack`). El script las descarga a `scripts/.cache/audio/` (ignorado) y las codifica sin recortar: cada pista trae introducción, el bucle dos veces y el fundido final. Tema de cada rival: `gym-<región>` para líderes y `champion-<región>` para campeones (Mirto usa `champion-unova`, el tema de Iris); `victory-pwt` es el jingle de victoria.
- **Efectos**: salen del ZIP «Miscellaneous - Sound Effects» de [The Sounds Resource](https://sounds.spriters-resource.com/ds_dsi/pokemonblack2white2/). El sitio tiene reto de Cloudflare y no deja descargar por script: hay que bajar el ZIP con el navegador y dejarlo, sin descomprimir, en `scripts/.cache/sfx/` con el nombre que indica `sources.tsr-sfx-b2w2.zip`. El script extrae las entradas del manifiesto (nombres internos del juego: `SEQ_SE_KOUKA_H/M/L` golpe supereficaz/neutro/poco eficaz, `SEQ_SE_NAGERU` lanzar, `SEQ_SE_BOWA2` abrir la Poké Ball, `SEQ_SE_HINSHI` pitido de vida baja, `SEQ_SE_DEAD` debilitado, `SEQ_SE_DECIDE1`/`SEQ_SE_CANCEL1` elegir y cancelar en el menú; de `SEQ_SE_BE/`, elegidos a oído: `01` dormido, `02` envenenado, `03` quemado, `04` congelado, `05` paralizado, `06` confuso, `10` comerse una baya, `12` y `13` subir y bajar una característica) y les quita el silencio del principio y del final.
- **Puntos de bucle** (`loopStartSec`/`loopEndSec` de cada pista de combate en `data/audio.json`, que `gen:audio` copia al índice): `python3 scripts/find-loops.py public/audio/music/<id>.m4a` (necesita `ffmpeg` y `numpy`) los calcula sobre el `.m4a` y los imprime para copiarlos; se pueden retocar a mano (en segundos) y volver a lanzar `npm run gen:audio`, que no recodifica nada. El reproductor hace un fundido de 40 ms en la costura (DEC-57).
- Efectos que el código ya pide y faltan en el manifiesto: `menu-select` y `menu-cancel` (botones del menú de batalla) y `status-brn`, `status-psn`, `status-par`, `status-slp`, `status-frz` y `status-confusion` (estados); la tabla está en PENDIENTE.md. Mientras no estén, no suenan.
- Para añadir un efecto: entrada nueva en `sfx` de `data/audio.json` (`entry` es la ruta dentro del ZIP; `unzip -l` las lista) y `npm run gen:audio`.

### Sprites (`public/sprites/`)

- Pokémon: sprites animados de Gen 5 de Pokémon Showdown (`gen5ani` para el frente, `gen5ani-back` para la espalda). Nombre de fichero: `<spriteId>.gif`.
- Entrenadores: sprites de Negro 2 / Blanco 2 de WikiDex (`<Nombre>_N2B2.gif` y `<Nombre>_N2B2_mini.png`). La URL del CDN sale de las páginas de WikiDex ya descargadas por `gen:pwt-raw` (`scripts/.cache/pwt/`) o, si falta, de su API (a veces responde 503). El fichero de Teniente Surge es `Lt._Surge_N2B2.gif`. Si el CDN no responde, se usa la copia de Internet Archive de la misma URL.
- Datos generados nuevos: `npm run gen:sprite-boxes` (caja visible de cada GIF, en `src/generated/sprite-boxes.json`), `npm run gen:icon-index` (posición de cada especie en la hoja de iconos) y `npm run gen:descriptions` (descripciones de movimientos y habilidades en español, texto de Pokémon X/Y de PokeAPI; descarga y cachea los CSV en `scripts/.cache/`). Se regeneran en memoria en `src/data/generated.test.ts`.
- `npm run gen:sprites` (`scripts/fetch-sprites.mjs`) descarga solo los ficheros que faltan o no tienen cabecera GIF/PNG válida. Requiere red, espera entre peticiones (lento) y termina con código de error si falta algún sprite.
- Los sprites se versionan en el repositorio. La aplicación no los descarga en caliente.
- **Sin parpadeo (Lanturn):** el GIF de Showdown encendía y apagaba el halo de las antenas cada 50 ms (riesgo de epilepsia fotosensible). Se dejan solo los fotogramas con halo, a 100 ms: `convert <gif> -coalesce -delete "$(seq -s, 0 2 125)" -set delay 10 -loop 0 -layers OptimizeTransparency <gif>` (ImageMagick, en `front` y `back`). Si se borra y se vuelve a descargar, hay que repetirlo; UT-80 lo avisa.
- `npm run gen:sprite-boxes` (`scripts/build-sprite-boxes.mjs`, decodificador GIF propio en `scripts/lib/gif.mjs`) escribe `src/generated/sprite-boxes.json` con la caja visible (no transparente) de cada GIF; la UI ancla el sprite del jugador con ella (`src/ui/battle/playerSpriteAnchor.ts`). Hay que regenerarlo si cambian los sprites.

## Tests

### Unitarios y de componentes

```sh
npm test
```

Vitest con dos proyectos: `node` (`src/**/*.test.ts`, `scripts/**/*.test.ts`) y `jsdom` (`src/**/*.test.tsx`, React Testing Library). Las comparaciones de `names-es.json` y `descriptions-es.json` con su regeneración (`src/data/generated.test.ts`) necesitan `scripts/.cache/` (CSV de PokeAPI): sin esa carpeta (CI, clon limpio) se omiten con un aviso en la salida; para activarlas, `npm run gen:names` con red. `npm run validate:data` comprueba sin caché que cada nombre y descripción usados existen.

Comprobación de tipos y lint:

```sh
npx tsc -b
npm run lint
```

### Tests e2e

```sh
npm run test:e2e:install   # solo la primera vez: chromium y webkit
npm run test:e2e
```

- `npm run test:e2e` lanza primero la batería principal (`--grep-invert @timing`, con workers en paralelo) y después `npm run test:e2e:timing` (`--grep @timing --workers=1`). Los casos `@timing` miden tiempos reales (E2E-21 carga con 4G y CPU x4, E2E-03 cambio de día con reloj simulado, E2E-47 a E2E-51 animaciones y descargas, E2E-56 oficial que cruza medianoche) y se vuelven inestables con la carga de otros workers; en serie son estables y no se relajan sus umbrales. Para ejecutarlos por separado: `npm run test:e2e:timing`.

- Playwright compila y sirve dos builds con `vite preview` antes de los tests:
  - `dist-e2e/` con `VITE_TEST_HOOKS=1`, puerto 4391. La mayoría de los casos usa este build.
  - `dist-e2e-prod/` sin ganchos, puerto 4392. Lo usan los casos que verifican que los ganchos no existen en producción (E2E-17).
- Puertos: variables `E2E_PORT` y `E2E_PORT_PROD`. Si el puerto está ocupado, la ejecución falla (no reutiliza servidores).
- Proyectos: `chromium` y `webkit` (escritorio); `mobile-360` (Pixel 5 a 360×740, solo `mobile.spec.ts`). Firefox es opcional: `E2E_FIREFOX=1` tras `npx playwright install firefox`.
- Duración: unos 7 minutos con 4 workers (más el tramo `@timing` en serie) (medición de octubre de 2026). En CI (`CI=1`) se usan 2 workers.
- Informes: `test-results/` (trazas de los fallos) y `playwright-report/`. Ver el informe con `npx playwright show-report`.
- **Humo en CI** (DEC-50): `npm run test:e2e:smoke` lanza en Chromium los casos marcados `@smoke` (Hoy, una partida, el oficial con estadísticas y compartir, Ayuda y el build sin ganchos; ~30 s más la instalación del navegador). El job `e2e-smoke` de `ci.yml` lo corre en cada push que no sea a `main`, en los PR y antes de cada despliegue; si falla, sube el informe como artefacto. La batería completa sigue siendo local.
- **Escenarios**: `e2e/scenarios.json` (rival por `?trainer=` y fecha literal) es la única lista de escenarios; la usan los E2E (`e2e/support.ts`) y las capturas visuales.

Los directorios `dist-e2e/`, `dist-e2e-prod/`, `test-results/` y `playwright-report/` están en `.gitignore`.

## Capturas visuales

Las capturas de verificación (VIS-01 a VIS-14) se generan a 360×740 y 1280×800 con rival por `?trainer=` y las fechas de `e2e/scenarios.json` (como los E2E; no dependen de `LAUNCH_DATE`) y semillas fijas:

```sh
VITE_TEST_HOOKS=1 npx vite build --outDir dist-e2e --emptyOutDir
npm run vis
```

- `npm run vis` no compila: requiere `dist-e2e/` ya construido con ganchos.
- Sirve `dist-e2e/` en el puerto `VIS_PORT` (4393 por defecto).
- Escribe las PNG en `e2e-artifacts/vis/` (o en la ruta pasada como argumento). Requiere chromium instalado (`npm run test:e2e:install`).
- `e2e-artifacts/` está en `.gitignore`.

## Créditos

- **Smogon University**: sets de Gen 5 en individuales del pool del jugador (`data/smogon/`).
- **Pokémon Showdown**: sprites Gen 5 animados (`gen5ani`, `gen5ani-back`). Las dependencias `@pkmn/sim`, `@pkmn/dex` y `@pkmn/data` (paquetes de Pokémon Showdown) implementan el motor de combate y los datos.
- **Smogon**: `@smogon/calc`, cálculo de daño.
- **PokeAPI**: nombres en español (CSV de `pokemon_species_names`, `move_names`, `ability_names`, `item_names`, `type_names`).
- **Bulbapedia**: fuente de los equipos de cada torneo (`sourceUrl` de cada variante).
- **Serebii**: contraste de equipos del PWT.
- **WikiDex**: sprites de entrenadores de Negro 2 / Blanco 2 y nombres de referencia.
- **Internet Archive**: copia de los sprites de WikiDex cuando su CDN no responde.
- **hexparrot/pokemon-assets**: `Pokemon-DP.ttf` (MIT), réplica fan de la fuente de Pokémon Diamante/Perla, en `public/fonts/` (`npm run gen:ui`). Provisional hasta sustituirla por una réplica de la de Negro 2 / Blanco 2.
- **Bulbagarden Archives**, **The Spriters Resource** (vía Internet Archive) y **Pokémon Showdown**: gráficos de interfaz de combate de Negro 2 / Blanco 2 (`public/ui/`, ver `data/ui-assets.json`).
- **Internet Archive** (*Pokémon Black 2 & Pokémon White 2: Super Music Collection*): música de combate de Negro 2 / Blanco 2 (`public/audio/music/`).
- **The Sounds Resource**: efectos de sonido de Negro 2 / Blanco 2 (`public/audio/sfx/`, ver `data/audio.json`).

## Aviso legal

Daily PWT es un proyecto de fans, no oficial y sin ánimo de lucro. Pokémon y sus nombres son marcas de Nintendo, Creatures Inc., GAME FREAK inc. y The Pokémon Company. Este sitio no está afiliado a ninguna de ellas.

Sin monetización.

## Documentación

- [docs/PRD.md](docs/PRD.md): requisitos de producto, fases y criterios de aceptación.
- [docs/REQUISITOS-F1.md](docs/REQUISITOS-F1.md): requisitos de la fase F1.
- [docs/REQUISITOS-F2.md](docs/REQUISITOS-F2.md): requisitos de la fase F2.
- [docs/F2-DATOS.md](docs/F2-DATOS.md): importación de los 53 entrenadores, calendario y anexo de nombres.
- [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md): decisiones técnicas y contratos.
- [docs/PLAN-PRUEBAS-F1.md](docs/PLAN-PRUEBAS-F1.md): casos de prueba de F1.
- [docs/PENDIENTE.md](docs/PENDIENTE.md): trabajo para F2/F3, pendientes menores y cómo sustituir la fuente.
