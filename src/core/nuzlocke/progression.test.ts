import { describe, expect, it } from 'vitest'
import { readJson } from '../../test-utils/paths'
import { advanceLevel, availableMoves, validateMoveSelection, type CampaignMember, type ProgressionDex } from './progression'

const dex: ProgressionDex = {
  seed: {
    levelUp: [{ level: 1, move: 'tackle' }, { level: 7, move: 'absorb' }, { level: 8, move: 'growth' }],
    machines: ['cut'],
    evolutions: [{ method: 'LEVEL', parameter: 7, target: 'bud' }],
  },
  bud: {
    levelUp: [{ level: 5, move: 'tackle' }, { level: 10, move: 'vinewhip' }],
    machines: ['cut', 'protect'],
    evolutions: [{ method: 'LEVEL', parameter: 10, target: 'flower' }],
  },
  flower: {
    levelUp: [{ level: 6, move: 'tackle' }, { level: 12, move: 'megadrain' }, { level: 20, move: 'solarbeam' }],
    machines: ['protect', 'flash'],
    evolutions: [{ method: 'ITEM', parameter: 'sunstone', target: 'sunflower' }],
  },
}
const seed: CampaignMember = { species: 'seed', level: 6, history: [] }

describe('progresión de nivel de la campaña', () => {
  it('encadena evoluciones y registra los niveles en que se producen', () => {
    expect(advanceLevel(dex, seed, 12)).toEqual({
      species: 'flower',
      level: 12,
      history: [{ species: 'seed', evolvedAt: 7 }, { species: 'bud', evolvedAt: 10 }],
    })
    expect(seed.history).toEqual([])
  })

  it('mantiene las evoluciones especiales pendientes y no permite retroceder de nivel', () => {
    const flower = advanceLevel(dex, seed, 12)
    expect(advanceLevel(dex, flower, 30)).toMatchObject({ species: 'flower', level: 30 })
    expect(() => advanceLevel(dex, flower, 11)).toThrow(/nivel/i)
  })

  it('rechaza una cadena cíclica', () => {
    const cyclic = { ...dex, bud: { ...dex.bud, evolutions: [{ method: 'LEVEL', parameter: 7, target: 'seed' }] } }
    expect(() => advanceLevel(cyclic, seed, 12)).toThrow(/evoluci/i)
  })
})

describe('movimientos disponibles en la campaña', () => {
  it('reúne los movimientos aprendidos hasta cada evolución y elimina duplicados', () => {
    const flower = advanceLevel(dex, seed, 12)
    expect(availableMoves(dex, flower, new Set())).toEqual(['tackle', 'absorb', 'vinewhip', 'megadrain'])
  })

  it('incluye solo MT y MO desbloqueadas y compatibles con la forma actual', () => {
    const flower = advanceLevel(dex, seed, 12)
    expect(availableMoves(dex, flower, new Set(['cut', 'protect', 'surf']))).toEqual([
      'tackle', 'absorb', 'vinewhip', 'megadrain', 'protect',
    ])
  })
  it('acepta de uno a cuatro movimientos legales en el orden elegido', () => {
    const flower = advanceLevel(dex, seed, 12)
    expect(validateMoveSelection(dex, flower, new Set(['protect']), ['protect', 'tackle'])).toEqual(['protect', 'tackle'])
  })

  it.each([[[]], [['tackle', 'tackle']], [['solarbeam']], [['protect']], [['tackle', 'absorb', 'vinewhip', 'megadrain', 'flash']]])(
    'rechaza una selección inválida: %j', (selected) => {
      const flower = advanceLevel(dex, seed, 12)
      expect(() => validateMoveSelection(dex, flower, new Set(), selected)).toThrow(/movimiento/i)
    },
  )

})


it('aplica a Treecko el aprendizaje y la evolución del catálogo de Esmeralda', () => {
  const { species, machines } = readJson<{ species: ProgressionDex; machines: Record<string, string> }>(
    'data', 'nuzlocke', 'hoenn-emerald-progression.json',
  )
  const grovyle = advanceLevel(species, { species: 'treecko', level: 15, history: [] }, 16)
  expect(grovyle).toEqual({ species: 'grovyle', level: 16, history: [{ species: 'treecko', evolvedAt: 16 }] })
  const moves = availableMoves(species, grovyle, new Set([machines.hm01, machines.hm08]))
  expect(moves).toEqual(expect.arrayContaining(['pursuit', 'furycutter', 'cut']))
  expect(moves).not.toContain('dive')
  expect(moves).not.toContain('leafblade')
})
