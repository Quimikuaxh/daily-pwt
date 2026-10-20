/**
 * Provisional (F1). Se fija en F2 y entonces se regeneran los snapshots.
 * Vive en core/ porque core/ no puede importar fuera de sí mismo (test de aislamiento);
 * se edita aquí y src/config.ts lo reexporta.
 */
export const LAUNCH_DATE = '2026-10-19'
