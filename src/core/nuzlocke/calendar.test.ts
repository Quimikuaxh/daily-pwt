import { describe, expect, it } from 'vitest'
import { readJson } from '../../test-utils/paths'
import { createCampaign, chooseRecruit, evolveRecruit, specialEvolutionOptions, evolveForLeague, lockLeagueRoster, type CampaignState } from './campaign'
import { campaignEvolutionItems, chooseScannerItem } from './calendar'
import { advanceLevel, availableCampaignMoves } from './progression'
import { beginCampaignBattle, type CampaignBattleDefinition } from './battle'
import { CAMPAIGN_STORAGE_KEY, LocalCampaignStore } from '../../storage/campaignStore'
import { MemoryStorage } from '../../test-utils/memoryStorage'
import { createBattleEngine } from '../../battle/engine'
import { computeDamage } from '../../battle/damage'
import { createWorkerHandler } from '../../battle/messages'
import { campaignInput } from '../../test-utils/campaign'

const { encounters } = readJson<Pick<CampaignBattleDefinition, 'encounters'>>('data', 'nuzlocke', 'hoenn-emerald.json')
const { species } = readJson<Pick<CampaignBattleDefinition, 'species'>>('data', 'nuzlocke', 'hoenn-emerald-progression.json')
const definition = { encounters, species }
function ready(index: number, ...ids: string[]): CampaignState {
  return { ...createCampaign('calendar'), encounterIndex: index, phase: 'prepare',
    members: ids.map((species, i) => ({ id: `member-${i}`, species, level: Math.max(...encounters[index].team.map(mon => mon.level)), history: [], victories: 0, fainted: false })) }
}
const options = (state: CampaignState, index = 0, period: 'day' | 'night' = 'day') =>
  specialEvolutionOptions(definition, state, state.members[index].id, { period })

