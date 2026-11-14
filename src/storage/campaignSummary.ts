/**
 * Lo mínimo del guardado de la campaña para el menú Modos de juego («En curso · Medallas n/8»): de qué campaña es, en qué tramo y en qué
 * fase. Aparte de `campaignStore` (que valida el registro entero) para no meter esa validación en el bloque del reto diario (E2E-21).
 */
export const CAMPAIGN_STORAGE_KEY = 'daily-pwt:nuzlocke:v1'

export type CampaignSummary = { campaign?: string; phase: string; encounterIndex: number }

/** El resumen de la partida guardada en este navegador, o `null` si no hay o no se entiende. */
export function readCampaignSummary(storage: Storage | null): CampaignSummary | null {
  try {
    const raw = storage?.getItem(CAMPAIGN_STORAGE_KEY)
    const state = raw ? (JSON.parse(raw) as { state?: Partial<CampaignSummary> }).state : null
    if (!state || typeof state.phase !== 'string' || typeof state.encounterIndex !== 'number') return null
    return { phase: state.phase, encounterIndex: state.encounterIndex, ...(typeof state.campaign === 'string' ? { campaign: state.campaign } : {}) }
  } catch {
    return null
  }
}
