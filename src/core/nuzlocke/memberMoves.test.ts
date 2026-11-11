import { describe, expect, it } from 'vitest'
import catalog from '../../../data/nuzlocke/hoenn-emerald.json'
import progression from '../../../data/nuzlocke/hoenn-emerald-progression.json'
import { createCampaign, type CampaignDefinition, type CampaignState } from './campaign'
import { availableCampaignMoves, campaignMemberMoves, defaultMoves, setCampaignMemberMoves, type ProgressionDex } from './progression'

// UT-175 · Movimientos guardados por miembro (D7, pantalla Movimientos).
const definition = { encounters: catalog.encounters, species: progression.species } as unknown as CampaignDefinition
const dex: ProgressionDex = {
  seed: { levelUp: [{ level: 1, move: 'tackle' }, { level: 4, move: 'growl' }, { level: 7, move: 'absorb' }, { level: 9, move: 'growth' }, { level: 11, move: 'leer' }], machines: [], evolutions: [] },
  bud: { levelUp: [{ level: 1, move: 'tackle' }, { level: 12, move: 'vinewhip' }], machines: [], evolutions: [] },
}
const member = (species: string, level: number, extra: object = {}) => ({ id: `${species}-1`, species, level, history: [], fainted: false, victories: 0, ...extra })
const withMember = (m: ReturnType<typeof member>): CampaignState => ({ ...createCampaign('ut175'), phase: 'prepare', members: [m] } as unknown as CampaignState)

describe('movimientos por defecto', () => {
  it('son los cuatro últimos aprendidos por nivel, como en el juego', () => {
    expect(defaultMoves(dex, { species: 'seed', level: 10, history: [] })).toEqual(['tackle', 'growl', 'absorb', 'growth'])
    expect(defaultMoves(dex, { species: 'seed', level: 11, history: [] })).toEqual(['growl', 'absorb', 'growth', 'leer'])
  })

  it('recorren las formas anteriores hasta el nivel en que evolucionaron', () => {
    expect(defaultMoves(dex, { species: 'bud', level: 12, history: [{ species: 'seed', evolvedAt: 8 }] })).toEqual(['tackle', 'growl', 'absorb', 'vinewhip'])
  })
})

describe('movimientos elegidos', () => {
  it('se guardan si son legales y se usan en combate; si no hay elegidos, los de por defecto', () => {
    const state = withMember(member('treecko', 19))
    const legal = availableCampaignMoves(definition, state, state.members[0])
    expect(campaignMemberMoves(definition, state, state.members[0])).toEqual(defaultMoves(definition.species, state.members[0]))
    const chosen = legal.slice(0, 2)
    const saved = setCampaignMemberMoves(definition, state, 'treecko-1', chosen)
    expect(saved.members[0].moves).toEqual(chosen)
    expect(campaignMemberMoves(definition, saved, saved.members[0])).toEqual(chosen)
  })

  it('rechaza movimientos ilegales, más de cuatro, repetidos o para un debilitado', () => {
    const state = withMember(member('treecko', 19))
    expect(() => setCampaignMemberMoves(definition, state, 'treecko-1', ['hydropump'])).toThrow()
    expect(() => setCampaignMemberMoves(definition, state, 'treecko-1', ['pound', 'pound'])).toThrow()
    expect(() => setCampaignMemberMoves(definition, state, 'treecko-1', [])).toThrow()
    expect(() => setCampaignMemberMoves(definition, withMember(member('treecko', 19, { fainted: true })), 'treecko-1', ['pound'])).toThrow()
  })

  it('si un elegido deja de ser legal, combate con los de por defecto', () => {
    const state = withMember(member('treecko', 19, { moves: ['hydropump'] }))
    expect(campaignMemberMoves(definition, state, state.members[0])).toEqual(defaultMoves(definition.species, state.members[0]))
  })
})
