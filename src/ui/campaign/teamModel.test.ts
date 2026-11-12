import { describe, expect, it } from 'vitest'
import type { CampaignState } from '../../core/nuzlocke/campaign'
import { makeGameData } from '../../test-utils/fixtures'
import { fittingLayout, initialLayout, lineup, monAt, moveMon, partyCount, teamMonOf, type TeamLayout } from './teamModel'
import { arrowTarget, placeKey, placeOf } from './teamDrag'

// UT-173 · Equipo y PC de la campaña (D7, maqueta aprobada el 11/11/2026).
const member = (id: string, fainted = false) => ({ id, species: id, level: 19, history: [], fainted, victories: 0 })
const state = (members: ReturnType<typeof member>[]) => ({ members } as unknown as CampaignState)
const five = state([member('grovyle'), member('machop'), member('wingull'), member('slakoth'), member('ralts', true), member('skitty')])

describe('colocación inicial', () => {
  it('lleva hasta el límite a los vivos por orden de reclutamiento, el resto a la CAJA 1 y los debilitados a BAJAS', () => {
    const layout = initialLayout(five, 3)
    expect(layout.party).toEqual(['grovyle', 'machop', 'wingull', null, null, null])
    expect(layout.boxes[0].mons.slice(0, 3)).toEqual(['slakoth', 'skitty', null])
    expect(layout.boxes[0].mons).toHaveLength(30)
    expect(layout.boxes[1]).toMatchObject({ ko: true })
    expect(layout.boxes[1].mons.slice(0, 2)).toEqual(['ralts', null])
  })

  it('respeta la alineación aceptada antes, sin los que ya no están vivos', () => {
    expect(initialLayout(five, 3, ['skitty', 'ralts', 'machop']).party.slice(0, 3)).toEqual(['skitty', 'machop', 'grovyle'])
  })
})

describe('mover e intercambiar', () => {
  const base = initialLayout(five, 3)

  it('soltar sobre otro Pokémon los intercambia; del equipo a un hueco vacío de la caja lo saca y compacta el equipo', () => {
    const swapped = moveMon(base, { area: 'party', i: 0 }, { area: 'box', box: 0, i: 0 }, 3)
    expect(swapped.note).toBeNull()
    expect(swapped.layout.party.slice(0, 3)).toEqual(['slakoth', 'machop', 'wingull'])
    expect(monAt(swapped.layout, { area: 'box', box: 0, i: 0 })).toBe('grovyle')
    const out = moveMon(base, { area: 'party', i: 0 }, { area: 'box', box: 0, i: 5 }, 3)
    expect(out.layout.party).toEqual(['machop', 'wingull', null, null, null, null])
    expect(partyCount(out.layout)).toBe(2)
  })

  it('dentro del equipo cambia el orden (el primero sale a combatir)', () => {
    expect(lineup(moveMon(base, { area: 'party', i: 2 }, { area: 'party', i: 0 }, 3).layout)).toEqual(['wingull', 'machop', 'grovyle'])
  })

  it('no pasa del límite, no deja el equipo vacío y las bajas no se mueven', () => {
    const out = moveMon(base, { area: 'party', i: 0 }, { area: 'box', box: 0, i: 5 }, 3).layout
    expect(moveMon(out, { area: 'box', box: 0, i: 0 }, { area: 'party', i: 3 }, 3).note).toBe('limit')
    const one: TeamLayout = { ...base, party: ['grovyle', null, null, null, null, null] }
    expect(moveMon(one, { area: 'party', i: 0 }, { area: 'box', box: 0, i: 9 }, 3).note).toBe('lastOne')
    expect(moveMon(base, { area: 'box', box: 1, i: 0 }, { area: 'party', i: 0 }, 3).note).toBe('fainted')
    expect(moveMon(base, { area: 'party', i: 0 }, { area: 'box', box: 1, i: 3 }, 3).note).toBe('fainted')
    expect(moveMon(base, { area: 'box', box: 0, i: 9 }, { area: 'party', i: 0 }, 3).note).toBe('empty')
  })

  it('un hueco libre dentro del límite admite a uno de la caja', () => {
    const out = moveMon(base, { area: 'party', i: 0 }, { area: 'box', box: 0, i: 5 }, 3).layout
    expect(lineup(moveMon(out, { area: 'box', box: 0, i: 0 }, { area: 'party', i: 2 }, 3).layout)).toEqual(['machop', 'wingull', 'slakoth'])
  })
})

