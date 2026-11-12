import { describe, expect, it } from 'vitest'
import { readJson } from '../../test-utils/paths'
import { createCampaign, finishEncounter, startEncounter, type CampaignState } from './campaign'
import { heldItemStock, equipItem, buyExchangeItem, exchangeItems, battlePointsFor } from './heldItems'
import { beginCampaignBattle, type CampaignBattleDefinition } from './battle'
import { CAMPAIGN_STORAGE_KEY, LocalCampaignStore } from '../../storage/campaignStore'
import { MemoryStorage } from '../../test-utils/memoryStorage'

const { encounters } = readJson<Pick<CampaignBattleDefinition, 'encounters'>>('data', 'nuzlocke', 'hoenn-emerald.json')
const { species } = readJson<Pick<CampaignBattleDefinition, 'species'>>('data', 'nuzlocke', 'hoenn-emerald-progression.json')
const definition = { encounters, species }
function ready(index = 0): CampaignState {
  return { ...createCampaign('held-items'), phase: 'prepare', encounterIndex: index,
    members: Array.from({ length: 3 }, (_, i) => ({ id: `member-${i}`, species: 'mew', level: Math.max(...encounters[index].team.map(mon => mon.level)),
      history: [], victories: 0, fainted: false })) }
}

describe('inventario equipable (DEC-94)', () => {
  it('desbloquea por hito y mantiene las bayas infinitas desde su primera fuente', () => {
    const initial = heldItemStock(ready())
    expect(initial).toMatchObject({ quickclaw: 1, whiteherb: 1, oranberry: Infinity })
    expect(initial.silkscarf).toBeUndefined()
    expect(initial.sitrusberry).toBeUndefined()
    expect(heldItemStock(ready(1)).silkscarf).toBe(1)
    expect(heldItemStock(ready(4)).sitrusberry).toBeUndefined()
    expect(heldItemStock(ready(5)).sitrusberry).toBe(Infinity)
    for (let index = 0; index < encounters.length; index++) {
      expect(heldItemStock(ready(index)).oranberry).toBe(Infinity)
      expect(heldItemStock(ready(index)).quickclaw).toBe(1)
    }
    expect(heldItemStock(ready(12)).metalcoat).toBeUndefined()
    expect(heldItemStock(ready(12)).leftovers).toBeUndefined()
    expect(heldItemStock({ ...ready(), purchases: ['leftovers', 'leftovers', 'quickclaw'] }))
      .toMatchObject({ leftovers: 2, quickclaw: 2, oranberry: Infinity })
  })

  // Cambio de requisito (Jose, 12/11/2026): la PIEDRAETERNA, el único equipable con dos fuentes físicas, sale de la Mochila (no hace
  // nada en combate); las unidades repetidas se siguen probando con las compras del canje (arriba).
  it('los equipables que no hacen nada en combate no están en el inventario', () => {
    for (const id of ['everstone', 'amuletcoin', 'expshare', 'machobrace']) expect(heldItemStock(ready(12))[id]).toBeUndefined()
  })

  it('controla las unidades libres, permite reequipar la propia y libera al quitar o caer el portador', () => {
    const initial = ready()
    const snapshot = structuredClone(initial)
    const equipped = equipItem(initial, 'member-0', 'quickclaw')
    expect(initial).toEqual(snapshot)
    expect(equipItem(equipped, 'member-0', 'quickclaw').members[0].item).toBe('quickclaw')
    expect(() => equipItem(equipped, 'member-1', 'quickclaw')).toThrow(/libre/)
    const removed = equipItem(equipped, 'member-0', null)
    expect(removed.members[0].item).toBeUndefined()
    expect(equipItem(removed, 'member-1', 'quickclaw').members[1].item).toBe('quickclaw')
    const fallen = { ...equipped, members: equipped.members.map((member, i) => i === 0 ? { ...member, fainted: true } : member) }
    expect(equipItem(fallen, 'member-1', 'quickclaw').members[1].item).toBe('quickclaw')
    expect(() => equipItem(fallen, 'member-0', null)).toThrow(/disponible/)
    expect(() => equipItem(initial, 'missing', 'oranberry')).toThrow(/disponible/)
    for (const item of ['leftovers', 'silkscarf', 'potion', 'unknown']) expect(() => equipItem(initial, 'member-0', item)).toThrow(/libre/)
  })

  it('permite equipar la misma baya a todos los miembros y sustituir un objeto', () => {
    let state = equipItem(ready(), 'member-0', 'quickclaw')
    for (const member of state.members) state = equipItem(state, member.id, 'oranberry')
    expect(state.members.every(member => member.item === 'oranberry')).toBe(true)
    expect(equipItem(state, 'member-1', 'quickclaw').members[1].item).toBe('quickclaw')
  })

  it.each(['draft', 'battle', 'lost', 'won'] as const)('rechaza equipar, quitar y comprar en fase %s', phase => {
    const state = { ...ready(), phase, battlePoints: 100 }
    expect(() => equipItem(state, 'member-0', 'oranberry')).toThrow(/preparación/)
    expect(() => equipItem(state, 'member-0', null)).toThrow(/preparación/)
    expect(() => buyExchangeItem(state, 'leftovers')).toThrow(/preparación/)
  })

  it.each(exchangeItems())('compra $item por $price PB exactos, acumula unidades y no muta la entrada', ({ item, price }) => {
    const initial: CampaignState = { ...ready(), battlePoints: price * 2 }
    const once = buyExchangeItem(initial, item)
    expect(once.battlePoints).toBe(price)
    expect(once.purchases).toEqual([item])
    const twice = buyExchangeItem(once, item)
    expect(twice.battlePoints).toBe(0)
    expect(twice.purchases).toEqual([item, item])
    expect(heldItemStock(twice)[item]).toBe((heldItemStock(initial)[item] ?? 0) + 2)
    expect(initial).toMatchObject({ battlePoints: price * 2 })
    expect(initial.purchases).toBeUndefined()
    expect(() => buyExchangeItem({ ...ready(), battlePoints: price - 1 }, item)).toThrow(/suficientes/)
    expect(() => buyExchangeItem(ready(), item)).toThrow(/suficientes/)
  })

  it('rechaza artículos ajenos al canje aunque haya saldo', () => {
    for (const item of ['oranberry', 'metalcoat', 'potion', 'unknown']) {
      expect(() => buyExchangeItem({ ...ready(), battlePoints: 1000 }, item)).toThrow(/canje/)
    }
  })

  it('pasa objetos por identidad a los sets y deja vacío al miembro sin objeto', () => {
    const state = equipItem(ready(), 'member-1', 'quickclaw')
    const preparation = { unlockedMoves: new Set<string>(), movesByMember: { 'member-0': ['pound'], 'member-1': ['pound'] } }
    const plain = beginCampaignBattle(definition, ready(), preparation, ['member-1', 'member-0'])
    const equipped = beginCampaignBattle(definition, state, preparation, ['member-1', 'member-0'])
    expect(equipped.init.player.map(member => member.item)).toEqual(['quickclaw', ''])
    expect(equipped.state.members[1].item).toBe('quickclaw')
    expect(equipped.init.rival.map(member => member.item)).toEqual(encounters[0].team.map(member => member.item ?? ''))
    expect(equipped.init.battleSeed).not.toBe(plain.init.battleSeed)
  })
})

