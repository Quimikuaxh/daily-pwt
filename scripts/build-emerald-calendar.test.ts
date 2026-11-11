import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { importScript } from '../src/test-utils/paths'

const { buildEmeraldCalendar, validateEmeraldCalendar, validateEmeraldCalendarAgainstEvidence, runEmeraldCalendar, EMERALD_CALENDAR } = await importScript('scripts/build-emerald-calendar.mjs')
const { EMERALD_ITEMS } = await importScript('scripts/import-emerald-items.mjs')
const evidence = JSON.parse(readFileSync(EMERALD_ITEMS, 'utf8'))
const calendar = JSON.parse(readFileSync(EMERALD_CALENDAR, 'utf8'))

describe('calendario aprobado por Jose el 11/11', () => {
  it('reproduce los bytes versionados a partir de la evidencia y excluye las cinco entradas no concedidas', () => {
    expect(`${JSON.stringify(buildEmeraldCalendar(evidence), null, 2)}\n`).toBe(readFileSync(EMERALD_CALENDAR, 'utf8'))
    expect(Object.keys(calendar.items)).toHaveLength(65)
    expect(Object.keys(calendar.excluded).sort()).toEqual(['dragonscale', 'metalcoat', 'tm21', 'tm49', 'upgrade'])
    expect(() => validateEmeraldCalendar(calendar)).not.toThrow()
  })
  it('separa recepción y campo para las ocho MO y respeta las medallas', () => {
    expect(calendar.items.hm01).toMatchObject({ before: 'petra', fieldUse: { after: 'petra' } })
    expect(calendar.items.hm05).toMatchObject({ before: 'marcial', fieldUse: { after: 'marcial' } })
    expect(calendar.items.hm06).toMatchObject({ before: 'erico', fieldUse: { after: 'erico' } })
    expect(calendar.items.hm04).toMatchObject({ before: 'candela', fieldUse: { after: 'candela' } })
    expect(calendar.items.hm03).toMatchObject({ before: 'alana', fieldUse: { after: 'norman' } })
    expect(calendar.items.hm02).toMatchObject({ before: 'alana', fieldUse: { after: 'alana' } })
    expect(calendar.items.hm08).toMatchObject({ before: 'galano', fieldUse: { after: 'vito-y-leti' } })
    expect(calendar.items.hm07).toMatchObject({ before: 'galano', fieldUse: { after: 'galano' } })
    expect(evidence.items.hm01.sources[0].source.command).toBe('giveitem ITEM_HM_CUT')
    expect(evidence.items.hm05.sources[0].source.command).toBe('giveitem ITEM_HM_FLASH')
  })
  it('verifica argumentos y ficheros del comando sin escribir, y rechaza fechas manipuladas', async () => {
    const before = readFileSync(EMERALD_CALENDAR, 'utf8')
    expect(await runEmeraldCalendar(['--check'])).toContain('reproducción exacta')
    expect(readFileSync(EMERALD_CALENDAR, 'utf8')).toBe(before)
    const changed = structuredClone(calendar)
    changed.items.tm10.before = 'petra'
    changed.items.tm10.sources = changed.items.tm10.sources.map((source: any) => ({ ...source, before: 'petra' }))
    expect(() => validateEmeraldCalendar(changed)).not.toThrow()
    expect(() => validateEmeraldCalendarAgainstEvidence(changed, evidence)).toThrow(/difiere/)
  })
  it('retrasa todas las fuentes orientales y del Casino, sin perder una segunda fuente anterior', () => {
    for (const id of ['tm10', 'tm13', 'tm24', 'tm29', 'tm32', 'tm35']) expect(calendar.items[id].before).toBe('erico')
    for (const id of ['tm07', 'tm14', 'tm22', 'tm30', 'sunstone', 'kingsrock']) expect(calendar.items[id].before).toBe('vito-y-leti')
    expect(calendar.items.thunderstone.before).toBe('alana')
    expect(calendar.items.waterstone.before).toBe('galano')
    expect(calendar.items.tm36.before).toBe('alana')
    expect(calendar.items.tm27.before).toBe('candela')
    expect(calendar.items.deepseatooth).toMatchObject({ before: 'galano', quantity: 1, choice: 'scanner' })
    expect(calendar.items.deepseascale).toMatchObject({ before: 'galano', quantity: 1, choice: 'scanner' })
  })
})
