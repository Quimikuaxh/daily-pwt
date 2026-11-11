import { describe, expect, it } from 'vitest'
import { createBattleEngine } from './engine'
import { battleIdentity, parseBattleIdentity } from './identity'
import type { BattleView, EngineInit } from './protocol'
import { viewReducer } from './viewReducer'
import { translateLine } from './translate'
import { filler, mon } from '../test-utils/teams'
import { readJson } from '../test-utils/paths'
import { beginCampaignBattle, type CampaignBattleDefinition } from '../core/nuzlocke/battle'
import { createCampaign } from '../core/nuzlocke/campaign'
import { realData } from '../ui/battle/party/partyFixtures'

const move = { type: 'move', slot: 1 } as const
const base = { battleSeed: 'identities', ai: 'trivial', maxTurns: 50 } as const

describe('identidades por posición de entrada', () => {
  it('conserva nombres anteriores y distingue la posición sin mezclarla con la especie', () => {
    expect(battleIdentity('rotommow')).toBe('rotommow')
    expect(parseBattleIdentity('Rotom-Mow')).toEqual({ species: 'rotommow' })
    expect(parseBattleIdentity(battleIdentity('geodude', 1))).toEqual({ species: 'geodude', teamIndex: 1 })
  })

  it('los dos Geodude reales de Petra reciben daño y bajas por separado, línea a línea', () => {
    const { encounters } = readJson<Pick<CampaignBattleDefinition, 'encounters'>>('data', 'nuzlocke', 'hoenn-emerald.json')
    const { species } = readJson<Pick<CampaignBattleDefinition, 'species'>>('data', 'nuzlocke', 'hoenn-emerald-progression.json')
    const ready = { ...createCampaign('petra-identities'), phase: 'prepare' as const,
      members: [{ id: 'treecko', species: 'treecko', level: 15, history: [], fainted: false, victories: 0 }] }
    const { init } = beginCampaignBattle({ encounters, species }, ready,
      { unlockedMoves: new Set(), movesByMember: { treecko: ['absorb'] } }, ['treecko'])
    const engine = createBattleEngine({ ...init, ai: 'trivial' })
    let update = engine.start()
    let view: BattleView = update.view
    const fallen = new Set<number>()
    for (let step = 0; step < 60 && !update.ended; step++) {
      update = engine.choose(move)
      for (const line of update.lines) {
        view = viewReducer(view, { type: 'lines', lines: [line] })
        const match = /^\|faint\|p2a: geodude__(\d+)$/.exec(line)
        if (match) {
          fallen.add(Number(match[1]))
          expect(view.rival.team[Number(match[1])]).toMatchObject({ fainted: true, hpPercent: 0 })
          if (fallen.size === 1) expect(view.rival.team[1]).toMatchObject({ fainted: false, hpPercent: 100 })
        }
      }
      expect(view.rival.active).toBe(update.view.rival.active)
      expect(view.rival.team.map(m => [m.hpPercent, m.fainted])).toEqual(update.view.rival.team.map(m => [m.hpPercent, m.fainted]))
    }
    expect([...fallen]).toEqual([0, 1])
    expect(update.ended).toBeDefined()
  })

  it.each([0, 1])('las bajas de duplicados conservan el orden de entrada con inicial %i', playerLead => {
    const engine = createBattleEngine({ ...base, playerLead,
      player: [filler('magikarp'), filler('magikarp')],
      rival: [mon('garchomp', ['earthquake', 'earthquake', 'earthquake', 'earthquake'], { ability: 'roughskin' })] })
    const start = engine.start()
    expect(start.request?.side.pokemon[0].ident).toBe(`p1: magikarp__${playerLead}`)
    const hit = engine.choose(move)
    expect(hit.request?.forceSwitch).toEqual([true])
    let view: BattleView = start.view
    for (const line of hit.lines) view = viewReducer(view, { type: 'lines', lines: [line] })
    expect(view.player.team.map(m => m.fainted)).toEqual([true, false])
    expect(engine.forfeit().ended?.playerFainted).toEqual(playerLead === 0 ? [true, false] : [false, true])
  })

  it('cambios repetidos mantienen las identidades aun con los dos miembros vivos', () => {
    const init: EngineInit = { ...base, playerLead: 1, player: [filler('snorlax'), filler('snorlax')], rival: [filler('shuckle')] }
    const engine = createBattleEngine(init)
    let view: BattleView = engine.start().view
    for (let i = 0; i < 4; i++) {
      const update = engine.choose({ type: 'switch', slot: 2 })
      view = viewReducer(view, { type: 'lines', lines: update.lines })
      expect(view.player.active).toBe(update.view.player.active)
      expect(update.request?.side.pokemon[0].ident).toBe(`p1: snorlax__${i % 2}`)
    }
  })

  it('los estados, curaciones, sustituto y arrastre se aplican a la instancia indicada', () => {
    const engine = createBattleEngine({ ...base, player: [filler('snorlax')], rival: [filler('geodude'), filler('geodude')] })
    const view = viewReducer(engine.start().view, { type: 'lines', lines: [
      '|drag|p2a: geodude__1|Geodude, L50|80/100',
      '|-status|p2a: geodude__1|par', '|-start|p2a: geodude__1|Substitute',
      '|-damage|p2a: geodude__1|20/100', '|-heal|p2a: geodude__1|40/100',
    ] })
    expect(view.rival.active).toBe(1)
    expect(view.rival.team[0]).toMatchObject({ hpPercent: 100, status: null })
    expect(view.rival.team[1]).toMatchObject({ hpPercent: 40, status: 'par', substitute: true })
    expect(viewReducer(view, { type: 'lines', lines: ['|-curestatus|p2a: geodude__1|par', '|-end|p2a: geodude__1|Substitute'] }).rival.team[1])
      .toMatchObject({ status: null })
    const ctx = { names: realData.names, trainer: { nameEs: 'Petra', category: 'leader', gender: 'F' } } as const
    expect(translateLine('|faint|p2a: geodude__1', ctx)).toBe(translateLine('|faint|p2a: geodude', ctx))
  })

  it('conserva la especie completa aunque el apodo con sufijo exceda el límite del simulador', () => {
    const team = [filler('basculinbluestriped'), filler('basculinbluestriped')]
    const update = createBattleEngine({ ...base, player: team, rival: team }).start()
    expect(update.request?.side.pokemon.map(p => p.ident)).toEqual(['p1: basculinbluestriped__0', 'p1: basculinbluestriped__1'])
    expect(update.lines.some(line => line.startsWith('|switch|p2a: basculinbluestriped__0|Basculin-Blue-Striped,'))).toBe(true)
  })

  it('no altera líneas, ident ni campos de identidad de equipos sin duplicados', () => {
    const update = createBattleEngine({ ...base, player: [filler('snorlax')], rival: [filler('shuckle')] }).start()
    expect(update.request?.side.pokemon[0].ident).toBe('p1: snorlax')
    expect(update.lines.join('\n')).not.toMatch(/member\d|__/)
    expect(update.view.player.team[0]).not.toHaveProperty('teamIndex')
  })
})
