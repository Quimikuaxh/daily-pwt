import { readFile, writeFile } from 'node:fs/promises'
import { isDeepStrictEqual, parseArgs } from 'node:util'
import { isMain } from './lib/cli.mjs'
import { fromRoot } from './lib/paths.mjs'
import { EMERALD_ITEMS, validateEmeraldItems } from './import-emerald-items.mjs'
import { EMERALD_REVISION } from './lib/emerald-source.mjs'

export const EMERALD_CALENDAR = fromRoot('data', 'nuzlocke', 'hoenn-emerald-calendar.json')
const approval = '2026-11-11'

function habitualIndex(source, milestones) {
  let index = milestones.indexOf(source.earliestBefore)
  const map = source.map ?? ''
  if (/^(SlateportCity|MauvilleCity|VerdanturfTown|Route110)(_|$)/.test(map)) index = Math.max(index, 2)
  if (/^(LilycoveCity|MtPyre|SafariZone|MossdeepCity|ShoalCave|Route124)(_|$)/.test(map)) index = Math.max(index, 6)
  if (/^(PacifidlogTown|Route13[234])(_|$)/.test(map)) index = Math.max(index, 7)
  return index
}

/** Objetos de evolución del calendario (piedras y objetos de intercambio); los demás equipables van en `held`. */
const evolutionItems = new Set(['thunderstone', 'moonstone', 'firestone', 'leafstone', 'sunstone', 'waterstone', 'kingsrock', 'metalcoat',
  'dragonscale', 'upgrade', 'deepseatooth', 'deepseascale'])

export function buildEmeraldCalendar(evidence) {
  validateEmeraldItems(evidence)
  const { milestones } = evidence
  const items = {}
  const excluded = {}
  const held = {}
  for (const [id, item] of Object.entries(evidence.items)) {
    // Objetos equipables (Jose, 11/11/2026): una unidad por fuente de la aventura, con su hito habitual; las bayas, infinitas.
    if (item.held) {
      const units = item.sources.filter(source => source.earliestBefore !== null && !source.decision)
        .map(source => ({ before: milestones[habitualIndex(source, milestones)], map: source.map, event: source.event }))
      if (units.length) held[id] = item.held === 'berry' ? { kind: 'berry', before: milestones.find(milestone => units.some(unit => unit.before === milestone)), infinite: true, sources: units }
        : { kind: 'held', units }
      if (!item.move && !evolutionItems.has(id)) continue
    }
    const sources = item.sources.filter(source => source.earliestBefore !== null &&
      (!source.decision || source.decision === 'scanner-choice'))
      .map(source => ({ before: milestones[habitualIndex(source, milestones)], map: source.map, event: source.event }))
    if (!sources.length) {
      excluded[id] = item.sources.length ? 'premios aleatorios, semanales o posliga excluidos' : 'sin fuente nativa identificada'
      continue
    }
    const before = milestones.find(milestone => sources.some(source => source.before === milestone))
    items[id] = { before, ...(item.move ? { move: item.move } : { quantity: 1 }),
      ...(item.fieldUse ? { fieldUse: item.fieldUse } : {}),
      ...(item.sources.some(source => source.decision === 'scanner-choice') ? { choice: 'scanner' } : {}), sources }
  }
  const catalog = { schemaVersion: 1, rulesVersion: 'hoenn-emerald:2026-11-11',
    source: { revision: EMERALD_REVISION, evidence: 'hoenn-emerald-items.json' }, approval,
    milestones, friendshipWins: 3, leagueFriendship: true, battleHappiness: 255, beautyBefore: 'alana', items, excluded,
    held, exchange: evidence.exchange }
  validateEmeraldCalendar(catalog)
  return catalog
}

export function validateEmeraldCalendar(catalog) {
  if (catalog?.schemaVersion !== 1 || catalog.rulesVersion !== 'hoenn-emerald:2026-11-11' ||
    catalog.source?.revision !== EMERALD_REVISION || catalog.approval !== approval ||
    catalog.milestones?.length !== 13 || new Set(catalog.milestones).size !== 13 ||
    Object.keys(catalog.items ?? {}).length !== 65 || Object.keys(catalog.excluded ?? {}).length !== 5 ||
    catalog.friendshipWins !== 3 || catalog.leagueFriendship !== true || catalog.battleHappiness !== 255 || catalog.beautyBefore !== 'alana') {
    throw new Error('Calendario aprobado de Esmeralda inválido')
  }
  for (const [id, item] of Object.entries(catalog.items)) {
    if (!catalog.milestones.includes(item.before) || !Array.isArray(item.sources) || !item.sources.length ||
      (id.startsWith('tm') || id.startsWith('hm') ? typeof item.move !== 'string' : item.quantity !== 1) ||
      item.sources.some(source => !catalog.milestones.includes(source.before) || !source.map || !source.event) ||
      item.before !== catalog.milestones.find(milestone => item.sources.some(source => source.before === milestone))) {
      throw new Error(`${id}: fecha o fuente de calendario inválida`)
    }
  }
}

/** Comprueba también fechas, movimientos, exclusiones y fuentes contra la política aprobada. */
export function validateEmeraldCalendarAgainstEvidence(catalog, evidence) {
  validateEmeraldCalendar(catalog)
  if (!isDeepStrictEqual(catalog, buildEmeraldCalendar(evidence))) {
    throw new Error('El calendario difiere de la evidencia y las decisiones aprobadas')
  }
}

export async function runEmeraldCalendar(args) {
  const { values } = parseArgs({ args, options: { check: { type: 'boolean', default: false } } })
  const result = buildEmeraldCalendar(JSON.parse(await readFile(EMERALD_ITEMS, 'utf8')))
  const bytes = `${JSON.stringify(result, null, 2)}\n`
  if (values.check) {
    if (await readFile(EMERALD_CALENDAR, 'utf8') !== bytes) throw new Error('Calendario no reproducible')
  } else await writeFile(EMERALD_CALENDAR, bytes)
  return `Calendario aprobado: ${Object.keys(result.items).length} objetos; ${values.check ? 'reproducción exacta' : 'generado'}`
}

if (isMain(import.meta.url)) console.log(await runEmeraldCalendar(process.argv.slice(2)))
