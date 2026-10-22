/**
 * Páginas de origen del PWT (PRD §7.2, §8.1) y su conversión a claves de torneo.
 *
 * Claves de torneo (`tournament`): kanto-leaders, johto-leaders, hoenn-leaders, sinnoh-leaders, unova-leaders,
 * world-leaders, champions y type-expert:<tipo en inglés, minúsculas>.
 */

export const REGIONS = ['kanto', 'johto', 'hoenn', 'sinnoh', 'unova']
export const EXPERT_TYPES = ['Bug', 'Dark', 'Dragon', 'Electric', 'Fighting', 'Fire', 'Flying', 'Ghost', 'Grass', 'Ground', 'Ice', 'Normal', 'Poison', 'Psychic', 'Rock', 'Steel', 'Water']

const capitalize = (text) => text[0].toUpperCase() + text.slice(1)

const BULBAPEDIA_BASE = 'https://bulbapedia.bulbagarden.net/wiki/'
const SEREBII_BASE = 'https://www.serebii.net/black2white2/pwt/'
const WIKIDEX_BASE = 'https://www.wikidex.net/wiki/'
const WIKIDEX_REGION_NAMES = { kanto: 'Kanto', johto: 'Johto', hoenn: 'Hoenn', sinnoh: 'Sinnoh', unova: 'Teselia' }

/** Cada página: { source, key, tournament, url, regionPage? } (`regionPage` solo en el Mundial de Bulbapedia, que va por región). */
export function listPages() {
  const pages = []
  const bulbapedia = (key, tournament, title, extra = {}) => pages.push({ source: 'bulbapedia', key, tournament, url: BULBAPEDIA_BASE + title, ...extra })
  for (const region of REGIONS) bulbapedia(`${region}-leaders`, `${region}-leaders`, `${capitalize(region)}_Leaders_Tournament`)
  for (const region of REGIONS) bulbapedia(`world-leaders-${region}`, 'world-leaders', `World_Leaders_Tournament/${capitalize(region)}`, { regionPage: region })
  bulbapedia('champions', 'champions', 'Champions_Tournament')
  for (const type of EXPERT_TYPES) bulbapedia(`type-expert-${type.toLowerCase()}`, `type-expert:${type.toLowerCase()}`, `Type_Expert_Tournament/${type}`)

  const serebii = (key, tournament, file) => pages.push({ source: 'serebii', key, tournament, url: SEREBII_BASE + file })
  for (const region of REGIONS) serebii(`${region}-leaders`, `${region}-leaders`, `${region}.shtml`)
  serebii('world-leaders', 'world-leaders', 'worldleaders.shtml')
  serebii('champions', 'champions', 'champion.shtml')

  const wikidex = (key, tournament, title) => pages.push({ source: 'wikidex', key, tournament, url: WIKIDEX_BASE + encodeURIComponent(title).replace(/%2F/g, '/') })
  for (const region of REGIONS) wikidex(`${region}-leaders`, `${region}-leaders`, `Torneo_Líderes_de_${WIKIDEX_REGION_NAMES[region]}`)
  wikidex('world-leaders', 'world-leaders', 'Torneo_Mundial_de_Líderes')
  wikidex('champions', 'champions', 'Torneo_Campeones')
  wikidex('type-expert', 'type-expert', 'Supertorneo_Tipo')
  return pages
}

/** Nombre legible del torneo (campo sourceTournament del esquema, PRD §8.2). */
export function tournamentLabel(tournament) {
  if (tournament === 'world-leaders') return 'World Leaders'
  if (tournament === 'champions') return 'Champions'
  if (tournament.startsWith('type-expert:')) return `Type Expert: ${capitalize(tournament.slice('type-expert:'.length))}`
  const region = tournament.replace(/-leaders$/, '')
  return `${capitalize(region)} Leaders`
}

/** Sufijo del id de variante: brock + kanto-leaders -> brock-kanto-leaders; type-expert:rock -> brock-type-expert-rock. */
export const tournamentSlug = (tournament) => tournament.replace(':', '-')

/** Orden de prioridad al deduplicar variantes idénticas: se conserva la primera. */
export const TOURNAMENT_ORDER = [...REGIONS.map((region) => `${region}-leaders`), 'world-leaders', 'champions', ...EXPERT_TYPES.map((type) => `type-expert:${type.toLowerCase()}`)]
