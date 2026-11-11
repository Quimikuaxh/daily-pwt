import { describe, expect, it } from 'vitest'
import { readJson } from '../../test-utils/paths'
import { createCampaign, evolveForLeague, evolveRecruit, leagueEvolutionTargets, lockLeagueRoster, type CampaignState } from './campaign'
import { availableCampaignMoves } from './progression'
import { campaignEvolutionItems, chooseScannerItem } from './calendar'
import type { CampaignBattleDefinition } from './battle'
import { CAMPAIGN_STORAGE_KEY, LocalCampaignStore } from '../../storage/campaignStore'
import { MemoryStorage } from '../../test-utils/memoryStorage'

const { encounters } = readJson<Pick<CampaignBattleDefinition, 'encounters'>>('data', 'nuzlocke', 'hoenn-emerald.json')
const { species } = readJson<Pick<CampaignBattleDefinition, 'species'>>('data', 'nuzlocke', 'hoenn-emerald-progression.json')
const definition = { encounters, species }
const ready = (...ids: string[]): CampaignState => ({
  ...createCampaign('league-evolutions'), encounterIndex: 8, phase: 'prepare',
  members: ids.map((species, i) => ({ id: `member-${i}`, species,
    level: Math.max(...encounters[8].team.map(mon => mon.level)), history: [], victories: 0, fainted: false })),
})

