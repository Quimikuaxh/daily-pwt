import { readFileSync } from 'node:fs'
import { fromRoot } from './paths.mjs'

export const RAW_DIR = fromRoot('data', 'pwt-raw')
export const SOURCE_NAMES = ['bulbapedia', 'serebii', 'wikidex']

const oneLine = (value) => JSON.stringify(value)

/** JSON legible y con diffs pequeños en git: cada Pokémon en una línea. */
export function formatRawSource({ source, language, pages, teams }) {
  const teamBlocks = teams.map((entry) => {
    const { team, ...header } = entry
    const members = team.map((member) => `      ${oneLine(member)}`).join(',\n')
    return `    {\n      "header": ${oneLine(header)},\n      "team": [\n${members}\n      ]\n    }`
  })
  const pageLines = pages.map((page) => `    ${oneLine(page)}`).join(',\n')
  return `{\n  "source": ${oneLine(source)},\n  "language": ${oneLine(language)},\n  "pages": [\n${pageLines}\n  ],\n  "teams": [\n${teamBlocks.join(',\n')}\n  ]\n}\n`
}

/** Lee data/pwt-raw/{bulbapedia,serebii,wikidex}.json; devuelve { bulbapedia: {...}, ... } con `teams` en forma plana. */
export function loadRawSources() {
  const sources = {}
  for (const name of SOURCE_NAMES) {
    const raw = JSON.parse(readFileSync(fromRoot('data', 'pwt-raw', `${name}.json`), 'utf8'))
    sources[name] = { ...raw, teams: raw.teams.map(({ header, team }) => ({ ...header, team })) }
  }
  return sources
}
