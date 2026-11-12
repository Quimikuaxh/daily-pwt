import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { fromRoot, ROOT } from '../src/test-utils/paths'
import { availableDraftForms, draftEvolutionFamilies, draftMetricSummary, loadSimulationInputs, simulateDraft } from './simulate-nuzlocke-draft.ts'

const runNode = promisify(execFile)
const { definition, calendar } = loadSimulationInputs(ROOT)
const ids = (index: number, scenario: 'A' | 'B' | 'C') => availableDraftForms(definition, calendar, index, scenario).map(form => form.species)

describe('simulación analítica del draft', () => {
  it('UT-165: la CLI --relative 6,8 selecciona la ventana proporcional', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'draft-simulation-'))
    const output = join(dir, 'result.json')
    try {
      await runNode(process.execPath, [fromRoot('scripts/simulate-nuzlocke-draft.mjs'),
        '--seeds', '1', '--margins', '', '--relative', '6,8', '--scenarios', 'A', '--out', output])
      const result = JSON.parse(readFileSync(output, 'utf8'))
      expect(result.options.relativeWindows).toEqual([{ below: 6, above: 8 }])
      expect(result.options.margins).toEqual([])
      expect(result.rows).toHaveLength(18)
      for (const row of result.rows.filter((row: { encounterId: string }) => row.encounterId === 'sixto')) {
        expect(row.attemptedOffers).toBe(3)
        expect(row.validFourDistinctOffers).toBe(3)
      }
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('UT-165: reproduce ventanas relativas sin margen simétrico y recorre tres ofertas de Liga', () => {
    const options = { seeds: 3, margins: [], relativeWindows: [{ below: 6, above: 8 }], scenarios: ['A'] as const }
    const run = () => simulateDraft(definition, calendar, { ...options, scenarios: [...options.scenarios] })
    const result = run()
    expect(result).toEqual(run())
    expect(result.rows).toHaveLength(18)
    for (const row of result.rows) {
      expect(row.relativeWindow).toEqual({ below: 6, above: 8 })
      expect(row.marginPercent).toBeNull()
      expect(row).not.toHaveProperty('absoluteWindow')
      expect(row.failedOffers).toBe(0)
      expect(row.reachedSeeds).toBe(3)
      expect(row.completedSegments).toBe(3)
      const picks = row.encounterId === 'petra' ? 4 : row.encounterId === 'sixto' ? 3 : 2
      expect(row.attemptedOffers).toBe(3 * picks)
      expect(row.validFourDistinctOffers).toBe(3 * picks)
      expect(row.offeredSlots).toBe(3 * picks * 4)
      expect(row.repeatedSlotsInPreviousOffer).toBe(0)
      for (const species of Object.keys(row.speciesCounts)) {
        expect(definition.species[species].baseStatTotal).toBeGreaterThanOrEqual(row.rivalAverage * 0.94)
        expect(definition.species[species].baseStatTotal).toBeLessThanOrEqual(row.rivalAverage * 1.08)
      }
      if (row.encounterId === 'sixto') expect(row.forcedOffers).toBe(0)
      else if (row.guarantee) expect(row.coveredSegments).toBe(3)
    }
  })

  it('admite −30/+40 absoluto y reproduce el mismo resultado sin porcentajes', () => {
    const options = { seeds: 3, margins: [], absoluteWindows: [{ below: 30, above: 40 }], scenarios: ['A'] as const }
    const run = () => simulateDraft(definition, calendar, { ...options, scenarios: [...options.scenarios] })
    const result = run()
    expect(result).toEqual(run())
    expect(result.rows).toHaveLength(18)
    for (const row of result.rows) {
      expect(row.marginPercent).toBeNull()
      expect(row.absoluteWindow).toEqual({ below: 30, above: 40 })
      expect(row.failedOffers).toBe(0)
      expect(row.repeatedSlotsInPreviousOffer).toBe(0)
      expect(row.offerAverageBST!.min).toBeGreaterThanOrEqual(row.rivalAverage - 30)
      expect(row.offerAverageBST!.max).toBeLessThanOrEqual(row.rivalAverage + 40)
    }
    expect(() => simulateDraft(definition, calendar, { ...options, scenarios: ['A'], absoluteWindows: [{ below: -1, above: 40 }] })).toThrow(/absoluta/)
  })
  it('calcula medianas pares e impares sin alterar las observaciones y distingue muestras vacías', () => {
    const values = [9, 1, 3, 5]
    expect(draftMetricSummary(values)).toEqual({ min: 1, mean: 4.5, median: 4, max: 9 })
    expect(values).toEqual([9, 1, 3, 5])
    expect(draftMetricSummary([9, 1, 5])?.median).toBe(5)
    expect(draftMetricSummary([])).toBeNull()
  })

  it('agrupa ramas y preevoluciones sin confundir especies con alternativas independientes', () => {
    const families = draftEvolutionFamilies(definition)
    expect(families.get('eevee')).toBe(families.get('umbreon'))
    expect(families.get('vaporeon')).toBe(families.get('jolteon'))
    expect(families.get('shedinja')).toBe(families.get('nincada'))
    expect(families.get('treecko')).toBe(families.get('sceptile'))
    expect(families.get('treecko')).not.toBe(families.get('torchic'))
  })
  it('respeta la trayectoria completa por nivel y reconstruye la preevolución', () => {
    expect(ids(0, 'A')).toContain('treecko')
    expect(ids(0, 'A')).not.toContain('grovyle')
    const forms = availableDraftForms(definition, calendar, 2, 'A')
    expect(forms.find(form => form.species === 'grovyle')?.history).toEqual([{ species: 'treecko', evolvedAt: 16 }])
    expect(forms.map(form => form.species)).not.toContain('treecko')
    // Cambio de requisito (Jose, 12/11/2026): las evoluciones por intercambio, en el Nv37; Alakazam no sale hasta un hito de Nv37 o más.
    expect(ids(5, 'A')).not.toContain('alakazam')
    expect(ids(6, 'A')).toContain('alakazam')
    expect(availableDraftForms(definition, calendar, 6, 'A').find(form => form.species === 'alakazam')?.history.at(-1)).toEqual({ species: 'kadabra', evolvedAt: 37 })
    expect(ids(0, 'A')).not.toContain('gengar')
  })

  it('aplica calendario, amistad potencial, belleza, ramas y disponibilidad del Escáner sin gastar', () => {
    expect(ids(2, 'A')).not.toContain('clefable')
    expect(ids(3, 'A')).toContain('clefable')
    expect(ids(2, 'A')).not.toContain('crobat')
    expect(ids(3, 'A')).toContain('crobat')
    expect(ids(4, 'A')).not.toContain('milotic')
    expect(ids(5, 'A')).toContain('milotic')
    expect(ids(6, 'A')).not.toContain('huntail')
    expect(ids(7, 'A')).toEqual(expect.arrayContaining(['huntail', 'gorebyss']))
    expect(ids(2, 'A')).toEqual(expect.arrayContaining(['shedinja', 'ninjask', 'hitmonlee', 'hitmonchan', 'hitmontop']))
    expect(ids(0, 'A')).toEqual(expect.arrayContaining(['beautifly', 'dustox']))
    for (const unavailable of ['steelix', 'scizor', 'kingdra', 'porygon2']) expect(ids(8, 'A')).not.toContain(unavailable)
  })

  it('B conserva bases y solo admite trayectorias de nivel; C conserva las 386 especies', () => {
    expect(ids(2, 'B')).toEqual(expect.arrayContaining(['treecko', 'grovyle', 'abra', 'kadabra']))
    expect(ids(8, 'B')).not.toContain('alakazam')
    expect(ids(8, 'B')).not.toContain('raichu')
    expect(ids(0, 'C')).toHaveLength(386)
    expect(new Set(ids(8, 'A')).size).toBe(ids(8, 'A').length)
  })

  it('produce resultados reproducibles por semilla, nueve hitos y ambos brazos de comparación', () => {
    const options = { seeds: 3, margins: [20], scenarios: ['A'] as const }
    const run = () => simulateDraft(definition, calendar, { ...options, scenarios: [...options.scenarios] })
    const result = run()
    expect(result).toEqual(run())
    expect(result.rows).toHaveLength(18)
    for (const row of result.rows) {
      expect(row.failedOffers).toBe(0)
      expect(row.offersWithAlternativeQuartets).toBe(row.validFourDistinctOffers)
      expect(row.offersWithFourFamilies).toBeLessThanOrEqual(row.offersWithMultipleFamilies)
      expect(row.offersWithMultipleFamilies).toBeLessThanOrEqual(row.validFourDistinctOffers)
      expect(row.poolAfterExclusions!.median).toBeGreaterThanOrEqual(row.poolAfterExclusions!.min)
      if (row.encounterId !== 'petra') expect(row.repeatedSpeciesSlotsEarlierInSegment).toBe(0)
      if (row.forcedOffers) expect(row.counterPoolWhenForced!.min).toBeGreaterThan(0)
      expect(row.repeatedSlotsInPreviousOffer).toBe(0)
      expect(Object.values(row.speciesCounts).reduce((a, b) => a + b, 0)).toBe(row.offeredSlots)
      expect(row.averageBSTRatio).toBeGreaterThanOrEqual(0.8)
      expect(row.averageBSTRatio).toBeLessThanOrEqual(1.2)
      if (row.guarantee && row.encounterId !== 'sixto') expect(row.coveredSegments).toBe(3)
    }
  })

  it('registra pools insuficientes y no inventa resultados para los hitos inalcanzados', () => {
    const result = simulateDraft(definition, calendar, { seeds: 2, margins: [0], scenarios: ['A'] })
    // Con margen cero hay seis especies: la primera oferta cabe, la segunda
    // queda con dos después de excluir los cuatro candidatos anteriores.
    expect(result.rows[0].poolBeforeExclusions).toBe(6)
    expect(result.rows[0].poolAfterExclusions?.min).toBe(2)
    expect(result.rows[0].validFourDistinctOffers).toBe(2)
    expect(result.rows[0].failedOffers).toBe(2)
    expect(result.rows[1].reachedSeeds).toBe(0)
    expect(result.rows[1].offerAverageBST).toBeNull()
  })

  it('rechaza parámetros que impedirían reproducir una simulación válida', () => {
    expect(() => simulateDraft(definition, calendar, { seeds: 0, margins: [20] })).toThrow(/seeds/)
    expect(() => simulateDraft(definition, calendar, { seeds: 2, margins: [NaN] })).toThrow(/margins/)
  })
})
