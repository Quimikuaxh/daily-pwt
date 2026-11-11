import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { parseArgs } from 'node:util'
import { isMain } from './lib/cli.mjs'
import { fromRoot } from './lib/paths.mjs'

export const REPORT_START = '<!-- draft-tables:start -->'
export const REPORT_END = '<!-- draft-tables:end -->'
const names = { petra: 'Petra', marcial: 'Marcial', erico: 'Erico', candela: 'Candela', norman: 'Norman', alana: 'Alana', 'vito-y-leti': 'Vito y Leti', galano: 'Galano', sixto: 'Liga (Sixto)' }
const types = { Normal: 'Normal', Fire: 'Fuego', Water: 'Agua', Electric: 'Eléctrico', Grass: 'Planta', Ice: 'Hielo', Fighting: 'Lucha', Poison: 'Veneno', Ground: 'Tierra', Flying: 'Volador', Psychic: 'Psíquico', Bug: 'Bicho', Rock: 'Roca', Ghost: 'Fantasma', Dragon: 'Dragón', Dark: 'Siniestro', Steel: 'Acero' }
const percent = (part, total) => total ? `${(100 * part / total).toFixed(1)} %` : '—'
const fractionPercent = value => value === null || value === undefined ? '—' : `${(100 * value).toFixed(1)} %`
const table = (headers, rows) => `| ${headers.join(' | ')} |\n| ${headers.map(() => '---').join(' | ')} |\n${rows.map(row => `| ${row.join(' | ')} |`).join('\n')}\n`

/** Tablas derivadas exclusivamente de los datos; no toma decisiones de producto. */
export function renderDraftTables(result, sourceHash) {
  if (result.schemaVersion !== 2) throw new Error('Se necesita JSON de simulación con schemaVersion 2')
  const { seeds, scenarios, margins: percentages, absoluteWindows = [] } = result.options
  const margins = [...percentages, ...absoluteWindows]
  const label = margin => typeof margin === 'number' ? `±${margin} %` : `−${margin.below}/+${margin.above}`
  const matchesWindow = (row, margin) => typeof margin === 'number' ? row.marginPercent === margin :
    row.marginPercent === null && row.absoluteWindow?.below === margin.below && row.absoluteWindow?.above === margin.above
  const find = (scenario, margin, id, guarantee) => {
    const matches = result.rows.filter(row => row.scenario === scenario && matchesWindow(row, margin) && row.encounterId === id && row.guarantee === guarantee)
    if (matches.length !== 1) throw new Error(`Falta una fila única: ${scenario}/${margin}/${id}/${guarantee}`)
    return matches[0]
  }
  const selected = []
  for (const s of scenarios) for (const m of margins) for (const id of Object.keys(names)) {
    selected.push(find(s, m, id, true))
    find(s, m, id, false)
  }
  const sum = (rows, field) => rows.reduce((total, row) => total + row[field], 0)
  let text = `JSON fuente: SHA-256 \`${sourceHash}\`. Muestra: **${seeds} semillas por combinación**; ventanas **${margins.map(label).join(', ')}**; escenarios **${scenarios.join('/')}**.\n\n`
  text += 'Lectura común de las tablas por hito: «Otras ofertas» cuenta sorteos con más de un cuarteto legal posible; «Familias ≥2 / 4» cuenta ofertas con al menos dos familias y con cuatro familias distintas. «Rep.» son plazas de especies vistas en ofertas anteriores de la misma semilla / plazas del hito. «BST/rival» es la media ofrecida relativa a la referencia rival. «Tipos» muestra los dos más presentes por plaza, contando ambos tipos propios. Todas estas columnas describen el brazo con garantía.\n\n'
  text += 'En las tablas de garantía, «Sin/con» compara los tramos cubiertos con la regla desactivada/activada. «Forzada» indica la fracción de tramos alcanzados en que se condicionó la última oferta; «Cuartetos retirados» es la reducción media solo en esas ofertas. «Supereficaces mín.» cuenta candidatos de tipo válido al forzar: basta uno, no cuatro. «—» indica que no se forzó o que no hay observaciones, según la columna. La Liga no tiene garantía.\n\n'
  text += '### Comparación global con garantía\n\n'
  text += 'Pool mínimo tras exclusiones; alternativas y repeticiones agregadas sobre todas las ofertas o plazas de los nueve hitos, según la columna. Familias ≥2/4 muestra dos recuentos: ofertas con al menos dos familias y ofertas con cuatro familias distintas.\n\n'
  text += table(['Escenario', 'Margen', 'Pool mín.', 'Ofertas válidas / intentos', 'Con otros cuartetos', 'Familias ≥2 / 4', 'Reapariciones / plazas', 'Fallos'], scenarios.flatMap(s => margins.map(m => {
    const rows = selected.filter(r => r.scenario === s && matchesWindow(r, m))
    const observed = rows.flatMap(r => r.poolAfterExclusions ? [r.poolAfterExclusions.min] : [])
    return [s, label(m), observed.length ? Math.min(...observed) : '—', `${sum(rows, 'validFourDistinctOffers')} / ${sum(rows, 'attemptedOffers')}`,
      sum(rows, 'offersWithAlternativeQuartets'), `${sum(rows, 'offersWithMultipleFamilies')} / ${sum(rows, 'offersWithFourFamilies')}`,
      percent(sum(rows, 'repeatedSpeciesSlotsEarlierInCampaign'), sum(rows, 'offeredSlots')), sum(rows, 'failedOffers')]
  })))
  for (const scenario of scenarios) {
    text += `\n### Escenario ${scenario}: pool por hito\n\n`
    text += 'Cada celda es **mínimo / mediana** de especies tras excluir la oferta anterior, con garantía. Se agregan todas las ofertas y semillas del hito, no las medianas de subgrupos.\n\n'
    text += table(['Hito', ...margins.map(m => label(m))], Object.entries(names).map(([id, name]) => [name, ...margins.map(m => {
      const pool = find(scenario, m, id, true).poolAfterExclusions
      return pool ? `${pool.min} / ${pool.median}` : '—'
    })]))
    for (const margin of margins) {
      const rows = selected.filter(r => r.scenario === scenario && matchesWindow(r, margin))
      text += `\n#### ${scenario} · ${label(margin)}: elecciones, repetición y estadísticas\n\n`
      text += table(['Hito', 'Válidas', 'Otras ofertas', 'Familias ≥2 / 4', 'Rep.', 'BST/rival', 'Tipos más presentes'], rows.map(r => {
        const top = Object.entries(r.typeCounts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 2)
          .map(([type, count]) => `${types[type] ?? type} ${percent(count, r.offeredSlots)}`).join('; ')
        return [names[r.encounterId], r.validFourDistinctOffers, r.offersWithAlternativeQuartets,
          `${r.offersWithMultipleFamilies} / ${r.offersWithFourFamilies}`, percent(r.repeatedSpeciesSlotsEarlierInCampaign, r.offeredSlots), fractionPercent(r.averageBSTRatio), top || '—']
      }))
      text += `\n#### ${scenario} · ${label(margin)}: efecto de la garantía por tramo\n\n`
      text += table(['Gimnasio', 'Cobertura sin / con', 'Forzada', 'Cuartetos retirados', 'Supereficaces mín.', 'Tramos completados'], rows.filter(r => r.encounterId !== 'sixto').map(r => {
        const baseline = find(scenario, margin, r.encounterId, false)
        return [names[r.encounterId], `${percent(baseline.coveredSegments, baseline.completedSegments)} / ${percent(r.coveredSegments, r.completedSegments)}`,
          percent(r.forcedOffers, r.reachedSeeds), fractionPercent(r.removedOfferFractionWhenForced?.mean),
          r.counterPoolWhenForced?.min ?? '—', `${r.completedSegments} / ${seeds}`]
      }))
    }
  }
  const insufficient = selected.filter(r => r.poolBeforeExclusions < 4 || (r.poolAfterExclusions && r.poolAfterExclusions.min < 4))
  const noCounter = selected.filter(r => r.encounterId !== 'sixto' && r.counterPoolBeforeExclusions === 0)
  text += '\n### Escasez y cobertura\n\n'
  text += insufficient.length ? `Pools con menos de cuatro especies: ${insufficient.map(r => `${r.scenario}/${label(r.absoluteWindow ?? r.marginPercent)}/${names[r.encounterId]}`).join(', ')}.\n` : 'Ninguna combinación presenta un pool menor de cuatro, antes ni después de exclusiones, en los hitos observados.\n'
  text += noCounter.length ? `Tramos sin candidatos de tipo propio válido en el pool inicial: ${noCounter.map(r => `${r.scenario}/${label(r.absoluteWindow ?? r.marginPercent)}/${names[r.encounterId]}`).join(', ')}.\n` : 'Todos los gimnasios tienen candidatos de tipo propio válido en el pool inicial.\n'
  text += `Repeticiones con la oferta inmediatamente anterior: **${sum(selected, 'repeatedSlotsInPreviousOffer')}**. Fallos con garantía: **${sum(selected, 'failedOffers')}**.\n`
  return text.trimEnd()
}

