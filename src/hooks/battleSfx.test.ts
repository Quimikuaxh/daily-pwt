import { describe, expect, it } from 'vitest'
import { BALL_SFX_MS, hitSoundAt, conditionSoundFor, switchBallTimes } from './battleSfx'

// UT-78 · Qué efecto de sonido toca a cada línea (DEC-57).
describe('hitSoundAt', () => {
  it('golpe neutro, supereficaz o poco eficaz según lo que llegue después en la misma acción para ese objetivo', () => {
    const neutral = ['|move|p1a: A|Tackle|p2a: B', '|-damage|p2a: B|50/100', '|move|p2a: B|Tackle|p1a: A']
    expect(hitSoundAt(neutral, 1)).toBe('hit-neutral')
    const superEffective = ['|move|p1a: A|Surf|p2a: B', '|-damage|p2a: B|10/100', '|-supereffective|p2a: B']
    expect(hitSoundAt(superEffective, 1)).toBe('hit-super')
    const resisted = ['|move|p1a: A|Surf|p2a: B', '|-damage|p2a: B|90/100', '|-crit|p2a: B', '|-resisted|p2a: B']
    expect(hitSoundAt(resisted, 1)).toBe('hit-weak')
  })

  it('el supereficaz de la acción siguiente o de otro Pokémon no cuenta', () => {
    expect(hitSoundAt(['|-damage|p2a: B|50/100', '|', '|-supereffective|p2a: B'], 0)).toBe('hit-neutral')
    expect(hitSoundAt(['|-damage|p2a: B|50/100', '|-supereffective|p1a: A'], 0)).toBe('hit-neutral')
  })

  it('cada golpe de un ataque múltiple suena; retroceso, objetos, clima y estados no', () => {
    const multi = ['|move|p1a: A|Rock Blast|p2a: B', '|-damage|p2a: B|80/100', '|-damage|p2a: B|60/100', '|-supereffective|p2a: B', '|-hitcount|p2a: B|2']
    expect([hitSoundAt(multi, 1), hitSoundAt(multi, 2)]).toEqual(['hit-super', 'hit-super'])
    expect(hitSoundAt(['|-damage|p1a: A|80/100|[from] Recoil'], 0)).toBeNull()
    expect(hitSoundAt(['|-damage|p1a: A|80/100|[from] item: Life Orb'], 0)).toBeNull()
    expect(hitSoundAt(['|-damage|p1a: A|80/100 brn|[from] brn'], 0)).toBeNull()
    expect(hitSoundAt(['|move|p1a: A|Tackle|p2a: B', null], 0)).toBeNull()
  })
})

describe('Poké Ball', () => {
  it('los tiempos de lanzar y abrir son los del CSS; sin retirada, 500 ms antes', () => {
    expect(BALL_SFX_MS.rivalSend).toEqual({ throw: 100, open: 520 })
    expect(BALL_SFX_MS.playerSend).toEqual({ throw: 650, open: 1070 })
    expect(switchBallTimes(false)).toEqual({ throw: 800, open: 1120 })
    expect(switchBallTimes(true)).toEqual({ throw: 300, open: 620 })
  })
})

describe('conditionSoundFor', () => {
  // Cambio de requisito (23/10/2026, Jose): la baya y las subidas y bajadas de características también suenan.
  it('cada estado, la baya y las subidas y bajadas suenan con su animación; los movimientos, no', () => {
    expect(['brn', 'psn', 'par', 'slp', 'frz', 'confusion'].map((status) => conditionSoundFor(`status:${status}`))).toEqual([
      'status-brn', 'status-psn', 'status-par', 'status-slp', 'status-frz', 'status-confusion',
    ])
    expect(['item:berry', 'stat:up', 'stat:down'].map(conditionSoundFor)).toEqual(['berry', 'stat-up', 'stat-down'])
    expect(conditionSoundFor('earthquake')).toBeNull()
  })
})
