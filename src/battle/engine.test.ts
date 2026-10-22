import { describe, it, expect } from 'vitest'
import { createBattleEngine } from './engine'
import { calcStats } from '../core/stats'
import { gen5, toId } from '../test-utils/dex'
import { filler, harmlessTeam, mon, withLead, attackers } from '../test-utils/teams'
import { firstEnabled, playOut, speciesOfDetails, type EngineUpdate } from '../test-utils/harness'
import { mkResolved } from '../test-utils/fixtures'

// INT-02, 05..12 (motor en Node, sin worker). Contrato del motor: ver docstring de src/test-utils/harness.ts.
// El rival 'trivial' usa siempre su primer movimiento habilitado: así cada escenario es un guion.
const init = (over: Record<string, unknown> = {}) => ({
  battleSeed: 'seed-A', player: harmlessTeam(), rival: harmlessTeam(), ai: 'trivial' as const, maxTurns: 300, ...over,
})
const make = (over: Record<string, unknown> = {}) => createBattleEngine(init(over) as any)
const moveOf = (n: number) => ({ type: 'move' as const, slot: n })
const switchTo = (n: number) => ({ type: 'switch' as const, slot: n })
const detailsId = (p: { details: string }) => toId(speciesOfDetails(p.details))

describe('determinismo (INT-02)', () => {
  const run = (seed: string, ai: 'heuristic' | 'trivial' = 'heuristic') =>
    playOut(make({ battleSeed: seed, player: attackers(), rival: attackers().reverse(), ai }) as any)

  it('misma semilla y mismas elecciones dan un log idéntico byte a byte', () => {
    expect(run('seed-1').lines.join('\n')).toBe(run('seed-1').lines.join('\n'))
  })

  it('misma semilla y mismas elecciones dan las mismas elecciones y el mismo final', () => {
    const a = run('seed-1'), b = run('seed-1')
    expect([a.choices, a.last.ended]).toEqual([b.choices, b.last.ended])
  })

  it('semillas distintas dan logs distintos', () => {
    const logs = ['s1', 's2', 's3', 's4', 's5'].map((s) => run(s).lines.join('\n'))
    expect(new Set(logs).size).toBeGreaterThan(1)
  })

  it('la misma semilla con IA trivial también es reproducible', () => {
    expect(run('seed-2', 'trivial').lines).toEqual(run('seed-2', 'trivial').lines)
  })
})

describe('formato de salida (INT-04, INT-16)', () => {
  const game = playOut(make({ battleSeed: 'fmt', player: attackers(), rival: attackers().reverse(), ai: 'heuristic' }) as any)

  it('ninguna línea contiene |debug|, |raw| ni |split|', () => {
    expect(game.lines.filter((l) => /^\|(debug|raw|split)\|/.test(l))).toEqual([])
  })

  it('los PS del rival en las líneas están siempre sobre 100', () => {
    const hp = game.lines.filter((l) => /^\|(-damage|-heal|switch|drag|replace)\|p2a:/.test(l))
    const bad = hp.filter((l) => { const m = /(\d+)\/(\d+)/.exec(l); return m && m[2] !== '100' })
    expect([hp.length > 0, bad]).toEqual([true, []])
  })

  it('los PS del jugador son reales (su máximo supera 100 en algún Pokémon)', () => {
    const maxes = game.lines.filter((l) => /^\|(switch|-damage|-heal)\|p1a:/.test(l)).map((l) => Number(/\/(\d+)/.exec(l)?.[1] ?? 0))
    expect(Math.max(...maxes)).toBeGreaterThan(100)
  })

  it('la vista del rival solo expone porcentajes (sin hp/maxHp absolutos)', () => {
    const rivalMon = game.updates[0].view.rival.team[0]
    expect([rivalMon.hpPercent, 'maxHp' in rivalMon]).toEqual([100, false])
  })

  it('la vista del jugador expone hp y maxHp reales', () => {
    const m = game.updates[0].view.player.team[0]
    expect(m.maxHp).toBeGreaterThan(100)
  })

  it('la vista del jugador trae los PP de sus movimientos y la del rival no trae ninguno (pantalla de datos)', () => {
    const view = game.updates[0].view
    const playerMon = view.player.team[0]
    expect(playerMon.moves).toHaveLength(4)
    for (const move of playerMon.moves ?? []) expect(move.maxPp).toBeGreaterThan(0)
    expect(view.rival.team.some((mon: any) => 'moves' in mon)).toBe(false)
  })

  it('los PP actuales bajan al usar un movimiento', () => {
    const engine = make() as any
    const before = engine.start().view.player.team[engine.start().view.player.active].moves
    const after = engine.choose({ type: 'move', slot: 1 }).view
    const active = after.player.team[after.player.active]
    expect(active.moves[0].pp).toBe(before[0].pp - 1)
  })

  it('todos los hpPercent de la vista del rival están entre 0 y 100 durante toda la partida', () => {
    const bad = game.updates.flatMap((u) => u.view.rival.team).filter((m: any) => m.hpPercent < 0 || m.hpPercent > 100)
    expect(bad).toEqual([])
  })
})

