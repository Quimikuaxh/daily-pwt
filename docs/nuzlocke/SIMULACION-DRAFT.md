# Simulación y regla del draft de Hoenn

> **12/11/2026:** el draft ya no ofrece especies ni líneas evolutivas que el jugador tiene (PRD §0). El simulador no recluta, así que no aplica esa exclusión: sus informes estudian la ventana del draft y ya no coinciden oferta a oferta con el núcleo (`draftPolicy.test.ts` comprueba la exclusión por su cuenta).

**Regla aprobada por Jose el 11/11/2026: escenario A y ventana proporcional −6 %/+8 % de la media rival de cada hito** (`EMERALD_DRAFT_RATIO`). Corrige el mismo día la ventana absoluta −30/+40: Jose aclaró que «como en el PWT» se refería al tamaño del margen, no a que fuese fijo, y −30/+40 era demasiado margen al principio (con Petra, ±10-13 %). Las tablas absolutas y porcentuales se conservan como comparación de alternativas descartadas; no son la configuración del juego.

Ejecuta la simulación sin red y sin modificar partidas ni datos:

```sh
node scripts/simulate-nuzlocke-draft.mjs --seeds 100 --margins 10,15,20,25 --scenarios A,B,C --prefix calibracion-draft:v1 --out docs/nuzlocke/draft-results-100.json
node scripts/report-nuzlocke-draft.mjs
node scripts/report-nuzlocke-draft.mjs --check
# Regla aprobada: 100 semillas, A, ventana proporcional −6 %/+8 % y control sin garantía.
node scripts/simulate-nuzlocke-draft.mjs --seeds 100 --scenarios A --margins '' --relative 6,8 --out docs/nuzlocke/draft-results-relative-100.json
node scripts/report-nuzlocke-draft.mjs --section relative
# Descartada (11/11/2026): ventana absoluta −30/+40.
node scripts/simulate-nuzlocke-draft.mjs --seeds 100 --scenarios A --margins '' --absolute 30,40 --out docs/nuzlocke/draft-results-absolute-100.json
node scripts/report-nuzlocke-draft.mjs --section absolute
node scripts/report-nuzlocke-draft.mjs --section absolute --check
```

El resultado JSON registra revisión de Esmeralda, SHA-256 de los tres catálogos, versión del calendario, parámetros y prefijo de semillas. Usa los mismos archivos y argumentos para reproducirlo byte a byte. Sin `--out`, imprime el JSON en la salida estándar; usa `node scripts/simulate-nuzlocke-draft.mjs` directamente si necesitas redirigirlo sin la cabecera de npm. La evidencia de este informe es [draft-results-100.json](draft-results-100.json), conservada en el repositorio para revisión y futura confirmación; los resultados desechables de otras pasadas deben guardarse fuera del repositorio. Las tablas se generan desde ese JSON entre marcadores, sin sobrescribir la explicación ni la propuesta. La ventana aprobada tiene su propia evidencia persistente en [draft-results-absolute-100.json](draft-results-absolute-100.json). El generador admite `--input`, `--report`, `--section percent|absolute` y `--check`; este último detecta tablas desactualizadas sin escribir. Regenera el JSON y luego las tablas al cambiar catálogos o métricas; no edites sus cifras a mano. El lanzador transforma TypeScript con Vite en modo middleware, con observadores y WebSocket desactivados: no construye la aplicación ni abre un puerto.

## Escenarios de disponibilidad

El escenario A es la política aprobada. B y C se mantienen solo como controles del informe. Usa [el calendario de Jose](CALENDARIO-MT.md) y la revisión fija de Esmeralda. Los tipos y las sumas base proceden de los datos Gen 3 de la dependencia fijada, incluidos en el catálogo reproducible de progresión; no uses los tipos de generaciones posteriores.

- **A, forma viable entrenada.** Recorre desde las formas sin preevolución toda la trayectoria legal hasta el tope del encuentro. Resuelve las evoluciones por nivel cuyo umbral ya se ha alcanzado y conserva las alternativas de ramas. No mantiene una forma que ya tendría evolución automática por nivel. Las evoluciones especiales son opcionales: mantiene tanto la forma previa como la especial disponible. Habilita objetos en su fecha del recorrido habitual, intercambio desde Petra cuando también esté disponible la preevolución, amistad desde Candela (tres victorias potenciales desde Petra), y belleza desde Alana. Reconstruye una trayectoria con sus niveles de evolución; varias trayectorias que converjan cuentan como una sola especie. Wurmple aporta ambas ramas potenciales; Tyrogue, sus tres opciones desde nivel 20. Shedinja es elegible de forma independiente desde nivel 20, sin añadir un recluta gratuito.
- **B, bases y evolución por nivel.** Conserva las formas base y las formas intermedias/finales alcanzables por una trayectoria compuesta exclusivamente de evoluciones por nivel al tope del combate. Conserva también las bases cuyo umbral ya se alcanzó. Una evolución por nivel posterior a una condición especial inaccesible no habilita la especie. No incluye piedra, objeto, intercambio, amistad ni belleza. Incluye las ramas por nivel y Shedinja desde su umbral.
- **C, cualquier forma.** Incluye las 386 especies sin restricciones de evolución. Cuenta especies ofrecidas; no normaliza ni fusiona preevoluciones que el núcleo pudiera evolucionar automáticamente al reclutarlas. Sirve para medir el efecto de retirar el filtro de disponibilidad.

En A, disponibilidad significa posibilidad de alcanzar una forma, no que cualquier recluta nuevo pueda evolucionar inmediatamente. No simula los contadores de miembros concretos ni objetos ya gastados. Une las alternativas excluyentes del Escáner como posibilidades; no concede ambos premios en una partida. No consume objetos al mostrar ofertas. Estas limitaciones impiden interpretar los resultados como una simulación completa de plantillas o de dificultad de combate.

## Métricas y comparación

Para cada escenario y ventana (porcentual simétrica o absoluta), ejecuta los mismos N identificadores de semilla con la garantía activada y desactivada. La media de estadísticas base rival procede de `campaignDraftRequest`, compartido con `openDraft`: media por Pokémon en gimnasios y media de las cinco medias de equipos para la Liga. Hay nueve hitos de draft: ocho gimnasios y una entrada a la Liga al nivel de Sixto. No añade ofertas entre los cinco combates de Liga.

Cada semilla recorre cuatro ofertas iniciales, dos por gimnasio posterior y tres al entrar en la Liga (`draftPicks`; Jose, 11/11/2026), conserva la última oferta entre hitos y no simula combates ni elecciones. Al fallar un sorteo, detiene esa trayectoria; consulta `reachedSeeds` antes de comparar hitos posteriores. Los pools anteriores a exclusiones se calculan para todos los hitos, aunque ninguna trayectoria llegue a ellos.

- `poolBeforeExclusions`, `poolAfterExclusions`: especies dentro del margen antes y después de excluir la oferta anterior; el segundo da mínimo, mediana, media y máximo observados. La mediana es exacta sobre las observaciones de todos los sorteos del hito; si hay un número par de observaciones, usa la media de los dos valores centrales.
- `counterPoolBeforeExclusions`, `counterPoolAfterExclusions`: especies de esos pools con tipo propio supereficaz. No son filtros que reduzcan todos los candidatos a ese subconjunto: los otros tres candidatos pueden tener cualquier tipo.
- `possibleUnorderedOffers`, `permittedUnorderedOffers`: número de cuartetos distintos sin y con la restricción activa en cada sorteo. Si hay n especies y c supereficaces, la última oferta pendiente permite C(n,4) − C(n−c,4) cuartetos. `removedOfferFractionWhenForced` mide la proporción descartada solo cuando se fuerza cobertura; `forcedOffers` cuenta esas ocasiones.
- `counterPoolWhenForced`: candidatos supereficaces disponibles solo en las ofertas que requieren forzar cobertura. Un cero en otra oferta no implica fallo del tramo si ya ofreció cobertura.
- `offersWithAlternativeQuartets`: ofertas cuyo pool y restricciones permiten más de un cuarteto distinto. No mide las opciones del jugador dentro de una oferta.
- `offersWithMultipleFamilies`, `offersWithFourFamilies`: ofertas obtenidas con al menos dos familias evolutivas y con cuatro familias distintas. Define familia por las especies conectadas por evolución, incluidas todas sus ramas. Es una definición analítica explícita de alternativas distintas, no una valoración competitiva: no asegura movimientos útiles, roles distintos ni buenas opciones contra el rival. Las cuatro especies distintas ya son un invariante aparte.
- `repeatedSpeciesSlotsEarlierInSegment`: plazas de especies ya ofrecidas en el mismo tramo, sin contar la propia oferta. Solo puede ser positivo antes de Petra: en los otros hitos hay dos ofertas y se excluye la anterior.
- `validFourDistinctOffers`, `failedOffers`, `failures`: ofertas válidas, fallidas y hasta cinco ejemplos reproducibles. No rellena ofertas, amplía márgenes ni reutiliza la oferta anterior ante escasez.
- `coveredSegments`, `completedSegments`: tramos que ofrecieron cobertura y tramos completados. La cobertura de Liga no aplica.
- `uniqueOfferedSpecies`, `speciesCounts`: diversidad y frecuencia por especie. `uniqueOfferSets` y `duplicateOfferSets` cuentan cuartetos ignorando su orden, agregados entre semillas y elecciones del hito.
- `repeatedSpeciesSlotsEarlierInCampaign`: apariciones de especies que ya salieron en una oferta anterior de esa semilla, sin contar la propia oferta. `repeatedSlotsInPreviousOffer` debe ser cero. Se permite repetir especies de ofertas no adyacentes, incluidos descartes y reclutas anteriores.
- `typeCounts`: apariciones de cada tipo propio. Un Pokémon de dos tipos suma uno a cada tipo; divide entre `offeredSlots`, por lo que la suma de porcentajes puede superar el 100 %.
- `offerAverageBST`, `averageBSTDelta`, `averageBSTRatio`: rango de medias de ofertas, diferencia media y cociente respecto a la referencia rival. Son indicadores de estadísticas base, no tasas de victoria: no modelan velocidad, habilidades, movimientos, debilidades dobles ni decisiones del jugador.

