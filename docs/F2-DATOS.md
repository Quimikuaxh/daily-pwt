# Daily PWT · F2 · Importación de los equipos del PWT

Proceso reproducible que extrae los equipos de los 53 entrenadores del roster (PRD §7.3) de tres fuentes, los cruza, genera los nodos `Trainer` del esquema de PRD §8.2 y los integra en `data/trainers.json` (DEC-37).

## Uso

```
npm run gen:pwt-raw   # descarga (con caché) + extrae -> data/pwt-raw/{bulbapedia,serebii,wikidex}.json, snapshots.json y merged-report.json
npm run gen:pwt       # fusiona offline -> data/pwt-raw/trainers.generated.json y merge-notes.json
npm run gen:pwt -- --write   # además escribe data/trainers.json (integración; ver «Integración en data/trainers.json»)
```

- `gen:pwt-raw --offline` no usa la red (falla si falta una página en `scripts/.cache/pwt/`); `--refresh` vuelve a descargar todo.
- Ambos pasos son deterministas: repetirlos con la misma caché da ficheros idénticos byte a byte.
- Descarga repartida (9 s entre páginas de Internet Archive, 4 s WikiDex, 2,5 s Serebii), reintentos con espera creciente y `User-Agent` genérico. La caché (`scripts/.cache/`) no se sube a git.
- Si cambian los nombres de una fuente o aparece una grafía que no resuelve, `merged-report.json > unresolvedNames` la lista; se corrige en `data/pwt-raw/name-aliases.json`.

## Integración en `data/trainers.json`

`npm run gen:pwt -- --write` (`scripts/merge-pwt.mjs`, offline) sobrescribe `data/trainers.json` con `{ dataVersion, rosterSchedule, trainers }`:

- `trainers`: los 53 de `trainers.generated.json`, en el orden del roster, con el formato y los campos de F1 (`gender`, `ivs`, `alwaysLeadsWith`, `natureAssumed`/`evsAssumed`, `verified`). Los 6 entrenadores de F1 salen idénticos campo a campo (`merge-notes.json > regression` sin diferencias; el único cambio de su texto es el orden en el fichero).
- `dataVersion`: `f2-1` (era `f1-1`).
- `rosterSchedule`: **una sola entrada** `{ fromDayIndex: 0, trainerIds: [los 53] }`. La bolsa se rebaraja desde el día 0 (ver «Calendario»).
- Tras integrar: `npm run gen` (pool del jugador y datos generados), `npm run gen:sprites` si faltan sprites y, para la fecha, regenerar el snapshot del generador.
- Es editable a mano, pero un nuevo `--write` lo sobrescribe: lo manual va a `name-aliases.json` / `resolutions.json` o al roster (`scripts/lib/pwt-roster.mjs`).

## Calendario: efecto de cambiar el roster o la fecha

Decisión de Jose (DEC-38): los 53 se barajan **todos juntos**, desde el día 0, en la entrada base del `rosterSchedule`; sin restricciones de región, sin los 6 de F1 delante ni entrada posterior.

La bolsa (`src/core/bag.ts`) baraja por ciclos con la semilla `daily-pwt:v1:bag:<ciclo global>`: el rival del día `i` depende solo del índice `i` y del roster, **no de la fecha**; `LAUNCH_DATE` solo fija qué fecha es `i = 0`. Secuencia real (`rivalForDay`) con `LAUNCH_DATE` = 2026-10-24 (lanzamiento, fijado por Jose el 23/10/2026); la columna «6 (F1)» es la secuencia que habría con el roster de F1:

| i · fecha | 6 (F1) | 53 | | i · fecha | 6 (F1) | 53 |
|---|---|---|---|---|---|---|
| 0 · 2026-10-24 | Plubio | Misty (apertura; la bolsa daba Hiedra, que pasa al 45) | | 7 · 2026-10-31 | Misty | Alana |
| 1 · 2026-10-25 | Misty | Fredo | | 8 · 2026-11-01 | Máximo | Junco |
| 2 · 2026-10-26 | Máximo | Antón | | 9 · 2026-11-02 | Plubio | Sachiko |
| 3 · 2026-10-27 | Camila | Mirto | | 10 · 2026-11-03 | | Brock |
| 4 · 2026-10-28 | Rojo | Cintia | | 11 · 2026-11-04 | | Lance |
| 5 · 2026-10-29 | Brock | Plubio | | 12 · 2026-11-05 | | Blanca |
| 6 · 2026-10-30 | Rojo | Inverna | | 13 · 2026-11-06 | | Blaine |

