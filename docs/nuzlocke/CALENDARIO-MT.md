# Calendario aprobado · Hoenn Esmeralda

## Decisiones de Jose · 11/11/2026

Estas reglas sustituyen las recomendaciones de D2(b). Los motivos y las alternativas descartadas están en [PRD §0](../PRD.md); las decisiones técnicas y la compatibilidad se describen en [DEC-88](../ARQUITECTURA.md).

- **Recorrido habitual:** Portual/Malvalona tras Marcial; costa oriental tras Alana. Permite revisitar zonas anteriores al abrirlas una MO. Evita adelantar la cobertura del Casino y de Calagua.
- **Sin azar, posliga ni objetos sin fuente nativa:** excluye Recogida, objetos salvajes y premios posteriores a la primera Liga. En Oromar solo conserva la MT27 del meteorito; no añade MT21.
- **Escáner:** una elección única entre Diente Mar. y Escama Mar., persistida antes de usarla. Conserva el coste de oportunidad entre Huntail y Gorebyss.
- **Objetos de evolución:** una sola unidad por tipo durante toda la campaña; se consume al evolucionar. No se repone al morir el usuario, entrar en otro hito, cambiar de forma ni recargar. Sustituye la recomendación de reutilizarlos.
- **Amistad para evolucionar:** tres victorias alineado y superviviente, o pertenecer a la plantilla de Liga fijada. La excepción permite evolucionar a reclutas tardíos. La caja queda excluida tras fijar la plantilla. Para Eevee se elige día/noche en preparación, sin esperar al reloj real.
- **Amistad de combate:** 255 para todos los Pokémon del jugador, independientemente del contador anterior: Retroceso a potencia máxima y Frustración a mínima. No altera la amistad de los rivales ni el modo diario.
- **Feebas:** Milotic se habilita tras Norman, antes de Alana, sin minijuego ni victorias adicionales. Abstrae la preparación de belleza para el tramo de Surf.
- **Nincada:** Ninjask automático desde nivel 20; Shedinja solo por una elección independiente del draft. No crea un recluta gratuito.
- **Wurmple:** rama aleatoria reproducible por semilla e identidad, sin repetirla al reanudar. **Tyrogue:** el jugador elige cualquiera de sus tres ramas desde nivel 20; sustituye la recomendación basada en Ataque/Defensa.

## Tabla del recorrido habitual

Cada fila enumera **novedades antes del combate**. Las MT/MO permanecen disponibles y son gratis y reutilizables. Las piedras y objetos son unidades consumibles: alcanzar su fecha no devuelve una unidad gastada.

El [calendario ejecutable](../../data/nuzlocke/hoenn-emerald-calendar.json) tiene 65 entradas: 48 MT, ocho MO y nueve tipos de objeto de evolución, incluidos los dos premios alternativos del Escáner. Cada partida concede solo uno de esos dos premios. Los nombres españoles son orientativos para leer el informe; los IDs y números de MT/MO son la referencia estable y la localización por época corresponde a D6.