export function replaceDraftTables(document, tables, { start: startMarker = REPORT_START, end: endMarker = REPORT_END } = {}) {
  if (document.split(startMarker).length !== 2 || document.split(endMarker).length !== 2) throw new Error('El informe debe tener un único par de marcadores de tablas')
  const start = document.indexOf(startMarker)
  const end = document.indexOf(endMarker)
  if (end < start) throw new Error('Marcadores de tablas invertidos')
  return `${document.slice(0, start)}${startMarker}\n${tables}\n${document.slice(end)}`
}

if (isMain(import.meta.url)) {
  const { values } = parseArgs({ options: {
    input: { type: 'string' },
    section: { type: 'string', default: 'percent' },
    report: { type: 'string', default: fromRoot('docs/nuzlocke/SIMULACION-DRAFT.md') },
    check: { type: 'boolean', default: false },
  } })
  if (!['percent', 'absolute'].includes(values.section)) throw new Error('--section debe ser percent o absolute')
  const absolute = values.section === 'absolute'
  const bytes = await readFile(values.input ?? fromRoot(`docs/nuzlocke/draft-results-${absolute ? 'absolute-' : ''}100.json`))
  const doc = await readFile(values.report, 'utf8')
  const next = replaceDraftTables(doc, renderDraftTables(JSON.parse(bytes), createHash('sha256').update(bytes).digest('hex')), absolute ? { start: '<!-- draft-absolute:start -->', end: '<!-- draft-absolute:end -->' } : {})
  if (values.check) {
    if (next !== doc) throw new Error('Las tablas no coinciden con el JSON; regenerarlas antes de entregar')
    console.log('Tablas del draft reproducidas sin diferencias')
  } else await writeFile(values.report, next)
}
