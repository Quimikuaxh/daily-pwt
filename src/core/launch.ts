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