describe('datos de cada Pokémon', () => {
  const data = makeGameData()

  it('PS al nivel con IV 20 y sin EV; con IV de Poder Oculto usa los suyos; Shedinja siempre 1', () => {
    const species = Object.keys(data.dex.species)[0]
    const base = data.dex.species[species].baseStats.hp
    const mon = teamMonOf({ ...member(species), level: 50 }, data)
    expect(mon.hp).toBe(Math.floor(((2 * base + 20) * 50) / 100) + 60)
    expect(mon.name).toBe((data.names.species[species] ?? species).toUpperCase())
    const hidden = teamMonOf({ ...member(species), level: 50, hiddenPowerIvs: { hp: 30, atk: 20, def: 20, spa: 20, spd: 20, spe: 20 } }, data)
    expect(hidden.hp).toBe(Math.floor(((2 * base + 30) * 50) / 100) + 60)
    expect(teamMonOf(member('shedinja'), data).hp).toBe(1)
  })
})

describe('claves y teclado', () => {
  it('las claves de hueco van y vuelven; las flechas se mueven por filas de 6 en la caja y de uno en uno en el equipo, sin salirse', () => {
    expect(placeOf(placeKey({ area: 'box', box: 1, i: 7 }), 1)).toEqual({ area: 'box', box: 1, i: 7 })
    expect(placeOf('party-2', 0)).toEqual({ area: 'party', i: 2 })
    expect(placeOf('otra', 0)).toBeNull()
    expect(arrowTarget({ area: 'box', box: 0, i: 7 }, 'ArrowDown')).toEqual({ area: 'box', box: 0, i: 13 })
    expect(arrowTarget({ area: 'box', box: 0, i: 2 }, 'ArrowUp')).toEqual({ area: 'box', box: 0, i: 0 })
    expect(arrowTarget({ area: 'party', i: 5 }, 'ArrowDown')).toEqual({ area: 'party', i: 5 })
    expect(arrowTarget({ area: 'party', i: 1 }, 'ArrowUp')).toEqual({ area: 'party', i: 0 })
    expect(arrowTarget({ area: 'party', i: 1 }, 'Enter')).toBeNull()
  })
})

// UT-202 (Jose, 12/11/2026): la colocación de Equipo y PC se conserva al salir y volver a entrar mientras siga valiendo.
describe('colocación guardada', () => {
  it('vale con los mismos miembros y sin pasar del límite; con otro miembro o más del límite, no', () => {
    const layout = moveMon(initialLayout(five, 3), { area: 'party', i: 0 }, { area: 'box', box: 0, i: 0 }, 3).layout
    expect(fittingLayout(layout, five, 3)).toBe(layout)
    expect(fittingLayout(null, five, 3)).toBeNull()
    expect(fittingLayout(initialLayout(five, 3), five, 2)).toBeNull()
    expect(fittingLayout(layout, state([...five.members.map((recruit) => member(recruit.id, recruit.fainted)), member('zubat')]), 3)).toBeNull()
  })
})

// UT-206 (Jose, 12/11/2026): el equipo del gimnasio siguiente arranca con los del anterior que siguen en pie, en su orden.
describe('equipo del tramo siguiente', () => {
  it('pone delante a los del último combate vivos y deja fuera al caído', () => {
    expect(initialLayout(five, 3, ['skitty', 'ralts', 'machop']).party.slice(0, 3)).toEqual(['skitty', 'machop', 'grovyle'])
  })
})