## Garantía del núcleo

La regla de producto y su motivo están en [PRD §0, 11/11/2026](../PRD.md). Registra `draftTypeCovered` al abrir una oferta del tramo con cobertura, aunque el jugador elija otro candidato. Persiste ese booleano y reinícialo al avanzar de gimnasio. Si falta cobertura en la última oferta, `draftOffer` sortea uniformemente entre los cuartetos que contienen al menos un candidato válido. Usa pesos hipergeométricos para no sesgar a favor de cuartetos con varios supereficaces; no reserva una plaza en cada oferta ni cambia las anteriores.

Sin condición, conserva el sorteo determinista v1. Ambos caminos conservan el margen y la exclusión de la oferta anterior, y fallan explícitamente si no pueden cumplirlos. No altera el sorteo diario. El mapa de gimnasios y los tipos usados están en `src/core/nuzlocke/gymDraft.ts`; sus pruebas contrastan las debilidades con la tabla Gen 3.

Los registros locales anteriores pueden carecer del booleano. Al generar una oferta posterior, considera también la oferta previa del mismo tramo; si no puede acreditar cobertura anterior, garantiza la última conservadoramente. Conserva una oferta ya abierta sin volver a sortearla, también si procede de reglas anteriores; la garantía se acredita en los tramos generados íntegramente bajo la regla del 11/11/2026. No cambies una oferta persistida silenciosamente.

## Entrega D3(a) · 11/11/2026

La pasada exploratoria de 100 semillas por combinación, prefijo `calibracion-draft:v1`, compara A/B/C con ±10/15/20/25 % y ambos brazos de cobertura. No registra fallos: 48 000 ofertas válidas de cuatro candidatos, ninguna repetición con la oferta inmediatamente anterior. Con garantía, completa y cubre los 800 tramos de gimnasio por combinación. El menor pool antes de exclusiones es A/±10 % en Marcial: 40 especies. Las tablas porcentuales se conservan más abajo como comparación de D3(b); la regla absoluta aprobada de D3(c) las sustituye para el juego.

`openDraft(definition, state)` aplica A y `EMERALD_DRAFT_WINDOW` en Esmeralda sin recibir límites del llamador. Si un consumidor anterior suministra especies o límites, no pueden sustituir la política de Esmeralda. Las campañas genéricas conservan sus parámetros explícitos. `campaignDraftRequest` y `draftOffer` son primitivas parametrizadas para análisis y otras campañas, no sustitutos de la entrada de producto.

Verificación de esta entrega: 44 tests focalizados pasan en seis ficheros (17 nuevos), con `--pool=threads --maxWorkers=1`; la regeneración local del catálogo de progresión y `git diff --check` pasan. La CLI se ha ejecutado también con WebSocket desactivado, sin abrir puertos. D3(a) se verificó solo con tests focalizados por la restricción de carga; las comprobaciones completas se acreditan en D3(c), sin atribuirlas a esa tanda focalizada.


## Regla aprobada · ventana proporcional −6 %/+8 % (Jose, 11/11/2026)

Cada candidato, entre la media rival × 0,94 y la media rival × 1,08 (límites inclusivos), escenario A. Tamaño de `BST_WINDOW_1` del PWT (−180/+240 sobre la suma de seis) respecto a la mediana de las sumas de los 99 equipos de seis del PWT, 2983 (`data/trainers.json`, estadísticas base Gen 5 de `@pkmn/dex`): −6,0 % / +8,0 %. Proporcional para que el margen crezca con el nivel del rival en lugar de ser ancho al principio y estrecho al final.

Resultado con 100 semillas (tablas abajo): ningún fallo; pool mínimo tras exclusiones **18 en Marcial** (mediana 20) y 35 o más en el resto. **Erico** solo tiene **dos** candidatos de tipo propio supereficaz en su pool (antes de exclusiones), así que la garantía se fuerza en 77 de 100 tramos: casi siempre sale uno de esos dos. No es un fallo, pero sí el tramo más concentrado; si se quiere más variedad ahí, la opción sería ampliar solo la cobertura de tipo de ese hito (no decidido).

<!-- draft-relative:start -->
JSON fuente: SHA-256 `dd85d8fdf2717490d68563d304d2b898dd156051e4fca4e72d284bd7815a035c`. Muestra: **100 semillas por combinación**; ventanas **−6 %/+8 %**; escenarios **A**.

Lectura común de las tablas por hito: «Otras ofertas» cuenta sorteos con más de un cuarteto legal posible; «Familias ≥2 / 4» cuenta ofertas con al menos dos familias y con cuatro familias distintas. «Rep.» son plazas de especies vistas en ofertas anteriores de la misma semilla / plazas del hito. «BST/rival» es la media ofrecida relativa a la referencia rival. «Tipos» muestra los dos más presentes por plaza, contando ambos tipos propios. Todas estas columnas describen el brazo con garantía.

En las tablas de garantía, «Sin/con» compara los tramos cubiertos con la regla desactivada/activada. «Forzada» indica la fracción de tramos alcanzados en que se condicionó la última oferta; «Cuartetos retirados» es la reducción media solo en esas ofertas. «Supereficaces mín.» cuenta candidatos de tipo válido al forzar: basta uno, no cuatro. «—» indica que no se forzó o que no hay observaciones, según la columna. La Liga no tiene garantía.

### Comparación global con garantía

Pool mínimo tras exclusiones; alternativas y repeticiones agregadas sobre todas las ofertas o plazas de los nueve hitos, según la columna. Familias ≥2/4 muestra dos recuentos: ofertas con al menos dos familias y ofertas con cuatro familias distintas.

| Escenario | Margen | Pool mín. | Ofertas válidas / intentos | Con otros cuartetos | Familias ≥2 / 4 | Reapariciones / plazas | Fallos |
| --- | --- | --- | --- | --- | --- | --- | --- |
| A | −6 %/+8 % | 18 | 2100 / 2100 | 2100 | 2100 / 2087 | 9.2 % | 0 |

### Escenario A: pool por hito

Cada celda es **mínimo / mediana** de especies tras excluir la oferta anterior, con garantía. Se agregan todas las ofertas y semillas del hito, no las medianas de subgrupos.

| Hito | −6 %/+8 % |
| --- | --- |
| Petra | 41 / 41 |
| Marcial | 18 / 20 |
| Erico | 41 / 43 |
| Candela | 35 / 35 |
| Norman | 56 / 58 |
| Alana | 62 / 62 |
| Vito y Leti | 80 / 80 |
| Galano | 67 / 67 |
| Liga (Sixto) | 93 / 93 |

#### A · −6 %/+8 %: elecciones, repetición y estadísticas

| Hito | Válidas | Otras ofertas | Familias ≥2 / 4 | Rep. | BST/rival | Tipos más presentes |
| --- | --- | --- | --- | --- | --- | --- |
| Petra | 400 | 400 | 400 / 400 | 7.3 % | 99.8 % | Agua 33.5 %; Planta 17.0 % |
| Marcial | 200 | 200 | 200 / 200 | 0.0 % | 102.5 % | Normal 28.0 %; Agua 24.0 % |
| Erico | 200 | 200 | 200 / 198 | 0.0 % | 102.0 % | Bicho 25.8 %; Planta 15.1 % |
| Candela | 200 | 200 | 200 / 198 | 6.0 % | 101.3 % | Bicho 25.4 %; Roca 20.8 % |
| Norman | 200 | 200 | 200 / 198 | 0.0 % | 100.3 % | Normal 17.4 %; Lucha 16.6 % |
| Alana | 200 | 200 | 200 / 199 | 6.9 % | 102.0 % | Normal 22.8 %; Volador 19.0 % |
| Vito y Leti | 200 | 200 | 200 / 198 | 13.3 % | 100.9 % | Normal 19.6 %; Agua 18.1 % |
| Galano | 200 | 200 | 200 / 199 | 20.5 % | 101.7 % | Normal 25.0 %; Volador 21.4 % |
| Liga (Sixto) | 300 | 300 | 300 / 297 | 23.6 % | 100.4 % | Agua 20.8 %; Normal 15.5 % |

#### A · −6 %/+8 %: efecto de la garantía por tramo