- Máximo toca con 53 en el índice 38 (#39, 2026-12-01). Los demás de F1: Plubio 5, Brock 10, Rojo 17, Camila 33, Misty 45.
- **Fecha fijada (Jose, 23/10/2026): `LAUNCH_DATE = 2026-10-24`**, el día siguiente, con apertura contra Misty (`LAUNCH_OPENING`, Hiedra pasa al índice 45), para que nadie haya visto ningún reto antes del #1 (Misty). *Descartado:* un lanzamiento en el pasado (p. ej. 2026-09-13 para que Máximo tocara antes), porque el contador empezaría en un `#N` alto.
- **Descartadas:** mantener los 6 de F1 delante y añadir los 47 en una entrada posterior (los 6 se repetirían antes de ver a los demás; las entradas exigen frontera de ciclo, `fromDayIndex` múltiplo de 6); una entrada de calendario nueva en fecha futura (deja a los ya publicados intactos pero deja dos entradas y un corte arbitrario); restricciones por región (sesgo que complica la bolsa sin pedirlo el PRD).
- Cambiar `LAUNCH_DATE` desplaza todo: el rival, la variante y el equipo de cada fecha respecto a lo publicado y los números `#N`. Cambiar el roster rebaraja también.

## Fuentes y versión fijada

| Fuente | Páginas | Acceso |
|---|---|---|
| Bulbapedia (principal) | `{Kanto,Johto,Hoenn,Sinnoh,Unova}_Leaders_Tournament`, `World_Leaders_Tournament/{región}` (5), `Champions_Tournament`, `Type_Expert_Tournament/{Tipo}` (17) | Internet Archive (`web.archive.org/web/<captura>id_/...`). La web y la API MediaWiki devuelven HTTP 403 (desafío de Cloudflare) a clientes sin navegador, así que no hay wikitext: se lee el HTML renderizado |
| Serebii | `black2white2/pwt/{kanto,johto,hoenn,sinnoh,unova,worldleaders,champion}.shtml` | Directo. No publica habilidades ni Supertorneo Tipo |
| WikiDex (nombres y habilidades en español) | `Torneo_Líderes_de_{Kanto,Johto,Hoenn,Sinnoh,Teselia}`, `Torneo_Mundial_de_Líderes`, `Torneo_Campeones`, `Supertorneo_Tipo` en `wikidex.net` | Directo. `wikidex.com` redirige a una página de desafío |

Fijación de versión: la captura de Internet Archive de cada página de Bulbapedia queda en `data/pwt-raw/snapshots.json` (se reutiliza al repetir la extracción); cada página de las tres fuentes guarda su `sha256` en `pages[]` de su JSON, de modo que un cambio en la fuente se ve en el diff. Para actualizar una página: borrar su entrada de `snapshots.json` y ejecutar con `--refresh`.

Torneos excluidos (PRD §7.2): Fayenza (Nv. 25), Préstamo, Trueque/Mix Master y los de descarga de 3 Pokémon; no se descargan.

## Ficheros de `data/pwt-raw/`

| Fichero | Contenido | Generado por |
|---|---|---|
| `bulbapedia.json`, `serebii.json`, `wikidex.json` | Un registro por entrenador y torneo, tal como lo publica la fuente (nombres en su idioma): `tournament`, `trainer`, `url`, `alwaysLeadsWith`, `team[]` (`species`, `item`, `abilities`, `moves`, `level`, y `types`/`gender` si los hay). Incluye entrenadores fuera del roster | `import-pwt.mjs` |
| `snapshots.json` | Captura de Internet Archive por página de Bulbapedia | `import-pwt.mjs` |
| `merged-report.json` | Cruce de fuentes por set: `verified`, `single-source` o `discrepancy`, con la lista exacta de discrepancias, cobertura, nombres sin resolver | `import-pwt.mjs` |
| `trainers.generated.json` | `{ trainers: Trainer[] }` en el esquema de PRD §8.2 | `merge-pwt.mjs` |
| `merge-notes.json` | Variantes deduplicadas o descartadas, problemas de `specialtyType`/`alwaysLeadsWith`, nombres españoles que faltan y regresión contra `data/trainers.json` | `merge-pwt.mjs` |
| `name-aliases.json`, `resolutions.json` | Entrada manual versionada (ver abajo) | a mano |

Claves de torneo: `kanto-leaders`, `johto-leaders`, `hoenn-leaders`, `sinnoh-leaders`, `unova-leaders`, `world-leaders`, `champions`, `type-expert:<tipo>`.

## Reglas del cruce

1. **Emparejado.** Por (entrenador del roster, torneo) y por especie base. Los nombres se llevan a ids de `@pkmn` (inglés directo; español por el índice inverso de `src/generated/names-es.json`, tolerante a tildes, mayúsculas y espacios).
2. **Forma de la especie.** Bulbapedia muestra «Rotom» para todas sus formas: se elige la forma de `@pkmn` cuyos tipos coinciden con los mostrados (Rotom Eléctrico/Fuego = `rotomheat`) y, si hay empate, por habilidades. Las formas solo de combate (Castform-Sunny, Darmanitan-Zen) no cuentan. Los ids resultantes pasan la legalidad de movimientos de Gen 5.
3. **Votación por campo** (objeto, habilidades, movimientos, nivel): un valor es firme si lo dan ≥ 2 fuentes que publican ese campo. Serebii no vota habilidades. Con acuerdo parcial gana la mayoría y la discrepancia queda en el informe (`resolution: "majority"`); sin mayoría el set queda `verified: false` y toma el valor de Bulbapedia (`"unresolved"`).
4. **`verified: true`** solo si hay ≥ 2 fuentes para el equipo y todos los campos son firmes. El orden de movimientos y habilidades es el de Bulbapedia (casillas del juego); las habilidades son las dos posibles cuando la fuente da «A o B».
5. **Género.** No se emite `gender`: Bulbapedia solo lo muestra en especies de género fijo (Nidoqueen, Miltank, Hitmontop...; comprobado en `genderOnNonFixedSpecies`, vacío) y WikiDex no lo distingue.
6. **Variantes.** Una por torneo, en el orden Kanto, Johto, Hoenn, Sinnoh, Teselia, Mundial, Campeones, Supertorneo Tipo. Si dos equipos son idénticos (mismas especies, objetos, habilidades y movimientos) se conserva el primero. Id de variante: `<id>-<torneo>` (`brock-kanto-leaders`, `brock-type-expert-rock`); `sourceUrl` apunta a la sección del entrenador en Bulbapedia.
7. **`specialtyType`** de los líderes = tipo del Supertorneo Tipo en el que aparecen (único para los 46). **`alwaysLeadsWith`** = «always leads with» de Bulbapedia, solo si la especie está en todas las variantes.
8. **Campos fijos por entrenador** (`scripts/lib/pwt-roster.mjs`): `id`, nombres, género gramatical, región, categoría e IVs (20 líderes, 25 campeones, 30 Rojo). `sprite` = `id`; los ficheros de sprite de los 47 entrenadores nuevos no existen aún (ver `docs/PENDIENTE.md`). Los sets llevan `natureAssumed` y `evsAssumed` como los ya cargados.

## Entrada manual

- `name-aliases.json`: grafías que no coinciden con el nombre canónico. En `es`: WikiDex usa nombres españoles anteriores a los de PokeAPI («Pañuelo elegido» = Pañuelo Elección, «Cabezahierro» = Cabeza de Hierro, «Canto helado» = Canto Helado/Ice Shard) y trunca algunos («Gafas elegid», «Cinta xperto»). En `en`: Serebii y Bulbapedia escriben «Hi Jump Kick» y Serebii trunca «Thunderpunc» y «Wood Hamme». Solo se añade un alias si el nombre corresponde sin duda a un movimiento, objeto o habilidad (comprobado por el emparejado con la otra fuente).
- `resolutions.json`: desempate manual de un campo sin mayoría. Cada entrada exige `reason` y `evidence`. El campo queda firme y la discrepancia sigue visible en el informe (`resolution: "manual"`).

## Discrepancias abiertas y resueltas

Stunfisk de Camila: Bulbapedia (Mundial de Líderes, Teselia; Supertorneo Tipo Eléctrico) y Serebii (Mundial) dan **Foul Play (Juego Sucio)**; WikiDex da **Astonish (Impresionar)** en ambos torneos. Se usa Foul Play: dos fuentes frente a una en el Mundial, y el Supertorneo Tipo repite el mismo set (resolución manual, sin efecto en los datos porque la variante se deduplica contra el Mundial). Ambos movimientos son legales para Stunfisk en Gen 5, así que la legalidad no decide.

Otras seis discrepancias, todas resueltas por mayoría (la fuente discrepante se indica):

| Entrenador · torneo | Set | Discrepa | Valor adoptado |
|---|---|---|---|
| Roco · Sinnoh | Golem | WikiDex: Trampa Rocas | Roca Afilada (Bulbapedia, Serebii) |
| Mananti · Mundial | Empoleon | Serebii: Hidrobomba | Surf (Bulbapedia, WikiDex) |
| Millo · Teselia | Jumpluff | Serebii repite Espora Algodón y omite Gigadrenado | Gigadrenado |
| Aloe · Mundial | Sawsbuck | Serebii: Retroceso | Patada Salto (Bulbapedia, WikiDex) |
| Yakón · Mundial | Krookodile | Serebii: Roca Afilada | Avalancha (Bulbapedia, WikiDex) |
| Camila · Mundial | Stunfisk | WikiDex: Impresionar | Juego Sucio |

## Nombres del roster (PRD §7.3 frente a WikiDex)

- «Teniente Surge» (PRD): el encabezado de WikiDex en estas páginas es «Lt. Surge»; se mantiene «Teniente Surge» como `nameEs` y `id = teniente-surge`.
- Byron: «Acerón» es el nombre español oficial en Negro 2 / Blanco 2 (el PRD decía «Acero»; corregido). `nameEs = Acerón`, `id = aceron`. Confirmado con WikiDex y la lista de líderes de Sinnoh.
- Vito y Leti son Tate y Liza; el cruce de sus equipos entre fuentes confirma el emparejado.

## Anexo: los 53 entrenadores (`nameEs` en `data/trainers.json`)

| # | id | nameEs | nameEn | Categoría · región | Variantes |
|---|---|---|---|---|---|
| 1 | `brock` | Brock | Brock | Líder · kanto | 2 |
| 2 | `misty` | Misty | Misty | Líder · kanto | 2 |
| 3 | `teniente-surge` | Teniente Surge | Lt. Surge | Líder · kanto | 2 |
| 4 | `erika` | Erika | Erika | Líder · kanto | 2 |
| 5 | `sachiko` | Sachiko | Janine | Líder · kanto | 2 |
| 6 | `sabrina` | Sabrina | Sabrina | Líder · kanto | 2 |
| 7 | `blaine` | Blaine | Blaine | Líder · kanto | 2 |
| 8 | `giovanni` | Giovanni | Giovanni | Líder · kanto | 2 |
| 9 | `pegaso` | Pegaso | Falkner | Líder · johto | 2 |
| 10 | `anton` | Antón | Bugsy | Líder · johto | 2 |
| 11 | `blanca` | Blanca | Whitney | Líder · johto | 2 |
| 12 | `morti` | Morti | Morty | Líder · johto | 2 |
| 13 | `anibal` | Aníbal | Chuck | Líder · johto | 2 |
| 14 | `yasmina` | Yasmina | Jasmine | Líder · johto | 2 |
| 15 | `fredo` | Fredo | Pryce | Líder · johto | 2 |
| 16 | `debora` | Débora | Clair | Líder · johto | 2 |
| 17 | `petra` | Petra | Roxanne | Líder · hoenn | 2 |
| 18 | `marcial` | Marcial | Brawly | Líder · hoenn | 2 |
| 19 | `erico` | Erico | Wattson | Líder · hoenn | 2 |
| 20 | `candela` | Candela | Flannery | Líder · hoenn | 2 |
| 21 | `norman` | Norman | Norman | Líder · hoenn | 2 |
| 22 | `alana` | Alana | Winona | Líder · hoenn | 2 |
| 23 | `vito` | Vito | Tate | Líder · hoenn | 2 |
| 24 | `leti` | Leti | Liza | Líder · hoenn | 2 |
| 25 | `galano` | Galano | Juan | Líder · hoenn | 2 |
| 26 | `roco` | Roco | Roark | Líder · sinnoh | 2 |
| 27 | `gardenia` | Gardenia | Gardenia | Líder · sinnoh | 2 |
| 28 | `brega` | Brega | Maylene | Líder · sinnoh | 2 |
| 29 | `mananti` | Mananti | Crasher Wake | Líder · sinnoh | 2 |
| 30 | `fantina` | Fantina | Fantina | Líder · sinnoh | 2 |
| 31 | `aceron` | Acerón | Byron | Líder · sinnoh | 2 |
| 32 | `inverna` | Inverna | Candice | Líder · sinnoh | 2 |
| 33 | `lectro` | Lectro | Volkner | Líder · sinnoh | 2 |
| 34 | `millo` | Millo | Cilan | Líder · unova | 2 |
| 35 | `zeo` | Zeo | Chili | Líder · unova | 2 |
| 36 | `maiz` | Maíz | Cress | Líder · unova | 2 |
| 37 | `aloe` | Aloe | Lenora | Líder · unova | 2 |
| 38 | `camus` | Camus | Burgh | Líder · unova | 2 |
| 39 | `camila` | Camila | Elesa | Líder · unova | 2 |
| 40 | `yakon` | Yakón | Clay | Líder · unova | 2 |
| 41 | `gerania` | Gerania | Skyla | Líder · unova | 2 |
| 42 | `junco` | Junco | Brycen | Líder · unova | 2 |
| 43 | `lirio` | Lirio | Drayden | Líder · unova | 2 |
| 44 | `cheren` | Cheren | Cheren | Líder · unova | 2 |
| 45 | `hiedra` | Hiedra | Roxie | Líder · unova | 2 |
| 46 | `ciprian` | Ciprián | Marlon | Líder · unova | 2 |
| 47 | `rojo` | Rojo | Red | Campeón · kanto | 1 |
| 48 | `azul` | Azul | Blue | Campeón · kanto | 1 |
| 49 | `lance` | Lance | Lance | Campeón · johto | 1 |
| 50 | `maximo` | Máximo | Steven | Campeón · hoenn | 1 |
| 51 | `plubio` | Plubio | Wallace | Campeón · hoenn | 1 |
| 52 | `cintia` | Cintia | Cynthia | Campeón · sinnoh | 1 |
| 53 | `mirto` | Mirto | Alder | Campeón · unova | 1 |

Variantes: 99 (Kanto 8, Johto 8, Hoenn 9, Sinnoh 8, Teselia 13, Mundial de Líderes 46, Campeones 7). Los 46 líderes tienen exactamente 2 (regional y Mundial); el Supertorneo Tipo repite el equipo del Mundial en los 46 y se deduplica. Los 594 sets están `verified: true` (≥ 2 fuentes).

## Limitaciones

- La verificación detecta errores de transcripción de una fuente, no un error que compartan varias fuentes.
- El Supertorneo Tipo solo tiene dos fuentes (Bulbapedia y WikiDex); en el roster todos sus equipos son idénticos a los del Mundial de Líderes, por lo que no aporta variantes.
- Naturalezas y EVs: ninguna fuente los publica; todos los sets llevan `natureAssumed` y `evsAssumed`.