describe('reglas del formato (INT-05)', () => {
  it('no hay Team Preview: la primera petición ya es de movimiento', () => {
    const u = make().start()
    expect([u.request?.active !== undefined, (u.request as any)?.teamPreview]).toEqual([true, undefined])
  })

  it('el log inicial no contiene teampreview', () => {
    expect(make().start().lines.join('\n')).not.toMatch(/teampreview/)
  })

  it('todos los Pokémon están a nivel 50', () => {
    expect(make().start().request!.side.pokemon.every((p) => /L50/.test(p.details))).toBe(true)
  })

  it('los stats del sim coinciden con calcStats (IV 20, EV mixtos, naturaleza)', () => {
    const ivs = { hp: 20, atk: 20, def: 20, spa: 20, spd: 20, spe: 20 }
    const evs = { hp: 4, atk: 252, def: 0, spa: 0, spd: 0, spe: 252 }
    const g = mkResolved('garchomp', 'lifeorb', 'roughskin', ['earthquake', 'outrage', 'stoneedge', 'swordsdance'], { nature: 'Jolly', ivs, evs })
    const p = make({ player: withLead(g) }).start().request!.side.pokemon[0] as any
    const expected = calcStats(gen5.species.get('garchomp')!.baseStats as any, ivs, evs, 'Jolly', 50)
    expect({ ...p.stats, hp: Number(p.condition.split('/')[1].split(' ')[0]) }).toEqual({ atk: expected.atk, def: expected.def, spa: expected.spa, spd: expected.spd, spe: expected.spe, hp: expected.hp })
  })

  it('sin cláusula de sueño: dos Pokémon del jugador pueden dormir a la vez', () => {
    const rival = withLead(mon('breloom', ['spore', 'splash', 'tackle', 'recover']))
    const e = make({ rival })
    e.start()
    e.choose(moveOf(1))
    const u = e.choose(switchTo(2))
    expect(u.view.player.team.filter((m: any) => m.status === 'slp')).toHaveLength(2)
  })

  it('sin cláusula de KO en un golpe: Frío Polar puede debilitar de un golpe (alguna semilla en 40)', () => {
    const rival = withLead(mon('walrein', ['sheercold', 'splash', 'tackle', 'recover']))
    const hits = Array.from({ length: 40 }, (_, i) => {
      const e = make({ battleSeed: 'ohko-' + i, rival })
      e.start()
      return e.choose(moveOf(1)).lines.some((l) => l.startsWith('|-ohko'))
    })
    expect(hits.some(Boolean)).toBe(true)
  })

  it('Frío Polar no falla por cláusula (no hay línea de fallo por regla)', () => {
    const rival = withLead(mon('walrein', ['sheercold', 'splash', 'tackle', 'recover']))
    const e = make({ rival })
    e.start()
    expect(e.choose(moveOf(1)).lines.join('\n')).not.toMatch(/[Cc]lause/)
  })

  it('sin cláusula de especie ni de objeto: dos Garchomp con el mismo objeto son válidos', () => {
    const g = () => mon('garchomp', ['earthquake', 'outrage', 'stoneedge', 'swordsdance'], { item: 'lifeorb', ability: 'roughskin' })
    const u = make({ player: [g(), g(), ...harmlessTeam().slice(2)] }).start()
    expect(u.view.player.team.filter((m: any) => m.species === 'garchomp')).toHaveLength(2)
  })

  it('el equipo del jugador tiene 6 Pokémon en la vista inicial', () => {
    expect(make().start().view.player.team).toHaveLength(6)
  })
})

