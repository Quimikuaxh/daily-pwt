# Daily PWT · Pendiente

Solo lo que pasa a F2/F3. El alcance de cada fase está en `PRD.md` §0.

## Para F2
- **Fijar `LAUNCH_DATE`** (`src/core/launch.ts`, provisional 2026-10-17) y regenerar el snapshot `src/core/__snapshots__/challenge.reference.json`. Hay referencias fijas a la fecha en `src/test-utils/dates.ts`, `e2e/support.ts` y `e2e/build.spec.ts` (ver README, "Lanzamiento").
- **Calibrar la dificultad** (PRD §14, criterio 19). Resultado preliminar (INT-14) con el jugador de prueba "mejor daño" y los IV del jugador iguales a los del rival (RF-16): Brock 100 %, Misty 70 %, Camila 70 %, Plubio 50 %, Rojo 0 %. Brock y Rojo siguen fuera del rango 40-80 %; con IV 31 eran Brock 100 %, Misty 90 %, Plubio 60 %, Camila 50 %, Rojo 0 %.
- **Discrepancia de datos:** Stunfisk de Camila (Mundial) lleva Juego Sucio según Bulbapedia y Serebii, Impresionar según WikiDex. Se usa Juego Sucio; confirmar al cargar el roster completo.
- **Pool definitivo del jugador** (PRD §0): sets de Smogon Gen 5 de individuales (Ubers a NU y demás tiers de individuales, sin dobles ni LC; solo objeto, habilidad y movimientos) más los de los rivales del PWT, varios por Pokémon. `npm run gen:player-sets` sobrescribe `data/player-sets.json`; al sustituir el pool, adaptar el test UT-33 (`src/data/generated.test.ts`).
- **Sprites de entrenadores:** el CDN de WikiDex no respondió y los de F1 se obtuvieron de Internet Archive. `scripts/fetch-sprites.mjs` intenta WikiDex primero; comprobar al descargar los 53.

## Para F3
- Etiqueta OFICIAL/PRÁCTICA, reanudar, estadísticas, compartir, Ayuda (con los créditos de fuentes y gráficos) y Ajustes.

## Música de combate (F3, PRD §0)
Fuente: catálogo de `../pokemon-heardle/scripts/catalog/data/catalog.json` (OST de N2/B2 en YouTube). Descargar, recortar el silencio inicial, comprimir (Opus/AAC) y guardar en `public/` con script reproducible y créditos.

| Rival | Pista | YouTube |
|---|---|---|
| Líderes de Kanto | Battle! (Gym Leader - Kanto Version) | `18J3t-I_n68` |
| Líderes de Johto | Battle! (Gym Leader - Johto Version) | `QKrY93YyBfA` |
| Líderes de Hoenn | Battle! (Gym Leader - Hoenn Version) | `31otaUCI-Qg` |
| Líderes de Sinnoh | Battle! (Gym Leader - Sinnoh Version) | `Xn0olebv8Vg` |
| Líderes de Teselia | Battle! (Gym Leader) | `NsZq1ISUB4Y` |
| Campeones de Kanto (Rojo, Azul) | Battle! (Champion - Kanto Version) | `hzXDNA7eZfA` |
| Campeón de Johto (Lance) | Battle! (Champion - Johto Version) | `z_Z-YmQY_Pw` |
| Campeones de Hoenn (Máximo, Plubio) | Battle! (Champion - Hoenn Version) | `ssi6SEg0pxk` |
| Campeona de Sinnoh (Cintia) | Battle! (Champion - Sinnoh Version) | `YeEESIQ-6uY` |
| Campeón de Teselia (Mirto) | **Sin confirmar**: verificar qué tema usa en el PWT; no está en el catálogo del Heardle | — |

Pistas del PWT disponibles para otras pantallas: "PWT - Final Round!" (`70ebcCUXjEE`), "Winning In The PWT!" (`eqgbyzLRsRs`), "PWT Victor!" (`lZOXxRaWDfQ`), "The PWT" (`d2BpRKyuw8A`), "Pokémon World Tournament (PWT)" (`nmo9CHFfV1A`). Antes de implementar, confirmar contra Bulbapedia qué tema suena con cada entrenador en el PWT.

## Animaciones de movimientos (F3, PRD §0)
Propias, en pixel art a la escala del lienzo. No usar las de Pokémon Showdown ni intentar extraer las de la ROM. Definir antes el alcance: animación por movimiento para los más usados en el roster y en el pool del jugador, y una genérica por tipo y categoría (físico, especial, estado) para el resto.

## Despliegue
- **GitHub Pages** (PRD §0). Configurar `base` en `vite.config.ts` con la ruta del repositorio (`/daily-pwt/`), comprobar que sprites, fuentes, assets de `public/` y el Web Worker cargan bajo esa ruta, y añadir el workflow de GitHub Actions que construye y publica `dist/`. Requiere repo remoto en GitHub.

## Pantalla de equipo y de datos
- **Fondo de la pantalla de datos de N2/B2:** el actual es el de Negro/Blanco (limpiado por script de capturas de Bulbagarden Archives). Si aparece un rip limpio de N2/B2, sustituir las URLs de `battle/summary/*` en `data/ui-assets.json` y quitar sus `cleanups`.
- **Descripciones en español:** son de Pokémon X/Y (primera edición con español en PokeAPI), no de N2/B2.
- **Rival:** sin animación de lanzamiento ripeada (los sprites de entrenador son estáticos); la bola sale de una mano estimada a partir del tamaño de su sprite.
- **Cambiar con el activo atrapado o sin banquillo:** el botón sigue desactivado (RF-47), así que en esos casos no se puede abrir el equipo para ver Datos.

## Pendientes menores conocidos
- **Primera línea del registro:** es la frase de desafío de la intro (`¡[Categoría] [Nombre] te desafía!`); los e2e dependen de ello.
- **`translate="no"`** está en los nombres propios de Hoy; revisar que no falte en nombres de entrenadores y Pokémon de otras pantallas.
- **Enlace "saltar al contenido"** solo existe en Hoy.
- **`forced-colors` (alto contraste):** el combate se captura (VIS-14) pero los gráficos ripeados no se adaptan.
- **Navegadores:** Firefox sin probar (se activa con `E2E_FIREFOX=1`); Safari iOS real y móviles modestos, prueba manual.

## Sustituir la fuente (Pokémon Black and White 2 de FontStruct)
1. Deja el TTF en `public/fonts/` con un nombre `[a-z0-9-]+.ttf`, p. ej. `pokemon-bw2.ttf`.
2. En `data/ui-assets.json`, sección `fonts`: cambia `path` y `url` (o quita la `url` y el origen si el fichero ya está en el repo; `scripts/fetch-ui-assets.mjs` valida el nombre y la cabecera TrueType) y actualiza el crédito y la licencia del origen. Borra el TTF antiguo.
3. En `src/index.css`: cambia solo el `src: url("/fonts/...")` de la única `@font-face` (familia "Game"). La variable `--font-game` y todo lo demás no se tocan.
4. Comprueba `ñ`, `¡`, `¿` y las vocales con tilde, y que el 5 y la S se distinguen (PS, PP, niveles y nombres): `npm run vis`, o abre un combate con `?seed=a&ai=trivial` (build con `VITE_TEST_HOOKS=1`).
5. Si cambia el ancho de los glifos, repasa los textos de la caja de mensajes (2 líneas de 240 px) y los de las teselas de movimiento.
6. `npx vitest run` (hay un test que exige una sola `@font-face` y una sola variable) y `npx playwright test e2e/resilience.spec.ts` (comprueba la fuente local).