describe('Puntos Batalla al finalizar encuentros', () => {
  it.each([0, 1, 2, 3, 4, 5, 6, 7])('gimnasio %i: suma 28 sin bajas o 20 con una baja, al saldo anterior', index => {
    const state = startEncounter(definition, { ...ready(index), battlePoints: 11, purchases: ['leftovers'] }, ['member-0', 'member-1'])
    const before = structuredClone(state)
    expect(finishEncounter(definition, state, true, [false, false]).battlePoints).toBe(39)
    const casualty = finishEncounter(definition, state, true, [false, true])
    expect(casualty.battlePoints).toBe(31)
    expect(casualty.purchases).toEqual(['leftovers'])
    expect(casualty.members[1].fainted).toBe(true)
    expect(state).toEqual(before)
    expect(finishEncounter(definition, state, false, [true, true]).battlePoints).toBe(11)
    expect(finishEncounter(definition, state, false, [false, false]).battlePoints).toBe(11)
  })

  it('parte de cero cuando no había saldo y las bajas de la caja no quitan el bonus', () => {
    const initial = ready()
    initial.members = initial.members.map((member, i) => i === 2 ? { ...member, fainted: true } : member)
    const state = startEncounter(definition, initial, ['member-0'])
    expect(finishEncounter(definition, state, true, [false]).battlePoints).toBe(28)
    expect(battlePointsFor([false])).toBe(28)
    expect(battlePointsFor([false, true])).toBe(20)
  })

  it.each([8, 9, 10, 11, 12])('Liga %i: no concede PB al ganar o perder', index => {
    const initial = { ...ready(index), battlePoints: 17, leagueEvolved: true, leagueRoster: ['member-0'] }
    const state = startEncounter(definition, initial)
    expect(finishEncounter(definition, state, true, [false]).battlePoints).toBe(17)
    expect(finishEncounter(definition, state, false, [true]).battlePoints).toBe(17)
  })

  it('no concede PB a campañas ajenas a Esmeralda', () => {
    const generic = { ...definition, encounters: [{ ...encounters[0], id: 'other' }] }
    const state = startEncounter(generic, ready(), ['member-0'])
    expect(finishEncounter(generic, state, true, [false]).battlePoints).toBeUndefined()
  })
})