describe('Pokémon iniciales e índices de cambio (INT-06, RF-42, RF-08)', () => {
  it('por defecto el inicial del jugador es el primero de su lista', () => {
    const u = make().start()
    expect(detailsId(u.request!.side.pokemon[0])).toBe('shuckle')
  })

  it('playerLead hace que empiece el Pokémon elegido', () => {
    const u = make({ playerLead: 2 }).start()
    expect(detailsId(u.request!.side.pokemon[0])).toBe('snorlax')
  })

  it('la vista marca como activo al inicial elegido', () => {
    const v = make({ playerLead: 3 }).start().view.player
    expect(v.team[v.active].species).toBe('wobbuffet')
  })

  it('el Pokémon elegido sale del equipo sin perder a los demás (6 distintos)', () => {
    const ids = make({ playerLead: 4 }).start().request!.side.pokemon.map(detailsId)
    expect(new Set(ids).size).toBe(6)
  })

  it('empieza el primero del rival (rival[0])', () => {
    const rival = withLead(filler('wobbuffet'))
    const v = make({ rival }).start().view.rival
    expect(v.team[v.active].species).toBe('wobbuffet')
  })

  it('switch N se refiere a request.side.pokemon: tras cambiar a la posición 3 sale ese Pokémon', () => {
    const e = make()
    const before = e.start().request!.side.pokemon
    const after = e.choose(switchTo(3)).request!
    expect(detailsId(after.side.pokemon[0])).toBe(detailsId(before[2]))
  })

  it('tras el reordenado del sim, el siguiente switch 2 saca al de la nueva posición 2', () => {
    const e = make()
    e.start()
    const mid = e.choose(switchTo(3)).request!
    const after = e.choose(switchTo(2)).request!
    expect(detailsId(after.side.pokemon[0])).toBe(detailsId(mid.side.pokemon[1]))
  })

  it('la vista se mantiene consistente con la petición tras cambiar', () => {
    const e = make()
    e.start()
    const u = e.choose(switchTo(4))
    expect(u.view.player.team[u.view.player.active].species).toBe(detailsId(u.request!.side.pokemon[0]))
  })
})

