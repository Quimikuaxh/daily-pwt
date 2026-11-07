import { describe, it, expect } from 'vitest'
import { deferHitMessages, deferQuickClaw, orderBattleMessages } from './messageOrder'

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

describe('deferQuickClaw: la Garra Rápida sale cuando actúa quien la lleva (DEC-83)', () => {
  it('con un cambio del rival, primero el cambio y luego la Garra Rápida, justo antes del movimiento (log real del sim)', () => {
    const lines = [
      '|',
      '|t:|1',
      '|-activate|p1a: Snorlax|item: Quick Claw',
      '|',
      '|switch|p2a: Eevee|Eevee, L50, M|130/130',
      '|move|p1a: Snorlax|Body Slam|p2a: Eevee',
      '|-damage|p2a: Eevee|40/130',
      '|',
      '|upkeep',
      '|turn|2',
    ]
    expect(deferQuickClaw(lines)).toEqual([lines[0], lines[1], lines[3], lines[4], lines[2], lines[5], lines[6], lines[7], lines[8], lines[9]])
  })

  it('espera a su propia posición: el movimiento del otro bando no la saca', () => {
    const lines = [
      '|-activate|p2a: Jolteon|item: Quick Claw',
      '|switch|p1a: Pikachu|Pikachu, L50|100/100',
      '|move|p1a: Pikachu|Thunderbolt|p2a: Jolteon',
      '|move|p2a: Jolteon|Tackle|p1a: Pikachu',
    ]
    expect(deferQuickClaw(lines)).toEqual([lines[1], lines[2], lines[0], lines[3]])
  })

  it('si no puede moverse (parálisis, sueño), sale antes del aviso', () => {
    const lines = ['|-activate|p1a: Snorlax|item: Quick Claw', '|switch|p2a: Eevee|Eevee|100/100', '|cant|p1a: Snorlax|par', '|upkeep']
    expect(deferQuickClaw(lines)).toEqual([lines[1], lines[0], lines[2], lines[3]])
  })

  it('si se debilita antes de actuar, no sale', () => {
    const lines = [
      '|-activate|p1a: Snorlax|item: Quick Claw',
      '|move|p2a: Eevee|Quick Attack|p1a: Snorlax',
      '|-damage|p1a: Snorlax|0 fnt',
      '|faint|p1a: Snorlax',
      '|upkeep',
    ]
    expect(deferQuickClaw(lines)).toEqual([lines[1], lines[2], lines[3], lines[4]])
  })

  it('si no llega a actuar por otra causa, sale antes del final del turno; el update cortado la deja al final', () => {
    const lines = ['|-activate|p1a: Snorlax|item: Quick Claw', '|switch|p2a: Eevee|Eevee|100/100', '|upkeep', '|turn|2']
    expect(deferQuickClaw(lines)).toEqual([lines[1], lines[0], lines[2], lines[3]])
    expect(deferQuickClaw([lines[0], lines[1]])).toEqual([lines[1], lines[0]])
  })

  it('orderBattleMessages aplica las dos reglas: Garra Rápida y textos del golpe', () => {
    const lines = [
      '|-activate|p1a: Snorlax|item: Quick Claw',
      '|switch|p2a: Eevee|Eevee|100/100',
      '|move|p1a: Snorlax|Body Slam|p2a: Eevee',
      '|-crit|p2a: Eevee',
      '|-damage|p2a: Eevee|40/100',
    ]
    expect(orderBattleMessages(lines)).toEqual([lines[1], lines[0], lines[2], lines[4], lines[3]])
  })
})