describe('guardado local de objetos y PB', () => {
  it('persiste equipo, saldo y compras al releer y conserva guardados antiguos sin esos campos', () => {
    for (const state of [ready(), equipItem(buyExchangeItem({ ...ready(), battlePoints: 60 }, 'leftovers'), 'member-0', 'leftovers')]) {
      const storage = new MemoryStorage()
      new LocalCampaignStore(storage).write(state, null, 0)
      const restored = new LocalCampaignStore(storage).read()!.state
      expect(restored).toEqual(state)
      expect(heldItemStock(restored)).toEqual(heldItemStock(state))
    }
  })

  it.each([
    ['item', null], ['item', 1], ['item', []], ['item', {}],
    ['battlePoints', -1], ['battlePoints', 1.5], ['battlePoints', '48'], ['battlePoints', null], ['battlePoints', Number.MAX_SAFE_INTEGER + 1],
    ['purchases', null], ['purchases', 'leftovers'], ['purchases', [1]], ['purchases', [{}]],
  ])('rechaza %s = %j sin sustituir el guardado', (field, value) => {
    const state = ready()
    const corrupt = JSON.parse(JSON.stringify(state))
    if (field === 'item') corrupt.members[0].item = value
    else corrupt[field] = value
    const storage = new MemoryStorage()
    const raw = JSON.stringify({ version: 1, revision: 1, state: corrupt, battle: null })
    storage.setItem(CAMPAIGN_STORAGE_KEY, raw)
    const store = new LocalCampaignStore(storage)
    expect(() => store.read()).toThrow(/conservado/)
    expect(() => store.write(state, null, 1)).toThrow(/conservado/)
    expect(storage.getItem(CAMPAIGN_STORAGE_KEY)).toBe(raw)
    const clean = new LocalCampaignStore(new MemoryStorage())
    expect(() => clean.write(corrupt, null, 0)).toThrow(/guardar/)
    expect(clean.read()).toBeNull()
  })
})
