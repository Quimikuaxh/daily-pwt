import { describe, expect, it } from 'vitest'
import { calcStats } from '../../../core/stats'
import { es } from '../../../i18n/es'
import { partyMembers } from './partyModel'
import { realData, realRequest, realTeam, realView } from './partyFixtures'

// RF-70 / RF-71: los datos de la pantalla de equipo y de datos salen del ResolvedSet y del estado del combate, sin inventar nada.
describe('partyMembers', () => {
  const members = partyMembers(realRequest(), realView(), realData, realTeam)

  it('trae los 6 Pokémon en el orden del request (el mismo de los botones de cambio)', () => {
    expect(members).toHaveLength(6)
    expect(members.map((member) => member.slot)).toEqual([1, 2, 3, 4, 5, 6])
    expect(members.map((member) => member.speciesId)).toEqual(realTeam.map((set) => set.species))
  })

  it('las estadísticas son las reales a Nv. 50 (calcStats con IV, EV y naturaleza del set)', () => {
    members.forEach((member, index) => {
      const set = realTeam[index]
      expect(member.stats).toEqual(calcStats(realData.dex.species[set.species].baseStats, set.ivs, set.evs, set.nature, 50))
      expect(member.level).toBe(50)
    })
  })

  it('objeto, habilidad, naturaleza, tipos y movimientos salen del set y del dex, en español', () => {
    const [first] = members
    const set = realTeam[0]
    expect(first.itemName).toBe(realData.names.items[set.item])
    expect(first.abilityName).toBe(realData.names.abilities[set.ability])
    expect(first.abilityId).toBe(set.ability)
    expect(first.types.map((type) => type.id)).toEqual(realData.dex.species[set.species].types)
    expect(first.moves.map((move) => move.id)).toEqual(set.moves)
    expect(first.moves.map((move) => move.name)).toEqual(set.moves.map((id) => realData.names.moves[id]))
    expect(first.natureName).toBe((es.battle.summary.natures as Record<string, string>)[set.nature])
    expect(first.natureName).not.toBe(set.nature)
  })

  it('los PP salen del estado del combate (movimientos usados bajan los PP actuales)', () => {
    const used = partyMembers(realRequest(), realView(3), realData, realTeam)[0]
    const full = partyMembers(realRequest(), realView(0), realData, realTeam)[0]
    used.moves.forEach((move, index) => {
      expect(move.maxPp).toBe(full.moves[index].maxPp)
      expect(move.pp).toBe(Math.max(0, (full.moves[index].maxPp as number) - 3))
    })
  })

  it('estado: debilitado, en combate y con problema de estado', () => {
    const request = realRequest({ 1: { condition: '0 fnt' }, 2: { condition: '60/100 par' } })
    const result = partyMembers(request, realView(), realData, realTeam)
    expect(result[0].active).toBe(true)
    expect(result[1]).toMatchObject({ fainted: true, hp: 0, canSendOut: false, status: null })
    expect(result[2]).toMatchObject({ status: 'par', hp: 60, maxHp: 100, canSendOut: true })
    expect(result[0].canSendOut).toBe(false)
  })

  it('el género viene del request cuando la especie lo tiene', () => {
    const request = realRequest()
    request.side.pokemon[1].details = request.side.pokemon[1].details.replace(/, [MF]$/, '') + ', F'
    expect(partyMembers(request, realView(), realData, realTeam)[1].gender).toBe('F')
  })

  it('sin set (no ocurre en una partida real) usa lo que trae el request y no falla', () => {
    const request = realRequest()
    request.side.pokemon[0].stats = { atk: 100, def: 90, spa: 80, spd: 70, spe: 60 }
    request.side.pokemon[0].moves = ['tackle']
    const [first] = partyMembers(request, null, realData, [])
    expect(first.stats.atk).toBe(100)
    expect(first.moves.map((move) => move.id)).toEqual(['tackle'])
  })

  it('sin request no hay miembros', () => {
    expect(partyMembers(null, null, realData, realTeam)).toEqual([])
  })
})
