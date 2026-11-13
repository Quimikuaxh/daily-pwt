/**
 * Rivales de la locke de N2/B2 (PRD §0, «Locke de N2/B2: rivales e IV», 13/11/2026): los 8 líderes, el Alto Mando y la campeona Iris
 * del modo Normal, con equipo, niveles, habilidades, ataques y objetos de Serebii. N2/B2 no tiene código fuente publicado: se lee la
 * página de gimnasios y la del Alto Mando, se toma la primera tabla del modo Normal de cada rival (la página trae también el modo
 * Desafío y la revancha de después de la Liga) y se valida contra los datos de Gen 5 de `@pkmn/dex`.
 *
 * Sin IV: la campaña combate con 20 IV en los dos bandos, como en Hoenn (PRD §0).
 *
 * Uso: npm run gen:n2b2 [-- --offline] [-- --refresh]
 */
import { createHash } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import { parseArgs } from 'node:util'
import { isMain } from './lib/cli.mjs'
import { gen5 } from './lib/dex.mjs'
import { fromRoot } from './lib/paths.mjs'
import { getPage } from './lib/pwt-http.mjs'

export const N2B2_CATALOG = fromRoot('data', 'nuzlocke', 'unova-n2b2.json')

const PAGES = {
  gyms: { source: 'serebii', key: 'n2b2-gyms', url: 'https://www.serebii.net/black2white2/gyms.shtml' },
  elite: { source: 'serebii', key: 'n2b2-elitefour', url: 'https://www.serebii.net/black2white2/elitefour.shtml' },
}

/** En el orden de la campaña. `title` es el rótulo de Serebii en la tabla del rival. */
export const N2B2_ENCOUNTERS = [
  { id: 'cheren', nameEs: 'Cheren', kind: 'gym', page: 'gyms', title: 'Leader Cheren' },
  { id: 'hiedra', nameEs: 'Hiedra', kind: 'gym', page: 'gyms', title: 'Leader Roxie' },
  { id: 'camus', nameEs: 'Camus', kind: 'gym', page: 'gyms', title: 'Leader Burgh' },
  { id: 'camila', nameEs: 'Camila', kind: 'gym', page: 'gyms', title: 'Leader Elesa' },
  { id: 'yakon', nameEs: 'Yakón', kind: 'gym', page: 'gyms', title: 'Leader Clay' },
  { id: 'gerania', nameEs: 'Gerania', kind: 'gym', page: 'gyms', title: 'Leader Skyla' },
  { id: 'lirio', nameEs: 'Lirio', kind: 'gym', page: 'gyms', title: 'Leader Drayden' },
  { id: 'ciprian', nameEs: 'Ciprián', kind: 'gym', page: 'gyms', title: 'Leader Marlon' },
  { id: 'anis', nameEs: 'Anís', kind: 'elite', page: 'elite', title: 'Elite Four Shauntal' },
  { id: 'aza', nameEs: 'Aza', kind: 'elite', page: 'elite', title: 'Elite Four Grimsley' },
  { id: 'catleya', nameEs: 'Catleya', kind: 'elite', page: 'elite', title: 'Elite Four Caitlin' },
  { id: 'lotto', nameEs: 'Lotto', kind: 'elite', page: 'elite', title: 'Elite Four Marshal' },
  { id: 'iris', nameEs: 'Iris', kind: 'champion', page: 'elite', title: 'Champion Iris' },
]

const slugOf = (href, folder) => new RegExp(`/${folder}/([a-z0-9-]+)\\.shtml`).exec(href)?.[1] ?? null

/**
 * Tablas `trainer` de la página, sin las del modo Desafío (empiezan con su rótulo). Se corta en cada apertura: dentro hay tablas anidadas
 * (la de objetos del entrenador), así que buscar el cierre cortaría la tabla por la mitad.
 */
function normalTables(html) {
  return html.split('<table class="trainer">').slice(1).filter((table) => !table.slice(0, 200).includes('Challenge Mode'))
}

