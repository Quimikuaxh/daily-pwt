import { describe, expect, it } from 'vitest'
import { battleMusicFor } from './audio'

// UT-110 · Tema de cada rival (DEC-57): el de su categoría y región, salvo los temas propios (Mirto y Cheren, Jose, 28/10/2026).
describe('battleMusicFor (UT-110)', () => {
  it('líder y campeón: el de su región; sin región, el de Teselia', () => {
    expect(battleMusicFor({ id: 'misty', category: 'leader', region: 'kanto' })).toBe('gym-kanto')
    expect(battleMusicFor({ id: 'lance', category: 'champion', region: 'johto' })).toBe('champion-johto')
    expect(battleMusicFor({ category: 'leader', region: null })).toBe('gym-unova')
  })

  it('Mirto y Cheren, con los suyos de Negro y Blanco', () => {
    expect(battleMusicFor({ id: 'mirto', category: 'champion', region: 'unova' })).toBe('champion-alder')
    expect(battleMusicFor({ id: 'cheren', category: 'leader', region: 'unova' })).toBe('rival-cheren')
  })
})
