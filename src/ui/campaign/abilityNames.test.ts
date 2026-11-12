import { Dex } from '@pkmn/sim'
import { describe, expect, it } from 'vitest'
import names from '../../../data/nuzlocke/emerald-ability-names-es.json'
import descriptions from '../../../data/nuzlocke/emerald-ability-descriptions-es.json'
import { textWidth } from '../console/glyphs'
import { emeraldTheme } from '../console/themes/emerald'
import type { BitmapFont } from '../console/theme'
import { emeraldAbilityName, emeraldBattleNames } from './emeraldNames'
import type { NamesEs } from '../../core/types'

// UT-188 · Habilidades con el nombre de la época (D6): las 76 de Gen 3, en el draft y en los mensajes del combate.
const gen3 = Dex.forGen(3).abilities.all().filter((ability) => ability.gen <= 3 && ability.num > 0 && !ability.isNonstandard).map((ability) => ability.id).sort()
const current = { abilities: { trace: 'Calco', innerfocus: 'Fuerza Mental', intimidate: 'Intimidación', pickpocket: 'Hurto' }, items: { leftovers: 'Restos' } } as unknown as NamesEs

describe('nombres de las habilidades de Esmeralda', () => {
  it('hay uno para cada habilidad de Gen 3, y ninguno de más', () => {
    expect(Object.keys(names.abilities).sort()).toEqual(gen3)
  })

  it.each(Object.entries(names.abilities))('%s: en mayúsculas y de 12 letras como mucho (Gen 3)', (_, name) => {
    expect(name).toBe(name.toUpperCase())
    expect(name.length).toBeLessThanOrEqual(12)
  })

  it('usa el nombre de la época y, fuera de Gen 3, el actual en mayúsculas', () => {
    expect(emeraldAbilityName('trace', current)).toBe('RASTRO')
    expect(emeraldAbilityName('innerfocus', current)).toBe('FOCO INTERNO')
    expect(emeraldAbilityName('intimidate', current)).toBe('INTIMIDACIÓN')
    expect(emeraldAbilityName('pickpocket', current)).toBe('HURTO')
  })

  it('el combate traduce habilidades y objetos con los nombres de la época', () => {
    const battle = emeraldBattleNames({ ...current, moves: {}, species: {}, types: {} })
    expect(battle.abilities.trace).toBe('RASTRO')
    expect(battle.items.leftovers).toBe('RESTOS')
  })
})

// Jose, 12/11/2026: las habilidades del draft llevan descripción.
describe('descripciones de las habilidades de Esmeralda', () => {
  it('hay una para cada habilidad de Gen 3, y ninguna de más', () => {
    expect(Object.keys(descriptions.abilities).sort()).toEqual(gen3)
  })

  it.each(Object.entries(descriptions.abilities))('%s: cabe en una línea de 144 px de la ventana HABILIDAD', (_, text) => {
    expect(textWidth(emeraldTheme.font as BitmapFont, text)).toBeLessThanOrEqual(144)
  })
})
