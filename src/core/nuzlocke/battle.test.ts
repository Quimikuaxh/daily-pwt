import { describe, expect, it } from 'vitest'
import { createBattleEngine } from '../../battle/engine'
import { readJson } from '../../test-utils/paths'
import { beginCampaignBattle, finishCampaignBattle, type CampaignBattleDefinition } from './battle'
import { createCampaign } from './campaign'

const { encounters } = readJson<Pick<CampaignBattleDefinition, 'encounters'>>('data', 'nuzlocke', 'hoenn-emerald.json')
const { species } = readJson<Pick<CampaignBattleDefinition, 'species'>>('data', 'nuzlocke', 'hoenn-emerald-progression.json')
const definition: CampaignBattleDefinition = { encounters, species }
const ready = {
  ...createCampaign('battle'),
  phase: 'prepare' as const,
  members: [{ id: 'treecko', species: 'treecko', level: 15, history: [], fainted: false, victories: 0 }],
}
const options = { unlockedMoves: new Set<string>(), movesByMember: { treecko: ['absorb'] } }

describe('combates de la campaña de Hoenn', () => {
  it('prepara un combate individual de Gen 3 con los equipos originales y los mismos IV, EV y naturaleza para ambos bandos', () => {
    const { init } = beginCampaignBattle(definition, ready, options, ['treecko'])
    expect(init.generation).toBe(3)
    expect(init.player[0]).toMatchObject({ species: 'treecko', level: 15, moves: ['absorb'], ivs: { hp: 20 } })
    expect(init.rival.map(member => [member.species, member.level, member.item, member.ivs.hp])).toEqual([
      ['geodude', 12, '', 20], ['geodude', 12, '', 20], ['nosepass', 15, 'oranberry', 20],
    ])
    expect([...init.player, ...init.rival].every(member =>
      member.nature === 'Serious' && Object.values(member.ivs).every(iv => iv === 20) &&
      Object.values(member.evs).every(ev => ev === 0))).toBe(true)
    expect(beginCampaignBattle(definition, ready, options, ['treecko']).init).toEqual(init)
  })

  // UT-211 (Jose, 13/11/2026): dificultad de la IA elegida al empezar la campaña.
  it('Fácil usa la heurística en todos; Difícil mira un turno por delante también en los gimnasios', () => {
    const at = (encounterIndex: number, ai: 'easy' | 'hard') => beginCampaignBattle(definition, { ...ready, encounterIndex, difficulty: { ai, draft: 'normal' } }, options, ['treecko']).init
    expect(at(0, 'easy').ai).toBe('heuristic')
    expect(at(12, 'easy').ai).toBe('heuristic')
    expect(at(0, 'hard').ai).toBe('lookahead')
    expect(at(0, 'hard').foeMovePool).toBeDefined()
  })

  // UT-195 (Jose, 12/11/2026): los gimnasios siguen con la heurística; el Alto Mando y el campeón miran un turno por delante.
  it('usa la IA de un turno por delante solo con el Alto Mando y el campeón', () => {
    const at = (encounterIndex: number) => beginCampaignBattle(definition, { ...ready, encounterIndex }, options, ['treecko']).init.ai
    expect(at(0)).toBe('heuristic')
    expect(at(7)).toBe('heuristic')
    expect(at(8)).toBe('lookahead')
    expect(at(12)).toBe('lookahead')
    // Un combate entero contra Sixto con esa IA termina sin errores (decide en cada turno y en los cambios forzados).
    const engine = createBattleEngine(beginCampaignBattle(definition, { ...ready, encounterIndex: 8 }, options, ['treecko']).init)
    let update = engine.start()
    for (let turn = 0; turn < 40 && !update.ended; turn++) update = engine.choose({ type: 'move', slot: 1 })
    expect(update.ended).toBeTruthy()
  })

  it('arranca el motor con un solo Pokémon y aplica una derrota real a la campaña', () => {
    const { init, state } = beginCampaignBattle(definition, ready, options, ['treecko'])
    const engine = createBattleEngine(init)
    expect(engine.start().request?.active?.[0].moves.map(move => move.id)).toEqual(['absorb'])
    const { ended } = engine.forfeit()
    expect(ended?.result).toBe('loss')
    const other = beginCampaignBattle(definition, ready, {
      ...options, movesByMember: { treecko: ['quickattack'] },
    }, ['treecko'])
    expect(() => finishCampaignBattle(definition, state, ended!, other.init.battleSeed)).toThrow(/otro combate/i)
    expect(finishCampaignBattle(definition, state, ended!, init.battleSeed).phase).toBe('lost')
  })

  it('rechaza un set con movimientos que el jugador aún no puede elegir', () => {
    expect(() => beginCampaignBattle(definition, ready, {
      ...options, movesByMember: { treecko: ['leafblade'] },
    }, ['treecko'])).toThrow(/movimiento/i)
    expect(() => beginCampaignBattle(definition, ready, {
      ...options, movesByMember: {},
    }, ['treecko'])).toThrow(/movimiento/i)
  })
})