| Gimnasio | Cobertura sin / con | Forzada | Cuartetos retirados | Supereficaces mín. | Tramos completados |
| --- | --- | --- | --- | --- | --- |
| Petra | 100.0 % / 100.0 % | 0.0 % | — | — | 100 / 100 |
| Marcial | 93.0 % / 100.0 % | 34.0 % | 23.4 % | 5 | 100 / 100 |
| Erico | 38.0 % / 100.0 % | 77.0 % | 81.2 % | 2 | 100 / 100 |
| Candela | 96.0 % / 100.0 % | 27.0 % | 24.2 % | 10 | 100 / 100 |
| Norman | 69.0 % / 100.0 % | 55.0 % | 53.0 % | 8 | 100 / 100 |
| Alana | 70.0 % / 100.0 % | 56.0 % | 44.8 % | 11 | 100 / 100 |
| Vito y Leti | 65.0 % / 100.0 % | 57.0 % | 51.5 % | 12 | 100 / 100 |
| Galano | 73.0 % / 100.0 % | 57.0 % | 51.5 % | 10 | 100 / 100 |

### Escasez y cobertura

Ninguna combinación presenta un pool menor de cuatro, antes ni después de exclusiones, en los hitos observados.
Todos los gimnasios tienen candidatos de tipo propio válido en el pool inicial.
Repeticiones con la oferta inmediatamente anterior: **0**. Fallos con garantía: **0**.
<!-- draft-relative:end -->

## Regla anterior D3(c) · descartada el 11/11/2026

Fija A con **cada candidato entre media rival −30 y media rival +40**, con límites inclusivos. No es un porcentaje ni una ventana sobre la suma de los cuatro candidatos. Es la ventana anterior RF-13d del PWT, `BST_WINDOW_1` (−180/+240 por equipo de seis), dividida entre seis. Usa la media por Pokémon del gimnasio y, para la Liga, la media de las cinco medias por equipo que devuelve `campaignDraftRequest`. Descarta `BST_WINDOW_2` por Pokémon (−15/+45): su centro desplazado hacia arriba compensa el sorteo de equipo del PWT; en esta campaña el jugador elige Pokémon y ataques.

Descarta los porcentajes ±10/15/20/25 % porque su amplitud cambia con la media rival y Jose prefiere un margen absoluto por Pokémon más centrado. Descarta B y C porque A conserva las trayectorias viables y el calendario aprobado. No ajusta el margen por gimnasio ni amplía automáticamente la ventana para satisfacer el tipo: si no hay cuatro candidatos o cobertura posible, informa del error.

### Lectura de la ventana absoluta

Las 100 semillas producen **4 000 ofertas válidas**, sumando 2 000 con garantía y 2 000 de control; cero fallos y cero repeticiones con la oferta inmediatamente anterior. Con garantía se cubren los 800 tramos de gimnasio. El pool mínimo tras exclusiones es **50 en Marcial** (mediana 50): su pool estático de 54 deja al menos 50 al excluir cualquier oferta de cuatro. No hay hitos con menos de cuatro candidatos ni gimnasios sin tipo propio supereficaz viable.

**Erico:** referencia 391,25; límites absolutos 361,25–431,25. El pool tras exclusiones tiene mínimo 51 y mediana 53. Los cuatro candidatos de Tierra son Gligar, Marshtomp, Onix y Quagsire; se fuerza la última oferta en 76/100 tramos, retirando el 71,37 % de cuartetos posibles solo en esas ofertas. Frente a A/±10 %, el pool mínimo de Erico baja de 59 a 51, conserva los cuatro candidatos de cobertura y reduce la intervención observada de 80 a 76 tramos. No queda justo para las cuatro plazas; sigue siendo el caso más concentrado en cobertura.

El centro aritmético de −30/+40 es rival +5, pero la distribución discreta de especies y la garantía no aseguran una media ofrecida de +5. En esta muestra, el mayor incremento medio es Candela, +14,69 puntos, y Petra queda −4,29. Son descripciones del muestreo, no tasas de victoria ni un motivo para cambiar unilateralmente la ventana aprobada. Las tablas completas siguientes muestran el efecto en todos los hitos.

### Trayectoria e inventario al reclutar

Comparte `availableDraftForms` entre el núcleo y el simulador; Esmeralda fija siempre A. Mantiene las formas especiales opcionales cuando su calendario las permite, amistad potencial desde Candela, intercambio desde el primer hito con la preevolución viable, belleza desde Alana y la unión de alternativas del Escáner. Mostrar o reclutar una forma ya evolucionada no gasta una unidad del inventario; evolucionar posteriormente desde una preevolución sí sigue el consumo de D2.

Persiste la trayectoria canónica de preevoluciones y `recruitmentHistoryLength`, el número de transiciones reconstruidas anteriores al reclutamiento. Ese prefijo justifica los movimientos heredados, pero `consumedEvolutionItems` solo cuenta las transiciones posteriores. Valida que el prefijo sea un entero no negativo que no supere el historial. Los guardados sin el campo conservan la interpretación anterior (cero); no reescribas ni vuelvas a sortear ofertas ya abiertas de reglas anteriores. La garantía se acredita para tramos generados íntegramente bajo las reglas aprobadas.

La estabilidad se comprueba con 100 semillas en los nueve tramos: cuatro candidatos distintos, límites absolutos, exclusión de toda la oferta anterior, cobertura por gimnasio, reanudación y frecuencias idénticas entre el núcleo y la evidencia del simulador. La Liga conserva su referencia de cinco equipos y no exige tipo. Las pruebas genéricas de ventanas parametrizadas permanecen; las pruebas de gimnasio que antes inyectaban pools/límites se adaptan porque el nuevo requisito impide sustituir la política del producto.

Fuente persistente de las tablas absolutas: [draft-results-absolute-100.json](draft-results-absolute-100.json). Las tablas de porcentajes se conservan en la sección de comparación histórica.

<!-- draft-absolute:start -->
JSON fuente: SHA-256 `674261f4c308f02f63e14a32c8db0af1e325f336d526d7c47739213cb5008325`. Muestra: **100 semillas por combinación**; ventanas **−30/+40**; escenarios **A**.

Lectura común de las tablas por hito: «Otras ofertas» cuenta sorteos con más de un cuarteto legal posible; «Familias ≥2 / 4» cuenta ofertas con al menos dos familias y con cuatro familias distintas. «Rep.» son plazas de especies vistas en ofertas anteriores de la misma semilla / plazas del hito. «BST/rival» es la media ofrecida relativa a la referencia rival. «Tipos» muestra los dos más presentes por plaza, contando ambos tipos propios. Todas estas columnas describen el brazo con garantía.

En las tablas de garantía, «Sin/con» compara los tramos cubiertos con la regla desactivada/activada. «Forzada» indica la fracción de tramos alcanzados en que se condicionó la última oferta; «Cuartetos retirados» es la reducción media solo en esas ofertas. «Supereficaces mín.» cuenta candidatos de tipo válido al forzar: basta uno, no cuatro. «—» indica que no se forzó o que no hay observaciones, según la columna. La Liga no tiene garantía.

### Comparación global con garantía

Pool mínimo tras exclusiones; alternativas y repeticiones agregadas sobre todas las ofertas o plazas de los nueve hitos, según la columna. Familias ≥2/4 muestra dos recuentos: ofertas con al menos dos familias y ofertas con cuatro familias distintas.

| Escenario | Margen | Pool mín. | Ofertas válidas / intentos | Con otros cuartetos | Familias ≥2 / 4 | Reapariciones / plazas | Fallos |
| --- | --- | --- | --- | --- | --- | --- | --- |
| A | −30/+40 | 50 | 2100 / 2100 | 2100 | 2100 / 2093 | 9.5 % | 0 |

### Escenario A: pool por hito

Cada celda es **mínimo / mediana** de especies tras excluir la oferta anterior, con garantía. Se agregan todas las ofertas y semillas del hito, no las medianas de subgrupos.

| Hito | −30/+40 |
| --- | --- |
| Petra | 77 / 77 |
| Marcial | 50 / 50 |
| Erico | 51 / 53 |
| Candela | 58 / 58 |
| Norman | 56 / 58 |
| Alana | 83 / 83 |
| Vito y Leti | 94 / 94 |
| Galano | 80 / 80 |
| Liga (Sixto) | 93 / 93 |

#### A · −30/+40: elecciones, repetición y estadísticas

| Hito | Válidas | Otras ofertas | Familias ≥2 / 4 | Rep. | BST/rival | Tipos más presentes |
| --- | --- | --- | --- | --- | --- | --- |
| Petra | 400 | 400 | 400 / 400 | 3.3 % | 98.7 % | Agua 26.9 %; Planta 14.4 % |
| Marcial | 200 | 200 | 200 / 200 | 7.6 % | 104.7 % | Normal 23.6 %; Agua 18.3 % |
| Erico | 200 | 200 | 200 / 200 | 0.8 % | 102.9 % | Bicho 19.3 %; Veneno 16.9 % |
| Candela | 200 | 200 | 200 / 200 | 10.8 % | 104.0 % | Agua 18.1 %; Bicho 17.3 % |
| Norman | 200 | 200 | 200 / 198 | 0.0 % | 100.3 % | Normal 17.4 %; Lucha 16.6 % |
| Alana | 200 | 200 | 200 / 200 | 10.6 % | 101.3 % | Normal 22.5 %; Agua 15.9 % |
| Vito y Leti | 200 | 200 | 200 / 199 | 10.3 % | 102.4 % | Agua 19.9 %; Normal 17.9 % |
| Galano | 200 | 200 | 200 / 199 | 17.6 % | 102.0 % | Normal 21.8 %; Volador 19.0 % |
| Liga (Sixto) | 300 | 300 | 300 / 297 | 24.0 % | 100.4 % | Agua 21.0 %; Normal 14.5 % |

#### A · −30/+40: efecto de la garantía por tramo

