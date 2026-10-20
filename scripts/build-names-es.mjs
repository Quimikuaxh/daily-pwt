import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { isMain } from './lib/cli.mjs'
import { gen5, toId } from './lib/dex.mjs'
import { CACHE_DIR, fromRoot } from './lib/paths.mjs'
import { SLUGS_ALTERNATIVOS, toSlug, traduccionDerivada } from './lib/slug.mjs'

// Fijado a un commit (17/10/2026): los CSV de `master` cambian y los nombres generados no serían reproducibles. Para actualizar, cambia el SHA y borra scripts/.cache.
const POKEAPI_COMMIT = '6fd69dfe90465ba96534f6816fc817737d1f97f6'
const POKEAPI_CSV_URL = `https://raw.githubusercontent.com/PokeAPI/pokeapi/${POKEAPI_COMMIT}/data/v2/csv`
const SPANISH_LANGUAGE_ID = '7'
const USER_AGENT = 'daily-pwt-build/0.1 (fan project; dev script)'

// [fichero de identificadores, fichero de nombres, columna del id]
const CATEGORIES = {
  species: ['pokemon_species', 'pokemon_species_names', 'pokemon_species_id'],
  moves: ['moves', 'move_names', 'move_id'],
  abilities: ['abilities', 'ability_names', 'ability_id'],
  items: ['items', 'item_names', 'item_id'],
  types: ['types', 'type_names', 'type_id'],
}

function parseCsv(text) {
  const rows = []
  let row = []
  let field = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { field += '"'; i++ } else if (char === '"') quoted = false
      else field += char
    } else if (char === '"') quoted = true
    else if (char === ',') { row.push(field); field = '' }
    else if (char === '\n') { row.push(field); rows.push(row); row = []; field = '' }
    else if (char !== '\r') field += char
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row) }
  const [header, ...body] = rows
  return body.filter((r) => r.length === header.length).map((r) => Object.fromEntries(header.map((name, i) => [name, r[i]])))
}

export async function readCsv(name, offline) {
  const file = join(CACHE_DIR, `${name}.csv`)
  if (!existsSync(file)) {
    if (offline) throw new Error(`Falta ${file}: ejecuta «npm run gen:names» con red para descargar los CSV de PokeAPI.`)
    mkdirSync(CACHE_DIR, { recursive: true })
    const response = await fetch(`${POKEAPI_CSV_URL}/${name}.csv`, { headers: { 'User-Agent': USER_AGENT } })
    if (!response.ok) throw new Error(`No se pudo descargar ${name}.csv (HTTP ${response.status}).`)
    writeFileSync(file, await response.text())
  }
  return parseCsv(readFileSync(file, 'utf8'))
}

/** Mapa identificador de PokeAPI -> nombre en español. */
async function spanishNamesByIdentifier([identifiersFile, namesFile, idColumn], offline) {
  const identifierById = new Map((await readCsv(identifiersFile, offline)).map((row) => [row.id, row.identifier]))
  const result = new Map()
  for (const row of await readCsv(namesFile, offline)) {
    if (row.local_language_id === SPANISH_LANGUAGE_ID && identifierById.has(row[idColumn])) {
      result.set(identifierById.get(row[idColumn]), row.name)
    }
  }
  return result
}

export function lookup(spanishByIdentifier, englishName) {
  const slug = toSlug(englishName)
  return spanishByIdentifier.get(slug) ?? spanishByIdentifier.get(SLUGS_ALTERNATIVOS[slug]) ?? null
}

const sorted = (record) => Object.fromEntries(Object.entries(record).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))

/**
 * names-es.json: claves = ids de @pkmn, valores = nombres en español.
 * Los overrides manuales (data/names-es-overrides.json) mandan sobre PokeAPI.
 */
export async function buildNamesEs({ offline = false } = {}) {
  const pokeapi = {}
  for (const [category, files] of Object.entries(CATEGORIES)) pokeapi[category] = await spanishNamesByIdentifier(files, offline)

  const names = { species: {}, moves: {}, abilities: {}, items: {}, types: {} }

  const baseSpanishName = new Map()
  for (const species of gen5.species) {
    if (species.forme) continue
    const spanish = lookup(pokeapi.species, species.name)
    if (spanish) {
      names.species[species.id] = spanish
      baseSpanishName.set(species.baseSpecies, spanish)
    }
  }
  // Las formas (Rotom-Wash, Deoxys-Attack...) usan el nombre de su especie base.
  for (const species of gen5.species) {
    if (species.forme && baseSpanishName.has(species.baseSpecies)) names.species[species.id] = baseSpanishName.get(species.baseSpecies)
  }

  for (const move of gen5.moves) {
    const spanish = traduccionDerivada(move.name) ?? lookup(pokeapi.moves, move.name)
    if (spanish) names.moves[toId(move.name)] = spanish
  }
  for (const ability of gen5.abilities) {
    const spanish = lookup(pokeapi.abilities, ability.name)
    if (spanish) names.abilities[ability.id] = spanish
  }
  for (const item of gen5.items) {
    const spanish = lookup(pokeapi.items, item.name)
    if (spanish) names.items[item.id] = spanish
  }
  for (const type of gen5.types) {
    const spanish = pokeapi.types.get(toSlug(type.name))
    if (spanish) names.types[type.name] = spanish
  }

  const overrides = JSON.parse(readFileSync(fromRoot('data', 'names-es-overrides.json'), 'utf8'))
  for (const [category, entries] of Object.entries(overrides)) Object.assign(names[category], entries)

  return Object.fromEntries(Object.entries(names).map(([category, record]) => [category, sorted(record)]))
}

if (isMain(import.meta.url)) {
  const names = await buildNamesEs({ offline: false })
  writeFileSync(fromRoot('src', 'generated', 'names-es.json'), JSON.stringify(names) + '\n')
  console.log(Object.entries(names).map(([category, record]) => `${category}: ${Object.keys(record).length}`).join(', '))
}