| Antes de | Nivel | Nuevas MT | MO recibidas | Objetos de evolución: una unidad por tipo |
|---|---:|---|---|---|
| Petra | 15 | MT09 Semilladora | MO01 Corte | — |
| Marcial | 19 | MT39 Tumba Rocas, MT47 Ala de Acero | MO05 Destello | — |
| Erico | 24 | MT08 Corpulencia, MT10 Poder Oculto, MT13 Rayo Hielo, MT24 Rayo, MT29 Psíquico, MT32 Doble Equipo, MT35 Lanzallamas, MT41 Tormento, MT43 Daño Secreto, MT45 Atracción, MT46 Ladrón | MO06 Golpe Roca | — |
| Candela | 29 | MT05 Rugido, MT27 Retroceso, MT28 Excavar, MT34 Onda Voltio | MO04 Fuerza | Piedra Lunar |
| Norman | 31 | MT06 Tóxico, MT37 Tormenta de Arena, MT50 Sofoco | — | Piedra Fuego |
| Alana | 33 | MT01 Puño Certero, MT11 Día Soleado, MT19 Gigadrenado, MT36 Bomba Lodo, MT42 Fachada | MO02 Vuelo, MO03 Surf | Piedra Trueno, Piedra Hoja |
| Vito y Leti | 42 | MT07 Granizo, MT12 Mofa, MT14 Ventisca, MT15 Hiperrayo, MT16 Pantalla de Luz, MT17 Protección, MT20 Velo Sagrado, MT22 Rayo Solar, MT25 Trueno, MT30 Bola Sombra, MT33 Reflejo, MT38 Llamarada, MT40 Golpe Aéreo, MT44 Descanso, MT48 Intercambio | — | Piedra Solar, Roca del Rey |
| Galano | 46 | MT04 Paz Mental, MT18 Danza Lluvia, MT26 Terremoto, MT31 Demolición | MO07 Cascada, MO08 Buceo | Piedra Agua, Diente Marino (elección del Escáner), Escama Marina (elección del Escáner) |
| Sixto | 49 | MT02 Garra Dragón, MT03 Hidropulso, MT23 Cola Férrea | — | — |
| Fátima | 51 | — | — | — |
| Nívea | 53 | — | — | — |
| Dracón | 55 | — | — | — |
| Plubio | 58 | — | — | — |

La [extracción D2(a)](../../data/nuzlocke/hoenn-emerald-items.json) conserva los límites tempranos con exploración opcional y las evidencias descartadas. No modificarla para hacerla coincidir con el recorrido habitual: el generador del calendario aplica las decisiones de Jose y recalcula el mínimo por todas las fuentes admitidas.

### Recepción de MO y permiso de campo

| MO | Recepción antes de | Permiso fuera de combate tras vencer a |
|---|---|---|
| MO01 Corte | Petra | Petra |
| MO05 Destello | Marcial | Marcial |
| MO06 Golpe Roca | Erico | Erico |
| MO04 Fuerza | Candela | Candela |
| MO03 Surf | Alana | Norman |
| MO02 Vuelo | Alana | Alana |
| MO08 Buceo | Galano | Vito y Leti |
| MO07 Cascada | Galano | Galano |

Para aprender una MO y usarla **en combate**, basta recibirla y ser compatible. Corte se recibe antes de Petra aunque su permiso de campo sea posterior; Cascada se recibe antes de Galano aunque exija su medalla para usarla en el mapa.

### Fechas y exclusiones relevantes

- El Casino pasa de antes de Marcial a antes de Erico: MT13 Rayo Hielo, MT24 Rayo, MT29 Psíquico, MT32 Doble Equipo y MT35 Lanzallamas. Sus fichas comprables no son premios aleatorios.
- Calagua, Monte Pírico, Safari, Algaria y Cardumen quedan antes de Vito y Leti. Esto retrasa, entre otras, MT14 Ventisca, MT30 Bola Sombra, MT44 Descanso, Piedra Solar y Roca del Rey respecto a la exploración opcional.
- Se conserva una segunda fuente anterior si existe: Piedra Trueno sigue antes de Alana por Malvalanova aunque su canje de fragmentos sea oriental.
- Bomba Lodo sigue tras Norman, antes de Alana: el gimnasio retira `FLAG_HIDE_DEWFORD_HALL_SLUDGE_BOMB_MAN`, que oculta al NPC de Azuliza desde el inicio.
- Piedra Fuego y Tóxico requieren Fuerza utilizable en Senda Ígnea y quedan antes de Norman. Piedra Lunar queda antes de Candela.
- Piedra Agua y los premios del Escáner requieren Buceo: antes de Galano. Los canjes no adelantan el acceso a los fragmentos: Rojo, Azul y Verde requieren acceso submarino; el Amarillo de superficie admite Surf.
- Mofa requiere la sexta medalla para el quinto acertijo de la Casa Treta: antes de Vito y Leti. Garra Dragón y Cola Férrea requieren Cascada utilizable: antes de Sixto.
- Entre Sixto y Plubio no se abren nuevas MT/MO ni unidades de objetos: solo cambian el nivel, los movimientos aprendidos y las evoluciones elegibles de los supervivientes de la plantilla cerrada.

