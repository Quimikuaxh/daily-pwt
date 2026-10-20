# Daily PWT

Reto diario de combate Pokémon. Cada día, todos los jugadores se enfrentan al mismo entrenador, elegido entre los del Pokémon World Tournament (PWT) de Pokémon Negro 2 / Blanco 2, con su equipo definido en el PWT. Mecánicas de Generación 5, todos los Pokémon a Nv. 50, combate 6 contra 6.

Es un **proyecto de fans, no oficial**. Ver [Aviso legal](#aviso-legal).

Sitio 100 % estático: no tiene backend, cuentas ni persistencia de datos de usuario.

## Estado y alcance

El desarrollo se divide en tres fases (detalle en [docs/PRD.md](docs/PRD.md) §0 y §13 y en [docs/PENDIENTE.md](docs/PENDIENTE.md)).

| Fase | Contenido |
|---|---|
| F1 (en curso a 2026-10-19) | Reto diario determinista; 5 entrenadores (Brock, Misty, Camila, Plubio, Rojo) con 8 variantes de equipo; pool provisional del jugador; combate 6 contra 6 con IA heurística; pantalla Hoy, combate (con intro, mensajes uno a uno e historial a demanda) y resultado, con el estilo de los menús de N2/B2 y del PWT. |
| F2 | Roster completo de 53 entrenadores con todas sus variantes; scripts de datos y validación completos; sprites de todos los entrenadores. |
| F3 | Combate oficial único y prácticas, reanudar partida, estadísticas, compartir, pantallas Ayuda y Ajustes. |

En F1 no hay límite de un combate oficial al día ni persistencia: un mismo reto admite combates ilimitados.

Fecha de lanzamiento (`#1`) en F1: 2026-10-17 (ver [Configuración](#lanzamiento-launch_date)).

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
| `npm run gen:player-sets` | Genera `data/player-sets.json` (pool provisional del jugador) desde `data/trainers.json`. |
| `npm run gen:sprites` | Descarga a `public/sprites/` los sprites que falten (requiere red). |
| `npm run gen:ui` | Descarga y recorta a `public/ui/` los gráficos de interfaz de N2/B2 (`--force` los rehace todos). Requiere red. |

`gen:sprites` y `gen:ui` no forman parte de `npm run gen`.

## Construcción y despliegue

```sh
npm run build
```

Genera `dist/`: HTML, JS, CSS, fuentes y sprites, con rutas relativas (`base: './'`). Puede copiarse a cualquier servidor de ficheros estáticos.

El build de producción no incluye los ganchos de prueba (ver [Ganchos de prueba](#ganchos-de-prueba)).

### GitHub Pages

`.github/workflows/deploy.yml` construye y publica `dist/` en GitHub Pages en cada push a `main` (también se puede lanzar a mano desde la pestaña Actions). Como las rutas son relativas, funciona bajo `https://<usuario>.github.io/daily-pwt/` sin configurar `base`.

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
    ui/                      Componentes de Hoy, Combate y Resultado
    generated/              Datos precalculados (no editar a mano)
    i18n/es.ts               Textos de la interfaz
    config.ts                Reexporta LAUNCH_DATE y define MAX_TURNS (300)
    testHooks.ts             Ganchos de prueba ?date=, ?seed=, ?ai=
```

## Combate (cómo se juega)

- El combate sigue la pantalla de Pokémon Negro 2 / Blanco 2: arriba la batalla, abajo la pantalla táctil (Luchar, Cambiar, Rendirse; Mochila sale atenuada: en el PWT no hay objetos y al tocarla la caja de texto lo explica). Luchar abre los movimientos y Volver regresa al menú.
- **Cambiar** abre la pantalla de equipo (dos pantallas): 6 placas con icono, nombre, nivel, PS y estado. Al elegir un Pokémon salen Cambiar, Datos y Cancelar. **Datos** abre su pantalla de datos con tres páginas (Información, Habilidades y estadísticas, Movimientos): ← → cambian de página, ↑ ↓ de Pokémon y Escape vuelve; también hay botones « », pestañas, ▲ ▼, Volver y Cerrar. En el cambio forzado tras un KO no hay Cancelar ni Volver, pero Datos sigue disponible.
- Al cambiar de Pokémon (el tuyo o el del rival) el entrenador entra, el rayo rojo retira al Pokémon y la Poké Ball lanza el nuevo; respeta la velocidad y `prefers-reduced-motion`.
- Los mensajes salen uno a uno en la caja de texto y avanzan solos. Un toque en la caja, Enter o Espacio los adelanta; en la intro, la salta. **Velocidad** cicla x1, x2 y x4.
- **Registro** abre el historial completo del combate (aparte, a demanda). **Salir** descarta la partida.
- Escala del lienzo: por debajo de x2 ocupa todo el ancho con escala fraccionaria (≈1,4 a 360 px, 1,5 a 400 px) y `image-rendering: pixelated`; desde x2 solo enteros (2 a 1280×800). Con `prefers-reduced-motion` la intro y los cambios no desplazan nada: solo fundidos.

## Configuración

### Lanzamiento (`LAUNCH_DATE`)

- Archivo: `src/core/launch.ts` (`src/config.ts` lo reexporta). Valor actual: `2026-10-17`.
- Efecto: fija el día `#1` del reto y, con él, el desplazamiento de la bolsa de entrenadores. Las fechas anteriores a `LAUNCH_DATE` muestran `#1`.
- Cambiarlo altera el entrenador y el equipo de cada fecha. Solo debe hacerse en una fase que lo permita (ver [PENDIENTE.md](docs/PENDIENTE.md)).

Pasos al cambiarlo:

1. Actualizar las referencias fijas al lanzamiento: `LAUNCH` en `src/test-utils/dates.ts` (fecha base de los tests que usan `dates()`), `D0` en `e2e/support.ts` y las expectativas `#N` de `e2e/` (p. ej. `#9` para 2026-10-25 en `e2e/build.spec.ts`).
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
| `?date=` | `YYYY-MM-DD` (fecha local) | Fija el reto de esa fecha. Un valor con otro formato se ignora. |
| `?seed=` | 1–64 caracteres `[A-Za-z0-9_.:-]` | Semilla del primer combate de la sesión. Los siguientes usan `<seed>-<n>`. Sin el parámetro, la semilla es aleatoria. |
| `?ai=` | `trivial` | Sustituye la IA heurística del rival por una IA que elige el primer movimiento disponible. |

```sh
VITE_TEST_HOOKS=1 npm run build
```

## Datos

### Entrenadores y equipos (`data/trainers.json`)

- Contiene `dataVersion`, `rosterSchedule` (orden de la bolsa por ciclos) y `trainers`.
- Cada entrenador tiene `variants`; cada variante tiene exactamente 6 sets (`team`) a Nv. 50 con `sourceTournament` y `sourceUrl`.
- Los IV son fijos por categoría del rival: líderes 20, campeones 25, Rojo 30. El jugador lleva los mismos IV que el rival del día, EV 0 y naturaleza Seria. Los EV ausentes del rival se toman como 0 y se marcan.
- `verified: true` indica que el set se ha cotejado con dos fuentes.
- Se edita a mano. Los tests de validación comprueban forma, legalidad en Gen 5 y prohibiciones del PWT, pero no la exactitud frente al juego.

### Pool del jugador (`data/player-sets.json`)

- Sets de los que se elige el equipo del jugador cada día.
- Es provisional: se deriva de los equipos rivales (solo Pokémon totalmente evolucionados, sin duplicados, con tags `source:<idEntrenador>`).
- `npm run gen:player-sets` **sobrescribe** el fichero con ese cálculo. Si se sustituye por un pool definitivo, no ejecutar `gen:player-sets` ni `npm run gen`, y el test que compara con la regeneración dejará de cumplirse.

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

### Sprites (`public/sprites/`)

- Pokémon: sprites animados de Gen 5 de Pokémon Showdown (`gen5ani` para el frente, `gen5ani-back` para la espalda). Nombre de fichero: `<spriteId>.gif`.
- Entrenadores: sprites de Negro 2 / Blanco 2 de WikiDex (`<Nombre>_N2B2.gif` y `<Nombre>_N2B2_mini.png`). Si el CDN de WikiDex no responde, se usa la copia de Internet Archive de la misma URL.
- Datos generados nuevos: `npm run gen:sprite-boxes` (caja visible de cada GIF, en `src/generated/sprite-boxes.json`), `npm run gen:icon-index` (posición de cada especie en la hoja de iconos) y `npm run gen:descriptions` (descripciones de movimientos y habilidades en español, texto de Pokémon X/Y de PokeAPI; descarga y cachea los CSV en `scripts/.cache/`). Se regeneran en memoria en `src/data/generated.test.ts`.
- `npm run gen:sprites` (`scripts/fetch-sprites.mjs`) descarga solo los ficheros que faltan o no tienen cabecera GIF/PNG válida. Requiere red, espera entre peticiones (lento) y termina con código de error si falta algún sprite.
- Los sprites se versionan en el repositorio. La aplicación no los descarga en caliente.
- `npm run gen:sprite-boxes` (`scripts/build-sprite-boxes.mjs`, decodificador GIF propio en `scripts/lib/gif.mjs`) escribe `src/generated/sprite-boxes.json` con la caja visible (no transparente) de cada GIF; la UI ancla el sprite del jugador con ella (`src/ui/battle/playerSpriteAnchor.ts`). Hay que regenerarlo si cambian los sprites.

## Tests

### Unitarios y de componentes

```sh
npm test
```

Vitest con dos proyectos: `node` (`src/**/*.test.ts`, `scripts/**/*.test.ts`) y `jsdom` (`src/**/*.test.tsx`, React Testing Library). Algunos tests de datos leen `scripts/.cache/`; sin esa carpeta hay que ejecutar `npm run gen:names` con red antes.

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

- Playwright compila y sirve dos builds con `vite preview` antes de los tests:
  - `dist-e2e/` con `VITE_TEST_HOOKS=1`, puerto 4391. La mayoría de los casos usa este build.
  - `dist-e2e-prod/` sin ganchos, puerto 4392. Lo usan los casos que verifican que los ganchos no existen en producción (E2E-17).
- Puertos: variables `E2E_PORT` y `E2E_PORT_PROD`. Si el puerto está ocupado, la ejecución falla (no reutiliza servidores).
- Proyectos: `chromium` y `webkit` (escritorio); `mobile-360` (Pixel 5 a 360×740, solo `mobile.spec.ts`). Firefox es opcional: `E2E_FIREFOX=1` tras `npx playwright install firefox`.
- Duración: unos 7 minutos con 4 workers (medición de octubre de 2026). En CI (`CI=1`) se usan 2 workers.
- Informes: `test-results/` (trazas de los fallos) y `playwright-report/`. Ver el informe con `npx playwright show-report`.

Los directorios `dist-e2e/`, `dist-e2e-prod/`, `test-results/` y `playwright-report/` están en `.gitignore`.

## Capturas visuales

Las capturas de verificación (VIS-01 a VIS-14) se generan a 360×740 y 1280×800 con datos de fecha y semilla fijos:

```sh
VITE_TEST_HOOKS=1 npx vite build --outDir dist-e2e --emptyOutDir
npm run vis
```

- `npm run vis` no compila: requiere `dist-e2e/` ya construido con ganchos.
- Sirve `dist-e2e/` en el puerto `VIS_PORT` (4393 por defecto).
- Escribe las PNG en `e2e-artifacts/vis/` (o en la ruta pasada como argumento). Requiere chromium instalado (`npm run test:e2e:install`).
- `e2e-artifacts/` está en `.gitignore`.

## Créditos

- **Pokémon Showdown**: sprites Gen 5 animados (`gen5ani`, `gen5ani-back`). Las dependencias `@pkmn/sim`, `@pkmn/dex` y `@pkmn/data` (paquetes de Pokémon Showdown) implementan el motor de combate y los datos.
- **Smogon**: `@smogon/calc`, cálculo de daño.
- **PokeAPI**: nombres en español (CSV de `pokemon_species_names`, `move_names`, `ability_names`, `item_names`, `type_names`).
- **Bulbapedia**: fuente de los equipos de cada torneo (`sourceUrl` de cada variante).
- **Serebii**: contraste de equipos del PWT.
- **WikiDex**: sprites de entrenadores de Negro 2 / Blanco 2 y nombres de referencia.
- **Internet Archive**: copia de los sprites de WikiDex cuando su CDN no responde.
- **hexparrot/pokemon-assets**: `Pokemon-DP.ttf` (MIT), réplica fan de la fuente de Pokémon Diamante/Perla, en `public/fonts/` (`npm run gen:ui`). Provisional hasta sustituirla por una réplica de la de Negro 2 / Blanco 2.
- **Bulbagarden Archives**, **The Spriters Resource** (vía Internet Archive) y **Pokémon Showdown**: gráficos de interfaz de combate de Negro 2 / Blanco 2 (`public/ui/`, ver `data/ui-assets.json`).

## Aviso legal

Daily PWT es un proyecto de fans, no oficial y sin ánimo de lucro. Pokémon y sus nombres son marcas de Nintendo, Creatures Inc., GAME FREAK inc. y The Pokémon Company. Este sitio no está afiliado a ninguna de ellas.

Sin monetización.

## Documentación

- [docs/PRD.md](docs/PRD.md): requisitos de producto, fases y criterios de aceptación.
- [docs/REQUISITOS-F1.md](docs/REQUISITOS-F1.md): requisitos de la fase F1.
- [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md): decisiones técnicas y contratos.
- [docs/PLAN-PRUEBAS-F1.md](docs/PLAN-PRUEBAS-F1.md): casos de prueba de F1.
- [docs/PENDIENTE.md](docs/PENDIENTE.md): trabajo para F2/F3, pendientes menores y cómo sustituir la fuente.