| Gimnasio | Cobertura sin / con | Forzada | Cuartetos retirados | Supereficaces mín. | Tramos completados |
| --- | --- | --- | --- | --- | --- |
| Petra | 100.0 % / 100.0 % | 0.0 % | — | — | 100 / 100 |
| Marcial | 84.0 % / 100.0 % | 40.0 % | 35.7 % | 11 | 100 / 100 |
| Erico | 45.0 % / 100.0 % | 76.0 % | 71.4 % | 4 | 100 / 100 |
| Candela | 94.0 % / 100.0 % | 29.0 % | 21.5 % | 18 | 100 / 100 |
| Norman | 69.0 % / 100.0 % | 55.0 % | 53.0 % | 8 | 100 / 100 |
| Alana | 75.0 % / 100.0 % | 47.0 % | 49.9 % | 13 | 100 / 100 |
| Vito y Leti | 86.0 % / 100.0 % | 50.0 % | 44.4 % | 17 | 100 / 100 |
| Galano | 80.0 % / 100.0 % | 42.0 % | 40.2 % | 16 | 100 / 100 |

### Escasez y cobertura

Ninguna combinación presenta un pool menor de cuatro, antes ni después de exclusiones, en los hitos observados.
Todos los gimnasios tienen candidatos de tipo propio válido en el pool inicial.
Repeticiones con la oferta inmediatamente anterior: **0**. Fallos con garantía: **0**.
<!-- draft-absolute:end -->

## Comparación D3(b) · 11/11/2026 · alternativas descartadas

### Lectura para decidir

**Propuesta D3(b) descartada por Jose: A con ±10 %. La regla aprobada es A con −30/+40.** Conserva la progresión de formas al nivel y los desbloqueos del calendario. En las 100 semillas, cada combinación produce 2 000 ofertas con garantía: 400 antes de Petra y 200 en cada hito posterior. Se comparan 12 combinaciones y sus 12 controles sin garantía: 48 000 ofertas en total. Los 800 tramos de gimnasio por combinación con garantía quedan cubiertos, sin ampliar márgenes ni repetir la oferta anterior.

A/±10 % tiene un mínimo de 36 candidatos tras exclusiones, y 1 991 de sus 2 000 ofertas reúnen cuatro familias distintas (99,55 %); las 2 000 ofrecen al menos dos familias. Las medias de estadísticas base por hito están entre el 98,09 % y el 103,32 % de la referencia rival. No falta amplitud para ofrecer cuatro candidatos distintos. Además, el menor pool estático es de 40 especies: excluir las cuatro de cualquier oferta anterior deja al menos 36, con independencia de la semilla. Esta cota solo acredita tamaño, no dificultad de combate ni disponibilidad en una partida con recursos consumidos.

**Alternativa A/±15 %:** eleva el mínimo a 54 y reduce las reapariciones agregadas del 9,36 % al 8,79 % de plazas. A cambio, amplía la desviación permitida y las medias por hito quedan entre 96,88 % y 103,76 % del rival. No mejora de forma sistemática la cobertura natural: Erico pasa de cuatro candidatos de Tierra a cinco, pero la fracción de cuartetos retirada al forzar pasa de 74,94 % a 77,11 % porque crece más el resto del pool. Norman necesita forzar en 75 de 100 tramos frente a 62 con ±10 %. El aumento del margen por sí solo no resuelve una escasez relativa de tipos.

**Punto de atención: Erico en A/±10 % y B/±10 %.** El pool general mínimo es de 59 especies, pero solo cuatro tipos de candidato cubren el gimnasio eléctrico: en A son Gligar, Marshtomp, Onix y Quagsire. Son cuatro especies, no cuatro tipos elementales: todas cuentan por Tierra. En A se fuerza la última oferta en 80 de 100 tramos y se elimina el 74,94 % de los cuartetos posibles en esas ocasiones. Ningún tramo queda sin candidato; basta incluir uno de los cuatro. Es el caso más concentrado que conviene revisar al jugar, aunque no está al límite del mínimo de cuatro de la oferta. Las tablas distinguen esta concentración de un pool general insuficiente.

**Alternativas de escenario:** B/±10 % tiene un mínimo de 44 candidatos y 1 996 ofertas con cuatro familias, pero deja fuera amistad, intercambio, belleza y objetos aun cuando estén disponibles; además conserva bases cuyo umbral de evolución ya pasó. C/±10 % alcanza un mínimo de 48 y 1 996 ofertas con cuatro familias, pero admite formas sin trayectoria posible al nivel y recursos de evolución aún cerrados. No propongo B ni C como referencia porque su pequeña ganancia de diversidad observada cambia el criterio de progresión del encargo. ±20 % y ±25 % amplían pools sin cubrir una necesidad de disponibilidad; en A/±25 % la media de Marcial llega al 108,23 % del rival. Mantenerlos como alternativas si Jose prefiere más dispersión de estadísticas, sin describirla como mayor o menor dificultad demostrada.

La garantía reduce **cero especies** del pool general del mismo estado: restringe las combinaciones de cuatro en la última oferta pendiente. Al cambiar ofertas previas puede variar el pool observado de sorteos posteriores entre el control y el brazo con garantía; esa diferencia corresponde a la exclusión de las cuatro especies anteriores, no a un nuevo veto. La comparación sin/con usa los mismos identificadores de semillas, pero sus trayectorias pueden divergir desde el primer sorteo condicionado. La cobertura de la tabla se divide entre tramos completados; consulta también los tramos alcanzados del JSON si se añaden márgenes que fallen.

**Alcance del escenario A aprobado:** la disponibilidad de formas se interpreta como viabilidad potencial al hito, según la definición anterior. A une premios excluyentes del Escáner, supone objetos no gastados y una amistad potencial desde los primeros reclutas; no concede esos recursos a una partida. Las trayectorias se usan para decidir disponibilidad, no para valorar los movimientos elegidos ni para simular reclutamiento. Los conteos de familias tampoco normalizan las formas que evolucionaría el núcleo al reclutarlas en B/C. No hay tasas de victoria, simulación de bajas ni demostración de que cuatro candidatos sean igual de útiles. Las proporciones empíricas corresponden solo a esta serie de 100 semillas; no extrapolar sus decimales como precisión estadística o dificultad real.

### Tablas reproducibles

Fuente persistente: [JSON de resultados, 100 semillas](draft-results-100.json). Incluye ambos brazos, frecuencias completas de especies y tipos, mínimos/medianas/medias/máximos, parámetros y hashes de catálogos. Las tablas siguientes resumen el brazo con garantía y comparan la cobertura con el control. Los nombres de tipos son etiquetas de lectura, sin cambiar el catálogo ni el trabajo de localización D6.

<!-- draft-tables:start -->
JSON fuente: SHA-256 `8c751e11c8026d71f2a600ea9eb7549aa9091928ea0687012093cbbe187a47d1`. Muestra: **100 semillas por combinación**; ventanas **±10 %, ±15 %, ±20 %, ±25 %**; escenarios **A/B/C**.

Lectura común de las tablas por hito: «Otras ofertas» cuenta sorteos con más de un cuarteto legal posible; «Familias ≥2 / 4» cuenta ofertas con al menos dos familias y con cuatro familias distintas. «Rep.» son plazas de especies vistas en ofertas anteriores de la misma semilla / plazas del hito. «BST/rival» es la media ofrecida relativa a la referencia rival. «Tipos» muestra los dos más presentes por plaza, contando ambos tipos propios. Todas estas columnas describen el brazo con garantía.

En las tablas de garantía, «Sin/con» compara los tramos cubiertos con la regla desactivada/activada. «Forzada» indica la fracción de tramos alcanzados en que se condicionó la última oferta; «Cuartetos retirados» es la reducción media solo en esas ofertas. «Supereficaces mín.» cuenta candidatos de tipo válido al forzar: basta uno, no cuatro. «—» indica que no se forzó o que no hay observaciones, según la columna. La Liga no tiene garantía.

### Comparación global con garantía

Pool mínimo tras exclusiones; alternativas y repeticiones agregadas sobre todas las ofertas o plazas de los nueve hitos, según la columna. Familias ≥2/4 muestra dos recuentos: ofertas con al menos dos familias y ofertas con cuatro familias distintas.

| Escenario | Margen | Pool mín. | Ofertas válidas / intentos | Con otros cuartetos | Familias ≥2 / 4 | Reapariciones / plazas | Fallos |
| --- | --- | --- | --- | --- | --- | --- | --- |
| A | ±10 % | 36 | 2100 / 2100 | 2100 | 2100 / 2091 | 10.2 % | 0 |
| A | ±15 % | 54 | 2100 / 2100 | 2100 | 2100 / 2088 | 9.2 % | 0 |
| A | ±20 % | 66 | 2100 / 2100 | 2100 | 2100 / 2090 | 10.0 % | 0 |
| A | ±25 % | 87 | 2100 / 2100 | 2100 | 2100 / 2088 | 10.5 % | 0 |
| B | ±10 % | 44 | 2100 / 2100 | 2100 | 2100 / 2096 | 10.8 % | 0 |
| B | ±15 % | 70 | 2100 / 2100 | 2100 | 2100 / 2091 | 10.4 % | 0 |
| B | ±20 % | 87 | 2100 / 2100 | 2100 | 2100 / 2095 | 11.1 % | 0 |
| B | ±25 % | 109 | 2100 / 2100 | 2100 | 2100 / 2080 | 10.9 % | 0 |
| C | ±10 % | 48 | 2100 / 2100 | 2100 | 2100 / 2096 | 8.7 % | 0 |
| C | ±15 % | 75 | 2100 / 2100 | 2100 | 2100 / 2097 | 9.5 % | 0 |
| C | ±20 % | 93 | 2100 / 2100 | 2100 | 2100 / 2084 | 9.8 % | 0 |
| C | ±25 % | 116 | 2100 / 2100 | 2100 | 2100 / 2072 | 9.7 % | 0 |