describe('calendario consumido por el núcleo', () => {
  it('desbloquea por recepción, reúne preevoluciones y rechaza MT inyectadas antes de tiempo', () => {
    const petra = ready(0, 'treecko')
    expect(availableCampaignMoves(definition, petra, petra.members[0])).toContain('cut')
    expect(availableCampaignMoves(definition, petra, petra.members[0])).not.toContain('hiddenpower')
    expect(() => beginCampaignBattle(definition, petra, {
      unlockedMoves: new Set(['hiddenpower']), movesByMember: { 'member-0': ['hiddenpower'] },
    }, ['member-0'])).toThrow(/movimiento/i)
    const erico = ready(2, 'grovyle')
    erico.members = [{ ...erico.members[0], history: [{ species: 'treecko', evolvedAt: 16 }] }]
    expect(availableCampaignMoves(definition, erico, erico.members[0])).toEqual(expect.arrayContaining(['hiddenpower', 'pursuit', 'cut']))
    const prep = { unlockedMoves: new Set<string>(), movesByMember: { 'member-0': ['hiddenpower', 'cut'] } }
    expect(beginCampaignBattle(definition, erico, prep, ['member-0']).init.player[0].moves).toEqual(['hiddenpower', 'cut'])
    expect(beginCampaignBattle(definition, erico, prep, ['member-0']).init.player[0].moves).toEqual(['hiddenpower', 'cut'])
  })

  it('consume una piedra por campaña, incluso después de caer su usuario y de tres guardados', () => {
    const storage = new MemoryStorage()
    let store = new LocalCampaignStore(storage)
    let state = ready(5, 'eevee', 'eevee')
    expect(options(state)).toContain('jolteon')
    store.write(state, null, 0)
    state = evolveRecruit(definition, store.read()!.state, 'member-0', 'jolteon')
    store.write(state, null, 1)
    store = new LocalCampaignStore(storage)
    expect(options(store.read()!.state, 1)).not.toContain('jolteon')
    state = { ...store.read()!.state, members: state.members.map((m, i) => i ? m : { ...m, fainted: true }) }
    store.write(state, null, 2)
    expect(campaignEvolutionItems(definition, new LocalCampaignStore(storage).read()!.state)).not.toContain('thunderstone')
    expect(() => evolveRecruit(definition, state, 'member-1', 'jolteon', { unlockedItems: new Set(['thunderstone']) })).toThrow()
    expect(options(state, 1)).toContain('flareon')
  })

  it('solo habilita una elección del Escáner y una evolución con la unidad elegida', () => {
    expect(() => chooseScannerItem(definition, ready(6, 'clamperl'), 'deepseatooth')).toThrow()
    const initial = ready(7, 'clamperl', 'clamperl')
    expect(options(initial)).toEqual([])
    const chosen = chooseScannerItem(definition, initial, 'deepseatooth')
    expect(options(chosen)).toEqual(['huntail'])
    expect(() => chooseScannerItem(definition, chosen, 'deepseascale')).toThrow(/elegido/)
    const storage = new MemoryStorage()
    const store = new LocalCampaignStore(storage)
    store.write(chosen, null, 0)
    const restored = new LocalCampaignStore(storage).read()!.state
    expect(() => chooseScannerItem(definition, restored, 'deepseascale')).toThrow(/elegido/)
    const evolved = evolveRecruit(definition, restored, 'member-0', 'huntail')
    expect(options(evolved, 1)).toEqual([])
    store.write(evolved, null, 1)
    expect(() => chooseScannerItem(definition, store.read()!.state, 'deepseascale')).toThrow(/elegido/)
    expect(options(chooseScannerItem(definition, initial, 'deepseascale'))).toEqual(['gorebyss'])
    storage.setItem(CAMPAIGN_STORAGE_KEY, JSON.stringify({ version: 1, revision: 3,
      state: { ...evolved, scannerChoice: 'both' }, battle: null }))
    expect(() => new LocalCampaignStore(storage).read()).toThrow(/conservado/)
  })

  it('excluye el azar, los regalos semanales, posliga y objetos sin fuente nativa', () => {
    const league = ready(8, 'scyther', 'seadra', 'porygon')
    for (let i = 0; i < league.members.length; i++) expect(options(league, i)).toEqual([])
    expect(availableCampaignMoves(definition, ready(12, 'mew'), ready(12, 'mew').members[0])).not.toEqual(expect.arrayContaining(['frustration']))
    expect(availableCampaignMoves(definition, ready(12, 'mew'), ready(12, 'mew').members[0])).not.toContain('snatch')
  })
})

