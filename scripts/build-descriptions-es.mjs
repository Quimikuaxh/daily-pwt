import { writeFileSync } from 'node:fs'
import { isMain } from './lib/cli.mjs'
import { gen5, toId } from './lib/dex.mjs'
import { fromRoot } from './lib/paths.mjs'
import { SLUGS_ALTERNATIVOS, toSlug } from './lib/slug.mjs'
import { readCsv } from './build-names-es.mjs'

const SPANISH_LANGUAGE_ID = '7'
/** Primer grupo de versiones con texto en español en PokeAPI: Pokémon X/Y. Los juegos de 5.ª generación no existen en español en esa base. */
const XY_VERSION_GROUP_ID = '15'

const normalizeText = (text) => text.replace(/­/g, '').replace(/\s+/g, ' ').trim()

async function flavorByIdentifier(identifiersFile, flavorFile, idColumn, offline) {
  const identifierById = new Map((await readCsv(identifiersFile, offline)).map((row) => [row.id, row.identifier]))
  const result = new Map()
  for (const row of await readCsv(flavorFile, offline)) {
    if (row.language_id === SPANISH_LANGUAGE_ID && row.version_group_id === XY_VERSION_GROUP_ID && identifierById.has(row[idColumn])) {
      result.set(identifierById.get(row[idColumn]), normalizeText(row.flavor_text))
    }
  }
  return result
}

const lookupByName = (byIdentifier, englishName) => {
  const slug = toSlug(englishName)
  const hiddenPower = /^hidden-power-/.test(slug) ? 'hidden-power' : slug
  return byIdentifier.get(hiddenPower) ?? byIdentifier.get(SLUGS_ALTERNATIVOS[hiddenPower]) ?? null
}

/**
 * descriptions-es.json: descripción en español de cada movimiento y habilidad de Gen 5 (claves = ids de @pkmn), para la pantalla de datos.
 * Texto de Pokémon X/Y (PokeAPI, mismo commit que los nombres): es la primera edición con español y describe el mismo efecto.
 */
export async function buildDescriptionsEs({ offline = false } = {}) {
  const moveFlavor = await flavorByIdentifier('moves', 'move_flavor_text', 'move_id', offline)
  const abilityFlavor = await flavorByIdentifier('abilities', 'ability_flavor_text', 'ability_id', offline)
  const moves = {}
  for (const move of gen5.moves) {
    const text = lookupByName(moveFlavor, move.name)
    if (text) moves[toId(move.name)] = text
  }
  const abilities = {}
  for (const ability of gen5.abilities) {
    const text = lookupByName(abilityFlavor, ability.name)
    if (text) abilities[ability.id] = text
  }
  const sorted = (record) => Object.fromEntries(Object.entries(record).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
  return { moves: sorted(moves), abilities: sorted(abilities) }
}

if (isMain(import.meta.url)) {
  const descriptions = await buildDescriptionsEs({ offline: false })
  writeFileSync(fromRoot('src', 'generated', 'descriptions-es.json'), JSON.stringify(descriptions) + '\n')
  console.log(`moves: ${Object.keys(descriptions.moves).length}, abilities: ${Object.keys(descriptions.abilities).length}`)
}
