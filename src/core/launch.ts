/**
 * Fecha de lanzamiento (día #1), fijada por Jose el 23/10/2026. Cambiarla cambia los retos ya publicados (README, «Lanzamiento»).
 * Vive en core/ porque core/ no puede importar fuera de sí mismo (test de aislamiento);
 * se edita aquí y src/config.ts lo reexporta.
 */
export const LAUNCH_DATE = '2026-10-24'

/**
 * Apertura del lanzamiento: en el primer ciclo de la bolsa, cada entrenador de esta lista pasa al día de su posición (#1, #2…) y quien
 * estaba ahí ocupa su hueco; así cada uno sigue saliendo una vez por ciclo (DEC-03, `bag.ts`). Misty de #1 (Jose, 23/10/2026); el 27/10/2026,
 * al repartir campeones y regiones (DEC-62), se fijan los cuatro ya publicados (#1 a #4) para que no cambien.
 */
export const LAUNCH_OPENING: readonly string[] = ['misty', 'fredo', 'anton', 'mirto']

/**
 * Desde este día se generan los equipos del jugador con las reglas del 28/10/2026 (decisiones de Jose): RF-12b, sin dos formas de la misma
 * especie (Thundurus y Thundurus-Therian), y RF-13d, suma de estadísticas base entre la del rival − 180 y la del rival + 240 (en vez de
 * RF-13b, ≥ 3060). Los retos anteriores ya publicados se quedan como estaban. Al desplegar, debe ser el día siguiente al despliegue: un
 * día ya publicado que cambie de reglas cambia su equipo.
 */
export const TEAM_RULES_2_FROM = '2026-10-29'

/**
 * Desde este día se aplica la ventana de BST_WINDOW_2. Fija la fecha al día siguiente del despliegue para conservar
 * los retos ya publicados.
 */
export const BST_WINDOW_2_FROM = '2026-11-10'

/**
 * Desde este día cada Pokémon del reto (del jugador y del rival) tiene género, con la proporción de su especie (Jose, 03/11/2026); los sin
 * género (Metagross), ninguno. Cuenta en el combate (Atracción, Rivalidad…). Adelantado al mismo día del despliegue, el 03/11/2026, por
 * decisión de Jose (cambia el reto de ese día para quien aún no lo había jugado); los anteriores no cambian.
 */
export const GENDERS_FROM = '2026-11-03'

/**
 * Desde este día el equipo del jugador ya no sale de los sets del PWT sin sinergia (Jose, 04/11/2026; DEC-79): los marcados con
 * `quality:no-synergy` en `data/player-sets.json` (regla en `scripts/lib/set-synergy.mjs`). De Smogon, solo los que están dentro por Rayo Solar. Como las otras: al
 * desplegar, el día siguiente al despliegue.
 */
export const POOL_RULES_FROM = '2026-11-05'

/** Etiqueta de esos sets (la pone `gen:player-sets`). */
export const NO_SYNERGY_TAG = 'quality:no-synergy'