### Escenario A: pool por hito

Cada celda es **mínimo / mediana** de especies tras excluir la oferta anterior, con garantía. Se agregan todas las ofertas y semillas del hito, no las medianas de subgrupos.

| Hito | ±10 % | ±15 % | ±20 % | ±25 % |
| --- | --- | --- | --- | --- |
| Petra | 72 / 72 | 87 / 87 | 109 / 109 | 128 / 128 |
| Marcial | 36 / 36.5 | 54 / 54.5 | 66 / 66 | 87 / 87 |
| Erico | 59 / 61 | 81 / 83 | 119 / 120 | 147 / 147 |
| Candela | 62 / 62 | 90 / 90 | 122 / 122 | 148 / 148 |
| Norman | 75 / 77 | 118 / 118 | 142 / 142 | 161 / 161 |
| Alana | 97 / 97 | 129 / 129 | 157 / 157 | 179 / 179 |
| Vito y Leti | 113 / 113 | 153 / 153 | 180 / 180 | 186 / 186 |
| Galano | 104 / 104 | 156 / 156 | 181 / 181 | 197 / 197 |
| Liga (Sixto) | 113 / 113 | 154 / 154 | 182 / 182 | 200 / 200 |

#### A · ±10 %: elecciones, repetición y estadísticas

| Hito | Válidas | Otras ofertas | Familias ≥2 / 4 | Rep. | BST/rival | Tipos más presentes |
| --- | --- | --- | --- | --- | --- | --- |
| Petra | 400 | 400 | 400 / 400 | 4.1 % | 98.1 % | Agua 29.9 %; Planta 14.1 % |
| Marcial | 200 | 200 | 200 / 200 | 8.6 % | 103.3 % | Tierra 23.0 %; Normal 22.4 % |
| Erico | 200 | 200 | 200 / 198 | 1.5 % | 101.3 % | Bicho 17.8 %; Normal 16.9 % |
| Candela | 200 | 200 | 200 / 199 | 13.0 % | 102.0 % | Agua 20.6 %; Veneno 17.0 % |
| Norman | 200 | 200 | 200 / 199 | 1.1 % | 99.2 % | Normal 19.0 %; Volador 18.3 % |
| Alana | 200 | 200 | 200 / 198 | 9.1 % | 100.5 % | Normal 23.3 %; Volador 18.0 % |
| Vito y Leti | 200 | 200 | 200 / 200 | 12.1 % | 100.9 % | Agua 19.0 %; Normal 17.9 % |
| Galano | 200 | 200 | 200 / 198 | 17.1 % | 100.7 % | Normal 17.9 %; Agua 15.5 % |
| Liga (Sixto) | 300 | 300 | 300 / 299 | 24.1 % | 99.0 % | Agua 24.1 %; Normal 14.9 % |

#### A · ±10 %: efecto de la garantía por tramo

| Gimnasio | Cobertura sin / con | Forzada | Cuartetos retirados | Supereficaces mín. | Tramos completados |
| --- | --- | --- | --- | --- | --- |
| Petra | 100.0 % / 100.0 % | 0.0 % | — | — | 100 / 100 |
| Marcial | 81.0 % / 100.0 % | 47.0 % | 40.3 % | 7 | 100 / 100 |
| Erico | 43.0 % / 100.0 % | 80.0 % | 74.9 % | 4 | 100 / 100 |
| Candela | 95.0 % / 100.0 % | 28.0 % | 22.1 % | 19 | 100 / 100 |
| Norman | 62.0 % / 100.0 % | 62.0 % | 63.1 % | 8 | 100 / 100 |
| Alana | 73.0 % / 100.0 % | 51.0 % | 53.0 % | 14 | 100 / 100 |
| Vito y Leti | 81.0 % / 100.0 % | 48.0 % | 45.3 % | 20 | 100 / 100 |
| Galano | 83.0 % / 100.0 % | 46.0 % | 42.0 % | 20 | 100 / 100 |

#### A · ±15 %: elecciones, repetición y estadísticas

| Hito | Válidas | Otras ofertas | Familias ≥2 / 4 | Rep. | BST/rival | Tipos más presentes |
| --- | --- | --- | --- | --- | --- | --- |
| Petra | 400 | 400 | 400 / 400 | 3.3 % | 97.4 % | Agua 25.7 %; Planta 13.8 % |
| Marcial | 200 | 200 | 200 / 200 | 9.5 % | 103.8 % | Normal 24.5 %; Agua 18.9 % |
| Erico | 200 | 200 | 200 / 200 | 5.0 % | 100.3 % | Normal 17.9 %; Volador 16.0 % |
| Candela | 200 | 200 | 200 / 200 | 10.6 % | 101.4 % | Agua 19.4 %; Normal 17.5 % |
| Norman | 200 | 200 | 200 / 198 | 3.6 % | 96.9 % | Normal 19.1 %; Volador 15.5 % |
| Alana | 200 | 200 | 200 / 199 | 11.4 % | 100.8 % | Normal 17.8 %; Volador 15.4 % |
| Vito y Leti | 200 | 200 | 200 / 199 | 12.1 % | 100.2 % | Normal 17.8 %; Agua 16.3 % |
| Galano | 200 | 200 | 200 / 195 | 14.8 % | 101.2 % | Agua 18.4 %; Normal 15.1 % |
| Liga (Sixto) | 300 | 300 | 300 / 297 | 15.4 % | 99.8 % | Agua 24.9 %; Normal 14.9 % |

#### A · ±15 %: efecto de la garantía por tramo

| Gimnasio | Cobertura sin / con | Forzada | Cuartetos retirados | Supereficaces mín. | Tramos completados |
| --- | --- | --- | --- | --- | --- |
| Petra | 100.0 % / 100.0 % | 0.0 % | — | — | 100 / 100 |
| Marcial | 87.0 % / 100.0 % | 45.0 % | 35.4 % | 12 | 100 / 100 |
| Erico | 47.0 % / 100.0 % | 78.0 % | 77.1 % | 5 | 100 / 100 |
| Candela | 95.0 % / 100.0 % | 22.0 % | 23.3 % | 27 | 100 / 100 |
| Norman | 48.0 % / 100.0 % | 75.0 % | 69.8 % | 10 | 100 / 100 |
| Alana | 78.0 % / 100.0 % | 46.0 % | 45.1 % | 23 | 100 / 100 |
| Vito y Leti | 82.0 % / 100.0 % | 40.0 % | 45.6 % | 27 | 100 / 100 |
| Galano | 76.0 % / 100.0 % | 49.0 % | 49.4 % | 25 | 100 / 100 |

#### A · ±20 %: elecciones, repetición y estadísticas

| Hito | Válidas | Otras ofertas | Familias ≥2 / 4 | Rep. | BST/rival | Tipos más presentes |
| --- | --- | --- | --- | --- | --- | --- |
| Petra | 400 | 400 | 400 / 399 | 3.1 % | 97.7 % | Agua 22.6 %; Normal 14.0 % |
| Marcial | 200 | 200 | 200 / 200 | 10.4 % | 106.1 % | Normal 23.9 %; Agua 20.3 % |
| Erico | 200 | 200 | 200 / 200 | 7.0 % | 100.7 % | Agua 16.3 %; Volador 16.0 % |
| Candela | 200 | 200 | 200 / 200 | 9.9 % | 101.4 % | Normal 23.5 %; Agua 18.6 % |
| Norman | 200 | 200 | 200 / 198 | 5.9 % | 94.8 % | Normal 19.6 %; Volador 15.0 % |
| Alana | 200 | 200 | 200 / 200 | 12.9 % | 100.6 % | Normal 19.4 %; Agua 17.4 % |
| Vito y Leti | 200 | 200 | 200 / 196 | 11.1 % | 99.1 % | Normal 15.6 %; Volador 15.5 % |
| Galano | 200 | 200 | 200 / 198 | 15.8 % | 103.1 % | Agua 18.9 %; Planta 15.3 % |
| Liga (Sixto) | 300 | 300 | 300 / 299 | 17.3 % | 97.5 % | Agua 19.9 %; Normal 17.1 % |

#### A · ±20 %: efecto de la garantía por tramo

| Gimnasio | Cobertura sin / con | Forzada | Cuartetos retirados | Supereficaces mín. | Tramos completados |
| --- | --- | --- | --- | --- | --- |
| Petra | 100.0 % / 100.0 % | 0.0 % | — | — | 100 / 100 |
| Marcial | 85.0 % / 100.0 % | 46.0 % | 34.7 % | 15 | 100 / 100 |
| Erico | 47.0 % / 100.0 % | 81.0 % | 75.4 % | 8 | 100 / 100 |
| Candela | 97.0 % / 100.0 % | 22.0 % | 19.9 % | 40 | 100 / 100 |
| Norman | 54.0 % / 100.0 % | 75.0 % | 74.4 % | 10 | 100 / 100 |
| Alana | 79.0 % / 100.0 % | 40.0 % | 41.1 % | 31 | 100 / 100 |
| Vito y Leti | 80.0 % / 100.0 % | 44.0 % | 41.8 % | 35 | 100 / 100 |
| Galano | 71.0 % / 100.0 % | 53.0 % | 48.1 % | 30 | 100 / 100 |

