import { afterEach, beforeEach, vi } from 'vitest'
import catalog from '../../data/nuzlocke/hoenn-emerald.json'
import progression from '../../data/nuzlocke/hoenn-emerald-progression.json'
import type { CampaignDefinition } from '../core/nuzlocke/campaign'
import { routePlaces, type CampaignEncounter } from '../ui/campaign/hoennRoute'

export const campaignEncounters = catalog.encounters as readonly CampaignEncounter[]
export const campaignDefinition = { encounters: campaignEncounters, species: progression.species } as unknown as CampaignDefinition
export const campaignPlaces = routePlaces(campaignEncounters)

/** jsdom no pinta el texto bitmap: comprobar roles y textos accesibles como console.test.tsx. */
export function mockCampaignCanvas() {
  beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
    // jsdom no descarga imágenes (`complete` siempre es false): sin esto, cada pantalla esperaría 1,5 s oculta (`RevealWhenLoaded`).
    vi.spyOn(HTMLImageElement.prototype, 'complete', 'get').mockReturnValue(true)
  })
  afterEach(() => { vi.restoreAllMocks() })
}