describe('restricciones del request (INT-07, DEC-11)', () => {
  const turnOf = (u: EngineUpdate) => u.view.turn

  it('Pañuelo/Banda Elección bloquea los otros movimientos al siguiente turno', () => {
    const g = mon('garchomp', ['earthquake', 'outrage', 'stoneedge', 'swordsdance'], { item: 'choiceband', ability: 'roughskin' })
    const e = make({ player: withLead(g) })
    e.start()
    const moves = e.choose(moveOf(1)).request!.active![0].moves
    expect(moves.map((m) => !!m.disabled)).toEqual([false, true, true, true])
  })

  it('una elección bloqueada por Elección se rechaza sin avanzar el turno', () => {
    const g = mon('garchomp', ['earthquake', 'outrage', 'stoneedge', 'swordsdance'], { item: 'choiceband', ability: 'roughskin' })
    const e = make({ player: withLead(g) })
    e.start()
    const u = e.choose(moveOf(1))
    expect(() => e.choose(moveOf(2))).toThrow()
    expect(e.choose(moveOf(1)).view.turn).toBe(turnOf(u) + 1)
  })

  it('Mofa deshabilita los movimientos de estado', () => {
    const s = mon('starmie', ['recover', 'surf', 'icebeam', 'thunderbolt'], { ability: 'naturalcure' })
    const e = make({ player: withLead(s), rival: withLead(mon('gengar', ['taunt', 'splash', 'tackle', 'recover'])) })
    e.start()
    const moves = e.choose(moveOf(2)).request!.active![0].moves
    expect(moves[0].disabled).toBe(true)
  })

  it('Otra Vez (Encore) obliga a repetir el último movimiento', () => {
    const g = mon('garchomp', ['earthquake', 'outrage', 'stoneedge', 'swordsdance'], { ability: 'roughskin' })
    const e = make({ player: withLead(g), rival: withLead(mon('shuckle', ['encore', 'splash', 'tackle', 'recover'])) })
    e.start()
    const moves = e.choose(moveOf(1)).request!.active![0].moves
    expect(moves.map((m) => !!m.disabled)).toEqual([false, true, true, true])
  })

  it('Anulación (Disable) deshabilita el último movimiento usado (en alguna semilla)', () => {
    const g = mon('garchomp', ['earthquake', 'outrage', 'stoneedge', 'swordsdance'], { ability: 'roughskin' })
    const seen = Array.from({ length: 20 }, (_, i) => {
      const e = make({ battleSeed: 'dis-' + i, player: withLead(g), rival: withLead(mon('shuckle', ['disable', 'splash', 'tackle', 'recover'])) })
      e.start()
      return e.choose(moveOf(1)).request!.active![0].moves[0].disabled === true
    })
    expect(seen.some(Boolean)).toBe(true)
  })

  it('Mal de Ojo deja al activo atrapado', () => {
    const e = make({ player: withLead(filler('snorlax')), rival: withLead(mon('umbreon', ['meanlook', 'splash', 'tackle', 'recover'])) })
    e.start()
    expect(e.choose(moveOf(1)).request!.active![0].trapped).toBe(true)
  })

  it('estando atrapado, un cambio se rechaza sin avanzar el turno', () => {
    const e = make({ player: withLead(filler('snorlax')), rival: withLead(mon('umbreon', ['meanlook', 'splash', 'tackle', 'recover'])) })
    e.start()
    const u = e.choose(moveOf(1))
    expect(() => e.choose(switchTo(2))).toThrow()
    expect(u.view.turn).toBe(2)
  })

  it('tras Hiperrayo acertado, la petición solo ofrece Recarga (en alguna semilla)', () => {
    const s = mon('snorlax', ['hyperbeam', 'splash', 'tackle', 'recover'], { ability: 'immunity' })
    const results = Array.from({ length: 10 }, (_, i) => {
      const e = make({ battleSeed: 'hb-' + i, player: withLead(s) })
      e.start()
      return e.choose(moveOf(1)).request!.active![0].moves.map((m) => m.id)
    })
    expect(results.some((r) => r.length === 1 && r[0] === 'recharge')).toBe(true)
  })

  it('un movimiento de dos turnos (Vuelo) deja una única opción en el segundo turno', () => {
    const c = mon('charizard', ['fly', 'splash', 'tackle', 'recover'], { ability: 'blaze' })
    const e = make({ player: withLead(c) })
    e.start()
    expect(e.choose(moveOf(1)).request!.active![0].moves.map((m) => m.id)).toEqual(['fly'])
  })

  it.each([[{ type: 'move', slot: 9 }], [{ type: 'move', slot: 0 }], [{ type: 'switch', slot: 1 }], [{ type: 'switch', slot: 99 }]])(
    'la elección inválida %j se rechaza',
    (bad) => {
      const e = make()
      e.start()
      expect(() => e.choose(bad as any)).toThrow()
    },
  )

  it('una elección inválida no avanza la partida: la siguiente válida sigue en el turno 1', () => {
    const e = make()
    e.start()
    try { e.choose({ type: 'move', slot: 9 } as any) } catch { /* esperado */ }
    expect(e.choose(moveOf(1)).view.turn).toBe(2)
  })

  it('cambiar a un Pokémon debilitado se rechaza', () => {
    const rival = withLead(mon('garchomp', ['earthquake', 'outrage', 'stoneedge', 'swordsdance'], { ability: 'roughskin' }))
    const e = make({ player: withLead(filler('magikarp')), rival })
    e.start()
    const u = e.choose(moveOf(1)) // el lead cae -> cambio forzado
    expect(u.request!.forceSwitch).toBeTruthy()
    expect(() => e.choose(switchTo(1))).toThrow()
  })
})