#### A · ±25 %: elecciones, repetición y estadísticas

| Hito | Válidas | Otras ofertas | Familias ≥2 / 4 | Rep. | BST/rival | Tipos más presentes |
| --- | --- | --- | --- | --- | --- | --- |
| Petra | 400 | 400 | 400 / 400 | 2.5 % | 98.9 % | Agua 21.1 %; Normal 15.6 % |
| Marcial | 200 | 200 | 200 / 200 | 9.6 % | 108.2 % | Agua 23.6 %; Normal 18.6 % |
| Erico | 200 | 200 | 200 / 200 | 9.0 % | 96.7 % | Agua 19.0 %; Tierra 15.6 % |
| Candela | 200 | 200 | 200 / 200 | 13.1 % | 102.0 % | Normal 19.9 %; Agua 19.4 % |
| Norman | 200 | 200 | 200 / 200 | 7.1 % | 94.6 % | Normal 18.8 %; Volador 15.3 % |
| Alana | 200 | 200 | 200 / 198 | 14.0 % | 100.2 % | Normal 17.6 %; Agua 15.8 % |
| Vito y Leti | 200 | 200 | 200 / 197 | 11.5 % | 98.5 % | Normal 19.1 %; Agua 16.3 % |
| Galano | 200 | 200 | 200 / 196 | 15.0 % | 103.1 % | Agua 20.4 %; Normal 14.8 % |
| Liga (Sixto) | 300 | 300 | 300 / 297 | 17.0 % | 97.3 % | Agua 19.5 %; Normal 15.9 % |

#### A · ±25 %: efecto de la garantía por tramo

| Gimnasio | Cobertura sin / con | Forzada | Cuartetos retirados | Supereficaces mín. | Tramos completados |
| --- | --- | --- | --- | --- | --- |
| Petra | 100.0 % / 100.0 % | 0.0 % | — | — | 100 / 100 |
| Marcial | 93.0 % / 100.0 % | 27.0 % | 36.6 % | 19 | 100 / 100 |
| Erico | 51.0 % / 100.0 % | 77.0 % | 70.9 % | 12 | 100 / 100 |
| Candela | 97.0 % / 100.0 % | 21.0 % | 22.1 % | 46 | 100 / 100 |
| Norman | 42.0 % / 100.0 % | 78.0 % | 77.2 % | 10 | 100 / 100 |
| Alana | 76.0 % / 100.0 % | 38.0 % | 42.7 % | 34 | 100 / 100 |
| Vito y Leti | 79.0 % / 100.0 % | 47.0 % | 43.1 % | 35 | 100 / 100 |
| Galano | 80.0 % / 100.0 % | 48.0 % | 48.9 % | 32 | 100 / 100 |

### Escenario B: pool por hito

Cada celda es **mínimo / mediana** de especies tras excluir la oferta anterior, con garantía. Se agregan todas las ofertas y semillas del hito, no las medianas de subgrupos.

| Hito | ±10 % | ±15 % | ±20 % | ±25 % |
| --- | --- | --- | --- | --- |
| Petra | 73 / 73 | 89 / 89 | 112 / 112 | 131 / 131 |
| Marcial | 44 / 44.5 | 70 / 70 | 87 / 87 | 109 / 109 |
| Erico | 59 / 61 | 81 / 83 | 125 / 125 | 164 / 164 |
| Candela | 61 / 61 | 96 / 96 | 146 / 146 | 179 / 179 |
| Norman | 67 / 69 | 103 / 103 | 125 / 125 | 147 / 147 |
| Alana | 96 / 96 | 119 / 119 | 147 / 147 | 176 / 176 |
| Vito y Leti | 98 / 98 | 142 / 142 | 164 / 164 | 179 / 179 |
| Galano | 105 / 105 | 147 / 147 | 172 / 172 | 192 / 192 |
| Liga (Sixto) | 94 / 94 | 126 / 126 | 162 / 162 | 183 / 183 |

#### B · ±10 %: elecciones, repetición y estadísticas

| Hito | Válidas | Otras ofertas | Familias ≥2 / 4 | Rep. | BST/rival | Tipos más presentes |
| --- | --- | --- | --- | --- | --- | --- |
| Petra | 400 | 400 | 400 / 400 | 5.0 % | 98.1 % | Agua 29.6 %; Planta 15.9 % |
| Marcial | 200 | 200 | 200 / 200 | 7.0 % | 102.3 % | Normal 25.3 %; Tierra 18.4 % |
| Erico | 200 | 200 | 200 / 198 | 1.8 % | 101.3 % | Bicho 17.8 %; Normal 16.9 % |
| Candela | 200 | 200 | 200 / 199 | 13.3 % | 101.9 % | Agua 21.5 %; Planta 19.1 % |
| Norman | 200 | 200 | 200 / 200 | 1.0 % | 98.8 % | Normal 20.8 %; Volador 19.6 % |
| Alana | 200 | 200 | 200 / 199 | 11.0 % | 100.0 % | Agua 16.0 %; Normal 15.5 % |
| Vito y Leti | 200 | 200 | 200 / 200 | 13.3 % | 100.2 % | Normal 17.6 %; Agua 15.9 % |
| Galano | 200 | 200 | 200 / 200 | 21.3 % | 99.2 % | Agua 18.8 %; Normal 18.0 % |
| Liga (Sixto) | 300 | 300 | 300 / 300 | 23.2 % | 98.5 % | Agua 20.1 %; Volador 18.2 % |

#### B · ±10 %: efecto de la garantía por tramo

| Gimnasio | Cobertura sin / con | Forzada | Cuartetos retirados | Supereficaces mín. | Tramos completados |
| --- | --- | --- | --- | --- | --- |
| Petra | 100.0 % / 100.0 % | 0.0 % | — | — | 100 / 100 |
| Marcial | 89.0 % / 100.0 % | 31.0 % | 30.1 % | 11 | 100 / 100 |
| Erico | 43.0 % / 100.0 % | 80.0 % | 74.9 % | 4 | 100 / 100 |
| Candela | 94.0 % / 100.0 % | 27.0 % | 21.4 % | 19 | 100 / 100 |
| Norman | 53.0 % / 100.0 % | 65.0 % | 63.6 % | 7 | 100 / 100 |
| Alana | 76.0 % / 100.0 % | 56.0 % | 52.7 % | 14 | 100 / 100 |
| Vito y Leti | 75.0 % / 100.0 % | 46.0 % | 43.8 % | 18 | 100 / 100 |
| Galano | 75.0 % / 100.0 % | 51.0 % | 51.1 % | 16 | 100 / 100 |

#### B · ±15 %: elecciones, repetición y estadísticas

| Hito | Válidas | Otras ofertas | Familias ≥2 / 4 | Rep. | BST/rival | Tipos más presentes |
| --- | --- | --- | --- | --- | --- | --- |
| Petra | 400 | 400 | 400 / 400 | 2.8 % | 97.5 % | Agua 24.9 %; Planta 14.3 % |
| Marcial | 200 | 200 | 200 / 200 | 9.4 % | 104.5 % | Normal 24.8 %; Agua 17.5 % |
| Erico | 200 | 200 | 200 / 200 | 3.1 % | 100.3 % | Normal 17.9 %; Volador 16.0 % |
| Candela | 200 | 200 | 200 / 200 | 10.6 % | 100.3 % | Planta 17.1 %; Agua 17.0 % |
| Norman | 200 | 200 | 200 / 199 | 4.5 % | 95.1 % | Normal 18.3 %; Volador 16.6 % |
| Alana | 200 | 200 | 200 / 199 | 11.8 % | 100.4 % | Normal 16.5 %; Agua 16.4 % |
| Vito y Leti | 200 | 200 | 200 / 197 | 13.6 % | 98.3 % | Agua 16.3 %; Normal 15.6 % |
| Galano | 200 | 200 | 200 / 199 | 18.9 % | 99.7 % | Agua 16.9 %; Normal 14.0 % |
| Liga (Sixto) | 300 | 300 | 300 / 297 | 21.4 % | 98.2 % | Agua 21.2 %; Normal 18.4 % |

#### B · ±15 %: efecto de la garantía por tramo

| Gimnasio | Cobertura sin / con | Forzada | Cuartetos retirados | Supereficaces mín. | Tramos completados |
| --- | --- | --- | --- | --- | --- |
| Petra | 100.0 % / 100.0 % | 0.0 % | — | — | 100 / 100 |
| Marcial | 85.0 % / 100.0 % | 38.0 % | 31.9 % | 17 | 100 / 100 |
| Erico | 47.0 % / 100.0 % | 78.0 % | 77.1 % | 5 | 100 / 100 |
| Candela | 94.0 % / 100.0 % | 24.0 % | 21.7 % | 30 | 100 / 100 |
| Norman | 56.0 % / 100.0 % | 73.0 % | 69.0 % | 9 | 100 / 100 |
| Alana | 81.0 % / 100.0 % | 49.0 % | 45.5 % | 21 | 100 / 100 |
| Vito y Leti | 80.0 % / 100.0 % | 47.0 % | 47.3 % | 24 | 100 / 100 |
| Galano | 71.0 % / 100.0 % | 55.0 % | 53.6 % | 21 | 100 / 100 |

#### B · ±20 %: elecciones, repetición y estadísticas

