import { createHash } from 'node:crypto'
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

describe('DEC-94: calendario de equipables', () => {
  it('conserva las 65 entradas de MT/MO y evolución anteriores al canje', () => {
    // SHA-256 de JSON.stringify(items) en el padre de 31bbc1e: no cambia al añadir held/exchange.
    expect(createHash('sha256').update(JSON.stringify(calendar.items)).digest('hex'))
      .toBe('14f294ab4eda2215ee06d9a59c7a74a4117d0114df707e98f24c4f2a8edeed54')
    expect(calendar.exchange).toEqual(evidence.exchange)
    // Cambio de requisito (Jose, 12/11/2026): fuera los siete que no hacen nada en combate (USELESS_HELD).
    expect(Object.keys(calendar.held)).toHaveLength(28)
    for (const id of ['amuletcoin', 'expshare', 'cleansetag', 'smokeball', 'soothebell', 'everstone', 'machobrace']) expect(calendar.held).not.toHaveProperty(id)
    expect(calendar.held.oranberry).toMatchObject({ kind: 'berry', before: 'petra', infinite: true })
    expect(calendar.held.sitrusberry).toMatchObject({ kind: 'berry', before: 'alana', infinite: true })
    expect(calendar.held.silkscarf).toEqual({ kind: 'held', units: [{ before: 'marcial', map: 'DewfordTown_House2', event: 'DewfordTown_House2_EventScript_Man' }] })
    for (const item of ['leftovers', 'metalcoat', 'potion']) expect(calendar.held[item]).toBeUndefined()
  })

  it('aplica el hito habitual a cada fuente y conserva unidades de hitos distintos', () => {
    const changed = structuredClone(evidence)
    const source = changed.items.quickclaw.sources.find((entry: any) => entry.map === 'RustboroCity_PokemonSchool')
    changed.items.quickclaw.sources = [
      { ...source, earliestBefore: 'petra', map: 'RustboroCity', event: 'first' },
      { ...source, earliestBefore: 'marcial', map: 'SlateportCity', event: 'second' },
      { ...source, earliestBefore: 'alana', map: 'LilycoveCity', event: 'third' },
      { ...source, earliestBefore: 'alana', map: 'Route132', event: 'fourth' },
    ]
    expect(buildEmeraldCalendar(changed).held.quickclaw.units).toEqual([
      { before: 'petra', map: 'RustboroCity', event: 'first' },
      { before: 'erico', map: 'SlateportCity', event: 'second' },
      { before: 'vito-y-leti', map: 'LilycoveCity', event: 'third' },
      { before: 'galano', map: 'Route132', event: 'fourth' },
    ])
  })

  it.each(['hardstone', 'magnet'])('%s: la entrega normal y la recogida con bolsa llena son una sola unidad', item => {
    // pokeemerald: TrickHouseEnd da el premio; TrickHouseEntrance lo recupera solo si la bolsa estaba llena.
    expect(buildEmeraldCalendar(evidence).held[item].units).toHaveLength(1)
  })

  it.each([
    ['held ausente', (value: any) => { delete value.held }],
    ['tipo de equipable desconocido', (value: any) => { value.held.quickclaw.kind = 'other' }],
    ['hito de unidad inexistente', (value: any) => { value.held.quickclaw.units[0].before = 'missing' }],
    ['baya no infinita', (value: any) => { value.held.oranberry.infinite = false }],
    ['exchange ausente', (value: any) => { delete value.exchange }],
    ['precio negativo', (value: any) => { value.exchange[0].price = -1 }],
    ['precio fraccionario', (value: any) => { value.exchange[0].price = 0.5 }],
    ['objeto del canje desconocido', (value: any) => { value.exchange[0].item = 'missing' }],
    ['entrada duplicada del canje', (value: any) => { value.exchange[1] = value.exchange[0] }],
  ])('rechaza %s en la validación del calendario', (_label, corrupt) => {
    const changed = structuredClone(calendar)
    corrupt(changed)
    expect(() => validateEmeraldCalendar(changed)).toThrow()
  })
})