describe('cambios forzados (INT-08, RF-49)', () => {
  it('al debilitarse el activo, la petición exige un sustituto', () => {
    const rival = withLead(mon('garchomp', ['earthquake', 'outrage', 'stoneedge', 'swordsdance'], { ability: 'roughskin' }))
    const e = make({ player: withLead(filler('magikarp')), rival })
    e.start()
    expect(e.choose(moveOf(1)).request!.forceSwitch).toEqual([true])
  })

  it('con cambio forzado pendiente, elegir un movimiento se rechaza', () => {
    const rival = withLead(mon('garchomp', ['earthquake', 'outrage', 'stoneedge', 'swordsdance'], { ability: 'roughskin' }))
    const e = make({ player: withLead(filler('magikarp')), rival })
    e.start()
    e.choose(moveOf(1))
    expect(() => e.choose(moveOf(1))).toThrow()
  })

  it('elegir sustituto reanuda el combate con petición normal', () => {
    const rival = withLead(mon('garchomp', ['earthquake', 'outrage', 'stoneedge', 'swordsdance'], { ability: 'roughskin' }))
    const e = make({ player: withLead(filler('magikarp')), rival })
    e.start()
    e.choose(moveOf(1))
    const request = e.choose(switchTo(2)).request!
    expect([request.forceSwitch, request.active![0].moves.length]).toEqual([undefined, 4])
  })

  it('Ida y Vuelta (U-turn) pide un sustituto tras golpear', () => {
    const s = mon('scizor', ['uturn', 'splash', 'tackle', 'recover'], { ability: 'technician' })
    const e = make({ player: withLead(s) })
    e.start()
    expect(e.choose(moveOf(1)).request!.forceSwitch).toEqual([true])
  })

  it('Voltiocambio pide un sustituto tras golpear', () => {
    const j = mon('jolteon', ['voltswitch', 'splash', 'tackle', 'recover'], { ability: 'voltabsorb' })
    const e = make({ player: withLead(j) })
    e.start()
    expect(e.choose(moveOf(1)).request!.forceSwitch).toEqual([true])
  })

  it('un movimiento de arrastre del rival (Rugido) cambia a mi Pokémon sin pedir elección', () => {
    const e = make({ rival: withLead(mon('shuckle', ['roar', 'splash', 'tackle', 'recover'])) })
    const first = detailsId(e.start().request!.side.pokemon[0])
    const u = e.choose(moveOf(1))
    expect([detailsId(u.request!.side.pokemon[0]) !== first, u.request!.forceSwitch]).toEqual([true, undefined])
  })

  it('Ida y Vuelta sin banquillo se resuelve sin cambio y sin bloquear', () => {
    const s = mon('scizor', ['uturn', 'splash', 'tackle', 'recover'], { ability: 'technician' })
    const e = make({ player: [s] })
    e.start()
    const u = e.choose(moveOf(1))
    expect([u.request!.forceSwitch, u.request!.active !== undefined, u.ended]).toEqual([undefined, true, undefined])
  })

  it('tras un U-turn sin banquillo la partida sigue aceptando elecciones', () => {
    const s = mon('scizor', ['uturn', 'splash', 'tackle', 'recover'], { ability: 'technician' })
    const e = make({ player: [s] })
    e.start()
    e.choose(moveOf(1))
    expect(e.choose(moveOf(2)).view.turn).toBe(3)
  })
})