| Hito | Válidas | Otras ofertas | Familias ≥2 / 4 | Rep. | BST/rival | Tipos más presentes |
| --- | --- | --- | --- | --- | --- | --- |
| Petra | 400 | 400 | 400 / 399 | 2.7 % | 97.6 % | Agua 23.3 %; Normal 13.8 % |
| Marcial | 200 | 200 | 200 / 200 | 10.5 % | 105.4 % | Agua 22.6 %; Normal 18.1 % |
| Erico | 200 | 200 | 200 / 200 | 6.5 % | 99.0 % | Agua 19.0 %; Normal 17.1 % |
| Candela | 200 | 200 | 200 / 199 | 15.9 % | 97.1 % | Agua 20.1 %; Normal 16.9 % |
| Norman | 200 | 200 | 200 / 200 | 7.5 % | 93.8 % | Normal 19.3 %; Volador 16.5 % |
| Alana | 200 | 200 | 200 / 200 | 11.0 % | 99.2 % | Agua 16.8 %; Normal 16.5 % |
| Vito y Leti | 200 | 200 | 200 / 199 | 11.6 % | 98.0 % | Agua 20.0 %; Normal 15.1 % |
| Galano | 200 | 200 | 200 / 199 | 15.6 % | 99.6 % | Agua 20.0 %; Normal 12.8 % |
| Liga (Sixto) | 300 | 300 | 300 / 299 | 21.8 % | 95.4 % | Agua 20.4 %; Normal 15.9 % |

#### B · ±20 %: efecto de la garantía por tramo

| Gimnasio | Cobertura sin / con | Forzada | Cuartetos retirados | Supereficaces mín. | Tramos completados |
| --- | --- | --- | --- | --- | --- |
| Petra | 100.0 % / 100.0 % | 0.0 % | — | — | 100 / 100 |
| Marcial | 91.0 % / 100.0 % | 34.0 % | 34.4 % | 20 | 100 / 100 |
| Erico | 40.0 % / 100.0 % | 84.0 % | 76.5 % | 8 | 100 / 100 |
| Candela | 98.0 % / 100.0 % | 20.0 % | 18.3 % | 50 | 100 / 100 |
| Norman | 42.0 % / 100.0 % | 76.0 % | 73.9 % | 9 | 100 / 100 |
| Alana | 84.0 % / 100.0 % | 38.0 % | 38.3 % | 31 | 100 / 100 |
| Vito y Leti | 83.0 % / 100.0 % | 35.0 % | 41.6 % | 32 | 100 / 100 |
| Galano | 69.0 % / 100.0 % | 54.0 % | 50.2 % | 27 | 100 / 100 |

#### B · ±25 %: elecciones, repetición y estadísticas

| Hito | Válidas | Otras ofertas | Familias ≥2 / 4 | Rep. | BST/rival | Tipos más presentes |
| --- | --- | --- | --- | --- | --- | --- |
| Petra | 400 | 400 | 400 / 397 | 1.9 % | 98.4 % | Agua 21.6 %; Normal 16.0 % |
| Marcial | 200 | 200 | 200 / 200 | 8.6 % | 107.5 % | Agua 23.6 %; Normal 17.1 % |
| Erico | 200 | 200 | 200 / 195 | 11.0 % | 94.2 % | Agua 18.9 %; Tierra 16.0 % |
| Candela | 200 | 200 | 200 / 195 | 10.8 % | 98.0 % | Agua 17.8 %; Normal 16.3 % |
| Norman | 200 | 200 | 200 / 200 | 7.0 % | 93.3 % | Volador 17.6 %; Normal 17.5 % |
| Alana | 200 | 200 | 200 / 199 | 14.0 % | 96.8 % | Agua 18.8 %; Normal 17.3 % |
| Vito y Leti | 200 | 200 | 200 / 199 | 13.3 % | 95.9 % | Normal 17.5 %; Agua 17.3 % |
| Galano | 200 | 200 | 200 / 196 | 16.4 % | 98.7 % | Agua 18.8 %; Normal 14.6 % |
| Liga (Sixto) | 300 | 300 | 300 / 299 | 19.8 % | 95.1 % | Agua 17.2 %; Normal 17.1 % |

#### B · ±25 %: efecto de la garantía por tramo

| Gimnasio | Cobertura sin / con | Forzada | Cuartetos retirados | Supereficaces mín. | Tramos completados |
| --- | --- | --- | --- | --- | --- |
| Petra | 100.0 % / 100.0 % | 0.0 % | — | — | 100 / 100 |
| Marcial | 89.0 % / 100.0 % | 41.0 % | 36.4 % | 24 | 100 / 100 |
| Erico | 43.0 % / 100.0 % | 69.0 % | 71.6 % | 13 | 100 / 100 |
| Candela | 92.0 % / 100.0 % | 23.0 % | 22.0 % | 56 | 100 / 100 |
| Norman | 49.0 % / 100.0 % | 78.0 % | 77.5 % | 9 | 100 / 100 |
| Alana | 86.0 % / 100.0 % | 37.0 % | 38.5 % | 37 | 100 / 100 |
| Vito y Leti | 81.0 % / 100.0 % | 45.0 % | 43.9 % | 33 | 100 / 100 |
| Galano | 73.0 % / 100.0 % | 44.0 % | 49.1 % | 31 | 100 / 100 |

### Escenario C: pool por hito

Cada celda es **mínimo / mediana** de especies tras excluir la oferta anterior, con garantía. Se agregan todas las ofertas y semillas del hito, no las medianas de subgrupos.

| Hito | ±10 % | ±15 % | ±20 % | ±25 % |
| --- | --- | --- | --- | --- |
| Petra | 78 / 78 | 98 / 98 | 128 / 128 | 163 / 163 |
| Marcial | 48 / 48.5 | 75 / 75 | 93 / 93 | 116 / 116 |
| Erico | 78 / 80 | 103 / 105 | 166 / 166.5 | 228 / 228 |
| Candela | 64 / 64 | 109 / 109 | 162 / 162 | 204 / 204 |
| Norman | 115 / 117 | 181 / 181.5 | 205 / 205 | 227 / 227 |
| Alana | 106 / 106 | 154 / 154 | 194 / 194 | 242 / 242 |
| Vito y Leti | 120 / 120 | 178 / 178 | 206 / 206 | 221 / 221 |
| Galano | 119 / 119 | 172 / 172 | 207 / 207 | 231 / 231 |
| Liga (Sixto) | 118 / 118 | 163 / 163 | 201 / 201 | 223 / 223 |

#### C · ±10 %: elecciones, repetición y estadísticas

| Hito | Válidas | Otras ofertas | Familias ≥2 / 4 | Rep. | BST/rival | Tipos más presentes |
| --- | --- | --- | --- | --- | --- | --- |
| Petra | 400 | 400 | 400 / 400 | 3.1 % | 98.2 % | Agua 27.0 %; Planta 13.9 % |
| Marcial | 200 | 200 | 200 / 200 | 5.8 % | 102.2 % | Normal 23.3 %; Tierra 17.3 % |
| Erico | 200 | 200 | 200 / 200 | 0.8 % | 102.1 % | Tierra 16.9 %; Roca 16.3 % |
| Candela | 200 | 200 | 200 / 200 | 9.4 % | 101.7 % | Agua 19.8 %; Veneno 18.0 % |
| Norman | 200 | 200 | 200 / 198 | 0.6 % | 100.1 % | Agua 19.3 %; Normal 15.8 % |
| Alana | 200 | 200 | 200 / 200 | 11.0 % | 99.9 % | Normal 19.4 %; Volador 16.5 % |
| Vito y Leti | 200 | 200 | 200 / 198 | 9.4 % | 101.2 % | Agua 19.0 %; Normal 18.0 % |
| Galano | 200 | 200 | 200 / 200 | 17.4 % | 99.6 % | Agua 18.0 %; Planta 16.8 % |
| Liga (Sixto) | 300 | 300 | 300 / 300 | 20.8 % | 99.5 % | Agua 20.9 %; Normal 17.2 % |

#### C · ±10 %: efecto de la garantía por tramo

| Gimnasio | Cobertura sin / con | Forzada | Cuartetos retirados | Supereficaces mín. | Tramos completados |
| --- | --- | --- | --- | --- | --- |
| Petra | 100.0 % / 100.0 % | 0.0 % | — | — | 100 / 100 |
| Marcial | 86.0 % / 100.0 % | 37.0 % | 30.3 % | 12 | 100 / 100 |
| Erico | 59.0 % / 100.0 % | 64.0 % | 64.3 % | 8 | 100 / 100 |
| Candela | 94.0 % / 100.0 % | 27.0 % | 21.4 % | 20 | 100 / 100 |
| Norman | 47.0 % / 100.0 % | 74.0 % | 71.9 % | 9 | 100 / 100 |
| Alana | 74.0 % / 100.0 % | 46.0 % | 53.8 % | 15 | 100 / 100 |
| Vito y Leti | 82.0 % / 100.0 % | 40.0 % | 45.8 % | 21 | 100 / 100 |
| Galano | 82.0 % / 100.0 % | 43.0 % | 41.8 % | 23 | 100 / 100 |

#### C · ±15 %: elecciones, repetición y estadísticas

