import { writeFileSync } from 'node:fs'
import { isMain } from './lib/cli.mjs'
import { gen5, toId } from './lib/dex.mjs'
import { fromRoot } from './lib/paths.mjs'
import { SLUGS_ALTERNATIVOS, toSlug } from './lib/slug.mjs'
import { readCsv } from './build-names-es.mjs'

const SPANISH_LANGUAGE_ID = '7'
/** Primer grupo de versiones con texto en español en PokeAPI: Pokémon X/Y. Los juegos de 5.ª generación no existen en español en esa base. */
const XY_VERSION_GROUP_ID = '15'
/**
 * Objetos: los textos en español de X/Y están desplazados en PokeAPI (a la Baya Yapati le toca el de la Roca del Rey; comprobado el
 * 05/11/2026), así que se toman de Sol / Luna (17) y, si allí falta, de la primera edición posterior que lo tenga.
 */
const ITEM_VERSION_GROUP_IDS = ['17', '18', '19', '20', '21', '22', '23', '24', '25']

const normalizeText = (text) => text.replace(/­/g, '').replace(/\s+/g, ' ').trim()

/** Texto en español de cada identificador, de la primera edición de `versionGroups` (en ese orden) que lo tenga. */
async function flavorByIdentifier(identifiersFile, flavorFile, idColumn, offline, versionGroups = [XY_VERSION_GROUP_ID]) {
  const identifierById = new Map((await readCsv(identifiersFile, offline)).map((row) => [row.id, row.identifier]))
  const best = new Map()
  for (const row of await readCsv(flavorFile, offline)) {
    const rank = versionGroups.indexOf(row.version_group_id)
    if (row.language_id !== SPANISH_LANGUAGE_ID || rank < 0 || !identifierById.has(row[idColumn])) continue
    const identifier = identifierById.get(row[idColumn])
    if (!best.has(identifier) || rank < best.get(identifier).rank) best.set(identifier, { rank, text: normalizeText(row.flavor_text) })
  }
  return new Map([...best].map(([identifier, { text }]) => [identifier, text]))
}

const lookupByName = (byIdentifier, englishName) => {
  const slug = toSlug(englishName)
  const hiddenPower = /^hidden-power-/.test(slug) ? 'hidden-power' : slug
  return byIdentifier.get(hiddenPower) ?? byIdentifier.get(SLUGS_ALTERNATIVOS[hiddenPower]) ?? null
}

/**
 * descriptions-es.json: descripción en español de cada movimiento, habilidad y objeto de Gen 5 (claves = ids de @pkmn), para la pantalla de datos.
 * Texto de Pokémon X/Y (PokeAPI, mismo commit que los nombres): es la primera edición con español y describe el mismo efecto. Los objetos
 * (Jose, 05/11/2026), para la ficha de los paneles laterales del combate (RF-44c).
 */
export async function buildDescriptionsEs({ offline = false } = {}) {
  const moveFlavor = await flavorByIdentifier('moves', 'move_flavor_text', 'move_id', offline)
  const abilityFlavor = await flavorByIdentifier('abilities', 'ability_flavor_text', 'ability_id', offline)
  const itemFlavor = await flavorByIdentifier('items', 'item_flavor_text', 'item_id', offline, ITEM_VERSION_GROUP_IDS)
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
  const items = {}
  for (const item of gen5.items) {
    const text = lookupByName(itemFlavor, item.name)
    if (text) items[item.id] = text
  }
  const sorted = (record) => Object.fromEntries(Object.entries(record).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
  return { moves: sorted(moves), abilities: sorted(abilities), items: sorted(items) }
}

if (isMain(import.meta.url)) {
  const descriptions = await buildDescriptionsEs({ offline: false })
  writeFileSync(fromRoot('src', 'generated', 'descriptions-es.json'), JSON.stringify(descriptions) + '\n')
  console.log(`moves: ${Object.keys(descriptions.moves).length}, abilities: ${Object.keys(descriptions.abilities).length}, items: ${Object.keys(descriptions.items).length}`)
}