describe('respuesta de la IA a sus propias peticiones (INT-12)', () => {
  it('cuando el activo del rival cae, ya ha elegido sustituto en el mismo update', () => {
    const attacker = mon('garchomp', ['earthquake', 'outrage', 'stoneedge', 'swordsdance'], { ability: 'roughskin' })
    const e = make({ player: withLead(attacker), rival: withLead(filler('magikarp')), ai: 'heuristic' })
    e.start()
    const u = e.choose(moveOf(1))
    expect(u.lines.some((l) => l.startsWith('|switch|p2a:'))).toBe(true)
  })

  it('tras esa sustitución la petición del jugador es normal (sin cuelgue)', () => {
    const attacker = mon('garchomp', ['earthquake', 'outrage', 'stoneedge', 'swordsdance'], { ability: 'roughskin' })
    const e = make({ player: withLead(attacker), rival: withLead(filler('magikarp')), ai: 'heuristic' })
    e.start()
    const request = e.choose(moveOf(1)).request!
    expect([request.forceSwitch, request.active![0].moves.length]).toEqual([undefined, 4])
  })

  it('un Ida y Vuelta de la IA también se resuelve dentro del mismo update', () => {
    const s = mon('scizor', ['uturn', 'splash', 'tackle', 'recover'], { ability: 'technician' })
    const e = make({ rival: withLead(s), ai: 'trivial' })
    e.start()
    const u = e.choose(moveOf(1))
    expect([u.lines.filter((l) => l.startsWith('|switch|p2a:')).length >= 1, u.request!.active !== undefined]).toEqual([true, true])
  })

  it('la IA heurística jugando 100 turnos nunca deja la partida sin petición del jugador', () => {
    const e = make({ player: attackers(), rival: attackers().reverse(), ai: 'heuristic' })
    const g = playOut(e as any, undefined, 100)
    expect(g.updates.filter((u) => !u.ended && !u.request)).toEqual([])
  })
})

