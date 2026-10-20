import { describe, it, expect } from 'vitest'
import { viewReducer } from './viewReducer'
import { mkView, pMon, rMon } from '../test-utils/view'

// UT-49 · DEC-10 · RF-44/45. TODO-CONTRATO: viewReducer(view: BattleView, action) -> BattleView (puro)
//   action = { type: 'lines'; lines: string[] } | { type: 'snapshot'; view: BattleView }
//   Las especies de las líneas están en inglés ("Garchomp"); se casan con view.*.team[].species por toID.
//   El rival solo guarda hpPercent (sin hp/maxHp). Clima en id minúsculas ('raindance') o null.
const lines = (...l: string[]) => ({ type: 'lines' as const, lines: l })

describe('viewReducer: líneas', () => {
  it('daño al rival: actualiza su porcentaje', () => {
    const v = viewReducer(mkView(), lines('|-damage|p2a: Snorlax|40/100'))
    expect(v.rival.team[0].hpPercent).toBe(40)
  })

  it('daño al rival: no le añade PS absolutos', () => {
    const v = viewReducer(mkView(), lines('|-damage|p2a: Snorlax|40/100'))
    expect('maxHp' in v.rival.team[0]).toBe(false)
  })

  it('daño al jugador: actualiza hp y maxHp reales', () => {
    const v = viewReducer(mkView(), lines('|-damage|p1a: Garchomp|100/183'))
    expect([v.player.team[0].hp, v.player.team[0].maxHp]).toEqual([100, 183])
  })

  it('curación al jugador sube su hp', () => {
    const start = mkView({ player: [pMon('garchomp', 50, 183), pMon('starmie')] })
    expect(viewReducer(start, lines('|-heal|p1a: Garchomp|80/183')).player.team[0].hp).toBe(80)
  })

  it('curación al rival sube su porcentaje', () => {
    const start = mkView({ rival: [rMon('snorlax', 30), rMon('tyranitar')] })
    expect(viewReducer(start, lines('|-heal|p2a: Snorlax|55/100')).rival.team[0].hpPercent).toBe(55)
  })

  it('"0 fnt" deja 0 de PS y lo marca debilitado', () => {
    const v = viewReducer(mkView(), lines('|-damage|p2a: Snorlax|0 fnt'))
    expect([v.rival.team[0].hpPercent, v.rival.team[0].fainted]).toEqual([0, true])
  })

  it('faint del rival: queda debilitado y baja sus restantes', () => {
    const v = viewReducer(mkView(), lines('|faint|p2a: Snorlax'))
    expect([v.rival.team[0].fainted, v.rival.remaining]).toEqual([true, 2])
  })

  it('faint del jugador: queda debilitado y baja sus restantes', () => {
    const v = viewReducer(mkView(), lines('|faint|p1a: Garchomp'))
    expect([v.player.team[0].fainted, v.player.remaining]).toEqual([true, 2])
  })

  it('faint no cuenta dos veces si se repite', () => {
    const v = viewReducer(mkView(), lines('|faint|p1a: Garchomp', '|faint|p1a: Garchomp'))
    expect(v.player.remaining).toBe(2)
  })

  it('switch del jugador: cambia el activo y toma los PS de la línea', () => {
    const v = viewReducer(mkView(), lines('|switch|p1a: Starmie|Starmie, L50|120/150'))
    expect([v.player.active, v.player.team[1].hp]).toEqual([1, 120])
  })

  it('switch del rival: cambia el activo y su porcentaje', () => {
    const v = viewReducer(mkView(), lines('|switch|p2a: Heatran|Heatran, L50, M|75/100'))
    expect([v.rival.active, v.rival.team[2].hpPercent]).toEqual([2, 75])
  })

  it('drag cambia el activo igual que switch', () => {
    const v = viewReducer(mkView(), lines('|drag|p1a: Gengar|Gengar, L50, M|140/140'))
    expect(v.player.active).toBe(2)
  })

  it('estado: -status lo pone y -curestatus lo quita', () => {
    const a = viewReducer(mkView(), lines('|-status|p2a: Snorlax|brn'))
    const b = viewReducer(a, lines('|-curestatus|p2a: Snorlax|brn'))
    expect([a.rival.team[0].status, b.rival.team[0].status]).toEqual(['brn', null])
  })

  it('clima: -weather lo pone en minúsculas', () => {
    expect(viewReducer(mkView(), lines('|-weather|RainDance')).weather).toBe('raindance')
  })

  it('clima: -weather none lo quita', () => {
    expect(viewReducer(mkView({ weather: 'raindance' }), lines('|-weather|none')).weather).toBeNull()
  })

  it('clima: la línea [upkeep] mantiene el clima', () => {
    expect(viewReducer(mkView(), lines('|-weather|Sandstorm|[upkeep]')).weather).toBe('sandstorm')
  })

  it('turn actualiza el número de turno', () => {
    expect(viewReducer(mkView(), lines('|turn|7')).turn).toBe(7)
  })

  it('aplica varias líneas en orden', () => {
    const v = viewReducer(mkView(), lines('|-damage|p2a: Snorlax|60/100', '|-damage|p2a: Snorlax|10/100', '|turn|2'))
    expect([v.rival.team[0].hpPercent, v.turn]).toEqual([10, 2])
  })

  it('las líneas desconocidas o sin efecto en la vista la dejan igual', () => {
    const start = mkView()
    expect(viewReducer(start, lines('|-supereffective|p2a: Snorlax', '|', '|upkeep', '|-foobar|x'))).toEqual(start)
  })

  it('no muta la vista de entrada', () => {
    const start = mkView()
    const before = JSON.stringify(start)
    viewReducer(start, lines('|-damage|p2a: Snorlax|1/100', '|faint|p1a: Garchomp'))
    expect(JSON.stringify(start)).toBe(before)
  })

  it('una especie desconocida en una línea no lanza ni altera la vista', () => {
    const start = mkView()
    expect(viewReducer(start, lines('|-damage|p2a: Missingno|10/100'))).toEqual(start)
  })
})

