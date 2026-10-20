import { describe, it, expect } from 'vitest'
import { buildAiState } from './state'
import { newBattle } from '../../test-utils/sim'
import { mkResolved } from '../../test-utils/fixtures'

// DEC-12 · UT-41 (índices de switch). TODO-CONTRATO: buildAiState(battle: Battle): AiState -- traduce el Battle a AiState DESDE EL PUNTO DE VISTA DE p2 (el rival).
//   Orden de self.pokemon = orden de battle.sides[1].pokemon (el que el sim reordena tras cada cambio); foe.pokemon, ídem para p1.
const mon = (sp: string, moves: [string, string, string, string], over = {}) => mkResolved(sp, 'leftovers', 'pressure', moves, over)
const player = () => [mon('garchomp', ['earthquake', 'outrage', 'raindance', 'meanlook']), mon('starmie', ['surf', 'icebeam', 'thunderbolt', 'recover'])]
const rival = () => [mon('gengar', ['shadowball', 'sludgebomb', 'thunderbolt', 'focusblast']), mon('tyranitar', ['crunch', 'stoneedge', 'earthquake', 'pursuit']), mon('snorlax', ['bodyslam', 'earthquake', 'crunch', 'rest'])]

describe('buildAiState', () => {
  it('el activo propio es self.pokemon[0] y el del jugador foe.pokemon[0] al empezar', () => {
    const s = buildAiState(newBattle(player(), rival()))
    expect([s.self.pokemon[0].set.species, s.foe.pokemon[0].set.species]).toEqual(['gengar', 'garchomp'])
  })

  it('incluye a todo el equipo de cada bando', () => {
    const s = buildAiState(newBattle(player(), rival()))
    expect([s.self.pokemon.length, s.foe.pokemon.length]).toEqual([3, 2])
  })

  it('los PS son absolutos y completos al inicio', () => {
    const s = buildAiState(newBattle(player(), rival()))
    const m = s.foe.pokemon[0]
    expect([m.hp, m.maxHp > 100]).toEqual([m.maxHp, true])
  })

  it('el estado inicial no tiene clima, ni atrapado, ni cambio forzado', () => {
    const s = buildAiState(newBattle(player(), rival()))
    expect([s.weather, s.self.trapped, s.self.mustSwitch]).toEqual([null, false, false])
  })

  it('los movimientos del activo conservan id, PP y no están deshabilitados', () => {
    const s = buildAiState(newBattle(player(), rival()))
    expect(s.self.pokemon[0].moves.map((m) => m.id)).toEqual(['shadowball', 'sludgebomb', 'thunderbolt', 'focusblast'])
    expect(s.self.pokemon[0].moves.every((m) => m.pp > 0 && !m.disabled)).toBe(true)
  })

  it('tras un cambio, self.pokemon sigue el orden reordenado del sim (índice de switch N)', () => {
    const b = newBattle(player(), rival())
    b.makeChoices('move 1', 'switch 3') // p2 saca a Snorlax
    const s = buildAiState(b)
    expect(s.self.pokemon.map((m) => m.set.species)).toEqual(b.sides[1].pokemon.map((p) => p.species.id))
    expect(s.self.pokemon[0].set.species).toBe('snorlax')
  })

  it('refleja el clima activo', () => {
    const b = newBattle(player(), rival())
    b.makeChoices('move 3', 'move 1') // Danza Lluvia
    expect(buildAiState(b).weather).toBe('raindance')
  })

  it('refleja el daño recibido por el rival activo', () => {
    const b = newBattle(player(), rival())
    b.makeChoices('move 1', 'move 1') // Terremoto de Garchomp sobre Gengar (aquí con habilidad Presión, así que le daña)
    const s = buildAiState(b)
    expect(s.foe.pokemon[0].hp).toBeLessThan(s.foe.pokemon[0].maxHp)
  })

  it('marca trapped cuando el sim lo declara (Mal de Ojo)', () => {
    const b = newBattle(player(), rival())
    b.makeChoices('move 4', 'move 1') // p1 usa Mal de Ojo
    expect(buildAiState(b).self.trapped).toBe(true)
  })

  it('marca mustSwitch y activo debilitado tras un KO', () => {
    const b = newBattle([mon('garchomp', ['earthquake', 'outrage', 'raindance', 'meanlook'])], [mon('magikarp', ['splash', 'splash', 'splash', 'splash']), mon('snorlax', ['bodyslam', 'earthquake', 'crunch', 'rest'])])
    b.makeChoices('move 1', 'move 1')
    const s = buildAiState(b)
    expect([s.self.mustSwitch, s.self.pokemon[0].fainted]).toEqual([true, true])
  })
})