describe('evoluciones decididas por Jose', () => {
  it('exige tres victorias antes de la Liga y evoluciona toda la caja antes de fijar la plantilla', () => {
    const state = ready(3, 'togepi')
    expect(options(state)).toEqual([])
    state.members = [{ ...state.members[0], victories: 1 }]
    expect(specialEvolutionOptions(definition, state, 'member-0', { friendshipWins: 1 })).toEqual([])
    state.members = [{ ...state.members[0], victories: 2 }]
    expect(options(state)).toEqual([])
    state.members = [{ ...state.members[0], victories: 3 }]
    expect(options(state)).toEqual(['togetic'])
    const league = ready(8, 'eevee', 'togepi')
    expect(options(league)).not.toContain('espeon')
    expect(options(league, 0, 'night')).not.toContain('umbreon')
    const evolved = evolveForLeague(definition, league, { 'member-0': 'espeon' })
    expect(evolved.members.map(member => member.species)).toEqual(['espeon', 'togetic'])
    const locked = lockLeagueRoster(definition, evolved, ['member-0'])
    expect(locked.phase).toBe('prepare')
    expect(options(locked)).toEqual([])
    expect(() => options(locked, 1)).toThrow(/liga/i)
    expect(() => lockLeagueRoster(definition, locked, ['member-1'])).toThrow(/cerrada/i)
    expect(() => options({ ...state, members: [{ ...state.members[0], fainted: true }] })).toThrow()
  })

  it('guarda la plantilla fijada, permite evolucionar antes del primer combate y prepara esa misma identidad', () => {
    const initial = evolveForLeague(definition, ready(8, 'gloom', 'eevee'), { 'member-1': 'umbreon' })
    for (const invalid of [[], ['missing'], ['member-0', 'member-0']]) {
      expect(() => lockLeagueRoster(definition, initial, invalid)).toThrow()
    }
    expect(() => lockLeagueRoster(definition, ready(7, 'togepi'), ['member-0'])).toThrow()
    const seven = evolveForLeague(definition, ready(8, ...Array<string>(7).fill('mew')))
    expect(() => lockLeagueRoster(definition, seven, seven.members.map(member => member.id))).toThrow()
    const locked = lockLeagueRoster(definition, initial, ['member-0'])
    const storage = new MemoryStorage()
    const store = new LocalCampaignStore(storage)
    store.write(locked, null, 0)
    const evolved = evolveRecruit(definition, new LocalCampaignStore(storage).read()!.state, 'member-0', 'vileplume')
    store.write(evolved, null, 1)
    const restored = new LocalCampaignStore(storage).read()!.state
    expect(() => lockLeagueRoster(definition, restored, ['member-1'])).toThrow(/cerrada/)
    expect(() => lockLeagueRoster(definition, lockLeagueRoster(definition, initial, ['member-0', 'member-1']), ['member-0', 'member-0'])).toThrow(/cerrada/)
    const battle = beginCampaignBattle(definition, restored,
      { unlockedMoves: new Set(), movesByMember: { 'member-0': ['return'] } })
    expect(battle.state.leagueRoster).toEqual(['member-0'])
    expect(battle.init.player[0]).toMatchObject({ species: 'vileplume', happiness: 255 })
    expect(restored.members[0].victories).toBe(0)
  })

  it('habilita belleza tras Norman sin exigir victorias ni un objeto', () => {
    expect(options(ready(4, 'feebas'))).toEqual([])
    expect(options(ready(5, 'feebas'))).toEqual(['milotic'])
    expect(evolveRecruit(definition, ready(5, 'feebas'), 'member-0', 'milotic').members[0]).toMatchObject({ species: 'milotic', victories: 0 })
  })

  it('resuelve Ninjask al 20 sin copiar reclutas y permite elegir las tres ramas de Tyrogue', () => {
    const base = ready(2, 'nincada')
    const drafted = chooseRecruit(definition, { ...base, phase: 'draft', offer: ['nincada'], members: [] }, 'nincada')
    expect(drafted.members).toHaveLength(1)
    expect(drafted.members[0]).toMatchObject({ species: 'ninjask', history: [{ species: 'nincada', evolvedAt: 20 }] })
    const shedinja = chooseRecruit(definition, { ...base, phase: 'draft', offer: ['shedinja'], members: [] }, 'shedinja')
    expect(shedinja.members.map(member => member.species)).toEqual(['shedinja'])
    expect(options(ready(1, 'tyrogue'))).toEqual([])
    const tyrogue = ready(2, 'tyrogue')
    expect(options(tyrogue)).toEqual(expect.arrayContaining(['hitmonlee', 'hitmonchan', 'hitmontop']))
    for (const target of ['hitmonlee', 'hitmonchan', 'hitmontop']) expect(evolveRecruit(definition, tyrogue, 'member-0', target).members[0].species).toBe(target)
  })

  it('fija Wurmple por semilla e identidad, encadena evoluciones y no repite el sorteo al reanudar', () => {
    const member = { species: 'wurmple', level: 1, history: [] }
    expect(advanceLevel(species, member, 6)).toMatchObject({ species: 'wurmple', level: 6, history: [] })
    const outcomes = new Set<string>()
    for (let seed = 0; seed < 20; seed++) {
      const identity = { seed: `wurmple-${seed}`, id: 'member' }
      const result = advanceLevel(species, member, 15, identity)
      outcomes.add(result.species)
      expect(advanceLevel(species, member, 15, identity)).toEqual(result)
      expect(advanceLevel(species, JSON.parse(JSON.stringify(result)), 24, identity).history).toEqual(result.history)
      expect(result.history.map(h => h.evolvedAt)).toEqual([7, 10])
    }
    expect([...outcomes].sort()).toEqual(['beautifly', 'dustox'])
    const byIdentity = new Set(Array.from({ length: 20 }, (_, i) =>
      advanceLevel(species, member, 15, { seed: 'same-seed', id: `member-${i}` }).species))
    expect([...byIdentity].sort()).toEqual(['beautifly', 'dustox'])
    const drafted = chooseRecruit(definition, { ...createCampaign('persist-wurmple'), offer: ['wurmple'] }, 'wurmple')
    const storage = new MemoryStorage()
    let store = new LocalCampaignStore(storage)
    store.write(drafted, null, 0)
    for (let revision = 1; revision <= 3; revision++) {
      store = new LocalCampaignStore(storage)
      const restored = store.read()!.state
      expect(restored.members[0].species).toBe(drafted.members[0].species)
      expect(restored.members[0].history).toEqual(drafted.members[0].history)
      store.write({ ...restored, members: restored.members.map(m => ({ ...m, victories: revision })) }, null, revision)
    }
  })
})

