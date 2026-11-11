import { describe, expect, it } from 'vitest'
import { introLines, translateLine, type TranslateContext } from './translate'
import { emeraldLog } from '../i18n/esEmeraldLog'
import { makeGameData } from '../test-utils/fixtures'

// UT-179 · Mensajes del combate de la campaña al estilo de Esmeralda (DEC-97); el diario no cambia.
const data = makeGameData()
const names = { ...data.names, species: { ...data.names.species, geodude: 'GEODUDE', abra: 'ABRA' }, moves: { ...data.names.moves, tackle: 'PLACAJE' }, items: { ...data.names.items, oranberry: 'Baya Aranja' } }
const trainer = { nameEs: 'Petra', category: 'leader' as const, gender: 'F' as const }
const emerald: TranslateContext = { names, trainer, log: emeraldLog }
const daily: TranslateContext = { names, trainer }

describe('frases de Esmeralda', () => {
  it('el rival es «GEODUDE enemigo», en pasado simple', () => {
    expect(translateLine('|move|p2a: Geodude|Tackle|p1a: Abra', emerald)).toBe('¡GEODUDE enemigo usó PLACAJE!')
    expect(translateLine('|faint|p2a: Geodude', emerald)).toBe('¡GEODUDE enemigo se debilitó!')
    expect(translateLine('|faint|p1a: Abra', emerald)).toBe('¡ABRA se debilitó!')
    expect(translateLine('|-resisted|p2a: Geodude', emerald)).toBe('No es muy eficaz…')
    expect(translateLine('|-boost|p2a: Geodude|def|1', emerald)).toBe('¡La DEFENSA de GEODUDE enemigo subió!')
    expect(translateLine('|-unboost|p1a: Abra|spe|2', emerald)).toBe('¡La VELOCIDAD de ABRA bajó mucho!')
    expect(translateLine('|-heal|p2a: Geodude|30/100|[from] item: Oran Berry', emerald)).toBe('¡GEODUDE enemigo recuperó PS con su BAYA ARANJA!')
  })

  it('la intro: quiere luchar, envió a y adelante', () => {
    expect(introLines({ trainer, log: emeraldLog, rivalLead: 'GEODUDE', playerLead: 'ABRA' })).toEqual(['¡La Líder PETRA quiere luchar!', '¡PETRA envió a GEODUDE!', '¡Adelante, ABRA!'])
  })

  it('sin frases propias se usan las del diario, también después de traducir con las de Esmeralda', () => {
    translateLine('|faint|p2a: Geodude', emerald)
    expect(translateLine('|faint|p2a: Geodude', daily)).toBe('¡El GEODUDE de Petra se ha debilitado!')
    expect(introLines({ trainer, rivalLead: 'Geodude', playerLead: 'Abra' })[0]).toBe('¡La Líder Petra te desafía!')
  })
})