| Entrada excluida del calendario | Motivo y efecto |
|---|---|
| MT21 Frustración | Solo se identifica el regalo semanal por amistad baja de Oromar. Se excluye esa vía; no altera la MT27 garantizada del meteorito. Si un efecto de combate copia Frustración, la amistad 255 del jugador sigue dándole potencia mínima. |
| MT49 Robo | El S.S. Marea requiere completar la Liga; no se adelanta a Sixto. |
| Revestimiento Metálico | Sus fuentes identificadas son objetos salvajes aleatorios; no habilita Scizor/Steelix desde sus preevoluciones. |
| Escama Dragón | Sus fuentes identificadas son objetos salvajes aleatorios; no habilita Kingdra desde Seadra. |
| Mejora | No hay adquisición nativa identificada en las fuentes examinadas; no se inventa una fecha para evolucionar Porygon. |

Estos cierres afectan a **evolucionar desde una preevolución**, no son vetos nuevos de especies del pool. El draft usa el escenario A aprobado y su calendario de viabilidad, sin gastar objetos al ofrecer o reclutar formas ya evolucionadas; consulta su alcance en [SIMULACION-DRAFT.md](SIMULACION-DRAFT.md).

## Consumo, decisiones e identidad persistente

`campaignEvolutionItems(definition, state)` devuelve las unidades desbloqueadas y no consumidas. Un desbloqueo tiene cantidad uno, aunque existan varios hallazgos o canjes de ese tipo. `evolveRecruit` comprueba las opciones y añade la transición al historial del miembro; `consumedEvolutionItems` reconstruye el consumo recorriendo todos los historiales, incluidos los de miembros caídos, y excluye el prefijo anterior al reclutamiento descrito en DEC-90. Ese prefijo justifica movimientos heredados, no evoluciones realizadas por el jugador. No borrar esos miembros ni sus historiales: hacerlo devolvería recursos gastados. Se evita así mantener un segundo inventario que pudiera divergir.

Por ejemplo, tras usar Piedra Trueno para Eevee → Jolteon, un segundo Eevee no puede usar otra Piedra Trueno. La baja de Jolteon no devuelve la piedra. Piedra Fuego sigue siendo una unidad independiente si aún no se ha usado.

El Escáner requiere `chooseScannerItem(definition, state, 'deepseatooth' | 'deepseascale')` durante preparación, desde el hito de Galano. Guardar el estado devuelto antes de continuar: `scannerChoice` conserva la elección incluso si aún no se ha usado el objeto. Repetir la misma elección es idempotente; cambiar al otro premio se rechaza. Un historial que ya contiene Huntail o Gorebyss por ese canje permite reconstruir la elección si un registro anterior carece del campo.

## Preparación de la Liga y evoluciones

Fijar la plantilla **antes de preparar el primer combate** permite usar la excepción de amistad sin entrar primero en combate:

1. Terminar el draft de Liga y elegir entre uno y seis reclutas vivos distintos.
2. Ejecutar `lockLeagueRoster(definition, state, ids)`. Devuelve fase `prepare` y conserva los IDs seleccionados. La operación no abre la caja ni cambia los miembros al reanudarse.
3. Consultar `specialEvolutionOptions` y aplicar `evolveRecruit` a los miembros fijados que se desee evolucionar. Con cero victorias, Togepi puede pasar a Togetic, o Eevee a Espeon/Umbreon según `period` (`day` por defecto; pasar `night` para Umbreon).
4. Persistir los estados de preparación con `LocalCampaignStore.write(state, null, revision)` usando la revisión leída y sin un combate pendiente. Conservar la revisión devuelta para la siguiente escritura.
5. Consultar `availableCampaignMoves(definition, state, member)` y preparar los sets. `beginCampaignBattle` también valida el calendario; el worker no acepta una lista de MT adelantadas suministrada por el llamador.

