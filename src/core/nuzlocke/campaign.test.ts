import { describe, expect, it } from 'vitest'
import { chooseRecruit, createCampaign, evolveRecruit, finishEncounter, openDraft, specialEvolutionOptions, startEncounter, type CampaignDefinition, type CampaignState } from './campaign'

const ids = Array.from({ length: 12 }, (_, index) => `mon${index}`)
const definition: CampaignDefinition = {
  encounters: [
    { id: 'gym1', kind: 'gym', team: [{ species: 'mon0', level: 12 }, { species: 'mon0', level: 15 }] },
    { id: 'gym2', kind: 'gym', team: [{ species: 'mon1', level: 20 }] },
    { id: 'elite', kind: 'elite', team: [{ species: 'mon2', level: 40 }] },
    { id: 'champion', kind: 'champion', team: [{ species: 'mon3', level: 45 }] },
  ],
  species: Object.fromEntries(ids.map(id => [id, { baseStatTotal: 300, levelUp: [], machines: [], evolutions: [] }])),
}
const window = { below: 0, above: 0 }
const candidates = ids
const offer = (state: CampaignState) => openDraft(definition, state, candidates, window)
function recruitAll(initial: CampaignState) {
  let state = initial
  while (state.phase === 'draft') {
    state = offer(state)
    state = chooseRecruit(definition, state, state.offer[0])
  }
  return state
}

describe('estado de campaña', () => {
  it('rechaza especies desconocidas antes de guardar una oferta', () => {
    const initial = createCampaign('hoenn')
    expect(() => openDraft(definition, initial, [...ids, 'unknown'], window)).toThrow(/unknown/i)
    expect(initial.offer).toEqual([])
  })

  it('abre cuatro elecciones iniciales, conserva una oferta abierta y descarta el resto', () => {
    const initial = createCampaign('hoenn')
    const first = offer(initial)
    expect(offer(first)).toBe(first)
    expect(first.offer).toHaveLength(4)
    expect(() => chooseRecruit(definition, first, 'out')).toThrow(/oferta/i)
    const picked = chooseRecruit(definition, first, first.offer[0])
    expect(picked.members.map(member => member.species)).toEqual([first.offer[0]])
    expect(offer(picked).offer.every(species => !first.offer.includes(species))).toBe(true)
    expect(recruitAll(initial).members).toHaveLength(4)
  })

  it('respeta la capacidad del líder y marca bajas según el orden de combate', () => {
    const prepared = recruitAll(createCampaign('hoenn'))
    const [a, b, c] = prepared.members
    expect(() => startEncounter(definition, prepared, [a.id, b.id, c.id])).toThrow(/equipo/i)
    const playing = startEncounter(definition, prepared, [b.id, a.id])
    expect(() => finishEncounter(definition, playing, true, [true])).toThrow(/bajas/i)
    const after = finishEncounter(definition, playing, true, [true, false])
    expect(after.members.find(member => member.id === b.id)?.fainted).toBe(true)
    expect(after.members.find(member => member.id === a.id)?.level).toBe(20)
    // Jose, 12/11/2026: se guarda la alineación para arrancar con ella el equipo del tramo siguiente.
    expect(after.lastTeam).toEqual([b.id, a.id])
    const next = recruitAll(after)
    expect(next.members).toHaveLength(6)
    expect(() => startEncounter(definition, next, [b.id])).toThrow(/equipo/i)
    expect(startEncounter(definition, next, [a.id]).phase).toBe('battle')
  })

  it('bloquea la plantilla de la Liga y llega al campeón con los supervivientes', () => {
    let state = recruitAll(createCampaign('hoenn'))
    for (let i = 0; i < 2; i++) {
      state = startEncounter(definition, state, [state.members[0].id])
      state = recruitAll(finishEncounter(definition, state, true, [false]))
    }
    const [a, b, c] = state.members
    state = startEncounter(definition, state, [a.id, b.id])
    state = finishEncounter(definition, state, true, [true, false])
    expect(state.phase).toBe('prepare')
    expect(() => startEncounter(definition, state, [b.id, c.id])).toThrow(/liga/i)
    state = startEncounter(definition, state)
    expect(state.battleTeam).toEqual([b.id])
    expect(state.members.find(member => member.id === b.id)?.level).toBe(45)
    expect(finishEncounter(definition, state, true, [false]).phase).toBe('won')
  })

  it('termina la partida al perder aunque queden miembros en la caja', () => {
    const ready = recruitAll(createCampaign('hoenn'))
    const battle = startEncounter(definition, ready, [ready.members[0].id])
    const result = finishEncounter(definition, battle, false, [true])
    expect(result.phase).toBe('lost')
    expect(result.members.filter(member => !member.fainted)).toHaveLength(3)
    expect(() => openDraft(definition, result, candidates, window)).toThrow(/draft/i)
  })
})

