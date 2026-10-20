import { describe, it, expect, beforeAll } from 'vitest'
import { createBattleEngine } from './engine'
import { translateLines } from './translate'
import { getDailyChallenge } from '../core/challenge'
import { loadGameData } from '../data/gameData'
import { LAUNCH_DATE } from '../config'
import { dates } from '../test-utils/dates'
import { toId } from '../test-utils/dex'
import { firstEnabled, playOut, type PlayResult } from '../test-utils/harness'

// INT-01, INT-12, INT-13, INT-16 y UT-46 sobre la MISMA matriz de partidas (20 semillas x 5 retos = 100 partidas):
// jugador trivial (primer movimiento habilitado) contra el rival con IA heurística, con datos reales.
// Se juegan una vez en beforeAll para no repetir el coste.
const data = loadGameData()
const DATES = dates(5, LAUNCH_DATE)
const SEEDS = Array.from({ length: 20 }, (_, i) => i)
type Game = { date: string; seed: number; game: PlayResult; trainer: any }
let games: Game[] = []

beforeAll(() => {
  games = DATES.flatMap((date) =>
    SEEDS.map((seed) => {
      const c = getDailyChallenge(date, data)
      const engine = createBattleEngine({ battleSeed: `matriz-${date}-${seed}`, player: c.playerTeam, rival: c.rivalTeam, ai: 'heuristic', maxTurns: 300 } as any)
      return { date, seed, trainer: c.trainer, game: playOut(engine as any, (u) => firstEnabled(u.request!)) }
    }),
  )
}, 900_000)

describe('matriz de partidas (INT-01)', () => {
  it('se juegan 100 partidas', () => {
    expect(games).toHaveLength(100)
  })

  it('las 100 terminan', () => {
    expect(games.filter((g) => !g.game.last.ended).map((g) => `${g.date}#${g.seed}`)).toEqual([])
  })

  it('ninguna dura más de 301 turnos', () => {
    expect(games.filter((g) => g.game.last.ended!.turns > 301).map((g) => `${g.date}#${g.seed}`)).toEqual([])
  })

  it('los cinco retos son de cinco rivales distintos', () => {
    expect(new Set(games.filter((g) => g.seed === 0).map((g) => g.trainer.id)).size).toBe(5)
  })

  it('cada resultado es victoria o derrota con motivo conocido', () => {
    const bad = games.filter((g) => !['win', 'loss'].includes(g.game.last.ended!.result) || !['faint', 'turnLimit', 'tie', 'forfeit'].includes(g.game.last.ended!.reason))
    expect(bad).toEqual([])
  })
})

describe('sin cuelgues ni líneas internas (INT-12, INT-16)', () => {
  it('mientras no termina, todo update trae petición para el jugador', () => {
    const bad = games.filter((g) => g.game.updates.some((u) => !u.ended && !u.request))
    expect(bad.map((g) => `${g.date}#${g.seed}`)).toEqual([])
  })

  it('ninguna línea enviada a la UI es |debug| ni |raw|', () => {
    const bad = games.filter((g) => g.game.lines.some((l) => /^\|(debug|raw)\|/.test(l)))
    expect(bad).toEqual([])
  })

  it('en toda la matriz los PS del rival van sobre 100', () => {
    const bad = games.flatMap((g) => g.game.lines).filter((l) => /^\|(-damage|-heal|switch|drag)\|p2a:/.test(l)).filter((l) => { const m = /(\d+)\/(\d+)/.exec(l); return m && m[2] !== '100' })
    expect(bad).toEqual([])
  })
})

describe('la IA usa estado y cambios (INT-13)', () => {
  it('en las 100 partidas el rival usa al menos un movimiento de estado', () => {
    const used = games.flatMap((g) => g.game.lines).filter((l) => l.startsWith('|move|p2a:')).map((l) => toId(l.split('|')[3]))
    expect(used.some((id) => data.dex.moves[id]?.category === 'Status')).toBe(true)
  })

  it('en las 100 partidas el rival hace al menos un cambio voluntario', () => {
    const voluntary = games.flatMap((g) => g.game.updates.slice(1)).filter((u) =>
      u.lines.some((l) => l.startsWith('|switch|p2a:')) && !u.lines.some((l) => l.startsWith('|faint|p2a:')) &&
      !u.lines.some((l) => /^\|move\|p2a:[^|]*\|(U-turn|Volt Switch)/.test(l)))
    expect(voluntary.length).toBeGreaterThan(0)
  })
})

describe('el registro de toda la matriz está en español (UT-46, RF-51)', () => {
  const ENGLISH = /\b(used|fainted|sent out|super effective|not very effective|The opposing|critical hit|But it failed|avoided|went down|came back|Go!|foe|lost the battle|won the battle)\b/i
  const sample = () => games.filter((g) => g.seed < 4)
  const ctxOf = (g: Game) => ({ names: data.names, trainer: { nameEs: g.trainer.nameEs, category: g.trainer.category, gender: 'M' as const } })

  it('ninguna línea traducida contiene tuberías ni marcadores de lado', () => {
    const bad = sample().flatMap((g) => translateLines(g.game.lines, ctxOf(g))).filter((t) => /\||\bp[12][ab]?:/.test(t))
    expect(bad).toEqual([])
  })

  it('ninguna línea traducida contiene palabras inglesas del sim', () => {
    const bad = sample().flatMap((g) => translateLines(g.game.lines, ctxOf(g))).filter((t) => ENGLISH.test(t))
    expect(bad).toEqual([])
  })

  it('los nombres de movimientos y objetos salen en español, no en inglés', () => {
    const offenders: string[] = []
    for (const g of sample()) {
      const ctx = ctxOf(g)
      for (const raw of g.game.lines) {
        const f = raw.split('|')
        const en = raw.startsWith('|move|') ? f[3] : raw.startsWith('|-item|') || raw.startsWith('|-enditem|') ? f[3] : null
        if (!en) continue
        const kind = raw.startsWith('|move|') ? 'moves' : 'items'
        const es = (data.names as any)[kind][toId(en)]
        const out = translateLines([raw], ctx).join(' ')
        if (es && es !== en && out.includes(en)) offenders.push(`${en} -> ${out}`)
      }
    }
    expect(offenders).toEqual([])
  })

  it('cada línea de movimiento produce texto', () => {
    const bad = sample().flatMap((g) => g.game.lines.filter((l) => l.startsWith('|move|')).filter((l) => translateLines([l], ctxOf(g)).length === 0))
    expect(bad).toEqual([])
  })

  it('cada línea de debilitado produce texto', () => {
    const bad = sample().flatMap((g) => g.game.lines.filter((l) => l.startsWith('|faint|')).filter((l) => translateLines([l], ctxOf(g)).length === 0))
    expect(bad).toEqual([])
  })
})
