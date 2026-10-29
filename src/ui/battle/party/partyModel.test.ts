import { describe, expect, it } from 'vitest'
import { calcStats } from '../../../core/stats'
import { es } from '../../../i18n/es'
import iconIndex from '../../../generated/icon-index.json'
import { memberHpText, partyMembers, requestFromView, rivalMembers } from './partyModel'
import { dexNumberText } from './summaryModel'
import { realChallenge, realData, realRequest, realTeam, realView } from './partyFixtures'

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

  it('el objeto es el que lleva en ese momento según el combate (UT-114: Truco, Desarme); sin ese dato, el del set', () => {
    const base = realView()
    const withItems = (items: (string | undefined)[]) => ({ ...base, player: { ...base.player, team: base.player.team.map((mon, index) => ({ ...mon, item: items[index] })) } })
    const result = partyMembers(realRequest(), withItems(['leftovers', '', undefined]), realData, realTeam)
    expect(result[0].itemName).toBe(realData.names.items.leftovers)
    expect(result[1].itemName).toBe(es.battle.summary.noItem)
    expect(result[2].itemName).toBe(realData.names.items[realTeam[2].item])
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

  it('debilitado: 0 / PS máximos (el simulador manda «0 fnt» sin máximo)', () => {
    const result = partyMembers(realRequest({ 1: { condition: '0 fnt' } }), realView(), realData, realTeam)[1]
    expect(result).toMatchObject({ hp: 0, maxHp: result.stats.hp, hpPercent: 0 })
    expect(result.maxHp).toBeGreaterThan(0)
  })

  it('el icono usa el id del sprite: en las formas no coincide con el de especie (Landorus-T)', () => {
    const request = realRequest()
    request.side.pokemon[0].details = 'Landorus-Therian, L50, M'
    const [first] = partyMembers(request, null, realData, [])
    expect(first).toMatchObject({ speciesId: 'landorustherian', spriteId: 'landorus-therian' })
  })

  it('toda especie del dex (formas incluidas: Rotom, Thundurus-T, Wormadam…) tiene icono y número por su spriteId', () => {
    const missing = Object.values(realData.dex.species).filter((species) => !(species.spriteId in iconIndex) || dexNumberText(species.spriteId) === '000')
    expect(missing.map((species) => species.id)).toEqual([])
  })

  it('las formas tienen icono propio, distinto del de la especie base, y el número de Pokédex de la base', () => {
    const icons = iconIndex as Record<string, number>
    for (const [form, base, number] of [['landorus-therian', 'landorus', '645'], ['thundurus-therian', 'thundurus', '642'], ['tornadus-therian', 'tornadus', '641'], ['rotom-wash', 'rotom', '479'], ['wormadam-trash', 'wormadam', '413']]) {
      expect(icons[form], form).not.toBe(icons[base])
      expect(dexNumberText(form), form).toBe(number)
    }
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

// UT-117 · Visor de repeticiones: las placas del jugador salen de la vista grabada (no hay petición del simulador).
describe('requestFromView', () => {
  it('da los mismos datos que la petición real: orden, PS, estado, debilitado y activo', () => {
    const base = realView()
    const view = { ...base, player: { ...base.player, active: 1, team: base.player.team.map((mon, index) => (index === 0 ? { ...mon, hp: 0, hpPercent: 0, fainted: true } : index === 2 ? { ...mon, hp: 60, status: 'par' } : mon)) } }
    const members = partyMembers(requestFromView(view, realTeam), view, realData, realTeam)
    expect(members.map((member) => member.speciesId)).toEqual(realTeam.map((set) => set.species))
    expect(members[0]).toMatchObject({ fainted: true, hp: 0, active: false })
    expect(members[1]).toMatchObject({ active: true, fainted: false })
    expect(members[2]).toMatchObject({ hp: 60, status: 'par', maxHp: view.player.team[2].maxHp })
    expect(members[3].stats).toEqual(partyMembers(realRequest(), realView(), realData, realTeam)[3].stats)
    expect(requestFromView(null, realTeam)).toBeNull()
  })
})

// UT-68 · Equipo rival (botón RIVAL, decisiones de Jose del 22/10/2026).
describe('rivalMembers', () => {
  const rivalTeam = realChallenge.rivalTeam
  const view = () => {
    const base = realView()
    return {
      ...base,
      rival: {
        remaining: 5,
        active: 1,
        team: rivalTeam.map((set, index) => ({
          species: set.species,
          hpPercent: index === 0 ? 0 : index === 1 ? 64 : 100,
          status: index === 2 ? 'par' : null,
          fainted: index === 0,
          moves: index === 1 ? set.moves.map((id, slot) => ({ id, pp: 10 - slot, maxPp: 16 })) : undefined,
        })),
      },
    }
  }

  it('el objeto del rival es el que lleva en ese momento (UT-114); sin ese dato, el del set', () => {
    const base = view()
    const changed = { ...base, rival: { ...base.rival, team: base.rival.team.map((mon, index) => (index === 0 ? { ...mon, item: 'choicescarf' } : index === 1 ? { ...mon, item: '' } : mon)) } }
    const members = rivalMembers(changed, realData, rivalTeam)
    expect(members[0].itemName).toBe(realData.names.items.choicescarf)
    expect(members[1].itemName).toBe(es.battle.summary.noItem)
    expect(members[2].itemName).toBe(realData.names.items[rivalTeam[2].item] ?? es.battle.summary.noItem)
  })

  it('los 6 en el orden del equipo rival, con su set completo y estadísticas reales', () => {
    const members = rivalMembers(view(), realData, rivalTeam)
    expect(members.map((member) => member.speciesId)).toEqual(rivalTeam.map((set) => set.species))
    members.forEach((member, index) => {
      const set = rivalTeam[index]
      expect(member.moves.map((move) => move.id)).toEqual(set.moves)
      expect(member.abilityId).toBe(set.ability)
      expect(member.stats).toEqual(calcStats(realData.dex.species[set.species].baseStats, set.ivs, set.evs, set.nature, set.level))
      expect(member.canSendOut).toBe(false)
    })
  })

  it('PS en porcentaje, debilitado y estado desde la vista; el activo, marcado', () => {
    const [first, second, third] = rivalMembers(view(), realData, rivalTeam)
    expect(first).toMatchObject({ fainted: true, hp: 0, hpPercentOnly: true })
    expect(second).toMatchObject({ hp: 64, maxHp: 100, active: true })
    expect(memberHpText(second)).toBe('64 %')
    expect(third.status).toBe('par')
  })

  // Cambio de requisito (22/10/2026, Jose): antes solo los PP máximos; ahora los que le quedan.
  it('los PP que le quedan, desde la vista del combate; llenos si la vista no los trae', () => {
    const [first, second] = rivalMembers(view(), realData, rivalTeam)
    expect(second.moves.map((move) => [move.pp, move.maxPp])).toEqual(second.moves.map((_, slot) => [10 - slot, 16]))
    for (const move of first.moves) {
      expect(move.maxPp).toBeGreaterThan(0)
      expect(move.pp).toBe(move.maxPp)
    }
  })
})
