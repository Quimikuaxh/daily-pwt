import { describe, expect, it } from 'vitest'
import { loadGameData } from '../../data/gameData'
import { createCampaign, finishEncounter } from '../../core/nuzlocke/campaign'
import { unovaKit } from '../campaign-unova/unovaKit'
import { hoennKit } from './campaignKit'
import { campaignRewards } from './campaignRewards'

describe('recompensas al pasar de tramo', () => {
  const data = loadGameData()
  it.each([[hoennKit, 1, 'tm39'], [unovaKit, 3, 'tm76']] as const)('solo enseña las MT y los objetos nuevos del tramo %s', (kit, encounterIndex, machine) => {
    const after = { ...createCampaign('premio', undefined, kit.id), encounterIndex, purchases: ['leftovers'] }
    const rewards = campaignRewards(after, kit.definition, kit.rules, (state) => kit.bagContents(state, 'machines', '', data))
    expect(rewards.machines.map(({ id }) => id)).toContain(machine)
    expect(rewards.items.some(({ id }) => id === 'leftovers')).toBe(false)
  })

  it('marca el aviso solo al ganar un gimnasio y avanzar', () => {
    const start = { ...createCampaign('premio', undefined, unovaKit.id), phase: 'battle' as const, battleTeam: ['a'] }
    const member = { id: 'a', species: 'tepig', level: 13, history: [], fainted: false, victories: 0 }
    const battle = { ...start, members: [member] }
    expect(finishEncounter(unovaKit.definition, battle, true, [false])).toMatchObject({ encounterIndex: 1, pendingRewards: true })
    expect(finishEncounter(unovaKit.definition, battle, false, [true]).pendingRewards).toBeUndefined()
  })
})
