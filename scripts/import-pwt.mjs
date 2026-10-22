import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { isMain } from './lib/cli.mjs'
import { fromRoot } from './lib/paths.mjs'
import { getPage } from './lib/pwt-http.mjs'
import { parseBulbapedia } from './lib/pwt-parse-bulbapedia.mjs'
import { parseSerebii } from './lib/pwt-parse-serebii.mjs'
import { parseWikidex } from './lib/pwt-parse-wikidex.mjs'
import { typeFromSpanish } from './lib/pwt-normalize.mjs'
import { listPages } from './lib/pwt-sources.mjs'
import { buildReport, loadRawSources } from './lib/pwt-consensus.mjs'
import { formatRawSource, RAW_DIR } from './lib/pwt-raw-format.mjs'

const SNAPSHOTS_PATH = fromRoot('data', 'pwt-raw', 'snapshots.json')
const PARSERS = { bulbapedia: parseBulbapedia, serebii: parseSerebii, wikidex: parseWikidex }
const LANGUAGES = { bulbapedia: 'en', serebii: 'en', wikidex: 'es' }

/** Torneo de una entrada de WikiDex: el Supertorneo Tipo agrupa a los entrenadores bajo «Expertos en Pokémon de tipo X». */
function wikidexTournament(page, entry) {
  if (page.tournament !== 'type-expert') return page.tournament
  const type = typeFromSpanish(entry.group?.replace(/^Expertos en Pokémon de tipo /, '') ?? '')
  if (!type) throw new Error(`Grupo de tipo desconocido en WikiDex: ${entry.group}`)
  return `type-expert:${type}`
}

function describeEntries(page, entries) {
  return entries.map((entry) => ({
    tournament: page.source === 'wikidex' ? wikidexTournament(page, entry) : page.tournament,
    trainer: entry.trainer,
    url: entry.anchor ? `${page.url}#${entry.anchor}` : page.url,
    alwaysLeadsWith: entry.alwaysLeadsWith,
    team: entry.team,
  }))
}

async function extractAll({ offline, refresh }) {
  const pins = existsSync(SNAPSHOTS_PATH) ? JSON.parse(readFileSync(SNAPSHOTS_PATH, 'utf8')) : {}
  const sources = { bulbapedia: { pages: [], teams: [] }, serebii: { pages: [], teams: [] }, wikidex: { pages: [], teams: [] } }
  const failures = []
  for (const page of listPages()) {
    try {
      const { html, snapshot, fromCache } = await getPage(page, { pins, offline, refresh })
      if (snapshot) pins[page.key] = snapshot
      const entries = describeEntries(page, PARSERS[page.source](html))
      sources[page.source].pages.push({ key: page.key, url: page.url, snapshot, sha256: createHash('sha256').update(html).digest('hex'), trainers: entries.length })
      sources[page.source].teams.push(...entries)
      console.log(`  ${page.source}/${page.key}: ${entries.length} entrenadores${fromCache ? ' (caché)' : ''}`)
    } catch (error) {
      console.error(`  ${page.source}/${page.key}: ${error.message}`)
      failures.push(`${page.source}/${page.key}`)
    }
  }
  return { sources, pins, failures }
}

async function main() {
  const flags = new Set(process.argv.slice(2))
  const { sources, pins, failures } = await extractAll({ offline: flags.has('--offline'), refresh: flags.has('--refresh') })
  if (failures.length) {
    console.error(`Fallaron ${failures.length} páginas (${failures.join(', ')}); no se escribe nada para no dejar datos a medias.`)
    process.exitCode = 1
    return
  }
  mkdirSync(RAW_DIR, { recursive: true })
  for (const [source, content] of Object.entries(sources)) {
    writeFileSync(fromRoot('data', 'pwt-raw', `${source}.json`), formatRawSource({ source, language: LANGUAGES[source], ...content }))
  }
  writeFileSync(SNAPSHOTS_PATH, JSON.stringify(Object.fromEntries(Object.entries(pins).sort(([a], [b]) => (a < b ? -1 : 1))), null, 2) + '\n')
  const report = buildReport(loadRawSources())
  writeFileSync(fromRoot('data', 'pwt-raw', 'merged-report.json'), JSON.stringify(report, null, 2) + '\n')
  console.log(JSON.stringify(report.summary, null, 2))
}

if (isMain(import.meta.url)) await main()
