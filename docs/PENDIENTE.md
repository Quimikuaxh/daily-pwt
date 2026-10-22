# Daily PWT · Pendiente

Solo lo que pasa a F2/F3. El alcance de cada fase está en `PRD.md` §0.

## Para F2 (resto)
- **Fijar `LAUNCH_DATE` el día del lanzamiento real** (`src/core/launch.ts`, provisional 2026-10-19; decisión de Jose: se cambia a la fecha real cuando se lance la aplicación, no antes) y regenerar el snapshot `src/core/__snapshots__/challenge.reference.json` (README, «Lanzamiento»). Con los 53 barajados juntos, la secuencia depende solo del índice de día: con la fecha actual los días 19 a 21 de octubre son Hiedra, Fredo y Antón (con 6 fueron Plubio, Misty y Máximo) y Máximo toca el día #39 (2026-11-26, `D + 38`). Cambiar fecha o roster cambia lo ya publicado (rival, variante, equipo, `#N`). Propuesta y alternativas descartadas en `docs/F2-DATOS.md`, «Calendario». `scripts/capture-vis.mjs` ya usa `?trainer=` con `e2e/scenarios.json` (DEC-50).
- **Calibrar la dificultad** (PRD §14, criterio 19) con el roster completo. Resultado preliminar (INT-14, solo los 5 de F1) con el jugador de prueba "mejor daño" y los IV del jugador iguales a los del rival (RF-16): Brock 100 %, Misty 70 %, Camila 70 %, Plubio 50 %, Rojo 0 %. Brock y Rojo siguen fuera del rango 40-80 %.
- **Stunfisk de Camila (Mundial):** Juego Sucio según Bulbapedia y Serebii, Impresionar según WikiDex; se usa Juego Sucio (resolución manual en `data/pwt-raw/resolutions.json`).
- **Ruta crítica 230 KB gzip (decidido: se deja así).** Con el roster de 53 el chunk principal pasa a 208 KB (era 182) y la carga sigue < 3 s en 4G (2,1-2,5 s). Optimización futura, solo si hace falta: carga por entrenador (JSON por entrenador, `GameData` asíncrono) o recortar dex/names.
- **Iconos `-mini.png` ausentes (11):** Millo, Zeo, Maíz, Aloe, Camus, Yakón, Gerania, Junco, Lirio, Cintia y Mirto; la API de WikiDex daba 503 y sus páginas en caché no los enlazan. La app no los usa; `TRAINER_MINIS_MISSING_ALLOWED` (`scripts/validate-data.mjs`) los admite. Reintentar con `npm run gen:sprites` y vaciar la lista. Desde la nube no se puede: WikiDex y Internet Archive están bloqueados por la red del entorno (22/10/2026); hay que lanzarlo en local.
- **E2E en CI:** hecho, humo en Chromium (`e2e-smoke`, DEC-50). La batería completa sigue siendo local.

## Orden de trabajo
1. **F3** (sección «Para F3»): estadísticas y rachas (el almacenamiento `daily-pwt:v1` ya guarda el historial por día), compartir, Ayuda (créditos y aviso legal) y Ajustes; después música y efectos de sonido.
2. **Resto de F2** que no depende de Jose: minis de entrenador (en local, ver arriba). E2E en CI y capturas con `?trainer=`, hechos (rama `feature/f2-ci-vis`).
3. **Necesitan a Jose**: calibrar la dificultad (partidas de prueba), verificar en Windows y Safari iOS reales, fijar `LAUNCH_DATE` al lanzar.
4. **Fases futuras**: modo PWT, logros con login; las animaciones de movimientos, lo último.

## Para F3
- **Hecho** (rama `feature/f3-estadisticas`, DEC-47): estadísticas y rachas, compartir.
- **Hecho** (rama `feature/f3-ayuda-ajustes`, DEC-48 y DEC-49): Ayuda, Ajustes (velocidad guardada, borrar datos locales), marco de consola en escritorio, clima en la pantalla táctil con turnos restantes y nombres de la caja de PS alineados al nivel.
- **Aparcado** (`feature/f3-sonido`, decisión de Jose del 22/10/2026): música y efectos de sonido, hasta poder descargarlos (desde la nube YouTube, The Sounds Resource, KHInsider e Internet Archive están bloqueados). Ya decidido: sonido activado por defecto (nada suena hasta la primera interacción), música solo en combate (en Resultado, el jingle de victoria si se gana), silencio y volumen en Ajustes; el tema de Mirto lo confirma Jose al hacer la música.
- **Contrastar con el juego real:** posición y aspecto del indicador de clima (DEC-48).

## Fases futuras (tras F3; PRD §0)
- **Modo PWT:** 7 entrenadores aleatorios seguidos con el mismo equipo. Libre y repetible sin límite (no es diario). Por definir: curación entre combates, si cuenta para estadísticas.
- **Logros con login opcional:** requiere backend (cuentas y almacenamiento); el daily sigue sin cuenta. Con sesión, racha diaria y logros en la cuenta; sin sesión, racha en local. Por definir: servicio, qué logros, migración de las estadísticas locales.

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

## Efectos de sonido (F3, PRD §0)
Golpe supereficaz, poco eficaz y neutro al atacar, y los básicos del combate (lanzar y abrir Poké Ball, debilitado). Ripeados de N2/B2 (p. ej. The Sounds Resource), con script reproducible y créditos. Mismo control de silencio y volumen que la música, y nada suena hasta la primera interacción del usuario.

## Animaciones de movimientos (al final, después de F3; PRD §0)
Propias, en pixel art a la escala del lienzo. No usar las de Pokémon Showdown ni intentar extraer las de la ROM. Definir antes el alcance: animación por movimiento para los más usados en el roster y en el pool del jugador, y una genérica por tipo y categoría (físico, especial, estado) para el resto.

## Pantalla de equipo y de datos
- **Mochila = equipo rival:** hecho (rama `feature/mochila-rival`, DEC-52).
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
- **Navegadores:** Firefox sin probar (se activa con `E2E_FIREFOX=1`); Safari iOS real y móviles modestos, prueba manual.

## Sustituir la fuente (Pokémon Black and White 2 de FontStruct)
1. Deja el TTF en `public/fonts/` con un nombre `[a-z0-9-]+.ttf`, p. ej. `pokemon-bw2.ttf`.
2. En `data/ui-assets.json`, sección `fonts`: cambia `path` y `url` (o quita la `url` y el origen si el fichero ya está en el repo; `scripts/fetch-ui-assets.mjs` valida el nombre y la cabecera TrueType) y actualiza el crédito y la licencia del origen. Borra el TTF antiguo.
3. En `src/index.css`: cambia solo el `src: url("/fonts/...")` de la única `@font-face` (familia "Game"). La variable `--font-game` y todo lo demás no se tocan.
4. Comprueba `ñ`, `¡`, `¿` y las vocales con tilde, y que el 5 y la S se distinguen (PS, PP, niveles y nombres): `npm run vis`, o abre un combate con `?seed=a&ai=trivial` (build con `VITE_TEST_HOOKS=1`).
5. Si cambia el ancho de los glifos, repasa los textos de la caja de mensajes (2 líneas de 240 px) y los de las teselas de movimiento.
6. `npx vitest run` (hay un test que exige una sola `@font-face` y una sola variable) y `npx playwright test e2e/resilience.spec.ts` (comprueba la fuente local).