it('usa amistad 255 en el motor y calculador, independiente de cero victorias para evolucionar', () => {
  const state = ready(3, 'mew')
  const { init } = beginCampaignBattle(definition, state, { unlockedMoves: new Set(), movesByMember: { 'member-0': ['return'] } }, ['member-0'])
  expect(init.player[0].happiness).toBe(255)
  expect(init.rival.every(mon => mon.happiness === undefined)).toBe(true)
  const attacker = init.player[0], defender = { ...attacker, moves: ['splash'] }
  expect(computeDamage({ set: attacker }, { set: defender }, 'return', { generation: 3 }).min)
    .toBeGreaterThan(computeDamage({ set: attacker }, { set: defender }, 'frustration', { generation: 3 }).max)
  const hpAfter = (move: string, happiness: number) => {
    const engine = createBattleEngine({ ...init, battleSeed: 'happiness', ai: 'trivial',
      player: [{ ...attacker, moves: [move], happiness }], rival: [defender] })
    engine.start()
    return engine.choose({ type: 'move', slot: 1 }).view.rival.team[0].hpPercent
  }
  expect(hpAfter('return', 255)).toBeLessThan(hpAfter('return', 0))
  expect(hpAfter('frustration', 255)).toBeGreaterThan(hpAfter('frustration', 0))
  const baby = ready(3, 'togepi')
  expect(beginCampaignBattle(definition, baby, { unlockedMoves: new Set(), movesByMember: { 'member-0': ['return'] } }, ['member-0']).init.player[0].happiness).toBe(255)
  expect(options(baby)).toEqual([])
})

it('el worker real rechaza MT adelantadas y prepara MT del calendario sin depender de la lista suministrada', () => {
  const handle = createWorkerHandler()
  const input = campaignInput('hiddenpower')
  input.preparation.unlockedMoves = []
  const legal = handle({ type: 'campaign-prepare', requestId: 'legal', input })
  expect(legal.type).toBe('campaign-prepared')
  if (legal.type !== 'campaign-prepared') throw new Error('Preparación rechazada')
  expect(legal.init.player[0]).toMatchObject({ moves: ['hiddenpower'], happiness: 255 })
  input.state.encounterIndex = 0
  input.preparation.unlockedMoves = ['hiddenpower']
  expect(handle({ type: 'campaign-prepare', requestId: 'early', input })).toMatchObject({ type: 'campaign-error', requestId: 'early' })
})
