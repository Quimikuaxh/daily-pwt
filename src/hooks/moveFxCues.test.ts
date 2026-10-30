import { describe, expect, it } from 'vitest'
import { conditionFx, createMultiHitTracker, usedMove } from './moveFxCues'

// UT-70 · Qué movimiento se anima, quién lo usa y a quién va (DEC-53).
describe('usedMove', () => {
  it('jugador y rival, con el objetivo que dice el simulador', () => {
    expect(usedMove('|move|p1a: Politoed|Ice Beam|p2a: Zebstrika')).toEqual({ moveId: 'icebeam', user: 'player', target: 'rival' })
    expect(usedMove('|move|p2a: Zebstrika|Wild Charge|p1a: Politoed')).toEqual({ moveId: 'wildcharge', user: 'rival', target: 'player' })
  })

  it('los movimientos sobre uno mismo (Maldición sin ser Fantasma, Danza Espada) van al propio usuario', () => {
    expect(usedMove('|move|p2a: Snorlax|Curse|p2a: Snorlax')).toEqual({ moveId: 'curse', user: 'rival', target: 'rival' })
    expect(usedMove('|move|p1a: Gengar|Curse|p2a: Snorlax')).toEqual({ moveId: 'curse', user: 'player', target: 'rival' })
    expect(usedMove('|move|p1a: Scizor|Swords Dance|p1a: Scizor')).toMatchObject({ target: 'player' })
  })

  it('no se anima si falla, si es el turno de carga o si no hay objetivo', () => {
    expect(usedMove('|move|p1a: Politoed|Hydro Pump|p2a: Zebstrika|[miss]')).toBeNull()
    expect(usedMove('|move|p1a: Politoed|Solar Beam||[still]')).toBeNull()
    expect(usedMove('|move|p1a: Politoed|Tackle||[notarget]')).toBeNull()
  })

  it('las demás líneas no son movimientos', () => {
    expect(usedMove('|-damage|p2a: Zebstrika|50/100')).toBeNull()
    expect(usedMove('|turn|3')).toBeNull()
  })
})

// UT-74 · Estados, bayas y golpes múltiples (decisiones de Jose del 23/10/2026).
describe('conditionFx', () => {
  it('cada estado se anima sobre quien lo sufre: al caer en él, al no poder moverse, al hacerle daño y al seguir confuso', () => {
    expect(conditionFx('|-status|p2a: Garchomp|brn')).toEqual({ moveId: 'status:brn', user: 'rival', target: 'rival' })
    expect(conditionFx('|-status|p1a: Suicune|tox')).toEqual({ moveId: 'status:psn', user: 'player', target: 'player' })
    expect(conditionFx('|cant|p1a: Suicune|slp')).toMatchObject({ moveId: 'status:slp', target: 'player' })
    expect(conditionFx('|cant|p2a: Garchomp|par')).toMatchObject({ moveId: 'status:par' })
    expect(conditionFx('|cant|p2a: Garchomp|frz')).toMatchObject({ moveId: 'status:frz' })
    expect(conditionFx('|-damage|p2a: Garchomp|88/100 brn|[from] brn')).toMatchObject({ moveId: 'status:brn', target: 'rival' })
    expect(conditionFx('|-damage|p1a: Suicune|150/202 tox|[from] psn')).toMatchObject({ moveId: 'status:psn' })
    expect(conditionFx('|-start|p1a: Suicune|confusion')).toMatchObject({ moveId: 'status:confusion' })
    expect(conditionFx('|-activate|p1a: Suicune|confusion')).toMatchObject({ moveId: 'status:confusion' })
  })

  it('la baya que sube una característica se come sobre el Pokémon; el resto, nada', () => {
    expect(conditionFx('|-boost|p2a: Garchomp|spe|1|[from] item: Salac Berry')).toEqual({ moveId: 'item:berry', user: 'rival', target: 'rival' })
  })

  it('cada subida y bajada de característica, con sus flechas sobre quien la sufre; sin flechas si ya no puede cambiar más', () => {
    expect(conditionFx('|-boost|p1a: Scizor|atk|2')).toEqual({ moveId: 'stat:up', user: 'player', target: 'player' })
    expect(conditionFx('|-boost|p1a: Scizor|atk|2|[from] item: Weakness Policy')).toMatchObject({ moveId: 'stat:up' })
    expect(conditionFx('|-unboost|p2a: Gyarados|atk|1')).toEqual({ moveId: 'stat:down', user: 'rival', target: 'rival' })
    expect(conditionFx('|-boost|p1a: Scizor|atk|0')).toBeNull()
  })

  // Jose, 30/10/2026: el clima se anima al ponerlo una habilidad y en cada turno que sigue; si lo pone un movimiento, ya se anima con él.
  it('el clima se anima al ponerlo una habilidad y en cada turno que sigue, pero no al ponerlo un movimiento ni al acabar', () => {
    expect(conditionFx('|-weather|SunnyDay|[from] ability: Drought|[of] p2a: Ninetales')).toEqual({ moveId: 'sunnyday', user: 'rival', target: null })
    expect(conditionFx('|-weather|Sandstorm|[upkeep]')).toEqual({ moveId: 'sandstorm', user: 'player', target: null })
    expect(conditionFx('|-weather|Hail|[upkeep]')).toMatchObject({ moveId: 'hail' })
    expect(conditionFx('|-weather|RainDance|[from] ability: Drizzle|[of] p1a: Politoed')).toEqual({ moveId: 'raindance', user: 'player', target: null })
    expect(conditionFx('|-weather|SunnyDay')).toBeNull()
    expect(conditionFx('|-weather|none')).toBeNull()
  })

  it('el resto de líneas, nada', () => {
    expect(conditionFx('|cant|p1a: Suicune|recharge')).toBeNull()
    expect(conditionFx('|-damage|p2a: Garchomp|50/100')).toBeNull()
    expect(conditionFx('|-damage|p2a: Garchomp|90/100|[from] item: Life Orb')).toBeNull()
  })
})

describe('createMultiHitTracker', () => {
  const run = (lines: string[]) => {
    const tracker = createMultiHitTracker()
    return lines.map((line) => tracker.next(line))
  }

  it('desde el segundo golpe repite la animación del movimiento antes de cada -damage', () => {
    const repeat = { moveId: 'rockblast', user: 'player', target: 'rival' }
    expect(
      run([
        '|move|p1a: Cloyster|Rock Blast|p2a: Gyarados',
        '|-damage|p2a: Gyarados|80/100',
        '|-damage|p2a: Gyarados|60/100',
        '|-damage|p2a: Gyarados|40/100',
        '|-hitcount|p2a: Gyarados|3',
      ]),
    ).toEqual([null, null, repeat, repeat, null])
  })

  it('un golpe normal, el retroceso, la Vidasfera y el daño del turno siguiente no cuentan como golpes de más', () => {
    expect(
      run([
        '|move|p1a: Staraptor|Brave Bird|p2a: Gyarados',
        '|-damage|p2a: Gyarados|50/100',
        '|-damage|p1a: Staraptor|80/100|[from] Recoil',
        '|-damage|p2a: Gyarados|40/100|[from] item: Rocky Helmet',
        '|',
        '|upkeep',
        '|-damage|p2a: Gyarados|30/100',
      ]).every((cue) => cue === null),
    ).toBe(true)
  })

  it('los movimientos sobre uno mismo no se repiten', () => {
    expect(run(['|move|p1a: Snorlax|Curse|p1a: Snorlax', '|-damage|p1a: Snorlax|50/100', '|-damage|p1a: Snorlax|40/100'])).toEqual([null, null, null])
  })
})
