import { describe, expect, it } from 'vitest'
import { campaignEncounters as encounters, campaignPlaces as places } from '../../test-utils/campaignUi'
import { badgeCount, keyPage, pageArrows, placeState, playerSpot, routePlaces } from './hoennRoute'


describe('modelo de Ruta', () => {
  it('ordena las ocho ciudades y la Liga con Plubio, aunque se desordene el catálogo', () => {
    expect(routePlaces([...encounters].reverse())).toEqual(places)
    expect(places.map(p => [p.id, p.gym])).toEqual([
      ['petra', 1], ['marcial', 2], ['erico', 3], ['candela', 4], ['norman', 5],
      ['alana', 6], ['vito-y-leti', 7], ['galano', 8], ['plubio', null],
    ])
    expect(places.at(-1)?.rival).toMatchObject({ id: 'plubio', kind: 'champion' })
    expect(places.every(p => p.x >= 0 && p.x < 30 && p.y >= 0 && p.y < 20)).toBe(true)
  })

  it('rechaza un catálogo al que falta un rival', () => {
    expect(() => routePlaces(encounters.filter(e => e.id !== 'petra'))).toThrow(/petra/)
  })

  it.each([
    [0, 'draft', 0], [1, 'draft', 1], [7, 'prepare', 7], [8, 'draft', 8],
    [11, 'battle', 8], [12, 'won', 8], [3, 'lost', 3],
  ] as const)('medallas en encuentro %i y fase %s: %i', (encounterIndex, phase, count) => {
    expect(badgeCount({ encounterIndex, phase }, encounters)).toBe(count)
  })

  it('distingue ganado, próximo y pendiente; la Liga llega tras ocho medallas', () => {
    expect(places.map(p => placeState(p, 1))).toEqual(['won', 'next', ...Array(7).fill('pending')])
    expect(placeState(places[8], 7)).toBe('pending')
    expect(placeState(places[8], 8)).toBe('next')
  })

  it('sitúa al protagonista en Villa Raíz o en el último gimnasio ganado', () => {
    expect(playerSpot(places, 0)).toEqual({ x: 5, y: 13 })
    for (let badges = 1; badges <= 8; badges++) {
      expect(playerSpot(places, badges)).toMatchObject({ x: places[badges - 1].x, y: places[badges - 1].y })
    }
  })

  it('solo ofrece flechas a páginas existentes', () => {
    expect(pageArrows(0, 1)).toEqual([])
    expect(pageArrows(0, 3)).toEqual([{ side: 'dcha', target: 1, x: 230 }])
    expect(pageArrows(1, 3)).toEqual([{ side: 'izda', target: 0, x: 2 }, { side: 'dcha', target: 2, x: 230 }])
    expect(pageArrows(2, 3)).toEqual([{ side: 'izda', target: 1, x: 2 }])
  })

  it.each([
    ['ArrowRight', 0, 2, 1], ['ArrowLeft', 1, 2, 0], ['ArrowLeft', 0, 2, null],
    ['ArrowRight', 1, 2, null], ['Enter', 0, 2, null], ['ArrowRight', 0, 1, null],
  ])('tecla %s en página %i de %i → %s', (key, page, pages, target) => {
    expect(keyPage(String(key), Number(page), Number(pages))).toBe(target)
  })
})
