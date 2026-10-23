/**
 * Fecha de lanzamiento (día #1), fijada por Jose el 23/10/2026. Cambiarla cambia los retos ya publicados (README, «Lanzamiento»).
 * Vive en core/ porque core/ no puede importar fuera de sí mismo (test de aislamiento);
 * se edita aquí y src/config.ts lo reexporta.
 */
export const LAUNCH_DATE = '2026-10-24'