| Hito | Válidas | Otras ofertas | Familias ≥2 / 4 | Rep. | BST/rival | Tipos más presentes |
| --- | --- | --- | --- | --- | --- | --- |
| Petra | 400 | 400 | 400 / 400 | 3.7 % | 97.9 % | Agua 23.4 %; Veneno 13.0 % |
| Marcial | 200 | 200 | 200 / 200 | 7.5 % | 103.9 % | Normal 20.1 %; Agua 18.1 % |
| Erico | 200 | 200 | 200 / 200 | 3.8 % | 101.5 % | Roca 18.0 %; Agua 17.9 % |
| Candela | 200 | 200 | 200 / 200 | 12.8 % | 100.3 % | Agua 18.1 %; Normal 17.0 % |
| Norman | 200 | 200 | 200 / 199 | 3.6 % | 98.7 % | Agua 22.5 %; Lucha 14.8 % |
| Alana | 200 | 200 | 200 / 200 | 9.4 % | 102.2 % | Agua 18.9 %; Normal 16.6 % |
| Vito y Leti | 200 | 200 | 200 / 200 | 11.0 % | 99.9 % | Agua 18.1 %; Normal 15.0 % |
| Galano | 200 | 200 | 200 / 200 | 15.6 % | 101.0 % | Agua 19.8 %; Normal 17.0 % |
| Liga (Sixto) | 300 | 300 | 300 / 298 | 19.1 % | 99.7 % | Agua 25.4 %; Normal 14.9 % |

#### C · ±15 %: efecto de la garantía por tramo

| Gimnasio | Cobertura sin / con | Forzada | Cuartetos retirados | Supereficaces mín. | Tramos completados |
| --- | --- | --- | --- | --- | --- |
| Petra | 100.0 % / 100.0 % | 0.0 % | — | — | 100 / 100 |
| Marcial | 90.0 % / 100.0 % | 32.0 % | 32.5 % | 18 | 100 / 100 |
| Erico | 63.0 % / 100.0 % | 57.0 % | 66.0 % | 10 | 100 / 100 |
| Candela | 97.0 % / 100.0 % | 20.0 % | 20.7 % | 35 | 100 / 100 |
| Norman | 47.0 % / 100.0 % | 72.0 % | 74.0 % | 13 | 100 / 100 |
| Alana | 80.0 % / 100.0 % | 41.0 % | 40.3 % | 31 | 100 / 100 |
| Vito y Leti | 80.0 % / 100.0 % | 50.0 % | 50.1 % | 28 | 100 / 100 |
| Galano | 78.0 % / 100.0 % | 47.0 % | 48.8 % | 28 | 100 / 100 |

#### C · ±20 %: elecciones, repetición y estadísticas

| Hito | Válidas | Otras ofertas | Familias ≥2 / 4 | Rep. | BST/rival | Tipos más presentes |
| --- | --- | --- | --- | --- | --- | --- |
| Petra | 400 | 400 | 400 / 398 | 2.5 % | 98.8 % | Agua 22.1 %; Normal 14.7 % |
| Marcial | 200 | 200 | 200 / 200 | 8.4 % | 105.5 % | Normal 21.3 %; Agua 19.9 % |
| Erico | 200 | 200 | 200 / 199 | 6.5 % | 101.8 % | Agua 19.3 %; Tierra 16.8 % |
| Candela | 200 | 200 | 200 / 198 | 13.8 % | 98.2 % | Agua 19.1 %; Normal 15.6 % |
| Norman | 200 | 200 | 200 / 197 | 4.8 % | 97.4 % | Agua 21.5 %; Lucha 14.6 % |
| Alana | 200 | 200 | 200 / 198 | 9.8 % | 101.4 % | Agua 19.6 %; Normal 16.6 % |
| Vito y Leti | 200 | 200 | 200 / 197 | 11.9 % | 99.6 % | Agua 21.5 %; Normal 14.9 % |
| Galano | 200 | 200 | 200 / 198 | 13.6 % | 101.4 % | Agua 18.3 %; Normal 14.4 % |
| Liga (Sixto) | 300 | 300 | 300 / 299 | 19.3 % | 96.4 % | Agua 22.2 %; Normal 15.2 % |

#### C · ±20 %: efecto de la garantía por tramo

| Gimnasio | Cobertura sin / con | Forzada | Cuartetos retirados | Supereficaces mín. | Tramos completados |
| --- | --- | --- | --- | --- | --- |
| Petra | 100.0 % / 100.0 % | 0.0 % | — | — | 100 / 100 |
| Marcial | 87.0 % / 100.0 % | 37.0 % | 35.2 % | 21 | 100 / 100 |
| Erico | 57.0 % / 100.0 % | 61.0 % | 66.4 % | 16 | 100 / 100 |
| Candela | 96.0 % / 100.0 % | 24.0 % | 17.3 % | 57 | 100 / 100 |
| Norman | 43.0 % / 100.0 % | 74.0 % | 76.8 % | 13 | 100 / 100 |
| Alana | 85.0 % / 100.0 % | 44.0 % | 38.4 % | 41 | 100 / 100 |
| Vito y Leti | 70.0 % / 100.0 % | 52.0 % | 46.1 % | 36 | 100 / 100 |
| Galano | 80.0 % / 100.0 % | 42.0 % | 46.3 % | 36 | 100 / 100 |

#### C · ±25 %: elecciones, repetición y estadísticas

| Hito | Válidas | Otras ofertas | Familias ≥2 / 4 | Rep. | BST/rival | Tipos más presentes |
| --- | --- | --- | --- | --- | --- | --- |
| Petra | 400 | 400 | 400 / 397 | 1.7 % | 101.5 % | Agua 19.9 %; Normal 16.4 % |
| Marcial | 200 | 200 | 200 / 200 | 7.9 % | 106.7 % | Agua 21.8 %; Normal 20.4 % |
| Erico | 200 | 200 | 200 / 194 | 7.8 % | 100.5 % | Agua 19.1 %; Tierra 16.4 % |
| Candela | 200 | 200 | 200 / 197 | 11.1 % | 99.8 % | Agua 18.1 %; Normal 17.3 % |
| Norman | 200 | 200 | 200 / 198 | 6.6 % | 97.6 % | Agua 22.1 %; Lucha 13.4 % |
| Alana | 200 | 200 | 200 / 197 | 11.3 % | 101.5 % | Agua 20.6 %; Normal 15.4 % |
| Vito y Leti | 200 | 200 | 200 / 197 | 12.8 % | 97.6 % | Agua 22.4 %; Normal 15.1 % |
| Galano | 200 | 200 | 200 / 198 | 14.5 % | 101.0 % | Agua 23.8 %; Planta 14.3 % |
| Liga (Sixto) | 300 | 300 | 300 / 294 | 17.8 % | 96.8 % | Agua 19.8 %; Normal 16.4 % |

#### C · ±25 %: efecto de la garantía por tramo

| Gimnasio | Cobertura sin / con | Forzada | Cuartetos retirados | Supereficaces mín. | Tramos completados |
| --- | --- | --- | --- | --- | --- |
| Petra | 100.0 % / 100.0 % | 0.0 % | — | — | 100 / 100 |
| Marcial | 87.0 % / 100.0 % | 40.0 % | 37.3 % | 25 | 100 / 100 |
| Erico | 55.0 % / 100.0 % | 68.0 % | 65.2 % | 23 | 100 / 100 |
| Candela | 94.0 % / 100.0 % | 22.0 % | 20.0 % | 67 | 100 / 100 |
| Norman | 37.0 % / 100.0 % | 79.0 % | 78.9 % | 13 | 100 / 100 |
| Alana | 91.0 % / 100.0 % | 45.0 % | 38.5 % | 51 | 100 / 100 |
| Vito y Leti | 79.0 % / 100.0 % | 39.0 % | 47.8 % | 37 | 100 / 100 |
| Galano | 81.0 % / 100.0 % | 50.0 % | 46.5 % | 40 | 100 / 100 |

### Escasez y cobertura

Ninguna combinación presenta un pool menor de cuatro, antes ni después de exclusiones, en los hitos observados.
Todos los gimnasios tienen candidatos de tipo propio válido en el pool inicial.
Repeticiones con la oferta inmediatamente anterior: **0**. Fallos con garantía: **0**.
<!-- draft-tables:end -->

### Verificación y siguiente etapa

La comparación D3(b) conserva las ventanas descartadas. Usa la regla de D3(c) descrita arriba para generar ofertas de Esmeralda. Reproducir el JSON con los comandos iniciales y ejecutar `node scripts/report-nuzlocke-draft.mjs --check` para acreditar que las tablas corresponden a la evidencia.

Verificación D3(b): 50 tests focalizados pasan en siete ficheros, con seis tests nuevos para medianas, familias, procedencia del JSON, integridad y reproducción de tablas. Los valores compartidos con la pasada D3(a) coinciden exactamente; las métricas nuevas no alteran sus sorteos. `report-nuzlocke-draft.mjs --check` y `git diff --check` pasan.

**Verificación D3(c), 11/11/2026:** `npm run validate:data`, `npx vitest run` (2 502 tests en 145 ficheros, configuración del proyecto), `npx tsc -b`, `npm run lint` y `npm run build` pasan. D3(c) añade ocho tests y adapta los dos casos de gimnasio que dependían de inyectar pools manuales, porque la regla aprobada impide esa sustitución. `report-nuzlocke-draft.mjs --check` verifica las tablas porcentuales y `--section absolute --check` las absolutas. `git diff --check` pasa. Los E2E completos, incluida la tanda de tiempos, quedan a cargo del coordinador por indicación de Jose; no se han ejecutado en D3(c).
