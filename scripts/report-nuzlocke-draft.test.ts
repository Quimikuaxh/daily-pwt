import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { fromRoot, importScript } from '../src/test-utils/paths'

const { renderDraftTables, replaceDraftTables, REPORT_START, REPORT_END } = await importScript('scripts/report-nuzlocke-draft.mjs')
const bytes = readFileSync(fromRoot('docs/nuzlocke/draft-results-100.json'))
const results = JSON.parse(bytes.toString('utf8'))

describe('informe reproducible del draft', () => {
  it('conserva fuentes verificables y todos los escenarios, márgenes, hitos y comparaciones', () => {
    expect(results.schemaVersion).toBe(2)
    expect(results.rows).toHaveLength(216)
    for (const evidence of results.evidence) {
      const actual = createHash('sha256').update(readFileSync(fromRoot(evidence.path))).digest('hex')
      expect(evidence.sha256).toBe(actual)
    }
    expect(() => renderDraftTables(results, 'hash')).not.toThrow()
    expect(results.rows.reduce((sum: number, row: any) => sum + row.validFourDistinctOffers, 0)).toBe(48_000)
  })

  it('presenta medianas y proporciones con los denominadores del hito, sin promediar porcentajes', () => {
    const fixture = structuredClone(results)
    fixture.options.scenarios = ['A']
    fixture.options.margins = [10]
    fixture.rows = fixture.rows.filter((r: any) => r.scenario === 'A' && r.marginPercent === 10)
    const petra = fixture.rows.find((r: any) => r.encounterId === 'petra' && r.guarantee)
    petra.poolAfterExclusions = { min: 7, mean: 8, median: 7.5, max: 10 }
    petra.reachedSeeds = 2
    petra.completedSegments = 2
    petra.coveredSegments = 1
    petra.forcedOffers = 1
    petra.removedOfferFractionWhenForced = { mean: 0.25 }
    const text = renderDraftTables(fixture, 'abc123')
    expect(text).toContain('SHA-256 `abc123`')
    expect(text).toContain('| Petra | 7 / 7.5 |')
    expect(text).toContain('100.0 % / 50.0 % | 50.0 % | 25.0 %')
    expect(text).not.toContain('NaN')
    expect(text).not.toContain('undefined')
  })

  it('no sobrescribe la explicación ni duplica tablas y rechaza marcadores o filas ambiguos', () => {
    const document = `propuesta\n${REPORT_START}\nviejo\n${REPORT_END}\npendientes`
    const updated = replaceDraftTables(document, 'nuevo')
    expect(updated).toBe(`propuesta\n${REPORT_START}\nnuevo\n${REPORT_END}\npendientes`)
    expect(replaceDraftTables(updated, 'nuevo')).toBe(updated)
    expect(() => replaceDraftTables('sin marcadores', 'nuevo')).toThrow(/marcadores/)
    expect(() => renderDraftTables({ ...results, rows: results.rows.slice(1) }, 'hash')).toThrow(/fila única/)
    expect(() => renderDraftTables({ ...results, schemaVersion: 1 }, 'hash')).toThrow(/schemaVersion/)
  })

  it('mantiene las tablas publicadas idénticas al JSON versionado', () => {
    const document = readFileSync(fromRoot('docs/nuzlocke/SIMULACION-DRAFT.md'), 'utf8')
    const hash = createHash('sha256').update(bytes).digest('hex')
    expect(replaceDraftTables(document, renderDraftTables(results, hash))).toBe(document)
  })

  it('reproduce también la sección absoluta y conserva la comparación porcentual', () => {
    const absolute = readFileSync(fromRoot('docs/nuzlocke/draft-results-absolute-100.json'))
    const result = JSON.parse(absolute.toString('utf8'))
    expect(result.rows).toHaveLength(18)
    expect(result.options.margins).toEqual([])
    expect(result.options.absoluteWindows).toEqual([{ below: 30, above: 40 }])
    const tables = renderDraftTables(result, createHash('sha256').update(absolute).digest('hex'))
    expect(tables).toContain('−30/+40')
    expect(tables).not.toContain('±null')
    const doc = readFileSync(fromRoot('docs/nuzlocke/SIMULACION-DRAFT.md'), 'utf8')
    expect(replaceDraftTables(doc, tables, { start: '<!-- draft-absolute:start -->', end: '<!-- draft-absolute:end -->' })).toBe(doc)
  })
})
