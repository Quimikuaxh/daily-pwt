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
