import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { importScript } from '../src/test-utils/paths'

const { N2B2_ITEMS, kindOf, parseItemSources, parseSubwayShop, validateN2b2Items } = await importScript('scripts/build-n2b2-items.mjs')

// Objetos de la locke de N2/B2 (PRD §0, 13/11/2026): zonas de Serebii por tramo, las mismas reglas que Hoenn y el canje del Metro Batalla.
describe('objetos de N2/B2', () => {
  it('clasifica equipables (también los que tienen el efecto en el ataque), bayas y objetos de evolución; el resto no cuenta', () => {
    expect(kindOf('leftovers')).toBe('held')
    expect(kindOf('bindingband')).toBe('held')
    expect(kindOf('sitrusberry')).toBe('berry')
    expect(kindOf('firestone')).toBe('evolution')
    expect(kindOf('ultraball')).toBeNull()
    expect(kindOf('helixfossil')).toBeNull()
  })

  it('lee cada zona con si es tienda y la condición que la sigue', () => {
    const cell = '<a href="/pokearth/unova/desertresort.shtml">x</a> (With Dowsing Machine) <a href="/pokearth/unova/lentimastown.shtml">y</a><br /><b>Shop</b><br /><a href="/pokearth/unova/gearstation.shtml">z</a>'
    expect(parseItemSources(cell)).toEqual([
      { zone: 'desertresort', shop: false, condition: 'With Dowsing Machine' },
      { zone: 'lentimastown', shop: false, condition: null },
      { zone: 'gearstation', shop: true, condition: null },
    ])
  })

  it('el canje toma los equipables de la tienda del Metro con su precio y deja fuera vitaminas, piedras y objetos recios', () => {
    const recios = ['Power Bracer', 'Power Belt', 'Power Lens', 'Power Band', 'Power Anklet', 'Power Weight']
      .map((name) => `<td>${name}</td><td>16BP</td>`).join('')
    const html = `<td>Right Counter</td><td>Item</td><td>Price</td><td>Protein</td><td>1BP</td><td>Fire Stone</td><td>3BP</td><td>Razor Claw</td><td>8BP</td><td>Choice Band</td><td>24BP</td>${recios}<td>Game Names</td>`
    expect(parseSubwayShop(html)).toEqual([{ item: 'razorclaw', price: 8 }, { item: 'choiceband', price: 24 }])
  })

  it('el fichero versionado es válido: Restos antes de Camus (Cloacas), bayas sin límite y fuera lo aleatorio', () => {
    const items = JSON.parse(readFileSync(N2B2_ITEMS, 'utf8'))
    expect(() => validateN2b2Items(items)).not.toThrow()
    expect(items.held.leftovers).toMatchObject({ kind: 'held', before: 'camus' })
    expect(items.held.sitrusberry.infinite).toBe(true)
    expect(items.exchange.find((entry: { item: string }) => entry.item === 'choiceband').price).toBe(24)
  })
})