`startEncounter` conserva el cierre implícito de plantilla para los consumidores anteriores; ese camino no ofrece una pausa para evolucionar antes del primer combate. La interfaz de Liga debe usar la operación explícita del paso 2. Tras fijarla, no se puede sustituir a un miembro desde la caja; las evoluciones conservan su ID y los caídos no pueden evolucionar.

Fuera de la excepción de Liga, el contador exige tres victorias con el miembro alineado y superviviente. Ganar con el Pokémon en el equipo cuenta aunque no llegue a salir al campo; la caja no suma victorias. Evolucionar conserva el contador. Es independiente de la amistad 255 de los sets: no se concede Blissey ni Crobat por fijar esa potencia de Retroceso.

Feebas ofrece Milotic desde la preparación anterior a Alana, sin requerir victorias, objeto ni minijuego. Nincada evoluciona a Ninjask desde nivel 20, incluido al reclutarlo con un tope superior; no se crea una copia de Shedinja. Tyrogue ofrece sus tres evoluciones desde nivel 20 y el jugador elige. Wurmple usa `nuzlocke-wurmple:v1`, semilla de campaña e ID del miembro para la rama; el historial registra la rama elegida y las evoluciones encadenadas a niveles 7 y 10. Recargar o cambiar de hito no repite una elección ya aplicada.

## Generación, validación y límites

```sh
# Evidencia primaria: requiere la revisión fijada; no cambia el calendario aplicado.
npm run gen:emerald-items -- --source-dir /ruta/pokeemerald-731ad5bfd6e6f265508d0efcca0ba42f9dcf5881 --check

# Política aprobada: se genera sin red a partir de la evidencia versionada.
npm run gen:emerald-calendar
npm run gen:emerald-calendar -- --check
npm run validate:data
```

El [generador](../../scripts/build-emerald-calendar.mjs) produce `hoenn-emerald-calendar.json`, con versión de reglas `hoenn-emerald:2026-11-11`. `--check` exige igualdad byte a byte sin sobrescribir; `validate:data` verifica también la coherencia semántica del calendario con las evidencias y decisiones. Los [SHA-256 de la extracción](../../data/nuzlocke/emerald-item-source-lock.json) siguen fijados a la revisión de Esmeralda.

La versión de reglas forma parte de la identidad del combate. Un combate guardado con reglas anteriores debe superar la reconstrucción exacta del worker antes de continuar: no se sustituyen silenciosamente sus movimientos, amistad ni checkpoints. El registro local conserva los bytes que no puede validar. Los estados de preparación anteriores mantienen su formato local; el consumo se reconstruye del historial, no se rellena con unidades nuevas.

Las pruebas del [calendario](../../scripts/build-emerald-calendar.test.ts) cubren fechas, fuentes, MO y reproducción; las del [núcleo](../../src/core/nuzlocke/calendar.test.ts) cubren selección legal en el worker, consumo y elección al reanudar, amistad, Liga, belleza y ramas. Los tests de Poder Oculto usan el hito de Erico para MT10: la antigua concesión artificial antes de Petra queda reemplazada por la fecha aprobada sin relajar las comprobaciones de IV, evolución ni reanudación.

La política de draft aprobada se documenta en [SIMULACION-DRAFT.md](SIMULACION-DRAFT.md); el guardado por cuenta corresponde a D4 y los nombres por época a D6. Este calendario no crea pantallas, no implementa un modo posliga y no modifica los datos ni las reglas del reto diario.