describe('viewReducer: reconciliación con el snapshot', () => {
  it('un snapshot sustituye a la vista animada', () => {
    const drifted = viewReducer(mkView(), lines('|-damage|p2a: Snorlax|10/100'))
    const truth = mkView({ rival: [rMon('snorlax', 35), rMon('tyranitar'), rMon('heatran')], turn: 3 })
    expect(viewReducer(drifted, { type: 'snapshot', view: truth })).toEqual(truth)
  })

  it('tras reconciliar, nuevas líneas se aplican sobre el snapshot', () => {
    const truth = mkView({ turn: 3 })
    const v = viewReducer(viewReducer(mkView(), { type: 'snapshot', view: truth }), lines('|turn|4'))
    expect(v.turn).toBe(4)
  })

  it('el snapshot no queda enlazado por referencia (editar la salida no cambia el snapshot)', () => {
    const truth = mkView()
    const out = viewReducer(mkView(), { type: 'snapshot', view: truth })
    out.rival.team[0].hpPercent = 1
    expect(truth.rival.team[0].hpPercent).toBe(100)
  })

  it('los restantes del snapshot mandan sobre los calculados por líneas', () => {
    const drifted = viewReducer(mkView(), lines('|faint|p1a: Garchomp'))
    const truth = mkView()
    expect(viewReducer(drifted, { type: 'snapshot', view: truth }).player.remaining).toBe(3)
  })

  it('restantes: 6/6 con equipo completo', () => {
    const six = ['garchomp', 'starmie', 'gengar', 'snorlax', 'heatran', 'milotic'].map((s) => pMon(s))
    expect(mkView({ player: six }).player.remaining).toBe(6)
  })
})
