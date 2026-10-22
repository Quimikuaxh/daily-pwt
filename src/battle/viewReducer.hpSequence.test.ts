import { describe, it, expect } from 'vitest'
import { createBattleEngine } from './engine'
import { viewReducer } from './viewReducer'
import type { BattleView } from './protocol'
import { challengeFor } from '../core/challenge'
import { loadGameData } from '../data/gameData'
import { firstEnabled } from '../test-utils/harness'

// Lo que muestra la caja de datos del jugador es `mon.hp` tras cada línea del registro (useBattle aplica una línea por paso).
// Propiedades: cada línea deja los PS exactos del motor (nunca un porcentaje), y los PS solo suben con curación, cambio o `-sethp`.
const HP_RAISING_LINE = /^\|(-heal|-sethp|switch|drag|replace)\|/
const PLAYER_HP_LINE = /^\|(-damage|-heal|-sethp|switch|drag)\|p1[a-c]?: /

describe('PS del jugador renderizados línea a línea (reductor + motor, combates completos)', () => {
  const data = loadGameData()
  // Rival por id y fecha literal (solo siembra el equipo del jugador): no depende de la bolsa ni de LAUNCH_DATE.
  const date = '2026-10-19'
  const scenarios = data.trainers.flatMap(({ id: trainerId }) => ['a', 'b'].map((seed) => ({ trainerId, seed })))

  it.each(scenarios)('$trainerId semilla $seed: PS exactos, sin subidas fuera de curaciones y final igual al snapshot', ({ trainerId, seed }) => {
    const challenge = challengeFor({ trainerId, date }, data)
    const engine = createBattleEngine({ battleSeed: seed, player: challenge.playerTeam, rival: challenge.rivalTeam, ai: 'heuristic', maxTurns: 300 } as never)
    let update = engine.start()
    let shown: BattleView = update.view
    const rendered: { line: string; hp: number; maxHp: number }[] = []
    const updates = [update]
    while (!update.ended && updates.length < 400) {
      update = engine.choose(firstEnabled(update.request!))
      updates.push(update)
    }

    for (const current of updates) {
      for (const line of current.lines) {
        const before = shown.player.team.map((mon) => mon.hp)
        shown = viewReducer(shown, { type: 'lines', lines: [line] })
        shown.player.team.forEach((mon, index) => {
          if (mon.hp === before[index]) return
          expect(mon.hp, `PS en pantalla tras «${line}»`).toBeLessThanOrEqual(mon.maxHp!)
          expect(mon.maxHp, `PS máximos tras «${line}» (si fuera un porcentaje serían 100)`).toBeGreaterThan(100)
          if (mon.hp! > before[index]!) expect(line, `subida de ${before[index]} a ${mon.hp}`).toMatch(HP_RAISING_LINE)
          if (PLAYER_HP_LINE.test(line)) rendered.push({ line, hp: mon.hp!, maxHp: mon.maxHp! })
        })
      }
      shown = viewReducer(shown, { type: 'snapshot', view: current.view })
    }
    expect(rendered.length, 'el combate cambia los PS del jugador').toBeGreaterThan(0)
  })

  it('con las líneas de un turno aplicadas una a una, los PS finales coinciden con el snapshot de ese update', () => {
    const challenge = challengeFor({ trainerId: 'brock', date: '2026-10-19' }, data)
    const engine = createBattleEngine({ battleSeed: 'a', player: challenge.playerTeam, rival: challenge.rivalTeam, ai: 'heuristic', maxTurns: 300 } as never)
    let update = engine.start()
    let shown: BattleView = update.view
    for (let step = 0; step < 40 && !update.ended; step += 1) {
      update = engine.choose(firstEnabled(update.request!))
      shown = update.lines.reduce((view, line) => viewReducer(view, { type: 'lines', lines: [line] }), shown)
      expect(shown.player.team.map((mon) => [mon.hp, mon.maxHp]), `update ${step + 1}`).toEqual(update.view.player.team.map((mon) => [mon.hp, mon.maxHp]))
      shown = viewReducer(shown, { type: 'snapshot', view: update.view })
    }
  })
})
