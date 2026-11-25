import { describe, expect, it } from 'vitest'
import { battleMusicFor } from './audio'

// UT-110 · Tema de cada rival (DEC-57): el de su categoría y región, salvo los temas propios (Cheren, Jose, 28/10/2026). Cambio de
// requisito (Jose, 25/11/2026): Mirto vuelve al de campeón de Teselia (el de Iris), que tenía antes del 28/10/2026.
describe('battleMusicFor (UT-110)', () => {
  it('líder y campeón: el de su región; sin región, el de Teselia', () => {
    expect(battleMusicFor({ id: 'misty', category: 'leader', region: 'kanto' })).toBe('gym-kanto')
    expect(battleMusicFor({ id: 'lance', category: 'champion', region: 'johto' })).toBe('champion-johto')
    expect(battleMusicFor({ category: 'leader', region: null })).toBe('gym-unova')
  })

  it('Cheren, con el suyo de Negro y Blanco; Mirto, con el de campeón de Teselia (Iris)', () => {
    expect(battleMusicFor({ id: 'mirto', category: 'champion', region: 'unova' })).toBe('champion-unova')
    expect(battleMusicFor({ id: 'cheren', category: 'leader', region: 'unova' })).toBe('rival-cheren')
  })
})