describe('fin del combate (INT-09, INT-10, INT-11, UT-50)', () => {
  const stall = (over: Record<string, unknown> = {}) => make({ ...over })

  it('debilitamiento simultáneo (Canto Mortal en ambos): el sim decide y cuenta como derrota', () => {
    const p = mon('gengar', ['perishsong', 'splash', 'tackle', 'recover'], { ability: 'levitate' })
    const r = mon('gengar', ['perishsong', 'splash', 'tackle', 'recover'], { ability: 'levitate' })
    const g = playOut(make({ player: [p], rival: [r] }) as any, undefined, 10)
    expect([g.last.ended?.result, g.last.ended?.playerAlive]).toEqual(['loss', 0])
  })

  it('ganar: quien debilita a los 6 rivales gana', () => {
    const killer = mon('garchomp', ['earthquake', 'outrage', 'stoneedge', 'swordsdance'], { ability: 'roughskin' })
    const weak = (sp: string) => filler(sp, { ivs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 } })
    const e = make({ player: withLead(killer), rival: [weak('magikarp'), weak('caterpie'), weak('weedle'), weak('rattata'), weak('sentret'), weak('ekans')], ai: 'trivial' })
    const g = playOut(e as any)
    expect([g.last.ended?.result, g.last.ended?.reason, g.last.ended?.rivalFainted]).toEqual(['win', 'faint', 6])
  })

  it('perder: si caen los 6 del jugador, derrota con rivalFainted < 6 y playerAlive 0', () => {
    const killer = mon('garchomp', ['earthquake', 'outrage', 'stoneedge', 'swordsdance'], { ability: 'roughskin' })
    const weakTeam = ['magikarp', 'caterpie', 'weedle', 'rattata', 'sentret', 'ekans'].map((s) => filler(s))
    const g = playOut(make({ player: weakTeam, rival: withLead(killer), ai: 'trivial' }) as any)
    expect([g.last.ended?.result, g.last.ended?.playerAlive]).toEqual(['loss', 0])
  })

  it('turnos de clima: Danza Lluvia da 5 y van bajando; el de una habilidad (Llovizna) es permanente (null)', () => {
    const dancer = mon('politoed', ['raindance', 'splash', 'tackle', 'recover'], { ability: 'waterabsorb' })
    const e = make({ player: [dancer, ...harmlessTeam().slice(1)], ai: 'trivial' })
    e.start()
    const afterDance = e.choose(moveOf(1))
    expect([afterDance.view.weather, afterDance.view.weatherTurns]).toEqual(['raindance', 4])
    expect(e.choose(moveOf(2)).view.weatherTurns).toBe(3)
    const drizzle = make({ player: [mon('politoed', ['splash', 'tackle', 'recover', 'rest'], { ability: 'drizzle' }), ...harmlessTeam().slice(1)], ai: 'trivial' }).start()
    expect([drizzle.view.weather, drizzle.view.weatherTurns]).toEqual(['raindance', null])
  })

  it('playerFainted va en el orden del equipo del reto, no en el del simulador (inicial delante)', () => {
    const killer = mon('garchomp', ['earthquake', 'outrage', 'stoneedge', 'swordsdance'], { ability: 'roughskin' })
    const team = ['snorlax', 'blissey', 'chansey', 'magikarp', 'lapras', 'vaporeon'].map((s) => filler(s))
    const e = make({ player: team, playerLead: 3, rival: withLead(killer), ai: 'trivial' })
    e.start()
    const afterHit = e.choose(moveOf(1))
    expect(afterHit.view.player.team[0]).toMatchObject({ species: 'magikarp', fainted: true })
    expect(e.forfeit().ended?.playerFainted).toEqual([false, false, false, true, false, false])
  })

  it('el límite de turnos con maxTurns=3: los turnos 1 a 3 siguen y tras resolver el tercero termina', () => {
    const e = stall({ maxTurns: 3 })
    e.start()
    const flags = [e.choose(moveOf(1)).ended, e.choose(moveOf(1)).ended, e.choose(moveOf(1)).ended]
    expect(flags.map((f) => f?.reason)).toEqual([undefined, undefined, 'turnLimit'])
  })

  it('el límite de turnos cuenta como derrota', () => {
    const g = playOut(stall({ maxTurns: 2 }) as any)
    expect(g.last.ended).toMatchObject({ result: 'loss', reason: 'turnLimit' })
  })

  it('maxTurns=300: sigue en el turno 300 y termina al pasar al 301', () => {
    // Con `move 1` el Salpicadura (64 PP) se agota en el turno 65 y la elección se rechaza: el empate a 300 turnos se
    // mantiene cambiando (no gasta PP) contra un rival con Mago Mágico (Clefable), que no sufre el retroceso de Forcejeo.
    const rival = Array.from({ length: 6 }, () => filler('clefable', { ability: 'magicguard', moves: ['splash', 'splash', 'splash', 'splash'] }))
    const player = Array.from({ length: 6 }, () => filler('shuckle'))
    const e = stall({ player, rival })
    e.start()
    let last!: EngineUpdate
    for (let i = 0; i < 299; i++) last = e.choose(switchTo(2))
    const still = [last.ended, last.view.turn]
    last = e.choose(switchTo(2))
    expect([still, last.ended?.reason, last.view.turn]).toEqual([[undefined, 300], 'turnLimit', 301])
  })

  it('rendirse termina como derrota por rendición', () => {
    const e = make()
    e.start()
    expect(e.forfeit().ended).toMatchObject({ result: 'loss', reason: 'forfeit' })
  })

  it('tras rendirse, un choose se ignora y devuelve el mismo final', () => {
    const e = make()
    e.start()
    const f = e.forfeit()
    const after = e.choose(moveOf(1))
    expect([after.ended, after.lines]).toEqual([f.ended, f.lines])
  })

  it('forfeit repetido es inocuo', () => {
    const e = make()
    e.start()
    e.forfeit()
    expect(() => e.forfeit()).not.toThrow()
  })

  it('tras terminar por límite de turnos, un choose posterior no lanza ni cambia el resultado', () => {
    const e = stall({ maxTurns: 1 })
    e.start()
    const end = e.choose(moveOf(1))
    expect(e.choose(moveOf(1)).ended).toEqual(end.ended)
  })

  it('el update final de la rendición no trae petición para el jugador', () => {
    const e = make()
    e.start()
    expect(e.forfeit().request).toBeNull()
  })
})
