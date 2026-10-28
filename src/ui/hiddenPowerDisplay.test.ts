import { describe, expect, it } from 'vitest'
import type { BattleRequest } from '../battle/protocol'
import type { ResolvedSet, StatsTable } from '../core/types'
import { loadGameData } from '../data/gameData'
import { moveOptions } from './battle/battleModel'
import { rivalMembers } from './battle/party/partyModel'
import { cardModel, moveModel } from './today/cardModel'

// UT-73 · Poder Oculto se muestra con el tipo y la potencia reales del Pokémon (decisión de Jose, 22/10/2026), con el nombre sin el tipo
// (cambio del 28/10/2026: antes «Poder Oculto Lucha»; el tipo va solo en el icono y el color).
const data = loadGameData()
const uniform = (iv: number): StatsTable => ({ hp: iv, atk: iv, def: iv, spa: iv, spd: iv, spe: iv })

describe('Poder Oculto con su tipo real', () => {
  it('tarjeta y datos: «Poder Oculto» de tipo Lucha y 70 con IV 30, de tipo Siniestro y 30 con IV 25', () => {
    expect(moveModel('hiddenpower', data, uniform(30))).toMatchObject({ id: 'hiddenpower', name: 'Poder Oculto', typeName: 'Fighting', power: '70', category: 'Special' })
    expect(moveModel('hiddenpower', data, uniform(25))).toMatchObject({ name: 'Poder Oculto', typeName: 'Dark', power: '30' })
    expect(moveModel('hiddenpower', data)).toMatchObject({ name: 'Poder Oculto', typeName: 'Normal' })
  })

  it('cardModel y la pantalla de datos usan los IV del set', () => {
    const set = { species: 'starmie', nameEs: 'Starmie', level: 50, item: 'leftovers', ability: 'naturalcure', nature: 'Serious', moves: ['hiddenpower', 'surf'], ivs: uniform(20), evs: uniform(0) } as unknown as ResolvedSet
    expect(cardModel(set, data).moves[0]).toMatchObject({ name: 'Poder Oculto', typeName: 'Fighting', power: '30' })
    expect(rivalMembers(null, data, [set])[0].moves[0]).toMatchObject({ name: 'Poder Oculto', typeName: 'Fighting', basePower: 30 })
  })

  it('menú de movimientos del combate: el tipo que da el simulador («Hidden Power Dark 30»)', () => {
    const request = { active: [{ moves: [{ id: 'hiddenpower', move: 'Hidden Power Dark 30', pp: 24, maxpp: 24 }] }], side: { name: 'Jugador', id: 'p1', pokemon: [] } } as unknown as BattleRequest
    expect(moveOptions(request, data)[0]).toMatchObject({ id: 'hiddenpower', name: 'Poder Oculto', typeName: 'Dark' })
  })
})
