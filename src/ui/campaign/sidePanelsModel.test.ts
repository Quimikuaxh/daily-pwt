import { describe, expect, it } from 'vitest'
import type { BattleSet, SideView } from '../../battle/protocol'
import { BATTLE_PANEL, CAMPAIGN_PANEL, sideMons, sidePanelOffset, stageText } from './sidePanelsModel'

const set = (species: string, level = 15): BattleSet => ({
  species, nameEs: species, level, item: species === 'treecko' ? 'oranberry' : '', ability: 'overgrow', moves: ['pound', 'leer'],
  nature: 'serious', ivs: { hp: 20, atk: 20, def: 20, spa: 20, spd: 20, spe: 20 }, evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
})
const statsOf = () => ({ hp: 40, atk: 20, def: 18, spa: 25, spd: 22, spe: 30 })

// UT-198 (Jose, 12/11/2026): paneles laterales de la campaña en escritorio, solo si caben a los lados de la consola.
describe('paneles laterales de la campaña', () => {
  it('caben a 1440 x 900 y a 1280 x 720, pero no en móvil ni en ventanas estrechas o bajas', () => {
    expect(sidePanelOffset(1440, 900, 150, CAMPAIGN_PANEL.h)).toBe(240 + 24)
    expect(sidePanelOffset(1280, 720, 150, CAMPAIGN_PANEL.h)).not.toBeNull()
    expect(sidePanelOffset(360, 740, 150, CAMPAIGN_PANEL.h)).toBeNull()
    expect(sidePanelOffset(1100, 900, 150, CAMPAIGN_PANEL.h)).toBeNull()
    expect(sidePanelOffset(1440, 640, 150, BATTLE_PANEL.h)).toBeNull()
  })

  it('el jugador ve sus PS reales, sus PP y el objeto actual; el rival, el porcentaje', () => {
    const side: SideView = { remaining: 2, active: 1, team: [
      { teamIndex: 0, species: 'treecko', hpPercent: 50, hp: 20, maxHp: 40, status: 'par', fainted: false, item: '', moves: [{ id: 'pound', pp: 30, maxPp: 35 }] },
      { teamIndex: 1, species: 'ralts', hpPercent: 0, hp: 0, maxHp: 30, status: null, fainted: true },
    ] }
    const [treecko, ralts] = sideMons({ sets: [set('treecko'), set('ralts')], side, statsOf, player: true })
    expect(treecko).toMatchObject({ hp: 20, maxHp: 40, percentOnly: false, status: 'par', item: '', active: false })
    expect(treecko.moves).toEqual([{ id: 'pound', pp: 30, maxPp: 35 }, { id: 'leer', pp: null, maxPp: null }])
    expect(ralts).toMatchObject({ hp: 0, fainted: true, active: true, status: null })
    const [rival] = sideMons({ sets: [set('geodude')], side: { remaining: 1, active: 0, team: [{ species: 'geodude', hpPercent: 64, status: null, fainted: false }] }, statsOf, player: false })
    expect(rival).toMatchObject({ hp: 64, maxHp: 100, percentOnly: true, active: true, stats: statsOf() })
  })

  it('sin vista (el motor aún carga) salen con los PS llenos y el objeto del set; las estadísticas exactas, de la petición', () => {
    const request = { side: { name: 'p1', id: 'p1', pokemon: [{ ident: 'p1: Treecko', details: 'Treecko, L15', condition: '40/40', active: true, stats: { atk: 21, def: 19, spa: 26, spd: 23, spe: 31 } }] } }
    const [treecko] = sideMons({ sets: [set('treecko')], side: null, request: request as never, statsOf, player: true })
    expect(treecko).toMatchObject({ hp: 40, maxHp: 40, item: 'oranberry', active: false, stats: { hp: 40, atk: 21, def: 19, spa: 26, spd: 23, spe: 31 } })
  })

  it('las subidas y bajadas se escriben como en el juego', () => {
    expect(stageText({ atk: 2, spe: -1 }, 'atk')).toBe('+2')
    expect(stageText({ atk: 2, spe: -1 }, 'spe')).toBe('-1')
    expect(stageText({ atk: 2 }, 'hp')).toBe('')
    expect(stageText(null, 'def')).toBe('')
  })
})