describe('evoluciones especiales de campaña', () => {
  const initial = recruitAll(createCampaign('hoenn'))
  const [a, b, benched] = initial.members
  const withRules: CampaignDefinition = {
    ...definition,
    species: {
      ...definition.species,
      [a.species]: {
        ...definition.species[a.species],
        evolutions: [
          { method: 'ITEM', parameter: 'leafstone', target: 'mon0' },
          { method: 'TRADE_ITEM', parameter: 'kingsrock', target: 'mon1' },
          { method: 'FRIENDSHIP_DAY', parameter: 0, target: 'mon2' },
          { method: 'FRIENDSHIP_NIGHT', parameter: 0, target: 'mon3' },
        ],
      },
    },
  }
  const locked = { unlockedItems: new Set<string>(), friendshipWins: 1, period: 'day' } as const

  it('respeta los objetos desbloqueados y conserva identidad, nivel e historial', () => {
    expect(specialEvolutionOptions(withRules, initial, a.id, locked)).toEqual([])
    const unlocked = { ...locked, unlockedItems: new Set(['leafstone', 'kingsrock']) }
    expect(specialEvolutionOptions(withRules, initial, a.id, unlocked)).toEqual(['mon0', 'mon1'])
    expect(() => evolveRecruit(withRules, initial, a.id, 'mon2', unlocked)).toThrow(/evoluci/i)
    const evolved = evolveRecruit(withRules, initial, a.id, 'mon1', unlocked)
    expect(evolved.members[0]).toMatchObject({
      id: a.id, species: 'mon1', level: 15, history: [{ species: a.species, evolvedAt: 15 }],
    })
    expect(initial.members[0]).toBe(a)
  })

  it('cuenta amistad solo para quien sale vivo de un combate ganado y distingue día y noche', () => {
    const playing = startEncounter(withRules, initial, [a.id, b.id])
    const after = recruitAll(finishEncounter(withRules, playing, true, [false, true]))
    expect(after.members.slice(0, 3).map(member => member.victories)).toEqual([1, 0, 0])
    expect(specialEvolutionOptions(withRules, after, a.id, locked)).toEqual(['mon2'])
    expect(specialEvolutionOptions(withRules, after, a.id, { ...locked, period: 'night' })).toEqual(['mon3'])
    expect(() => evolveRecruit(withRules, after, b.id, 'mon2', locked)).toThrow()
    expect(() => evolveRecruit(withRules, { ...after, leagueRoster: [a.id] }, benched.id, 'mon2', locked)).toThrow(/liga/i)
  })

  it('ofrece intercambio simple durante la preparación', () => {
    const trade: CampaignDefinition = {
      ...definition,
      species: {
        ...definition.species,
        [a.species]: { ...definition.species[a.species], evolutions: [{ method: 'TRADE', parameter: 0, target: 'mon0' }] },
      },
    }
    expect(specialEvolutionOptions(trade, initial, a.id, locked)).toEqual(['mon0'])
    expect(() => evolveRecruit(trade, startEncounter(trade, initial, [a.id]), a.id, 'mon0', locked)).toThrow()
  })
})
