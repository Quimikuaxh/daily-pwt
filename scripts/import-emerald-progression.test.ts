import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { importScript } from '../src/test-utils/paths'

const { EMERALD_PROGRESSION, validateEmeraldProgression } = await importScript('scripts/import-emerald-progression.mjs')
const catalog = JSON.parse(readFileSync(EMERALD_PROGRESSION, 'utf8'))

describe('catálogo de progresión de Esmeralda', () => {
  it('cubre las 386 especies sin duplicar formas ni reservar huecos de la ROM', () => {
    expect(Object.keys(catalog.species)).toHaveLength(386)
    expect(catalog.species.deoxys.simulatorSpecies).toBe('deoxysspeed')
    expect(catalog.species.deoxysspeed).toBeUndefined()
    expect(catalog.species.unown.levelUp).toEqual([{ level: 1, move: 'hiddenpower' }])
    expect(catalog.species.unown.machines).toEqual([])
    expect(() => validateEmeraldProgression(catalog)).not.toThrow()
  })

  it('distingue los niveles de la familia de Treecko', () => {
    expect(catalog.species.treecko.levelUp).toContainEqual({ level: 16, move: 'pursuit' })
    expect(catalog.species.grovyle.levelUp).toContainEqual({ level: 17, move: 'pursuit' })
    expect(catalog.species.treecko.evolutions).toEqual([{ method: 'LEVEL', parameter: 16, target: 'grovyle' }])
  })

  it('conserva los tipos de Gen 3, incluidos los que cambiaron después', () => {
    expect(catalog.species.clefairy.types).toEqual(['Normal'])
    expect(catalog.species.magnemite.types).toEqual(['Electric', 'Steel'])
    const broken = structuredClone(catalog)
    broken.species.clefairy.types = ['Fairy']
    expect(() => validateEmeraldProgression(broken)).toThrow(/tipos/)
  })

  it('conserva ramas, condiciones y objetos especiales', () => {
    expect(catalog.species.gloom.evolutions).toEqual([
      { method: 'ITEM', parameter: 'leafstone', target: 'vileplume' },
      { method: 'ITEM', parameter: 'sunstone', target: 'bellossom' },
    ])
    expect(catalog.species.nincada.evolutions).toEqual([
      { method: 'LEVEL_NINJASK', parameter: 20, target: 'ninjask' },
      { method: 'LEVEL_SHEDINJA', parameter: 20, target: 'shedinja' },
    ])
    expect(catalog.species.clamperl.evolutions).toContainEqual({
      method: 'TRADE_ITEM', parameter: 'deepseatooth', target: 'huntail',
    })
    expect(catalog.species.feebas.evolutions).toEqual([{ method: 'BEAUTY', parameter: 170, target: 'milotic' }])
  })

  it('valida las 50 MT y 8 MO y su compatibilidad por especie', () => {
    expect(Object.keys(catalog.machines)).toHaveLength(58)
    expect(catalog.machines).toMatchObject({ tm01: 'focuspunch', tm39: 'rocktomb', hm01: 'cut', hm08: 'dive' })
    expect(catalog.species.treecko.machines).toContain('cut')
    expect(catalog.species.treecko.machines).not.toContain('dive')
    expect(catalog.species.mew.machines).toHaveLength(58)
  })

  it.each([
    ['especie ausente', (broken: typeof catalog) => { delete broken.species.treecko }],
    ['movimiento ajeno a MT/MO', (broken: typeof catalog) => { broken.species.treecko.machines.push('scratch') }],
    ['parámetro de evolución de tipo incorrecto', (broken: typeof catalog) => { broken.species.treecko.evolutions[0].parameter = 'leafstone' }],
  ])('rechaza %s', (_, corrupt) => {
    const broken = structuredClone(catalog)
    corrupt(broken)
    expect(() => validateEmeraldProgression(broken)).toThrow()
  })
})
