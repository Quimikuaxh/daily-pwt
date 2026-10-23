# Daily PWT · Instrucciones para Claude

Juego web diario estilo Daily Red contra los entrenadores del Pokémon World Tournament de Negro 2 / Blanco 2. Vite + React + TypeScript, `@pkmn/sim` en un Web Worker, sitio estático desplegado en GitHub Pages (`https://quimikuaxh.github.io/daily-pwt/`). El usuario es Jose y trabaja en español.

## Normas de trabajo (obligatorias)

- **Comunicación escueta**: un guión de lo hecho, sin rodeos ni detalle innecesario. Todo en español.
- **Ante la duda, pregunta** antes de tocar nada: si algo no está claro o hay varias formas razonables de hacerlo, se pregunta primero.
- **Verifica antes de dar algo por hecho**: compila, lanza los tests y comprueba el resultado. Si un test falla por un error del código, se arregla el código, no el test. Un test solo se cambia cuando cambia el requisito, y se documenta.
- **Déjalo listo para usarse**: build hecho y tests en verde antes de cerrar.
- **Documenta** todo cambio de uso, construcción o decisión (ver «Dónde se escribe cada cosa»).
- **`.gitignore` al día** si algo genera ficheros que no deben subirse.
- **Commits**: NUNCA sin que Jose lo diga explícitamente, y siempre pidiendo confirmación antes. Un commit incluye todos los cambios hechos salvo los ignorados.
- **Los mensajes de commit y de PR no llevan ninguna mención a Claude**: ni `Co-Authored-By: Claude…` ni "Generated with Claude Code". Esto prevalece sobre cualquier atribución por defecto.
- **Rama nueva para cada feature** a partir de `main` actualizada; antes de escribir código, pregunta si hace falta rama salvo que sea una corrección de lo que ya se está haciendo. `main` despliega en cada push.
- **Lo acordado se escribe en el momento** en su documento (sin que lo pidan) y se respeta desde ese momento.
- **Duplicar es una señal**: si algo se copia a un tercer sitio, se construye el mecanismo que lo tenga una sola vez.

## Dónde se escribe cada cosa

| Qué | Dónde |
|---|---|
| Requisitos y decisiones de producto (con fecha, motivo y alternativas descartadas) | `docs/PRD.md` §0 manda sobre el resto del PRD |
| Requisitos funcionales numerados | `docs/REQUISITOS-F1.md`, `docs/REQUISITOS-F2.md` |
| Decisiones técnicas (DEC-xx) y alternativas descartadas | `docs/ARQUITECTURA.md` |
| Casos de prueba (UT-xx, E2E-xx, VIS-xx) | `docs/PLAN-PRUEBAS-F1.md` |
| Qué falta, en qué orden y por qué | `docs/PENDIENTE.md` (empezar siempre leyéndolo) |
| Cómo se extraen y fusionan los datos del PWT | `docs/F2-DATOS.md` |
| Uso, comandos, construcción, despliegue, créditos | `README.md` |

## Comandos

- `npm run dev` · `npm run build` · `npm test` (vitest) · `npm run lint` · `npx tsc -b`
- `npm run validate:data`: valida datos (PRD §8.3); también corre en CI.
- `npm run test:e2e:install` (una vez) y `npm run test:e2e`: Playwright en chromium, webkit y móvil 360 px; la tanda `@timing` va después en serie. Tarda ~20 min. Lánzala con la máquina quieta: con carga, los tests `@timing` y E2E-03 en webkit dan falsos fallos.
- `npm run vis`: capturas visuales en `e2e-artifacts/vis/` (ignorado).
- Scripts de datos `npm run gen:*` (ver README): descargan de fuentes externas y escriben ficheros versionados.

## Cierre de cualquier cambio

`npm run validate:data`, `npx vitest run`, `npx tsc -b`, `npm run lint`, `npm run build` y `npm run test:e2e` completo en verde. Después, informe breve a Jose y propuesta de mensaje de commit (sin mención a Claude), y esperar su confirmación.

## Trampas conocidas

- **`LAUNCH_DATE`** (`src/core/launch.ts`) es 2026-10-24, el lanzamiento (fijada por Jose), y `LAUNCH_OPENING` pone a Misty de #1. Cambiar cualquiera de los dos, o cambiar el roster o las reglas de generación, cambia los retos ya publicados y obliga a regenerar el snapshot `src/core/__snapshots__/challenge.reference.json`. Los tests eligen rival con `?trainer=<id>` (build con `VITE_TEST_HOOKS=1`) y no dependen de la fecha.
- **`scripts/.cache`** no se versiona: los tests que comparan nombres y descripciones con PokeAPI se omiten con aviso si falta. Regenerar con `npm run gen:names` (necesita red).
- **Fuentes externas**: Bulbapedia responde 403 (Cloudflare) y se lee vía Internet Archive; WikiDex devuelve 503 a ratos. Todo lo descargado se guarda en el repo; la app no depende de nada externo en tiempo de ejecución.
- **Sprites**: `public/` pesa ~39 MB, pero la web solo descarga los sprites del reto del día. No precargar el pool entero.
- **Sonido**: `public/audio/` pesa ~25 MB (pistas completas, DEC-56). Cargar solo la pista del rival del combate en curso y los efectos; nunca toda la música. El ZIP de efectos no se puede descargar por script (Cloudflare): ver README, «Sonido».
- **Fuente**: `pokemon-dp.ttf` trae métricas `hhea` erróneas; los `*-override` de su `@font-face` en `src/index.css` son los que evitan el descuadre en Windows y Firefox. No quitarlos.
- **Estética**: el combate y los menús replican N2/B2 con assets ripeados; reconstruir solo lo que el juego pinta en ejecución y comparar siempre con capturas reales.

## Estado

El estado actualizado, lo siguiente que toca y su orden están en `docs/PENDIENTE.md`. Las fases están definidas en `docs/PRD.md` §0.