describe('evoluciones de la Liga con el catálogo real de Esmeralda (DEC-93)', () => {
  it.each([
    ['larvitar', ['tyranitar']], ['pupitar', ['tyranitar']], ['bagon', ['salamence']],
    ['tyrogue', ['hitmonchan', 'hitmonlee', 'hitmontop']], ['eevee', ['espeon', 'umbreon']],
    ['gloom', ['gloom']], ['poliwhirl', ['poliwhirl']], ['onix', ['onix']], ['clamperl', ['clamperl']],
    ['kadabra', ['alakazam']], ['feebas', ['milotic']], ['togepi', ['togetic']],
    ['nincada', ['ninjask']], ['mew', ['mew']],
  ])('enumera únicamente las formas finales sin objeto de %s', (id, targets) => {
    expect(leagueEvolutionTargets(definition, id)).toEqual(targets)
  })

  it.each([
    ['larvitar', 'tyranitar', ['larvitar', 'pupitar']],
    ['pupitar', 'tyranitar', ['pupitar']],
    ['bagon', 'salamence', ['bagon', 'shelgon']],
  ])('lleva %s a %s al nivel actual y conserva cada intermedia y sus movimientos', (id, final, stages) => {
    const initial = ready(id)
    const before = structuredClone(initial)
    const evolved = evolveForLeague(definition, initial)
    const member = evolved.members[0]
    expect(member).toEqual({ ...initial.members[0], species: final,
      history: stages.map(species => ({ species, evolvedAt: initial.members[0].level })) })
    expect(evolved.leagueEvolved).toBe(true)
    expect(initial).toEqual(before)
    const moves = availableCampaignMoves(definition, evolved, member)
    for (const stage of [...stages, final]) {
      for (const entry of species[stage].levelUp.filter(entry => entry.level <= member.level)) expect(moves).toContain(entry.move)
    }
    // Esmeralda: Bagon aprende Triturar al 41; Shelgon y Salamence al 56 y 61.
    if (id === 'bagon') {
      expect(moves).toContain('crunch')
      expect(moves).toContain('protect')
      expect(moves).not.toContain('doubleedge') // Bagon 53; Salamence 93; sin MT de campaña.
    }
    if (id === 'larvitar') expect(moves).toContain('earthquake') // Larvitar 50, Tyranitar 61.
  })

  it('resuelve intercambio sin objeto, amistad y belleza sin victorias ni condiciones adicionales', () => {
    const evolved = evolveForLeague(definition, ready('kadabra', 'togepi', 'feebas', 'nincada'))
    expect(evolved.members.map(member => member.species)).toEqual(['alakazam', 'togetic', 'milotic', 'ninjask'])
    expect(evolved.members).toHaveLength(4)
    expect(evolved.members.every(member => member.victories === 0)).toBe(true)
  })

  it('conserva el historial previo, el prefijo de reclutamiento y la identidad', () => {
    const initial = ready('pupitar')
    initial.members = [{ ...initial.members[0], history: [{ species: 'larvitar', evolvedAt: 30 }], recruitmentHistoryLength: 1,
      victories: 3, item: 'quickclaw' }]
    expect(evolveForLeague(definition, initial).members[0]).toEqual({ ...initial.members[0], species: 'tyranitar',
      history: [{ species: 'larvitar', evolvedAt: 30 }, { species: 'pupitar', evolvedAt: initial.members[0].level }] })
  })

  it.each([
    ['tyrogue', ['hitmonchan', 'hitmonlee', 'hitmontop']], ['eevee', ['espeon', 'umbreon']],
  ])('%s exige elección explícita y acepta todas sus ramas sin objeto', (id, targets) => {
    const initial = ready(id)
    expect(() => evolveForLeague(definition, initial)).toThrow(/elige/i)
    for (const invalid of [id, 'missing', 'jolteon', 'tyranitar']) {
      expect(() => evolveForLeague(definition, initial, { 'member-0': invalid })).toThrow(/elige/i)
    }
    for (const target of targets) {
      expect(evolveForLeague(definition, initial, { 'member-0': target }).members[0]).toMatchObject({
        species: target, victories: 0, history: [{ species: id, evolvedAt: initial.members[0].level }],
      })
    }
    expect(initial.members[0].species).toBe(id)
  })

  it('aplica toda la caja, omite los caídos y es idempotente incluso tras guardar y releer', () => {
    const initial = ready('bagon', 'larvitar', 'eevee', 'tyrogue')
    initial.members = initial.members.map((member, i) => i >= 2 ? { ...member, fainted: true } : member)
    const evolved = evolveForLeague(definition, initial)
    expect(evolved.members.map(member => member.species)).toEqual(['salamence', 'tyranitar', 'eevee', 'tyrogue'])
    expect(evolved.members.slice(2)).toEqual(initial.members.slice(2))
    expect(evolveForLeague(definition, evolved)).toBe(evolved)
    const storage = new MemoryStorage()
    new LocalCampaignStore(storage).write(evolved, null, 0)
    const restored = new LocalCampaignStore(storage).read()!.state
    expect(evolveForLeague(definition, restored, { 'member-2': 'umbreon' })).toBe(restored)
    expect(restored).toEqual(evolved)
    expect(lockLeagueRoster(definition, restored, ['member-0']).leagueRoster).toEqual(['member-0'])
  })

  it('solo admite preparación de Liga con la plantilla aún abierta', () => {
    const initial = ready('mew')
    for (const phase of ['draft', 'battle', 'won', 'lost'] as const) {
      expect(() => evolveForLeague(definition, { ...initial, phase })).toThrow(/preparar/i)
    }
    expect(() => evolveForLeague(definition, { ...initial, encounterIndex: 7 })).toThrow(/preparar/i)
    const locked = lockLeagueRoster(definition, evolveForLeague(definition, initial), ['member-0'])
    expect(() => evolveForLeague(definition, locked)).toThrow(/plantilla/i)
    expect(() => lockLeagueRoster(definition, initial, ['member-0'])).toThrow(/evoluciones/i)
    expect(() => lockLeagueRoster(definition, { ...initial, leagueEvolved: false }, ['member-0'])).toThrow(/evoluciones/i)
  })

  it('mantiene opcionales las evoluciones por objeto y consume su unidad con evolveRecruit', () => {
    const initial = chooseScannerItem(definition, ready('gloom', 'poliwhirl', 'onix', 'clamperl'), 'deepseatooth')
    const evolved = evolveForLeague(definition, initial)
    expect(evolved.members).toEqual(initial.members)
    expect(campaignEvolutionItems(definition, evolved)).toEqual(campaignEvolutionItems(definition, initial))
    for (const [index, target, item] of [[0, 'vileplume', 'leafstone'], [1, 'poliwrath', 'waterstone'], [3, 'huntail', 'deepseatooth']] as const) {
      expect(campaignEvolutionItems(definition, evolved).has(item)).toBe(true)
      const optional = evolveRecruit(definition, evolved, `member-${index}`, target)
      expect(optional.members[index].species).toBe(target)
      expect(campaignEvolutionItems(definition, optional).has(item)).toBe(false)
    }
    // El calendario nativo excluye Revestimiento Metálico; el contrato genérico sí permite usarlo.
    expect(campaignEvolutionItems(definition, evolved).has('metalcoat')).toBe(false)
    const generic = { ...definition, encounters: [{ ...encounters[8], id: 'other-league' }] }
    const other = { ...ready('onix'), encounterIndex: 0 }
    expect(() => evolveRecruit(generic, other, 'member-0', 'steelix')).toThrow()
    expect(evolveRecruit(generic, other, 'member-0', 'steelix', { unlockedItems: new Set(['metalcoat']) }).members[0].species).toBe('steelix')
  })
})

describe('guardado local de leagueEvolved', () => {
  it.each([undefined, false, true])('conserva el valor válido %s', leagueEvolved => {
    const storage = new MemoryStorage()
    const state = { ...ready('mew'), leagueEvolved }
    new LocalCampaignStore(storage).write(state, null, 0)
    expect(new LocalCampaignStore(storage).read()!.state.leagueEvolved).toBe(leagueEvolved)
  })

  it.each([null, 0, 1, 'true', [], {}])('rechaza %j sin sobrescribir el guardado', leagueEvolved => {
    const storage = new MemoryStorage()
    const state = ready('mew')
    const record = { version: 1, revision: 1, battle: null, state: { ...state, leagueEvolved } }
    const raw = JSON.stringify(record)
    storage.setItem(CAMPAIGN_STORAGE_KEY, raw)
    const store = new LocalCampaignStore(storage)
    expect(() => store.read()).toThrow(/conservado/)
    expect(() => store.write(state, null, 1)).toThrow(/conservado/)
    expect(storage.getItem(CAMPAIGN_STORAGE_KEY)).toBe(raw)
    const valid = new LocalCampaignStore(new MemoryStorage())
    expect(() => valid.write(record.state as unknown as CampaignState, null, 0)).toThrow(/guardar/)
    expect(valid.read()).toBeNull()
  })
})