/** Equipo de la primera tabla del modo Normal con ese rótulo. */
export function parseSerebiiTeam(html, title) {
  const table = normalTables(html).find((candidate) => candidate.includes(`<td >${title}</td>`))
  if (!table) throw new Error(`${title}: no está su tabla del modo Normal`)
  const dexNumbers = [...table.split(`<td >${title}</td>`)[1].split('</tr>')[0].matchAll(/pokedex-bw\/(\d+)\.shtml/g)].map((match) => Number(match[1]))
  const levels = [...table.matchAll(/<td class="level"[^>]*>Level (\d+)<\/td>/g)].map((match) => Number(match[1]))
  const abilities = [...table.matchAll(/abilitydex\/([a-z0-9-]+)\.shtml/g)].map((match) => match[1])
  const attackCells = [...table.matchAll(/<td valign="top" class="bor"><b>Attacks<\/b>:([\s\S]*?)<\/td>/g)].map((match) => match[1])
  const itemCells = [...table.matchAll(/<td valign="top" class="bor"><b>Hold Item<\/b>:([\s\S]*?)<\/td>/g)].map((match) => match[1])
  const size = dexNumbers.length
  if (!size || levels.length !== size || abilities.length !== size || attackCells.length !== size || itemCells.length !== size) {
    throw new Error(`${title}: columnas descuadradas (${size} Pokémon, ${levels.length} niveles, ${abilities.length} habilidades, ${attackCells.length} ataques, ${itemCells.length} objetos)`)
  }
  return dexNumbers.map((dex, i) => {
    const species = gen5.species.get(String(dex)) ?? [...gen5.species].find((entry) => entry.num === dex)
    const item = slugOf(itemCells[i], 'itemdex')
    return {
      species: species?.id,
      level: levels[i],
      ability: gen5.abilities.get(abilities[i])?.id,
      item: item ? gen5.items.get(item)?.id ?? item : null,
      moves: [...attackCells[i].matchAll(/attackdex-bw\/([a-z0-9-]+)\.shtml/g)].map((match) => gen5.moves.get(match[1])?.id ?? match[1]),
    }
  })
}

const inRange = (value, min, max) => Number.isInteger(value) && value >= min && value <= max

export function validateN2b2Catalog(catalog) {
  if (catalog?.schemaVersion !== 1 || catalog.region !== 'unova' || catalog.edition !== 'n2b2') throw new Error('unova-n2b2.json: cabecera inválida')
  if (!Array.isArray(catalog.encounters) || catalog.encounters.length !== N2B2_ENCOUNTERS.length) throw new Error('unova-n2b2.json: se esperan 13 rivales')
  for (const [index, encounter] of catalog.encounters.entries()) {
    const expected = N2B2_ENCOUNTERS[index]
    if (encounter.id !== expected.id || encounter.kind !== expected.kind) throw new Error(`unova-n2b2.json: el rival ${index + 1} debería ser ${expected.id}`)
    if (!Array.isArray(encounter.team) || !inRange(encounter.team.length, 1, 6)) throw new Error(`${encounter.id}: se esperan de 1 a 6 Pokémon`)
    for (const [slot, member] of encounter.team.entries()) {
      const label = `${encounter.id}, Pokémon ${slot + 1}`
      if (gen5.species.get(member.species)?.id !== member.species) throw new Error(`${label}: especie inválida (${member.species})`)
      if (!inRange(member.level, 1, 100)) throw new Error(`${label}: nivel inválido`)
      if (gen5.abilities.get(member.ability)?.id !== member.ability) throw new Error(`${label}: habilidad inválida (${member.ability})`)
      if (member.item !== null && gen5.items.get(member.item)?.id !== member.item) throw new Error(`${label}: objeto inválido (${member.item})`)
      if (!Array.isArray(member.moves) || !inRange(member.moves.length, 1, 4) || new Set(member.moves).size !== member.moves.length ||
        member.moves.some((move) => gen5.moves.get(move)?.id !== move)) throw new Error(`${label}: movimientos inválidos (${member.moves})`)
    }
  }
}

export async function buildN2b2Catalog({ offline = false, refresh = false } = {}) {
  const pages = {}
  const source = {}
  for (const [name, page] of Object.entries(PAGES)) {
    const { html } = await getPage(page, { pins: {}, offline, refresh })
    pages[name] = html
    source[name] = { url: page.url, sha256: createHash('sha256').update(html).digest('hex') }
  }
  const encounters = N2B2_ENCOUNTERS.map((encounter) => ({
    id: encounter.id, nameEs: encounter.nameEs, kind: encounter.kind, sourceTrainer: encounter.title,
    team: parseSerebiiTeam(pages[encounter.page], encounter.title),
  }))
  const catalog = { schemaVersion: 1, region: 'unova', edition: 'n2b2', source, encounters }
  validateN2b2Catalog(catalog)
  return catalog
}

if (isMain(import.meta.url)) {
  const { values } = parseArgs({ options: { offline: { type: 'boolean' }, refresh: { type: 'boolean' } } })
  const catalog = await buildN2b2Catalog(values)
  await writeFile(N2B2_CATALOG, `${JSON.stringify(catalog, null, 2)}\n`)
  console.log(`unova-n2b2.json: ${catalog.encounters.length} rivales`)
}
