import { describe, it, expect } from 'vitest'
import { deferHitMessages } from './messageOrder'

describe('deferHitMessages: los textos del golpe salen tras bajar la vida', () => {
  it('supereficaz y Banda Focus van detrás del -damage, en su orden', () => {
    const lines = [
      '|move|p1a: Charizard|Fire Blast|p2a: Venusaur',
      '|-crit|p2a: Venusaur',
      '|-supereffective|p2a: Venusaur',
      '|-enditem|p2a: Venusaur|Focus Sash',
      '|-damage|p2a: Venusaur|1/100',
      '|move|p2a: Venusaur|Splash|p2a: Venusaur',
    ]
    expect(deferHitMessages(lines)).toEqual([lines[0], lines[4], lines[1], lines[2], lines[3], lines[5]])
  })

  it('poco eficaz, Robustez, Cinta Focus y Aguante también', () => {
    const lines = [
      '|move|p1a: Charizard|Fire Blast|p2a: Golem',
      '|-resisted|p2a: Golem',
      '|-ability|p2a: Golem|Sturdy',
      '|-activate|p2a: Golem|item: Focus Band',
      '|-activate|p2a: Golem|move: Endure',
      '|-damage|p2a: Golem|1/100',
    ]
    expect(deferHitMessages(lines)).toEqual([lines[0], lines[5], lines[1], lines[2], lines[3], lines[4]])
  })

  it('solo se espera al -damage del mismo Pokémon (el retroceso del atacante no cuenta)', () => {
    const lines = [
      '|move|p1a: Staraptor|Brave Bird|p2a: Venusaur',
      '|-supereffective|p2a: Venusaur',
      '|-damage|p1a: Staraptor|90/100|[from] Recoil',
      '|-damage|p2a: Venusaur|10/100',
    ]
    expect(deferHitMessages(lines)).toEqual([lines[0], lines[2], lines[3], lines[1]])
  })

  it('sin -damage en la acción (golpe al sustituto) el texto no cruza a la acción siguiente', () => {
    const lines = [
      '|move|p1a: Charizard|Fire Blast|p2a: Venusaur',
      '|-supereffective|p2a: Venusaur',
      '|-activate|p2a: Venusaur|Substitute|[damage]',
      '|',
      '|upkeep',
    ]
    expect(deferHitMessages(lines)).toEqual([lines[0], lines[2], lines[1], lines[3], lines[4]])
  })

  it('el resto de líneas no se mueve', () => {
    const lines = ['|move|p1a: A|Tackle|p2a: B', '|-damage|p2a: B|50/100', '|-enditem|p2a: B|Sitrus Berry|[eat]', '|-heal|p2a: B|75/100|[from] item: Sitrus Berry']
    expect(deferHitMessages(lines)).toEqual(lines)
  })
})
