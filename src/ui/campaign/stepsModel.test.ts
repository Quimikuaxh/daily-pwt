import { describe, expect, it } from 'vitest'
import { createCampaign, type CampaignState } from '../../core/nuzlocke/campaign'
import { campaignSteps } from './stepsModel'

// UT-196 · Qué viene en la campaña (Jose, 12/11/2026): pasos del tramo y paso actual.
const at = (over: Partial<CampaignState>) => ({ ...createCampaign('pasos'), ...over }) as CampaignState

describe('pasos del tramo', () => {
  it('gimnasio: Reclutar → Equipo → Combate, con la elección en curso', () => {
    expect(campaignSteps(at({ phase: 'draft', pick: 1 }), 2, false, false)).toEqual({ steps: ['recruit', 'team', 'battle'], current: 'recruit', pick: { n: 2, total: 2 } })
    expect(campaignSteps(at({ phase: 'prepare' }), 2, false, false)).toMatchObject({ current: 'team', pick: null })
  })

  it('Liga: Evolución si hay alguna, Participantes y, con la plantilla fijada, solo Combate', () => {
    expect(campaignSteps(at({ phase: 'prepare' }), 3, true, true)).toMatchObject({ steps: ['recruit', 'evolve', 'team', 'roster', 'battle'], current: 'evolve' })
    expect(campaignSteps(at({ phase: 'prepare', leagueEvolved: true }), 3, true, false)).toMatchObject({ steps: ['recruit', 'evolve', 'team', 'roster', 'battle'], current: 'team' })
    expect(campaignSteps(at({ phase: 'prepare' }), 3, true, false)).toMatchObject({ steps: ['recruit', 'team', 'roster', 'battle'], current: 'team' })
    expect(campaignSteps(at({ phase: 'prepare', leagueRoster: ['a'] }), 3, true, false)).toEqual({ steps: ['battle'], current: 'battle', pick: null })
  })
})