describe('IV de Poder Oculto en Hoenn', () => {
  // La MT10 del recorrido habitual se obtiene antes de Erico, no antes de Petra.
  const hiddenReady = { ...ready, encounterIndex: 2, members: ready.members.map(member => ({
    ...member, species: 'grovyle', level: 24, history: [{ species: 'treecko', evolvedAt: 16 }],
  })) }
  const withHiddenPower = { unlockedMoves: new Set(['hiddenpower']), movesByMember: { treecko: ['hiddenpower'] } }

  it('asigna IV mixtos entre 19 y 20 y conserva el sorteo al quitar el movimiento y evolucionar', () => {
    const first = beginCampaignBattle(definition, hiddenReady, withHiddenPower, ['treecko'])
    const ivs = first.init.player[0].ivs
    expect(new Set(Object.values(ivs))).toEqual(new Set([19, 20]))
    expect(first.state.members[0].hiddenPowerIvs).toEqual(ivs)
    expect(beginCampaignBattle(definition, hiddenReady, withHiddenPower, ['treecko']).init.player[0].ivs).toEqual(ivs)
    expect(hiddenReady.members[0]).not.toHaveProperty('hiddenPowerIvs')

    const next = finishCampaignBattle(definition, first.state, {
      result: 'win', reason: 'faint', turns: 1, playerAlive: 1, rivalFainted: first.init.rival.length, playerFainted: [false],
    }, first.init.battleSeed)
    const second = beginCampaignBattle(definition, { ...next, phase: 'prepare' }, options, ['treecko'])
    expect(second.init.player[0]).toMatchObject({ species: 'grovyle', moves: ['absorb'], ivs })
    const beforeAlana = { ...next, phase: 'prepare' as const, encounterIndex: 5,
      members: next.members.map(member => ({ ...member, level: 33 })) }
    const alana = beginCampaignBattle(definition, beforeAlana, options, ['treecko'])
    const evolved = finishCampaignBattle(definition, alana.state, {
      result: 'win', reason: 'faint', turns: 1, playerAlive: 1, rivalFainted: alana.init.rival.length, playerFainted: [false],
    }, alana.init.battleSeed)
    expect(evolved.members[0]).toMatchObject({ species: 'sceptile', level: 42, hiddenPowerIvs: ivs })
    expect(evolved.members[0].history).toEqual([{ species: 'treecko', evolvedAt: 16 }, { species: 'grovyle', evolvedAt: 36 }])
    expect(beginCampaignBattle(definition, { ...evolved, phase: 'prepare' }, options, ['treecko']).init.player[0]).toMatchObject({ species: 'sceptile', ivs })
  })

  it('solo sortea los IV de los rivales que tengan Poder Oculto y el resultado es reproducible', () => {
    const petra = encounters[0]
    const first = { ...petra.team[0], moves: ['hiddenpower'] }
    const fixture = { ...definition, encounters: [{ ...petra, team: [first, ...petra.team.slice(1)] }, ...encounters.slice(1)] }
    const start = () => beginCampaignBattle(fixture, ready, options, ['treecko']).init
    const init = start()
    expect(new Set(Object.values(init.rival[0].ivs))).toEqual(new Set([19, 20]))
    expect(new Set(Object.values(init.rival[1].ivs))).toEqual(new Set([20]))
    expect(init).toEqual(start())
  })
})
