/**
 * Fecha de lanzamiento (día #1), fijada por Jose el 23/10/2026. Cambiarla cambia los retos ya publicados (README, «Lanzamiento»).
 * Vive en core/ porque core/ no puede importar fuera de sí mismo (test de aislamiento);
 * se edita aquí y src/config.ts lo reexporta.
 */
export const LAUNCH_DATE = '2026-10-24'

/**
 * Apertura del lanzamiento (Jose, 23/10/2026): el reto #1 es Misty. En el primer ciclo de la bolsa, cada entrenador de esta lista pasa al
 * día de su posición (#1, #2…) y quien estaba ahí ocupa su hueco; así cada uno sigue saliendo una vez por ciclo (DEC-03, `bag.ts`).
 */
export const LAUNCH_OPENING: readonly string[] = ['misty']
